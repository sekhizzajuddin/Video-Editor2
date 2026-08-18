// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/MediaPanel/index.tsx
//   src/hooks/media/useMediaImport.ts
//   src/constants/mediaPanel.ts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { Upload, Plus, Film, Image, Music, Type, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useMediaImport } from '@/hooks/media/useMediaImport';
import { addMediaToTimeline, addTextClipToTimeline, findFreeSlot, mid } from '@/mobile/lib/timeline';
import { FX_EFFECTS, COLOR_CORRECTION_EFFECTS, PARTICLE_EFFECTS } from '@/constants/mediaPanel';
import { TEXT_TEMPLATES } from '@/utils/textTemplates';
import type { TimelineClip } from '@/types';

type Tab = 'media' | 'audio' | 'text' | 'effects';

const TABS: { id: Tab; label: string; icon: typeof Plus }[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'effects', label: 'Effects', icon: Sparkles },
];

export function MobileMediaSheet({ onClose, initialTab = 'media' }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { mediaLibrary, insertTextClip, updateClip, saveSnapshot } = useEditorStore(
    useShallow((s) => ({
      mediaLibrary: s.mediaLibrary,
      insertTextClip: s.insertTextClip,
      updateClip: s.updateClip,
      saveSnapshot: s.saveSnapshot,
    }))
  );
  const { isUploading, progressText, progressPercent, fileInputRef, handleFileSelect } = useMediaImport();

  const mediaItems = useMemo(
    () => mediaLibrary.filter((m) => m.type === 'video' || m.type === 'image'),
    [mediaLibrary]
  );
  const audioItems = useMemo(() => mediaLibrary.filter((m) => m.type === 'audio'), [mediaLibrary]);

  const pickFiles = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const addTextTemplate = (tpl: (typeof TEXT_TEMPLATES)[number]) => {
    insertTextClip({
      text: 'Your Text',
      fontFamily: tpl.settings.fontFamily,
      fontSize: tpl.settings.fontSize,
      color: tpl.settings.color,
      bold: tpl.settings.bold ?? false,
      italic: tpl.settings.italic ?? false,
      underline: tpl.settings.underline ?? false,
      shadow: tpl.settings.shadow ?? false,
      shadowColor: tpl.settings.shadowColor,
      shadowBlur: tpl.settings.shadowBlur,
      backgroundColor: tpl.settings.backgroundColor ?? 'transparent',
      strokeColor: tpl.settings.strokeColor,
      strokeWidth: tpl.settings.strokeWidth,
    } as any);
    onClose();
  };

  const addFxEffect = (fx: (typeof FX_EFFECTS)[number]) => {
    const state = useEditorStore.getState();
    let track = state.tracks.find((t) => t.type === 'fx');
    if (!track) {
      state.addTrack('fx');
      track = useEditorStore.getState().tracks.find((t) => t.type === 'fx');
    }
    if (!track) return;
    const duration = 5;
    const startTime = findFreeSlot(track, state.currentTime, duration);
    const mediaId = mid('fx_media');
    const clipId = mid('fx_clip');
    useEditorStore.getState().addMedia({
      id: mediaId,
      name: fx.name,
      type: 'fx',
      duration,
      url: '',
      createdAt: Date.now(),
      fxType: fx.type,
    });
    useEditorStore.getState().addClip({
      id: clipId,
      mediaId,
      trackId: track.id,
      startTime,
      duration,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
      effects: [],
      fxSettings: { type: fx.type as any, intensity: 100 },
    } as TimelineClip);
    useEditorStore.getState().selectClip(clipId);
    useEditorStore.getState().saveSnapshot('Add effect');
    toast.success(`Added “${fx.name}”`);
    onClose();
  };

  const applyColorPreset = (effect: (typeof COLOR_CORRECTION_EFFECTS)[number]) => {
    const state = useEditorStore.getState();
    const clipId = state.selectedClipId;
    if (!clipId) {
      toast.warning('Select a clip on the timeline first.');
      return;
    }
    const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    const existing = clip.colorFilters ?? {
      temperature: 0, tint: 0, exposure: 0, contrast: 100,
      saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
    };
    updateClip(clipId, { colorFilters: { ...existing, ...effect.preset } });
    saveSnapshot();
    toast.success(`Applied “${effect.name}”`);
    onClose();
  };

  const applyParticle = (effect: (typeof PARTICLE_EFFECTS)[number]) => {
    const state = useEditorStore.getState();
    const clipId = state.selectedClipId;
    if (!clipId) {
      toast.warning('Select a clip on the timeline first.');
      return;
    }
    const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    updateClip(clipId, {
      particleSettings: {
        type: effect.type as any,
        emitterX: 50,
        emitterY: 100,
        ...effect.defaultSettings,
      },
    });
    saveSnapshot();
    toast.success(`Applied “${effect.name}”`);
    onClose();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 pb-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[12px] font-medium transition ${
                tab === t.id ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/70'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="shrink-0 px-4 py-2 text-[11px] text-amber-300">
          {progressText} · {progressPercent}%
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {/* Import buttons */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => pickFiles('video/*')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[12px] font-medium text-white active:bg-white/10"
          >
            <Upload className="h-4 w-4 text-amber-400" /> Video
          </button>
          <button
            onClick={() => pickFiles('image/*')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[12px] font-medium text-white active:bg-white/10"
          >
            <Image className="h-4 w-4 text-emerald-400" /> Image
          </button>
          <button
            onClick={() => pickFiles('audio/*')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[12px] font-medium text-white active:bg-white/10"
          >
            <Music className="h-4 w-4 text-purple-400" /> Audio
          </button>
          <button
            onClick={() => {
              addTextClipToTimeline('Your Text');
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[12px] font-medium text-white active:bg-white/10"
          >
            <Type className="h-4 w-4 text-amber-400" /> Text
          </button>
        </div>

        {tab === 'media' && (
          <>
            {mediaItems.length === 0 ? (
              <EmptyHint text="No media yet — import a video or image to begin." />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaItems.map((m) => (
                  <MediaCard key={m.id} thumb={m.thumbnail} name={m.name} duration={m.duration} icon={m.type === 'image' ? Image : Film} onClick={() => addMediaToTimeline(m)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'audio' && (
          <>
            {audioItems.length === 0 ? (
              <EmptyHint text="No audio yet — tap “Audio” above to import music or voice." />
            ) : (
              <div className="space-y-1.5">
                {audioItems.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addMediaToTimeline(m)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 text-left active:bg-white/10"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                      <Music className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-white">{m.name}</span>
                      <span className="text-[10px] text-white/40">{m.duration.toFixed(1)}s</span>
                    </span>
                    <Plus className="h-4 w-4 text-amber-400" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'text' && (
          <div className="grid grid-cols-2 gap-2">
            {TEXT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => addTextTemplate(tpl)}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
              >
                <span className="block text-[12px] font-medium text-white">{tpl.name}</span>
                <span className="block text-[10px] text-white/40">Tap to add</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'effects' && (
          <div className="space-y-4">
            <SectionLabel>Motion FX</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {FX_EFFECTS.map((fx) => (
                <button key={fx.type} onClick={() => addFxEffect(fx)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10">
                  <span className="block text-[12px] font-medium text-white">{fx.name}</span>
                  <span className="block truncate text-[10px] text-white/40">{fx.desc}</span>
                </button>
              ))}
            </div>

            <SectionLabel>Color Presets</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_CORRECTION_EFFECTS.map((fx) => (
                <button key={fx.name} onClick={() => applyColorPreset(fx)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10">
                  <span className="block text-[12px] font-medium text-white">{fx.name}</span>
                  <span className="block text-[10px] text-white/40">Apply to selected clip</span>
                </button>
              ))}
            </div>

            <SectionLabel>Particles</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {PARTICLE_EFFECTS.map((fx) => (
                <button key={fx.type} onClick={() => applyParticle(fx)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10">
                  <span className="block text-[12px] font-medium text-white">{fx.name}</span>
                  <span className="block text-[10px] text-white/40">Apply to selected clip</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{children}</p>;
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Film className="h-8 w-8 text-white/20" />
      <p className="text-[12px] text-white/40">{text}</p>
    </div>
  );
}

function MediaCard({
  thumb,
  name,
  duration,
  icon: Icon,
  onClick,
}: {
  thumb?: string;
  name: string;
  duration: number;
  icon: typeof Film;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left active:border-amber-400">
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-white">
          {duration > 0 ? duration.toFixed(1) : ''}
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-active:opacity-100">
          <Plus className="h-6 w-6 text-white" />
        </span>
      </div>
      <span className="block truncate px-1.5 py-1 text-[10px] text-white/80">{name}</span>
    </button>
  );
}
