import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Move3D,
  Palette,
  Gauge,
  Music,
  Crop,
  Type,
  Sparkles,
  ChevronDown,
  Clock,
} from 'lucide-react';

import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';

import { PROPERTY_REGISTRY } from '@/components/properties/PropertyRegistry';

interface MobilePropertiesSheetProps {
  category: 'style' | 'color' | 'audio' | 'speed' | 'mask' | 'text' | 'ai';
  onClose: () => void;
}

export function MobilePropertiesSheet({ category, onClose }: MobilePropertiesSheetProps) {
  const {
    tracks,
    currentTime,
    pipWindows,
    mediaLibrary,
    updateClip,
  } = useEditorStore(useShallow((state) => ({
    tracks: state.tracks,
    currentTime: state.currentTime,
    pipWindows: state.pipWindows,
    mediaLibrary: state.mediaLibrary,
    updateClip: state.updateClip,
  })));

  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);

  const targetId = selectedClipIds[0] || selectedClipId;
  const clipResult = targetId ? findClipDeep(useEditorStore.getState(), targetId) : null;
  const clip = clipResult?.clip;

  const tabs = PROPERTY_REGISTRY[category] || [];
  
  const [currentSubTab, setCurrentSubTab] = useState<string>(tabs[0]?.id || '');

  // Keep subtab synced if category changes
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === currentSubTab)) {
      setCurrentSubTab(tabs[0].id);
    }
  }, [category, tabs]);

  if (!clip) return null;

  const ActiveComponent = tabs.find(t => t.id === currentSubTab)?.component;

  // We construct a prop object that contains everything a component might need.
  // The components will extract only what they need via their prop interface.
  const commonProps = {
    clip,
    selectedClip: clip, // many desktop components expect selectedClip
    updateClip,
    localTime: Math.max(0, currentTime - clip.startTime),
    absoluteStartTime: clip.startTime,
    animations: clip.animations || {},
    collapsedSections: {}, // for components that check accordion state
    toggleSection: () => {},
    // Getter/Setter helpers for Keyframes/UI
    getPropVal: (baseValue: number, propKey: string) => {
      // Basic mock for mobile for now, just return baseValue
      return baseValue;
    },
    setPropVal: (propKey: string, value: number, baseUpdateObj: any) => {
      updateClip(clip.id, baseUpdateObj);
    },
    // Speed helpers
    speed: clip.speed || 1,
    isRamped: !!clip.speedRamp,
    mediaLibrary,
    isReversed: !!clip.isReversed,
    freezeFrame: clip.freezeFrame,
    onSpeedChange: (v: number) => {
       const sourceDuration = clip.duration * (clip.speed ?? 1); 
       updateClip(clip.id, { speed: v, duration: sourceDuration / v }, { ripple: true });
    },
    onReset: () => {
       const sourceDuration = clip.duration * (clip.speed ?? 1); 
       updateClip(clip.id, { speed: 1, duration: sourceDuration }, { ripple: true });
    },
    onToggleReverse: () => updateClip(clip.id, { isReversed: !clip.isReversed }, { ripple: true }),
    onFreezeFrame: () => {
      const currentTime = useEditorStore.getState().currentTime;
      updateClip(clip.id, { freezeFrame: Math.max(0, currentTime - clip.startTime) }, { ripple: true });
    },
    onClearFreeze: () => updateClip(clip.id, { freezeFrame: undefined }, { ripple: true }),
    // Text helpers
    text: clip.textSettings?.text ?? '',
    fontFamily: clip.textSettings?.fontFamily ?? 'Inter',
    fontSize: clip.textSettings?.fontSize ?? 40,
    color: clip.textSettings?.color ?? '#ffffff',
    shadow: clip.textSettings?.shadow ?? false,
    bold: clip.textSettings?.bold ?? false,
    italic: clip.textSettings?.italic ?? false,
    underline: clip.textSettings?.underline ?? false,
    onChange: (v: any) => {
       // generic onChange handler, handled differently by different text components
       if (currentSubTab === 'content') updateClip(clip.id, { textSettings: { ...clip.textSettings!, text: v } });
       else if (currentSubTab === 'font') updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontFamily: v } });
       else if (currentSubTab === 'fontSize') updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontSize: v } });
       else if (currentSubTab === 'color') updateClip(clip.id, { textSettings: { ...clip.textSettings!, color: v } });
    },
    onToggle: () => {
      if (currentSubTab === 'shadow') updateClip(clip.id, { textSettings: { ...clip.textSettings!, shadow: !(clip.textSettings?.shadow ?? false) } });
    },
    onBoldToggle: () => updateClip(clip.id, { textSettings: { ...clip.textSettings!, bold: !(clip.textSettings?.bold ?? false) } }),
    onItalicToggle: () => updateClip(clip.id, { textSettings: { ...clip.textSettings!, italic: !(clip.textSettings?.italic ?? false) } }),
    onUnderlineToggle: () => updateClip(clip.id, { textSettings: { ...clip.textSettings!, underline: !(clip.textSettings?.underline ?? false) } }),
    textSettings: clip.textSettings,
    clipId: clip.id,
    
    // Mask
    enabled: clip.mask?.enabled ?? false,
    type: clip.mask?.type ?? 'none',
    invert: clip.mask?.invert ?? false,
    feather: clip.mask?.feather ?? 0,
    roundness: clip.mask?.roundness ?? 0,
    // Color
    temperature: clip.colorFilters?.temperature ?? 0,
    tint: clip.colorFilters?.tint ?? 0,
    exposure: clip.colorFilters?.exposure ?? 0,
    contrast: clip.colorFilters?.contrast ?? 100,
    saturation: clip.colorFilters?.saturation ?? 100,
    blur: clip.colorFilters?.blur ?? 0,
    fadedFilm: clip.colorFilters?.fadedFilm ?? 0,
    vignette: clip.colorFilters?.vignette ?? 0,
    curves: clip.colorFilters?.curves || {},
    selectedClipIds: [clip.id],
    // Audio
    clipAudio: clip.audioSettings || {},
    volume: clip.audioSettings?.volume ?? 0,
    pan: clip.audioSettings?.pan ?? 0,
    bass: clip.audioSettings?.bass ?? 0,
    mid: clip.audioSettings?.mid ?? 0,
    treble: clip.audioSettings?.treble ?? 0,
    onBassChange: (v: number) => updateClip(clip.id, { audioSettings: { ...clip.audioSettings, bass: v } as any }),
    onMidChange: (v: number) => updateClip(clip.id, { audioSettings: { ...clip.audioSettings, mid: v } as any }),
    onTrebleChange: (v: number) => updateClip(clip.id, { audioSettings: { ...clip.audioSettings, treble: v } as any }),
    handleAudioChange: (key: string, val: any) => updateClip(clip.id, { audioSettings: { ...clip.audioSettings, [key]: val } as any }),
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-[60vh] flex-col rounded-t-2xl bg-[#121215] shadow-2xl transition-transform duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold capitalize text-white">{category}</h3>
        <button
          onClick={onClose}
          className="rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="border-b border-white/5 overflow-x-auto no-scrollbar touch-pan-x">
        <div className="flex px-2 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentSubTab(tab.id)}
              className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                currentSubTab === tab.id
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {ActiveComponent && <ActiveComponent {...commonProps} />}
      </div>
    </div>
  );
}
