import { AssetDecoder } from './AssetDecoder';
import { StillImageSource } from './StillImageSource';
import { findActiveTransition, buildTransitionPlan } from '../../utils/transitionEngine';
import { resolveBlendPlan } from '../../utils/blendCompositor';
import { FramePool } from './memory/FramePool';
import { getMediaTimeForClip } from '../../utils/speedRamp';
import { planDecodeStreams, type DecodeStreamPlan } from '../../utils/splitClipIdentity';

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
  blendMode?: GlobalCompositeOperation;
  order?: number;
  transitionGeometry?: {
    translateX: number;
    translateY: number;
    scale: number;
    rotation: number;
    clipRect?: { x: number; y: number; w: number; h: number };
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
}

/**
 * One frame request for a decode stream, queued so it can be executed in
 * ascending source order per stream (never interleaved out of order).
 */
interface DecodeRequest {
  streamKey: string;
  sourceSeconds: number;
  run: () => Promise<void>;
}

export interface FramePlan {
  layers: RenderLayer[];
  overlays: FrameOverlay[];
}

export class FrameScheduler {
  private timeline: any;
  private framePool: FramePool;
  private mediaBuffers: Record<string, any>;
  private mediaDecoders: Map<string, ClipFrameSource> = new Map();
  /**
   * Clips are grouped into DECODE STREAMS (see `utils/splitClipIdentity`): a
   * stream is a set of clips one sequential decoder can serve without ever
   * having to rewind. Split segments of one chain share a stream; clips that
   * would interleave two distant source windows (e.g. the same media reused on
   * another track) get their own decoder.
   */
  private streamPlan: DecodeStreamPlan | null = null;
  /** streamId → decoder-map key, for media types that share one source (stills). */
  private streamAliases: Map<string, string> = new Map();
  /** Max decoders per media file before the planner starts time-sharing one. */
  private maxStreamsPerMedia = 4;
  /** One-frame-deep decode prefetch slot (see `prefetchAtTime`). */
  private prefetchSlot: { timestamp: number; promise: Promise<FramePlan> } | null = null;
  /** Decode telemetry of streams that were already evicted, kept for the report. */
  private retiredDecodeStats: Array<{ streamId: string; stats: any }> = [];
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

    // ── DECODE STREAM PLANNING (multi-track, split-safe) ───────────────
    // The old code created exactly one decoder per media file. A timeline with
    // a split chain on one track and the same media reused on another track then
    // asked that single sequential decoder for two distant source windows on
    // every output frame — each request rewinding the pipeline (see AssetDecoder
    // docs). Planning streams up-front gives simultaneous source windows their
    // own decoder, while contiguous split segments still share one.
    const plan = planDecodeStreams(this.timeline, {
      maxStreamsPerMedia: this.maxStreamsPerMedia,
    });
    this.streamPlan = plan;
    this.streamAliases.clear();

    const loadPromises: Promise<void>[] = [];

    for (const stream of plan.streams) {
      if (this.mediaDecoders.has(stream.id)) continue;

      const media = visualMediaMap.get(stream.mediaId) || this.getMediaMap().get(stream.mediaId);
      const url = media?.url || '';
      const preBuffer = this.mediaBuffers[stream.mediaId];
      const mediaName: string = media?.name || '';
      const isImage =
        media?.type === 'image' ||
        /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(mediaName);

      if (isImage) {
        // Stills decode to one shared ImageBitmap: alias every stream of this
        // media to a single source instead of allocating one per stream.
        const key = `image:${stream.mediaId}`;
        let source = this.mediaDecoders.get(key) as StillImageSource | undefined;
        if (!source) {
          source = new StillImageSource(url);
          this.mediaDecoders.set(key, source);
          const created = source;
          loadPromises.push(
            created.load(preBuffer).then(() => {
              if (!created.ready) {
                this.warnings.push(
                  `"${mediaName || stream.mediaId}" could not be loaded for export. Its frames will be missing from the output.`
                );
              }
            })
          );
        }
        this.streamAliases.set(stream.id, key);
        continue;
      }

      const decoder = new AssetDecoder(url);
      this.mediaDecoders.set(stream.id, decoder);
      loadPromises.push(
        decoder.load(preBuffer).then(async () => {
          if (decoder.ready) return;
          // Fall back to a still (e.g. an animated image mis-detected as video)
          // and share that still across every stream of the media.
          const fallbackKey = `image:${stream.mediaId}`;
          let fallback = this.mediaDecoders.get(fallbackKey) as StillImageSource | undefined;
          if (!fallback) {
            fallback = new StillImageSource(url);
            await fallback.load(preBuffer);
            if (fallback.ready) this.mediaDecoders.set(fallbackKey, fallback);
          }
          if (fallback.ready) {
            decoder.dispose();
            this.streamAliases.set(stream.id, fallbackKey);
            this.mediaDecoders.set(stream.id, fallback);
          } else {
            fallback.dispose();
            this.warnings.push(
              `"${mediaName || stream.mediaId}" could not be decoded for export` +
              (decoder.loadError ? ` (${decoder.loadError})` : '') +
              '. Its frames will be missing from the output.'
            );
          }
        })
      );
    }

    await Promise.allSettled(loadPromises);

    // Surface features the worker cannot render (they require the main thread's
    // DOM + ML/WebGPU runtimes), so the user isn't surprised by a missing effect
    // in the exported file.
    const warnOnce = new Set<string>();
    for (const track of (this.timeline.tracks || [])) {
      for (const clip of (track.clips || [])) {
        if (clip.aiBackground?.enabled && !warnOnce.has('aiBackground')) {
          warnOnce.add('aiBackground');
          this.warnings.push(
            'AI background removal requires mask cache warm-up before export. ' +
            'Please click "Prepare Export" to generate masks, or the clip will export with its original background.'
          );
        }
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

  /**
   * The decode stream a clip belongs to. Falls back to the media/clip id so
   * test-injected decoder maps (keyed by clip id) keep working.
   */
  private resolveStreamKey(clip: any): string {
    const stream = this.streamPlan?.byClip.get(clip.id);
    if (stream) return stream.id;
    return clip.mediaId || clip.id;
  }

  /**
   * The frame source that serves a clip: explicit injection → planned stream →
   * stream alias (shared still) → media id → clip id.
   */
  private resolveDecoderForClip(clip: any): ClipFrameSource | null {
    const compat = (this as any)._decodersCompat as Map<string, ClipFrameSource> | undefined;
    if (compat) {
      const injected = compat.get(clip.id) ?? (clip.mediaId ? compat.get(clip.mediaId) : undefined);
      if (injected) return injected;
    }
    const streamKey = this.resolveStreamKey(clip);
    const alias = this.streamAliases.get(streamKey);
    return (
      this.mediaDecoders.get(streamKey) ||
      (alias ? this.mediaDecoders.get(alias) : undefined) ||
      (clip.mediaId ? this.mediaDecoders.get(clip.mediaId) : undefined) ||
      this.mediaDecoders.get(clip.id) ||
      null
    );
  }

  /**
   * Decode statistics for every stream this export used (live + already
   * evicted) — surfaced in the worker's COMPLETE message. A split-heavy timeline
   * should report `backwardSeeks: 0` per stream; anything else means the decode
   * planner needs another look.
   */
  getDecodeStats(): Array<{ streamId: string; stats: any }> {
    const out: Array<{ streamId: string; stats: any }> = [...this.retiredDecodeStats];
    for (const [streamId, decoder] of this.mediaDecoders) {
      const stats = (decoder as any)?.stats;
      if (stats) out.push({ streamId, stats: { ...stats } });
    }
    return out;
  }

  async getLayersAtTime(timestampSeconds: number): Promise<RenderLayer[]> {
    const layers: RenderLayer[] = [];
    const decodeRequests: DecodeRequest[] = [];
    let order = 0;

    const tracks = this.timeline.tracks || [];
    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (track.hidden) continue;

      const activeTransition = findActiveTransition(track.clips || [], timestampSeconds);
      const plan = activeTransition ? buildTransitionPlan(activeTransition) : null;

      for (const clip of track.clips || []) {
        if (clip.disabled) continue;

        const transitionRole = activeTransition
          ? (activeTransition.from.id === clip.id
              ? 'from'
              : activeTransition.to.id === clip.id
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
                rotation: layerDraw.rotation,
                clipRect: layerDraw.clipRect,
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
            } : undefined,
          };

          if (track.type === 'video' && (clip.mediaId || clip.id)) {
            const decoder = this.resolveDecoderForClip(clip);
            if (!decoder) {
              // No decoder for this clip — skip (a test may have no mediaId, and
              // in production initializeDecoders would have created one).
              continue;
            }
            // SpeedRamp-aware media time mapping (matches preview's getMediaTimeForClip)
            const localTimeSeconds = getSpeedRampMediaTime(clip, Math.min(
              Math.max(timestampSeconds, clip.startTime),
              clip.startTime + clip.duration
            ));
            const safeTimeSeconds = Number.isFinite(localTimeSeconds) ? Math.max(0, localTimeSeconds) : 0;

            // Queue rather than fire immediately: requests are flushed per decode
            // stream in ascending source order, so a multi-layer frame can never
            // ask one decoder for two distant positions in a random order.
            decodeRequests.push({
              streamKey: this.resolveStreamKey(clip),
              sourceSeconds: safeTimeSeconds,
              run: async () => {
                try {
                  const frame = await decoder.getFrameAt(safeTimeSeconds * 1_000_000);
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
                      sourceRotation: decoder.rotation || 0,
                    });
                  }
                } catch {
                  // One failing decoder should not drop rest of frame
                }
              },
            });
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

    if (decodeRequests.length > 0) {
      // Per stream: ascending source time (monotonic decode, zero rewinds).
      // Across streams: fully concurrent, so multi-track frames stay parallel.
      decodeRequests.sort((a, b) => {
        if (a.streamKey === b.streamKey) return a.sourceSeconds - b.sourceSeconds;
        return a.streamKey < b.streamKey ? -1 : 1;
      });
      await Promise.allSettled(decodeRequests.map((request) => request.run()));
    }

    layers.sort((a, b) => (a.zIndex - b.zIndex) || ((a.order ?? 0) - (b.order ?? 0)));

    // Evict decoders for clips whose time range has completely passed
    this.evictExpiredDecoders(timestampSeconds);

    return layers;
  }

  /**
   * Decode the NEXT frame while the current one is composited and encoded.
   *
   * Professional exporters pipeline decode → composite → encode instead of
   * running the three stages serially; one frame of look-ahead is enough to hide
   * the decode latency (and any residual seek) without holding extra frames.
   * The prefetched plan is consumed by the matching `getFramePlanAtTime`, and
   * discarded (frames closed) when the export moves somewhere else.
   */
  prefetchAtTime(timestampSeconds: number): void {
    if (this.prefetchSlot && Math.abs(this.prefetchSlot.timestamp - timestampSeconds) < 1e-6) return;
    this.discardPrefetch();
    const promise = this.buildFramePlan(timestampSeconds);
    promise.catch(() => {});
    this.prefetchSlot = { timestamp: timestampSeconds, promise };
  }

  /** Drops and closes a prefetched plan that will never be composited. */
  discardPrefetch(): void {
    const slot = this.prefetchSlot;
    this.prefetchSlot = null;
    if (!slot) return;
    slot.promise
      .then((plan) => {
        for (const layer of plan.layers) {
          const frame: any = layer.frame;
          try {
            if (frame && typeof frame.close === 'function') frame.close();
          } catch {}
        }
      })
      .catch(() => {});
  }

  async getFramePlanAtTime(timestampSeconds: number): Promise<FramePlan> {
    const slot = this.prefetchSlot;
    if (slot && Math.abs(slot.timestamp - timestampSeconds) < 1e-6) {
      this.prefetchSlot = null;
      return slot.promise;
    }
    if (slot) this.discardPrefetch();
    return this.buildFramePlan(timestampSeconds);
  }

  private async buildFramePlan(timestampSeconds: number): Promise<FramePlan> {
    const overlays: FrameOverlay[] = [];
    for (const track of this.timeline.tracks || []) {
      if (track.hidden) continue;
      const active = findActiveTransition(track.clips || [], timestampSeconds);
      if (!active) continue;
      const plan = buildTransitionPlan(active);
      if (plan.overlay.type === 'color' && plan.overlay.alpha > 0.001) {
        overlays.push({ color: plan.overlay.color, alpha: plan.overlay.alpha });
      }
    }
    const layers = await this.getLayersAtTime(timestampSeconds);
    return { layers, overlays };
  }

  /**
   * Evict decoders for clips whose time range has completely passed.
   * This prevents holding dozens of decoded canvas pools (each ~33 MB at 4K)
   * for clips that will never be needed again during a forward export.
   */
  private evictExpiredDecoders(currentTimeSec: number): void {
    // Injected (test) decoder maps are owned by the caller — never evict them.
    if ((this as any)._decodersCompat) return;

    const neededKeys = new Set<string>();
    const aliveClips = new Set<string>();
    for (const track of this.timeline.tracks || []) {
      for (const clip of track.clips || []) {
        const clipEnd = (clip.startTime || 0) + (clip.duration || 0);
        // Keep decoders for clips that haven't ended yet (+1s safety margin)
        if (clipEnd > currentTimeSec - 1) {
          aliveClips.add(clip.id);
          const streamKey = this.resolveStreamKey(clip);
          neededKeys.add(streamKey);
          const alias = this.streamAliases.get(streamKey);
          if (alias) neededKeys.add(alias);
          if (clip.mediaId) neededKeys.add(clip.mediaId);
        }
      }
    }

    // Streams whose clips have all expired are dropped; a stream that is still
    // scheduled later is kept so we don't pay an init + seek when it comes back.
    if (this.streamPlan) {
      for (const stream of this.streamPlan.streams) {
        if (stream.clipIds.some((clipId) => aliveClips.has(clipId))) neededKeys.add(stream.id);
      }
    }

    for (const [id, decoder] of this.mediaDecoders) {
      if (!neededKeys.has(id)) {
        const stats = (decoder as any)?.stats;
        if (stats) this.retiredDecodeStats.push({ streamId: id, stats: { ...stats } });
        if (typeof (decoder as any)?.dispose === 'function') {
          (decoder as any).dispose();
        }
        this.mediaDecoders.delete(id);
      }
    }
  }

  dispose() {
    this.discardPrefetch();
    for (const [streamId, decoder] of this.mediaDecoders) {
      const stats = (decoder as any)?.stats;
      if (stats) this.retiredDecodeStats.push({ streamId, stats: { ...stats } });
    }
    this.mediaDecoders.forEach(d => {
      if (typeof (d as any)?.dispose === 'function') {
        (d as any).dispose();
      }
    });
    this.mediaDecoders.clear();
  }
}
