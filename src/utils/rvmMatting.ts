/**
 * rvmMatting.ts — Robust Video Matting (RVM) Engine — CapCut-class AI cutout.
 *
 * WHY RVM:
 *   Robust Video Matting was created by ByteDance (CapCut's parent company) for
 *   exactly this use case. Unlike per-frame image segmenters (MediaPipe selfie
 *   segmenter, IS-Net), RVM is a RECURRENT neural network: its memory inputs
 *   (r1i–r4i) carry temporal context across frames. This gives:
 *     • Hair-level alpha matte quality (no more blocky selfie-segmenter edges)
 *     • Zero flicker/ghosting — model-native temporal coherence, not EMA hacks
 *     • Robustness to motion blur, fast movement and lighting changes
 *
 * RUNTIME:
 *   onnxruntime-web (already a project dependency). WebGPU execution provider
 *   when available; otherwise WASM — forced into ONNX Runtime's internal proxy
 *   worker by aiBackground.ts so heavy inference never blocks the main thread.
 *
 * MODEL I/O (fp16, ~7.5 MB, all inputs float16):
 *   src [1,3,H,W], r1i–r4i (float16, zeros on first frame), downsample_ratio [1]
 *   → fgr [1,3,H,W], pha [1,1,H,W], r1o–r4o (fed back into the next frame)
 *
 * ── FIXED: the float16 container bug that silently killed this engine ────────
 *
 * ONNX Runtime Web picks the JS container for `float16` tensors at RUNTIME
 * (see onnxruntime-common/tensor-impl-type-mapping.js):
 *
 *     Float16Array available  → tensors hold REAL VALUES in a Float16Array
 *     Float16Array missing    → tensors hold RAW HALF BITS in a Uint16Array
 *
 * The previous implementation did both at once — it wrote `toHalf(x)` (a raw
 * bit pattern, e.g. 15360 for 1.0) into a native `Float16Array`, which stores
 * the NUMBER 15360. Every pixel handed to the network was garbage, `pha` came
 * back as noise, coverage measured ~0 and the caller concluded "no subject",
 * falling through to the 256×144 MediaPipe matte on every single frame. And on
 * engines without native Float16Array (Safari, Firefox) `isRVMSupported()`
 * returned false, so RVM never even loaded — even though ORT fully supports
 * the Uint16Array path.
 *
 * We now probe the container once and encode/decode to match it.
 */

import * as ortModule from 'onnxruntime-web';

// Ambient declaration: Float16Array ships in newer engines (Chrome 135+,
// Node 24+) but TS 5.9's standard libs don't include it yet.
declare const Float16Array: any;
/** Either a native Float16Array (real values) or a Uint16Array (raw half bits). */
type HalfArray = any;

// Primary + mirrors. A single dead host must not take the whole feature down.
const RVM_MODEL_URLS = [
  'https://huggingface.co/inverseaibd/rvm_mobilenetv3_fp16/resolve/main/rvm_mobilenetv3_fp16.onnx',
  'https://huggingface.co/onnx-community/rvm_mobilenetv3/resolve/main/onnx/rvm_mobilenetv3_fp16.onnx',
];

// Exact installed version so the ORT JS glue and wasm binary always match ABI.
const RVM_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0-dev.20250206-d981b153d3/dist/';

// Mean-alpha below this is treated as "no subject in frame".
export const RVM_EMPTY_COVERAGE = 0.0008;

/**
 * RVM's encoder is designed to run at roughly this resolution; the model's Deep
 * Guided Filter then refines the matte back up to the full input size. The old
 * code hard-coded `downsample_ratio = 0.375` against an input that had ALREADY
 * been scaled down to 512 px, so the encoder only ever saw 192 px — which is
 * precisely the coarse, wobbling edge this pipeline was reported for.
 */
const RVM_ENCODER_TARGET_PX = 272;

// ── float16 container detection ──────────────────────────────────────────────

/** True when ORT will hand us (and expect) a native Float16Array of real values. */
const NATIVE_F16: boolean =
  typeof Float16Array !== 'undefined' && typeof Float16Array.from === 'function';

const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

function toHalf(val: number): number {
  _f32[0] = val;
  const x = _u32[0];
  const bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) return bits | 0x7c00;
  if (e < 113) {
    m |= 0x0800;
    return bits + ((m >> (114 - e)) + ((m >> (113 - e)) & 1));
  }
  return (bits | ((e - 112) << 10) | (m >> 1)) + (m & 1);
}

function halfToFloat(h: number): number {
  const e = (h & 0x7c00) >> 10;
  const m = h & 0x03ff;
  let f: number;
  if (e === 0) f = m * 2 ** -24;
  else if (e !== 31) f = (m + 1024) * 2 ** (e - 25);
  else f = m === 0 ? Infinity : NaN;
  return h & 0x8000 ? -f : f;
}

/** Allocate the zero-filled container ORT expects for a float16 tensor. */
function allocHalf(length: number): HalfArray {
  return NATIVE_F16 ? new Float16Array(length) : new Uint16Array(length);
}

/** Read element `i` of a float16 container back as a normal JS number. */
function readHalf(arr: HalfArray, i: number): number {
  return NATIVE_F16 ? arr[i] : halfToFloat(arr[i]);
}

// ── Session management ───────────────────────────────────────────────────────

/**
 * RVM works on every engine that can run onnxruntime-web. Native Float16Array
 * is an optimisation, never a requirement — ORT falls back to Uint16Array.
 */
export function isRVMSupported(): boolean {
  return typeof window !== 'undefined' || typeof self !== 'undefined';
}

let rvmSessionPromise: Promise<any | null> | null = null;

async function fetchModelBuffer(): Promise<Uint8Array> {
  let lastErr: unknown = null;
  for (const url of RVM_MODEL_URLS) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return new Uint8Array(await resp.arrayBuffer());
    } catch (err) {
      lastErr = err;
      console.warn(`[rvmMatting] Model source unavailable (${url}):`, err);
    }
  }
  throw lastErr ?? new Error('RVM model download failed');
}

export function loadRVMSession(): Promise<any | null> {
  if (!isRVMSupported()) return Promise.resolve(null);
  if (rvmSessionPromise) return rvmSessionPromise;
  rvmSessionPromise = (async () => {
    try {
      const ort: any = (ortModule as any).default || ortModule;
      try { ort.env.wasm.wasmPaths = RVM_WASM_CDN; } catch { /* already initialized */ }

      const modelBuf = await fetchModelBuffer();

      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      try {
        return await ort.InferenceSession.create(modelBuf, {
          executionProviders: hasWebGPU ? ['webgpu', 'wasm'] : ['wasm'],
          graphOptimizationLevel: 'all',
        });
      } catch (epErr) {
        console.warn('[rvmMatting] WebGPU session failed, retrying with pure WASM:', epErr);
        return await ort.InferenceSession.create(modelBuf, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      }
    } catch (err) {
      console.warn('[rvmMatting] RVM load failed, will fall back to MediaPipe/IS-Net:', err);
      rvmSessionPromise = null; // Allow retry
      return null;
    }
  })();
  return rvmSessionPromise;
}

// ── Per-clip recurrent state ─────────────────────────────────────────────────

interface RVMStateTensor {
  data: HalfArray;
  dims: readonly number[];
}

interface RVMClipState {
  states: RVMStateTensor[] | null;
  lastVideoTime: number;
  infW: number;
  infH: number;
}

const rvmClipStates = new Map<string, RVMClipState>();
const MAX_RVM_STATES = 30;

function getRVMClipState(clipId: string): RVMClipState {
  let state = rvmClipStates.get(clipId);
  if (!state) {
    state = { states: null, lastVideoTime: -1, infW: 0, infH: 0 };
    rvmClipStates.set(clipId, state);
    if (rvmClipStates.size > MAX_RVM_STATES) {
      const firstKey = rvmClipStates.keys().next().value;
      if (firstKey) rvmClipStates.delete(firstKey);
    }
  }
  return state;
}

export function resetRVMState(clipId: string): void {
  rvmClipStates.delete(clipId);
}

export function resetAllRVMStates(): void {
  rvmClipStates.clear();
}

// ── Inference canvas (module-local to avoid circular imports) ────────────────

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const srcCanvasCache = new Map<string, AnyCanvas>();

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function getSrcCanvas(key: string, w: number, h: number): AnyCanvas {
  let c = srcCanvasCache.get(key);
  if (!c) {
    c = makeCanvas(w, h);
    srcCanvasCache.set(key, c);
    if (srcCanvasCache.size > 8) {
      const firstKey = srcCanvasCache.keys().next().value;
      if (firstKey) srcCanvasCache.delete(firstKey);
    }
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

// ── Segmentation ─────────────────────────────────────────────────────────────

export interface RVMSegmentResult {
  bitmap: ImageBitmap;
  coverage: number;
  width: number;
  height: number;
}

/**
 * Canonical inference tiers. Different call sites used to pass 384/512/768 for
 * the same clip, which changed infW/infH and forced a recurrent-state reset on
 * every alternating call — silently defeating RVM's temporal coherence.
 */
export function canonicalMaxDim(maxDim: number): 512 | 768 | 1024 {
  if (maxDim <= 640) return 512;
  if (maxDim <= 896) return 768;
  return 1024;
}

/** Keep the encoder near its designed working resolution regardless of input size. */
export function downsampleRatioFor(longestSide: number): number {
  const r = RVM_ENCODER_TARGET_PX / Math.max(1, longestSide);
  return Math.min(1, Math.max(0.25, Math.round(r * 1000) / 1000));
}

async function tensorHalfArray(t: any): Promise<HalfArray> {
  // ORT returns the correctly-typed container for both CPU and GPU tensors.
  if (t.location === 'gpu-buffer' || t.location === 'ml-tensor') {
    return await t.getData();
  }
  return t.data as HalfArray;
}

/**
 * Per-clip serialization queue. The recurrent state (read → await session.run →
 * write) is NOT atomic: two concurrent calls for the same clip interleave and
 * corrupt the temporal memory. Chaining calls per clipId guarantees the state
 * is always consistent; the queue depth stays ≤1 because callers throttle.
 */
const rvmInFlight = new Map<string, Promise<any>>();

/**
 * Run RVM matting on a video/canvas/image element.
 *
 * The recurrent memory is what makes this CapCut-grade: states persist per
 * clip across frames, so alpha is temporally coherent with zero flicker.
 * States auto-reset on seeks, backward time or resolution changes.
 *
 * @param videoTime Clip-local time in seconds (used for state-jump detection)
 */
export async function segmentWithRVM(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  clipId: string,
  videoTime: number,
  maxDim: number = 512
): Promise<RVMSegmentResult | null> {
  const tier = canonicalMaxDim(maxDim);

  const prev = rvmInFlight.get(clipId) || Promise.resolve();
  const run = prev.then(() => segmentWithRVMInner(source, clipId, videoTime, tier));
  // Store a never-rejecting handle so one failure doesn't poison the chain.
  const stored = run.catch(() => null);
  rvmInFlight.set(clipId, stored);
  try {
    return await run;
  } finally {
    if (rvmInFlight.get(clipId) === stored) rvmInFlight.delete(clipId);
  }
}

async function segmentWithRVMInner(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  clipId: string,
  videoTime: number,
  maxDim: number
): Promise<RVMSegmentResult | null> {
  const session = await loadRVMSession();
  if (!session) return null;

  try {
    let sw: number, sh: number;
    if ('videoWidth' in source && (source as HTMLVideoElement).videoWidth) {
      sw = (source as HTMLVideoElement).videoWidth;
      sh = (source as HTMLVideoElement).videoHeight;
    } else if ('naturalWidth' in source && (source as HTMLImageElement).naturalWidth) {
      sw = (source as HTMLImageElement).naturalWidth;
      sh = (source as HTMLImageElement).naturalHeight;
    } else if ('width' in source && typeof (source as any).width === 'number') {
      sw = (source as any).width;
      sh = (source as any).height;
    } else {
      return null;
    }
    if (!(sw > 0) || !(sh > 0)) return null;

    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const infW = Math.max(32, Math.round((sw * scale) / 2) * 2);
    const infH = Math.max(32, Math.round((sh * scale) / 2) * 2);

    const canvas = getSrcCanvas(`_rvm_src_${infW}x${infH}`, infW, infH);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, infW, infH);
    ctx.drawImage(source as CanvasImageSource, 0, 0, infW, infH);
    const img = ctx.getImageData(0, 0, infW, infH).data;

    const ort: any = (ortModule as any).default || ortModule;

    // RGBA → planar RGB normalised → float16 src tensor.
    // Encode straight into the container ORT expects: real values for a native
    // Float16Array, raw half bits for the Uint16Array fallback.
    const npix = infW * infH;
    const srcHalf = allocHalf(3 * npix);
    const INV255 = 1 / 255;
    if (NATIVE_F16) {
      for (let p = 0, i = 0; p < npix; p++, i += 4) {
        srcHalf[p] = img[i] * INV255;
        srcHalf[npix + p] = img[i + 1] * INV255;
        srcHalf[2 * npix + p] = img[i + 2] * INV255;
      }
    } else {
      for (let p = 0, i = 0; p < npix; p++, i += 4) {
        srcHalf[p] = toHalf(img[i] * INV255);
        srcHalf[npix + p] = toHalf(img[i + 1] * INV255);
        srcHalf[2 * npix + p] = toHalf(img[i + 2] * INV255);
      }
    }
    const srcTensor = new ort.Tensor('float16', srcHalf, [1, 3, infH, infW]);

    // Downsample ratio is a pure function of the canonical tier, so the
    // recurrent state stays compatible across calls from different pipelines.
    const ratio = downsampleRatioFor(Math.max(infW, infH));
    const dRatio = new ort.Tensor('float32', new Float32Array([ratio]), [1]);

    // State validation: reset on seek, backward time or resolution change
    const state = getRVMClipState(clipId);
    const isJump =
      !state.states ||
      state.infW !== infW ||
      state.infH !== infH ||
      videoTime < 0 ||
      Math.abs(videoTime - state.lastVideoTime) > 0.5;

    const feeds: Record<string, any> = { src: srcTensor, downsample_ratio: dRatio };
    if (isJump) {
      for (let k = 1; k <= 4; k++) {
        feeds[`r${k}i`] = new ort.Tensor('float16', allocHalf(1), [1, 1, 1, 1]);
      }
    } else {
      for (let k = 0; k < 4; k++) {
        const s = state.states![k];
        feeds[`r${k + 1}i`] = new ort.Tensor('float16', s.data, s.dims);
      }
    }

    const out = await session.run(feeds);

    // Persist new recurrent states (copy — output memory may be reused)
    const newStates: RVMStateTensor[] = [];
    for (let k = 1; k <= 4; k++) {
      const t = out[`r${k}o`];
      const data = await tensorHalfArray(t);
      newStates.push({ data: data.slice(), dims: t.dims });
    }
    state.states = newStates;
    state.lastVideoTime = videoTime;
    state.infW = infW;
    state.infH = infH;

    // pha [1,1,H,W] float16 → white-RGB + alpha ImageBitmap
    const pha = out['pha'];
    const phaHalf = await tensorHalfArray(pha);
    const pw = pha.dims[3];
    const ph = pha.dims[2];
    const maskData = new ImageData(pw, ph);
    const data32 = new Uint32Array(maskData.data.buffer);
    let sum = 0;
    const count = Math.min(phaHalf.length, pw * ph);
    for (let i = 0; i < count; i++) {
      const a = readHalf(phaHalf, i);
      const clamped = a <= 0 ? 0 : a >= 1 ? 1 : a;
      sum += clamped;
      // Little-endian RGBA: 0xAABBGGRR, white RGB so the matte scales cleanly.
      data32[i] = (((clamped * 255 + 0.5) | 0) << 24) | 0x00ffffff;
    }
    const coverage = count > 0 ? sum / count : 0;
    const bitmap = await createImageBitmap(maskData);
    return { bitmap, coverage, width: pw, height: ph };
  } catch (err) {
    console.warn('[rvmMatting] RVM segmentation error:', err);
    resetRVMState(clipId);
    return null;
  }
}
