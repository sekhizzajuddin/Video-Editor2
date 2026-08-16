/**
 * motionMaskTracker.ts
 *
 * Builds the per-frame colour mask cache for a painted motion region.
 *
 * Runs once when the user presses "Re-track". Scoring every pixel against a
 * colour signature is far too slow to do live during playback, so the result is
 * cached (RLE-compressed, at reduced resolution) and simply looked up at render
 * time. This is the trade-off chosen deliberately: fast playback, explicit
 * re-track after edits.
 *
 * Locality is what makes the tracking usable: each frame is seeded from the
 * PREVIOUS frame's centroid and only the connected blob is kept, so a skin-tone
 * signature painted on a hand keeps following that hand instead of jumping to
 * the face.
 */

import { getFrameSize, getClipFramePlacement } from './frameSpace';
import {
  buildColorSignature,
  chokeMask,
  computeMaskForFrame,
  encodeMaskRle,
  featherMask,
  type ColorSignature,
} from './motionMask';

export interface MaskTrackOptions {
  /** Analysis resolution. Lower is faster and stores smaller. */
  analysisWidth?: number;
  /** Samples per second. The mask changes slowly; 12 is usually plenty. */
  fps?: number;
  /** Chroma match tolerance. */
  tolerance?: number;
  /** Grow/shrink the mask after matching. */
  choke?: number;
  /** Feather radius applied to the cached mask. */
  feather?: number;
  /** How far the selection may spread beyond the stroke. See MotionEffectSettings. */
  spreadLimit?: number;
  onProgress?: (progress: number) => void;
  shouldCancel?: () => boolean;
  /** Project aspect ratio, so analysis happens in the same space as the stroke. */
  aspectRatio?: string;
  /** Clip transform, so the media is placed in the frame exactly as rendered. */
  clipTransform?: { x?: number; y?: number; scale?: number } | null;
}

export interface MaskTrackResult {
  width: number;
  height: number;
  frames: Array<{ time: number; rle: number[]; centroid: { x: number; y: number } | null }>;
  signature: ColorSignature;
  /** Mean fraction of the frame selected. Lets the UI warn about a bad stroke. */
  avgCoverage: number;
  /** How many frames were rejected by the runaway-blob guard. */
  leakedFrames: number;
}

/**
 * Analyse `videoEl` across `duration` seconds and produce a cached mask per
 * sampled frame.
 *
 * @param strokeMask painted stroke at `strokeW` x `strokeH`, non-zero = painted
 */
export async function trackColorMask(
  videoEl: HTMLVideoElement,
  startTime: number,
  duration: number,
  strokeMask: Uint8Array,
  strokeW: number,
  strokeH: number,
  opts: MaskTrackOptions = {}
): Promise<MaskTrackResult | null> {
  const analysisW = Math.max(64, Math.min(480, opts.analysisWidth ?? 240));

  // Analyse in FRAME space, downscaled.
  //
  // The analysis canvas used to be shaped to the VIDEO's aspect ratio and the
  // video blitted across all of it. The painted stroke, however, is authored
  // against the visible PICTURE. On any project where those two differ (a
  // landscape clip in a 9:16 timeline is the common case) the stroke and the
  // pixels it was supposed to describe were in different spaces, so the colour
  // signature was learned from whatever happened to be at the mirrored
  // coordinates — usually background. That is why painting "on the person"
  // could still select nothing useful.
  const { W: frameW, H: frameH } = getFrameSize(opts.aspectRatio ?? '16:9');
  const analysisH = Math.max(36, Math.round((analysisW * frameH) / frameW));
  const analysisScale = analysisW / frameW;

  const placement = getClipFramePlacement(
    videoEl.videoWidth || 1920,
    videoEl.videoHeight || 1080,
    frameW,
    frameH,
    opts.clipTransform
  );
  const drawX = placement.x * analysisScale;
  const drawY = placement.y * analysisScale;
  const drawW = placement.w * analysisScale;
  const drawH = placement.h * analysisScale;

  const canvas = document.createElement('canvas');
  canvas.width = analysisW;
  canvas.height = analysisH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const paintFrame = () => {
    ctx.clearRect(0, 0, analysisW, analysisH);
    ctx.drawImage(videoEl, drawX, drawY, drawW, drawH);
  };

  const seekTo = (t: number): Promise<void> =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        videoEl.removeEventListener('seeked', finish);
        resolve();
      };
      videoEl.addEventListener('seeked', finish);
      // Safety net: a seek past the end (or on a stalled element) never fires
      // 'seeked', which would hang the whole analysis.
      setTimeout(finish, 220);
      try {
        videoEl.currentTime = t;
      } catch {
        finish();
      }
    });

  // ── Learn the signature from the first frame ────────────────────────────
  await seekTo(startTime);
  paintFrame();
  let first: ImageData;
  try {
    first = ctx.getImageData(0, 0, analysisW, analysisH);
  } catch {
    return null; // tainted canvas (cross-origin media)
  }

  // The stroke was painted at preview resolution; resample it to analysis space.
  const scaledStroke = new Uint8Array(analysisW * analysisH);
  for (let y = 0; y < analysisH; y++) {
    const sy = Math.min(strokeH - 1, Math.floor((y * strokeH) / analysisH));
    for (let x = 0; x < analysisW; x++) {
      const sx = Math.min(strokeW - 1, Math.floor((x * strokeW) / analysisW));
      scaledStroke[y * analysisW + x] = strokeMask[sy * strokeW + sx];
    }
  }

  const signature = buildColorSignature(
    first.data,
    analysisW,
    analysisH,
    scaledStroke,
    opts.tolerance ?? 22
  );
  if (!signature) return null;

  // Seed from the centroid of the painted stroke itself.
  let seed: { x: number; y: number } | null = null;
  {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < analysisH; y++) {
      for (let x = 0; x < analysisW; x++) {
        if (scaledStroke[y * analysisW + x]) { sx += x; sy += y; n++; }
      }
    }
    if (n > 0) seed = { x: sx / n, y: sy / n };
  }

  // ── Walk the clip ────────────────────────────────────────────────────────
  const fps = Math.max(2, Math.min(30, opts.fps ?? 12));
  const step = 1 / fps;
  const steps = Math.max(1, Math.ceil(duration / step));
  const frames: MaskTrackResult['frames'] = [];
  /** Last mask that passed the leak check, reused when a frame goes bad. */
  let lastGoodMask: Uint8ClampedArray | null = null;
  const coverageSamples: number[] = [];
  let leakedFrames = 0;
  /** Feature size relative to paint time; re-estimated each frame. */
  let scaleHint = 1;

  // Bound the per-frame search around the last known position: keeps the cost
  // down and stops a distant same-coloured object from stealing the blob.
  const searchRadius = Math.max(analysisW, analysisH) * 0.35;

  for (let i = 0; i <= steps; i++) {
    if (opts.shouldCancel?.()) break;

    const rel = Math.min(duration, i * step);
    await seekTo(startTime + rel);
    try {
      paintFrame();
    } catch {
      break;
    }

    let frame: ImageData;
    try {
      frame = ctx.getImageData(0, 0, analysisW, analysisH);
    } catch {
      break;
    }

    const result = computeMaskForFrame(
      frame.data,
      analysisW,
      analysisH,
      signature,
      seed,
      { searchRadius, scaleHint, spreadLimit: opts.spreadLimit }
    );

    // ── Runaway-blob guard ───────────────────────────────────────────────────
    //
    // The mask is grown by flood fill, so if the subject touches anything of a
    // similar tone the fill escapes into it and the blob balloons to most of the
    // frame. That is bad twice over: the effect is applied to the background, and
    // the centroid is dragged toward the leak, so the NEXT frame searches in the
    // wrong place and the error compounds until the track is lost entirely.
    //
    // A selection covering more than half the frame is never what someone painting
    // a hand or a face meant. Treat it as a failed frame: keep the previous seed so
    // the search stays anchored where the subject actually was, and let the
    // established mask stand rather than committing the leak to the cache.
    const LEAK_COVERAGE = 0.5;
    const leaked = result.coverage > LEAK_COVERAGE;
    coverageSamples.push(result.coverage);
    if (leaked) leakedFrames++;

    let mask = result.mask;
    if (leaked && lastGoodMask) {
      mask = lastGoodMask;
    } else if (!leaked) {
      if (opts.choke) mask = chokeMask(mask, analysisW, analysisH, opts.choke);
      if (opts.feather) mask = featherMask(mask, analysisW, analysisH, opts.feather);
      lastGoodMask = mask;
    }

    frames.push({
      time: rel,
      rle: encodeMaskRle(mask),
      centroid: leaked ? seed : result.centroid,
    });

    // Follow the blob: next frame searches around where we just found it.
    // Falling back to the previous seed (rather than null) means a brief
    // occlusion does not reset the tracker to a global search. A leaked frame
    // deliberately does NOT move the seed — see the guard above.
    if (result.centroid && !leaked) seed = result.centroid;

    // ── Adaptive scale ───────────────────────────────────────────────────────
    //
    // The subject walks toward or away from camera, so the feature's apparent
    // size changes: measured on a typical walk-in, a garment can grow ~1.2x over
    // a few seconds. A fixed pixel budget would clip the selection when they
    // approach and leak into the rest of the outfit when they recede.
    //
    // Re-derive the scale from the measured area (radius ~ sqrt(area)) and feed
    // it back into the next frame's extent limit. Heavily smoothed and clamped:
    // the estimate is noisy frame to frame, and letting it run away would defeat
    // the very bound it is feeding.
    if (!leaked && result.area > 0 && signature.patchArea > 0) {
      const measured = Math.sqrt(result.area / signature.patchArea);
      const clamped = Math.max(0.4, Math.min(2.5, measured));
      // 0.2 gain ~= a 5-frame time constant: tracks a walk-in, ignores jitter.
      scaleHint = scaleHint + (clamped - scaleHint) * 0.2;
    }

    opts.onProgress?.((i + 1) / (steps + 1));
  }

  if (frames.length === 0) return null;

  return {
    width: analysisW,
    height: analysisH,
    frames,
    signature,
    avgCoverage: coverageSamples.length
      ? coverageSamples.reduce((a, b) => a + b, 0) / coverageSamples.length
      : 0,
    leakedFrames,
  };
}
