import { Loader2 } from 'lucide-react';

interface AutoVoiceTuneSectionProps {
  selectedClipIds: string[];
  isAnalyzingVoice: boolean;
  handleAutoVoiceTune: () => void;
}

export function AutoVoiceTuneSection({ selectedClipIds, isAnalyzingVoice, handleAutoVoiceTune }: AutoVoiceTuneSectionProps) {
  if (selectedClipIds.length < 2) return null;

  return (
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
  );
}