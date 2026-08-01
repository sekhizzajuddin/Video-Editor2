/**
 * aiBackground.ts
 *
 * AI background removal using @imgly/background-removal (ONNX, runs locally,
 * no CDN/CORS issues, supports images + video frames).
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
let isSegmentingInFlight = false;

const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

// Pre-allocated canvases per clip to avoid GC pressure
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

    // @imgly/background-removal strictly requires a Blob, URL, string, or NdArray.
    // Passing HTMLCanvasElement, HTMLVideoElement, or HTMLImageElement directly causes
    // "TypeError: undefined is not iterable (cannot read property Symbol(Symbol.iterator))" on e.shape.
    let inputCanvas: HTMLCanvasElement;
    if (source instanceof HTMLCanvasElement && source.width === targetWidth && source.height === targetHeight) {
      inputCanvas = source;
    } else {
      inputCanvas = getAlphaCanvas('_temp_convert_input', targetWidth, targetHeight);
      const tempInCtx = inputCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempInCtx) return null;
      tempInCtx.clearRect(0, 0, targetWidth, targetHeight);
      tempInCtx.drawImage(source, 0, 0, targetWidth, targetHeight);
    }

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

    // Decode the blob back into an ImageBitmap for fast compositing.
    const bitmap = await createImageBitmap(blob);
    const canvas = getAlphaCanvas('_temp_segment', targetWidth, targetHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return null;
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
 * Public API: apply AI background removal to a canvas context.
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
    let maskCanvas: HTMLCanvasElement | null = getCachedMaskCanvas(clipId, width, height);
    const model: 'isnet' | 'isnet_fp16' = modelSelection === 0 ? 'isnet' : 'isnet_fp16';

    if (isPlaying) {
      // During video playback: return cached mask immediately for 60fps smoothness,
      // and trigger async background segmentation via Web Worker without stalling UI.
      const needsUpdate = !shouldUseCachedMask(clipId, playbackQuality) ||
                          mustForceResegment(clipId, playbackQuality) ||
                          detectSceneChange(clipId, sourceElement);

      if (needsUpdate && !isSegmentingInFlight) {
        isSegmentingInFlight = true;
        // Use fast fp16 model during live playing to avoid overloading worker
        segmentSource(sourceElement, width, height, 'isnet_fp16')
          .then((result) => {
            if (result) {
              markInferencePerformed(clipId);
              cacheMaskCanvas(clipId, result);
            }
          })
          .catch(() => {})
          .finally(() => {
            isSegmentingInFlight = false;
          });
      }
    } else if (!maskCanvas) {
      // When paused or initial frame: await full segmentation if no mask cached
      const result = await segmentSource(sourceElement, width, height, model);
      if (result) {
        maskCanvas = result;
        markInferencePerformed(clipId);
        cacheMaskCanvas(clipId, maskCanvas);
      }
    }

    if (!maskCanvas) return;

    // Apply the alpha mask to the target context using destination-in.
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
  } = {}
) {
  try {
    const clipId = options.clipId || '_neon_default';
    const model: 'isnet' | 'isnet_fp16' = 'isnet_fp16';
    const result = await segmentSource(sourceElement, width, height, model);
    if (!result) return;

    const maskCanvas = getAlphaCanvas(clipId, width, height);
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;
    mCtx.clearRect(0, 0, width, height);
    mCtx.drawImage(result, 0, 0, width, height);

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
 */
export function cleanupAiBackgroundResources(): void {
  alphaCanvasPool.clear();
  invalidateMaskCache();
}

export function cleanupClipBackgroundState(clipId: string): void {
  const maskCanvas = alphaCanvasPool.get(clipId);
  if (maskCanvas) {
    alphaCanvasPool.delete(clipId);
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
