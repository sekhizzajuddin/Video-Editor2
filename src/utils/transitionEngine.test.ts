import { describe, it, expect } from 'vitest';
import {
  applyEasing,
  buildTransitionPlan,
  findActiveTransition,
  getTransitionAudioGains,
  getTransitionWindow,
  getMaxTransitionDuration,
  normalizeTransition,
  getDefaultSoundForKind,
  TRANSITION_SOUND_OPTIONS,
  type ActiveTransition,
} from './transitionEngine';

const clip = (id: string, startTime: number, duration: number, extra: any = {}) => ({
  id,
  startTime,
  duration,
  ...extra,
});

describe('getTransitionWindow', () => {
  it('centres the window on the cut by default', () => {
    const w = getTransitionWindow(10, 1, 'center');
    expect(w.start).toBeCloseTo(9.5);
    expect(w.end).toBeCloseTo(10.5);
  });

  it('starts at the cut for left alignment', () => {
    const w = getTransitionWindow(10, 1, 'left');
    expect(w.start).toBeCloseTo(10);
    expect(w.end).toBeCloseTo(11);
  });

  it('ends at the cut for right alignment', () => {
    const w = getTransitionWindow(10, 1, 'right');
    expect(w.start).toBeCloseTo(9);
    expect(w.end).toBeCloseTo(10);
  });

  it('clamps so it cannot reach past the neighbouring clips', () => {
    // Outgoing clip is only 0.2s long but the transition asks for 4s.
    const from = { startTime: 9.8, duration: 0.2 };
    const to = { startTime: 10, duration: 0.3 };
    const w = getTransitionWindow(10, 4, 'center', from, to);
    expect(w.start).toBeGreaterThanOrEqual(from.startTime);
    expect(w.end).toBeLessThanOrEqual(to.startTime + to.duration);
  });

  it('reports a zero-length window as inactive rather than inverted', () => {
    const w = getTransitionWindow(10, 0, 'center');
    expect(w.duration).toBe(0);
    expect(w.end).toBeGreaterThanOrEqual(w.start);
  });
});

describe('findActiveTransition', () => {
  const a = clip('a', 0, 10);
  const b = clip('b', 10, 10, { transitionIn: { type: 'dissolve', duration: 2 } });

  it('finds the transition inside its window', () => {
    const found = findActiveTransition([a, b], 10);
    expect(found).not.toBeNull();
    expect(found!.from.id).toBe('a');
    expect(found!.to.id).toBe('b');
  });

  it('returns null outside the window', () => {
    expect(findActiveTransition([a, b], 5)).toBeNull();
    expect(findActiveTransition([a, b], 15)).toBeNull();
  });

  it('progress runs 0 -> 1 across the window', () => {
    const start = findActiveTransition([a, b], 9.001)!;
    const mid = findActiveTransition([a, b], 10)!;
    const end = findActiveTransition([a, b], 10.999)!;
    expect(start.rawProgress).toBeLessThan(0.05);
    expect(mid.rawProgress).toBeCloseTo(0.5, 1);
    expect(end.rawProgress).toBeGreaterThan(0.95);
  });

  it('ignores clips separated by a real gap', () => {
    const far = clip('c', 20, 5, { transitionIn: { type: 'dissolve', duration: 2 } });
    expect(findActiveTransition([a, far], 20)).toBeNull();
  });

  it('ignores zero-duration transitions', () => {
    const zero = clip('z', 10, 5, { transitionIn: { type: 'dissolve', duration: 0 } });
    expect(findActiveTransition([a, zero], 10)).toBeNull();
  });

  it('skips disabled clips', () => {
    const off = clip('b2', 10, 10, {
      disabled: true,
      transitionIn: { type: 'dissolve', duration: 2 },
    });
    expect(findActiveTransition([a, off], 10)).toBeNull();
  });

  it('falls back to the previous clip transitionOut', () => {
    const a2 = clip('a2', 0, 10, { transitionOut: { type: 'wipe', duration: 2 } });
    const b2 = clip('b2', 10, 10);
    const found = findActiveTransition([a2, b2], 10);
    expect(found).not.toBeNull();
    expect(found!.transition.type).toBe('wipe');
  });

  it('prefers transitionIn over the previous transitionOut', () => {
    const a3 = clip('a3', 0, 10, { transitionOut: { type: 'wipe', duration: 2 } });
    const b3 = clip('b3', 10, 10, { transitionIn: { type: 'dissolve', duration: 2 } });
    expect(findActiveTransition([a3, b3], 10)!.transition.type).toBe('dissolve');
  });

  it('returns only ONE transition when two windows overlap', () => {
    // Three short clips with long transitions -> overlapping windows.
    const c1 = clip('c1', 0, 2);
    const c2 = clip('c2', 2, 2, { transitionIn: { type: 'dissolve', duration: 3 } });
    const c3 = clip('c3', 4, 2, { transitionIn: { type: 'dissolve', duration: 3 } });
    const found = findActiveTransition([c1, c2, c3], 3.5);
    expect(found).not.toBeNull();
    // Nearest boundary to t=3.5 is the c2->c3 cut at 4.
    expect(found!.to.id).toBe('c3');
  });

  it('handles unsorted input', () => {
    const found = findActiveTransition([b, a], 10);
    expect(found).not.toBeNull();
    expect(found!.from.id).toBe('a');
  });
});

describe('normalizeTransition', () => {
  it('infers kind and direction from a friendly name', () => {
    const n = normalizeTransition({ type: 'wipe', name: 'Wipe Right Smooth', duration: 1 });
    expect(n.kind).toBe('wipe');
    expect(n.direction).toBe('right');
    expect(n.softness).toBeGreaterThan(0);
  });

  it('lets explicit params override the inferred name', () => {
    const n = normalizeTransition({
      type: 'wipe',
      name: 'Wipe Left',
      duration: 1,
      params: { kind: 'zoom', direction: 'down', intensity: 1 },
    });
    expect(n.kind).toBe('zoom');
    expect(n.direction).toBe('down');
    expect(n.intensity).toBe(1);
  });

  it('maps Slow Fade onto a dip-to-black', () => {
    expect(normalizeTransition({ type: 'fade', name: 'Slow Fade', duration: 1 }).kind)
      .toBe('fadeToBlack');
  });
});

/** Build an ActiveTransition at a given progress for plan tests. */
function planAt(transition: any, progress: number) {
  const active: ActiveTransition = {
    transition,
    from: clip('a', 0, 10),
    to: clip('b', 10, 10),
    progress: applyEasing(progress, normalizeTransition(transition).easing),
    rawProgress: progress,
    windowStart: 9,
    windowEnd: 11,
  };
  return buildTransitionPlan(active);
}

describe('buildTransitionPlan', () => {
  it('dissolve is fully A at 0 and fully B at 1', () => {
    const start = planAt({ type: 'dissolve', duration: 2 }, 0);
    expect(start.from.opacity).toBeCloseTo(1);
    expect(start.to.opacity).toBeCloseTo(0);

    const end = planAt({ type: 'dissolve', duration: 2 }, 1);
    expect(end.from.opacity).toBeCloseTo(0);
    expect(end.to.opacity).toBeCloseTo(1);
  });

  it('never produces opacity outside 0..1 for any kind or progress', () => {
    const kinds = [
      'dissolve', 'fadeToBlack', 'fadeToWhite', 'wipe', 'slide', 'push',
      'zoom', 'zoomSpin', 'flash', 'shake', 'glitch', 'lightLeak',
      'whipPan', 'pixelate',
    ];
    for (const kind of kinds) {
      for (let i = 0; i <= 20; i++) {
        const p = planAt({ type: kind, duration: 1, params: { kind } }, i / 20);
        expect(p.from.opacity).toBeGreaterThanOrEqual(0);
        expect(p.from.opacity).toBeLessThanOrEqual(1);
        expect(p.to.opacity).toBeGreaterThanOrEqual(0);
        expect(p.to.opacity).toBeLessThanOrEqual(1);
        expect(p.overlay.alpha).toBeGreaterThanOrEqual(0);
        expect(p.overlay.alpha).toBeLessThanOrEqual(1);
        expect(Number.isFinite(p.from.scale)).toBe(true);
        expect(Number.isFinite(p.to.scale)).toBe(true);
      }
    }
  });

  it('dip-to-black peaks at the midpoint and is clear at the edges', () => {
    const mid = planAt({ type: 'fade', name: 'Slow Fade', duration: 2 }, 0.5);
    expect(mid.overlay.alpha).toBeCloseTo(1, 1);
    expect(mid.overlay.color).toBe('#000000');

    const start = planAt({ type: 'fade', name: 'Slow Fade', duration: 2 }, 0);
    expect(start.overlay.alpha).toBeCloseTo(0, 1);
  });

  it('wipe reveals a growing region of B', () => {
    const quarter = planAt({ type: 'wipe', name: 'Wipe Right', duration: 1 }, 0.25);
    const threeQ = planAt({ type: 'wipe', name: 'Wipe Right', duration: 1 }, 0.75);
    expect(quarter.to.clipRect!.w).toBeLessThan(threeQ.to.clipRect!.w);
    // A stays fully visible underneath; the wipe only masks B.
    expect(quarter.from.opacity).toBeCloseTo(1);
  });

  it('push keeps the two layers exactly one frame apart (no seam)', () => {
    for (const p of [0, 0.3, 0.7, 1]) {
      const plan = planAt({ type: 'push', name: 'Slide Left Push', duration: 1 }, p);
      const dxGap = Math.abs(plan.from.translateX - plan.to.translateX);
      const dyGap = Math.abs(plan.from.translateY - plan.to.translateY);
      // Exactly one full frame of separation along the travel axis.
      expect(Math.max(dxGap, dyGap)).toBeCloseTo(1, 5);
    }
  });

  it('shake is deterministic (same progress -> same offsets)', () => {
    const t = { type: 'shake', name: 'Camera Shake', duration: 1 };
    const a = planAt(t, 0.42);
    const b = planAt(t, 0.42);
    expect(a.from.translateX).toBe(b.from.translateX);
    expect(a.from.translateY).toBe(b.from.translateY);
  });

  it('flash overlay peaks mid-transition', () => {
    const mid = planAt({ type: 'flash', name: 'Flash Cut', duration: 1 }, 0.5);
    const edge = planAt({ type: 'flash', name: 'Flash Cut', duration: 1 }, 0);
    expect(mid.overlay.alpha).toBeGreaterThan(edge.overlay.alpha);
    expect(mid.overlay.color).toBe('#ffffff');
  });

  it('glitch and pixelate request their post effects', () => {
    expect(planAt({ type: 'glitch', name: 'RGB Glitch', duration: 1 }, 0.5).postEffect)
      .toBe('rgbSplit');
    expect(planAt({ type: 'pixelate', name: 'Pixelate', duration: 1 }, 0.5).postEffect)
      .toBe('pixelate');
  });

  it('blurDissolve peaks blur at the midpoint and applies it to both layers', () => {
    const mid = planAt({ type: 'blurDissolve', name: 'Blur Dissolve', duration: 1 }, 0.5);
    const edge = planAt({ type: 'blurDissolve', name: 'Blur Dissolve', duration: 1 }, 0);
    expect(mid.from.blur!).toBeGreaterThan(0);
    expect(mid.to.blur).toBeCloseTo(mid.from.blur!);
    expect(edge.from.blur!).toBeCloseTo(0, 5);
  });

  it('circleWipe grows (in) or shrinks (out) the circular reveal', () => {
    const quarter = planAt({ type: 'circleWipe', name: 'Iris In', duration: 1, params: { zoomDirection: 'in' } }, 0.25);
    const threeQ = planAt({ type: 'circleWipe', name: 'Iris In', duration: 1, params: { zoomDirection: 'in' } }, 0.75);
    expect(quarter.to.clipCircle!.r).toBeLessThan(threeQ.to.clipCircle!.r);
    expect(quarter.from.opacity).toBeCloseTo(1);

    // Iris Out: A's circle SHRINKS over time
    const outEarly = planAt({ type: 'circleWipe', name: 'Iris Out', duration: 1, params: { zoomDirection: 'out' } }, 0.25);
    const outLate = planAt({ type: 'circleWipe', name: 'Iris Out', duration: 1, params: { zoomDirection: 'out' } }, 0.75);
    expect(outLate.from.clipCircle!.r).toBeLessThan(outEarly.from.clipCircle!.r);
  });

  it('cardFlip squashes A away then flips B in around the axis', () => {
    const firstHalf = planAt({ type: 'cardFlip', name: 'Card Flip', duration: 1 }, 0.25);
    expect(firstHalf.to.opacity).toBe(0);
    expect(firstHalf.from.scaleX!).toBeLessThan(1);
    const secondHalf = planAt({ type: 'cardFlip', name: 'Card Flip', duration: 1 }, 0.75);
    expect(secondHalf.from.opacity).toBe(0);
    expect(secondHalf.to.scaleX!).toBeLessThan(1);
    // Vertical direction flips around the horizontal axis instead
    const vert = planAt({ type: 'cardFlip', name: 'Card Flip', duration: 1, params: { direction: 'up' } }, 0.25);
    expect(vert.from.scaleY!).toBeLessThan(1);
  });

  it('zoomBounce overshoots mid-transition but lands exactly on 1.0 scale', () => {
    const midB = planAt({ type: 'zoomBounce', name: 'Elastic Zoom', duration: 1, params: { kind: 'zoomBounce' } }, 0.7);
    expect(midB.to.scale).toBeGreaterThan(1); // overshoot
    const end = planAt({ type: 'zoomBounce', name: 'Elastic Zoom', duration: 1, params: { kind: 'zoomBounce' } }, 1);
    expect(end.to.scale).toBeCloseTo(1, 5); // no seam on the final frame
  });

  it('clockWipe sweeps a growing wedge of B', () => {
    const quarter = planAt({ type: 'clockWipe', name: 'Clock Wipe', duration: 1 }, 0.25);
    const threeQ = planAt({ type: 'clockWipe', name: 'Clock Wipe', duration: 1 }, 0.75);
    expect(quarter.to.clipWedge!.angle).toBeLessThan(threeQ.to.clipWedge!.angle);
    expect(quarter.from.opacity).toBeCloseTo(1);
  });

  it('preset display names map to the new professional kinds', () => {
    expect(normalizeTransition({ type: 'x', name: 'Iris In', duration: 1 }).kind).toBe('circleWipe');
    expect(normalizeTransition({ type: 'x', name: 'Blur Dissolve', duration: 1 }).kind).toBe('blurDissolve');
    expect(normalizeTransition({ type: 'x', name: 'Card Flip', duration: 1 }).kind).toBe('cardFlip');
    expect(normalizeTransition({ type: 'x', name: 'Elastic Zoom', duration: 1 }).kind).toBe('zoomBounce');
    expect(normalizeTransition({ type: 'x', name: 'Clock Wipe', duration: 1 }).kind).toBe('clockWipe');
  });

  it('every professional kind has a recommended default sound', () => {
    for (const kind of ['blurDissolve', 'circleWipe', 'cardFlip', 'zoomBounce', 'clockWipe'] as const) {
      expect(getDefaultSoundForKind(kind)).not.toBe('none');
    }
  });

  it('paperFold reveals B from the named edge with fold squash and lip shadow', () => {
    const leftQ = planAt({ type: 'paperFold', name: 'Paper Fold Left', duration: 1 }, 0.25);
    const left3Q = planAt({ type: 'paperFold', name: 'Paper Fold Left', duration: 1 }, 0.75);
    expect(leftQ.to.clipRect!.w).toBeLessThan(left3Q.to.clipRect!.w);
    expect(leftQ.to.scaleX!).toBeLessThan(left3Q.to.scaleX!); // page un-squashes
    expect(leftQ.overlay.type).toBe('edgeGradient');
    expect(leftQ.overlay.gradientDir).toBe('left');

    const right = planAt({ type: 'paperFold', name: 'Paper Fold Right', duration: 1 }, 0.5);
    expect(right.to.clipRect!.x).toBeGreaterThan(0); // anchored to right edge
    const top = planAt({ type: 'paperFold', name: 'Paper Fold Top', duration: 1 }, 0.5);
    expect(top.to.clipRect!.h).toBeLessThan(1);      // vertical reveal
    expect(top.to.scaleY!).toBeLessThan(1);
  });

  it('particleDissolve masks B with a growing deterministic noise grid', () => {
    const mid = planAt({ type: 'particleDissolve', name: 'Particle Dissolve', duration: 1 }, 0.5);
    expect(mid.to.noiseReveal).toBeDefined();
    expect(mid.to.noiseReveal!.amount).toBeGreaterThan(0);
    expect(mid.from.opacity).toBeCloseTo(1); // A untouched underneath
  });

  it('sliceShift disassembles A AND assembles B simultaneously (merged)', () => {
    const mid = planAt({ type: 'sliceShift', name: 'Slice Shift', duration: 1 }, 0.5);
    // Outgoing clip flies apart ...
    expect(mid.from.slices).toBeDefined();
    expect(mid.from.slices!.spread).toBeGreaterThan(0);
    // ... while the incoming clip converges.
    expect(mid.to.slices).toBeDefined();
    expect(mid.to.slices!.spread).toBeGreaterThan(0);
    // Seamless endpoints: at t=1 B is fully assembled, at t=0 A is intact.
    const start = planAt({ type: 'sliceShift', name: 'Slice Shift', duration: 1 }, 0);
    expect(start.from.slices!.spread).toBeCloseTo(0, 5);
    const end = planAt({ type: 'sliceShift', name: 'Slice Shift', duration: 1 }, 1);
    expect(end.to.slices!.spread).toBeCloseTo(0, 5);
    // Legacy names still map onto the same merged transition
    expect(normalizeTransition({ type: 'x', name: 'Disassemble', duration: 1 }).kind).toBe('sliceShift');
    expect(normalizeTransition({ type: 'x', name: 'Assemble', duration: 1 }).kind).toBe('sliceShift');
  });

  it('particleDissolve erodes A with inverted mask and emits in-air wind trails', () => {
    const mid = planAt({ type: 'particleDissolve', name: 'Particle Dissolve', duration: 1 }, 0.5);
    // B materialises ahead of the front
    expect(mid.to.noiseReveal).toBeDefined();
    // A erodes in the SAME cells (inverted mask)
    expect(mid.from.noiseReveal?.invert).toBe(true);
    // Detaching pixels flow with the wind (convection: up + sideways)
    expect(mid.from.noiseTrail).toBeDefined();
    expect(mid.from.noiseTrail!.windY).toBeLessThan(0);
    expect(mid.from.noiseTrail!.windX).not.toBe(0);
  });

  it('premium preset display names map to the premium kinds', () => {
    expect(normalizeTransition({ type: 'x', name: 'Paper Fold Right', duration: 1 }).kind).toBe('paperFold');
    expect(normalizeTransition({ type: 'x', name: 'Particle Dissolve', duration: 1 }).kind).toBe('particleDissolve');
    expect(normalizeTransition({ type: 'x', name: 'Slice Shift', duration: 1 }).kind).toBe('sliceShift');
    expect(normalizeTransition({ type: 'x', name: 'Paper Fold Top', duration: 1 }).direction).toBe('up');
  });
});

describe('getTransitionAudioGains', () => {
  it('is equal-power: gains sum in quadrature to 1', () => {
    for (let i = 0; i <= 10; i++) {
      const { fromGain, toGain } = getTransitionAudioGains(i / 10);
      expect(fromGain * fromGain + toGain * toGain).toBeCloseTo(1, 5);
    }
  });

  it('does not dip in the middle (the linear-crossfade bug)', () => {
    const mid = getTransitionAudioGains(0.5);
    // A linear fade would give 0.5+0.5; equal-power gives ~0.707 each.
    expect(mid.fromGain).toBeCloseTo(Math.SQRT1_2, 3);
    expect(mid.toGain).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it('is fully A at 0 and fully B at 1', () => {
    expect(getTransitionAudioGains(0).fromGain).toBeCloseTo(1);
    expect(getTransitionAudioGains(1).toGain).toBeCloseTo(1);
  });
});

describe('getMaxTransitionDuration', () => {
  it('is limited by the shorter neighbouring clip', () => {
    const tracks = [{
      clips: [
        clip('a', 0, 8),
        clip('b', 8, 2, { transitionIn: { type: 'dissolve', duration: 1 } }),
      ],
    }];
    // Neighbour 'a' is 8s, 'b' is 2s -> capped by the 2s clip.
    expect(getMaxTransitionDuration(tracks, 'b')).toBeCloseTo(2);
  });

  it('resolves the neighbour on the outgoing edge too', () => {
    const tracks = [{
      clips: [
        clip('a', 0, 3, { transitionOut: { type: 'wipe', duration: 1 } }),
        clip('b', 3, 9),
      ],
    }];
    expect(getMaxTransitionDuration(tracks, 'a')).toBeCloseTo(3);
  });

  it('never exceeds the global fallback cap', () => {
    const tracks = [{
      clips: [
        clip('a', 0, 100),
        clip('b', 100, 100, { transitionIn: { type: 'dissolve', duration: 1 } }),
      ],
    }];
    expect(getMaxTransitionDuration(tracks, 'b', 5)).toBeCloseTo(5);
  });

  it('never returns a non-positive duration', () => {
    const tracks = [{
      clips: [
        clip('a', 0, 0.01),
        clip('b', 0.01, 0.01, { transitionIn: { type: 'dissolve', duration: 1 } }),
      ],
    }];
    expect(getMaxTransitionDuration(tracks, 'b')).toBeGreaterThan(0);
  });

  it('a duration at the cap produces a window that stays inside both clips', () => {
    const a = clip('a', 0, 4);
    const b = clip('b', 4, 2, { transitionIn: { type: 'dissolve', duration: 1 } });
    const max = getMaxTransitionDuration([{ clips: [a, b] }], 'b');
    const w = getTransitionWindow(4, max, 'center', a, b);
    expect(w.start).toBeGreaterThanOrEqual(a.startTime);
    expect(w.end).toBeLessThanOrEqual(b.startTime + b.duration);
  });
});

describe('applyEasing', () => {
  it('always maps 0->0 and 1->1', () => {
    for (const e of ['linear', 'easeIn', 'easeOut', 'easeInOut', 'smoothstep']) {
      expect(applyEasing(0, e)).toBeCloseTo(0);
      expect(applyEasing(1, e)).toBeCloseTo(1);
    }
  });

  it('clamps out-of-range input', () => {
    expect(applyEasing(-1, 'linear')).toBe(0);
    expect(applyEasing(2, 'linear')).toBe(1);
  });

  it('is monotonic', () => {
    for (const e of ['linear', 'easeIn', 'easeOut', 'easeInOut', 'smoothstep']) {
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const v = applyEasing(i / 20, e);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });
});

describe('transition sound effects', () => {
  it('defaults soundEffect to none and soundVolume to 0.8', () => {
    const norm = normalizeTransition({ type: 'dissolve', duration: 1 });
    expect(norm.soundEffect).toBe('none');
    expect(norm.soundVolume).toBe(0.8);
  });

  it('reads soundEffect and soundVolume from top-level transition properties', () => {
    const norm = normalizeTransition({
      type: 'slide',
      duration: 1,
      soundEffect: 'fast_whoosh',
      soundVolume: 0.65,
    });
    expect(norm.soundEffect).toBe('fast_whoosh');
    expect(norm.soundVolume).toBe(0.65);
  });

  it('reads soundEffect and soundVolume from params when top-level is omitted', () => {
    const norm = normalizeTransition({
      type: 'wipe',
      duration: 1,
      params: {
        soundEffect: 'glitch',
        soundVolume: 0.5,
      },
    });
    expect(norm.soundEffect).toBe('glitch');
    expect(norm.soundVolume).toBe(0.5);
  });

  it('supports custom media item sound IDs', () => {
    const norm = normalizeTransition({
      type: 'dissolve',
      duration: 1,
      soundEffect: 'media:custom_audio_123',
      soundVolume: 1.0,
    });
    expect(norm.soundEffect).toBe('media:custom_audio_123');
    expect(norm.soundVolume).toBe(1.0);
  });

  it('exposes TRANSITION_SOUND_OPTIONS with presets and recommended transition types', () => {
    expect(TRANSITION_SOUND_OPTIONS.length).toBeGreaterThanOrEqual(10);
    const noneOpt = TRANSITION_SOUND_OPTIONS.find((s) => s.id === 'none');
    expect(noneOpt).toBeDefined();

    const whoosh = TRANSITION_SOUND_OPTIONS.find((s) => s.id === 'fast_whoosh');
    expect(whoosh).toBeDefined();
    expect(whoosh?.recommendedFor).toContain('push');

    const glitch = TRANSITION_SOUND_OPTIONS.find((s) => s.id === 'glitch');
    expect(glitch).toBeDefined();
    expect(glitch?.recommendedFor).toContain('glitch');
  });
});

describe('standalone transitions (unjoined clips)', () => {
  it('plays standalone In transition when alignment is left (Start at Cut)', () => {
    const standaloneClip = clip('c_standalone', 10, 5, {
      transitionIn: { type: 'dissolve', duration: 1.5, params: { alignment: 'left' } },
    });

    // Before window
    expect(findActiveTransition([standaloneClip], 9.9)).toBeNull();

    // Inside window [10.0, 11.5]
    const mid = findActiveTransition([standaloneClip], 10.75);
    expect(mid).not.toBeNull();
    expect(mid!.from).toBeNull();
    expect(mid!.to.id).toBe('c_standalone');
    expect(mid!.windowStart).toBeCloseTo(10.0);
    expect(mid!.windowEnd).toBeCloseTo(11.5);
    expect(mid!.rawProgress).toBeCloseTo(0.5);

    // After window
    expect(findActiveTransition([standaloneClip], 11.6)).toBeNull();
  });

  it('does NOT play standalone In transition if alignment is not left', () => {
    const centeredClip = clip('c_center', 10, 5, {
      transitionIn: { type: 'dissolve', duration: 1.5, params: { alignment: 'center' } },
    });
    expect(findActiveTransition([centeredClip], 10.2)).toBeNull();
  });

  it('plays standalone Out transition when alignment is right (End at Cut)', () => {
    const standaloneClip = clip('c_out', 10, 5, {
      transitionOut: { type: 'dissolve', duration: 1.0, params: { alignment: 'right' } },
    });

    // Clip duration is 5, so clip spans [10, 15]. Out transition with right alignment spans [14, 15].
    expect(findActiveTransition([standaloneClip], 13.9)).toBeNull();

    const mid = findActiveTransition([standaloneClip], 14.5);
    expect(mid).not.toBeNull();
    expect(mid!.from.id).toBe('c_out');
    expect(mid!.to).toBeNull();
    expect(mid!.windowStart).toBeCloseTo(14.0);
    expect(mid!.windowEnd).toBeCloseTo(15.0);
    expect(mid!.rawProgress).toBeCloseTo(0.5);

    // After clip ends
    expect(findActiveTransition([standaloneClip], 15.1)).toBeNull();
  });

  it('does NOT play standalone Out transition if alignment is not right', () => {
    const centeredClip = clip('c_center_out', 10, 5, {
      transitionOut: { type: 'dissolve', duration: 1.0, params: { alignment: 'center' } },
    });
    expect(findActiveTransition([centeredClip], 14.5)).toBeNull();
  });

  it('buildTransitionPlan correctly constructs layers for standalone In transition', () => {
    const cur = clip('clip_in', 10, 5);
    const active: ActiveTransition = {
      transition: { type: 'dissolve', duration: 1.0, params: { alignment: 'left' } },
      from: null,
      to: cur,
      rawProgress: 0.3,
      progress: 0.3,
      windowStart: 10,
      windowEnd: 11,
    };

    const plan = buildTransitionPlan(active);
    expect(plan.from.visible).toBe(false);
    expect(plan.to.visible).toBe(true);
    expect(plan.to.opacity).toBeCloseTo(0.3);
  });

  it('buildTransitionPlan correctly constructs layers for standalone Out transition', () => {
    const cur = clip('clip_out', 10, 5);
    const active: ActiveTransition = {
      transition: { type: 'dissolve', duration: 1.0, params: { alignment: 'right' } },
      from: cur,
      to: null,
      rawProgress: 0.4,
      progress: 0.4,
      windowStart: 14,
      windowEnd: 15,
    };

    const plan = buildTransitionPlan(active);
    expect(plan.from.visible).toBe(true);
    expect(plan.to.visible).toBe(false);
    expect(plan.from.opacity).toBeCloseTo(0.6); // 1 - 0.4
  });

  it('getMaxTransitionDuration bounds standalone transitions to clip duration', () => {
    const cur = clip('c', 0, 3.0);
    const tracks = [{ clips: [cur] }];
    const maxIn = getMaxTransitionDuration(tracks, 'c', 5, 'in');
    expect(maxIn).toBeCloseTo(3.0);

    const maxOut = getMaxTransitionDuration(tracks, 'c', 5, 'out');
    expect(maxOut).toBeCloseTo(3.0);
  });
});


