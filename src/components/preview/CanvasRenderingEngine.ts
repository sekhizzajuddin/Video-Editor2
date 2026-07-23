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
import { FrameCacheEntry } from '@/hooks/useMediaPlayback';
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
    frameCache: Map<string, FrameCacheEntry[]>;
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

export function getOrCreateCanvas(
  offscreenPool: Map<string, HTMLCanvasElement>,
  key: string,
  w: number,
  h: number
): HTMLCanvasElement {
  let canvas = offscreenPool.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    offscreenPool.set(key, canvas);
  }
  if (Math.abs(canvas.width - w) > 0.5) canvas.width = Math.max(1, Math.round(w));
  if (Math.abs(canvas.height - h) > 0.5) canvas.height = Math.max(1, Math.round(h));
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
    frameCache: frameCacheRaw,
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
  const frameCache = frameCacheRaw as Map<string, FrameCacheEntry[]>;
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
  const skipExpensiveFX = isPlaying;

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

      // For video clips when NOT playing: always try to use the closest cached ImageBitmap.
      // This is critical for smooth scrubbing — the cached bitmap is available instantly
      // while the HTML5 video element may still be mid-seek (async decoder).
      let cachedBitmap: ImageBitmap | null = null;
      if (mediaItem.type === 'video' && !isPlaying) {
        const clipCache = frameCache.get(clip.id);
        if (clipCache && clipCache.length > 0) {
          const mediaTime = getMediaTimeForClip({
            id: clip.id, startTime: clip.startTime,
            duration: clip.duration, trimStart: clip.trimStart,
            speed: clip.speed, speedRamp: (clip as any).speedRamp
          }, currentTime);
          const roundedTime = Math.round(mediaTime * 30) / 30;

          let bestFrame: FrameCacheEntry | null = null;
          let minDiff = Infinity;
          for (const f of clipCache) {
            const diff = Math.abs(f.time - roundedTime);
            if (diff < minDiff) {
              minDiff = diff;
              bestFrame = f;
            }
          }

          if (bestFrame) {
            // Use the cached frame when:
            // - video is still seeking (async decoder hasn't finished)
            // - video readyState is too low (no decoded frame available)
            // - cached frame is closer to the target time than the video's current position
            const videoReady = videoEl && videoEl.readyState >= 2 && !videoEl.seeking;
            const videoDrift = videoEl ? Math.abs(videoEl.currentTime - mediaTime) : Infinity;
            if (!videoReady || minDiff <= videoDrift) {
              cachedBitmap = bestFrame.bitmap;
              // Only use bitmap dimensions if we don't already have video element dimensions.
              // Using bitmap dimensions when the video element already provided them would cause
              // size mismatches (the 'objects shrink automatically' bug) because bitmaps may be
              // captured at a different resolution than the video's native dimensions.
              if (!hasRealMedia) {
                vw = bestFrame.bitmap.width;
                vh = bestFrame.bitmap.height;
              }
              hasRealMedia = true;
            }
          }
        }
      }

      const scaleToFit = Math.min(W / vw, H / vh);
      dw = vw * scaleToFit;
      dh = vh * scaleToFit;
      dx = -dw / 2;
      dy = -dh / 2;

      if (hasRealMedia) {
        anyClipDrawn = true;
        let sourceElement: CanvasImageSource = cachedBitmap
          ? cachedBitmap
          : (mediaItem.type === 'video' ? videoEl : imageEl)!;

        const clipW = dw * (1 - cLeft - cRight);
        const clipH = dh * (1 - cTop - cBot);

        if (clipW > 0 && clipH > 0) {
          const offCanvasKey = `clip_${clip.id}_${Math.round(dw)}x${Math.round(dh)}`;
          const offCanvas = getOrCreateCanvas(offscreenCanvasPool.current, offCanvasKey, dw * DOWNSCALE, dh * DOWNSCALE);
          const oCtx = offCanvas.getContext('2d', { willReadFrequently: true })!;
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

          if (cssFilters.length > 0) {
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
          oCtx.filter = 'none';

          if (!skipExpensiveFX) {
            if (clip.chromaKey?.enabled) {
              applyChromaKeyOnData(
                oCtx,
                offCanvas.width,
                offCanvas.height,
                clip.chromaKey.color,
                clip.chromaKey.threshold,
                clip.chromaKey.softness,
                clip.chromaKey.spillSuppression ?? 0,
                clip.chromaKey.edgeFeather ?? 0
              );
            }
            if (clip.lumaKey?.enabled) {
              applyLumaKeyOnData(
                oCtx,
                offCanvas.width,
                offCanvas.height,
                clip.lumaKey.type,
                clip.lumaKey.threshold,
                clip.lumaKey.softness
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
            if (filters.temperature !== 0 || filters.tint !== 0 || filters.fadedFilm !== 0 || filters.vignette !== 0) {
              applyColorOverlays(oCtx, 0, 0, offCanvas.width, offCanvas.height, filters);
            }
            if (clip.lutFilter?.enabled && clip.lutFilter.lutUrl) {
              applyLutToCanvas(oCtx, offCanvas.width, offCanvas.height, clip.lutFilter.lutUrl, clip.lutFilter.intensity ?? 100);
            }
          }

          if (clip.mask?.enabled) {
            // With DOWNSCALE=1.0, offCanvas dimensions match logical dimensions,
            // so the mask can be applied directly without transform manipulation.
            await applyClipMaskOffscreen(oCtx, clip.mask, offCanvas.width, offCanvas.height, clip.id, clip.startTime, clip.animations);
          }

          oCtx.restore();

          if (corners) {
            drawPerspectiveTexture(ctx, offCanvas, corners);
          } else {
            ctx.drawImage(offCanvas, dx, dy, dw, dh);
          }
        }
      } else {
        drawMediaPlaceholder(ctx, dw, dh, mediaItem.name, mediaItem.type, '#fbbf24');
      }
    } else if (mediaItem.type === 'text' || clip.textSettings || clip.mediaId === 'text-placeholder') {
      anyClipDrawn = true;
      const ts = clip.textSettings || { text: 'Text', fontSize: 48, fontFamily: 'sans-serif', color: '#ffffff' };
      ctx.save();
      ctx.font = `${ts.fontSize || 48}px ${ts.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = ts.color || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ts.text || 'Text', 0, 0);
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

  if (drawQueue.length > 1) {
    drawQueue.sort((a, b) => a.layer - b.layer);
  }

  for (const item of drawQueue) {
    await drawSingleClip(item.clip);
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
