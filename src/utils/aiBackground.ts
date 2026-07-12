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
let pendingResolves: Array<(mask: ImageBitmap | HTMLCanvasElement) => void> = [];

const onResults = (results: any) => {
  const resolve = pendingResolves.shift();
  if (resolve && results.segmentationMask) {
    // The mask is a grayscale image where the subject is white (255) and background is black (0)
    resolve(results.segmentationMask);
  } else if (resolve) {
    resolve(null as any);
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

  // Update model selection dynamically based on request
  selfieSegmentationInstance.setOptions({
    modelSelection
  });

  return new Promise((resolve) => {
    // MediaPipe processes the frame and fires the callback
    pendingResolves.push(resolve);
    selfieSegmentationInstance.send({ image: imageElement }).catch((err: any) => {
      console.error('Error sending frame to MediaPipe:', err);
      const idx = pendingResolves.indexOf(resolve);
      if (idx > -1) {
        pendingResolves.splice(idx, 1);
        resolve(null as any);
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
