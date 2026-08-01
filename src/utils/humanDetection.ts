/**
 * humanDetection.ts
 *
 * Lightweight human-presence heuristics + temporal mask caching for the AI
 * background-removal pipeline.
 *
 * Provides:
 *   1. Skin-tone detection in YCbCr space — fast pre-check to skip ML
 *      inference when no human is in frame.
 *   2. Scene-change detection via luminance histogram chi-squared distance —
 *      avoids redundant inference on stable frames.
 *   3. Temporal mask caching — re-uses the alpha mask across frames. Masks
 *      are cached at SOURCE resolution (full canvas) so re-compositing gives
 *      crisp edges without up-scaling artifacts.
 *   4. Downscaled inference support — inference runs on a small canvas for
 *      speed, but the cached mask is re-drawn at full resolution before
 *      compositing.
 *
 * All state is isolated per-clip via clipId to prevent mask bleed across
 * multiple clips/tracks.
 */

interface ClipDetectionState {
  // Temporal mask cache — kept at the LAST USED resolution, not downscaled.
  cachedMask: HTMLCanvasElement | null;
  cachedMaskTimestamp: number;
  cachedMaskFrameCount: number;

  // Monotonic counter — forces re-segmentation after N frames even if
  // scene-change detection says "stable".
  monotoneFramesSinceInference: number;

  // Scene change detection
  previousHistogram: Uint32Array | null;
}

const clipStates = new Map<string, ClipDetectionState>();

function getClipState(clipId: string): ClipDetectionState {
  let state = clipStates.get(clipId);
  if (!state) {
    state = {
      cachedMask: null,
      cachedMaskTimestamp: 0,
      cachedMaskFrameCount: 0,
      monotoneFramesSinceInference: 0,
      previousHistogram: null,
    };
    clipStates.set(clipId, state);
  }
  return state;
}

// Re-segment every Nth frame in playback for performance.
const BALANCED_CACHE_FRAMES = 12;
const PERFORMANCE_CACHE_FRAMES = 24;

// Hard ceiling: force re-segmentation regardless of scene stability.
const BALANCED_MAX_STALE_FRAMES = 30;
const PERFORMANCE_MAX_STALE_FRAMES = 60;

// ─── Temporal Mask Cache ────────────────────────────────────────────────────

export function getCachedMaskCanvas(
  clipId: string,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const state = getClipState(clipId);
  if (!state.cachedMask) return null;
  // If the cached mask resolution differs from the requested one, upscale it
  // onto a new canvas at the requested resolution so the caller gets exactly
  // what it needs. This prevents halo artifacts when re-compositing.
  if (state.cachedMask.width !== width || state.cachedMask.height !== height) {
    const upscaled = document.createElement('canvas');
    upscaled.width = width;
    upscaled.height = height;
    const ctx = upscaled.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.cachedMask, 0, 0, width, height);
    // Replace the cache with the new resolution so future reads are O(1)
    // upscaled.dispose?.(); // canvas has no dispose
    state.cachedMask = upscaled;
  }
  return state.cachedMask;
}

export function cacheMaskCanvas(clipId: string, mask: HTMLCanvasElement | null): void {
  const state = getClipState(clipId);
  state.cachedMask = mask;
  state.cachedMaskTimestamp = performance.now();
  state.cachedMaskFrameCount = 0;
  // NOTE: monotoneFramesSinceInference is reset only by markInferencePerformed()
  // — setCachedMask may be called from non-inference paths (cache reuse) and
  // must not reset the ceiling counter.
}

export function markInferencePerformed(clipId: string): void {
  const state = getClipState(clipId);
  state.monotoneFramesSinceInference = 0;
}

export function shouldUseCachedMask(
  clipId: string,
  playbackQuality: 'full' | 'balanced' | 'performance'
): boolean {
  const state = getClipState(clipId);
  if (!state.cachedMask) return false;
  if (playbackQuality === 'full') return false;

  state.cachedMaskFrameCount++;
  state.monotoneFramesSinceInference++;

  const maxFrames = playbackQuality === 'performance'
    ? PERFORMANCE_CACHE_FRAMES
    : BALANCED_CACHE_FRAMES;
  return state.cachedMaskFrameCount < maxFrames;
}

export function mustForceResegment(
  clipId: string,
  playbackQuality: 'full' | 'balanced' | 'performance'
): boolean {
  if (playbackQuality === 'full') return true;
  const state = getClipState(clipId);
  const maxStale = playbackQuality === 'performance'
    ? PERFORMANCE_MAX_STALE_FRAMES
    : BALANCED_MAX_STALE_FRAMES;
  return state.monotoneFramesSinceInference >= maxStale;
}

export function invalidateMaskCache(clipId?: string): void {
  if (clipId) {
    const state = clipStates.get(clipId);
    if (state) {
      state.cachedMask = null;
      state.cachedMaskTimestamp = 0;
      state.cachedMaskFrameCount = 0;
      state.monotoneFramesSinceInference = 0;
    }
  } else {
    for (const state of clipStates.values()) {
      state.cachedMask = null;
      state.cachedMaskTimestamp = 0;
      state.cachedMaskFrameCount = 0;
      state.monotoneFramesSinceInference = 0;
    }
  }
}

// Backward-compatible ImageBitmap cache aliases (legacy callers may still use these)
export function getCachedMask(clipId: string): HTMLCanvasElement | null {
  return getClipState(clipId).cachedMask;
}
export function setCachedMask(
  clipId: string,
  mask: HTMLCanvasElement | null
): void {
  cacheMaskCanvas(clipId, mask);
}

// ─── Scene Change Detection ─────────────────────────────────────────────────

let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;
const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 36;

function ensureSampleCanvas(): CanvasRenderingContext2D | null {
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_WIDTH;
    sampleCanvas.height = SAMPLE_HEIGHT;
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return sampleCtx;
}

function computeLuminanceHistogram(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap
): Uint32Array {
  const ctx = ensureSampleCanvas();
  if (!ctx) return new Uint32Array(16);
  ctx.drawImage(source, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const data = imageData.data;
  const histogram = new Uint32Array(16);
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const bin = Math.min(15, (lum / 256) * 16 | 0);
    histogram[bin]++;
  }
  return histogram;
}

export function detectSceneChange(
  clipId: string,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  threshold: number = 0.15
): boolean {
  const state = getClipState(clipId);
  const currentHistogram = computeLuminanceHistogram(source);
  if (!state.previousHistogram) {
    state.previousHistogram = currentHistogram;
    return true;
  }
  let chiSq = 0;
  const totalPixels = SAMPLE_WIDTH * SAMPLE_HEIGHT;
  for (let i = 0; i < 16; i++) {
    const expected = state.previousHistogram[i];
    const observed = currentHistogram[i];
    if (expected + observed > 0) {
      chiSq += ((observed - expected) ** 2) / (expected + observed);
    }
  }
  const normalizedDist = chiSq / totalPixels;
  state.previousHistogram = currentHistogram;
  return normalizedDist > threshold;
}

// ─── Skin-Tone Detection (Human Presence Heuristic) ─────────────────────────

interface DetectionResult {
  hasHuman: boolean;
  /** Bounding box of the most skin-dense region (0..1 normalized). */
  bbox?: { x: number; y: number; w: number; h: number };
  /** Total skin pixel ratio (0..1) — useful for debugging. */
  skinRatio: number;
}

/**
 * Fast heuristic to detect whether a human is likely present in the frame
 * by analyzing skin-tone pixel density in YCbCr color space, with a grid-based
 * bounding-box estimate to localize the human region.
 *
 * This runs in < 1ms on a 64x36 downscaled sample. The result is used to:
 *   1. Skip expensive ML inference when no human is visible
 *   2. Constrain ML inference to a small region around the human (faster + more
 *      accurate than running on the whole frame).
 *
 * YCbCr skin-tone ranges covering Fitzpatrick types I–VI:
 *   - Cb: 70–135  (widened from 77–127 for dark skin)
 *   - Cr: 125–180 (widened from 133–173 for dark skin)
 *
 * @returns DetectionResult — hasHuman, optional bbox, skinRatio.
 */
export function detectHumanPresence(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  minSkinRatio: number = 0.012
): DetectionResult {
  const ctx = ensureSampleCanvas();
  if (!ctx) return { hasHuman: true, skinRatio: 0 }; // Fail open

  ctx.drawImage(source, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const data = imageData.data;

  let skinPixels = 0;
  const totalPixels = SAMPLE_WIDTH * SAMPLE_HEIGHT;

  // Grid-based bbox: divide the sample into a 4×4 grid, find the densest cell
  // with skin, then expand to neighboring cells with skin pixels. This gives
  // a rough but useful bbox that constrains ML inference to the human region.
  const GRID = 4;
  const cellW = SAMPLE_WIDTH / GRID;
  const cellH = SAMPLE_HEIGHT / GRID;
  const cellSkin = new Uint32Array(GRID * GRID);

  for (let y = 0; y < SAMPLE_HEIGHT; y++) {
    for (let x = 0; x < SAMPLE_WIDTH; x++) {
      const i = (y * SAMPLE_WIDTH + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
      const cr = 0.500 * r - 0.419 * g - 0.081 * b + 128;

      // Skin tone: Cb in [70, 135], Cr in [125, 180]
      if (cb >= 70 && cb <= 135 && cr >= 125 && cr <= 180) {
        skinPixels++;
        const gx = Math.min(GRID - 1, Math.floor(x / cellW));
        const gy = Math.min(GRID - 1, Math.floor(y / cellH));
        cellSkin[gy * GRID + gx]++;
      }
    }
  }

  const skinRatio = skinPixels / totalPixels;
  if (skinRatio < minSkinRatio) {
    return { hasHuman: false, skinRatio };
  }

  // Find the densest grid cell, expand bbox to all cells with >5% skin density.
  let maxCell = 0;
  let maxCellIdx = 0;
  for (let i = 0; i < cellSkin.length; i++) {
    if (cellSkin[i] > maxCell) {
      maxCell = cellSkin[i];
      maxCellIdx = i;
    }
  }
  const threshold = Math.max(2, maxCell * 0.2);
  let minX = GRID, minY = GRID, maxX = -1, maxY = -1;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (cellSkin[gy * GRID + gx] >= threshold) {
        if (gx < minX) minX = gx;
        if (gy < minY) minY = gy;
        if (gx > maxX) maxX = gx;
        if (gy > maxY) maxY = gy;
      }
    }
  }
  if (maxX < 0) maxX = maxCellIdx % GRID;
  if (minX > maxX) minX = maxX;

  return {
    hasHuman: true,
    skinRatio,
    bbox: {
      x: minX / GRID,
      y: minY / GRID,
      w: (maxX - minX + 1) / GRID,
      h: (maxY - minY + 1) / GRID,
    },
  };
}

// ─── Downscaled Inference Support ───────────────────────────────────────────

let downscaleCanvas: HTMLCanvasElement | null = null;

export function downscaleForInference(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  scale: number = 0.5
): HTMLCanvasElement {
  const sourceWidth = 'videoWidth' in source
    ? (source as HTMLVideoElement).videoWidth
    : 'naturalWidth' in source
      ? (source as HTMLImageElement).naturalWidth
      : source.width;
  const sourceHeight = 'videoHeight' in source
    ? (source as HTMLVideoElement).videoHeight
    : 'naturalHeight' in source
      ? (source as HTMLImageElement).naturalHeight
      : source.height;

  let targetW = Math.round(sourceWidth * scale);
  let targetH = Math.round(sourceHeight * scale);

  const minPixels = 14400;
  const currentPixels = targetW * targetH;
  if (currentPixels < minPixels && currentPixels > 0) {
    const upscaleFactor = Math.sqrt(minPixels / currentPixels);
    targetW = Math.round(targetW * upscaleFactor);
    targetH = Math.round(targetH * upscaleFactor);
  }
  targetW = Math.max(16, targetW);
  targetH = Math.max(16, targetH);

  if (!downscaleCanvas) {
    downscaleCanvas = document.createElement('canvas');
  }
  if (downscaleCanvas.width !== targetW || downscaleCanvas.height !== targetH) {
    downscaleCanvas.width = targetW;
    downscaleCanvas.height = targetH;
  }
  const ctx = downscaleCanvas.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0, targetW, targetH);
  return downscaleCanvas;
}

// ─── Reset ──────────────────────────────────────────────────────────────────

export function resetClipDetectionState(clipId: string): void {
  clipStates.delete(clipId);
}

export function resetAllDetectionState(): void {
  clipStates.clear();
}

// Legacy alias
export function resetHumanDetectionState(): void {
  resetAllDetectionState();
}
