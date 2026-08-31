import { Sparkles, Loader2 } from 'lucide-react';

interface AISoundDesignerSectionProps {
  isAnalyzingAudio: boolean;
  audioAnalyzeProgress: string;
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (v: 'gemini' | 'groq') => void;
  soundDesignFps: number;
  setSoundDesignFps: (v: number) => void;
  freesoundApiKey: string;
  setFreesoundApiKey: (v: string) => void;
  handleAiSoundDesign: () => void;
}

export function AISoundDesignerSection({
  isAnalyzingAudio,
  audioAnalyzeProgress,
  aiProvider,
  setAiProvider,
  soundDesignFps,
  setSoundDesignFps,
  freesoundApiKey,
  setFreesoundApiKey,
  handleAiSoundDesign,
}: AISoundDesignerSectionProps) {
  return (
    <div className="bg-amber-950/20 border border-amber-500/30 rounded p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-xs text-foreground font-semibold">AI Sound Designer</span>
      </div>
      <p className="text-[11px] text-[#e0c090]">
        Analyze scene storyboard using Gemini 2.0 Vision and suggest optimized SFX options using Groq.
      </p>

      <div className="space-y-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-foreground">AI Provider:</label>
          <select 
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
            className="bg-card text-foreground text-[10px] border border-border rounded px-2 py-1 focus:outline-none focus:border-amber-500"
          >
            <option value="gemini">Gemini (Default)</option>
            <option value="groq">Groq (Llama 3 Vision)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-foreground">Precision:</label>
          <select 
            value={soundDesignFps}
            onChange={(e) => setSoundDesignFps(Number(e.target.value))}
            className="bg-card text-foreground text-[10px] border border-border rounded px-2 py-1 focus:outline-none focus:border-amber-500"
          >
            <option value={1}>1 FPS (Standard)</option>
            <option value={5}>5 FPS (High)</option>
            <option value={10}>10 FPS (Ultra, Millisecond precise)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-muted-foreground">Freesound Key (Optional)</label>
          <input
            type="password"
            placeholder="Leave blank for public key"
            value={freesoundApiKey}
            onChange={(e) => {
              setFreesoundApiKey(e.target.value);
              sessionStorage.setItem('procut_freesound_key', e.target.value);
            }}
            className="bg-card text-foreground text-[10px] border border-border rounded px-2 py-1 focus:outline-none focus:border-amber-500"
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
  );
}