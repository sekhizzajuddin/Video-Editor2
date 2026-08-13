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
 * Applies vector bezier mask clipping, feathering, and inversion onto a CanvasRenderingContext2D.
 */
export function applyVectorMaskToContext(
  ctx: CanvasRenderingContext2D,
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

  if (mask.feather > 0) {
    ctx.filter = `blur(${mask.feather}px)`;
  }
}
