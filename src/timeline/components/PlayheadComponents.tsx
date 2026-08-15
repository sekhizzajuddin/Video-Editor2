import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { getPlaybackTime, subscribePlaybackTime } from '@/utils/playbackClock';
import { formatDetailedTooltipTime } from '../timelineUtils';
import { RULER_HEIGHT } from '../timelineConstants';

export function RulerPlayhead({ zoomLevel }: { zoomLevel: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Imperative, render-free positioning driven by the playback clock.
    // The store's `currentTime` is only a ~10Hz mirror during playback, so
    // subscribing to it made the playhead visibly step; the clock is updated every
    // animation frame with the exact position.
    const paint = (t: number) => {
      if (containerRef.current) {
        containerRef.current.style.left = `${t * zoomLevel}px`;
      }
    };
    paint(getPlaybackTime());
    return subscribePlaybackTime(paint);
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
    // Imperative, render-free positioning driven by the playback clock.
    // The store's `currentTime` is only a ~10Hz mirror during playback, so
    // subscribing to it made the playhead visibly step; the clock is updated every
    // animation frame with the exact position.
    const paint = (t: number) => {
      if (containerRef.current) {
        containerRef.current.style.left = `${t * zoomLevel}px`;
      }
    };
    paint(getPlaybackTime());
    return subscribePlaybackTime(paint);
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
  trackContainerRef,
}: {
  zoomLevel: number;
  isScrubbing: boolean;
  trackContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isScrubbing) return;
    
    const updateDOM = (state: any) => {
      if (containerRef.current && textRef.current) {
        // FIX: Read scrollLeft directly from trackContainerRef (the actual
        // scrollable element). The ruler uses overflow-hidden so its
        // scrollLeft is unreliable. trackContainerRef always holds the
        // true live scroll position.
        const liveScrollLeft = trackContainerRef.current?.scrollLeft ?? state.scrollLeft;
        // Exact position from the playback clock (the store lags during playback).
        const t = getPlaybackTime();
        containerRef.current.style.left = `${t * zoomLevel - liveScrollLeft}px`;
        textRef.current.textContent = formatDetailedTooltipTime(t);
      }
    };
    
    // Initial position
    updateDOM(useEditorStore.getState());
    
    // Imperative subscription
    return useEditorStore.subscribe(updateDOM);
  }, [zoomLevel, isScrubbing, trackContainerRef]);

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
  const lastDomScrollRef = useRef<number>(0);  // throttle DOM scroll writes to ~30Hz
  const lastStoreWriteRef = useRef<number>(0); // throttle Zustand store writes to ~10Hz

  useEffect(() => {
    // Driven by the playback clock rather than the store so auto-scroll stays
    // smooth now that store writes are throttled to ~10Hz during playback.
    return subscribePlaybackTime(() => {
      // Auto-scroll ONLY during active playback. During scrubbing the user
      // has explicitly scrolled the timeline to the position they want to seek
      // to — firing here causes a scroll fight: the old currentTime triggers a
      // scroll BACK to the previous playhead area before seek() runs with the
      // new time, making the timeline jump to a completely wrong position.
      if (!useEditorStore.getState().isPlaying) return;
      const container = trackContainerRef.current;
      if (!container) return;

      const visibleWidth = container.clientWidth;
      const totalMediaWidth = totalDuration * zoomLevel;
      if (totalMediaWidth <= visibleWidth) return;

      const playheadX = getPlaybackTime() * zoomLevel;
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

      if (targetScroll === -1) return;
      // Skip tiny sub-pixel scrolls
      if (Math.abs(targetScroll - lastScrollRef.current) < 1) return;
      lastScrollRef.current = targetScroll;

      const now = performance.now();

      // Throttle DOM scroll updates to ~30 Hz (33ms) to avoid layout thrashing
      if (now - lastDomScrollRef.current < 33) return;
      lastDomScrollRef.current = now;
      container.scrollLeft = targetScroll;

      // Throttle Zustand store writes to ~10 Hz (100ms) to avoid broadcast storms
      if (now - lastStoreWriteRef.current > 100) {
        lastStoreWriteRef.current = now;
        useEditorStore.getState().setScrollLeft(targetScroll);
      }
    });
  }, [zoomLevel, totalDuration, trackContainerRef]);

  return null;
}
