import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceCommandParser } from './VoiceCommandParser';
import { memoryStore } from './MemoryStore';

describe('VoiceCommandParser', () => {
  beforeEach(() => {
    // The parser uses the global singleton; clear it before each test.
    memoryStore.clearHistory();
  });

  it('normalize strips common filler words', () => {
    // fillers like "uh", "please" are stripped; middle "the" preserved
    expect(VoiceCommandParser.normalize('uh can you please play the video')).toBe('can you play the video');
    expect(VoiceCommandParser.normalize('um, like, delete that clip')).toBe('delete that clip');
    expect(VoiceCommandParser.normalize('kind of zoom in')).toBe('zoom in');
  });

  it('normalize strips leading articles', () => {
    expect(VoiceCommandParser.normalize('the play button')).toBe('play button');
    const inner = VoiceCommandParser.normalize('add a clip on track 1');
    expect(inner).toContain('add');
    expect(inner).toContain('clip');
  });

  it('normalize collapses whitespace', () => {
    expect(VoiceCommandParser.normalize('  play   the   video  ')).toBe('play the video');
  });

  it('matchesReference returns true for command phrases', () => {
    expect(VoiceCommandParser.matchesReference('do that again')).toBe(true);
    expect(VoiceCommandParser.matchesReference('repeat that')).toBe(true);
    expect(VoiceCommandParser.matchesReference('same as before')).toBe(true);
    expect(VoiceCommandParser.matchesReference('play the video')).toBe(false);
  });

  it('parse handles empty input', () => {
    expect(VoiceCommandParser.parse('')).toEqual({
      normalized: '',
      isReference: false,
    });
  });

  it('parse resolves "do that again" to last action', () => {
    memoryStore.recordAction({
      toolName: 'addClip',
      args: { mediaId: 'm1' },
      rawPrompt: 'add media',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    const result = VoiceCommandParser.parse('do that again');
    expect(result.isReference).toBe(true);
    expect(result.lastAction?.toolName).toBe('addClip');
    expect(result.originalPrompt).toBe('add media');
  });

  it('parse returns hint when no last action exists', () => {
    memoryStore.clearHistory();
    const result = VoiceCommandParser.parse('do that again');
    expect(result.isReference).toBe(true);
    expect(result.hint).toContain('No previous action');
  });

  it('parse returns non-reference for normal prompts', () => {
    const result = VoiceCommandParser.parse('add a clip with fade in');
    expect(result.isReference).toBe(false);
    expect(result.normalized.length).toBeGreaterThan(0);
  });
});
