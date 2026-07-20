import { applyAiBackgroundMask } from '../utils/aiBackground';
import { removeBackground } from '@imgly/background-removal';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings2,
  Film,
  Camera,
  RotateCcw,
  Scissors,
  Grid,
  ExternalLink,
  X,
  Wand2,
  Eraser,
  Sparkles,
  Ban,
  Check,
} from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useMediaPlayback, FrameCacheEntry } from '@/hooks/useMediaPlayback';
import type { TimelineTrack, MediaItem } from '@/types';
import { saveFileToDB } from '@/utils/projectPersistence';
import { toast } from 'sonner';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import { formatTime } from '@/utils/time';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ColorScopes } from './ColorScopes';
import { ThumbnailModal } from './ThumbnailModal';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { applyLutToCanvas } from '@/utils/lutParser';
import { drawSubscribeAnimation } from '@/utils/socialAnimations';
import {
  getCachedImage,
  clearPreviewCaches,
  getProjectedCorners,
  drawPerspectiveTexture,
  renderParticles,
  drawMediaPlaceholder,
  applyColorOverlays,
  applyChromaKeyOnData,
  applyLumaKeyOnData,
  applyColorGradingWheelsOnData,
  ParticlePool,
  LocalCornerPoints
} from '@/utils/canvasEffects';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PreviewCanvas() {
  const particlePoolsRef = useRef<Map<string, ParticlePool>>(new Map());
  // FIX H4: per-field selector with shallow equality.
  // Previously useEditorStore() with no selector caused PreviewCanvas to
  // re-render on EVERY zustand state change (including unrelated fields
  // like mediaLibrary.insert, pipWindows moves, etc.). With useShallow
  // the component only re-renders when at least one of these 34 fields
  // actually changes reference.
  const {
    currentTime,
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
    isExporting,
    exportWidth,
    exportHeight,
    showScopes,
    setShowScopes,
    showProgressBar,
    progressBarColor,
    progressBarHeight,
    useProxies,
  } = useEditorStore(useShallow(s => ({
    currentTime: s.currentTime,
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
    isExporting: s.isExporting,
    exportWidth: s.exportWidth,
    exportHeight: s.exportHeight,
    showScopes: s.showScopes,
    setShowScopes: s.setShowScopes,
    showProgressBar: s.showProgressBar,
    progressBarColor: s.progressBarColor,
    progressBarHeight: s.progressBarHeight,
    useProxies: s.useProxies,
  })));

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const hasClips = tracks.some((t) => t.clips.length > 0);

  // Real video elements and frame cache for drawing frames
  const { videoElements, frameCache } = useMediaPlayback();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasPool = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const lastParticleTimeRef = useRef<number | null>(null);
  // Cache the 2D contexts so we don't call getContext() every frame
  const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Snapshot of last successfully rendered frame to prevent flash during scrubbing
  const lastFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Frame counter for throttling expensive operations
  const frameCounterRef = useRef(0);
  const framePendingRef = useRef(true);
  const isRenderingRef = useRef(false);

  // Clean up canvas contexts on unmount (Bug 15 & 40)
  useEffect(() => {
    return () => {
      offscreenCanvasPool.current.clear();
      compositeCtxRef.current = null;
      lastFrameCanvasRef.current = null;
      lastFrameCtxRef.current = null;
    };
  }, []);

  const getOrCreateCanvas = (key: string, w: number, h: number) => {
    let canvas = offscreenCanvasPool.current.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      offscreenCanvasPool.current.set(key, canvas);
    }
    // Only set dimensions when they actually change to avoid buffer reallocation
    if (Math.abs(canvas.width - w) > 0.5) canvas.width = Math.max(1, Math.round(w));
    if (Math.abs(canvas.height - h) > 0.5) canvas.height = Math.max(1, Math.round(h));
    return canvas;
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  const [showGrid, setShowGrid] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('#0a0a0a');

  // Memoized allClips to avoid flatMap inside the 60fps loop
  const allClips = useMemo(() => tracks.flatMap((t) => t.clips || []), [tracks]);
  const allClipsRef = useRef(allClips);
  useEffect(() => {
    allClipsRef.current = allClips;
  }, [allClips]);

  // Memoized tracks signature to prevent unnecessary redraws
  const tracksSignature = useMemo(() => {
    return tracks.map(t => `${t.id}:${t.clips.length}:${t.hidden}`).join('|');
  }, [tracks]);

  // Clean up unused particle pools to prevent memory leaks
  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => c.id));
    for (const clipId of particlePoolsRef.current.keys()) {
        if (!allClipIds.has(clipId)) {
          particlePoolsRef.current.delete(clipId);
        }
      }
  }, [allClips]);

  // Clean up unused offscreen canvases to prevent memory leaks
  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => `clip_${c.id}`));
    for (const key of offscreenCanvasPool.current.keys()) {
      if (key.startsWith('clip_') && !allClipIds.has(key)) {
        offscreenCanvasPool.current.delete(key);
      }
    }
  }, [allClips]);

  // BUG-M2: Clear particle pools on seek/scrub to prevent stale particles
  const prevTimeRef = useRef(currentTime);
  useEffect(() => {
    if (Math.abs(currentTime - prevTimeRef.current) > 0.1) {
      particlePoolsRef.current.clear();
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);
  
  // Hand tool panning state
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const [imageRevision, setImageRevision] = useState(0);
  const requestRedraw = useCallback(() => setImageRevision((r) => r + 1), []);

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
    useProxies
  });

  // FIX H3: only request a redraw when at least one tracked field changed.
  // `framePendingRef.current = true` previously fired on every store change
  // (e.g. selectedClipIds toggle, pipWindow text edit) which forced full
  // canvas redraws even when nothing visible changed. Now we compare the
  // previous capture with the latest selector snapshot and only set
  // framePendingRef when something actually moved.
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
      useProxies
    };
    const prev = previousRenderDepsRef.current;
    if (
      !prev ||
      prev.currentTime !== currentTime ||
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
        currentTime, tracksSignature, selectedClipId, mediaLibrary, videoElements,
        frameCache, imageRevision, requestRedraw, viewport, settings,
        showGrid, canvasBgColor, isPlaying, aspectRatio, isExporting,
        exportWidth, exportHeight, showProgressBar, progressBarColor,
        progressBarHeight, useProxies
      };
    }
  }, [currentTime, tracksSignature, selectedClipId, mediaLibrary, videoElements, frameCache, imageRevision, requestRedraw, viewport, settings, showGrid, canvasBgColor, isPlaying, aspectRatio, isExporting, exportWidth, exportHeight, showProgressBar, progressBarColor, progressBarHeight, useProxies]);
  
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
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

  // Listen to frame update events from useMediaPlayback (like seek complete)
  useEffect(() => {
    const handleFrameUpdate = () => {
      // ONLY redraw if not playing! (During playback, requestAnimationFrame is already redrawing at 60 FPS)
      if (!useEditorStore.getState().isPlaying) {
        requestRedraw();
      }
    };
    window.addEventListener('procut-frame-updated', handleFrameUpdate);
    return () => window.removeEventListener('procut-frame-updated', handleFrameUpdate);
  }, [requestRedraw]);

  // Register canvas with store
  useEffect(() => {
    if (canvasRef.current && !previewCanvas) {
      setPreviewCanvas(canvasRef.current);
    }
  }, [setPreviewCanvas, previewCanvas]);

  // Keep a mutable ref of currentTime so the playback loop effect doesn't tear down/setup on every frame
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
      // Synchronously catch external seeks to prevent race conditions
      return useEditorStore.subscribe(
        (state) => {
          if (!state.isPlaying || Math.abs(state.currentTime - currentTimeRef.current) > 0.1) {
            currentTimeRef.current = state.currentTime;
          }
        }
      );
    }, []);
    
    // Fallback sync just in case
    useEffect(() => {
      if (!useEditorStore.getState().isPlaying || Math.abs(currentTime - currentTimeRef.current) > 0.1) {
         currentTimeRef.current = currentTime;
      }
    }, [currentTime]);

  // -------------------------------------------------------------------

  // -------------------------------------------------------------------
  // Canvas rendering Ã¢â‚¬â€œ called whenever time, tracks, or images change
  // -------------------------------------------------------------------
  const renderCanvas = useCallback(async () => {
    const {
      currentTime,
      tracks: tracksRaw,
      selectedClipId,
      mediaLibrary: mediaLibraryRaw,
      videoElements,
      frameCache: frameCacheRaw,
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
      useProxies
    } = renderDepsRef.current;

    const tracks = tracksRaw as TimelineTrack[];
    const mediaLibrary = mediaLibraryRaw as MediaItem[];
    const frameCache = frameCacheRaw as Map<string, FrameCacheEntry[]>;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Double buffering: render to offscreen composite canvas, then blit Ã¢â€â‚¬Ã¢â€â‚¬
    const composite = getOrCreateCanvas('composite', canvas.width, canvas.height);
    // BUG-H1: Clear context on resize to re-apply willReadFrequently
    if (composite.width !== canvas.width || composite.height !== canvas.height) {
      composite.width = canvas.width;
      composite.height = canvas.height;
      compositeCtxRef.current = null;
    }
    
    // Use cached 2D context to avoid expensive getContext() call every frame
    if (!compositeCtxRef.current) {
      compositeCtxRef.current = composite.getContext('2d', { willReadFrequently: !settings.hardwareAcceleration }) || null;
    }
    if (!compositeCtxRef.current) return;
    const ctx = compositeCtxRef.current;
    // Throttle expensive operations during scrubbing (env variable set)
    const skipExpensiveFX = !isPlaying;

    // Measure frame time delta for particles
    const now = performance.now();
    const lastTime = lastParticleTimeRef.current ?? now;
    lastParticleTimeRef.current = now;
    let rawDelta = 0;
    if (isPlaying && lastParticleTimeRef.current !== null) {
      rawDelta = now - lastTime;
      // If delta is unexpectedly large (e.g., after tab switch/resume), reset it
      if (rawDelta > 300) {
        rawDelta = 16.67; // assume normal frame
      }
    }
    const deltaMs = Math.min(100, rawDelta); // clamp to 100ms max to prevent physics jumps

    const W_target = 854;
    const H_target = 480;
    const canvas_scale = canvas.width / W_target;

    // OPTIMIZATION: Dynamically scale down pixel-heavy effects by 50% during playback (unless exporting)
    const DOWNSCALE = (isPlaying && !isExporting) ? 0.5 : 1.0;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Frame gate: during scrubbing, check if videos are ready or have cached frames Ã¢â€â‚¬Ã¢â€â‚¬
    // If a video is seeking AND we have no cached frame for it, retain the last frame.
    if (!isPlaying) {
      const allVideoTracks = tracks.filter((t) => t.type === 'video' && !t.hidden);
      let needsWait = false;
      for (const track of allVideoTracks) {
        for (const clip of track.clips) {
          if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
            const mi = mediaLibrary.find((m) => m.id === clip.mediaId);
            if (mi && mi.type === 'video') {
              const videoEl = videoElements.get(clip.id);
              if (videoEl && (videoEl.seeking || videoEl.readyState < 2)) {
                // Check if we have a cached frame close enough to use
                const clipCache = frameCache.get(clip.id);
                const mediaTime = getMediaTimeForClip({
                  id: clip.id, startTime: clip.startTime,
                  duration: clip.duration, trimStart: clip.trimStart,
                  speed: clip.speed, speedRamp: (clip as any).speedRamp
                }, currentTime);
                const roundedTime = Math.round(mediaTime * 30) / 30;
                const hasCached = clipCache?.some(f => Math.abs(f.time - roundedTime) < 0.05);
                if (!hasCached) {
                  needsWait = true;
                  break;
                }
              }
            }
          }
        }
        if (needsWait) break;
      }

      if (needsWait) {
        // No cached frame available Ã¢â‚¬â€ show the last good frame instead of flashing
        const mainCtx = canvas.getContext('2d');
        if (mainCtx && lastFrameCanvasRef.current && lastFrameCanvasRef.current.width > 0) {
          mainCtx.drawImage(lastFrameCanvasRef.current, 0, 0);
        }
        return;
      }
    }

    // 1. Clear to background color (entire composite canvas)
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, composite.width, composite.height);

    ctx.save();
    ctx.scale(canvas_scale, canvas_scale);

    let viewW = W_target;
    let viewH = H_target;
    if (aspectRatio === '9:16') {
      viewW = Math.round(H_target * (9 / 16));
    } else if (aspectRatio === '1:1') {
      viewW = H_target;
    } else if (aspectRatio === '4:3') {
      viewW = Math.round(H_target * (4 / 3));
    }
    const W = viewW;
    const H = viewH;
    const offsetX = (W_target - viewW) / 2;
    const offsetY = (H_target - viewH) / 2;

    const cx = W_target / 2;
    const cy = H_target / 2;
    const totalX = cx + viewport.x - cx * viewport.zoom;
    const totalY = cy + viewport.y - cy * viewport.zoom;

    ctx.save();
    ctx.translate(totalX, totalY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw active aspect ratio frame boundary (so user can see the workspace bounds)
    ctx.strokeStyle = '#3e3e3e';
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.strokeRect(offsetX, offsetY, viewW, viewH);

    // Clip rendering to the active aspect ratio frame
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, viewW, viewH);
    ctx.clip();

    ctx.translate(offsetX, offsetY);

    // 2. Checkerboard removed per user request

    // 3. Collect visual tracks (video first, then text on top)
    // Video tracks: lower index number = bottom layer
    // Text tracks always render on top of all video
    const videoTracks = tracks
      .filter((t) => t.type === 'video' && !t.hidden)
      .sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
    const textTracks = tracks.filter((t) => t.type === 'text' && !t.hidden);
    const visualTracks = [...videoTracks, ...textTracks];

    let anyClipDrawn = false;

    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const drawHeart = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + h * 0.15);
      ctx.bezierCurveTo(
        cx, cy - h * 0.35,
        cx - w * 0.5, cy - h * 0.35,
        cx - w * 0.5, cy + h * 0.15
      );
      ctx.bezierCurveTo(
        cx - w * 0.5, cy + h * 0.4,
        cx, cy + h * 0.45,
        cx, cy + h * 0.45
      );
      ctx.bezierCurveTo(
        cx, cy + h * 0.45,
        cx + w * 0.5, cy + h * 0.4,
        cx + w * 0.5, cy + h * 0.15
      );
      ctx.bezierCurveTo(
        cx + w * 0.5, cy - h * 0.35,
        cx, cy - h * 0.35,
        cx, cy + h * 0.15
      );
      ctx.closePath();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
    };

    let inMatteRendering = false;

    const applyClipMaskOffscreen = async (
      oCtx: CanvasRenderingContext2D,
      mask: any,
      ow: number,
      oh: number,
      clipId: string,
      clipStartTime: number,
      animations: any
    ) => {
      if (!mask || !mask.enabled) return;
      
      const mX = getAnimatedValue(mask.x ?? 50, currentTime, clipStartTime, animations?.['mask.x']);
      const mY = getAnimatedValue(mask.y ?? 50, currentTime, clipStartTime, animations?.['mask.y']);
      const mW = getAnimatedValue(mask.width ?? 50, currentTime, clipStartTime, animations?.['mask.width']);
      const mH = getAnimatedValue(mask.height ?? 50, currentTime, clipStartTime, animations?.['mask.height']);
      const mRot = getAnimatedValue(mask.rotation ?? 0, currentTime, clipStartTime, animations?.['mask.rotation']);
      const mFeather = getAnimatedValue(mask.feather ?? 0, currentTime, clipStartTime, animations?.['mask.feather']);
      const mRoundness = getAnimatedValue(mask.roundness ?? 0, currentTime, clipStartTime, animations?.['mask.roundness']);
      
      const mx = (mX / 100) * ow;
      const my = (mY / 100) * oh;
      const mw = (mW / 100) * ow;
      const mh = (mH / 100) * oh;
      const feather = (mFeather / 100) * Math.min(ow, oh);
      
      const maskCanvas = getOrCreateCanvas('clip_mask_temp_' + clipId, ow, oh);
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.clearRect(0, 0, ow, oh);
      
      maskCtx.save();
      maskCtx.translate(mx, my);
      maskCtx.rotate((mRot * Math.PI) / 180);
      
      if (feather > 0) {
        maskCtx.filter = `blur(${feather}px)`;
      }
      
      maskCtx.fillStyle = '#FFFFFF';
      
      if (mask.type === 'rectangle') {
        const rx = -mw / 2;
        const ry = -mh / 2;
        const cornerRadius = (mRoundness / 100) * Math.min(mw, mh) / 2;
        if (cornerRadius > 0) {
          drawRoundedRect(maskCtx, rx, ry, mw, mh, cornerRadius);
          maskCtx.fill();
        } else {
          maskCtx.fillRect(rx, ry, mw, mh);
        }
      } else if (mask.type === 'circle') {
        const mr = mw / 2;
        maskCtx.beginPath();
        maskCtx.arc(0, 0, mr, 0, Math.PI * 2);
        maskCtx.fill();
      } else if (mask.type === 'split') {
        maskCtx.fillRect(-ow * 10, 0, ow * 20, oh * 10);
      } else if (mask.type === 'filmstrip') {
        maskCtx.fillRect(-ow * 10, -mh / 2, ow * 20, mh);
      } else if (mask.type === 'heart') {
        drawHeart(maskCtx, 0, 0, mw, mh);
        maskCtx.fill();
      } else if (mask.type === 'star') {
        drawStar(maskCtx, 0, 0, 5, mw / 2, mw / 4);
        maskCtx.fill();
      } else if (mask.type === 'matte' && mask.matteSourceClipId && !inMatteRendering) {
        const state = useEditorStore.getState();
        const sourceClip = findClipDeep(state, mask.matteSourceClipId);
        if (sourceClip) {
          inMatteRendering = true;
          maskCtx.restore();
          maskCtx.save();
          await drawSingleClip(sourceClip, 1, undefined, maskCtx);
          
          const matteData = maskCtx.getImageData(0, 0, ow, oh);
          const pixels = matteData.data;
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            pixels[i + 3] = (lum / 255) * a;
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 255;
          }
          maskCtx.putImageData(matteData, 0, 0);
          inMatteRendering = false;
        }
      }
      
      maskCtx.restore();
      
      if (mask.invert) {
        maskCtx.save();
        maskCtx.globalCompositeOperation = 'source-out';
        maskCtx.fillStyle = '#FFFFFF';
        maskCtx.fillRect(0, 0, ow, oh);
        maskCtx.restore();
      }
      
      oCtx.save();
      oCtx.globalCompositeOperation = 'destination-in';
      oCtx.drawImage(maskCanvas, 0, 0);
      oCtx.restore();
    };

    // Helper to draw a single clip with custom opacity/transform multipliers
    const drawSingleClip = async (
      clip: any,
      opacityMultiplier: number = 1,
      extraTransform?: { translateX?: number; translateY?: number; scale?: number },
      targetCtx?: CanvasRenderingContext2D
    ) => {
      const ctx = targetCtx || compositeCtxRef.current;
      if (!ctx) return;
      let mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
      if (!mediaItem) {
        if (clip.mediaId === 'text-placeholder' || clip.textSettings || clip.id?.startsWith('clip_subtitle') || clip.id?.startsWith('clip_typo')) {
          mediaItem = {
            id: clip.mediaId,
            name: 'Text',
            type: 'text',
            duration: clip.duration,
            url: '',
            createdAt: Date.now()
          };
        }
      }
      if (!mediaItem) return;

      // Get animated values
      let aOpacity = getAnimatedValue(clip.opacity, currentTime, clip.startTime, clip.animations?.['opacity']);
      
      // FIX: Remove per-clip transition opacity handling - transitions are now handled at the queue level
      // to prevent double-application when both single-clip and cross-fade transitions are active
      const localTime = currentTime - clip.startTime;
      
      // Only apply slide effect (visual transform, not opacity)
      let slideX = 0;
      if (clip.transitionIn?.type === 'slide' && localTime >= 0 && localTime < (clip.transitionIn.duration || 1)) {
        const tDur = clip.transitionIn.duration || 1;
        slideX = (1 - (localTime / tDur)) * -1000;
      } else if (clip.transitionOut?.type === 'slide' && localTime > clip.duration - (clip.transitionOut.duration || 1) && localTime <= clip.duration) {
        const tDur = clip.transitionOut.duration || 1;
        slideX = ((localTime - (clip.duration - tDur)) / tDur) * 1000;
      }

      const aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
      const aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
      const aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
      const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

      const aCropTop = getAnimatedValue(clip.crop?.top || 0, currentTime, clip.startTime, clip.animations?.['crop.top']);
      const aCropBot = getAnimatedValue(clip.crop?.bottom || 0, currentTime, clip.startTime, clip.animations?.['crop.bottom']);
      const aCropLeft = getAnimatedValue(clip.crop?.left || 0, currentTime, clip.startTime, clip.animations?.['crop.left']);
      const aCropRight = getAnimatedValue(clip.crop?.right || 0, currentTime, clip.startTime, clip.animations?.['crop.right']);

      const aRotX = getAnimatedValue(clip.transform.rotationX ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationX']);
      const aRotY = getAnimatedValue(clip.transform.rotationY ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationY']);

      const hasPerspectiveWarp = !!(clip.transform.perspectivePin || Math.abs(aRotX) > 0.01 || Math.abs(aRotY) > 0.01);

      // Set up transform
      ctx.save();
      ctx.globalAlpha = aOpacity * opacityMultiplier;
      ctx.globalCompositeOperation = clip.transform.blendMode || 'source-over';

      const cx = W / 2;
      const cy = H / 2;

      let corners: LocalCornerPoints | null = null;
      if (hasPerspectiveWarp) {
        if (clip.transform.perspectivePin) {
          const pc = clip.transform.perspectiveCorners || { x0: 0, y0: 0, x1: 854, y1: 0, x2: 854, y2: 480, x3: 0, y3: 480 };
          
          let trackedCorners = null;
          const trackingData = clip.transform.perspectiveTrackingData;
          if (trackingData && trackingData.length > 0) {
            // Find closest frame data
            const localTime = currentTime - clip.startTime;
            let closestDist = Infinity;
            for (const pt of trackingData) {
              const dist = Math.abs(pt.time - localTime);
              if (dist < closestDist) {
                closestDist = dist;
                trackedCorners = pt.corners;
              }
            }
          }

          if (trackedCorners) {
            corners = { ...trackedCorners };
          } else {
            corners = {
              x0: getAnimatedValue(pc.x0, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x0']),
              y0: getAnimatedValue(pc.y0, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y0']),
              x1: getAnimatedValue(pc.x1, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x1']),
              y1: getAnimatedValue(pc.y1, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y1']),
              x2: getAnimatedValue(pc.x2, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x2']),
              y2: getAnimatedValue(pc.y2, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y2']),
              x3: getAnimatedValue(pc.x3, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x3']),
              y3: getAnimatedValue(pc.y3, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y3']),
            };
          }

          if (corners) {
            const ccx = (corners.x0 + corners.x1 + corners.x2 + corners.x3) / 4;
            const ccy = (corners.y0 + corners.y1 + corners.y2 + corners.y3) / 4;
            const scale = aScale / 100;
            const rotRad = (aRot * Math.PI) / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);

            const transformCorner = (x: number, y: number) => {
              let dx = x - ccx;
              let dy = y - ccy;
              dx *= scale;
              dy *= scale;
              const rx = dx * cos - dy * sin;
              const ry = dx * sin + dy * cos;
              return { x: ccx + rx + aX, y: ccy + ry + aY };
            };

            corners = {
              x0: transformCorner(corners.x0, corners.y0).x, y0: transformCorner(corners.x0, corners.y0).y,
              x1: transformCorner(corners.x1, corners.y1).x, y1: transformCorner(corners.x1, corners.y1).y,
              x2: transformCorner(corners.x2, corners.y2).x, y2: transformCorner(corners.x2, corners.y2).y,
              x3: transformCorner(corners.x3, corners.y3).x, y3: transformCorner(corners.x3, corners.y3).y,
            };
          }
        } else {
          // Calculate projected corners from 3D rotation
          const vw = mediaItem.width || 854;
          const vh = mediaItem.height || 480;
          const fitScale = Math.min(W / vw, H / vh);
          corners = getProjectedCorners(
            vw, vh,
            (aScale / 100) * fitScale,
            aRotX, aRotY, aRot, // Z-rotation is aRot
            aX, aY,
            cx, cy
          );
        }
      }

      if (!hasPerspectiveWarp) {
        let tx = cx;
        let ty = cy;
        if (extraTransform?.translateX !== undefined) tx += extraTransform.translateX;
        if (extraTransform?.translateY !== undefined) ty += extraTransform.translateY;

        ctx.translate(tx, ty);
        ctx.translate(aX, aY);

        let finalScale = aScale / 100;
        if (extraTransform?.scale !== undefined) {
          finalScale *= extraTransform.scale;
        }
        const scaleX = finalScale * (clip.transform?.flipH ? -1 : 1);
        const scaleY = finalScale * (clip.transform?.flipV ? -1 : 1);
        ctx.scale(scaleX, scaleY);
        ctx.rotate((aRot * Math.PI) / 180);
      }

      // Dynamic filters using keyframe animations
      const filters = {
        temperature: getAnimatedValue(clip.colorFilters?.temperature ?? 0, currentTime, clip.startTime, clip.animations?.['color.temperature']),
        tint: getAnimatedValue(clip.colorFilters?.tint ?? 0, currentTime, clip.startTime, clip.animations?.['color.tint']),
        exposure: getAnimatedValue(clip.colorFilters?.exposure ?? 0, currentTime, clip.startTime, clip.animations?.['color.exposure']),
        contrast: getAnimatedValue(clip.colorFilters?.contrast ?? 100, currentTime, clip.startTime, clip.animations?.['color.contrast']),
        saturation: getAnimatedValue(clip.colorFilters?.saturation ?? 100, currentTime, clip.startTime, clip.animations?.['color.saturation']),
        blur: getAnimatedValue(clip.colorFilters?.blur ?? 0, currentTime, clip.startTime, clip.animations?.['color.blur']),
        fadedFilm: getAnimatedValue(clip.colorFilters?.fadedFilm ?? 0, currentTime, clip.startTime, clip.animations?.['color.fadedFilm']),
        vignette: getAnimatedValue(clip.colorFilters?.vignette ?? 0, currentTime, clip.startTime, clip.animations?.['color.vignette']),
        shadows: clip.colorFilters?.shadows,
        midtones: clip.colorFilters?.midtones,
        highlights: clip.colorFilters?.highlights,
      };

      // Check for active FX on the track this clip belongs to
      const fxTrack = tracks.find((t) => t.type === 'fx' && t.linkedTrackId === clip.trackId && !t.hidden);
      let activeFxClip: any = null;
      if (fxTrack) {
        activeFxClip = fxTrack.clips.find((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration) || null;
      }

      // Pre-process VFX Breakdown clip effect
      let vfxProgress = 0;
      if (activeFxClip && activeFxClip.fxSettings?.type === 'vfx_breakdown') {
         vfxProgress = (currentTime - activeFxClip.startTime) / activeFxClip.duration;
         vfxProgress = Math.max(0, Math.min(1, vfxProgress));
      }

      // ---------------------------------------------------------------
      // Draw the actual media content
      // ---------------------------------------------------------------
      let dw = W;
      let dh = H;
      let dx = -W / 2;
      let dy = -H / 2;
      let hasRealMedia = false;

      // Ensure crops are sanitized and don't sum up to >= 100% (which would yield 0 or negative width/height)
      let cTop = aCropTop / 100;
      let cBot = aCropBot / 100;
      let cLeft = aCropLeft / 100;
      let cRight = aCropRight / 100;

      if (cLeft + cRight >= 1.0) {
        const sum = cLeft + cRight;
        cLeft = (cLeft / sum) * 0.99;
        cRight = (cRight / sum) * 0.99;
      }
      if (cTop + cBot >= 1.0) {
        const sum = cTop + cBot;
        cTop = (cTop / sum) * 0.99;
        cBot = (cBot / sum) * 0.99;
      }

      // Sanitize filter properties to prevent NaN values from crashing canvas filter parser
      filters.exposure = Number.isFinite(filters.exposure) ? filters.exposure : 0;
      filters.contrast = Number.isFinite(filters.contrast) ? filters.contrast : 100;
      filters.saturation = Number.isFinite(filters.saturation) ? filters.saturation : 100;
      filters.blur = Number.isFinite(filters.blur) ? filters.blur : 0;
      filters.temperature = Number.isFinite(filters.temperature) ? filters.temperature : 0;
      filters.tint = Number.isFinite(filters.tint) ? filters.tint : 0;
      
      const { exposure, contrast, saturation, blur } = filters;

      const applyFxToContext = (
        oCtx: CanvasRenderingContext2D,
        w: number,
        h: number,
        fxClip: any
      ) => {
        const fx = fxClip.fxSettings;
        const dw = w;
        const dh = h;
        const pxW = w;
        const pxH = h;
        
        const rand = (n: number) => {
          const seed = Math.floor(currentTime * 30);
          return ((Math.sin(seed * 7.3 + n * 113.7) * 43758.5) % 1 + 1) % 1;
        };

        oCtx.save();
        
        if (fx?.type === 'vfx_breakdown') {
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.beginPath();
          oCtx.rect(-dw / 2, -dh / 2, dw * vfxProgress, dh);
          oCtx.clip();

          if (mediaItem.type === 'video') {
          if (useProxies) {
             ctx.save();
             ctx.setTransform(1,0,0,1,0,0);
             ctx.fillStyle = 'rgba(0,0,0,0.5)';
             ctx.fillRect(10, 10, 80, 30);
             ctx.fillStyle = '#10b981';
             ctx.font = '16px monospace';
             ctx.textAlign = 'left';
             ctx.textBaseline = 'top';
             ctx.fillText('[PROXY]', 15, 15);
             ctx.restore();
          }

            const videoEl = videoElements.get(clip.id);
            if (videoEl && videoEl.readyState >= 2) {
              const vw = videoEl.videoWidth || w;
              const vh = videoEl.videoHeight || h;
              const scale = Math.min(w / vw, h / vh);
              const baseDw = vw * scale;
              const baseDh = vh * scale;
              const sx = vw * cLeft;
              const sy = vh * cTop;
              const sw = Math.max(1, vw * (1 - cLeft - cRight));
              const sh = Math.max(1, vh * (1 - cTop - cBot));
              const drawW = Math.max(1, baseDw * (1 - cLeft - cRight));
              const drawH = Math.max(1, baseDh * (1 - cTop - cBot));
              const dx = -baseDw / 2 + baseDw * cLeft;
              const dy = -baseDh / 2 + baseDh * cTop;
              oCtx.filter = `brightness(${120 + exposure}%) contrast(150%) saturate(200%)`;
              oCtx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, drawW, drawH);
              oCtx.filter = 'none';
              applyColorOverlays(oCtx, dx, dy, drawW, drawH, { ...filters, contrast: 150, saturation: 200 });
            }
          }

          oCtx.beginPath();
          oCtx.moveTo(-dw / 2 + dw * vfxProgress, -dh / 2);
          oCtx.lineTo(-dw / 2 + dw * vfxProgress,  dh / 2);
          oCtx.lineWidth = 4;
          oCtx.strokeStyle = '#3b82f6';
          oCtx.shadowColor = '#3b82f6';
          oCtx.shadowBlur = 15;
          oCtx.stroke();
          oCtx.restore();

        } else if (fx?.type === 'bw_to_color') {
          const progress = (currentTime - fxClip.startTime) / fxClip.duration;
          const p = Math.max(0, Math.min(1, progress));
          if (p < 1) {
            const imgData = oCtx.getImageData(0, 0, w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i]     = Math.round(luma + (data[i]     - luma) * p);
              data[i + 1] = Math.round(luma + (data[i + 1] - luma) * p);
              data[i + 2] = Math.round(luma + (data[i + 2] - luma) * p);
            }
            oCtx.putImageData(imgData, 0, 0);
          }

        } else if (fx?.type === 'old_film') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 24);
          let rngState = (seed * 0x9e3779b9 + 1) >>> 0;
          const randF = () => {
            rngState ^= rngState << 13;
            rngState ^= rngState >>> 17;
            rngState ^= rngState << 5;
            return ((rngState >>> 0) & 0xFFFF) / 0x10000;
          };

          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalCompositeOperation = 'multiply';
          oCtx.globalAlpha = 0.35 * intensity;
          oCtx.fillStyle = 'rgb(200,160,110)';
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

          const grainW = Math.max(1, Math.round(dw / 2));
          const grainH = Math.max(1, Math.round(dh / 2));
          const grainData = new Uint8ClampedArray(grainW * grainH * 4);
          const grainAlpha = Math.round(0.18 * intensity * 0.6 * 255);
          for (let gi = 0; gi < grainW * grainH; gi++) {
            const v = randF() > 0.5 ? 255 : 0;
            const off = gi * 4;
            grainData[off]     = v;
            grainData[off + 1] = v;
            grainData[off + 2] = v;
            grainData[off + 3] = grainAlpha;
          }
          const grainImg = new ImageData(grainData, grainW, grainH);
          const grainOffscreen = getOrCreateCanvas('grain', grainW, grainH);
          const gCtx = grainOffscreen.getContext('2d');
          if (gCtx) {
            gCtx.putImageData(grainImg, 0, 0);
            oCtx.save();
            oCtx.imageSmoothingEnabled = false;
            oCtx.drawImage(grainOffscreen, -dw / 2, -dh / 2, dw, dh);
            oCtx.restore();
          }

          if (randF() > 0.85) {
            oCtx.save();
            oCtx.globalAlpha = 0.5 * intensity;
            oCtx.strokeStyle = 'rgba(255,240,180,0.7)';
            oCtx.lineWidth = 1;
            const scratchX = -dw / 2 + randF() * dw;
            oCtx.beginPath();
            oCtx.moveTo(scratchX, -dh / 2);
            oCtx.lineTo(scratchX + (randF() - 0.5) * 10, dh / 2);
            oCtx.stroke();
            oCtx.restore();
          }

          oCtx.save();
          const vig = oCtx.createRadialGradient(0, 0, dw * 0.3, 0, 0, dw * 0.7);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, `rgba(0,0,0,${0.55 * intensity})`);
          oCtx.fillStyle = vig;
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'vhs') {
          const intensity = (fx.intensity ?? 100) / 100;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.25 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.fillStyle = 'rgba(255,0,0,0.15)';
          oCtx.fillRect(-dw / 2 + 6 * intensity, -dh / 2, dw, dh);
          oCtx.fillStyle = 'rgba(0,0,255,0.15)';
          oCtx.fillRect(-dw / 2 - 6 * intensity, -dh / 2, dw, dh);
          oCtx.restore();

          oCtx.save();
          const scanW = Math.max(1, Math.round(w));
          const scanH = Math.max(1, Math.round(h));
          const scanData = new Uint8ClampedArray(scanW * scanH * 4);
          const scanAlpha = Math.round(0.2 * intensity * 0.9 * 255);
          for (let row = 0; row < scanH; row++) {
            if (row % 3 === 0) {
              const rowOff = row * scanW * 4;
              for (let col = 0; col < scanW; col++) {
                const off = rowOff + col * 4;
                scanData[off + 3] = scanAlpha;
              }
            }
          }
          const scanImg = new ImageData(scanData, scanW, scanH);
          const scanOffscreen = getOrCreateCanvas('scan', scanW, scanH);
          const sCtx = scanOffscreen.getContext('2d');
          if (sCtx) {
            sCtx.putImageData(scanImg, 0, 0);
            oCtx.globalAlpha = 1;
            oCtx.drawImage(scanOffscreen, -dw / 2, -dh / 2, dw, dh);
          }
          oCtx.restore();

          if (rand(1) > 0.7) {
            oCtx.save();
            oCtx.globalAlpha = 0.3 * intensity;
            const bandY = -dh / 2 + rand(2) * dh;
            oCtx.fillStyle = 'rgba(255,255,255,0.15)';
            oCtx.fillRect(-dw / 2, bandY, dw, 4 + rand(3) * 20);
            oCtx.restore();
          }

          oCtx.save();
          oCtx.globalCompositeOperation = 'multiply';
          oCtx.globalAlpha = 0.12 * intensity;
          oCtx.fillStyle = 'rgb(180,255,180)';
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'cinematic_bars') {
          const barH = dh * 0.105;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.fillStyle = 'rgb(0,0,0)';
          oCtx.fillRect(-dw / 2, -dh / 2,       dw, barH);
          oCtx.fillRect(-dw / 2,  dh / 2 - barH, dw, barH);
          oCtx.restore();

        } else if (fx?.type === 'neon_glow') {
          const intensity = (fx.intensity ?? 100) / 100;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.45 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.filter = `blur(${6 * intensity}px) brightness(1.8)`;
          oCtx.drawImage(oCtx.canvas, -dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

          oCtx.save();
          oCtx.globalAlpha = 0.15 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          const neonGrad = oCtx.createLinearGradient(-dw / 2, 0, dw / 2, 0);
          neonGrad.addColorStop(0, 'rgba(255,0,200,0.8)');
          neonGrad.addColorStop(1, 'rgba(0,200,255,0.8)');
          oCtx.fillStyle = neonGrad;
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'rgb_split') {
          const intensity = (fx.intensity ?? 100) / 100;
          const shift = intensity * 14;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.55;
          oCtx.globalCompositeOperation = 'screen';

          const offR = getOrCreateCanvas('rgb_split_r', w, h);
          const ctxR = offR.getContext('2d')!;
          ctxR.clearRect(0, 0, w, h);
          ctxR.drawImage(oCtx.canvas, 0, 0, w, h);
          const dR = ctxR.getImageData(0, 0, w, h);
          for (let i = 0; i < dR.data.length; i += 4) { dR.data[i+1] = 0; dR.data[i+2] = 0; }
          ctxR.putImageData(dR, 0, 0);
          oCtx.drawImage(offR, -dw / 2 - shift, -dh / 2, dw, dh);

          const offB = getOrCreateCanvas('rgb_split_b', w, h);
          const ctxB = offB.getContext('2d')!;
          ctxB.clearRect(0, 0, w, h);
          ctxB.drawImage(oCtx.canvas, 0, 0, w, h);
          const dB = ctxB.getImageData(0, 0, w, h);
          for (let i = 0; i < dB.data.length; i += 4) { dB.data[i] = 0; dB.data[i+1] = 0; }
          ctxB.putImageData(dB, 0, 0);
          oCtx.drawImage(offB, -dw / 2 + shift, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'pixelate') {
          const intensity = (fx.intensity ?? 100) / 100;
          const blockSize = Math.max(2, Math.round(intensity * 24));
          const tmpW = Math.max(1, Math.round(w / blockSize));
          const tmpH = Math.max(1, Math.round(h / blockSize));
          const tmp = getOrCreateCanvas('pixelate', tmpW, tmpH);
          const tCtx = tmp.getContext('2d')!;
          tCtx.clearRect(0, 0, tmpW, tmpH);
          tCtx.drawImage(oCtx.canvas, 0, 0, w, h, 0, 0, tmpW, tmpH);
          tCtx.imageSmoothingEnabled = false;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          (oCtx as any).imageSmoothingEnabled = false;
          oCtx.drawImage(tmp, 0, 0, tmpW, tmpH, -dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'mirror') {
          const halfW = Math.max(1, Math.round(w / 2));
          const leftData = oCtx.getImageData(0, 0, halfW, h);
          const flip = getOrCreateCanvas('mirror', halfW, h);
          const fCtx = flip.getContext('2d')!;
          fCtx.clearRect(0, 0, halfW, h);
          fCtx.putImageData(leftData, 0, 0);
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.scale(-1, 1);
          oCtx.drawImage(flip, 0, 0, halfW, h, -dw / 2, -dh / 2, dw / 2, dh);
          oCtx.restore();

        } else if (fx?.type === 'zoom_blur') {
          const intensity = (fx.intensity ?? 100) / 100;
          const steps = Math.round(6 + intensity * 8);
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.25 / steps;
          for (let i = 1; i <= steps; i++) {
            const s = 1 + (i / steps) * 0.1 * intensity;
            oCtx.save();
            oCtx.scale(s, s);
            oCtx.drawImage(oCtx.canvas, -dw / 2, -dh / 2, dw, dh);
            oCtx.restore();
          }
          oCtx.restore();

        } else if (fx?.type === 'lens_flare') {
          const intensity = (fx.intensity ?? 100) / 100;
          const fcx = dw * 0.2, fcy = -dh * 0.25;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalCompositeOperation = 'screen';
          const flareGrad = oCtx.createRadialGradient(fcx, fcy, 0, fcx, fcy, 90 * intensity);
          flareGrad.addColorStop(0,    `rgba(255,255,220,${0.9  * intensity})`);
          flareGrad.addColorStop(0.15, `rgba(255,200,100,${0.5  * intensity})`);
          flareGrad.addColorStop(0.5,  `rgba(200,180,255,${0.15 * intensity})`);
          flareGrad.addColorStop(1,    'rgba(0,0,0,0)');
          oCtx.fillStyle = flareGrad;
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          
          oCtx.globalAlpha = 0.35 * intensity;
          const streakGrad = oCtx.createLinearGradient(-dw / 2, fcy, dw / 2, fcy);
          streakGrad.addColorStop(0,   'rgba(100,150,255,0)');
          streakGrad.addColorStop(0.5, `rgba(150,210,255,${0.85 * intensity})`);
          streakGrad.addColorStop(1,   'rgba(100,150,255,0)');
          oCtx.fillStyle = streakGrad;
          oCtx.fillRect(-dw / 2, fcy - 2, dw, 4);
          oCtx.restore();

        } else if (fx?.type === 'night_vision') {
          const intensity = (fx.intensity ?? 100) / 100;
          const imgData = oCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const seed = Math.floor(currentTime * 30);
          const randNV = (n: number) => ((Math.sin(seed * 3.1 + n * 91.7) * 43758.5) % 1 + 1) % 1;
          for (let i = 0; i < data.length; i += 4) {
            const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const noise = (randNV(i * 0.001) - 0.5) * 30 * intensity;
            const v = Math.min(255, Math.max(0, luma * 1.4 + noise));
            data[i]     = 0;
            data[i + 1] = Math.round(v);
            data[i + 2] = 0;
          }
          oCtx.putImageData(imgData, 0, 0);

          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.12 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 2) {
            oCtx.fillStyle = 'rgba(0,0,0,0.9)';
            oCtx.fillRect(-dw / 2, row, dw, 1);
          }
          oCtx.restore();

        } else if (fx?.type === 'thermal') {
          const intensity = (fx.intensity ?? 100) / 100;
          const imgData = oCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const mix = (a: number, b: number, t: number) => a + (b - a) * t;
          for (let i = 0; i < data.length; i += 4) {
            const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
            let r = 0, g = 0, b2 = 0;
            if      (luma < 0.25) { const t = luma / 0.25;        r = 0;          g = 0;          b2 = mix(128, 255, t); }
            else if (luma < 0.5)  { const t = (luma-0.25)/0.25;   r = 0;          g = mix(0,255,t);  b2 = mix(255,255,t); }
            else if (luma < 0.75) { const t = (luma-0.5)/0.25;    r = mix(0,255,t); g = mix(255,255,t); b2 = mix(255,0,t); }
            else                  { const t = (luma-0.75)/0.25;   r = mix(255,255,t); g = mix(255,0,t); b2 = 0; }
            data[i]     = Math.round(mix(data[i],     r,  intensity));
            data[i + 1] = Math.round(mix(data[i + 1], g,  intensity));
            data[i + 2] = Math.round(mix(data[i + 2], b2, intensity));
          }
          oCtx.putImageData(imgData, 0, 0);

        } else if (fx?.type === 'glitch') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 30);
          const randGl = (n: number) => ((Math.sin(seed * 9.7 + n * 127.3) * 43758.5453) % 1 + 1) % 1;

          const aberration = intensity * 8 * randGl(1);
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.45;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.fillStyle = `rgba(255, 0, 0, 0.3)`;
          oCtx.fillRect(-dw / 2 - aberration, -dh / 2, dw, dh);
          oCtx.fillStyle = `rgba(0, 0, 255, 0.3)`;
          oCtx.fillRect(-dw / 2 + aberration, -dh / 2, dw, dh);
          oCtx.restore();

          oCtx.save();
          oCtx.globalAlpha = 0.15 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 4) {
            if (randGl(row + 5) > 0.5) {
              oCtx.fillStyle = 'rgba(0,0,0,0.8)';
              oCtx.fillRect(-dw / 2, row, dw, 2);
            }
          }
          oCtx.restore();

          const numSlices = Math.floor(3 + randGl(2) * 6 * intensity);
          oCtx.save();
          oCtx.globalAlpha = 0.65 * intensity;
          for (let i = 0; i < numSlices; i++) {
            const sliceY    = -dh / 2 + randGl(i * 3) * dh;
            const sliceH    = 2 + randGl(i * 3 + 1) * 8;
            const sliceShift = (randGl(i * 3 + 2) - 0.5) * 40 * intensity;
            oCtx.drawImage(oCtx.canvas, 0, sliceY + dh / 2, w, sliceH, sliceShift, sliceY + dh / 2, w, sliceH);
          }
          oCtx.restore();
        } else if (fx?.type === 'posterize') {
          const intensity = (fx.intensity ?? 100) / 100;
          const levels = Math.max(2, Math.round(16 - 12 * intensity));
          const imgData = oCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(Math.round(data[i] / 255 * levels) / levels * 255);
            data[i + 1] = Math.round(Math.round(data[i + 1] / 255 * levels) / levels * 255);
            data[i + 2] = Math.round(Math.round(data[i + 2] / 255 * levels) / levels * 255);
          }
          oCtx.putImageData(imgData, 0, 0);

        } else if (fx?.type === 'dreamy_blur') {
          const intensity = (fx.intensity ?? 100) / 100;
          oCtx.save();
          oCtx.globalAlpha = 0.5 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.filter = `blur(${Math.round(12 * intensity)}px)`;
          oCtx.drawImage(oCtx.canvas, 0, 0, w, h);
          oCtx.restore();

        } else if (fx?.type === 'fisheye') {
          const intensity = (fx.intensity ?? 100) / 100;
          const srcData = oCtx.getImageData(0, 0, w, h);
          const dstData = oCtx.createImageData(w, h);
          const src = srcData.data;
          const dst = dstData.data;
          const cx = w / 2;
          const cy = h / 2;
          const strength = 0.5 * intensity;
          
          for (let y = 0; y < h; y++) {
            const dy = y - cy;
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const r = Math.sqrt(dx * dx + dy * dy);
              const maxR = Math.sqrt(cx * cx + cy * cy);
              if (r < maxR) {
                const theta = Math.atan2(dy, dx);
                const rn = Math.pow(r / maxR, 1 + strength) * maxR;
                const sx = Math.round(cx + rn * Math.cos(theta));
                const sy = Math.round(cy + rn * Math.sin(theta));
                if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                  const srcIdx = (sy * w + sx) * 4;
                  const dstIdx = (y * w + x) * 4;
                  dst[dstIdx] = src[srcIdx];
                  dst[dstIdx + 1] = src[srcIdx + 1];
                  dst[dstIdx + 2] = src[srcIdx + 2];
                  dst[dstIdx + 3] = src[srcIdx + 3];
                  continue;
                }
              }
              const dstIdx = (y * w + x) * 4;
              dst[dstIdx] = src[dstIdx];
              dst[dstIdx + 1] = src[dstIdx + 1];
              dst[dstIdx + 2] = src[dstIdx + 2];
              dst[dstIdx + 3] = src[dstIdx + 3];
            }
          }
          oCtx.putImageData(dstData, 0, 0);

        } else if (fx?.type === 'vignette_burn') {
          const intensity = (fx.intensity ?? 100) / 100;
          oCtx.save();
          oCtx.globalCompositeOperation = 'multiply';
          const grad = oCtx.createRadialGradient(w/2, h/2, Math.min(w,h) * 0.25, w/2, h/2, Math.max(w,h) * 0.7);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(1, `rgba(0,0,0,${0.95 * intensity})`);
          oCtx.fillStyle = grad;
          oCtx.fillRect(0, 0, w, h);
          oCtx.restore();

        } else if (fx?.type === 'gameboy') {
          const intensity = (fx.intensity ?? 100) / 100;
          const imgData = oCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            let r = 15, g = 56, b = 15;
            if (gray > 192) { r = 155; g = 188; b = 15; }
            else if (gray > 128) { r = 139; g = 172; b = 15; }
            else if (gray > 64) { r = 48; g = 98; b = 48; }
            
            data[i] = Math.round(data[i] + (r - data[i]) * intensity);
            data[i + 1] = Math.round(data[i + 1] + (g - data[i + 1]) * intensity);
            data[i + 2] = Math.round(data[i + 2] + (b - data[i + 2]) * intensity);
          }
          oCtx.putImageData(imgData, 0, 0);
        }
        
        oCtx.restore();
      };

      if (mediaItem.type === 'video') {
        const videoEl = videoElements.get(clip.id);
        const videoReady = videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0;

        // Determine frame source: live video element or cached ImageBitmap
        let frameSource: CanvasImageSource | null = null;
        let sourceW = W;
        let sourceH = H;

        if (videoReady && videoEl) {
          frameSource = videoEl;
          sourceW = videoEl.videoWidth || W;
          sourceH = videoEl.videoHeight || H;
        } else {
          // FIX: Fallback chain for split clips or newly created elements not yet ready:
          // 1. Try this clip's own frame cache
          // 2. Try any OTHER video element with the same mediaId (e.g. sibling split clips)
          // 3. Try any OTHER clip's frame cache with the same mediaId

          // 1. Own frame cache
          const clipCache = frameCache.get(clip.id);
          if (clipCache && clipCache.length > 0) {
            const mediaTime = getMediaTimeForClip({
              id: clip.id, startTime: clip.startTime,
              duration: clip.duration, trimStart: clip.trimStart,
              speed: clip.speed, speedRamp: (clip as any).speedRamp
            }, currentTime);
            const roundedTime = Math.round(mediaTime * 30) / 30;
            let bestIdx = 0;
            let bestDist = Infinity;
            for (let i = 0; i < clipCache.length; i++) {
              const dist = Math.abs(clipCache[i].time - roundedTime);
              if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            }
            if (bestDist < 0.5) {
              frameSource = clipCache[bestIdx].bitmap;
              sourceW = clipCache[bestIdx].bitmap.width;
              sourceH = clipCache[bestIdx].bitmap.height;
            }
          }

          // 2. Try sibling video element with same mediaId
          if (!frameSource) {
            const targetMediaTime = getMediaTimeForClip({
              id: clip.id, startTime: clip.startTime,
              duration: clip.duration, trimStart: clip.trimStart,
              speed: clip.speed, speedRamp: (clip as any).speedRamp
            }, currentTime);
            for (const [otherId, otherEl] of videoElements) {
              if (otherId === clip.id) continue;
              // Find the clip that owns this element to check mediaId
              const ownerClip = tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === otherId);
              if (ownerClip?.mediaId === clip.mediaId && otherEl.readyState >= 2 && otherEl.videoWidth > 0) {
                // Seek this sibling to the correct time if needed
                const siblingDrift = Math.abs(otherEl.currentTime - targetMediaTime);
                if (siblingDrift < 2.0) { // Only use if reasonably close
                  frameSource = otherEl;
                  sourceW = otherEl.videoWidth || W;
                  sourceH = otherEl.videoHeight || H;
                  break;
                }
              }
            }
          }

          // 3. Try another clip's frame cache with same mediaId
          if (!frameSource) {
            const targetMediaTime = getMediaTimeForClip({
              id: clip.id, startTime: clip.startTime,
              duration: clip.duration, trimStart: clip.trimStart,
              speed: clip.speed, speedRamp: (clip as any).speedRamp
            }, currentTime);
            for (const [cacheId, cachedFrames] of frameCache) {
              if (cacheId === clip.id || !cachedFrames || cachedFrames.length === 0) continue;
              const ownerClip = tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === cacheId);
              if (ownerClip?.mediaId !== clip.mediaId) continue;
              const roundedTime = Math.round(targetMediaTime * 30) / 30;
              let bestIdx = 0, bestDist = Infinity;
              for (let i = 0; i < cachedFrames.length; i++) {
                const dist = Math.abs(cachedFrames[i].time - roundedTime);
                if (dist < bestDist) { bestDist = dist; bestIdx = i; }
              }
              if (bestDist < 0.5) {
                frameSource = cachedFrames[bestIdx].bitmap;
                sourceW = cachedFrames[bestIdx].bitmap.width;
                sourceH = cachedFrames[bestIdx].bitmap.height;
                break;
              }
            }
          }
        }

        if (frameSource) {
          // Fit the video into the canvas while preserving aspect ratio
          const vw = sourceW;
          const vh = sourceH;
          const scale = Math.min(W / vw, H / vh);
          
          const baseDw = vw * scale;
          const baseDh = vh * scale;

          const sx = vw * cLeft;
          const sy = vh * cTop;
          const sw = Math.max(1, vw * (1 - cLeft - cRight));
          const sh = Math.max(1, vh * (1 - cTop - cBot));

          dw = Math.max(1, baseDw * (1 - cLeft - cRight));
          dh = Math.max(1, baseDh * (1 - cTop - cBot));
          dx = -baseDw / 2 + baseDw * cLeft;
          dy = -baseDh / 2 + baseDh * cTop;

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasAiBg = clip.aiBackground?.enabled;
          const hasChroma = clip.chromaKey?.enabled;
          const hasLuma = clip.lumaKey?.enabled;
          const hasLut = !!clip.lut?.mediaId;
          const hasFx = !!activeFxClip;
          const hasMask = clip.mask?.enabled;
          const needsOffscreen = hasWheels || hasChroma || hasLuma || hasLut || hasFx || hasAiBg || hasMask;

          if (hasPerspectiveWarp && corners) {
            const offscreenWidth = Math.max(1, Math.round(dw * DOWNSCALE));
            const offscreenHeight = Math.max(1, Math.round(dh * DOWNSCALE));
            const offscreen = getOrCreateCanvas('clip_' + clip.id, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
              oCtx.drawImage(frameSource, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
              if (hasAiBg) {
                await applyAiBackgroundMask(
                  oCtx,
                  offscreen.width,
                  offscreen.height,
                  frameSource as any,
                  clip.aiBackground?.edgeBlur ?? 0,
                  clip.aiBackground?.modelSelection ?? 0
                );
              }
              if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(
                  oCtx,
                  offscreen.width,
                  offscreen.height,
                  clip.chromaKey.color,
                  clip.chromaKey.threshold,
                  clip.chromaKey.softness,
                  clip.chromaKey.spillSuppression ?? 0,
                  clip.chromaKey.edgeFeather ?? 0
                );
              }
              if (hasLuma && clip.lumaKey) {
                applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
              }
              if (hasWheels) {
                applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
              }
              if (hasLut) {
                const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                if (lutMedia?.lutData) {
                  applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                }
              }
              if (hasFx) {
                applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
              }
              if (hasMask) {
                await applyClipMaskOffscreen(oCtx, clip.mask, offscreen.width, offscreen.height, clip.id, clip.startTime, clip.animations);
              }
              drawPerspectiveTexture(ctx, offscreen, corners);
            }
          } else {
            if (needsOffscreen) {
              const offscreenWidth = Math.max(1, Math.round(dw * DOWNSCALE));
              const offscreenHeight = Math.max(1, Math.round(dh * DOWNSCALE));
              const offscreen = getOrCreateCanvas('clip_' + clip.id, offscreenWidth, offscreenHeight);
              const oCtx = offscreen.getContext('2d');
              if (oCtx) {
                oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
                oCtx.drawImage(frameSource, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(
                    oCtx,
                    offscreen.width,
                    offscreen.height,
                    frameSource as any,
                    clip.aiBackground?.edgeBlur ?? 0,
                    clip.aiBackground?.modelSelection ?? 0
                  );
                }
                if (hasChroma && clip.chromaKey) {
                  applyChromaKeyOnData(
                    oCtx,
                    offscreen.width,
                    offscreen.height,
                    clip.chromaKey.color,
                    clip.chromaKey.threshold,
                    clip.chromaKey.softness,
                    clip.chromaKey.spillSuppression ?? 0,
                    clip.chromaKey.edgeFeather ?? 0
                  );
                }
                if (hasLuma && clip.lumaKey) {
                  applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
                }
                if (hasWheels) {
                  applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
                }
                if (hasLut) {
                  const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                  if (lutMedia?.lutData) {
                    applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                  }
                }
                if (hasFx) {
                  applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
                }
                if (hasMask) {
                  await applyClipMaskOffscreen(oCtx, clip.mask, offscreen.width, offscreen.height, clip.id, clip.startTime, clip.animations);
                }
                ctx.drawImage(offscreen, dx, dy, dw, dh);
              } else {
                ctx.drawImage(frameSource, sx, sy, sw, sh, dx, dy, dw, dh);
              }
            } else {
              ctx.drawImage(frameSource, sx, sy, sw, sh, dx, dy, dw, dh);
            }
          }
          ctx.filter = 'none';
          hasRealMedia = true;
          anyClipDrawn = true;
        } else if (isPlaying) {
          // Video not ready yet during playback Ã¢â‚¬â€œ draw placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'VIDEO', '#3b82f6');
          anyClipDrawn = true;
        } else {
          // During scrubbing with no cached frame, skip placeholder
          anyClipDrawn = true;
        }
      } else if (mediaItem.type === 'image') {
        const img = getCachedImage(mediaItem.id, mediaItem.url, requestRedraw);
        if (img) {
          const iw = img.naturalWidth || W;
          const ih = img.naturalHeight || H;
          const fitScale = Math.min(W / iw, H / ih);

          const baseDw = iw * fitScale;
          const baseDh = ih * fitScale;

          const sx = iw * cLeft;
          const sy = ih * cTop;
          const sw = Math.max(1, iw * (1 - cLeft - cRight));
          const sh = Math.max(1, ih * (1 - cTop - cBot));

          dw = Math.max(1, baseDw * (1 - cLeft - cRight));
          dh = Math.max(1, baseDh * (1 - cTop - cBot));
          dx = -baseDw / 2 + baseDw * cLeft;
          dy = -baseDh / 2 + baseDh * cTop;

          // Ã¢â€â‚¬Ã¢â€â‚¬ Ken Burns zoom + pan Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
          const kb = clip.kenBurns;
          if (kb?.enabled) {
            const rawP = clip.duration > 0
              ? Math.max(0, Math.min(1, (currentTime - clip.startTime) / clip.duration))
              : 0;
            // Apply easing
            let t = rawP;
            if (kb.easing === 'easeIn')    t = rawP * rawP;
            else if (kb.easing === 'easeOut')  t = rawP * (2 - rawP);
            else if (kb.easing === 'easeInOut') {
              t = rawP < 0.5 ? 2 * rawP * rawP : 1 - Math.pow(-2 * rawP + 2, 2) / 2;
            }
            const kbScale = (kb.startScale + (kb.endScale - kb.startScale) * t) / 100;
            const kbPanX  = (kb.startPanX  + (kb.endPanX  - kb.startPanX)  * t) / 100 * baseDw;
            const kbPanY  = (kb.startPanY  + (kb.endPanY  - kb.startPanY)  * t) / 100 * baseDh;
            ctx.save();
            ctx.translate(kbPanX, kbPanY);
            ctx.scale(kbScale, kbScale);
          }
          // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬


          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasAiBg = clip.aiBackground?.enabled;
          const hasChroma = clip.chromaKey?.enabled;
          const hasLuma = clip.lumaKey?.enabled;
          const hasLut = !!clip.lut?.mediaId;
          const hasFx = !!activeFxClip;
          const hasMask = clip.mask?.enabled;
          const needsOffscreen = hasWheels || hasChroma || hasLuma || hasLut || hasFx || hasAiBg || hasMask;

          if (hasPerspectiveWarp && corners) {
            const offscreenWidth = Math.max(1, Math.round(dw * DOWNSCALE));
            const offscreenHeight = Math.max(1, Math.round(dh * DOWNSCALE));
            const offscreen = getOrCreateCanvas('clip_' + clip.id, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
              oCtx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
              if (hasAiBg) {
                await applyAiBackgroundMask(
                  oCtx,
                  offscreen.width,
                  offscreen.height,
                  img,
                  clip.aiBackground?.edgeBlur ?? 0,
                  clip.aiBackground?.modelSelection ?? 0
                );
              }
              if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(
                  oCtx,
                  offscreen.width,
                  offscreen.height,
                  clip.chromaKey.color,
                  clip.chromaKey.threshold,
                  clip.chromaKey.softness,
                  clip.chromaKey.spillSuppression ?? 0,
                  clip.chromaKey.edgeFeather ?? 0
                );
              }
              if (hasLuma && clip.lumaKey) {
                applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
              }
              if (hasWheels) {
                applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
              }
              if (hasLut) {
                const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                if (lutMedia?.lutData) {
                  applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                }
              }
              if (hasFx) {
                applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
              }
              if (hasMask) {
                await applyClipMaskOffscreen(oCtx, clip.mask, offscreen.width, offscreen.height, clip.id, clip.startTime, clip.animations);
              }
              drawPerspectiveTexture(ctx, offscreen, corners);
            }
          } else {
            if (needsOffscreen) {
              const offscreenWidth = Math.max(1, Math.round(dw * DOWNSCALE));
              const offscreenHeight = Math.max(1, Math.round(dh * DOWNSCALE));
              const offscreen = getOrCreateCanvas('clip_' + clip.id, offscreenWidth, offscreenHeight);
              const oCtx = offscreen.getContext('2d');
              if (oCtx) {
                oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
                oCtx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(
                    oCtx,
                    offscreen.width,
                    offscreen.height,
                    img,
                    clip.aiBackground?.edgeBlur ?? 0,
                    clip.aiBackground?.modelSelection ?? 0
                  );
                }
                if (hasChroma && clip.chromaKey) {
                  applyChromaKeyOnData(
                    oCtx,
                    offscreen.width,
                    offscreen.height,
                    clip.chromaKey.color,
                    clip.chromaKey.threshold,
                    clip.chromaKey.softness,
                    clip.chromaKey.spillSuppression ?? 0,
                    clip.chromaKey.edgeFeather ?? 0
                  );
                }
                if (hasLuma && clip.lumaKey) {
                  applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
                }
                if (hasWheels) {
                  applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
                }
                if (hasLut) {
                  const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                  if (lutMedia?.lutData) {
                    applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                  }
                }
                if (hasFx) {
                  applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
                }
                if (hasMask) {
                  await applyClipMaskOffscreen(oCtx, clip.mask, offscreen.width, offscreen.height, clip.id, clip.startTime, clip.animations);
                }
                ctx.drawImage(offscreen, dx, dy, dw, dh);
              } else {
                ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
              }
            } else {
              ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            }
          }
          ctx.filter = 'none';

          // Restore Ken Burns sub-transform
          if (kb?.enabled) ctx.restore();

          hasRealMedia = true;
          anyClipDrawn = true;
        } else {
          // Image still loading Ã¢â‚¬â€œ placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'IMAGE', '#f59e0b');
          anyClipDrawn = true;
        }
      } else if (mediaItem.type === 'compound') {
        drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'COMPOUND CLIP', '#8b5cf6');
        anyClipDrawn = true;
      } else if (mediaItem.type === 'text') {
        // Use clip textSettings or fall back to sensible defaults so text is always visible
        const rawTs = clip.textSettings as any;
        if (rawTs?.animationPreset === 'subscribe') {
          const localTime = Math.max(0, currentTime - clip.startTime);
          drawSubscribeAnimation(ctx, localTime, clip.duration, dw, dh);
          ctx.restore();
          return;
        }
        const ts = {
          text: String(rawTs?.text ?? 'Sample Text'),
          fontSize: Math.max(8, Number(rawTs?.fontSize) || 48),
          fontFamily: String(rawTs?.fontFamily ?? 'Inter'),
          color: String(rawTs?.color ?? '#ffffff'),
          backgroundColor: String(rawTs?.backgroundColor ?? 'transparent'),
          bold: !!rawTs?.bold,
          italic: !!rawTs?.italic,
          shadow: !!rawTs?.shadow,
          shadowColor: String(rawTs?.shadowColor ?? '#000000'),
          shadowBlur: Number(rawTs?.shadowBlur) || 10,
          threeD: !!rawTs?.threeD,
          threeDDepth: Number(rawTs?.threeDDepth) || 4,
          strokeWidth: Number(rawTs?.strokeWidth) || 0,
          strokeColor: String(rawTs?.strokeColor ?? '#000000'),
          textAlign: (rawTs?.textAlign ?? 'center') as CanvasTextAlign,
          animation: rawTs?.animation,
        };

        // Ã¢â€â‚¬Ã¢â€â‚¬ Animation progress Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const localTime = Math.max(0, currentTime - clip.startTime);
        const clipDur = clip.duration;
        const inDur  = ts.animation?.inDuration ?? 0.5;
        const outDur = ts.animation?.outDuration ?? 0.5;
        const inProgress  = (!isPlaying || inDur  <= 0) ? 1 : Math.min(1, localTime / inDur);
        const outProgress = (!isPlaying || outDur <= 0) ? 1 : Math.min(1, (clipDur - localTime) / outDur);

        let textAlpha   = 1.0;
        let textScale   = 1.0;
        let textXOffset = 0;
        let textYOffset = 0;
        // Split text into lines (support \n)
        let displayText = ts.text;

        if (ts.animation?.in && ts.animation.in !== 'none') {
          switch (ts.animation.in) {
            case 'fadeIn':    textAlpha *= inProgress; break;
            case 'zoom':      textScale *= (0.2 + 0.8 * inProgress); break;
            case 'slideUp':   textYOffset += (1 - inProgress) * 80; break;
            case 'slideDown': textYOffset -= (1 - inProgress) * 80; break;
            case 'slideLeft': textXOffset += (1 - inProgress) * 160; break;
            case 'slideRight':textXOffset -= (1 - inProgress) * 160; break;
            case 'bounce': {
              const bounceFactor = inProgress < 0.6 ? 0.3 * Math.sin(inProgress * Math.PI / 0.6)
                                 : inProgress < 0.9 ? -0.1 * Math.sin((inProgress - 0.6) * Math.PI / 0.3) : 0;
              textScale *= (1 + bounceFactor);
              break;
            }
            case 'typewriter': {
              const totalChars = ts.text.length;
              displayText = ts.text.slice(0, Math.floor(inProgress * totalChars));
              break;
            }

            // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CINEMATIC ANIMATIONS (IN) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

            case 'elastic': {
              // Spring overshoot: ease-out-elastic curve
              const c4 = (2 * Math.PI) / 3;
              const elasticOut = inProgress === 0 ? 0
                : inProgress === 1 ? 1
                : Math.pow(2, -10 * inProgress) * Math.sin((inProgress * 10 - 0.75) * c4) + 1;
              textScale *= (0.05 + 0.95 * elasticOut);
              textAlpha *= Math.min(1, inProgress * 3); // quick alpha snap on entry
              break;
            }

            case 'revealWipe': {
              // Text slides in and alpha clips: simulates a wipe-reveal curtain
              // We move from left + fade in Ã¢â‚¬â€ canvas clip-path is approximated with offset
              textXOffset += (1 - inProgress) * -200;
              textAlpha   *= Math.min(1, inProgress * 2); // fast alpha so it feels like a wipe
              break;
            }

            case 'splitReveal': {
              // Scales up from near-zero with fade Ã¢â‚¬â€ classic cinematic title reveal
              const ease = 1 - Math.pow(1 - inProgress, 3); // cubic ease-out
              textScale *= (0.05 + 0.95 * ease);
              textAlpha *= ease;
              break;
            }

            case 'glitch': {
              // Rapid random XY jitter that settles as inProgress Ã¢â€ â€™ 1
              const glitchIntensity = Math.max(0, 1 - inProgress * 2); // stops halfway
              const time = performance.now() / 1000;
              textXOffset += glitchIntensity * 20 * (Math.sin(time * 80)  > 0 ? 1 : -1);
              textYOffset += glitchIntensity * 10 * (Math.sin(time * 130) > 0 ? 1 : -1);
              textAlpha   *= (inProgress < 0.1 ? 0 : 1); // flash-on after first frame
              break;
            }

            case 'letterSpacing': {
              // Simulated letter-spacing compress: characters start very close (squished scale X)
              // We fake it with horizontal scale + slight alpha
              const ease = 1 - Math.pow(1 - inProgress, 2); // quad ease-out
              textScale   *= (0.4 + 0.6 * ease);   // scale X from 0.4 Ã¢â€ â€™ 1.0
              textAlpha   *= ease;
              break;
            }

            case 'rollUp': {
              // Film-credit hard roll: text comes from far below very fast
              const ease = 1 - Math.pow(1 - inProgress, 4); // quart ease-out Ã¢â‚¬â€ fast then eases
              textYOffset += (1 - ease) * 180;
              textAlpha   *= Math.min(1, inProgress * 4); // opacity snaps on early
              break;
            }

            case 'scaleFlip': {
              // Y-axis squeeze (scaleY 0 Ã¢â€ â€™ 1) then pops open Ã¢â‚¬â€ dramatic reveal
              const ease = inProgress < 0.5
                ? 4 * inProgress * inProgress * inProgress            // cubic ease-in for first half
                : 1 - Math.pow(-2 * inProgress + 2, 3) / 2;          // cubic ease-out for second half
              textScale   *= Math.max(0.01, ease);   // scaleY approximated via uniform scale
              textAlpha   *= Math.min(1, inProgress * 3);
              break;
            }

            case 'zoomBlur': {
              // Blockbuster zoom: starts very large and slams down to 1Ãƒâ€”, heavy alpha ramp
              const ease = 1 - Math.pow(1 - inProgress, 3); // cubic ease-out
              textScale *= (3.0 - 2.0 * ease);     // 3Ãƒâ€” Ã¢â€ â€™ 1Ãƒâ€” zoom in
              textAlpha *= ease * ease;             // quadratic alpha so it "appears" through blur
              break;
            }
          }
        }

        if (ts.animation?.out && ts.animation.out !== 'none') {
          switch (ts.animation.out) {
            case 'fadeOut':   textAlpha *= outProgress; break;
            case 'zoom':      textScale *= (0.2 + 0.8 * outProgress); break;
            case 'slideUp':   textYOffset -= (1 - outProgress) * 80; break;
            case 'slideDown': textYOffset += (1 - outProgress) * 80; break;
            case 'slideLeft': textXOffset -= (1 - outProgress) * 160; break;
            case 'slideRight':textXOffset += (1 - outProgress) * 160; break;

            // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CINEMATIC OUT animations Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

            case 'elastic': {
              // Reverse elastic: snap away then spring back slightly before exiting
              textScale *= Math.max(0.01, outProgress);
              textAlpha *= outProgress;
              break;
            }
            case 'revealWipe': {
              // Wipe out to the right
              textXOffset += (1 - outProgress) * 200;
              textAlpha   *= outProgress * 2 < 1 ? outProgress * 2 : 1;
              break;
            }
            case 'splitReveal': {
              // Collapse back to center
              textScale *= outProgress;
              textAlpha *= outProgress;
              break;
            }
            case 'glitch': {
              // Glitch out: jitter increases as it exits
              const glitchIntensity = 1 - outProgress;
              const time = performance.now() / 1000;
              textXOffset += glitchIntensity * 25 * (Math.sin(time * 90) > 0 ? 1 : -1);
              textYOffset += glitchIntensity * 12 * (Math.sin(time * 140) > 0 ? 1 : -1);
              textAlpha   *= outProgress;
              break;
            }
            case 'rollUp': {
              // Roll off upward fast
              const ease = Math.pow(1 - outProgress, 4);
              textYOffset -= ease * 200;
              textAlpha   *= outProgress;
              break;
            }
            case 'scaleFlip': {
              textScale *= Math.max(0.01, outProgress);
              textAlpha *= outProgress;
              break;
            }
            case 'zoomBlur': {
              // Zoom out fast while fading
              textScale *= (0.1 + 0.9 * outProgress);
              textAlpha *= outProgress * outProgress;
              break;
            }
            case 'letterSpacing': {
              textScale *= outProgress;
              textAlpha *= outProgress;
              break;
            }
          }
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Multiline split Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
                
        if (rawTs?.animationPreset === 'typewriter') {
          const totalChars = displayText.length;
          displayText = displayText.slice(0, Math.floor(inProgress * totalChars));
        } else if (rawTs?.animationPreset === 'bounce') {
          const bounceFactor = inProgress < 0.6 ? 0.3 * Math.sin(inProgress * Math.PI / 0.6)
                             : inProgress < 0.9 ? -0.1 * Math.sin((inProgress - 0.6) * Math.PI / 0.3) : 0;
          textScale *= (1 + bounceFactor);
        }
        
        const lines = displayText.split('\n');
        const lineHeight = ts.fontSize * 1.35;

        // Set up font BEFORE measuring
        try {
          ctx.font = `${ts.italic ? 'italic ' : ''}${ts.bold ? 'bold ' : ''}${ts.fontSize}px "${ts.fontFamily}", sans-serif`;
        } catch (_) {
          ctx.font = `${ts.fontSize}px sans-serif`;
        }
        ctx.textBaseline = 'middle';
        try {
          ctx.textAlign = ts.textAlign || 'center';
        } catch (_) {
          ctx.textAlign = 'center';
        }

        // Measure widest line for background rect
        const maxLineWidth = lines.reduce((max: number, l: string) => Math.max(max, ctx.measureText(l).width), 0);
        dw = maxLineWidth + 40;
        dh = lines.length * lineHeight + 20;

        // Ã¢â€â‚¬Ã¢â€â‚¬ Sub-transform for animation (applied on top of clip transform) Ã¢â€â‚¬
        ctx.save();
        ctx.translate(textXOffset, textYOffset);
        ctx.scale(textScale, textScale);
        ctx.globalAlpha *= textAlpha;

        // Background rect (centered at 0,0 which is already at clip's aX,aY center)
        if (ts.backgroundColor !== 'transparent') {
          ctx.fillStyle = ts.backgroundColor;
          const bgX = -dw / 2;
          ctx.fillRect(bgX, -dh / 2, dw, dh);
        }

        // X position for text based on alignment (0 = clip center)
        const textX = ts.textAlign === 'left'  ? -(maxLineWidth / 2) :
                      ts.textAlign === 'right' ? (maxLineWidth / 2) : 0;

        // Draw each line
        const totalTextH = lines.length * lineHeight;
        lines.forEach((line: string, lineIdx: number) => {
          const lineY = -totalTextH / 2 + lineIdx * lineHeight + lineHeight / 2;

          // 3D depth layers Ã¢â‚¬â€ FIX H3: no shadow on depth layers (shadow goes on the main text below)
          if (ts.threeD) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = ts.shadowColor;
            for (let d = 1; d <= (ts.threeDDepth || 4); d++) {
              ctx.fillText(line, textX + d, lineY + d);
            }
          }

          // Stroke
          if (ts.strokeWidth > 0) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = ts.strokeColor;
            ctx.lineWidth   = ts.strokeWidth;
            ctx.lineJoin    = 'round';
            ctx.strokeText(line, textX, lineY);
          }

          // FIX H3: Apply shadow immediately before the main fill text so it actually renders on the text
          if (ts.shadow) {
            ctx.shadowColor = ts.shadowColor;
            ctx.shadowBlur  = ts.shadowBlur;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
          }

          // Fill
          ctx.fillStyle = ts.color;
          ctx.fillText(line, textX, lineY);

          // Clear shadow after drawing main text
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        });

        ctx.shadowBlur = 0;
        ctx.restore(); // restore animation sub-transform

        hasRealMedia  = true;
        anyClipDrawn  = true;
      }

      // Apply temperature, tint, faded film, and vignette overlays on top of the drawn media
      if (hasRealMedia && mediaItem.type !== 'text') {
        applyColorOverlays(ctx, dx, dy, dw, dh, filters);
      }

      ctx.restore();
    };

    // Array to queue rendering operations, allowing them to be sorted by zIndex
    const drawQueue: { zIndex: number; fn: () => Promise<void> }[] = [];

    // Helper function to queue main clips on a list of tracks
    const queueMainClipsForTracks = (tracksList: any[], isText: boolean) => {
      tracksList.forEach((track, trackIdx) => {
        const sortedClips = [...track.clips].filter(c => !c.disabled).sort((a, b) => a.startTime - b.startTime);
        let activeTransition: { clipA: any; clipB: any; trans: any; t: number } | null = null;

        // Check if currentTime falls into any active transition zone
        // A transition can be defined as transitionIn on clipB (incoming clip) OR
        // transitionOut on clipA (outgoing clip) Ã¢â‚¬â€ check both so dropped transitions work regardless
        for (let idx = 1; idx < sortedClips.length; idx++) {
          const clipB = sortedClips[idx];
          const clipA = sortedClips[idx - 1];
          const gap = clipB.startTime - (clipA.startTime + clipA.duration);

          // Determine which transition definition to use: prefer transitionIn on B, fallback to transitionOut on A
          const trans = (Math.abs(gap) < 0.5 && clipB.transitionIn)
            ? clipB.transitionIn
            : (Math.abs(gap) < 0.5 && clipA.transitionOut)
              ? clipA.transitionOut
              : null;

          if (trans) {
            const duration = Math.max(0.01, trans.duration || 1.0);
            const alignment = trans.params?.alignment || 'center';

            // Determine the transition window around the boundary (clipB.startTime)
            const boundary = clipB.startTime;
            let leftSec = boundary - duration / 2;
            if (alignment === 'left') {
              leftSec = boundary;
            } else if (alignment === 'right') {
              leftSec = boundary - duration;
            }
            const rightSec = leftSec + duration;

            if (currentTime >= leftSec && currentTime < rightSec) {
              const t = (currentTime - leftSec) / duration;
              activeTransition = { clipA, clipB, trans, t };
              break;
            }
          }
        }

        if (activeTransition) {
          const { clipA, clipB, trans, t } = activeTransition;
          const z = clipB.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0));
          
          drawQueue.push({
            zIndex: z,
            fn: async () => {
              try {
                const type = trans.type;
                const nameLower = trans.name.toLowerCase();

                if (nameLower.includes('dissolve')) {
                  await drawSingleClip(clipA, 1 - t);
                  await drawSingleClip(clipB, t);
                } else if (nameLower.includes('fade')) {
                  if (t < 0.5) {
                    await drawSingleClip(clipA, 1 - t * 2);
                  } else {
                    await drawSingleClip(clipB, (t - 0.5) * 2);
                  }
                } else if (type === 'wipe') {
                  if (nameLower.includes('left')) {
                    await drawSingleClip(clipA, 1);
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(W * (1 - t), 0, W * t, H);
                    ctx.clip();
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  } else {
                    await drawSingleClip(clipA, 1);
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, W * t, H);
                    ctx.clip();
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'slide') {
                  if (nameLower.includes('up')) {
                    await drawSingleClip(clipA, 1, { translateY: -H * t });
                    await drawSingleClip(clipB, 1, { translateY: H * (1 - t) });
                  } else if (nameLower.includes('down')) {
                    await drawSingleClip(clipA, 1, { translateY: H * t });
                    await drawSingleClip(clipB, 1, { translateY: -H * (1 - t) });
                  } else {
                    await drawSingleClip(clipA, 1, { translateX: -W * t });
                    await drawSingleClip(clipB, 1, { translateX: W * (1 - t) });
                  }
                } else if (type === 'zoom') {
                  if (nameLower.includes('out')) {
                    await drawSingleClip(clipB, 1);
                    await drawSingleClip(clipA, 1 - t, { scale: 1 - t });
                    await drawSingleClip(clipB, t, { scale: t });
                  }
                } else if (type === 'shake') {
                  const intensity = ((trans.params?.intensity as number) ?? 0.7) * 30;
                  const seed = Math.floor(t * 60);
                  const rng = (s: number) => {
                    const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
                    return x - Math.floor(x);
                  };
                  const offsetX = (rng(seed) - 0.5) * intensity * (1 - t);
                  const offsetY = (rng(seed + 1) - 0.5) * intensity * (1 - t);
                  const rot = (rng(seed + 2) - 0.5) * ((trans.params?.intensity as number) ?? 0.7) * 5 * (1 - t);

                  ctx.save();
                  ctx.translate(W / 2 + offsetX, H / 2 + offsetY);
                  ctx.rotate((rot * Math.PI) / 180);
                  ctx.translate(-W / 2, -H / 2);
                  await drawSingleClip(clipA, 1);
                  if (t > 0.7) {
                    ctx.globalAlpha = (t - 0.7) / 0.3;
                    await drawSingleClip(clipB, 1);
                    ctx.globalAlpha = 1;
                  }
                  ctx.restore();
                } else if (type === 'flash') {
                  const intensity = (trans.params?.intensity as number) ?? 1.0;
                  const flashIntensity = Math.sin(t * Math.PI) * intensity;
                  await drawSingleClip(clipA, 1);
                  if (flashIntensity > 0.1) {
                    ctx.save();
                    ctx.fillStyle = (trans.params?.color as string) || '#FFFFFF';
                    ctx.globalAlpha = flashIntensity;
                    ctx.fillRect(0, 0, W, H);
                    ctx.restore();
                  }
                  if (t > 0.5) {
                    ctx.save();
                    ctx.globalAlpha = Math.min(1, (t - 0.5) * 4);
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'zoomRush') {
                  const intensity = (trans.params?.intensity as number) ?? 0.8;
                  const dir = trans.params?.direction === 'out' ? -1 : 1;
                  const ease = t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
                  if (t < 0.8) {
                    const fromScale = dir === 1 ? 1 + ease * intensity * 2 : 1 - ease * 0.5;
                    ctx.save();
                    ctx.globalAlpha = 1 - ease;
                    ctx.translate(W / 2, H / 2);
                    ctx.scale(fromScale, fromScale);
                    ctx.translate(-W / 2, -H / 2);
                    await drawSingleClip(clipA, 1);
                    ctx.restore();
                  }
                  if (t > 0.2) {
                    const toScale = dir === 1 ? 2 - ease * 2 : 0.5 + ease * 0.5;
                    ctx.save();
                    ctx.globalAlpha = ease;
                    ctx.translate(W / 2, H / 2);
                    ctx.scale(toScale, toScale);
                    ctx.translate(-W / 2, -H / 2);
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'glitch') {
                  const intensity = (trans.params?.intensity as number) ?? 0.9;
                  const slices = Math.floor(10 + intensity * 20);
                  const rng = (s: number) => {
                    const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
                    return x - Math.floor(x);
                  };
                  const tempCanvas = getOrCreateCanvas('transition_glitch_temp', W, H);
                  const tempCtx = tempCanvas.getContext('2d')!;
                  tempCtx.clearRect(0, 0, W, H);
                  await drawSingleClip(clipA, 1, undefined, tempCtx);

                  ctx.save();
                  for (let i = 0; i < slices; i++) {
                    const sy = (H / slices) * i;
                    const sliceH = H / slices;
                    const seed = i + Math.floor(t * 30);
                    const offsetX = (rng(seed) - 0.5) * intensity * 100 * (1 - t);
                    const rgbOffset = intensity * 15 * (1 - t);

                    ctx.globalCompositeOperation = 'screen';
                    ctx.drawImage(tempCanvas, 0, sy, W, sliceH, offsetX - rgbOffset, sy, W, sliceH);
                    ctx.drawImage(tempCanvas, 0, sy, W, sliceH, offsetX, sy, W, sliceH);
                    ctx.drawImage(tempCanvas, 0, sy, W, sliceH, offsetX + rgbOffset, sy, W, sliceH);
                  }
                  ctx.restore();

                  if (t > 0.6) {
                    ctx.save();
                    ctx.globalAlpha = (t - 0.6) / 0.4;
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'lightLeak') {
                  const intensity = (trans.params?.intensity as number) ?? 0.6;
                  const color = (trans.params?.color as string) || '#FF6B35';
                  await drawSingleClip(clipA, 1);

                  ctx.save();
                  const gradient = ctx.createRadialGradient(W * 0.8, -H * 0.2, 0, W * 0.8, -H * 0.2, W * 1.2);
                  const alpha = Math.sin(t * Math.PI) * intensity * 0.6;
                  const parseColor = (hex: string, a: number) => {
                    const r = parseInt(hex.slice(1, 3), 16) || 255;
                    const g = parseInt(hex.slice(3, 5), 16) || 107;
                    const b = parseInt(hex.slice(5, 7), 16) || 53;
                    return `rgba(${r}, ${g}, ${b}, ${a})`;
                  };
                  gradient.addColorStop(0, parseColor(color, alpha));
                  gradient.addColorStop(0.5, parseColor(color, alpha * 0.5));
                  gradient.addColorStop(1, 'transparent');
                  ctx.fillStyle = gradient;
                  ctx.globalCompositeOperation = 'screen';
                  ctx.fillRect(0, 0, W, H);
                  ctx.restore();

                  if (t > 0.5) {
                    ctx.save();
                    ctx.globalAlpha = (t - 0.5) * 2;
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'whipPan') {
                  const intensity = (trans.params?.intensity as number) ?? 0.8;
                  const dir = trans.params?.direction || 'right';
                  const isHorizontal = dir === 'left' || dir === 'right';
                  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
                  const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                  const fromOffset = sign * ease * W * (isHorizontal ? 1 : 0.3);
                  const fromOffsetY = sign * ease * H * (isHorizontal ? 0.3 : 1);

                  ctx.save();
                  await drawSingleClip(clipA, 1, { translateX: fromOffset, translateY: fromOffsetY });
                  ctx.restore();

                  if (t > 0.1) {
                    const toStart = -sign * W * (isHorizontal ? 1 : 0.3);
                    const toStartY = -sign * H * (isHorizontal ? 0.3 : 1);
                    const toX = toStart + (W * (isHorizontal ? 1 : 0.3) + toStart) * ease;
                    const toY = toStartY + (H * (isHorizontal ? 0.3 : 1) + toStartY) * ease;
                    ctx.save();
                    await drawSingleClip(clipB, 1, { translateX: toX, translateY: toY });
                    ctx.restore();
                  }
                } else if (type === 'pixelate') {
                  const intensity = (trans.params?.intensity as number) ?? 0.7;
                  const pixelSize = Math.floor(1 + Math.sin(t * Math.PI) * intensity * 50);

                  if (pixelSize <= 1) {
                    await drawSingleClip(clipA, 1);
                  } else {
                    const offWidth = Math.ceil(W / pixelSize);
                    const offHeight = Math.ceil(H / pixelSize);
                    const tempCanvas = getOrCreateCanvas('transition_pixel_temp', offWidth, offHeight);
                    const tempCtx = tempCanvas.getContext('2d')!;
                    tempCtx.clearRect(0, 0, offWidth, offHeight);
                    
                    tempCtx.save();
                    tempCtx.scale(offWidth / W, offHeight / H);
                    await drawSingleClip(clipA, 1, undefined, tempCtx);
                    tempCtx.restore();

                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(tempCanvas, 0, 0, W, H);
                    ctx.imageSmoothingEnabled = true;
                    ctx.restore();
                  }

                  if (t > 0.5) {
                    ctx.save();
                    ctx.globalAlpha = (t - 0.5) * 2;
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'mirror') {
                  const intensity = (trans.params?.intensity as number) ?? 0.5;
                  const segments = Math.floor(2 + intensity * 6);
                  const tempCanvas = getOrCreateCanvas('transition_mirror_temp', W, H);
                  const tempCtx = tempCanvas.getContext('2d')!;
                  tempCtx.clearRect(0, 0, W, H);
                  await drawSingleClip(clipA, 1, undefined, tempCtx);

                  ctx.save();
                  ctx.translate(W / 2, H / 2);
                  for (let i = 0; i < segments; i++) {
                    ctx.save();
                    ctx.rotate((i * Math.PI * 2) / segments);
                    const scale = 1 + Math.sin(t * Math.PI) * 0.2;
                    ctx.scale(scale, scale);
                    
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.arc(0, 0, Math.max(W, H), -Math.PI / segments, Math.PI / segments);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(tempCanvas, -W / 2, -H / 2, W, H);
                    ctx.restore();
                  }
                  ctx.restore();

                  if (t > 0.5) {
                    ctx.save();
                    ctx.globalAlpha = (t - 0.5) * 2;
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else {
                  await drawSingleClip(clipA, 1 - t);
                  await drawSingleClip(clipB, t);
                }
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw transition:', err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
          return;
        }

        const clip = sortedClips.find(
          (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration,
        );
        if (clip) {
          const z = clip.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0));
          drawQueue.push({
            zIndex: z,
            fn: async () => {
              try {
                // FIX: Remove per-clip transition opacity handling - it's now handled in drawSingleClip
                // to prevent conflicts between single-clip and cross-fade transitions
                await drawSingleClip(clip, 1);
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw clip:', clip.id, err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
        }
      });
    };

    const queuePipWindowsForTracks = (tracksList: any[], isText: boolean) => {
      const pipWindows = Object.values(useEditorStore.getState().pipWindows || {});
      tracksList.forEach((track, trackIdx) => {
        const activeClips = track.clips.filter(
          (c: any) => !c.disabled && currentTime >= c.startTime && currentTime < c.startTime + c.duration
        );

        for (const clip of activeClips) {
          const clipPips = pipWindows.filter(p => p && p.parentClipId === clip.id);
          for (const pip of clipPips) {
            const pipAbsStart = clip.startTime + (pip.relativeStartTime || 0);
            if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
              // Active PIP window. Render its tracks
              pip.tracks.forEach((pipTrack, ptIdx) => {
                pipTrack.clips.forEach((pipClip) => {
                  const ptAbsStart = pipAbsStart + pipClip.startTime;
                  if (currentTime >= ptAbsStart && currentTime < ptAbsStart + pipClip.duration) {
                    // Render this pip clip, ensuring it always sits above all main timeline clips (+10000)
                    const z = (clip.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0))) + 10000 + (pip.zIndex || 1) * 10 + ptIdx;
                    
                    const mockClip: any = {
                      ...pipClip,
                      startTime: ptAbsStart,
                      zIndex: z,
                      transform: pipClip.transform || {
                        scale: 30,
                        x: 30,
                        y: 30,
                        rotation: 0
                      }
                    };
                    
                    drawQueue.push({
                      zIndex: z,
                      fn: async () => {
                        try {
                          await drawSingleClip(mockClip as any, 1);
                        } catch (err) {
                          console.error('[CanvasRenderError] Failed to draw PIP layer:', pipClip.id, err);
                          try { ctx.restore(); } catch (_) {}
                        }
                      }
                    });
                  }
                });
              });
            }
          }
        }
      });
    };

    // Queue Video tracks
    queueMainClipsForTracks(videoTracks, false);
    queuePipWindowsForTracks(videoTracks, false);

    // Queue Text tracks (Default 1000+ zIndex)
    queueMainClipsForTracks(textTracks, true);
    queuePipWindowsForTracks(textTracks, true);

    // Sort by Z-Index (ascending: lowest drawn first, highest drawn last)
    drawQueue.sort((a, b) => a.zIndex - b.zIndex);

    // Execute drawing queue in order
    for (const task of drawQueue) {
      await task.fn();
    }

    if (!anyClipDrawn) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No clip at current position', W / 2, H / 2 - 10);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Add clips to the timeline to preview', W / 2, H / 2 + 12);
    }
    
    // 3b. Render particles for any clip that has particleSettings
    // FIX H2: actually use skipExpensiveFX. While scrubbing/paused we skip
    // per-clip particle simulation and other expensive effects — they'd
    // otherwise drop scrubbing FPS to single-digit on large projects.
    if (!skipExpensiveFX) {
      for (const track of visualTracks) {
        for (const clip of track.clips) {
          if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
            renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
          }
        }
        // PIP clips particles
        const pipWindows = useEditorStore.getState().pipWindows || {};
        for (const clip of (track.clips || [])) {
          const clipPips = Object.values(pipWindows).filter(p => p && (p as any).parentClipId === clip.id);
          for (const pip of (clipPips as any[])) {
            const pipAbsStart = clip.startTime + (pip.relativeStartTime || 0);
            if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
              for (const pipTrack of pip.tracks) {
                for (const pipClip of pipTrack.clips) {
                  const ptAbsStart = pipAbsStart + pipClip.startTime;
                  if (!pipClip.disabled && pipClip.particleSettings && currentTime >= ptAbsStart && currentTime < ptAbsStart + pipClip.duration) {
                    renderParticles(ctx, pipClip.id, pipClip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
                  }
                }
              }
            }
          }
        }
      }
    } // end if (!skipExpensiveFX)

    // Global LUT pass removed to prevent double-grading and resolution mismatch crashes

    ctx.restore(); // Restore from viewport transform

    // Ã¢â€â‚¬Ã¢â€â‚¬ Render Subtitles (from store subtitles array) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const storeState = useEditorStore.getState();
    const subsList = (storeState as any).subtitles;
    const activeSubLanguage = (storeState as any).subtitleLanguage || 'en';
    if (subsList && subsList.length > 0) {
      const activeSub = subsList.find(
        (sub: any) => currentTime >= sub.startTime && currentTime <= sub.endTime
      );
      if (activeSub) {
        ctx.save();
        
        const baseFontSize = Math.max(12, Math.round(W * 0.038));
        ctx.font = `bold ${baseFontSize}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const textToDraw = activeSub.translations?.[activeSubLanguage] || activeSub.text || '';

        if (textToDraw.trim()) {
          const lines = textToDraw.split('\n');
          const paddingX = baseFontSize * 0.7;
          const paddingY = baseFontSize * 0.35;
          const lineHeight = baseFontSize * 1.25;
          
          let maxLineWidth = 0;
          lines.forEach((line: string) => {
            const width = ctx.measureText(line).width;
            if (width > maxLineWidth) maxLineWidth = width;
          });

          const boxW = maxLineWidth + paddingX * 2;
          const boxH = (lineHeight * lines.length) + paddingY * 1.5;
          
          const x = W / 2;
          const y = H - Math.max(25, H * 0.08);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
          ctx.beginPath();
          ctx.roundRect(x - boxW / 2, y - boxH, boxW, boxH, Math.max(4, baseFontSize * 0.25));
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          lines.forEach((line: string, index: number) => {
            const lineY = y - paddingY - (lines.length - 1 - index) * lineHeight;
            ctx.fillText(line, x, lineY);
          });
        }
        
        ctx.restore();
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Grid Overlay Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (showGrid && !isExporting) {
      ctx.save();
      ctx.globalAlpha = 1;

      const COLS = 4;
      const ROWS = 3;
      const cellW = W / COLS;
      const cellH = H / ROWS;

      // Thin grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + c * cellW, offsetY);
        ctx.lineTo(offsetX + c * cellW, offsetY + H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + r * cellH);
        ctx.lineTo(offsetX + W, offsetY + r * cellH);
        ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(offsetX + W / 2, offsetY); ctx.lineTo(offsetX + W / 2, offsetY + H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(offsetX, offsetY + H / 2); ctx.lineTo(offsetX + W, offsetY + H / 2); ctx.stroke();
      ctx.setLineDash([]);

      // Rule-of-thirds intersection dots
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      for (let c = 1; c < COLS; c++) {
        for (let r = 1; r < ROWS; r++) {
          ctx.beginPath();
          ctx.arc(offsetX + c * cellW, offsetY + r * cellH, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    
    // Safe Zones Overlay
    if (settings.showSafeZones && !isExporting) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red-ish blind spot
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (aspectRatio === '16:9') {
        const brW = W * 0.15;
        const brH = H * 0.12;
        const brX = offsetX + W - brW;
        const brY = offsetY + H - brH;
        ctx.fillRect(brX, brY, brW, brH);
        ctx.strokeRect(brX, brY, brW, brH);
        ctx.fillStyle = 'white';
        ctx.fillText('Logo/Time', brX + brW/2, brY + brH/2);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        const trW = W * 0.1;
        const trH = H * 0.1;
        const trX = offsetX + W - trW;
        const trY = offsetY;
        ctx.fillRect(trX, trY, trW, trH);
        ctx.strokeRect(trX, trY, trW, trH);
        ctx.fillStyle = 'white';
        ctx.fillText('Info', trX + trW/2, trY + trH/2);
        
      } else if (aspectRatio === '9:16') {
        const rsW = W * 0.18;
        const rsH = H * 0.45;
        const rsX = offsetX + W - rsW;
        const rsY = offsetY + H * 0.4;
        ctx.fillRect(rsX, rsY, rsW, rsH);
        ctx.strokeRect(rsX, rsY, rsW, rsH);
        
        ctx.save();
        ctx.translate(rsX + rsW/2, rsY + rsH/2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'white';
        ctx.fillText('Action Buttons', 0, 0);
        ctx.restore();

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        const bW = W * 0.82;
        const bH = H * 0.15;
        const bX = offsetX;
        const bY = offsetY + H - bH;
        ctx.fillRect(bX, bY, bW, bH);
        ctx.strokeRect(bX, bY, bW, bH);
        ctx.fillStyle = 'white';
        ctx.fillText('Title & Audio', bX + bW/2, bY + bH/2);
      }
      
      ctx.restore();
    }

    // 5. Timecode overlay ?" top-right
    if (!isExporting) {
      ctx.globalAlpha = 1;
      const tcText = formatTime(currentTime);
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      const tcMetrics = ctx.measureText(tcText);
      const tcPadX = 8;
      const tcPadY = 4;
      const tcW = tcMetrics.width + tcPadX * 2;
      const tcH = 20;
      const tcX = offsetX + W - tcW - 8;
      const tcY = offsetY + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(tcX, tcY, tcW, tcH, 4);
      } else {
        // Fallback using arcTo
        const r = 4;
        ctx.moveTo(tcX + r, tcY);
        ctx.arcTo(tcX + tcW, tcY, tcX + tcW, tcY + tcH, r);
        ctx.arcTo(tcX + tcW, tcY + tcH, tcX, tcY + tcH, r);
        ctx.arcTo(tcX, tcY + tcH, tcX, tcY, r);
        ctx.arcTo(tcX, tcY, tcX + tcW, tcY, r);
      }
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(tcText, offsetX + W - 8 - tcPadX, tcY + tcH / 2);
    }

    ctx.restore(); // Restore from global canvas resolution scale

    // Ã¢â€â‚¬Ã¢â€â‚¬ Double buffer blit: copy finished composite to visible canvas in one atomic draw Ã¢â€â‚¬Ã¢â€â‚¬
    const mainCtx = canvas.getContext('2d');
    if (mainCtx) {
      mainCtx.clearRect(0, 0, canvas.width, canvas.height);
      mainCtx.drawImage(composite, 0, 0);
    }

    // Snapshot this successfully rendered frame for use during seeking gaps
    if (!lastFrameCanvasRef.current) {
      lastFrameCanvasRef.current = document.createElement('canvas');
    }
    const snapCanvas = lastFrameCanvasRef.current;
    if (snapCanvas.width !== canvas.width || snapCanvas.height !== canvas.height) {
      snapCanvas.width = canvas.width;
      snapCanvas.height = canvas.height;
    }
    const snapCtx = snapCanvas.getContext('2d');
    if (snapCtx) {
      snapCtx.clearRect(0, 0, snapCanvas.width, snapCanvas.height);
      snapCtx.drawImage(composite, 0, 0);
    }
  }, []);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Unified render loop to prevent flickering during scrubbing Ã¢â€â‚¬Ã¢â€â‚¬
  // Use a frame-pending flag + single rAF loop instead of canceling/rescheduling.
  const renderCanvasRef = useRef(renderCanvas);
  const rafActiveRef = useRef(false);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  // Mark that a new frame is needed whenever renderCanvas changes
  useEffect(() => {
    framePendingRef.current = true;
  }, [renderCanvas]);

  useEffect(() => {
    // If playback starts, always draw (the rAF loop handles continuous frames)
    framePendingRef.current = true;
    if (rafActiveRef.current) return;

    rafActiveRef.current = true;
    let rafId: number;
    let tabVisible = !document.hidden;

    // PERF FIX: Pause rAF when the tab is not visible to save CPU
    const onVisChange = () => {
      tabVisible = !document.hidden;
      if (tabVisible) framePendingRef.current = true; // redraw immediately on restore
    };
    document.addEventListener('visibilitychange', onVisChange);
    let isRendering = false;
    let lastTime = performance.now();
    let lastSyncTime = performance.now();
    
    const tick = async (now: number) => {
      const state = useEditorStore.getState();
      
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
              const selectedClips = allClips.filter(c => selectedIds.includes(c.id));
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
            
            // Sync to global store throttled (30 fps = 33ms)
            if (now - lastSyncTime > 33) {
               currentSeek(newTime);
               lastSyncTime = now;
            }
        }
      } else {
        lastTime = now;
        lastSyncTime = now;
      }

      if (tabVisible && framePendingRef.current && !isRendering) {
        framePendingRef.current = false;
        isRendering = true;
        try {
          await renderCanvasRef.current();
        } catch (err) {
          console.error("Error in renderCanvas:", err);
        } finally {
          isRendering = false;
          isRenderingRef.current = false;
        }
      }
      rafId = requestAnimationFrame(tick);
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
        // Allow standard page/component scrolling to bubble up naturally
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
          const c = t.clips.find(c => c.id === state.selectedClipId);
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
          animations = { ...animations, 'transform.scale': addOrUpdateKeyframe(animations['transform.scale'], localTime, newScale) };
        }
        
        updateClip(currentClip.id, { 
          transform: { ...currentClip.transform, scale: newScale },
          animations 
        });
      } else {
        // Fallback to panning workspace if no clip selected
        const panSpeed = settings.scrollSpeed;
        setViewport(prev => ({
          ...prev,
          x: prev.x - e.deltaX * scaleX * panSpeed,
          y: prev.y - e.deltaY * scaleY * panSpeed
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
          const c = t.clips.find(c => c.id === state.selectedClipId);
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
          animations = { ...animations, 'transform.scale': addOrUpdateKeyframe(animations['transform.scale'], localTime, newScale) };
        }
        
        updateClip(currentClip.id, {
          transform: { ...currentClip.transform, scale: newScale },
          animations
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
      
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
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

  // Listen for fullscreen exit via Esc
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // Close speed menu when clicking elsewhere
  useEffect(() => {
    if (!showSpeedMenu) return;
    const close = () => setShowSpeedMenu(false);
    let mounted = true;
      const timer = setTimeout(() => {
        if (mounted) window.addEventListener('click', close);
      }, 0);
      return () => {
        mounted = false;
        clearTimeout(timer);
        window.removeEventListener('click', close);
      };
  }, [showSpeedMenu]);

  // Close canvas settings panel when clicking elsewhere
  useEffect(() => {
    if (!showSettingsPanel) return;
    const close = () => setShowSettingsPanel(false);
    let mounted = true;
      const timer = setTimeout(() => {
        if (mounted) window.addEventListener('click', close);
      }, 0);
      return () => {
        mounted = false;
        clearTimeout(timer);
        window.removeEventListener('click', close);
      };
  }, [showSettingsPanel]);

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };
  const handleSkipBackward = () => seek(Math.max(0, currentTime - 10));
  const handleSkipForward = () => seek(Math.min(totalDuration, currentTime + 10));
  const handleRestart = () => seek(0);

  // -------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------
  const previewWidth = settings.previewQuality === 'quarter' ? 213 : settings.previewQuality === 'half' ? 427 : 854;
  const previewHeight = settings.previewQuality === 'quarter' ? 120 : settings.previewQuality === 'half' ? 240 : 480;

  const cursorStyle = useMemo(() => {
    const sc = tracks.flatMap(t=>t.clips).find(c=>c.id===selectedClipId);
    return activeTool === 'hand' ? (isPanning.current ? 'grabbing' : 'grab') : (activeTool === 'zoom' ? 'zoom-in' : (sc?.particleSettings ? 'crosshair' : 'default'));
  }, [activeTool, tracks, selectedClipId]);

  const progressBarStyle = useMemo(() => ({
    width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`
  }), [currentTime, totalDuration]);

  const scrubThumbStyle = useMemo(() => ({
    left: `calc(${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}% - 6px)`
  }), [currentTime, totalDuration]);

  const volumeBarStyle = useMemo(() => ({
    width: `${isMuted ? 0 : volume * 100}%`
  }), [isMuted, volume]);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Canvas Container Ã¢â‚¬â€ flex-1 so it shares space with the control bar */}
      <div 
        ref={containerRef} 
        id="preview-canvas-wrapper" 
        className="relative flex-1 overflow-hidden bg-[#0a0a0a] select-none touch-none min-h-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          // Ctrl+click or Alt+click Ã¢â€ â€™ set particle emitter position
          const selClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
          if (selClip?.particleSettings && (e.ctrlKey || e.altKey)) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            // Clear old pool so particles restart from new position
            particlePoolsRef.current.delete(selClip.id);
            updateClip(selClip.id, { particleSettings: { ...selClip.particleSettings, emitterX: Math.round(x), emitterY: Math.round(y) } });
          }
        }}
        style={{ cursor: cursorStyle }}
      >
        <canvas
          id="preview-canvas"
          ref={canvasRef}
          width={isExporting ? (exportWidth || 854) : previewWidth}
          height={isExporting ? (exportHeight || 480) : previewHeight}
          className={`pointer-events-none ${
            isFullscreen
              ? 'absolute inset-0 w-full h-full object-contain bg-black'
              : 'w-full h-full object-contain'
          }`}
        />
        <InteractiveCanvasOverlay viewport={viewport} videoElements={videoElements} containerRef={containerRef} />

        {/* Overlay: canvas controls (top-left) */}
        <div className="absolute top-3 left-3 flex gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`p-1.5 rounded transition-colors ${
                showSettingsPanel
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'bg-black/50 hover:bg-black/70 text-white/70 hover:text-white border border-transparent'
              }`}
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* The Settings Panel Dropdown */}
            {showSettingsPanel && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl overflow-hidden pointer-events-auto z-50">
                <div className="p-3 bg-[#252525] border-b border-[#3e3e3e] flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white">Preview Settings</h3>
                  <button onClick={() => setShowSettingsPanel(false)} className="text-[#888] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                  
                  {/* Quality */}
                  <div>
                    <label className="text-[10px] text-[#a0a0a0] mb-2 block">Preview Quality</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['full', 'half', 'quarter'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => useEditorStore.getState().updateSettings({ previewQuality: q })}
                          className={`py-1.5 text-[10px] rounded capitalize transition-colors ${
                            settings.previewQuality === q
                              ? 'bg-amber-500 text-white'
                              : 'bg-[#2a2a2a] hover:bg-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hardware Acceleration */}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#a0a0a0]">Hardware Acceleration</label>
                    <button
                      onClick={() => useEditorStore.getState().updateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                      className={`w-8 h-4 rounded-full transition-colors relative ${settings.hardwareAcceleration ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.hardwareAcceleration ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Safe Zones */}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#a0a0a0]">Safe Zones</label>
                    <button
                      onClick={() => useEditorStore.getState().updateSettings({ showSafeZones: !settings.showSafeZones })}
                      className={`w-8 h-4 rounded-full transition-colors relative ${settings.showSafeZones ? 'bg-sky-500' : 'bg-[#3e3e3e]'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.showSafeZones ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Playback Control Bar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div
        className="shrink-0 flex flex-col bg-[#181818] border-t border-[#2e2e2e]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Progress / Scrub Bar */}
        <div className="px-3 pt-2 pb-1">
          <div className="relative h-1.5 group cursor-pointer">
            <div className="absolute inset-0 rounded-full bg-[#333]" />
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              style={progressBarStyle}
            />
            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              step={0.01}
              value={currentTime}
              onChange={handleTimelineSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ margin: 0 }}
            />
            {/* Scrub thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400 shadow-lg shadow-amber-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={scrubThumbStyle}
            />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between px-3 pb-2">
          {/* Left: time display */}
          <div className="flex items-center gap-2 min-w-[90px]">
            <span className="text-[10px] font-mono text-[#a0a0a0] tabular-nums select-text">
              {String(Math.floor(currentTime / 60)).padStart(2, '0')}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
              <span className="text-[#555]"> / {String(Math.floor(totalDuration / 60)).padStart(2, '0')}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}</span>
            </span>
          </div>

          {/* Center: playback controls */}
          <div className="flex items-center gap-0.5">
            {/* Go to Start */}
            <button
              onClick={handleRestart}
              title="Go to Start"
              className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Skip Backward 10s */}
            <button
              onClick={handleSkipBackward}
              title="Skip Back 10s"
              className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-all"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={togglePlayback}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className={`
                flex items-center justify-center w-9 h-9 rounded-full mx-1 transition-all duration-150 active:scale-95
                ${isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/40'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20'}
              `}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={handleSkipForward}
              title="Skip Forward 10s"
              className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-all"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Reverse playback badge */}
            {playbackDirection === -1 && (
              <span className="ml-1 text-[9px] text-amber-400 font-bold px-1 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">REV</span>
            )}
          </div>

          {/* Right: volume + speed */}
          <div className="flex items-center gap-2 min-w-[90px] justify-end">
            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                className="p-1 text-[#888] hover:text-white transition-colors shrink-0"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <div className="w-14 h-1.5 relative">
                <div className="absolute inset-0 rounded-full bg-[#333]" />
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-[#666] group-hover/vol:bg-amber-500 transition-colors"
                  style={volumeBarStyle}
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Playback Speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                title="Playback Speed"
                className="text-[10px] font-mono text-[#888] hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                {playbackSpeed === 1 ? '1Ãƒâ€”' : `${playbackSpeed}Ãƒâ€”`}
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl overflow-hidden z-50 pointer-events-auto">
                  {speedOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                      className={`block w-full text-left px-4 py-1.5 text-xs transition-colors ${
                        playbackSpeed === s
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white'
                      }`}
                    >
                      {s}Ãƒâ€”
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getClipDimensions(clip: any, mediaLibrary: any[], W: number, H: number): { width: number; height: number } {
  if (!clip) return { width: 0, height: 0 };
  const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) || null;
  let vw = W;
  let vh = H;
  
  if (mediaItem?.type === 'video') {
    vw = 1920;
    vh = 1080;
  } else if (mediaItem?.type === 'image') {
    vw = 1920;
    vh = 1080;
  } else if (mediaItem?.type === 'text' || clip.textSettings || clip.mediaId === 'text-placeholder') {
    const ts = clip.textSettings;
    if (ts) {
      const fontSize = Number(ts.fontSize) || 48;
      const text = String(ts.text || '');
      const lines = text.split('\n');
      const estCharWidth = fontSize * 0.6;
      const longestLine = lines.reduce((max: number, l: string) => Math.max(max, l.length), 0);
      vw = Math.max(80, longestLine * estCharWidth + 40);
      vh = lines.length * (fontSize * 1.35) + 20;
    } else {
      vw = 300;
      vh = 80;
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / (vw || 1), H / (vh || 1));
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;
  
  const scale = clip.transform?.scale ?? 100;
  return {
    width: baseW * (scale / 100),
    height: baseH * (scale / 100),
  };
}

function screenToImageCoords(mx: number, my: number, clip: any, baseW: number, baseH: number, currentTime: number) {
  const aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
  const aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
  const aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

  // 1. Translate back by clip center offset
  const tx = mx - aX;
  const ty = my - aY;

  // 2. Rotate back by negative rotation
  const theta = (-aRot * Math.PI) / 180;
  const rx = tx * Math.cos(theta) - ty * Math.sin(theta);
  const ry = tx * Math.sin(theta) + ty * Math.cos(theta);

  // 3. Scale back
  const sf = aScale / 100 || 1;
  const imgX = rx / sf;
  const imgY = ry / sf;

  // 4. Map from center-origin to top-left of image space
  return {
    x: imgX + baseW / 2,
    y: imgY + baseH / 2
  };
}

function imageToScreenCoords(ix: number, iy: number, clip: any, baseW: number, baseH: number, currentTime: number) {
  const aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
  const aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
  const aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

  // 1. Map to center-origin
  const cx = ix - baseW / 2;
  const cy = iy - baseH / 2;

  // 2. Scale
  const sf = aScale / 100 || 1;
  const sx = cx * sf;
  const sy = cy * sf;

  // 3. Rotate
  const theta = (aRot * Math.PI) / 180;
  const rx = sx * Math.cos(theta) - sy * Math.sin(theta);
  const ry = sx * Math.sin(theta) + sy * Math.cos(theta);

  // 4. Translate
  return {
    x: rx + aX,
    y: ry + aY
  };
}

function floodFill(imgData: ImageData, startX: number, startY: number, tolerance: number = 30): Uint8ClampedArray {
  const w = imgData.width;
  const h = imgData.height;
  const pixels = imgData.data;
  const visited = new Uint8Array(w * h);
  const mask = new Uint8ClampedArray(w * h);

  const sx = Math.max(0, Math.min(w - 1, Math.floor(startX)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(startY)));

  const targetIdx = (sy * w + sx) * 4;
  const targetR = pixels[targetIdx];
  const targetG = pixels[targetIdx + 1];
  const targetB = pixels[targetIdx + 2];
  const targetA = pixels[targetIdx + 3];

  // Use head-pointer instead of shift() to avoid O(nÃ‚Â²) performance on large images
  const queue: [number, number][] = [[sx, sy]];
  let head = 0;
  visited[sy * w + sx] = 1;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = cy * w + cx;
    mask[idx] = 255;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          const pIdx = nIdx * 4;
          const dr = pixels[pIdx] - targetR;
          const dg = pixels[pIdx + 1] - targetG;
          const db = pixels[pIdx + 2] - targetB;
          const da = pixels[pIdx + 3] - targetA;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
          if (dist <= tolerance) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }
  return mask;
}

function inpaint(imageData: ImageData, maskData: Uint8ClampedArray) {
  const w = imageData.width;
  const h = imageData.height;
  const pixels = imageData.data;
  const src = new Uint8ClampedArray(pixels);

  // Perform 18 passes of color-diffusion inpainting
  // NOTE: loop covers ALL pixels including border rows/cols; neighbors are clamped
  for (let iter = 0; iter < 18; iter++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const maskIdx = y * w + x;

        if (maskData[maskIdx] > 128) {
          let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
          let count = 0;

          // Clamped neighbor indices so border pixels are handled safely
          const neighborCoords = [
            [Math.max(0, y - 1), x],
            [Math.min(h - 1, y + 1), x],
            [y, Math.max(0, x - 1)],
            [y, Math.min(w - 1, x + 1)]
          ];

          neighborCoords.forEach(([ny, nx]) => {
            const nIdx = (ny * w + nx) * 4;
            const nMIdx = ny * w + nx;
            if (maskData[nMIdx] <= 128) {
              rSum += src[nIdx];
              gSum += src[nIdx + 1];
              bSum += src[nIdx + 2];
              aSum += src[nIdx + 3];
              count++;
            }
          });

          if (count > 0) {
            pixels[idx] = rSum / count;
            pixels[idx + 1] = gSum / count;
            pixels[idx + 2] = bSum / count;
            pixels[idx + 3] = aSum / count;
          } else {
            let rSumAll = 0, gSumAll = 0, bSumAll = 0, aSumAll = 0;
            neighborCoords.forEach(([ny, nx]) => {
              const nIdx = (ny * w + nx) * 4;
              rSumAll += pixels[nIdx];
              gSumAll += pixels[nIdx + 1];
              bSumAll += pixels[nIdx + 2];
              aSumAll += pixels[nIdx + 3];
            });
            pixels[idx] = rSumAll / 4;
            pixels[idx + 1] = gSumAll / 4;
            pixels[idx + 2] = bSumAll / 4;
            pixels[idx + 3] = aSumAll / 4;
          }
        }
      }
    }
    src.set(pixels);
  }
}

// ---------------------------------------------------------------------------
// Interactive Canvas Overlay Component
// ---------------------------------------------------------------------------
function InteractiveCanvasOverlay({ viewport, videoElements, containerRef }: { viewport: { x: number, y: number, zoom: number }, videoElements: Map<string, HTMLVideoElement>, containerRef: React.RefObject<HTMLDivElement | null> }) {
  const {
    tracks,
    selectedClipId,
    pipWindows,
    currentTime,
    mediaLibrary,
    updateClip: storeUpdateClip,
    canvasTransformMode,
    setCanvasTransformMode,
    aspectRatio,
    useProxies,
    activePropertiesTab,
  } = useEditorStore();

  const updateClip = useCallback((clipId: string, updates: any) => {
    storeUpdateClip(clipId, updates);
  }, [storeUpdateClip]);

  const [dragState, setDragState] = useState<{
    type: string;
    startX: number;
    startY: number;
    initTransform: any;
    initCrop: any;
    baseW?: number;
    baseH?: number;
    initCorners?: LocalCornerPoints;
    initMask?: any;
  } | null>(null);
  
  const [snapGuides, setSnapGuides] = useState<{axis: 'x'|'y', position: number}[]>([]);

  const [imageEditorTool, setImageEditorTool] = useState<'none' | 'magic' | 'lasso' | 'poly'>('none');
  const [selectionPath, setSelectionPath] = useState<{ x: number; y: number }[]>([]);
  const [selectionMask, setSelectionMask] = useState<Uint8ClampedArray | null>(null);
  const [isProcessingSelection, setIsProcessingSelection] = useState(false);
  const editedBlobUrlRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);

  let activeClip = null;
  let mediaItem = null;

  if (selectedClipId) {
    let found = false;
    for (const track of tracks) {
      if (track.hidden) continue;
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        activeClip = clip;
        mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) ||
          (clip.textSettings || clip.mediaId === 'text-placeholder'
            ? { id: clip.mediaId, name: 'Text', type: 'text', duration: clip.duration, url: '', createdAt: Date.now() }
            : null);
        found = true;
        break;
      }
    }
    
    // Also search inside PIP windows
    if (!found && pipWindows) {
      for (const [pipId, pip] of Object.entries(pipWindows)) {
        // We need the parent clip to determine absolute time
        let parentClip = null;
        for (const t of tracks) {
          parentClip = t.clips.find(c => c.id === (pip as any).parentClipId);
          if (parentClip) break;
        }
        
        if (!parentClip) continue;
        const pipAbsStart = parentClip.startTime + (pip.relativeStartTime || 0);
        
        if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
          for (const track of pip.tracks) {
            const clip = track.clips.find((c) => c.id === selectedClipId);
            if (clip) {
              const ptAbsStart = pipAbsStart + clip.startTime;
              if (currentTime >= ptAbsStart && currentTime < ptAbsStart + clip.duration) {
                activeClip = clip;
                mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) || null;
                found = true;
                break;
              }
            }
          }
        }
        if (found) break;
      }
    }
  }

  const aX = activeClip ? getAnimatedValue(activeClip.transform.x, currentTime, activeClip.startTime, activeClip.animations?.['transform.x']) : 0;
  const aY = activeClip ? getAnimatedValue(activeClip.transform.y, currentTime, activeClip.startTime, activeClip.animations?.['transform.y']) : 0;
  const aScale = activeClip ? getAnimatedValue(activeClip.transform.scale, currentTime, activeClip.startTime, activeClip.animations?.['transform.scale']) : 100;
  const aRot = activeClip ? getAnimatedValue(activeClip.transform.rotation, currentTime, activeClip.startTime, activeClip.animations?.['transform.rotation']) : 0;

  const aCropLeft = activeClip ? getAnimatedValue(activeClip.crop?.left || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.left']) : 0;
  const aCropTop = activeClip ? getAnimatedValue(activeClip.crop?.top || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.top']) : 0;
  const aCropRight = activeClip ? getAnimatedValue(activeClip.crop?.right || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.right']) : 0;
  const aCropBot = activeClip ? getAnimatedValue(activeClip.crop?.bottom || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.bottom']) : 0;

  const getHeartPathData = (x: number, y: number, w: number, h: number): string => {
    return `M 0,${h * 0.15} 
            C 0,${-h * 0.35} ${-w * 0.5},${-h * 0.35} ${-w * 0.5},${h * 0.15}
            C ${-w * 0.5},${h * 0.4} 0,${h * 0.45} 0,${h * 0.45}
            C 0,${h * 0.45} ${w * 0.5},${h * 0.4} ${w * 0.5},${h * 0.15}
            C ${w * 0.5},${-h * 0.35} 0,${-h * 0.35} 0,${h * 0.15} Z`;
  };

  const getStarPointsData = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): string => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    const pts = [];

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      rot += step;
    }
    return pts.join(' ');
  };

  useEffect(() => {
    if (!dragState || !activeClip) return;
    const handleMove = (e: MouseEvent) => {
      const container = document.getElementById('preview-canvas-wrapper');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;

      // Adjust delta by viewport zoom so dragging feels natural at any zoom level
      const dx = ((e.clientX - dragState.startX) * scaleX) / viewport.zoom;
      const dy = ((e.clientY - dragState.startY) * scaleY) / viewport.zoom;

      let x = 0, y = 0, scale = 100, rotation = 0;
      if (dragState.initTransform) {
        x = dragState.initTransform.x;
        y = dragState.initTransform.y;
        scale = dragState.initTransform.scale;
        rotation = dragState.initTransform.rotation;
      }
      const crop = dragState.initCrop ? { ...dragState.initCrop } : { left: 0, top: 0, right: 0, bottom: 0 };
      
      const baseW = dragState.baseW || 854;
      const baseH = dragState.baseH || 480;

      let animations = activeClip.animations || {};
      const getActiveClipAbsoluteStartTime = (clipId: string): number => {
        const state = useEditorStore.getState();
        const found = findClipDeep(state, clipId);
        if (found && found.isPip && found.pipId) {
          const pip = (state.pipWindows || {})[found.pipId];
          if (pip) {
            let parentClip = null;
            for (const t of state.tracks) {
              parentClip = t.clips.find(c => c.id === pip.parentClipId);
              if (parentClip) break;
            }
            if (parentClip) {
              return parentClip.startTime + (pip.relativeStartTime || 0) + found.clip.startTime;
            }
          }
        }
        return found?.clip.startTime ?? 0;
      };
      const activeClipAbsStart = getActiveClipAbsoluteStartTime(activeClip.id);
      const localTime = currentTime - activeClipAbsStart;

      // Helper to update base or keyframe
      const getNewAnimations = (prop: string, val: number) => {
        if (animations[prop]) {
          animations = { ...animations, [prop]: addOrUpdateKeyframe(animations[prop], localTime, val) };
        }
      };

      if (dragState.type.startsWith('perspective-corner-')) {
        const cornerIdx = parseInt(dragState.type.split('-')[2]);
        const initCorners = dragState.initCorners!;
        const updatedCorners = { ...initCorners };

        const targetKeyX = `x${cornerIdx}` as keyof typeof initCorners;
        const targetKeyY = `y${cornerIdx}` as keyof typeof initCorners;

        let deltaX = dx;
        let deltaY = dy;
        
        if (activeClip.transform.perspectivePin) {
          const invScale = 100 / aScale;
          deltaX *= invScale;
          deltaY *= invScale;
          
          const invRot = (-aRot * Math.PI) / 180;
          const cos = Math.cos(invRot);
          const sin = Math.sin(invRot);
          
          const rotDx = deltaX * cos - deltaY * sin;
          const rotDy = deltaX * sin + deltaY * cos;
          
          deltaX = rotDx;
          deltaY = rotDy;
        }

        updatedCorners[targetKeyX] = initCorners[targetKeyX] + deltaX;
        updatedCorners[targetKeyY] = initCorners[targetKeyY] + deltaY;

        const hasKeyframes =
          (animations[`transform.perspectiveCorners.x0`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y0`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x1`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y1`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x2`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y2`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x3`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y3`]?.length || 0) > 0;

        if (hasKeyframes) {
          const newAnimations = { ...animations };
          for (let i = 0; i < 4; i++) {
            const kx = `transform.perspectiveCorners.x${i}`;
            const ky = `transform.perspectiveCorners.y${i}`;
            const valX = updatedCorners[`x${i}` as keyof typeof updatedCorners];
            const valY = updatedCorners[`y${i}` as keyof typeof updatedCorners];

            newAnimations[kx] = addOrUpdateKeyframe(animations[kx] || [], localTime, valX);
            newAnimations[ky] = addOrUpdateKeyframe(animations[ky] || [], localTime, valY);
          }
          updateClip(activeClip.id, {
            transform: {
              ...activeClip.transform,
              perspectiveCorners: updatedCorners
            },
            animations: newAnimations
          });
        } else {
          updateClip(activeClip.id, {
            transform: {
              ...activeClip.transform,
              perspectiveCorners: updatedCorners
            }
          });
        }
        return;
      }

      if (dragState.type.startsWith('mask-')) {
        const initM = (dragState as any).initMask || { x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };
        let mx = initM.x;
        let my = initM.y;
        let mw = initM.width;
        let mh = initM.height;
        let mRot = initM.rotation;
        let mFeather = initM.feather;
        let mRoundness = initM.roundness;

        const baseW = dragState.baseW || 854;
        const baseH = dragState.baseH || 480;

        if (dragState.type === 'mask-move') {
          const theta = (-aRot * Math.PI) / 180;
          const localDx = dx * Math.cos(theta) - dy * Math.sin(theta);
          const localDy = dx * Math.sin(theta) + dy * Math.cos(theta);

          mx = Math.max(0, Math.min(100, initM.x + (localDx / baseW) * 100));
          my = Math.max(0, Math.min(100, initM.y + (localDy / baseH) * 100));
          
          getNewAnimations('mask.x', mx);
          getNewAnimations('mask.y', my);
        } else if (dragState.type === 'mask-rot') {
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            let angle = Math.atan2(vy, vx) * (180 / Math.PI);
            angle += 90;
            mRot = Math.round((angle + 360) % 360);
            
            getNewAnimations('mask.rotation', mRot);
          }
        } else if (dragState.type === 'mask-resize-r') {
          const theta = (aRot * Math.PI) / 180;
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projX = vx * Math.cos(-maskRotRad) - vy * Math.sin(-maskRotRad);
            
            mw = Math.max(2, Math.min(200, (Math.abs(projX) * 2 / baseW) * 100));
            getNewAnimations('mask.width', mw);
          }
        } else if (dragState.type === 'mask-resize-b') {
          const theta = (aRot * Math.PI) / 180;
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projY = vx * Math.sin(-maskRotRad) + vy * Math.cos(-maskRotRad);
            
            mh = Math.max(2, Math.min(200, (Math.abs(projY) * 2 / baseH) * 100));
            getNewAnimations('mask.height', mh);
          }
        } else if (dragState.type === 'mask-feather') {
          const theta = (aRot * Math.PI) / 180;
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projX = vx * Math.cos(-maskRotRad) - vy * Math.sin(-maskRotRad);
            
            const maskLocalW = (mw / 100) * baseW;
            const minDim = Math.min(baseW, baseH);
            const distFromEdge = projX - maskLocalW / 2;
            mFeather = Math.max(0, Math.min(100, (distFromEdge / (minDim / 2)) * 100));
            getNewAnimations('mask.feather', mFeather);
          }
        } else if (dragState.type === 'mask-roundness') {
          const theta = (aRot * Math.PI) / 180;
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projX = vx * Math.cos(-maskRotRad) - vy * Math.sin(-maskRotRad);
            
            const maskLocalW = (mw / 100) * baseW;
            const relativeOffset = (projX + maskLocalW / 2) / (maskLocalW / 2);
            mRoundness = Math.max(0, Math.min(100, relativeOffset * 100));
            getNewAnimations('mask.roundness', mRoundness);
          }
        }

        updateClip(activeClip.id, {
          mask: {
            ...activeClip.mask,
            x: mx,
            y: my,
            width: mw,
            height: mh,
            rotation: mRot,
            feather: mFeather,
            roundness: mRoundness,
          },
          animations
        });
        return;
      }

      if (dragState.type === 'move') {
        let newX = x + dx;
        let newY = y + dy;

        const newGuides: { axis: 'x' | 'y'; position: number }[] = [];
        const snapThreshold = 12; // px (magnetic range)

        const draggedWidth = (dragState.baseW || 854) * (scale / 100);
        const draggedHeight = (dragState.baseH || 480) * (scale / 100);

        // 1. Gather other active clips
        const state = useEditorStore.getState();
        const otherActiveClips: any[] = [];
        state.tracks.forEach((track) => {
          if (track.hidden) return;
          track.clips.forEach((clip) => {
            if (clip.id === activeClip.id) return;
            if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
              otherActiveClips.push(clip);
            }
          });
        });

        if (state.pipWindows) {
          Object.values(state.pipWindows).forEach((pip: any) => {
            let parentClip = null;
            for (const t of state.tracks) {
              parentClip = t.clips.find(c => c.id === pip.parentClipId);
              if (parentClip) break;
            }
            if (!parentClip) return;
            const pipAbsStart = parentClip.startTime + (pip.relativeStartTime || 0);
            if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
              pip.tracks.forEach((track: any) => {
                track.clips.forEach((clip: any) => {
                  if (clip.id === activeClip.id) return;
                  const ptAbsStart = pipAbsStart + clip.startTime;
                  if (currentTime >= ptAbsStart && currentTime < ptAbsStart + clip.duration) {
                    otherActiveClips.push(clip);
                  }
                });
              });
            }
          });
        }

        // 2. Snapping X Axis
        let bestSnapX: number | null = null;
        let minDiffX = Infinity;
        let snapXVal: number | null = null;

        const targetsX = [
          -W / 2, // Canvas left
          0,      // Canvas center
          W / 2   // Canvas right
        ];

        otherActiveClips.forEach((other) => {
          const dims = getClipDimensions(other, mediaLibrary, W, H);
          const oX = other.transform?.x ?? 0;
          targetsX.push(oX - dims.width / 2); // Other left
          targetsX.push(oX);                  // Other center
          targetsX.push(oX + dims.width / 2);  // Other right
        });

        const draggedAnchorsX = [
          { val: newX - draggedWidth / 2, type: 'left' },
          { val: newX, type: 'center' },
          { val: newX + draggedWidth / 2, type: 'right' }
        ];

        draggedAnchorsX.forEach((anchor) => {
          targetsX.forEach((targetVal) => {
            const diff = Math.abs(anchor.val - targetVal);
            if (diff < snapThreshold && diff < minDiffX) {
              minDiffX = diff;
              if (anchor.type === 'left') {
                bestSnapX = targetVal + draggedWidth / 2;
              } else if (anchor.type === 'center') {
                bestSnapX = targetVal;
              } else {
                bestSnapX = targetVal - draggedWidth / 2;
              }
              snapXVal = targetVal;
            }
          });
        });

        if (bestSnapX !== null) {
          newX = bestSnapX;
          if (snapXVal !== null) {
            newGuides.push({ axis: 'x', position: snapXVal });
          }
        }

        // 3. Snapping Y Axis
        let bestSnapY: number | null = null;
        let minDiffY = Infinity;
        let snapYVal: number | null = null;

        const targetsY = [
          -H / 2, // Canvas top
          0,      // Canvas center
          H / 2   // Canvas bottom
        ];

        otherActiveClips.forEach((other) => {
          const dims = getClipDimensions(other, mediaLibrary, W, H);
          const oY = other.transform?.y ?? 0;
          targetsY.push(oY - dims.height / 2); // Other top
          targetsY.push(oY);                   // Other center
          targetsY.push(oY + dims.height / 2);  // Other bottom
        });

        const draggedAnchorsY = [
          { val: newY - draggedHeight / 2, type: 'top' },
          { val: newY, type: 'center' },
          { val: newY + draggedHeight / 2, type: 'bottom' }
        ];

        draggedAnchorsY.forEach((anchor) => {
          targetsY.forEach((targetVal) => {
            const diff = Math.abs(anchor.val - targetVal);
            if (diff < snapThreshold && diff < minDiffY) {
              minDiffY = diff;
              if (anchor.type === 'top') {
                bestSnapY = targetVal + draggedHeight / 2;
              } else if (anchor.type === 'center') {
                bestSnapY = targetVal;
              } else {
                bestSnapY = targetVal - draggedHeight / 2;
              }
              snapYVal = targetVal;
            }
          });
        });

        if (bestSnapY !== null) {
          newY = bestSnapY;
          if (snapYVal !== null) {
            newGuides.push({ axis: 'y', position: snapYVal });
          }
        }

        // Filter duplicates
        const uniqueGuides = newGuides.filter(
          (g, idx, self) => self.findIndex((o) => o.axis === g.axis && Math.abs(o.position - g.position) < 0.1) === idx
        );
        setSnapGuides(uniqueGuides);

        getNewAnimations('transform.x', newX);
        getNewAnimations('transform.y', newY);
        x = newX;
        y = newY;
      } else if (dragState.type.startsWith('crop-')) {
        const theta = (-rotation * Math.PI) / 180;
        const localDx = (dx * Math.cos(theta) - dy * Math.sin(theta)) / (scale / 100);
        const localDy = (dx * Math.sin(theta) + dy * Math.cos(theta)) / (scale / 100);

        if (dragState.type === 'crop-left') {
          crop.left = Math.max(0, Math.min(100 - crop.right - 1, crop.left + (localDx / baseW) * 100));
          getNewAnimations('crop.left', crop.left);
        } else if (dragState.type === 'crop-right') {
          crop.right = Math.max(0, Math.min(100 - crop.left - 1, crop.right - (localDx / baseW) * 100));
          getNewAnimations('crop.right', crop.right);
        } else if (dragState.type === 'crop-top') {
          crop.top = Math.max(0, Math.min(100 - crop.bottom - 1, crop.top + (localDy / baseH) * 100));
          getNewAnimations('crop.top', crop.top);
        } else if (dragState.type === 'crop-bottom') {
          crop.bottom = Math.max(0, Math.min(100 - crop.top - 1, crop.bottom - (localDy / baseH) * 100));
          getNewAnimations('crop.bottom', crop.bottom);
        }
      } else if (dragState.type === 'rot') {
        const cx = 427 + x;
        const cy = 240 + y;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        let angle = Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
        angle += 90;
        rotation = Math.round(angle);
        getNewAnimations('transform.rotation', rotation);
      } else {
        const cx = 427 + x;
        const cy = 240 + y;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        
        const wSpan = baseW * (1 - (crop.left + crop.right) / 100) / 2;
        const hSpan = baseH * (1 - (crop.top + crop.bottom) / 100) / 2;
        
        const origDist = Math.sqrt(wSpan ** 2 + hSpan ** 2) * (dragState.initTransform.scale / 100);
        const scaleDelta = dist / origDist;
        scale = dragState.initTransform.scale * scaleDelta;
        scale = Math.max(10, Math.min(1000, Math.round(scale)));
        getNewAnimations('transform.scale', scale);
      }

      updateClip(activeClip.id, { transform: { ...activeClip.transform, x, y, scale, rotation }, crop, animations });
    };

    const handleUp = () => {
      setDragState(null);
      setSnapGuides([]);
      useEditorStore.getState().saveSnapshot();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, activeClip, updateClip, mediaItem, videoElements, viewport, currentTime, aspectRatio]);

  // Convert clientX/Y to image pixel coordinates using SVG's own coordinate system.
  // The <rect> lives inside the clip's transform group, so its CTM already encodes
  // all viewport pan/zoom + aspect offset + clip position/rotation/scale transforms.
  // getScreenCTM().inverse() gives us the rect-local coordinate directly.
  const clientToImagePixel = (e: React.PointerEvent<SVGElement>): { x: number; y: number } | null => {
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
    if (!svgEl) return null;

    // Get the image dimensions
    const img = getCachedImage(mediaItem!.id, mediaItem!.url as string, () => {});
    const imageW = img?.naturalWidth || 1920;
    const imageH = img?.naturalHeight || 1080;

    // Use getScreenCTM to convert client coords to the <rect>'s local space
    const target = e.currentTarget as unknown as SVGGraphicsElement;
    const ctm = target.getScreenCTM();
    if (!ctm) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const localPt = pt.matrixTransform(ctm.inverse());

    // localPt is in the rect's local space: x in [-baseW/2, baseW/2], y in [-baseH/2, baseH/2]
    // Map to image pixel space: (0..imageW, 0..imageH)
    const imgX = Math.round(((localPt.x + baseW / 2) / baseW) * imageW);
    const imgY = Math.round(((localPt.y + baseH / 2) / baseH) * imageH);

    return {
      x: Math.max(0, Math.min(imageW - 1, imgX)),
      y: Math.max(0, Math.min(imageH - 1, imgY))
    };
  };

  const handleEditorPointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (!activeClip || !mediaItem || imageEditorTool === 'none') return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}

    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (imageEditorTool === 'magic' && !img) {
      toast.info('Image is still loading. Please try again in a moment.');
      return;
    }

    const imgPos = clientToImagePixel(e);
    if (!imgPos) return;

    const imageW = img?.naturalWidth || 1920;
    const imageH = img?.naturalHeight || 1080;

    if (imageEditorTool === 'magic' || imageEditorTool === 'lasso') {
      isDrawingRef.current = true;
      setSelectionPath([{ x: imgPos.x, y: imgPos.y }]);
      setSelectionMask(null);
    } else if (imageEditorTool === 'poly') {
      setSelectionMask(null);
      if (selectionPath.length > 2) {
        const first = selectionPath[0];
        const dist = Math.sqrt((imgPos.x - first.x) ** 2 + (imgPos.y - first.y) ** 2);
        const closeThreshold = Math.max(15, imageW * 0.01);
        if (dist < closeThreshold) {
          setSelectionPath(prev => [...prev, { x: first.x, y: first.y }]);
          return;
        }
      }
      setSelectionPath(prev => [...prev, { x: imgPos.x, y: imgPos.y }]);
    }
  };

  const handleEditorPointerMove = (e: React.PointerEvent<SVGElement>) => {
    if (!activeClip || !mediaItem || !isDrawingRef.current || (imageEditorTool !== 'lasso' && imageEditorTool !== 'magic')) return;
    const imgPos = clientToImagePixel(e);
    if (!imgPos) return;
    setSelectionPath(prev => [...prev, { x: imgPos.x, y: imgPos.y }]);
  };

  const handleEditorPointerUp = () => {
    if (imageEditorTool === 'lasso' || imageEditorTool === 'magic') {
      isDrawingRef.current = false;
      if (selectionPath.length > 2) {
        const closedPath = [...selectionPath, { x: selectionPath[0].x, y: selectionPath[0].y }];
        setSelectionPath(closedPath);
        if (imageEditorTool === 'magic') {
          processSmartSelection(closedPath);
        }
      }
    }
  };

  const processSmartSelection = async (path: {x: number, y: number}[]) => {
    if (!activeClip || !mediaItem || mediaItem.type !== 'image') return;
    
    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (!img || img.naturalWidth === 0) {
      toast.error('Image not fully loaded yet.');
      return;
    }
    imageW = img.naturalWidth;
    imageH = img.naturalHeight;

    // 1. Calculate Bounding Box of the drawn lasso
    let minX = imageW, minY = imageH, maxX = 0, maxY = 0;
    path.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });

    // Add padding (10% or at least 20px)
    const pad = Math.max(20, (maxX - minX) * 0.1);
    minX = Math.max(0, Math.floor(minX - pad));
    minY = Math.max(0, Math.floor(minY - pad));
    maxX = Math.min(imageW, Math.ceil(maxX + pad));
    maxY = Math.min(imageH, Math.ceil(maxY + pad));

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    
    if (boxW <= 10 || boxH <= 10) {
      setSelectionPath([]);
      toast.error('Selection too small.');
      return;
    }

    setIsProcessingSelection(true);
    const toastId = toast.loading('Running ML segmentation on selection...');

    try {
      // 2. Crop the image to the bounding box
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = boxW;
      cropCanvas.height = boxH;
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.drawImage(img, minX, minY, boxW, boxH, 0, 0, boxW, boxH);

      const blob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to create blob for cropping');

      // 3. Run ML segmentation on the crop
      const resultBlob = await removeBackground(blob, {
        publicPath: 'https://static.imgly.com/@imgly/background-removal-data/1.4.0/dist/',
        progress: (key: string, current: number, total: number) => {
          // Could update toast if needed
        }
      });

      // 4. Map the transparent PNG back to a full-size mask
      const resultImg = new Image();
      const resultUrl = URL.createObjectURL(resultBlob);
      await new Promise((resolve, reject) => {
        resultImg.onload = () => {
          URL.revokeObjectURL(resultUrl);
          resolve(null);
        };
        resultImg.onerror = (e) => {
          URL.revokeObjectURL(resultUrl);
          reject(e);
        };
        resultImg.src = resultUrl;
      });

      const fullMaskCanvas = document.createElement('canvas');
      fullMaskCanvas.width = imageW;
      fullMaskCanvas.height = imageH;
      const fullMaskCtx = fullMaskCanvas.getContext('2d')!;
      fullMaskCtx.fillStyle = 'black'; // background is completely unselected
      fullMaskCtx.fillRect(0, 0, imageW, imageH);
      
      // Draw the isolated object in the exact bounding box location
      fullMaskCtx.drawImage(resultImg, minX, minY, boxW, boxH);
      
      const fullMaskData = fullMaskCtx.getImageData(0, 0, imageW, imageH);
      const mask = new Uint8ClampedArray(imageW * imageH);
      
      // Extract alpha channel: anywhere imgly kept the object, alpha > 0
      for (let i = 0; i < mask.length; i++) {
        mask[i] = fullMaskData.data[i * 4 + 3]; // alpha channel
      }
      
      setSelectionMask(mask);
      setSelectionPath([]); // Clear the visual lasso path, the mask is now perfect
      toast.success('Smart selection completed!', { id: toastId });
    } catch (error) {
      console.error('Smart selection error:', error);
      toast.error('Smart selection failed. Falling back to manual lasso.', { id: toastId });
    } finally {
      setIsProcessingSelection(false);
    }
  };


  const applyEditorAction = async (action: 'delete' | 'remove' | 'erase') => {
    if (!activeClip || !mediaItem || mediaItem.type !== 'image') return;

    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageW;
    canvas.height = imageH;
    const ctx = canvas.getContext('2d')!;
    if (img) {
      ctx.drawImage(img, 0, 0, imageW, imageH);
    }
    const imgData = ctx.getImageData(0, 0, imageW, imageH);
    const pixels = imgData.data;

    let mask: any = new Uint8ClampedArray(imageW * imageH);
    if (selectionMask) {
      mask = selectionMask;
    } else if (selectionPath.length > 2) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = imageW;
      maskCanvas.height = imageH;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, imageW, imageH);
      maskCtx.fillStyle = 'white';
      maskCtx.beginPath();
      selectionPath.forEach((p, idx) => {
        if (idx === 0) maskCtx.moveTo(p.x, p.y);
        else maskCtx.lineTo(p.x, p.y);
      });
      maskCtx.closePath();
      maskCtx.fill();

      const maskImgData = maskCtx.getImageData(0, 0, imageW, imageH);
      for (let i = 0; i < mask.length; i++) {
        mask[i] = maskImgData.data[i * 4];
      }
    } else {
      toast.error('Please make a selection first.');
      return;
    }

    if (action === 'delete') {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 128) {
          const idx = i * 4;
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 255;
        }
      }
    } else if (action === 'erase') {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 128) {
          pixels[i * 4 + 3] = 0;
        }
      }
    } else if (action === 'remove') {
      inpaint(imgData, mask);
    }

    ctx.putImageData(imgData, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Failed to apply edits.');
        return;
      }

      const editedUrl = URL.createObjectURL(blob);
      const newMediaId = `img_edit_${Date.now()}`;
      const newFile = new File([blob], `edited_${mediaItem.name}.png`, { type: 'image/png' });

      try {
        await saveFileToDB(newMediaId, newFile);

        const newMediaItem = {
          id: newMediaId,
          name: `Edited ${mediaItem.name}`,
          type: 'image' as const,
          duration: mediaItem.duration || 10,
          url: editedUrl,
          thumbnail: editedUrl,
          size: blob.size,
          createdAt: Date.now()
        };

        useEditorStore.setState((state) => ({
          mediaLibrary: [...state.mediaLibrary, newMediaItem]
        }));

        updateClip(activeClip.id, {
          mediaId: newMediaId
        });

        setSelectionPath([]);
        setSelectionMask(null);
        toast.success(`Image edit applied successfully (${action})!`);
      } catch (err) {
        console.error(err);
        toast.error('Error saving edited image.');
      }
    }, 'image/png');
  };

  const getRenderedSelectionPoints = () => {
    if (!activeClip || !mediaItem) return '';
    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    let vw = W;
    let vh = H;
    if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
      vw = 1920;
      vh = 1080;
    }
    let scaleToFit = 1;
    if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
      scaleToFit = Math.min(W / (vw || 1), H / (vh || 1));
    }
    const bW = vw * scaleToFit;
    const bH = vh * scaleToFit;

    return selectionPath.map(p => {
      const localX = (p.x / imageW) * bW - bW / 2;
      const localY = (p.y / imageH) * bH - bH / 2;
      return `${localX},${localY}`;
    }).join(' ');
  };

  const maskDataUrl = useMemo(() => {
    if (!selectionMask || !mediaItem) return null;
    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageW;
    canvas.height = imageH;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(imageW, imageH);
    const pixels = imgData.data;

    for (let i = 0; i < selectionMask.length; i++) {
      if (selectionMask[i] > 128) {
        pixels[i * 4] = 59;
        pixels[i * 4 + 1] = 130;
        pixels[i * 4 + 2] = 246;
        pixels[i * 4 + 3] = 115;
      } else {
        pixels[i * 4 + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL();
  }, [selectionMask, mediaItem]);

  if (!activeClip) return null;

  // Determine active viewport dimensions based on aspect ratio
  let viewW = 854;
  let viewH = 480;
  if (aspectRatio === '9:16') {
    viewW = Math.round(480 * (9 / 16));
  } else if (aspectRatio === '1:1') {
    viewW = 480;
  } else if (aspectRatio === '4:3') {
    viewW = Math.round(480 * (4 / 3));
  }
  const W = viewW;
  const H = viewH;
  const offsetX = (854 - viewW) / 2;
  const offsetY = (480 - viewH) / 2;

  let vw = W;
  let vh = H;
  if (mediaItem?.type === 'video') {
    const v = videoElements.get(activeClip.id);
    if (v && v.videoWidth > 0) {
      vw = v.videoWidth;
      vh = v.videoHeight;
    }
  } else if (mediaItem?.type === 'image') {
    // @ts-ignore
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      vw = img.naturalWidth;
      vh = img.naturalHeight;
    }
  } else if (mediaItem?.type === 'text' || (activeClip as any).textSettings || (activeClip as any).mediaId === 'text-placeholder') {
    // Estimate text bounding box from textSettings
    const ts = (activeClip as any).textSettings;
    if (ts) {
      const fontSize = Number(ts.fontSize) || 48;
      const text = String(ts.text || '');
      const lines = text.split('\n');
      const estCharWidth = fontSize * 0.6;
      const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
      vw = Math.max(80, longestLine * estCharWidth + 40);
      vh = lines.length * (fontSize * 1.35) + 20;
    } else {
      // Generic text box
      vw = 300;
      vh = 80;
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / vw, H / vh);
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;



  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    const mask = activeClip?.mask || { x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initTransform: { x: aX, y: aY, scale: aScale, rotation: aRot },
      initCrop: { left: aCropLeft, top: aCropTop, right: aCropRight, bottom: aCropBot },
      initMask: { ...mask },
      baseW,
      baseH,
    });
  };

  const cx = 854 / 2;
  const cy = 480 / 2;
  const totalX = cx + viewport.x - cx * viewport.zoom;
  const totalY = cy + viewport.y - cy * viewport.zoom;

  const pcBase = activeClip.transform.perspectiveCorners || {
    x0: 0,
    y0: 0,
    x1: W,
    y1: 0,
    x2: W,
    y2: H,
    x3: 0,
    y3: H
  };

  let pc = { ...pcBase };
  
  if (activeClip.transform.perspectivePin) {
    let trackedCorners = null;
    const trackingData = activeClip.transform.perspectiveTrackingData;
    if (trackingData && trackingData.length > 0) {
      const localTime = currentTime - activeClip.startTime;
      let closestDist = Infinity;
      for (const pt of trackingData) {
        const dist = Math.abs(pt.time - localTime);
        if (dist < closestDist) {
          closestDist = dist;
          trackedCorners = pt.corners;
        }
      }
    }
    
    if (trackedCorners) {
      pc = { ...trackedCorners };
    } else {
      pc = {
        x0: getAnimatedValue(pcBase.x0, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x0']),
        y0: getAnimatedValue(pcBase.y0, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y0']),
        x1: getAnimatedValue(pcBase.x1, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x1']),
        y1: getAnimatedValue(pcBase.y1, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y1']),
        x2: getAnimatedValue(pcBase.x2, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x2']),
        y2: getAnimatedValue(pcBase.y2, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y2']),
        x3: getAnimatedValue(pcBase.x3, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x3']),
        y3: getAnimatedValue(pcBase.y3, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y3']),
      };
    }
  }

  let renderedPc = { ...pc };
  if (activeClip.transform.perspectivePin) {
    const ccx = (pc.x0 + pc.x1 + pc.x2 + pc.x3) / 4;
    const ccy = (pc.y0 + pc.y1 + pc.y2 + pc.y3) / 4;
    const scale = aScale / 100;
    const rotRad = (aRot * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    const transformCorner = (x: number, y: number) => {
      let dx = x - ccx;
      let dy = y - ccy;
      dx *= scale;
      dy *= scale;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      return { x: ccx + rx + aX, y: ccy + ry + aY };
    };

    renderedPc = {
      x0: transformCorner(pc.x0, pc.y0).x, y0: transformCorner(pc.x0, pc.y0).y,
      x1: transformCorner(pc.x1, pc.y1).x, y1: transformCorner(pc.x1, pc.y1).y,
      x2: transformCorner(pc.x2, pc.y2).x, y2: transformCorner(pc.x2, pc.y2).y,
      x3: transformCorner(pc.x3, pc.y3).x, y3: transformCorner(pc.x3, pc.y3).y,
    };
  }

  const handleCornerKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const step = e.shiftKey ? 10 : 1;
    const pcBase = activeClip.transform.perspectiveCorners || {
      x0: 0,
      y0: 0,
      x1: W,
      y1: 0,
      x2: W,
      y2: H,
      x3: 0,
      y3: H
    };

    const newPc = { ...pcBase };
    const keyX = `x${idx}` as keyof typeof newPc;
    const keyY = `y${idx}` as keyof typeof newPc;

    if (e.key === 'ArrowLeft') newPc[keyX] -= step;
    else if (e.key === 'ArrowRight') newPc[keyX] += step;
    else if (e.key === 'ArrowUp') newPc[keyY] -= step;
    else if (e.key === 'ArrowDown') newPc[keyY] += step;

    updateClip(activeClip.id, {
      transform: {
        ...activeClip.transform,
        perspectiveCorners: newPc
      }
    });
    useEditorStore.getState().saveSnapshot();
  };

  const handleHandleKeyDown = (e: React.KeyboardEvent, type: string) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const step = e.shiftKey ? 10 : 1;

    if (type === 'move') {
      let newX = aX;
      let newY = aY;
      if (e.key === 'ArrowLeft') newX -= step;
      else if (e.key === 'ArrowRight') newX += step;
      else if (e.key === 'ArrowUp') newY -= step;
      else if (e.key === 'ArrowDown') newY += step;

      updateClip(activeClip.id, {
        transform: { ...activeClip.transform, x: newX, y: newY }
      });
    } else if (type === 'rot') {
      const rotStep = e.shiftKey ? 5 : 1;
      let newRot = aRot;
      if (e.key === 'ArrowLeft') newRot = (newRot - rotStep) % 360;
      else if (e.key === 'ArrowRight') newRot = (newRot + rotStep) % 360;

      updateClip(activeClip.id, {
        transform: { ...activeClip.transform, rotation: newRot }
      });
    } else if (type.startsWith('resize')) {
      // Scale
      let newScale = aScale;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') newScale = Math.min(1000, newScale + step);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') newScale = Math.max(10, newScale - step);

      updateClip(activeClip.id, {
        transform: { ...activeClip.transform, scale: newScale }
      });
    } else if (type.startsWith('crop-')) {
      const crop = activeClip.crop || { left: 0, top: 0, right: 0, bottom: 0 };
      const newCrop = { ...crop };
      if (type === 'crop-left') {
        if (e.key === 'ArrowLeft') newCrop.left = Math.max(0, newCrop.left - step);
        else if (e.key === 'ArrowRight') newCrop.left = Math.min(100 - newCrop.right, newCrop.left + step);
      } else if (type === 'crop-right') {
        if (e.key === 'ArrowRight') newCrop.right = Math.max(0, newCrop.right - step);
        else if (e.key === 'ArrowLeft') newCrop.right = Math.min(100 - newCrop.left, newCrop.right + step);
      } else if (type === 'crop-top') {
        if (e.key === 'ArrowUp') newCrop.top = Math.max(0, newCrop.top - step);
        else if (e.key === 'ArrowDown') newCrop.top = Math.min(100 - newCrop.bottom, newCrop.top + step);
      } else if (type === 'crop-bottom') {
        if (e.key === 'ArrowDown') newCrop.bottom = Math.max(0, newCrop.bottom - step);
        else if (e.key === 'ArrowUp') newCrop.bottom = Math.min(100 - newCrop.top, newCrop.bottom + step);
      }

      updateClip(activeClip.id, { crop: newCrop });
    }
    useEditorStore.getState().saveSnapshot();
  };

  const handleCornerMouseDown = (e: React.MouseEvent, cornerIdx: number) => {
    e.stopPropagation();
    setDragState({
      type: `perspective-corner-${cornerIdx}`,
      startX: e.clientX,
      startY: e.clientY,
      initTransform: null,
      initCrop: null,
      initCorners: { ...pc }
    });
  };

  const mask = activeClip?.mask || { enabled: false, type: 'rectangle', x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };
  const maskLocalX = activeClip ? -baseW / 2 + (mask.x / 100) * baseW : 0;
  const maskLocalY = activeClip ? -baseH / 2 + (mask.y / 100) * baseH : 0;
  const maskLocalW = activeClip ? (mask.width / 100) * baseW : 0;
  const maskLocalH = activeClip ? (mask.height / 100) * baseH : 0;
  const maskRot = mask.rotation || 0;

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" id="preview-canvas-wrapper-overlay">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          viewBox="0 0 854 480"
          role="region"
          aria-label="Interactive canvas overlay"
        >
          <g transform={`translate(${totalX}, ${totalY}) scale(${viewport.zoom}) translate(${offsetX}, ${offsetY})`}>
            {activeClip.transform.perspectivePin ? (
              <g>
                {/* Connected lines */}
                <polygon
                  points={`${renderedPc.x0},${renderedPc.y0} ${renderedPc.x1},${renderedPc.y1} ${renderedPc.x2},${renderedPc.y2} ${renderedPc.x3},${renderedPc.y3}`}
                  fill="transparent"
                  stroke="#fbbf24"
                  strokeWidth={1.5 / viewport.zoom}
                  className="pointer-events-auto cursor-move focus:outline-none"
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                  role="button"
                  aria-label="Move perspective pinned clip"
                />
                
                {/* 4 corner circles */}
                {([0, 1, 2, 3] as const).map((idx) => {
                  const cx = renderedPc[`x${idx}` as keyof typeof renderedPc];
                  const cy = renderedPc[`y${idx}` as keyof typeof renderedPc];
                  return (
                    <circle
                      key={`corner-${idx}`}
                      cx={cx}
                      cy={cy}
                      r={7 / viewport.zoom}
                      fill="#fbbf24"
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-crosshair focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label={`Perspective corner ${idx + 1}`}
                      onMouseDown={(e) => handleCornerMouseDown(e, idx)}
                      onKeyDown={(e) => handleCornerKeyDown(e, idx)}
                    />
                  );
                })}
              </g>
            ) : (
              <g
                transform={`translate(${W / 2 + aX}, ${H / 2 + aY}) rotate(${aRot}) scale(${aScale / 100})`}
              >
                {activePropertiesTab === 'mask' && mask.enabled ? (
                  <g transform={`translate(${maskLocalX}, ${maskLocalY}) rotate(${maskRot})`}>
                    {/* Outline of the mask shape */}
                    {mask.type === 'rectangle' && (
                      <rect
                        x={-maskLocalW / 2}
                        y={-maskLocalH / 2}
                        width={maskLocalW}
                        height={maskLocalH}
                        rx={(mask.roundness || 0) / 100 * Math.min(maskLocalW, maskLocalH) / 2}
                        ry={(mask.roundness || 0) / 100 * Math.min(maskLocalW, maskLocalH) / 2}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}
                    
                    {mask.type === 'circle' && (
                      <ellipse
                        cx={0}
                        cy={0}
                        rx={maskLocalW / 2}
                        ry={maskLocalH / 2}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}
                    
                    {mask.type === 'split' && (
                      <>
                        <line
                          x1={-baseW * 5}
                          y1={0}
                          x2={baseW * 5}
                          y2={0}
                          stroke="#00d4ff"
                          strokeWidth={2 / viewport.zoom}
                          strokeDasharray="4,4"
                        />
                        <rect
                          x={-baseW * 5}
                          y={0}
                          width={baseW * 10}
                          height={baseH * 5}
                          fill="rgba(0, 212, 255, 0.07)"
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    )}
                    
                    {mask.type === 'filmstrip' && (
                      <>
                        <line
                          x1={-baseW * 5}
                          y1={-maskLocalH / 2}
                          x2={baseW * 5}
                          y2={-maskLocalH / 2}
                          stroke="#00d4ff"
                          strokeWidth={2 / viewport.zoom}
                          strokeDasharray="4,4"
                        />
                        <line
                          x1={-baseW * 5}
                          y1={maskLocalH / 2}
                          x2={baseW * 5}
                          y2={maskLocalH / 2}
                          stroke="#00d4ff"
                          strokeWidth={2 / viewport.zoom}
                          strokeDasharray="4,4"
                        />
                        <rect
                          x={-baseW * 5}
                          y={-maskLocalH / 2}
                          width={baseW * 10}
                          height={maskLocalH}
                          fill="rgba(0, 212, 255, 0.07)"
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    )}
                    
                    {mask.type === 'heart' && (
                      <path
                        d={getHeartPathData(-maskLocalW / 2, -maskLocalH / 2, maskLocalW, maskLocalH)}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}
                    
                    {mask.type === 'star' && (
                      <polygon
                        points={getStarPointsData(0, 0, 5, maskLocalW / 2, maskLocalW / 4)}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}

                    {/* Center Translate Handle */}
                    <circle
                      cx={0}
                      cy={0}
                      r={7 / viewport.zoom}
                      fill="#00d4ff"
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-move"
                      onMouseDown={(e) => handleMouseDown(e, 'mask-move')}
                    />

                    {/* Rotation Arm & Handle */}
                    <line
                      x1={0}
                      y1={0}
                      x2={0}
                      y2={-maskLocalH / 2 - 30 / viewport.zoom}
                      stroke="#00d4ff"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    <circle
                      cx={0}
                      cy={-maskLocalH / 2 - 34 / viewport.zoom}
                      r={6 / viewport.zoom}
                      fill="#ffd700"
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-alias"
                      onMouseDown={(e) => handleMouseDown(e, 'mask-rot')}
                    />

                    {/* Resize Handles (Width) */}
                    {(mask.type === 'rectangle' || mask.type === 'circle' || mask.type === 'heart' || mask.type === 'star') && (
                      <>
                        <circle
                          cx={maskLocalW / 2}
                          cy={0}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ew-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-r')}
                        />
                        <circle
                          cx={-maskLocalW / 2}
                          cy={0}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ew-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-r')}
                        />
                      </>
                    )}

                    {/* Resize Handles (Height) */}
                    {(mask.type === 'rectangle' || mask.type === 'filmstrip') && (
                      <>
                        <circle
                          cx={0}
                          cy={-maskLocalH / 2}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ns-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-b')}
                        />
                        <circle
                          cx={0}
                          cy={maskLocalH / 2}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ns-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-b')}
                        />
                      </>
                    )}

                    {/* Feather Handle */}
                    <g transform={`translate(${mask.type === 'split' ? 50 / viewport.zoom : maskLocalW / 2 + 15 / viewport.zoom}, 0)`}>
                      <polygon
                        points="0,-4 8,0 0,4"
                        fill="#ff6b6b"
                        className="pointer-events-auto cursor-pointer"
                        onMouseDown={(e) => handleMouseDown(e, 'mask-feather')}
                        transform={`translate(${(mask.feather / 100) * Math.min(baseW, baseH) / 2}, 0)`}
                      />
                      <line
                        x1={0}
                        y1={0}
                        x2={50 / viewport.zoom}
                        y2={0}
                        stroke="#ff6b6b"
                        strokeWidth={1.5 / viewport.zoom}
                        strokeDasharray="2,2"
                        opacity={0.6}
                      />
                    </g>

                    {/* Roundness Handle */}
                    {mask.type === 'rectangle' && (
                      <circle
                        cx={-maskLocalW / 2 + (mask.roundness || 0) / 100 * maskLocalW / 2}
                        cy={-maskLocalH / 2 + (mask.roundness || 0) / 100 * maskLocalH / 2}
                        r={5 / viewport.zoom}
                        fill="#9b59b6"
                        stroke="white"
                        strokeWidth={1.5 / viewport.zoom}
                        className="pointer-events-auto cursor-nwse-resize"
                        onMouseDown={(e) => handleMouseDown(e, 'mask-roundness')}
                      />
                    )}
                  </g>
                ) : (
                  <rect
                    x={-baseW / 2}
                    y={-baseH / 2}
                    width={baseW}
                    height={baseH}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.5 / viewport.zoom}
                    className="pointer-events-none"
                  />
                )}

                {/* Image Selection Mask & Marching Ants */}
                {maskDataUrl && (
                  <image
                    href={maskDataUrl}
                    x={-baseW / 2}
                    y={-baseH / 2}
                    width={baseW}
                    height={baseH}
                    className="pointer-events-none"
                  />
                )}

                {selectionPath.length > 1 && (
                  <polygon
                    points={getRenderedSelectionPoints()}
                    fill="rgba(255, 0, 255, 0.15)"
                    stroke="#ff00ff"
                    strokeWidth={1.5 / viewport.zoom}
                    strokeDasharray="4,4"
                    className="marching-ants pointer-events-none"
                  />
                )}

                {imageEditorTool !== 'none' && (
                  <rect
                    x={-baseW / 2}
                    y={-baseH / 2}
                    width={baseW}
                    height={baseH}
                    fill="rgba(0,0,0,0.01)"
                    className="pointer-events-auto cursor-crosshair focus:outline-none"
                    onPointerDown={handleEditorPointerDown}
                    onPointerMove={handleEditorPointerMove}
                    onPointerUp={handleEditorPointerUp}
                    onPointerCancel={handleEditorPointerUp}
                  />
                )}

                {activePropertiesTab === 'mask' && mask.enabled ? null : imageEditorTool !== 'none' ? null : canvasTransformMode === 'resize' ? (
                  <>
                    {/* Invisible drag area for moving */}
                    <rect
                      x={-baseW / 2}
                      y={-baseH / 2}
                      width={baseW}
                      height={baseH}
                      fill="transparent"
                      className="pointer-events-auto cursor-move focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Move clip"
                      onMouseDown={(e) => handleMouseDown(e, 'move')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'move')}
                    />
                    {/* Rotation handle Ã¢â‚¬â€ circle above the top-center of the clip */}
                    <line
                      x1={0}
                      y1={-baseH / 2}
                      x2={0}
                      y2={-baseH / 2 - 24 / viewport.zoom}
                      stroke="#fbbf24"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    <circle
                      cx={0}
                      cy={-baseH / 2 - 28 / viewport.zoom}
                      r={6 / viewport.zoom}
                      fill="#fbbf24"
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-alias focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Rotate clip"
                      onMouseDown={(e) => handleMouseDown(e, 'rot')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'rot')}
                    >
                      <title>Rotate</title>
                    </circle>
                    {/* Resize handles */}
                    {[-1, 1].map((rx) =>
                      [-1, 1].map((ry) => (
                        <circle
                          key={`${rx}-${ry}`}
                          cx={(rx * baseW) / 2}
                          cy={(ry * baseH) / 2}
                          r={6 / viewport.zoom}
                          fill="#fbbf24"
                          stroke="#141414"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto focus:outline-none focus:stroke-white focus:stroke-2"
                          style={{
                            cursor: rx === ry ? 'nwse-resize' : 'nesw-resize',
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Resize handle ${rx > 0 ? 'right' : 'left'}-${ry > 0 ? 'bottom' : 'top'}`}
                          onMouseDown={(e) =>
                            handleMouseDown(e, `resize-${rx > 0 ? 'r' : 'l'}${ry > 0 ? 'b' : 't'}`)
                          }
                          onKeyDown={(e) =>
                            handleHandleKeyDown(e, `resize-${rx > 0 ? 'r' : 'l'}${ry > 0 ? 'b' : 't'}`)
                          }
                        />
                      )),
                    )}
                  </>
                ) : (
                  // CROP MODE
                  <>
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW}
                      y={-baseH / 2 + (aCropTop / 100) * baseH}
                      width={baseW * (1 - (aCropLeft + aCropRight) / 100)}
                      height={baseH * (1 - (aCropTop + aCropBot) / 100)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2 / viewport.zoom}
                      strokeDasharray="4 4"
                      className="pointer-events-none"
                    />
                    {/* Crop drag handles */}
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Left"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-left')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-left')}
                    />
                    <rect
                      x={-baseW / 2 + baseW - (aCropRight / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Right"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-right')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-right')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Top"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-top')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-top')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + baseH - (aCropBot / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Bottom"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-bottom')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-bottom')}
                    />
                  </>
                )}
              </g>
            )}
            
            {/* Smart Guides */}
            {snapGuides.map((g, i) => (
              <line
                key={`guide-${i}`}
                x1={g.axis === 'x' ? W/2 + g.position : 0}
                y1={g.axis === 'y' ? H/2 + g.position : 0}
                x2={g.axis === 'x' ? W/2 + g.position : W}
                y2={g.axis === 'y' ? H/2 + g.position : H}
                stroke="#ff00ff"
                strokeWidth={1/viewport.zoom}
                strokeDasharray="4,4"
              />
            ))}
          </g>
          <defs>
            <style>{`
              @keyframes marching-ants {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: -8; }
              }
              .marching-ants {
                animation: marching-ants 0.4s linear infinite;
              }
            `}</style>
          </defs>
        </svg>
      </div>

      {/* Floating Picture Editor Toolbar */}
      {mediaItem?.type === 'image' && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-0 z-50 pointer-events-auto select-none flex items-stretch"
          style={{ right: 0 }}
        >
          {/* Sidebar panel */}
          <div
            className={`flex flex-col bg-[#141414]/95 backdrop-blur-md border border-[#3e3e3e] border-r-0 rounded-l-xl shadow-2xl overflow-y-auto overflow-x-hidden max-h-[90vh] custom-scrollbar transition-all duration-200 ${
              imageEditorTool !== 'none' || true ? 'w-[90px]' : 'w-0 opacity-0'
            }`}
          >
            {/* === SELECTION TOOLS GROUP === */}
            <div className="px-2 pt-2 pb-1">
              <span className="block text-center text-[8px] font-bold text-[#6a6a6a] uppercase tracking-widest mb-1.5">Select</span>

              {/* Magic Wand */}
              <button
                onClick={() => {
                  setImageEditorTool(imageEditorTool === 'magic' ? 'none' : 'magic');
                  setSelectionPath([]);
                  setSelectionMask(null);
                }}
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 transition-all ${
                  imageEditorTool === 'magic'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                title="Magic Wand Ã¢â‚¬â€œ auto-select region by color"
              >
                <Wand2 className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Magic</span>
              </button>

              {/* Lasso */}
              <button
                onClick={() => {
                  setImageEditorTool(imageEditorTool === 'lasso' ? 'none' : 'lasso');
                  setSelectionPath([]);
                  setSelectionMask(null);
                }}
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 transition-all ${
                  imageEditorTool === 'lasso'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                title="Lasso Ã¢â‚¬â€œ draw freehand selection"
              >
                <Scissors className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Lasso</span>
              </button>

              {/* Polygon Lasso */}
              <button
                onClick={() => {
                  setImageEditorTool(imageEditorTool === 'poly' ? 'none' : 'poly');
                  setSelectionPath([]);
                  setSelectionMask(null);
                }}
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-all ${
                  imageEditorTool === 'poly'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                title="Polygon Ã¢â‚¬â€œ click points to draw polygon"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 5-3 10-10 3L3 11Z"/></svg>
                <span className="text-[9px] font-medium leading-none">Polygon</span>
              </button>

              {/* Clear Selection */}
              {(selectionPath.length > 0 || selectionMask) && (
                <button
                  onClick={() => { setSelectionPath([]); setSelectionMask(null); }}
                  className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mt-1 text-red-400 hover:bg-red-500/10 transition-all"
                  title="Clear selection"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-medium leading-none">Clear</span>
                </button>
              )}
            </div>

            <div className="h-px bg-[#2e2e2e] mx-2 my-0.5" />

            {/* === ACTION TOOLS GROUP === */}
            <div className="px-2 pt-1 pb-2">
              <span className="block text-center text-[8px] font-bold text-[#6a6a6a] uppercase tracking-widest mb-1.5">Action</span>

              {/* Delete */}
              <button
                onClick={() => applyEditorAction('delete')}
                disabled={selectionPath.length === 0 && !selectionMask}
                className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 bg-red-600/80 hover:bg-red-500 disabled:bg-[#252525] disabled:text-[#555] text-white transition-all"
                title="Delete Ã¢â‚¬â€œ fill selection with black"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/></svg>
                <span className="text-[9px] font-medium leading-none">Delete</span>
              </button>

              {/* Remove (AI) */}
              <button
                onClick={() => applyEditorAction('remove')}
                disabled={selectionPath.length === 0 && !selectionMask}
                className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 bg-gradient-to-b from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:from-[#252525] disabled:to-[#252525] disabled:text-[#555] text-white transition-all"
                title="Remove Ã¢â‚¬â€œ AI object removal (inpainting)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[9px] font-medium leading-none">Remove</span>
              </button>

              {/* Erase */}
              <button
                onClick={() => applyEditorAction('erase')}
                disabled={selectionPath.length === 0 && !selectionMask}
                className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg bg-purple-700/80 hover:bg-purple-600 disabled:bg-[#252525] disabled:text-[#555] text-white transition-all"
                title="Erase Ã¢â‚¬â€œ make selection transparent"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="text-[9px] font-medium leading-none">Erase</span>
              </button>
            </div>

            <div className="h-px bg-[#2e2e2e] mx-2 my-0.5" />

            {/* === CANVAS TRANSFORM TOOLS === */}
            <div className="px-2 pt-1 pb-2">
              <span className="block text-center text-[8px] font-bold text-[#6a6a6a] uppercase tracking-widest mb-1.5">Canvas</span>
              <button
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 transition-all ${
                  canvasTransformMode === 'resize'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('resize'); setImageEditorTool('none'); }}
                title="Transform Mode"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Move</span>
              </button>
              <button
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-all ${
                  canvasTransformMode === 'crop'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('crop'); setImageEditorTool('none'); }}
                title="Crop Mode"
              >
                <Scissors className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Crop</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-image clips: just show the Transform/Crop toggle (compact) */}
      {mediaItem?.type !== 'image' && (
        <div className="absolute top-4 right-4 bg-[#252525] border border-[#3e3e3e] rounded flex flex-col overflow-hidden shadow-lg pointer-events-auto z-10">
          <button
            className={`p-2 transition-colors ${
              canvasTransformMode === 'resize' ? 'bg-[#3e3e3e] text-amber-500' : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
            }`}
            onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('resize'); }}
            title="Transform Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            className={`p-2 transition-colors ${
              canvasTransformMode === 'crop' ? 'bg-[#3e3e3e] text-amber-500' : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
            }`}
            onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('crop'); }}
            title="Crop Mode"
          >
            <Scissors className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
