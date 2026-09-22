import React from 'react';
import { ArrowLeftToLine, ArrowRightToLine } from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { generateId } from '../timelineUtils';

export const InsertOverwriteButtons = React.memo(function InsertOverwriteButtons() {
  const { insertClip, overwriteClip, selectedClipId } = useEditorStore(useShallow(s => ({ insertClip: s.insertClip, overwriteClip: s.overwriteClip, selectedClipId: s.selectedClipId })));
  
  const handleInsert = () => {
    if (!selectedClipId) return;
    
    const state = useEditorStore.getState();
    const clip = findClipDeep(state, selectedClipId)?.clip;
    if (!clip) return;
    
    // P3 FIX: the copy used crypto.randomUUID (undefined on non-secure contexts →
    // TypeError, button silently failed) and kept linkedClipId/splitGroupId — the
    // duplicate claimed membership of the original's split group and stayed linked
    // to its partner (timing changes propagated to it). Clear both.
    insertClip({ ...clip, id: generateId(), linkedClipId: undefined, splitGroupId: undefined }, state.currentTime, clip.trackId);
  };
  
  const handleOverwrite = () => {
    if (!selectedClipId) return;
    
    const state = useEditorStore.getState();
    const clip = findClipDeep(state, selectedClipId)?.clip;
    if (!clip) return;
    
    // P3 FIX: same as handleInsert — safe id + clear link/split identity
    overwriteClip({ ...clip, id: generateId(), linkedClipId: undefined, splitGroupId: undefined }, state.currentTime, clip.trackId);
  };
  
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleInsert}
        title="Insert Edit: Insert clip at playhead and shift downstream clips right"
        disabled={!selectedClipId}
        className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--theme-text-muted)]"
      >
        <ArrowLeftToLine className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleOverwrite}
        title="Overwrite Edit: Replace content at playhead position"
        disabled={!selectedClipId}
        className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--theme-text-muted)]"
      >
        <ArrowRightToLine className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
