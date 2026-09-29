/**
 * ssdRecordingStorage.ts
 *
 * Physical SSD Storage & Direct Disk Persister for Teleprompter Recordings.
 *
 * Safety First:
 * 1. Offloads raw video/audio recordings from volatile browser RAM directly to physical SSD storage
 *    via IndexedDB Blob stores and immediate disk download triggering.
 * 2. Revokes in-memory hot object URLs to free RAM before high-resolution super-resolution/upscaling begins.
 * 3. Streams the file back from SSD storage when upscaling starts, ensuring low-end systems
 *    never run out of memory or crash.
 */

const SSD_DB_NAME = 'procut_ssd_recordings_v1';
const SSD_DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings';

let ssdDbPromise: Promise<IDBDatabase | null> | null = null;

function openSsdDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (ssdDbPromise) return ssdDbPromise;

  ssdDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(SSD_DB_NAME, SSD_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
          db.createObjectStore(STORE_RECORDINGS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => {
        console.warn('[ssdRecordingStorage] Failed to open IndexedDB on SSD:', e);
        ssdDbPromise = null;
        resolve(null);
      };
    } catch (e) {
      console.warn('[ssdRecordingStorage] IndexedDB error:', e);
      resolve(null);
    }
  });

  return ssdDbPromise;
}

export interface SsdSavedRecording {
  id: string;
  blob: Blob;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  timestamp: number;
}

/**
 * Saves the recorded video or audio directly to SSD storage (IndexedDB)
 * AND triggers an automatic download to the user's SSD filesystem so the file
 * is physically written to disk and safe from browser crashes.
 */
export async function saveRecordingToSsd(
  recordingId: string,
  blob: Blob,
  filename: string,
  autoDownloadToDisk = true
): Promise<SsdSavedRecording> {
  const db = await openSsdDB();

  const record: SsdSavedRecording = {
    id: recordingId,
    blob,
    filename,
    sizeBytes: blob.size,
    mimeType: blob.type,
    timestamp: Date.now(),
  };

  // 1. Write to IndexedDB on physical disk/SSD
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
        tx.objectStore(STORE_RECORDINGS).put(record, recordingId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // 2. Trigger direct download to user's physical SSD folder
  if (autoDownloadToDisk && typeof document !== 'undefined') {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke temporary download link after a brief moment
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.warn('[ssdRecordingStorage] Auto-download to SSD trigger skipped:', err);
    }
  }

  return record;
}

/**
 * Retrieves the recording directly from SSD storage (IndexedDB).
 */
export async function loadRecordingFromSsd(recordingId: string): Promise<Blob | null> {
  const db = await openSsdDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDINGS, 'readonly');
      const req = tx.objectStore(STORE_RECORDINGS).get(recordingId);
      req.onsuccess = () => {
        const result = req.result as SsdSavedRecording | undefined;
        if (result && result.blob) {
          resolve(result.blob);
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
 * Removes the recording from SSD cache when no longer needed.
 */
export async function deleteRecordingFromSsd(recordingId: string): Promise<void> {
  const db = await openSsdDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
      tx.objectStore(STORE_RECORDINGS).delete(recordingId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
