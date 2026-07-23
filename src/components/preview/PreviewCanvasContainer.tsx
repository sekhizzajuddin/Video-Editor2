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
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { TimelineTrack, MediaItem } from '@/types';
import { ColorScopes } from '../ColorScopes';
import { ThumbnailModal } from '../ThumbnailModal';
import { ParticlePool } from '@/utils/canvasEffects';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import { renderCanvasEngine } from './CanvasRenderingEngine';
import { getRenderQualitySettings, optimizeCanvasContext, debouncedScrub } from './RenderingOptimizations';
import { PreviewCanvasOverlay } from './PreviewCanvasOverlay';
import {
  PreviewCanvasHeaderToolbar,
  PreviewCanvasTransportControls,
} from './PreviewCanvasToolbar';

export function PreviewCanvasContainer() {
  const currentTime = useEditorStore.getState().currentTime;

  const {
    isPlaying,
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
  } = useEditorStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
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
    }))
  );

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const { videoElements, frameCache } = useMediaPlayback();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasPool = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const particlePoolsRef = useRef<Map<string, ParticlePool>>(new Map());
  const lastParticleTimeRef = useRef<number | null>(null);
  const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const framePendingRef = useRef(true);
  const isRenderingRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);
  const [thumbnailImageData, setThumbnailImageData] = useState<string | null>(null);
  const [isPopoutOpen, setIsPopoutOpen] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('#0a0a0a');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [adaptiveQuality, setAdaptiveQuality] = useState<'high' | 'medium' | 'low'>('high');
  const lastScrubTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      offscreenCanvasPool.current.clear();
      particlePoolsRef.current.clear();
      compositeCtxRef.current = null;
      lastFrameCanvasRef.current = null;
    };
  }, []);

  const allClips = useMemo(() => tracks.flatMap((t) => t.clips || []), [tracks]);
  const allClipsRef = useRef(allClips);
  useEffect(() => {
    allClipsRef.current = allClips;
  }, [allClips]);

  const tracksSignature = useMemo(() => {
    return tracks.map((t) => 
      `${t.id}:${t.hidden}:` + 
      (t.clips || []).map((c) => 
        `${c.id}:${c.startTime}:${c.duration}:${c.opacity ?? 1}:` +
        `${c.transform?.x ?? 0}:${c.transform?.y ?? 0}:${c.transform?.scale ?? 100}:${c.transform?.rotation ?? 0}:` +
        `${c.crop?.left ?? 0}:${c.crop?.top ?? 0}:${c.crop?.right ?? 0}:${c.crop?.bottom ?? 0}`
      ).join(',')
    ).join('|');
  }, [tracks]);

  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => c.id));
    for (const clipId of particlePoolsRef.current.keys()) {
      if (!allClipIds.has(clipId)) {
        particlePoolsRef.current.delete(clipId);
      }
    }
  }, [allClips]);

  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => `clip_${c.id}`));
    for (const key of offscreenCanvasPool.current.keys()) {
      if (key.startsWith('clip_') && !allClipIds.has(key)) {
        offscreenCanvasPool.current.delete(key);
      }
    }
  }, [allClips]);

  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const [imageRevision, setImageRevision] = useState(0);
  const requestRedraw = useCallback(() => setImageRevision((r) => r + 1), []);

  // Subscribe to time changes for particle pool reset
  const prevTimeRef = useRef(currentTime);
  useEffect(() => {
    if (Math.abs(currentTime - prevTimeRef.current) > 0.1) {
      particlePoolsRef.current.clear();
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

  // DIRECT Zustand subscription for instant frame updates during transformation, property changes, and scrubbing
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (state.isPlaying) return;
      currentTimeRef.current = state.currentTime;
      framePendingRef.current = true;
    });
    return unsub;
  }, []);

  const previousRenderDepsRef = useRef<any>(null);
  const renderDepsRef = useRef<any>({
    currentTime,
    tracks,
    selectedClipId,
    mediaLibrary,
    videoElements,
    frameCache,
    imageRevision,
    requestRedraw,
    viewport,
    settings,
    showGrid,
    canvasBgColor,
    isPlaying,
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
      frameCache,
      imageRevision,
      requestRedraw,
      viewport,
      settings,
      showGrid,
      canvasBgColor,
      isPlaying,
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
      prev.tracksSignature !== tracksSignature ||
      prev.imageRevision !== imageRevision ||
      prev.videoElements !== videoElements ||
      prev.frameCache !== frameCache ||
      prev.viewport !== viewport ||
      prev.isPlaying !== isPlaying ||
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
        tracksSignature,
        selectedClipId,
        mediaLibrary,
        videoElements,
        frameCache,
        imageRevision,
        requestRedraw,
        viewport,
        settings,
        showGrid,
        canvasBgColor,
        isPlaying,
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
    tracksSignature,
    selectedClipId,
    mediaLibrary,
    videoElements,
    frameCache,
    imageRevision,
    requestRedraw,
    viewport,
    settings,
    showGrid,
    canvasBgColor,
    isPlaying,
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
      if (!useEditorStore.getState().isPlaying) {
        // Set framePending directly so the RAF tick renders IMMEDIATELY, bypassing React state update latency
        framePendingRef.current = true;
        requestRedraw();
      }
    };
    window.addEventListener('procut-frame-updated', handleFrameUpdate);
    return () => window.removeEventListener('procut-frame-updated', handleFrameUpdate);
  }, [requestRedraw]);

  useEffect(() => {
    if (canvasRef.current && !previewCanvas) {
      setPreviewCanvas(canvasRef.current);
    }
  }, [setPreviewCanvas, previewCanvas]);

  const currentTimeRef = useRef(currentTime);

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await renderCanvasEngine({
      canvas,
      compositeCtxRef,
      offscreenCanvasPool,
      particlePoolsRef,
      lastParticleTimeRef,
      lastFrameCanvasRef,
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

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);

      const state = useEditorStore.getState();
      const actualTime = state.currentTime;

      if (state.isPlaying) {
        framePendingRef.current = true;

        const dir = state.playbackDirection ?? 1;
        const speed = state.playbackSpeed;
        const currentSeek = state.seek;
        const currentPause = state.pause;
        const allClips = allClipsRef.current;
        const selectedIds = state.selectedClipIds;

        let newTime = currentTimeRef.current;

        if (state.isExporting) {
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

          if (selectedIds.length > 0) {
            const selectedClips = allClips.filter((c) => selectedIds.includes(c.id));
            if (selectedClips.length > 0) {
              let minStart = Infinity;
              let maxEnd = -Infinity;
              for (const c of selectedClips) {
                if (c.startTime < minStart) minStart = c.startTime;
                const end = c.startTime + c.duration;
                if (end > maxEnd) maxEnd = end;
              }
              if (newTime >= maxEnd || newTime < minStart) {
                newTime = dir >= 0 ? minStart : maxEnd;
              }
            }
          } else {
            if (dir < 0 && newTime <= 0) {
              newTime = 0;
              currentPause();
            } else if (dir >= 0 && newTime >= maxEndSequence) {
              newTime = 0;
              currentPause();
            }
          }

          currentTimeRef.current = newTime;

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

      if (tabVisible && framePendingRef.current && !isRendering) {
        framePendingRef.current = false;
        isRendering = true;
        isRenderingRef.current = true;

        // CRITICAL FIX: Patch renderDepsRef with FRESH store data right before rendering.
        // Without this, renderDepsRef holds stale values because React's useEffect hasn't
        // processed the Zustand state change yet when the RAF tick fires.
        const freshState = useEditorStore.getState();
        const deps = renderDepsRef.current;
        deps.currentTime = currentTimeRef.current;
        deps.tracks = freshState.tracks;
        deps.selectedClipId = freshState.selectedClipId;
        deps.mediaLibrary = freshState.mediaLibrary;
        deps.isPlaying = freshState.isPlaying;

        renderCanvasRef.current()
          .catch((err: unknown) => {
            console.error('Error in renderCanvas:', err);
          })
          .finally(() => {
            isRendering = false;
            isRenderingRef.current = false;
          });
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
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;

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
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;

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

  const previewWidth =
    settings.previewQuality === 'quarter'
      ? 213
      : settings.previewQuality === 'half'
      ? 427
      : 854;
  const previewHeight =
    settings.previewQuality === 'quarter'
      ? 120
      : settings.previewQuality === 'half'
      ? 240
      : 480;

  const cursorStyle = useMemo(() => {
    const sc = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
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
        isPopoutOpen={isPopoutOpen}
        onTogglePopout={() => setIsPopoutOpen(!isPopoutOpen)}
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
          const selClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
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
          ref={canvasRef}
          width={activeCanvasWidth}
          height={activeCanvasHeight}
          className={`pointer-events-none ${
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
