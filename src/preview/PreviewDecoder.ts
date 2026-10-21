/**
 * PreviewDecoder.ts
 *
 * WebCodecs-based frame-on-demand decoder for the preview canvas player.
 * Replaces Chromium's <video> element seeking pipeline with mediabunny's
 * CanvasSink — a frame-accurate, sequential decoder that never enters
 * readyState limbo or seek thrashing.
 *
 * Architecture:
 * - One mediabunny Input + CanvasSink per unique media file (keyed by mediaId)
 * - Sequential iterator pattern (same as export engine's AssetDecoder) for
 *   efficient frame-by-frame playback — no re-seeking from keyframes
 * - Background pre-decode pump fills cache AHEAD of the playhead
 * - Render loop does SYNCHRONOUS cache lookups only (zero async in render path)
 * - Falls back to <video> elements during decoder warmup
 *
 * Connected to:
 * - CanvasRenderingEngine.ts: drawSingleClip uses cached frames
 * - PreviewCanvasContainer.tsx: kicks pre-decode pump each tick
 * - useMediaPlayback.ts: audio still uses <video> elements
 */

import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
} from 'mediabunny';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WrappedCanvas = {
  canvas: CanvasImageSource;
  timestamp: number;
  duration: number;
};

interface DecoderEntry {
  mediaId: string;
  url: string;
  input: InstanceType<typeof Input> | null;
  videoSink: InstanceType<typeof CanvasSink> | null;
  /** Native video dimensions from the decoded track */
  width: number;
  height: number;
  /** Codec string (e.g. 'avc1', 'hevc', 'vp9') */
  codec: string | null;
  /** True once load() resolves successfully */
  ready: boolean;
  /** If load() failed, the error message */
  loadError: string | null;
  /** Loading promise for dedup */
  loadPromise: Promise<void> | null;
  /** The blob source we fetched (kept alive so Input doesn't lose its source) */
  blobSource: InstanceType<typeof BlobSource> | null;
  /** Whether this entry has been disposed */
  disposed: boolean;

  // ── Sequential iterator state (mirrors AssetDecoder pattern) ──────────
  iterator: AsyncIterator<any> | null;
  current: WrappedCanvas | null;
  lookahead: WrappedCanvas | null;
  lastRequestedTime: number;
  /** Serialization tail to prevent overlapping decode calls */
  decodeTail: Promise<any>;
}

interface CachedFrame {
  /** The decoded frame as a drawable canvas image */
  drawable: CanvasImageSource;
  /** Native width of the decoded frame */
  width: number;
  /** Native height of the decoded frame */
  height: number;
  /** The source timestamp this frame corresponds to */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum concurrent decoder instances (limits GPU/CPU decoder sessions) */
const MAX_DECODERS = 6;

/**
 * Frame cache key granularity: quantize timestamps to this many FPS.
 * At 30fps, frames 0.000s and 0.015s map to the same cache slot (frame 0),
 * while 0.034s maps to frame 1. This prevents cache thrashing from
 * sub-frame timestamp jitter.
 */
const CACHE_FPS = 30;

/** Maximum cached frames per decoder (ring buffer) */
const MAX_FRAMES_PER_DECODER = 10;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

class PreviewDecoderManager {
  /** Map of mediaId → decoder entry */
  private decoders = new Map<string, DecoderEntry>();

  /**
   * Per-decoder frame ring buffer: mediaId → Map<frameIndex, CachedFrame>
   * Small per-decoder cache (10 frames) — holds the recent sequential run
   * so the sync render path can grab the latest decoded frame.
   */
  private frameCaches = new Map<string, Map<number, CachedFrame>>();

  /** Whether WebCodecs / mediabunny is available in this browser */
  private _webCodecsAvailable: boolean | null = null;

  /** Pre-decode pump state */
  private _pumpRunning = false;
  private _pumpRafId: number | null = null;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Check if WebCodecs-based preview decoding is available.
   */
  get isAvailable(): boolean {
    if (this._webCodecsAvailable === null) {
      this._webCodecsAvailable =
        typeof VideoDecoder !== 'undefined' &&
        typeof EncodedVideoChunk !== 'undefined';
    }
    return this._webCodecsAvailable;
  }

  /**
   * Ensure a decoder is loaded for the given media file.
   * Safe to call multiple times — deduplicates via loadPromise.
   */
  async ensureLoaded(mediaId: string, url: string): Promise<void> {
    if (!this.isAvailable) return;

    let entry = this.decoders.get(mediaId);
    if (entry) {
      if (entry.loadPromise) await entry.loadPromise;
      return;
    }

    // Evict oldest decoder if at capacity
    if (this.decoders.size >= MAX_DECODERS) {
      this.evictOldestDecoder();
    }

    entry = this.createEntry(mediaId, url);
    const loadPromise = this.loadDecoder(entry);
    entry.loadPromise = loadPromise;
    this.decoders.set(mediaId, entry);

    await loadPromise;
  }

  /**
   * Kick the background pre-decode pump for active clips.
   * Called ONCE per tick from PreviewCanvasContainer, BEFORE renderCanvasEngine.
   *
   * This fires-and-forgets async decodes that populate the frame cache.
   * The render pass then reads from cache synchronously.
   *
   * @param requests Active clips needing frames this tick
   */
  pumpFrames(
    requests: Array<{ mediaId: string; url: string; timestampSeconds: number; clipId: string }>
  ): void {
    if (!this.isAvailable || requests.length === 0) return;

    // Fire all decodes in parallel — don't await them
    for (const req of requests) {
      this.decodeFrameAsync(req.mediaId, req.url, req.timestampSeconds);
    }
  }

  /**
   * Synchronous cache-only lookup. Returns the decoded frame if already
   * in the ring buffer, null otherwise. This is the ONLY method called
   * during the render pass — zero async, zero blocking.
   */
  getFrameSync(mediaId: string, timestampSeconds: number): CachedFrame | null {
    const cache = this.frameCaches.get(mediaId);
    if (!cache) return null;

    const frameIndex = Math.round(timestampSeconds * CACHE_FPS);
    const exact = cache.get(frameIndex);
    if (exact) return exact;

    // Fuzzy: try ±1 frame (covers sub-frame jitter)
    const prev = cache.get(frameIndex - 1);
    if (prev) return prev;
    const next = cache.get(frameIndex + 1);
    if (next) return next;

    // Last resort: return the closest cached frame (for warmup period)
    let bestFrame: CachedFrame | null = null;
    let bestDist = Infinity;
    for (const [idx, frame] of cache) {
      const dist = Math.abs(idx - frameIndex);
      if (dist < bestDist) {
        bestDist = dist;
        bestFrame = frame;
      }
    }
    // Only use if within 5 frames (~167ms at 30fps)
    return bestDist <= 5 ? bestFrame : null;
  }

  /**
   * Check if a decoder is loaded and ready for the given media file.
   */
  isReady(mediaId: string): boolean {
    const entry = this.decoders.get(mediaId);
    return !!entry?.ready && !entry.loadError;
  }

  /**
   * Dispose a specific decoder and clear its cached frames.
   */
  disposeDecoder(mediaId: string): void {
    const entry = this.decoders.get(mediaId);
    if (!entry) return;
    this.cleanupEntry(entry);
    this.decoders.delete(mediaId);
    this.frameCaches.delete(mediaId);
  }

  /**
   * Dispose all decoders and clear the entire frame cache.
   */
  disposeAll(): void {
    for (const entry of this.decoders.values()) {
      this.cleanupEntry(entry);
    }
    this.decoders.clear();
    this.frameCaches.clear();
  }

  /**
   * Get diagnostic info for the playback diagnostics panel.
   */
  getDiagnostics(): {
    decoderCount: number;
    totalCachedFrames: number;
    decoders: Array<{ mediaId: string; ready: boolean; error: string | null; codec: string | null; cachedFrames: number }>;
  } {
    const decoderInfo: Array<{ mediaId: string; ready: boolean; error: string | null; codec: string | null; cachedFrames: number }> = [];
    let total = 0;
    for (const [id, entry] of this.decoders) {
      const cached = this.frameCaches.get(id)?.size || 0;
      total += cached;
      decoderInfo.push({
        mediaId: id,
        ready: entry.ready,
        error: entry.loadError,
        codec: entry.codec,
        cachedFrames: cached,
      });
    }
    return { decoderCount: this.decoders.size, totalCachedFrames: total, decoders: decoderInfo };
  }

  // -------------------------------------------------------------------------
  // Internal: Sequential decode (mirrors AssetDecoder pattern)
  // -------------------------------------------------------------------------

  /**
   * Fire-and-forget async decode. Populates the frame cache for the
   * given timestamp. Uses sequential iterator for efficient playback.
   */
  private async decodeFrameAsync(
    mediaId: string,
    url: string,
    timestampSeconds: number
  ): Promise<void> {
    // Ensure loaded (no-op if already loaded)
    let entry = this.decoders.get(mediaId);
    if (!entry) {
      // Start loading in background — will be available next tick
      this.ensureLoaded(mediaId, url);
      return;
    }
    if (entry.loadPromise) {
      // Still loading — skip this tick, will be ready later
      return;
    }
    if (!entry.ready || entry.loadError || entry.disposed) return;

    // Serialize: don't overlap decode calls on the same decoder
    const decodeWork = entry.decodeTail.then(async () => {
      if (entry!.disposed) return;
      try {
        const frame = await this.decodeSequential(entry!, timestampSeconds);
        if (frame) {
          this.cacheFrame(mediaId, timestampSeconds, {
            drawable: frame,
            width: (frame as any).width || entry!.width,
            height: (frame as any).height || entry!.height,
            timestamp: timestampSeconds,
          });
        }
      } catch (err: any) {
        // Non-fatal — render will fall back to <video> element
        if (!entry!.disposed) {
          console.warn(`[PreviewDecoder] decode error ${mediaId} @${timestampSeconds.toFixed(3)}s:`, err?.message || err);
        }
      }
    });

    entry.decodeTail = decodeWork.then(() => undefined, () => undefined);
  }

  /**
   * Sequential decode: advance the iterator to the requested timestamp.
   * Keeps decoder state between calls for efficient frame-by-frame playback.
   * Only restarts the iterator on backwards seeks or large forward jumps (>2.5s).
   *
   * This is the same algorithm used by the export engine's AssetDecoder.
   */
  private async decodeSequential(
    entry: DecoderEntry,
    timestampSeconds: number
  ): Promise<CanvasImageSource | null> {
    if (!entry.videoSink || entry.disposed) return null;

    // Initialize iterator on first use
    if (!entry.iterator) {
      this.resetIterator(entry, timestampSeconds);
    }

    // Backwards seek or large forward jump → restart iterator at new position
    // This prevents walking thousands of frames when seeking across the timeline
    if (
      entry.lastRequestedTime >= 0 &&
      (timestampSeconds + 0.0005 < entry.lastRequestedTime ||
       timestampSeconds - entry.lastRequestedTime > 2.5)
    ) {
      this.resetIterator(entry, timestampSeconds);
    }
    entry.lastRequestedTime = timestampSeconds;

    // Walk the iterator forward until we have the frame at/past our timestamp
    let iterations = 0;
    const MAX_ITERATIONS = 120; // Safety: don't walk more than 4 seconds at 30fps

    while (!entry.disposed && iterations < MAX_ITERATIONS) {
      iterations++;

      if (!entry.lookahead) {
        if (!entry.iterator) break;
        try {
          const next = await entry.iterator.next();
          if (next.done || !next.value) break;
          entry.lookahead = next.value as WrappedCanvas;
        } catch {
          break;
        }
      }

      // Keep the latest frame whose timestamp ≤ requested time
      if (entry.lookahead.timestamp <= timestampSeconds + 0.0005) {
        entry.current = entry.lookahead;
        entry.lookahead = null;
        continue;
      }
      break;
    }

    if (entry.current) return entry.current.canvas;
    if (entry.lookahead) return entry.lookahead.canvas;

    // Fallback: random-access decode (first frame, or after iterator exhaustion)
    try {
      const wrapped = await entry.videoSink.getCanvas(timestampSeconds);
      if (wrapped?.canvas) return wrapped.canvas;
    } catch {}

    return null;
  }

  private resetIterator(entry: DecoderEntry, startTime: number = 0): void {
    try { entry.iterator?.return?.(); } catch {}
    entry.iterator = entry.videoSink &&
      typeof (entry.videoSink as any).canvases === 'function'
        ? (entry.videoSink as any).canvases(startTime)[Symbol.asyncIterator]()
        : null;
    entry.current = null;
    entry.lookahead = null;
    entry.lastRequestedTime = startTime;
  }

  // -------------------------------------------------------------------------
  // Internal: Frame cache (per-decoder ring buffer)
  // -------------------------------------------------------------------------

  private cacheFrame(mediaId: string, timestamp: number, frame: CachedFrame): void {
    let cache = this.frameCaches.get(mediaId);
    if (!cache) {
      cache = new Map<number, CachedFrame>();
      this.frameCaches.set(mediaId, cache);
    }

    const frameIndex = Math.round(timestamp * CACHE_FPS);
    cache.set(frameIndex, frame);

    // Evict oldest if over capacity
    if (cache.size > MAX_FRAMES_PER_DECODER) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Decoder lifecycle
  // -------------------------------------------------------------------------

  private createEntry(mediaId: string, url: string): DecoderEntry {
    return {
      mediaId,
      url,
      input: null,
      videoSink: null,
      width: 0,
      height: 0,
      codec: null,
      ready: false,
      loadError: null,
      loadPromise: null,
      blobSource: null,
      disposed: false,
      iterator: null,
      current: null,
      lookahead: null,
      lastRequestedTime: -1,
      decodeTail: Promise.resolve(),
    };
  }

  private async loadDecoder(entry: DecoderEntry): Promise<void> {
    try {
      const response = await fetch(entry.url);
      if (!response.ok) {
        entry.loadError = `Fetch failed (${response.status})`;
        return;
      }
      const blob = await response.blob();

      if (entry.disposed) return;

      entry.blobSource = new BlobSource(blob);
      entry.input = new Input({ source: entry.blobSource, formats: ALL_FORMATS });

      const videoTrack = await entry.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        entry.loadError = 'No video track found';
        this.cleanupEntry(entry);
        return;
      }

      let canDecode = true;
      try {
        canDecode = await videoTrack.canDecode();
      } catch {
        canDecode = true;
      }
      if (!canDecode) {
        entry.loadError = 'Codec not supported by browser WebCodecs';
        this.cleanupEntry(entry);
        return;
      }

      try {
        entry.codec = await videoTrack.getCodec();
      } catch {
        entry.codec = null;
      }

      // Get video dimensions
      try {
        const metadata = await videoTrack.getMetadata();
        entry.width = (metadata as any)?.codedWidth || (metadata as any)?.width || 1920;
        entry.height = (metadata as any)?.codedHeight || (metadata as any)?.height || 1080;
      } catch {
        entry.width = 1920;
        entry.height = 1080;
      }

      // Create CanvasSink — prefer software decode to avoid exhausting
      // hardware decoder sessions (export engine may use hardware decoders)
      const decoderMode = entry.codec === 'hevc' ? 'prefer-hardware' : 'prefer-software';
      entry.videoSink = new CanvasSink(videoTrack, {
        decoderOptions: {
          hardwareAcceleration: decoderMode as HardwarePreference,
          optimizeForLatency: true,
        },
        poolSize: 4,
      });

      entry.ready = true;
      entry.loadError = null;
      console.log(
        `[PreviewDecoder] Loaded ${entry.mediaId}: ${entry.codec || 'unknown'} ${entry.width}×${entry.height} → ${decoderMode}`
      );
    } catch (err: any) {
      entry.loadError = `Load failed: ${err?.message || err}`;
      console.warn('[PreviewDecoder]', entry.loadError, entry.url);
      this.cleanupEntry(entry);
    } finally {
      entry.loadPromise = null;
    }
  }

  private evictOldestDecoder(): void {
    let evictId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.decoders) {
      if (entry.lastRequestedTime < oldestTime) {
        oldestTime = entry.lastRequestedTime;
        evictId = id;
      }
    }

    if (evictId) {
      console.log(`[PreviewDecoder] Evicting decoder: ${evictId}`);
      this.disposeDecoder(evictId);
    }
  }

  private cleanupEntry(entry: DecoderEntry): void {
    entry.disposed = true;
    entry.ready = false;

    try { entry.iterator?.return?.(); } catch {}
    entry.iterator = null;
    entry.current = null;
    entry.lookahead = null;

    if (entry.input) {
      try {
        const disposable = entry.input as any;
        if (typeof disposable.dispose === 'function') disposable.dispose();
        else {
          const symbolDispose = (Symbol as any).dispose;
          if (symbolDispose && typeof disposable[symbolDispose] === 'function') {
            disposable[symbolDispose]();
          }
        }
      } catch {}
      entry.input = null;
    }

    entry.videoSink = null;
    entry.blobSource = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Global preview decoder instance */
export const previewDecoder = new PreviewDecoderManager();

export type { CachedFrame };
