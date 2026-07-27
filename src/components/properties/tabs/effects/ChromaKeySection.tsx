import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import React from 'react';

interface ChromaKeySectionProps {
  selectedClip: TimelineClip;
}

export function ChromaKeySection({ selectedClip }: ChromaKeySectionProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  const saveSnapshot = useEditorStore((state) => state.saveSnapshot);

  const chromaKey = selectedClip.chromaKey || {
    enabled: false,
    color: '#00ff00',
    threshold: 40,
    softness: 20,
    spillSuppression: 50,
  };

  const update = (patch: Partial<NonNullable<TimelineClip['chromaKey']>>) => {
    updateClip(selectedClip.id, {
      chromaKey: {
        ...chromaKey,
        ...patch,
      },
    });
    saveSnapshot();
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
      <h4 className="text-[11px] font-semibold text-white mb-3">Chroma Key (Green Screen)</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#a0a0a0]">Enabled</span>
          <button
            onClick={() => update({ enabled: !chromaKey.enabled })}
            className={`w-8 h-4 rounded-full transition-colors relative ${chromaKey.enabled ? 'bg-green-500' : 'bg-[#3e3e3e]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${chromaKey.enabled ? 'left-[17px]' : 'left-[1px]'}`} />
          </button>
        </div>
        
        {chromaKey.enabled && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0a0]">Key Color:</span>
              <input
                type="color"
                value={chromaKey.color || '#00ff00'}
                onChange={(e) => update({ color: e.target.value })}
                className="w-10 h-6 rounded cursor-pointer bg-transparent border border-[#444]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#a0a0a0] mb-1">
                <span>Threshold</span>
                <span>{chromaKey.threshold || 40}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={chromaKey.threshold || 40}
                onChange={(e) => update({ threshold: Number(e.target.value) })}
                className="w-full accent-green-500 bg-[#1a1a1a] h-1 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#a0a0a0] mb-1">
                <span>Edge Softness</span>
                <span>{chromaKey.softness || 20}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={chromaKey.softness || 20}
                onChange={(e) => update({ softness: Number(e.target.value) })}
                className="w-full accent-green-500 bg-[#1a1a1a] h-1 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#a0a0a0] mb-1">
                <span>Spill Suppression</span>
                <span>{chromaKey.spillSuppression ?? 50}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={chromaKey.spillSuppression ?? 50}
                onChange={(e) => update({ spillSuppression: Number(e.target.value) })}
                className="w-full accent-green-500 bg-[#1a1a1a] h-1 rounded cursor-pointer"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}