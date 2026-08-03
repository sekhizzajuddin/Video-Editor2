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
  MaskAnalysisStatus,
} from './aiBackground';

// ─── Smart Orchestrator ─────────────────────────────────────────────────────

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
        options.spillColor
      )
    ) {
      return;
    }

    // ── STEP 1: Human Presence Check (< 1ms) ─────────────────────────────
    const human = detectHumanPresence(sourceElement, clipId, options.skinThreshold);

    if (!human.hasHuman) {
      // No human in frame: if we have a cached mask, fade it out over 3 frames
      // instead of snapping to nothing (prevents pop-out artifacts)
      const cached = getCachedMaskCanvas(clipId, width, height);
      if (cached) {
        // Fade out cached mask
        ctx.globalCompositeOperation = 'destination-in';
        ctx.globalAlpha = 0.3; // Rapid fade
        ctx.drawImage(cached, 0, 0, width, height);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }

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
        compositeMask(ctx, cached, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId);
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

    // For export (isPlaying=false), always use ONNX for best quality
    if (!options.isPlaying) {
      useMediaPipe = false;
    }

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
        compositeMask(ctx, cached, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId);
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
        false, // Never use MediaPipe for export
        options.useROI,
        width,
        height
      );
      if (mask) {
        cacheMaskCanvas(clipId, mask);
        markInferencePerformed(clipId);
        compositeMask(ctx, mask, width, height, choke, feather, options.spillSuppression, options.spillColor, clipId);
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
    let maskCanvas: HTMLCanvasElement | null = null;

    // Try 1: MediaPipe on full frame (fastest)
    if (tryMediaPipe) {
      const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType);
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

      const snap = await captureSnapshotBlob(roiCanvas, crop.sw, crop.sh, 384);
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

  if (tryMediaPipe) {
    const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType);
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
    const snap = await captureSnapshotBlob(roiCanvas, crop.sw, crop.sh, 512);
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

  return maskCanvas;
}

// ─── Mask Compositing ───────────────────────────────────────────────────────

function compositeMask(
  ctx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  choke: number,
  feather: number,
  spillSuppression: number,
  spillColor?: string,
  clipId: string = '_smart'
): void {
  const refinedMask = (choke !== 0 || feather > 0)
    ? refineMaskEdges(maskCanvas, width, height, choke, feather, `${clipId}_smart`)
    : maskCanvas;

  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(refinedMask as any, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';

  if (spillSuppression > 0) {
    applySpillSuppression(ctx, width, height, spillSuppression, spillColor);
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
  cleanupAiBackgroundResources,
  cleanupClipBackgroundState,
  invalidateMaskCache,
  applySubjectNeonOutlineFlash,
};

export type { MaskAnalysisStatus };
