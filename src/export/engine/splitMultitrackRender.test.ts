/**
 * splitMultitrackRender.test.ts
 *
 * Regression suite for the "system struggles to render after a split" bug.
 *
 * Root cause it locks down: the export worker used to build ONE decoder per
 * media file (`mediaDecoders` keyed by mediaId). As soon as a clip was split and
 * the same media appeared again on another track — or a segment was moved — the
 * per-frame requests for two distant source windows were interleaved through that
 * single sequential decoder. Every frame rewound the pipeline
 * (`AssetDecoder` re-opened the iterator at 0 and re-decoded from the file's
 * first keyframe), so a 6 second export performed ~60 full rewinds and, on real
 * 4K media, appeared to hang.
 *
 * These tests drive the REAL worker pipeline with a fake WebCodecs environment
 * and assert:
 *
 *   1. every output frame composites the expected number of visual layers,
 *   2. every frame samples the source frame the timeline asks for (read back
 *      from the timestamp marker the fake decoder stamps into each frame),
 *   3. each planned decode stream reports ZERO backward seeks (no rewinds),
 *   4. conflicting clips get their own decoder, contiguous split segments share
 *      one.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  FPS,
  FRAME_US,
  DEFAULT_MEDIA_META,
  FakeVideoEncoder,
  FakeVideoFrame,
  baseConfig,
  buildInputMp4,
  installExportHarness,
  makeFileHandle,
  markerUs,
  runWorkerExport,
  videoClip,
  type DrawOp,
} from './testFakes/exportHarness';
import { planDecodeStreams } from '../../utils/splitClipIdentity';

beforeAll(() => {
  installExportHarness();
});

interface DecodeStatsPayload {
  streamId: string;
  stats: {
    requests: number;
    cacheHits: number;
    sequentialFrames: number;
    seeks: number;
    backwardSeeks: number;
  };
}

/** Source sample every output frame should have drawn, per clip. */
function expectedSourceSeconds(clip: { startTime: number; trimStart?: number; speed?: number }, t: number): number {
  return (clip.trimStart ?? 0) + Math.max(0, t - clip.startTime) * (clip.speed ?? 1);
}

describe('export worker — split clips on multiple tracks', () => {
  it('renders every frame without rewinding the decoder when a split chain shares its media with another track', async () => {
    // 6 s of source, split into three back-to-back segments on V1, plus a copy
    // of a segment on V2 taken from a DIFFERENT source window (exactly what
    // copy/paste + trim produces).
    // 8 s of source so EVERY requested window exists (b1 samples source 5..7 s;
    // asking past the end of a real file legitimately returns its last frame).
    const buf = buildInputMp4(8);
    const mediaId = 'm1';
    const a1 = videoClip('a1', mediaId, 0, 2, { trimStart: 0 });
    const a2 = videoClip('a2', mediaId, 2, 2, { trimStart: 2 });
    const a3 = videoClip('a3', mediaId, 4, 2, { trimStart: 4 });
    const b1 = videoClip('b1', mediaId, 2, 2, { trimStart: 5 });

    const timeline = {
      tracks: [
        { id: 't1', name: 'V1', type: 'video', locked: false, muted: false, hidden: false, clips: [a1, a2, a3] },
        { id: 't2', name: 'V2', type: 'video', locked: false, muted: false, hidden: false, clips: [b1] },
      ],
      media: [{ id: mediaId, name: 'a.mp4', duration: 8, url: 'blob:x', ...DEFAULT_MEDIA_META }],
      duration: 6,
      totalDuration: 6,
      aspectRatio: 16 / 9,
    };

    // The planner must give the second track its own decoder while keeping the
    // three contiguous split segments on one.
    const plan = planDecodeStreams(timeline as any);
    expect(plan.streams).toHaveLength(2);
    const chainStream = plan.streams.find((s) => s.clipIds.length === 3)!;
    expect(chainStream.clipIds).toEqual(expect.arrayContaining(['a1', 'a2', 'a3']));
    const brollStream = plan.streams.find((s) => s.clipIds.includes('b1'))!;
    expect(brollStream.shared).toBe(false);

    const { handle } = makeFileHandle('split-multitrack.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buf },
    });

    expect(res.warnings).toEqual([]);

    const totalFrames = 6 * FPS;
    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(totalFrames);

    // ── 1 + 2. Every frame draws, and draws the RIGHT source frame ─────────
    enc.captured.forEach((frame, i) => {
      const t = i / FPS;
      const draws = frame.pass.filter((o) => o.op === 'draw' && o.pixels) as DrawOp[];
      const expectedLayers = t >= 2 && t < 4 ? 2 : 1;
      expect(draws.length, `frame ${i} (t=${t.toFixed(2)}) drew ${draws.length} layers`).toBe(expectedLayers);

      // V1 is the bottom layer: it follows the split chain across all 6 s.
      const expectedV1 = expectedSourceSeconds(
        t < 2 ? a1 : t < 4 ? a2 : a3,
        t,
      );
      const v1Marker = markerUs(draws[0]);
      if (v1Marker !== null && v1Marker < 100_000_000) {
        expect(
          Math.abs(v1Marker / 1e6 - expectedV1),
          `frame ${i} (t=${t.toFixed(2)}) sampled source ${(v1Marker / 1e6).toFixed(3)}s, expected ${expectedV1.toFixed(3)}s`,
        ).toBeLessThanOrEqual(2 * (FRAME_US / 1e6) + 0.001);
      }

      if (expectedLayers === 2) {
        // V2 is on top and must sample ITS source window (5 s+), not the chain's.
        const brollMarker = markerUs(draws[1]);
        if (brollMarker !== null && brollMarker < 100_000_000) {
          expect(
            Math.abs(brollMarker / 1e6 - expectedSourceSeconds(b1, t)),
            `frame ${i} B-roll sampled source ${(brollMarker / 1e6).toFixed(3)}s`,
          ).toBeLessThanOrEqual(2 * (FRAME_US / 1e6) + 0.001);
        }
      }
    });

    // ── 3 + 4. No decode stream ever had to rewind ─────────────────────────
    const stats = ((res.complete as any).decodeStats ?? []) as DecodeStatsPayload[];
    expect(stats.length).toBeGreaterThanOrEqual(2); // one per planned stream
    for (const stream of stats) {
      expect(
        stream.stats.backwardSeeks,
        `stream ${stream.streamId} rewound ${stream.stats.backwardSeeks}x (${JSON.stringify(stream.stats)})`,
      ).toBe(0);
    }
  }, 60_000);

  it('a several-times split clip still samples continuous source across boundaries', async () => {
    // 80 frames of source split into five segments: crossing each boundary must
    // be a continue, never a jump back to a keyframe.
    const buf = buildInputMp4(3);
    const mediaId = 'm-cut';
    const clips = [0, 1, 2, 3, 4].map((i) =>
      videoClip(`s${i}`, mediaId, i * 0.5, 0.5, { trimStart: i * 0.5 }),
    );
    const timeline = {
      tracks: [{ id: 't1', name: 'V1', type: 'video', locked: false, muted: false, hidden: false, clips }],
      media: [{ id: mediaId, name: 'chain.mp4', duration: 3, url: 'blob:y', ...DEFAULT_MEDIA_META }],
      duration: 2.5,
      totalDuration: 2.5,
      aspectRatio: 16 / 9,
    };

    const plan = planDecodeStreams(timeline as any);
    expect(plan.streams).toHaveLength(1); // one chain → one decoder

    const { handle } = makeFileHandle('chain.mp4');
    const res = await runWorkerExport({
      timeline,
      config: { ...baseConfig, fps: FPS },
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buf },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    const expectedFrames = Math.round(2.5 * FPS);
    expect(enc.captured.length).toBe(expectedFrames);

    enc.captured.forEach((frame, i) => {
      const t = i / FPS;
      const draws = frame.pass.filter((o) => o.op === 'draw' && o.pixels) as DrawOp[];
      expect(draws.length, `frame ${i} black`).toBe(1);
      const marker = markerUs(draws[0]);
      if (marker === null || marker >= 100_000_000) return;
      expect(
        Math.abs(marker / 1e6 - t),
        `frame ${i} (t=${t.toFixed(3)}s) sampled ${(marker / 1e6).toFixed(3)}s — split boundary discontinuity`,
      ).toBeLessThanOrEqual(2 * (FRAME_US / 1e6) + 0.001);
    });

    const stats = ((res.complete as any).decodeStats ?? []) as DecodeStatsPayload[];
    expect(stats).toHaveLength(1);
    expect(stats[0].stats.backwardSeeks).toBe(0);
    expect(stats[0].stats.seeks).toBe(0);
  }, 60_000);

  it('a moved (re-ordered) split segment degrades to a bounded seek instead of a rewind storm', async () => {
    // The right half was dragged BEFORE the left half: the source windows are no
    // longer monotonic, so the planner must not pretend they can share one
    // sequential pass. Rendering must stay correct (every frame draws) and the
    // rewind count must stay proportional to the number of out-of-order clips,
    // not to the number of frames.
    const buf = buildInputMp4(4);
    const mediaId = 'm-swap';
    const left = videoClip('left', mediaId, 0, 2, { trimStart: 2 }); // source 2..4
    const right = videoClip('right', mediaId, 2, 2, { trimStart: 0 }); // source 0..2
    const timeline = {
      tracks: [{ id: 't1', name: 'V1', type: 'video', locked: false, muted: false, hidden: false, clips: [left, right] }],
      media: [{ id: mediaId, name: 'swap.mp4', duration: 4, url: 'blob:z', ...DEFAULT_MEDIA_META }],
      duration: 4,
      totalDuration: 4,
      aspectRatio: 16 / 9,
    };

    // Non-monotonic source order → separate streams (no fragile sharing).
    const plan = planDecodeStreams(timeline as any);
    expect(plan.streams).toHaveLength(2);

    const { handle } = makeFileHandle('swap.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buf },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(4 * FPS);
    enc.captured.forEach((frame, i) => {
      const draws = frame.pass.filter((o) => o.op === 'draw' && o.pixels);
      expect(draws.length, `frame ${i} black`).toBe(1);
    });

    const stats = ((res.complete as any).decodeStats ?? []) as DecodeStatsPayload[];
    const totalBackwardSeeks = stats.reduce((sum, s) => sum + s.stats.backwardSeeks, 0);
    // Two clips, two decoders: each stream is monotonic, so still zero rewinds.
    expect(totalBackwardSeeks).toBe(0);
  }, 60_000);

  it('detects a black export when the decoder is broken (guard still works)', async () => {
    const buf = buildInputMp4(1);
    const mediaId = 'm-black';
    const timeline = {
      tracks: [{ id: 't1', name: 'V1', type: 'video', locked: false, muted: false, hidden: false, clips: [videoClip('c1', mediaId, 0, 1, {})] }],
      media: [{ id: mediaId, name: 'black.mp4', duration: 1, url: 'blob:b', ...DEFAULT_MEDIA_META }],
      duration: 1,
      totalDuration: 1,
      aspectRatio: 16 / 9,
    };

    // Simulate a GPU decode path that hands back black pixels: the worker's
    // watchdog must refuse to ship an all-black file.
    FakeVideoFrame.emitBlackPixels = true;
    try {
      const { handle } = makeFileHandle('black.mp4');
      await expect(
        runWorkerExport({
          timeline,
          config: baseConfig,
          audioData: null,
          fileHandle: handle,
          mediaBuffers: { [mediaId]: buf },
        }),
      ).rejects.toThrow(/black/i);
    } finally {
      FakeVideoFrame.emitBlackPixels = false;
    }
  }, 60_000);
});
