import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { TimelineClip } from '@/types';
import { KeyframeIcon } from '../KeyframeIcon';

export const SmartAudioEnhanceFeature = ({ clip }: { clip: TimelineClip }) => {
  const updateClip = useEditorStore((state) => state.updateClip);
  const clipAudio = clip.audioSettings || ({} as any);

  const handleAudioChange = (key: string, value: any) => {
    updateClip(clip.id, {
      audioSettings: { ...clipAudio, [key]: value }
    });
  };

  const handleAudioReset = (key: string) => {
    handleAudioChange(key, 0); 
  };

  const handleToggle = (key: string) => {
    handleAudioChange(key, !(clipAudio as any)[key]);
  };

  return (
    <div className="bg-[#1e1e1e] border border-[#3e3e3e]/50 rounded p-2.5 space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white uppercase tracking-wider text-green-400">Smart Enhancements</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">Peak Normalization</span>
          <button
            onClick={() => handleToggle('normalize')}
            className={`w-8 h-4 rounded-full transition-colors relative ${clipAudio.normalize ? 'bg-green-500' : 'bg-[#404040]'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${clipAudio.normalize ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Compression Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">Compression</span>
          <span className="font-mono text-[#a0a0a0]">
            {(clipAudio.compression ?? 0) === 0 ? 'Off' : `${clipAudio.compression}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={100}
            value={clipAudio.compression ?? 0}
            onChange={(e) => handleAudioChange('compression', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('compression')}
            title="Double-click to turn off. Evens out loud and quiet parts."
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* De-Esser Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">De-Esser</span>
          <span className="font-mono text-[#a0a0a0]">
            {(clipAudio.deEsser ?? 0) === 0 ? 'Off' : `${clipAudio.deEsser}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={100}
            value={clipAudio.deEsser ?? 0}
            onChange={(e) => handleAudioChange('deEsser', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('deEsser')}
            title="Double-click to turn off. Reduces harsh 'S' sounds."
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Denoise Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">AI Noise Reduction</span>
          <span className="font-mono text-[#a0a0a0]">
            {(clipAudio.denoise ?? 0) === 0 ? 'Off' : `${clipAudio.denoise}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={100}
            value={clipAudio.denoise ?? 0}
            onChange={(e) => handleAudioChange('denoise', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('denoise')}
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    </div>
  );
};
