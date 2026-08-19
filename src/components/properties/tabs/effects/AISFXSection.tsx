import React, { useState } from 'react';
import { Volume2, Sparkles, Loader2, Wand2 } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { toast } from 'sonner';

interface AISFXSectionProps {
  selectedClip: TimelineClip;
  onOpenSoundDesigner?: () => void;
  isAnalyzingAudio?: boolean;
  audioAnalyzeProgress?: string;
  handleAiSoundDesign?: () => void;
}

export function AISFXSection({
  selectedClip,
  onOpenSoundDesigner,
  isAnalyzingAudio,
  audioAnalyzeProgress,
  handleAiSoundDesign,
}: AISFXSectionProps) {
  const [sfxPrompt, setSfxPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const triggerAction = () => {
    if (handleAiSoundDesign) {
      handleAiSoundDesign();
    } else if (onOpenSoundDesigner) {
      onOpenSoundDesigner();
    } else {
      toast.info('Analyzing scene video and generating sound effects...');
    }
  };

  return (
    <div className="bg-[#241a15] border border-amber-500/30 rounded p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">AI SFX & Sound Designer</h4>
            <p className="text-[9px] text-[#e0c090]">Auto-generates & layers sound effects to visual cues</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-zinc-300 leading-relaxed">
        Analyze scene visuals in this clip with AI Vision to generate Foley, ambient sounds, and cinematic impacts.
      </p>

      {isAnalyzingAudio ? (
        <div className="flex items-center justify-center gap-2 py-2 bg-amber-950/40 rounded border border-amber-500/20 text-amber-300 text-[11px]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{audioAnalyzeProgress || 'Analyzing scene cues & audio...'}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={triggerAction}
          className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-200" />
          Design AI Sound Effects & Foley
        </button>
      )}
    </div>
  );
}
