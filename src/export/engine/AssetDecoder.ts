import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
} from 'mediabunny';

type DecodeRequest = {
  timestampSeconds: number;
  resolve: (canvas: CanvasImageSource | null) => void;
};

/**
 * Sequential, software-preferred export decoder.
 *
 * CanvasSink.getCanvas() creates a new sparse seek pipeline for every call. At
 * 30fps this repeatedly decodes from keyframes and can make a one-minute export
 * take many minutes. canvasesAtTimestamps() keeps one decoder alive and decodes
 * monotonically requested frames only once.
 */
export class AssetDecoder {
  public rotation: number = 0;
  public ready: boolean = false;
  public loadError: string | null = null;

  private url: string;
  private input: any = null;
  private sink: InstanceType<typeof CanvasSink> | null = null;
  private decodeTail: Promise<any> = Promise.resolve();
  private requests: DecodeRequest[] = [];
  private wakeRequests: (() => void) | null = null;
  private pumpPromise: Promise<void> | null = null;
  private disposed = false;

  constructor(url: string, _legacyOptions?: unknown) {
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
        source = new BlobSource(await resp.blob());
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
      } catch (e) {
        // Test shims and a few older Chromium builds omit the static support
        // probe even though the actual decoder works.
        console.warn('[AssetDecoder] canDecode check threw, attempting decode:', e);
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
      this.rotation = 0; // CanvasSink applies metadata rotation itself.
      (this as any)._originalRotation = originalRotation;

      this.sink = new CanvasSink(videoTrack, {
        // Avoid Chrome's limited pool of hardware decoder sessions when a
        // project contains dozens of clips. H.264 encoding remains hardware
        // accelerated; only source decoding is moved to the stable CPU path.
        decoderOptions: {
          hardwareAcceleration: 'prefer-software',
          optimizeForLatency: true,
        },
        // A small ring avoids allocations while keeping overlapping uses of the
        // same media from overwriting one another before composition.
        poolSize: 6,
      });
      this.disposed = false;
      this.ready = true;

      if (typeof (this.sink as any).canvasesAtTimestamps === 'function') {
        this.pumpPromise = this.runSequentialPump();
      }
    } catch (e: any) {
      this.loadError = `Media initialization failed: ${e?.message || e}`;
      console.warn('[AssetDecoder]', this.loadError, this.url);
      this.dispose();
    }
  }

  private async *timestampRequests(): AsyncGenerator<number> {
    while (!this.disposed) {
      if (this.requests.length === 0) {
        await new Promise<void>((resolve) => { this.wakeRequests = resolve; });
        this.wakeRequests = null;
        if (this.disposed) return;
      }
      const request = this.requests[0];
      if (request) yield request.timestampSeconds;
    }
  }

  private async runSequentialPump(): Promise<void> {
    try {
      const iterator = (this.sink as any).canvasesAtTimestamps(this.timestampRequests());
      for await (const wrapped of iterator) {
        const request = this.requests.shift();
        if (request) request.resolve(wrapped?.canvas || null);
        if (this.disposed) break;
      }
    } catch (err: any) {
      this.loadError = `Video decoding failed: ${err?.message || err}`;
      while (this.requests.length) this.requests.shift()!.resolve(null);
    }
  }

  async getFrameAt(timestampMicroseconds: number): Promise<CanvasImageSource | null> {
    if (!this.sink || !this.ready || this.disposed) return null;
    const timestampSeconds = Math.max(0, timestampMicroseconds / 1_000_000);

    // Preferred path: one persistent, optimized decoder pipeline.
    if (this.pumpPromise) {
      return new Promise<CanvasImageSource | null>((resolve) => {
        this.requests.push({ timestampSeconds, resolve });
        this.wakeRequests?.();
      });
    }

    // Compatibility path for older Mediabunny versions and test doubles.
    const framePromise = this.decodeTail.then(async () => {
      try {
        const wrapped = await this.sink!.getCanvas(timestampSeconds);
        return wrapped?.canvas || null;
      } catch {
        return null;
      }
    });
    this.decodeTail = framePromise.then(() => undefined, () => undefined);
    return framePromise;
  }

  dispose(): void {
    this.disposed = true;
    this.wakeRequests?.();
    this.wakeRequests = null;
    while (this.requests.length) this.requests.shift()!.resolve(null);

    if (this.input) {
      try {
        const disposable = this.input as any;
        if (typeof disposable.dispose === 'function') disposable.dispose();
        else {
          const symDispose = (Symbol as any).dispose;
          if (symDispose && typeof disposable[symDispose] === 'function') disposable[symDispose]();
        }
      } catch {}
      this.input = null;
    }
    this.sink = null;
    this.pumpPromise = null;
    this.ready = false;
  }
}
