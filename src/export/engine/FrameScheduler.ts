import { AssetDecoder, DemuxedMedia } from './AssetDecoder';
import { StillImageSource } from './StillImageSource';
import { findActiveTransition, buildTransitionPlan } from '../../utils/transitionEngine';
import { resolveBlendPlan } from '../../utils/blendCompositor';
import { FramePool } from './memory/FramePool';

/**
 * Anything that can hand the compositor a VideoFrame for a clip: a real MP4
 * demux/decode pipeline (AssetDecoder) or a decoded still (StillImageSource).
 */
export interface ClipFrameSource {
  rotation: number;
  ready: boolean;
  loadError: string | null;
  getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null>;
  dispose(): void;
}

export interface RenderLayer {
  type: 'video' | 'text' | 'image';
  frame?: VideoFrame; // For video/image
  textData?: any;     // For text
  opacity: number;
  chromaKey?: {
    enabled: boolean;
    color: string;
    threshold: number;
    softness: number;
    spillSuppression: number;
    edgeFeather: number;
  };
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  zIndex: number;
  sourceRotation?: number;
  /**
   * Canvas composite operation from the clip's transform, already resolved
   * against its blend intensity. The exporter previously ignored blend modes
   * entirely, so a blended clip looked correct in the preview and rendered as a
   * plain Normal composite in the exported file.
   */
  blendMode?: GlobalCompositeOperation;
  /**
   * Enumeration order of this layer within its frame. Video layers now decode
   * concurrently and therefore resolve out of order, so zIndex ties are broken
   * with this instead of relying on push order.
   */
  order?: number;
  /**
   * Extra geometry contributed by an active clip-to-clip transition, expressed in
   * fractions of the frame so it is resolution independent. Applied by the
   * Compositor on top of the clip's own transform.
   */
  transitionGeometry?: {
    translateX: number;
    translateY: number;
    scale: number;
    rotation: number;
    clipRect?: { x: number; y: number; w: number; h: number };
  };
}

/** Full-frame overlay (flash / dip-to-colour / light leak) for a single frame. */
export interface FrameOverlay {
  color: string;
  alpha: number;
}

/** Everything needed to composite one output frame. */
export interface FramePlan {
  layers: RenderLayer[];
  overlays: FrameOverlay[];
}

export class FrameScheduler {
  private timeline: any;
  private framePool: FramePool;
  private mediaBuffers: Record<string, ArrayBuffer>;
  private decoders: Map<string, ClipFrameSource> = new Map();
  /**
   * Human-readable problems collected while preparing frame sources (media that
   * failed to demux/decode). Surfaced to the user as export warnings so a
   * black/blank output is never silent.
   */
  public warnings: string[] = [];

  constructor(timeline: any, framePool: FramePool, mediaBuffers?: Record<string, ArrayBuffer>) {
    this.timeline = timeline;
    this.framePool = framePool;
    this.mediaBuffers = mediaBuffers || {};
  }

  async initializeDecoders() {
    const mediaMap = new Map<string, any>();
    if (this.timeline.media) {
      for (const m of this.timeline.media) {
        mediaMap.set(m.id, m);
      }
    }

    // 1. Convert Blobs to ArrayBuffers once per unique mediaId to save memory
    if (this.mediaBuffers) {
      for (const mediaId of Object.keys(this.mediaBuffers)) {
        const blobOrBuffer = this.mediaBuffers[mediaId];
        if (blobOrBuffer instanceof Blob) {
          this.mediaBuffers[mediaId] = await blobOrBuffer.arrayBuffer();
        }
      }
    }

    // 2. Pre-demux unique video media files once
    const demuxPromises: Promise<void>[] = [];
    const demuxCache = new Map<string, DemuxedMedia>();

    for (const track of this.timeline.tracks || []) {
      if (track.type === 'video') {
        for (const clip of track.clips || []) {
          const mediaId = clip.mediaId;
          if (mediaId && !demuxCache.has(mediaId)) {
            const media = mediaMap.get(mediaId);
            const url = media?.url || clip.url || '';
            const preBuffer = this.mediaBuffers[mediaId];
            const mediaName: string = media?.name || '';
            const isImage =
              media?.type === 'image' ||
              /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(mediaName);

            if (!isImage && (url || preBuffer)) {
              demuxCache.set(mediaId, null as any); // Mark as pending
              demuxPromises.push(
                AssetDecoder.demux(url, preBuffer).then((demuxed) => {
                  demuxCache.set(mediaId, demuxed);
                })
              );
            }
          }
        }
      }
    }

    await Promise.allSettled(demuxPromises);

    // 3. Initialize clip decoders / image sources
    const loadPromises: Promise<void>[] = [];

    for (const track of this.timeline.tracks || []) {
      if (track.type === 'video') {
        for (const clip of track.clips || []) {
          if (!this.decoders.has(clip.id)) {
            const media = mediaMap.get(clip.mediaId);
            const url = media?.url || clip.url || '';
            const preBuffer = this.mediaBuffers[clip.mediaId];
            const mediaName: string = media?.name || '';
            const isImage =
              media?.type === 'image' ||
              /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(mediaName);

            if (isImage) {
              const source = new StillImageSource(url);
              this.decoders.set(clip.id, source);
              loadPromises.push(source.load(preBuffer));
              continue;
            }

            const demuxed = clip.mediaId ? demuxCache.get(clip.mediaId) : null;
            if (demuxed && demuxed.ready) {
              const decoder = new AssetDecoder(url, this.framePool);
              decoder.initFromDemuxed(demuxed);
              this.decoders.set(clip.id, decoder);
            } else {
              // Fallback to standalone load or StillImageSource
              const decoder = new AssetDecoder(url, this.framePool);
              this.decoders.set(clip.id, decoder);
              loadPromises.push(
                decoder.load(preBuffer).then(async () => {
                  if (decoder.ready) return;
                  const fallback = new StillImageSource(url);
                  await fallback.load(preBuffer);
                  if (fallback.ready) {
                    decoder.dispose();
                    this.decoders.set(clip.id, fallback);
                  } else {
                    fallback.dispose();
                    this.warnings.push(
                      `"${mediaName || clip.mediaId}" could not be decoded for export` +
                      (decoder.loadError ? ` (${decoder.loadError})` : '') +
                      '. Its frames will be missing from the output.'
                    );
                  }
                })
              );
            }
          }
        }
      }
    }

    await Promise.allSettled(loadPromises);
  }

  async getLayersAtTime(timestampSeconds: number): Promise<RenderLayer[]> {
    const layers: RenderLayer[] = [];
    const pending: Array<Promise<void>> = [];
    let order = 0;

    // Release decoders for completed clips to keep GPU hardware decoder sessions low
    for (const track of this.timeline.tracks || []) {
      for (const clip of track.clips || []) {
        if (timestampSeconds > (clip.startTime + clip.duration) + 0.5) {
          const dec = this.decoders.get(clip.id);
          if (dec instanceof AssetDecoder) {
            dec.releaseDecoder();
          }
        }
      }
    }

    // Sort tracks by zIndex (or their array order)
    const tracks = this.timeline.tracks || [];
    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (track.muted || track.isMuted || track.hidden) continue;

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
          const transform = {
            x: clip.transform?.x ?? clip.position?.x ?? 0,
            y: clip.transform?.y ?? clip.position?.y ?? 0,
            scale: clip.transform?.scale ?? clip.scale ?? 100,
            rotation: clip.transform?.rotation ?? clip.rotation ?? 0,
          };
          const zIndex = clip.zIndex !== undefined ? clip.zIndex : trackIdx;
          const layerOrder = order++;

          // Fold the transition's contribution into this layer
          const layerDraw = plan && transitionRole
            ? (transitionRole === 'from' ? plan.from : plan.to)
            : null;
          if (layerDraw && !layerDraw.visible) continue; // fully faded out
          const baseOpacity = clip.opacity !== undefined ? clip.opacity : 1;
          const withTransition = layerDraw ? baseOpacity * layerDraw.opacity : baseOpacity;

          const blendPlan = resolveBlendPlan(
            clip.transform?.blendMode,
            clip.transform?.blendIntensity,
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

          if (track.type === 'video' && this.decoders.has(clip.id)) {
            const decoder = this.decoders.get(clip.id);
            const clampedTime = Math.min(
              Math.max(timestampSeconds, clip.startTime),
              clip.startTime + clip.duration
            );
            const localTimeSeconds = ((clampedTime - clip.startTime) * (clip.speed || 1)) + (clip.trimStart || clip.startOffset || 0);

            pending.push(
              (async () => {
                const frame = await decoder?.getFrameAt(localTimeSeconds * 1_000_000);
                if (frame) {
                  layers.push({
                    type: 'video',
                    frame,
                    opacity,
                    chromaKey: clip.chromaKey,
                    transform,
                    zIndex,
                    order: layerOrder,
                    transitionGeometry,
                    blendMode,
                    sourceRotation: decoder?.rotation || 0,
                  });
                }
              })()
            );
          } else if (track.type === 'text') {
            layers.push({
              type: 'text',
              textData: clip,
              opacity,
              transform,
              zIndex,
              order: layerOrder,
              transitionGeometry,
              blendMode,
            });
          }
        }
      }
    }

    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }

    // Sort layers by zIndex and order
    layers.sort((a, b) => (a.zIndex - b.zIndex) || ((a.order ?? 0) - (b.order ?? 0)));
    return layers;
  }

  /**
   * Full frame plan: layers plus any full-frame transition overlays.
   * Preferred over getLayersAtTime() for rendering.
   */
  async getFramePlanAtTime(timestampSeconds: number): Promise<FramePlan> {
    const overlays: FrameOverlay[] = [];
    for (const track of this.timeline.tracks || []) {
      if (track.muted || track.isMuted || track.hidden) continue;
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
    this.decoders.forEach(d => d.dispose());
    this.decoders.clear();
  }
}
