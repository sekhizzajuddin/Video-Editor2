import { AssetDecoder } from './AssetDecoder';
import { StillImageSource } from './StillImageSource';
import { findActiveTransition, buildTransitionPlan } from '../../utils/transitionEngine';
import { resolveBlendPlan } from '../../utils/blendCompositor';
import { FramePool } from './memory/FramePool';

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
  if (!ramp || ramp.length < 2) {
    return elapsed * speed + trim;
  }
  // Lightweight engine: replicate timelineToSource linear approximation
  // Full bezier is expensive in worker; we approximate by walking segments.
  // This matches preview for simple ramps and prevents NaN seeking.
  try {
    // Use same engine as preview if available via import — but to avoid
    // heavy deps, implement quick linear scan.
    const keys = [...ramp].sort((a: any, b: any) => a.sourceTime - b.sourceTime);
    let timelineCursor = 0;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      const deltaSource = b.sourceTime - a.sourceTime;
      const avgSpeed = (a.speed + b.speed) / 2;
      const segTimeline = avgSpeed > 0.001 ? deltaSource / avgSpeed : 0;
      if (elapsed < timelineCursor + segTimeline) {
        const local = elapsed - timelineCursor;
        const ratio = segTimeline > 0.001 ? local / segTimeline : 0;
        return a.sourceTime + ratio * deltaSource * (a.speed / Math.max(0.001, avgSpeed));
      }
      timelineCursor += segTimeline;
    }
    // Beyond last segment
    const last = keys[keys.length - 1];
    return last.sourceTime + Math.max(0, elapsed - timelineCursor) * last.speed + trim;
  } catch {
    return elapsed * speed + trim;
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

export interface FramePlan {
  layers: RenderLayer[];
  overlays: FrameOverlay[];
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

  async getLayersAtTime(timestampSeconds: number): Promise<RenderLayer[]> {
    const layers: RenderLayer[] = [];
    const pending: Array<Promise<void>> = [];
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

            pending.push(
              (async () => {
                try {
                  const frame = await decoder?.getFrameAt(localTimeSeconds * 1_000_000);
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

    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }

    layers.sort((a, b) => (a.zIndex - b.zIndex) || ((a.order ?? 0) - (b.order ?? 0)));
    return layers;
  }

  async getFramePlanAtTime(timestampSeconds: number): Promise<FramePlan> {
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

  dispose() {
    this.mediaDecoders.forEach(d => d.dispose());
    this.mediaDecoders.clear();
  }
}
