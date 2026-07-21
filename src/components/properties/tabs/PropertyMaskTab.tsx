/**
 * PropertyMaskTab.tsx
 * 
 * Mask inspector tab for Properties Panel.
 * Handles Rectangle, Circle, Split, Filmstrip, Heart, Star, and Matte masking.
 * Includes Position, Dimensions, Rotation, Roundness, Feather, and Invert controls.
 */

import React from 'react';
import { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface PropertyMaskTabProps {
  selectedClip: TimelineClip;
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
}

export function PropertyMaskTab({
  selectedClip,
  tracks,
  mediaLibrary,
  updateClip,
}: PropertyMaskTabProps) {
  const mask = selectedClip.mask || {
    enabled: false,
    type: 'rectangle',
    x: 50,
    y: 50,
    width: 50,
    height: 50,
    points: [],
    feather: 0,
    invert: false,
    rotation: 0,
    roundness: 0,
    matteSourceClipId: ''
  };

  const updateMask = (updates: any) => {
    updateClip(selectedClip.id, { mask: { ...mask, ...updates } });
  };

  const handleMouseUp = () => useEditorStore.getState().saveSnapshot();

  const Slider = ({ label, value, min, max, unit, prop }: { label: string; value: number; min: number; max: number; unit: string; prop: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-[#d0d0d0]">{label}</span>
        <span className="font-mono text-[#a0a0a0]">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => updateMask({ [prop]: Number(e.target.value) })}
        onMouseUp={handleMouseUp}
        className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
      />
    </div>
  );

  return (
    <div className="space-y-4 p-4 text-xs select-none">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-md border border-[#3e3e3e]">
        <span className="text-xs text-[#a0a0a0]">Enable Masking</span>
        <button
          onClick={() => { updateMask({ enabled: !mask.enabled }); handleMouseUp(); }}
          className={`w-10 h-5 rounded-full transition-colors relative ${mask.enabled ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${mask.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {mask.enabled && (
        <>
          {/* Mask Type */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-[#a0a0a0]">Mask Shape</label>
            <div className="grid grid-cols-4 gap-1.5">
              {['rectangle', 'circle', 'split', 'filmstrip', 'heart', 'star', 'matte'].map(t => (
                <button
                  key={t}
                  onClick={() => { updateMask({ type: t }); handleMouseUp(); }}
                  className={`py-1 text-[10px] rounded border transition-colors ${mask.type === t ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-[#3e3e3e] bg-[#2d2d2d] text-[#a0a0a0] hover:border-[#4e4e4e]'}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Properties depending on type */}
          <div className="space-y-3 p-3 bg-[#2d2d2d] rounded-md border border-[#3e3e3e]">
            <Slider label="Position X" value={mask.x} min={0} max={100} unit="%" prop="x" />
            <Slider label="Position Y" value={mask.y} min={0} max={100} unit="%" prop="y" />
            
            {(mask.type === 'rectangle' || mask.type === 'circle' || mask.type === 'heart' || mask.type === 'star') && (
              <Slider label={mask.type === 'circle' ? 'Radius' : 'Width'} value={mask.width} min={0} max={100} unit="%" prop="width" />
            )}
            
            {(mask.type === 'rectangle' || mask.type === 'filmstrip') && (
              <Slider label="Height" value={mask.height ?? 50} min={0} max={100} unit="%" prop="height" />
            )}
            
            <Slider label="Rotation" value={mask.rotation ?? 0} min={0} max={360} unit="°" prop="rotation" />
            
            {mask.type === 'rectangle' && (
              <Slider label="Roundness" value={mask.roundness ?? 0} min={0} max={100} unit="%" prop="roundness" />
            )}
            
            {mask.type === 'matte' && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#a0a0a0]">Matte Source Clip</label>
                <select
                  value={mask.matteSourceClipId || ''}
                  onChange={(e) => { updateMask({ matteSourceClipId: e.target.value }); handleMouseUp(); }}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-white rounded p-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select visual clip...</option>
                  {tracks.flatMap(t => t.clips)
                    .filter(c => c.id !== selectedClip.id && (c.mediaId?.startsWith('clip_') || c.textSettings || c.mediaId?.includes('text')))
                    .map(c => {
                      const mediaName = mediaLibrary.find(m => m.id === c.mediaId)?.name;
                      return (
                        <option key={c.id} value={c.id}>
                          {mediaName || c.id}
                        </option>
                      );
                    })
                  }
                </select>
              </div>
            )}
            
            <div className="h-px bg-[#3e3e3e] my-2" />
            
            <Slider label="Feather" value={mask.feather} min={0} max={100} unit="px" prop="feather" />
            
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#a0a0a0]">Invert Mask</span>
              <button
                onClick={() => { updateMask({ invert: !mask.invert }); handleMouseUp(); }}
                className={`w-8 h-4 rounded-full transition-colors relative ${mask.invert ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${mask.invert ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
