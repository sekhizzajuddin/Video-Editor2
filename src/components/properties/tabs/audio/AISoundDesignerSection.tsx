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
    <div className="bg-[var(--theme-bg-card)] border border-amber-500/30 rounded-xl p-3.5 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-xs text-[var(--theme-text-primary)] font-bold">AI Sound Designer</span>
      </div>
      <p className="text-[11px] text-[var(--theme-text-muted)] leading-normal">
        Analyze scene storyboard using Gemini 2.0 Vision and suggest optimized SFX options using Groq.
      </p>

      <div className="space-y-2 pt-1 border-t border-[var(--theme-border)]">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-[var(--theme-text-primary)] font-semibold">AI Provider:</label>
          <select 
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
            className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-md px-2 py-1 focus:outline-none focus:border-amber-500 shadow-sm"
          >
            <option value="gemini">Gemini (Default)</option>
            <option value="groq">Groq (Llama 3 Vision)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-[var(--theme-text-primary)] font-semibold">Precision:</label>
          <select 
            value={soundDesignFps}
            onChange={(e) => setSoundDesignFps(Number(e.target.value))}
            className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-md px-2 py-1 focus:outline-none focus:border-amber-500 shadow-sm"
          >
            <option value={1}>1 FPS (Standard)</option>
            <option value={5}>5 FPS (High)</option>
            <option value={10}>10 FPS (Ultra, Millisecond precise)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-[var(--theme-text-muted)] font-semibold">Freesound Key (Optional)</label>
          <input
            type="password"
            placeholder="Leave blank for public key"
            value={freesoundApiKey}
            onChange={(e) => {
              setFreesoundApiKey(e.target.value);
              sessionStorage.setItem('procut_freesound_key', e.target.value);
            }}
            className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-md px-2 py-1 focus:outline-none focus:border-amber-500 placeholder-[var(--theme-text-muted)]/50 shadow-sm"
          />
        </div>
      </div>

      {isAnalyzingAudio ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          <span className="text-[10px] text-amber-500 font-semibold">{audioAnalyzeProgress}</span>
        </div>
      ) : (
        <button
          onClick={handleAiSoundDesign}
          className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20"
        >
          Analyze Scene & Generate Sound Design
        </button>
      )}
    </div>
  );
}