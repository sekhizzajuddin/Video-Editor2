import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExecutionStreamer } from './ExecutionStreamer';

describe('ExecutionStreamer', () => {
  it('emits stream_start on start()', () => {
    const events: any[] = [];
    const streamer = new ExecutionStreamer({
      onEvent: (e) => events.push(e),
    });
    streamer.start(5);
    expect(events[0].type).toBe('stream_start');
    expect(events[0].data.totalSteps).toBe(5);
  });

  it('emits thinking_chunk events with growing prefix', async () => {
    vi.useFakeTimers();
    const chunks: string[] = [];
    const streamer = new ExecutionStreamer({
      onEvent: (e) => {
        if (e.type === 'thinking_chunk') chunks.push(e.data.chunk);
      },
      tokenCharRate: 1000, // very fast
    });
    streamer.start(1);
    streamer.emitComplete({
      planId: 'p',
      totalSteps: 1,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalDurationMs: 1,
      summary: 'ok',
      steps: [],
    });

    // Allow the typewriter interval to tick
    await vi.runAllTimersAsync();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1].length).toBeGreaterThan(2);
    vi.useRealTimers();
  });

  it('throttleConsumer coalesces rapid calls', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const lastArgs: any[] = [];
    const fn = (val: string) => {
      callCount++;
      lastArgs.push(val);
    };
    const throttled = ExecutionStreamer.throttleConsumer(fn, 100);
    throttled('a');
    throttled('b');
    throttled('c');
    throttled('d');
    expect(callCount).toBe(0); // not invoked yet

    await vi.advanceTimersByTimeAsync(100);
    expect(callCount).toBe(1); // only one call
    expect(lastArgs[lastArgs.length - 1]).toBe('d'); // last value
    vi.useRealTimers();
  });
});
