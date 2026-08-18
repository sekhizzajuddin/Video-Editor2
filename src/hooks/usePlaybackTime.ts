// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * usePlaybackTime.ts
 *
 * PERF: Decouples heavy React components from the 30 Hz `currentTime` store writes
 * that the playback RAF loop performs.
 *
 * The problem this solves:
 *   During playback the preview RAF loop calls `seek(newTime)` roughly every 30 ms.
 *   Any component that selects `s.currentTime` therefore re-renders ~33 times a
 *   second. Several of those components are enormous (PropertiesPanel ~7k lines,
 *   PreviewCanvasOverlay ~2k lines, MediaPanel ~3.5k lines). Each re-render costs
 *   5-40 ms of main-thread time, which is the *same* main thread the canvas
 *   compositor and the media-sync RAF loop run on. With one clip it usually fits
 *   inside the frame budget (playback looks smooth); with several tracks it does
 *   not, and frames get starved — exactly the "sometimes smooth, mostly lagging"
 *   symptom.
 *
 * The fix:
 *   Subscribe imperatively to the store and only push a new React value at a
 *   bounded rate while playing. When paused or scrubbing we pass the value through
 *   immediately so editing stays frame-accurate and responsive.
 *
 * Handlers that need an exact time should keep reading
 * `useEditorStore.getState().currentTime` — that is always exact.
 */

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';

/**
 * Returns `currentTime`, throttled to at most `hz` updates per second while
 * playback is running. Exact and immediate while paused/scrubbing.
 */
export function usePlaybackTime(hz: number = 10): number {
  const [time, setTime] = useState(() => useEditorStore.getState().currentTime);

  // Keep the latest emitted value in a ref so the subscriber can dedupe without
  // re-subscribing whenever React state changes.
  const emittedRef = useRef(time);

  useEffect(() => {
    const minInterval = 1000 / Math.max(1, hz);
    let lastEmit = 0;
    let pending: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const emit = (value: number) => {
      lastEmit = performance.now();
      if (emittedRef.current === value) return;
      emittedRef.current = value;
      setTime(value);
    };

    const flush = () => {
      timer = null;
      if (pending === null) return;
      const value = pending;
      pending = null;
      emit(value);
    };

    const unsub = useEditorStore.subscribe((state) => {
      const t = state.currentTime;

      // Paused / scrubbing: the user is driving the playhead directly, so the
      // value must be exact and land on the very next React render.
      if (!state.isPlaying) {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        pending = null;
        emit(t);
        return;
      }

      const now = performance.now();
      const elapsed = now - lastEmit;
      if (elapsed >= minInterval) {
        pending = null;
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        emit(t);
      } else {
        // Coalesce: remember the newest value and emit it when the window opens.
        // This guarantees the component still lands on the final time when
        // playback stops between ticks.
        pending = t;
        if (timer === null) timer = setTimeout(flush, minInterval - elapsed);
      }
    });

    return () => {
      unsub();
      if (timer !== null) clearTimeout(timer);
    };
  }, [hz]);

  return time;
}

/**
 * Returns a coarse, quantised playhead position intended for effects that only
 * need to know "roughly where are we" — media pool residency, proximity
 * preloading, etc.
 *
 * While playing it changes at most once per `playingStep` seconds (default 1 s);
 * while paused it changes at most once per `pausedStep` seconds (default 0.25 s).
 * Because the returned value only changes when the bucket changes, the host
 * component re-renders ~1×/second during playback instead of ~33×.
 */
export function useTimeBucket(playingStep: number = 1, pausedStep: number = 0.25): number {
  const compute = (t: number, playing: boolean) =>
    playing
      ? Math.floor(t / playingStep) * playingStep
      : Math.round(t / pausedStep) * pausedStep;

  const [bucket, setBucket] = useState(() => {
    const s = useEditorStore.getState();
    return compute(s.currentTime, s.isPlaying);
  });

  const bucketRef = useRef(bucket);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      const next = compute(state.currentTime, state.isPlaying);
      if (next === bucketRef.current) return;
      bucketRef.current = next;
      setBucket(next);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingStep, pausedStep]);

  return bucket;
}
