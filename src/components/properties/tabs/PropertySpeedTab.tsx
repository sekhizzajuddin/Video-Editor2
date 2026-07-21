/**
 * PropertySpeedTab.tsx
 * 
 * Speed inspector tab for Properties Panel.
 * Handles flat speed multiplier slider and SVG Speed Ramping Curve Editor with draggable handles.
 */

import React from 'react';
import { TimelineClip, MediaItem } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { FrameInterpolationFeature } from '../features/FrameInterpolationFeature';
import { SpeedRampFeature } from '../features/SpeedRampFeature';

interface PropertySpeedTabProps {
  selectedClip: TimelineClip;
  currentTime: number;
  mediaLibrary: MediaItem[];
  updateClip: (id: string, updates: Partial<TimelineClip>, options?: { ripple?: boolean }) => void;
}

export function PropertySpeedTab({
  selectedClip,
  currentTime,
  mediaLibrary,
  updateClip,
}: PropertySpeedTabProps) {
  const isRamped = !!selectedClip.speedRamp && selectedClip.speedRamp.length >= 2;

  return (
    <div className="space-y-3 p-4 text-xs select-none">
      {/* Speed range input */}
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
              const state = useEditorStore.getState();
              if (state.currentTime > selectedClip.startTime + newDuration) {
                state.seek(selectedClip.startTime + newDuration - 0.1);
              }
            }}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            onDoubleClick={() => {
              if (isRamped) return;
              const newSpeed = 1.0;
              const sourceDuration = selectedClip.duration * selectedClip.speed;
              const newDuration = sourceDuration / newSpeed;
              updateClip(selectedClip.id, {
                speed: newSpeed,
                duration: newDuration,
              }, { ripple: true });
              useEditorStore.getState().saveSnapshot();
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

      {/* Frame Interpolation */}
      <FrameInterpolationFeature clip={selectedClip} />

      {/* Speed Ramping Toggle & Editor */}
      <SpeedRampFeature clip={selectedClip} mediaLibrary={mediaLibrary} />
    </div>
  );
}
