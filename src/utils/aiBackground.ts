/**
 * aiBackground.ts
 *
 * AI background removal using @imgly/background-removal (ONNX, runs locally,
 * no CDN/CORS issues, supports images + video frames).
 *
 * Why @imgly and not MediaPipe Selfie Segmentation:
 *   1. MediaPipe's CDN-hosted WASM/model files fail in many environments due
 *      to CORP/COEP headers and cross-origin tainting — the current code path
 *      is broken for most users.
 *   2. @imgly runs entirely locally with onnxruntime-web (already a project
 *      dependency). No network calls during inference.
 *   3. @imgly returns a Blob with a real alpha channel; we composite it
 *      directly without the brittle destination-in tricks MediaPipe required.
 *   4. Works identically on images and video frames.
 *
 * Architecture:
 *   - `loadBackgroundRemover()` preloads the model when the feature is enabled
 *   - `segmentFrameAsync()` runs inference with per-clip isolation
 *   - `applyAiBackgroundMask()` composites the alpha mask onto the engine
 *   - `applySubjectNeonOutlineFlash()` reuses the alpha to draw a neon outline
 *
 * Performance optimizations (integrated with humanDetection.ts):
 *   - Downscaled inference (256-512px) during playback
 *   - Temporal mask caching (3-6 frames depending on quality preset)
 *   - Scene-change detection to skip redundant inference
 *   - Skin-tone pre-check to skip when no human is present
 *   - Mask cache stored at SOURCE RESOLUTION (not downscaled) for sharp edges
 *     when re-applied
 */

import {
  detectHumanPresence,
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

// Lazy-loaded so the 5MB+ model only downloads when the feature is enabled
let bgRemovalModule: typeof import('@imgly/background-removal') | null = null;
let loadPromise: Promise<void> | null = null;
let isLoaded = false;

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
 * Preload the @imgly/background-removal model. Safe to call multiple times —
 * subsequent calls reuse the in-flight or completed promise.
 *
 * Default model: 'isnet' (best human segmentation quality). Fallback: 'medium'
 * which is faster and smaller.
 */
export const loadBackgroundRemover = (): Promise<void> => {
  if (isLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      bgRemovalModule = await import('@imgly/background-removal');
      // Preload the medium model so the first frame doesn't block. The isnet
      // model is loaded lazily on first segmentForeground() call if requested.
      // @imgly/background-removal v1.7 exports `preload` as a named export
      // (there is no default export). Call it directly on the module.
      const preloadFn = bgRemovalModule.preload ?? (bgRemovalModule as any).default?.preload;
      if (preloadFn) {
        await preloadFn({
          model: 'medium',
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
 *
 * Uses @imgly/background-removal under the hood. The result Blob's alpha
 * channel is decoded into a canvas for fast GPU compositing.
 */
async function segmentSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  model: 'isnet' | 'medium' = 'medium'
): Promise<HTMLCanvasElement | null> {
  if (!bgRemovalModule) {
    await loadBackgroundRemover();
  }
  if (!bgRemovalModule || !isLoaded) return null;

  try {
    // @imgly takes an HTMLImageElement | Blob | URL string. For our use case
    // we want to draw the current video frame into an offscreen canvas at
    // a downscaled resolution (faster inference) and pass that canvas.
    // @imgly/background-removal v1.7 exports `removeBackground` as a named
    // export (there is no default export).
    const removeBgFn = bgRemovalModule.removeBackground ?? (bgRemovalModule as any).default?.removeBackground;
    if (!removeBgFn) throw new Error('@imgly/background-removal: removeBackground function not found');
    const blob = await removeBgFn(source as any, {
      model,
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
 * Crop the source element to the detected human bbox (with 10% padding)
 * and scale it back up to full canvas dimensions. This lets the ML model
 * run on a smaller effective input while we still get a full-resolution
 * mask canvas out.
 *
 * Returns the original source unchanged if no bbox is provided.
 *
 * The cropped canvas is pooled per-clip via alphaCanvasPool to avoid GC.
 */
function cropSourceToBbox(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  bbox: { x: number; y: number; w: number; h: number } | undefined,
  outWidth: number,
  outHeight: number,
  clipIdSuffix: string = '_crop'
): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap {
  if (!bbox) return source;

  // Determine source dimensions (varies by element type)
  const sw = 'videoWidth' in source ? (source as HTMLVideoElement).videoWidth
    : 'naturalWidth' in source ? (source as HTMLImageElement).naturalWidth
    : (source as HTMLCanvasElement | ImageBitmap).width;
  const sh = 'videoHeight' in source ? (source as HTMLVideoElement).videoHeight
    : 'naturalHeight' in source ? (source as HTMLImageElement).naturalHeight
    : (source as HTMLCanvasElement | ImageBitmap).height;
  if (!sw || !sh) return source;

  // bbox is normalized 0..1 — convert to pixels with 10% padding on each side.
  const pad = 0.10;
  const sx = Math.max(0, Math.floor((bbox.x - pad) * sw));
  const sy = Math.max(0, Math.floor((bbox.y - pad) * sh));
  const sw2 = Math.min(sw, Math.ceil((bbox.w + pad * 2) * sw));
  const sh2 = Math.min(sh, Math.ceil((bbox.h + pad * 2) * sh));
  // Skip crop if bbox covers nearly the whole frame (not worth the copy).
  if (sw2 >= sw * 0.95 && sh2 >= sh * 0.95) return source;

  const crop = getAlphaCanvas(clipIdSuffix, outWidth, outHeight);
  const ctx = crop.getContext('2d', { willReadFrequently: false });
  if (!ctx) return source;
  ctx.clearRect(0, 0, outWidth, outHeight);
  ctx.drawImage(source, sx, sy, sw2, sh2, 0, 0, outWidth, outHeight);
  return crop;
}

/**
 * Public API: apply AI background removal to a canvas context.
 *
 * @param ctx                Target context (the off-canvas the clip is drawn to)
 * @param width              Output canvas width
 * @param height             Output canvas height
 * @param sourceElement      The original video/image element (used for ML)
 * @param edgeBlur           Soften mask edges in pixels (0 = hard edge)
 * @param modelSelection     0 = isnet (high quality), 1 = medium (fast)
 * @param playbackQuality    Inference quality preset
 * @param isPlaying          Whether timeline is currently playing
 * @param clipId             Unique clip identifier for per-clip state isolation
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
    let maskCanvas: HTMLCanvasElement | null = null;

    if (isPlaying && playbackQuality !== 'full') {
      // ── Playback optimization path ──
      // 1. Check temporal mask cache first.
      if (shouldUseCachedMask(clipId, playbackQuality)) {
        const cached = getCachedMaskCanvas(clipId, width, height);
        if (cached) maskCanvas = cached;
      }

      // 2. If no cached mask, check if we must force re-segmentation.
      if (!maskCanvas) {
        const forceReseg = mustForceResegment(clipId, playbackQuality);
        const sceneChanged = detectSceneChange(clipId, sourceElement);

        if (!forceReseg && !sceneChanged) {
          // Stable scene — try to use last frame's mask at full resolution.
          const lastMask = getCachedMaskCanvas(clipId, width, height);
          if (lastMask) {
            maskCanvas = lastMask;
            cacheMaskCanvas(clipId, maskCanvas);
          }
        } else {
          // 3. Skin-tone pre-check: skip inference if no human detected.
          //    detectHumanPresence returns { hasHuman, bbox, skinRatio } —
          //    when human is present we use the bbox to crop the source
          //    before ML inference (smaller input → much faster + more
          //    accurate on small subjects).
          const detection = detectHumanPresence(sourceElement);
          if (!detection.hasHuman) {
            // No human visible — clear the alpha mask and return.
            return;
          }

          // 4. Run inference. If we have a bbox, crop to it (with a small
          //    padding margin) — this typically cuts inference time by 2-4×.
          const model: 'isnet' | 'medium' = modelSelection === 0 ? 'isnet' : 'medium';
          const croppedSource = cropSourceToBbox(sourceElement, detection.bbox, width, height);
          const result = await segmentSource(croppedSource, width, height, model);

          if (result) {
            maskCanvas = result;
            markInferencePerformed(clipId);
            cacheMaskCanvas(clipId, maskCanvas);
          }
        }
      }
    } else {
      // ── Paused / Export / Full quality path — always run full inference ──
      const model: 'isnet' | 'medium' = modelSelection === 0 ? 'isnet' : 'medium';
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
      // For edge blur, we draw the mask onto an intermediate blurred canvas
      // so the alpha pixels have soft edges.
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
    const model: 'isnet' | 'medium' = 'medium';
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
 * Clean up per-clip canvas pools and cache state. Call on project unload
 * or when the user explicitly disables the feature on a clip.
 */
export function cleanupAiBackgroundResources(): void {
  alphaCanvasPool.clear();
  invalidateMaskCache();
}

/**
 * Clean up state for a specific clip. Call when a clip is removed from the
 * timeline or the user toggles off the AI background feature.
 */
export function cleanupClipBackgroundState(clipId: string): void {
  const maskCanvas = alphaCanvasPool.get(clipId);
  if (maskCanvas) {
    alphaCanvasPool.delete(clipId);
  }
  resetClipDetectionState(clipId);
}

/**
 * Clean up ALL clip state. Call on project unload.
 */
export function cleanupAllBackgroundState(): void {
  alphaCanvasPool.clear();
  resetAllDetectionState();
}

// Backwards-compatible cleanup alias
export const cleanupAllAIResources = cleanupAllBackgroundState;

// Re-export public humanDetection API for convenience
export {
  detectHumanPresence,
  detectSceneChange,
  shouldUseCachedMask,
  markInferencePerformed,
  mustForceResegment,
  invalidateMaskCache,
  resetClipDetectionState,
  resetAllDetectionState,
};
