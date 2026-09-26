// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * projectPersistence.ts
 *
 * IndexedDB persistence for ProCut Video Editor.
 * Stores raw media files (File/Blob) and project timeline metadata (tracks, settings, etc.)
 * so the project can be completely restored after a page refresh.
 */

import { MediaItem, TimelineTrack, ExportRegion } from '@/types';
import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';

const DB_NAME = 'procut_editor_db';
const DB_VERSION = 3; // Bumped to handle new autosaves object store

export interface ProcutFileFormat {
  version: string;
  projectId: string;
  projectName: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  currentTime: number;
  totalDuration?: number;
  tracks: TimelineTrack[];
  folders?: any[];
  subtitles?: any[];
  markers?: any[];
  beatMarkers?: any[];
  exportRegions?: ExportRegion[];
  pipWindows?: Record<string, any>;
  sequences?: any[];
  mediaLibrary: any[];
}

let activeProjectId: string = 'default';
let dbInstance: IDBDatabase | null = null;
let dbOpeningPromise: Promise<IDBDatabase> | null = null;
let openingProjectId: string | null = null;

const activeBlobUrls = new Set<string>();

export function registerBlobUrl(url: string) {
  if (url && url.startsWith('blob:')) {
    activeBlobUrls.add(url);
  }
}

export function revokeAllBlobUrls() {
  activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
  activeBlobUrls.clear();
}

export function setActiveProject(id: string) {
  if (activeProjectId !== id) {
    revokeAllBlobUrls();
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
  // Validate cached instance is still usable (not closing/closed)
  if (dbInstance && openingProjectId === activeProjectId) {
    try {
      // Quick check: if the db's objectStoreNames is accessible, the connection is live
      void dbInstance.objectStoreNames;
      return Promise.resolve(dbInstance);
    } catch {
      // Connection is dead/closing — discard and re-open
      dbInstance = null;
    }
  }
  if (dbOpeningPromise && openingProjectId === activeProjectId) return dbOpeningPromise;

  openingProjectId = activeProjectId;
  
  // Close any stale instance before opening a new one
  if (dbInstance) {
    try { dbInstance.close(); } catch { /* ignore */ }
    dbInstance = null;
  }

  dbOpeningPromise = new Promise((resolve, reject) => {
    const dbName = activeProjectId === 'default' ? DB_NAME : `${DB_NAME}_${activeProjectId}`;
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onerror = () => {
      dbOpeningPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      const db = request.result;
      dbInstance = db;
      dbOpeningPromise = null;
      
      db.onclose = () => { dbInstance = null; dbOpeningPromise = null; };
      db.onversionchange = () => { db.close(); dbInstance = null; dbOpeningPromise = null; };
      db.onerror = () => { dbInstance = null; dbOpeningPromise = null; };

      resolve(db);
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
  
  return dbOpeningPromise;
}

/**
 * Saves a local media File to IndexedDB.
 * Retries once with a fresh connection if the DB is closing.
 */
export async function saveFileToDB(mediaId: string, file: File): Promise<void> {
  const attemptSave = async (isRetry: boolean): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction('files', 'readwrite');
      } catch (err: any) {
        if (err.name === 'InvalidStateError' && !isRetry) {
          dbInstance = null;
          dbOpeningPromise = null;
          return attemptSave(true).then(resolve, reject);
        }
        return reject(err);
      }
      const store = transaction.objectStore('files');
      const request = store.put(file, mediaId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  };

  try {
    await attemptSave(false);
  } catch (err: any) {
    if (err.name === 'InvalidStateError') {
      console.warn('[projectPersistence] DB closing during file save, skipping:', mediaId);
      return;
    }
    throw err;
  }
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
 * Sanitizes tracks for storage by removing preview state and recursively handling compound clips.
 */
function sanitizeTracksForStorage(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      const sanitized: any = { ...clip, isPreview: false };
      if (sanitized.type === 'compound' && sanitized.nestedTimeline) {
        sanitized.nestedTimeline = {
          ...sanitized.nestedTimeline,
          tracks: sanitizeTracksForStorage(sanitized.nestedTimeline.tracks || [])
        };
      }
      
      // Preserve LUT table Float32Arrays explicitly if needed (IndexedDB handles them via structured clone, 
      // but if they were converted to objects by accident elsewhere, we fix them here)
      if (sanitized.filters) {
        sanitized.filters = sanitized.filters.map((f: any) => {
          if (f.type === 'lut' && f.lutData && f.lutData.table && !ArrayBuffer.isView(f.lutData.table)) {
             f.lutData = {
                ...f.lutData,
                table: new Float32Array(Object.values(f.lutData.table))
             };
          }
          return f;
        });
      }
      return sanitized;
    })
  }));
}

/**
 * Persists the entire project config (tracks metadata, media list, timeline) to a .procut FileSystemFileHandle.
 */
export async function saveProcutFile(fileHandle: FileSystemFileHandle, data: {
  targetProjectId?: string;
  projectName: string;
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  folders?: any[];
  subtitles?: any[];
  markers?: any[];
  beatMarkers?: any[];
  exportRegions?: ExportRegion[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  pipWindows?: Record<string, any>;
  sequences?: any[];
}): Promise<void> {
  const cleanMediaLibrary = data.mediaLibrary.map(item => ({
    ...item,
    url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
    thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
    frameStrip: item.frameStrip ? item.frameStrip.map(() => 'PENDING_RESTORE') : undefined,
    waveformPeaks: undefined,
  }));

  const cleanTracks = sanitizeTracksForStorage(data.tracks);

  const fileData: ProcutFileFormat = {
    version: '1.0',
    projectId: data.targetProjectId || 'default',
    projectName: data.projectName,
    currentTime: data.currentTime,
    aspectRatio: data.aspectRatio,
    tracks: cleanTracks,
    folders: data.folders,
    subtitles: data.subtitles,
    markers: data.markers,
    beatMarkers: data.beatMarkers,
    exportRegions: data.exportRegions,
    pipWindows: data.pipWindows,
    sequences: data.sequences,
    mediaLibrary: cleanMediaLibrary,
  };

  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(fileData, null, 2));
  await writable.close();
}

/**
 * Loads project metadata from a .procut FileSystemFileHandle.
 */
export async function loadProcutFile(fileHandle: FileSystemFileHandle): Promise<ProcutFileFormat> {
  const file = await fileHandle.getFile();
  const text = await file.text();
  const data = JSON.parse(text) as ProcutFileFormat;
  return data;
}

/**
 * Persists the entire project config to IndexedDB (now primarily for autosaves).
 */
export async function saveProjectToDB(data: {
  targetProjectId?: string;
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  folders?: any[];
  subtitles?: any[];
  markers?: any[];
  beatMarkers?: any[];
  exportRegions?: ExportRegion[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  pipWindows?: Record<string, any>;
  sequences?: any[];
  customFxList?: any[];
}): Promise<void> {
  // Auto-Save Protection
  if (data.targetProjectId && data.targetProjectId !== activeProjectId) {
    console.warn(`[projectPersistence] Skipping save: target project ${data.targetProjectId} is no longer active.`);
    return;
  }

  // Inner save logic — extracted so we can retry once on stale connection
  const attemptSave = async (isRetry: boolean): Promise<void> => {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction('project', 'readwrite');
      } catch (err: any) {
        if (err.name === 'InvalidStateError') {
          // DB connection is closing/closed — invalidate the cached instance
          dbInstance = null;
          dbOpeningPromise = null;
          if (!isRetry) {
            // Retry once with a fresh connection
            return attemptSave(true).then(resolve, reject);
          }
        }
        return reject(err);
      }
      const store = transaction.objectStore('project');

      // Remove any actual Blob URLs from the persistent metadata as they will be re-generated
      const cleanMediaLibrary = data.mediaLibrary.map(item => ({
        ...item,
        url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
        thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
        frameStrip: item.frameStrip ? item.frameStrip.map(() => 'PENDING_RESTORE') : undefined,
        waveformPeaks: undefined,
      }));

      const cleanTracks = sanitizeTracksForStorage(data.tracks);

      store.put(cleanTracks, 'tracks');
      store.put(cleanMediaLibrary, 'mediaLibrary');
      store.put(data.currentTime, 'currentTime');
      if (data.pipWindows) {
        store.put(data.pipWindows, 'pipWindows');
      }
      if (data.aspectRatio) {
        store.put(data.aspectRatio, 'aspectRatio');
      }
      if (data.folders) {
        store.put(data.folders, 'folders');
      }
      if (data.subtitles) {
        store.put(data.subtitles, 'subtitles');
      }
      if (data.markers) {
        store.put(data.markers, 'markers');
      }
      if (data.beatMarkers) {
        store.put(data.beatMarkers, 'beatMarkers');
      }
      if (data.exportRegions) {
        store.put(data.exportRegions, 'exportRegions');
      }
      if (data.sequences) {
        store.put(data.sequences, 'sequences');
      }
      if (data.customFxList) {
        // Strip thumbnails from storage if total size is too large
        const cleanFxList = data.customFxList.map((fx: any) => ({
          ...fx,
          thumbnail: (fx.thumbnail && fx.thumbnail.length > 50000) ? undefined : fx.thumbnail,
        }));
        store.put(cleanFxList, 'customFxList');
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => {
        const reason = transaction.error?.message || 'Transaction aborted';
        console.warn('[projectPersistence] Save transaction aborted:', reason);
        reject(new Error(`Project save failed: ${reason}`));
      };
    });
  };

  try {
    await attemptSave(false);
  } catch (error: any) {
    // InvalidStateError happens during app shutdown (DB connection closing) — treat as no-op
    if (error.name === 'InvalidStateError') {
      console.warn('[projectPersistence] DB connection closing, skipping save');
      return;
    }
    console.error('[projectPersistence] Failed to save project:', error);
    throw error;
  }
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
      registerBlobUrl(objectUrl);

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
  subtitles?: any[];
  markers?: any[];
  beatMarkers?: any[];
  exportRegions?: ExportRegion[];
  currentTime: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  pipWindows?: Record<string, any>;
  sequences?: any[];
  customFxList?: any[];
} | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction('project', 'readonly');
    } catch (e) {
      return reject(e);
    }
    const store = transaction.objectStore('project');
    const customFxListReq = store.get('customFxList');
    const keys = ['tracks', 'mediaLibrary', 'currentTime', 'aspectRatio', 'pipWindows', 'folders', 'subtitles', 'markers', 'beatMarkers', 'exportRegions', 'sequences'];
    let pending = keys.length;
    let hasError = false;
    const result: any = {};

    keys.forEach(key => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (hasError) return;
        result[key] = request.result;
        pending--;
        if (pending === 0) {
          if (!result.tracks || !result.mediaLibrary) {
            resolve(null);
          } else {
            restoreSnapshotMedia({
              tracks: result.tracks,
              mediaLibrary: result.mediaLibrary,
              currentTime: result.currentTime || 0,
              aspectRatio: result.aspectRatio || '16:9',
            }).then(restored => {
              const customFxList = customFxListReq.result || [];
              resolve({
                ...restored,
                pipWindows: result.pipWindows || {},
                folders: result.folders || [],
                subtitles: result.subtitles || [],
                markers: result.markers || [],
                beatMarkers: result.beatMarkers || [],
                exportRegions: result.exportRegions || [],
                sequences: result.sequences || [],
                customFxList,
              });
            }).catch(reject);
          }
        }
      };
      request.onerror = () => {
        hasError = true;
        reject(request.error);
      };
    });
  });
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
    waveformPeaks: undefined,
  }));

  const cleanTracks = sanitizeTracksForStorage(data.tracks);

  const snapshot = {
    tracks: cleanTracks,
    mediaLibrary: cleanMediaLibrary,
    currentTime: data.currentTime,
    aspectRatio: data.aspectRatio || '16:9',
    timestamp,
  };

  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction('autosaves', 'readwrite');
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        dbInstance = null;
      }
      return reject(err);
    }
    const store = transaction.objectStore('autosaves');
    store.put(snapshot, timestamp.toString());

    // Clean up old autosaves (keep only last 10)
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      const keys = keysReq.result as string[];
      if (keys.length > 10) {
        keys.sort((a, b) => Number(a) - Number(b));
        const numToDelete = keys.length - 10;
        for (let i = 0; i < numToDelete; i++) {
          store.delete(keys[i]);
        }
      }
    };

    transaction.oncomplete = () => resolve();
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
    // ANDROID FIX: detached/invisible video elements are never composited on
    // Chrome-Android, so onseeked/drawImage capture black frames there.
    attachInvisibleMediaElement(video);

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
      try {
        video.load();
      } catch (_) {}
      video.remove();
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
    // ANDROID FIX: keep element composited while decoding — see
    // utils/mediaPoolContainer.ts.
    attachInvisibleMediaElement(video);

    const frames: string[] = [];

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
      try {
        video.load();
      } catch (_) {}
      video.remove();
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
      waveformPeaks: undefined,
    })),
    tracks: sanitizeTracksForStorage(template.tracks)
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
      registerBlobUrl(objectUrl);

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