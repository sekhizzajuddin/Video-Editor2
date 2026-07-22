import { Sparkles, Loader2 } from 'lucide-react';

interface AIMotionGraphicsSectionProps {
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (v: 'gemini' | 'groq') => void;
  isAnalyzingMotionGraphics: boolean;
  motionGraphicsAnalyzeProgress: string;
  handleAiMotionGraphicsDesign: () => void;
}

export function AIMotionGraphicsSection({
  aiProvider,
  setAiProvider,
  isAnalyzingMotionGraphics,
  motionGraphicsAnalyzeProgress,
  handleAiMotionGraphicsDesign,
}: AIMotionGraphicsSectionProps) {
  return (
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
  );
}