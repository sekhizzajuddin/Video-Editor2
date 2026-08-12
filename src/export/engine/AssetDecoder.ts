import * as MP4Box from 'mp4box';
import { FramePool } from './memory/FramePool';

export interface AssetFrame {
  timestamp: number; // in microseconds
  frame: VideoFrame;
}

export class AssetDecoder {
  private url: string;
  private decoder: VideoDecoder | null = null;
  private mp4boxfile: any;
  private trackId: number = 0;
  private framePool: FramePool;
  
  private frames: AssetFrame[] = [];
  private isReady = false;
  private onReadyCallback: (() => void) | null = null;
  private decodeCallback: ((frame: VideoFrame) => void) | null = null;

  constructor(url: string, framePool: FramePool) {
    this.url = url;
    this.framePool = framePool;
    
    this.mp4boxfile = MP4Box.createFile();
    
    this.mp4boxfile.onReady = (info: any) => {
      const track = info.videoTracks[0];
      if (!track) throw new Error('No video track found');
      
      this.trackId = track.id;
      this.mp4boxfile.setExtractionOptions(this.trackId, null, { nbSamples: 1000 });
      this.mp4boxfile.start();

      this.initDecoder(track);
    };

    this.mp4boxfile.onSamples = (id: number, user: any, samples: any[]) => {
      if (id !== this.trackId || !this.decoder) return;

      for (const sample of samples) {
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (sample.cts * 1000000) / sample.timescale,
          duration: (sample.duration * 1000000) / sample.timescale,
          data: sample.data
        });
        
        try {
          this.decoder.decode(chunk);
        } catch (err) {
          console.error('Decode error', err);
        }
      }
    };
  }

  private initDecoder(trackInfo: any) {
    this.decoder = new VideoDecoder({
      output: (frame) => {
        if (this.decodeCallback) {
          this.decodeCallback(frame);
        } else {
          // If no immediate callback, buffer the frames 
          // (Caution: buffering VideoFrames consumes massive memory, so usually we only decode on demand)
          this.frames.push({
            timestamp: frame.timestamp,
            frame
          });
          // For safety, only buffer up to 10 frames
          if (this.frames.length > 10) {
            const old = this.frames.shift();
            old?.frame.close();
          }
        }
      },
      error: (e) => console.error('VideoDecoder error', e)
    });

    // A simple description for H.264 (AVC)
    // You'd ideally parse this from the avcC box in mp4box
    const codec = trackInfo.codec.startsWith('avc1') ? trackInfo.codec : 'avc1.42E01E';

    this.decoder.configure({
      codec: codec,
      codedWidth: trackInfo.video.width,
      codedHeight: trackInfo.video.height,
      description: this.createDescription(trackInfo)
    });

    this.isReady = true;
    if (this.onReadyCallback) this.onReadyCallback();
  }

  // Helper to extract avcC box for decoder description
  private createDescription(trackInfo: any): Uint8Array | undefined {
    try {
      // Very basic extraction for mp4box.js
      // The trackInfo usually has an array of boxes or similar.
      // This is a placeholder since mp4box doesn't easily expose the raw description buffer directly
      // without walking the box tree (moov -> trak -> mdia -> minf -> stbl -> stsd -> avc1 -> avcC).
      // However, WebCodecs in modern browsers sometimes doesn't strictly need it for basic avc1.
      return undefined; 
    } catch (e) {
      return undefined;
    }
  }

  async load(): Promise<void> {
    const response = await fetch(this.url);
    const buffer = await response.arrayBuffer();
    
    (buffer as any).fileStart = 0;
    this.mp4boxfile.appendBuffer(buffer as any);
    this.mp4boxfile.flush();
    
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
      } else {
        this.onReadyCallback = resolve;
      }
    });
  }

  // Get a frame exactly at the timestamp
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.frames.length === 0) return null;

    // For Phase 2 scaffolding, we just return the closest buffered frame.
    const closest = this.frames.reduce((prev, curr) => {
      return (Math.abs(curr.timestamp - timestampMicroseconds) < Math.abs(prev.timestamp - timestampMicroseconds) ? curr : prev);
    });
    
    if (closest) {
      // Clone it so the pool doesn't accidentally close the cached one
      return closest.frame.clone();
    }
    return null;
  }

  dispose() {
    this.decoder?.close();
    this.frames.forEach(f => f.frame.close());
    this.frames = [];
  }
}
