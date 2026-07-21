import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';

export const LutColorGradeFeature = ({ clip }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const mediaLibrary = useEditorStore((state) => state.mediaLibrary);
  const lutMedia = clip.lut ? mediaLibrary.find((m) => m.id === clip.lut!.mediaId) : null;
  const lutItems = mediaLibrary.filter((m) => m.type === 'lut');

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white"
      >
        <span className="font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          LUT Color Grade
          {clip.lut && (
            <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">ACTIVE</span>
          )}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
        )}
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
          {clip.lut && lutMedia ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 font-medium truncate flex-1 mr-2">
                  ✓ {lutMedia.name}
                </span>
                <button
                  onClick={() => {
                    updateClip(clip.id, { lut: undefined });
                    useEditorStore.getState().saveSnapshot();
                  }}
                  className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-400/10 hover:bg-red-400/20 transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#a0a0a0]">Intensity</span>
                  <span className="font-mono text-[#a0a0a0]">{clip.lut.intensity}%</span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={clip.lut.intensity}
                  onChange={(e) => {
                    updateClip(clip.id, {
                      lut: { ...clip.lut!, intensity: Number(e.target.value) }
                    });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-[#a0a0a0] italic text-center py-2">
              {lutItems.length === 0 ? "No LUTs in Media Library" : "Select a LUT below"}
            </div>
          )}

          {lutItems.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {lutItems.map((lut) => (
                <button
                  key={lut.id}
                  onClick={() => {
                    updateClip(clip.id, { lut: { mediaId: lut.id, intensity: 100 } });
                    useEditorStore.getState().saveSnapshot();
                  }}
                  className={`px-2 py-1.5 rounded text-[10px] text-left truncate transition-colors ${
                    clip.lut?.mediaId === lut.id
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                      : 'bg-[#1e1e1e] border border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:bg-[#252525]'
                  }`}
                  title={lut.name}
                >
                  {lut.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
