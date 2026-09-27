/**
 * matteEngine.ts — shared alpha-matte processing for the AI cutout pipeline.
 *
 * Everything that turns a raw segmentation result into the pixels you actually
 * see lives here, so the preview renderer, the smart orchestrator and the
 * export compositor all behave identically.
 *
 * ── Why this module exists ───────────────────────────────────────────────────
 *
 * The cutout used to look "steppy" and flickery compared to CapCut for three
 * structural reasons, all fixed here:
 *
 *  1. NEAREST-NEIGHBOUR MATTES. Inference runs at 10–20 fps but video plays at
 *     30–60 fps. The old code held each matte until the next one arrived, so
 *     the silhouette lagged the subject by up to 100 ms and visibly stepped.
 *     `pickBracket` + `lerpMatte` interpolate between the two surrounding
 *     keyframes every rendered frame instead.
 *
 *  2. WRONG BLEND MATHS. Cross-fading two mattes with `globalAlpha` +
 *     `source-over` is NOT a linear alpha mix — the result is
 *     `t·a₂ + (1−t)·a₁ − t·a₂·(1−t)·a₁`, which thins the matte mid-blend and
 *     makes the edge pulse. `lerpMatte` uses `lighter`, which for a white-RGB
 *     matte is exactly `a = (1−t)·a₁ + t·a₂`.
 *
 *  3. FULL-RESOLUTION PIXEL LOOPS. Choke/feather ran `getImageData` → JS loop →
 *     `putImageData` at clip resolution on EVERY frame (the stock preset has
 *     `choke: -1`, so this was always on). `refineMatte` does the same job with
 *     GPU alpha-power passes at a capped work resolution and never reads back.
 *
 * ── Alpha-power choke ────────────────────────────────────────────────────────
 *
 * Drawing a matte onto itself composites its alpha channel analytically:
 *
 *     destination-in :  a ⊗ a  =  a²        → erodes (pulls the edge in)
 *     source-over    :  a ⊕ a  =  1−(1−a)²  → dilates (pushes the edge out)
 *
 * Repeating against the ORIGINAL matte gives `aⁿ` / `1−(1−a)ⁿ`, a smooth,
 * monotonic edge shift with no readback and no per-pixel JavaScript.
 */

export type MatteSurface = HTMLCanvasElement | OffscreenCanvas;
export type MatteImage = MatteSurface | ImageBitmap;
export type Matte2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type MatteSource = CanvasImageSource;

export type CutoutMode = 'remove' | 'blur' | 'outline' | 'color';

// ─────────────────────────────────────────────────────────────────────────────
// Pure kernels — no DOM, unit-testable in a plain Node environment.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamped interpolation weight of `t` inside `[t0, t1]`.
 * Degenerate/inverted spans return 0 so callers fall back to the first sample.
 */
export function bracketWeight(t0: number, t1: number, t: number): number {
  const span = t1 - t0;
  if (!(span > 0)) return 0;
  const w = (t - t0) / span;
  return w <= 0 ? 0 : w >= 1 ? 1 : w;
}

export interface Bracket {
  /** Index of the keyframe at or before `t`. */
  i0: number;
  /** Index of the keyframe after `t` (equals `i0` when there is nothing to mix). */
  i1: number;
  /** Mix weight of `i1` — 0 means "use i0 as-is". */
  w: number;
}

/**
 * Binary-search a SORTED, ASCENDING array of keyframe timestamps and return the
 * pair that brackets `t` together with the interpolation weight.
 *
 * Before the first key and after the last key it clamps to that key with w = 0,
 * so the caller never has to special-case clip boundaries.
 */
export function pickBracket(times: ArrayLike<number>, t: number): Bracket | null {
  const n = times.length;
  if (n === 0) return null;
  if (n === 1) return { i0: 0, i1: 0, w: 0 };

  let lo = 0;
  let hi = n - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (idx < 0) return { i0: 0, i1: 0, w: 0 };
  if (idx >= n - 1) return { i0: n - 1, i1: n - 1, w: 0 };
  return { i0: idx, i1: idx + 1, w: bracketWeight(times[idx], times[idx + 1], t) };
}

/**
 * How many alpha-power passes approximate a `choke` of N destination pixels.
 * Kept small and monotonic — this is a creative control, not a metric.
 */
export function chokePasses(choke: number): number {
  const a = Math.abs(choke);
  if (a < 0.5) return 0;
  return Math.max(1, Math.min(4, Math.round(a * 0.7)));
}

/**
 * Blur radius (in WORK-buffer pixels) used to build the alpha ramp that choke
 * and feather both operate on. `scale` converts destination px → work px.
 */
export function featherRadius(choke: number, feather: number, scale: number): number {
  const base = Math.max(Math.max(0, feather), Math.abs(choke) * 1.2);
  const r = base * scale;
  return r < 0.35 ? 0 : Math.min(48, r);
}

function clampIdx(v: number, len: number): number {
  return v < 0 ? 0 : v >= len ? len - 1 : v;
}

/**
 * Separable box blur over the ALPHA channel of an RGBA buffer, in place.
 * Three passes approximate a Gaussian closely enough for matte feathering.
 *
 * Only used where `ctx.filter` is unavailable (older Safari / some worker
 * scopes); the GPU path is preferred everywhere else.
 */
export function boxBlurAlpha(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  radius: number,
  passes = 3
): void {
  const r = Math.max(0, Math.floor(radius));
  if (r < 1 || w < 1 || h < 1) return;

  const n = w * h;
  let src = new Uint16Array(n);
  let dst = new Uint16Array(n);
  for (let i = 0, p = 3; i < n; i++, p += 4) src[i] = data[p];

  const div = 2 * r + 1;
  for (let pass = 0; pass < passes; pass++) {
    // Horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[row + clampIdx(x, w)];
      for (let x = 0; x < w; x++) {
        dst[row + x] = (sum / div) | 0;
        sum -= src[row + clampIdx(x - r, w)];
        sum += src[row + clampIdx(x + r + 1, w)];
      }
    }
    let swap = src; src = dst; dst = swap;

    // Vertical
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += src[clampIdx(y, h) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = (sum / div) | 0;
        sum -= src[clampIdx(y - r, h) * w + x];
        sum += src[clampIdx(y + r + 1, h) * w + x];
      }
    }
    swap = src; src = dst; dst = swap;
  }

  for (let i = 0, p = 3; i < n; i++, p += 4) data[p] = src[i];
}

/** Linear interpolation of two alpha planes — the reference for `lerpMatte`. */
export function lerpAlphaPlanes(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  weight: number,
  out: Uint8ClampedArray | Uint8Array
): void {
  const w = weight <= 0 ? 0 : weight >= 1 ? 1 : weight;
  const inv = 1 - w;
  const n = Math.min(a.length, b.length, out.length);
  for (let i = 0; i < n; i++) {
    out[i] = Math.round(inv * a[i] + w * b[i]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface helpers — worker-safe (OffscreenCanvas first, DOM canvas fallback).
// ─────────────────────────────────────────────────────────────────────────────

const HAS_OFFSCREEN = typeof OffscreenCanvas !== 'undefined';

export function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function createMatteSurface(w: number, h: number): MatteSurface {
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  if (HAS_OFFSCREEN) return new OffscreenCanvas(cw, ch);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  return c;
}

const surfacePool = new Map<string, MatteSurface>();
const SURFACE_POOL_MAX = 96;

/** LRU-pooled scratch surface. Resized in place when the request changes. */
export function getSurface(key: string, w: number, h: number): MatteSurface {
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  let s = surfacePool.get(key);
  if (s) {
    surfacePool.delete(key);
    surfacePool.set(key, s);
  } else {
    if (surfacePool.size >= SURFACE_POOL_MAX) {
      const oldest = surfacePool.keys().next().value;
      if (oldest) surfacePool.delete(oldest);
    }
    s = createMatteSurface(cw, ch);
    surfacePool.set(key, s);
  }
  if (s.width !== cw || s.height !== ch) {
    s.width = cw;
    s.height = ch;
  }
  return s;
}

export function dropSurfaces(prefix: string): void {
  for (const key of Array.from(surfacePool.keys())) {
    if (key.startsWith(prefix)) surfacePool.delete(key);
  }
}

export function clearSurfaces(): void {
  surfacePool.clear();
}

export function ctx2d(surface: MatteSurface): Matte2D | null {
  return surface.getContext('2d') as Matte2D | null;
}

/** Reset one of OUR pooled scratch surfaces to a known state. */
function resetCtx(ctx: Matte2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  resetDrawState(ctx);
}

/**
 * Reset only the draw state of a CALLER-OWNED context.
 * Deliberately does NOT touch the transform — the destination context belongs
 * to the renderer, and silently clearing its matrix would move everything drawn
 * after us.
 */
function resetDrawState(ctx: Matte2D): void {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  (ctx as any).filter = 'none';
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';
}

let _filterSupport: boolean | null = null;

/** Whether this context implements `ctx.filter` (Safari lagged on OffscreenCanvas). */
export function supportsCanvasFilter(): boolean {
  if (_filterSupport !== null) return _filterSupport;
  try {
    const probe = createMatteSurface(2, 2);
    const c = probe.getContext('2d') as any;
    if (!c) {
      _filterSupport = false;
      return false;
    }
    c.filter = 'blur(1px)';
    _filterSupport = typeof c.filter === 'string' && c.filter.indexOf('blur') === 0;
  } catch {
    _filterSupport = false;
  }
  return _filterSupport;
}

/**
 * Draw a matte at an arbitrary size with HIGH quality resampling.
 *
 * Mattes are computed small (256–1024 px) and stretched to clip resolution, so
 * the default `imageSmoothingQuality: 'low'` was a visible source of the blocky,
 * stair-stepped edges this pipeline was reported for.
 */
export function drawMatte(ctx: Matte2D, matte: MatteSource, w: number, h: number): void {
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';
  ctx.drawImage(matte, 0, 0, w, h);
}

/** A 1×1 surface is the "analysed, no subject here" sentinel. */
export function isEmptyMatte(m: { width: number; height: number } | null | undefined): boolean {
  return !!m && m.width === 1 && m.height === 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matte interpolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EXACT linear alpha interpolation between two mattes.
 *
 * `lighter` adds premultiplied values, so with `globalAlpha` pre-scaling:
 *   alpha_out = (1−w)·a₁ + w·a₂   and the RGB stays white.
 * That is a true lerp, unlike the `source-over` + `globalAlpha` cross-fade this
 * replaces, which under-shoots in the middle and makes the edge pulse.
 */
export function lerpMatte(
  a: MatteImage,
  b: MatteImage,
  weight: number,
  poolKey: string
): MatteImage {
  if (!(weight > 0.002)) return a;
  if (weight >= 0.998) return b;
  if (a === b) return a;

  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const surf = getSurface(poolKey, w, h);
  const ctx = ctx2d(surf);
  if (!ctx) return weight < 0.5 ? a : b;

  resetCtx(ctx);
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - weight;
  ctx.drawImage(a as MatteSource, 0, 0, w, h);
  ctx.globalAlpha = weight;
  ctx.drawImage(b as MatteSource, 0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return surf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge refinement (choke / feather)
// ─────────────────────────────────────────────────────────────────────────────

export interface RefineOptions {
  /** Destination pixels. Negative shrinks the matte, positive grows it. */
  choke?: number;
  /** Destination pixels of Gaussian edge softness. */
  feather?: number;
  /** Size the matte will finally be drawn at — choke/feather are in these units. */
  destWidth: number;
  destHeight: number;
  /** Pool namespace; must be unique per clip + call site. */
  poolKey: string;
  /** Upper bound on the internal work resolution (default 1024 px longest side). */
  maxWork?: number;
}

/**
 * Apply choke and feather WITHOUT any pixel readback.
 *
 * Work happens at `min(destSize, maxWork)` rather than at clip resolution: for
 * a 1080p clip that is ~3.5× fewer pixels per pass, and the high-quality
 * upsample into the work buffer also smooths the low-resolution matte before
 * the blur, which is why edges come out noticeably cleaner than before.
 */
export function refineMatte(matte: MatteImage, opts: RefineOptions): MatteImage {
  const choke = opts.choke ?? 0;
  const feather = Math.max(0, opts.feather ?? 0);
  if (Math.abs(choke) < 0.01 && feather < 0.01) return matte;

  const destW = Math.max(1, Math.round(opts.destWidth));
  const destH = Math.max(1, Math.round(opts.destHeight));
  const canFilter = supportsCanvasFilter();
  const maxWork = opts.maxWork ?? (canFilter ? 1024 : 512);
  const longest = Math.max(destW, destH);
  const scale = longest > maxWork ? maxWork / longest : 1;
  const workW = Math.max(16, Math.round(destW * scale));
  const workH = Math.max(16, Math.round(destH * scale));

  const radius = featherRadius(choke, feather, scale);
  const passes = chokePasses(choke);
  if (radius <= 0 && passes <= 0) return matte;

  const base = getSurface(`${opts.poolKey}#a`, workW, workH);
  const bctx = ctx2d(base);
  if (!bctx) return matte;

  resetCtx(bctx);
  bctx.clearRect(0, 0, workW, workH);

  if (radius > 0 && canFilter) {
    (bctx as any).filter = `blur(${radius.toFixed(2)}px)`;
    bctx.drawImage(matte as MatteSource, 0, 0, workW, workH);
    (bctx as any).filter = 'none';
  } else {
    bctx.drawImage(matte as MatteSource, 0, 0, workW, workH);
    if (radius > 0) {
      try {
        const id = bctx.getImageData(0, 0, workW, workH);
        boxBlurAlpha(id.data, workW, workH, Math.max(1, Math.round(radius * 0.6)), 3);
        bctx.putImageData(id, 0, 0);
      } catch {
        /* tainted canvas — keep the un-feathered matte rather than failing */
      }
    }
  }

  if (passes <= 0) return base;

  // Alpha-power passes: always composite against the ORIGINAL ramp so the
  // exponent grows linearly (aⁿ) instead of squaring every iteration.
  const erode = choke < 0;
  let cur: MatteSurface = base;
  let alt: MatteSurface = getSurface(`${opts.poolKey}#b`, workW, workH);

  for (let i = 0; i < passes; i++) {
    const actx = ctx2d(alt);
    if (!actx) break;
    resetCtx(actx);
    actx.clearRect(0, 0, workW, workH);
    actx.drawImage(cur as MatteSource, 0, 0, workW, workH);
    actx.globalCompositeOperation = erode ? 'destination-in' : 'source-over';
    actx.drawImage(base as MatteSource, 0, 0, workW, workH);
    actx.globalCompositeOperation = 'source-over';

    if (cur === base) {
      cur = alt;
      alt = getSurface(`${opts.poolKey}#c`, workW, workH);
    } else {
      const tmp = cur;
      cur = alt;
      alt = tmp;
    }
  }

  return cur;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cutout compositing — one implementation shared by preview and export
// ─────────────────────────────────────────────────────────────────────────────

/** Longest side of the scratch buffers used to build a blurred backdrop. */
const BG_PLATE_MAX = 960;

export interface CutoutStyle {
  mode?: CutoutMode;
  blurStrength?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeGlow?: boolean;
  bgColor?: string;
}

/**
 * Composite `source` through `matte` into `ctx` using one of the four cutout
 * styles. Preview and export used to carry near-identical private copies of
 * this, which is how they drifted apart; there is now exactly one.
 *
 * @param applySpill Optional spill-suppression hook, run on the foreground
 *                   plate (or directly on `ctx` in `remove` mode).
 */
export function compositeCutout(
  ctx: Matte2D,
  width: number,
  height: number,
  source: MatteSource,
  matte: MatteImage,
  style: CutoutStyle | undefined,
  poolKey: string,
  applySpill?: (target: Matte2D, w: number, h: number) => void
): void {
  const mode: CutoutMode = style?.mode || 'remove';

  if (mode === 'remove') {
    ctx.globalCompositeOperation = 'destination-in';
    drawMatte(ctx, matte as MatteSource, width, height);
    ctx.globalCompositeOperation = 'source-over';
    if (applySpill) applySpill(ctx, width, height);
    return;
  }

  // Foreground plate: the subject, cut out and spill-corrected.
  const fg = getSurface(`${poolKey}#fg`, width, height);
  const fgCtx = ctx2d(fg);
  if (!fgCtx) return;
  resetCtx(fgCtx);
  fgCtx.clearRect(0, 0, width, height);
  fgCtx.drawImage(source, 0, 0, width, height);
  fgCtx.globalCompositeOperation = 'destination-in';
  drawMatte(fgCtx, matte as MatteSource, width, height);
  fgCtx.globalCompositeOperation = 'source-over';
  if (applySpill) applySpill(fgCtx, width, height);

  if (mode === 'blur') {
    const blurPx = Math.max(1, style?.blurStrength ?? 12);
    const canFilter = supportsCanvasFilter();

    resetDrawState(ctx);
    ctx.clearRect(0, 0, width, height);

    if (canFilter) {
      // The background is about to be destroyed by a large blur, so there is no
      // point paying for it at full resolution: build it at ≤ BG_PLATE_MAX px
      // and let the upscale do the last bit of smoothing. At 1080p that is ~4×
      // fewer pixels and ~16 MB less scratch memory per clip.
      const longest = Math.max(width, height);
      const pScale = longest > BG_PLATE_MAX ? BG_PLATE_MAX / longest : 1;
      const pw = Math.max(16, Math.round(width * pScale));
      const pht = Math.max(16, Math.round(height * pScale));
      const pBlur = Math.max(0.5, blurPx * pScale);

      // Base pass: blur of the whole frame. On its own this leaves a ghost of
      // the subject smeared around the silhouette.
      const base = getSurface(`${poolKey}#bgbase`, pw, pht);
      const bCtx = ctx2d(base);
      if (bCtx) {
        resetCtx(bCtx);
        bCtx.clearRect(0, 0, pw, pht);
        (bCtx as any).filter = `blur(${pBlur.toFixed(2)}px)`;
        bCtx.drawImage(source, 0, 0, pw, pht);
        (bCtx as any).filter = 'none';
        drawMatte(ctx, base as MatteSource, width, height);
      } else {
        (ctx as any).filter = `blur(${blurPx}px)`;
        ctx.drawImage(source, 0, 0, width, height);
        (ctx as any).filter = 'none';
      }

      // Ghost killer: blur a plate that has the subject punched OUT, so the
      // hole fills with genuine background instead of the subject's colours.
      // Without this the sharp subject sits inside a blurred copy of itself,
      // which reads as a halo — the giveaway of a cheap portrait-blur.
      const plate = getSurface(`${poolKey}#bgplate`, pw, pht);
      const pCtx = ctx2d(plate);
      if (pCtx) {
        resetCtx(pCtx);
        pCtx.clearRect(0, 0, pw, pht);
        pCtx.drawImage(source, 0, 0, pw, pht);
        pCtx.globalCompositeOperation = 'destination-out';
        drawMatte(pCtx, matte as MatteSource, pw, pht);
        pCtx.globalCompositeOperation = 'source-over';

        const soft = getSurface(`${poolKey}#bgsoft`, pw, pht);
        const sCtx = ctx2d(soft);
        if (sCtx) {
          resetCtx(sCtx);
          sCtx.clearRect(0, 0, pw, pht);
          (sCtx as any).filter = `blur(${pBlur.toFixed(2)}px)`;
          sCtx.drawImage(plate as MatteSource, 0, 0, pw, pht);
          (sCtx as any).filter = 'none';
          drawMatte(ctx, soft as MatteSource, width, height);
        }
      }
    } else {
      ctx.drawImage(source, 0, 0, width, height);
    }

    ctx.drawImage(fg as MatteSource, 0, 0, width, height);
    return;
  }

  if (mode === 'color') {
    resetDrawState(ctx);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = style?.bgColor || '#1e1e24';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(fg as MatteSource, 0, 0, width, height);
    return;
  }

  // mode === 'outline'
  const strokeW = Math.max(1, style?.strokeWidth ?? 4);
  const strokeCol = style?.strokeColor ?? '#ffffff';

  const stroke = getSurface(`${poolKey}#stroke`, width, height);
  const sCtx = ctx2d(stroke);
  if (sCtx) {
    resetCtx(sCtx);
    sCtx.clearRect(0, 0, width, height);
    drawMatte(sCtx, matte as MatteSource, width, height);
    sCtx.globalCompositeOperation = 'source-in';
    sCtx.fillStyle = strokeCol;
    sCtx.fillRect(0, 0, width, height);
    sCtx.globalCompositeOperation = 'source-over';
  }

  resetDrawState(ctx);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (style?.strokeGlow) {
    ctx.shadowColor = strokeCol;
    ctx.shadowBlur = strokeW * 3;
  }
  // 8-way offset ring — round it so thick strokes don't look square.
  const diag = strokeW * 0.7071;
  const ring: Array<[number, number]> = [
    [-strokeW, 0], [strokeW, 0], [0, -strokeW], [0, strokeW],
    [-diag, -diag], [diag, -diag], [-diag, diag], [diag, diag],
  ];
  for (const [ox, oy] of ring) {
    ctx.drawImage(stroke as MatteSource, ox, oy, width, height);
  }
  ctx.restore();
  ctx.drawImage(fg as MatteSource, 0, 0, width, height);
}

// ─────────────────────────────────────────────────────────────────────────────
// Live matte track — cross-fades newly inferred mattes so they never pop
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FADE_MS = 110;

/**
 * Holds the previous and current matte for a clip in dedicated ping-pong
 * buffers and cross-fades between them.
 *
 * Without this, an inference landing every 250–700 ms swapped the silhouette
 * instantly — the subject has moved several pixels by then, so the edge jumped.
 * A ~110 ms ease turns that jump into motion the eye reads as continuous.
 */
export class LiveMatteTrack {
  private readonly key: string;
  private readonly fadeMs: number;
  private prev: MatteSurface | null = null;
  private cur: MatteSurface | null = null;
  private slot = 0;
  private fadeStart = 0;
  private curOpaque = false;
  private prevOpaque = false;

  constructor(key: string, fadeMs: number = DEFAULT_FADE_MS) {
    this.key = key;
    this.fadeMs = fadeMs;
  }

  get hasMatte(): boolean {
    return this.cur !== null;
  }

  /**
   * Copy `matte` into the track. Copying is deliberate: callers hand us pooled
   * or transferable surfaces they are free to overwrite on the next frame.
   */
  push(matte: MatteImage, opaque = false): void {
    const w = Math.max(1, matte.width);
    const h = Math.max(1, matte.height);
    const target = getSurface(`${this.key}#slot${this.slot}`, w, h);
    const tctx = ctx2d(target);
    if (!tctx) return;
    resetCtx(tctx);
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(matte as MatteSource, 0, 0, w, h);

    this.prev = this.cur;
    this.prevOpaque = this.curOpaque;
    this.cur = target;
    this.curOpaque = opaque;
    this.slot ^= 1;
    this.fadeStart = nowMs();
  }

  /**
   * Push a fully opaque matte so an "empty frame" result DISSOLVES back to the
   * original video instead of snapping the background on.
   */
  pushOpaque(width = 64, height = 64): void {
    if (this.curOpaque) return;
    const surf = getSurface(`${this.key}#opaque`, width, height);
    const ctx = ctx2d(surf);
    if (!ctx) return;
    resetCtx(ctx);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    this.push(surf, true);
  }

  /**
   * Current matte for this instant, or `null` when the cutout has fully
   * dissolved (caller should then leave the frame untouched).
   */
  sample(now = nowMs()): MatteImage | null {
    if (!this.cur) return null;
    const t = this.fadeMs > 0 ? (now - this.fadeStart) / this.fadeMs : 1;
    if (!this.prev || t >= 1) {
      this.prev = null;
      return this.curOpaque ? null : this.cur;
    }
    if (this.curOpaque && this.prevOpaque) return null;
    return lerpMatte(this.prev, this.cur, t <= 0 ? 0 : t, `${this.key}#fade`);
  }

  /** Drop history so a seek snaps to the next inference instead of easing from a stale matte. */
  reset(): void {
    this.prev = null;
    this.cur = null;
    this.prevOpaque = false;
    this.curOpaque = false;
    this.fadeStart = 0;
  }
}

const liveTracks = new Map<string, LiveMatteTrack>();
const LIVE_TRACK_MAX = 32;

export function getLiveTrack(clipId: string): LiveMatteTrack {
  let track = liveTracks.get(clipId);
  if (!track) {
    if (liveTracks.size >= LIVE_TRACK_MAX) {
      const oldest = liveTracks.keys().next().value;
      if (oldest) {
        liveTracks.delete(oldest);
        dropSurfaces(`live:${oldest}`);
      }
    }
    track = new LiveMatteTrack(`live:${clipId}`);
    liveTracks.set(clipId, track);
  }
  return track;
}

export function peekLiveTrack(clipId: string): LiveMatteTrack | undefined {
  return liveTracks.get(clipId);
}

export function resetLiveTrack(clipId: string): void {
  liveTracks.get(clipId)?.reset();
  dropSurfaces(`live:${clipId}`);
  liveTracks.delete(clipId);
}

export function resetAllLiveTracks(): void {
  for (const id of liveTracks.keys()) dropSurfaces(`live:${id}`);
  liveTracks.clear();
}
