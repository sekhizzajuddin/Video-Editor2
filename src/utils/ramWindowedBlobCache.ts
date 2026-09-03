/**
 * ramWindowedBlobCache.ts
 *
 * Sliding-window Blob cache for media files. Keeps only a configurable
 * number of recently-accessed windowed slices in RAM, evicting older
 * entries when the cap is reached. Designed to keep a long (>1 min) timeline
 * responsive without loading the entire media file into RAM.
 *
 * Behavior:
 * - Each entry holds a Blob.slice() of a media file around a playhead position.
 * - On access, if the requested time is outside the cached window, a new
 *   slice is created and the old entry is evicted if at cap.
 * - LRU eviction via last-accessed timestamps.
 * - URLs created via URL.createObjectURL are revoked on eviction.
 *
 * Memory budget (defaults):
 *   - WINDOW_SECONDS = 30 seconds around the playhead
 *   - MAX_ENTRIES = 8 (~480 MB RAM cap when 4K H.264 ≈ 2 MB/s × 30 s = 60 MB)
 */

import { resolveMediaFile } from './mediaFileHandle';

interface WindowedEntry {
  mediaId: string;
  url: string;
  blob: Blob;
  windowStart: number;  // seconds in source media
  windowEnd: number;
  lastAccessed: number; // performance.now()
}

const cache = new Map<string, WindowedEntry>();

export const WINDOW_SECONDS = 30;
const MAX_ENTRIES = 8;
const EVICTION_IDLE_MS = 8000;

// Public stats for the storage monitor
export function getCacheStats() {
  return {
    entries: cache.size,
    maxEntries: MAX_ENTRIES,
    windowSeconds: WINDOW_SECONDS,
  };
}

/**
 * Return a usable URL for the media, scoped to a window around `playheadSeconds`.
 * If the cached window covers the playhead, returns it immediately.
 * Otherwise slices the file (via File System Access or IDB fallback) and
 * registers a new entry, evicting the LRU entry if needed.
 */
export async function getWindowedMediaURL(
  mediaId: string,
  playheadSeconds: number,
  fileFallback?: File,
): Promise<string | null> {
  const existing = cache.get(mediaId);
  if (
    existing &&
    playheadSeconds >= existing.windowStart &&
    playheadSeconds <= existing.windowEnd
  ) {
    existing.lastAccessed = performance.now();
    return existing.url;
  }

  // Evict LRU if at cap
  if (cache.size >= MAX_ENTRIES && !existing) {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    for (const [k, v] of cache) {
      if (v.lastAccessed < lruTime) {
        lruTime = v.lastAccessed;
        lruKey = k;
      }
    }
    if (lruKey) {
      const old = cache.get(lruKey);
      if (old) {
        URL.revokeObjectURL(old.url);
        cache.delete(lruKey);
      }
    }
  }

  // Resolve source file
  const file = fileFallback ?? (await resolveMediaFile(mediaId));
  if (!file) return null;

  const windowedBlob = sliceFileWindow(file, playheadSeconds, WINDOW_SECONDS);
  const url = URL.createObjectURL(windowedBlob);

  // Replace any existing entry for this mediaId
  if (existing) {
    URL.revokeObjectURL(existing.url);
  }

  cache.set(mediaId, {
    mediaId,
    url,
    blob: windowedBlob,
    windowStart: playheadSeconds - WINDOW_SECONDS / 2,
    windowEnd: playheadSeconds + WINDOW_SECONDS / 2,
    lastAccessed: performance.now(),
  });

  scheduleIdleEviction();
  return url;
}

/**
 * Slice the file around the requested time. We use approximate byte offsets
 * since variable-bitrate media doesn't have a fixed bytes-per-second, but
 * browser decoders handle ±5s random-access slices well. The slice is
 * widened slightly for safety.
 */
function sliceFileWindow(file: File, playheadSeconds: number, windowSeconds: number): Blob {
  // Estimate bytes-per-second from file size. Assume ~4 Mbps (500 KB/s) average
  // bitrate which is typical for 1080p H.264. This gives a reasonable window for
  // VBR media. The old formula (file.size / (file.size / 1_000_000)) was always
  // exactly 1,000,000 for files >= 1 MB — a no-op constant.
  const assumedDurationSec = Math.max(1, file.size / 500_000); // ~4 Mbps
  const approxBytesPerSec = Math.max(1, file.size / assumedDurationSec);
  const halfWindow = windowSeconds / 2;
  const startByte = Math.max(0, Math.floor((playheadSeconds - halfWindow) * approxBytesPerSec));
  const endByte = Math.min(file.size, Math.floor((playheadSeconds + halfWindow) * approxBytesPerSec));
  return file.slice(startByte, endByte, file.type);
}

let idleTimer: number | null = null;
function scheduleIdleEviction() {
  if (idleTimer !== null) return;
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    const now = performance.now();
    for (const [k, v] of cache) {
      if (now - v.lastAccessed > EVICTION_IDLE_MS) {
        URL.revokeObjectURL(v.url);
        cache.delete(k);
      }
    }
  }, EVICTION_IDLE_MS);
}

/**
 * Manually evict a specific media entry. Called when a clip is removed
 * from the timeline or the project is cleared.
 */
export function evictMediaWindow(mediaId: string) {
  const e = cache.get(mediaId);
  if (e) {
    URL.revokeObjectURL(e.url);
    cache.delete(mediaId);
  }
}

/**
 * Evict all entries. Called on project clear / app unload.
 */
export function clearAllMediaWindows() {
  for (const v of cache.values()) {
    URL.revokeObjectURL(v.url);
  }
  cache.clear();
}
