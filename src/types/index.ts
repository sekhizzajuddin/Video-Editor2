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

// Crop bounds for clips (percentages 0-100)
export interface ClipCrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Waveform data for timeline visualization
export interface WaveformData {
  peaks: number[];
  length: number;
}

export interface ClipColorFilters {
  temperature: number;   // -100 to 100 (Cool to Warm)
  tint: number;          // -100 to 100 (Green to Magenta)
  exposure: number;      // -100 to 100 (Darker to Brighter)
  contrast: number;      // 0 to 200 (Default 100)
  saturation: number;    // 0 to 200 (Default 100)
  blur: number;          // 0 to 20 (Default 0)
  fadedFilm: number;     // 0 to 100 (Default 0)
  vignette: number;      // -100 to 100 (White to Black border)
}

export interface ClipAudioSettings {
  volume: number;       // -40 to 12 dB (default 0 dB)
  pan: number;          // -100 to 100 (default 0, center)
  fadeIn: number;       // 0 to 5 seconds (default 0)
  fadeOut: number;      // 0 to 5 seconds (default 0)
  bass: number;         // -15 to 15 dB (default 0)
  treble: number;       // -15 to 15 dB (default 0)
  muted: boolean;       // individual clip mute (default false)
  preservePitch: boolean; // maintain pitch when speed changes (default true)
  pitch: number;        // -12 to 12 semitones (default 0)
  voiceFormant: number; // -100 to 100 (default 0)
  humanize: boolean;    // one-click AI humanizer toggle (default false)
}

export interface SpeedRampKeyframe {
  position: number; // 0 to 1 (normalized within clip duration)
  speed: number;    // 0.1 to 4.0
}

export interface PropertyKeyframe {
  time: number;
  value: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  holdNext?: boolean;
}

export interface ClipAnimations {
  [key: string]: PropertyKeyframe[] | undefined;
  opacity?: PropertyKeyframe[];
  'transform.x'?: PropertyKeyframe[];
  'transform.y'?: PropertyKeyframe[];
  'transform.scale'?: PropertyKeyframe[];
  'transform.rotation'?: PropertyKeyframe[];
  'crop.top'?: PropertyKeyframe[];
  'crop.bottom'?: PropertyKeyframe[];
  'crop.left'?: PropertyKeyframe[];
  'crop.right'?: PropertyKeyframe[];
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
  crop?: ClipCrop;      // crop bounding box in percentages (0-100)
  opacity: number;      // 0-1
  speed: number;        // playback speed multiplier
  speedRamp?: SpeedRampKeyframe[]; // speed ramp keyframes (overrides flat speed)
  animations?: ClipAnimations; // timeline keyframes for properties
  // Effects
  effects: string[];
  // For drag preview
  isPreview?: boolean;
  // Kinship tracking for split clips
  splitGroupId?: string;
  // Transition at the beginning of the clip (blending previous clip into this one)
  transitionIn?: Transition;
  // Premiere Pro-style color grading filters
  colorFilters?: ClipColorFilters;
  // Premiere Pro-style advanced audio configurations
  audioSettings?: ClipAudioSettings;
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
  isDynamic?: boolean;
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
  activeTool: 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward' | 'rateStretch';

  // UI State
  showExportModal: boolean;
  showSettingsModal: boolean;
  activeMediaTab: 'project' | 'transitions' | 'audio' | 'effects';
  activePropertiesTab: 'transform' | 'color' | 'speed' | 'audio';

  // Canvas Mode
  canvasTransformMode: 'resize' | 'crop';
  previewCanvas: HTMLCanvasElement | null;
  masterAudioStream: MediaStream | null;

  // Clipboard
  clipboardClip: TimelineClip | null;

  // History for undo/redo
  history: EditorSnapshot[];
  historyIndex: number;

  // Drag/Drop state
  draggingClipId: string | null;
  dragPreviewTime: number;
  dragPreviewTrackId: string | null;

  // Transitions UI State
  showTransitionLayer: boolean;
  selectedTransitionClipId: string | null;

  // New features
  hasUnsavedChanges: boolean;
  selectedKeyframeLines: {clipId: string, time: number}[];
  settings: {
    scrollSpeed: number;
    gestureSensitivity: number;
  };
}

export interface EditorSnapshot {
  tracks: TimelineTrack[];
  currentTime: number;
}

// Tool Types
export type EditorTool = 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward' | 'rateStretch';

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
