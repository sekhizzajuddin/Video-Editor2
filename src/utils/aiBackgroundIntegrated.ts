/**
 * aiBackgroundIntegrated.ts
 *
 * Smart orchestrator in front of the AI cutout: decides WHEN to spend an
 * inference, and composites the result smoothly in between.
 *
 * ── The flicker this file used to cause ──────────────────────────────────────
 *
 * Step 1 of the old pipeline was a hard gate:
 *
 *     const human = detectHumanPresence(sourceElement, clipId, 0.008);
 *     if (!human.hasHuman) return;          // ← composites NOTHING
 *
 * `detectHumanPresence` is a 64×36 skin-tone ratio heuristic. Running it on
 * EVERY rendered frame and letting it veto the composite meant the cutout
 * blinked out the instant the subject turned away, the lighting dropped, a hand
 * left frame, or the subject simply wasn't skin-coloured (a pet, a product, a
 * person in a mask). One frame cut out, the next frame full background. That is
 * the on/off strobing behind "the background cutout is not smooth".
 *
 * ── The rule now ─────────────────────────────────────────────────────────────
 *
 *   The heuristics may only decide whether to SPEND AN INFERENCE.
 *   They may never decide whether a matte is composited.
 *
 * An existing matte is always drawn. When the segmenter itself reports an empty
 * frame several times in a row, the cutout DISSOLVES over ~110 ms via
 * `LiveMatteTrack` instead of snapping — which is what CapCut does when a
 * subject walks out of frame.
 */

import {
  detectHumanPresence,
  computeROICrop,
  detectSceneChange,
  shouldDetectSceneChange,
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
  invalidateClipMatteContinuity,
  MaskAnalysisStatus,
} from './aiBackground';

import {
  segmentWithRVM,
  RVM_EMPTY_COVERAGE,
  resetRVMState,
} from './rvmMatting';

import {
  getLiveTrack,
  refineMatte,
  compositeCutout,
  type MatteImage,
  type CutoutStyle,
} from './matteEngine';

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
 * How often we are willing to spend an inference during playback, per quality
 * tier. Much tighter than the old 250–700 ms: the cross-fade hides the latency,
 * so a shorter interval buys tracking accuracy without visible cost. Inference
 * is still strictly one-at-a-time per clip, so a slow device naturally degrades
 * to "as fast as it can manage" rather than queueing up work.
 */
const REFRESH_MS: Record<IntegrationOptions['playbackQuality'], number> = {
  full: 90,
  balanced: 150,
  performance: 260,
};

/** Consecutive empty inferences before the cutout is allowed to dissolve. */
const EMPTY_FRAMES_BEFORE_DISSOLVE = 3;

interface ClipRuntime {
  /** performance.now() of the last inference kick-off. */
  lastRun: number;
  /** Inference currently in flight for this clip. */
  inFlight: boolean;
  /** Last sampled source-media time (seek detection). */
  lastTime: number;
  /** Consecutive "segmenter found nothing" results. */
  emptyStreak: number;
}

const clipRuntime = new Map<string, ClipRuntime>();

function runtimeFor(clipId: string): ClipRuntime {
  let r = clipRuntime.get(clipId);
  if (!r) {
    r = { lastRun: 0, inFlight: false, lastTime: Number.NaN, emptyStreak: 0 };
    clipRuntime.set(clipId, r);
  }
  return r;
}

export function resetClipMatteRuntime(clipId: string): void {
  clipRuntime.delete(clipId);
}

function sourceTimeOf(source: unknown): number {
  const t = (source as { currentTime?: unknown })?.currentTime;
  return typeof t === 'number' ? t : -1;
}

function styleOf(options: IntegrationOptions): CutoutStyle {
  return {
    mode: options.mode,
    blurStrength: options.blurStrength,
    strokeColor: options.strokeColor,
    strokeWidth: options.strokeWidth,
    strokeGlow: options.strokeGlow,
    bgColor: options.bgColor,
  };
}

/**
 * Apply AI background removal with human-detection intelligence.
 *
 * INTERACTIVE PATH (isPlaying = true)
 *   1. Interpolated pre-rendered matte track → done (the common case once the
 *      clip has been analysed).
 *   2. Otherwise sample the clip's cross-faded live matte and composite it.
 *   3. Independently, maybe schedule a background inference. Never block.
 *
 * EXPORT / PAUSED PATH (isPlaying = false)
 *   Await a frame-accurate matte before compositing.
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

  try {
    const choke = options.choke || 0;
    const feather = (options.feather || 0) > 0 ? options.feather : options.edgeBlur;
    const style = styleOf(options);

    // ── STEP 0: Pre-rendered matte track (interpolated, O(log n)) ────────
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
        style
      )
    ) {
      return;
    }

    const rt = runtimeFor(clipId);
    const track = getLiveTrack(clipId);
    const videoTime = sourceTimeOf(sourceElement);

    // ── STEP 1: Seek detection ───────────────────────────────────────────
    // A jump backwards, or forwards by more than half a second, means the
    // cross-fade history belongs to a different moment. Easing from it would
    // drag a stale silhouette across the new frame.
    if (
      Number.isFinite(rt.lastTime) &&
      videoTime >= 0 &&
      (videoTime < rt.lastTime - 0.05 || videoTime - rt.lastTime > 0.5)
    ) {
      // One call clears every piece of frame-to-frame history for this clip:
      // the cross-fade track, RVM's recurrent state, the temporal EMA and the
      // refine scratch surfaces.
      invalidateClipMatteContinuity(clipId);
      invalidateMaskCache(clipId);
      rt.emptyStreak = 0;
      rt.lastRun = 0;
    }
    if (videoTime >= 0) rt.lastTime = videoTime;

    // ── STEP 2: Segmentation ─────────────────────────────────────────────
    if (options.isPlaying) {
      maybeScheduleInference(sourceElement, width, height, clipId, options, rt);
    } else {
      await runSegmentationSync(sourceElement, width, height, clipId, options, rt);
    }

    // ── STEP 3: Composite whatever the track holds right now ─────────────
    // This runs unconditionally. No heuristic is allowed to remove an existing
    // matte — that was the strobing bug.
    const matte = track.sample();
    if (!matte) return;

    const refined = refineMatte(matte, {
      choke,
      feather: feather || 0,
      destWidth: width,
      destHeight: height,
      poolKey: `smart:${clipId}`,
    });

    compositeCutout(
      ctx,
      width,
      height,
      sourceElement as CanvasImageSource,
      refined,
      style,
      `smart:${clipId}`,
      options.spillSuppression > 0
        ? (target, w, h) =>
            applySpillSuppression(target, w, h, options.spillSuppression, options.spillColor)
        : undefined
    );
  } catch (err) {
    console.error('[aiBackgroundIntegrated] Smart mask error:', err);
    // Fail-open: draw nothing (show original frame)
  }
}

// ─── Inference scheduling (interactive playback) ────────────────────────────

/**
 * Decide whether to spend an inference on this frame, and if so kick it off
 * without blocking the render loop.
 *
 * The skin/scene heuristics appear ONLY here, and only ever make us do *less*
 * work. They can extend the interval on a clip that looks empty and stable;
 * they can never suppress the composite.
 */
function maybeScheduleInference(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
  clipId: string,
  options: IntegrationOptions,
  rt: ClipRuntime
): void {
  if (rt.inFlight) return;

  const now = performance.now();
  const track = getLiveTrack(clipId);
  let interval = REFRESH_MS[options.playbackQuality] ?? REFRESH_MS.balanced;

  // Nothing on screen yet → get a first matte as fast as possible.
  if (!track.hasMatte) interval = 0;

  if (now - rt.lastRun < interval) return;

  // The pre-analysis job walks keyframes through the same per-clip recurrent
  // RVM state; a concurrent live inference would seek-jump it.
  if (getClipAnalysisStatus(clipId).status === 'analyzing') return;

  // Cheap scheduling hints — sampled at most every 12th frame each, and only
  // once we already passed the interval check (so they cost nothing on the
  // frames in between).
  let bbox: { x: number; y: number; w: number; h: number } | undefined;
  if (track.hasMatte && rt.emptyStreak >= EMPTY_FRAMES_BEFORE_DISSOLVE) {
    // Confirmed empty and already dissolved: back off hard, but keep polling
    // often enough to catch the subject walking back in.
    if (now - rt.lastRun < 500) return;
  }
  if (shouldDetectSceneChange(clipId, 12)) {
    // A scene cut invalidates temporal memory; force a state reset so the next
    // matte isn't dragged from the previous shot.
    if (detectSceneChange(clipId, source, 0.12)) {
      resetRVMState(clipId);
    }
  }
  if (options.modelSelection === 0 || options.useROI) {
    const human = detectHumanPresence(source, clipId, options.skinThreshold);
    bbox = human.bbox;
  }

  rt.inFlight = true;
  rt.lastRun = now;

  void runSegmentationAsync(source, width, height, clipId, options, rt, bbox).finally(() => {
    rt.inFlight = false;
  });
}

async function runSegmentationAsync(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
  clipId: string,
  options: IntegrationOptions,
  rt: ClipRuntime,
  bbox?: { x: number; y: number; w: number; h: number }
): Promise<void> {
  const track = getLiveTrack(clipId);
  const videoTime = sourceTimeOf(source);

  try {
    // Try 0: RVM — recurrent temporal memory, hair-level alpha.
    const rvmRes = await segmentWithRVM(source as any, clipId, videoTime, 512).catch(() => null);
    if (rvmRes) {
      if (rvmRes.coverage < RVM_EMPTY_COVERAGE) {
        rvmRes.bitmap.close();
        noteEmptyResult(track, rt);
      } else {
        rt.emptyStreak = 0;
        track.push(rvmRes.bitmap);
        rvmRes.bitmap.close();
      }
      notifyMaskReady();
      return;
    }

    // Try 1: MediaPipe on the full frame (fast fallback).
    const modelType = pickMediaPipeModel(options, bbox);
    if (modelType) {
      const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType, clipId, videoTime);
      if (mpBitmap) {
        rt.emptyStreak = 0;
        track.push(mpBitmap);
        mpBitmap.close();
        notifyMaskReady();
        return;
      }
    }

    // Try 2: IS-Net on a ROI crop (higher effective resolution).
    if (bbox && options.useROI) {
      const roiMatte = await segmentROI(source, width, height, clipId, bbox, 'isnet_fp16', 384);
      if (roiMatte) {
        rt.emptyStreak = 0;
        track.push(roiMatte);
        notifyMaskReady();
        return;
      }
    }

    // Try 3: IS-Net on the full frame.
    const snap = await captureSnapshotBlob(source, width, height, 512);
    if (snap) {
      const mask = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
      if (mask) {
        if ((await measureMaskCoverage(mask)) < RVM_EMPTY_COVERAGE) {
          noteEmptyResult(track, rt);
        } else {
          rt.emptyStreak = 0;
          track.push(mask);
        }
        notifyMaskReady();
      }
    }
  } catch (err) {
    console.warn('[aiBackgroundIntegrated] Async segmentation failed:', err);
  }
}

// ─── Sync Segmentation (Export / Paused) ────────────────────────────────────

async function runSegmentationSync(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
  clipId: string,
  options: IntegrationOptions,
  rt: ClipRuntime
): Promise<void> {
  const track = getLiveTrack(clipId);
  const videoTime = sourceTimeOf(source);

  // Frame-accurate means "re-run whenever the frame moved", not "every call" —
  // paused repaints (selection, zoom, overlay toggles) must not re-infer.
  const alreadyFresh =
    track.hasMatte && Number.isFinite(rt.lastTime) && Math.abs(videoTime - rt.lastTime) <= 0.02 && rt.lastRun > 0;
  if (alreadyFresh) return;
  rt.lastRun = performance.now();

  // Try 0: RVM at the high tier — this is what export quality hinges on.
  const rvmRes = await segmentWithRVM(
    source as any,
    clipId,
    videoTime,
    options.modelSelection >= 2 ? 1024 : 768
  ).catch(() => null);
  if (rvmRes) {
    if (rvmRes.coverage >= RVM_EMPTY_COVERAGE) {
      rt.emptyStreak = 0;
      track.push(rvmRes.bitmap);
      rvmRes.bitmap.close();
      return;
    }
    rvmRes.bitmap.close();
    noteEmptyResult(track, rt);
    return;
  }

  const human = detectHumanPresence(source, clipId, options.skinThreshold);
  const modelType = pickMediaPipeModel(options, human.bbox);
  if (modelType && options.modelSelection !== 2) {
    const mpBitmap = await segmentSourceWithMediaPipe(source as any, modelType, clipId, videoTime);
    if (mpBitmap) {
      rt.emptyStreak = 0;
      track.push(mpBitmap);
      mpBitmap.close();
      return;
    }
  }

  // Export uses full isnet (not fp16) for maximum edge quality.
  if (human.bbox && options.useROI) {
    const roiMatte = await segmentROI(source, width, height, clipId, human.bbox, 'isnet', 512);
    if (roiMatte) {
      rt.emptyStreak = 0;
      track.push(roiMatte);
      return;
    }
  }

  const snap = await captureSnapshotBlob(source, width, height, 768);
  if (snap) {
    const mask = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet');
    if (mask) {
      if ((await measureMaskCoverage(mask)) < RVM_EMPTY_COVERAGE) {
        noteEmptyResult(track, rt);
      } else {
        rt.emptyStreak = 0;
        track.push(mask);
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pickMediaPipeModel(
  options: IntegrationOptions,
  bbox?: { x: number; y: number; w: number; h: number }
): 'general' | 'landscape' | null {
  if (options.modelSelection === 2) return null; // Ultra Studio → IS-Net / RVM only
  if (options.modelSelection === 3) return 'landscape';
  if (options.modelSelection === 1) return 'landscape';
  // Auto: wide subject → landscape model, otherwise the square one.
  if (bbox && bbox.h > 0 && bbox.w / bbox.h > 1.3) return 'landscape';
  return 'general';
}

/**
 * Run IS-Net on a padded crop around the subject and paste the result back into
 * a full-frame matte, so small subjects get far more effective resolution.
 */
async function segmentROI(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
  clipId: string,
  bbox: { x: number; y: number; w: number; h: number },
  model: 'isnet' | 'isnet_fp16',
  maxDim: number
): Promise<MatteImage | null> {
  const crop = computeROICrop(width, height, bbox, 0.25, null);
  if (crop.sw <= 8 || crop.sh <= 8) return null;

  const roiCanvas = getPooledCanvas(`${clipId}_roi_src`, crop.sw, crop.sh);
  const roiCtx = roiCanvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!roiCtx) return null;
  roiCtx.clearRect(0, 0, crop.sw, crop.sh);
  roiCtx.drawImage(source as CanvasImageSource, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

  const snap = await captureSnapshotBlob(roiCanvas as any, crop.sw, crop.sh, maxDim);
  if (!snap) return null;
  const roiMask = await segmentBlob(snap.blob, snap.w, snap.h, model);
  if (!roiMask) return null;
  if ((await measureMaskCoverage(roiMask)) < RVM_EMPTY_COVERAGE) return null;

  const full = getPooledCanvas(`${clipId}_roi_full`, width, height);
  const fCtx = full.getContext('2d') as CanvasRenderingContext2D | null;
  if (!fCtx) return null;
  fCtx.clearRect(0, 0, width, height);
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';
  fCtx.drawImage(roiMask, crop.sx, crop.sy, crop.sw, crop.sh);
  return full as MatteImage;
}

/**
 * The segmenter genuinely found nothing. Only dissolve after several
 * consecutive empty results — a single bad inference (motion blur, a hard cut,
 * a dropped decode) must not blink the cutout off.
 */
function noteEmptyResult(track: ReturnType<typeof getLiveTrack>, rt: ClipRuntime): void {
  rt.emptyStreak++;
  if (rt.emptyStreak >= EMPTY_FRAMES_BEFORE_DISSOLVE) {
    track.pushOpaque();
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
  refineMaskEdges,
};

export type { MaskAnalysisStatus };
