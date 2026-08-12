import * as MP4Box from 'mp4box';
import { FramePool } from './memory/FramePool';

export interface AssetFrame {
  timestamp: number; // µs
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

  // Compressed MP4 samples stored in RAM (typically only a few MBs)
  private samples: StoredSample[] = [];

  // Live decoding state
  private decoder: VideoDecoder | null = null;
  private decoderConfig: VideoDecoderConfig | null = null;
  private decodedQueue: AssetFrame[] = [];
  private nextSampleIdx: number = 0;

  private onReadyCallback: (() => void) | null = null;

  constructor(url: string, framePool: FramePool) {
    this.url = url;
    this.framePool = framePool;

    this.mp4boxfile = MP4Box.createFile();

    this.mp4boxfile.onReady = (info: any) => {
      const track = info.videoTracks?.[0];
      if (!track) {
        console.warn('[AssetDecoder] No video track found:', this.url);
        this.onReadyCallback?.();
        return;
      }
      this.trackId = track.id;
      this.trackInfo = track;
      this.mp4boxfile.setExtractionOptions(this.trackId, null, { nbSamples: 100000 });
      this.mp4boxfile.start();
      this.onReadyCallback?.();
    };

    this.mp4boxfile.onSamples = (_id: number, _user: any, samples: any[]) => {
      for (const sample of samples) {
        this.samples.push({
          timestamp: Math.round((sample.cts * 1_000_000) / sample.timescale),
          duration:  Math.round((sample.duration * 1_000_000) / sample.timescale),
          data:      new Uint8Array(sample.data),
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

    // Wait for MP4Box to read track header
    await new Promise<void>((resolve) => {
      if (this.trackInfo) { resolve(); return; }
      this.onReadyCallback = resolve;
      setTimeout(resolve, 3000);
    });

    // Give MP4Box 150ms to finish sample parsing
    await new Promise<void>((r) => setTimeout(r, 150));
    this.samples.sort((a, b) => a.timestamp - b.timestamp);

    if (this.samples.length === 0 || !this.trackInfo) {
      console.warn('[AssetDecoder] Empty media or failed track parsing');
      return;
    }

    const description = this.extractCodecDescription();
    const codec  = this.trackInfo.codec ?? 'avc1.42E01E';
    const width  = this.trackInfo.video?.width  ?? 1920;
    const height = this.trackInfo.video?.height ?? 1080;

    this.decoderConfig = {
      codec,
      codedWidth: width,
      codedHeight: height,
    };
    if (description) {
      this.decoderConfig.description = description;
    }

    this.initDecoder();
    console.log(`[AssetDecoder] v3 loaded ${this.samples.length} compressed samples | ${codec} ${width}x${height}`);
  }

  private initDecoder(): void {
    if (this.decoder) {
      try { this.decoder.close(); } catch {}
      this.decoder = null;
    }

    this.clearDecodedQueue();
    this.nextSampleIdx = 0;

    if (!this.decoderConfig) return;

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.decodedQueue.push({ timestamp: frame.timestamp, frame });
      },
      error: (e) => {
        console.warn('[AssetDecoder] VideoDecoder error:', e.message);
      },
    });

    try {
      this.decoder.configure(this.decoderConfig);
    } catch (e: any) {
      console.error('[AssetDecoder] VideoDecoder configure failed:', e.message);
    }
  }

  /** Extract AVCDecoderConfigurationRecord (avcC) or HEVCDecoderConfigurationRecord (hvcC) bytes */
  private extractCodecDescription(): Uint8Array | undefined {
    try {
      const trak = this.mp4boxfile.getTrackById?.(this.trackId);
      const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
      const box = entry?.avcC ?? entry?.hvcC;
      if (!box) return undefined;

      const DataStream = (MP4Box as any).DataStream;
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // Skip 8-byte box header
    } catch (e) {
      console.warn('[AssetDecoder] Could not extract codec description:', e);
      return undefined;
    }
  }

  /**
   * On-demand streaming decoder: decodes samples as needed for the requested timestamp.
   * Keeps VRAM footprint minimal by discarding old VideoFrames.
   */
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.samples.length === 0 || !this.decoder) return null;

    // 1. Purge old frames from decoded queue (more than 100ms behind requested timestamp)
    const purgeThreshold = timestampMicroseconds - 100_000;
    while (this.decodedQueue.length > 1 && this.decodedQueue[0].timestamp < purgeThreshold) {
      const old = this.decodedQueue.shift();
      try { old?.frame.close(); } catch {}
    }

    // 2. Check if we need to seek backward
    const lastDecodedTs = this.decodedQueue.length > 0
      ? this.decodedQueue[this.decodedQueue.length - 1].timestamp
      : -1;

    // If requested timestamp is behind our last sample index or queue, seek
    const nextSampleTs = this.nextSampleIdx < this.samples.length
      ? this.samples[this.nextSampleIdx].timestamp
      : Infinity;

    if (timestampMicroseconds < lastDecodedTs - 500_000 || (this.decodedQueue.length === 0 && timestampMicroseconds < nextSampleTs - 100_000)) {
      this.seekToTimestamp(timestampMicroseconds);
    }

    // 3. Decode forward until we reach timestampMicroseconds (or end of samples)
    let attempts = 0;
    while (attempts < 1000) {
      attempts++;

      // Check if we have a frame at or after target timestamp in queue
      const latestInQueue = this.decodedQueue.length > 0
        ? this.decodedQueue[this.decodedQueue.length - 1].timestamp
        : -1;

      if (latestInQueue >= timestampMicroseconds || this.nextSampleIdx >= this.samples.length) {
        // We have enough frames, or reached end of file
        break;
      }

      // Backpressure management: wait if decode queue is full
      if (this.decoder.decodeQueueSize > 6) {
        await new Promise((r) => setTimeout(r, 4));
      }

      // Feed next batch of samples (up to 5 samples at a time)
      const batchEnd = Math.min(this.nextSampleIdx + 5, this.samples.length);
      while (this.nextSampleIdx < batchEnd) {
        const sample = this.samples[this.nextSampleIdx];
        this.nextSampleIdx++;

        if (this.decoder.state === 'closed') {
          this.initDecoder();
          break;
        }

        try {
          this.decoder.decode(new EncodedVideoChunk({
            type:      sample.isKeyframe ? 'key' : 'delta',
            timestamp: sample.timestamp,
            duration:  sample.duration,
            data:      sample.data,
          }));
        } catch (e: any) {
          console.warn(`[AssetDecoder] Decode chunk error @${sample.timestamp}:`, e.message);
        }
      }

      // Allow microtask yield so VideoDecoder output callback fires
      await new Promise((r) => setTimeout(r, 1));
    }

    if (this.decodedQueue.length === 0) return null;

    // 4. Binary search for the frame closest to timestampMicroseconds
    let lo = 0, hi = this.decodedQueue.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.decodedQueue[mid].timestamp < timestampMicroseconds) lo = mid + 1;
      else hi = mid;
    }

    let best = lo;
    if (lo > 0) {
      const prev = Math.abs(this.decodedQueue[lo - 1].timestamp - timestampMicroseconds);
      const curr = Math.abs(this.decodedQueue[lo].timestamp - timestampMicroseconds);
      if (prev < curr) best = lo - 1;
    }

    // Return a clone so caller can close() their handle safely
    return this.decodedQueue[best].frame.clone();
  }

  private seekToTimestamp(targetTs: number): void {
    // Find the nearest keyframe at or before targetTs
    let keyframeIdx = 0;
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].isKeyframe && this.samples[i].timestamp <= targetTs) {
        keyframeIdx = i;
      } else if (this.samples[i].timestamp > targetTs) {
        break;
      }
    }

    this.clearDecodedQueue();
    this.nextSampleIdx = keyframeIdx;

    if (this.decoder && this.decoder.state !== 'closed') {
      try { this.decoder.reset(); } catch {}
      if (this.decoderConfig) {
        try { this.decoder.configure(this.decoderConfig); } catch {}
      }
    } else {
      this.initDecoder();
    }
  }

  private clearDecodedQueue(): void {
    for (const item of this.decodedQueue) {
      try { item.frame.close(); } catch {}
    }
    this.decodedQueue = [];
  }

  dispose() {
    this.clearDecodedQueue();
    if (this.decoder) {
      try { this.decoder.close(); } catch {}
      this.decoder = null;
    }
    this.samples = [];
  }
}
