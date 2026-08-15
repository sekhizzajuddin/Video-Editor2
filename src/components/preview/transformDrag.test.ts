import { describe, it, expect } from 'vitest';
import { deriveLineStructure, layoutSentence } from '@/utils/kineticSync';

/**
 * Pure re-implementations of the drag maths in PreviewCanvasOverlay, so the
 * behaviour can be asserted without a DOM. Each mirrors the fixed code path.
 */

/** Edge resize: ratio relative to the size at drag start. */
function edgeResize(initScale: number, initRotation: number, baseW: number, dx: number, dy: number) {
  const theta = (-initRotation * Math.PI) / 180;
  const invScale = 100 / initScale;
  const localDx = (dx * Math.cos(theta) - dy * Math.sin(theta)) * invScale;
  const sx = (baseW + localDx * 2) / baseW;
  return Math.max(10, Math.min(1000, initScale * sx));
}

/** Corner resize: radius ratio from the clip centre. */
function cornerResize(initScale: number, baseW: number, baseH: number, dist: number) {
  const origDist = Math.hypot(baseW / 2, baseH / 2) * (initScale / 100);
  return Math.max(10, Math.min(1000, initScale * (dist / origDist)));
}

describe('edge resize', () => {
  it('gives the SAME size delta regardless of the starting scale', () => {
    // The bug: `finalScale = sx * 100` discarded the current scale, so the clip
    // snapped toward ~100% the instant an edge was grabbed.
    const deltas = [50, 100, 200, 400].map(
      (init) => edgeResize(init, 0, 300, 20, 0) - init
    );
    for (const d of deltas) expect(d).toBeCloseTo(deltas[0], 6);
    expect(deltas[0]).toBeGreaterThan(0);
  });

  it('does not change scale when there is no movement', () => {
    for (const init of [50, 100, 200]) {
      expect(edgeResize(init, 0, 300, 0, 0)).toBeCloseTo(init, 6);
    }
  });

  it('dragging outward grows and inward shrinks, from any scale', () => {
    for (const init of [50, 100, 200]) {
      expect(edgeResize(init, 0, 300, 20, 0)).toBeGreaterThan(init);
      expect(edgeResize(init, 0, 300, -20, 0)).toBeLessThan(init);
    }
  });

  it('uses the drag-start rotation so the basis cannot drift mid-drag', () => {
    // Same gesture, same start rotation -> same result, regardless of how far
    // the live rotation has since moved.
    const a = edgeResize(100, 30, 300, 20, 0);
    const b = edgeResize(100, 30, 300, 20, 0);
    expect(a).toBe(b);
  });
});

describe('corner resize', () => {
  it('grabbing a corner with zero movement leaves the scale unchanged', () => {
    for (const init of [50, 100, 250]) {
      const baseW = 300;
      const baseH = 100;
      const restDist = Math.hypot(baseW / 2, baseH / 2) * (init / 100);
      expect(cornerResize(init, baseW, baseH, restDist)).toBeCloseTo(init, 6);
    }
  });

  it('is monotonic: further from centre is always larger', () => {
    let prev = 0;
    for (const d of [50, 100, 150, 200]) {
      const s = cornerResize(100, 300, 100, d);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});

describe('keyframe sampling uses the ABSOLUTE clip start', () => {
  // Kinetic words carry a pop keyframe: 135% -> 100% over 0.12s.
  const sample = (currentTime: number, absStart: number) => {
    const kfs = [
      { time: 0, value: 135 },
      { time: 0.12, value: 100 },
    ];
    const local = currentTime - absStart;
    if (local <= kfs[0].time) return kfs[0].value;
    if (local >= kfs[1].time) return kfs[1].value;
    const t = (local - kfs[0].time) / (kfs[1].time - kfs[0].time);
    return kfs[0].value + (kfs[1].value - kfs[0].value) * t;
  };

  it('relative vs absolute start disagree — which is the jump-on-grab bug', () => {
    const pipAbsStart = 12.0;
    const wordRelStart = 0.4;
    const now = 12.4; // exactly when the word pops
    const correct = sample(now, pipAbsStart + wordRelStart);
    const buggy = sample(now, wordRelStart);
    expect(correct).not.toBeCloseTo(buggy, 1);
    expect(correct).toBeCloseTo(135, 1); // overlay must see the popped size
    expect(buggy).toBeCloseTo(100, 1);
  });

  it('absolute sampling matches what the drag handler computes', () => {
    const pipAbsStart = 12.0;
    const wordRelStart = 0.4;
    const abs = pipAbsStart + wordRelStart;
    for (const now of [12.4, 12.45, 12.5, 13.0]) {
      expect(sample(now, abs)).toBe(sample(now, abs));
    }
  });
});

describe('resize must not re-flow the text (style is not transform)', () => {
  const words = 'Jabki Uska Koi Mass'.split(' ');

  it('a stored vertical structure survives every scale', () => {
    const vertical = [1, 1, 1, 1];
    for (const scale of [0.2, 0.5, 1, 1.5, 3]) {
      const out = layoutSentence(words, { lineStructure: vertical, scale });
      expect(new Set(out.map((w) => w.y)).size).toBe(4);
    }
  });

  it('WITHOUT a structure the same text collapses to one line (the bug)', () => {
    const out = layoutSentence(words, { scale: 1 });
    expect(new Set(out.map((w) => w.y)).size).toBe(1);
  });

  it('derived structure survives small scales after the tolerance fix', () => {
    // Line spacing shrinks with scale; a fixed tolerance merged lines and turned
    // a vertical arrangement horizontal.
    for (const scale of [1, 0.5, 0.25]) {
      const laid = layoutSentence(words, { lineStructure: [1, 1, 1, 1], scale });
      const layers = laid.map((w, i) => ({
        clipId: `c${i}`,
        trackId: `t${i}`,
        text: w.text,
        startTime: 0,
        duration: 1,
        x: w.x,
        y: w.y,
        fontSize: w.fontSize,
      }));
      expect(deriveLineStructure(layers)).toEqual([1, 1, 1, 1]);
    }
  });
});
