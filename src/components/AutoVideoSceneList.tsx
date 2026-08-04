import React, { useEffect, useState } from 'react';
import { AutoVideoScene } from '../utils/aiClient';
import { Settings, Image as ImageIcon, Map, Video, X, ChevronUp, ChevronDown, Scissors, RefreshCw } from 'lucide-react';
import { AutoVideoPreviewTrimmer } from './AutoVideoPreviewTrimmer';

const SequentialImage: React.FC<{ src: string; alt: string; className: string }> = ({ src, alt, className }) => {
  if (src && src.includes('pollinations.ai')) {
    return (
      <div className={`bg-[#141414] border-2 border-dashed border-[#2a2a2a] flex flex-col items-center justify-center ${className} p-2 text-center relative overflow-hidden`}>
         <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
         <ImageIcon className="w-5 h-5 text-indigo-500 mb-1 z-10" />
         <span className="text-[10px] text-white font-medium z-10">AI Image Ready</span>
         <span className="text-[8px] text-[#8a8a8a] z-10 mt-0.5 leading-tight">Will generate during assembly<br/>to prevent errors</span>
      </div>
    );
  }
  
  return <img src={src} alt={alt} crossOrigin="anonymous" className={className} loading="lazy" />;
};

interface AutoVideoSceneListProps {
  scenes: AutoVideoScene[];
  onChange: (scenes: AutoVideoScene[]) => void;
  disabled?: boolean;
  onRegenerateVisuals?: (index: number) => void;
  onSourceChange?: (index: number, newSource: 'pexels' | 'pollinations' | 'map') => void;
}

export const AutoVideoSceneList: React.FC<AutoVideoSceneListProps> = ({ scenes, onChange, disabled, onRegenerateVisuals, onSourceChange }) => {
  const updateScene = (index: number, updates: Partial<AutoVideoScene>) => {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], ...updates };
    onChange(newScenes);
  };

  const removeScene = (index: number) => {
    const newScenes = [...scenes];
    newScenes.splice(index, 1);
    onChange(newScenes);
  };

  const moveScene = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scenes.length - 1) return;

    const newScenes = [...scenes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIndex];
    newScenes[targetIndex] = temp;
    onChange(newScenes);
  };

  if (!scenes || scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[#3e3e3e] rounded bg-[#1e1e1e]/50 text-[#8a8a8a]">
        <p className="text-sm">No scenes generated yet.</p>
        <p className="text-xs mt-1">Generate a blueprint to see the scene breakdown here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      {scenes.map((scene, idx) => (
        <div key={idx} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded p-3 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className="bg-[#2a2a2a] text-xs font-mono px-2 py-0.5 rounded text-[#a0a0a0]">
                {scene.startTime.toFixed(1)}s - {scene.endTime.toFixed(1)}s
              </span>
              <span className="text-xs text-[#a0a0a0]">Duration: {scene.duration.toFixed(1)}s</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => moveScene(idx, 'up')}
                disabled={disabled || idx === 0}
                className="p-1 text-[#6a6a6a] hover:text-white disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => moveScene(idx, 'down')}
                disabled={disabled || idx === scenes.length - 1}
                className="p-1 text-[#6a6a6a] hover:text-white disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => removeScene(idx)}
                disabled={disabled}
                className="p-1 text-[#6a6a6a] hover:text-red-400 disabled:opacity-30 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          <div className="text-sm text-white font-medium bg-[#141414] p-2 rounded border border-[#2a2a2a]">
            "{scene.narration}"
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider">Visual Source</label>
              <div className="flex gap-2">
                {(['pexels', 'pollinations', 'map'] as const).map(src => (
                  <button
                    key={src}
                    disabled={disabled}
                    onClick={() => {
                      if (onSourceChange) {
                        onSourceChange(idx, src);
                      } else {
                        updateScene(idx, { visualSource: src });
                      }
                    }}
                    className={`flex-1 py-1.5 text-xs rounded border flex items-center justify-center gap-1.5 transition-colors
                      ${scene.visualSource === src 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : 'bg-[#2a2a2a] border-transparent text-[#a0a0a0] hover:bg-[#333]'
                      }`}
                  >
                    {src === 'pexels' && <Video className="w-3.5 h-3.5" />}
                    {src === 'pollinations' && <ImageIcon className="w-3.5 h-3.5" />}
                    {src === 'map' && <Map className="w-3.5 h-3.5" />}
                    <span className="capitalize">{src}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider">
                  {scene.visualSource === 'pexels' ? 'Search Query' : 
                   scene.visualSource === 'pollinations' ? 'Image Prompt' : 'Map Waypoints'}
                </label>
                {scene.visualSource !== 'map' && onRegenerateVisuals && (
                  <button 
                    onClick={() => onRegenerateVisuals(idx)} 
                    disabled={disabled}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px] font-medium"
                  >
                    <RefreshCw className="w-3 h-3" /> Fetch / Generate
                  </button>
                )}
              </div>
              {scene.visualSource === 'pexels' && (
                <input 
                  type="text" 
                  value={scene.pexelsQuery || ''}
                  onChange={e => updateScene(idx, { pexelsQuery: e.target.value })}
                  disabled={disabled}
                  className="w-full bg-[#141414] border border-[#3e3e3e] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              )}
              {scene.visualSource === 'pollinations' && (
                <textarea 
                  value={scene.pollinationsPrompt || ''}
                  onChange={e => updateScene(idx, { pollinationsPrompt: e.target.value })}
                  disabled={disabled}
                  rows={2}
                  className="w-full bg-[#141414] border border-[#3e3e3e] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500 resize-none"
                />
              )}
              {scene.visualSource === 'map' && (
                <div className="text-xs text-[#a0a0a0] bg-[#141414] border border-[#3e3e3e] rounded px-2 py-1.5 flex items-center gap-2">
                  <Map className="w-3.5 h-3.5 text-indigo-400" />
                  {scene.mapAnimation?.waypoints?.length || 0} waypoints plotted
                </div>
              )}
            </div>
          </div>

          {scene.visualSource === 'map' && scene.mapAnimation && (
            <div className="mt-2 w-full h-32 bg-[#1a1a1a] rounded border border-[#2a2a2a] flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover opacity-20" />
               <div className="flex flex-col items-center z-10 text-[#a0a0a0]">
                 <Map className="w-8 h-8 mb-2 opacity-50 text-indigo-400" />
                 <span className="text-xs font-medium text-white">{scene.mapAnimation.type.toUpperCase()} ANIMATION</span>
                 <span className="text-[10px] mt-1">{scene.mapAnimation.waypoints.length} waypoints plotted</span>
               </div>
            </div>
          )}

          {scene.layeredVisuals && scene.layeredVisuals.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider">Multi-Layer Elements (BG + PIP)</label>
              <div className="grid grid-cols-2 gap-2">
                {scene.layeredVisuals.map((lv, lIdx) => (
                  <div key={lIdx} className="w-full h-20 bg-black rounded overflow-hidden relative border border-[#2a2a2a]">
                    <SequentialImage src={lv.url} alt={`Layer ${lIdx}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[8px] text-white flex justify-between">
                      <span>{lv.isGreenScreen ? 'PIP (Green Screen)' : 'Background'}</span>
                      <span>Track {lv.trackOffset}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!scene.layeredVisuals && scene.visualOptions && scene.visualOptions.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider">Alternative Clips</label>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {scene.visualOptions.map((opt, oIdx) => (
                  <div 
                    key={oIdx} 
                    onClick={() => updateScene(idx, { selectedVisualUrl: opt.url })}
                    className={`w-24 h-16 shrink-0 rounded overflow-hidden cursor-pointer border-2 transition-all ${
                      (scene.selectedVisualUrl === opt.url || (!scene.selectedVisualUrl && oIdx === 0)) 
                        ? 'border-indigo-500 opacity-100' 
                        : 'border-transparent opacity-50 hover:opacity-100'
                    }`}
                  >
                    <SequentialImage src={opt.thumbnail || opt.url} alt="thumbnail" className="w-full h-full object-cover bg-black" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {scene.selectedVisualUrl && scene.visualOptions?.find(o => o.url === scene.selectedVisualUrl)?.type === 'video' && (
             <div className="mt-2 bg-[#141414] border border-[#2a2a2a] p-2 rounded">
               <AutoVideoPreviewTrimmer 
                 url={scene.selectedVisualUrl} 
                 type="video" 
                 duration={scene.visualOptions?.find(o => o.url === scene.selectedVisualUrl)?.duration || 15}
                 onTrimChange={(start, end) => updateScene(idx, { mediaStartTime: start, mediaEndTime: end })}
               />
               <div className="text-[10px] text-[#8a8a8a] mt-2 flex justify-between items-center">
                 <span>Previewing: <span className="text-white">{scene.mediaStartTime?.toFixed(1) || 0}s</span> to <span className="text-white">{scene.mediaEndTime?.toFixed(1) || (scene.mediaStartTime || 0) + scene.duration}s</span></span>
                 <span className="text-indigo-400">Fixed Dialogue Target: {scene.duration.toFixed(1)}s</span>
               </div>
             </div>
          )}
        </div>
      ))}
    </div>
  );
};
