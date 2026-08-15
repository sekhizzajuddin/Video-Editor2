import { describe, it, expect } from 'vitest';

/**
 * Pure model of the alignment-snap logic in PreviewCanvasOverlay's move handler.
 * Mirrors the fixed implementation so the behaviour can be asserted headlessly.
 */
function applySnap(
  newPos: number,
  delta: number,
  size: number,
  targets: number[],
  threshold: number
): { pos: number; snapped: boolean } {
  if (Math.abs(delta) <= 2) return { pos: newPos, snapped: false };

  const anchors = [
    { val: newPos - size / 2, kind: 'start' as const },
    { val: newPos, kind: 'center' as const },
    { val: newPos + size / 2, kind: 'end' as const },
  ];

  let best: number | null = null;
  let minDiff = Infinity;

  for (const a of anchors) {
    for (const t of targets) {
      const diff = Math.abs(a.val - t);
      if (diff >= threshold || diff >= minDiff) continue;
      const candidate = a.kind === 'start' ? t + size / 2 : a.kind === 'center' ? t : t - size / 2;
      const correction = candidate - newPos;
      if (correction !== 0 && Math.sign(correction) === -Math.sign(delta)) continue;
      minDiff = diff;
      best = candidate;
    }
  }
  return best !== null ? { pos: best, snapped: true } : { pos: newPos, snapped: false };
}

const H = 480;
const TARGETS = [-H / 2, 0, H / 2];
const THRESHOLD = 5.4;

describe('alignment helper: click without dragging', () => {
  it('a click with zero movement never moves the clip', () => {
    for (const y of [0, 37, -120, 203, 240]) {
      expect(applySnap(y, 0, 400, TARGETS, THRESHOLD).pos).toBe(y);
    }
  });

  it('a sub-threshold tremor never moves the clip', () => {
    // Hand tremor / a 1px mouse jitter on mousedown must not trigger alignment.
    for (const d of [-2, -1, 0, 1, 2]) {
      const y = 203;
      expect(applySnap(y + d, d, 400, TARGETS, THRESHOLD).pos).toBe(y + d);
    }
  });
});

describe('alignment helper: never pushes against the drag', () => {
  const size = 400;

  it('a continuous downward drag is monotonic', () => {
    const initY = 215;
    let prev = initY;
    for (let f = 1; f <= 12; f++) {
      const dy = 5 * f;
      const { pos } = applySnap(initY + dy, dy, size, TARGETS, THRESHOLD);
      expect(pos).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = pos;
    }
  });

  it('a continuous upward drag is monotonic', () => {
    const initY = 255;
    let prev = initY;
    for (let f = 1; f <= 12; f++) {
      const dy = -5 * f;
      const { pos } = applySnap(initY + dy, dy, size, TARGETS, THRESHOLD);
      expect(pos).toBeLessThanOrEqual(prev + 1e-9);
      prev = pos;
    }
  });

  it('crossing a guide while dragging down never yields an upward correction', () => {
    for (const raw of [198, 200, 202, 235, 240, 245]) {
      const { pos } = applySnap(raw, +5, size, TARGETS, THRESHOLD);
      expect(pos).toBeGreaterThanOrEqual(raw - 1e-9);
    }
  });

  it('crossing a guide while dragging up never yields a downward correction', () => {
    for (const raw of [202, 200, 198, 245, 240, 235]) {
      const { pos } = applySnap(raw, -5, size, TARGETS, THRESHOLD);
      expect(pos).toBeLessThanOrEqual(raw + 1e-9);
    }
  });
});

describe('alignment helper: still snaps usefully', () => {
  it('snaps the centre onto a guide when approaching it', () => {
    // At y = -3 and moving DOWN (+), the clip is heading toward the 0 guide, so
    // the +3 correction is with the drag and must be accepted.
    const r = applySnap(-3, +5, 100, TARGETS, THRESHOLD);
    expect(r.snapped).toBe(true);
    expect(r.pos).toBe(0);
  });

  it('releases the guide when the drag pulls away from it', () => {
    // Same position, but moving UP (away from 0): the correction would be +3,
    // i.e. against the drag, so it must be refused. This is the behaviour that
    // makes a guide escapable instead of sticky.
    const r = applySnap(-3, -5, 100, TARGETS, THRESHOLD);
    expect(r.snapped).toBe(false);
    expect(r.pos).toBe(-3);
  });

  it('does not snap when far from any guide', () => {
    expect(applySnap(137, 5, 100, TARGETS, THRESHOLD).snapped).toBe(false);
  });

  it('picks the NEAREST guide when several are in range', () => {
    const targets = [0, 8];
    const r = applySnap(7.5, 5, 0, targets, 10);
    expect(r.pos).toBe(8);
  });

  it('per-axis arming: a purely vertical drag leaves X untouched', () => {
    // dx = 0 -> X never arms, so the horizontal guide cannot grab the clip.
    expect(applySnap(2, 0, 100, TARGETS, THRESHOLD).pos).toBe(2);
  });
});
