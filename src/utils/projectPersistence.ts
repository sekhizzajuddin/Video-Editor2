/**
 * projectPersistence.ts
 *
 * IndexedDB persistence for ProCut Video Editor.
 * Stores raw media files (File/Blob) and project timeline metadata (tracks, settings, etc.)
 * so the project can be completely restored after a page refresh.
 */

import { MediaItem, TimelineTrack } from '@/types';

const DB_NAME = 'procut_editor_db';
const DB_VERSION = 3; // Bumped to handle new autosaves object store

let activeProjectId: string = 'default';
let dbInstance: IDBDatabase | null = null;

export function setActiveProject(id: string) {
  if (activeProjectId !== id) {
    activeProjectId = id;
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  }
}

// Global DB for storing the list of recent projects
const GLOBAL_DB_NAME = 'procut_global_db';
let globalDbInstance: IDBDatabase | null = null;

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
}

function getGlobalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (globalDbInstance) return resolve(globalDbInstance);
    const request = indexedDB.open(GLOBAL_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      globalDbInstance = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
    };
  });
}

export async function listRecentProjects(): Promise<ProjectMetadata[]> {
  const db = await getGlobalDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as ProjectMetadata[]).sort((a,b) => b.lastModified - a.lastModified));
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectMeta(meta: ProjectMetadata): Promise<void> {
  const db = await getGlobalDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.put(meta);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProjectMeta(id: string): Promise<void> {
  const db = await getGlobalDB();
  // Also delete the actual DB!
  indexedDB.deleteDatabase(`procut_editor_db_${id}`);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}


function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const dbName = activeProjectId === 'default' ? DB_NAME : `${DB_NAME}_${activeProjectId}`;
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files'); // stores raw File objects, keyed by mediaId
      }
      if (!db.objectStoreNames.contains('project')) {
        db.createObjectStore('project'); // stores tracks, mediaLibrary metadata, settings
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata'); // stores file hashes mapping for re-linking
      }
      if (!db.objectStoreNames.contains('autosaves')) {
        db.createObjectStore('autosaves'); // stores timestamped project snapshots
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
 * Generates a simple hash for a file (using name + size + lastModified)
 * to help with re-linking when importing .procut files.
 */
export function generateFileHash(file: File): string {
  const str = `${file.name}_${file.size}_${file.lastModified}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Persists the entire project config (tracks metadata, media list, timeline) to IndexedDB.
 */
export async function saveProjectToDB(data: {
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  folders?: any[]; // Making it optional for backward compatibility
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
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
      frameStrip: item.frameStrip ? item.frameStrip.map(() => 'PENDING_RESTORE') : undefined,
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
    if (data.aspectRatio) {
      store.put(data.aspectRatio, 'aspectRatio');
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Loads the project metadata from IndexedDB and regenerates Blob URLs for files.
 */
/**
 * Takes a clean snapshot (with PENDING_RESTORE files) and fully restores its Blob URLs and thumbnails from IndexedDB.
 */
export async function restoreSnapshotMedia(snapshot: {
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
}): Promise<{
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
}> {
  const mediaLibrary: MediaItem[] = [];

  for (const item of snapshot.mediaLibrary) {
    if (item.type === 'text' || item.type === 'fx') {
      mediaLibrary.push(item);
      continue;
    }

    const file = await getFileFromDB(item.id);
    if (file) {
      const objectUrl = URL.createObjectURL(file);

      // Regenerate thumbnail if present
      let newThumb = undefined;
      if (item.thumbnail === 'PENDING_RESTORE') {
        if (item.type === 'image') {
          newThumb = objectUrl;
        } else if (item.type === 'video') {
          newThumb = await generateVideoThumbnail(objectUrl, item.width, item.height);
        }
      }

      // Handle frameStrip restoration
      let restoredFrameStrip: string[] | undefined = undefined;
      if (item.frameStrip && item.frameStrip.length > 0) {
        if (item.type === 'video') {
          restoredFrameStrip = await generateFrameStrip(objectUrl, item.duration || 10, 10);
        } else if (item.type === 'image' && item.thumbnail !== 'PENDING_RESTORE') {
          restoredFrameStrip = [objectUrl];
        }
      }

      mediaLibrary.push({
        ...item,
        url: objectUrl,
        thumbnail: newThumb || undefined,
        frameStrip: restoredFrameStrip || item.frameStrip,
      });
    } else {
      mediaLibrary.push(item);
    }
  }

  return {
    tracks: snapshot.tracks,
    mediaLibrary,
    currentTime: snapshot.currentTime,
    aspectRatio: snapshot.aspectRatio,
  };
}

/**
 * Loads the project metadata from IndexedDB and regenerates Blob URLs for files.
 */
export async function loadProjectFromDB(): Promise<{
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  folders?: any[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
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
    const aspectRatio = (await getValue('aspectRatio') as any) || '16:9';

    if (!rawTracks || !rawMediaLibrary) return null;

    return restoreSnapshotMedia({
      tracks: rawTracks,
      mediaLibrary: rawMediaLibrary,
      currentTime,
      aspectRatio,
    });
  } catch (err) {
    console.error('Failed to load project from DB:', err);
    return null;
  }
}

/**
 * Saves a versioned auto-save snapshot to the 'autosaves' object store.
 */
export async function saveAutosaveToDB(data: {
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
}, timestamp: number): Promise<void> {
  const db = await getDB();
  
  // Clean media and tracks just like saveProjectToDB
  const cleanMediaLibrary = data.mediaLibrary.map(item => ({
    ...item,
    url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
    thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
    frameStrip: item.frameStrip ? item.frameStrip.map(() => 'PENDING_RESTORE') : undefined,
  }));

  const cleanTracks = data.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({
      ...clip,
      isPreview: false
    }))
  }));

  const snapshot = {
    tracks: cleanTracks,
    mediaLibrary: cleanMediaLibrary,
    currentTime: data.currentTime,
    aspectRatio: data.aspectRatio || '16:9',
    timestamp,
  };

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('autosaves', 'readwrite');
    const store = transaction.objectStore('autosaves');
    store.put(snapshot, timestamp.toString());

    transaction.oncomplete = () => {
      // Clean up old autosaves (keep only last 10)
      const cleanupTx = db.transaction('autosaves', 'readwrite');
      const cleanupStore = cleanupTx.objectStore('autosaves');
      const keysReq = cleanupStore.getAllKeys();
      keysReq.onsuccess = () => {
        const keys = keysReq.result as string[];
        if (keys.length > 10) {
          keys.sort((a, b) => Number(a) - Number(b));
          const numToDelete = keys.length - 10;
          for (let i = 0; i < numToDelete; i++) {
            cleanupStore.delete(keys[i]);
          }
        }
      };
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Gets all versioned autosaves from IndexedDB.
 */
export async function getAutosavesFromDB(): Promise<{
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  currentTime: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  timestamp: number;
}[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('autosaves', 'readonly');
    const store = transaction.objectStore('autosaves');
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result || [];
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a specific autosave version.
 */
export async function deleteAutosaveFromDB(timestamp: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('autosaves', 'readwrite');
    const store = transaction.objectStore('autosaves');
    const request = store.delete(timestamp.toString());
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generates a thumbnail frame from a video URL by seeking to 0.5s.
 */
function generateVideoThumbnail(videoUrl: string, width?: number, height?: number): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
      try {
        video.load();
      } catch (_) {}
    };

    video.onloadedmetadata = () => {
      video.currentTime = 0.5;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width || video.videoWidth || 160;
        canvas.height = height || video.videoHeight || 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(data);
        } else {
          cleanup();
          resolve('');
        }
      } catch {
        cleanup();
        resolve('');
      }
    };

    video.onerror = () => {
      cleanup();
      resolve('');
    };

    video.src = videoUrl;
  });
}

/**
 * Generates a strip of frame thumbnails from a video URL.
 */
function generateFrameStrip(videoUrl: string, duration: number, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const frames: string[] = [];

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
      try {
        video.load();
      } catch (_) {}
    };

    const captureFrame = (index: number) => {
      if (index >= count) {
        cleanup();
        resolve(frames);
        return;
      }
      video.currentTime = (duration / count) * index;
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.5));
          }
        } catch {
          // Skip frame
        }
        captureFrame(index + 1);
      };
    };

    video.onloadedmetadata = () => {
      captureFrame(0);
    };

    video.onerror = () => {
      cleanup();
      resolve(frames);
    };

    video.src = videoUrl;
  });
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

/**
 * Saves project templates to IndexedDB, cleaning temporary blob URLs.
 */
export async function saveTemplatesToDB(templates: any[]): Promise<void> {
  const db = await getDB();
  const cleanTemplates = templates.map(template => ({
    ...template,
    mediaLibrary: template.mediaLibrary.map((item: any) => ({
      ...item,
      url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
      thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
      frameStrip: item.frameStrip ? item.frameStrip.map(() => 'PENDING_RESTORE') : undefined,
    })),
    tracks: template.tracks.map((track: any) => ({
      ...track,
      clips: track.clips.map((clip: any) => ({
        ...clip,
        isPreview: false
      }))
    }))
  }));

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('project', 'readwrite');
    const store = transaction.objectStore('project');
    store.put(cleanTemplates, 'templates');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Loads project templates from IndexedDB.
 */
export async function getTemplatesFromDB(): Promise<any[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('project', 'readonly');
    const store = transaction.objectStore('project');
    const request = store.get('templates');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Resolves a media item's PENDING_RESTORE state by retrieving the file from IndexedDB
 * and generating Blob URLs, thumbnails, and frameStrips.
 */
export async function resolveMediaItemFromDB(item: MediaItem): Promise<MediaItem> {
  if (item.type === 'text' || item.type === 'fx') {
    return item;
  }

  try {
    const file = await getFileFromDB(item.id);
    if (file) {
      const objectUrl = URL.createObjectURL(file);

      // Regenerate thumbnail if present
      let newThumb = undefined;
      if (item.thumbnail === 'PENDING_RESTORE' || !item.thumbnail) {
        if (item.type === 'image') {
          newThumb = objectUrl;
        } else if (item.type === 'video') {
          newThumb = await generateVideoThumbnail(objectUrl, item.width, item.height);
        }
      } else {
        newThumb = item.thumbnail;
      }

      // Handle frameStrip restoration
      let restoredFrameStrip = item.frameStrip;
      if (!restoredFrameStrip || restoredFrameStrip.includes('PENDING_RESTORE')) {
        if (item.type === 'video') {
          restoredFrameStrip = await generateFrameStrip(objectUrl, item.duration || 10, 10);
        } else if (item.type === 'image') {
          restoredFrameStrip = [objectUrl];
        }
      }

      return {
        ...item,
        url: objectUrl,
        thumbnail: newThumb,
        frameStrip: restoredFrameStrip,
      };
    }
  } catch (err) {
    console.error('Failed to resolve media item from DB:', err);
  }

  return item;
}