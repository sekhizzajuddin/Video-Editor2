/**
 * transitionEngine.ts
 *
 * Single source of truth for clip-to-clip transitions.
 *
 * Background
 * ----------
 * Transitions were previously stored on clips, drawn on the timeline and honoured
 * by the audio mixer, but **nothing ever rendered them visually**. The canvas
 * engine's draw queue simply pushed every clip active at `currentTime` and painted
 * them in track order, so at a cut the two clips either hard-cut or (when they
 * overlapped) the top one completely covered the bottom one. That is why
 * transitions "did not work": there was no compositing stage at all.
 *
 * This module supplies the missing piece, and deliberately keeps ALL transition
 * maths in one place so the preview canvas and the exporter can never drift apart
 * (a classic source of "looks fine in preview, broken in the export").
 *
 * Model
 * -----
 * A transition is a timed cross-fade window around a cut between two adjacent
 * clips on the same track:
 *
 *      outgoing clip (A)          incoming clip (B)
 *   ─────────────────────┬──────────────────────────
 *                   [ window ]
 *                    ^ boundary = B.startTime
 *
 * `progress` runs 0 → 1 across the window. At 0 the frame is 100% A, at 1 it is
 * 100% B. Each transition type is expressed as a pair of *draw instructions*
 * (opacity / offset / scale / clip-rect / overlay) rather than as imperative
 * canvas code, which keeps it renderer-agnostic and unit-testable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransitionAlignment = 'center' | 'left' | 'right';

export interface TransitionLike {
  id?: string;
  name?: string;
  type: string;
  duration: number;
  easing?: string;
  params?: Record<string, any>;
}

/** A resolved transition occurring between two specific clips. */
export interface ActiveTransition {
  transition: TransitionLike;
  /** Outgoing clip (drawn first / underneath). */
  from: any;
  /** Incoming clip (drawn second / on top). */
  to: any;
  /** Eased 0..1 position through the transition window. */
  progress: number;
  /** Raw (un-eased) 0..1 position — used for strictly-linear effects like flash. */
  rawProgress: number;
  windowStart: number;
  windowEnd: number;
}

/** How one of the two layers should be drawn for this frame. */
export interface LayerDraw {
  /** 0 = fully transparent, 1 = fully opaque. */
  opacity: number;
  /** Translation in *fractions of the frame* (1 = a whole frame width/height). */
  translateX: number;
  translateY: number;
  /** Uniform scale multiplier (1 = unchanged). */
  scale: number;
  /** Rotation in radians. */
  rotation: number;
  /**
   * Optional clip rectangle in normalised 0..1 frame coordinates. When present the
   * layer must only be painted inside this rect (used by wipes).
   */
  clipRect?: { x: number; y: number; w: number; h: number };
  /** Feather radius, in fractions of frame width, for a soft wipe edge. */
  clipFeather?: number;
  /** Whether the layer should be drawn at all (skips wasted GPU work). */
  visible: boolean;
}

/** A full-frame overlay drawn on top of both layers (flash, light leak…). */
export interface OverlayDraw {
  type: 'color' | 'none';
  color: string;
  alpha: number;
}

export interface TransitionPlan {
  from: LayerDraw;
  to: LayerDraw;
  overlay: OverlayDraw;
  /** Per-frame pixel effect to apply to the composited result. */
  postEffect: 'none' | 'rgbSplit' | 'pixelate';
  /** Strength 0..1 for `postEffect`. */
  postEffectAmount: number;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'smoothstep';

export function applyEasing(t: number, easing?: string): number {
  const x = clamp01(t);
  switch (easing) {
    case 'linear':
      return x;
    case 'easeIn':
      return x * x;
    case 'easeOut':
      return 1 - (1 - x) * (1 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'smoothstep':
    default:
      // Smoothstep is the pleasing default for cross-dissolves: it removes the
      // hard "start/stop" feel of a linear blend without over-shooting.
      return x * x * (3 - 2 * x);
  }
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Type normalisation
// ---------------------------------------------------------------------------

/**
 * Canonical transition kinds the renderer understands. The UI exposes 26 friendly
 * names; several map onto the same kind with different parameters.
 */
export type TransitionKind =
  | 'dissolve'
  | 'fadeToBlack'
  | 'fadeToWhite'
  | 'wipe'
  | 'slide'
  | 'push'
  | 'zoom'
  | 'zoomSpin'
  | 'flash'
  | 'shake'
  | 'glitch'
  | 'lightLeak'
  | 'whipPan'
  | 'pixelate';

export interface NormalizedTransition {
  kind: TransitionKind;
  /** Direction for wipe/slide/push/whip. */
  direction: 'left' | 'right' | 'up' | 'down';
  /** Zoom direction. */
  zoomDirection: 'in' | 'out';
  /** Edge softness 0..1 for wipes. */
  softness: number;
  /** Generic intensity 0..1 (shake amplitude, glitch strength…). */
  intensity: number;
  easing: string;
}

/**
 * Map a stored transition (which may only carry a display `name` such as
 * "Wipe Left Smooth") onto a canonical kind + parameters.
 *
 * Explicit `params` always win over anything inferred from the name, so the
 * Properties panel can fully override the drag-and-drop defaults.
 */
export function normalizeTransition(t: TransitionLike): NormalizedTransition {
  const p = t.params || {};
  const hay = `${t.type || ''} ${t.name || ''}`.toLowerCase();

  const has = (...needles: string[]) => needles.some((n) => hay.includes(n));

  let kind: TransitionKind = 'dissolve';
  if (has('fadetoblack', 'slow fade')) kind = 'fadeToBlack';
  else if (has('fadetowhite')) kind = 'fadeToWhite';
  else if (has('flash')) kind = 'flash';
  else if (has('rgb', 'glitch')) kind = 'glitch';
  else if (has('pixelate')) kind = 'pixelate';
  else if (has('light leak', 'lightleak')) kind = 'lightLeak';
  else if (has('whip')) kind = 'whipPan';
  else if (has('shake')) kind = 'shake';
  else if (has('spin')) kind = 'zoomSpin';
  else if (has('zoomrush', 'zoom rush')) kind = 'zoom';
  else if (has('zoom')) kind = 'zoom';
  else if (has('push')) kind = 'push';
  else if (has('slide')) kind = 'slide';
  else if (has('wipe')) kind = 'wipe';
  else if (has('dissolve', 'fade')) kind = has('fade') && !has('dissolve') ? 'dissolve' : 'dissolve';

  // Explicit override from the properties panel (validated — see isDirection).
  if (isTransitionKind(p.kind)) kind = p.kind;

  let direction: NormalizedTransition['direction'] = 'left';
  if (has('right')) direction = 'right';
  else if (has('up')) direction = 'up';
  else if (has('down')) direction = 'down';
  // Validate rather than trust: params come from persisted project files and the
  // AI copilot, so a bad value must fall back instead of producing NaN geometry.
  if (isDirection(p.direction)) direction = p.direction;

  let zoomDirection: 'in' | 'out' = has('out') ? 'out' : 'in';
  if (p.zoomDirection === 'in' || p.zoomDirection === 'out') zoomDirection = p.zoomDirection;

  // "Smooth"/"Cinematic" variants imply a feathered edge.
  const softDefault = has('smooth', 'cinematic') ? 0.25 : 0.0;
  const softness = clampRange(numOr(p.softness, softDefault), 0, 1);

  const intensity = clampRange(numOr(p.intensity, 0.5), 0, 1);

  const easing = typeof t.easing === 'string' && t.easing
    ? t.easing
    : typeof p.easing === 'string'
      ? p.easing
      : 'smoothstep';

  return { kind, direction, zoomDirection, softness, intensity, easing };
}

const VALID_KINDS: readonly string[] = [
  'dissolve', 'fadeToBlack', 'fadeToWhite', 'wipe', 'slide', 'push', 'zoom',
  'zoomSpin', 'flash', 'shake', 'glitch', 'lightLeak', 'whipPan', 'pixelate',
];

function isTransitionKind(v: any): v is TransitionKind {
  return typeof v === 'string' && VALID_KINDS.includes(v);
}

function isDirection(v: any): v is NormalizedTransition['direction'] {
  return v === 'left' || v === 'right' || v === 'up' || v === 'down';
}

function numOr(v: any, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampRange(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Window resolution
// ---------------------------------------------------------------------------

/**
 * Compute the [start, end] time window a transition occupies around a cut.
 *
 * The window is additionally clamped so it can never extend beyond either
 * neighbouring clip. Without this, a long transition on a short clip reaches back
 * past the previous cut and produces the flicker/"ghost frame" artefacts users
 * see, because two different transitions end up active on the same frame.
 */
export function getTransitionWindow(
  boundary: number,
  duration: number,
  alignment: TransitionAlignment,
  fromClip?: { startTime: number; duration: number },
  toClip?: { startTime: number; duration: number }
): { start: number; end: number; duration: number } {
  const safeDuration = Math.max(0, duration || 0);

  let start: number;
  switch (alignment) {
    case 'left':
      start = boundary;
      break;
    case 'right':
      start = boundary - safeDuration;
      break;
    case 'center':
    default:
      start = boundary - safeDuration / 2;
      break;
  }
  let end = start + safeDuration;

  // Never reach past the start of the outgoing clip or the end of the incoming one.
  if (fromClip) start = Math.max(start, fromClip.startTime);
  if (toClip) end = Math.min(end, toClip.startTime + toClip.duration);

  // Degenerate windows (duration 0, or clamped to nothing) are treated as absent.
  if (end <= start) return { start, end: start, duration: 0 };

  return { start, end, duration: end - start };
}

/**
 * Find the transition (if any) active at `time` on a single track.
 *
 * Rules:
 *  - Clips must be adjacent (gap under `maxGap`) — a transition across a visible
 *    gap is meaningless and used to render as a flash of background.
 *  - `transitionIn` on the incoming clip wins over `transitionOut` on the
 *    outgoing clip, matching the behaviour the audio mixer already assumed.
 *  - Only ONE transition can be active per track per frame. Overlapping windows
 *    are resolved deterministically by picking the one whose boundary is nearest
 *    to `time`; this prevents the double-composite flicker.
 */
export function findActiveTransition(
  clips: any[],
  time: number,
  maxGap: number = 0.1
): ActiveTransition | null {
  if (!clips || clips.length < 2) return null;

  // Work on a start-time-ordered copy so callers may pass unsorted tracks.
  const ordered = [...clips].sort((a, b) => a.startTime - b.startTime);

  let best: ActiveTransition | null = null;
  let bestDistance = Infinity;

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (prev.disabled || cur.disabled) continue;

    const gap = cur.startTime - (prev.startTime + prev.duration);
    if (Math.abs(gap) > maxGap) continue;

    const transition: TransitionLike | null =
      cur.transitionIn || prev.transitionOut || null;
    if (!transition || !(transition.duration > 0)) continue;

    const alignment = (transition.params?.alignment || 'center') as TransitionAlignment;
    const boundary = cur.startTime;
    const win = getTransitionWindow(boundary, transition.duration, alignment, prev, cur);
    if (win.duration <= 0) continue;

    if (time >= win.start && time < win.end) {
      const distance = Math.abs(time - boundary);
      if (distance < bestDistance) {
        bestDistance = distance;
        const rawProgress = clamp01((time - win.start) / win.duration);
        const norm = normalizeTransition(transition);
        best = {
          transition,
          from: prev,
          to: cur,
          rawProgress,
          progress: applyEasing(rawProgress, norm.easing),
          windowStart: win.start,
          windowEnd: win.end,
        };
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Plan building — the heart of the engine
// ---------------------------------------------------------------------------

function baseLayer(opacity: number): LayerDraw {
  return {
    opacity,
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0,
    visible: opacity > 0.001,
  };
}

/** Axis/sign helper for directional effects. */
function directionVector(direction: string): { dx: number; dy: number } {
  switch (direction) {
    case 'right':
      return { dx: 1, dy: 0 };
    case 'up':
      return { dx: 0, dy: -1 };
    case 'down':
      return { dx: 0, dy: 1 };
    case 'left':
    default:
      return { dx: -1, dy: 0 };
  }
}

/**
 * Turn an active transition into concrete draw instructions for both layers.
 *
 * This function is pure: same inputs → same output. That makes the whole
 * transition system deterministic, which is exactly what an exporter needs (the
 * export renders frame N at an arbitrary time with no playback history).
 */
export function buildTransitionPlan(active: ActiveTransition): TransitionPlan {
  const norm = normalizeTransition(active.transition);
  const t = clamp01(active.progress);
  const raw = clamp01(active.rawProgress);

  const from = baseLayer(1);
  const to = baseLayer(0);
  const overlay: OverlayDraw = { type: 'none', color: '#000000', alpha: 0 };
  let postEffect: TransitionPlan['postEffect'] = 'none';
  let postEffectAmount = 0;

  const { dx, dy } = directionVector(norm.direction);

  switch (norm.kind) {
    // ── Cross dissolve ────────────────────────────────────────────────────
    case 'dissolve': {
      from.opacity = 1 - t;
      to.opacity = t;
      break;
    }

    // ── Fade through a colour (dip to black / white) ──────────────────────
    case 'fadeToBlack':
    case 'fadeToWhite': {
      // First half fades A out to the colour, second half fades B in from it.
      // Both layers stay fully opaque and the overlay does the work, which avoids
      // the semi-transparent "see both clips at once" look of a plain dissolve.
      const colour = norm.kind === 'fadeToWhite' ? '#ffffff' : '#000000';
      overlay.type = 'color';
      overlay.color = colour;
      overlay.alpha = 1 - Math.abs(t - 0.5) * 2; // 0 → 1 → 0
      if (t < 0.5) {
        from.opacity = 1;
        to.opacity = 0;
      } else {
        from.opacity = 0;
        to.opacity = 1;
      }
      break;
    }

    // ── Wipe: B is revealed behind a moving edge ──────────────────────────
    case 'wipe': {
      from.opacity = 1;
      to.opacity = 1;
      // The incoming clip is clipped to a growing rectangle.
      if (dx !== 0) {
        // Horizontal wipe.
        to.clipRect = dx > 0
          ? { x: 0, y: 0, w: t, h: 1 }        // reveal from left edge rightwards
          : { x: 1 - t, y: 0, w: t, h: 1 };   // reveal from right edge leftwards
      } else {
        to.clipRect = dy > 0
          ? { x: 0, y: 0, w: 1, h: t }
          : { x: 0, y: 1 - t, w: 1, h: t };
      }
      to.clipFeather = norm.softness * 0.15;
      break;
    }

    // ── Slide: B slides in over a stationary A ────────────────────────────
    case 'slide': {
      from.opacity = 1;
      to.opacity = 1;
      // B starts one full frame away in the direction of travel and lands at 0.
      to.translateX = dx * (1 - t) * -1;
      to.translateY = dy * (1 - t) * -1;
      break;
    }

    // ── Push: B slides in AND pushes A out (both move as one strip) ───────
    case 'push': {
      from.opacity = 1;
      to.opacity = 1;
      // A travels a full frame in the push direction; B is rigidly attached one
      // frame "behind" it, so the pair moves as a single strip with no seam.
      from.translateX = dx * t;
      from.translateY = dy * t;
      to.translateX = from.translateX - dx;
      to.translateY = from.translateY - dy;
      break;
    }

    // ── Zoom ──────────────────────────────────────────────────────────────
    case 'zoom': {
      const strength = 0.5 + norm.intensity * 2.5;
      if (norm.zoomDirection === 'in') {
        // A rushes toward the viewer and fades; B settles in from slightly small.
        from.opacity = 1 - t;
        from.scale = 1 + t * strength;
        to.opacity = t;
        to.scale = 1 - (1 - t) * 0.25;
      } else {
        from.opacity = 1 - t;
        from.scale = 1 - t * 0.4;
        to.opacity = t;
        to.scale = 1 + (1 - t) * strength;
      }
      break;
    }

    case 'zoomSpin': {
      const spin = Math.PI * 2 * (0.5 + norm.intensity);
      from.opacity = 1 - t;
      from.scale = 1 - t * 0.5;
      from.rotation = t * spin;
      to.opacity = t;
      to.scale = 0.5 + t * 0.5;
      to.rotation = (t - 1) * spin;
      break;
    }

    // ── Flash: hard cut hidden behind a bright bloom ──────────────────────
    case 'flash': {
      // Use RAW progress: a flash must be perceptually linear or it looks laggy.
      overlay.type = 'color';
      overlay.color = '#ffffff';
      overlay.alpha = Math.pow(1 - Math.abs(raw - 0.5) * 2, 0.8);
      from.opacity = raw < 0.5 ? 1 : 0;
      to.opacity = raw < 0.5 ? 0 : 1;
      break;
    }

    // ── Light leak: warm bloom + gentle dissolve ──────────────────────────
    case 'lightLeak': {
      from.opacity = 1 - t;
      to.opacity = t;
      overlay.type = 'color';
      overlay.color = '#ff9a3c';
      overlay.alpha = (1 - Math.abs(t - 0.5) * 2) * (0.35 + norm.intensity * 0.4);
      break;
    }

    // ── Camera shake: dissolve plus positional jitter ─────────────────────
    case 'shake': {
      from.opacity = 1 - t;
      to.opacity = t;
      // Deterministic pseudo-jitter driven by progress (NOT Math.random, so that
      // export and preview agree frame-for-frame).
      const amp = 0.06 * (0.4 + norm.intensity) * (1 - Math.abs(t - 0.5) * 2);
      const j1 = Math.sin(t * 97.3) * amp;
      const j2 = Math.cos(t * 131.7) * amp;
      from.translateX = j1;
      from.translateY = j2;
      to.translateX = j1;
      to.translateY = j2;
      break;
    }

    // ── Glitch / RGB split ────────────────────────────────────────────────
    case 'glitch': {
      from.opacity = 1 - t;
      to.opacity = t;
      postEffect = 'rgbSplit';
      postEffectAmount = (1 - Math.abs(t - 0.5) * 2) * (0.3 + norm.intensity * 0.7);
      break;
    }

    // ── Pixelate ──────────────────────────────────────────────────────────
    case 'pixelate': {
      from.opacity = 1 - t;
      to.opacity = t;
      postEffect = 'pixelate';
      postEffectAmount = (1 - Math.abs(t - 0.5) * 2) * (0.3 + norm.intensity * 0.7);
      break;
    }

    // ── Whip pan: fast directional blur-like sweep ────────────────────────
    case 'whipPan': {
      // Both layers sweep hard in the same direction, crossing at the midpoint.
      const sweep = 1.15;
      from.opacity = 1 - t;
      to.opacity = t;
      from.translateX = dx * t * sweep;
      from.translateY = dy * t * sweep;
      to.translateX = dx * (t - 1) * sweep;
      to.translateY = dy * (t - 1) * sweep;
      break;
    }

    default: {
      from.opacity = 1 - t;
      to.opacity = t;
      break;
    }
  }

  from.visible = from.opacity > 0.001;
  to.visible = to.opacity > 0.001;

  return { from, to, overlay, postEffect, postEffectAmount };
}

/**
 * Audio cross-fade gains for a transition.
 *
 * Uses an equal-power (constant-energy) curve rather than a linear ramp: two
 * linearly-crossfaded uncorrelated sources dip by ~3dB in the middle, which is
 * audible as a "hole" in the audio exactly at the cut.
 */
export function getTransitionAudioGains(progress: number): { fromGain: number; toGain: number } {
  const t = clamp01(progress);
  return {
    fromGain: Math.cos((t * Math.PI) / 2),
    toGain: Math.cos(((1 - t) * Math.PI) / 2),
  };
}

/**
 * The set of transition kinds the Properties panel can offer, with the parameters
 * each one actually respects. Used to build the control UI so we never show a
 * slider that does nothing.
 */
export const TRANSITION_KIND_INFO: Array<{
  kind: TransitionKind;
  label: string;
  supports: Array<'direction' | 'zoomDirection' | 'softness' | 'intensity'>;
}> = [
  { kind: 'dissolve', label: 'Cross Dissolve', supports: [] },
  { kind: 'fadeToBlack', label: 'Fade to Black', supports: [] },
  { kind: 'fadeToWhite', label: 'Fade to White', supports: [] },
  { kind: 'wipe', label: 'Wipe', supports: ['direction', 'softness'] },
  { kind: 'slide', label: 'Slide Over', supports: ['direction'] },
  { kind: 'push', label: 'Push', supports: ['direction'] },
  { kind: 'zoom', label: 'Zoom', supports: ['zoomDirection', 'intensity'] },
  { kind: 'zoomSpin', label: 'Zoom Spin', supports: ['intensity'] },
  { kind: 'flash', label: 'Flash Cut', supports: [] },
  { kind: 'lightLeak', label: 'Light Leak', supports: ['intensity'] },
  { kind: 'shake', label: 'Camera Shake', supports: ['intensity'] },
  { kind: 'glitch', label: 'RGB Glitch', supports: ['intensity'] },
  { kind: 'pixelate', label: 'Pixelate', supports: ['intensity'] },
  { kind: 'whipPan', label: 'Whip Pan', supports: ['direction'] },
];

/**
 * Longest transition duration that still fits around the cut owning `clipId`.
 *
 * A transition needs room on BOTH sides of the boundary. If it is allowed to grow
 * longer than its neighbours it overlaps the next cut, two transition windows
 * become active on the same frame, and the preview flickers between them. Capping
 * the duration at source is far more predictable than clamping at render time.
 *
 * Returns a sensible default when the clip has no resolvable neighbour.
 */
export function getMaxTransitionDuration(
  tracks: Array<{ clips: any[] }>,
  clipId: string,
  fallback: number = 5
): number {
  for (const track of tracks) {
    const ordered = [...(track.clips || [])].sort((a, b) => a.startTime - b.startTime);
    const idx = ordered.findIndex((c) => c.id === clipId);
    if (idx === -1) continue;

    const clip = ordered[idx];
    // Which cut does this clip's transition sit on?
    const onIncomingEdge = !!clip.transitionIn;
    const neighbour = onIncomingEdge ? ordered[idx - 1] : ordered[idx + 1];
    if (!neighbour) return Math.min(fallback, clip.duration);

    // Half of the shorter clip on each side keeps a centred window inside both.
    const limit = Math.min(clip.duration, neighbour.duration);
    return Math.max(0.1, Math.min(fallback, limit));
  }
  return fallback;
}

export const TRANSITION_EASINGS: Array<{ value: EasingName; label: string }> = [
  { value: 'smoothstep', label: 'Smooth (default)' },
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In-Out' },
];
