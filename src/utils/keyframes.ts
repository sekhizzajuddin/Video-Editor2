import { PropertyKeyframe } from '@/types';

/**
 * Newton-Raphson iteration to solve for X on a Cubic Bezier curve
 */
function solveBezierX(t: number, x1: number, x2: number): number {
  let x = t;
  for (let i = 0; i < 8; i++) {
    const x3 = 1 - x;
    const f = 3 * x3 * x3 * x * x1 + 3 * x3 * x * x * x2 + x * x * x - t;
    const df = 3 * x3 * x3 * x1 + 6 * x3 * x * (x2 - x1) + 3 * x * x * (1 - x2);
    if (Math.abs(f) < 1e-6) break;
    x = x - f / df;
    x = Math.max(0, Math.min(1, x));
  }
  return x;
}

/**
 * Cubic Bezier interpolation
 * t: 0-1 progress between keyframes
 * cp: control points {x, y, inX, inY}
 */
function cubicBezier(t: number, cp: NonNullable<PropertyKeyframe['bezier']>): number {
  const x1 = cp.x;
  const y1 = cp.y;
  const x2 = cp.inX ?? 1 - cp.x;
  const y2 = cp.inY ?? 1 - cp.y;

  const x = solveBezierX(t, x1, x2);
  const x3 = 1 - x;
  return 3 * x3 * x3 * x * y1 + 3 * x3 * x * x * y2 + x * x * x;
}

/**
 * Binary search for keyframe segment - O(log n)
 */
function findKeyframeIndex(keyframes: PropertyKeyframe[], time: number): number {
  if (keyframes.length === 0) return -1;
  if (time <= keyframes[0].time) return 0;
  if (time >= keyframes[keyframes.length - 1].time) return keyframes.length - 1;

  let left = 0;
  let right = keyframes.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (keyframes[mid].time === time) return mid;
    if (keyframes[mid].time < time) left = mid + 1;
    else right = mid - 1;
  }

  return Math.max(0, left - 1);
}

/**
 * Evaluates an animated property at a given absolute timeline time.
 * @param baseValue The default value if no keyframes or outside keyframes.
 * @param currentTime The global timeline current time.
 * @param clipStartTime The start time of the clip.
 * @param keyframes The array of keyframes for this property.
 * @returns The interpolated value.
 */
export function getAnimatedValue(
  baseValue: number,
  currentTime: number,
  clipStartTime: number,
  keyframes?: PropertyKeyframe[]
): number {
  if (!keyframes || keyframes.length === 0) return baseValue;

  const localTime = currentTime - clipStartTime;

  // Before first keyframe
  if (localTime <= keyframes[0].time) return keyframes[0].value;
  
  // After last keyframe
  if (localTime >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].value;
  }

  // Binary search for segment
  const idx = findKeyframeIndex(keyframes, localTime);
  if (idx < 0 || idx >= keyframes.length - 1) return baseValue;

  const k1 = keyframes[idx];
  const k2 = keyframes[idx + 1];

  if (k1.holdNext || k1.easing === 'hold') return k1.value;

  const timeDelta = k2.time - k1.time;
  if (timeDelta < 0.00001) return k1.value;

  let t = (localTime - k1.time) / timeDelta;
  t = Math.max(0, Math.min(1, t));

  // Apply easing curves
  const easing = k1.easing || 'linear';
  let easedT: number;

  switch (easing as any) {
    case 'ease-in':
    case 'easeIn':
      easedT = t * t;
      break;
    case 'ease-out':
    case 'easeOut':
      easedT = 1 - (1 - t) * (1 - t);
      break;
    case 'ease-in-out':
    case 'easeInOut':
      easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      break;
    case 'bezier':
      easedT = k1.bezier ? cubicBezier(t, k1.bezier) : t;
      break;
    case 'hold':
      return k1.value;
    default:
      easedT = t;
  }

  return k1.value + (k2.value - k1.value) * easedT;
}

/**
 * Adds or updates a keyframe at the given time with optional easing settings.
 */
export function addOrUpdateKeyframe(
  keyframes: PropertyKeyframe[] = [],
  localTime: number,
  value: number,
  options: {
    easing?: PropertyKeyframe['easing'];
    bezier?: PropertyKeyframe['bezier'];
    holdNext?: boolean;
  } = {}
): PropertyKeyframe[] {
  const newArray = [...keyframes];
  const idx = findKeyframeIndex(newArray, localTime);
  const existingIdx = (idx >= 0 && Math.abs(newArray[idx].time - localTime) < 0.03) ? idx : -1;
  
  const newKeyframe: PropertyKeyframe = {
    time: localTime,
    value,
    easing: options.easing || 'linear',
    holdNext: options.holdNext,
    bezier: options.easing === 'bezier' 
      ? (options.bezier || { x: 0.5, y: 0, inX: 0.5, inY: 1 })
      : undefined
  };

  if (existingIdx !== -1) {
    // Preserve existing bezier if updating and no new bezier provided
    if (options.easing === 'bezier' && !options.bezier && newArray[existingIdx].bezier) {
      newKeyframe.bezier = newArray[existingIdx].bezier;
    }
    newArray[existingIdx] = newKeyframe;
  } else {
    const insertIdx = newArray.findIndex(k => k.time > localTime);
    if (insertIdx === -1) newArray.push(newKeyframe);
    else newArray.splice(insertIdx, 0, newKeyframe);
  }

  if (options.easing === 'bezier' && !options.bezier && !newKeyframe.bezier) {
    return autoComputeBezierHandles(newArray);
  }

  return newArray;
}

/**
 * Auto-compute smooth bezier handles (Auto-Bezier like After Effects)
 */
export function autoComputeBezierHandles(keyframes: PropertyKeyframe[]): PropertyKeyframe[] {
  for (let i = 0; i < keyframes.length; i++) {
    if (keyframes[i].easing !== 'bezier') continue;
    
    const prev = i > 0 ? keyframes[i - 1] : null;
    const curr = keyframes[i];
    const next = i < keyframes.length - 1 ? keyframes[i + 1] : null;

    if (!prev || !next) {
      curr.bezier = { x: 0.33, y: 0.33, inX: 0.67, inY: 0.67 };
      continue;
    }

    // Compute smooth handles based on neighbor values
    const dx = next.time - prev.time;
    const dy = next.value - prev.value;
    const slope = dx > 0.001 ? dy / dx : 0;

    const outTime = (curr.time - prev.time) * 0.3;
    const inTime = (next.time - curr.time) * 0.3;

    curr.bezier = {
      x: 0.33,
      y: Math.max(0, Math.min(1, 0.33 + slope * outTime * 0.1)),
      inX: 0.67,
      inY: Math.max(0, Math.min(1, 0.67 + slope * inTime * 0.1))
    };
  }
  return keyframes;
}

/**
 * Copy keyframes between properties with time offset
 */
export function copyKeyframes(
  sourceKeyframes: PropertyKeyframe[],
  targetStartTime: number,
  sourceStartTime: number = 0
): PropertyKeyframe[] {
  return sourceKeyframes.map(kf => ({
    ...kf,
    time: kf.time - sourceStartTime + targetStartTime
  }));
}
