import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { formatDetailedTooltipTime } from '../timelineUtils';
import { RULER_HEIGHT } from '../timelineConstants';

export function RulerPlayhead({ zoomLevel }: { zoomLevel: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Initial position
    if (containerRef.current) {
      containerRef.current.style.left = `${useEditorStore.getState().currentTime * zoomLevel}px`;
    }
    
    // Imperative subscription for high-frequency updates
    return useEditorStore.subscribe((state) => {
      if (containerRef.current) {
        containerRef.current.style.left = `${state.currentTime * zoomLevel}px`;
      }
    });
  }, [zoomLevel]);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 h-full z-10 pointer-events-none"
    >
      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -translate-x-1/2" />
    </div>
  );
}

export function WorkspacePlayhead({ zoomLevel }: { zoomLevel: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Initial position
    if (containerRef.current) {
      containerRef.current.style.left = `${useEditorStore.getState().currentTime * zoomLevel}px`;
    }
    
    // Imperative subscription for high-frequency updates
    return useEditorStore.subscribe((state) => {
      if (containerRef.current) {
        containerRef.current.style.left = `${state.currentTime * zoomLevel}px`;
      }
    });
  }, [zoomLevel]);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isScrubbing) return;
    
    const updateDOM = (state: any) => {
      if (containerRef.current && textRef.current) {
        containerRef.current.style.left = `${state.currentTime * zoomLevel - state.scrollLeft}px`;
        textRef.current.textContent = formatDetailedTooltipTime(state.currentTime);
      }
    };
    
    // Initial position
    updateDOM(useEditorStore.getState());
    
    // Imperative subscription
    return useEditorStore.subscribe(updateDOM);
  }, [zoomLevel, isScrubbing]);

  if (!isScrubbing) return null;
  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-[#141414]/95 text-amber-400 text-[10px] font-bold px-2 py-1 rounded border border-[#3e3e3e] shadow-2xl pointer-events-none -translate-x-1/2 flex items-center gap-1.5"
      style={{ top: `${RULER_HEIGHT + 6}px` }}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#141414] border-t border-l border-[#3e3e3e] rotate-45" />
      <span ref={textRef} className="relative z-10 tabular-nums"></span>
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
  const lastScrollRef = useRef<number>(0);
  const lastStoreSyncRef = useRef<number>(0);

  useEffect(() => {
    // We subscribe to the store manually rather than re-rendering this component
    // on every currentTime update.
    return useEditorStore.subscribe((state) => {
      if (!state.isPlaying) return;
      const container = trackContainerRef.current;
      if (!container) return;

      const visibleWidth = container.clientWidth;
      const totalMediaWidth = totalDuration * zoomLevel;
      if (totalMediaWidth <= visibleWidth) return;

      const playheadX = state.currentTime * zoomLevel;
      const thresholdX = container.scrollLeft + visibleWidth * 0.6;
      let targetScroll = -1;

      if (playheadX > thresholdX) {
        targetScroll = Math.min(
          totalMediaWidth - visibleWidth,
          playheadX - visibleWidth * 0.4
        );
      } else if (playheadX < container.scrollLeft) {
        targetScroll = Math.max(0, playheadX - visibleWidth * 0.1);
      }

      if (targetScroll !== -1) {
        // Only update if moved by >1px
        if (Math.abs(targetScroll - lastScrollRef.current) < 1) return;
        lastScrollRef.current = targetScroll;
        
        container.scrollLeft = targetScroll;
        
        // Sync to store at 10Hz (100ms) for persistence to avoid broadcast storm
        const now = performance.now();
        if (now - lastStoreSyncRef.current > 100) {
          useEditorStore.getState().setScrollLeft(targetScroll);
          lastStoreSyncRef.current = now;
        }
      }
    });
  }, [zoomLevel, totalDuration, trackContainerRef]);

  return null;
}
