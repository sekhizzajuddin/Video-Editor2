import { SpeedRampKeyframe } from '../types';

export function getFullKeyframes(ramp: SpeedRampKeyframe[] | undefined): SpeedRampKeyframe[] {
  if (!ramp || ramp.length === 0) {
    return [
      { position: 0, speed: 1.0 },
      { position: 1, speed: 1.0 },
    ];
  }

  const sorted = [...ramp].sort((a, b) => a.position - b.position);
  const fullKeys: SpeedRampKeyframe[] = [];

  const first = sorted[0];
  if (first.position > 0) {
    fullKeys.push({ position: 0, speed: first.speed });
  }

  fullKeys.push(...sorted);

  const last = sorted[sorted.length - 1];
  if (last.position < 1) {
    fullKeys.push({ position: 1, speed: last.speed });
  }

  return fullKeys;
}

export function getSpeedAtPosition(ramp: SpeedRampKeyframe[] | undefined, p: number): number {
  const fullKeys = getFullKeyframes(ramp);
  const clampedP = Math.max(0, Math.min(1, p));

  // Find the interval
  let i = 0;
  for (; i < fullKeys.length - 1; i++) {
    if (clampedP <= fullKeys[i + 1].position) {
      break;
    }
  }

  const p1 = fullKeys[i];
  const p2 = fullKeys[i + 1];

  let t = 0;
  const range = p2.position - p1.position;
  if (range > 0.00001) {
    t = (clampedP - p1.position) / range;
  }

  const y1 = p1.speed;
  const y2 = p2.speed;

  // Catmull-Rom boundaries
  const y0 = i > 0 ? fullKeys[i - 1].speed : y1;
  const y3 = i + 2 < fullKeys.length ? fullKeys[i + 2].speed : y2;

  // Catmull-Rom spline formula
  const speed = 0.5 * (
    (2 * y1) +
    (-y0 + y2) * t +
    (2 * y0 - 5 * y1 + 4 * y2 - y3) * t * t +
    (-y0 + 3 * y1 - 3 * y2 + y3) * t * t * t
  );

  // Clamp the speed to safe playback rates
  return Math.max(0.1, Math.min(4.0, speed));
}

interface IntegralCacheEntry {
  key: string;
  table: number[]; // size 101, table[j] is integral from 0 to j/100
}

const integralCache = new Map<string, IntegralCacheEntry>();

function getIntegralTable(clipId: string, ramp: SpeedRampKeyframe[] | undefined): number[] {
  const cacheKey = JSON.stringify(ramp || []);
  const cached = integralCache.get(clipId);
  if (cached && cached.key === cacheKey) {
    return cached.table;
  }

  // Compute table of size 101
  const table = new Array(101);
  table[0] = 0;

  const N = 100;
  let runningSum = 0;

  const subSteps = 10;
  const dt = 1.0 / (N * subSteps);

  for (let i = 1; i <= N; i++) {
    const startP = (i - 1) / N;
    let intervalSum = 0;
    for (let k = 0; k < subSteps; k++) {
      const pA = startP + k * dt;
      const pB = startP + (k + 1) * dt;
      intervalSum += (getSpeedAtPosition(ramp, pA) + getSpeedAtPosition(ramp, pB)) / 2 * dt;
    }
    runningSum += intervalSum;
    table[i] = runningSum;
  }

  integralCache.set(clipId, { key: cacheKey, table });
  
  if (integralCache.size > 100) {
    const firstKey = integralCache.keys().next().value;
    if (firstKey !== undefined) {
      integralCache.delete(firstKey);
    }
  }

  return table;
}

export function getMediaTimeAtPosition(
  clipId: string,
  ramp: SpeedRampKeyframe[] | undefined,
  p: number,
  clipDuration: number
): number {
  if (p <= 0) return 0;

  if (p >= 1) {
    const table = getIntegralTable(clipId, ramp);
    const baseIntegral = table[100];
    const endSpeed = getSpeedAtPosition(ramp, 1.0);
    return (baseIntegral + (p - 1.0) * endSpeed) * clipDuration;
  }

  const table = getIntegralTable(clipId, ramp);
  const indexFloat = p * 100;
  const idx = Math.floor(indexFloat);
  const frac = indexFloat - idx;

  const integral = table[idx] + frac * (table[idx + 1] - table[idx]);
  return integral * clipDuration;
}

export function getMediaTimeForClip(
  clip: { id: string; startTime: number; duration: number; trimStart: number; speed: number; speedRamp?: SpeedRampKeyframe[] },
  currentTime: number
): number {
  const elapsedTimeline = currentTime - clip.startTime;
  if (!clip.speedRamp || clip.speedRamp.length < 2) {
    return elapsedTimeline * clip.speed + clip.trimStart;
  }

  const p = elapsedTimeline / clip.duration;
  return getMediaTimeAtPosition(clip.id, clip.speedRamp, p, clip.duration) + clip.trimStart;
}
