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
  Sparkles,
  Gauge,
  Crop,
  Layers,
  Wand2,
  Music2,
} from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';
import type { ClipColorFilters } from '@/types';
import { BeatSyncSection, KineticTypographySection, AISFXSection } from '@/components/properties/tabs/effects';
import { loadBackgroundRemover, loadMediaPipeSegmenter, cleanupClipBackgroundState, startClipBackgroundAnalysis } from '@/utils/aiBackground';

type Tab = 'ai' | 'style' | 'color' | 'text' | 'audio' | 'speed' | 'mask';

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
    clipboardData,
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
      clipboardData: s.clipboardData,
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
  const [tab, setTab] = useState<Tab>(isText ? 'text' : isAudio ? 'audio' : 'ai');

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
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'style', label: 'Transform', icon: SlidersHorizontal },
    { id: 'color', label: 'Color', icon: Palette },
    ...(isText ? [{ id: 'text' as Tab, label: 'Text', icon: Type }] : []),
    ...(isAudio ? [{ id: 'audio' as Tab, label: 'Audio', icon: Volume2 }] : []),
    { id: 'speed', label: 'Speed', icon: Gauge },
    { id: 'mask', label: 'Mask', icon: Crop },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 shrink-0">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">
            {clip.textSettings?.text || mediaType || 'Clip'}
          </p>
          <p className="text-[10px] text-white/40">{(clip.duration ?? 0).toFixed(1)}s</p>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 max-w-[60vw]">
          <ActionBtn icon={<Scissors className="h-4 w-4" />} label="Split" onClick={doSplit} />
          <ActionBtn icon={<CopyPlus className="h-4 w-4" />} label="Dup" onClick={duplicateClip} />
          <ActionBtn icon={<Copy className="h-4 w-4" />} label="Copy" onClick={() => { copyClip('whole'); toast.success('Clip copied'); }} />
          
          <ActionBtn 
            icon={<Palette className="h-4 w-4 text-purple-400" />} 
            label="Copy Style" 
            onClick={() => { copyClip(isText ? 'style-with-position' : 'style'); toast.success('Style copied'); }} 
          />

          {clipboardData?.clips?.length > 0 && (
            <>
              <ActionBtn icon={<ClipboardPaste className="h-4 w-4" />} label="Paste" onClick={() => pasteClip('whole')} />
              <ActionBtn 
                icon={<Palette className="h-4 w-4 text-purple-400" />} 
                label="Paste Style" 
                onClick={() => {
                  const clipType = clipboardData.type;
                  const pt = clipType === 'style-with-position' ? 'style-with-position' : (clipType === 'style-only' ? 'style-only' : 'style');
                  pasteClip(pt as any);
                }} 
              />
            </>
          )}

          <ActionBtn icon={<Trash2 className="h-4 w-4 text-rose-400" />} label="Delete" onClick={() => { removeClip(clip.id); onClose(); }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto no-scrollbar border-b border-white/10 px-4 pb-2">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                tab === tb.id ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Icon className="h-3 w-3" />
              {tb.label}
            </button>
          );
        })}
      </div>

      <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {tab === 'ai' && (
          <div className="space-y-4">
            {/* AI Kinetic Typography */}
            <KineticTypographySection selectedClip={clip} />

            {/* Auto Beat Sync */}
            <BeatSyncSection selectedClip={clip} />

            {/* AI Sound Designer / SFX */}
            <AISFXSection selectedClip={clip} />

            {/* Magic Eraser / Background Removal */}
            <div className="bg-[#1e1e1e] rounded p-3 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">AI Magic Eraser</h4>
                  <p className="text-[9px] text-[#a0a0a0]">Auto-detects and removes background</p>
                </div>
                <input
                  type="checkbox"
                  checked={clip.aiBackground?.enabled || false}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    const existing = clip.aiBackground ?? { enabled: false, edgeBlur: 0, modelSelection: 1 };
                    updateClip(clip.id, { aiBackground: { ...existing, enabled } });
                    scheduleSaveSnapshot('Toggle AI Background');
                    if (enabled) {
                      loadMediaPipeSegmenter().catch(() => {});
                      loadBackgroundRemover().catch(() => {});
                      const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
                      if (mediaItem && (mediaItem.type === 'video' || (mediaItem.url && mediaItem.url.match(/\.(mp4|webm|mov|mkv)$/i)))) {
                        startClipBackgroundAnalysis(
                          clip.id,
                          mediaItem.url || '',
                          clip.trimStart || 0,
                          clip.duration || 5,
                          existing.modelSelection ?? 1
                        );
                      }
                    } else {
                      cleanupClipBackgroundState(clip.id);
                    }
                  }}
                  className="h-4 w-4 rounded accent-cyan-500"
                />
              </div>
            </div>

            {/* Timeline FX selection */}
            {clip.fxSettings && (
              <div className="bg-[#1e1e1e] rounded p-3 border border-rose-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-rose-400 uppercase">Timeline FX</span>
                  <button
                    onClick={() => updateClip(clip.id, { fxSettings: undefined })}
                    className="text-[9px] text-rose-400 border border-rose-500/30 rounded px-1.5 py-0.5"
                  >
                    Remove
                  </button>
                </div>
                <select
                  value={clip.fxSettings.type}
                  onChange={(e) => updateClip(clip.id, { fxSettings: { ...clip.fxSettings!, type: e.target.value as any } })}
                  className="w-full bg-[#252525] text-white text-xs border border-white/10 rounded px-2 py-1.5"
                >
                  <option value="subject_outline_flash">✨ Subject Outline Flash</option>
                  <option value="rhythmic_mirror">🔄 Rhythmic Mirror Flip</option>
                  <option value="action_zoom_pulse">💥 Action Zoom Pulse</option>
                  <option value="action_strobe">⚡ Impact Strobe Flash</option>
                  <option value="action_shake">📳 Action Shake & RGB Jitter</option>
                  <option value="glitch">Glitch</option>
                  <option value="vhs">VHS</option>
                  <option value="old_film">Old Film</option>
                  <option value="pixelate">Pixelate</option>
                </select>
              </div>
            )}
          </div>
        )}

        {tab === 'style' && (
          <div className="space-y-4">
            <Slider label="Position X" value={Math.round(t.x)} min={-1000} max={1000} step={1} onChange={(v) => setTransform({ x: v })} />
            <Slider label="Position Y" value={Math.round(t.y)} min={-1000} max={1000} step={1} onChange={(v) => setTransform({ y: v })} />
            <Slider label="Scale" value={Math.round(t.scale)} min={10} max={400} step={1} suffix="%" onChange={(v) => setTransform({ scale: v })} />
            <Slider label="Rotation" value={Math.round(t.rotation)} min={-180} max={180} step={1} suffix="°" onChange={(v) => setTransform({ rotation: v })} />
            <Slider label="Opacity" value={Math.round((clip.opacity ?? 1) * 100)} min={0} max={100} step={1} suffix="%" onChange={(v) => { updateClip(clip.id, { opacity: v / 100 }); scheduleSaveSnapshot('Opacity'); }} />
            
            <div className="pt-2 border-t border-white/10 space-y-2">
              <label className="text-[11px] text-white/50 block">Blend Mode</label>
              <select
                value={clip.transform?.blendMode || 'source-over'}
                onChange={(e) => setTransform({ blendMode: e.target.value as any })}
                className="w-full bg-[#1e1e1e] text-white text-xs border border-white/10 rounded px-2 py-1.5"
              >
                <option value="source-over">Normal</option>
                <option value="screen">Screen</option>
                <option value="multiply">Multiply</option>
                <option value="overlay">Overlay</option>
                <option value="darken">Darken</option>
                <option value="lighten">Lighten</option>
                <option value="color-dodge">Color Dodge</option>
                <option value="color-burn">Color Burn</option>
                <option value="difference">Difference</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'color' && (
          <div className="space-y-4">
            <Slider label="Temperature" value={Math.round(color.temperature)} min={-100} max={100} step={1} onChange={(v) => setColor({ temperature: v })} />
            <Slider label="Exposure" value={Math.round(color.exposure)} min={-100} max={100} step={1} onChange={(v) => setColor({ exposure: v })} />
            <Slider label="Contrast" value={Math.round(color.contrast)} min={0} max={200} step={1} onChange={(v) => setColor({ contrast: v })} />
            <Slider label="Saturation" value={Math.round(color.saturation)} min={0} max={200} step={1} onChange={(v) => setColor({ saturation: v })} />
            <Slider label="Blur" value={Math.round(color.blur || 0)} min={0} max={20} step={1} onChange={(v) => setColor({ blur: v })} />
            <Slider label="Vignette" value={Math.round(color.vignette || 0)} min={-100} max={100} step={1} onChange={(v) => setColor({ vignette: v })} />
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
            <Slider label="Pitch" value={clip.audioSettings?.pitch ?? 0} min={-12} max={12} step={1} suffix=" st" onChange={(v) => setAudio({ pitch: v })} />
            <button
              onClick={() => setAudio({ muted: !(clip.audioSettings?.muted ?? false) })}
              className={`w-full rounded-lg py-2 text-[12px] font-medium ${clip.audioSettings?.muted ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-white/80'}`}
            >
              {clip.audioSettings?.muted ? 'Unmute clip' : 'Mute clip'}
            </button>
          </div>
        )}

        {tab === 'speed' && (
          <div className="space-y-4">
            <Slider label="Speed Multiplier" value={Math.round((clip.speed ?? 1) * 100)} min={25} max={400} step={5} suffix="%" onChange={(v) => { updateClip(clip.id, { speed: v / 100 }); scheduleSaveSnapshot('Speed'); }} />
            <div className="flex gap-2">
              {[0.5, 1, 1.5, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => { updateClip(clip.id, { speed: s }); scheduleSaveSnapshot('Speed'); }}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold ${clip.speed === s ? 'bg-amber-500 text-black' : 'bg-white/10 text-white'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'mask' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">Enable Mask</span>
              <input
                type="checkbox"
                checked={clip.mask?.enabled || false}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const existing = clip.mask ?? { enabled: false, type: 'rectangle', x: 50, y: 50, width: 50, height: 50, radius: 0, feather: 0, invert: false, points: [] };
                  updateClip(clip.id, { mask: { ...existing, enabled } });
                  scheduleSaveSnapshot('Toggle Mask');
                }}
                className="h-4 w-4 rounded accent-amber-500"
              />
            </div>
            {clip.mask?.enabled && (
              <div className="space-y-3 pt-2">
                <select
                  value={clip.mask.type}
                  onChange={(e) => updateClip(clip.id, { mask: { ...clip.mask!, type: e.target.value as any } })}
                  className="w-full bg-[#1e1e1e] text-white text-xs border border-white/10 rounded px-2 py-1.5"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle / Ellipse</option>
                  <option value="linear">Linear Split</option>
                  <option value="mirror">Mirror</option>
                </select>
                <Slider label="Feather" value={clip.mask.feather ?? 0} min={0} max={100} step={1} onChange={(v) => updateClip(clip.id, { mask: { ...clip.mask!, feather: v } })} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-white/70 active:bg-white/10">
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
