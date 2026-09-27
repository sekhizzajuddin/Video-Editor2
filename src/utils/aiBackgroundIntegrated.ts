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

import {
  detectHumanPresence,
  computeROICrop,
  detectSceneChange,
  shouldDetectSceneChange,
  shouldUseCachedMask,
  mustForceResegment,
  getCachedMaskCanvas,
  cacheMaskCanvas,
  markInferencePerformed,
  invalidateMaskCache,
} from './humanDetection';

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
  applySpillSuppression,
  refineMaskEdges,
  getPooledCanvas,
  applySubjectNeonOutlineFlash,
  ensureClipMasksReady,
  measureMaskCoverage,
  MaskAnalysisStatus,
} from './aiBackground';

import {
  segmentWithRVM,
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
        }
      )
    ) {
      return;
    }

    // ── STEP 1: Human Presence Check (Used as ROI hint, never as a hard gatekeeper) ──
    const human = detectHumanPresence(sourceElement, clipId, options.skinThreshold);

    // ── STEP 2: Scene Change & Cache Validity ────────────────────────────
    let sceneChanged = false;
    if (shouldDetectSceneChange(clipId, options.isPlaying ? 12 : 6)) {
      sceneChanged = detectSceneChange(clipId, sourceElement, 0.12);
    }

    const cacheValid = shouldUseCachedMask(clipId, options.playbackQuality);
    const forceStale = mustForceResegment(clipId, options.playbackQuality);

    if (!sceneChanged && cacheValid && !forceStale) {
      const cached = getCachedMaskCanvas(clipId, width, height);
      if (cached) {
        compositeMask(ctx, sourceElement, cached, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId, options);
        return;
      }
    }

    // ── STEP 3: Determine Best Model from Bbox ───────────────────────────
    let chosenModel: 'general' | 'landscape' = 'general';
    let useMediaPipe = true;

    if (human.bbox && options.modelSelection === 0) {
      // Auto-select: if bbox is wider than tall, use landscape model
      const bboxAspect = human.bbox.w / human.bbox.h;
      if (bboxAspect > 1.3) {
        chosenModel = 'landscape';
      }
    } else if (options.modelSelection === 2 || options.modelSelection === 3) {
      chosenModel = 'landscape';
    }

    // MediaPipe GPU is always allowed as high-speed 5ms fallback (prevents export timeouts)
    useMediaPipe = true;

    // ── STEP 4: Segmentation ─────────────────────────────────────────────
    if (options.isPlaying) {
      // INTERACTIVE: Fire-and-forget async
      runSegmentationAsync(
        sourceElement,
        sourceW,
        sourceH,
        clipId,
        human,
        chosenModel,
        useMediaPipe,
        options.useROI,
        width,
        height
      );
      // Composite whatever we have cached (might be stale — that's OK)
      const cached = getCachedMaskCanvas(clipId, width, height);
      if (cached) {
        compositeMask(ctx, sourceElement, cached, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId, options);
      }
    } else {
      // EXPORT / PAUSED: Await synchronous high-quality mask
      const mask = await runSegmentationSync(
        sourceElement,
        sourceW,
        sourceH,
        clipId,
        human,
        chosenModel,
        options.modelSelection !== 2, // Use MediaPipe GPU unless Ultra Studio IS-Net is selected
        options.useROI,
        width,
        height
      );
      if (mask) {
        cacheMaskCanvas(clipId, mask);
        markInferencePerformed(clipId);
        compositeMask(ctx, sourceElement, mask, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId, options);
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
  human: { hasHuman: boolean; bbox?: { x: number; y: number; w: number; h: number } },
  modelType: 'general' | 'landscape',
  tryMediaPipe: boolean,
  useROI: boolean,
  targetW: number,
  targetH: number
): Promise<void> {
  // Prevent overlapping inference jobs
  const flightKey = `${clipId}_segment`;
  if ((window as any)[flightKey]) return;
  (window as any)[flightKey] = true;

  try {
    let maskCanvas: any = null;

    const videoTime = source && 'currentTime' in source ? (source as HTMLVideoElement).currentTime : 0;

    // Try 0: MediaPipe GPU on full frame (ultra-fast ~5ms, zero network lag)
    if (tryMediaPipe) {
      const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType, clipId, videoTime);
      if (mpBitmap) {
        maskCanvas = getPooledCanvas(`${clipId}_async_mp`, targetW, targetH);
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.clearRect(0, 0, targetW, targetH);
          mCtx.drawImage(mpBitmap, 0, 0, targetW, targetH);
        }
        mpBitmap.close();
      }
    }

    // Try 1: RVM (CapCut-grade recurrent memory fallback)
    const analysisActive = getClipAnalysisStatus(clipId).status === 'analyzing';
    if (!maskCanvas && !analysisActive) {
      const rvmRes = await segmentWithRVM(source as any, clipId, videoTime, 384).catch(() => null);
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

    // Try 2: ONNX with ROI crop (higher effective resolution)
    if (!maskCanvas && human.bbox && useROI) {
      const crop = computeROICrop(sourceW, sourceH, human.bbox, 0.25, null);
      const roiCanvas = getPooledCanvas(`${clipId}_async_roi`, crop.sw, crop.sh);
      const roiCtx = roiCanvas.getContext('2d');
      if (roiCtx) {
        roiCtx.clearRect(0, 0, crop.sw, crop.sh);
        roiCtx.drawImage(
          source as CanvasImageSource,
          crop.sx, crop.sy, crop.sw, crop.sh, // source sub-rect
          0, 0, crop.sw, crop.sh              // dest full
        );
      }

      const snap = await captureSnapshotBlob(roiCanvas as any, crop.sw, crop.sh, 384);
      if (snap) {
        const roiMask = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
        if (roiMask) {
          // Composite ROI mask back to full-frame canvas
          maskCanvas = document.createElement('canvas');
          maskCanvas.width = targetW;
          maskCanvas.height = targetH;
          const mCtx = maskCanvas.getContext('2d');
          if (mCtx) {
            mCtx.clearRect(0, 0, targetW, targetH);
            mCtx.drawImage(roiMask, crop.sx, crop.sy, crop.sw, crop.sh);
          }
        }
      }
    }

    // Try 3: ONNX full frame fallback
    if (!maskCanvas) {
      const snap = await captureSnapshotBlob(source, sourceW, sourceH, 384);
      if (snap) {
        maskCanvas = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
      }
    }

    // Final guard: never cache a no-subject mask — destination-in with a
    // near-empty mask erases the entire frame. Cache nothing instead so the
    // frame stays original.
    if (maskCanvas && (await measureMaskCoverage(maskCanvas)) < RVM_EMPTY_COVERAGE) {
      maskCanvas = null;
    }

    if (maskCanvas) {
      cacheMaskCanvas(clipId, maskCanvas);
      markInferencePerformed(clipId);
      notifyMaskReady();
    }
  } catch (err) {
    console.warn('[aiBackgroundIntegrated] Async segmentation failed:', err);
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
  human: { hasHuman: boolean; bbox?: { x: number; y: number; w: number; h: number } },
  modelType: 'general' | 'landscape',
  tryMediaPipe: boolean,
  useROI: boolean,
  targetW: number,
  targetH: number
): Promise<HTMLCanvasElement | null> {
  let maskCanvas: HTMLCanvasElement | null = null;

  const videoTime = (source as HTMLVideoElement).currentTime || 0;

  // Try 0: MediaPipe GPU (instant ~5ms high-accuracy segmentation)
  if (tryMediaPipe) {
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

  // Try 1: RVM (CapCut-grade recurrent memory fallback)
  if (!maskCanvas) {
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

  // Export: always use ONNX for quality. Optionally with ROI.
  if (!maskCanvas && human.bbox && useROI) {
    const crop = computeROICrop(sourceW, sourceH, human.bbox, 0.25, null);
    const roiCanvas = getPooledCanvas(`${clipId}_sync_roi`, crop.sw, crop.sh);
    const roiCtx = roiCanvas.getContext('2d');
    if (roiCtx) {
      roiCtx.clearRect(0, 0, crop.sw, crop.sh);
      roiCtx.drawImage(source as CanvasImageSource, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
    }

    // Export uses full isnet (not fp16) for maximum edge quality
    const snap = await captureSnapshotBlob(roiCanvas as any, crop.sw, crop.sh, 512);
    if (snap) {
      const roiMask = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet');
      if (roiMask) {
        maskCanvas = document.createElement('canvas');
        maskCanvas.width = targetW;
        maskCanvas.height = targetH;
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.clearRect(0, 0, targetW, targetH);
          mCtx.drawImage(roiMask, crop.sx, crop.sy, crop.sw, crop.sh);
        }
      }
    }
  }

  if (!maskCanvas) {
    const snap = await captureSnapshotBlob(source, sourceW, sourceH, 512);
    if (snap) {
      maskCanvas = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet');
    }
  }

  // Final guard: never return a no-subject mask — destination-in with a
  // near-empty mask erases the entire frame. Return null so the caller keeps
  // the original frame (CapCut behavior: no subject → no cutout applied).
  if (maskCanvas && (await measureMaskCoverage(maskCanvas)) < RVM_EMPTY_COVERAGE) {
    return null;
  }

  if (maskCanvas) {
    cacheMaskCanvas(clipId, maskCanvas);
    markInferencePerformed(clipId);
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
  const refinedMask = (choke !== 0 || feather > 0)
    ? refineMaskEdges(maskCanvas, width, height, choke, feather, `${clipId}_smart`)
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
  invalidateMaskCache,
  applySubjectNeonOutlineFlash,
};

export type { MaskAnalysisStatus };
