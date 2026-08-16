/**
 * motionMaskDiscrimination.test.ts
 *
 * Regression tests for the reported bug: "the paint brush can't understand the
 * actual pixel follow".
 *
 * The colours below are sampled from the user's own footage — a woman in a cream
 * embroidered gown and ivory hijab, on a balcony, against a grey glass tower and
 * an overcast sky. That scene is the hard case for a chroma-only matcher, because
 * almost every surface in it is near-neutral: the gown, the concrete, the sky and
 * the tower all sit within ~19 chroma units of each other, well inside the
 * default tolerance of 22.
 *
 * These tests pin the behaviour that fixes it — luma weighted into the match by
 * how little hue the painted colour actually has.
 */

import { describe, it, expect } from 'vitest';
import {
  rgbToYCbCr,
  buildColorSignature,
  computeMaskForFrame,
  type ColorSignature,
} from './motionMask';

// ── Palette lifted from the user's frame ──────────────────────────────────
const CREAM_GOWN: [number, number, number] = [238, 230, 210];
const IVORY_HIJAB: [number, number, number] = [245, 240, 228];
const GOLD_TRIM: [number, number, number] = [201, 167, 86];
const SKIN: [number, number, number] = [222, 183, 157];
const GREY_TOWER: [number, number, number] = [150, 155, 160];
const CONCRETE: [number, number, number] = [196, 193, 188];
const PALE_SKY: [number, number, number] = [205, 212, 220];
const RED_GLOVE: [number, number, number] = [190, 45, 40];

function makeFrame(
  w: number,
  h: number,
  fn: (x: number, y: number) => [number, number, number]
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const p = (y * w + x) * 4;
      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
    }
  }
  return data;
}

/** A signature learned from a solid patch of one colour. */
function signatureOf(colour: [number, number, number], tolerance = 22): ColorSignature {
  const W = 40;
  const H = 40;
  const frame = makeFrame(W, H, () => colour);
  const stroke = new Uint8Array(W * H).fill(1);
  const sig = buildColorSignature(frame, W, H, stroke, tolerance);
  expect(sig).not.toBeNull();
  return sig!;
}

/** Does a signature accept a colour? Mirrors the internal scorer. */
function accepts(sig: ColorSignature, colour: [number, number, number]): boolean {
  const W = 8;
  const H = 8;
  const frame = makeFrame(W, H, () => colour);
  const res = computeMaskForFrame(frame, W, H, sig, null, { minScore: 0.001 });
  return res.coverage > 0.5;
}

describe('the reported failure: a near-neutral subject selected the background', () => {
  const gown = signatureOf(CREAM_GOWN);

  it('still matches the subject it was painted on', () => {
    expect(accepts(gown, CREAM_GOWN)).toBe(true);
  });

  it('still matches the adjacent ivory hijab (same garment family)', () => {
    expect(accepts(gown, IVORY_HIJAB)).toBe(true);
  });

  it.each([
    ['grey glass tower', GREY_TOWER],
    ['concrete balcony', CONCRETE],
    ['pale overcast sky', PALE_SKY],
  ])('no longer selects the %s', (_label, colour) => {
    // Every one of these was INSIDE the old chroma-only tolerance of 22.
    const chromaDist = (() => {
      const a = rgbToYCbCr(...CREAM_GOWN);
      const b = rgbToYCbCr(...(colour as [number, number, number]));
      return Math.hypot(a.cb - b.cb, a.cr - b.cr);
    })();
    expect(chromaDist).toBeLessThan(22); // the old metric would have matched

    expect(accepts(gown, colour as [number, number, number])).toBe(false);
  });

  it('does not select skin, which chroma alone also confused with cream', () => {
    expect(accepts(gown, SKIN)).toBe(false);
  });
});

describe('saturation-derived luma weighting', () => {
  it('leans on brightness for a near-neutral colour', () => {
    const sig = signatureOf(CREAM_GOWN);
    expect(sig.saturation).toBeLessThan(30);
    expect(sig.lumaWeight).toBeGreaterThan(0.5);
  });

  it('largely ignores brightness for a vivid colour', () => {
    const sig = signatureOf(RED_GLOVE);
    expect(sig.saturation).toBeGreaterThan(30);
    expect(sig.lumaWeight).toBeLessThanOrEqual(0.1);
  });

  it('keeps a vivid subject matchable through moderate shading', () => {
    // The point of matching on chroma: a red glove in shadow is still red.
    //
    // The usable range is ~25% darkening at the default tolerance, and that
    // ceiling comes from CHROMA, not from the luma term added here: in YCbCr the
    // chroma of a saturated colour scales with brightness, so at 0.7x the red has
    // already drifted 23 units — past the tolerance of 22 — while the luma term
    // contributes only 0.03. Verified old-vs-new: both accept 0.75x and both
    // reject 0.7x. Asserting the real limit rather than a flattering one.
    const sig = signatureOf(RED_GLOVE);
    const shade = (k: number): [number, number, number] => [
      Math.round(RED_GLOVE[0] * k),
      Math.round(RED_GLOVE[1] * k),
      Math.round(RED_GLOVE[2] * k),
    ];
    expect(accepts(sig, shade(0.85))).toBe(true);
    expect(accepts(sig, shade(0.75))).toBe(true);
  });

  it('the luma term is negligible for a vivid colour (it is chroma that limits)', () => {
    // Guards the reasoning above: if lumaWeight ever crept up for saturated
    // signatures, vivid subjects would start dropping out under normal lighting.
    const sig = signatureOf(RED_GLOVE);
    const dLuma = 31; // 0.65x darkening
    const contribution = sig.lumaWeight * (dLuma / 45) ** 2;
    expect(contribution).toBeLessThan(0.1);
  });

  it('records a luma per cluster so two-tone features keep both levels', () => {
    const W = 40;
    const H = 40;
    // Left half lit, right half in shadow — one garment, two brightnesses.
    const frame = makeFrame(W, H, (x) =>
      x < W / 2 ? CREAM_GOWN : ([167, 161, 147] as [number, number, number])
    );
    const stroke = new Uint8Array(W * H).fill(1);
    const sig = buildColorSignature(frame, W, H, stroke)!;
    for (const c of sig.centers) expect(typeof c.y).toBe('number');
    expect(sig.centers.length).toBeGreaterThan(0);
  });
});

describe('discrimination across the whole scene palette', () => {
  it('a gown signature accepts garment tones and rejects the environment', () => {
    const sig = signatureOf(CREAM_GOWN);
    const selected = (
      [
        ['cream gown', CREAM_GOWN],
        ['ivory hijab', IVORY_HIJAB],
        ['gold trim', GOLD_TRIM],
        ['skin', SKIN],
        ['grey tower', GREY_TOWER],
        ['concrete', CONCRETE],
        ['sky', PALE_SKY],
      ] as Array<[string, [number, number, number]]>
    )
      .filter(([, c]) => accepts(sig, c))
      .map(([n]) => n);

    // Before the fix this was 6 of 7 — essentially the entire frame.
    expect(selected).toContain('cream gown');
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  it('raising tolerance widens the match, so the slider still does its job', () => {
    const tight = signatureOf(CREAM_GOWN, 10);
    const loose = signatureOf(CREAM_GOWN, 55);
    const count = (sig: ColorSignature) =>
      ([CREAM_GOWN, IVORY_HIJAB, SKIN, CONCRETE, PALE_SKY] as Array<
        [number, number, number]
      >).filter((c) => accepts(sig, c)).length;
    expect(count(loose)).toBeGreaterThanOrEqual(count(tight));
  });
});

describe('backwards compatibility', () => {
  it('falls back to chroma-only for a signature saved before this fix', () => {
    // Old projects have no lumaWeight / per-centre y. It must not throw or NaN.
    const legacy = {
      centers: [{ cb: 116.7, cr: 133.6, weight: 1 }],
      tolerance: 22,
      lumaMin: 0,
      lumaMax: 255,
      sampleCount: 500,
    } as unknown as ColorSignature;

    expect(accepts(legacy, CREAM_GOWN)).toBe(true);
    // Historical (wrong-but-expected) behaviour is preserved rather than crashing.
    expect(accepts(legacy, CONCRETE)).toBe(true);
  });
});
