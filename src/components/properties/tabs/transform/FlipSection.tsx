import React from 'react';
import type { TimelineClip } from '@/types';

interface FlipSectionProps {
  clip: TimelineClip;
  updateClip: (id: string, updates: any) => void;
}

export function FlipSection({ clip, updateClip }: FlipSectionProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => {
          const cur = clip.transform.flipH ?? false;
          updateClip(clip.id, { transform: { ...clip.transform, flipH: !cur } });
        }}
        className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
          clip.transform.flipH ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white'
        }`}
      >
        Flip Horizontal
      </button>
      <button
        onClick={() => {
          const cur = clip.transform.flipV ?? false;
          updateClip(clip.id, { transform: { ...clip.transform, flipV: !cur } });
        }}
        className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
          clip.transform.flipV ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white'
        }`}
      >
        Flip Vertical
      </button>
    </div>
  );
}
