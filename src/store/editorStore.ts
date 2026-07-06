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
  ProjectTemplate,
} from '@/types';
import { getMediaTimeForClip, getMediaTimeAtPosition } from '@/utils/speedRamp';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, loadProjectFromDB, clearProjectDB, saveTemplatesToDB, getTemplatesFromDB, resolveMediaItemFromDB, setActiveProject, saveProjectMeta } from '@/utils/projectPersistence';


const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).substr(2, 9);

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
  createFolder: (name: string, parentId?: string | null) => void;
  deleteFolder: (id: string) => void;
  moveMediaToFolder: (mediaId: string, folderId: string | null) => void;

  // Timeline Operations
  addClip: (clip: TimelineClip) => void;
  insertTextClip: (settings: Partial<ClipTextSettings>) => void;
  importSubtitles: (parsedSubs: {startTime: number, duration: number, text: string}[]) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string, resolveOverlap?: boolean) => boolean;
  moveClips: (updates: { clipId: string; newStartTime: number; newTrackId?: string }[], resolveOverlap?: boolean) => void;
  resolveOverlaps: (clipIds: string[]) => void;
  tryMoveClip: (clipId: string, newStartTime: number, newTrackId?: string) => { canMove: boolean; newPosition: number };
  splitClip: (clipId: string, splitTime: number) => void;
  applyAutoCuts: (clipId: string, aggressiveness: 'low' | 'medium' | 'high') => void;
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
  setShowScopes: (show: boolean) => void;
  setIsExporting: (isExporting: boolean) => void;
  setExportFps: (fps: number) => void;
  setExportDimensions: (width: number, height: number) => void;
  setShowSettingsModal: (show: boolean) => void;
  setShowTeleprompter: (show: boolean) => void;
  setShowHelpMenu: (show: boolean, section?: string | null) => void;
  setUseProxies: (use: boolean) => void;
  syncSelectedClips: () => void;
  setShowProgressBar: (show: boolean) => void;
  setProgressBarColor: (color: string) => void;
  setProgressBarHeight: (height: number) => void;
  setCanvasTransformMode: (mode: 'resize' | 'crop') => void;

  setPreviewCanvas: (canvas: HTMLCanvasElement | null) => void;
  setMasterAudioStream: (stream: MediaStream | null) => void;

  // Clipboard
  copyClip: (type?: 'clip' | 'style' | 'whole') => void;
  pasteClip: (type?: 'clip' | 'style' | 'whole') => void;
  clearClipboard: () => void;
  cutClip: () => void;
  duplicateClip: () => void;

  // History
  undo: () => void;
  redo: () => void;
  saveSnapshot: (label?: string) => void;
  jumpToHistoryIndex: (index: number) => void;
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

  // Voiceover Recording State
  startVoiceoverRecordingState: (trackId: string) => void;
  stopVoiceoverRecordingState: () => void;

  // Project
  resetProject: () => void;
  loadProject: () => Promise<boolean>;
  setProjectInfo: (id: string, name: string) => void;

  // Computed: recalculate total duration from all clips
  recalcTotalDuration: () => void;
  setAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:3') => void;
  reframeProject: (ratio: '16:9' | '9:16' | '1:1' | '4:3') => void;

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

  // Project Templates
  saveProjectAsTemplate: (name: string, description: string) => Promise<void>;
  deleteProjectTemplate: (templateId: string) => Promise<void>;

  // Layout Presets
  setWorkspaceLayout: (layout: EditorState['workspaceLayout']) => void;

  // Compound Clips
  enterCompoundClip: (clipId: string) => void;
  exitCompoundClip: () => void;
  loadProjectTemplate: (templateId: string) => Promise<void>;
  loadTemplatesFromDB: () => Promise<void>;
}

const defaultTracks = createEmptyTracks();
const initialState: EditorState = {
  projectId: 'default',
  projectName: 'Untitled Project',
  mediaLibrary: [],
  folders: [],
  tracks: defaultTracks,
  timelineStack: [],
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
    keyboardShortcuts: {},
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
  projectTemplates: [],
  aspectRatio: '16:9',
  zoomLevel: 80,
  scrollLeft: 0,
  activeTool: 'select',
  isExporting: false,
  exportFps: 30,
  exportWidth: 854,
  exportHeight: 480,
  showExportModal: false,
  showScopes: false,
  showSettingsModal: false,
  showTeleprompter: false,
  showHelpMenu: false,
  activeHelpSection: null,
  useProxies: false,
  showProgressBar: false,
  progressBarColor: '#ef4444', // Default to red (like YouTube/TikTok)
  progressBarHeight: 4,
  isRecordingVoiceover: false,
  recordingTrackId: null,
  activeMediaTab: 'project',
  activePropertiesTab: 'transform',
  workspaceLayout: {
    preset: 'Editing',
    leftWidth: 250,
    rightWidth: 280,
    timelineHeight: 320,
  },
  canvasTransformMode: 'resize',
  previewCanvas: null,
  masterAudioStream: null,
  clipboardData: null,
  clipboardClip: null,
  history: [
    {
      tracks: JSON.parse(JSON.stringify(defaultTracks)),
      currentTime: 0,
      label: 'Initial State',
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
    get().saveSnapshot('Import Media');
  },
  removeMedia: (id) => {
    const media = get().mediaLibrary.find((m) => m.id === id);
    if (media?.url) {
      try { URL.revokeObjectURL(media.url); } catch { /* ignore */ }
    }
    if (media?.thumbnail) {
      try { URL.revokeObjectURL(media.thumbnail); } catch { /* ignore */ }
    }

    // Evict from canvas image cache if registered
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('procut-evict-media-cache', { detail: { id } }));
    }

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
    get().recalcTotalDuration();
    get().saveSnapshot('Remove Media');
  },
  updateMediaMetadata: (id, updates) => {
    set((state) => ({
      mediaLibrary: state.mediaLibrary.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  createFolder: (name, parentId = null) => {
    const id = 'folder_' + Date.now() + Math.random().toString(36).substr(2, 5);
    set((state) => ({
      folders: [...state.folders, { id, name, parentId, createdAt: Date.now() }],
    }));
  },

  deleteFolder: (id) => {
    set((state) => {
      // Find all nested folder IDs to delete
      const idsToDelete = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        state.folders.forEach(f => {
          if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
            idsToDelete.add(f.id);
            added = true;
          }
        });
      }
      
      return {
        folders: state.folders.filter((f) => !idsToDelete.has(f.id)),
        // Move all media in these folders back to root
        mediaLibrary: state.mediaLibrary.map((m) =>
          m.folderId && idsToDelete.has(m.folderId) ? { ...m, folderId: undefined } : m
        ),
      };
    });
  },

  moveMediaToFolder: (mediaId, folderId) => {
    set((state) => ({
      mediaLibrary: state.mediaLibrary.map((m) =>
        m.id === mediaId ? { ...m, folderId: folderId || undefined } : m
      ),
    }));
  },

  // Timeline Operations
  addClip: (clip) => {
    set((state) => {
      // Find the target track
      const targetTrack = state.tracks.find((t) => t.id === clip.trackId);
      // If clip belongs to a text track, NEVER call resolveOverlaps - text subtitle clips are sequential
      // and resolveOverlaps would incorrectly move them to audio tracks
      const isTextClip = targetTrack?.type === 'text' ||
        (clip as any).textSettings != null ||
        clip.mediaId === 'text-placeholder';

      const newTracks = state.tracks.map((track) => {
        if (track.id === clip.trackId) {
          return { ...track, clips: [...track.clips, { ...clip, isPreview: false }] };
        }
        return track;
      });
      return { tracks: newTracks, selectedClipId: clip.id, selectedClipIds: [clip.id] };
    });
    get().recalcTotalDuration();
    // Text clips are sequential in time - skip overlap resolution which would move them to audio tracks
    const placedTrack = get().tracks.find((t) => t.id === clip.trackId);
    if (placedTrack?.type !== 'text' && (clip as any).textSettings == null && clip.mediaId !== 'text-placeholder') {
      get().resolveOverlaps([clip.id]);
    }
    get().saveSnapshot('Add Clip');
  },

  importSubtitles: (parsedSubs) => {
    let targetTrack = get().tracks.find((t) => t.type === 'text' && t.name === 'Subtitles');
    if (!targetTrack) {
      get().addTrack('text');
      const tracks = get().tracks;
      const newTrack = tracks[tracks.length - 1];
      set({
        tracks: tracks.map((t) =>
          t.id === newTrack.id ? { ...t, name: 'Subtitles' } : t
        ),
      });
      targetTrack = get().tracks.find((t) => t.type === 'text' && t.name === 'Subtitles');
    }
    if (!targetTrack) return;

    const trackId = targetTrack.id;
    const newMediaItems: any[] = [];
    const newClips: TimelineClip[] = [];

    parsedSubs.forEach((sub, i) => {
      const mediaId = generateId();
      newMediaItems.push({
        id: mediaId,
        name: `Subtitle ${i + 1}`,
        type: 'text',
        duration: sub.duration,
        url: '',
        createdAt: Date.now(),
        textContent: sub.text,
      });

      const clipId = generateId();
      newClips.push({
        id: clipId,
        mediaId,
        trackId,
        startTime: sub.startTime,
        duration: sub.duration,
        trimStart: 0,
        trimEnd: 0,
        transform: {
          x: 50,
          y: 90, // Lower third position for subtitles
          scale: 100,
          rotation: 0,
        },
        opacity: 1,
        speed: 1,
        effects: [],
        zIndex: 9999,
        textSettings: {
          text: sub.text,
          fontFamily: 'Inter',
          fontSize: 48,
          color: '#ffffff',
          backgroundColor: '#00000000',
          bold: false,
          italic: false,
          underline: false,
          shadow: true,
          shadowColor: '#000000',
          shadowBlur: 10,
          threeD: false,
          threeDDepth: 0,
          textAlign: 'center',
          strokeColor: '#000000',
          strokeWidth: 4,
        },
      });
    });

    set((state) => ({
      mediaLibrary: [...state.mediaLibrary, ...newMediaItems],
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, ...newClips] } : t
      ),
    }));
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
      zIndex: targetTrack.type === 'text' ? 9999 : undefined,
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

      const deletedClips = state.tracks.flatMap(t => t.clips).filter(c => idsToRemove.includes(c.id));

      let newTracks;
      if (state.activeTool === 'ripple' && deletedClips.length > 0) {
        // Multi-track Ripple Delete: Shift all clips across ALL tracks starting at/after the deleted range
        const minStartTime = Math.min(...deletedClips.map(c => c.startTime));
        const maxEndTime = Math.max(...deletedClips.map(c => c.startTime + c.duration));
        const shiftDuration = maxEndTime - minStartTime;

        newTracks = state.tracks.map((track) => {
          const remainingClips = track.clips.filter((c) => !idsToRemove.includes(c.id));
          const shiftedClips = remainingClips.map((clip) => {
            if (clip.startTime >= minStartTime) {
              return {
                ...clip,
                startTime: Math.max(0, clip.startTime - shiftDuration),
              };
            }
            return clip;
          });
          return {
            ...track,
            clips: shiftedClips,
          };
        });
      } else {
        newTracks = state.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((c) => !idsToRemove.includes(c.id)),
        }));
      }

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
    get().saveSnapshot('Delete Clip');
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
      const D = foundClip.duration;

      const targetTrackId = newTrackId || foundClip.trackId;
      const targetTrack = newTracks.find((t) => t.id === targetTrackId);

      if (targetTrack) {
        if (state.activeTool === 'ripple') {
          // Multi-track Ripple Move: Close old gap, then open space at newStartTime
          newTracks.forEach((track) => {
            track.clips.forEach((clip) => {
              if (clip.id === clipId) return;
              if (clip.startTime >= oldStartTime) {
                clip.startTime = Math.max(0, clip.startTime - D);
              }
            });
          });

          newTracks.forEach((track) => {
            track.clips.forEach((clip) => {
              if (clip.id === clipId) return;
              if (clip.startTime >= newStartTime) {
                clip.startTime += D;
              }
            });
          });

          foundClip.startTime = Math.max(0, newStartTime);
        } else if (resolveOverlap) {
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
            const prefix = currentTrack.type === 'video' ? 'v' : currentTrack.type === 'text' ? 't' : currentTrack.type === 'fx' ? 'fx' : 'a';
            const newTrackId = `${prefix}${sameTypeCount + 1}`;
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

  applyAutoCuts: (clipId, aggressiveness = 'medium') => {
    set((state) => {
      let targetTrackIndex = -1;
      let targetClipIndex = -1;
      let targetClip: any = null;

      for (let i = 0; i < state.tracks.length; i++) {
        const cIdx = state.tracks[i].clips.findIndex((c) => c.id === clipId);
        if (cIdx !== -1) {
          targetTrackIndex = i;
          targetClipIndex = cIdx;
          targetClip = state.tracks[i].clips[cIdx];
          break;
        }
      }

      if (!targetClip || targetTrackIndex === -1) return state;

      const segments = [];
      let ct = 0;
      while (ct < targetClip.duration) {
        const speakLen = aggressiveness === 'high' ? 1.5 : 2.5;
        let endS = Math.min(ct + speakLen + Math.random() * 2, targetClip.duration);
        segments.push({ start: ct, end: endS, keep: true });
        ct = endS;
        if (ct >= targetClip.duration) break;
        const silLen = aggressiveness === 'high' ? 0.8 : 0.5;
        let endSil = Math.min(ct + silLen + Math.random() * 0.5, targetClip.duration);
        if (targetClip.duration - endSil > 0.5) {
          segments.push({ start: ct, end: endSil, keep: false });
          ct = endSil;
        } else {
          segments[segments.length - 1].end = targetClip.duration;
          break;
        }
      }

      const newTracks = [...state.tracks];
      const track = { ...newTracks[targetTrackIndex] };
      const newClips = [...track.clips];

      const baseStart = targetClip.startTime;
      const baseSourceStart = targetClip.sourceStartTime;

      let currentTimeOffset = 0;
      let timeSaved = 0;
      const resultingClips = [];

      for (const seg of segments) {
        if (seg.keep) {
          const dur = seg.end - seg.start;
          resultingClips.push({
            ...targetClip,
            id: targetClip.id + '-cut-' + seg.start.toFixed(1),
            startTime: baseStart + currentTimeOffset,
            sourceStartTime: baseSourceStart + seg.start,
            duration: dur,
          });
          currentTimeOffset += dur;
        } else {
          timeSaved += (seg.end - seg.start);
        }
      }

      // Ripple delete
      for (let i = 0; i < newClips.length; i++) {
        if (i !== targetClipIndex && newClips[i].startTime > baseStart) {
          newClips[i] = {
            ...newClips[i],
            startTime: newClips[i].startTime - timeSaved,
          };
        }
      }

      newClips.splice(targetClipIndex, 1, ...resultingClips);
      track.clips = newClips;
      newTracks[targetTrackIndex] = track;

      return { tracks: newTracks };
    });
    get().saveSnapshot('Auto Jump Cuts');
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
    get().saveSnapshot('Split Clip');
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
    get().saveSnapshot('Update Transition');
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
    get().saveSnapshot('Delete Transition');
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
    get().saveSnapshot('Extract Audio');
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
    get().saveSnapshot('Unlink Audio/Video');
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
  zoomIn: () =>
    set((state) => {
      const currentZoom = state.zoomLevel;
      const newZoom = Math.min(currentZoom + 20, 400);
      const newScrollLeft = Math.max(0, state.scrollLeft + state.currentTime * (newZoom - currentZoom));
      return { zoomLevel: newZoom, scrollLeft: newScrollLeft };
    }),
  zoomOut: () =>
    set((state) => {
      const currentZoom = state.zoomLevel;
      const newZoom = Math.max(currentZoom - 20, 20);
      const newScrollLeft = Math.max(0, state.scrollLeft + state.currentTime * (newZoom - currentZoom));
      return { zoomLevel: newZoom, scrollLeft: newScrollLeft };
    }),

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
    get().saveSnapshot('Add Track');
  },
  removeTrack: (trackId) => {
    set((state) => {
      let updatedTracks = state.tracks.filter((t) => t.id !== trackId);
      // Unlink any fx tracks that were linked to this track
      updatedTracks = updatedTracks.map(t => t.linkedTrackId === trackId ? { ...t, linkedTrackId: undefined } : t);
      return { tracks: updatedTracks };
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Delete Track');
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
    get().saveSnapshot('Reorder Track');
  },

  // UI
  setActiveMediaTab: (tab) => set({ activeMediaTab: tab }),
  setActivePropertiesTab: (tab) => set({ activePropertiesTab: tab }),
  setShowExportModal: (show) => set({ showExportModal: show }),
  setShowScopes: (show) => set({ showScopes: show }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setExportFps: (exportFps) => set({ exportFps }),
  setExportDimensions: (exportWidth, exportHeight) => set({ exportWidth, exportHeight }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setShowTeleprompter: (show) => set({ showTeleprompter: show }),
  setShowHelpMenu: (show, section = null) => set({ showHelpMenu: show, activeHelpSection: section }),
  setUseProxies: (use) => set({ useProxies: use }),
  syncSelectedClips: () => {
    set((state) => {
      const selectedIds = state.selectedClipId ? [state.selectedClipId] : [];
      // If we had multiple selection it would be better, but we mock it:
      // Just find the first audio clip and first video clip, and sync them.
      const videoClips = state.tracks.flatMap(t => t.clips.filter(c => c.mediaId && state.mediaLibrary.find(m => m.id === c.mediaId)?.type === 'video'));
      const audioClips = state.tracks.flatMap(t => t.clips.filter(c => c.mediaId && state.mediaLibrary.find(m => m.id === c.mediaId)?.type === 'audio'));
      
      if (videoClips.length > 0 && audioClips.length > 0) {
        const vClip = videoClips[0];
        const aClip = audioClips[0];
        // Snap audio to video start
        return {
          tracks: state.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c => c.id === aClip.id ? { ...c, startTime: vClip.startTime } : c)
          }))
        };
      }
      return state;
    });
  },
  setShowProgressBar: (show) => set({ showProgressBar: show }),
  setProgressBarColor: (color) => set({ progressBarColor: color }),
  setProgressBarHeight: (height) => set({ progressBarHeight: height }),
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
            // FIX C11: Actually REMOVE the keyframes at the selected times instead of setting holdNext
            anims[k] = anims[k].filter((kf: any) =>
              !linesForClip.some((line: any) => Math.abs(kf.time - line.time) < 0.05)
            );
            if (anims[k].length === 0) delete anims[k];
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
  copyClip: (copyType = 'whole') => {
    const { tracks, selectedClipIds, selectedClipId } = get();
    // Default to the single selected clip if array is empty (for fallback)
    const targetIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    if (targetIds.length === 0) return;

    const clipsToCopy = [];
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (targetIds.includes(clip.id)) {
          clipsToCopy.push({ ...clip, effects: [...clip.effects] });
        }
      }
    }
    
    if (clipsToCopy.length > 0) {
      set({ clipboardData: { type: copyType, clips: clipsToCopy } });
    }
  },
  clearClipboard: () => {
    set({ clipboardData: null, clipboardClip: null });
  },
  pasteClip: (pasteType) => {
    const { clipboardData, currentTime, selectedTrackId, selectedClipIds, selectedClipId, tracks } = get();
    // Fallback to clipboardClip if clipboardData doesn't exist (backwards compatibility)
    const clipData = clipboardData || (get().clipboardClip ? { type: 'whole', clips: [get().clipboardClip] } : null);
    
    if (!clipData || clipData.clips.length === 0) return;
    
    const actualPasteType = pasteType || clipData.type;

    if (actualPasteType === 'style') {
      // Paste Style: Apply properties of the first copied clip to all currently selected clips
      const sourceStyle = clipData.clips[0] as any;
      const targetIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
      if (targetIds.length === 0) return;
      
      targetIds.forEach(id => {
        get().updateClip(id, {
          transform: { ...sourceStyle.transform },
          opacity: sourceStyle.opacity,
          effects: [...sourceStyle.effects],
          colorFilters: sourceStyle.colorFilters ? { ...sourceStyle.colorFilters } : undefined,
          textSettings: sourceStyle.textSettings ? { ...sourceStyle.textSettings } : undefined,
          fxSettings: sourceStyle.fxSettings ? { ...sourceStyle.fxSettings } : undefined,
          audioSettings: sourceStyle.audioSettings ? { ...sourceStyle.audioSettings } : undefined,
          mask: sourceStyle.mask ? { ...sourceStyle.mask } : undefined,
        });
      });
      return;
    }

    // Paste Clip or Paste Whole
    // Determine the base track to paste into. If no track selected, find the first track of matching type.
    const firstCopiedClip = clipData.clips[0] as any;
    let targetTrackId = selectedTrackId;
    if (!targetTrackId) {
      if (tracks.length === 0) return;
      const matchTrack = tracks.find(t => t.type === (firstCopiedClip.mediaId ? 'video' : 'text')); // simplified fallback
      targetTrackId = matchTrack ? matchTrack.id : tracks[0].id;
    }
    
    // Sort copied clips by startTime to maintain relative spacing
    const sortedClips = [...clipData.clips].sort((a: any, b: any) => a.startTime - b.startTime);
    const baseTimeOffset = currentTime - (sortedClips[0]?.startTime || 0);

    const newClips = sortedClips.map((clip: any) => {
      // Use structuredClone to safely deep clone nested properties (transform, colorFilters, etc)
      // to avoid altering the original clip's properties by reference.
      const clonedClip = structuredClone(clip);
      const pastedClip = {
        ...clonedClip,
        id: generateId(),
        trackId: targetTrackId,
        startTime: clip.startTime + baseTimeOffset,
        splitGroupId: undefined,
        isPreview: false,
      };

      if (actualPasteType === 'clip') {
        // Reset styles for "Paste Clip"
        pastedClip.transform = { x: 0, y: 0, scale: 100, rotation: 0 };
        pastedClip.opacity = 1;
        pastedClip.effects = [];
        delete pastedClip.colorFilters;
        delete pastedClip.mask;
      }
      
      return pastedClip as import("@/types").TimelineClip;
    });

    newClips.forEach(c => get().addClip(c));
    // Select newly pasted clips
    set({ selectedClipIds: newClips.map(c => c.id), selectedClipId: newClips[newClips.length - 1].id });
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
  saveSnapshot: (label) => {
    set((state) => {
      if (_inTransaction) return {}; // Skip if inside a transaction
      
      let defaultLabel = 'Action';
      if (state.activePropertiesTab === 'transform') defaultLabel = 'Edit Transform';
      else if (state.activePropertiesTab === 'color') defaultLabel = 'Color Grading';
      else if (state.activePropertiesTab === 'speed') defaultLabel = 'Change Speed';
      else if (state.activePropertiesTab === 'audio') defaultLabel = 'Adjust Audio';
      else if (state.activePropertiesTab === 'text') defaultLabel = 'Edit Text';
      else if (state.activePropertiesTab === 'effects') defaultLabel = 'Adjust Effect';

      const snapshot: EditorSnapshot = {
        tracks: JSON.parse(JSON.stringify(state.tracks)),
        currentTime: state.currentTime,
        label: label || defaultLabel,
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      return {
        history: newHistory.slice(-50),
        historyIndex: newHistory.length - 1,
      };
    });
    // Auto-save to IndexedDB
    const { tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId, projectName } = get();
    saveProjectToDB({ tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId } as any).then(() => {
      if (projectId !== 'default') {
        saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() }).catch(console.error);
      }
    }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
  },
  startTransaction: () => {
    _inTransaction = true;
  },
  endTransaction: () => {
    if (!_inTransaction) return;
    _inTransaction = false;
    get().saveSnapshot('Edit Timeline'); // Save one snapshot after the transaction completes
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
    const { tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId, projectName } = get();
    saveProjectToDB({ tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId } as any).then(() => {
      if (projectId !== 'default') {
        saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() }).catch(console.error);
      }
    }).catch((err) =>
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
    const { tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId, projectName } = get();
    saveProjectToDB({ tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId } as any).then(() => {
      if (projectId !== 'default') {
        saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() }).catch(console.error);
      }
    }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
  },
  jumpToHistoryIndex: (index) => {
    set((state) => {
      if (index < 0 || index >= state.history.length) return {};
      const snap = state.history[index];
      return {
        tracks: JSON.parse(JSON.stringify(snap.tracks)),
        currentTime: snap.currentTime,
        historyIndex: index,
        selectedClipId: null,
        selectedClipIds: [],
        selectedOverLayerId: null,
        selectedTransitionClipId: null,
      };
    });
    get().recalcTotalDuration();
    const { tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId, projectName } = get();
    saveProjectToDB({ tracks, mediaLibrary, folders, currentTime, aspectRatio, projectId } as any).then(() => {
      if (projectId !== 'default') {
        saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() }).catch(console.error);
      }
    }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
  },

  // Drag/Drop
  setDraggingClipId: (id) => set({ draggingClipId: id }),
  setDragPreview: (time, trackId) => set({ dragPreviewTime: time, dragPreviewTrackId: trackId }),

  // Voiceover Recording State
  startVoiceoverRecordingState: (trackId) => set({ isRecordingVoiceover: true, recordingTrackId: trackId }),
  stopVoiceoverRecordingState: () => set({ isRecordingVoiceover: false, recordingTrackId: null }),

  // Project
  setProjectInfo: (id, name) => set({ projectId: id, projectName: name }),
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
      setActiveProject(get().projectId);
      const data = await loadProjectFromDB();
      if (!data) return false;
      
      const loadedTracks = data.tracks.map((t: any) => ({
        ...t,
        overLayers: t.overLayers || [],
      }));

      set({
        tracks: loadedTracks,
        mediaLibrary: data.mediaLibrary,
        folders: data.folders || [],
        currentTime: data.currentTime,
        aspectRatio: data.aspectRatio || '16:9',
        history: [
          {
            tracks: JSON.parse(JSON.stringify(loadedTracks)),
            currentTime: data.currentTime
          }
        ],
        historyIndex: 0
      });
      get().recalcTotalDuration();
      // Auto load templates from IndexedDB
      get().loadTemplatesFromDB().catch(err => console.error('Failed to load templates:', err));
      return true;
    } catch (err) {
      console.error('Failed to load project:', err);
      return false;
    }
  },

  saveProjectAsTemplate: async (name, description) => {
    const { tracks, mediaLibrary, totalDuration, projectTemplates } = get();
    
    // Create new template object
    const newTemplate: ProjectTemplate = {
      id: generateId(),
      name,
      description,
      tracks: JSON.parse(JSON.stringify(tracks)),
      mediaLibrary: JSON.parse(JSON.stringify(mediaLibrary)),
      totalDuration,
      createdAt: Date.now(),
    };

    const newTemplates = [...projectTemplates, newTemplate];
    
    // Update local state
    set({ projectTemplates: newTemplates });
    
    // Persist to IndexedDB
    try {
      await saveTemplatesToDB(newTemplates);
    } catch (err) {
      console.error('Failed to save template to IndexedDB:', err);
    }
  },

  deleteProjectTemplate: async (templateId) => {
    const { projectTemplates } = get();
    const newTemplates = projectTemplates.filter((t) => t.id !== templateId);
    
    set({ projectTemplates: newTemplates });
    
    try {
      await saveTemplatesToDB(newTemplates);
    } catch (err) {
      console.error('Failed to delete template from IndexedDB:', err);
    }
  },

  loadProjectTemplate: async (templateId) => {
    const { projectTemplates, mediaLibrary } = get();
    const template = projectTemplates.find((t) => t.id === templateId);
    if (!template) return;

    // Save history snapshot first
    get().saveSnapshot('Before Loading Template');

    // Resolve template's PENDING_RESTORE media items using resolveMediaItemFromDB
    const resolvedMediaLibrary: MediaItem[] = [];
    
    for (const item of template.mediaLibrary) {
      const existing = mediaLibrary.find((m) => m.id === item.id);
      if (existing && existing.url !== 'PENDING_RESTORE') {
        resolvedMediaLibrary.push(existing);
      } else {
        const resolved = await resolveMediaItemFromDB(item);
        resolvedMediaLibrary.push(resolved);
      }
    }

    // Merge in any other existing media items that are not in the template
    const mergedMediaLibrary = [...resolvedMediaLibrary];
    for (const item of mediaLibrary) {
      if (!mergedMediaLibrary.some((m) => m.id === item.id)) {
        mergedMediaLibrary.push(item);
      }
    }

    // Deep clone the template tracks
    const loadedTracks = JSON.parse(JSON.stringify(template.tracks));

    set({
      tracks: loadedTracks,
      mediaLibrary: mergedMediaLibrary,
      currentTime: 0,
      selectedClipId: null,
      selectedClipIds: [],
      selectedOverLayerId: null,
      selectedTransitionClipId: null,
    });

    get().recalcTotalDuration();
    get().saveSnapshot('Load Template');
  },

  loadTemplatesFromDB: async () => {
    try {
      const templates = await getTemplatesFromDB();
      set({ projectTemplates: templates });
    } catch (err) {
      console.error('Failed to load templates from IndexedDB:', err);
    }
  },

  setAspectRatio: (ratio) => {
    set({ aspectRatio: ratio });
    get().saveSnapshot('Change Aspect Ratio');
  },
  reframeProject: (ratio) => {
    set((state) => {
      let W_old = 854; let H_old = 480;
      if (state.aspectRatio === '9:16') { W_old = 270; }
      else if (state.aspectRatio === '1:1') { W_old = 480; }
      else if (state.aspectRatio === '4:3') { W_old = 640; }

      let W_new = 854; let H_new = 480;
      if (ratio === '9:16') { W_new = 270; }
      else if (ratio === '1:1') { W_new = 480; }
      else if (ratio === '4:3') { W_new = 640; }

      const newTracks = state.tracks.map(track => {
        return {
          ...track,
          clips: track.clips.map(clip => {
            const media = state.mediaLibrary.find(m => m.id === clip.mediaId);
            if (!media || media.type === 'audio') return clip;
            
            const vw = media.width || 854;
            const vh = media.height || 480;
            
            // To completely fill the new aspect ratio, we need to scale up
            const fitScaleNew = Math.min(W_new / vw, H_new / vh);
            const fillScaleNew = Math.max(W_new / vw, H_new / vh);
            
            // Required transform.scale to fill screen
            const requiredScale = (fillScaleNew / fitScaleNew) * 100;
            
            return {
              ...clip,
              transform: {
                ...clip.transform,
                scale: requiredScale,
                x: 0,
                y: 0
              }
            };
          })
        };
      });

      return { aspectRatio: ratio, tracks: newTracks };
    });
    get().saveSnapshot('Reframe Project');
  },


  // Recalculate total duration from all clips and clean up empty custom tracks
  recalcTotalDuration: () => {
    const { tracks } = get();

    // FIX M29: Do NOT silently remove user-created tracks that happen to be empty.
    // Only auto-remove tracks that are both dynamic AND have never had any clips/overLayers.
    // Keep all non-dynamic (user-created) tracks regardless of empty state.
    const cleanedTracks = tracks.filter(
      (t) => !t.isDynamic || t.clips.length > 0 || (t.overLayers || []).length > 0
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
    get().saveSnapshot('Add PIP Layer');
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
    get().saveSnapshot('Delete PIP Layer');
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
    } else if (state.selectedClipIds.length > 1) {
      // FIX C12: Check multi-select BEFORE single clip so all selected clips are deleted
      const ids = [...state.selectedClipIds];
      ids.forEach((id) => state.removeClip(id));
    } else if (state.selectedClipId) {
      state.removeClip(state.selectedClipId);
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

  // Layout Presets
  setWorkspaceLayout: (layout) => {
    set({ workspaceLayout: layout });
  },

  // Compound Clips
  enterCompoundClip: (clipId) => {
    const { tracks, timelineStack, mediaLibrary } = get();
    const clip = tracks.flatMap(t => t.clips).find(c => c.id === clipId) || 
                 tracks.flatMap(t => t.overLayers).find(o => o.id === clipId);
    if (!clip || !clip.mediaId) return;
    
    const media = mediaLibrary.find(m => m.id === clip.mediaId);
    if (!media || media.type !== 'compound') return;

    set({
      timelineStack: [...timelineStack, { tracks: JSON.parse(JSON.stringify(tracks)), compoundMediaId: media.id }],
      tracks: media.nestedTimeline ? JSON.parse(JSON.stringify(media.nestedTimeline)) : [],
      currentTime: 0,
      selectedClipId: null,
      selectedClipIds: [],
      selectedOverLayerId: null
    });
    get().recalcTotalDuration();
  },

  exitCompoundClip: () => {
    const { tracks, timelineStack, mediaLibrary, updateMediaMetadata } = get();
    if (timelineStack.length === 0) return;

    const currentStackItem = timelineStack[timelineStack.length - 1];
    
    // Save current tracks to the compound media item
    updateMediaMetadata(currentStackItem.compoundMediaId, {
      nestedTimeline: JSON.parse(JSON.stringify(tracks))
    });

    // Pop the stack and restore the parent tracks
    const newStack = timelineStack.slice(0, -1);
    set({
      timelineStack: newStack,
      tracks: currentStackItem.tracks,
      currentTime: 0,
      selectedClipId: null,
      selectedClipIds: [],
      selectedOverLayerId: null
    });
    get().recalcTotalDuration();
  }
}));
