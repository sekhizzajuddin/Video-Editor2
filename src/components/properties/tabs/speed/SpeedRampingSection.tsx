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
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[var(--theme-text-primary)]">Speed Ramping</span>
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
          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isRamped
              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
          }`}
        >
          {isRamped ? 'Disable' : 'Enable'}
        </button>
      </div>

      {isRamped && selectedClip.speedRamp && (
        <div className="space-y-2 pt-1 border-t border-[var(--theme-border)]">
          <button
            onClick={addKeyframeAtPlayhead}
            className="w-full py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all shadow-sm"
          >
            + Add Keyframe at Playhead
          </button>
          {selectedClip.speedRamp.map((point: SpeedRampKeyframe, idx: number) => (
            <div key={point.id} className="flex items-center gap-2 bg-[var(--theme-bg-subpanel)] p-2 rounded-lg border border-[var(--theme-border)]">
              <span className="text-[10px] text-[var(--theme-text-muted)] font-mono w-8">#{idx + 1}</span>
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
                className="w-20 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-md text-xs text-[var(--theme-text-primary)] px-2 py-1 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-[var(--theme-text-primary)] font-mono flex-1">
                {point.sourceTime.toFixed(2)}s
              </span>
              {idx > 0 && idx < selectedClip.speedRamp!.length - 1 && (
                <button
                  onClick={() => {
                    const newRamp = selectedClip.speedRamp!.filter((_, i) => i !== idx);
                    updateClip(selectedClip.id, { speedRamp: newRamp });
                  }}
                  className="text-rose-500 hover:text-rose-400 p-1 font-bold"
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
