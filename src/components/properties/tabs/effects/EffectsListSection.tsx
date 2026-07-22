import type { TimelineClip } from '@/types';

interface EffectsListSectionProps {
  selectedClip: TimelineClip;
}

export function EffectsListSection({ selectedClip }: EffectsListSectionProps) {
  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
      <h4 className="text-[11px] font-semibold text-white mb-2">Active Effects</h4>
      {selectedClip.effects && selectedClip.effects.length > 0 ? (
        <div className="space-y-2">
          {selectedClip.effects.map((effect: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between bg-[#1e1e1e] p-2 rounded">
              <span className="text-[10px] text-white">{effect.name || 'Effect'}</span>
              <button className="text-red-400 hover:text-red-300 text-[10px]">Remove</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[#a0a0a0]">No effects applied</p>
      )}
    </div>
  );
}