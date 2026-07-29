import {
  detectHumanPresence,
  detectSceneChange,
  shouldUseCachedMask,
  getCachedMask,
  setCachedMask,
  markInferencePerformed,
  mustForceResegment,
  downscaleForInference,
  invalidateMaskCache,
} from './humanDetection';

let selfieSegmentationInstance: any = null;
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

// Per-clip canvas pools to prevent shared canvas corruption across multiple clips
const maskCanvasPool = new Map<string, HTMLCanvasElement>();
const edgeCanvasPool = new Map<string, HTMLCanvasElement>();

function getMaskCanvas(clipId: string, width: number, height: number): HTMLCanvasElement {
  let canvas = maskCanvasPool.get(clipId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    maskCanvasPool.set(clipId, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

function getEdgeCanvas(clipId: string, width: number, height: number): HTMLCanvasElement {
  let canvas = edgeCanvasPool.get(clipId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    edgeCanvasPool.set(clipId, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

/**
 * Dynamically loads the MediaPipe Selfie Segmentation library.
 * This ensures the 5MB+ model and scripts are only downloaded when the user actually enables the feature.
 */
export const loadMediaPipe = (): Promise<void> => {
  if (selfieSegmentationInstance) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise((resolve, reject) => {
    isInitializing = true;
    
    // Check if script already exists
    if (document.querySelector('#mediapipe-selfie-script')) {
      initInstance(resolve);
      return;
    }

    const script = document.createElement('script');
    script.id = 'mediapipe-selfie-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      initInstance(resolve);
    };
    script.onerror = (e) => {
      isInitializing = false;
      initializationPromise = null;
      reject(new Error('Failed to load MediaPipe Selfie Segmentation script.'));
    };
    document.body.appendChild(script);
  });

  return initializationPromise;
};

const initInstance = (resolve: () => void) => {
  try {
    const w = window as any;
    if (!w.SelfieSegmentation) {
      throw new Error('SelfieSegmentation is not available on window.');
    }

    selfieSegmentationInstance = new w.SelfieSegmentation({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      }
    });

    selfieSegmentationInstance.setOptions({
      modelSelection: 1, // 0 for general (slower, better), 1 for landscape (faster)
    });

    selfieSegmentationInstance.onResults(onResults);
    isInitializing = false;
    resolve();
  } catch (err) {
    console.error('Error initializing SelfieSegmentation:', err);
    isInitializing = false;
  }
};

// We need a mechanism to resolve segmentation per frame because MediaPipe uses an async callback `onResults`.
let pendingResolves: Array<(mask: ImageBitmap | HTMLCanvasElement | null) => void> = [];
let lastSegmentationMask: ImageBitmap | HTMLCanvasElement | null = null;
let isProcessingSegmentation = false;
let processingStartTime = 0; // Watchdog: timestamp when processing started

// Deadlock watchdog timeout (ms). If isProcessingSegmentation stays true
// longer than this, force-reset it to prevent permanent lockout.
const PROCESSING_TIMEOUT_MS = 2000;

const onResults = (results: any) => {
  isProcessingSegmentation = false;
  processingStartTime = 0;
  const resolve = pendingResolves.shift();
  if (results.segmentationMask) {
    // Dispose previous ImageBitmap to prevent GPU memory leak
    if (lastSegmentationMask && lastSegmentationMask !== results.segmentationMask && 'close' in lastSegmentationMask) {
      try {
        (lastSegmentationMask as ImageBitmap).close();
      } catch { /* already closed */ }
    }
    lastSegmentationMask = results.segmentationMask;
  }
  if (resolve) {
    resolve(lastSegmentationMask || null);
  }
};

/**
 * Returns a segmentation mask for the given image/video frame.
 * If the library is not loaded yet, it will throw or return null.
 */
export async function segmentFrame(
  imageElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  modelSelection: 0 | 1 = 0
): Promise<ImageBitmap | HTMLCanvasElement | null> {
  if (!selfieSegmentationInstance) {
    await loadMediaPipe();
  }

  if (!selfieSegmentationInstance) return null;

  // Deadlock watchdog: if processing has been stuck for too long, force-reset
  if (isProcessingSegmentation && processingStartTime > 0) {
    const elapsed = performance.now() - processingStartTime;
    if (elapsed > PROCESSING_TIMEOUT_MS) {
      console.warn(`MediaPipe processing stuck for ${Math.round(elapsed)}ms — force resetting.`);
      isProcessingSegmentation = false;
      processingStartTime = 0;
    }
  }

  // If inference is already currently computing a frame (during fast video playback),
  // immediately return the last known segmentation mask to maintain smooth 60 FPS without frame lag or queue piling.
  if (isProcessingSegmentation && lastSegmentationMask) {
    return lastSegmentationMask;
  }

  // Update model selection dynamically based on request
  selfieSegmentationInstance.setOptions({
    modelSelection
  });

  return new Promise((resolve) => {
    isProcessingSegmentation = true;
    processingStartTime = performance.now();
    pendingResolves.push(resolve);
    selfieSegmentationInstance.send({ image: imageElement }).catch((err: any) => {
      console.error('Error sending frame to MediaPipe:', err);
      isProcessingSegmentation = false;
      processingStartTime = 0;
      const idx = pendingResolves.indexOf(resolve);
      if (idx > -1) {
        pendingResolves.splice(idx, 1);
        resolve(lastSegmentationMask || null);
      }
    });
  });
}

/**
 * Applies the AI Background removal to a target canvas context.
 * 
 * Enhanced with human detection integration:
 * - When isPlaying=true, uses temporal caching, scene-change detection, and
 *   downscaled inference to maintain smooth playback frame rates.
 * - When paused or exporting, runs full-quality inference on every frame.
 * - All state is isolated per-clip via clipId to prevent mask bleed.
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
    let mask: ImageBitmap | HTMLCanvasElement | null = null;

    if (isPlaying && playbackQuality !== 'full') {
      // ── Playback optimization path ──

      // 1. Check temporal mask cache first — reuse recent mask if within frame budget
      if (shouldUseCachedMask(clipId, playbackQuality)) {
        const cached = getCachedMask(clipId);
        if (cached) {
          mask = cached;
        }
      }

      // 2. If no cached mask, check if we must force re-segmentation (monotonic ceiling)
      if (!mask) {
        const forceReseg = mustForceResegment(clipId, playbackQuality);
        const sceneChanged = detectSceneChange(clipId, sourceElement);

        if (!forceReseg && !sceneChanged && lastSegmentationMask) {
          // Scene is stable AND we haven't hit the monotonic ceiling — reuse last mask
          mask = lastSegmentationMask;
          setCachedMask(clipId, mask);
        } else {
          // 3. Quick skin-tone pre-check: skip inference if no human detected
          const humanDetected = detectHumanPresence(sourceElement);

          if (!humanDetected) {
            // No human visible — return without masking (show full frame)
            return;
          }

          // 4. Run inference on downscaled frame for performance
          const inferenceScale = playbackQuality === 'performance' ? 0.35 : 0.5;
          const downscaled = downscaleForInference(sourceElement, inferenceScale);
          mask = await segmentFrame(downscaled, modelSelection);
          
          // Mark that we actually ran ML inference — reset the monotonic counter
          markInferencePerformed(clipId);
          
          // Update clip-isolated cache
          if (mask) {
            setCachedMask(clipId, mask);
          }
        }
      }
    } else {
      // ── Paused / Export / Full quality path — always run full inference ──
      mask = await segmentFrame(sourceElement, modelSelection);
      if (mask) {
        markInferencePerformed(clipId);
        setCachedMask(clipId, mask);
      }
    }

    if (!mask) return;

    // Use per-clip offscreen canvas to avoid cross-clip corruption
    const maskCanvas = getMaskCanvas(clipId, width, height);
    
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;

    // Clear previous mask contents
    mCtx.clearRect(0, 0, width, height);

    // Apply edge blur to the mask if requested to soften edges
    if (edgeBlur > 0) {
      mCtx.filter = `blur(${edgeBlur}px)`;
    } else {
      mCtx.filter = 'none';
    }

    // Draw the mask (it's grayscale, subject is white)
    mCtx.drawImage(mask, 0, 0, width, height);
    mCtx.filter = 'none'; // reset filter

    // Now apply the mask to the target context
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over'; // reset

  } catch (err) {
    console.error('Error applying AI background mask:', err);
  }
}

/**
 * Smart Subject Human Outline Extractor & Neon Flash Engine
 * Extracts the exact body boundary outline of the human subject using AI segmentation
 * and renders a glowing neon strobe outline flash over the character in video frames.
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
    const mask = await segmentFrame(sourceElement, 1); // 1 = fast landscape model
    if (!mask) return;

    const maskCanvas = getMaskCanvas(clipId, width, height);

    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.clearRect(0, 0, width, height);
    mCtx.drawImage(mask, 0, 0, width, height);

    const edgeCanvas = getEdgeCanvas(clipId, width, height);

    const eCtx = edgeCanvas.getContext('2d');
    if (!eCtx) return;

    const strokeW = options.strokeWidth || 3;
    eCtx.clearRect(0, 0, width, height);

    // Extract boundary contours via offset difference blending
    eCtx.drawImage(maskCanvas, 0, 0, width, height);
    eCtx.globalCompositeOperation = 'difference';
    eCtx.drawImage(maskCanvas, strokeW, 0, width, height);
    eCtx.drawImage(maskCanvas, -strokeW, 0, width, height);
    eCtx.drawImage(maskCanvas, 0, strokeW, width, height);
    eCtx.drawImage(maskCanvas, 0, -strokeW, width, height);
    eCtx.globalCompositeOperation = 'source-over';

    // Calculate strobe flash pulse
    const time = options.currentTime || (performance.now() / 1000);
    const speed = options.flashSpeed || 8; // Hz
    const strobeWave = Math.sin(time * Math.PI * 2 * speed);
    if (strobeWave < -0.3) return; // skip during dark phase of strobe

    const alpha = Math.max(0.3, (strobeWave + 1) / 2);
    const outlineColor = options.color || '#00f0ff';

    // Tint extracted edge canvas with outlineColor
    eCtx.globalCompositeOperation = 'source-in';
    eCtx.fillStyle = outlineColor;
    eCtx.fillRect(0, 0, width, height);
    eCtx.globalCompositeOperation = 'source-over';

    // Draw glowing neon outline over target video canvas
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = options.glowBlur || 14;
    ctx.shadowColor = outlineColor;
    ctx.drawImage(edgeCanvas, 0, 0, width, height);
    ctx.restore();
  } catch (err) {
    console.error('Error applying Subject Neon Outline Flash:', err);
  }
}

/**
 * Clean up per-clip canvas pools. Call on project unload.
 */
export function cleanupAiBackgroundResources(): void {
  maskCanvasPool.clear();
  edgeCanvasPool.clear();
  lastSegmentationMask = null;
  isProcessingSegmentation = false;
  processingStartTime = 0;
  pendingResolves = [];
}
