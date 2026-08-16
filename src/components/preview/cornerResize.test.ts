import { describe, it, expect } from 'vitest';

/**
 * Pure model of the corner-resize and rotation maths in PreviewCanvasOverlay.
 * Both are now RELATIVE to the pointer state recorded at mousedown, so the exact
 * spot inside a handle that the user grabs cannot change anything.
 */
function cornerScale(initScale: number, grabDist: number | undefined, nowDist: number): number {
  if (grabDist === undefined || grabDist <= 1) return initScale;
  return Math.max(10, Math.min(1000, initScale * (nowDist / grabDist)));
}

function shiftLockScale(
  initScale: number,
  grab: { dx: number; dy: number },
  now: { dx: number; dy: number }
): number {
  const useX = Math.abs(now.dx - grab.dx) >= Math.abs(now.dy - grab.dy);
  const grabAxis = useX ? grab.dx : grab.dy;
  const nowAxis = useX ? now.dx : now.dy;
  if (grabAxis <= 1) return initScale;
  return Math.max(10, Math.min(1000, initScale * (nowAxis / grabAxis)));
}

function rotate(initRot: number, grabAngle: number, nowAngle: number): number {
  return initRot + (nowAngle - grabAngle);
}

const CORNER_RADIUS = 158.1; // hypot(300/2, 100/2)

describe('corner resize: no jump on grab', () => {
  it('grabbing anywhere inside the handle leaves the scale untouched', () => {
    // The handle is ~12 units across. Previously the grab offset was applied
    // immediately as a scale change (up to ~4%).
    for (const offset of [-6, -3, -1, 0, 1, 3, 6]) {
      const grab = CORNER_RADIUS + offset;
      expect(cornerScale(100, grab, grab)).toBeCloseTo(100, 9);
    }
  });

  it('is unaffected by crop, which the handles never accounted for', () => {
    // origDist used crop-adjusted spans while handles are drawn un-cropped; a 25%
    // crop on all sides used to produce an instant 200% jump.
    for (const grab of [CORNER_RADIUS, CORNER_RADIUS * 0.5, CORNER_RADIUS * 0.75]) {
      expect(cornerScale(100, grab, grab)).toBeCloseTo(100, 9);
    }
  });

  it('applies the same ratio from any starting scale', () => {
    for (const init of [50, 100, 200, 400]) {
      const grab = CORNER_RADIUS * (init / 100);
      expect(cornerScale(init, grab, grab * 1.2) / init).toBeCloseTo(1.2, 6);
    }
  });

  it('dragging outward grows and inward shrinks', () => {
    const grab = CORNER_RADIUS;
    expect(cornerScale(100, grab, grab * 1.3)).toBeGreaterThan(100);
    expect(cornerScale(100, grab, grab * 0.7)).toBeLessThan(100);
  });

  it('is monotonic in pointer distance', () => {
    const grab = CORNER_RADIUS;
    let prev = 0;
    for (const f of [0.6, 0.8, 1.0, 1.4, 2.0]) {
      const s = cornerScale(100, grab, grab * f);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  it('clamps to the allowed range', () => {
    const grab = CORNER_RADIUS;
    expect(cornerScale(100, grab, grab * 0.0001)).toBeGreaterThanOrEqual(10);
    expect(cornerScale(100, grab, grab * 1000)).toBeLessThanOrEqual(1000);
  });

  it('falls back safely when the grab distance is degenerate', () => {
    expect(cornerScale(100, undefined, 200)).toBe(100);
    expect(cornerScale(100, 0.2, 200)).toBe(100);
  });
});

describe('corner resize: Shift aspect lock', () => {
  it('does not jump on grab', () => {
    const grab = { dx: 150, dy: 50 };
    expect(shiftLockScale(100, grab, { ...grab })).toBeCloseTo(100, 9);
  });

  it('follows whichever axis moved most', () => {
    const grab = { dx: 150, dy: 50 };
    const movedX = shiftLockScale(100, grab, { dx: 300, dy: 50 });
    expect(movedX).toBeCloseTo(200, 6);
    const movedY = shiftLockScale(100, grab, { dx: 150, dy: 100 });
    expect(movedY).toBeCloseTo(200, 6);
  });
});

describe('rotation: no jump on grab', () => {
  it('grabbing at ANY angle leaves the rotation untouched', () => {
    // The old code set an absolute angle (pointerAngle + 90), which assumed the
    // handle was grabbed at 12 o'clock and ignored the clip's current rotation.
    for (const initRot of [0, 37, -90, 180, 359]) {
      for (const grabAt of [-170, -90, 0, 45, 90, 179]) {
        expect(rotate(initRot, grabAt, grabAt)).toBeCloseTo(initRot, 9);
      }
    }
  });

  it('applies the pointer angle delta to the existing rotation', () => {
    expect(rotate(30, 0, 25)).toBeCloseTo(55, 9);
    expect(rotate(-45, 10, -10)).toBeCloseTo(-65, 9);
  });

  it('is symmetric: rotating out and back restores the original angle', () => {
    const init = 42;
    const out = rotate(init, 0, 30);
    const back = rotate(init, 0, 0);
    expect(out).toBeCloseTo(72, 9);
    expect(back).toBeCloseTo(init, 9);
  });
});
