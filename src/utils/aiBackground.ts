/**
 * aiBackground.ts
 *
 * Simple, high-performance AI background removal using @imgly/background-removal
 * (ONNX, runs locally via Web Workers, zero CORS/CDN issues).
 *
 * Key Design & Simplifications (Disconnected from humanDetection.ts):
 * 1. ZERO Main-Thread Pixel Diffing: Completely disconnected from humanDetection/scene diffing to prevent playhead freezes or CPU stalls.
 * 2. Asynchronous Worker Polling During Playback: When video is playing, cached masks render immediately (<1ms) while new masks update asynchronously in background workers based on clean time interval throttling.
 * 3. Exact Timestamp Matching on Pause/Export: When paused or rendering exports, masks are precisely generated for the exact video frame timestamp.
 * 4. Dedicated Per-Clip Working Canvases: Eliminates cross-clip mask bleed and race conditions.
 */

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

interface SimpleMaskCache {
  maskCanvas: HTMLCanvasElement;
  lastUpdateTimestamp: number; // performance.now() at time of inference
  lastVideoTime: number;       // video.currentTime if applicable, else -1
}

// Simple, decoupled caching structure
const maskCacheMap = new Map<string, SimpleMaskCache>();
const segmentingInFlight = new Set<string>();

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

// Lazy-loaded so the model only downloads when the feature is enabled
let bgRemovalModule: typeof import('@imgly/background-removal') | null = null;
let loadPromise: Promise<void> | null = null;
let isLoaded = false;

const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

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
 * containing the subject with a transparent background at the source's resolution.
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
 */
function ensureCorrectMaskPolarity(maskCanvas: HTMLCanvasElement): void {
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imageData.data;
  let opaquePixels = 0;
  let transparentPixels = 0;
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 128) opaquePixels++;
    else transparentPixels++;
  }
  if (transparentPixels > opaquePixels * 2) {
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255 - data[i];
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

/**
 * Helper to get the video currentTime if sourceElement is a video
 */
function getVideoCurrentTime(sourceElement: any): number {
  if (sourceElement && 'currentTime' in sourceElement && typeof sourceElement.currentTime === 'number') {
    return sourceElement.currentTime;
  }
  return -1;
}

/**
 * Public API: apply AI background removal to a canvas context.
 * During playback: applies CACHED mask synchronously in <1ms, triggering lightweight async re-segmentation at scheduled intervals.
 * When paused/exporting: ensures exact timestamp accuracy by awaiting fresh segmentation when video timestamp changes.
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
    const currentVideoTime = getVideoCurrentTime(sourceElement);
    let cached = maskCacheMap.get(clipId);
    let maskCanvas: HTMLCanvasElement | null = null;

    // Validate cached mask resolution
    if (cached) {
      if (cached.maskCanvas.width === width && cached.maskCanvas.height === height) {
        maskCanvas = cached.maskCanvas;
      } else {
        maskCacheMap.delete(clipId);
        cached = undefined;
      }
    }

    // Determine update interval based on playback quality settings
    const updateIntervalMs = playbackQuality === 'performance' ? 450 : playbackQuality === 'full' ? 120 : 250;

    if (isPlaying) {
      // During live video playback: check if cached mask needs refreshing in the background worker
      const shouldAsyncRefresh = !maskCanvas || (performance.now() - (cached?.lastUpdateTimestamp || 0) > updateIntervalMs);

      if (shouldAsyncRefresh && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);
        // Capture a frame snapshot so the background worker doesn't read a changing video element
        const inferenceCanvas = document.createElement('canvas');
        inferenceCanvas.width = width;
        inferenceCanvas.height = height;
        const inferCtx = inferenceCanvas.getContext('2d');
        if (inferCtx) {
          inferCtx.drawImage(sourceElement, 0, 0, width, height);
        }

        segmentSource(inferenceCanvas, width, height, 'isnet_fp16')
          .then((result) => {
            if (result) {
              ensureCorrectMaskPolarity(result);
              maskCacheMap.set(clipId, {
                maskCanvas: result,
                lastUpdateTimestamp: performance.now(),
                lastVideoTime: getVideoCurrentTime(sourceElement),
              });
            }
          })
          .catch(() => {})
          .finally(() => {
            segmentingInFlight.delete(clipId);
          });
      }
      // Never block playback; immediately draw existing cached mask if available
    } else {
      // When paused on timeline OR rendering exports: ensure exact timestamp precision
      const timeMoved = currentVideoTime >= 0 && Math.abs(currentVideoTime - (cached?.lastVideoTime ?? -1)) > 0.04;

      if (!maskCanvas || timeMoved) {
        const model = modelSelection === 0 ? 'isnet' : 'isnet_fp16';
        const result = await segmentSource(sourceElement, width, height, model);
        if (result) {
          ensureCorrectMaskPolarity(result);
          maskCanvas = result;
          maskCacheMap.set(clipId, {
            maskCanvas: result,
            lastUpdateTimestamp: performance.now(),
            lastVideoTime: currentVideoTime,
          });
        }
      }
    }

    if (!maskCanvas) return;

    // Synchronous GPU compositor rendering
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
 * Extract the alpha mask from a frame and render a glowing neon outline of the subject.
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
    const currentVideoTime = getVideoCurrentTime(sourceElement);
    
    let cached = maskCacheMap.get(clipId);
    let maskCanvas = cached && cached.maskCanvas.width === width && cached.maskCanvas.height === height
      ? cached.maskCanvas
      : null;
    
    if (isPlaying) {
      const shouldAsyncRefresh = !maskCanvas || (performance.now() - (cached?.lastUpdateTimestamp || 0) > 250);
      if (shouldAsyncRefresh && !segmentingInFlight.has(clipId)) {
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
              maskCacheMap.set(clipId, {
                maskCanvas: result,
                lastUpdateTimestamp: performance.now(),
                lastVideoTime: getVideoCurrentTime(sourceElement),
              });
            }
          })
          .catch(() => {})
          .finally(() => { segmentingInFlight.delete(clipId); });
      }
    } else {
      const timeMoved = currentVideoTime >= 0 && Math.abs(currentVideoTime - (cached?.lastVideoTime ?? -1)) > 0.04;
      if (!maskCanvas || timeMoved) {
        const result = await segmentSource(sourceElement, width, height, 'isnet_fp16');
        if (result) {
          ensureCorrectMaskPolarity(result);
          maskCanvas = result;
          maskCacheMap.set(clipId, {
            maskCanvas: result,
            lastUpdateTimestamp: performance.now(),
            lastVideoTime: currentVideoTime,
          });
        }
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
 * Resource cleanup hooks when clips are deleted or AI Background is toggled off.
 */
export function cleanupAiBackgroundResources(): void {
  alphaCanvasPool.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
}

export function cleanupClipBackgroundState(clipId: string): void {
  for (const key of alphaCanvasPool.keys()) {
    if (key.startsWith(clipId)) {
      alphaCanvasPool.delete(key);
    }
  }
  maskCacheMap.delete(clipId);
  segmentingInFlight.delete(clipId);
}

export function cleanupAllBackgroundState(): void {
  alphaCanvasPool.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
}

export const cleanupAllAIResources = cleanupAllBackgroundState;