import * as MP4Box from 'mp4box';
import { FramePool } from './memory/FramePool';

export interface AssetFrame {
  timestamp: number; // µs
  frame: VideoFrame;
}

interface StoredSample {
  timestamp: number;   // µs (CTS - presentation time)
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

  // Compressed MP4 samples stored in RAM (in DTS/muxing order from MP4Box)
  private samples: StoredSample[] = [];

  // All decoded frames sorted by presentation timestamp for O(1) lookup
  private allFrames: AssetFrame[] = [];
  private isFullyDecoded: boolean = false;

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
    // Samples arrive in DTS (decoding) order from MP4Box — do NOT re-sort them.

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

    const decoderConfig: VideoDecoderConfig = {
      codec,
      codedWidth: width,
      codedHeight: height,
    };
    if (description) {
      decoderConfig.description = description;
    }

    // ── Pre-decode ALL frames upfront ──────────────────────────────────────
    // This eliminates per-frame decode latency during the render loop.
    // Frames are decoded in DTS order (as MP4Box provides them) and the
    // output queue is sorted by CTS (presentation time) for correct lookup.
    console.log(`[AssetDecoder] v6 pre-decoding ${this.samples.length} samples | ${codec} ${width}x${height}`);

    const collectedFrames: AssetFrame[] = [];

    const decoder = new VideoDecoder({
      output: (frame) => {
        collectedFrames.push({ timestamp: frame.timestamp, frame });
      },
      error: (e) => {
        console.warn('[AssetDecoder] VideoDecoder error during pre-decode:', e.message);
      },
    });

    try {
      decoder.configure(decoderConfig);
    } catch (e: any) {
      console.error('[AssetDecoder] VideoDecoder configure failed:', e.message);
      return;
    }

    // Feed ALL samples to decoder in DTS order
    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i];

      // Backpressure: if decoder has too many queued, wait for it to catch up
      while (decoder.decodeQueueSize > 20) {
        await new Promise<void>((r) => setTimeout(r, 2));
      }

      try {
        decoder.decode(new EncodedVideoChunk({
          type:      sample.isKeyframe ? 'key' : 'delta',
          timestamp: sample.timestamp,
          duration:  sample.duration,
          data:      sample.data,
        }));
      } catch (e: any) {
        console.warn(`[AssetDecoder] Decode chunk error @${sample.timestamp}:`, e.message);
      }
    }

    // Flush decoder to get any remaining frames
    try {
      await decoder.flush();
    } catch (e: any) {
      console.warn('[AssetDecoder] Flush error:', e.message);
    }

    // Allow any remaining output callbacks to fire
    await new Promise<void>((r) => setTimeout(r, 50));

    try { decoder.close(); } catch {}

    // Sort decoded frames by presentation timestamp (CTS) for correct lookup
    collectedFrames.sort((a, b) => a.timestamp - b.timestamp);
    this.allFrames = collectedFrames;
    this.isFullyDecoded = true;

    // Free the compressed samples — no longer needed
    this.samples = [];

    console.log(`[AssetDecoder] v6 pre-decoded ${this.allFrames.length} frames successfully`);
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
   * Instant frame lookup — all frames are pre-decoded and sorted by CTS.
   * Uses binary search for O(log n) performance.
   */
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.allFrames.length === 0) return null;

    // Binary search for the closest frame
    let lo = 0, hi = this.allFrames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.allFrames[mid].timestamp < timestampMicroseconds) lo = mid + 1;
      else hi = mid;
    }

    // Pick the closest between lo and lo-1
    let best = lo;
    if (lo > 0) {
      const prevDist = Math.abs(this.allFrames[lo - 1].timestamp - timestampMicroseconds);
      const currDist = Math.abs(this.allFrames[lo].timestamp - timestampMicroseconds);
      if (prevDist < currDist) best = lo - 1;
    }

    // Return a clone so caller can close() their copy independently
    return this.allFrames[best].frame.clone();
  }

  dispose() {
    for (const item of this.allFrames) {
      try { item.frame.close(); } catch {}
    }
    this.allFrames = [];
    this.samples = [];
  }
}
