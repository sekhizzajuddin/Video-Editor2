/**
 * playbackClock.ts
 *
 * A tiny, React-free source of truth for the live playhead position.
 *
 * Why this exists
 * ---------------
 * The preview RAF loop advances the playhead every animation frame (~60 Hz) but
 * could only publish it by writing to the Zustand store. Writing at 60 Hz
 * re-renders every React component that selects `currentTime`, so the loop
 * throttled its store writes to ~30 Hz instead. That created two problems:
 *
 *  1. Even 30 Hz store writes re-render large panels 33 times a second, starving
 *     the compositor of main-thread time. (Addressed by usePlaybackTime.)
 *
 *  2. Consumers that need an *accurate* time — above all the media-sync PLL in
 *     useMediaPlayback — were reading a staircase signal that only moved every
 *     ~30 ms. Between store writes the measured "drift" between a video element's
 *     currentTime and the timeline time is pure quantisation noise of up to 30 ms,
 *     which is larger than the 25 ms PLL threshold. The controller therefore
 *     modulated playbackRate against phantom drift, producing audible wobble and
 *     visible micro-stutter that got worse with each extra synced track.
 *
 * The clock decouples those concerns: it is updated every frame with the exact
 * position and read synchronously by anything on the render/sync path, while the
 * store keeps a lower-rate mirror for React.
 *
 * Invariants
 * ----------
 *  - `editorStore.seek()` always writes here first, so the clock is never behind
 *    the store.
 *  - While paused the clock and `store.currentTime` are identical.
 *  - While playing the clock leads the store by at most one store-throttle window.
 */

type ClockListener = (time: number) => void;

let currentTime = 0;
const listeners = new Set<ClockListener>();

/** Exact live playhead position in seconds. Safe to call at 60 Hz. */
export function getPlaybackTime(): number {
  return currentTime;
}

/**
 * Publish a new playhead position. Called by the preview RAF loop every frame and
 * by `seek()` for user-driven jumps.
 */
export function setPlaybackTime(time: number): void {
  const t = time < 0 ? 0 : time;
  if (t === currentTime) return;
  currentTime = t;
  if (listeners.size === 0) return;
  for (const l of listeners) {
    try {
      l(t);
    } catch {
      /* a broken listener must never break playback */
    }
  }
}

/** Subscribe to every clock update. Returns an unsubscribe function. */
export function subscribePlaybackTime(listener: ClockListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
