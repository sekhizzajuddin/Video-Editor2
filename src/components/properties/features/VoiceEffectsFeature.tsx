import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { TimelineClip } from '@/types';
import { KeyframeIcon } from '../KeyframeIcon';

export const VoiceEffectsFeature = ({ clip }: { clip: TimelineClip }) => {
  const updateClip = useEditorStore((state) => state.updateClip);
  const clipAudio = clip.audioSettings || ({} as any);

  const handleAudioChange = (key: string, value: any) => {
    updateClip(clip.id, {
      audioSettings: { ...clipAudio, [key]: value }
    });
  };

  const handleAudioReset = (key: string) => {
    handleAudioChange(key, 0); // Assuming 0 is default for most
  };

  const handleToggle = (key: string) => {
    handleAudioChange(key, !(clipAudio as any)[key]);
  };

  return (
    <div className="bg-[#1e1e1e] border border-[#3e3e3e]/50 rounded p-2.5 space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white uppercase tracking-wider text-cyan-400">Vocal Tune & Character</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* AI Auto Voice Tune */}
        <div className="flex items-center justify-between bg-[#2d2d2d] p-2 rounded">
          <div>
            <span className="text-[10px] text-white block">AI Auto Voice Tune</span>
            <span className="text-[9px] text-[#6a6a6a] block">Reduces synthetic metallic ring</span>
          </div>
          <button
            onClick={() => handleToggle('autoTune')}
            className={`w-8 h-4 rounded-full transition-colors relative ${clipAudio.autoTune ? 'bg-cyan-500' : 'bg-[#404040]'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${clipAudio.autoTune ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Humanize AI Voice */}
        <div className="flex items-center justify-between bg-[#2d2d2d] p-2 rounded">
          <div>
            <span className="text-[10px] text-white block">Humanize AI Voice</span>
            <span className="text-[9px] text-[#6a6a6a] block">Adds breath and subtle imperfections</span>
          </div>
          <button
            onClick={() => handleToggle('humanize')}
            className={`text-[9px] px-2 py-0.5 rounded transition-colors ${clipAudio.humanize ? 'bg-amber-500 text-white font-semibold' : 'bg-[#404040] text-[#a0a0a0] hover:text-white'}`}
          >
            {clipAudio.humanize ? 'Active' : 'Off'}
          </button>
        </div>
      </div>

      {/* Pitch Shift Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">Pitch Shift</span>
          <span className="font-mono text-[#a0a0a0]">
            {clipAudio.pitch === 0 ? 'Original Pitch' : clipAudio.pitch > 0 ? `+${clipAudio.pitch} Semitones` : `${clipAudio.pitch} Semitones`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={clipAudio.pitch ?? 0}
            onChange={(e) => handleAudioChange('pitch', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('pitch')}
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Formant Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">Voice Formant / Tone</span>
          <span className="font-mono text-[#a0a0a0]">
            {clipAudio.voiceFormant === 0 ? 'Default' : clipAudio.voiceFormant > 0 ? `+${clipAudio.voiceFormant}` : clipAudio.voiceFormant}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-100}
            max={100}
            value={clipAudio.voiceFormant ?? 0}
            onChange={(e) => handleAudioChange('voiceFormant', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('voiceFormant')}
            title="Double-click to reset to Default"
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Warmth Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">Warmth</span>
          <span className="font-mono text-[#a0a0a0]">
            {(clipAudio.warmth ?? 0) === 0 ? 'Neutral' : (clipAudio.warmth ?? 0) > 0 ? `+${clipAudio.warmth} Warm` : `${clipAudio.warmth} Thin`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={-100} max={100}
            value={clipAudio.warmth ?? 0}
            onChange={(e) => handleAudioChange('warmth', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('warmth')}
            title="Double-click to reset. Adds low-mid body to thin AI voices."
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

    </div>
  );
};
