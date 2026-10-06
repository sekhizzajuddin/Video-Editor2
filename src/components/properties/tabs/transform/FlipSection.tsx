import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface FlipSectionProps {
  clip: TimelineClip;
  updateClip: (id: string, updates: any) => void;
}

export function FlipSection({ clip, updateClip }: FlipSectionProps) {
  const isFlipped = !!(clip.transform.flipH || clip.transform.flipV);

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          onClick={() => {
            const currentClip = useEditorStore.getState().tracks.flatMap(t => t.clips).find(x => x.id === clip.id) || clip;
            const cur = currentClip.transform.flipH ?? false;
            updateClip(clip.id, { transform: { ...currentClip.transform, flipH: !cur } });
            scheduleSaveSnapshot('Flip Horizontal');
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            clip.transform.flipH ? 'bg-amber-500 text-black font-bold shadow-sm' : 'bg-[var(--theme-bg-subpanel,#3e3e3e)] text-white hover:bg-[#4a4a4a]'
          }`}
        >
          Flip Horizontal
        </button>
        <button
          onClick={() => {
            const currentClip = useEditorStore.getState().tracks.flatMap(t => t.clips).find(x => x.id === clip.id) || clip;
            const cur = currentClip.transform.flipV ?? false;
            updateClip(clip.id, { transform: { ...currentClip.transform, flipV: !cur } });
            scheduleSaveSnapshot('Flip Vertical');
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            clip.transform.flipV ? 'bg-amber-500 text-black font-bold shadow-sm' : 'bg-[var(--theme-bg-subpanel,#3e3e3e)] text-white hover:bg-[#4a4a4a]'
          }`}
        >
          Flip Vertical
        </button>
      </div>
      {isFlipped && (
        <button
          onClick={() => {
            const currentClip = useEditorStore.getState().tracks.flatMap(t => t.clips).find(x => x.id === clip.id) || clip;
            updateClip(clip.id, { transform: { ...currentClip.transform, flipH: false, flipV: false } });
            scheduleSaveSnapshot('Reset Flip');
          }}
          className="w-full py-1.5 px-3 rounded text-[11px] font-medium text-[var(--theme-text-muted,#9ca3af)] hover:text-white hover:bg-white/5 flex items-center justify-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Flip</span>
        </button>
      )}
    </div>
  );
}
