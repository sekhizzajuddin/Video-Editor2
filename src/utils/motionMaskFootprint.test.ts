/**
 * motionMaskFootprint.test.ts
 *
 * Regression tests for: "on select specific part, system apply on whole outfit".
 *
 * The insight being pinned here is that this is NOT a colour problem and cannot
 * be fixed with a better colour metric. A sleeve and a skirt are the same cloth:
 * identical chroma, identical luma, and physically connected, so an unbounded
 * flood fill walks from one straight into the other. The only thing that
 * distinguishes "the part I painted" is its SPATIAL EXTENT.
 *
 * Two further properties are tested:
 *   - extent must scale with the subject, because someone walking toward camera
 *     grows (a fixed pixel budget clips them up close and leaks when they recede);
 *   - texture ("digital footprint") separates surfaces that share a colour but
 *     not a surface quality, e.g. gold embroidery against the plain cloth beside it.
 */

import { describe, it, expect } from 'vitest';
import { buildColorSignature, computeMaskForFrame, type ColorSignature } from './motionMask';

const W = 120;
const H = 160;

const CLOTH: [number, number, number] = [238, 230, 210];
const BACKDROP: [number, number, number] = [90, 100, 115];

/** One connected garment on a contrasting backdrop. */
function garmentFrame(
  shade: (x: number, y: number) => [number, number, number] = () => CLOTH
): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const inGown = x > 35 && x < 85 && y > 20 && y < 150;
      const c = inGown ? shade(x, y) : BACKDROP;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
  }
  return d;
}

const GOWN_AREA = 49 * 129;

/** Paint a rectangular dab. */
function strokeRect(x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1;
  return m;
}

describe('painting one part of a garment does not select the whole garment', () => {
  const frame = garmentFrame();
  const stroke = strokeRect(44, 28, 60, 44); // a dab on the "sleeve"
  const sig = buildColorSignature(frame, W, H, stroke)!;
  const seed = { x: 52, y: 36 };

  it('records the painted extent on the signature', () => {
    expect(sig.patchArea).toBe(256);
    expect(sig.patchRadius).toBeGreaterThan(0);
    // Radius of an equal-area circle: sqrt(256/pi) ~= 9.
    expect(sig.patchRadius).toBeCloseTo(Math.sqrt(256 / Math.PI), 1);
  });

  it('selects the painted region, not the entire outfit', () => {
    const res = computeMaskForFrame(frame.slice(), W, H, sig, seed, {});
    // Was ~100% of the garment before the extent bound; now a local patch.
    expect(res.area).toBeLessThan(GOWN_AREA * 0.5);
    expect(res.area).toBeGreaterThan(sig.patchArea * 0.5);
  });

  it('still selects generously enough to cover the feature and some slack', () => {
    // Headroom matters: a limb swings and cloth billows, so the bound is 2.2x
    // the painted radius, not a tight clip around the stroke.
    const res = computeMaskForFrame(frame.slice(), W, H, sig, seed, {});
    expect(res.area).toBeGreaterThan(sig.patchArea);
  });

  it('an unbounded fill (no footprint) still takes the whole garment', () => {
    // Guards the diagnosis: with the extent bound removed the old behaviour
    // returns, proving extent is what fixes it rather than some other change.
    const legacy = { ...sig, patchRadius: 0 } as ColorSignature;
    const res = computeMaskForFrame(frame.slice(), W, H, legacy, seed, {});
    expect(res.area).toBeGreaterThan(GOWN_AREA * 0.9);
  });
});

describe('extent scales with subject distance', () => {
  const frame = garmentFrame();
  const sig = buildColorSignature(frame, W, H, strokeRect(44, 28, 60, 44))!;
  const seed = { x: 52, y: 36 };

  it('selects more when the subject is closer to camera', () => {
    const far = computeMaskForFrame(frame.slice(), W, H, sig, seed, { scaleHint: 0.6 });
    const near = computeMaskForFrame(frame.slice(), W, H, sig, seed, { scaleHint: 1.8 });
    expect(near.area).toBeGreaterThan(far.area);
  });

  it('a larger scale hint never selects less', () => {
    let prev = 0;
    for (const s of [0.5, 0.8, 1.0, 1.4, 2.0]) {
      const r = computeMaskForFrame(frame.slice(), W, H, sig, seed, { scaleHint: s });
      expect(r.area).toBeGreaterThanOrEqual(prev);
      prev = r.area;
    }
  });

  it('even a large scale hint is still bounded — it cannot swallow the frame', () => {
    const r = computeMaskForFrame(frame.slice(), W, H, sig, seed, { scaleHint: 2.5 });
    expect(r.coverage).toBeLessThan(0.9);
  });

  it('reports the selected area so the tracker can re-estimate scale', () => {
    const r = computeMaskForFrame(frame.slice(), W, H, sig, seed, {});
    expect(r.area).toBeGreaterThan(0);
    expect(r.area).toBe(Math.round(r.coverage * W * H));
  });
});

describe('texture footprint separates same-coloured surfaces', () => {
  /** Left half of the gown is plain; right half is finely patterned. */
  const patterned = garmentFrame((x, y) => {
    if (x < 60) return CLOTH;
    const on = (x + y) % 3 === 0;
    return on ? [150, 120, 60] : CLOTH;
  });

  it('measures higher texture on a patterned area than a plain one', () => {
    const plain = buildColorSignature(patterned, W, H, strokeRect(40, 60, 56, 76))!;
    const busy = buildColorSignature(patterned, W, H, strokeRect(64, 60, 80, 76))!;
    expect(busy.textureMean).toBeGreaterThan(plain.textureMean);
  });

  it('disables the texture term on a smooth surface, where it carries no signal', () => {
    const plain = buildColorSignature(garmentFrame(), W, H, strokeRect(44, 60, 60, 76))!;
    expect(plain.textureMean).toBeLessThan(4);
    expect(plain.textureWeight).toBe(0);
  });

  it('enables it when the painted area genuinely has detail', () => {
    const busy = buildColorSignature(patterned, W, H, strokeRect(64, 60, 80, 76))!;
    expect(busy.textureWeight).toBeGreaterThan(0);
  });

  it('texture can be switched off without changing the colour result', () => {
    const busy = buildColorSignature(patterned, W, H, strokeRect(64, 60, 80, 76))!;
    const seed = { x: 72, y: 68 };
    const withTex = computeMaskForFrame(patterned.slice(), W, H, busy, seed, {});
    const noTex = computeMaskForFrame(patterned.slice(), W, H, busy, seed, { useTexture: false });
    // Texture only ever narrows the match.
    expect(withTex.area).toBeLessThanOrEqual(noTex.area);
  });
});

describe('robustness', () => {
  it('is deterministic — same stroke, same signature, same mask', () => {
    const frame = garmentFrame();
    const stroke = strokeRect(44, 28, 60, 44);
    const a = buildColorSignature(frame, W, H, stroke)!;
    const b = buildColorSignature(frame, W, H, stroke)!;
    expect(a).toEqual(b);
    const seed = { x: 52, y: 36 };
    expect(computeMaskForFrame(frame.slice(), W, H, a, seed, {}).area).toBe(
      computeMaskForFrame(frame.slice(), W, H, b, seed, {}).area
    );
  });

  it('a signature saved before footprints existed still works (unbounded)', () => {
    const frame = garmentFrame();
    const sig = buildColorSignature(frame, W, H, strokeRect(44, 28, 60, 44))!;
    const legacy = {
      centers: sig.centers,
      tolerance: sig.tolerance,
      lumaMin: sig.lumaMin,
      lumaMax: sig.lumaMax,
      sampleCount: sig.sampleCount,
    } as unknown as ColorSignature;
    const r = computeMaskForFrame(frame.slice(), W, H, legacy, { x: 52, y: 36 }, {});
    expect(Number.isFinite(r.area)).toBe(true);
    expect(r.area).toBeGreaterThan(0);
  });

  it('a stroke that matches nothing on a later frame yields an empty mask, not a crash', () => {
    const sig = buildColorSignature(garmentFrame(), W, H, strokeRect(44, 28, 60, 44))!;
    const blank = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const p = i * 4;
      blank[p] = 10; blank[p + 1] = 10; blank[p + 2] = 10; blank[p + 3] = 255;
    }
    const r = computeMaskForFrame(blank, W, H, sig, { x: 52, y: 36 }, {});
    expect(r.area).toBe(0);
    expect(r.centroid).toBeNull();
  });
});
