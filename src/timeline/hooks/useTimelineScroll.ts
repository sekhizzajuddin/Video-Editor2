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
    // Any delay here means handleRulerPointerDown reads a stale scrollLeft value
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

  // CRITICAL FIX: Also attach a native 'scroll' listener to trackContainerRef.
  // React's onScroll prop only fires for user-initiated scrolls that go through
  // React's synthetic event system. However, PlaybackAutoScroller does:
  //   container.scrollLeft = value   (direct DOM write)
  // This triggers the native 'scroll' event but NOT React's onScroll, so the
  // ruler was never synced after auto-scroll during playback. The result: ruler
  // scrollLeft stays at its old value, making handleRulerPointerDown read a stale
  // offset and produce a wrong playhead time on the next click.
  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    const nativeScrollHandler = () => {
      const ruler = rulerContainerRef.current;
      if (ruler && ruler.scrollLeft !== el.scrollLeft) {
        ruler.scrollLeft = el.scrollLeft;
      }
      const headers = trackHeadersRef.current;
      if (headers && headers.scrollTop !== el.scrollTop) {
        headers.scrollTop = el.scrollTop;
      }
    };

    el.addEventListener('scroll', nativeScrollHandler, { passive: true });
    return () => el.removeEventListener('scroll', nativeScrollHandler);
  }, [trackContainerRef, rulerContainerRef, trackHeadersRef]);


  // Native wheel pinch-to-zoom gesture listener
  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    let wheelRafId: number | null = null;
    let pendingZoom: number | null = null;
    let pendingScrollLeft: number | null = null;
    let pendingInnerWidth: number | null = null;
    let pendingInnerDiv: HTMLElement | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const store = useEditorStore.getState();
        const currentZoom = pendingZoom ?? store.zoomLevel;
        const zoomFactor = Math.exp(-e.deltaY * 0.005);
        let newZoom = currentZoom * zoomFactor;
        newZoom = Math.round(newZoom);
        newZoom = Math.min(Math.max(newZoom, 0.05), 400);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const timeUnderCursor = ((pendingScrollLeft ?? store.scrollLeft) + mouseX) / currentZoom;
        const newScrollLeft = Math.max(0, timeUnderCursor * newZoom - mouseX);

        pendingZoom = newZoom;
        pendingScrollLeft = newScrollLeft;

        // Preemptively update inner container width
        const innerDiv = el.firstElementChild as HTMLElement;
        if (innerDiv) {
          pendingInnerDiv = innerDiv;
          pendingInnerWidth = (store.totalDuration + 30) * newZoom;
        }

        if (wheelRafId === null) {
          wheelRafId = requestAnimationFrame(() => {
            wheelRafId = null;
            if (pendingInnerDiv && pendingInnerWidth !== null) {
              pendingInnerDiv.style.width = `${pendingInnerWidth}px`;
            }
            // Batch both updates into a single set() call
            useEditorStore.setState({
              ...(pendingZoom !== null ? { zoomLevel: pendingZoom } : {}),
              ...(pendingScrollLeft !== null ? { scrollLeft: pendingScrollLeft } : {}),
            });
            pendingZoom = null;
            pendingScrollLeft = null;
            pendingInnerDiv = null;
            pendingInnerWidth = null;
          });
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (wheelRafId !== null) cancelAnimationFrame(wheelRafId);
    };
  }, [trackContainerRef]);

  return {
    handleScroll,
    handleHeadersScroll,
  };
}
