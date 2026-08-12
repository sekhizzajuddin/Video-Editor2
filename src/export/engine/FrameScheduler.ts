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
    
    // Sort tracks by zIndex (or their array order)
    const tracks = this.timeline.tracks || [];
    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (track.muted || track.isMuted) continue;
      
      for (const clip of track.clips || []) {
        // Is this clip visible at this timestamp?
        if (timestampSeconds >= clip.startTime && timestampSeconds < (clip.startTime + clip.duration)) {
          const transform = {
            x: clip.transform?.x ?? clip.position?.x ?? 0,
            y: clip.transform?.y ?? clip.position?.y ?? 0,
            scale: clip.transform?.scale ?? clip.scale ?? 100,
            rotation: clip.transform?.rotation ?? clip.rotation ?? 0,
          };
          
          if (track.type === 'video' && this.decoders.has(clip.id)) {
            const decoder = this.decoders.get(clip.id);
            // Calculate local clip time (accounting for trimming and speed)
            const localTimeSeconds = ((timestampSeconds - clip.startTime) * (clip.speed || 1)) + (clip.trimStart || clip.startOffset || 0);
            
            const frame = await decoder?.getFrameAt(localTimeSeconds * 1_000_000);
            if (frame) {
              layers.push({
                type: 'video',
                frame,
                opacity: clip.opacity !== undefined ? clip.opacity : 1,
                chromaKey: clip.chromaKey,
                transform,
                zIndex: clip.zIndex !== undefined ? clip.zIndex : trackIdx,
                sourceRotation: decoder?.rotation || 0,
              });
            }
          } else if (track.type === 'text') {
            layers.push({
              type: 'text',
              textData: clip,
              opacity: clip.opacity !== undefined ? clip.opacity : 1,
              transform,
              zIndex: clip.zIndex !== undefined ? clip.zIndex : trackIdx,
            });
          }
        }
      }
    }
    
    return layers.sort((a, b) => a.zIndex - b.zIndex);
  }

  dispose() {
    this.decoders.forEach(d => d.dispose());
    this.decoders.clear();
  }
}
