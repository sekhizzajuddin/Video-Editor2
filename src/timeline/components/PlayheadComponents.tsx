import React, { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { formatDetailedTooltipTime } from '../timelineUtils';
import { RULER_HEIGHT } from '../timelineConstants';

export function RulerPlayhead({ zoomLevel }: { zoomLevel: number }) {
  const currentTime = useEditorStore((state) => state.currentTime);
  return (
    <div
      className="absolute top-0 h-full z-10 pointer-events-none"
      style={{ left: `${currentTime * zoomLevel}px` }}
    >
      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -translate-x-1/2" />
    </div>
  );
}

export function WorkspacePlayhead({ zoomLevel }: { zoomLevel: number }) {
  const currentTime = useEditorStore((state) => state.currentTime);
  return (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: `${currentTime * zoomLevel}px` }}
    >
      <div className="w-px h-full bg-red-500" />
      <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full -translate-y-px" />
    </div>
  );
}

export function FloatingScrubTooltip({
  zoomLevel,
  isScrubbing,
}: {
  zoomLevel: number;
  isScrubbing: boolean;
}) {
  const currentTime = useEditorStore((state) => state.currentTime);
  const scrollLeft = useEditorStore((state) => state.scrollLeft);
  if (!isScrubbing) return null;
  return (
    <div
      className="absolute z-50 bg-[#141414]/95 text-amber-400 text-[10px] font-bold px-2 py-1 rounded border border-[#3e3e3e] shadow-2xl pointer-events-none -translate-x-1/2 flex items-center gap-1.5"
      style={{
        left: `${currentTime * zoomLevel - scrollLeft}px`,
        top: `${RULER_HEIGHT + 6}px`,
      }}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#141414] border-t border-l border-[#3e3e3e] rotate-45" />
      <span className="relative z-10 tabular-nums">
        {formatDetailedTooltipTime(currentTime)}
      </span>
    </div>
  );
}

export function PlaybackAutoScroller({
  zoomLevel,
  totalDuration,
  trackContainerRef,
}: {
  zoomLevel: number;
  totalDuration: number;
  trackContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    const container = trackContainerRef.current;
    if (!container) return;

    const visibleWidth = container.clientWidth;
    const totalMediaWidth = totalDuration * zoomLevel;
    if (totalMediaWidth <= visibleWidth) return;

    const playheadX = currentTime * zoomLevel;
    const thresholdX = container.scrollLeft + visibleWidth * 0.6;

    if (playheadX > thresholdX) {
      const targetScroll = Math.min(
        totalMediaWidth - visibleWidth,
        playheadX - visibleWidth * 0.4
      );
      container.scrollLeft = targetScroll;
      useEditorStore.getState().setScrollLeft(targetScroll);
    } else if (playheadX < container.scrollLeft) {
      const targetScroll = Math.max(0, playheadX - visibleWidth * 0.1);
      container.scrollLeft = targetScroll;
      useEditorStore.getState().setScrollLeft(targetScroll);
    }
  }, [currentTime, isPlaying, zoomLevel, totalDuration, trackContainerRef]);

  return null;
}
