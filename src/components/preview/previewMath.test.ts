import { describe, it, expect } from 'vitest';
import { getOverlayMapping, clientToOverlay, clientToViewportSpace } from './previewMath';

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

describe('clientToViewportSpace (no jump when grabbing a handle)', () => {
  const rect = { left: 0, top: 0, width: 854, height: 480 };

  /** Forward transform: clip-local point -> client pixel. */
  const toClient = (
    lx: number,
    ly: number,
    r: { left: number; top: number; width: number; height: number },
    vp: { x: number; y: number; zoom: number }
  ) => {
    const CX = 427;
    const CY = 240;
    const totalX = CX + vp.x - CX * vp.zoom;
    const totalY = CY + vp.y - CY * vp.zoom;
    const overlayX = totalX + vp.zoom * lx;
    const overlayY = totalY + vp.zoom * ly;
    const S = Math.min(r.width / 854, r.height / 480);
    const ox = (r.width - 854 * S) / 2;
    const oy = (r.height - 480 * S) / 2;
    return { clientX: r.left + ox + overlayX * S, clientY: r.top + oy + overlayY * S };
  };

  it('is the exact inverse of the viewport transform at zoom 1', () => {
    const vp = { x: 0, y: 0, zoom: 1 };
    const { clientX, clientY } = toClient(300, 200, rect, vp);
    const back = clientToViewportSpace(clientX, clientY, rect, vp);
    expect(back.x).toBeCloseTo(300);
    expect(back.y).toBeCloseTo(200);
  });

  it('round-trips under zoom, pan, and a non-16:9 container', () => {
    const cases = [
      { vp: { x: 0, y: 0, zoom: 1.25 }, r: rect },
      { vp: { x: 40, y: 25, zoom: 1 }, r: rect },
      { vp: { x: 60, y: -30, zoom: 1.5 }, r: { left: 0, top: 0, width: 1200, height: 520 } },
      { vp: { x: -80, y: 15, zoom: 0.75 }, r: { left: 33, top: 21, width: 900, height: 900 } },
    ];
    for (const { vp, r } of cases) {
      for (const [lx, ly] of [[0, 0], [427, 240], [700, 400], [-50, -20]]) {
        const { clientX, clientY } = toClient(lx, ly, r, vp);
        const back = clientToViewportSpace(clientX, clientY, r, vp);
        expect(back.x).toBeCloseTo(lx, 4);
        expect(back.y).toBeCloseTo(ly, 4);
      }
    }
  });

  it('grabbing a corner with no pointer movement causes NO scale change', () => {
    // The reported bug: the handler compared a raw overlay pointer against a
    // hard-coded (427,240) centre, which assumes zoom=1/pan=0. Under any zoom or
    // pan the measured radius was wrong immediately, so the clip snapped to a new
    // scale before the user had really moved.
    for (const ar of ['16:9', '9:16', '1:1', '4:3'] as const) {
      let viewW = 854;
      const viewH = 480;
      if (ar === '9:16') viewW = Math.round(480 * (9 / 16));
      else if (ar === '1:1') viewW = 480;
      else if (ar === '4:3') viewW = Math.round(480 * (4 / 3));
      const W = viewW;
      const H = viewH;
      const offX = (854 - viewW) / 2;
      const offY = (480 - viewH) / 2;

      for (const vp of [
        { x: 0, y: 0, zoom: 1 },
        { x: 0, y: 0, zoom: 1.25 },
        { x: 40, y: 25, zoom: 1 },
        { x: 60, y: -30, zoom: 1.5 },
      ]) {
        const aX = 0;
        const aY = 0;
        const aScale = 100;
        const baseW = 300;
        const baseH = 100;
        const cx = offX + W / 2 + aX;
        const cy = offY + H / 2 + aY;
        const hx = cx + (baseW / 2) * (aScale / 100);
        const hy = cy + (baseH / 2) * (aScale / 100);

        const { clientX, clientY } = toClient(hx, hy, rect, vp);
        const p = clientToViewportSpace(clientX, clientY, rect, vp);
        const dist = Math.hypot(p.x - cx, p.y - cy);
        const origDist = Math.hypot(baseW / 2, baseH / 2) * (aScale / 100);
        expect((aScale * dist) / origDist).toBeCloseTo(100, 2);
      }
    }
  });

  it('a pure upward pointer move never yields a downward delta', () => {
    const vp = { x: 30, y: -20, zoom: 1.4 };
    const start = toClient(400, 300, rect, vp);
    // Move the pointer 20 client px UP.
    const a = clientToViewportSpace(start.clientX, start.clientY, rect, vp);
    const b = clientToViewportSpace(start.clientX, start.clientY - 20, rect, vp);
    expect(b.y).toBeLessThan(a.y);
    expect(b.x).toBeCloseTo(a.x, 6);
  });
});
