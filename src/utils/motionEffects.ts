/**
 * motionEffects.ts
 *
 * Motion-tracked REGION effects.
 *
 * The problem this solves
 * -----------------------
 * Existing FX (`applyFxEffect`) operate on the WHOLE frame. There was no way to
 * say "shake only this old man's hand" — you could shake the entire shot, but not
 * one moving body part.
 *
 * How it works
 * ------------
 *  1. The user drags a box over the feature (hand, face, ...) on one frame.
 *  2. `trackMotion` (the existing SSD template tracker) follows that box across
 *     the clip and returns a trajectory of corner positions per timestamp.
 *  3. At render time this module looks up where the region is on the current
 *     frame, lifts those pixels into a scratch canvas, applies a motion effect
 *     (shake, jiggle, pulse, wobble, ...), and composites the result back —
 *     feathered at the edges so it blends with the untouched surroundings.
 *
 * Because step 3 is keyed off the tracked trajectory rather than a fixed
 * rectangle, the effect follows the subject as it moves through the shot.
 *
 * Design notes
 * ------------
 *  - Everything here is PURE and deterministic: the displacement for a given
 *    (time, seed) is always identical. That matters because the exporter renders
 *    arbitrary frames with no playback history — `Math.random()` would make the
 *    preview and the export disagree, and would jitter differently on every
 *    replay.
 *  - The heavy pixel work is confined to the region's bounding box, not the whole
 *    frame, so cost scales with the size of the selection.
 */

import type { CornerPoints } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MotionEffectType =
  /** Rapid random-ish translation. The classic "nervous hand" / impact shake. */
  | 'shake'
  /** Smooth looping figure-of-eight. Reads as a light bounce or juggle. */
  | 'jiggle'
  /** Rhythmic scale in/out about the region centre. */
  | 'pulse'
  /** Slow rotational sway, like something hanging or breathing. */
  | 'wobble'
  /** Vertical bob — a spring settling. */
  | 'bounce'
  /** Horizontal-only vibration, useful for a trembling limb. */
  | 'vibrate'
  /** Rotation + scale together; an exaggerated cartoon "boing". */
  | 'swing'
  /** Chromatic-aberration style RGB offset confined to the region. */
  | 'glitchShift';

export interface MotionEffectSettings {
  enabled: boolean;
  type: MotionEffectType;
  /** 0-100. Scales displacement / rotation / scale amplitude. */
  intensity: number;
  /** Oscillations per second. */
  speed: number;
  /** Edge feather in pixels — blends the patch into its surroundings. */
  feather: number;
  /**
   * Region scale multiplier (100 = exactly the tracked box). Enlarging captures
   * a little context so a shaking patch does not expose a hard seam.
   */
  regionScale: number;
  /** Deterministic variation between multiple effects on one clip. */
  seed: number;
  /** Tracked trajectory: where the region sits at each sampled time. */
  track?: { time: number; corners: CornerPoints }[];
  /** The box the user originally drew, used before/without tracking. */
  baseCorners?: CornerPoints;
}

export const DEFAULT_MOTION_EFFECT: MotionEffectSettings = {
  enabled: false,
  type: 'shake',
  intensity: 50,
  speed: 8,
  feather: 12,
  regionScale: 110,
  seed: 1,
};

/** UI metadata: which controls actually do something for each effect. */
export const MOTION_EFFECT_INFO: Array<{
  type: MotionEffectType;
  label: string;
  description: string;
  supports: Array<'intensity' | 'speed'>;
}> = [
  { type: 'shake', label: 'Shake', description: 'Rapid nervous jitter — trembling hand, impact hit', supports: ['intensity', 'speed'] },
  { type: 'jiggle', label: 'Jiggle', description: 'Smooth looping wiggle, like a juggle', supports: ['intensity', 'speed'] },
  { type: 'pulse', label: 'Pulse', description: 'Rhythmic grow / shrink', supports: ['intensity', 'speed'] },
  { type: 'wobble', label: 'Wobble', description: 'Slow rotational sway', supports: ['intensity', 'speed'] },
  { type: 'bounce', label: 'Bounce', description: 'Springy vertical bob', supports: ['intensity', 'speed'] },
  { type: 'vibrate', label: 'Vibrate', description: 'Fast horizontal-only tremble', supports: ['intensity', 'speed'] },
  { type: 'swing', label: 'Swing', description: 'Rotate and scale together — cartoon boing', supports: ['intensity', 'speed'] },
  { type: 'glitchShift', label: 'Glitch Shift', description: 'RGB split confined to the region', supports: ['intensity', 'speed'] },
];

/** The displacement to apply to a region on one frame. */
export interface MotionDisplacement {
  dx: number;
  dy: number;
  rotation: number;
  scale: number;
  /** RGB split distance in px; only `glitchShift` sets this. */
  rgbSplit: number;
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-noise
// ---------------------------------------------------------------------------

/**
 * Smooth, repeatable noise in [-1, 1].
 *
 * Deliberately NOT Math.random(): the exporter renders frame N directly, with no
 * preceding frames, so the value for a given time must be reproducible or the
 * export would jitter differently from the preview. Summing incommensurable sine
 * waves gives motion that reads as random without actually being so.
 */
function noise(t: number, seed: number): number {
  const a = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  const b = Math.sin(t * 39.3468 + seed * 11.135) * 24634.6345;
  return ((a - Math.floor(a)) + (b - Math.floor(b)) - 1);
}

/** Band-limited noise — smoother than `noise`, for organic (non-jittery) motion. */
function smoothNoise(t: number, seed: number): number {
  return (
    Math.sin(t * 1.0 + seed * 1.7) * 0.5 +
    Math.sin(t * 2.3 + seed * 3.1) * 0.3 +
    Math.sin(t * 4.7 + seed * 5.9) * 0.2
  );
}

// ---------------------------------------------------------------------------
// Displacement
// ---------------------------------------------------------------------------

/**
 * Compute the displacement for a motion effect at `relTime` seconds into the clip.
 * Pure: identical inputs always give identical output.
 */
export function getMotionDisplacement(
  settings: Pick<MotionEffectSettings, 'type' | 'intensity' | 'speed' | 'seed'>,
  relTime: number,
  regionSize: number
): MotionDisplacement {
  const amp = Math.max(0, Math.min(100, settings.intensity)) / 100;
  const speed = Math.max(0.1, settings.speed);
  const seed = settings.seed || 1;
  const t = relTime * speed;

  // Amplitude scales with the region so the effect looks equally strong on a
  // small face and a large torso.
  const unit = Math.max(2, regionSize * 0.08) * amp;

  const out: MotionDisplacement = { dx: 0, dy: 0, rotation: 0, scale: 1, rgbSplit: 0 };
  if (amp <= 0) return out;

  switch (settings.type) {
    case 'shake':
      out.dx = noise(t, seed) * unit;
      out.dy = noise(t + 100, seed) * unit;
      break;

    case 'jiggle':
      // Lissajous figure-of-eight.
      out.dx = Math.sin(t * Math.PI * 2) * unit;
      out.dy = Math.sin(t * Math.PI * 4) * unit * 0.5;
      break;

    case 'pulse':
      out.scale = 1 + Math.sin(t * Math.PI * 2) * amp * 0.18;
      break;

    case 'wobble':
      out.rotation = smoothNoise(t, seed) * amp * 12;
      out.dx = smoothNoise(t + 50, seed) * unit * 0.3;
      break;

    case 'bounce': {
      // abs(sin) gives the sharp foot-fall of a bouncing object.
      const phase = Math.abs(Math.sin(t * Math.PI));
      out.dy = -phase * unit * 1.6;
      out.scale = 1 + (1 - phase) * amp * 0.05;
      break;
    }

    case 'vibrate':
      out.dx = noise(t * 2.2, seed) * unit * 1.3;
      break;

    case 'swing':
      out.rotation = Math.sin(t * Math.PI * 2) * amp * 18;
      out.scale = 1 + Math.cos(t * Math.PI * 2) * amp * 0.08;
      break;

    case 'glitchShift':
      out.rgbSplit = (0.5 + Math.abs(noise(t, seed)) * 0.5) * unit * 0.8;
      out.dx = noise(t * 3, seed) * unit * 0.25;
      break;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Trajectory lookup
// ---------------------------------------------------------------------------

/** Axis-aligned bounding box of a quad. */
export function cornersToRect(c: CornerPoints): { x: number; y: number; w: number; h: number } {
  const xs = [c.x0, c.x1, c.x2, c.x3];
  const ys = [c.y0, c.y1, c.y2, c.y3];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/**
 * Where is the tracked region at `time`?
 *
 * The tracker samples at ~15fps while playback runs at 60, so raw lookup would
 * make the region visibly step. Linearly interpolating between the two
 * surrounding samples keeps the patch glued to the subject.
 */
export function getTrackedCorners(
  track: { time: number; corners: CornerPoints }[] | undefined,
  fallback: CornerPoints | undefined,
  time: number
): CornerPoints | null {
  if (!track || track.length === 0) return fallback ?? null;
  if (track.length === 1) return track[0].corners;

  if (time <= track[0].time) return track[0].corners;
  const last = track[track.length - 1];
  if (time >= last.time) return last.corners;

  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].time <= time) lo = mid;
    else hi = mid;
  }

  const a = track[lo];
  const b = track[hi];
  const span = b.time - a.time;
  if (span <= 0) return a.corners;
  const f = (time - a.time) / span;

  const lerp = (p: number, q: number) => p + (q - p) * f;
  return {
    x0: lerp(a.corners.x0, b.corners.x0), y0: lerp(a.corners.y0, b.corners.y0),
    x1: lerp(a.corners.x1, b.corners.x1), y1: lerp(a.corners.y1, b.corners.y1),
    x2: lerp(a.corners.x2, b.corners.x2), y2: lerp(a.corners.y2, b.corners.y2),
    x3: lerp(a.corners.x3, b.corners.x3), y3: lerp(a.corners.y3, b.corners.y3),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Scratch canvases, reused across frames to avoid per-frame allocation. */
const scratchPool = new Map<string, HTMLCanvasElement>();

function getScratch(key: string, w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  let c = scratchPool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    scratchPool.set(key, c);
    // Bound the pool; these are full-region sized and can add up.
    if (scratchPool.size > 12) {
      for (const k of scratchPool.keys()) {
        if (k !== key) { scratchPool.delete(k); break; }
      }
    }
  }
  const tw = Math.max(1, Math.round(w));
  const th = Math.max(1, Math.round(h));
  if (c.width !== tw) c.width = tw;
  if (c.height !== th) c.height = th;
  return c;
}

export function clearMotionEffectCache(): void {
  scratchPool.clear();
}

/**
 * Apply a motion-tracked region effect to an already-drawn frame.
 *
 * `ctx` must contain the clip's rendered pixels; the region is read back from it,
 * transformed, and drawn over the top.
 *
 * @param relTime seconds since the clip started (drives the animation phase)
 * @param scaleX/scaleY map region coordinates (authored at 854x480) onto `ctx`
 */
export function applyMotionEffect(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  settings: MotionEffectSettings,
  relTime: number,
  cacheKey: string,
  scaleX: number = 1,
  scaleY: number = 1
): void {
  if (!settings?.enabled) return;

  const corners = getTrackedCorners(settings.track, settings.baseCorners, relTime);
  if (!corners) return;

  const rect = cornersToRect(corners);

  // Grow the region a little so the displaced patch still has pixels at its old
  // edge — otherwise a shake exposes a hard rectangular seam.
  const grow = Math.max(1, (settings.regionScale ?? 110) / 100);
  const cxR = (rect.x + rect.w / 2) * scaleX;
  const cyR = (rect.y + rect.h / 2) * scaleY;
  const rw = rect.w * scaleX * grow;
  const rh = rect.h * scaleY * grow;

  // Clamp to the canvas; a zero-area region would throw in drawImage.
  const sx = Math.max(0, Math.min(canvasW - 1, cxR - rw / 2));
  const sy = Math.max(0, Math.min(canvasH - 1, cyR - rh / 2));
  const sw = Math.max(1, Math.min(canvasW - sx, rw));
  const sh = Math.max(1, Math.min(canvasH - sy, rh));
  if (sw < 2 || sh < 2) return;

  const disp = getMotionDisplacement(settings, relTime, Math.min(sw, sh));

  const patch = getScratch(`${cacheKey}_patch`, sw, sh);
  if (!patch) return;
  const pctx = patch.getContext('2d');
  if (!pctx) return;

  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, patch.width, patch.height);
  try {
    pctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, patch.width, patch.height);
  } catch {
    return; // tainted canvas or degenerate rect
  }

  if (disp.rgbSplit > 0) {
    applyRegionRgbSplit(pctx, patch.width, patch.height, disp.rgbSplit);
  }

  // Feather the patch edges so it melts into the untouched frame instead of
  // showing a rectangle. Done with destination-in + a radial gradient.
  const feather = Math.max(0, settings.feather ?? 0);
  if (feather > 0) {
    const mask = getScratch(`${cacheKey}_mask`, sw, sh);
    if (mask) {
      const mctx = mask.getContext('2d');
      if (mctx) {
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(0, 0, mask.width, mask.height);
        const gx = mask.width / 2;
        const gy = mask.height / 2;
        const outer = Math.max(gx, gy);
        const inner = Math.max(0, outer - feather);
        const grad = mctx.createRadialGradient(gx, gy, inner, gx, gy, outer);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        mctx.fillStyle = grad;
        // Ellipse-shaped falloff matches the region's aspect better than a circle.
        mctx.save();
        mctx.translate(gx, gy);
        mctx.scale(1, mask.height / Math.max(1, mask.width));
        mctx.translate(-gx, -gy);
        mctx.fillRect(0, 0, mask.width, mask.height);
        mctx.restore();

        pctx.globalCompositeOperation = 'destination-in';
        pctx.drawImage(mask, 0, 0);
        pctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  // Composite the transformed patch back over the frame.
  ctx.save();
  ctx.translate(sx + sw / 2 + disp.dx, sy + sh / 2 + disp.dy);
  if (disp.rotation) ctx.rotate((disp.rotation * Math.PI) / 180);
  if (disp.scale !== 1) ctx.scale(disp.scale, disp.scale);
  ctx.drawImage(patch, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
}

/** RGB channel offset, confined to the patch. */
function applyRegionRgbSplit(
  pctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number
): void {
  try {
    const src = pctx.getImageData(0, 0, w, h);
    const out = pctx.createImageData(w, h);
    const s = src.data;
    const d = out.data;
    const off = Math.max(1, Math.round(amount));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const rx = Math.min(w - 1, x + off);
        const bx = Math.max(0, x - off);
        d[i] = s[(y * w + rx) * 4];         // R shifted right
        d[i + 1] = s[i + 1];                 // G stays
        d[i + 2] = s[(y * w + bx) * 4 + 2];  // B shifted left
        d[i + 3] = s[i + 3];
      }
    }
    pctx.putImageData(out, 0, 0);
  } catch {
    /* ignore: read-back can fail on a tainted canvas */
  }
}
