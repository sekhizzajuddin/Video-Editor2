import React from 'react';
import type { TimelineClip } from '@/types';

interface BlendSectionProps {
  clip: TimelineClip;
  updateClip: (id: string, updates: any) => void;
}

export function BlendSection({ clip, updateClip }: BlendSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider">Blend Mode</label>
        <select
          value={clip.transform.blendMode || 'normal'}
          onChange={(e) => updateClip(clip.id, { transform: { ...clip.transform, blendMode: e.target.value } })}
          className="w-full bg-[var(--theme-bg-subpanel)] text-white border border-[var(--theme-border)] rounded p-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="normal">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="darken">Darken</option>
          <option value="lighten">Lighten</option>
          <option value="color-dodge">Color Dodge</option>
          <option value="color-burn">Color Burn</option>
          <option value="hard-light">Hard Light</option>
          <option value="soft-light">Soft Light</option>
          <option value="difference">Difference</option>
          <option value="exclusion">Exclusion</option>
        </select>
      </div>
    </div>
  );
}
