/**
 * humanDetection.ts
 * 
 * Lightweight, high-performance human presence detection and temporal mask caching
 * module for optimizing AI background removal and object removal during video playback.
 * 
 * This module provides:
 * 1. Fast skin-tone detection using YCbCr color space to determine if a human is likely in frame
 * 2. Scene change detection via luminance histogram comparison to avoid redundant ML inference
 * 3. Temporal mask caching to reuse valid segmentation masks across similar frames
 * 4. Downscaled inference support to reduce MediaPipe processing time during playback
 * 
 * All state is isolated per-clip via clipId keys to prevent mask bleed across
 * multiple clips/tracks in picture-in-picture or multi-track compositions.
 * 
 * Connected to:
 * - aiBackground.ts: Provides pre-check and optimization layer before MediaPipe inference
 * - objectRemoval.ts: Provides scene-change detection for temporal inpaint caching
 * - CanvasRenderingEngine.ts: Indirectly optimizes rendering pipeline throughput
 */

// ─── Per-Clip State Isolation ───────────────────────────────────────────────
// All detection state is keyed by clipId to prevent mask bleed when multiple
// clips have AI background or object removal enabled simultaneously.

interface ClipDetectionState {
  // Temporal mask cache
  cachedMask: ImageBitmap | HTMLCanvasElement | null;
  cachedMaskTimestamp: number;
  cachedMaskFrameCount: number;
  
  // Monotonic frame counter — forces re-segmentation after N frames even if
  // scene-change detection says "stable". This breaks the infinite cache-hit
  // loop where setCachedMask reset cachedMaskFrameCount to 0 forever.
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

// How many frames a cached mask can be reused before forcing a re-segment
const BALANCED_CACHE_FRAMES = 3;   // Re-segment every 3rd frame
const PERFORMANCE_CACHE_FRAMES = 6; // Re-segment every 6th frame

// Maximum frames before forcing re-segmentation regardless of scene stability.
// This is the hard ceiling that breaks the infinite cache-reuse loop.
const BALANCED_MAX_STALE_FRAMES = 9;    // Force re-segment at most every 9 frames
const PERFORMANCE_MAX_STALE_FRAMES = 18; // Force re-segment at most every 18 frames

// ─── Temporal Mask Cache (Per-Clip) ─────────────────────────────────────────

/**
 * Returns the currently cached segmentation mask for a clip, or null if no cache exists.
 */
export function getCachedMask(clipId: string): ImageBitmap | HTMLCanvasElement | null {
  return getClipState(clipId).cachedMask;
}

/**
 * Stores a new segmentation mask in the temporal cache for a clip.
 * Properly disposes of previous ImageBitmap to prevent GPU memory leaks.
 */
export function setCachedMask(clipId: string, mask: ImageBitmap | HTMLCanvasElement | null): void {
  const state = getClipState(clipId);
  
  // Dispose previous ImageBitmap to prevent GPU memory leak
  if (state.cachedMask && state.cachedMask !== mask && 'close' in state.cachedMask) {
    try {
      (state.cachedMask as ImageBitmap).close();
    } catch { /* already closed */ }
  }
  
  state.cachedMask = mask;
  state.cachedMaskTimestamp = performance.now();
  state.cachedMaskFrameCount = 0;
  // NOTE: Do NOT reset monotoneFramesSinceInference here — that counter
  // is only reset when actual ML inference runs (in aiBackground.ts).
}

/**
 * Marks that actual ML inference was performed for this clip.
 * Resets the monotonic stale-frame counter.
 */
export function markInferencePerformed(clipId: string): void {
  const state = getClipState(clipId);
  state.monotoneFramesSinceInference = 0;
}

/**
 * Increments the frame counter for the cached mask and returns whether
 * the cache is still valid for the given playback quality mode.
 * 
 * @returns true if cached mask should be reused (skip inference), false if re-segmentation needed
 */
export function shouldUseCachedMask(
  clipId: string,
  playbackQuality: 'full' | 'balanced' | 'performance'
): boolean {
  const state = getClipState(clipId);
  
  if (!state.cachedMask) return false;
  if (playbackQuality === 'full') return false; // Always re-segment in full quality

  state.cachedMaskFrameCount++;
  state.monotoneFramesSinceInference++;

  const maxFrames = playbackQuality === 'performance'
    ? PERFORMANCE_CACHE_FRAMES
    : BALANCED_CACHE_FRAMES;

  return state.cachedMaskFrameCount < maxFrames;
}

/**
 * Checks if the monotonic stale-frame counter has exceeded the hard ceiling,
 * meaning we MUST force a re-segmentation regardless of scene stability.
 */
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

/**
 * Invalidates the temporal mask cache for a clip (e.g., on scene change).
 * Properly disposes of ImageBitmap to prevent GPU memory leaks.
 */
export function invalidateMaskCache(clipId: string): void {
  const state = getClipState(clipId);
  
  // Dispose ImageBitmap before clearing reference
  if (state.cachedMask && 'close' in state.cachedMask) {
    try {
      (state.cachedMask as ImageBitmap).close();
    } catch { /* already closed */ }
  }
  
  state.cachedMask = null;
  state.cachedMaskTimestamp = 0;
  state.cachedMaskFrameCount = 0;
  state.monotoneFramesSinceInference = 0;
}

// ─── Scene Change Detection (Per-Clip) ──────────────────────────────────────

// Shared canvas for histogram/skin-tone sampling (tiny resolution)
let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;
const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 36; // 16:9 aspect

function ensureSampleCanvas(): CanvasRenderingContext2D | null {
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_WIDTH;
    sampleCanvas.height = SAMPLE_HEIGHT;
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return sampleCtx;
}

/**
 * Computes a simplified luminance histogram (16 bins) from a tiny downscaled snapshot.
 * Used for fast scene change detection between frames.
 */
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
    // ITU-R BT.601 luminance
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const bin = Math.min(15, (lum / 256) * 16 | 0);
    histogram[bin]++;
  }

  return histogram;
}

/**
 * Detects whether a significant scene change has occurred between the current
 * frame and the previously analyzed frame for a specific clip, using luminance
 * histogram chi-squared distance.
 * 
 * @returns true if the scene has changed significantly (should re-segment)
 */
export function detectSceneChange(
  clipId: string,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  threshold: number = 0.15
): boolean {
  const state = getClipState(clipId);
  const currentHistogram = computeLuminanceHistogram(source);

  if (!state.previousHistogram) {
    state.previousHistogram = currentHistogram;
    return true; // First frame — always process
  }

  // Chi-squared distance between histograms
  let chiSq = 0;
  const totalPixels = SAMPLE_WIDTH * SAMPLE_HEIGHT;
  for (let i = 0; i < 16; i++) {
    const expected = state.previousHistogram[i];
    const observed = currentHistogram[i];
    if (expected + observed > 0) {
      chiSq += ((observed - expected) ** 2) / (expected + observed);
    }
  }

  // Normalize by total pixel count
  const normalizedDist = chiSq / totalPixels;

  state.previousHistogram = currentHistogram;

  return normalizedDist > threshold;
}

// ─── Skin-Tone Detection (Human Presence Heuristic) ─────────────────────────

/**
 * Fast heuristic to detect whether a human is likely present in the frame
 * by analyzing skin-tone pixel density in YCbCr color space.
 * 
 * This runs in < 1ms on a 64x36 downscaled sample and can be used to
 * skip expensive MediaPipe inference entirely when no human is visible.
 * 
 * YCbCr skin-tone ranges (widened to cover Fitzpatrick types I–VI):
 * - Cb: 70–135  (widened from 77–127 to reduce dark skin false negatives)
 * - Cr: 125–180 (widened from 133–173 to reduce dark skin false negatives)
 * 
 * @returns true if human presence is likely (>1.5% skin-tone pixels detected)
 */
export function detectHumanPresence(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  minSkinRatio: number = 0.015
): boolean {
  const ctx = ensureSampleCanvas();
  if (!ctx) return true; // Fail open — assume human present if we can't check

  ctx.drawImage(source, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const data = imageData.data;

  let skinPixels = 0;
  const totalPixels = SAMPLE_WIDTH * SAMPLE_HEIGHT;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Convert RGB to YCbCr
    // Y  =  0.299R + 0.587G + 0.114B
    // Cb = -0.169R - 0.331G + 0.500B + 128
    // Cr =  0.500R - 0.419G - 0.081B + 128
    const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
    const cr = 0.500 * r - 0.419 * g - 0.081 * b + 128;

    // Widened skin-tone detection thresholds covering Fitzpatrick types I-VI
    if (cb >= 70 && cb <= 135 && cr >= 125 && cr <= 180) {
      skinPixels++;
    }
  }

  return (skinPixels / totalPixels) >= minSkinRatio;
}

// ─── Downscaled Inference Support ───────────────────────────────────────────
let downscaleCanvas: HTMLCanvasElement | null = null;

/**
 * Creates a downscaled version of the source element for faster
 * MediaPipe inference during playback. The resulting canvas can be passed
 * to segmentFrame() instead of the full-resolution source.
 * 
 * Maintains aspect ratio correctly by applying the same scale factor to
 * both dimensions, with a minimum total pixel count floor to prevent
 * excessively tiny canvases.
 * 
 * @param scale - Downscale factor (0.5 = half resolution, default for balanced mode)
 * @returns A downscaled canvas element for inference
 */
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

  // Apply uniform scale to maintain aspect ratio
  let targetW = Math.round(sourceWidth * scale);
  let targetH = Math.round(sourceHeight * scale);
  
  // Ensure minimum pixel count (14400 = ~120x120 equivalent) without distorting aspect ratio
  const minPixels = 14400;
  const currentPixels = targetW * targetH;
  if (currentPixels < minPixels && currentPixels > 0) {
    const upscaleFactor = Math.sqrt(minPixels / currentPixels);
    targetW = Math.round(targetW * upscaleFactor);
    targetH = Math.round(targetH * upscaleFactor);
  }
  
  // Absolute minimums to prevent zero-dimension canvases
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
  if (ctx) {
    ctx.drawImage(source, 0, 0, targetW, targetH);
  }

  return downscaleCanvas;
}

/**
 * Resets all internal state for a specific clip. Call when the user disables
 * the feature or when switching clips to prevent stale mask bleed.
 */
export function resetClipDetectionState(clipId: string): void {
  const state = clipStates.get(clipId);
  if (state) {
    // Dispose ImageBitmap before clearing
    if (state.cachedMask && 'close' in state.cachedMask) {
      try {
        (state.cachedMask as ImageBitmap).close();
      } catch { /* already closed */ }
    }
    clipStates.delete(clipId);
  }
}

/**
 * Resets ALL clip detection states. Call on project unload or full cleanup.
 */
export function resetAllDetectionState(): void {
  for (const [clipId] of clipStates) {
    resetClipDetectionState(clipId);
  }
  clipStates.clear();
}

// Legacy alias for backward compatibility (resets all state)
export function resetHumanDetectionState(): void {
  resetAllDetectionState();
}
