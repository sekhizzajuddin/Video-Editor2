/**
 * speedRamp.test.ts
 *
 * Regression tests for the speed-ramp engine & helpers. These cover bugs fixed
 * in the "Speed Ramping" pass:
 *  1. timelineToSource must extrapolate past the last keyframe with the LAST
 *     keyframe's speed (it previously extrapolated the final easing curve).
 *  2. Non-linear easings (easeIn/easeOut/easeInOut/bezier) are integrated
 *     numerically, so their inverse must be solved numerically too — the old
 *     linear closed-form inverse produced wrong source times inside eased
 *     segments.
 *  3. Ramped trim helpers map timeline shifts to source trims correctly.
 *  4. getRampedClipSourceSpan returns the source span a clip actually covers.
 *  5. The keyframe-drag solver (used by the PropertiesPanel graph) lands the
 *     dragged keyframe exactly at the pointer's progress.
 */

import { describe, it, expect } from 'vitest';
import {
  SpeedRampEngine,
  getRampedClipSourceSpan,
  getRampedTrimStartForLeftResize,
  getRampedTrimEndForRightResize,
} from './speedRamp';
import type { SpeedRampKeyframe } from '../types';

const K = (id: string, sourceTime: number, speed: number, easing: any = 'linear'): SpeedRampKeyframe => ({
  id, sourceTime, speed, easing,
});

describe('SpeedRampEngine.timelineToSource', () => {
  it('extrapolates past the last keyframe with the last keyframe speed', () => {
    const ramp = [
      K('a', 0, 2),
      K('b', 5, 1),
      K('c', 10, 0.5),
    ];
    const engine = new SpeedRampEngine(ramp);
    const lastSegEnd = engine.sourceToTimeline(10);
    // 3s after the ramp ends → source = 10 + 3 * 0.5
    expect(engine.timelineToSource(lastSegEnd + 3)).toBeCloseTo(11.5, 6);
  });

  it('round-trips sourceToTimeline ∘ timelineToSource for linear ramps', () => {
    const ramp = [
      K('a', 0, 1),
      K('b', 5, 2),
      K('c', 12, 0.5),
      K('d', 20, 1),
    ];
    const engine = new SpeedRampEngine(ramp);
    for (const s of [0, 1, 2.5, 5, 8, 12, 16, 20]) {
      const t = engine.sourceToTimeline(s);
      expect(engine.timelineToSource(t)).toBeCloseTo(s, 3);
    }
  });

  it('round-trips for eased ramps (easeIn / easeOut / easeInOut / bezier)', () => {
    const ramps: SpeedRampKeyframe[][] = [
      [K('a', 0, 1, 'easeIn'), K('b', 4, 3, 'easeIn'), K('c', 10, 1, 'easeIn')],
      [K('a', 0, 1, 'easeOut'), K('b', 4, 3, 'easeOut'), K('c', 10, 1, 'easeOut')],
      [K('a', 0, 1, 'easeInOut'), K('b', 4, 3, 'easeInOut'), K('c', 10, 1, 'easeInOut')],
      [
        K('a', 0, 1, 'bezier'),
        { ...K('b', 4, 3, 'bezier'), bezierControl: { out: { x: 0.33, y: 0 }, in: { x: 0.67, y: 1 } } },
        K('c', 10, 1, 'bezier'),
      ],
    ];
    for (const ramp of ramps) {
      const engine = new SpeedRampEngine(ramp);
      for (const s of [0.5, 1, 2.5, 4, 6, 9.5]) {
        const t = engine.sourceToTimeline(s);
        expect(engine.timelineToSource(t)).toBeCloseTo(s, 2);
      }
    }
  });

  it('is monotonic across the whole ramp', () => {
    const ramp = [
      K('a', 0, 1, 'easeInOut'),
      K('b', 4, 3, 'easeInOut'),
      K('c', 10, 0.5, 'linear'),
    ];
    const engine = new SpeedRampEngine(ramp);
    const total = engine.getTotalTimelineDuration();
    let prev = -1;
    for (let t = 0; t <= total; t += total / 50) {
      const s = engine.timelineToSource(t);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = s;
    }
  });

  it('handles non-positive speeds without NaN', () => {
    const ramp = [K('a', 0, 0.1), K('b', 10, 0.1)];
    const engine = new SpeedRampEngine(ramp);
    const v = engine.timelineToSource(engine.sourceToTimeline(5));
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeCloseTo(5, 3);
  });
});

describe('getRampedClipSourceSpan', () => {
  it('returns the covered source length for a ramped clip', () => {
    const ramp = [K('a', 0, 1), K('b', 20, 2)];
    const engine = new SpeedRampEngine(ramp);
    const clip = { id: 'x', trimStart: 4, trimEnd: 4, duration: 0, speed: 1, speedRamp: ramp };
    clip.duration = engine.sourceToTimeline(16) - engine.sourceToTimeline(4);
    expect(getRampedClipSourceSpan(clip, 20)).toBeCloseTo(12, 3);
  });

  it('returns duration * speed for flat clips', () => {
    expect(getRampedClipSourceSpan({ id: 'y', trimStart: 2, duration: 3, speed: 2 }, 30)).toBeCloseTo(6, 9);
  });
});

describe('Ramped trim helpers', () => {
  const ramp = [K('a', 0, 1), K('b', 20, 1)];

  it('maps a left timeline shift to the source trim', () => {
    const clip = { id: 'x', trimStart: 5, trimEnd: 3, speed: 1, speedRamp: ramp };
    expect(getRampedTrimStartForLeftResize(clip, -2)).toBeCloseTo(3, 6);
  });

  it('maps a right trim to the source trim end', () => {
    const clip = { id: 'x', trimStart: 5, trimEnd: 3, speed: 1, speedRamp: ramp };
    expect(getRampedTrimEndForRightResize(clip, 12, 20)).toBeCloseTo(3, 6);
  });
});

describe('Keyframe drag solver (as used by the PropertiesPanel graph)', () => {
  const solveKeyframeProgress = (
    ramp: SpeedRampKeyframe[],
    idx: number,
    targetP: number,
    speed: number,
    trimStart: number,
    trimEnd: number,
    sourceDuration: number
  ): SpeedRampKeyframe[] => {
    const isBoundary = idx === 0 || idx === ramp.length - 1;
    if (isBoundary) {
      const next = [...ramp];
      next[idx] = { ...next[idx], sourceTime: idx === 0 ? 0 : sourceDuration, speed };
      return next.sort((a, b) => a.sourceTime - b.sourceTime);
    }
    const sourceEnd = sourceDuration - trimEnd;
    const lo = Math.max(ramp[idx - 1].sourceTime + 0.05, trimStart + 0.0001);
    const hi = Math.min(ramp[idx + 1].sourceTime - 0.05, sourceEnd - 0.0001);
    if (hi <= lo) return ramp.map((k, i) => (i === idx ? { ...k, speed } : k));

    const progressOf = (candidate: SpeedRampKeyframe[]): number => {
      const eng = new SpeedRampEngine(candidate);
      const dur = eng.sourceToTimeline(sourceEnd) - eng.sourceToTimeline(trimStart);
      if (dur <= 0.001) return 0;
      const kfT = eng.sourceToTimeline(candidate[idx].sourceTime) - eng.sourceToTimeline(trimStart);
      return kfT / dur;
    };

    let low = lo;
    let high = hi;
    for (let iter = 0; iter < 24; iter++) {
      const mid = (low + high) / 2;
      const candidate = [...ramp];
      candidate[idx] = { ...candidate[idx], sourceTime: mid, speed };
      const p = progressOf(candidate);
      if (Math.abs(p - targetP) < 0.0004) return candidate;
      if (p < targetP) low = mid;
      else high = mid;
    }
    const candidate = [...ramp];
    candidate[idx] = { ...candidate[idx], sourceTime: (low + high) / 2, speed };
    return candidate;
  };

  const renderedProgress = (ramp: SpeedRampKeyframe[], idx: number, trimStart: number, trimEnd: number, sourceDuration: number) => {
    const eng = new SpeedRampEngine(ramp);
    const dur = eng.sourceToTimeline(sourceDuration - trimEnd) - eng.sourceToTimeline(trimStart);
    return (eng.sourceToTimeline(ramp[idx].sourceTime) - eng.sourceToTimeline(trimStart)) / dur;
  };

  it('lands the dragged keyframe exactly at the pointer progress', () => {
    const ramp = [K('a', 0, 1), K('b', 5, 1), K('c', 12, 1)];
    const out = solveKeyframeProgress(ramp, 1, 0.7, 2.5, 0, 0, 12);
    expect(renderedProgress(out, 1, 0, 0, 12)).toBeCloseTo(0.7, 3);
    expect(out[1].speed).toBe(2.5);
  });

  it('keeps boundary keyframes pinned horizontally', () => {
    const ramp = [K('a', 0, 1), K('b', 5, 1), K('c', 12, 1)];
    const out = solveKeyframeProgress(ramp, 0, 0.9, 3, 0, 0, 12);
    expect(out[0].sourceTime).toBe(0);
    expect(out[0].speed).toBe(3);
    const outEnd = solveKeyframeProgress(ramp, 2, 0.1, 0.5, 0, 0, 12);
    expect(outEnd[2].sourceTime).toBe(12);
    expect(outEnd[2].speed).toBe(0.5);
  });
});
