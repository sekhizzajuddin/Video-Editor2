/**
 * blendCompositor.ts
 *
 * Correct compositing maths for per-clip blend modes.
 *
 * The bug this replaces
 * --------------------
 * The renderer used to emulate "partial blend intensity" by drawing the clip
 * TWICE: once with `source-over` at alpha `(1 - k)` and once with the blend mode
 * at alpha `k`. That is mathematically wrong, because the second draw does not
 * see the original backdrop — it sees a backdrop that already contains the first
 * (normal) draw. Blend modes are functions of the backdrop, so the result is a
 * double-composite:
 *
 *     WRONG:  blend( backdrop + normal·(1-k) , content )·k  +  ...
 *     RIGHT:  lerp( normal(backdrop, content), blend(backdrop, content), k )
 *
 * For `multiply` / `darken` the clip visibly darkens twice; for `difference`,
 * `exclusion` and `color-burn` it produces the harsh banding and colour inversion
 * artefacts reported as "glitch at rendering". It also double-pays the cost of
 * every draw, and with an alpha-masked source (AI background removal) the two
 * passes accumulate along the matte edge, producing a bright halo.
 *
 * The maths
 * ---------
 * Canvas2D already implements the correct formula for a FULL-strength blend. Per
 * the W3C compositing spec, with an opaque backdrop (αb = 1) and source alpha αs:
 *
 *     co = αs·B(Cb, Cs) + (1 - αs)·Cb
 *
 * so a single draw at `globalAlpha = k` with the blend mode set already yields
 * `lerp(backdrop, blend(backdrop, content), k)`.
 *
 * That is the right answer when the user wants the layer to fade toward the
 * *backdrop*. But this editor's slider means "mix between a NORMAL composite and
 * a BLENDED composite" — at 0% the clip must still be visible, just un-blended.
 * That needs a genuine three-way lerp, which requires one scratch buffer holding
 * the blended result. `resolveBlendPlan` decides which of those paths to take, and
 * deliberately picks the cheap single-draw path whenever it is exactly equivalent.
 */

export type BlendPathKind =
  /** Plain `source-over`; one draw, no blend mode. */
  | 'normal'
  /** Blend mode at full strength; one draw, native Canvas2D blending. */
  | 'blend'
  /** Mix of normal and blended results; needs a scratch backdrop copy. */
  | 'lerp';

export interface BlendPlan {
  kind: BlendPathKind;
  /** Composite operation for the main draw. */
  mode: GlobalCompositeOperation;
  /** globalAlpha for the main draw. */
  alpha: number;
  /**
   * For `lerp`: how much of the BLENDED result to mix in (0..1). The blended
   * result is produced in a scratch buffer and drawn over the normal result at
   * this alpha.
   */
  mix: number;
  /** True when the caller must allocate/populate the scratch backdrop buffer. */
  needsScratch: boolean;
}

/** Blend modes that are pure no-ops and can always take the cheap path. */
const PASSTHROUGH: ReadonlySet<string> = new Set(['source-over', '', 'normal']);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Decide how to composite a clip given its blend mode, blend intensity and
 * overall opacity.
 *
 * @param blendMode     Canvas composite operation from the clip transform.
 * @param blendIntensity 0..100 — how strongly the blend mode applies.
 * @param opacity       0..1 — the clip's own alpha (opacity x any multiplier).
 */
export function resolveBlendPlan(
  blendMode: string | undefined,
  blendIntensity: number | undefined,
  opacity: number
): BlendPlan {
  const alpha = clamp01(opacity);
  const mode = (blendMode || 'source-over') as GlobalCompositeOperation;
  // Intensity is a percentage; missing means "fully applied".
  const rawIntensity = typeof blendIntensity === 'number' && Number.isFinite(blendIntensity)
    ? blendIntensity
    : 100;
  const mix = clamp01(rawIntensity / 100);

  // Nothing to draw at all.
  if (alpha <= 0) {
    return { kind: 'normal', mode: 'source-over', alpha: 0, mix: 0, needsScratch: false };
  }

  // No blend mode selected -> ordinary draw. Intensity is meaningless here, and
  // must NOT be allowed to fade the clip (that is what the Opacity control is
  // for); treating it as alpha was part of the old confusing behaviour.
  if (PASSTHROUGH.has(mode)) {
    return { kind: 'normal', mode: 'source-over', alpha, mix: 0, needsScratch: false };
  }

  // Full strength -> native Canvas2D blending in a single draw. This is both the
  // fastest and the most accurate path, so we take it whenever we can.
  if (mix >= 0.999) {
    return { kind: 'blend', mode, alpha, mix: 1, needsScratch: false };
  }

  // Zero strength -> exactly a normal composite.
  if (mix <= 0.001) {
    return { kind: 'normal', mode: 'source-over', alpha, mix: 0, needsScratch: false };
  }

  // Partial strength -> genuine lerp between the normal and blended results.
  // The caller draws the content normally, builds the blended result in a scratch
  // copy of the backdrop, then draws that scratch over the target at `mix`.
  return { kind: 'lerp', mode, alpha, mix, needsScratch: true };
}

/**
 * Blend modes whose result depends on the backdrop. Used to decide whether a
 * clip can be cached/short-circuited independently of what is beneath it.
 */
export function isBackdropDependent(blendMode: string | undefined): boolean {
  return !PASSTHROUGH.has(blendMode || 'source-over');
}
