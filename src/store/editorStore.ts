// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

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
import { computeSplitHalvesMedia, SpeedRampEngine } from '@/utils/speedRamp';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, loadProjectFromDB, clearProjectDB, saveTemplatesToDB, getTemplatesFromDB, resolveMediaItemFromDB, setActiveProject, saveProjectMeta } from '@/utils/projectPersistence';
import { getAnimatedValue } from '@/utils/keyframes';
import { serializeProjectData, saveProjectToHandle } from '@/utils/fileSystemAccess';
import { cleanupClipBackgroundState } from '@/utils/aiBackground';
import { detectAspectRatio } from '@/utils/aspectRatioHelper';
import { setPlaybackTime, getPlaybackTime } from '@/utils/playbackClock';
import { clearImageBitmapPool } from '@/utils/imageBitmapPool';
import { clearAllMediaWindows } from '@/utils/ramWindowedBlobCache';
import { clearFrameCache } from '@/utils/frameExtractor';
import {
  planKineticSync,
  planGroupReflow,
  deriveLineStructure,
  isKineticMediaId,
  type ExistingWordLayer,
  type SyncPlan,
} from '@/utils/kineticSync';
import type { AspectRatioConflictData } from '@/types';

let saveTimeoutId: any = null;
const debouncedSaveProject = (state: any) => {
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
  }
  const { tracks, mediaLibrary, folders, subtitles, markers, beatMarkers, currentTime, aspectRatio, projectId, projectName, pipWindows, sequences, projectFileHandle } = state;
  const hasAnyMedia = mediaLibrary && mediaLibrary.length > 0;
  const hasAnyClips = tracks && tracks.some((t: any) => t.clips && t.clips.length > 0);
  const hasAnyExtras = (subtitles && subtitles.length > 0) || (markers && markers.length > 0) || (beatMarkers && beatMarkers.length > 0) || (pipWindows && Object.keys(pipWindows).length > 0);
  
  if (!hasAnyMedia && !hasAnyClips && !hasAnyExtras && projectId === 'default') {
    return; // Skip auto-saving empty default projects on startup
  }

  useEditorStore.setState({ hasUnsavedChanges: true });
  saveTimeoutId = setTimeout(async () => {
    // Always save to IndexedDB as a fallback backup
    try {
      await saveProjectToDB({ tracks, mediaLibrary, folders, subtitles, markers, beatMarkers, currentTime, aspectRatio, projectId, pipWindows, sequences } as any);
      if (projectId !== 'default') {
        await saveProjectMeta({ id: projectId, name: projectName, lastModified: Date.now() });
      }
      useEditorStore.setState({ hasUnsavedChanges: false });
    } catch (err) {
      console.error('Failed to auto-save project to IndexedDB:', err);
    }

    // If an OS file handle exists, auto-save to disk instantly
    if (projectFileHandle) {
      try {
        const fileContent = serializeProjectData(state);
        await saveProjectToHandle(projectFileHandle, fileContent);
      } catch (err) {
        console.error('Failed to auto-save to OS file handle:', err);
        // We could notify the user here if we wanted to
      }
    }

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
const createEmptyTracks = (): TimelineTrack[] => [];

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
  setProjectFileHandle: (handle: any) => void;
  addOrUpdateVirtualCameraKeyframe: (time: number, x: number, y: number, scale?: number) => void;
  setVirtualCameraEnabled: (enabled: boolean) => void;
  setVirtualCameraAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:3') => void;
  copyColorGrade: (clipId: string) => void;
  pasteColorGrade: (clipId: string) => void;
  applyColorGradeToAll: (clipId: string) => void;
  // Media Library
  addMedia: (item: MediaItem, file?: File) => void;
  removeMedia: (id: string) => void;
  updateMediaMetadata: (id: string, updates: Partial<MediaItem>) => void;
  createFolder: (name: string, parentId?: string | null) => void;
  deleteFolder: (id: string) => void;
  moveMediaToFolder: (mediaId: string, folderId: string | null) => void;

  // Image Sequence Operations
  addImageSequence: (mediaIds: string[], opts: { trackId: string; startTime: number; defaultClipDuration?: number; overlap?: number; transitionType?: any }) => string;
  updateSequence: (sequenceId: string, patch: any) => void;
  dissolveSequence: (sequenceId: string) => void;

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
  liftClip: (clipId: string) => void;
  extractClip: (clipId: string) => void;
  replaceClipMedia: (clipId: string, newMediaId: string) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>, options?: { ripple?: boolean }) => void;
  /**
   * Reconcile a Hybrid kinetic-typography sentence with its per-word PiP layers.
   * Called automatically whenever the primary clip's text changes.
   */
  syncKineticSentence: (primaryClipId: string, opts?: { reflowOnly?: boolean }) => void;
  /** Strip container transforms baked into PiP word positions by older versions. */
  normalizeKineticBakedTransforms: () => void;
  batchUpdateClips: (updates: { clipId: string; changes: Partial<TimelineClip> }[]) => void;
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
  setIsBuffering: (isBuffering: boolean) => void;
  setPlaybackDirection: (dir: -1 | 0 | 1, speed?: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setTotalDuration: (duration: number) => void;
  setInPoint: (time: number | null) => void;
  setOutPoint: (time: number | null) => void;
  setIsScrubbing: (scrubbing: boolean) => void;
  setPerfDowngraded: (downgraded: boolean) => void;

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
  addTrack: (type: 'video' | 'audio' | 'text' | 'fx' | 'adjustment') => void;
  addAdjustmentLayer: (duration?: number) => void;
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
  copyClip: (type?: 'clip' | 'style' | 'whole' | 'style-only' | 'style-with-position') => void;
  pasteClip: (type?: 'clip' | 'style' | 'whole' | 'style-only' | 'style-with-position') => void;
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
  recalcPipDurations: (pipId: string) => void;
  setAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:3') => void;
  setPerRatioFramingEnabled: (enabled: boolean) => void;
  updateClipPerRatioFraming: (clipId: string, ratio: string, framing: { x?: number; y?: number; scale?: number; autoReframeTrackId?: string }) => void;
  reframeProject: (ratio: '16:9' | '9:16' | '1:1' | '4:3') => void;
  setAspectRatioConflictData: (data: AspectRatioConflictData | null) => void;
  resolveAspectRatioConflict: (applyNewRatio: boolean, dontAskAgain?: boolean) => void;

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
  autoSyncTrackToBeats: (trackId: string, audioClipId: string, everyNBeats: number, transitionType?: string) => void;

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

  // Arrange Mode
  setArrangeMode: (val: boolean) => void;
}

const defaultTracks = createEmptyTracks();
const initialState: EditorState = {
  projectId: 'default',
  projectName: 'Untitled Project',
  projectFileHandle: null,
  mediaLibrary: [],
  folders: [],
  tracks: defaultTracks,
  timelineStack: [],
  selectedClipId: null,
  selectedClipIds: [],
  pipWindows: {},
  sequences: [],
  activePipWindowId: null,
  colorClipboard: null,
  selectedTransitionClipId: null,
  selectedKeyframeLines: [],
  selectedTrackId: null,
  settings: {
    theme: (typeof window !== 'undefined' && (localStorage.getItem('procut_theme') as 'dark' | 'light')) || 'dark',
    scrollSpeed: 1,
    gestureSensitivity: 1,
    autosave: true,
    showWaveform: true,
    snapEnabled: true,
    defaultDuration: 5,
    previewQuality: 'full',
    previewMode: 'auto',
    showThumbnails: true,
    hardwareAcceleration: true,
    keyboardShortcuts: {},
    geminiApiKey: '',
    groqApiKey: '',
    freesoundApiKey: '',
    elevenLabsApiKey: '',
    cloudflareAccountId: '',
    cloudflareApiToken: '',
  },
  hasUnsavedChanges: false,
  currentTime: 0,
  isPlaying: false,
  isBuffering: false,
  isScrubbing: false,
  perfDowngraded: false,
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
  perRatioFramingEnabled: true,
  perRatioFraming: {},
  virtualCamera: {
    enabled: false,
    aspectRatio: '9:16' as '9:16',
    keyframes: { '16:9': [], '9:16': [], '1:1': [], '4:3': [] } as Record<string, any>,
  } as any,
  aspectRatioConflictData: null,
  isArrangeMode: false,
};

export const mapTracksDeep = (state: EditorState, modifier: (track: TimelineTrack, pipId: string | null) => TimelineTrack) => {
  // Preserve object identity for unchanged tracks — same pattern as mapPipWindowClips.
  // Without this, every updateClip call creates new references for ALL tracks/clips,
  // defeating React.memo on every TimelineClipRow even when only 1 clip changed.
  let tracksChanged = false;
  const newTracks = state.tracks.map(t => {
    const origClips = t.clips || [];
    const input = { ...t, clips: origClips };
    const result = modifier(input, null);
    // Check if clips actually changed (the main data modifier touches)
    const clipsIdentical = result.clips === origClips || (
      result.clips.length === origClips.length &&
      result.clips.every((c, i) => c === origClips[i])
    );
    if (clipsIdentical) return t; // preserve original reference
    tracksChanged = true;
    return result;
  });

  let pipChanged = false;
  const newPipEntries = Object.entries(state.pipWindows || {}).map(([pipId, pip]) => {
    let pipTracksChanged = false;
    const pipTracks = (pip.tracks || []).map(t => {
      const origClips = t.clips || [];
      const input = { ...t, clips: origClips };
      const result = modifier(input, pipId);
      const clipsIdentical = result.clips === origClips || (
        result.clips.length === origClips.length &&
        result.clips.every((c, i) => c === origClips[i])
      );
      if (clipsIdentical) return t;
      pipTracksChanged = true;
      return result;
    });
    if (!pipTracksChanged) return [pipId, pip] as const;
    pipChanged = true;
    return [pipId, { ...pip, tracks: pipTracks }] as const;
  });

  return {
    tracks: tracksChanged ? newTracks : state.tracks,
    pipWindows: pipChanged ? Object.fromEntries(newPipEntries) : (state.pipWindows || {}),
  };
};

export const getAllClipsDeep = (state: EditorState): TimelineClip[] => {
  const mainClips = state.tracks.flatMap((t) => t.clips || []);
  const pipClips = Object.values(state.pipWindows || {}).flatMap(p => p.tracks.flatMap(t => t.clips || []));
  return [...mainClips, ...pipClips];
};

/**
 * Apply a clip transform to every clip nested inside PiP windows, returning a new
 * pipWindows object (or the original reference when nothing changed, so Zustand
 * subscribers are not needlessly woken).
 */
const mapPipWindowClips = (
  pipWindows: Record<string, PipWindow> | undefined,
  fn: (clip: TimelineClip) => TimelineClip
): Record<string, PipWindow> | undefined => {
  if (!pipWindows) return pipWindows;
  let changed = false;
  const next: Record<string, PipWindow> = {};

  for (const [pipId, pip] of Object.entries(pipWindows)) {
    let pipChanged = false;
    const tracks = pip.tracks.map((track) => {
      let trackChanged = false;
      const clips = track.clips.map((clip) => {
        const updated = fn(clip);
        if (updated !== clip) trackChanged = true;
        return updated;
      });
      if (!trackChanged) return track;
      pipChanged = true;
      return { ...track, clips };
    });
    if (!pipChanged) {
      next[pipId] = pip;
    } else {
      changed = true;
      next[pipId] = { ...pip, tracks };
    }
  }

  return changed ? next : pipWindows;
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

export const findClipInTracks = (
  tracks: TimelineTrack[],
  clipId: string | null | undefined,
  pipWindows?: Record<string, PipWindow>
): TimelineClip | undefined => {
  if (!clipId) return undefined;
  if (tracks) {
    for (let i = 0; i < tracks.length; i++) {
      const clips = tracks[i].clips;
      if (clips) {
        for (let j = 0; j < clips.length; j++) {
          if (clips[j] && clips[j].id === clipId) return clips[j];
        }
      }
    }
  }
  if (pipWindows) {
    for (const pip of Object.values(pipWindows)) {
      for (const t of pip.tracks || []) {
        const c = t.clips?.find((x) => x.id === clipId);
        if (c) return c;
      }
    }
  }
  return undefined;
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  setAIVideoGenerationState: (state: any) => set((prev: any) => ({ ...prev, ...state })),
  setScopeSettings: (settings: ScopeSettings) => set({ scopeSettings: settings, showScopes: settings.enabled }),

  // Arrange Mode
  setArrangeMode: (val: boolean) => set({ isArrangeMode: val }),

  setPerRatioFramingEnabled: (enabled: boolean) => set({ perRatioFramingEnabled: enabled }),
  setVirtualCameraEnabled: (enabled: boolean) => set((state) => ({ virtualCamera: { ...state.virtualCamera, enabled } })),
  setVirtualCameraAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:3') => set((state) => ({ virtualCamera: { ...state.virtualCamera, aspectRatio: ratio } })),
  addOrUpdateVirtualCameraKeyframe: (time: number, x: number, y: number, scale?: number) => set((state) => {
    const ratio = state.virtualCamera.aspectRatio;
    const currentKeyframes = state.virtualCamera.keyframes[ratio] || [];
    const existing = currentKeyframes.find(k => Math.abs(k.time - time) < 0.05);
    let newKeyframes = [...currentKeyframes];
    if (existing) {
      const idx = newKeyframes.indexOf(existing);
      newKeyframes[idx] = { ...existing, x, y };
      if (scale !== undefined) newKeyframes[idx].scale = scale;
    } else {
      newKeyframes.push({ time, x, y, scale: scale ?? 1 });
      newKeyframes.sort((a, b) => a.time - b.time);
    }
    return { virtualCamera: { ...state.virtualCamera, keyframes: { ...state.virtualCamera.keyframes, [ratio]: newKeyframes } } };
  }),
  updateClipPerRatioFraming: (clipId: string, ratio: string, framing: { x?: number; y?: number; scale?: number; autoReframeTrackId?: string }) => {
    set((state) => {
      const ratioFraming = state.perRatioFraming[ratio] || {};
      const currentClipFraming = ratioFraming[clipId] || { x: 0, y: 0 };
      return {
        perRatioFraming: {
          ...state.perRatioFraming,
          [ratio]: {
            ...ratioFraming,
            [clipId]: {
              ...currentClipFraming,
              ...framing,
            },
          },
        },
      };
    });
  },

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
        if (track.locked) return track;
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
        selectedClipIds: newSelectedClipIds,
        selectedKeyframeLines: state.selectedKeyframeLines.filter(l => l.clipId !== clipId)
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

  liftClip: (clipId: string) => {
    let deletedDuration = 0;
    let deletedStart = 0;
    let deletedTrackId: string | null = null;
    let deletedPipId: string | null = null;
    let isPip = false;

    set((state) => {
      const found = findClipDeep(state, clipId);
      if (!found) return {};
      isPip = found.isPip;
      deletedPipId = found.pipId;
      deletedStart = found.clip.startTime;
      deletedDuration = found.clip.duration;
      deletedTrackId = found.clip.trackId;

      const { tracks, pipWindows } = mapTracksDeep(state, (track, pipId) => {
        const matches = (pipId === deletedPipId) && (track.id === deletedTrackId);
        if (!matches) return track;
        return {
          ...track,
          clips: track.clips
            .filter((c) => c.id !== clipId)
            .map((c) =>
              c.startTime >= deletedStart + deletedDuration
                ? { ...c, startTime: c.startTime - deletedDuration }
                : c
            ),
        };
      });

      const newSelectedClipId =
        state.selectedClipId === clipId ? null : state.selectedClipId;
      const newSelectedClipIds = state.selectedClipIds.filter((id) => id !== clipId);

      return {
        tracks,
        pipWindows,
        selectedClipId: newSelectedClipId,
        selectedClipIds: newSelectedClipIds,
      };
    });

    get().recalcTotalDuration();
    get().saveSnapshot('Lift Clip');
  },

  extractClip: (clipId: string) => {
    let deletedDuration = 0;
    let deletedStart = 0;

    set((state) => {
      const found = findClipDeep(state, clipId);
      if (!found) return {};
      deletedStart = found.clip.startTime;
      deletedDuration = found.clip.duration;

      const { tracks, pipWindows } = mapTracksDeep(state, (track, pipId) => {
        const matches =
          found.isPip === (pipId !== null) &&
          (found.isPip ? pipId === found.pipId : true) &&
          track.id === found.track.id;
        if (!matches && !found.isPip) {
          return track.locked
            ? track
            : {
                ...track,
                clips: track.clips.map((c) =>
                  c.startTime >= deletedStart + deletedDuration
                    ? { ...c, startTime: c.startTime - deletedDuration }
                    : c
                ),
              };
        }
        if (!matches) return track;
        return {
          ...track,
          clips: track.clips
            .filter((c) => c.id !== clipId)
            .map((c) =>
              c.startTime >= deletedStart + deletedDuration
                ? { ...c, startTime: c.startTime - deletedDuration }
                : c
            ),
        };
      });

      const newSelectedClipId =
        state.selectedClipId === clipId ? null : state.selectedClipId;
      const newSelectedClipIds = state.selectedClipIds.filter((id) => id !== clipId);

      return {
        tracks,
        pipWindows,
        selectedClipId: newSelectedClipId,
        selectedClipIds: newSelectedClipIds,
        selectedKeyframeLines: state.selectedKeyframeLines.filter(l => l.clipId !== clipId)
      };
    });

    get().recalcTotalDuration();
    get().saveSnapshot('Extract Clip');
  },

  replaceClipMedia: (clipId: string, newMediaId: string) => {
    set((state) => {
      const found = findClipDeep(state, clipId);
      if (!found) return {};
      const oldClip = found.clip;
      const newMedia = state.mediaLibrary.find((m) => m.id === newMediaId);
      if (!newMedia) return {};

      const oldMedia = state.mediaLibrary.find((m) => m.id === oldClip.mediaId);
      const oldIsVideo = oldMedia?.type === 'video';
      const newIsVideo = newMedia.type === 'video';

      let updates: Partial<TimelineClip> = { mediaId: newMediaId };

      if (newIsVideo && oldIsVideo) {
        updates.trimStart = 0;
        updates.trimEnd = 0;
        updates.speed = oldClip.speed;
        const sourceDur = newMedia.duration;
        updates.duration = Math.max(0.1, Math.min(oldClip.duration, sourceDur));
      } else if (newMedia.type === 'image') {
        updates.trimStart = 0;
        updates.trimEnd = 0;
        updates.duration = oldClip.duration || 5;
      } else if (newMedia.type === 'audio') {
        updates.trimStart = 0;
        updates.trimEnd = 0;
        updates.duration = Math.min(oldClip.duration, newMedia.duration);
      }

      const newId = generateId();
      const { tracks, pipWindows } = mapTracksDeep(state, (track, pipId) => {
        const matches =
          (found.isPip ? pipId === found.pipId : pipId === null) &&
          track.id === found.track.id;
        if (!matches) return track;
        return {
          ...track,
          clips: track.clips.map((c) =>
            c.id === clipId
              ? { ...c, ...updates, id: c.id }
              : c
          ),
        };
      });

      return { tracks, pipWindows };
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Replace Clip Media');
  },

  // Media Library
  addImageSequence: (mediaIds, opts) => {
    const id = `seq_${Date.now()}`;
    const duration = opts.defaultClipDuration ?? 3;
    const overlap = opts.overlap ?? 0;
    const memberClipIds: string[] = [];
    
    let currentStart = opts.startTime;
    
    mediaIds.forEach((mediaId, idx) => {
      const clipId = `clip_${Date.now()}_${idx}`;
      const isLast = idx === mediaIds.length - 1;
      const clipDuration = isLast ? duration : duration + overlap;
      
      get().addClip({
        id: clipId,
        mediaId,
        trackId: opts.trackId,
        startTime: currentStart,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: 0,
        opacity: 100,
        speed: 1,
        effects: [],
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        sequenceId: id,
        sequenceIndex: idx,
        interpolation: {
          mode: opts.transitionType === 'kenburnsAuto' ? 'kenburns' : 'none',
          autoKenBurns: opts.transitionType === 'kenburnsAuto' || opts.transitionType === 'kenburnsFade',
        },
        kenBurns: (opts.transitionType === 'kenburnsAuto' || opts.transitionType === 'kenburnsFade') ? {
          enabled: true,
          startScale: Math.random() > 0.5 ? 100 : 115,
          endScale: Math.random() > 0.5 ? 115 : 100,
          startPanX: (Math.random() - 0.5) * 10,
          startPanY: (Math.random() - 0.5) * 10,
          endPanX: (Math.random() - 0.5) * 10,
          endPanY: (Math.random() - 0.5) * 10,
          easing: 'easeInOut'
        } : undefined,
        transitionOut: (!isLast && (opts.transitionType === 'crossfade' || opts.transitionType === 'kenburnsFade') && overlap > 0) ? {
          id: 'auto_' + Date.now(),
          name: 'Dissolve',
          type: 'dissolve',
          duration: overlap,
          params: {}
        } : undefined
      });
      
      memberClipIds.push(clipId);
      currentStart += duration - overlap;
    });
    
    set((state) => ({
      sequences: [
        ...(state.sequences || []),
        {
          id,
          trackId: opts.trackId,
          startTime: opts.startTime,
          totalDuration: currentStart - opts.startTime + (overlap > 0 ? overlap : 0),
          memberClipIds,
          defaultClipDuration: duration,
          overlap,
          transitionType: opts.transitionType ?? 'cut',
          createdAt: Date.now(),
        },
      ],
    }));
    
    return id;
  },

  updateSequence: (sequenceId, patch) => {
    set((state) => {
      const seqIndex = state.sequences.findIndex(s => s.id === sequenceId);
      if (seqIndex === -1) return state;
      
      const oldSeq = state.sequences[seqIndex];
      const newSeq = { ...oldSeq, ...patch };
      
      const newSequences = [...state.sequences];
      newSequences[seqIndex] = newSeq;

      // Update timeline clips
      const newTracks = [...state.tracks];
      const memberClips: { trackIdx: number; clipIdx: number; clip: any }[] = [];

      newTracks.forEach((track, tIdx) => {
        track.clips.forEach((clip, cIdx) => {
          if (clip.sequenceId === sequenceId) {
            memberClips.push({ trackIdx: tIdx, clipIdx: cIdx, clip: { ...clip } });
          }
        });
      });

      memberClips.sort((a, b) => (a.clip.sequenceIndex ?? 0) - (b.clip.sequenceIndex ?? 0));

      if (memberClips.length > 0) {
        let currentStart = memberClips[0].clip.startTime;

        memberClips.forEach((m, idx) => {
          const isLast = idx === memberClips.length - 1;
          const clipDuration = isLast ? newSeq.defaultClipDuration : newSeq.defaultClipDuration + newSeq.overlap;
          
          m.clip.startTime = currentStart;
          m.clip.duration = clipDuration;

          m.clip.interpolation = {
            ...m.clip.interpolation,
            mode: newSeq.transitionType === 'kenburnsAuto' ? 'kenburns' : 'none',
            autoKenBurns: newSeq.transitionType === 'kenburnsAuto' || newSeq.transitionType === 'kenburnsFade',
          };

          m.clip.kenBurns = (newSeq.transitionType === 'kenburnsAuto' || newSeq.transitionType === 'kenburnsFade') ? (m.clip.kenBurns || {
            enabled: true,
            startScale: Math.random() > 0.5 ? 100 : 115,
            endScale: Math.random() > 0.5 ? 115 : 100,
            startPanX: (Math.random() - 0.5) * 10,
            startPanY: (Math.random() - 0.5) * 10,
            endPanX: (Math.random() - 0.5) * 10,
            endPanY: (Math.random() - 0.5) * 10,
            easing: 'easeInOut'
          }) : undefined;

          if (!isLast && (newSeq.transitionType === 'crossfade' || newSeq.transitionType === 'kenburnsFade') && newSeq.overlap > 0) {
             m.clip.transitionOut = {
                id: 'auto_' + Date.now(),
                name: 'Dissolve',
                type: 'dissolve',
                duration: newSeq.overlap,
                params: {}
             };
          } else {
             m.clip.transitionOut = undefined;
          }

          currentStart += (newSeq.defaultClipDuration - newSeq.overlap);
        });

        memberClips.forEach(m => {
           const newTrack = { ...newTracks[m.trackIdx] };
           const newClips = [...newTrack.clips];
           newClips[m.clipIdx] = m.clip;
           newTrack.clips = newClips;
           newTracks[m.trackIdx] = newTrack;
        });
      }

      return { sequences: newSequences, tracks: newTracks };
    });
    get().saveSnapshot('Update Sequence');
  },

  dissolveSequence: (sequenceId) => {
    set((state) => ({
      sequences: state.sequences.filter(s => s.id !== sequenceId)
    }));
  },

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
    clearFrameCache(id);

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
      // 1. Determine expected track type based on media
      let expectedTrackType: 'video' | 'audio' | 'text' | 'fx' = 'video';
      const media = state.mediaLibrary.find(m => m.id === clip.mediaId);
      if (media) {
        if (media.type === 'audio') expectedTrackType = 'audio';
        else if (media.type === 'text') expectedTrackType = 'text';
        else if (media.type === 'fx' || media.type === 'lut') expectedTrackType = 'fx';
      } else if ((clip as any).textSettings) {
        expectedTrackType = 'text';
      }

      // Check for first video clip aspect ratio conflict
      let pendingConflictData: AspectRatioConflictData | null = null;
      if (media && media.type === 'video' && media.width && media.height && state.settings.autoPromptAspectRatio !== false) {
        const existingVideoClips = state.tracks
          .filter(t => t.type === 'video')
          .flatMap(t => t.clips || []);
        if (existingVideoClips.length === 0) {
          const detected = detectAspectRatio(media.width, media.height);
          if (detected !== state.aspectRatio) {
            pendingConflictData = {
              mediaName: media.name || 'Video Clip',
              videoWidth: media.width,
              videoHeight: media.height,
              detectedRatio: detected,
              currentRatio: state.aspectRatio,
            };
          }
        }
      }

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

      // 2. Validate track type, and auto-route if invalid/missing (not for PIP)
      if (!isPip && (!targetTrack || targetTrack.type !== expectedTrackType)) {
        // Find existing track of expected type
        let validTrack = state.tracks.find(t => t.type === expectedTrackType);
        
        let newTracks = [...state.tracks];
        if (!validTrack) {
          // Auto-create track
          const newTrackId = generateId();
          const trackCount = state.tracks.filter(t => t.type === expectedTrackType).length;
          const newName = `${expectedTrackType === 'video' ? 'V' : expectedTrackType === 'audio' ? 'A' : expectedTrackType === 'text' ? 'T' : 'F'}${trackCount + 1}`;
          
          validTrack = {
            id: newTrackId,
            name: newName,
            type: expectedTrackType,
            clips: [],
            locked: false,
            muted: false,
            hidden: false,
            volume: 1,
            pan: 0,
            solo: false,
          };
          
          if (expectedTrackType === 'video') {
            newTracks.unshift(validTrack);
          } else {
            newTracks.push(validTrack);
          }
        }
        
        // Append to the end of the chosen track if they didn't explicitly drop on it
        // OR if this was the very first drop (empty timeline) they just get startTime=0
        const trackClips = validTrack.clips;
        let newStartTime = clip.startTime;
        
        if (!targetTrack) {
           if (trackClips.length > 0) {
             const lastClip = trackClips.reduce((prev, current) => (prev.startTime + prev.duration > current.startTime + current.duration) ? prev : current);
             newStartTime = lastClip.startTime + lastClip.duration;
           } else {
             newStartTime = 0; // Explicitly start at 0 if no clips
           }
        } else {
           // Target track exists but is invalid type! Fall back to current dropTime but on the valid track.
           newStartTime = clip.startTime; 
        }

        targetTrack = validTrack;
        clip.trackId = targetTrack.id;
        clip.startTime = newStartTime;
        
        newTracks = newTracks.map(t => {
          if (t.id === targetTrack!.id) {
            return { ...t, clips: [...t.clips, { ...clip, isPreview: false }] };
          }
          return t;
        });
        
        return {
          tracks: newTracks,
          selectedClipId: clip.id,
          selectedClipIds: [clip.id],
          ...(pendingConflictData ? { aspectRatioConflictData: pendingConflictData } : {}),
        };
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
        return {
          pipWindows: newPipWindows,
          selectedClipId: clip.id,
          selectedClipIds: [clip.id],
          ...(pendingConflictData ? { aspectRatioConflictData: pendingConflictData } : {}),
        };
      } else {
        const newTracks = state.tracks.map((track) => {
          if (track.id === clip.trackId) {
            return { ...track, clips: [...track.clips, { ...clip, isPreview: false }] };
          }
          return track;
        });
        return {
          tracks: newTracks,
          selectedClipId: clip.id,
          selectedClipIds: [clip.id],
          ...(pendingConflictData ? { aspectRatioConflictData: pendingConflictData } : {}),
        };
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
      let isPipTrack = false;
      let targetPipId: string | null = null;
      for (const [pipId, pip] of Object.entries(state.pipWindows || {})) {
        if (pip.tracks.some(t => t.id === trackId)) {
          isPipTrack = true;
          targetPipId = pipId;
          break;
        }
      }

      if (isPipTrack && targetPipId) {
        const pip = state.pipWindows[targetPipId];
        const newPipTracks = pip.tracks.map((track) => {
          if (track.locked) return track;
          if (track.id !== trackId) {
            return {
              ...track,
              clips: track.clips.map((c) => ({
                ...c,
                startTime: c.startTime >= atTime ? c.startTime + clip.duration : c.startTime,
              })),
            };
          }
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
        return {
          pipWindows: {
            ...state.pipWindows,
            [targetPipId]: { ...pip, tracks: newPipTracks }
          },
          selectedClipId: clip.id,
          selectedClipIds: [clip.id]
        };
      }

      const newTracks = state.tracks.map((track) => {
        if (track.locked) return track;
        if (track.id !== trackId) {
          return {
            ...track,
            clips: track.clips.map((c) => ({
              ...c,
              startTime: c.startTime >= atTime ? c.startTime + clip.duration : c.startTime,
            })),
          };
        }
        
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
      let isPipTrack = false;
      let targetPipId: string | null = null;
      for (const [pipId, pip] of Object.entries(state.pipWindows || {})) {
        if (pip.tracks.some(t => t.id === trackId)) {
          isPipTrack = true;
          targetPipId = pipId;
          break;
        }
      }

      const processTrack = (track: any) => {
        if (track.id !== trackId) return track; // Overwrite only affects target track
        if (track.locked) return track;
        
        const clipEnd = atTime + clip.duration;
        
        // Remove clips that overlap completely or partially with the insert region
        let newClips = track.clips.filter((c: any) => {
          const cEnd = c.startTime + c.duration;
          // Keep clips that end before atTime or start after clipEnd
          return cEnd <= atTime || c.startTime >= clipEnd;
        });
        
        track.clips.forEach((c: any) => {
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
        
        return { ...track, clips: newClips.sort((a: any, b: any) => a.startTime - b.startTime) };
      };

      if (isPipTrack && targetPipId) {
        const pip = state.pipWindows[targetPipId];
        const newPipTracks = pip.tracks.map(processTrack);
        return {
          pipWindows: {
            ...state.pipWindows,
            [targetPipId]: { ...pip, tracks: newPipTracks }
          },
          selectedClipId: clip.id,
          selectedClipIds: [clip.id]
        };
      }

      const newTracks = state.tracks.map(processTrack);
      
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
      idsToRemove.forEach((id) => cleanupClipBackgroundState(id));

      const deletedClips = state.tracks.flatMap(t => t.clips || []).filter(c => idsToRemove.includes(c.id));

      let newTracks;
      if (state.activeTool === 'ripple' && deletedClips.length > 0) {
        // Multi-track Ripple Delete: Shift all clips across ALL tracks starting at/after the deleted range
        const minStartTime = Math.min(...deletedClips.map(c => c.startTime));
        const maxEndTime = Math.max(...deletedClips.map(c => c.startTime + c.duration));
        const shiftDuration = maxEndTime - minStartTime;

        newTracks = state.tracks.map((track) => {
          if (track.locked) return track;
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
        newTracks = state.tracks.map((track) => {
          if (track.locked) return track;
          return {
            ...track,
            clips: track.clips.filter((c) => !idsToRemove.includes(c.id)),
          };
        });
      }

      const newSelectedClipIds = state.selectedClipIds.filter((id) => !idsToRemove.includes(id));
      const newSelectedClipId =
        state.selectedClipId && idsToRemove.includes(state.selectedClipId)
          ? (newSelectedClipIds[0] || null)
          : state.selectedClipId;

      // Also delete from pipWindows tracks
      const newPipWindows = { ...state.pipWindows };
      let pipUpdated = false;

      // R-3: Only mark a PIP orphan when its parent clip is being removed.
      // Simply being referenced by a deleted clip's `pipWindowIds` array is NOT enough —
      // the parent itself must be in `idsToRemove`. Otherwise we nuke valid PIPs.
      const orphanPipIds = new Set<string>();
      for (const [pipId, pip] of Object.entries(state.pipWindows || {})) {
        if (idsToRemove.includes(pip.parentClipId ?? pip.clipId ?? '')) {
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
        selectedKeyframeLines: state.selectedKeyframeLines.filter(l => !idsToRemove.includes(l.clipId)),
        ...(pipUpdated || orphanPipIds.size > 0 ? { pipWindows: newPipWindows } : {})
      };
    });
    // R-3 / R-12 follow-up: Recalc durations of any PIP that lost child clips
    Object.keys(get().pipWindows || {}).forEach((pid) => {
      get().recalcPipDurations(pid);
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Delete Clip');
  },

  /**
   * One-time normalisation for projects saved before the renderer applied the PiP
   * container transform to its children.
   *
   * Those files have the container's scale/offset baked into each word position.
   * Now that the renderer applies the transform itself, the baked copy would be
   * applied twice. Re-laying the words out in local space removes it; the visual
   * result is identical because the renderer immediately re-applies the transform.
   */
  normalizeKineticBakedTransforms: () => {
    const state = get();
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if (!isKineticMediaId(clip.mediaId)) continue;
        if (!clip.pipWindowIds?.length) continue;
        if ((clip as any).kineticLocalSpace) continue; // already normalised
        const t = clip.transform;
        const isIdentity =
          (t?.x ?? 0) === 0 && (t?.y ?? 0) === 0 && (t?.scale ?? 100) === 100;
        if (!isIdentity) {
          get().syncKineticSentence(clip.id, { reflowOnly: true });
        }
        set((st) => ({
          tracks: st.tracks.map((tr) => ({
            ...tr,
            clips: tr.clips.map((c) =>
              c.id === clip.id ? ({ ...c, kineticLocalSpace: true } as any) : c
            ),
          })),
        }));
      }
    }
  },

  syncKineticSentence: (primaryClipId, opts) => {
    const state = get();
    const found = findClipDeep(state, primaryClipId);
    if (!found) return;
    const primary = found.clip as TimelineClip;

    const pipId = primary.pipWindowIds?.[0];
    if (!pipId) return;
    const pip = (state.pipWindows || {})[pipId];
    if (!pip) return;

    // Only Hybrid kinetic groups are managed this way. A user-authored clip that
    // merely happens to own a PiP window must never have its child layers rewritten.
    if (!isKineticMediaId(primary.mediaId)) return;

    const sentence = primary.textSettings?.text ?? '';

    // Collect the existing word layers in reading order. Each kinetic word lives
    // on its own single-clip PiP track, so track order IS word order.
    const existing: ExistingWordLayer[] = [];
    for (const track of pip.tracks) {
      if (track.type !== 'text') continue;
      const clip = track.clips[0];
      if (!clip) continue;
      existing.push({
        clipId: clip.id,
        trackId: track.id,
        text: clip.textSettings?.text ?? '',
        startTime: clip.startTime,
        duration: clip.duration,
        x: clip.transform?.x,
        y: clip.transform?.y,
        fontSize: clip.textSettings?.fontSize,
      });
    }
    if (existing.length === 0 && !sentence.trim()) return;

    // The primary clip's transform drives the group layout, so moving/scaling the
    // sentence re-flows every word at once instead of one-by-one.
    // Preserve the CURRENT line structure. The generator chooses line breaks from
    // the AI's per-word `breakAfter` hints, which cannot be recovered from the
    // sentence string; without this a group move/scale re-wrapped the sentence and
    // collapsed a multi-line block onto one line.
    // Prefer the AUTHORED structure stored on the container. Deriving it from the
    // words' Y positions is only a fallback: line spacing shrinks with the group
    // scale, so at small scales adjacent lines fall inside the grouping tolerance
    // and collapse into one — which is exactly how a vertical (one-word-per-line)
    // sentence turned into a single horizontal line while being resized.
    const storedStructure = (primary as any).kineticLineStructure as number[] | undefined;
    const derived = deriveLineStructure(existing);
    const lineStructure =
      Array.isArray(storedStructure) && storedStructure.length > 0 ? storedStructure : derived;

    // Word positions are stored in the container's LOCAL space — no baking.
    //
    // The renderer now applies the PiP container's full transform (translate,
    // scale, rotate, flip) to its children, so the group behaves like a real
    // group. Baking the container transform in here as well would apply it twice,
    // and rotation cannot be baked into x/y at all — that is why rotating the
    // sentence used to spin the selection box while leaving the words flat and
    // bunched together.
    const layoutOpts = {
      layout: (primary as any).kineticLayout === 'column' ? ('column' as const) : ('row' as const),
      lineStructure,
    };

    let updates: ReturnType<typeof planGroupReflow> = [];
    let inserts: SyncPlan['inserts'] = [];
    let removals: string[] = [];

    if (opts?.reflowOnly) {
      // Re-lay-out in LOCAL space. Used by the one-time migration below to strip
      // a container transform that older projects baked into word positions.
      updates = planGroupReflow(existing, sentence, layoutOpts);
    } else {
      const plan = planKineticSync(existing, sentence, pip.duration || primary.duration, layoutOpts);
      if (plan.noop && plan.updates.length === 0) return;
      updates = plan.updates;
      inserts = plan.inserts;
      removals = plan.removals;
    }

    if (updates.length === 0 && inserts.length === 0 && removals.length === 0) return;

    const updateByClipId = new Map(updates.map((u) => [u.clipId, u]));
    const removalSet = new Set(removals);

    set((st) => {
      const target = (st.pipWindows || {})[pipId];
      if (!target) return st;

      // Apply updates and drop removed words. A track whose only clip was removed
      // is deleted outright, which is what "removing a word clears that PiP layer"
      // means to the user.
      const nextTracks: TimelineTrack[] = [];
      for (const track of target.tracks) {
        const clip = track.clips[0];
        if (clip && removalSet.has(clip.id)) continue;

        if (clip && updateByClipId.has(clip.id)) {
          const u = updateByClipId.get(clip.id)!;
          nextTracks.push({
            ...track,
            name: `Word (${u.text})`,
            clips: [{
              ...clip,
              textSettings: {
                ...(clip.textSettings as any),
                ...(primary.textSettings as any),
                text: u.text,
                fontSize: u.fontSize,
              },
              transform: { ...clip.transform, x: u.x, y: u.y },
            }],
          });
        } else {
          nextTracks.push(track);
        }
      }

      // Insert brand-new word layers at their reading-order position.
      for (const ins of inserts) {
        const newClipId = generateId();
        const newTrackId = generateId();
        const template = target.tracks.find((t) => t.type === 'text')?.clips[0];
        const newTrack: TimelineTrack = {
          id: newTrackId,
          name: `Word (${ins.text})`,
          type: 'text',
          locked: false,
          muted: false,
          hidden: false,
          clips: [{
            ...(template ? { ...template } : {}),
            id: newClipId,
            trackId: newTrackId,
            mediaId: 'generator:kinetic-word',
            startTime: ins.startTime,
            duration: ins.duration,
            trimStart: 0,
            trimEnd: ins.duration,
            opacity: 1,
            speed: 1,
            effects: [],
            transform: {
              ...(template?.transform ?? { rotation: 0 }),
              x: ins.x,
              y: ins.y,
              scale: 100,
              rotation: template?.transform?.rotation ?? 0,
            },
            textSettings: {
              ...(template?.textSettings as any),
              text: ins.text,
              fontSize: ins.fontSize,
            },
          } as TimelineClip],
        };
        const at = Math.min(ins.index, nextTracks.length);
        nextTracks.splice(at, 0, newTrack);
      }

      // Remember the structure we just laid out, so a later resize reproduces the
      // author's line arrangement instead of re-deriving (and possibly losing) it.
      const structureToStore = lineStructure.length > 0 ? lineStructure : derived;
      const nextTracksTop = st.tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === primaryClipId ? ({ ...c, kineticLineStructure: structureToStore } as any) : c
        ),
      }));

      return {
        tracks: nextTracksTop,
        pipWindows: {
          ...st.pipWindows,
          [pipId]: { ...target, tracks: nextTracks },
        },
      };
    });
  },

  updateClip: (clipId, updates, options) => {
    let pipsToRecalc: string[] = [];
    set((state) => {
      const found = findClipDeep(state, clipId);
      if (!found) return state; // Prevent null pointer exception if clip was deleted

      
      let durationOverride = updates.duration; // Use whatever the caller passed first
      let durationDelta = 0;

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
      
      const newDuration = durationOverride !== undefined ? durationOverride : found.clip.duration;
      const newStartTime = updates.startTime !== undefined ? updates.startTime : found.clip.startTime;
      if ((newDuration !== found.clip.duration || newStartTime !== found.clip.startTime) && found.clip.pipWindowIds?.length) {
        pipsToRecalc = [...found.clip.pipWindowIds];
      }

      const finalUpdates = {
        ...updates,
        ...(durationOverride !== undefined ? { duration: durationOverride } : {})
      };

      // Build linked-clip timing propagation: when a clip's timing changes,
      // its linked audio/video clip must receive the same timing updates
      // to stay in sync. Without this, trimming or editing a clip leaves
      // the linked partner at its old position → audio/video misalignment.
      const linkedClipId = found.clip.linkedClipId;
      const timingKeys = ['startTime', 'trimStart', 'trimEnd', 'duration', 'speed', 'speedRamp'] as const;
      let linkedTimingUpdates: Record<string, any> | null = null;
      if (linkedClipId) {
        linkedTimingUpdates = {};
        for (const key of timingKeys) {
          if ((finalUpdates as any)[key] !== undefined) {
            (linkedTimingUpdates as any)[key] = (finalUpdates as any)[key];
          }
        }
        // If durationOverride was computed (from trimStart/trimEnd/speed change),
        // ensure it propagates to the linked clip too
        if (durationOverride !== undefined) {
          linkedTimingUpdates.duration = durationOverride;
        }
        // If no timing keys changed, skip linked update
        if (Object.keys(linkedTimingUpdates).length === 0) {
          linkedTimingUpdates = null;
        }
      }

      const { tracks, pipWindows } = mapTracksDeep(state, (track, pipId) => {
        const isTargetTrack = 
          (!found?.isPip && pipId === null && track.id === found?.track.id) ||
          (found?.isPip && pipId === found.pipId && track.id === found?.track.id);

        // C-1: Identify the target PIP window (if any) for bounds clamping
        const targetPip = pipId ? state.pipWindows?.[pipId] : null;

        return {
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id === clipId) {
              let merged = { ...clip, ...finalUpdates };
              // C-1: Clamp PIP bounds if this clip lives in a PIP
              if (targetPip) {
                const pipMaxDur = targetPip.manualDuration ?? targetPip.duration;
                if (merged.startTime < 0) {
                  merged.startTime = 0;
                }
                if (merged.startTime + merged.duration > pipMaxDur) {
                  if (merged.startTime >= pipMaxDur) {
                    merged.startTime = Math.max(0, pipMaxDur - merged.duration);
                  }
                  if (merged.startTime + merged.duration > pipMaxDur) {
                    merged.duration = Math.max(0.1, pipMaxDur - merged.startTime);
                  }
                }
              }
              return merged;
            }
            // Propagate timing changes to the linked clip
            if (linkedTimingUpdates && clip.id === linkedClipId) {
              return { ...clip, ...linkedTimingUpdates };
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

      // NOTE: `perRatioFraming` is deliberately NOT written here.
      //
      // It is an ADDITIVE per-aspect-ratio layer: renderers compute
      //     effectiveX = transform.x + framing.x
      //     effectiveScale = transform.scale * framing.scale / 100
      //
      // This block used to mirror the ABSOLUTE transform into it on every update,
      // which is a different quantity entirely. The consequences compounded:
      //   - Resizing to 250 stored framing.scale = 250 as well, so the clip
      //     actually rendered at 250 * 2.5 = 625%.
      //   - Moving to x = 40 stored framing.x = 40, doubling it to 80.
      //   - Worst of all, the overlay divides the framing back out when seeding a
      //     drag, so transform.scale / (framing.scale / 100) collapsed to exactly
      //     100 — which is why moving a resized clip snapped it back to 100%.
      //
      // Per-ratio framing is authored through its own dedicated action
      // (updateClipPerRatioFraming); a normal transform edit must leave it alone.
      const updatedPerRatioFraming = state.perRatioFraming;

      return { 
        tracks, 
        pipWindows,
        mediaLibrary: updatedMediaLibrary,
        perRatioFraming: updatedPerRatioFraming,
      };
    });
    // Only recalc duration when timing properties actually changed — not on
    // transform, opacity, or color edits which fire at 60 Hz during drag.
    const timingKeys = ['startTime', 'duration', 'trimStart', 'trimEnd', 'speed', 'speedRamp', 'startOffset'];
    if (typeof updates === 'object' && updates && timingKeys.some(k => k in updates)) {
      get().recalcTotalDuration();
    }
    if (pipsToRecalc.length > 0) {
      pipsToRecalc.forEach(pid => get().recalcPipDurations(pid));
    }

    // ── Kinetic typography live sync ─────────────────────────────────────────
    // When the primary sentence clip of a Hybrid kinetic group changes, push that
    // change down into its per-word PiP layers immediately, so the media panel,
    // timeline and canvas all agree without the user doing anything.
    //   - text changed      -> diff words: edit in place, add or drop only what moved
    //   - transform changed -> re-flow the whole block in one pass
    const touched = findClipDeep(get(), clipId);
    if (touched && !touched.isPip && touched.clip.pipWindowIds?.length) {
      // ONLY a text change re-lays-out the words.
      //
      // Transform changes must NOT trigger a reflow any more: the renderer now
      // applies the container transform to PiP children, so moving/scaling/
      // rotating the sentence already moves the words. Re-laying them out on top
      // of that recomputed the wrap from the transformed font size and bunched
      // the words together — visible as the words collapsing into each other
      // while the selection box rotated around them.
      if (updates.textSettings !== undefined) {
        get().syncKineticSentence(clipId);
      }
    }

    // NOTE: saveSnapshot() is intentionally NOT called here - callers call it explicitly when needed
    // This prevents excessive snapshot creation during drag operations
  },

  // Batch update multiple clips in a SINGLE set() call.
  // Use this instead of calling updateClip() in a loop to avoid N separate store
  // notifications (and N React re-renders) per frame during resize/ripple operations.
  batchUpdateClips: (updates) => {
    if (updates.length === 0) return;
    if (updates.length === 1) {
      // Single update: delegate to updateClip for full logic (duration recalc, text sync)
      get().updateClip(updates[0].clipId, updates[0].changes);
      return;
    }
    const pipIdsToRecalc = new Set<string>();
    
    set((state) => {
      const updateMap = new Map(updates.map(u => [u.clipId, u.changes]));

      // Propagate timing changes to linked clips that aren't already in the batch
      const timingKeys = ['startTime', 'trimStart', 'trimEnd', 'duration', 'speed', 'speedRamp'];
      const linkedUpdates = new Map<string, Record<string, any>>();
      for (const u of updates) {
        // Find the clip to check for linkedClipId
        for (const track of state.tracks) {
          const clip = track.clips.find(c => c.id === u.clipId);
          if (clip?.linkedClipId && !updateMap.has(clip.linkedClipId)) {
            const timingChanges: Record<string, any> = {};
            for (const key of timingKeys) {
              if ((u.changes as any)[key] !== undefined) {
                timingChanges[key] = (u.changes as any)[key];
              }
            }
            if (Object.keys(timingChanges).length > 0) {
              linkedUpdates.set(clip.linkedClipId, timingChanges);
            }
          }
          if (clip) break;
        }
      }

      const { tracks, pipWindows } = mapTracksDeep(state, (track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          const changes = updateMap.get(clip.id);
          if (changes) {
            if ((changes.duration !== undefined && changes.duration !== clip.duration) ||
                (changes.startTime !== undefined && changes.startTime !== clip.startTime)) {
              clip.pipWindowIds?.forEach(pid => pipIdsToRecalc.add(pid));
            }
            return { ...clip, ...changes };
          }
          // Apply linked timing propagation
          const linkedChanges = linkedUpdates.get(clip.id);
          if (linkedChanges) {
            return { ...clip, ...linkedChanges };
          }
          return clip;
        }),
      }));
      return { tracks, pipWindows };
    });
    get().recalcTotalDuration();
    pipIdsToRecalc.forEach(pid => get().recalcPipDurations(pid));
  },

  moveClip: (clipId, newStartTime, newTrackId, resolveOverlap = false) => {
    let success = false;
    set((state) => {
      // Locked Track Check
      const sourceTrack = state.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      if (sourceTrack && sourceTrack.locked) return {};
      const targetTrackId = newTrackId || (sourceTrack ? sourceTrack.id : null);
      const targetTrack = state.tracks.find((t) => t.id === targetTrackId);
      if (targetTrack && targetTrack.locked) return {};

      const newTracks: TimelineTrack[] = structuredClone(state.tracks);
      const newPipWindows: Record<string, PipWindow> = structuredClone(state.pipWindows || {});

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

      const finalTargetTrackId = newTrackId || foundClip.trackId;
      let finalTargetTrack = newTracks.find((t) => t.id === finalTargetTrackId);
      if (!finalTargetTrack) {
        for (const pip of Object.values(newPipWindows)) {
          finalTargetTrack = pip.tracks.find((t) => t.id === finalTargetTrackId);
          if (finalTargetTrack) break;
        }
      }
      if (finalTargetTrack) {
        // Enforce track type compatibility (ARCH-5)
        const media = state.mediaLibrary.find((m) => m.id === foundClip!.mediaId);
        const clipType = media ? media.type : (foundClip!.textSettings ? 'text' : (foundClip!.fxSettings ? 'fx' : (foundClip!.audioSettings !== undefined && !foundClip!.transform ? 'audio' : 'video')));
        if (finalTargetTrack.type === 'audio' && clipType !== 'audio') {
          return {}; // Reject move of visual clip to audio track
        }
        if (finalTargetTrack.type === 'video' && clipType !== 'video' && clipType !== 'image') {
          return {}; // Reject move of audio clip to video track
        }
        if (finalTargetTrack.type === 'text' && clipType !== 'text') {
          return {}; // Reject move of non-text clip to text track
        }
        if (finalTargetTrack.type === 'fx' && clipType !== 'fx') {
          return {}; // Reject move of non-fx clip to fx track
        }
        if (state.activeTool === 'ripple') {
          // Multi-track Ripple Move: Close old gap, then open space at newStartTime
          // Context-aware ripple move: only affect tracks in same container (main vs PIP)
          const isTargetPip = finalTargetTrackId.includes('_pip');
          const tracksToRipple = isTargetPip
            ? Object.values(newPipWindows).find((p) => p.tracks.some((t) => t.id === finalTargetTrackId))?.tracks || []
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
            finalTargetTrack.clips,
            newStartTime,
            foundClip.duration,
            clipId
          );
          foundClip.startTime = adjustedStart;
        } else {
          foundClip.startTime = Math.max(0, newStartTime);
        }
        
        // Clamp start time and duration if track is a PIP track with manual duration
        if (finalTargetTrackId.includes('_pip')) {
          const pip = Object.values(newPipWindows).find((p) => p.tracks.some((t) => t.id === finalTargetTrackId));
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

        foundClip.trackId = finalTargetTrackId;
        finalTargetTrack.clips.push(foundClip);
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
      // Locked Track Check
      for (const update of updates) {
        const sourceTrack = state.tracks.find((t) => t.clips.some((c) => c.id === update.clipId));
        if (sourceTrack && sourceTrack.locked) return {};
        const targetTrackId = update.newTrackId || (sourceTrack ? sourceTrack.id : null);
        const targetTrack = state.tracks.find((t) => t.id === targetTrackId);
        if (targetTrack && targetTrack.locked) return {};
      }

      const newTracks: TimelineTrack[] = structuredClone(state.tracks);
      const newPipWindows: Record<string, PipWindow> = structuredClone(state.pipWindows || {});

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

      const originalPositions = new Map<string, { startTime: number; trackId: string }>();
      for (const [id, clip] of movingClipsMap) {
        originalPositions.set(id, { startTime: clip.startTime, trackId: clip.trackId || '' });
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

      // Check if any clip actually moved
      let anyMoved = false;
      for (const update of updates) {
        const clip = movingClipsMap.get(update.clipId);
        if (!clip) continue;
        const oldPos = originalPositions.get(update.clipId);
        if (!oldPos || Math.abs(clip.startTime - oldPos.startTime) > 0.0001 || clip.trackId !== oldPos.trackId) {
          anyMoved = true;
          break;
        }
      }
      if (!anyMoved) return {};

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
      const newTracks: TimelineTrack[] = structuredClone(state.tracks);
      const newPipWindows: Record<string, PipWindow> = structuredClone(state.pipWindows || {});

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
            // R-12/R-13: Strip PIP/linked-clip references from cuts; reattach below.
            pipWindowIds: undefined,
            linkedClipId: undefined,
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

      // R-12/R-13: Re-attach any PIP whose parent was the original clip to the FIRST
      // resulting cut so the PIP window keeps working. Update the new parent clip's
      // pipWindowIds array to reflect this.
      const firstCutId = resultingClips[0]?.id;
      const orphanPipIds = targetClip.pipWindowIds || [];
      let nextPipWindows = pipWindows;
      if (firstCutId && orphanPipIds.length > 0) {
        nextPipWindows = { ...pipWindows };
        for (const pid of orphanPipIds) {
          const pip = nextPipWindows[pid];
          if (pip) {
            nextPipWindows = {
              ...nextPipWindows,
              [pid]: { ...pip, parentClipId: firstCutId }
            };
          }
        }
      }

      // Update the parent track clips so the first cut inherits pipWindowIds reference.
      const finalTracks = firstCutId && orphanPipIds.length > 0
        ? tracks.map((t) => {
            if (t.id !== targetTrack.id) return t;
            return {
              ...t,
              clips: t.clips.map((c) => {
                if (c.id !== firstCutId) return c;
                return { ...c, pipWindowIds: [...orphanPipIds] };
              })
            };
          })
        : tracks;

      return { tracks: finalTracks, pipWindows: nextPipWindows };
    });
    get().recalcTotalDuration();
    get().saveSnapshot('Auto Jump Cuts');
  },

  splitClip: (clipId, splitTime) => {
    set((state) => {
      const isSelected = state.selectedClipIds.includes(clipId);
      let primaryLeftId = '';

      // Find the primary clip to check for linked clip
      const primaryFound = findClipDeep(state, clipId);
      if (!primaryFound) return state;
      const primaryClip = primaryFound.clip;

      const idsToSplit = new Set([clipId]);
      if (primaryClip.linkedClipId) {
        idsToSplit.add(primaryClip.linkedClipId);
      }

      // Pre-generate left/right IDs for all clips being split so they can cross-link properly
      const splitMap: Record<string, { left: string; right: string }> = {};
      for (const id of idsToSplit) {
        // We reuse the original ID for the RIGHT half. Since the playhead is typically moving
        // forward into the right half during a split, this prevents useMediaPlayback from destroying
        // and recreating the active <audio>/<video> elements, entirely avoiding decoder lag!
        splitMap[id] = { left: generateId(), right: id };
      }
      
      if (isSelected) {
        primaryLeftId = splitMap[clipId].left;
      }

      const { tracks, pipWindows } = mapTracksDeep(state, (track) => {
        const newClips = [];
        let modified = false;

        for (const clip of track.clips) {
          if (!idsToSplit.has(clip.id)) {
            newClips.push(clip);
            continue;
          }

          const relativeSplitTime = splitTime - clip.startTime;
          if (relativeSplitTime <= 0 || relativeSplitTime >= clip.duration - 0.05) {
             // Split time is out of bounds for this clip, keep it intact
             newClips.push(clip);
             continue;
          }

          modified = true;
          const groupId = clip.splitGroupId || generateId();
          const leftId = splitMap[clip.id].left;
          const rightId = splitMap[clip.id].right;

          // All media math for the halves (trim values, boundary source
          // position, speed-ramp remap) lives in the pure helper — shared with
          // the unit tests so continuity/trimmed-ramp/reversed invariants are
          // verified on every test run.
          const splitHalves = computeSplitHalvesMedia(clip, splitTime, generateId);
          const leftSpeedRamp = splitHalves.leftSpeedRamp;
          const rightSpeedRamp = splitHalves.rightSpeedRamp;

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

          let newLinkedLeftId = clip.linkedClipId;
          let newLinkedRightId = clip.linkedClipId;
          if (clip.linkedClipId && splitMap[clip.linkedClipId]) {
            newLinkedLeftId = splitMap[clip.linkedClipId].left;
            newLinkedRightId = splitMap[clip.linkedClipId].right;
          }

          const leftClip: TimelineClip = {
            ...structuredClone(clip),
            id: leftId,
            splitGroupId: groupId,
            duration: relativeSplitTime,
            trimStart: splitHalves.leftTrimStart,
            trimEnd: splitHalves.leftTrimEnd,
            transitionOut: undefined, // Clear transition on the first half of the split
            speedRamp: leftSpeedRamp,
            animations: leftAnimations,
            linkedClipId: newLinkedLeftId
          };

          const rightClip: TimelineClip = {
            ...structuredClone(clip),
            id: rightId,
            splitGroupId: groupId,
            startTime: splitTime,
            duration: clip.duration - relativeSplitTime,
            trimStart: splitHalves.rightTrimStart,
            trimEnd: splitHalves.rightTrimEnd,
            transitionIn: undefined, // Clear transition on the second half of the split
            speedRamp: rightSpeedRamp,
            animations: rightAnimations,
            linkedClipId: newLinkedRightId
          };

          newClips.push(leftClip, rightClip);
        }

        if (!modified) return track;
        return { ...track, clips: newClips };
      });

      const newSelectedKeyframeLines = state.selectedKeyframeLines.filter(l => !idsToSplit.has(l.clipId));

      if (isSelected && primaryLeftId) {
        return {
          tracks,
          pipWindows,
          selectedClipId: primaryLeftId,
          selectedClipIds: [primaryLeftId],
          selectedKeyframeLines: newSelectedKeyframeLines,
        };
      }

      return { tracks, pipWindows, selectedKeyframeLines: newSelectedKeyframeLines };
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
  // NOTE: a transition can live on EITHER the incoming clip (`transitionIn`) or
  // the outgoing one (`transitionOut`) — drag-and-drop assigns whichever edge the
  // user dropped nearest. The original implementation only ever updated/removed
  // `transitionIn`, so editing or deleting a transition that had been dropped on a
  // clip's END silently did nothing. Both edges are now handled, and `params` are
  // merged rather than replaced so partial updates (e.g. only `softness`) don't
  // wipe out the other settings.
  updateTransition: (clipId, updates) => {
    set((state) => {
      const applyUpdate = (existing: Transition): Transition => ({
        ...existing,
        ...updates,
        params: { ...(existing.params || {}), ...((updates as any).params || {}) },
      });

      const patchClip = (clip: TimelineClip): TimelineClip => {
        if (clip.id !== clipId) return clip;
        if (clip.transitionIn) {
          return { ...clip, transitionIn: applyUpdate(clip.transitionIn) };
        }
        if (clip.transitionOut) {
          return { ...clip, transitionOut: applyUpdate(clip.transitionOut) };
        }
        return clip;
      };

      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map(patchClip),
      }));

      // Transitions can also exist on clips nested inside PiP windows.
      const newPipWindows = mapPipWindowClips(state.pipWindows, patchClip);

      return { tracks: newTracks, pipWindows: newPipWindows };
    });
    get().saveSnapshot('Update Transition');
  },
  removeTransition: (clipId) => {
    set((state) => {
      const stripClip = (clip: TimelineClip): TimelineClip =>
        clip.id === clipId
          ? { ...clip, transitionIn: undefined, transitionOut: undefined }
          : clip;

      const newTracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map(stripClip),
      }));

      return {
        tracks: newTracks,
        pipWindows: mapPipWindowClips(state.pipWindows, stripClip),
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
    const videoClip = findClipInTracks(tracks, clipId, get().pipWindows || {});
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
            tone: 0,
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
      const clip = findClipInTracks(state.tracks, clipId, state.pipWindows || {});
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
  // During playback the store's `currentTime` is a throttled (~10 Hz) mirror of the
  // playback clock, so it can trail the true playhead by up to ~100ms. Flush the
  // exact clock value on pause, otherwise the playhead visibly snaps backwards the
  // moment playback stops and the media elements re-seek to that stale position.
  pause: () => set({ isPlaying: false, playbackDirection: 0, currentTime: getPlaybackTime() }),
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
    set((state) => {
      const nextPlaying = !state.isPlaying;
      return {
        isPlaying: nextPlaying,
        playbackDirection: nextPlaying ? 1 : 0,
        // Pausing: adopt the exact clock position (see `pause` above for why).
        ...(nextPlaying ? {} : { currentTime: getPlaybackTime() }),
      };
    });
  },
  seek: (time) => {
    const clamped = Math.max(0, time);
    // Keep the React-free playback clock in front of the store at all times so
    // the media-sync loop and canvas renderer never read a stale playhead.
    setPlaybackTime(clamped);
    const st = get();
    if (st.isScrubbing) {
      // During scrubbing, only update the store if the value changed by more
      // than half a frame (~120 fps threshold). This prevents 60 Hz re-render
      // storms while keeping the playhead visually accurate.
      if (Math.abs(st.currentTime - clamped) > 0.008) {
        set({ currentTime: clamped });
      }
    } else {
      set({ currentTime: clamped });
    }
  },
  setIsScrubbing: (scrubbing) => set({ isScrubbing: scrubbing }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setPerfDowngraded: (downgraded) => set({ perfDowngraded: downgraded }),
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
  setShowScopes: (show) => set((state) => ({ showScopes: show, scopeSettings: { ...state.scopeSettings, enabled: show } })),
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
          { k: 'mask.x', v: values.mask?.x },
          { k: 'mask.y', v: values.mask?.y },
          { k: 'mask.width', v: values.mask?.width },
          { k: 'mask.height', v: values.mask?.height },
          { k: 'mask.rotation', v: values.mask?.rotation },
          { k: 'mask.feather', v: values.mask?.feather },
          { k: 'mask.roundness', v: values.mask?.roundness },
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

      return mapTracksDeep(state, (t) => ({
        ...t,
        clips: t.clips.map(updateClipKeyframes),
      }));
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
              } else if (parts[0] === 'mask') {
                updatedClip = {
                  ...updatedClip,
                  mask: { ...(updatedClip.mask || {}), [parts[1]]: kfToDelete.value } as any
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

      return mapTracksDeep(state, (t) => ({
        ...t,
        clips: t.clips.map(deleteClipKeyframe),
      }));
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

      return mapTracksDeep(state, (t) => ({
        ...t,
        clips: t.clips.map(moveClipKeyframe),
      }));
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

      return mapTracksDeep(state, (t) => ({
        ...t,
        clips: t.clips.map(breakClipKeyframe),
      }));
    });
    get().saveSnapshot('Break Keyframe Link');
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
      const mapped = mapTracksDeep(state, (t) => ({
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
      return { ...mapped, selectedKeyframeLines: [] };
    });
    get().saveSnapshot('Remove Keyframes');
  },

  updateSettings: (newSettings) => {
    if (newSettings.theme) {
      try {
        localStorage.setItem('procut_theme', newSettings.theme);
        if (newSettings.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (_) {}
    }
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    }));
  },

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

    if (actualPasteType === 'style' || actualPasteType === 'style-only' || actualPasteType === 'style-with-position') {
      // Paste Style: Apply properties of the first copied clip to all currently selected clips
      const sourceStyle = clipData.clips[0] as any;
      const targetIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
      if (targetIds.length === 0) return;
      
      targetIds.forEach(id => {
        const found = findClipDeep(get(), id);
        const targetClip = found?.clip;

        let mergedTextSettings = undefined;
        if (sourceStyle.textSettings) {
          mergedTextSettings = {
            ...sourceStyle.textSettings,
            ...(targetClip?.textSettings?.text !== undefined ? { text: targetClip.textSettings.text } : {})
          };
        }

        const updates: any = {
          opacity: sourceStyle.opacity,
          effects: Array.isArray(sourceStyle.effects) ? [...sourceStyle.effects] : undefined,
          colorFilters: sourceStyle.colorFilters ? { ...sourceStyle.colorFilters } : undefined,
          textSettings: mergedTextSettings,
          fxSettings: sourceStyle.fxSettings ? { ...sourceStyle.fxSettings } : undefined,
          audioSettings: sourceStyle.audioSettings ? { ...sourceStyle.audioSettings } : undefined,
          mask: sourceStyle.mask ? { ...sourceStyle.mask } : undefined,
        };
        
        // Only include transform if pasting style with position
        if (actualPasteType === 'style-with-position') {
          updates.transform = { ...sourceStyle.transform };
        }
        
        // Remove undefined keys
        Object.keys(updates).forEach(key => {
          if (updates[key] === undefined) delete updates[key];
        });
        
        get().updateClip(id, updates);
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
      const foundParent = findClipDeep(get(), activePip.parentClipId ?? activePip.clipId ?? '');
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
        tracks: structuredClone(state.tracks),
        currentTime: state.currentTime,
        pipWindows: structuredClone(state.pipWindows || {}),
        subtitles: structuredClone(state.subtitles || []),
        markers: structuredClone(state.markers || []),
        beatMarkers: structuredClone(state.beatMarkers || []),
        label: label || defaultLabel,
      };

      // Check if anything actually changed (ignoring currentTime and label)
      // Single stringify comparison instead of 10 separate calls
      if (state.historyIndex >= 0 && state.history[state.historyIndex]) {
        const lastSnap = state.history[state.historyIndex];
        const lastKey = JSON.stringify([lastSnap.tracks, lastSnap.pipWindows, lastSnap.subtitles, lastSnap.markers, lastSnap.beatMarkers]);
        const newKey = JSON.stringify([snapshot.tracks, snapshot.pipWindows, snapshot.subtitles, snapshot.markers, snapshot.beatMarkers]);
        if (lastKey === newKey) {
          // Nothing meaningful changed, don't create history entry
          return {};
        }
      }

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      const trimmedHistory = newHistory.slice(-50);
      return {
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
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
        tracks: structuredClone(snap.tracks),
        currentTime: snap.currentTime,
        pipWindows: structuredClone(snap.pipWindows || {}),
        subtitles: structuredClone(snap.subtitles || []),
        markers: structuredClone(snap.markers || []),
        beatMarkers: structuredClone(snap.beatMarkers || []),
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
        tracks: structuredClone(snap.tracks),
        currentTime: snap.currentTime,
        pipWindows: structuredClone(snap.pipWindows || {}),
        subtitles: structuredClone(snap.subtitles || []),
        markers: structuredClone(snap.markers || []),
        beatMarkers: structuredClone(snap.beatMarkers || []),
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
        tracks: structuredClone(snap.tracks),
        currentTime: snap.currentTime,
        pipWindows: structuredClone(snap.pipWindows || {}),
        subtitles: structuredClone(snap.subtitles || []),
        markers: structuredClone(snap.markers || []),
        beatMarkers: structuredClone(snap.beatMarkers || []),
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
  setProjectFileHandle: (handle: any) => set({ projectFileHandle: handle }),
  resetProject: async (clearDB = false) => {
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
      saveTimeoutId = null;
    }

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

    // Clear decoded bitmap pool (~64 MB cap) and windowed blob cache
    // that would otherwise leak across project boundaries
    clearImageBitmapPool();
    clearAllMediaWindows();
    clearFrameCache();

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
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
      saveTimeoutId = null;
    }

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
      // Older projects baked the PiP container transform into word positions;
      // the renderer now applies it itself, so strip the baked copy once.
      try { get().normalizeKineticBakedTransforms(); } catch (e) { console.warn('Kinetic normalise skipped:', e); }
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
    
    for (const item of template.mediaLibrary ?? []) {
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

  setAspectRatioConflictData: (data) => set({ aspectRatioConflictData: data }),

  resolveAspectRatioConflict: (applyNewRatio, dontAskAgain = false) => {
    const data = get().aspectRatioConflictData;
    if (applyNewRatio && data) {
      get().reframeProject(data.detectedRatio);
    }
    if (dontAskAgain) {
      set((state) => ({
        settings: { ...state.settings, autoPromptAspectRatio: false },
        aspectRatioConflictData: null,
      }));
    } else {
      set({ aspectRatioConflictData: null });
    }
  },


  // Recalculate total duration from all clips and clean up empty custom tracks
  recalcTotalDuration: () => {
    const { tracks, pipWindows, totalDuration } = get();

    // FIX: Only rebuild tracks array if something actually changed (removing empty dynamic tracks)
    const cleanedTracks = tracks.filter(
      (t) => !t.isDynamic || t.clips.length > 0
    );
    // filter() always returns a new array, so use length comparison for the semantic check.
    // When no dynamic tracks were removed, pass the original `tracks` ref to avoid
    // breaking every useShallow subscriber and React.memo downstream.
    const tracksChanged = cleanedTracks.length !== tracks.length;
    const finalTracks = tracksChanged ? cleanedTracks : tracks;

    let maxEnd = 0;
    for (const track of finalTracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    const newTotalDuration = maxEnd || 0.1;

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
          ? Math.max(pip.manualDuration, maxClipEnd)
          : Math.min(600, Math.max(5, maxClipEnd + 3));
        if (pip.duration !== targetDuration) {
          updatedPipWindows[id] = { ...pip, duration: targetDuration };
          pipChanged = true;
        }
      }
    }

    // FIX: Only call set() if something actually changed — avoids broadcast storm during drag
    if (!tracksChanged && Math.abs(newTotalDuration - totalDuration) < 0.001 && !pipChanged) {
      return; // No-op: nothing changed
    }

    // Set totalDuration with a minimum floor of 0.1 to avoid unusable slider empty state
    set({
      tracks: finalTracks,
      totalDuration: newTotalDuration,
      ...(pipChanged ? { pipWindows: updatedPipWindows } : {})
    });
  },

  recalcPipDurations: (pipId: string) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return state;
      
      const parentClip = findClipInTracks(state.tracks, pip.parentClipId, state.pipWindows || {});
      let targetDuration = pip.duration;
      
      if (parentClip) {
        // Bound the PIP duration to the parent clip's duration if parent shrinks
        const maxAllowed = parentClip.duration - (pip.relativeStartTime || 0);
        
        let maxClipEnd = 0;
        for (const track of pip.tracks) {
          for (const clip of track.clips) {
            const end = clip.startTime + clip.duration;
            if (end > maxClipEnd) maxClipEnd = end;
          }
        }
        
        // C-3: Avoid magic "+3" padding. Use a tiny 0.1s breathing room when auto-deriving,
        // and never auto-shrink below the previous duration when manualDuration is unset.
        const computed = pip.manualDuration 
          ? Math.max(pip.manualDuration, maxClipEnd)
          : Math.min(600, Math.max(5, Math.max(maxClipEnd + 0.1, pip.duration)));
          
        targetDuration = Math.min(computed, Math.max(0.5, maxAllowed));
      }
      
      if (pip.duration === targetDuration) return state;
      
      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: { ...pip, duration: targetDuration }
        }
      };
    });
  },

  // PIP Window Operations
  createPipWindow: (clipId, relativeStartTime) => {
    const id = generateId();
    
    set((state) => {
      const clip = findClipInTracks(state.tracks, clipId, state.pipWindows || {});
      if (!clip) return {};
      
      const newPip: PipWindow = {
        id,
        parentClipId: clipId,
        relativeStartTime,
        tracks: [],
        duration: 5,
        zIndex: Object.keys(state.pipWindows || {}).length + 1,
      };
      
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

      // C-4: Locate the parent clip in main tracks OR nested PIP tracks (deep search).
      const parentFound = findClipDeep(state, pip.parentClipId || '');

      const newTracks = state.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => 
          c.id === pip.parentClipId 
            ? { ...c, pipWindowIds: (c.pipWindowIds || []).filter(id => id !== pipId) } 
            : c
        )
      }));

      // C-4: Also clean up pipWindowIds if the parent lives inside another PIP track.
      let newPipWindowsAfter = newPipWindows;
      if (parentFound && parentFound.isPip) {
        const parentPipId = parentFound.pipId!;
        const parentPip = newPipWindows[parentPipId];
        if (parentPip) {
          newPipWindowsAfter = {
            ...newPipWindows,
            [parentPipId]: {
              ...parentPip,
              tracks: parentPip.tracks.map(t => ({
                ...t,
                clips: t.clips.map(c => 
                  c.id === pip.parentClipId 
                    ? { ...c, pipWindowIds: (c.pipWindowIds || []).filter(id => id !== pipId) } 
                    : c
                )
              }))
            }
          };
        }
      }
      // Reference `parentFound` so the value is reachable; suppresses linter complaints
      // and makes intent clear if a future change wants to use it.
      void parentFound;

      const deletedClipIds = pip.tracks.flatMap(t => t.clips || []).map(c => c.id);
      const newSelectedClipIds = state.selectedClipIds.filter(id => !deletedClipIds.includes(id));
      const newSelectedClipId = newSelectedClipIds.includes(state.selectedClipId || '') 
        ? state.selectedClipId 
        : (newSelectedClipIds[0] || null);

      return {
        pipWindows: newPipWindowsAfter,
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
  },

  updatePipWindowDuration: (pipId: string, duration: number) => {
    set((state) => {
      const pip = state.pipWindows[pipId];
      if (!pip) return {};
      return {
        pipWindows: {
          ...state.pipWindows,
          [pipId]: { ...pip, duration: Math.max(0.5, duration), manualDuration: Math.max(0.5, duration) }
        }
      };
    });
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

        // C-2: Clamp lastEnd into PIP bounds so append-after-existing never escapes
        const pipMaxDur = pip.manualDuration ?? pip.duration;
        lastEnd = Math.max(0, Math.min(lastEnd, pipMaxDur - 0.05));

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
        
        // C-2: Clamp startTime into PIP bounds [0, pipMaxDur - duration]
        const pipMaxDur = pip.manualDuration ?? pip.duration;
        let clampedStartTime = Math.max(0, Math.min(startTime, pipMaxDur - 0.05));
        
        let targetDuration = duration;
        if (pip.manualDuration) {
          const maxDur = pip.duration - clampedStartTime;
          if (maxDur <= 0.05) return {};
          targetDuration = Math.min(duration, maxDur);
        }

        const newClip: TimelineClip = {
          id: generateId(),
          trackId,
          mediaId,
          startTime: clampedStartTime,
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
    get().recalcPipDurations(pipId);
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
  autoSyncTrackToBeats: (trackId, audioClipId, everyNBeats, transitionType) => {
    set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (!track) return {};

      // Find the audio clip
      let audioClip: any = null;
      for (const t of state.tracks) {
        const found = t.clips.find((c) => c.id === audioClipId || c.mediaId === audioClipId);
        if (found) {
          audioClip = found;
          break;
        }
      }
      if (!audioClip) return {};

      // Get beat markers for this audio clip
      const markers = state.beatMarkers
        .filter((bm) => bm.clipId === audioClip.mediaId || bm.clipId === audioClip.id)
        .map((bm) => audioClip.startTime + bm.time - (audioClip.trimStart || 0))
        .filter((t) => t >= audioClip.startTime && t <= audioClip.startTime + audioClip.duration)
        .sort((a, b) => a - b);

      if (markers.length === 0) return {};

      // Sort track clips by startTime
      const clips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      if (clips.length === 0) return {};

      const step = everyNBeats || 4;
      const updatedClips = clips.map((clip, idx) => {
        const startBeatIdx = idx * step;
        const endBeatIdx = (idx + 1) * step;

        const clampedStartIdx = Math.min(startBeatIdx, markers.length - 1);
        const clampedEndIdx = Math.min(endBeatIdx, markers.length - 1);

        let newStart = markers[clampedStartIdx];
        let newEnd = markers[clampedEndIdx];

        if (newStart === newEnd) {
          newStart = idx > 0 ? clips[idx - 1].startTime + clips[idx - 1].duration : clip.startTime;
          newEnd = newStart + 2.0;
        }

        const newDuration = Math.max(0.1, newEnd - newStart);
        const trimStart = clip.trimStart || 0;

        let transitionIn = clip.transitionIn;
        if (transitionType && idx > 0) {
          transitionIn = {
            id: Math.random().toString(36).substr(2, 9),
            name: transitionType.charAt(0).toUpperCase() + transitionType.slice(1),
            type: transitionType as any,
            duration: 0.5,
            params: {}
          };
        }

        return {
          ...clip,
          startTime: newStart,
          duration: newDuration,
          trimStart,
          transitionIn
        };
      });

      const updatedTracks = state.tracks.map((t) => {
        if (t.id === trackId) {
          return { ...t, clips: updatedClips };
        }
        return t;
      });

      return {
        tracks: updatedTracks,
        hasUnsavedChanges: true
      };
    });
    get().saveSnapshot('Auto Beat Sync');
  },

  // Layout Presets
  setWorkspaceLayout: (layout) => {
    set({ workspaceLayout: layout });
  },

  // Compound Clips
  enterCompoundClip: (clipId) => {
    const { tracks, timelineStack, mediaLibrary, pipWindows } = get();
    const clip = findClipDeep(get(), clipId)?.clip;
    
    if (!clip || !clip.mediaId) return;
    
    const media = mediaLibrary.find(m => m.id === clip.mediaId);
    if (!media || media.type !== 'compound') return;

    set({
      timelineStack: [...timelineStack, { tracks: JSON.parse(JSON.stringify(tracks)), label: `Compound: ${media.name ?? clipId}`, compoundMediaId: media.id, activePipWindowId: get().activePipWindowId }],
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
    updateMediaMetadata(currentStackItem.compoundMediaId!, {
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
  },

  copyColorGrade: (clipId: string) => {
    const state = get();
    let clip: any = null;
    for (const track of state.tracks) {
      clip = track.clips.find(c => c.id === clipId);
      if (clip) break;
    }
    if (!clip && state.pipWindows) {
      for (const pipId in state.pipWindows) {
        for (const track of state.pipWindows[pipId].tracks) {
          clip = track.clips.find(c => c.id === clipId);
          if (clip) break;
        }
        if (clip) break;
      }
    }
    if (!clip) return;
    set({
      colorClipboard: {
        colorFilters: clip.colorFilters ? JSON.parse(JSON.stringify(clip.colorFilters)) : undefined,
        lutFilter: clip.lutFilter ? JSON.parse(JSON.stringify(clip.lutFilter)) : undefined,
      }
    });
  },

  pasteColorGrade: (clipId: string) => {
    const state = get();
    const clipboard = state.colorClipboard;
    if (!clipboard) return;

    set((s) => ({
      tracks: mapTracksDeep(s, (track, pipId) => {
        return {
          ...track,
          clips: track.clips.map(c => {
            if (c.id === clipId) {
              return {
                ...c,
                colorFilters: clipboard.colorFilters ? JSON.parse(JSON.stringify(clipboard.colorFilters)) : c.colorFilters,
                lutFilter: clipboard.lutFilter ? JSON.parse(JSON.stringify(clipboard.lutFilter)) : c.lutFilter,
              };
            }
            return c;
          })
        };
      }).tracks,
      pipWindows: mapTracksDeep(s, (track, pipId) => track).pipWindows
    }));
    get().saveSnapshot('Paste Color Grade');
  },

  applyColorGradeToAll: (sourceClipId: string) => {
    const state = get();
    let sourceClip: any = null;
    for (const track of state.tracks) {
      sourceClip = track.clips.find(c => c.id === sourceClipId);
      if (sourceClip) break;
    }
    if (!sourceClip && state.pipWindows) {
      for (const pipId in state.pipWindows) {
        for (const track of state.pipWindows[pipId].tracks) {
          sourceClip = track.clips.find(c => c.id === sourceClipId);
          if (sourceClip) break;
        }
        if (sourceClip) break;
      }
    }
    if (!sourceClip) return;
    
    const colorFilters = sourceClip.colorFilters ? JSON.parse(JSON.stringify(sourceClip.colorFilters)) : undefined;
    const lutFilter = sourceClip.lutFilter ? JSON.parse(JSON.stringify(sourceClip.lutFilter)) : undefined;

    set((s) => ({
      tracks: mapTracksDeep(s, (track, pipId) => {
        return {
          ...track,
          clips: track.clips.map(c => {
            // Only apply to video/image clips, skipping audio/text
            const media = s.mediaLibrary.find(m => m.id === c.mediaId);
            const isVisual = media && (media.type === 'video' || media.type === 'image' || media.type === 'compound');
            if (isVisual) {
              return {
                ...c,
                colorFilters: colorFilters ? JSON.parse(JSON.stringify(colorFilters)) : c.colorFilters,
                lutFilter: lutFilter ? JSON.parse(JSON.stringify(lutFilter)) : c.lutFilter,
              };
            }
            return c;
          })
        };
      }).tracks,
      pipWindows: mapTracksDeep(s, (track, pipId) => track).pipWindows
    }));
    get().saveSnapshot('Apply Color Grade to All');
  },

  addAdjustmentLayer: (duration = 5) => {
    const { tracks, currentTime } = get();
    let targetTrack = tracks.find((t) => t.type === 'adjustment' || t.type === 'video');
    if (!targetTrack) {
      get().addTrack('adjustment');
      targetTrack = get().tracks.find((t) => t.type === 'adjustment');
    }
    if (!targetTrack) return;

    const mediaId = `adj_${generateId()}`;
    const clipId = generateId();

    get().addMedia({
      id: mediaId,
      name: 'Adjustment Layer',
      type: 'adjustment',
      duration,
      url: '',
      createdAt: Date.now(),
    });

    const newClip: TimelineClip = {
      id: clipId,
      mediaId,
      trackId: targetTrack.id,
      startTime: currentTime,
      duration,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
      effects: [],
      isAdjustmentLayer: true,
    };

    get().addClip(newClip);
    get().saveSnapshot('Add Adjustment Layer');
  }
}));

// Safety net: `currentTime` is also written directly by snapshot restore, project
// load, undo/redo and a few other paths that do not go through `seek()`. Mirror
// those writes into the playback clock so the render/sync path can never read a
// stale playhead.
//
// IMPORTANT: we must only react to an ACTUAL change of `currentTime`, never to the
// store's current value. During playback the clock intentionally runs ahead of the
// store (the store is a throttled ~10Hz mirror), so blindly pushing
// `state.currentTime` on every store notification — including notifications caused
// by completely unrelated mutations such as selecting a clip — would drag the
// playhead backwards several times a second and reintroduce the very stutter this
// clock exists to remove. Tracking the last observed value means we only push when
// something genuinely reassigned the time.
let _lastObservedStoreTime = useEditorStore.getState().currentTime;
useEditorStore.subscribe((state) => {
  const t = state.currentTime;
  if (t === _lastObservedStoreTime) return;
  _lastObservedStoreTime = t;
  setPlaybackTime(t);
});

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
