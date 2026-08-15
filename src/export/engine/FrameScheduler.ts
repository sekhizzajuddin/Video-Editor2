import { AssetDecoder } from './AssetDecoder';
import { FramePool } from './memory/FramePool';

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
   * Enumeration order of this layer within its frame. Video layers now decode
   * concurrently and therefore resolve out of order, so zIndex ties are broken
   * with this instead of relying on push order.
   */
  order?: number;
}

export class FrameScheduler {
  private timeline: any;
  private framePool: FramePool;
  private decoders: Map<string, AssetDecoder> = new Map();

  constructor(timeline: any, framePool: FramePool) {
    this.timeline = timeline;
    this.framePool = framePool;
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
            const url = media?.url || clip.url;
            if (url) {
              const decoder = new AssetDecoder(url, this.framePool);
              this.decoders.set(clip.id, decoder);
              promises.push(decoder.load());
            }
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

      for (const clip of track.clips || []) {
        if (clip.disabled) continue;
        // Is this clip visible at this timestamp?
        if (timestampSeconds >= clip.startTime && timestampSeconds < (clip.startTime + clip.duration)) {
          const transform = {
            x: clip.transform?.x ?? clip.position?.x ?? 0,
            y: clip.transform?.y ?? clip.position?.y ?? 0,
            scale: clip.transform?.scale ?? clip.scale ?? 100,
            rotation: clip.transform?.rotation ?? clip.rotation ?? 0,
          };
          const zIndex = clip.zIndex !== undefined ? clip.zIndex : trackIdx;
          const layerOrder = order++;

          if (track.type === 'video' && this.decoders.has(clip.id)) {
            const decoder = this.decoders.get(clip.id);
            // Calculate local clip time (accounting for trimming and speed)
            const localTimeSeconds = ((timestampSeconds - clip.startTime) * (clip.speed || 1)) + (clip.trimStart || clip.startOffset || 0);

            pending.push(
              (async () => {
                const frame = await decoder?.getFrameAt(localTimeSeconds * 1_000_000);
                if (frame) {
                  layers.push({
                    type: 'video',
                    frame,
                    opacity: clip.opacity !== undefined ? clip.opacity : 1,
                    chromaKey: clip.chromaKey,
                    transform,
                    zIndex,
                    order: layerOrder,
                    sourceRotation: decoder?.rotation || 0,
                  });
                }
              })()
            );
          } else if (track.type === 'text') {
            layers.push({
              type: 'text',
              textData: clip,
              opacity: clip.opacity !== undefined ? clip.opacity : 1,
              transform,
              zIndex,
              order: layerOrder,
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
    return layers.sort((a, b) => (a.zIndex - b.zIndex) || ((a.order ?? 0) - (b.order ?? 0)));
  }

  dispose() {
    this.decoders.forEach(d => d.dispose());
    this.decoders.clear();
  }
}
