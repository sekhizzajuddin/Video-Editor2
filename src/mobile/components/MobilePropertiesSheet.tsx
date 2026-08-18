// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/properties/PropertiesPanel.tsx
//   src/components/properties/tabs/
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  Scissors,
  Trash2,
  CopyPlus,
  Copy,
  ClipboardPaste,
  Type,
  Volume2,
  SlidersHorizontal,
  Palette,
} from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';
import type { ClipColorFilters } from '@/types';

type Tab = 'style' | 'color' | 'text' | 'audio';

const DEFAULT_COLOR_FILTERS: ClipColorFilters = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  contrast: 100,
  saturation: 100,
  blur: 0,
  fadedFilm: 0,
  vignette: 0,
};

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'];

export function MobilePropertiesSheet({ onClose }: { onClose: () => void }) {
  const {
    selectedClipId,
    tracks,
    pipWindows,
    mediaLibrary,
    splitClip,
    removeClip,
    duplicateClip,
    copyClip,
    pasteClip,
    updateClip,
  } = useEditorStore(
    useShallow((s) => ({
      selectedClipId: s.selectedClipId,
      tracks: s.tracks,
      pipWindows: s.pipWindows,
      mediaLibrary: s.mediaLibrary,
      splitClip: s.splitClip,
      removeClip: s.removeClip,
      duplicateClip: s.duplicateClip,
      copyClip: s.copyClip,
      pasteClip: s.pasteClip,
      updateClip: s.updateClip,
    }))
  );

  const clip = useMemo(() => {
    if (!selectedClipId) return null;
    const found = findClipDeep({ tracks, pipWindows } as any, selectedClipId);
    return found?.clip ?? null;
  }, [selectedClipId, tracks, pipWindows]);

  const mediaType = useMemo(() => {
    if (!clip) return null;
    return mediaLibrary.find((m) => m.id === clip.mediaId)?.type ?? null;
  }, [clip, mediaLibrary]);

  const isText = !!clip?.textSettings;
  const isAudio = mediaType === 'audio' || !!clip?.audioSettings;
  const [tab, setTab] = useState<Tab>(isText ? 'text' : isAudio ? 'audio' : 'style');

  if (!clip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <SlidersHorizontal className="h-8 w-8 text-white/20" />
        <p className="text-[13px] text-white/50">Tap a clip on the timeline to edit it.</p>
        <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white">
          Done
        </button>
      </div>
    );
  }

  const t = clip.transform ?? { x: 0, y: 0, scale: 100, rotation: 0 };
  const color: ClipColorFilters = clip.colorFilters ?? DEFAULT_COLOR_FILTERS;

  const setTransform = (patch: Partial<typeof t>) => {
    updateClip(clip.id, { transform: { ...t, ...patch } });
    scheduleSaveSnapshot('Transform');
  };
  const setColor = (patch: Partial<typeof color>) => {
    updateClip(clip.id, { colorFilters: { ...color, ...patch } });
    scheduleSaveSnapshot('Color');
  };
  const setAudio = (patch: any) => {
    const cur = clip.audioSettings ?? {
      volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0,
      muted: false, preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false,
    };
    updateClip(clip.id, { audioSettings: { ...cur, ...patch } });
    scheduleSaveSnapshot('Audio');
  };

  const doSplit = () => {
    const state = useEditorStore.getState();
    const now = state.currentTime;
    if (now > clip.startTime + 0.01 && now < clip.startTime + clip.duration - 0.01) {
      splitClip(clip.id, now);
    } else {
      toast.warning('Playhead is not over the clip.');
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Type }[] = [
    { id: 'style', label: 'Style', icon: SlidersHorizontal },
    { id: 'color', label: 'Color', icon: Palette },
    ...(isText ? [{ id: 'text' as Tab, label: 'Text', icon: Type }] : []),
    ...(isAudio ? [{ id: 'audio' as Tab, label: 'Audio', icon: Volume2 }] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">
            {clip.textSettings?.text || mediaType || 'Clip'}
          </p>
          <p className="text-[10px] text-white/40">{(clip.duration ?? 0).toFixed(1)}s</p>
        </div>
        <div className="flex items-center gap-1">
          <ActionBtn icon={<Scissors className="h-4 w-4" />} label="Split" onClick={doSplit} />
          <ActionBtn icon={<CopyPlus className="h-4 w-4" />} label="Dup" onClick={duplicateClip} />
          <ActionBtn icon={<Copy className="h-4 w-4" />} label="Copy" onClick={() => copyClip('whole')} />
          <ActionBtn icon={<ClipboardPaste className="h-4 w-4" />} label="Paste" onClick={() => pasteClip('whole')} />
          <ActionBtn icon={<Trash2 className="h-4 w-4 text-rose-400" />} label="Delete" onClick={() => { removeClip(clip.id); onClose(); }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-white/10 px-4 pb-2">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ${
                tab === tb.id ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/70'
              }`}
            >
              <Icon className="h-3 w-3" />
              {tb.label}
            </button>
          );
        })}
      </div>

      <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === 'style' && (
          <div className="space-y-4">
            <Slider label="Position X" value={Math.round(t.x)} min={-1000} max={1000} step={1} onChange={(v) => setTransform({ x: v })} />
            <Slider label="Position Y" value={Math.round(t.y)} min={-1000} max={1000} step={1} onChange={(v) => setTransform({ y: v })} />
            <Slider label="Scale" value={Math.round(t.scale)} min={10} max={400} step={1} suffix="%" onChange={(v) => setTransform({ scale: v })} />
            <Slider label="Rotation" value={Math.round(t.rotation)} min={-180} max={180} step={1} suffix="°" onChange={(v) => setTransform({ rotation: v })} />
            <Slider label="Opacity" value={Math.round((clip.opacity ?? 1) * 100)} min={0} max={100} step={1} suffix="%" onChange={(v) => { updateClip(clip.id, { opacity: v / 100 }); scheduleSaveSnapshot('Opacity'); }} />
            <Slider label="Speed" value={Math.round((clip.speed ?? 1) * 100)} min={25} max={400} step={5} suffix="%" onChange={(v) => { updateClip(clip.id, { speed: v / 100 }); scheduleSaveSnapshot('Speed'); }} />
          </div>
        )}

        {tab === 'color' && (
          <div className="space-y-4">
            <Slider label="Temperature" value={Math.round(color.temperature)} min={-100} max={100} step={1} onChange={(v) => setColor({ temperature: v })} />
            <Slider label="Exposure" value={Math.round(color.exposure)} min={-100} max={100} step={1} onChange={(v) => setColor({ exposure: v })} />
            <Slider label="Contrast" value={Math.round(color.contrast)} min={0} max={200} step={1} onChange={(v) => setColor({ contrast: v })} />
            <Slider label="Saturation" value={Math.round(color.saturation)} min={0} max={200} step={1} onChange={(v) => setColor({ saturation: v })} />
          </div>
        )}

        {tab === 'text' && isText && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Text</label>
              <textarea
                value={clip.textSettings?.text ?? ''}
                rows={2}
                onChange={(e) => {
                  updateClip(clip.id, { textSettings: { ...clip.textSettings!, text: e.target.value } });
                  scheduleSaveSnapshot('Text');
                }}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-2 text-[13px] text-white outline-none focus:border-amber-500"
              />
            </div>
            <Slider label="Font size" value={clip.textSettings?.fontSize ?? 40} min={8} max={160} step={1} onChange={(v) => { updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontSize: v } }); scheduleSaveSnapshot('Text'); }} />
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Color</label>
              <div className="flex flex-wrap gap-2">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { updateClip(clip.id, { textSettings: { ...clip.textSettings!, color: c } }); scheduleSaveSnapshot('Text'); }}
                    className={`h-8 w-8 rounded-full border-2 ${clip.textSettings?.color === c ? 'border-amber-400' : 'border-white/20'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'audio' && (
          <div className="space-y-4">
            <Slider label="Volume" value={Math.round(clip.audioSettings?.volume ?? 0)} min={-40} max={12} step={1} suffix="dB" onChange={(v) => setAudio({ volume: v })} />
            <Slider label="Fade in" value={clip.audioSettings?.fadeIn ?? 0} min={0} max={5} step={0.1} suffix="s" onChange={(v) => setAudio({ fadeIn: v })} />
            <Slider label="Fade out" value={clip.audioSettings?.fadeOut ?? 0} min={0} max={5} step={0.1} suffix="s" onChange={(v) => setAudio({ fadeOut: v })} />
            <button
              onClick={() => setAudio({ muted: !(clip.audioSettings?.muted ?? false) })}
              className={`w-full rounded-lg py-2 text-[12px] font-medium ${clip.audioSettings?.muted ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-white/80'}`}
            >
              {clip.audioSettings?.muted ? 'Unmute clip' : 'Mute clip'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-white/70 active:bg-white/10">
      {icon}
      <span className="text-[8px] leading-none">{label}</span>
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] text-white/50">{label}</label>
        <span className="text-[11px] font-semibold text-white">
          {value}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-500"
      />
    </div>
  );
}
