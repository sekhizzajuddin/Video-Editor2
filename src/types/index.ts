// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

// Media Types
export type MediaType = 'video' | 'audio' | 'image' | 'text' | 'fx' | 'lut' | 'compound' | 'adjustment';

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
  blendIntensity?: number; // 0 to 100 percentage of blend mode mixing, default 100
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
  curves?: {
    rgb?: { points: Array<{ x: number; y: number; id: string }> };
    r?: { points: Array<{ x: number; y: number; id: string }> };
    g?: { points: Array<{ x: number; y: number; id: string }> };
    b?: { points: Array<{ x: number; y: number; id: string }> };
    luma?: { points: Array<{ x: number; y: number; id: string }> };
  };
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
  // Vocal Tone: -100 (girl/lady tone) … 0 (original) … +100 (boy/man tone).
  // Drives pitch AND formant together; never overwritten by auto-match.
  tone?: number; // default 0 (original)
  // Auto vocal-frequency matching: when enabled, vocalMatchShift semitones are
  // layered on top of the manual pitch/tone/formant so this clip's voice
  // matches the reference (first) clip. Stored per clip — manual settings are
  // preserved, so per-clip values may differ while the output is unified.
  vocalMatchEnabled?: boolean;
  vocalMatchShift?: number; // computed correction in semitones (auto-match)
  humanize: boolean;    // one-click AI humanizer toggle (default false)
  denoise?: number;     // 0 to 100 (default 0, noise reduction intensity)
  mid?: number;         // -15 to 15 dB (default 0) — Mid-band EQ (1kHz presence)
  compression?: number; // 0 to 100 (default 0) — Dynamic range compression %
  deEsser?: number;     // 0 to 100 (default 0) — Sibilance reduction %
  warmth?: number;      // -100 to 100 (default 0) — Low-mid warmth/body
  // AI Auto Audio Ducking (Music vs Voice Sync)
  ducking?: {
    enabled: boolean;
    duckVolume: number;   // 5 to 50% (default 20% background volume during speech)
    duckDb?: number;      // e.g. -18 dB (reduction amount)
    fadeDuration: number; // 100 to 800 ms (default 300 ms)
    attackDuration?: number;  // ms ramp down before speech
    holdDuration?: number;    // ms sustain after speech
    releaseDuration?: number; // ms ramp up after speech
    threshold?: number;   // sensitivity threshold
    appliedAt?: number;   // timestamp when auto ducking was applied
  };
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
  // ─── Cinematic ────────────────────────────────────────────────────────
  | 'elastic'        // spring overshoot — bouncy kinetic pop
  | 'revealWipe'     // clip-path wipe from left → right (reveal curtain)
  | 'splitReveal'    // scale from 0.1 outward with fade — cinematic title
  | 'glitch'         // rapid XY jitter on entry — cyberpunk / sci-fi
  | 'letterSpacing'  // characters compress-in then expand to final spacing
  | 'rollUp'         // fast hard roll from below (film-credit style)
  | 'scaleFlip'      // Y-axis squeeze then snap to full height — dramatic pop
  | 'zoomBlur'       // zoom in with motion-blur alpha ramp — blockbuster intro
  // ─── New additions ────────────────────────────────────────────────────
  | 'spinIn'         // 360° rotation with scale-up
  | 'dropBounce'     // falls from above with physics bounce
  | 'flipX'          // 3D card flip around X axis
  | 'flipY'          // 3D card flip around Y axis
  | 'blurIn'         // blur clears from 8px to 0px with fade
  | 'expandWidth'    // scaleX only (0→1), height stays constant
  | 'wave'           // sinusoidal Y offset cascade through characters
  | 'scramble';      // random chars that resolve to correct text

export type TextLoopAnimation = 'none' | 'wiggle' | 'pulse' | 'float' | 'neonFlicker' | 'shake' | 'colorCycle';

export interface ClipTextAnimation {
  in: TextAnimationPreset;
  out: TextAnimationPreset;
  inDuration: number;   // in seconds (default 0.5)
  outDuration: number;  // in seconds (default 0.5)
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeOutBack' | 'easeOutElastic' | 'easeOutBounce';
  perUnit?: 'all' | 'word' | 'character';  // cascade unit
  stagger?: number;     // delay between cascade units in seconds (e.g. 0.05)
  loop?: TextLoopAnimation;  // ambient animation during hold phase
  loopSpeed?: number;   // loop speed multiplier (default 1.0)
}

export interface ClipTextSettings {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  backgroundStyle?: string;
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
  gradientColors?: string[];      // gradient fill colors (e.g. ['#ff0000', '#0000ff'])
  gradientDirection?: 'horizontal' | 'vertical' | 'diagonal';  // gradient direction
  outerStrokeColor?: string;      // second stroke for sticker/double-outline effect
  outerStrokeWidth?: number;      // outer stroke width
}

/** AI-generated custom FX item — stored per-project in customFxList. */
export interface CustomFxItem {
  id: string;
  name: string;               // AI-generated descriptive name (e.g. "Neon HUD — Tech Explainer")
  description: string;        // Brief scene description
  category: 'custom';
  htmlCss: string;            // Self-contained HTML/CSS/SVG animation code
  thumbnail?: string;         // Base64 JPEG preview (rasterized at t=50%)
  audioBreakdown: {
    transcript: string;
    keywords: string[];
    tone: string;             // 'energetic' | 'calm' | 'dramatic' | 'comedic' | ...
    pace: string;             // 'fast' | 'moderate' | 'slow'
  } | null;                   // null when audio scan failed/skipped
  visualBreakdown: {
    sceneType: string;        // 'action' | 'explainer' | 'interview' | 'cinematic' | ...
    subjects: string;
    safeZones: string;        // e.g. 'left-third' | 'right-third' | 'lower-third' | 'center'
    palette: string[];
    composition: string;
  } | null;                   // null when vision scan failed/skipped
  reasoning: string;          // Why this animation justifies the dialogue in the visual scene
  prompt: string;             // Editable animation directive
  duration: number;           // Duration in seconds
  createdAt: number;
}

export interface ClipFxSettings {
  enabled?: boolean;
  isCollapsed?: boolean;
  type: 'vfx_breakdown' | 'bw_to_color' | 'glitch' | 'old_film' | 'vhs' | 'cinematic_bars' | 'neon_glow' | 'rgb_split' | 'pixelate' | 'mirror' | 'rhythmic_mirror' | 'continuous_mirror' | 'action_zoom_pulse' | 'action_strobe' | 'action_shake' | 'quadrant_kaleidoscope' | 'subject_outline_flash' | 'zoom_blur' | 'lens_flare' | 'night_vision' | 'thermal' | 'style_anime' | 'style_watercolor' | 'style_papercut' | 'custom_html' | string;
  intensity: number;    // 0 to 100
  wipeAngle?: number;   // 0 to 360 (for wipes)
  // ── Action & Mirror FX parameters ──
  flipInterval?: number;   // seconds per mirror flip (e.g. 0.25s, 0.5s, 1.0s)
  flipAxis?: 'horizontal' | 'vertical' | 'both' | 'alternate';
  mirrorMode?: 'flip' | 'symmetric';
  mirrorStyle?: 'left_to_right' | 'right_to_left' | 'top_to_bottom' | 'bottom_to_top' | 'quad';
  impactFlash?: boolean;
  // ── Glitch parameters ──
  glitchSpeed?: number;    // 1 to 20 Hz
  glitchBands?: number;    // 5 to 50 slice count
  rgbSplitDistance?: number; // 0 to 30px chromatic displacement
  // ── Other FX parameters ──
  barRatio?: string;       // '2.39:1' | '2.35:1' | '4:3' | '1:1'
  pulseSpeed?: number;     // Hz or beats per sec
  pulseDepth?: number;     // scale percentage bump (10-50%)
  strobeSpeed?: number;    // Hz
  strobeColor?: string;    // hex or 'white'
  outlineColor?: string;
  outlineWidth?: number;
  glowBlur?: number;
  // ── Custom AI FX parameters ──
  customFxId?: string;       // Reference to CustomFxItem.id
  customHtmlCss?: string;    // Inline HTML/CSS/SVG code (denormalized for render perf)
  customFxName?: string;     // Display label
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
  | 'matrix'
  | 'paper_pieces';

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

export interface SpeedFrame {
  id: string;
  timelineOffset: number; // seconds from clip.startTime (0 < timelineOffset < clip.duration)
  sourceTime: number;     // anchored source media time in seconds
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

export type AiCutoutMode = 'remove' | 'blur' | 'outline' | 'color';

export interface ClipAiBackgroundSettings {
  enabled: boolean;
  mode?: AiCutoutMode;      // 'remove' (transparent), 'blur' (portrait blur), 'outline' (sticker), 'color' (solid/studio)
  blurStrength?: number;    // 0 to 40 px for background blur mode (default 12)
  strokeColor?: string;     // Hex color for sticker/outline, e.g. '#ffffff' or '#06b6d4'
  strokeWidth?: number;     // 1 to 20 px outline thickness (default 4)
  strokeGlow?: boolean;     // Whether outline has a neon glow
  bgColor?: string;         // Solid/studio background replacement color, e.g. '#1e1e24'
  edgeBlur: number;
  modelSelection?: 0 | 1 | 2; // 0: Fast GPU, 1: High Accuracy HD, 2: Ultra Studio / RVM
  playbackQuality?: 'full' | 'balanced' | 'performance'; // Controls inference strategy during playback
  choke?: number;          // -10 to 10 px (shrink/expand mask edge)
  feather?: number;        // 0 to 20 px (Gaussian blur on alpha edge)
  spillSuppression?: number; // 0 to 100 (desaturate edge fringe)
  spillColor?: string;     // Hex color for spill suppression target, e.g. '#00ff00'
}

export interface ClipChromaKeySettings {
  enabled: boolean;
  color: string;      // Hex color, e.g. '#00ff00'
  threshold: number;  // 0 to 100
  softness: number;   // 0 to 100
  spillSuppression?: number; // 0 to 100
  edgeFeather?: number;      // 0 to 20
  /**
   * Never skip this key for performance. Set on generative overlays that were
   * rendered on a flat key plate: without the key the clip is a solid block of
   * colour, so dropping it during playback/scrubbing is never acceptable —
   * unlike a greenscreen clip where skipping only shows green for a moment.
   */
  alwaysApply?: boolean;
  keyframes?: {
    threshold?: PropertyKeyframe[];
    softness?: PropertyKeyframe[];
    spillSuppression?: PropertyKeyframe[];
    edgeFeather?: PropertyKeyframe[];
  };
}

export interface ClipLumaKeySettings {
  enabled: boolean;
  type: 'dark' | 'light'; // Key out darks or lights
  threshold: number;  // 0 to 100
  softness: number;   // 0 to 100
}

export type ObjectRemovalMode = 'content_aware' | 'patch_replace' | 'blur_conceal' | 'pixelate';
export type ObjectRemovalShape = 'rectangle' | 'ellipse' | 'polygon';

export interface WatermarkRegion {
  id: string;
  name?: string;
  enabled: boolean;
  mode: ObjectRemovalMode;
  shape: ObjectRemovalShape;
  x: number;          // Center X in % (0 to 100)
  y: number;          // Center Y in % (0 to 100)
  width: number;      // Width in % (1 to 100)
  height: number;     // Height in % (1 to 100)
  rotation?: number;  // Angle in degrees
  feather?: number;   // Edge feathering softness in px (0 to 50)
  opacity?: number;   // Removal strength / mixing opacity (0 to 100)
  stretchStrength?: number; // Inward diffusion intensity (1 to 100)
  patchSourceX?: number;    // Reference sampling X % (0 to 100)
  patchSourceY?: number;    // Reference sampling Y % (0 to 100)
}

export type ClipWatermarkRegion = WatermarkRegion;

export interface ClipObjectRemovalSettings {
  enabled: boolean;
  mode: ObjectRemovalMode;
  shape: ObjectRemovalShape;
  x: number;          // Center X in % (0 to 100, default 50)
  y: number;          // Center Y in % (0 to 100, default 50)
  width: number;      // Width in % (1 to 100, default 20)
  height: number;     // Height in % (1 to 100, default 20)
  rotation: number;   // -180 to 180 degrees (default 0)
  feather: number;    // Edge feathering softness in px (0 to 50, default 10)
  opacity: number;    // Removal strength / mixing opacity (0 to 100, default 100)
  stretchStrength?: number; // For content_aware: inward color stretch intensity (1 to 100, default 80)
  patchSourceX?: number;    // For patch_replace: reference sampling X % (0 to 100, default 30)
  patchSourceY?: number;    // For patch_replace: reference sampling Y % (0 to 100, default 30)
  showHighlight?: boolean;  // Highlight target area with outline during placement
  temporalSmoothing?: boolean; // Frame-to-frame stabilization for video
  quality?: 'preview' | 'export'; // Fast preview vs studio export quality
  points?: { x: number; y: number }[]; // For custom polygon lasso bounding
  regions?: WatermarkRegion[]; // Multi-region support for multiple watermarks on the same clip
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

// ─── Vector Bezier Masking Engine ──────────────────────────────────────────
export interface MaskPoint {
  x: number; // 0 to 100% or absolute canvas coords
  y: number; // 0 to 100% or absolute canvas coords
}

export interface BezierPoint extends MaskPoint {
  handleIn?: MaskPoint;
  handleOut?: MaskPoint;
}

export interface BezierPath {
  points: BezierPoint[];
  closed: boolean;
}

export interface ClipVectorMaskSettings {
  enabled: boolean;
  shapeType: 'rectangle' | 'ellipse' | 'polygon' | 'bezier';
  points: BezierPoint[];
  closed: boolean;
  feather: number;    // 0 to 50 px soft blur
  inverted: boolean;   // invert clipping mask
  expansion: number;  // -50 to +50 px expansion/choke
  opacity: number;    // 0 to 100%
}

// ─── Motion Tracking Engine ────────────────────────────────────────────────
export interface TrackingPoint {
  x: number;
  y: number;
}

export interface TrackingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrackingKeyframe {
  frame: number;
  time: number;
  position: TrackingPoint;
  scale?: number;
  rotation?: number;
  confidence: number;
}

export interface MotionTrackingData {
  id: string;
  name: string;
  clipId: string;
  region: TrackingRegion;
  keyframes: TrackingKeyframe[];
  frameRate: number;
  createdAt: number;
}

export interface MotionTrackAttachment {
  trackId: string;
  applyPosition: boolean;
  applyScale: boolean;
  applyRotation: boolean;
  offsetX: number;
  offsetY: number;
}

// Map Waypoint
export interface MapWaypoint {
  lat: number;
  lng: number;
  label?: string;
}

// Map Animation Settings
export interface MapAnimationSettings {
  type: 'route' | 'flyTo' | 'highlight';
  waypoints: MapWaypoint[];
  zoom: number;
  style: 'standard' | 'satellite' | 'dark' | 'vintage';
}

// Timeline Clip
export interface TimelineClip {
  id: string;
  name?: string;
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
  speedFrames?: SpeedFrame[]; // embedded speed frames for rate-stretching without splitting
  speedFrameSourceEnd?: number; // fixed source media end time (seconds) while speedFrames are active
  isReversed?: boolean; // play clip backward (frame-accurate canvas seek engine)
  freezeFrame?: number; // hold this source time (seconds) for the entire clip duration
  animations?: ClipAnimations; // timeline keyframes for properties
  expressions?: Record<string, string>; // procedural JS animation expressions
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
  /**
   * Motion-tracked region effects: shake/jiggle/pulse applied to ONE tracked
   * area (a hand, a face) rather than the whole frame. See utils/motionEffects.
   */
  motionEffects?: import('@/utils/motionEffects').MotionEffectSettings[];
  particleSettings?: ClipParticleSettings;
  aiBackground?: ClipAiBackgroundSettings;
  chromaKey?: ClipChromaKeySettings;
  lumaKey?: ClipLumaKeySettings;
  objectRemoval?: ClipObjectRemovalSettings;
  kenBurns?: ClipKenBurnsSettings;
  lut?: ClipLutSettings;
  lutFilter?: ClipLutSettings;
  mask?: ClipMaskSettings;
  vectorMask?: ClipVectorMaskSettings;
  isAdjustmentLayer?: boolean;
  motionTracks?: MotionTrackingData[];
  motionAttachment?: MotionTrackAttachment;
  pipWindowIds?: string[]; // Array of PIP window IDs attached to this clip
  /**
   * Authored line arrangement (word counts per line) for a Hybrid kinetic
   * sentence container. Persisted so a resize reproduces the author's layout
   * rather than re-deriving it from word positions, which is lossy at small
   * scales (adjacent lines collapse together).
   */
  kineticLineStructure?: number[];
  /**
   * Marks that this kinetic container's word positions are stored in LOCAL space
   * (no baked container transform). Absent on projects saved before the renderer
   * applied the PiP parent transform; those are normalised once on load.
   */
  kineticLocalSpace?: boolean;
  // Sequencer / Interpolation (Gap #2 + #3)
  interpolation?: ClipInterpolationSettings;
  sequenceId?: string; // position in sequence membership
  sequenceIndex?: number; // position in sequence (0, 1, 2...)
  // Map Animation (Auto Video feature)
  mapAnimation?: MapAnimationSettings;
  // Universal clip in/out animation (works on any clip: video, image, text, PIP)
  enterExitAnimation?: ClipEnterExitAnimation;
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
  | 'wipeLeft'
  | 'wipeRight'
  | 'zoomIn'
  | 'zoomOut'
  | 'panLeft'
  | 'panRight'
  | 'kenburnsFade'
  | 'kenburnsAuto';   // auto Ken-Burns (random pan/zoom per clip)

export type SequenceEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface ClipInterpolationSettings {
  mode: InterpolationMode;
  preset?: InterpolationPreset;
  easing?: SequenceEasing;
  transitionType?: SequenceTransitionType;
  transitionDuration?: number; // seconds
  kenBurnsIntensity?: number;  // 0-100
  morphStrength?: number;      // 0-100
  blendDuration?: number;      // seconds for blend overlap between adjacent clips
  autoKenBurns?: boolean;      // auto Ken-Burns mode enabled
}

export interface ImageSequence {
  id: string;
  name?: string;               // optional — some code constructs without it
  trackId: string;
  startTime: number;
  clipIds?: string[];          // legacy field
  memberClipIds: string[];     // current: array of clip IDs belonging to this sequence
  totalDuration?: number;      // computed total duration in seconds
  transitionType: SequenceTransitionType;
  transitionDuration?: number; // optional — not always set on construction
  overlap: number;
  defaultClipDuration: number;
  interpolation?: ClipInterpolationSettings; // optional — not always set
  kenBurnsAuto?: boolean;      // auto Ken-Burns on every clip
  createdAt: number;
}

// ─── Timeline Track ───────────────────────────────────────────────────────
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'fx' | 'adjustment';
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  volume?: number;
  pan?: number;
  solo?: boolean;
  isDynamic?: boolean;         // track is dynamically generated (e.g. AI-driven)
  // FX track linkage
  linkedTrackId?: string;
  // Subtitle multi-language support
  subtitleVariants?: Record<string, TimelineClip[]>;
  selectedSubtitleLanguage?: string;
}

// ─── PIP Window Style ─────────────────────────────────────────────────────
export interface PipWindowStyle {
  // Outline / Border
  outlineEnabled: boolean;
  outlineColor: string;        // hex, e.g. '#ffffff'
  outlineWidth: number;        // 1 to 20 px
  outlineRadius: number;       // 0 to 50 px (border-radius)
  outlineOpacity: number;      // 0 to 100

  // Background
  backgroundEnabled: boolean;
  backgroundColor: string;     // hex color
  backgroundOpacity: number;   // 0 to 100
  backgroundBlur: number;      // 0 to 20 px (frosted glass effect)
  backgroundPadding: number;   // 0 to 50 px (extra padding around PIP content)

  // Shadow
  shadowEnabled: boolean;
  shadowColor: string;         // hex color
  shadowBlur: number;          // 0 to 30 px
  shadowOffsetX: number;       // -20 to 20 px
  shadowOffsetY: number;       // -20 to 20 px
}

// ─── Clip Enter / Exit Animation ──────────────────────────────────────────
/** Universal in/out animation for ANY clip (video, image, text, PIP). */
export interface ClipEnterExitAnimation {
  enterType: TextAnimationPreset;
  exitType: TextAnimationPreset;
  enterDuration: number;       // seconds (default 0.5)
  exitDuration: number;        // seconds (default 0.5)
  enterEasing?: string;        // easing function name
  exitEasing?: string;         // easing function name
}

// ─── PIP Window ───────────────────────────────────────────────────────────
export interface PipWindow {
  id: string;
  clipId?: string;           // parent clip (modern field)
  parentClipId?: string;     // alias — used by store's clip removal logic
  relativeStartTime: number;
  duration: number;
  tracks: TimelineTrack[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  manualDuration?: number;   // user-overridden duration in seconds
  style?: PipWindowStyle;    // visual styling (outline, background, shadow)
  enterExitAnimation?: ClipEnterExitAnimation; // container-level in/out animation
}

// ─── Subtitle ─────────────────────────────────────────────────────────────
export interface SubtitleItem {
  id: string;
  sentenceId?: string;     // groups words into a sentence for sync matching
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  gender?: string;
  confidence?: number;
  translations?: Record<string, string>; // language code -> translated text
  words?: { word: string; start: number; end: number }[]; // word-level timestamps for lip-sync and karaoke
}

// ─── Timeline Marker ──────────────────────────────────────────────────────
export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
  color: string;
  type?: 'standard' | 'chapter' | 'sponsor'; // marker category
}

// ─── Beat Marker ────────────────────────────────────────────────────────
export interface BeatMarker {
  id?: string;   // optional — store constructs beat markers without id
  clipId: string;
  time: number;
}

// ─── Export Region (Specific Timeline Range Mark) ──────────────────────────
export interface ExportRegion {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  color?: string;
}

// ─── Dynamic Speed Ramping (Dynamic Stretch) ───────────────────────────────
export interface DynamicStretchState {
  isActive: boolean;
  clipId: string | null;
  trackId: string | null;
  markStart: number;
  markEnd: number;
  isConfirmed: boolean;
  originalRegionDuration: number;
  stretchedDuration: number;
  maintainDuration: boolean;
  isLoopingRegion: boolean;
}

// ─── Project Template ─────────────────────────────────────────────────────
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  tracks: TimelineTrack[];
  aspectRatio?: string;
  createdAt: number;
  mediaLibrary?: any[];       // serialized media items
  totalDuration?: number;    // pre-computed total duration
}

// ─── Virtual Camera ───────────────────────────────────────────────────────
export interface VirtualCameraKeyframe {
  time: number;
  x: number;
  y: number;
  scale: number;
}

export interface VirtualCameraState {
  enabled: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  // Keyframes stored per aspect-ratio key for easy per-ratio switching
  keyframes: Record<string, VirtualCameraKeyframe[]>;
}

// ─── Editor History Snapshot ──────────────────────────────────────────────
export interface EditorSnapshot {
  tracks: TimelineTrack[];
  currentTime: number;
  label?: string;
  // Extended state captured by saveSnapshot
  pipWindows?: Record<string, PipWindow>;
  subtitles?: SubtitleItem[];
  markers?: TimelineMarker[];
  beatMarkers?: BeatMarker[];
  exportRegions?: ExportRegion[];
}

// ─── Editor Tool / Tab ────────────────────────────────────────────────────
export type EditorTool =
  | 'select'
  | 'cut'
  | 'slip'
  | 'zoom'
  | 'hand'
  | 'multiSelect'
  | 'ripple'            // ripple trim
  | 'rateStretch'       // rate stretch trim
  | 'trackSelect'       // select all clips on track to the right
  | 'trackSelectBackward' // select all clips on track to the left
  | 'split'             // razor / split at playhead
  | 'slide';            // slide clip within gap
export type MediaTab = 'project' | 'stock' | 'ai' | 'audio' | 'text' | 'fx' | 'templates' | 'lut' | 'transitions' | 'effects';
export type PropertiesTab = 'transform' | 'mask' | 'color' | 'speed' | 'audio' | 'text' | 'effects' | 'ai' | 'thumbnail' | 'history' | 'pip';

// ─── Editor Settings ──────────────────────────────────────────────────────
export interface EditorSettings {
  theme?: 'dark' | 'light';
  scrollSpeed: number;
  gestureSensitivity: number;
  autosave: boolean;
  showWaveform: boolean;
  snapEnabled: boolean;
  defaultDuration: number;
  previewQuality: 'full' | 'half' | 'quarter' | 'balanced' | 'performance';
  previewMode: 'auto' | 'webgl' | 'canvas2d';
  showThumbnails: boolean;
  hardwareAcceleration: boolean;
  keyboardShortcuts: Record<string, string>;
  showSafeZones?: boolean;     // overlay action-safe / title-safe guides
  autoPromptAspectRatio?: boolean; // automatically prompt on first video clip aspect ratio mismatch
  geminiApiKey?: string;
  groqApiKey?: string;
  freesoundApiKey?: string;
  elevenLabsApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  huggingFaceApiKey?: string;
  openRouterApiKey?: string;
  pexelsApiKey?: string;
}

// ─── Per-Ratio Framing ────────────────────────────────────────────────────
export interface PerRatioFramingEntry {
  x: number;
  y: number;
  scale: number;
  autoReframeTrackId?: string;
}

// ─── AI Video Generation State ────────────────────────────────────────────
export interface AIVideoGenerationState {
  isGenerating: boolean;
  progress: number;
  jobId: string | null;
  resultUrl: string | null;
}

// ─── Editor State ─────────────────────────────────────────────────────────
export interface EditorState {
  // Project
  projectId: string;
  projectName: string;
  projectFileHandle: any | null;

  // Media
  mediaLibrary: MediaItem[];
  folders: MediaFolder[];

  // Timeline
  tracks: TimelineTrack[];
  timelineStack: { tracks: TimelineTrack[]; label?: string; compoundMediaId?: string; activePipWindowId?: string | null }[];
  selectedClipId: string | null;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  pipWindows: Record<string, PipWindow>;
  sequences: ImageSequence[];
  activePipWindowId: string | null;
  colorClipboard: any | null;
  selectedTransitionClipId: string | null;
  selectedTransitionPosition?: 'in' | 'out' | null;
  selectedKeyframeLines: { clipId: string; time: number }[];

  // Settings
  settings: EditorSettings;

  // Status
  hasUnsavedChanges: boolean;

  // Playback
  currentTime: number;
  isPlaying: boolean;
  isBuffering: boolean;
  isScrubbing: boolean;
  /**
   * CT-2: set while a canvas transform gesture (move/resize/rotate/crop/mask/
   * perspective) is in flight. Unlike isScrubbing (which also silences audio),
   * this ONLY tells the renderer to take the cheap path (skip heavy async FX,
   * allow concurrent renders) — a transform drag during playback must not cut
   * the audio.
   */
  isEditingTransform: boolean;
  perfDowngraded: boolean;
  totalDuration: number;
  playbackSpeed: number;
  playbackDirection: 1 | -1 | 0;
  isMuted: boolean;
  muteTimelineAudio: boolean;
  volume: number;
  inPoint: number | null;
  outPoint: number | null;

  // Markers & Regions
  markers: TimelineMarker[];
  beatMarkers: BeatMarker[];
  exportRegions: ExportRegion[];
  selectedExportRegionId: string | null;

  // Dynamic Speed Stretch
  dynamicStretch: DynamicStretchState;
  selectedSpeedFrame: { clipId: string; frameId: string } | null;

  // Templates
  projectTemplates: ProjectTemplate[];

  // Aspect Ratio
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';

  // Timeline View
  zoomLevel: number;
  scrollLeft: number;

  // Tools
  activeTool: EditorTool;

  // Export
  isExporting: boolean;
  exportFps: number;
  exportWidth: number;
  exportHeight: number;
  showExportModal: boolean;
  showScopes: boolean;
  scopeSettings: ScopeSettings;

  // UI
  showSettingsModal: boolean;
  showTeleprompter: boolean;
  showHelpMenu: boolean;
  showAiSpeedSyncModal: boolean;
  showAutoDuckingModal: boolean;
  showWatermarkRemoverModal: boolean;
  watermarkRemoverTargetClipId: string | null;
  activeHelpSection: string | null;
  useProxies: boolean;
  showProgressBar: boolean;
  progressBarColor: string;
  progressBarHeight: number;
  canvasTransformMode: 'resize' | 'crop';
  workspaceLayout: {
    preset: string;
    leftWidth: number;
    rightWidth: number;
    timelineHeight: number;
  };

  // Recording
  isRecordingVoiceover: boolean;
  recordingTrackId: string | null;

  // Tabs
  activeMediaTab: MediaTab;
  activePropertiesTab: PropertiesTab;

  // Canvas / Stream
  previewCanvas: HTMLCanvasElement | null;
  masterAudioStream: MediaStream | null;

  // Clipboard
  clipboardData: any | null;
  clipboardClip: TimelineClip | null;

  // History
  history: EditorSnapshot[];
  historyIndex: number;

  // Drag/Drop
  draggingClipId: string | null;
  dragPreviewTime: number;
  dragPreviewTrackId: string | null;

  // Transitions
  showTransitionLayer: boolean;

  // Subtitles
  subtitles: SubtitleItem[];
  selectedSubtitleId: string | null;
  subtitleLanguage: string;

  // AI Video
  aiVideoIsGenerating: boolean;
  aiVideoProgress: number;
  aiVideoJobId: string | null;
  aiVideoResultUrl: string | null;

  // Per-ratio framing
  perRatioFramingEnabled: boolean;
  perRatioFraming: Record<string, Record<string, PerRatioFramingEntry>>;

  // Virtual Camera
  virtualCamera: VirtualCameraState;

  // Aspect Ratio Conflict Smart Handler
  aspectRatioConflictData?: AspectRatioConflictData | null;

  // Arrange Mode (card-based clip rearrange view)
  isArrangeMode: boolean;

  // Custom AI FX
  customFxList: CustomFxItem[];
  showCustomFxMakerModal: boolean;
  customFxTargetClipId: string | null;
}

export interface AspectRatioConflictData {
  mediaName: string;
  videoWidth: number;
  videoHeight: number;
  detectedRatio: '16:9' | '9:16' | '1:1' | '4:3';
  currentRatio: '16:9' | '9:16' | '1:1' | '4:3';
}

// ─── Transition ───────────────────────────────────────────────────────────
export interface Transition {
  id?: string;
  name?: string;
  type: string;
  duration: number;
  easing?: string;
  params?: Record<string, any>;
  soundEffect?: string;
  soundVolume?: number;
}

// ─── OpenRouter ───────────────────────────────────────────────────────────
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

// ─── AI Copilot / Workflow Engine ─────────────────────────────────────────
export type AIToolStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'awaiting_confirmation'
  | 'skipped';

export interface AIToolStep {
  // Core identity
  id?: string;
  // toolName is the primary key used throughout the copilot system
  toolName: string;
  // tool is an alias / normalized copy (optional, falls back to toolName)
  tool?: string;
  // Arguments
  args: Record<string, any>;    // always present (default {})
  params?: Record<string, any>; // alias for args (legacy)
  // Execution state (mutated in-place by WorkflowExecutor)
  status?: AIToolStepStatus;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  // Metadata
  description?: string;
  userFriendlyLabel?: string;
  expectation?: string;          // human-readable expected outcome
  rollbackable?: boolean;        // whether this step can be undone
  dependsOn?: string[];
  requiresConfirmation?: boolean;
}

export interface AIWorkflowPlan {
  id?: string;
  steps: AIToolStep[];
  description?: string;
  userIntent?: string;
  estimatedDuration?: number;
  totalSteps?: number;          // convenience count, mirrors steps.length
  prompt?: string;              // original user prompt stored for re-plan
  needsConfirmation?: boolean;  // true if any step requires user confirmation
  destructiveOpsCount?: number; // count of destructive steps
  createdAt?: number;           // plan creation timestamp
}

export interface AIWorkflowReport {
  planId?: string;
  steps: AIToolStep[];          // completed steps with status/result populated
  // These are required by ExecutionStreamer.formatFinalReport
  totalSteps: number;
  successCount: number;
  failedCount?: number;
  skippedCount?: number;
  totalDurationMs: number;
  summary: string;              // human-readable one-liner
  success?: boolean;
  errorMessage?: string;
}

export interface AISelfTestResult {
  testId: string;
  testName: string;            // human-readable name
  name?: string;               // internal alias
  category: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  error?: string;
  details?: string;
  message?: string;            // short human message from the test runner
}

export interface AISelfTestReport {
  runId?: string;
  timestamp?: number;
  results: AISelfTestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDurationMs?: number;
  // Fields always set by AutoTester.run() — required for TestReportGenerator
  durationMs: number;
  passRate: number;            // 0-100 percentage
  summary: string;             // one-line human summary
  byCategory: Record<string, { passed: number; failed: number; total: number }>;
  workingFeatures: string[];   // names of passing features
  notWorkingFeatures: string[];// names of failing features
}

