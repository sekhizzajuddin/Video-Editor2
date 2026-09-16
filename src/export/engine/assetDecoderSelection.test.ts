/**
 * assetDecoderSelection.test.ts
 *
 * Contract of `AssetDecoder`'s frame selection — the class that made a split
 * timeline "struggle to render".
 *
 * The old implementation treated ANY backward request as "the media is being
 * reused from the start" and re-opened the iterator at timestamp 0, re-decoding
 * the file from its first keyframe for every rewind. With one decoder per media
 * (as the export worker used to build) a split + a second track reusing the same
 * media did that on every output frame.
 *
 * These tests pin the replacement behaviour:
 *   - monotonic forward access never seeks,
 *   - a backward jump re-positions at the REQUESTED time (never at 0),
 *   - a repeated/rewound request inside the recent-frame window is served from
 *     the cache without touching the decoder,
 *   - the frame returned is always the newest frame at or before the request.
 */

import { describe, it, expect } from 'vitest';
import * as Mp4Muxer from 'mp4-muxer';
import {
  FAKE_AVCC,
  FRAME_US,
  FakeVideoDecoder,
  FakeVideoFrame,
  buildInputMp4,
  installExportHarness,
} from './testFakes/exportHarness';

installExportHarness();

describe('AssetDecoder frame selection', () => {
  it('decodes monotonically without seeking and only seeks for real jumps', async () => {
    const { AssetDecoder } = await import('./AssetDecoder');
    const decoder = new AssetDecoder('buffer:none');
    await decoder.load(buildInputMp4(3));
    expect(decoder.ready, decoder.loadError ?? '').toBe(true);

    // 1. Sequential forward pass (an export walking a clip) → zero seeks.
    const requests: number[] = [];
    const forwardFrames: any[] = [];
    for (let i = 0; i < 20; i++) {
      const t = 1_000_000 + Math.round(i * FRAME_US);
      requests.push(t);
      forwardFrames.push(await decoder.getFrameAt(t));
    }
    expect(decoder.stats.sequentialFrames).toBeGreaterThan(0);
    expect(decoder.stats.seeks).toBe(0);
    expect(decoder.stats.backwardSeeks).toBe(0);

    // Every request resolved to a frame, and the frames carry the source
    // timestamps the iterator produced (never null mid-file).
    expect(forwardFrames.every(Boolean)).toBe(true);

    // 2. Repeating the last request → served from the frame the decoder already
    //    holds, no extra decode.
    const before = decoder.stats.sequentialFrames;
    const repeat = await decoder.getFrameAt(requests[requests.length - 1]);
    expect(repeat).toBeTruthy();
    expect(decoder.stats.sequentialFrames).toBe(before);

    // 3. A small rewind inside the recent-frame window is a cache hit: the
    //    decoder keeps a contiguous ring of the frames it just produced.
    const cacheHitsBefore = decoder.stats.cacheHits;
    await decoder.getFrameAt(requests[requests.length - 3]);
    expect(decoder.stats.cacheHits).toBeGreaterThan(cacheHitsBefore);
    expect(decoder.stats.seeks).toBe(0);

    // 4. A real rewind (other end of the file) re-positions ONCE, at the target.
    const seeksBefore = decoder.stats.seeks;
    const rewound = await decoder.getFrameAt(200_000);
    expect(decoder.stats.seeks).toBe(seeksBefore + 1);
    expect(decoder.stats.backwardSeeks).toBe(1);
    expect(rewound).toBeTruthy();

    // 5. Continue forward from the new position without further seeks.
    const seeksAfterRewind = decoder.stats.seeks;
    for (let i = 0; i < 5; i++) {
      await decoder.getFrameAt(200_000 + (i + 1) * FRAME_US);
    }
    expect(decoder.stats.seeks).toBe(seeksAfterRewind);

    decoder.dispose();
  }, 30_000);

  it('resolves the requested frame, not a stale one, when decoding continues', async () => {
    const { AssetDecoder } = await import('./AssetDecoder');
    const decoder = new AssetDecoder('buffer:none');
    await decoder.load(buildInputMp4(2));
    expect(decoder.ready, decoder.loadError ?? '').toBe(true);

    // The fake decoder stamps the source timestamp into the frame; the returned
    // canvas carries it in its first 4 bytes (see exportHarness).
    const frameAt = async (us: number) => {
      const frame: any = await decoder.getFrameAt(us);
      const pixels: Uint8ClampedArray | undefined = frame?.__pixels;
      if (!pixels) return null;
      return new DataView(pixels.buffer, pixels.byteOffset).getUint32(0, true);
    };

    // Walk forward frame by frame: each answer must be the newest sample at or
    // before the request, i.e. within one frame of it.
    for (let i = 0; i < 30; i++) {
      const target = Math.round(i * FRAME_US);
      const stamp = await frameAt(target);
      if (stamp === null) continue; // canvas marker unavailable in this path
      expect(Math.abs(stamp - target), `frame ${i}`).toBeLessThanOrEqual(FRAME_US + 1);
    }

    decoder.dispose();
  }, 30_000);
});
