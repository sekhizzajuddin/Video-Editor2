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
  getSpeedRampEngine,
  getMediaTimeForClip,
  computeSplitHalvesMedia,
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

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT HALF MEDIA MATH (computeSplitHalvesMedia)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSplitHalvesMedia — clip splitting', () => {
  function mediaAt(clip: any, t: number): number {
    return getMediaTimeForClip(
      {
        id: clip.id ?? 'c',
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart ?? 0,
        speed: clip.speed ?? 1,
        speedRamp: clip.speedRamp,
        isReversed: clip.isReversed,
        freezeFrame: clip.freezeFrame,
      },
      t
    );
  }

  const FLAT = {
    id: 'c1',
    startTime: 2,
    duration: 10,
    trimStart: 1,
    trimEnd: 2,
    speed: 1.5,
  };

  it('flat clip: halves are continuous at the split instant', () => {
    const splitTime = 6;
    const h = computeSplitHalvesMedia(FLAT as any, splitTime);
    const orig = mediaAt(FLAT as any, splitTime);

    const left = { ...FLAT, duration: 4, trimStart: h.leftTrimStart, trimEnd: h.leftTrimEnd };
    const right = { ...FLAT, startTime: splitTime, duration: 6, trimStart: h.rightTrimStart };

    expect(mediaAt(left as any, splitTime)).toBeCloseTo(orig, 6);
    expect(mediaAt(right as any, splitTime)).toBeCloseTo(orig, 6);
    // Non-reversed: right half starts exactly at the boundary source position.
    expect(h.rightTrimStart).toBeCloseTo(FLAT.trimStart + 4 * FLAT.speed, 6);
    // Left half keeps the original trimStart.
    expect(h.leftTrimStart).toBe(FLAT.trimStart);
    // Left trimEnd grows by the source consumed by the right half.
    expect(h.leftTrimEnd).toBeCloseTo(FLAT.trimEnd + 6 * FLAT.speed, 6);
    // Together the halves cover the original source span: 10 * 1.5.
    expect(h.rightTrimStart + 6 * FLAT.speed).toBeCloseTo(FLAT.trimStart + 10 * FLAT.speed, 6);
  });

  it('trimmed ramped clip: boundary keyframe lands at the CORRECT source position (trim-aware)', () => {
    // Ramp over source [0..12]: 0.5x then 2x. Clip trimmed to start at source 3.
    const ramp = [K('a', 0, 0.5), K('b', 6, 0.5), K('c', 12, 2)];
    const clip = { id: 'r1', startTime: 0, duration: 6, trimStart: 3, trimEnd: 0, speed: 1, speedRamp: ramp };
    const engine = getSpeedRampEngine('r1', ramp);
    const localStart = engine.sourceToTimeline(3); // timeline offset of trimStart
    const rel = 2; // split 2s into the clip
    const h = computeSplitHalvesMedia(clip as any, rel);
    const splitSource = engine.timelineToSource(localStart + rel);

    // The boundary keyframe must sit at the split SOURCE position — NOT at
    // `rel` (2s), which was the old bug for trimmed ramps.
    const leftLast = h.leftSpeedRamp![h.leftSpeedRamp!.length - 1];
    expect(leftLast.sourceTime).toBeCloseTo(splitSource, 6);
    expect(leftLast.sourceTime).toBeGreaterThan(rel + 1); // proves trim offset applied
    expect(h.rightSpeedRamp![0].sourceTime).toBeCloseTo(splitSource, 6);
    // Both halves' ramps render the same source frame at the split instant.
    const orig = mediaAt(clip as any, rel);
    const left = { ...clip, duration: rel, speedRamp: h.leftSpeedRamp, trimStart: h.leftTrimStart, trimEnd: h.leftTrimEnd };
    const right = { ...clip, startTime: rel, duration: 6 - rel, speedRamp: h.rightSpeedRamp, trimStart: h.rightTrimStart };
    expect(mediaAt(left as any, rel)).toBeCloseTo(orig, 4);
    expect(mediaAt(right as any, rel)).toBeCloseTo(orig, 4);
  });

  it('ramped split: boundary speed equals the engine speed at the split source', () => {
    const ramp = [K('a', 0, 0.5), K('b', 12, 2)];
    const clip = { id: 'r2', startTime: 0, duration: 9, trimStart: 0, trimEnd: 0, speed: 1, speedRamp: ramp };
    const h = computeSplitHalvesMedia(clip as any, 6);
    const engine = getSpeedRampEngine('r2', ramp);
    const splitSource = engine.timelineToSource(6);
    expect(h.leftSpeedRamp![h.leftSpeedRamp!.length - 1].speed).toBeCloseTo(engine.getSpeedAtSourceTime(splitSource), 6);
    expect(h.rightSpeedRamp![0].speed).toBeCloseTo(engine.getSpeedAtSourceTime(splitSource), 6);
  });

  it('reversed clip: halves stay continuous (no jump at the split point)', () => {
    const rev = { ...FLAT, isReversed: true };
    const splitTime = 6;
    const h = computeSplitHalvesMedia(rev as any, splitTime);
    const orig = mediaAt(rev as any, splitTime);

    const left = { ...rev, duration: 4, trimStart: h.leftTrimStart, trimEnd: h.leftTrimEnd };
    const right = { ...rev, startTime: splitTime, duration: 6, trimStart: h.rightTrimStart, trimEnd: h.rightTrimEnd };

    // The halves must show the same source frame at the split instant.
    expect(mediaAt(left as any, splitTime)).toBeCloseTo(orig, 5);
    expect(mediaAt(right as any, splitTime)).toBeCloseTo(orig, 5);
    // Right half ends exactly where the original ended (trimStart).
    expect(mediaAt(right as any, splitTime + 6)).toBeCloseTo(rev.trimStart, 5);
    // Left half starts exactly where the original started (trimStart + S).
    expect(mediaAt(left as any, rev.startTime)).toBeCloseTo(rev.trimStart + 10 * rev.speed, 5);
  });

  it('reversed clip: halves report the CORRECT remaining-source trimEnd', () => {
    // Original: trimStart=1, speed=1.5, duration=10 → S=15, trimEnd=2.
    // Reversed coverage is [trimStart .. trimStart+S] played backwards.
    const rev = { ...FLAT, isReversed: true };
    const rel = 4;
    const h = computeSplitHalvesMedia(rev as any, rev.startTime + rel);
    // Left half covers source down to splitMediaTime (it plays [splitPoint →
    // original start]); remaining after its highest source = trimEnd + rel·s.
    expect(h.leftTrimEnd).toBeCloseTo(FLAT.trimEnd + rel * FLAT.speed, 6);
    // Right half ends at splitMediaTime; remaining after = trimEnd + (d−rel)·s.
    expect(h.rightTrimEnd).toBeCloseTo(FLAT.trimEnd + (10 - rel) * FLAT.speed, 6);
    // Non-reversed keeps the original trimEnd on the right half.
    const h2 = computeSplitHalvesMedia(FLAT as any, 6);
    expect(h2.rightTrimEnd).toBe(FLAT.trimEnd);
  });

  it('trimmed ramped clip: left half trimEnd is trim-aware (source remaining in FILE)', () => {
    // Ramp over source [0..12]: 0.5x then 2x. Clip trimmed to start at source 3
    // and play 2s of TIMELINE: localStart = sourceToTimeline(3) = 6, so the
    // clip covers timeline [6,8] = source [3,4] → its trimEnd must be 12−4 = 8
    // for the clip to be self-consistent.
    const ramp = [K('a', 0, 0.5), K('b', 6, 0.5), K('c', 12, 2)];
    const clip = { id: 'r3', startTime: 0, duration: 2, trimStart: 3, trimEnd: 8, speed: 1, speedRamp: ramp };
    const rel = 0.75;
    const h = computeSplitHalvesMedia(clip as any, rel);
    // clipSourceEnd = timelineToSource(6 + 2) = timelineToSource(8) = 4.
    // splitMediaTime = timelineToSource(6 + 0.75) = 3.375.
    // leftTrimEnd = trimEnd + (clipSourceEnd − splitMediaTime) = 8 + 0.625 = 8.625.
    expect(h.leftTrimEnd).toBeCloseTo(8.625, 6);
    // And the halves still render the same source frame at the split instant.
    const orig = mediaAt(clip as any, rel);
    const left = { ...clip, duration: rel, speedRamp: h.leftSpeedRamp, trimStart: h.leftTrimStart, trimEnd: h.leftTrimEnd };
    const right = { ...clip, startTime: rel, duration: 2 - rel, speedRamp: h.rightSpeedRamp, trimStart: h.rightTrimStart, trimEnd: h.rightTrimEnd };
    expect(mediaAt(left as any, rel)).toBeCloseTo(orig, 4);
    expect(mediaAt(right as any, rel)).toBeCloseTo(orig, 4);
    // Right half keeps the original file-remaining trimEnd.
    expect(h.rightTrimEnd).toBe(8);
    // Right half ends exactly at the clip's source end (4).
    expect(mediaAt(right as any, 2)).toBeCloseTo(4, 4);
  });

  it('multiple sequential splits keep every boundary continuous (the "split many times" scenario)', () => {
    let clip: any = { ...FLAT, id: 'm1' };
    const splitTimes = [3.5, 5.0, 8.2, 9.0]; // successive splits of the right half
    let nextStart = FLAT.startTime;
    for (const rel of splitTimes) {
      const t = FLAT.startTime + rel;
      const h = computeSplitHalvesMedia(clip, t);
      const left = {
        ...clip,
        duration: rel - (clip.startTime - FLAT.startTime),
        trimStart: h.leftTrimStart,
        trimEnd: h.leftTrimEnd,
      };
      const right = {
        ...clip,
        startTime: t,
        duration: clip.duration - (rel - (clip.startTime - FLAT.startTime)),
        trimStart: h.rightTrimStart,
      };
      // Left half is continuous with the pre-split clip at the split instant.
      expect(mediaAt(left, t)).toBeCloseTo(mediaAt(clip, t), 5);
      // Right half continues exactly where the left half ended.
      expect(mediaAt(right, t)).toBeCloseTo(mediaAt(left, t), 5);
      // Timeline coverage preserved: right half ends where the original ended.
      expect(mediaAt(right, t + right.duration)).toBeCloseTo(FLAT.trimStart + 10 * FLAT.speed, 5);
      clip = right;
      nextStart = t;
      void nextStart;
    }
    // The final chain still covers the full original source range.
    expect(mediaAt(clip, FLAT.startTime + 10)).toBeCloseTo(FLAT.trimStart + 10 * FLAT.speed, 5);
  });
});
