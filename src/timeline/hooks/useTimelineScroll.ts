import { useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

interface UseTimelineScrollDeps {
  trackContainerRef: React.RefObject<HTMLDivElement | null>;
  rulerContainerRef: React.RefObject<HTMLDivElement | null>;
  trackHeadersRef: React.RefObject<HTMLDivElement | null>;
  scrollStoreThrottleRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  scrollLeft: number;
  zoomLevel: number;
}

export function useTimelineScroll({
  trackContainerRef,
  rulerContainerRef,
  trackHeadersRef,
  scrollStoreThrottleRef,
  scrollLeft,
  zoomLevel,
}: UseTimelineScrollDeps) {
  
  const setScrollLeftThrottled = useCallback((value: number) => {
    if (scrollStoreThrottleRef.current) return;
    scrollStoreThrottleRef.current = setTimeout(() => {
      useEditorStore.getState().setScrollLeft(value);
      scrollStoreThrottleRef.current = null;
    }, 33); // ~30fps
  }, [scrollStoreThrottleRef]);

  const handleScroll = useCallback(() => {
    if (trackContainerRef.current) {
      const target = trackContainerRef.current;
      // Sync ruler immediately via DOM
      if (rulerContainerRef.current && rulerContainerRef.current.scrollLeft !== target.scrollLeft) {
        rulerContainerRef.current.scrollLeft = target.scrollLeft;
      }
      // Throttle store updates; DOM position updates immediately
      setScrollLeftThrottled(target.scrollLeft);
      // Sync vertical scroll to headers
      if (trackHeadersRef.current && trackHeadersRef.current.scrollTop !== target.scrollTop) {
        trackHeadersRef.current.scrollTop = target.scrollTop;
      }
    }
  }, [setScrollLeftThrottled, trackContainerRef, rulerContainerRef, trackHeadersRef]);

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
    if (rulerContainerRef.current && rulerContainerRef.current.scrollLeft !== scrollLeft) {
      rulerContainerRef.current.scrollLeft = scrollLeft;
    }
    if (trackContainerRef.current && trackContainerRef.current.scrollLeft !== scrollLeft) {
      trackContainerRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft, rulerContainerRef, trackContainerRef]);

  // Native wheel pinch-to-zoom gesture listener
  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom
        e.preventDefault();
        const store = useEditorStore.getState();
        const currentZoom = store.zoomLevel;
        const zoomDelta = e.deltaY > 0 ? -10 : 10;
        const newZoom = Math.min(Math.max(currentZoom + zoomDelta, 20), 400);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Calculate the exact time under the mouse cursor right now
        const timeUnderCursor = (store.scrollLeft + mouseX) / currentZoom;
        
        // Calculate the new scrollLeft so that timeUnderCursor stays at mouseX
        const newScrollLeft = Math.max(0, timeUnderCursor * newZoom - mouseX);

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
    setScrollLeftThrottled,
  };
}
