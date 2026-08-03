/**
 * humanDetection.ts
 *
 * Lightweight human-presence heuristics + temporal mask caching for the AI
 * background-removal pipeline.
 *
 * Improvements:
 *   - Thread-safe per-call sampling (no global canvas)
 *   - Temporal bbox smoothing (EMA) to prevent jitter
 *   - Dual skin-tone check (YCbCr + HSV) for better accuracy under colored lighting
 *   - ROI crop helper with aspect-ratio preservation
 */

interface ClipDetectionState {
  cachedMask: HTMLCanvasElement | null;
  rescaledMask: HTMLCanvasElement | null;
  cachedMaskTimestamp: number;
  cachedMaskFrameCount: number;
  monotoneFramesSinceInference: number;
  previousHistogram: Uint32Array | null;
  sceneCheckCounter: number;

  // Temporal smoothing for human bbox
  smoothedBbox: { x: number; y: number; w: number; h: number } | null;
  bboxAlpha: number; // EMA factor
  lastDetectedFrame: number;
  consecutiveEmptyFrames: number;
}

const clipStates = new Map<string, ClipDetectionState>();

function getClipState(clipId: string): ClipDetectionState {
  let state = clipStates.get(clipId);
  if (!state) {
    state = {
      cachedMask: null,
      rescaledMask: null,
      cachedMaskTimestamp: 0,
      cachedMaskFrameCount: 0,
      monotoneFramesSinceInference: 0,
      previousHistogram: null,
      sceneCheckCounter: 0,
      smoothedBbox: null,
      bboxAlpha: 0.3,
      lastDetectedFrame: 0,
      consecutiveEmptyFrames: 0,
    };
    clipStates.set(clipId, state);
  }
  return state;
}

const BALANCED_CACHE_FRAMES = 3;
const PERFORMANCE_CACHE_FRAMES = 5;
const BALANCED_MAX_STALE_FRAMES = 8;
const PERFORMANCE_MAX_STALE_FRAMES = 15;

// ─── Temporal Mask Cache ────────────────────────────────────────────────────

export function getCachedMaskCanvas(
  clipId: string,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const state = getClipState(clipId);
  if (!state.cachedMask) return null;
  if (state.cachedMask.width !== width || state.cachedMask.height !== height) {
    if (!state.rescaledMask) {
      state.rescaledMask = document.createElement('canvas');
    }
    const rescaled = state.rescaledMask;
    if (rescaled.width !== width || rescaled.height !== height) {
      rescaled.width = width;
      rescaled.height = height;
    }
    const ctx = rescaled.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(state.cachedMask, 0, 0, width, height);
    return rescaled;
  }
  return state.cachedMask;
}

export function cacheMaskCanvas(clipId: string, mask: HTMLCanvasElement | null): void {
  const state = getClipState(clipId);
  state.cachedMask = mask;
  state.rescaledMask = null;
  state.cachedMaskTimestamp = performance.now();
  state.cachedMaskFrameCount = 0;
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

export function peekCachedMaskValid(
  clipId: string,
  playbackQuality: 'full' | 'balanced' | 'performance'
): boolean {
  const state = getClipState(clipId);
  if (!state.cachedMask) return false;
  if (playbackQuality === 'full') return false;
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
      state.rescaledMask = null;
      state.cachedMaskTimestamp = 0;
      state.cachedMaskFrameCount = 0;
      state.monotoneFramesSinceInference = 0;
      state.smoothedBbox = null;
    }
  } else {
    for (const state of clipStates.values()) {
      state.cachedMask = null;
      state.rescaledMask = null;
      state.cachedMaskTimestamp = 0;
      state.cachedMaskFrameCount = 0;
      state.monotoneFramesSinceInference = 0;
      state.smoothedBbox = null;
    }
  }
}

export function getCachedMask(clipId: string): HTMLCanvasElement | null {
  return getClipState(clipId).cachedMask;
}
export function setCachedMask(clipId: string, mask: HTMLCanvasElement | null): void {
  cacheMaskCanvas(clipId, mask);
}

// ─── Scene Change Detection ─────────────────────────────────────────────────

function createSampleCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas, ctx };
}

function computeLuminanceHistogram(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  sampleW: number = 64,
  sampleH: number = 36
): Uint32Array {
  const { ctx } = createSampleCanvas(sampleW, sampleH);
  ctx.drawImage(source as CanvasImageSource, 0, 0, sampleW, sampleH);
  const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
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
  const totalPixels = 64 * 36;
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

export function shouldDetectSceneChange(clipId: string, everyNFrames: number = 12): boolean {
  const state = getClipState(clipId);
  state.sceneCheckCounter = (state.sceneCheckCounter || 0) + 1;
  if (state.sceneCheckCounter >= everyNFrames) {
    state.sceneCheckCounter = 0;
    return true;
  }
  return false;
}

// ─── Skin-Tone Detection (Human Presence Heuristic) ─────────────────────────

export interface DetectionResult {
  hasHuman: boolean;
  bbox?: { x: number; y: number; w: number; h: number };
  skinRatio: number;
}

/**
 * Detect human presence using dual skin-tone detection.
 * Thread-safe: creates its own canvas internally.
 */
export function detectHumanPresence(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  clipId: string,
  minSkinRatio: number = 0.008
): DetectionResult {
  const SAMPLE_WIDTH = 64;
  const SAMPLE_HEIGHT = 36;
  const { ctx } = createSampleCanvas(SAMPLE_WIDTH, SAMPLE_HEIGHT);

  ctx.drawImage(source as CanvasImageSource, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const data = imageData.data;

  let skinPixels = 0;
  const totalPixels = SAMPLE_WIDTH * SAMPLE_HEIGHT;
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

      // YCbCr skin tone (Fitzpatrick I–VI, wider range for dark skin)
      const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
      const cr = 0.500 * r - 0.419 * g - 0.081 * b + 128;
      const ycbcrSkin = cb >= 65 && cb <= 140 && cr >= 120 && cr <= 185;

      // HSV fallback for colored lighting (blue/green stage lights)
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const delta = maxC - minC;
      let h = 0;
      if (delta !== 0) {
        if (maxC === r) h = ((g - b) / delta) % 6;
        else if (maxC === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      const s = maxC === 0 ? 0 : (delta / maxC) * 100;
      const v = (maxC / 255) * 100;
      const hsvSkin = ((h >= 0 && h <= 50) || h >= 340) && s >= 15 && s <= 80 && v >= 25 && v <= 95;

      if (ycbcrSkin || hsvSkin) {
        skinPixels++;
        const gx = Math.min(GRID - 1, Math.floor(x / cellW));
        const gy = Math.min(GRID - 1, Math.floor(y / cellH));
        cellSkin[gy * GRID + gx]++;
      }
    }
  }

  const skinRatio = skinPixels / totalPixels;
  const state = getClipState(clipId);

  if (skinRatio < minSkinRatio) {
    state.consecutiveEmptyFrames++;
    // Only declare "no human" after 2 consecutive empty frames (prevents flicker)
    if (state.consecutiveEmptyFrames >= 2) {
      state.smoothedBbox = null;
      return { hasHuman: false, skinRatio };
    }
    // Return last known bbox briefly to prevent pop-in/pop-out
    return { hasHuman: true, skinRatio, bbox: state.smoothedBbox || undefined };
  }

  state.consecutiveEmptyFrames = 0;

  // Compute raw bbox from grid
  let maxCell = 0, maxCellIdx = 0;
  for (let i = 0; i < cellSkin.length; i++) {
    if (cellSkin[i] > maxCell) { maxCell = cellSkin[i]; maxCellIdx = i; }
  }
  const threshold = Math.max(2, maxCell * 0.15);
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
  if (maxX < 0) { maxX = maxCellIdx % GRID; minX = maxX; }
  if (minY > maxY) { maxY = minY; }

  const rawBbox = {
    x: minX / GRID,
    y: minY / GRID,
    w: (maxX - minX + 1) / GRID,
    h: (maxY - minY + 1) / GRID,
  };

  // Temporal smoothing: EMA on bbox coordinates
  if (state.smoothedBbox) {
    const a = state.bboxAlpha;
    state.smoothedBbox = {
      x: state.smoothedBbox.x * (1 - a) + rawBbox.x * a,
      y: state.smoothedBbox.y * (1 - a) + rawBbox.y * a,
      w: state.smoothedBbox.w * (1 - a) + rawBbox.w * a,
      h: state.smoothedBbox.h * (1 - a) + rawBbox.h * a,
    };
  } else {
    state.smoothedBbox = rawBbox;
  }

  return { hasHuman: true, skinRatio, bbox: state.smoothedBbox };
}

// ─── ROI Crop Helper ────────────────────────────────────────────────────────

/**
 * Compute a padded, aspect-ratio-preserving crop region from a human bbox.
 * This is used to send only the human region to the segmentation model,
 * dramatically improving effective resolution and accuracy.
 *
 * @param sourceW - Full frame width
 * @param sourceH - Full frame height
 * @param bbox - Normalized bbox from detectHumanPresence
 * @param padding - Extra context around the human (0.15 = 15% of bbox size)
 * @param targetAspect - Force aspect ratio (e.g., 16/9 for landscape model). Null = freeform.
 */
export function computeROICrop(
  sourceW: number,
  sourceH: number,
  bbox: { x: number; y: number; w: number; h: number },
  padding: number = 0.2,
  targetAspect: number | null = null
): { sx: number; sy: number; sw: number; sh: number } {
  // Add padding
  let cx = bbox.x - padding * bbox.w;
  let cy = bbox.y - padding * bbox.h;
  let cw = bbox.w * (1 + 2 * padding);
  let ch = bbox.h * (1 + 2 * padding);

  // Clamp to frame
  cx = Math.max(0, cx);
  cy = Math.max(0, cy);
  cw = Math.min(1 - cx, cw);
  ch = Math.min(1 - cy, ch);

  // Preserve target aspect ratio (e.g., 16:9 for MediaPipe landscape)
  if (targetAspect !== null) {
    const currentAspect = (cw * sourceW) / (ch * sourceH);
    if (currentAspect > targetAspect) {
      // Too wide: increase height
      const newH = (cw * sourceW) / (targetAspect * sourceH);
      cy = Math.max(0, cy - (newH - ch) / 2);
      ch = Math.min(1 - cy, newH);
    } else if (currentAspect < targetAspect) {
      // Too tall: increase width
      const newW = (ch * sourceH * targetAspect) / sourceW;
      cx = Math.max(0, cx - (newW - cw) / 2);
      cw = Math.min(1 - cx, newW);
    }
  }

  return {
    sx: Math.round(cx * sourceW),
    sy: Math.round(cy * sourceH),
    sw: Math.round(cw * sourceW),
    sh: Math.round(ch * sourceH),
  };
}

// ─── Downscaled Inference Support ───────────────────────────────────────────

export function downscaleForInference(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  scale: number = 0.5
): HTMLCanvasElement {
  let sourceWidth: number, sourceHeight: number;

  if ('videoWidth' in source && (source as HTMLVideoElement).videoWidth) {
    sourceWidth = (source as HTMLVideoElement).videoWidth;
    sourceHeight = (source as HTMLVideoElement).videoHeight;
  } else if ('naturalWidth' in source && (source as HTMLImageElement).naturalWidth) {
    sourceWidth = (source as HTMLImageElement).naturalWidth;
    sourceHeight = (source as HTMLImageElement).naturalHeight;
  } else if ('width' in source && typeof (source as any).width === 'number') {
    sourceWidth = (source as any).width;
    sourceHeight = (source as any).height;
  } else {
    sourceWidth = 640;
    sourceHeight = 360;
  }

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

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);
  return canvas;
}

// ─── Reset ──────────────────────────────────────────────────────────────────

export function resetClipDetectionState(clipId: string): void {
  clipStates.delete(clipId);
}

export function resetAllDetectionState(): void {
  clipStates.clear();
}

export function resetHumanDetectionState(): void {
  resetAllDetectionState();
}
