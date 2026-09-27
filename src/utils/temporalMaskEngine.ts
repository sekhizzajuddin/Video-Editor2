/**
 * temporalMaskEngine.ts — Temporal Masking & Alpha-Channel Stabilization Engine.
 *
 * Prevents high-frequency edge flickering, boundary jitter and outline popping
 * during AI background removal by temporally filtering consecutive segmentation
 * results.
 *
 * ── Why the filter is MOTION-ADAPTIVE ────────────────────────────────────────
 *
 * A fixed exponential moving average cannot win: a slow blend (0.2) kills edge
 * jitter beautifully on a still subject but smears a visible ghost behind
 * anything that moves, while a fast blend (0.6) tracks motion but lets the
 * boundary crawl when the subject is still. The old engine used a fixed 0.35
 * and got a bit of both problems.
 *
 * We now measure how much the raw matte actually changed since the previous
 * frame and pick the blend factor from that:
 *
 *   • tiny change  → the subject is basically still, and any difference is
 *                    model noise. Smooth hard (low α) to lock the edge.
 *   • big change   → the subject moved (or the shot cut). Follow the new matte
 *                    almost immediately (high α) so nothing trails behind.
 *
 * The measurement is taken on a sparse stride, so it costs a fraction of the
 * filter pass it controls.
 */

interface ClipTemporalMaskState {
  prevAlphaBuffer: Float32Array | null;
  lastVideoTime: number;
  width: number;
  height: number;
}

const clipTemporalStates = new Map<string, ClipTemporalMaskState>();
const MAX_TEMPORAL_STATES = 30;

/** Blend factor when the matte is essentially static — heavy smoothing. */
const MIN_BLEND = 0.18;
/** Blend factor when the matte is changing fast — track, don't smear. */
const MAX_BLEND = 0.85;
/** Mean per-pixel alpha delta (0..1) at which we switch to full tracking. */
const MOTION_SATURATION = 0.06;
/** Sample every Nth pixel when estimating motion. */
const MOTION_STRIDE = 7;

function pruneTemporalStates(): void {
  if (clipTemporalStates.size > MAX_TEMPORAL_STATES) {
    const firstKey = clipTemporalStates.keys().next().value;
    if (firstKey) {
      clipTemporalStates.delete(firstKey);
    }
  }
}

/**
 * Resets the temporal mask state for a clip (used during seeks or clip edits).
 */
export function resetTemporalMaskState(clipId: string): void {
  clipTemporalStates.delete(clipId);
}

/**
 * Clears all temporal mask states.
 */
export function clearAllTemporalMaskStates(): void {
  clipTemporalStates.clear();
}

/**
 * Mean absolute difference between two alpha planes, sampled on a stride.
 * Exported for tests — this is the signal that drives the adaptive blend.
 */
export function estimateMatteMotion(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
  stride: number = MOTION_STRIDE
): number {
  const n = Math.min(current.length, previous.length);
  if (n === 0) return 1;
  const step = Math.max(1, Math.floor(stride));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const d = current[i] - previous[i];
    sum += d < 0 ? -d : d;
    count++;
  }
  return count > 0 ? sum / count : 1;
}

/**
 * Map a motion estimate onto a blend factor.
 * Exported for tests. Monotonic, clamped to [MIN_BLEND, MAX_BLEND].
 */
export function adaptiveBlendFactor(motion: number): number {
  if (!(motion > 0)) return MIN_BLEND;
  const t = Math.min(1, motion / MOTION_SATURATION);
  // Ease-in so small amounts of model noise stay firmly in the "smooth" region
  // and only genuine movement pulls the factor up.
  const eased = t * t;
  return MIN_BLEND + (MAX_BLEND - MIN_BLEND) * eased;
}

/**
 * Applies motion-adaptive temporal filtering to raw AI confidence masks.
 *
 * @param clipId Unique identifier of the clip
 * @param rawAlpha Raw Float32 confidence mask from segmentation model (0.0 to 1.0)
 * @param width Width of confidence mask
 * @param height Height of confidence mask
 * @param videoTime Current clip playback timestamp in seconds
 * @param blendFactor Optional fixed responsiveness override. Omit for adaptive.
 */
export function stabilizeTemporalAlpha(
  clipId: string,
  rawAlpha: Float32Array,
  width: number,
  height: number,
  videoTime: number,
  blendFactor?: number
): Float32Array {
  const state = clipTemporalStates.get(clipId);

  // Check for seek, scene jump, resolution change, or buffer length mismatch
  const isSeekOrJump =
    !state ||
    state.width !== width ||
    state.height !== height ||
    !state.prevAlphaBuffer ||
    state.prevAlphaBuffer.length !== rawAlpha.length ||
    Math.abs(videoTime - state.lastVideoTime) > 0.35 ||
    videoTime < state.lastVideoTime;

  if (isSeekOrJump || !state || !state.prevAlphaBuffer) {
    pruneTemporalStates();

    // Allocate new buffer and initialize with raw alpha frame directly
    const buffer = new Float32Array(rawAlpha.length);
    buffer.set(rawAlpha);

    clipTemporalStates.set(clipId, {
      prevAlphaBuffer: buffer,
      lastVideoTime: videoTime,
      width,
      height,
    });

    return rawAlpha;
  }

  const prev = state.prevAlphaBuffer;
  const blend =
    blendFactor !== undefined
      ? Math.min(1, Math.max(0, blendFactor))
      : adaptiveBlendFactor(estimateMatteMotion(rawAlpha, prev));

  // Fast path: the subject is moving enough that filtering would only smear.
  if (blend >= 0.995) {
    prev.set(rawAlpha);
    state.lastVideoTime = videoTime;
    return rawAlpha;
  }

  const stabilized = new Float32Array(rawAlpha.length);
  const invBlend = 1.0 - blend;

  // Temporal EMA Filter Pass: Alpha(t) = (1 - blend) * Alpha(t-1) + blend * Raw(t)
  for (let i = 0; i < rawAlpha.length; i++) {
    const smoothed = invBlend * prev[i] + blend * rawAlpha[i];
    stabilized[i] = smoothed;
    prev[i] = smoothed; // Update history buffer
  }

  state.lastVideoTime = videoTime;
  return stabilized;
}
