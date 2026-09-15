import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, TimelineTrack } from '@/types';

describe('Dynamic Speed Stretch (Dynamic Speed Ramping)', () => {
  beforeEach(() => {
    // Reset store to a clean test state with a single video track and a 10-second clip
    const testClip: TimelineClip = {
      id: 'test-clip-1',
      trackId: 'track-video-1',
      mediaId: 'media-1',
      startTime: 0,
      duration: 10,
      speed: 1,
      trimStart: 0,
      trimEnd: 0,
    };

    const testTrack: TimelineTrack = {
      id: 'track-video-1',
      name: 'Video 1',
      type: 'video',
      clips: [testClip],
      muted: false,
      visible: true,
      locked: false,
    };

    useEditorStore.setState({
      tracks: [testTrack],
      selectedClipId: 'test-clip-1',
      selectedClipIds: ['test-clip-1'],
      currentTime: 3,
      dynamicStretch: {
        isActive: false,
        clipId: null,
        trackId: null,
        markStart: 0,
        markEnd: 0,
        isConfirmed: false,
        originalRegionDuration: 0,
        stretchedDuration: 0,
        maintainDuration: true,
        isLoopingRegion: false,
      },
      history: [],
      historyIndex: -1,
    });
  });

  it('starts dynamic stretch marking on target clip with default bounds and maintainDuration ON', () => {
    const store = useEditorStore.getState();
    store.startDynamicStretch('test-clip-1');

    const state = useEditorStore.getState().dynamicStretch;
    expect(state.isActive).toBe(true);
    expect(state.clipId).toBe('test-clip-1');
    expect(state.maintainDuration).toBe(true);
    expect(state.isConfirmed).toBe(false);
    expect(state.markStart).toBeGreaterThanOrEqual(0);
    expect(state.markEnd).toBeLessThanOrEqual(10);
    expect(state.markEnd).toBeGreaterThan(state.markStart);
    expect(state.stretchedDuration).toBeCloseTo(state.markEnd - state.markStart, 4);
  });

  it('updates mark bounds without mutating timeline tracks or creating history', () => {
    const store = useEditorStore.getState();
    store.startDynamicStretch('test-clip-1');
    store.updateDynamicStretchMark({ markStart: 2, markEnd: 6 });

    const state = useEditorStore.getState().dynamicStretch;
    expect(state.markStart).toBe(2);
    expect(state.markEnd).toBe(6);
    expect(state.originalRegionDuration).toBe(4);
    expect(state.stretchedDuration).toBe(4);

    // Track clip is untouched during marking
    const track = useEditorStore.getState().tracks[0];
    expect(track.clips.length).toBe(1);
    expect(track.clips[0].duration).toBe(10);
  });

  it('confirms mark and allows stretch dragging without history spam', () => {
    const store = useEditorStore.getState();
    store.startDynamicStretch('test-clip-1');
    store.updateDynamicStretchMark({ markStart: 2, markEnd: 6 }); // 4s region
    store.confirmDynamicStretchMark();

    expect(useEditorStore.getState().dynamicStretch.isConfirmed).toBe(true);

    // User drags to squeeze region from 4s down to 2s (2x speed)
    store.updateDynamicStretchDrag(2.0);

    const state = useEditorStore.getState().dynamicStretch;
    expect(state.stretchedDuration).toBe(2.0);
    expect(state.originalRegionDuration).toBe(4.0);

    // History should not have been spammed during drag
    expect(useEditorStore.getState().history.length).toBe(0);
  });

  it('applies stretch with maintainDuration=true: preserves overall clip duration by compensating tail speed', () => {
    const store = useEditorStore.getState();
    store.startDynamicStretch('test-clip-1');
    store.updateDynamicStretchMark({ markStart: 2, markEnd: 6 }); // Head: 2s (0..2), Marked: 4s (2..6), Tail: 4s (6..10)
    store.confirmDynamicStretchMark();

    // Squeeze marked region from 4s to 2s (2.0x speed)
    store.updateDynamicStretchDrag(2.0);
    store.applyDynamicStretch();

    const track = useEditorStore.getState().tracks[0];
    // Sliced into 0 splits — clip is preserved as single clip with embedded speed frames!
    expect(track.clips.length).toBe(1);

    const clip = track.clips[0];
    expect(clip.speedFrames).toBeDefined();
    expect(clip.speedFrames!.length).toBe(2);

    // Speed frame 1 at 2s, Speed frame 2 moved from 6s to 4s (squeezed 4s to 2s -> 2.0x)
    expect(clip.speedFrames![0].timelineOffset).toBeCloseTo(2, 4);
    expect(clip.speedFrames![1].timelineOffset).toBeCloseTo(4, 4);

    // Dynamic stretch is now deactivated and mark vanished
    expect(useEditorStore.getState().dynamicStretch.isActive).toBe(false);

    // History snapshot created on apply
    expect(useEditorStore.getState().history.length).toBeGreaterThan(0);
  });

  it('applies stretch with maintainDuration=false: ripples downstream clips', () => {
    // Add a second downstream clip on the same track
    const secondClip: TimelineClip = {
      id: 'clip-downstream',
      trackId: 'track-video-1',
      mediaId: 'media-2',
      startTime: 12,
      duration: 5,
      speed: 1,
    };

    useEditorStore.setState((s) => ({
      tracks: [{
        ...s.tracks[0],
        clips: [...s.tracks[0].clips, secondClip],
      }],
    }));

    const store = useEditorStore.getState();
    store.startDynamicStretch('test-clip-1');
    store.setDynamicStretchMaintainDuration(false);
    store.updateDynamicStretchMark({ markStart: 2, markEnd: 6 }); // 4s marked
    store.confirmDynamicStretchMark();

    // Extend marked region from 4s to 8s (slow down, +4s duration)
    store.updateDynamicStretchDrag(8.0);
    store.applyDynamicStretch();

    const track = useEditorStore.getState().tracks[0];
    const downstream = track.clips.find((c) => c.id === 'clip-downstream');
    expect(downstream).toBeDefined();

    // Downstream clip was shifted from 12 to 16 (+4s)
    expect(downstream!.startTime).toBeCloseTo(16, 4);
  });
});
