import { describe, it, expect } from 'vitest';
import { PROCUT_SYSTEM_KNOWLEDGE, buildHelpMessage } from './systemKnowledge';

describe('system knowledge', () => {
  it('covers the major ProCut surfaces the agent must know', () => {
    const text = PROCUT_SYSTEM_KNOWLEDGE.toLowerCase();
    for (const feature of [
      'timeline',
      'chroma',
      'teleprompter',
      'export',
      'keyframes',
      'auto video',
      'scopes',
      'inspectpreview',
    ]) {
      expect(text).toContain(feature);
    }
  });

  it('help message mentions agent capabilities', () => {
    const help = buildHelpMessage().toLowerCase();
    expect(help).toContain('agent');
    expect(help).toContain('preview');
  });
});
