// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

// Constants
export * from './timelineConstants';
export * from './timelineUtils';
export * from './sfxSynth';

// FIXED: Re-export trackGeometry with all functions
export { 
  getTrackHeight, 
  getTrackTop, 
  getTrackAtY 
} from './trackGeometry';

// FIXED: Add missing utility exports
export { 
  formatCentisecondTime,
  checkOverlapAt,
  generateId
} from './timelineUtils';

// FIXED: Add missing constant exports
export { 
  TRACK_HEADER_WIDTH,
  RULER_HEIGHT
} from './timelineConstants';

// Hooks
export * from './hooks/useTimelineState';
export * from './hooks/useTimelineDrag';
export * from './hooks/useTimelineDrop';
export * from './hooks/useTimelineScroll';
export * from './hooks/useVoiceoverRecording';
export * from './hooks/useTimelineAI';
export * from './hooks/useAudioScrubbing';

// Components
export * from './components/FrameStripOverlay';
export * from './components/WaveformOverlay';
export * from './components/TransitionTarget';
export * from './components/TimelineRuler';
export * from './components/TimelineTrackHeader';
export * from './components/TimelineClipRow';
export * from './components/TimelineModals';
export * from './components/TimelineToolbar';
export * from './components/PlayheadComponents';
export * from './components/PipFloatingWindow';
export * from './components/ArrangeModeOverlay';
