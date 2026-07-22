import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Clip, VoiceTuneResult } from '@/types';

interface AudioTabProps {
  selectedClip: Clip;
  clipAudio: any;
  selectedClipIds: string[];
  tracks: any[];
  mediaLibrary: any[];
  handleAudioChange: (key: string, val: any) => void;
  handleAudioReset: (key: string) => void;
  isAnalyzingVoice: boolean;
  handleAutoVoiceTune: () => void;
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (v: 'gemini' | 'groq') => void;
  soundDesignFps: number;
  setSoundDesignFps: (v: number) => void;
  freesoundApiKey: string;
  setFreesoundApiKey: (v: string) => void;
  isAnalyzingAudio: boolean;
  audioAnalyzeProgress: string;
  handleAiSoundDesign: () => void;
}

export function AudioTab({
  selectedClip,
  clipAudio,
  selectedClipIds,
  tracks,
  mediaLibrary,
  handleAudioChange,
  handleAudioReset,
  isAnalyzingVoice,
  handleAutoVoiceTune,
  aiProvider,
  setAiProvider,
  soundDesignFps,
  setSoundDesignFps,
  freesoundApiKey,
  setFreesoundApiKey,
  isAnalyzingAudio,
  audioAnalyzeProgress,
  handleAiSoundDesign,
}: AudioTabProps) {
  return (
    <div className="space-y-3">
      {/* AI Sound Designer */}
      {selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-white font-semibold">AI Sound Designer</span>
          </div>
          <p className="text-[11px] text-[#e0c090]">
            Analyze scene storyboard using Gemini 2.0 Vision and suggest optimized SFX options using Groq.
          </p>

          <div className="space-y-2 pt-1 border-t border-[#3e3e3e]/40">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white">AI Provider:</label>
              <select 
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
                className="bg-[#1e1e1e] text-white text-[10px] border border-[#3e3e3e] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
              >
                <option value="gemini">Gemini (Default)</option>
                <option value="groq">Groq (Llama 3 Vision)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white">Precision:</label>
              <select 
                value={soundDesignFps}
                onChange={(e) => setSoundDesignFps(Number(e.target.value))}
                className="bg-[#1e1e1e] text-white text-[10px] border border-[#3e3e3e] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
              >
                <option value={1}>1 FPS (Standard)</option>
                <option value={5}>5 FPS (High)</option>
                <option value={10}>10 FPS (Ultra, Millisecond precise)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-[#a0a0a0]">Freesound Key (Optional)</label>
              <input
                type="password"
                placeholder="Leave blank for public key"
                value={freesoundApiKey}
                onChange={(e) => {
                  setFreesoundApiKey(e.target.value);
                  sessionStorage.setItem('procut_freesound_key', e.target.value);
                }}
                className="bg-[#1e1e1e] text-white text-[10px] border border-[#3e3e3e] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {isAnalyzingAudio ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
              <span className="text-[10px] text-amber-400">{audioAnalyzeProgress}</span>
            </div>
          ) : (
            <button
              onClick={handleAiSoundDesign}
              className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-medium transition-colors"
            >
              Analyze Scene & Generate Sound Design
            </button>
          )}
        </div>
      )}

      {/* Volume */}
      <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] text-[#a0a0a0]">Volume</label>
          <span className="text-[10px] font-mono text-white">
            {clipAudio.volume > 0 ? `+${clipAudio.volume.toFixed(1)}` : clipAudio.volume.toFixed(1)} dB
          </span>
        </div>
        <input
          type="range"
          min={-40}
          max={12}
          step={0.5}
          value={clipAudio.volume}
          onChange={(e) => handleAudioChange('volume', Number(e.target.value))}
          onDoubleClick={() => handleAudioReset('volume')}
          className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
        />
      </div>

      {/* Pan */}
      <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] text-[#a0a0a0]">Pan</label>
          <span className="text-[10px] font-mono text-white">
            {clipAudio.pan === 0 ? 'Center' : clipAudio.pan > 0 ? `R ${Math.round(clipAudio.pan * 100)}%` : `L ${Math.round(Math.abs(clipAudio.pan) * 100)}%`}
          </span>
        </div>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={clipAudio.pan}
          onChange={(e) => handleAudioChange('pan', Number(e.target.value))}
          onDoubleClick={() => handleAudioReset('pan')}
          className="w-full h-1 bg-gradient-to-r from-cyan-500 via-[#3e3e3e] to-amber-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
        />
      </div>

      {/* EQ Section */}
      <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 space-y-3">
        <span className="text-[10px] font-medium text-white uppercase tracking-wider">EQ</span>
        
        {/* Bass */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-[#a0a0a0]">Bass</label>
            <span className="text-[10px] font-mono text-white">
              {clipAudio.bass > 0 ? `+${clipAudio.bass}` : clipAudio.bass}
            </span>
          </div>
          <input
            type="range"
            min={-15}
            max={15}
            step={1}
            value={clipAudio.bass || 0}
            onChange={(e) => handleAudioChange('bass', Number(e.target.value))}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        {/* Mid */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-[#a0a0a0]">Mid</label>
            <span className="text-[10px] font-mono text-white">
              {clipAudio.mid > 0 ? `+${clipAudio.mid}` : clipAudio.mid}
            </span>
          </div>
          <input
            type="range"
            min={-15}
            max={15}
            step={1}
            value={clipAudio.mid || 0}
            onChange={(e) => handleAudioChange('mid', Number(e.target.value))}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        {/* Treble */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-[#a0a0a0]">Treble</label>
            <span className="text-[10px] font-mono text-white">
              {clipAudio.treble > 0 ? `+${clipAudio.treble}` : clipAudio.treble}
            </span>
          </div>
          <input
            type="range"
            min={-15}
            max={15}
            step={1}
            value={clipAudio.treble || 0}
            onChange={(e) => handleAudioChange('treble', Number(e.target.value))}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Auto Voice Tune Button */}
      {selectedClipIds.length >= 2 && (
        <button
          onClick={handleAutoVoiceTune}
          disabled={isAnalyzingVoice}
          className="w-full py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 text-teal-400 rounded text-[11px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isAnalyzingVoice ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing voices...
            </>
          ) : (
            'Auto Voice Tune (Multi-Select)'
          )}
        </button>
      )}
    </div>
  );
}