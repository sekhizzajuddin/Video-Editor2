import { describe, it, expect } from 'vitest';
import {
  buildSeekCss,
  parseCssIterationList,
  parseCssTimeList,
  sanitizeMotionSceneHtml,
} from './cssSceneRasterizer';
import {
  parseJsonSafely,
  sanitizeMotionGraphicSpec,
} from './generateMotionGraphicsFromDialogue';

describe('cssSceneRasterizer / timing maths', () => {
  it('parses css time lists in seconds and milliseconds', () => {
    expect(parseCssTimeList('0.6s', 1)).toEqual([0.6]);
    expect(parseCssTimeList('600ms, 1s', 2)).toEqual([0.6, 1]);
    // Fewer entries than animations → CSS repeats the last value.
    expect(parseCssTimeList('0.4s', 3)).toEqual([0.4, 0.4, 0.4]);
    expect(parseCssTimeList(null, 2)).toEqual([0, 0]);
  });

  it('parses iteration counts, mapping infinite to Infinity', () => {
    expect(parseCssIterationList('1', 1)).toEqual([1]);
    expect(parseCssIterationList('infinite', 1)).toEqual([Infinity]);
    expect(parseCssIterationList('2, infinite', 2)).toEqual([2, Infinity]);
  });

  it('freezes an animation at t with a negative delay', () => {
    const css = buildSeekCss(
      [{ id: 0, pseudo: '', delays: [0], durations: [1], iterations: [1] }],
      0.75
    );
    expect(css).toContain('[data-procut-anim="0"]{');
    expect(css).toContain('animation-delay:-0.7500s !important');
    expect(css).toContain('animation-play-state:paused !important');
  });

  it('compensates for the authored delay', () => {
    const css = buildSeekCss(
      [{ id: 1, pseudo: '', delays: [0.4], durations: [1], iterations: [1] }],
      0.9
    );
    // local time = 0.9 - 0.4 = 0.5s into the animation
    expect(css).toContain('animation-delay:-0.5000s !important');
  });

  it('holds the pre-roll state while inside the authored delay', () => {
    const css = buildSeekCss(
      [{ id: 2, pseudo: '', delays: [1.5], durations: [1], iterations: [1] }],
      0.5
    );
    // Not started yet → positive delay, element shows its base/fill state.
    expect(css).toContain('animation-delay:1.0000s !important');
  });

  it('wraps infinite loops instead of unwinding every iteration', () => {
    const css = buildSeekCss(
      [{ id: 3, pseudo: '::before', delays: [0], durations: [0.5], iterations: [Infinity] }],
      12.3
    );
    expect(css).toContain('[data-procut-anim="3"]::before{');
    // 12.3 mod 0.5 = 0.3
    expect(css).toContain('animation-delay:-0.3000s !important');
  });

  it('emits one rule per animation when an element has several', () => {
    const css = buildSeekCss(
      [{ id: 4, pseudo: '', delays: [0, 0.2], durations: [1, 2], iterations: [1, 1] }],
      1.2
    );
    expect(css).toContain('animation-delay:-1.2000s,-1.0000s !important');
  });

  it('clamps negative scene times to zero', () => {
    const css = buildSeekCss(
      [{ id: 5, pseudo: '', delays: [0], durations: [1], iterations: [1] }],
      -5
    );
    expect(css).toContain('animation-delay:0.0000s');
  });

  it('degrades gracefully without a DOM (SSR / node)', () => {
    expect(sanitizeMotionSceneHtml('<div>x</div>')).toBe('<div>x</div>');
    expect(sanitizeMotionSceneHtml('')).toBe('');
  });
});

describe('generateMotionGraphicsFromDialogue / parsing', () => {
  it('parses fenced JSON responses', () => {
    const parsed = parseJsonSafely('```json\n{"duration":4}\n```');
    expect(parsed.duration).toBe(4);
  });

  it('salvages a JSON object surrounded by prose', () => {
    const parsed = parseJsonSafely('Here you go:\n{"duration":7,"ok":true}\nHope it helps!');
    expect(parsed.duration).toBe(7);
    expect(parsed.ok).toBe(true);
  });

  it('salvages JSON truncated mid-scene', () => {
    const raw = '{"duration":6,"htmlCssScenes":[{"enterAt":0,"exitAt":3,"htmlCss":"<div style=\\"color:red\\">hi';
    const parsed = parseJsonSafely(raw);
    expect(parsed.duration).toBe(6);
    expect(Array.isArray(parsed.htmlCssScenes)).toBe(true);
  });

  it('returns an empty object for unrecoverable input', () => {
    expect(parseJsonSafely('not json at all')).toEqual({});
    expect(parseJsonSafely('')).toEqual({});
  });

  it('clamps and orders scenes, and never returns an empty composition', () => {
    const spec = sanitizeMotionGraphicSpec(
      {
        duration: 8,
        htmlCssScenes: [
          { enterAt: 99, exitAt: 400, description: 'late', htmlCss: '<div>b</div>' },
          { enterAt: 0, exitAt: -5, description: 'early', htmlCss: '<div>a</div>' },
          { enterAt: 1, exitAt: 2, description: 'blank', htmlCss: '   ' },
        ],
      },
      8
    );

    expect(spec.duration).toBe(8);
    expect(spec.htmlCssScenes.length).toBe(2); // blank scene dropped
    expect(spec.htmlCssScenes[0].description).toBe('early');
    expect(spec.htmlCssScenes[0].exitAt).toBeGreaterThan(spec.htmlCssScenes[0].enterAt);
    expect(spec.htmlCssScenes[1].enterAt).toBeLessThanOrEqual(spec.duration - 0.1);
    // canvasElements empty + scenes present → no synthetic TitleCard needed
    expect(spec.canvasElements.length).toBe(0);
  });

  it('falls back to a TitleCard when the AI returns nothing usable', () => {
    const spec = sanitizeMotionGraphicSpec({}, 5);
    expect(spec.canvasElements.length).toBe(1);
    expect(spec.canvasElements[0].component).toBe('TitleCard');
    expect(spec.duration).toBe(5);
  });

  it('normalises canvas element timing', () => {
    const spec = sanitizeMotionGraphicSpec(
      {
        duration: 10,
        canvasElements: [
          { component: 'KineticWord', enterAt: 'bad', exitAt: 999, config: { text: 'hi' } },
        ],
      },
      10
    );
    const el = spec.canvasElements[0];
    expect(el.enterAt).toBe(0);
    expect(el.exitAt).toBe(10);
    expect(el.config).toEqual({ text: 'hi' });
  });
});
