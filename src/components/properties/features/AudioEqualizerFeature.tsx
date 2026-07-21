import React, { useState } from 'react';
import { Sliders, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';
import { KeyframeIcon } from '../KeyframeIcon';

export const AudioEqualizerFeature = ({ clip, localTime, isKfActive, addKf, remKf, getPropVal }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Safe getter in case getPropVal isn't provided
  const val = (propVal: any, key: string) => getPropVal ? getPropVal(propVal, key) : propVal;

  return (
    <div className="space-y-3 mt-3">
      {/* Pan Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="flex items-center gap-1 text-[#d0d0d0]">
            Pan / Balance
            {isKfActive && addKf && remKf && (
              <KeyframeIcon
                active={isKfActive('audio.pan')}
                onClick={() => isKfActive('audio.pan') ? remKf('audio.pan') : addKf('audio.pan', clipAudio.pan ?? 0)}
              />
            )}
          </span>
          <span className="font-mono text-[#a0a0a0]">
            {val(clipAudio.pan ?? 0, 'audio.pan') === 0 ? 'Center' : val(clipAudio.pan ?? 0, 'audio.pan') > 0 ? `R${val(clipAudio.pan ?? 0, 'audio.pan')}` : `L${Math.abs(val(clipAudio.pan ?? 0, 'audio.pan'))}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-100}
            max={100}
            value={val(clipAudio.pan ?? 0, 'audio.pan')}
            onChange={(e) => handleAudioChange('pan', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioReset('pan')}
            className="flex-1 h-1 bg-gradient-to-r from-blue-500 via-gray-600 to-amber-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-2.5 text-xs text-white"
        >
          <div className="flex items-center gap-1.5 font-medium">
            <Sliders className="w-3.5 h-3.5" />
            <span>Equalizer (EQ)</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </button>
        {isExpanded && (
          <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
            {/* Bass */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Bass (Low-shelf)</span>
                <span className="font-mono text-[#a0a0a0]">
                  {(clipAudio.bass ?? 0) > 0 ? `+${clipAudio.bass ?? 0}` : clipAudio.bass ?? 0} dB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={-24} max={24} step={1}
                  value={clipAudio.bass ?? 0}
                  onChange={(e) => handleAudioChange('bass', Number(e.target.value))}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  onDoubleClick={() => handleAudioReset('bass')}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>

            {/* Mid */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Mid (1kHz Presence)</span>
                <span className="font-mono text-[#a0a0a0]">
                  {(clipAudio.mid ?? 0) > 0 ? `+${clipAudio.mid ?? 0}` : clipAudio.mid ?? 0} dB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={-24} max={24} step={1}
                  value={clipAudio.mid ?? 0}
                  onChange={(e) => handleAudioChange('mid', Number(e.target.value))}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  onDoubleClick={() => handleAudioReset('mid')}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>

            {/* Treble */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Treble (High-shelf)</span>
                <span className="font-mono text-[#a0a0a0]">
                  {(clipAudio.treble ?? 0) > 0 ? `+${clipAudio.treble ?? 0}` : clipAudio.treble ?? 0} dB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={-24} max={24} step={1}
                  value={clipAudio.treble ?? 0}
                  onChange={(e) => handleAudioChange('treble', Number(e.target.value))}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  onDoubleClick={() => handleAudioReset('treble')}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
