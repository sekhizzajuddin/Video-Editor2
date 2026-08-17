import { AssetDecoder } from './AssetDecoder';
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
    const promises: Promise<void>[] = [];
    const mediaMap = new Map<string, any>();
    if (this.timeline.media) {
      for (const m of this.timeline.media) {
        mediaMap.set(m.id, m);
      }
    }

    for (const track of this.timeline.tracks || []) {
      if (track.type === 'video') {
        for (const clip of track.clips || []) {
          if (!this.decoders.has(clip.id)) {
            const media = mediaMap.get(clip.mediaId);
            const url = media?.url || clip.url || '';
            // Don't require a URL when the main thread already transferred the
            // raw bytes: restored/re-linked projects can have a dead/blob-less
            // URL (e.g. 'PENDING_RESTORE') while mediaBuffers holds the bytes
            // needed to decode. Skipping here silently produced black exports.
            const hasBuffer = !!this.mediaBuffers[clip.mediaId];
            if (!url && !hasBuffer) continue;

            const mediaName: string = media?.name || '';
            const isImage =
              media?.type === 'image' ||
              /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(mediaName);

            // Images used to be pushed through the MP4 demuxer, which cannot
            // parse them; every image clip exported as black. Route them to a
            // dedicated still-image source instead.
            if (isImage) {
              const source = new StillImageSource(url);
              this.decoders.set(clip.id, source);
              promises.push(source.load());
              continue;
            }

            const decoder = new AssetDecoder(url, this.framePool);
            this.decoders.set(clip.id, decoder);
            // Use pre-fetched ArrayBuffer if available (critical fix for blob URLs
            // which cannot be fetched from inside a worker thread).
            const preBuffer = this.mediaBuffers[clip.mediaId];
            promises.push(
              decoder.load(preBuffer).then(async () => {
                if (decoder.ready) return;
                // MP4 demux failed. If the file is actually a still image with
                // a video-ish name/type, decode it as one before giving up.
                const fallback = new StillImageSource(url);
                await fallback.load();
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

    await Promise.allSettled(promises);
  }

  async getLayersAtTime(timestampSeconds: number): Promise<RenderLayer[]> {
    const layers: RenderLayer[] = [];
    // PERF (export stutter fix): video decodes used to be awaited one clip at a
    // time inside this loop. Each `getFrameAt` can block while its decoder drains,
    // so the cost of a frame was the SUM of every track's decode latency instead of
    // the MAX. With one video track exports ran near real time; with three or four
    // the per-frame cost tripled and the export visibly crawled.
    //
    // Decoders are fully independent (one VideoDecoder per clip), so we now kick
    // them all off first and await them together. Text layers need no async work
    // and are pushed inline.
    const pending: Array<Promise<void>> = [];
    let order = 0;

    // Sort tracks by zIndex (or their array order)
    const tracks = this.timeline.tracks || [];
    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (track.muted || track.isMuted || track.hidden) continue;

      // Resolve any clip-to-clip transition active on this track for this frame.
      // Uses the SAME engine as the live preview, so an export is guaranteed to
      // match what the user saw — previously the exporter had no transition
      // support at all and silently produced hard cuts.
      const activeTransition = findActiveTransition(track.clips || [], timestampSeconds);
      const plan = activeTransition ? buildTransitionPlan(activeTransition) : null;

      for (const clip of track.clips || []) {
        if (clip.disabled) continue;

        // A clip taking part in a transition must be rendered even when the
        // playhead has already passed its end (the outgoing clip keeps showing
        // during the blend), so widen the visibility test for those two clips.
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

          // Fold the transition's contribution into this layer.
          const layerDraw = plan && transitionRole
            ? (transitionRole === 'from' ? plan.from : plan.to)
            : null;
          if (layerDraw && !layerDraw.visible) continue; // fully faded out
          const baseOpacity = clip.opacity !== undefined ? clip.opacity : 1;
          const withTransition = layerDraw ? baseOpacity * layerDraw.opacity : baseOpacity;

          // Match the preview's blend semantics. Partial blend intensity needs a
          // backdrop copy, which this compositor cannot express per-layer, so we
          // approximate it by scaling alpha — full-strength and Normal blends
          // (the overwhelmingly common cases) are exact.
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
            // Calculate local clip time (accounting for trimming and speed)
            // Clamp into the clip's own range: during a transition the playhead
            // can sit slightly outside the outgoing clip, and asking a decoder for
            // a negative/overrun timestamp yields a black or repeated frame.
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
      // allSettled: one failing decoder must not abort the whole frame.
      await Promise.allSettled(pending);
    }

    // Layers resolve out of order when decoded concurrently, so the sort below is
    // what establishes correct compositing order; `order` breaks zIndex ties using
    // the original track/clip enumeration order.
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
