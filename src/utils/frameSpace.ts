/**
 * frameSpace.ts
 *
 * ONE definition of "where is the picture" for motion-tracked region effects.
 *
 * The bug this exists to kill
 * ---------------------------
 * Region boxes were being expressed in three DIFFERENT coordinate spaces that
 * nobody had reconciled:
 *
 *   1. The panel/authoring space — a hard-coded 854 x 480, centred at (427, 240).
 *   2. The overlay draw space — the same numbers, but rendered inside
 *      `<g transform="translate(offsetX, offsetY)">`, which shifts them by the
 *      letterbox offset. On a 9:16 project offsetX is 292, so a box authored at
 *      x = 427 was painted at x = 719 — outside the 270-wide picture entirely.
 *      That is exactly the "box starts outside the canvas" report.
 *   3. The render space — `offCanvas.width / 854`, i.e. the region was treated as
 *      a fraction of a 854-wide frame and mapped onto the CLIP'S OWN media
 *      buffer. That buffer is neither 854 wide nor aligned to the frame, and it
 *      ignores the clip's translate/scale/rotate completely. So the pixels that
 *      actually got shaken were somewhere else again.
 *
 * The fix is to stop guessing and give everything one space:
 *
 *   FRAME SPACE = (0, 0) at the top-left of the VISIBLE picture,
 *                 `W` x `H` units across, where H is always 480 and W follows the
 *                 project aspect ratio.
 *
 * The overlay's letterbox offset is then applied exactly once (by the `<g>` that
 * already exists), the tracker analyses in the same units, and the renderer
 * composites the clip into a full-frame buffer so a region at frame (x, y)
 * lands on the pixels the user actually pointed at.
 */

export type FrameAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | string;

/** The overlay/composite viewBox. Everything letterboxes inside this. */
export const OVERLAY_W = 854;
export const OVERLAY_H = 480;

/**
 * Size of the VISIBLE picture for a given aspect ratio.
 *
 * Height is fixed at 480 and width follows, which is the convention the renderer,
 * the overlay and `trackMotion` all already use independently — this just makes
 * it a single shared source of truth instead of three copies that could drift.
 */
export function getFrameSize(aspectRatio: FrameAspectRatio): { W: number; H: number } {
  const H = OVERLAY_H;
  let W = OVERLAY_W;
  if (aspectRatio === '9:16') W = Math.round(H * (9 / 16));
  else if (aspectRatio === '1:1') W = H;
  else if (aspectRatio === '4:3') W = Math.round(H * (4 / 3));
  return { W, H };
}

/**
 * Letterbox offset of the visible picture inside the 854x480 overlay box.
 *
 * Callers that draw INSIDE the overlay's `translate(offsetX, offsetY)` group must
 * NOT add this themselves — that double-application is the original bug.
 * It is exported for pointer maths, which starts from raw overlay coordinates and
 * has to subtract it exactly once.
 */
export function getFrameOffset(aspectRatio: FrameAspectRatio): { offsetX: number; offsetY: number } {
  const { W, H } = getFrameSize(aspectRatio);
  return { offsetX: (OVERLAY_W - W) / 2, offsetY: (OVERLAY_H - H) / 2 };
}

export interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where a clip's media lands inside the frame, in frame space.
 *
 * Mirrors what `CanvasRenderingEngine.drawSingleClip` does: fit the media inside
 * the frame preserving aspect, then apply the clip's translate + scale about the
 * frame centre.
 *
 * The trackers need this because they analyse a video element directly. Before,
 * they blitted the raw video across the whole analysis canvas, which silently
 * assumed the clip exactly filled the frame with no transform. Any zoom, pan or
 * letterbox made every tracked coordinate wrong — the region would follow
 * something, just not the thing under the box.
 *
 * Rotation is deliberately NOT included: the analysis canvas is axis-aligned, and
 * a rotated clip would need a full inverse warp. Rotation is rare on a clip you
 * are region-tracking, and ignoring it degrades gracefully (the box tracks the
 * un-rotated placement) rather than throwing.
 */
export function getClipFramePlacement(
  mediaW: number,
  mediaH: number,
  W: number,
  H: number,
  transform?: { x?: number; y?: number; scale?: number } | null
): RectLike {
  const mw = mediaW > 0 ? mediaW : 1920;
  const mh = mediaH > 0 ? mediaH : 1080;
  const fit = Math.min(W / mw, H / mh);
  const scale = ((transform?.scale ?? 100) || 100) / 100;
  const dw = mw * fit * scale;
  const dh = mh * fit * scale;
  const cx = W / 2 + (transform?.x ?? 0);
  const cy = H / 2 + (transform?.y ?? 0);
  return { x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh };
}

export interface CornerQuad {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
}

/** Axis-aligned centre/size of a quad. */
export function quadToRect(c: CornerQuad): { cx: number; cy: number; w: number; h: number } {
  const xs = [c.x0, c.x1, c.x2, c.x3];
  const ys = [c.y0, c.y1, c.y2, c.y3];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** Build an axis-aligned quad from a centre and size. */
export function rectToQuad(cx: number, cy: number, w: number, h: number): CornerQuad {
  const hw = Math.max(8, w) / 2;
  const hh = Math.max(8, h) / 2;
  return {
    x0: cx - hw, y0: cy - hh,
    x1: cx + hw, y1: cy - hh,
    x2: cx + hw, y2: cy + hh,
    x3: cx - hw, y3: cy + hh,
  };
}

/** A sensible starting box: centred in the frame, ~30% of its short side. */
export function defaultRegionQuad(W: number, H: number): CornerQuad {
  const size = Math.max(48, Math.round(Math.min(W, H) * 0.3));
  return rectToQuad(W / 2, H / 2, size, size);
}

/**
 * Bring a region back inside the frame.
 *
 * Two things make a stored region stale:
 *   - Projects saved before this fix hold boxes centred on (427, 240), which is
 *     off the right-hand edge of any portrait or square frame.
 *   - Switching the project aspect ratio changes the frame size underneath a
 *     region that was authored for the old one.
 *
 * Rather than silently shaking empty space (or nothing at all, once clamped to a
 * zero-width strip), re-centre anything that no longer overlaps the picture and
 * clamp the rest. The user still has to reposition it, but they can SEE it, which
 * is the difference between "needs a nudge" and "the feature is broken".
 */
export function normalizeRegionToFrame(
  corners: CornerQuad | null | undefined,
  W: number,
  H: number
): CornerQuad {
  if (!corners) return defaultRegionQuad(W, H);

  const r = quadToRect(corners);
  if (!Number.isFinite(r.cx) || !Number.isFinite(r.cy) || r.w <= 0 || r.h <= 0) {
    return defaultRegionQuad(W, H);
  }

  // Never let the box be bigger than the picture it lives in.
  const w = Math.min(r.w, W);
  const h = Math.min(r.h, H);

  // Fully outside the frame ⇒ the coordinates are from a different space; a clamp
  // would flatten it against an edge, which reads as a bug. Re-centre instead.
  const left = r.cx - w / 2;
  const right = r.cx + w / 2;
  const top = r.cy - h / 2;
  const bottom = r.cy + h / 2;
  const overlaps = right > 0 && left < W && bottom > 0 && top < H;
  if (!overlaps) {
    return rectToQuad(W / 2, H / 2, w, h);
  }

  const cx = Math.max(w / 2, Math.min(W - w / 2, r.cx));
  const cy = Math.max(h / 2, Math.min(H - h / 2, r.cy));
  return rectToQuad(cx, cy, w, h);
}
