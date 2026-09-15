import { SpeedRampKeyframe, SpeedFrame } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface SpeedSegment {
  index: number;
  startKf: SpeedRampKeyframe;
  endKf: SpeedRampKeyframe;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number; // Accumulated timeline time at segment start
}

export interface FrameMapping {
  timelineFrame: number;
  sourceFrame: number;
  speed: number;
  needsInterpolation: boolean;
}

export class SpeedRampEngine {
  private keyframes: SpeedRampKeyframe[] = [];
  private segments: SpeedSegment[] = [];
  private totalTimelineDuration: number = 0;

  constructor(keyframes: SpeedRampKeyframe[]) {
    this.setKeyframes(keyframes);
  }

  setKeyframes(keyframes: SpeedRampKeyframe[]) {
    let keys = [...keyframes];
    if (keys.length === 0) {
      keys = [
        { id: 'start', sourceTime: 0, speed: 1.0, easing: 'linear' },
        { id: 'end', sourceTime: 10000, speed: 1.0, easing: 'linear' }
      ];
    } else if (keys.length === 1) {
      keys = [
        { id: keys[0].id, sourceTime: keys[0].sourceTime, speed: keys[0].speed, easing: keys[0].easing, bezierControl: keys[0].bezierControl },
        { id: 'end', sourceTime: keys[0].sourceTime + 10000, speed: keys[0].speed, easing: 'linear' }
      ];
    }
    // Deep copy & sort by source time
    this.keyframes = keys.sort((a, b) => a.sourceTime - b.sourceTime);
    this.rebuild();
  }

  getKeyframes(): ReadonlyArray<SpeedRampKeyframe> {
    return this.keyframes;
  }

  getTotalTimelineDuration(): number {
    return this.totalTimelineDuration;
  }

  getSegments(): ReadonlyArray<SpeedSegment> {
    return this.segments;
  }

  private rebuild() {
    this.segments = [];
    this.totalTimelineDuration = 0;

    if (this.keyframes.length === 0) return;

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const startKf = this.keyframes[i];
      const endKf = this.keyframes[i + 1];

      const segment: SpeedSegment = {
        index: i,
        startKf,
        endKf,
        sourceStart: startKf.sourceTime,
        sourceEnd: endKf.sourceTime,
        timelineStart: this.totalTimelineDuration,
      };

      this.segments.push(segment);
      this.totalTimelineDuration += this.computeSegmentTimelineDuration(segment);
    }
  }

  private integrateTimelineDuration(seg: SpeedSegment, targetSourceTime: number): number {
    const v1 = seg.startKf.speed;
    const v2 = seg.endKf.speed;
    const delta = targetSourceTime - seg.sourceStart;
    const totalDelta = seg.sourceEnd - seg.sourceStart;

    if (seg.startKf.easing === 'hold') {
      if (Math.abs(v1) < 1e-10) return 0;
      return delta / v1;
    }

    if (seg.startKf.easing === 'linear' || !seg.startKf.easing) {
      if (Math.abs(v1 - v2) < 1e-10) {
        if (Math.abs(v1) < 1e-10) return 0;
        return delta / v1;
      }
      const ratio = totalDelta > 0.0001 ? delta / totalDelta : 0;
      const currentV = v1 + (v2 - v1) * ratio;
      if (v1 <= 0 || currentV <= 0) {
        return delta / Math.max(0.001, (v1 + currentV) / 2);
      }
      return (totalDelta / (v2 - v1)) * Math.log(currentV / v1);
    }

    // 5-Point Gauss-Legendre Quadrature for non-linear easing
    const x = [
      0.0,
      0.538469310105683,
      -0.538469310105683,
      0.906179845938664,
      -0.906179845938664
    ];
    const w = [
      0.568888888888889,
      0.478628670499366,
      0.478628670499366,
      0.236926885056189,
      0.236926885056189
    ];
    
    let integral = 0;
    const halfDelta = delta / 2;
    const midPoint = seg.sourceStart + halfDelta;
    
    for (let i = 0; i < 5; i++) {
      const s = midPoint + halfDelta * x[i];
      const speedAtS = this.interpolateSpeed(seg, s);
      const val = 1.0 / Math.max(0.01, speedAtS); // Avoid dividing by zero speed
      integral += w[i] * val;
    }
    
    return halfDelta * integral;
  }

  private computeSegmentTimelineDuration(seg: SpeedSegment): number {
    return this.integrateTimelineDuration(seg, seg.sourceEnd);
  }

  private partialSegmentTimelineDuration(seg: SpeedSegment, sourceTime: number): number {
    return this.integrateTimelineDuration(seg, sourceTime);
  }

  sourceToTimeline(sourceTime: number): number {
    if (this.keyframes.length === 0) return sourceTime;

    if (sourceTime <= this.keyframes[0].sourceTime) {
      const offset = sourceTime - this.keyframes[0].sourceTime;
      return offset / this.keyframes[0].speed;
    }

    let accumulated = 0;
    for (const seg of this.segments) {
      if (sourceTime <= seg.sourceEnd) {
        return seg.timelineStart + this.partialSegmentTimelineDuration(seg, sourceTime);
      }
      accumulated = seg.timelineStart + this.computeSegmentTimelineDuration(seg);
    }

    const lastKf = this.keyframes[this.keyframes.length - 1];
    const offset = sourceTime - lastKf.sourceTime;
    return accumulated + offset / lastKf.speed;
  }

  timelineToSource(timelineTime: number): number {
    if (this.keyframes.length === 0) return timelineTime;

    const firstSeg = this.segments[0];
    const lastSeg = this.segments[this.segments.length - 1];

    if (firstSeg && timelineTime < firstSeg.timelineStart) {
      const offset = timelineTime - firstSeg.timelineStart;
      return this.keyframes[0].sourceTime + offset * this.keyframes[0].speed;
    }

    // Time at/past the end of the ramp: extrapolate with the LAST keyframe's
    // constant speed. (Previously this branch was unreachable — the loop below
    // always matched the last segment and extrapolated the final easing curve,
    // which produced wrong source times for ramped trims past the last keyframe.)
    if (lastSeg) {
      const lastSegEnd = lastSeg.timelineStart + this.computeSegmentTimelineDuration(lastSeg);
      if (timelineTime >= lastSegEnd) {
        const lastKf = this.keyframes[this.keyframes.length - 1];
        return lastKf.sourceTime + (timelineTime - lastSegEnd) * lastKf.speed;
      }
    }

    for (const seg of this.segments) {
      const segDuration = this.computeSegmentTimelineDuration(seg);
      const segEndTime = seg.timelineStart + segDuration;

      if (timelineTime <= segEndTime) {
        const localTime = timelineTime - seg.timelineStart;

        // Only 'linear' (and 'hold') have a matching closed-form inverse. Every
        // other easing is integrated numerically (Gauss-Legendre), so the
        // inverse MUST also be solved numerically — using the linear log-inverse
        // for easeIn/easeOut/easeInOut produced wrong source times (video played
        // at the wrong position inside eased ramp segments).
        if (seg.startKf.easing === 'linear' || seg.startKf.easing === 'hold') {
          return this.solveSourceTimeClosedForm(seg, localTime);
        }
        
        return this.solveSourceTimeNumerical(seg, localTime);
      }
    }

    return this.keyframes[this.keyframes.length - 1].sourceTime;
  }

  private solveSourceTimeClosedForm(seg: SpeedSegment, localT: number): number {
    const v1 = seg.startKf.speed;
    const v2 = seg.endKf.speed;
    const delta = seg.sourceEnd - seg.sourceStart;

    if (seg.startKf.easing === 'hold') {
      return seg.sourceStart + localT * v1;
    }

    // Guard non-positive speeds: the closed-form exponential inverse is only
    // valid for v1 > 0. Fall back to a constant-speed approximation instead of
    // producing NaN / nonsense source times.
    if (v1 <= 0 || v2 <= 0) {
      return seg.sourceStart + localT * Math.max(0.01, v1);
    }

    if (Math.abs(v1 - v2) < 1e-10) {
      return seg.sourceStart + localT * v1;
    }

    const expTerm = Math.exp((localT * (v2 - v1)) / delta);
    const vAtS = v1 * expTerm;
    return seg.sourceStart + (delta * (vAtS - v1)) / (v2 - v1);
  }

  private solveSourceTimeNumerical(seg: SpeedSegment, targetLocalT: number): number {
    let low = seg.sourceStart;
    let high = seg.sourceEnd;
    
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      const midT = this.partialSegmentTimelineDuration(seg, mid);
      
      if (midT < targetLocalT) {
        low = mid;
      } else {
        high = mid;
      }
    }
    
    return (low + high) / 2;
  }

  getSpeedAtSourceTime(sourceTime: number): number {
    if (this.keyframes.length === 0) return 1.0;
    
    if (sourceTime <= this.keyframes[0].sourceTime) return this.keyframes[0].speed;
    
    const last = this.keyframes[this.keyframes.length - 1];
    if (sourceTime >= last.sourceTime) return last.speed;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (sourceTime >= seg.sourceStart && sourceTime <= seg.sourceEnd) {
        return this.interpolateSpeed(seg, sourceTime);
      }
    }

    return 1.0;
  }

  getSpeedAtTimelineTime(timelineTime: number): number {
    if (this.keyframes.length === 0) return 1.0;
    if (timelineTime <= 0) return this.keyframes[0].speed;
    if (timelineTime >= this.totalTimelineDuration) {
      return this.keyframes[this.keyframes.length - 1].speed;
    }

    const sourceTime = this.timelineToSource(timelineTime);
    return this.getSpeedAtSourceTime(sourceTime);
  }

  private interpolateSpeed(seg: SpeedSegment, sourceTime: number): number {
    const delta = seg.sourceEnd - seg.sourceStart;
    const t = delta > 0.0001 ? (sourceTime - seg.sourceStart) / delta : 0;
    const v1 = seg.startKf.speed;
    const v2 = seg.endKf.speed;

    switch (seg.startKf.easing) {
      case 'linear':
        return v1 + (v2 - v1) * t;
      case 'hold':
        return v1;
      case 'easeIn':
        return v1 + (v2 - v1) * (t * t);
      case 'easeOut':
        return v1 + (v2 - v1) * (1 - Math.pow(1 - t, 2));
      case 'easeInOut':
        return v1 + (v2 - v1) * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      case 'bezier':
        return v1 + (v2 - v1) * this.cubicBezierY(t, seg.startKf.bezierControl);
      default:
        return v1 + (v2 - v1) * t;
    }
  }

  private cubicBezierY(t: number, control?: { out: Point; in: Point }): number {
    if (!control) return t;
    
    const p0 = { x: 0, y: 0 };
    const p1 = control.out;
    const p2 = control.in;
    const p3 = { x: 1, y: 1 };
    
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = this.bezierValue(u, p0.x, p1.x, p2.x, p3.x);
      const dx = this.bezierDerivative(u, p0.x, p1.x, p2.x, p3.x);
      if (Math.abs(dx) < 1e-6) break;
      u = u - (x - t) / dx;
      u = Math.max(0, Math.min(1, u));
    }
    
    return this.bezierValue(u, p0.y, p1.y, p2.y, p3.y);
  }

  private bezierValue(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const mt = 1 - t;
    return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
  }

  private bezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const mt = 1 - t;
    return 3*mt*mt*(p1-p0) + 6*mt*t*(p2-p1) + 3*t*t*(p3-p2);
  }

  generateFrameMap(
    timelineStart: number,
    timelineEnd: number,
    targetFPS: number,
    sourceFPS: number
  ): FrameMapping[] {
    const maps: FrameMapping[] = [];
    const startFrame = Math.floor(timelineStart * targetFPS);
    const endFrame = Math.ceil(timelineEnd * targetFPS);

    for (let f = startFrame; f <= endFrame; f++) {
      const timelineTime = f / targetFPS;
      const sourceTime = this.timelineToSource(timelineTime);
      const sourceFrame = sourceTime * sourceFPS;
      const speed = this.getSpeedAtSourceTime(sourceTime);
      
      maps.push({
        timelineFrame: f,
        sourceFrame,
        speed,
        needsInterpolation: (sourceFrame - Math.floor(sourceFrame)) > 0.01 || speed < 0.8,
      });
    }

    return maps;
  }
}

// ============================================================
// ENGINE CACHE FACTORY (Fixes memory leaks)
// ============================================================
const engineCache = new Map<string, { key: string; engine: SpeedRampEngine }>();

export function getSpeedRampEngine(clipId: string, ramp: SpeedRampKeyframe[] | undefined): SpeedRampEngine {
  const cacheKey = JSON.stringify(ramp || []);
  const cached = engineCache.get(clipId);
  if (cached && cached.key === cacheKey) {
    return cached.engine;
  }
  const engine = new SpeedRampEngine(ramp || []);
  engineCache.set(clipId, { key: cacheKey, engine });
  
  if (engineCache.size > 200) {
    const firstKey = engineCache.keys().next().value;
    if (firstKey !== undefined) {
      engineCache.delete(firstKey);
    }
  }
  return engine;
}

// ============================================================
// COMPATIBILITY EXPORTS
// ============================================================
export function getFullKeyframes(ramp: SpeedRampKeyframe[] | undefined): SpeedRampKeyframe[] {
  if (!ramp || ramp.length === 0) {
    return [
      { id: 'start', sourceTime: 0, speed: 1.0, easing: 'linear' },
      { id: 'end', sourceTime: 10000, speed: 1.0, easing: 'linear' }
    ];
  }
  return [...ramp].sort((a, b) => a.sourceTime - b.sourceTime);
}

export function getSpeedAtPosition(ramp: SpeedRampKeyframe[] | undefined, p: number): number {
  if (!ramp || ramp.length < 2) return 1.0;
  const engine = new SpeedRampEngine(ramp);
  const duration = engine.getTotalTimelineDuration();
  const timelineTime = p * duration;
  const sourceTime = engine.timelineToSource(timelineTime);
  return engine.getSpeedAtSourceTime(sourceTime);
}

export function getMediaTimeAtPosition(
  clipId: string,
  ramp: SpeedRampKeyframe[] | undefined,
  p: number,
  clipDuration: number
): number {
  if (!ramp || ramp.length < 2) return p * clipDuration;
  const engine = getSpeedRampEngine(clipId, ramp);
  const duration = engine.getTotalTimelineDuration();
  const timelineTime = p * duration;
  return engine.timelineToSource(timelineTime);
}

export function getMediaTimeForClip(
  clip: { id: string; startTime: number; duration: number; trimStart: number; speed: number; speedRamp?: SpeedRampKeyframe[]; speedFrames?: SpeedFrame[]; speedFrameSourceEnd?: number; isReversed?: boolean; freezeFrame?: number },
  currentTime: number
): number {
  // FREEZE FRAME: ignore timeline position, always return the held frame
  if (clip.freezeFrame !== undefined) {
    return clip.freezeFrame;
  }

  const elapsedTimeline = currentTime - clip.startTime;

  if (clip.isReversed) {
    // REVERSE: map elapsed forward time → backward media time.
    // sourceDuration = how many seconds of source content this clip covers.
    // At elapsed=0 → end of source content (trimStart + sourceDuration)
    // At elapsed=duration → trimStart (beginning of source content)
    const sourceDuration = clip.duration * clip.speed;
    const mediaElapsed = elapsedTimeline * clip.speed;
    // Clamp to [0, sourceDuration] to avoid seeking outside source bounds
    const clampedElapsed = Math.max(0, Math.min(sourceDuration, mediaElapsed));
    return clip.trimStart + sourceDuration - clampedElapsed;
  }

  if (clip.speedFrames && clip.speedFrames.length > 0) {
    const segments = getSpeedFrameSegments(clip);
    for (const seg of segments) {
      if (elapsedTimeline >= seg.startOffset && elapsedTimeline <= seg.endOffset) {
        return seg.sourceStart + (elapsedTimeline - seg.startOffset) * seg.speed;
      }
    }
    if (segments.length > 0) {
      if (elapsedTimeline < segments[0].startOffset) {
        return segments[0].sourceStart + (elapsedTimeline - segments[0].startOffset) * segments[0].speed;
      }
      const lastSeg = segments[segments.length - 1];
      return lastSeg.sourceStart + (elapsedTimeline - lastSeg.startOffset) * lastSeg.speed;
    }
  }

  if (!clip.speedRamp || clip.speedRamp.length < 2) {
    return elapsedTimeline * clip.speed + clip.trimStart;
  }
  const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
  const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
  const targetTimelineTime = localTimelineStart + elapsedTimeline;
  return engine.timelineToSource(targetTimelineTime);
}

/**
 * Returns the instantaneous playback speed at a given timeline time for a clip.
 * When a speed ramp exists, the speed varies per segment. When no ramp exists,
 * returns the flat clip.speed value.
 */
export function getSpeedForClipAtTime(
  clip: { id: string; startTime: number; duration: number; trimStart: number; speed: number; speedRamp?: SpeedRampKeyframe[]; speedFrames?: SpeedFrame[]; speedFrameSourceEnd?: number; isReversed?: boolean; freezeFrame?: number },
  currentTime: number
): number {
  if (clip.freezeFrame !== undefined) return 0;
  if (clip.isReversed) return clip.speed;

  const elapsedTimeline = Math.max(0, Math.min(clip.duration, currentTime - clip.startTime));

  // If clip has embedded speed frames, resolve the exact segment speed
  if (clip.speedFrames && clip.speedFrames.length > 0) {
    const segments = getSpeedFrameSegments(clip);
    for (const seg of segments) {
      if (elapsedTimeline >= seg.startOffset && elapsedTimeline <= seg.endOffset) {
        return seg.speed;
      }
    }
    if (segments.length > 0) {
      return segments[segments.length - 1].speed;
    }
  }

  if (!clip.speedRamp || clip.speedRamp.length < 2) return clip.speed;

  const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
  const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
  const targetTimelineTime = localTimelineStart + elapsedTimeline;
  return engine.getSpeedAtTimelineTime(targetTimelineTime);
}

export function getRampedTrimEndForRightResize(
  clip: { id: string; trimStart: number; speedRamp?: SpeedRampKeyframe[]; speed: number },
  newTimelineDuration: number,
  maxDuration: number
): number {
  if (!clip.speedRamp || clip.speedRamp.length < 2) {
    return Math.max(0, maxDuration - clip.trimStart - newTimelineDuration * clip.speed);
  }
  const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
  const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
  const targetTimelineTime = localTimelineStart + newTimelineDuration;
  const newSourceEnd = engine.timelineToSource(targetTimelineTime);
  return Math.max(0, maxDuration - newSourceEnd);
}

export function getRampedTrimStartForLeftResize(
  clip: { id: string; trimStart: number; speedRamp?: SpeedRampKeyframe[]; speed: number },
  shiftOnTimeline: number
): number {
  if (!clip.speedRamp || clip.speedRamp.length < 2) {
    return Math.max(0, clip.trimStart + shiftOnTimeline * clip.speed);
  }
  const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
  const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
  const targetTimelineTime = localTimelineStart + shiftOnTimeline;
  return Math.max(0, engine.timelineToSource(targetTimelineTime));
}

// The amount of SOURCE media (seconds) covered by a clip. For a flat-speed clip
// this is `duration * speed`; for a ramped clip it is the source span between
// the clip's ramped start and end positions. Used by audio analysis (loudness
// normalization, voice tuning) so a trimmed/ramped clip never analyses source
// media that lies outside the clip.
export function getRampedClipSourceSpan(
  clip: { id: string; trimStart: number; duration: number; speed: number; speedRamp?: SpeedRampKeyframe[] },
  sourceDuration: number
): number {
  if (!clip.speedRamp || clip.speedRamp.length < 2) {
    return Math.max(0, clip.duration * Math.max(0.01, clip.speed ?? 1));
  }
  const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
  const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
  const sourceEnd = engine.timelineToSource(localTimelineStart + clip.duration);
  return Math.max(0, Math.min(sourceDuration, sourceEnd - clip.trimStart));
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT HALF MEDIA MATH (pure — used by editorStore.splitClip)
// -----------------------------------------------------------------------------
// Computes everything media-related needed to split a clip at `splitTime`:
// the two halves' trim values, the boundary source position, and the remapped
// speed-ramp keyframes. Extracted from the store so the math is unit-testable
// and identical for every split path (tool click, keyboard, playhead split).
//
// Invariants enforced (and covered by speedRamp.test.ts):
//  1. CONTINUITY: both halves, evaluated at the split instant, must map to the
//     SAME source position the original clip showed at that instant.
//  2. TRIMMED RAMPS: the boundary keyframe is placed at the source position
//     corresponding to the split point in the clip's LOCAL timeline (offset by
//     sourceToTimeline(trimStart)) — the old code ignored trimStart and put
//     the keyframe at the wrong source position.
//  3. REVERSED CLIPS: media is consumed backwards, so the halves' trimStart is
//     adjusted to keep the reversed mapping continuous (a naive split made the
//     right half jump to the wrong source frame).
//  4. The two halves cover exactly the original's source range: left
//     [trimStart..splitMediaTime], right [splitMediaTime..trimStart+span].
// ─────────────────────────────────────────────────────────────────────────────
export interface SplitHalvesMedia {
  leftTrimStart: number;
  leftTrimEnd: number;
  rightTrimStart: number;
  rightTrimEnd: number;
  splitMediaTime: number;
  leftSpeedRamp: SpeedRampKeyframe[] | undefined;
  rightSpeedRamp: SpeedRampKeyframe[] | undefined;
}

export function computeSplitHalvesMedia(
  clip: {
    id: string;
    startTime: number;
    duration: number;
    trimStart?: number;
    trimEnd?: number;
    speed?: number;
    speedRamp?: SpeedRampKeyframe[];
    isReversed?: boolean;
    freezeFrame?: number;
  },
  splitTime: number,
  newKeyId: () => string = () => `kf-split-${Math.random().toString(36).slice(2, 10)}`
): SplitHalvesMedia {
  const trimStart = clip.trimStart ?? 0;
  const trimEnd = clip.trimEnd ?? 0;
  const speed = clip.speed ?? 1;
  const relativeSplitTime = splitTime - clip.startTime;
  const safeRel = Math.max(0.001, Math.min(relativeSplitTime, clip.duration - 0.001));

  const hasRamp = clip.speedRamp && clip.speedRamp.length >= 2;

  // Source media position of the split point. Always through the shared engine
  // so ramped, reversed and frozen clips split at exactly the frame the preview
  // shows.
  const splitMediaTime = getMediaTimeForClip(
    {
      id: clip.id,
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart,
      speed,
      speedRamp: clip.speedRamp,
      isReversed: clip.isReversed,
      freezeFrame: clip.freezeFrame,
    },
    splitTime
  );

  // Remap speed ramp keyframes for each half when a ramp exists.
  let leftSpeedRamp: SpeedRampKeyframe[] | undefined = clip.speedRamp;
  let rightSpeedRamp: SpeedRampKeyframe[] | undefined = clip.speedRamp;
  // Source position the clip's playback ENDS at (trim-aware) — used for the
  // left half's trimEnd so a TRIMMED ramped clip doesn't overstate how much
  // source remains beyond the split.
  let clipSourceEnd = trimStart + clip.duration * speed;
  let localTimelineStart = 0;

  if (hasRamp) {
    const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
    // The engine's timeline axis starts at source 0, but a TRIMMED clip only
    // plays from trimStart onward — offset the split point by the trimmed
    // local start so the boundary keyframe lands at the correct source
    // position (bug fix: previously ignored trimStart entirely).
    localTimelineStart = engine.sourceToTimeline(trimStart);
    clipSourceEnd = engine.timelineToSource(localTimelineStart + clip.duration);
    const splitSourceTime = engine.timelineToSource(localTimelineStart + safeRel);
    const splitSpeed = engine.getSpeedAtSourceTime(splitSourceTime);

    const sorted = [...clip.speedRamp!].sort((a, b) => a.sourceTime - b.sourceTime);

    // Left half: keyframes in [0, splitSourceTime]
    const leftKeys = sorted.filter((kf) => kf.sourceTime < splitSourceTime);
    leftKeys.push({
      id: newKeyId(),
      sourceTime: splitSourceTime,
      speed: splitSpeed,
      easing: 'linear',
    });
    leftSpeedRamp = leftKeys;

    // Right half: keyframes in [splitSourceTime, end]
    const rightKeys = sorted.filter((kf) => kf.sourceTime > splitSourceTime);
    rightKeys.unshift({
      id: newKeyId(),
      sourceTime: splitSourceTime,
      speed: splitSpeed,
      easing: 'linear',
    });
    rightSpeedRamp = rightKeys;
  }

  // REVERSED CLIPS: media is consumed BACKWARD — the left half plays
  // [splitMediaTime … trimStart + S] and the right half continues from
  // splitMediaTime toward trimStart. getMediaTimeForClip maps
  //   elapsed → trimStart + sourceDuration − elapsed·speed,
  // so the halves' trimStart must be adjusted for the mapping to stay
  // continuous across the split point.
  const rightSourceDuration = (clip.duration - relativeSplitTime) * speed;
  const leftTrimStart = clip.isReversed
    ? trimStart + (clip.duration - relativeSplitTime) * speed
    : trimStart;
  const rightTrimStart = clip.isReversed ? splitMediaTime - rightSourceDuration : splitMediaTime;

  // trimEnd measures how much SOURCE remains beyond the half's coverage.
  //   left half  covers [trimStart .. splitMediaTime]      → remaining = end − splitMediaTime
  //   right half covers [splitMediaTime .. trimStart + S]  → remaining = original trimEnd
  // REVERSED playback consumes source backward, so the halves' coverage is
  // flipped:
  //   left half  covers [splitMediaTime .. leftTrimStart]  → remaining = trimEnd + rel·s
  //   right half covers [trimStart .. splitMediaTime]      → remaining = trimEnd + (d−rel)·s
  // (The old code kept the original trimEnd on both reversed halves, which
  // made expansion limits and source-span checks wrong after splitting a
  // reversed clip.)
  // Unified: leftTrimEnd = original trimEnd + (source the right half consumes
  // past the split). For ramps the consumed source is (clipSourceEnd −
  // splitMediaTime); for flat clips it is (d − rel)·s, which collapses the
  // formula to the same expression as the trimEnd term.
  const leftTrimEnd = clip.isReversed
    ? trimEnd + relativeSplitTime * speed
    : trimEnd + (clipSourceEnd - splitMediaTime);
  const rightTrimEnd = clip.isReversed
    ? trimEnd + (clip.duration - relativeSplitTime) * speed
    : trimEnd;

  return {
    leftTrimStart,
    leftTrimEnd,
    rightTrimStart,
    rightTrimEnd,
    splitMediaTime,
    leftSpeedRamp,
    rightSpeedRamp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED SPEED FRAMES (Non-splitting in-clip dynamic rate stretching)
// ─────────────────────────────────────────────────────────────────────────────

export interface SpeedFrameSegment {
  index: number;
  startOffset: number; // timeline seconds from clip start
  endOffset: number;   // timeline seconds from clip start
  speed: number;       // calculated speed multiplier
  sourceStart: number;
  sourceEnd: number;
}

/**
 * Calculates the total source media span for a clip.
 */
export function getClipSourceEnd(
  clip: { duration: number; trimStart: number; trimEnd?: number; speed?: number; speedFrameSourceEnd?: number },
  sourceDuration?: number
): number {
  if (clip.speedFrameSourceEnd !== undefined && clip.speedFrameSourceEnd > clip.trimStart) {
    return clip.speedFrameSourceEnd;
  }
  const baseSpeed = Math.max(0.01, clip.speed ?? 1);
  if (sourceDuration !== undefined && sourceDuration > 0 && clip.trimEnd !== undefined) {
    return Math.max(clip.trimStart + 0.05, sourceDuration - clip.trimEnd);
  }
  return clip.trimStart + clip.duration * baseSpeed;
}

/**
 * Computes all segments between boundaries (clip start edge 0, speed frames 1..n, clip end edge duration).
 * If no speed frames exist, returns empty array.
 * If 1 or more speed frames exist, calculates rates using adjacent speed frames OR clip edges when no adjacent frame exists.
 */
export function getSpeedFrameSegments(
  clip: { duration: number; trimStart: number; trimEnd?: number; speed?: number; speedFrames?: SpeedFrame[]; speedFrameSourceEnd?: number },
  sourceDuration?: number
): SpeedFrameSegment[] {
  if (!clip.speedFrames || clip.speedFrames.length === 0) return [];

  const sortedFrames = [...clip.speedFrames].sort((a, b) => a.timelineOffset - b.timelineOffset);
  const s0 = clip.trimStart;
  const sEnd = getClipSourceEnd(clip, sourceDuration);
  const d = Math.max(0.05, clip.duration);

  // Boundaries:
  // Boundary 0: clip start edge (offset 0, source s0)
  // Boundary 1..n: sorted speed frames (offset t_k, source s_k)
  // Boundary n+1: clip end edge (offset d, source sEnd)
  const points: { timelineOffset: number; sourceTime: number }[] = [
    { timelineOffset: 0, sourceTime: s0 },
    ...sortedFrames.map((f) => ({ timelineOffset: f.timelineOffset, sourceTime: f.sourceTime })),
    { timelineOffset: d, sourceTime: sEnd }
  ];

  const segments: SpeedFrameSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const deltaT = Math.max(0.01, p2.timelineOffset - p1.timelineOffset);
    const deltaS = Math.max(0.001, p2.sourceTime - p1.sourceTime);
    const speed = Math.min(50, Math.max(0.05, deltaS / deltaT));

    segments.push({
      index: i,
      startOffset: p1.timelineOffset,
      endOffset: p2.timelineOffset,
      speed,
      sourceStart: p1.sourceTime,
      sourceEnd: p2.sourceTime,
    });
  }

  return segments;
}

/**
 * Converts a clip's speedFrames into constant-rate 'hold' keyframes for SpeedRampEngine.
 * Returns undefined if no speedFrames exist.
 */
export function calculateSpeedFramesRamp(
  clip: { duration: number; trimStart: number; trimEnd?: number; speed?: number; speedFrames?: SpeedFrame[]; speedFrameSourceEnd?: number },
  sourceDuration?: number
): SpeedRampKeyframe[] | undefined {
  if (!clip.speedFrames || clip.speedFrames.length === 0) return undefined;

  const segments = getSpeedFrameSegments(clip, sourceDuration);
  if (segments.length === 0) return undefined;

  const sortedFrames = [...clip.speedFrames].sort((a, b) => a.timelineOffset - b.timelineOffset);

  // Keyframe 0 at s0: runs with segment 0's speed
  const keyframes: SpeedRampKeyframe[] = [
    {
      id: 'sf-start',
      sourceTime: segments[0].sourceStart,
      speed: segments[0].speed,
      easing: 'hold',
    }
  ];

  // Keyframes for each speed frame: runs with segment (i+1)'s speed
  for (let i = 0; i < sortedFrames.length; i++) {
    const sf = sortedFrames[i];
    const seg = segments[i + 1];
    keyframes.push({
      id: sf.id,
      sourceTime: sf.sourceTime,
      speed: seg ? seg.speed : segments[i].speed,
      easing: 'hold',
    });
  }

  // Keyframe at source end
  const lastSeg = segments[segments.length - 1];
  keyframes.push({
    id: 'sf-end',
    sourceTime: lastSeg.sourceEnd,
    speed: lastSeg.speed,
    easing: 'hold',
  });

  return keyframes;
}

/**
 * Adds a new Speed Frame to a clip at `timelineOffset`.
 * Anchors the exact current source media time at that timeline position,
 * and fixes speedFrameSourceEnd so future rate-stretching never alters source boundaries.
 */
export function addSpeedFrameToClip<T extends { id: string; startTime: number; duration: number; trimStart: number; trimEnd?: number; speed: number; speedRamp?: SpeedRampKeyframe[]; speedFrames?: SpeedFrame[]; speedFrameSourceEnd?: number; isReversed?: boolean; freezeFrame?: number }>(
  clip: T,
  timelineOffset: number,
  sourceDuration?: number
): { clip: T; newFrameId: string } {
  const d = clip.duration;
  const clampedOffset = Math.max(0.05, Math.min(d - 0.05, timelineOffset));

  // Sample exact media time at this moment
  const mediaTime = getMediaTimeForClip(clip, clip.startTime + clampedOffset);

  const newFrameId = 'sf_' + Math.random().toString(36).substring(2, 9);
  const newFrame: SpeedFrame = {
    id: newFrameId,
    timelineOffset: clampedOffset,
    sourceTime: mediaTime,
  };

  const currentFrames = clip.speedFrames ? [...clip.speedFrames] : [];
  const updatedFrames = [...currentFrames, newFrame].sort((a, b) => a.timelineOffset - b.timelineOffset);

  // Anchor the source end so stretching/squeezing the clip never shrinks or extends source media
  const fixedSourceEnd = clip.speedFrameSourceEnd ?? getClipSourceEnd(clip, sourceDuration);

  const updatedClip: T = {
    ...clip,
    speedFrames: updatedFrames,
    speedFrameSourceEnd: fixedSourceEnd,
  };

  updatedClip.speedRamp = calculateSpeedFramesRamp(updatedClip, sourceDuration);

  return { clip: updatedClip, newFrameId };
}

/**
 * Moves a Speed Frame line (Rate Stretch / Squeeze).
 *
 * Algorithm: the dragged speed frame's timelineOffset changes. ALL subsequent
 * speed frames shift by the same delta so their segment durations (and therefore
 * speeds) are preserved. The clip's total `duration` also changes by delta.
 * Only the segment directly BEFORE the moved speed frame changes speed.
 *
 * This means: dragging a speed frame RIGHT → stretches the left segment (slower)
 * → clip gets longer. Dragging LEFT → squeezes the left segment (faster) → clip
 * gets shorter. All segments after the moved frame maintain their original speed.
 */
export function moveSpeedFrameLine<T extends { duration: number; trimStart: number; trimEnd?: number; speed: number; speedFrames?: SpeedFrame[]; speedRamp?: SpeedRampKeyframe[]; speedFrameSourceEnd?: number }>(
  clip: T,
  frameId: string,
  newTimelineOffset: number,
  sourceDuration?: number
): T {
  if (!clip.speedFrames || clip.speedFrames.length === 0) return clip;

  const sorted = [...clip.speedFrames].sort((a, b) => a.timelineOffset - b.timelineOffset);
  const index = sorted.findIndex((f) => f.id === frameId);
  if (index === -1) return clip;

  const oldOffset = sorted[index].timelineOffset;

  // Left bound: must stay after the previous speed frame (or clip start 0s)
  const leftBound = index > 0 ? sorted[index - 1].timelineOffset + 0.05 : 0.05;
  const clampedOffset = Math.max(leftBound, newTimelineOffset);
  const delta = clampedOffset - oldOffset;

  if (Math.abs(delta) < 0.0001) return clip;

  // Shift the current frame and ALL subsequent frames by delta
  const updatedFrames = sorted.map((f, i) => {
    if (i === index) {
      return { ...f, timelineOffset: clampedOffset };
    }
    if (i > index) {
      return { ...f, timelineOffset: f.timelineOffset + delta };
    }
    return f;
  });

  // Update clip duration — stretching extends clip, squeezing shrinks it
  const newDuration = Math.max(0.05, clip.duration + delta);
  const fixedSourceEnd = clip.speedFrameSourceEnd ?? getClipSourceEnd(clip, sourceDuration);

  const updatedClip: T = {
    ...clip,
    speedFrames: updatedFrames,
    duration: newDuration,
    speedFrameSourceEnd: fixedSourceEnd,
  };

  updatedClip.speedRamp = calculateSpeedFramesRamp(updatedClip, sourceDuration);
  return updatedClip;
}

/**
 * Moves a Speed Frame Screw Head (Repositioning within clip).
 * Re-samples the media time at the new offset to slide the marker without distorting the overall speed curve.
 */
export function moveSpeedFrameScrew<T extends { id: string; startTime: number; duration: number; trimStart: number; trimEnd?: number; speed: number; speedFrames?: SpeedFrame[]; speedRamp?: SpeedRampKeyframe[]; speedFrameSourceEnd?: number; isReversed?: boolean; freezeFrame?: number }>(
  clip: T,
  frameId: string,
  newTimelineOffset: number,
  sourceDuration?: number
): T {
  if (!clip.speedFrames || clip.speedFrames.length === 0) return clip;

  const sorted = [...clip.speedFrames].sort((a, b) => a.timelineOffset - b.timelineOffset);
  const index = sorted.findIndex((f) => f.id === frameId);
  if (index === -1) return clip;

  const leftBound = index > 0 ? sorted[index - 1].timelineOffset + 0.05 : 0.05;
  const rightBound = index < sorted.length - 1 ? sorted[index + 1].timelineOffset - 0.05 : clip.duration - 0.05;

  const clampedOffset = Math.max(leftBound, Math.min(rightBound, newTimelineOffset));
  const newMediaTime = getMediaTimeForClip(clip, clip.startTime + clampedOffset);

  const updatedFrames = sorted.map((f, i) => {
    if (i === index) {
      return { ...f, timelineOffset: clampedOffset, sourceTime: newMediaTime };
    }
    return f;
  });

  const updatedClip: T = {
    ...clip,
    speedFrames: updatedFrames,
    speedFrameSourceEnd: clip.speedFrameSourceEnd ?? getClipSourceEnd(clip, sourceDuration),
  };

  updatedClip.speedRamp = calculateSpeedFramesRamp(updatedClip, sourceDuration);
  return updatedClip;
}

/**
 * Removes a Speed Frame from a clip.
 * If no speed frames remain, restores uniform playback and original timeline duration.
 */
export function removeSpeedFrameFromClip<T extends { duration: number; trimStart: number; trimEnd?: number; speed: number; speedFrames?: SpeedFrame[]; speedRamp?: SpeedRampKeyframe[]; speedFrameSourceEnd?: number }>(
  clip: T,
  frameId: string,
  sourceDuration?: number
): T {
  if (!clip.speedFrames) return clip;

  const remaining = clip.speedFrames.filter((f) => f.id !== frameId);
  if (remaining.length === 0) {
    const sourceEnd = clip.speedFrameSourceEnd ?? getClipSourceEnd(clip, sourceDuration);
    const sourceSpan = Math.max(0.05, sourceEnd - clip.trimStart);
    const restoredDuration = sourceSpan / Math.max(0.01, clip.speed ?? 1);

    return {
      ...clip,
      speedFrames: undefined,
      speedRamp: undefined,
      speedFrameSourceEnd: undefined,
      duration: restoredDuration,
    };
  }

  const updatedClip: T = {
    ...clip,
    speedFrames: remaining,
  };

  updatedClip.speedRamp = calculateSpeedFramesRamp(updatedClip, sourceDuration);
  return updatedClip;
}

