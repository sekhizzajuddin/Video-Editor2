// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by the preview sync loop (src/hooks/useMediaPlayback.ts).
// Desktop and mobile share the same preview, so this module is edited once.
//
// Preview starvation policy
// ─────────────────────────────────────────────────────────────────────────────
// The preview clock is *gated* on the media elements: while a needed element has
// not produced the frame at the playhead, the clock is frozen so the playhead
// never races ahead of the decoders (see PreviewCanvasContainer's buffering
// freeze).
//
// That is the right behaviour for a short load — but it has no exit condition.
// A single element that can never become ready (a stalled decode session, a
// url that went stale, a device that ran out of hardware decoders, an element
// whose seek never completes) keeps `readyState < 2` / `seeking` true forever,
// so the gate stays closed forever: the preview stops on one frame with the
// spinner up, and the only way out is a manual reload. Adding clips (a split,
// a second track) multiplies the number of elements in flight, which is why the
// problem surfaces after an edit rather than at import time.
//
// This module turns that unbounded wait into a bounded one:
//
//   * a FRESH stall (< graceMs) still closes the gate — brief loads keep looking
//     smooth, exactly as before;
//   * a stall older than the grace window STOPS CLOSING THE GATE. Playback
//     continues and the renderer draws whatever layers are ready (a dropped
//     frame, like every NLE), instead of dead-locking the whole preview;
//   * the stuck element gets an active RECOVERY (re-issue the pending seek, then
//     escalate to a full src reload) with a cooldown + attempt budget so we never
//     hammer the decoder;
//   * once the budget is spent the clip is reported as `degraded` — playback is
//     unaffected and the caller logs it once, so the failure is diagnosable
//     instead of silent.
//
// Pure functions only (no DOM, no timers) so the policy can be unit tested.
// ─────────────────────────────────────────────────────────────────────────────

/** Element that cannot currently present the frame the playhead needs. */
export interface StarvedElementReport {
  clipId: string;
  /** How long this element has been continuously not-ready (ms). */
  starvedForMs: number;
  /** `HTMLMediaElement.readyState` at report time — drives the recovery tier. */
  readyState: number;
}

/** How we try to un-stick an element. */
export type RecoveryTier = 'seek' | 'reload';

export interface RecoveryInstruction {
  clipId: string;
  tier: RecoveryTier;
}

export interface PreviewGateDecision {
  /** true → keep the preview clock frozen (a fresh, short load). */
  gate: boolean;
  /** Elements to actively recover this tick (cooldown already applied). */
  recover: RecoveryInstruction[];
  /** Clips we stopped waiting for — playback continues without them. */
  degraded: string[];
}

export interface RecoveryRecord {
  attempts: number;
  /** `nowMs` of the last recovery attempt. */
  lastAtMs: number;
}

export interface PreviewGateOptions {
  reports: readonly StarvedElementReport[];
  nowMs: number;
  /** A not-ready element younger than this keeps the clock frozen. */
  graceMs?: number;
  /** Past this age recovery escalates from "re-seek" to "reload the source". */
  hardLimitMs?: number;
  /** Minimum spacing between two recovery attempts on the same element. */
  recoveryCooldownMs?: number;
  /** Attempts after which a clip is reported degraded (playback continues). */
  maxAttempts?: number;
  /** Recovery bookkeeping for a clip, or undefined when it never stalled. */
  recoveryOf?: (clipId: string) => RecoveryRecord | undefined;
}

export const STARVATION_GRACE_MS = 700;
export const STARVATION_HARD_LIMIT_MS = 4000;
export const RECOVERY_COOLDOWN_MS = 600;
export const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * Decide, for one sync tick, whether the preview clock should stay frozen and
 * which starved elements should be actively recovered.
 *
 * The guarantee this function provides: `gate` can only be true for a stall
 * younger than `graceMs`. No input can keep the clock frozen indefinitely.
 */
export function decidePreviewGate(options: PreviewGateOptions): PreviewGateDecision {
  const {
    reports,
    nowMs,
    graceMs = STARVATION_GRACE_MS,
    hardLimitMs = STARVATION_HARD_LIMIT_MS,
    recoveryCooldownMs = RECOVERY_COOLDOWN_MS,
    maxAttempts = MAX_RECOVERY_ATTEMPTS,
    recoveryOf,
  } = options;

  const decision: PreviewGateDecision = { gate: false, recover: [], degraded: [] };
  if (reports.length === 0) return decision;

  for (const report of reports) {
    if (report.starvedForMs < graceMs) {
      // Fresh stall: this is what the freeze is for. Smooth it.
      decision.gate = true;
      continue;
    }

    const record = recoveryOf?.(report.clipId);
    const attempts = record?.attempts ?? 0;

    if (attempts >= maxAttempts) {
      // We already tried everything we are willing to try. Never wait again.
      decision.degraded.push(report.clipId);
      continue;
    }

    // ReadyState 0 means the element has no data at all (no load, or a dead
    // source): re-seeking cannot help, the whole load must be redone. A stall
    // older than the hard limit is treated the same way — whatever is wrong, the
    // element is not coming back on its own.
    const tier: RecoveryTier =
      report.readyState === 0 || report.starvedForMs >= hardLimitMs ? 'reload' : 'seek';

    const cooledDown = !record || nowMs - record.lastAtMs >= recoveryCooldownMs;
    if (cooledDown) decision.recover.push({ clipId: report.clipId, tier });
    // A stall past the grace window never closes the gate, whether or not this
    // tick happens to run a recovery attempt.
  }

  return decision;
}

/**
 * Whether a media element can present the frame at the playhead.
 * `readyState < HAVE_CURRENT_DATA (2)` means the decoder has not produced the
 * frame at `currentTime` yet; `seeking` means a seek is still in flight.
 */
export function isElementStarved(el: {
  readyState: number;
  seeking: boolean;
  hasSource: boolean;
}): boolean {
  if (!el.hasSource) return false; // nothing assigned yet — not a decode stall
  return el.seeking || el.readyState < 2;
}

/**
 * Human-readable one-liner for the console when a clip is given up on.
 * Kept here so the message is stable and testable.
 */
export function describeDegradedClip(clipId: string, starvedForMs: number, readyState: number): string {
  const seconds = (starvedForMs / 1000).toFixed(1);
  return (
    `[preview] clip ${clipId} could not produce frames for ${seconds}s ` +
    `(readyState ${readyState}). Playback continues; the element keeps retrying in the background.`
  );
}
