// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/MediaPanel/index.tsx
//   src/hooks/media/useMediaImport.ts
//   src/constants/mediaPanel.ts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { Upload, Plus, Film, Image, Music, Type, Sparkles, ArrowLeftRight, LayoutTemplate, X } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useMediaImport } from '@/hooks/media/useMediaImport';
import { addMediaToTimeline, addTextClipToTimeline, findFreeSlot, mid } from '@/mobile/lib/timeline';
import { TransitionCard } from '@/components/MediaPanel';
import { TRANSITIONS, FX_EFFECTS, COLOR_CORRECTION_EFFECTS, PARTICLE_EFFECTS } from '@/constants/mediaPanel';
import { normalizeTransition, getDefaultSoundForKind } from '@/utils/transitionEngine';
import { MOTION_TEMPLATES } from '@/utils/motionTemplates';
import { TEXT_TEMPLATES } from '@/utils/textTemplates';
import type { TimelineClip } from '@/types';

export type MobileMediaTab = 'media' | 'transitions' | 'templates' | 'audio' | 'text' | 'effects';

const TABS: { id: MobileMediaTab; label: string; icon: typeof Plus }[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'effects', label: 'Effects', icon: Sparkles },
];

export function MobileMediaSheet({ onClose, initialTab = 'media' }: { onClose: () => void; initialTab?: MobileMediaTab }) {
  const [tab, setTab] = useState<MobileMediaTab>(initialTab);
  const { mediaLibrary, insertTextClip, updateClip, saveSnapshot, tracks, selectedClipId, updateTransition } = useEditorStore(
    useShallow((s) => ({
      mediaLibrary: s.mediaLibrary,
      insertTextClip: s.insertTextClip,
      updateClip: s.updateClip,
      saveSnapshot: s.saveSnapshot,
      tracks: s.tracks,
      selectedClipId: s.selectedClipId,
      updateTransition: s.updateTransition,
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

  const applyTransition = (tr: (typeof TRANSITIONS)[number]) => {
    const state = useEditorStore.getState();
    const targetClipId = state.selectedTransitionClipId || state.selectedClipId;
    if (!targetClipId) {
      toast.warning('Select a clip or transition slot on the timeline to attach transition.');
      return;
    }
    
    // Find the clip to see if it already has a transitionOut (in case it was selected from there)
    let clip = null;
    for (const track of state.tracks) {
      clip = track.clips.find(c => c.id === targetClipId);
      if (clip) break;
    }
    
    const probe = normalizeTransition({ type: tr.name.toLowerCase().replace(/\s+/g, '_'), name: tr.name, duration: 1 });
    const newTransition = {
      id: Math.random().toString(36).substring(2, 9),
      name: tr.name,
      type: probe.kind,
      duration: 1.0,
      params: { alignment: 'center', easing: 'easeInOut', kind: probe.kind },
      soundEffect: getDefaultSoundForKind(probe.kind),
      soundVolume: 0.8,
      createdAt: Date.now(),
    };
    
    if (state.selectedTransitionClipId && clip?.transitionOut) {
      useEditorStore.getState().updateClip(targetClipId, { transitionOut: newTransition });
    } else {
      useEditorStore.getState().updateClip(targetClipId, { transitionIn: newTransition });
    }
    
    useEditorStore.getState().saveSnapshot('Apply Transition');
    toast.success(`Applied ${tr.name} transition`);
    onClose();
  };

  const addMotionTemplate = (tmpl: any) => {
    const state = useEditorStore.getState();
    if (tmpl.type === 'text' && tmpl.textSettings) {
      insertTextClip({
        ...tmpl.textSettings,
        text: tmpl.name,
      });
      toast.success(`Added template “${tmpl.name}”`);
      onClose();
    } else {
      addFxEffect({ name: tmpl.name, type: tmpl.category || 'glitch' } as any);
    }
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
      {tab !== 'transitions' ? (
          <div className="flex shrink-0 gap-1 overflow-x-auto no-scrollbar border-b border-white/10 px-3 pb-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    active ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">Select Transition</span>
            </div>
            <button onClick={onClose} className="rounded-full bg-white/5 p-1 text-white/50 hover:text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Body */}
      <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'media' && (
          <div className="space-y-3">
            <button
              onClick={() => pickFiles('*/*')}
              disabled={isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-[13px] font-medium text-white active:bg-white/10 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 text-amber-400" />
              {isUploading ? progressText : 'Import from File Explorer'}
            </button>

            {mediaItems.length === 0 ? (
              <p className="p-6 text-center text-[12px] text-white/40">
                No imported media yet. Tap above to add videos or images.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaItems.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      addMediaToTimeline(m);
                      onClose();
                    }}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-white/5 text-left active:scale-[0.98]"
                  >
                    {m.thumbnail ? (
                      <img src={m.thumbnail} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                        {m.type === 'video' ? (
                          <Film className="h-5 w-5 text-white/40" />
                        ) : (
                          <Image className="h-5 w-5 text-white/40" />
                        )}
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-mono text-white">
                      {(m.duration ?? 0).toFixed(1)}s
                    </span>
                    <span className="absolute left-1 top-1 truncate text-[9px] font-medium text-white drop-shadow">
                      {m.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

          {tab === 'transitions' && (
            <div className="space-y-3">
              <p className="text-[11px] text-white/50">Tap a transition to apply it to the selected clip:</p>
              <div className="grid grid-cols-2 gap-2">
                {TRANSITIONS.map((tr) => (
                  <TransitionCard
                    key={tr.name}
                    transition={tr}
                    onClick={() => applyTransition(tr)}
                    isMobile={true}
                  />
                ))}
              </div>
            </div>
          )}

        {tab === 'templates' && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/50">Motion Graphics & Particle Templates:</p>
            <div className="grid grid-cols-2 gap-2">
              {MOTION_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => addMotionTemplate(tmpl)}
                  className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10"
                >
                  <span className="text-[12px] font-semibold text-teal-300">{tmpl.name}</span>
                  <span className="text-[10px] text-white/50 capitalize">{tmpl.category} template</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'audio' && (
          <div className="space-y-3">
            <button
              onClick={() => pickFiles('*/*')}
              disabled={isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-[13px] font-medium text-white active:bg-white/10 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 text-emerald-400" />
              Import Audio from File Explorer
            </button>

            {audioItems.length === 0 ? (
              <p className="p-6 text-center text-[12px] text-white/40">
                No audio files yet. Tap above to import music or sound effects.
              </p>
            ) : (
              <div className="space-y-1.5">
                {audioItems.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      addMediaToTimeline(m);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-white">{m.name}</p>
                      <p className="text-[10px] text-white/40 font-mono">{(m.duration ?? 0).toFixed(1)}s</p>
                    </div>
                    <Plus className="h-4 w-4 text-white/60 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-3">
            <button
              onClick={() => {
                addTextClipToTimeline('Your Text');
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-amber-500 p-3 text-[13px] font-semibold text-black active:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Plain Text
            </button>

            <p className="text-[11px] font-medium text-white/50 pt-2">Text Style Presets</p>
            <div className="grid grid-cols-2 gap-2">
              {TEXT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => addTextTemplate(tpl)}
                  className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10"
                >
                  <span
                    className="text-[14px] font-bold"
                    style={{
                      color: tpl.settings.color,
                      fontFamily: tpl.settings.fontFamily,
                    }}
                  >
                    {tpl.name}
                  </span>
                  <span className="text-[10px] text-white/40">{tpl.style || 'Text style'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'effects' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Timeline Shaders & FX
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FX_EFFECTS.map((fx) => (
                  <button
                    key={fx.type}
                    onClick={() => addFxEffect(fx)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10"
                  >
                    <span className={`text-[12px] font-semibold ${fx.color}`}>{fx.name}</span>
                    <span className="text-[10px] text-white/40">{fx.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Color Presets
              </p>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_CORRECTION_EFFECTS.map((eff) => (
                  <button
                    key={eff.name}
                    onClick={() => applyColorPreset(eff)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10"
                  >
                    <span className="text-[12px] font-semibold text-white">{eff.name}</span>
                    <span className="text-[10px] text-white/40">Apply to selected clip</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Particle Overlays
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PARTICLE_EFFECTS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyParticle(p)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10"
                  >
                    <span className="text-[12px] font-semibold text-white">{p.name}</span>
                    <span className="text-[10px] text-white/40">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
