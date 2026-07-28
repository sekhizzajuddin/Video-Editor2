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
import { formatTime } from '@/utils/time';
import { applyLutToCanvas } from '@/utils/lutParser';
import { applyAiBackgroundMask, applySubjectNeonOutlineFlash } from '@/utils/aiBackground';
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
  ParticlePool,
  LocalCornerPoints
} from '@/utils/canvasEffects';
import { MediaPlaybackResult } from '@/hooks/useMediaPlayback';
import { getClipDimensions } from './previewMath';

export interface RenderCanvasParams {
  canvas: HTMLCanvasElement;
  compositeCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  offscreenCanvasPool: React.MutableRefObject<Map<string, HTMLCanvasElement>>;
  particlePoolsRef: React.MutableRefObject<Map<string, ParticlePool>>;
  lastParticleTimeRef: React.MutableRefObject<number | null>;
  lastFrameCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
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

const MAX_POOL_CANVASES = 12;

export function getOrCreateCanvas(
  offscreenPool: Map<string, HTMLCanvasElement>,
  key: string,
  w: number,
  h: number
): HTMLCanvasElement {
  let canvas = offscreenPool.get(key);
  if (!canvas) {
    if (offscreenPool.size >= MAX_POOL_CANVASES) {
      const firstKey = offscreenPool.keys().next().value;
      if (firstKey && firstKey !== 'composite') {
        offscreenPool.delete(firstKey);
      }
    }
    canvas = document.createElement('canvas');
    offscreenPool.set(key, canvas);
  } else {
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
  const previewQuality = settings?.previewQuality ?? useEditorStore.getState().settings?.previewQuality ?? 'full';
  const previewMode = settings?.previewMode ?? useEditorStore.getState().settings?.previewMode ?? 'auto';
  // Phase 3 Theme A2: Quality-2/3 Short-Circuit Integration for granular preview-mode gating.
  const isAutoFast =
    previewMode === 'auto' &&
    isPlaying &&
    (tracks.length > 5 || tracks.some(t => t.clips.some(c => !c.disabled && (c.chromaKey?.enabled || c.lutFilter?.mediaId || c.aiBackground?.enabled || c.objectRemoval?.enabled))));
  const skipExpensiveFX = !isExporting && isPlaying && (previewMode === 'fast' || isAutoFast || previewQuality === 'quarter');
  const skipUltraHeavyFX = !isExporting && isPlaying && (previewMode === 'fast' || isAutoFast || previewQuality === 'quarter' || previewQuality === 'half');

  const now = performance.now();
  const lastTime = lastParticleTimeRef.current ?? now;
  lastParticleTimeRef.current = now;
  let rawDelta = 0;
  if (isPlaying && lastParticleTimeRef.current !== null) {
    rawDelta = now - lastTime;
    if (rawDelta > 300) {
      rawDelta = 16.67;
    }
  }
  const deltaMs = Math.min(100, rawDelta);

  const W_target = 854;
  const H_target = 480;
  const canvas_scale = canvas.width / W_target;
  // DOWNSCALE was previously 0.5 during playback for performance, but this caused
  // mask rendering bugs (destination-in compositing at half-resolution coordinates
  // produced smaller-than-expected clipped output). With GPU acceleration restored
  // (no willReadFrequently on composite canvas), full-res rendering is fast enough.
  const DOWNSCALE = 1.0;

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

    let aOpacity = getAnimatedValue(clip.opacity, currentTime, clip.startTime, clip.animations?.['opacity']);
    const localTime = currentTime - clip.startTime;

    let aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
    let aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
    let aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
    const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

    // ── Per-Aspect-Ratio Custom Framing Overrides ────────────────────────
    const perRatioFramingState = useEditorStore.getState().perRatioFraming;
    const perRatioFramingEnabled = useEditorStore.getState().perRatioFramingEnabled;
    const currentAspectRatio = useEditorStore.getState().aspectRatio;

    if (perRatioFramingEnabled && perRatioFramingState[currentAspectRatio]?.[clip.id]) {
      const customFraming = perRatioFramingState[currentAspectRatio][clip.id];
      if (customFraming.x !== undefined) aX += customFraming.x;
      if (customFraming.y !== undefined) aY += customFraming.y;
      if (customFraming.scale !== undefined) aScale *= (customFraming.scale / 100);
    }

    const aCropTop = getAnimatedValue(clip.crop?.top || 0, currentTime, clip.startTime, clip.animations?.['crop.top']);
    const aCropBot = getAnimatedValue(clip.crop?.bottom || 0, currentTime, clip.startTime, clip.animations?.['crop.bottom']);
    const aCropLeft = getAnimatedValue(clip.crop?.left || 0, currentTime, clip.startTime, clip.animations?.['crop.left']);
    const aCropRight = getAnimatedValue(clip.crop?.right || 0, currentTime, clip.startTime, clip.animations?.['crop.right']);

    const aRotX = getAnimatedValue(clip.transform.rotationX ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationX']);
    const aRotY = getAnimatedValue(clip.transform.rotationY ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationY']);

    const hasPerspectiveWarp = !!(clip.transform.perspectivePin || Math.abs(aRotX) > 0.01 || Math.abs(aRotY) > 0.01);
    const aBlendIntensity = Math.max(0, Math.min(100, getAnimatedValue(clip.transform.blendIntensity ?? 100, currentTime, clip.startTime, clip.animations?.['transform.blendIntensity'])));
    const blendMode = clip.transform.blendMode || 'source-over';
    const totalAlpha = aOpacity * opacityMultiplier;
    const needsDualBlend = blendMode !== 'source-over' && aBlendIntensity < 100;

    ctx.save();
    ctx.globalAlpha = totalAlpha * (aBlendIntensity / 100);
    ctx.globalCompositeOperation = blendMode;

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
        const vw = mediaItem.width || 854;
        const vh = mediaItem.height || 480;
        const fitScale = Math.min(W / vw, H / vh);
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
      temperature: getAnimatedValue(clip.colorFilters?.temperature ?? 0, currentTime, clip.startTime, clip.animations?.['color.temperature']),
      tint: getAnimatedValue(clip.colorFilters?.tint ?? 0, currentTime, clip.startTime, clip.animations?.['color.tint']),
      exposure: getAnimatedValue(clip.colorFilters?.exposure ?? 0, currentTime, clip.startTime, clip.animations?.['color.exposure']) + fxFlashBrightness,
      contrast: getAnimatedValue(clip.colorFilters?.contrast ?? 100, currentTime, clip.startTime, clip.animations?.['color.contrast']),
      saturation: getAnimatedValue(clip.colorFilters?.saturation ?? 100, currentTime, clip.startTime, clip.animations?.['color.saturation']),
      blur: getAnimatedValue(clip.colorFilters?.blur ?? 0, currentTime, clip.startTime, clip.animations?.['color.blur']),
      fadedFilm: getAnimatedValue(clip.colorFilters?.fadedFilm ?? 0, currentTime, clip.startTime, clip.animations?.['color.fadedFilm']),
      vignette: getAnimatedValue(clip.colorFilters?.vignette ?? 0, currentTime, clip.startTime, clip.animations?.['color.vignette']),
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
          const offCanvasKey = `clip_${clip.id}_${Math.round(dw)}x${Math.round(dh)}`;
          const prefix = `clip_${clip.id}_`;
          for (const k of offscreenCanvasPool.current.keys()) {
            if (k.startsWith(prefix) && k !== offCanvasKey) {
              offscreenCanvasPool.current.delete(k);
            }
          }
          const offCanvas = getOrCreateCanvas(offscreenCanvasPool.current, offCanvasKey, dw * DOWNSCALE, dh * DOWNSCALE);
          const oCtx = offCanvas.getContext('2d')!;
          oCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

          oCtx.save();
          oCtx.scale(DOWNSCALE, DOWNSCALE);

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
          const odx = cLeft * dw;
          const ody = cTop * dh;
          const odw = dw * (1 - cLeft - cRight);
          const odh = dh * (1 - cTop - cBot);

          oCtx.drawImage(sourceElement, sx, sy, sw, sh, odx, ody, odw, odh);
          if (hasFilters) {
            oCtx.filter = 'none';
          }

          if (!skipExpensiveFX) {
            if (clip.aiBackground?.enabled && !skipUltraHeavyFX) {
              const animEdgeBlur = getAnimatedValue(clip.aiBackground.edgeBlur ?? 0, currentTime, clip.startTime, clip.animations?.['aiBackground.edgeBlur']);
              await applyAiBackgroundMask(
                oCtx,
                offCanvas.width,
                offCanvas.height,
                sourceElement,
                animEdgeBlur,
                clip.aiBackground.modelSelection ?? 0
              );
            }
            if (clip.chromaKey?.enabled) {
              const animThresh = getAnimatedValue(clip.chromaKey.threshold, currentTime, clip.startTime, clip.animations?.['chromaKey.threshold']);
              const animSoft = getAnimatedValue(clip.chromaKey.softness, currentTime, clip.startTime, clip.animations?.['chromaKey.softness']);
              const animSpill = getAnimatedValue(clip.chromaKey.spillSuppression ?? 0, currentTime, clip.startTime, clip.animations?.['chromaKey.spillSuppression']);
              const animFeather = getAnimatedValue(clip.chromaKey.edgeFeather ?? 0, currentTime, clip.startTime, clip.animations?.['chromaKey.edgeFeather']);
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
              const animThresh = getAnimatedValue(clip.lumaKey.threshold, currentTime, clip.startTime, clip.animations?.['lumaKey.threshold']);
              const animSoft = getAnimatedValue(clip.lumaKey.softness, currentTime, clip.startTime, clip.animations?.['lumaKey.softness']);
              applyLumaKeyOnData(
                oCtx,
                offCanvas.width,
                offCanvas.height,
                clip.lumaKey.type,
                animThresh,
                animSoft
              );
            }
            if (clip.objectRemoval?.enabled) {
              const useDownscaledPreview = (skipUltraHeavyFX || previewMode === 'fast') && clip.objectRemoval.quality === 'preview';
              if (!useDownscaledPreview && !skipUltraHeavyFX) {
                applyObjectRemoval(
                  oCtx,
                  offCanvas.width,
                  offCanvas.height,
                  clip.objectRemoval,
                  currentTime,
                  clip.startTime,
                  offCanvas,
                  clip.animations
                );
              } else if (useDownscaledPreview) {
                // Downscale 2x pass for fast interactive preview of object removal
                const previewW = Math.max(1, offCanvas.width >> 1);
                const previewH = Math.max(1, offCanvas.height >> 1);
                const tmp = getOrCreateCanvas(offscreenCanvasPool.current, `objr_${clip.id}_preview`, previewW, previewH);
                const tctx = tmp.getContext('2d');
                if (tctx) {
                  tctx.clearRect(0, 0, previewW, previewH);
                  tctx.drawImage(offCanvas, 0, 0, previewW, previewH);
                  applyObjectRemoval(
                    tctx,
                    previewW,
                    previewH,
                    clip.objectRemoval,
                    currentTime,
                    clip.startTime,
                    tmp,
                    clip.animations
                  );
                  oCtx.imageSmoothingEnabled = true;
                  oCtx.drawImage(tmp, 0, 0, offCanvas.width, offCanvas.height);
                }
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
            if (filters.temperature !== 0 || filters.tint !== 0 || filters.fadedFilm !== 0 || filters.vignette !== 0) {
              applyColorOverlays(oCtx, 0, 0, offCanvas.width, offCanvas.height, filters);
            }
            const lutData = useEditorStore.getState().mediaLibrary.find(
              (m) => m.id === (clip.lut?.mediaId || clip.lutFilter?.mediaId)
            )?.lutData;
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
          }

          if (clip.mask?.enabled) {
            // With DOWNSCALE=1.0, offCanvas dimensions match logical dimensions,
            // so the mask can be applied directly without transform manipulation.
            await applyClipMaskOffscreen(oCtx, clip.mask, offCanvas.width, offCanvas.height, clip.id, clip.startTime, clip.animations);
          } else {
            offscreenCanvasPool.current.delete('clip_mask_temp_' + clip.id);
          }

          oCtx.restore();

          if (needsDualBlend) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = totalAlpha * (1 - (aBlendIntensity / 100));
            if (corners) {
              drawPerspectiveTexture(ctx, offCanvas, corners);
            } else {
              ctx.drawImage(offCanvas, dx, dy, dw, dh);
            }
            ctx.restore();
          }

          if (corners) {
            drawPerspectiveTexture(ctx, offCanvas, corners);
          } else {
            ctx.drawImage(offCanvas, dx, dy, dw, dh);
          }

          if (clip.fxSettings?.type === 'subject_outline_flash') {
            const sourceEl = videoEl || imageEl || offCanvas;
            if (sourceEl) {
              await applySubjectNeonOutlineFlash(
                ctx,
                W,
                H,
                sourceEl,
                {
                  color: clip.fxSettings.outlineColor || '#00f0ff',
                  strokeWidth: clip.fxSettings.outlineWidth || 3,
                  glowBlur: clip.fxSettings.glowBlur || 14,
                  flashSpeed: clip.fxSettings.strobeSpeed || 8,
                  currentTime: currentTime
                }
              );
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

      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * animOpacity;
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
    }

    ctx.restore();
  };

  const drawQueue: { clip: any; layer: number }[] = [];
  for (const track of visualTracks) {
    for (const clip of track.clips) {
      if (!clip.disabled && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        drawQueue.push({ clip, layer: track.id.startsWith('text') ? 100 : 0 });
      }
    }
  }

  // Also collect active clips inside PiP Windows attached to active timeline clips
  const activePipWindows = useEditorStore.getState().pipWindows || {};
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
      if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
        for (const pTrack of pip.tracks) {
          if (pTrack.hidden) continue;
          for (const pClip of pTrack.clips) {
            const pAbsStart = pipAbsStart + pClip.startTime;
            if (!pClip.disabled && currentTime >= pAbsStart && currentTime < pAbsStart + pClip.duration) {
              const syntheticClip = {
                ...pClip,
                startTime: pAbsStart,
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

  for (const item of drawQueue) {
    if (isPlaying) {
      drawSingleClip(item.clip);
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
        if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
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
