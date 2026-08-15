import { describe, it, expect, vi } from 'vitest';
import { FrameScheduler } from './FrameScheduler';

/**
 * These tests lock in the behaviour of the concurrent-decode change:
 * video layers are now decoded in parallel and therefore resolve out of order,
 * so compositing order must come from the (zIndex, order) sort rather than from
 * the order in which promises happen to settle.
 */

function makeScheduler(timeline: any, decoders: Record<string, any>) {
  const scheduler = new FrameScheduler(timeline, { } as any);
  // Inject fake decoders directly (initializeDecoders() would need real media).
  (scheduler as any).decoders = new Map(Object.entries(decoders));
  return scheduler;
}

/** A decoder whose getFrameAt resolves after `delayMs`. */
function fakeDecoder(id: string, delayMs: number) {
  return {
    rotation: 0,
    getFrameAt: vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ id, close() {} }), delayMs)
        )
    ),
  };
}

describe('FrameScheduler.getLayersAtTime', () => {
  it('composites in zIndex order even when slower decoders resolve last', async () => {
    // trackIdx 0 (bottom) is SLOW, trackIdx 1 (top) is FAST. If we relied on
    // completion order the fast top layer would be composited underneath.
    const timeline = {
      tracks: [
        { type: 'video', clips: [{ id: 'slow', startTime: 0, duration: 10 }] },
        { type: 'video', clips: [{ id: 'fast', startTime: 0, duration: 10 }] },
      ],
    };

    const scheduler = makeScheduler(timeline, {
      slow: fakeDecoder('slow', 30),
      fast: fakeDecoder('fast', 0),
    });

    const layers = await scheduler.getLayersAtTime(1);

    expect(layers).toHaveLength(2);
    expect((layers[0].frame as any).id).toBe('slow'); // zIndex 0 first
    expect((layers[1].frame as any).id).toBe('fast'); // zIndex 1 on top
  });

  it('decodes tracks concurrently rather than serially', async () => {
    const timeline = {
      tracks: [
        { type: 'video', clips: [{ id: 'a', startTime: 0, duration: 10 }] },
        { type: 'video', clips: [{ id: 'b', startTime: 0, duration: 10 }] },
        { type: 'video', clips: [{ id: 'c', startTime: 0, duration: 10 }] },
      ],
    };

    const scheduler = makeScheduler(timeline, {
      a: fakeDecoder('a', 40),
      b: fakeDecoder('b', 40),
      c: fakeDecoder('c', 40),
    });

    const start = Date.now();
    const layers = await scheduler.getLayersAtTime(1);
    const elapsed = Date.now() - start;

    expect(layers).toHaveLength(3);
    // Serial would be ~120ms; concurrent should be close to the slowest single
    // decode (~40ms). Generous bound to stay stable on loaded CI machines.
    expect(elapsed).toBeLessThan(100);
  });

  it('skips hidden tracks and disabled clips', async () => {
    const timeline = {
      tracks: [
        { type: 'video', hidden: true, clips: [{ id: 'hidden', startTime: 0, duration: 10 }] },
        { type: 'video', clips: [{ id: 'off', startTime: 0, duration: 10, disabled: true }] },
        { type: 'video', clips: [{ id: 'on', startTime: 0, duration: 10 }] },
      ],
    };

    const scheduler = makeScheduler(timeline, {
      hidden: fakeDecoder('hidden', 0),
      off: fakeDecoder('off', 0),
      on: fakeDecoder('on', 0),
    });

    const layers = await scheduler.getLayersAtTime(1);
    expect(layers).toHaveLength(1);
    expect((layers[0].frame as any).id).toBe('on');
  });

  it('excludes clips that are not active at the timestamp', async () => {
    const timeline = {
      tracks: [
        { type: 'video', clips: [{ id: 'early', startTime: 0, duration: 2 }] },
        { type: 'video', clips: [{ id: 'late', startTime: 5, duration: 5 }] },
      ],
    };

    const scheduler = makeScheduler(timeline, {
      early: fakeDecoder('early', 0),
      late: fakeDecoder('late', 0),
    });

    const layers = await scheduler.getLayersAtTime(6);
    expect(layers).toHaveLength(1);
    expect((layers[0].frame as any).id).toBe('late');
  });

  it('one failing decoder does not drop the rest of the frame', async () => {
    const timeline = {
      tracks: [
        { type: 'video', clips: [{ id: 'bad', startTime: 0, duration: 10 }] },
        { type: 'video', clips: [{ id: 'good', startTime: 0, duration: 10 }] },
      ],
    };

    const scheduler = makeScheduler(timeline, {
      bad: { rotation: 0, getFrameAt: vi.fn(() => Promise.reject(new Error('decode failed'))) },
      good: fakeDecoder('good', 0),
    });

    const layers = await scheduler.getLayersAtTime(1);
    expect(layers).toHaveLength(1);
    expect((layers[0].frame as any).id).toBe('good');
  });
});
