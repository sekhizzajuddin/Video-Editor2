/**
 * exportHarness.ts (test-only)
 *
 * Fake browser media environment for driving the REAL export pipeline
 * (`ExportWorkerManager` → `export.worker` → `FrameScheduler` → `AssetDecoder` →
 * mediabunny → mp4-muxer) inside Vitest: fake WebCodecs decoders/encoders,
 * OffscreenCanvas + 2D context, a real in-memory MP4 built with mp4-muxer, and
 * helpers to read back which SOURCE frame each output frame drew.
 *
 * The fake decoder stamps the encoded sample timestamp into the first 4 bytes of
 * every drawn frame (see `markerUs`), which is what lets the tests assert the
 * exact source time each exported frame sampled — the property that breaks when
 * a split segment is served by the wrong decode stream.
 *
 * Not named `*.test.ts` on purpose: it is shared by several suites.
 */

import * as Mp4Muxer from 'mp4-muxer';

// --------------------------------------------------------------------------
// Browser API stubs (same contract as exportWorkerPipeline.test.ts)
// --------------------------------------------------------------------------

export const FRAME_W = 16;
export const FRAME_H = 16;
export const FPS = 30;
export const FRAME_US = Math.round(1_000_000 / FPS);
export const FAKE_AVCC = new Uint8Array([
  1, 100, 0, 31, 0xff, 0xe1, 0x00, 0x05, 1, 2, 3, 4, 5, 0x01, 0x00, 0x04, 6, 7, 8, 9,
]);

export interface DrawOp {
  op: 'fill' | 'draw';
  pixels?: Uint8ClampedArray | null;
}

export function maxChannel(pixels: Uint8ClampedArray | null | undefined): number {
  if (!pixels) return 0;
  let max = 0;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] > max) max = pixels[i];
    if (max === 255) break;
  }
  return max;
}
export class Fake2DContext {
  canvas: FakeOffscreenCanvas;
  fillStyle = '#000';
  strokeStyle = '#000';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  font = '';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  lineWidth = 1;
  shadowColor = 'transparent';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  imageSmoothingEnabled = true;
  imageSmoothingQuality = 'low';
  constructor(canvas: FakeOffscreenCanvas) {
    this.canvas = canvas;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    // A full-frame fill is the background fill that starts each compositor pass.
    if (x === 0 && y === 0 && w >= this.canvas.width && h >= this.canvas.height) {
      this.canvas.__pass = [];
      this.canvas.__passCursor = 0;
      this.canvas.__hasContent = false;
      this.canvas.__maxPixel = 0;
    }
    this.canvas.__pass.push({ op: 'fill' });
  }
  clearRect(x: number, y: number, w: number, h: number) {
    if (x === 0 && y === 0 && w >= this.canvas.width && h >= this.canvas.height) {
      this.canvas.__hasContent = false;
      this.canvas.__maxPixel = 0;
      this.canvas.__pixels = null;
    }
  }
  drawImage(src: any) {
    let pixels: Uint8ClampedArray | null = src?.__pixels ?? null;
    // Handle FakeVideoFrame with timestamp
    if (!pixels && typeof src?.timestamp === 'number' && !FakeVideoFrame.emitBlackPixels) {
      const buf = new Uint8ClampedArray(16 * 16 * 4).fill(128);
      new DataView(buf.buffer).setUint32(0, src.timestamp, true);
      pixels = buf;
    }
    // Propagate canvas max pixel as bright fill
    if (!pixels && src?.__maxPixel && !FakeVideoFrame.emitBlackPixels) {
      pixels = src.__pixels ?? new Uint8ClampedArray(16 * 16 * 4).fill(src.__maxPixel);
    }
    this.canvas.__pass.push({ op: 'draw', pixels });
    const srcMax = pixels ? maxChannel(pixels) : (src?.__maxPixel ?? 0);
    if (srcMax > 0) {
      this.canvas.__hasContent = true;
      if (srcMax > this.canvas.__maxPixel) this.canvas.__maxPixel = srcMax;
      this.canvas.__pixels = pixels;
    }
  }
  putImageData(d: any) {
    this.canvas.__pixels = d.data;
    this.canvas.__maxPixel = maxChannel(d.data);
  }
  getImageData(_x: number, _y: number, w: number, h: number) {
    const fill = Math.min(255, this.canvas.__maxPixel ?? 0);
    return { data: new Uint8ClampedArray(w * h * 4).fill(fill), width: w, height: h };
  }
  measureText() {
    return { width: 10 };
  }
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  beginPath() {}
  rect() {}
  clip() {}
  fill() {}
  stroke() {}
  fillText() {}
  strokeText() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
}

export class FakeOffscreenCanvas {
  __isCanvas = true;
  width: number;
  height: number;
  __pass: DrawOp[] = [];
  __passCursor = 0;
  __pixels: Uint8ClampedArray | null = null;
  __hasContent = false;
  __maxPixel = 0;
  __ctx = new Fake2DContext(this);
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return this.__ctx;
  }
  transferToImageBitmap() {
    return { __pixels: this.__pixels, width: this.width, height: this.height, close() {} };
  }
  close() {}
}

export class FakeVideoFrame {
  timestamp: number;
  duration: number;
  displayWidth = FRAME_W;
  displayHeight = FRAME_H;
  codedWidth = FRAME_W;
  codedHeight = FRAME_H;
  source: any;
  closed = false;
  constructor(source: any, init: any = {}) {
    this.source = source;
    this.timestamp = init.timestamp ?? 0;
    this.duration = init.duration ?? FRAME_US;
    if (source && source.__isCanvas) {
      this.displayWidth = source.width;
      this.displayHeight = source.height;
    }
  }
  clone() {
    const f = new FakeVideoFrame(this.source, { timestamp: this.timestamp, duration: this.duration });
    f.displayWidth = this.displayWidth;
    f.displayHeight = this.displayHeight;
    f.codedWidth = this.codedWidth;
    f.codedHeight = this.codedHeight;
    return f;
  }
  close() {
    this.closed = true;
  }
  /** Test-only: when true, copyTo writes nothing (simulates black GPU frames). */
  static emitBlackPixels = false;
  async copyTo(dest: Uint8ClampedArray) {
    if (!FakeVideoFrame.emitBlackPixels) {
      dest.fill(128);
      new DataView(dest.buffer, dest.byteOffset).setUint32(0, this.timestamp, true);
    }
    return [];
  }
}

export class FakeVideoDecoder {
  state = 'unconfigured';
  decodeQueueSize = 0;
  private outputCb: (f: FakeVideoFrame) => void;
  private listeners: Record<string, Array<() => void>> = {};
  constructor(init: any) {
    this.outputCb = init.output;
  }
  configure() {
    this.state = 'configured';
  }
  decode(chunk: any) {
    this.decodeQueueSize++;
    queueMicrotask(() => {
      this.decodeQueueSize--;
      (this.listeners['dequeue'] || []).forEach((f) => f());
      this.outputCb(new FakeVideoFrame(null, { timestamp: chunk.timestamp, duration: chunk.duration }));
    });
  }
  async flush() {
    while (this.decodeQueueSize > 0) await new Promise((r) => setTimeout(r, 0));
  }
  close() {
    this.state = 'closed';
  }
  addEventListener(t: string, fn: () => void) {
    (this.listeners[t] ||= []).push(fn);
  }
  removeEventListener(t: string, fn: () => void) {
    this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn);
  }
}

export class FakeEncodedVideoChunk {
  type: 'key' | 'delta';
  timestamp: number;
  duration: number;
  byteLength: number;
  private data: Uint8Array;
  constructor(init: any) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration ?? FRAME_US;
    this.data = init.data ?? new Uint8Array([0, 0, 0, 8, 1, 2, 3, 4, 5, 6, 7, 8]);
    this.byteLength = this.data.byteLength;
  }
  copyTo(dest: Uint8Array) {
    dest.set(this.data);
  }
}

export class FakeVideoEncoder {
  static last: FakeVideoEncoder | null = null;
  static isConfigSupported = async (config: any) => ({ supported: true, config });
  state = 'unconfigured';
  encodeQueueSize = 0;
  /** Frame passes captured at encode time: timestamp -> draw ops. */
  captured: Array<{ timestamp: number; pass: DrawOp[] }> = [];
  private outputCb: (c: any, m: any) => void;
  private listeners: Record<string, Array<() => void>> = {};
  constructor(init: any) {
    this.outputCb = init.output;
    FakeVideoEncoder.last = this;
  }
  configure() {
    this.state = 'configured';
  }
  encode(frame: FakeVideoFrame, opts?: { keyFrame?: boolean }) {
    const canvas = frame.source as FakeOffscreenCanvas | null;
    const pass = canvas ? canvas.__pass.slice(canvas.__passCursor) : [];
    if (canvas) canvas.__passCursor = canvas.__pass.length;
    this.captured.push({ timestamp: frame.timestamp, pass });
    this.encodeQueueSize++;
    queueMicrotask(() => {
      this.encodeQueueSize--;
      (this.listeners['dequeue'] || []).forEach((f) => f());
      this.outputCb(
        new FakeEncodedVideoChunk({
          type: opts?.keyFrame ? 'key' : 'delta',
          timestamp: frame.timestamp,
          duration: frame.duration,
        }),
        { decoderConfig: { codec: 'avc1.42001f', description: FAKE_AVCC } }
      );
    });
  }
  async flush() {
    while (this.encodeQueueSize > 0) await new Promise((r) => setTimeout(r, 0));
  }
  close() {
    this.state = 'closed';
  }
  addEventListener(t: string, fn: () => void) {
    (this.listeners[t] ||= []).push(fn);
  }
  removeEventListener(t: string, fn: () => void) {
    this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn);
  }
}

export class FakeWritable {
  data = new Uint8Array(0);
  closed = false;
  async write(chunk: any) {
    if (chunk?.type === 'seek') return;
    if (chunk?.type === 'truncate') {
      this.data = this.data.slice(0, chunk.size);
      return;
    }
    const bytes: Uint8Array = chunk?.data instanceof Uint8Array ? chunk.data : new Uint8Array(chunk?.data ?? []);
    const pos: number = chunk?.position ?? this.data.byteLength;
    if (this.data.byteLength < pos + bytes.byteLength) {
      const grown = new Uint8Array(pos + bytes.byteLength);
      grown.set(this.data);
      this.data = grown;
    }
    this.data.set(bytes, pos);
  }
  async close() {
    this.closed = true;
  }
  async abort() {}
}

export const posted: Array<{ type: string; payload: any }> = [];

export function installExportHarness(): void {
  const g = globalThis as any;
  g.self = g;
  g.postMessage = (msg: any) => posted.push(msg);
  g.OffscreenCanvas = FakeOffscreenCanvas;
  g.OffscreenCanvasRenderingContext2D = Fake2DContext;
  g.ImageData = class {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(d: Uint8ClampedArray, w: number, h: number) {
      this.data = d;
      this.width = w;
      this.height = h;
    }
  };
  g.VideoFrame = FakeVideoFrame;
  g.VideoDecoder = FakeVideoDecoder;
  g.VideoEncoder = FakeVideoEncoder;
  g.EncodedVideoChunk = FakeEncodedVideoChunk;
  g.FileSystemWritableFileStream = FakeWritable;
  g.createImageBitmap = async (src?: any) => {
    // Respect black-frame simulation flag
    if (FakeVideoFrame.emitBlackPixels) {
      return { __pixels: new Uint8ClampedArray(4 * 4).fill(0), width: 4, height: 4, close() {}, __maxPixel: 0 };
    }
    // If source is a VideoFrame or canvas with timestamp pixels, preserve a marker
    // For simplicity return a bright pixel block so black detection passes
    return { __pixels: new Uint8ClampedArray(4 * 4).fill(200), width: 4, height: 4, close() {}, __maxPixel: 200 };
  };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

export function buildInputMp4(seconds: number, startOffsetFrames = 0): ArrayBuffer {
  const totalSamples = Math.round(seconds * FPS);
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width: FRAME_W, height: FRAME_H },
    fastStart: 'in-memory',
  });
  for (let i = 0; i < totalSamples; i++) {
    muxer.addVideoChunkRaw(
      new Uint8Array([0, 0, 0, 6, 0x25, (i + startOffsetFrames) & 0xff, 0, 0xaa, 0xbb, 0xcc]),
      i % (FPS * 2) === 0 ? 'key' : 'delta',
      Math.round((i * 1_000_000) / FPS),
      FRAME_US,
      { decoderConfig: { codec: 'avc1.42001f', description: FAKE_AVCC } }
    );
  }
  muxer.finalize();
  return (muxer.target as Mp4Muxer.ArrayBufferTarget).buffer;
}

export function makeFileHandle(name: string) {
  const writable = new FakeWritable();
  return {
    writable,
    handle: {
      name,
      createWritable: async () => writable,
      getFile: async () => ({ size: writable.data.byteLength, name }),
    },
  };
}

export async function runWorkerExport(payload: any, timeoutMs = 60000) {
  posted.length = 0;
  await import('../export.worker');
  await (globalThis as any).onmessage({ data: { type: 'START_EXPORT', payload } });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const error = posted.find((m) => m.type === 'ERROR');
    if (error) throw new Error(`worker ERROR: ${error.payload?.message}`);
    const complete = posted.find((m) => m.type === 'COMPLETE');
    if (complete) {
      return {
        complete: complete.payload,
        warnings: posted.filter((m) => m.type === 'WARNING').map((m) => m.payload?.message as string),
      };
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('worker export timed out');
}

export const baseConfig = {
  fps: FPS,
  width: 320,
  height: 180,
  bitrate: 4_000_000,
  format: 'mp4' as const,
  filename: 'scenario',
  aspectRatio: '16:9',
};

export function singleClipTimeline(mediaId: string, seconds: number): any {
  return {
    tracks: [
      {
        id: 't1',
        name: 'V1',
        type: 'video',
        locked: false,
        muted: false,
        hidden: false,
        clips: [videoClip('c1', mediaId, 0, seconds, {})],
      },
    ],
    media: [{ id: mediaId, name: 'clip.mp4', type: 'video', duration: seconds, url: 'blob:x', createdAt: 0 }],
    duration: seconds,
    totalDuration: seconds,
    aspectRatio: 16 / 9,
  };
}

export function markerUs(op: DrawOp | undefined): number | null {
  if (!op || !op.pixels || op.pixels.byteLength < 4) return null;
  return new DataView(op.pixels.buffer, op.pixels.byteOffset).getUint32(0, true);
}

export function videoClip(id: string, mediaId: string, startTime: number, duration: number, extra: any = {}) {
  return {
    id,
    mediaId,
    trackId: 't1',
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { x: 0, y: 0, scale: 100, rotation: 0 },
    opacity: 1,
    speed: 1,
    effects: [],
    ...extra,
  };
}

export const DEFAULT_MEDIA_META = { type: 'video', createdAt: 0 };
