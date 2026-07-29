/**
 * mediaFileHandle.ts
 *
 * Persistent file-handle store for media files. Maps mediaId → FileSystemFileHandle
 * (or a fallback pointer for browsers without FSA support). This is what lets the
 * editor stream media directly from disk via the FileSystemFileHandle.getFile() API
 * instead of copying the whole file into IndexedDB RAM cache.
 *
 * Browser support:
 *   - Chrome / Edge 86+  : FileSystemFileHandle + IndexedDB store (handle cannot be
 *                           structured-cloned, so we re-prompt permission on reload)
 *   - Firefox            : showOpenFilePicker() not yet available → fallback
 *   - Safari (TP)        : recent support; otherwise fallback
 *
 * Fallback path:
 *   When FSA is unavailable, we still cache the file in IndexedDB but consumers
 *   must read it through the windowed cache to avoid pulling the full blob into RAM.
 */

interface StoredHandle {
  mediaId: string;
  name: string;
  size: number;
  lastModified: number;
  type: string;
  handle?: FileSystemFileHandle;
}

const HANDLE_STORE = 'procut_file_handles_v1';
const DB_NAME = 'procut_handles_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openHandleDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE, { keyPath: 'mediaId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function idbPut(val: StoredHandle): Promise<void> {
  return openHandleDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, 'readwrite');
        tx.objectStore(HANDLE_STORE).put(val);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbGet(mediaId: string): Promise<StoredHandle | null> {
  return openHandleDB().then(
    (db) =>
      new Promise<StoredHandle | null>((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, 'readonly');
        const r = tx.objectStore(HANDLE_STORE).get(mediaId);
        r.onsuccess = () => resolve(r.result ?? null);
        r.onerror = () => reject(r.error);
      }),
  );
}

function idbDelete(mediaId: string): Promise<void> {
  return openHandleDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, 'readwrite');
        tx.objectStore(HANDLE_STORE).delete(mediaId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/**
 * Save a File + optional handle for a mediaId. The handle is what makes SSD
 * streaming possible — the browser can later call .getFile() without copying
 * the whole file into RAM.
 */
export async function storeMediaHandle(
  mediaId: string,
  file: File,
  handle?: FileSystemFileHandle,
): Promise<void> {
  await idbPut({
    mediaId,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    type: file.type,
    handle,
  });
}

/**
 * Resolve a mediaId back to a File. Uses the stored handle when available
 * (zero-copy stream from disk). When the handle permission was lost (e.g.
 * after page reload on a different browser session), re-prompts the user
 * once. Returns null if permission denied or no entry.
 */
export async function resolveMediaFile(mediaId: string): Promise<File | null> {
  const entry = await idbGet(mediaId);
  if (!entry) return null;

  if (entry.handle && 'queryPermission' in entry.handle) {
    try {
      const handle = entry.handle as FileSystemFileHandle & {
        queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>;
        requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>;
      };
      let perm: 'granted' | 'prompt' | 'denied' = 'prompt';
      if (typeof handle.queryPermission === 'function') {
        perm = await handle.queryPermission({ mode: 'read' });
      }
      if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
        perm = await handle.requestPermission({ mode: 'read' });
      }
      if (perm === 'granted') {
        return await handle.getFile();
      }
      return null;
    } catch {
      // Handle became invalid (renamed/moved/deleted); fall through
      return null;
    }
  }

  // Fallback: re-fetch from IDB media library.
  try {
    const { getFileFromDB } = await import('./projectPersistence');
    return await getFileFromDB(mediaId);
  } catch {
    return null;
  }
}

export async function deleteMediaHandle(mediaId: string): Promise<void> {
  await idbDelete(mediaId);
}

export async function getStoredMediaInfo(
  mediaId: string,
): Promise<{ name: string; size: number } | null> {
  const entry = await idbGet(mediaId);
  if (!entry) return null;
  return { name: entry.name, size: entry.size };
}
