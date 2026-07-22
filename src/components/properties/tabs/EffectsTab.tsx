import { Sparkles, Loader2 } from 'lucide-react';
import type { Clip, AIMotionGraphicSuggestion } from '@/types';

interface EffectsTabProps {
  selectedClip: Clip;
  selectedTrack: any;
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (v: 'gemini' | 'groq') => void;
  isAnalyzingMotionGraphics: boolean;
  motionGraphicsAnalyzeProgress: string;
  handleAiMotionGraphicsDesign: () => void;
}

export function EffectsTab({
  selectedClip,
  selectedTrack,
  aiProvider,
  setAiProvider,
  isAnalyzingMotionGraphics,
  motionGraphicsAnalyzeProgress,
  handleAiMotionGraphicsDesign,
}: EffectsTabProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
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
                Motion Graphics
              </button>
            )}
          </div>
        </div>
      )}

      {/* Effects List - Placeholder for effects management */}
      <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
        <h4 className="text-[11px] font-semibold text-white mb-2">Active Effects</h4>
        {selectedClip.effects && selectedClip.effects.length > 0 ? (
          <div className="space-y-2">
            {selectedClip.effects.map((effect: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between bg-[#1e1e1e] p-2 rounded">
                <span className="text-[10px] text-white">{effect.name || 'Effect'}</span>
                <button className="text-red-400 hover:text-red-300 text-[10px]">Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[#a0a0a0]">No effects applied</p>
        )}
      </div>

      {/* Chroma Key */}
      {selectedClip.chromaKey && (
        <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
          <h4 className="text-[11px] font-semibold text-white mb-2">Chroma Key</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0a0]">Enabled</span>
              <button
                onClick={() => {}}
                className={`w-8 h-4 rounded-full transition-colors relative ${selectedClip.chromaKey.enabled ? 'bg-green-500' : 'bg-[#3e3e3e]'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${selectedClip.chromaKey.enabled ? 'left-[17px]' : 'left-[1px]'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#a0a0a0]">Color:</span>
              <input
                type="color"
                value={selectedClip.chromaKey.color || '#00ff00'}
                onChange={() => {}}
                className="w-8 h-6 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}