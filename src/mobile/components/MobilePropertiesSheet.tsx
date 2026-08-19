import { getAnimatedValue } from '@/utils/keyframes';
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
  ChevronDown,
  Music,
  Settings2,
  Wind,
  Clock,
} from 'lucide-react';

import { PositionSection, ScaleSection, RotationSection, OpacitySection, SmartReframeSection, KeyframesSection } from '@/components/properties/tabs/transform';
import { TemperatureSection, TintSection, ExposureSection, ContrastSection, SaturationSection, BlurSection, FadedFilmSection, VignetteSection, ColorGradeTransferSection } from '@/components/properties/tabs/color';
import { CurvesEditor } from '@/components/properties/tabs/color/CurvesEditor';
import { VolumeSection, PanSection, EQSection, AutoVoiceTuneSection, AutoDuckingSection, AISoundDesignerSection } from '@/components/properties/tabs/audio';
import { SpeedSliderSection, PresetRampsSection, SpeedRampingSection } from '@/components/properties/tabs/speed';
import { MaskTypeSection, MaskParametersSection, MaskEnableSection, MaskInvertSection } from '@/components/properties/tabs/mask';
import { ChromaKeySection } from '@/components/properties/tabs/effects/ChromaKeySection';
import { ObjectRemovalPanel } from '@/components/properties/tabs/effects/ObjectRemovalPanel';
import { KineticTypographySection, BeatSyncSection, AISFXSection } from '@/components/properties/tabs/effects';
import { TextContentSection, FontFamilySection, FontSizeSection, TextColorSection, TextShadowSection, TextStyleButtonsSection, TextStylePresetsSection } from '@/components/properties/tabs/text';

import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';
import type { ClipColorFilters } from '@/types';





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

export function MobilePropertiesSheet({ onClose, initialTab }: { onClose: () => void; initialTab?: Tab }) {
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
    updateClip, currentTime,
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
      updateClip: s.updateClip, currentTime: s.currentTime,
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
    return mediaLibrary.find((m: any) => m.id === clip.mediaId)?.type ?? null;
  }, [clip, mediaLibrary]);

  const isText = !!clip?.textSettings;
  const isAudio = mediaType === 'audio' || !!clip?.audioSettings;
  const category = initialTab || (isText ? 'text' : isAudio ? 'audio' : 'ai');
  const [subTab, setSubTab] = useState<string>('');

  const absoluteStartTime = clip?.startTime ?? 0;
  const animations = clip?.animations || {};
  const localTime = currentTime - absoluteStartTime;

  const getPropVal = (base: number, propKey: string) => {
    return getAnimatedValue(base, currentTime, absoluteStartTime, animations[propKey]);
  };

  const setPropVal = (propKey: string, value: number, baseUpdateObj: any) => {
    updateClip(clip!.id, baseUpdateObj);
  };


  const subTabsMap: Record<string, { id: string; label: string }[]> = {
    style: [
      { id: 'keyframes', label: 'Keyframes' },
      { id: 'scale', label: 'Scale' },
      { id: 'position', label: 'Position' },
      { id: 'rotation', label: 'Rotation' },
      { id: 'opacity', label: 'Opacity' },
      { id: 'flip', label: 'Flip' },
      { id: 'perspective', label: 'Warp' },
      { id: 'blend', label: 'Blend' },
      { id: 'crop', label: 'Crop' },
      { id: 'reframe', label: 'Smart Reframe' },
    ],
    color: [
      { id: 'temp', label: 'Temp' },
      { id: 'tint', label: 'Tint' },
      { id: 'exposure', label: 'Exposure' },
      { id: 'contrast', label: 'Contrast' },
      { id: 'saturation', label: 'Saturation' },
      { id: 'blur', label: 'Blur' },
      { id: 'faded', label: 'Faded Film' },
      { id: 'vignette', label: 'Vignette' },
      { id: 'curves', label: 'Curves' },
      { id: 'transfer', label: 'Color Transfer' },
    ],
    audio: [
      { id: 'volume', label: 'Volume' },
      { id: 'pan', label: 'Pan' },
      { id: 'ducking', label: 'Ducking' },
      { id: 'eq', label: 'EQ' },
      { id: 'voicetune', label: 'Voice Tune' },
      { id: 'sounddesign', label: 'Sound Design' },
    ],
    speed: [
      { id: 'speed', label: 'Speed' },
      { id: 'presets', label: 'Presets' },
      { id: 'ramping', label: 'Speed Ramp' },
    ],
    mask: [
      { id: 'mask', label: 'Mask' },
      { id: 'chroma', label: 'Chroma Key' },
    ],
    text: [
      { id: 'content', label: 'Text' },
      { id: 'font', label: 'Font' },
      { id: 'style', label: 'Style' },
      { id: 'shadow', label: 'Shadow' },
    ],
    ai: [
      { id: 'kinetic', label: 'Kinetic' },
      { id: 'beatsync', label: 'Beat Sync' },
      { id: 'sfx', label: 'SFX' },
      { id: 'eraser', label: 'Magic Eraser' },
      { id: 'object_removal', label: 'Object Removal' },
    ],
  };

  const activeSubTabs = subTabsMap[category] || [];
  const currentSubTab = subTab || (activeSubTabs[0]?.id ?? '');

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 shrink-0 border-b border-white/5 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="p-1 -ml-1 rounded hover:bg-white/10 active:bg-white/20 text-white/70">
            <ChevronDown className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">
              {clip.textSettings?.text || mediaType || 'Clip'}
            </p>
            <p className="text-[10px] text-white/40">{(clip.duration ?? 0).toFixed(1)}s</p>
          </div>
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

      {/* Sub Tabs */}
      {activeSubTabs.length > 0 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto no-scrollbar border-b border-white/10 px-4 pb-2">
          {activeSubTabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setSubTab(tb.id)}
              className={`flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                currentSubTab === tb.id ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      )}

      <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {category === 'ai' && currentSubTab === 'kinetic' && <KineticTypographySection selectedClip={clip} />}
        {category === 'ai' && currentSubTab === 'beatsync' && <BeatSyncSection selectedClip={clip} />}
        {category === 'ai' && currentSubTab === 'sfx' && <AISFXSection selectedClip={clip} />}
        
        {category === 'ai' && currentSubTab === 'object_removal' && <ObjectRemovalPanel selectedClip={clip} />}
        

        {category === 'style' && currentSubTab === 'scale' && <ScaleSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}
        {category === 'style' && currentSubTab === 'position' && <PositionSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}
        {category === 'style' && currentSubTab === 'rotation' && <RotationSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}
        {category === 'style' && currentSubTab === 'opacity' && <OpacitySection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}
        {category === 'style' && currentSubTab === 'reframe' && <SmartReframeSection selectedClip={clip} updateClip={updateClip} />}

        {category === 'style' && currentSubTab === 'keyframes' && (
          <div className="bg-[#1e1e1e] p-4 text-center rounded border border-[#3e3e3e]">
            <p className="text-sm text-[#a0a0a0]">Use the diamond icon next to properties to add keyframes.</p>
          </div>
        )}
        {category === 'style' && currentSubTab === 'flip' && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                const cur = clip.transform.flipH ?? false;
                updateClip(clip.id, { transform: { ...clip.transform, flipH: !cur } });
              }}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
                clip.transform.flipH ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white'
              }`}
            >
              Flip Horizontal
            </button>
            <button
              onClick={() => {
                const cur = clip.transform.flipV ?? false;
                updateClip(clip.id, { transform: { ...clip.transform, flipV: !cur } });
              }}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
                clip.transform.flipV ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white'
              }`}
            >
              Flip Vertical
            </button>
          </div>
        )}
        {category === 'style' && currentSubTab === 'perspective' && (
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!clip.transform.perspectivePin}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  let updates: any = { transform: { ...clip.transform, perspectivePin: enabled } };
                  if (enabled && !clip.transform.perspectiveCorners) {
                    const aX = clip.transform.x;
                    const aY = clip.transform.y;
                    const baseW = 200;
                    const baseH = 200;
                    updates.transform.perspectiveCorners = {
                      x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                      x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                      x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                      x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
                    };
                  }
                  updateClip(clip.id, updates);
                }}
                className="w-5 h-5 rounded border-[#3e3e3e] text-amber-500 bg-[#1e1e1e]"
              />
              <span className="text-sm font-medium text-white">Enable Corner Pinning</span>
            </label>
            {clip.transform.perspectivePin && (
              <div className="pt-3 border-t border-[#3e3e3e]">
                <p className="text-xs text-[#a0a0a0] mb-3">Drag the 4 corner handles on the preview screen to adjust.</p>
                <button
                  onClick={() => {
                    const newAnimations = { ...(clip.animations || {}) };
                    for (let i = 0; i < 4; i++) {
                      delete newAnimations[`transform.perspectiveCorners.x${i}`];
                      delete newAnimations[`transform.perspectiveCorners.y${i}`];
                    }
                    const aX = clip.transform.x;
                    const aY = clip.transform.y;
                    const baseW = 200;
                    const baseH = 200;
                    updateClip(clip.id, {
                      transform: {
                        ...clip.transform,
                        perspectiveCorners: {
                          x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                          x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                          x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                          x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
                        }
                      },
                      animations: newAnimations
                    });
                  }}
                  className="w-full py-2 text-xs font-medium text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10"
                >
                  Reset Corners
                </button>
              </div>
            )}
          </div>
        )}
        {category === 'style' && currentSubTab === 'crop' && (
          <div className="space-y-4">
            {['left', 'right', 'top', 'bottom'].map((edge) => {
              const currentCrop = clip.crop || { top: 0, bottom: 0, left: 0, right: 0 };
              const propKey = `crop.${edge}`;
              const value = getPropVal(currentCrop[edge as keyof typeof currentCrop], propKey);
              return (
                <div key={edge} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white capitalize">{edge}</span>
                    <span className="text-xs text-amber-500">{Math.round(value)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={value}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      const proposedCrop = { ...currentCrop, [edge]: newVal };
                      setPropVal(propKey, newVal, { crop: proposedCrop });
                    }}
                    className="w-full accent-amber-500"
                  />
                </div>
              );
            })}
          </div>
        )}
        {category === 'color' && currentSubTab === 'temp' && <TemperatureSection temperature={getPropVal(clip.colorFilters?.temperature ?? 0, 'color.temperature')} onChange={(v) => setPropVal('color.temperature', v, { colorFilters: { ...(clip.colorFilters || {}), temperature: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), temperature: 0 } as any })} />}

        {category === 'color' && currentSubTab === 'tint' && <TintSection tint={getPropVal(clip.colorFilters?.tint ?? 0, 'color.tint')} onChange={(v) => setPropVal('color.tint', v, { colorFilters: { ...(clip.colorFilters || {}), tint: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), tint: 0 } as any })} />}
        {category === 'color' && currentSubTab === 'exposure' && <ExposureSection exposure={getPropVal(clip.colorFilters?.exposure ?? 0, 'color.exposure')} onChange={(v) => setPropVal('color.exposure', v, { colorFilters: { ...(clip.colorFilters || {}), exposure: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), exposure: 0 } as any })} />}
        {category === 'color' && currentSubTab === 'contrast' && <ContrastSection contrast={getPropVal(clip.colorFilters?.contrast ?? 100, 'color.contrast')} onChange={(v) => setPropVal('color.contrast', v, { colorFilters: { ...(clip.colorFilters || {}), contrast: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), contrast: 100 } as any })} />}
        {category === 'color' && currentSubTab === 'saturation' && <SaturationSection saturation={getPropVal(clip.colorFilters?.saturation ?? 100, 'color.saturation')} onChange={(v) => setPropVal('color.saturation', v, { colorFilters: { ...(clip.colorFilters || {}), saturation: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), saturation: 100 } as any })} />}
        {category === 'color' && currentSubTab === 'blur' && <BlurSection blur={getPropVal(clip.colorFilters?.blur ?? 0, 'color.blur')} onChange={(v) => setPropVal('color.blur', v, { colorFilters: { ...(clip.colorFilters || {}), blur: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), blur: 0 } as any })} />}
        {category === 'color' && currentSubTab === 'faded' && <FadedFilmSection fadedFilm={getPropVal(clip.colorFilters?.fadedFilm ?? 0, 'color.fadedFilm')} onChange={(v) => setPropVal('color.fadedFilm', v, { colorFilters: { ...(clip.colorFilters || {}), fadedFilm: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), fadedFilm: 0 } as any })} />}
        {category === 'color' && currentSubTab === 'vignette' && <VignetteSection vignette={getPropVal(clip.colorFilters?.vignette ?? 0, 'color.vignette')} onChange={(v) => setPropVal('color.vignette', v, { colorFilters: { ...(clip.colorFilters || {}), vignette: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), vignette: 0 } as any })} />}
        {category === 'color' && currentSubTab === 'curves' && <CurvesEditor curves={clip.colorFilters?.curves || {}} onChange={(curves) => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), curves } as any })} />}
        {category === 'color' && currentSubTab === 'transfer' && <ColorGradeTransferSection selectedClip={clip} selectedClipIds={[clip.id]} />}

        {category === 'audio' && currentSubTab === 'volume' && <VolumeSection volume={getPropVal(clip.audioSettings?.volume ?? 0, 'audio.volume')} onChange={(v) => setPropVal('audio.volume', v, { audioSettings: { pan: 0, ...(clip.audioSettings || {}), volume: v } as any })} onReset={() => updateClip(clip.id, { audioSettings: { pan: 0, ...(clip.audioSettings || {}), volume: 0 } as any })} />}
        {category === 'audio' && currentSubTab === 'pan' && <PanSection pan={getPropVal(clip.audioSettings?.pan ?? 0, 'audio.pan')} onChange={(v) => setPropVal('audio.pan', v, { audioSettings: { volume: 0, ...(clip.audioSettings || {}), pan: v } as any })} onReset={() => updateClip(clip.id, { audioSettings: { volume: 0, ...(clip.audioSettings || {}), pan: 0 } as any })} />}
        {category === 'audio' && currentSubTab === 'ducking' && <AutoDuckingSection selectedClip={clip} handleAudioChange={(key, val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), [key]: val } as any })} />}
        {category === 'audio' && currentSubTab === 'eq' && <EQSection bass={clip.audioSettings?.bass || 0} mid={clip.audioSettings?.mid || 0} treble={clip.audioSettings?.treble || 0} onBassChange={(val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), bass: val } as any })} onMidChange={(val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), mid: val } as any })} onTrebleChange={(val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), treble: val } as any })} />}
        {category === 'audio' && currentSubTab === 'voicetune' && <AutoVoiceTuneSection selectedClipIds={[clip.id]} isAnalyzingVoice={false} handleAutoVoiceTune={() => {}} />}
        {category === 'audio' && currentSubTab === 'sounddesign' && <AISoundDesignerSection isAnalyzingAudio={false} audioAnalyzeProgress="" aiProvider="gemini" setAiProvider={() => {}} soundDesignFps={30} setSoundDesignFps={() => {}} freesoundApiKey="" setFreesoundApiKey={() => {}} handleAiSoundDesign={() => {}} />}

        {category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection speed={clip.speed ?? 1} isRamped={!!clip.speedRamp} onSpeedChange={(v) => { const sourceDuration = clip.duration * (clip.speed ?? 1); updateClip(clip.id, { speed: v, duration: sourceDuration / v }, { ripple: true }); }} onReset={() => { const sourceDuration = clip.duration * (clip.speed ?? 1); updateClip(clip.id, { speed: 1, duration: sourceDuration }, { ripple: true }); }} />}
        {category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection isRamped={!!clip.speedRamp} onSpeedChange={(v) => { const sourceDuration = clip.duration * (clip.speed ?? 1); updateClip(clip.id, { speed: v, duration: sourceDuration / v }, { ripple: true }); }} />}
        {category === 'speed' && currentSubTab === 'ramping' && <SpeedRampingSection selectedClip={clip} isRamped={!!clip.speedRamp} mediaLibrary={mediaLibrary as any} updateClip={updateClip} />}

        {category === 'mask' && currentSubTab === 'mask' && (
          <div className="space-y-4">
             <MaskEnableSection enabled={clip.mask?.enabled ?? false} onToggle={() => updateClip(clip.id, { mask: { ...clip.mask!, enabled: !(clip.mask?.enabled ?? false) } })} />
             {clip.mask?.enabled && (
               <>
                 <MaskTypeSection maskType={clip.mask.type ?? 'rectangle'} onChange={(v) => updateClip(clip.id, { mask: { ...clip.mask!, type: v as any } })} />
                 <MaskInvertSection invert={clip.mask.invert ?? false} onToggle={() => updateClip(clip.id, { mask: { ...clip.mask!, invert: !(clip.mask?.invert ?? false) } })} />
                 <MaskParametersSection mask={clip.mask} onChange={(prop, val) => updateClip(clip.id, { mask: { ...clip.mask!, [prop]: val } })} />
               </>
             )}
          </div>
        )}
        {category === 'mask' && currentSubTab === 'chroma' && <ChromaKeySection selectedClip={clip} />}

        {category === 'text' && isText && currentSubTab === 'content' && <TextContentSection text={clip.textSettings?.text ?? ''} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, text: v } })} />}
        {category === 'text' && isText && currentSubTab === 'font' && (
          <div className="space-y-4">
             <FontFamilySection fontFamily={clip.textSettings?.fontFamily ?? 'Inter'} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontFamily: v } })} />
             <FontSizeSection fontSize={clip.textSettings?.fontSize ?? 40} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontSize: v } })} />
          </div>
        )}
        {category === 'text' && isText && currentSubTab === 'style' && (
          <div className="space-y-4">
             <TextColorSection color={clip.textSettings?.color ?? '#ffffff'} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, color: v } })} />
             <TextStyleButtonsSection bold={clip.textSettings?.bold ?? false} italic={clip.textSettings?.italic ?? false} underline={clip.textSettings?.underline ?? false} onBoldToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, bold: !(clip.textSettings?.bold ?? false) } })} onItalicToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, italic: !(clip.textSettings?.italic ?? false) } })} onUnderlineToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, underline: !(clip.textSettings?.underline ?? false) } })} />
             <TextStylePresetsSection textSettings={clip.textSettings} clipId={clip.id} updateClip={updateClip} />
          </div>
        )}
        {category === 'text' && isText && currentSubTab === 'shadow' && <TextShadowSection shadow={clip.textSettings?.shadow ?? false} onToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, shadow: !(clip.textSettings?.shadow ?? false) } })} />}

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
