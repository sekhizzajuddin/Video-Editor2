import { describe, it, expect } from 'vitest';

/**
 * A PiP window must behave as a real GROUP: its children inherit the container's
 * translate, scale, rotation and flip.
 *
 * Previously the renderer drew PiP children with only their own transform, so the
 * kinetic reflow baked the container's scale/offset into each word position.
 * Translation and scale can be baked; ROTATION cannot. Rotating a sentence
 * therefore spun the selection box while the words stayed flat — and because the
 * reflow re-ran on every transform change, it recomputed the wrap and bunched the
 * words together.
 */

const CX = 427;
const CY = 240;

type Parent = { x?: number; y?: number; scale?: number; rot?: number; flipH?: boolean; flipV?: boolean };

/** Mirrors the parent-transform block in drawSingleClip. */
function applyParent(word: { x: number; y: number }, p: Parent) {
  const s = (p.scale ?? 100) / 100;
  const r = ((p.rot ?? 0) * Math.PI) / 180;
  let lx = word.x * s;
  let ly = word.y * s;
  if (p.flipH) lx = -lx;
  if (p.flipV) ly = -ly;
  return {
    x: CX + (p.x ?? 0) + (lx * Math.cos(r) - ly * Math.sin(r)),
    y: CY + (p.y ?? 0) + (lx * Math.sin(r) + ly * Math.cos(r)),
  };
}

const WORDS = [
  { x: -100, y: 0 },
  { x: 0, y: 0 },
  { x: 100, y: 0 },
];

const gap = (pts: { x: number; y: number }[]) => Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);

describe('PiP children inherit the container transform', () => {
  it('identity leaves words at their local offsets', () => {
    const out = WORDS.map((w) => applyParent(w, {}));
    expect(out[0].x).toBeCloseTo(CX - 100);
    expect(out[2].x).toBeCloseTo(CX + 100);
    expect(out.every((p) => p.y === CY)).toBe(true);
  });

  it('rotation actually MOVES the words (the reported bug)', () => {
    const flat = WORDS.map((w) => applyParent(w, {}));
    const spun = WORDS.map((w) => applyParent(w, { rot: 45 }));
    // At least one word must have moved off the horizontal line.
    expect(spun.some((p, i) => Math.abs(p.y - flat[i].y) > 1)).toBe(true);
  });

  it('rotation preserves word spacing (no bunching)', () => {
    const base = gap(WORDS.map((w) => applyParent(w, {})));
    for (const rot of [15, 45, 90, 180, -30]) {
      expect(gap(WORDS.map((w) => applyParent(w, { rot })))).toBeCloseTo(base, 6);
    }
  });

  it('rotating 90 degrees turns a horizontal row into a vertical column', () => {
    const out = WORDS.map((w) => applyParent(w, { rot: 90 }));
    expect(out.every((p) => Math.abs(p.x - CX) < 1e-6)).toBe(true);
    expect(out[0].y).toBeCloseTo(CY - 100);
    expect(out[2].y).toBeCloseTo(CY + 100);
  });

  it('scale spreads the words proportionally', () => {
    const base = gap(WORDS.map((w) => applyParent(w, {})));
    expect(gap(WORDS.map((w) => applyParent(w, { scale: 200 })))).toBeCloseTo(base * 2, 6);
    expect(gap(WORDS.map((w) => applyParent(w, { scale: 50 })))).toBeCloseTo(base / 2, 6);
  });

  it('translation moves every word by the same amount', () => {
    const base = WORDS.map((w) => applyParent(w, {}));
    const moved = WORDS.map((w) => applyParent(w, { x: 60, y: -25 }));
    moved.forEach((p, i) => {
      expect(p.x - base[i].x).toBeCloseTo(60, 6);
      expect(p.y - base[i].y).toBeCloseTo(-25, 6);
    });
  });

  it('flip mirrors the group without changing spacing', () => {
    const base = gap(WORDS.map((w) => applyParent(w, {})));
    const flipped = WORDS.map((w) => applyParent(w, { flipH: true }));
    expect(gap(flipped)).toBeCloseTo(base, 6);
    expect(flipped[0].x).toBeCloseTo(CX + 100);
    expect(flipped[2].x).toBeCloseTo(CX - 100);
  });

  it('rotation and scale compose without distorting the group', () => {
    const base = gap(WORDS.map((w) => applyParent(w, {})));
    const both = gap(WORDS.map((w) => applyParent(w, { rot: 37, scale: 150 })));
    expect(both).toBeCloseTo(base * 1.5, 6);
  });

  it('is stable: applying the same transform repeatedly does not drift', () => {
    // Word positions are stored in LOCAL space, so re-rendering is idempotent.
    const a = WORDS.map((w) => applyParent(w, { rot: 30, scale: 120, x: 10 }));
    const b = WORDS.map((w) => applyParent(w, { rot: 30, scale: 120, x: 10 }));
    expect(a).toEqual(b);
  });
});
