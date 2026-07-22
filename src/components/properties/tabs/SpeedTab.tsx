import { useState, useRef } from 'react';
import type { Clip, SpeedRampKeyframe } from '@/types';

interface SpeedTabProps {
  selectedClip: Clip;
  mediaLibrary: any[];
  isRamped: boolean;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SpeedTab({ selectedClip, mediaLibrary, isRamped, updateClip }: SpeedTabProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSpeedChange = (newSpeed: number) => {
    const sourceDuration = selectedClip.duration * selectedClip.speed;
    const newDuration = sourceDuration / newSpeed;
    updateClip(selectedClip.id, {
      speed: newSpeed,
      duration: newDuration,
    }, { ripple: true });
    const state = { currentTime: 0, seek: (t: number) => {} }; // Placeholder - will be passed from parent
    if (state.currentTime > selectedClip.startTime + newDuration) {
      state.seek(selectedClip.startTime + newDuration - 0.1);
    }
  };

  return (
    <div className="space-y-3">
      {/* Speed Range Input */}
      <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
        <label className="text-xs text-white font-medium block mb-2">Speed</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={isRamped ? 1.0 : selectedClip.speed}
            disabled={isRamped}
            title={isRamped ? "Disable Speed Ramping to adjust flat speed" : "Double-click to reset to 1.0x"}
            onChange={(e) => {
              const newSpeed = Number(e.target.value);
              const sourceDuration = selectedClip.duration * selectedClip.speed;
              const newDuration = sourceDuration / newSpeed;
              updateClip(selectedClip.id, {
                speed: newSpeed,
                duration: newDuration,
              }, { ripple: true });
            }}
            onMouseUp={() => {}}
            onDoubleClick={() => {
              if (isRamped) return;
              handleSpeedChange(1.0);
            }}
            className={`flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${
              isRamped
                ? 'bg-[#222] [&::-webkit-slider-thumb]:bg-[#444] cursor-not-allowed'
                : 'bg-[#3e3e3e] [&::-webkit-slider-thumb]:bg-amber-500'
            }`}
          />
          <span className="text-[11px] text-white w-12 text-right select-none font-mono">
            {isRamped ? 'Ramped' : `${selectedClip.speed.toFixed(2)}x`}
          </span>
        </div>
      </div>

      {/* Speed Ramping */}
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

      {/* Preset Ramps */}
      {!isRamped && (
        <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
          <span className="text-xs font-medium text-white block mb-2">Preset Ramps</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { name: 'Slow Mo', speed: 0.3 },
              { name: 'Speed Up', speed: 2.0 },
              { name: 'Fast', speed: 3.0 },
              { name: 'Normal', speed: 1.0 },
            ].map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleSpeedChange(preset.speed)}
                className="px-2 py-1.5 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] text-white transition-colors"
              >
                {preset.name} ({preset.speed}x)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}