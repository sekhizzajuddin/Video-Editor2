import { applyAiBackgroundMask } from '../utils/aiBackground';
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
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useMediaPlayback, FrameCacheEntry } from '@/hooks/useMediaPlayback';
import type { TimelineTrack, MediaItem } from '@/types';
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
    selectClip,
    playbackSpeed,
    setPlaybackSpeed,
    playbackDirection,
    mediaLibrary,
    updateClip,
    canvasTransformMode,
    setCanvasTransformMode,
    setPreviewCanvas,
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
  } = useEditorStore();

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
  const allClips = useMemo(() => tracks.flatMap((t) => t.clips), [tracks]);
  const allClipsRef = useRef(allClips);
  useEffect(() => {
    allClipsRef.current = allClips;
  }, [allClips]);

  // Clean up unused particle pools to prevent memory leaks
  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => c.id));
    for (const clipId of particlePoolsRef.current.keys()) {
        if (!allClipIds.has(clipId)) {
          particlePoolsRef.current.delete(clipId);
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
    framePendingRef.current = true;
  }, [currentTime, tracks, selectedClipId, mediaLibrary, videoElements, frameCache, imageRevision, requestRedraw, viewport, settings, showGrid, canvasBgColor, isPlaying, aspectRatio, isExporting, exportWidth, exportHeight, showProgressBar, progressBarColor, progressBarHeight, useProxies]);
  
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
    if (canvasRef.current) {
      setPreviewCanvas(canvasRef.current);
    }
  }, [setPreviewCanvas]);

  // Keep a mutable ref of currentTime so the playback loop effect doesn't tear down/setup on every frame
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
      // Synchronously catch external seeks to prevent race conditions
      return useEditorStore.subscribe(
        (state) => {
          if (!state.isPlaying) {
            currentTimeRef.current = state.currentTime;
          }
        }
      );
    }, []);
    
    // Fallback sync just in case
    useEffect(() => {
      if (!useEditorStore.getState().isPlaying) {
         currentTimeRef.current = currentTime;
      }
    }, [currentTime]);

  // -------------------------------------------------------------------
  // Playback loop – advance currentTime via rAF when playing
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();
    
    // Reset particle time tracking when playback starts to prevent jump
    lastParticleTimeRef.current = null;

    const loop = (now: number) => {
      const state = useEditorStore.getState();
      const dir = state.playbackDirection ?? 1;
      const speed = state.playbackSpeed;
      const currentSeek = state.seek;
      const currentPause = state.pause;
      const selectedIds = state.selectedClipIds;
      const allClips = allClipsRef.current;

      if (state.isExporting) {
        // Export Mode: Fixed timestep throttled to target export FPS
        const targetFps = state.exportFps || 30;
        const frameDuration = 1000 / targetFps; // ms per frame
        const elapsed = now - lastTime;

        if (elapsed >= frameDuration) {
          // Adjust lastTime by frameDuration to maintain precision
          lastTime = now - (elapsed % frameDuration);
          
          const dt = 1 / targetFps;
          const newTime = currentTimeRef.current + dt * speed * dir;

          // Capping at sequence end
          let maxEndSequence = 0;
          for (const c of allClips) {
            const end = c.startTime + c.duration;
            if (end > maxEndSequence) maxEndSequence = end;
          }

          if (dir >= 0 && newTime >= maxEndSequence) {
            currentSeek(maxEndSequence);
            currentTimeRef.current = maxEndSequence;
            currentPause();
            if (animId) cancelAnimationFrame(animId);
            return;
          }

          if (dir < 0 && newTime <= 0) {
            currentSeek(0);
            currentTimeRef.current = 0;
            currentPause();
            if (animId) cancelAnimationFrame(animId);
            return;
          }

          currentSeek(newTime);
          currentTimeRef.current = newTime;
        }
        animId = requestAnimationFrame(loop);
      } else {
        // Normal Playback Mode: Real-time clock delta
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        const newTime = currentTimeRef.current + dt * speed * dir;

        if (selectedIds.length > 0) {
          // Selection Loop Playback Mode
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
              const startPos = dir >= 0 ? minStart : maxEnd;
              currentSeek(startPos);
              currentTimeRef.current = startPos;
            } else {
              currentSeek(newTime);
              currentTimeRef.current = newTime;
            }
            animId = requestAnimationFrame(loop);
            return;
          }
        }

        // Default Playback Mode (Cap at sequence end)
        let maxEndSequence = 0;
        for (const c of allClips) {
          const end = c.startTime + c.duration;
          if (end > maxEndSequence) maxEndSequence = end;
        }

        if (dir < 0 && newTime <= 0) {
          currentSeek(0);
          currentTimeRef.current = 0;
          currentPause();
          if (animId) cancelAnimationFrame(animId);
          return;
        }

        if (dir >= 0 && newTime >= maxEndSequence) {
          currentSeek(0);
          currentTimeRef.current = 0;
          currentPause();
          if (animId) cancelAnimationFrame(animId);
          return;
        }

        currentSeek(newTime);
        currentTimeRef.current = newTime;
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // -------------------------------------------------------------------
  // Canvas rendering – called whenever time, tracks, or images change
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

    // ── Double buffering: render to offscreen composite canvas, then blit ──
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

    // ── Frame gate: during scrubbing, check if videos are ready or have cached frames ──
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
        // No cached frame available — show the last good frame instead of flashing
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

    // Helper to apply masking
    const applyClipMask = (context: CanvasRenderingContext2D, mask: any, dx: number, dy: number, dw: number, dh: number) => {
      if (!mask || !mask.enabled) return;
      context.beginPath();
      if (mask.type === 'rectangle') {
        const mx = dx + (mask.x / 100) * dw - (mask.width / 100) * dw / 2;
        const my = dy + (mask.y / 100) * dh - (mask.height / 100) * dh / 2;
        const mw = (mask.width / 100) * dw;
        const mh = (mask.height / 100) * dh;
        context.rect(mx, my, mw, mh);
      } else if (mask.type === 'circle') {
        const mx = dx + (mask.x / 100) * dw;
        const my = dy + (mask.y / 100) * dh;
        const mr = (mask.width / 100) * Math.min(dw, dh) / 2;
        context.arc(mx, my, mr, 0, Math.PI * 2);
      } else if (mask.type === 'path' && mask.points?.length > 0) {
        mask.points.forEach((pt: any, i: number) => {
          const px = dx + (pt.x / 100) * dw;
          const py = dy + (pt.y / 100) * dh;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.closePath();
      }
      
      if (mask.invert) {
        context.rect(dx - 10000, dy - 10000, dw + 20000, dh + 20000);
        context.clip('evenodd');
      } else {
        context.clip();
      }
    };

    // Helper to draw a single clip with custom opacity/transform multipliers
    const drawSingleClip = async (
      clip: any,
      opacityMultiplier: number = 1,
      extraTransform?: { translateX?: number; translateY?: number; scale?: number }
    ) => {
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
      
      const localTime = currentTime - clip.startTime;
      // FIX: Use the actual configured transition duration instead of hardcoded 1s
      if (clip.transitionIn?.type === 'dissolve') {
        const tDur = clip.transitionIn.duration || 1;
        if (localTime >= 0 && localTime < tDur) aOpacity *= (localTime / tDur);
      } else if (clip.transitionOut?.type === 'dissolve') {
        const tDur = clip.transitionOut.duration || 1;
        if (localTime > clip.duration - tDur && localTime <= clip.duration) aOpacity *= ((clip.duration - localTime) / tDur);
      }
      
      let slideX = 0;
      if (clip.transitionIn?.type === 'slide') {
        const tDur = clip.transitionIn.duration || 1;
        if (localTime >= 0 && localTime < tDur) slideX = (1 - (localTime / tDur)) * -1000;
      } else if (clip.transitionOut?.type === 'slide') {
        const tDur = clip.transitionOut.duration || 1;
        if (localTime > clip.duration - tDur && localTime <= clip.duration) slideX = ((localTime - (clip.duration - tDur)) / tDur) * 1000;
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
        ctx.scale(finalScale, finalScale);
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
      const exposure = Number.isFinite(filters.exposure) ? filters.exposure : 0;
      const contrast = Number.isFinite(filters.contrast) ? filters.contrast : 100;
      const saturation = Number.isFinite(filters.saturation) ? filters.saturation : 100;
      const blur = Number.isFinite(filters.blur) ? filters.blur : 0;

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

          applyClipMask(ctx, clip.mask, dx, dy, dw, dh);

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasAiBg = clip.aiBackground?.enabled;
          const hasChroma = clip.chromaKey?.enabled;
          const hasLuma = clip.lumaKey?.enabled;
          const hasLut = !!clip.lut?.mediaId;
          const hasFx = !!activeFxClip;
          const needsOffscreen = hasWheels || hasChroma || hasLuma || hasLut || hasFx || hasAiBg;

          if (hasPerspectiveWarp && corners) {
            const offscreenWidth = Math.max(1, Math.round(dw * DOWNSCALE));
            const offscreenHeight = Math.max(1, Math.round(dh * DOWNSCALE));
            const offscreen = getOrCreateCanvas('clip_' + clip.id, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
              oCtx.drawImage(frameSource, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, frameSource as any, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
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
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, frameSource as any, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                  applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
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
          // Video not ready yet during playback – draw placeholder
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

          // ── Ken Burns zoom + pan ──────────────────────────────
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
          // ─────────────────────────────────────────────────────

          applyClipMask(ctx, clip.mask, dx, dy, dw, dh);

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasAiBg = clip.aiBackground?.enabled;
          const hasChroma = clip.chromaKey?.enabled;
          const hasLuma = clip.lumaKey?.enabled;
          const hasLut = !!clip.lut?.mediaId;
          const hasFx = !!activeFxClip;
          const needsOffscreen = hasWheels || hasChroma || hasLuma || hasLut || hasFx || hasAiBg;

          if (hasPerspectiveWarp && corners) {
            const offscreenWidth = Math.max(1, Math.round(dw * DOWNSCALE));
            const offscreenHeight = Math.max(1, Math.round(dh * DOWNSCALE));
            const offscreen = getOrCreateCanvas('clip_' + clip.id, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
              oCtx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, img, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
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
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, img, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                  applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
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
          // Image still loading – placeholder
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

        // ── Animation progress ────────────────────────────────────────────
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

            // ─── CINEMATIC ANIMATIONS (IN) ───────────────────────────────────────────

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
              // We move from left + fade in — canvas clip-path is approximated with offset
              textXOffset += (1 - inProgress) * -200;
              textAlpha   *= Math.min(1, inProgress * 2); // fast alpha so it feels like a wipe
              break;
            }

            case 'splitReveal': {
              // Scales up from near-zero with fade — classic cinematic title reveal
              const ease = 1 - Math.pow(1 - inProgress, 3); // cubic ease-out
              textScale *= (0.05 + 0.95 * ease);
              textAlpha *= ease;
              break;
            }

            case 'glitch': {
              // Rapid random XY jitter that settles as inProgress → 1
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
              textScale   *= (0.4 + 0.6 * ease);   // scale X from 0.4 → 1.0
              textAlpha   *= ease;
              break;
            }

            case 'rollUp': {
              // Film-credit hard roll: text comes from far below very fast
              const ease = 1 - Math.pow(1 - inProgress, 4); // quart ease-out — fast then eases
              textYOffset += (1 - ease) * 180;
              textAlpha   *= Math.min(1, inProgress * 4); // opacity snaps on early
              break;
            }

            case 'scaleFlip': {
              // Y-axis squeeze (scaleY 0 → 1) then pops open — dramatic reveal
              const ease = inProgress < 0.5
                ? 4 * inProgress * inProgress * inProgress            // cubic ease-in for first half
                : 1 - Math.pow(-2 * inProgress + 2, 3) / 2;          // cubic ease-out for second half
              textScale   *= Math.max(0.01, ease);   // scaleY approximated via uniform scale
              textAlpha   *= Math.min(1, inProgress * 3);
              break;
            }

            case 'zoomBlur': {
              // Blockbuster zoom: starts very large and slams down to 1×, heavy alpha ramp
              const ease = 1 - Math.pow(1 - inProgress, 3); // cubic ease-out
              textScale *= (3.0 - 2.0 * ease);     // 3× → 1× zoom in
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

            // ─── CINEMATIC OUT animations ──────────────────────────────────────

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

        // ── Multiline split ───────────────────────────────────────────────
                
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

        // ── Sub-transform for animation (applied on top of clip transform) ─
        ctx.save();
        ctx.translate(textXOffset, textYOffset);
        ctx.scale(textScale, textScale);
        ctx.globalAlpha *= textAlpha;

        // Background rect (centered at 0,0 which is already at clip's aX,aY center)
        if (ts.backgroundColor !== 'transparent') {
          ctx.fillStyle = ts.backgroundColor;
          const bgX = ts.textAlign === 'left'  ? -20 :
                      ts.textAlign === 'right' ? -(dw - 20) : -dw / 2;
          ctx.fillRect(bgX, -dh / 2, dw, dh);
        }

        // X position for text based on alignment (0 = clip center)
        const textX = ts.textAlign === 'left'  ? -(maxLineWidth / 2) :
                      ts.textAlign === 'right' ? (maxLineWidth / 2) : 0;

        // Draw each line
        const totalTextH = lines.length * lineHeight;
        lines.forEach((line: string, lineIdx: number) => {
          const lineY = -totalTextH / 2 + lineIdx * lineHeight + lineHeight / 2;

          // 3D depth layers — FIX H3: no shadow on depth layers (shadow goes on the main text below)
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
        // transitionOut on clipA (outgoing clip) — check both so dropped transitions work regardless
        for (let idx = 1; idx < sortedClips.length; idx++) {
          const clipB = sortedClips[idx];
          const clipA = sortedClips[idx - 1];
          const gap = clipB.startTime - (clipA.startTime + clipA.duration);

          // Determine which transition definition to use: prefer transitionIn on B, fallback to transitionOut on A
          const trans = (Math.abs(gap) < 0.1 && clipB.transitionIn)
            ? clipB.transitionIn
            : (Math.abs(gap) < 0.1 && clipA.transitionOut)
              ? clipA.transitionOut
              : null;

          if (trans) {
            const duration = Math.max(0.01, trans.duration);
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
                let opacityMultiplier = 1;
                
                // Handle single-clip transition In (fade, etc)
                if (clip.transitionIn) {
                  const trans = clip.transitionIn;
                  const duration = trans.duration || 1.0;
                  const alignment = trans.params?.alignment || 'center';
                  let leftSec = clip.startTime - duration / 2;
                  if (alignment === 'left') leftSec = clip.startTime;
                  else if (alignment === 'right') leftSec = clip.startTime - duration;
                  const rightSec = leftSec + duration;
                  
                  if (currentTime >= leftSec && currentTime < rightSec) {
                    const t = (currentTime - leftSec) / duration;
                    if (trans.name.toLowerCase().includes('fade') || trans.name.toLowerCase().includes('dissolve')) {
                      opacityMultiplier = t;
                    }
                  }
                }
                
                // Handle single-clip transition Out (applied when NOT in a 2-clip cross-fade zone)
                if (clip.transitionOut) {
                  const trans = clip.transitionOut;
                  const duration = trans.duration || 1.0;
                  const alignment = trans.params?.alignment || 'center';
                  let leftSec = (clip.startTime + clip.duration) - duration / 2;
                  if (alignment === 'left') leftSec = (clip.startTime + clip.duration);
                  else if (alignment === 'right') leftSec = (clip.startTime + clip.duration) - duration;
                  const rightSec = leftSec + duration;
                  
                  if (currentTime >= leftSec && currentTime < rightSec) {
                    const t = (currentTime - leftSec) / duration;
                    if (trans.name.toLowerCase().includes('fade') || trans.name.toLowerCase().includes('dissolve')) {
                      opacityMultiplier *= (1 - t);
                    }
                  }
                }

                await drawSingleClip(clip, opacityMultiplier);
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw clip:', clip.id, err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
        }
      });
    };

    const queueOverLayersForTracks = (tracksList: any[], isText: boolean) => {
      tracksList.forEach((track, trackIdx) => {
        const activeOverLayers = (track.overLayers || []).filter(
          (ol: any) => !ol.disabled && ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration
        );

        for (const ol of activeOverLayers) {
          const z = ol.zIndex ?? (trackIdx * 10 + 5 + (isText ? 1000 : 0));
          drawQueue.push({
            zIndex: z,
            fn: async () => {
              try {
                await drawSingleClip(ol as any, 1);
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw over layer:', ol.id, err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
        }
      });
    };

    // Queue Video tracks
    queueMainClipsForTracks(videoTracks, false);
    queueOverLayersForTracks(videoTracks, false);

    // Queue Text tracks (Default 1000+ zIndex)
    queueMainClipsForTracks(textTracks, true);
    queueOverLayersForTracks(textTracks, true);

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
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
      for (const ol of track.overLayers || []) {
        if (!ol.disabled && ol.particleSettings && ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
          renderParticles(ctx, ol.id, ol.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
    }

    // ── Apply LUT per active clip ──────────────────────────────────────────
    // After compositing all clips, apply LUT grading per clip that has one.
    // We apply the last active clip's LUT to the full canvas for simplicity.
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (
          clip.lut?.mediaId &&
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
          if (lutMedia?.lutData) {
            applyLutToCanvas(ctx, W, H, lutMedia.lutData, clip.lut!.intensity ?? 100);
          }
        }
      }
      for (const ol of track.overLayers || []) {
        if (
          !ol.disabled &&
          ol.lut?.mediaId &&
          currentTime >= ol.startTime &&
          currentTime < ol.startTime + ol.duration
        ) {
          const lutMedia = mediaLibrary.find((m) => m.id === ol.lut!.mediaId);
          if (lutMedia?.lutData) {
            applyLutToCanvas(ctx, W, H, lutMedia.lutData, ol.lut!.intensity ?? 100);
          }
        }
      }
    }

    ctx.restore(); // Restore from viewport transform

    // ── Render Subtitles (from store subtitles array) ─────────────────────
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

    // ── Grid Overlay ────────────────────────────────────────────────────
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

    // ── Double buffer blit: copy finished composite to visible canvas in one atomic draw ──
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

  // ── Unified render loop to prevent flickering during scrubbing ──
  // Use a frame-pending flag + single rAF loop instead of canceling/rescheduling.
  const renderCanvasRef = useRef(renderCanvas);
  const rafActiveRef = useRef(false);

    useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  });

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
    const tick = async () => {
      // FIX: During playback, always mark a new frame as pending so the render loop
      // never skips a frame even if the previous render took >16ms.
      if (useEditorStore.getState().isPlaying) {
        framePendingRef.current = true;
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
      
      if (e.altKey) {
        // Alt + Scroll -> Zoom Workspace
        setViewport(prev => {
          const zoomDelta = e.deltaY > 0 ? -0.1 * sens : 0.1 * sens;
          const newZoom = Math.min(Math.max(prev.zoom + zoomDelta, 0.1), 5.0);
          
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleY;
          const cx = 854 / 2;
          const cy = 480 / 2;
          
          const nx = (mx - cx) * (1 - newZoom / prev.zoom) + prev.x * (newZoom / prev.zoom);
          const ny = (my - cy) * (1 - newZoom / prev.zoom) + prev.y * (newZoom / prev.zoom);
          
          return { x: nx, y: ny, zoom: newZoom };
        });
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl + Scroll (or pinch) -> Zoom Content (Clip Scale)
        const state = useEditorStore.getState();
        let currentClip = null;
        if (state.selectedClipId) {
          for (const t of state.tracks) {
            if (t.type === 'video') {
              const c = t.clips.find(c => c.id === state.selectedClipId);
              if (c && state.currentTime >= c.startTime && state.currentTime < c.startTime + c.duration) {
                currentClip = c;
                break;
              }
            }
          }
        }
        
        if (currentClip) {
          const currentScale = currentClip.transform.scale;
          // pinch zooms often have small deltaY (e.g. 1-5), mouse wheel is often 100
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
        }
      } else {
        // Two-finger pan -> Pan Workspace
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
      const rect = containerRef.current!.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      
      setViewport(prev => {
        const zoomDelta = e.altKey ? -0.5 : 0.5;
        const newZoom = Math.min(Math.max(prev.zoom + zoomDelta, 0.1), 5.0);
        const cx = 854 / 2;
        const cy = 480 / 2;
        const nx = (mx - cx) * (1 - newZoom / prev.zoom) + prev.x * (newZoom / prev.zoom);
        const ny = (my - cy) * (1 - newZoom / prev.zoom) + prev.y * (newZoom / prev.zoom);
        return { x: nx, y: ny, zoom: newZoom };
      });
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

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Canvas Container — flex-1 so it shares space with the control bar */}
      <div 
        ref={containerRef} 
        id="preview-canvas-wrapper" 
        className="relative flex-1 overflow-hidden bg-[#0a0a0a] select-none touch-none min-h-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          // Ctrl+click or Alt+click → set particle emitter position
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
        style={{ cursor: activeTool === 'hand' ? (isPanning.current ? 'grabbing' : 'grab') : (activeTool === 'zoom' ? 'zoom-in' : (() => { const sc = tracks.flatMap(t=>t.clips).find(c=>c.id===selectedClipId); return sc?.particleSettings ? 'crosshair' : 'default'; })()) }}
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
        <InteractiveCanvasOverlay viewport={viewport} videoElements={videoElements} />

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

      {/* ── Playback Control Bar ───────────────────────────────────────────── */}
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
              style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
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
              style={{ left: `calc(${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}% - 6px)` }}
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
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
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
                {playbackSpeed === 1 ? '1×' : `${playbackSpeed}×`}
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
                      {s}×
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


// ---------------------------------------------------------------------------
// Interactive Canvas Overlay Component
// ---------------------------------------------------------------------------
function InteractiveCanvasOverlay({ viewport, videoElements }: { viewport: { x: number, y: number, zoom: number }, videoElements: Map<string, HTMLVideoElement> }) {
  const {
    tracks,
    selectedClipId,
    selectedOverLayerId,
    currentTime,
    mediaLibrary,
    updateClip: storeUpdateClip,
    updateOverLayer,
    canvasTransformMode,
    setCanvasTransformMode,
    aspectRatio,
    useProxies,
  } = useEditorStore();

  const updateClip = useCallback((clipId: string, updates: any) => {
    const isOl = tracks.some((t) => (t.overLayers || []).some((ol) => ol.id === clipId));
    if (isOl) {
      updateOverLayer(clipId, updates);
    } else {
      storeUpdateClip(clipId, updates);
    }
  }, [tracks, storeUpdateClip, updateOverLayer]);

  const [dragState, setDragState] = useState<{
    type: string;
    startX: number;
    startY: number;
    initTransform: any;
    initCrop: any;
    baseW?: number;
    baseH?: number;
    initCorners?: LocalCornerPoints;
  } | null>(null);
  
  const [snapGuides, setSnapGuides] = useState<{axis: 'x'|'y', position: number}[]>([]);

  let activeClip = null;
  let mediaItem = null;

  if (selectedOverLayerId) {
    for (const track of tracks) {
      if (track.hidden) continue;
      const ol = (track.overLayers || []).find((c) => c.id === selectedOverLayerId);
      if (ol && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
        activeClip = ol;
        mediaItem = mediaLibrary.find((m) => m.id === ol.mediaId) ||
          (ol.textSettings || ol.mediaId === 'text-placeholder'
            ? { id: ol.mediaId, name: 'Text', type: 'text', duration: ol.duration, url: '', createdAt: Date.now() }
            : null);
        break;
      }
    }
  } else if (selectedClipId) {
    for (const track of tracks) {
      if (track.hidden) continue;
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        activeClip = clip;
        mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) ||
          (clip.textSettings || clip.mediaId === 'text-placeholder'
            ? { id: clip.mediaId, name: 'Text', type: 'text', duration: clip.duration, url: '', createdAt: Date.now() }
            : null);
        break;
      }
    }
  }

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
      const localTime = currentTime - activeClip.startTime;

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

        updatedCorners[targetKeyX] = initCorners[targetKeyX] + dx;
        updatedCorners[targetKeyY] = initCorners[targetKeyY] + dy;

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

      if (dragState.type === 'move') {
        let newX = x + dx;
        let newY = y + dy;
        
        const newGuides: {axis: 'x'|'y', position: number}[] = [];
        const snapThreshold = 15; // px (before scaling)
        
        // Center snapping
        if (Math.abs(newX) < snapThreshold) {
          newX = 0;
          newGuides.push({ axis: 'x', position: 0 });
        }
        if (Math.abs(newY) < snapThreshold) {
          newY = 0;
          newGuides.push({ axis: 'y', position: 0 });
        }
        
        setSnapGuides(newGuides);
        
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

  const aX = getAnimatedValue(activeClip.transform.x, currentTime, activeClip.startTime, activeClip.animations?.['transform.x']);
  const aY = getAnimatedValue(activeClip.transform.y, currentTime, activeClip.startTime, activeClip.animations?.['transform.y']);
  const aScale = getAnimatedValue(activeClip.transform.scale, currentTime, activeClip.startTime, activeClip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(activeClip.transform.rotation, currentTime, activeClip.startTime, activeClip.animations?.['transform.rotation']);

  const aCropLeft = getAnimatedValue(activeClip.crop?.left || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.left']);
  const aCropTop = getAnimatedValue(activeClip.crop?.top || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.top']);
  const aCropRight = getAnimatedValue(activeClip.crop?.right || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.right']);
  const aCropBot = getAnimatedValue(activeClip.crop?.bottom || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.bottom']);

  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initTransform: { x: aX, y: aY, scale: aScale, rotation: aRot },
      initCrop: { left: aCropLeft, top: aCropTop, right: aCropRight, bottom: aCropBot },
      baseW,
      baseH,
    });
  };

  const cx = 854 / 2;
  const cy = 480 / 2;
  const totalX = cx + viewport.x - cx * viewport.zoom;
  const totalY = cy + viewport.y - cy * viewport.zoom;

  const pcBase = activeClip.transform.perspectiveCorners || {
    x0: W / 2 + aX - (baseW / 2) * (aScale / 100),
    y0: H / 2 + aY - (baseH / 2) * (aScale / 100),
    x1: W / 2 + aX + (baseW / 2) * (aScale / 100),
    y1: H / 2 + aY - (baseH / 2) * (aScale / 100),
    x2: W / 2 + aX + (baseW / 2) * (aScale / 100),
    y2: H / 2 + aY + (baseH / 2) * (aScale / 100),
    x3: W / 2 + aX - (baseW / 2) * (aScale / 100),
    y3: H / 2 + aY + (baseH / 2) * (aScale / 100)
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

  const handleCornerKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const step = e.shiftKey ? 10 : 1;
    const pcBase = activeClip.transform.perspectiveCorners || {
      x0: W / 2 + aX - (baseW / 2) * (aScale / 100),
      y0: H / 2 + aY - (baseH / 2) * (aScale / 100),
      x1: W / 2 + aX + (baseW / 2) * (aScale / 100),
      y1: H / 2 + aY - (baseH / 2) * (aScale / 100),
      x2: W / 2 + aX + (baseW / 2) * (aScale / 100),
      y2: H / 2 + aY + (baseH / 2) * (aScale / 100),
      x3: W / 2 + aX - (baseW / 2) * (aScale / 100),
      y3: H / 2 + aY + (baseH / 2) * (aScale / 100)
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
                  points={`${pc.x0},${pc.y0} ${pc.x1},${pc.y1} ${pc.x2},${pc.y2} ${pc.x3},${pc.y3}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={1.5 / viewport.zoom}
                />
                
                {/* 4 corner circles */}
                {([0, 1, 2, 3] as const).map((idx) => {
                  const cx = pc[`x${idx}` as keyof typeof pc];
                  const cy = pc[`y${idx}` as keyof typeof pc];
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
                {/* Main selection border */}
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

                {canvasTransformMode === 'resize' ? (
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
                    {/* Rotation handle — circle above the top-center of the clip */}
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
        </svg>
      </div>

      <div className="absolute top-4 right-4 bg-[#252525] border border-[#3e3e3e] rounded flex overflow-hidden shadow-lg pointer-events-auto z-10">
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
    </>
  );
}
