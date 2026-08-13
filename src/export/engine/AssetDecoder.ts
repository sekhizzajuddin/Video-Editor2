import * as MP4Box from 'mp4box';
import { FramePool } from './memory/FramePool';

export interface AssetFrame {
  timestamp: number; // µs (CTS - presentation time)
  frame: VideoFrame;
}

interface StoredSample {
  timestamp: number;   // µs (CTS)
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
  public rotation: number = 0;

  // Compressed MP4 samples in DTS (decoding) order from MP4Box
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
    // Samples arrive in DTS (decoding) order from MP4Box — do NOT re-sort.

    if (this.samples.length === 0 || !this.trackInfo) {
      console.warn('[AssetDecoder] Empty media or failed track parsing');
      return;
    }

    const description = this.extractCodecDescription();
    const codec  = this.trackInfo.codec ?? 'avc1.42E01E';
    const width  = this.trackInfo.video?.width  ?? 1920;
    const height = this.trackInfo.video?.height ?? 1080;

    // Extract rotation from MP4 track matrix
    let rotation = 0;
    const matrix = this.trackInfo.matrix;
    if (matrix && matrix.length === 9) {
      if (matrix[0] === 0 && matrix[1] === 65536 && matrix[3] === -65536 && matrix[4] === 0) {
        rotation = 90;
      } else if (matrix[0] === -65536 && matrix[1] === 0 && matrix[3] === 0 && matrix[4] === -65536) {
        rotation = 180;
      } else if (matrix[0] === 0 && matrix[1] === -65536 && matrix[3] === 65536 && matrix[4] === 0) {
        rotation = 270;
      }
    }
    this.rotation = rotation;

    this.decoderConfig = {
      codec,
      codedWidth: width,
      codedHeight: height,
    };
    if (description) {
      this.decoderConfig.description = description;
    }

    this.initDecoder();
    console.log(`[AssetDecoder] v7 streaming-decode ready | ${this.samples.length} samples | ${codec} ${width}x${height} | rotation=${rotation}`);
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
   * Streaming sequential decoder optimized for export.
   * 
   * Strategy for smooth export:
   * 1. Feed all compressed samples up to (and 500ms past) the target timestamp to the decoder
   * 2. Use decoder.flush() to guarantee all frames are decoded (no setTimeout polling)
   * 3. Sort decoded queue by CTS (presentation time) for correct frame selection
   * 4. Binary search for the closest frame
   * 5. Purge frames more than 1 second behind to bound memory usage
   */
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.samples.length === 0 || !this.decoder) return null;

    // 1. Purge old frames to bound memory, BUT never purge the currently active frame!
    // If the SECOND frame is also <= target, the FIRST frame is completely in the past.
    while (this.decodedQueue.length > 1) {
      if (this.decodedQueue[1].timestamp <= timestampMicroseconds) {
        const old = this.decodedQueue.shift();
        try { old?.frame.close(); } catch {}
      } else {
        break; // First frame is the active frame
      }
    }

    // 2. Feed compressed samples to decoder until we're past the target timestamp
    //    Feed all samples whose CTS <= target + 500ms (look-ahead for B-frame reordering)
    const lookAheadTarget = timestampMicroseconds + 500_000;
    let fedNewSamples = false;

    while (this.nextSampleIdx < this.samples.length) {
      const sample = this.samples[this.nextSampleIdx];

      // Stop feeding if we've gone well past the target AND we have frames past it
      if (sample.timestamp > lookAheadTarget && this.nextSampleIdx > 0) {
        // Check if the last frame we queued is past our target
        const lastQueuedCTS = this.decodedQueue.length > 0
          ? this.decodedQueue[this.decodedQueue.length - 1].timestamp
          : -1;
        if (lastQueuedCTS >= timestampMicroseconds) break;
      }

      if (this.decoder.state === 'closed') {
        this.initDecoder();
        if (!this.decoder) return null;
      }

      // Throttle decoder input queue to prevent hardware decoder crashes
      let queueRetries = 20;
      while (this.decoder.decodeQueueSize >= 15 && queueRetries > 0) {
        await new Promise(r => setTimeout(r, 5));
        queueRetries--;
      }

      try {
        this.decoder.decode(new EncodedVideoChunk({
          type:      sample.isKeyframe ? 'key' : 'delta',
          timestamp: sample.timestamp,
          duration:  sample.duration,
          data:      sample.data,
        }));
        fedNewSamples = true;
      } catch (e: any) {
        console.warn(`[AssetDecoder] Decode chunk error @${sample.timestamp}:`, e.message);
      }

      this.nextSampleIdx++;
    }

    // 3. Wait for the decoder to output the frames (hardware pipelining)
    // Use WebCodecs flush() to guarantee all fed chunks are fully decoded and output
    if (fedNewSamples && this.decoder && this.decoder.state === 'configured') {
      try {
        await this.decoder.flush();
      } catch (e: any) {
        console.warn('[AssetDecoder] Decoder flush error:', e.message);
      }
    }

    if (this.decodedQueue.length === 0) return null;

    // 4. Sort decoded queue by CTS (presentation time) for correct frame selection
    this.decodedQueue.sort((a, b) => a.timestamp - b.timestamp);

    // 5. Select the last decoded frame whose presentation timestamp is <= requested timestamp
    // Never select future frames (which causes frame jumping / stuttering)
    const epsilonUs = 1000; // 1ms rounding tolerance
    let bestIdx = -1;
    for (let i = 0; i < this.decodedQueue.length; i++) {
      if (this.decodedQueue[i].timestamp <= timestampMicroseconds + epsilonUs) {
        bestIdx = i;
      } else {
        break; // Queue is sorted ascending
      }
    }

    if (bestIdx === -1) {
      bestIdx = 0; // Fallback to first frame if before start
    }

    // Return a clone so caller can close() their copy independently
    return this.decodedQueue[bestIdx].frame.clone();
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
