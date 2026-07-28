/**
 * ColorWheel.tsx
 * 
 * 3-Way Color Grading Wheel sub-component (Shadows, Midtones, Highlights).
 */

import React, { useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

export interface ColorWheelProps {
  label: string;
  value?: { hue?: number; saturation?: number; lift?: number };
  onChange: (val: { hue: number; saturation: number; lift: number }) => void;
  accentColor?: string;
}

export function ColorWheel({ label, value, onChange, accentColor }: ColorWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const hue = value?.hue ?? 0;
  const sat = value?.saturation ?? 0;
  const lift = value?.lift ?? 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons > 0) {
      updateFromPointer(e);
    }
  };

  const updateFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Saturation is percentage of radius
    const maxR = rect.width / 2;
    const newSat = Math.min(100, Math.round((dist / maxR) * 100));

    // Hue angle in degrees (-180 to 180)
    let newHue = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

    onChange({ hue: newHue, saturation: newSat, lift });
  };

  // Convert hue and saturation back to (X, Y) percentages for puck position
  const angleRad = (hue * Math.PI) / 180;
  const radiusPct = sat / 100;
  const puckX = 50 + Math.cos(angleRad) * radiusPct * 50;
  const puckY = 50 + Math.sin(angleRad) * radiusPct * 50;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let newHue = hue;
    let newSat = sat;

    if (e.key === 'ArrowLeft') {
      newHue = (hue - step + 360) % 360;
    } else if (e.key === 'ArrowRight') {
      newHue = (hue + step) % 360;
    } else if (e.key === 'ArrowUp') {
      newSat = Math.min(100, sat + step);
    } else if (e.key === 'ArrowDown') {
      newSat = Math.max(0, sat - step);
    }

    onChange({ hue: newHue, saturation: newSat, lift });
    scheduleSaveSnapshot();
  };

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-[#1e1e1e] rounded border border-[#3e3e3e] flex-1">
      <span className="text-[9px] font-bold tracking-wider uppercase text-white">{label}</span>

      {/* Circle Container */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label={`${label} Color Wheel`}
        aria-valuenow={hue}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuetext={`Hue: ${hue}°, Saturation: ${sat}%`}
        className="w-16 h-16 rounded-full relative cursor-crosshair border border-[#3e3e3e] shadow-[inset_0_0_6px_rgba(0,0,0,0.6)] select-none touch-none focus:outline-none focus:ring-1 focus:ring-amber-500"
        style={{
          backgroundColor: '#3a3a3a',
          background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)',
        }}
      >
        {/* Soft center overlay to make colors fade to white at center */}
        <div className="absolute inset-0 rounded-full bg-white opacity-40 mix-blend-overlay" />
        {/* Subtle radial shadow to simulate hardware wheels */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />

        {/* Center crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 border border-white/40 rounded-full pointer-events-none" />

        {/* Selected puck */}
        <div
          className="absolute w-2 h-2 bg-white border border-black rounded-full shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75"
          style={{
            left: `${puckX}%`,
            top: `${puckY}%`,
          }}
        />
      </div>

      {/* Hidden aria-live region to announce changes */}
      <div className="sr-only" aria-live="polite">
        {`${label} settings: Hue is ${hue} degrees, Saturation is ${sat}%, Lift is ${lift}%`}
      </div>

      {/* Info labels */}
      <div className="flex justify-between w-full text-[8px] text-[#a0a0a0] px-0.5 font-mono">
        <span>H: {hue}°</span>
        <span>S: {sat}%</span>
      </div>

      {/* Brightness/Lift Slider */}
      <div className="w-full space-y-1 mt-1 border-t border-[#3e3e3e]/30 pt-1">
        <div className="flex justify-between text-[8px] text-[#a0a0a0] font-mono px-0.5">
          <span>Lift</span>
          <span>{lift > 0 ? `+${lift}` : lift}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={lift}
          onChange={(e) => onChange({ hue, saturation: sat, lift: Number(e.target.value) })}
          onMouseUp={() => scheduleSaveSnapshot()}
          onDoubleClick={() => onChange({ hue, saturation: sat, lift: 0 })}
          title="Double-click to reset lift to 0"
          className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
        />
      </div>
    </div>
  );
}
