import React from 'react';
import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface TimelineFxFeatureProps {
  clip: TimelineClip;
}

export function TimelineFxFeature({ clip }: TimelineFxFeatureProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  if (!clip.fxSettings) return null;

  return (
    <div className="flex flex-col gap-3 bg-[#1e1e1e] rounded p-3 border border-rose-500/20">
      <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Timeline FX</p>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#a0a0a0]">Effect Type</label>
        <select
          value={clip.fxSettings.type}
          onChange={(e) => updateClip(clip.id, { fxSettings: { ...clip.fxSettings!, type: e.target.value as any } })}
          className="bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-rose-500"
        >
          <option value="vfx_breakdown">VFX Breakdown</option>
          <option value="bw_to_color">B&W to Color</option>
          <option value="glitch">Glitch</option>
          <option value="old_film">Old Film</option>
          <option value="vhs">VHS</option>
          <option value="cinematic_bars">Cinematic Bars</option>
          <option value="neon_glow">Neon Glow</option>
          <option value="rgb_split">RGB Split</option>
          <option value="pixelate">Pixelate</option>
          <option value="mirror">Mirror</option>
          <option value="zoom_blur">Zoom Blur</option>
          <option value="lens_flare">Lens Flare</option>
          <option value="night_vision">Night Vision</option>
          <option value="thermal">Thermal</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#a0a0a0]">Intensity — {clip.fxSettings.intensity ?? 100}%</label>
        <input type="range" min="0" max="100"
          value={clip.fxSettings.intensity ?? 100}
          onChange={(e) => updateClip(clip.id, { fxSettings: { ...clip.fxSettings!, intensity: Number(e.target.value) } })}
          className="flex-1 accent-rose-500"
        />
      </div>
    </div>
  );
}
