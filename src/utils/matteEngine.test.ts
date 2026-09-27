import { describe, it, expect } from 'vitest';
import {
  bracketWeight,
  pickBracket,
  chokePasses,
  featherRadius,
  boxBlurAlpha,
  lerpAlphaPlanes,
  isEmptyMatte,
} from './matteEngine';
import { adaptiveBlendFactor, estimateMatteMotion } from './temporalMaskEngine';
import { canonicalMaxDim, downsampleRatioFor } from './rvmMatting';

describe('bracketWeight', () => {
  it('returns 0 at the lower bound and 1 at the upper bound', () => {
    expect(bracketWeight(1, 2, 1)).toBe(0);
    expect(bracketWeight(1, 2, 2)).toBe(1);
  });

  it('interpolates linearly in between', () => {
    expect(bracketWeight(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(bracketWeight(2, 4, 3)).toBeCloseTo(0.5);
  });

  it('clamps outside the span', () => {
    expect(bracketWeight(1, 2, 0)).toBe(0);
    expect(bracketWeight(1, 2, 9)).toBe(1);
  });

  it('degrades safely on a zero-length or inverted span', () => {
    expect(bracketWeight(1, 1, 1)).toBe(0);
    expect(bracketWeight(2, 1, 1.5)).toBe(0);
  });
});

describe('pickBracket', () => {
  // 12 fps keyframes, which is what the RVM analysis job produces.
  const times = [0, 1 / 12, 2 / 12, 3 / 12, 4 / 12];

  it('returns null for an empty track', () => {
    expect(pickBracket([], 0.5)).toBeNull();
  });

  it('clamps to the only keyframe when there is one', () => {
    expect(pickBracket([5], 99)).toEqual({ i0: 0, i1: 0, w: 0 });
  });

  it('clamps before the first keyframe', () => {
    expect(pickBracket(times, -1)).toEqual({ i0: 0, i1: 0, w: 0 });
  });

  it('clamps at and after the last keyframe', () => {
    expect(pickBracket(times, 4 / 12)).toEqual({ i0: 4, i1: 4, w: 0 });
    expect(pickBracket(times, 10)).toEqual({ i0: 4, i1: 4, w: 0 });
  });

  it('lands exactly on a keyframe with zero weight', () => {
    const b = pickBracket(times, 2 / 12)!;
    expect(b.i0).toBe(2);
    expect(b.i1).toBe(3);
    expect(b.w).toBeCloseTo(0);
  });

  it('interpolates between the two surrounding keyframes', () => {
    // Half way between keyframe 1 (1/12) and keyframe 2 (2/12).
    const b = pickBracket(times, 1.5 / 12)!;
    expect(b.i0).toBe(1);
    expect(b.i1).toBe(2);
    expect(b.w).toBeCloseTo(0.5);
  });

  it('advances monotonically across a whole playback sweep', () => {
    // Regression: the old lookup derived its blend phase from `time % interval`
    // against an absolute grid, so the weight sawtoothed out of step with the
    // keyframes it was actually mixing.
    let prevKey = -1;
    let prevW = -1;
    for (let t = 0; t <= 4 / 12; t += 1 / 240) {
      const b = pickBracket(times, t)!;
      const key = b.i0 * 1000;
      if (key !== prevKey) {
        prevKey = key;
        prevW = -1;
      }
      expect(b.w).toBeGreaterThanOrEqual(prevW);
      expect(b.w).toBeGreaterThanOrEqual(0);
      expect(b.w).toBeLessThanOrEqual(1);
      prevW = b.w;
    }
  });

  it('handles irregular keyframe spacing (governor downshift mid-analysis)', () => {
    const irregular = [0, 0.083, 0.166, 0.266, 0.366]; // 12 fps → 10 fps
    const b = pickBracket(irregular, 0.216)!;
    expect(b.i0).toBe(2);
    expect(b.i1).toBe(3);
    expect(b.w).toBeCloseTo(0.5, 1);
  });
});

describe('chokePasses', () => {
  it('is a no-op below half a pixel', () => {
    expect(chokePasses(0)).toBe(0);
    expect(chokePasses(0.4)).toBe(0);
    expect(chokePasses(-0.2)).toBe(0);
  });

  it('is symmetric for erode and dilate', () => {
    expect(chokePasses(-3)).toBe(chokePasses(3));
  });

  it('is monotonic and bounded', () => {
    let last = 0;
    for (let c = 0.5; c <= 12; c += 0.5) {
      const p = chokePasses(c);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(4);
      last = p;
    }
    expect(chokePasses(100)).toBe(4);
  });

  it('always does at least one pass once the control is engaged', () => {
    expect(chokePasses(1)).toBeGreaterThanOrEqual(1);
    expect(chokePasses(-1)).toBeGreaterThanOrEqual(1);
  });
});

describe('featherRadius', () => {
  it('is zero when neither control is engaged', () => {
    expect(featherRadius(0, 0, 1)).toBe(0);
  });

  it('ignores sub-pixel radii so we skip the blur entirely', () => {
    expect(featherRadius(0, 0.2, 1)).toBe(0);
  });

  it('scales with the work-buffer ratio', () => {
    expect(featherRadius(0, 8, 0.5)).toBeCloseTo(4);
    expect(featherRadius(0, 8, 1)).toBeCloseTo(8);
  });

  it('gives choke its own ramp to shift, even with feather at zero', () => {
    expect(featherRadius(-4, 0, 1)).toBeGreaterThan(0);
  });

  it('is clamped so a huge feather cannot stall the GPU', () => {
    expect(featherRadius(0, 10000, 1)).toBe(48);
  });
});

describe('lerpAlphaPlanes', () => {
  it('is an exact linear mix', () => {
    const a = new Uint8Array([0, 100, 200, 255]);
    const b = new Uint8Array([255, 200, 100, 0]);
    const out = new Uint8Array(4);

    lerpAlphaPlanes(a, b, 0, out);
    expect(Array.from(out)).toEqual([0, 100, 200, 255]);

    lerpAlphaPlanes(a, b, 1, out);
    expect(Array.from(out)).toEqual([255, 200, 100, 0]);

    lerpAlphaPlanes(a, b, 0.5, out);
    expect(Array.from(out)).toEqual([128, 150, 150, 128]);
  });

  it('clamps out-of-range weights', () => {
    const a = new Uint8Array([10]);
    const b = new Uint8Array([200]);
    const out = new Uint8Array(1);
    lerpAlphaPlanes(a, b, -5, out);
    expect(out[0]).toBe(10);
    lerpAlphaPlanes(a, b, 5, out);
    expect(out[0]).toBe(200);
  });
});

describe('boxBlurAlpha', () => {
  function rgbaFromAlpha(alpha: number[]): Uint8ClampedArray {
    const d = new Uint8ClampedArray(alpha.length * 4);
    for (let i = 0; i < alpha.length; i++) d[i * 4 + 3] = alpha[i];
    return d;
  }
  function alphaOf(d: Uint8ClampedArray): number[] {
    const out: number[] = [];
    for (let i = 3; i < d.length; i += 4) out.push(d[i]);
    return out;
  }

  it('does nothing for a radius below one pixel', () => {
    const d = rgbaFromAlpha([0, 255, 0, 255]);
    boxBlurAlpha(d, 2, 2, 0.4);
    expect(alphaOf(d)).toEqual([0, 255, 0, 255]);
  });

  it('leaves a uniform plane untouched', () => {
    const d = rgbaFromAlpha(new Array(25).fill(200));
    boxBlurAlpha(d, 5, 5, 1);
    for (const a of alphaOf(d)) expect(a).toBeGreaterThanOrEqual(198);
  });

  it('spreads a hard edge into a ramp', () => {
    // 7x1 step edge: 0 0 0 255 255 255 255
    const d = rgbaFromAlpha([0, 0, 0, 255, 255, 255, 255]);
    boxBlurAlpha(d, 7, 1, 1, 1);
    const a = alphaOf(d);
    // The pixel before the edge must pick up some alpha, and the one after
    // must lose some — that is the feather.
    expect(a[2]).toBeGreaterThan(0);
    expect(a[3]).toBeLessThan(255);
    // Monotonic ramp, no ringing.
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThanOrEqual(a[i - 1]);
  });

  it('does not touch the colour channels', () => {
    const d = new Uint8ClampedArray(4 * 9);
    for (let i = 0; i < 9; i++) {
      d[i * 4] = 11;
      d[i * 4 + 1] = 22;
      d[i * 4 + 2] = 33;
      d[i * 4 + 3] = i === 4 ? 255 : 0;
    }
    boxBlurAlpha(d, 3, 3, 1);
    for (let i = 0; i < 9; i++) {
      expect(d[i * 4]).toBe(11);
      expect(d[i * 4 + 1]).toBe(22);
      expect(d[i * 4 + 2]).toBe(33);
    }
  });
});

describe('isEmptyMatte', () => {
  it('recognises the 1x1 "analysed, no subject" sentinel', () => {
    expect(isEmptyMatte({ width: 1, height: 1 })).toBe(true);
  });
  it('does not misfire on real mattes', () => {
    expect(isEmptyMatte({ width: 512, height: 288 })).toBe(false);
    expect(isEmptyMatte({ width: 1, height: 2 })).toBe(false);
    expect(isEmptyMatte(null)).toBe(false);
  });
});

describe('temporal stabiliser: motion adaptivity', () => {
  it('reports no motion for identical mattes', () => {
    const a = new Float32Array([0.1, 0.9, 0.5, 0.2]);
    expect(estimateMatteMotion(a, a, 1)).toBe(0);
  });

  it('reports the mean absolute difference', () => {
    const a = new Float32Array([0, 0, 0, 0]);
    const b = new Float32Array([0.2, 0.2, 0.2, 0.2]);
    expect(estimateMatteMotion(a, b, 1)).toBeCloseTo(0.2);
  });

  it('smooths hard when the subject is still', () => {
    // A still subject must get heavy smoothing so the edge stops crawling.
    expect(adaptiveBlendFactor(0)).toBeLessThan(0.25);
    expect(adaptiveBlendFactor(0.001)).toBeLessThan(0.25);
  });

  it('tracks fast when the subject moves, so nothing ghosts', () => {
    expect(adaptiveBlendFactor(0.2)).toBeGreaterThan(0.8);
  });

  it('is monotonic and bounded', () => {
    let last = -1;
    for (let m = 0; m <= 0.3; m += 0.005) {
      const f = adaptiveBlendFactor(m);
      expect(f).toBeGreaterThanOrEqual(last);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      last = f;
    }
  });
});

describe('RVM inference sizing', () => {
  it('collapses call-site sizes onto stable tiers', () => {
    // Regression: different call sites passing 384/512/768 for the same clip
    // changed the inference size and silently reset RVM's recurrent memory.
    expect(canonicalMaxDim(384)).toBe(512);
    expect(canonicalMaxDim(512)).toBe(512);
    expect(canonicalMaxDim(640)).toBe(512);
    expect(canonicalMaxDim(768)).toBe(768);
    expect(canonicalMaxDim(1024)).toBe(1024);
    expect(canonicalMaxDim(4096)).toBe(1024);
  });

  it('keeps the encoder near its designed working resolution', () => {
    // The old hard-coded 0.375 against a 512px input ran the encoder at 192px,
    // which is what produced coarse, wobbling edges.
    for (const side of [512, 768, 1024]) {
      const ratio = downsampleRatioFor(side);
      const encoderPx = side * ratio;
      expect(encoderPx).toBeGreaterThan(230);
      expect(encoderPx).toBeLessThan(320);
    }
  });

  it('never exceeds 1 or drops below 0.25', () => {
    expect(downsampleRatioFor(64)).toBe(1);
    expect(downsampleRatioFor(100000)).toBe(0.25);
  });
});
