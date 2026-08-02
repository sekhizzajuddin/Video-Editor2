/**
 * aiBackground.ts
 *
 * AI background removal using @imgly/background-removal (ONNX, runs locally,
 * no CDN/CORS issues, supports images + video frames).
 *
 * Key fixes:
 * 1. No shared working canvases → no cross-clip mask bleed / race conditions.
 * 2. Mask validation with automatic inversion detection.
 * 3. Throttled scene-change detection (avoids playback hangs).
 * 4. Async segmentation only updates cache, never touches live canvas.
 * 5. Proper cleanup hooks for clip deletion / effect toggle.
 */

import {
  detectSceneChange,
  shouldUseCachedMask,
  getCachedMaskCanvas,
  cacheMaskCanvas,
  markInferencePerformed,
  mustForceResegment,
  invalidateMaskCache,
  resetClipDetectionState,
  resetAllDetectionState,
  shouldDetectSceneChange,
} from './humanDetection';

import * as ortModule from 'onnxruntime-web';

// Polyfill onnxruntime-web ESM interop so @imgly's (await import("onnxruntime-web")).default works cleanly
if (typeof window !== 'undefined') {
  const ortObj: any = (ortModule as any).default || ortModule;
  if (ortObj && !ortObj.default) {
    try {
      ortObj.default = ortObj;
    } catch (e) {}
  }
  (window as any).ort = ortObj;
}

// Lazy-loaded so the 5MB+ model only downloads when the feature is enabled
let bgRemovalModule: typeof import('@imgly/background-removal') | null = null;
let loadPromise: Promise<void> | null = null;
let isLoaded = false;
const segmentingInFlight = new Set<string>();

const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

// Pre-allocated canvases per clip for blur / edge processing only
const alphaCanvasPool = new Map<string, HTMLCanvasElement>();

function getAlphaCanvas(clipId: string, width: number, height: number): HTMLCanvasElement {
  let canvas = alphaCanvasPool.get(clipId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    alphaCanvasPool.set(clipId, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

/**
 * Preload the @imgly/background-removal model. Safe to call multiple times.
 */
export const loadBackgroundRemover = (): Promise<void> => {
  if (isLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      bgRemovalModule = await import('@imgly/background-removal');
      const preloadFn = bgRemovalModule.preload ?? (bgRemovalModule as any).default?.preload;
      if (preloadFn) {
        await preloadFn({
          model: 'isnet_fp16',
          publicPath: PUBLIC_PATH,
          proxyToWorker: true,
        });
      }
      isLoaded = true;
    } catch (err) {
      console.error('[aiBackground] Failed to load @imgly/background-removal:', err);
      loadPromise = null; // Allow retry
      throw err;
    }
  })();
  return loadPromise;
};

/**
 * Run inference on an image/video frame. Returns an HTMLCanvasElement
 * containing the subject with a transparent background at the source's
 * natural resolution.
 * Uses a unique canvas per call (no shared state → no races).
 */
async function segmentSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  model: 'isnet' | 'isnet_fp16' = 'isnet_fp16'
): Promise<HTMLCanvasElement | null> {
  if (!bgRemovalModule) {
    await loadBackgroundRemover();
  }
  if (!bgRemovalModule || !isLoaded) return null;

  try {
    const removeBgFn = bgRemovalModule.removeBackground ?? (bgRemovalModule as any).default?.removeBackground;
    if (!removeBgFn) throw new Error('@imgly/background-removal: removeBackground function not found');

    // Prepare input canvas at target resolution
    const inputCanvas = document.createElement('canvas');
    inputCanvas.width = targetWidth;
    inputCanvas.height = targetHeight;
    const tempInCtx = inputCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempInCtx) return null;
    tempInCtx.clearRect(0, 0, targetWidth, targetHeight);
    tempInCtx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const inputBlob = await new Promise<Blob | null>((resolve) => {
      inputCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          inputCanvas.toBlob(resolve, 'image/png');
        }
      }, 'image/webp', 0.85);
    });
    if (!inputBlob) return null;

    const blob = await removeBgFn(inputBlob, {
      model,
      publicPath: PUBLIC_PATH,
      proxyToWorker: true,
      output: { format: 'image/png', quality: 0.9 },
    });

    // Decode the blob into an ImageBitmap, then draw to a unique canvas.
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();
    return canvas;
  } catch (err) {
    console.error('[aiBackground] segmentSource error:', err);
    return null;
  }
}

/**
 * Validate that the mask has the correct polarity (subject opaque, background transparent).
 * If the mask appears inverted (more transparent than opaque), invert it in-place.
 * This handles edge cases where the model or encoding produces reversed alpha.
 */
function ensureCorrectMaskPolarity(maskCanvas: HTMLCanvasElement): void {
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imageData.data;
  let opaquePixels = 0;
  let transparentPixels = 0;
  // Sample every 4th pixel for speed
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 128) opaquePixels++;
    else transparentPixels++;
  }
  if (transparentPixels > opaquePixels * 2) {
    // Mask appears inverted (background opaque, subject transparent) → invert alpha
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255 - data[i];
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

/**
 * Public API: apply AI background removal to a canvas context.
 * During playback: applies CACHED mask synchronously, triggers async re-segmentation in background.
 * When paused/exporting: awaits fresh segmentation if no valid cache exists.
 */
export async function applyAiBackgroundMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  edgeBlur: number = 0,
  modelSelection: 0 | 1 = 0,
  playbackQuality: 'full' | 'balanced' | 'performance' = 'balanced',
  isPlaying: boolean = false,
  clipId: string = '_default'
) {
  try {
    // STEP 1: Try to get a usable cached mask
    let maskCanvas = getCachedMaskCanvas(clipId, width, height);

    // STEP 2: Decide whether to trigger background re-segmentation
    if (isPlaying) {
      // Throttled scene-change detection (runs ~once every 12 frames max)
      const sceneChanged = shouldDetectSceneChange(clipId, 12)
        ? detectSceneChange(clipId, sourceElement)
        : false;

      const needsUpdate = !shouldUseCachedMask(clipId, playbackQuality) ||
                          mustForceResegment(clipId, playbackQuality) ||
                          sceneChanged;

      if (needsUpdate && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);
        // Capture frame snapshot to avoid stale sourceElement during async processing
        const inferenceCanvas = document.createElement('canvas');
        inferenceCanvas.width = width;
        inferenceCanvas.height = height;
        const inferCtx = inferenceCanvas.getContext('2d');
        if (inferCtx) {
          inferCtx.drawImage(sourceElement, 0, 0, width, height);
        }

        // Fast fp16 model during live playing
        segmentSource(inferenceCanvas, width, height, 'isnet_fp16')
          .then((result) => {
            if (result) {
              ensureCorrectMaskPolarity(result);
              markInferencePerformed(clipId);
              cacheMaskCanvas(clipId, result);
            }
          })
          .catch(() => {})
          .finally(() => {
            segmentingInFlight.delete(clipId);
          });
      }
    } else if (!maskCanvas) {
      // Paused / exporting: block until fresh segmentation completes
      const model = modelSelection === 0 ? 'isnet' : 'isnet_fp16';
      const result = await segmentSource(sourceElement, width, height, model);
      if (result) {
        ensureCorrectMaskPolarity(result);
        maskCanvas = result;
        markInferencePerformed(clipId);
        cacheMaskCanvas(clipId, maskCanvas);
      }
    }

    // STEP 3: Apply mask SYNCHRONOUSLY (using cache if available)
    if (!maskCanvas) return;

    if (edgeBlur > 0) {
      const blurredCanvas = getAlphaCanvas(`${clipId}_blur`, width, height);
      const bCtx = blurredCanvas.getContext('2d');
      if (bCtx) {
        bCtx.clearRect(0, 0, width, height);
        bCtx.filter = `blur(${edgeBlur}px)`;
        bCtx.drawImage(maskCanvas, 0, 0, width, height);
        bCtx.filter = 'none';
      }
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(blurredCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
  } catch (err) {
    console.error('[aiBackground] applyAiBackgroundMask error:', err);
  }
}

/**
 * Extract the alpha mask from a frame and render a glowing neon outline
 * of the subject over the target canvas.
 */
export async function applySubjectNeonOutlineFlash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  options: {
    color?: string;
    strokeWidth?: number;
    glowBlur?: number;
    flashSpeed?: number;
    currentTime?: number;
    clipId?: string;
    isPlaying?: boolean;
  } = {}
) {
  try {
    const clipId = options.clipId || '_neon_default';
    const isPlaying = options.isPlaying || false;
    let maskCanvas = getCachedMaskCanvas(clipId, width, height);
    
    if (isPlaying) {
      const needsUpdate = !maskCanvas || mustForceResegment(clipId, 'balanced');
      if (needsUpdate && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);
        const infCanvas = document.createElement('canvas');
        infCanvas.width = width;
        infCanvas.height = height;
        const infCtx = infCanvas.getContext('2d');
        if (infCtx) infCtx.drawImage(sourceElement, 0, 0, width, height);
        segmentSource(infCanvas, width, height, 'isnet_fp16')
          .then((result) => {
            if (result) {
              ensureCorrectMaskPolarity(result);
              markInferencePerformed(clipId);
              cacheMaskCanvas(clipId, result);
            }
          })
          .catch(() => {})
          .finally(() => { segmentingInFlight.delete(clipId); });
      }
    } else if (!maskCanvas) {
      const result = await segmentSource(sourceElement, width, height, 'isnet_fp16');
      if (result) {
        ensureCorrectMaskPolarity(result);
        markInferencePerformed(clipId);
        cacheMaskCanvas(clipId, result);
        maskCanvas = result;
      }
    }

    if (!maskCanvas) return;

    const edgeCanvas = getAlphaCanvas(`${clipId}_edge`, width, height);
    const eCtx = edgeCanvas.getContext('2d');
    if (!eCtx) return;
    const strokeW = options.strokeWidth || 3;
    eCtx.clearRect(0, 0, width, height);
    eCtx.drawImage(maskCanvas, 0, 0, width, height);
    eCtx.globalCompositeOperation = 'difference';
    eCtx.drawImage(maskCanvas, strokeW, 0, width, height);
    eCtx.drawImage(maskCanvas, -strokeW, 0, width, height);
    eCtx.drawImage(maskCanvas, 0, strokeW, width, height);
    eCtx.drawImage(maskCanvas, 0, -strokeW, width, height);
    eCtx.globalCompositeOperation = 'source-over';

    const time = options.currentTime || (performance.now() / 1000);
    const speed = options.flashSpeed || 8;
    const strobeWave = Math.sin(time * Math.PI * 2 * speed);
    if (strobeWave < -0.3) return;

    const alpha = Math.max(0.3, (strobeWave + 1) / 2);
    const outlineColor = options.color || '#00f0ff';
    eCtx.globalCompositeOperation = 'source-in';
    eCtx.fillStyle = outlineColor;
    eCtx.fillRect(0, 0, width, height);
    eCtx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = options.glowBlur || 14;
    ctx.shadowColor = outlineColor;
    ctx.drawImage(edgeCanvas, 0, 0, width, height);
    ctx.restore();
  } catch (err) {
    console.error('[aiBackground] applySubjectNeonOutlineFlash error:', err);
  }
}

/**
 * Clean up per-clip canvas pools and cache state.
 * Must be called when a clip with AI background is deleted, or the effect is disabled.
 */
export function cleanupAiBackgroundResources(): void {
  alphaCanvasPool.clear();
  invalidateMaskCache();
}

export function cleanupClipBackgroundState(clipId: string): void {
  // Clean up all pooled canvases for this clip
  for (const key of alphaCanvasPool.keys()) {
    if (key.startsWith(clipId)) {
      alphaCanvasPool.delete(key);
    }
  }
  resetClipDetectionState(clipId);
}

export function cleanupAllBackgroundState(): void {
  alphaCanvasPool.clear();
  resetAllDetectionState();
}

export const cleanupAllAIResources = cleanupAllBackgroundState;

export {
  detectSceneChange,
  shouldUseCachedMask,
  markInferencePerformed,
  mustForceResegment,
  invalidateMaskCache,
  resetClipDetectionState,
  resetAllDetectionState,
};