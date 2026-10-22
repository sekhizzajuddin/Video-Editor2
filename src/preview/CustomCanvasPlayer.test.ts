import { describe, it, expect, beforeEach } from 'vitest';
import { CustomCanvasPlayer, customCanvasPlayer } from './CustomCanvasPlayer';

describe('CustomCanvasPlayer', () => {
  let player: CustomCanvasPlayer;

  beforeEach(() => {
    player = new CustomCanvasPlayer();
  });

  it('instantiates and provides support flag', () => {
    expect(player).toBeDefined();
    expect(typeof player.isSupported).toBe('boolean');
  });

  it('manages ring buffers and returns frames synchronously', () => {
    const dummyCanvas = {} as any;
    // Inject mock buffer
    (player as any).clipBuffers.set('clip_1', {
      clipId: 'clip_1',
      mediaId: 'media_1',
      frames: [
        {
          drawable: dummyCanvas,
          width: 1920,
          height: 1080,
          timestamp: 1.0,
          duration: 0.033,
        },
        {
          drawable: dummyCanvas,
          width: 1920,
          height: 1080,
          timestamp: 1.033,
          duration: 0.033,
        },
      ],
      lastReturnedFrame: null,
      lastAccessTime: performance.now(),
    });

    const frame = player.getFrameSync('clip_1', 1.01);
    expect(frame).not.toBeNull();
    expect(frame?.timestamp).toBe(1.0);

    const frame2 = player.getFrameSync('clip_1', 1.04);
    expect(frame2).not.toBeNull();
    expect(frame2?.timestamp).toBe(1.033);

    const missing = player.getFrameSync('non_existent', 1.0);
    expect(missing).toBeNull();
  });

  it('guarantees continuous hold-frame presentation (no flickering)', () => {
    const dummyCanvas = {} as any;
    const stream = {
      clipId: 'clip_v1',
      mediaId: 'media_v1',
      frames: [
        {
          drawable: dummyCanvas,
          width: 1920,
          height: 1080,
          timestamp: 2.0,
          duration: 0.033,
        },
      ],
      lastReturnedFrame: null,
      lastAccessTime: performance.now(),
    };
    (player as any).clipBuffers.set('clip_v1', stream);

    // Initial frame lookup
    const f1 = player.getFrameSync('clip_v1', 2.01);
    expect(f1?.timestamp).toBe(2.0);

    // If buffer is temporarily drained/underrun during in-flight decode,
    // getFrameSync must hold the last valid frame instead of returning null
    stream.frames = [];
    const f2 = player.getFrameSync('clip_v1', 2.05);
    expect(f2).not.toBeNull();
    expect(f2?.timestamp).toBe(2.0);
  });

  it('handles multi-track clips simultaneously without interference', () => {
    const dummyCanvas1 = { id: 1 } as any;
    const dummyCanvas2 = { id: 2 } as any;

    // Track 1 clip
    (player as any).clipBuffers.set('clip_v1', {
      clipId: 'clip_v1',
      mediaId: 'media_shared',
      frames: [
        { drawable: dummyCanvas1, width: 1920, height: 1080, timestamp: 10.0, duration: 0.033 },
      ],
      lastReturnedFrame: null,
      lastAccessTime: performance.now(),
    });

    // Track 2 overlay (B-roll) clip using same or different media at different timestamp
    (player as any).clipBuffers.set('clip_v2', {
      clipId: 'clip_v2',
      mediaId: 'media_shared',
      frames: [
        { drawable: dummyCanvas2, width: 1920, height: 1080, timestamp: 1.5, duration: 0.033 },
      ],
      lastReturnedFrame: null,
      lastAccessTime: performance.now(),
    });

    const fV1 = player.getFrameSync('clip_v1', 10.01);
    const fV2 = player.getFrameSync('clip_v2', 1.51);

    expect(fV1).not.toBeNull();
    expect(fV1?.timestamp).toBe(10.0);
    expect(fV2).not.toBeNull();
    expect(fV2?.timestamp).toBe(1.5);
  });

  it('clears ring buffer on request', () => {
    (player as any).clipBuffers.set('clip_2', {
      clipId: 'clip_2',
      mediaId: 'media_2',
      input: null,
      sink: null,
      iterator: null,
      frames: [],
      lastReturnedFrame: null,
      lastAccessTime: performance.now(),
      disposed: false,
    });
    expect((player as any).clipBuffers.has('clip_2')).toBe(true);
    player.clearClipBuffer('clip_2');
    expect((player as any).clipBuffers.has('clip_2')).toBe(false);
  });

  it('provides diagnostics summary', () => {
    const diag = player.getDiagnostics();
    expect(diag).toHaveProperty('decoderCount');
    expect(diag).toHaveProperty('activeBuffers');
    expect(diag).toHaveProperty('totalBufferedFrames');
    expect(Array.isArray(diag.decoders)).toBe(true);
  });
});
