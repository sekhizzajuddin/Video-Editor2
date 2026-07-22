import type { TimelineClip } from '@/types';
import {
  AIMotionGraphicsSection,
  EffectsListSection,
  ChromaKeySection,
} from './effects';

interface EffectsTabProps {
  selectedClip: TimelineClip;
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

      {selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && selectedTrack?.type === 'video' && (
        <AIMotionGraphicsSection
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          isAnalyzingMotionGraphics={isAnalyzingMotionGraphics}
          motionGraphicsAnalyzeProgress={motionGraphicsAnalyzeProgress}
          handleAiMotionGraphicsDesign={handleAiMotionGraphicsDesign}
        />
      )}

      <EffectsListSection selectedClip={selectedClip} />
      <ChromaKeySection selectedClip={selectedClip} />
    </div>
  );
}
