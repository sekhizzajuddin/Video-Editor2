import { useEditorStore } from '@/store/editorStore';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import type { TimelineClip } from '@/types';
import { SpeedSliderSection, DynamicStretchSection } from './speed';

interface SpeedTabProps {
  selectedClip: TimelineClip;
  mediaLibrary: any[];
  isRamped: boolean;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SpeedTab({ selectedClip, isRamped, updateClip }: SpeedTabProps) {
  const handleSpeedChange = (newSpeed: number) => {
    const sourceDuration = selectedClip.duration * selectedClip.speed;
    const newDuration = sourceDuration / newSpeed;
    updateClip(selectedClip.id, {
      speed: newSpeed,
      duration: newDuration,
    }, { ripple: true });
  };

  const handleToggleReverse = () => {
    updateClip(selectedClip.id, {
      isReversed: !selectedClip.isReversed,
      freezeFrame: undefined,
    });
  };

  const handleFreezeFrame = () => {
    const currentTime = useEditorStore.getState().currentTime;
    const mediaTime = getMediaTimeForClip({
      id: selectedClip.id,
      startTime: selectedClip.startTime,
      duration: selectedClip.duration,
      trimStart: selectedClip.trimStart,
      speed: selectedClip.speed,
      speedRamp: selectedClip.speedRamp,
    }, currentTime);
    updateClip(selectedClip.id, { freezeFrame: mediaTime });
  };

  const handleClearFreeze = () => {
    updateClip(selectedClip.id, { freezeFrame: undefined });
  };

  return (
    <div className="space-y-4">
      {/* ── Dynamic Speed Ramping (Dynamic Stretch) ── */}
      <DynamicStretchSection selectedClip={selectedClip} />

      {/* ── Constant Speed Slider & Tools ── */}
      <SpeedSliderSection
        speed={selectedClip.speed}
        isRamped={isRamped}
        isReversed={selectedClip.isReversed}
        freezeFrame={selectedClip.freezeFrame}
        onSpeedChange={handleSpeedChange}
        onReset={() => handleSpeedChange(1.0)}
        onToggleReverse={handleToggleReverse}
        onFreezeFrame={handleFreezeFrame}
        onClearFreeze={handleClearFreeze}
      />
    </div>
  );
}

