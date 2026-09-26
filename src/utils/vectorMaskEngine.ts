/**
 * vectorMaskEngine.ts — Vector Bezier Masking Engine.
 *
 * Adapted from OpenReel Mask Engine.
 * Generates vector Bezier curves, polygon, ellipse, and rectangle Path2D clipping masks
 * with feathering, choke/expansion, and inversion support for video/image clips.
 */

import type { ClipVectorMaskSettings, BezierPoint, MaskPoint } from '@/types';

/**
 * Default preset points for rectangle, ellipse, and polygon shapes.
 */
export function createPresetVectorMask(shapeType: 'rectangle' | 'ellipse' | 'polygon' | 'bezier'): ClipVectorMaskSettings {
  let points: BezierPoint[] = [];

  switch (shapeType) {
    case 'rectangle':
      points = [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ];
      break;
    case 'ellipse':
      // 4-point bezier approximation of circle/ellipse (handle length ~ 0.5522847)
      points = [
        { x: 50, y: 10, handleIn: { x: 28, y: 10 }, handleOut: { x: 72, y: 10 } },
        { x: 90, y: 50, handleIn: { x: 90, y: 28 }, handleOut: { x: 90, y: 72 } },
        { x: 50, y: 90, handleIn: { x: 72, y: 90 }, handleOut: { x: 28, y: 90 } },
        { x: 10, y: 50, handleIn: { x: 10, y: 72 }, handleOut: { x: 10, y: 28 } },
      ];
      break;
    case 'polygon':
      // 5-point pentagon preset
      points = [
        { x: 50, y: 10 },
        { x: 90, y: 38 },
        { x: 75, y: 88 },
        { x: 25, y: 88 },
        { x: 10, y: 38 },
      ];
      break;
    case 'bezier':
    default:
      points = [
        { x: 20, y: 20, handleOut: { x: 50, y: 10 } },
        { x: 80, y: 20, handleIn: { x: 50, y: 30 } },
        { x: 80, y: 80, handleOut: { x: 60, y: 90 } },
        { x: 20, y: 80, handleIn: { x: 40, y: 70 } },
      ];
      break;
  }

  return {
    enabled: true,
    shapeType,
    points,
    closed: true,
    feather: 0,
    inverted: false,
    expansion: 0,
    opacity: 100,
  };
}

/**
 * Builds a 2D Path2D vector shape from BezierPoints scaled to clip dimensions.
 */
export function buildVectorMaskPath(
  mask: ClipVectorMaskSettings,
  canvasWidth: number,
  canvasHeight: number
): Path2D {
  const path = new Path2D();
  const { points, closed, expansion = 0 } = mask;

  if (!points || points.length === 0) {
    path.rect(0, 0, canvasWidth, canvasHeight);
    return path;
  }

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  // Convert percentage coordinates (0-100) to actual pixel coordinates with centered expansion
  const scaleX = (val: number) => {
    const px = (val / 100) * canvasWidth;
    const dx = px - cx;
    const dirX = dx !== 0 ? Math.sign(dx) : 0;
    return px + dirX * expansion;
  };

  const scaleY = (val: number) => {
    const py = (val / 100) * canvasHeight;
    const dy = py - cy;
    const dirY = dy !== 0 ? Math.sign(dy) : 0;
    return py + dirY * expansion;
  };

  const p0 = points[0];
  path.moveTo(scaleX(p0.x), scaleY(p0.y));

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const nextIdx = (i + 1) % points.length;
    if (nextIdx === 0 && !closed) break;

    const next = points[nextIdx];

    if (curr.handleOut || next.handleIn) {
      const cp1x = curr.handleOut ? scaleX(curr.handleOut.x) : scaleX(curr.x);
      const cp1y = curr.handleOut ? scaleY(curr.handleOut.y) : scaleY(curr.y);
      const cp2x = next.handleIn ? scaleX(next.handleIn.x) : scaleX(next.x);
      const cp2y = next.handleIn ? scaleY(next.handleIn.y) : scaleY(next.y);
      path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, scaleX(next.x), scaleY(next.y));
    } else {
      path.lineTo(scaleX(next.x), scaleY(next.y));
    }
  }

  if (closed) {
    path.closePath();
  }

  return path;
}

/**
 * Base resolution the feather slider (0-50px) is authored against. At export
 * resolutions the blur is scaled proportionally so the edge softness looks
 * identical to the 854px-wide preview.
 */
const FEATHER_REFERENCE_WIDTH = 854;

/** True when the mask needs raster compositing (clip() alone is insufficient). */
export function vectorMaskNeedsRaster(mask: ClipVectorMaskSettings | null | undefined): boolean {
  return !!mask?.enabled && ((mask.feather ?? 0) > 0 || (mask.opacity ?? 100) < 100);
}

/**
 * Applies vector bezier mask as a hard clip onto a 2D context (FRAME space:
 * points are 0-100 % of width×height).
 *
 * Fast path: exact, zero-allocation. Use only when `!vectorMaskNeedsRaster(mask)`
 * — a clip cannot express feathered edges or partial opacity. Those require
 * `applyVectorMaskRaster` (rasterize the mask, blur only the mask, then
 * destination-in). The previous implementation set `ctx.filter = blur()`
 * after clipping, which blurred everything drawn NEXT — i.e. the whole clip.
 */
export function applyVectorMaskToContext(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  mask: ClipVectorMaskSettings,
  width: number,
  height: number
): void {
  if (!mask || !mask.enabled) return;

  const maskPath = buildVectorMaskPath(mask, width, height);

  if (mask.inverted) {
    // Inverted Mask: Clip out the region defined by the mask path
    const outerPath = new Path2D();
    outerPath.rect(-100, -100, width + 200, height + 200);
    outerPath.addPath(maskPath);
    ctx.clip(outerPath, 'evenodd');
  } else {
    // Standard Mask: Clip inside the defined vector mask path
    ctx.clip(maskPath);
  }
}

/** Worker-safe canvas factory (OffscreenCanvas exists in both scopes). */
function createMaskCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/**
 * Rasterize a vector mask into a standalone alpha canvas.
 * White = keep, transparent = discard. Feather blurs the MASK canvas only —
 * never the content; inversion is a source-out pass, exactly mirroring the
 * geometric mask raster pipeline used by the preview.
 */
export function rasterizeVectorMask(
  mask: ClipVectorMaskSettings,
  width: number,
  height: number
): OffscreenCanvas | HTMLCanvasElement {
  const canvas = createMaskCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return canvas;

  const maskPath = buildVectorMaskPath(mask, width, height);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const featherPx = Math.max(0, mask.feather ?? 0) * (width / FEATHER_REFERENCE_WIDTH);
  if (featherPx > 0) {
    ctx.filter = `blur(${featherPx}px)`;
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(maskPath);
  ctx.restore();

  if (mask.inverted) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-out';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  return canvas;
}

/**
 * Composite a rasterized vector mask onto an existing content canvas whose
 * pixels are laid out in the SAME frame space (0..width × 0..height).
 * Applies feather (via the raster) and mask opacity (percent 0-100).
 */
export function applyVectorMaskRaster(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  mask: ClipVectorMaskSettings,
  width: number,
  height: number
): void {
  if (!mask || !mask.enabled) return;
  const raster = rasterizeVectorMask(mask, width, height);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = Math.max(0, Math.min(1, (mask.opacity ?? 100) / 100));
  ctx.drawImage(raster as CanvasImageSource, 0, 0, width, height);
  ctx.restore();
}
