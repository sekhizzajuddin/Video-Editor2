// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/App.tsx (editing tools)
//   src/components/TopToolbar.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Type,
  Music,
  Scissors,
  Trash2,
  CopyPlus,
  Sparkles,
  ClipboardPaste,
  Copy,
  Gauge,
  SlidersHorizontal,
  ArrowLeftRight,
  LayoutTemplate,
  Mic,
  PictureInPicture2,
  Check,
  Palette,
  Crop,
  Volume2,
} from 'lucide-react';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';

export interface MobileToolRailProps {
  onAddMedia: () => void;
  onAddText: () => void;
  onAddAudio: () => void;
  onAddEffect: () => void;
  onAddTransition: () => void;
  onAddTemplate: () => void;
  onOpenAiVoice: () => void;
  onAddPip: () => void;
  onOpenProperties: (tab?: string) => void;
}

export function MobileToolRail({
  onAddMedia,
  onAddText,
  onAddAudio,
  onAddEffect,
  onAddTransition,
  onAddTemplate,
  onOpenAiVoice,
  onAddPip,
  onOpenProperties,
}: MobileToolRailProps) {
  const {
    selectedClipId,
    selectedClipIds,
    splitClip,
    removeClip,
    duplicateClip,
    copyClip,
    pasteClip,
    clipboardData,
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
      copyClip: s.copyClip,
      pasteClip: s.pasteClip,
      clipboardData: s.clipboardData,
      currentTime: s.currentTime,
      tracks: s.tracks,
      pipWindows: s.pipWindows,
    }))
  );

  const targetId = selectedClipIds[0] || selectedClipId;
  const hasSelection = !!targetId;
  const targetClip = hasSelection ? findClipInTracks(tracks, targetId, pipWindows) : null;
  const isText = !!targetClip?.textSettings;

  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showPasteMenu, setShowPasteMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false);
        setShowPasteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleCopyOption = (type: 'whole' | 'base' | 'style' | 'style-with-position' | 'style-only') => {
    copyClip(type as any);
    setShowCopyMenu(false);
    toast.success(`Copied (${type.replace(/-/g, ' ')})`);
  };

  const handlePasteOption = (type: 'whole' | 'base' | 'style' | 'style-with-position' | 'style-only') => {
    pasteClip(type as any);
    setShowPasteMenu(false);
    toast.success(`Pasted (${type.replace(/-/g, ' ')})`);
  };

  const Tool = ({
    icon,
    label,
    onClick,
    accent,
    disabled,
    active,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    accent?: boolean;
    disabled?: boolean;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-[56px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-colors active:bg-white/10 disabled:opacity-30 ${
        active ? 'text-amber-400 font-semibold' : 'text-white/80'
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 ${
          accent
            ? 'bg-amber-500 text-black shadow-sm'
            : active
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-white/10 text-white'
        }`}
      >
        {icon}
      </span>
      <span className="text-[10px] leading-tight whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <div ref={menuRef} className="relative shrink-0 border-t border-white/10 bg-[#141418] px-2 py-1">
      {/* Floating Copy Menu */}
      {showCopyMenu && (
        <div className="absolute bottom-[68px] left-16 z-50 flex flex-col gap-1 rounded-xl border border-white/15 bg-[#1e1e24] p-1.5 shadow-2xl backdrop-blur-lg">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Copy Options</p>
          <button
            onClick={() => handleCopyOption('whole')}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Copy className="h-3.5 w-3.5 text-amber-400" />
            <span>Copy Whole Clip</span>
          </button>
          <button
            onClick={() => handleCopyOption('base')}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Copy className="h-3.5 w-3.5 text-blue-400" />
            <span>Copy Base (Timing & Core)</span>
          </button>
          <button
            onClick={() => handleCopyOption('style')}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Copy Style (Color/FX)</span>
          </button>
          {isText && (
            <>
              <button
                onClick={() => handleCopyOption('style-with-position')}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
              >
                <Type className="h-3.5 w-3.5 text-teal-400" />
                <span>Text Style + Position</span>
              </button>
              <button
                onClick={() => handleCopyOption('style-only')}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
              >
                <Type className="h-3.5 w-3.5 text-pink-400" />
                <span>Only Font / Typography</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Floating Paste Menu */}
      {showPasteMenu && (
        <div className="absolute bottom-[68px] left-32 z-50 flex flex-col gap-1 rounded-xl border border-white/15 bg-[#1e1e24] p-1.5 shadow-2xl backdrop-blur-lg">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Paste Options</p>
          <button
            onClick={() => handlePasteOption('whole')}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-amber-400" />
            <span>Paste Whole</span>
          </button>
          <button
            onClick={() => handlePasteOption('base')}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-blue-400" />
            <span>Paste Base</span>
          </button>
          <button
            onClick={() => handlePasteOption('style')}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Paste Style</span>
          </button>
        </div>
      )}

      {/* Horizontal Scroll Bar */}
      <div className="flex items-center justify-start gap-1 overflow-x-auto no-scrollbar touch-pan-x py-1">
        {hasSelection ? (
          <>
            <Tool icon={<Scissors className="h-4 w-4" />} label="Split" onClick={handleSplit} />
            <Tool icon={<Sparkles className="h-4 w-4 text-cyan-400" />} label="AI" onClick={() => onOpenProperties('ai')} />
            <Tool icon={<SlidersHorizontal className="h-4 w-4" />} label="Transform" onClick={() => onOpenProperties('style')} />
            <Tool icon={<Palette className="h-4 w-4 text-pink-400" />} label="Color" onClick={() => onOpenProperties('color')} />
            {isText && <Tool icon={<Type className="h-4 w-4 text-teal-400" />} label="Text" onClick={() => onOpenProperties('text')} />}
            <Tool icon={<Volume2 className="h-4 w-4 text-emerald-400" />} label="Audio" onClick={() => onOpenProperties('audio')} />
            <Tool icon={<Gauge className="h-4 w-4 text-blue-400" />} label="Speed" onClick={() => onOpenProperties('speed')} />
            <Tool icon={<Crop className="h-4 w-4 text-amber-400" />} label="Mask" onClick={() => onOpenProperties('mask')} />
            <Tool
              icon={<Copy className="h-4 w-4" />}
              label="Copy"
              active={showCopyMenu}
              onClick={() => {
                setShowCopyMenu(!showCopyMenu);
                setShowPasteMenu(false);
              }}
            />
            <Tool
              icon={<ClipboardPaste className="h-4 w-4" />}
              label="Paste"
              active={showPasteMenu}
              onClick={() => {
                setShowPasteMenu(!showPasteMenu);
                setShowCopyMenu(false);
              }}
              disabled={!(clipboardData?.clips && clipboardData.clips.length > 0)}
            />
            <Tool icon={<CopyPlus className="h-4 w-4" />} label="Duplicate" onClick={handleDuplicate} />
            <Tool icon={<Trash2 className="h-4 w-4 text-rose-400" />} label="Delete" onClick={handleDelete} />
          </>
        ) : (
          <>
            <Tool icon={<Plus className="h-4 w-4" />} label="Media" accent onClick={onAddMedia} />
            <Tool icon={<Mic className="h-4 w-4 text-amber-400" />} label="AI Voice" onClick={onOpenAiVoice} />
            <Tool icon={<PictureInPicture2 className="h-4 w-4 text-cyan-400" />} label="PiP Window" onClick={onAddPip} />
            <Tool icon={<ArrowLeftRight className="h-4 w-4 text-blue-400" />} label="Transitions" onClick={onAddTransition} />
            <Tool icon={<LayoutTemplate className="h-4 w-4 text-teal-400" />} label="Templates" onClick={onAddTemplate} />
            <Tool icon={<Music className="h-4 w-4 text-emerald-400" />} label="Audio" onClick={onAddAudio} />
            <Tool icon={<Type className="h-4 w-4 text-purple-400" />} label="Text" onClick={onAddText} />
            <Tool icon={<Sparkles className="h-4 w-4 text-rose-400" />} label="Effects" onClick={onAddEffect} />
          </>
        )}
      </div>
    </div>
  );
}
