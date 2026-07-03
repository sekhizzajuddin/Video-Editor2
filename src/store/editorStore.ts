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
  OverLayerClip,
} from '@/types';
import { getMediaTimeForClip, getMediaTimeAtPosition } from '@/utils/speedRamp';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, loadProjectFromDB, clearProjectDB } from '@/utils/projectPersistence';


const generateId = () => Math.random().toString(36).substr(2, 9);

// Track whether we are inside a transaction (e.g. during drag / resize).
// When true, saveSnapshot() does not push to history.
let _inTransaction = false;

// Create empty tracks
const createEmptyTracks = (): TimelineTrack[] => [
  {
    id: 'v1',
    name: 'V1',
    type: 'video',
    clips: [],
    overLayers: [],
    locked: false,
    muted: false,
    hidden: false,
    volume: 1,
    pan: 0,
    solo: false,
  },
  {
    id: 'v2',
    name: 'V2',
    type: 'video',
    clips: [],
    overLayers: [],
    locked: false,
    muted: false,
    hidden: false,
    volume: 1,
    pan: 0,
    solo: false,
  },
  {
    id: 'a1',
    name: 'A1',
    type: 'audio',
    clips: [],
    overLayers: [],
    locked: false,
    muted: false,
    hidden: false,
    volume: 1,
    pan: 0,
    solo: false,
  },
  {
    id: 'a2',
    name: 'A2',
    type: 'audio',
    clips: [],
    overLayers: [],
    locked: false,
    muted: false,
    hidden: false,
    volume: 1,
    pan: 0,
    solo: false,
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

  // Over Layer Operations
  addOverLayer: (trackId: string) => void;
  removeOverLayer: (overLayerId: string) => void;
  updateOverLayer: (overLayerId: string, updates: Partial<OverLayerClip>) => void;
  moveOverLayer: (overLayerId: string, newStartTime: number) => void;
  reorderOverLayer: (overLayerId: string, targetRowIdx: number) => void;
  selectOverLayer: (overLayerId: string | null) => void;
  setHoveredOverLayerRegion: (region: EditorState['hoveredOverLayerRegion']) => void;
  setPinnedOverLayerTrackId: (trackId: string | null) => void;

  // Playback
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaybackDirection: (dir: -1 | 0 | 1, speed?: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setTotalDuration: (duration: number) => void;
  setInPoint: (time: number | null) => void;
  setOutPoint: (time: number | null) => void;

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
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  toggleTrackSolo: (trackId: string) => void;
  addTrack: (type: 'video' | 'audio' | 'text' | 'fx') => void;
  removeTrack: (trackId: string) => void;
  reorderTrack: (trackId: string, newIndex: number) => void;

  // UI
  setActiveMediaTab: (tab: MediaTab) => void;
  setActivePropertiesTab: (tab: PropertiesTab) => void;
  setShowExportModal: (show: boolean) => void;
  setIsExporting: (isExporting: boolean) => void;
  setExportFps: (fps: number) => void;
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
  startTransaction: () => void;
  endTransaction: () => void;

  // Master Keyframes
  addMasterKeyframe: (clipId: string, time: number, values: any) => void;
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

  // Audio/Video Unlink
  unlinkAudio: (clipId: string) => void;
  breakLinkConnection: (clipId: string) => void;

  // Timeline Markers
  addMarker: (time: number, name?: string, color?: string) => void;
  updateMarker: (id: string, updates: Partial<import('@/types').TimelineMarker>) => void;
  removeMarker: (id: string) => void;

  // Beat Markers
  addBeatMarkers: (clipId: string, times: number[]) => void;
  clearBeatMarkers: (clipId: string) => void;
}

const defaultTracks = createEmptyTracks();
const initialState: EditorState = {
  mediaLibrary: [],
  tracks: defaultTracks,
  selectedClipId: null,
  selectedClipIds: [],
  selectedOverLayerId: null,
  hoveredOverLayerRegion: null,
  pinnedOverLayerTrackId: null,
  selectedTransitionClipId: null,
  selectedKeyframeLines: [],
  selectedTrackId: null,
  settings: {
    scrollSpeed: 1,
    gestureSensitivity: 1,
    autosave: true,
    showWaveform: true,
    snapEnabled: true,
    defaultDuration: 5,
    previewQuality: 'full',
    showThumbnails: true,
    hardwareAcceleration: true,
  },
  hasUnsavedChanges: false,
  currentTime: 0,
  isPlaying: false,
  totalDuration: 0,
  playbackSpeed: 1,
  playbackDirection: 1,
  isMuted: false,
  volume: 1,
  inPoint: null,
  outPoint: null,
  markers: [],
  beatMarkers: [],
  zoomLevel: 80,
  scrollLeft: 0,
  activeTool: 'select',
  isExporting: false,
  exportFps: 30,
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
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts && targetTrack.clips.some((c) => Math.max(0, Math.min(startTime + 3, c.startTime + c.duration) - Math.max(startTime, c.startTime)) > 0)) {
       startTime += 3.1;
       attempts++;
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
    let success = false;
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => ({ ...c, transform: { ...c.transform } })),
      }));

      // Find and remove the clip
      let foundClip: TimelineClip | undefined;
      for (const track of newTracks) {
        const idx = track.clips.findIndex((c) => c.id === clipId);
        if (idx !== -1) {
          const [clip] = track.clips.splice(idx, 1);
          foundClip = clip;
          break;
        }
      }

      if (!foundClip) return {};

      const oldStartTime = foundClip.startTime;
      const deltaTime = newStartTime - oldStartTime;

      const targetTrackId = newTrackId || foundClip.trackId;
      const targetTrack = newTracks.find((t) => t.id === targetTrackId);

      if (targetTrack) {
        if (resolveOverlap) {
          const adjustedStart = findNonOverlappingPosition(
            targetTrack.clips,
            newStartTime,
            foundClip.duration,
            clipId
          );
          foundClip.startTime = adjustedStart;
        } else {
          foundClip.startTime = Math.max(0, newStartTime);
        }
        foundClip.trackId = targetTrackId;
        targetTrack.clips.push(foundClip);
        success = true;

        // Also move linked clip if it exists
        if (foundClip.linkedClipId) {
          let linkedClip: TimelineClip | undefined;
          for (const track of newTracks) {
            linkedClip = track.clips.find((c) => c.id === foundClip!.linkedClipId);
            if (linkedClip) break;
          }
          if (linkedClip) {
            linkedClip.startTime = Math.max(0, linkedClip.startTime + deltaTime);
          }
        }
      }

      return { tracks: newTracks };
    });

    if (success) {
      get().recalcTotalDuration();
    }
    return success;
  },

  moveClips: (updates, resolveOverlap = false) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => ({ ...c, transform: { ...c.transform } })),
      }));

      const movingClipsMap = new Map<string, TimelineClip>();
      const updatedClipIds = new Set(updates.map(u => u.clipId));

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

        const oldStartTime = clip.startTime;
        const deltaTime = update.newStartTime - oldStartTime;

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

          // If this clip has a linked clip and the linked clip is NOT also in the moving set,
          // move the linked clip by the same delta
          if (clip.linkedClipId && !updatedClipIds.has(clip.linkedClipId)) {
            let linkedClip: TimelineClip | undefined;
            for (const track of newTracks) {
              linkedClip = track.clips.find((c) => c.id === clip.linkedClipId);
              if (linkedClip) break;
            }
            if (linkedClip) {
              linkedClip.startTime = Math.max(0, linkedClip.startTime + deltaTime);
            }
          }
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
              overLayers: [],
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
      // Check if it's an over-layer
      const isOl = state.tracks.some((t) => (t.overLayers || []).some((ol) => ol.id === clipId));
      if (isOl) {
        let leftClipId = '';
        const newTracks = state.tracks.map((track) => {
          const olIndex = (track.overLayers || []).findIndex((ol) => ol.id === clipId);
          if (olIndex === -1) return track;

          const ol = track.overLayers[olIndex];
          const relativeSplitTime = splitTime - ol.startTime;

          if (relativeSplitTime <= 0 || relativeSplitTime >= ol.duration) return track;

          leftClipId = generateId();
          const rightClipId = generateId();

          const leftOl: OverLayerClip = {
            ...ol,
            id: leftClipId,
            duration: relativeSplitTime,
            trimEnd: ol.trimEnd + (ol.duration - relativeSplitTime) * ol.speed,
            effects: [...ol.effects],
          };

          const rightOl: OverLayerClip = {
            ...ol,
            id: rightClipId,
            startTime: splitTime,
            duration: ol.duration - relativeSplitTime,
            trimStart: ol.trimStart + relativeSplitTime * ol.speed,
            effects: [...ol.effects],
          };

          const newOls = [...track.overLayers];
          newOls.splice(olIndex, 1, leftOl, rightOl);

          return { ...track, overLayers: newOls };
        });

        const isSelected = state.selectedOverLayerId === clipId;
        return {
          tracks: newTracks,
          selectedOverLayerId: isSelected ? leftClipId : state.selectedOverLayerId,
        };
      }

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

  // Audio/Video Unlink — splits the audio component of a video clip into its own
  // audio clip on the first available (or new) audio track, at the same position.
  unlinkAudio: (clipId) => {
    const { tracks, mediaLibrary } = get();
    const videoClip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!videoClip) return;

    const media = mediaLibrary.find((m) => m.id === videoClip.mediaId);
    // Only video clips with audio can be unlinked
    if (!media || media.type !== 'video') return;

    // If already unlinked, do nothing
    if (videoClip.linkedClipId) return;

    // Find an existing audio track to place the new audio clip
    let audioTrackId = tracks.find((t) => t.type === 'audio')?.id ?? null;

    const newAudioClipId = generateId();

    // Build new audio clip mirroring the video clip position/duration
    const audioClip = {
      id: newAudioClipId,
      mediaId: videoClip.mediaId,
      trackId: audioTrackId ?? 'a1',
      startTime: videoClip.startTime,
      duration: videoClip.duration,
      trimStart: videoClip.trimStart,
      trimEnd: videoClip.trimEnd,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: videoClip.speed,
      effects: [],
      linkedClipId: clipId,
      audioSettings: videoClip.audioSettings
        ? { ...videoClip.audioSettings, muted: false }
        : {
            volume: 0,
            pan: 0,
            fadeIn: 0,
            fadeOut: 0,
            bass: 0,
            treble: 0,
            muted: false,
            preservePitch: true,
            pitch: 0,
            voiceFormant: 0,
            humanize: false,
          },
    } as import('@/types').TimelineClip;

    set((state) => {
      const updatedTracks = state.tracks.map((track) => {
        // Tag the original video clip with linkedClipId AND mute its audio
        if (track.clips.some((c) => c.id === clipId)) {
          return {
            ...track,
            clips: track.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    linkedClipId: newAudioClipId,
                    audioSettings: {
                      ...(c.audioSettings || {
                        volume: 0,
                        pan: 0,
                        fadeIn: 0,
                        fadeOut: 0,
                        bass: 0,
                        treble: 0,
                        muted: false,
                        preservePitch: true,
                        pitch: 0,
                        voiceFormant: 0,
                        humanize: false,
                      }),
                      muted: true,
                    },
                  }
                : c
            ),
          };
        }
        // Add the new audio clip to the audio track
        if (audioTrackId && track.id === audioTrackId) {
          return { ...track, clips: [...track.clips, audioClip] };
        }
        return track;
      });

      // If no audio track existed, we cannot place it — fall back to creating one
      const hasAudioTrack = updatedTracks.some((t) => t.type === 'audio');
      if (!hasAudioTrack) {
        const newTrackId = `a_${generateId()}`;
        updatedTracks.push({
          id: newTrackId,
          name: 'A1',
          type: 'audio',
          clips: [{ ...audioClip, trackId: newTrackId }],
          locked: false,
          muted: false,
          hidden: false,
          overLayers: [],
        });
      }

      return { tracks: updatedTracks };
    });
    get().saveSnapshot();
  },

  breakLinkConnection: (clipId) => {
    set((state) => {
      const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
      if (!clip) return {};
      const linkedClipId = clip.linkedClipId;

      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => {
          if (c.id === clipId || (linkedClipId && c.id === linkedClipId)) {
            // Remove the link reference from both
            const { linkedClipId: _, ...rest } = c;
            return rest as TimelineClip;
          }
          return c;
        }),
      }));
      return { tracks: newTracks };
    });
    get().saveSnapshot();
  },


  addMarker: (time, name, color = '#fbbf24') => {
    const marker = {
      id: generateId(),
      time,
      name: name || `Marker ${get().markers.length + 1}`,
      color,
    };
    set((state) => ({
      markers: [...state.markers, marker],
    }));
  },
  updateMarker: (id, updates) => {
    set((state) => ({
      markers: state.markers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  },
  removeMarker: (id) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }));
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
    set({ isPlaying: true, playbackDirection: 1 });
  },
  pause: () => set({ isPlaying: false, playbackDirection: 0 }),
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
    set((state) => ({ 
      isPlaying: !state.isPlaying, 
      playbackDirection: !state.isPlaying ? 1 : 0 
    }));
  },
  seek: (time) => set({ currentTime: Math.max(0, time) }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setPlaybackDirection: (dir, speed = 1) => {
    if (dir === 0) {
      set({ isPlaying: false, playbackDirection: 0, playbackSpeed: 1 });
    } else {
      set({ isPlaying: true, playbackDirection: dir, playbackSpeed: speed });
    }
  },
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  setInPoint: (time) => set({ inPoint: time }),
  setOutPoint: (time) => set({ outPoint: time }),

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
  setTrackVolume: (trackId, volume) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, volume } : t
      ),
    })),
  setTrackPan: (trackId, pan) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, pan } : t
      ),
    })),
  toggleTrackSolo: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, solo: !t.solo } : t
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
        overLayers: [],
        locked: false,
        muted: false,
        hidden: false,
        volume: 1,
        pan: 0,
        solo: false,
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
  setIsExporting: (isExporting) => set({ isExporting }),
  setExportFps: (exportFps) => set({ exportFps }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setCanvasTransformMode: (mode) => set({ canvasTransformMode: mode }),

  setPreviewCanvas: (canvas) => set({ previewCanvas: canvas }),
  setMasterAudioStream: (stream) => set({ masterAudioStream: stream }),

  addMasterKeyframe: (clipId, time, values) => {
    set((state) => {
      const updateClipKeyframes = (c: any) => {
        if (c.id !== clipId) return c;
        const anims: any = c.animations ? { ...c.animations } : {};
        const props = [
          { k: 'transform.x', v: values.transform?.x },
          { k: 'transform.y', v: values.transform?.y },
          { k: 'transform.scale', v: values.transform?.scale },
          { k: 'transform.rotation', v: values.transform?.rotation },
          { k: 'crop.top', v: values.crop?.top },
          { k: 'crop.bottom', v: values.crop?.bottom },
          { k: 'crop.left', v: values.crop?.left },
          { k: 'crop.right', v: values.crop?.right },
          { k: 'opacity', v: values.opacity },
          { k: 'audio.volume', v: values.audio?.volume },
          { k: 'audio.pan', v: values.audio?.pan },
          { k: 'color.temperature', v: values.color?.temperature },
          { k: 'color.tint', v: values.color?.tint },
          { k: 'color.exposure', v: values.color?.exposure },
          { k: 'color.contrast', v: values.color?.contrast },
          { k: 'color.saturation', v: values.color?.saturation },
          { k: 'color.blur', v: values.color?.blur },
          { k: 'color.fadedFilm', v: values.color?.fadedFilm },
          { k: 'color.vignette', v: values.color?.vignette },
        ];
        
        props.forEach(p => {
          if (p.v === undefined) return;
          const track = anims[p.k] || [];
          const existingIdx = track.findIndex((kf: any) => Math.abs(kf.time - time) < 0.05);
          const newTrack = [...track];
          if (existingIdx >= 0) newTrack[existingIdx] = { ...newTrack[existingIdx], time, value: p.v };
          else newTrack.push({ time, value: p.v });
          newTrack.sort((a, b) => a.time - b.time);
          anims[p.k] = newTrack;
        });

        return { ...c, animations: anims };
      };

      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map(updateClipKeyframes),
        overLayers: (t.overLayers || []).map(updateClipKeyframes),
      }));
      return { tracks: newTracks };
    });
  },

  deleteMasterKeyframe: (clipId, time) => {
    set((state) => {
      const deleteClipKeyframe = (c: any) => {
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
              } else if (parts[0] === 'color') {
                updatedClip = {
                  ...updatedClip,
                  colorFilters: { ...(updatedClip.colorFilters || {}), [parts[1]]: kfToDelete.value } as any
                };
              } else if (parts[0] === 'audio') {
                updatedClip = {
                  ...updatedClip,
                  audioSettings: { ...(updatedClip.audioSettings || {}), [parts[1]]: kfToDelete.value } as any
                };
              }
            }
            anims[k] = anims[k].filter((kf: any) => Math.abs(kf.time - time) >= 0.05);
            if (anims[k].length === 0) delete anims[k];
          }
        });
        
        updatedClip.animations = anims;
        return updatedClip;
      };

      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map(deleteClipKeyframe),
        overLayers: (t.overLayers || []).map(deleteClipKeyframe),
      }));
      return { tracks: newTracks };
    });
  },

  moveMasterKeyframe: (clipId, oldTime, newTime) => {
    set((state) => {
      const moveClipKeyframe = (c: any) => {
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
      };

      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map(moveClipKeyframe),
        overLayers: (t.overLayers || []).map(moveClipKeyframe),
      }));
      return { tracks: newTracks };
    });
  },

  breakMasterKeyframeLink: (clipId, time) => {
    set((state) => {
      const breakClipKeyframe = (c: any) => {
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
      };

      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map(breakClipKeyframe),
        overLayers: (t.overLayers || []).map(breakClipKeyframe),
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

  // History with transaction support
  saveSnapshot: () => {
    set((state) => {
      if (_inTransaction) return {}; // Skip if inside a transaction
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
  startTransaction: () => {
    _inTransaction = true;
  },
  endTransaction: () => {
    _inTransaction = false;
    get().saveSnapshot(); // Save one snapshot after the transaction completes
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
      
      const loadedTracks = data.tracks.map((t: any) => ({
        ...t,
        overLayers: t.overLayers || [],
      }));

      set({
        tracks: loadedTracks,
        mediaLibrary: data.mediaLibrary,
        currentTime: data.currentTime,
        history: [
          {
            tracks: JSON.parse(JSON.stringify(loadedTracks)),
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
      for (const ol of track.overLayers || []) {
        const end = ol.startTime + ol.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    // Set totalDuration with a minimum floor of 0.1 to avoid unusable slider empty state
    set({
      tracks: cleanedTracks,
      totalDuration: maxEnd || 0.1,
    });
  },

  // Over Layer Operations
  addOverLayer: (trackId) => {
    const { currentTime } = get();
    const id = generateId();
    const newOverLayer: OverLayerClip = {
      id,
      mediaId: null,
      trackId,
      startTime: currentTime,
      duration: 3,
      trimStart: 0,
      trimEnd: 0,
      transform: {
        x: 0,
        y: 0,
        scale: 50, // default PIP scale 50%
        rotation: 0,
      },
      opacity: 1,
      speed: 1,
      effects: [],
    };
    set((state) => {
      const newTracks = state.tracks.map((t) => {
        if (t.id === trackId) {
          return {
            ...t,
            overLayers: [...(t.overLayers || []), newOverLayer],
          };
        }
        return t;
      });
      return {
        tracks: newTracks,
        selectedOverLayerId: id,
        selectedClipId: null,
        selectedClipIds: [],
        selectedTrackId: null,
      };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  removeOverLayer: (overLayerId) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        overLayers: (t.overLayers || []).filter((ol) => ol.id !== overLayerId),
      }));
      const wasSelected = state.selectedOverLayerId === overLayerId;
      return {
        tracks: newTracks,
        selectedOverLayerId: wasSelected ? null : state.selectedOverLayerId,
        pinnedOverLayerTrackId: wasSelected ? null : state.pinnedOverLayerTrackId,
      };
    });
    get().recalcTotalDuration();
    get().saveSnapshot();
  },

  updateOverLayer: (overLayerId, updates) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        overLayers: (t.overLayers || []).map((ol) =>
          ol.id === overLayerId ? { ...ol, ...updates } : ol
        ),
      }));
      return { tracks: newTracks };
    });
    get().recalcTotalDuration();
  },

  moveOverLayer: (overLayerId, newStartTime) => {
    const startTime = Math.max(0, newStartTime);
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        overLayers: (t.overLayers || []).map((ol) =>
          ol.id === overLayerId ? { ...ol, startTime } : ol
        ),
      }));
      return { tracks: newTracks };
    });
    get().recalcTotalDuration();
  },

  reorderOverLayer: (overLayerId, targetRowIdx) => {
    set((state) => {
      const track = state.tracks.find((t) => (t.overLayers || []).some((ol) => ol.id === overLayerId));
      if (!track) return {};
      
      const hoveredOverLayerRegion = state.hoveredOverLayerRegion;
      if (!hoveredOverLayerRegion) return {};
      
      const activeOverLayers = (track.overLayers || []).filter((ol) => {
        return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
      });
      
      const currentIdxInActive = activeOverLayers.findIndex((ol) => ol.id === overLayerId);
      if (currentIdxInActive === -1 || targetRowIdx === currentIdxInActive || targetRowIdx >= activeOverLayers.length) return {};
      
      const reordered = [...track.overLayers];
      const itemToMove = activeOverLayers[currentIdxInActive];
      const targetItem = activeOverLayers[targetRowIdx];
      
      const originalIdx = reordered.findIndex((ol) => ol.id === itemToMove.id);
      const targetOriginalIdx = reordered.findIndex((ol) => ol.id === targetItem.id);
      
      if (originalIdx !== -1 && targetOriginalIdx !== -1) {
        reordered.splice(originalIdx, 1);
        reordered.splice(targetOriginalIdx, 0, itemToMove);
        
        return {
          tracks: state.tracks.map((t) =>
            t.id === track.id ? { ...t, overLayers: reordered } : t
          ),
        };
      }
      return {};
    });
  },

  selectOverLayer: (overLayerId) => {
    // Find which track owns this over-layer so it stays pinned
    let owningTrackId: string | null = null;
    if (overLayerId) {
      const state = get();
      for (const t of state.tracks) {
        if ((t.overLayers || []).some((ol) => ol.id === overLayerId)) {
          owningTrackId = t.id;
          break;
        }
      }
    }
    set({
      selectedOverLayerId: overLayerId,
      selectedClipId: null,
      selectedClipIds: [],
      selectedTrackId: null,
      pinnedOverLayerTrackId: owningTrackId,
    });
  },

  setHoveredOverLayerRegion: (region) => {
    set({ hoveredOverLayerRegion: region });
  },

  setPinnedOverLayerTrackId: (trackId) => {
    set({ pinnedOverLayerTrackId: trackId });
  },

  // Keyboard Delete — remove selected over-layer or clip
  removeSelected: () => {
    const state = get();
    if (state.selectedOverLayerId) {
      state.removeOverLayer(state.selectedOverLayerId);
    } else if (state.selectedClipId) {
      state.removeClip(state.selectedClipId);
    } else if (state.selectedClipIds.length > 1) {
      state.selectedClipIds.forEach((id) => state.removeClip(id));
    }
  },

  // Beat Markers
  addBeatMarkers: (clipId, times) => {
    set((state) => ({
      beatMarkers: [
        ...state.beatMarkers.filter((b) => b.clipId !== clipId),
        ...times.map((time) => ({ time, clipId })),
      ].sort((a, b) => a.time - b.time),
    }));
  },
  clearBeatMarkers: (clipId) => {
    set((state) => ({
      beatMarkers: state.beatMarkers.filter((b) => b.clipId !== clipId),
    }));
  },
}));
