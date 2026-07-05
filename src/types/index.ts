// Media Types
export type MediaType = 'video' | 'audio' | 'image' | 'text' | 'fx' | 'lut';

// LUT (Color Look-Up Table) data parsed from .cube files
export interface LutData {
  size: number;           // LUT grid size (e.g. 33 for 33x33x33)
  table: Float32Array;    // Flattened RGB table: [r0,g0,b0, r1,g1,b1, ...]
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  title?: string;
}

export interface ClipLutSettings {
  mediaId: string;        // references the LUT MediaItem
  intensity: number;      // 0-100%, blend between original and LUT-graded
}

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
  // Content
  textContent?: string;     // default text content
  fxType?: string;          // specific effect identifier
  // LUT data (only set for type === 'lut')
  lutData?: LutData;
}

export interface CornerPoints {
  x0: number; y0: number; // Top-Left
  x1: number; y1: number; // Top-Right
  x2: number; y2: number; // Bottom-Right
  x3: number; y3: number; // Bottom-Left
}

// Transform for clips
export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  rotationX?: number; // 3D X rotation in degrees
  rotationY?: number; // 3D Y rotation in degrees
  rotationZ?: number; // 3D Z rotation in degrees (matches rotation)
  perspectivePin?: boolean;
  perspectiveCorners?: CornerPoints;
  blendMode?: GlobalCompositeOperation; // compositor blend modes
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

export interface ColorWheelAdjustment {
  hue: number;        // -180 to 180
  saturation: number; // 0 to 100
  lift: number;       // -100 to 100 (brightness offset)
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
  shadows?: ColorWheelAdjustment;
  midtones?: ColorWheelAdjustment;
  highlights?: ColorWheelAdjustment;
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
  // Vocal / BGM Separation
  vocalSeparation?: {
    enabled: boolean;     // Enable vocal/BGM separation (default false)
    mode: 'removeVocals' | 'removeBgm' | 'separateBoth'; // What to isolate/remove
    strength: number;       // 0 to 100 — separation strength (default 80)
    // Advanced: per-frequency band control for fine-tuning
    frequencyBands?: {      // Optional per-band attenuation for manual fine-tuning
      low: number;          // 0-100, 0 = full remove, 100 = full keep (default 100)
      mid: number;          // 0-100 (default 100)
      high: number;         // 0-100 (default 100)
    };
  };
}

export type TextAnimationPreset = 
  | 'none' 
  | 'fadeIn' 
  | 'fadeOut' 
  | 'typewriter' 
  | 'slideUp' 
  | 'slideDown' 
  | 'slideLeft' 
  | 'slideRight' 
  | 'bounce' 
  | 'zoom';

export interface ClipTextAnimation {
  in: TextAnimationPreset;
  out: TextAnimationPreset;
  inDuration: number;  // in seconds (default 0.5)
  outDuration: number; // in seconds (default 0.5)
}

export interface ClipTextSettings {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  threeD: boolean;
  threeDDepth: number;
  textAlign?: 'left' | 'center' | 'right';
  strokeColor?: string;
  strokeWidth?: number;
  animation?: ClipTextAnimation;
}

export interface ClipFxSettings {
  type: 'vfx_breakdown' | 'bw_to_color' | 'glitch' | 'old_film' | 'vhs' | 'cinematic_bars' | 'neon_glow' | 'rgb_split' | 'pixelate' | 'mirror' | 'zoom_blur' | 'lens_flare' | 'night_vision' | 'thermal' | string;
  intensity: number;    // 0 to 100
  wipeAngle?: number;   // 0 to 360 (for wipes)
}

export type ParticleEffectType =
  | 'snow'
  | 'rain'
  | 'fire'
  | 'sparkles'
  | 'confetti'
  | 'smoke'
  | 'bubbles'
  | 'leaves'
  | 'hearts'
  | 'matrix';

export interface ClipParticleSettings {
  type: ParticleEffectType;
  // Emitter position as % of canvas (0-100)
  emitterX: number;
  emitterY: number;
  // Core controls
  amount: number;       // 1–500  (max simultaneous particles)
  speed: number;        // 0–200  (% of base speed)
  intensity: number;    // 0–100  (opacity / density)
  size: number;         // 0–200  (% of base size)
  // Physics
  gravity: number;      // -100–100 (negative = upward)
  wind: number;         // -100–100 (left/right drift)
  spread: number;       // 0–180  (cone angle in degrees)
  lifetime: number;     // 0–200  (% of base lifetime)
  // Visual
  color: string;        // hex or 'auto' (effect-defined)
  colorVariance: number;// 0–100
  glow: boolean;
  turbulence: number;   // 0–100
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

export interface ClipChromaKeySettings {
  enabled: boolean;
  color: string;      // Hex color, e.g. '#00ff00'
  threshold: number;  // 0 to 100
  softness: number;   // 0 to 100
}

export interface ClipKenBurnsSettings {
  enabled: boolean;
  startScale: number;
  startPanX: number;
  startPanY: number;
  endScale: number;
  endPanX: number;
  endPanY: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
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
  // Audio/Video unlink: when a video clip’s audio is extracted to a separate
  // audio clip, both clips get linkedClipId pointing at each other.
  linkedClipId?: string;
  // Transition at the beginning of the clip (blending previous clip into this one)
  transitionIn?: Transition;
  // Premiere Pro-style color grading filters
  colorFilters?: ClipColorFilters;
  // Premiere Pro-style advanced audio configurations
  audioSettings?: ClipAudioSettings;
  // Text and FX
  textSettings?: ClipTextSettings;
  fxSettings?: ClipFxSettings;
  particleSettings?: ClipParticleSettings;
  chromaKey?: ClipChromaKeySettings;
  kenBurns?: ClipKenBurnsSettings;
  lut?: ClipLutSettings;
}

// NEW: Over Layer Clip — lightweight sub-clip living inside a track
export interface OverLayerClip {
  id: string;
  mediaId: string | null;    // null = empty placeholder (awaiting media drop)
  trackId: string;           // parent track ID
  startTime: number;         // absolute timeline position (seconds)
  duration: number;          // visible duration (seconds)
  trimStart: number;         // seconds trimmed from beginning of source
  trimEnd: number;           // seconds trimmed from end of source
  transform: ClipTransform;  // PIP position, scale, rotation
  crop?: ClipCrop;           // crop bounding box in percentages (0-100)
  opacity: number;           // 0-1
  speed: number;             // playback speed multiplier
  speedRamp?: SpeedRampKeyframe[]; // speed ramp keyframes
  animations?: ClipAnimations; // timeline keyframes for properties
  effects: string[];
  isPreview?: boolean;
  colorFilters?: ClipColorFilters;
  audioSettings?: ClipAudioSettings;
  textSettings?: ClipTextSettings;
  fxSettings?: ClipFxSettings;
  particleSettings?: ClipParticleSettings;
  chromaKey?: ClipChromaKeySettings;
  kenBurns?: ClipKenBurnsSettings;
  lut?: ClipLutSettings;
}

// Timeline Track
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'fx';
  linkedTrackId?: string; // used by FX tracks to link to a host track
  clips: TimelineClip[];
  overLayers: OverLayerClip[]; // PIP sub-layers
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  isDynamic?: boolean;
  volume?: number; // 0.0 to 1.0
  pan?: number;    // -1.0 to 1.0 (left to right)
  solo?: boolean;
}

export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
  color: string; // Hex color code
}

// Editor State
export interface EditorState {
  // Media Library
  mediaLibrary: MediaItem[];

  // Timeline
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  selectedClipIds: string[];
  selectedOverLayerId: string | null;      // currently selected over layer
  hoveredOverLayerRegion: {                // which track region is hovered
    trackId: string;
    startTime: number;
    endTime: number;
  } | null;
  pinnedOverLayerTrackId: string | null;    // track with over-layers pinned open
  selectedTrackId: string | null;
  markers: TimelineMarker[];

  // Playback
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  playbackSpeed: number;
  playbackDirection?: number; // -1, 0, +1
  isMuted: boolean;
  volume: number;
  inPoint: number | null;
  outPoint: number | null;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';

  // Timeline Zoom & Scroll
  zoomLevel: number;     // pixels per second
  scrollLeft: number;

  // Tools
  activeTool: 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward' | 'rateStretch';

  // UI State
  showExportModal: boolean;
  isExporting: boolean;
  exportFps?: number;
  exportWidth?: number;
  exportHeight?: number;
  showSettingsModal: boolean;
  isRecordingVoiceover: boolean;
  recordingTrackId: string | null;
  activeMediaTab: 'project' | 'transitions' | 'audio' | 'effects' | 'text' | 'templates';
  activePropertiesTab: PropertiesTab;

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
    autosave: boolean;
    showWaveform: boolean;
    snapEnabled: boolean;
    defaultDuration: number;
    previewQuality: 'full' | 'half' | 'quarter';
    showThumbnails: boolean;
    hardwareAcceleration: boolean;
    keyboardShortcuts?: Record<string, string>;
  };
  // Beat detection markers (per audio clip)
  beatMarkers: { time: number; clipId: string }[];
  projectTemplates: ProjectTemplate[];
}

export interface EditorSnapshot {
  tracks: TimelineTrack[];
  currentTime: number;
  label?: string;
}

// Tool Types
export type EditorTool = 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward' | 'rateStretch';

// Media Tab Types
export type MediaTab = 'project' | 'transitions' | 'audio' | 'effects' | 'text' | 'templates';

// Properties Tab Types
export type PropertiesTab = 'transform' | 'color' | 'speed' | 'audio' | 'text' | 'effects' | 'history';

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

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  totalDuration: number;
  createdAt: number;
}
