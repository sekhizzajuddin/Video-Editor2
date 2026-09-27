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
 */

import * as ortModule from 'onnxruntime-web';

// Support both native Float16Array (modern browsers) and Uint16Array fallback
type F16 = any;

const RVM_LOCAL_MODEL_URL = '/models/rvm_mobilenetv3_fp16.onnx';
const RVM_REMOTE_MODEL_URL =
  'https://huggingface.co/inverseaibd/rvm_mobilenetv3_fp16/resolve/main/rvm_mobilenetv3_fp16.onnx';

const RVM_LOCAL_WASM_PATH = '/onnx/';
// Exact installed version so the ORT JS glue and wasm binary always match ABI.
const RVM_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0-dev.20250206-d981b153d3/dist/';

// Mean-alpha below this is treated as "no subject in frame".
export const RVM_EMPTY_COVERAGE = 0.0008;

// ── float16 helpers ──────────────────────────────────────────────────────────

const NativeFloat16Array: any = typeof window !== 'undefined' ? (window as any).Float16Array : typeof globalThis !== 'undefined' ? (globalThis as any).Float16Array : undefined;
const HasNativeFloat16 = typeof NativeFloat16Array !== 'undefined';

const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

function toHalf(val: number): number {
  _f32[0] = val;
  const x = _u32[0];
  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) return bits | 0x7c00;
  if (e < 113) {
    m |= 0x0800;
    return bits + ((m >> (114 - e)) + ((m >> (113 - e)) & 1));
  }
  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
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

function float32ToFloat16Bulk(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = toHalf(src[i]);
  return out;
}

function createFloat16Tensor(ort: any, dataF32: Float32Array, dims: number[]): any {
  if (HasNativeFloat16 && NativeFloat16Array) {
    return new ort.Tensor('float16', new NativeFloat16Array(dataF32), dims);
  }
  return new ort.Tensor('float16', float32ToFloat16Bulk(dataF32), dims);
}

function createZeroStateTensor(ort: any): any {
  if (HasNativeFloat16 && NativeFloat16Array) {
    return new ort.Tensor('float16', new NativeFloat16Array(1), [1, 1, 1, 1]);
  }
  return new ort.Tensor('float16', new Uint16Array(1), [1, 1, 1, 1]);
}

// ── Session management ───────────────────────────────────────────────────────

export function isRVMSupported(): boolean {
  return typeof window !== 'undefined';
}

let rvmSessionPromise: Promise<any | null> | null = null;

export function loadRVMSession(): Promise<any | null> {
  if (!isRVMSupported()) return Promise.resolve(null);
  if (rvmSessionPromise) return rvmSessionPromise;
  rvmSessionPromise = (async () => {
    try {
      const ort: any = (ortModule as any).default || ortModule;
      try {
        if (ort?.env?.wasm) {
          ort.env.wasm.proxy = false; // Never use cross-origin Web Worker from CDN
          ort.env.wasm.wasmPaths = RVM_LOCAL_WASM_PATH;
        }
      } catch { /* already initialized */ }

      let modelBuf: Uint8Array | null = null;
      try {
        const resp = await fetch(RVM_LOCAL_MODEL_URL);
        if (resp.ok) {
          modelBuf = new Uint8Array(await resp.arrayBuffer());
        }
      } catch (e) {
        console.warn('[rvmMatting] Failed to load local RVM model, trying remote CDN...', e);
      }

      if (!modelBuf) {
        const resp = await fetch(RVM_REMOTE_MODEL_URL);
        if (!resp.ok) throw new Error(`RVM model download failed: ${resp.status}`);
        modelBuf = new Uint8Array(await resp.arrayBuffer());
      }

      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      try {
        return await ort.InferenceSession.create(modelBuf, {
          executionProviders: hasWebGPU ? ['webgpu', 'wasm'] : ['wasm'],
          graphOptimizationLevel: 'all',
        });
      } catch (epErr) {
        console.warn('[rvmMatting] WebGPU session failed, retrying with pure WASM:', epErr);
        // Fallback to CDN wasm if local wasm threw
        try {
          if (ort?.env?.wasm) {
            ort.env.wasm.wasmPaths = RVM_WASM_CDN;
          }
        } catch {}
        return await ort.InferenceSession.create(modelBuf, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      }
    } catch (err) {
      console.warn('[rvmMatting] RVM load failed, will fall back to MediaPipe/IS-Net:', err);
      // Cache the failure — do NOT reset to null. That causes infinite re-download
      // of the 7.5MB model on every frame (~450 MB/sec network traffic).
      return null;
    }
  })();
  return rvmSessionPromise;
}

// ── Per-clip recurrent state ─────────────────────────────────────────────────

interface RVMStateTensor {
  data: F16;
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

const srcCanvasCache = new Map<string, HTMLCanvasElement>();

function getSrcCanvas(key: string, w: number, h: number): HTMLCanvasElement {
  let c = srcCanvasCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
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

async function tensorFloat16Array(t: any): Promise<F16> {
  if (t.location === 'gpu-buffer') {
    const buf = await t.getData();
    if (HasNativeFloat16 && NativeFloat16Array) {
      return new NativeFloat16Array(buf.buffer, buf.byteOffset, buf.byteLength >> 1);
    }
    return new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength >> 1);
  }
  return t.data as F16;
}

/**
 * Run RVM matting on a video/canvas/image element.
 *
 * The recurrent memory is what makes this CapCut-grade: states persist per
 * clip across frames, so alpha is temporally coherent with zero flicker.
 * States auto-reset on seeks, backward time or resolution changes.
 *
 * @param videoTime Clip-local time in seconds (used for state-jump detection)
 */
/**
 * Per-clip serialization queue. The recurrent state (read → await session.run →
 * write) is NOT atomic: two concurrent calls for the same clip interleave and
 * corrupt the temporal memory (the two independent in-flight guards further up
 * the stack — window flags vs. segmentingInFlight — both allowed this).
 * Chaining calls per clipId guarantees the state is always consistent; the
 * queue depth stays ≤1 because callers already throttle.
 */
const rvmInFlight = new Map<string, Promise<any>>();

export async function segmentWithRVM(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  clipId: string,
  videoTime: number,
  maxDim: number = 512
): Promise<RVMSegmentResult | null> {
  // Canonicalize the inference size to fixed tiers. Different call sites used
  // to pass 384/512/768 for the same clip, which changed infW/infH and forced
  // a recurrent-state reset on every alternating call — silently defeating
  // RVM's temporal coherence.
  const canonicalMaxDim = maxDim <= 448 ? 384 : maxDim <= 640 ? 512 : 768;

  const prev = rvmInFlight.get(clipId) || Promise.resolve();
  const run = prev.then(() =>
    segmentWithRVMInner(source, clipId, videoTime, canonicalMaxDim)
  );
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

    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const infW = Math.max(32, Math.round((sw * scale) / 2) * 2);
    const infH = Math.max(32, Math.round((sh * scale) / 2) * 2);

    const canvas = getSrcCanvas(`_rvm_src_${infW}x${infH}`, infW, infH);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source as CanvasImageSource, 0, 0, infW, infH);
    const img = ctx.getImageData(0, 0, infW, infH).data;

    // RGBA → planar RGB normalized → float16 src tensor
    const npix = infW * infH;
    const srcF32 = new Float32Array(3 * npix);
    for (let p = 0, i = 0; p < npix; p++, i += 4) {
      srcF32[p] = img[i] * 0.00392156862745098;
      srcF32[npix + p] = img[i + 1] * 0.00392156862745098;
      srcF32[2 * npix + p] = img[i + 2] * 0.00392156862745098;
    }
    const ort: any = (ortModule as any).default || ortModule;
    const srcTensor = createFloat16Tensor(ort, srcF32, [1, 3, infH, infW]);
    // Downsample ratio must be a pure function of the canonical tier so the
    // recurrent state stays compatible across calls from different pipelines.
    const dRatio = new ort.Tensor('float32', new Float32Array([maxDim === 768 ? 0.25 : 0.375]), [1]);

    // State validation: reset on seek, backward time or resolution change
    const state = getRVMClipState(clipId);
    const isJump =
      !state.states ||
      state.infW !== infW ||
      state.infH !== infH ||
      videoTime < 0 ||
      Math.abs(videoTime - state.lastVideoTime) > 0.4;

    const feeds: Record<string, any> = { src: srcTensor, downsample_ratio: dRatio };
    if (isJump) {
      for (let k = 1; k <= 4; k++) {
        feeds[`r${k}i`] = createZeroStateTensor(ort);
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
      const data = await tensorFloat16Array(t);
      newStates.push({ data: data.slice(), dims: t.dims });
    }
    state.states = newStates;
    state.lastVideoTime = videoTime;
    state.infW = infW;
    state.infH = infH;

    // pha [1,1,H,W] float16 → white-RGB + alpha ImageBitmap
    const pha = out['pha'];
    const phaHalf = await tensorFloat16Array(pha);
    const pw = pha.dims[3];
    const ph = pha.dims[2];
    const maskData = new ImageData(pw, ph);
    const data32 = new Uint32Array(maskData.data.buffer);
    let sum = 0;
    const isNativeF16 = HasNativeFloat16 && (phaHalf instanceof (window as any).Float16Array || phaHalf.constructor?.name === 'Float16Array');
    for (let i = 0; i < phaHalf.length; i++) {
      const a = isNativeF16 ? (phaHalf as any)[i] : halfToFloat(phaHalf[i]);
      sum += a;
      const alpha = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255);
      data32[i] = (alpha << 24) | 0x00FFFFFF;
    }
    const coverage = sum / phaHalf.length;
    const bitmap = await createImageBitmap(maskData);
    return { bitmap, coverage, width: pw, height: ph };
  } catch (err) {
    console.warn('[rvmMatting] RVM segmentation error:', err);
    resetRVMState(clipId);
    return null;
  }
}
