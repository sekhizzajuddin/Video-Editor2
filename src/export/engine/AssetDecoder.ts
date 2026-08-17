import * as MP4Box from 'mp4box';
import { FramePool } from './memory/FramePool';

export interface AssetFrame {
  timestamp: number; // µs (CTS - presentation time)
  frame: VideoFrame;
}

export interface StoredSample {
  timestamp: number;   // µs (CTS)
  duration: number;    // µs
  data: Uint8Array;
  isKeyframe: boolean;
}

export interface DemuxedMedia {
  samples: StoredSample[];
  trackInfo: any;
  rotation: number;
  decoderConfig: VideoDecoderConfig;
  ready: boolean;
  loadError: string | null;
}

export class AssetDecoder {
  private url: string;
  private framePool: FramePool;
  private demuxed: DemuxedMedia | null = null;
  public rotation: number = 0;

  // Live decoding state (lazy initialized when playhead reaches this clip)
  private decoder: VideoDecoder | null = null;
  private decodedQueue: AssetFrame[] = [];
  private nextSampleIdx: number = 0;

  /**
   * True once demuxed with a parseable MP4 video track AND a valid codec config.
   */
  public ready: boolean = false;
  /** Human-readable reason when ready === false. */
  public loadError: string | null = null;

  /**
   * Pending getFrameAt() waiter. Resolved by the decoder's `output` callback as
   * soon as a frame with CTS >= `targetCts` is produced.
   */
  private frameWaiter: { targetCts: number; resolve: () => void } | null = null;

  constructor(url: string, framePool: FramePool) {
    this.url = url;
    this.framePool = framePool;
  }

  /**
   * Static helper: Demuxes an MP4 ArrayBuffer exactly ONCE per media file.
   * Returns the extracted samples, track info, rotation, and VideoDecoderConfig.
   */
  public static async demux(url: string, preBuffer?: ArrayBuffer): Promise<DemuxedMedia> {
    let buffer: ArrayBuffer;
    if (preBuffer) {
      buffer = preBuffer;
    } else {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`fetch failed (${response.status})`);
        buffer = await response.arrayBuffer();
      } catch (e: any) {
        return {
          samples: [],
          trackInfo: null,
          rotation: 0,
          decoderConfig: {} as any,
          ready: false,
          loadError: `Could not read media: ${e?.message || e}`,
        };
      }
    }

    const mp4boxfile = MP4Box.createFile();
    const samples: StoredSample[] = [];
    let trackInfo: any = null;
    let trackId = 0;
    let loadError: string | null = null;
    let onReadyResolve: (() => void) | null = null;

    mp4boxfile.onReady = (info: any) => {
      const track = info.videoTracks?.[0];
      if (!track) {
        loadError = 'No video track found';
        onReadyResolve?.();
        return;
      }
      trackId = track.id;
      trackInfo = track;
      mp4boxfile.setExtractionOptions(trackId, null, { nbSamples: 100000 });
      mp4boxfile.start();
      onReadyResolve?.();
    };

    mp4boxfile.onSamples = (_id: number, _user: any, rawSamples: any[]) => {
      for (const s of rawSamples) {
        samples.push({
          timestamp: Math.round((s.cts * 1_000_000) / s.timescale),
          duration:  Math.round((s.duration * 1_000_000) / s.timescale),
          data:      new Uint8Array(s.data),
          isKeyframe: s.is_sync,
        });
      }
    };

    (buffer as any).fileStart = 0;
    try {
      mp4boxfile.appendBuffer(buffer as any);
      mp4boxfile.flush();
    } catch (e: any) {
      return {
        samples: [],
        trackInfo: null,
        rotation: 0,
        decoderConfig: {} as any,
        ready: false,
        loadError: `Not an MP4/MOV container: ${e?.message || e}`,
      };
    }

    // Wait for MP4Box to read track header
    await new Promise<void>((resolve) => {
      if (trackInfo || loadError) { resolve(); return; }
      onReadyResolve = resolve;
      setTimeout(resolve, 3000);
    });

    // Give MP4Box 150ms to finish sample extraction
    await new Promise<void>((r) => setTimeout(r, 150));

    if (samples.length === 0 || !trackInfo) {
      return {
        samples: [],
        trackInfo: null,
        rotation: 0,
        decoderConfig: {} as any,
        ready: false,
        loadError: loadError || 'No decodable video track found in media',
      };
    }

    // Extract AVCDecoderConfigurationRecord (avcC) or HEVCDecoderConfigurationRecord (hvcC) bytes
    let description: Uint8Array | undefined;
    try {
      const trak = mp4boxfile.getTrackById?.(trackId);
      const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0] as any;
      const box = entry?.avcC ?? entry?.hvcC;
      if (box) {
        const DataStream = (MP4Box as any).DataStream;
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        description = new Uint8Array(stream.buffer, 8); // Skip 8-byte box header
      }
    } catch (e) {
      console.warn('[AssetDecoder] Could not extract codec description:', e);
    }

    const codec  = trackInfo.codec ?? 'avc1.42E01E';
    const width  = trackInfo.video?.width  ?? 1920;
    const height = trackInfo.video?.height ?? 1080;

    // Extract rotation from MP4 track matrix
    let rotation = 0;
    const matrix = trackInfo.matrix;
    if (matrix && matrix.length === 9) {
      if (matrix[0] === 0 && matrix[1] === 65536 && matrix[3] === -65536 && matrix[4] === 0) {
        rotation = 90;
      } else if (matrix[0] === -65536 && matrix[1] === 0 && matrix[3] === 0 && matrix[4] === -65536) {
        rotation = 180;
      } else if (matrix[0] === 0 && matrix[1] === -65536 && matrix[3] === 65536 && matrix[4] === 0) {
        rotation = 270;
      }
    }

    const decoderConfig: VideoDecoderConfig = {
      codec,
      codedWidth: width,
      codedHeight: height,
    };
    if (description) {
      decoderConfig.description = description;
    }

    console.log(`[AssetDecoder] Demuxed ready | ${samples.length} samples | ${codec} ${width}x${height} | rotation=${rotation}`);

    return {
      samples,
      trackInfo,
      rotation,
      decoderConfig,
      ready: true,
      loadError: null,
    };
  }

  /**
   * Fast initialization from a shared DemuxedMedia object (avoids re-parsing the MP4).
   */
  public initFromDemuxed(demuxed: DemuxedMedia): void {
    this.demuxed = demuxed;
    this.rotation = demuxed.rotation;
    this.ready = demuxed.ready;
    this.loadError = demuxed.loadError;
  }

  /**
   * Fallback load method for standalone usage / tests.
   */
  async load(preBuffer?: ArrayBuffer): Promise<void> {
    const demuxed = await AssetDecoder.demux(this.url, preBuffer);
    this.initFromDemuxed(demuxed);
  }

  private initDecoder(): void {
    if (this.decoder) {
      try { this.decoder.close(); } catch {}
      this.decoder = null;
    }

    this.clearDecodedQueue();
    this.nextSampleIdx = 0;

    if (!this.demuxed || !this.demuxed.decoderConfig) return;

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.decodedQueue.push({ timestamp: frame.timestamp, frame });
        this.notifyFrameArrived(frame.timestamp);
      },
      error: (e) => {
        console.warn('[AssetDecoder] VideoDecoder error:', e.message);
      },
    });

    try {
      this.decoder.configure(this.demuxed.decoderConfig);
    } catch (e: any) {
      console.error('[AssetDecoder] VideoDecoder configure failed:', e.message);
    }
  }

  /**
   * Release the VideoDecoder and GPU session when this clip has finished playing.
   */
  public releaseDecoder(): void {
    if (this.decoder) {
      try { this.decoder.close(); } catch {}
      this.decoder = null;
    }
    this.clearDecodedQueue();
    this.nextSampleIdx = 0;
  }

  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (!this.demuxed || !this.ready || this.demuxed.samples.length === 0) {
      return null;
    }

    let timedOut = false;
    const deadline = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('[AssetDecoder] getFrameAt TIMEOUT for target CTS', timestampMicroseconds);
        timedOut = true;
        resolve(null);
      }, 10000);
    });

    const getFramePromise = this._getFrameAtImpl(timestampMicroseconds).then(frame => {
      if (timedOut && frame) {
        try { frame.close(); } catch {}
        return null;
      }
      return frame;
    });

    return Promise.race([getFramePromise, deadline]);
  }

  private async _getFrameAtImpl(timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (!this.demuxed || this.demuxed.samples.length === 0) return null;

    // Lazy initialization of the hardware decoder on first frame request
    if (!this.decoder || this.decoder.state === 'closed') {
      this.initDecoder();
      if (!this.decoder) return null;
    }

    const samples = this.demuxed.samples;

    // 1. Purge old frames to bound memory, keeping the active frame
    while (this.decodedQueue.length > 1) {
      if (this.decodedQueue[1].timestamp <= timestampMicroseconds) {
        const old = this.decodedQueue.shift();
        try { old?.frame.close(); } catch {}
      } else {
        break;
      }
    }

    // 2. Feed compressed samples to decoder until we're past the target timestamp
    const lookAheadTarget = timestampMicroseconds + 500_000;
    let fedNewSamples = false;

    while (this.nextSampleIdx < samples.length) {
      const sample = samples[this.nextSampleIdx];

      if (sample.timestamp > lookAheadTarget && this.nextSampleIdx > 0) {
        const lastQueuedCTS = this.decodedQueue.length > 0
          ? this.decodedQueue[this.decodedQueue.length - 1].timestamp
          : -1;
        if (lastQueuedCTS >= timestampMicroseconds) break;
      }

      if (this.decoder.state === 'closed') {
        this.initDecoder();
        if (!this.decoder) return null;
      }

      // STRICT throttle: hardware decoders hang if fed too many frames concurrently.
      let queueRetries = 50;
      while (this.decoder.decodeQueueSize >= 3 && queueRetries > 0) {
        await this.waitForDequeue(this.decoder, 10);
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

    // 3. Wait for the decoder to output the frames
    if (fedNewSamples && this.decoder && this.decoder.state === 'configured') {
      await this.waitForFrame(timestampMicroseconds, 400);
    }

    if (this.decodedQueue.length === 0) return null;

    // 4. Sort decoded queue by CTS for correct frame selection
    this.decodedQueue.sort((a, b) => a.timestamp - b.timestamp);

    // 5. Select the last decoded frame whose timestamp is <= requested timestamp
    const epsilonUs = 1000;
    let bestIdx = -1;
    for (let i = 0; i < this.decodedQueue.length; i++) {
      if (this.decodedQueue[i].timestamp <= timestampMicroseconds + epsilonUs) {
        bestIdx = i;
      } else {
        break;
      }
    }

    if (bestIdx === -1) {
      bestIdx = 0;
    }

    return this.decodedQueue[bestIdx].frame.clone();
  }

  private waitForDequeue(decoder: VideoDecoder, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        decoder.removeEventListener('dequeue', done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      decoder.addEventListener('dequeue', done);
    });
  }

  private notifyFrameArrived(cts: number): void {
    const waiter = this.frameWaiter;
    if (waiter && cts >= waiter.targetCts) {
      this.frameWaiter = null;
      waiter.resolve();
    }
  }

  private waitForFrame(targetCts: number, timeoutMs: number): Promise<void> {
    if (this.decodedQueue.length > 0) {
      const lastQueuedCTS = this.decodedQueue[this.decodedQueue.length - 1].timestamp;
      if (lastQueuedCTS >= targetCts) return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.frameWaiter && this.frameWaiter.resolve === done) {
          this.frameWaiter = null;
        }
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      if (this.frameWaiter) this.frameWaiter.resolve();
      this.frameWaiter = { targetCts, resolve: done };
    });
  }

  private clearDecodedQueue(): void {
    for (const item of this.decodedQueue) {
      try { item.frame.close(); } catch {}
    }
    this.decodedQueue = [];
  }

  dispose() {
    if (this.frameWaiter) {
      const w = this.frameWaiter;
      this.frameWaiter = null;
      w.resolve();
    }
    this.releaseDecoder();
    this.demuxed = null;
  }
}
