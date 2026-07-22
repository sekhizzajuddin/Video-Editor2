import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Clip } from '@/types';

interface MaskTabProps {
  selectedClip: Clip;
  updateClip: (clipId: string, updates: any) => void;
}

export function MaskTab({ selectedClip, updateClip }: MaskTabProps) {
  const mask = selectedClip.mask || { enabled: false, type: 'rectangle', x: 50, y: 50, width: 50, height: 50, points: [], feather: 0, invert: false, rotation: 0, roundness: 0, matteSourceClipId: '' };
  
  const updateMask = (updates: any) => {
    updateClip(selectedClip.id, { mask: { ...mask, ...updates } });
  };

  const handleMouseUp = () => {
    // Save snapshot logic would be called from parent
  };

  const Slider = ({ label, value, min, max, unit, prop }: { label: string, value: number, min: number, max: number, unit: string, prop: string }) => (
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
    <div className="space-y-4">
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
                  onClick={() => updateMask({ type: t })}
                  className={`p-2 rounded text-[9px] font-medium uppercase transition-colors border ${
                    mask.type === t
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                      : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Mask Parameters */}
          <div className="space-y-3">
            <Slider label="X Position" value={mask.x} min={0} max={100} unit="%" prop="x" />
            <Slider label="Y Position" value={mask.y} min={0} max={100} unit="%" prop="y" />
            <Slider label="Width" value={mask.width} min={0} max={100} unit="%" prop="width" />
            <Slider label="Height" value={mask.height} min={0} max={100} unit="%" prop="height" />
            <Slider label="Feather" value={mask.feather} min={0} max={100} unit="%" prop="feather" />
            <Slider label="Rotation" value={mask.rotation} min={0} max={360} unit="°" prop="rotation" />
            <Slider label="Roundness" value={mask.roundness} min={0} max={100} unit="%" prop="roundness" />
          </div>

          {/* Invert */}
          <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-md border border-[#3e3e3e]">
            <span className="text-xs text-[#a0a0a0]">Invert Mask</span>
            <button
              onClick={() => { updateMask({ invert: !mask.invert }); handleMouseUp(); }}
              className={`w-10 h-5 rounded-full transition-colors relative ${mask.invert ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${mask.invert ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}