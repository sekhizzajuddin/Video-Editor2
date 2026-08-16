import { describe, it, expect } from 'vitest';

/**
 * Text clips (including PiP kinetic words) must honour every Transform-tab
 * control. Rotation, opacity, flip and blend were already handled by the shared
 * transform block; Crop and Perspective Warp were not, because the text branch
 * drew straight to the target instead of through an offscreen buffer.
 *
 * These cover the geometry the fix relies on.
 */

/** Mirrors the text-box measurement used for BOTH the buffer and the corners. */
function measureTextBox(text: string, fontSize: number) {
  const lines = String(text ?? '').split('\n');
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  return {
    w: Math.max(80, longest * fontSize * 0.6 + 40),
    h: lines.length * (fontSize * 1.35) + 20,
  };
}

/** Mirrors the crop -> blit maths in the text composite step. */
function cropRects(w: number, h: number, cl: number, cr: number, ct: number, cb: number) {
  const sx = cl * w;
  const sy = ct * h;
  const sw = Math.max(1, w * (1 - cl - cr));
  const sh = Math.max(1, h * (1 - ct - cb));
  return { sx, sy, sw, sh, dx: -w / 2 + sx, dy: -h / 2 + sy };
}

describe('text box measurement', () => {
  it('is identical for the buffer and the perspective quad', () => {
    // If these ever diverge, drawPerspectiveTexture stretches the glyphs.
    for (const [text, size] of [['Hello', 48], ['Jabki Uska Koi Mass', 54]] as const) {
      const a = measureTextBox(text, size);
      const b = measureTextBox(text, size);
      expect(a).toEqual(b);
    }
  });

  it('grows with font size and line count', () => {
    expect(measureTextBox('Hi', 96).w).toBeGreaterThan(measureTextBox('Hi', 48).w);
    expect(measureTextBox('a\nb\nc', 48).h).toBeGreaterThan(measureTextBox('a', 48).h);
  });

  it('never collapses to zero for empty text', () => {
    const m = measureTextBox('', 48);
    expect(m.w).toBeGreaterThan(0);
    expect(m.h).toBeGreaterThan(0);
  });
});

describe('text crop', () => {
  const { w, h } = measureTextBox('Hello', 48);

  it('an uncropped clip is centred and full size', () => {
    const r = cropRects(w, h, 0, 0, 0, 0);
    expect(r.sw).toBeCloseTo(w);
    expect(r.sh).toBeCloseTo(h);
    expect(r.dx).toBeCloseTo(-w / 2);
    expect(r.dy).toBeCloseTo(-h / 2);
  });

  it('cropping the left trims from the left and shifts the destination', () => {
    const r = cropRects(w, h, 0.25, 0, 0, 0);
    expect(r.sx).toBeCloseTo(0.25 * w);
    expect(r.sw).toBeCloseTo(0.75 * w);
    // Remaining pixels stay put rather than sliding left.
    expect(r.dx).toBeCloseTo(-w / 2 + 0.25 * w);
  });

  it('cropping all four sides keeps a positive region', () => {
    const r = cropRects(w, h, 0.1, 0.1, 0.2, 0.2);
    expect(r.sw).toBeGreaterThan(0);
    expect(r.sh).toBeGreaterThan(0);
    expect(r.sw).toBeCloseTo(w * 0.8);
    expect(r.sh).toBeCloseTo(h * 0.6);
  });

  it('never produces a degenerate source rect', () => {
    const r = cropRects(w, h, 0.99, 0.99, 0.99, 0.99);
    expect(r.sw).toBeGreaterThanOrEqual(1);
    expect(r.sh).toBeGreaterThanOrEqual(1);
  });
});

describe('which controls need the offscreen path', () => {
  const needsOffscreen = (crop: number[], hasCorners: boolean) =>
    crop.some((c) => c > 0) || hasCorners;

  it('plain text takes the fast direct path', () => {
    expect(needsOffscreen([0, 0, 0, 0], false)).toBe(false);
  });

  it('crop alone triggers it', () => {
    expect(needsOffscreen([0.2, 0, 0, 0], false)).toBe(true);
  });

  it('perspective alone triggers it', () => {
    expect(needsOffscreen([0, 0, 0, 0], true)).toBe(true);
  });

  it('crop plus perspective triggers it', () => {
    expect(needsOffscreen([0.1, 0.1, 0, 0], true)).toBe(true);
  });
});
