let selfieSegmentationInstance: any = null;
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;
let sharedMaskCanvas: HTMLCanvasElement | null = null;

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

const onResults = (results: any) => {
  isProcessingSegmentation = false;
  const resolve = pendingResolves.shift();
  if (results.segmentationMask) {
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
    pendingResolves.push(resolve);
    selfieSegmentationInstance.send({ image: imageElement }).catch((err: any) => {
      console.error('Error sending frame to MediaPipe:', err);
      isProcessingSegmentation = false;
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
 */
export async function applyAiBackgroundMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  edgeBlur: number = 0,
  modelSelection: 0 | 1 = 0
) {
  try {
    const mask = await segmentFrame(sourceElement, modelSelection);
    if (!mask) return;

    // Reuse the shared offscreen canvas to avoid GC thrashing in the rendering loop
    if (!sharedMaskCanvas) {
      sharedMaskCanvas = document.createElement('canvas');
    }
    if (sharedMaskCanvas.width !== width || sharedMaskCanvas.height !== height) {
      sharedMaskCanvas.width = width;
      sharedMaskCanvas.height = height;
    }
    
    const mCtx = sharedMaskCanvas.getContext('2d');
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
    ctx.drawImage(sharedMaskCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over'; // reset

  } catch (err) {
    console.error('Error applying AI background mask:', err);
  }
}

let sharedEdgeCanvas: HTMLCanvasElement | null = null;

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
  } = {}
) {
  try {
    const mask = await segmentFrame(sourceElement, 1); // 1 = fast landscape model
    if (!mask) return;

    if (!sharedMaskCanvas) {
      sharedMaskCanvas = document.createElement('canvas');
    }
    if (sharedMaskCanvas.width !== width || sharedMaskCanvas.height !== height) {
      sharedMaskCanvas.width = width;
      sharedMaskCanvas.height = height;
    }

    const mCtx = sharedMaskCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.clearRect(0, 0, width, height);
    mCtx.drawImage(mask, 0, 0, width, height);

    if (!sharedEdgeCanvas) {
      sharedEdgeCanvas = document.createElement('canvas');
    }
    if (sharedEdgeCanvas.width !== width || sharedEdgeCanvas.height !== height) {
      sharedEdgeCanvas.width = width;
      sharedEdgeCanvas.height = height;
    }

    const eCtx = sharedEdgeCanvas.getContext('2d');
    if (!eCtx) return;

    const strokeW = options.strokeWidth || 3;
    eCtx.clearRect(0, 0, width, height);

    // Extract boundary contours via offset difference blending
    eCtx.drawImage(sharedMaskCanvas, 0, 0, width, height);
    eCtx.globalCompositeOperation = 'difference';
    eCtx.drawImage(sharedMaskCanvas, strokeW, 0, width, height);
    eCtx.drawImage(sharedMaskCanvas, -strokeW, 0, width, height);
    eCtx.drawImage(sharedMaskCanvas, 0, strokeW, width, height);
    eCtx.drawImage(sharedMaskCanvas, 0, -strokeW, width, height);
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
    ctx.drawImage(sharedEdgeCanvas, 0, 0, width, height);
    ctx.restore();
  } catch (err) {
    console.error('Error applying Subject Neon Outline Flash:', err);
  }
}
