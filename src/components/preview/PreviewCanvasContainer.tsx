// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PreviewCanvasContainer.tsx
 * 
 * Main Container Component for Preview Canvas.
 * Integrates the 60 FPS animation loop, 2D composite canvas engine,
 * interactive transform overlay, header toolbar, and transport controls.
 * 
 * Connected to:
 * - Timeline: Subscribes to currentTime, play/pause, seek, volume, speed.
 * - MediaPanel: Uses media playback hooks (videoElements, frameCache).
 * - PropertyPanel: Integrates live transform & clip property updates via PreviewCanvasOverlay.
 * - EditorStore: Syncs canvas element ref, quality settings, grid, safe zones, aspect ratio.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { Spinner } from '@/components/ui/spinner';
import { TimelineTrack, MediaItem } from '@/types';
import { ColorScopes } from '../ColorScopes';
import { ThumbnailModal } from '../ThumbnailModal';
import { ParticlePool } from '@/utils/canvasEffects';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import { renderCanvasEngine } from './CanvasRenderingEngine';
import { getRenderQualitySettings, optimizeCanvasContext, debouncedScrub } from './RenderingOptimizations';
import { subscribePerformance, isDowngraded } from '@/utils/performanceMonitor';
import { PreviewCanvasOverlay } from './PreviewCanvasOverlay';
import {
  PreviewCanvasHeaderToolbar,
  PreviewCanvasTransportControls,
} from './PreviewCanvasToolbar';
import { setOnMaskReadyCallback } from '@/utils/aiBackground';
import { getPlaybackTime, setPlaybackTime, subscribePlaybackTime, getTrimPreviewTime, subscribeTrimPreviewTime } from '@/utils/playbackClock';
import { isPreviewSuspendedForExport } from '@/utils/previewSuspension';
import { getOverlayMapping } from './previewMath';
import { MediaPoolDebugOverlay } from './MediaPoolDebugOverlay';
import { isMediaDebugEnabled } from '@/utils/mediaPoolContainer';
import { isMobileDevice } from '@/hooks/useMediaPlayback';

export function PreviewCanvasContainer() {
  const currentTime = useEditorStore.getState().currentTime;

  const {
    isPlaying,
    isScrubbing,
    totalDuration,
    isMuted,
    volume,
    togglePlayback,
    seek,
    setVolume,
    toggleMute,
    tracks,
    selectedClipId,
    selectedClipIds,
    pipWindows,
    selectClip,
    playbackSpeed,
    setPlaybackSpeed,
    playbackDirection,
    mediaLibrary,
    updateClip,
    canvasTransformMode,
    setCanvasTransformMode,
    setPreviewCanvas,
    previewCanvas,
    activeTool,
    settings,
    aspectRatio,
    setAspectRatio,
    isExporting,
    exportWidth,
    exportHeight,
    showScopes,
    setShowScopes,
    showProgressBar,
    progressBarColor,
    progressBarHeight,
    useProxies,
    isBuffering,
  } = useEditorStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      isScrubbing: s.isScrubbing,
      totalDuration: s.totalDuration,
      isMuted: s.isMuted,
      volume: s.volume,
      togglePlayback: s.togglePlayback,
      seek: s.seek,
      setVolume: s.setVolume,
      toggleMute: s.toggleMute,
      tracks: s.tracks,
      selectedClipId: s.selectedClipId,
      selectedClipIds: s.selectedClipIds,
      pipWindows: s.pipWindows,
      selectClip: s.selectClip,
      playbackSpeed: s.playbackSpeed,
      setPlaybackSpeed: s.setPlaybackSpeed,
      playbackDirection: s.playbackDirection,
      mediaLibrary: s.mediaLibrary,
      updateClip: s.updateClip,
      canvasTransformMode: s.canvasTransformMode,
      setCanvasTransformMode: s.setCanvasTransformMode,
      setPreviewCanvas: s.setPreviewCanvas,
      previewCanvas: s.previewCanvas,
      activeTool: s.activeTool,
      settings: s.settings,
      aspectRatio: s.aspectRatio,
      setAspectRatio: s.setAspectRatio,
      isExporting: s.isExporting,
      exportWidth: s.exportWidth,
      exportHeight: s.exportHeight,
      showScopes: s.showScopes,
      setShowScopes: s.setShowScopes,
      showProgressBar: s.showProgressBar,
      progressBarColor: s.progressBarColor,
      progressBarHeight: s.progressBarHeight,
      useProxies: s.useProxies,
      isBuffering: s.isBuffering,
    }))
  );

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const { videoElements } = useMediaPlayback(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasPool = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const particlePoolsRef = useRef<Map<string, ParticlePool>>(new Map());
  const lastParticleTimeRef = useRef<number | null>(null);
  const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const framePendingRef = useRef(true);
  const lastRenderedTimeRef = useRef<number>(0);
  const isRenderingRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);
  const [thumbnailImageData, setThumbnailImageData] = useState<string | null>(null);
  const [canvasBgColor, setCanvasBgColor] = useState('#0a0a0a');
  const setIsScrubbing = useEditorStore((s) => s.setIsScrubbing);
  const [adaptiveQuality, setAdaptiveQuality] = useState<'high' | 'medium' | 'low'>('high');
  // On-device media diagnostics (Android remote debugging): ?mediadebug=1
  const [mediaDebug] = useState(() => isMediaDebugEnabled());
  const lastScrubTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      offscreenCanvasPool.current.clear();
      particlePoolsRef.current.clear();
      compositeCtxRef.current = null;
      lastFrameCanvasRef.current = null;
    };
  }, []);

  // Wire up AI background mask callback: when the Web Worker finishes computing
  // a mask, schedule a canvas repaint so the result appears immediately.
  useEffect(() => {
    setOnMaskReadyCallback(() => {
      framePendingRef.current = true;
    });
    return () => setOnMaskReadyCallback(null);
  }, []);

  const allClips = useMemo(() => tracks.flatMap((t) => t.clips || []), [tracks]);
  const allClipsRef = useRef(allClips);
  useEffect(() => {
    allClipsRef.current = allClips;
  }, [allClips]);

  // PERF: tracksSignature mega-string removed. Zustand provides a new `tracks` array reference
  // on any mutation, so reference equality (tracks !== prev.tracks) is O(1) and sufficient.

  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => c.id));
    for (const clipId of particlePoolsRef.current.keys()) {
      if (!allClipIds.has(clipId)) {
        particlePoolsRef.current.delete(clipId);
      }
    }
  }, [allClips]);

  useEffect(() => {
    const activeClipIds = new Set(allClips.map((c) => c.id));
    for (const key of offscreenCanvasPool.current.keys()) {
      if (key.startsWith('clip_')) {
        const isOwnedByActiveClip = Array.from(activeClipIds).some((id) => key.includes(id));
        if (!isOwnedByActiveClip) {
          offscreenCanvasPool.current.delete(key);
        }
      }
    }
  }, [allClips]);

  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const [imageRevision, setImageRevision] = useState(0);
  const requestRedraw = useCallback(() => setImageRevision((r) => r + 1), []);

  // Adaptive performance: subscribe to the rolling-FPS monitor. When frames
  // are sustained-slow, flip the store flag so the engine downgrades quality.
  useEffect(() => {
    const unsub = subscribePerformance(() => {
      const cur = useEditorStore.getState().perfDowngraded;
      if (cur !== isDowngraded()) {
        useEditorStore.getState().setPerfDowngraded(isDowngraded());
      }
    });
    return unsub;
  }, []);

  // Subscribe to time changes for particle pool reset
  const prevTimeRef = useRef(currentTime);
  useEffect(() => {
    if (Math.abs(currentTime - prevTimeRef.current) > 0.1) {
      particlePoolsRef.current.clear();
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

  // NOTE: Direct Zustand subscription for currentTime-based scrub updates is below
  // (around line 373). It only fires on actual time changes, not every store mutation.

  const previousRenderDepsRef = useRef<any>(null);
  const renderDepsRef = useRef<any>({
    currentTime,
    tracks,
    selectedClipId,
    mediaLibrary,
    videoElements,
    imageRevision,
    requestRedraw,
    viewport,
    settings,
    showGrid,
    canvasBgColor,
    isPlaying,
    isScrubbing,
    aspectRatio,
    isExporting,
    exportWidth,
    exportHeight,
    showProgressBar,
    progressBarColor,
    progressBarHeight,
    useProxies,
  });

  useEffect(() => {
    renderDepsRef.current = {
      currentTime,
      tracks,
      selectedClipId,
      mediaLibrary,
      videoElements,
      imageRevision,
      requestRedraw,
      viewport,
      settings,
      showGrid,
      canvasBgColor,
      isPlaying,
      isScrubbing,
      aspectRatio,
      isExporting,
      exportWidth,
      exportHeight,
      showProgressBar,
      progressBarColor,
      progressBarHeight,
      useProxies,
    };
    const prev = previousRenderDepsRef.current;
    if (
      !prev ||
      prev.tracks !== tracks ||
      prev.imageRevision !== imageRevision ||
      prev.videoElements !== videoElements ||
      prev.viewport !== viewport ||
      prev.isPlaying !== isPlaying ||
      prev.isScrubbing !== isScrubbing ||
      prev.aspectRatio !== aspectRatio ||
      prev.isExporting !== isExporting ||
      prev.exportWidth !== exportWidth ||
      prev.exportHeight !== exportHeight ||
      prev.showGrid !== showGrid ||
      prev.showProgressBar !== showProgressBar ||
      prev.canvasBgColor !== canvasBgColor ||
      prev.settings !== settings ||
      prev.requestRedraw !== requestRedraw ||
      prev.progressBarColor !== progressBarColor ||
      prev.progressBarHeight !== progressBarHeight ||
      prev.useProxies !== useProxies ||
      prev.selectedClipId !== selectedClipId ||
      prev.mediaLibrary !== mediaLibrary
    ) {
      framePendingRef.current = true;
      previousRenderDepsRef.current = {
        currentTime,
        tracks,
        selectedClipId,
        mediaLibrary,
        videoElements,
        imageRevision,
        requestRedraw,
        viewport,
        settings,
        showGrid,
        canvasBgColor,
        isPlaying,
        isScrubbing,
        aspectRatio,
        isExporting,
        exportWidth,
        exportHeight,
        showProgressBar,
        progressBarColor,
        progressBarHeight,
        useProxies,
      };
    }
  }, [
    currentTime,
    tracks,
    selectedClipId,
    mediaLibrary,
    videoElements,
    imageRevision,
    requestRedraw,
    viewport,
    settings,
    showGrid,
    canvasBgColor,
    isPlaying,
    isScrubbing,
    aspectRatio,
    isExporting,
    exportWidth,
    exportHeight,
    showProgressBar,
    progressBarColor,
    progressBarHeight,
    useProxies,
  ]);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleFrameUpdate = () => {
      framePendingRef.current = true;
    };
    window.addEventListener('procut-frame-updated', handleFrameUpdate);

    // CapCut-feel: when the playhead drag ends, force a single high-quality
    // full-resolution redraw. During drag we render at quarter-res for 60 fps;
    // on release we want a crisp, sharp final frame.
    const handleScrubFinalize = () => {
      requestRedraw();
    };
    window.addEventListener('procut-scrub-finalize', handleScrubFinalize);

    return () => {
      window.removeEventListener('procut-frame-updated', handleFrameUpdate);
      window.removeEventListener('procut-scrub-finalize', handleScrubFinalize);
    };
  }, [requestRedraw]);

  // Direct Zustand subscription: immediately flag framePending when currentTime
  // or tracks change during scrubbing/editing. This bypasses React's async render
  // cycle — state updates via useEffect can be delayed 16-50ms.
  useEffect(() => {
    let lastTime = getPlaybackTime();
    let lastTracks = useEditorStore.getState().tracks;

    const unsubStore = useEditorStore.subscribe((state) => {
      if (state.isPlaying) return;
      if (state.tracks !== lastTracks) {
        lastTracks = state.tracks;
        framePendingRef.current = true;
      }
    });

    // Time changes come from the clock rather than the store: scrubbing and
    // frame-stepping push exact positions there first, so this fires without
    // waiting for the store's React notification.
    const unsubClock = subscribePlaybackTime((t) => {
      if (useEditorStore.getState().isPlaying) return;
      // Do not overwrite currentTimeRef while trimming is actively previewing
      if (getTrimPreviewTime() !== null) return;
      if (Math.abs(t - lastTime) <= 0.001) return;
      lastTime = t;
      currentTimeRef.current = t;
      framePendingRef.current = true;
    });

    // Subscribe to trim preview time changes — when trimming, the canvas
    // needs to render the frame at the trim edge, not the primary playhead.
    const unsubTrimPreview = subscribeTrimPreviewTime((t) => {
      if (t !== null) {
        currentTimeRef.current = t;
      } else {
        currentTimeRef.current = getPlaybackTime();
      }
      framePendingRef.current = true;
    });

    return () => {
      unsubStore();
      unsubClock();
      unsubTrimPreview();
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current && !previewCanvas) {
      setPreviewCanvas(canvasRef.current);
    }
  }, [setPreviewCanvas, previewCanvas]);

  const currentTimeRef = useRef(currentTime);

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fresh = useEditorStore.getState();
    await renderCanvasEngine({
      canvas,
      compositeCtxRef,
      offscreenCanvasPool,
      particlePoolsRef,
      lastParticleTimeRef,
      lastFrameCanvasRef,
      isScrubbing: fresh.isScrubbing,
      renderDeps: renderDepsRef.current,
    });
  }, []);

  const renderCanvasRef = useRef(renderCanvas);
  const rafActiveRef = useRef(false);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  useEffect(() => {
    framePendingRef.current = true;
  }, [renderCanvas]);

  useEffect(() => {
    framePendingRef.current = true;
    if (rafActiveRef.current) return;

    rafActiveRef.current = true;
    let rafId: number;
    let tabVisible = !document.hidden;

    const onVisChange = () => {
      tabVisible = !document.hidden;
      if (tabVisible) framePendingRef.current = true;
    };
    document.addEventListener('visibilitychange', onVisChange);
    let isRendering = false;
    let lastTime = performance.now();
    let lastSyncTime = performance.now();
    const isMobile = isMobileDevice();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (isPreviewSuspendedForExport()) {
        // Keep the last preview image, but leave decoding/compositing resources
        // to worker export. Capture fallback releases this suspension first.
        lastTime = now;
        lastSyncTime = now;
        framePendingRef.current = true;
        return;
      }

      const state = useEditorStore.getState();
      // While paused, the clock and the store agree exactly (seek/pause both flush
      // it), so this is the authoritative position in every state.
      // During trimming, use the trim preview time for canvas rendering.
      const trimTime = getTrimPreviewTime();
      const actualTime = trimTime !== null ? trimTime : getPlaybackTime();

      if (state.isPlaying) {
        // RULER-CLICK / SEEK DURING PLAYBACK: if something wrote a NEW position
        // to the clock since our last frame (e.g. the user clicked the timeline
        // ruler while playing), adopt it immediately and keep playing from there
        // instead of overwriting it with our own accumulated advance.
        if (Math.abs(actualTime - currentTimeRef.current) > 0.001) {
          currentTimeRef.current = actualTime;
          setPlaybackTime(actualTime);
          lastTime = now;
          framePendingRef.current = true;
        }

        framePendingRef.current = true;

        const dir = state.playbackDirection ?? 1;
        const speed = state.playbackSpeed;
        const currentSeek = state.seek;
        const currentPause = state.pause;
        const allClips = allClipsRef.current;

        let newTime = currentTimeRef.current;

        // BUFFERING FREEZE: when video decoders haven't caught up (isBuffering),
        // freeze the clock so the playhead doesn't race ahead. Keep lastTime
        // current so there's no time-jump when buffering clears.
        if (state.isBuffering) {
          lastTime = now;
          // Don't advance newTime — stay at currentTimeRef.current
        } else if (state.isExporting) {
          const targetFps = state.exportFps || 30;
          const frameDuration = 1000 / targetFps;
          const elapsed = now - lastTime;
          if (elapsed >= frameDuration) {
            lastTime = now - (elapsed % frameDuration);
            newTime = currentTimeRef.current + (1 / targetFps) * speed * dir;
          }
        } else {
          const dt = (now - lastTime) / 1000;
          lastTime = now;
          newTime = currentTimeRef.current + dt * speed * dir;
        }

        if (newTime !== currentTimeRef.current) {
          let maxEndSequence = 0;
          for (const c of allClips) {
            const end = c.startTime + c.duration;
            if (end > maxEndSequence) maxEndSequence = end;
          }

          const isStretchLooping = state.dynamicStretch?.isActive && state.dynamicStretch?.isLoopingRegion;
          const selectedRegionId = state.selectedExportRegionId;
          const selectedRegion = selectedRegionId ? (state.exportRegions || []).find((r) => r.id === selectedRegionId) : null;

          if (isStretchLooping) {
            const rStart = state.dynamicStretch.markStart;
            const rEnd = state.dynamicStretch.markEnd;
            if (newTime >= rEnd || newTime < rStart) {
              newTime = dir >= 0 ? rStart : rEnd;
            }
          } else if (selectedRegion) {
            const rStart = selectedRegion.startTime;
            const rEnd = selectedRegion.endTime;
            if (newTime >= rEnd || newTime < rStart) {
              newTime = dir >= 0 ? rStart : rEnd;
            }
          } else {
            if (dir < 0 && newTime <= 0) {
              newTime = 0;
              currentPause();
              // BUG FIX: Force immediate seek to 0 — bypass the 30ms throttle.
              // Without this, the paused else-branch reads store.currentTime (still at end)
              // on the next tick and reverts currentTimeRef back to the end position,
              // breaking the second playback. Also resets lastSyncTime so the throttled
              // seek doesn't fire again right after and clobber this one.
              currentSeek(0);
              lastSyncTime = now;
            } else if (dir >= 0 && newTime >= maxEndSequence) {
              newTime = 0;
              currentPause();
              // BUG FIX: Same as above — force immediate seek on forward-direction end.
              currentSeek(0);
              lastSyncTime = now;
            }
          }

          currentTimeRef.current = newTime;

          // Publish the EXACT position to the React-free clock every single frame.
          // The media-sync PLL reads this, so it now measures true drift instead of
          // the up-to-33ms staircase produced by the throttled store write below.
          // Removing that quantisation noise is what stops the PLL from chasing
          // phantom drift and wobbling playbackRate on multi-track timelines.
          setPlaybackTime(newTime);

          // Sync the store for React consumers (timeline scroll, timecode).
          // 30 Hz (33ms) keeps the timeline playhead buttery-smooth without
          // flooding React with 60+ re-renders/sec.
          if (now - lastSyncTime > 33) {
            currentSeek(newTime);
            lastSyncTime = now;
          }
        }
      } else {
        lastTime = now;
        lastSyncTime = now;

        if (Math.abs(actualTime - currentTimeRef.current) > 0.001) {
          currentTimeRef.current = actualTime;
          framePendingRef.current = true;
        }
      }

      if (Math.abs(currentTimeRef.current - lastRenderedTimeRef.current) > 0.001) {
      framePendingRef.current = true;
    }
    if (tabVisible && framePendingRef.current) {
        const freshState = useEditorStore.getState();
        const currentlyScrubbing = freshState.isScrubbing;
        const currentlyPlaying = freshState.isPlaying;

        // BUG FIX: Restore split mutex strategy.
        // Scrubbing: allow concurrent renders — scrub renders skip ALL heavy async FX
        //   (skipExpensiveFX=true when isScrubbing), so they complete near-synchronously.
        //   Dropping scrub frames makes the playhead feel unresponsive.
        // Playback: enforce exclusive mutex — playback renders CAN have async mask/AI-bg
        //   operations. Concurrent renders corrupt Canvas2D ctx.save/restore/transform state
        //   producing the intermittent chop. A dropped playback frame is invisible;
        //   a corrupt one is a visible glitch.
        const allowConcurrentScrub = currentlyScrubbing;

        if (allowConcurrentScrub || !isRendering) {
          framePendingRef.current = false;
          if (!allowConcurrentScrub) {
            isRendering = true;
            isRenderingRef.current = true;
          }

          // CRITICAL: Patch renderDepsRef with FRESH store data right before rendering.
          // Without this, renderDepsRef holds stale values because React's useEffect hasn't
          // processed the Zustand state change yet when the RAF tick fires.
          const deps = renderDepsRef.current;
          deps.currentTime = currentTimeRef.current;
          deps.tracks = freshState.tracks;
          deps.selectedClipId = freshState.selectedClipId;
          deps.mediaLibrary = freshState.mediaLibrary;
          deps.isPlaying = currentlyPlaying;
          deps.isScrubbing = currentlyScrubbing;

          renderCanvasRef.current()
            .catch((err: unknown) => {
              console.error('Error in renderCanvas:', err);
            })
            .finally(() => {
              if (!allowConcurrentScrub) {
                isRendering = false;
                isRenderingRef.current = false;
              }
              lastRenderedTimeRef.current = currentTimeRef.current;
            });
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      rafActiveRef.current = false;
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const isZoomModifier = e.altKey || e.ctrlKey || e.metaKey;
      const isPanModifier = activeTool === 'hand' || isSpacePressed;

      if (!isZoomModifier && !isPanModifier) {
        return;
      }

      e.preventDefault();

      const rect = el.getBoundingClientRect();
      // Uniform mapping — the canvas is object-contain, so panning must use one
      // scale for both axes or the view drifts diagonally on non-16:9 panes.
      const { scale: overlayScale } = getOverlayMapping(rect);
      const scaleX = overlayScale;
      const scaleY = overlayScale;

      const { updateClip, currentTime, settings } = useEditorStore.getState();
      const sens = settings.gestureSensitivity;

      const state = useEditorStore.getState();
      let currentClip = null;
      if (state.selectedClipId) {
        for (const t of state.tracks) {
          const c = t.clips.find((c) => c.id === state.selectedClipId);
          if (c && state.currentTime >= c.startTime && state.currentTime < c.startTime + c.duration) {
            currentClip = c;
            break;
          }
        }
      }

      if (currentClip) {
        const currentScale = currentClip.transform.scale;
        const zoomDelta = e.deltaY > 0 ? -2 * sens : 2 * sens;
        const newScale = Math.max(10, Math.min(1000, currentScale + zoomDelta));

        let animations = currentClip.animations || {};
        const localTime = currentTime - currentClip.startTime;
        if (animations['transform.scale']) {
          animations = {
            ...animations,
            'transform.scale': addOrUpdateKeyframe(animations['transform.scale'], localTime, newScale),
          };
        }

        updateClip(currentClip.id, {
          transform: { ...currentClip.transform, scale: newScale },
          animations,
        });
      } else {
        const panSpeed = settings.scrollSpeed;
        setViewport((prev) => ({
          ...prev,
          x: prev.x - e.deltaX * scaleX * panSpeed,
          y: prev.y - e.deltaY * scaleY * panSpeed,
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [activeTool, isSpacePressed]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.id === 'preview-canvas-wrapper' || target.tagName === 'CANVAS') {
      if (activeTool !== 'hand' && activeTool !== 'zoom' && !isSpacePressed) {
        useEditorStore.getState().selectClip(null);
        useEditorStore.getState().selectClips([]);
        useEditorStore.getState().selectTransition(null);
      }
    }

    if (activeTool === 'hand' || isSpacePressed) {
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (activeTool === 'zoom') {
      const state = useEditorStore.getState();
      let currentClip = null;
      if (state.selectedClipId) {
        for (const t of state.tracks) {
          const c = t.clips.find((c) => c.id === state.selectedClipId);
          if (c && state.currentTime >= c.startTime && state.currentTime < c.startTime + c.duration) {
            currentClip = c;
            break;
          }
        }
      }

      if (currentClip) {
        const factor = e.shiftKey ? 1 / 1.5 : 1.5;
        const newScale = Math.max(10, Math.min(1000, Math.round(currentClip.transform.scale * factor)));

        let animations = currentClip.animations || {};
        const localTime = state.currentTime - currentClip.startTime;
        if (animations['transform.scale']) {
          animations = {
            ...animations,
            'transform.scale': addOrUpdateKeyframe(animations['transform.scale'], localTime, newScale),
          };
        }

        updateClip(currentClip.id, {
          transform: { ...currentClip.transform, scale: newScale },
          animations,
        });
        useEditorStore.getState().saveSnapshot();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning.current && (activeTool === 'hand' || isSpacePressed)) {
      const rect = containerRef.current!.getBoundingClientRect();
      // Uniform mapping — the canvas is object-contain, so panning must use one
      // scale for both axes or the view drifts diagonally on non-16:9 panes.
      const { scale: overlayScale } = getOverlayMapping(rect);
      const scaleX = overlayScale;
      const scaleY = overlayScale;

      const dx = (e.clientX - lastPanPos.current.x) * scaleX;
      const dy = (e.clientY - lastPanPos.current.y) * scaleY;

      setViewport((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPanning.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };
  const handleSkipBackward = () => seek(Math.max(0, currentTime - 10));
  const handleSkipForward = () => seek(Math.min(totalDuration, currentTime + 10));
  const handleRestart = () => seek(0);

  // Canvas buffer is sized to the project aspect ratio (height fixed at 480,
  // width follows) so the rendered frame fills the buffer instead of being
  // letterboxed inside a fixed 16:9 854×480 box. Without this, non-16:9
  // (portrait/square) projects get letterboxed twice — once by the engine and
  // again by `object-contain` in the portrait mobile viewport — leaving the
  // clips so small they appear to not render at all.
  const previewBaseWidth =
    aspectRatio === '9:16'
      ? Math.round(480 * (9 / 16))
      : aspectRatio === '1:1'
      ? 480
      : aspectRatio === '4:3'
      ? Math.round(480 * (4 / 3))
      : 854;
  // MOBILE PERF: force half-resolution on mobile unless the user explicitly set
  // quarter. 480p overwhelms mobile TBDR GPUs (drawImage + offscreen buffers).
  // 240p is visually sufficient on small screens and cuts pixel throughput 4x.
  const effectiveQuality = isMobileDevice() && settings.previewQuality === 'full'
    ? 'half'
    : settings.previewQuality;
  const previewWidth =
    effectiveQuality === 'quarter'
      ? Math.max(1, Math.round(previewBaseWidth / 4))
      : effectiveQuality === 'half'
      ? Math.max(1, Math.round(previewBaseWidth / 2))
      : previewBaseWidth;
  const previewHeight =
    effectiveQuality === 'quarter'
      ? 120
      : effectiveQuality === 'half'
      ? 240
      : 480;

  const cursorStyle = useMemo(() => {
    const sc = findClipInTracks(tracks, selectedClipId, pipWindows);
    return activeTool === 'hand'
      ? isPanning.current
        ? 'grabbing'
        : 'grab'
      : activeTool === 'zoom'
      ? 'zoom-in'
      : sc?.particleSettings
      ? 'crosshair'
      : 'default';
  }, [activeTool, tracks, selectedClipId]);

  const handleToggleThumbnailModal = () => {
    if (!showThumbnailModal) {
      const data = canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
      setThumbnailImageData(data);
      setShowThumbnailModal(true);
    } else {
      setShowThumbnailModal(false);
    }
  };

  const activeCanvasWidth = (isExporting && exportWidth) ? exportWidth : previewWidth;
  const activeCanvasHeight = (isExporting && exportHeight) ? exportHeight : previewHeight;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header Toolbar */}
      <PreviewCanvasHeaderToolbar
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        viewportZoom={viewport.zoom}
        onResetZoom={() => setViewport((v) => ({ ...v, zoom: 1 }))}
        onFitZoom={() => setViewport({ x: 0, y: 0, zoom: 1 })}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showScopes={showScopes}
        onToggleScopes={() => setShowScopes(!showScopes)}
        showThumbnailModal={showThumbnailModal}
        onToggleThumbnailModal={handleToggleThumbnailModal}
        showSettingsPanel={showSettingsPanel}
        setShowSettingsPanel={setShowSettingsPanel}
      />

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        id="preview-canvas-wrapper"
        className="relative flex-1 overflow-hidden bg-[#0a0a0a] select-none touch-none min-h-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          const selClip = findClipInTracks(tracks, selectedClipId, pipWindows);
          if (selClip?.particleSettings && (e.ctrlKey || e.altKey)) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            particlePoolsRef.current.delete(selClip.id);
            updateClip(selClip.id, {
              particleSettings: {
                ...selClip.particleSettings,
                emitterX: Math.round(x),
                emitterY: Math.round(y),
              },
            });
          }
        }}
        style={{ cursor: cursorStyle }}
      >
        <canvas
          id="preview-canvas"
          data-preview-canvas
          ref={canvasRef}
          width={activeCanvasWidth}
          height={activeCanvasHeight}
          className={`preview-canvas pointer-events-none ${
            isFullscreen
              ? 'absolute inset-0 w-full h-full object-contain bg-black'
              : 'w-full h-full object-contain'
          }`}
        />
        <PreviewCanvasOverlay
          viewport={viewport}
          videoElements={videoElements}
          containerRef={containerRef}
        />
        {mediaDebug && <MediaPoolDebugOverlay />}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10">
            <Spinner className="w-12 h-12 text-white drop-shadow-md" />
          </div>
        )}
      </div>

      {/* Transport Controls Bar */}
      <PreviewCanvasTransportControls
        currentTime={currentTime}
        totalDuration={totalDuration}
        isPlaying={isPlaying}
        togglePlayback={togglePlayback}
        handleTimelineSeek={handleTimelineSeek}
        handleRestart={handleRestart}
        handleSkipBackward={handleSkipBackward}
        handleSkipForward={handleSkipForward}
        playbackDirection={playbackDirection ?? 1}
        volume={volume}
        setVolume={setVolume}
        isMuted={isMuted}
        toggleMute={toggleMute}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
      />

      {/* Scopes & Thumbnail Modals */}
      {showScopes && <ColorScopes canvasRef={canvasRef} />}
      {showThumbnailModal && (
        <ThumbnailModal
          isOpen={showThumbnailModal}
          onClose={() => setShowThumbnailModal(false)}
          imageData={thumbnailImageData}
        />
      )}
    </div>
  );
}
