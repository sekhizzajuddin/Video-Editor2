import { SpeedRampKeyframe } from '../types';

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

    for (const seg of this.segments) {
      const segDuration = this.computeSegmentTimelineDuration(seg);
      const segEndTime = seg.timelineStart + segDuration;

      if (timelineTime <= segEndTime || seg === lastSeg) {
        const localTime = timelineTime - seg.timelineStart;
        
        if (seg.startKf.easing === 'bezier') {
          return this.solveSourceTimeNumerical(seg, localTime);
        }
        
        return this.solveSourceTimeClosedForm(seg, localTime);
      }
    }

    const lastKf = this.keyframes[this.keyframes.length - 1];
    const lastSegEnd = lastSeg.timelineStart + this.computeSegmentTimelineDuration(lastSeg);
    const offset = timelineTime - lastSegEnd;
    return lastKf.sourceTime + offset * lastKf.speed;
  }

  private solveSourceTimeClosedForm(seg: SpeedSegment, localT: number): number {
    const v1 = seg.startKf.speed;
    const v2 = seg.endKf.speed;
    const delta = seg.sourceEnd - seg.sourceStart;

    if (seg.startKf.easing === 'hold') {
      return seg.sourceStart + localT * v1;
    }

    if (Math.abs(v1 - v2) < 1e-10) {
      if (Math.abs(v1) < 1e-10) return seg.sourceStart;
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
  clip: { id: string; startTime: number; duration: number; trimStart: number; speed: number; speedRamp?: SpeedRampKeyframe[]; isReversed?: boolean; freezeFrame?: number },
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

  if (!clip.speedRamp || clip.speedRamp.length < 2) {
    return elapsedTimeline * clip.speed + clip.trimStart;
  }
  const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
  const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
  const targetTimelineTime = localTimelineStart + elapsedTimeline;
  return engine.timelineToSource(targetTimelineTime);
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
