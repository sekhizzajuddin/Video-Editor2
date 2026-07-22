import type { TimelineClip } from '@/types';
import {
  SpeedSliderSection,
  SpeedRampingSection,
  PresetRampsSection,
} from './speed';

interface SpeedTabProps {
  selectedClip: TimelineClip;
  mediaLibrary: any[];
  isRamped: boolean;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SpeedTab({ selectedClip, mediaLibrary, isRamped, updateClip }: SpeedTabProps) {
  const handleSpeedChange = (newSpeed: number) => {
    const sourceDuration = selectedClip.duration * selectedClip.speed;
    const newDuration = sourceDuration / newSpeed;
    updateClip(selectedClip.id, {
      speed: newSpeed,
      duration: newDuration,
    }, { ripple: true });
  };

  return (
    <div className="space-y-3">
      <SpeedSliderSection
        speed={selectedClip.speed}
        isRamped={isRamped}
        onSpeedChange={handleSpeedChange}
        onReset={() => handleSpeedChange(1.0)}
      />

      <SpeedRampingSection
        selectedClip={selectedClip}
        isRamped={isRamped}
        mediaLibrary={mediaLibrary}
        updateClip={updateClip}
      />

      <PresetRampsSection
        isRamped={isRamped}
        onSpeedChange={handleSpeedChange}
      />
    </div>
  );
}
