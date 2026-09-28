/**
 * aiBackgroundIntegrated.ts
 *
 * Connects humanDetection.ts with aiBackground.ts for maximum accuracy.
 *
 * Integration points:
 *   1. Early-exit: No human → skip all AI, return transparent or fade out mask
 *   2. Scene-change gating: Stable scene + valid cache → reuse mask
 *   3. Smart ROI: Crop to human region, run ONNX at higher effective resolution
 *   4. Model auto-select: Wide bbox → MediaPipe landscape, tall bbox → general
 *   5. Temporal coherence: Smoothed bbox prevents crop-window jitter
 *   6. Pre-rendered cache & professional edge refinement: Full Choke, Feather, Spill Suppression support
 */

// ── Direct Live Mask Cache (Decoupled from humanDetection heuristics) ──
interface CachedMaskEntry {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  timestamp: number;
}
const liveMaskMap = new Map<string, CachedMaskEntry>();

export function getCachedMaskCanvas(clipId: string, _width?: number, _height?: number): HTMLCanvasElement | null {
  const entry = liveMaskMap.get(clipId);
  if (!entry) return null;
  return entry.canvas;
}

export function cacheMaskCanvas(clipId: string, mask: HTMLCanvasElement | null): void {
  if (!mask) {
    liveMaskMap.delete(clipId);
    return;
  }
  liveMaskMap.set(clipId, {
    canvas: mask,
    width: mask.width,
    height: mask.height,
    timestamp: performance.now(),
  });
}

export function invalidateMaskCache(clipId?: string): void {
  if (clipId) {
    liveMaskMap.delete(clipId);
  } else {
    liveMaskMap.clear();
  }
}

export function markInferencePerformed(_clipId: string): void {
  // Decoupled from heuristic counters
}

import {
  segmentSourceWithMediaPipe,
  segmentBlob,
  captureSnapshotBlob,
  loadBackgroundRemover,
  notifyMaskReady,
  setOnMaskReadyCallback,
  cleanupAiBackgroundResources,
  cleanupClipBackgroundState,
  startClipBackgroundAnalysis,
  subscribeClipBackgroundAnalysis,
  getClipAnalysisStatus,
  applyPreRenderedMaskIfAvailable,
  preRenderedMaskCache,
  applySpillSuppression,
  refineMaskEdges,
  getPooledCanvas,
  applySubjectNeonOutlineFlash,
  ensureClipMasksReady,
  measureMaskCoverage,
  MaskAnalysisStatus,
  getEmptyMaskSentinel,
  isEmptyMaskMarker,
} from './aiBackground';

import {
  segmentWithRVM,
  loadRVMSession,
  RVM_EMPTY_COVERAGE,
} from './rvmMatting';

// ─── Smart Orchestrator ─────────────────────────────────────────────────────

import type { AiCutoutMode } from '@/types';

export interface IntegrationOptions {
  /** User-selected quality */
  playbackQuality: 'full' | 'balanced' | 'performance';
  /** Is timeline playing? If false, we await for frame-accurate mask */
  isPlaying: boolean;
  /** Edge blur amount */
  edgeBlur: number;
  /** 0 = auto (detect), 1 = general, 2 = landscape, 3 = HD Landscape */
  modelSelection: 0 | 1 | 2 | 3;
  /** Force ROI cropping for ONNX fallback (recommended) */
  useROI: boolean;
  /** Min skin ratio to trigger human detection (default 0.008) */
  skinThreshold: number;
  /** Choke (shrink/expand matte edges) */
  choke: number;
  /** Feather (Gaussian edge blur) */
  feather: number;
  /** Spill Suppression percentage */
  spillSuppression: number;
  /** Target background color to suppress (e.g. green/blue screen hex) */
  spillColor?: string;
  /** Cutout Mode: remove (transparent), blur, outline, color */
  mode?: AiCutoutMode;
  blurStrength?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeGlow?: boolean;
  bgColor?: string;
  isExporting?: boolean;
}

const DEFAULT_OPTS: IntegrationOptions = {
  playbackQuality: 'balanced',
  isPlaying: true,
  edgeBlur: 0,
  modelSelection: 0,
  useROI: true,
  skinThreshold: 0.008,
  choke: 0,
  feather: 0,
  spillSuppression: 0,
  mode: 'remove',
  blurStrength: 12,
  strokeColor: '#ffffff',
  strokeWidth: 4,
  strokeGlow: false,
  bgColor: '#1e1e24',
  isExporting: false,
};

/**
 * Apply AI background removal with human-detection intelligence.
 *
 * PERFORMANCE PATH (isPlaying = true):
 *   1. Check human presence (< 1ms)
 *   2. If no human → composite cached mask or skip
 *   3. If human + no scene change + valid cache → reuse cached mask
 *   4. If human + scene change → fire async segmentation (MediaPipe → ONNX ROI)
 *   5. Always composite last valid mask immediately (never wait)
 *
 * EXPORT PATH (isPlaying = false):
 *   1. Run full pipeline synchronously for frame-accurate result
 *   2. Use ROI + full IS-Net for maximum quality
 */
export async function applyAiBackgroundSmart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  clipId: string,
  opts: Partial<IntegrationOptions> = {}
): Promise<void> {
  const options = { ...DEFAULT_OPTS, ...opts };
  const sourceW = width;
  const sourceH = height;

  try {
    const choke = options.choke || 0;
    const feather = (options.feather || 0) > 0 ? options.feather : options.edgeBlur;

    // ── STEP 0: Check Pre-Rendered Temporal Cache ────────────────────────
    if (
      applyPreRenderedMaskIfAvailable(
        ctx,
        width,
        height,
        sourceElement,
        clipId,
        options.isPlaying,
        options.modelSelection,
        choke,
        feather,
        options.spillSuppression,
        options.spillColor,
        {
          mode: options.mode,
          blurStrength: options.blurStrength,
          strokeColor: options.strokeColor,
          strokeWidth: options.strokeWidth,
          strokeGlow: options.strokeGlow,
          bgColor: options.bgColor,
          isExporting: options.isExporting ?? false,
        }
      )
    ) {
      return;
    }



    // ── STEP 1: Determine Model Selection ─────────────────────────────────
    const chosenModel: 'general' | 'landscape' =
      (options.modelSelection === 0 || options.modelSelection === 1 || options.modelSelection === 2 || options.modelSelection === 3)
        ? 'landscape'
        : 'general';

    // ── STEP 2: Segmentation Execution ────────────────────────────────────
    if (options.isPlaying) {
      // PLAYBACK (Interactive):
      // Composite whatever we have cached immediately (never drops frames / never blocks 60 FPS)
      const cached = getCachedMaskCanvas(clipId, width, height);
      if (cached && !isEmptyMaskMarker(cached)) {
        compositeMask(ctx, sourceElement, cached, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId, options);
      }

      // Fire async inference on current frame (RVM achieves near-realtime and gives CapCut-like perfect quality)
      runSegmentationAsync(
        sourceElement,
        sourceW,
        sourceH,
        clipId,
        chosenModel,
        true, // Allow MediaPipe fallback if WebGPU/WASM RVM fails to load
        width,
        height
      );

      // We intentionally do NOT await runSegmentationSync here for the first frame.
      // Awaiting it would freeze video playback if the AI model needs to be downloaded
      // (like the 170MB IS-Net model) or if inference is slow. Instead, the async
      // segmentation started above will eventually populate the cache, and the mask
      // will magically pop in a few frames later.
    } else {
      // PAUSED / SCRUBBING / EXPORT:
      // Await synchronous high-quality mask directly from GPU
      const mask = await runSegmentationSync(
        sourceElement,
        sourceW,
        sourceH,
        clipId,
        chosenModel,
        true, // MediaPipe is the reliable browser fallback, including Studio mode
        width,
        height
      );
      if (mask) {
        cacheMaskCanvas(clipId, mask);
        if (!isEmptyMaskMarker(mask)) {
          compositeMask(ctx, sourceElement, mask, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId, options);
        }
      }
    }
  } catch (err) {
    console.error('[aiBackgroundIntegrated] Smart mask error:', err);
    // Fail-open: draw nothing (show original frame)
  }
}

// ─── Async Segmentation (Interactive Playback) ──────────────────────────────

async function runSegmentationAsync(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  sourceW: number,
  sourceH: number,
  clipId: string,
  modelType: 'general' | 'landscape',
  tryMediaPipe: boolean,
  targetW: number,
  targetH: number
): Promise<void> {
  // Prevent overlapping inference jobs
  const flightKey = `${clipId}_segment`;
  if ((window as any)[flightKey]) return;
  (window as any)[flightKey] = true;

  try {
    let maskCanvas: any = null;

    const videoTime = source && 'currentTime' in source ? (source as any).currentTime : 0;
    const isVideo = ('videoWidth' in source && (source as HTMLVideoElement).videoWidth > 0) || videoTime > 0;

    // Try MediaPipe first. RVM's model can load successfully but still fail at
    // session.run on browsers whose WebGPU/WebGL provider lacks AveragePool ceil
    // support; waiting for that failure made Cutout stall before the usable GPU
    // segmenter was reached.
    if (tryMediaPipe) {
      const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType, clipId, videoTime).catch(() => null);
      if (mpBitmap) {
        maskCanvas = getPooledCanvas(`${clipId}_async_mp`, targetW, targetH);
        const mCtx = maskCanvas.getContext('2d');
        mCtx?.drawImage(mpBitmap, 0, 0, targetW, targetH);
        mpBitmap.close();
      }
    }

    // RVM is retained as a fallback for environments where MediaPipe is unavailable.
    // RVM is currently incompatible with the browser ONNX execution provider
    // (AveragePool ceil shape error). Do not even initialise it here: doing so
    // blocks the usable MediaPipe path and leaves the preview at 1%.
    const rvmSession = null;
    if (!maskCanvas && rvmSession && isVideo) {
      const rvmRes = await segmentWithRVM(source as any, clipId, videoTime, 512).catch(() => null);
      if (rvmRes && rvmRes.coverage >= RVM_EMPTY_COVERAGE) {
        maskCanvas = getPooledCanvas(`${clipId}_async_rvm`, targetW, targetH);
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.clearRect(0, 0, targetW, targetH);
          mCtx.drawImage(rvmRes.bitmap, 0, 0, targetW, targetH);
        }
        rvmRes.bitmap.close();
      }
    }

    // Try 1: MediaPipe GPU on full frame (ultra-fast ~5ms, zero network lag fallback)
    if (!maskCanvas && tryMediaPipe) {
      const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType, clipId, videoTime);
      if (mpBitmap) {
        const bufKey = `${clipId}_async_idx`;
        const bufIdx = ((window as any)[bufKey] || 0) ^ 1;
        (window as any)[bufKey] = bufIdx;
        maskCanvas = getPooledCanvas(`${clipId}_async_mp_${bufIdx}`, targetW, targetH);
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.clearRect(0, 0, targetW, targetH);
          mCtx.drawImage(mpBitmap, 0, 0, targetW, targetH);
        }
        mpBitmap.close();
      }
    }

    // Try 2: ONNX full frame fallback
    if (!maskCanvas) {
      try {
        const snap = await captureSnapshotBlob(source, sourceW, sourceH, 512);
        if (snap) {
          maskCanvas = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
        }
      } catch (err) {
        console.warn('[aiBackgroundIntegrated] ONNX fallback failed:', err);
      }
    }

    // If inference fails, leave the original video untouched. Caching an empty
    // sentinel here caused the compositor to apply destination-in and turn the
    // entire preview blank.
    if (maskCanvas && (await measureMaskCoverage(maskCanvas)) >= RVM_EMPTY_COVERAGE) {
      cacheMaskCanvas(clipId, maskCanvas);
      notifyMaskReady();
    }
  } catch (err) {
    console.warn('[aiBackgroundIntegrated] Async segmentation failed:', err);
    // Fail open: keep the original frame visible and allow a later retry.
    // Do not cache an empty mask; destination-in with an empty mask blanks video.
    notifyMaskReady();
  } finally {
    (window as any)[flightKey] = false;
  }
}

// ─── Sync Segmentation (Export / Paused) ────────────────────────────────────

async function runSegmentationSync(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  sourceW: number,
  sourceH: number,
  clipId: string,
  modelType: 'general' | 'landscape',
  tryMediaPipe: boolean,
  targetW: number,
  targetH: number
): Promise<HTMLCanvasElement | null> {
  let maskCanvas: HTMLCanvasElement | null = null;

  const videoTime = (source as any).currentTime || 0;
  const isVideo = ('videoWidth' in source && (source as HTMLVideoElement).videoWidth > 0) || videoTime > 0;

  // Try 0: RVM (CapCut-grade recurrent memory matting at high resolution)
  // RVM is disabled until its AveragePool/WebGPU incompatibility is resolved.
  // MediaPipe is the reliable browser path and must run without waiting for RVM.
  const rvmSession = null;
  if (rvmSession && isVideo) {
    const rvmRes = await segmentWithRVM(source as any, clipId, videoTime, targetW >= 768 ? 768 : 512).catch(() => null);
    if (rvmRes && rvmRes.coverage >= RVM_EMPTY_COVERAGE) {
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = targetW;
      maskCanvas.height = targetH;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        mCtx.clearRect(0, 0, targetW, targetH);
        mCtx.drawImage(rvmRes.bitmap, 0, 0, targetW, targetH);
      }
      rvmRes.bitmap.close();
    }
  }

  // Try 1: MediaPipe GPU (instant ~5ms fallback)
  if (!maskCanvas && tryMediaPipe) {
    const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType, clipId, videoTime);
    if (mpBitmap) {
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = targetW;
      maskCanvas.height = targetH;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        mCtx.clearRect(0, 0, targetW, targetH);
        mCtx.drawImage(mpBitmap, 0, 0, targetW, targetH);
      }
      mpBitmap.close();
    }
  }

  // Try 2: ONNX full frame fallback
  if (!maskCanvas) {
    try {
      const snap = await captureSnapshotBlob(source, sourceW, sourceH, 512);
      if (snap) {
        maskCanvas = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet');
      }
    } catch (err) {
      console.warn('[aiBackgroundIntegrated] ONNX sync fallback failed:', err);
    }
  }

  // Fail open: no mask means keep rendering the original video. Never return
  // an empty sentinel to the compositor because destination-in would blank it.
  if (!maskCanvas || (await measureMaskCoverage(maskCanvas)) < RVM_EMPTY_COVERAGE) {
    return null;
  }

  if (maskCanvas) {
    cacheMaskCanvas(clipId, maskCanvas);
  }

  return maskCanvas;
}

// ─── Mask Compositing ───────────────────────────────────────────────────────

function compositeMask(
  ctx: CanvasRenderingContext2D,
  sourceElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  maskCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  choke: number,
  feather: number,
  spillSuppression: number,
  spillColor?: string,
  clipId: string = '_smart',
  cutoutOptions?: IntegrationOptions
): void {
  // PERF: refine at the MASK's native resolution, not the full display canvas —
  // same result after compositing's bilinear upscale, 10x fewer pixels scanned.
  const maskW = (maskCanvas as any)?.width || width;
  const maskH = (maskCanvas as any)?.height || height;
  const refinedMask = (choke !== 0 || feather > 0)
    ? refineMaskEdges(maskCanvas, maskW, maskH, choke, feather, `${clipId}_smart`)
    : maskCanvas;

  const mode = cutoutOptions?.mode || 'remove';

  if (mode === 'blur') {
    // ── Mode: Portrait Background Blur (DSLR Bokeh) ──
    const fgCanvas = getPooledCanvas(`${clipId}_smart_fg`, width, height);
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
      const blurPx = Math.max(1, cutoutOptions?.blurStrength ?? 12);
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(sourceElement as any, 0, 0, width, height);
      ctx.restore();

      ctx.drawImage(fgCanvas, 0, 0, width, height);
    }
  } else if (mode === 'color') {
    // ── Mode: Studio / Solid Color Backdrop ──
    const fgCanvas = getPooledCanvas(`${clipId}_smart_fg`, width, height);
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
      ctx.fillStyle = cutoutOptions?.bgColor || '#1e1e24';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(fgCanvas, 0, 0, width, height);
    }
  } else if (mode === 'outline') {
    // ── Mode: Sticker / Neon Outline (Shorts / Reels) ──
    const fgCanvas = getPooledCanvas(`${clipId}_smart_fg`, width, height);
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

      const strokeW = Math.max(1, cutoutOptions?.strokeWidth ?? 4);
      const strokeCol = cutoutOptions?.strokeColor ?? '#ffffff';
      const strokeCanvas = getPooledCanvas(`${clipId}_smart_stroke`, width, height);
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
      if (cutoutOptions?.strokeGlow) {
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
}

// ─── Re-exports for backward compatibility & full AI feature access ─────────

export {
  setOnMaskReadyCallback,
  notifyMaskReady,
  loadBackgroundRemover,
  startClipBackgroundAnalysis,
  subscribeClipBackgroundAnalysis,
  getClipAnalysisStatus,
  ensureClipMasksReady,
  cleanupAiBackgroundResources,
  cleanupClipBackgroundState,
  applySubjectNeonOutlineFlash,
};

export type { MaskAnalysisStatus };
