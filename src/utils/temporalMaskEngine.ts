/**
 * temporalMaskEngine.ts — Temporal Masking & Alpha-Channel Stabilization Engine.
 *
 * Prevents high-frequency edge flickering, boundary jitter, and outline popping
 * during AI background removal by applying Exponential Moving Average (EMA)
 * temporal filtering across consecutive video segmentation frames.
 */

interface ClipTemporalMaskState {
  prevAlphaBuffer: Float32Array | null;
  lastVideoTime: number;
  width: number;
  height: number;
}

const clipTemporalStates = new Map<string, ClipTemporalMaskState>();
const MAX_TEMPORAL_STATES = 30;

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
 * Applies Exponential Moving Average (EMA) temporal filtering to raw AI confidence masks.
 *
 * @param clipId Unique identifier of the clip
 * @param rawAlpha Raw Float32 confidence mask from segmentation model (0.0 to 1.0)
 * @param width Width of confidence mask
 * @param height Height of confidence mask
 * @param videoTime Current clip playback timestamp in seconds
 * @param blendFactor Temporal responsiveness factor (0.1 = heavy smoothing, 0.5 = fast response). Default 0.35
 */
export function stabilizeTemporalAlpha(
  clipId: string,
  rawAlpha: Float32Array,
  width: number,
  height: number,
  videoTime: number,
  blendFactor = 0.35
): Float32Array {
  let state = clipTemporalStates.get(clipId);

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
  const stabilized = new Float32Array(rawAlpha.length);
  const invBlend = 1.0 - blendFactor;

  // Temporal EMA Filter Pass: Alpha(t) = (1 - blend) * Alpha(t-1) + blend * Raw(t)
  for (let i = 0; i < rawAlpha.length; i++) {
    const rawVal = rawAlpha[i];
    const prevVal = prev[i];

    // Smooth temporal transition
    const smoothed = invBlend * prevVal + blendFactor * rawVal;
    stabilized[i] = smoothed;
    prev[i] = smoothed; // Update history buffer
  }

  state.lastVideoTime = videoTime;
  return stabilized;
}
