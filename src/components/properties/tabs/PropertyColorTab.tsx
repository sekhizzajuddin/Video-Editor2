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
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';

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
  const localClipTime = Math.max(0, currentTime - selectedClip.startTime);

  const handleAddKeyframe = (propKey: string) => (time: number, val: number) => addKf(propKey, val);
  const handleRemoveKeyframe = (propKey: string) => (time: number) => remKf(propKey);
  const handleUpdateEasing = (propKey: string) => (time: number, easing: any) => {
    const anims = selectedClip.animations || {};
    const currentList = anims[propKey] || [];
    const updatedList = currentList.map(kf => Math.abs(kf.time - time) < 0.05 ? { ...kf, easing } : kf);
    updateClip(selectedClip.id, { animations: { ...anims, [propKey]: updatedList } });
    useEditorStore.getState().saveSnapshot();
  };
  const handleJumpToNext = (propKey: string) => () => {
    const anims = selectedClip.animations || {};
    const currentList = anims[propKey] || [];
    const nextKf = currentList.find(k => k.time > localClipTime + 0.05);
    if (nextKf) useEditorStore.getState().seek(selectedClip.startTime + nextKf.time);
  };
  const handleJumpToPrev = (propKey: string) => () => {
    const anims = selectedClip.animations || {};
    const currentList = anims[propKey] || [];
    const prevKf = [...currentList].reverse().find(k => k.time < localClipTime - 0.05);
    if (prevKf) useEditorStore.getState().seek(selectedClip.startTime + prevKf.time);
  };

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
              <KeyframeControl
                propertyKey="color.temperature"
                value={clipFilters.temperature}
                keyframes={selectedClip.animations?.['color.temperature'] || []}
                currentTime={localClipTime}
                clipId={selectedClip.id}
                onAddKeyframe={handleAddKeyframe('color.temperature')}
                onRemoveKeyframe={handleRemoveKeyframe('color.temperature')}
                onUpdateEasing={handleUpdateEasing('color.temperature')}
                onJumpToNext={handleJumpToNext('color.temperature')}
                onJumpToPrev={handleJumpToPrev('color.temperature')}
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
              <KeyframeControl
                propertyKey="color.tint"
                value={clipFilters.tint}
                keyframes={selectedClip.animations?.['color.tint'] || []}
                currentTime={localClipTime}
                clipId={selectedClip.id}
                onAddKeyframe={handleAddKeyframe('color.tint')}
                onRemoveKeyframe={handleRemoveKeyframe('color.tint')}
                onUpdateEasing={handleUpdateEasing('color.tint')}
                onJumpToNext={handleJumpToNext('color.tint')}
                onJumpToPrev={handleJumpToPrev('color.tint')}
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
              <span className="flex items-center gap-1">
                Exposure
                <KeyframeControl
                  propertyKey="color.exposure"
                  value={clipFilters.exposure ?? 0}
                  keyframes={selectedClip.animations?.['color.exposure'] || []}
                  currentTime={localClipTime}
                  clipId={selectedClip.id}
                  onAddKeyframe={handleAddKeyframe('color.exposure')}
                  onRemoveKeyframe={handleRemoveKeyframe('color.exposure')}
                  onUpdateEasing={handleUpdateEasing('color.exposure')}
                  onJumpToNext={handleJumpToNext('color.exposure')}
                  onJumpToPrev={handleJumpToPrev('color.exposure')}
                />
              </span>
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
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['color.exposure'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span className="flex items-center gap-1">
                Contrast
                <KeyframeControl
                  propertyKey="color.contrast"
                  value={clipFilters.contrast ?? 100}
                  keyframes={selectedClip.animations?.['color.contrast'] || []}
                  currentTime={localClipTime}
                  clipId={selectedClip.id}
                  onAddKeyframe={handleAddKeyframe('color.contrast')}
                  onRemoveKeyframe={handleRemoveKeyframe('color.contrast')}
                  onUpdateEasing={handleUpdateEasing('color.contrast')}
                  onJumpToNext={handleJumpToNext('color.contrast')}
                  onJumpToPrev={handleJumpToPrev('color.contrast')}
                />
              </span>
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
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['color.contrast'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span className="flex items-center gap-1">
                Saturation
                <KeyframeControl
                  propertyKey="color.saturation"
                  value={clipFilters.saturation ?? 100}
                  keyframes={selectedClip.animations?.['color.saturation'] || []}
                  currentTime={localClipTime}
                  clipId={selectedClip.id}
                  onAddKeyframe={handleAddKeyframe('color.saturation')}
                  onRemoveKeyframe={handleRemoveKeyframe('color.saturation')}
                  onUpdateEasing={handleUpdateEasing('color.saturation')}
                  onJumpToNext={handleJumpToNext('color.saturation')}
                  onJumpToPrev={handleJumpToPrev('color.saturation')}
                />
              </span>
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
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['color.saturation'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span className="flex items-center gap-1">
                Blur
                <KeyframeControl
                  propertyKey="color.blur"
                  value={clipFilters.blur ?? 0}
                  keyframes={selectedClip.animations?.['color.blur'] || []}
                  currentTime={localClipTime}
                  clipId={selectedClip.id}
                  onAddKeyframe={handleAddKeyframe('color.blur')}
                  onRemoveKeyframe={handleRemoveKeyframe('color.blur')}
                  onUpdateEasing={handleUpdateEasing('color.blur')}
                  onJumpToNext={handleJumpToNext('color.blur')}
                  onJumpToPrev={handleJumpToPrev('color.blur')}
                />
              </span>
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
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['color.blur'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
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
              <span className="flex items-center gap-1">
                Faded Film
                <KeyframeControl
                  propertyKey="color.fadedFilm"
                  value={clipFilters.fadedFilm ?? 0}
                  keyframes={selectedClip.animations?.['color.fadedFilm'] || []}
                  currentTime={localClipTime}
                  clipId={selectedClip.id}
                  onAddKeyframe={handleAddKeyframe('color.fadedFilm')}
                  onRemoveKeyframe={handleRemoveKeyframe('color.fadedFilm')}
                  onUpdateEasing={handleUpdateEasing('color.fadedFilm')}
                  onJumpToNext={handleJumpToNext('color.fadedFilm')}
                  onJumpToPrev={handleJumpToPrev('color.fadedFilm')}
                />
              </span>
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
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['color.fadedFilm'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span className="flex items-center gap-1">
                Vignette
                <KeyframeControl
                  propertyKey="color.vignette"
                  value={clipFilters.vignette ?? 0}
                  keyframes={selectedClip.animations?.['color.vignette'] || []}
                  currentTime={localClipTime}
                  clipId={selectedClip.id}
                  onAddKeyframe={handleAddKeyframe('color.vignette')}
                  onRemoveKeyframe={handleRemoveKeyframe('color.vignette')}
                  onUpdateEasing={handleUpdateEasing('color.vignette')}
                  onJumpToNext={handleJumpToNext('color.vignette')}
                  onJumpToPrev={handleJumpToPrev('color.vignette')}
                />
              </span>
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
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['color.vignette'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
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

      {/* Luma Key */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Luma Key (Light/Dark)</span>
          <button
            onClick={() => {
              const existing = selectedClip.lumaKey ?? { enabled: false, type: 'dark', threshold: 50, softness: 10 };
              updateClip(selectedClip.id, {
                lumaKey: { ...existing, enabled: !existing.enabled }
              });
              useEditorStore.getState().saveSnapshot();
            }}
            className={`w-8 h-4 rounded-full transition-colors relative ${selectedClip.lumaKey?.enabled ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedClip.lumaKey?.enabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>

        {selectedClip.lumaKey?.enabled && (
          <div className="space-y-3 pt-2 border-t border-[#3e3e3e]">
            {/* Type Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const existing = selectedClip.lumaKey ?? { enabled: true, type: 'dark', threshold: 50, softness: 10 };
                  updateClip(selectedClip.id, { lumaKey: { ...existing, type: 'dark' } });
                  useEditorStore.getState().saveSnapshot();
                }}
                className={`flex-1 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                  selectedClip.lumaKey?.type === 'dark'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-[#1e1e1e] text-[#a0a0a0] border-[#3e3e3e] hover:text-white'
                }`}
              >
                Key Out Darks
              </button>
              <button
                onClick={() => {
                  const existing = selectedClip.lumaKey ?? { enabled: true, type: 'dark', threshold: 50, softness: 10 };
                  updateClip(selectedClip.id, { lumaKey: { ...existing, type: 'light' } });
                  useEditorStore.getState().saveSnapshot();
                }}
                className={`flex-1 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                  selectedClip.lumaKey?.type === 'light'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-[#1e1e1e] text-[#a0a0a0] border-[#3e3e3e] hover:text-white'
                }`}
              >
                Key Out Lights
              </button>
            </div>

            {/* Threshold & Softness */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                  <span>Threshold</span>
                  <span className="font-mono">{selectedClip.lumaKey?.threshold ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedClip.lumaKey?.threshold ?? 50}
                  onChange={(e) => {
                    const existing = selectedClip.lumaKey ?? { enabled: true, type: 'dark', threshold: 50, softness: 10 };
                    updateClip(selectedClip.id, { lumaKey: { ...existing, threshold: Number(e.target.value) } });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                  <span>Softness</span>
                  <span className="font-mono">{selectedClip.lumaKey?.softness ?? 10}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedClip.lumaKey?.softness ?? 10}
                  onChange={(e) => {
                    const existing = selectedClip.lumaKey ?? { enabled: true, type: 'dark', threshold: 50, softness: 10 };
                    updateClip(selectedClip.id, { lumaKey: { ...existing, softness: Number(e.target.value) } });
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
