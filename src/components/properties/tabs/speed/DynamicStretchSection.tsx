import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Zap, RotateCcw, Trash2 } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { getSpeedFrameSegments } from '@/utils/speedRamp';

interface DynamicStretchSectionProps {
  selectedClip: TimelineClip;
}

export function DynamicStretchSection({ selectedClip }: DynamicStretchSectionProps) {
  const addSpeedFrame = useEditorStore((s) => s.addSpeedFrame);
  const removeSpeedFrame = useEditorStore((s) => s.removeSpeedFrame);
  const clearSpeedFrames = useEditorStore((s) => s.clearSpeedFrames);
  const selectedSpeedFrame = useEditorStore((s) => s.selectedSpeedFrame);
  const selectSpeedFrame = useEditorStore((s) => s.selectSpeedFrame);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);

  const media = useMemo(
    () => mediaLibrary.find((m) => m.id === selectedClip.mediaId),
    [mediaLibrary, selectedClip.mediaId]
  );

  const speedFrames = selectedClip.speedFrames || [];
  const hasSpeedFrames = speedFrames.length > 0;

  const segments = useMemo(() => {
    if (!hasSpeedFrames) return [];
    return getSpeedFrameSegments(selectedClip, media?.duration);
  }, [hasSpeedFrames, selectedClip, media?.duration]);

  if (!selectedClip) return null;

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--theme-text-primary)]">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Dynamic Speed Frames</span>
        </div>
        {hasSpeedFrames && (
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
            {speedFrames.length} {speedFrames.length === 1 ? 'Frame' : 'Frames'}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
        Add Speed Frames on the timeline clip to stretch or squeeze playback rates in real time without splitting the clip.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => addSpeedFrame(selectedClip.id)}
          className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
        >
          <Zap className="w-3.5 h-3.5 fill-black" />
          <span>+ Add Speed Frame</span>
        </button>

        {hasSpeedFrames && (
          <button
            onClick={() => clearSpeedFrames(selectedClip.id)}
            title="Reset all Speed Frames and restore uniform rate"
            className="py-1.5 px-2.5 text-xs font-medium rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Segments / Speeds Breakdown */}
      {hasSpeedFrames && (
        <div className="space-y-2 pt-1 border-t border-[var(--theme-border)]/40">
          <span className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
            Segment Rates
          </span>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {segments.map((seg) => (
              <div
                key={`prop-seg-${seg.index}`}
                className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-[var(--theme-border)]/50 font-mono"
              >
                <span className="text-[var(--theme-text-muted)] text-[10px]">
                  Segment {seg.index + 1} ({seg.startOffset.toFixed(1)}s – {seg.endOffset.toFixed(1)}s):
                </span>
                <span
                  className={`font-bold ${
                    seg.speed > 1.05
                      ? 'text-emerald-500'
                      : seg.speed < 0.95
                      ? 'text-purple-400'
                      : 'text-[var(--theme-text-primary)]'
                  }`}
                >
                  {seg.speed.toFixed(2)}x {seg.speed > 1.05 ? 'Fast' : seg.speed < 0.95 ? 'Slow' : '1.0x'}
                </span>
              </div>
            ))}
          </div>

          {/* Speed Frames List */}
          <div className="pt-2">
            <span className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
              Frame Markers
            </span>
            <div className="space-y-1 pt-1">
              {speedFrames.map((sf, idx) => {
                const isSelected =
                  selectedSpeedFrame?.clipId === selectedClip.id &&
                  selectedSpeedFrame?.frameId === sf.id;

                return (
                  <div
                    key={sf.id}
                    onClick={() => selectSpeedFrame(selectedClip.id, sf.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] ${
                      isSelected
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-500 font-semibold'
                        : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--theme-text-muted)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-pink-500" />
                      <span>
                        Frame #{idx + 1} at {sf.timelineOffset.toFixed(2)}s
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSpeedFrame(selectedClip.id, sf.id);
                      }}
                      className="p-1 hover:text-rose-500 rounded transition-colors"
                      title="Delete this Speed Frame"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* User Guide Card */}
      <div className="text-[10px] text-[var(--theme-text-muted)] bg-black/5 dark:bg-white/5 p-2 rounded-lg space-y-1 border border-[var(--theme-border)]/30">
        <div className="font-semibold text-[var(--theme-text-primary)]">How to use on timeline:</div>
        <div>• <strong>Drag glowing line</strong>: Stretch (slow-motion) or squeeze (fast-motion).</div>
        <div>• <strong>Drag Screw Head</strong>: Reposition the frame anchor within the clip.</div>
        <div>• <strong>Click ×</strong>: Remove Speed Frame and restore region to uniform rate.</div>
      </div>
    </div>
  );
}
