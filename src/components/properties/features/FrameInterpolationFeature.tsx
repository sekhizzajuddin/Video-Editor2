import React from 'react';
import { TrendingUp } from 'lucide-react';
import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface FrameInterpolationFeatureProps {
  clip: TimelineClip;
}

export function FrameInterpolationFeature({ clip }: FrameInterpolationFeatureProps) {
  const updateClip = useEditorStore((state) => state.updateClip);

  return (
    <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> Frame Interpolation
        </span>
        <button
          onClick={() => {
            const current = clip.interpolation ?? { mode: 'none', preset: 'off' };
            updateClip(clip.id, {
              interpolation: { ...current, mode: current.mode === 'none' ? 'opticalFlow' : 'none' }
            });
            useEditorStore.getState().saveSnapshot();
          }}
          className={`w-8 h-4 rounded-full transition-colors relative ${clip.interpolation?.mode && clip.interpolation.mode !== 'none' ? 'bg-sky-500' : 'bg-[#3e3e3e]'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${clip.interpolation?.mode && clip.interpolation.mode !== 'none' ? 'left-4' : 'left-0.5'}`} />
        </button>
      </div>
      
      {clip.interpolation?.mode && clip.interpolation.mode !== 'none' && (
        <div className="space-y-3 pt-2 border-t border-[#3e3e3e]">
          <div className="flex gap-2">
            <button
              onClick={() => {
                updateClip(clip.id, { interpolation: { ...clip.interpolation!, mode: 'morph' } });
                useEditorStore.getState().saveSnapshot();
              }}
              className={`flex-1 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                clip.interpolation?.mode === 'morph' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'bg-[#1e1e1e] text-[#a0a0a0] border-[#3e3e3e] hover:text-white'
              }`}
            >
              Frame Blend (Morph)
            </button>
            <button
              onClick={() => {
                updateClip(clip.id, { interpolation: { ...clip.interpolation!, mode: 'opticalFlow' } });
                useEditorStore.getState().saveSnapshot();
              }}
              className={`flex-1 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                clip.interpolation?.mode === 'opticalFlow' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'bg-[#1e1e1e] text-[#a0a0a0] border-[#3e3e3e] hover:text-white'
              }`}
            >
              Optical Flow
            </button>
          </div>
          
          <p className="text-[9px] text-[#6a6a6a]">
            {clip.interpolation.mode === 'morph' 
              ? 'Blends adjacent frames for smoother slow motion. Low performance cost.' 
              : 'Synthesizes new frames using AI (RIFE). High quality, heavy performance cost.'}
          </p>
        </div>
      )}
    </div>
  );
}
