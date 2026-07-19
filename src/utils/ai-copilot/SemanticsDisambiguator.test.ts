import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  pickPlan,
  buildSystemHint,
  runSelfTests as runDisambiguatorTests,
} from './SemanticsDisambiguator';

describe('SemanticsDisambiguator', () => {
  it('detects mask/alpha intent', () => {
    const plans = detectIntent('modify the mask/alpha channel properties');
    expect(plans[0]?.intent).toBe('mask-alpha');
  });

  it('detects color intent', () => {
    const plans = detectIntent('apply a warmer look to this clip');
    expect(plans[0]?.intent).toBe('color');
  });

  it('detects audio intent', () => {
    const plans = detectIntent('turn the audio down');
    expect(plans[0]?.intent).toBe('audio');
  });

  it('detects transition intent', () => {
    const plans = detectIntent('add a crossfade between these two clips');
    expect(plans[0]?.intent).toBe('transition');
  });

  it('returns no plan for gibberish', () => {
    const { plan, clarifyingOptions } = pickPlan('asdfqwer zxcv');
    expect(plan).toBeNull();
    expect(clarifyingOptions).toBeUndefined();
  });

  it('routes mask/alpha to updateClip', () => {
    const { plan } = pickPlan('modify the mask/alpha');
    expect(plan?.canonicalTool).toBe('updateClip');
    expect(plan?.intent).toBe('mask-alpha');
  });

  it('buildSystemHint locks down the arg shape', () => {
    const { plan } = pickPlan('modify the mask/alpha');
    const hint = buildSystemHint(plan!);
    expect(hint).toContain('mask');
    expect(hint).toContain('updateClip');
    expect(hint).toMatch(/never invent/i);
  });

  it('passes all internal self-tests', () => {
    const tests = runDisambiguatorTests();
    const failures = tests.filter((t) => !t.ok);
    if (failures.length > 0) {
      console.error('Disambiguator self-test failures:', failures);
    }
    expect(failures.length).toBe(0);
  });
});
