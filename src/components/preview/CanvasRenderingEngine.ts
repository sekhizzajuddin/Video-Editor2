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

import { TimelineTrack, MediaItem, TimelineClip } from '@/types';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { getAnimatedValue } from '@/utils/keyframes';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import { createSceneStage, captureSceneFrame, destroySceneStage, type SceneStage, type SeekMode } from '@/utils/cssSceneRasterizer';

import { applyLutToCanvas } from '@/utils/lutParser';
import { applyAiBackgroundSmart, applySubjectNeonOutlineFlash } from '@/utils/aiBackgroundIntegrated';
import { applyObjectRemoval, clearObjectRemovalCache } from '@/utils/objectRemoval';
import { getWebGPUObjectRemovalEngine } from '@/utils/webgpu/WebGPUObjectRemoval';
import { drawSubscribeAnimation } from '@/utils/socialAnimations';
import { applyEasing, smoothNoise } from '@/utils/textAnimationEasing';
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
import { applyVectorMaskToContext, applyVectorMaskRaster, vectorMaskNeedsRaster } from '@/utils/vectorMaskEngine';
import { applyAdjustmentLayerPass } from '@/utils/adjustmentLayerEngine';
import { getInterpolatedMotionPosition } from '@/utils/motionTrackingEngine';
import { MediaPlaybackResult } from '@/hooks/useMediaPlayback';
import { getClipDimensions } from './previewMath';
import { resolveBlendPlan } from '@/utils/blendCompositor';
import { applyMotionEffect } from '@/utils/motionEffects';
import { drawTextBackground } from '@/utils/textBackgrounds';
import {
  findActiveTransition,
  buildTransitionPlan,
  applyTransitionPostEffect,
  applyFeatheredRectMask,
  applyNoiseRevealMask,
  applyNoiseBandMask,
  type ActiveTransition,
  type LayerDraw,
  type OverlayDraw,
} from '@/utils/transitionEngine';
import {
  computeEnterExitModifiers,
  type EnterExitModifiers,
} from '@/utils/clipEnterExitEngine';

// ── Custom FX SceneStage cache ────────────────────────────────────────────────
const _customFxStageCache = new Map<string, { stage: SceneStage; seekMode: SeekMode; htmlHash: number }>();
function _simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

// ---------------------------------------------------------------------------
// Module-level track list cache — avoids filter()+sort()+spread on every frame.
// Tracks reference is stable (Zustand gives new ref on mutation), so this is safe.
// ---------------------------------------------------------------------------
let _cachedTracksRef: TimelineTrack[] | null = null;
let _cachedVideoTracks: TimelineTrack[] = [];
let _cachedTextTracks: TimelineTrack[] = [];
let _cachedFxTracks: TimelineTrack[] = [];
let _cachedVisualTracks: TimelineTrack[] = [];

// ---------------------------------------------------------------------------
// Cached dark transparency checkerboard pattern for alpha masking and cutouts.
// ---------------------------------------------------------------------------
let _checkerboardPattern: CanvasPattern | null = null;
function getCheckerboardPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!_checkerboardPattern) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return null;
    pCtx.fillStyle = '#222328';
    pCtx.fillRect(0, 0, 32, 32);
    pCtx.fillStyle = '#17181c';
    pCtx.fillRect(0, 0, 16, 16);
    pCtx.fillRect(16, 16, 16, 16);
    _checkerboardPattern = ctx.createPattern(pCanvas, 'repeat');
  }
  return _checkerboardPattern;
}

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

// PERF: per-clip mask raster cache keyed by a params signature. When a mask
// has no animated values (the common case), the rasterized mask is identical
// every frame — previously it was cleared and re-rendered EVERY frame,
// including a full-canvas `ctx.filter = blur()` (one of the most expensive
// Canvas2D ops). Animated masks simply miss the cache and take the live
// redraw path. Bounded LRU so deleted clips' entries are evicted naturally.
const maskRasterCache = new Map<string, { sig: string; canvas: HTMLCanvasElement }>();
const MASK_CACHE_CAP = 12;

// PERF: reference-keyed per-render caches (see renderCanvasEngine). Rebuilt
// lazily only when the underlying store data reference changes.
let _cachedMediaMap: Map<string, MediaItem> | null = null;
let _cachedMediaMapRef: MediaItem[] | null = null;
let _cachedClipsById: Map<string, TimelineClip> | null = null;
let _cachedClipsByIdTracksRef: TimelineTrack[] | null = null;

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
    showTransparencyGrid?: boolean;
    canvasBgColor: string;
    isPlaying: boolean;
    isScrubbing?: boolean;
    aspectRatio: string;
    isExporting: boolean;
    exportTransparent?: boolean;
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

const MAX_POOL_CANVASES = 8;

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

/**
 * True for chroma keys that must never be skipped for performance.
 *
 * Generative overlays are rendered on a flat key plate when the browser cannot
 * encode a real alpha channel, so until the key runs the whole frame is that
 * colour — skipping it shows a solid block instead of a slightly-less-pretty
 * effect. `alwaysApply` is set explicitly on new overlays; the pure-magenta
 * colour test also catches overlays added to a timeline BEFORE that flag
 * existed, which is why this is a colour check and not just the flag.
 */
const PINNED_KEY_COLORS: ReadonlySet<string> = new Set([
  '#ff00ff',
  '#f0f',
  '#ff00ffff',
  'magenta',
]);

function isPinnedChromaKey(chromaKey: any): boolean {
  if (!chromaKey?.enabled) return false;
  if (chromaKey.alwaysApply === true) return true;
  const color = String(chromaKey.color || '').trim().toLowerCase();
  return PINNED_KEY_COLORS.has(color);
}

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
          const evicted = offscreenPool.get(k);
          if (evicted) {
            evicted.width = 0;
            evicted.height = 0;
          }
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
    showTransparencyGrid = true,
    canvasBgColor,
    isPlaying,
    aspectRatio,
    isExporting,
    exportTransparent,
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
      alpha: true,
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
    (activeVideoClipCount > 1 || tracks.length > 5 || tracks.some(t => t.clips.some(c => !c.disabled && c.lutFilter?.mediaId)));
  // Scrubbing forces quality-2 path so heavy FX (chroma, LUT, AI bg) are skipped,
  // making playhead drag feel CapCut-smooth.
  // Adaptive performance downgrade: if rolling FPS dropped below 50 for >1.5s,
  // PERF: snapshot store state ONCE per frame. Previously drawSingleClip
  // called useEditorStore.getState() 3× per clip per frame — expensive when
  // 10 tracks × 5 clips = 150 store reads per render.
  const storeState = useEditorStore.getState();
  const perfDowngraded = storeState.perfDowngraded;
  const adaptiveSlowdown = !isExporting && perfDowngraded && isPlaying;
  // MOBILE PERF: on mobile, always skip expensive CPU pixel operations
  // (getImageData/putImageData) during playback. These stall the GPU→CPU
  // readback pipeline on TBDR mobile GPUs (Mali, Adreno, Apple GPU),
  // causing severe frame drops. Effects still render when paused.
  const isMobilePlaying = isPlaying && (typeof navigator !== 'undefined' && (/android/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  const skipExpensiveFX = !isExporting && (isScrubbing || adaptiveSlowdown || (isPlaying && (previewMode === 'fast' || isAutoFast || previewQuality === 'quarter' || isMobilePlaying)));
  const skipUltraHeavyFX = !isExporting && (isScrubbing || adaptiveSlowdown || (isPlaying && (previewMode === 'fast' || isAutoFast || previewQuality === 'quarter' || previewQuality === 'half' || isMobilePlaying)));

  // PERF: build mediaMap once per mediaLibrary reference (was rebuilt every
  // frame — O(M) Map.set per frame, M = media library size).
  let mediaMap: Map<string, MediaItem>;
  if (_cachedMediaMap && mediaLibraryRaw === _cachedMediaMapRef) {
    mediaMap = _cachedMediaMap;
  } else {
    mediaMap = new Map<string, MediaItem>();
    for (let i = 0; i < mediaLibraryRaw.length; i++) {
      mediaMap.set(mediaLibraryRaw[i].id, mediaLibraryRaw[i]);
    }
    _cachedMediaMap = mediaMap;
    _cachedMediaMapRef = mediaLibraryRaw as MediaItem[];
  }

  // PERF (multi-split fix): build split-sibling lookup indexes for the render.
  // drawSingleClip's sibling fallback used to iterate ALL video elements and run
  // tracks.flatMap().find() PER lookup, per frame, for every split clip whose
  // element wasn't ready — O(N²) inside the render loop that stalled preview on
  // heavily-split timelines.
  // The clipsById pass (O(tracks × clips)) is cached on the tracks reference;
  // the ready-element indexes are rebuilt every render (cheap — the pool holds
  // a handful of elements) so readiness stays fresh across async loads.
  let splitSiblingEl: Map<string, HTMLVideoElement>;
  {
    let clipsById: Map<string, TimelineClip>;
    if (_cachedClipsById && tracks === _cachedClipsByIdTracksRef) {
      clipsById = _cachedClipsById;
    } else {
      clipsById = new Map<string, TimelineClip>();
      for (const track of tracks) {
        for (const c of track.clips) clipsById.set(c.id, c);
      }
      _cachedClipsById = clipsById;
      _cachedClipsByIdTracksRef = tracks;
    }
    splitSiblingEl = new Map<string, HTMLVideoElement>();
    for (const [otherId, otherEl] of videoElements) {
      if (!otherEl || otherEl.readyState < 1 || otherEl.videoWidth === 0) continue;
      const oc = clipsById.get(otherId);
      if (!oc) continue;
      if (oc.splitGroupId && !splitSiblingEl.has(oc.splitGroupId)) {
        splitSiblingEl.set(oc.splitGroupId, otherEl);
      }
    }
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

  // The canvas buffer is sized to match the project aspect ratio (see
  // PreviewCanvasContainer), so use its actual dimensions as the target frame.
  // This removes the double letterboxing that made non-16:9 (portrait/square)
  // clips render tiny — or seemingly "not render" — in the portrait mobile view.
  const W_target = canvas.width;
  const H_target = canvas.height;
  const canvas_scale = canvas.width / W_target;

  // NOTE: The old needsWait early-return was removed because it blocked the entire
  // rendering pipeline when a video element was mid-seek (readyState < 1). The
  // drawSingleClip function now falls back to cached ImageBitmaps from frameCache,
  // so we always proceed with rendering to ensure smooth scrubbing and transform updates.

  if (isExporting && exportTransparent) {
    ctx.clearRect(0, 0, composite.width, composite.height);
  } else {
    ctx.fillStyle = canvasBgColor === 'transparent' ? '#0a0a0a' : (canvasBgColor || '#0a0a0a');
    ctx.fillRect(0, 0, composite.width, composite.height);
  }

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

  // --- Transparency Grid / Canvas Background for Masking and Cutouts ---
  // When transparency grid is enabled (default) or canvas background is set to transparent,
  // render an industry-standard checkerboard pattern inside the frame bounds (0, 0, W, H)
  // so AI background cutouts, vector masks, shape masks, and keyed footage visually show
  // a crisp transparent canvas instead of solid black.
  if (!isExporting && (showTransparencyGrid || canvasBgColor === 'transparent')) {
    const pattern = getCheckerboardPattern(ctx);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (canvasBgColor && canvasBgColor !== 'transparent' && canvasBgColor !== '#0a0a0a') {
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, W, H);
  }

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
    ctx.translate(-camX * W_target, -camY * H_target);
  }
  // ---------------------------------

  // PERF: Cache filtered+sorted track lists. filter()+sort()+spread creates 3 new arrays
  // every frame (60/s). Now only rebuilds when the `tracks` reference changes.
  if (tracks !== _cachedTracksRef) {
    // Compositing order = timeline stacking order. Legacy projects stored
    // integer-suffixed ids (track_v_1, track_v_2 …) and relied on numeric
    // sorting; modern ids are uuid-based, where parsing digits produced a
    // random (and unstable) z-order — an overlay track could end up *under*
    // the footage it was meant to sit on. Keep the numeric rule for legacy
    // ids and fall back to array order otherwise (last track paints on top),
    // which is also what the export scheduler does.
    const arrayOrder = new Map(tracks.map((t, index) => [t.id, index]));
    const legacyNumericId = (id: string) => /_\d+$/.test(id);
    const numericId = (id: string) => parseInt(id.replace(/\D/g, ''), 10) || 0;

    _cachedVideoTracks = tracks
      .filter((t) => t.type === 'video' && !t.hidden)
      .sort((a, b) => {
        const aLegacy = legacyNumericId(a.id);
        const bLegacy = legacyNumericId(b.id);
        if (aLegacy && bLegacy) return numericId(a.id) - numericId(b.id);
        if (aLegacy !== bLegacy) return aLegacy ? -1 : 1;
        return (arrayOrder.get(a.id) ?? 0) - (arrayOrder.get(b.id) ?? 0);
      });
    _cachedTextTracks = tracks.filter((t) => t.type === 'text' && !t.hidden);
    _cachedFxTracks = tracks.filter((t) => t.type === 'fx' && !t.hidden);
    _cachedVisualTracks = [..._cachedVideoTracks, ..._cachedTextTracks];
    _cachedTracksRef = tracks;
  }
  const videoTracks = _cachedVideoTracks;
  const visualTracks = _cachedVisualTracks;
  const fxTracks = _cachedFxTracks;

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

    // PERF: cache-hit fast path — when the animated mask params are unchanged
    // since the last frame, the cached raster is reused and only the cheap
    // `destination-in` composite runs (no clearRect/blur/path redraw). Rounded
    // to 0.25px to absorb float jitter while catching real moves. Matte masks
    // are never cached — their content is frame-dependent (source clip).
    const maskSig = mask.type === 'matte'
      ? null
      : `${mask.type}|${mx.toFixed(2)}|${my.toFixed(2)}|${mw.toFixed(2)}|${mh.toFixed(2)}|${mRot.toFixed(2)}|${feather.toFixed(2)}|${mRoundness.toFixed(2)}|${mask.invert ? 1 : 0}|${ow}x${oh}`;
    if (maskSig) {
      const cached = maskRasterCache.get(clipId);
      if (cached && cached.sig === maskSig) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'destination-in';
        oCtx.drawImage(cached.canvas, 0, 0);
        oCtx.restore();
        return;
      }
    }

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

    if (maskSig) {
      maskRasterCache.delete(clipId);
      maskRasterCache.set(clipId, { sig: maskSig, canvas: maskCanvas });
      if (maskRasterCache.size > MASK_CACHE_CAP) {
        for (const k of maskRasterCache.keys()) {
          if (k !== clipId) {
            maskRasterCache.delete(k);
            break;
          }
        }
      }
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

    // ── Motion-tracked region effects: frame-space post-pass ──────────────────
    //
    // A region is authored in FRAME space — the user points at a spot on the
    // picture. The previous implementation applied it inside the clip's own media
    // buffer, treating the coordinates as a fraction of 854 and mapping them onto
    // a buffer that is neither 854 wide nor aligned with the frame, and which
    // knows nothing about the clip's translate/scale. The shaken pixels were
    // therefore never the ones the box was drawn over — the effect always landed
    // somewhere else, which is exactly the reported symptom.
    //
    // The fix: render the clip normally into a full-frame buffer, then apply the
    // region effect to THAT, where (x, y) means the same thing it does on the
    // overlay. Same trick `drawTransitionLayer` already uses.
    if (
      !skipExpensiveFX &&
      !clip.__motionFxPass &&
      Array.isArray(clip.motionEffects) &&
      clip.motionEffects.some((m: any) => m?.enabled)
    ) {
      const bufScale = Math.max(0.1, canvas_scale * viewport.zoom);
      const bufW = Math.max(1, Math.round(W * bufScale));
      const bufH = Math.max(1, Math.round(H * bufScale));
      const buf = getOrCreateCanvas(
        offscreenCanvasPool.current,
        `__motionfx_${clip.id}`,
        bufW,
        bufH
      );
      const bctx = buf.getContext('2d');
      if (bctx) {
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.clearRect(0, 0, buf.width, buf.height);

        // Reproduce local frame space inside the buffer so the clip lands exactly
        // where it normally would, transform and all.
        bctx.save();
        bctx.scale(bufScale, bufScale);
        await drawSingleClip(
          { ...clip, __motionFxPass: true },
          opacityMultiplier,
          extraTransform,
          bctx
        );
        bctx.restore();

        // Now the buffer holds the finished clip in frame space. Region
        // coordinates map onto it by the single factor `bufScale` — no letterbox
        // offset (the buffer IS the frame) and no per-clip fudge.
        const meRelTime = Math.max(0, currentTime - clip.startTime);
        for (let mi = 0; mi < clip.motionEffects.length; mi++) {
          const me = clip.motionEffects[mi];
          if (!me?.enabled) continue;
          applyMotionEffect(
            bctx,
            buf.width,
            buf.height,
            me,
            meRelTime,
            `${clip.id}_me${mi}`,
            bufScale,
            bufScale
          );
        }

        // Known limitation: the inner pass blends against an EMPTY buffer rather
        // than the real backdrop, so a region effect combined with a non-normal
        // blend mode composites the clip over transparent black first. Normal
        // (source-over) clips — the overwhelming majority, and every case region
        // effects are used for — are pixel-identical.
        ctx.save();
        ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, W, H);
        ctx.restore();
        anyClipDrawn = true;
        return true;
      }
    }

    // ── Vector mask soft edge / partial opacity: frame-space post-pass ────────
    // A hard clip() cannot express feathered edges or mask opacity < 100%
    // (setting ctx.filter after clip() used to blur the whole CLIP instead of
    // the mask edge). Same trick as the motionFx pass above: render the clip
    // into a full-frame buffer, punch the rasterized (blurred) mask out of it
    // with destination-in, then blit.
    if (
      clip.vectorMask?.enabled &&
      !(clip as any).__vectorMaskPass &&
      vectorMaskNeedsRaster(clip.vectorMask)
    ) {
      const bufScale = Math.max(0.1, canvas_scale * viewport.zoom);
      const bufW = Math.max(1, Math.round(W * bufScale));
      const bufH = Math.max(1, Math.round(H * bufScale));
      const buf = getOrCreateCanvas(offscreenCanvasPool.current, `__vectormask_${clip.id}`, bufW, bufH);
      const bctx = buf.getContext('2d');
      if (bctx) {
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.clearRect(0, 0, buf.width, buf.height);
        bctx.save();
        bctx.scale(bufScale, bufScale);
        await drawSingleClip(
          { ...clip, __vectorMaskPass: true },
          opacityMultiplier,
          extraTransform,
          bctx
        );
        bctx.restore();
        // Identity space now: raster is built directly in buffer resolution so
        // the feather blur tracks canvas_scale/zoom.
        applyVectorMaskRaster(bctx as unknown as CanvasRenderingContext2D, clip.vectorMask, buf.width, buf.height);
        // Known limitation mirrors the motionFx pass: the inner pass blends
        // against an empty buffer, so soft vector masks combined with non-normal
        // blend modes composite over transparent black first. Normal (source-over)
        // clips — the overwhelming majority — are pixel-identical.
        ctx.save();
        ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, W, H);
        ctx.restore();
        anyClipDrawn = true;
        return true;
      }
    }

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
      aRot = getAnimatedValue(clip.transform.rotationZ ?? clip.transform.rotation ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationZ'] || clip.animations?.['transform.rotation'], clip.expressions?.['transform.rotationZ'] || clip.expressions?.['transform.rotation']);
    } else {
      aOpacity = clip.opacity ?? 1;
      aScale = clip.transform.scale ?? 100;
      aX = clip.transform.x ?? 0;
      aY = clip.transform.y ?? 0;
      aRot = clip.transform.rotationZ ?? clip.transform.rotation ?? 0;
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

    // ── Enter/Exit animation modifiers ──────────────────────────────────────
    const eeAnim = clip.enterExitAnimation;
    const eeMods = computeEnterExitModifiers(eeAnim, clip.startTime, clip.duration, currentTime);

    const ownBlend = clip.transform.blendMode;
    const blendMode =
      ownBlend && ownBlend !== 'source-over'
        ? ownBlend
        : parentForBlend?.blendMode || 'source-over';
    const totalAlpha = aOpacity * opacityMultiplier * parentOpacity * eeMods.opacity;

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

    // Hard-edge, full-opacity vector masks: exact zero-cost clip. Feathered or
    // partially-opaque masks took the raster post-pass above and must not also
    // clip here (the inner buffer pass carries __vectorMaskPass).
    if (clip.vectorMask?.enabled && !(clip as any).__vectorMaskPass && !vectorMaskNeedsRaster(clip.vectorMask)) {
      applyVectorMaskToContext(ctx, clip.vectorMask, W, H);
    }

    const cx = W / 2;
    const cy = H / 2;

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

    const isFlippedH = !!((clip.transform?.flipH ? 1 : 0) ^ (fxFlipH ? 1 : 0));
    const isFlippedV = !!((clip.transform?.flipV ? 1 : 0) ^ (fxFlipV ? 1 : 0));

    let corners: LocalCornerPoints | null = null;
    if (hasPerspectiveWarp) {
      if (clip.transform.perspectivePin) {
        const pc = clip.transform.perspectiveCorners || { x0: 0, y0: 0, x1: W, y1: 0, x2: W, y2: H, x3: 0, y3: H };
        
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

          let c0 = transformCorner(corners.x0, corners.y0);
          let c1 = transformCorner(corners.x1, corners.y1);
          let c2 = transformCorner(corners.x2, corners.y2);
          let c3 = transformCorner(corners.x3, corners.y3);

          if (isFlippedH) {
            const t0 = c0; c0 = c1; c1 = t0;
            const t3 = c3; c3 = c2; c2 = t3;
          }
          if (isFlippedV) {
            const t0 = c0; c0 = c3; c3 = t0;
            const t1 = c1; c1 = c2; c2 = t1;
          }

          corners = {
            x0: c0.x, y0: c0.y,
            x1: c1.x, y1: c1.y,
            x2: c2.x, y2: c2.y,
            x3: c3.x, y3: c3.y,
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
          const fontStyleM: string[] = [];
          if (tsm?.italic) fontStyleM.push('italic');
          if (tsm?.bold) fontStyleM.push('bold');
          const fwM = fontStyleM.join(' ');
          const fsM = Number(tsm?.fontSize) || 48;
          ctx.save();
          ctx.font = `${fwM ? fwM + ' ' : ''}${fsM}px ${tsm?.fontFamily || 'sans-serif'}`;
          const linesM = String(tsm?.text ?? '').split('\n');
          let maxLM = 0;
          for (const l of linesM) {
            const lw = ctx.measureText(l || ' ').width;
            if (lw > maxLM) maxLM = lw;
          }
          ctx.restore();
          const bgPadXM = (tsm?.backgroundColor && tsm?.backgroundColor !== 'transparent') ? fsM * 0.5 : 0;
          const bgPadYM = (tsm?.backgroundColor && tsm?.backgroundColor !== 'transparent') ? fsM * 0.3 : 0;
          const strokeM = (tsm?.strokeColor && tsm?.strokeWidth) ? Number(tsm.strokeWidth) * 2 : 0;
          const shadowM = tsm?.shadow ? (Number(tsm.shadowBlur) || 10) * 2 + 10 : 0;
          vw = Math.max(80, Math.ceil(maxLM + bgPadXM * 2 + strokeM + shadowM + 40));
          vh = Math.max(40, Math.ceil(linesM.length * (fsM * 1.25) + bgPadYM * 2 + strokeM + shadowM + 20));
          // Text is drawn at its natural size (no fit-to-frame downscale).
          fitScale = 1;
        } else {
          vw = mediaItem.width || 854;
          vh = mediaItem.height || 480;
          fitScale = Math.min(W / vw, H / vh);
        }

        corners = getProjectedCorners(
          vw, vh,
          (aScale / 100) * fitScale * fxActionScaleMultiplier,
          aRotX, aRotY, aRot,
          aX + fxShakeX, aY + fxShakeY,
          cx, cy,
          800,
          isFlippedH,
          isFlippedV
        );
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

      // Enter/exit animation translate (in frame fractions)
      tx += eeMods.translateX * W;
      ty += eeMods.translateY * H;

      ctx.translate(tx, ty);
      ctx.translate(aX, aY);

      let finalScale = (aScale / 100) * fxActionScaleMultiplier * eeMods.scale;
      if (extraTransform?.scale !== undefined) {
        finalScale *= extraTransform.scale;
      }
      const scaleX = finalScale * (isFlippedH ? -1 : 1);
      const scaleY = finalScale * (isFlippedV ? -1 : 1);
      ctx.rotate((aRot * Math.PI) / 180 + eeMods.rotation);
      ctx.scale(scaleX, scaleY);
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
        if (!videoEl || videoEl.readyState < 1 || videoEl.videoWidth === 0) {
          // Sibling fallback (multi-split fix): O(1) lookup via the per-render
          // indexes built above — was a full videoElements iteration plus a
          // tracks.flatMap().find() PER clip PER frame (O(N²) with many splits).
          videoEl =
            (clip.splitGroupId ? splitSiblingEl.get(clip.splitGroupId) : null) ||
            null;
          if (videoEl) {
            videoElements.set(clip.id, videoEl);
          }
        }
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
          // Chroma Key (Green Screen) is a fundamental cutout matte: it must never
          // be dropped during playback or fast mode (dropping it shows an opaque green block).
          const hasChroma = !!clip.chromaKey?.enabled;
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

          // NOTE: motion-tracked region effects are NOT handled here any more.
          // They used to run inside this per-clip media buffer, which mapped the
          // region as a fraction of 854 onto a buffer that is neither 854 wide
          // nor aligned to the frame — so the shaken pixels were never the ones
          // under the box. They now run as a frame-space post-pass; see the
          // `__motionFxPass` block at the top of drawSingleClip.
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
            // NOTE: intentionally NOT gated behind previewMode/skipExpensiveFX —
            // the pre-rendered temporal mask composite is a pure drawImage (<1ms),
            // so dropping it in 'fast' mode made the cutout appear broken during
            // playback (CapCut keeps the cutout visible at all preview qualities).
            if (clip.aiBackground?.enabled) {
              const animEdgeBlur = getAnimatedValue(clip.aiBackground.edgeBlur ?? 0, currentTime, clip.startTime, clip.animations?.['aiBackground.edgeBlur'], clip.expressions?.['aiBackground.edgeBlur']);
              const smartOpts = {
                playbackQuality: clip.aiBackground.playbackQuality ?? 'balanced',
                isPlaying: isPlaying && !isExporting,
                isExporting: !!isExporting,
                edgeBlur: animEdgeBlur,
                modelSelection: (clip.aiBackground.modelSelection ?? 1) as 0 | 1 | 2 | 3,
                useROI: true,        // Enable smart ROI cropping for high effective resolution
                skinThreshold: 0.008, // 0.8% skin pixels triggers human detection early-exit
                choke: clip.aiBackground.choke ?? 0,
                feather: clip.aiBackground.feather ?? 0,
                spillSuppression: clip.aiBackground.spillSuppression ?? 0,
                spillColor: clip.aiBackground.spillColor,
                mode: clip.aiBackground.mode ?? 'remove',
                blurStrength: clip.aiBackground.blurStrength ?? 12,
                strokeColor: clip.aiBackground.strokeColor ?? '#ffffff',
                strokeWidth: clip.aiBackground.strokeWidth ?? 4,
                strokeGlow: clip.aiBackground.strokeGlow ?? false,
                bgColor: clip.aiBackground.bgColor ?? '#1e1e24',
              };
              try {
                // Snapshot the current cropped+filtered frame so AI compositing
                // doesn't self-draw (clearing + drawing the same canvas = black)
                // and so segmentation runs on the actual visible crop, not the
                // uncropped raw video element.
                const aiSourceCanvas = getOrCreateCanvas(offscreenCanvasPool.current, `ai_src_${clip.id}`, offCanvas.width, offCanvas.height);
                const aiSrcCtx = aiSourceCanvas.getContext('2d')!;
                aiSrcCtx.clearRect(0, 0, aiSourceCanvas.width, aiSourceCanvas.height);
                aiSrcCtx.drawImage(offCanvas, 0, 0);
                // Stamp with video time so getVideoCurrentTime() can look up the
                // pre-rendered temporal mask cache (canvas has no native currentTime)
                const srcTime = (sourceElement && typeof (sourceElement as any).currentTime === 'number' && (sourceElement as any).currentTime >= 0)
                  ? (sourceElement as any).currentTime
                  : localTime;
                (aiSourceCanvas as any).currentTime = srcTime;
                (aiSourceCanvas as any).localTime = localTime;

                if (isExporting) {
                  await applyAiBackgroundSmart(oCtx, offCanvas.width, offCanvas.height, aiSourceCanvas, clip.id, smartOpts);
                } else {
                  await applyAiBackgroundSmart(oCtx, offCanvas.width, offCanvas.height, aiSourceCanvas, clip.id, smartOpts);
                }
                
                // Re-apply crop bounds: AI background modes like 'color' or 'blur' fill the
                // entire canvas. We must mask out the cropped areas so the background doesn't
                // bleed outside the user's intended crop rectangle.
                if (cLeft > 0) oCtx.clearRect(0, 0, odx, offCanvas.height);
                if (cRight > 0) oCtx.clearRect(odx + odw, 0, offCanvas.width, offCanvas.height);
                if (cTop > 0) oCtx.clearRect(0, 0, offCanvas.width, ody);
                if (cBot > 0) oCtx.clearRect(0, ody + odh, offCanvas.width, offCanvas.height);
              } catch (aiErr) {
                console.warn('[CanvasRenderingEngine] AI background render error:', aiErr);
              }
            }

            // Chroma Key (Green Screen) — essential cutout matte, always applied during playback.
            // Without keying, a keyed clip appears as an opaque green block hiding lower layers.
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

            // Secondary / heavy grading & pixel effects
            const allowHeavyFx = !skipExpensiveFX;

            if (allowHeavyFx) {
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
              // Object Removal (WebGPU-accelerated with Canvas2D fallback)
              if (clip.objectRemoval?.enabled) {
                const webgpuEngine = getWebGPUObjectRemovalEngine();
                
                // Try WebGPU acceleration first for better performance
                if (webgpuEngine.isAvailable()) {
                  try {
                    const resultCanvas = await webgpuEngine.processFrame(
                      offCanvas,
                      clip.objectRemoval,
                      offCanvas.width,
                      offCanvas.height
                    );
                    
                    if (resultCanvas) {
                      oCtx.drawImage(resultCanvas, 0, 0);
                    } else {
                      // Fallback to Canvas2D if WebGPU processing fails
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
                  } catch (err) {
                    console.warn('[Object Removal] WebGPU processing failed, falling back to Canvas2D:', err);
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
                } else {
                  // Use Canvas2D implementation
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
                  isPlaying,
                  clip.fxSettings
                );
              }
            }

            if (clip.fxSettings?.type === 'subject_outline_flash') {
              const neonOpts = {
                color: clip.fxSettings.outlineColor || '#00f0ff',
                strokeWidth: clip.fxSettings.outlineWidth || 3,
                glowBlur: clip.fxSettings.glowBlur || 14,
                flashSpeed: clip.fxSettings.strobeSpeed || 8,
                currentTime: currentTime,
                clipId: `neon_${clip.id}`,
                isPlaying: !isExporting,
              };
              
              // Apply to oCtx (offCanvas) using aiSourceCanvas or sourceElement
              // so it perfectly aligns with all crops, scales, and positions.
              const neonSource = (typeof getOrCreateCanvas !== 'undefined' && typeof offscreenCanvasPool !== 'undefined')
                ? getOrCreateCanvas(offscreenCanvasPool.current, `ai_src_${clip.id}`, offCanvas.width, offCanvas.height)
                : sourceElement;
                
              if (isExporting) {
                await applySubjectNeonOutlineFlash(oCtx, offCanvas.width, offCanvas.height, neonSource, neonOpts);
              } else {
                void applySubjectNeonOutlineFlash(oCtx, offCanvas.width, offCanvas.height, neonSource, neonOpts);
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
      let animRotation = 0;
      
      if (ts.animation) {
        const inDuration = ts.animation.inDuration || 0.1;
        const outDuration = ts.animation.outDuration || 0.1;
        const easingType = ts.animation.easing || 'easeOut';
        
        const timeSinceStart = currentTime - clip.startTime;
        const timeUntilEnd = (clip.startTime + clip.duration) - currentTime;
        
        // ── Handle IN animation ──────────────────────────────────────────
        if (timeSinceStart < inDuration && timeSinceStart >= 0) {
          const rawProgress = timeSinceStart / inDuration;
          // Bounce and elastic have built-in easing; others use configurable easing
          const needsCustomEasing = !['bounce', 'elastic', 'dropBounce'].includes(ts.animation.in);
          const progress = needsCustomEasing ? applyEasing(rawProgress, easingType) : rawProgress;
          
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
              animScaleX = animScaleY = 1 - Math.cos(rawProgress * Math.PI * 2) * (1 - rawProgress) * 0.5;
              break;
            case 'slideUp':
              animOffsetY = (1 - progress) * 100;
              animOpacity = Math.min(1, rawProgress * 3);
              break;
            case 'slideDown':
              animOffsetY = -(1 - progress) * 100;
              animOpacity = Math.min(1, rawProgress * 3);
              break;
            case 'slideLeft':
              animOffsetX = (1 - progress) * 100;
              animOpacity = Math.min(1, rawProgress * 3);
              break;
            case 'slideRight':
              animOffsetX = -(1 - progress) * 100;
              animOpacity = Math.min(1, rawProgress * 3);
              break;
            case 'elastic': {
              const ep = rawProgress;
              animScaleX = animScaleY = Math.pow(2, -10 * ep) * Math.sin((ep * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
              break;
            }
            case 'scaleFlip':
              animScaleY = progress;
              break;
            case 'zoomBlur':
              animScaleX = animScaleY = 1 + (1 - progress);
              animOpacity = progress;
              break;
            // ── NEW: Previously unimplemented cinematic animations ──
            case 'revealWipe':
              // Handled via clip-path in text drawing section below
              animOpacity = 1;
              (clip as any).__revealWipeProgress = progress;
              break;
            case 'splitReveal':
              animScaleX = 0.1 + progress * 0.9;
              animScaleY = 0.1 + progress * 0.9;
              animOpacity = progress;
              break;
            case 'glitch': {
              const glitchIntensity = (1 - rawProgress) * 15;
              animOffsetX = (Math.random() - 0.5) * glitchIntensity;
              animOffsetY = (Math.random() - 0.5) * glitchIntensity * 0.5;
              animOpacity = rawProgress > 0.1 ? 1 : rawProgress * 10;
              break;
            }
            case 'letterSpacing':
              // Handled per-glyph in text drawing section below
              (clip as any).__letterSpacingProgress = progress;
              animOpacity = Math.min(1, rawProgress * 2);
              break;
            case 'rollUp':
              animOffsetY = (1 - progress) * 150;
              animOpacity = progress;
              animScaleY = 0.6 + progress * 0.4;
              break;
            // ── NEW: Brand new animation types ──
            case 'spinIn':
              animRotation = (1 - progress) * 360;
              animScaleX = animScaleY = progress;
              animOpacity = Math.min(1, rawProgress * 2);
              break;
            case 'dropBounce': {
              // Physics bounce: ball drops from above
              const t = rawProgress;
              let bounceVal: number;
              if (t < 0.3636) {
                bounceVal = 7.5625 * t * t;
              } else if (t < 0.7273) {
                const t2 = t - 0.5455;
                bounceVal = 7.5625 * t2 * t2 + 0.75;
              } else if (t < 0.9091) {
                const t2 = t - 0.8182;
                bounceVal = 7.5625 * t2 * t2 + 0.9375;
              } else {
                const t2 = t - 0.9545;
                bounceVal = 7.5625 * t2 * t2 + 0.984375;
              }
              animOffsetY = -(1 - bounceVal) * 200;
              animOpacity = Math.min(1, rawProgress * 3);
              break;
            }
            case 'flipX':
              // 3D card flip around X axis (simulated via scaleY)
              animScaleY = Math.abs(Math.cos((1 - progress) * Math.PI));
              animOpacity = rawProgress > 0.15 ? 1 : rawProgress * 6;
              break;
            case 'flipY':
              // 3D card flip around Y axis (simulated via scaleX)
              animScaleX = Math.abs(Math.cos((1 - progress) * Math.PI));
              animOpacity = rawProgress > 0.15 ? 1 : rawProgress * 6;
              break;
            case 'blurIn':
              // Blur effect simulated via opacity ramp (canvas filter blur is expensive)
              animOpacity = progress;
              animScaleX = animScaleY = 1 + (1 - progress) * 0.08;
              break;
            case 'expandWidth':
              animScaleX = progress;
              animScaleY = 1;
              animOpacity = Math.min(1, rawProgress * 2);
              break;
            case 'wave':
              // Per-character wave handled in text drawing; here just fade in
              (clip as any).__waveProgress = progress;
              animOpacity = Math.min(1, rawProgress * 2);
              break;
            case 'scramble':
              // Per-character scramble handled in text drawing
              (clip as any).__scrambleProgress = rawProgress;
              animOpacity = 1;
              break;
          }
        } 
        // ── Handle OUT animation ─────────────────────────────────────────
        else if (timeUntilEnd < outDuration && timeUntilEnd >= 0) {
          const rawProgress = 1 - (timeUntilEnd / outDuration); // 0 to 1
          const needsCustomEasing = !['bounce', 'elastic'].includes(ts.animation.out);
          const progress = needsCustomEasing ? applyEasing(rawProgress, easingType) : rawProgress;
          
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
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            case 'slideDown':
              animOffsetY = progress * 100;
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            case 'slideLeft':
              animOffsetX = -(progress * 100);
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            case 'slideRight':
              animOffsetX = progress * 100;
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            // ── NEW: All cinematic OUT animations ──
            case 'elastic': {
              const ep = rawProgress;
              animScaleX = animScaleY = 1 - (Math.pow(2, -10 * (1 - ep)) * Math.sin(((1 - ep) * 10 - 0.75) * ((2 * Math.PI) / 3)));
              break;
            }
            case 'scaleFlip':
              animScaleY = 1 - progress;
              break;
            case 'zoomBlur':
              animScaleX = animScaleY = 1 + progress;
              animOpacity = 1 - progress;
              break;
            case 'revealWipe':
              (clip as any).__revealWipeProgress = 1 - progress;
              break;
            case 'splitReveal':
              animScaleX = animScaleY = 1 - progress * 0.9;
              animOpacity = 1 - progress;
              break;
            case 'glitch': {
              const glitchIntensity = rawProgress * 15;
              animOffsetX = (Math.random() - 0.5) * glitchIntensity;
              animOffsetY = (Math.random() - 0.5) * glitchIntensity * 0.5;
              animOpacity = rawProgress < 0.9 ? 1 : (1 - rawProgress) * 10;
              break;
            }
            case 'letterSpacing':
              (clip as any).__letterSpacingProgress = 1 - progress;
              animOpacity = 1 - Math.max(0, (rawProgress - 0.5) * 2);
              break;
            case 'rollUp':
              animOffsetY = -(progress * 150);
              animOpacity = 1 - progress;
              animScaleY = 1 - progress * 0.4;
              break;
            case 'spinIn':
              animRotation = progress * 360;
              animScaleX = animScaleY = 1 - progress;
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            case 'dropBounce':
              animOffsetY = progress * 200;
              animOpacity = 1 - progress;
              break;
            case 'flipX':
              animScaleY = Math.abs(Math.cos(progress * Math.PI));
              animOpacity = rawProgress < 0.85 ? 1 : (1 - rawProgress) * 6;
              break;
            case 'flipY':
              animScaleX = Math.abs(Math.cos(progress * Math.PI));
              animOpacity = rawProgress < 0.85 ? 1 : (1 - rawProgress) * 6;
              break;
            case 'blurIn':
              animOpacity = 1 - progress;
              animScaleX = animScaleY = 1 + progress * 0.08;
              break;
            case 'expandWidth':
              animScaleX = 1 - progress;
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            case 'wave':
              animOpacity = 1 - Math.min(1, rawProgress * 1.5);
              break;
            case 'scramble':
              (clip as any).__scrambleProgress = 1 - rawProgress;
              animOpacity = rawProgress > 0.8 ? (1 - rawProgress) * 5 : 1;
              break;
          }
        }
        // ── Handle LOOP / ambient animation during hold phase ────────────
        else if (ts.animation.loop && ts.animation.loop !== 'none') {
          const loopSpeed = ts.animation.loopSpeed || 1;
          const loopTime = timeSinceStart * loopSpeed;
          const clipSeed = clip.id ? clip.id.charCodeAt(0) + clip.id.charCodeAt(Math.min(1, clip.id.length - 1)) : 42;
          
          switch (ts.animation.loop) {
            case 'wiggle':
              animOffsetX = (smoothNoise(clipSeed, loopTime, 3) - 0.5) * 6;
              animOffsetY = (smoothNoise(clipSeed + 100, loopTime, 2.5) - 0.5) * 4;
              animRotation = (smoothNoise(clipSeed + 200, loopTime, 2) - 0.5) * 3;
              break;
            case 'pulse':
              const pulseVal = Math.sin(loopTime * Math.PI * 2) * 0.03 + 1;
              animScaleX = animScaleY = pulseVal;
              break;
            case 'float':
              animOffsetY = Math.sin(loopTime * Math.PI * 0.8) * 8;
              animOffsetX = Math.cos(loopTime * Math.PI * 0.5) * 3;
              break;
            case 'neonFlicker': {
              const flickerVal = smoothNoise(clipSeed, loopTime, 8);
              animOpacity = flickerVal < 0.15 ? 0.6 + Math.random() * 0.2 : 1;
              break;
            }
            case 'shake':
              animOffsetX = (smoothNoise(clipSeed, loopTime, 12) - 0.5) * 8;
              break;
            case 'colorCycle':
              // Color cycling is handled in text drawing via hue rotation
              (clip as any).__colorCycleTime = loopTime;
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
      const fontStyleM: string[] = [];
      if (tsMeasure?.italic) fontStyleM.push('italic');
      if (tsMeasure?.bold) fontStyleM.push('bold');
      const fwM = fontStyleM.join(' ');
      const fsM = Number(tsMeasure?.fontSize) || 48;
      ctx.save();
      ctx.font = `${fwM ? fwM + ' ' : ''}${fsM}px ${tsMeasure?.fontFamily || 'sans-serif'}`;
      const measLines = String(tsMeasure?.text ?? '').split('\n');
      let measuredMaxLineW = 0;
      for (const line of measLines) {
        const lw = ctx.measureText(line || ' ').width;
        if (lw > measuredMaxLineW) measuredMaxLineW = lw;
      }
      ctx.restore();

      const bgPadX = (tsMeasure?.backgroundColor && tsMeasure?.backgroundColor !== 'transparent') ? fsM * 0.5 : 0;
      const bgPadY = (tsMeasure?.backgroundColor && tsMeasure?.backgroundColor !== 'transparent') ? fsM * 0.3 : 0;
      const strokePad = (tsMeasure?.strokeColor && tsMeasure?.strokeWidth) ? Number(tsMeasure.strokeWidth) * 2 : 0;
      const shadowPad = tsMeasure?.shadow ? (Number(tsMeasure.shadowBlur) || 10) * 2 + 10 : 0;

      const textBufW = Math.max(80, Math.ceil(measuredMaxLineW + bgPadX * 2 + strokePad + shadowPad + 40));
      const textBufH = Math.max(40, Math.ceil(measLines.length * (fsM * 1.25) + bgPadY * 2 + strokePad + shadowPad + 20));

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
      if (animRotation !== 0) {
        ctx.rotate(animRotation * Math.PI / 180);
      }
      ctx.scale(animScaleX, animScaleY);

      const fontStyle = [];
      if (ts.italic) fontStyle.push('italic');
      if (ts.bold) fontStyle.push('bold');
      
      const fontWeightStyle = fontStyle.join(' ');
      const fontFamily = ts.fontFamily ? `"${ts.fontFamily}", sans-serif` : 'sans-serif';
      ctx.font = `${fontWeightStyle ? fontWeightStyle + ' ' : ''}${ts.fontSize || 48}px ${fontFamily}`;
      const textAlign = ts.textAlign || 'center';
      ctx.textAlign = textAlign;
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

      const lines = String(textToRender).split('\n');
      const textHeight = ts.fontSize || 48;
      const lineHeight = textHeight * 1.25;
      const blockHeight = lines.length * lineHeight;
      let maxLineWidth = 0;
      for (const line of lines) {
        const lw = ctx.measureText(line).width;
        if (lw > maxLineWidth) maxLineWidth = lw;
      }

      const paddingX = textHeight * 0.5;
      const paddingY = textHeight * 0.3;

      if (ts.backgroundColor && ts.backgroundColor !== 'transparent') {
        const bgX = -(maxLineWidth / 2) - paddingX;
        const bgY = -(blockHeight / 2) - paddingY;
        const bgW = maxLineWidth + paddingX * 2;
        const bgH = blockHeight + paddingY * 2;
        
        // Prevent shadowing on the background itself unless it's a solid box where it might look okay.
        // Actually, let's keep it simple and just draw it.
        drawTextBackground(
          ctx,
          ts.backgroundStyle || 'solid_pill',
          bgX,
          bgY,
          bgW,
          bgH,
          ts.backgroundColor
        );
      }

      if (ts.shadow) {
        ctx.shadowColor = ts.shadowColor || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = ts.shadowBlur !== undefined ? ts.shadowBlur : 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'transparent';
      }

      // ── Per-unit cascade animation & enhanced text rendering ────────────
      const perUnit = ts.animation?.perUnit || 'all';
      const stagger = ts.animation?.stagger || 0.05;
      const revealWipeProgress = (clip as any).__revealWipeProgress;
      const letterSpacingProg = (clip as any).__letterSpacingProgress;
      const waveProgress = (clip as any).__waveProgress;
      const scrambleProgress = (clip as any).__scrambleProgress;
      const colorCycleTime = (clip as any).__colorCycleTime;

      // Prepare gradient fill if configured
      let textFillStyle: string | CanvasGradient = ts.color || '#ffffff';
      if (ts.gradientColors && ts.gradientColors.length >= 2) {
        const gDir = ts.gradientDirection || 'horizontal';
        const halfW = maxLineWidth / 2;
        const halfH = blockHeight / 2;
        let grad: CanvasGradient;
        if (gDir === 'vertical') {
          grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
        } else if (gDir === 'diagonal') {
          grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
        } else {
          grad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
        }
        ts.gradientColors.forEach((c: string, idx: number) => {
          grad.addColorStop(idx / (ts.gradientColors!.length - 1), c);
        });
        textFillStyle = grad;
      }

      // Apply color cycle hue rotation if active
      if (colorCycleTime !== undefined) {
        const hue = (colorCycleTime * 60) % 360;
        ctx.filter = `hue-rotate(${hue}deg)`;
      }

      // Reveal wipe: clip to a rect that expands left to right
      if (revealWipeProgress !== undefined) {
        ctx.save();
        const wipeW = (maxLineWidth + paddingX * 2) * revealWipeProgress;
        ctx.beginPath();
        ctx.rect(-(maxLineWidth / 2) - paddingX, -(blockHeight / 2) - paddingY, wipeW, blockHeight + paddingY * 2);
        ctx.clip();
      }

      const firstLineY = -(blockHeight / 2) + lineHeight / 2;

      // Determine if we need per-unit rendering
      const needsPerUnit = (perUnit !== 'all' && ts.animation && (ts.animation.in !== 'none' || ts.animation.out !== 'none'))
        || letterSpacingProg !== undefined
        || waveProgress !== undefined
        || scrambleProgress !== undefined;

      if (needsPerUnit) {
        // Per-character or per-word cascade rendering
        const inDuration = ts.animation?.inDuration || 0.5;
        const timeSinceStart = currentTime - clip.startTime;
        const timeUntilEnd = (clip.startTime + clip.duration) - currentTime;
        const outDuration = ts.animation?.outDuration || 0.5;
        const isInPhase = timeSinceStart < inDuration && timeSinceStart >= 0;
        const isOutPhase = timeUntilEnd < outDuration && timeUntilEnd >= 0;
        const globalProgress = isInPhase ? (timeSinceStart / inDuration) : (isOutPhase ? (1 - timeUntilEnd / outDuration) : 1);

        let unitIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineY = firstLineY + i * lineHeight;
          const lineText = lines[i];

          // Split line into units
          let units: { text: string; x: number; width: number }[] = [];
          const lineTextWidth = ctx.measureText(lineText).width;
          let cursorX = 0;
          if (textAlign === 'left') {
            cursorX = -(maxLineWidth / 2);
          } else if (textAlign === 'right') {
            cursorX = (maxLineWidth / 2) - lineTextWidth;
          } else {
            cursorX = -(lineTextWidth / 2);
          }

          if (perUnit === 'character' || letterSpacingProg !== undefined || waveProgress !== undefined || scrambleProgress !== undefined) {
            // Per-character
            if (letterSpacingProg !== undefined) {
              // Animated letter spacing: compress or expand
              const extraSpacing = (1 - letterSpacingProg) * textHeight * 0.3;
              const totalExtraWidth = extraSpacing * (lineText.length - 1);
              if (textAlign === 'left') {
                cursorX = -(maxLineWidth / 2);
              } else if (textAlign === 'right') {
                cursorX = (maxLineWidth / 2) - (lineTextWidth + totalExtraWidth);
              } else {
                cursorX = -((lineTextWidth + totalExtraWidth) / 2);
              }
              for (let c = 0; c < lineText.length; c++) {
                const ch = lineText[c];
                const chW = ctx.measureText(ch).width;
                units.push({ text: ch, x: cursorX + chW / 2, width: chW });
                cursorX += chW + extraSpacing;
              }
            } else {
              for (let c = 0; c < lineText.length; c++) {
                const ch = lineText[c];
                const chW = ctx.measureText(ch).width;
                units.push({ text: ch, x: cursorX + chW / 2, width: chW });
                cursorX += chW;
              }
            }
          } else {
            // Per-word
            const words = lineText.split(/(\s+)/);
            for (const word of words) {
              const wW = ctx.measureText(word).width;
              units.push({ text: word, x: cursorX + wW / 2, width: wW });
              cursorX += wW;
            }
          }

          for (const unit of units) {
            ctx.save();

            // Calculate staggered progress for this unit
            const totalUnits = lines.reduce((sum, l) => sum + (perUnit === 'character' ? l.length : l.split(/\s+/).length), 0);
            const totalAnimTime = inDuration;
            const unitAnimTime = Math.max(0.02, totalAnimTime - (totalUnits - 1) * stagger);
            const unitDelay = unitIndex * stagger;
            let unitProgress = 1;
            if (isInPhase) {
              unitProgress = Math.max(0, Math.min(1, (timeSinceStart - unitDelay) / unitAnimTime));
            } else if (isOutPhase) {
              unitProgress = Math.max(0, Math.min(1, 1 - (timeSinceStart - (clip.duration - outDuration) - unitDelay) / unitAnimTime));
            }

            // Wave animation: sinusoidal Y offset per character
            let waveOffsetY = 0;
            if (waveProgress !== undefined) {
              waveOffsetY = Math.sin((unitIndex * 0.5) + waveProgress * Math.PI * 4) * textHeight * 0.3 * (1 - waveProgress);
            }

            // Scramble: random characters resolving to correct text
            let renderText = unit.text;
            if (scrambleProgress !== undefined && scrambleProgress < 1) {
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
              if (Math.random() > scrambleProgress) {
                renderText = chars[Math.floor(Math.random() * chars.length)];
              }
            }

            // Apply per-unit animation transform
            const unitScale = perUnit !== 'all' ? unitProgress : 1;
            const unitOpacity = perUnit !== 'all' ? unitProgress : 1;

            ctx.globalAlpha *= unitOpacity;
            ctx.translate(unit.x, lineY + waveOffsetY);
            ctx.scale(unitScale, unitScale);

            // 3D text extrusion
            if (ts.threeD && ts.threeDDepth) {
              const depth = ts.threeDDepth || 3;
              const baseColor = ts.color || '#ffffff';
              for (let d = depth; d > 0; d--) {
                const shade = Math.max(0, 1 - d * 0.15);
                ctx.save();
                ctx.translate(d * 1.5, d * 1.5);
                ctx.fillStyle = `rgba(0,0,0,${shade * 0.6})`;
                ctx.fillText(renderText, 0, 0);
                ctx.restore();
              }
            }

            // Double stroke (sticker effect)
            if (ts.outerStrokeColor && ts.outerStrokeWidth) {
              ctx.strokeStyle = ts.outerStrokeColor;
              ctx.lineWidth = (ts.outerStrokeWidth || 4) + (ts.strokeWidth || 0);
              ctx.lineJoin = 'round';
              ctx.strokeText(renderText, 0, 0);
            }

            // Inner stroke
            if (ts.strokeColor && ts.strokeWidth) {
              ctx.strokeStyle = ts.strokeColor;
              ctx.lineWidth = ts.strokeWidth;
              ctx.lineJoin = 'round';
              ctx.strokeText(renderText, 0, 0);
            }

            // Fill text with gradient or solid color
            ctx.fillStyle = textFillStyle;
            ctx.fillText(renderText, 0, 0);

            ctx.restore();
            unitIndex++;
          }

          if (ts.underline) {
            let lineStartX = -lineTextWidth / 2;
            let lineEndX = lineTextWidth / 2;
            if (textAlign === 'left') {
              lineStartX = -maxLineWidth / 2;
              lineEndX = -maxLineWidth / 2 + lineTextWidth;
            } else if (textAlign === 'right') {
              lineStartX = maxLineWidth / 2 - lineTextWidth;
              lineEndX = maxLineWidth / 2;
            }
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.beginPath();
            ctx.strokeStyle = ts.color || '#ffffff';
            ctx.lineWidth = Math.max(1, textHeight / 15);
            const uY = lineY + textHeight * 0.45;
            ctx.moveTo(lineStartX, uY);
            ctx.lineTo(lineEndX, uY);
            ctx.stroke();
            ctx.restore();
          }
        }
      } else {
        // Standard whole-text rendering (original path)
        for (let i = 0; i < lines.length; i++) {
          const lineY = firstLineY + i * lineHeight;
          const lineText = lines[i];
          const lw = ctx.measureText(lineText).width;

          let lineAnchorX = 0;
          let lineStartX = -lw / 2;
          let lineEndX = lw / 2;

          if (textAlign === 'left') {
            lineAnchorX = -maxLineWidth / 2;
            lineStartX = -maxLineWidth / 2;
            lineEndX = -maxLineWidth / 2 + lw;
          } else if (textAlign === 'right') {
            lineAnchorX = maxLineWidth / 2;
            lineStartX = maxLineWidth / 2 - lw;
            lineEndX = maxLineWidth / 2;
          }

          // 3D text extrusion
          if (ts.threeD && ts.threeDDepth) {
            const depth = ts.threeDDepth || 3;
            for (let d = depth; d > 0; d--) {
              const shade = Math.max(0, 1 - d * 0.15);
              ctx.save();
              ctx.translate(d * 1.5, d * 1.5);
              ctx.fillStyle = `rgba(0,0,0,${shade * 0.6})`;
              ctx.fillText(lineText, lineAnchorX, lineY);
              ctx.restore();
            }
          }

          // Double stroke (sticker effect)
          if (ts.outerStrokeColor && ts.outerStrokeWidth) {
            ctx.strokeStyle = ts.outerStrokeColor;
            ctx.lineWidth = (ts.outerStrokeWidth || 4) + (ts.strokeWidth || 0);
            ctx.lineJoin = 'round';
            ctx.strokeText(lineText, lineAnchorX, lineY);
          }

          // Inner stroke
          if (ts.strokeColor && ts.strokeWidth) {
            ctx.strokeStyle = ts.strokeColor;
            ctx.lineWidth = ts.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.strokeText(lineText, lineAnchorX, lineY);
          }

          // Fill with gradient or solid
          ctx.fillStyle = textFillStyle;
          ctx.fillText(lineText, lineAnchorX, lineY);

          if (ts.underline) {
             ctx.save();
             ctx.shadowColor = 'transparent';
             ctx.beginPath();
             ctx.strokeStyle = ts.color || '#ffffff';
             ctx.lineWidth = Math.max(1, textHeight / 15);
             const uY = lineY + textHeight * 0.45;
             ctx.moveTo(lineStartX, uY);
             ctx.lineTo(lineEndX, uY);
             ctx.stroke();
             ctx.restore();
          }
        }
      }

      // Close reveal wipe clip
      if (revealWipeProgress !== undefined) {
        ctx.restore();
      }

      // Reset filter
      if (colorCycleTime !== undefined) {
        ctx.filter = 'none';
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
      if (active.from) transitionClipIds.add(active.from.id);
      if (active.to) transitionClipIds.add(active.to.id);
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
        // ── PIP Window Enter/Exit animation ─────────────────────────────────
        const pipEEMods = computeEnterExitModifiers(
          pip.enterExitAnimation, pipAbsStart, pip.duration, currentTime
        );

        // ── PIP Background + Shadow decoration (drawn BEFORE children) ──────
        const pipStyle = pip.style;
        if (pipStyle && (pipStyle.backgroundEnabled || pipStyle.shadowEnabled)) {
          drawQueue.push({
            clip: {
              __pipDecoration: 'background',
              __pipStyle: pipStyle,
              __pipParentTransform: parentClip.transform,
              __pipParentStartTime: parentClip.startTime,
              __pipParentAnimations: parentClip.animations,
              __pipEEMods: pipEEMods,
              id: `__pip_bg_${pip.id}`,
            },
            layer: 199, // Just below PIP children
          });
        }

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
                __parentOpacity: parentClip.opacity * pipEEMods.opacity,
                __parentCrop: parentClip.crop,
                __pipEEMods: pipEEMods,
              };
              drawQueue.push({ clip: syntheticClip, layer: 200 + (pTrack.type === 'text' ? 100 : 0) });
            }
          }
        }

        // ── PIP Outline decoration (drawn AFTER children) ───────────────────
        if (pipStyle && pipStyle.outlineEnabled) {
          drawQueue.push({
            clip: {
              __pipDecoration: 'outline',
              __pipStyle: pipStyle,
              __pipParentTransform: parentClip.transform,
              __pipParentStartTime: parentClip.startTime,
              __pipParentAnimations: parentClip.animations,
              __pipEEMods: pipEEMods,
              id: `__pip_outline_${pip.id}`,
            },
            layer: 301, // Above PIP children
          });
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
    bufferKey: string,
    blitCtx?: CanvasRenderingContext2D,
    bufScaleOverride?: number
  ) => {
    if (!layer.visible) return;

    // The buffer holds ONLY the frame region (W x H in local units), rendered at
    // the same device resolution the frame currently occupies so the layer is not
    // softened by a round-trip through a lower-res buffer.
    // PERF: capped at 1× device resolution — the buffer is blitted back at
    // W×H anyway, so super-sampling a moving blend is wasted fill rate. During
    // a transition BOTH clips render (plus their own media buffers), so a
    // transition frame costs ~2.5× a normal frame; this cap removes the two
    // super-sampled renders without any visible quality change.
    const bufScale = Math.min(1, Math.max(0.1, bufScaleOverride ?? (canvas_scale * viewport.zoom)));
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

    // ── Layer-local post passes (buffer holds ONLY this layer, so they are safe) ──
    // Motion blur for professional transitions (blurDissolve). Copy through a
    // second pooled buffer with a blur filter — device-space px must be in
    // buffer resolution, not frame units.
    if ((layer.blur ?? 0) > 0.0005) {
      const blurPx = Math.max(1, layer.blur! * buf.width);
      const blurBuf = getOrCreateCanvas(offscreenCanvasPool.current, bufferKey + '_blur', bufW, bufH);
      const bbctx = blurBuf.getContext('2d');
      if (bbctx) {
        bbctx.setTransform(1, 0, 0, 1, 0, 0);
        bbctx.clearRect(0, 0, blurBuf.width, blurBuf.height);
        bbctx.filter = `blur(${blurPx}px)`;
        bbctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, blurBuf.width, blurBuf.height);
        bbctx.filter = 'none';
        bctx.globalCompositeOperation = 'copy';
        bctx.drawImage(blurBuf, 0, 0);
        bctx.globalCompositeOperation = 'source-over';
      }
    }

    // Soft wipe edge: the plan carries a hard clipRect PLUS a feather radius.
    // With a feather we punch the edge out of the layer buffer with a gradient
    // mask (shared helper — export uses the identical routine) and skip the
    // hard clip at blit time.
    const hasFeatheredRect = !!layer.clipRect && (layer.clipFeather ?? 0) > 0.0005;
    if (hasFeatheredRect) {
      // bctx is in identity space here (setTransform above, restores balanced).
      applyFeatheredRectMask(bctx, layer.clipRect!, layer.clipFeather!, buf.width, buf.height);
    }

    // Particle trail MUST snapshot the buffer BEFORE the erosion mask below
    // punches the detached cells out of it — otherwise the flying particles
    // would have no pixels. The masked main layer + drifting band copies on
    // top is what makes pixels visibly flow through the air.
    const trailBufs: HTMLCanvasElement[] = [];
    if (layer.noiseTrail && layer.noiseTrail.center > 0.02 && layer.noiseTrail.center < 0.98) {
      const tr = layer.noiseTrail;
      for (let k = 1; k <= 2; k++) {
        const trailBuf = getOrCreateCanvas(offscreenCanvasPool.current, bufferKey + '_trail' + k, bufW, bufH);
        const tctx = trailBuf.getContext('2d');
        if (!tctx) break;
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.clearRect(0, 0, trailBuf.width, trailBuf.height);
        tctx.drawImage(buf, 0, 0);
        applyNoiseBandMask(tctx, tr.center, 0.09, tr.cell, trailBuf.width, trailBuf.height);
        trailBufs.push(trailBuf);
      }
    }

    // Particle dissolve reveal: punch the deterministic hash-noise mask out of
    // the layer buffer (shared worker-safe helper — identical mask in export).
    if (layer.noiseReveal) {
      applyNoiseRevealMask(bctx, layer.noiseReveal.amount, layer.noiseReveal.cell, buf.width, buf.height, !!layer.noiseReveal.invert);
    }

    // Blit the finished layer with the transition's geometry + alpha. `blitCtx`
    // (or the main frame ctx) is already in local frame space, so we work in
    // W/H units throughout.
    const outCtx = blitCtx || ctx;
    outCtx.save();
    outCtx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

    if (layer.clipRect && !hasFeatheredRect) {
      const r = layer.clipRect;
      outCtx.beginPath();
      outCtx.rect(r.x * W, r.y * H, r.w * W, r.h * H);
      outCtx.clip();
    }
    if (layer.clipCircle && layer.clipCircle.r > 0.0001) {
      const cc = layer.clipCircle;
      outCtx.beginPath();
      outCtx.arc(cc.x * W, cc.y * H, cc.r * W, 0, Math.PI * 2);
      outCtx.clip();
    }
    if (layer.clipWedge && layer.clipWedge.angle < Math.PI * 2 - 0.0001) {
      const wd = layer.clipWedge;
      outCtx.beginPath();
      outCtx.moveTo(wd.cx * W, wd.cy * H);
      // From 12 o'clock (-π/2) sweeping clockwise; overshoot the corners.
      outCtx.arc(wd.cx * W, wd.cy * H, Math.max(W, H) * 1.2, -Math.PI / 2, -Math.PI / 2 + wd.angle);
      outCtx.closePath();
      outCtx.clip();
    }

    // Geometry is expressed in frame fractions, so it is resolution independent.
    const cxF = W / 2;
    const cyF = H / 2;
    outCtx.translate(cxF + layer.translateX * W, cyF + layer.translateY * H);
    if (layer.rotation) outCtx.rotate(layer.rotation);
    const sx = layer.scale * (layer.scaleX ?? 1);
    const sy = layer.scale * (layer.scaleY ?? 1);
    if (sx !== 1 || sy !== 1) outCtx.scale(sx, sy);
    outCtx.translate(-cxF, -cyF);

    if (layer.slices && layer.slices.spread > 0.0005) {
      // Disassemble/Assemble: draw the layer strip-by-strip; adjacent strips
      // offset perpendicular with alternating direction. +1px overlap hides
      // seams at strip boundaries.
      const { count, axis, spread } = layer.slices;
      const n = Math.max(2, Math.round(count));
      for (let i = 0; i < n; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        if (axis === 'x') {
          const bw = buf.width / n;
          const off = dir * spread * H;
          outCtx.drawImage(buf, i * bw, 0, Math.ceil(bw) + 1, buf.height,
            (i * W) / n, off, W / n + 1, H);
        } else {
          const bh = buf.height / n;
          const off = dir * spread * W;
          outCtx.drawImage(buf, 0, i * bh, buf.width, Math.ceil(bh) + 1,
            off, (i * H) / n, W, H / n + 1);
        }
      }
    } else {
      outCtx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, W, H);
    }
    outCtx.restore();

    // ── In-air particle trail (particleDissolve) ───────────────────────────
    // The cells at the dissolve FRONT detach and fly with the wind: two extra
    // passes draw band-masked copies of the layer, offset by wind×k and fading,
    // so the pixels visibly travel through the air before disappearing.
    if (layer.noiseTrail && trailBufs.length > 0) {
      const tr = layer.noiseTrail;
      for (let k = 1; k <= trailBufs.length; k++) {
        outCtx.save();
        outCtx.globalAlpha = Math.max(0, Math.min(1, layer.opacity)) * (k === 1 ? 0.8 : 0.45);
        outCtx.translate(tr.windX * k * W, tr.windY * k * H);
        if (k === 2) {
          const shrink = 0.96;
          outCtx.translate(cxF, cyF);
          outCtx.scale(shrink, shrink);
          outCtx.translate(-cxF, -cyF);
        }
        const trailBuf = trailBufs[k - 1];
        outCtx.drawImage(trailBuf, 0, 0, trailBuf.width, trailBuf.height, 0, 0, W, H);
        outCtx.restore();
      }
    }
  };

  /** Draw a transition overlay (flat colour OR directional gradient band). */
  const drawTransitionOverlay = (
    octx: CanvasRenderingContext2D,
    overlay: OverlayDraw,
    oW: number,
    oH: number
  ) => {
    if (overlay.type === 'color' && overlay.alpha > 0.001) {
      octx.save();
      octx.globalAlpha = Math.min(1, overlay.alpha);
      octx.fillStyle = overlay.color;
      octx.fillRect(0, 0, oW, oH);
      octx.restore();
    } else if (overlay.type === 'edgeGradient' && overlay.alpha > 0.001 && overlay.rect) {
      const r = overlay.rect;
      const x = r.x * oW, y = r.y * oH, w = r.w * oW, h = r.h * oH;
      let g: CanvasGradient;
      switch (overlay.gradientDir) {
        case 'right': g = octx.createLinearGradient(x, 0, x + w, 0); break;
        case 'up':    g = octx.createLinearGradient(0, y + h, 0, y); break;
        case 'down':  g = octx.createLinearGradient(0, y, 0, y + h); break;
        case 'left':
        default:      g = octx.createLinearGradient(x + w, 0, x, 0); break;
      }
      g.addColorStop(0, overlay.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.save();
      octx.globalAlpha = Math.min(1, overlay.alpha);
      octx.fillStyle = g;
      octx.fillRect(x, y, w, h);
      octx.restore();
    }
  };

  /** Render a full clip-to-clip transition (both layers + overlay + post effect). */
  const drawTransition = async (active: ActiveTransition) => {
    const plan = buildTransitionPlan(active);
    anyClipDrawn = true;

    if (plan.postEffect !== 'none' && plan.postEffectAmount > 0.001) {
      // Pixel post-effect (rgbSplit / pixelate): render the whole transition
      // composite into a full-frame scratch buffer, apply the pixel effect to
      // the buffer (putImageData ignores transforms and works in device pixels
      // — the composite ctx is in transformed frame space), then blit back.
      const bufScale = Math.min(1, Math.max(0.1, canvas_scale * viewport.zoom));
      const bufW = Math.max(1, Math.round(W * bufScale));
      const bufH = Math.max(1, Math.round(H * bufScale));
      const postBuf = getOrCreateCanvas(offscreenCanvasPool.current, '__transition_post', bufW, bufH);
      const pctx = postBuf.getContext('2d');
      if (pctx) {
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, postBuf.width, postBuf.height);
        pctx.save();
        pctx.scale(bufScale, bufScale);
        if (active.from && plan.from.visible) {
          await drawTransitionLayer(active.from, plan.from, '__transition_from', pctx as CanvasRenderingContext2D, bufScale);
        }
        if (active.to && plan.to.visible) {
          await drawTransitionLayer(active.to, plan.to, '__transition_to', pctx as CanvasRenderingContext2D, bufScale);
        }
        drawTransitionOverlay(pctx as CanvasRenderingContext2D, plan.overlay, W, H);
        pctx.restore();
        applyTransitionPostEffect(pctx as CanvasRenderingContext2D, postBuf.width, postBuf.height, plan.postEffect, plan.postEffectAmount);
        ctx.drawImage(postBuf, 0, 0, postBuf.width, postBuf.height, 0, 0, W, H);
      }
      return;
    }

    if (active.from && plan.from.visible) {
      await drawTransitionLayer(active.from, plan.from, '__transition_from');
    }
    if (active.to && plan.to.visible) {
      await drawTransitionLayer(active.to, plan.to, '__transition_to');
    }

    drawTransitionOverlay(ctx, plan.overlay, W, H);
  };

  // Render clips sequentially to guarantee correct Z-index order and prevent Canvas 2D
  // context state corruption (since drawSingleClip can yield on async operations like masks/AI).
  // Note: JavaScript is single-threaded, so Promise.all does not parallelize CPU-bound Canvas
  // drawing anyway; it merely interleaves execution, which corrupts the shared `ctx` state stack.
  for (const item of drawQueue) {
    if (item.clip.__transition) {
      await drawTransition(item.clip.__transition as ActiveTransition);
    } else if (item.clip.__pipDecoration) {
      // ── PIP window decoration rendering (background / outline / shadow) ──
      const dec = item.clip.__pipDecoration as string;
      const style = item.clip.__pipStyle;
      const pt = item.clip.__pipParentTransform;
      const pStart = item.clip.__pipParentStartTime ?? 0;
      const pAnims = item.clip.__pipParentAnimations;
      const eeMod: EnterExitModifiers = item.clip.__pipEEMods || { opacity: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0, blur: 0 };

      if (style && pt) {
        ctx.save();

        // Apply parent clip's transform (same as PiP children)
        const pX = getAnimatedValue(pt.x ?? 0, currentTime, pStart, pAnims?.['transform.x']);
        const pY = getAnimatedValue(pt.y ?? 0, currentTime, pStart, pAnims?.['transform.y']);
        const pScale = getAnimatedValue(pt.scale ?? 100, currentTime, pStart, pAnims?.['transform.scale']);
        const pRot = getAnimatedValue(pt.rotation ?? 0, currentTime, pStart, pAnims?.['transform.rotation']);

        const cx = W / 2;
        const cy = H / 2;

        // Enter/exit translate
        ctx.translate(cx + pX + eeMod.translateX * W, cy + pY + eeMod.translateY * H);
        ctx.rotate((pRot * Math.PI) / 180 + eeMod.rotation);
        const ps = ((pScale || 100) / 100) * eeMod.scale;
        if (ps !== 1) ctx.scale(ps, ps);
        ctx.translate(-cx, -cy);

        // The decoration rectangle covers the full frame (PIP children are positioned relative to it)
        const pad = style.backgroundPadding || 0;
        const radius = style.outlineRadius || 0;
        const rx = -pad;
        const ry = -pad;
        const rw = W + pad * 2;
        const rh = H + pad * 2;

        if (dec === 'background') {
          // Shadow
          if (style.shadowEnabled) {
            ctx.shadowColor = style.shadowColor || '#000000';
            ctx.shadowBlur = style.shadowBlur || 10;
            ctx.shadowOffsetX = style.shadowOffsetX || 4;
            ctx.shadowOffsetY = style.shadowOffsetY || 4;
          }

          // Background fill
          if (style.backgroundEnabled) {
            ctx.globalAlpha = ((style.backgroundOpacity ?? 50) / 100) * eeMod.opacity;
            ctx.fillStyle = style.backgroundColor || '#000000';
            ctx.beginPath();
            if (radius > 0) {
              ctx.roundRect(rx, ry, rw, rh, radius);
            } else {
              ctx.rect(rx, ry, rw, rh);
            }
            ctx.fill();
          }

          // Reset shadow for subsequent draws
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        if (dec === 'outline') {
          ctx.globalAlpha = ((style.outlineOpacity ?? 100) / 100) * eeMod.opacity;
          ctx.strokeStyle = style.outlineColor || '#ffffff';
          ctx.lineWidth = style.outlineWidth || 3;
          ctx.beginPath();
          if (radius > 0) {
            ctx.roundRect(rx, ry, rw, rh, radius);
          } else {
            ctx.rect(rx, ry, rw, rh);
          }
          ctx.stroke();
        }

        ctx.restore();
      }
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
    for (const track of [...visualTracks, ...fxTracks]) {
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

  // ── FX track effects (full-frame shader pass) ──────────────────────────────
  // FX-track clips are timeline shaders (Glitch, VHS, Cinematic Bars, Old Film,
  // …) that apply over the WHOLE composited frame rather than a single clip's
  // pixels. At this point `ctx` is back at identity transform and the composite
  // holds the fully rendered frame, so run each active FX clip's shader across
  // the full canvas — matching the export Compositor's full-frame FX pass.
  if (!skipExpensiveFX) {
    // 1. Clips on visual tracks with attached FX sub-tracks (clip.fxSettings)
    for (const track of tracks) {
      if (track.type === 'fx' || track.hidden || track.muted) continue;
      for (const clip of track.clips) {
        if (clip.disabled || !clip.fxSettings) continue;
        if (clip.fxSettings.enabled === false) continue;
        if ((clip.fxSettings.intensity ?? 100) <= 0) continue;
        if (currentTime < clip.startTime || currentTime >= clip.startTime + clip.duration + 0.001) continue;

        const fxIntensity = clip.fxSettings.intensity ?? 100;
        const fxRelTime = Math.max(0, currentTime - clip.startTime);

        // Custom HTML/CSS FX: render via cached SceneStage pipeline
        if (clip.fxSettings.type === 'custom_html' && clip.fxSettings.customHtmlCss) {
          const cacheKey = clip.id;
          const htmlHash = _simpleHash(clip.fxSettings.customHtmlCss);
          let cached = _customFxStageCache.get(cacheKey);
          if (!cached || cached.htmlHash !== htmlHash) {
            if (cached) destroySceneStage(cached.stage);
            const stage = createSceneStage(clip.fxSettings.customHtmlCss, {
              width: composite.width, height: composite.height, transparent: true,
            });
            if (stage) {
              const seekMode = stage.hasAnimations ? 'css' : 'static';
              cached = { stage, seekMode, htmlHash };
              _customFxStageCache.set(cacheKey, cached);
            }
          }
          if (cached) {
            try {
              await captureSceneFrame(cached.stage, composite, fxRelTime, cached.seekMode);
            } catch (e) {
              console.warn('[CanvasRenderingEngine] Custom FX render error:', e);
            }
          }
        } else {
          applyFxEffect(ctx, composite.width, composite.height, clip.fxSettings.type, fxIntensity, fxRelTime, isPlaying, clip.fxSettings);
        }
      }
    }

    // 2. Legacy FX tracks
    for (const track of fxTracks) {
      if (track.hidden) continue;
      // If this FX track is linked to a video track, respect the host track's hidden/muted state
      if (track.linkedTrackId) {
        const hostTrack = tracks.find((t) => t.id === track.linkedTrackId);
        if (hostTrack && (hostTrack.hidden || hostTrack.muted)) {
          continue;
        }
      }
      for (const clip of track.clips) {
        if (clip.disabled || !clip.fxSettings) continue;
        if (currentTime < clip.startTime || currentTime >= clip.startTime + clip.duration + 0.001) continue;
        // If the FX clip is linked to a specific clip, skip if that host clip is disabled
        if (clip.linkedClipId) {
          let hostClipFound = false;
          let hostClipDisabled = false;
          for (const t of tracks) {
            const hc = t.clips.find((c) => c.id === clip.linkedClipId);
            if (hc) {
              hostClipFound = true;
              hostClipDisabled = !!hc.disabled;
              break;
            }
          }
          if (hostClipFound && hostClipDisabled) {
            continue;
          }
        }
        const fxIntensity = clip.fxSettings.intensity ?? 100;
        const fxRelTime = Math.max(0, currentTime - clip.startTime);
        // Custom HTML/CSS FX: render via cached SceneStage pipeline
        if (clip.fxSettings.type === 'custom_html' && clip.fxSettings.customHtmlCss) {
          const cacheKey = clip.id;
          const htmlHash = _simpleHash(clip.fxSettings.customHtmlCss);
          let cached = _customFxStageCache.get(cacheKey);
          if (!cached || cached.htmlHash !== htmlHash) {
            if (cached) destroySceneStage(cached.stage);
            const stage = createSceneStage(clip.fxSettings.customHtmlCss, {
              width: composite.width, height: composite.height, transparent: true,
            });
            if (stage) {
              const seekMode = stage.hasAnimations ? 'css' : 'static';
              cached = { stage, seekMode, htmlHash };
              _customFxStageCache.set(cacheKey, cached);
            }
          }
          if (cached) {
            try {
              await captureSceneFrame(cached.stage, composite, fxRelTime, cached.seekMode);
            } catch (e) {
              console.warn('[CanvasRenderingEngine] Custom FX render error:', e);
            }
          }
        } else {
          applyFxEffect(ctx, composite.width, composite.height, clip.fxSettings.type, fxIntensity, fxRelTime, isPlaying, clip.fxSettings);
        }
      }
    }
  }

  // PERF: getContext is idempotent but the lookup isn't free — on mobile this
  // shaves ~0.5ms per frame. Cache via a property on the canvas element.
  let mainCtx: CanvasRenderingContext2D | null = (canvas as any)._cachedCtx2d;
  if (!mainCtx) {
    mainCtx = canvas.getContext('2d');
    (canvas as any)._cachedCtx2d = mainCtx;
  }
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
