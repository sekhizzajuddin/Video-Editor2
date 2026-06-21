// Media Types
export type MediaType = 'video' | 'audio' | 'image';

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  duration: number; // in seconds
  url: string;
  size?: number;
  createdAt: number;
}

// Transform for clips
export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

// Timeline Clip
export interface TimelineClip {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number;    // position on timeline
  duration: number;     // visible duration on timeline
  trimStart: number;    // seconds trimmed from beginning of source
  trimEnd: number;      // seconds trimmed from end of source
  transform: ClipTransform;
  opacity: number;      // 0-1
  speed: number;        // playback speed multiplier
}

// Timeline Track
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio';
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
  hidden: boolean;
}

// Editor State
export interface EditorState {
  // Media Library
  mediaLibrary: MediaItem[];
  
  // Timeline
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  selectedTrackId: string | null;
  
  // Playback
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  playbackSpeed: number;
  isMuted: boolean;
  volume: number;
  
  // Timeline Zoom & Scroll
  zoomLevel: number;     // pixels per second
  scrollLeft: number;
  
  // Tools
  activeTool: 'select' | 'split' | 'hand' | 'zoom';
  
  // UI State
  showExportModal: boolean;
  showSettingsModal: boolean;
  activeMediaTab: 'project' | 'transitions' | 'audio' | 'effects';
  activePropertiesTab: 'transform' | 'color' | 'speed' | 'audio';
  
  // Clipboard
  clipboardClip: TimelineClip | null;
  
  // History for undo/redo
  history: EditorSnapshot[];
  historyIndex: number;
}

export interface EditorSnapshot {
  tracks: TimelineTrack[];
  currentTime: number;
}

// Tool Types
export type EditorTool = 'select' | 'split' | 'hand' | 'zoom';

// Media Tab Types
export type MediaTab = 'project' | 'transitions' | 'audio' | 'effects';

// Properties Tab Types
export type PropertiesTab = 'transform' | 'color' | 'speed' | 'audio';

// Time formatting utility type
export type TimeFormat = 'HH:MM:SS' | 'MM:SS' | 'frames';
