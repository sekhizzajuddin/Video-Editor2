/**
 * frameExtractor.ts — Extract video frame thumbnails for timeline rendering.
 *
 * Uses HTMLVideoElement + Canvas to seek and capture frames at
 * evenly-spaced intervals. Includes a memory cache per media ID.
 */

import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';

// Cache: mediaId -> array of data URL frames
const frameCache = new Map<string, string[]>();

/**
 * Extract `count` evenly-spaced frame thumbnails from a video.
 * Results are cached by mediaId.
 *
 * @param mediaId   Unique media identifier for caching
 * @param videoUrl  Object URL (or any URL) of the video
 * @param duration  Duration in seconds
 * @param count     Number of frames to extract (default 12)
 * @param height    Frame thumbnail height in pixels (default 48)
 * @returns         Array of data URLs (image/jpeg)
 */
export async function extractFrames(
  mediaId: string,
  videoUrl: string,
  duration: number,
  count = 12,
  height = 48
): Promise<string[]> {
  // Return cached result if available
  const cached = frameCache.get(mediaId);
  if (cached && cached.length >= count) return cached;

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  // ANDROID FIX: keep the element composited while decoding (see
  // utils/mediaPoolContainer.ts) — detached/invisible videos can capture black
  // frames on Chrome-Android.
  attachInvisibleMediaElement(video);

  try {
    // Wait for the video to be ready
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(`Video load timeout: ${videoUrl}`)), 5000);
      video.onloadeddata = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load video: ${videoUrl}`));
      };
      video.src = videoUrl;
    });

    const actualDuration = isFinite(video.duration) ? video.duration : duration;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return [];

    const aspect = w / h;
    const frameWidth = Math.round(height * aspect);
    const frameHeight = height;

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d')!;

    const frames: string[] = [];

    for (let i = 0; i < count; i++) {
      const seekTime = (i / Math.max(1, count - 1)) * Math.max(0, actualDuration - 0.1);

      await new Promise<void>((resolve) => {
        video.currentTime = seekTime;
        let fallbackTimeout: any;
          const onSeeked = () => {
            clearTimeout(fallbackTimeout);
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          // Timeout fallback for frames that don't trigger seeked
          fallbackTimeout = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }, 1000);
      });

      ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
      frames.push(canvas.toDataURL('image/jpeg', 0.5));
    }

    // Cache the result
    frameCache.set(mediaId, frames);
    return frames;
  } finally {
    // Cleanup
    video.src = '';
    video.load();
    video.remove();
  }
}

/**
 * Get cached frames for a media ID (returns undefined if not cached).
 */
export function getCachedFrames(mediaId: string): string[] | undefined {
  return frameCache.get(mediaId);
}

/**
 * Clear the frame cache for a specific media ID or all.
 */
export function clearFrameCache(mediaId?: string): void {
  if (mediaId) {
    frameCache.delete(mediaId);
  } else {
    frameCache.clear();
  }
}

export async function extractFramesFromVideo(
  videoUrl: string,
  intervalSeconds: number,
  startTime: number,
  endTime: number,
  height = 48
): Promise<string[]> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  // ANDROID FIX: keep the element composited while decoding (see
  // utils/mediaPoolContainer.ts) — detached/invisible videos can capture black
  // frames on Chrome-Android.
  attachInvisibleMediaElement(video);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(`Video load timeout: ${videoUrl}`)), 5000);
      video.onloadeddata = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load video: ${videoUrl}`));
      };
      video.src = videoUrl;
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return [];

    const aspect = w / h;
    const frameWidth = Math.round(height * aspect);
    const frameHeight = height;

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d')!;

    const frames: string[] = [];
    const duration = endTime - startTime;
    const count = Math.max(1, Math.floor(duration / intervalSeconds));

    for (let i = 0; i < count; i++) {
      const seekTime = startTime + i * intervalSeconds;
      if (seekTime > video.duration) break;

      await new Promise<void>((resolve) => {
        video.currentTime = seekTime;
        let fallbackTimeout: any;
        const onSeeked = () => {
          clearTimeout(fallbackTimeout);
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        fallbackTimeout = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }, 1000);
      });

      ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
      frames.push(canvas.toDataURL('image/jpeg', 0.5));
    }

    return frames;
  } finally {
    video.src = '';
    video.load();
    video.remove();
  }
}
