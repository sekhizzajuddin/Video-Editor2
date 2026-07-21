import React from 'react';
import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface TextAdvancedFeatureProps {
  clip: TimelineClip;
}

export function TextAdvancedFeature({ clip }: TextAdvancedFeatureProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  const textSettings = clip.textSettings;
  
  if (!textSettings) return null;

  return (
    <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-4">
      <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider">Advanced Text</h3>
      
      {/* 3D Settings */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer border-b border-[#3e3e3e] pb-2">
          <input
            type="checkbox"
            checked={textSettings.threeD || false}
            onChange={(e) => {
              updateClip(clip.id, { textSettings: { ...textSettings, threeD: e.target.checked } });
              useEditorStore.getState().saveSnapshot();
            }}
            className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
          />
          <span className="text-xs text-white">Enable 3D Extrusion</span>
        </label>
        
        {textSettings.threeD && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px] text-[#a0a0a0]">
              <span>3D Depth</span>
              <span className="text-white font-mono">{textSettings.threeDDepth || 10}px</span>
            </div>
            <input
              type="range" min="1" max="100"
              value={textSettings.threeDDepth || 10}
              onChange={(e) => updateClip(clip.id, { textSettings: { ...textSettings, threeDDepth: Number(e.target.value) } })}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full accent-amber-500"
            />
          </div>
        )}
      </div>

      {/* Text Animation */}
      <div className="space-y-3 border-t border-[#3e3e3e] pt-3">
        <h4 className="text-[10px] text-[#a0a0a0]">Text Animation (In/Out)</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[9px] text-[#888]">In Animation</label>
            <select
              value={textSettings.animation?.in || 'none'}
              onChange={(e) => updateClip(clip.id, { 
                textSettings: { 
                  ...textSettings, 
                  animation: { ...(textSettings.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 }), in: e.target.value as any } 
                } 
              })}
              className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="none">None</option>
              <option value="fadeIn">Fade In</option>
              <option value="typewriter">Typewriter</option>
              <option value="slideUp">Slide Up</option>
              <option value="slideDown">Slide Down</option>
              <option value="slideLeft">Slide Left</option>
              <option value="slideRight">Slide Right</option>
              <option value="bounce">Bounce</option>
              <option value="zoom">Zoom</option>
              <option value="elastic">Elastic</option>
              <option value="revealWipe">Reveal Wipe</option>
              <option value="splitReveal">Split Reveal</option>
              <option value="glitch">Glitch</option>
              <option value="letterSpacing">Letter Spacing</option>
              <option value="rollUp">Roll Up</option>
              <option value="scaleFlip">Scale Flip</option>
              <option value="zoomBlur">Zoom Blur</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-[#888]">Out Animation</label>
            <select
              value={textSettings.animation?.out || 'none'}
              onChange={(e) => updateClip(clip.id, { 
                textSettings: { 
                  ...textSettings, 
                  animation: { ...(textSettings.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 }), out: e.target.value as any } 
                } 
              })}
              className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="none">None</option>
              <option value="fadeOut">Fade Out</option>
              <option value="slideUp">Slide Up</option>
              <option value="slideDown">Slide Down</option>
              <option value="slideLeft">Slide Left</option>
              <option value="slideRight">Slide Right</option>
              <option value="zoom">Zoom Out</option>
              <option value="glitch">Glitch</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[9px] text-[#888]">In Duration (s)</label>
            <input
              type="number" step="0.1" min="0" max="5"
              value={textSettings.animation?.inDuration ?? 0.5}
              onChange={(e) => updateClip(clip.id, { 
                textSettings: { 
                  ...textSettings, 
                  animation: { ...(textSettings.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 }), inDuration: Number(e.target.value) } 
                } 
              })}
              className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-[#888]">Out Duration (s)</label>
            <input
              type="number" step="0.1" min="0" max="5"
              value={textSettings.animation?.outDuration ?? 0.5}
              onChange={(e) => updateClip(clip.id, { 
                textSettings: { 
                  ...textSettings, 
                  animation: { ...(textSettings.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 }), outDuration: Number(e.target.value) } 
                } 
              })}
              className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
