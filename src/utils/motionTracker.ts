import { CornerPoints } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { getFrameSize, getClipFramePlacement } from './frameSpace';

interface Point {
  x: number;
  y: number;
}

// Helper to extract a grayscale patch from a canvas context
function getGrayscalePatch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): Float32Array {
  const half = Math.floor(size / 2);
  const startX = Math.round(cx - half);
  const startY = Math.round(cy - half);

  try {
    const imgData = ctx.getImageData(startX, startY, size, size);
    const data = imgData.data;
    const patch = new Float32Array(size * size);
    for (let i = 0; i < patch.length; i++) {
      const idx = i * 4;
      // Standard grayscale conversion: 0.299R + 0.587G + 0.114B
      patch[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    return patch;
  } catch (e) {
    // Return empty if out of bounds
    return new Float32Array(size * size);
  }
}

// Find the best match position of a template patch in a search region
function matchTemplate(
  videoCtx: CanvasRenderingContext2D,
  template: Float32Array,
  tempSize: number,
  lastX: number,
  lastY: number,
  searchRadius: number
): Point {
  const halfTemp = Math.floor(tempSize / 2);
  const bestPoint = { x: lastX, y: lastY };
  let minSSD = Infinity;

  // Search window dimensions
  const searchSize = tempSize + searchRadius * 2;
  const halfSearch = Math.floor(searchSize / 2);
  const searchStartX = Math.round(lastX - halfSearch);
  const searchStartY = Math.round(lastY - halfSearch);

  let searchData: Uint8ClampedArray;
  try {
    const imgData = videoCtx.getImageData(searchStartX, searchStartY, searchSize, searchSize);
    searchData = imgData.data;
  } catch (e) {
    return bestPoint;
  }

  // Grayscale search window
  const searchGray = new Float32Array(searchSize * searchSize);
  for (let i = 0; i < searchGray.length; i++) {
    const idx = i * 4;
    searchGray[i] = 0.299 * searchData[idx] + 0.587 * searchData[idx + 1] + 0.114 * searchData[idx + 2];
  }

  // Slide template across search region
  for (let dy = 0; dy <= searchRadius * 2; dy++) {
    for (let dx = 0; dx <= searchRadius * 2; dx++) {
      let ssd = 0;
      for (let ty = 0; ty < tempSize; ty++) {
        for (let tx = 0; tx < tempSize; tx++) {
          const tVal = template[ty * tempSize + tx];
          const sVal = searchGray[(dy + ty) * searchSize + (dx + tx)];
          const diff = tVal - sVal;
          ssd += diff * diff;
        }
      }

      if (ssd < minSSD) {
        minSSD = ssd;
        bestPoint.x = searchStartX + dx + halfTemp;
        bestPoint.y = searchStartY + dy + halfTemp;
      }
    }
  }

  return bestPoint;
}

export interface TrackProgressCallback {
  (progress: number, currentCorners: CornerPoints): void;
}

/**
 * Tracks a quadrilateral area frame-by-frame across a video timeline.
 */
export async function trackMotion(
  videoEl: HTMLVideoElement,
  startTime: number,
  duration: number,
  initialCorners: CornerPoints,
  onProgress?: TrackProgressCallback,
  /**
   * The clip's transform, so the analysis reproduces where the media actually
   * appears in the frame. Omitted = assume an untransformed, frame-filling clip
   * (the historical behaviour).
   */
  clipTransform?: { x?: number; y?: number; scale?: number } | null
): Promise<{ time: number; corners: CornerPoints }[]> {
  const fps = 15; // Track at 15 frames per second for high performance and accuracy
  const frameInterval = 1 / fps;
  const numSteps = Math.ceil(duration / frameInterval);

  // Setup offscreen canvas in FRAME space (the visible picture), so tracked
  // coordinates are directly comparable with the region box the user drew.
  const store = useEditorStore.getState();
  const aspectRatio = store.aspectRatio || '16:9';
  const { W, H } = getFrameSize(aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Where the clip's media actually sits inside the frame.
  //
  // Previously the video was blitted edge-to-edge across the frame canvas
  // (`drawImage(videoEl, 0, 0, W, H)`), which silently assumed the clip filled
  // the frame exactly with no transform. On a portrait project showing a
  // landscape video — or on any clip that has been scaled or panned — the
  // analysed picture was stretched and shifted relative to what the user sees,
  // so the template lifted from "under the box" was a different part of the
  // image and the track followed the wrong thing.
  const placement = getClipFramePlacement(
    videoEl.videoWidth || 1920,
    videoEl.videoHeight || 1080,
    W,
    H,
    clipTransform
  );

  const paintFrame = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(videoEl, placement.x, placement.y, placement.w, placement.h);
  };

  const seekVideo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          videoEl.removeEventListener('seeked', onSeeked);
          try {
            paintFrame();
          } catch (e) {}
          resolve();
        }
      }, 500);

      const onSeeked = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          videoEl.removeEventListener('seeked', onSeeked);
          try {
            paintFrame();
          } catch (e) {}
          resolve();
        }
      };

      if (Math.abs(videoEl.currentTime - time) < 0.001) {
        resolved = true;
        clearTimeout(timeoutId);
        try {
          paintFrame();
        } catch (e) {}
        resolve();
        return;
      }

      videoEl.addEventListener('seeked', onSeeked);
      videoEl.currentTime = time;
    });
  };

  const results: { time: number; corners: CornerPoints }[] = [];
  const currentCorners = { ...initialCorners };

  // Save original video playhead time to restore it later
  const originalTime = videoEl.currentTime;
  const originalPaused = videoEl.paused;

  // Initialize templates for the 4 corners
  const tempSize = 25; // 25x25 template patch
  const searchRadius = 15; // Scan 15px in all directions

  // Step 1: Seek to start frame
  await seekVideo(startTime);

  const templates = [
    getGrayscalePatch(ctx, currentCorners.x0, currentCorners.y0, tempSize),
    getGrayscalePatch(ctx, currentCorners.x1, currentCorners.y1, tempSize),
    getGrayscalePatch(ctx, currentCorners.x2, currentCorners.y2, tempSize),
    getGrayscalePatch(ctx, currentCorners.x3, currentCorners.y3, tempSize)
  ];

  results.push({ time: 0, corners: { ...currentCorners } });

  // Step 2: Track frame-by-frame
  for (let step = 1; step <= numSteps; step++) {
    const relativeTime = step * frameInterval;
    const targetTime = startTime + relativeTime;

    if (targetTime > videoEl.duration) break;

    await seekVideo(targetTime);

    // Track each corner point independently
    const pt0 = matchTemplate(ctx, templates[0], tempSize, currentCorners.x0, currentCorners.y0, searchRadius);
    const pt1 = matchTemplate(ctx, templates[1], tempSize, currentCorners.x1, currentCorners.y1, searchRadius);
    const pt2 = matchTemplate(ctx, templates[2], tempSize, currentCorners.x2, currentCorners.y2, searchRadius);
    const pt3 = matchTemplate(ctx, templates[3], tempSize, currentCorners.x3, currentCorners.y3, searchRadius);

    // Update coordinates
    currentCorners.x0 = pt0.x; currentCorners.y0 = pt0.y;
    currentCorners.x1 = pt1.x; currentCorners.y1 = pt1.y;
    currentCorners.x2 = pt2.x; currentCorners.y2 = pt2.y;
    currentCorners.x3 = pt3.x; currentCorners.y3 = pt3.y;

    // Optional update of template patches (10% learning rate to adapt slowly)
    const updateTemplate = (tpl: Float32Array, cx: number, cy: number) => {
      const newPatch = getGrayscalePatch(ctx, cx, cy, tempSize);
      for (let i = 0; i < tpl.length; i++) {
        tpl[i] = tpl[i] * 0.9 + newPatch[i] * 0.1;
      }
    };
    updateTemplate(templates[0], currentCorners.x0, currentCorners.y0);
    updateTemplate(templates[1], currentCorners.x1, currentCorners.y1);
    updateTemplate(templates[2], currentCorners.x2, currentCorners.y2);
    updateTemplate(templates[3], currentCorners.x3, currentCorners.y3);

    results.push({
      time: relativeTime,
      corners: { ...currentCorners }
    });

    if (onProgress) {
      onProgress(step / numSteps, { ...currentCorners });
    }
  }

  // Restore original playhead time
  videoEl.currentTime = originalTime;
  if (!originalPaused) {
    videoEl.play().catch(() => {});
  }

  return results;
}
