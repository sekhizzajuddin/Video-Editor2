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

  it('clears ring buffer on request', () => {
    (player as any).clipBuffers.set('clip_2', {
      clipId: 'clip_2',
      mediaId: 'media_2',
      frames: [],
      lastAccessTime: performance.now(),
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
