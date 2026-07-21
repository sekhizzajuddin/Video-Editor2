import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';
import { Wand2 } from 'lucide-react';

export const AiBackgroundRemovalFeature = ({ clip }: FeatureProps) => {
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const isEnabled = clip.aiBackground?.enabled ?? false;

  const toggleBgRemoval = (enabled: boolean) => {
    const existing = clip.aiBackground ?? { enabled: false, edgeBlur: 0, modelSelection: 0 };
    updateClip(clip.id, {
      aiBackground: { ...existing, enabled }
    });
    useEditorStore.getState().saveSnapshot('Toggle AI Background');
  };

  return (
    <div className="bg-[#1e1e1e] p-3 rounded border border-purple-500/30 mb-3 shadow-lg shadow-purple-900/20">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-purple-500/20 rounded">
          <Wand2 className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-semibold text-white">Magic Eraser (AI)</h4>
          <p className="text-[9px] text-[#a0a0a0]">Auto-detects and removes background</p>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer mt-3">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => toggleBgRemoval(e.target.checked)}
          className="rounded bg-[#2a2a2a] border-[#3e3e3e] text-purple-500 focus:ring-0 focus:ring-offset-0"
        />
        <span className="text-[11px] text-[#d0d0d0]">Enable AI Background Removal</span>
      </label>
    </div>
  );
};
