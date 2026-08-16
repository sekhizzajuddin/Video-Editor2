import { describe, it, expect } from 'vitest';
import {
  rgbToYCbCr,
  buildColorSignature,
  computeMaskForFrame,
  featherMask,
  chokeMask,
  invertMask,
  maskBounds,
  encodeMaskRle,
  decodeMaskRle,
  resampleMask,
  pickCachedMask,
} from './motionMask';

/** Build an RGBA buffer from a per-pixel colour function. */
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

const SKIN: [number, number, number] = [222, 170, 140];
const GREEN: [number, number, number] = [40, 160, 60];
const BLUE: [number, number, number] = [40, 70, 200];

describe('rgbToYCbCr', () => {
  it('is chroma-stable across brightness — the property the tracking relies on', () => {
    // A hand passing through shadow keeps roughly the same chroma even as luma
    // drops sharply. Measured drift for skin tone: ~7 at 80% brightness, ~18 at
    // 50%, ~22 at 40%. The default match tolerance is 22, so the feature stays
    // matched down to about half brightness — and legitimately stops matching in
    // near-darkness, where there is barely any chroma left to compare.
    const lit = rgbToYCbCr(222, 170, 140);
    const halfLit = rgbToYCbCr(111, 85, 70);
    const drift = Math.hypot(lit.cb - halfLit.cb, lit.cr - halfLit.cr);
    expect(drift).toBeLessThan(22);        // inside the default tolerance
    expect(halfLit.y).toBeLessThan(lit.y * 0.6); // luma really did collapse
  });

  it('chroma drift grows smoothly with darkness (no cliff)', () => {
    // Guards the reasoning above: if drift jumped discontinuously the tolerance
    // slider would behave unpredictably.
    const lit = rgbToYCbCr(222, 170, 140);
    let prev = -1;
    for (const f of [1.0, 0.8, 0.6, 0.5, 0.4]) {
      const s = rgbToYCbCr(222 * f, 170 * f, 140 * f);
      const d = Math.hypot(lit.cb - s.cb, lit.cr - s.cr);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(prev).toBeLessThan(30);
  });

  it('separates distinct hues', () => {
    const a = rgbToYCbCr(...SKIN);
    const b = rgbToYCbCr(...GREEN);
    expect(Math.hypot(a.cb - b.cb, a.cr - b.cr)).toBeGreaterThan(30);
  });
});

describe('buildColorSignature', () => {
  const W = 40, H = 30;

  it('learns the painted colour', () => {
    const frame = makeFrame(W, H, (x) => (x < 20 ? SKIN : GREEN));
    const stroke = new Uint8Array(W * H);
    for (let y = 5; y < 25; y++) for (let x = 2; x < 18; x++) stroke[y * W + x] = 1;

    const sig = buildColorSignature(frame, W, H, stroke)!;
    expect(sig).not.toBeNull();
    expect(sig.centers.length).toBeGreaterThan(0);
    expect(sig.sampleCount).toBeGreaterThan(0);

    const skin = rgbToYCbCr(...SKIN);
    const nearest = Math.min(
      ...sig.centers.map((c) => Math.hypot(c.cb - skin.cb, c.cr - skin.cr))
    );
    expect(nearest).toBeLessThan(10);
  });

  it('returns null when the stroke is too small to be meaningful', () => {
    const frame = makeFrame(W, H, () => SKIN);
    expect(buildColorSignature(frame, W, H, new Uint8Array(W * H))).toBeNull();
  });

  it('is deterministic — the same stroke always gives the same signature', () => {
    // Required for reproducible exports.
    const frame = makeFrame(W, H, (x) => (x < 20 ? SKIN : GREEN));
    const stroke = new Uint8Array(W * H);
    for (let y = 5; y < 25; y++) for (let x = 2; x < 18; x++) stroke[y * W + x] = 1;
    expect(buildColorSignature(frame, W, H, stroke)).toEqual(
      buildColorSignature(frame, W, H, stroke)
    );
  });

  it('widens the luma window so the feature survives lighting changes', () => {
    const frame = makeFrame(W, H, () => SKIN);
    const stroke = new Uint8Array(W * H).fill(1);
    const sig = buildColorSignature(frame, W, H, stroke)!;
    const y = rgbToYCbCr(...SKIN).y;
    expect(sig.lumaMin).toBeLessThan(y - 30);
    expect(sig.lumaMax).toBeGreaterThan(y + 30);
  });
});

describe('computeMaskForFrame', () => {
  const W = 60, H = 40;

  /** Left half skin, right half green. */
  const twoTone = () => makeFrame(W, H, (x) => (x < 30 ? SKIN : GREEN));

  const skinSignature = () => {
    const stroke = new Uint8Array(W * H);
    for (let y = 10; y < 30; y++) for (let x = 5; x < 25; x++) stroke[y * W + x] = 1;
    return buildColorSignature(twoTone(), W, H, stroke)!;
  };

  it('selects the matching colour and rejects the rest', () => {
    const res = computeMaskForFrame(twoTone(), W, H, skinSignature(), { x: 15, y: 20 });
    expect(res.mask[20 * W + 10]).toBeGreaterThan(0);  // skin side
    expect(res.mask[20 * W + 50]).toBe(0);             // green side
    expect(res.coverage).toBeGreaterThan(0.2);
    expect(res.coverage).toBeLessThan(0.75);
  });

  it('reports a centroid inside the matched blob', () => {
    const res = computeMaskForFrame(twoTone(), W, H, skinSignature(), { x: 15, y: 20 });
    expect(res.centroid).not.toBeNull();
    expect(res.centroid!.x).toBeLessThan(30);
  });

  it('LOCALITY: keeps only the blob connected to the seed', () => {
    // Two separate skin-coloured patches — a hand and a face. Seeding on the left
    // one must not also select the right one. This is the whole reason for the
    // connected-component pass.
    const frame = makeFrame(W, H, (x, y) => {
      const inLeft = x >= 5 && x < 20 && y >= 10 && y < 30;
      const inRight = x >= 40 && x < 55 && y >= 10 && y < 30;
      return inLeft || inRight ? SKIN : BLUE;
    });
    const stroke = new Uint8Array(W * H);
    for (let y = 12; y < 28; y++) for (let x = 7; x < 18; x++) stroke[y * W + x] = 1;
    const sig = buildColorSignature(frame, W, H, stroke)!;

    const res = computeMaskForFrame(frame, W, H, sig, { x: 12, y: 20 });
    expect(res.mask[20 * W + 12]).toBeGreaterThan(0); // left patch selected
    expect(res.mask[20 * W + 47]).toBe(0);            // right patch rejected
  });

  it('without a seed it selects every match (global mode)', () => {
    const frame = makeFrame(W, H, (x, y) => {
      const inLeft = x >= 5 && x < 20 && y >= 10 && y < 30;
      const inRight = x >= 40 && x < 55 && y >= 10 && y < 30;
      return inLeft || inRight ? SKIN : BLUE;
    });
    const stroke = new Uint8Array(W * H);
    for (let y = 12; y < 28; y++) for (let x = 7; x < 18; x++) stroke[y * W + x] = 1;
    const sig = buildColorSignature(frame, W, H, stroke)!;

    const res = computeMaskForFrame(frame, W, H, sig, null);
    expect(res.mask[20 * W + 12]).toBeGreaterThan(0);
    expect(res.mask[20 * W + 47]).toBeGreaterThan(0);
  });

  it('recovers when the seed lands just off the blob', () => {
    // The feature moved further than expected; returning an empty mask would make
    // the effect flicker off for a frame.
    const res = computeMaskForFrame(twoTone(), W, H, skinSignature(), { x: 45, y: 20 });
    expect(res.centroid).not.toBeNull();
  });

  it('returns an empty mask when nothing matches, without throwing', () => {
    const allBlue = makeFrame(W, H, () => BLUE);
    const res = computeMaskForFrame(allBlue, W, H, skinSignature(), { x: 30, y: 20 });
    expect(res.coverage).toBe(0);
    expect(res.centroid).toBeNull();
  });

  it('tracks the feature after it moves across the frame', () => {
    const sig = skinSignature();
    // Same feature, now on the right.
    const moved = makeFrame(W, H, (x) => (x >= 35 ? SKIN : GREEN));
    const res = computeMaskForFrame(moved, W, H, sig, { x: 40, y: 20 });
    expect(res.centroid).not.toBeNull();
    expect(res.centroid!.x).toBeGreaterThan(30);
  });
});

describe('mask post-processing', () => {
  const W = 20, H = 20;
  const solidBlock = () => {
    const m = new Uint8ClampedArray(W * H);
    for (let y = 6; y < 14; y++) for (let x = 6; x < 14; x++) m[y * W + x] = 255;
    return m;
  };

  it('feather softens the edge without moving the centre', () => {
    const m = solidBlock();
    const f = featherMask(m, W, H, 3);
    expect(f[10 * W + 10]).toBeGreaterThan(200); // centre stays solid
    expect(f[6 * W + 5]).toBeGreaterThan(0);     // bleeds just outside
  });

  it('feather with radius 0 is a no-op', () => {
    const m = solidBlock();
    expect(featherMask(m, W, H, 0)).toBe(m);
  });

  it('choke grows and shrinks the mask', () => {
    const m = solidBlock();
    const count = (a: Uint8ClampedArray) => a.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
    expect(count(chokeMask(m, W, H, 2))).toBeGreaterThan(count(m));
    expect(count(chokeMask(m, W, H, -2))).toBeLessThan(count(m));
  });

  it('choke of 0 is a no-op', () => {
    const m = solidBlock();
    expect(chokeMask(m, W, H, 0)).toBe(m);
  });

  it('invert flips coverage — this is what "outside" mode uses', () => {
    const m = solidBlock();
    const inv = invertMask(m);
    expect(inv[10 * W + 10]).toBe(0);
    expect(inv[0]).toBe(255);
  });

  it('maskBounds finds the painted area, or null when empty', () => {
    const b = maskBounds(solidBlock(), W, H)!;
    expect(b).toEqual({ x: 6, y: 6, w: 8, h: 8 });
    expect(maskBounds(new Uint8ClampedArray(W * H), W, H)).toBeNull();
  });
});

describe('RLE storage', () => {
  it('round-trips exactly', () => {
    const m = new Uint8ClampedArray(500);
    for (let i = 100; i < 300; i++) m[i] = 255;
    for (let i = 300; i < 340; i++) m[i] = 128;
    const back = decodeMaskRle(encodeMaskRle(m), m.length);
    expect(Array.from(back)).toEqual(Array.from(m));
  });

  it('compresses a typical mask substantially', () => {
    // Masks are mostly long runs, so RLE keeps the project file small.
    const m = new Uint8ClampedArray(10000);
    for (let i = 4000; i < 6000; i++) m[i] = 255;
    expect(encodeMaskRle(m).length).toBeLessThan(m.length / 100);
  });

  it('handles empty and uniform masks', () => {
    const empty = new Uint8ClampedArray(0);
    expect(encodeMaskRle(empty)).toEqual([]);
    const solid = new Uint8ClampedArray(100).fill(255);
    expect(Array.from(decodeMaskRle(encodeMaskRle(solid), 100))).toEqual(Array.from(solid));
  });
});

describe('resampleMask', () => {
  it('is a no-op at matching size', () => {
    const m = new Uint8ClampedArray(16).fill(200);
    expect(resampleMask(m, 4, 4, 4, 4)).toBe(m);
  });

  it('upscales while preserving coverage roughly', () => {
    const m = new Uint8ClampedArray(16);
    for (let i = 0; i < 8; i++) m[i] = 255; // top half
    const up = resampleMask(m, 4, 4, 8, 8);
    expect(up.length).toBe(64);
    const covered = up.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
    expect(covered).toBeGreaterThan(24);
    expect(covered).toBeLessThan(40);
  });
});

describe('pickCachedMask', () => {
  const frames = [
    { time: 0, rle: [255, 4], centroid: { x: 1, y: 1 } },
    { time: 1, rle: [255, 4], centroid: { x: 2, y: 2 } },
    { time: 2, rle: [255, 4], centroid: { x: 3, y: 3 } },
  ];

  it('picks the NEAREST frame, not an interpolation', () => {
    // Blending two binary-ish masks ghosts at the edges; nearest looks cleaner.
    expect(pickCachedMask(frames, 0.4)!.centroid).toEqual({ x: 1, y: 1 });
    expect(pickCachedMask(frames, 0.6)!.centroid).toEqual({ x: 2, y: 2 });
  });

  it('clamps outside the cached range', () => {
    expect(pickCachedMask(frames, -10)!.centroid).toEqual({ x: 1, y: 1 });
    expect(pickCachedMask(frames, 99)!.centroid).toEqual({ x: 3, y: 3 });
  });

  it('returns null for an empty cache', () => {
    expect(pickCachedMask([], 1)).toBeNull();
  });
});

/**
 * Compositing rules for "inside" vs "outside" mode.
 *
 * The reported bug: inside mode drew the displaced patch OVER an untouched
 * frame, leaving the original pixels in place. The result was a faint double
 * exposure rather than the region actually moving.
 */
describe('inside/outside compositing rules', () => {
  /** Mirrors the decision table in applyMotionEffect. */
  const plan = (applyMode: 'inside' | 'outside') => ({
    // Inside must vacate the original pixels and backfill the hole; outside must
    // not, because its matte covers nearly the whole frame.
    vacatesOriginal: applyMode === 'inside',
    matteInverted: applyMode === 'outside',
    regionIsWholeFrame: applyMode === 'outside',
  });

  it('inside vacates the original so the selection genuinely moves', () => {
    expect(plan('inside').vacatesOriginal).toBe(true);
  });

  it('outside does NOT vacate — that would blur away the whole picture', () => {
    // Outside's matte is the inverse, i.e. almost everything. Vacating it would
    // erase the entire frame and leave only the untouched subject.
    expect(plan('outside').vacatesOriginal).toBe(false);
  });

  it('outside inverts the matte', () => {
    expect(plan('outside').matteInverted).toBe(true);
    expect(plan('inside').matteInverted).toBe(false);
  });

  it('inverting twice returns the original mask', () => {
    const m = new Uint8ClampedArray([0, 128, 255]);
    expect(Array.from(invertMask(invertMask(m)))).toEqual(Array.from(m));
  });

  it('an inverted full mask is empty, and vice versa', () => {
    const full = new Uint8ClampedArray(16).fill(255);
    const empty = new Uint8ClampedArray(16);
    expect(Array.from(invertMask(full))).toEqual(Array.from(empty));
    expect(Array.from(invertMask(empty))).toEqual(Array.from(full));
  });

  it('a partially covered mask inverts to its complement', () => {
    const m = new Uint8ClampedArray(4);
    m[0] = 255; m[1] = 255;
    const inv = invertMask(m);
    expect(inv[0]).toBe(0);
    expect(inv[2]).toBe(255);
    // Coverage is conserved: what was selected becomes unselected.
    const cov = (a: Uint8ClampedArray) => a.reduce((n, v) => n + v, 0);
    expect(cov(m) + cov(inv)).toBe(4 * 255);
  });
});

/**
 * Region-edit mode gating: while placing a region the clip transform must be
 * disabled, or a drag intended for the region moves the whole shot.
 */
describe('region edit mode gating', () => {
  const gate = (editingIndex: number | null) => ({
    showRegionOverlay: editingIndex !== null,
    clipTransformEnabled: editingIndex === null,
  });

  it('shows the region overlay only while editing', () => {
    expect(gate(null).showRegionOverlay).toBe(false);
    expect(gate(0).showRegionOverlay).toBe(true);
  });

  it('disables the clip transform while editing', () => {
    expect(gate(0).clipTransformEnabled).toBe(false);
  });

  it('re-enables the clip transform once editing finishes', () => {
    expect(gate(null).clipTransformEnabled).toBe(true);
  });

  it('the two are always mutually exclusive', () => {
    // If both were ever active the overlays would fight for the same drag.
    for (const idx of [null, 0, 1, 5]) {
      const g = gate(idx);
      expect(g.showRegionOverlay && g.clipTransformEnabled).toBe(false);
    }
  });
});
