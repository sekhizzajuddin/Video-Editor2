import type { Clip, SpeedRampKeyframe } from '@/types';

interface SpeedRampingSectionProps {
  selectedClip: Clip;
  isRamped: boolean;
  mediaLibrary: any[];
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SpeedRampingSection({ selectedClip, isRamped, mediaLibrary, updateClip }: SpeedRampingSectionProps) {
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
              updateClip(selectedClip.id, {
                speedRamp: [
                  { id: 'kf-1', sourceTime: 0, speed: 1.0, easing: 'linear' },
                  { id: 'kf-2', sourceTime: maxDuration, speed: 1.0, easing: 'linear' },
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
                  newRamp[idx] = { ...point, speed: Number(e.target.value) };
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