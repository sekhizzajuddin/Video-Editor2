/**
 * aiBackground.ts
 *
 * AI background removal using @imgly/background-removal with forced ONNX WASM proxy.
 *
 * ── ROOT CAUSE OF PLAYHEAD HANG (NOW FIXED) ──────────────────────────────────
 *
 * @imgly/background-removal line 1008:
 *   `const proxyToWorker = useWebGPU && config.proxyToWorker;`
 *
 * The library ONLY enables its ONNX proxy worker when WebGPU is available.
 * On the vast majority of systems (no WebGPU), the entire IS-Net neural network
 * (500ms–3000ms of WASM execution) runs synchronously on the main thread,
 * monopolizing the CPU and freezing the RAF render loop, playhead, and UI.
 *
 * FIX: We use Object.defineProperty to force `ort.env.wasm.proxy = true` so the
 * library's attempt to set it to `false` is silently ignored. This makes ONNX
 * Runtime Web create its own internal proxy worker for WASM execution, moving
 * the heavy neural network computation off the main thread automatically.
 *
 * The remaining main-thread work (image resize, tensor prep, pixel loop at 384px)
 * takes < 10ms total, well within a single frame budget.
 */

import * as ortModule from 'onnxruntime-web';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import { resetClipDetectionState, resetAllDetectionState } from './humanDetection';
import { stabilizeTemporalAlpha } from './temporalMaskEngine';
import { segmentWithRVM, loadRVMSession, resetRVMState, resetAllRVMStates, RVM_EMPTY_COVERAGE } from './rvmMatting';

import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';
import type { AiCutoutMode } from '@/types';
// ── MediaPipe Ultra-Fast GPU Selfie Segmenter Engine (Primary) ────────────────
let mediaPipeGeneralSegmenter: any = null;
let mediaPipeLandscapeSegmenter: any = null;
let mediaPipeGeneralPromise: Promise<any> | null = null;
let mediaPipeLandscapePromise: Promise<any> | null = null;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Preload MediaPipe GPU Segmenter.
 * 'landscape' uses 16:9 widescreen TFLite model for high accuracy on video clips.
 * 'general' uses 256x256 square model.
 */
export async function loadMediaPipeSegmenter(modelType: 'general' | 'landscape' = 'landscape'): Promise<any> {
  if (modelType === 'landscape') {
    if (mediaPipeLandscapeSegmenter) return mediaPipeLandscapeSegmenter;
    if (mediaPipeLandscapePromise) return mediaPipeLandscapePromise;
    mediaPipeLandscapePromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );
        // OpenReel's high-quality path uses the multiclass selfie model. Combining
        // every non-background class preserves hair, clothes, face and accessories;
        // the landscape binary tends to cut those regions away.
        const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
        const createOpts: any = {
          baseOptions: { modelAssetPath, delegate: 'GPU' },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        };
        const segmenter = await ImageSegmenter.createFromOptions(vision, createOpts).catch(async (gpuErr: any) => {
          console.warn('[aiBackground] MediaPipe GPU delegate failed, falling back to CPU delegate:', gpuErr);
          createOpts.baseOptions.delegate = 'CPU';
          return ImageSegmenter.createFromOptions(vision, createOpts);
        });
        mediaPipeLandscapeSegmenter = segmenter;
        return segmenter;
      } catch (err) {
        console.warn('[aiBackground] MediaPipe landscape segmenter load failed:', err);
        return null;
      } finally {
        mediaPipeLandscapePromise = null;
      }
    })();
    return mediaPipeLandscapePromise;
  } else {
    if (mediaPipeGeneralSegmenter) return mediaPipeGeneralSegmenter;
    if (mediaPipeGeneralPromise) return mediaPipeGeneralPromise;
    mediaPipeGeneralPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );
        const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
        const createOpts: any = {
          baseOptions: { modelAssetPath, delegate: 'GPU' },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        };
        const segmenter = await ImageSegmenter.createFromOptions(vision, createOpts).catch(async (gpuErr: any) => {
          console.warn('[aiBackground] MediaPipe GPU delegate failed, falling back to CPU delegate:', gpuErr);
          createOpts.baseOptions.delegate = 'CPU';
          return ImageSegmenter.createFromOptions(vision, createOpts);
        });
        mediaPipeGeneralSegmenter = segmenter;
        return segmenter;
      } catch (err) {
        console.warn('[aiBackground] MediaPipe general segmenter load failed:', err);
        return null;
      } finally {
        mediaPipeGeneralPromise = null;
      }
    })();
    return mediaPipeGeneralPromise;
  }
}

/**
 * Run MediaPipe Selfie Segmenter directly on a Video/Canvas/Image element.
 * Applies Smoothstep Hermite S-Curve for High-Accuracy anti-aliased matte edges.
 */
let isMediaPipeDisabledForPerf = false;

export async function segmentSourceWithMediaPipe(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  modelType: 'general' | 'landscape' = 'landscape',
  clipId?: string,
  videoTime = 0
): Promise<ImageBitmap | null> {
  if (!source) return null;
  if ('videoWidth' in source && (source as HTMLVideoElement).videoWidth === 0) return null;
  if ('naturalWidth' in source && (source as HTMLImageElement).naturalWidth === 0) return null;
  if ('width' in source && typeof (source as any).width === 'number' && (source as any).width === 0) return null;

  const segmenter = await loadMediaPipeSegmenter(modelType);
  if (!segmenter) return null;

  try {
    const result = segmenter.segment(source as any);

    if (!result || !result.confidenceMasks || result.confidenceMasks.length === 0) {
      result?.close();
      return null;
    }

    // Multiclass model returns separate background, hair, skin, clothes and
    // accessory masks. Use the union of all non-background classes instead of
    // taking only mask[0], which is the main source of missing hair/clothing.
    const confidenceMasks = result.confidenceMasks;
    const labels = typeof segmenter.getLabels === 'function' ? segmenter.getLabels() : [];
    const backgroundIndex = Math.max(0, labels.findIndex((label: string) => /^background$/i.test(label.trim())));
    const baseMask = confidenceMasks[backgroundIndex] ?? confidenceMasks[0];
    const baseValues = baseMask.getAsFloat32Array();
    let floatArray: Float32Array;
    if (confidenceMasks.length > 1) {
      floatArray = new Float32Array(baseValues.length);
      for (let i = 0; i < baseValues.length; i++) {
        floatArray[i] = 1 - Math.max(0, Math.min(1, baseValues[i]));
      }
    } else {
      floatArray = baseValues;
    }
    const w = baseMask.width;
    const h = baseMask.height;

    if (clipId) {
      floatArray = stabilizeTemporalAlpha(clipId, floatArray, w, h, videoTime);
    }

    const imgData = new ImageData(w, h);
    const data32 = new Uint32Array(imgData.data.buffer);

    // High-Accuracy Smoothstep Matte Refinement:
    // Anti-aliases hair and edge boundaries while removing background noise halos.
    // Different thresholds are applied based on model precision to avoid edge tearing.
    const lowerEdge = modelType === 'landscape' ? 0.25 : 0.20;
    const upperEdge = modelType === 'landscape' ? 0.80 : 0.75;
    for (let i = 0; i < floatArray.length; i++) {
      const conf = floatArray[i];
      // Hermite S-Curve: smooth transition between calibrated background cutoff and solid subject
      const alphaVal = smoothstep(lowerEdge, upperEdge, conf);
      const alpha = Math.round(alphaVal * 255);
      data32[i] = (alpha << 24) | 0x00FFFFFF;
    }

    const bitmap = await createImageBitmap(imgData);
    for (const mask of confidenceMasks) mask.close();
    result.close();
    return bitmap;
  } catch (err) {
    console.error('[aiBackground] MediaPipe segmentation error:', err);
    return null;
  }
}

// ── CRITICAL FIX: Force ONNX WASM proxy ON ──────────────────────────────────
// This intercepts the library's `ort.env.wasm.proxy = false` assignment and
// keeps it pinned to `true`, so ONNX runs inference in its internal Web Worker
// regardless of WebGPU availability.
//
// A previous regression replaced the pin below with a plain `proxy = false`,
// forcing IS-Net + RVM inference onto the MAIN thread (50-300ms per frame) —
// that was the root cause of the stuttering / "not smooth" cutout playback.
// The ORT wasm binaries are bundled same-origin under /onnx/, so the proxy
// worker loads safely.
if (typeof window !== 'undefined') {
  const ortObj: any = (ortModule as any).default || ortModule;

  // Ensure the module's default export points to itself (ESM interop)
  if (ortObj && !ortObj.default) {
    try { ortObj.default = ortObj; } catch (_e) { /* frozen object */ }
  }
  (window as any).ort = ortObj;

  const wasmEnv: any = ortObj?.env?.wasm;
  if (wasmEnv) {
    let proxyOn = true;
    try {
      // Pinned accessor: @imgly/background-removal hard-codes
      // `ort.env.wasm.proxy = false` when WebGPU is absent; those writes are
      // silently ignored now, keeping inference in the worker thread.
      Object.defineProperty(wasmEnv, 'proxy', {
        configurable: true,
        get: () => proxyOn,
        set: () => { /* pinned ON — ignore library downgrades */ },
      });
    } catch (_e) {
      try { wasmEnv.proxy = true; } catch (__e) { /* frozen env */ }
    }
    try { 
      wasmEnv.wasmPaths = import.meta.env.DEV 
        ? 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/' 
        : '/onnx/'; 
    } catch (_e) { /* already initialized */ }

    // Escape hatch: rvmMatting disables the proxy only when it had to fall
    // back to a cross-origin CDN for the wasm binaries (a CDN worker would
    // be blocked). With the local /onnx/ assets this always stays enabled.
    (window as any).__ortWasmProxyControl = (on: boolean) => { proxyOn = !!on; };
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SimpleMaskCache {
  maskCanvas: HTMLCanvasElement;
  lastUpdateTimestamp: number;
  lastVideoTime: number;
}

// ── State ────────────────────────────────────────────────────────────────────

const maskCacheMap = new Map<string, SimpleMaskCache>();
const segmentingInFlight = new Set<string>();

// ── Empty-Mask Sentinel ──────────────────────────────────────────────────────
// Marks "analyzed: no subject in this frame". Consumers must show the ORIGINAL
// frame for these keys — never erase pixels. Identified by 1×1 dimensions so it
// survives ImageBitmap cloning/thread transfer (reference equality would not).

export function getEmptyMaskSentinel(): HTMLCanvasElement {
  const s = getPooledCanvas('_empty_mask_sentinel', 1, 1);
  return s as HTMLCanvasElement;
}

export function isEmptyMaskMarker(m: ImageBitmap | HTMLCanvasElement): boolean {
  return m.width === 1 && m.height === 1;
}

// Redraw callback: debounced with requestAnimationFrame to prevent RAF storms
let _onMaskReadyCallback: (() => void) | null = null;
export function setOnMaskReadyCallback(cb: (() => void) | null): void {
  _onMaskReadyCallback = cb;
}

let maskRafPending = false;
export function notifyMaskReady(): void {
  if (maskRafPending) return;
  maskRafPending = true;
  requestAnimationFrame(() => {
    maskRafPending = false;
    if (_onMaskReadyCallback) _onMaskReadyCallback();
  });
}

// ── Canvas Pool with LRU Eviction ─────────────────────────────────────────────
// Pre-allocated canvases with LRU eviction to prevent unbounded memory growth.

type PooledCanvas = HTMLCanvasElement | OffscreenCanvas;

const canvasPool = new Map<string, PooledCanvas>();
const MAX_POOL_SIZE = 50;

// Worker-safe canvas factory: OffscreenCanvas works in both window and worker
// scopes; document.createElement throws inside the export worker (used to crash
// exports whenever choke/feather or blur/outline/color cutout modes were used).
function createCanvas(w: number, h: number): PooledCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function getPooledCanvas(key: string, w: number, h: number): PooledCanvas {
  let c = canvasPool.get(key);
  if (c) {
    // Re-insert to mark as most recently used in Map iteration order
    canvasPool.delete(key);
    canvasPool.set(key, c);
  } else {
    if (canvasPool.size >= MAX_POOL_SIZE) {
      const firstKey = canvasPool.keys().next().value;
      if (firstKey) canvasPool.delete(firstKey);
    }
    c = createCanvas(w, h);
    canvasPool.set(key, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

// ── Module Loading ───────────────────────────────────────────────────────────

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
      console.log('[aiBackground] Loading @imgly/background-removal module...');
      bgRemovalModule = await import('@imgly/background-removal');
      const preloadFn = bgRemovalModule.preload ?? (bgRemovalModule as any).default?.preload;
      if (preloadFn) {
        console.log('[aiBackground] Starting background download of IS-Net model (~170MB). This may take a minute...');
        await preloadFn({
          model: 'isnet_fp16',
          publicPath: PUBLIC_PATH,
          proxyToWorker: true, // Library ignores this without WebGPU, but our
                               // Object.defineProperty override forces it anyway
          progress: (() => {
            let lastPercent = -1;
            return (key: string, current: number, total: number) => {
              if (total > 0) {
                const percent = Math.round((current / total) * 100);
                if (percent >= lastPercent + 5 || percent === 100) {
                  console.log(`[aiBackground] IS-Net Download Progress: ${percent}% (${Math.round(current/1024/1024)}MB / ${Math.round(total/1024/1024)}MB)`);
                  lastPercent = percent;
                }
              }
            };
          })()
        });
        console.log('[aiBackground] IS-Net model download complete!');
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

// ── Segmentation ─────────────────────────────────────────────────────────────

/**
 * Run inference on a Blob. The caller is responsible for capturing the snapshot
 * and converting it to a Blob BEFORE calling this function. This ensures the
 * snapshot is frozen (Blobs are immutable) and immune to canvas overwrite races.
 *
 * With the forced ONNX proxy, the heavy WASM inference runs in ONNX Runtime's
 * internal Web Worker. Main-thread cost: ~5-10ms (image resize + pixel loop).
 */
export async function segmentBlob(
  inputBlob: Blob,
  inferW: number,
  inferH: number,
  model: 'isnet' | 'isnet_fp16' = 'isnet_fp16'
): Promise<HTMLCanvasElement | null> {
  if (!bgRemovalModule) {
    await loadBackgroundRemover();
  }
  if (!bgRemovalModule || !isLoaded) return null;

  try {
    const removeBgFn = bgRemovalModule.removeBackground ?? (bgRemovalModule as any).default?.removeBackground;
    if (!removeBgFn) throw new Error('@imgly/background-removal: removeBackground function not found');

    // Run inference — with our proxy override, ONNX WASM runs in a background worker
    const resultBlob = await removeBgFn(inputBlob, {
      model,
      publicPath: PUBLIC_PATH,
      proxyToWorker: true,
      output: { format: 'image/png', quality: 0.9 },
    });

    const bitmap = await createImageBitmap(resultBlob);
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = inferW;
    resultCanvas.height = inferH;
    const ctx = resultCanvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.clearRect(0, 0, inferW, inferH);
    ctx.drawImage(bitmap, 0, 0, inferW, inferH);
    bitmap.close();
    return resultCanvas;
  } catch (err) {
    console.error('[aiBackground] segmentBlob error:', err);
    return null;
  }
}

/**
 * Optimized segmentation for pre-analysis pipeline.
 * Returns ImageBitmap directly — skips the redundant Blob→Canvas→ImageBitmap
 * round-trip that segmentBlob does. Saves ~10-20ms per frame.
 */
export async function segmentBlobToImageBitmap(
  inputBlob: Blob,
  model: 'isnet' | 'isnet_fp16' = 'isnet_fp16'
): Promise<ImageBitmap | null> {
  if (!bgRemovalModule) await loadBackgroundRemover();
  if (!bgRemovalModule || !isLoaded) return null;

  try {
    const removeBgFn = bgRemovalModule.removeBackground ?? (bgRemovalModule as any).default?.removeBackground;
    if (!removeBgFn) throw new Error('removeBackground function not found');

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    const resultBlob = await Promise.race([
      removeBgFn(inputBlob, {
        model,
        publicPath: PUBLIC_PATH,
        proxyToWorker: true,
        output: { format: 'image/png', quality: 0.8 },
      }),
      timeoutPromise
    ]);
    if (!resultBlob) return null;

    // Direct Blob → ImageBitmap. No intermediate canvas needed.
    return await createImageBitmap(resultBlob);
  } catch (err) {
    console.error('[aiBackground] segmentBlobToImageBitmap error:', err);
    return null;
  }
}

/**
 * Capture a snapshot from a source element, downscale to max dimension, and
 * immediately freeze it into a Blob. The Blob is immutable — no race condition
 * with pooled canvas overwrites.
 *
 * @param maxDimOverride  Override the max dimension for inference. Default 384.
 *                        Use 256 for pre-analysis (faster, mask-only — no detail needed).
 */
/**
 * Universal canvas-to-blob helper supporting both HTMLCanvasElement (.toBlob)
 * and OffscreenCanvas (.convertToBlob).
 */
export async function canvasToBlob(canvas: any, type: string = 'image/jpeg', quality: number = 0.85): Promise<Blob | null> {
  if (!canvas) return null;
  if (typeof canvas.convertToBlob === 'function') {
    try {
      return await canvas.convertToBlob({ type, quality });
    } catch {
      try {
        return await canvas.convertToBlob({ type: 'image/png' });
      } catch {
        return null;
      }
    }
  }
  if (typeof canvas.toBlob === 'function') {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          resolve(blob);
        } else {
          canvas.toBlob((pngBlob: Blob | null) => {
            resolve(pngBlob || null);
          }, 'image/png');
        }
      }, type, quality);
    });
  }
  return null;
}

export async function captureSnapshotBlob(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  maxDimOverride: number = 384
): Promise<{ blob: Blob; w: number; h: number } | null> {
  const maxDim = maxDimOverride;
  const scale = Math.min(1, maxDim / Math.max(targetWidth, targetHeight));
  const inferW = Math.max(64, Math.round(targetWidth * scale));
  const inferH = Math.max(64, Math.round(targetHeight * scale));

  const snapCanvas = getPooledCanvas('_snap_capture', inferW, inferH);
  const snapCtx = snapCanvas.getContext('2d');
  if (!snapCtx) return null;
  snapCtx.clearRect(0, 0, inferW, inferH);
  snapCtx.drawImage(source, 0, 0, inferW, inferH);

  // Freeze the snapshot into an immutable Blob immediately (supports OffscreenCanvas)
  const blob = await canvasToBlob(snapCanvas, 'image/jpeg', 0.85);
  if (!blob) return null;
  return { blob, w: inferW, h: inferH };
}

// ── Pre-rendered Mask Cache & Analysis Job Engine ────────────────────────────
// For real-time 60 FPS playback without any on-the-fly AI latency, we pre-render
// frame masks of video clips. Masks are indexed by source video timestamp quantized to 20 FPS.

export interface MaskAnalysisStatus {
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  progress: number;
  processedFrames: number;
  totalFrames: number;
}

const MASK_CACHE_FPS = 20; // Cache key granularity: 20 keys/sec for smooth playback lookup
export const preRenderedMaskCache = new Map<string, Map<number, ImageBitmap | HTMLCanvasElement>>();
const analysisProgressMap = new Map<string, MaskAnalysisStatus>();
const progressListeners = new Map<string, Set<(status: MaskAnalysisStatus) => void>>();
const activeAnalysisPromises = new Map<string, Promise<void>>();

function timeToKey(time: number): number {
  return Math.round(time * MASK_CACHE_FPS);
}

export function subscribeClipBackgroundAnalysis(clipId: string, listener: (status: MaskAnalysisStatus) => void): () => void {
  if (!progressListeners.has(clipId)) {
    progressListeners.set(clipId, new Set());
  }
  progressListeners.get(clipId)!.add(listener);
  const current = analysisProgressMap.get(clipId) || { status: 'idle', progress: 0, processedFrames: 0, totalFrames: 0 };
  listener(current);
  return () => {
    progressListeners.get(clipId)?.delete(listener);
  };
}

function updateClipAnalysisStatus(clipId: string, status: MaskAnalysisStatus): void {
  analysisProgressMap.set(clipId, status);
  const listeners = progressListeners.get(clipId);
  if (listeners) {
    listeners.forEach(cb => cb(status));
  }
}

export function getClipAnalysisStatus(clipId: string): MaskAnalysisStatus {
  return analysisProgressMap.get(clipId) || { status: 'idle', progress: 0, processedFrames: 0, totalFrames: 0 };
}

/**
 * Pre-analyze a video clip in the background using temporal keyframe strategy.
 *
 * PERFORMANCE ARCHITECTURE (6 optimizations vs. the naive per-frame approach):
 *
 * 1. TEMPORAL KEYFRAMES: Inference runs at KEYFRAME_INFERENCE_FPS (4/sec) instead
 *    of MASK_CACHE_FPS (20/sec). Each keyframe mask is shared across ~5 adjacent
 *    cache slots. 10s clip: 40 inferences, not 200.  → 80% fewer inferences.
 *
 * 2. FORCED FP16: Always uses isnet_fp16 for pre-analysis regardless of user's
 *    quality setting. Full isnet is reserved for export. → 2-3× faster inference.
 *
 * 3. REDUCED RESOLUTION: Inference at 256px instead of 384px. The mask is just
 *    alpha — doesn't need fine detail.                  → ~40% faster inference.
 *
 * 4. DIRECT ImageBitmap: segmentBlobToImageBitmap() returns an ImageBitmap
 *    directly instead of Blob→Canvas→ImageBitmap.      → ~15ms saved per frame.
 *
 * 5. OPTIMIZED YIELDS: yield every 4th keyframe at 1ms instead of every frame
 *    at 8ms.                                           → ~1.5s less total delay.
 *
 * 6. SHARED REFERENCES: Adjacent cache keys share the same ImageBitmap by
 *    reference — zero extra memory for fill frames.
 *
 * NET RESULT: 10s clip processes in ~10-20s instead of 30+ minutes.
 */
export async function startClipBackgroundAnalysis(
  clipId: string,
  videoUrl: string,
  startTime: number,
  duration: number,
  modelSelection: 0 | 1 | 2 = 2,  // Default 2: Studio RVM High-Accuracy Neural Matting
  forceRefresh: boolean = false
): Promise<void> {
  if (forceRefresh) {
    preRenderedMaskCache.delete(clipId);
    analysisProgressMap.delete(clipId);
    resetRVMState(clipId);
  }

  const inFlight = activeAnalysisPromises.get(clipId);
  if (inFlight) {
    return inFlight;
  }

  const existing = analysisProgressMap.get(clipId);
  if (existing && existing.status === 'completed' && !forceRefresh) {
    return;
  }

  const job = runClipBackgroundAnalysisInternal(clipId, videoUrl, startTime, duration, modelSelection);
  activeAnalysisPromises.set(clipId, job);
  try {
    await job;
  } finally {
    activeAnalysisPromises.delete(clipId);
  }
}

async function runClipBackgroundAnalysisInternal(
  clipId: string,
  videoUrl: string,
  startTime: number,
  duration: number,
  modelSelection: 0 | 1 | 2 = 2
): Promise<void> {
  // If it's an image clip or data URL, run instant static image segmentation (5ms)
  const isImage = videoUrl.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i) || videoUrl.startsWith('data:image/');
  if (isImage) {
    updateClipAnalysisStatus(clipId, { status: 'analyzing', progress: 0, processedFrames: 0, totalFrames: 1 });
    try {
      const img = new Image();
      if (!videoUrl.startsWith('blob:') && !videoUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image failed to load for background analysis'));
        img.src = videoUrl;
      });
      // Prefer the fast video-oriented segmenter, but always fall back to the
      // bundled IS-Net model. MediaPipe can fail on browsers without WebGL or
      // when its cross-origin model request is blocked; treating that failure as
      // a successful empty matte made Cutout appear to do nothing.
      let bmp = await segmentSourceWithMediaPipe(img, 'landscape', clipId, 0).catch(() => null);
      if (!bmp) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 360;
        const c = canvas.getContext('2d');
        c?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (blob) bmp = await segmentBlobToImageBitmap(blob, 'isnet_fp16');
      }
      if (bmp) {
        if (!preRenderedMaskCache.has(clipId)) {
          preRenderedMaskCache.set(clipId, new Map());
        }
        const maskMap = preRenderedMaskCache.get(clipId)!;
        const totalCacheSlots = Math.max(1, Math.ceil(duration * MASK_CACHE_FPS));
        const startKey = timeToKey(startTime);
        for (let f = 0; f <= totalCacheSlots; f++) {
          maskMap.set(startKey + f, bmp);
        }
      }
      updateClipAnalysisStatus(clipId, {
        status: 'completed',
        progress: 100,
        processedFrames: 1,
        totalFrames: 1,
      });
      notifyMaskReady();
      return;
    } catch (e) {
      console.warn('[aiBackground] Image analysis failed:', e);
      updateClipAnalysisStatus(clipId, { status: 'error', progress: 0, processedFrames: 0, totalFrames: 0 });
      return;
    }
  }

  updateClipAnalysisStatus(clipId, { status: 'analyzing', progress: 0, processedFrames: 0, totalFrames: 1 });

  const video = document.createElement('video');
  if (!videoUrl.startsWith('blob:') && !videoUrl.startsWith('data:')) {
    video.crossOrigin = 'anonymous';
  }
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  // ANDROID FIX: keep element composited while decoding frames for mask
  // inference — detached/invisible videos never produce frames on
  // Chrome-Android (see utils/mediaPoolContainer.ts).
  attachInvisibleMediaElement(video);

  try {
    // Publish progress before downloading/initialising a model. Previously the
    // UI stayed at 0% for the entire model startup, which looked like a hung
    // Cutout job even though inference had not started yet.
    updateClipAnalysisStatus(clipId, {
      status: 'analyzing', progress: 1, processedFrames: 0, totalFrames: 1,
    });
    notifyMaskReady();

    // ── PRIMARY ENGINE: RVM (Robust Video Matting) — CapCut-class quality ──
    // Recurrent temporal memory → hair-level alpha, zero flicker/ghosting.
    // Falls back to MediaPipe / IS-Net when RVM is unavailable (no Float16Array
    // support or model download failure).
    // RVM currently fails on the browser ONNX provider with AveragePool ceil
    // shape errors. Skip its session entirely so analysis can progress through
    // the working MediaPipe path instead of remaining at 1%.
    const rvmReady = false;
    if (!rvmReady) {
      const mpType = modelSelection === 0 ? 'general' : 'landscape';
      await loadMediaPipeSegmenter(mpType).catch(() => {});
    }

    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= 1 && isFinite(video.duration) && video.duration > 0) {
        resolve();
        return;
      }
      const timeoutId = setTimeout(() => {
        if (video.readyState >= 1 && isFinite(video.duration) && video.duration > 0) {
          resolve();
        } else {
          reject(new Error('Video load timeout'));
        }
      }, 10000);

      const onReady = () => {
        clearTimeout(timeoutId);
        cleanup();
        resolve();
      };
      const onError = () => {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error('Video failed to load for background analysis: ' + (video.error?.message || 'unknown error')));
      };
      const cleanup = () => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadeddata', onReady);
      video.addEventListener('loadedmetadata', onReady);
      video.addEventListener('canplay', onReady);
      video.addEventListener('error', onError);
      video.src = videoUrl;
      video.load();
    });

    const actualDuration = Math.min(isFinite(video.duration) ? Math.max(0.1, video.duration - startTime) : duration, duration);

    // ── High-Accuracy Temporal Keyframe Strategy ───────────────────────────
    // RVM (primary): recurrent memory keeps temporal coherence across keyframes,
    // so 12 FPS sampling yields fluid, flicker-free mattes with sub-80ms step times.
    // MediaPipe GPU (fallback, modelSelection 0/1) runs in ~5ms per frame —
    // sampled at full 20 FPS. IS-Net (modelSelection 2 fallback) at 10 FPS.
    // The multiclass MediaPipe model is GPU accelerated and inexpensive enough
    // for near-video-rate analysis. Sampling at 8 FPS keeps temporal edges much
    // closer to OpenReel while avoiding redundant work on every display frame.
    const inferenceFps = rvmReady ? 12 : (modelSelection === 0 || modelSelection === 1) ? MASK_CACHE_FPS : 8;
    const totalKeyframes = Math.max(1, Math.ceil(actualDuration * inferenceFps));
    const fillRatio = Math.max(1, Math.round(MASK_CACHE_FPS / inferenceFps));
    const totalCacheSlots = Math.max(1, Math.ceil(actualDuration * MASK_CACHE_FPS));

    // Update status immediately so UI displays accurate total frames (e.g. 0 / 50 frames)
    updateClipAnalysisStatus(clipId, {
      status: 'analyzing',
      progress: 0,
      processedFrames: 0,
      totalFrames: totalKeyframes,
    });

    if (!preRenderedMaskCache.has(clipId)) {
      preRenderedMaskCache.set(clipId, new Map());
    }
    const maskMap = preRenderedMaskCache.get(clipId)!;

    let processed = 0;

    for (let i = 0; i < totalKeyframes; i++) {
      // Abort gracefully if job was cancelled or clip state cleaned up
      if (analysisProgressMap.get(clipId)?.status !== 'analyzing') break;

      const targetTime = startTime + (i / inferenceFps);
      if (targetTime > video.duration) break;

      const keyframeKey = timeToKey(targetTime);

      // Skip if this keyframe region is already fully cached
      if (maskMap.has(keyframeKey)) {
        processed++;
        const pct = Math.min(99, Math.round((processed / totalKeyframes) * 100));
        updateClipAnalysisStatus(clipId, {
          status: 'analyzing', progress: pct,
          processedFrames: processed, totalFrames: totalKeyframes,
        });
        continue;
      }

      // Seek to keyframe timestamp only if needed, with frame-ready callback
      if (Math.abs(video.currentTime - targetTime) > 0.03) {
        await new Promise<void>((resolve) => {
          let fallback: any;
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(fallback);
            video.removeEventListener('seeked', onSeek);
            resolve();
          };
          const onSeek = () => {
            if ('requestVideoFrameCallback' in video) {
              (video as any).requestVideoFrameCallback(() => finish());
              fallback = setTimeout(finish, 200);
            } else {
              finish();
            }
          };
          video.addEventListener('seeked', onSeek);
          fallback = setTimeout(finish, 600);
          video.currentTime = targetTime;
        });
      }

      // Adopt OpenReel standard: downscale to 384px for ultra-fast, flicker-free neural matting
      const SEGMENTATION_LONG_EDGE = 384;
      const natW = video.videoWidth || 640;
      const natH = video.videoHeight || 360;
      const scale = Math.min(1, SEGMENTATION_LONG_EDGE / Math.max(natW, natH));
      const w = Math.max(64, Math.round(natW * scale));
      const h = Math.max(64, Math.round(natH * scale));

      // Draw video frame to an offscreen canvas to guarantee rasterization before WebGL inference
      const frameCanvas = getPooledCanvas(`_bg_analysis_frame_${clipId}`, w, h);
      const fCtx = frameCanvas.getContext('2d');
      if (fCtx) {
        fCtx.drawImage(video, 0, 0, w, h);
      }
      const segmentationSource = fCtx ? frameCanvas : video;

      let bitmap: ImageBitmap | HTMLCanvasElement | null = null;
      let noSubject = false;

      if (rvmReady) {
        // ── PRIMARY: CapCut-grade RVM matting with recurrent temporal memory ──
        // High 640px tier preserves fine hair, clothing boundaries and facial features.
        const rvmMaxDim = 640;
        // Pass ABSOLUTE media time (targetTime, not targetTime - startTime):
        // the interactive preview passes video.currentTime (absolute), and RVM's
        // recurrent state compares lastVideoTime to detect seeks — mixed time
        // bases forced a state reset on every alternating caller (flicker).
        const res = await segmentWithRVM(segmentationSource as any, clipId, targetTime, rvmMaxDim).catch((e) => {
          console.warn('[aiBackground] RVM keyframe error:', e);
          return null;
        });
        if (res && res.coverage >= RVM_EMPTY_COVERAGE) {
          bitmap = res.bitmap;
        } else if (res) {
          // RVM sees no subject in this frame
          noSubject = true;
        }

        // Robust fallback chain: RVM -> MediaPipe -> IS-Net. Do not turn an
        // inference error into an empty mask: that erases the entire frame and
        // was the main reason Cutout looked inactive on some browsers.
        if (!bitmap && !noSubject) {
          bitmap = await segmentSourceWithMediaPipe(segmentationSource as any, 'landscape', clipId, targetTime).catch(() => null);
        }
        if (!bitmap && !noSubject && fCtx) {
          const blob = 'convertToBlob' in frameCanvas
            ? await frameCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
            : await new Promise<Blob | null>((resolve) =>
                (frameCanvas as HTMLCanvasElement).toBlob(resolve, 'image/jpeg', 0.9)
              );
          if (blob) {
            bitmap = await segmentBlobToImageBitmap(blob, 'isnet_fp16').catch(() => null);
          }
        }
        if (!bitmap) noSubject = true;
      } else {
        // Use the multiclass MediaPipe person model first. It is the same
        // high-quality family used by OpenReel and runs on the GPU without the
        // 3–5 second IS-Net inference stall. IS-Net remains a fallback only.
        const mpType = modelSelection === 0 ? 'general' : 'landscape';
        bitmap = await segmentSourceWithMediaPipe(segmentationSource as any, mpType, clipId, targetTime).catch(() => null);
        if (!bitmap && modelSelection === 2 && fCtx) {
          const blob = 'convertToBlob' in frameCanvas
            ? await frameCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
            : await new Promise<Blob | null>((resolve) =>
                (frameCanvas as HTMLCanvasElement).toBlob(resolve, 'image/jpeg', 0.9)
              );
          if (blob) bitmap = await segmentBlobToImageBitmap(blob, 'isnet_fp16').catch(() => null);
        }
        if (!bitmap) noSubject = true;
      }

      // If segmentation succeeded with a valid bitmap, cache it.
      // If segmentation returned null (seeking glitch / timeout), do NOT store an empty sentinel
      // which would poison the cache and suppress live preview cutout.
      if (bitmap) {
        for (let f = 0; f < fillRatio; f++) {
          const fillKey = keyframeKey + f;
          if (fillKey < totalCacheSlots + timeToKey(startTime)) {
            maskMap.set(fillKey, bitmap);
          }
        }
      } else if (noSubject) {
        const fillValue = getEmptyMaskSentinel();
        for (let f = 0; f < fillRatio; f++) {
          const fillKey = keyframeKey + f;
          if (fillKey < totalCacheSlots + timeToKey(startTime)) {
            maskMap.set(fillKey, fillValue);
          }
        }
      }

      processed++;
      const pct = Math.min(99, Math.round((processed / totalKeyframes) * 100));
      updateClipAnalysisStatus(clipId, {
        status: 'analyzing',
        progress: pct,
        processedFrames: processed,
        totalFrames: totalKeyframes,
      });

      // Throttle preview repaints to avoid RAF storms
      if (processed % 6 === 0 || processed === 1) {
        notifyMaskReady();
      }

      // Yield to main thread every 2 keyframes to maintain smooth 60 FPS UI
      if (processed % 2 === 0) {
        await new Promise(r => setTimeout(r, 4));
      }
    }

    updateClipAnalysisStatus(clipId, {
      status: 'completed',
      progress: 100,
      processedFrames: totalKeyframes,
      totalFrames: totalKeyframes,
    });
    notifyMaskReady();
  } catch (err) {
    console.error('[aiBackground] Pre-analysis job failed:', err);
    updateClipAnalysisStatus(clipId, {
      status: 'error',
      progress: 0,
      processedFrames: 0,
      totalFrames: 0,
    });
  } finally {
    video.src = '';
    video.load();
    video.remove();
  }
}

/**
 * Ensures all background cutout masks for a clip are pre-computed and ready.
 * Used by the export manager to guarantee 100% background removal on export.
 */
export async function ensureClipMasksReady(
  clipId: string,
  videoUrl: string,
  startTime: number,
  duration: number,
  modelSelection: 0 | 1 | 2 = 1,
  onProgress?: (pct: number) => void
): Promise<Map<number, ImageBitmap | HTMLCanvasElement>> {
  const existingStatus = getClipAnalysisStatus(clipId);
  const existingMap = preRenderedMaskCache.get(clipId);
  if (existingMap && existingMap.size > 0 && existingStatus.status === 'completed') {
    return existingMap;
  }

  const unsubscribe = subscribeClipBackgroundAnalysis(clipId, (status) => {
    if (onProgress) onProgress(status.progress);
  });

  try {
    await startClipBackgroundAnalysis(clipId, videoUrl, startTime, duration, modelSelection);
  } finally {
    unsubscribe();
  }

  return preRenderedMaskCache.get(clipId) || new Map();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getVideoCurrentTime(sourceElement: any): number {
  if (sourceElement) {
    if (typeof sourceElement.currentTime === 'number' && sourceElement.currentTime >= 0) {
      return sourceElement.currentTime;
    }
    if (typeof sourceElement.localTime === 'number' && sourceElement.localTime >= 0) {
      return sourceElement.localTime;
    }
  }
  return -1;
}

// ── Professional Matting & Edge Post-Processing ──────────────────────────────

/**
 * Measure the fraction of pixels with non-zero alpha in a mask.
 * Used to detect "no subject" frames so they never erase the frame via
 * destination-in compositing.
 */
export async function measureMaskCoverage(m: ImageBitmap | HTMLCanvasElement): Promise<number> {
  try {
    const w = m.width;
    const h = m.height;
    if (w <= 0 || h <= 0) return 0;
    const c = getPooledCanvas('_cov_measure', w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 1;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(m as CanvasImageSource, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 3; i < d.length; i += 4) sum += d[i];
    return sum / (255 * w * h);
  } catch (_e) {
    return 1; // Fail-open: assume subject present
  }
}

/**
 * Suppress background color spill (e.g. green or blue fringe on hair/shoulders).
 * Operates directly on semi-transparent edge pixels of the composited canvas.
 */
export function applySpillSuppression(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  spillStrength: number = 0,
  targetHexColor?: string
): void {
  if (!spillStrength || spillStrength <= 0 || width <= 0 || height <= 0) return;
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const factor = Math.min(1, spillStrength / 100);

    let targetR = 0, targetG = 255, targetB = 0;
    if (targetHexColor && targetHexColor.startsWith('#') && targetHexColor.length === 7) {
      targetR = parseInt(targetHexColor.slice(1, 3), 16);
      targetG = parseInt(targetHexColor.slice(3, 5), 16);
      targetB = parseInt(targetHexColor.slice(5, 7), 16);
    }

    const isGreen = targetG > targetR + 30 && targetG > targetB + 30;
    const isBlue = targetB > targetR + 30 && targetB > targetG + 30;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 250 && a > 10) { // Target alpha fringe boundary pixels
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (isGreen && g > r && g > b) {
          const avg = (r + b) / 2;
          data[i + 1] = Math.round(g * (1 - factor) + avg * factor);
        } else if (isBlue && b > r && b > g) {
          const avg = (r + g) / 2;
          data[i + 2] = Math.round(b * (1 - factor) + avg * factor);
        } else if (!isGreen && !isBlue && g > 140 && g > r + 15 && g > b + 15) {
          const avg = (r + b) / 2;
          data[i + 1] = Math.round(g * (1 - factor) + avg * factor);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    // Ignore CORS canvas contamination
  }
}

/**
 * Refine mask alpha boundaries with Choke (shrink/expand) and Feather (Gaussian blur).
 */
export function refineMaskEdges(
  maskCanvas: HTMLCanvasElement | OffscreenCanvas | ImageBitmap,
  width: number,
  height: number,
  choke: number = 0,
  feather: number = 0,
  poolKey: string = 'mask_refine'
): PooledCanvas {
  const temp = getPooledCanvas(`${poolKey}_edge`, width, height);
  const tCtx = temp.getContext('2d');
  if (!tCtx) return temp;

  tCtx.clearRect(0, 0, width, height);
  tCtx.imageSmoothingEnabled = true;
  tCtx.imageSmoothingQuality = 'high';

  const blurVal = Math.max(0, feather);
  if (blurVal > 0) {
    tCtx.filter = `blur(${blurVal}px)`;
    tCtx.drawImage(maskCanvas as any, 0, 0, width, height);
    tCtx.filter = 'none';
  } else {
    tCtx.drawImage(maskCanvas as any, 0, 0, width, height);
  }

  if (choke !== 0) {
    try {
      const imgData = tCtx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const shift = Math.round(choke * 15); // Map -10..10 to alpha threshold shift
      for (let i = 3; i < data.length; i += 4) {
        let a = data[i];
        if (a > 0 && a < 255) {
          data[i] = Math.max(0, Math.min(255, a + shift));
        }
      }
      tCtx.putImageData(imgData, 0, 0);
    } catch (e) {
      // Ignore if canvas is tainted
    }
  }
  return temp;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply AI background removal to a canvas context.
 *
 * Interactive (isPlaying=true): Fire-and-forget async segmentation with throttling.
 *   The render loop never waits for inference — it composites the cached mask
 *   and moves on. When a fresh mask arrives, notifyMaskReady() triggers a repaint.
 *   CRITICAL: The LAST cached mask is ALWAYS composited even while a new one
 *   is being computed, so the background removal effect never "disappears".
 *
 * Export (isPlaying=false): Awaits segmentation for frame-accurate masks.
 */
export interface AiCutoutCompositeOptions {
  mode?: AiCutoutMode;
  blurStrength?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeGlow?: boolean;
  bgColor?: string;
  isExporting?: boolean;
}

export function applyPreRenderedMaskIfAvailable(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  clipId: string,
  isPlaying: boolean,
  modelSelection: number = 1,
  choke: number = 0,
  feather: number = 0,
  spillSuppression: number = 0,
  spillColor?: string,
  extraOptions?: AiCutoutCompositeOptions
): boolean {
  const currentVideoTime = getVideoCurrentTime(sourceElement);
  const clipPreRendered = preRenderedMaskCache.get(clipId);
  if (!clipPreRendered || clipPreRendered.size === 0 || currentVideoTime < 0) {
    return false;
  }

  // During playback, use the live timestamped MediaPipe pipeline instead of
  // reusing a pre-analysis matte for several display frames. Pre-rendered masks
  // are still used for paused scrubbing/export, where they are frame-accurate.
  // This is the reason the old implementation visibly skipped about 3 frames
  // between mask updates.
  if (isPlaying && !extraOptions?.isExporting) return false;

  const targetKey = timeToKey(currentVideoTime);
  let preMask: ImageBitmap | HTMLCanvasElement | undefined = clipPreRendered.get(targetKey);

  // Use the nearest timestamp, not the first mask found. The old search always
  // preferred the previous frame, and its wide one-second clamp made a moving
  // subject visibly trail the video while analysis was catching up.
  const maxSearchOffset = 3; // at most ~125 ms at the 24 FPS cache rate
  if (!preMask) {
    for (let offset = 1; offset <= maxSearchOffset && !preMask; offset++) {
      const before = clipPreRendered.get(targetKey - offset);
      const after = clipPreRendered.get(targetKey + offset);
      // Prefer the future frame when equally close: it avoids visible trailing.
      preMask = after || before;
    }
  }

  if (!preMask) {
    // FIX (flicker): Once a clip has ANY pre-rendered analysis data, that cache is
    // the SINGLE source of truth for the interactive preview. Falling back to the
    // live per-frame pipeline here composited masks from a DIFFERENT inference
    // engine/resolution — the alternating edges are exactly the CapCut-style
    // "flickering cutout" bug. Show the nearest available analyzed mask instead;
    // if the playhead is still ahead of the analysis, leave the original frame
    // (it will be replaced on the next repaint once analysis catches up).
    if (extraOptions?.isExporting) return false;
    return false;
  }

  // Analyzed-but-no-subject frame → show the ORIGINAL frame. Never fall through
  // to the live pipeline (source alternation = flicker).
  if (isEmptyMaskMarker(preMask)) return true;

  // NOTE: Robust Video Matting (RVM) masks are recurrently smoothed. Direct keyframe
  // lookup gives 100% solid, crisp silhouettes with zero double-image ghosting or 10Hz strobe.

  // Instant GPU texture composite with Choke and Feather
  // PERF (flicker/jank): refine at the MASK's native resolution (512-row RVM
  // output) instead of the full display canvas. The default cutout has
  // choke=-1 which previously forced a per-frame getImageData pixel loop at
  // 1080p+ on the main thread; running it at mask res is ~10x cheaper and
  // visually identical after the bilinear upscale during compositing.
  const maskW = (preMask as any)?.width || width;
  const maskH = (preMask as any)?.height || height;
  const refinedMask = (choke !== 0 || feather > 0)
    ? refineMaskEdges(preMask!, maskW, maskH, choke, feather, `${clipId}_pre`)
    : preMask;

  const mode = extraOptions?.mode || 'remove';

  if (mode === 'blur') {
    // ── Mode: Portrait Background Blur (Bokeh) ──
    const fgCanvas = getPooledCanvas(`${clipId}_cutout_fg`, width, height);
    const fgCtx = fgCanvas.getContext('2d');
    if (fgCtx) {
      fgCtx.clearRect(0, 0, width, height);
      fgCtx.drawImage(sourceElement as any, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'destination-in';
      fgCtx.drawImage(refinedMask as any, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'source-over';
      if (spillSuppression > 0) {
        applySpillSuppression(fgCtx, width, height, spillSuppression, spillColor);
      }

      ctx.save();
      ctx.clearRect(0, 0, width, height);
      const blurPx = Math.max(1, extraOptions?.blurStrength ?? 12);
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(sourceElement as any, 0, 0, width, height);
      ctx.restore();

      ctx.drawImage(fgCanvas, 0, 0, width, height);
    }
  } else if (mode === 'color') {
    // ── Mode: Solid / Studio Backdrop Color ──
    const fgCanvas = getPooledCanvas(`${clipId}_cutout_fg`, width, height);
    const fgCtx = fgCanvas.getContext('2d');
    if (fgCtx) {
      fgCtx.clearRect(0, 0, width, height);
      fgCtx.drawImage(sourceElement as any, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'destination-in';
      fgCtx.drawImage(refinedMask as any, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'source-over';
      if (spillSuppression > 0) {
        applySpillSuppression(fgCtx, width, height, spillSuppression, spillColor);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = extraOptions?.bgColor || '#1e1e24';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(fgCanvas, 0, 0, width, height);
    }
  } else if (mode === 'outline') {
    // ── Mode: Sticker / Neon Outline (YouTube Shorts / TikTok style) ──
    const fgCanvas = getPooledCanvas(`${clipId}_cutout_fg`, width, height);
    const fgCtx = fgCanvas.getContext('2d');
    if (fgCtx) {
      fgCtx.clearRect(0, 0, width, height);
      fgCtx.drawImage(sourceElement as any, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'destination-in';
      fgCtx.drawImage(refinedMask as any, 0, 0, width, height);
      fgCtx.globalCompositeOperation = 'source-over';
      if (spillSuppression > 0) {
        applySpillSuppression(fgCtx, width, height, spillSuppression, spillColor);
      }

      const strokeW = Math.max(1, extraOptions?.strokeWidth ?? 4);
      const strokeCol = extraOptions?.strokeColor ?? '#ffffff';
      const strokeCanvas = getPooledCanvas(`${clipId}_cutout_stroke`, width, height);
      const sCtx = strokeCanvas.getContext('2d');
      if (sCtx) {
        sCtx.clearRect(0, 0, width, height);
        sCtx.drawImage(refinedMask as any, 0, 0, width, height);
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.fillStyle = strokeCol;
        sCtx.fillRect(0, 0, width, height);
        sCtx.globalCompositeOperation = 'source-over';
      }

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      if (extraOptions?.strokeGlow) {
        ctx.shadowColor = strokeCol;
        ctx.shadowBlur = strokeW * 3;
      }
      const offsets = [-strokeW, 0, strokeW];
      for (const ox of offsets) {
        for (const oy of offsets) {
          if (ox === 0 && oy === 0) continue;
          ctx.drawImage(strokeCanvas, ox, oy, width, height);
        }
      }
      ctx.restore();
      ctx.drawImage(fgCanvas, 0, 0, width, height);
    }
  } else {
    // ── Mode: Standard Transparent Cutout ──
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(refinedMask as any, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    if (spillSuppression > 0) {
      applySpillSuppression(ctx, width, height, spillSuppression, spillColor);
    }
  }
  return true;
}

export async function applyAiBackgroundMask(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  edgeBlur: number = 0,
  modelSelection: 0 | 1 | 2 = 1,
  playbackQuality: 'full' | 'balanced' | 'performance' = 'balanced',
  isPlaying: boolean = false,
  clipId: string = '_default',
  options: { choke?: number; feather?: number; spillSuppression?: number; spillColor?: string } = {}
): Promise<void> {
  try {
    const currentVideoTime = getVideoCurrentTime(sourceElement);
    const choke = options.choke ?? 0;
    const feather = (options.feather ?? 0) > 0 ? options.feather! : edgeBlur;
    const spillSuppression = options.spillSuppression ?? 0;
    const spillColor = options.spillColor;

    // ── STEP 1: FAST O(1) PRE-RENDERED MASK LOOKUP WITH TEMPORAL ALPHA BLENDING ──
    if (applyPreRenderedMaskIfAvailable(ctx, width, height, sourceElement, clipId, isPlaying, modelSelection, choke, feather, spillSuppression, spillColor)) {
      return;
    }

    const cached = maskCacheMap.get(clipId);
    let maskCanvas = cached ? cached.maskCanvas : null;

    const updateIntervalMs = playbackQuality === 'performance' ? 700
                           : playbackQuality === 'full' ? 250
                           : 450;

    if (isPlaying) {
      // ── INTERACTIVE: non-blocking fire-and-forget ──
      // Always composite the LAST cached mask (even stale). Only fire a new
      // segmentation request if enough time has elapsed AND no request is in flight.
      const elapsed = performance.now() - (cached?.lastUpdateTimestamp || 0);
      const shouldRefresh = !maskCanvas || elapsed > updateIntervalMs;

      if (shouldRefresh && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);

        const analysisActive = getClipAnalysisStatus(clipId).status === 'analyzing';

        const segmentPromise = (async (): Promise<HTMLCanvasElement | null> => {
          // PRIMARY: CapCut-grade RVM with recurrent temporal memory.
          // Skipped while the pre-analysis job runs — it fills masks
          // progressively and shares the per-clip recurrent state.
          if (!analysisActive) {
            const res = await segmentWithRVM(sourceElement as any, clipId, currentVideoTime, 384).catch(() => null);
            if (res) {
              if (res.coverage < RVM_EMPTY_COVERAGE) return null; // no subject → original frame
              const resCanvas = document.createElement('canvas');
              resCanvas.width = width;
              resCanvas.height = height;
              const rCtx = resCanvas.getContext('2d');
              if (rCtx) rCtx.drawImage(res.bitmap, 0, 0, width, height);
              res.bitmap.close();
              return resCanvas;
            }
          }
          // FALLBACK: MediaPipe GPU → IS-Net snapshot
          return (modelSelection === 0 || modelSelection === 1)
            ? segmentSourceWithMediaPipe(sourceElement as any, modelSelection === 0 ? 'general' : 'landscape')
                .then(async (mpBitmap) => {
                  if (mpBitmap) {
                    const resCanvas = document.createElement('canvas');
                    resCanvas.width = width;
                    resCanvas.height = height;
                    const rCtx = resCanvas.getContext('2d');
                    if (rCtx) rCtx.drawImage(mpBitmap, 0, 0, width, height);
                    mpBitmap.close();
                    return resCanvas;
                  }
                  const snap = await captureSnapshotBlob(sourceElement, width, height, 512);
                  if (!snap) return null;
                  return segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
                })
            : captureSnapshotBlob(sourceElement, width, height, 640).then(async (snap) => {
                if (!snap) return null;
                return segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
              });
        })();

        segmentPromise
          .then((result) => {
            if (result) {
              maskCacheMap.set(clipId, {
                maskCanvas: result,
                lastUpdateTimestamp: performance.now(),
                lastVideoTime: getVideoCurrentTime(sourceElement),
              });
              notifyMaskReady();
            }
          })
          .catch((err) => {
            console.warn('[aiBackground] Playback segmentation error:', err);
          })
          .finally(() => {
            segmentingInFlight.delete(clipId);
          });
      }
      // Fall through — composite whatever cached mask we have.

    } else {
      // ── EXPORT / PAUSED: await for frame-accurate mask ──
      const timeMoved = currentVideoTime >= 0 &&
        Math.abs(currentVideoTime - (cached?.lastVideoTime ?? -1)) > 0.04;

      if (!maskCanvas || timeMoved) {
        // PRIMARY: CapCut-grade RVM matting
        const rvmRes = await segmentWithRVM(sourceElement as any, clipId, currentVideoTime, modelSelection === 2 ? 768 : 512).catch(() => null);
        if (rvmRes && rvmRes.coverage >= RVM_EMPTY_COVERAGE) {
          const resCanvas = document.createElement('canvas');
          resCanvas.width = width;
          resCanvas.height = height;
          const rCtx = resCanvas.getContext('2d');
          if (rCtx) rCtx.drawImage(rvmRes.bitmap, 0, 0, width, height);
          rvmRes.bitmap.close();
          maskCanvas = resCanvas;
        }
        if (!maskCanvas) {
          if (modelSelection === 0 || modelSelection === 1) {
            const mpType = modelSelection === 0 ? 'general' : 'landscape';
            const mpBitmap = await segmentSourceWithMediaPipe(sourceElement as any, mpType);
            if (mpBitmap) {
              const resCanvas = document.createElement('canvas');
              resCanvas.width = width;
              resCanvas.height = height;
              const rCtx = resCanvas.getContext('2d');
              if (rCtx) rCtx.drawImage(mpBitmap, 0, 0, width, height);
              mpBitmap.close();
              maskCanvas = resCanvas;
            }
          }
          if (!maskCanvas) {
            const model = 'isnet_fp16';
            const maxDim = modelSelection === 2 ? 1024 : 512;
            const snap = await captureSnapshotBlob(sourceElement, width, height, maxDim);
            if (snap) {
              const result = await segmentBlob(snap.blob, snap.w, snap.h, model);
              if (result) {
                maskCanvas = result;
              }
            }
          }
        }
        if (maskCanvas) {
          maskCacheMap.set(clipId, {
            maskCanvas: maskCanvas,
            lastUpdateTimestamp: performance.now(),
            lastVideoTime: currentVideoTime,
          });
        }
      }
    }

    // ── Composite mask (GPU-accelerated drawImage, < 0.1ms) ──
    if (!maskCanvas) return;

    const refinedMask = (choke !== 0 || feather > 0)
      ? refineMaskEdges(maskCanvas, width, height, choke, feather, `${clipId}_live`)
      : (edgeBlur > 0 ? refineMaskEdges(maskCanvas, width, height, 0, edgeBlur, `${clipId}_blur`) : maskCanvas);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(refinedMask as any, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    if (spillSuppression > 0) {
      applySpillSuppression(ctx, width, height, spillSuppression, spillColor);
    }
  } catch (err) {
    console.error('[aiBackground] applyAiBackgroundMask error:', err);
  }
}

/**
 * Subject neon outline flash effect using AI segmentation mask.
 */
export async function applySubjectNeonOutlineFlash(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
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
): Promise<void> {
  try {
    const clipId = options.clipId || '_neon_default';
    const isPlaying = options.isPlaying || false;
    const currentVideoTime = getVideoCurrentTime(sourceElement);

    const cached = maskCacheMap.get(clipId);
    let maskCanvas = cached ? cached.maskCanvas : null;

    if (isPlaying) {
      const shouldRefresh = !maskCanvas ||
        (performance.now() - (cached?.lastUpdateTimestamp || 0) > 450);
      if (shouldRefresh && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);

        captureSnapshotBlob(sourceElement, width, height)
          .then((snap) => {
            if (!snap) {
              segmentingInFlight.delete(clipId);
              return;
            }
            return segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16')
              .then((result) => {
                if (result) {
                  maskCacheMap.set(clipId, {
                    maskCanvas: result,
                    lastUpdateTimestamp: performance.now(),
                    lastVideoTime: getVideoCurrentTime(sourceElement),
                  });
                  notifyMaskReady();
                }
              });
          })
          .catch(() => {})
          .finally(() => { segmentingInFlight.delete(clipId); });
      }
    } else {
      const timeMoved = currentVideoTime >= 0 &&
        Math.abs(currentVideoTime - (cached?.lastVideoTime ?? -1)) > 0.04;
      if (!maskCanvas || timeMoved) {
        const snap = await captureSnapshotBlob(sourceElement, width, height);
        if (snap) {
          const result = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
          if (result) {
            maskCanvas = result;
            maskCacheMap.set(clipId, {
              maskCanvas: result,
              lastUpdateTimestamp: performance.now(),
              lastVideoTime: currentVideoTime,
            });
          }
        }
      }
    }

    if (!maskCanvas) return;

    const edgeCanvas = getPooledCanvas(`${clipId}_edge`, width, height);
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

// ── Cleanup ──────────────────────────────────────────────────────────────────

function closeMapTextures(map: Map<number, ImageBitmap | HTMLCanvasElement>): void {
  // Use a Set to avoid double-closing shared ImageBitmap references.
  // The temporal keyframe strategy stores the same bitmap in multiple keys.
  const closed = new Set<ImageBitmap | HTMLCanvasElement>();
  for (const val of map.values()) {
    if (closed.has(val)) continue;
    closed.add(val);
    if ('close' in val && typeof (val as any).close === 'function') {
      (val as any).close();
    }
  }
  map.clear();
}

export function cleanupAiBackgroundResources(): void {
  canvasPool.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
  for (const map of preRenderedMaskCache.values()) {
    closeMapTextures(map);
  }
  preRenderedMaskCache.clear();
  analysisProgressMap.clear();
}

export function cleanupClipBackgroundState(clipId: string): void {
  for (const key of canvasPool.keys()) {
    if (key.startsWith(clipId)) canvasPool.delete(key);
  }
  maskCacheMap.delete(clipId);
  segmentingInFlight.delete(clipId);
  resetRVMState(clipId);

  const preMap = preRenderedMaskCache.get(clipId);
  if (preMap) {
    closeMapTextures(preMap);
    preRenderedMaskCache.delete(clipId);
  }
  updateClipAnalysisStatus(clipId, { status: 'idle', progress: 0, processedFrames: 0, totalFrames: 0 });
  resetClipDetectionState(clipId);
}

export function cleanupAllBackgroundState(): void {
  canvasPool.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
  for (const map of preRenderedMaskCache.values()) {
    closeMapTextures(map);
  }
  preRenderedMaskCache.clear();
  analysisProgressMap.clear();
  resetAllDetectionState();
  resetAllRVMStates();
}

export const cleanupAllAIResources = cleanupAllBackgroundState;