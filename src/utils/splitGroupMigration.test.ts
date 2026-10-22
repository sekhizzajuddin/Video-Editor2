import { describe, it, expect } from 'vitest';
import {
  migrateLegacyTrackSplitGroups,
  migrateLegacyTracks,
  migrateLegacyPipWindows,
} from './splitGroupMigration';
import type { TimelineClip, TimelineTrack, PipWindow } from '@/types';

const createBaseClip = (partial: Partial<TimelineClip>): TimelineClip => ({
  id: partial.id || 'clip_1',
  mediaId: partial.mediaId || 'media_1',
  trackId: partial.trackId || 'track_1',
  startTime: partial.startTime ?? 0,
  duration: partial.duration ?? 5,
  trimStart: partial.trimStart ?? 0,
  trimEnd: partial.trimEnd ?? 0,
  speed: partial.speed ?? 1,
  transform: partial.transform || { x: 10, y: 20, scale: 1.5, rotation: 0 },
  opacity: partial.opacity ?? 0.9,
  volume: partial.volume ?? 0.8,
  effects: partial.effects || [{ id: 'fx1', name: 'blur', type: 'filter', properties: {} } as any],
  animations: partial.animations || { opacity: [{ time: 0, value: 1, easing: 'linear' }] },
  ...partial,
});

describe('splitGroupMigration', () => {
  it('assigns a shared splitGroupId to contiguous split clips with no existing splitGroupId', () => {
    const clip1 = createBaseClip({
      id: 'clip_left',
      startTime: 0,
      duration: 5,
      trimStart: 0,
      splitGroupId: undefined,
    });
    const clip2 = createBaseClip({
      id: 'clip_right',
      startTime: 5,
      duration: 7,
      trimStart: 5,
      splitGroupId: undefined,
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBeDefined();
    expect(migrated.clips[1].splitGroupId).toBeDefined();
    expect(migrated.clips[0].splitGroupId).toBe(migrated.clips[1].splitGroupId);
    expect(migrated.clips[0].splitGroupId).toMatch(/^sg_/);
  });

  it('preserves existing valid splitGroupId and returns exact same track reference (idempotence)', () => {
    const clip1 = createBaseClip({
      id: 'clip_left',
      startTime: 0,
      duration: 5,
      trimStart: 0,
      splitGroupId: 'sg_valid_123',
    });
    const clip2 = createBaseClip({
      id: 'clip_right',
      startTime: 5,
      duration: 7,
      trimStart: 5,
      splitGroupId: 'sg_valid_123',
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    // Exact reference equality
    expect(migrated).toBe(track);
    expect(migrated.clips[0].splitGroupId).toBe('sg_valid_123');
    expect(migrated.clips[1].splitGroupId).toBe('sg_valid_123');
  });

  it('adopts existing splitGroupId if one half has it and the other half does not', () => {
    const clip1 = createBaseClip({
      id: 'clip_left',
      startTime: 0,
      duration: 5,
      trimStart: 0,
      splitGroupId: 'sg_from_first',
    });
    const clip2 = createBaseClip({
      id: 'clip_right',
      startTime: 5,
      duration: 7,
      trimStart: 5,
      splitGroupId: undefined,
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBe('sg_from_first');
    expect(migrated.clips[1].splitGroupId).toBe('sg_from_first');
  });

  it('unites contiguous clips having conflicting splitGroupIds to a single splitGroupId', () => {
    const clip1 = createBaseClip({
      id: 'clip_left',
      startTime: 0,
      duration: 5,
      trimStart: 0,
      splitGroupId: 'sg_conflicting_a',
    });
    const clip2 = createBaseClip({
      id: 'clip_right',
      startTime: 5,
      duration: 7,
      trimStart: 5,
      splitGroupId: 'sg_conflicting_b',
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBe(migrated.clips[1].splitGroupId);
    expect(migrated.clips[0].splitGroupId).toBe('sg_conflicting_a');
  });

  it('does NOT group clips that have a gap between them on the timeline', () => {
    const clip1 = createBaseClip({
      id: 'clip_1',
      startTime: 0,
      duration: 5,
      trimStart: 0,
      splitGroupId: undefined,
    });
    const clip2 = createBaseClip({
      id: 'clip_2',
      startTime: 7, // 2s timeline gap
      duration: 5,
      trimStart: 5,
      splitGroupId: undefined,
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBeUndefined();
    expect(migrated.clips[1].splitGroupId).toBeUndefined();
  });

  it('does NOT group clips that are discontinuous in source media', () => {
    const clip1 = createBaseClip({
      id: 'clip_1',
      startTime: 0,
      duration: 5,
      trimStart: 0, // ends at source 5
      splitGroupId: undefined,
    });
    const clip2 = createBaseClip({
      id: 'clip_2',
      startTime: 5, // adjacent on timeline
      duration: 5,
      trimStart: 20, // starts at source 20 (15s jump cut)
      splitGroupId: undefined,
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBeUndefined();
    expect(migrated.clips[1].splitGroupId).toBeUndefined();
  });

  it('clears orphaned splitGroupId from isolated clips (neighbor was deleted)', () => {
    const clip = createBaseClip({
      id: 'clip_orphan',
      startTime: 0,
      duration: 5,
      splitGroupId: 'sg_stale_group',
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBeUndefined();
  });

  it('handles speed-ramped clips correctly', () => {
    // Clip 1 is at 2x speed: duration 3s means 6s of source consumed
    const clip1 = createBaseClip({
      id: 'clip_speed_1',
      startTime: 0,
      duration: 3,
      trimStart: 0,
      speed: 2,
    });
    // Clip 2 starts at source trimStart 6s
    const clip2 = createBaseClip({
      id: 'clip_speed_2',
      startTime: 3,
      duration: 4,
      trimStart: 6,
      speed: 2,
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBeDefined();
    expect(migrated.clips[0].splitGroupId).toBe(migrated.clips[1].splitGroupId);
  });

  it('handles speed-frame clips with speedFrameSourceEnd correctly', () => {
    const clip1 = createBaseClip({
      id: 'clip_sf_1',
      startTime: 0,
      duration: 3,
      trimStart: 0,
      speedFrameSourceEnd: 4.8,
    });
    const clip2 = createBaseClip({
      id: 'clip_sf_2',
      startTime: 3,
      duration: 4,
      trimStart: 4.8,
    });

    const track: TimelineTrack = {
      id: 'track_1',
      type: 'video',
      clips: [clip1, clip2],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    expect(migrated.clips[0].splitGroupId).toBeDefined();
    expect(migrated.clips[0].splitGroupId).toBe(migrated.clips[1].splitGroupId);
  });

  it('preserves all other clip properties completely without data loss', () => {
    const originalClip = createBaseClip({
      id: 'clip_with_metadata',
      startTime: 0,
      duration: 5,
      trimStart: 0,
      transform: { x: 42, y: 84, scale: 2.2, rotation: 15 },
      opacity: 0.75,
      volume: 0.6,
      effects: [{ id: 'fx99', name: 'vignette', type: 'filter', properties: { radius: 0.5 } } as any],
      animations: {
        'transform.scale': [{ time: 0, value: 1, easing: 'easeInOut' }],
      },
      transitionOut: { type: 'fade', duration: 0.5 },
    });

    const nextClip = createBaseClip({
      id: 'clip_next',
      startTime: 5,
      duration: 5,
      trimStart: 5,
    });

    const track: TimelineTrack = {
      id: 'track_meta',
      type: 'video',
      clips: [originalClip, nextClip],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);
    const mClip = migrated.clips[0];

    expect(mClip.transform).toEqual(originalClip.transform);
    expect(mClip.opacity).toBe(originalClip.opacity);
    expect(mClip.volume).toBe(originalClip.volume);
    expect(mClip.effects).toEqual(originalClip.effects);
    expect(mClip.animations).toEqual(originalClip.animations);
    expect(mClip.transitionOut).toEqual(originalClip.transitionOut);
  });

  it('migrates multiple separate split chains independently without ID collisions', () => {
    // Chain 1: media_1 at 0..5 and 5..10
    const m1_a = createBaseClip({ id: 'm1_a', mediaId: 'media_1', startTime: 0, duration: 5, trimStart: 0 });
    const m1_b = createBaseClip({ id: 'm1_b', mediaId: 'media_1', startTime: 5, duration: 5, trimStart: 5 });

    // Standalone clip of media_3 at 10..15
    const m3 = createBaseClip({ id: 'm3', mediaId: 'media_3', startTime: 10, duration: 5, trimStart: 0 });

    // Chain 2: media_2 at 15..20 and 20..25
    const m2_a = createBaseClip({ id: 'm2_a', mediaId: 'media_2', startTime: 15, duration: 5, trimStart: 0 });
    const m2_b = createBaseClip({ id: 'm2_b', mediaId: 'media_2', startTime: 20, duration: 5, trimStart: 5 });

    const track: TimelineTrack = {
      id: 'track_multi',
      type: 'video',
      clips: [m1_a, m1_b, m3, m2_a, m2_b],
      hidden: false,
    };

    const migrated = migrateLegacyTrackSplitGroups(track);

    const gid1 = migrated.clips[0].splitGroupId;
    const gid2 = migrated.clips[3].splitGroupId;

    expect(gid1).toBeDefined();
    expect(migrated.clips[1].splitGroupId).toBe(gid1);

    expect(migrated.clips[2].splitGroupId).toBeUndefined();

    expect(gid2).toBeDefined();
    expect(migrated.clips[4].splitGroupId).toBe(gid2);

    expect(gid1).not.toBe(gid2);
  });

  it('migrates PiP window tracks recursively via migrateLegacyPipWindows', () => {
    const pipClip1 = createBaseClip({ id: 'pip1', startTime: 0, duration: 4, trimStart: 0 });
    const pipClip2 = createBaseClip({ id: 'pip2', startTime: 4, duration: 4, trimStart: 4 });

    const pipWindows: Record<string, PipWindow> = {
      pip_window_1: {
        id: 'pip_window_1',
        relativeStartTime: 0,
        duration: 8,
        tracks: [
          {
            id: 'pip_track_1',
            type: 'video',
            clips: [pipClip1, pipClip2],
            hidden: false,
          },
        ],
      },
    };

    const migrated = migrateLegacyPipWindows(pipWindows);

    expect(migrated).toBeDefined();
    const migratedTrack = migrated!.pip_window_1.tracks[0];
    expect(migratedTrack.clips[0].splitGroupId).toBeDefined();
    expect(migratedTrack.clips[0].splitGroupId).toBe(migratedTrack.clips[1].splitGroupId);
  });
});
