/**
 * PropertyColorTab.tsx
 * 
 * Color inspector tab for Properties Panel.
 * Manages Basic Correction (Temperature, Tint, Exposure, Contrast, Saturation, Blur, Auto Color AI),
 * Creative (Faded Film, Vignette), 3-Way Color Grading Wheels, LUT Color Grade,
 * AI Background Removal, Chroma Key (Green Screen with Canvas Eyedropper), and Luma Key.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Pipette,
} from 'lucide-react';
import { TimelineClip, MediaItem, ClipColorFilters } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { ColorWheel } from '../ColorWheel';
import { calculateAutoColor } from '@/utils/autoColor';

interface PropertyColorTabProps {
  selectedClip: TimelineClip;
  currentTime: number;
  mediaLibrary: MediaItem[];
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  getPropVal: (clipPropVal: any, propKey: string) => any;
  upd: (propKey: string, val: any) => void;
  addKf: (propKey: string, val: any) => void;
  remKf: (propKey: string) => void;
  isKfActive: (propKey: string) => boolean;
}

const CHROMA_KEY_PRESETS = [
  { name: 'Green Screen', hex: '#00ff00' },
  { name: 'Blue Screen', hex: '#0000ff' },
  { name: 'Pure Red', hex: '#ff0000' },
  { name: 'Magenta', hex: '#ff00ff' },
  { name: 'Cyan', hex: '#00ffff' },
];

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const KeyframeIcon = ({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button
    onClick={onClick}
    title={active ? 'Remove keyframe at current playhead' : 'Add keyframe at current playhead'}
    className={`p-1 rounded transition-colors ${
      active
        ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40'
        : 'text-[#888] hover:text-white hover:bg-[#3e3e3e]'
    }`}
  >
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 22 12 12 22 2 12 12 2" />
    </svg>
  </button>
);

export function PropertyColorTab({
  selectedClip,
  currentTime,
  mediaLibrary,
  updateClip,
  getPropVal,
  upd,
  addKf,
  remKf,
  isKfActive,
}: PropertyColorTabProps) {
  const [isPickingChromaColor, setIsPickingChromaColor] = useState(false);

  const defaultColorFilters: ClipColorFilters = {
    temperature: 0,
    tint: 0,
    exposure: 0,
    contrast: 100,
    saturation: 100,
    blur: 0,
    fadedFilm: 0,
    vignette: 0,
    shadows: { hue: 0, saturation: 0, lift: 0 },
    midtones: { hue: 0, saturation: 0, lift: 0 },
    highlights: { hue: 0, saturation: 0, lift: 0 },
  };

  const clipFilters: ClipColorFilters = selectedClip.colorFilters || defaultColorFilters;

  const handleFilterChange = (key: keyof ClipColorFilters, val: any) => {
    const current = selectedClip.colorFilters || defaultColorFilters;
    updateClip(selectedClip.id, {
      colorFilters: {
        ...current,
        [key]: val,
      },
    });
  };

  const handleFilterReset = (key: keyof ClipColorFilters) => {
    const current = selectedClip.colorFilters || defaultColorFilters;
    const defaultVal = defaultColorFilters[key];
    updateClip(selectedClip.id, {
      colorFilters: {
        ...current,
        [key]: defaultVal,
      },
    });
    useEditorStore.getState().saveSnapshot();
  };

  useEffect(() => {
    if (!isPickingChromaColor) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const canvas = useEditorStore.getState().previewCanvas;
      if (!canvas) {
        setIsPickingChromaColor(false);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clickX = Math.round((e.clientX - rect.left) * scaleX);
      const clickY = Math.round((e.clientY - rect.top) * scaleY);

      if (clickX >= 0 && clickX < canvas.width && clickY >= 0 && clickY < canvas.height) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
          const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

          const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
          updateClip(selectedClip.id, {
            chromaKey: {
              ...existing,
              enabled: true,
              color: hex,
            },
          });
          useEditorStore.getState().saveSnapshot();
        }
      }

      setIsPickingChromaColor(false);
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [isPickingChromaColor, selectedClip, updateClip]);

  return (
    <div className="space-y-4 p-4 text-xs select-none">
      {/* Basic Correction Section */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Basic Correction</span>
          <button
            onClick={() => {
              updateClip(selectedClip.id, {
                colorFilters: {
                  ...selectedClip.colorFilters,
                  temperature: 0,
                  tint: 0,
                  exposure: 0,
                  contrast: 100,
                  saturation: 100,
                  blur: 0,
                  fadedFilm: 0,
                  vignette: 0,
                }
              });
              useEditorStore.getState().saveSnapshot();
            }}
            className="text-[9px] text-[#a0a0a0] hover:text-amber-400 transition-colors"
          >
            Reset Basic
          </button>
        </div>

        {/* Temperature */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span className="flex items-center gap-1">
              Temperature
              <KeyframeIcon
                active={isKfActive('color.temperature')}
                onClick={() => isKfActive('color.temperature') ? remKf('color.temperature') : addKf('color.temperature', clipFilters.temperature)}
              />
            </span>
            <span className="font-mono">{getPropVal(clipFilters.temperature, 'color.temperature')}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={getPropVal(clipFilters.temperature, 'color.temperature')}
            onChange={(e) => handleFilterChange('temperature', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleFilterReset('temperature')}
            className="w-full h-1 bg-gradient-to-r from-blue-500 via-gray-600 to-amber-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        {/* Tint */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span className="flex items-center gap-1">
              Tint
              <KeyframeIcon
                active={isKfActive('color.tint')}
                onClick={() => isKfActive('color.tint') ? remKf('color.tint') : addKf('color.tint', clipFilters.tint)}
              />
            </span>
            <span className="font-mono">{getPropVal(clipFilters.tint, 'color.tint')}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={getPropVal(clipFilters.tint, 'color.tint')}
            onChange={(e) => handleFilterChange('tint', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleFilterReset('tint')}
            className="w-full h-1 bg-gradient-to-r from-green-500 via-gray-600 to-magenta-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        {/* Auto Color AI Button */}
        <button
          onClick={() => {
            const canvas = useEditorStore.getState().previewCanvas;
            if (canvas) {
              const res = calculateAutoColor(canvas as any);
              updateClip(selectedClip.id, {
                colorFilters: {
                  ...clipFilters,
                  exposure: res.exposure ?? 0,
                  contrast: res.contrast ?? 100,
                  saturation: res.saturation ?? 100,
                  temperature: res.temperature ?? 0,
                  tint: res.tint ?? 0
                }
              });
              useEditorStore.getState().saveSnapshot();
            }
          }}
          className="w-full py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" /> Auto-Color AI Enhance
        </button>

        {/* Exposure, Contrast, Saturation & Blur */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#3e3e3e]">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Exposure</span>
              <span className="font-mono">{getPropVal(clipFilters.exposure, 'color.exposure')}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={getPropVal(clipFilters.exposure, 'color.exposure')}
              onChange={(e) => handleFilterChange('exposure', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => handleFilterReset('exposure')}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Contrast</span>
              <span className="font-mono">{getPropVal(clipFilters.contrast, 'color.contrast')}</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={getPropVal(clipFilters.contrast, 'color.contrast')}
              onChange={(e) => handleFilterChange('contrast', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => handleFilterReset('contrast')}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Saturation</span>
              <span className="font-mono">{getPropVal(clipFilters.saturation, 'color.saturation')}</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={getPropVal(clipFilters.saturation, 'color.saturation')}
              onChange={(e) => handleFilterChange('saturation', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => handleFilterReset('saturation')}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Blur</span>
              <span className="font-mono">{getPropVal(clipFilters.blur, 'color.blur')}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={getPropVal(clipFilters.blur, 'color.blur')}
              onChange={(e) => handleFilterChange('blur', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => handleFilterReset('blur')}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Creative Effects */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Creative Look</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Faded Film</span>
              <span className="font-mono">{getPropVal(clipFilters.fadedFilm ?? 0, 'color.fadedFilm')}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={getPropVal(clipFilters.fadedFilm ?? 0, 'color.fadedFilm')}
              onChange={(e) => handleFilterChange('fadedFilm', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => handleFilterReset('fadedFilm')}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Vignette</span>
              <span className="font-mono">{getPropVal(clipFilters.vignette ?? 0, 'color.vignette')}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={getPropVal(clipFilters.vignette ?? 0, 'color.vignette')}
              onChange={(e) => handleFilterChange('vignette', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => handleFilterReset('vignette')}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      </div>

      {/* 3-Way Color Wheels */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">3-Way Color Wheels</span>
        </div>

        <div className="flex gap-2">
          <ColorWheel
            label="Shadows"
            value={clipFilters.shadows || { hue: 0, saturation: 0, lift: 0 }}
            onChange={(val) => {
              updateClip(selectedClip.id, {
                colorFilters: { ...clipFilters, shadows: val }
              });
            }}
          />
          <ColorWheel
            label="Midtones"
            value={clipFilters.midtones || { hue: 0, saturation: 0, lift: 0 }}
            onChange={(val) => {
              updateClip(selectedClip.id, {
                colorFilters: { ...clipFilters, midtones: val }
              });
            }}
          />
          <ColorWheel
            label="Highlights"
            value={clipFilters.highlights || { hue: 0, saturation: 0, lift: 0 }}
            onChange={(val) => {
              updateClip(selectedClip.id, {
                colorFilters: { ...clipFilters, highlights: val }
              });
            }}
          />
        </div>
      </div>

      {/* LUT Color Grading */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">LUT Color Grade</span>
          <button
            onClick={() => {
              updateClip(selectedClip.id, { lut: undefined });
              useEditorStore.getState().saveSnapshot();
            }}
            className="text-[9px] text-[#a0a0a0] hover:text-amber-400 transition-colors"
          >
            Clear LUT
          </button>
        </div>

        <div className="space-y-2">
          <select
            value={selectedClip.lut?.mediaId || ''}
            onChange={(e) => {
              if (e.target.value) {
                updateClip(selectedClip.id, {
                  lut: { mediaId: e.target.value, intensity: selectedClip.lut?.intensity ?? 100 }
                });
              } else {
                updateClip(selectedClip.id, { lut: undefined });
              }
              useEditorStore.getState().saveSnapshot();
            }}
            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-white text-xs rounded p-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="">No LUT Applied</option>
            {mediaLibrary.filter(m => m.type === 'lut').map(lut => (
              <option key={lut.id} value={lut.id}>{lut.name}</option>
            ))}
          </select>

          {selectedClip.lut && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                <span>LUT Intensity</span>
                <span className="font-mono">{selectedClip.lut?.intensity ?? 100}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={selectedClip.lut?.intensity ?? 100}
                onChange={(e) => {
                  updateClip(selectedClip.id, {
                    lut: {
                      ...selectedClip.lut!,
                      intensity: Number(e.target.value)
                    }
                  });
                }}
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Chroma Key / Green Screen */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Chroma Key (Green Screen)</span>
          <button
            onClick={() => {
              const existing = selectedClip.chromaKey ?? { enabled: false, color: '#00ff00', threshold: 30, softness: 10 };
              updateClip(selectedClip.id, {
                chromaKey: { ...existing, enabled: !existing.enabled }
              });
              useEditorStore.getState().saveSnapshot();
            }}
            className={`w-8 h-4 rounded-full transition-colors relative ${selectedClip.chromaKey?.enabled ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedClip.chromaKey?.enabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>

        {selectedClip.chromaKey?.enabled && (
          <div className="space-y-3 pt-2 border-t border-[#3e3e3e]">
            {/* Quick Presets */}
            <div className="flex gap-1.5 flex-wrap">
              {CHROMA_KEY_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                    updateClip(selectedClip.id, {
                      chromaKey: { ...existing, color: preset.hex }
                    });
                    useEditorStore.getState().saveSnapshot();
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] transition-colors ${
                    selectedClip.chromaKey?.color?.toLowerCase() === preset.hex.toLowerCase()
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-[#3e3e3e] bg-[#1e1e1e] text-[#a0a0a0] hover:border-[#5e5e5e] hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: preset.hex }} />
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Key Color & Eyedropper */}
            <div className="flex items-center gap-2 bg-[#1e1e1e] p-2 rounded border border-[#3e3e3e]">
              <div className="w-8 h-8 rounded border border-white/10 shrink-0 shadow-inner" style={{ backgroundColor: selectedClip.chromaKey?.color || '#00ff00' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white font-mono uppercase">{selectedClip.chromaKey?.color || '#00FF00'}</div>
              </div>
              <input
                type="color"
                value={selectedClip.chromaKey?.color || '#00ff00'}
                onChange={(e) => {
                  const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                  updateClip(selectedClip.id, { chromaKey: { ...existing, color: e.target.value } });
                }}
                onBlur={() => useEditorStore.getState().saveSnapshot()}
                className="w-6 h-6 bg-transparent border-0 rounded cursor-pointer"
              />
              <button
                onClick={() => setIsPickingChromaColor(true)}
                disabled={isPickingChromaColor}
                className={`p-1.5 rounded transition-colors ${isPickingChromaColor ? 'bg-emerald-500 text-black' : 'bg-[#3e3e3e] text-[#a0a0a0] hover:text-white'}`}
                title="Pick color from canvas"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Threshold & Softness */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                  <span>Threshold</span>
                  <span className="font-mono">{selectedClip.chromaKey?.threshold ?? 30}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedClip.chromaKey?.threshold ?? 30}
                  onChange={(e) => {
                    const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                    updateClip(selectedClip.id, { chromaKey: { ...existing, threshold: Number(e.target.value) } });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                  <span>Softness</span>
                  <span className="font-mono">{selectedClip.chromaKey?.softness ?? 10}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedClip.chromaKey?.softness ?? 10}
                  onChange={(e) => {
                    const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                    updateClip(selectedClip.id, { chromaKey: { ...existing, softness: Number(e.target.value) } });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
