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
  PipWindow,
  ProjectTemplate,
  SubtitleItem,
  ScopeSettings,
} from '@/types';
import { getMediaTimeForClip, getMediaTimeAtPosition, getSpeedRampEngine, SpeedRampEngine } from '@/utils/speedRamp';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, loadProjectFromDB, clearProjectDB, saveTemplatesToDB, getTemplatesFromDB, resolveMediaItemFromDB, setActiveProject, saveProjectMeta } from '@/utils/projectPersistence';
import { getAnimatedValue } from '@/utils/keyframes';

let saveTimeoutId: any = null;

const debouncedSaveProject = (state: any) => {
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
  }
  useEditorStore.setState({ hasUnsavedChanges: true });
  saveTimeoutId = setTimeout(() => {
    const { tracks, mediaLibrary, folders, subtitles, markers, beatMarkers, currentTime, aspectRatio, projectId, projectName, pipWindows } = state;
    saveProjectToDB({ tracks, mediaLibrary, folders, subtitles, markers, beatMarkers, currentTime, aspectRatio, projectId, pipWindows } as any).then(() => {
      useEditorStore.setState({ hasUnsavedChanges: false });
      if (projectId !== 'default') {
        saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() }).catch(console.error);
      }
    }).catch((err) =>
      console.error('Failed to auto-save project:', err)
    );
    saveTimeoutId = null;
  }, 5000);
};


const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

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
    return startTime < clipEnd - 0.001 && endTime > clip.startTime + 0.001;
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
  setAIVideoGenerationState: (state: any) => void;
  setScopeSettings: (settings: ScopeSettings) => void;
  setMuteTimelineAudio: (mute: boolean) => void;
  // Media Library
  addMedia: (item: MediaItem, file?: File) => void;
  removeMedia: (id: string) => void;
  updateMediaMetadata: (id: string, updates: Partial<MediaItem>) => void;
  createFolder: (name: string, parentId?: string | null) => void;
  deleteFolder: (id: string) => void;
  moveMediaToFolder: (mediaId: string, folderId: string | null) => void;

  // Timeline Operations
  addClip: (clip: TimelineClip) => void;
  insertClip: (clip: TimelineClip, atTime: number, trackId: string) => void;
  overwriteClip: (clip: TimelineClip, atTime: number, trackId: string) => void;
  insertTextClip: (settings: Partial<ClipTextSettings>) => void;
  importSubtitles: (parsedSubs: {startTime: number, duration: number, text: string}[]) => void;
  setSubtitles: (subtitles: SubtitleItem[]) => void;
  updateSubtitle: (id: string, updates: Partial<SubtitleItem>) => void;
  deleteSubtitle: (id: string) => void;
  addSubtitle: (sub: SubtitleItem) => void;
  selectSubtitle: (id: string | null) => void;
  addTextMedia: (text: string) => void;
  rippleDeleteClip: (clipId: string) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>, options?: { ripple?: boolean }) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string, resolveOverlap?: boolean) => boolean;
  moveClips: (updates: { clipId: string; newStartTime: number; newTrackId?: string }[], resolveOverlap?: boolean) => void;
  resolveOverlaps: (clipIds: string[]) => void;
  tryMoveClip: (clipId: string, newStartTime: number, newTrackId?: string) => { canMove: boolean; newPosition: number };
  splitClip: (clipId: string, splitTime: number) => void;
  applyAutoCuts: (clipId: string, aggressiveness: 'low' | 'medium' | 'high') => void;
  selectClip: (clipId: string | null, multi?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  selectTrack: (trackId: string | null) => void;

  // PIP Window Operations
  createPipWindow: (clipId: string, relativeStartTime: number) => void;
  deletePipWindow: (pipId: string) => void;
  updatePipWindowStartTime: (pipId: string, relativeStartTime: number) => void;
  updatePipWindowDuration: (pipId: string, duration: number) => void;
  setActivePipWindow: (pipId: string | null) => void;
  addTrackToPip: (pipId: string, type: 'video' | 'audio' | 'text' | 'fx', mediaId: string, startTime: number, duration: number) => void;
  addEmptyTrackToPip: (pipId: string, type: 'video' | 'audio' | 'text' | 'fx') => void;
  removeTrackFromPip: (pipId: string, trackId: string) => void;
  reorderPipTrack: (pipId: string, trackIndex: number, direction: 'up' | 'down') => void;
  updatePipTrack: (pipId: string, trackId: string, updates: Partial<TimelineTrack>) => void;

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
  resetProject: (clearDB?: boolean) => Promise<void>;
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
  pipWindows: {},
  activePipWindowId: null,
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
    geminiApiKey: '',
    groqApiKey: '',
    freesoundApiKey: '',
    elevenLabsApiKey: '',
  },
  hasUnsavedChanges: false,
  currentTime: 0,
  isPlaying: false,
  totalDuration: 0,
  playbackSpeed: 1,
  playbackDirection: 1,
  isMuted: false,
  muteTimelineAudio: false,
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
  subtitles: [],
  selectedSubtitleId: null,
  subtitleLanguage: 'en',
  scopeSettings: {
    enabled: false,
    type: 'waveform',
    opacity: 0.9,
    size: 'medium',
    position: 'bottom-right',
    showGrid: true,
    showLimits: true,
    intensity: 100,
  },
  aiVideoIsGenerating: false,
  aiVideoProgress: 0,
  aiVideoJobId: null,
  aiVideoResultUrl: null,
};

export const mapTracksDeep = (state: EditorState, modifier: (track: TimelineTrack, pipId: string | null) => TimelineTrack) => {
  return {
    tracks: state.tracks.map(t => modifier(t, null)),
    pipWindows: Object.fromEntries(
      Object.entries(state.pipWindows || {}).map(([pipId, pip]) => [
        pipId,
        {
          ...pip,
          tracks: pip.tracks.map(t => modifier(t, pipId))
        }
      ])
    )
  };
};

export const getAllClipsDeep = (state: EditorState): TimelineClip[] => {
  const mainClips = state.tracks.flatMap((t) => t.clips || []);
  const pipClips = Object.values(state.pipWindows || {}).flatMap(p => p.tracks.flatMap(t => t.clips || []));
  return [...mainClips, ...pipClips];
};

export const findClipDeep = (state: EditorState, clipId: string) => {
  for (const track of state.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) return { clip, track, isPip: false, pipId: null };
  }
  for (const [pipId, pip] of Object.entries(state.pipWindows || {})) {
    for (const track of pip.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return { clip, track, isPip: true, pipId };
    }
  }
  return null;
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  setAIVideoGenerationState: (state: any) => set((prev: any) => ({ ...prev, ...state })),
  setScopeSettings: (settings: ScopeSettings) => set({ scopeSettings: settings }),

  setSubtitles: (subtitles: SubtitleItem[]) => {
    set({ subtitles });
    get().saveSnapshot('Set Subtitles');
  },
  updateSubtitle: (id: string, updates: Partial<SubtitleItem>) => {
    set((state) => ({
      subtitles: state.subtitles.map((sub) =>
        sub.id === id ? { ...sub, ...updates } : sub
      ),
    }));
    get().saveSnapshot('Update Subtitle');
  },
  deleteSubtitle: (id: string) => {
    set((state) => ({
      subtitles: state.subtitles.filter((sub) => sub.id !== id),
      selectedSubtitleId: state.selectedSubtitleId === id ? null : state.selectedSubtitleId
    }));
    get().saveSnapshot('Delete Subtitle');
  },
  addSubtitle: (sub: SubtitleItem) => {
    set((state) => ({
      subtitles: [...state.subtitles, sub].sort((a, b) => a.startTime - b.startTime)
    }));
    get().saveSnapshot('Add Subtitle');
  },
  selectSubtitle: (id: string | null) => {
    set({ selectedSubtitleId: id });
  },
  addTextMedia: (text: string) => {
    const mediaId = generateId();
    const name = text.length > 10 ? text.slice(0, 10) + '...' : text;
    get().addMedia({
      id: mediaId,
      name,
      type: 'text',
      duration: 3,
      url: '',
      createdAt: Date.now(),
      textContent: text,
    });
  },
  rippleDeleteClip: (clipId: string) => {
    let start = 0;
    set((state) => {
      const allClips = state.tracks.flatMap(t => t.clips || []);
      const targetClip = allClips.find(c => c.id === clipId);
      if (!targetClip) return {};

      start = targetClip.startTime;
      const end = targetClip.startTime + targetClip.duration;
      const durationToCut = end - start;

      const newTracks = state.tracks.map(track => {
        // 1. Remove clips that are entirely inside the cut region
        let newClips = track.clips.filter(c => {
          const cEnd = c.startTime + c.duration;
          return !(c.startTime >= start && cEnd <= end);
        });

        newClips = newClips.map(c => {
          const cEnd = c.startTime + c.duration;
          
          // 2. Shift clips that are completely AFTER the cut region
          if (c.startTime >= end) {
            return { ...c, startTime: c.startTime - durationToCut };
          }
          
          // 3. Trim clips that overlap the START of the cut region
          if (c.startTime < start && cEnd > start && cEnd <= end) {
            const newDur = start - c.startTime;
            return { ...c, duration: newDur, trimEnd: c.trimStart + newDur * c.speed };
          }
          
          // 4. Trim clips that overlap the END of the cut region
          if (c.startTime >= start && c.startTime < end && cEnd > end) {
            const newDur = cEnd - end;
            const shiftAmount = end - c.startTime;
            return { 
              ...c, 
              startTime: start,
              duration: newDur,
              trimStart: c.trimStart + shiftAmount * c.speed
            };
          }
          
          // 5. Split clips that encompass the ENTIRE cut region
          if (c.startTime < start && cEnd > end) {
            const leftClip = { 
              ...c, 
              duration: start - c.startTime 
            };
            
            const rightClip = {
              ...c,
              id: c.id + '_split_' + Math.random().toString(36).slice(2, 7),
              startTime: start,
              duration: cEnd - end,
              trimStart: c.trimStart + (end - c.startTime) * c.speed
            };
            
            return [leftClip, rightClip];
          }

          return c;
        }).flat();

        return {
          ...track,
          clips: newClips,
        };
      });

      // Clear selection if the target clip was selected
      const isSelected = state.selectedClipId === clipId || state.selectedClipIds.includes(clipId);
      const newSelectedClipId = isSelected ? null : state.selectedClipId;
      const newSelectedClipIds = isSelected ? [] : state.selectedClipIds;

      return {
        tracks: newTracks,
        selectedClipId: newSelectedClipId,
        selectedClipIds: newSelectedClipIds
      };
    });

    get().recalcTotalDuration();
    get().saveSnapshot('Ripple Delete (Text)');
    
    // Seek playhead if it was past the cut start
    const { currentTime, seek } = get();
    if (currentTime > start) {
      seek(Math.max(0, start));
    }
  },

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
      // Find the target track (search in both state.tracks and state.pipWindows)
      let targetTrack = state.tracks.find((t) => t.id === clip.trackId);
      let isPip = false;
      let parentPipId = '';

      if (!targetTrack && state.pipWindows) {
        for (const [pipId, pip] of Object.entries(state.pipWindows)) {
          const pt = pip.tracks.find(t => t.id === clip.trackId);
          if (pt) {
            targetTrack = pt;
            isPip = true;
            parentPipId = pipId;
            break;
          }
        }
      }

      if (isPip) {
        const newPipWindows = { ...state.pipWindows };
        const pip = newPipWindows[parentPipId];
        const newTracks = pip.tracks.map((track) => {
          if (track.id === clip.trackId) {
            return { ...track, clips: [...track.clips, { ...clip, isPreview: false }] };
          }
          return track;
        });
        newPipWindows[parentPipId] = { ...pip, tracks: newTracks };
        return { pipWindows: newPipWindows, selectedClipId: clip.id, selectedClipIds: [clip.id] };
      } else {
        const newTracks = state.tracks.map((track) => {
          if (track.id === clip.trackId) {
            return { ...track, clips: [...track.clips, { ...clip, isPreview: false }] };
          }
          return track;
        });
        return { tracks: newTracks, selectedClipId: clip.id, selectedClipIds: [clip.id] };
      }
    });
    get().recalcTotalDuration();
    
    // Check if the track is PIP or text
    const placed = findClipDeep(get(), clip.id);
    if (placed && placed.track.type !== 'text' && (clip as any).textSettings == null && clip.mediaId !== 'text-placeholder' && !placed.isPip) {
      get().resolveOverlaps([clip.id]);
    }
    get().saveSnapshot('Add Clip');
  },

  insertClip: (clip, atTime, trackId) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => {
        if (track.id !== trackId) {
          // Ripple clips starting at or after atTime on other tracks too? No, usually insert edits only affect the target track or all linked tracks.
          // The provided report suggested rippling all tracks if `track.id !== trackId`. Wait, standard NLE insert shifts ALL tracks if not locked.
          // Let's shift clips on ALL unlocked tracks.
          if (track.locked) return track;
          return {
            ...track,
            clips: track.clips.map((c) => ({
              ...c,
              startTime: c.startTime >= atTime ? c.startTime + clip.duration : c.startTime,
            })),
          };
        }
        
        // Insert the new clip on target track and ripple
        return {
          ...track,
          clips: [
            ...track.clips.map((c) => ({
              ...c,
              startTime: c.startTime >= atTime ? c.startTime + clip.duration : c.startTime,
            })),
            { ...clip, startTime: atTime, trackId },
          ].sort((a, b) => a.startTime - b.startTime),
        };
      });
      
      return { tracks: newTracks, selectedClipId: clip.id, selectedClipIds: [clip.id] };
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Insert Edit');
  },

  overwriteClip: (clip, atTime, trackId) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => {
        if (track.id !== trackId) return track; // Overwrite only affects target track
        if (track.locked) return track;
        
        const clipEnd = atTime + clip.duration;
        
        // Remove clips that overlap completely or partially with the insert region
        let newClips = track.clips.filter((c) => {
          const cEnd = c.startTime + c.duration;
          // Keep clips that end before atTime or start after clipEnd
          return cEnd <= atTime || c.startTime >= clipEnd;
        });
        
        // Trim clips that overlap (we need to split/trim them actually)
        // Wait, standard Overwrite Edit DESTROYS the content underneath.
        // It's easier to just push the new clip and let `resolveOverlaps` handle it?
        // No, `resolveOverlaps` pushes clips to new tracks. Overwrite deletes what's underneath.
        
        track.clips.forEach((c) => {
          const cEnd = c.startTime + c.duration;
          // Clip starts before overwrite, ends during overwrite (Trim End)
          if (c.startTime < atTime && cEnd > atTime && cEnd <= clipEnd) {
            newClips.push({ ...c, duration: atTime - c.startTime });
          }
          // Clip starts during overwrite, ends after (Trim Start)
          else if (c.startTime >= atTime && c.startTime < clipEnd && cEnd > clipEnd) {
            const cutAmount = clipEnd - c.startTime;
            newClips.push({ 
              ...c, 
              startTime: clipEnd, 
              duration: c.duration - cutAmount,
              trimStart: c.trimStart + (cutAmount * c.speed)
            });
          }
          // Clip completely encapsulates the overwrite (Split into two)
          else if (c.startTime < atTime && cEnd > clipEnd) {
            newClips.push({ ...c, duration: atTime - c.startTime });
            const cutAmount = clipEnd - c.startTime;
            newClips.push({ 
              ...c, 
              id: generateId(),
              startTime: clipEnd, 
              duration: c.duration - cutAmount,
              trimStart: c.trimStart + (cutAmount * c.speed)
            });
          }
        });
        
        // Add the new clip
        newClips.push({ ...clip, startTime: atTime, trackId });
        
        return { ...track, clips: newClips.sort((a, b) => a.startTime - b.startTime) };
      });
      
      return { tracks: newTracks, selectedClipId: clip.id, selectedClipIds: [clip.id] };
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Overwrite Edit');
  },

  importSubtitles: (parsedSubs) => {
    const newSubs = parsedSubs.map((sub) => ({
      id: generateId(),
      startTime: sub.startTime !== undefined ? sub.startTime : (sub as any).start !== undefined ? (sub as any).start : 0,
      endTime: (sub.startTime !== undefined ? sub.startTime : (sub as any).start !== undefined ? (sub as any).start : 0) + sub.duration,
      text: sub.text,
      translations: { en: sub.text }
    }));
    set({ subtitles: newSubs, selectedSubtitleId: null });
    get().saveSnapshot('Import Subtitles');
  },

  insertTextClip: (settings) => {
    let targetTrack = get().tracks.find((t) => t.type === 'text');
    if (!targetTrack) {
      get().addTrack('text');
      targetTrack = get().tracks.find((t) => t.type === 'text');
    }
    if (!targetTrack) return;

    const mediaId = generateId();
    const textVal = settings.text || 'New Text';
    const name = textVal.length > 10 ? textVal.slice(0, 10) + '...' : textVal;

    get().addMedia({
      id: mediaId,
      name,
      type: 'text',
      duration: 3,
      url: '',
      createdAt: Date.now(),
      textContent: textVal,
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
        text: textVal,
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
      const initialIds = state.selectedClipIds.includes(clipId)
        ? state.selectedClipIds
        : [clipId];

      const allClips = state.tracks.flatMap((t) => t.clips || []);
      const idsToRemoveSet = new Set<string>(initialIds);
      initialIds.forEach((id) => {
        const c = allClips.find((clip) => clip.id === id);
        if (c && c.linkedClipId) {
          idsToRemoveSet.add(c.linkedClipId);
        }
        allClips.forEach((clip) => {
          if (clip.linkedClipId === id) {
            idsToRemoveSet.add(clip.id);
          }
        });
      });
      const idsToRemove = Array.from(idsToRemoveSet);

      const deletedClips = state.tracks.flatMap(t => t.clips || []).filter(c => idsToRemove.includes(c.id));

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

      // Also delete from pipWindows tracks
      const newPipWindows = { ...state.pipWindows };
      let pipUpdated = false;

      // Collect PIP window IDs associated with deleted clips
      const allClipsDeep = getAllClipsDeep(state);
      const deletedClipsDeep = allClipsDeep.filter(c => idsToRemove.includes(c.id));
      const orphanPipIds = new Set<string>();
      for (const clip of deletedClipsDeep) {
        if (clip.pipWindowIds) {
          clip.pipWindowIds.forEach(pid => orphanPipIds.add(pid));
        }
      }
      for (const [pipId, pip] of Object.entries(state.pipWindows || {})) {
        if (idsToRemove.includes(pip.parentClipId)) {
          orphanPipIds.add(pipId);
        }
      }

      if (orphanPipIds.size > 0) {
        for (const pipId of orphanPipIds) {
          delete newPipWindows[pipId];
        }
        pipUpdated = true;
      }

      for (const pipId in newPipWindows) {
        const pip = newPipWindows[pipId];
        const hasClip = pip.tracks.some(t => (t.clips || []).some(c => idsToRemove.includes(c.id)));
        if (hasClip) {
          newPipWindows[pipId] = {
            ...pip,
            tracks: pip.tracks.map(t => ({
              ...t,
              clips: t.clips.filter(c => !idsToRemove.includes(c.id))
            })).filter(t => t.clips.length > 0)
          };
          pipUpdated = true;
        }
      }

      return {
        tracks: newTracks,
        selectedClipId: newSelectedClipId,
        selectedClipIds: newSelectedClipIds,
        ...(pipUpdated || orphanPipIds.size > 0 ? { pipWindows: newPipWindows } : {})
      };
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Delete Clip');
  },

  updateClip: (clipId, updates, options) => {
    set((state) => {
      const found = findClipDeep(state, clipId);
      let durationOverride = updates.duration; // Use whatever the caller passed first
      let durationDelta = 0;

      // DEBUG: Log all speed ramp updates
      if (updates.speedRamp !== undefined || updates.duration !== undefined) {
        console.log('[updateClip] clipId:', clipId);
        console.log('[updateClip] updates.duration:', updates.duration);
        console.log('[updateClip] updates.speedRamp:', updates.speedRamp ? `[${updates.speedRamp.length} kf]` : updates.speedRamp);
        console.log('[updateClip] options:', options);
        if (found) {
          const mediaItem = state.mediaLibrary.find((m) => m.id === found.clip.mediaId);
          console.log('[updateClip] found clip.duration:', found.clip.duration);
          console.log('[updateClip] clip.trimStart:', found.clip.trimStart, 'trimEnd:', found.clip.trimEnd, 'speed:', found.clip.speed);
          console.log('[updateClip] mediaItem found?:', !!mediaItem, 'mediaItem.duration:', mediaItem?.duration);
        }
      }


      // Only auto-calculate duration if the caller did NOT provide one explicitly
      if (found && durationOverride === undefined && (updates.speedRamp !== undefined || updates.trimStart !== undefined || updates.trimEnd !== undefined || updates.speed !== undefined)) {
        const clip = found.clip;
        const speedRamp = updates.speedRamp !== undefined ? updates.speedRamp : clip.speedRamp;
        const trimStart = updates.trimStart !== undefined ? updates.trimStart : clip.trimStart;
        const trimEnd = updates.trimEnd !== undefined ? updates.trimEnd : clip.trimEnd;
        const speed = updates.speed !== undefined ? updates.speed : clip.speed;

        const mediaItem = state.mediaLibrary.find((m) => m.id === clip.mediaId);
        // CRITICAL: use the source media duration (NOT clip.duration which is timeline duration)
        // If mediaItem not found, use clip.duration as best guess (but this may be wrong for text/image clips)
        const sourceDur = mediaItem ? mediaItem.duration : (clip.trimStart + clip.trimEnd + clip.duration * clip.speed);

        if (speedRamp && speedRamp.length >= 2) {
          const tempEngine = new SpeedRampEngine(speedRamp);
          const sourceEnd = sourceDur - trimEnd;
          const calculatedDuration = tempEngine.sourceToTimeline(sourceEnd) - tempEngine.sourceToTimeline(trimStart);
          durationOverride = Math.max(0.1, calculatedDuration);
        } else if (!speedRamp || speedRamp.length < 2) {
          // Ramp removed or simple speed change
          const rawSourceDuration = sourceDur - trimStart - trimEnd;
          durationOverride = Math.max(0.1, rawSourceDuration / Math.max(0.01, speed));
        }
      }

      if (found && options?.ripple && durationOverride !== undefined) {
        durationDelta = durationOverride - found.clip.duration;
      }

      const finalUpdates = {
        ...updates,
        ...(durationOverride !== undefined ? { duration: durationOverride } : {})
      };

      const { tracks, pipWindows } = mapTracksDeep(state, (track, pipId) => {
        const isTargetTrack = 
          (!found?.isPip && pipId === null && track.id === found?.track.id) ||
          (found?.isPip && pipId === found.pipId && track.id === found?.track.id);

        return {
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              return { ...clip, ...finalUpdates };
            }
            if (isTargetTrack && durationDelta !== 0 && found) {
              if (clip.startTime >= found.clip.startTime + found.clip.duration - 0.001) {
                return { ...clip, startTime: clip.startTime + durationDelta };
              }
            }
            return clip;
          }),
        };
      });

      let updatedMediaLibrary = state.mediaLibrary;
      if (updates.textSettings && (updates.textSettings as any).text !== undefined) {
        const textVal = (updates.textSettings as any).text;
        const newName = textVal.length > 10 ? textVal.slice(0, 10) + '...' : textVal;
        
        let mediaId: string | undefined;
        if (found) {
          mediaId = found.clip.mediaId;
        }
        if (mediaId) {
          updatedMediaLibrary = state.mediaLibrary.map(m => m.id === mediaId ? { ...m, name: newName } : m);
        }
      }

      return { 
        tracks, 
        pipWindows,
        mediaLibrary: updatedMediaLibrary,
      };
    });
    get().recalcTotalDuration();
    // NOTE: saveSnapshot() is intentionally NOT called here - callers call it explicitly when needed
    // This prevents excessive snapshot creation during drag operations
  },


  moveClip: (clipId, newStartTime, newTrackId, resolveOverlap = false) => {
    let success = false;
    set((state) => {
      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => ({ ...c, transform: { ...c.transform } })),
      }));
      const newPipWindows: Record<string, PipWindow> = JSON.parse(JSON.stringify(state.pipWindows || {}));

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

      // If not found on main timeline, search inside PIP windows
      if (!foundClip) {
        for (const pip of Object.values(newPipWindows)) {
          for (const track of pip.tracks) {
            const idx = track.clips.findIndex((c) => c.id === clipId);
            if (idx !== -1) {
              const [clip] = track.clips.splice(idx, 1);
              foundClip = clip;
              break;
            }
          }
          if (foundClip) break;
        }
      }

      if (!foundClip) return {};

      const oldStartTime = foundClip.startTime;
      const deltaTime = newStartTime - oldStartTime;
      const D = foundClip.duration;

      const targetTrackId = newTrackId || foundClip.trackId;
      let targetTrack = newTracks.find((t) => t.id === targetTrackId);
      if (!targetTrack) {
        for (const pip of Object.values(newPipWindows)) {
          targetTrack = pip.tracks.find((t) => t.id === targetTrackId);
          if (targetTrack) break;
        }
      }
      if (targetTrack) {
        // Enforce track type compatibility (ARCH-5)
        const media = state.mediaLibrary.find((m) => m.id === foundClip!.mediaId);
        const clipType = media ? media.type : (foundClip!.textSettings ? 'text' : (foundClip!.fxSettings ? 'fx' : (foundClip!.audioSettings !== undefined && !foundClip!.transform ? 'audio' : 'video')));
        if (targetTrack.type === 'audio' && clipType !== 'audio') {
          return {}; // Reject move of visual clip to audio track
        }
        if (targetTrack.type === 'video' && clipType !== 'video' && clipType !== 'image') {
          return {}; // Reject move of audio clip to video track
        }
        if (targetTrack.type === 'text' && clipType !== 'text') {
          return {}; // Reject move of non-text clip to text track
        }
        if (targetTrack.type === 'fx' && clipType !== 'fx') {
          return {}; // Reject move of non-fx clip to fx track
        }
        if (state.activeTool === 'ripple') {
          // Multi-track Ripple Move: Close old gap, then open space at newStartTime
          // Context-aware ripple move: only affect tracks in same container (main vs PIP)
          const isTargetPip = targetTrackId.includes('_pip');
          const tracksToRipple = isTargetPip
            ? Object.values(newPipWindows).find((p) => p.tracks.some((t) => t.id === targetTrackId))?.tracks || []
            : newTracks;

          tracksToRipple.forEach((track) => {
            track.clips.forEach((clip) => {
              if (clip.id === clipId) return;
              if (clip.startTime >= oldStartTime) {
                clip.startTime = Math.max(0, clip.startTime - D);
              }
            });
          });

          tracksToRipple.forEach((track) => {
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
        
        // Clamp start time and duration if track is a PIP track with manual duration
        if (targetTrackId.includes('_pip')) {
          const pip = Object.values(newPipWindows).find((p) => p.tracks.some((t) => t.id === targetTrackId));
          if (pip && pip.manualDuration) {
            if (foundClip.startTime + foundClip.duration > pip.duration) {
              if (foundClip.startTime >= pip.duration) {
                foundClip.startTime = Math.max(0, pip.duration - foundClip.duration);
              }
              if (foundClip.startTime + foundClip.duration > pip.duration) {
                foundClip.duration = Math.max(0.1, pip.duration - foundClip.startTime);
              }
            }
          }
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
          if (!linkedClip) {
            for (const pip of Object.values(newPipWindows)) {
              for (const track of pip.tracks) {
                linkedClip = track.clips.find((c) => c.id === foundClip!.linkedClipId);
                if (linkedClip) break;
              }
              if (linkedClip) break;
            }
          }
          if (linkedClip) {
            linkedClip.startTime = Math.max(0, linkedClip.startTime + deltaTime);
          }
        }
      }

      return { tracks: newTracks, pipWindows: newPipWindows };
    });

    if (success) {
      get().recalcTotalDuration();
    }
    return success;
  },

  moveClips: (updates, resolveOverlap = false) => {
    set((state) => {
      const newTracks = JSON.parse(JSON.stringify(state.tracks));
      const newPipWindows = JSON.parse(JSON.stringify(state.pipWindows || {}));

      const movingClipsMap = new Map<string, TimelineClip>();
      const updatedClipIds = new Set(updates.map(u => u.clipId));

      const findAndSpliceClip = (tracksList: TimelineTrack[], clipId: string): TimelineClip | null => {
        for (const track of tracksList) {
          const idx = track.clips.findIndex((c) => c.id === clipId);
          if (idx !== -1) {
            const [clip] = track.clips.splice(idx, 1);
            return clip;
          }
        }
        return null;
      };

      for (const update of updates) {
        let clip = findAndSpliceClip(newTracks, update.clipId);
        if (!clip) {
          for (const pip of Object.values(newPipWindows) as any[]) {
            clip = findAndSpliceClip(pip.tracks, update.clipId);
            if (clip) break;
          }
        }
        if (clip) {
          movingClipsMap.set(update.clipId, clip);
        }
      }

      const sortedUpdates = [...updates].sort((a, b) => a.newStartTime - b.newStartTime);

      const findTrack = (trackId: string): { track: TimelineTrack; parentList: TimelineTrack[] } | null => {
        const mainTrack = newTracks.find((t: any) => t.id === trackId);
        if (mainTrack) {
          return { track: mainTrack, parentList: newTracks };
        }
        for (const pip of Object.values(newPipWindows) as any[]) {
          const pt = pip.tracks.find((t: any) => t.id === trackId);
          if (pt) {
            return { track: pt, parentList: pip.tracks };
          }
        }
        return null;
      };

      const findClipDeepLocal = (clipId: string): TimelineClip | null => {
        if (movingClipsMap.has(clipId)) return movingClipsMap.get(clipId)!;
        for (const t of newTracks) {
          const c = t.clips.find((x: any) => x.id === clipId);
          if (c) return c;
        }
        for (const pip of Object.values(newPipWindows) as any[]) {
          for (const t of pip.tracks) {
            const c = t.clips.find((x: any) => x.id === clipId);
            if (c) return c;
          }
        }
        return null;
      };

      for (const update of sortedUpdates) {
        const clip = movingClipsMap.get(update.clipId);
        if (!clip) continue;

        const oldStartTime = clip.startTime;
        const deltaTime = update.newStartTime - oldStartTime;

        const targetTrackId = update.newTrackId || clip.trackId;
        const trackResult = findTrack(targetTrackId);

        if (trackResult) {
          const { track: targetTrack } = trackResult;
          const media = state.mediaLibrary.find((m) => m.id === clip.mediaId);
          const isClipAudio = media ? media.type === 'audio' : (clip.audioSettings !== undefined && !clip.transform);
          if (targetTrack.type === 'audio' && !isClipAudio) {
            continue;
          }
          if (targetTrack.type === 'video' && isClipAudio) {
            continue;
          }
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

          if (clip.linkedClipId && !updatedClipIds.has(clip.linkedClipId)) {
            const linkedClip = findClipDeepLocal(clip.linkedClipId);
            if (linkedClip) {
              linkedClip.startTime = Math.max(0, linkedClip.startTime + deltaTime);
            }
          }
        }
      }

      return { 
        tracks: newTracks,
        pipWindows: newPipWindows
      };
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
      const newPipWindows: Record<string, PipWindow> = JSON.parse(JSON.stringify(state.pipWindows || {}));

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
          return startTime < clipEnd - 0.001 && endTime > clip.startTime + 0.001;
        });
      };

      for (const clipId of clipIds) {
        let currentClip: TimelineClip | undefined;
        let currentTrack: TimelineTrack | undefined;
        let isPip = false;
        let parentPipId = '';

        // Search main timeline tracks
        for (const track of newTracks) {
          currentClip = track.clips.find((c) => c.id === clipId);
          if (currentClip) {
            currentTrack = track;
            break;
          }
        }

        // Search PIP window tracks
        if (!currentClip) {
          for (const [pipId, pip] of Object.entries(newPipWindows)) {
            for (const track of pip.tracks) {
              currentClip = track.clips.find((c) => c.id === clipId);
              if (currentClip) {
                currentTrack = track;
                isPip = true;
                parentPipId = pipId;
                break;
              }
            }
            if (currentClip) break;
          }
        }

        if (!currentClip || !currentTrack) continue;

        const otherClipsOnTrack = currentTrack.clips.filter((c) => c.id !== clipId);
        const hasOverlap = checkOverlapLocal(otherClipsOnTrack, currentClip.startTime, currentClip.duration, clipId);

        if (hasOverlap) {
          const contextTracks = isPip ? newPipWindows[parentPipId].tracks : newTracks;
          const sameTypeTracks = contextTracks.filter((t) => t.type === currentTrack!.type);
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
              const targetTrack = contextTracks.find((t) => t.id === foundTrackId);
              if (targetTrack) {
                targetTrack.clips.push(currentClip);
              }
            }
          } else {
            const sameTypeCount = sameTypeTracks.length;
            const prefix = currentTrack.type === 'video' ? 'v' : currentTrack.type === 'text' ? 't' : currentTrack.type === 'fx' ? 'fx' : 'a';
            const newTrackId = isPip 
              ? `${prefix}_pip_${generateId().slice(0, 4)}`
              : `track_${prefix}_${generateId()}`;
            const newTrackName = isPip 
              ? `${currentTrack.type.toUpperCase()} Track ${sameTypeCount + 1}`
              : `${prefix.toUpperCase()}${sameTypeCount + 1}`;

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

            const lastIdx = contextTracks.map((t) => t.type).lastIndexOf(currentTrack.type);
            contextTracks.splice(lastIdx + 1, 0, newTrack);
          }
        }
      }

      return { tracks: newTracks, pipWindows: newPipWindows };
    });

    get().recalcTotalDuration();
  },

  tryMoveClip: (clipId, newStartTime, newTrackId) => {
    const state = get();
    let foundClip: TimelineClip | undefined;

    const allClips = getAllClipsDeep(state);
    const clip = allClips.find((c) => c.id === clipId);
    if (clip) {
      foundClip = { ...clip, startTime: newStartTime };
      if (newTrackId) foundClip.trackId = newTrackId;
    }

    if (!foundClip) return { canMove: false, newPosition: newStartTime };

    const targetTrackId = newTrackId || foundClip.trackId;
    
    let targetTrack: TimelineTrack | undefined;
    for (const t of state.tracks) if (t.id === targetTrackId) targetTrack = t;
    if (!targetTrack && state.pipWindows) {
      for (const pip of Object.values(state.pipWindows)) {
        for (const t of pip.tracks) if (t.id === targetTrackId) targetTrack = t;
      }
    }

    if (!targetTrack) return { canMove: false, newPosition: newStartTime };

    // Enforce track type compatibility
    const media = state.mediaLibrary.find((m) => m.id === foundClip!.mediaId);
    const clipType = media ? media.type : (foundClip!.textSettings ? 'text' : (foundClip!.fxSettings ? 'fx' : (foundClip!.audioSettings !== undefined && !foundClip!.transform ? 'audio' : 'video')));
    if (targetTrack.type === 'audio' && clipType !== 'audio') {
      return { canMove: false, newPosition: newStartTime };
    }
    if (targetTrack.type === 'video' && clipType !== 'video' && clipType !== 'image') {
      return { canMove: false, newPosition: newStartTime };
    }
    if (targetTrack.type === 'text' && clipType !== 'text') {
      return { canMove: false, newPosition: newStartTime };
    }
    if (targetTrack.type === 'fx' && clipType !== 'fx') {
      return { canMove: false, newPosition: newStartTime };
    }

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
      const found = findClipDeep(state, clipId);
      if (!found) return {};

      const { clip: targetClip, track: targetTrack } = found;
      const targetClipIndex = targetTrack.clips.findIndex((c) => c.id === clipId);
      if (targetClipIndex === -1) return {};

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

      const baseStart = targetClip.startTime;
      const baseTrimStart = targetClip.trimStart || 0;
      const baseTrimEnd = targetClip.trimEnd || 0;
      const clipSpeed = targetClip.speed || 1;

      let currentTimeOffset = 0;
      let timeSaved = 0;
      const resultingClips: TimelineClip[] = [];

      for (const seg of segments) {
        if (seg.keep) {
          const dur = seg.end - seg.start;
          resultingClips.push({
            ...targetClip,
            id: targetClip.id + '-cut-' + seg.start.toFixed(1),
            startTime: baseStart + currentTimeOffset,
            trimStart: baseTrimStart + seg.start * clipSpeed,
            trimEnd: baseTrimEnd + (targetClip.duration - seg.end) * clipSpeed,
            duration: dur,
          });
          currentTimeOffset += dur;
        } else {
          timeSaved += (seg.end - seg.start);
        }
      }

      const { tracks, pipWindows } = mapTracksDeep(state, (track) => {
        if (track.id !== targetTrack.id) return track;

        const newClips = [...track.clips];
        for (let i = 0; i < newClips.length; i++) {
          if (i !== targetClipIndex && newClips[i].startTime > baseStart) {
            newClips[i] = {
              ...newClips[i],
              startTime: newClips[i].startTime - timeSaved,
            };
          }
        }

        newClips.splice(targetClipIndex, 1, ...resultingClips);
        return { ...track, clips: newClips };
      });

      return { tracks, pipWindows };
    });
    get().saveSnapshot('Auto Jump Cuts');
  },

  splitClip: (clipId, splitTime) => {
    set((state) => {
      const isSelected = state.selectedClipIds.includes(clipId);
      let leftClipId = '';

      const { tracks, pipWindows } = mapTracksDeep(state, (track) => {
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
          const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
          const splitSourceTime = engine.timelineToSource(relativeSplitTime);
          const splitSpeed = engine.getSpeedAtSourceTime(splitSourceTime);

          const sorted = [...clip.speedRamp!].sort((a, b) => a.sourceTime - b.sourceTime);

          // Left half: keyframes in [0, splitSourceTime]
          const leftKeys = sorted.filter((kf) => kf.sourceTime < splitSourceTime);
          leftKeys.push({
            id: generateId(),
            sourceTime: splitSourceTime,
            speed: splitSpeed,
            easing: 'linear',
          });
          leftSpeedRamp = leftKeys;

          // Right half: keyframes in [splitSourceTime, end]
          const rightKeys = sorted.filter((kf) => kf.sourceTime > splitSourceTime);
          rightKeys.unshift({
            id: generateId(),
            sourceTime: splitSourceTime,
            speed: splitSpeed,
            easing: 'linear',
          });
          rightSpeedRamp = rightKeys;
        }

        const splitMediaTime = hasRamp
          ? getMediaTimeForClip(clip, splitTime)
          : clip.trimStart + relativeSplitTime * clip.speed;

        const originalMediaDuration = hasRamp
          ? getMediaTimeAtPosition(clip.id, clip.speedRamp, 1.0, clip.duration)
          : clip.duration * clip.speed;

        // Remap keyframe animations for split
        let leftAnimations = clip.animations ? { ...clip.animations } : undefined;
        let rightAnimations = clip.animations ? { ...clip.animations } : undefined;

        if (clip.animations) {
          leftAnimations = {};
          rightAnimations = {};

          for (const key of Object.keys(clip.animations)) {
            const kfs = clip.animations[key];
            if (!kfs || kfs.length === 0) continue;

            let baseVal = 1;
            if (key === 'opacity') baseVal = clip.opacity;
            else if (key === 'transform.scale') baseVal = clip.transform.scale;
            else if (key === 'transform.x') baseVal = clip.transform.x;
            else if (key === 'transform.y') baseVal = clip.transform.y;
            else if (key === 'transform.rotation') baseVal = clip.transform.rotation;
            else if (key === 'transform.rotationX') baseVal = (clip.transform as any).rotationX ?? 0;
            else if (key === 'transform.rotationY') baseVal = (clip.transform as any).rotationY ?? 0;
            // Simple linear interpolation fallback
            let splitVal = baseVal;
            if (kfs.length > 0) {
              const leftKf = [...kfs].reverse().find(k => k.time <= relativeSplitTime);
              const rightKf = kfs.find(k => k.time >= relativeSplitTime);
              if (leftKf && rightKf && leftKf.time !== rightKf.time) {
                const ratio = (relativeSplitTime - leftKf.time) / (rightKf.time - leftKf.time);
                splitVal = leftKf.value + (rightKf.value - leftKf.value) * ratio;
              } else if (leftKf) {
                splitVal = leftKf.value;
              } else if (rightKf) {
                splitVal = rightKf.value;
              }
            }

            const leftKfs = kfs.filter((k) => k.time <= relativeSplitTime);
            leftKfs.push({ time: relativeSplitTime, value: splitVal });
            leftAnimations[key] = leftKfs;

            const rightKfs = kfs
              .filter((k) => k.time >= relativeSplitTime)
              .map((k) => ({
                value: k.value,
                time: k.time - relativeSplitTime,
              }));
            rightKfs.unshift({ time: 0, value: splitVal });
            rightAnimations[key] = rightKfs;
          }
        }

        const leftClip: TimelineClip = {
          ...structuredClone(clip),
          id: leftClipId,
          splitGroupId: groupId,
          duration: relativeSplitTime,
          trimEnd: hasRamp
            ? originalMediaDuration - splitMediaTime
            : clip.trimEnd + (clip.duration - relativeSplitTime) * clip.speed,
          transitionOut: undefined, // Clear transition on the first half of the split
          speedRamp: leftSpeedRamp,
          animations: leftAnimations,
        };

        const rightClip: TimelineClip = {
          ...structuredClone(clip),
          id: rightClipId,
          splitGroupId: groupId,
          startTime: splitTime,
          duration: clip.duration - relativeSplitTime,
          trimStart: splitMediaTime,
          transitionIn: undefined, // Clear transition on the second half of the split
          speedRamp: rightSpeedRamp,
          animations: rightAnimations,
        };

        const newClips = [...track.clips];
        newClips.splice(clipIndex, 1, leftClip, rightClip);

        return { ...track, clips: newClips };
      });

      if (isSelected && leftClipId) {
        return {
          tracks,
          pipWindows,
          selectedClipId: leftClipId,
          selectedClipIds: [leftClipId],
        };
      }

      return { tracks, pipWindows };
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
    const videoClip = tracks.flatMap((t) => t.clips || []).find((c) => c.id === clipId);
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
        });
      }

      return { tracks: updatedTracks };
    });
    get().saveSnapshot('Extract Audio');
  },

  breakLinkConnection: (clipId) => {
    set((state) => {
      const clip = state.tracks.flatMap((t) => t.clips || []).find((c) => c.id === clipId);
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
    get().saveSnapshot('Add Marker');
  },
  updateMarker: (id, updates) => {
    set((state) => ({
      markers: state.markers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
    get().saveSnapshot('Update Marker');
  },
  removeMarker: (id) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }));
    get().saveSnapshot('Remove Marker');
  },



  // Playback
  play: () => {
    const { tracks, selectedClipIds, currentTime } = get();
    const allClips = tracks.flatMap((t) => t.clips || []);
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
    const allClips = tracks.flatMap((t) => t.clips || []);
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
  setMuteTimelineAudio: (mute: boolean) => set({ muteTimelineAudio: mute }),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  setInPoint: (time) => set({ inPoint: time }),
  setOutPoint: (time) => set({ outPoint: time }),

  // Tools
  setActiveTool: (tool) => set((state) => {
    if (tool === 'ripple') {
      return { activeTool: tool, selectedClipIds: [], selectedTrackId: null, selectedClipId: null };
    }
    return { activeTool: tool };
  }),

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
    
    const typeCount = get().tracks.filter((t) => t.type === type).length;
    const id = `track_${prefix}_${generateId()}`;
    
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
        name: `${prefix.toUpperCase()}${typeCount + 1}`,
        type,
        linkedTrackId,
        clips: [],
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
      const videoClips = state.tracks.flatMap(t => (t.clips || []).filter(c => c.mediaId && state.mediaLibrary.find(m => m.id === c.mediaId)?.type === 'video'));
      const audioClips = state.tracks.flatMap(t => (t.clips || []).filter(c => c.mediaId && state.mediaLibrary.find(m => m.id === c.mediaId)?.type === 'audio'));
      
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
      }));
      return { tracks: newTracks };
    });
    get().saveSnapshot('Add Keyframe');
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
      }));
      return { tracks: newTracks };
    });
    get().saveSnapshot('Delete Keyframe');
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
      }));
      return { tracks: newTracks };
    });
    get().saveSnapshot('Move Keyframe');
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
      }));
      return { tracks: newTracks };
    });
    get().saveSnapshot('Toggle Easing Hold');
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

  removeSelectedKeyframeLines: () => {
    set((state) => {
      if (state.selectedKeyframeLines.length === 0) return {};
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
    });
    get().saveSnapshot('Remove Keyframes');
  },

  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  // Clipboard
  copyClip: (copyType = 'whole') => {
    const { tracks, selectedClipIds, selectedClipId } = get();
    // Default to the single selected clip/overlayer if array is empty (for fallback)
    let targetIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    
    if (targetIds.length === 0) return;

    const clipsToCopy = [];
    const allClips = getAllClipsDeep(get());
    for (const clip of allClips) {
      if (targetIds.includes(clip.id)) {
        const found = findClipDeep(get(), clip.id);
        const trackType = found ? found.track.type : 'video';
        clipsToCopy.push({ ...clip, effects: [...clip.effects], trackType, isOverLayer: false });
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
    const {
      clipboardData, currentTime, selectedTrackId,
      selectedClipIds, selectedClipId, tracks,
      activePipWindowId, pipWindows
    } = get();
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
      let searchTracks = tracks;
      if (activePipWindowId && pipWindows[activePipWindowId]) {
        searchTracks = pipWindows[activePipWindowId].tracks;
      }
      if (searchTracks.length === 0) return;
      const preferredType = firstCopiedClip.trackType || (firstCopiedClip.mediaId ? 'video' : 'text');
      const matchTrack = searchTracks.find(t => t.type === preferredType);
      targetTrackId = matchTrack ? matchTrack.id : searchTracks[0].id;
    }
    
    // Sort copied clips by startTime to maintain relative spacing
    const sortedClips = [...clipData.clips].sort((a: any, b: any) => a.startTime - b.startTime);
    
    // Calculate local playhead position if inside PIP
    let localCurrentTime = currentTime;
    if (activePipWindowId && pipWindows[activePipWindowId]) {
      const activePip = pipWindows[activePipWindowId];
      const foundParent = findClipDeep(get(), activePip.parentClipId);
      if (foundParent) {
        const pipAbsStart = foundParent.clip.startTime + (activePip.relativeStartTime || 0);
        localCurrentTime = Math.max(0, currentTime - pipAbsStart);
      }
    }
    const baseTimeOffset = localCurrentTime - (sortedClips[0]?.startTime || 0);

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
      
      return pastedClip;
    });

    const regularClipsToPaste: any[] = [];
    
    newClips.forEach(c => {
      const cleanClip = { ...c };
      delete cleanClip.isOverLayer;
      delete cleanClip.trackType;
      regularClipsToPaste.push(cleanClip);
    });

    if (regularClipsToPaste.length > 0) {
      regularClipsToPaste.forEach(c => get().addClip(c));
      set({
        selectedClipIds: regularClipsToPaste.map(c => c.id),
        selectedClipId: regularClipsToPaste[regularClipsToPaste.length - 1].id,
      });
    }
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
    const found = findClipDeep(get(), selectedClipId);
    if (found) {
      const clonedClip = structuredClone(found.clip);
      const dup = {
        ...clonedClip,
        id: generateId(),
        startTime: found.clip.startTime + found.clip.duration,
        splitGroupId: undefined,
        isPreview: false,
      };
      get().addClip(dup);
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
        pipWindows: JSON.parse(JSON.stringify(state.pipWindows || {})),
        subtitles: JSON.parse(JSON.stringify(state.subtitles || [])),
        markers: JSON.parse(JSON.stringify(state.markers || [])),
        beatMarkers: JSON.parse(JSON.stringify(state.beatMarkers || [])),
        label: label || defaultLabel,
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      return {
        history: newHistory.slice(-50),
        historyIndex: newHistory.length - 1,
      };
    });
    // Debounced auto-save to IndexedDB
    debouncedSaveProject(get());
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
        pipWindows: JSON.parse(JSON.stringify(snap.pipWindows || {})),
        subtitles: JSON.parse(JSON.stringify(snap.subtitles || [])),
        markers: JSON.parse(JSON.stringify(snap.markers || [])),
        beatMarkers: JSON.parse(JSON.stringify(snap.beatMarkers || [])),
        historyIndex: state.historyIndex - 1,
      };
    });
    debouncedSaveProject(get());
  },
  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return {};
      const snap = state.history[state.historyIndex + 1];
      return {
        tracks: JSON.parse(JSON.stringify(snap.tracks)),
        currentTime: snap.currentTime,
        pipWindows: JSON.parse(JSON.stringify(snap.pipWindows || {})),
        subtitles: JSON.parse(JSON.stringify(snap.subtitles || [])),
        markers: JSON.parse(JSON.stringify(snap.markers || [])),
        beatMarkers: JSON.parse(JSON.stringify(snap.beatMarkers || [])),
        historyIndex: state.historyIndex + 1,
      };
    });
    debouncedSaveProject(get());
  },
  jumpToHistoryIndex: (index) => {
    set((state) => {
      if (index < 0 || index >= state.history.length) return {};
      const snap = state.history[index];
      return {
        tracks: JSON.parse(JSON.stringify(snap.tracks)),
        currentTime: snap.currentTime,
        pipWindows: JSON.parse(JSON.stringify(snap.pipWindows || {})),
        subtitles: JSON.parse(JSON.stringify(snap.subtitles || [])),
        markers: JSON.parse(JSON.stringify(snap.markers || [])),
        beatMarkers: JSON.parse(JSON.stringify(snap.beatMarkers || [])),
        historyIndex: index,
        selectedClipId: null,
        selectedClipIds: [],
        selectedOverLayerId: null,
        selectedTransitionClipId: null,
      };
    });
    get().recalcTotalDuration();
    debouncedSaveProject(get());
  },

  // Drag/Drop
  setDraggingClipId: (id) => set({ draggingClipId: id }),
  setDragPreview: (time, trackId) => set({ dragPreviewTime: time, dragPreviewTrackId: trackId }),

  // Voiceover Recording State
  startVoiceoverRecordingState: (trackId) => set({ isRecordingVoiceover: true, recordingTrackId: trackId }),
  stopVoiceoverRecordingState: () => set({ isRecordingVoiceover: false, recordingTrackId: null }),

  // Project
  setProjectInfo: (id, name) => set({ projectId: id, projectName: name }),
  resetProject: async (clearDB = false) => {
    // Revoke all object URLs
    const { mediaLibrary } = get();
    mediaLibrary.forEach((m) => {
      if (m.url) try { URL.revokeObjectURL(m.url); } catch { /* ignore */ }
      if (m.thumbnail) try { URL.revokeObjectURL(m.thumbnail); } catch { /* ignore */ }
    });
    // Clear IndexedDB completely only if requested
    if (clearDB) {
      try {
        await clearProjectDB();
      } catch(err) {
        console.error('Failed to clear database:', err);
      }
    }
    const { previewCanvas, masterAudioStream } = get();
    const freshTracks = createEmptyTracks();
    set({
      ...initialState,
      previewCanvas,
      masterAudioStream,
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
      
      const loadedTracks = data.tracks;

      const loadedPipWindows = (data as any).pipWindows || {};
      const folders = data.folders || [];
      const subtitles = (data as any).subtitles || [];
      const markers = (data as any).markers || [];
      const beatMarkers = (data as any).beatMarkers || [];
      set({
        tracks: loadedTracks,
        mediaLibrary: data.mediaLibrary,
        folders,
        subtitles,
        markers,
        beatMarkers,
        currentTime: data.currentTime,
        aspectRatio: data.aspectRatio || '16:9',
        pipWindows: loadedPipWindows,
        activePipWindowId: null,
        history: [
          {
            tracks: JSON.parse(JSON.stringify(loadedTracks)),
            currentTime: data.currentTime,
            pipWindows: JSON.parse(JSON.stringify(loadedPipWindows)),
            subtitles: JSON.parse(JSON.stringify(subtitles)),
            markers: JSON.parse(JSON.stringify(markers)),
            beatMarkers: JSON.parse(JSON.stringify(beatMarkers)),
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
    const { tracks, pipWindows } = get();

    // FIX M29: Do NOT silently remove user-created tracks that happen to be empty.
    // Only auto-remove tracks that are both dynamic AND have never had any clips/overLayers.
    // Keep all non-dynamic (user-created) tracks regardless of empty state.
    const cleanedTracks = tracks.filter(
      (t) => !t.isDynamic || t.clips.length > 0
    );

    let maxEnd = 0;
    for (const track of cleanedTracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }

    // Recalculate PIP Window durations:
    // Ensure every PIP window has a 3-second blank gap after the last clip, up to 10 minutes maximum (600s).
    const updatedPipWindows = { ...pipWindows };
    let pipChanged = false;
    
    if (pipWindows && Object.keys(pipWindows).length > 0) {
      for (const [id, pip] of Object.entries(pipWindows)) {
        if (!pip) continue;
        let maxClipEnd = 0;
        for (const track of pip.tracks) {
          for (const clip of track.clips) {
            const end = clip.startTime + clip.duration;
            if (end > maxClipEnd) maxClipEnd = end;
          }
        }
        // Duration is maxClipEnd + 3 seconds, capped at 10 minutes (600 seconds)
        // If manualDuration is set, respect it but ensure it is at least maxClipEnd
        const targetDuration = pip.manualDuration
          ? Math.max(pip.duration, maxClipEnd)
          : Math.min(600, Math.max(5, maxClipEnd + 3));
        if (pip.duration !== targetDuration) {
          updatedPipWindows[id] = { ...pip, duration: targetDuration };
          pipChanged = true;
        }
      }
    }

    // Set totalDuration with a minimum floor of 0.1 to avoid unusable slider empty state
    set({
      tracks: cleanedTracks,
      totalDuration: maxEnd || 0.1,
      ...(pipChanged ? { pipWindows: updatedPipWindows } : {})
    });
  },

  // PIP Window Operations
  createPipWindow: (clipId, relativeStartTime) => {
    const id = generateId();
    const newPip: PipWindow = {
      id,
      parentClipId: clipId,
      relativeStartTime,
      tracks: [],
      duration: 5,
      zIndex: Object.keys(get().pipWindows || {}).length + 1,
    };
    
    set((state) => {
      const clip = state.tracks.flatMap(t => t.clips || []).find(c => c && c.id === clipId);
      if (!clip) return {};
      
      const newTracks = state.tracks.map(t => {
        const hasClip = (t.clips || []).some(c => c.id === clipId);
        if (!hasClip) return t;
        return {
          ...t,
          clips: (t.clips || []).map(c => 
            c.id === clipId ? { ...c, pipWindowIds: [...(c.pipWindowIds || []), id] } : c
          )
        };
      });

      return {
        tracks: newTracks,
        pipWindows: { ...state.pipWindows, [id]: newPip },
        activePipWindowId: id,
        selectedClipId: null,
        selectedClipIds: [],
        selectedTrackId: null,
      };
    });
    get().saveSnapshot('Create PIP Window');
  },

  deletePipWindow: (pipId) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};

      const newPipWindows = { ...state.pipWindows };
      delete newPipWindows[pipId];

      const newTracks = state.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => 
          c.id === pip.parentClipId 
            ? { ...c, pipWindowIds: (c.pipWindowIds || []).filter(id => id !== pipId) } 
            : c
        )
      }));

      const deletedClipIds = pip.tracks.flatMap(t => t.clips || []).map(c => c.id);
      const newSelectedClipIds = state.selectedClipIds.filter(id => !deletedClipIds.includes(id));
      const newSelectedClipId = newSelectedClipIds.includes(state.selectedClipId || '') 
        ? state.selectedClipId 
        : (newSelectedClipIds[0] || null);

      return {
        pipWindows: newPipWindows,
        tracks: newTracks,
        activePipWindowId: state.activePipWindowId === pipId ? null : state.activePipWindowId,
        selectedClipId: newSelectedClipId,
        selectedClipIds: newSelectedClipIds,
      };
    });
    get().saveSnapshot('Delete PIP Window');
  },

  updatePipWindowStartTime: (pipId, relativeStartTime) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};
      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: { ...pip, relativeStartTime: Math.max(0, relativeStartTime) }
        }
      };
    });
    get().saveSnapshot('Move PIP Window');
  },

  updatePipWindowDuration: (pipId: string, duration: number) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};
      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: { ...pip, duration: Math.max(0.5, duration), manualDuration: true }
        }
      };
    });
    get().saveSnapshot('Resize PIP Window');
  },

  setActivePipWindow: (pipId) => {
    set({
      activePipWindowId: pipId,
      selectedClipId: null,
      selectedClipIds: [],
      selectedTrackId: null,
    });
  },

  addTrackToPip: (pipId: string, type: 'video' | 'audio' | 'text' | 'fx', mediaId: string, startTime: number, duration: number) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};

      // Check if a track of the same type already exists
      const existingTrack = pip.tracks.find((t) => t.type === type);
      
      if (existingTrack) {
        let lastEnd = 0;
        for (const c of existingTrack.clips) {
          const end = c.startTime + c.duration;
          if (end > lastEnd) lastEnd = end;
        }

        let targetDuration = duration;
        if (pip.manualDuration) {
          const maxDur = pip.duration - lastEnd;
          if (maxDur <= 0.05) return {}; // No space left
          targetDuration = Math.min(duration, maxDur);
        }

        const newClip: TimelineClip = {
          id: generateId(),
          trackId: existingTrack.id,
          mediaId,
          startTime: lastEnd, // Append to the end of the track
          duration: targetDuration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 30, y: 30, scale: 30, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: []
        };

        const newTracks = pip.tracks.map((t) => {
          if (t.id === existingTrack.id) {
            return { ...t, clips: [...t.clips, newClip] };
          }
          return t;
        });

        return {
          pipWindows: {
            ...state.pipWindows,
            [pipId]: { ...pip, tracks: newTracks }
          }
        };
      } else {
        const trackId = generateId();
        
        let targetDuration = duration;
        if (pip.manualDuration) {
          const maxDur = pip.duration - startTime;
          if (maxDur <= 0.05) return {};
          targetDuration = Math.min(duration, maxDur);
        }

        const newClip: TimelineClip = {
          id: generateId(),
          trackId,
          mediaId,
          startTime,
          duration: targetDuration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 30, y: 30, scale: 30, rotation: 0 }, // Default to bottom-right corner for PIP
          opacity: 1,
          speed: 1,
          effects: []
        };

        const newTrack: TimelineTrack = {
          id: trackId,
          name: `${type.toUpperCase()} Track ${pip.tracks.length + 1}`,
          type,
          clips: [newClip],
          locked: false,
          muted: false,
          hidden: false,
        };

        return {
          pipWindows: {
            ...state.pipWindows,
            [pipId]: { ...pip, tracks: [...pip.tracks, newTrack] }
          }
        };
      }
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Add PIP Clip');
  },

  addEmptyTrackToPip: (pipId: string, type: 'video' | 'audio' | 'text' | 'fx') => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};

      let prefix = 'v';
      if (type === 'audio') prefix = 'a';
      if (type === 'text') prefix = 't';
      if (type === 'fx') prefix = 'fx';

      const trackId = `${prefix}_pip_${generateId().slice(0, 4)}`;

      const newTrack: TimelineTrack = {
        id: trackId,
        name: `${type.toUpperCase()} Track ${pip.tracks.length + 1}`,
        type,
        clips: [],
        locked: false,
        muted: false,
        hidden: false,
      };

      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: {
            ...pip,
            tracks: [...pip.tracks, newTrack]
          }
        }
      };
    });
    get().saveSnapshot('Add PIP Track');
  },

  removeTrackFromPip: (pipId: string, trackId: string) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};
      
      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: {
            ...pip,
            tracks: pip.tracks.filter(t => t.id !== trackId)
          }
        }
      };
    });
    get().saveSnapshot('Remove PIP Clip');
  },

  reorderPipTrack: (pipId, trackIndex, direction) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};
      
      const newTracks = [...pip.tracks];
      const targetIndex = direction === 'up' ? trackIndex - 1 : trackIndex + 1;
      
      if (targetIndex < 0 || targetIndex >= newTracks.length) return {};
      
      const temp = newTracks[trackIndex];
      newTracks[trackIndex] = newTracks[targetIndex];
      newTracks[targetIndex] = temp;

      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: { ...pip, tracks: newTracks }
        }
      };
    });
  },

  updatePipTrack: (pipId, trackId, updates) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};
      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: {
            ...pip,
            tracks: pip.tracks.map(t =>
              t.id === trackId ? { ...t, ...updates } : t
            )
          }
        }
      };
    });
    get().saveSnapshot('Update PIP Track');
  },

  // Keyboard Delete — remove selected PIP window or clip
  removeSelected: () => {
    const state = get();
    if (state.activePipWindowId) {
      state.deletePipWindow(state.activePipWindowId);
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
    get().saveSnapshot('Add Beat Markers');
  },
  clearBeatMarkers: (clipId) => {
    set((state) => ({
      beatMarkers: state.beatMarkers.filter((b) => b.clipId !== clipId),
    }));
    get().saveSnapshot('Clear Beat Markers');
  },

  // Layout Presets
  setWorkspaceLayout: (layout) => {
    set({ workspaceLayout: layout });
  },

  // Compound Clips
  enterCompoundClip: (clipId) => {
    const { tracks, timelineStack, mediaLibrary, pipWindows } = get();
    let clip = tracks.flatMap(t => t.clips || []).find(c => c.id === clipId);
    
    // Check PIP tracks if not found in main tracks
    if (!clip) {
      for (const pipId in (pipWindows || {})) {
        clip = pipWindows[pipId].tracks.flatMap(t => t.clips || []).find(c => c.id === clipId);
        if (clip) break;
      }
    }
    
    if (!clip || !clip.mediaId) return;
    
    const media = mediaLibrary.find(m => m.id === clip.mediaId);
    if (!media || media.type !== 'compound') return;

    set({
      timelineStack: [...timelineStack, { tracks: JSON.parse(JSON.stringify(tracks)), compoundMediaId: media.id, activePipWindowId: get().activePipWindowId }],
      tracks: media.nestedTimeline ? JSON.parse(JSON.stringify(media.nestedTimeline)) : [],
      currentTime: 0,
      activePipWindowId: null,
      selectedClipId: null,
      selectedClipIds: []
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
      activePipWindowId: currentStackItem.activePipWindowId || null,
      currentTime: 0,
      selectedClipId: null,
      selectedClipIds: []
    });
    get().recalcTotalDuration();
  }
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    const state = useEditorStore.getState();
    if (state.hasUnsavedChanges || saveTimeoutId) {
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
        const { tracks, mediaLibrary, folders, subtitles, markers, beatMarkers, currentTime, aspectRatio, projectId, projectName, pipWindows } = state;
        // Immediate save on close
        saveProjectToDB({ tracks, mediaLibrary, folders, subtitles, markers, beatMarkers, currentTime, aspectRatio, projectId, pipWindows } as any).catch(console.error);
        if (projectId !== 'default') {
          saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() }).catch(console.error);
        }
      }
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
