import { PropertyKeyframe } from '@/types';

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
  if (localTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

  // Interpolate between keyframes
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];
    if (localTime >= k1.time && localTime < k2.time) {
      if (k1.holdNext) {
        return k1.value;
      }
      const timeDelta = k2.time - k1.time;
      let t = timeDelta > 0.00001 ? (localTime - k1.time) / timeDelta : 0;
      
      // Apply easing curves (support both kebab-case and camelCase)
      const easing = (k1.easing || 'linear') as string;
      if (easing === 'ease-in' || easing === 'easeIn') {
        t = t * t;
      } else if (easing === 'ease-out' || easing === 'easeOut') {
        t = t * (2 - t);
      } else if (easing === 'ease-in-out' || easing === 'easeInOut') {
        t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }
      
      return k1.value + (k2.value - k1.value) * t;
    }
  }

  return baseValue;
}

/**
 * Adds or updates a keyframe at the given time.
 * Returns a new array of keyframes.
 */
export function addOrUpdateKeyframe(
  keyframes: PropertyKeyframe[] = [],
  localTime: number,
  value: number
): PropertyKeyframe[] {
  const newArray = [...keyframes];
  
  // Check if a keyframe already exists very close to this time (e.g. within 1 frame = ~0.03s)
  const existingIdx = newArray.findIndex(k => Math.abs(k.time - localTime) < 0.03);
  
  if (existingIdx !== -1) {
    newArray[existingIdx] = { ...newArray[existingIdx], value };
  } else {
    newArray.push({ time: localTime, value });
  }

  // Sort by time
  newArray.sort((a, b) => a.time - b.time);
  return newArray;
}
