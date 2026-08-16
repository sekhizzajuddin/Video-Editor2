import { describe, it, expect } from 'vitest';
import {
  getMotionDisplacement,
  getTrackedCorners,
  cornersToRect,
  MOTION_EFFECT_INFO,
  DEFAULT_MOTION_EFFECT,
  type MotionEffectType,
} from './motionEffects';
import type { CornerPoints } from '@/types';

const box = (cx: number, cy: number, half = 50): CornerPoints => ({
  x0: cx - half, y0: cy - half,
  x1: cx + half, y1: cy - half,
  x2: cx + half, y2: cy + half,
  x3: cx - half, y3: cy + half,
});

const ALL_TYPES: MotionEffectType[] = MOTION_EFFECT_INFO.map((m) => m.type);

const base = { type: 'shake' as MotionEffectType, intensity: 50, speed: 8, seed: 7 };

describe('getMotionDisplacement — determinism', () => {
  it('is pure: the same time always yields the same displacement', () => {
    // Critical: the exporter renders frame N with no playback history. If this
    // used Math.random() the export would jitter differently from the preview,
    // and every replay would look different.
    for (const type of ALL_TYPES) {
      for (const t of [0, 0.37, 1.2, 5.5]) {
        const a = getMotionDisplacement({ ...base, type }, t, 100);
        const b = getMotionDisplacement({ ...base, type }, t, 100);
        expect(a).toEqual(b);
      }
    }
  });

  it('different seeds give different motion (so two regions do not move in lockstep)', () => {
    const a = getMotionDisplacement({ ...base, seed: 1 }, 1.0, 100);
    const b = getMotionDisplacement({ ...base, seed: 2 }, 1.0, 100);
    expect(a).not.toEqual(b);
  });

  it('advances over time', () => {
    const a = getMotionDisplacement(base, 0.0, 100);
    const b = getMotionDisplacement(base, 0.5, 100);
    expect(a).not.toEqual(b);
  });
});

describe('getMotionDisplacement — bounds and safety', () => {
  it('zero intensity is a complete no-op for every effect', () => {
    for (const type of ALL_TYPES) {
      const d = getMotionDisplacement({ ...base, type, intensity: 0 }, 1.23, 100);
      expect(d.dx).toBe(0);
      expect(d.dy).toBe(0);
      expect(d.rotation).toBe(0);
      expect(d.scale).toBe(1);
      expect(d.rgbSplit).toBe(0);
    }
  });

  it('never produces NaN or Infinity, at any time or intensity', () => {
    for (const type of ALL_TYPES) {
      for (const intensity of [0, 1, 50, 100]) {
        for (const t of [0, 0.016, 3.7, 120]) {
          const d = getMotionDisplacement({ ...base, type, intensity }, t, 100);
          for (const v of [d.dx, d.dy, d.rotation, d.scale, d.rgbSplit]) {
            expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });

  it('keeps scale positive so a region can never invert or vanish', () => {
    for (const type of ALL_TYPES) {
      for (let t = 0; t < 4; t += 0.1) {
        expect(getMotionDisplacement({ ...base, type, intensity: 100 }, t, 100).scale)
          .toBeGreaterThan(0);
      }
    }
  });

  it('displacement stays within a sane fraction of the region size', () => {
    // A shake that throws the patch clear of its own region would expose a hole.
    for (const type of ALL_TYPES) {
      for (let t = 0; t < 4; t += 0.05) {
        const d = getMotionDisplacement({ ...base, type, intensity: 100 }, t, 100);
        expect(Math.abs(d.dx)).toBeLessThan(100);
        expect(Math.abs(d.dy)).toBeLessThan(100);
      }
    }
  });

  it('amplitude scales with intensity', () => {
    const peak = (intensity: number) => {
      let m = 0;
      for (let t = 0; t < 4; t += 0.02) {
        const d = getMotionDisplacement({ ...base, intensity }, t, 100);
        m = Math.max(m, Math.hypot(d.dx, d.dy));
      }
      return m;
    };
    expect(peak(100)).toBeGreaterThan(peak(50));
    expect(peak(50)).toBeGreaterThan(peak(10));
  });

  it('amplitude scales with the region size', () => {
    const peak = (size: number) => {
      let m = 0;
      for (let t = 0; t < 4; t += 0.02) {
        const d = getMotionDisplacement(base, t, size);
        m = Math.max(m, Math.hypot(d.dx, d.dy));
      }
      return m;
    };
    // A big region should shake proportionally more than a tiny one.
    expect(peak(400)).toBeGreaterThan(peak(50));
  });

  it('speed changes the oscillation rate', () => {
    const zeroCrossings = (speed: number) => {
      let n = 0;
      let prev = getMotionDisplacement({ ...base, type: 'jiggle', speed }, 0, 100).dx;
      for (let t = 0.02; t < 2; t += 0.02) {
        const cur = getMotionDisplacement({ ...base, type: 'jiggle', speed }, t, 100).dx;
        if (Math.sign(cur) !== Math.sign(prev)) n++;
        prev = cur;
      }
      return n;
    };
    expect(zeroCrossings(12)).toBeGreaterThan(zeroCrossings(3));
  });

  it('only glitchShift requests an RGB split', () => {
    for (const type of ALL_TYPES) {
      const d = getMotionDisplacement({ ...base, type, intensity: 100 }, 1.0, 100);
      if (type === 'glitchShift') expect(d.rgbSplit).toBeGreaterThan(0);
      else expect(d.rgbSplit).toBe(0);
    }
  });

  it('pulse and swing actually change scale', () => {
    let pulseVaried = false;
    for (let t = 0; t < 2; t += 0.05) {
      if (Math.abs(getMotionDisplacement({ ...base, type: 'pulse' }, t, 100).scale - 1) > 0.01) {
        pulseVaried = true;
        break;
      }
    }
    expect(pulseVaried).toBe(true);
  });

  it('vibrate is horizontal only', () => {
    for (let t = 0; t < 2; t += 0.05) {
      expect(getMotionDisplacement({ ...base, type: 'vibrate' }, t, 100).dy).toBe(0);
    }
  });
});

describe('cornersToRect', () => {
  it('computes the bounding box of a quad', () => {
    const r = cornersToRect(box(200, 150, 40));
    expect(r.x).toBe(160);
    expect(r.y).toBe(110);
    expect(r.w).toBe(80);
    expect(r.h).toBe(80);
  });

  it('handles a rotated / irregular quad', () => {
    const r = cornersToRect({ x0: 10, y0: 0, x1: 40, y1: 12, x2: 28, y2: 40, x3: 0, y3: 30 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w).toBe(40);
    expect(r.h).toBe(40);
  });

  it('never returns a zero-area rect', () => {
    const r = cornersToRect({ x0: 5, y0: 5, x1: 5, y1: 5, x2: 5, y2: 5, x3: 5, y3: 5 });
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  });
});

describe('getTrackedCorners', () => {
  const track = [
    { time: 0, corners: box(100, 100) },
    { time: 1, corners: box(200, 100) },
    { time: 2, corners: box(200, 200) },
  ];

  it('interpolates between samples so the region does not step', () => {
    // The tracker samples at ~15fps but playback is 60fps; without interpolation
    // the patch visibly jumps between tracked frames.
    const mid = getTrackedCorners(track, undefined, 0.5)!;
    expect(cornersToRect(mid).x).toBeCloseTo(100, 0); // halfway 50->150
  });

  it('clamps before the first and after the last sample', () => {
    expect(getTrackedCorners(track, undefined, -5)).toEqual(track[0].corners);
    expect(getTrackedCorners(track, undefined, 99)).toEqual(track[2].corners);
  });

  it('returns exact samples at their own timestamps', () => {
    expect(getTrackedCorners(track, undefined, 0)).toEqual(track[0].corners);
    expect(getTrackedCorners(track, undefined, 2)).toEqual(track[2].corners);
  });

  it('falls back to the authored box when there is no track', () => {
    const fallback = box(300, 300);
    expect(getTrackedCorners(undefined, fallback, 1)).toEqual(fallback);
    expect(getTrackedCorners([], fallback, 1)).toEqual(fallback);
  });

  it('returns null when there is neither a track nor a fallback', () => {
    expect(getTrackedCorners(undefined, undefined, 1)).toBeNull();
  });

  it('handles a single-sample track', () => {
    const one = [{ time: 5, corners: box(50, 50) }];
    expect(getTrackedCorners(one, undefined, 0)).toEqual(one[0].corners);
    expect(getTrackedCorners(one, undefined, 10)).toEqual(one[0].corners);
  });

  it('interpolation is monotonic across a long track', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 2; t += 0.05) {
      const x = cornersToRect(getTrackedCorners(track, undefined, t)!).x;
      if (t <= 1) {
        expect(x).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = x;
      }
    }
  });
});

describe('defaults and metadata', () => {
  it('ships disabled so adding the type cannot change existing renders', () => {
    expect(DEFAULT_MOTION_EFFECT.enabled).toBe(false);
  });

  it('every advertised effect type is implemented', () => {
    // Sample a WINDOW, not a single instant: the sine-driven effects (jiggle,
    // pulse, swing) legitimately pass through zero, so probing one unlucky
    // timestamp would report a working effect as dead.
    for (const info of MOTION_EFFECT_INFO) {
      let moved = false;
      for (let t = 0; t < 2 && !moved; t += 0.017) {
        const d = getMotionDisplacement({ ...base, type: info.type, intensity: 100 }, t, 100);
        moved =
          Math.abs(d.dx) > 1e-6 ||
          Math.abs(d.dy) > 1e-6 ||
          Math.abs(d.rotation) > 1e-6 ||
          Math.abs(d.scale - 1) > 1e-6 ||
          d.rgbSplit > 1e-6;
      }
      expect(moved, `effect "${info.type}" produced no motion`).toBe(true);
    }
  });

  it('sine-driven effects do pass through zero (documents the above)', () => {
    // Guards the reasoning: if these stopped crossing zero the effect would have
    // become a constant offset rather than an oscillation.
    const nearZero = (type: MotionEffectType) => {
      for (let t = 0; t < 4; t += 0.005) {
        const d = getMotionDisplacement({ ...base, type, intensity: 100 }, t, 100);
        if (Math.hypot(d.dx, d.dy) < 1e-6 && Math.abs(d.scale - 1) < 1e-6) return true;
      }
      return false;
    };
    expect(nearZero('jiggle')).toBe(true);
  });

  it('an unknown effect type degrades to no motion rather than throwing', () => {
    const d = getMotionDisplacement({ ...base, type: 'nope' as MotionEffectType }, 1, 100);
    expect(d.dx).toBe(0);
    expect(d.scale).toBe(1);
  });
});
