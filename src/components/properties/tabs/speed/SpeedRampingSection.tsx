import { useEditorStore } from '@/store/editorStore';
import { getSpeedRampEngine } from '@/utils/speedRamp';
import type { TimelineClip, SpeedRampKeyframe } from '@/types';

interface SpeedRampingSectionProps {
  selectedClip: TimelineClip;
  isRamped: boolean;
  mediaLibrary: any[];
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SpeedRampingSection({ selectedClip, isRamped, mediaLibrary, updateClip }: SpeedRampingSectionProps) {
  const addKeyframeAtPlayhead = () => {
    if (!selectedClip.speedRamp || selectedClip.speedRamp.length < 2) return;
    const mediaItem = mediaLibrary.find((m) => m.id === selectedClip.mediaId);
    const maxDuration = mediaItem ? mediaItem.duration : selectedClip.duration;
    const sourceEnd = maxDuration - (selectedClip.trimEnd ?? 0);

    const currentTime = useEditorStore.getState().currentTime;
    const elapsed = Math.max(0, Math.min(selectedClip.duration, currentTime - selectedClip.startTime));
    const engine = getSpeedRampEngine(selectedClip.id, selectedClip.speedRamp);
    const localStart = engine.sourceToTimeline(selectedClip.trimStart);
    const sourceTime = engine.timelineToSource(localStart + elapsed);

    const minSource = (selectedClip.trimStart ?? 0) + 0.05;
    const maxSource = sourceEnd - 0.05;
    const clamped = Math.max(minSource, Math.min(maxSource, sourceTime));
    if (clamped <= minSource || clamped >= maxSource) return;

    const ramp = [...selectedClip.speedRamp];
    ramp.push({
      id: `kf-${Date.now()}-${Math.random()}`,
      sourceTime: clamped,
      speed: 1.0,
      easing: 'linear',
    });
    const sortedRamp = ramp.sort((a, b) => a.sourceTime - b.sourceTime);
    // The store recalculates the clip duration automatically when speedRamp
    // changes and no explicit duration is provided.
    updateClip(selectedClip.id, { speedRamp: sortedRamp });
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white">Speed Ramping</span>
        <button
          onClick={() => {
            if (isRamped) {
              updateClip(selectedClip.id, { speedRamp: undefined, speed: 1.0 });
            } else {
              const mediaItem = mediaLibrary.find((m) => m.id === selectedClip.mediaId);
              const maxDuration = mediaItem ? mediaItem.duration : selectedClip.duration;
              const currentSpeed = selectedClip.speed || 1.0;
              updateClip(selectedClip.id, {
                speedRamp: [
                  { id: 'kf-1', sourceTime: 0, speed: currentSpeed, easing: 'linear' },
                  { id: 'kf-2', sourceTime: maxDuration, speed: currentSpeed, easing: 'linear' },
                ] as SpeedRampKeyframe[],
              });
            }
          }}
          className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${
            isRamped
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
          }`}
        >
          {isRamped ? 'Disable' : 'Enable'}
        </button>
      </div>

      {isRamped && selectedClip.speedRamp && (
        <div className="space-y-2">
          <button
            onClick={addKeyframeAtPlayhead}
            className="w-full py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded text-[10px] font-medium transition-colors"
          >
            + Add Keyframe at Playhead
          </button>
          {selectedClip.speedRamp.map((point: SpeedRampKeyframe, idx: number) => (
            <div key={point.id} className="flex items-center gap-2 bg-[#1e1e1e] p-2 rounded">
              <span className="text-[10px] text-[#a0a0a0] w-8">#{idx + 1}</span>
              <input
                type="number"
                min={0.1}
                max={4.0}
                step={0.1}
                value={point.speed}
                onChange={(e) => {
                  const newRamp = [...selectedClip.speedRamp!];
                  const val = Math.max(0.1, Math.min(4.0, Number(e.target.value) || 1.0));
                  newRamp[idx] = { ...point, speed: val };
                  updateClip(selectedClip.id, { speedRamp: newRamp });
                }}
                className="w-20 bg-[#2d2d2d] border border-[#3e3e3e] rounded text-xs text-white px-2 py-1"
              />
              <span className="text-[10px] text-white flex-1">
                {point.sourceTime.toFixed(2)}s
              </span>
              {idx > 0 && idx < selectedClip.speedRamp!.length - 1 && (
                <button
                  onClick={() => {
                    const newRamp = selectedClip.speedRamp!.filter((_, i) => i !== idx);
                    updateClip(selectedClip.id, { speedRamp: newRamp });
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
