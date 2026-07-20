import { X, Layers, Image as ImageIcon } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { SequenceTransitionType } from '@/types';

export function SequenceProperties() {
  const {
    tracks,
    selectedClipId,
    selectedClipIds,
    updateSequence,
    dissolveSequence,
    sequences,
  } = useEditorStore();

  const primarySelectedId = selectedClipId || (selectedClipIds.length > 0 ? selectedClipIds[0] : null);
  if (!primarySelectedId) return null;

  // Find the selected clip to see if it belongs to a sequence
  let selectedClip: any = null;
  for (const track of tracks) {
    const clip = track.clips.find(c => c.id === primarySelectedId);
    if (clip) {
      selectedClip = clip;
      break;
    }
  }

  if (!selectedClip || !selectedClip.sequenceId) return null;

  const sequence = sequences?.find(s => s.id === selectedClip.sequenceId);
  if (!sequence) return null;

  const handleUpdate = (patch: Partial<typeof sequence>) => {
    updateSequence(sequence.id, patch);
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 flex flex-col gap-3 mb-3 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between pb-2 border-b border-[#3e3e3e]/50">
        <h3 className="text-xs font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-500" />
          Image Sequence
        </h3>
        <button
          onClick={() => dissolveSequence(sequence.id)}
          className="p-1 hover:bg-[#3e3e3e] text-[#a0a0a0] hover:text-red-400 rounded transition-colors"
          title="Dissolve Sequence (Keep Clips)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="flex items-center gap-2 text-[10px] text-[#888]">
        <ImageIcon className="w-3 h-3" />
        <span>{sequence.memberClipIds.length} Images</span>
        <span className="mx-1">•</span>
        <span>{sequence.totalDuration.toFixed(1)}s Total</span>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] text-[#a0a0a0] block font-medium">Interpolation & Transition</label>
        <select
          value={sequence.transitionType}
          onChange={(e) => handleUpdate({ transitionType: e.target.value as SequenceTransitionType })}
          className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white px-2 py-1.5 focus:outline-none focus:border-emerald-500"
        >
          <option value="none">Cut (No Transition)</option>
          <option value="crossfade">Crossfade (Overlap)</option>
          <option value="kenburnsFade">Ken Burns + Crossfade (Preview)</option>
          <option value="kenburnsAuto">Ken Burns (Export Grade)</option>
        </select>
        <p className="text-[9px] text-[#8a8a8a] leading-tight">
          {sequence.transitionType === 'kenburnsAuto' ? 'Uses optical flow morphing for export. Plays back as Ken Burns + Crossfade in preview for performance.' : 'Standard blending between images.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="space-y-1">
          <label className="text-[10px] text-[#a0a0a0] block">Image Duration (s)</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={sequence.defaultClipDuration}
            onChange={(e) => handleUpdate({ defaultClipDuration: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-[#a0a0a0] block">Overlap (s)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={sequence.overlap}
            onChange={(e) => handleUpdate({ overlap: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-emerald-500"
            disabled={sequence.transitionType === 'crossfade'}
          />
        </div>
      </div>
    </div>
  );
}
