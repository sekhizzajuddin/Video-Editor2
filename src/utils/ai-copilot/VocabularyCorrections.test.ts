import { describe, it, expect } from 'vitest';
import {
  normalizeVocabulary,
  buildVocabularySnapshot,
  buildVocabularyHint,
  runSelfTests as runVocabSelfTests,
} from './VocabularyCorrections';

describe('VocabularyCorrections', () => {
  it('corrects modifl → modify', () => {
    expect(normalizeVocabulary('modifl the mask')).toContain('modify');
  });

  it('corrects alhpa → alpha', () => {
    expect(normalizeVocabulary('alhpa channel')).toContain('alpha');
  });

  it('buildVocabularySnapshot detects typos', () => {
    const snap = buildVocabularySnapshot('modifl the mask/alpha channel');
    expect(snap.normalizedInput).toContain('modify');
    expect(snap.correctionsApplied.some((c) => c.original === 'modifl')).toBe(true);
  });

  it('rewrites canonical phrases', () => {
    expect(normalizeVocabulary('change the mask of the clip'))
      .toContain('modify the mask and alpha properties of the selected clip');
    expect(normalizeVocabulary('make this clip brighter'))
      .toContain('increase exposure by 25');
    expect(normalizeVocabulary('turn it down please'))
      .toContain('set volume to 20');
  });

  it('produces hint only when corrections exist', () => {
    const hint = buildVocabularyHint('modify the clip');
    expect(hint).toBe('');
    const hint2 = buildVocabularyHint('modifl the clip');
    expect(hint2).toContain('USER VOCABULARY CORRECTIONS');
  });

  it('passes all internal self-tests', () => {
    const tests = runVocabSelfTests();
    const failures = tests.filter((t) => !t.ok);
    if (failures.length > 0) {
      console.error('Vocabulary self-test failures:', failures);
    }
    expect(failures.length).toBe(0);
  });
});
