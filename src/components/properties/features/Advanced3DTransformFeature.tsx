import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';

export const Advanced3DTransformFeature = ({ clip }: FeatureProps) => {
  const updateClip = useEditorStore((state) => state.updateClip);
  const transform = clip.transform || {};

  const handleFlip = (axis: 'flipH' | 'flipV') => {
    updateClip(clip.id, {
      transform: { ...transform, [axis]: !transform[axis] }
    });
    useEditorStore.getState().saveSnapshot();
  };

  return (
    <div className="bg-[#1e1e1e] border border-[#3e3e3e]/50 rounded p-2.5 space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white uppercase tracking-wider text-[#a0a0a0]">Flip / Mirror</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleFlip('flipH')}
          className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
            transform.flipH ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white hover:bg-[#4a4a4a]'
          }`}
        >
          Horizontal
        </button>
        <button
          onClick={() => handleFlip('flipV')}
          className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
            transform.flipV ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white hover:bg-[#4a4a4a]'
          }`}
        >
          Vertical
        </button>
      </div>
    </div>
  );
};
