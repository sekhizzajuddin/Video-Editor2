import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './editorStore';
import { getEffectivePreviewTime, getPlaybackTime, getTrimPreviewTime, setIsPlayingClock, setTrimPreviewTime } from '@/utils/playbackClock';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import type { TimelineClip, TimelineTrack } from '@/types';

const currentClip = () => useEditorStore.getState().tracks[0].clips[0];

function expectClocksAt(time: number) {
  expect(useEditorStore.getState().currentTime).toBeCloseTo(time, 8);
  expect(getPlaybackTime()).toBeCloseTo(time, 8);
  expect(getEffectivePreviewTime()).toBeCloseTo(time, 8);
}

describe('Speed Frame editing before export', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // Do not run the unrelated IndexedDB auto-save timer.
    setIsPlayingClock(false);
    setTrimPreviewTime(null);
    const clip = {
      id: 'clip', mediaId: 'media', trackId: 'video', startTime: 2,
      duration: 10, trimStart: 1, trimEnd: 1, speed: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }, opacity: 1, effects: [],
    } as TimelineClip;
    const tracks = [{ id: 'video', type: 'video', clips: [clip], hidden: false }] as TimelineTrack[];
    useEditorStore.setState({
      tracks, mediaLibrary: [{ id: 'media', type: 'video', duration: 12 } as any],
      pipWindows: {}, subtitles: [], markers: [], beatMarkers: [], exportRegions: [],
      isPlaying: false, isScrubbing: false, selectedSpeedFrame: null,
      history: [], historyIndex: -1, totalDuration: 12,
    });
    useEditorStore.getState().seek(0);
    useEditorStore.getState().saveSnapshot('Initial');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    setTrimPreviewTime(null);
  });

  it('adding/selecting a marker keeps the store and live preview at the same time', () => {
    const store = useEditorStore.getState();
    store.addSpeedFrame('clip', 4);
    expectClocksAt(6);
    expect(getTrimPreviewTime()).toBeNull();
    const frame = currentClip().speedFrames![0];
    expect(frame.sourceTime).toBe(5);
    expect(useEditorStore.getState().history.at(-1)!.currentTime).toBe(6);

    store.seek(0);
    store.selectSpeedFrame('clip', frame.id);
    expectClocksAt(6);
    // Export opens with these UI-only mutations; neither may seek us back to 0.
    store.selectSpeedFrame(null, null);
    useEditorStore.setState({ hasUnsavedChanges: false });
    expectClocksAt(6);
    expect(getMediaTimeForClip(currentClip(), getPlaybackTime())).toBe(5);
  });

  it.each(['line', 'screw'] as const)('commits a %s drag once, with the final preview time and undo/redo intact', (kind) => {
    const store = useEditorStore.getState();
    store.addSpeedFrame('clip', 4);
    const frameId = currentClip().speedFrames![0].id;
    const historyBeforeDrag = useEditorStore.getState().history.length;
    const update = kind === 'line' ? store.updateSpeedFrameLine : store.updateSpeedFrameScrew;

    for (let i = 1; i <= 100; i++) update('clip', frameId, 4 + i / 100);
    expect(useEditorStore.getState().history).toHaveLength(historyBeforeDrag);
    expect(getTrimPreviewTime()).toBeCloseTo(7);
    store.commitSpeedFrameDrag();
    expectClocksAt(7);
    expect(getTrimPreviewTime()).toBeNull();
    expect(useEditorStore.getState().history).toHaveLength(historyBeforeDrag + 1);
    expect(useEditorStore.getState().history.at(-1)!.currentTime).toBe(7);

    store.undo();
    expectClocksAt(6);
    expect(currentClip().speedFrames![0].timelineOffset).toBe(4);
    store.redo();
    expectClocksAt(7);
    expect(currentClip().speedFrames![0].timelineOffset).toBe(5);
  });

  it('repeated small edits produce the same source-frame mapping as a reloaded project', () => {
    const store = useEditorStore.getState();
    store.addSpeedFrame('clip', 4);
    const frameId = currentClip().speedFrames![0].id;

    for (const offset of [5, 5.05, 4.9, 5.1]) {
      store.selectSpeedFrame('clip', frameId);
      store.updateSpeedFrameLine('clip', frameId, offset);
      store.commitSpeedFrameDrag();
      store.selectSpeedFrame(null, null);
      expectClocksAt(2 + offset);

      const liveClip = currentClip();
      const reloadedClip = JSON.parse(JSON.stringify(liveClip));
      for (let t = liveClip.startTime; t < liveClip.startTime + liveClip.duration; t += 1 / 30) {
        const liveSource = getMediaTimeForClip(liveClip, t);
        expect(Number.isFinite(liveSource)).toBe(true);
        expect(liveSource).toBeCloseTo(getMediaTimeForClip(reloadedClip, t), 8);
      }
    }
    expect(useEditorStore.getState().history).toHaveLength(6); // initial + add + four drags
  });
});
