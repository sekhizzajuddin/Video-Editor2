/**
 * CanvasRenderingEngine.ts
 * 
 * High-performance 2D Canvas composition engine for Preview Canvas.
 * Handles double-buffering, multi-track clip layering, video frame drawing,
 * text/solid/shape rendering, LUT color grading, chroma key, mask clipping,
 * particle simulation, transitions, and FX pipeline.
 * 
 * Connected to:
 * - EditorStore: Reads tracks, mediaLibrary, settings, aspectRatio, pipWindows.
 * - Timeline: Evaluates active currentTime for clip visibility & keyframe animation values.
 * - MediaPanel: Accesses HTMLVideoElements and frame cache from useMediaPlayback.
 * - PropertyPanel: Applies clip transform, color filters, chroma keying, and masks.
 */

import { TimelineTrack, MediaItem } from '@/types';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { getAnimatedValue } from '@/utils/keyframes';
import { getMediaTimeForClip } from '@/utils/speedRamp';

import { applyLutToCanvas } from '@/utils/lutParser';
import { applyAiBackgroundSmart, applySubjectNeonOutlineFlash } from '@/utils/aiBackgroundIntegrated';
import { applyObjectRemoval } from '@/utils/objectRemoval';
import { drawSubscribeAnimation } from '@/utils/socialAnimations';
import {
  getCachedImage,
  getProjectedCorners,
  drawPerspectiveTexture,
  renderParticles,
  drawMediaPlaceholder,
  applyColorOverlays,
  applyChromaKeyOnData,
  applyLumaKeyOnData,
  applyColorGradingWheelsOnData,
  applyFxEffect,
  ParticlePool,
  LocalCornerPoints
} from '@/utils/canvasEffects';
import { applyCurvesToImageData as applyCurves, buildCurveLUT as buildLUT, isCurveActive as isCurveOn } from '@/utils/curvesEngine';
import { applyVectorMaskToContext } from '@/utils/vectorMaskEngine';
import { applyAdjustmentLayerPass } from '@/utils/adjustmentLayerEngine';
import { getInterpolatedMotionPosition } from '@/utils/motionTrackingEngine';
import { MediaPlaybackResult } from '@/hooks/useMediaPlayback';
import { getClipDimensions } from './previewMath';
import { resolveBlendPlan } from '@/utils/blendCompositor';
import {
  findActiveTransition,
  buildTransitionPlan,
  type ActiveTransition,
  type LayerDraw,
} from '@/utils/transitionEngine';

// ---------------------------------------------------------------------------
// Module-level track list cache — avoids filter()+sort()+spread on every frame.
// Tracks reference is stable (Zustand gives new ref on mutation), so this is safe.
// ---------------------------------------------------------------------------
let _cachedTracksRef: TimelineTrack[] | null = null;
let _cachedVideoTracks: TimelineTrack[] = [];
let _cachedTextTracks: TimelineTrack[] = [];
let _cachedVisualTracks: TimelineTrack[] = [];

// ---------------------------------------------------------------------------
// Per-clip animation presence cache — avoids Object.keys(clip.animations) every frame.
// Object.keys() allocates a new Array every call. At 4 clips × 60fps = 14,400 arrays/min.
// Invalidated when tracks reference changes (Zustand always gives new ref on mutation).
// ---------------------------------------------------------------------------
const _clipHasAnimCache = new Map<string, boolean>();
let _animCacheTracksRef: TimelineTrack[] | null = null;

// ---------------------------------------------------------------------------
// Curve LUT memoisation.
// buildCurveLUT() interpolates a spline into a 256-entry table. That result only
// depends on the curve definition, so we key a WeakMap on the curve object itself:
// editing a curve produces a new object (immutable store updates) and therefore a
// natural cache miss, while steady-state playback is a single map lookup.
// A WeakMap also means deleted clips' LUTs are collected automatically.
// ---------------------------------------------------------------------------
const IDENTITY_LUT = (() => {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = i;
  return lut;
})();

const _curveLutCache = new WeakMap<object, Uint8ClampedArray>();

function getCachedCurveLUT(curve: any): Uint8ClampedArray {
  if (!curve || typeof curve !== 'object') return buildLUT(curve);
  const hit = _curveLutCache.get(curve);
  if (hit) return hit;
  const lut = buildLUT(curve);
  _curveLutCache.set(curve, lut);
  return lut;
}

export interface RenderCanvasParams {
  canvas: HTMLCanvasElement;
  compositeCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  offscreenCanvasPool: React.MutableRefObject<Map<string, HTMLCanvasElement>>;
  particlePoolsRef: React.MutableRefObject<Map<string, ParticlePool>>;
  lastParticleTimeRef: React.MutableRefObject<number | null>;
  lastFrameCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  isScrubbing?: boolean;
  renderDeps: {
    currentTime: number;
    tracks: TimelineTrack[];
    selectedClipId: string | null;
    mediaLibrary: MediaItem[];
    videoElements: Map<string, HTMLVideoElement>;
    viewport: { x: number; y: number; zoom: number };
    settings: any;
    showGrid: boolean;
    canvasBgColor: string;
    isPlaying: boolean;
    isScrubbing?: boolean;
    aspectRatio: string;
    isExporting: boolean;
    exportWidth?: number;
    exportHeight?: number;
    showProgressBar: boolean;
    progressBarColor?: string;
    progressBarHeight?: number;
    useProxies?: boolean;
    imageRevision: number;
    requestRedraw: () => void;
  };
}

const MAX_POOL_CANVASES = 16;

/**
 * Buffers that must never be evicted by the LRU while a frame is in flight.
 * `composite` is the final drawing target; the blend/transition scratch buffers
 * are read back later in the SAME frame, so recycling them mid-pass would make one
 * clip draw into another clip's buffer — visible as tearing or a punched-out hole
 * when several effects (e.g. background removal + a partial blend) are combined.
 */
const RESERVED_POOL_KEYS: ReadonlySet<string> = new Set([
  'composite',
  '__blend_layer',
  '__blend_backdrop',
  '__transition_from',
  '__transition_to',
]);

export function getOrCreateCanvas(
  offscreenPool: Map<string, HTMLCanvasElement>,
  key: string,
  w: number,
  h: number
): HTMLCanvasElement {
  let canvas = offscreenPool.get(key);
  if (!canvas) {
    if (offscreenPool.size >= MAX_POOL_CANVASES) {
      // Evict least-recently-used entry (FIFO of Map iteration order, which
      // we maintain by delete-then-set below). Reserved buffers are skipped.
      for (const k of offscreenPool.keys()) {
        if (!RESERVED_POOL_KEYS.has(k)) {
          offscreenPool.delete(k);
          break;
        }
      }
    }
    canvas = document.createElement('canvas');
    offscreenPool.set(key, canvas);
  } else {
    // Touch: re-insert to mark as most-recently-used.
    offscreenPool.delete(key);
    offscreenPool.set(key, canvas);
  }
  const targetW = Math.max(1, Math.round(w));
  const targetH = Math.max(1, Math.round(h));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  return canvas;
}

export async function renderCanvasEngine({
  canvas,
  compositeCtxRef,
  offscreenCanvasPool,
  particlePoolsRef,
  lastParticleTimeRef,
  lastFrameCanvasRef,
  isScrubbing: isScrubbingParam,
  renderDeps
}: RenderCanvasParams) {
  const currentTime = renderDeps.currentTime;
  const {
    tracks: tracksRaw,
    mediaLibrary: mediaLibraryRaw,
    videoElements,
    viewport,
    settings,
    showGrid,
    canvasBgColor,
    isPlaying,
    aspectRatio,
    isExporting,
    useProxies
  } = renderDeps;

  const tracks = tracksRaw as TimelineTrack[];
  const mediaLibrary = mediaLibraryRaw as MediaItem[];
  const hasClips = tracks.some((t) => t.clips.length > 0);
  const isScrubbing = isScrubbingParam ?? renderDeps.isScrubbing ?? false;

  if (!canvas) return;

  const composite = getOrCreateCanvas(offscreenCanvasPool.current, 'composite', canvas.width, canvas.height);
  if (composite.width !== canvas.width || composite.height !== canvas.height) {
    composite.width = canvas.width;
    composite.height = canvas.height;
    compositeCtxRef.current = null;
  }

  if (!compositeCtxRef.current) {
    compositeCtxRef.current = composite.getContext('2d', {
      alpha: false,
      // NOTE: Do NOT set willReadFrequently here — the composite canvas only does
      // drawImage compositing and never calls getImageData. Setting willReadFrequently
      // disables GPU acceleration, causing massive performance degradation.
    }) || null;
  }
  if (!compositeCtxRef.current) return;
  const ctx = compositeCtxRef.current;
  // PERF: During scrub disable bilinear filter on composite ctx for max GPU throughput.
  // On scrub-end, the 'procut-scrub-finalize' path triggers a full-quality redraw.
  if (isScrubbing) {
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  const previewQuality = settings?.previewQuality ?? useEditorStore.getState().settings?.previewQuality ?? 'full';
  const previewMode = settings?.previewMode ?? useEditorStore.getState().settings?.previewMode ?? 'auto';
  // Phase 3 Theme A2: Quality-2/3 Short-Circuit Integration for granular preview-mode gating.
  // NOTE: Both c.aiBackground?.enabled and c.objectRemoval?.enabled are intentionally
  // EXCLUDED from isAutoFast. These features handle their own playback optimization
  // via humanDetection.ts (temporal caching, scene-change detection, downscaled inference).
  // Including them here creates a circular dependency where enabling the feature causes
  // it to skip itself during playback.
  const activeVideoClipCount = tracks
    .filter((t) => t.type === 'video' && !t.hidden)
    .reduce((count, track) => {
      const hasActive = track.clips.some(
        (c) => !c.disabled && currentTime >= c.startTime && currentTime < c.startTime + c.duration + 0.001
      );
      return count + (hasActive ? 1 : 0);
    }, 0);

  const isAutoFast =
    previewMode === 'auto' &&
    isPlaying &&
    (activeVideoClipCount > 1 || tracks.length > 5 || tracks.some(t => t.clips.some(c => !c.disabled && (c.chromaKey?.enabled || c.lutFilter?.mediaId))));
  // Scrubbing forces quality-2 path so heavy FX (chroma, LUT, AI bg) are skipped,
  // making playhead drag feel CapCut-smooth.
  // Adaptive performance downgrade: if rolling FPS dropped below 50 for >1.5s,
  // PERF: snapshot store state ONCE per frame. Previously drawSingleClip
  // called useEditorStore.getState() 3× per clip per frame — expensive when
  // 10 tracks × 5 clips = 150 store reads per render.
  const storeState = useEditorStore.getState();
  const perfDowngraded = storeState.perfDowngraded;
  const adaptiveSlowdown = !isExporting && perfDowngraded && isPlaying;
  const skipExpensiveFX = !isExporting && (isScrubbing || adaptiveSlowdown || (isPlaying && (previewMode === 'fast' || isAutoFast || previewQuality === 'quarter')));
  const skipUltraHeavyFX = !isExporting && (isScrubbing || adaptiveSlowdown || (isPlaying && (previewMode === 'fast' || isAutoFast || previewQuality === 'quarter' || previewQuality === 'half')));

  // PERF: build mediaMap once per render. mediaLibrary.find() per clip was
  // an O(N×M) hot loop. With 5 clips × 50 media items, that's 250 comparisons
  // per frame — measurable on slow devices.
  const mediaMap = new Map<string, MediaItem>();
  for (let i = 0; i < mediaLibraryRaw.length; i++) {
    mediaMap.set(mediaLibraryRaw[i].id, mediaLibraryRaw[i]);
  }

  const now = performance.now();
  const lastTime = lastParticleTimeRef.current ?? now;
  lastParticleTimeRef.current = now;
  let rawDelta = 0;
  // Particles freeze during scrub — they're heavy and look jarring anyway.
  if (isPlaying && !isScrubbing && lastParticleTimeRef.current !== null) {
    rawDelta = now - lastTime;
    if (rawDelta > 300) {
      rawDelta = 16.67;
    }
  }
  const deltaMs = Math.min(100, rawDelta);

  const W_target = 854;
  const H_target = 480;
  const canvas_scale = canvas.width / W_target;

  // NOTE: The old needsWait early-return was removed because it blocked the entire
  // rendering pipeline when a video element was mid-seek (readyState < 1). The
  // drawSingleClip function now falls back to cached ImageBitmaps from frameCache,
  // so we always proceed with rendering to ensure smooth scrubbing and transform updates.

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

  ctx.strokeStyle = '#3e3e3e';
  ctx.lineWidth = 1 / viewport.zoom;
  ctx.strokeRect(offsetX, offsetY, viewW, viewH);

  ctx.beginPath();
  ctx.rect(offsetX, offsetY, viewW, viewH);
  ctx.clip();

  ctx.translate(offsetX, offsetY);

  // --- Virtual Camera Pan & Scan ---
  const virtualCamera = useEditorStore.getState().virtualCamera;
  if (isExporting && virtualCamera?.enabled) {
    let camX = 0;
    let camY = 0;
    const currentKeyframes = virtualCamera.keyframes[aspectRatio as '16:9' | '9:16' | '1:1' | '4:3'] || [];
    if (currentKeyframes.length > 0) {
      const sorted = [...currentKeyframes].sort((a, b) => a.time - b.time);
      let before = sorted[0];
      let after = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].time <= currentTime && sorted[i + 1].time >= currentTime) {
          before = sorted[i];
          after = sorted[i + 1];
          break;
        }
      }
      if (before === after || currentTime <= before.time) {
        camX = before.x;
        camY = before.y;
      } else if (currentTime >= after.time) {
        camX = after.x;
        camY = after.y;
      } else {
        const t = (currentTime - before.time) / (after.time - before.time);
        camX = before.x + (after.x - before.x) * t;
        camY = before.y + (after.y - before.y) * t;
      }
    }
    // Shift the world opposite to the camera's movement to keep the framed region in the center crop box
    ctx.translate(-camX * 854, -camY * 480);
  }
  // ---------------------------------

  // PERF: Cache filtered+sorted track lists. filter()+sort()+spread creates 3 new arrays
  // every frame (60/s). Now only rebuilds when the `tracks` reference changes.
  if (tracks !== _cachedTracksRef) {
    _cachedVideoTracks = tracks
      .filter((t) => t.type === 'video' && !t.hidden)
      .sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
    _cachedTextTracks = tracks.filter((t) => t.type === 'text' && !t.hidden);
    _cachedVisualTracks = [..._cachedVideoTracks, ..._cachedTextTracks];
    _cachedTracksRef = tracks;
  }
  const videoTracks = _cachedVideoTracks;
  const visualTracks = _cachedVisualTracks;

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
    animations: any,
    expressions?: any
  ) => {
    if (!mask || !mask.enabled) return;
    
    const mX = getAnimatedValue(mask.x ?? 50, currentTime, clipStartTime, animations?.['mask.x'], expressions?.['mask.x']);
    const mY = getAnimatedValue(mask.y ?? 50, currentTime, clipStartTime, animations?.['mask.y'], expressions?.['mask.y']);
    const mW = getAnimatedValue(mask.width ?? 50, currentTime, clipStartTime, animations?.['mask.width'], expressions?.['mask.width']);
    const mH = getAnimatedValue(mask.height ?? 50, currentTime, clipStartTime, animations?.['mask.height'], expressions?.['mask.height']);
    const mRot = getAnimatedValue(mask.rotation ?? 0, currentTime, clipStartTime, animations?.['mask.rotation'], expressions?.['mask.rotation']);
    const mFeather = getAnimatedValue(mask.feather ?? 0, currentTime, clipStartTime, animations?.['mask.feather'], expressions?.['mask.feather']);
    const mRoundness = getAnimatedValue(mask.roundness ?? 0, currentTime, clipStartTime, animations?.['mask.roundness'], expressions?.['mask.roundness']);
    
    const mx = (mX / 100) * ow;
    const my = (mY / 100) * oh;
    const mw = (mW / 100) * ow;
    const mh = (mH / 100) * oh;
    const feather = (mFeather / 100) * Math.min(ow, oh);
    
    const maskCanvas = getOrCreateCanvas(offscreenCanvasPool.current, 'clip_mask_temp_' + clipId, ow, oh);
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
        try {
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
        } finally {
          inMatteRendering = false;
        }
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

  const drawSingleClip = async (
    clip: any,
    opacityMultiplier: number = 1,
    extraTransform?: { translateX?: number; translateY?: number; scale?: number },
    targetCtx?: CanvasRenderingContext2D
  ) => {
    // `let` (not const): a partial blend temporarily redirects all drawing in this
    // function to a scratch layer. See the blend compositing block below.
    let ctx = targetCtx || compositeCtxRef.current;
    if (!ctx) return;
    // PERF: O(1) lookup via mediaMap built once per render (was mediaLibrary.find = O(N)).
    let mediaItem = mediaMap.get(clip.mediaId);
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

    if (clip.isAdjustmentLayer || clip.mediaId?.startsWith('adj_') || mediaItem.type === 'adjustment') {
      applyAdjustmentLayerPass(ctx, clip, W, H);
      anyClipDrawn = true;
      return true;
    }

    let aOpacity: number;
    let aScale: number;
    let aX: number;
    let aY: number;
    let aRot: number;

    // PERF: Cached hasAnimOrExpr — Object.keys() on every clip every frame allocates a new
    // Array each call. Use a module-level Map keyed by clipId, cleared when tracks changes.
    if (tracks !== _animCacheTracksRef) {
      _clipHasAnimCache.clear();
      _animCacheTracksRef = tracks;
    }
    let hasAnimOrExpr = _clipHasAnimCache.get(clip.id);
    if (hasAnimOrExpr === undefined) {
      hasAnimOrExpr = !!(clip.animations && Object.keys(clip.animations).length > 0) ||
                      !!(clip.expressions && Object.keys(clip.expressions).length > 0);
      _clipHasAnimCache.set(clip.id, hasAnimOrExpr);
    }

    if (hasAnimOrExpr) {
      aOpacity = getAnimatedValue(clip.opacity, currentTime, clip.startTime, clip.animations?.['opacity'], clip.expressions?.['opacity']);
      aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale'], clip.expressions?.['transform.scale']);
      aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x'], clip.expressions?.['transform.x']);
      aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y'], clip.expressions?.['transform.y']);
      aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation'], clip.expressions?.['transform.rotation']);
    } else {
      aOpacity = clip.opacity ?? 1;
      aScale = clip.transform.scale ?? 100;
      aX = clip.transform.x ?? 0;
      aY = clip.transform.y ?? 0;
      aRot = clip.transform.rotation ?? 0;
    }

    // localTime = time elapsed since clip start, used by text animations and FX timing below.
    const localTime = currentTime - clip.startTime;

    // ── Motion Tracking Trajectory Offset ──────────────────────────────────
    if (clip.motionAttachment?.trackId) {
      for (const tTrack of tracks) {
        for (const parentClip of tTrack.clips || []) {
          const motionTrack = parentClip.motionTracks?.find((mt) => mt.id === clip.motionAttachment!.trackId);
          if (motionTrack) {
            const localMediaTime = currentTime - parentClip.startTime;
            const pos = getInterpolatedMotionPosition(motionTrack.keyframes, localMediaTime);
            if (pos) {
              if (clip.motionAttachment.applyPosition) {
                // Convert percentage position (0-100%) to canvas pixel offset relative to center
                const targetPixelX = (pos.position.x / 100) * W - W / 2;
                const targetPixelY = (pos.position.y / 100) * H - H / 2;
                aX += targetPixelX;
                aY += targetPixelY;
              }
              if (clip.motionAttachment.applyScale && pos.scale !== undefined) {
                aScale *= (pos.scale / 100);
              }
              if (clip.motionAttachment.applyRotation && pos.rotation !== undefined) {
                aRot += pos.rotation;
              }
            }
            break;
          }
        }
      }
    }

    // ── Per-Aspect-Ratio Custom Framing Overrides ────────────────────────
    // PERF: read from the snapshot captured at frame start (was 3 store
    // reads per clip per frame).
    const perRatioFramingState = storeState.perRatioFraming;
    const perRatioFramingEnabled = storeState.perRatioFramingEnabled;
    const currentAspectRatio = storeState.aspectRatio;

    if (perRatioFramingEnabled && perRatioFramingState[currentAspectRatio]?.[clip.id]) {
      const customFraming = perRatioFramingState[currentAspectRatio][clip.id];
      if (customFraming.x !== undefined) aX += customFraming.x;
      if (customFraming.y !== undefined) aY += customFraming.y;
      if (customFraming.scale !== undefined) aScale *= (customFraming.scale / 100);

      // Auto-Reframe Integration
      if ((customFraming as any).autoReframeTrackId) {
        const arTrackId = (customFraming as any).autoReframeTrackId;
        const mt = clip.motionTracks?.find((t: any) => t.id === arTrackId);
        if (mt) {
          const localMediaTime = currentTime - clip.startTime;
          const pos = getInterpolatedMotionPosition(mt.keyframes, localMediaTime);
          if (pos) {
            // Invert the tracking position to KEEP the subject centered
            const targetPixelX = (pos.position.x / 100) * W - W / 2;
            const targetPixelY = (pos.position.y / 100) * H - H / 2;
            aX -= targetPixelX; // INVERTED for pan compensation
            aY -= targetPixelY; 
          }
        }
      }
    }

    const aCropTop = hasAnimOrExpr ? getAnimatedValue(clip.crop?.top || 0, currentTime, clip.startTime, clip.animations?.['crop.top'], clip.expressions?.['crop.top']) : (clip.crop?.top || 0);
    const aCropBot = hasAnimOrExpr ? getAnimatedValue(clip.crop?.bottom || 0, currentTime, clip.startTime, clip.animations?.['crop.bottom'], clip.expressions?.['crop.bottom']) : (clip.crop?.bottom || 0);
    const aCropLeft = hasAnimOrExpr ? getAnimatedValue(clip.crop?.left || 0, currentTime, clip.startTime, clip.animations?.['crop.left'], clip.expressions?.['crop.left']) : (clip.crop?.left || 0);
    const aCropRight = hasAnimOrExpr ? getAnimatedValue(clip.crop?.right || 0, currentTime, clip.startTime, clip.animations?.['crop.right'], clip.expressions?.['crop.right']) : (clip.crop?.right || 0);

    const aRotX = hasAnimOrExpr ? getAnimatedValue(clip.transform.rotationX ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationX'], clip.expressions?.['transform.rotationX']) : (clip.transform.rotationX ?? 0);
    const aRotY = hasAnimOrExpr ? getAnimatedValue(clip.transform.rotationY ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationY'], clip.expressions?.['transform.rotationY']) : (clip.transform.rotationY ?? 0);

    const hasPerspectiveWarp = !!(clip.transform.perspectivePin || Math.abs(aRotX) > 0.01 || Math.abs(aRotY) > 0.01);
    const inheritedBlendIntensity =
      clip.transform.blendMode && clip.transform.blendMode !== 'source-over'
        ? clip.transform.blendIntensity ?? 100
        : (clip as any).__parentTransform?.blendIntensity ?? clip.transform.blendIntensity ?? 100;
    const aBlendIntensity = hasAnimOrExpr ? Math.max(0, Math.min(100, getAnimatedValue(inheritedBlendIntensity, currentTime, clip.startTime, clip.animations?.['transform.blendIntensity'], clip.expressions?.['transform.blendIntensity']))) : Math.max(0, Math.min(100, inheritedBlendIntensity));
    // A PiP child inherits the container's opacity and blend mode, so fading or
    // blending the sentence affects the whole group. The child's own values still
    // compose on top (multiplied for opacity; the child wins for blend mode when
    // it sets one explicitly).
    const parentForBlend = (clip as any).__parentTransform;
    const parentOpacityRaw = (clip as any).__parentOpacity;
    const parentOpacity =
      parentForBlend && typeof parentOpacityRaw === 'number' ? parentOpacityRaw : 1;
    const ownBlend = clip.transform.blendMode;
    const blendMode =
      ownBlend && ownBlend !== 'source-over'
        ? ownBlend
        : parentForBlend?.blendMode || 'source-over';
    const totalAlpha = aOpacity * opacityMultiplier * parentOpacity;

    // ── Blend compositing ────────────────────────────────────────────────────
    // Planned by the shared helper in blendCompositor.ts. The old code emulated
    // partial blend intensity by drawing the clip TWICE (once source-over, once
    // with the blend mode). That double-composites: the blended pass sees a
    // backdrop that already contains the normal pass, so `multiply`/`darken`
    // darken twice and `difference`/`color-burn` band and invert — the reported
    // "glitch". With an alpha matte (AI background removal) the two passes also
    // accumulate along the cutout edge, producing a bright halo.
    //
    // Now: full strength uses ONE native blended draw; partial strength renders
    // the clip into a scratch layer that is mixed over the backdrop exactly once.
    const blendPlan = resolveBlendPlan(blendMode, aBlendIntensity, totalAlpha);

    // Partial blend needs a genuine three-way mix:
    //     final = (1 - mix)·over(B, C) + mix·blend(B, C)
    // where B is the ORIGINAL backdrop and C the clip. We therefore need both
    // results, but the clip is rasterised only ONCE:
    //   L = transparent layer holding the clip's pixels
    //   S = snapshot of the backdrop B, with L blended into it  -> blend(B, C)
    //   target: draw L source-over -> over(B, C), then draw S source-over at mix.
    // Drawing the blended layer straight over the normal result (the obvious
    // shortcut) would blend against an already-composited backdrop and reproduce
    // the very double-composite artefact this replaces.
    let blendLayer: HTMLCanvasElement | null = null;
    let blendBackdrop: HTMLCanvasElement | null = null;
    let targetCtxForBlend: CanvasRenderingContext2D | null = null;
    if (blendPlan.kind === 'lerp') {
      blendLayer = getOrCreateCanvas(
        offscreenCanvasPool.current,
        '__blend_layer',
        composite.width,
        composite.height
      );
      blendBackdrop = getOrCreateCanvas(
        offscreenCanvasPool.current,
        '__blend_backdrop',
        composite.width,
        composite.height
      );
      const blendCtx = blendLayer.getContext('2d');
      const backdropCtx = blendBackdrop.getContext('2d');
      if (blendCtx && backdropCtx && ctx.canvas) {
        // Snapshot the backdrop BEFORE this clip is drawn.
        backdropCtx.setTransform(1, 0, 0, 1, 0, 0);
        backdropCtx.globalCompositeOperation = 'copy';
        backdropCtx.drawImage(ctx.canvas, 0, 0);
        backdropCtx.globalCompositeOperation = 'source-over';

        blendCtx.setTransform(1, 0, 0, 1, 0, 0);
        blendCtx.clearRect(0, 0, blendLayer.width, blendLayer.height);
        // Mirror the world transform currently applied to the real context.
        blendCtx.scale(canvas_scale, canvas_scale);
        blendCtx.translate(totalX, totalY);
        blendCtx.scale(viewport.zoom, viewport.zoom);
        blendCtx.translate(offsetX, offsetY);
        targetCtxForBlend = blendCtx;
      } else {
        blendLayer = null;
        blendBackdrop = null;
      }
    }

    // Redirect every draw in this function to the scratch layer when we're doing a
    // partial blend. `ctx` is a local binding, so this is transparent to the code
    // below and guarantees the clip is rasterised exactly once either way.
    const outerCtx = ctx;
    if (targetCtxForBlend) ctx = targetCtxForBlend;

    ctx.save();
    ctx.globalAlpha = targetCtxForBlend ? 1 : blendPlan.alpha;
    ctx.globalCompositeOperation = targetCtxForBlend ? 'source-over' : blendPlan.mode;

    if (clip.vectorMask?.enabled) {
      applyVectorMaskToContext(ctx, clip.vectorMask, W, H);
    }

    const cx = W / 2;
    const cy = H / 2;

    let corners: LocalCornerPoints | null = null;
    if (hasPerspectiveWarp) {
      if (clip.transform.perspectivePin) {
        const pc = clip.transform.perspectiveCorners || { x0: 0, y0: 0, x1: 854, y1: 0, x2: 854, y2: 480, x3: 0, y3: 480 };
        
        let trackedCorners = null;
        const trackingData = clip.transform.perspectiveTrackingData;
        if (trackingData && trackingData.length > 0) {
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
            x0: getAnimatedValue(pc.x0, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x0'], clip.expressions?.['transform.perspectiveCorners.x0']),
            y0: getAnimatedValue(pc.y0, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y0'], clip.expressions?.['transform.perspectiveCorners.y0']),
            x1: getAnimatedValue(pc.x1, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x1'], clip.expressions?.['transform.perspectiveCorners.x1']),
            y1: getAnimatedValue(pc.y1, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y1'], clip.expressions?.['transform.perspectiveCorners.y1']),
            x2: getAnimatedValue(pc.x2, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x2'], clip.expressions?.['transform.perspectiveCorners.x2']),
            y2: getAnimatedValue(pc.y2, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y2'], clip.expressions?.['transform.perspectiveCorners.y2']),
            x3: getAnimatedValue(pc.x3, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x3'], clip.expressions?.['transform.perspectiveCorners.x3']),
            y3: getAnimatedValue(pc.y3, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y3'], clip.expressions?.['transform.perspectiveCorners.y3']),
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
        // Text media has no intrinsic width/height, so falling back to 854x480
        // projected a full-frame quad and the 3D rotate looked wrong (the glyphs
        // were warped as if they filled the canvas). Measure the text box instead,
        // mirroring previewMath.getClipDimensions.
        const isTextClip =
          mediaItem.type === 'text' || !!clip.textSettings || clip.mediaId === 'text-placeholder';

        let vw: number;
        let vh: number;
        let fitScale: number;

        if (isTextClip) {
          const tsm = clip.textSettings;
          const fontSizeM = Number(tsm?.fontSize) || 48;
          const linesM = String(tsm?.text ?? '').split('\n');
          const longestM = linesM.reduce((m: number, l: string) => Math.max(m, l.length), 0);
          vw = Math.max(80, longestM * fontSizeM * 0.6 + 40);
          vh = linesM.length * (fontSizeM * 1.35) + 20;
          // Text is drawn at its natural size (no fit-to-frame downscale).
          fitScale = 1;
        } else {
          vw = mediaItem.width || 854;
          vh = mediaItem.height || 480;
          fitScale = Math.min(W / vw, H / vh);
        }

        corners = getProjectedCorners(
          vw, vh,
          (aScale / 100) * fitScale,
          aRotX, aRotY, aRot,
          aX, aY,
          cx, cy
        );
      }
    }

    let fxFlipH = false;
    let fxFlipV = false;
    let fxFlashBrightness = 0;
    let fxActionScaleMultiplier = 1;
    let fxShakeX = 0;
    let fxShakeY = 0;

    if (clip.fxSettings) {
      const fxType = clip.fxSettings.type;
      const fxRelTime = Math.max(0, currentTime - clip.startTime);

      if (fxType === 'rhythmic_mirror') {
        const interval = clip.fxSettings.flipInterval || 0.5;
        const cycleIdx = Math.floor(fxRelTime / interval);
        const axis = clip.fxSettings.flipAxis || 'horizontal';

        if (axis === 'horizontal') {
          fxFlipH = (cycleIdx % 2 === 1);
        } else if (axis === 'vertical') {
          fxFlipV = (cycleIdx % 2 === 1);
        } else if (axis === 'alternate') {
          fxFlipH = (cycleIdx % 2 === 1);
          fxFlipV = (Math.floor(cycleIdx / 2) % 2 === 1);
        }

        // Impact Flash on the first 0.06s frame of each mirror flip cycle
        if (clip.fxSettings.impactFlash !== false) {
          const timeInCycle = fxRelTime - (cycleIdx * interval);
          if (timeInCycle < 0.06) {
            fxFlashBrightness = (1 - (timeInCycle / 0.06)) * 40; // +40% exposure burst
          }
        }
      } else if (fxType === 'action_zoom_pulse') {
        const speed = clip.fxSettings.pulseSpeed || 2; // Hz
        const depth = (clip.fxSettings.pulseDepth || 20) / 100;
        const wave = Math.max(0, Math.sin(fxRelTime * Math.PI * 2 * speed));
        fxActionScaleMultiplier = 1 + (wave * depth);
      } else if (fxType === 'action_strobe') {
        const speed = clip.fxSettings.strobeSpeed || 8; // Hz
        const wave = Math.sin(fxRelTime * Math.PI * 2 * speed);
        if (wave > 0.4) {
          fxFlashBrightness = 60; // bright strobe burst
        }
      } else if (fxType === 'action_shake') {
        const intensity = (clip.fxSettings.intensity || 50) / 100;
        const seed = Math.sin(fxRelTime * 12.9898) * 43758.5453;
        const pseudoRand = seed - Math.floor(seed);
        fxShakeX = (Math.sin(fxRelTime * 45) * 12 + (pseudoRand - 0.5) * 10) * intensity;
        fxShakeY = (Math.cos(fxRelTime * 55) * 12 + (pseudoRand - 0.5) * 10) * intensity;
      }
    }

    // ── Parent (PiP container) transform ─────────────────────────────────────
    //
    // The renderer previously drew PiP children with ONLY their own transform, so
    // the container's transform had to be BAKED into each child's stored position
    // by the kinetic reflow. That works for translate and scale but CANNOT express
    // rotation: rotating the sentence turned the selection box but left the words
    // flat and, because the reflow re-laid them out at the same time, bunched them
    // together.
    //
    // Applying the parent transform here makes the PiP a proper group: children
    // inherit position, scale AND rotation, and the reflow no longer has to bake
    // anything (see editorStore.syncKineticSentence).
    const parentT = (clip as any).__parentTransform;
    if (parentT) {
      const pid = (clip as any).__parentId;
      const pStart = (clip as any).__parentStartTime ?? 0;
      const pAnims = (clip as any).__parentAnimations;
      const pX = getAnimatedValue(parentT.x ?? 0, currentTime, pStart, pAnims?.['transform.x']);
      const pY = getAnimatedValue(parentT.y ?? 0, currentTime, pStart, pAnims?.['transform.y']);
      const pScale = getAnimatedValue(parentT.scale ?? 100, currentTime, pStart, pAnims?.['transform.scale']);
      const pRot = getAnimatedValue(parentT.rotation ?? 0, currentTime, pStart, pAnims?.['transform.rotation']);

      // Group crop, applied BEFORE the transform so the crop rectangle stays
      // axis-aligned to the frame — the same way crop behaves on a normal clip.
      // (Clipping after the rotate would spin the crop window with the text.)
      // The sentence is trimmed as one rectangle rather than each word being
      // cropped in isolation, which is what makes it useful for framing a
      // stylised thumbnail.
      const pCrop = (clip as any).__parentCrop;
      if (pCrop) {
        const cl = getAnimatedValue(pCrop.left ?? 0, currentTime, pStart, pAnims?.['crop.left']) / 100;
        const cr = getAnimatedValue(pCrop.right ?? 0, currentTime, pStart, pAnims?.['crop.right']) / 100;
        const ct2 = getAnimatedValue(pCrop.top ?? 0, currentTime, pStart, pAnims?.['crop.top']) / 100;
        const cb = getAnimatedValue(pCrop.bottom ?? 0, currentTime, pStart, pAnims?.['crop.bottom']) / 100;
        if (cl > 0 || cr > 0 || ct2 > 0 || cb > 0) {
          // Guard against a fully-collapsed rect, which would hide the group.
          const l = Math.min(cl, 0.98);
          const r = Math.min(cr, 0.98 - l);
          const t2 = Math.min(ct2, 0.98);
          const b = Math.min(cb, 0.98 - t2);
          ctx.beginPath();
          ctx.rect(l * W, t2 * H, Math.max(1, W * (1 - l - r)), Math.max(1, H * (1 - t2 - b)));
          ctx.clip();
        }
      }

      // Rotate/scale about the frame centre so the group pivots as a whole rather
      // than each word spinning about its own origin.
      ctx.translate(cx + pX, cy + pY);
      ctx.rotate((pRot * Math.PI) / 180);
      const ps = (pScale || 100) / 100;
      if (ps !== 1) ctx.scale(ps, ps);
      if (parentT.flipH) ctx.scale(-1, 1);
      if (parentT.flipV) ctx.scale(1, -1);

      // ── Simulated 3D rotation (rotationX / rotationY) ──────────────────────
      //
      // A uniform squash (scale by cos) makes the group narrow correctly but looks
      // flat: every word shrinks by the same amount, so there is no sense of one
      // edge being nearer the viewer.
      //
      // Because PiP children are drawn INDIVIDUALLY, we can do better than a
      // single affine squash without needing a projected quad: rotate each child's
      // offset around the group's axis in 3D, then divide by its depth. Words that
      // swing toward the camera land further out and are drawn larger; words that
      // swing away converge toward the vanishing point and shrink. That is real
      // one-point perspective — the group visibly turns in space, yet every child
      // still shares one coordinate system so the sentence never pulls apart.
      //
      // Implemented as a translate+scale per child (not ctx.transform) so the
      // glyphs stay axis-aligned and crisp; skewing text this small reads as
      // blur rather than depth.
      const pRotX = getAnimatedValue(parentT.rotationX ?? 0, currentTime, pStart, pAnims?.['transform.rotationX']);
      const pRotY = getAnimatedValue(parentT.rotationY ?? 0, currentTime, pStart, pAnims?.['transform.rotationY']);

      if (Math.abs(pRotX) > 0.01 || Math.abs(pRotY) > 0.01) {
        const rx = (pRotX * Math.PI) / 180;
        const ry = (pRotY * Math.PI) / 180;

        // The child's own offset within the group, in group-local units.
        const ox = clip.transform?.x ?? 0;
        const oy = clip.transform?.y ?? 0;

        // Rotate that offset in 3D. z starts at 0 (all children coplanar).
        // +z is AWAY from the camera. A positive rotationY must swing the RIGHT
        // edge away (matching how the 2D preview and the video branch behave), so
        // a positive x maps to a positive z.
        const x1 = ox * Math.cos(ry);
        const z1 = ox * Math.sin(ry);
        const y2 = oy * Math.cos(rx) - z1 * Math.sin(rx);
        const z2 = oy * Math.sin(rx) + z1 * Math.cos(rx);

        // Perspective divide. FOCAL is the virtual camera distance: larger is a
        // longer lens (subtler depth), smaller is wider (more dramatic). 900 units
        // against an 854-wide frame is roughly a normal lens.
        const FOCAL = 900;
        const denom = FOCAL + z2;
        // Clamp so a child rotated behind the camera cannot invert or blow up.
        const persp = FOCAL / Math.max(FOCAL * 0.25, denom);

        // Move the child from its flat offset to its projected position, then
        // scale it by the same factor so nearer words are genuinely larger.
        ctx.translate(x1 * persp - ox, y2 * persp - oy);
        ctx.scale(persp, persp);

        // Fade edges that have rotated far from the viewer. Subtle — it reads as
        // depth shading, not as the text disappearing.
        const depthFade = 1 - Math.min(0.45, Math.max(0, z2 / (FOCAL * 1.6)));
        ctx.globalAlpha = ctx.globalAlpha * depthFade;
      }

      ctx.translate(-cx, -cy);

      if (pid) {
        const pFraming = storeState.perRatioFramingEnabled
          ? storeState.perRatioFraming?.[storeState.aspectRatio]?.[pid]
          : undefined;
        if (pFraming) {
          ctx.translate(pFraming.x ?? 0, pFraming.y ?? 0);
          if (pFraming.scale !== undefined) {
            const fs = pFraming.scale / 100;
            ctx.translate(cx, cy);
            ctx.scale(fs, fs);
            ctx.translate(-cx, -cy);
          }
        }
      }
    }

    if (!hasPerspectiveWarp) {
      let tx = cx + fxShakeX;
      let ty = cy + fxShakeY;
      if (extraTransform?.translateX !== undefined) tx += extraTransform.translateX;
      if (extraTransform?.translateY !== undefined) ty += extraTransform.translateY;

      ctx.translate(tx, ty);
      ctx.translate(aX, aY);

      let finalScale = (aScale / 100) * fxActionScaleMultiplier;
      if (extraTransform?.scale !== undefined) {
        finalScale *= extraTransform.scale;
      }
      const isFlippedH = (clip.transform?.flipH ? 1 : 0) ^ (fxFlipH ? 1 : 0);
      const isFlippedV = (clip.transform?.flipV ? 1 : 0) ^ (fxFlipV ? 1 : 0);
      const scaleX = finalScale * (isFlippedH ? -1 : 1);
      const scaleY = finalScale * (isFlippedV ? -1 : 1);
      ctx.scale(scaleX, scaleY);
      ctx.rotate((aRot * Math.PI) / 180);
    }

    const filters = {
      temperature: getAnimatedValue(clip.colorFilters?.temperature ?? 0, currentTime, clip.startTime, clip.animations?.['color.temperature'], clip.expressions?.['color.temperature']),
      tint: getAnimatedValue(clip.colorFilters?.tint ?? 0, currentTime, clip.startTime, clip.animations?.['color.tint'], clip.expressions?.['color.tint']),
      exposure: getAnimatedValue(clip.colorFilters?.exposure ?? 0, currentTime, clip.startTime, clip.animations?.['color.exposure'], clip.expressions?.['color.exposure']) + fxFlashBrightness,
      contrast: getAnimatedValue(clip.colorFilters?.contrast ?? 100, currentTime, clip.startTime, clip.animations?.['color.contrast'], clip.expressions?.['color.contrast']),
      saturation: getAnimatedValue(clip.colorFilters?.saturation ?? 100, currentTime, clip.startTime, clip.animations?.['color.saturation'], clip.expressions?.['color.saturation']),
      blur: getAnimatedValue(clip.colorFilters?.blur ?? 0, currentTime, clip.startTime, clip.animations?.['color.blur'], clip.expressions?.['color.blur']),
      fadedFilm: getAnimatedValue(clip.colorFilters?.fadedFilm ?? 0, currentTime, clip.startTime, clip.animations?.['color.fadedFilm'], clip.expressions?.['color.fadedFilm']),
      vignette: getAnimatedValue(clip.colorFilters?.vignette ?? 0, currentTime, clip.startTime, clip.animations?.['color.vignette'], clip.expressions?.['color.vignette']),
      shadows: clip.colorFilters?.shadows,
      midtones: clip.colorFilters?.midtones,
      highlights: clip.colorFilters?.highlights,
    };

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

    filters.exposure = Number.isFinite(filters.exposure) ? filters.exposure : 0;
    filters.contrast = Number.isFinite(filters.contrast) ? filters.contrast : 100;
    filters.saturation = Number.isFinite(filters.saturation) ? filters.saturation : 100;
    filters.blur = Number.isFinite(filters.blur) ? filters.blur : 0;
    filters.temperature = Number.isFinite(filters.temperature) ? filters.temperature : 0;
    filters.tint = Number.isFinite(filters.tint) ? filters.tint : 0;
    
    const { exposure, contrast, saturation, blur } = filters;

    let dw = W;
    let dh = H;
    let dx = -W / 2;
    let dy = -H / 2;
    let hasRealMedia = false;

    if (mediaItem.type === 'video' || mediaItem.type === 'image') {
      let vw = 1920;
      let vh = 1080;
      let videoEl: HTMLVideoElement | null = null;
      let imageEl: HTMLImageElement | null = null;

      if (mediaItem.type === 'video') {
        videoEl = videoElements.get(clip.id) || null;
        if (videoEl && videoEl.readyState >= 1 && videoEl.videoWidth > 0) {
          vw = videoEl.videoWidth;
          vh = videoEl.videoHeight;
          hasRealMedia = true;
        }
      } else {
        imageEl = getCachedImage(mediaItem.id, mediaItem.url as string, renderDeps.requestRedraw);
        if (imageEl && imageEl.naturalWidth > 0) {
          vw = imageEl.naturalWidth;
          vh = imageEl.naturalHeight;
          hasRealMedia = true;
        }
      }

      // For video clips, we draw directly from the video element to the canvas.
      // This is fast and hardware accelerated in modern browsers.
      // We removed the ImageBitmap frame caching to save RAM and decoder overload.

      const scaleToFit = Math.min(W / vw, H / vh);
      dw = vw * scaleToFit;
      dh = vh * scaleToFit;
      dx = -dw / 2;
      dy = -dh / 2;

      if (hasRealMedia) {
        anyClipDrawn = true;
        let sourceElement: CanvasImageSource = (mediaItem.type === 'video' ? videoEl : imageEl)!;

        const clipW = dw * (1 - cLeft - cRight);
        const clipH = dh * (1 - cTop - cBot);

        if (clipW > 0 && clipH > 0) {
          const hasCrop = cLeft > 0 || cRight > 0 || cTop > 0 || cBot > 0;
          const hasCssFilters = exposure !== 0 || contrast !== 100 || saturation !== 100 || blur > 0;
          const hasAiBg = !!clip.aiBackground?.enabled;
          const hasChroma = !skipExpensiveFX && !!clip.chromaKey?.enabled;
          const hasLuma = !skipExpensiveFX && !!clip.lumaKey?.enabled;
          const hasObjRemoval = !skipExpensiveFX && !!clip.objectRemoval?.enabled;
          const hasColorWheels = !skipExpensiveFX && !!(filters.shadows || filters.midtones || filters.highlights);
          const curvesData = clip.colorFilters?.curves;
          const hasCurves = !skipExpensiveFX && !!curvesData && (isCurveOn(curvesData.rgb) || isCurveOn(curvesData.r) || isCurveOn(curvesData.g) || isCurveOn(curvesData.b) || isCurveOn(curvesData.luma));
          const hasOverlays = !skipExpensiveFX && (filters.temperature !== 0 || filters.tint !== 0 || filters.fadedFilm !== 0 || filters.vignette !== 0);
          const lutData = mediaMap.get(clip.lut?.mediaId || clip.lutFilter?.mediaId)?.lutData;
          const hasLut = !skipExpensiveFX && !!lutData;
          const hasFx = !skipExpensiveFX && !!clip.fxSettings;
          const hasMask = !!clip.mask?.enabled;

          const needsOffscreen = hasCrop || hasCssFilters || hasAiBg || hasChroma || hasLuma || hasObjRemoval || hasColorWheels || hasCurves || hasOverlays || hasLut || hasFx || hasMask;

          if (!needsOffscreen) {
            // FAST PATH: Zero-copy GPU direct render directly to target canvas!
            if (corners) {
              drawPerspectiveTexture(ctx, sourceElement, corners);
            } else {
              ctx.drawImage(sourceElement, dx, dy, dw, dh);
            }
          } else {
            const offCanvasKey = `clip_${clip.id}_${Math.round(dw)}x${Math.round(dh)}`;
            const prefix = `clip_${clip.id}_`;
            for (const k of offscreenCanvasPool.current.keys()) {
              if (k.startsWith(prefix) && k !== offCanvasKey) {
                offscreenCanvasPool.current.delete(k);
              }
            }
            const offCanvas = getOrCreateCanvas(offscreenCanvasPool.current, offCanvasKey, Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh)));
            const oCtx = offCanvas.getContext('2d')!;
            oCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

            const cssFilters: string[] = [];
            if (exposure !== 0) {
              const brightnessVal = 100 + (exposure * 0.7);
              cssFilters.push(`brightness(${Math.max(0, brightnessVal)}%)`);
            }
            if (contrast !== 100) cssFilters.push(`contrast(${Math.max(0, contrast)}%)`);
            if (saturation !== 100) cssFilters.push(`saturate(${Math.max(0, saturation)}%)`);
            if (blur > 0) cssFilters.push(`blur(${blur}px)`);

            const hasFilters = cssFilters.length > 0;
            if (hasFilters) {
              oCtx.filter = cssFilters.join(' ');
            }

            const sx = cLeft * vw;
            const sy = cTop * vh;
            const sw = vw * (1 - cLeft - cRight);
            const sh = vh * (1 - cTop - cBot);
            const odx = cLeft * offCanvas.width;
            const ody = cTop * offCanvas.height;
            const odw = offCanvas.width * (1 - cLeft - cRight);
            const odh = offCanvas.height * (1 - cTop - cBot);

            oCtx.drawImage(sourceElement, sx, sy, sw, sh, odx, ody, odw, odh);
            if (hasFilters) {
              oCtx.filter = 'none';
            }

            // AI Background Removal — always non-blocking during interactive preview.
            // Only awaits during export to guarantee frame-accurate masks.
            if (clip.aiBackground?.enabled && (isExporting || previewMode !== 'fast')) {
              const animEdgeBlur = getAnimatedValue(clip.aiBackground.edgeBlur ?? 0, currentTime, clip.startTime, clip.animations?.['aiBackground.edgeBlur'], clip.expressions?.['aiBackground.edgeBlur']);
              const smartOpts = {
                playbackQuality: clip.aiBackground.playbackQuality ?? 'balanced',
                isPlaying: !isExporting,
                edgeBlur: animEdgeBlur,
                modelSelection: (clip.aiBackground.modelSelection ?? 1) as 0 | 1 | 2 | 3,
                useROI: true,        // Enable smart ROI cropping for high effective resolution
                skinThreshold: 0.008, // 0.8% skin pixels triggers human detection early-exit
                choke: clip.aiBackground.choke ?? 0,
                feather: clip.aiBackground.feather ?? 0,
                spillSuppression: clip.aiBackground.spillSuppression ?? 0,
                spillColor: clip.aiBackground.spillColor,
              };
              if (isExporting) {
                // Export: block until we have an exact synchronous mask for this frame
                await applyAiBackgroundSmart(oCtx, offCanvas.width, offCanvas.height, sourceElement, clip.id, smartOpts);
              } else {
                // Interactive: we must NOT fire-and-forget onto `oCtx`.
                //
                // applyAiBackgroundSmart composites the matte with
                // globalCompositeOperation='destination-in'. When left un-awaited it
                // resolves on a later microtask/frame — by which point this clip has
                // already been blitted and `oCtx` may have been recycled by the LRU
                // canvas pool for a DIFFERENT clip. The late write then punches a
                // hole in whatever now owns the buffer. That is the flicker seen when
                // background removal and blending are used together (a partial blend
                // adds another buffer, widening the race window).
                //
                // The mask pipeline is already async-cached internally: this call
                // applies the newest cached matte synchronously and schedules
                // re-segmentation in the background, notifying us via the
                // mask-ready callback which flags the next repaint. So awaiting here
                // costs a cache lookup, not an inference, and keeps every write to
                // `oCtx` inside this clip's own draw pass.
                await applyAiBackgroundSmart(oCtx, offCanvas.width, offCanvas.height, sourceElement, clip.id, smartOpts);
              }
            }

            if (!skipExpensiveFX) {
              if (clip.chromaKey?.enabled) {
                const animThresh = getAnimatedValue(clip.chromaKey.threshold, currentTime, clip.startTime, clip.animations?.['chromaKey.threshold'], clip.expressions?.['chromaKey.threshold']);
                const animSoft = getAnimatedValue(clip.chromaKey.softness, currentTime, clip.startTime, clip.animations?.['chromaKey.softness'], clip.expressions?.['chromaKey.softness']);
                const animSpill = getAnimatedValue(clip.chromaKey.spillSuppression ?? 0, currentTime, clip.startTime, clip.animations?.['chromaKey.spillSuppression'], clip.expressions?.['chromaKey.spillSuppression']);
                const animFeather = getAnimatedValue(clip.chromaKey.edgeFeather ?? 0, currentTime, clip.startTime, clip.animations?.['chromaKey.edgeFeather'], clip.expressions?.['chromaKey.edgeFeather']);
                applyChromaKeyOnData(
                  oCtx,
                  offCanvas.width,
                  offCanvas.height,
                  clip.chromaKey.color,
                  animThresh,
                  animSoft,
                  animSpill,
                  animFeather
                );
              }
              if (clip.lumaKey?.enabled) {
                const animThresh = getAnimatedValue(clip.lumaKey.threshold, currentTime, clip.startTime, clip.animations?.['lumaKey.threshold'], clip.expressions?.['lumaKey.threshold']);
                const animSoft = getAnimatedValue(clip.lumaKey.softness, currentTime, clip.startTime, clip.animations?.['lumaKey.softness'], clip.expressions?.['lumaKey.softness']);
                applyLumaKeyOnData(
                  oCtx,
                  offCanvas.width,
                  offCanvas.height,
                  clip.lumaKey.type,
                  animThresh,
                  animSoft
                );
              }
              // Object Removal
              if (clip.objectRemoval?.enabled) {
                applyObjectRemoval(
                  oCtx,
                  offCanvas.width,
                  offCanvas.height,
                  clip.objectRemoval,
                  currentTime,
                  clip.startTime,
                  offCanvas,
                  clip.animations,
                  isPlaying,
                  clip.id
                );
              }
              if (filters.shadows || filters.midtones || filters.highlights) {
                applyColorGradingWheelsOnData(
                  oCtx,
                  offCanvas.width,
                  offCanvas.height,
                  filters.shadows,
                  filters.midtones,
                  filters.highlights
                );
              }

              if (curvesData && (isCurveOn(curvesData.rgb) || isCurveOn(curvesData.r) || isCurveOn(curvesData.g) || isCurveOn(curvesData.b) || isCurveOn(curvesData.luma))) {
                // PERF: LUTs are a pure function of the curve definition, which only
                // changes when the user edits it. Rebuilding five 256-entry LUTs per
                // clip per frame was pure waste; they are now memoised on the curve
                // object's identity (Zustand hands out a new object on every edit,
                // so the cache invalidates itself).
                const rgbLut = isCurveOn(curvesData.rgb) ? getCachedCurveLUT(curvesData.rgb) : IDENTITY_LUT;
                const rLut = isCurveOn(curvesData.r) ? getCachedCurveLUT(curvesData.r) : null;
                const gLut = isCurveOn(curvesData.g) ? getCachedCurveLUT(curvesData.g) : null;
                const bLut = isCurveOn(curvesData.b) ? getCachedCurveLUT(curvesData.b) : null;
                const lumaLut = isCurveOn(curvesData.luma) ? getCachedCurveLUT(curvesData.luma) : null;
                try {
                  const imgData = oCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
                  applyCurves(imgData, rgbLut, rLut, gLut, bLut, lumaLut);
                  oCtx.putImageData(imgData, 0, 0);
                } catch (e) {
                  console.warn('Curves apply failed:', e);
                }
              }
              if (filters.temperature !== 0 || filters.tint !== 0 || filters.fadedFilm !== 0 || filters.vignette !== 0) {
                applyColorOverlays(oCtx, 0, 0, offCanvas.width, offCanvas.height, filters);
              }
              if (lutData) {
                const baseIntensity = clip.lut?.intensity ?? clip.lutFilter?.intensity ?? 100;
                const animIntensity = getAnimatedValue(
                  baseIntensity,
                  currentTime,
                  clip.startTime,
                  clip.animations?.['lut.intensity'] || clip.animations?.['lutFilter.intensity']
                );
                applyLutToCanvas(oCtx, offCanvas.width, offCanvas.height, lutData, animIntensity);
              }

              if (clip.fxSettings && !skipExpensiveFX) {
                const fxIntensity = clip.fxSettings.intensity ?? 100;
                const fxRelTime = Math.max(0, currentTime - clip.startTime);
                applyFxEffect(
                  oCtx,
                  offCanvas.width,
                  offCanvas.height,
                  clip.fxSettings.type,
                  fxIntensity,
                  fxRelTime,
                  isPlaying
                );
              }
            }

            if (clip.mask?.enabled) {
              await applyClipMaskOffscreen(oCtx, clip.mask, offCanvas.width, offCanvas.height, clip.id, clip.startTime, clip.animations, clip.expressions);
            } else {
              offscreenCanvasPool.current.delete('clip_mask_temp_' + clip.id);
            }

            if (corners) {
              drawPerspectiveTexture(ctx, offCanvas, corners);
            } else {
              ctx.drawImage(offCanvas, dx, dy, dw, dh);
            }
          }

          if (clip.fxSettings?.type === 'subject_outline_flash') {
            const sourceEl = videoEl || imageEl;
            if (sourceEl) {
              const neonOpts = {
                color: clip.fxSettings.outlineColor || '#00f0ff',
                strokeWidth: clip.fxSettings.outlineWidth || 3,
                glowBlur: clip.fxSettings.glowBlur || 14,
                flashSpeed: clip.fxSettings.strobeSpeed || 8,
                currentTime: currentTime,
                clipId: `neon_${clip.id}`,
                isPlaying: !isExporting,
              };
              if (isExporting) {
                await applySubjectNeonOutlineFlash(ctx, W, H, sourceEl, neonOpts);
              } else {
                void applySubjectNeonOutlineFlash(ctx, W, H, sourceEl, neonOpts);
              }
            }
          }
        }
      } else {
        drawMediaPlaceholder(ctx, dw, dh, mediaItem.name, mediaItem.type, '#fbbf24');
      }
    } else if (mediaItem.type === 'text' || clip.textSettings || clip.mediaId === 'text-placeholder') {
      anyClipDrawn = true;
      const ts = clip.textSettings || { text: 'Text', fontSize: 48, fontFamily: 'sans-serif', color: '#ffffff' };
      
      // Calculate animation progress (0.0 to 1.0)
      let animScaleX = 1;
      let animScaleY = 1;
      let animOpacity = 1;
      let animOffsetX = 0;
      let animOffsetY = 0;
      
      if (ts.animation) {
        const inDuration = ts.animation.inDuration || 0.1;
        const outDuration = ts.animation.outDuration || 0.1;
        
        const timeSinceStart = currentTime - clip.startTime;
        const timeUntilEnd = (clip.startTime + clip.duration) - currentTime;
        
        // Handle IN animation
        if (timeSinceStart < inDuration && timeSinceStart >= 0) {
          const progress = timeSinceStart / inDuration; // 0 to 1
          
          switch (ts.animation.in) {
            case 'fadeIn':
              animOpacity = progress;
              break;
            case 'zoom':
              animScaleX = progress;
              animScaleY = progress;
              animOpacity = progress;
              break;
            case 'bounce':
              animScaleX = animScaleY = 1 - Math.cos(progress * Math.PI * 2) * (1 - progress) * 0.5;
              break;
            case 'slideUp':
              animOffsetY = (1 - progress) * 100;
              animOpacity = progress;
              break;
            case 'slideDown':
              animOffsetY = -(1 - progress) * 100;
              animOpacity = progress;
              break;
            case 'slideLeft':
              animOffsetX = (1 - progress) * 100;
              animOpacity = progress;
              break;
            case 'slideRight':
              animOffsetX = -(1 - progress) * 100;
              animOpacity = progress;
              break;
            case 'elastic':
              const p = progress;
              animScaleX = animScaleY = Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
              break;
            case 'scaleFlip':
              animScaleY = progress;
              break;
            case 'zoomBlur':
              animScaleX = animScaleY = 1 + (1 - progress); 
              animOpacity = progress;
              break;
          }
        } 
        // Handle OUT animation
        else if (timeUntilEnd < outDuration && timeUntilEnd >= 0) {
          const progress = 1 - (timeUntilEnd / outDuration); // 0 to 1
          
          switch (ts.animation.out) {
            case 'fadeOut':
              animOpacity = 1 - progress;
              break;
            case 'zoom':
              animScaleX = 1 - progress;
              animScaleY = 1 - progress;
              animOpacity = 1 - progress;
              break;
            case 'slideUp':
              animOffsetY = -(progress * 100);
              animOpacity = 1 - progress;
              break;
            case 'slideDown':
              animOffsetY = progress * 100;
              animOpacity = 1 - progress;
              break;
            case 'slideLeft':
              animOffsetX = -(progress * 100);
              animOpacity = 1 - progress;
              break;
            case 'slideRight':
              animOffsetX = progress * 100;
              animOpacity = 1 - progress;
              break;
          }
        }
      }

      // ── Crop + perspective-warp support for TEXT ─────────────────────────
      //
      // The video/image branch renders into an offscreen canvas whenever crop,
      // perspective or pixel effects are needed. The text branch drew straight to
      // the target instead, so two Transform-tab controls silently did nothing on
      // text (and on PiP text): Crop, and Perspective Warp / 3D rotate.
      //
      // Perspective is the reason this cannot simply be a clip rect: when
      // `hasPerspectiveWarp` is set, the shared transform block above is SKIPPED
      // (the corner projection replaces it), so a text clip received no transform
      // at all and rendered unwarped at the origin.
      //
      // Render the glyphs into a buffer, then reuse exactly the same crop and
      // drawPerspectiveTexture paths the video branch uses.
      const textNeedsCrop = cLeft > 0 || cRight > 0 || cTop > 0 || cBot > 0;
      const textNeedsOffscreen = textNeedsCrop || !!corners;

      let textTargetCtx = ctx;
      let textBuffer: HTMLCanvasElement | null = null;

      // Buffer must match the quad that `corners` was projected from, otherwise
      // drawPerspectiveTexture stretches the glyphs. `corners` is built from the
      // measured text box (see the getProjectedCorners branch above), so measure
      // it the same way here. A little padding keeps descenders and strokes from
      // clipping at the edges.
      const tsMeasure = clip.textSettings;
      const measFont = Number(tsMeasure?.fontSize) || 48;
      const measLines = String(tsMeasure?.text ?? '').split('\n');
      const measLongest = measLines.reduce((m: number, l: string) => Math.max(m, l.length), 0);
      const textBufW = Math.max(1, Math.round(Math.max(80, measLongest * measFont * 0.6 + 40)));
      const textBufH = Math.max(1, Math.round(measLines.length * (measFont * 1.35) + 20));

      if (textNeedsOffscreen) {
        textBuffer = getOrCreateCanvas(
          offscreenCanvasPool.current,
          `text_${clip.id}_${textBufW}x${textBufH}`,
          textBufW,
          textBufH
        );
        const tCtx = textBuffer.getContext('2d');
        if (tCtx) {
          tCtx.setTransform(1, 0, 0, 1, 0, 0);
          tCtx.clearRect(0, 0, textBufW, textBufH);
          // Draw centred in the buffer; the buffer is then placed as a unit.
          tCtx.translate(textBufW / 2, textBufH / 2);
          textTargetCtx = tCtx;
        } else {
          textBuffer = null;
        }
      }

      // Swap the drawing target for the remainder of the text branch. `ctx` is a
      // local binding, so every fillText/strokeText below is redirected untouched.
      const textOuterCtx = ctx;
      ctx = textTargetCtx;

      ctx.save();
      // Opacity/blend are applied when the buffer is composited, not inside it.
      ctx.globalAlpha = textBuffer ? animOpacity : ctx.globalAlpha * animOpacity;
      ctx.translate(animOffsetX, animOffsetY);
      ctx.scale(animScaleX, animScaleY);

      const fontStyle = [];
      if (ts.italic) fontStyle.push('italic');
      if (ts.bold) fontStyle.push('bold');
      
      const fontWeightStyle = fontStyle.join(' ');
      ctx.font = `${fontWeightStyle ? fontWeightStyle + ' ' : ''}${ts.fontSize || 48}px ${ts.fontFamily || 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let textToRender = ts.text || 'Text';
      if (ts.animation && ts.animation.in === 'typewriter') {
         const inDuration = ts.animation.inDuration || 0.1;
         const timeSinceStart = currentTime - clip.startTime;
         if (timeSinceStart < inDuration && timeSinceStart >= 0) {
            const progress = timeSinceStart / inDuration;
            const charsToShow = Math.ceil(textToRender.length * progress);
            textToRender = textToRender.substring(0, charsToShow);
         }
      }

      const metrics = ctx.measureText(textToRender);
      const textWidth = metrics.width;
      const textHeight = ts.fontSize || 48;
      const paddingX = textHeight * 0.5;
      const paddingY = textHeight * 0.3;

      if (ts.backgroundColor && ts.backgroundColor !== 'transparent') {
        ctx.fillStyle = ts.backgroundColor;
        const bgX = -(textWidth / 2) - paddingX;
        const bgY = -(textHeight / 2) - paddingY;
        const bgW = textWidth + paddingX * 2;
        const bgH = textHeight + paddingY * 2;
        const radius = Math.min(8, bgH / 4);
        
        ctx.beginPath();
        ctx.moveTo(bgX + radius, bgY);
        ctx.lineTo(bgX + bgW - radius, bgY);
        ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + radius);
        ctx.lineTo(bgX + bgW, bgY + bgH - radius);
        ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - radius, bgY + bgH);
        ctx.lineTo(bgX + radius, bgY + bgH);
        ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - radius);
        ctx.lineTo(bgX, bgY + radius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
        ctx.closePath();
        ctx.fill();
      }

      if (ts.shadow) {
        ctx.shadowColor = ts.shadowColor || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = ts.shadowBlur !== undefined ? ts.shadowBlur : 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'transparent';
      }

      if (ts.strokeColor && ts.strokeWidth) {
        ctx.strokeStyle = ts.strokeColor;
        ctx.lineWidth = ts.strokeWidth;
        ctx.strokeText(textToRender, 0, 0);
      }

      ctx.fillStyle = ts.color || '#ffffff';
      ctx.fillText(textToRender, 0, 0);

      if (ts.underline) {
         ctx.shadowColor = 'transparent';
         ctx.beginPath();
         ctx.strokeStyle = ts.color || '#ffffff';
         ctx.lineWidth = Math.max(1, textHeight / 15);
         const lineY = textHeight * 0.45;
         ctx.moveTo(-(textWidth / 2), lineY);
         ctx.lineTo((textWidth / 2), lineY);
         ctx.stroke();
      }

      ctx.restore();

      // ── Composite the text buffer, applying crop then perspective ──────────
      if (textBuffer) {
        ctx = textOuterCtx;

        // Crop is expressed as fractions of the clip's own box, matching the
        // video branch: trim the source rect and place it at the same fraction of
        // the destination so the remaining pixels do not shift.
        const sx = cLeft * textBufW;
        const sy = cTop * textBufH;
        const sw = Math.max(1, textBufW * (1 - cLeft - cRight));
        const sh = Math.max(1, textBufH * (1 - cTop - cBot));

        if (corners) {
          // Perspective replaces the (skipped) shared transform entirely, so the
          // cropped buffer is projected straight onto the four corner points.
          if (textNeedsCrop) {
            const cropped = getOrCreateCanvas(
              offscreenCanvasPool.current,
              `text_crop_${clip.id}`,
              Math.round(sw),
              Math.round(sh)
            );
            const cCtx = cropped.getContext('2d');
            if (cCtx) {
              cCtx.setTransform(1, 0, 0, 1, 0, 0);
              cCtx.clearRect(0, 0, cropped.width, cropped.height);
              cCtx.drawImage(textBuffer, sx, sy, sw, sh, 0, 0, cropped.width, cropped.height);
              ctx.save();
              ctx.globalAlpha = ctx.globalAlpha * animOpacity;
              drawPerspectiveTexture(ctx, cropped, corners);
              ctx.restore();
            }
          } else {
            ctx.save();
            ctx.globalAlpha = ctx.globalAlpha * animOpacity;
            drawPerspectiveTexture(ctx, textBuffer, corners);
            ctx.restore();
          }
        } else {
          // No perspective: the shared transform block already positioned `ctx`,
          // so blit the buffer back around the origin it was drawn about.
          const dxT = -textBufW / 2 + sx;
          const dyT = -textBufH / 2 + sy;
          ctx.save();
          ctx.globalAlpha = ctx.globalAlpha * animOpacity;
          ctx.drawImage(textBuffer, sx, sy, sw, sh, dxT, dyT, sw, sh);
          ctx.restore();
        }
      }
    }

    ctx.restore();

    // Resolve the partial blend (see the setup block above for the maths).
    if (blendLayer && blendBackdrop && targetCtxForBlend) {
      ctx = outerCtx;
      const backdropCtx = blendBackdrop.getContext('2d');
      if (backdropCtx) {
        // S := blend(B, C) — blend the clip layer into the untouched backdrop copy.
        backdropCtx.save();
        backdropCtx.setTransform(1, 0, 0, 1, 0, 0);
        backdropCtx.globalAlpha = blendPlan.alpha;
        backdropCtx.globalCompositeOperation = blendPlan.mode;
        backdropCtx.drawImage(blendLayer, 0, 0);
        backdropCtx.restore();

        ctx.save();
        // Blit 1:1 in device pixels — both layers already hold world-space pixels.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // over(B, C)
        ctx.globalAlpha = blendPlan.alpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(blendLayer, 0, 0);
        // ...then mix in blend(B, C) to reach the lerp.
        ctx.globalAlpha = blendPlan.mix;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(blendBackdrop, 0, 0);
        ctx.restore();
      }
    }
  };

  // ─── Transition resolution ────────────────────────────────────────────────
  // Determine, per visual track, whether a clip-to-clip transition is active on
  // this frame. Transitions were previously stored and drawn on the timeline but
  // never composited here, which is why they had no visible effect. A track can
  // have at most one active transition per frame (findActiveTransition enforces
  // that), so overlapping windows can't double-composite and flicker.
  const activeTransitions = new Map<string, ActiveTransition>();
  // Clips that are being handled by a transition; they must NOT also be drawn by
  // the normal draw queue or they'd be painted twice (once opaque), which would
  // completely hide the blend.
  const transitionClipIds = new Set<string>();

  for (const track of visualTracks) {
    const active = findActiveTransition(track.clips, currentTime);
    if (active) {
      activeTransitions.set(track.id, active);
      transitionClipIds.add(active.from.id);
      transitionClipIds.add(active.to.id);
    }
  }

  const drawQueue: { clip: any; layer: number }[] = [];
  for (const track of visualTracks) {
    for (const clip of track.clips) {
      if (transitionClipIds.has(clip.id)) continue; // drawn by the transition pass
      if (!clip.disabled && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration + 0.001) {
        drawQueue.push({ clip, layer: track.id.startsWith('text') ? 100 : 0 });
      }
    }
  }

  // Queue the transition pass at the owning track's layer so z-ordering against
  // text/PiP layers is preserved.
  for (const [trackId, active] of activeTransitions) {
    drawQueue.push({
      clip: { __transition: active, id: `__transition_${trackId}` },
      layer: trackId.startsWith('text') ? 100 : 0,
    });
  }

  // Also collect active clips inside PiP Windows attached to active timeline clips
  // PERF: read pipWindows from the snapshot captured at frame start.
  const activePipWindows = storeState.pipWindows || {};
  if (activePipWindows && Object.keys(activePipWindows).length > 0) {
    for (const pip of Object.values(activePipWindows) as any[]) {
      if (!pip || !pip.tracks) continue;
      let parentClip: any = null;
      for (const t of tracks) {
        parentClip = t.clips.find((c: any) => c.id === pip.parentClipId);
        if (parentClip) break;
      }
      if (!parentClip || parentClip.disabled) continue;

      const pipAbsStart = parentClip.startTime + (pip.relativeStartTime || 0);
      if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration + 0.001) {
        for (const pTrack of pip.tracks) {
          if (pTrack.hidden) continue;
          for (const pClip of pTrack.clips) {
            const pAbsStart = pipAbsStart + pClip.startTime;
            if (!pClip.disabled && currentTime >= pAbsStart && currentTime < pAbsStart + pClip.duration + 0.001) {
              const syntheticClip = {
                ...pClip,
                startTime: pAbsStart,
                // Carry the parent container's transform down to the child so the
                // whole PiP group moves/scales/rotates as one unit. See the
                // __parentTransform handling in drawSingleClip.
                __parentTransform: parentClip.transform,
                __parentId: parentClip.id,
                __parentStartTime: parentClip.startTime,
                __parentAnimations: parentClip.animations,
                __parentOpacity: parentClip.opacity,
                __parentCrop: parentClip.crop,
              };
              drawQueue.push({ clip: syntheticClip, layer: 200 + (pTrack.type === 'text' ? 100 : 0) });
            }
          }
        }
      }
    }
  }

  if (drawQueue.length > 1) {
    let needsSort = false;
    for (let i = 1; i < drawQueue.length; i++) {
      if (drawQueue[i].layer < drawQueue[i - 1].layer) {
        needsSort = true;
        break;
      }
    }
    if (needsSort) {
      drawQueue.sort((a, b) => a.layer - b.layer);
    }
  }

  /**
   * Composite one clip of a transition onto the frame.
   *
   * Each layer is rendered into its own offscreen buffer first and only then
   * blitted with the transition's opacity/offset/scale/clip-rect. Drawing the two
   * clips straight onto the shared composite context would be wrong: clips carry
   * their own transforms and per-clip alpha, and Canvas2D has no way to express
   * "apply this extra alpha to everything I'm about to draw" without a separate
   * buffer. The buffer also makes wipes possible, since we need to mask the fully
   * drawn layer rather than each of its individual draw calls.
   */
  const drawTransitionLayer = async (
    clipToDraw: any,
    layer: LayerDraw,
    bufferKey: string
  ) => {
    if (!layer.visible) return;

    // The buffer holds ONLY the frame region (W x H in local units), rendered at
    // the same device resolution the frame currently occupies so the layer is not
    // softened by a round-trip through a lower-res buffer.
    const bufScale = Math.max(0.1, canvas_scale * viewport.zoom);
    const bufW = Math.max(1, Math.round(W * bufScale));
    const bufH = Math.max(1, Math.round(H * bufScale));

    const buf = getOrCreateCanvas(offscreenCanvasPool.current, bufferKey, bufW, bufH);
    const bctx = buf.getContext('2d');
    if (!bctx) return;

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, buf.width, buf.height);

    // drawSingleClip works in "local frame space": (0,0) is the frame's top-left
    // and the frame is W x H units. Scaling by bufScale reproduces that space
    // exactly, so the clip lands where it normally would.
    bctx.save();
    bctx.scale(bufScale, bufScale);
    await drawSingleClip(clipToDraw, 1, undefined, bctx);
    bctx.restore();

    // Blit the finished layer with the transition's geometry + alpha. `ctx` is
    // already in local frame space, so we work in W/H units throughout.
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

    if (layer.clipRect) {
      const r = layer.clipRect;
      ctx.beginPath();
      ctx.rect(r.x * W, r.y * H, r.w * W, r.h * H);
      ctx.clip();
    }

    // Geometry is expressed in frame fractions, so it is resolution independent.
    const cxF = W / 2;
    const cyF = H / 2;
    ctx.translate(cxF + layer.translateX * W, cyF + layer.translateY * H);
    if (layer.rotation) ctx.rotate(layer.rotation);
    if (layer.scale !== 1) ctx.scale(layer.scale, layer.scale);
    ctx.translate(-cxF, -cyF);

    ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, W, H);
    ctx.restore();
  };

  /** Render a full clip-to-clip transition (both layers + overlay + post effect). */
  const drawTransition = async (active: ActiveTransition) => {
    const plan = buildTransitionPlan(active);
    anyClipDrawn = true;

    await drawTransitionLayer(active.from, plan.from, '__transition_from');
    await drawTransitionLayer(active.to, plan.to, '__transition_to');

    if (plan.overlay.type === 'color' && plan.overlay.alpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, plan.overlay.alpha);
      ctx.fillStyle = plan.overlay.color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  };

  // Render clips sequentially to guarantee correct Z-index order and prevent Canvas 2D
  // context state corruption (since drawSingleClip can yield on async operations like masks/AI).
  // Note: JavaScript is single-threaded, so Promise.all does not parallelize CPU-bound Canvas
  // drawing anyway; it merely interleaves execution, which corrupts the shared `ctx` state stack.
  for (const item of drawQueue) {
    if (item.clip.__transition) {
      await drawTransition(item.clip.__transition as ActiveTransition);
    } else {
      await drawSingleClip(item.clip);
    }
  }

  if (!anyClipDrawn && !hasClips) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No media in project', W / 2, H / 2 - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('Add clips to the timeline to preview', W / 2, H / 2 + 12);
  }

  if (!skipExpensiveFX) {
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration + 0.001) {
          renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
    }
  }

  ctx.restore();

  if (showGrid && !isExporting) {
    ctx.save();
    ctx.globalAlpha = 1;

    const COLS = 4;
    const ROWS = 3;
    const cellW = W / COLS;
    const cellH = H / ROWS;

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;

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

    ctx.strokeStyle = 'rgba(251,191,36,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(offsetX + W / 2, offsetY); ctx.lineTo(offsetX + W / 2, offsetY + H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(offsetX, offsetY + H / 2); ctx.lineTo(offsetX + W, offsetY + H / 2); ctx.stroke();
    ctx.setLineDash([]);

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

  if (settings.showSafeZones && !isExporting) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
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

  // Timecode overlay removed — timestamp is displayed in the timeline toolbar instead

  ctx.restore();

  const mainCtx = canvas.getContext('2d');
  if (mainCtx) {
    mainCtx.clearRect(0, 0, canvas.width, canvas.height);
    mainCtx.drawImage(composite, 0, 0);
  }

  if (!isPlaying || isExporting) {
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
  }
}
