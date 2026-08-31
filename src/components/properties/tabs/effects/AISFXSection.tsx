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
    <div className="bg-[var(--theme-bg-card)] border border-amber-500/30 rounded-xl p-3.5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--theme-text-primary)]">AI SFX & Sound Designer</h4>
            <p className="text-[9px] text-[var(--theme-text-muted)]">Auto-generates & layers sound effects to visual cues</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
        Analyze scene visuals in this clip with AI Vision to generate Foley, ambient sounds, and cinematic impacts.
      </p>

      {isAnalyzingAudio ? (
        <div className="flex items-center justify-center gap-2 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-600 dark:text-amber-300 text-[11px] font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{audioAnalyzeProgress || 'Analyzing scene cues & audio...'}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={triggerAction}
          className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
        >
          <Wand2 className="w-3.5 h-3.5 text-white/90" />
          Design AI Sound Effects & Foley
        </button>
      )}
    </div>
  );
}
