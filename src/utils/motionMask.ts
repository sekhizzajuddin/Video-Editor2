/**
 * motionMask.ts
 *
 * Paint-brush region selection with colour-signature tracking.
 *
 * Why this exists
 * ---------------
 * A rectangle is a poor description of a hand or a face: it always includes
 * background, and it cannot follow a shape that moves non-rigidly. Painting over
 * the feature instead lets us learn what that feature *looks like* — its colour
 * signature — and then re-find it on every later frame, wherever it has moved to.
 *
 * The pipeline
 * ------------
 *   1. The user paints a rough stroke over the feature.
 *   2. `buildColorSignature` samples the painted pixels and learns their colour
 *      distribution in YCbCr (chroma-only, so shading and shadows do not break
 *      the match the way they would in RGB).
 *   3. `computeMaskForFrame` scores every pixel of a frame against that
 *      signature, then keeps only the blob CONNECTED to where the feature was
 *      last seen. That locality constraint is what stops a skin-tone matcher
 *      from also grabbing the subject's face when you only painted their hand.
 *   4. The mask is feathered and handed to the effect compositor, which can apply
 *      the motion either INSIDE the mask or OUTSIDE it.
 *
 * Everything here is deterministic and framework-free so it can be unit tested,
 * and so the exporter produces byte-identical results to the preview.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which side of the selection the effect applies to. */
export type MaskApplyMode = 'inside' | 'outside';

/** How the region is described. */
export type RegionMode = 'box' | 'paint';

/**
 * A learned colour signature: the chroma distribution of the painted pixels,
 * plus a luma range used only as a soft guard against pure black/white areas.
 */
export interface ColorSignature {
  /** Cluster centres in (Cb, Cr) space. */
  centers: Array<{ cb: number; cr: number; weight: number }>;
  /** Chroma radius that counted as "matching" when the signature was built. */
  tolerance: number;
  /** Luma range of the sample, widened a little for shading headroom. */
  lumaMin: number;
  lumaMax: number;
  /** Number of pixels sampled — low counts mean a less reliable signature. */
  sampleCount: number;
}

export interface MaskFrameResult {
  /** 0-255 coverage per pixel, row-major, `width * height` entries. */
  mask: Uint8ClampedArray;
  width: number;
  height: number;
  /** Centroid of the matched blob, in mask coordinates. Null if nothing matched. */
  centroid: { x: number; y: number } | null;
  /** Fraction of the frame that matched, 0-1. Useful for sanity checks. */
  coverage: number;
}

// ---------------------------------------------------------------------------
// Colour space
// ---------------------------------------------------------------------------

/**
 * RGB -> YCbCr.
 *
 * Chroma (Cb/Cr) is largely invariant to how brightly a surface is lit, so a
 * hand keeps roughly the same chroma as it passes through shadow. Matching on
 * chroma rather than RGB is what makes the tracking survive lighting changes.
 */
export function rgbToYCbCr(r: number, g: number, b: number): { y: number; cb: number; cr: number } {
  return {
    y: 0.299 * r + 0.587 * g + 0.114 * b,
    cb: -0.168736 * r - 0.331264 * g + 0.5 * b + 128,
    cr: 0.5 * r - 0.418688 * g - 0.081312 * b + 128,
  };
}

// ---------------------------------------------------------------------------
// Signature building
// ---------------------------------------------------------------------------

/**
 * Learn a colour signature from the pixels the user painted.
 *
 * `strokeMask` marks which pixels were painted (non-zero = painted). We cluster
 * the painted chroma values with a small k-means so a feature spanning two tones
 * (lit side + shadow side of a hand) is represented by both, rather than by a
 * single averaged colour that matches neither well.
 */
export function buildColorSignature(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  strokeMask: Uint8Array,
  tolerance: number = 22,
  maxClusters: number = 3
): ColorSignature | null {
  const samples: Array<{ cb: number; cr: number }> = [];
  let lumaMin = 255;
  let lumaMax = 0;

  // Subsample: a few thousand pixels describe a colour distribution just as well
  // as a hundred thousand, and keeps signature-building instant.
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 8000));

  for (let i = 0; i < total; i += step) {
    if (!strokeMask[i]) continue;
    const p = i * 4;
    if (pixels[p + 3] < 8) continue; // ignore transparent
    const { y, cb, cr } = rgbToYCbCr(pixels[p], pixels[p + 1], pixels[p + 2]);
    samples.push({ cb, cr });
    if (y < lumaMin) lumaMin = y;
    if (y > lumaMax) lumaMax = y;
  }

  if (samples.length < 4) return null;

  const k = Math.max(1, Math.min(maxClusters, Math.floor(samples.length / 8) || 1));
  const centers = kMeansChroma(samples, k);
  if (centers.length === 0) return null;

  return {
    centers,
    tolerance,
    // Widen the luma window: the feature will pass through brighter and darker
    // light than the single frame we sampled.
    lumaMin: Math.max(0, lumaMin - 60),
    lumaMax: Math.min(255, lumaMax + 60),
    sampleCount: samples.length,
  };
}

/**
 * Tiny deterministic k-means over (Cb, Cr).
 *
 * Seeded by even striding rather than randomly, so the same stroke always
 * produces the same signature — important for reproducible exports.
 */
function kMeansChroma(
  samples: Array<{ cb: number; cr: number }>,
  k: number,
  iterations: number = 8
): Array<{ cb: number; cr: number; weight: number }> {
  if (samples.length === 0) return [];

  const centers: Array<{ cb: number; cr: number; weight: number }> = [];
  const stride = Math.max(1, Math.floor(samples.length / k));
  for (let i = 0; i < k; i++) {
    const s = samples[Math.min(samples.length - 1, i * stride)];
    centers.push({ cb: s.cb, cr: s.cr, weight: 0 });
  }

  for (let iter = 0; iter < iterations; iter++) {
    const sums = centers.map(() => ({ cb: 0, cr: 0, n: 0 }));

    for (const s of samples) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dcb = s.cb - centers[c].cb;
        const dcr = s.cr - centers[c].cr;
        const d = dcb * dcb + dcr * dcr;
        if (d < bestD) { bestD = d; best = c; }
      }
      sums[best].cb += s.cb;
      sums[best].cr += s.cr;
      sums[best].n++;
    }

    for (let c = 0; c < centers.length; c++) {
      if (sums[c].n > 0) {
        centers[c].cb = sums[c].cb / sums[c].n;
        centers[c].cr = sums[c].cr / sums[c].n;
        centers[c].weight = sums[c].n / samples.length;
      }
    }
  }

  // Drop clusters that captured almost nothing — they are noise, and keeping
  // them would widen the match to colours the user never painted.
  return centers.filter((c) => c.weight > 0.02);
}

// ---------------------------------------------------------------------------
// Per-frame matching
// ---------------------------------------------------------------------------

/** How closely a pixel matches the signature: 0 = no match, 1 = dead centre. */
function scorePixel(sig: ColorSignature, r: number, g: number, b: number): number {
  const { y, cb, cr } = rgbToYCbCr(r, g, b);
  if (y < sig.lumaMin || y > sig.lumaMax) return 0;

  let best = 0;
  for (const c of sig.centers) {
    const dcb = cb - c.cb;
    const dcr = cr - c.cr;
    const dist = Math.sqrt(dcb * dcb + dcr * dcr);
    if (dist <= sig.tolerance) {
      // Linear falloff to the tolerance edge gives a soft, natural boundary
      // instead of a hard binary cut that would alias badly.
      const s = 1 - dist / sig.tolerance;
      if (s > best) best = s;
    }
  }
  return best;
}

/**
 * Build the mask for one frame.
 *
 * `seed` is where the feature was last seen. When supplied, only the blob
 * connected to that point is kept — this is the "colour + locality" behaviour
 * that stops a hand-coloured matcher from also selecting the face.
 */
export function computeMaskForFrame(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sig: ColorSignature,
  seed?: { x: number; y: number } | null,
  opts: { minScore?: number; searchRadius?: number } = {}
): MaskFrameResult {
  const n = width * height;
  const raw = new Uint8ClampedArray(n);
  const minScore = opts.minScore ?? 0.15;

  // Optional search window around the seed. Bounding the search keeps cost down
  // AND prevents a far-away colour match from stealing the blob after a cut.
  let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1;
  if (seed && opts.searchRadius) {
    const r = opts.searchRadius;
    x0 = Math.max(0, Math.floor(seed.x - r));
    x1 = Math.min(width - 1, Math.ceil(seed.x + r));
    y0 = Math.max(0, Math.floor(seed.y - r));
    y1 = Math.min(height - 1, Math.ceil(seed.y + r));
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      const p = i * 4;
      if (pixels[p + 3] < 8) continue;
      const s = scorePixel(sig, pixels[p], pixels[p + 1], pixels[p + 2]);
      if (s >= minScore) raw[i] = Math.round(s * 255);
    }
  }

  const connected = seed ? keepConnectedBlob(raw, width, height, seed) : raw;

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (connected[y * width + x] > 0) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  return {
    mask: connected,
    width,
    height,
    centroid: count > 0 ? { x: sumX / count, y: sumY / count } : null,
    coverage: count / n,
  };
}

/**
 * Flood-fill from the seed and discard everything not reachable.
 *
 * If the seed itself missed (the feature moved further than expected, or was
 * briefly occluded) we fall back to the nearest matching pixel rather than
 * returning an empty mask, which would make the effect flicker off for a frame.
 */
function keepConnectedBlob(
  raw: Uint8ClampedArray,
  width: number,
  height: number,
  seed: { x: number; y: number }
): Uint8ClampedArray {
  const n = width * height;
  const out = new Uint8ClampedArray(n);

  let sx = Math.round(seed.x);
  let sy = Math.round(seed.y);
  sx = Math.max(0, Math.min(width - 1, sx));
  sy = Math.max(0, Math.min(height - 1, sy));

  let startIdx = sy * width + sx;
  if (raw[startIdx] === 0) {
    const found = findNearestMatch(raw, width, height, sx, sy);
    if (found < 0) return out;
    startIdx = found;
  }

  // Iterative flood fill; a recursive one would blow the stack on large blobs.
  const stack = new Int32Array(n);
  let sp = 0;
  stack[sp++] = startIdx;
  const seen = new Uint8Array(n);
  seen[startIdx] = 1;

  while (sp > 0) {
    const idx = stack[--sp];
    out[idx] = raw[idx];

    const x = idx % width;
    const y = (idx / width) | 0;

    if (x > 0) { const t = idx - 1; if (!seen[t] && raw[t] > 0) { seen[t] = 1; stack[sp++] = t; } }
    if (x < width - 1) { const t = idx + 1; if (!seen[t] && raw[t] > 0) { seen[t] = 1; stack[sp++] = t; } }
    if (y > 0) { const t = idx - width; if (!seen[t] && raw[t] > 0) { seen[t] = 1; stack[sp++] = t; } }
    if (y < height - 1) { const t = idx + width; if (!seen[t] && raw[t] > 0) { seen[t] = 1; stack[sp++] = t; } }
  }

  return out;
}

/** Spiral outward from (sx, sy) for the closest matching pixel. */
function findNearestMatch(
  raw: Uint8ClampedArray,
  width: number,
  height: number,
  sx: number,
  sy: number
): number {
  const maxR = Math.max(width, height);
  for (let r = 1; r < maxR; r += 2) {
    const xa = Math.max(0, sx - r);
    const xb = Math.min(width - 1, sx + r);
    const ya = Math.max(0, sy - r);
    const yb = Math.min(height - 1, sy + r);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        // Only walk the ring, not the filled square.
        if (y !== ya && y !== yb && x !== xa && x !== xb) continue;
        const i = y * width + x;
        if (raw[i] > 0) return i;
      }
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Mask post-processing
// ---------------------------------------------------------------------------

/**
 * Box-blur the mask to soften its edge.
 *
 * A hard-edged colour mask looks cut-out and reveals every misclassified pixel;
 * feathering hides both. Separable (H then V) so cost is linear in radius.
 */
export function featherMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return mask;
  const r = Math.min(32, Math.round(radius));
  const tmp = new Uint8ClampedArray(mask.length);
  const out = new Uint8ClampedArray(mask.length);
  const win = r * 2 + 1;

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += mask[y * width + Math.max(0, Math.min(width - 1, x))];
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = sum / win;
      const outX = Math.max(0, Math.min(width - 1, x - r));
      const inX = Math.max(0, Math.min(width - 1, x + r + 1));
      sum += mask[y * width + inX] - mask[y * width + outX];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(height - 1, y)) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / win;
      const outY = Math.max(0, Math.min(height - 1, y - r));
      const inY = Math.max(0, Math.min(height - 1, y + r + 1));
      sum += tmp[inY * width + x] - tmp[outY * width + x];
    }
  }

  return out;
}

/** Grow (positive) or shrink (negative) the mask, in pixels. */
export function chokeMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
): Uint8ClampedArray {
  const a = Math.round(amount);
  if (a === 0) return mask;
  const grow = a > 0;
  const r = Math.min(16, Math.abs(a));
  let cur = mask;

  for (let pass = 0; pass < r; pass++) {
    const next = new Uint8ClampedArray(cur.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let v = cur[i];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nv = cur[ny * width + nx];
            v = grow ? Math.max(v, nv) : Math.min(v, nv);
          }
        }
        next[i] = v;
      }
    }
    cur = next;
  }
  return cur;
}

/** Flip the mask, turning an "inside" selection into an "outside" one. */
export function invertMask(mask: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = 255 - mask[i];
  return out;
}

/** Rasterise a mask into RGBA where coverage becomes alpha (white matte). */
export function maskToImageData(
  mask: Uint8ClampedArray,
  width: number,
  height: number
): ImageData | null {
  if (typeof ImageData === 'undefined') return null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    rgba[p] = 255;
    rgba[p + 1] = 255;
    rgba[p + 2] = 255;
    rgba[p + 3] = mask[i];
  }
  return new ImageData(rgba, width, height);
}

/** Axis-aligned bounds of the non-zero mask area. Null when empty. */
export function maskBounds(
  mask: Uint8ClampedArray,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ---------------------------------------------------------------------------
// Run-length encoding
// ---------------------------------------------------------------------------

/**
 * RLE a mask for storage.
 *
 * A cached mask per frame would otherwise be width*height bytes; masks are
 * mostly long runs of 0 or 255, so RLE typically shrinks them by 50-200x. That
 * matters because these live in the project file.
 *
 * Format: [value, runLength, value, runLength, ...] with value quantised to 0-255.
 */
export function encodeMaskRle(mask: Uint8ClampedArray): number[] {
  const out: number[] = [];
  if (mask.length === 0) return out;
  let cur = mask[0];
  let run = 1;
  for (let i = 1; i < mask.length; i++) {
    if (mask[i] === cur && run < 65535) {
      run++;
    } else {
      out.push(cur, run);
      cur = mask[i];
      run = 1;
    }
  }
  out.push(cur, run);
  return out;
}

/** Inverse of `encodeMaskRle`. */
export function decodeMaskRle(rle: number[], length: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(length);
  let idx = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    const value = rle[i];
    const run = rle[i + 1];
    for (let j = 0; j < run && idx < length; j++) out[idx++] = value;
  }
  return out;
}

/**
 * Nearest-neighbour resample. Masks are cached at a reduced resolution to keep
 * project files small and analysis fast, then scaled up to the render size.
 */
export function resampleMask(
  mask: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  if (srcW === dstW && srcH === dstH) return mask;
  const out = new Uint8ClampedArray(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x * xRatio));
      out[y * dstW + x] = mask[sy * srcW + sx];
    }
  }
  return out;
}

/**
 * Look up the cached mask for a time, choosing the NEAREST cached frame.
 *
 * Deliberately nearest rather than interpolated: blending two binary-ish masks
 * produces ghosting at the edges, which looks worse than a mask that updates a
 * fraction of a frame late.
 */
export function pickCachedMask(
  frames: Array<{ time: number; rle: number[]; centroid: { x: number; y: number } | null }>,
  time: number
): { rle: number[]; centroid: { x: number; y: number } | null } | null {
  if (!frames || frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  if (time <= frames[0].time) return frames[0];
  if (time >= frames[hi].time) return frames[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time <= time) lo = mid;
    else hi = mid;
  }
  return time - frames[lo].time <= frames[hi].time - time ? frames[lo] : frames[hi];
}
