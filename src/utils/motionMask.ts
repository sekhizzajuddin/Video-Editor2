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
  /**
   * Cluster centres. Each carries its own LUMA as well as chroma: for a
   * desaturated subject (cream, white, grey, black) brightness is the only thing
   * that distinguishes it from the background, so it has to be part of the match
   * rather than a loose gate.
   */
  centers: Array<{ cb: number; cr: number; y: number; weight: number }>;
  /** Chroma radius that counted as "matching" when the signature was built. */
  tolerance: number;
  /** Luma range of the sample, widened a little for shading headroom. */
  lumaMin: number;
  lumaMax: number;
  /**
   * How strongly luma counts towards the match, relative to chroma.
   *
   * Derived from how saturated the painted colour is. A vivid colour (a red
   * glove) is identified by its hue alone and should tolerate large brightness
   * swings, so this is near 0. A near-neutral colour (an ivory gown) has almost
   * no hue to go on, so brightness carries the signal and this rises above 1.
   */
  lumaWeight: number;

  // ── Spatial footprint ─────────────────────────────────────────────────────
  /**
   * Radius of the painted stroke itself, in analysis pixels.
   *
   * This is what stops "paint the sleeve" becoming "select the whole gown". A
   * sleeve and a skirt are the same cloth — identical chroma, identical luma,
   * and physically connected — so NO colour metric can separate them. The only
   * thing that distinguishes the part the user pointed at is how far it extends,
   * so we record the intended extent and refuse to grow far beyond it.
   */
  patchRadius: number;
  /** Area the user actually painted, in analysis pixels. Drives scale tracking. */
  patchArea: number;

  // ── Texture footprint ─────────────────────────────────────────────────────
  /**
   * Mean local luma contrast of the painted pixels — a cheap texture descriptor.
   *
   * Two surfaces can share a colour and still look nothing alike: gold embroidery
   * is busy and high-contrast, the plain cloth beside it is smooth. Comparing
   * local detail separates them where colour cannot. It is a coarse descriptor,
   * not a true feature vector, but it is stable under scale changes and costs
   * one pass over the frame.
   */
  textureMean: number;
  /** Spread of that contrast, used to size the acceptance window. */
  textureStd: number;
  /** How strongly texture counts. 0 disables it (e.g. a featureless surface). */
  textureWeight: number;
  /** Chroma saturation of the sample — distance from neutral. Diagnostic. */
  saturation: number;
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
  /** Number of selected pixels. Drives the per-frame scale estimate. */
  area: number;
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
// Texture
// ---------------------------------------------------------------------------

/**
 * Local luma contrast at one pixel: the mean absolute difference from its
 * 4-neighbours, sampled at `gap` pixels out.
 *
 * This is the "digital footprint" beyond colour. Embroidery, hair and fabric
 * weave produce high values; skin, plain cloth, sky and concrete produce low
 * ones. Sampling at a gap rather than adjacent pixels makes it far less
 * sensitive to compression noise, and keeps it meaningful after the frame has
 * been downscaled for analysis.
 */
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
  const samples: Array<{ cb: number; cr: number; y: number }> = [];
  let lumaMin = 255;
  let lumaMax = 0;

  // Subsample: a few thousand pixels describe a colour distribution just as well
  // as a hundred thousand, and keeps signature-building instant.
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 8000));

  // Texture and spatial extent are measured over the painted pixels too.
  const textures: number[] = [];
  let paintedCount = 0;
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < total; i += step) {
    if (!strokeMask[i]) continue;
    const p = i * 4;
    if (pixels[p + 3] < 8) continue; // ignore transparent
    const { y, cb, cr } = rgbToYCbCr(pixels[p], pixels[p + 1], pixels[p + 2]);
    samples.push({ cb, cr, y });
    if (y < lumaMin) lumaMin = y;
    if (y > lumaMax) lumaMax = y;
    textures.push(localContrast(pixels, width, height, i % width, (i / width) | 0));
  }

  // Full-resolution pass for extent: the subsampled loop above is fine for a
  // colour distribution but would badly under-count area.
  for (let i = 0; i < total; i++) {
    if (!strokeMask[i]) continue;
    paintedCount++;
    sumX += i % width;
    sumY += (i / width) | 0;
  }

  if (samples.length < 4) return null;

  const k = Math.max(1, Math.min(maxClusters, Math.floor(samples.length / 8) || 1));
  const centers = kMeansChroma(samples, k);
  if (centers.length === 0) return null;

  // ── How much can chroma alone be trusted? ────────────────────────────────
  //
  // This is the crux of why painting used to select the background.
  //
  // Matching was chroma-ONLY, with luma as a +/-60 gate. Chroma is a great
  // descriptor for a saturated subject, but most real footage is full of
  // near-neutral surfaces — a cream gown, a white hijab, grey concrete, an
  // overcast sky — and near-neutral colours all sit in a tight cluster around
  // (128, 128). Measured on the user's own frame, a cream gown signature at
  // tolerance 22 also matched concrete, sky and skin: everything except the
  // couple of genuinely coloured objects. The stroke was fine; the metric could
  // not tell those surfaces apart, because in chroma terms they are the same.
  //
  // So weight luma by how little hue there is to go on. A vivid colour keeps its
  // brightness tolerance (a red glove passing through shade is still red); a
  // desaturated one leans on brightness, which is the only thing separating a
  // bright ivory gown from mid-grey concrete.
  let satSum = 0;
  let satWeight = 0;
  for (const c of centers) {
    satSum += Math.hypot(c.cb - 128, c.cr - 128) * c.weight;
    satWeight += c.weight;
  }
  const saturation = satWeight > 0 ? satSum / satWeight : 0;

  const SAT_VIVID = 30;   // above this, hue identifies the subject on its own
  const SAT_NEUTRAL = 8;  // below this, there is essentially no hue information
  const W_VIVID = 0.1;
  const W_NEUTRAL = 1.6;
  let lumaWeight: number;
  if (saturation >= SAT_VIVID) lumaWeight = W_VIVID;
  else if (saturation <= SAT_NEUTRAL) lumaWeight = W_NEUTRAL;
  else {
    const t = (saturation - SAT_NEUTRAL) / (SAT_VIVID - SAT_NEUTRAL);
    lumaWeight = W_NEUTRAL + t * (W_VIVID - W_NEUTRAL);
  }

  // ── Spatial footprint ────────────────────────────────────────────────────
  // Radius of a circle with the same area as the stroke. Using area rather than
  // the stroke's bounding box makes this stable for a squiggle as well as a dab.
  const patchArea = Math.max(1, paintedCount);
  const patchRadius = Math.max(3, Math.sqrt(patchArea / Math.PI));

  // ── Texture footprint ────────────────────────────────────────────────────
  let textureMean = 0;
  let textureStd = 0;
  if (textures.length > 0) {
    textureMean = textures.reduce((a, b) => a + b, 0) / textures.length;
    const varSum = textures.reduce((a, b) => a + (b - textureMean) ** 2, 0);
    textureStd = Math.sqrt(varSum / textures.length);
  }

  // Only trust texture when the painted area HAS a distinctive amount of it.
  // On a smooth surface every candidate scores near zero, so the comparison
  // carries no information and would only add noise — disable it there.
  const TEXTURE_MIN_SIGNAL = 4;
  const textureWeight = textureMean >= TEXTURE_MIN_SIGNAL ? 0.6 : 0;

  return {
    centers,
    tolerance,
    lumaWeight,
    saturation,
    patchRadius,
    patchArea,
    textureMean,
    textureStd,
    textureWeight,
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
  samples: Array<{ cb: number; cr: number; y: number }>,
  k: number,
  iterations: number = 8
): Array<{ cb: number; cr: number; y: number; weight: number }> {
  if (samples.length === 0) return [];

  const centers: Array<{ cb: number; cr: number; y: number; weight: number }> = [];
  const stride = Math.max(1, Math.floor(samples.length / k));
  for (let i = 0; i < k; i++) {
    const s = samples[Math.min(samples.length - 1, i * stride)];
    centers.push({ cb: s.cb, cr: s.cr, y: s.y, weight: 0 });
  }

  // Cluster on chroma but CARRY the luma of each cluster, so a two-tone feature
  // (lit side + shadow side) records both brightness levels instead of collapsing
  // to one. Assignment stays chroma-driven: clustering on luma too would split a
  // single-coloured object into "bright bit" and "dark bit" and the tracker would
  // then only follow one of them.
  const LUMA_ASSIGN_W = 0.15;

  for (let iter = 0; iter < iterations; iter++) {
    const sums = centers.map(() => ({ cb: 0, cr: 0, y: 0, n: 0 }));

    for (const s of samples) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dcb = s.cb - centers[c].cb;
        const dcr = s.cr - centers[c].cr;
        const dy = (s.y - centers[c].y) * LUMA_ASSIGN_W;
        const d = dcb * dcb + dcr * dcr + dy * dy;
        if (d < bestD) { bestD = d; best = c; }
      }
      sums[best].cb += s.cb;
      sums[best].cr += s.cr;
      sums[best].y += s.y;
      sums[best].n++;
    }

    for (let c = 0; c < centers.length; c++) {
      if (sums[c].n > 0) {
        centers[c].cb = sums[c].cb / sums[c].n;
        centers[c].cr = sums[c].cr / sums[c].n;
        centers[c].y = sums[c].y / sums[c].n;
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

/**
 * Luma tolerance, in the same "1.0 = at the limit" units as chroma tolerance.
 *
 * Fixed rather than user-facing: the Colour Tolerance slider already scales the
 * chroma axis, and `lumaWeight` scales this one relative to it, so one control
 * is enough.
 */
const LUMA_TOLERANCE = 45;

/**
 * How closely a pixel matches the signature: 0 = no match, 1 = dead centre.
 *
 * Distance is measured in a normalised chroma+luma space:
 *
 *     d = sqrt( (dChroma / tolerance)^2 + lumaWeight * (dLuma / 45)^2 )
 *
 * and a pixel matches when d <= 1.
 *
 * The previous version used chroma distance ONLY, with luma as a wide +/-60
 * pass/fail gate. That works for saturated subjects but fails badly on the
 * near-neutral surfaces that dominate real footage: a cream gown, grey concrete
 * and an overcast sky are all within ~19 chroma units of each other, so at the
 * default tolerance of 22 they were indistinguishable and the "paint the person"
 * stroke happily selected the balcony and the sky as well. Folding luma in with a
 * saturation-derived weight restores the discrimination that chroma cannot
 * provide, without breaking the lighting-invariance that made chroma the right
 * primary axis in the first place.
 */
function scorePixel(sig: ColorSignature, r: number, g: number, b: number): number {
  const { y, cb, cr } = rgbToYCbCr(r, g, b);

  // Hard luma gate retained as a cheap early-out for wildly wrong pixels.
  if (y < sig.lumaMin || y > sig.lumaMax) return 0;

  const chromaTol = Math.max(1, sig.tolerance);
  // Older projects were saved before these fields existed; default to the
  // historical chroma-only behaviour rather than producing NaN.
  const wl = sig.lumaWeight ?? 0;

  let best = 0;
  for (const c of sig.centers) {
    const dcb = cb - c.cb;
    const dcr = cr - c.cr;
    const chromaN = Math.sqrt(dcb * dcb + dcr * dcr) / chromaTol;

    let d: number;
    if (wl > 0 && typeof c.y === 'number') {
      const lumaN = (y - c.y) / LUMA_TOLERANCE;
      d = Math.sqrt(chromaN * chromaN + wl * lumaN * lumaN);
    } else {
      d = chromaN;
    }

    if (d <= 1) {
      // Linear falloff to the boundary gives a soft, natural edge instead of a
      // hard binary cut that would alias badly.
      const sc = 1 - d;
      if (sc > best) best = sc;
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
  opts: {
    minScore?: number;
    searchRadius?: number;
    /**
     * Current size of the feature relative to when it was painted.
     *
     * The user's observation: a subject walking toward camera grows, so a patch
     * measured in fixed pixels is wrong everywhere except the frame it was
     * painted on. The tracker re-estimates this each frame from the measured
     * blob area and feeds it back, so the extent limit breathes with the
     * subject instead of clipping them up close or leaking when they recede.
     */
    scaleHint?: number;
    /** Set false to ignore the texture footprint (diagnostics/tests). */
    useTexture?: boolean;
    /**
     * How far the fill may spread, as a multiple of the painted radius.
     * Defaults to 2.2. Zero or negative disables the bound entirely.
     */
    spreadLimit?: number;
  } = {}
): MaskFrameResult {
  const n = width * height;
  const raw = new Uint8ClampedArray(n);
  const minScore = opts.minScore ?? 0.15;
  const scaleHint = opts.scaleHint && opts.scaleHint > 0 ? opts.scaleHint : 1;

  const useTexture =
    (opts.useTexture ?? true) && (sig.textureWeight ?? 0) > 0 && sig.textureMean > 0;
  // Acceptance window for local contrast. Widened by the sample's own spread so
  // a naturally varied surface is not penalised, and floored so it never becomes
  // so tight that nothing passes.
  const texTol = Math.max(6, (sig.textureStd ?? 0) * 1.5 + sig.textureMean * 0.9);

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
      let s = scorePixel(sig, pixels[p], pixels[p + 1], pixels[p + 2]);

      // Texture gate: reject a colour match whose local detail is nothing like
      // what was painted. This is what separates busy gold embroidery from the
      // plain cloth around it, which are close enough in colour to be
      // indistinguishable otherwise.
      if (s > 0 && useTexture) {
        const t = localContrast(pixels, width, height, x, y);
        const dt = Math.abs(t - sig.textureMean);
        if (dt > texTol) {
          s = 0;
        } else {
          // Soft penalty rather than a cliff, so the mask edge stays smooth.
          s *= 1 - (sig.textureWeight ?? 0) * (dt / texTol);
        }
      }

      if (s >= minScore) raw[i] = Math.round(s * 255);
    }
  }

  // ── Bound the fill to the painted footprint ──────────────────────────────
  // Scaled by the current subject size, with generous headroom (x2.2) so the
  // selection can follow a limb that swings or a garment that billows, while
  // still refusing to swallow an entire outfit.
  const EXTENT_HEADROOM = opts.spreadLimit ?? 2.2;
  const maxRadius =
    sig.patchRadius && sig.patchRadius > 0 && EXTENT_HEADROOM > 0
      ? sig.patchRadius * scaleHint * EXTENT_HEADROOM
      : undefined;

  const connected = seed
    ? keepConnectedBlob(raw, width, height, seed, maxRadius)
    : raw;

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
    area: count,
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
  seed: { x: number; y: number },
  /**
   * Hard limit on how far the fill may travel from the seed, in pixels.
   *
   * THIS is what stops "paint the sleeve" from becoming "select the whole
   * outfit". The sleeve and the skirt are one garment: same chroma, same luma,
   * physically connected. Colour can never separate them, so the fill has to be
   * told how big the thing the user pointed at actually was.
   *
   * Omitted = unbounded (the historical behaviour), used when no footprint is
   * known.
   */
  maxRadius?: number
): Uint8ClampedArray {
  const n = width * height;
  const out = new Uint8ClampedArray(n);
  const limit = maxRadius && maxRadius > 0 ? maxRadius : Infinity;
  const limitSq = limit === Infinity ? Infinity : limit * limit;

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

    // Only step to a neighbour that is still within the allowed extent. Testing
    // at push time (rather than pop) keeps the stack small on a big garment.
    const push = (t: number, tx: number, ty: number) => {
      if (seen[t] || raw[t] === 0) return;
      if (limitSq !== Infinity) {
        const dx = tx - seed.x;
        const dy = ty - seed.y;
        if (dx * dx + dy * dy > limitSq) return;
      }
      seen[t] = 1;
      stack[sp++] = t;
    };

    if (x > 0) push(idx - 1, x - 1, y);
    if (x < width - 1) push(idx + 1, x + 1, y);
    if (y > 0) push(idx - width, x, y - 1);
    if (y < height - 1) push(idx + width, x, y + 1);
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
