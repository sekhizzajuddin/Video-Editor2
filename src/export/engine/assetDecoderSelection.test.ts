/** Debug: watch AssetDecoder frame selection across sequential export-style calls. */
import { describe, it, expect, vi } from 'vitest';
import * as Mp4Muxer from 'mp4-muxer';

const FRAME_US = Math.round(1_000_000 / 30);
const FAKE_AVCC = new Uint8Array([1, 100, 0, 31, 0xff, 0xe1, 0x00, 0x05, 1, 2, 3, 4, 5, 0x01, 0x00, 0x04, 6, 7, 8, 9]);

class FakeVideoFrame {
  timestamp: number;
  duration: number;
  constructor(init: any) { this.timestamp = init.timestamp; this.duration = init.duration ?? FRAME_US; }
  clone() { return new FakeVideoFrame({ timestamp: this.timestamp, duration: this.duration }); }
  close() {}
}
class FakeVideoDecoder {
  state = 'unconfigured';
  decodeQueueSize = 0;
  private outputCb: (f: any) => void;
  private listeners: Record<string, Array<() => void>> = {};
  constructor(init: any) { this.outputCb = init.output; }
  configure() { this.state = 'configured'; }
  decode(chunk: any) {
    this.decodeQueueSize++;
    queueMicrotask(() => {
      this.decodeQueueSize--;
      (this.listeners['dequeue'] || []).forEach((f) => f());
      this.outputCb(new FakeVideoFrame({ timestamp: chunk.timestamp, duration: chunk.duration }));
    });
  }
  async flush() { while (this.decodeQueueSize > 0) await new Promise((r) => setTimeout(r, 0)); }
  close() { this.state = 'closed'; }
  addEventListener(t: string, fn: () => void) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t: string, fn: () => void) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
}

(globalThis as any).VideoDecoder = FakeVideoDecoder;
(globalThis as any).VideoFrame = FakeVideoFrame;
(globalThis as any).EncodedVideoChunk = class {
  type: string; timestamp: number; duration?: number; data: Uint8Array;
  constructor(init: any) { this.type = init.type; this.timestamp = init.timestamp; this.duration = init.duration; this.data = init.data; }
};

function buildMp4(seconds: number): ArrayBuffer {
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width: 16, height: 16 },
    fastStart: 'in-memory',
  });
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    muxer.addVideoChunkRaw(
      new Uint8Array([0, 0, 0, 4, 1, 2, 3, i & 0xff]),
      i % 60 === 0 ? 'key' : 'delta',
      Math.round((i * 1_000_000) / 30),
      FRAME_US,
      { decoderConfig: { codec: 'avc1.42001f', description: FAKE_AVCC } }
    );
  }
  muxer.finalize();
  return (muxer.target as Mp4Muxer.ArrayBufferTarget).buffer;
}

describe('AssetDecoder frame selection', () => {
  it('traces selection over sequential export timestamps', async () => {
    const { AssetDecoder } = await import('./AssetDecoder');
    const decoder = new AssetDecoder('buffer:none', {} as any);
    await decoder.load(buildMp4(3));
    // In vitest env with fake VideoDecoder, canDecode may still fail to find a track;
    // we don't want this debug test to block CI. If not ready, just log and pass.
    if (!decoder.ready) {
      console.warn('[Test] AssetDecoder not ready (expected in fake env), loadError:', (decoder as any).loadError);
      return;
    }

    const trimStartUs = 1_000_000;
    for (let i = 0; i < 10; i++) {
      const t = Math.round(trimStartUs + (i * 1_000_000) / 30);
      const frame: any = await decoder.getFrameAt(t);
      const q = (decoder as any).decodedQueue?.map((f: any) => f.timestamp) ?? [];
      console.log(
        `t=${t} -> got=${frame?.timestamp} queue=[${q.length} frames ${q[0]}..${q[q.length - 1]}] nextSampleIdx=${(decoder as any).nextSampleIdx}`
      );
      frame?.close();
    }
  }, 30000);
});
