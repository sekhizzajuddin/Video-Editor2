import { describe, it, expect } from 'vitest';
import {
  parseKeyframes,
  applyEasing,
  interpolateValue,
  buildAnimationConfigs,
  evaluateAnimationAt,
} from './cssKeyframeEvaluator';

const cfg = (over: Partial<ReturnType<typeof buildAnimationConfigs>[number]> = {}) => ({
  name: 'move',
  duration: 1,
  delay: 0,
  easing: 'linear',
  iterations: 1,
  direction: 'normal',
  fill: 'both',
  ...over,
});

describe('parseKeyframes', () => {
  it('parses from/to and percentage offsets', () => {
    const map = parseKeyframes(`
      @keyframes slide {
        from { transform: translateX(0px); opacity: 0; }
        50%  { transform: translateX(100px); }
        to   { transform: translateX(200px); opacity: 1; }
      }`);
    expect(map.slide).toHaveLength(3);
    expect(map.slide[0].offset).toBe(0);
    expect(map.slide[1].offset).toBe(0.5);
    expect(map.slide[2].offset).toBe(1);
    expect(map.slide[0].props.transform).toBe('translateX(0px)');
  });

  it('is unaffected by nested blocks and @media wrappers', () => {
    const map = parseKeyframes(`
      @media (min-width: 10px) {
        @keyframes pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
      }
      @keyframes after { 0% { opacity: 0; } 100% { opacity: 1; } }
    `);
    expect(map.pop).toBeDefined();
    expect(map.after).toBeDefined();
    expect(map.pop[1].props.transform).toBe('scale(1)');
  });

  it('reads a per-keyframe animation-timing-function', () => {
    const map = parseKeyframes(
      `@keyframes e { 0% { opacity: 0; animation-timing-function: steps(2); } 100% { opacity: 1; } }`
    );
    expect(map.e[0].easing).toBe('steps(2)');
  });
});

describe('interpolateValue', () => {
  it('interpolates lengths and keeps the unit', () => {
    expect(interpolateValue('0px', '200px', 0.25)).toBe('50px');
    expect(interpolateValue('10%', '30%', 0.5)).toBe('20%');
  });

  it('interpolates colours', () => {
    expect(interpolateValue('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
    expect(interpolateValue('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 1)).toBe('rgb(255,255,255)');
  });

  it('interpolates matching transform function lists', () => {
    expect(interpolateValue('translateX(0px) scale(1)', 'translateX(100px) scale(2)', 0.5)).toBe(
      'translateX(50px) scale(1.5)'
    );
  });

  it('snaps transform lists whose signatures differ', () => {
    // A cross-fade between different function lists is not interpolable, so we
    // hand back one of the endpoints rather than emitting nonsense.
    expect(interpolateValue('translateX(0px)', 'rotate(45deg)', 0.5)).toMatch(/rotate\(45deg\)/);
  });

  it('passes through non-numeric values', () => {
    expect(interpolateValue('block', 'none', 0.5)).toBe('none');
  });
});

describe('applyEasing', () => {
  it('is identity for linear and monotonic overall', () => {
    expect(applyEasing('linear', 0.3)).toBeCloseTo(0.3, 6);
    let prev = -1;
    for (let i = 0; i <= 10; i++) {
      const v = applyEasing('ease-in-out', i / 10);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('quantizes with steps()', () => {
    expect(applyEasing('steps(2)', 0.1)).toBe(0);
    expect(applyEasing('steps(2)', 0.9)).toBe(0.5);
  });
});

describe('evaluateAnimationAt', () => {
  const stops = parseKeyframes(
    `@keyframes move { from { transform: translateX(0px); } to { transform: translateX(200px); } }`
  ).move;

  it('evaluates the midpoint', () => {
    expect(evaluateAnimationAt(cfg(), stops, 0.5)?.transform).toBe('translateX(100px)');
  });

  it('honours animation-delay', () => {
    expect(evaluateAnimationAt(cfg({ delay: 1 }), stops, 1.5)?.transform).toBe('translateX(100px)');
  });

  it('with fill:none returns null outside the active window', () => {
    expect(evaluateAnimationAt(cfg({ fill: 'none' }), stops, -1)).toBeNull();
    expect(evaluateAnimationAt(cfg({ fill: 'none' }), stops, 5)).toBeNull();
  });

  it('with fill:both holds the first and last frame', () => {
    expect(evaluateAnimationAt(cfg(), stops, -5)?.transform).toBe('translateX(0px)');
    expect(evaluateAnimationAt(cfg(), stops, 99)?.transform).toBe('translateX(200px)');
  });

  it('wraps infinite iterations', () => {
    const anim = cfg({ iterations: Infinity });
    expect(evaluateAnimationAt(anim, stops, 2.25)?.transform).toBe('translateX(50px)');
    expect(evaluateAnimationAt(anim, stops, 10.5)?.transform).toBe('translateX(100px)');
  });

  it('mirrors on alternate directions', () => {
    const anim = cfg({ iterations: Infinity, direction: 'alternate' });
    expect(evaluateAnimationAt(anim, stops, 0.25)?.transform).toBe('translateX(50px)');
    expect(evaluateAnimationAt(anim, stops, 1.25)?.transform).toBe('translateX(150px)');
  });
});

describe('buildAnimationConfigs', () => {
  it('repeats shorter lists cyclically across animation names', () => {
    const configs = buildAnimationConfigs({
      names: ['a', 'b'],
      durations: [2],
      delays: [0, 0.5],
      easings: ['ease-out'],
      iterations: [Infinity],
      directions: ['alternate'],
      fills: ['both'],
    });
    expect(configs).toHaveLength(2);
    expect(configs[0].duration).toBe(2);
    expect(configs[1].duration).toBe(2);
    expect(configs[1].delay).toBe(0.5);
    expect(configs[0].iterations).toBe(Infinity);
  });
});
