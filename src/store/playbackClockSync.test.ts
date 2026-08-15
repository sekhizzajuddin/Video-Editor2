import { describe, it, expect, beforeEach } from 'vitest';
import { getPlaybackTime, setPlaybackTime } from '@/utils/playbackClock';

/**
 * Reproduces the store<->clock interaction without pulling in the real editor
 * store (which drags in IndexedDB, workers and DOM APIs). The logic under test is
 * the guard installed at the bottom of editorStore.ts.
 */
function makeStoreMirror() {
  let lastObserved = 0;
  return function onStoreNotification(storeCurrentTime: number) {
    if (storeCurrentTime === lastObserved) return;
    lastObserved = storeCurrentTime;
    setPlaybackTime(storeCurrentTime);
  };
}

describe('playback clock / store mirroring', () => {
  beforeEach(() => setPlaybackTime(0));

  it('does not drag the clock backwards on unrelated store notifications', () => {
    const notify = makeStoreMirror();

    // Playback loop advances the clock every frame...
    setPlaybackTime(0.016);
    setPlaybackTime(0.033);
    // ...and syncs the store only every ~100ms.
    notify(0.1);
    setPlaybackTime(0.116);
    setPlaybackTime(0.133);

    // An unrelated mutation (e.g. selecting a clip) notifies subscribers while
    // store.currentTime is still the stale 0.1 value.
    notify(0.1);

    // The clock must NOT have been rewound to 0.1.
    expect(getPlaybackTime()).toBe(0.133);
  });

  it('still adopts a genuine external seek', () => {
    const notify = makeStoreMirror();

    setPlaybackTime(5);
    // Undo/snapshot-restore assigns a brand new time directly.
    notify(42);

    expect(getPlaybackTime()).toBe(42);
  });

  it('a throttled sync writing the value the clock already has is a no-op', () => {
    const notify = makeStoreMirror();

    setPlaybackTime(2.5);
    notify(2.5); // seek() already pushed this exact value
    expect(getPlaybackTime()).toBe(2.5);

    setPlaybackTime(2.6);
    expect(getPlaybackTime()).toBe(2.6);
  });
});
