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
  private reusableCanvas: OffscreenCanvas | null = null;
  private reusableCtx: OffscreenCanvasRenderingContext2D | null = null;
  private decodeTail: Promise<any> = Promise.resolve();

  constructor(url: string) {
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

  async getFrameAt(timestampMicroseconds: number): Promise<CanvasImageSource | null> {
    if (!this.sink || !this.ready) return this.reusableCanvas || null;
    const timestampSeconds = Math.max(0, timestampMicroseconds / 1_000_000);

    const framePromise = this.decodeTail.then(async () => {
      try {
        const wrapped = await this.sink!.getCanvas(timestampSeconds);
        if (wrapped && wrapped.canvas) {
          const w = wrapped.canvas.width;
          const h = wrapped.canvas.height;
          if (!this.reusableCanvas || this.reusableCanvas.width !== w || this.reusableCanvas.height !== h) {
            this.reusableCanvas = new OffscreenCanvas(w, h);
            this.reusableCtx = this.reusableCanvas.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D;
          }

          this.reusableCtx!.clearRect(0, 0, w, h);
          this.reusableCtx!.drawImage(wrapped.canvas, 0, 0);
        }
        return this.reusableCanvas || null;
      } catch (err: any) {
        // In case of decoder seek glitch at clip boundary, reuse the last stable frame
        return this.reusableCanvas || null;
      }
    });

    this.decodeTail = framePromise.then(
      () => undefined,
      () => undefined,
    );
    return framePromise;
  }

  dispose(): void {
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
    this.reusableCanvas = null;
    this.reusableCtx = null;
    this.ready = false;
  }
}
