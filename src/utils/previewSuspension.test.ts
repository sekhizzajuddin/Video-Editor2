import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPreviewSuspendedForExport, subscribePreviewSuspension, suspendPreviewForExport } from './previewSuspension';

const cleanup: Array<() => void> = [];
const suspend = () => {
  const release = suspendPreviewForExport();
  cleanup.push(release);
  return release;
};
const subscribe = (fn: () => void) => {
  const unsubscribe = subscribePreviewSuspension(fn);
  cleanup.push(unsubscribe);
  return unsubscribe;
};

afterEach(() => {
  cleanup.splice(0).reverse().forEach(fn => fn());
  expect(isPreviewSuspendedForExport()).toBe(false);
  vi.restoreAllMocks();
});

describe('preview resource ownership during worker export', () => {
  it('notifies synchronously before export opens its own decoders', () => {
    const states: boolean[] = [];
    subscribe(() => states.push(isPreviewSuspendedForExport()));
    const release = suspend();
    expect(states).toEqual([true]);
    release();
    expect(states).toEqual([true, false]);
    release(); // fallback + finally + unmount must not resume more than once
    expect(states).toEqual([true, false]);
  });

  it('does not resume while another export still owns a lease', () => {
    const listener = vi.fn();
    subscribe(listener);
    const first = suspend();
    const second = suspend();
    first();
    expect(isPreviewSuspendedForExport()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    second();
    expect(isPreviewSuspendedForExport()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('allows unsubscription and isolates a failing preview listener', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const removed = vi.fn();
    subscribe(removed)();
    subscribe(() => { throw new Error('detached media element'); });
    const remaining = vi.fn();
    subscribe(remaining);
    const release = suspend();
    release();
    expect(removed).not.toHaveBeenCalled();
    expect(remaining).toHaveBeenCalledTimes(2);
  });
});
