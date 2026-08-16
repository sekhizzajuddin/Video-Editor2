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

const FOCAL = 900;

/**
 * Mirrors the simulated-3D projection applied to each PiP child.
 * Children are drawn individually, so instead of one flat cos() squash each
 * child's offset is rotated in 3D and divided by its depth — giving real
 * one-point perspective while keeping every child in one coordinate system.
 */
function project3D(word: { x: number; y: number }, rotX = 0, rotY = 0) {
  const rx = (rotX * Math.PI) / 180;
  const ry = (rotY * Math.PI) / 180;
  const x1 = word.x * Math.cos(ry);
  const z1 = word.x * Math.sin(ry);
  const y2 = word.y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = word.y * Math.sin(rx) + z1 * Math.cos(rx);
  const persp = FOCAL / Math.max(FOCAL * 0.25, FOCAL + z2);
  return {
    x: x1 * persp,
    y: y2 * persp,
    scale: persp,
    z: z2,
    alpha: 1 - Math.min(0.45, Math.max(0, z2 / (FOCAL * 1.6))),
  };
}

const ROW = [
  { x: -200, y: 0 },
  { x: -100, y: 0 },
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 200, y: 0 },
];

describe('PiP group: simulated 3D rotation', () => {
  it('is an exact no-op at zero', () => {
    for (const w of ROW) {
      const p = project3D(w, 0, 0);
      expect(p.x).toBeCloseTo(w.x, 9);
      expect(p.scale).toBeCloseTo(1, 9);
      expect(p.alpha).toBeCloseTo(1, 9);
    }
  });

  it('gives real depth: the near edge is LARGER than the far edge', () => {
    // This is what a flat cos() squash could not do — it shrank both edges
    // equally, so the group narrowed but never looked like it turned.
    const near = project3D({ x: -200, y: 0 }, 0, 45);
    const far = project3D({ x: 200, y: 0 }, 0, 45);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.scale / far.scale).toBeGreaterThan(1.2);
  });

  it('positive rotationY swings the RIGHT edge away from the camera', () => {
    expect(project3D({ x: 200, y: 0 }, 0, 45).z).toBeGreaterThan(0);
    expect(project3D({ x: -200, y: 0 }, 0, 45).z).toBeLessThan(0);
  });

  it('narrows the group overall as it turns', () => {
    const flat = Math.abs(project3D(ROW[4], 0, 0).x - project3D(ROW[0], 0, 0).x);
    const turned = Math.abs(project3D(ROW[4], 0, 60).x - project3D(ROW[0], 0, 60).x);
    expect(turned).toBeLessThan(flat);
  });

  it('never turns the group inside out (left-to-right order preserved)', () => {
    for (const rot of [15, 45, 60, 89]) {
      const xs = ROW.map((w) => project3D(w, 0, rot).x);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('rotationX gives vertical depth', () => {
    const col = [
      { x: 0, y: -150 },
      { x: 0, y: 150 },
    ];
    const top = project3D(col[0], 45, 0);
    const bottom = project3D(col[1], 45, 0);
    expect(top.scale).not.toBeCloseTo(bottom.scale, 3);
    expect(Math.abs(bottom.y - top.y)).toBeLessThan(300);
  });

  it('stays finite and bounded at extreme angles', () => {
    for (const rot of [90, 120, 180, -90, 270]) {
      const p = project3D({ x: 200, y: 0 }, 0, rot);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.scale)).toBe(true);
      expect(p.scale).toBeGreaterThan(0);
      expect(p.scale).toBeLessThanOrEqual(4);
    }
  });

  it('fades receding words subtly, never to invisibility', () => {
    const away = project3D({ x: 400, y: 0 }, 0, 80);
    expect(away.alpha).toBeLessThan(1);
    expect(away.alpha).toBeGreaterThanOrEqual(0.55);
  });

  it('the group centre is the pivot and never moves', () => {
    for (const rot of [30, 60, 90]) {
      const c = project3D({ x: 0, y: 0 }, 0, rot);
      expect(c.x).toBeCloseTo(0, 9);
      expect(c.scale).toBeCloseTo(1, 9);
    }
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
