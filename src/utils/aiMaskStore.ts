/**
 * aiMaskStore.ts
 * 
 * OPFS-backed persistent storage for AI-generated masks.
 * Supports both background removal alpha masks and object removal inpaint masks.
 * 
 * Architecture:
 * - IndexedDB: stores metadata (clipId, sourceTime, settingsHash, size, timestamp)
 * - OPFS: stores actual mask blobs (lossless WebP with alpha or raw Uint8Array)
 * - In-memory LRU cache: hot layer for repeated reads during single export
 */

const DB_NAME = 'ai-mask-store';
const DB_VERSION = 1;
const METADATA_STORE = 'metadata';
const OPFS_ROOT_DIR = 'ai-masks';

interface MaskMetadata {
  clipId: string;
  sourceTimeMs: number;
  settingsHash: string;
  width: number;
  height: number;
  format: 'webp-alpha' | 'raw-rgba' | 'png';
  sizeBytes: number;
  createdAt: number;
  accessedAt: number;
}

interface MaskCacheEntry {
  metadata: MaskMetadata;
  bitmap: ImageBitmap | HTMLCanvasElement;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let opfsRootDirHandle: FileSystemDirectoryHandle | null = null;
const memoryCache = new Map<string, MaskCacheEntry>();
const MAX_MEMORY_CACHE_SIZE = 50; // LRU limit
const MAX_OPFS_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB budget

/**
 * Open IndexedDB database for metadata storage
 */
async function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const store = db.createObjectStore(METADATA_STORE, {
          keyPath: ['clipId', 'sourceTimeMs', 'settingsHash']
        });
        store.createIndex('clipId', 'clipId', { unique: false });
        store.createIndex('accessedAt', 'accessedAt', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  return dbPromise;
}

/**
 * Initialize OPFS root directory
 */
async function initOPFS(): Promise<FileSystemDirectoryHandle | null> {
  if (opfsRootDirHandle) return opfsRootDirHandle;
  
  try {
    const root = await navigator.storage.getDirectory();
    const dirHandle = await root.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
    opfsRootDirHandle = dirHandle;
    return dirHandle;
  } catch (err) {
    console.warn('[aiMaskStore] OPFS not available:', err);
    return null;
  }
}

/**
 * Generate OPFS file path from clipId, sourceTime, and settingsHash
 */
function getMaskFilePath(clipId: string, sourceTimeMs: number, settingsHash: string): string {
  const safeClipId = clipId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeClipId}/${sourceTimeMs}_${settingsHash}`;
}

/**
 * Get mask blob from OPFS
 */
async function getMaskBlobFromOPFS(filePath: string): Promise<Blob | null> {
  const dirHandle = await initOPFS();
  if (!dirHandle) return null;
  
  try {
    const parts = filePath.split('/');
    let currentHandle = dirHandle;
    
    // Navigate to clip directory
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }
    
    // Get file
    const fileName = parts[parts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file;
  } catch (err) {
    // File doesn't exist
    return null;
  }
}

/**
 * Store mask blob to OPFS
 */
async function storeMaskBlobToOPFS(filePath: string, blob: Blob): Promise<void> {
  const dirHandle = await initOPFS();
  if (!dirHandle) return;
  
  try {
    const parts = filePath.split('/');
    let currentHandle = dirHandle;
    
    // Navigate/create clip directory
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
    }
    
    // Create file
    const fileName = parts[parts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    console.error('[aiMaskStore] Failed to store mask to OPFS:', err);
  }
}

/**
 * Delete mask from OPFS
 */
async function deleteMaskFromOPFS(filePath: string): Promise<void> {
  const dirHandle = await initOPFS();
  if (!dirHandle) return;
  
  try {
    const parts = filePath.split('/');
    let currentHandle = dirHandle;
    
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }
    
    const fileName = parts[parts.length - 1];
    await currentHandle.removeEntry(fileName);
  } catch (err) {
    // File might not exist
  }
}

/**
 * Convert ImageBitmap/Canvas to lossless WebP blob with alpha
 */
async function canvasToWebPBlob(canvas: HTMLCanvasElement | ImageBitmap, quality: number = 1.0): Promise<Blob> {
  return new Promise((resolve) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d')!;
    
    const width = canvas instanceof ImageBitmap ? canvas.width : canvas.width;
    const height = canvas instanceof ImageBitmap ? canvas.height : canvas.height;
    
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    if (canvas instanceof ImageBitmap) {
      ctx.drawImage(canvas, 0, 0);
    } else {
      ctx.drawImage(canvas, 0, 0);
    }
    
    tempCanvas.toBlob(
      (blob) => resolve(blob || new Blob()),
      'image/webp',
      quality
    );
  });
}

/**
 * Convert blob back to ImageBitmap
 */
async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * Update LRU access time in memory cache
 */
function touchMemoryCache(key: string): void {
  const entry = memoryCache.get(key);
  if (entry) {
    entry.metadata.accessedAt = Date.now();
    memoryCache.set(key, entry);
  }
}

/**
 * Evict oldest entries from memory cache if over limit
 */
function evictMemoryCacheIfNeeded(): void {
  if (memoryCache.size <= MAX_MEMORY_CACHE_SIZE) return;
  
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].metadata.accessedAt - b[1].metadata.accessedAt);
  
  // Remove oldest 10%
  const toRemove = Math.max(1, Math.floor(MAX_MEMORY_CACHE_SIZE * 0.1));
  for (let i = 0; i < toRemove; i++) {
    memoryCache.delete(entries[i][0]);
  }
}

/**
 * Store AI mask to OPFS and memory cache
 */
export async function storeAiMask(
  clipId: string,
  sourceTimeMs: number,
  settingsHash: string,
  maskCanvas: HTMLCanvasElement | ImageBitmap
): Promise<void> {
  const width = maskCanvas instanceof ImageBitmap ? maskCanvas.width : maskCanvas.width;
  const height = maskCanvas instanceof ImageBitmap ? maskCanvas.height : maskCanvas.height;
  
  const metadata: MaskMetadata = {
    clipId,
    sourceTimeMs,
    settingsHash,
    width,
    height,
    format: 'webp-alpha',
    sizeBytes: 0,
    createdAt: Date.now(),
    accessedAt: Date.now(),
  };
  
  // Convert to WebP blob
  const blob = await canvasToWebPBlob(maskCanvas);
  metadata.sizeBytes = blob.size;
  
  // Store to OPFS
  const filePath = getMaskFilePath(clipId, sourceTimeMs, settingsHash);
  await storeMaskBlobToOPFS(filePath, blob);
  
  // Store metadata to IndexedDB
  const db = await openDB();
  const tx = db.transaction(METADATA_STORE, 'readwrite');
  const store = tx.objectStore(METADATA_STORE);
  await store.put(metadata);
  
  // Add to memory cache
  const cacheKey = `${clipId}:${sourceTimeMs}:${settingsHash}`;
  evictMemoryCacheIfNeeded();
  
  const bitmap = await blobToImageBitmap(blob);
  memoryCache.set(cacheKey, { metadata, bitmap });
}

/**
 * Retrieve AI mask from OPFS or memory cache
 */
export async function getAiMask(
  clipId: string,
  sourceTimeMs: number,
  settingsHash: string
): Promise<ImageBitmap | null> {
  const cacheKey = `${clipId}:${sourceTimeMs}:${settingsHash}`;
  
  // Check memory cache first
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    touchMemoryCache(cacheKey);
    return cached.bitmap instanceof ImageBitmap 
      ? cached.bitmap 
      : await createImageBitmap(cached.bitmap);
  }
  
  // Check IndexedDB for metadata
  const db = await openDB();
  const tx = db.transaction(METADATA_STORE, 'readonly');
  const store = tx.objectStore(METADATA_STORE);
  const metadata = await store.get([clipId, sourceTimeMs, settingsHash]) as MaskMetadata | undefined;
  
  if (!metadata) return null;
  
  // Load from OPFS
  const filePath = getMaskFilePath(clipId, sourceTimeMs, settingsHash);
  const blob = await getMaskBlobFromOPFS(filePath);
  if (!blob) return null;
  
  // Convert to ImageBitmap
  const bitmap = await blobToImageBitmap(blob);
  
  // Add to memory cache
  evictMemoryCacheIfNeeded();
  memoryCache.set(cacheKey, { metadata, bitmap });
  
  return bitmap;
}

/**
 * Delete mask for specific clip/time/settings
 */
export async function deleteAiMask(
  clipId: string,
  sourceTimeMs: number,
  settingsHash: string
): Promise<void> {
  const cacheKey = `${clipId}:${sourceTimeMs}:${settingsHash}`;
  memoryCache.delete(cacheKey);
  
  const db = await openDB();
  const tx = db.transaction(METADATA_STORE, 'readwrite');
  const store = tx.objectStore(METADATA_STORE);
  await store.delete([clipId, sourceTimeMs, settingsHash]);
  
  const filePath = getMaskFilePath(clipId, sourceTimeMs, settingsHash);
  await deleteMaskFromOPFS(filePath);
}

/**
 * Clear all masks for a clip
 */
export async function clearClipMasks(clipId: string): Promise<void> {
  // Clear from memory cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`${clipId}:`)) {
      memoryCache.delete(key);
    }
  }
  
  // Clear from IndexedDB
  const db = await openDB();
  const tx = db.transaction(METADATA_STORE, 'readwrite');
  const store = tx.objectStore(METADATA_STORE);
  const index = store.index('clipId');
  const range = IDBKeyRange.only(clipId);
  
  const keys: Array<[string, number, string]> = [];
  await new Promise<void>((resolve) => {
    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        keys.push([cursor.value.clipId, cursor.value.sourceTimeMs, cursor.value.settingsHash]);
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
  
  for (const [cid, time, hash] of keys) {
    await store.delete([cid, time, hash]);
    const filePath = getMaskFilePath(cid, time, hash);
    await deleteMaskFromOPFS(filePath);
  }
}

/**
 * Get total storage usage and check quota
 */
export async function getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number }> {
  try {
    const estimate = await navigator.storage.estimate();
    return {
      usedBytes: estimate.usage || 0,
      quotaBytes: estimate.quota || MAX_OPFS_QUOTA_BYTES,
    };
  } catch {
    return { usedBytes: 0, quotaBytes: MAX_OPFS_QUOTA_BYTES };
  }
}

/**
 * Check if storage is near quota (>90%)
 */
export async function isNearQuota(): Promise<boolean> {
  const { usedBytes, quotaBytes } = await getStorageUsage();
  return usedBytes > quotaBytes * 0.9;
}

/**
 * LRU eviction to stay under quota
 */
export async function evictOldestMasks(targetFreeBytes: number): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(METADATA_STORE, 'readwrite');
  const store = tx.objectStore(METADATA_STORE);
  const index = store.index('accessedAt');
  
  let freedBytes = 0;
  const request = index.openCursor();
  const toDelete: Array<[string, number, string]> = [];
  
  await new Promise<void>((resolve) => {
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && freedBytes < targetFreeBytes) {
        toDelete.push([cursor.value.clipId, cursor.value.sourceTimeMs, cursor.value.settingsHash]);
        freedBytes += cursor.value.sizeBytes;
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
  
  for (const [clipId, time, hash] of toDelete) {
    await store.delete([clipId, time, hash]);
    const filePath = getMaskFilePath(clipId, time, hash);
    await deleteMaskFromOPFS(filePath);
    memoryCache.delete(`${clipId}:${time}:${hash}`);
  }
  
  return freedBytes;
}

/**
 * Export for worker use (no DOM dependencies in these functions)
 */
export {
  openDB as _openDB,
  getMaskFilePath,
};
