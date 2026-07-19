import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from './MemoryStore';

describe('MemoryStore — Phase 4 reference resolver', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('records and returns last action', () => {
    const a = store.recordAction({
      toolName: 'addClip',
      args: { mediaId: 'm1' },
      rawPrompt: 'add clip',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    expect(store.getLastAction()?.id).toBe(a.id);
  });

  it('parseToolReference finds valid tool names', () => {
    const ref = store.parseToolReference(
      'do that addClip thing again',
      ['addClip', 'updateClip', 'splitClip']
    );
    expect(ref).toBe('addClip');
  });

  it('parseToolReference rejects invalid tool names (BUG #6 fix)', () => {
    const ref = store.parseToolReference(
      'do that color thing again',
      ['addClip', 'splitClip', 'updateClip']
    );
    expect(ref).toBeNull();
  });

  it('parseToolReference without validation returns raw match (backward compat)', () => {
    const ref = store.parseToolReference('do that anything thing');
    expect(ref).toBe('anything');
  });

  it('resolveToolReference returns null without history', () => {
    const result = store.resolveToolReference('do addClip again', 'addClip');
    expect(result.isReference).toBe(false);
  });

  it('resolveToolReference finds matching history', () => {
    store.recordAction({
      toolName: 'addClip',
      args: { mediaId: 'abc' },
      rawPrompt: 'add media abc',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    const result = store.resolveToolReference('do that addClip again', 'addClip');
    expect(result.isReference).toBe(true);
    expect(result.originalAction?.toolName).toBe('addClip');
  });

  it('getLastActionByTool returns first match from end', () => {
    store.recordAction({
      toolName: 'addClip',
      args: { a: 1 },
      rawPrompt: 'first',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    store.recordAction({
      toolName: 'updateClip',
      args: { b: 2 },
      rawPrompt: 'second',
      intent: 'UPDATE_CLIP',
      resultStatus: 'success',
    });
    store.recordAction({
      toolName: 'addClip',
      args: { c: 3 },
      rawPrompt: 'third',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    const act = store.getLastActionByTool('addClip');
    expect(act?.rawPrompt).toBe('third');
  });

  it('getLastWorkflowActions returns actions with workflow: intent', () => {
    store.recordAction({
      toolName: 'addClip',
      args: { a: 1 },
      rawPrompt: 'wf step 1',
      intent: 'workflow:abc',
      resultStatus: 'success',
    });
    store.recordAction({
      toolName: 'splitClip',
      args: { a: 1 },
      rawPrompt: 'wf step 2',
      intent: 'workflow:abc',
      resultStatus: 'success',
    });
    store.recordAction({
      toolName: 'addClip',
      args: { a: 1 },
      rawPrompt: 'manual',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    const wf = store.getLastWorkflowActions(5);
    expect(wf.length).toBe(2);
    expect(wf[0].rawPrompt).toBe('wf step 1');
  });

  it('isReferenceCommand detects common patterns', () => {
    expect(store.isReferenceCommand('do that again')).toBe(true);
    expect(store.isReferenceCommand('repeat that')).toBe(true);
    expect(store.isReferenceCommand('do the last one')).toBe(true);
    expect(store.isReferenceCommand('add a clip')).toBe(false);
  });

  it('clearHistory wipes everything', () => {
    store.recordAction({
      toolName: 'addClip',
      args: {},
      rawPrompt: 't',
      intent: 'ADD_CLIP',
      resultStatus: 'success',
    });
    store.clearHistory();
    expect(store.getLastAction()).toBeNull();
  });

  it('prunes history at MAX_HISTORY (50)', () => {
    for (let i = 0; i < 60; i++) {
      store.recordAction({
        toolName: 'addClip',
        args: { i },
        rawPrompt: `p${i}`,
        intent: 'ADD_CLIP',
        resultStatus: 'success',
      });
    }
    const stats = store.getStats();
    expect(stats.totalActions).toBeLessThanOrEqual(50);
  });
});
