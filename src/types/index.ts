// Media Types
export type MediaType = 'video' | 'audio' | 'image' | 'text' | 'fx' | 'lut' | 'compound';

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

export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  duration: number; // in seconds
  url: string;      // object URL for the file blob
  size?: number;
  createdAt: number;
  folderId?: string; // ID of the parent MediaFolder
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
  // Compound Clip data
  nestedTimeline?: TimelineTrack[];
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
  perspectiveTrackingData?: { time: number; corners: CornerPoints }[];
  blendMode?: GlobalCompositeOperation; // compositor blend modes
  flipH?: boolean;
  flipV?: boolean;
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
  denoise?: number;     // 0 to 100 (default 0, noise reduction intensity)
  mid?: number;         // -15 to 15 dB (default 0) — Mid-band EQ (1kHz presence)
  compression?: number; // 0 to 100 (default 0) — Dynamic range compression %
  deEsser?: number;     // 0 to 100 (default 0) — Sibilance reduction %
  warmth?: number;      // -100 to 100 (default 0) — Low-mid warmth/body
  // AI Vocal / BGM Separation (Demucs)
  aiVocalSeparation?: {
    isProcessed: boolean;   // True if AI has generated the stems
    isProcessing?: boolean; // True while AI is currently processing
    mode: 'original' | 'vocals' | 'bgm' | 'both'; // Playback mode
    vocalsMediaId?: string; // Generated vocals Blob URL / Media ID
    bgmMediaId?: string;    // Generated background music Blob URL / Media ID
    vocalsVolume: number;   // 0 to 100 (default 100)
    bgmVolume: number;      // 0 to 100 (default 100)
  };
  // Vocal / BGM Separation (Legacy Phase Cancellation)
  vocalSeparation?: {
    enabled: boolean;
    mode: 'removeVocals' | 'removeBgm' | 'separateBoth';
    strength: number;
    frequencyBands?: {
      low: number;
      mid: number;
      high: number;
    };
  };
}

// Per-clip result from AI Auto Voice Tune
export interface VoiceTuneResult {
  clipId: string;
  clipName: string;
  isReference: boolean;
  adjustments: {
    volume?: number;
    bass?: number;
    mid?: number;
    treble?: number;
    pitch?: number;
    voiceFormant?: number;
    compression?: number;
    warmth?: number;
    deEsser?: number;
  };
}

export interface ScopeSettings {
  enabled: boolean;
  type: 'waveform' | 'vectorscope' | 'rgb-parade';
  opacity: number; // 0-1
  size: 'small' | 'medium' | 'large';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showGrid: boolean;
  showLimits: boolean; // Show safe zones (0-100 IRE)
  intensity: number; // 0-100 (brightness of scope display)
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
  | 'zoom'
  // ─── Cinematic additions ────────────────────────────────────────────
  | 'elastic'        // spring overshoot — bouncy kinetic pop
  | 'revealWipe'     // clip-path wipe from left → right (reveal curtain)
  | 'splitReveal'    // scale from 0.1 outward with fade — cinematic title
  | 'glitch'         // rapid XY jitter on entry — cyberpunk / sci-fi
  | 'letterSpacing'  // characters compress-in then expand to final spacing
  | 'rollUp'         // fast hard roll from below (film-credit style)
  | 'scaleFlip'      // Y-axis squeeze then snap to full height — dramatic pop
  | 'zoomBlur';      // zoom in with motion-blur alpha ramp — blockbuster intro

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
  shadowColor?: string;
  shadowBlur?: number;
  threeD?: boolean;
  threeDDepth?: number;
  textAlign?: 'left' | 'center' | 'right';
  animationPreset?: 'subscribe' | 'typewriter' | 'bounce';
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


export type EasingType = 'linear' | 'hold' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier';

export interface SpeedRampKeyframe {
  id: string;
  sourceTime: number;  // seconds in original media
  speed: number;       // 1.0 = 100%
  easing: EasingType;
  bezierControl?: {
    out: { x: number; y: number }; // Point { x: number; y: number }
    in: { x: number; y: number };  // Point { x: number; y: number }
  };
}

export interface BezierControl {
  x: number;
  y: number;
  inX?: number;
  inY?: number;
}

export interface PropertyKeyframe {
  time: number;
  value: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold' | 'bezier';
  holdNext?: boolean;
  bezier?: BezierControl;
  spatialTangent?: { x: number; y: number };
  roving?: boolean;
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

export interface ClipAiBackgroundSettings {
  enabled: boolean;
  edgeBlur: number;
  modelSelection?: 0 | 1; // 0 for general (high quality), 1 for landscape (fast)
}

export interface ClipChromaKeySettings {
  enabled: boolean;
  color: string;      // Hex color, e.g. '#00ff00'
  threshold: number;  // 0 to 100
  softness: number;   // 0 to 100
  spillSuppression?: number; // 0 to 100
  edgeFeather?: number;      // 0 to 20
}

export interface ClipLumaKeySettings {
  enabled: boolean;
  type: 'dark' | 'light'; // Key out darks or lights
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

export interface ClipMaskSettings {
  enabled: boolean;
  type: 'rectangle' | 'circle' | 'path' | 'split' | 'filmstrip' | 'heart' | 'star' | 'matte';
  x: number; // 0-100%
  y: number; // 0-100%
  width: number; // 0-100%
  height: number; // 0-100% (or radius for circle)
  points: { x: number, y: number }[]; // For path type
  feather: number; // 0-100
  invert: boolean;
  rotation?: number; // 0-360 degrees
  roundness?: number; // 0-100% (for rectangle)
  matteSourceClipId?: string; // For track matte
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
  zIndex?: number;      // custom layer ordering (higher = on top)
  crop?: ClipCrop;      // crop bounding box in percentages (0-100)
  opacity: number;      // 0-1
  speed: number;        // playback speed multiplier
  speedRamp?: SpeedRampKeyframe[]; // speed ramp keyframes (overrides flat speed)
  animations?: ClipAnimations; // timeline keyframes for properties
  // Effects
  effects: string[];
  // For drag preview
  isPreview?: boolean;
  // If the clip is completely disabled (muted and hidden)
  disabled?: boolean;
  // Kinship tracking for split clips
  splitGroupId?: string;
  // Audio/Video unlink: when a video clip’s audio is extracted to a separate
  // audio clip, both clips get linkedClipId pointing at each other.
  linkedClipId?: string;
  // Transition at the beginning of the clip (blending previous clip into this one)
  transitionIn?: Transition;
  // Transition at the end of the clip
  transitionOut?: Transition;
  // Premiere Pro-style color grading filters
  colorFilters?: ClipColorFilters;
  // Premiere Pro-style advanced audio configurations
  audioSettings?: ClipAudioSettings;
  // Text and FX
  textSettings?: ClipTextSettings;
  fxSettings?: ClipFxSettings;
  particleSettings?: ClipParticleSettings;
  aiBackground?: ClipAiBackgroundSettings;
  chromaKey?: ClipChromaKeySettings;
  lumaKey?: ClipLumaKeySettings;
  kenBurns?: ClipKenBurnsSettings;
  lut?: ClipLutSettings;
  mask?: ClipMaskSettings;
  pipWindowIds?: string[]; // Array of PIP window IDs attached to this clip
  // Sequencer / Interpolation (Gap #2 + #3)
  interpolation?: ClipInterpolationSettings;
  sequenceId?: string; // Image sequence membership
  sequenceIndex?: number; // position in sequence (0, 1, 2...)
}

// ─── Sequencer / Interpolation ───────────────────────────────────────────
export type InterpolationMode = 'none' | 'kenburns' | 'morph' | 'opticalFlow';

export type InterpolationPreset =
  | 'off'
  | 'kenburns-pan'
  | 'kenburns-zoomIn'
  | 'kenburns-zoomOut'
  | 'kenburns-orbit'
  | 'morph-fade'
  | 'morph-warp'
  | 'flow-rife';

export type SequenceTransitionType =
  | 'cut'
  | 'fade'
  | 'crossfade'
  | 'kenburnsFade'
  | 'kenburnsAuto';

export type SequenceEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut';

export type OpticalFlowModel = 'rife40' | 'rife49' | 'dain';

export interface ClipInterpolationSettings {
  mode: InterpolationMode;
  autoKenBurns?: boolean;
  preset?: InterpolationPreset;
  panAmplitude?: number;   // 0–100 (% of frame)
  zoomAmount?: number;     // 0–100 (% scale)
  blendDuration?: number;  // seconds, overlap with next image
  intensity?: number;      // 0–100 (effect strength)
  easing?: SequenceEasing;
  // optical-flow specific
  flowModel?: OpticalFlowModel;
  flowCount?: number;      // intermediate frames per pair (default 1)
  flowFramerate?: number;  // target fps for synthesized segment
}

export interface ImageSequence {
  id: string;
  trackId: string;
  startTime: number;
  totalDuration: number;
  memberClipIds: string[];
  defaultClipDuration: number;
  overlap: number;
  transitionType: SequenceTransitionType;
  createdAt: number;
}

export interface InterpolationRenderFrame {
  // light cache pointer so re-renders are cheap
  cacheKey: string;
}

// NEW: PIP Window - A nested mini-timeline attached to a specific clip
export interface PipWindow {
  id: string;
  parentClipId: string;
  relativeStartTime: number; // Offset from parent clip start (in seconds)
  tracks: TimelineTrack[];   // Mini-timeline tracks
  duration: number;          // Minimum visual duration is 5s
  zIndex: number;            // Overall PIP z-index relative to other PIPs
  manualDuration?: boolean;  // User manually resized duration
}

// Timeline Track
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'fx';
  linkedTrackId?: string; // used by FX tracks to link to a host track
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  isDynamic?: boolean;
  volume?: number; // 0.0 to 1.0
  pan?: number;    // -1.0 to 1.0 (left to right)
  solo?: boolean;
  // Subtitle Language support
  selectedSubtitleLanguage?: string; // current active language code (e.g., 'EN', 'HI')
  subtitleVariants?: Record<string, TimelineClip[]>; // maps language code to array of clips
}

export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
  color: string; // Hex color code
  type?: 'standard' | 'sponsor' | 'chapter';
}

export interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translations?: Record<string, string>;
}

// Editor State
export interface EditorState {
  projectId: string;
  projectName: string;
  showTeleprompter: boolean;
  showHelpMenu: boolean;
  activeHelpSection: string | null;
  useProxies: boolean;
  // Media Library
  mediaLibrary: MediaItem[];
  folders: MediaFolder[];

  // Timeline
  tracks: TimelineTrack[];
  timelineStack: { tracks: TimelineTrack[]; compoundMediaId: string; activePipWindowId?: string | null }[]; // for compound clip nesting
  selectedClipId: string | null;
  selectedClipIds: string[];
  
  // PIP Nested Timelines
  pipWindows: Record<string, PipWindow>;
  activePipWindowId: string | null;

  // Image Sequencer (Gap #2 + #3)
  sequences: ImageSequence[];

  selectedTrackId: string | null;
  markers: TimelineMarker[];

  // Playback
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  playbackSpeed: number;
  playbackDirection?: number; // -1, 0, +1
  isMuted: boolean;
  muteTimelineAudio?: boolean;
  volume: number;
  inPoint: number | null;
  outPoint: number | null;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';

  // Timeline Zoom & Scroll
  zoomLevel: number;     // pixels per second
  scrollLeft: number;

  // Tools
  activeTool: EditorTool;

  // UI State
  showProgressBar: boolean;
  progressBarColor: string;
  progressBarHeight: number;
  showExportModal: boolean;
  showScopes: boolean;
  isExporting: boolean;
  exportFps?: number;
  exportWidth?: number;
  exportHeight?: number;
  showSettingsModal: boolean;
  isRecordingVoiceover: boolean;
  recordingTrackId: string | null;
  activeMediaTab: 'project' | 'transitions' | 'audio' | 'effects' | 'text' | 'templates' | 'transcript';
  activePropertiesTab: PropertiesTab;
  workspaceLayout: {
    preset: 'Editing' | 'Color' | 'Audio' | 'Custom';
    leftWidth: number;
    rightWidth: number;
    timelineHeight: number;
  };

  // Canvas Mode
  canvasTransformMode: 'resize' | 'crop';
  previewCanvas: HTMLCanvasElement | null;
  masterAudioStream: MediaStream | null;

  // Clipboard
  clipboardData: { type: 'clip' | 'style' | 'whole'; clips: TimelineClip[] } | null;
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
    showSafeZones?: boolean;
    keyboardShortcuts?: Record<string, string>;
    geminiApiKey?: string;
    huggingFaceApiKey?: string;
    groqApiKey?: string;
    freesoundApiKey?: string;
    elevenLabsApiKey?: string;
    openRouterApiKey?: string;
  };
  beatMarkers: { time: number; clipId: string }[];
  projectTemplates: ProjectTemplate[];
  subtitles: SubtitleItem[];
  selectedSubtitleId: string | null;
  subtitleLanguage: string;
  scopeSettings: ScopeSettings;

  // AI Video Generation State
  aiVideoIsGenerating: boolean;
  aiVideoProgress: number;
  aiVideoJobId: string | null;
  aiVideoResultUrl: string | null;
}

export interface EditorActions {
  setAIVideoGenerationState: (state: Partial<Pick<EditorState, 'aiVideoIsGenerating' | 'aiVideoProgress' | 'aiVideoJobId' | 'aiVideoResultUrl'>>) => void;
  setScopeSettings: (settings: ScopeSettings) => void;
  setMuteTimelineAudio: (mute: boolean) => void;
  setShowHelpMenu: (show: boolean, section?: string | null) => void;
  setProjectInfo: (id: string, name: string) => void;
  resetProject: () => void;
  setTracks: (tracks: TimelineTrack[]) => void;
  setSubtitles: (subtitles: SubtitleItem[]) => void;
  updateSubtitle: (id: string, updates: Partial<SubtitleItem>) => void;
  deleteSubtitle: (id: string) => void;
  addSubtitle: (sub: SubtitleItem) => void;
  selectSubtitle: (id: string | null) => void;
  addTextMedia: (text: string) => void;
  rippleDeleteClip: (clipId: string) => void;
  createPipWindow: (clipId: string, relativeStartTime: number) => void;
  deletePipWindow: (pipId: string) => void;
  updatePipWindowStartTime: (pipId: string, relativeStartTime: number) => void;
  updatePipWindowDuration: (pipId: string, duration: number) => void;
  setActivePipWindow: (pipId: string | null) => void;
  addTrackToPip: (pipId: string, type: 'video' | 'audio' | 'text' | 'fx', mediaId: string, startTime: number, duration: number) => void;
  removeTrackFromPip: (pipId: string, trackId: string) => void;
  reorderPipTrack: (pipId: string, trackIndex: number, direction: 'up' | 'down') => void;
}

export interface EditorSnapshot {
  tracks: TimelineTrack[];
  currentTime: number;
  pipWindows?: Record<string, PipWindow>;
  subtitles?: SubtitleItem[];
  markers?: TimelineMarker[];
  beatMarkers?: { time: number; clipId: string }[];
  label?: string;
}

// Tool Types
export type EditorTool = 'select' | 'split' | 'hand' | 'zoom' | 'ripple' | 'trackSelect' | 'trackSelectBackward' | 'rateStretch' | 'slip' | 'slide';

// Media Tab Types
export type MediaTab = 'project' | 'transitions' | 'audio' | 'effects' | 'text' | 'templates';

// Properties Tab Types
export type PropertiesTab = 'transform' | 'color' | 'mask' | 'speed' | 'audio' | 'text' | 'effects' | 'history' | 'thumbnail';

// Time formatting utility type
export type TimeFormat = 'HH:MM:SS' | 'MM:SS' | 'frames';

// Transition definitions
export interface Transition {
  id: string;
  name: string;
  type: 'dissolve' | 'wipe' | 'zoom' | 'slide' | 'shake' | 'flash' | 'zoomRush' | 'glitch' | 'lightLeak' | 'whipPan' | 'pixelate' | 'mirror' | 'custom';
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

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
}

// ============================================
// AI Copilot Workflow Types (Phase 1)
// ============================================

export type AIToolStatus = 'pending' | 'running' | 'success' | 'failed' | 'awaiting_confirmation';

export interface AIToolStep {
  id: string;
  toolName: string;
  args: Record<string, any>;
  expectation?: string;
  status: AIToolStatus;
  error?: string;
  result?: any;
  rollbackable: boolean;
  requiresConfirmation: boolean;
  userFriendlyLabel?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AIWorkflowPlan {
  id: string;
  prompt: string;
  totalSteps: number;
  steps: AIToolStep[];
  estimatedDuration: number;
  needsConfirmation: boolean;
  destructiveOpsCount: number;
  createdAt: number;
}

export interface AIWorkflowReport {
  planId: string;
  totalSteps: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  totalDurationMs: number;
  summary: string;
  steps: AIToolStep[];
  finalState?: Record<string, any>;
}

export interface AIConfirmationRequest {
  stepId: string;
  toolName: string;
  args: Record<string, any>;
  description: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
}

export interface AIRateLimitStatusFE {
  canMakeCall: boolean;
  remainingCalls: number;
  resetInMs: number;
  isInCooldown: boolean;
  cooldownRemainingMs: number;
}

export interface AISelfTestResult {
  testId: string;
  testName: string;
  category: 'import' | 'edit' | 'audio' | 'color' | 'effects' | 'text' | 'export' | 'meta';
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  message: string;
  details?: string;
  error?: string;
}

export interface AISelfTestReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  durationMs: number;
  byCategory: Record<string, { passed: number; failed: number; total: number }>;
  results: AISelfTestResult[];
  workingFeatures: string[];
  notWorkingFeatures: string[];
  summary: string;
}

export interface AIGenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  resultUrl?: string;
  error?: string;
  prompt: string;
  createdAt: number;
}

