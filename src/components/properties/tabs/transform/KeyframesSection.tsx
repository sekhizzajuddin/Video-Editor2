import { Trash2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, ClipAnimations } from '@/types';

interface KeyframesSectionProps {
  selectedClip: TimelineClip;
  localTime: number;
  animations: ClipAnimations;
  hasMasterKeyframes: boolean;
  isOnKeyframe: boolean;
  keyframeTimes: number[];
  handleToggleMasterKeyframe: () => void;
  deleteMasterKeyframe: (clipId: string, time: number) => void;
}

export function KeyframesSection({
  selectedClip,
  animations,
  keyframeTimes,
  hasMasterKeyframes,
  isOnKeyframe,
  handleToggleMasterKeyframe,
  deleteMasterKeyframe,
}: KeyframesSectionProps) {
  return (
    <div className="bg-popover rounded border border-border p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">Master Keyframes</span>
        <button
          onClick={handleToggleMasterKeyframe}
          className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${
            isOnKeyframe ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-accent text-white hover:bg-accent'
          }`}
        >
          {!hasMasterKeyframes ? 'Start' : isOnKeyframe ? 'End/Remove' : 'Add'}
        </button>
      </div>
      {keyframeTimes.length > 0 && (
        <div className="space-y-1">
          {keyframeTimes.map((t: any, idx: number) => {
            const kf = animations['transform.x']?.find((k: any) => Math.abs(k.time - t) < 0.05);
            const prevKf = idx > 0 ? animations['transform.x']?.find((k: any) => Math.abs(k.time - keyframeTimes[idx - 1]) < 0.05) : null;

            const isStart = idx === 0 || prevKf?.holdNext;
            const isEnd = idx === keyframeTimes.length - 1 || kf?.holdNext;

            let label = 'Point';
            if (isStart && isEnd) label = 'Single';
            else if (isStart) label = 'Start';
            else if (isEnd) label = 'End';

            return (
              <div key={t} className={`flex items-center justify-between text-[10px] p-1.5 rounded ${isEnd && idx !== keyframeTimes.length - 1 ? 'bg-[#2a1e1e] border border-red-500/20 mb-2' : 'bg-card'}`}>
                <span className="text-muted-foreground">
                  {label} - {t.toFixed(2)}s
                </span>
                <button
                  onClick={() => deleteMasterKeyframe(selectedClip.id, t)}
                  className="text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}