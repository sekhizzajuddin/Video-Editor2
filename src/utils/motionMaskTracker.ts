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
  onProgress?: (progress: number) => void;
  shouldCancel?: () => boolean;
}

export interface MaskTrackResult {
  width: number;
  height: number;
  frames: Array<{ time: number; rle: number[]; centroid: { x: number; y: number } | null }>;
  signature: ColorSignature;
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
  const vidW = videoEl.videoWidth || 1920;
  const vidH = videoEl.videoHeight || 1080;
  const analysisH = Math.max(36, Math.round((analysisW * vidH) / vidW));

  const canvas = document.createElement('canvas');
  canvas.width = analysisW;
  canvas.height = analysisH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

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
  ctx.drawImage(videoEl, 0, 0, analysisW, analysisH);
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

  // Bound the per-frame search around the last known position: keeps the cost
  // down and stops a distant same-coloured object from stealing the blob.
  const searchRadius = Math.max(analysisW, analysisH) * 0.35;

  for (let i = 0; i <= steps; i++) {
    if (opts.shouldCancel?.()) break;

    const rel = Math.min(duration, i * step);
    await seekTo(startTime + rel);
    try {
      ctx.drawImage(videoEl, 0, 0, analysisW, analysisH);
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
      { searchRadius }
    );

    let mask = result.mask;
    if (opts.choke) mask = chokeMask(mask, analysisW, analysisH, opts.choke);
    if (opts.feather) mask = featherMask(mask, analysisW, analysisH, opts.feather);

    frames.push({
      time: rel,
      rle: encodeMaskRle(mask),
      centroid: result.centroid,
    });

    // Follow the blob: next frame searches around where we just found it.
    // Falling back to the previous seed (rather than null) means a brief
    // occlusion does not reset the tracker to a global search.
    if (result.centroid) seed = result.centroid;

    opts.onProgress?.((i + 1) / (steps + 1));
  }

  if (frames.length === 0) return null;

  return { width: analysisW, height: analysisH, frames, signature };
}
