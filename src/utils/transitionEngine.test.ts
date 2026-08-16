import { describe, it, expect } from 'vitest';
import {
  applyEasing,
  buildTransitionPlan,
  findActiveTransition,
  getTransitionAudioGains,
  getTransitionWindow,
  getMaxTransitionDuration,
  normalizeTransition,
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
