import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './editorStore';
import {
  buildSplitIdentities,
  planDecodeStreams,
  sourceWindowForClip,
  splitChainSiblings,
} from '@/utils/splitClipIdentity';
import type { TimelineClip, TimelineTrack } from '@/types';

/**
 * Store-level contract of the Split Clip ID Provider: every half produced by
 * `splitClip` must be identifiable as part of ONE chain (same `splitGroupId`,
 * ordered `splitSegmentIndex`) and must continue the source exactly where the
 * previous half stopped. The preview and the export worker derive their decode
 * identities from this, so a broken index here shows up as rendering stutter.
 */

const makeClip = (overrides: Partial<TimelineClip> = {}): TimelineClip =>
  ({
    id: 'clip',
    mediaId: 'media',
    trackId: 'video',
    startTime: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    opacity: 1,
    effects: [],
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    ...overrides,
  }) as TimelineClip;

const tracksOf = (): TimelineTrack[] => useEditorStore.getState().tracks;

function seed(clips: TimelineClip[], extraTracks: TimelineTrack[] = []) {
  useEditorStore.setState({
    tracks: [
      { id: 'video', type: 'video', clips, hidden: false } as TimelineTrack,
      ...extraTracks,
    ],
    mediaLibrary: [{ id: 'media', type: 'video', duration: 12, url: 'blob:x' } as any],
    pipWindows: {},
    subtitles: [],
    markers: [],
    beatMarkers: [],
    exportRegions: [],
    isPlaying: false,
    isScrubbing: false,
    selectedSpeedFrame: null,
    history: [],
    historyIndex: -1,
    totalDuration: 12,
  });
}

describe('store splitClip → Split Clip ID Provider', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // keep the IndexedDB auto-save timer out of the test
    seed([makeClip({ id: 'c1', mediaId: 'media', duration: 4, trimStart: 1 })]);
    useEditorStore.getState().seek(0);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('stamps both halves with one chain id and ordered segment indexes', () => {
    useEditorStore.getState().splitClip('c1', 2);

    const clips = tracksOf()[0].clips;
    expect(clips).toHaveLength(2);

    const [left, right] = [...clips].sort((a, b) => a.startTime - b.startTime);
    expect(left.splitGroupId).toBeTruthy();
    expect(right.splitGroupId).toBe(left.splitGroupId);
    expect(left.splitSegmentIndex).toBe(0);
    expect(right.splitSegmentIndex).toBe(1);
    expect(left.startTime).toBeCloseTo(0, 6);
    expect(left.duration).toBeCloseTo(2, 6);
    expect(right.startTime).toBeCloseTo(2, 6);
    expect(right.duration).toBeCloseTo(2, 6);
  });

  it('keeps the source window continuous across the cut', () => {
    useEditorStore.getState().splitClip('c1', 2);
    const [left, right] = [...tracksOf()[0].clips].sort((a, b) => a.startTime - b.startTime);

    // The left half stops exactly where the right half starts (trimStart 1 + 2 s).
    expect(sourceWindowForClip(left).start).toBeCloseTo(1, 6);
    expect(sourceWindowForClip(left).end).toBeCloseTo(3, 6);
    expect(sourceWindowForClip(right).start).toBeCloseTo(3, 6);
    expect(sourceWindowForClip(right).end).toBeCloseTo(5, 6);
  });

  it('re-numbers the whole chain when one half is split again', () => {
    useEditorStore.getState().splitClip('c1', 2);
    const right = [...tracksOf()[0].clips].sort((a, b) => a.startTime - b.startTime)[1];
    useEditorStore.getState().splitClip(right.id, 3);

    const clips = [...tracksOf()[0].clips].sort((a, b) => a.startTime - b.startTime);
    expect(clips).toHaveLength(3);

    const chainIds = new Set(clips.map((c) => c.splitGroupId));
    expect(chainIds.size).toBe(1);
    expect(clips.map((c) => c.splitSegmentIndex)).toEqual([0, 1, 2]);
    // Still a single continuous run of source.
    expect(sourceWindowForClip(clips[0]).end).toBeCloseTo(sourceWindowForClip(clips[1]).start, 6);
    expect(sourceWindowForClip(clips[1]).end).toBeCloseTo(sourceWindowForClip(clips[2]).start, 6);
  });

  it('exposes the chain as a shareable, single-stream chain to the renderers', () => {
    useEditorStore.getState().splitClip('c1', 2);
    const timeline = { tracks: tracksOf() };

    const identities = buildSplitIdentities(timeline);
    for (const clip of tracksOf()[0].clips) {
      const identity = identities.get(clip.id)!;
      expect(identity.shareableElement).toBe(true);
      expect(identity.shareKey).toBe(`media::chain:${clip.splitGroupId}::track:video`);
    }

    // Preview/export agree: the chain is ONE decode stream.
    const plan = planDecodeStreams(timeline);
    expect(plan.streams).toHaveLength(1);
    expect(new Set(plan.streams[0].clipIds)).toEqual(new Set(tracksOf()[0].clips.map((c) => c.id)));
    expect(plan.streams[0].shared).toBe(false);

    // Siblings are discoverable in timeline order.
    const first = [...tracksOf()[0].clips].sort((a, b) => a.startTime - b.startTime)[0];
    expect(splitChainSiblings(timeline, first.id).map((c) => c.id)).toHaveLength(1);
  });

  it('stops sharing (and stops promising one decode stream) once a segment moves to another track', () => {
    useEditorStore.getState().splitClip('c1', 2);
    const [left, right] = [...tracksOf()[0].clips].sort((a, b) => a.startTime - b.startTime);

    // Drag the right half onto a second video track that overlaps in time —
    // the shape that used to interleave two source windows through one decoder.
    seed(
      [{ ...left, trackId: 'video' }],
      [{ id: 'video2', type: 'video', hidden: false, clips: [{ ...right, trackId: 'video2', startTime: 0 }] } as TimelineTrack],
    );

    const timeline = { tracks: tracksOf() };
    const identities = buildSplitIdentities(timeline);
    const rightIdentity = identities.get(right.id)!;
    expect(rightIdentity.shareableElement).toBe(false);
    expect(rightIdentity.shareKey).toBe(`media::clip:${right.id}`);

    // Two simultaneous source windows → two decoders, no rewinds.
    const plan = planDecodeStreams(timeline);
    expect(plan.streams).toHaveLength(2);
    expect(plan.byClip.get(left.id)!.id).not.toBe(plan.byClip.get(right.id)!.id);
  });
});
