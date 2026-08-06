import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

interface UseTimelineScrollDeps {
  trackContainerRef: React.RefObject<HTMLDivElement | null>;
  rulerContainerRef: React.RefObject<HTMLDivElement | null>;
  trackHeadersRef: React.RefObject<HTMLDivElement | null>;
}

export function useTimelineScroll({
  trackContainerRef,
  rulerContainerRef,
  trackHeadersRef,
}: UseTimelineScrollDeps) {
  
  // P1 FIX: rAF-throttle the scroll handler so the Zustand store is updated at most
  // once per animation frame (~16ms) instead of on every raw scroll event.
  const scrollRafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!trackContainerRef.current) return;

    // CRITICAL: Sync the ruler's scrollLeft IMMEDIATELY (synchronous, no RAF).
    // The ruler is overflow-hidden so writing scrollLeft causes no browser layout.
    // Any delay here means handleRulerMouseDown reads a stale scrollLeft value
    // and calculates the wrong time — causing the "click at 5s → jumps to 3s" bug.
    const target = trackContainerRef.current;
    if (rulerContainerRef.current && rulerContainerRef.current.scrollLeft !== target.scrollLeft) {
      rulerContainerRef.current.scrollLeft = target.scrollLeft;
    }
    // Sync vertical scroll to headers immediately too
    if (trackHeadersRef.current && trackHeadersRef.current.scrollTop !== target.scrollTop) {
      trackHeadersRef.current.scrollTop = target.scrollTop;
    }

    // Zustand store write is RAF-throttled: it broadcasts to all subscribers,
    // so writing on every scroll event would cause 60+ re-renders per second.
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const t = trackContainerRef.current;
      if (!t) return;
      useEditorStore.getState().setScrollLeft(t.scrollLeft);
    });
  }, [trackContainerRef, rulerContainerRef, trackHeadersRef]);


  const handleHeadersScroll = useCallback(() => {
    if (trackHeadersRef.current && trackContainerRef.current) {
      const target = trackHeadersRef.current;
      if (trackContainerRef.current.scrollTop !== target.scrollTop) {
        trackContainerRef.current.scrollTop = target.scrollTop;
      }
    }
  }, [trackHeadersRef, trackContainerRef]);

  // Sync scroll positions when store's scrollLeft changes externally
  useEffect(() => {
    // FIX: Track previous value so we only sync DOM when scrollLeft actually changed,
    // not on every unrelated store mutation (prevents unnecessary DOM writes).
    let prevScrollLeft = useEditorStore.getState().scrollLeft;
    const unsubscribe = useEditorStore.subscribe(
      (state) => {
        const scrollLeft = state.scrollLeft;
        if (scrollLeft === prevScrollLeft) return; // skip if unchanged
        prevScrollLeft = scrollLeft;
        if (rulerContainerRef.current && rulerContainerRef.current.scrollLeft !== scrollLeft) {
          rulerContainerRef.current.scrollLeft = scrollLeft;
        }
        if (trackContainerRef.current && trackContainerRef.current.scrollLeft !== scrollLeft) {
          trackContainerRef.current.scrollLeft = scrollLeft;
        }
      }
    );
    return unsubscribe;
  }, [rulerContainerRef, trackContainerRef]);


  // Native wheel pinch-to-zoom gesture listener
  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom / Ctrl+Scroll → zoom timeline
        e.preventDefault();
        const store = useEditorStore.getState();
        const currentZoom = store.zoomLevel;
        // FIX: Use exponential scaling for smooth proportional zoom without decimals
        const zoomFactor = Math.exp(-e.deltaY * 0.005); // Smooth scaling factor
        let newZoom = currentZoom * zoomFactor;
        
        // Remove decimal glitching
        newZoom = Math.round(newZoom);
        
        // Clamp between 5 and 200 as requested
        newZoom = Math.min(Math.max(newZoom, 5), 200);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Calculate the exact time under the mouse cursor right now
        const timeUnderCursor = (store.scrollLeft + mouseX) / currentZoom;
        
        // Calculate the new scrollLeft so that timeUnderCursor stays at mouseX
        const newScrollLeft = Math.max(0, timeUnderCursor * newZoom - mouseX);

        // Preemptively update the inner container width to prevent the DOM
        // from clamping the new scrollLeft before React can render the new zoom
        const innerDiv = el.firstElementChild as HTMLElement;
        if (innerDiv) {
          const newWidth = (store.totalDuration + 30) * newZoom;
          innerDiv.style.width = `${newWidth}px`;
        }

        store.setZoomLevel(newZoom);
        store.setScrollLeft(newScrollLeft);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [trackContainerRef]);

  return {
    handleScroll,
    handleHeadersScroll,
  };
}
