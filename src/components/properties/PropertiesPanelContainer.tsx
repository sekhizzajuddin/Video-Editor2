/**
 * PropertiesPanelContainer.tsx
 * 
 * Main Container Component for Properties Panel.
 * Manages Zustand store hooks, keyframe evaluation, active tab routing,
 * transition inspector, subtitle editor, and renders modular sub-tabs.
 */

import React, { useState } from 'react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { PropertyTabHeader } from './PropertyTabHeader';
import { PropertyTransformTab } from './tabs/PropertyTransformTab';
import { PropertyMaskTab } from './tabs/PropertyMaskTab';
import { PropertyColorTab } from './tabs/PropertyColorTab';
import { PropertySpeedTab } from './tabs/PropertySpeedTab';
import { PropertyAudioTab } from './tabs/PropertyAudioTab';
import { PropertyTextTab } from './tabs/PropertyTextTab';
import { PropertyEffectsTab } from './tabs/PropertyEffectsTab';
import { PropertyThumbnailHistoryTab } from './tabs/PropertyThumbnailHistoryTab';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { Sliders, X, Sparkles } from 'lucide-react';

export function PropertiesPanelContainer() {
  const {
    tracks,
    selectedClipId,
    selectedClipIds,
    pipWindows,
    activePropertiesTab,
    setActivePropertiesTab,
    updateClip: storeUpdateClip,
    removeClip: storeRemoveClip,
    currentTime,
    selectedTransitionClipId,
    updateTransition,
    removeTransition,
    mediaLibrary,
    subtitles,
    selectedSubtitleId,
    updateSubtitle,
    deleteSubtitle,
    selectSubtitle,
  } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      selectedClipId: s.selectedClipId,
      selectedClipIds: s.selectedClipIds,
      pipWindows: s.pipWindows,
      activePropertiesTab: s.activePropertiesTab,
      setActivePropertiesTab: s.setActivePropertiesTab,
      updateClip: s.updateClip,
      removeClip: s.removeClip,
      currentTime: s.currentTime,
      selectedTransitionClipId: s.selectedTransitionClipId,
      updateTransition: s.updateTransition,
      removeTransition: s.removeTransition,
      mediaLibrary: s.mediaLibrary,
      subtitles: s.subtitles,
      selectedSubtitleId: s.selectedSubtitleId,
      updateSubtitle: s.updateSubtitle,
      deleteSubtitle: s.deleteSubtitle,
      selectSubtitle: s.selectSubtitle,
    }))
  );

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [isAnalyzingMotionGraphics, setIsAnalyzingMotionGraphics] = useState(false);
  const [motionGraphicsAnalyzeProgress, setMotionGraphicsAnalyzeProgress] = useState('');
  const [motionGraphicsSuggestions, setMotionGraphicsSuggestions] = useState<any[] | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);

  const state = useEditorStore.getState();
  const found = selectedClipId ? findClipDeep(state, selectedClipId) : null;
  const selectedClip = found ? found.clip : null;
  const selectedTrack = found ? found.track : undefined;

  let selectedTransitionClip = null;
  let selectedTransition = null;
  if (selectedTransitionClipId) {
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.transitionOut?.id === selectedTransitionClipId) {
          selectedTransitionClip = clip;
          selectedTransition = clip.transitionOut;
          break;
        }
      }
      if (selectedTransitionClip) break;
    }
  }

  const selectedSub = subtitles.find((s) => s.id === selectedSubtitleId);

  const updateClip = (id: string, updates: any, options?: any) => {
    storeUpdateClip(id, updates, options);
  };

  const getPropVal = (clipPropVal: any, propKey: string) => {
    if (!selectedClip) return clipPropVal;
    const anims = selectedClip.animations;
    if (!anims || !anims[propKey] || anims[propKey].length === 0) return clipPropVal;
    const localTime = currentTime - selectedClip.startTime;
    return getAnimatedValue(clipPropVal, localTime, 0, anims[propKey]);
  };

  const upd = (propKey: string, val: any) => {
    if (!selectedClip) return;
    const anims = selectedClip.animations || {};

    const baseUpdateObj: any = {};
    const keys = propKey.split('.');
    if (keys.length === 1) {
      baseUpdateObj[keys[0]] = val;
    } else if (keys.length === 2) {
      baseUpdateObj[keys[0]] = {
        ...(selectedClip as any)[keys[0]],
        [keys[1]]: val,
      };
    }

    if (anims[propKey] && anims[propKey].length > 0) {
      const localTime = currentTime - selectedClip.startTime;
      baseUpdateObj.animations = {
        ...anims,
        [propKey]: addOrUpdateKeyframe(anims[propKey], localTime, val),
      };
    }

    const targetClipIds = selectedClipIds.length > 0 ? selectedClipIds : [selectedClip.id];
    for (const id of targetClipIds) {
      updateClip(id, baseUpdateObj);
    }
  };

  const addKf = (propKey: string, val: any) => {
    if (!selectedClip) return;
    const anims = selectedClip.animations || {};
    const localTime = currentTime - selectedClip.startTime;
    const currentList = anims[propKey] || [];
    const updatedList = addOrUpdateKeyframe(currentList, localTime, val);
    updateClip(selectedClip.id, {
      animations: { ...anims, [propKey]: updatedList },
    });
    useEditorStore.getState().saveSnapshot();
  };

  const remKf = (propKey: string) => {
    if (!selectedClip) return;
    const anims = selectedClip.animations;
    if (!anims || !anims[propKey]) return;
    const localTime = currentTime - selectedClip.startTime;
    const updatedList = anims[propKey].filter((kf: any) => Math.abs(kf.time - localTime) >= 0.05);
    const newAnims = { ...anims };
    if (updatedList.length === 0) delete newAnims[propKey];
    else newAnims[propKey] = updatedList;

    updateClip(selectedClip.id, { animations: newAnims });
    useEditorStore.getState().saveSnapshot();
  };

  const isKfActive = (propKey: string) => {
    if (!selectedClip || !selectedClip.animations) return false;
    const kfs = selectedClip.animations[propKey];
    if (!kfs) return false;
    const localTime = currentTime - selectedClip.startTime;
    return kfs.some((kf: any) => Math.abs(kf.time - localTime) < 0.05);
  };

  // 1. Render Selected Subtitle Editor
  if (selectedSub) {
    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
        <div className="p-4 border-b border-[#3e3e3e] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Edit Subtitle</h3>
          <button
            onClick={() => selectSubtitle(null)}
            className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto text-xs">
          <div className="space-y-1">
            <label className="text-xs text-[#a0a0a0]">Subtitle Text</label>
            <textarea
              value={selectedSub.text}
              onChange={(e) => updateSubtitle(selectedSub.id, { text: e.target.value })}
              className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 min-h-[80px] focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => {
              deleteSubtitle(selectedSub.id);
              selectSubtitle(null);
            }}
            className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs transition-colors"
          >
            Delete Subtitle
          </button>
        </div>
      </div>
    );
  }

  // 2. Render Transition Inspector
  if (selectedTransition && selectedTransitionClip) {
    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
        <div className="p-4 border-b border-[#3e3e3e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Transition Settings</h3>
              <p className="text-[11px] text-[#a0a0a0] truncate max-w-[180px]">{selectedTransition.name}</p>
            </div>
          </div>
          <button
            onClick={() => useEditorStore.getState().selectTransition(null)}
            className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto text-xs">
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 space-y-2">
            <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block">Duration</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.2}
                max={3.0}
                step={0.1}
                value={selectedTransition.duration}
                onChange={(e) => updateTransition(selectedTransitionClip.id, { duration: Number(e.target.value) })}
                className="flex-1 accent-purple-500"
              />
              <span className="font-mono text-white text-xs">{selectedTransition.duration.toFixed(1)}s</span>
            </div>
          </div>
          <button
            onClick={() => removeTransition(selectedTransitionClip.id)}
            className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs transition-colors"
          >
            Remove Transition
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e] overflow-hidden select-none">
      {/* Top Tab Header */}
      <PropertyTabHeader
        activeTab={activePropertiesTab}
        setActiveTab={setActivePropertiesTab}
        selectedClip={selectedClip}
      />

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!selectedClip && activePropertiesTab !== 'history' && activePropertiesTab !== 'thumbnail' ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#a0a0a0]">
            <Sliders className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs font-medium text-white mb-1">No Clip Selected</p>
            <p className="text-[10px] text-[#6a6a6a]">Select a clip in the timeline to inspect and edit its properties</p>
          </div>
        ) : (
          <>
            {activePropertiesTab === 'transform' && selectedClip && (
              <PropertyTransformTab
                selectedClip={selectedClip}
                selectedClipIds={selectedClipIds}
                selectedTrack={selectedTrack}
                currentTime={currentTime}
                updateClip={updateClip}
                getPropVal={getPropVal}
                upd={upd}
                addKf={addKf}
                remKf={remKf}
                isKfActive={isKfActive}
                collapsedSections={collapsedSections}
                setCollapsedSections={setCollapsedSections}
                isTracking={isTracking}
                setIsTracking={setIsTracking}
                trackProgress={trackProgress}
                setTrackProgress={setTrackProgress}
              />
            )}

            {activePropertiesTab === 'mask' && selectedClip && (
              <PropertyMaskTab
                selectedClip={selectedClip}
                tracks={tracks}
                mediaLibrary={mediaLibrary}
                updateClip={updateClip}
              />
            )}

            {activePropertiesTab === 'color' && selectedClip && (
              <PropertyColorTab
                selectedClip={selectedClip}
                currentTime={currentTime}
                mediaLibrary={mediaLibrary}
                updateClip={updateClip}
                getPropVal={getPropVal}
                upd={upd}
                addKf={addKf}
                remKf={remKf}
                isKfActive={isKfActive}
              />
            )}

            {activePropertiesTab === 'speed' && selectedClip && (
              <PropertySpeedTab
                selectedClip={selectedClip}
                currentTime={currentTime}
                mediaLibrary={mediaLibrary}
                updateClip={updateClip}
              />
            )}

            {activePropertiesTab === 'audio' && selectedClip && (
              <PropertyAudioTab
                selectedClip={selectedClip}
                selectedTrack={selectedTrack}
                currentTime={currentTime}
                mediaLibrary={mediaLibrary}
                updateClip={updateClip}
                getPropVal={getPropVal}
                upd={upd}
                addKf={addKf}
                remKf={remKf}
                isKfActive={isKfActive}
              />
            )}

            {activePropertiesTab === 'text' && selectedClip && (
              <PropertyTextTab
                selectedClip={selectedClip}
                updateClip={updateClip}
              />
            )}

            {activePropertiesTab === 'effects' && selectedClip && (
              <PropertyEffectsTab
                selectedClip={selectedClip}
                selectedTrack={selectedTrack}
                updateClip={updateClip}
                aiProvider={aiProvider}
                setAiProvider={setAiProvider}
                isAnalyzingMotionGraphics={isAnalyzingMotionGraphics}
                motionGraphicsAnalyzeProgress={motionGraphicsAnalyzeProgress}
                handleAiMotionGraphicsDesign={() => {}}
              />
            )}

            {(activePropertiesTab === 'thumbnail' || activePropertiesTab === 'history') && (
              <PropertyThumbnailHistoryTab activeTab={activePropertiesTab} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
