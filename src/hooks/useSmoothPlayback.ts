/**
 * useSmoothPlayback.ts
 * 
 * Enhanced playback hook with frame skipping, adaptive quality,
 * and smooth scrubbing optimizations for 60 FPS rendering.
 * 
 * FIXED: Properly integrates with the existing render loop to avoid
 * breaking the rendering pipeline.
 */

import { useRef, useCallback, useEffect } from 'react';

export function useSmoothPlayback({
  isPlaying,
  isScrubbing,
  onFrameRender,
}: {
  isPlaying: boolean;
  isScrubbing: boolean;
  onFrameRender: () => Promise<void> | void;
}) {
  const rafIdRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const frameSkipCountRef = useRef<number>(0);
  const isRenderingRef = useRef<boolean>(false);
  const pendingFrameRef = useRef<boolean>(false);
  const adaptiveQualityRef = useRef<'high' | 'medium' | 'low'>('high');
  const performanceMetricsRef = useRef({
    frameCount: 0,
    droppedFrames: 0,
    lastCheck: performance.now(),
  });

  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  const MAX_FRAME_SKIP = 2;

  // Track performance and adjust quality
  const updatePerformanceMetrics = useCallback((dropped: boolean) => {
    const metrics = performanceMetricsRef.current;
    metrics.frameCount++;
    if (dropped) metrics.droppedFrames++;

    const now = performance.now();
    if (now - metrics.lastCheck > 2000) {
      const dropRate = metrics.droppedFrames / metrics.frameCount;

      if (dropRate > 0.15 && adaptiveQualityRef.current === 'high') {
        adaptiveQualityRef.current = 'medium';
      } else if (dropRate > 0.15 && adaptiveQualityRef.current === 'medium') {
        adaptiveQualityRef.current = 'low';
      } else if (dropRate < 0.05 && adaptiveQualityRef.current === 'low') {
        adaptiveQualityRef.current = 'medium';
      } else if (dropRate < 0.03 && adaptiveQualityRef.current === 'medium') {
        adaptiveQualityRef.current = 'high';
      }

      if (dropRate > 0.15) {
        adaptiveQualityRef.current =
          adaptiveQualityRef.current === 'high' ? 'medium' :
          adaptiveQualityRef.current === 'medium' ? 'low' : 'low';
      }

      metrics.frameCount = 0;
      metrics.droppedFrames = 0;
      metrics.lastCheck = now;
    }
  }, []);

  // Render loop with frame skipping
  const renderLoop = useCallback((timestamp: number) => {
    if (!isPlaying) {
      rafIdRef.current = null;
      return;
    }

    const elapsed = timestamp - lastRenderTimeRef.current;

    // Frame skipping logic - only skip during PLAYBACK, not scrubbing
    if (!isScrubbing && elapsed < FRAME_INTERVAL && frameSkipCountRef.current <= MAX_FRAME_SKIP) {
      frameSkipCountRef.current++;
      rafIdRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    frameSkipCountRef.current = 0;

    if (isRenderingRef.current) {
      pendingFrameRef.current = true;
      rafIdRef.current = requestAnimationFrame(renderLoop);
      updatePerformanceMetrics(true);
      return;
    }

    isRenderingRef.current = true;
    lastRenderTimeRef.current = timestamp;

    try {
      const result = onFrameRender();
      if (result instanceof Promise) {
        result
          .then(() => {
            isRenderingRef.current = false;
            if (pendingFrameRef.current) {
              pendingFrameRef.current = false;
              requestAnimationFrame(renderLoop);
            }
            updatePerformanceMetrics(false);
          })
          .catch((err) => {
            console.error('[SmoothPlayback] Render error:', err);
            isRenderingRef.current = false;
            updatePerformanceMetrics(true);
          });
      } else {
        isRenderingRef.current = false;
        if (pendingFrameRef.current) {
          pendingFrameRef.current = false;
          requestAnimationFrame(renderLoop);
        }
        updatePerformanceMetrics(false);
      }
    } catch (err) {
      console.error('[SmoothPlayback] Synchronous render error:', err);
      isRenderingRef.current = false;
      updatePerformanceMetrics(true);
    }

    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, [isPlaying, isScrubbing, onFrameRender, updatePerformanceMetrics]);

  // Start/stop playback loop
  useEffect(() => {
    if (isPlaying) {
      lastRenderTimeRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame(renderLoop);

      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    } else {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [isPlaying, renderLoop]);

  // Force immediate render (for scrubbing)
  const forceRender = useCallback(() => {
    if (!isRenderingRef.current) {
      isRenderingRef.current = true;
      try {
        const result = onFrameRender();
        if (result instanceof Promise) {
          result.finally(() => {
            isRenderingRef.current = false;
          });
        } else {
          isRenderingRef.current = false;
        }
      } catch (err) {
        console.error('[SmoothPlayback] Force render error:', err);
        isRenderingRef.current = false;
      }
    } else {
      pendingFrameRef.current = true;
    }
  }, [onFrameRender]);

  return {
    adaptiveQuality: adaptiveQualityRef.current,
    isRendering: isRenderingRef.current,
    frameSkipCount: frameSkipCountRef.current,
    forceRender,
  };
}