/**
 * geometricMask.ts — Export-side geometric mask rasterizer.
 *
 * Mirrors the preview's `applyClipMaskOffscreen` (CanvasRenderingEngine.ts)
 * EXACTLY — same percentage→pixel mapping, same feather formula, same shape
 * geometry, same invert pass — so exported frames match what the user saw.
 *
 * The previous export path clipped a plain rect/ellipse on the compositor and
 * silently dropped everything else: no inverted masks, no feather, no
 * roundness, no rect rotation, no heart/star/split/filmstrip shapes, no matte
 * support, and even different default size (100 vs the preview's 50).
 *
 * Mask coordinates are percentages of the CLIP's destination rect, so the
 * caller passes the clip's drawn size (w, h). Values must already be
 * keyframe-interpolated (FrameScheduler does this for export).
 */

import type { ClipMaskSettings } from '@/types';

let warnedMatte = false;

function createCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHeart(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + h * 0.15);
  ctx.bezierCurveTo(cx, cy - h * 0.35, cx - w * 0.5, cy - h * 0.35, cx - w * 0.5, cy + h * 0.15);
  ctx.bezierCurveTo(cx - w * 0.5, cy + h * 0.4, cx, cy + h * 0.45, cx, cy + h * 0.45);
  ctx.bezierCurveTo(cx, cy + h * 0.45, cx + w * 0.5, cy + h * 0.4, cx + w * 0.5, cy + h * 0.15);
  ctx.bezierCurveTo(cx + w * 0.5, cy - h * 0.35, cx, cy - h * 0.35, cx, cy + h * 0.15);
  ctx.closePath();
}

function drawStar(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number
): void {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * Rasterize `mask` into a w×h alpha canvas (white = keep, transparent = cut).
 * Returns null when the mask cannot be represented (currently only 'matte',
 * which needs a second clip rendered — unsupported in the export worker).
 */
export function rasterizeGeometricMask(
  mask: ClipMaskSettings,
  ow: number,
  oh: number
): OffscreenCanvas | HTMLCanvasElement | null {
  if (!mask || !mask.enabled) return null;

  if (mask.type === 'matte') {
    if (!warnedMatte) {
      warnedMatte = true;
      console.warn(
        '[geometricMask] Track-matte masks are not supported by the export worker ' +
        '(the matte source clip cannot be rendered there). The clip is exported unmasked.'
      );
    }
    return null;
  }

  // Defaults MUST match the preview (x/y default 50, width/height default 50).
  const mX = mask.x ?? 50;
  const mY = mask.y ?? 50;
  const mW = mask.width ?? 50;
  const mH = mask.height ?? 50;
  const mRot = mask.rotation ?? 0;
  const mFeather = mask.feather ?? 0;
  const mRoundness = mask.roundness ?? 0;

  const mx = (mX / 100) * ow;
  const my = (mY / 100) * oh;
  const mw = (mW / 100) * ow;
  const mh = (mH / 100) * oh;
  const feather = (mFeather / 100) * Math.min(ow, oh);

  const canvas = createCanvas(Math.max(1, Math.round(ow)), Math.max(1, Math.round(oh)));
  const maskCtx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!maskCtx) return canvas;

  maskCtx.clearRect(0, 0, ow, oh);
  maskCtx.save();
  maskCtx.translate(mx, my);
  maskCtx.rotate((mRot * Math.PI) / 180);

  if (feather > 0) {
    maskCtx.filter = `blur(${feather}px)`;
  }

  maskCtx.fillStyle = '#FFFFFF';

  switch (mask.type) {
    case 'rectangle': {
      const rx = -mw / 2;
      const ry = -mh / 2;
      const cornerRadius = (mRoundness / 100) * Math.min(mw, mh) / 2;
      if (cornerRadius > 0) {
        drawRoundedRect(maskCtx, rx, ry, mw, mh, cornerRadius);
        maskCtx.fill();
      } else {
        maskCtx.fillRect(rx, ry, mw, mh);
      }
      break;
    }
    case 'circle': {
      const mr = mw / 2;
      maskCtx.beginPath();
      maskCtx.arc(0, 0, mr, 0, Math.PI * 2);
      maskCtx.fill();
      break;
    }
    case 'split':
      maskCtx.fillRect(-ow * 10, 0, ow * 20, oh * 10);
      break;
    case 'filmstrip':
      maskCtx.fillRect(-ow * 10, -mh / 2, ow * 20, mh);
      break;
    case 'heart':
      drawHeart(maskCtx, 0, 0, mw, mh);
      maskCtx.fill();
      break;
    case 'star':
      drawStar(maskCtx, 0, 0, 5, mw / 2, mw / 4);
      maskCtx.fill();
      break;
    case 'path':
    default:
      // Freeform 'path' masks are edited via the vector bezier system
      // (clip.vectorMask); a plain clip.mask of type 'path' has no usable
      // geometry here — treat as full-frame (no cut), same as an empty
      // vector point list.
      maskCtx.fillRect(-ow * 10, -oh * 10, ow * 20, oh * 20);
      break;
  }

  maskCtx.restore();

  if (mask.invert || (mask as any).inverted) {
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'source-out';
    maskCtx.fillStyle = '#FFFFFF';
    maskCtx.fillRect(0, 0, ow, oh);
    maskCtx.restore();
  }

  return canvas;
}

/**
 * Apply a geometric mask to an already-rendered clip content canvas via
 * destination-in. `ctx` must be in identity space — pass the clip's own
 * offscreen buffer context, not the transformed compositor context.
 */
export function applyGeometricMaskToCanvas(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  mask: ClipMaskSettings,
  width: number,
  height: number
): void {
  if (!mask?.enabled) return;
  const raster = rasterizeGeometricMask(mask, width, height);
  if (!raster) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(raster as CanvasImageSource, 0, 0, width, height);
  ctx.restore();
}
