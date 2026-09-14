import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Gauge, Check, Repeat, X } from 'lucide-react';
import type { TimelineClip } from '@/types';

interface DynamicStretchSectionProps {
  selectedClip: TimelineClip;
}

export function DynamicStretchSection({ selectedClip }: DynamicStretchSectionProps) {
  const dynamicStretch = useEditorStore((s) => s.dynamicStretch);
  const startDynamicStretch = useEditorStore((s) => s.startDynamicStretch);
  const confirmDynamicStretchMark = useEditorStore((s) => s.confirmDynamicStretchMark);
  const toggleDynamicStretchLoop = useEditorStore((s) => s.toggleDynamicStretchLoop);
  const applyDynamicStretch = useEditorStore((s) => s.applyDynamicStretch);
  const cancelDynamicStretch = useEditorStore((s) => s.cancelDynamicStretch);
  const setDynamicStretchMaintainDuration = useEditorStore((s) => s.setDynamicStretchMaintainDuration);
  const isPlaying = useEditorStore((s) => s.isPlaying);

  const isClipInStretch = dynamicStretch?.isActive && dynamicStretch.clipId === selectedClip?.id;

  const speedRatio =
    isClipInStretch && dynamicStretch.originalRegionDuration > 0 && dynamicStretch.stretchedDuration > 0
      ? dynamicStretch.originalRegionDuration / dynamicStretch.stretchedDuration
      : 1;

  if (!selectedClip) return null;

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--theme-text-primary)]">
          <Gauge className="w-4 h-4 text-amber-500" />
          <span>Dynamic Speed Ramping</span>
        </div>
        {isClipInStretch && (
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
            {dynamicStretch.isConfirmed ? 'Stretch Mode' : 'Marking'}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
        Mark any region on this clip to squeeze (fast-forward) or extend (slow-motion) with perfect audio sync and zero export errors.
      </p>

      {isClipInStretch ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 bg-black/5 dark:bg-white/5 rounded-lg border border-[var(--theme-border)]/50">
            <span className="text-[var(--theme-text-muted)]">Current Region Speed:</span>
            <span className="font-bold text-amber-500 font-mono">
              {speedRatio.toFixed(2)}x {speedRatio > 1.05 ? '(Faster)' : speedRatio < 0.95 ? '(Slower)' : '(Normal)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {!dynamicStretch.isConfirmed ? (
              <>
                <button
                  onClick={toggleDynamicStretchLoop}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 transition-all ${
                    dynamicStretch.isLoopingRegion && isPlaying
                      ? 'bg-amber-500 text-black font-bold animate-pulse'
                      : 'bg-black/5 dark:bg-white/5 text-[var(--theme-text-primary)] hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>{dynamicStretch.isLoopingRegion && isPlaying ? 'Looping...' : 'Audition Loop'}</span>
                </button>
                <button
                  onClick={confirmDynamicStretchMark}
                  className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 shadow-sm transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Mark</span>
                </button>
              </>
            ) : (
              <button
                onClick={applyDynamicStretch}
                className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Dynamic Stretch</span>
              </button>
            )}

            <button
              onClick={cancelDynamicStretch}
              title="Cancel Stretch"
              className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => startDynamicStretch(selectedClip.id)}
          className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>Mark Region for Speed Ramp</span>
        </button>
      )}

      {/* Maintain Original Duration Toggle */}
      <label className="flex items-center gap-2 pt-1 text-[11px] text-[var(--theme-text-muted)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={dynamicStretch?.maintainDuration ?? true}
          onChange={(e) => setDynamicStretchMaintainDuration(e.target.checked)}
          className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
        />
        <span>Maintain original clip duration (compensate tail)</span>
      </label>
    </div>
  );
}
