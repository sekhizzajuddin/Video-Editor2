import type { TimelineClip } from '@/types';
import {
  AISoundDesignerSection,
  VolumeSection,
  PanSection,
  EQSection,
  AutoVoiceTuneSection,
  AutoDuckingSection,
  ReverbEnvironmentSection,
} from './audio';

interface AudioTabProps {
  selectedClip: TimelineClip;
  TimelineClipAudio: any;
  selectedClipIds: string[];
  isAnalyzingVoice: boolean;
  handleAutoVoiceTune: () => void;
  isAnalyzingAudio: boolean;
  audioAnalyzeProgress: string;
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (v: 'gemini' | 'groq') => void;
  soundDesignFps: number;
  setSoundDesignFps: (v: number) => void;
  freesoundApiKey: string;
  setFreesoundApiKey: (v: string) => void;
  handleAiSoundDesign: () => void;
  handleAudioChange: (key: string, val: any) => void;
  handleAudioReset: (key: string) => void;
}

export function AudioTab({
  selectedClip,
  TimelineClipAudio,
  selectedClipIds,
  isAnalyzingVoice,
  handleAutoVoiceTune,
  isAnalyzingAudio,
  audioAnalyzeProgress,
  aiProvider,
  setAiProvider,
  soundDesignFps,
  setSoundDesignFps,
  freesoundApiKey,
  setFreesoundApiKey,
  handleAiSoundDesign,
  handleAudioChange,
  handleAudioReset,
}: AudioTabProps) {
  return (
    <div className="space-y-3">
      {selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && (
        <AISoundDesignerSection
          isAnalyzingAudio={isAnalyzingAudio}
          audioAnalyzeProgress={audioAnalyzeProgress}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          soundDesignFps={soundDesignFps}
          setSoundDesignFps={setSoundDesignFps}
          freesoundApiKey={freesoundApiKey}
          setFreesoundApiKey={setFreesoundApiKey}
          handleAiSoundDesign={handleAiSoundDesign}
        />
      )}

      <VolumeSection
        volume={TimelineClipAudio.volume}
        onChange={(val) => handleAudioChange('volume', val)}
        onReset={() => handleAudioReset('volume')}
      />

      <PanSection
        pan={TimelineClipAudio.pan}
        onChange={(val) => handleAudioChange('pan', val)}
        onReset={() => handleAudioReset('pan')}
      />

      <EQSection
        bass={TimelineClipAudio.bass || 0}
        mid={TimelineClipAudio.mid || 0}
        treble={TimelineClipAudio.treble || 0}
        onBassChange={(val) => handleAudioChange('bass', val)}
        onMidChange={(val) => handleAudioChange('mid', val)}
        onTrebleChange={(val) => handleAudioChange('treble', val)}
      />

      <ReverbEnvironmentSection
        clipAudio={TimelineClipAudio}
        handleAudioChange={handleAudioChange}
        handleAudioReset={handleAudioReset}
      />

      <AutoVoiceTuneSection
        selectedClipIds={selectedClipIds}
        isAnalyzingVoice={isAnalyzingVoice}
        handleAutoVoiceTune={handleAutoVoiceTune}
      />

      <AutoDuckingSection
        selectedClip={selectedClip}
        handleAudioChange={handleAudioChange}
      />
    </div>
  );
}
