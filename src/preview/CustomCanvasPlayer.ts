/**
 * CustomCanvasPlayer.ts
 *
 * A high-performance, frame-accurate NLE preview player powered directly by
 * WebCodecs and mediabunny.
 *
 * Core Architecture:
 * 1. Zero Chromium <video> DOM elements — eliminates D3D11 presentation stalls,
 *    seeking freezes, readyState=1 delays, and the 16-decoder hardware ceiling.
 * 2. Dedicated WebCodecs VideoDecoder per media asset (hardware-accelerated on
 *    base track, software-preferred on overlays to conserve GPU sessions).
 * 3. Producer-Consumer Lookahead Ring Buffer: sequential background pump pre-decodes
 *    8-10 frames ahead.
 * 4. 100% Synchronous Frame Queries: the 60 FPS canvas loop fetches ready frames
 *    in <0.1ms without async blocking or microtask flood.
 * 5. Continuous GOP decoding across split clip boundaries — contiguous split clips
 *    share the decoder stream with ZERO re-seeking.
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

interface MediaDecoderEntry {
  mediaId: string;
  url: string;
  input: InstanceType<typeof Input> | null;
  sink: InstanceType<typeof CanvasSink> | null;
  width: number;
  height: number;
  duration: number;
  codec: string | null;
  ready: boolean;
  loadError: string | null;
  loadPromise: Promise<boolean> | null;
  disposed: boolean;
  isPrimaryTrack: boolean;
  // Sequential decode state
  iterator: AsyncIterator<any> | null;
  iteratorTime: number;
  decodeInFlight: boolean;
  decodeTail: Promise<any>;
}

interface ClipRingBuffer {
  clipId: string;
  mediaId: string;
  frames: CustomDecodedFrame[];
  lastAccessTime: number;
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
const MAX_RING_BUFFER_SIZE = 12;
const MAX_CONCURRENT_DECODERS = 8;

// ---------------------------------------------------------------------------
// CustomCanvasPlayer Class
// ---------------------------------------------------------------------------

export class CustomCanvasPlayer {
  private decoders = new Map<string, MediaDecoderEntry>();
  private clipBuffers = new Map<string, ClipRingBuffer>();
  private webCodecsAvailable: boolean | null = null;

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
   * Preload / initialize the WebCodecs decoder for a media file.
   * Dedupes multiple calls for the same mediaId.
   */
  async ensureMediaLoaded(mediaId: string, url: string, isPrimaryTrack: boolean = false): Promise<boolean> {
    if (!this.isSupported) return false;
    if (!url || url === 'PENDING_RESTORE') return false;

    let entry = this.decoders.get(mediaId);
    if (entry) {
      if (entry.loadPromise) return entry.loadPromise;
      return entry.ready;
    }

    // Evict oldest decoder if exceeding capacity
    if (this.decoders.size >= MAX_CONCURRENT_DECODERS) {
      this.evictOldestDecoder();
    }

    entry = {
      mediaId,
      url,
      input: null,
      sink: null,
      width: 1920,
      height: 1080,
      duration: 0,
      codec: null,
      ready: false,
      loadError: null,
      loadPromise: null,
      disposed: false,
      isPrimaryTrack,
      iterator: null,
      iteratorTime: -1,
      decodeInFlight: false,
      decodeTail: Promise.resolve(),
    };

    const loadPromise = this.initDecoder(entry);
    entry.loadPromise = loadPromise;
    this.decoders.set(mediaId, entry);

    return loadPromise;
  }

  /**
   * Synchronous Frame Lookup.
   * Called by CanvasRenderingEngine in the 60 FPS animation loop.
   * Returns the exact or closest cached frame in the ring buffer (<0.1ms).
   */
  getFrameSync(clipId: string, mediaTime: number): CustomDecodedFrame | null {
    const buffer = this.clipBuffers.get(clipId);
    if (!buffer || buffer.frames.length === 0) return null;

    buffer.lastAccessTime = performance.now();
    const frames = buffer.frames;

    // 1. Inside-duration match (newest frame at or before mediaTime)
    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i];
      if (mediaTime >= f.timestamp - 0.008 && mediaTime < f.timestamp + f.duration + 0.008) {
        return f;
      }
    }

    // 2. Nearest frame within a 100ms tolerance
    let closest: CustomDecodedFrame | null = null;
    let minDelta = Infinity;
    for (let i = 0; i < frames.length; i++) {
      const delta = Math.abs(frames[i].timestamp - mediaTime);
      if (delta < minDelta) {
        minDelta = delta;
        closest = frames[i];
      }
    }

    return minDelta <= 0.10 ? closest : null;
  }

  /**
   * Lookahead Pump:
   * Called each animation frame by PreviewCanvasContainer.
   * Non-blocking / fire-and-forget background pump that fills each active clip's
   * ring buffer up to MAX_LOOKAHEAD_FRAMES ahead of the playhead.
   */
  pumpLookahead(
    requests: Array<{
      clipId: string;
      mediaId: string;
      url: string;
      mediaTime: number;
      isPrimaryTrack?: boolean;
    }>
  ): void {
    if (!this.isSupported || requests.length === 0) return;

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      let buffer = this.clipBuffers.get(req.clipId);
      if (!buffer) {
        buffer = {
          clipId: req.clipId,
          mediaId: req.mediaId,
          frames: [],
          lastAccessTime: performance.now(),
        };
        this.clipBuffers.set(req.clipId, buffer);
      }

      // Check if decoder is loaded
      let entry = this.decoders.get(req.mediaId);
      if (!entry) {
        this.ensureMediaLoaded(req.mediaId, req.url, !!req.isPrimaryTrack);
        continue;
      }
      if (!entry.ready || entry.loadError || entry.disposed) continue;

      // Check if we need more lookahead frames
      const futureFrames = buffer.frames.filter((f) => f.timestamp >= req.mediaTime - 0.02);
      if (futureFrames.length >= MAX_LOOKAHEAD_FRAMES) {
        // Trim old frames behind playhead (keep at most 2 previous frames for micro-scrub)
        while (buffer.frames.length > 0 && buffer.frames[0].timestamp < req.mediaTime - 0.20) {
          buffer.frames.shift();
        }
        continue;
      }

      // Trigger background sequential decode batch
      this.decodeAheadBatch(entry, buffer, req.mediaTime);
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

    let entry = this.decoders.get(mediaId);
    if (!entry || !entry.ready) {
      await this.ensureMediaLoaded(mediaId, url);
      entry = this.decoders.get(mediaId);
    }
    if (!entry || !entry.sink || entry.disposed) return null;

    try {
      const wrapped = await entry.sink.getCanvas(mediaTime);
      if (!wrapped || !wrapped.canvas) return null;

      const frame: CustomDecodedFrame = {
        drawable: wrapped.canvas,
        width: (wrapped.canvas as any).width || entry.width,
        height: (wrapped.canvas as any).height || entry.height,
        timestamp: wrapped.timestamp,
        duration: wrapped.duration || 1 / 30,
      };

      let buffer = this.clipBuffers.get(clipId);
      if (!buffer) {
        buffer = {
          clipId,
          mediaId,
          frames: [],
          lastAccessTime: performance.now(),
        };
        this.clipBuffers.set(clipId, buffer);
      }

      // Place in buffer as authoritative frame
      buffer.frames = [frame];
      buffer.lastAccessTime = performance.now();

      // Reset iterator to this position so subsequent playback starts sequentially from here
      this.resetIterator(entry, mediaTime);

      return frame;
    } catch {
      return null;
    }
  }

  /**
   * Clear ring buffer for a clip (e.g. when removed or jumped).
   */
  clearClipBuffer(clipId: string): void {
    this.clipBuffers.delete(clipId);
  }

  /**
   * Dispose an individual media decoder and free all its buffers.
   */
  disposeMedia(mediaId: string): void {
    const entry = this.decoders.get(mediaId);
    if (entry) {
      this.cleanupEntry(entry);
      this.decoders.delete(mediaId);
    }
    const clipIdsToDelete: string[] = [];
    this.clipBuffers.forEach((buffer, clipId) => {
      if (buffer.mediaId === mediaId) {
        clipIdsToDelete.push(clipId);
      }
    });
    for (let i = 0; i < clipIdsToDelete.length; i++) {
      this.clipBuffers.delete(clipIdsToDelete[i]);
    }
  }

  /**
   * Dispose all decoders and clear all ring buffers.
   */
  disposeAll(): void {
    this.decoders.forEach((entry) => {
      this.cleanupEntry(entry);
    });
    this.decoders.clear();
    this.clipBuffers.clear();
  }

  /**
   * Diagnostics telemetry.
   */
  getDiagnostics(): CustomPlayerDiagnostics {
    let totalFrames = 0;
    this.clipBuffers.forEach((b) => {
      totalFrames += b.frames.length;
    });
    const decs: Array<{
      mediaId: string;
      ready: boolean;
      codec: string | null;
      width: number;
      height: number;
      error: string | null;
    }> = [];
    this.decoders.forEach((e) => {
      decs.push({
        mediaId: e.mediaId,
        ready: e.ready,
        codec: e.codec,
        width: e.width,
        height: e.height,
        error: e.loadError,
      });
    });
    return {
      decoderCount: this.decoders.size,
      activeBuffers: this.clipBuffers.size,
      totalBufferedFrames: totalFrames,
      decoders: decs,
    };
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  private async initDecoder(entry: MediaDecoderEntry): Promise<boolean> {
    try {
      const res = await fetch(entry.url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const blob = await res.blob();
      const source = new BlobSource(blob);

      if (entry.disposed) return false;

      entry.input = new Input({ source, formats: ALL_FORMATS });
      const videoTrack = await entry.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        entry.loadError = 'No video track found';
        return false;
      }

      try {
        entry.codec = (await videoTrack.getCodec?.()) || videoTrack.codec || null;
      } catch {
        entry.codec = null;
      }

      try {
        const cw = (await videoTrack.getCodedWidth?.()) || videoTrack.codedWidth;
        const ch = (await videoTrack.getCodedHeight?.()) || videoTrack.codedHeight;
        entry.width = cw || 1920;
        entry.height = ch || 1080;
      } catch {
        entry.width = 1920;
        entry.height = 1080;
      }

      // Hardware preference: primary track gets hardware acceleration,
      // overlays use software to preserve GPU decoder sessions
      const hwPref = entry.isPrimaryTrack ? 'prefer-hardware' : 'prefer-software';
      entry.sink = new CanvasSink(videoTrack, {
        decoderOptions: {
          hardwareAcceleration: hwPref,
          optimizeForLatency: true,
        },
        poolSize: 12, // Recycled canvas pool eliminates allocation churn
      });

      entry.ready = true;
      entry.loadError = null;
      return true;
    } catch (err: any) {
      entry.loadError = err?.message || String(err);
      entry.ready = false;
      return false;
    } finally {
      entry.loadPromise = null;
    }
  }

  private decodeAheadBatch(
    entry: MediaDecoderEntry,
    buffer: ClipRingBuffer,
    targetMediaTime: number
  ): void {
    if (entry.decodeInFlight || entry.disposed || !entry.sink) return;
    entry.decodeInFlight = true;

    const work = entry.decodeTail.then(async () => {
      if (entry.disposed || !entry.sink) return;
      try {
        // Check if sequential iterator needs to be started or repositioned
        const needsReset =
          !entry.iterator ||
          targetMediaTime < entry.iteratorTime - 0.15 ||
          targetMediaTime > entry.iteratorTime + 2.0;

        if (needsReset) {
          this.resetIterator(entry, targetMediaTime);
        }

        let decodedCount = 0;
        const BATCH_SIZE = 4;

        while (decodedCount < BATCH_SIZE && !entry.disposed && entry.iterator) {
          const next = await entry.iterator.next();
          if (next.done || !next.value) break;

          const wrapped = next.value;
          const frame: CustomDecodedFrame = {
            drawable: wrapped.canvas,
            width: (wrapped.canvas as any).width || entry.width,
            height: (wrapped.canvas as any).height || entry.height,
            timestamp: wrapped.timestamp,
            duration: wrapped.duration || 1 / 30,
          };

          entry.iteratorTime = wrapped.timestamp;

          // Deduplicate close timestamps
          const isDuplicate = buffer.frames.some(
            (f) => Math.abs(f.timestamp - frame.timestamp) < 0.008
          );
          if (!isDuplicate) {
            buffer.frames.push(frame);
            buffer.frames.sort((a, b) => a.timestamp - b.timestamp);
            decodedCount++;
          }
        }

        // Bounded ring buffer eviction
        while (
          buffer.frames.length > MAX_RING_BUFFER_SIZE ||
          (buffer.frames.length > 2 && buffer.frames[0].timestamp < targetMediaTime - 0.20)
        ) {
          buffer.frames.shift();
        }
      } catch {
        // Fallback next tick
      } finally {
        entry.decodeInFlight = false;
      }
    });

    entry.decodeTail = work.then(() => undefined, () => undefined);
  }

  private resetIterator(entry: MediaDecoderEntry, startTime: number): void {
    try {
      entry.iterator?.return?.();
    } catch {}
    entry.iterator =
      entry.sink && typeof (entry.sink as any).canvases === 'function'
        ? (entry.sink as any).canvases(Math.max(0, startTime))[Symbol.asyncIterator]()
        : null;
    entry.iteratorTime = Math.max(0, startTime);
  }

  private evictOldestDecoder(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    this.decoders.forEach((entry, id) => {
      if (entry.iteratorTime < oldestTime) {
        oldestTime = entry.iteratorTime;
        oldestId = id;
      }
    });

    if (oldestId) {
      this.disposeMedia(oldestId);
    }
  }

  private cleanupEntry(entry: MediaDecoderEntry): void {
    entry.disposed = true;
    entry.ready = false;
    try {
      entry.iterator?.return?.();
    } catch {}
    entry.iterator = null;
    if (entry.input) {
      try {
        const disposable = entry.input as any;
        if (typeof disposable.dispose === 'function') disposable.dispose();
      } catch {}
      entry.input = null;
    }
    entry.sink = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance Export
// ---------------------------------------------------------------------------

export const customCanvasPlayer = new CustomCanvasPlayer();
