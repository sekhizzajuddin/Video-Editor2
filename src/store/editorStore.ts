import { create } from 'zustand';
import type {
  EditorState,
  MediaItem,
  TimelineClip,
  TimelineTrack,
  EditorTool,
  MediaTab,
  PropertiesTab,
  EditorSnapshot,
} from '@/types';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Create empty tracks
const createEmptyTracks = (): TimelineTrack[] => [
  {
    id: 'v1',
    name: 'V1',
    type: 'video',
    clips: [],
    locked: false,
    muted: false,
    hidden: false,
  },
  {
    id: 'v2',
    name: 'V2',
    type: 'video',
    clips: [],
    locked: false,
    muted: false,
    hidden: false,
  },
  {
    id: 'a1',
    name: 'A1',
    type: 'audio',
    clips: [],
    locked: false,
    muted: false,
    hidden: false,
  },
  {
    id: 'a2',
    name: 'A2',
    type: 'audio',
    clips: [],
    locked: false,
    muted: false,
    hidden: false,
  },
];

// Check if a clip overlaps with existing clips on a track
function checkOverlap(
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  excludeClipId?: string
): boolean {
  const endTime = startTime + duration;
  return clips.some((clip) => {
    if (clip.id === excludeClipId) return false;
    const clipEnd = clip.startTime + clip.duration;
    return startTime < clipEnd && endTime > clip.startTime;
  });
}

// Find the closest non-overlapping position on a track
function findNonOverlappingPosition(
  clips: TimelineClip[],
  desiredStart: number,
  duration: number,
  excludeClipId?: string
): number {
  let startTime = Math.max(0, desiredStart);
  const endTime = startTime + duration;

  if (!checkOverlap(clips, startTime, duration, excludeClipId)) {
    return startTime;
  }

  let bestStart = -1;
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  for (const clip of sortedClips) {
    if (clip.id === excludeClipId) continue;
    const clipEnd = clip.startTime + clip.duration;
    if (clip.startTime >= endTime || clipEnd <= startTime) {
      continue;
    }
    const tryStart = clipEnd;
    if (!checkOverlap(clips, tryStart, duration, excludeClipId)) {
      if (bestStart === -1 || tryStart < bestStart) {
        bestStart = tryStart;
      }
    }
  }

  if (bestStart === -1) {
    const lastEnd = sortedClips.reduce((max, c) => {
      if (c.id === excludeClipId) return max;
      return Math.max(max, c.startTime + c.duration);
    }, 0);
    bestStart = lastEnd;
  }

  return bestStart;
}

interface EditorActions {
  // Media Library
  addMedia: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
  updateMediaMetadata: (id: string, updates: Partial<MediaItem>) => void;

  // Timeline Operations
  addClip: (clip: TimelineClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => boolean;
  tryMoveClip: (clipId: string, newStartTime: number, newTrackId?: string) => { canMove: boolean; newPosition: number };
  splitClip: (clipId: string, splitTime: number) => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;

  // Playback
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setTotalDuration: (duration: number) => void;

  // Tools
  setActiveTool: (tool: EditorTool) => void;

  // Timeline View
  setZoomLevel: (zoom: number) => void;
  setScrollLeft: (scroll: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Track Operations
  toggleTrackLock: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackHidden: (trackId: string) => void;
  addTrack: (type: 'video' | 'audio') => void;
  removeTrack: (trackId: string) => void;

  // UI
  setActiveMediaTab: (tab: MediaTab) => void;
  setActivePropertiesTab: (tab: PropertiesTab) => void;
  setShowExportModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;

  // Clipboard
  copyClip: () => void;
  pasteClip: () => void;
  cutClip: () => void;
  duplicateClip: () => void;

  // History
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;

  // Drag/Drop
  setDraggingClipId: (id: string | null) => void;
  setDragPreview: (time: number, trackId: string | null) => void;

  // Project
  resetProject: () => void;

  // Computed: recalculate total duration from all clips
  recalcTotalDuration: () => void;
}

const initialState: EditorState = {
  mediaLibrary: [],
  tracks: createEmptyTracks(),
  selectedClipId: null,
  selectedTrackId: null,
  currentTime: 0,
  isPlaying: false,
  totalDuration: 30,
  playbackSpeed: 1,
  isMuted: false,
  volume: 1,
  zoomLevel: 80,
  scrollLeft: 0,
  activeTool: 'select',
  showExportModal: false,
  showSettingsModal: false,
  activeMediaTab: 'project',
  activePropertiesTab: 'transform',
  clipboardClip: null,
  history: [],
  historyIndex: -1,
  draggingClipId: null,
  dragPreviewTime: 0,
  dragPreviewTrackId: null,
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  // Media Library
  addMedia: (item) => {
    set((state) => ({
      mediaLibrary: [...state.mediaLibrary, item],
    }));
    get().saveSnapshot();
  },
  removeMedia: (id) => {
    // Also remove any clips referencing this media
    set((state) => ({
      mediaLibrary: state.mediaLibrary.filter((m) => m.id !== id),
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((c) => c.mediaId !== id),
      })),
    }));
    // Revoke the object URL to free memory
    const media = get().mediaLibrary.find((m) => m.id === id);
    if (media?.url) {
      try { URL.revokeObjectURL(media.url); } catch { /* ignore */ }
    }
    if (media?.thumbnail) {
      try { URL.revokeObjectURL(media.thumbnail); } catch { /* ignore */ }
    }
    get().recalcTotalDuration();
    get().saveSnapshot();
  },
  updateMediaMetadata: (id, updates) => {
    set((state) => ({
      mediaLibrary: state.mediaLibrary.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  // Timeline Operations
  addClip: (clip) => {
    const state = get();
    const targetTrack = state.tracks.find((t) => t.id === clip.trackId);
    if (targetTrack) {
      clip.startTime = findNonOverlappingPosition(
        targetTrack.clips,
        clip.startTime,
        clip.duration
      );
    }

    set((state) => {
      const newTracks = state.tracks.map((track) => {
        if (track.id === clip.trackId) {
          return { ...track, clips: [...track.clips, { ...clip, isPreview: false }] };
        }
        return track;
      });
      return { tracks: newTracks, selectedClipId: clip.id };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  removeClip: (clipId) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((c) => c.id !== clipId),
      }));
      return {
        tracks: newTracks,
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
      };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  updateClip: (clipId, updates) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId ? { ...clip, ...updates } : clip
        ),
      }));
      return { tracks: newTracks };
    });
  },

  moveClip: (clipId, newStartTime, newTrackId) => {
    const state = get();
    let foundClip: TimelineClip | undefined;

    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) {
        foundClip = { ...clip, startTime: newStartTime };
        if (newTrackId) foundClip.trackId = newTrackId;
        break;
      }
    }

    if (!foundClip) return false;

    const targetTrackId = newTrackId || foundClip.trackId;
    const targetTrack = state.tracks.find((t) => t.id === targetTrackId);
    if (targetTrack) {
      const otherClips = targetTrack.clips.filter((c) => c.id !== clipId);
      const adjustedStart = findNonOverlappingPosition(
        otherClips,
        newStartTime,
        foundClip.duration,
        clipId
      );
      foundClip.startTime = adjustedStart;
    }

    set((state) => {
      const sourceTracks = state.tracks.map((track) => {
        if (track.clips.some((c) => c.id === clipId)) {
          return { ...track, clips: track.clips.filter((c) => c.id !== clipId) };
        }
        return track;
      });

      const finalTracks = sourceTracks.map((track) => {
        if (track.id === targetTrackId) {
          return { ...track, clips: [...track.clips, foundClip as TimelineClip] };
        }
        return track;
      });

      return { tracks: finalTracks };
    });

    get().recalcTotalDuration();
    get().saveSnapshot();
    return true;
  },

  tryMoveClip: (clipId, newStartTime, newTrackId) => {
    const state = get();
    let foundClip: TimelineClip | undefined;

    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) {
        foundClip = { ...clip, startTime: newStartTime };
        if (newTrackId) foundClip.trackId = newTrackId;
        break;
      }
    }

    if (!foundClip) return { canMove: false, newPosition: newStartTime };

    const targetTrackId = newTrackId || foundClip.trackId;
    const targetTrack = state.tracks.find((t) => t.id === targetTrackId);

    if (!targetTrack) return { canMove: false, newPosition: newStartTime };

    const otherClips = targetTrack.clips.filter((c) => c.id !== clipId);
    const adjustedStart = findNonOverlappingPosition(
      otherClips,
      newStartTime,
      foundClip.duration,
      clipId
    );

    const canMove = adjustedStart === newStartTime;
    return { canMove, newPosition: canMove ? newStartTime : adjustedStart };
  },

  splitClip: (clipId, splitTime) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => {
        const clipIndex = track.clips.findIndex((c) => c.id === clipId);
        if (clipIndex === -1) return track;

        const clip = track.clips[clipIndex];
        const relativeSplitTime = splitTime - clip.startTime;

        if (relativeSplitTime <= 0 || relativeSplitTime >= clip.duration) return track;

        const groupId = clip.splitGroupId || generateId();

        const leftClip: TimelineClip = {
          ...clip,
          id: generateId(),
          splitGroupId: groupId,
          duration: relativeSplitTime,
          trimEnd: clip.trimEnd + (clip.duration - relativeSplitTime) * clip.speed,
          effects: [...clip.effects],
        };

        const rightClip: TimelineClip = {
          ...clip,
          id: generateId(),
          splitGroupId: groupId,
          startTime: splitTime,
          duration: clip.duration - relativeSplitTime,
          trimStart: clip.trimStart + relativeSplitTime * clip.speed,
          effects: [...clip.effects],
        };

        const newClips = [...track.clips];
        newClips.splice(clipIndex, 1, leftClip, rightClip);

        return { ...track, clips: newClips };
      });
      return { tracks: newTracks };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  // Playback
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seek: (time) => set({ currentTime: Math.max(0, time) }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setTotalDuration: (duration) => set({ totalDuration: duration }),

  // Tools
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Timeline View
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
  setScrollLeft: (scroll) => set({ scrollLeft: scroll }),
  zoomIn: () => set((state) => ({ zoomLevel: Math.min(state.zoomLevel + 20, 400) })),
  zoomOut: () => set((state) => ({ zoomLevel: Math.max(state.zoomLevel - 20, 20) })),

  // Track Operations
  toggleTrackLock: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
    })),
  toggleTrackMute: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    })),
  toggleTrackHidden: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, hidden: !t.hidden } : t
      ),
    })),
  addTrack: (type) => {
    const id = `${type === 'video' ? 'v' : 'a'}${get().tracks.filter((t) => t.type === type).length + 1}`;
    set((state) => ({
      tracks: [
        ...state.tracks,
        {
          id,
          name: id.toUpperCase(),
          type,
          clips: [],
          locked: false,
          muted: false,
          hidden: false,
        },
      ],
    }));
    get().saveSnapshot();
  },
  removeTrack: (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
    }));
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  // UI
  setActiveMediaTab: (tab) => set({ activeMediaTab: tab }),
  setActivePropertiesTab: (tab) => set({ activePropertiesTab: tab }),
  setShowExportModal: (show) => set({ showExportModal: show }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),

  // Clipboard
  copyClip: () => {
    const { tracks, selectedClipId } = get();
    if (!selectedClipId) return;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        set({ clipboardClip: { ...clip, id: generateId(), splitGroupId: undefined, effects: [...clip.effects] } });
        break;
      }
    }
  },
  pasteClip: () => {
    const { clipboardClip, currentTime } = get();
    if (!clipboardClip) return;
    const pastedClip = {
      ...clipboardClip,
      id: generateId(),
      startTime: currentTime,
      splitGroupId: undefined,
      isPreview: false,
    };
    get().addClip(pastedClip);
  },
  cutClip: () => {
    const { selectedClipId } = get();
    if (!selectedClipId) return;
    get().copyClip();
    get().removeClip(selectedClipId);
  },
  duplicateClip: () => {
    const { tracks, selectedClipId } = get();
    if (!selectedClipId) return;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        const dup = {
          ...clip,
          id: generateId(),
          startTime: clip.startTime + clip.duration,
          splitGroupId: undefined,
          effects: [...clip.effects],
          isPreview: false,
        };
        get().addClip(dup);
        break;
      }
    }
  },

  // History
  saveSnapshot: () => {
    set((state) => {
      const snapshot: EditorSnapshot = {
        tracks: JSON.parse(JSON.stringify(state.tracks)),
        currentTime: state.currentTime,
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      return {
        history: newHistory.slice(-50),
        historyIndex: newHistory.length - 1,
      };
    });
  },
  undo: () => {
    set((state) => {
      if (state.historyIndex <= 0) return {};
      const snap = state.history[state.historyIndex - 1];
      return {
        tracks: JSON.parse(JSON.stringify(snap.tracks)),
        currentTime: snap.currentTime,
        historyIndex: state.historyIndex - 1,
      };
    });
  },
  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return {};
      const snap = state.history[state.historyIndex + 1];
      return {
        tracks: JSON.parse(JSON.stringify(snap.tracks)),
        currentTime: snap.currentTime,
        historyIndex: state.historyIndex + 1,
      };
    });
  },

  // Drag/Drop
  setDraggingClipId: (id) => set({ draggingClipId: id }),
  setDragPreview: (time, trackId) => set({ dragPreviewTime: time, dragPreviewTrackId: trackId }),

  // Project
  resetProject: () => {
    // Revoke all object URLs
    const { mediaLibrary } = get();
    mediaLibrary.forEach((m) => {
      if (m.url) try { URL.revokeObjectURL(m.url); } catch { /* ignore */ }
      if (m.thumbnail) try { URL.revokeObjectURL(m.thumbnail); } catch { /* ignore */ }
    });
    set({
      ...initialState,
      tracks: createEmptyTracks(),
    });
  },

  // Recalculate total duration from all clips
  recalcTotalDuration: () => {
    const { tracks } = get();
    let maxEnd = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    // Add some padding, minimum 30s
    set({ totalDuration: Math.max(30, maxEnd + 10) });
  },
}));
