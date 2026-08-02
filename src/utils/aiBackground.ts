/**
 * aiBackground.ts
 *
 * AI background removal using @imgly/background-removal with forced ONNX WASM proxy.
 *
 * ── ROOT CAUSE OF PLAYHEAD HANG (NOW FIXED) ──────────────────────────────────
 *
 * @imgly/background-removal line 1008:
 *   `const proxyToWorker = useWebGPU && config.proxyToWorker;`
 *
 * The library ONLY enables its ONNX proxy worker when WebGPU is available.
 * On the vast majority of systems (no WebGPU), the entire IS-Net neural network
 * (500ms–3000ms of WASM execution) runs synchronously on the main thread,
 * monopolizing the CPU and freezing the RAF render loop, playhead, and UI.
 *
 * FIX: We use Object.defineProperty to force `ort.env.wasm.proxy = true` so the
 * library's attempt to set it to `false` is silently ignored. This makes ONNX
 * Runtime Web create its own internal proxy worker for WASM execution, moving
 * the heavy neural network computation off the main thread automatically.
 *
 * The remaining main-thread work (image resize, tensor prep, pixel loop at 384px)
 * takes < 10ms total, well within a single frame budget.
 */

import * as ortModule from 'onnxruntime-web';

// ── CRITICAL FIX: Force ONNX WASM proxy ON ──────────────────────────────────
// This intercepts the library's `ort.env.wasm.proxy = false` assignment and
// keeps it pinned to `true`, so ONNX runs inference in its internal Web Worker
// regardless of WebGPU availability.
if (typeof window !== 'undefined') {
  const ortObj: any = (ortModule as any).default || ortModule;

  // Ensure the module's default export points to itself (ESM interop)
  if (ortObj && !ortObj.default) {
    try { ortObj.default = ortObj; } catch (_e) { /* frozen object */ }
  }
  (window as any).ort = ortObj;

  // Force ort.env.wasm.proxy = true — make it read-only so the library can't
  // override it to false when WebGPU is unavailable.
  try {
    if (ortObj?.env?.wasm) {
      Object.defineProperty(ortObj.env.wasm, 'proxy', {
        get: () => true,
        set: () => {}, // Silently ignore @imgly's `ort.env.wasm.proxy = false`
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_e) {
    console.warn('[aiBackground] Could not force ONNX WASM proxy — playback may lag during AI background removal');
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SimpleMaskCache {
  maskCanvas: HTMLCanvasElement;
  lastUpdateTimestamp: number;
  lastVideoTime: number;
}

// ── State ────────────────────────────────────────────────────────────────────

const maskCacheMap = new Map<string, SimpleMaskCache>();
const segmentingInFlight = new Set<string>();

// Redraw callback: when an async mask arrives, signal the RAF loop to repaint.
let _onMaskReadyCallback: (() => void) | null = null;
export function setOnMaskReadyCallback(cb: (() => void) | null): void {
  _onMaskReadyCallback = cb;
}
function notifyMaskReady(): void {
  if (_onMaskReadyCallback) _onMaskReadyCallback();
}

// ── Canvas Pool ──────────────────────────────────────────────────────────────
// Pre-allocated canvases to avoid GC pressure from repeated createElement calls.

const canvasPool = new Map<string, HTMLCanvasElement>();

function getPooledCanvas(key: string, w: number, h: number): HTMLCanvasElement {
  let c = canvasPool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    canvasPool.set(key, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

// ── Module Loading ───────────────────────────────────────────────────────────

let bgRemovalModule: typeof import('@imgly/background-removal') | null = null;
let loadPromise: Promise<void> | null = null;
let isLoaded = false;

const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

/**
 * Preload the @imgly/background-removal model. Safe to call multiple times.
 */
export const loadBackgroundRemover = (): Promise<void> => {
  if (isLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      bgRemovalModule = await import('@imgly/background-removal');
      const preloadFn = bgRemovalModule.preload ?? (bgRemovalModule as any).default?.preload;
      if (preloadFn) {
        await preloadFn({
          model: 'isnet_fp16',
          publicPath: PUBLIC_PATH,
          proxyToWorker: true, // Library ignores this without WebGPU, but our
                               // Object.defineProperty override forces it anyway
        });
      }
      isLoaded = true;
    } catch (err) {
      console.error('[aiBackground] Failed to load @imgly/background-removal:', err);
      loadPromise = null; // Allow retry
      throw err;
    }
  })();
  return loadPromise;
};

// ── Segmentation ─────────────────────────────────────────────────────────────

/**
 * Run inference on a Blob. The caller is responsible for capturing the snapshot
 * and converting it to a Blob BEFORE calling this function. This ensures the
 * snapshot is frozen (Blobs are immutable) and immune to canvas overwrite races.
 *
 * With the forced ONNX proxy, the heavy WASM inference runs in ONNX Runtime's
 * internal Web Worker. Main-thread cost: ~5-10ms (image resize + pixel loop).
 */
async function segmentBlob(
  inputBlob: Blob,
  inferW: number,
  inferH: number,
  model: 'isnet' | 'isnet_fp16' = 'isnet_fp16'
): Promise<HTMLCanvasElement | null> {
  if (!bgRemovalModule) {
    await loadBackgroundRemover();
  }
  if (!bgRemovalModule || !isLoaded) return null;

  try {
    const removeBgFn = bgRemovalModule.removeBackground ?? (bgRemovalModule as any).default?.removeBackground;
    if (!removeBgFn) throw new Error('@imgly/background-removal: removeBackground function not found');

    // Run inference — with our proxy override, ONNX WASM runs in a background worker
    const resultBlob = await removeBgFn(inputBlob, {
      model,
      publicPath: PUBLIC_PATH,
      proxyToWorker: true,
      output: { format: 'image/png', quality: 0.9 },
    });

    const bitmap = await createImageBitmap(resultBlob);
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = inferW;
    resultCanvas.height = inferH;
    const ctx = resultCanvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.clearRect(0, 0, inferW, inferH);
    ctx.drawImage(bitmap, 0, 0, inferW, inferH);
    bitmap.close();
    return resultCanvas;
  } catch (err) {
    console.error('[aiBackground] segmentBlob error:', err);
    return null;
  }
}

/**
 * Capture a snapshot from a source element, downscale to max 384px, and
 * immediately freeze it into a Blob. The Blob is immutable — no race condition
 * with pooled canvas overwrites.
 */
function captureSnapshotBlob(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number
): Promise<{ blob: Blob; w: number; h: number } | null> {
  const maxDim = 384;
  const scale = Math.min(1, maxDim / Math.max(targetWidth, targetHeight));
  const inferW = Math.max(64, Math.round(targetWidth * scale));
  const inferH = Math.max(64, Math.round(targetHeight * scale));

  const snapCanvas = getPooledCanvas('_snap_capture', inferW, inferH);
  const snapCtx = snapCanvas.getContext('2d');
  if (!snapCtx) return Promise.resolve(null);
  snapCtx.clearRect(0, 0, inferW, inferH);
  snapCtx.drawImage(source, 0, 0, inferW, inferH);

  // Freeze the snapshot into an immutable Blob immediately.
  // toBlob is async but fires synchronously from the current canvas state.
  return new Promise<{ blob: Blob; w: number; h: number } | null>((resolve) => {
    snapCanvas.toBlob((blob) => {
      if (blob) {
        resolve({ blob, w: inferW, h: inferH });
      } else {
        // Fallback to PNG if JPEG fails
        snapCanvas.toBlob((pngBlob) => {
          resolve(pngBlob ? { blob: pngBlob, w: inferW, h: inferH } : null);
        }, 'image/png');
      }
    }, 'image/jpeg', 0.85);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getVideoCurrentTime(sourceElement: any): number {
  if (sourceElement && typeof sourceElement.currentTime === 'number') {
    return sourceElement.currentTime;
  }
  return -1;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply AI background removal to a canvas context.
 *
 * Interactive (isPlaying=true): Fire-and-forget async segmentation with throttling.
 *   The render loop never waits for inference — it composites the cached mask
 *   and moves on. When a fresh mask arrives, notifyMaskReady() triggers a repaint.
 *   CRITICAL: The LAST cached mask is ALWAYS composited even while a new one
 *   is being computed, so the background removal effect never "disappears".
 *
 * Export (isPlaying=false): Awaits segmentation for frame-accurate masks.
 */
export async function applyAiBackgroundMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  edgeBlur: number = 0,
  modelSelection: 0 | 1 = 0,
  playbackQuality: 'full' | 'balanced' | 'performance' = 'balanced',
  isPlaying: boolean = false,
  clipId: string = '_default'
): Promise<void> {
  try {
    const currentVideoTime = getVideoCurrentTime(sourceElement);
    const cached = maskCacheMap.get(clipId);
    let maskCanvas = cached ? cached.maskCanvas : null;

    const updateIntervalMs = playbackQuality === 'performance' ? 700
                           : playbackQuality === 'full' ? 250
                           : 450;

    if (isPlaying) {
      // ── INTERACTIVE: non-blocking fire-and-forget ──
      // Always composite the LAST cached mask (even stale). Only fire a new
      // segmentation request if enough time has elapsed AND no request is in flight.
      const elapsed = performance.now() - (cached?.lastUpdateTimestamp || 0);
      const shouldRefresh = !maskCanvas || elapsed > updateIntervalMs;

      if (shouldRefresh && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);

        // Capture snapshot and freeze to Blob immediately (< 2ms at 384px).
        // The Blob is immutable — immune to pooled canvas overwrite races.
        captureSnapshotBlob(sourceElement, width, height)
          .then((snap) => {
            if (!snap) {
              segmentingInFlight.delete(clipId);
              return;
            }
            // Run segmentation in background (ONNX proxy worker handles the heavy work)
            return segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16')
              .then((result) => {
                if (result) {
                  maskCacheMap.set(clipId, {
                    maskCanvas: result,
                    lastUpdateTimestamp: performance.now(),
                    lastVideoTime: getVideoCurrentTime(sourceElement),
                  });
                  // Signal the render loop to repaint with the new mask
                  notifyMaskReady();
                }
              });
          })
          .catch((err) => {
            console.warn('[aiBackground] Playback segmentation error:', err);
          })
          .finally(() => {
            segmentingInFlight.delete(clipId);
          });
      }
      // Fall through — composite whatever cached mask we have.
      // If no mask yet (first frame), maskCanvas is null and we skip compositing
      // (the video shows unmasked until the first mask arrives — typically 1-3s).

    } else {
      // ── EXPORT / PAUSED: await for frame-accurate mask ──
      const timeMoved = currentVideoTime >= 0 &&
        Math.abs(currentVideoTime - (cached?.lastVideoTime ?? -1)) > 0.04;

      if (!maskCanvas || timeMoved) {
        const model = modelSelection === 0 ? 'isnet' : 'isnet_fp16';
        const snap = await captureSnapshotBlob(sourceElement, width, height);
        if (snap) {
          const result = await segmentBlob(snap.blob, snap.w, snap.h, model);
          if (result) {
            maskCanvas = result;
            maskCacheMap.set(clipId, {
              maskCanvas: result,
              lastUpdateTimestamp: performance.now(),
              lastVideoTime: currentVideoTime,
            });
          }
        }
      }
    }

    // ── Composite mask (GPU-accelerated drawImage, < 0.1ms) ──
    if (!maskCanvas) return;

    if (edgeBlur > 0) {
      const blurredCanvas = getPooledCanvas(`${clipId}_blur`, width, height);
      const bCtx = blurredCanvas.getContext('2d');
      if (bCtx) {
        bCtx.clearRect(0, 0, width, height);
        bCtx.filter = `blur(${edgeBlur}px)`;
        bCtx.drawImage(maskCanvas, 0, 0, width, height);
        bCtx.filter = 'none';
      }
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(blurredCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
  } catch (err) {
    console.error('[aiBackground] applyAiBackgroundMask error:', err);
  }
}

/**
 * Subject neon outline flash effect using AI segmentation mask.
 */
export async function applySubjectNeonOutlineFlash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceElement: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap,
  options: {
    color?: string;
    strokeWidth?: number;
    glowBlur?: number;
    flashSpeed?: number;
    currentTime?: number;
    clipId?: string;
    isPlaying?: boolean;
  } = {}
): Promise<void> {
  try {
    const clipId = options.clipId || '_neon_default';
    const isPlaying = options.isPlaying || false;
    const currentVideoTime = getVideoCurrentTime(sourceElement);

    const cached = maskCacheMap.get(clipId);
    let maskCanvas = cached ? cached.maskCanvas : null;

    if (isPlaying) {
      const shouldRefresh = !maskCanvas ||
        (performance.now() - (cached?.lastUpdateTimestamp || 0) > 450);
      if (shouldRefresh && !segmentingInFlight.has(clipId)) {
        segmentingInFlight.add(clipId);

        captureSnapshotBlob(sourceElement, width, height)
          .then((snap) => {
            if (!snap) {
              segmentingInFlight.delete(clipId);
              return;
            }
            return segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16')
              .then((result) => {
                if (result) {
                  maskCacheMap.set(clipId, {
                    maskCanvas: result,
                    lastUpdateTimestamp: performance.now(),
                    lastVideoTime: getVideoCurrentTime(sourceElement),
                  });
                  notifyMaskReady();
                }
              });
          })
          .catch(() => {})
          .finally(() => { segmentingInFlight.delete(clipId); });
      }
    } else {
      const timeMoved = currentVideoTime >= 0 &&
        Math.abs(currentVideoTime - (cached?.lastVideoTime ?? -1)) > 0.04;
      if (!maskCanvas || timeMoved) {
        const snap = await captureSnapshotBlob(sourceElement, width, height);
        if (snap) {
          const result = await segmentBlob(snap.blob, snap.w, snap.h, 'isnet_fp16');
          if (result) {
            maskCanvas = result;
            maskCacheMap.set(clipId, {
              maskCanvas: result,
              lastUpdateTimestamp: performance.now(),
              lastVideoTime: currentVideoTime,
            });
          }
        }
      }
    }

    if (!maskCanvas) return;

    const edgeCanvas = getPooledCanvas(`${clipId}_edge`, width, height);
    const eCtx = edgeCanvas.getContext('2d');
    if (!eCtx) return;
    const strokeW = options.strokeWidth || 3;
    eCtx.clearRect(0, 0, width, height);
    eCtx.drawImage(maskCanvas, 0, 0, width, height);
    eCtx.globalCompositeOperation = 'difference';
    eCtx.drawImage(maskCanvas, strokeW, 0, width, height);
    eCtx.drawImage(maskCanvas, -strokeW, 0, width, height);
    eCtx.globalCompositeOperation = 'source-over';

    const time = options.currentTime || (performance.now() / 1000);
    const speed = options.flashSpeed || 8;
    const strobeWave = Math.sin(time * Math.PI * 2 * speed);
    if (strobeWave < -0.3) return;

    const alpha = Math.max(0.3, (strobeWave + 1) / 2);
    const outlineColor = options.color || '#00f0ff';
    eCtx.globalCompositeOperation = 'source-in';
    eCtx.fillStyle = outlineColor;
    eCtx.fillRect(0, 0, width, height);
    eCtx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = options.glowBlur || 14;
    ctx.shadowColor = outlineColor;
    ctx.drawImage(edgeCanvas, 0, 0, width, height);
    ctx.restore();
  } catch (err) {
    console.error('[aiBackground] applySubjectNeonOutlineFlash error:', err);
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanupAiBackgroundResources(): void {
  canvasPool.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
}

export function cleanupClipBackgroundState(clipId: string): void {
  for (const key of canvasPool.keys()) {
    if (key.startsWith(clipId)) canvasPool.delete(key);
  }
  maskCacheMap.delete(clipId);
  segmentingInFlight.delete(clipId);
}

export function cleanupAllBackgroundState(): void {
  canvasPool.clear();
  maskCacheMap.clear();
  segmentingInFlight.clear();
}

export const cleanupAllAIResources = cleanupAllBackgroundState;