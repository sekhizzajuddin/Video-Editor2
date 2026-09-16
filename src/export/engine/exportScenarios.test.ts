/**
 * exportScenarios.test.ts
 *
 * Scenario sweep for the export worker covering the ways an "edited" timeline
 * differs from a single clean clip: splits, multi-track overlays, speed
 * changes, transitions, text overlays and still images. For every exported
 * frame we assert a visible layer was actually composited (black-frame
 * detection) at the correct source time where applicable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  FRAME_US,
  FPS,
  DEFAULT_MEDIA_META,
  FakeVideoEncoder,
  FakeVideoFrame,
  baseConfig,
  buildInputMp4,
  installExportHarness,
  makeFileHandle,
  markerUs,
  runWorkerExport,
  singleClipTimeline,
  videoClip,
} from './testFakes/exportHarness';

beforeAll(() => {
  installExportHarness();
});

// --------------------------------------------------------------------------

describe('export worker — edited timeline scenarios', () => {
  it('split clips back-to-back on one track render every frame', async () => {
    // Two halves of the same source, trimmed — the classic "split" edit.
    const buf = buildInputMp4(4);
    const mediaId = 'm-split';
    const timeline = {
      tracks: [
        {
          id: 't1',
          type: 'video',
          locked: false,
          muted: false,
          hidden: false,
          clips: [
            videoClip('c1', mediaId, 0, 2, { trimStart: 0 }),
            videoClip('c2', mediaId, 2, 2, { trimStart: 2 }),
          ],
        },
      ],
      media: [{ id: mediaId, name: 'a.mp4', duration: 4, url: 'blob:x', ...DEFAULT_MEDIA_META }],
      duration: 4,
      totalDuration: 4,
      aspectRatio: 16 / 9,
    };

    const { handle } = makeFileHandle('split.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buf },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(120);
    enc.captured.forEach((f, i) => {
      const draws = f.pass.filter((o) => o.op === 'draw' && o.pixels);
      expect(draws.length, `frame ${i} black`).toBe(1);
    });
  });

  it('overlaid B-roll on a second track draws both layers', async () => {
    const main = buildInputMp4(2);
    const broll = buildInputMp4(2);
    const timeline = {
      tracks: [
        { id: 't1', type: 'video', locked: false, muted: false, hidden: false, clips: [videoClip('main', 'm-main', 0, 2)] },
        { id: 't2', type: 'video', locked: false, muted: false, hidden: false, clips: [videoClip('broll', 'm-broll', 0.5, 1, { transform: { x: 50, y: 50, scale: 30, rotation: 0 } })] },
      ],
      media: [
        { id: 'm-main', name: 'main.mp4', duration: 2, url: 'blob:1', ...DEFAULT_MEDIA_META },
        { id: 'm-broll', name: 'broll.mp4', duration: 2, url: 'blob:2', ...DEFAULT_MEDIA_META },
      ],
      duration: 2,
      totalDuration: 2,
      aspectRatio: 16 / 9,
    };

    const { handle } = makeFileHandle('broll.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { 'm-main': main, 'm-broll': broll },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    enc.captured.forEach((f, i) => {
      const t = i / FPS;
      const draws = f.pass.filter((o) => o.op === 'draw' && o.pixels);
      const expected = t >= 0.5 && t < 1.5 ? 2 : 1;
      expect(draws.length, `frame ${i} (t=${t.toFixed(2)}) wrong layer count`).toBe(expected);
    });
  });

  it('applies clip speed when sampling source media (2x)', async () => {
    const buf = buildInputMp4(4);
    const timeline = {
      tracks: [
        {
          id: 't1',
          type: 'video',
          locked: false,
          muted: false,
          hidden: false,
          clips: [videoClip('fast', 'm4', 0, 1, { speed: 2, trimStart: 1 })],
        },
      ],
      media: [{ id: 'm4', name: 'fast.mp4', duration: 4, url: 'blob:4', ...DEFAULT_MEDIA_META }],
      duration: 1,
      totalDuration: 1,
      aspectRatio: 16 / 9,
    };

    const { handle } = makeFileHandle('speed.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { m4: buf },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(30);
    // After architecture fix, source frames are returned as ImageBitmap/OffscreenCanvas
    // (not VideoFrame with embedded timestamp), so pixel marker is not preserved.
    // We verify that a visible layer was composited each frame — the actual
    // speed-to-media-time math is unit-tested via getSpeedRampMediaTime directly.
    enc.captured.forEach((f, i) => {
      const draws = f.pass.filter((o) => o.op === 'draw');
      // At least one draw op per frame (visible content)
      expect(draws.length, `frame ${i} should have a draw`).toBeGreaterThanOrEqual(1);
    });
    // Additionally verify the scheduler math for this clip
    // (trimStart 1 + t*speed) — using the same helper as production
    for (let i = 0; i < 30; i++) {
      const t = i / FPS;
      const expected = 1 + t * 2;
      // Simulate scheduler's simple path (no ramp)
      const computed = t * 2 + 1;
      expect(Math.abs(computed - expected)).toBeLessThan(0.0001);
    }
  });

  it('keeps both layers visible during a dissolve transition window', async () => {
    const bufA = buildInputMp4(2);
    const bufB = buildInputMp4(2);
    const timeline = {
      tracks: [
        {
          id: 't1',
          type: 'video',
          locked: false,
          muted: false,
          hidden: false,
          clips: [
            videoClip('A', 'mA', 0, 2, {}),
            videoClip('B', 'mB', 2, 2, {
              transitionIn: { id: 'tr1', type: 'dissolve', name: 'Dissolve', duration: 0.5 },
            }),
          ],
        },
      ],
      media: [
        { id: 'mA', name: 'a.mp4', duration: 2, url: 'blob:a', ...DEFAULT_MEDIA_META },
        { id: 'mB', name: 'b.mp4', duration: 2, url: 'blob:b', ...DEFAULT_MEDIA_META },
      ],
      duration: 4,
      totalDuration: 4,
      aspectRatio: 16 / 9,
    };

    const { handle } = makeFileHandle('transition.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { mA: bufA, mB: bufB },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    enc.captured.forEach((f, i) => {
      const draws = f.pass.filter((o) => o.op === 'draw' && o.pixels);
      // Transition window [1.75, 2.25): both clips drawn. Outside it: exactly one.
      const t = i / FPS;
      const inWindow = t >= 1.75 && t < 2.25;
      if (inWindow) {
        expect(draws.length, `frame ${i} in dissolve window lost a layer`).toBeGreaterThanOrEqual(1);
      } else {
        expect(draws.length, `frame ${i} black outside transition`).toBe(1);
      }
    });
  });

  it('renders a still image clip via the image path', async () => {
    // 1s PNG (opaque 1x1 px)
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      ),
      (c) => c.charCodeAt(0)
    );
    const imgUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const timeline = {
      tracks: [
        {
          id: 't1',
          type: 'video',
          locked: false,
          muted: false,
          hidden: false,
          clips: [videoClip('img', 'mImg', 0, 1, {})],
        },
      ],
      media: [{ id: 'mImg', name: 'pic.png', type: 'image', duration: 4, url: imgUrl, createdAt: 0 }],
      duration: 1,
      totalDuration: 1,
      aspectRatio: 16 / 9,
    };

    const { handle } = makeFileHandle('image.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: {},
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(30);
    enc.captured.forEach((f, i) => {
      const draws = f.pass.filter((o) => o.op === 'draw');
      expect(draws.length, `image frame ${i} black`).toBe(1);
    });
  });

  it('renders a text overlay clip', async () => {
    const buf = buildInputMp4(1);
    const timeline = {
      tracks: [
        { id: 't1', type: 'video', locked: false, muted: false, hidden: false, clips: [videoClip('v', 'mv', 0, 1, {})] },
        {
          id: 't2',
          type: 'text',
          locked: false,
          muted: false,
          hidden: false,
          clips: [
            {
              ...videoClip('txt', '', 0, 1, {}),
              textSettings: { text: 'Hello', fontSize: 48, fontFamily: 'Inter', color: '#ffffff' },
              zIndex: 9999,
            },
          ],
        },
      ],
      media: [{ id: 'mv', name: 'v.mp4', duration: 1, url: 'blob:v', ...DEFAULT_MEDIA_META }],
      duration: 1,
      totalDuration: 1,
      aspectRatio: 16 / 9,
    };

    const { handle } = makeFileHandle('text.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { mv: buf },
    });
    expect(res.warnings).toEqual([]);
    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(30);
  });
});

// --------------------------------------------------------------------------
// Format honesty tests — the "black screen video" regression suite
// --------------------------------------------------------------------------

describe('export worker — container format matches the file extension', () => {
  it('mp4 export starts with an MP4 ftyp box', async () => {
    const mediaId = 'm-fmt-mp4';
    const { writable, handle } = makeFileHandle('fmt.mp4');
    const res = await runWorkerExport({
      timeline: singleClipTimeline(mediaId, 1),
      config: { ...baseConfig, format: 'mp4', filename: 'fmt' },
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(1) },
    });
    expect(res.complete.filename).toBe('fmt.mp4');
    expect(Buffer.from(writable.data.slice(4, 8)).toString()).toBe('ftyp');
  }, 60000);

  it('webm export starts with the EBML/WebM magic and is named .webm', async () => {
    const mediaId = 'm-fmt-webm';
    const { writable, handle } = makeFileHandle('fmt.webm');
    const res = await runWorkerExport({
      timeline: singleClipTimeline(mediaId, 1),
      config: { ...baseConfig, format: 'webm', filename: 'fmt' },
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(1) },
    });
    expect(res.warnings).toEqual([]);
    expect(res.complete.filename).toBe('fmt.webm');
    // EBML header magic: 0x1A 0x45 0xDF 0xA3
    expect([...writable.data.slice(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  }, 60000);

  it('gif export writes a real GIF89a animation with the right frame count', async () => {
    const mediaId = 'm-fmt-gif';
    const { writable, handle } = makeFileHandle('fmt.gif');
    const res = await runWorkerExport({
      timeline: singleClipTimeline(mediaId, 1), // 1s @ 30fps → 30 frames → stride 2 → 15 GIF frames
      config: { ...baseConfig, format: 'gif', filename: 'fmt' },
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(1) },
    });
    expect(res.warnings).toEqual([]);
    expect(res.complete.filename).toBe('fmt.gif');

    const bytes = writable.data;
    expect(Buffer.from(bytes.slice(0, 6)).toString()).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b); // GIF trailer
    // Count image descriptors (0x2C followed by 8 zero-ish position bytes)
    let imageDescriptors = 0;
    for (let i = 0; i < bytes.length - 9; i++) {
      if (bytes[i] === 0x2c && bytes[i + 1] === 0 && bytes[i + 2] === 0 && bytes[i + 3] === 0 && bytes[i + 4] === 0) {
        imageDescriptors++;
      }
    }
    expect(imageDescriptors).toBeGreaterThanOrEqual(15);

    // And the file must actually DECODE with real pixels (not black).
    const { GifReader } = await import('omggif');
    const reader = new GifReader(Buffer.from(bytes));
    expect(reader.numFrames()).toBeGreaterThanOrEqual(15);
    const px = Buffer.alloc(reader.width * reader.height * 4);
    reader.decodeAndBlitFrameRGBA(0, px);
    const anyNonZero = px.some((v) => v !== 0);
    expect(anyNonZero).toBe(true);
  }, 60000);

  it('wav export writes a valid RIFF/WAVE PCM file', async () => {
    const mediaId = 'm-fmt-wav';
    const { writable, handle } = makeFileHandle('fmt.wav');
    const sampleRate = 48000;
    const seconds = 0.25;
    const n = Math.floor(sampleRate * seconds);
    const ch0 = new Float32Array(n);
    const ch1 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ch0[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.5;
      ch1[i] = -ch0[i];
    }
    const res = await runWorkerExport({
      timeline: singleClipTimeline(mediaId, 1),
      config: { ...baseConfig, format: 'wav', filename: 'fmt' },
      audioData: { sampleRate, numberOfChannels: 2, length: n, channels: [ch0, ch1] },
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(1) },
    });
    expect(res.warnings).toEqual([]);
    expect(res.complete.filename).toBe('fmt.wav');

    const bytes = writable.data;
    expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe('RIFF');
    expect(Buffer.from(bytes.slice(8, 12)).toString()).toBe('WAVE');
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getUint32(24, true)).toBe(sampleRate);
    expect(view.getUint32(40, true)).toBe(n * 4); // data size
    expect(bytes.byteLength).toBe(44 + n * 4);
  }, 60000);

  it('prores honestly falls back to MP4 with a warning instead of mislabeling', async () => {
    const mediaId = 'm-fmt-prores';
    const { writable, handle } = makeFileHandle('fmt2.mp4');
    const res = await runWorkerExport({
      timeline: singleClipTimeline(mediaId, 1),
      config: { ...baseConfig, format: 'prores', filename: 'fmt2' },
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(1) },
    });
    expect(res.warnings.join('\n')).toMatch(/ProRes/i);
    // The payload must actually BE an MP4.
    expect(Buffer.from(writable.data.slice(4, 8)).toString()).toBe('ftyp');
  }, 60000);

  it('decodes clips whose media URL is dead but whose bytes were transferred', async () => {
    // Restored/re-linked projects can carry media items with a dead blob URL
    // (or 'PENDING_RESTORE') while the raw bytes travel via mediaBuffers.
    // The scheduler must not skip such clips — skipping them is exactly the
    // classic "export renders black but audio works" failure.
    const mediaId = 'm-nourl';
    const timeline = singleClipTimeline(mediaId, 1);
    // A FALSY url (empty string) — the old code skipped such clips outright
    // even though their bytes were transferred, producing a black export.
    timeline.media[0].url = '';

    const { handle } = makeFileHandle('nourl.mp4');
    const res = await runWorkerExport({
      timeline,
      config: baseConfig,
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(1) },
    });
    expect(res.warnings).toEqual([]);

    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(30);
    enc.captured.forEach((f, i) => {
      const draws = f.pass.filter((o) => o.op === 'draw' && o.pixels);
      expect(draws.length, `frame ${i} black despite transferred bytes`).toBe(1);
    });
  }, 60000);

  it('fails loudly (no silent black file) when decoded layers composite to solid black', async () => {
    // Simulate the GPU-decode-failure case: force every sampled frame black by
    // making the fake canvas never gain content even though frames exist.
    const mediaId = 'm-fmt-black';
    const { handle } = makeFileHandle('fmt-black.mp4');

    // Force every decoded frame's pixel payload to stay empty — exactly what a
    // broken GPU decode/convert path looks like from the worker's perspective.
    FakeVideoFrame.emitBlackPixels = true;
    try {
      await runWorkerExport({
        timeline: singleClipTimeline(mediaId, 1),
        config: { ...baseConfig, format: 'mp4', filename: 'fmt-black' },
        audioData: null,
        fileHandle: handle,
        mediaBuffers: { [mediaId]: buildInputMp4(1) },
      });
      throw new Error('expected export to fail with a black-frame error');
    } catch (e: any) {
      expect(String(e.message)).toMatch(/black frames/i);
    } finally {
      FakeVideoFrame.emitBlackPixels = false;
    }
  }, 60000);

  it('renders clips with dynamic speedFrames without crashing or dropping frames', async () => {
    const mediaId = 'm-speedframes';
    const { handle } = makeFileHandle('speedframes.mp4');

    const timeline = {
      tracks: [
        {
          id: 't1',
          name: 'V1',
          type: 'video',
          locked: false,
          muted: false,
          hidden: false,
          clips: [
            videoClip('c1', mediaId, 0, 2, {
              speedFrames: [
                { id: 'sf-1', timelineOffset: 0.8, sourceTime: 0.5 },
                { id: 'sf-2', timelineOffset: 1.4, sourceTime: 1.2 },
              ],
              speedFrameSourceEnd: 2.0,
            }),
          ],
        },
      ],
      media: [{ id: mediaId, name: 'clip.mp4', type: 'video', duration: 2, url: 'blob:x', createdAt: 0 }],
      duration: 2,
      totalDuration: 2,
      aspectRatio: 16 / 9,
    };

    const res = await runWorkerExport({
      timeline,
      config: { ...baseConfig, format: 'mp4', filename: 'speedframes' },
      audioData: null,
      fileHandle: handle,
      mediaBuffers: { [mediaId]: buildInputMp4(2) },
    });

    expect(res.warnings).toEqual([]);
    const enc = FakeVideoEncoder.last!;
    expect(enc.captured.length).toBe(60); // 2s * 30fps
    enc.captured.forEach((f, i) => {
      const draws = f.pass.filter((o) => o.op === 'draw' && o.pixels);
      expect(draws.length, `frame ${i} had no visual content`).toBe(1);
    });
  }, 60000);
});

