/**
 * colorRegionGenerator.ts
 *
 * Intelligent color region generation with spatial-temporal constraints.
 *
 * Problem this solves
 * -------------------
 * The original colour matcher (`motionMask.ts`) learns a chroma signature from
 * the painted stroke and re-finds it on every frame. But chroma alone cannot
 * distinguish parts of one garment or separate a subject from a same-coloured
 * background — a red hand and a red shirt are identical in chroma space.
 *
 * This module adds THREE additional constraints:
 *
 *   1. Spatial footprint: the selection may not grow beyond N× the radius of
 *      the painted stroke. A sleeve and a skirt are the same cloth, so the only
 *      thing that distinguishes them is how far they extend from where the user
 *      pointed.
 *
 *   2. Temporal coherence: the feature cannot teleport. We track its centroid
 *      and area frame-to-frame, and penalise candidates that jump implausibly
 *      far or change size too fast.
 *
 *   3. Context-aware fill: when the motion effect displaces the selected patch,
 *      it leaves a hole. Rather than a blurred smear, we synthesise background
 *      texture from the surroundings, guided by edges so we do not bleed across
 *      object boundaries.
 *
 * Architecture
 * ------------
 *   ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
 *   │ Painted Stroke   │────▶│ ColorSignature +    │────▶│ Constrained Mask │
 *   │ (user input)     │     │ Spatial Footprint   │     │ (per frame)      │
 *   └──────────────────┘     └─────────────────────┘     └──────────────────┘
 *                                                           │
 *                                                           ▼
 *   ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
 *   │ Background Fill  │◀────│ Motion Displacement │◀────│ Effect Applied   │
 *   │ (inpainting)     │     │ (shake, jiggle…)    │     │ Inside Mask      │
 *   └──────────────────┘     └─────────────────────┘     └──────────────────┘
 *
 * Everything here is deterministic and framework-free so exports match preview.
 */

import type { CornerPoints } from '@/types';
import {
  type ColorSignature,
  type MaskFrameResult,
  rgbToYCbCr,
  computeMaskForFrame,
  featherMask,
  maskBounds,
} from './motionMask';
import { cornersToRect, normalizeRegionToFrame } from './frameSpace';

// Re-export localContrast from motionMask for use in this module
// It's defined as a private function in motionMask, so we need to import it differently
// For now, we'll define our own copy here since it's a simple utility
function localContrast(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  gap: number = 2
): number {
  const lumaAt = (px: number, py: number): number => {
    const cx = px < 0 ? 0 : px >= width ? width - 1 : px;
    const cy = py < 0 ? 0 : py >= height ? height - 1 : py;
    const p = (cy * width + cx) * 4;
    return 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
  };
  const c = lumaAt(x, y);
  return (
    (Math.abs(lumaAt(x - gap, y) - c) +
      Math.abs(lumaAt(x + gap, y) - c) +
      Math.abs(lumaAt(x, y - gap) - c) +
      Math.abs(lumaAt(x, y + gap) - c)) /
    4
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Extended color signature with spatial and temporal metadata.
 */
export interface EnhancedColorSignature extends ColorSignature {
  /** Centroid of the painted stroke, in analysis coordinates. */
  paintedCentroid: { x: number; y: number };
  /** Bounding box of the painted stroke. */
  paintedBounds: { x: number; y: number; w: number; h: number };
  /** Frame dimensions at time of painting (for scale normalization). */
  frameWidth: number;
  frameHeight: number;
  /** Timestamp when signature was created (for temporal decay). */
  createdAt: number;
}

/**
 * Tracking state for temporal coherence.
 */
export interface TrackingState {
  /** Last known centroid position. */
  lastCentroid: { x: number; y: number } | null;
  /** Last known area (pixel count). */
  lastArea: number;
  /** Velocity estimate (pixels per second). */
  velocity: { x: number; y: number };
  /** Area change rate (pixels per second). */
  areaVelocity: number;
  /** Frame timestamp. */
  lastTime: number;
  /** Consecutive frames with low confidence. */
  lowConfidenceStreak: number;
}

/**
 * Generated background fill result.
 */
export interface BackgroundFillResult {
  /** Fill canvas to paint over the vacated area. */
  fillCanvas: HTMLCanvasElement | null;
  /** Confidence score 0-1 of the fill quality. */
  confidence: number;
  /** Whether edge-aware inpainting was used. */
  usedEdgeAware: boolean;
}

/**
 * Settings for region generation.
 */
export interface RegionGenerationSettings {
  /** How far the selection may spread beyond painted stroke (multiple of radius). */
  spreadLimit: number;
  /** Maximum velocity allowed (pixels per second). */
  maxVelocity: number;
  /** Maximum area change per second (as fraction of current area). */
  maxAreaChange: number;
  /** Minimum confidence to accept a match. */
  minConfidence: number;
  /** Whether to use edge-aware fill. */
  useEdgeAwareFill: boolean;
  /** Fill blur radius for smoothing. */
  fillBlurRadius: number;
  /** Edge detection threshold for boundary-aware fill. */
  edgeThreshold: number;
}

export const DEFAULT_REGION_SETTINGS: RegionGenerationSettings = {
  spreadLimit: 2.2,
  maxVelocity: 800, // pixels per second at analysis resolution
  maxAreaChange: 2.0, // 200% per second
  minConfidence: 0.15,
  useEdgeAwareFill: true,
  fillBlurRadius: 4,
  edgeThreshold: 30,
};

// ---------------------------------------------------------------------------
// Enhanced signature building
// ---------------------------------------------------------------------------

/**
 * Build an enhanced color signature with spatial footprint tracking.
 *
 * This extends the base `buildColorSignature` by recording WHERE the user
 * painted, not just WHAT colour they painted. The spatial data is critical
 * for constraining the selection to the intended object part.
 */
export function buildEnhancedSignature(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  strokeMask: Uint8Array,
  tolerance: number = 22,
  maxClusters: number = 3
): EnhancedColorSignature | null {
  const baseSig = computeBaseSignature(pixels, width, height, strokeMask, tolerance, maxClusters);
  if (!baseSig) return null;

  // Compute spatial footprint
  let sumX = 0;
  let sumY = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let i = 0; i < strokeMask.length; i++) {
    if (strokeMask[i]) {
      const x = i % width;
      const y = Math.floor(i / width);
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      count++;
    }
  }

  if (count === 0) return null;

  return {
    ...baseSig,
    paintedCentroid: { x: sumX / count, y: sumY / count },
    paintedBounds: {
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX + 1),
      h: Math.max(1, maxY - minY + 1),
    },
    frameWidth: width,
    frameHeight: height,
    createdAt: Date.now(),
  };
}

/**
 * Internal helper to compute base signature (delegates to motionMask logic).
 */
function computeBaseSignature(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  strokeMask: Uint8Array,
  tolerance: number,
  maxClusters: number
): Omit<ColorSignature, 'patchRadius' | 'patchArea'> & { patchRadius: number; patchArea: number } | null {
  // Delegate to motionMask's buildColorSignature - imported at module level above
  return buildColorSignature(pixels, width, height, strokeMask, tolerance, maxClusters);
}

// ---------------------------------------------------------------------------
// Temporal coherence tracking
// ---------------------------------------------------------------------------

/**
 * Initialize tracking state from first frame.
 */
export function initTrackingState(centroid: { x: number; y: number }, area: number, time: number): TrackingState {
  return {
    lastCentroid: centroid,
    lastArea: area,
    velocity: { x: 0, y: 0 },
    areaVelocity: 0,
    lastTime: time,
    lowConfidenceStreak: 0,
  };
}

/**
 * Update tracking state with new observation.
 *
 * Returns updated state and a coherence score (0-1) indicating how plausible
 * this observation is given recent history.
 */
export function updateTrackingState(
  state: TrackingState,
  centroid: { x: number; y: number },
  area: number,
  time: number,
  settings: RegionGenerationSettings
): { newState: TrackingState; coherence: number } {
  const dt = Math.max(0.001, time - state.lastTime);

  // Compute velocity
  const dx = centroid.x - (state.lastCentroid?.x ?? centroid.x);
  const dy = centroid.y - (state.lastCentroid?.y ?? centroid.y);
  const velocityX = dx / dt;
  const velocityY = dy / dt;
  const speed = Math.hypot(velocityX, velocityY);

  // Compute area change rate
  const areaDelta = area - state.lastArea;
  const areaChangeRate = Math.abs(areaDelta) / (state.lastArea || 1) / dt;

  // Score coherence based on physical plausibility
  let coherence = 1.0;

  // Penalize excessive velocity
  if (speed > settings.maxVelocity) {
    coherence *= Math.max(0.1, 1 - (speed - settings.maxVelocity) / settings.maxVelocity);
  }

  // Penalize excessive area change
  if (areaChangeRate > settings.maxAreaChange) {
    coherence *= Math.max(0.1, 1 - (areaChangeRate - settings.maxAreaChange) / settings.maxAreaChange);
  }

  // Penalize large jumps from last known position
  const maxJump = settings.maxVelocity * dt * 1.5; // 150% tolerance
  const jumpDist = Math.hypot(dx, dy);
  if (jumpDist > maxJump) {
    coherence *= Math.max(0.05, 1 - (jumpDist - maxJump) / maxJump);
  }

  const newState: TrackingState = {
    lastCentroid: centroid,
    lastArea: area,
    velocity: {
      x: state.velocity.x * 0.7 + velocityX * 0.3, // EMA smoothing
      y: state.velocity.y * 0.7 + velocityY * 0.3,
    },
    areaVelocity: state.areaVelocity * 0.7 + areaDelta / dt * 0.3,
    lastTime: time,
    lowConfidenceStreak: coherence < 0.3 ? state.lowConfidenceStreak + 1 : 0,
  };

  return { newState, coherence };
}

/**
 * Compute a constrained mask for a frame, applying spatial and temporal filters.
 */
export function computeConstrainedMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  signature: EnhancedColorSignature,
  trackingState: TrackingState,
  relTime: number,
  settings: RegionGenerationSettings
): { mask: MaskFrameResult; newState: TrackingState; confidence: number } {
  // Define search window around last known position
  const searchRadius = trackingState.lastCentroid
    ? Math.min(width, height, settings.maxVelocity * (relTime - trackingState.lastTime) * 1.5)
    : Math.max(width, height);

  // Compute raw mask with spatial constraints
  const rawMask = computeMaskForFrame(pixels, width, height, signature, trackingState.lastCentroid, {
    minScore: settings.minConfidence,
    searchRadius,
    spreadLimit: signature.patchRadius > 0 ? settings.spreadLimit : undefined,
    useTexture: true,
    scale_hint: signature.patchArea > 0 ? undefined : 1,
  });

  // Apply temporal coherence check
  let confidence = 1.0;
  let newState = trackingState;

  if (rawMask.centroid && rawMask.area > 0) {
    const { newState: updatedState, coherence } = updateTrackingState(
      trackingState,
      rawMask.centroid,
      rawMask.area,
      relTime,
      settings
    );
    newState = updatedState;
    confidence = coherence;

    // If confidence is very low, fall back to prediction
    if (coherence < 0.2 && trackingState.lastCentroid) {
      // Predict position based on velocity
      const dt = relTime - trackingState.lastTime;
      const predictedX = trackingState.lastCentroid.x + trackingState.velocity.x * dt;
      const predictedY = trackingState.lastCentroid.y + trackingState.velocity.y * dt;

      // Re-compute mask centered on prediction with tighter constraints
      const predictedMask = computeMaskForFrame(pixels, width, height, signature, { x: predictedX, y: predictedY }, {
        minScore: settings.minConfidence * 0.8,
        searchRadius: searchRadius * 0.5,
        spreadLimit: signature.patchRadius > 0 ? settings.spreadLimit * 0.8 : undefined,
        useTexture: true,
      });

      if (predictedMask.centroid) {
        return { mask: predictedMask, newState: updatedState, confidence: coherence * 0.7 };
      }
    }
  } else {
    // No match found
    newState.lowConfidenceStreak++;
    confidence = Math.max(0, 1 - newState.lowConfidenceStreak * 0.2);
  }

  return { mask: rawMask, newState, confidence };
}

// ---------------------------------------------------------------------------
// Edge-aware background fill
// ---------------------------------------------------------------------------

/**
 * Generate context-aware background fill for vacated regions.
 *
 * When a motion effect displaces a selected patch, it leaves a hole. Simple
 * blurring creates smearing artifacts. This function uses edge-aware sampling
 * to synthesize plausible background texture.
 */
export function generateBackgroundFill(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  region: { x: number; y: number; w: number; h: number },
  settings: RegionGenerationSettings
): BackgroundFillResult {
  const { x, y, w, h } = region;

  if (w < 2 || h < 2 || x < 0 || y < 0 || x + w > canvasW || y + h > canvasH) {
    return { fillCanvas: null, confidence: 0, usedEdgeAware: false };
  }

  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = w;
  fillCanvas.height = h;
  const fillCtx = fillCanvas.getContext('2d');
  if (!fillCtx) {
    return { fillCanvas: null, confidence: 0, usedEdgeAware: false };
  }

  if (!settings.useEdgeAwareFill) {
    // Simple blurred fill (fallback)
    const zoom = 1.35;
    const zw = w / zoom;
    const zh = h / zoom;
    const zx = x + (w - zw) / 2;
    const zy = y + (h - zh) / 2;

    fillCtx.filter = `blur(${settings.fillBlurRadius}px)`;
    try {
      fillCtx.drawImage(ctx.canvas, zx, zy, zw, zh, 0, 0, w, h);
      fillCtx.filter = 'none';
      return { fillCanvas, confidence: 0.6, usedEdgeAware: false };
    } catch {
      return { fillCanvas: null, confidence: 0, usedEdgeAware: false };
    }
  }

  // Edge-aware fill
  const edgeMap = detectEdges(ctx, canvasW, canvasH, settings.edgeThreshold);
  const hasStrongEdges = analyzeEdgeIntersection(edgeMap, x, y, w, h, canvasW);

  if (!hasStrongEdges) {
    // No strong edges crossing the region boundary — simple blur is fine
    const zoom = 1.35;
    const zw = w / zoom;
    const zh = h / zoom;
    const zx = x + (w - zw) / 2;
    const zy = y + (h - zh) / 2;

    fillCtx.filter = `blur(${settings.fillBlurRadius}px)`;
    try {
      fillCtx.drawImage(ctx.canvas, zx, zy, zw, zh, 0, 0, w, h);
      fillCtx.filter = 'none';
      return { fillCanvas, confidence: 0.7, usedEdgeAware: true };
    } catch {
      return { fillCanvas: null, confidence: 0, usedEdgeAware: false };
    }
  }

  // Strong edges present — use directional sampling
  const success = directionalSampleFill(ctx, fillCtx, x, y, w, h, canvasW, canvasH, edgeMap, settings);

  return {
    fillCanvas: success ? fillCanvas : null,
    confidence: success ? 0.85 : 0.5,
    usedEdgeAware: true,
  };
}

/**
 * Detect edges in the frame using Sobel operator on luma.
 */
function detectEdges(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const edgeMap = new Uint8Array(width * height);

  try {
    // Sample at lower resolution for performance
    const sampleW = Math.max(1, Math.floor(width / 4));
    const sampleH = Math.max(1, Math.floor(height / 4));
    const sampleData = ctx.getImageData(0, 0, width, height);
    const pixels = sampleData.data;

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const px = x + kx;
            const py = y + ky;
            const idx = (py * width + px) * 4;
            const luma = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            const ki = (ky + 1) * 3 + (kx + 1);
            gx += luma * sobelX[ki];
            gy += luma * sobelY[ki];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const scaledX = Math.floor(x * 4);
        const scaledY = Math.floor(y * 4);

        for (let dy = 0; dy < 4 && scaledY + dy < height; dy++) {
          for (let dx = 0; dx < 4 && scaledX + dx < width; dx++) {
            edgeMap[(scaledY + dy) * width + (scaledX + dx)] = magnitude > threshold ? 1 : 0;
          }
        }
      }
    }
  } catch {
    // Tainted canvas or other error — return empty edge map
  }

  return edgeMap;
}

/**
 * Check if strong edges intersect the region boundary.
 */
function analyzeEdgeIntersection(
  edgeMap: Uint8Array,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  width: number
): boolean {
  let edgeCount = 0;
  let sampleCount = 0;

  // Sample along the boundary
  const step = Math.max(1, Math.floor(Math.min(rw, rh) / 8));

  // Top and bottom edges
  for (let x = rx; x < rx + rw; x += step) {
    if (edgeMap[ry * width + x]) edgeCount++;
    if (edgeMap[(ry + rh - 1) * width + x]) edgeCount++;
    sampleCount += 2;
  }

  // Left and right edges
  for (let y = ry; y < ry + rh; y += step) {
    if (edgeMap[y * width + rx]) edgeCount++;
    if (edgeMap[y * width + (rx + rw - 1)]) edgeCount++;
    sampleCount += 2;
  }

  return sampleCount > 0 && edgeCount / sampleCount > 0.15;
}

/**
 * Fill using directional sampling from outside the region.
 */
function directionalSampleFill(
  ctx: CanvasRenderingContext2D,
  fillCtx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  canvasW: number,
  canvasH: number,
  edgeMap: Uint8Array,
  settings: RegionGenerationSettings
): boolean {
  try {
    // Get source image data
    const srcData = ctx.getImageData(rx, ry, rw, rh);
    const outData = fillCtx.createImageData(rw, rh);
    const src = srcData.data;
    const dst = outData.data;

    // For each pixel, sample from the direction perpendicular to nearest edge
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const i = (y * rw + x) * 4;

        // Find distance to nearest edge
        let minDist = Infinity;
        let edgeAngle = 0;

        for (let ey = Math.max(0, y - 8); ey <= Math.min(rh - 1, y + 8); ey++) {
          for (let ex = Math.max(0, x - 8); ex <= Math.min(rw - 1, x + 8); ex++) {
            if (edgeMap[(ry + ey) * canvasW + (rx + ex)]) {
              const dist = Math.hypot(ex - x, ey - y);
              if (dist < minDist) {
                minDist = dist;
                edgeAngle = Math.atan2(ey - y, ex - x);
              }
            }
          }
        }

        if (minDist === Infinity) {
          // No nearby edge — copy directly
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
          dst[i + 3] = src[i + 3];
        } else {
          // Sample from opposite direction of edge
          const sampleDist = Math.min(20, minDist * 1.5);
          const sampleX = x - Math.cos(edgeAngle) * sampleDist;
          const sampleY = y - Math.sin(edgeAngle) * sampleDist;

          const sx = Math.max(0, Math.min(rw - 1, Math.round(sampleX)));
          const sy = Math.max(0, Math.min(rh - 1, Math.round(sampleY)));
          const si = (sy * rw + sx) * 4;

          dst[i] = src[si];
          dst[i + 1] = src[si + 1];
          dst[i + 2] = src[si + 2];
          dst[i + 3] = src[si + 3];
        }
      }
    }

    // Apply light blur to smooth transitions
    fillCtx.putImageData(outData, 0, 0);
    fillCtx.filter = `blur(${settings.fillBlurRadius * 0.5}px)`;
    const blurred = fillCtx.getImageData(0, 0, rw, rh);
    fillCtx.putImageData(blurred, 0, 0);
    fillCtx.filter = 'none';

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scratch canvas pool for fill operations
// ---------------------------------------------------------------------------

const fillCanvasPool = new Map<string, HTMLCanvasElement>();

export function getCachedFillCanvas(key: string, w: number, h: number): HTMLCanvasElement {
  let canvas = fillCanvasPool.get(key);
  if (!canvas || canvas.width !== w || canvas.height !== h) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    fillCanvasPool.set(key, canvas);

    // Limit pool size
    if (fillCanvasPool.size > 8) {
      const firstKey = fillCanvasPool.keys().next().value;
      if (firstKey && firstKey !== key) {
        fillCanvasPool.delete(firstKey);
      }
    }
  }
  return canvas;
}

export function clearFillCanvasCache(): void {
  fillCanvasPool.clear();
}
