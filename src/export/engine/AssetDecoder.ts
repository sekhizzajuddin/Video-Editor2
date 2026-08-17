import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
} from 'mediabunny';

export class AssetDecoder {
  public rotation: number = 0;
  public ready: boolean = false;
  public loadError: string | null = null;

  private url: string;
  private input: any = null;
  private sink: InstanceType<typeof CanvasSink> | null = null;
  private canvasIterator: AsyncIterator<any> | null = null;
  private currentFrame: any = null;
  private nextFrame: any = null;
  private iteratorDone: boolean = false;
  private decodeTail: Promise<any> = Promise.resolve();

  constructor(url: string, _framePool?: any) {
    this.url = url;
  }

  async load(preBuffer?: ArrayBuffer | Blob): Promise<void> {
    try {
      let source: any;
      if (preBuffer) {
        const blob = preBuffer instanceof Blob ? preBuffer : new Blob([preBuffer]);
        source = new BlobSource(blob);
      } else {
        const resp = await fetch(this.url);
        if (!resp.ok) throw new Error(`fetch failed (${resp.status})`);
        const blob = await resp.blob();
        source = new BlobSource(blob);
      }

      this.input = new Input({
        source,
        formats: ALL_FORMATS,
      });

      const videoTrack = await this.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        this.loadError = 'No video track found in media';
        this.dispose();
        return;
      }

      const canDecode = await videoTrack.canDecode();
      if (!canDecode) {
        this.loadError = 'Codec not supported by browser WebCodecs';
        this.dispose();
        return;
      }

      this.rotation = (videoTrack as any).rotation || 0;
      this.sink = new CanvasSink(videoTrack, { poolSize: 2 });
      this.ready = true;
    } catch (e: any) {
      this.loadError = `Media initialization failed: ${e?.message || e}`;
      console.warn('[AssetDecoder]', this.loadError, this.url);
      this.dispose();
    }
  }

  async getFrameAt(timestampMicroseconds: number): Promise<VideoFrame | null> {
    const timestampSeconds = timestampMicroseconds / 1_000_000;
    const framePromise = this.decodeTail.then(() => this.getSequentialFrame(timestampSeconds, timestampMicroseconds));
    this.decodeTail = framePromise.then(
      () => undefined,
      () => undefined,
    );
    return framePromise;
  }

  private async getSequentialFrame(timestampSeconds: number, timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (!this.sink || !this.ready) return null;

    // Start a new sequential decode for the first request or whenever the
    // timeline moves backwards (reverse playback, a loop, or a later clip
    // reusing the same media from an earlier in-point).
    if (!this.canvasIterator || (this.currentFrame && timestampSeconds < this.currentFrame.timestamp - 1e-8)) {
      await this.resetCanvasIterator(timestampSeconds);
    }

    if (!this.currentFrame) return null;

    // Keep one decoded frame of lookahead so selection exactly matches:
    // the last source frame starting at or before the requested timestamp.
    while (true) {
      if (!this.nextFrame && !this.iteratorDone && this.canvasIterator) {
        const next = await this.canvasIterator.next();
        if (next.done) {
          this.iteratorDone = true;
        } else {
          this.nextFrame = next.value;
        }
      }

      if (this.nextFrame && this.nextFrame.timestamp <= timestampSeconds + 1e-8) {
        this.currentFrame = this.nextFrame;
        this.nextFrame = null;
        continue;
      }
      break;
    }

    if (this.currentFrame.timestamp > timestampSeconds + 1e-8) return null;

    try {
      return new VideoFrame(this.currentFrame.canvas, {
        timestamp: timestampMicroseconds,
      });
    } catch (e) {
      return null;
    }
  }

  private async resetCanvasIterator(timestamp: number): Promise<void> {
    await this.canvasIterator?.return?.();
    this.currentFrame = null;
    this.nextFrame = null;
    this.iteratorDone = false;

    const sink = this.sink;
    if (!sink) return;
    this.canvasIterator = sink.canvases(timestamp)[Symbol.asyncIterator]();

    const iterator = this.canvasIterator;
    if (!iterator) return;
    const first = await iterator.next();
    if (first.done) {
      this.iteratorDone = true;
      return;
    }
    this.currentFrame = first.value;
  }

  dispose(): void {
    void this.canvasIterator?.return?.();
    if (this.input) {
      try {
        const disposable = this.input as any;
        if (typeof disposable.dispose === 'function') {
          disposable.dispose();
        } else {
          const symDispose = (Symbol as any).dispose;
          if (symDispose && typeof disposable[symDispose] === 'function') {
            disposable[symDispose]();
          }
        }
      } catch {}
      this.input = null;
    }
    this.sink = null;
    this.canvasIterator = null;
    this.currentFrame = null;
    this.nextFrame = null;
    this.iteratorDone = false;
    this.ready = false;
  }
}
