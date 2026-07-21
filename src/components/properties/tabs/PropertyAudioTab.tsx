/**
 * PropertyAudioTab.tsx
 * 
 * Audio inspector tab for Properties Panel.
 * Manages Volume, Pan, Vocal Tune (Pitch, Formant, Warmth, Compression, De-Esser),
 * Peak Normalization, Audio Fades (In/Out), Equalizer / EQ (Bass, Mid, Treble),
 * AI Vocal / BGM Separation.
 */

import React from 'react';
import {
  Volume2,
  VolumeX,
  Scissors,
  Sparkles,
  Activity,
} from 'lucide-react';
import { TimelineClip, TimelineTrack, MediaItem, ClipAudioSettings } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface PropertyAudioTabProps {
  selectedClip: TimelineClip;
  selectedTrack?: TimelineTrack;
  currentTime: number;
  mediaLibrary: MediaItem[];
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  getPropVal: (clipPropVal: any, propKey: string) => any;
  upd: (propKey: string, val: any) => void;
  addKf: (propKey: string, val: any) => void;
  remKf: (propKey: string) => void;
  isKfActive: (propKey: string) => boolean;
}

const KeyframeIcon = ({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button
    onClick={onClick}
    title={active ? 'Remove keyframe at current playhead' : 'Add keyframe at current playhead'}
    className={`p-1 rounded transition-colors ${
      active
        ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40'
        : 'text-[#888] hover:text-white hover:bg-[#3e3e3e]'
    }`}
  >
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 22 12 12 22 2 12 12 2" />
    </svg>
  </button>
);

export function PropertyAudioTab({
  selectedClip,
  selectedTrack,
  currentTime,
  mediaLibrary,
  updateClip,
  getPropVal,
  upd,
  addKf,
  remKf,
  isKfActive,
}: PropertyAudioTabProps) {

  const defaultAudioSettings: ClipAudioSettings = {
    volume: 0,
    pan: 0,
    muted: false,
    pitch: 0,
    voiceFormant: 0,
    warmth: 0,
    compression: 0,
    deEsser: 0,
    fadeIn: 0,
    fadeOut: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    humanize: false,
    preservePitch: true,
  };

  const clipAudio = selectedClip?.audioSettings || defaultAudioSettings;

  const handleAudioChange = (key: keyof ClipAudioSettings, val: any) => {
    const current = selectedClip.audioSettings || defaultAudioSettings;
    updateClip(selectedClip.id, {
      audioSettings: {
        ...current,
        [key]: val,
      },
    });
  };

  const handleNormalizeAudio = async () => {
    const media = mediaLibrary.find((m) => m.id === selectedClip.mediaId);
    if (!media || !media.url) return;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(media.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(selectedClip.trimStart * sampleRate);
      const endSample = Math.min(
        audioBuffer.length,
        Math.floor((selectedClip.trimStart + selectedClip.duration) * sampleRate)
      );

      let peakAmplitude = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        const rawData = audioBuffer.getChannelData(ch);
        const subData = rawData.slice(startSample, endSample);
        for (let i = 0; i < subData.length; i++) {
          const val = Math.abs(subData[i]);
          if (val > peakAmplitude) peakAmplitude = val;
        }
      }

      if (peakAmplitude > 0) {
        const targetDb = -3.0;
        const peakDb = 20 * Math.log10(peakAmplitude);
        const newVolumeDb = targetDb - peakDb;
        const clampedVolume = Math.max(-40, Math.min(12, Math.round(newVolumeDb * 10) / 10));

        handleAudioChange('volume', clampedVolume);
        useEditorStore.getState().saveSnapshot();
      }
    } catch (err) {
      console.error('Audio normalization error:', err);
    }
  };

  return (
    <div className="space-y-4 p-4 text-xs select-none">
      {/* Clip Volume & Pan */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Volume & Pan</span>
          <button
            onClick={() => handleAudioChange('muted', !clipAudio.muted)}
            className={`p-1 rounded transition-colors ${clipAudio.muted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-[#888] hover:text-white'}`}
            title={clipAudio.muted ? 'Unmute Clip' : 'Mute Clip'}
          >
            {clipAudio.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Volume Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span className="flex items-center gap-1">
              Volume (dB)
              <KeyframeIcon
                active={isKfActive('audio.volume')}
                onClick={() => isKfActive('audio.volume') ? remKf('audio.volume') : addKf('audio.volume', clipAudio.volume)}
              />
            </span>
            <span className="font-mono">{getPropVal(clipAudio.volume, 'audio.volume') > 0 ? `+${getPropVal(clipAudio.volume, 'audio.volume')}` : getPropVal(clipAudio.volume, 'audio.volume')} dB</span>
          </div>
          <input
            type="range"
            min={-40}
            max={12}
            step={0.5}
            value={getPropVal(clipAudio.volume, 'audio.volume')}
            onChange={(e) => handleAudioChange('volume', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioChange('volume', 0)}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        {/* Peak Normalization */}
        <button
          onClick={handleNormalizeAudio}
          className="w-full py-1.5 px-3 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] text-white text-xs rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" /> Peak Normalize (-3dB)
        </button>

        {/* Pan Slider */}
        <div className="space-y-1 pt-2 border-t border-[#3e3e3e]">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span>Pan (L/R)</span>
            <span className="font-mono">{clipAudio.pan === 0 ? 'Center' : clipAudio.pan > 0 ? `R${clipAudio.pan}` : `L${Math.abs(clipAudio.pan)}`}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={clipAudio.pan ?? 0}
            onChange={(e) => handleAudioChange('pan', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => handleAudioChange('pan', 0)}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Audio Fades */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Audio Fades</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Fade In</span>
              <span className="font-mono">{(clipAudio.fadeIn ?? 0).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(10, selectedClip.duration / 2)}
              step={0.1}
              value={clipAudio.fadeIn ?? 0}
              onChange={(e) => handleAudioChange('fadeIn', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Fade Out</span>
              <span className="font-mono">{(clipAudio.fadeOut ?? 0).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(10, selectedClip.duration / 2)}
              step={0.1}
              value={clipAudio.fadeOut ?? 0}
              onChange={(e) => handleAudioChange('fadeOut', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Equalizer (EQ) */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">3-Band Equalizer (EQ)</span>
          <button
            onClick={() => {
              handleAudioChange('bass', 0);
              handleAudioChange('mid', 0);
              handleAudioChange('treble', 0);
            }}
            className="text-[9px] text-[#a0a0a0] hover:text-amber-400 transition-colors"
          >
            Reset EQ
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Bass */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-[#a0a0a0]">
              <span>Bass</span>
              <span className="font-mono">{clipAudio.bass ?? 0}dB</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              value={clipAudio.bass ?? 0}
              onChange={(e) => handleAudioChange('bass', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          {/* Mid */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-[#a0a0a0]">
              <span>Mid</span>
              <span className="font-mono">{clipAudio.mid ?? 0}dB</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              value={clipAudio.mid ?? 0}
              onChange={(e) => handleAudioChange('mid', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          {/* Treble */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-[#a0a0a0]">
              <span>Treble</span>
              <span className="font-mono">{clipAudio.treble ?? 0}dB</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              value={clipAudio.treble ?? 0}
              onChange={(e) => handleAudioChange('treble', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      </div>

      {/* AI Vocal / BGM Separation */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-purple-400" /> Vocal & BGM Separation
          </span>
        </div>

        <button
          onClick={() => {
            const current = clipAudio.vocalSeparation || { enabled: false, mode: 'removeVocals', strength: 80 };
            handleAudioChange('vocalSeparation', { ...current, enabled: !current.enabled });
          }}
          className={`w-full py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-2 transition-all ${
            clipAudio.vocalSeparation?.enabled
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {clipAudio.vocalSeparation?.enabled ? 'Vocal Separation Active' : 'Enable Vocal Separation'}
        </button>
      </div>
    </div>
  );
}
