/**
 * PreviewDecoder.ts
 *
 * WebCodecs-based frame-on-demand decoder for the preview canvas player.
 * Replaces Chromium's <video> element seeking pipeline with mediabunny's
 * CanvasSink.getCanvas(timestamp) — a frame-accurate, random-access decoder
 * that never enters readyState limbo or seek thrashing.
 *
 * Architecture:
 * - One mediabunny Input + CanvasSink per unique media file (keyed by mediaId)
 * - getFrame(mediaId, url, timestamp) returns a CanvasImageSource synchronously
 *   from cache, or asynchronously via decode
 * - LRU frame cache (ImageBitmap) for scrub-back without re-decode
 * - Singleton instance shared across all clips
 *
 * Connected to:
 * - CanvasRenderingEngine.ts: drawSingleClip uses getFrame() instead of videoEl
 * - PreviewCanvasContainer.tsx: pre-render step resolves active clip frames
 * - useMediaPlayback.ts: audio still uses <video> elements; video bypasses them
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
  /** Reference count — how many active clips are using this decoder */
  refCount: number;
  /** Last requested timestamp (for sequential access optimization) */
  lastRequestedTime: number;
  /** Serialization tail to prevent overlapping getCanvas() calls */
  decodeTail: Promise<any>;
  /** The blob source we fetched (kept alive so Input doesn't lose its source) */
  blobSource: InstanceType<typeof BlobSource> | null;
}

interface CachedFrame {
  /** The decoded frame as a drawable canvas image */
  drawable: CanvasImageSource;
  /** Native width of the decoded frame */
  width: number;
  /** Native height of the decoded frame */
  height: number;
  /** Cache insertion timestamp for LRU eviction */
  lastUsed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of decoded frames to keep in the LRU cache */
const MAX_CACHED_FRAMES = 60;

/** Maximum concurrent decoder instances (limits GPU/CPU decoder sessions) */
const MAX_DECODERS = 6;

/**
 * Frame cache key granularity: quantize timestamps to this many FPS.
 * At 30fps, frames 0.000s and 0.015s map to the same cache slot (frame 0),
 * while 0.034s maps to frame 1. This prevents cache thrashing from
 * sub-frame timestamp jitter.
 */
const CACHE_FPS = 30;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

class PreviewDecoderManager {
  /** Map of mediaId → decoder entry */
  private decoders = new Map<string, DecoderEntry>();

  /** LRU frame cache: "${mediaId}:${frameIndex}" → CachedFrame */
  private frameCache = new Map<string, CachedFrame>();

  /** Eviction order tracking */
  private frameCacheOrder: string[] = [];

  /** Whether WebCodecs / mediabunny is available in this browser */
  private _webCodecsAvailable: boolean | null = null;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Check if WebCodecs-based preview decoding is available.
   * Falls back to false if VideoDecoder is not supported (e.g. Safari < 16.4).
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
   *
   * @param mediaId  Unique media library ID
   * @param url      Blob URL or HTTP URL for the media file
   */
  async ensureLoaded(mediaId: string, url: string): Promise<void> {
    if (!this.isAvailable) return;

    let entry = this.decoders.get(mediaId);
    if (entry) {
      // Already loaded or loading
      if (entry.loadPromise) await entry.loadPromise;
      return;
    }

    // Evict oldest decoder if at capacity
    if (this.decoders.size >= MAX_DECODERS) {
      this.evictOldestDecoder();
    }

    entry = {
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
      refCount: 0,
      lastRequestedTime: -1,
      decodeTail: Promise.resolve(),
      blobSource: null,
    };

    const loadPromise = this.loadDecoder(entry);
    entry.loadPromise = loadPromise;
    this.decoders.set(mediaId, entry);

    await loadPromise;
  }

  /**
   * Get a decoded video frame at the given timestamp.
   *
   * Returns immediately from cache if available, otherwise decodes on demand.
   * The returned object includes the drawable source and its native dimensions.
   *
   * @param mediaId          Media library ID
   * @param url              Blob URL (used for lazy-load if not yet loaded)
   * @param timestampSeconds Source-time in seconds (after trimStart + speed adjustment)
   * @returns                Decoded frame, or null if decoder unavailable/errored
   */
  async getFrame(
    mediaId: string,
    url: string,
    timestampSeconds: number
  ): Promise<CachedFrame | null> {
    if (!this.isAvailable) return null;

    // Lazy-load the decoder if not yet loaded
    let entry = this.decoders.get(mediaId);
    if (!entry) {
      await this.ensureLoaded(mediaId, url);
      entry = this.decoders.get(mediaId);
    }
    if (!entry || !entry.ready || entry.loadError) return null;

    // Check cache first
    const frameIndex = Math.round(timestampSeconds * CACHE_FPS);
    const cacheKey = `${mediaId}:${frameIndex}`;
    const cached = this.frameCache.get(cacheKey);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached;
    }

    // Decode on demand — serialize to avoid overlapping getCanvas() calls
    // which can confuse the internal WebCodecs state machine
    const decodePromise = entry.decodeTail.then(async () => {
      // Double-check cache (another frame request might have filled it)
      const recheck = this.frameCache.get(cacheKey);
      if (recheck) {
        recheck.lastUsed = performance.now();
        return recheck;
      }

      try {
        const wrapped = await entry!.videoSink!.getCanvas(timestampSeconds);
        if (!wrapped || !wrapped.canvas) return null;

        const frame: CachedFrame = {
          drawable: wrapped.canvas,
          width: (wrapped.canvas as any).width || entry!.width,
          height: (wrapped.canvas as any).height || entry!.height,
          lastUsed: performance.now(),
        };

        this.cacheFrame(cacheKey, frame);
        return frame;
      } catch (err: any) {
        console.warn(`[PreviewDecoder] decode error for ${mediaId} at ${timestampSeconds}s:`, err?.message || err);
        return null;
      }
    });

    entry.decodeTail = decodePromise.then(() => undefined, () => undefined);
    return decodePromise;
  }

  /**
   * Synchronous cache-only lookup. Returns the frame if it's already
   * decoded and in the LRU cache, null otherwise. Used by the fast
   * rendering path to avoid async overhead when frames are pre-decoded.
   */
  getFrameSync(mediaId: string, timestampSeconds: number): CachedFrame | null {
    const frameIndex = Math.round(timestampSeconds * CACHE_FPS);
    const cacheKey = `${mediaId}:${frameIndex}`;
    const cached = this.frameCache.get(cacheKey);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached;
    }
    return null;
  }

  /**
   * Pre-decode frames for a batch of active clips. Called once per tick,
   * before renderCanvasEngine, so all frames are cache-hot for synchronous
   * lookup during the render pass.
   *
   * @param requests Array of { mediaId, url, timestampSeconds }
   * @returns Map of mediaId:frameIndex → CachedFrame
   */
  async preDecodeFrames(
    requests: Array<{ mediaId: string; url: string; timestampSeconds: number }>
  ): Promise<Map<string, CachedFrame>> {
    const results = new Map<string, CachedFrame>();
    if (!this.isAvailable || requests.length === 0) return results;

    // Fire all decodes in parallel
    const promises = requests.map(async (req) => {
      const frame = await this.getFrame(req.mediaId, req.url, req.timestampSeconds);
      if (frame) {
        const frameIndex = Math.round(req.timestampSeconds * CACHE_FPS);
        results.set(`${req.mediaId}:${frameIndex}`, frame);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Check if a decoder is loaded and ready for the given media file.
   */
  isReady(mediaId: string): boolean {
    const entry = this.decoders.get(mediaId);
    return !!entry?.ready && !entry.loadError;
  }

  /**
   * Get the native video dimensions for a loaded media file.
   */
  getDimensions(mediaId: string): { width: number; height: number } | null {
    const entry = this.decoders.get(mediaId);
    if (!entry?.ready) return null;
    return { width: entry.width, height: entry.height };
  }

  /**
   * Increment reference count (a clip is actively using this decoder).
   */
  addRef(mediaId: string): void {
    const entry = this.decoders.get(mediaId);
    if (entry) entry.refCount++;
  }

  /**
   * Decrement reference count. When it hits 0 and we're at capacity,
   * the decoder becomes eligible for eviction.
   */
  releaseRef(mediaId: string): void {
    const entry = this.decoders.get(mediaId);
    if (entry && entry.refCount > 0) entry.refCount--;
  }

  /**
   * Dispose a specific decoder and clear its cached frames.
   */
  disposeDecoder(mediaId: string): void {
    const entry = this.decoders.get(mediaId);
    if (!entry) return;

    this.cleanupEntry(entry);
    this.decoders.delete(mediaId);

    // Clear cached frames for this media
    const keysToDelete: string[] = [];
    for (const key of this.frameCache.keys()) {
      if (key.startsWith(mediaId + ':')) keysToDelete.push(key);
    }
    for (const key of keysToDelete) {
      this.frameCache.delete(key);
    }
    this.frameCacheOrder = this.frameCacheOrder.filter(
      (k) => !k.startsWith(mediaId + ':')
    );
  }

  /**
   * Dispose all decoders and clear the entire frame cache.
   * Called on project close or major state reset.
   */
  disposeAll(): void {
    for (const entry of this.decoders.values()) {
      this.cleanupEntry(entry);
    }
    this.decoders.clear();
    this.frameCache.clear();
    this.frameCacheOrder = [];
  }

  /**
   * Clear the frame cache without disposing decoders.
   * Useful when scrubbing rapidly and cache is stale.
   */
  clearCache(): void {
    this.frameCache.clear();
    this.frameCacheOrder = [];
  }

  /**
   * Get diagnostic info for the playback diagnostics panel.
   */
  getDiagnostics(): {
    decoderCount: number;
    cachedFrames: number;
    decoders: Array<{ mediaId: string; ready: boolean; error: string | null; refCount: number; codec: string | null }>;
  } {
    const decoderInfo: Array<{ mediaId: string; ready: boolean; error: string | null; refCount: number; codec: string | null }> = [];
    for (const [id, entry] of this.decoders) {
      decoderInfo.push({
        mediaId: id,
        ready: entry.ready,
        error: entry.loadError,
        refCount: entry.refCount,
        codec: entry.codec,
      });
    }
    return {
      decoderCount: this.decoders.size,
      cachedFrames: this.frameCache.size,
      decoders: decoderInfo,
    };
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async loadDecoder(entry: DecoderEntry): Promise<void> {
    try {
      // Fetch the media blob
      const response = await fetch(entry.url);
      if (!response.ok) {
        entry.loadError = `Fetch failed (${response.status})`;
        return;
      }
      const blob = await response.blob();

      entry.blobSource = new BlobSource(blob);
      entry.input = new Input({ source: entry.blobSource, formats: ALL_FORMATS });

      // Get the primary video track
      const videoTrack = await entry.input.getPrimaryVideoTrack();
      if (!videoTrack) {
        entry.loadError = 'No video track found';
        this.cleanupEntry(entry);
        return;
      }

      // Check codec support
      let canDecode = true;
      try {
        canDecode = await videoTrack.canDecode();
      } catch {
        // If canDecode throws, assume support and let actual decode fail
        canDecode = true;
      }
      if (!canDecode) {
        entry.loadError = 'Codec not supported by browser WebCodecs';
        this.cleanupEntry(entry);
        return;
      }

      // Get codec info
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

      // Create the CanvasSink for frame-on-demand decoding
      // Use software decoding to avoid exhausting hardware decoder sessions
      // (the export engine may also be running hardware decoders)
      const decoderMode = entry.codec === 'hevc' ? 'prefer-hardware' : 'prefer-software';
      entry.videoSink = new CanvasSink(videoTrack, {
        decoderOptions: {
          hardwareAcceleration: decoderMode as HardwarePreference,
          optimizeForLatency: true,
        },
        poolSize: 4, // Small pool for preview (4 reusable canvases)
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

  private cacheFrame(key: string, frame: CachedFrame): void {
    // Evict oldest if at capacity
    while (this.frameCache.size >= MAX_CACHED_FRAMES && this.frameCacheOrder.length > 0) {
      const oldestKey = this.frameCacheOrder.shift()!;
      this.frameCache.delete(oldestKey);
    }

    this.frameCache.set(key, frame);
    this.frameCacheOrder.push(key);
  }

  private evictOldestDecoder(): void {
    // Find the decoder with refCount === 0 and lowest lastRequestedTime
    let evictId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.decoders) {
      if (entry.refCount === 0 && entry.lastRequestedTime < oldestTime) {
        oldestTime = entry.lastRequestedTime;
        evictId = id;
      }
    }

    // If all have refs, evict the one with lowest refCount
    if (!evictId) {
      let lowestRef = Infinity;
      for (const [id, entry] of this.decoders) {
        if (entry.refCount < lowestRef) {
          lowestRef = entry.refCount;
          evictId = id;
        }
      }
    }

    if (evictId) {
      console.log(`[PreviewDecoder] Evicting decoder: ${evictId}`);
      this.disposeDecoder(evictId);
    }
  }

  private cleanupEntry(entry: DecoderEntry): void {
    entry.ready = false;

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

/** Global preview decoder instance — import this in any module that needs frames */
export const previewDecoder = new PreviewDecoderManager();

export type { CachedFrame };
