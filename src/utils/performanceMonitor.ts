/**
 * performanceMonitor.ts
 *
 * Lightweight rolling-FPS tracker. Watches the actual rAF tick rate and
 * publishes a "slow frame" signal when the rolling average drops below a
 * threshold for a sustained window. Consumers (render engine, media pool)
 * subscribe to this signal and downgrade their work to keep the UI at 60fps.
 *
 * Design choices:
 *   - Pure-singleton; no React. Runs as a side effect on first import.
 *   - Emits a custom DOM event 'procut-perf-downgrade' / 'procut-perf-recover'
 *     so any consumer can listen without importing this module.
 *   - Rolling window of 60 frames (~1 second at 60fps). Threshold = 50fps.
 *   - When sustained slow frames > 1.5s, downgrade. Recovers after 2s of 56fps+.
 */

type Listener = (state: PerfState) => void;

export interface PerfState {
  fps: number;
  isSlow: boolean;
  downgraded: boolean;
}

const ROLLING_WINDOW = 60;
const SLOW_FPS = 50;
const SLOW_DURATION_MS = 1500;
const RECOVER_FPS = 56;
const RECOVER_DURATION_MS = 2000;

let frameTimes: number[] = [];
let lastTickAt = 0;
let slowSince: number | null = null;
let recoverSince: number | null = null;
let downgraded = false;
let rafId: number | null = null;
const listeners = new Set<Listener>();

function emit() {
  const fps = computeFps();
  const state: PerfState = { fps, isSlow: fps < SLOW_FPS, downgraded };
  for (const l of listeners) l(state);
  if (state.isSlow && downgraded === false) {
    window.dispatchEvent(new CustomEvent('procut-perf-downgrade', { detail: state }));
  } else if (!state.isSlow && downgraded === true && fps >= RECOVER_FPS) {
    window.dispatchEvent(new CustomEvent('procut-perf-recover', { detail: state }));
  }
}

function computeFps(): number {
  if (frameTimes.length < 2) return 60;
  const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
  if (span <= 0) return 60;
  return Math.round((frameTimes.length - 1) / (span / 1000));
}

function tick(now: number) {
  if (lastTickAt > 0) {
    frameTimes.push(now);
    while (frameTimes.length > ROLLING_WINDOW) frameTimes.shift();
  }
  lastTickAt = now;

  // Update slow/recover tracking
  const fps = computeFps();
  if (fps < SLOW_FPS) {
    if (slowSince === null) slowSince = now;
    recoverSince = null;
    if (!downgraded && now - slowSince > SLOW_DURATION_MS) {
      downgraded = true;
      window.dispatchEvent(new CustomEvent('procut-perf-downgrade', { detail: { fps, isSlow: true, downgraded: true } }));
      for (const l of listeners) l({ fps, isSlow: true, downgraded: true });
    }
  } else if (fps >= RECOVER_FPS) {
    if (recoverSince === null) recoverSince = now;
    slowSince = null;
    if (downgraded && now - recoverSince > RECOVER_DURATION_MS) {
      downgraded = false;
      window.dispatchEvent(new CustomEvent('procut-perf-recover', { detail: { fps, isSlow: false, downgraded: false } }));
      for (const l of listeners) l({ fps, isSlow: false, downgraded: false });
    }
  } else {
    // Borderline: hold current state
  }

  rafId = requestAnimationFrame(tick);
}

function start() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

export function subscribePerformance(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function getCurrentPerfState(): PerfState {
  return {
    fps: computeFps(),
    isSlow: false,
    downgraded,
  };
}

export function isDowngraded(): boolean {
  return downgraded;
}
