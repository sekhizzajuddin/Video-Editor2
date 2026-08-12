import * as MP4Box from 'mp4box';
import { FramePool } from './memory/FramePool';

export interface AssetFrame {
  timestamp: number; // in microseconds
  frame: VideoFrame;
}

interface StoredSample {
  timestamp: number;   // µs
  duration: number;    // µs
  data: Uint8Array;
  isKeyframe: boolean;
}

export class AssetDecoder {
  private url: string;
  private framePool: FramePool;
  private mp4boxfile: any;
  private trackId: number = 0;
  private trackInfo: any = null;

  // All encoded samples stored in memory (compressed – small footprint)
  private samples: StoredSample[] = [];
  // All decoded frames stored for lookup
  private decodedFrames: AssetFrame[] = [];

  private isReady = false;
  private allSamplesCollected = false;
  private onReadyCallback: (() => void) | null = null;

  constructor(url: string, framePool: FramePool) {
    this.url = url;
    this.framePool = framePool;

    this.mp4boxfile = MP4Box.createFile();

    this.mp4boxfile.onReady = (info: any) => {
      const track = info.videoTracks[0];
      if (!track) {
        console.warn('[AssetDecoder] No video track found in:', this.url);
        if (this.onReadyCallback) this.onReadyCallback();
        return;
      }

      this.trackId = track.id;
      this.trackInfo = track;

      // Extract ALL samples (high nbSamples ensures we get the whole file)
      this.mp4boxfile.setExtractionOptions(this.trackId, null, { nbSamples: 100000 });
      this.mp4boxfile.start();
    };

    this.mp4boxfile.onSamples = (_id: number, _user: any, samples: any[]) => {
      // Collect compressed samples — DO NOT decode yet
      for (const sample of samples) {
        this.samples.push({
          timestamp: Math.round((sample.cts * 1_000_000) / sample.timescale),
          duration: Math.round((sample.duration * 1_000_000) / sample.timescale),
          data: new Uint8Array(sample.data),
          isKeyframe: sample.is_sync,
        });
      }
    };
  }

  async load(): Promise<void> {
    const response = await fetch(this.url);
    const buffer = await response.arrayBuffer();

    (buffer as any).fileStart = 0;
    this.mp4boxfile.appendBuffer(buffer as any);
    this.mp4boxfile.flush();

    // Wait for onReady to fire (which starts sample extraction)
    await new Promise<void>((resolve) => {
      if (this.trackInfo) {
        resolve(); // already ready
      } else {
        this.onReadyCallback = resolve;
        // Give mp4box time to process
        setTimeout(() => resolve(), 2000);
      }
    });

    // Give mp4box time to finish extracting all samples from the buffer
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    // Sort samples by timestamp
    this.samples.sort((a, b) => a.timestamp - b.timestamp);

    this.isReady = true;

    // Pre-decode all frames now (sequential export makes this safe)
    await this.decodeAllFrames();
  }

  private async decodeAllFrames(): Promise<void> {
    if (this.samples.length === 0 || !this.trackInfo) return;

    return new Promise<void>((resolve, reject) => {
      const codec = this.trackInfo.codec?.startsWith('avc1')
        ? this.trackInfo.codec
        : 'avc1.42E01E';

      const decoder = new VideoDecoder({
        output: (frame) => {
          this.decodedFrames.push({
            timestamp: frame.timestamp,
            frame,
          });
        },
        error: (e) => {
          console.error('[AssetDecoder] Decode error:', e);
        },
      });

      decoder.configure({
        codec,
        codedWidth: this.trackInfo.video?.width || 1920,
        codedHeight: this.trackInfo.video?.height || 1080,
      });

      // Submit all samples in order
      for (const sample of this.samples) {
        try {
          decoder.decode(new EncodedVideoChunk({
            type: sample.isKeyframe ? 'key' : 'delta',
            timestamp: sample.timestamp,
            duration: sample.duration,
            data: sample.data,
          }));
        } catch (e) {
          console.warn('[AssetDecoder] Skipped bad sample at', sample.timestamp, e);
        }
      }

      // Flush ensures all queued frames are output before we resolve
      decoder.flush().then(() => {
        decoder.close();
        // Sort decoded frames by timestamp for fast lookup
        this.decodedFrames.sort((a, b) => a.timestamp - b.timestamp);
        resolve();
      }).catch((e) => {
        console.error('[AssetDecoder] Flush error:', e);
        decoder.close();
        resolve(); // resolve anyway with whatever frames we have
      });
    });
  }

  /** Returns the VideoFrame closest to the requested timestamp (µs). */
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.decodedFrames.length === 0) return null;

    // Binary search for the closest frame
    let lo = 0;
    let hi = this.decodedFrames.length - 1;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.decodedFrames[mid].timestamp < timestampMicroseconds) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Check neighbors and pick the closest
    let best = lo;
    if (lo > 0) {
      const prevDiff = Math.abs(this.decodedFrames[lo - 1].timestamp - timestampMicroseconds);
      const currDiff = Math.abs(this.decodedFrames[lo].timestamp - timestampMicroseconds);
      if (prevDiff < currDiff) best = lo - 1;
    }

    // Clone so the caller can close their copy without corrupting our cache
    return this.decodedFrames[best].frame.clone();
  }

  dispose() {
    for (const af of this.decodedFrames) {
      af.frame.close();
    }
    this.decodedFrames = [];
    this.samples = [];
  }
}
