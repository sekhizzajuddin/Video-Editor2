import { Loader2 } from 'lucide-react';

interface AutoVoiceTuneSectionProps {
  selectedClipIds: string[];
  isAnalyzingVoice: boolean;
  handleAutoVoiceTune: () => void;
}

export function AutoVoiceTuneSection({ selectedClipIds, isAnalyzingVoice, handleAutoVoiceTune }: AutoVoiceTuneSectionProps) {
  

  return (
    <button
      title={selectedClipIds.length < 2 ? "Select multiple clips (hold Shift) to match their vocals to the first selected clip" : "Match vocals to the first selected clip"}
      onClick={handleAutoVoiceTune}
      disabled={isAnalyzingVoice || selectedClipIds.length < 2}
      className="w-full py-2.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-600 dark:text-teal-400 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm"
    >
      {isAnalyzingVoice ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Analyzing voices...
        </>
      ) : (
        selectedClipIds.length < 2 ? 'Auto-Match Vocals (Select 2+ Clips)' : 'Auto-Match Vocals to 1st Clip'
      )}
    </button>
  );
}