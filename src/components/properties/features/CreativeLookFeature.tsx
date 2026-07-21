import React, { useState } from 'react';
import { Palette, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';
import { KeyframeIcon } from '../KeyframeIcon';

export const CreativeLookFeature = ({ clip, isKfActive, addKf, remKf, getPropVal }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const clipFilters = clip.colorFilters || ({} as any);

  const handleFilterChange = (key: string, value: any) => {
    updateClip(clip.id, {
      colorFilters: { ...clipFilters, [key]: value }
    });
  };

  const handleFilterReset = (key: string) => {
    handleFilterChange(key, 0); 
  };

  // Safe getter in case getPropVal isn't provided
  const val = (propVal: any, key: string) => getPropVal ? getPropVal(propVal, key) : propVal;

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] mt-3 group">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white"
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Palette className="w-3.5 h-3.5 text-purple-400" />
          <span>Creative Look</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
        )}
      </button>
      {isExpanded && (
        <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
          {/* Faded Film */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1 text-[#d0d0d0]">
                Faded Film
                {isKfActive && addKf && remKf && (
                  <KeyframeIcon
                    active={isKfActive('color.fadedFilm')}
                    onClick={() => isKfActive('color.fadedFilm') ? remKf('color.fadedFilm') : addKf('color.fadedFilm', clipFilters.fadedFilm ?? 0)}
                  />
                )}
              </span>
              <span className="font-mono text-[#a0a0a0]">{val(clipFilters.fadedFilm ?? 0, 'color.fadedFilm')}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={100}
                value={val(clipFilters.fadedFilm ?? 0, 'color.fadedFilm')}
                onChange={(e) => handleFilterChange('fadedFilm', Number(e.target.value))}
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                onDoubleClick={() => handleFilterReset('fadedFilm')}
                className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>

          {/* Vignette */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1 text-[#d0d0d0]">
                Vignette
                {isKfActive && addKf && remKf && (
                  <KeyframeIcon
                    active={isKfActive('color.vignette')}
                    onClick={() => isKfActive('color.vignette') ? remKf('color.vignette') : addKf('color.vignette', clipFilters.vignette ?? 0)}
                  />
                )}
              </span>
              <span className="font-mono text-[#a0a0a0]">
                {val(clipFilters.vignette ?? 0, 'color.vignette') > 0 ? `+${val(clipFilters.vignette ?? 0, 'color.vignette')}` : val(clipFilters.vignette ?? 0, 'color.vignette')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-100} max={100}
                value={val(clipFilters.vignette ?? 0, 'color.vignette')}
                onChange={(e) => handleFilterChange('vignette', Number(e.target.value))}
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                onDoubleClick={() => handleFilterReset('vignette')}
                title="Double-click to reset to 0"
                className="flex-1 h-1 bg-gradient-to-r from-white via-[#3e3e3e] to-black rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
