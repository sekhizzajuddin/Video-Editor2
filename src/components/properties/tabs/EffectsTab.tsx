import type { TimelineClip } from '@/types';
import {
  AIMotionGraphicsSection,
  AISFXSection,
  BeatSyncSection,
  EffectsListSection,
  ChromaKeySection,
  ObjectRemovalSection,
} from './effects';

interface EffectsTabProps {
  selectedClip: TimelineClip;
  selectedTrack?: any;
  aiProvider?: 'gemini' | 'groq';
  setAiProvider?: (v: 'gemini' | 'groq') => void;
  isAnalyzingMotionGraphics?: boolean;
  motionGraphicsAnalyzeProgress?: string;
  handleAiMotionGraphicsDesign?: () => void;
  isAnalyzingAudio?: boolean;
  audioAnalyzeProgress?: string;
  handleAiSoundDesign?: () => void;
}

export function EffectsTab({
  selectedClip,
  selectedTrack,
  aiProvider = 'gemini',
  setAiProvider = () => {},
  isAnalyzingMotionGraphics = false,
  motionGraphicsAnalyzeProgress = '',
  handleAiMotionGraphicsDesign = () => {},
  isAnalyzingAudio = false,
  audioAnalyzeProgress = '',
  handleAiSoundDesign = () => {},
}: EffectsTabProps) {
  const isVideo = selectedTrack?.type === 'video' || (!selectedClip.textSettings && selectedClip.mediaId !== 'text-placeholder');
  const isAudio = selectedTrack?.type === 'audio' || selectedClip.mediaId?.includes('audio') || selectedClip.audioSettings;

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">AI & Effect Settings</h3>
      </div>

      {/* Auto Beat Sync & Rhythm Detection */}
      {selectedClip && (
        <BeatSyncSection
          selectedClip={selectedClip}
        />
      )}

      {/* AI Sound Designer & SFX */}
      {selectedClip && (
        <AISFXSection
          selectedClip={selectedClip}
          isAnalyzingAudio={isAnalyzingAudio}
          audioAnalyzeProgress={audioAnalyzeProgress}
          handleAiSoundDesign={handleAiSoundDesign}
        />
      )}

      {/* AI Motion Graphics */}
      {selectedClip && !selectedClip.textSettings && selectedClip.mediaId !== 'text-placeholder' && (
        <AIMotionGraphicsSection
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          isAnalyzingMotionGraphics={isAnalyzingMotionGraphics}
          motionGraphicsAnalyzeProgress={motionGraphicsAnalyzeProgress}
          handleAiMotionGraphicsDesign={handleAiMotionGraphicsDesign}
          selectedClip={selectedClip}
        />
      )}

      {/* Chroma Key & Keying */}
      <ChromaKeySection selectedClip={selectedClip} />

      {/* AI Object Removal */}
      <ObjectRemovalSection selectedClip={selectedClip} />

      {/* Active Timeline FX */}
      <EffectsListSection selectedClip={selectedClip} />
    </div>
  );
}

