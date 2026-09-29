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
  soundEffect?: string;
  soundVolume?: number;
}

/** A resolved transition occurring between two specific clips. */
export interface ActiveTransition {
  transition: TransitionLike;
  /** Outgoing clip (drawn first / underneath), or null if standalone In transition. */
  from: any | null;
  /** Incoming clip (drawn second / on top), or null if standalone Out transition. */
  to: any | null;
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
  /** Optional NON-uniform scale multipliers (default 1) — card flips, squashes. */
  scaleX?: number;
  scaleY?: number;
  /** Rotation in radians. */
  rotation: number;
  /**
   * Optional clip rectangle in normalised 0..1 frame coordinates. When present the
   * layer must only be painted inside this rect (used by wipes).
   */
  clipRect?: { x: number; y: number; w: number; h: number };
  /** Feather radius, in fractions of frame width, for a soft wipe edge. */
  clipFeather?: number;
  /**
   * Optional circular clip (iris / circle wipe), normalised frame coordinates,
   * radius as a fraction of frame width. Rendered as a hard (unfeathered) edge.
   */
  clipCircle?: { x: number; y: number; r: number };
  /**
   * Optional clock/clock-wipe wedge clip: normalised centre, `angle` = sweep in
   * radians starting straight up (12 o'clock), clockwise.
   */
  clipWedge?: { cx: number; cy: number; angle: number };
  /**
   * Direction-independent blur, as a fraction of frame width. Used by professional
   * motion transitions (blur dissolve). Renderers apply it to the layer's own
   * buffer only — never to the shared composite.
   */
  blur?: number;
  /**
   * Particle/noise reveal: the layer is masked by a deterministic hash-noise
   * grid; cells with hash < amount are kept. Fully deterministic (preview ==
   * export, seek-safe). `cell` is the cell size as a fraction of frame height.
   * `invert: true` keeps cells with hash >= amount instead (erosion mask).
   */
  noiseReveal?: { amount: number; cell: number; invert?: boolean };
  /**
   * In-air particle flow: the cells of the layer that are CURRENTLY in the
   * transition band (hash ≈ center) detach and drift with the wind — rendered
   * as 2 fading trail passes offset by wind×k. This is what makes the pixels
   * visibly fly through the air before they dissolve, instead of a static
   * checkerboard swap.
   */
  noiseTrail?: { cell: number; center: number; windX: number; windY: number };
  /**
   * Slice disassembly: the layer is cut into `count` strips along `axis` and
   * adjacent strips are offset perpendicular by ±`spread` (fraction of frame).
   * spread 0 = intact frame. Used by Disassemble / Assemble transitions.
   */
  slices?: { count: number; axis: 'x' | 'y'; spread: number };
  /** Whether the layer should be drawn at all (skips wasted GPU work). */
  visible: boolean;
}

/** A full-frame overlay drawn on top of both layers (flash, light leak…). */
export interface OverlayDraw {
  type: 'color' | 'edgeGradient' | 'none';
  color: string;
  alpha: number;
  /**
   * 'edgeGradient' only: normalized rect the gradient band occupies, and the
   * direction in which alpha fades to zero (gradient starts fully coloured).
   * Used by paper-fold shading that must follow the fold lip.
   */
  rect?: { x: number; y: number; w: number; h: number };
  gradientDir?: 'left' | 'right' | 'up' | 'down';
}

/** Per-frame pixel effects applied to the composited transition frame. */
export type TransitionPostEffectType = 'none' | 'rgbSplit' | 'pixelate';

export interface TransitionPlan {
  from: LayerDraw;
  to: LayerDraw;
  overlay: OverlayDraw;
  /** Per-frame pixel effect to apply to the composited result. */
  postEffect: TransitionPostEffectType;
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
  | 'pixelate'
  // ── Professional set ──
  | 'blurDissolve'
  | 'circleWipe'
  | 'cardFlip'
  | 'zoomBounce'
  | 'clockWipe'
  // ── Premium set ──
  | 'paperFold'
  | 'particleDissolve'
  | 'sliceShift';

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
  /** Sound effect ID (preset key or 'media:<id>' or 'none'). */
  soundEffect: string;
  /** Sound volume 0..1. */
  soundVolume: number;
}

export interface TransitionSoundOption {
  id: string;
  label: string;
  category: string;
  description: string;
  recommendedFor?: TransitionKind[];
}

export const TRANSITION_SOUND_OPTIONS: TransitionSoundOption[] = [
  { id: 'none', label: 'No Sound', category: 'None', description: 'Silent transition' },
  { id: 'swoosh', label: 'Air Swoosh', category: 'Whoosh', description: 'Smooth, natural air whoosh', recommendedFor: ['dissolve', 'wipe', 'slide', 'fadeToBlack', 'fadeToWhite'] },
  { id: 'fast_whoosh', label: 'Fast Whip Whoosh', category: 'Whoosh', description: 'High-speed snappy motion whoosh', recommendedFor: ['push', 'whipPan', 'slide', 'zoom'] },
  { id: 'deep_whoosh', label: 'Deep Cinematic Swell', category: 'Cinematic', description: 'Low-frequency sub-bass swell', recommendedFor: ['fadeToBlack', 'fadeToWhite', 'dissolve'] },
  { id: 'whip', label: 'Whip Pan Snap', category: 'Whoosh', description: 'Snappy whip pan camera motion', recommendedFor: ['whipPan', 'push'] },
  { id: 'glitch', label: 'Digital Glitch', category: 'Sci-Fi', description: 'Cyberpunk digital bitcrush & buzz', recommendedFor: ['glitch', 'pixelate'] },
  { id: 'impact', label: 'Cinematic Hit', category: 'Impact', description: 'Heavy impact with resonant tail', recommendedFor: ['shake', 'flash'] },
  { id: 'flash', label: 'Flash Riser', category: 'Light', description: 'Bright white flash resonant riser', recommendedFor: ['flash', 'lightLeak'] },
  { id: 'shutter', label: 'Camera Shutter', category: 'Mechanical', description: 'Mechanical camera aperture click', recommendedFor: ['flash', 'dissolve', 'circleWipe'] },
  { id: 'page_turn', label: 'Paper Page Turn', category: 'Organic', description: 'Crisp paper swish', recommendedFor: ['wipe', 'slide', 'cardFlip'] },
  { id: 'pop', label: 'Bubble Pop', category: 'Playful', description: 'Crisp playful pop', recommendedFor: ['zoom', 'zoomSpin', 'zoomBounce'] },
  { id: 'riser', label: 'Cinematic Riser', category: 'Cinematic', description: 'Tension-building ascent that resolves at the cut', recommendedFor: ['blurDissolve', 'lightLeak', 'flash', 'fadeToWhite'] },
  { id: 'suck_reverse', label: 'Reverse Suck-Back', category: 'Cinematic', description: 'Reversed cymbal swell that inhales into the cut', recommendedFor: ['zoomBounce', 'circleWipe', 'zoom'] },
  { id: 'camera_servo', label: 'Camera Servo', category: 'Mechanical', description: 'Precision lens-motor whirr for iris moves', recommendedFor: ['circleWipe', 'clockWipe', 'zoom'] },
  { id: 'shimmer', label: 'Magic Shimmer', category: 'Light', description: 'Glittering particle sparkle sweep', recommendedFor: ['particleDissolve', 'lightLeak'] },
  { id: 'paper_sweep', label: 'Paper Sweep', category: 'Organic', description: 'Rustling page-fold swish with soft thud landing', recommendedFor: ['paperFold'] },
  { id: 'shatter_hit', label: 'Shatter Burst', category: 'Impact', description: 'Crackling burst with low impact tail', recommendedFor: ['sliceShift'] },
];

/**
 * The first recommended preset sound for a transition kind — used to
 * auto-attach a tasteful default when a transition is dropped onto the
 * timeline (the user can still change or remove it in Transition Settings).
 */
export function getDefaultSoundForKind(kind: TransitionKind): string {
  const opt = TRANSITION_SOUND_OPTIONS.find((o) => o.recommendedFor?.includes(kind));
  return opt && opt.id !== 'none' ? opt.id : 'none';
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
  // ── Professional set (matched before the generic 'wipe'/'zoom' fallbacks) ──
  else if (has('blur dissolve', 'blurdissolve', 'cross blur', 'gaussian')) kind = 'blurDissolve';
  else if (has('iris', 'circle wipe', 'circlewipe')) kind = 'circleWipe';
  else if (has('card flip', 'cardflip', 'flip')) kind = 'cardFlip';
  else if (has('elastic', 'bounce')) kind = 'zoomBounce';
  else if (has('clock')) kind = 'clockWipe';
  // ── Premium set ──
  else if (has('paper fold', 'paperfold', 'page fold', 'fold')) kind = 'paperFold';
  else if (has('particle')) kind = 'particleDissolve';
  // "disassemble" contains "assemble" — match it FIRST.
  else if (has('disassemble', 'shatter', 'slice')) kind = 'sliceShift';
  else if (has('assemble')) kind = 'sliceShift';
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
  else if (has('up', 'top')) direction = 'up';
  else if (has('down', 'bottom')) direction = 'down';
  // Validate rather than trust: params come from persisted project files and the
  // AI copilot, so a bad value must fall back instead of producing NaN geometry.
  if (isDirection(p.direction)) direction = p.direction;

  let zoomDirection: 'in' | 'out' = (has('out') || has('disassemble', 'shatter')) ? 'out' : 'in';
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

  const soundEffect = typeof t.soundEffect === 'string'
    ? t.soundEffect
    : typeof p.soundEffect === 'string'
      ? p.soundEffect
      : 'none';

  const soundVolume = typeof t.soundVolume === 'number'
    ? clampRange(t.soundVolume, 0, 1)
    : typeof p.soundVolume === 'number'
      ? clampRange(p.soundVolume, 0, 1)
      : 0.8;

  return { kind, direction, zoomDirection, softness, intensity, easing, soundEffect, soundVolume };
}

const VALID_KINDS: readonly string[] = [
  'dissolve', 'fadeToBlack', 'fadeToWhite', 'wipe', 'slide', 'push', 'zoom',
  'zoomSpin', 'flash', 'shake', 'glitch', 'lightLeak', 'whipPan', 'pixelate',
  'blurDissolve', 'circleWipe', 'cardFlip', 'zoomBounce', 'clockWipe',
  'paperFold', 'particleDissolve', 'sliceShift',
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
  fromClip?: { startTime: number; duration: number } | null,
  toClip?: { startTime: number; duration: number } | null
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
  if (fromClip) {
    start = Math.max(start, fromClip.startTime);
  } else if (toClip) {
    // Standalone In: clamp start to toClip.startTime
    start = Math.max(start, toClip.startTime);
  }

  if (toClip) {
    end = Math.min(end, toClip.startTime + toClip.duration);
  } else if (fromClip) {
    // Standalone Out: clamp end to fromClip end
    end = Math.min(end, fromClip.startTime + fromClip.duration);
  }

  // Degenerate windows (duration 0, or clamped to nothing) are treated as absent.
  if (end <= start) return { start, end: start, duration: 0 };

  return { start, end, duration: end - start };
}

/**
 * Find the transition (if any) active at `time` on a single track.
 *
 * Rules:
 *  - Handles both joined cuts between adjacent clips AND standalone transitions
 *    (e.g. clip-in or clip-out transitions where no adjacent clip is joined).
 *  - For joined cuts, `transitionIn` on the incoming clip wins over `transitionOut`
 *    on the outgoing clip.
 *  - For standalone clips, a transition plays alone when alignment is "Start at Cut"
 *    ('left') for In transitions, or "End at Cut" ('right') for Out transitions.
 *  - Only ONE transition can be active per track per frame. Overlapping windows
 *    are resolved deterministically by picking the one whose boundary is nearest
 *    to `time`; this prevents double-composite flicker.
 */
export function findActiveTransition(
  clips: any[],
  time: number,
  maxGap: number = 0.1
): ActiveTransition | null {
  if (!clips || clips.length === 0) return null;

  // Work on a start-time-ordered copy so callers may pass unsorted tracks.
  const ordered = [...clips].sort((a, b) => a.startTime - b.startTime);

  let best: ActiveTransition | null = null;
  let bestDistance = Infinity;

  // 1. Scan joined cuts between adjacent clips
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

  // 2. Scan standalone transitions (clips without an adjacent joining clip)
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    if (cur.disabled) continue;

    // 2a. Standalone Transition In (clip start edge with no joined preceding clip)
    if (cur.transitionIn && cur.transitionIn.duration > 0) {
      const prev = i > 0 ? ordered[i - 1] : null;
      const isJoinedPrev = prev && !prev.disabled && Math.abs(cur.startTime - (prev.startTime + prev.duration)) <= maxGap;
      if (!isJoinedPrev) {
        const alignment = cur.transitionIn.params?.alignment;
        // User rule: plays alone if adjoint clip not found ONLY if user set the Transition Start At Cut in Alignment Setting ('left')
        if (alignment === 'left') {
          const boundary = cur.startTime;
          const win = getTransitionWindow(boundary, cur.transitionIn.duration, 'left', null, cur);
          if (win.duration > 0 && time >= win.start && time < win.end) {
            const distance = Math.abs(time - boundary);
            if (distance < bestDistance) {
              bestDistance = distance;
              const rawProgress = clamp01((time - win.start) / win.duration);
              const norm = normalizeTransition(cur.transitionIn);
              best = {
                transition: cur.transitionIn,
                from: null,
                to: cur,
                rawProgress,
                progress: applyEasing(rawProgress, norm.easing),
                windowStart: win.start,
                windowEnd: win.end,
              };
            }
          }
        }
      }
    }

    // 2b. Standalone Transition Out (clip end edge with no joined succeeding clip)
    if (cur.transitionOut && cur.transitionOut.duration > 0) {
      const next = i + 1 < ordered.length ? ordered[i + 1] : null;
      const isJoinedNext = next && !next.disabled && Math.abs(next.startTime - (cur.startTime + cur.duration)) <= maxGap;
      if (!isJoinedNext) {
        const alignment = cur.transitionOut.params?.alignment;
        // User rule: plays alone if adjoint clip not found ONLY if user set the Transition End At Cut in Alignment Setting ('right')
        if (alignment === 'right') {
          const boundary = cur.startTime + cur.duration;
          const win = getTransitionWindow(boundary, cur.transitionOut.duration, 'right', cur, null);
          if (win.duration > 0 && time >= win.start && time < win.end) {
            const distance = Math.abs(time - boundary);
            if (distance < bestDistance) {
              bestDistance = distance;
              const rawProgress = clamp01((time - win.start) / win.duration);
              const norm = normalizeTransition(cur.transitionOut);
              best = {
                transition: cur.transitionOut,
                from: cur,
                to: null,
                rawProgress,
                progress: applyEasing(rawProgress, norm.easing),
                windowStart: win.start,
                windowEnd: win.end,
              };
            }
          }
        }
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

    // ── Whip pan: fast directional sweep WITH motion blur ─────────────────
    // A bare geometric sweep reads as "slide"; real whip pans smear. Blur
    // peaks at sweep maximum (mid-transition) — the same blurDissolve channel.
    case 'whipPan': {
      const sweep = 1.15;
      const smear = (0.015 + norm.intensity * 0.02) * (1 - Math.abs(t - 0.5) * 2);
      from.opacity = 1 - t;
      to.opacity = t;
      from.translateX = dx * t * sweep;
      from.translateY = dy * t * sweep;
      to.translateX = dx * (t - 1) * sweep;
      to.translateY = dy * (t - 1) * sweep;
      from.blur = smear;
      to.blur = smear;
      break;
    }

    // ── Blur Dissolve (Resolve-style "cross blur") ────────────────────────
    // Equal cross-fade with a motion-blur peak exactly at the midpoint where
    // both images are weakest — the blur masks the 50/50 "double image".
    case 'blurDissolve': {
      const peak = 0.012 + norm.intensity * 0.03; // fraction of frame width
      const b = peak * (1 - Math.abs(t - 0.5) * 2);
      from.opacity = 1 - t;
      to.opacity = t;
      from.blur = b;
      to.blur = b;
      break;
    }

    // ── Iris / Circle wipe ────────────────────────────────────────────────
    // 'in': B is revealed by a circle growing from frame centre.
    // 'out': A is swallowed by a shrinking circle, revealing B beneath.
    case 'circleWipe': {
      // Diagonal coverage: a radius of half the frame diagonal (in frame-width
      // units for the widest axis) guarantees the circle covers the corners.
      const maxR = 0.75;
      from.opacity = 1;
      to.opacity = 1;
      if (norm.zoomDirection === 'out') {
        from.clipCircle = { x: 0.5, y: 0.5, r: Math.max(0.0001, (1 - t) * maxR) };
      } else {
        to.clipCircle = { x: 0.5, y: 0.5, r: Math.max(0.0001, t * maxR) };
      }
      break;
    }

    // ── 3D card flip ──────────────────────────────────────────────────────
    // First half: A rotates away around a central axis (scale squash is the
    // classic 2.5-D card illusion). Second half: B flips in from the edge-on
    // position. Direction picks horizontal (left/right) or vertical (up/down)
    // flip axis.
    case 'cardFlip': {
      const horizontal = norm.direction !== 'up' && norm.direction !== 'down';
      if (t < 0.5) {
        const c = Math.cos(t * Math.PI); // 2t*π/2 — 1 → 0
        from.opacity = 1;
        to.opacity = 0;
        if (horizontal) from.scaleX = Math.max(0.001, c);
        else from.scaleY = Math.max(0.001, c);
      } else {
        const c = Math.cos((t - 1) * Math.PI); // 0 → 1 over the second half
        from.opacity = 0;
        to.opacity = 1;
        if (horizontal) to.scaleX = Math.max(0.001, c);
        else to.scaleY = Math.max(0.001, c);
      }
      break;
    }

    // ── Elastic zoom (bounce) ─────────────────────────────────────────────
    // B zooms in from small with a springy overshoot at the end; A recedes.
    case 'zoomBounce': {
      // easeOutBack: e(0)=0, e(1)=1, with a genuine overshoot > 1 around t≈0.8.
      // Landing exactly on 1 at the end keeps the final frame seamless.
      const s = 1.2 + norm.intensity * 1.6;
      const u = t - 1;
      const e = 1 + (s + 1) * u * u * u + s * u * u;
      from.opacity = 1 - t;
      from.scale = 1 - t * 0.2;
      to.opacity = t;
      to.scale = 0.6 + 0.4 * e;
      break;
    }

    // ── Clock wipe ────────────────────────────────────────────────────────
    // B sweeps in like a clock hand starting at 12 o'clock.
    case 'clockWipe': {
      from.opacity = 1;
      to.opacity = 1;
      to.clipWedge = { cx: 0.5, cy: 0.5, angle: t * Math.PI * 2 };
      break;
    }

    // ── Paper fold ────────────────────────────────────────────────────────
    // B folds open over A like turning a page: the revealed region grows while
    // the "page" un-squashes (3-D illusion), and a soft shadow band follows
    // the fold lip. Direction picks the edge the page unfolds FROM:
    // left/right/top.
    case 'paperFold': {
      from.opacity = 1;
      to.opacity = 1;
      // Fast-flattening un-squash: foreshortened page flops flat quickly,
      // which reads as a hinge rather than a conveyor belt.
      const squash = 0.25 + 0.75 * (1 - Math.pow(1 - t, 2));
      // Wavy flutter: decaying rotation wobble while the page is airborne.
      const wob = Math.sin(t * Math.PI * 2.5) * (1 - t);
      to.rotation = wob * 0.045; // ≈ ±2.6° at peak
      // Perpendicular page bob: horizontal folds bob vertically and vice
      // versa — a real page edge never travels in a straight line.
      const bob = Math.sin(t * Math.PI * 3) * (1 - t) * 0.018;

      const lip = 0.055; // shadow band width (frame fraction)
      const shadowAlpha = (1 - t) * 0.55;

      if (norm.direction === 'right') {
        to.clipRect = { x: 1 - t, y: 0, w: t, h: 1 };
        to.scaleX = squash;
        to.translateY = bob; // perpendicular to the fold travel
        overlay.type = 'edgeGradient';
        overlay.color = '#000000';
        overlay.alpha = shadowAlpha;
        overlay.rect = { x: Math.max(0, 1 - t), y: 0, w: lip, h: 1 };
        overlay.gradientDir = 'right';
      } else if (norm.direction === 'up' || norm.direction === 'down') {
        const isDown = norm.direction === 'down';
        to.clipRect = isDown
          ? { x: 0, y: 1 - t, w: 1, h: t }
          : { x: 0, y: 0, w: 1, h: t };
        to.scaleY = squash;
        to.translateX = bob; // perpendicular to the fold travel
        overlay.type = 'edgeGradient';
        overlay.color = '#000000';
        overlay.alpha = shadowAlpha;
        overlay.rect = isDown
          ? { x: 0, y: 1 - t, w: 1, h: lip }
          : { x: 0, y: Math.max(0, t - lip), w: 1, h: lip };
        overlay.gradientDir = isDown ? 'down' : 'up';
      } else {
        to.clipRect = { x: 0, y: 0, w: t, h: 1 };
        to.scaleX = squash;
        to.translateY = bob;
        overlay.type = 'edgeGradient';
        overlay.color = '#000000';
        overlay.alpha = shadowAlpha;
        overlay.rect = { x: Math.max(0, t - lip), y: 0, w: lip, h: 1 };
        overlay.gradientDir = 'left';
      }
      break;
    }

    // ── Particle dissolve ─────────────────────────────────────────────────
    // B materialises cell-by-cell over A through a deterministic noise grid.
    // The hash-noise mask is resolution-independent and identical in preview
    // and export (no Math.random → frame-seek safe).
    case 'particleDissolve': {
      from.opacity = 1;
      to.opacity = 1;
      const cell = Math.max(0.008, 0.04 - norm.intensity * 0.03);
      // B materialises slightly AHEAD of the front (no holes ever appear).
      to.noiseReveal = { amount: Math.min(1, t * 1.2), cell };
      // A erodes behind the front: pixels vanish where they detach.
      from.noiseReveal = { amount: Math.min(1, t * 1.05), cell, invert: true };
      // The cells AT the front lift off and flow through the air with the
      // wind (convection: up and sideways) before fading out.
      from.noiseTrail = {
        cell,
        center: t,
        windX: -(0.05 + norm.intensity * 0.07),
        windY: -(0.03 + norm.intensity * 0.04),
      };
      break;
    }

    // ── Slice shift (MERGED disassemble + assemble) ───────────────────────
    // A bursts into strips that slide apart WHILE B's strips fly in from
    // alternating sides and converge into place — one continuous hand-off.
    case 'sliceShift': {
      const axis: 'x' | 'y' =
        norm.direction === 'left' || norm.direction === 'right' ? 'x' : 'y';
      const count = 8;
      const mag = 0.16 + norm.intensity * 0.35;
      // Outgoing clip disassembles progressively.
      from.opacity = 1 - t * 0.45;
      from.slices = { count, axis, spread: t * mag };
      // Incoming clip assembles: strips converge to a clean frame by t=1.
      to.opacity = 0.3 + 0.7 * t;
      to.slices = { count, axis, spread: (1 - t) * mag };
      break;
    }

    default: {
      from.opacity = 1 - t;
      to.opacity = t;
      break;
    }
  }

  // Standalone transition handling (when from or to clip is absent)
  if (!active.from) {
    from.visible = false;
    from.opacity = 0;
    if (norm.kind === 'fadeToBlack' || norm.kind === 'fadeToWhite') {
      overlay.alpha = 1 - t;
      to.opacity = 1;
      to.visible = true;
    } else if (norm.kind === 'flash') {
      overlay.alpha = 1 - raw;
      to.opacity = 1;
      to.visible = true;
    }
  } else {
    from.visible = from.opacity > 0.001;
  }

  if (!active.to) {
    to.visible = false;
    to.opacity = 0;
    if (norm.kind === 'fadeToBlack' || norm.kind === 'fadeToWhite') {
      overlay.alpha = t;
      from.opacity = 1;
      from.visible = true;
    } else if (norm.kind === 'flash') {
      overlay.alpha = raw;
      from.opacity = 1 - raw;
      from.visible = from.opacity > 0.001;
    }
  } else {
    to.visible = to.opacity > 0.001;
  }

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
 * Apply a transition's full-frame pixel post-effect (rgbSplit / pixelate) to an
 * already-composited frame.
 *
 * Lives here — not in the renderers — so the preview canvas and the exporter
 * can never drift apart on how these effects look (the classic "fine in
 * preview, wrong in the export" failure).
 *
 * Works with both HTMLCanvasElement and OffscreenCanvas 2D contexts, so it is
 * safe to call inside the export worker (where `document` does not exist).
 * `ctx` must be in the frame's own pixel space: getImageData/putImageData
 * ignore transforms and operate on device pixels of the target canvas.
 */
export function applyTransitionPostEffect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  type: 'none' | 'rgbSplit' | 'pixelate',
  amount: number
): void {
  if (type === 'none' || !(amount > 0.001) || w <= 0 || h <= 0) return;
  try {
    if (type === 'rgbSplit') {
      const src = ctx.getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);
      const s = src.data;
      const d = out.data;
      const off = Math.max(1, Math.round(amount * Math.max(3, w * 0.02)));
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const i = (row + x) * 4;
          const rx = Math.min(w - 1, x + off);
          const bx = Math.max(0, x - off);
          d[i] = s[(row + rx) * 4];          // R shifted right
          d[i + 1] = s[i + 1];               // G stays
          d[i + 2] = s[(row + bx) * 4 + 2];  // B shifted left
          d[i + 3] = s[i + 3];
        }
      }
      ctx.putImageData(out, 0, 0);
    } else if (type === 'pixelate') {
      // Downscale to a blocky resolution, then upscale with smoothing disabled
      // so each block has hard edges (the classic mosaic look).
      const blocks = Math.max(4, Math.round(48 * (1 - amount * 0.85)));
      const bw = Math.max(1, Math.round(w / blocks));
      const bh = Math.max(1, Math.round(h / blocks));
      const tmp = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(bw, bh)
        : document.createElement('canvas');
      tmp.width = bw;
      tmp.height = bh;
      const tctx = tmp.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!tctx) return;
      tctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, bw, bh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, bw, bh, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
    }
  } catch {
    /* ignore: read-back can fail on a tainted canvas */
  }
}

/**
 * Apply a soft-edged rectangular clip onto a context whose canvas already
 * contains the layer content, via a destination-in gradient mask.
 *
 * The wipe `clipRect` from buildTransitionPlan has ONE moving edge (the reveal
 * edge); softening happens only on that edge, exactly like Premiere's
 * "Border" parameter on a wipe. Hard edge orientation is derived from the
 * rect geometry so preview and export can never disagree.
 *
 * Worker-safe (OffscreenCanvas first).
 */
export function applyFeatheredRectMask(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  clipRect: { x: number; y: number; w: number; h: number },
  featherFrac: number,
  w: number,
  h: number
): void {
  if (!(featherFrac > 0.0005)) return;
  const mask = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const m = mask.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!m) return;

  const rx = clipRect.x * w;
  const ry = clipRect.y * h;
  const rw = clipRect.w * w;
  const rh = clipRect.h * h;

  m.clearRect(0, 0, w, h);
  m.fillStyle = '#ffffff';

  const horizontal = clipRect.h >= 0.999 && clipRect.w < 0.999;
  const vertical = clipRect.w >= 0.999 && clipRect.h < 0.999;

  if (horizontal) {
    // Reveal edge on the right when the rect grows from the left (x≈0),
    // on the left when it grows from the right.
    const fromLeft = clipRect.x <= 0.001;
    const edge = fromLeft ? rx + rw : rx;
    const f = Math.min(featherFrac * w, rw);
    const inner = fromLeft ? rx : rx + f;
    const innerW = Math.max(0, rw - f);
    m.fillRect(inner, ry, innerW, rh);
    if (f > 0.5) {
      const g = fromLeft
        ? m.createLinearGradient(edge - f, 0, edge, 0)
        : m.createLinearGradient(edge + f, 0, edge, 0);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = g;
      m.fillRect(fromLeft ? edge - f : edge, ry, f, rh);
    }
  } else if (vertical) {
    const fromTop = clipRect.y <= 0.001;
    const edge = fromTop ? ry + rh : ry;
    const f = Math.min(featherFrac * h, rh);
    const inner = fromTop ? ry : ry + f;
    const innerH = Math.max(0, rh - f);
    m.fillRect(rx, inner, rw, innerH);
    if (f > 0.5) {
      const g = fromTop
        ? m.createLinearGradient(0, edge - f, 0, edge)
        : m.createLinearGradient(0, edge + f, 0, edge);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = g;
      m.fillRect(rx, fromTop ? edge - f : edge, rw, f);
    }
  } else {
    // Non-wipe rect (arbitrary): feather all four edges via a blur of the mask.
    m.save();
    m.filter = `blur(${Math.max(1, featherFrac * Math.min(w, h))}px)`;
    m.fillRect(rx, ry, rw, rh);
    m.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask as CanvasImageSource, 0, 0);
  ctx.restore();
}

/**
 * Deterministic hash-noise reveal mask (particle dissolve). Cells of `cell`×`cell`
 * (fractions of frame height) are kept where hash(i,j) < amount, with a small
 * smooth boundary so cells fade in over ~0.12 of progress rather than popping.
 *
 * Deterministic by construction (sin-hash, no Math.random): preview, export and
 * arbitrary frame seeks all produce the exact same mask.
 *
 * Worker-safe: uses OffscreenCanvas when available.
 */
export function applyNoiseRevealMask(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  amount: number,
  cellFrac: number,
  w: number,
  h: number,
  invert: boolean = false
): void {
  const a = clamp01(amount);
  if (!invert && a >= 1) return; // fully revealed — nothing to mask
  if (invert && a <= 0) return;  // nothing eroded yet — nothing to mask
  if ((!invert && a <= 0) || (invert && a >= 1)) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.clearRect(0, 0, w, h); // destination-in with fully transparent = clear
    ctx.restore();
    return;
  }

  const mask = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const m = mask.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!m) return;

  const cellPx = Math.max(2, Math.round(cellFrac * h));
  const cols = Math.ceil(w / cellPx);
  const rows = Math.ceil(h / cellPx);
  const soft = 0.12; // boundary smoothness in progress units

  const img = m.createImageData(w, h);
  const d = img.data;
  // Precompute per-cell alpha (small), then splat — O(cells) work, O(pixels) fill.
  const cellAlpha = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453123;
      const hash = s - Math.floor(s);
      const v = invert ? (hash - a) / soft : (a - hash) / soft;
      cellAlpha[j * cols + i] = v <= 0 ? 0 : v >= 1 ? 255 : v * 255;
    }
  }
  for (let y = 0; y < h; y++) {
    const j = Math.min(rows - 1, (y / cellPx) | 0);
    const rowBase = j * cols;
    const outRow = y * w;
    for (let x = 0; x < w; x++) {
      const i = Math.min(cols - 1, (x / cellPx) | 0);
      const idx = (outRow + x) * 4;
      const al = cellAlpha[rowBase + i];
      d[idx] = 255;
      d[idx + 1] = 255;
      d[idx + 2] = 255;
      d[idx + 3] = al;
    }
  }
  m.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask as CanvasImageSource, 0, 0);
  ctx.restore();
}


/**
 * Keep only the noise cells in a BAND around `center` (hash within
 * [center - halfWidth, center + halfWidth]) — i.e. the cells currently in the
 * dissolve front. Combined with a draw offset this renders the "in-flight"
 * particles of a particle dissolve.
 */
export function applyNoiseBandMask(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  center: number,
  halfWidth: number,
  cellFrac: number,
  w: number,
  h: number
): void {
  const mask = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const m = mask.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!m) return;

  const cellPx = Math.max(2, Math.round(cellFrac * h));
  const cols = Math.ceil(w / cellPx);
  const rows = Math.ceil(h / cellPx);
  const lo = center - halfWidth;
  const hi = center + halfWidth;

  const img = m.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const j = Math.min(rows - 1, (y / cellPx) | 0);
    const outRow = y * w;
    for (let x = 0; x < w; x++) {
      const i = Math.min(cols - 1, (x / cellPx) | 0);
      const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453123;
      const hash = s - Math.floor(s);
      const idx = (outRow + x) * 4;
      d[idx] = 255;
      d[idx + 1] = 255;
      d[idx + 2] = 255;
      d[idx + 3] = hash >= lo && hash <= hi ? 255 : 0;
    }
  }
  m.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask as CanvasImageSource, 0, 0);
  ctx.restore();
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
  { kind: 'blurDissolve', label: 'Blur Dissolve', supports: ['intensity'] },
  { kind: 'fadeToBlack', label: 'Fade to Black', supports: [] },
  { kind: 'fadeToWhite', label: 'Fade to White', supports: [] },
  { kind: 'wipe', label: 'Wipe', supports: ['direction', 'softness'] },
  { kind: 'clockWipe', label: 'Clock Wipe', supports: [] },
  { kind: 'circleWipe', label: 'Circle Wipe (Iris)', supports: ['zoomDirection'] },
  { kind: 'slide', label: 'Slide Over', supports: ['direction'] },
  { kind: 'push', label: 'Push', supports: ['direction'] },
  { kind: 'zoom', label: 'Zoom', supports: ['zoomDirection', 'intensity'] },
  { kind: 'zoomSpin', label: 'Zoom Spin', supports: ['intensity'] },
  { kind: 'zoomBounce', label: 'Elastic Zoom', supports: ['zoomDirection', 'intensity'] },
  { kind: 'cardFlip', label: '3D Card Flip', supports: ['direction'] },
  { kind: 'paperFold', label: 'Paper Fold', supports: ['direction'] },
  { kind: 'particleDissolve', label: 'Particle Dissolve', supports: ['intensity'] },
  { kind: 'sliceShift', label: 'Slice Shift (Disassemble → Assemble)', supports: ['direction', 'intensity'] },
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
  fallback: number = 5,
  position?: 'in' | 'out' | null
): number {
  for (const track of tracks) {
    const ordered = [...(track.clips || [])].sort((a, b) => a.startTime - b.startTime);
    const idx = ordered.findIndex((c) => c.id === clipId);
    if (idx === -1) continue;

    const clip = ordered[idx];
    // Which cut does this clip's transition sit on?
    const onIncomingEdge = position ? position === 'in' : !!clip.transitionIn;
    const neighbour = onIncomingEdge ? ordered[idx - 1] : ordered[idx + 1];
    if (!neighbour) return Math.min(fallback, clip.duration);

    const gap = onIncomingEdge
      ? clip.startTime - (neighbour.startTime + neighbour.duration)
      : neighbour.startTime - (clip.startTime + clip.duration);

    if (Math.abs(gap) > 0.034) {
      return Math.min(fallback, clip.duration);
    }

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
