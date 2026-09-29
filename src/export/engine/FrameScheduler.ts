import { AssetDecoder } from './AssetDecoder';
import { StillImageSource } from './StillImageSource';
import { findActiveTransition, buildTransitionPlan } from '../../utils/transitionEngine';
import { resolveBlendPlan } from '../../utils/blendCompositor';
import { FramePool } from './memory/FramePool';
import { getMediaTimeForClip } from '../../utils/speedRamp';

/**
 * Anything that can hand the compositor a frame for a clip: a real MediaBunny
 * decode pipeline (AssetDecoder) or a decoded still (StillImageSource).
 */
export interface ClipFrameSource {
  rotation: number;
  ready: boolean;
  loadError: string | null;
  getFrameAt(timestampMicroseconds: number): Promise<CanvasImageSource | VideoFrame | null>;
  dispose(): void;
}

/**
 * Minimal keyframe interpolation for export (linear only, no bezier).
 * Mirrors preview's getAnimatedValue for opacity/transform but runs in worker.
 *
 * PERF: Keyframes are authored sorted (addOrUpdateKeyframe inserts in order) and
 * the preview engine's binary search already relies on that invariant. The old
 * version re-sorted the array on EVERY call — O(k log k) with a fresh allocation
 * per property per frame — which compounded across clips × properties × frames
 * and measurably slowed export. We now binary-search the pre-sorted array, exactly
 * like preview.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function getAnimatedExportValue(
  base: number,
  currentTime: number,
  clipStart: number,
  keyframes?: Array<{ time: number; value: number; easing?: string }>
): number {
  if (!keyframes || keyframes.length === 0) return base;
  const t = currentTime - clipStart;
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (t <= first.time) return first.value;
  if (t >= last.time) return last.value;

  // Binary search for the segment containing `t` (array is pre-sorted).
  let lo = 0;
  let hi = keyframes.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid].time <= t) lo = mid;
    else hi = mid;
  }
  const a = keyframes[lo];
  const b = keyframes[hi];
  if (t >= a.time && t <= b.time) {
    const span = b.time - a.time;
    const segT = span > 0.001 ? (t - a.time) / span : 0;
    // Hold
    if (a.easing === 'hold' || (a as any).holdNext) return a.value;
    return lerp(a.value, b.value, segT);
  }
  return base;
}

function getSpeedRampMediaTime(
  clip: any,
  currentTime: number
): number {
  const elapsed = currentTime - clip.startTime;
  const trim = clip.trimStart ?? clip.startOffset ?? 0;
  const speed = clip.speed ?? 1;
  const ramp = clip.speedRamp;
  if ((!ramp || ramp.length < 2) && (!clip.speedFrames || clip.speedFrames.length === 0)) {
    const direct = elapsed * speed + trim;
    return Number.isFinite(direct) ? direct : trim;
  }
  // Use the SAME engine as the preview (`getMediaTimeForClip`): the previous
  // hand-rolled linear scan ignored the clip's trim offset and used an
  // average-speed approximation, so exported ramped (and ramped+trimmed)
  // clips sampled different source frames than what the preview showed.
  // speedRamp.ts is pure math — no DOM/worker dependencies — so sharing the
  // exact mapping costs nothing and guarantees preview/export consistency.
  try {
    const res = getMediaTimeForClip(
      {
        id: clip.id ?? '',
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: trim,
        speed,
        speedRamp: ramp,
        speedFrames: clip.speedFrames,
        speedFrameSourceEnd: clip.speedFrameSourceEnd,
      },
      currentTime
    );
    return Number.isFinite(res) ? res : (elapsed * speed + trim);
  } catch {
    const fallback = elapsed * speed + trim;
    return Number.isFinite(fallback) ? fallback : trim;
  }
}

export interface RenderLayer {
  type: 'video' | 'text' | 'image' | 'adjustment' | 'fx';
  frame?: CanvasImageSource | VideoFrame; // For video/image
  textData?: any;     // For text
  /** Absolute timeline time (seconds) this layer is being evaluated at.
   *  Text layers use it to drive entry/exit animation progress; video layers
   *  use it (with `startTime`) to drive time-based FX and particles. */
  timestampSeconds?: number;
  /** Clip start time on the timeline, for computing local (in-clip) time. */
  startTime?: number;
  /** Source clip id — used as a deterministic seed for particle simulation. */
  clipId?: string;
  linkedTrackId?: string;
  linkedClipId?: string;
  opacity: number;
  chromaKey?: {
    enabled: boolean;
    color: string;
    threshold: number;
    softness: number;
    spillSuppression: number;
    edgeFeather: number;
  };
  lumaKey?: {
    enabled: boolean;
    type: 'dark' | 'light';
    threshold: number;
    softness: number;
  };
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  crop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  flipH?: boolean;
  flipV?: boolean;
  colorFilters?: {
    exposure: number;
    contrast: number;
    saturation: number;
    blur: number;
    temperature: number;
    tint: number;
    fadedFilm: number;
    vignette: number;
  };
  mask?: any;
  vectorMask?: any;
  effects?: string[];
  fxSettings?: any;
  particleSettings?: any;
  lutData?: any;
  lutIntensity?: number;
  colorWheels?: { shadows?: any; midtones?: any; highlights?: any } | null;
  curves?: any;
  rotationX?: number;
  rotationY?: number;
  perspectivePin?: boolean;
  perspectiveCorners?: {
    topLeft?: { x: number; y: number };
    topRight?: { x: number; y: number };
    bottomRight?: { x: number; y: number };
    bottomLeft?: { x: number; y: number };
  };
  zIndex: number;
  sourceRotation?: number;
  /**
   * Speed-ramp/trim-aware SOURCE media time (same mapping the preview's video
   * element reports). The AI background mask cache is keyed by source time, so
   * the Compositor's mask lookup MUST use this — clip-local time misses for
   * trimmed or speed-changed clips and the cutout silently vanishes on export.
   */
  sourceMediaTime?: number;
  blendMode?: GlobalCompositeOperation;
  order?: number;
  transitionGeometry?: {
    translateX: number;
    translateY: number;
    scale: number;
    scaleX?: number;
    scaleY?: number;
    rotation: number;
    clipRect?: { x: number; y: number; w: number; h: number };
    clipFeather?: number;
    clipCircle?: { x: number; y: number; r: number };
    clipWedge?: { cx: number; cy: number; angle: number };
    blur?: number;
    noiseReveal?: { amount: number; cell: number; invert?: boolean };
    noiseTrail?: { cell: number; center: number; windX: number; windY: number };
    slices?: { count: number; axis: 'x' | 'y'; spread: number };
  };
  isAdjustmentLayer?: boolean;
  aiBackground?: {
    enabled: boolean;
    edgeBlur: number;
    modelSelection?: 0 | 1 | 2;
    choke?: number;
    feather?: number;
    spillSuppression?: number;
    spillColor?: string;
    mode?: 'remove' | 'blur' | 'outline' | 'color';
    blurStrength?: number;
    strokeColor?: string;
    strokeWidth?: number;
    strokeGlow?: boolean;
    bgColor?: string;
  };
  objectRemoval?: {
    enabled: boolean;
    mode: 'content_aware' | 'patch_replace' | 'blur_conceal' | 'pixelate';
    shape: 'rectangle' | 'ellipse' | 'polygon';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    feather: number;
    opacity: number;
    stretchStrength?: number;
    patchSourceX?: number;
    patchSourceY?: number;
  };
}

export interface FrameOverlay {
  color: string;
  alpha: number;
  /** Directional gradient band (paper-fold shadow) instead of a flat fill. */
  rect?: { x: number; y: number; w: number; h: number };
  gradientDir?: 'left' | 'right' | 'up' | 'down';
}

/** Full-frame pixel post-effect from an active transition (rgbSplit / pixelate). */
export interface FramePostEffect {
  type: 'none' | 'rgbSplit' | 'pixelate';
  amount: number;
}

export interface FramePlan {
  layers: RenderLayer[];
  overlays: FrameOverlay[];
  postEffect?: FramePostEffect;
}

export class FrameScheduler {
  private timeline: any;
  private framePool: FramePool;
  private mediaBuffers: Record<string, any>;
  private mediaDecoders: Map<string, ClipFrameSource> = new Map();
  // Test compatibility: older tests inject via `decoders`
  private get decoders(): Map<string, ClipFrameSource> {
    return (this as any)._decodersCompat ?? this.mediaDecoders;
  }
  private set decoders(v: Map<string, ClipFrameSource>) {
    (this as any)._decodersCompat = v;
    this.mediaDecoders = v as any;
  }
  public warnings: string[] = [];
  private mediaMap: Map<string, any> | null = null;

  constructor(timeline: any, framePool: FramePool, mediaBuffers?: Record<string, any>) {
    this.timeline = timeline;
    this.framePool = framePool;
    this.mediaBuffers = mediaBuffers || {};
  }

  /** Lazily build an id→media map (the worker timeline stores media items). */
  private getMediaMap(): Map<string, any> {
    if (this.mediaMap) return this.mediaMap;
    const map = new Map<string, any>();
    for (const m of (this.timeline.media || [])) {
      if (m?.id) map.set(m.id, m);
    }
    this.mediaMap = map;
    return map;
  }

  /** Resolve a parsed `.cube` LUT table for a LUT media id, if present. */
  private resolveLutData(mediaId: string): any {
    const lutMedia = this.getMediaMap().get(mediaId);
    return lutMedia?.lutData ?? undefined;
  }

  async initializeDecoders() {
    const visualMediaMap = new Map<string, any>();
    const mediaMap = new Map<string, any>();
    for (const m of (this.timeline.media || [])) {
      if (m?.id) mediaMap.set(m.id, m);
    }
    for (const track of (this.timeline.tracks || [])) {
      if (track.type === 'video') {
        for (const clip of (track.clips || [])) {
          if (clip.mediaId) {
            const media = mediaMap.get(clip.mediaId) || { id: clip.mediaId, url: clip.url, name: clip.name };
            visualMediaMap.set(clip.mediaId, media);
          }
        }
      }
    }

    const loadPromises: Promise<void>[] = [];

    for (const [mediaId, media] of visualMediaMap.entries()) {
      if (!this.mediaDecoders.has(mediaId)) {
        const url = media?.url || '';
        const preBuffer = this.mediaBuffers[mediaId];
        const mediaName: string = media?.name || '';
        const isImage =
          media?.type === 'image' ||
          /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(mediaName);

        if (isImage) {
          const source = new StillImageSource(url);
          this.mediaDecoders.set(mediaId, source);
          loadPromises.push(source.load(preBuffer));
          continue;
        }

        const decoder = new AssetDecoder(url);
        this.mediaDecoders.set(mediaId, decoder);
        loadPromises.push(
          decoder.load(preBuffer).then(async () => {
            if (decoder.ready) return;
            const fallback = new StillImageSource(url);
            await fallback.load(preBuffer);
            if (fallback.ready) {
              decoder.dispose();
              this.mediaDecoders.set(mediaId, fallback);
            } else {
              fallback.dispose();
              this.warnings.push(
                `"${mediaName || mediaId}" could not be decoded for export` +
                (decoder.loadError ? ` (${decoder.loadError})` : '') +
                '. Its frames will be missing from the output.'
              );
            }
          })
        );
      }
    }

    await Promise.allSettled(loadPromises);

    // Surface features the worker cannot render (they require the main thread's
    // DOM + ML/WebGPU runtimes), so the user isn't surprised by a missing effect
    // in the exported file.
    const warnOnce = new Set<string>();
    for (const track of (this.timeline.tracks || [])) {
      for (const clip of (track.clips || [])) {
        if (clip.objectRemoval?.enabled && !warnOnce.has('objectRemoval')) {
          warnOnce.add('objectRemoval');
          this.warnings.push(
            'Object removal requires inpaint cache warm-up before export. ' +
            'Please click "Prepare Export" to generate inpaint masks, or the clip will export without the removal effect.'
          );
        }
      }
    }
  }

  async getLayersAtTime(timestampSeconds: number): Promise<RenderLayer[]> {
    const layers: RenderLayer[] = [];
    const pending: Array<Promise<void>> = [];
    let order = 0;

    const tracks = this.timeline.tracks || [];
    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (track.hidden) continue;

      // If this FX track is linked to a host track, respect host track hidden & muted state
      if (track.type === 'fx' && track.linkedTrackId) {
        const hostTrack = tracks.find((t: any) => t.id === track.linkedTrackId);
        if (hostTrack && (hostTrack.hidden || hostTrack.muted)) {
          continue;
        }
      }

      const activeTransition = findActiveTransition(track.clips || [], timestampSeconds);
      const plan = activeTransition ? buildTransitionPlan(activeTransition) : null;

      for (const clip of track.clips || []) {
        if (clip.disabled) continue;

        // If this FX clip is linked to a host clip, skip if that host clip is disabled
        if (track.type === 'fx' && clip.linkedClipId) {
          let hostClipFound = false;
          let hostClipDisabled = false;
          for (const t of tracks) {
            const hc = (t as any).clips?.find((c: any) => c.id === clip.linkedClipId);
            if (hc) {
              hostClipFound = true;
              hostClipDisabled = !!hc.disabled;
              break;
            }
          }
          if (hostClipFound && hostClipDisabled) continue;
        }

        const transitionRole = activeTransition
          ? (activeTransition.from?.id === clip.id
              ? 'from'
              : activeTransition.to?.id === clip.id
                ? 'to'
                : null)
          : null;

        const normallyVisible =
          timestampSeconds >= clip.startTime &&
          timestampSeconds < (clip.startTime + clip.duration);

        if (normallyVisible || transitionRole) {
          const t = timestampSeconds;
          const st = clip.startTime || 0;
          const xBase = clip.transform?.x ?? clip.position?.x ?? 0;
          const yBase = clip.transform?.y ?? clip.position?.y ?? 0;
          const scaleBase = clip.transform?.scale ?? clip.scale ?? 100;
          const rotBase = clip.transform?.rotation ?? clip.rotation ?? 0;
          const transform = {
            x: getAnimatedExportValue(xBase, t, st, clip.animations?.['transform.x']),
            y: getAnimatedExportValue(yBase, t, st, clip.animations?.['transform.y']),
            scale: getAnimatedExportValue(scaleBase, t, st, clip.animations?.['transform.scale']),
            rotation: getAnimatedExportValue(rotBase, t, st, clip.animations?.['transform.rotation']),
          };
          const zIndex = clip.zIndex !== undefined ? clip.zIndex : trackIdx;
          const layerOrder = order++;

          const layerDraw = plan && transitionRole
            ? (transitionRole === 'from' ? plan.from : plan.to)
            : null;
          if (layerDraw && !layerDraw.visible) continue;
          const baseOpacity = clip.opacity !== undefined ? clip.opacity : 1;
          const animatedOpacity = getAnimatedExportValue(baseOpacity, t, st, clip.animations?.['opacity']);
          const withTransition = layerDraw ? animatedOpacity * layerDraw.opacity : animatedOpacity;

          // Animate blend intensity (matches preview's keyframed blend control).
          const animatedBlendIntensity = Math.max(0, Math.min(100,
            getAnimatedExportValue(
              clip.transform?.blendIntensity ?? 100,
              t, st,
              clip.animations?.['transform.blendIntensity']
            )
          ));
          const blendPlan = resolveBlendPlan(
            clip.transform?.blendMode,
            animatedBlendIntensity,
            withTransition
          );
          const opacity = blendPlan.kind === 'lerp'
            ? blendPlan.alpha * blendPlan.mix
            : blendPlan.alpha;
          const blendMode: GlobalCompositeOperation =
            blendPlan.kind === 'normal' ? 'source-over' : blendPlan.mode;
          const transitionGeometry = layerDraw
            ? {
                translateX: layerDraw.translateX,
                translateY: layerDraw.translateY,
                scale: layerDraw.scale,
                scaleX: layerDraw.scaleX,
                scaleY: layerDraw.scaleY,
                rotation: layerDraw.rotation,
                clipRect: layerDraw.clipRect,
                clipFeather: layerDraw.clipFeather,
                clipCircle: layerDraw.clipCircle,
                clipWedge: layerDraw.clipWedge,
                blur: layerDraw.blur,
                noiseReveal: layerDraw.noiseReveal,
                noiseTrail: layerDraw.noiseTrail,
                slices: layerDraw.slices,
              }
            : undefined;

          const crop = clip.crop ? {
            top: getAnimatedExportValue(clip.crop.top || 0, t, st, clip.animations?.['crop.top']),
            bottom: getAnimatedExportValue(clip.crop.bottom || 0, t, st, clip.animations?.['crop.bottom']),
            left: getAnimatedExportValue(clip.crop.left || 0, t, st, clip.animations?.['crop.left']),
            right: getAnimatedExportValue(clip.crop.right || 0, t, st, clip.animations?.['crop.right']),
          } : undefined;
          const cf = clip.colorFilters;
          const colorFilters = cf ? {
            exposure: getAnimatedExportValue(cf.exposure ?? 0, t, st, clip.animations?.['color.exposure']),
            contrast: getAnimatedExportValue(cf.contrast ?? 100, t, st, clip.animations?.['color.contrast']),
            saturation: getAnimatedExportValue(cf.saturation ?? 100, t, st, clip.animations?.['color.saturation']),
            blur: getAnimatedExportValue(cf.blur ?? 0, t, st, clip.animations?.['color.blur']),
            temperature: getAnimatedExportValue(cf.temperature ?? 0, t, st, clip.animations?.['color.temperature']),
            tint: getAnimatedExportValue(cf.tint ?? 0, t, st, clip.animations?.['color.tint']),
            fadedFilm: getAnimatedExportValue(cf.fadedFilm ?? 0, t, st, clip.animations?.['color.fadedFilm']),
            vignette: getAnimatedExportValue(cf.vignette ?? 0, t, st, clip.animations?.['color.vignette']),
          } : undefined;
          // ── Keyed chroma / luma keying ──────────────────────────────────────
          // The preview animates chromaKey threshold/softness/spill/feather and
          // lumaKey threshold/softness via clip.animations. Previously the export
          // passed the RAW clip.chromaKey and dropped lumaKey entirely, so keyed
          // keyframes were lost and luma-keyed clips exported with their
          // background intact. Now both are animated per-frame, matching preview.
          const ck = clip.chromaKey;
          const chromaKey = ck ? {
            ...ck,
            threshold: getAnimatedExportValue(ck.threshold ?? 0, t, st, clip.animations?.['chromaKey.threshold']),
            softness: getAnimatedExportValue(ck.softness ?? 0, t, st, clip.animations?.['chromaKey.softness']),
            spillSuppression: getAnimatedExportValue(ck.spillSuppression ?? 0, t, st, clip.animations?.['chromaKey.spillSuppression']),
            edgeFeather: getAnimatedExportValue(ck.edgeFeather ?? 0, t, st, clip.animations?.['chromaKey.edgeFeather']),
          } : undefined;
          const lk = clip.lumaKey;
          const lumaKey = lk ? {
            ...lk,
            threshold: getAnimatedExportValue(lk.threshold ?? 0, t, st, clip.animations?.['lumaKey.threshold']),
            softness: getAnimatedExportValue(lk.softness ?? 0, t, st, clip.animations?.['lumaKey.softness']),
          } : undefined;

          // Animate the geometric mask's keyframable parameters (x/y/width/
          // height/rotation/feather/roundness) — matches preview's
          // applyClipMaskOffscreen.
          const m = clip.mask;
          const animatedMask = m ? {
            ...m,
            x: getAnimatedExportValue(m.x ?? 50, t, st, clip.animations?.['mask.x']),
            y: getAnimatedExportValue(m.y ?? 50, t, st, clip.animations?.['mask.y']),
            width: getAnimatedExportValue(m.width ?? 100, t, st, clip.animations?.['mask.width']),
            height: getAnimatedExportValue(m.height ?? 100, t, st, clip.animations?.['mask.height']),
            rotation: getAnimatedExportValue(m.rotation ?? 0, t, st, clip.animations?.['mask.rotation']),
            feather: getAnimatedExportValue(m.feather ?? 0, t, st, clip.animations?.['mask.feather']),
            roundness: getAnimatedExportValue(m.roundness ?? 0, t, st, clip.animations?.['mask.roundness']),
          } : undefined;

          // LUT color grade — resolve the LUT media's parsed table (media items
          // are serialized alongside tracks; `table` survives JSON as a plain
          // numeric-keyed object, which applyLutToPixel indexes fine).
          const lutMediaId = clip.lut?.mediaId || clip.lutFilter?.mediaId;
          const lutData = lutMediaId ? this.resolveLutData(lutMediaId) : undefined;
          const lutIntensity = lutData !== undefined
            ? getAnimatedExportValue(
                clip.lut?.intensity ?? clip.lutFilter?.intensity ?? 100,
                t, st,
                clip.animations?.['lut.intensity'] || clip.animations?.['lutFilter.intensity']
              )
            : undefined;

          const cw = clip.colorFilters;
          const colorWheels = (cw?.shadows || cw?.midtones || cw?.highlights) ? {
            shadows: cw.shadows,
            midtones: cw.midtones,
            highlights: cw.highlights,
          } : undefined;
          const curves = clip.colorFilters?.curves;

          const visualSettings = {
            crop,
            flipH: !!clip.transform?.flipH,
            flipV: !!clip.transform?.flipV,
            colorFilters,
            chromaKey,
            lumaKey,
            mask: animatedMask,
            vectorMask: clip.vectorMask,
            fxSettings: clip.fxSettings ? {
              ...clip.fxSettings,
              intensity: getAnimatedExportValue(
                clip.fxSettings.intensity ?? 100, t, st,
                clip.animations?.['fxSettings.intensity']
              ),
            } : undefined,
            particleSettings: clip.particleSettings,
            lutData,
            lutIntensity,
            colorWheels,
            curves,
            rotationX: getAnimatedExportValue(clip.transform?.rotationX ?? 0, t, st, clip.animations?.['transform.rotationX']),
            rotationY: getAnimatedExportValue(clip.transform?.rotationY ?? 0, t, st, clip.animations?.['transform.rotationY']),
            perspectivePin: !!clip.transform?.perspectivePin,
            perspectiveCorners: clip.transform?.perspectiveCorners,
            effects: Array.isArray(clip.effects) ? clip.effects : undefined,
            aiBackground: clip.aiBackground?.enabled ? {
              enabled: true,
              edgeBlur: clip.aiBackground.edgeBlur ?? 0,
              modelSelection: clip.aiBackground.modelSelection,
              choke: clip.aiBackground.choke,
              feather: clip.aiBackground.feather,
              spillSuppression: clip.aiBackground.spillSuppression,
              spillColor: clip.aiBackground.spillColor,
              mode: clip.aiBackground.mode,
              blurStrength: clip.aiBackground.blurStrength,
              strokeColor: clip.aiBackground.strokeColor,
              strokeWidth: clip.aiBackground.strokeWidth,
              strokeGlow: clip.aiBackground.strokeGlow,
              bgColor: clip.aiBackground.bgColor,
            } : undefined,
            objectRemoval: clip.objectRemoval?.enabled ? {
              enabled: true,
              mode: clip.objectRemoval.mode,
              shape: clip.objectRemoval.shape,
              x: getAnimatedExportValue(clip.objectRemoval.x ?? 50, t, st, clip.animations?.['objectRemoval.x']),
              y: getAnimatedExportValue(clip.objectRemoval.y ?? 50, t, st, clip.animations?.['objectRemoval.y']),
              width: getAnimatedExportValue(clip.objectRemoval.width ?? 20, t, st, clip.animations?.['objectRemoval.width']),
              height: getAnimatedExportValue(clip.objectRemoval.height ?? 20, t, st, clip.animations?.['objectRemoval.height']),
              rotation: getAnimatedExportValue(clip.objectRemoval.rotation ?? 0, t, st, clip.animations?.['objectRemoval.rotation']),
              feather: getAnimatedExportValue(clip.objectRemoval.feather ?? 10, t, st, clip.animations?.['objectRemoval.feather']),
              opacity: getAnimatedExportValue(clip.objectRemoval.opacity ?? 100, t, st, clip.animations?.['objectRemoval.opacity']),
              stretchStrength: getAnimatedExportValue(clip.objectRemoval.stretchStrength ?? 80, t, st, clip.animations?.['objectRemoval.stretchStrength']),
              patchSourceX: getAnimatedExportValue(clip.objectRemoval.patchSourceX ?? 30, t, st, clip.animations?.['objectRemoval.patchSourceX']),
              patchSourceY: getAnimatedExportValue(clip.objectRemoval.patchSourceY ?? 30, t, st, clip.animations?.['objectRemoval.patchSourceY']),
              regions: clip.objectRemoval.regions,
            } : undefined,
          };

          if (track.type === 'video' && (clip.mediaId || clip.id)) {
            const lookupId = clip.mediaId || clip.id;
            const decoder =
              this.mediaDecoders.get(lookupId) ||
              this.mediaDecoders.get(clip.mediaId) ||
              (this as any)._decodersCompat?.get(lookupId);
            if (!decoder) {
              // No decoder for this clip — skip (test may have no mediaId)
              // In production, initializeDecoders would have created one
              if (!clip.mediaId) {
                // For test compatibility where decoder key == clip.id
                const testDecoder = (this as any)._decodersCompat?.get(clip.id) || this.mediaDecoders.get(clip.id);
                if (testDecoder) {
                  const localTimeSeconds = getSpeedRampMediaTime(clip, Math.min(
                    Math.max(timestampSeconds, clip.startTime),
                    clip.startTime + clip.duration
                  ));
                  pending.push(
                    (async () => {
                      try {
                        const frame = await testDecoder?.getFrameAt(localTimeSeconds * 1_000_000);
                        if (frame) {
                          layers.push({
                            type: 'video',
                            frame,
                            timestampSeconds: t,
                            startTime: st,
                            clipId: clip.id,
                            opacity,
                            transform,
                            ...visualSettings,
                            zIndex,
                            order: layerOrder,
                            transitionGeometry,
                            blendMode,
                            sourceRotation: testDecoder?.rotation || 0,
                            sourceMediaTime: Number.isFinite(localTimeSeconds) ? Math.max(0, localTimeSeconds) : 0,
                          });
                        }
                      } catch {
                        // failing decoder should not drop frame (test expects good to survive)
                      }
                    })()
                  );
                  continue;
                }
              }
              continue;
            }
            // Use speedRamp-aware media time mapping (matches preview's getMediaTimeForClip)
            const localTimeSeconds = getSpeedRampMediaTime(clip, Math.min(
              Math.max(timestampSeconds, clip.startTime),
              clip.startTime + clip.duration
            ));
            const safeTimeSeconds = Number.isFinite(localTimeSeconds) ? Math.max(0, localTimeSeconds) : 0;

            pending.push(
              (async () => {
                try {
                  const frame = await decoder?.getFrameAt(safeTimeSeconds * 1_000_000);
                  if (frame) {
                    layers.push({
                      type: 'video',
                      frame,
                      timestampSeconds: t,
                      startTime: st,
                      clipId: clip.id,
                      opacity,
                      transform,
                      ...visualSettings,
                      zIndex,
                      order: layerOrder,
                      transitionGeometry,
                      blendMode,
                      sourceRotation: decoder?.rotation || 0,
                      sourceMediaTime: safeTimeSeconds,
                    });
                  }
                } catch {
                  // One failing decoder should not drop rest of frame
                }
              })()
            );
          } else if (track.type === 'text') {
            layers.push({
              type: 'text',
              textData: clip,
              timestampSeconds: t,
              opacity,
              transform,
              ...visualSettings,
              zIndex,
              order: layerOrder,
              transitionGeometry,
              blendMode,
            });
          } else if (track.type === 'fx') {
            // FX-track clip — a full-frame timeline shader (fxSettings) and/or
            // particle overlay (particleSettings) applied over the composited
            // frame. No decoder needed; the Compositor runs the shader across
            // the whole output canvas, matching the preview's timeline-FX pass.
            layers.push({
              type: 'fx',
              timestampSeconds: t,
              startTime: st,
              clipId: clip.id,
              linkedTrackId: track.linkedTrackId,
              linkedClipId: clip.linkedClipId,
              opacity,
              transform,
              ...visualSettings,
              zIndex,
              order: layerOrder,
              transitionGeometry,
              blendMode,
            });
          } else if (clip.isAdjustmentLayer || (clip.mediaId?.startsWith('adj_'))) {
            // Adjustment layer — no frame decoder needed, just the color filters
            layers.push({
              type: 'adjustment',
              timestampSeconds: t,
              startTime: st,
              clipId: clip.id,
              opacity,
              transform,
              ...visualSettings,
              zIndex,
              order: layerOrder,
              transitionGeometry,
              blendMode,
              isAdjustmentLayer: true,
            });
          }
        }
      }
    }

    // ── PiP Windows (Kinetic Typography Hybrid Mode) ──────────────────
    const pipWindows = (this.timeline as any).pipWindows || {};
    for (const pw of Object.values(pipWindows) as any[]) {
      if (!pw || !pw.tracks) continue;
      // Find the parent clip on the main timeline
      let parentClip: any = null;
      for (const track of tracks) {
        for (const clip of track.clips || []) {
          if ((clip.pipWindowIds && clip.pipWindowIds.includes(pw.id)) 
              || clip.id === pw.parentClipId 
              || clip.id === pw.clipId) {
            parentClip = clip;
            break;
          }
        }
        if (parentClip) break;
      }
      if (!parentClip) continue;
      
      const pipAbsStart = parentClip.startTime + (pw.relativeStartTime || 0);
      const pipAbsEnd = pipAbsStart + (pw.duration || parentClip.duration);
      if (timestampSeconds < pipAbsStart || timestampSeconds >= pipAbsEnd) continue;
      
      // Traverse PiP tracks and find active word clips
      for (const pipTrack of pw.tracks) {
        if (pipTrack.hidden) continue;
        for (const pClip of pipTrack.clips || []) {
          if (pClip.disabled) continue;
          const clipAbsStart = pipAbsStart + pClip.startTime;
          const clipAbsEnd = clipAbsStart + pClip.duration;
          if (timestampSeconds >= clipAbsStart && timestampSeconds < clipAbsEnd) {
            // Create a synthetic clip that inherits parent transform
            const syntheticClip = {
              ...pClip,
              startTime: clipAbsStart,
              __parentTransform: parentClip.transform,
              __parentId: parentClip.id,
              __parentStartTime: parentClip.startTime,
              __parentAnimations: parentClip.animations,
              __parentOpacity: parentClip.opacity,
            };
            
            // Push as a text render layer
            if (syntheticClip.textSettings) {
              layers.push({
                type: 'text',
                textData: syntheticClip,
                timestampSeconds,
                startTime: clipAbsStart,
                clipId: pClip.id,
                opacity: (parentClip.opacity !== undefined ? parentClip.opacity : 1),
                transform: pClip.transform || parentClip.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
                zIndex: 300 + (pipTrack.zIndex || 0),
                order: layers.length,
              });
            }
          }
        }
      }
    }

    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }

    layers.sort((a, b) => (a.zIndex - b.zIndex) || ((a.order ?? 0) - (b.order ?? 0)));

    // Evict decoders for clips whose time range has completely passed
    this.evictExpiredDecoders(timestampSeconds);

    return layers;
  }

  async getFramePlanAtTime(timestampSeconds: number): Promise<FramePlan> {
    const overlays: FrameOverlay[] = [];
    let postEffect: FramePostEffect | undefined;
    for (const track of this.timeline.tracks || []) {
      if (track.hidden) continue;
      const active = findActiveTransition(track.clips || [], timestampSeconds);
      if (!active) continue;
      const plan = buildTransitionPlan(active);
      if (plan.overlay.type === 'color' && plan.overlay.alpha > 0.001) {
        overlays.push({ color: plan.overlay.color, alpha: plan.overlay.alpha });
      } else if (plan.overlay.type === 'edgeGradient' && plan.overlay.alpha > 0.001 && plan.overlay.rect) {
        // Paper-fold shadow band (gradient following the fold lip)
        overlays.push({
          color: plan.overlay.color,
          alpha: plan.overlay.alpha,
          rect: plan.overlay.rect,
          gradientDir: plan.overlay.gradientDir,
        });
      }
      // Pixel post-effects (rgbSplit / pixelate) must reach the Compositor —
      // previously they were computed here and silently dropped, so glitch and
      // pixelate transitions exported as plain dissolves.
      if (plan.postEffect !== 'none' && plan.postEffectAmount > 0.001) {
        postEffect = { type: plan.postEffect, amount: plan.postEffectAmount };
      }
    }
    const layers = await this.getLayersAtTime(timestampSeconds);
    return { layers, overlays, postEffect };
  }

  /**
   * Evict decoders for clips whose time range has completely passed.
   * This prevents holding dozens of decoded canvas pools (each ~33 MB at 4K)
   * for clips that will never be needed again during a forward export.
   */
  private evictExpiredDecoders(currentTimeSec: number): void {
    const neededMediaIds = new Set<string>();
    for (const track of this.timeline.tracks || []) {
      for (const clip of track.clips || []) {
        const clipEnd = (clip.startTime || 0) + (clip.duration || 0);
        // Keep decoders for clips that haven't ended yet (+ 1s safety margin for transitions)
        if (clipEnd > currentTimeSec - 1) {
          const lookupId = clip.mediaId || clip.id;
          neededMediaIds.add(lookupId);
          if (clip.mediaId) neededMediaIds.add(clip.mediaId);
        }
      }
    }
    for (const [id, decoder] of this.mediaDecoders) {
      if (!neededMediaIds.has(id)) {
        if (typeof (decoder as any)?.dispose === 'function') {
          (decoder as any).dispose();
        }
        this.mediaDecoders.delete(id);
      }
    }
  }

  dispose() {
    this.mediaDecoders.forEach(d => {
      if (typeof (d as any)?.dispose === 'function') {
        (d as any).dispose();
      }
    });
    this.mediaDecoders.clear();
  }
}
