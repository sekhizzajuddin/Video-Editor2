/**
 * clipEnterExitEngine.ts
 *
 * Universal clip enter/exit animation engine.
 * Computes transform modifiers (opacity, translateX/Y, scale, rotation)
 * for the first N seconds (enter) and last N seconds (exit) of any clip.
 *
 * This is separate from clip-to-clip transitions (transitionEngine.ts) which
 * blend two adjacent clips. Enter/exit animations work on a SINGLE clip,
 * even if it's the only clip on the timeline.
 */

import type { ClipEnterExitAnimation, TextAnimationPreset } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnterExitModifiers {
  opacity: number;       // 0..1 multiplier
  translateX: number;    // fraction of frame width (-1 to 1)
  translateY: number;    // fraction of frame height (-1 to 1)
  scale: number;         // multiplier (1 = normal)
  rotation: number;      // radians
  blur: number;          // pixels (0 = none)
}

const IDENTITY: EnterExitModifiers = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotation: 0,
  blur: 0,
};

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function applyEasing(t: number, easing?: string): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear': return x;
    case 'easeIn': return easeInCubic(x);
    case 'easeOut': return easeOutCubic(x);
    case 'easeInOut': return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'easeOutBack': return easeOutBack(x);
    case 'easeOutElastic': return easeOutElastic(x);
    case 'easeOutBounce': return easeOutBounce(x);
    default: return easeOutCubic(x); // default to smooth cubic
  }
}

// ---------------------------------------------------------------------------
// Preset → modifiers at progress=0 (the "from" state for enter, or "to" for exit)
// ---------------------------------------------------------------------------

/**
 * Returns the "extreme" state (fully animated-out) for a given preset.
 * For enter: at t=0, the clip is in this state; at t=1 it's at identity.
 * For exit: at t=0, the clip is at identity; at t=1 it's in this state.
 */
function getPresetModifiers(preset: TextAnimationPreset): EnterExitModifiers {
  switch (preset) {
    case 'none':
      return { ...IDENTITY };

    case 'fadeIn':
    case 'fadeOut':
      return { ...IDENTITY, opacity: 0 };

    case 'slideUp':
      return { ...IDENTITY, opacity: 0, translateY: 0.3 };

    case 'slideDown':
      return { ...IDENTITY, opacity: 0, translateY: -0.3 };

    case 'slideLeft':
      return { ...IDENTITY, opacity: 0, translateX: 0.5 };

    case 'slideRight':
      return { ...IDENTITY, opacity: 0, translateX: -0.5 };

    case 'zoom':
      return { ...IDENTITY, opacity: 0, scale: 0.3 };

    case 'bounce':
      return { ...IDENTITY, opacity: 0, translateY: -0.4, scale: 0.8 };

    case 'elastic':
      return { ...IDENTITY, opacity: 0, scale: 0.1 };

    case 'revealWipe':
      return { ...IDENTITY, opacity: 0, translateX: -1.0 };

    case 'splitReveal':
      return { ...IDENTITY, opacity: 0, scale: 0.1 };

    case 'glitch':
      return { ...IDENTITY, opacity: 0, translateX: 0.05 };

    case 'letterSpacing':
      return { ...IDENTITY, opacity: 0, scale: 1.3 };

    case 'rollUp':
      return { ...IDENTITY, opacity: 0, translateY: 1.0 };

    case 'scaleFlip':
      return { ...IDENTITY, opacity: 0, scale: 0.01 };

    case 'zoomBlur':
      return { ...IDENTITY, opacity: 0, scale: 2.5, blur: 8 };

    case 'spinIn':
      return { ...IDENTITY, opacity: 0, scale: 0.3, rotation: Math.PI * 2 };

    case 'dropBounce':
      return { ...IDENTITY, opacity: 0, translateY: -0.8 };

    case 'flipX':
      return { ...IDENTITY, opacity: 0, scale: 0.01 };

    case 'flipY':
      return { ...IDENTITY, opacity: 0, scale: 0.01 };

    case 'blurIn':
      return { ...IDENTITY, opacity: 0, blur: 8 };

    case 'expandWidth':
      return { ...IDENTITY, opacity: 0, scale: 0.01 };

    case 'wave':
      return { ...IDENTITY, opacity: 0, translateY: 0.15 };

    case 'scramble':
      return { ...IDENTITY, opacity: 0 };

    case 'typewriter':
      return { ...IDENTITY, opacity: 0 };

    default:
      return { ...IDENTITY, opacity: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Compute the enter/exit animation modifiers for a clip at the given time.
 *
 * @param animation  The clip's or PIP window's enter/exit settings.
 * @param clipStart  Absolute start time of the clip on the timeline.
 * @param clipDuration  Duration of the clip.
 * @param currentTime  Current playback time.
 * @returns Modifiers to apply (multiply opacity, add translate, multiply scale, add rotation).
 */
export function computeEnterExitModifiers(
  animation: ClipEnterExitAnimation | undefined,
  clipStart: number,
  clipDuration: number,
  currentTime: number
): EnterExitModifiers {
  if (!animation) return { ...IDENTITY };
  if (animation.enterType === 'none' && animation.exitType === 'none') return { ...IDENTITY };

  const clipEnd = clipStart + clipDuration;
  const enterDur = animation.enterDuration || 0.5;
  const exitDur = animation.exitDuration || 0.5;

  const result = { ...IDENTITY };

  // ── Enter zone: first `enterDur` seconds ──────────────────────────────
  if (animation.enterType !== 'none' && currentTime < clipStart + enterDur) {
    const rawProgress = Math.max(0, (currentTime - clipStart) / enterDur);
    const t = applyEasing(rawProgress, animation.enterEasing);
    const from = getPresetModifiers(animation.enterType);

    // Interpolate from the "animated-out" state toward identity
    result.opacity = from.opacity + (1 - from.opacity) * t;
    result.translateX = from.translateX * (1 - t);
    result.translateY = from.translateY * (1 - t);
    result.scale = from.scale + (1 - from.scale) * t;
    result.rotation = from.rotation * (1 - t);
    result.blur = from.blur * (1 - t);
    return result;
  }

  // ── Exit zone: last `exitDur` seconds ─────────────────────────────────
  if (animation.exitType !== 'none' && currentTime > clipEnd - exitDur) {
    const rawProgress = Math.max(0, (currentTime - (clipEnd - exitDur)) / exitDur);
    const t = applyEasing(rawProgress, animation.exitEasing);
    const to = getPresetModifiers(animation.exitType);

    // Interpolate from identity toward the "animated-out" state
    result.opacity = 1 + (to.opacity - 1) * t;
    result.translateX = to.translateX * t;
    result.translateY = to.translateY * t;
    result.scale = 1 + (to.scale - 1) * t;
    result.rotation = to.rotation * t;
    result.blur = to.blur * t;
    return result;
  }

  return result;
}

/**
 * List of animation presets for the dropdown UI.
 */
export const ENTER_EXIT_PRESETS: Array<{ value: TextAnimationPreset; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'fadeIn', label: 'Fade' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'slideLeft', label: 'Slide Left' },
  { value: 'slideRight', label: 'Slide Right' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'elastic', label: 'Elastic' },
  { value: 'spinIn', label: 'Spin' },
  { value: 'dropBounce', label: 'Drop Bounce' },
  { value: 'blurIn', label: 'Blur' },
  { value: 'zoomBlur', label: 'Zoom Blur' },
  { value: 'rollUp', label: 'Roll Up' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'splitReveal', label: 'Scale Reveal' },
  { value: 'revealWipe', label: 'Wipe' },
  { value: 'scaleFlip', label: 'Scale Flip' },
];
