import { describe, it, expect, beforeEach } from 'vitest';
import { getPlaybackTime, setPlaybackTime, subscribePlaybackTime } from './playbackClock';

describe('playbackClock', () => {
  beforeEach(() => {
    setPlaybackTime(0);
  });

  it('stores and returns the exact time', () => {
    setPlaybackTime(12.3456);
    expect(getPlaybackTime()).toBe(12.3456);
  });

  it('clamps negative times to zero', () => {
    setPlaybackTime(-5);
    expect(getPlaybackTime()).toBe(0);
  });

  it('notifies subscribers on change', () => {
    const seen: number[] = [];
    const unsub = subscribePlaybackTime((t) => seen.push(t));

    setPlaybackTime(1);
    setPlaybackTime(2);
    unsub();
    setPlaybackTime(3);

    expect(seen).toEqual([1, 2]);
    // Value still updates after unsubscribe, we just stop being told about it.
    expect(getPlaybackTime()).toBe(3);
  });

  it('does not notify when the value is unchanged (no redundant work at 60Hz)', () => {
    setPlaybackTime(5);
    let calls = 0;
    const unsub = subscribePlaybackTime(() => calls++);

    setPlaybackTime(5);
    setPlaybackTime(5);
    expect(calls).toBe(0);

    setPlaybackTime(5.0001);
    expect(calls).toBe(1);

    unsub();
  });

  it('a throwing subscriber cannot break playback for others', () => {
    const seen: number[] = [];
    const unsubBad = subscribePlaybackTime(() => {
      throw new Error('boom');
    });
    const unsubGood = subscribePlaybackTime((t) => seen.push(t));

    expect(() => setPlaybackTime(7)).not.toThrow();
    expect(seen).toEqual([7]);

    unsubBad();
    unsubGood();
  });
});
