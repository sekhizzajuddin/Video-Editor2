import React, { useRef, useState } from 'react';
import { TimelineClip, MediaItem } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { getSpeedAtPosition, getSpeedRampEngine } from '@/utils/speedRamp';

const PRESETS_RATIOS = {
  slowMo: [
    { ratio: 0.0, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.25, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.5, speed: 0.3, easing: 'linear' as const },
    { ratio: 0.75, speed: 1.0, easing: 'linear' as const },
    { ratio: 1.0, speed: 1.0, easing: 'linear' as const },
  ],
  speedUp: [
    { ratio: 0.0, speed: 0.5, easing: 'linear' as const },
    { ratio: 0.4, speed: 0.5, easing: 'linear' as const },
    { ratio: 0.7, speed: 2.0, easing: 'linear' as const },
    { ratio: 1.0, speed: 2.0, easing: 'linear' as const },
  ],
  slowDown: [
    { ratio: 0.0, speed: 2.0, easing: 'linear' as const },
    { ratio: 0.3, speed: 2.0, easing: 'linear' as const },
    { ratio: 0.6, speed: 0.5, easing: 'linear' as const },
    { ratio: 1.0, speed: 0.5, easing: 'linear' as const },
  ],
  flash: [
    { ratio: 0.0, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.35, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.5, speed: 3.5, easing: 'linear' as const },
    { ratio: 0.65, speed: 1.0, easing: 'linear' as const },
    { ratio: 1.0, speed: 1.0, easing: 'linear' as const },
  ],
  cinematic: [
    { ratio: 0.0, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.2, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.4, speed: 0.25, easing: 'linear' as const },
    { ratio: 0.75, speed: 0.25, easing: 'linear' as const },
    { ratio: 1.0, speed: 1.0, easing: 'linear' as const },
  ],
};

interface SpeedRampFeatureProps {
  clip: TimelineClip;
  mediaLibrary: MediaItem[];
}

export function SpeedRampFeature({ clip, mediaLibrary }: SpeedRampFeatureProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const isRamped = !!clip.speedRamp && clip.speedRamp.length >= 2;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingIndex !== null || !isRamped) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const speed = Math.max(0.1, Math.min(4.0, 0.1 + (1 - clickY / rect.height) * 3.9));

    const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
    const maxDuration = mediaItem ? mediaItem.duration : clip.duration;
    const sourceTime = ratio * maxDuration;

    const currentRamp = [...(clip.speedRamp || [])];
    const newPoint = { id: `pt_${Date.now()}`, sourceTime, speed, easing: 'linear' as const };

    currentRamp.push(newPoint);
    currentRamp.sort((a, b) => a.sourceTime - b.sourceTime);

    const engine = getSpeedRampEngine(clip.id, currentRamp);
    const newTimelineDuration = engine.getTotalTimelineDuration();

    updateClip(clip.id, { speedRamp: currentRamp, duration: newTimelineDuration }, { ripple: true });
    useEditorStore.getState().saveSnapshot();
  };

  const handlePointerDownKeyframe = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingIndex(idx);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveKeyframe = (e: React.PointerEvent) => {
    if (draggingIndex === null || !svgRef.current || !clip.speedRamp) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const rawSpeed = 0.1 + (1 - clickY / rect.height) * 3.9;
    const clampedSpeed = Math.max(0.1, Math.min(4.0, Math.round(rawSpeed * 20) / 20));

    const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
    const maxDuration = mediaItem ? mediaItem.duration : clip.duration;

    const currentRamp = [...clip.speedRamp];
    const isBoundary = draggingIndex === 0 || draggingIndex === currentRamp.length - 1;

    let newSourceTime = isBoundary ? currentRamp[draggingIndex].sourceTime : ratio * maxDuration;

    if (!isBoundary) {
      const prevTime = currentRamp[draggingIndex - 1]?.sourceTime ?? 0;
      const nextTime = currentRamp[draggingIndex + 1]?.sourceTime ?? maxDuration;
      newSourceTime = Math.max(prevTime + 0.1, Math.min(nextTime - 0.1, newSourceTime));
    }

    currentRamp[draggingIndex] = {
      ...currentRamp[draggingIndex],
      sourceTime: newSourceTime,
      speed: clampedSpeed,
    };

    const engine = getSpeedRampEngine(clip.id, currentRamp);
    const newTimelineDuration = engine.getTotalTimelineDuration();

    updateClip(clip.id, { speedRamp: currentRamp, duration: newTimelineDuration }, { ripple: true });
  };

  const handlePointerUpKeyframe = (e: React.PointerEvent) => {
    if (draggingIndex !== null) {
      setDraggingIndex(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
      useEditorStore.getState().saveSnapshot();
    }
  };

  const applyRampPreset = (presetKey: keyof typeof PRESETS_RATIOS) => {
    const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
    const maxDuration = mediaItem ? mediaItem.duration : clip.duration;

    const rData = PRESETS_RATIOS[presetKey];
    const newRamp = rData.map((pt, i) => ({
      id: `pt_${i}_${Date.now()}`,
      sourceTime: pt.ratio * maxDuration,
      speed: pt.speed,
      easing: pt.easing,
    }));

    const engine = getSpeedRampEngine(clip.id, newRamp);
    const newTimelineDuration = engine.getTotalTimelineDuration();

    updateClip(clip.id, { speedRamp: newRamp, duration: newTimelineDuration }, { ripple: true });
    useEditorStore.getState().saveSnapshot();
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white font-medium">Speed Ramping</label>
        <input
          type="checkbox"
          checked={isRamped}
          onChange={(e) => {
            if (e.target.checked) {
              const currentSpeed = clip.speed || 1.0;
              const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
              const maxDuration = mediaItem ? mediaItem.duration : clip.duration;
              updateClip(clip.id, {
                speedRamp: [
                  { id: 'start', sourceTime: 0.0, speed: currentSpeed, easing: 'linear' },
                  { id: 'end', sourceTime: maxDuration, speed: currentSpeed, easing: 'linear' },
                ],
              }, { ripple: true });
            } else {
              updateClip(clip.id, { speedRamp: undefined }, { ripple: true });
            }
            useEditorStore.getState().saveSnapshot();
          }}
          className="rounded border-[#3e3e3e] bg-[#1e1e1e] text-amber-500 focus:ring-0 cursor-pointer h-4 w-4"
        />
      </div>

      {isRamped && (
        <div className="space-y-3 pt-2">
          {/* SVG Editor */}
          <div className="relative bg-[#1e1e1e] border border-[#3e3e3e] rounded p-1">
            <svg
              ref={svgRef}
              viewBox="0 0 240 100"
              preserveAspectRatio="none"
              width="100%"
              height="112"
              className="w-full h-28 cursor-crosshair select-none"
              onClick={handleSvgClick}
            >
              {/* Grid Lines */}
              {[0.5, 1.0, 2.0, 3.0, 4.0].map((s) => {
                const y = 100 - ((s - 0.1) / 3.9) * 90 - 5;
                return (
                  <g key={s}>
                    <line
                      x1={0}
                      y1={y}
                      x2={240}
                      y2={y}
                      stroke={s === 1.0 ? '#555' : '#333'}
                      strokeWidth={s === 1.0 ? 1 : 0.5}
                      strokeDasharray={s === 1.0 ? '' : '3 3'}
                    />
                    <text
                      x={4}
                      y={y - 2}
                      fill="#666"
                      fontSize="6"
                      className="pointer-events-none select-none font-mono"
                    >
                      {s}x
                    </text>
                  </g>
                );
              })}

              {/* Slow-mo zone shading */}
              <rect
                x={0}
                y={100 - ((1.0 - 0.1) / 3.9) * 90 - 5}
                width={240}
                height={((1.0 - 0.1) / 3.9) * 90}
                fill="rgba(59, 130, 246, 0.03)"
                className="pointer-events-none"
              />

              {/* Fast zone shading */}
              <rect
                x={0}
                y={5}
                width={240}
                height={100 - ((1.0 - 0.1) / 3.9) * 90 - 10}
                fill="rgba(239, 68, 68, 0.03)"
                className="pointer-events-none"
              />

              {/* The Spline Curve */}
              <path
                d={(() => {
                  const pts: string[] = [];
                  const ramp = clip.speedRamp || [];
                  for (let x = 0; x <= 240; x += 4) {
                    const p = x / 240;
                    const speed = getSpeedAtPosition(ramp, p);
                    const y = 100 - ((speed - 0.1) / 3.9) * 90 - 5;
                    pts.push(`${x},${y}`);
                  }
                  return `M ${pts.join(' L ')}`;
                })()}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                className="pointer-events-none"
              />

              {/* Keyframe Draggable Handles */}
              {(clip.speedRamp || []).map((pt, idx) => {
                const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
                const maxDuration = mediaItem ? mediaItem.duration : clip.duration;
                const ratio = pt.sourceTime / maxDuration;
                const cx = ratio * 240;
                const cy = 100 - ((pt.speed - 0.1) / 3.9) * 90 - 5;
                const isBoundary = idx === 0 || idx === (clip.speedRamp || []).length - 1;

                return (
                  <circle
                    key={pt.id || idx}
                    cx={cx}
                    cy={cy}
                    r={draggingIndex === idx ? 5 : 3.5}
                    fill={draggingIndex === idx ? '#ec4899' : '#f59e0b'}
                    stroke="#fff"
                    strokeWidth="1.5"
                    className={`cursor-grab active:cursor-grabbing ${isBoundary ? 'cursor-ns-resize' : ''}`}
                    onPointerDown={(e) => handlePointerDownKeyframe(idx, e)}
                    onPointerMove={handlePointerMoveKeyframe}
                    onPointerUp={handlePointerUpKeyframe}
                  />
                );
              })}
            </svg>
          </div>

          {/* Presets */}
          <div className="space-y-1">
            <span className="text-[10px] text-[#a0a0a0] uppercase tracking-wider block">Ramp Presets</span>
            <div className="grid grid-cols-5 gap-1">
              {(['slowMo', 'speedUp', 'slowDown', 'flash', 'cinematic'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyRampPreset(preset)}
                  className="py-1 px-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] text-[#a0a0a0] hover:text-white rounded border border-[#3e3e3e] text-[9px] capitalize transition-colors text-center truncate"
                >
                  {preset.replace(/([A-Z])/g, ' $1').trim()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
