/**
 * PropertyEffectsTab.tsx
 * 
 * Effects inspector tab for Properties Panel.
 * Handles Timeline FX parameters (Glitch, VHS, RGB Split, Blurs, etc.),
 * Particle Emitter controls (Type, Emitter X/Y, Amount, Speed, Size, Gravity, Wind, Glow),
 * and AI Motion Graphics generator buttons.
 */

import React from 'react';
import {
  Wand2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { TimelineClip, TimelineTrack } from '@/types';
import { TimelineFxFeature } from '../features/TimelineFxFeature';
import { ParticleEffectFeature } from '../features/ParticleEffectFeature';

interface PropertyEffectsTabProps {
  selectedClip: TimelineClip;
  selectedTrack?: TimelineTrack;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (provider: 'gemini' | 'groq') => void;
  isAnalyzingMotionGraphics: boolean;
  motionGraphicsAnalyzeProgress: string;
  handleAiMotionGraphicsDesign: () => void;
}

export function PropertyEffectsTab({
  selectedClip,
  selectedTrack,
  updateClip,
  aiProvider,
  setAiProvider,
  isAnalyzingMotionGraphics,
  motionGraphicsAnalyzeProgress,
  handleAiMotionGraphicsDesign,
}: PropertyEffectsTabProps) {
  return (
    <div className="space-y-4 p-4 text-xs select-none">
      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Effect Settings</h3>

      {/* AI Text & Motion Graphics */}
      {selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && selectedTrack?.type === 'video' && (
        <div className="bg-[#142323] border border-teal-500/30 rounded p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span className="text-xs text-white font-semibold">AI Motion & Text Gen</span>
          </div>
          <p className="text-[11px] text-[#90b8b8]">
            Automatically generate subtitles, kinetic typography, or motion graphics for this clip.
          </p>

          {/* AI Provider Configuration */}
          <div className="pt-2 border-t border-[#3e3e3e]/40">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white">AI Provider:</label>
              <select 
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
                className="bg-[#1e1e1e] text-white text-[10px] border border-[#3e3e3e] rounded px-2 py-1 focus:outline-none focus:border-teal-500"
              >
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isAnalyzingMotionGraphics ? (
              <div className="flex flex-col items-center justify-center gap-2 py-1.5 bg-[#1e2828] rounded border border-teal-500/20">
                <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
                <span className="text-[10px] text-teal-400 font-medium">
                  {motionGraphicsAnalyzeProgress}...
                </span>
              </div>
            ) : (
              <button
                onClick={handleAiMotionGraphicsDesign}
                className="w-full py-1.5 bg-[#2a2a2a] hover:bg-[#3e3e3e] text-white rounded text-[11px] font-medium transition-colors border border-[#3e3e3e]"
              >
                Generate Motion Graphics
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Timeline FX Settings ── */}
      <TimelineFxFeature clip={selectedClip} />

      {/* ── Particle Settings ── */}
      <ParticleEffectFeature clip={selectedClip} />

      {/* Empty state */}
      {!selectedClip.fxSettings && !selectedClip.particleSettings && (
        <div className="text-xs text-[#a0a0a0] flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#3e3e3e] rounded">
          <Wand2 className="w-8 h-8 mb-2 opacity-50" />
          <p className="mb-1">No effects on this clip</p>
          <p className="text-[10px] text-[#5a5a5a]">Drag a Timeline FX or Particle Effect from the Effects panel onto this clip</p>
        </div>
      )}
    </div>
  );
}
