/**
 * diskMediaCache.ts
 *
 * IndexedDB-backed Temp SSD Storage for waveform peaks and frame strip thumbnails.
 * Offloads massive arrays and base64 image strings from browser RAM/JS heap to disk (SSD),
 * allowing large projects with dozens of split clips to remain lightweight and crash-free.
 */

const DB_NAME = 'procut_disk_cache_v1';
const DB_VERSION = 1;
const STORE_WAVEFORMS = 'waveforms';
const STORE_FRAMESTRIPS = 'framestrips';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDiskCacheDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WAVEFORMS)) {
          db.createObjectStore(STORE_WAVEFORMS);
        }
        if (!db.objectStoreNames.contains(STORE_FRAMESTRIPS)) {
          db.createObjectStore(STORE_FRAMESTRIPS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[diskMediaCache] Failed to open IndexedDB, falling back to memory only.');
        dbPromise = null;
        resolve(null);
      };
    } catch (e) {
      console.warn('[diskMediaCache] IndexedDB error:', e);
      resolve(null);
    }
  });

  return dbPromise;
}

// Bounded in-memory hot cache (LRU, max 50 items) for immediate UI access
const hotWaveforms = new Map<string, number[]>();
const hotFrameStrips = new Map<string, string[]>();
const MAX_HOT_ITEMS = 50;

function touchLru<K, V>(map: Map<K, V>, key: K, val: V, maxItems: number) {
  map.delete(key);
  map.set(key, val);
  if (map.size > maxItems) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
}

/**
 * Save full-fidelity waveform peaks to Temp SSD Storage (IndexedDB).
 */
export async function saveWaveformToDisk(mediaId: string, peaks: number[] | Float32Array): Promise<void> {
  const arr = peaks instanceof Float32Array ? Array.from(peaks) : peaks;
  touchLru(hotWaveforms, mediaId, arr, MAX_HOT_ITEMS);

  const db = await openDiskCacheDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_WAVEFORMS, 'readwrite');
      tx.objectStore(STORE_WAVEFORMS).put(arr, mediaId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve waveform peaks from Temp SSD Storage (IndexedDB).
 */
export async function getWaveformFromDisk(mediaId: string): Promise<number[] | null> {
  if (hotWaveforms.has(mediaId)) {
    return hotWaveforms.get(mediaId)!;
  }

  const db = await openDiskCacheDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_WAVEFORMS, 'readonly');
      const req = tx.objectStore(STORE_WAVEFORMS).get(mediaId);
      req.onsuccess = () => {
        const val = req.result as number[] | undefined;
        if (val && Array.isArray(val)) {
          touchLru(hotWaveforms, mediaId, val, MAX_HOT_ITEMS);
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save generated frame strip thumbnails to Temp SSD Storage (IndexedDB).
 */
export async function saveFrameStripToDisk(mediaId: string, frames: string[]): Promise<void> {
  touchLru(hotFrameStrips, mediaId, frames, MAX_HOT_ITEMS);

  const db = await openDiskCacheDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_FRAMESTRIPS, 'readwrite');
      tx.objectStore(STORE_FRAMESTRIPS).put(frames, mediaId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve frame strip thumbnails from Temp SSD Storage (IndexedDB).
 */
export async function getFrameStripFromDisk(mediaId: string): Promise<string[] | null> {
  if (hotFrameStrips.has(mediaId)) {
    return hotFrameStrips.get(mediaId)!;
  }

  const db = await openDiskCacheDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_FRAMESTRIPS, 'readonly');
      const req = tx.objectStore(STORE_FRAMESTRIPS).get(mediaId);
      req.onsuccess = () => {
        const val = req.result as string[] | undefined;
        if (val && Array.isArray(val)) {
          touchLru(hotFrameStrips, mediaId, val, MAX_HOT_ITEMS);
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Delete a media item's disk cache when media is removed from project.
 */
export async function deleteMediaDiskCache(mediaId: string): Promise<void> {
  hotWaveforms.delete(mediaId);
  hotFrameStrips.delete(mediaId);

  const db = await openDiskCacheDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_WAVEFORMS, STORE_FRAMESTRIPS], 'readwrite');
      tx.objectStore(STORE_WAVEFORMS).delete(mediaId);
      tx.objectStore(STORE_FRAMESTRIPS).delete(mediaId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all Temp SSD media caches.
 */
export async function clearAllDiskMediaCache(): Promise<void> {
  hotWaveforms.clear();
  hotFrameStrips.clear();

  const db = await openDiskCacheDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_WAVEFORMS, STORE_FRAMESTRIPS], 'readwrite');
      tx.objectStore(STORE_WAVEFORMS).clear();
      tx.objectStore(STORE_FRAMESTRIPS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
