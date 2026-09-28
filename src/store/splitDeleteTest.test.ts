import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import type { TimelineClip, TimelineTrack } from '@/types';

describe('Split clip and delete middle part', () => {
  beforeEach(() => {
    const clip: TimelineClip = {
      id: 'clip_orig',
      mediaId: 'media_1',
      trackId: 'track_1',
      startTime: 0,
      duration: 12,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      effects: [],
    };
    const tracks: TimelineTrack[] = [
      { id: 'track_1', type: 'video', clips: [clip], hidden: false }
    ];
    useEditorStore.setState({
      tracks,
      mediaLibrary: [{ id: 'media_1', type: 'video', duration: 12, url: 'blob:test' } as any],
      selectedClipId: null,
      selectedClipIds: [],
      activeTool: 'select',
      currentTime: 0,
      history: [],
      historyIndex: -1,
    });
  });

  it('splits clip twice and removes middle clip in select mode (gap remaining)', () => {
    const store = useEditorStore.getState();
    // 1. First split at 3s
    store.splitClip('clip_orig', 3);
    let clips = useEditorStore.getState().tracks[0].clips;
    expect(clips).toHaveLength(2);
    const rightId = clips[1].id;

    // 2. Second split on the right clip at 7s
    store.splitClip(rightId, 7);
    clips = useEditorStore.getState().tracks[0].clips;
    expect(clips).toHaveLength(3);
    const middleId = clips[1].id;

    // 3. Delete middle clip
    store.removeClip(middleId);
    clips = useEditorStore.getState().tracks[0].clips;
    expect(clips).toHaveLength(2);

    // Both remaining clips must have splitGroupId cleared
    expect(clips[0].splitGroupId).toBeUndefined();
    expect(clips[1].splitGroupId).toBeUndefined();
  });

  it('splits clip twice and ripple-deletes middle clip (adjacent on timeline but discontinuous in media)', () => {
    const store = useEditorStore.getState();
    useEditorStore.setState({ activeTool: 'ripple' });

    // 1. First split at 3s
    store.splitClip('clip_orig', 3);
    let clips = useEditorStore.getState().tracks[0].clips;
    const rightId = clips[1].id;

    // 2. Second split at 7s
    store.splitClip(rightId, 7);
    clips = useEditorStore.getState().tracks[0].clips;
    const middleId = clips[1].id;

    // 3. Ripple delete middle clip
    store.removeClip(middleId);
    clips = useEditorStore.getState().tracks[0].clips;
    expect(clips).toHaveLength(2);

    // Timeline positions touch at 3s, but media is discontinuous (trimStart 0 vs 7)
    expect(clips[0].startTime + clips[0].duration).toBe(clips[1].startTime);
    expect(clips[0].splitGroupId).toBeUndefined();
    expect(clips[1].splitGroupId).toBeUndefined();
  });

  it('splits clip 3 times (4 pieces) and deletes piece 2: pieces 3 & 4 remain grouped while piece 1 is detached', () => {
    const store = useEditorStore.getState();

    // Split at 2s, 4s, 8s -> 4 clips: [0-2], [2-4], [4-8], [8-12]
    store.splitClip('clip_orig', 2);
    let clips = useEditorStore.getState().tracks[0].clips;
    store.splitClip(clips[1].id, 4);
    clips = useEditorStore.getState().tracks[0].clips;
    store.splitClip(clips[2].id, 8);
    clips = useEditorStore.getState().tracks[0].clips;
    expect(clips).toHaveLength(4);

    const piece2Id = clips[1].id; // 2s to 4s
    store.removeClip(piece2Id);

    clips = useEditorStore.getState().tracks[0].clips;
    expect(clips).toHaveLength(3);

    // Piece 1 is detached
    expect(clips[0].splitGroupId).toBeUndefined();

    // Pieces 3 and 4 are still adjacent and media-contiguous, so they share a splitGroupId
    expect(clips[1].splitGroupId).toBeDefined();
    expect(clips[2].splitGroupId).toBeDefined();
    expect(clips[1].splitGroupId).toBe(clips[2].splitGroupId);
  });
});
