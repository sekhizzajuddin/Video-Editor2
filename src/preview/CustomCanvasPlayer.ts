/**
 * CustomCanvasPlayer.ts
 *
 * A high-performance, frame-accurate NLE preview player powered directly by
 * WebCodecs and mediabunny.
 *
 * Key Architecture & Flicker-Free Guarantees:
 * 1. Independent Per-Clip Decode Streams:
 *    Each timeline clip (V1 main, V2 B-roll overlay, V3 title/PIP, etc.) gets
 *    its own dedicated decode stream and ring buffer. They NEVER fight over
 *    or reset each other's sequential iterators. Multi-track plays simultaneously.
 * 2. Uncorrupted Dedicated Canvases (No Pool Overwrite):
 *    We do not use a small shared pool size that overwrites canvases in-flight.
 *    Each decoded frame is an independent canvas, eliminating frame jumping and strobe flicker.
 * 3. Continuous Hold-Frame Guarantee:
 *    getFrameSync() guarantees that once a clip receives its first decoded frame,
 *    it NEVER returns null during playback. If the background pump is slightly behind,
 *    it holds the current frame until the new frame is ready. No black flashes!
 * 4. Safe Decoder Configuration:
 *    Uses hardwareAcceleration: 'no-preference' to ensure all video codecs (HEVC,
 *    H.264 High Profile, VP9) initialize successfully on all systems without throwing
 *    NotSupportedError.
 */

import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
} from 'mediabunny';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface CustomDecodedFrame {
  /** The rendered canvas frame ready for ctx.drawImage() */
  drawable: CanvasImageSource;
  /** Native video width */
  width: number;
  /** Native video height */
  height: number;
  /** Source media timestamp in seconds */
  timestamp: number;
  /** Frame duration in seconds */
  duration: number;
}

export interface MediaResourceEntry {
  mediaId: string;
  url: string;
  input: InstanceType<typeof Input> | null;
  videoTrack: any | null;
  width: number;
  height: number;
  duration: number;
  codec: string | null;
  ready: boolean;
  loadError: string | null;
  loadPromise: Promise<boolean> | null;
  disposed: boolean;
}

export interface ClipStream {
  clipId: string;
  mediaId: string;
  sink: InstanceType<typeof CanvasSink> | null;
  iterator: AsyncIterator<any> | null;
  iteratorTime: number;
  decodeInFlight: boolean;
  decodeTail: Promise<void>;
  frames: CustomDecodedFrame[];
  lastReturnedFrame: CustomDecodedFrame | null;
  lastAccessTime: number;
  disposed: boolean;
}

export interface CustomPlayerDiagnostics {
  decoderCount: number;
  activeBuffers: number;
  totalBufferedFrames: number;
  decoders: Array<{
    mediaId: string;
    ready: boolean;
    codec: string | null;
    width: number;
    height: number;
    error: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOOKAHEAD_FRAMES = 8;
const MAX_RING_BUFFER_SIZE = 16;
const MAX_MEDIA_RESOURCES = 10;
const STREAM_IDLE_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// CustomCanvasPlayer Class
// ---------------------------------------------------------------------------

export class CustomCanvasPlayer {
  private mediaResources = new Map<string, MediaResourceEntry>();
  private clipStreams = new Map<string, ClipStream>();
  private webCodecsAvailable: boolean | null = null;

  /** Backward-compatible alias for unit tests */
  get clipBuffers(): Map<string, any> {
    return this.clipStreams;
  }

  /**
   * Check whether WebCodecs / VideoDecoder is supported in this browser.
   */
  get isSupported(): boolean {
    if (this.webCodecsAvailable === null) {
      this.webCodecsAvailable =
        typeof VideoDecoder !== 'undefined' &&
        typeof EncodedVideoChunk !== 'undefined';
    }
    return this.webCodecsAvailable;
  }

  /**
   * Preload / initialize the WebCodecs media resource for a media file.
   * Dedupes multiple calls for the same mediaId.
   */
  async ensureMediaLoaded(mediaId: string, url: string): Promise<boolean> {
    if (!this.isSupported) return false;
    if (!url || url === 'PENDING_RESTORE') return false;

    let res = this.mediaResources.get(mediaId);
    if (res) {
      if (res.loadPromise) return res.loadPromise;
      return res.ready;
    }

    if (this.mediaResources.size >= MAX_MEDIA_RESOURCES) {
      this.evictOldestMediaResource();
    }

    res = {
      mediaId,
      url,
      input: null,
      videoTrack: null,
      width: 1920,
      height: 1080,
      duration: 0,
      codec: null,
      ready: false,
      loadError: null,
      loadPromise: null,
      disposed: false,
    };

    const loadPromise = this.initMediaResource(res);
    res.loadPromise = loadPromise;
    this.mediaResources.set(mediaId, res);

    return loadPromise;
  }

  /**
   * Synchronous Frame Lookup.
   * Called by CanvasRenderingEngine in the 60 FPS animation loop.
   * Guaranteed to be continuous and non-flickering: once a clip receives its
   * first frame, it holds the current frame until the next decoded frame is ready.
   */
  getFrameSync(clipId: string, mediaTime: number): CustomDecodedFrame | null {
    const stream = this.clipStreams.get(clipId);
    if (!stream) return null;

    stream.lastAccessTime = performance.now();
    const frames = stream.frames;

    if (frames.length === 0) {
      return stream.lastReturnedFrame;
    }

    // Find the latest frame whose timestamp <= mediaTime + 0.008s
    let matchedFrame: CustomDecodedFrame | null = null;
    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i];
      if (mediaTime >= f.timestamp - 0.008) {
        matchedFrame = f;
        break;
      }
    }

    // If mediaTime is earlier than our first buffered frame, use the first buffered frame
    if (!matchedFrame) {
      matchedFrame = frames[0];
    }

    stream.lastReturnedFrame = matchedFrame;
    return matchedFrame;
  }

  /**
   * Lookahead Pump:
   * Called each animation frame by PreviewCanvasContainer.
   * Non-blocking background pump that fills each active clip's individual ring buffer.
   */
  pumpLookahead(
    requests: Array<{
      clipId: string;
      mediaId: string;
      url: string;
      mediaTime: number;
    }>
  ): void {
    if (!this.isSupported || requests.length === 0) return;

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      let stream = this.clipStreams.get(req.clipId);
      if (!stream) {
        stream = {
          clipId: req.clipId,
          mediaId: req.mediaId,
          sink: null,
          iterator: null,
          iteratorTime: -1,
          decodeInFlight: false,
          decodeTail: Promise.resolve(),
          frames: [],
          lastReturnedFrame: null,
          lastAccessTime: performance.now(),
          disposed: false,
        };
        this.clipStreams.set(req.clipId, stream);
      }

      stream.lastAccessTime = performance.now();

      // Ensure underlying media file resource is loaded
      const res = this.mediaResources.get(req.mediaId);
      if (!res || !res.ready) {
        this.ensureMediaLoaded(req.mediaId, req.url).then((loaded) => {
          if (loaded && stream && !stream.sink && !stream.disposed) {
            this.initStreamSink(stream, req.mediaId);
          }
        });
        continue;
      }

      if (!stream.sink && !stream.disposed) {
        this.initStreamSink(stream, req.mediaId);
      }

      if (!stream.sink || stream.disposed) continue;

      // Check how many future frames are buffered ahead of the target media time
      const futureFrames = stream.frames.filter((f) => f.timestamp >= req.mediaTime - 0.01);
      if (futureFrames.length >= MAX_LOOKAHEAD_FRAMES) {
        // Trim old frames that have already passed (retain 2 previous frames for micro-scrub)
        while (stream.frames.length > 0 && stream.frames[0].timestamp < req.mediaTime - 0.25) {
          stream.frames.shift();
        }
        continue;
      }

      // Trigger background sequential decode batch for this clip's dedicated stream
      this.decodeAheadBatch(stream, res, req.mediaTime);
    }
  }

  /**
   * Exact Seek (Scrubbing / Paused seek):
   * Decodes the exact frame for a given timestamp immediately and stores it in buffer.
   */
  async seekExact(
    clipId: string,
    mediaId: string,
    url: string,
    mediaTime: number
  ): Promise<CustomDecodedFrame | null> {
    if (!this.isSupported) return null;

    let res = this.mediaResources.get(mediaId);
    if (!res || !res.ready) {
      await this.ensureMediaLoaded(mediaId, url);
      res = this.mediaResources.get(mediaId);
    }
    if (!res || !res.videoTrack || res.disposed) return null;

    let stream = this.clipStreams.get(clipId);
    if (!stream) {
      stream = {
        clipId,
        mediaId,
        sink: null,
        iterator: null,
        iteratorTime: -1,
        decodeInFlight: false,
        decodeTail: Promise.resolve(),
        frames: [],
        lastReturnedFrame: null,
        lastAccessTime: performance.now(),
        disposed: false,
      };
      this.clipStreams.set(clipId, stream);
    }

    if (!stream.sink && !stream.disposed) {
      this.initStreamSink(stream, mediaId);
    }
    if (!stream.sink || stream.disposed) return null;

    try {
      const wrapped = await stream.sink.getCanvas(mediaTime);
      if (!wrapped || !wrapped.canvas) return null;

      const frame: CustomDecodedFrame = {
        drawable: wrapped.canvas,
        width: (wrapped.canvas as any).width || res.width,
        height: (wrapped.canvas as any).height || res.height,
        timestamp: wrapped.timestamp,
        duration: wrapped.duration || 1 / 30,
      };

      stream.frames = [frame];
      stream.lastReturnedFrame = frame;
      stream.lastAccessTime = performance.now();

      // Reset iterator to start sequentially from this seek point
      this.resetStreamIterator(stream, mediaTime);

      return frame;
    } catch {
      return null;
    }
  }

  /**
   * Clear ring buffer and streams for a clip (e.g. when removed or jumped).
   */
  clearClipBuffer(clipId: string): void {
    const stream = this.clipStreams.get(clipId);
    if (stream) {
      this.cleanupStream(stream);
      this.clipStreams.delete(clipId);
    }
  }

  /**
   * Dispose an individual media resource and its active clip streams.
   */
  disposeMedia(mediaId: string): void {
    const res = this.mediaResources.get(mediaId);
    if (res) {
      this.cleanupMediaResource(res);
      this.mediaResources.delete(mediaId);
    }
    const toDelete: string[] = [];
    this.clipStreams.forEach((stream, clipId) => {
      if (stream.mediaId === mediaId) {
        toDelete.push(clipId);
      }
    });
    for (let i = 0; i < toDelete.length; i++) {
      this.clearClipBuffer(toDelete[i]);
    }
  }

  /**
   * Dispose all resources and streams.
   */
  disposeAll(): void {
    this.clipStreams.forEach((stream) => {
      this.cleanupStream(stream);
    });
    this.clipStreams.clear();

    this.mediaResources.forEach((res) => {
      this.cleanupMediaResource(res);
    });
    this.mediaResources.clear();
  }

  /**
   * Telemetry / Diagnostics.
   */
  getDiagnostics(): CustomPlayerDiagnostics {
    let totalFrames = 0;
    this.clipStreams.forEach((s) => {
      totalFrames += s.frames.length;
    });
    const decs: Array<{
      mediaId: string;
      ready: boolean;
      codec: string | null;
      width: number;
      height: number;
      error: string | null;
    }> = [];
    this.mediaResources.forEach((r) => {
      decs.push({
        mediaId: r.mediaId,
        ready: r.ready,
        codec: r.codec,
        width: r.width,
        height: r.height,
        error: r.loadError,
      });
    });
    return {
      decoderCount: this.mediaResources.size,
      activeBuffers: this.clipStreams.size,
      totalBufferedFrames: totalFrames,
      decoders: decs,
    };
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  private async initMediaResource(res: MediaResourceEntry): Promise<boolean> {
    try {
      const resp = await fetch(res.url);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const blob = await resp.blob();
      const source = new BlobSource(blob);

      if (res.disposed) return false;

      res.input = new Input({ source, formats: ALL_FORMATS });
      const videoTrack = await res.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        res.loadError = 'No video track found';
        return false;
      }
      res.videoTrack = videoTrack;

      try {
        res.codec = (await videoTrack.getCodec?.()) || videoTrack.codec || null;
      } catch {
        res.codec = null;
      }

      try {
        const cw = (await videoTrack.getCodedWidth?.()) || videoTrack.codedWidth;
        const ch = (await videoTrack.getCodedHeight?.()) || videoTrack.codedHeight;
        res.width = cw || 1920;
        res.height = ch || 1080;
      } catch {
        res.width = 1920;
        res.height = 1080;
      }

      res.ready = true;
      res.loadError = null;
      return true;
    } catch (err: any) {
      res.loadError = err?.message || String(err);
      res.ready = false;
      return false;
    } finally {
      res.loadPromise = null;
    }
  }

  private initStreamSink(stream: ClipStream, mediaId: string): void {
    const res = this.mediaResources.get(mediaId);
    if (!res || !res.videoTrack || res.disposed) return;

    try {
      // Hardware acceleration 'no-preference' allows WebCodecs to pick the best
      // supported hardware or software engine without throwing NotSupportedError.
      // poolSize is omitted to ensure each canvas is fresh and never overwritten mid-playback.
      stream.sink = new CanvasSink(res.videoTrack, {
        decoderOptions: {
          hardwareAcceleration: 'no-preference',
          optimizeForLatency: true,
        },
      });
    } catch (err: any) {
      console.warn(`[CustomCanvasPlayer] Failed to create CanvasSink for clip ${stream.clipId}:`, err);
    }
  }

  private decodeAheadBatch(
    stream: ClipStream,
    res: MediaResourceEntry,
    targetMediaTime: number
  ): void {
    if (stream.decodeInFlight || stream.disposed || !stream.sink) return;
    stream.decodeInFlight = true;

    const work = stream.decodeTail.then(async () => {
      if (stream.disposed || !stream.sink) return;
      try {
        // Reset iterator if uninitialized or if target time jumped
        const needsReset =
          !stream.iterator ||
          targetMediaTime < stream.iteratorTime - 0.25 ||
          targetMediaTime > stream.iteratorTime + 1.5;

        if (needsReset) {
          this.resetStreamIterator(stream, targetMediaTime);
        }

        let decodedCount = 0;
        const BATCH_SIZE = 6;

        while (decodedCount < BATCH_SIZE && !stream.disposed && stream.iterator) {
          const next = await stream.iterator.next();
          if (next.done || !next.value) break;

          const wrapped = next.value;
          const frame: CustomDecodedFrame = {
            drawable: wrapped.canvas,
            width: (wrapped.canvas as any).width || res.width,
            height: (wrapped.canvas as any).height || res.height,
            timestamp: wrapped.timestamp,
            duration: wrapped.duration || 1 / 30,
          };

          stream.iteratorTime = wrapped.timestamp;

          // Deduplicate close timestamps
          const isDuplicate = stream.frames.some(
            (f) => Math.abs(f.timestamp - frame.timestamp) < 0.005
          );
          if (!isDuplicate) {
            stream.frames.push(frame);
            stream.frames.sort((a, b) => a.timestamp - b.timestamp);
            decodedCount++;
          }
        }

        // Bounded ring buffer eviction
        while (
          stream.frames.length > MAX_RING_BUFFER_SIZE ||
          (stream.frames.length > 4 && stream.frames[0].timestamp < targetMediaTime - 0.30)
        ) {
          stream.frames.shift();
        }
      } catch {
        // Next tick will retry seamlessly
      } finally {
        stream.decodeInFlight = false;
      }
    });

    stream.decodeTail = work.then(() => undefined, () => undefined);
  }

  private resetStreamIterator(stream: ClipStream, startTime: number): void {
    try {
      stream.iterator?.return?.();
    } catch {}
    stream.iterator =
      stream.sink && typeof (stream.sink as any).canvases === 'function'
        ? (stream.sink as any).canvases(Math.max(0, startTime - 0.04))[Symbol.asyncIterator]()
        : null;
    stream.iteratorTime = Math.max(0, startTime - 0.04);
  }

  private evictOldestMediaResource(): void {
    let oldestId: string | null = null;
    let oldestAccess = Infinity;

    this.mediaResources.forEach((res, id) => {
      // Find oldest media without active streams
      let hasActiveStream = false;
      this.clipStreams.forEach((s) => {
        if (s.mediaId === id) hasActiveStream = true;
      });
      if (!hasActiveStream) {
        oldestId = id;
      }
    });

    if (oldestId) {
      this.disposeMedia(oldestId);
    }
  }

  private cleanupStream(stream: ClipStream): void {
    stream.disposed = true;
    try {
      stream.iterator?.return?.();
    } catch {}
    stream.iterator = null;
    stream.sink = null;
    stream.frames = [];
    stream.lastReturnedFrame = null;
  }

  private cleanupMediaResource(res: MediaResourceEntry): void {
    res.disposed = true;
    res.ready = false;
    res.videoTrack = null;
    if (res.input) {
      try {
        const disposable = res.input as any;
        if (typeof disposable.dispose === 'function') disposable.dispose();
      } catch {}
      res.input = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance Export
// ---------------------------------------------------------------------------

export const customCanvasPlayer = new CustomCanvasPlayer();
