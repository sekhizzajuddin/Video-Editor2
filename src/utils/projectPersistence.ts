/**
 * projectPersistence.ts
 *
 * IndexedDB persistence for ProCut Video Editor.
 * Stores raw media files (File/Blob) and project timeline metadata (tracks, settings, etc.)
 * so the project can be completely restored after a page refresh.
 */

import { MediaItem, TimelineTrack } from '@/types';

const DB_NAME = 'procut_editor_db';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files'); // stores raw File objects, keyed by mediaId
      }
      if (!db.objectStoreNames.contains('project')) {
        db.createObjectStore('project'); // stores tracks, mediaLibrary metadata, settings
      }
    };
  });
}

/**
 * Saves a local media File to IndexedDB.
 */
export async function saveFileToDB(mediaId: string, file: File): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.put(file, mediaId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a media File from IndexedDB.
 */
export async function getFileFromDB(mediaId: string): Promise<File | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const request = store.get(mediaId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a media File from IndexedDB.
 */
export async function deleteFileFromDB(mediaId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.delete(mediaId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists the entire project config (tracks metadata, media list, timeline) to IndexedDB.
 */
export async function saveProjectToDB(data: {
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  currentTime: number;
}): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('project', 'readwrite');
    const store = transaction.objectStore('project');

    // Remove any actual Blob URLs from the persistent metadata as they will be re-generated
    const cleanMediaLibrary = data.mediaLibrary.map(item => ({
      ...item,
      url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
      thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
    }));

    const cleanTracks = data.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => ({
        ...clip,
        isPreview: false
      }))
    }));

    store.put(cleanTracks, 'tracks');
    store.put(cleanMediaLibrary, 'mediaLibrary');
    store.put(data.currentTime, 'currentTime');

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Loads the project metadata from IndexedDB and regenerates Blob URLs for files.
 */
export async function loadProjectFromDB(): Promise<{
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  currentTime: number;
} | null> {
  const db = await getDB();
  
  const getValue = (key: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('project', 'readonly');
      const store = transaction.objectStore('project');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  try {
    const rawTracks = await getValue('tracks') as TimelineTrack[];
    const rawMediaLibrary = await getValue('mediaLibrary') as MediaItem[];
    const currentTime = (await getValue('currentTime') as number) || 0;

    if (!rawTracks || !rawMediaLibrary) return null;

    // Restore Blob URLs from IndexedDB files store
    const mediaLibrary: MediaItem[] = [];

    for (const item of rawMediaLibrary) {
      if (item.type === 'text' || item.type === 'fx') {
        mediaLibrary.push(item);
        continue;
      }

      const file = await getFileFromDB(item.id);
      if (file) {
        const objectUrl = URL.createObjectURL(file);

        // Regenerate thumbnail if present
        let newThumb = undefined;
        if (item.thumbnail) {
          newThumb = item.type === 'image' ? objectUrl : undefined;
        }

        mediaLibrary.push({
          ...item,
          url: objectUrl,
          thumbnail: newThumb || item.thumbnail
        });
      } else {
        mediaLibrary.push(item);
      }
    }

    return {
      tracks: rawTracks,
      mediaLibrary,
      currentTime
    };
  } catch (err) {
    console.error('Failed to load project from DB:', err);
    return null;
  }
}

/**
 * Clears the entire database (except files store, or all depending on flag)
 */
export async function clearProjectDB(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['project', 'files'], 'readwrite');
    transaction.objectStore('project').clear();
    transaction.objectStore('files').clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
