/**
 * Rendering optimizations for smooth 60 FPS playback and scrubbing
 * 
 * Add these optimizations to CanvasRenderingEngine.ts
 */

// OPTIMIZATION 1: Add quality scaling during scrubbing
export function getRenderQualitySettings(isPlaying: boolean, isScrubbing: boolean, adaptiveQuality: 'high' | 'medium' | 'low') {
  if (isScrubbing) {
    // During scrubbing, use lowest quality for responsiveness
    return {
      scale: 0.25,
      skipParticles: true,
      skipTransitions: true,
      skipLUT: true,
      skipChromaKey: true,
    };
  }
  
  if (!isPlaying) {
    // When paused, use full quality
    return {
      scale: 1.0,
      skipParticles: false,
      skipTransitions: false,
      skipLUT: false,
      skipChromaKey: false,
    };
  }
  
  // During playback, adapt based on quality setting
  switch (adaptiveQuality) {
    case 'low':
      return {
        scale: 0.5,
        skipParticles: true,
        skipTransitions: false,
        skipLUT: true,
        skipChromaKey: false,
      };
    case 'medium':
      return {
        scale: 0.75,
        skipParticles: false,
        skipTransitions: false,
        skipLUT: false,
        skipChromaKey: false,
      };
    default: // high
      return {
        scale: 1.0,
        skipParticles: false,
        skipTransitions: false,
        skipLUT: false,
        skipChromaKey: false,
      };
  }
}

// OPTIMIZATION 2: Debounced scrubbing
let scrubTimeoutId: number | null = null;
const SCRUB_DELAY = 30; // ms

export function debouncedScrub(
  seek: (time: number) => void,
  time: number,
  immediate = false
) {
  if (scrubTimeoutId !== null) {
    window.clearTimeout(scrubTimeoutId);
  }
  
  if (immediate) {
    seek(time);
  } else {
    scrubTimeoutId = window.setTimeout(() => {
      seek(time);
      scrubTimeoutId = null;
    }, SCRUB_DELAY);
  }
}

// OPTIMIZATION 3: Frame cache preloading — REMOVED
// The old preloadAdjacentFrames set videoElement.currentTime in a loop,
// which thrashes the decoder (seeks) instead of preloading. It was never
// called anywhere. Use requestVideoFrameCallback-based predecode instead.

// OPTIMIZATION 4: Smooth interpolation during scrubbing
export function interpolateScrubPosition(
  currentTime: number,
  targetTime: number,
  deltaTime: number,
  interpolationFactor = 0.3
): number {
  const diff = targetTime - currentTime;
  
  // If very close, snap to target
  if (Math.abs(diff) < 0.01) {
    return targetTime;
  }
  
  // Smooth interpolation
  return currentTime + (diff * interpolationFactor * (deltaTime / 16.67));
}

// OPTIMIZATION 5: Canvas context optimization
export function optimizeCanvasContext(
  ctx: CanvasRenderingContext2D,
  isPlaying: boolean,
  isScrubbing: boolean
) {
  if (isScrubbing) {
    // Maximum performance during scrubbing
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'low';
  } else if (isPlaying) {
    // Good quality during playback
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
  } else {
    // Best quality when paused
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
}

// OPTIMIZATION 6: Batch state updates
export function batchRenderUpdates(updates: Array<() => void>) {
  // Use requestAnimationFrame to batch updates
  requestAnimationFrame(() => {
    updates.forEach(fn => fn());
  });
}

// OPTIMIZATION 7: Memory-efficient frame recycling
const canvasPool: HTMLCanvasElement[] = [];
const MAX_POOL_SIZE = 5;

export function getRecycledCanvas(width: number, height: number): HTMLCanvasElement {
  // Find suitable canvas from pool
  const idx = canvasPool.findIndex(c => 
    c.width === width && c.height === height
  );
  
  if (idx >= 0) {
    const canvas = canvasPool[idx];
    canvasPool.splice(idx, 1);
    return canvas;
  }
  
  // Create new if not found
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function recycleCanvas(canvas: HTMLCanvasElement) {
  if (canvasPool.length < MAX_POOL_SIZE) {
    // Clear canvas before recycling
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvasPool.push(canvas);
  }
}