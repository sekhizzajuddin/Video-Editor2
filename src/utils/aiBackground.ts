/**
 * aiBackground.ts
 *
 * AI background removal. IS-Net (@imgly/background-removal) is the last-resort
 * rung; the primary matte comes from RVM (see rvmMatting.ts) with MediaPipe in
 * between.
 *
 * ── ON ort.env.wasm.proxy ────────────────────────────────────────────────────
 *
 * @imgly/background-removal only enables its own proxy worker when WebGPU is
 * present (`const proxyToWorker = useWebGPU && config.proxyToWorker;`), so an
 * earlier revision pinned `ort.env.wasm.proxy = true` via Object.defineProperty
 * to force inference off the main thread.
 *
 * That is now deliberately `false`. ORT's proxy worker is created from the CDN
 * origin serving the WASM, and under the COOP/COEP headers this app sets (see
 * vite.config.ts / vercel.json) that cross-origin worker fails to start — which
 * killed inference outright rather than merely making it synchronous.
 *
 * Main-thread cost is kept acceptable instead by the pre-render analysis pass
 * (which yields between keyframes) and the adaptive quality governor, so the
 * IS-Net rung is rarely reached during live playback.
 */

import * as ortModule from 'onnxruntime-web';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import { resetClipDetectionState, resetAllDetectionState } from './humanDetection';
import { stabilizeTemporalAlpha, resetTemporalMaskState } from './temporalMaskEngine';
import { segmentWithRVM, loadRVMSession, resetRVMState, resetAllRVMStates, RVM_EMPTY_COVERAGE } from './rvmMatting';
import {
  pickBracket,
  lerpMatte,
  refineMatte,
  compositeCutout,
  drawMatte,
  isEmptyMatte,
  getLiveTrack,
  peekLiveTrack,
  resetLiveTrack,
  resetAllLiveTracks,
  dropSurfaces,
  clearSurfaces,
  type MatteImage,
} from './matteEngine';

import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';
import type { AiCutoutMode } from '@/types';
// ── MediaPipe Ultra-Fast GPU Selfie Segmenter Engine (Primary) ────────────────
let mediaPipeGeneralSegmenter: any = null;
let mediaPipeLandscapeSegmenter: any = null;

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
  if (modelType === 'landscape' && mediaPipeLandscapeSegmenter) return mediaPipeLandscapeSegmenter;
  if (modelType === 'general' && mediaPipeGeneralSegmenter) return mediaPipeGeneralSegmenter;

  try {
    // Pinned to exact installed version (1.0.1) to avoid breaking on CDN upstream updates
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
    );
    const modelAssetPath = modelType === 'landscape'
      ? 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite'
      : 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

    const createOpts: any = {
      baseOptions: {
        modelAssetPath,
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    };

    // Automatic GPU -> CPU fallback if WebGL context or shader delegate fails
    const segmenter = await ImageSegmenter.createFromOptions(vision, createOpts).catch(async (gpuErr: any) => {
      console.warn('[aiBackground] MediaPipe GPU delegate failed, falling back to CPU delegate:', gpuErr);
      createOpts.baseOptions.delegate = 'CPU';
      return ImageSegmenter.createFromOptions(vision, createOpts);
    });

    if (modelType === 'landscape') mediaPipeLandscapeSegmenter = segmenter;
    else mediaPipeGeneralSegmenter = segmenter;

    return segmenter;
  } catch (err) {
    console.warn('[aiBackground] MediaPipe Segmenter load failed, falling back to @imgly:', err);
    return null;
  }
}

/**
 * Run MediaPipe Selfie Segmenter directly on a Video/Canvas/Image element.
 * Applies Smoothstep Hermite S-Curve for High-Accuracy anti-aliased matte edges.
 */
export async function segmentSourceWithMediaPipe(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  modelType: 'general' | 'landscape' = 'landscape',
  clipId?: string,
  videoTime = 0
): Promise<ImageBitmap | null> {
  const segmenter = await loadMediaPipeSegmenter(modelType);
  if (!segmenter) return null;

  try {
    const result = segmenter.segment(source as any);
    if (!result || !result.confidenceMasks || result.confidenceMasks.length === 0) {
      result?.close();
      return null;
    }

    const confidenceMask = result.confidenceMasks[0];
    let floatArray = confidenceMask.getAsFloat32Array();
    const w = confidenceMask.width;
    const h = confidenceMask.height;

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
    confidenceMask.close();
    result.close();
    return bitmap;
  } catch (err) {
    console.error('[aiBackground] MediaPipe segmentation error:', err);
    return null;
  }
}

// ── ONNX Runtime bootstrap ──────────────────────────────────────────────────
// `proxy = false`: ORT would otherwise spawn its proxy worker from the CDN
// origin, which cannot start under this app's COOP/COEP headers.
if (typeof window !== 'undefined') {
  const ortObj: any = (ortModule as any).default || ortModule;

  // Ensure the module's default export points to itself (ESM interop)
  if (ortObj && !ortObj.default) {
    try { ortObj.default = ortObj; } catch (_e) { /* frozen object */ }
  }
  (window as any).ort = ortObj;

  if (ortObj?.env?.wasm) {
    ortObj.env.wasm.proxy = false;
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

/** Last source-media timestamp each live matte track was sampled at (seek detection). */
const liveTrackTime = new Map<string, number>();
/** `performance.now()` of the last live inference kick-off, per clip (throttle). */
const liveTrackStamp = new Map<string, number>();

// ── Empty-Mask Sentinel ──────────────────────────────────────────────────────
// Marks "analyzed: no subject in this frame". Consumers must show the ORIGINAL
// frame for these keys — never erase pixels. Identified by 1×1 dimensions so it
// survives ImageBitmap cloning/thread transfer (reference equality would not).

export function getEmptyMaskSentinel(): HTMLCanvasElement {
  const s = getPooledCanvas('_empty_mask_sentinel', 1, 1);
  return s as HTMLCanvasElement;
}

function isEmptyMaskMarker(m: ImageBitmap | HTMLCanvasElement): boolean {
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
      bgRemovalModule = await import('@imgly/background-removal');
      const preloadFn = bgRemovalModule.preload ?? (bgRemovalModule as any).default?.preload;
      if (preloadFn) {
        await preloadFn({
          model: 'isnet_fp16',
          publicPath: PUBLIC_PATH,
          // Only honoured when WebGPU is present; harmless otherwise.
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

// ── Segmentation ─────────────────────────────────────────────────────────────

/**
 * Run inference on a Blob. The caller is responsible for capturing the snapshot
 * and converting it to a Blob BEFORE calling this function. This ensures the
 * snapshot is frozen (Blobs are immutable) and immune to canvas overwrite races.
 *
 * This is the slowest rung of the matte ladder and blocks the main thread when
 * WebGPU is unavailable, so it is only reached when RVM and MediaPipe both
 * decline to produce a matte.
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

    const resultBlob = await removeBgFn(inputBlob, {
      model,
      publicPath: PUBLIC_PATH,
      proxyToWorker: true,
      output: { format: 'image/png', quality: 0.8 },
    });

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
export function captureSnapshotBlob(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  maxDimOverride: number = 384
): Promise<{ blob: Blob; w: number; h: number } | null> {
  const maxDim = maxDimOverride;
  const scale = Math.min(1, maxDim / Math.max(targetWidth, targetHeight));
  const inferW = Math.max(64, Math.round(targetWidth * scale));
  const inferH = Math.max(64, Math.round(targetHeight * scale));

  // Key by size: a single shared '_snap_capture' key forced a canvas resize
  // (and therefore a full reallocation + clear) every time two clips with
  // different dimensions took turns.
  const snapCanvas = getPooledCanvas(`_snap_capture_${inferW}x${inferH}`, inferW, inferH);
  const snapCtx = snapCanvas.getContext('2d');
  if (!snapCtx) return Promise.resolve(null);
  snapCtx.clearRect(0, 0, inferW, inferH);
  snapCtx.drawImage(source, 0, 0, inferW, inferH);

  // Freeze the snapshot into an immutable Blob immediately.
  // toBlob is async but fires synchronously from the current canvas state.
  return new Promise<{ blob: Blob; w: number; h: number } | null>((resolve) => {
    (snapCanvas as any).toBlob((blob: any) => {
      if (blob) {
        resolve({ blob, w: inferW, h: inferH });
      } else {
        // Fallback to PNG if JPEG fails
        (snapCanvas as any).toBlob((pngBlob: any) => {
          resolve(pngBlob ? { blob: pngBlob, w: inferW, h: inferH } : null);
        }, 'image/png');
      }
    }, 'image/jpeg', 0.85);
  });
}

// ── Pre-rendered Mask Cache & Analysis Job Engine ────────────────────────────
// For real-time 60 FPS playback without any on-the-fly AI latency, we pre-render
// frame mattes of video clips, keyed by source video timestamp.
//
// KEY GRANULARITY vs. INFERENCE RATE — these are deliberately different things.
// Keys quantise time at MASK_CACHE_FPS so the map stays integer-indexed (the
// export worker transfers it as-is), but we only ever store the frames we
// ACTUALLY inferred. Playback then interpolates between the two surrounding
// keyframes, so a 12 fps matte track still moves smoothly at 60 fps.
//
// The old code did the opposite: it duplicated each matte into `fillRatio`
// neighbouring slots so lookups always hit, which (a) made interpolation
// impossible — the "neighbours" were the same object — and (b) doubled the
// number of ImageBitmaps cloned across to the export worker.

export interface MaskAnalysisStatus {
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  progress: number;
  processedFrames: number;
  totalFrames: number;
}

/** Key quantisation. 30 keys/sec resolves every inference rate we use (8–24 fps). */
const MASK_CACHE_FPS = 30;
export const preRenderedMaskCache = new Map<string, Map<number, ImageBitmap | HTMLCanvasElement>>();
const analysisProgressMap = new Map<string, MaskAnalysisStatus>();
const progressListeners = new Map<string, Set<(status: MaskAnalysisStatus) => void>>();

function timeToKey(time: number): number {
  return Math.round(time * MASK_CACHE_FPS);
}

function keyToTime(key: number): number {
  return key / MASK_CACHE_FPS;
}

// ── Sorted keyframe index (rebuilt lazily when the cache grows) ──────────────
// `preRenderedMaskCache` is a plain Map because the export worker hydrates it
// directly from a structured-clone payload. Interpolation needs ordered access,
// so we memoise a sorted key array per clip and invalidate it on size change.

interface KeyIndex {
  size: number;
  keys: Int32Array;
  times: Float64Array;
}

const keyIndexCache = new Map<string, KeyIndex>();

function getKeyIndex(clipId: string, map: Map<number, ImageBitmap | HTMLCanvasElement>): KeyIndex {
  const cached = keyIndexCache.get(clipId);
  if (cached && cached.size === map.size) return cached;

  const keys = Int32Array.from(map.keys()).sort();
  const times = new Float64Array(keys.length);
  for (let i = 0; i < keys.length; i++) times[i] = keyToTime(keys[i]);

  const index: KeyIndex = { size: map.size, keys, times };
  keyIndexCache.set(clipId, index);
  return index;
}

function invalidateKeyIndex(clipId?: string): void {
  if (clipId) keyIndexCache.delete(clipId);
  else keyIndexCache.clear();
}

/**
 * Largest gap (seconds) we are willing to interpolate across. Beyond this the
 * analysis simply hasn't reached this part of the clip yet, so we report a miss
 * and let the live inference path take over rather than stretching a matte from
 * half a second away across the subject.
 */
const MAX_MATTE_GAP_S = 0.34;

export interface MatteSample {
  /** Ready-to-composite matte, or null when this frame is "analysed, no subject". */
  matte: MatteImage | null;
  /** True when the cache genuinely covers this timestamp. */
  hit: boolean;
}

/**
 * Sample the pre-rendered matte track at `time`, interpolating between the two
 * surrounding keyframes.
 *
 * This replaces the old nearest-neighbour lookup (`key`, then ±1, ±2, ±3) plus
 * its broken "temporal alpha blend", which guessed the keyframe spacing from
 * the model id, derived the blend phase from `time % interval` against an
 * absolute grid, and mixed with `globalAlpha` + `source-over` — not a linear
 * alpha blend, so the matte thinned out mid-transition and the edge pulsed.
 */
export function sampleMatteTrack(clipId: string, time: number): MatteSample {
  const map = preRenderedMaskCache.get(clipId);
  if (!map || map.size === 0 || !(time >= 0)) return { matte: null, hit: false };

  const index = getKeyIndex(clipId, map);
  const bracket = pickBracket(index.times, time);
  if (!bracket) return { matte: null, hit: false };

  const t0 = index.times[bracket.i0];
  const t1 = index.times[bracket.i1];

  // Outside the analysed span (or inside a hole the job hasn't filled yet).
  if (bracket.i0 === bracket.i1) {
    if (Math.abs(time - t0) > MAX_MATTE_GAP_S) return { matte: null, hit: false };
  } else if (t1 - t0 > MAX_MATTE_GAP_S) {
    return { matte: null, hit: false };
  }

  const m0 = map.get(index.keys[bracket.i0]);
  const m1 = map.get(index.keys[bracket.i1]);
  if (!m0) return { matte: null, hit: false };

  const m0Empty = isEmptyMatte(m0);
  const m1Empty = !m1 || isEmptyMatte(m1);

  // Both neighbours say "no subject" → show the original frame untouched.
  if (m0Empty && m1Empty) return { matte: null, hit: true };

  // One side empty: hold the real matte rather than blending against a 1×1
  // sentinel (which would smear the whole frame).
  if (m0Empty) return { matte: m1 as MatteImage, hit: true };
  if (m1Empty || !m1 || m0 === m1 || bracket.w <= 0.002) {
    return { matte: m0 as MatteImage, hit: true };
  }

  return {
    matte: lerpMatte(m0 as MatteImage, m1 as MatteImage, bracket.w, `pre:${clipId}#mix`),
    hit: true,
  };
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
  modelSelection: 0 | 1 | 2 = 1  // Default 1: HD Landscape 16:9 High-Accuracy MediaPipe
): Promise<void> {
  const existing = analysisProgressMap.get(clipId);
  if (existing && existing.status === 'analyzing') {
    return; // Analysis job is already running for this clip
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
    // ── PRIMARY ENGINE: RVM (Robust Video Matting) — CapCut-class quality ──
    // Recurrent temporal memory → hair-level alpha, zero flicker/ghosting.
    // Falls back to MediaPipe / IS-Net when RVM is unavailable (no Float16Array
    // support or model download failure).
    const rvmSession = await loadRVMSession().catch(() => null);
    const rvmReady = rvmSession != null;
    if (!rvmReady) {
      if (modelSelection === 0 || modelSelection === 1) {
        await loadMediaPipeSegmenter(modelSelection === 0 ? 'general' : 'landscape').catch(() => {});
      } else {
        await loadBackgroundRemover().catch(() => {});
      }
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Video load timeout')), 8000);
      video.onloadeddata = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Video failed to load for background analysis'));
      };
      video.src = videoUrl;
    });

    const actualDuration = Math.min(isFinite(video.duration) ? Math.max(0.1, video.duration - startTime) : duration, duration);

    // ── Temporal Keyframe Strategy ─────────────────────────────────────────
    // Keyframes are SPARSE and playback INTERPOLATES between them, so the rate
    // only has to be high enough that linear interpolation tracks the subject —
    // not high enough to look smooth on its own. RVM's recurrent memory keeps
    // consecutive keyframes coherent, which is what makes 12 fps + interpolation
    // read as continuous where 10 fps + hold read as stepping.
    let inferenceFps = rvmReady
      ? 12
      : (modelSelection === 0 || modelSelection === 1)
        ? 20   // MediaPipe GPU is ~5 ms/frame, so sample densely
        : 8;   // IS-Net is the slow path — lean on interpolation instead
    let totalKeyframes = Math.max(1, Math.ceil(actualDuration * inferenceFps));

    // ── Adaptive quality governor ──────────────────────────────────────────
    // Matte resolution is the single biggest lever on edge quality, but it is
    // also the biggest lever on how long the user stares at a progress bar, and
    // the spread between a WebGPU laptop and a mid-range phone is ~10×. Start
    // optimistic, measure the first few keyframes, and downshift once if the
    // device can't keep up. Never upshift — oscillating the tier would reset
    // RVM's recurrent state (infW/infH change) and undo its temporal coherence.
    let rvmTier = modelSelection === 2 ? 768 : modelSelection === 1 ? 768 : 512;
    let governorApplied = false;
    let measuredMs = 0;
    let measuredCount = 0;
    const SLOW_FRAME_MS = 320;
    const GOVERNOR_SAMPLE = 4;

    if (!preRenderedMaskCache.has(clipId)) {
      preRenderedMaskCache.set(clipId, new Map());
    }
    const maskMap = preRenderedMaskCache.get(clipId)!;
    invalidateKeyIndex(clipId);

    let processed = 0;

    // Walk an explicit time cursor rather than `startTime + i / fps`: the
    // governor can change `inferenceFps` mid-run, and an index-derived time
    // would then jump forwards and tear a hole in the matte track.
    const endTime = startTime + actualDuration;
    let cursor = startTime;

    for (let guard = 0; cursor <= endTime && guard < 20000; guard++, cursor += 1 / inferenceFps) {
      // Abort gracefully if job was cancelled or clip state cleaned up
      if (analysisProgressMap.get(clipId)?.status !== 'analyzing') break;

      const targetTime = cursor;
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

      // Seek to keyframe timestamp
      await new Promise<void>((resolve) => {
        video.currentTime = targetTime;
        let fallback: any;
        const onSeek = () => {
          clearTimeout(fallback);
          video.removeEventListener('seeked', onSeek);
          resolve();
        };
        video.addEventListener('seeked', onSeek);
        fallback = setTimeout(() => {
          video.removeEventListener('seeked', onSeek);
          resolve();
        }, 1500);
      });

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      const frameStartedAt = performance.now();

      let bitmap: ImageBitmap | HTMLCanvasElement | null = null;
      let noSubject = false;

      if (rvmReady) {
        // ── PRIMARY: CapCut-grade RVM matting with recurrent temporal memory ──
        // No skin-heuristic gating: RVM handles empty scenes gracefully
        // (near-zero alpha), so gating would only introduce mask holes.
        const res = await segmentWithRVM(video, clipId, targetTime - startTime, rvmTier).catch(() => null);
        if (res && res.coverage >= RVM_EMPTY_COVERAGE) {
          bitmap = res.bitmap;
        } else if (res) {
          // RVM (person-focused) sees no subject — could be an object clip.
          // Try the general-purpose IS-Net model for this keyframe.
          const maxDim = modelSelection === 2 ? 768 : 512;
          const snap = await captureSnapshotBlob(video, w, h, maxDim);
          if (snap) {
            bitmap = await segmentBlobToImageBitmap(snap.blob, 'isnet_fp16');
          }
          if (!bitmap) noSubject = true;
        } else {
          // RVM failed this frame — treat as empty (never erase the frame)
          noSubject = true;
        }
      } else {
        // ── FALLBACK (no RVM): MediaPipe / IS-Net legacy pipeline ──
        // NOTE: skin-tone human gating was REMOVED here — it skipped keyframes
        // on non-skin subjects (pets, products, dark scenes), leaving mask
        // holes that flickered during playback.
        if (modelSelection === 0 || modelSelection === 1) {
          const mpType = modelSelection === 0 ? 'general' : 'landscape';
          // Pass clipId + clip-local time: without them `stabilizeTemporalAlpha`
          // is skipped entirely and consecutive keyframes jitter against each
          // other, which interpolation then faithfully reproduces.
          bitmap = await segmentSourceWithMediaPipe(video, mpType, clipId, targetTime - startTime);
        }

        if (!bitmap && modelSelection === 2) {
          const maxDim = 768;
          const snap = await captureSnapshotBlob(video, w, h, maxDim);
          if (snap) {
            bitmap = await segmentBlobToImageBitmap(snap.blob, 'isnet_fp16');
          }
        }
        if (!bitmap) noSubject = true;
      }

      // Store ONLY the real keyframe. Playback interpolates across the gaps
      // (see sampleMatteTrack) — duplicating the matte into neighbouring slots,
      // as the old code did, made every "neighbour" identical and so defeated
      // interpolation entirely. For no-subject frames, store the empty sentinel
      // so consumers show the ORIGINAL frame instead of erasing pixels.
      const fillValue = noSubject ? getEmptyMaskSentinel() : bitmap;
      if (fillValue) {
        maskMap.set(keyframeKey, fillValue);
        invalidateKeyIndex(clipId);
      }

      // Governor: sample the first few keyframes, then downshift once if this
      // device is too slow for the optimistic tier.
      if (!governorApplied && rvmReady) {
        measuredMs += performance.now() - frameStartedAt;
        measuredCount++;
        if (measuredCount >= GOVERNOR_SAMPLE) {
          governorApplied = true;
          const avg = measuredMs / measuredCount;
          if (avg > SLOW_FRAME_MS && rvmTier > 512) {
            rvmTier = 512;
            inferenceFps = 10;
            totalKeyframes = Math.max(processed + 1, Math.ceil(actualDuration * inferenceFps));
            console.info(
              `[aiBackground] Matte governor: ${avg | 0}ms/frame — dropping to 512px @ ${inferenceFps}fps`,
            );
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
      notifyMaskReady(); // Repaint preview if paused on this frame

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
  if (sourceElement && typeof sourceElement.currentTime === 'number') {
    return sourceElement.currentTime;
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
    const c = getPooledCanvas(`_cov_measure_${w}x${h}`, w, h);
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
 *
 * Thin wrapper kept for backward compatibility — the work now happens in
 * `matteEngine.refineMatte`, which is *dramatically* cheaper.
 *
 * The previous implementation ran at DESTINATION resolution and did a
 * `getImageData` → JS loop → `putImageData` round-trip whenever `choke !== 0`.
 * Because the stock cutout preset ships `choke: -1`, that fired on literally
 * every rendered frame: ~2 million pixels read back from the GPU, mutated in
 * JavaScript and uploaded again, 30–60 times a second. It alone blew the frame
 * budget and is a large part of why the cutout stuttered.
 *
 * `refineMatte` instead works at a capped work resolution and expresses choke
 * as GPU alpha-power passes (`destination-in` ⇒ aⁿ to erode, `source-over` ⇒
 * 1−(1−a)ⁿ to dilate), so there is no readback at all.
 */
export function refineMaskEdges(
  maskCanvas: HTMLCanvasElement | OffscreenCanvas | ImageBitmap,
  width: number,
  height: number,
  choke: number = 0,
  feather: number = 0,
  poolKey: string = 'mask_refine'
): any {
  return refineMatte(maskCanvas as MatteImage, {
    choke,
    feather,
    destWidth: width,
    destHeight: height,
    poolKey: `refine:${poolKey}`,
  });
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
}

export function applyPreRenderedMaskIfAvailable(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  clipId: string,
  _isPlaying: boolean,
  _modelSelection: number = 1,
  choke: number = 0,
  feather: number = 0,
  spillSuppression: number = 0,
  spillColor?: string,
  extraOptions?: AiCutoutCompositeOptions
): boolean {
  const currentVideoTime = getVideoCurrentTime(sourceElement);
  if (currentVideoTime < 0) return false;

  // Interpolated sample of the pre-rendered matte track. Note this no longer
  // depends on `isPlaying` or `modelSelection`: interpolation is just as
  // important while paused or scrubbing (where the old code snapped to the
  // nearest keyframe), and the keyframe spacing is now read from the cache
  // instead of being guessed from the model id.
  const sample = sampleMatteTrack(clipId, currentVideoTime);
  if (!sample.hit) return false;

  // Analysed, but there is no subject in this frame → leave the frame alone.
  if (!sample.matte) return true;

  const refined = refineMatte(sample.matte, {
    choke,
    feather,
    destWidth: width,
    destHeight: height,
    poolKey: `pre:${clipId}`,
  });

  compositeCutout(
    ctx,
    width,
    height,
    sourceElement as CanvasImageSource,
    refined,
    extraOptions,
    `pre:${clipId}`,
    spillSuppression > 0
      ? (target, w, h) => applySpillSuppression(target, w, h, spillSuppression, spillColor)
      : undefined
  );
  return true;
}

/**
 * Live (non-pre-rendered) AI cutout.
 *
 * Interactive (isPlaying=true): fire-and-forget async segmentation. The render
 *   loop NEVER waits for inference — it samples the clip's `LiveMatteTrack` and
 *   moves on. When a fresh matte lands, `notifyMaskReady()` triggers a repaint.
 *
 * Export / paused (isPlaying=false): awaits a frame-accurate matte.
 *
 * ── What changed and why ─────────────────────────────────────────────────────
 * The old version cached a single matte and swapped it the instant inference
 * finished. Between two inferences (250–700 ms apart) the subject has moved
 * several pixels, so the silhouette visibly jumped every time. Mattes now go
 * through `LiveMatteTrack`, which cross-fades over ~110 ms, and an "empty
 * frame" result dissolves the cutout instead of snapping the background back on.
 */
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
  options: {
    choke?: number;
    feather?: number;
    spillSuppression?: number;
    spillColor?: string;
    style?: AiCutoutCompositeOptions;
  } = {}
): Promise<void> {
  try {
    const currentVideoTime = getVideoCurrentTime(sourceElement);
    const choke = options.choke ?? 0;
    const feather = (options.feather ?? 0) > 0 ? options.feather! : edgeBlur;
    const spillSuppression = options.spillSuppression ?? 0;
    const spillColor = options.spillColor;
    const style = options.style;

    // ── STEP 1: interpolated pre-rendered matte track (O(log n) + one GPU mix) ──
    if (applyPreRenderedMaskIfAvailable(
      ctx, width, height, sourceElement, clipId, isPlaying, modelSelection,
      choke, feather, spillSuppression, spillColor, style,
    )) {
      return;
    }

    const track = getLiveTrack(clipId);

    // Seeking backwards or jumping more than a few frames invalidates the
    // cross-fade history — otherwise we would ease from a matte belonging to a
    // completely different part of the clip.
    const lastTime = liveTrackTime.get(clipId);
    if (lastTime !== undefined && currentVideoTime >= 0 &&
        (currentVideoTime < lastTime - 0.05 || currentVideoTime - lastTime > 0.5)) {
      track.reset();
      resetRVMState(clipId);
    }
    if (currentVideoTime >= 0) liveTrackTime.set(clipId, currentVideoTime);

    const updateIntervalMs = playbackQuality === 'performance' ? 260
                           : playbackQuality === 'full' ? 90
                           : 150;

    if (isPlaying) {
      // ── INTERACTIVE: non-blocking fire-and-forget ──
      const lastRun = liveTrackStamp.get(clipId) ?? 0;
      const elapsed = performance.now() - lastRun;
      const shouldRefresh = !track.hasMatte || elapsed > updateIntervalMs;

      if (shouldRefresh && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);
        liveTrackStamp.set(clipId, performance.now());

        const analysisActive = getClipAnalysisStatus(clipId).status === 'analyzing';

        void (async () => {
          try {
            // PRIMARY: RVM with recurrent temporal memory. Skipped while the
            // pre-analysis job runs — it walks keyframes sequentially through
            // the same per-clip recurrent state.
            if (!analysisActive) {
              const res = await segmentWithRVM(sourceElement as any, clipId, currentVideoTime, 512)
                .catch(() => null);
              if (res) {
                if (res.coverage < RVM_EMPTY_COVERAGE) {
                  res.bitmap.close();
                  track.pushOpaque();   // dissolve, don't snap
                } else {
                  track.push(res.bitmap);
                  res.bitmap.close();
                }
                notifyMaskReady();
                return;
              }
            }

            // FALLBACK: MediaPipe GPU → IS-Net snapshot
            if (modelSelection === 0 || modelSelection === 1) {
              const mpBitmap = await segmentSourceWithMediaPipe(
                sourceElement as any,
                modelSelection === 0 ? 'general' : 'landscape',
                clipId,
                currentVideoTime,
              );
              if (mpBitmap) {
                track.push(mpBitmap);
                mpBitmap.close();
                notifyMaskReady();
                return;
              }
            }

            const snap = await captureSnapshotBlob(sourceElement, width, height, 512);
            if (!snap) return;
            const isnet = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
            if (isnet) {
              track.push(isnet);
              notifyMaskReady();
            }
          } catch (err) {
            console.warn('[aiBackground] Playback segmentation error:', err);
          } finally {
            segmentingInFlight.delete(clipId);
          }
        })();
      }
      // Fall through — composite whatever the track currently holds.

    } else {
      // ── EXPORT / PAUSED: await a frame-accurate matte ──
      const lastTime2 = liveTrackTime.get(clipId);
      const needsFresh = !track.hasMatte ||
        lastTime2 === undefined ||
        Math.abs(currentVideoTime - lastTime2) > 0.04;

      if (needsFresh) {
        let matte: MatteImage | null = null;
        let empty = false;

        const rvmRes = await segmentWithRVM(
          sourceElement as any, clipId, currentVideoTime, modelSelection === 2 ? 1024 : 768,
        ).catch(() => null);
        if (rvmRes) {
          if (rvmRes.coverage >= RVM_EMPTY_COVERAGE) matte = rvmRes.bitmap;
          else { rvmRes.bitmap.close(); empty = true; }
        }

        if (!matte && !empty && (modelSelection === 0 || modelSelection === 1)) {
          const mpType = modelSelection === 0 ? 'general' : 'landscape';
          const mpBitmap = await segmentSourceWithMediaPipe(sourceElement as any, mpType, clipId, currentVideoTime);
          if (mpBitmap) matte = mpBitmap;
        }

        if (!matte && !empty) {
          const maxDim = modelSelection === 2 ? 1024 : 640;
          const snap = await captureSnapshotBlob(sourceElement, width, height, maxDim);
          if (snap) {
            const result = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
            if (result) matte = result;
          }
        }

        if (matte) {
          track.push(matte);
          if ('close' in matte && typeof (matte as any).close === 'function') (matte as any).close();
        } else if (empty) {
          track.pushOpaque();
        }
      }
    }

    // ── Composite the current (cross-faded) matte ──
    // `sample()` returns null once an "empty frame" has fully dissolved, which
    // is the signal to leave the frame untouched rather than erase it.
    const live = track.sample();
    if (!live) return;

    const refined = refineMatte(live, {
      choke,
      feather,
      destWidth: width,
      destHeight: height,
      poolKey: `livefx:${clipId}`,
    });

    compositeCutout(
      ctx,
      width,
      height,
      sourceElement as CanvasImageSource,
      refined,
      style,
      `livefx:${clipId}`,
      spillSuppression > 0
        ? (target, w, h) => applySpillSuppression(target, w, h, spillSuppression, spillColor)
        : undefined,
    );
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
  clearSurfaces();
  resetAllLiveTracks();
  liveTrackTime.clear();
  liveTrackStamp.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
  for (const map of preRenderedMaskCache.values()) {
    closeMapTextures(map);
  }
  preRenderedMaskCache.clear();
  invalidateKeyIndex();
  analysisProgressMap.clear();
}

export function cleanupClipBackgroundState(clipId: string): void {
  for (const key of canvasPool.keys()) {
    if (key.startsWith(clipId)) canvasPool.delete(key);
  }
  dropSurfaces(`pre:${clipId}`);
  dropSurfaces(`refine:${clipId}`);
  invalidateClipMatteContinuity(clipId);
  maskCacheMap.delete(clipId);
  segmentingInFlight.delete(clipId);

  const preMap = preRenderedMaskCache.get(clipId);
  if (preMap) {
    closeMapTextures(preMap);
    preRenderedMaskCache.delete(clipId);
  }
  invalidateKeyIndex(clipId);
  updateClipAnalysisStatus(clipId, { status: 'idle', progress: 0, processedFrames: 0, totalFrames: 0 });
  resetClipDetectionState(clipId);
}

/**
 * Drop cached mattes for a clip WITHOUT cancelling its analysis job.
 * Used when the user seeks, so the live cross-fade doesn't ease from a matte
 * belonging to a completely different moment in the clip.
 */
export function invalidateClipMatteContinuity(clipId: string): void {
  // Cross-fade history, and the timestamp it is anchored to.
  resetLiveTrack(clipId);
  liveTrackTime.delete(clipId);
  liveTrackStamp.delete(clipId);
  // RVM is recurrent: its hidden state encodes "what the previous frame looked
  // like". Carrying that across a seek smears the old silhouette into the new
  // one for several frames.
  resetRVMState(clipId);
  // Per-pixel EMA used by the MediaPipe rung.
  resetTemporalMaskState(clipId);
  // Refined-edge scratch, so the next frame cannot blend against stale alpha.
  dropSurfaces(`smart:${clipId}`);
  dropSurfaces(`livefx:${clipId}`);
}

export function cleanupAllBackgroundState(): void {
  canvasPool.clear();
  clearSurfaces();
  resetAllLiveTracks();
  liveTrackTime.clear();
  liveTrackStamp.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
  for (const map of preRenderedMaskCache.values()) {
    closeMapTextures(map);
  }
  preRenderedMaskCache.clear();
  invalidateKeyIndex();
  analysisProgressMap.clear();
  resetAllDetectionState();
  resetAllRVMStates();
}

export const cleanupAllAIResources = cleanupAllBackgroundState;