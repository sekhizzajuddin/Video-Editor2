import { describe, it, expect } from 'vitest';
import {
  buildSplitIdentities,
  planDecodeStreams,
  restampSplitChains,
  renderKeyForClip,
  sourceWindowForClip,
  splitChainSiblings,
  adjacentSplitSibling,
  canShareDecodeStream,
  shareKeyForClip,
  type SplitIdentityClip,
} from './splitClipIdentity';

/**
 * The Split Clip ID Provider is what keeps the preview's `<video>` elements, the
 * export worker's decoders and the caches in sync after a split. These tests lock
 * in the rules that make "one clip becomes N clips" behave like one continuous
 * source wherever that is safe, and like N independent clips wherever it is not.
 */

function clip(overrides: Partial<SplitIdentityClip> & { id: string }): SplitIdentityClip {
  return {
    mediaId: 'm1',
    trackId: 't1',
    startTime: 0,
    duration: 2,
    trimStart: 0,
    speed: 1,
    ...overrides,
  };
}

describe('sourceWindowForClip', () => {
  it('maps a flat clip to its trimmed source window', () => {
    const window = sourceWindowForClip(clip({ id: 'a', startTime: 4, duration: 2, trimStart: 10 }));
    expect(window.start).toBeCloseTo(10, 6);
    expect(window.end).toBeCloseTo(12, 6);
    expect(window.reversed).toBe(false);
  });

  it('accounts for speed', () => {
    const window = sourceWindowForClip(clip({ id: 'a', duration: 2, trimStart: 1, speed: 2 }));
    expect(window.start).toBeCloseTo(1, 6);
    expect(window.end).toBeCloseTo(5, 6);
  });

  it('reports reversed clips with a normalised [start, end] window', () => {
    const window = sourceWindowForClip(clip({ id: 'a', duration: 2, trimStart: 3, isReversed: true }));
    expect(window.start).toBeCloseTo(3, 6);
    expect(window.end).toBeCloseTo(5, 6);
    expect(window.reversed).toBe(true);
  });

  it('collapses frozen clips to a single timestamp', () => {
    const window = sourceWindowForClip(clip({ id: 'a', duration: 3, trimStart: 1, freezeFrame: 4.5 }));
    expect(window.start).toBe(4.5);
    expect(window.end).toBe(4.5);
    expect(window.frozen).toBe(true);
  });

  it('stays continuous across the split point of a ramped clip', () => {
    const start = clip({
      id: 'ramped',
      startTime: 0,
      duration: 4,
      trimStart: 0,
      speedRamp: [
        { id: 'k0', sourceTime: 0, speed: 1, easing: 'linear' },
        { id: 'k1', sourceTime: 4, speed: 2, easing: 'linear' },
      ],
    });
    const left = { ...start, duration: 2 };
    const right = { ...start, id: 'ramped-r', startTime: 2, duration: 2, trimStart: sourceWindowForClip(left).end };
    // The left half ends where the right half begins: no gap, no overlap.
    expect(sourceWindowForClip(left).end).toBeCloseTo(sourceWindowForClip(right).start, 6);
  });
});

describe('buildSplitIdentities', () => {
  const timeline = {
    tracks: [
      {
        id: 't1',
        type: 'video',
        clips: [
          clip({ id: 'a1', startTime: 0, duration: 2, trimStart: 0, splitGroupId: 'g1', splitSegmentIndex: 0 }),
          clip({ id: 'a2', startTime: 2, duration: 2, trimStart: 2, splitGroupId: 'g1', splitSegmentIndex: 1 }),
          clip({ id: 'a3', startTime: 4, duration: 2, trimStart: 4, splitGroupId: 'g1', splitSegmentIndex: 2 }),
        ],
      },
      { id: 't2', type: 'video', clips: [clip({ id: 'b1', trackId: 't2', startTime: 1, duration: 1, trimStart: 6 })] },
    ],
  };

  it('numbers segments in timeline order and marks contiguity', () => {
    const identities = buildSplitIdentities(timeline);
    expect(identities.get('a2')!.segmentIndex).toBe(1);
    expect(identities.get('a2')!.segmentCount).toBe(3);
    expect(identities.get('a2')!.contiguousWithPrevious).toBe(true);
    expect(identities.get('a2')!.contiguousWithNext).toBe(true);
    expect(identities.get('a1')!.contiguousWithPrevious).toBe(false);
    expect(identities.get('a3')!.contiguousWithNext).toBe(false);
  });

  it('lets a contiguous same-track chain share one <video> element / decoder', () => {
    const identities = buildSplitIdentities(timeline);
    for (const id of ['a1', 'a2', 'a3']) {
      expect(identities.get(id)!.shareableElement).toBe(true);
      expect(identities.get(id)!.shareKey).toBe('m1::chain:g1::track:t1');
    }
    // A clip that is not part of a chain never shares.
    expect(identities.get('b1')!.shareableElement).toBe(false);
    expect(identities.get('b1')!.shareKey).toBe('m1::clip:b1');
  });

  it('refuses to share when a segment was dragged to another track', () => {
    const moved = {
      tracks: [
        { id: 't1', type: 'video', clips: [timeline.tracks[0].clips[0], timeline.tracks[0].clips[1]] },
        { id: 't2', type: 'video', clips: [{ ...timeline.tracks[0].clips[2], trackId: 't2' }] },
      ],
    };
    const identities = buildSplitIdentities(moved);
    expect(identities.get('a1')!.shareableElement).toBe(false);
    expect(identities.get('a1')!.shareKey).toBe('m1::clip:a1');
    expect(identities.get('a3')!.shareableElement).toBe(false);
  });

  it('refuses to share when a gap was created (a middle segment was deleted)', () => {
    const gapped = {
      tracks: [
        { id: 't1', type: 'video', clips: [timeline.tracks[0].clips[0], { ...timeline.tracks[0].clips[2], startTime: 4 }] },
      ],
    };
    const identities = buildSplitIdentities(gapped);
    expect(identities.get('a1')!.shareableElement).toBe(false);
    expect(identities.get('a3')!.shareableElement).toBe(false);
  });

  it('refuses to share when two segments overlap in time', () => {
    const overlapping = {
      tracks: [
        {
          id: 't1',
          type: 'video',
          clips: [timeline.tracks[0].clips[0], { ...timeline.tracks[0].clips[1], startTime: 1 }],
        },
      ],
    };
    const identities = buildSplitIdentities(overlapping);
    expect(identities.get('a1')!.shareableElement).toBe(false);
    expect(identities.get('a2')!.shareableElement).toBe(false);
  });

  it('derives a stable render key from media + chain + source window', () => {
    const identities = buildSplitIdentities(timeline);
    expect(identities.get('a2')!.renderKey).toBe('chain:g1:m1:2.000-4.000');
    // Same source window from a *different* clip id is the same identity for
    // caches that key off content rather than clip ids.
    expect(renderKeyForClip(clip({ id: 'a2-copy', startTime: 2, trimStart: 2, splitGroupId: 'g1' })))
      .toBe('chain:g1:m1:2.000-4.000');
    // Un-split clips stay per-clip.
    expect(renderKeyForClip(clip({ id: 'solo', trimStart: 1 }))).toBe('clip:solo:m1:1.000-3.000');
  });

  it('handles clips without split ids (ordinary timeline)', () => {
    const identities = buildSplitIdentities({
      tracks: [{ id: 't1', type: 'video', clips: [clip({ id: 'solo' })] }],
    });
    const identity = identities.get('solo')!;
    expect(identity.chainId).toBeNull();
    expect(identity.segmentCount).toBe(1);
    expect(identity.shareableElement).toBe(false);
    expect(identity.shareKey).toBe(shareKeyForClip(clip({ id: 'solo' })));
  });
});

describe('restampSplitChains', () => {
  it('writes segment indexes in timeline order and keeps untouched clips identical', () => {
    const untouched = clip({ id: 'plain' });
    const stamped = restampSplitChains({
      tracks: [
        {
          id: 't1',
          type: 'video',
          clips: [
            clip({ id: 'b', startTime: 4, splitGroupId: 'g9', splitSegmentIndex: 7 }),
            clip({ id: 'a', startTime: 0, splitGroupId: 'g9', splitSegmentIndex: 7 }),
            untouched,
          ],
        },
      ],
    });
    const clips = stamped.tracks![0].clips as SplitIdentityClip[];
    expect(clips.find((c) => c.id === 'a')!.splitSegmentIndex).toBe(0);
    expect(clips.find((c) => c.id === 'b')!.splitSegmentIndex).toBe(1);
    // Untouched clips keep object identity so React memoisation is unaffected.
    expect(clips.find((c) => c.id === 'plain')).toBe(untouched);
  });

  it('returns the same timeline object when nothing needs re-stamping', () => {
    const timeline = {
      tracks: [
        { id: 't1', type: 'video', clips: [clip({ id: 'a', splitGroupId: 'g', splitSegmentIndex: 0 })] },
      ],
    };
    expect(restampSplitChains(timeline)).toBe(timeline);
  });
});

describe('split chain navigation', () => {
  const timeline = {
    tracks: [
      {
        id: 't1',
        type: 'video',
        clips: [
          clip({ id: 'a1', startTime: 0, duration: 2, trimStart: 0, splitGroupId: 'g1' }),
          clip({ id: 'a2', startTime: 2, duration: 2, trimStart: 2, splitGroupId: 'g1' }),
          clip({ id: 'a3', startTime: 4, duration: 2, trimStart: 4, splitGroupId: 'g1' }),
        ],
      },
    ],
  };

  it('lists siblings in timeline order', () => {
    expect(splitChainSiblings(timeline, 'a2').map((c) => c.id)).toEqual(['a1', 'a3']);
    expect(splitChainSiblings(timeline, 'a1').map((c) => c.id)).toEqual(['a2', 'a3']);
  });

  it('resolves the adjacent sibling the preview may reuse', () => {
    expect(adjacentSplitSibling(timeline, 'a2', 'next')!.id).toBe('a3');
    expect(adjacentSplitSibling(timeline, 'a2', 'previous')!.id).toBe('a1');
    expect(adjacentSplitSibling(timeline, 'a1', 'previous')).toBeNull();
  });

  it('returns no sibling for an un-split clip', () => {
    expect(splitChainSiblings(timeline, 'nope')).toEqual([]);
    expect(adjacentSplitSibling(timeline, 'nope')).toBeNull();
  });
});

describe('planDecodeStreams', () => {
  it('keeps contiguous split segments on one stream', () => {
    const plan = planDecodeStreams({
      tracks: [
        {
          id: 't1',
          type: 'video',
          clips: [
            clip({ id: 'a1', startTime: 0, duration: 2, trimStart: 0 }),
            clip({ id: 'a2', startTime: 2, duration: 2, trimStart: 2 }),
            clip({ id: 'a3', startTime: 4, duration: 2, trimStart: 4 }),
          ],
        },
      ],
    });
    expect(plan.streams).toHaveLength(1);
    expect(plan.streams[0].id).toBe('stream:m1#0');
    expect(plan.streams[0].shared).toBe(false);
    expect(plan.byClip.get('a2')!.id).toBe('stream:m1#0');
  });

  it('splits streams when a second track uses the same media at another source time', () => {
    const plan = planDecodeStreams({
      tracks: [
        {
          id: 't1',
          type: 'video',
          clips: [
            clip({ id: 'a1', startTime: 0, duration: 2, trimStart: 0 }),
            clip({ id: 'a2', startTime: 2, duration: 2, trimStart: 2 }),
          ],
        },
        // Same media, same window on the timeline, different source window:
        // sharing a sequential decoder here is what cooked the export.
        { id: 't2', type: 'video', clips: [clip({ id: 'b1', trackId: 't2', startTime: 2, duration: 2, trimStart: 5 })] },
      ],
    });
    expect(plan.streams).toHaveLength(2);
    const chain = plan.byClip.get('a1')!;
    const broll = plan.byClip.get('b1')!;
    expect(chain.id).not.toBe(broll.id);
    expect(chain.clipIds).toEqual(['a1', 'a2']);
  });

  it('splits streams when source windows are not monotonic', () => {
    const plan = planDecodeStreams({
      tracks: [
        {
          id: 't1',
          type: 'video',
          clips: [
            clip({ id: 'later-source', startTime: 0, duration: 2, trimStart: 2 }),
            clip({ id: 'earlier-source', startTime: 2, duration: 2, trimStart: 0 }),
          ],
        },
      ],
    });
    expect(plan.streams).toHaveLength(2);
    expect(canShareDecodeStream(
      clip({ id: 'later-source', startTime: 0, duration: 2, trimStart: 2 }),
      clip({ id: 'earlier-source', startTime: 2, duration: 2, trimStart: 0 }),
    )).toBe(false);
  });

  it('never mixes reversed and forward clips on one stream', () => {
    const plan = planDecodeStreams({
      tracks: [
        {
          id: 't1',
          type: 'video',
          clips: [
            clip({ id: 'fwd', startTime: 0, duration: 2, trimStart: 0 }),
            clip({ id: 'rev', startTime: 2, duration: 2, trimStart: 4, isReversed: true }),
          ],
        },
      ],
    });
    expect(plan.streams).toHaveLength(2);
  });

  it('respects the per-media stream budget and marks the shared stream', () => {
    // Four SIMULTANEOUS clips (same timeline span) that each need a different
    // part of the source — no stream can accept two of them.
    const clips = [0, 1, 2, 3].map((i) =>
      clip({ id: `c${i}`, startTime: 0, duration: 1, trimStart: i * 3 }),
    );
    // Four simultaneous source windows on four tracks, budget of 2.
    const plan = planDecodeStreams(
      { tracks: clips.map((c, i) => ({ id: `t${i}`, type: 'video', clips: [c] })) },
      { maxStreamsPerMedia: 2 },
    );
    expect(plan.streams).toHaveLength(2);
    // The clip that had to time-share a decoder flags its stream so diagnostics
    // can explain an occasional seek.
    expect(plan.streams.some((s) => s.shared)).toBe(true);
    // Every clip still resolves to a decoder — the budget never drops frames.
    for (const c of clips) expect(plan.byClip.has(c.id)).toBe(true);
  });

  it('ignores tracks that never decode frames', () => {
    const plan = planDecodeStreams({
      tracks: [
        { id: 'text', type: 'text', clips: [clip({ id: 'title', mediaId: 'txt' })] },
        { id: 'fx', type: 'fx', clips: [clip({ id: 'glow', mediaId: 'glow-media' })] },
        { id: 'off', type: 'video', hidden: true, clips: [clip({ id: 'behind' })] },
      ],
    });
    expect(plan.streams).toHaveLength(0);
  });

  it('isolates different media files from each other', () => {
    const plan = planDecodeStreams({
      tracks: [
        { id: 't1', type: 'video', clips: [clip({ id: 'a', mediaId: 'mA' })] },
        { id: 't2', type: 'video', clips: [clip({ id: 'b', mediaId: 'mB' })] },
      ],
    });
    expect(plan.streams).toHaveLength(2);
    expect(plan.byClip.get('a')!.mediaId).toBe('mA');
    expect(plan.byClip.get('b')!.mediaId).toBe('mB');
  });
});

describe('canShareDecodeStream', () => {
  it('accepts back-to-back clips with monotonic source order', () => {
    expect(canShareDecodeStream(
      clip({ id: 'x', startTime: 0, duration: 2, trimStart: 0 }),
      clip({ id: 'y', startTime: 2, duration: 2, trimStart: 2 }),
    )).toBe(true);
  });

  it('rejects clips that overlap on the timeline', () => {
    expect(canShareDecodeStream(
      clip({ id: 'x', startTime: 0, duration: 2, trimStart: 0 }),
      clip({ id: 'y', startTime: 1, duration: 2, trimStart: 8 }),
    )).toBe(false);
  });

  it('rejects clips of different media', () => {
    expect(canShareDecodeStream(
      clip({ id: 'x', mediaId: 'mA' }),
      clip({ id: 'y', mediaId: 'mB', startTime: 2 }),
    )).toBe(false);
  });
});
