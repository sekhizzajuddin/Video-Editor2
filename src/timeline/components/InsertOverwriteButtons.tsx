import React from 'react';
import { ArrowLeftToLine, ArrowRightToLine } from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

export const InsertOverwriteButtons = React.memo(function InsertOverwriteButtons() {
  const { insertClip, overwriteClip, selectedClipId } = useEditorStore(useShallow(s => ({ insertClip: s.insertClip, overwriteClip: s.overwriteClip, selectedClipId: s.selectedClipId })));
  
  const handleInsert = () => {
    if (!selectedClipId) return;
    
    const state = useEditorStore.getState();
    const clip = findClipDeep(state, selectedClipId)?.clip;
    if (!clip) return;
    
    // Create a copy of the clip to insert
    insertClip({ ...clip, id: crypto.randomUUID() }, state.currentTime, clip.trackId);
  };
  
  const handleOverwrite = () => {
    if (!selectedClipId) return;
    
    const state = useEditorStore.getState();
    const clip = findClipDeep(state, selectedClipId)?.clip;
    if (!clip) return;
    
    // Create a copy of the clip to overwrite
    overwriteClip({ ...clip, id: crypto.randomUUID() }, state.currentTime, clip.trackId);
  };
  
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleInsert}
        title="Insert Edit: Insert clip at playhead and shift downstream clips right"
        disabled={!selectedClipId}
        className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ArrowLeftToLine className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleOverwrite}
        title="Overwrite Edit: Replace content at playhead position"
        disabled={!selectedClipId}
        className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ArrowRightToLine className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
