// Media Types
export type MediaType = 'video' | 'audio' | 'image';

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  duration: number; // in seconds
  url: string;      // object URL for the file blob
  size?: number;
  createdAt: number;
  // Real metadata from probing
  thumbnail?: string;       // object URL for a thumbnail frame (video/image)
  waveformPeaks?: number[]; // normalized audio peaks [0..1]
  frameRate?: number;       // detected or default fps (30)
  width?: number;           // video/image width
  height?: number;          // video/image height
  // Frame strip for timeline rendering
  frameStrip?: string[];    // array of data URLs for frame thumbnails
}

// Transform for clips
export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

// Waveform data for timeline visualization
export interface WaveformData {
  peaks: number[];
  length: number;
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
  // Effects
  effects: string[];
  // For drag preview
  isPreview?: boolean;
  // Kinship tracking for split clips
  splitGroupId?: string;
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
  selectedClipIds: string[];
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
  activeTool: 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward';

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

  // Drag/Drop state
  draggingClipId: string | null;
  dragPreviewTime: number;
  dragPreviewTrackId: string | null;
}

export interface EditorSnapshot {
  tracks: TimelineTrack[];
  currentTime: number;
}

// Tool Types
export type EditorTool = 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward';

// Media Tab Types
export type MediaTab = 'project' | 'transitions' | 'audio' | 'effects';

// Properties Tab Types
export type PropertiesTab = 'transform' | 'color' | 'speed' | 'audio';

// Time formatting utility type
export type TimeFormat = 'HH:MM:SS' | 'MM:SS' | 'frames';

// Transition definitions
export interface Transition {
  id: string;
  name: string;
  type: 'dissolve' | 'wipe' | 'zoom' | 'slide' | 'custom';
  duration: number;
  params: Record<string, unknown>;
}

// Effect definitions
export interface Effect {
  id: string;
  name: string;
  type: 'color' | 'filter' | 'transform' | 'audio';
  params: Record<string, unknown>;
}
