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
  addSpeedFrameToClip,
  moveSpeedFrameLine,
  moveSpeedFrameScrew,
  removeSpeedFrameFromClip,
  getSpeedFrameSegments,
  calculateSpeedFramesRamp,
  getSpeedForClipAtTime,
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

describe('Speed Frames (Embedded Rate Stretching)', () => {
  const baseClip: any = {
    id: 'clip-1',
    startTime: 0,
    duration: 10,
    trimStart: 0,
    speed: 1.0,
  };

  it('calculates single speed frame edge-to-edge and preserves outside segment speed while adjusting total duration', () => {
    // Add speed frame at 5 seconds
    const { clip: clipWith1, newFrameId } = addSpeedFrameToClip(baseClip, 5);
    expect(clipWith1.speedFrames).toHaveLength(1);
    expect(clipWith1.speedFrames![0].timelineOffset).toBe(5);
    expect(clipWith1.speedFrames![0].sourceTime).toBe(5);

    // Initial segment speeds should both be 1.0x
    const segmentsInitial = getSpeedFrameSegments(clipWith1);
    expect(segmentsInitial).toHaveLength(2);
    expect(segmentsInitial[0].startOffset).toBe(0);
    expect(segmentsInitial[0].endOffset).toBe(5);
    expect(segmentsInitial[0].speed).toBeCloseTo(1.0, 3);
    expect(segmentsInitial[1].startOffset).toBe(5);
    expect(segmentsInitial[1].endOffset).toBe(10);
    expect(segmentsInitial[1].speed).toBeCloseTo(1.0, 3);

    // Drag line left from 5s to 2s: delta = -3s. Squeezes segment 0 (0 to 2s, source 0 to 5s -> 2.5x)
    // Segment 1 (outside position) maintains 1.0x speed! Total duration becomes 10 + (-3) = 7s.
    const moved = moveSpeedFrameLine(clipWith1, newFrameId, 2);
    expect(moved.duration).toBe(7);
    expect(moved.speedFrames![0].timelineOffset).toBe(2);
    expect(moved.speedFrames![0].sourceTime).toBe(5); // source anchor held fixed!

    const segmentsMoved = getSpeedFrameSegments(moved);
    // Segment 0 (0 to 2s, source 0 to 5s): speed = 5 / 2 = 2.5x (Fast-forward)
    expect(segmentsMoved[0].startOffset).toBe(0);
    expect(segmentsMoved[0].endOffset).toBe(2);
    expect(segmentsMoved[0].speed).toBeCloseTo(2.5, 3);

    // Segment 1 (2 to 7s, source 5 to 10s): speed = 5 / 5 = 1.0x (Maintained!)
    expect(segmentsMoved[1].startOffset).toBe(2);
    expect(segmentsMoved[1].endOffset).toBe(7);
    expect(segmentsMoved[1].speed).toBeCloseTo(1.0, 3);

    // Frame-accurate playback check via getMediaTimeForClip
    // At t = 0 -> source 0
    expect(getMediaTimeForClip(moved, 0)).toBeCloseTo(0, 3);
    // At t = 1 (half of seg 0) -> source = 1 * 2.5 = 2.5
    expect(getMediaTimeForClip(moved, 1)).toBeCloseTo(2.5, 3);
    // At t = 2 (end of seg 0 / speed frame line) -> source 5.0 exactly!
    expect(getMediaTimeForClip(moved, 2)).toBeCloseTo(5.0, 3);
    // At t = 4.5 (half of seg 1: 2 + 2.5s) -> source = 5 + 2.5 * 1.0 = 7.5
    expect(getMediaTimeForClip(moved, 4.5)).toBeCloseTo(7.5, 3);
    // At t = 7 (clip end) -> source 10.0 exactly!
    expect(getMediaTimeForClip(moved, 7)).toBeCloseTo(10.0, 3);
  });

  it('matches the exact 4-speed-frame logic example provided by the user', () => {
    // Clip duration: 10s. Add 4 Speed Frames at: 2s, 4s, 6s, 8s
    const { clip: c1, newFrameId: sf1 } = addSpeedFrameToClip(baseClip, 2);
    const { clip: c2, newFrameId: sf2 } = addSpeedFrameToClip(c1, 4);
    const { clip: c3, newFrameId: sf3 } = addSpeedFrameToClip(c2, 6);
    const { clip: c4, newFrameId: sf4 } = addSpeedFrameToClip(c3, 8);
    expect(c4.speedFrames).toHaveLength(4);
    expect(c4.duration).toBe(10);

    // User shrinks 1st speed frame (2s) towards left to 1s:
    // "Let User srink it to 1 sec then system will apply speed up to cover 2 sec clip in one sec
    // while other area of clip will remain untouched and there speed should 1x And the total clip duretion is now 9 sec.
    // Now Other Speed frame will found at 3, 5, And 7 Sec."
    const step1 = moveSpeedFrameLine(c4, sf1, 1);
    expect(step1.duration).toBe(9);
    expect(step1.speedFrames!.map((f) => f.timelineOffset)).toEqual([1, 3, 5, 7]);

    const segs1 = getSpeedFrameSegments(step1);
    expect(segs1[0].speed).toBeCloseTo(2.0, 2); // 2 sec covered in 1 sec -> 2x
    expect(segs1[1].speed).toBeCloseTo(1.0, 2); // untouched 1x
    expect(segs1[2].speed).toBeCloseTo(1.0, 2); // untouched 1x
    expect(segs1[3].speed).toBeCloseTo(1.0, 2); // untouched 1x
    expect(segs1[4].speed).toBeCloseTo(1.0, 2); // untouched 1x

    // "then user will now select the speed frame of 6 sec which is now find in 5 sec,
    // Now User starting srinking to words left side to incrise speed now that speed frame will found at 4 sec
    // and other will find at 1, 3, and 6 sec now the clip total duretion is 8 sec."
    const step2 = moveSpeedFrameLine(step1, sf3, 4);
    expect(step2.duration).toBe(8);
    expect(step2.speedFrames!.map((f) => f.timelineOffset)).toEqual([1, 3, 4, 6]);

    const segs2 = getSpeedFrameSegments(step2);
    expect(segs2[0].speed).toBeCloseTo(2.0, 2); // seg 0 still 2.0x
    expect(segs2[1].speed).toBeCloseTo(1.0, 2); // seg 1 still 1.0x
    expect(segs2[2].speed).toBeCloseTo(2.0, 2); // seg 2 shrunk from 2s to 1s -> 2.0x
    expect(segs2[3].speed).toBeCloseTo(1.0, 2); // seg 3 still 1.0x
    expect(segs2[4].speed).toBeCloseTo(1.0, 2); // seg 4 still 1.0x
  });

  it('restores uniform playback state and duration when all speed frames are deleted', () => {
    const { clip: c1, newFrameId: id1 } = addSpeedFrameToClip(baseClip, 5);
    const moved = moveSpeedFrameLine(c1, id1, 2);
    expect(moved.duration).toBe(7);
    expect(moved.speedRamp).toBeDefined();

    const restored = removeSpeedFrameFromClip(moved, id1);
    expect(restored.speedFrames).toBeUndefined();
    expect(restored.speedRamp).toBeUndefined();
    expect(restored.speedFrameSourceEnd).toBeUndefined();
    expect(restored.duration).toBe(10); // restored back to original 10s!
    expect(getMediaTimeForClip(restored, 5)).toBeCloseTo(5.0, 3);
  });

  it('allows repositioning speed frame via screw head without distorting rate curve', () => {
    const { clip: c1, newFrameId: id1 } = addSpeedFrameToClip(baseClip, 5);
    // Move screw head from 5s to 6s
    const screwed = moveSpeedFrameScrew(c1, id1, 6);
    expect(screwed.speedFrames![0].timelineOffset).toBe(6);
    // Source time was re-sampled at 6s (since base speed was 1.0, media time is 6.0)
    expect(screwed.speedFrames![0].sourceTime).toBeCloseTo(6.0, 3);
    const segs = getSpeedFrameSegments(screwed);
    expect(segs[0].speed).toBeCloseTo(1.0, 2);
    expect(segs[1].speed).toBeCloseTo(1.0, 2);
  });
});

describe('getSpeedForClipAtTime & SpeedRampEngine.getSpeedAtTimelineTime', () => {
  it('returns exact constant segment speeds for clips with speed frames', () => {
    const clip: any = {
      id: 'clip-ramp',
      startTime: 2,
      duration: 10,
      trimStart: 0,
      speed: 1.0,
    };
    const { clip: withFrame, newFrameId } = addSpeedFrameToClip(clip, 4);
    // Move frame to 2s: seg 0 (0..2s) is 4s source in 2s timeline -> 2x. seg 1 (2..8s) is 6s source in 6s timeline -> 1x.
    const moved = moveSpeedFrameLine(withFrame, newFrameId, 2);

    // Timeline time 2s is clip start: seg 0 -> 2.0x
    expect(getSpeedForClipAtTime(moved, 2.0)).toBeCloseTo(2.0, 2);
    expect(getSpeedForClipAtTime(moved, 3.0)).toBeCloseTo(2.0, 2);
    // Timeline time 4s is exactly at offset 2s (boundary): seg 0/1 -> 2.0x or 1.0x
    expect(getSpeedForClipAtTime(moved, 4.0)).toBeCloseTo(2.0, 2);
    // Timeline time 5s (offset 3s) is inside seg 1 -> 1.0x
    expect(getSpeedForClipAtTime(moved, 5.0)).toBeCloseTo(1.0, 2);
    expect(getSpeedForClipAtTime(moved, 9.0)).toBeCloseTo(1.0, 2);
  });

  it('evaluates getSpeedAtTimelineTime on SpeedRampEngine', () => {
    const ramp = [
      K('a', 0, 1),
      K('b', 5, 2),
      K('c', 10, 0.5),
    ];
    const engine = new SpeedRampEngine(ramp);
    // At t=0, speed should be 1.0
    expect(engine.getSpeedAtTimelineTime(0)).toBeCloseTo(1.0, 2);
    // Beyond the end of ramp, should extrapolate with final keyframe speed (0.5)
    const endTimeline = engine.sourceToTimeline(10);
    expect(engine.getSpeedAtTimelineTime(endTimeline + 5)).toBeCloseTo(0.5, 2);
  });

  it('returns flat speed for clips without speed frames or speed ramps', () => {
    const clip: any = {
      id: 'flat-clip',
      startTime: 5,
      duration: 8,
      trimStart: 0,
      speed: 1.75,
    };
    expect(getSpeedForClipAtTime(clip, 5)).toBe(1.75);
    expect(getSpeedForClipAtTime(clip, 9)).toBe(1.75);
  });
});
