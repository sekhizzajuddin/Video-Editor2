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
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[var(--theme-text-primary)]">Master Keyframes</span>
        <button
          onClick={handleToggleMasterKeyframe}
          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
            isOnKeyframe ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30' : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] border border-[var(--theme-border)] hover:border-blue-500/40'
          }`}
        >
          {!hasMasterKeyframes ? 'Start' : isOnKeyframe ? 'End/Remove' : 'Add'}
        </button>
      </div>
      {keyframeTimes.length > 0 && (
        <div className="space-y-1.5 pt-1">
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
              <div key={t} className={`flex items-center justify-between text-[10px] p-2 rounded-lg border border-[var(--theme-border)] ${isEnd && idx !== keyframeTimes.length - 1 ? 'bg-rose-500/10 border-rose-500/30 mb-2' : 'bg-[var(--theme-bg-subpanel)]'}`}>
                <span className="text-[var(--theme-text-muted)] font-mono font-medium">
                  {label} - {t.toFixed(2)}s
                </span>
                <button
                  onClick={() => deleteMasterKeyframe(selectedClip.id, t)}
                  className="text-[var(--theme-text-muted)] hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}