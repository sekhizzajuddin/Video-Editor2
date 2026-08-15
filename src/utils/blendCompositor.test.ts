import { describe, it, expect } from 'vitest';
import { resolveBlendPlan, isBackdropDependent } from './blendCompositor';

describe('resolveBlendPlan', () => {
  it('uses a plain normal draw when no blend mode is set', () => {
    const p = resolveBlendPlan('source-over', 100, 1);
    expect(p.kind).toBe('normal');
    expect(p.mode).toBe('source-over');
    expect(p.needsScratch).toBe(false);
  });

  it('treats undefined blend mode as normal', () => {
    expect(resolveBlendPlan(undefined, 100, 1).kind).toBe('normal');
  });

  it('does NOT let blend intensity fade a clip that has no blend mode', () => {
    // Regression: intensity used to be folded into globalAlpha unconditionally,
    // so lowering it on a Normal clip made the clip disappear.
    const p = resolveBlendPlan('source-over', 20, 1);
    expect(p.kind).toBe('normal');
    expect(p.alpha).toBe(1);
  });

  it('uses native single-draw blending at full intensity', () => {
    const p = resolveBlendPlan('multiply', 100, 1);
    expect(p.kind).toBe('blend');
    expect(p.mode).toBe('multiply');
    expect(p.alpha).toBe(1);
    expect(p.needsScratch).toBe(false);
  });

  it('falls back to a normal draw at zero intensity', () => {
    const p = resolveBlendPlan('multiply', 0, 1);
    expect(p.kind).toBe('normal');
    expect(p.mode).toBe('source-over');
    // The clip must remain fully visible — just un-blended.
    expect(p.alpha).toBe(1);
  });

  it('requests a scratch buffer only for partial intensity', () => {
    const partial = resolveBlendPlan('multiply', 50, 1);
    expect(partial.kind).toBe('lerp');
    expect(partial.needsScratch).toBe(true);
    expect(partial.mix).toBeCloseTo(0.5);

    expect(resolveBlendPlan('multiply', 100, 1).needsScratch).toBe(false);
    expect(resolveBlendPlan('multiply', 0, 1).needsScratch).toBe(false);
  });

  it('carries clip opacity through independently of blend intensity', () => {
    const p = resolveBlendPlan('screen', 50, 0.4);
    expect(p.alpha).toBeCloseTo(0.4);
    expect(p.mix).toBeCloseTo(0.5);
  });

  it('short-circuits fully transparent clips', () => {
    const p = resolveBlendPlan('difference', 50, 0);
    expect(p.alpha).toBe(0);
    expect(p.needsScratch).toBe(false);
  });

  it('clamps out-of-range intensity and opacity', () => {
    expect(resolveBlendPlan('multiply', 500, 1).mix).toBe(1);
    expect(resolveBlendPlan('multiply', -50, 1).mix).toBe(0);
    expect(resolveBlendPlan('multiply', 50, 5).alpha).toBe(1);
    expect(resolveBlendPlan('multiply', 50, -1).alpha).toBe(0);
  });

  it('treats missing intensity as fully applied', () => {
    expect(resolveBlendPlan('overlay', undefined, 1).kind).toBe('blend');
  });

  it('survives NaN intensity without producing NaN alpha', () => {
    const p = resolveBlendPlan('overlay', NaN, 1);
    expect(Number.isFinite(p.alpha)).toBe(true);
    expect(Number.isFinite(p.mix)).toBe(true);
  });

  it('never emits a plan that would double-composite', () => {
    // Exactly one of: single normal draw, single blended draw, or lerp-with-scratch.
    for (const mode of ['multiply', 'screen', 'overlay', 'difference', 'hue', 'luminosity']) {
      for (const intensity of [0, 1, 25, 50, 99, 100]) {
        const p = resolveBlendPlan(mode, intensity, 1);
        if (p.kind === 'lerp') {
          expect(p.needsScratch).toBe(true);
          expect(p.mix).toBeGreaterThan(0);
          expect(p.mix).toBeLessThan(1);
        } else {
          expect(p.needsScratch).toBe(false);
        }
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('isBackdropDependent', () => {
  it('is false for normal / unset modes', () => {
    expect(isBackdropDependent('source-over')).toBe(false);
    expect(isBackdropDependent(undefined)).toBe(false);
  });

  it('is true for real blend modes', () => {
    for (const m of ['multiply', 'screen', 'overlay', 'difference', 'color', 'luminosity']) {
      expect(isBackdropDependent(m)).toBe(true);
    }
  });
});
