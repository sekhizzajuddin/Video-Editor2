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

  private samples: StoredSample[] = [];
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

    // Wait for onReady
    await new Promise<void>((resolve) => {
      if (this.trackInfo) { resolve(); return; }
      this.onReadyCallback = resolve;
      setTimeout(resolve, 3000);
    });

    // Give mp4box time to finish sample extraction
    await new Promise<void>((r) => setTimeout(r, 300));
    this.samples.sort((a, b) => a.timestamp - b.timestamp);

    await this.decodeAllFrames();
  }

  /** Extract AVCDecoderConfigurationRecord (avcC box content) — required by WebCodecs for AVC streams */
  private extractCodecDescription(): Uint8Array | undefined {
    try {
      const trak = this.mp4boxfile.getTrackById?.(this.trackId);
      const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
      const box = entry?.avcC ?? entry?.hvcC;
      if (!box) return undefined;

      const DataStream = (MP4Box as any).DataStream;
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // skip 8-byte box header
    } catch (e) {
      console.warn('[AssetDecoder] Could not extract codec description:', e);
      return undefined;
    }
  }

  private decodeAllFrames(): Promise<void> {
    if (this.samples.length === 0 || !this.trackInfo) {
      console.warn('[AssetDecoder] No samples to decode');
      return Promise.resolve();
    }

    const description = this.extractCodecDescription();
    const codec  = this.trackInfo.codec ?? 'avc1.42E01E';
    const width  = this.trackInfo.video?.width  ?? 1920;
    const height = this.trackInfo.video?.height ?? 1080;

    console.log(`[AssetDecoder] Decoding ${this.samples.length} samples | ${codec} ${width}x${height} | desc=${description?.byteLength ?? 0}B`);

    return new Promise<void>((resolve) => {
      // Single resolve gate — ensures we resolve exactly once
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.decodedFrames.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`[AssetDecoder] Ready — ${this.decodedFrames.length} frames`);
        resolve();
      };

      // 25-second hard timeout — prevents infinite hang
      const hardTimeout = setTimeout(() => {
        console.warn('[AssetDecoder] Hard timeout hit — finishing with partial frames');
        finish();
      }, 25_000);

      const config: VideoDecoderConfig = { codec, codedWidth: width, codedHeight: height };
      if (description) config.description = description;

      const decoder = new VideoDecoder({
        output: (frame) => {
          this.decodedFrames.push({ timestamp: frame.timestamp, frame });
        },
        error: (e) => {
          // VideoDecoder is now in "closed" state after this callback.
          // Calling flush() on a closed decoder hangs forever, so we bail out now.
          console.warn('[AssetDecoder] Decoder error → closing early:', e.message);
          clearTimeout(hardTimeout);
          finish();
        },
      });

      decoder.configure(config);

      // Submit all samples sequentially
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
          // Single bad chunk — warn but continue
          console.warn(`[AssetDecoder] Bad chunk @${sample.timestamp}µs: ${e.message}`);
        }
      }

      // Flush: waits for all queued decodes to complete.
      // Skip if decoder already closed (error handler fired).
      if (decoder.state === 'closed') {
        clearTimeout(hardTimeout);
        finish();
        return;
      }

      decoder.flush()
        .then(() => {
          clearTimeout(hardTimeout);
          try { decoder.close(); } catch {}
          finish();
        })
        .catch((e) => {
          clearTimeout(hardTimeout);
          console.warn('[AssetDecoder] flush() rejected:', e?.message ?? e);
          try { decoder.close(); } catch {}
          finish();
        });
    });
  }

  /** Returns the VideoFrame closest to the requested timestamp (µs). Caller must close() the clone. */
  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (this.decodedFrames.length === 0) return null;

    let lo = 0, hi = this.decodedFrames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.decodedFrames[mid].timestamp < timestampMicroseconds) lo = mid + 1;
      else hi = mid;
    }

    let best = lo;
    if (lo > 0) {
      const prev = Math.abs(this.decodedFrames[lo - 1].timestamp - timestampMicroseconds);
      const curr = Math.abs(this.decodedFrames[lo].timestamp - timestampMicroseconds);
      if (prev < curr) best = lo - 1;
    }

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
