/**
 * PropertyTextTab.tsx
 * 
 * Text inspector tab for Properties Panel.
 * Manages Content, Font Family, Font Size, Colors, Stroke Width, Text Alignment,
 * Style Presets, and Text Animation IN/OUT Presets.
 */

import React from 'react';
import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { TEXT_TEMPLATES } from '@/utils/textTemplates';

interface PropertyTextTabProps {
  selectedClip: TimelineClip;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
}

export function PropertyTextTab({ selectedClip, updateClip }: PropertyTextTabProps) {
  if (!selectedClip.textSettings) return null;

  const textSettings = selectedClip.textSettings;

  return (
    <div className="space-y-4 p-4 text-xs select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Text Properties</h3>
      </div>
      
      <div className="space-y-4">
        {/* Content */}
        <div className="space-y-1">
          <label className="text-xs text-[#a0a0a0]">Content</label>
          <textarea
            value={textSettings.text}
            onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, text: e.target.value } })}
            onBlur={() => useEditorStore.getState().saveSnapshot()}
            className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Style Presets */}
        <div className="space-y-1">
          <label className="text-xs text-[#a0a0a0]">Style Presets</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-1.5 border border-[#3e3e3e]/40 rounded bg-[#181818] scrollbar-thin">
            {TEXT_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                onClick={() => {
                  updateClip(selectedClip.id, {
                    textSettings: {
                      ...textSettings,
                      fontSize: tmpl.settings.fontSize,
                      fontFamily: tmpl.settings.fontFamily,
                      color: tmpl.settings.color,
                      bold: tmpl.settings.bold || false,
                      italic: tmpl.settings.italic || false,
                      underline: tmpl.settings.underline || false,
                      shadow: tmpl.settings.shadow || false,
                      backgroundColor: tmpl.settings.backgroundColor || 'transparent',
                      strokeColor: tmpl.settings.strokeColor || undefined,
                      strokeWidth: tmpl.settings.strokeWidth || undefined,
                      animationPreset: (tmpl.settings.animationPreset as any) || undefined,
                    }
                  });
                  useEditorStore.getState().saveSnapshot();
                }}
                className="p-2 bg-[#2d2d2d] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-left truncate transition-colors text-[10px] text-white flex items-center justify-center font-semibold"
                title={tmpl.name}
              >
                <span className={tmpl.style} style={{ fontSize: '10px' }}>{tmpl.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="space-y-1">
          <label className="text-xs text-[#a0a0a0]">Font Family</label>
          <select
            value={textSettings.fontFamily || 'Inter'}
            onChange={(e) => {
              updateClip(selectedClip.id, { textSettings: { ...textSettings, fontFamily: e.target.value } });
              useEditorStore.getState().saveSnapshot();
            }}
            className="w-full bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
          >
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Poppins">Poppins</option>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Bebas Neue">Bebas Neue</option>
            <option value="Oswald">Oswald</option>
            <option value="Lato">Lato</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Impact">Impact</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
            <option value="Courier New">Courier New</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="space-y-1">
          <label className="text-xs text-[#a0a0a0]">Font Size</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="12"
              max="150"
              value={textSettings.fontSize}
              onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, fontSize: Number(e.target.value) } })}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onTouchEnd={() => useEditorStore.getState().saveSnapshot()}
              className="flex-1 accent-amber-500 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-white w-8 text-right font-mono">{textSettings.fontSize}</span>
          </div>
        </div>

        {/* Color & Background */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-[#a0a0a0]">Color</label>
            <div className="flex items-center gap-2 bg-[#1e1e1e] p-1.5 rounded border border-[#3e3e3e]">
              <input
                type="color"
                value={textSettings.color || '#ffffff'}
                onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, color: e.target.value } })}
                onBlur={() => useEditorStore.getState().saveSnapshot()}
                className="w-6 h-6 rounded bg-transparent cursor-pointer"
              />
              <span className="text-xs text-white uppercase font-mono">{textSettings.color}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#a0a0a0]">Background</label>
            <div className="flex items-center gap-2 bg-[#1e1e1e] p-1.5 rounded border border-[#3e3e3e]">
              <input
                type="color"
                value={textSettings.backgroundColor === 'transparent' ? '#000000' : textSettings.backgroundColor}
                onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, backgroundColor: e.target.value } })}
                onBlur={() => useEditorStore.getState().saveSnapshot()}
                className="w-6 h-6 rounded bg-transparent cursor-pointer"
              />
              <button 
                onClick={() => {
                  updateClip(selectedClip.id, { textSettings: { ...textSettings, backgroundColor: 'transparent' } });
                  useEditorStore.getState().saveSnapshot();
                }}
                className="text-[10px] bg-[#3e3e3e] hover:bg-[#5e5e5e] px-2 py-0.5 rounded text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Stroke Color & Width */}
        <div className="grid grid-cols-2 gap-4 border-t border-[#3e3e3e] pt-4">
          <div className="space-y-1">
            <label className="text-xs text-[#a0a0a0]">Stroke Color</label>
            <div className="flex items-center gap-2 bg-[#1e1e1e] p-1.5 rounded border border-[#3e3e3e]">
              <input
                type="color"
                value={textSettings.strokeColor || '#000000'}
                onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, strokeColor: e.target.value } })}
                onBlur={() => useEditorStore.getState().saveSnapshot()}
                className="w-6 h-6 rounded bg-transparent cursor-pointer"
              />
              <span className="text-xs text-white uppercase font-mono">{textSettings.strokeColor || '#000000'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#a0a0a0]">Stroke Width</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="20"
                value={textSettings.strokeWidth || 0}
                onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, strokeWidth: Number(e.target.value) } })}
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                onTouchEnd={() => useEditorStore.getState().saveSnapshot()}
                className="flex-1 accent-amber-500 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span className="text-xs text-white w-5 text-right font-mono">{textSettings.strokeWidth || 0}</span>
            </div>
          </div>
        </div>

        {/* Bold & Italic */}
        <div className="flex items-center gap-4 border-t border-[#3e3e3e] pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={textSettings.bold}
              onChange={(e) => {
                updateClip(selectedClip.id, { textSettings: { ...textSettings, bold: e.target.checked } });
                useEditorStore.getState().saveSnapshot();
              }}
              className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
            />
            <span className="text-xs text-white font-bold">Bold</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={textSettings.italic}
              onChange={(e) => {
                updateClip(selectedClip.id, { textSettings: { ...textSettings, italic: e.target.checked } });
                useEditorStore.getState().saveSnapshot();
              }}
              className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
            />
            <span className="text-xs text-white italic">Italic</span>
          </label>
        </div>
      </div>

      {/* 3D Depth & Animation Settings */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-4">
        <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider">Advanced Text</h3>
        
        {/* 3D Settings */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer border-b border-[#3e3e3e] pb-2">
            <input
              type="checkbox"
              checked={textSettings.threeD || false}
              onChange={(e) => {
                updateClip(selectedClip.id, { textSettings: { ...textSettings, threeD: e.target.checked } });
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
                onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...textSettings, threeDDepth: Number(e.target.value) } })}
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
                onChange={(e) => updateClip(selectedClip.id, { 
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
                onChange={(e) => updateClip(selectedClip.id, { 
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
                onChange={(e) => updateClip(selectedClip.id, { 
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
                onChange={(e) => updateClip(selectedClip.id, { 
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
    </div>
  );
}
