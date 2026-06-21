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

// Demo media items
const DEMO_MEDIA: MediaItem[] = [
  {
    id: 'demo-video-1',
    name: 'Beach Sunrise.mp4',
    type: 'video',
    duration: 15,
    url: '',
    size: 24580000,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'demo-video-2',
    name: 'City Drone.mp4',
    type: 'video',
    duration: 12,
    url: '',
    size: 18920000,
    createdAt: Date.now() - 72000000,
  },
  {
    id: 'demo-video-3',
    name: 'Forest Walk.mp4',
    type: 'video',
    duration: 20,
    url: '',
    size: 32100000,
    createdAt: Date.now() - 60000000,
  },
  {
    id: 'demo-audio-1',
    name: 'Ambient Music.mp3',
    type: 'audio',
    duration: 45,
    url: '',
    size: 5400000,
    createdAt: Date.now() - 90000000,
  },
  {
    id: 'demo-audio-2',
    name: 'Voiceover.mp3',
    type: 'audio',
    duration: 18,
    url: '',
    size: 2100000,
    createdAt: Date.now() - 48000000,
  },
  {
    id: 'demo-image-1',
    name: 'Title Card.png',
    type: 'image',
    duration: 5,
    url: '',
    size: 1200000,
    createdAt: Date.now() - 36000000,
  },
  {
    id: 'demo-image-2',
    name: 'Logo.png',
    type: 'image',
    duration: 3,
    url: '',
    size: 450000,
    createdAt: Date.now() - 24000000,
  },
];

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
    id: 'v3',
    name: 'V3',
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

// Create demo clips
const createDemoClips = (): { tracks: TimelineTrack[]; totalDuration: number } => {
  const tracks = createEmptyTracks();
  
  // Add clips to V1
  tracks[0].clips = [
    {
      id: generateId(),
      mediaId: 'demo-video-1',
      trackId: 'v1',
      startTime: 0,
      duration: 8,
      trimStart: 0,
      trimEnd: 7,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
    },
    {
      id: generateId(),
      mediaId: 'demo-video-2',
      trackId: 'v1',
      startTime: 8,
      duration: 6,
      trimStart: 0,
      trimEnd: 6,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
    },
  ];

  // Add image clip to V2
  tracks[1].clips = [
    {
      id: generateId(),
      mediaId: 'demo-image-1',
      trackId: 'v2',
      startTime: 3,
      duration: 5,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 80, rotation: 0 },
      opacity: 0.85,
      speed: 1,
    },
  ];

  // Add audio clips to A1
  tracks[3].clips = [
    {
      id: generateId(),
      mediaId: 'demo-audio-1',
      trackId: 'a1',
      startTime: 0,
      duration: 20,
      trimStart: 0,
      trimEnd: 25,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
    },
  ];

  // Add audio clips to A2
  tracks[4].clips = [
    {
      id: generateId(),
      mediaId: 'demo-audio-2',
      trackId: 'a2',
      startTime: 10,
      duration: 8,
      trimStart: 0,
      trimEnd: 10,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
    },
  ];

  const totalDuration = 25;

  return { tracks, totalDuration };
};

interface EditorActions {
  // Media Library
  addMedia: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
  
  // Timeline Operations
  addClip: (clip: TimelineClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
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
  
  // Demo
  loadDemoProject: () => void;
  resetProject: () => void;
}

const initialState: EditorState = {
  mediaLibrary: DEMO_MEDIA,
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
    set((state) => ({
      mediaLibrary: state.mediaLibrary.filter((m) => m.id !== id),
    }));
    get().saveSnapshot();
  },

  // Timeline Operations
  addClip: (clip) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => {
        if (track.id === clip.trackId) {
          return { ...track, clips: [...track.clips, clip] };
        }
        return track;
      });
      return { tracks: newTracks, selectedClipId: clip.id };
    });
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
    set((state) => {
      let foundClip: TimelineClip | undefined;
      for (const track of state.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          foundClip = { ...clip, startTime: newStartTime };
          if (newTrackId) foundClip.trackId = newTrackId;
          break;
        }
      }
      if (!foundClip) return {};
      
      const sourceTracks = state.tracks.map((track) => {
        if (track.clips.some((c) => c.id === clipId)) {
          return { ...track, clips: track.clips.filter((c) => c.id !== clipId) };
        }
        return track;
      });
      
      const targetTrackId = newTrackId || foundClip.trackId;
      const finalTracks = sourceTracks.map((track) => {
        if (track.id === targetTrackId) {
          return { ...track, clips: [...track.clips, foundClip as TimelineClip] };
        }
        return track;
      });
      
      return { tracks: finalTracks };
    });
    get().saveSnapshot();
  },
  splitClip: (clipId, splitTime) => {
    set((state) => {
      const newTracks = state.tracks.map((track) => {
        const clipIndex = track.clips.findIndex((c) => c.id === clipId);
        if (clipIndex === -1) return track;
        
        const clip = track.clips[clipIndex];
        const relativeSplitTime = splitTime - clip.startTime;
        
        if (relativeSplitTime <= 0 || relativeSplitTime >= clip.duration) return track;
        
        const leftClip: TimelineClip = {
          ...clip,
          id: generateId(),
          duration: relativeSplitTime,
          trimEnd: clip.trimEnd + (clip.duration - relativeSplitTime),
        };
        
        const rightClip: TimelineClip = {
          ...clip,
          id: generateId(),
          startTime: splitTime,
          duration: clip.duration - relativeSplitTime,
          trimStart: clip.trimStart + relativeSplitTime,
        };
        
        const newClips = [...track.clips];
        newClips.splice(clipIndex, 1, leftClip, rightClip);
        
        return { ...track, clips: newClips };
      });
      return { tracks: newTracks };
    });
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
  zoomIn: () => set((state) => ({ zoomLevel: Math.min(state.zoomLevel + 20, 300) })),
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
        set({ clipboardClip: { ...clip, id: generateId() } });
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

  // Demo
  loadDemoProject: () => {
    const { tracks, totalDuration } = createDemoClips();
    set({ tracks, totalDuration, currentTime: 0, selectedClipId: null });
  },
  resetProject: () => {
    set({
      tracks: createEmptyTracks(),
      currentTime: 0,
      isPlaying: false,
      selectedClipId: null,
      totalDuration: 30,
    });
  },
}));
