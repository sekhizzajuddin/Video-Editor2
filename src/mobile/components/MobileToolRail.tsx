// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/App.tsx (editing tools)
//   src/components/TopToolbar.tsx
// ─────────────────────────────────────────────────────────────────────────────

import {
  Plus,
  Type,
  Music,
  Scissors,
  Trash2,
  CopyPlus,
  Sticker,
} from 'lucide-react';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';

export interface MobileToolRailProps {
  onAddMedia: () => void;
  onAddText: () => void;
  onAddAudio: () => void;
  onAddEffect: () => void;
}

export function MobileToolRail({
  onAddMedia,
  onAddText,
  onAddAudio,
  onAddEffect,
}: MobileToolRailProps) {
  const {
    selectedClipId,
    selectedClipIds,
    splitClip,
    removeClip,
    duplicateClip,
    currentTime,
    tracks,
    pipWindows,
  } = useEditorStore(
    useShallow((s) => ({
      selectedClipId: s.selectedClipId,
      selectedClipIds: s.selectedClipIds,
      splitClip: s.splitClip,
      removeClip: s.removeClip,
      duplicateClip: s.duplicateClip,
      currentTime: s.currentTime,
      tracks: s.tracks,
      pipWindows: s.pipWindows,
    }))
  );

  const targetId = selectedClipIds[0] || selectedClipId;
  const hasSelection = !!targetId;

  const handleSplit = () => {
    const state = useEditorStore.getState();
    const t = state.currentTime;
    if (state.selectedClipIds.length > 0) {
      let split = false;
      state.selectedClipIds.forEach((id) => {
        const c = findClipInTracks(state.tracks, id, state.pipWindows);
        if (c && t > c.startTime + 0.01 && t < c.startTime + c.duration - 0.01) {
          splitClip(id, t);
          split = true;
        }
      });
      if (!split) toast.warning('Playhead is not over the selected clip.');
    } else if (targetId) {
      const c = findClipInTracks(state.tracks, targetId, state.pipWindows);
      if (c && t > c.startTime + 0.01 && t < c.startTime + c.duration - 0.01) {
        splitClip(targetId, t);
      } else {
        toast.warning('Playhead is not over the clip.');
      }
    } else {
      toast.warning('Select a clip first.');
    }
  };

  const handleDelete = () => {
    if (!targetId) {
      toast.warning('Select a clip first.');
      return;
    }
    removeClip(targetId);
    toast.success('Clip deleted');
  };

  const handleDuplicate = () => {
    if (!targetId) {
      toast.warning('Select a clip first.');
      return;
    }
    duplicateClip();
    toast.success('Clip duplicated');
  };

  const Tool = ({
    icon,
    label,
    onClick,
    accent,
    disabled,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    accent?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-white/80 active:bg-white/10 disabled:opacity-30"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full ${
          accent ? 'bg-amber-500 text-black' : 'bg-white/10'
        }`}
      >
        {icon}
      </span>
      <span className="text-[9px] leading-none">{label}</span>
    </button>
  );

  return (
    <div className="flex shrink-0 items-center justify-around gap-0.5 border-t border-white/10 bg-[#16161a] px-1 py-1">
      <Tool icon={<Plus className="h-4 w-4" />} label="Add" accent onClick={onAddMedia} />
      <Tool icon={<Music className="h-4 w-4" />} label="Audio" onClick={onAddAudio} />
      <Tool icon={<Type className="h-4 w-4" />} label="Text" onClick={onAddText} />
      <Tool icon={<Sticker className="h-4 w-4" />} label="Effects" onClick={onAddEffect} />
      <Tool
        icon={<Scissors className="h-4 w-4" />}
        label="Split"
        onClick={handleSplit}
        disabled={!hasSelection}
      />
      <Tool
        icon={<CopyPlus className="h-4 w-4" />}
        label="Duplicate"
        onClick={handleDuplicate}
        disabled={!hasSelection}
      />
      <Tool
        icon={<Trash2 className="h-4 w-4" />}
        label="Delete"
        onClick={handleDelete}
        disabled={!hasSelection}
      />
    </div>
  );
}
