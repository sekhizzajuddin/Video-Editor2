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
        canDecode = await videoTrack.canDecode();
      } catch (error) {
        console.warn('[AssetDecoder] canDecode check threw, attempting decode:', error);
      }
      if (!canDecode) {
        this.loadError = 'Codec not supported by browser WebCodecs';
        this.dispose();
        return;
      }

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
          // Projects with many source files can exhaust Chrome's hardware
          // decoder-session limit. Keep decoding on CPU while the final H.264
          // encoder remains hardware accelerated.
          hardwareAcceleration: 'prefer-software',
          optimizeForLatency: true,
        },
        poolSize: 8,
      });
      this.disposed = false;
      this.ready = true;
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

  private async decodeSequential(timestampSeconds: number): Promise<CanvasImageSource | null> {
    if (!this.iterator) {
      const wrapped = await this.sink!.getCanvas(timestampSeconds);
      return wrapped?.canvas || null;
    }

    // A media item may be reused later with a source-time reset. Restart only
    // for genuine backwards movement; normal forward playback never seeks.
    if (this.lastRequestedTime >= 0 && timestampSeconds + 0.0005 < this.lastRequestedTime) {
      this.resetIterator();
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
