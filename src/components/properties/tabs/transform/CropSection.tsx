import React from 'react';
import type { TimelineClip } from '@/types';

interface CropSectionProps {
  clip: TimelineClip;
  getPropVal: (base: number, propKey: string) => number;
  setPropVal: (propKey: string, value: number, baseUpdateObj: any) => void;
}

export function CropSection({ clip, getPropVal, setPropVal }: CropSectionProps) {
  return (
    <div className="space-y-4">
      {['left', 'right', 'top', 'bottom'].map((edge) => {
        const currentCrop = clip.crop || { top: 0, bottom: 0, left: 0, right: 0 };
        const propKey = `crop.${edge}`;
        const value = getPropVal(currentCrop[edge as keyof typeof currentCrop], propKey);
        return (
          <div key={edge} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white capitalize">{edge}</span>
              <span className="text-xs text-amber-500">{Math.round(value)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              value={value}
              onChange={(e) => {
                const newVal = Number(e.target.value);
                const proposedCrop = { ...currentCrop, [edge]: newVal };
                setPropVal(propKey, newVal, { crop: proposedCrop });
              }}
              className="w-full accent-amber-500"
            />
          </div>
        );
      })}
    </div>
  );
}
