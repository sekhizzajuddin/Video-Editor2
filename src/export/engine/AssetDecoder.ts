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

  // Compressed encoded samples (small memory footprint)
  private samples: StoredSample[] = [];
  // All decoded frames indexed by timestamp
  private decodedFrames: AssetFrame[] = [];

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
      // Collect compressed samples — decode later in one batch
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

    // Wait for mp4box onReady
    await new Promise<void>((resolve) => {
      if (this.trackInfo) {
        resolve();
      } else {
        this.onReadyCallback = resolve;
        setTimeout(resolve, 3000); // Safety timeout
      }
    });

    // Give mp4box time to finish extracting all samples
    await new Promise<void>((r) => setTimeout(r, 300));

    this.samples.sort((a, b) => a.timestamp - b.timestamp);
    await this.decodeAllFrames();
  }

  /** Extract the avcC (AVCDecoderConfigurationRecord) bytes needed by WebCodecs */
  private extractAvcDescription(): Uint8Array | undefined {
    try {
      const trak = this.mp4boxfile.getTrackById?.(this.trackId);
      const sampleEntry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];

      if (sampleEntry?.avcC) {
        // mp4box DataStream serialises the box; we skip the 8-byte box header
        const DataStream = (MP4Box as any).DataStream;
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        sampleEntry.avcC.write(stream);
        return new Uint8Array(stream.buffer, 8);
      }

      if (sampleEntry?.hvcC) {
        const DataStream = (MP4Box as any).DataStream;
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        sampleEntry.hvcC.write(stream);
        return new Uint8Array(stream.buffer, 8);
      }
    } catch (e) {
      console.warn('[AssetDecoder] Could not extract codec description:', e);
    }
    return undefined;
  }

  private async decodeAllFrames(): Promise<void> {
    if (this.samples.length === 0 || !this.trackInfo) {
      console.warn('[AssetDecoder] No samples or track info — nothing to decode');
      return;
    }

    const description = this.extractAvcDescription();
    if (!description) {
      console.warn('[AssetDecoder] No avcC/hvcC description found — decoder may reject frames');
    } else {
      console.log(`[AssetDecoder] Extracted codec description (${description.byteLength} bytes)`);
    }

    const codec = this.trackInfo.codec ?? 'avc1.42E01E';
    const width  = this.trackInfo.video?.width  ?? 1920;
    const height = this.trackInfo.video?.height ?? 1080;

    console.log(`[AssetDecoder] Decoding ${this.samples.length} samples | codec=${codec} ${width}x${height}`);

    return new Promise<void>((resolve) => {
      const config: VideoDecoderConfig = { codec, codedWidth: width, codedHeight: height };
      if (description) config.description = description;

      const decoder = new VideoDecoder({
        output: (frame) => {
          this.decodedFrames.push({ timestamp: frame.timestamp, frame });
        },
        error: (e) => {
          // Decoder errors are non-fatal; we keep whatever frames we already have
          console.warn('[AssetDecoder] Decoder error (non-fatal):', e.message);
        },
      });

      decoder.configure(config);

      for (const sample of this.samples) {
        if (decoder.state === 'closed') break;
        try {
          decoder.decode(new EncodedVideoChunk({
            type:      sample.isKeyframe ? 'key' : 'delta',
            timestamp: sample.timestamp,
            duration:  sample.duration,
            data:      sample.data,
          }));
        } catch (e: any) {
          console.warn(`[AssetDecoder] Skipped sample @${sample.timestamp}µs:`, e.message);
        }
      }

      decoder.flush()
        .then(() => {
          decoder.close();
          this.decodedFrames.sort((a, b) => a.timestamp - b.timestamp);
          console.log(`[AssetDecoder] Ready — ${this.decodedFrames.length} frames decoded`);
          resolve();
        })
        .catch((e) => {
          console.error('[AssetDecoder] flush() error:', e);
          try { decoder.close(); } catch {}
          this.decodedFrames.sort((a, b) => a.timestamp - b.timestamp);
          resolve();
        });
    });
  }

  /** Returns a clone of the VideoFrame closest to the requested timestamp (µs). */
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.decodedFrames.length === 0) return null;

    // Binary search
    let lo = 0, hi = this.decodedFrames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.decodedFrames[mid].timestamp < timestampMicroseconds) lo = mid + 1;
      else hi = mid;
    }

    // Pick the closest of lo-1 and lo
    let best = lo;
    if (lo > 0) {
      const prev = Math.abs(this.decodedFrames[lo - 1].timestamp - timestampMicroseconds);
      const curr = Math.abs(this.decodedFrames[lo].timestamp - timestampMicroseconds);
      if (prev < curr) best = lo - 1;
    }

    // Clone so caller can close() their copy without corrupting the cache
    return this.decodedFrames[best].frame.clone();
  }

  dispose() {
    for (const af of this.decodedFrames) {
      try { af.frame.close(); } catch {}
    }
    this.decodedFrames = [];
    this.samples = [];
  }
}
