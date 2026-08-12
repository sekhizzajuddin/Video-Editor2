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
    // 1. Find all video clips in the timeline
    // 2. Instantiate AssetDecoder for each unique source URL
    // 3. Load them
    const promises: Promise<void>[] = [];
    
    for (const track of this.timeline.tracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (!this.decoders.has(clip.id)) {
            // Using a blob URL or direct URL from the clip
            const url = clip.file?.blob ? URL.createObjectURL(clip.file.blob) : (clip.file?.url || clip.url);
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
    
    // Convert to microseconds
    const timeMicro = timestampSeconds * 1_000_000;
    
    // Sort tracks by zIndex (or just their array order)
    for (let trackIdx = 0; trackIdx < this.timeline.tracks.length; trackIdx++) {
      const track = this.timeline.tracks[trackIdx];
      
      for (const clip of track.clips) {
        // Is this clip visible at this timestamp?
        if (timestampSeconds >= clip.startTime && timestampSeconds < (clip.startTime + clip.duration)) {
          
          if (track.type === 'video' && this.decoders.has(clip.id)) {
            const decoder = this.decoders.get(clip.id);
            // Calculate local clip time (accounting for trimming and speed)
            const localTimeSeconds = ((timestampSeconds - clip.startTime) * (clip.speed || 1)) + (clip.startOffset || 0);
            
            const frame = await decoder?.getFrameAt(localTimeSeconds * 1_000_000);
            if (frame) {
              layers.push({
                type: 'video',
                frame,
                opacity: 1, // To be extracted from clip.properties or keyframes
                chromaKey: clip.chromaKey,
                transform: {
                  x: clip.position?.x || 0,
                  y: clip.position?.y || 0,
                  scale: clip.scale || 1,
                  rotation: clip.rotation || 0,
                },
                zIndex: trackIdx,
              });
            }
          } else if (track.type === 'text') {
            layers.push({
              type: 'text',
              textData: clip, // Handled by WebGL text renderer later
              opacity: 1,
              transform: {
                x: clip.position?.x || 0,
                y: clip.position?.y || 0,
                scale: clip.scale || 1,
                rotation: clip.rotation || 0,
              },
              zIndex: trackIdx,
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
