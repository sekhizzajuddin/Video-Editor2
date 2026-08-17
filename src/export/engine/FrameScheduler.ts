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

export interface RenderLayer {
  type: 'video' | 'text' | 'image';
  frame?: CanvasImageSource | VideoFrame; // For video/image
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
  blendMode?: GlobalCompositeOperation;
  order?: number;
  transitionGeometry?: {
    translateX: number;
    translateY: number;
    scale: number;
    rotation: number;
    clipRect?: { x: number; y: number; w: number; h: number };
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
  public warnings: string[] = [];

  constructor(timeline: any, framePool: FramePool, mediaBuffers?: Record<string, any>) {
    this.timeline = timeline;
    this.framePool = framePool;
    this.mediaBuffers = mediaBuffers || {};
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
  }

  async getLayersAtTime(timestampSeconds: number): Promise<RenderLayer[]> {
    const layers: RenderLayer[] = [];
    const pending: Array<Promise<void>> = [];
    let order = 0;

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

          const layerDraw = plan && transitionRole
            ? (transitionRole === 'from' ? plan.from : plan.to)
            : null;
          if (layerDraw && !layerDraw.visible) continue;
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

          if (track.type === 'video' && clip.mediaId && this.mediaDecoders.has(clip.mediaId)) {
            const decoder = this.mediaDecoders.get(clip.mediaId);
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

    layers.sort((a, b) => (a.zIndex - b.zIndex) || ((a.order ?? 0) - (b.order ?? 0)));
    return layers;
  }

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
    this.mediaDecoders.forEach(d => d.dispose());
    this.mediaDecoders.clear();
  }
}
