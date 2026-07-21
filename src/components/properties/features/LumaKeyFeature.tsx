import React, { useState } from 'react';
import { Sun, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';

export const LumaKeyFeature = ({ clip }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const luma = clip.lumaKey;
  const isEnabled = luma?.enabled ?? false;

  const updateLuma = (patch: any) => {
    const existing = luma ?? { enabled: true, type: 'light', threshold: 100, softness: 10 };
    updateClip(clip.id, { lumaKey: { ...existing, ...patch } });
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <div className="flex items-center gap-2">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-medium">Luma Key (Luminance)</span>
          {isEnabled && <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-semibold">ON</span>}
        </div>
        <div className="flex items-center gap-2">
          <div
            onClick={e => { e.stopPropagation(); updateLuma({ enabled: !isEnabled }); useEditorStore.getState().saveSnapshot(); }}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] transition-colors"
          >
            <span className={isEnabled ? 'text-amber-500' : 'text-[#a0a0a0]'}>{isEnabled ? 'Enabled' : 'Enable'}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
          {/* Type Selection */}
          <div className="space-y-1">
            <span className="text-[11px] text-[#a0a0a0]">Key Type</span>
            <div className="flex gap-2">
              {(['light', 'dark'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    updateLuma({ type });
                    useEditorStore.getState().saveSnapshot();
                  }}
                  className={`flex-1 py-1 text-[11px] rounded border ${
                    (luma?.type || 'light') === type
                      ? 'bg-[#3e3e3e] border-amber-500/50 text-white'
                      : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:bg-[#252525]'
                  }`}
                >
                  Key out {type === 'light' ? 'Brights' : 'Darks'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Threshold</span>
                <span className="font-mono text-[#a0a0a0]">{luma?.threshold ?? 100}</span>
              </div>
              <input
                type="range" min={0} max={255} value={luma?.threshold ?? 100}
                onChange={(e) => updateLuma({ threshold: Number(e.target.value) })}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Softness</span>
                <span className="font-mono text-[#a0a0a0]">{luma?.softness ?? 10}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={luma?.softness ?? 10}
                onChange={(e) => updateLuma({ softness: Number(e.target.value) })}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
