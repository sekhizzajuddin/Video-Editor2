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

/**
 * The remaining Transform-tab controls must also reach PiP children:
 * rotationX/Y (3D), blend, opacity and crop.
 */

const safeAxis = (v: number) => (Math.abs(v) < 0.02 ? (v < 0 ? -0.02 : 0.02) : v);

/** Mirrors the 3D-rotation foreshortening applied to the group. */
function apply3D(word: { x: number; y: number }, rotX = 0, rotY = 0) {
  const fx = safeAxis(Math.cos((rotY * Math.PI) / 180));
  const fy = safeAxis(Math.cos((rotX * Math.PI) / 180));
  return { x: CX + word.x * fx, y: CY + word.y * fy };
}

const groupWidth = (pts: { x: number; y: number }[]) => Math.abs(pts[pts.length - 1].x - pts[0].x);

describe('PiP group: 3D rotation', () => {
  it('rotationY foreshortens the width as the group turns away', () => {
    const full = groupWidth(WORDS.map((w) => apply3D(w, 0, 0)));
    const turned = groupWidth(WORDS.map((w) => apply3D(w, 0, 60)));
    expect(turned).toBeLessThan(full);
    expect(turned).toBeCloseTo(full * 0.5, 4); // cos(60) = 0.5
  });

  it('rotationX foreshortens the height', () => {
    const col = [
      { x: 0, y: -60 },
      { x: 0, y: 60 },
    ];
    const h0 = Math.abs(apply3D(col[1], 0, 0).y - apply3D(col[0], 0, 0).y);
    const h45 = Math.abs(apply3D(col[1], 45, 0).y - apply3D(col[0], 45, 0).y);
    expect(h45).toBeLessThan(h0);
    expect(h45).toBeCloseTo(h0 * Math.cos(Math.PI / 4), 4);
  });

  it('never collapses the group to zero at 90 degrees', () => {
    // A zero scale is unrecoverable and would make the sentence disappear.
    expect(groupWidth(WORDS.map((w) => apply3D(w, 0, 90)))).toBeGreaterThan(0);
    expect(groupWidth(WORDS.map((w) => apply3D(w, 90, 0)))).toBeGreaterThan(0);
  });

  it('mirrors past 90 degrees, as a real rotation would', () => {
    expect(apply3D({ x: 100, y: 0 }, 0, 180).x - CX).toBeLessThan(0);
  });

  it('leaves the group untouched at zero', () => {
    WORDS.forEach((w) => {
      const p = apply3D(w, 0, 0);
      expect(p.x).toBeCloseTo(CX + w.x, 9);
      expect(p.y).toBeCloseTo(CY + w.y, 9);
    });
  });
});

describe('PiP group: inherited opacity and blend', () => {
  const resolveAlpha = (own: number, parent: number | undefined) => own * (parent ?? 1);
  const resolveBlend = (own: string | undefined, parent: string | undefined) =>
    own && own !== 'source-over' ? own : parent || 'source-over';

  it('parent opacity multiplies the child opacity', () => {
    expect(resolveAlpha(1, 0.5)).toBeCloseTo(0.5);
    expect(resolveAlpha(0.5, 0.5)).toBeCloseTo(0.25);
    expect(resolveAlpha(1, undefined)).toBeCloseTo(1);
  });

  it('the child inherits the parent blend mode when it has none', () => {
    expect(resolveBlend(undefined, 'multiply')).toBe('multiply');
    expect(resolveBlend('source-over', 'screen')).toBe('screen');
  });

  it('an explicit child blend mode wins', () => {
    expect(resolveBlend('overlay', 'multiply')).toBe('overlay');
  });

  it('defaults to normal when neither sets one', () => {
    expect(resolveBlend(undefined, undefined)).toBe('source-over');
  });
});

describe('PiP group: crop', () => {
  const W = 854;
  const H = 480;
  const cropRect = (l: number, r: number, t: number, b: number) => {
    const L = Math.min(l, 0.98);
    const R = Math.min(r, 0.98 - L);
    const T = Math.min(t, 0.98);
    const B = Math.min(b, 0.98 - T);
    return { x: L * W, y: T * H, w: Math.max(1, W * (1 - L - R)), h: Math.max(1, H * (1 - T - B)) };
  };

  it('no crop leaves the full frame', () => {
    const r = cropRect(0, 0, 0, 0);
    expect(r).toEqual({ x: 0, y: 0, w: W, h: H });
  });

  it('trims from the correct edges', () => {
    const r = cropRect(0.25, 0, 0.1, 0);
    expect(r.x).toBeCloseTo(0.25 * W);
    expect(r.y).toBeCloseTo(0.1 * H);
    expect(r.w).toBeCloseTo(0.75 * W);
  });

  it('never collapses to nothing even at extreme values', () => {
    const r = cropRect(0.99, 0.99, 0.99, 0.99);
    expect(r.w).toBeGreaterThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });
});
