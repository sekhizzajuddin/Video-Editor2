import { describe, it, expect } from 'vitest';
import { getOverlayMapping, clientToOverlay } from './previewMath';

/**
 * The preview <canvas> uses `object-contain` and the overlay <svg> uses
 * viewBox="0 0 854 480" with the default preserveAspectRatio. Both letterbox:
 * uniform scale + centred. The pointer maths must agree with that exactly, or
 * transform handles drift away from the cursor.
 */
describe('getOverlayMapping', () => {
  it('exactly 16:9 container has no letterboxing', () => {
    const m = getOverlayMapping({ width: 854, height: 480 });
    expect(m.offsetX).toBeCloseTo(0);
    expect(m.offsetY).toBeCloseTo(0);
    expect(m.scale).toBeCloseTo(1);
  });

  it('scales uniformly on a larger 16:9 container', () => {
    const m = getOverlayMapping({ width: 1708, height: 960 });
    expect(m.scale).toBeCloseTo(0.5);
    expect(m.offsetX).toBeCloseTo(0);
    expect(m.offsetY).toBeCloseTo(0);
  });

  it('a too-wide container is pillarboxed (bars left/right)', () => {
    const m = getOverlayMapping({ width: 1200, height: 480 });
    // Height is the limiting axis -> scale set by height, spare width becomes bars.
    expect(m.scale).toBeCloseTo(1);
    expect(m.offsetX).toBeCloseTo((1200 - 854) / 2);
    expect(m.offsetY).toBeCloseTo(0);
  });

  it('a too-tall container is letterboxed (bars top/bottom)', () => {
    const m = getOverlayMapping({ width: 854, height: 900 });
    expect(m.scale).toBeCloseTo(1);
    expect(m.offsetX).toBeCloseTo(0);
    expect(m.offsetY).toBeCloseTo((900 - 480) / 2);
  });

  it('uses ONE scale for both axes (the core bug)', () => {
    // The old code used 854/width and 480/height independently. On this
    // container those differ by ~1.7x, so drags ran at different speeds per axis.
    const rect = { width: 1000, height: 400 };
    const naiveX = 854 / rect.width;
    const naiveY = 480 / rect.height;
    expect(naiveX).not.toBeCloseTo(naiveY);

    const m = getOverlayMapping(rect);
    // A square gesture must stay square in overlay space.
    const dx = 100 * m.scale;
    const dy = 100 * m.scale;
    expect(dx).toBeCloseTo(dy);
  });

  it('degenerate sizes do not produce NaN or Infinity', () => {
    for (const rect of [{ width: 0, height: 0 }, { width: 100, height: 0 }, { width: 0, height: 100 }]) {
      const m = getOverlayMapping(rect);
      expect(Number.isFinite(m.scale)).toBe(true);
      expect(Number.isFinite(m.offsetX)).toBe(true);
      expect(Number.isFinite(m.offsetY)).toBe(true);
    }
  });
});

describe('clientToOverlay', () => {
  it('maps the centre of a 16:9 container to the overlay centre', () => {
    const rect = { left: 0, top: 0, width: 854, height: 480 };
    const p = clientToOverlay(427, 240, rect);
    expect(p.x).toBeCloseTo(427);
    expect(p.y).toBeCloseTo(240);
  });

  it('maps the centre correctly when pillarboxed', () => {
    const rect = { left: 0, top: 0, width: 1200, height: 480 };
    const p = clientToOverlay(600, 240, rect);
    expect(p.x).toBeCloseTo(427);
    expect(p.y).toBeCloseTo(240);
  });

  it('maps the centre correctly when letterboxed', () => {
    const rect = { left: 0, top: 0, width: 854, height: 900 };
    const p = clientToOverlay(427, 450, rect);
    expect(p.x).toBeCloseTo(427);
    expect(p.y).toBeCloseTo(240);
  });

  it('accounts for the container being offset in the page', () => {
    const rect = { left: 300, top: 120, width: 854, height: 480 };
    const p = clientToOverlay(300 + 427, 120 + 240, rect);
    expect(p.x).toBeCloseTo(427);
    expect(p.y).toBeCloseTo(240);
  });

  it('maps the drawn top-left corner to overlay (0,0) under letterboxing', () => {
    const rect = { left: 0, top: 0, width: 1200, height: 480 };
    const m = getOverlayMapping(rect);
    const p = clientToOverlay(m.offsetX, m.offsetY, rect);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('maps the drawn bottom-right corner to overlay (854,480)', () => {
    const rect = { left: 0, top: 0, width: 1200, height: 480 };
    const m = getOverlayMapping(rect);
    const p = clientToOverlay(rect.width - m.offsetX, rect.height - m.offsetY, rect);
    expect(p.x).toBeCloseTo(854);
    expect(p.y).toBeCloseTo(480);
  });

  it('is linear: equal client deltas give equal overlay deltas on both axes', () => {
    const rect = { left: 0, top: 0, width: 1000, height: 700 };
    const a = clientToOverlay(100, 100, rect);
    const b = clientToOverlay(200, 200, rect);
    expect(b.x - a.x).toBeCloseTo(b.y - a.y);
  });
});
