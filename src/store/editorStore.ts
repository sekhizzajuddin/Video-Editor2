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
  Transition,
  ClipTextSettings,
} from '@/types';
import { getMediaTimeForClip, getMediaTimeAtPosition } from '@/utils/speedRamp';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, loadProjectFromDB, clearProjectDB } from '@/utils/projectPersistence';


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
  addMedia: (item: MediaItem, file?: File) => void;
  removeMedia: (id: string) => void;
  updateMediaMetadata: (id: string, updates: Partial<MediaItem>) => void;

  // Timeline Operations
  addClip: (clip: TimelineClip) => void;
  insertTextClip: (settings: Partial<ClipTextSettings>) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string, resolveOverlap?: boolean) => boolean;
  moveClips: (updates: { clipId: string; newStartTime: number; newTrackId?: string }[], resolveOverlap?: boolean) => void;
  resolveOverlaps: (clipIds: string[]) => void;
  tryMoveClip: (clipId: string, newStartTime: number, newTrackId?: string) => { canMove: boolean; newPosition: number };
  splitClip: (clipId: string, splitTime: number) => void;
  selectClip: (clipId: string | null, multi?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
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
  addTrack: (type: 'video' | 'audio' | 'text' | 'fx') => void;
  removeTrack: (trackId: string) => void;
  reorderTrack: (trackId: string, newIndex: number) => void;

  // UI
  setActiveMediaTab: (tab: MediaTab) => void;
  setActivePropertiesTab: (tab: PropertiesTab) => void;
  setShowExportModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setCanvasTransformMode: (mode: 'resize' | 'crop') => void;

  setPreviewCanvas: (canvas: HTMLCanvasElement | null) => void;
  setMasterAudioStream: (stream: MediaStream | null) => void;

  // Clipboard
  copyClip: () => void;
  pasteClip: () => void;
  cutClip: () => void;
  duplicateClip: () => void;

  // History
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;

  // Master Keyframes
  addMasterKeyframe: (clipId: string, time: number, values: { transform: any, crop: any }) => void;
  deleteMasterKeyframe: (clipId: string, time: number) => void;
  moveMasterKeyframe: (clipId: string, oldTime: number, newTime: number) => void;
  breakMasterKeyframeLink: (clipId: string, time: number) => void;
  toggleKeyframeLineSelection: (clipId: string, time: number, multi?: boolean) => void;
  removeSelectedKeyframeLines: () => void;
  updateSettings: (settings: Partial<EditorState['settings']>) => void;

  // Drag/Drop
  setDraggingClipId: (id: string | null) => void;
  setDragPreview: (time: number, trackId: string | null) => void;

  // Project
  resetProject: () => void;
  loadProject: () => Promise<boolean>;

  // Computed: recalculate total duration from all clips
  recalcTotalDuration: () => void;

  // Transitions
  setShowTransitionLayer: (show: boolean) => void;
  selectTransition: (clipId: string | null) => void;
  updateTransition: (clipId: string, updates: Partial<Transition>) => void;
  removeTransition: (clipId: string) => void;
}

const defaultTracks = createEmptyTracks();
const initialState: EditorState = {
  mediaLibrary: [],
  tracks: defaultTracks,
  selectedClipId: null,
  selectedClipIds: [],
  selectedTransitionClipId: null,
  selectedKeyframeLines: [],
  selectedTrackId: null,
  settings: {
    scrollSpeed: 1,
    gestureSensitivity: 1,
  },
  hasUnsavedChanges: false,
  currentTime: 0,
  isPlaying: false,
  totalDuration: 0,
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
  canvasTransformMode: 'resize',
  previewCanvas: null,
  masterAudioStream: null,
  clipboardClip: null,
  history: [
    {
      tracks: JSON.parse(JSON.stringify(defaultTracks)),
      currentTime: 0,
    },
  ],
  historyIndex: 0,
  draggingClipId: null,
  dragPreviewTime: 0,
  dragPreviewTrackId: null,
  showTransitionLayer: true,
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  // Media Library
  addMedia: (item, file) => {
    set((state) => ({
      mediaLibrary: [...state.mediaLibrary, item],
    }));
    if (file) {
      saveFileToDB(item.id, file).catch(err => console.error('Failed to save file to DB:', err));
    }
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
    // Delete file from IndexedDB
    deleteFileFromDB(id).catch(err => console.error('Failed to delete file from DB:', err));
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
    set((state) => {
      const newTracks = state.tracks.map((track) => {
        if (track.id === clip.trackId) {
          return { ...track, clips: [...track.clips, { ...clip, isPreview: false }] };
        }
        return track;
      });
      return { tracks: newTracks, selectedClipId: clip.id, selectedClipIds: [clip.id] };
    });
    get().recalcTotalDuration();
    get().resolveOverlaps([clip.id]);
    get().saveSnapshot();
  },

  insertTextClip: (settings) => {
    let targetTrack = get().tracks.find((t) => t.type === 'text');
    if (!targetTrack) {
      get().addTrack('text');
      targetTrack = get().tracks.find((t) => t.type === 'text');
    }
    if (!targetTrack) return;

    const mediaId = generateId();
    get().addMedia({
      id: mediaId,
      name: 'Text Layer',
      type: 'text',
      duration: 3,
      url: '',
      createdAt: Date.now(),
      textContent: settings.text || 'New Text',
    });

    const { currentTime } = get();
    const clipId = generateId();
    
    let startTime = currentTime;
    while (targetTrack.clips.some((c) => Math.max(0, Math.min(startTime + 3, c.startTime + c.duration) - Math.max(startTime, c.startTime)) > 0)) {
       startTime += 3.1;
    }

    const newClip: TimelineClip = {
      id: clipId,
      mediaId,
      trackId: targetTrack.id,
      startTime,
      duration: 3,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
      effects: [],
      textSettings: {
        text: 'New Text',
        fontFamily: 'Inter',
        fontSize: 48,
        color: '#ffffff',
        backgroundColor: 'transparent',
        bold: false,
        italic: false,
        underline: false,
        shadow: false,
        shadowColor: '#000000',
        shadowBlur: 10,
        threeD: false,
        threeDDepth: 5,
        ...settings,
      }
    };
    get().addClip(newClip);
  },

  removeClip: (clipId) => {
    set((state) => {
      const idsToRemove = state.selectedClipIds.includes(clipId)
        ? state.selectedClipIds
        : [clipId];

      const newTracks = state.tracks.map((track) => {
        const remainingClips = track.clips.filter((c) => !idsToRemove.includes(c.id));
        const deletedClips = track.clips.filter((c) => idsToRemove.includes(c.id));

        if (state.activeTool === 'ripple' && deletedClips.length > 0) {
          const sortedDeleted = [...deletedClips].sort((a, b) => a.startTime - b.startTime);
          const shiftedClips = remainingClips.map((clip) => {
            const deletedBefore = sortedDeleted.filter((d) => d.startTime < clip.startTime);
            const totalShift = deletedBefore.reduce((sum, d) => sum + d.duration, 0);
            return {
              ...clip,
              startTime: Math.max(0, clip.startTime - totalShift),
            };
          });

          return {
            ...track,
            clips: shiftedClips,
          };
        }

        return {
          ...track,
          clips: remainingClips,
        };
      });

      const newSelectedClipIds = state.selectedClipIds.filter((id) => !idsToRemove.includes(id));
      const newSelectedClipId =
        state.selectedClipId && idsToRemove.includes(state.selectedClipId)
          ? (newSelectedClipIds[0] || null)
          : state.selectedClipId;

      return {
        tracks: newTracks,
        selectedClipId: newSelectedClipId,
        selectedClipIds: newSelectedClipIds,
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
    get().recalcTotalDuration();
  },

  moveClip: (clipId, newStartTime, newTrackId, resolveOverlap = false) => {
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
      if (resolveOverlap) {
        const otherClips = targetTrack.clips.filter((c) => c.id !== clipId);
        const adjustedStart = findNonOverlappingPosition(
          otherClips,
          newStartTime,
          foundClip.duration,
          clipId
        );
        foundClip.startTime = adjustedStart;
      } else {
        foundClip.startTime = Math.max(0, newStartTime);
      }
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
    return true;
  },

  moveClips: (updates, resolveOverlap = false) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => ({ ...c, transform: { ...c.transform } })),
      }));

      const movingClipsMap = new Map<string, TimelineClip>();
      for (const update of updates) {
        for (const track of newTracks) {
          const idx = track.clips.findIndex((c) => c.id === update.clipId);
          if (idx !== -1) {
            const [clip] = track.clips.splice(idx, 1);
            movingClipsMap.set(update.clipId, clip);
            break;
          }
        }
      }

      const sortedUpdates = [...updates].sort((a, b) => a.newStartTime - b.newStartTime);

      for (const update of sortedUpdates) {
        const clip = movingClipsMap.get(update.clipId);
        if (!clip) continue;

        const targetTrackId = update.newTrackId || clip.trackId;
        const targetTrack = newTracks.find((t) => t.id === targetTrackId);

        if (targetTrack) {
          if (resolveOverlap) {
            const adjustedStart = findNonOverlappingPosition(
              targetTrack.clips,
              update.newStartTime,
              clip.duration,
              clip.id
            );
            clip.startTime = adjustedStart;
          } else {
            clip.startTime = Math.max(0, update.newStartTime);
          }
          clip.trackId = targetTrackId;
          targetTrack.clips.push(clip);
        }
      }

      return { tracks: newTracks };
    });
    get().recalcTotalDuration();
  },

  resolveOverlaps: (clipIds) => {
    if (clipIds.length === 0) return;

    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => ({ ...c, transform: { ...c.transform } })),
      }));

      const checkOverlapLocal = (
        clips: TimelineClip[],
        startTime: number,
        duration: number,
        excludeClipId: string
      ): boolean => {
        const endTime = startTime + duration;
        return clips.some((clip) => {
          if (clip.id === excludeClipId || clipIds.includes(clip.id)) return false;
          const clipEnd = clip.startTime + clip.duration;
          return startTime < clipEnd && endTime > clip.startTime;
        });
      };

      for (const clipId of clipIds) {
        let currentClip: TimelineClip | undefined;
        let currentTrack: TimelineTrack | undefined;

        for (const track of newTracks) {
          currentClip = track.clips.find((c) => c.id === clipId);
          if (currentClip) {
            currentTrack = track;
            break;
          }
        }

        if (!currentClip || !currentTrack) continue;

        const otherClipsOnTrack = currentTrack.clips.filter((c) => c.id !== clipId);
        const hasOverlap = checkOverlapLocal(otherClipsOnTrack, currentClip.startTime, currentClip.duration, clipId);

        if (hasOverlap) {
          const sameTypeTracks = newTracks.filter((t) => t.type === currentTrack!.type);
          let foundTrackId = '';

          for (const track of sameTypeTracks) {
            const trackClips = track.clips.filter((c) => c.id !== clipId);
            const overlapsOnThisTrack = checkOverlapLocal(trackClips, currentClip.startTime, currentClip.duration, clipId);
            if (!overlapsOnThisTrack) {
              foundTrackId = track.id;
              break;
            }
          }

          if (foundTrackId) {
            if (foundTrackId !== currentTrack.id) {
              currentTrack.clips = currentTrack.clips.filter((c) => c.id !== clipId);
              currentClip.trackId = foundTrackId;
              const targetTrack = newTracks.find((t) => t.id === foundTrackId);
              if (targetTrack) {
                targetTrack.clips.push(currentClip);
              }
            }
          } else {
            const sameTypeCount = sameTypeTracks.length;
            const newTrackId = `${currentTrack.type === 'video' ? 'v' : 'a'}${sameTypeCount + 1}`;
            const newTrackName = newTrackId.toUpperCase();

            const newTrack: TimelineTrack = {
              id: newTrackId,
              name: newTrackName,
              type: currentTrack.type,
              clips: [],
              locked: false,
              muted: false,
              hidden: false,
              isDynamic: true,
            };

            currentTrack.clips = currentTrack.clips.filter((c) => c.id !== clipId);
            currentClip.trackId = newTrackId;
            newTrack.clips.push(currentClip);

            const lastIdx = newTracks.map((t) => t.type).lastIndexOf(currentTrack.type);
            newTracks.splice(lastIdx + 1, 0, newTrack);
          }
        }
      }

      return { tracks: newTracks };
    });

    get().recalcTotalDuration();
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
      const isSelected = state.selectedClipIds.includes(clipId);
      let leftClipId = '';

      const newTracks = state.tracks.map((track) => {
        const clipIndex = track.clips.findIndex((c) => c.id === clipId);
        if (clipIndex === -1) return track;

        const clip = track.clips[clipIndex];
        const relativeSplitTime = splitTime - clip.startTime;

        if (relativeSplitTime <= 0 || relativeSplitTime >= clip.duration) return track;

        const groupId = clip.splitGroupId || generateId();
        leftClipId = generateId();
        const rightClipId = generateId();

        // Remap speed ramp keyframes for each half when a ramp exists
        let leftSpeedRamp = clip.speedRamp;
        let rightSpeedRamp = clip.speedRamp;
        const hasRamp = clip.speedRamp && clip.speedRamp.length >= 2;

        if (hasRamp) {
          const splitP = relativeSplitTime / clip.duration; // normalized split position

          // Compute the interpolated speed at the split point for boundary keyframes
          // Simple linear interpolation between the two surrounding keyframes
          const sorted = [...clip.speedRamp!].sort((a, b) => a.position - b.position);
          let splitSpeed = sorted[0].speed;
          for (let si = 0; si < sorted.length - 1; si++) {
            if (splitP >= sorted[si].position && splitP <= sorted[si + 1].position) {
              const range = sorted[si + 1].position - sorted[si].position;
              const t = range > 0.0001 ? (splitP - sorted[si].position) / range : 0;
              splitSpeed = sorted[si].speed + t * (sorted[si + 1].speed - sorted[si].speed);
              break;
            }
          }

          // Left half: keyframes in [0, splitP] rescaled to [0, 1], plus a boundary at 1.0
          const leftKeys = sorted
            .filter((kf) => kf.position < splitP)
            .map((kf) => ({
              position: splitP > 0.0001 ? kf.position / splitP : 0,
              speed: kf.speed,
            }));
          // Ensure position 0 exists
          if (leftKeys.length === 0 || leftKeys[0].position > 0.001) {
            leftKeys.unshift({ position: 0, speed: sorted[0].speed });
          }
          leftKeys.push({ position: 1.0, speed: splitSpeed });
          leftSpeedRamp = leftKeys;

          // Right half: keyframes in [splitP, 1] rescaled to [0, 1], plus a boundary at 0.0
          const rightRange = 1.0 - splitP;
          const rightKeys = sorted
            .filter((kf) => kf.position > splitP)
            .map((kf) => ({
              position: rightRange > 0.0001 ? (kf.position - splitP) / rightRange : 1,
              speed: kf.speed,
            }));
          rightKeys.unshift({ position: 0, speed: splitSpeed });
          // Ensure position 1 exists
          if (rightKeys.length < 2 || rightKeys[rightKeys.length - 1].position < 0.999) {
            rightKeys.push({ position: 1.0, speed: sorted[sorted.length - 1].speed });
          }
          rightSpeedRamp = rightKeys;
        }

        const splitMediaTime = hasRamp
          ? getMediaTimeForClip(clip, splitTime)
          : clip.trimStart + relativeSplitTime * clip.speed;

        const originalMediaDuration = hasRamp
          ? getMediaTimeAtPosition(clip.id, clip.speedRamp, 1.0, clip.duration)
          : clip.duration * clip.speed;

        const leftClip: TimelineClip = {
          ...clip,
          id: leftClipId,
          splitGroupId: groupId,
          duration: relativeSplitTime,
          trimEnd: hasRamp
            ? clip.trimEnd + (originalMediaDuration - (splitMediaTime - clip.trimStart))
            : clip.trimEnd + (clip.duration - relativeSplitTime) * clip.speed,
          effects: [...clip.effects],
          speedRamp: leftSpeedRamp,
        };

        const rightClip: TimelineClip = {
          ...clip,
          id: rightClipId,
          splitGroupId: groupId,
          startTime: splitTime,
          duration: clip.duration - relativeSplitTime,
          trimStart: splitMediaTime,
          effects: [...clip.effects],
          transitionIn: undefined, // Clear transition on the second half of the split
          speedRamp: rightSpeedRamp,
        };

        const newClips = [...track.clips];
        newClips.splice(clipIndex, 1, leftClip, rightClip);

        return { ...track, clips: newClips };
      });

      if (isSelected && leftClipId) {
        return {
          tracks: newTracks,
          selectedClipId: leftClipId,
          selectedClipIds: [leftClipId],
        };
      }

      return { tracks: newTracks };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  selectClip: (id, multi = false) =>
    set((state) => {
      if (!id) {
        return {
          selectedClipId: null,
          selectedClipIds: [],
          selectedTransitionClipId: null,
          selectedKeyframeLines: [],
        };
      }
      
      if (!multi) {
        return {
          selectedClipId: id,
          selectedClipIds: [id],
          selectedTransitionClipId: null,
          selectedKeyframeLines: [],
        };
      }

      const isSelected = state.selectedClipIds.includes(id);
      const newIds = isSelected
        ? state.selectedClipIds.filter((cid) => cid !== id)
        : [...state.selectedClipIds, id];

      return {
        selectedClipId: newIds.length > 0 ? newIds[0] : null,
        selectedClipIds: newIds,
        selectedTransitionClipId: null,
      };
    }),
  selectClips: (clipIds) =>
    set({
      selectedClipIds: clipIds,
      selectedClipId: clipIds[0] || null,
      selectedTransitionClipId: null,
    }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  // Transitions
  setShowTransitionLayer: (show) => set({ showTransitionLayer: show }),
  selectTransition: (clipId) =>
    set({
      selectedTransitionClipId: clipId,
      selectedClipId: null,
      selectedClipIds: [],
    }),
  updateTransition: (clipId, updates) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === clipId && clip.transitionIn) {
            return {
              ...clip,
              transitionIn: { ...clip.transitionIn, ...updates },
            };
          }
          return clip;
        }),
      }));
      return { tracks: newTracks };
    });
    get().saveSnapshot();
  },
  removeTransition: (clipId) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === clipId) {
            return {
              ...clip,
              transitionIn: undefined,
            };
          }
          return clip;
        }),
      }));
      return {
        tracks: newTracks,
        selectedTransitionClipId:
          state.selectedTransitionClipId === clipId ? null : state.selectedTransitionClipId,
      };
    });
    get().saveSnapshot();
  },

  // Playback
  play: () => {
    const { tracks, selectedClipIds, currentTime } = get();
    const allClips = tracks.flatMap((t) => t.clips);
    if (allClips.length === 0) return;

    if (selectedClipIds.length > 0) {
      const selectedClips = allClips.filter((c) => selectedClipIds.includes(c.id));
      if (selectedClips.length > 0) {
        let minStart = Infinity;
        let maxEnd = -Infinity;
        for (const c of selectedClips) {
          if (c.startTime < minStart) minStart = c.startTime;
          const end = c.startTime + c.duration;
          if (end > maxEnd) maxEnd = end;
        }
        if (currentTime < minStart || currentTime >= maxEnd) {
          set({ currentTime: minStart });
        }
      }
    }
    set({ isPlaying: true });
  },
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => {
    const { tracks, isPlaying, selectedClipIds, currentTime } = get();
    const allClips = tracks.flatMap((t) => t.clips);
    if (allClips.length === 0 && !isPlaying) return;

    if (!isPlaying && selectedClipIds.length > 0) {
      const selectedClips = allClips.filter((c) => selectedClipIds.includes(c.id));
      if (selectedClips.length > 0) {
        let minStart = Infinity;
        let maxEnd = -Infinity;
        for (const c of selectedClips) {
          if (c.startTime < minStart) minStart = c.startTime;
          const end = c.startTime + c.duration;
          if (end > maxEnd) maxEnd = end;
        }
        if (currentTime < minStart || currentTime >= maxEnd) {
          set({ currentTime: minStart });
        }
      }
    }
    set((state) => ({ isPlaying: !state.isPlaying }));
  },
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
    let prefix = 'v';
    if (type === 'audio') prefix = 'a';
    if (type === 'text') prefix = 't';
    if (type === 'fx') prefix = 'fx';
    
    const id = `${prefix}${get().tracks.filter((t) => t.type === type).length + 1}`;
    
    let linkedTrackId: string | undefined = undefined;
    if (type === 'fx') {
      // Find the first video or text track that doesn't have an FX track linked to it
      const currentTracks = get().tracks;
      const linkedTrackIds = currentTracks.filter(t => t.type === 'fx' && t.linkedTrackId).map(t => t.linkedTrackId);
      const hostTrack = currentTracks.find(t => (t.type === 'video' || t.type === 'text') && !linkedTrackIds.includes(t.id));
      if (hostTrack) {
        linkedTrackId = hostTrack.id;
      }
    }

    set((state) => {
      const newTrack = {
        id,
        name: id.toUpperCase(),
        type,
        linkedTrackId,
        clips: [],
        locked: false,
        muted: false,
        hidden: false,
      };

      let tracks: typeof state.tracks;
      if (type === 'fx' && linkedTrackId) {
        // Insert the FX track directly above its linked host track
        const hostIdx = state.tracks.findIndex(t => t.id === linkedTrackId);
        if (hostIdx !== -1) {
          tracks = [
            ...state.tracks.slice(0, hostIdx),
            newTrack,
            ...state.tracks.slice(hostIdx),
          ];
        } else {
          tracks = [newTrack, ...state.tracks];
        }
      } else if (type === 'text' || type === 'video') {
        tracks = [newTrack, ...state.tracks];
      } else {
        // audio — append at end
        tracks = [...state.tracks, newTrack];
      }

      return { tracks };
    });
    get().saveSnapshot();
  },
  removeTrack: (trackId) => {
    set((state) => {
      let updatedTracks = state.tracks.filter((t) => t.id !== trackId);
      // Unlink any fx tracks that were linked to this track
      updatedTracks = updatedTracks.map(t => t.linkedTrackId === trackId ? { ...t, linkedTrackId: undefined } : t);
      return { tracks: updatedTracks };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },
  reorderTrack: (trackId: string, newIndex: number) => {
    set((state) => {
      const tracks = [...state.tracks];
      const oldIndex = tracks.findIndex(t => t.id === trackId);
      if (oldIndex === -1) return state;
      
      const [track] = tracks.splice(oldIndex, 1);
      tracks.splice(newIndex, 0, track);
      
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].type === 'fx') {
          let newLink = undefined;
          // Search downwards first
          for (let j = i + 1; j < tracks.length; j++) {
            if (tracks[j].type === 'video' || tracks[j].type === 'text') {
              newLink = tracks[j].id;
              break;
            }
          }
          // Fallback: search upwards
          if (!newLink) {
            for (let j = i - 1; j >= 0; j--) {
              if (tracks[j].type === 'video' || tracks[j].type === 'text') {
                newLink = tracks[j].id;
                break;
              }
            }
          }
          tracks[i] = { ...tracks[i], linkedTrackId: newLink };
        }
      }
      
      return { tracks };
    });
    get().saveSnapshot();
  },

  // UI
  setActiveMediaTab: (tab) => set({ activeMediaTab: tab }),
  setActivePropertiesTab: (tab) => set({ activePropertiesTab: tab }),
  setShowExportModal: (show) => set({ showExportModal: show }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setCanvasTransformMode: (mode) => set({ canvasTransformMode: mode }),

  setPreviewCanvas: (canvas) => set({ previewCanvas: canvas }),
  setMasterAudioStream: (stream) => set({ masterAudioStream: stream }),

  addMasterKeyframe: (clipId, time, values) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId) return c;
          const anims: any = c.animations ? { ...c.animations } : {};
          const props = [
            { k: 'transform.x', v: values.transform.x },
            { k: 'transform.y', v: values.transform.y },
            { k: 'transform.scale', v: values.transform.scale },
            { k: 'transform.rotation', v: values.transform.rotation },
            { k: 'crop.top', v: values.crop.top },
            { k: 'crop.bottom', v: values.crop.bottom },
            { k: 'crop.left', v: values.crop.left },
            { k: 'crop.right', v: values.crop.right },
          ];
          
          props.forEach(p => {
            if (p.v === undefined) return;
            const track = anims[p.k] || [];
            const existingIdx = track.findIndex((kf: any) => Math.abs(kf.time - time) < 0.05);
            const newTrack = [...track];
            if (existingIdx >= 0) newTrack[existingIdx] = { time, value: p.v };
            else newTrack.push({ time, value: p.v });
            newTrack.sort((a, b) => a.time - b.time);
            anims[p.k] = newTrack;
          });

          return { ...c, animations: anims };
        })
      }));
      return { tracks: newTracks };
    });
  },

  deleteMasterKeyframe: (clipId, time) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId || !c.animations) return c;
          
          let updatedClip = { ...c };
          const anims: any = { ...c.animations };
          
          Object.keys(anims).forEach(k => {
            if (anims[k]) {
              const kfToDelete = anims[k].find((kf: any) => Math.abs(kf.time - time) < 0.05);
              if (kfToDelete) {
                // Update base value to prevent snapping when all keyframes are deleted
                const parts = k.split('.');
                if (parts[0] === 'transform' || parts[0] === 'crop') {
                  updatedClip = {
                    ...updatedClip,
                    [parts[0]]: { ...(updatedClip as any)[parts[0]], [parts[1]]: kfToDelete.value }
                  };
                } else if (parts[0] === 'opacity') {
                  updatedClip.opacity = kfToDelete.value;
                }
              }
              anims[k] = anims[k].filter((kf: any) => Math.abs(kf.time - time) >= 0.05);
              if (anims[k].length === 0) delete anims[k];
            }
          });
          
          updatedClip.animations = anims;
          return updatedClip;
        })
      }));
      return { tracks: newTracks };
    });
  },

  moveMasterKeyframe: (clipId, oldTime, newTime) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId || !c.animations) return c;
          const anims: any = { ...c.animations };
          Object.keys(anims).forEach(k => {
            if (anims[k]) {
              const newTrack = [...anims[k]];
              const idx = newTrack.findIndex((kf: any) => Math.abs(kf.time - oldTime) < 0.05);
              if (idx >= 0) {
                newTrack[idx] = { ...newTrack[idx], time: newTime };
                newTrack.sort((a, b) => a.time - b.time);
                anims[k] = newTrack;
              }
            }
          });
          return { ...c, animations: anims };
        })
      }));
      return { tracks: newTracks };
    });
  },

  breakMasterKeyframeLink: (clipId, time) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId || !c.animations) return c;
          const anims: any = { ...c.animations };
          Object.keys(anims).forEach(k => {
            if (anims[k]) {
              const newTrack = [...anims[k]];
              const idx = newTrack.findIndex((kf: any) => Math.abs(kf.time - time) < 0.05);
              if (idx >= 0) {
                newTrack[idx] = { ...newTrack[idx], holdNext: true };
                anims[k] = newTrack;
              }
            }
          });
          return { ...c, animations: anims };
        })
      }));
      return { tracks: newTracks };
    });
  },

  toggleKeyframeLineSelection: (clipId, time, multi = false) => set((state) => {
    const isSelected = state.selectedKeyframeLines.some(l => l.clipId === clipId && l.time === time);
    if (multi) {
      if (isSelected) {
        return { selectedKeyframeLines: state.selectedKeyframeLines.filter(l => !(l.clipId === clipId && l.time === time)) };
      } else {
        return { selectedKeyframeLines: [...state.selectedKeyframeLines, { clipId, time }] };
      }
    } else {
      return { selectedKeyframeLines: [{ clipId, time }] };
    }
  }),

  removeSelectedKeyframeLines: () => set((state) => {
    if (state.selectedKeyframeLines.length === 0) return state;
    const newTracks = state.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => {
        const linesForClip = state.selectedKeyframeLines.filter((l: any) => l.clipId === c.id);
        if (linesForClip.length === 0 || !c.animations) return c;
        const anims: any = { ...c.animations };
        Object.keys(anims).forEach(k => {
          if (anims[k]) {
            const newTrack = [...anims[k]];
            let changed = false;
            linesForClip.forEach((line: any) => {
              const idx = newTrack.findIndex((kf: any) => Math.abs(kf.time - line.time) < 0.05);
              if (idx >= 0) {
                newTrack[idx] = { ...newTrack[idx], holdNext: true };
                changed = true;
              }
            });
            if (changed) anims[k] = newTrack;
          }
        });
        return { ...c, animations: anims };
      })
    }));
    return { tracks: newTracks, selectedKeyframeLines: [] };
  }),

  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

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
    // Auto-save to IndexedDB
    const { tracks, mediaLibrary, currentTime } = get();
    saveProjectToDB({ tracks, mediaLibrary, currentTime }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
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
    const { tracks, mediaLibrary, currentTime } = get();
    saveProjectToDB({ tracks, mediaLibrary, currentTime }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
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
    const { tracks, mediaLibrary, currentTime } = get();
    saveProjectToDB({ tracks, mediaLibrary, currentTime }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
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
    // Clear IndexedDB completely
    clearProjectDB().catch(err => console.error('Failed to clear database:', err));
    const freshTracks = createEmptyTracks();
    set({
      ...initialState,
      tracks: freshTracks,
      history: [
        {
          tracks: JSON.parse(JSON.stringify(freshTracks)),
          currentTime: 0,
        },
      ],
      historyIndex: 0,
    });
  },

  loadProject: async () => {
    try {
      const data = await loadProjectFromDB();
      if (!data) return false;
      
      set({
        tracks: data.tracks,
        mediaLibrary: data.mediaLibrary,
        currentTime: data.currentTime,
        history: [
          {
            tracks: JSON.parse(JSON.stringify(data.tracks)),
            currentTime: data.currentTime
          }
        ],
        historyIndex: 0
      });
      get().recalcTotalDuration();
      return true;
    } catch (err) {
      console.error('Failed to load project:', err);
      return false;
    }
  },

  // Recalculate total duration from all clips and clean up empty custom tracks
  recalcTotalDuration: () => {
    const { tracks } = get();
    
    // Filter out custom tracks that are dynamic and empty
    const cleanedTracks = tracks.filter(
      (t) => !(t.isDynamic && t.clips.length === 0)
    );

    let maxEnd = 0;
    for (const track of cleanedTracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    // Set totalDuration exactly to maxEnd
    set({
      tracks: cleanedTracks,
      totalDuration: maxEnd,
    });
  },
}));
