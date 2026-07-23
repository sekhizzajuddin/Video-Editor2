import React from 'react';
import { ArrowLeftToLine, ArrowRightToLine } from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

export function InsertOverwriteButtons() {
  const { insertClip, overwriteClip, selectedClipId, tracks, currentTime } = useEditorStore(useShallow(s => ({ insertClip: s.insertClip, overwriteClip: s.overwriteClip, selectedClipId: s.selectedClipId, tracks: s.tracks, currentTime: s.currentTime })));
  
  const handleInsert = () => {
    if (!selectedClipId) return;
    
    const clip = findClipDeep(useEditorStore.getState(), selectedClipId)?.clip;
    if (!clip) return;
    
    // Create a copy of the clip to insert
    insertClip({ ...clip, id: crypto.randomUUID() }, currentTime, clip.trackId);
  };
  
  const handleOverwrite = () => {
    if (!selectedClipId) return;
    
    const clip = findClipDeep(useEditorStore.getState(), selectedClipId)?.clip;
    if (!clip) return;
    
    // Create a copy of the clip to overwrite
    overwriteClip({ ...clip, id: crypto.randomUUID() }, currentTime, clip.trackId);
  };
  
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleInsert}
        title="Insert Edit: Insert clip at playhead and shift downstream clips right"
        disabled={!selectedClipId}
        className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#a0a0a0]"
      >
        <ArrowLeftToLine className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleOverwrite}
        title="Overwrite Edit: Replace content at playhead position"
        disabled={!selectedClipId}
        className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#a0a0a0]"
      >
        <ArrowRightToLine className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
