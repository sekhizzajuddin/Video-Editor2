/**
 * useSmoothPlayback.ts
 * 
 * Enhanced playback hook with frame skipping, adaptive quality,
 * and smooth scrubbing optimizations for 60 FPS rendering.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

interface SmoothPlaybackOptions {
  isPlaying: boolean;
  currentTime: number;
  onFrameRender: () => Promise<void>;
  onScrub?: (time: number) => void;
}

export function useSmoothPlayback({
  isPlaying,
  currentTime,
  onFrameRender,
  onScrub,
}: SmoothPlaybackOptions) {
  const rafIdRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(currentTime);
  const frameSkipCountRef = useRef<number>(0);
  const isRenderingRef = useRef<boolean>(false);
  const pendingFrameRef = useRef<boolean>(false);
  
  const MAX_FRAME_SKIP = 2; // Skip max 2 frames during heavy load
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  
  // Adaptive quality based on performance
  const adaptiveQualityRef = useRef<'high' | 'medium' | 'low'>('high');
  const performanceMetricsRef = useRef({
    frameCount: 0,
    droppedFrames: 0,
    lastCheck: performance.now(),
  });

  // Track performance and adjust quality
  const updatePerformanceMetrics = useCallback((dropped: boolean) => {
    const metrics = performanceMetricsRef.current;
    metrics.frameCount++;
    if (dropped) metrics.droppedFrames++;
    
    const now = performance.now();
    if (now - metrics.lastCheck > 2000) { // Check every 2 seconds
      const dropRate = metrics.droppedFrames / metrics.frameCount;
      
      if (dropRate > 0.15) {
        // More than 15% dropped frames - reduce quality
        if (adaptiveQualityRef.current === 'high') {
          adaptiveQualityRef.current = 'medium';
          console.log('[SmoothPlayback] Reduced quality to medium');
        } else if (adaptiveQualityRef.current === 'medium') {
          adaptiveQualityRef.current = 'low';
          console.log('[SmoothPlayback] Reduced quality to low');
        }
      } else if (dropRate < 0.05 && adaptiveQualityRef.current === 'low') {
        // Less than 5% dropped - increase quality
        adaptiveQualityRef.current = 'medium';
        console.log('[SmoothPlayback] Increased quality to medium');
      } else if (dropRate < 0.03 && adaptiveQualityRef.current === 'medium') {
        adaptiveQualityRef.current = 'high';
        console.log('[SmoothPlayback] Increased quality to high');
      }
      
      // Reset metrics
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
    
    // Frame skipping logic
    if (elapsed < FRAME_INTERVAL) {
      // Not enough time passed - skip this frame
      frameSkipCountRef.current++;
      if (frameSkipCountRef.current <= MAX_FRAME_SKIP) {
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }
    }
    
    frameSkipCountRef.current = 0;
    
    if (isRenderingRef.current) {
      // Previous frame still rendering - mark pending and skip
      pendingFrameRef.current = true;
      rafIdRef.current = requestAnimationFrame(renderLoop);
      updatePerformanceMetrics(true); // Count as dropped
      return;
    }
    
    isRenderingRef.current = true;
    lastRenderTimeRef.current = timestamp;
    
    onFrameRender()
      .then(() => {
        isRenderingRef.current = false;
        
        // Render pending frame if one was requested
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
    
    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, [isPlaying, onFrameRender, updatePerformanceMetrics]);

  // Start/stop playback loop
  useEffect(() => {
    if (isPlaying) {
      lastRenderTimeRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame(renderLoop);
      
      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
      };
    } else {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [isPlaying, renderLoop]);

  // Handle scrubbing with debouncing
  const handleScrub = useCallback((time: number) => {
    const timeDiff = Math.abs(time - lastFrameTimeRef.current);
    
    // Only render if moved significantly (avoid micro-jitters)
    if (timeDiff < 0.033) { // Less than ~2 frames at 30fps
      pendingFrameRef.current = true;
      return;
    }
    
    lastFrameTimeRef.current = time;
    
    if (onScrub) {
      onScrub(time);
    }
    
    // Request immediate render on scrub
    if (!isRenderingRef.current) {
      isRenderingRef.current = true;
      onFrameRender().finally(() => {
        isRenderingRef.current = false;
      });
    }
  }, [onFrameRender, onScrub]);

  return {
    handleScrub,
    adaptiveQuality: adaptiveQualityRef.current,
    isRendering: isRenderingRef.current,
    frameSkipCount: frameSkipCountRef.current,
  };
}