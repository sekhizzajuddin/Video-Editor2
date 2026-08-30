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
      className="w-full py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 text-teal-400 rounded text-[11px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {isAnalyzingVoice ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Analyzing voices...
        </>
      ) : (
        selectedClipIds.length < 2 ? 'Auto-Match Vocals (Select 2+ Clips)' : 'Auto-Match Vocals to 1st Clip'
      )}
    </button>
  );
}