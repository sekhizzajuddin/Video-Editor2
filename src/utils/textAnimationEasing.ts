/**
 * Text Animation Easing Functions
 * Provides configurable easing curves for text intro/outro animations.
 */

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeOutBack' | 'easeOutElastic' | 'easeOutBounce';

/**
 * Apply an easing function to a linear progress value (0-1).
 * Returns the eased progress value (0-1, may overshoot for elastic/back).
 */
export function applyEasing(t: number, easing: EasingType = 'easeOut'): number {
  // Clamp input to 0-1 range
  t = Math.max(0, Math.min(1, t));
  
  switch (easing) {
    case 'linear':
      return t;
    
    case 'easeIn':
      // Cubic ease-in: slow start, fast end
      return t * t * t;
    
    case 'easeOut':
      // Cubic ease-out: fast start, slow end (most natural for text)
      return 1 - Math.pow(1 - t, 3);
    
    case 'easeInOut':
      // Cubic ease-in-out: smooth acceleration and deceleration
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    
    case 'easeOutBack':
      // Overshoots target then settles back (bouncy kinetic pop)
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    
    case 'easeOutElastic':
      // Spring-like elastic overshoot
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    
    case 'easeOutBounce':
      // Multiple bounces like a ball
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) {
        return n1 * t * t;
      } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75;
      } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
      } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      }
    
    default:
      return t;
  }
}

/**
 * Attempt a simple Perlin-ish noise for wiggle/jitter animations.
 * Deterministic: same seed + time = same result.
 */
export function pseudoNoise(seed: number, t: number): number {
  const x = Math.sin(seed * 127.1 + t * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Smooth Perlin-like noise using cosine interpolation between random samples.
 */
export function smoothNoise(seed: number, t: number, frequency: number = 3): number {
  const scaledT = t * frequency;
  const i = Math.floor(scaledT);
  const f = scaledT - i;
  // Cosine interpolation
  const blend = (1 - Math.cos(f * Math.PI)) / 2;
  const a = pseudoNoise(seed, i);
  const b = pseudoNoise(seed, i + 1);
  return a * (1 - blend) + b * blend;
}
