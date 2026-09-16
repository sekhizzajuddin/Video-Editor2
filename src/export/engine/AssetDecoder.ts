import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
} from 'mediabunny';

type WrappedCanvas = {
  canvas: CanvasImageSource;
  timestamp: number;
  duration: number;
};

/**
 * Decode telemetry. Exposed so the export worker (and tests) can prove that a
 * timeline is being decoded monotonically instead of re-seeking every frame.
 */
export interface AssetDecoderStats {
  /** getFrameAt() calls. */
  requests: number;
  /** Requests served from the recent-frame cache without touching the decoder. */
  cacheHits: number;
  /** Frames pulled out of the sequential iterator. */
  sequentialFrames: number;
  /** Times the iterator had to be re-positioned (backward or long forward jump). */
  seeks: number;
  /** Of those, the ones that moved BACKWARD in source time. */
  backwardSeeks: number;
  /** Frames trimmed from the recent-frame cache ring. */
  cacheEvictions: number;
}

export interface AssetDecoderOptions {
  /**
   * Number of canvases the sink keeps alive in its ring buffer. Recent-frame
   * cache capacity is derived from this (poolSize - 2).
   */
  poolSize?: number;
  /** Small source-time back-off applied when re-positioning the iterator. */
  seekBackoff?: number;
  /** Forward distance (s) beyond which we re-seek instead of decoding through. */
  forwardSeekThreshold?: number;
}

const DEFAULTS = {
  poolSize: 8,
  seekBackoff: 0.05,
  forwardSeekThreshold: 0.75,
};

/**
 * Sequential, software-preferred export decoder.
 *
 * Calling CanvasSink.getCanvas() for every exported frame creates a sparse seek
 * pipeline repeatedly. This decoder keeps a sequential canvas iterator alive, so
 * source packets are decoded once instead of seeking back to a keyframe for
 * each output frame.
 *
 * ## Split-safe re-positioning (why this class was rewritten)
 *
 * The previous implementation treated ANY backward request as "the media was
 * reused from the start", so it called `sink.canvases(0)` — the iterator was
 * thrown away and the file re-decoded from its first keyframe up to the target
 * frame. With one decoder per media file (the export worker's default) that
 * meant: a timeline whose split segments are interleaved with a second track
 * using the same media rewound the pipeline on EVERY output frame — a 6 second
 * export did 60 rewinds, each one re-decoding from frame 0. On a real 4K clip
 * that is minutes of wasted decode per second of output, which is what "the
 * system struggles to render after a split" looked like.
 *
 * Now:
 *
 *  - small backward moves are served from a contiguous recent-frame cache,
 *  - larger jumps re-position the iterator at (target - backoff) — mediabunny
 *    seeks to the preceding keyframe internally, so only one GOP is decoded,
 *  - long FORWARD jumps also re-position instead of decoding every frame in
 *    between,
 *  - every request is serialized through `decodeTail`, so the iterator state is
 *    never mutated concurrently (transition overlap asks for two frames of the
 *    same media in one output frame).
 */
export class AssetDecoder {
  public rotation = 0;
  public ready = false;
  public loadError: string | null = null;
  public codec: string | null = null;
  public decoderMode: 'hardware' | 'software' = 'software';

  public readonly stats: AssetDecoderStats = {
    requests: 0,
    cacheHits: 0,
    sequentialFrames: 0,
    seeks: 0,
    backwardSeeks: 0,
    cacheEvictions: 0,
  };

  private url: string;
  private options: Required<AssetDecoderOptions>;
  private input: any = null;
  private sink: InstanceType<typeof CanvasSink> | null = null;
  private iterator: AsyncIterator<any> | null = null;
  private current: WrappedCanvas | null = null;
  private lookahead: WrappedCanvas | null = null;
  private lastRequestedTime = -1;
  /** Timestamp of the newest frame handed out of the iterator. */
  private iteratorPosition = -1;
  /** True once the iterator signaled the end of the track. */
  private iteratorExhausted = false;
  /**
   * Ring of the most recently yielded frames. The sink reuses its canvases in a
   * ring (see `poolSize`), so we only keep `poolSize - 2` entries: everything in
   * there is guaranteed to still hold its pixels.
   */
  private frameCache: WrappedCanvas[] = [];
  private cacheCapacity: number;
  private decodeTail: Promise<any> = Promise.resolve();
  private disposed = false;

  constructor(url: string, options?: AssetDecoderOptions & Record<string, unknown>) {
    this.url = url;
    this.options = {
      poolSize: options?.poolSize ?? DEFAULTS.poolSize,
      seekBackoff: options?.seekBackoff ?? DEFAULTS.seekBackoff,
      forwardSeekThreshold: options?.forwardSeekThreshold ?? DEFAULTS.forwardSeekThreshold,
    };
    this.cacheCapacity = Math.max(2, this.options.poolSize - 2);
  }

  async load(preBuffer?: ArrayBuffer | Blob): Promise<void> {
    try {
      let source: any;
      if (preBuffer) {
        source = new BlobSource(preBuffer instanceof Blob ? preBuffer : new Blob([preBuffer]));
      } else {
        const response = await fetch(this.url);
        if (!response.ok) throw new Error(`fetch failed (${response.status})`);
        source = new BlobSource(await response.blob());
      }

      this.input = new Input({ source, formats: ALL_FORMATS });
      const videoTrack = await this.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        this.loadError = 'No video track found in media';
        this.dispose();
        return;
      }

      let canDecode = true;
      try {
        // Wrap canDecode in a try-catch because VideoDecoder.isConfigSupported
        // may not be available in all environments (Node.js, older browsers)
        canDecode = await videoTrack.canDecode();
      } catch (error: any) {
        console.warn('[AssetDecoder] canDecode check threw, attempting decode:', error?.message || error);
        // If canDecode throws due to missing WebCodecs API, assume support
        // and let the actual decode attempt fail gracefully if needed
        canDecode = true;
      }
      if (!canDecode) {
        this.loadError = 'Codec not supported by browser WebCodecs';
        this.dispose();
        return;
      }

      try {
        this.codec = await videoTrack.getCodec();
      } catch {
        this.codec = null;
      }
      // Hybrid decode policy: HEVC/H.265 relies on the OS/GPU media stack in
      // Chrome; common web codecs use software to avoid exhausting hardware
      // decoder sessions in projects containing many clips.
      this.decoderMode = this.codec === 'hevc' ? 'hardware' : 'software';

      let originalRotation = 0;
      try {
        originalRotation = typeof (videoTrack as any).getRotation === 'function'
          ? await (videoTrack as any).getRotation()
          : (videoTrack as any).rotation || 0;
      } catch {}
      this.rotation = 0; // CanvasSink applies file rotation metadata.
      (this as any)._originalRotation = originalRotation;

      this.sink = new CanvasSink(videoTrack, {
        decoderOptions: {
          hardwareAcceleration: this.decoderMode === 'hardware' ? 'prefer-hardware' : 'prefer-software',
          optimizeForLatency: true,
        },
        poolSize: this.options.poolSize,
      });
      this.disposed = false;
      this.ready = true;
      console.log(`[AssetDecoder] ${this.codec || 'unknown'} → ${this.decoderMode} decode`);
      // No iterator is opened here: `openIteratorAt` positions it at the first
      // requested timestamp, which is what makes a mid-file split cheap.
      this.current = null;
      this.lookahead = null;
      this.lastRequestedTime = -1;
      this.iteratorPosition = -1;
      this.iteratorExhausted = false;
      this.frameCache = [];
    } catch (error: any) {
      this.loadError = `Media initialization failed: ${error?.message || error}`;
      console.warn('[AssetDecoder]', this.loadError, this.url);
      this.dispose();
    }
  }

  /**
   * Opens (or re-opens) the sequential iterator positioned at `timestampSeconds`.
   * mediabunny seeks to the keyframe preceding that timestamp, so the cost is
   * one GOP — never "decode the whole file from zero".
   */
  private async openIteratorAt(timestampSeconds: number): Promise<void> {
    if (!this.sink || typeof (this.sink as any).canvases !== 'function') {
      this.iterator = null;
      return;
    }
    // Await the previous generator's cleanup so only one iterator is alive on
    // the sink at any time (mediabunny asserts on concurrent iterators).
    const previous = this.iterator;
    this.iterator = null;
    if (previous?.return) {
      try {
        await previous.return();
      } catch {}
    }
    const start = Math.max(0, timestampSeconds - this.options.seekBackoff);
    this.iterator = (this.sink as any).canvases(start)[Symbol.asyncIterator]();
    this.current = null;
    this.lookahead = null;
    this.iteratorPosition = start;
    this.iteratorExhausted = false;
    this.frameCache = [];
  }

  /**
   * A frame the decoder already holds that is the correct answer for `t`
   * (the newest known frame at or before `t`), or null when it must decode.
   *
   * Considers the pending look-ahead frame first: without this, a repeat of the
   * previous request advanced the iterator by one more frame (wasting a decode)
   * because the frame that satisfied it was still parked in `lookahead`.
   */
  private knownFrameFor(timestampSeconds: number): WrappedCanvas | null {
    if (this.lookahead && this.lookahead.timestamp <= timestampSeconds + 0.0005) {
      this.current = this.lookahead;
      this.iteratorPosition = Math.max(this.iteratorPosition, this.current.timestamp);
      this.rememberFrame(this.current);
      this.lookahead = null;
      return this.current;
    }
    return this.lookupCache(timestampSeconds);
  }

  /**
   * The best cached frame for `t`, or null when the cache cannot answer it.
   *
   * The cache holds a CONTIGUOUS run of yields `[oldest … newest]`. That makes
   * the lookup exact — no guessing:
   *
   *   - `t` after `newest`  → the iterator has not decoded that far yet (the
   *     media only ended if the iterator is exhausted), so decode forward.
   *   - `t` before `oldest` → the frame is not in the cache; re-position.
   *   - otherwise           → the frame with the greatest timestamp ≤ t is the
   *     frame the iterator itself would have produced.
   */
  private lookupCache(timestampSeconds: number): WrappedCanvas | null {
    const cache = this.frameCache;
    if (cache.length === 0) return null;
    const newest = cache[cache.length - 1];
    if (timestampSeconds > newest.timestamp + 0.0005) {
      return this.iteratorExhausted ? newest : null;
    }
    const oldest = cache[0];
    if (timestampSeconds + 0.0005 < oldest.timestamp) return null;
    let best: WrappedCanvas | null = null;
    for (const entry of cache) {
      if (entry.timestamp <= timestampSeconds + 0.0005) {
        if (!best || entry.timestamp > best.timestamp) best = entry;
      }
    }
    return best;
  }

  private rememberFrame(frame: WrappedCanvas): void {
    // Drop entries the sink's canvas ring may already have recycled.
    this.frameCache.push(frame);
    while (this.frameCache.length > this.cacheCapacity) {
      this.frameCache.shift();
      this.stats.cacheEvictions++;
    }
  }

  private async decodeSequential(timestampSeconds: number): Promise<CanvasImageSource | null> {
    // The iterator is opened lazily, positioned at the first requested frame.
    if (!this.iterator) {
      await this.openIteratorAt(timestampSeconds);
      if (!this.iterator) {
        // No iterator available (test sinks) — fall back to a single seek.
        const wrapped = await this.sink!.getCanvas(timestampSeconds);
        return wrapped?.canvas || null;
      }
    }

    if (this.lastRequestedTime >= 0) {
      const backward = timestampSeconds + 0.0005 < this.lastRequestedTime;
      const longForward =
        timestampSeconds > this.iteratorPosition + this.options.forwardSeekThreshold;
      if (backward || longForward) {
        // Re-position instead of rewinding to the start of the file (the old
        // behaviour) or decoding through every intermediate frame.
        await this.openIteratorAt(timestampSeconds);
        this.stats.seeks++;
        if (backward) this.stats.backwardSeeks++;
      }
    }
    this.lastRequestedTime = timestampSeconds;

    while (!this.disposed && this.iterator) {
      if (!this.lookahead) {
        const next = await this.iterator.next();
        if (next.done || !next.value) {
          this.iteratorExhausted = true;
          break;
        }
        this.lookahead = next.value as WrappedCanvas;
        this.stats.sequentialFrames++;
      }

      // Keep the latest source frame whose presentation time is <= requested
      // time. Retaining one lookahead frame avoids consuming too far.
      if (this.lookahead.timestamp <= timestampSeconds + 0.0005) {
        this.current = this.lookahead;
        this.iteratorPosition = Math.max(this.iteratorPosition, this.current.timestamp);
        this.rememberFrame(this.current);
        this.lookahead = null;
        continue;
      }
      break;
    }

    return this.current?.canvas || null;
  }

  async getFrameAt(timestampMicroseconds: number): Promise<CanvasImageSource | null> {
    if (!this.sink || !this.ready || this.disposed) return null;
    const timestampSeconds = Math.max(0, timestampMicroseconds / 1_000_000);

    // Serialize accesses because transition overlap can request the same source
    // twice in one output frame.
    const framePromise = this.decodeTail.then(async () => {
      this.stats.requests++;
      const known = this.knownFrameFor(timestampSeconds);
      if (known) {
        this.stats.cacheHits++;
        // A cache hit does not move the iterator; keep the last-request marker in
        // sync so the next real decode still sees a monotonic sequence.
        this.lastRequestedTime = Math.max(this.lastRequestedTime, timestampSeconds);
        return known.canvas;
      }
      const out = await this.decodeSequential(timestampSeconds);
      return out;
    });
    this.decodeTail = framePromise.then(() => undefined, () => undefined);
    try {
      return await framePromise;
    } catch (error: any) {
      this.loadError = `Video decoding failed: ${error?.message || error}`;
      return null;
    }
  }

  dispose(): void {
    this.disposed = true;
    const iterator = this.iterator;
    this.iterator = null;
    if (iterator?.return) {
      try { void iterator.return(); } catch {}
    }
    this.current = null;
    this.lookahead = null;
    this.frameCache = [];
    this.iteratorPosition = -1;
    this.iteratorExhausted = false;

    if (this.input) {
      try {
        const disposable = this.input as any;
        if (typeof disposable.dispose === 'function') disposable.dispose();
        else {
          const symbolDispose = (Symbol as any).dispose;
          if (symbolDispose && typeof disposable[symbolDispose] === 'function') disposable[symbolDispose]();
        }
      } catch {}
      this.input = null;
    }
    this.sink = null;
    this.ready = false;
  }
}
