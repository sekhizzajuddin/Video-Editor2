import type { Clip } from '@/types';

interface ChromaKeySectionProps {
  selectedClip: Clip;
}

export function ChromaKeySection({ selectedClip }: ChromaKeySectionProps) {
  if (!selectedClip.chromaKey) return null;

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
      <h4 className="text-[11px] font-semibold text-white mb-2">Chroma Key</h4>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#a0a0a0]">Enabled</span>
          <button
            onClick={() => {}}
            className={`w-8 h-4 rounded-full transition-colors relative ${selectedClip.chromaKey.enabled ? 'bg-green-500' : 'bg-[#3e3e3e]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${selectedClip.chromaKey.enabled ? 'left-[17px]' : 'left-[1px]'}`} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a0a0a0]">Color:</span>
          <input
            type="color"
            value={selectedClip.chromaKey.color || '#00ff00'}
            onChange={() => {}}
            className="w-8 h-6 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}