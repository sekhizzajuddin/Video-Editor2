import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { loadProjectData } from '@/utils/fileSystemAccess';
import type { TimelineClip, TimelineTrack } from '@/types';

describe('Legacy Project Loading Migration System', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tracks: [],
      mediaLibrary: [],
      selectedClipId: null,
      selectedClipIds: [],
      activeTool: 'select',
      currentTime: 0,
      history: [],
      historyIndex: -1,
      pipWindows: {},
    });
  });

  it('automatically migrates older saved project with contiguous split clips that have no splitGroupId', () => {
    // Legacy project JSON format: clips have mediaId, trimStart, duration, but splitGroupId is undefined
    const legacyProject = {
      version: '1.0.0',
      projectId: 'legacy_proj_1',
      projectName: 'Old Saved Project',
      currentTime: 2.5,
      aspectRatio: '16:9',
      mediaLibrary: [
        { id: 'media_video_1', type: 'video', duration: 30, name: 'video.mp4', url: 'blob:test' },
      ],
      tracks: [
        {
          id: 'track_v1',
          type: 'video',
          name: 'Video 1',
          hidden: false,
          muted: false,
          clips: [
            // Segment 1: 0s..4s in timeline, 0s..4s in source (no splitGroupId)
            {
              id: 'clip_seg_1',
              mediaId: 'media_video_1',
              trackId: 'track_v1',
              startTime: 0,
              duration: 4,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              opacity: 1,
              effects: [],
              // legacy: splitGroupId is omitted / undefined
            },
            // Segment 2: 4s..10s in timeline, 4s..10s in source (no splitGroupId)
            {
              id: 'clip_seg_2',
              mediaId: 'media_video_1',
              trackId: 'track_v1',
              startTime: 4,
              duration: 6,
              trimStart: 4,
              trimEnd: 0,
              speed: 1,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              opacity: 1,
              effects: [],
              // legacy: splitGroupId is omitted / undefined
            },
            // Segment 3: 15s..20s in timeline (gap of 5s on timeline), not contiguous
            {
              id: 'clip_seg_3',
              mediaId: 'media_video_1',
              trackId: 'track_v1',
              startTime: 15,
              duration: 5,
              trimStart: 10,
              trimEnd: 0,
              speed: 1,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              opacity: 1,
              effects: [],
              splitGroupId: 'orphaned_id_from_earlier_bug',
            },
          ],
        },
      ],
    };

    // Load the legacy project via loadProjectData
    loadProjectData(legacyProject);

    const storeState = useEditorStore.getState();
    const migratedTracks = storeState.tracks;
    const clips = migratedTracks[0].clips;

    expect(clips).toHaveLength(3);

    // 1. Contiguous segments 1 & 2 MUST now share a newly generated splitGroupId
    expect(clips[0].splitGroupId).toBeDefined();
    expect(clips[1].splitGroupId).toBeDefined();
    expect(clips[0].splitGroupId).toBe(clips[1].splitGroupId);
    expect(clips[0].splitGroupId).toMatch(/^sg_/);

    // 2. Segment 3 is separated by a 5s gap and had an orphaned splitGroupId:
    // It MUST be sanitized to undefined
    expect(clips[2].splitGroupId).toBeUndefined();

    // 3. Project state properties are preserved correctly
    expect(storeState.projectName).toBe('Old Saved Project');
    expect(storeState.currentTime).toBe(2.5);
    expect(storeState.aspectRatio).toBe('16:9');
    expect(storeState.history).toHaveLength(1);
    expect(storeState.history[0].tracks[0].clips[0].splitGroupId).toBe(clips[0].splitGroupId);
  });

  it('migrates legacy split clips nested inside PiP windows', () => {
    const legacyProjectWithPip = {
      version: '1.0.0',
      projectId: 'pip_proj',
      projectName: 'PiP Legacy Project',
      mediaLibrary: [
        { id: 'pip_media', type: 'video', duration: 20, name: 'pip.mp4', url: 'blob:pip' },
      ],
      tracks: [
        {
          id: 'v1',
          type: 'video',
          clips: [],
        },
      ],
      pipWindows: {
        window_1: {
          id: 'window_1',
          relativeStartTime: 0,
          duration: 10,
          tracks: [
            {
              id: 'pip_t1',
              type: 'video',
              clips: [
                {
                  id: 'pip_clip_1',
                  mediaId: 'pip_media',
                  startTime: 0,
                  duration: 5,
                  trimStart: 0,
                },
                {
                  id: 'pip_clip_2',
                  mediaId: 'pip_media',
                  startTime: 5,
                  duration: 5,
                  trimStart: 5,
                },
              ],
            },
          ],
        },
      },
    };

    loadProjectData(legacyProjectWithPip);

    const pipWindows = useEditorStore.getState().pipWindows;
    expect(pipWindows).toBeDefined();
    const pipTrackClips = pipWindows['window_1'].tracks[0].clips;

    expect(pipTrackClips[0].splitGroupId).toBeDefined();
    expect(pipTrackClips[0].splitGroupId).toBe(pipTrackClips[1].splitGroupId);
  });
});
