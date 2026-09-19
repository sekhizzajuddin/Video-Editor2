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
 * Sequential, software-preferred export decoder.
 *
 * Calling CanvasSink.getCanvas() for every exported frame creates a sparse seek
 * pipeline repeatedly. This decoder keeps a sequential canvas iterator alive,
 * so source packets are decoded once instead of seeking back to a keyframe for
 * each output frame.
 */
export class AssetDecoder {
  public rotation = 0;
  public ready = false;
  public loadError: string | null = null;
  public codec: string | null = null;
  public decoderMode: 'hardware' | 'software' = 'software';

  private url: string;
  private input: any = null;
  private sink: InstanceType<typeof CanvasSink> | null = null;
  private iterator: AsyncIterator<any> | null = null;
  private current: WrappedCanvas | null = null;
  private lookahead: WrappedCanvas | null = null;
  private lastRequestedTime = -1;
  private decodeTail: Promise<any> = Promise.resolve();
  private disposed = false;

  constructor(url: string, _legacyOptions?: unknown) {
    this.url = url;
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
        poolSize: 8,
      });
      this.disposed = false;
      this.ready = true;
      console.log(`[AssetDecoder] ${this.codec || 'unknown'} → ${this.decoderMode} decode`);
      this.resetIterator();
    } catch (error: any) {
      this.loadError = `Media initialization failed: ${error?.message || error}`;
      console.warn('[AssetDecoder]', this.loadError, this.url);
      this.dispose();
    }
  }

  private resetIterator(): void {
    try { this.iterator?.return?.(); } catch {}
    this.iterator = this.sink && typeof (this.sink as any).canvases === 'function'
      ? (this.sink as any).canvases(0)[Symbol.asyncIterator]()
      : null;
    this.current = null;
    this.lookahead = null;
    this.lastRequestedTime = -1;
  }

  /**
   * Restart the sequential iterator AT the requested source time.
   *
   * Transition overlap makes the compositor ask for two DIFFERENT source times
   * from one shared decoder within the same output frame (outgoing clip near
   * its trim end, incoming clip near its start). When the second request lands
   * before the first, a plain resetIterator() would restart from position 0 and
   * walk forward — re-decoding the entire video EVERY transition frame, which
   * stalled exports at the transition. canvases(startTimestamp) repositions the
   * iterator directly, so the next in-order request continues from here.
   */
  private restartIteratorAt(timestampSeconds: number): void {
    try { this.iterator?.return?.(); } catch {}
    this.iterator = this.sink && typeof (this.sink as any).canvases === 'function'
      ? (this.sink as any).canvases(timestampSeconds)[Symbol.asyncIterator]()
      : null;
    this.current = null;
    this.lookahead = null;
    this.lastRequestedTime = timestampSeconds;
  }

  private async decodeSequential(timestampSeconds: number): Promise<CanvasImageSource | null> {
    if (!this.iterator) {
      const wrapped = await this.sink!.getCanvas(timestampSeconds);
      return wrapped?.canvas || null;
    }

    // A media item may be reused later with a source-time reset. A backwards
    // request (transition overlap) must NOT walk from position 0 — restart the
    // iterator at the requested time instead.
    if (this.lastRequestedTime >= 0 && timestampSeconds + 0.0005 < this.lastRequestedTime) {
      this.restartIteratorAt(timestampSeconds);
    }
    this.lastRequestedTime = timestampSeconds;

    while (!this.disposed) {
      if (!this.lookahead) {
        const next = await this.iterator.next();
        if (next.done || !next.value) break;
        this.lookahead = next.value as WrappedCanvas;
      }

      // Keep the latest source frame whose presentation time is <= requested
      // time. Retaining one lookahead frame avoids consuming too far.
      if (this.lookahead.timestamp <= timestampSeconds + 0.0005) {
        this.current = this.lookahead;
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
    const framePromise = this.decodeTail.then(() => this.decodeSequential(timestampSeconds));
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
    try { this.iterator?.return?.(); } catch {}
    this.iterator = null;
    this.current = null;
    this.lookahead = null;

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
