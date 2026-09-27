// ─────────────────────────────────────────────────────────────────────────────
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobilePropertiesSheet.tsx
// ─────────────────────────────────────────────────────────────────────────────

import {
  Move3D,
  Palette,
  Gauge,
  Music,
  Trash2,
  Copy,
  CopyPlus,
  Scissors,
  ChevronDown,
  ChevronRight,
  X,
  History,
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  RotateCcw,
  Type,
  Wand2,
  ArrowLeftRight,
  ImageIcon,
  Loader2,
  Crop,
  Pipette,
  Crosshair,
  Film,
  Layers,
  Check,
  Repeat,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { formatDuration } from '@/utils/mediaHelpers';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useState, useRef, useEffect, useCallback, useMemo, Fragment, lazy, Suspense } from 'react';
import { toast } from 'sonner';
import { TEXT_TEMPLATES, presetToTextAnimationPatch } from '@/utils/textTemplates';
import { Client } from '@gradio/client';
import { getFileFromDB } from '@/utils/projectPersistence';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import {
  normalizeTransition,
  getMaxTransitionDuration,
  TRANSITION_KIND_INFO,
  TRANSITION_EASINGS,
  TRANSITION_SOUND_OPTIONS,
  type TransitionSoundOption,
} from '@/utils/transitionEngine';
import {
  playTransitionSoundPreview,
  synthesizeTransitionSoundWav,
} from '@/timeline/sfxSynth';
import { trackMotion } from '@/utils/motionTracker';
import { compileStoryboard } from '@/utils/storyboardCompiler';
import { analyzeStoryboardWithGemini, refineAudioQueryWithGroq, analyzeMotionGraphicsWithGemini, AIMotionGraphicSuggestion } from '@/utils/aiClient';
import { searchFreesound } from '@/utils/audioSearchClient';
import { aiVocalSeparator } from '@/utils/aiVocalSeparator';
import { analyzeAndDuckAudio } from '@/utils/aiAudioDucking';
const AiSoundDesigner = lazy(() => import('@/components/AiSoundDesigner').then(m => ({ default: m.AiSoundDesigner })));
const AiMotionGraphicsDesigner = lazy(() => import('@/components/AiMotionGraphicsDesigner').then(m => ({ default: m.AiMotionGraphicsDesigner })));
import type { PropertiesTab, ClipKenBurnsSettings, ClipAudioSettings, CornerPoints, VoiceTuneResult } from '@/types';
import { getRampedClipSourceSpan, getSpeedRampEngine, SpeedRampEngine } from '@/utils/speedRamp';
import { analyzeClipsForVocalMatch } from '@/utils/vocalTone';
import { VocalToneSection, type VocalMatchRow } from '@/components/properties/tabs/audio/VocalToneSection';
import type { SpeedRampKeyframe, EasingType, ClipAnimations, PropertyKeyframe } from '@/types';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { calculateAutoColor } from '@/utils/autoColor';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { SequenceProperties } from './SequenceProperties';
import {
  AIMotionGraphicsSection,
  ObjectRemovalPanel,
  MotionEffectsPanel,
  KineticTypographySection,
  AISFXSection,
  BeatSyncSection,
} from './tabs/effects';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';
import { loadBackgroundRemover, cleanupClipBackgroundState, startClipBackgroundAnalysis, subscribeClipBackgroundAnalysis } from '@/utils/aiBackground';
import { loadRVMSession } from '@/utils/rvmMatting';
import PipTab from './tabs/PipTab';
import { ENTER_EXIT_PRESETS } from '@/utils/clipEnterExitEngine';

const KeyframeIcon = ({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button
    onClick={onClick}
    className={`p-1 rounded-md transition-all ${active ? 'text-blue-600 dark:text-blue-400 bg-blue-500/15 shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)]'}`}
    title={active ? "Disable Keyframes (Removes all)" : "Enable Keyframing"}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <polygon points="12 2 22 12 12 22 2 12 12 2" />
    </svg>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper component: 3-Way Color Wheel (Shadows, Midtones, Highlights)
// ─────────────────────────────────────────────────────────────────────────────
interface ColorWheelProps {
  label: string;
  value?: { hue: number; saturation: number; lift: number };
  onChange: (updates: { hue: number; saturation: number; lift: number }) => void;
  accentColor: string;
}

function ColorWheel({ label, value, onChange, accentColor }: ColorWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const hue = value?.hue ?? 0;
  const sat = value?.saturation ?? 0;
  const lift = value?.lift ?? 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons > 0) {
      updateFromPointer(e);
    }
  };

  const updateFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Saturation is percentage of radius
    const maxR = rect.width / 2;
    const newSat = Math.min(100, Math.round((dist / maxR) * 100));

    // Hue angle in degrees (-180 to 180)
    let newHue = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

    onChange({ hue: newHue, saturation: newSat, lift });
  };

  // Convert hue and saturation back to (X, Y) percentages for puck position
  const angleRad = (hue * Math.PI) / 180;
  const radiusPct = sat / 100;
  const puckX = 50 + Math.cos(angleRad) * radiusPct * 50;
  const puckY = 50 + Math.sin(angleRad) * radiusPct * 50;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let newHue = hue;
    let newSat = sat;

    if (e.key === 'ArrowLeft') {
      newHue = (hue - step + 360) % 360;
    } else if (e.key === 'ArrowRight') {
      newHue = (hue + step) % 360;
    } else if (e.key === 'ArrowUp') {
      newSat = Math.min(100, sat + step);
    } else if (e.key === 'ArrowDown') {
      newSat = Math.max(0, sat - step);
    }

    onChange({ hue: newHue, saturation: newSat, lift });
    scheduleSaveSnapshot();
  };

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-[var(--theme-bg-subpanel)] rounded-xl border border-[var(--theme-border)] flex-1 shadow-sm">
      <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--theme-text-primary)]">{label}</span>

      {/* Circle Container */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label={`${label} Color Wheel`}
        aria-valuenow={hue}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuetext={`Hue: ${hue}°, Saturation: ${sat}%`}
        className="w-16 h-16 rounded-full relative cursor-crosshair border border-[var(--theme-border)] shadow-[inset_0_0_6px_rgba(0,0,0,0.6)] select-none touch-none focus:outline-none focus:ring-1 focus:ring-amber-500"
        style={{
          backgroundColor: '#3a3a3a',
          background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)',
        }}
      >
        {/* Soft center overlay to make colors fade to white at center */}
        <div className="absolute inset-0 rounded-full bg-white opacity-40 mix-blend-overlay" />
        {/* Subtle radial shadow to simulate hardware wheels */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />

        {/* Center crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 border border-white/40 rounded-full pointer-events-none" />

        {/* Selected puck */}
        <div
          className="absolute w-2 h-2 bg-white border border-black rounded-full shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75"
          style={{
            left: `${puckX}%`,
            top: `${puckY}%`,
          }}
        />
      </div>

      {/* Hidden aria-live region to announce changes */}
      <div className="sr-only" aria-live="polite">
        {`${label} settings: Hue is ${hue} degrees, Saturation is ${sat}%, Lift is ${lift}%`}
      </div>

      {/* Info labels */}
      <div className="flex justify-between w-full text-[8px] text-[var(--theme-text-muted)] px-0.5 font-mono">
        <span>H: {hue}°</span>
        <span>S: {sat}%</span>
      </div>

      {/* Brightness/Lift Slider */}
      <div className="w-full space-y-1 mt-1 border-t border-[var(--theme-border)]/30 pt-1">
        <div className="flex justify-between text-[8px] text-[var(--theme-text-muted)] font-mono px-0.5">
          <span>Lift</span>
          <span>{lift > 0 ? `+${lift}` : lift}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={lift}
          onChange={(e) => onChange({ hue, saturation: sat, lift: Number(e.target.value) })}
          onMouseUp={() => scheduleSaveSnapshot()}
          onDoubleClick={() => onChange({ hue, saturation: sat, lift: 0 })}
          title="Double-click to reset lift to 0"
          className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
        />
      </div>
    </div>
  );
}

const PRESETS_RATIOS = {
  slowMo: [
    { ratio: 0.0, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.25, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.5, speed: 0.3, easing: 'linear' as const },
    { ratio: 0.75, speed: 1.0, easing: 'linear' as const },
    { ratio: 1.0, speed: 1.0, easing: 'linear' as const },
  ],
  speedUp: [
    { ratio: 0.0, speed: 0.5, easing: 'linear' as const },
    { ratio: 0.4, speed: 0.5, easing: 'linear' as const },
    { ratio: 0.7, speed: 2.0, easing: 'linear' as const },
    { ratio: 1.0, speed: 2.0, easing: 'linear' as const },
  ],
  slowDown: [
    { ratio: 0.0, speed: 2.0, easing: 'linear' as const },
    { ratio: 0.3, speed: 2.0, easing: 'linear' as const },
    { ratio: 0.6, speed: 0.5, easing: 'linear' as const },
    { ratio: 1.0, speed: 0.5, easing: 'linear' as const },
  ],
  flash: [
    { ratio: 0.0, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.35, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.5, speed: 3.5, easing: 'linear' as const },
    { ratio: 0.65, speed: 1.0, easing: 'linear' as const },
    { ratio: 1.0, speed: 1.0, easing: 'linear' as const },
  ],
  cinematic: [
    { ratio: 0.0, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.2, speed: 1.0, easing: 'linear' as const },
    { ratio: 0.4, speed: 0.25, easing: 'linear' as const },
    { ratio: 0.75, speed: 0.25, easing: 'linear' as const },
    { ratio: 1.0, speed: 1.0, easing: 'linear' as const },
  ],
};

export interface PropertiesPanelProps {
  isMobileView?: boolean;
  mobileCategory?: string;
  onMobileClose?: () => void;
}


const MOBILE_SUB_TABS: Record<string, Array<{ id: string; label: string }>> = {
  transform: [
    { id: 'scale', label: 'Scale' },
    { id: 'position', label: 'Position' },
    { id: 'rotation', label: 'Rotation' },
    { id: 'opacity', label: 'Opacity' },
    { id: 'flip', label: 'Flip' },
    { id: 'perspective', label: 'Warp' },
    { id: 'blendMode', label: 'Blend' },
    { id: 'crop', label: 'Crop' },
    { id: 'reframe', label: 'Smart Reframe' },
    { id: 'keyframes', label: 'Keyframes' },
    { id: 'kenBurns', label: 'Ken Burns' },
    { id: 'keying', label: 'Chroma / AI' },
  ],
  color: [
    { id: 'colorBasic', label: 'Basic' },
    { id: 'colorCreative', label: 'Creative' },
    { id: 'colorWheels', label: 'Color Wheels' },
    { id: 'lutGrade', label: 'LUT Grade' },
  ],
  audio: [
    { id: 'audioVolume', label: 'Volume & Pan' },
    { id: 'audioEQ', label: 'Equalizer' },
    { id: 'audioFades', label: 'Fades' },
    { id: 'audioSpeedPitch', label: 'Speed Pitch' },
  ],
  speed: [
    { id: 'speed', label: 'Speed Slider' },
    { id: 'ramping', label: 'Speed Ramping' },
  ],
  mask: [
    { id: 'mask', label: 'Masking & Matte' },
  ],
  text: [
    { id: 'text', label: 'Text & Typography' },
  ],
  effects: [
    { id: 'audioDucking', label: 'AI Auto Ducking' },
    { id: 'soundDesign', label: 'AI Sound Design' },
    { id: 'aiVocalSeparation', label: 'AI Vocal Split' },
    { id: 'audioEnhancements', label: 'AI Voice Enhance' },
    { id: 'audioVocalTune', label: 'AI Voice Tune' },
    { id: 'beatsync', label: 'Beat Sync' },
    { id: 'sfx', label: 'AI SFX' },
    { id: 'designer', label: 'Motion Graphics' },
    { id: 'keying', label: 'Eraser & Chroma' },
    { id: 'motion', label: 'Motion Effects' },
    { id: 'particles', label: 'Particles' },
  ],
  thumbnail: [
    { id: 'thumbnail', label: 'Thumbnail' },
  ],
  history: [
    { id: 'history', label: 'History' },
  ],
};

export function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {

  const {
    tracks,
    selectedClipId,
    selectedClipIds,
    pipWindows,
    activePropertiesTab,
    setActivePropertiesTab,
    updateClip: storeUpdateClip,
    removeClip: storeRemoveClip,
    copyClip,
    duplicateClip,
    splitClip,
    selectedTransitionClipId,
    updateTransition,
    removeTransition,
    addMasterKeyframe,
    deleteMasterKeyframe,
    historyLength,
    historyIndex,
    jumpToHistoryIndex,
    addMedia,
    addTrack,
    addClip,
    mediaLibrary,
    subtitles,
    selectedSubtitleId,
    updateSubtitle,
    deleteSubtitle,
    selectSubtitle,
    colorClipboard,
    copyColorGrade,
    pasteColorGrade,
    applyColorGradeToAll,
    pasteClip,
    clipboardData,
    updatePipWindowStyle,
    updatePipWindowEnterExit,
    updateClipEnterExitAnimation,
    refreshClipPreviews,
  } = useEditorStore(useShallow(s => ({
    tracks: s.tracks,
    selectedClipId: s.selectedClipId,
    selectedClipIds: s.selectedClipIds,
    pipWindows: s.pipWindows,
    activePropertiesTab: s.activePropertiesTab,
    setActivePropertiesTab: s.setActivePropertiesTab,
    updateClip: s.updateClip,
    removeClip: s.removeClip,
    copyClip: s.copyClip,
    pasteClip: s.pasteClip,
    clipboardData: s.clipboardData,
    duplicateClip: s.duplicateClip,
    splitClip: s.splitClip,
    selectedTransitionClipId: s.selectedTransitionClipId,
    updateTransition: s.updateTransition,
    removeTransition: s.removeTransition,
    addMasterKeyframe: s.addMasterKeyframe,
    deleteMasterKeyframe: s.deleteMasterKeyframe,
    historyLength: s.history.length,
    historyIndex: s.historyIndex,
    jumpToHistoryIndex: s.jumpToHistoryIndex,
    addMedia: s.addMedia,
    addTrack: s.addTrack,
    addClip: s.addClip,
    mediaLibrary: s.mediaLibrary,
    subtitles: s.subtitles,
    selectedSubtitleId: s.selectedSubtitleId,
    updateSubtitle: s.updateSubtitle,
    deleteSubtitle: s.deleteSubtitle,
    selectSubtitle: s.selectSubtitle,
    colorClipboard: s.colorClipboard,
    copyColorGrade: s.copyColorGrade,
    pasteColorGrade: s.pasteColorGrade,
    applyColorGradeToAll: s.applyColorGradeToAll,
    updatePipWindowStyle: s.updatePipWindowStyle,
    updatePipWindowEnterExit: s.updatePipWindowEnterExit,
    updateClipEnterExitAnimation: s.updateClipEnterExitAnimation,
    refreshClipPreviews: s.refreshClipPreviews,
  })));

  const [mobileSubTab, setMobileSubTab] = useState<string>('');
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [isClipDetailsOpen, setIsClipDetailsOpen] = useState(true);

  const dynamicStretch = useEditorStore((s) => s.dynamicStretch);
  const startDynamicStretch = useEditorStore((s) => s.startDynamicStretch);
  const confirmDynamicStretchMark = useEditorStore((s) => s.confirmDynamicStretchMark);
  const toggleDynamicStretchLoop = useEditorStore((s) => s.toggleDynamicStretchLoop);
  const applyDynamicStretch = useEditorStore((s) => s.applyDynamicStretch);
  const cancelDynamicStretch = useEditorStore((s) => s.cancelDynamicStretch);
  const setDynamicStretchMaintainDuration = useEditorStore((s) => s.setDynamicStretchMaintainDuration);
  const isPlaying = useEditorStore((s) => s.isPlaying);

  const currentTab = (isMobileView && mobileCategory)
    ? (mobileCategory === 'style' ? 'transform' : mobileCategory === 'ai' ? 'effects' : (mobileCategory as any))
    : activePropertiesTab;

  const isHistoryTab = currentTab === 'history';
  const history = useEditorStore(useShallow(s => isHistoryTab ? s.history : null)) || [];

  useEffect(() => {
    if (isMobileView && mobileCategory) {
      const normalized = mobileCategory === 'style' ? 'transform' : mobileCategory === 'ai' ? 'effects' : mobileCategory;
      setActivePropertiesTab(normalized as any);
      setMobileSubTab('');
    }
  }, [isMobileView, mobileCategory, setActivePropertiesTab]);

  const currentSubTabs = MOBILE_SUB_TABS[currentTab] || [];
  const effectiveSubTab = currentSubTabs.some(t => t.id === mobileSubTab)
    ? mobileSubTab
    : (currentSubTabs[0]?.id || '');

  const isSectionActive = (sectionId: string) => {
    if (!isMobileView) return true;
    if (currentTab === 'mask' || currentTab === 'text') return true;
    if (currentTab === 'speed' && (sectionId === 'ramping' || sectionId === 'presets') && effectiveSubTab === 'ramping') return true;
    return effectiveSubTab === sectionId;
  };

  const isSectionOpen = (sectionId: string) => {
    if (isMobileView) return true;
    return !collapsedSections[sectionId];
  };


  // PERF: this panel is ~7k lines and re-rendering it is expensive. It used to
  // select `s.currentTime`, so it re-rendered on every playback store write and
  // stole main-thread time from the canvas compositor — a major contributor to
  // choppy multi-track playback. The panel only needs the time to display
  // keyframe/animated values, which are perfectly readable at 10 Hz. Event
  // handlers that need an exact time read useEditorStore.getState().currentTime.
  const currentTime = usePlaybackTime(10);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isPickingChromaColor, setIsPickingChromaColor] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [showTunedToast, setShowTunedToast] = useState(false);
  const [voiceTuneResults, setVoiceTuneResults] = useState<VoiceTuneResult[]>([]);
  const [isMatchingVocals, setIsMatchingVocals] = useState(false);
  const [vocalMatchResults, setVocalMatchResults] = useState<VocalMatchRow[]>([]);
  const [vocalMatchError, setVocalMatchError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const { videoElements } = useMediaPlayback(false);

  // Environment variables fallbacks
  // @ts-ignore
  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || '';
  // @ts-ignore
  const envGroqKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY || '';
  // @ts-ignore
  const envFreesoundKey = import.meta.env.VITE_FREESOUND_API_KEY || '';

  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [soundDesignFps, setSoundDesignFps] = useState<number>(1);
  const [freesoundApiKey, setFreesoundApiKey] = useState(() => sessionStorage.getItem('procut_freesound_key') || '');

  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [isDuckingAudio, setIsDuckingAudio] = useState(false);
  const [duckingProgress, setDuckingProgress] = useState(0);
  const [audioAnalyzeProgress, setAudioAnalyzeProgress] = useState('');
  const [soundDesignerCues, setSoundDesignerCues] = useState<any[] | null>(null);
  const [showSoundDesigner, setShowSoundDesigner] = useState(false);

  const [isAnalyzingMotionGraphics, setIsAnalyzingMotionGraphics] = useState(false);
  const [motionGraphicsAnalyzeProgress, setMotionGraphicsAnalyzeProgress] = useState('');

  const [motionGraphicsSuggestions, setMotionGraphicsSuggestions] = useState<AIMotionGraphicSuggestion[] | null>(null);
  const [showMotionGraphicsDesigner, setShowMotionGraphicsDesigner] = useState(false);

  const [isPlayingTransSound, setIsPlayingTransSound] = useState(false);
  const [isAddingTransSound, setIsAddingTransSound] = useState(false);

  const handleAudioDucking = async () => {
    if (!selectedClip || !selectedClip.mediaId) return;
    setIsDuckingAudio(true);
    setDuckingProgress(0);
    
    try {
      // Find all clips currently on the main timeline
      // Also include pip windows if necessary, but we'll stick to main timeline tracks for now.
      const allClips = tracks.flatMap(t => t.clips || []);
      const keyframes = await analyzeAndDuckAudio(selectedClip, allClips, mediaLibrary, 0.3, (p) => {
        setDuckingProgress(Math.round(p));
      });
      
      if (keyframes && keyframes.length > 0) {
        // Apply keyframes
        const updatedAnimations = { ...selectedClip.animations, 'audio.volume': keyframes };
        storeUpdateClip(selectedClip.id, { animations: updatedAnimations });
        toast.success(`Successfully generated ducking volume keyframes based on ${keyframes.length} anchor points.`);
      } else {
        toast.error("No overlapping audio clips with vocals detected. Ducking not required.");
      }
    } catch (e: any) {
      console.error("Error generating audio ducking:", e);
      toast.error("Failed to analyze audio for ducking.");
    } finally {
      setIsDuckingAudio(false);
    }
  };

  const handleAiSoundDesign = async () => {
    if (!selectedClip) return;

    const videoEl = videoElements.get(selectedClip.id);
    if (!videoEl) {
      toast.warning('Video player is not loaded yet. Try seeking or playing first.');
      return;
    }

    setIsAnalyzingAudio(true);
    setAudioAnalyzeProgress('Compiling storyboard...');

    try {
      // 1. Compile storyboard chunks (10s intervals)
      const chunks = await compileStoryboard(
        videoEl,
        selectedClip.trimStart, // Use the local media start time, not the global timeline start time
        selectedClip.duration,
        (progress) => {
          setAudioAnalyzeProgress(`Compiling storyboard ${Math.round(progress * 100)}%`);
        },
        soundDesignFps
      );

      // 2. Analyze each chunk with Gemini 2.0 Flash Vision
      setAudioAnalyzeProgress('Gemini vision analyzing all chunks in parallel...');
      const freesoundToken = freesoundApiKey || sessionStorage.getItem('procut_freesound_key') || envFreesoundKey || undefined;

      const chunkPromises = chunks.map(async (chunk, i) => {
        try {
          const segmentCues = await analyzeStoryboardWithGemini(
            chunk.base64Image,
            chunk.duration,
            aiProvider,
            soundDesignFps
          );
          return segmentCues.map((cue: any) => ({
            ...cue,
            start: cue.start + (i * 10),
            end: cue.end + (i * 10)
          }));
        } catch (err) {
          console.warn('[AI Storyboard] Chunk failed to process, skipping:', err);
          return [];
        }
      });

      const cuesArrays = await Promise.all(chunkPromises);
      const allCues = cuesArrays.flat();

      // 3. Refine queries using Groq (Llama-3) and search Freesound
      setAudioAnalyzeProgress(`Refining ${allCues.length} queries and searching Freesound in parallel...`);
      
      const optionsPromises = allCues.map(async (cue) => {
        let refinedQuery = cue.query;
        let alternatives: string[] = [];
        try {
          const refinedObj = await refineAudioQueryWithGroq(cue.query, cue.type as 'sfx' | 'bgm');
          refinedQuery = refinedObj.keywords;
          alternatives = refinedObj.alternatives;
        } catch (groqErr) {
          console.warn('Groq query refinement failed, falling back to original query:', groqErr);
        }

        const options = await searchFreesound(refinedQuery, freesoundToken, cue.type as 'sfx' | 'bgm');
        return {
          ...cue,
          query: refinedQuery,
          alternatives,
          options
        };
      });

      const cuesWithOptions = await Promise.all(optionsPromises);

      setSoundDesignerCues(cuesWithOptions);
      setShowSoundDesigner(true);
    } catch (e: any) {
      toast.error(`AI Sound Design failed: ${e.message || e}`);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };



  const handleAiMotionGraphicsDesign = async () => {
    if (!selectedClip || !selectedTrack) return;
    
    const videoEl = videoElements.get(selectedClip.id);
    if (!videoEl) {
      toast.error('Video player is not loaded yet. Try seeking or playing first.');
      return;
    }

    setIsAnalyzingMotionGraphics(true);
    setMotionGraphicsAnalyzeProgress('Compiling storyboard...');
    
    try {
      const chunks = await compileStoryboard(
        videoEl,
        selectedClip.trimStart,
        selectedClip.duration,
        (progress) => {
          setMotionGraphicsAnalyzeProgress(`Compiling storyboard ${Math.round(progress * 100)}%`);
        }
      );

      setMotionGraphicsAnalyzeProgress('AI Vision analyzing scene...');
      
      const chunkPromises = chunks.map(async (chunk) => {
        try {
          const suggestions = await analyzeMotionGraphicsWithGemini(
            chunk.base64Image,
            chunk.duration,
            aiProvider
          );
          return suggestions.map((sug: any) => ({
            ...sug,
            start: chunk.startTime + sug.start,
            end: chunk.startTime + sug.end
          }));
        } catch (e) {
          console.error('Error analyzing chunk:', e);
          return [];
        }
      });

      const allCuesArrays = await Promise.all(chunkPromises);
      const allCues = allCuesArrays.flat().sort((a, b) => a.start - b.start);

      setMotionGraphicsSuggestions(allCues);
      setShowMotionGraphicsDesigner(true);
      toast.success("Motion graphics suggested successfully!");
      
    } catch (e: any) {
      console.error(e);
      toast.error(`AI Motion Graphics Design failed: ${e.message || e}`);
    } finally {
      setIsAnalyzingMotionGraphics(false);
    }
  };

  // Find the selected clip (or the first selected clip in multi-selection)
  let selectedClip: any = null;
  let selectedTrack: any = null;
  let isPipClip: boolean = false;
  let parentPipWindowId: string | null = null;

  {
    const primarySelectedId = selectedClipId || (selectedClipIds.length > 0 ? selectedClipIds[0] : null);
    
    // 1. Search main timeline tracks
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === primarySelectedId);
      if (clip) {
        selectedClip = clip;
        selectedTrack = track;
        break;
      }
    }
    
    // 2. Search PIP window tracks
    if (!selectedClip && pipWindows) {
      const pips = pipWindows || {};
      for (const [pipId, pip] of Object.entries(pips)) {
        for (const track of pip.tracks) {
          const clip = track.clips.find((c) => c.id === primarySelectedId);
          if (clip) {
            selectedClip = clip;
            selectedTrack = track;
            isPipClip = true;
            parentPipWindowId = pipId;
            break;
          }
        }
        if (selectedClip) break;
      }
    }
  }

  const [isSeparating, setIsSeparating] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [bgAnalysisStatus, setBgAnalysisStatus] = useState<any>({ status: 'idle', progress: 0, processedFrames: 0, totalFrames: 0 });
  const [showCutoutRefine, setShowCutoutRefine] = useState(false);

  useEffect(() => {
    if (!selectedClip || !selectedClip.aiBackground?.enabled) {
      setBgAnalysisStatus({ status: 'idle', progress: 0, processedFrames: 0, totalFrames: 0 });
      return;
    }
    return subscribeClipBackgroundAnalysis(selectedClip.id, (st) => {
      setBgAnalysisStatus({ ...st });
    });
  }, [selectedClip?.id, selectedClip?.aiBackground?.enabled]);

  const handleAiSeparate = async () => {
    if (!selectedClip || isSeparating) return;
    const mediaItem = mediaLibrary.find((m) => m.id === selectedClip.mediaId);
    const clipUrl = mediaItem?.url;
    if (!clipUrl) return;

    const cleanName = (mediaItem?.name || 'audio').replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
      setIsSeparating(true);
      
      // 1. Retrieve the file binary from IndexedDB (first priority, bypasses sandbox/CORS)
      let audioBlob: Blob | null = null;
      try {
        if (import.meta.env.DEV) console.log('[AI Separation] Retrieving file from IndexedDB for ID:', selectedClip.mediaId);
        const dbFile = await getFileFromDB(selectedClip.mediaId);
        if (dbFile) {
          audioBlob = dbFile;
          if (import.meta.env.DEV) console.log('[AI Separation] Successfully retrieved file binary from IndexedDB:', dbFile.name, dbFile.size);
        }
      } catch (dbErr) {
        console.warn('[AI Separation] Failed to load from IndexedDB, falling back to fetch...', dbErr);
      }

      if (!audioBlob) {
        // Fallback: Fetch the clip's local audio/video file as binary if not in DB
        try {
          if (import.meta.env.DEV) console.log('[AI Separation] Fetching audio source from URL:', clipUrl);
          const fileResponse = await fetch(clipUrl);
          if (!fileResponse.ok) throw new Error(`HTTP error! status: ${fileResponse.status}`);
          audioBlob = await fileResponse.blob();
        } catch (fetchErr: any) {
          console.error('[AI Separation] Failed to fetch media clip binary data from URL:', clipUrl, fetchErr);
          if (clipUrl.startsWith('blob:')) {
            throw new Error('The local file connection has expired. Please re-import/drag this file into the project to refresh its connection.');
          } else {
            throw new Error(`Unable to fetch source file: ${fetchErr.message || 'CORS / offline restriction'}`);
          }
        }
      }

      if (import.meta.env.DEV) console.log('[AI Separation] Decoding audio buffer...');
      const audioCtx = new AudioContext();
      let audioBuffer: AudioBuffer;
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } finally {
        await audioCtx.close();
      }

      if (import.meta.env.DEV) console.log('[AI Separation] Running local Demucs AI separation (WASM/WebGPU)...');
      const { vocals, backgroundMusic } = await aiVocalSeparator.separateAudioBuffer(audioBuffer, (progress) => {
        // You could update a progress state here if you added one to editorStore
        if (import.meta.env.DEV) console.log(`[AI Separation Progress] ${(progress * 100).toFixed(1)}%`);
      });

      if (import.meta.env.DEV) console.log('[AI Separation] Converting stems to Blobs...');
      const vocalsUrl = await aiVocalSeparator.audioBufferToBlobUrl(vocals);
      const instrumentsUrl = await aiVocalSeparator.audioBufferToBlobUrl(backgroundMusic);
      
      const vocalsName = `${cleanName}_Vocals.wav`;
      const instrumentsName = `${cleanName}_Instrumental.wav`;

      // 4. Create new MediaItems for isolated stems
      const vocalsMedia: any = {
        id: `media_vocals_${Date.now()}`,
        name: vocalsName,
        type: 'audio',
        duration: mediaItem?.duration || selectedClip.duration,
        url: vocalsUrl,
        createdAt: Date.now(),
        waveformPeaks: Array.from({ length: 100 }, () => Math.random() * 0.4 + 0.1)
      };

      const instMedia: any = {
        id: `media_inst_${Date.now()}`,
        name: instrumentsName,
        type: 'audio',
        duration: mediaItem?.duration || selectedClip.duration,
        url: instrumentsUrl,
        createdAt: Date.now(),
        waveformPeaks: Array.from({ length: 100 }, () => Math.random() * 0.4 + 0.1)
      };

      // Add to project media bin
      addMedia(vocalsMedia);
      addMedia(instMedia);

      // 5. Place stems on audio tracks
      let audioTracks = tracks.filter(t => t.type === 'audio');
      if (audioTracks.length < 2) {
        addTrack('audio');
        addTrack('audio');
        audioTracks = useEditorStore.getState().tracks.filter(t => t.type === 'audio');
      }

      const track1 = audioTracks[0] || { id: 'A1' };
      const track2 = audioTracks[1] || { id: 'A2' };

      const vocalsClip = {
        id: `clip_vocals_${Date.now()}`,
        mediaId: vocalsMedia.id,
        trackId: track1.id,
        startTime: selectedClip.startTime,
        duration: selectedClip.duration,
        trimStart: selectedClip.trimStart,
        trimEnd: selectedClip.trimEnd,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: selectedClip.speed,
        effects: []
      };

      const instClip = {
        id: `clip_inst_${Date.now()}`,
        mediaId: instMedia.id,
        trackId: track2.id,
        startTime: selectedClip.startTime,
        duration: selectedClip.duration,
        trimStart: selectedClip.trimStart,
        trimEnd: selectedClip.trimEnd,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: selectedClip.speed,
        effects: []
      };

      addClip(vocalsClip);
      addClip(instClip);

      // 6. Update original clip state
      updateClip(selectedClip.id, {
        audioSettings: {
          ...(selectedClip.audioSettings || {
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
          volume: -60,
          muted: true,
          aiVocalSeparation: {
            isProcessed: true,
            isProcessing: false,
            mode: 'original',
            vocalsMediaId: vocalsMedia.id,
            bgmMediaId: instMedia.id,
            vocalsVolume: 100,
            bgmVolume: 100
          }
        }
      });

      scheduleSaveSnapshot?.('AI Stem Separation');
      toast.success('AI Vocal Separation complete! Stems added to timeline.');
    } catch (err: any) {
      console.error('[AI Separation] Error:', err);
      toast.error(`AI Separation failed: ${err.message}`);
    } finally {
      setIsSeparating(false);
    }
  };

  // Find the selected transition.
  // A transition may be stored on either edge — `transitionIn` of the incoming
  // clip or `transitionOut` of the outgoing one — depending on which side the
  // user dropped it. Only checking `transitionIn` (the old behaviour) meant the
  // properties panel appeared empty for half of all transitions.
  let selectedTransitionClip: any = null;
  let selectedTransition: any = null;
  if (selectedTransitionClipId) {
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedTransitionClipId);
      if (clip && (clip.transitionIn || clip.transitionOut)) {
        selectedTransitionClip = clip;
        selectedTransition = clip.transitionIn || clip.transitionOut;
        break;
      }
    }
  }
  const primarySelectedId = selectedClipId || (selectedClipIds.length > 0 ? selectedClipIds[0] : null);

  const updateClip = useCallback((clipId: string, updates: any, options?: { ripple?: boolean }) => {
    storeUpdateClip(clipId, updates, options);
  }, [storeUpdateClip]);

  const removeClip = useCallback((clipId: string) => {
    storeRemoveClip(clipId);
  }, [storeRemoveClip]);

  // Check if a given tab is supported by the clip & track
  const isTabSupportedForClip = useCallback((tab: PropertiesTab, clip: any, track: any): boolean => {
    if (!clip) return tab === 'history' || tab === 'thumbnail';
    if (tab === 'history' || tab === 'thumbnail') return true;
    // PIP tab available when clip is a PIP parent or inside a PIP window
    if (tab === 'pip') return !!(clip.pipWindowIds?.length || isPipClip);
    
    if (track?.type === 'fx' || clip?.fxSettings || clip?.particleSettings) {
      return tab === 'effects' || tab === 'transform';
    }
    
    if (track?.type === 'text' || clip?.textSettings) {
      return tab === 'text' || tab === 'transform' || tab === 'color' || tab === 'effects';
    }
    
    if (track?.type === 'audio' || (!clip?.textSettings && clip?.mediaId?.includes('audio'))) {
      return tab === 'transform' || tab === 'speed' || tab === 'audio' || tab === 'effects';
    }
    
    // Standard video/image clip supports: transform, mask, color, speed, audio, effects
    return tab === 'transform' || tab === 'mask' || tab === 'color' || tab === 'speed' || tab === 'audio' || tab === 'effects';
  }, [isPipClip]);

  const getDefaultTabForClip = useCallback((clip: any, track: any): PropertiesTab => {
    if (track?.type === 'fx' || clip?.fxSettings || clip?.particleSettings) {
      return 'effects';
    }
    if (track?.type === 'text' || clip?.textSettings) {
      return 'text';
    }
    if (track?.type === 'audio') {
      return 'audio';
    }
    return 'transform';
  }, []);

  // Remember user-selected tab and scroll positions so clicking similar clips does not reset view
  const lastActiveClipTab = useRef<PropertiesTab>('transform');
  const lastAutoSwitchedClip = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionsByTab = useRef<Partial<Record<PropertiesTab, number>>>({});

  useEffect(() => {
    if (activePropertiesTab && activePropertiesTab !== 'history') {
      lastActiveClipTab.current = activePropertiesTab;
    }
  }, [activePropertiesTab]);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && currentTab) {
      scrollPositionsByTab.current[currentTab as PropertiesTab] = scrollContainerRef.current.scrollTop;
    }
  }, [currentTab]);

  // Restore scroll position when tab changes
  useEffect(() => {
    if (scrollContainerRef.current && currentTab) {
      const savedScrollTop = scrollPositionsByTab.current[currentTab as PropertiesTab] ?? 0;
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollTop;
        }
      });
    }
  }, [currentTab]);

  // Auto-switch properties panel tabs only when clip selection changes and current tab is not supported
  useEffect(() => {
    if (!primarySelectedId) {
      setActivePropertiesTab('history');
      return;
    }
    if (lastAutoSwitchedClip.current === primarySelectedId) return; // don't override manual tab changes on same clip
    lastAutoSwitchedClip.current = primarySelectedId;

    const targetTab = activePropertiesTab === 'history' ? lastActiveClipTab.current : activePropertiesTab;

    // If the newly selected clip supports the current active tab (e.g. Color, Speed, Effects, Audio, etc.), preserve it!
    if (targetTab && isTabSupportedForClip(targetTab, selectedClip, selectedTrack)) {
      if (activePropertiesTab !== targetTab) {
        setActivePropertiesTab(targetTab);
      }
      return;
    }

    // Otherwise, fallback to the clip's default tab
    const fallbackTab = getDefaultTabForClip(selectedClip, selectedTrack);
    setActivePropertiesTab(fallbackTab);
  }, [primarySelectedId, selectedClip, selectedTrack, activePropertiesTab, isTabSupportedForClip, getDefaultTabForClip, setActivePropertiesTab]);



  const isRamped = selectedClip ? !!(selectedClip.speedRamp && selectedClip.speedRamp.length >= 2) : false;
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 255, 0];
  };

  const sampleCanvasColor = (canvas: HTMLCanvasElement, clientX: number, clientY: number): string => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) * scaleY)));

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '#00ff00';

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return rgbToHex(pixel[0], pixel[1], pixel[2]);
  };

  const autoDetectBackgroundColor = (canvas: HTMLCanvasElement): string | null => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const w = canvas.width;
    const h = canvas.height;
    const margin = Math.max(2, Math.floor(Math.min(w, h) * 0.04));

    // Sample 6 points: 4 corners + top/bottom center
    const coords = [
      [margin, margin],
      [w - margin, margin],
      [margin, h - margin],
      [w - margin, h - margin],
      [Math.floor(w / 2), margin],
      [Math.floor(w / 2), h - margin],
    ];

    let r = 0, g = 0, b = 0;
    coords.forEach(([cx, cy]) => {
      const p = ctx.getImageData(cx, cy, 1, 1).data;
      r += p[0]; g += p[1]; b += p[2];
    });

    return rgbToHex(Math.round(r / coords.length), Math.round(g / coords.length), Math.round(b / coords.length));
  };

  const CHROMA_KEY_PRESETS = [
    { name: 'Green', hex: '#00ff00' },
    { name: 'Blue', hex: '#0000ff' },
    { name: 'Red', hex: '#ff0000' },
    { name: 'White', hex: '#ffffff' },
    { name: 'Black', hex: '#000000' },
    { name: 'Magenta', hex: '#ff00ff' },
  ];

  // ─── Eyedropper Canvas Interaction ──────────────────────────────────
  useEffect(() => {
    if (!isPickingChromaColor) {
      const canvas = useEditorStore.getState().previewCanvas;
      if (canvas) canvas.style.cursor = '';
      return;
    }

    const canvas = useEditorStore.getState().previewCanvas;
    if (!canvas) {
      setIsPickingChromaColor(false);
      toast.error('Preview canvas not ready. Play the video first.');
      return;
    }

    canvas.style.cursor = 'crosshair';
    toast.info('🖱 Click on the preview canvas to pick a color. Press ESC to cancel.', { duration: 4000 });

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const isOnCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;

      // FIX H18: re-read selectedClip from the store at click time so we don't
      // write to a stale clip id if selection changed while the picker was open.
      const liveClip = useEditorStore.getState().selectedClipId
        ? useEditorStore.getState().tracks
            .flatMap(t => t.clips)
            .find(c => c.id === useEditorStore.getState().selectedClipId)
        : null;

      if (isOnCanvas) {
        e.preventDefault();
        e.stopPropagation();
        if (!liveClip) {
          toast.info('Color picking cancelled — no clip selected.');
        } else {
          const color = sampleCanvasColor(canvas, e.clientX, e.clientY);
          const existing = liveClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
          storeUpdateClip(liveClip.id, {
            chromaKey: { ...existing, color }
          });
          scheduleSaveSnapshot('Chroma Color Picked');
          toast.success(`🎨 Color picked: ${color}`);
        }
      } else {
        toast.info('Color picking cancelled');
      }
      setIsPickingChromaColor(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPickingChromaColor(false);
        toast.info('Color picking cancelled');
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      canvas.style.cursor = '';
    };
  }, [isPickingChromaColor, selectedClip?.id, storeUpdateClip]);

  // ─────────────────────────────────────────────────────────────────────────
  // SPEED-RAMP GRAPH INTERACTION (FIXED)
  // -------------------------------------------------------------------------
  // The old implementation had several bugs:
  //  1. It listened for `mousemove`/`mouseup` on `document` and re-subscribed
  //     the listeners on EVERY store update (selectedClip changes identity on
  //     every ramp edit), so events got dropped mid-drag → jerky movement.
  //  2. The graph's X axis was the RAMPED timeline: dragging one keyframe
  //     re-mapped EVERY other keyframe (they slid around and the ramp visibly
  //     changed at points other than the playhead / dragged point), and the
  //     pointer→source conversion through the changing engine meant the
  //     keyframe never stayed under the cursor — the cursor flickered between
  //     `grab` (circle) and `crosshair` (svg) and the curve jittered.
  //  3. Mouse events only — touch (mobile) could not drag keyframes at all.
  //  4. A `click` fired after a drag released over the graph added an
  //     unexpected keyframe (the "ramps other points than I dragged" bug).
  //
  // New implementation:
  //  - The X axis is the clip's covered SOURCE range (trimStart..trimStart+
  //    span), so keyframe positions are a LINEAR function of their sourceTime:
  //    dragging a keyframe moves ONLY that keyframe, the curve updates only
  //    between its neighbours, and the keyframe lands EXACTLY under the
  //    pointer every frame — zero feedback, zero flicker.
  //  - Pointer events + pointer capture on the SVG (mouse/touch/pen all work).
  //  - Handlers read the LATEST clip straight from the store (no stale closure).
  //  - Clicks that immediately follow a drag/click are suppressed so a drag
  //    release can never create a stray keyframe.
  // ─────────────────────────────────────────────────────────────────────────
  const mediaHasAudioSource = (m: (typeof mediaLibrary)[number]) =>
    !!(m.url || (m as unknown as { _fileBlob?: Blob | File | null; _audioBlob?: Blob | File | null })._fileBlob
      || (m as unknown as { _audioBlob?: Blob | File | null })._audioBlob);

  const hasEnoughAudioClips = useMemo(
    () =>
      tracks.flatMap((t) => t.clips).filter((c) => {
        const m = mediaLibrary.find((x) => x.id === c.mediaId);
        return m && mediaHasAudioSource(m);
      }).length >= 2,
    [tracks, mediaLibrary]
  );

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedClipsList = useMemo(() => {
    const ids = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    const list: { clip: any; track: any; media?: any }[] = [];
    for (const track of tracks) {
      for (const c of track.clips) {
        if (ids.includes(c.id)) {
          const media = mediaLibrary.find((m) => m.id === c.mediaId);
          list.push({ clip: c, track, media });
        }
      }
    }
    return list;
  }, [selectedClipIds, selectedClipId, tracks, mediaLibrary]);

  const selectedMediaItem = mediaLibrary.find((m) => m.id === selectedClip?.mediaId);
  const clipDisplayName = selectedClip?.name || selectedMediaItem?.name || 'Project_01.mp4';
  const clipDurationStr = formatDuration(selectedClip?.duration || selectedMediaItem?.duration || 0);
  const clipResolutionStr = selectedMediaItem?.height ? `${selectedMediaItem.height}p` : '1080p';
  const clipAspectStr = selectedMediaItem?.width && selectedMediaItem?.height
    ? (Math.abs(selectedMediaItem.width / selectedMediaItem.height - 16 / 9) < 0.1 ? '16:9' : Math.abs(selectedMediaItem.width / selectedMediaItem.height - 9 / 16) < 0.1 ? '9:16' : '1:1')
    : '16:9';
  const clipMetaSubtitle = `${clipResolutionStr} · ${clipAspectStr} · ${clipDurationStr}`;

  const handleReplaceMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClip) return;
    try {
      const url = URL.createObjectURL(file);
      const newMedia = {
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image',
        url,
        size: file.size,
        duration: 0,
        createdAt: Date.now()
      };
      addMedia(newMedia as any);
      useEditorStore.getState().replaceClipMedia(selectedClip.id, newMedia.id);
      toast.success('Media replaced successfully');
    } catch (err: any) {
      toast.error('Failed to replace media');
    } finally {
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = '';
      }
    }
  };

  const baseTabs: { id: PropertiesTab; label: string; icon: any }[] = [];

  // Always show Text tab first if the clip has textSettings
  if (selectedClip?.textSettings) {
    baseTabs.push({ id: 'text', label: 'Text', icon: Type });
  }

  if (selectedTrack?.type === 'text') {
    if (!baseTabs.some(t => t.id === 'text')) {
      baseTabs.push({ id: 'text', label: 'Text', icon: Type });
    }
    baseTabs.push({ id: 'transform', label: 'Transform', icon: Move3D });
    baseTabs.push({ id: 'color', label: 'Color', icon: Palette });
    baseTabs.push({ id: 'effects', label: 'AI', icon: Sparkles });
  } else if (selectedTrack?.type === 'fx') {
    baseTabs.push({ id: 'effects', label: 'AI', icon: Sparkles });
    baseTabs.push({ id: 'transform', label: 'Transform', icon: Move3D });
  } else {
    // Video / Audio / Image/Text clips on other tracks: full set of tabs
    baseTabs.push({ id: 'transform', label: 'Transform', icon: Move3D });
    baseTabs.push({ id: 'mask', label: 'Mask', icon: Crop });
    baseTabs.push({ id: 'color', label: 'Color', icon: Palette });
    baseTabs.push({ id: 'speed', label: 'Speed', icon: Gauge });
    baseTabs.push({ id: 'audio', label: 'Audio', icon: Music });
    baseTabs.push({ id: 'effects', label: 'AI', icon: Sparkles });
  }

  // Always append History tab
  baseTabs.push({ id: 'history', label: 'History', icon: History });
  baseTabs.push({ id: 'thumbnail', label: 'Thumbnail', icon: ImageIcon });

  // Show PIP tab when the clip is a PIP parent (has pipWindowIds) or is inside a PIP window
  if (selectedClip?.pipWindowIds?.length || isPipClip) {
    baseTabs.push({ id: 'pip', label: 'PIP', icon: Layers });
  }

  const tabs = baseTabs;

  if (selectedTransition && selectedTransitionClip) {
    const norm = normalizeTransition(selectedTransition);
    const alignment = (selectedTransition.params?.alignment as string) || 'center';
    const kindInfo = TRANSITION_KIND_INFO.find((k) => k.kind === norm.kind);
    const supports = (feature: string) => !!kindInfo?.supports.includes(feature as any);

    // Longest transition that still fits between the two neighbouring clips.
    // Exceeding this is what produced the overlapping-window flicker, so the UI
    // caps the slider rather than letting the renderer clamp silently.
    const maxDuration = getMaxTransitionDuration(tracks, selectedTransitionClip.id);


    // Patch helper: merges into params (the store also merges, but doing it here
    // keeps the optimistic UI value consistent).
    const setParam = (key: string, value: any) =>
      updateTransition(selectedTransitionClip.id, {
        params: { ...(selectedTransition.params || {}), [key]: value },
      } as any);

    const directions: Array<{ v: string; label: string }> = [
      { v: 'left', label: 'Left' },
      { v: 'right', label: 'Right' },
      { v: 'up', label: 'Up' },
      { v: 'down', label: 'Down' },
    ];

    const handlePreviewSound = async () => {
      if (!norm.soundEffect || norm.soundEffect === 'none') return;
      setIsPlayingTransSound(true);
      try {
        let customUrl: string | undefined;
        if (norm.soundEffect.startsWith('media:')) {
          const mediaId = norm.soundEffect.replace(/^media:/, '');
          const item = mediaLibrary?.find((m: any) => m.id === mediaId);
          if (item?.url) customUrl = item.url;
        }
        await playTransitionSoundPreview(norm.soundEffect, norm.soundVolume, customUrl);
      } catch (err) {
        console.error('Failed to preview transition sound:', err);
      } finally {
        setIsPlayingTransSound(false);
      }
    };

    const handleAddToTimeline = async () => {
      if (!norm.soundEffect || norm.soundEffect === 'none') {
        toast.warning('Please select a sound effect first');
        return;
      }
      setIsAddingTransSound(true);
      try {
        const transDuration = selectedTransition?.duration ?? 0.5;
        const isTransitionIn = Boolean(
          selectedTransitionClip.transitionIn &&
          (selectedTransitionClip.transitionIn === selectedTransition ||
           selectedTransitionClip.transitionIn.id === selectedTransition.id)
        );
        const cutTime = isTransitionIn
          ? selectedTransitionClip.startTime
          : selectedTransitionClip.startTime + selectedTransitionClip.duration;

        let transStartTime = cutTime - transDuration / 2;
        if (alignment === 'left') {
          transStartTime = cutTime;
        } else if (alignment === 'right') {
          transStartTime = cutTime - transDuration;
        }
        transStartTime = Math.max(0, transStartTime);

        let audioTrack = tracks.find((t: any) => t.type === 'audio');
        if (!audioTrack) {
          addTrack('audio');
          const updatedTracks = useEditorStore.getState().tracks;
          audioTrack = updatedTracks.find((t: any) => t.type === 'audio') || updatedTracks[updatedTracks.length - 1];
        }

        if (norm.soundEffect.startsWith('media:')) {
          const mediaId = norm.soundEffect.replace(/^media:/, '');
          const mediaItem = mediaLibrary?.find((m: any) => m.id === mediaId);
          if (!mediaItem) {
            toast.error('Selected audio media item not found');
            return;
          }
          const clipId = `trans_sfx_${Date.now()}`;
          const clipDuration = Math.min(mediaItem.duration || transDuration, transDuration);
          const newAudioClip = {
            id: clipId,
            mediaId: mediaItem.id,
            trackId: audioTrack.id,
            startTime: transStartTime,
            duration: clipDuration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
            volume: Math.round(norm.soundVolume * 100),
            muted: false,
          };
          addClip(newAudioClip);
          toast.success(`Added "${mediaItem.name}" to audio track`);
        } else {
          const soundOpt = TRANSITION_SOUND_OPTIONS.find((s) => s.id === norm.soundEffect);
          const soundLabel = soundOpt?.label || 'Transition SFX';
          const blob = await synthesizeTransitionSoundWav(norm.soundEffect, transDuration);
          const audioUrl = URL.createObjectURL(blob);
          const mediaId = `trans_sfx_${Date.now()}`;
          const newMediaItem = {
            id: mediaId,
            name: `${soundLabel} (Transition)`,
            type: 'audio' as const,
            duration: transDuration,
            url: audioUrl,
            createdAt: Date.now(),
          };
          try {
            await addMedia(newMediaItem, new File([blob], `${mediaId}.wav`, { type: 'audio/wav' }));
          } catch {
            addMedia(newMediaItem);
          }
          const newAudioClip = {
            id: mediaId,
            mediaId: mediaId,
            trackId: audioTrack.id,
            startTime: transStartTime,
            duration: transDuration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
            volume: Math.round(norm.soundVolume * 100),
            muted: false,
          };
          addClip(newAudioClip);
          toast.success(`Added "${soundLabel}" to audio track`);
        }
      } catch (err: any) {
        console.error('Failed to add transition sound to timeline:', err);
        toast.error('Failed to add transition sound to timeline');
      } finally {
        setIsAddingTransSound(false);
      }
    };


    return (
      <div className={`h-full flex flex-col ${isMobileView ? 'bg-transparent text-white' : 'bg-[var(--theme-bg-subpanel)] border-l border-[var(--theme-border)]'}`}>
        {/* Header */}
        <div className={`p-4 flex items-center justify-between ${isMobileView ? 'border-b border-[var(--theme-border)] shrink-0' : 'border-b border-[var(--theme-border)]'}`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--theme-text-primary)]">Transition Settings</h3>
              <p className="text-[11px] text-[var(--theme-text-muted)] truncate max-w-[180px]">
                {selectedTransition.name || kindInfo?.label || selectedTransition.type}
              </p>
            </div>
          </div>
          <button
            onClick={() => { if (isMobileView && onMobileClose) { onMobileClose(); } else { useEditorStore.getState().selectTransition(null); } }}
            className={`p-1 rounded transition-colors ${isMobileView ? "bg-[var(--theme-bg-subpanel)] text-white/50 hover:text-white hover:bg-[var(--theme-bg-card)]" : "hover:bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-white"}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 p-4 space-y-4 overflow-y-auto ${isMobileView ? "mobile-no-scrollbar" : ""}`}>
          {/* Effect type */}
          <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
            <label className="text-xs text-[var(--theme-text-primary)] font-semibold block">Effect</label>
            <div className="relative">
              <select
                value={norm.kind}
                onChange={(e) => setParam('kind', e.target.value)}
                className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                {TRANSITION_KIND_INFO.map((k) => (
                  <option key={k.kind} value={k.kind}>{k.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Duration */}
          <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-[var(--theme-text-primary)] font-semibold">Duration</label>
              <span className="text-xs font-mono text-purple-300">
                {(selectedTransition?.duration ?? 0.5).toFixed(2)}s
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={Math.max(0.2, maxDuration)}
              step={0.05}
              value={Math.min(selectedTransition?.duration ?? 0.5, Math.max(0.2, maxDuration))}
              onChange={(e) => {
                let val = parseFloat(e.target.value);
                if (val > maxDuration) {
                  val = maxDuration;
                  toast.warning('Transition limited by the length of the adjacent clips');
                }
                updateTransition(selectedTransitionClip.id, { duration: val });
              }}
              className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400 transition-all"
            />
            <div className="flex justify-between text-[9px] text-[var(--theme-text-muted)]">
              <span>0.1s</span>
              <span>max {maxDuration.toFixed(2)}s</span>
            </div>
          </div>

          {/* Alignment */}
          <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
            <label className="text-xs text-[var(--theme-text-primary)] font-semibold block">Alignment</label>
            <div className="relative">
              <select
                value={alignment}
                onChange={(e) => setParam('alignment', e.target.value)}
                className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="center">Center at Cut</option>
                <option value="left">Start at Cut</option>
                <option value="right">End at Cut</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Easing */}
          <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
            <label className="text-xs text-[var(--theme-text-primary)] font-semibold block">Easing</label>
            <div className="relative">
              <select
                value={norm.easing}
                onChange={(e) => updateTransition(selectedTransitionClip.id, { easing: e.target.value })}
                className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                {TRANSITION_EASINGS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Direction — only for effects that travel */}
          {supports('direction') && (
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
              <label className="text-xs text-[var(--theme-text-primary)] font-semibold block">Direction</label>
              <div className="grid grid-cols-4 gap-1">
                {directions.map((d) => (
                  <button
                    key={d.v}
                    onClick={() => setParam('direction', d.v)}
                    className={`py-1.5 text-[10px] rounded border transition-colors ${
                      norm.direction === d.v
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white hover:border-purple-500/50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Zoom direction */}
          {supports('zoomDirection') && (
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
              <label className="text-xs text-[var(--theme-text-primary)] font-semibold block">Zoom</label>
              <div className="grid grid-cols-2 gap-1">
                {['in', 'out'].map((z) => (
                  <button
                    key={z}
                    onClick={() => setParam('zoomDirection', z)}
                    className={`py-1.5 text-[10px] rounded border capitalize transition-colors ${
                      norm.zoomDirection === z
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white hover:border-purple-500/50'
                    }`}
                  >
                    Zoom {z}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Edge softness — wipes only */}
          {supports('softness') && (
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--theme-text-primary)] font-semibold">Edge Softness</label>
                <span className="text-xs font-mono text-purple-300">
                  {Math.round(norm.softness * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={norm.softness}
                onChange={(e) => setParam('softness', parseFloat(e.target.value))}
                className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          )}

          {/* Intensity */}
          {supports('intensity') && (
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--theme-text-primary)] font-semibold">Intensity</label>
                <span className="text-xs font-mono text-purple-300">
                  {Math.round(norm.intensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={norm.intensity}
                onChange={(e) => setParam('intensity', parseFloat(e.target.value))}
                className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          )}

          {/* Sound Effect (SFX) */}
          <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                <label className="text-xs text-[var(--theme-text-primary)] font-semibold">Sound Effect</label>
              </div>
              {norm.soundEffect && norm.soundEffect !== 'none' && (
                <span className="text-[10px] text-purple-300 font-mono">
                  {Math.round(norm.soundVolume * 100)}%
                </span>
              )}
            </div>

            {/* Sound Selector Dropdown */}
            <div className="relative">
              <select
                value={norm.soundEffect}
                onChange={(e) => {
                  const val = e.target.value;
                  updateTransition(selectedTransitionClip.id, {
                    soundEffect: val,
                    params: { ...(selectedTransition.params || {}), soundEffect: val },
                  } as any);
                }}
                className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer pr-8"
              >
                <optgroup label="Preset Sounds">
                  {TRANSITION_SOUND_OPTIONS.map((opt) => {
                    const isRec = opt.recommendedFor?.includes(norm.kind);
                    return (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}{isRec ? ' ★ (Recommended)' : ''}
                      </option>
                    );
                  })}
                </optgroup>
                {mediaLibrary?.some((m: any) => m.type === 'audio') && (
                  <optgroup label="Project Audio Media">
                    {mediaLibrary
                      .filter((m: any) => m.type === 'audio')
                      .map((m: any) => (
                        <option key={`media:${m.id}`} value={`media:${m.id}`}>
                          🎵 {m.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Description / recommendation note */}
            {norm.soundEffect && norm.soundEffect !== 'none' && (
              <div className="space-y-2">
                {(() => {
                  const selectedOpt = TRANSITION_SOUND_OPTIONS.find((s) => s.id === norm.soundEffect);
                  if (selectedOpt) {
                    const isRec = selectedOpt.recommendedFor?.includes(norm.kind);
                    return (
                      <div className="flex items-center justify-between text-[11px] text-[var(--theme-text-muted)]">
                        <span className="truncate max-w-[200px]">{selectedOpt.description}</span>
                        {isRec && (
                          <span className="text-[10px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 shrink-0">
                            Recommended
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Volume slider */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-[11px] text-[var(--theme-text-muted)]">
                    <span>Volume</span>
                    <span className="font-mono text-purple-300">{Math.round(norm.soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={norm.soundVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateTransition(selectedTransitionClip.id, {
                        soundVolume: val,
                        params: { ...(selectedTransition.params || {}), soundVolume: val },
                      } as any);
                    }}
                    className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400 transition-all"
                  />
                </div>

                {/* Action buttons: Audition / Preview + Add to Timeline */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePreviewSound}
                    disabled={isPlayingTransSound}
                    className="flex-1 py-1.5 px-2 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 hover:border-purple-500 text-purple-300 hover:text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Audition sound preview"
                  >
                    {isPlayingTransSound ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToTimeline}
                    disabled={isAddingTransSound}
                    className="flex-1 py-1.5 px-2 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-card)] border border-[var(--theme-border)] hover:border-purple-500/50 text-[var(--theme-text-primary)] hover:text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Add this sound effect to an audio track on the timeline"
                  >
                    {isAddingTransSound ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Add to Track
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => removeTransition(selectedTransitionClip.id)}
            className="w-full py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 mt-4"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Transition
          </button>
        </div>
      </div>
    );
  }

  const selectedSubtitle = subtitles.find(s => s.id === selectedSubtitleId);

  if (selectedSubtitle) {
    return (
      <div className={`h-full flex flex-col ${isMobileView ? "bg-transparent text-white" : "bg-[var(--theme-bg-subpanel)] border-l border-[var(--theme-border)]"}`}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--theme-border)] flex items-center justify-between bg-[var(--theme-bg-subpanel)]/30 shrink-0">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-[var(--theme-text-primary)]">Subtitle Editor</h3>
          </div>
          <button
            onClick={() => deleteSubtitle(selectedSubtitle.id)}
            className="p-1 hover:bg-[var(--theme-bg-subpanel)] rounded text-red-400 hover:text-red-300 transition-colors"
            title="Delete Subtitle"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-thin min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--theme-text-muted)] uppercase font-semibold">Start Time (sec)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedSubtitle.startTime}
                onChange={(e) => {
                  const newStart = Math.max(0, Number(e.target.value));
                  if (newStart >= selectedSubtitle.endTime) {
                    toast.error("Start time must be before end time");
                    return;
                  }
                  updateSubtitle(selectedSubtitle.id, { startTime: newStart });
                }}
                className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded p-2 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--theme-text-muted)] uppercase font-semibold">End Time (sec)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedSubtitle.endTime}
                onChange={(e) => {
                  const newEnd = Number(e.target.value);
                  if (newEnd <= selectedSubtitle.startTime) {
                    toast.error("End time must be after start time");
                    return;
                  }
                  updateSubtitle(selectedSubtitle.id, { endTime: newEnd });
                }}
                className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded p-2 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--theme-text-muted)] uppercase font-semibold">Primary Text (English / Default)</label>
            <textarea
              value={selectedSubtitle.text}
              onChange={(e) => {
                const val = e.target.value;
                updateSubtitle(selectedSubtitle.id, { 
                  text: val,
                  translations: {
                    ...selectedSubtitle.translations,
                    en: val
                  }
                });
              }}
              className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Translations list */}
          <div className="border-t border-[var(--theme-border)]/40 pt-3 space-y-3">
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">Translations</span>
            {selectedSubtitle.translations && Object.entries(selectedSubtitle.translations).map(([lang, val]) => {
              if (lang === 'en') return null;
              return (
                <div key={lang} className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-[var(--theme-text-muted)] uppercase font-semibold">Language: {lang.toUpperCase()}</span>
                  <textarea
                    value={val}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      updateSubtitle(selectedSubtitle.id, {
                        translations: {
                          ...selectedSubtitle.translations,
                          [lang]: newVal
                        }
                      });
                    }}
                    className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded p-2 min-h-[50px] resize-none focus:outline-none focus:border-teal-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="p-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]/20 flex justify-end shrink-0">
          <button
            onClick={() => selectSubtitle(null)}
            className="px-4 py-1.5 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-white rounded text-xs transition-colors"
          >
            Close Subtitle Editor
          </button>
        </div>
      </div>
    );
  }

  if (!selectedClip) {
    if (isMobileView) {
      return (
        <div className="h-full flex flex-col bg-[#121215] text-white">
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3 shrink-0">
            <h3 className="text-sm font-semibold capitalize text-white">
              {tabs.find(t => t.id === currentTab)?.label || mobileCategory || 'Properties'}
            </h3>
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="rounded-full bg-[var(--theme-bg-subpanel)] p-1.5 text-white/70 hover:bg-[var(--theme-bg-card)] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {currentTab === 'history' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-2 mobile-no-scrollbar">
              {history.map((snap, idx) => {
                const isActive = idx === historyIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => jumpToHistoryIndex(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium'
                        : 'bg-[var(--theme-bg-subpanel)] border-transparent text-white/70 hover:text-white hover:bg-[var(--theme-bg-card)]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs truncate block text-white font-medium">{snap.label || 'Action'}</span>
                      <span className="text-[10px] text-[var(--theme-text-primary)]/40 block mt-0.5 font-mono">
                        {idx === 0 ? 'Base State' : `Step ${idx}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Move3D className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-sm font-medium text-[var(--theme-text-primary)]/80">No clip selected</p>
              <p className="text-xs text-[var(--theme-text-primary)]/40 mt-1">Tap a clip on the timeline to edit its properties</p>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className={`h-full flex flex-col ${isMobileView ? "bg-transparent text-white" : "bg-[var(--theme-bg-subpanel)] border-l border-[var(--theme-border)]"}`}>
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[var(--theme-border)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1 bg-[var(--theme-bg-subpanel)]/50">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activePropertiesTab === tab.id;
            return (
              <Fragment key={tab.id}>
                {idx > 0 && <div className="w-px h-5 bg-[var(--theme-bg-subpanel)] self-center shrink-0 mx-1" />}
                <button
                  onClick={() => setActivePropertiesTab(tab.id)}
                  className={`flex-1 py-2.5 px-3 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                    isActive
                      ? 'text-white border-b-2 border-amber-500 bg-[var(--theme-bg-card)]'
                      : 'text-[var(--theme-text-muted)] hover:text-white hover:bg-[var(--theme-bg-card)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              </Fragment>
            );
          })}
        </div>

        {currentTab === 'history' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-[var(--theme-border)] flex items-center justify-between shrink-0 bg-[var(--theme-bg-subpanel)]/30">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Undo/Redo History</span>
              <span className="text-[9px] text-[#8a8a8a] bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded px-1.5 py-0.5 font-mono">
                {historyLength} Actions
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
              {history.map((snap, idx) => {
                const isActive = idx === historyIndex;
                const isFuture = idx > historyIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => jumpToHistoryIndex(idx)}
                    className={`w-full flex items-center gap-3 p-2 rounded text-left transition-all border ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium shadow-md shadow-amber-500/5'
                        : isFuture
                        ? 'bg-[var(--theme-bg-subpanel)]/40 border-transparent text-[var(--theme-text-muted)]/40 hover:text-white hover:bg-[var(--theme-bg-card)]'
                        : 'bg-[var(--theme-bg-subpanel)]/60 border-transparent text-[var(--theme-text-muted)] hover:text-white hover:bg-[var(--theme-bg-card)]'
                    }`}
                  >
                    {/* Visual Line Node */}
                    <div className="relative flex items-center justify-center shrink-0 w-4">
                      {idx < historyLength - 1 && (
                        <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                          isFuture ? 'bg-[var(--theme-bg-subpanel)]/40' : 'bg-amber-500/30'
                        }`} />
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                        isActive
                          ? 'bg-amber-400 border-amber-400 ring-4 ring-amber-500/20 scale-110'
                          : isFuture
                          ? 'bg-transparent border-[var(--theme-border)]'
                          : 'bg-amber-500/40 border-amber-500/80'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs truncate block">{snap.label || 'Action'}</span>
                      <span className="text-[9px] opacity-60 block mt-0.5 font-mono">
                        {idx === 0 ? 'Base State' : `Step ${idx}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <Move3D className="w-10 h-10 text-[#3e3e3e] mx-auto mb-3" />
              <p className="text-sm text-[var(--theme-text-muted)]">No clip selected</p>
              <p className="text-xs text-[var(--theme-text-muted)] mt-1 opacity-60">
                Click a clip on the timeline to edit its properties
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const getClipAbsoluteStartTime = (clipId: string): number => {
    const state = useEditorStore.getState();
    const found = findClipDeep(state, clipId);
    if (found && found.isPip && found.pipId) {
      const pip = (state.pipWindows || {})[found.pipId];
      if (pip) {
        let parentClip = null;
        for (const t of state.tracks) {
          parentClip = t.clips.find(c => c.id === pip.parentClipId);
          if (parentClip) break;
        }
        if (parentClip) {
          return parentClip.startTime + (pip.relativeStartTime || 0) + found.clip.startTime;
        }
      }
    }
    return found?.clip.startTime ?? 0;
  };

  const absoluteStartTime = getClipAbsoluteStartTime(selectedClip.id);
  const localTime = currentTime - absoluteStartTime;
  const animations: ClipAnimations = selectedClip.animations || {};
  const getMasterKeyframes = () => {
    const allTimes = new Set<number>();
    Object.values(animations).forEach((kfList: any) => {
      if (Array.isArray(kfList)) {
        kfList.forEach((k: any) => allTimes.add(k.time));
      }
    });
    return Array.from(allTimes).sort((a, b) => a - b);
  };
  const keyframeTimes = getMasterKeyframes();
  const hasMasterKeyframes = keyframeTimes.length > 0;
  const isOnKeyframe = keyframeTimes.some((t: any) => Math.abs(t - localTime) < 0.05);

  const getPropVal = (base: number, propKey: string) => {
    return getAnimatedValue(
      base,
      currentTime,
      absoluteStartTime,
      animations[propKey]
    );
  };

  const setPropVal = (propKey: string, value: number, baseUpdateObj: any) => {
    if (hasMasterKeyframes) {
      const currentVals: any = {
        transform: {
          x: getPropVal(selectedClip.transform.x, 'transform.x'),
          y: getPropVal(selectedClip.transform.y, 'transform.y'),
          scale: getPropVal(selectedClip.transform.scale, 'transform.scale'),
          rotation: getPropVal(selectedClip.transform.rotation, 'transform.rotation'),
          blendIntensity: getPropVal(selectedClip.transform.blendIntensity ?? 100, 'transform.blendIntensity')
        },
        crop: {
          top: getPropVal(selectedClip.crop?.top || 0, 'crop.top'),
          bottom: getPropVal(selectedClip.crop?.bottom || 0, 'crop.bottom'),
          left: getPropVal(selectedClip.crop?.left || 0, 'crop.left'),
          right: getPropVal(selectedClip.crop?.right || 0, 'crop.right')
        },
        opacity: getPropVal(selectedClip.opacity, 'opacity'),
        audio: {
          volume: getPropVal(selectedClip.audioSettings?.volume ?? 0, 'audio.volume'),
          pan: getPropVal(selectedClip.audioSettings?.pan ?? 0, 'audio.pan'),
        },
        color: {
          temperature: getPropVal(selectedClip.colorFilters?.temperature ?? 0, 'color.temperature'),
          tint: getPropVal(selectedClip.colorFilters?.tint ?? 0, 'color.tint'),
          exposure: getPropVal(selectedClip.colorFilters?.exposure ?? 0, 'color.exposure'),
          contrast: getPropVal(selectedClip.colorFilters?.contrast ?? 100, 'color.contrast'),
          saturation: getPropVal(selectedClip.colorFilters?.saturation ?? 100, 'color.saturation'),
          blur: getPropVal(selectedClip.colorFilters?.blur ?? 0, 'color.blur'),
          fadedFilm: getPropVal(selectedClip.colorFilters?.fadedFilm ?? 0, 'color.fadedFilm'),
          vignette: getPropVal(selectedClip.colorFilters?.vignette ?? 0, 'color.vignette'),
        }
      };

      const keys = propKey.split('.');
      if (keys.length === 1) {
        currentVals[propKey] = value;
      } else if (keys.length === 2) {
        if (!currentVals[keys[0]]) currentVals[keys[0]] = {};
        currentVals[keys[0]][keys[1]] = value;
      }

      addMasterKeyframe(selectedClip.id, localTime, currentVals);
    } else {
      const targetClipIds = selectedClipIds.length > 0 ? selectedClipIds : [selectedClip.id];
      targetClipIds.forEach(id => {
        updateClip(id, baseUpdateObj);
      });
    }
  };

  const handleToggleMasterKeyframe = () => {
    if (isOnKeyframe) {
        const closest = keyframeTimes.find((t: any) => Math.abs(t - localTime) < 0.05);
       if (closest !== undefined) {
         deleteMasterKeyframe(selectedClip.id, closest);
       }
    } else {
        const currentVals = {
          transform: {
            x: getPropVal(selectedClip.transform.x, 'transform.x'),
            y: getPropVal(selectedClip.transform.y, 'transform.y'),
            scale: getPropVal(selectedClip.transform.scale, 'transform.scale'),
            rotation: getPropVal(selectedClip.transform.rotation, 'transform.rotation'),
            blendIntensity: getPropVal(selectedClip.transform.blendIntensity ?? 100, 'transform.blendIntensity')
          },
          crop: {
            top: getPropVal(selectedClip.crop?.top || 0, 'crop.top'),
            bottom: getPropVal(selectedClip.crop?.bottom || 0, 'crop.bottom'),
            left: getPropVal(selectedClip.crop?.left || 0, 'crop.left'),
            right: getPropVal(selectedClip.crop?.right || 0, 'crop.right')
          },
          opacity: getPropVal(selectedClip.opacity, 'opacity'),
          audio: {
            volume: getPropVal(selectedClip.audioSettings?.volume ?? 0, 'audio.volume'),
            pan: getPropVal(selectedClip.audioSettings?.pan ?? 0, 'audio.pan'),
          },
          color: {
            temperature: getPropVal(selectedClip.colorFilters?.temperature ?? 0, 'color.temperature'),
            tint: getPropVal(selectedClip.colorFilters?.tint ?? 0, 'color.tint'),
            exposure: getPropVal(selectedClip.colorFilters?.exposure ?? 0, 'color.exposure'),
            contrast: getPropVal(selectedClip.colorFilters?.contrast ?? 100, 'color.contrast'),
            saturation: getPropVal(selectedClip.colorFilters?.saturation ?? 100, 'color.saturation'),
            blur: getPropVal(selectedClip.colorFilters?.blur ?? 0, 'color.blur'),
            fadedFilm: getPropVal(selectedClip.colorFilters?.fadedFilm ?? 0, 'color.fadedFilm'),
            vignette: getPropVal(selectedClip.colorFilters?.vignette ?? 0, 'color.vignette'),
          }
       };
       addMasterKeyframe(selectedClip.id, localTime, currentVals);
    }
  };

  const defaultColorFilters = {
    temperature: 0,
    tint: 0,
    exposure: 0,
    contrast: 100,
    saturation: 100,
    blur: 0,
    fadedFilm: 0,
    vignette: 0,
  };

  const clipFilters = selectedClip.colorFilters || defaultColorFilters;

  const handleFilterChange = (key: keyof typeof defaultColorFilters, val: number) => {
    if (!selectedClip) return;
    const current = selectedClip.colorFilters || defaultColorFilters;
    setPropVal(`color.${key}`, val, {
      colorFilters: {
        ...current,
        [key]: val,
      },
    });
  };

  const handleFilterReset = (key: keyof typeof defaultColorFilters) => {
    if (!selectedClip) return;
    const current = selectedClip.colorFilters || defaultColorFilters;
    const defaultVal = defaultColorFilters[key];
    setPropVal(`color.${key}`, defaultVal, {
      colorFilters: {
        ...current,
        [key]: defaultVal,
      },
    });
    scheduleSaveSnapshot();
  };

  const defaultAudioSettings: ClipAudioSettings = {
    volume: 0,
    pan: 0,
    fadeIn: 0,
    fadeOut: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    muted: false,
    preservePitch: true,
    pitch: 0,
    voiceFormant: 0,
    tone: 0,
    vocalMatchEnabled: false,
    humanize: false,
    denoise: 0,
    compression: 0,
    deEsser: 0,
    warmth: 0,
  };

  const clipAudio = selectedClip?.audioSettings || defaultAudioSettings;

  const handleResetClipSettings = () => {
    if (!selectedClip) return;
    const store = useEditorStore.getState();
    const updatePayload: any = {
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      crop: undefined,
      effects: [],
      colorFilters: defaultColorFilters,
      audioSettings: defaultAudioSettings,
      fxSettings: undefined,
      motionEffects: undefined,
      particleSettings: undefined,
      aiBackground: undefined,
      chromaKey: undefined,
      lumaKey: undefined,
      objectRemoval: undefined,
      kenBurns: undefined,
      mask: undefined,
      vectorMask: undefined
    };

    if (selectedClip.textSettings) {
      updatePayload.textSettings = {
        ...selectedClip.textSettings,
        fontSize: 72,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fill: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeWidth: 0,
        shadowColor: '#000000',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        backgroundEnabled: false,
        backgroundColor: '#000000',
        backgroundOpacity: 0.5,
        backgroundPadding: 10,
        backgroundBorderRadius: 8
      };
    }

    store.updateClip(selectedClip.id, updatePayload);
    store.saveSnapshot('Reset Clip Settings');
  };

  const handleAudioChange = (key: keyof typeof defaultAudioSettings, val: any) => {
    if (!selectedClip) return;
    const current = selectedClip.audioSettings || defaultAudioSettings;
    if (key === 'volume' || key === 'pan') {
      setPropVal(`audio.${key}`, val, {
        audioSettings: {
          ...current,
          [key]: val,
        },
      });
    } else {
      updateClip(selectedClip.id, {
        audioSettings: {
          ...current,
          [key]: val,
        },
      });
      if (['muted', 'preservePitch', 'humanize', 'vocalSeparation'].includes(key)) {
        scheduleSaveSnapshot();
      }
    }
  };

  const handleAudioReset = (key: keyof typeof defaultAudioSettings) => {
    if (!selectedClip) return;
    const current = selectedClip.audioSettings || defaultAudioSettings;
    const defaultVal = defaultAudioSettings[key];
    if (key === 'volume' || key === 'pan') {
      setPropVal(`audio.${key}`, defaultVal as number, {
        audioSettings: {
          ...current,
          [key]: defaultVal,
        },
      });
    } else {
      updateClip(selectedClip.id, {
        audioSettings: {
          ...current,
          [key]: defaultVal,
        },
      });
    }
    scheduleSaveSnapshot();
  };

  
  const handleNormalizeAudio = async () => {
    if (!selectedClip) return;
    const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === selectedClip.mediaId);
    if (!media?.url) return;

    setIsNormalizing(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(media.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      let peakAmplitude = 0;
      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      
      const startSample = Math.floor(selectedClip.trimStart * sampleRate);
      const hasRamp = selectedClip.speedRamp && selectedClip.speedRamp.length >= 2;
      const mediaDuration = hasRamp
        ? getRampedClipSourceSpan(selectedClip, media?.duration ?? selectedClip.duration * selectedClip.speed)
        : selectedClip.duration * selectedClip.speed;
      const endSample = Math.min(
        Math.floor((selectedClip.trimStart + mediaDuration) * sampleRate),
        audioBuffer.length
      );

      for (let ch = 0; ch < numChannels; ch++) {
        const rawData = audioBuffer.getChannelData(ch);
        const subData = rawData.slice(startSample, endSample);
        for (let i = 0; i < subData.length; i++) {
          const val = Math.abs(subData[i]);
          if (val > peakAmplitude) {
            peakAmplitude = val;
          }
        }
      }

      if (peakAmplitude > 0) {
        const targetDb = -3.0;
        const peakDb = 20 * Math.log10(peakAmplitude);
        const newVolumeDb = targetDb - peakDb;
        const clampedVolume = Math.max(-40, Math.min(12, Math.round(newVolumeDb * 10) / 10));

        const current = selectedClip.audioSettings || defaultAudioSettings;
        updateClip(selectedClip.id, {
          audioSettings: {
            ...current,
            volume: clampedVolume,
          },
        });
        scheduleSaveSnapshot('Normalize Audio');
      }
    } catch (err) {
      console.error('Audio normalization failed:', err);
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleAutoVoiceTune = () => {
    if (selectedClipIds.length < 2) return;

    setIsAnalyzingVoice(true);
    setVoiceTuneResults([]);

    (async () => {
      let audioCtx: AudioContext | null = null;
      try {
        const selectedClips = tracks
          .flatMap((t) => t.clips)
          .filter((c) => selectedClipIds.includes(c.id));

        audioCtx = new AudioContext();
        const clipAnalyses: {
          clip: typeof selectedClips[0];
          rmsDb: number;
          spectralCenter: number;
          zeroCrossRate: number;
          midEnergy: number;
          dynRange: number;
          currentSettings: typeof defaultAudioSettings;
        }[] = [];

        for (const clip of selectedClips) {
          const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === clip.mediaId);
          if (!media?.url) continue;

          let rmsDb = -20;
          let spectralCenter = 0.5;
          let zeroCrossRate = 0.15;
          let midEnergy = 0.5;
          let dynRange = 10;

          try {
            const response = await fetch(media.url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const startSample = Math.floor(clip.trimStart * sampleRate);
            const hasRamp = clip.speedRamp && clip.speedRamp.length >= 2;
            const mediaDuration = hasRamp
              ? getRampedClipSourceSpan(clip, media?.duration ?? clip.duration * (clip.speed ?? 1))
              : clip.duration * (clip.speed ?? 1);
            const endSample = Math.min(
              Math.floor((clip.trimStart + mediaDuration) * sampleRate),
              rawData.length
            );
            const audioWindow = rawData.slice(startSample, endSample);

            if (audioWindow.length > 0) {
              // 1. RMS Loudness
              let sumSquares = 0;
              for (let i = 0; i < audioWindow.length; i++) sumSquares += audioWindow[i] * audioWindow[i];
              const rms = Math.sqrt(sumSquares / audioWindow.length);
              rmsDb = rms > 0 ? 20 * Math.log10(rms) : -60;

              // 2. Spectral energy split: low / mid / high
              const blockSize = 2048;
              let lowEnergy = 0, midEnergySum = 0, highEnergy = 0;
              const numBlocks = Math.floor(audioWindow.length / blockSize);
              for (let b = 0; b < Math.min(numBlocks, 50); b++) {
                const offset = b * blockSize;
                let lo = 0, mi = 0, hi = 0;
                for (let i = 0; i < blockSize - 1; i++) {
                  const s = audioWindow[offset + i];
                  const ns = audioWindow[offset + i + 1];
                  const diff = Math.abs(s - ns);
                  lo += Math.abs(s) * (1 - Math.min(1, diff * 4));
                  hi += Math.abs(s) * Math.min(1, diff * 4);
                  mi += Math.abs(s) * (1 - Math.abs(diff - 0.05) * 10);
                }
                lowEnergy += lo; midEnergySum += mi; highEnergy += hi;
              }
              const totalEnergy = lowEnergy + midEnergySum + highEnergy;
              spectralCenter = totalEnergy > 0 ? highEnergy / totalEnergy : 0.5;
              midEnergy = totalEnergy > 0 ? midEnergySum / totalEnergy : 0.5;

              // 3. Zero-Crossing Rate
              let crossings = 0;
              for (let i = 1; i < audioWindow.length; i++) {
                if ((audioWindow[i] >= 0 && audioWindow[i - 1] < 0) ||
                    (audioWindow[i] < 0 && audioWindow[i - 1] >= 0)) crossings++;
              }
              zeroCrossRate = crossings / audioWindow.length;

              // 4. Dynamic range estimate (peak vs RMS)
              let peak = 0;
              for (let i = 0; i < audioWindow.length; i++) {
                const a = Math.abs(audioWindow[i]);
                if (a > peak) peak = a;
              }
              const peakDb = peak > 0 ? 20 * Math.log10(peak) : -60;
              dynRange = peakDb - rmsDb;
            }
          } catch {
            const hash = clip.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            rmsDb = -25 + (hash % 15);
            spectralCenter = 0.3 + (hash % 7) * 0.06;
            zeroCrossRate = 0.08 + (hash % 10) * 0.015;
            midEnergy = 0.3 + (hash % 5) * 0.08;
            dynRange = 8 + (hash % 10);
          }

          clipAnalyses.push({ clip, rmsDb, spectralCenter, zeroCrossRate, midEnergy, dynRange, currentSettings: clip.audioSettings || defaultAudioSettings });
        }

        if (clipAnalyses.length < 2) return;

        const reference = clipAnalyses[0];
        const results: VoiceTuneResult[] = [];

        for (const analysis of clipAnalyses) {
          const isReference = analysis.clip.id === reference.clip.id;

          // 1. Volume: match RMS loudness
          const loudnessDiff = reference.rmsDb - analysis.rmsDb;
          const volumeAdj = isReference ? 0 : Math.max(-12, Math.min(12, Math.round(loudnessDiff * 0.95)));

          // 2. Bass/Treble: match tone
          const spectralDiff = reference.spectralCenter - analysis.spectralCenter;
          const bassAdj = isReference ? 0 : Math.round(Math.max(-12, Math.min(12, spectralDiff * -45)));
          const trebleAdj = isReference ? 0 : Math.round(Math.max(-12, Math.min(12, spectralDiff * 45)));

          // 3. Mid EQ: match mid presence
          const midDiff = reference.midEnergy - analysis.midEnergy;
          const midAdj = isReference ? 0 : Math.round(Math.max(-12, Math.min(12, midDiff * 60)));

          // 4. Formant / Pitch
          const zcrDiff = reference.zeroCrossRate - analysis.zeroCrossRate;
          const formantAdj = isReference ? 0 : Math.round(Math.max(-75, Math.min(75, zcrDiff * 800)));
          const pitchAdj = isReference ? 0 : Math.round(Math.max(-5, Math.min(5, zcrDiff * 75)));

          // 5. Compression: more dynamic range → apply more compression to even out
          const dynDiff = analysis.dynRange - reference.dynRange;
          const compAdj = isReference ? 0 : Math.max(0, Math.min(80, Math.round(dynDiff * 5)));

          // 6. Warmth: if clip is thinner (less low-mid), add warmth
          const warmthAdj = isReference ? 0 : Math.round(Math.max(-60, Math.min(60, -spectralDiff * 60)));

          // 7. De-Esser: if clip has MORE sibilance than reference, reduce it
          const zcrExcess = analysis.zeroCrossRate - reference.zeroCrossRate;
          const deEsserAdj = isReference ? 0 : Math.max(0, Math.min(70, Math.round(zcrExcess * 500)));

          const cur = analysis.currentSettings;
          const newSettings = {
            ...cur,
            volume:      Math.max(-40, Math.min(12,   cur.volume + volumeAdj)),
            bass:        Math.max(-15, Math.min(15,   (cur.bass || 0) + bassAdj)),
            mid:         Math.max(-15, Math.min(15,   (cur.mid  || 0) + midAdj)),
            treble:      Math.max(-15, Math.min(15,   (cur.treble || 0) + trebleAdj)),
            voiceFormant:Math.max(-100,Math.min(100,  cur.voiceFormant + formantAdj)),
            pitch:       Math.max(-12, Math.min(12,   cur.pitch + pitchAdj)),
            compression: Math.max(0,   Math.min(100,  (cur.compression || 0) + compAdj)),
            warmth:      Math.max(-100,Math.min(100,  (cur.warmth || 0) + warmthAdj)),
            deEsser:     Math.max(0,   Math.min(100,  (cur.deEsser || 0) + deEsserAdj)),
          };

          updateClip(analysis.clip.id, { audioSettings: newSettings });

          // Find clip name
          const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === analysis.clip.mediaId);
          const track = tracks.find((t) => t.clips.some((c) => c.id === analysis.clip.id));
          const clipIndex = track?.clips.findIndex((c) => c.id === analysis.clip.id) ?? 0;
          const clipName = media?.name || `Clip ${clipIndex + 1}`;

          results.push({
            clipId: analysis.clip.id,
            clipName,
            isReference,
            adjustments: {
              volume:       volumeAdj !== 0 ? volumeAdj : undefined,
              bass:         bassAdj   !== 0 ? bassAdj   : undefined,
              mid:          midAdj    !== 0 ? midAdj    : undefined,
              treble:       trebleAdj !== 0 ? trebleAdj : undefined,
              pitch:        pitchAdj  !== 0 ? pitchAdj  : undefined,
              voiceFormant: formantAdj !== 0 ? formantAdj : undefined,
              compression:  compAdj   !== 0 ? compAdj   : undefined,
              warmth:       warmthAdj  !== 0 ? warmthAdj  : undefined,
              deEsser:      deEsserAdj !== 0 ? deEsserAdj : undefined,
            },
          });
        }

        scheduleSaveSnapshot('Auto Voice Tune');
        setVoiceTuneResults(results);
        setShowTunedToast(true);

        setTimeout(() => { setShowTunedToast(false); }, 6000);
      } catch (err) {
        console.error('Auto Voice Tune error:', err);
      } finally {
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(console.error);
        setIsAnalyzingVoice(false);
      }
    })();
  };

  // ─── Vocal Tone: Auto-Match all clips to the first clip's voice ────
  // Analyses the actual vocal fundamental frequency (wave frequency) of the
  // first clip, then stores a per-clip semitone correction on every other
  // clip so all voices match. Manual pitch/tone/formant settings are layered
  // on top and never overwritten (each clip keeps its own settings — the
  // OUTPUT is what gets unified).
  const handleAutoMatchVocals = async () => {
    const state = useEditorStore.getState();
    const storeMedia = state.mediaLibrary;
    const allAudioClips = tracks
      .flatMap((t) => t.clips)
      .filter((c) => {
        const m = storeMedia.find((x) => x.id === c.mediaId);
        return m && mediaHasAudioSource(m);
      });

    const targetClips = selectedClipIds.length >= 2
      ? allAudioClips.filter((c) => selectedClipIds.includes(c.id))
      : allAudioClips;
    if (targetClips.length < 2) {
      setVocalMatchError('Need at least 2 clips with audio on the timeline.');
      setVocalMatchResults([]);
      return;
    }

    setIsMatchingVocals(true);
    setVocalMatchError(null);
    setVocalMatchResults([]);
    try {
      const results = await analyzeClipsForVocalMatch(targetClips, storeMedia);
      let applied = 0;
      for (const r of results) {
        if (r.status !== 'matched' && r.status !== 'reference') continue;
        const clip = targetClips.find((c) => c.id === r.clipId);
        if (!clip) continue;
        const cur = clip.audioSettings || defaultAudioSettings;
        let newSettings = {
          ...cur,
          vocalMatchEnabled: true,
          vocalMatchShift: r.shiftSemitones ?? undefined,
        };
        if (r.eqAdjustments) {
          newSettings = {
            ...newSettings,
            bass: r.eqAdjustments.bass,
            mid: r.eqAdjustments.mid,
            treble: r.eqAdjustments.treble,
            warmth: r.eqAdjustments.warmth,
            compression: r.eqAdjustments.compression,
          };
        }
        updateClip(r.clipId, {
          audioSettings: newSettings,
        });
        applied++;
      }
      if (applied > 0) scheduleSaveSnapshot('Auto Vocal Match');

      const rows: VocalMatchRow[] = results.map((r) => {
        const clip = targetClips.find((c) => c.id === r.clipId);
        const media = storeMedia.find((m) => m.id === clip?.mediaId);
        return {
          clipId: r.clipId,
          clipName: media?.name || clip?.id || 'Clip',
          f0: r.f0,
          shiftSemitones: r.shiftSemitones,
          status: r.status,
        };
      });
      setVocalMatchResults(rows);
      if (applied === 0) {
        setVocalMatchError('Could not detect a clear voice in any clip — try clips with clean speech.');
      }
    } catch (err) {
      console.error('Auto vocal match error:', err);
      setVocalMatchError('Vocal analysis failed — please try again.');
    } finally {
      setIsMatchingVocals(false);
    }
  };

  const handleToggleVocalMatch = (enabled: boolean) => {
    if (!selectedClip) return;
    const current = selectedClip.audioSettings || defaultAudioSettings;
    updateClip(selectedClip.id, {
      audioSettings: { ...current, vocalMatchEnabled: enabled },
    });
    scheduleSaveSnapshot('Vocal Match Toggle');
  };

  // ─── Chroma Key Helpers ─────────────────────────────────────────────
  const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const renderBlendModeSection = () => (
    <div className="space-y-3">
            {/* Blend Mode */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('blendMode') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('blendMode')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
              >
                <span className="font-medium">Blend Mode</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClip(selectedClip.id, { transform: { ...selectedClip.transform, blendMode: 'source-over', blendIntensity: 100 } });
                      scheduleSaveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Blend Mode & Intensity"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                  </div>
                  {collapsedSections['blendMode'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  )}
                </div>
              </button>
              {isSectionOpen('blendMode') && (
                <div className="px-2.5 pb-2.5 space-y-3">
                  <select
                    value={selectedClip.transform.blendMode || 'source-over'}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { transform: { ...selectedClip.transform, blendMode: e.target.value as GlobalCompositeOperation } });
                      scheduleSaveSnapshot();
                    }}
                    className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500 capitalize cursor-pointer"
                  >
                    <optgroup label="Normal (Default)" className="bg-[var(--theme-bg-subpanel)] text-gray-300 font-bold">
                      <option value="source-over">Normal</option>
                    </optgroup>
                    <optgroup label="Darken (Subtract Light)" className="bg-[var(--theme-bg-subpanel)] text-gray-300 font-bold">
                      <option value="multiply">Multiply</option>
                      <option value="darken">Darken</option>
                      <option value="color-burn">Color Burn</option>
                    </optgroup>
                    <optgroup label="Lighten (Add Light)" className="bg-[var(--theme-bg-subpanel)] text-gray-300 font-bold">
                      <option value="screen">Screen</option>
                      <option value="lighten">Lighten</option>
                      <option value="color-dodge">Color Dodge</option>
                    </optgroup>
                    <optgroup label="Contrast (High Dynamic)" className="bg-[var(--theme-bg-subpanel)] text-gray-300 font-bold">
                      <option value="overlay">Overlay</option>
                      <option value="hard-light">Hard Light</option>
                      <option value="soft-light">Soft Light</option>
                    </optgroup>
                    <optgroup label="Inversion & Cancellation" className="bg-[var(--theme-bg-subpanel)] text-gray-300 font-bold">
                      <option value="difference">Difference</option>
                      <option value="exclusion">Exclusion</option>
                    </optgroup>
                    <optgroup label="Color & HSL Grading" className="bg-[var(--theme-bg-subpanel)] text-gray-300 font-bold">
                      <option value="hue">Hue</option>
                      <option value="saturation">Saturation</option>
                      <option value="color">Color</option>
                      <option value="luminosity">Luminosity</option>
                    </optgroup>
                  </select>

                  {/* Blend Intensity Slider with Keyframe Control */}
                  <div className="space-y-1.5 pt-2 border-t border-[var(--theme-border)]/30">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Blend Intensity (%)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--theme-text-muted)]">
                          {Math.round(getPropVal(selectedClip.transform.blendIntensity ?? 100, 'transform.blendIntensity'))}%
                        </span>
                        <KeyframeControl
                          propertyKey="transform.blendIntensity"
                          value={getPropVal(selectedClip.transform.blendIntensity ?? 100, 'transform.blendIntensity')}
                          keyframes={animations['transform.blendIntensity'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['transform.blendIntensity'] || [], time, val, { easing: 'linear' });
                            updateClip(selectedClip.id, { animations: { ...animations, 'transform.blendIntensity': newKf } });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['transform.blendIntensity'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, { animations: { ...animations, 'transform.blendIntensity': newKf } });
                          }}
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={getPropVal(selectedClip.transform.blendIntensity ?? 100, 'transform.blendIntensity')}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPropVal('transform.blendIntensity', val, {
                          transform: { ...selectedClip.transform, blendIntensity: val }
                        });
                      }}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-lg accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
    </div>
  );

  const renderKeyingAndAiSection = () => (
    <div className={`space-y-3 ${!isSectionActive('keying') ? 'hidden' : ''}`}>

            {/* Cutout (AI) - YouTube Create / CapCut Style */}
            <div className="bg-[var(--theme-bg-subpanel)] rounded border border-cyan-500/30 mb-3 shadow-lg shadow-cyan-900/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--theme-text-primary)] flex items-center gap-1.5">
                      Cutout (AI)
                      {selectedClip.aiBackground?.enabled && (
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-medium">ACTIVE</span>
                      )}
                      {selectedClip.aiBackground?.enabled && bgAnalysisStatus?.status === 'analyzing' && (
                        <span className="text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-medium">
                          Caching {bgAnalysisStatus.progress}%
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-[var(--theme-text-muted)]">1-Tap background cutout & trending creator styles</p>
                  </div>
                </div>

                {/* 1-Tap Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const enabled = !selectedClip.aiBackground?.enabled;
                    const existing = selectedClip.aiBackground ?? {
                      enabled: false,
                      mode: 'remove',
                      edgeBlur: 2,
                      choke: -1,
                      blurStrength: 12,
                      strokeColor: '#ffffff',
                      strokeWidth: 4,
                      strokeGlow: false,
                      bgColor: '#121316',
                      modelSelection: 1,
                    };
                    updateClip(selectedClip.id, {
                      aiBackground: { ...existing, enabled }
                    });
                    scheduleSaveSnapshot('Toggle AI Cutout');
                    if (enabled) {
                      loadRVMSession().catch(() => {});
                      const mediaItem = mediaLibrary.find((m) => m.id === selectedClip.mediaId);
                      if (mediaItem && (mediaItem.type === 'video' || (mediaItem.url && mediaItem.url.match(/\.(mp4|webm|mov|mkv)$/i)))) {
                        startClipBackgroundAnalysis(
                          selectedClip.id,
                          mediaItem.url || '',
                          selectedClip.trimStart || 0,
                          selectedClip.duration || 5,
                          existing.modelSelection ?? 1
                        );
                      }
                    } else {
                      cleanupClipBackgroundState(selectedClip.id);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedClip.aiBackground?.enabled ? 'bg-cyan-500' : 'bg-[#333]'}`}
                  role="switch"
                  aria-checked={selectedClip.aiBackground?.enabled || false}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${selectedClip.aiBackground?.enabled ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              {selectedClip.aiBackground?.enabled && (
                <div className="mt-3 pt-3 border-t border-[var(--theme-border)]/40 space-y-3">
                  {/* Mode Selector Chips */}
                  <div>
                    <label className="block text-[10px] text-[var(--theme-text-muted)] font-medium mb-1.5">Cutout Style</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'remove', label: 'Cutout', icon: '✂️', desc: 'Transparent' },
                        { id: 'blur', label: 'Blur BG', icon: '📸', desc: 'Portrait' },
                        { id: 'outline', label: 'Sticker', icon: '✨', desc: 'Outline' },
                        { id: 'color', label: 'Backdrop', icon: '🎨', desc: 'Color' },
                      ].map((preset) => {
                        const currentMode = selectedClip.aiBackground?.mode || 'remove';
                        const isSelected = currentMode === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              const existing = selectedClip.aiBackground!;
                              updateClip(selectedClip.id, {
                                aiBackground: { ...existing, mode: preset.id as any }
                              });
                              scheduleSaveSnapshot(`Set Cutout Mode: ${preset.label}`);
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                                : 'bg-[#222] border-[#333] text-[var(--theme-text-muted)] hover:border-[#444] hover:text-white'
                            }`}
                          >
                            <span className="text-sm mb-0.5">{preset.icon}</span>
                            <span className="text-[10px] font-medium leading-tight">{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode-Specific Controls */}
                  {/* 1. Blur BG Controls */}
                  {(selectedClip.aiBackground.mode === 'blur') && (
                    <div className="bg-[#1e2327] p-2.5 rounded-lg border border-cyan-500/20 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-medium text-[var(--theme-text-secondary)]">Blur Intensity (Bokeh)</span>
                        <span className="font-mono text-cyan-400">{selectedClip.aiBackground.blurStrength ?? 12}px</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={30}
                        step={1}
                        value={selectedClip.aiBackground.blurStrength ?? 12}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateClip(selectedClip.id, {
                            aiBackground: { ...selectedClip.aiBackground!, blurStrength: val }
                          });
                        }}
                        onMouseUp={() => scheduleSaveSnapshot('Change Background Blur')}
                        className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-cyan-500 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* 2. Outline / Sticker Controls */}
                  {(selectedClip.aiBackground.mode === 'outline') && (
                    <div className="bg-[#1e2327] p-2.5 rounded-lg border border-cyan-500/20 space-y-2.5">
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1.5">
                          <span className="font-medium text-[var(--theme-text-secondary)]">Outline Color</span>
                          <span className="text-[9px] font-mono text-[var(--theme-text-muted)]">{selectedClip.aiBackground.strokeColor ?? '#ffffff'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {['#ffffff', '#00f0ff', '#ff007f', '#ffe600', '#00ff66'].map((col) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                updateClip(selectedClip.id, {
                                  aiBackground: { ...selectedClip.aiBackground!, strokeColor: col }
                                });
                                scheduleSaveSnapshot('Change Outline Color');
                              }}
                              className={`w-6 h-6 rounded-full border transition-transform ${
                                (selectedClip.aiBackground?.strokeColor ?? '#ffffff') === col
                                  ? 'scale-110 border-white ring-2 ring-cyan-500/50'
                                  : 'border-[#444] hover:scale-105'
                              }`}
                              style={{ backgroundColor: col }}
                            />
                          ))}
                          <input
                            type="color"
                            value={selectedClip.aiBackground.strokeColor ?? '#ffffff'}
                            onChange={(e) => {
                              updateClip(selectedClip.id, {
                                aiBackground: { ...selectedClip.aiBackground!, strokeColor: e.target.value }
                              });
                              scheduleSaveSnapshot('Change Outline Color Custom');
                            }}
                            className="w-6 h-6 rounded-full bg-transparent border border-[#555] cursor-pointer"
                            title="Custom Color"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="font-medium text-[var(--theme-text-secondary)]">Stroke Width</span>
                          <span className="font-mono text-cyan-400">{selectedClip.aiBackground.strokeWidth ?? 4}px</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={16}
                          step={1}
                          value={selectedClip.aiBackground.strokeWidth ?? 4}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateClip(selectedClip.id, {
                              aiBackground: { ...selectedClip.aiBackground!, strokeWidth: val }
                            });
                          }}
                          onMouseUp={() => scheduleSaveSnapshot('Change Stroke Width')}
                          className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-cyan-500 cursor-pointer"
                        />
                      </div>

                      <label className="flex items-center justify-between cursor-pointer pt-1">
                        <span className="text-[10px] text-[var(--theme-text-secondary)]">Neon Glow Effect</span>
                        <input
                          type="checkbox"
                          checked={selectedClip.aiBackground.strokeGlow ?? false}
                          onChange={(e) => {
                            updateClip(selectedClip.id, {
                              aiBackground: { ...selectedClip.aiBackground!, strokeGlow: e.target.checked }
                            });
                            scheduleSaveSnapshot('Toggle Stroke Glow');
                          }}
                          className="rounded bg-[#2a2a2a] border-[var(--theme-border)] text-cyan-500 focus:ring-0"
                        />
                      </label>
                    </div>
                  )}

                  {/* 3. Backdrop Color Controls */}
                  {(selectedClip.aiBackground.mode === 'color') && (
                    <div className="bg-[#1e2327] p-2.5 rounded-lg border border-cyan-500/20 space-y-2">
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-medium text-[var(--theme-text-secondary)]">Backdrop Color</span>
                        <span className="text-[9px] font-mono text-[var(--theme-text-muted)]">{selectedClip.aiBackground.bgColor ?? '#121316'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[
                          { col: '#121316', label: 'Studio Dark' },
                          { col: '#ffffff', label: 'Clean White' },
                          { col: '#0f172a', label: 'Navy' },
                          { col: '#15803d', label: 'Green Screen' },
                          { col: '#7c3aed', label: 'Creator Purple' },
                        ].map(({ col, label }) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              updateClip(selectedClip.id, {
                                aiBackground: { ...selectedClip.aiBackground!, bgColor: col }
                              });
                              scheduleSaveSnapshot('Change Backdrop Color');
                            }}
                            title={label}
                            className={`w-6 h-6 rounded border transition-transform ${
                              (selectedClip.aiBackground?.bgColor ?? '#121316') === col
                                ? 'scale-110 border-white ring-2 ring-cyan-500/50'
                                : 'border-[#444] hover:scale-105'
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                        <input
                          type="color"
                          value={selectedClip.aiBackground.bgColor ?? '#121316'}
                          onChange={(e) => {
                            updateClip(selectedClip.id, {
                              aiBackground: { ...selectedClip.aiBackground!, bgColor: e.target.value }
                            });
                            scheduleSaveSnapshot('Change Backdrop Color Custom');
                          }}
                          className="w-6 h-6 rounded bg-transparent border border-[#555] cursor-pointer"
                          title="Custom Color"
                        />
                      </div>
                    </div>
                  )}

                  {/* Collapsible Refine Edges Drawer */}
                  <div className="border border-[var(--theme-border)]/40 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCutoutRefine(!showCutoutRefine)}
                      className="w-full flex items-center justify-between p-2 bg-[#222] hover:bg-[#282828] text-[10px] font-medium text-[var(--theme-text-secondary)] transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>⚙️</span> Refine Edges (Fine Tune)
                      </span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">
                        {showCutoutRefine ? '▲ Hide' : '▼ Tweak'}
                      </span>
                    </button>
                    {showCutoutRefine && (
                      <div className="p-2.5 bg-[#1b1b1b] space-y-2.5 border-t border-[var(--theme-border)]/30">
                        {/* Edge Feather */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] mb-1">
                            <span className="text-[var(--theme-text-muted)]">Edge Feather (Softness)</span>
                            <span className="font-mono text-cyan-400">{selectedClip.aiBackground.edgeBlur ?? 2}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={15}
                            step={0.5}
                            value={selectedClip.aiBackground.edgeBlur ?? 2}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateClip(selectedClip.id, {
                                aiBackground: { ...selectedClip.aiBackground!, edgeBlur: val }
                              });
                            }}
                            onMouseUp={() => scheduleSaveSnapshot('Change Edge Feather')}
                            className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-cyan-500 cursor-pointer"
                          />
                        </div>

                        {/* Matte Choke */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] mb-1">
                            <span className="text-[var(--theme-text-muted)]">Matte Choke (Remove Halo)</span>
                            <span className="font-mono text-cyan-400">{selectedClip.aiBackground.choke ?? -1}px</span>
                          </div>
                          <input
                            type="range"
                            min={-8}
                            max={8}
                            step={0.5}
                            value={selectedClip.aiBackground.choke ?? -1}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateClip(selectedClip.id, {
                                aiBackground: { ...selectedClip.aiBackground!, choke: val }
                              });
                            }}
                            onMouseUp={() => scheduleSaveSnapshot('Change Matte Choke')}
                            className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-cyan-500 cursor-pointer"
                          />
                        </div>

                        {/* Spill Suppression */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] mb-1">
                            <span className="text-[var(--theme-text-muted)]">Edge Color Decontaminate</span>
                            <span className="font-mono text-cyan-400">{selectedClip.aiBackground.spillSuppression ?? 0}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={selectedClip.aiBackground.spillSuppression ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateClip(selectedClip.id, {
                                aiBackground: { ...selectedClip.aiBackground!, spillSuppression: val }
                              });
                            }}
                            onMouseUp={() => scheduleSaveSnapshot('Change Spill Suppression')}
                            className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subtle 60 FPS GPU Status Indicator */}
                  <div className="flex items-center justify-between text-[9px] text-[#707070] px-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>RVM Neural Matting (WebGPU/WASM)</span>
                    </span>
                    <span>100% Export Guaranteed</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chroma Key / Green Screen */}
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)]">
              <button
                onClick={() => toggleSection('chromaKey')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium flex items-center gap-2">
                  Chroma Key / Green Screen
                  {selectedClip.chromaKey?.enabled && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>
                  )}
                </span>
                {collapsedSections['chromaKey'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('chromaKey') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Enable Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClip.chromaKey?.enabled || false}
                      onChange={(e) => {
                        const existing = selectedClip.chromaKey ?? { color: '#00ff00', threshold: 30, softness: 10 };
                        updateClip(selectedClip.id, {
                          chromaKey: { ...existing, enabled: e.target.checked }
                        });
                        scheduleSaveSnapshot();
                      }}
                      className="rounded bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-emerald-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[11px] text-[var(--theme-text-primary)]">Enable Chroma Key</span>
                  </label>

                  {selectedClip.chromaKey?.enabled && (
                    <div className="space-y-3">
                      {/* Color Presets */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-medium">Quick Presets</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {CHROMA_KEY_PRESETS.map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => {
                                const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                                updateClip(selectedClip.id, {
                                  chromaKey: { ...existing, color: preset.hex }
                                });
                                scheduleSaveSnapshot();
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] transition-colors ${
                                selectedClip.chromaKey?.color?.toLowerCase() === preset.hex.toLowerCase()
                                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                                  : 'border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:border-[#5e5e5e] hover:text-white'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-[var(--theme-border)]"
                                style={{ backgroundColor: preset.hex }}
                              />
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Active Color + Picker + Eyedropper + Auto-Detect */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-medium">Key Color</span>
                        <div className="flex items-center gap-2 bg-[var(--theme-bg-subpanel)] p-2 rounded border border-[var(--theme-border)]">
                          <div
                            className="w-8 h-8 rounded border border-[var(--theme-border)] shrink-0 shadow-inner"
                            style={{ backgroundColor: selectedClip.chromaKey?.color || '#00ff00' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-[var(--theme-text-primary)] font-mono uppercase tracking-wide">
                              {selectedClip.chromaKey?.color || '#00FF00'}
                            </div>
                            <div className="text-[9px] text-[#6a6a6a]">
                              {(() => {
                                const [r, g, b] = hexToRgb(selectedClip.chromaKey?.color || '#00ff00');
                                return `RGB(${r}, ${g}, ${b})`;
                              })()}
                            </div>
                          </div>

                          <input
                            type="color"
                            value={selectedClip.chromaKey?.color || '#00ff00'}
                            onChange={(e) => {
                              const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                              updateClip(selectedClip.id, {
                                chromaKey: { ...existing, color: e.target.value }
                              });
                            }}
                            onBlur={() => scheduleSaveSnapshot()}
                            className="w-6 h-6 bg-transparent border-0 rounded cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-[var(--theme-border)] [&::-webkit-color-swatch]:rounded"
                          />

                          <button
                            onClick={() => setIsPickingChromaColor(true)}
                            disabled={isPickingChromaColor}
                            className={`p-1.5 rounded transition-colors ${
                              isPickingChromaColor
                                ? 'bg-emerald-500 text-black'
                                : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-white hover:bg-[#4e4e4e]'
                            }`}
                            title="Pick color from canvas"
                          >
                            <Pipette className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              const canvas = useEditorStore.getState().previewCanvas;
                              if (!canvas) {
                                toast.error('Preview canvas not available');
                                return;
                              }
                              const color = autoDetectBackgroundColor(canvas);
                              if (color) {
                                const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                                updateClip(selectedClip.id, {
                                  chromaKey: { ...existing, color }
                                });
                                scheduleSaveSnapshot();
                                toast.success(`Auto-detected: ${color}`);
                              }
                            }}
                            className="p-1.5 bg-[var(--theme-bg-subpanel)] rounded text-[var(--theme-text-muted)] hover:text-white hover:bg-[#4e4e4e] transition-colors"
                            title="Auto-detect background from corners"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Threshold */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[var(--theme-text-primary)]">Threshold</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--theme-text-muted)]">{Math.round(getPropVal(selectedClip.chromaKey?.threshold ?? 30, 'chromaKey.threshold'))}%</span>
                            <KeyframeControl
                              propertyKey="chromaKey.threshold"
                              value={getPropVal(selectedClip.chromaKey?.threshold ?? 30, 'chromaKey.threshold')}
                              keyframes={animations['chromaKey.threshold'] || []}
                              currentTime={localTime}
                              clipId={selectedClip.id}
                              onAddKeyframe={(time, val) => {
                                const newKf = addOrUpdateKeyframe(animations['chromaKey.threshold'] || [], time, val, { easing: 'linear' });
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.threshold': newKf } });
                              }}
                              onRemoveKeyframe={(time) => {
                                const newKf = (animations['chromaKey.threshold'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.threshold': newKf } });
                              }}
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={100}
                          value={getPropVal(selectedClip.chromaKey?.threshold ?? 30, 'chromaKey.threshold')}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                            setPropVal('chromaKey.threshold', val, {
                              chromaKey: { ...existing, threshold: val }
                            });
                          }}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <div className="flex justify-between text-[9px] text-[#5a5a5a]">
                          <span>Precise</span>
                          <span>Lenient</span>
                        </div>
                      </div>

                      {/* Softness */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[var(--theme-text-primary)]">Softness / Spill</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--theme-text-muted)]">{Math.round(getPropVal(selectedClip.chromaKey?.softness ?? 10, 'chromaKey.softness'))}%</span>
                            <KeyframeControl
                              propertyKey="chromaKey.softness"
                              value={getPropVal(selectedClip.chromaKey?.softness ?? 10, 'chromaKey.softness')}
                              keyframes={animations['chromaKey.softness'] || []}
                              currentTime={localTime}
                              clipId={selectedClip.id}
                              onAddKeyframe={(time, val) => {
                                const newKf = addOrUpdateKeyframe(animations['chromaKey.softness'] || [], time, val, { easing: 'linear' });
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.softness': newKf } });
                              }}
                              onRemoveKeyframe={(time) => {
                                const newKf = (animations['chromaKey.softness'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.softness': newKf } });
                              }}
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={getPropVal(selectedClip.chromaKey?.softness ?? 10, 'chromaKey.softness')}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                            setPropVal('chromaKey.softness', val, {
                              chromaKey: { ...existing, softness: val }
                            });
                          }}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                      </div>

                      {/* Spill Suppression */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[var(--theme-text-primary)]">Spill Suppression</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--theme-text-muted)]">{Math.round(getPropVal(selectedClip.chromaKey?.spillSuppression ?? 0, 'chromaKey.spillSuppression'))}%</span>
                            <KeyframeControl
                              propertyKey="chromaKey.spillSuppression"
                              value={getPropVal(selectedClip.chromaKey?.spillSuppression ?? 0, 'chromaKey.spillSuppression')}
                              keyframes={animations['chromaKey.spillSuppression'] || []}
                              currentTime={localTime}
                              clipId={selectedClip.id}
                              onAddKeyframe={(time, val) => {
                                const newKf = addOrUpdateKeyframe(animations['chromaKey.spillSuppression'] || [], time, val, { easing: 'linear' });
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.spillSuppression': newKf } });
                              }}
                              onRemoveKeyframe={(time) => {
                                const newKf = (animations['chromaKey.spillSuppression'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.spillSuppression': newKf } });
                              }}
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={getPropVal(selectedClip.chromaKey?.spillSuppression ?? 0, 'chromaKey.spillSuppression')}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10, spillSuppression: 0, edgeFeather: 0 };
                            setPropVal('chromaKey.spillSuppression', val, {
                              chromaKey: { ...existing, spillSuppression: val }
                            });
                          }}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          title="Reduces green/blue fringe on subject edges"
                          className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <p className="text-[9px] text-[#5a5a5a]">Removes color reflection from subject edges</p>
                      </div>

                      {/* Edge Feather */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[var(--theme-text-primary)]">Edge Feather</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--theme-text-muted)]">{getPropVal(selectedClip.chromaKey?.edgeFeather ?? 0, 'chromaKey.edgeFeather')}px</span>
                            <KeyframeControl
                              propertyKey="chromaKey.edgeFeather"
                              value={getPropVal(selectedClip.chromaKey?.edgeFeather ?? 0, 'chromaKey.edgeFeather')}
                              keyframes={animations['chromaKey.edgeFeather'] || []}
                              currentTime={localTime}
                              clipId={selectedClip.id}
                              onAddKeyframe={(time, val) => {
                                const newKf = addOrUpdateKeyframe(animations['chromaKey.edgeFeather'] || [], time, val, { easing: 'linear' });
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.edgeFeather': newKf } });
                              }}
                              onRemoveKeyframe={(time) => {
                                const newKf = (animations['chromaKey.edgeFeather'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                                updateClip(selectedClip.id, { animations: { ...animations, 'chromaKey.edgeFeather': newKf } });
                              }}
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={20}
                          step={0.5}
                          value={getPropVal(selectedClip.chromaKey?.edgeFeather ?? 0, 'chromaKey.edgeFeather')}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10, spillSuppression: 0, edgeFeather: 0 };
                            setPropVal('chromaKey.edgeFeather', val, {
                              chromaKey: { ...existing, edgeFeather: val }
                            });
                          }}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          title="Softens the edges of the keyed area"
                          className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <p className="text-[9px] text-[#5a5a5a]">Smooths harsh edges for natural compositing</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Luma Key / Luminance Thresholding */}
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)]">
              <button
                onClick={() => toggleSection('lumaKey')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">Luma Key (Luminance)</span>
                {collapsedSections['lumaKey'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('lumaKey') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Enable Luma Key */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClip.lumaKey?.enabled || false}
                      onChange={(e) => {
                        const existing = selectedClip.lumaKey ?? { type: 'light', threshold: 100, softness: 10, enabled: false };
                        updateClip(selectedClip.id, {
                          lumaKey: { ...existing, enabled: e.target.checked }
                        });
                        scheduleSaveSnapshot();
                      }}
                      className="rounded bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[11px] text-[var(--theme-text-primary)]">Enable Luma Key</span>
                  </label>

                  {/* Type Selection */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-[var(--theme-text-muted)]">Key Type</span>
                    <div className="flex gap-2">
                      {(['light', 'dark'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            const existing = selectedClip.lumaKey ?? { enabled: true, type: 'light', threshold: 100, softness: 10 };
                            updateClip(selectedClip.id, {
                              lumaKey: { ...existing, type }
                            });
                            scheduleSaveSnapshot();
                          }}
                          className={`flex-1 py-1 text-[11px] rounded border ${
                            (selectedClip.lumaKey?.type || 'light') === type
                              ? 'bg-[var(--theme-bg-subpanel)] border-amber-500/50 text-white'
                              : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-subpanel)]'
                          } capitalize`}
                        >
                          Key {type === 'light' ? 'Brights' : 'Darks'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Threshold Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Threshold</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--theme-text-muted)]">{Math.round(getPropVal(selectedClip.lumaKey?.threshold ?? 100, 'lumaKey.threshold'))}%</span>
                        <KeyframeControl
                          propertyKey="lumaKey.threshold"
                          value={getPropVal(selectedClip.lumaKey?.threshold ?? 100, 'lumaKey.threshold')}
                          keyframes={animations['lumaKey.threshold'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['lumaKey.threshold'] || [], time, val, { easing: 'linear' });
                            updateClip(selectedClip.id, { animations: { ...animations, 'lumaKey.threshold': newKf } });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['lumaKey.threshold'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, { animations: { ...animations, 'lumaKey.threshold': newKf } });
                          }}
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={getPropVal(selectedClip.lumaKey?.threshold ?? 100, 'lumaKey.threshold')}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const existing = selectedClip.lumaKey ?? { enabled: true, type: 'light', threshold: 100, softness: 10 };
                        setPropVal('lumaKey.threshold', val, {
                          lumaKey: { ...existing, threshold: val }
                        });
                      }}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  {/* Softness Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Softness / Spill</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--theme-text-muted)]">{Math.round(getPropVal(selectedClip.lumaKey?.softness ?? 10, 'lumaKey.softness'))}%</span>
                        <KeyframeControl
                          propertyKey="lumaKey.softness"
                          value={getPropVal(selectedClip.lumaKey?.softness ?? 10, 'lumaKey.softness')}
                          keyframes={animations['lumaKey.softness'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['lumaKey.softness'] || [], time, val, { easing: 'linear' });
                            updateClip(selectedClip.id, { animations: { ...animations, 'lumaKey.softness': newKf } });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['lumaKey.softness'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, { animations: { ...animations, 'lumaKey.softness': newKf } });
                          }}
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={getPropVal(selectedClip.lumaKey?.softness ?? 10, 'lumaKey.softness')}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const existing = selectedClip.lumaKey ?? { enabled: true, type: 'light', threshold: 100, softness: 10 };
                        setPropVal('lumaKey.softness', val, {
                          lumaKey: { ...existing, softness: val }
                        });
                      }}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className={!isSectionActive('motion') ? 'hidden' : ''}><ObjectRemovalPanel selectedClip={selectedClip} /></div>
            <div className={!isSectionActive('motion') ? 'hidden' : ''}><MotionEffectsPanel selectedClip={selectedClip} videoElements={videoElements} /></div>
    </div>
  );

  return (
    <div className={`h-full flex flex-col ${isMobileView ? 'bg-[#121215] text-white' : 'bg-[var(--theme-bg-panel)] border-l border-[var(--theme-border)] text-[var(--theme-text-primary)] transition-colors'}`}>
      {isMobileView ? (
        <>
          {/* Mobile Header */}
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3 shrink-0 bg-[#121215]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize text-white">
                {tabs.find(t => t.id === currentTab)?.label || currentTab}
              </span>
              {selectedClip && (
                <span className="text-[11px] text-[var(--theme-text-primary)]/40 truncate max-w-[150px]">
                  ({selectedClip.name || selectedTrack?.name || 'Clip'})
                </span>
              )}
            </div>
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="rounded-full bg-[var(--theme-bg-subpanel)] p-1.5 text-white/70 hover:bg-[var(--theme-bg-card)] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile Sub-Tabs Horizontal Pill Rail */}
          {currentSubTabs.length > 1 && (
            <div className="border-b border-[var(--theme-border)] overflow-x-auto no-scrollbar touch-pan-x bg-[#17171c] shrink-0">
              <div className="flex px-3 py-2 gap-1.5">
                {currentSubTabs.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setMobileSubTab(st.id)}
                    className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      effectiveSubTab === st.id
                        ? 'bg-amber-500 text-black font-semibold shadow-sm'
                        : 'text-white/70 hover:text-white bg-[var(--theme-bg-subpanel)] active:bg-[var(--theme-bg-card)]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Desktop Tabs Header (Flat Underline Style matching reference image) */}
          <div className="flex overflow-x-auto border-b border-[var(--theme-border)] bg-[var(--theme-bg-panel)] px-3 gap-5 select-none scrollbar-none shrink-0">
            {tabs.map((tab) => {
              const isActive = activePropertiesTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePropertiesTab(tab.id)}
                  className={`py-2.5 text-xs font-semibold relative transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Clip Details Section matching reference image */}
          {currentTab !== 'history' && selectedClip && (
            <div className="border-b border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-3 space-y-2.5">
              {/* Hidden file input for Replace */}
              <input
                ref={replaceFileInputRef}
                type="file"
                className="hidden"
                accept="video/*,audio/*,image/*"
                onChange={handleReplaceMediaFile}
              />

              {/* Section Accordion Title */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsClipDetailsOpen(!isClipDetailsOpen)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[var(--theme-text-primary)] hover:text-blue-500 transition-colors"
                >
                  {isClipDetailsOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  )}
                  <span>Clip Details</span>
                  {selectedClipsList.length > 1 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                      {selectedClipsList.length} clips
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleResetClipSettings}
                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)] rounded-md transition-colors"
                    title="Reset Clip Settings"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => useEditorStore.getState().selectClip(null)}
                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)] rounded-md transition-colors"
                    title="Deselect Clip"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isClipDetailsOpen && (
                <>
                  {/* If Multiple Clips Selected: Display Horizontal Scroll Carousel */}
                  {selectedClipsList.length > 1 ? (
                    <div className="space-y-1.5">
                      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                        {selectedClipsList.map(({ clip: c, media: m }) => {
                          const isPrimary = c.id === selectedClip?.id;
                          const mName = c.name || m?.name || 'Clip';
                          const mDur = formatDuration(c.duration || m?.duration || 0);
                          return (
                            <div
                              key={c.id}
                              onClick={() => useEditorStore.getState().selectClip(c.id)}
                              className={`shrink-0 w-32 p-1.5 rounded-xl border transition-all cursor-pointer bg-[var(--theme-bg-subpanel)] flex flex-col gap-1.5 ${
                                isPrimary
                                  ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-sm'
                                  : 'border-[var(--theme-border)] hover:border-blue-500/40'
                              }`}
                            >
                              <div className="w-full h-16 rounded-lg overflow-hidden bg-black/40 relative flex items-center justify-center">
                                {m?.url && (m.type === 'video' || m.type === 'image') ? (
                                  m.type === 'video' ? (
                                    <video src={m.url} className="w-full h-full object-cover pointer-events-none" />
                                  ) : (
                                    <img src={m.url} alt={mName} className="w-full h-full object-cover pointer-events-none" />
                                  )
                                ) : (
                                  <Film className="w-5 h-5 text-[var(--theme-text-muted)] opacity-50" />
                                )}
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[8px] font-mono text-white">
                                  {mDur}
                                </div>
                              </div>
                              <p className="text-[10px] font-bold text-[var(--theme-text-primary)] truncate">
                                {mName}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Single Clip Preview Card matching reference image */
                    <div className="p-2.5 bg-[var(--theme-bg-subpanel)] rounded-xl border border-[var(--theme-border)] flex items-center gap-3">
                      <div className="w-16 h-12 rounded-lg bg-black/40 overflow-hidden relative shrink-0 border border-[var(--theme-border)] flex items-center justify-center">
                        {selectedMediaItem?.url && (selectedMediaItem.type === 'video' || selectedMediaItem.type === 'image') ? (
                          selectedMediaItem.type === 'video' ? (
                            <video src={selectedMediaItem.url} className="w-full h-full object-cover pointer-events-none" />
                          ) : (
                            <img src={selectedMediaItem.url} alt={clipDisplayName} className="w-full h-full object-cover pointer-events-none" />
                          )
                        ) : (
                          <Film className="w-5 h-5 text-[var(--theme-text-muted)] opacity-50" />
                        )}
                        {selectedClip?.duration > 0 && (
                          <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 rounded text-[7px] font-mono text-white">
                            {formatDuration(selectedClip.duration)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[var(--theme-text-primary)] truncate">
                          {clipDisplayName}
                        </h4>
                        <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5 font-mono">
                          {clipMetaSubtitle}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions Row: [ Replace ] [ Cut ] [ Delete ] [ ... ] */}
                  <div className="relative">
                    <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => replaceFileInputRef.current?.click()}
                        className="py-1.5 px-2 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] hover:border-blue-500/40 rounded-lg text-[11px] font-semibold text-[var(--theme-text-primary)] flex items-center justify-center gap-1 transition-all shadow-sm"
                        title="Replace Media File"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                        <span>Replace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => splitClip(selectedClip.id, currentTime)}
                        className="py-1.5 px-2 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] hover:border-blue-500/40 rounded-lg text-[11px] font-semibold text-[var(--theme-text-primary)] flex items-center justify-center gap-1 transition-all shadow-sm"
                        title="Cut / Split at Playhead"
                      >
                        <Scissors className="w-3.5 h-3.5 text-amber-500" />
                        <span>Cut</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeClip(selectedClip.id)}
                        className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-lg text-[11px] font-semibold text-rose-500 flex items-center justify-center gap-1 transition-all shadow-sm"
                        title="Delete Clip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMoreActions(!showMoreActions)}
                        className={`py-1.5 px-2 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] hover:border-blue-500/40 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center justify-center ${
                          showMoreActions ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'text-[var(--theme-text-muted)]'
                        }`}
                        title="More Clip Actions"
                      >
                        <span>⋯</span>
                      </button>
                    </div>

                    {/* More Actions Popover */}
                    {showMoreActions && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-xl shadow-xl p-1.5 z-30 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            const currentMuted = selectedClip.audioSettings?.muted || false;
                            const newSettings = {
                              ...(selectedClip.audioSettings || { volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0, preservePitch: true, pitch: 0, voiceFormant: 0, tone: 0, humanize: false }),
                              muted: !currentMuted
                            };
                            storeUpdateClip(selectedClip.id, { audioSettings: newSettings });
                            scheduleSaveSnapshot();
                            setShowMoreActions(false);
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-subpanel)] rounded-lg flex items-center gap-2"
                        >
                          {selectedClip.audioSettings?.muted ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-red-500" />}
                          <span>{selectedClip.audioSettings?.muted ? 'Unmute Clip' : 'Mute Clip'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { copyClip('style'); toast.success('Style copied'); setShowMoreActions(false); }}
                          className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-subpanel)] rounded-lg flex items-center gap-2"
                        >
                          <Palette className="w-3.5 h-3.5 text-purple-500" />
                          <span>Copy Style</span>
                        </button>
                        {clipboardData?.clips?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const clipType = clipboardData.type;
                              const pasteType = clipType === 'style-with-position' ? 'style-with-position' : (clipType === 'style-only' ? 'style-only' : 'style');
                              pasteClip(pasteType as any);
                              toast.success('Style pasted');
                              setShowMoreActions(false);
                            }}
                            className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-[var(--theme-bg-subpanel)] rounded-lg flex items-center gap-2"
                          >
                            <Palette className="w-3.5 h-3.5 text-purple-500" />
                            <span>Paste Style</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { duplicateClip(); setShowMoreActions(false); }}
                          className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-subpanel)] rounded-lg flex items-center gap-2"
                        >
                          <CopyPlus className="w-3.5 h-3.5 text-blue-500" />
                          <span>Duplicate Clip</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { copyClip('whole'); toast.success('Clip copied'); setShowMoreActions(false); }}
                          className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-subpanel)] rounded-lg flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                          <span>Copy Clip</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Properties Content */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3"
      >
        <SequenceProperties />
        {currentTab === 'transform' && (() => {
          // Reusing outer component scope helpers: localTime, animations, getPropVal, setPropVal, handleToggleMasterKeyframe
          const keyframeTimes = getMasterKeyframes();
          const hasMasterKeyframes = keyframeTimes.length > 0;
          const isOnKeyframe = keyframeTimes.some((t: any) => Math.abs(t - localTime) < 0.05);

          return (
            <div className="space-y-3">
                            {/* Smart Reframe AI */}
              <div className={`bg-[var(--theme-bg-subpanel)] p-3 rounded border border-cyan-500/30 mb-3 shadow-lg shadow-cyan-900/20 ${!isSectionActive('reframe') ? 'hidden' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-cyan-500/20 rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="14" x="7" y="5" rx="2"/></svg>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold text-[var(--theme-text-primary)]">Smart Reframe</h4>
                    <p className="text-[9px] text-[var(--theme-text-muted)]">Auto-track subject for 9:16</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!selectedClip) return;
                    // Dynamic import to avoid heavy loads if not used
                    const { generateSmartReframeKeyframes } = await import('@/utils/smartReframe');
                    const aspect = useEditorStore.getState().aspectRatio;
                    const newAnimations = generateSmartReframeKeyframes(selectedClip, aspect as any);
                    updateClip(selectedClip.id, { animations: newAnimations });
                    scheduleSaveSnapshot('Smart Reframe');
                  }}
                  className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors shadow-md shadow-cyan-950/50"
                >
                  Analyze & Track
                </button>
              </div>

              {/* Master Keyframes */}
              <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-2.5 ${!isSectionActive('keyframes') ? 'hidden' : ''}`}>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--theme-text-primary)]">Master Keyframes</span>
                  <button
                    onClick={handleToggleMasterKeyframe}
                    className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${
                      isOnKeyframe ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-[var(--theme-bg-subpanel)] text-white hover:bg-[#4a4a4a]'
                    }`}
                  >
                    {!hasMasterKeyframes ? 'Start' : isOnKeyframe ? 'End/Remove' : 'Add'}
                  </button>
                </div>
                {keyframeTimes.length > 0 && (
                  <div className="space-y-1">
                    {keyframeTimes.map((t: any, idx: number) => {
                      const kf = animations['transform.x']?.find((k: any) => Math.abs(k.time - t) < 0.05);
                      const prevKf = idx > 0 ? animations['transform.x']?.find((k: any) => Math.abs(k.time - keyframeTimes[idx - 1]) < 0.05) : null;
                      
                      const isStart = idx === 0 || prevKf?.holdNext;
                      const isEnd = idx === keyframeTimes.length - 1 || kf?.holdNext;
                      
                      let label = 'Point';
                      if (isStart && isEnd) label = 'Single';
                      else if (isStart) label = 'Start';
                      else if (isEnd) label = 'End';

                      return (
                        <div key={t} className={`flex items-center justify-between text-[10px] p-1.5 rounded ${isEnd && idx !== keyframeTimes.length - 1 ? 'bg-[#2a1e1e] border border-red-500/20 mb-2' : 'bg-[var(--theme-bg-subpanel)]'}`}>
                          <span className="text-[var(--theme-text-muted)]">
                            {label} - {t.toFixed(2)}s
                          </span>
                          <button
                            onClick={() => deleteMasterKeyframe(selectedClip.id, t)}
                            className="text-[var(--theme-text-muted)] hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Position */}
              <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('position') ? 'hidden' : ''}`}>
                <button
                  onClick={() => toggleSection('position')}
                  className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
                >
                  <span className="font-medium">Position</span>
                  <div className="flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropVal('transform.x', 0, { transform: { ...selectedClip.transform, x: 0 } });
                        setPropVal('transform.y', 0, { transform: { ...selectedClip.transform, y: 0 } });
                        scheduleSaveSnapshot();
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                      title="Reset Position"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                    </div>
                    {collapsedSections['position'] ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    )}
                  </div>
                </button>
                {isSectionOpen('position') && (
                  <div className="px-2.5 pb-2.5 space-y-4">
                    {/* Position X */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[var(--theme-text-muted)]">X Position</label>
                        <KeyframeControl
                          propertyKey="transform.x"
                          value={getPropVal(selectedClip.transform.x, 'transform.x')}
                          keyframes={animations['transform.x'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['transform.x'] || [], time, val, { easing: 'bezier' });
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.x': newKf }
                            });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['transform.x'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.x': newKf }
                            });
                          }}
                          onUpdateEasing={(time, easing) => {
                            const newKf = (animations['transform.x'] || []).map(k => 
                              Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                            );
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.x': newKf }
                            });
                          }}
                          onJumpToNext={() => {
                            const next = (animations['transform.x'] || []).find(k => k.time > localTime + 0.05);
                            if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                          }}
                          onJumpToPrev={() => {
                            const prev = [...(animations['transform.x'] || [])].reverse().find(k => k.time < localTime - 0.05);
                            if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                          }}
                        />
                      </div>
                      <KeyframeMiniTimeline
                        keyframes={animations['transform.x'] || []}
                        currentTime={localTime}
                        duration={selectedClip.duration}
                        onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                      />
                      <input
                        type="number"
                        value={Math.round(getPropVal(selectedClip.transform.x, 'transform.x'))}
                        onChange={(e) => setPropVal('transform.x', Number(e.target.value), { transform: { ...selectedClip.transform, x: Number(e.target.value) } })}
                        onBlur={() => scheduleSaveSnapshot()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Position Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[var(--theme-text-muted)]">Y Position</label>
                        <KeyframeControl
                          propertyKey="transform.y"
                          value={getPropVal(selectedClip.transform.y, 'transform.y')}
                          keyframes={animations['transform.y'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['transform.y'] || [], time, val, { easing: 'bezier' });
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.y': newKf }
                            });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['transform.y'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.y': newKf }
                            });
                          }}
                          onUpdateEasing={(time, easing) => {
                            const newKf = (animations['transform.y'] || []).map(k => 
                              Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                            );
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.y': newKf }
                            });
                          }}
                          onJumpToNext={() => {
                            const next = (animations['transform.y'] || []).find(k => k.time > localTime + 0.05);
                            if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                          }}
                          onJumpToPrev={() => {
                            const prev = [...(animations['transform.y'] || [])].reverse().find(k => k.time < localTime - 0.05);
                            if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                          }}
                        />
                      </div>
                      <KeyframeMiniTimeline
                        keyframes={animations['transform.y'] || []}
                        currentTime={localTime}
                        duration={selectedClip.duration}
                        onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                      />
                      <input
                        type="number"
                        value={Math.round(getPropVal(selectedClip.transform.y, 'transform.y'))}
                        onChange={(e) => setPropVal('transform.y', Number(e.target.value), { transform: { ...selectedClip.transform, y: Number(e.target.value) } })}
                        onBlur={() => scheduleSaveSnapshot()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Scale */}
              <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('scale') ? 'hidden' : ''}`}>
                <button
                  onClick={() => toggleSection('scale')}
                  className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
                >
                  <span className="font-medium">Scale</span>
                  <div className="flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
                        scheduleSaveSnapshot();
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                      title="Reset Scale"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                    </div>
                    {collapsedSections['scale'] ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    )}
                  </div>
                </button>
                {isSectionOpen('scale') && (
                  <div className="px-2.5 pb-2.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Scale Multiplier</span>
                      <KeyframeControl
                        propertyKey="transform.scale"
                        value={getPropVal(selectedClip.transform.scale, 'transform.scale')}
                        keyframes={animations['transform.scale'] || []}
                        currentTime={localTime}
                        clipId={selectedClip.id}
                        onAddKeyframe={(time, val) => {
                          const newKf = addOrUpdateKeyframe(animations['transform.scale'] || [], time, val, { easing: 'bezier' });
                          updateClip(selectedClip.id, {
                            animations: { ...animations, 'transform.scale': newKf }
                          });
                        }}
                        onRemoveKeyframe={(time) => {
                          const newKf = (animations['transform.scale'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                          updateClip(selectedClip.id, {
                            animations: { ...animations, 'transform.scale': newKf }
                          });
                        }}
                        onUpdateEasing={(time, easing) => {
                          const newKf = (animations['transform.scale'] || []).map(k => 
                            Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                          );
                          updateClip(selectedClip.id, {
                            animations: { ...animations, 'transform.scale': newKf }
                          });
                        }}
                        onJumpToNext={() => {
                          const next = (animations['transform.scale'] || []).find(k => k.time > localTime + 0.05);
                          if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                        }}
                        onJumpToPrev={() => {
                          const prev = [...(animations['transform.scale'] || [])].reverse().find(k => k.time < localTime - 0.05);
                          if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                        }}
                      />
                    </div>
                    <KeyframeMiniTimeline
                      keyframes={animations['transform.scale'] || []}
                      currentTime={localTime}
                      duration={selectedClip.duration}
                      onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={10}
                        max={400}
                        value={getPropVal(selectedClip.transform.scale, 'transform.scale')}
                        title="Double-click to reset to 100%"
                        onChange={(e) => setPropVal('transform.scale', Number(e.target.value), { transform: { ...selectedClip.transform, scale: Number(e.target.value) } })}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => {
                          setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
                          scheduleSaveSnapshot();
                        }}
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <span 
                        className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                        title="Click to cycle common values"
                        onClick={() => {
                          const steps = [10, 25, 50, 75, 100, 150, 200, 300, 400];
                          const cur = getPropVal(selectedClip.transform.scale, 'transform.scale');
                          let next = steps.find(s => s > cur) ?? steps[0];
                          setPropVal('transform.scale', next, { transform: { ...selectedClip.transform, scale: next } });
                          scheduleSaveSnapshot();
                        }}
                      >
                        {Math.round(getPropVal(selectedClip.transform.scale, 'transform.scale'))}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rotation */}
              <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('rotation') ? 'hidden' : ''}`}>
                <button
                  onClick={() => toggleSection('rotation')}
                  className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
                >
                  <span className="font-medium">Rotation</span>
                  <div className="flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
                        setPropVal('transform.rotationX', 0, { transform: { ...selectedClip.transform, rotationX: 0 } });
                        setPropVal('transform.rotationY', 0, { transform: { ...selectedClip.transform, rotationY: 0 } });
                        scheduleSaveSnapshot();
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                      title="Reset Rotation"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                    </div>
                    {collapsedSections['rotation'] ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    )}
                  </div>
                </button>
                {isSectionOpen('rotation') && (
                  <div className="px-2.5 pb-2.5 space-y-3">
                    {/* Rotate X */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[var(--theme-text-muted)]">Rotate X (3D)</label>
                        <KeyframeControl
                          propertyKey="transform.rotationX"
                          value={getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX')}
                          keyframes={animations['transform.rotationX'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['transform.rotationX'] || [], time, val, { easing: 'bezier' });
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotationX': newKf }
                            });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['transform.rotationX'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotationX': newKf }
                            });
                          }}
                          onUpdateEasing={(time, easing) => {
                            const newKf = (animations['transform.rotationX'] || []).map(k => 
                              Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                            );
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotationX': newKf }
                            });
                          }}
                          onJumpToNext={() => {
                            const next = (animations['transform.rotationX'] || []).find(k => k.time > localTime + 0.05);
                            if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                          }}
                          onJumpToPrev={() => {
                            const prev = [...(animations['transform.rotationX'] || [])].reverse().find(k => k.time < localTime - 0.05);
                            if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                          }}
                        />
                      </div>
                      <KeyframeMiniTimeline
                        keyframes={animations['transform.rotationX'] || []}
                        currentTime={localTime}
                        duration={selectedClip.duration}
                        onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX')}
                          title="Double-click to reset to 0°"
                          onChange={(e) => setPropVal('transform.rotationX', Number(e.target.value), { transform: { ...selectedClip.transform, rotationX: Number(e.target.value) } })}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          onDoubleClick={() => {
                            setPropVal('transform.rotationX', 0, { transform: { ...selectedClip.transform, rotationX: 0 } });
                            scheduleSaveSnapshot();
                          }}
                          className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <span 
                          className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                          title="Click to step 45°"
                          onClick={() => {
                            const cur = getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX');
                            let next = cur + 45;
                            if (next > 180) next = -180;
                            setPropVal('transform.rotationX', next, { transform: { ...selectedClip.transform, rotationX: next } });
                            scheduleSaveSnapshot();
                          }}
                        >
                          {Math.round(getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX'))}°
                        </span>
                      </div>
                    </div>

                    {/* Rotate Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[var(--theme-text-muted)]">Rotate Y (3D)</label>
                        <KeyframeControl
                          propertyKey="transform.rotationY"
                          value={getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY')}
                          keyframes={animations['transform.rotationY'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['transform.rotationY'] || [], time, val, { easing: 'bezier' });
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotationY': newKf }
                            });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['transform.rotationY'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotationY': newKf }
                            });
                          }}
                          onUpdateEasing={(time, easing) => {
                            const newKf = (animations['transform.rotationY'] || []).map(k => 
                              Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                            );
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotationY': newKf }
                            });
                          }}
                          onJumpToNext={() => {
                            const next = (animations['transform.rotationY'] || []).find(k => k.time > localTime + 0.05);
                            if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                          }}
                          onJumpToPrev={() => {
                            const prev = [...(animations['transform.rotationY'] || [])].reverse().find(k => k.time < localTime - 0.05);
                            if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                          }}
                        />
                      </div>
                      <KeyframeMiniTimeline
                        keyframes={animations['transform.rotationY'] || []}
                        currentTime={localTime}
                        duration={selectedClip.duration}
                        onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY')}
                          title="Double-click to reset to 0°"
                          onChange={(e) => setPropVal('transform.rotationY', Number(e.target.value), { transform: { ...selectedClip.transform, rotationY: Number(e.target.value) } })}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          onDoubleClick={() => {
                            setPropVal('transform.rotationY', 0, { transform: { ...selectedClip.transform, rotationY: 0 } });
                            scheduleSaveSnapshot();
                          }}
                          className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <span 
                          className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                          title="Click to step 45°"
                          onClick={() => {
                            const cur = getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY');
                            let next = cur + 45;
                            if (next > 180) next = -180;
                            setPropVal('transform.rotationY', next, { transform: { ...selectedClip.transform, rotationY: next } });
                            scheduleSaveSnapshot();
                          }}
                        >
                          {Math.round(getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY'))}°
                        </span>
                      </div>
                    </div>

                    {/* Rotate Z */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[var(--theme-text-muted)]">Rotate Z (3D)</label>
                        <KeyframeControl
                          propertyKey="transform.rotation"
                          value={getPropVal(selectedClip.transform.rotation, 'transform.rotation')}
                          keyframes={animations['transform.rotation'] || []}
                          currentTime={localTime}
                          clipId={selectedClip.id}
                          onAddKeyframe={(time, val) => {
                            const newKf = addOrUpdateKeyframe(animations['transform.rotation'] || [], time, val, { easing: 'bezier' });
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotation': newKf }
                            });
                          }}
                          onRemoveKeyframe={(time) => {
                            const newKf = (animations['transform.rotation'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotation': newKf }
                            });
                          }}
                          onUpdateEasing={(time, easing) => {
                            const newKf = (animations['transform.rotation'] || []).map(k => 
                              Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                            );
                            updateClip(selectedClip.id, {
                              animations: { ...animations, 'transform.rotation': newKf }
                            });
                          }}
                          onJumpToNext={() => {
                            const next = (animations['transform.rotation'] || []).find(k => k.time > localTime + 0.05);
                            if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                          }}
                          onJumpToPrev={() => {
                            const prev = [...(animations['transform.rotation'] || [])].reverse().find(k => k.time < localTime - 0.05);
                            if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                          }}
                        />
                      </div>
                      <KeyframeMiniTimeline
                        keyframes={animations['transform.rotation'] || []}
                        currentTime={localTime}
                        duration={selectedClip.duration}
                        onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={getPropVal(selectedClip.transform.rotation, 'transform.rotation')}
                          title="Double-click to reset to 0°"
                          onChange={(e) => setPropVal('transform.rotation', Number(e.target.value), { transform: { ...selectedClip.transform, rotation: Number(e.target.value) } })}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          onDoubleClick={() => {
                            setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
                            scheduleSaveSnapshot();
                          }}
                          className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <span 
                          className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                          title="Click to step 45°"
                          onClick={() => {
                            const cur = getPropVal(selectedClip.transform.rotation ?? 0, 'transform.rotation');
                            let next = cur + 45;
                            if (next > 180) next = -180;
                            setPropVal('transform.rotation', next, { transform: { ...selectedClip.transform, rotation: next } });
                            scheduleSaveSnapshot();
                          }}
                        >
                          {Math.round(getPropVal(selectedClip.transform.rotation, 'transform.rotation'))}°
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Opacity */}
              <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('opacity') ? 'hidden' : ''}`}>
                <button
                  onClick={() => toggleSection('opacity')}
                  className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
                >
                  <span className="font-medium">Opacity</span>
                  <div className="flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropVal('opacity', 1, { opacity: 1 });
                        scheduleSaveSnapshot();
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                      title="Reset Opacity"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                    </div>
                    {collapsedSections['opacity'] ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                    )}
                  </div>
                </button>
                {isSectionOpen('opacity') && (
                  <div className="px-2.5 pb-2.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Opacity Value</span>
                      <KeyframeControl
                        propertyKey="opacity"
                        value={getPropVal(selectedClip.opacity ?? 1, 'opacity')}
                        keyframes={animations['opacity'] || []}
                        currentTime={localTime}
                        clipId={selectedClip.id}
                        onAddKeyframe={(time, val) => {
                          const newKf = addOrUpdateKeyframe(animations['opacity'] || [], time, val, { easing: 'bezier' });
                          updateClip(selectedClip.id, {
                            animations: { ...animations, opacity: newKf }
                          });
                        }}
                        onRemoveKeyframe={(time) => {
                          const newKf = (animations['opacity'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                          updateClip(selectedClip.id, {
                            animations: { ...animations, opacity: newKf }
                          });
                        }}
                        onUpdateEasing={(time, easing) => {
                          const newKf = (animations['opacity'] || []).map(k => 
                            Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                          );
                          updateClip(selectedClip.id, {
                            animations: { ...animations, opacity: newKf }
                          });
                        }}
                        onJumpToNext={() => {
                          const next = (animations['opacity'] || []).find(k => k.time > localTime + 0.05);
                          if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                        }}
                        onJumpToPrev={() => {
                          const prev = [...(animations['opacity'] || [])].reverse().find(k => k.time < localTime - 0.05);
                          if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                        }}
                      />
                    </div>
                    <KeyframeMiniTimeline
                      keyframes={animations['opacity'] || []}
                      currentTime={localTime}
                      duration={selectedClip.duration}
                      onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={getPropVal(selectedClip.opacity ?? 1, 'opacity')}
                        title="Double-click to reset to 100%"
                        onChange={(e) => setPropVal('opacity', Number(e.target.value), { opacity: Number(e.target.value) })}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => {
                          setPropVal('opacity', 1, { opacity: 1 });
                          scheduleSaveSnapshot();
                        }}
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <span 
                        className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                        title="Click to cycle values"
                        onClick={() => {
                          const steps = [0, 25, 50, 75, 100];
                          const cur = Math.round(getPropVal(selectedClip.opacity ?? 1, 'opacity') * 100);
                          let next = steps.find(s => s > cur) ?? steps[0];
                          setPropVal('opacity', next / 100, { opacity: next / 100 });
                          scheduleSaveSnapshot();
                        }}
                      >
                        {Math.round(getPropVal(selectedClip.opacity ?? 1, 'opacity') * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('flip') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('flip')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">Flip / Mirror</span>
                {collapsedSections['flip'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('flip') && (
                <div className="px-2.5 pb-2.5 pt-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const cur = selectedClip.transform.flipH ?? false;
                      updateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, flipH: !cur }
                      });
                      scheduleSaveSnapshot('Flip Horizontal');
                    }}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedClip.transform.flipH ? 'bg-amber-500 text-black' : 'bg-[var(--theme-bg-subpanel)] text-white hover:bg-[#4a4a4a]'
                    }`}
                  >
                    Flip Horizontal
                  </button>
                  <button
                    onClick={() => {
                      const cur = selectedClip.transform.flipV ?? false;
                      updateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, flipV: !cur }
                      });
                      scheduleSaveSnapshot('Flip Vertical');
                    }}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedClip.transform.flipV ? 'bg-amber-500 text-black' : 'bg-[var(--theme-bg-subpanel)] text-white hover:bg-[#4a4a4a]'
                    }`}
                  >
                    Flip Vertical
                  </button>
                </div>
              )}
            </div>

            {/* Perspective Warp & Motion Tracking */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('perspective') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('perspective')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
              >
                <span className="font-medium">Perspective Warp & Tracker</span>
                {collapsedSections['perspective'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('perspective') && (
                <div className="px-2.5 pb-2.5 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={!!selectedClip.transform.perspectivePin}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        let updates: any = {
                          transform: {
                            ...selectedClip.transform,
                            perspectivePin: enabled
                          }
                        };
                        if (enabled && !selectedClip.transform.perspectiveCorners) {
                          const aX = selectedClip.transform.x;
                          const aY = selectedClip.transform.y;
                          const aScale = selectedClip.transform.scale;
                          const media = mediaLibrary.find(m => m.id === selectedClip.mediaId);
                          let vw = 854;
                          let vh = 480;
                          if (media?.type === 'video' || media?.type === 'image') {
                            vw = media.width || 854;
                            vh = media.height || 480;
                          }
                          const scaleToFit = Math.min(854 / vw, 480 / vh);
                          const baseW = vw * scaleToFit * (aScale / 100);
                          const baseH = vh * scaleToFit * (aScale / 100);

                          updates.transform.perspectiveCorners = {
                            x0: 427 + aX - baseW / 2,
                            y0: 240 + aY - baseH / 2,
                            x1: 427 + aX + baseW / 2,
                            y1: 240 + aY - baseH / 2,
                            x2: 427 + aX + baseW / 2,
                            y2: 240 + aY + baseH / 2,
                            x3: 427 + aX - baseW / 2,
                            y3: 240 + aY + baseH / 2
                          };
                        }
                        updateClip(selectedClip.id, updates);
                        scheduleSaveSnapshot();
                      }}
                      className="rounded border-[var(--theme-border)] text-amber-500 bg-[var(--theme-bg-subpanel)] focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-[var(--theme-text-primary)]">Enable Corner Pinning</span>
                  </label>

                  {selectedClip.transform.perspectivePin && (
                    <div className="pt-2 border-t border-[var(--theme-border)] space-y-2">
                      <p className="text-[10px] text-[var(--theme-text-muted)]">
                        Drag the 4 corner handles on the preview screen to adjust the perspective warp.
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newAnimations = { ...(selectedClip.animations || {}) };
                          for (let i = 0; i < 4; i++) {
                            delete newAnimations[`transform.perspectiveCorners.x${i}`];
                            delete newAnimations[`transform.perspectiveCorners.y${i}`];
                          }
                          const aX = selectedClip.transform.x;
                          const aY = selectedClip.transform.y;
                          const w = (selectedClip as any).width || 854;
                          const h = (selectedClip as any).height || 480;
                          const scale = (selectedClip.transform.scale || 100) / 100;
                          const cx = 854 / 2 + aX;
                          const cy = 480 / 2 + aY;
                          const w2 = w * scale / 2;
                          const h2 = h * scale / 2;
                          const defaultCorners = {
                            x0: cx - w2, y0: cy - h2,
                            x1: cx + w2, y1: cy - h2,
                            x2: cx + w2, y2: cy + h2,
                            x3: cx - w2, y3: cy + h2
                          };
                          updateClip(selectedClip.id, {
                            transform: {
                              ...selectedClip.transform,
                              perspectiveCorners: defaultCorners
                            },
                            animations: newAnimations
                          });
                          scheduleSaveSnapshot();
                        }}
                        className="w-full py-1 mt-1 text-[10px] text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500/10 transition-colors"
                      >
                        Reset Corners / Clear Track
                      </button>

                      <button
                        onClick={async () => {
                          if (isTracking) return;

                          const selectedTrackIndex = tracks.findIndex(t => t.id === selectedClip.trackId);
                          let bgClip = null;
                          for (let i = selectedTrackIndex - 1; i >= 0; i--) {
                            if (tracks[i].type === 'video') {
                              const found = tracks[i].clips.find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);
                              if (found) {
                                const mediaItem = mediaLibrary.find(m => m.id === found.mediaId);
                                if (mediaItem?.type === 'video') {
                                  bgClip = found;
                                  break;
                                }
                              }
                            }
                          }

                          if (!bgClip) {
                            for (const track of tracks) {
                              if (track.id === selectedClip.trackId) continue;
                              const found = track.clips.find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);
                              if (found) {
                                const mediaItem = mediaLibrary.find(m => m.id === found.mediaId);
                                if (mediaItem?.type === 'video') {
                                  bgClip = found;
                                  break;
                                }
                              }
                            }
                          }

                          if (!bgClip) {
                            toast.warning("No background video clip found to track! Add a video on a lower track first.");
                            return;
                          }

                          const videoEl = videoElements.get(bgClip.id);
                          if (!videoEl) {
                            toast.warning("Background video player is not loaded yet. Try playing/seeking first.");
                            return;
                          }

                          const initialCorners = selectedClip.transform.perspectiveCorners || {
                            x0: 427 - 100, y0: 240 - 100,
                            x1: 427 + 100, y1: 240 - 100,
                            x2: 427 + 100, y2: 240 + 100,
                            x3: 427 - 100, y3: 240 + 100
                          };

                          setIsTracking(true);
                          setTrackProgress(0);

                          try {
                            const trackDuration = Math.min(selectedClip.duration, videoEl.duration - currentTime);
                            const trackingResults = await trackMotion(
                              videoEl,
                              currentTime,
                              trackDuration,
                              initialCorners,
                              (progress) => {
                                setTrackProgress(Math.round(progress * 100));
                              }
                            );

                            const newAnimations = { ...(selectedClip.animations || {}) };
                            for (let i = 0; i < 4; i++) {
                              newAnimations[`transform.perspectiveCorners.x${i}`] = [];
                              newAnimations[`transform.perspectiveCorners.y${i}`] = [];
                            }

                            trackingResults.forEach(res => {
                              for (let i = 0; i < 4; i++) {
                                const kx = `transform.perspectiveCorners.x${i}`;
                                const ky = `transform.perspectiveCorners.y${i}`;
                                const valX = res.corners[`x${i}` as keyof CornerPoints];
                                const valY = res.corners[`y${i}` as keyof CornerPoints];

                                newAnimations[kx].push({ time: res.time, value: valX, easing: 'linear' });
                                newAnimations[ky].push({ time: res.time, value: valY, easing: 'linear' });
                              }
                            });

                            updateClip(selectedClip.id, {
                              transform: {
                                ...selectedClip.transform,
                                perspectiveCorners: trackingResults[0].corners
                              },
                              animations: newAnimations
                            });

                            toast.success("Motion tracking completed successfully! Keyframes generated.");
                          } catch (e: any) {
                            toast.error(`Motion tracking failed: ${e.message || e}`);
                          } finally {
                            setIsTracking(false);
                          }
                        }}
                        disabled={isTracking}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--theme-text-primary)] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        {isTracking ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Tracking Background ({trackProgress}%)</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Track Background Motion (Auto)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {renderBlendModeSection()}

            {/* Crop */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('crop') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('crop')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
              >
                <span className="font-medium">Crop</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPropVal('crop.left', 0, { crop: { top: 0, bottom: 0, left: 0, right: 0 } });
                      setPropVal('crop.right', 0, { crop: { top: 0, bottom: 0, left: 0, right: 0 } });
                      setPropVal('crop.top', 0, { crop: { top: 0, bottom: 0, left: 0, right: 0 } });
                      setPropVal('crop.bottom', 0, { crop: { top: 0, bottom: 0, left: 0, right: 0 } });
                      scheduleSaveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Crop"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                  </div>
                  {collapsedSections['crop'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  )}
                </div>
              </button>
              {isSectionOpen('crop') && (
                <div className="px-2.5 pb-2.5 space-y-3 mt-1">
                  {['left', 'right', 'top', 'bottom'].map((edge) => {
                    const currentCrop = selectedClip.crop || { top: 0, bottom: 0, left: 0, right: 0 };
                    const propKey = `crop.${edge}`;
                    const value = getPropVal(currentCrop[edge as keyof typeof currentCrop], propKey);
                    return (
                      <div key={edge} className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-[var(--theme-text-muted)] capitalize">{edge}</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--theme-text-primary)] w-8 text-right">{Math.round(value)}%</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.1}
                          value={value}
                          title={`Double-click to reset ${edge} crop to 0%`}
                          onChange={(e) => {
                            let newVal = Number(e.target.value);
                            const proposedCrop = { ...currentCrop, [edge]: newVal };
                            const horizontalCrop = (proposedCrop.left || 0) + (proposedCrop.right || 0);
                            const verticalCrop = (proposedCrop.top || 0) + (proposedCrop.bottom || 0);
                            if (horizontalCrop > 90 || verticalCrop > 90) {
                              toast.error("Crop values exceed 90% total");
                              return;
                            }
                            setPropVal(propKey, newVal, { crop: proposedCrop });
                          }}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          onDoubleClick={() => {
                            setPropVal(propKey, 0, { crop: { ...currentCrop, [edge]: 0 } });
                            scheduleSaveSnapshot();
                          }}
                          className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ken Burns Effect — only for image clips */}
            {selectedTrack?.type !== 'audio' && selectedTrack?.type !== 'text' && selectedTrack?.type !== 'fx' && (() => {
              const mediaItem = useEditorStore.getState().mediaLibrary.find(m => m.id === selectedClip.id || m.id === selectedClip.mediaId);
              if (mediaItem?.type !== 'image') return null;
              const kb = selectedClip.kenBurns;
              const isKbEnabled = kb?.enabled ?? false;
              const defaultKb: ClipKenBurnsSettings = {
                enabled: false,
                startScale: 100, startPanX: 0, startPanY: 0,
                endScale: 120,   endPanX: 0,   endPanY: 0,
                easing: 'easeInOut',
              };
              const kbVal = kb || defaultKb;

              const updateKb = (patch: Partial<ClipKenBurnsSettings>) => {
                const merged = { ...kbVal, ...patch };
                
                const maxStartPan = Math.max(0, (merged.startScale - 100) / 2);
                merged.startPanX = Math.max(-maxStartPan, Math.min(maxStartPan, merged.startPanX));
                merged.startPanY = Math.max(-maxStartPan, Math.min(maxStartPan, merged.startPanY));

                const maxEndPan = Math.max(0, (merged.endScale - 100) / 2);
                merged.endPanX = Math.max(-maxEndPan, Math.min(maxEndPan, merged.endPanX));
                merged.endPanY = Math.max(-maxEndPan, Math.min(maxEndPan, merged.endPanY));

                updateClip(selectedClip.id, { kenBurns: merged });
              };

              const KbSlider = ({ label, value, min, max, step, onChange }: {
                label: string; value: number; min: number; max: number; step: number;
                onChange: (v: number) => void;
              }) => (
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[var(--theme-text-muted)]">{label}</span>
                    <span 
                      className="text-[10px] text-[var(--theme-text-primary)] font-mono w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                      title="Click to cycle values"
                      onClick={() => {
                        const steps = label === 'Scale' ? [50, 100, 150, 200, 300, 400] : [0, 50, 100, 200, -200, -100, -50];
                        let next = steps.find(s => s > value) ?? steps[0];
                        onChange(next);
                        scheduleSaveSnapshot();
                      }}
                    >
                      {value > 0 && label !== 'Scale' ? `+${value}` : value}{label === 'Scale' ? '%' : '%'}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    onMouseUp={() => scheduleSaveSnapshot()}
                    onDoubleClick={() => { onChange(label === 'Scale' ? 100 : 0); scheduleSaveSnapshot(); }}
                    title={`Double-click to reset`}
                    className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
                  />
                </div>
              );

              return (
                <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)]">
                  <button
                    onClick={() => toggleSection('kenBurns')}
                    className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold group`}
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-medium">Ken Burns Effect</span>
                      {isKbEnabled && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        onClick={e => { e.stopPropagation(); updateKb({ enabled: !isKbEnabled }); scheduleSaveSnapshot(); }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-[10px] transition-colors"
                        title={isKbEnabled ? 'Disable Ken Burns' : 'Enable Ken Burns'}
                      >
                        <span className={isKbEnabled ? 'text-emerald-400' : 'text-[var(--theme-text-muted)]'}>{isKbEnabled ? 'Enabled' : 'Enable'}</span>
                      </div>
                      {collapsedSections['kenBurns'] ? (
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                      )}
                    </div>
                  </button>

                  {isSectionOpen('kenBurns') && (
                    <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                      {/* Start Frame */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Start Frame</p>
                        <KbSlider label="Scale" value={kbVal.startScale} min={100} max={300} step={1}
                          onChange={v => updateKb({ startScale: v })} />
                        <KbSlider label="Pan X" value={kbVal.startPanX} min={-((kbVal.startScale - 100) / 2)} max={(kbVal.startScale - 100) / 2} step={1}
                          onChange={v => updateKb({ startPanX: v })} />
                        <KbSlider label="Pan Y" value={kbVal.startPanY} min={-((kbVal.startScale - 100) / 2)} max={(kbVal.startScale - 100) / 2} step={1}
                          onChange={v => updateKb({ startPanY: v })} />
                      </div>

                      {/* Swap Button */}
                      <button
                        onClick={() => {
                          updateKb({
                            startScale: kbVal.endScale, startPanX: kbVal.endPanX, startPanY: kbVal.endPanY,
                            endScale: kbVal.startScale, endPanX: kbVal.startPanX, endPanY: kbVal.startPanY,
                          });
                          scheduleSaveSnapshot();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-[10px] text-[var(--theme-text-muted)] hover:text-white transition-colors"
                        title="Swap Start and End states"
                      >
                        <ArrowLeftRight className="w-3 h-3" /> Reverse Direction
                      </button>

                      {/* End Frame */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">End Frame</p>
                        <KbSlider label="Scale" value={kbVal.endScale} min={100} max={300} step={1}
                          onChange={v => updateKb({ endScale: v })} />
                        <KbSlider label="Pan X" value={kbVal.endPanX} min={-((kbVal.endScale - 100) / 2)} max={(kbVal.endScale - 100) / 2} step={1}
                          onChange={v => updateKb({ endPanX: v })} />
                        <KbSlider label="Pan Y" value={kbVal.endPanY} min={-((kbVal.endScale - 100) / 2)} max={(kbVal.endScale - 100) / 2} step={1}
                          onChange={v => updateKb({ endPanY: v })} />
                      </div>

                      {/* Easing Curve */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--theme-text-muted)] block">Easing Curve</label>
                        <div className="relative">
                          <select
                            value={kbVal.easing}
                            onChange={e => { updateKb({ easing: e.target.value as ClipKenBurnsSettings['easing'] }); scheduleSaveSnapshot(); }}
                            className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-primary)] rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                          >
                            <option value="linear">Linear</option>
                            <option value="easeIn">Ease In</option>
                            <option value="easeOut">Ease Out</option>
                            <option value="easeInOut">Ease In-Out (Smooth)</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-[var(--theme-text-muted)] absolute right-2 top-2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--theme-text-muted)] block">Quick Presets</label>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { label: 'Zoom In',    patch: { startScale: 100, startPanX: 0, startPanY: 0, endScale: 140, endPanX: 0,   endPanY: 0,   easing: 'easeInOut' as const } },
                            { label: 'Zoom Out',   patch: { startScale: 140, startPanX: 0, startPanY: 0, endScale: 100, endPanX: 0,   endPanY: 0,   easing: 'easeInOut' as const } },
                            { label: 'Pan Right',  patch: { startScale: 120, startPanX: -15, startPanY: 0, endScale: 120, endPanX: 15,  endPanY: 0,   easing: 'linear' as const } },
                            { label: 'Pan Left',   patch: { startScale: 120, startPanX: 15,  startPanY: 0, endScale: 120, endPanX: -15, endPanY: 0,   easing: 'linear' as const } },
                            { label: 'Zoom & Pan', patch: { startScale: 100, startPanX: -10, startPanY: -5, endScale: 140, endPanX: 10, endPanY: 5,   easing: 'easeInOut' as const } },
                            { label: 'Reset',      patch: { startScale: 100, startPanX: 0,   startPanY: 0,  endScale: 100, endPanX: 0,  endPanY: 0,   easing: 'easeInOut' as const } },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              onClick={() => { updateKb({ enabled: true, ...preset.patch }); scheduleSaveSnapshot(); }}
                              className="px-1.5 py-1 bg-[var(--theme-bg-subpanel)] hover:bg-[#2a2a2a] border border-[var(--theme-border)] hover:border-emerald-500/40 rounded text-[10px] text-[var(--theme-text-primary)] transition-colors text-center truncate"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Enter / Exit Animation ─────────────────────────── */}
            <div className={`bg-[var(--theme-bg-subpanel)] rounded-lg border border-[var(--theme-border)] ${!isSectionActive('enterExit') ? 'hidden' : ''}`}>
              <div
                className="flex items-center justify-between p-2.5 cursor-pointer select-none"
                onClick={() => setCollapsedSections(s => ({ ...s, enterExit: !s.enterExit }))}
              >
                <div className="flex items-center gap-2">
                  <Film size={14} className="text-purple-400" />
                  <span className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Enter / Exit Animation</span>
                </div>
                {collapsedSections.enterExit ? <ChevronRight size={14} className="text-[var(--theme-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--theme-text-muted)]" />}
              </div>
              {!collapsedSections.enterExit && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Enter Animation */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">Enter</label>
                    <select
                      value={selectedClip.enterExitAnimation?.enterType || 'none'}
                      onChange={(e) => updateClipEnterExitAnimation(selectedClip.id, { enterType: e.target.value as any })}
                      className="w-full bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] border border-[var(--theme-border)] rounded px-2 py-1.5 text-xs"
                    >
                      {ENTER_EXIT_PRESETS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    {selectedClip.enterExitAnimation?.enterType && selectedClip.enterExitAnimation.enterType !== 'none' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--theme-text-muted)] w-12 shrink-0">Duration</span>
                        <input
                          type="range"
                          min="0.1" max="3" step="0.1"
                          value={selectedClip.enterExitAnimation?.enterDuration || 0.5}
                          onChange={(e) => updateClipEnterExitAnimation(selectedClip.id, { enterDuration: parseFloat(e.target.value) })}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          className="flex-1 accent-purple-500 h-1"
                        />
                        <span className="text-[10px] text-[var(--theme-text-muted)] w-6 text-right">{(selectedClip.enterExitAnimation?.enterDuration || 0.5).toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                  {/* Exit Animation */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">Exit</label>
                    <select
                      value={selectedClip.enterExitAnimation?.exitType || 'none'}
                      onChange={(e) => updateClipEnterExitAnimation(selectedClip.id, { exitType: e.target.value as any })}
                      className="w-full bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] border border-[var(--theme-border)] rounded px-2 py-1.5 text-xs"
                    >
                      {ENTER_EXIT_PRESETS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    {selectedClip.enterExitAnimation?.exitType && selectedClip.enterExitAnimation.exitType !== 'none' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--theme-text-muted)] w-12 shrink-0">Duration</span>
                        <input
                          type="range"
                          min="0.1" max="3" step="0.1"
                          value={selectedClip.enterExitAnimation?.exitDuration || 0.5}
                          onChange={(e) => updateClipEnterExitAnimation(selectedClip.id, { exitDuration: parseFloat(e.target.value) })}
                          onMouseUp={() => scheduleSaveSnapshot()}
                          className="flex-1 accent-purple-500 h-1"
                        />
                        <span className="text-[10px] text-[var(--theme-text-muted)] w-6 text-right">{(selectedClip.enterExitAnimation?.exitDuration || 0.5).toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            </div>
          );
        })()}

        {currentTab === 'mask' && (() => {
          const mask = selectedClip.mask || { enabled: false, type: 'rectangle', x: 50, y: 50, width: 50, height: 50, points: [], feather: 0, invert: false, rotation: 0, roundness: 0, matteSourceClipId: '' };
          const updateMask = (updates: any) => {
            updateClip(selectedClip.id, { mask: { ...mask, ...updates } });
          };
          const handleMouseUp = () => scheduleSaveSnapshot();

          const Slider = ({ label, value, min, max, unit, prop }: { label: string, value: number, min: number, max: number, unit: string, prop: string }) => (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--theme-text-primary)]">{label}</span>
                <span className="font-mono text-[var(--theme-text-muted)]">{value}{unit}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => updateMask({ [prop]: Number(e.target.value) })}
                onMouseUp={handleMouseUp}
                className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          );

          return (
            <div className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 bg-[var(--theme-bg-subpanel)] rounded-md border border-[var(--theme-border)]">
                <span className="text-xs text-[var(--theme-text-muted)]">Enable Masking</span>
                <button
                  onClick={() => { updateMask({ enabled: !mask.enabled }); handleMouseUp(); }}
                  className={`w-10 h-5 rounded-full transition-colors relative ${mask.enabled ? 'bg-amber-500' : 'bg-[var(--theme-bg-subpanel)]'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${mask.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {mask.enabled && (
                <>
                  {/* Mask Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--theme-text-muted)]">Mask Shape</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['rectangle', 'circle', 'split', 'filmstrip', 'heart', 'star', 'matte'].map(t => (
                        <button
                          key={t}
                          onClick={() => { updateMask({ type: t }); handleMouseUp(); }}
                          className={`py-1 text-[10px] rounded border transition-colors ${mask.type === t ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-[var(--theme-border)] bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] hover:border-[#4e4e4e]'}`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Properties depending on type */}
                  <div className="space-y-3 p-3 bg-[var(--theme-bg-card)] rounded-md border border-[var(--theme-border)]">
                    <Slider label="Position X" value={mask.x} min={0} max={100} unit="%" prop="x" />
                    <Slider label="Position Y" value={mask.y} min={0} max={100} unit="%" prop="y" />
                    
                    {(mask.type === 'rectangle' || mask.type === 'circle' || mask.type === 'heart' || mask.type === 'star') && (
                      <Slider label={mask.type === 'circle' ? 'Radius' : 'Width'} value={mask.width} min={0} max={100} unit="%" prop="width" />
                    )}
                    
                    {(mask.type === 'rectangle' || mask.type === 'filmstrip') && (
                      <Slider label="Height" value={mask.height ?? 50} min={0} max={100} unit="%" prop="height" />
                    )}
                    
                    <Slider label="Rotation" value={mask.rotation ?? 0} min={0} max={360} unit="°" prop="rotation" />
                    
                    {mask.type === 'rectangle' && (
                      <Slider label="Roundness" value={mask.roundness ?? 0} min={0} max={100} unit="%" prop="roundness" />
                    )}
                    
                    {mask.type === 'matte' && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-[var(--theme-text-muted)]">Matte Source Clip</label>
                        <select
                          value={mask.matteSourceClipId || ''}
                          onChange={(e) => { updateMask({ matteSourceClipId: e.target.value }); handleMouseUp(); }}
                          className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded p-1.5 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">Select visual clip...</option>
                          {tracks.flatMap(t => t.clips)
                            .filter(c => c.id !== selectedClip.id && (c.mediaId?.startsWith('clip_') || c.textSettings || c.mediaId?.includes('text')))
                            .map(c => {
                              const mediaName = mediaLibrary.find(m => m.id === c.mediaId)?.name;
                              return (
                                <option key={c.id} value={c.id}>
                                  {mediaName || c.id}
                                </option>
                              );
                            })
                          }
                        </select>
                      </div>
                    )}
                    
                    <div className="h-px bg-[var(--theme-bg-subpanel)] my-2" />
                    
                    <Slider label="Feather" value={mask.feather} min={0} max={100} unit="px" prop="feather" />
                    
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-[var(--theme-text-muted)]">Invert Mask</span>
                      <button
                        onClick={() => { updateMask({ invert: !mask.invert }); handleMouseUp(); }}
                        className={`w-8 h-4 rounded-full transition-colors relative ${mask.invert ? 'bg-amber-500' : 'bg-[var(--theme-bg-subpanel)]'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${mask.invert ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {currentTab === 'color' && (
          <div className="space-y-3">
            {selectedClip && (
              <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-2 flex items-center justify-between gap-2">
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => copyColorGrade(selectedClip.id)}
                    className="flex-1 px-2.5 py-1.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-card)] text-xs font-medium text-[var(--theme-text-primary)] border border-[var(--theme-border)] hover:border-blue-500/40 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Palette className="w-3.5 h-3.5 text-purple-500" />
                    <span>Copy Grade</span>
                  </button>
                  <button
                    onClick={() => pasteColorGrade(selectedClip.id)}
                    disabled={!colorClipboard}
                    className="flex-1 px-2.5 py-1.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-card)] disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-[var(--theme-text-primary)] border border-[var(--theme-border)] hover:border-blue-500/40 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Palette className="w-3.5 h-3.5 text-blue-500" />
                    <span>Paste Grade</span>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Apply this clip's color grade to all other video/image clips?")) {
                        applyColorGradeToAll(selectedClip.id);
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    <span>Apply to All</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Basic Correction Section */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('colorBasic') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('colorBasic')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">Basic Correction</span>
                {collapsedSections['colorBasic'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('colorBasic') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Temperature</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {getPropVal(clipFilters.temperature, 'color.temperature') > 0 ? `+${getPropVal(clipFilters.temperature, 'color.temperature')}` : getPropVal(clipFilters.temperature, 'color.temperature')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={getPropVal(clipFilters.temperature, 'color.temperature')}
                        onChange={(e) => handleFilterChange('temperature', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('temperature')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-blue-500 via-[#3e3e3e] to-orange-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>

                  {/* Tint */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Tint</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {getPropVal(clipFilters.tint, 'color.tint') > 0 ? `+${getPropVal(clipFilters.tint, 'color.tint')}` : getPropVal(clipFilters.tint, 'color.tint')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={getPropVal(clipFilters.tint, 'color.tint')}
                        onChange={(e) => handleFilterChange('tint', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('tint')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-green-500 via-[#3e3e3e] to-pink-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>

                                    {/* Auto Color AI */}
                  <div className="flex justify-end pb-2">
                    <button
                      onClick={() => {
                        if (!selectedClip) return;
                        
                        const videoEl = videoElements.get(selectedClip.id);
                        let suggested: any = {};
                        
                        if (videoEl) {
                          suggested = calculateAutoColor(videoEl, selectedClip.colorFilters);
                        } else {
                          // Fallback to simulation if media element is not ready
                          const tempShift = Math.floor(Math.random() * 20) - 10;
                          const expShift = Math.floor(Math.random() * 20) - 10;
                          const contShift = Math.floor(Math.random() * 30);
                          suggested = {
                            temperature: tempShift,
                            exposure: expShift,
                            contrast: 100 + contShift,
                            saturation: selectedClip.colorFilters?.saturation ?? 100,
                            tint: selectedClip.colorFilters?.tint ?? 0
                          };
                        }

                        setPropVal('color.temperature', suggested.temperature, {
                          colorFilters: {
                            ...(selectedClip.colorFilters || defaultColorFilters),
                            ...suggested
                          }
                        });
                        scheduleSaveSnapshot('Auto Color');
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-medium rounded-md shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                      Auto Color
                    </button>
                  </div>
                  
                  {/* Exposure */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Exposure</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {getPropVal(clipFilters.exposure, 'color.exposure') > 0 ? `+${getPropVal(clipFilters.exposure, 'color.exposure')}` : getPropVal(clipFilters.exposure, 'color.exposure')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={getPropVal(clipFilters.exposure, 'color.exposure')}
                        onChange={(e) => handleFilterChange('exposure', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('exposure')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Contrast</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{getPropVal(clipFilters.contrast, 'color.contrast')}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={getPropVal(clipFilters.contrast, 'color.contrast')}
                        onChange={(e) => handleFilterChange('contrast', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('contrast')}
                        title="Double-click to reset to 100%"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Saturation</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{getPropVal(clipFilters.saturation, 'color.saturation')}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={getPropVal(clipFilters.saturation, 'color.saturation')}
                        onChange={(e) => handleFilterChange('saturation', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('saturation')}
                        title="Double-click to reset to 100%"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Blur */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Blur</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{getPropVal(clipFilters.blur, 'color.blur')}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={getPropVal(clipFilters.blur, 'color.blur')}
                        onChange={(e) => handleFilterChange('blur', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('blur')}
                        title="Double-click to reset to 0px"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Creative Section */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('colorCreative') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('colorCreative')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">Creative</span>
                {collapsedSections['colorCreative'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('colorCreative') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Faded Film */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Faded Film</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{getPropVal(clipFilters.fadedFilm, 'color.fadedFilm')}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={getPropVal(clipFilters.fadedFilm, 'color.fadedFilm')}
                        onChange={(e) => handleFilterChange('fadedFilm', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('fadedFilm')}
                        title="Double-click to reset to 0%"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Vignette */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Vignette</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {getPropVal(clipFilters.vignette, 'color.vignette') > 0 ? `+${getPropVal(clipFilters.vignette, 'color.vignette')}` : getPropVal(clipFilters.vignette, 'color.vignette')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={getPropVal(clipFilters.vignette, 'color.vignette')}
                        onChange={(e) => handleFilterChange('vignette', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleFilterReset('vignette')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-white via-[#3e3e3e] to-black rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3-Way Color Wheels */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] group ${!isSectionActive('colorWheels') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('colorWheels')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">3-Way Color Wheels</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClip(selectedClip.id, {
                        colorFilters: {
                          ...selectedClip.colorFilters,
                          shadows: { hue: 0, saturation: 0, lift: 0 },
                          midtones: { hue: 0, saturation: 0, lift: 0 },
                          highlights: { hue: 0, saturation: 0, lift: 0 },
                        } as any
                      });
                      scheduleSaveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset All Wheels"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-white" />
                  </div>
                  {collapsedSections['colorWheels'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  )}
                </div>
              </button>
              {isSectionOpen('colorWheels') && (
                <div className="px-2 pb-3 flex gap-2 border-t border-[var(--theme-border)]/30 pt-2.5">
                  <ColorWheel
                    label="Shadows"
                    value={selectedClip.colorFilters?.shadows}
                    onChange={(val) => {
                      updateClip(selectedClip.id, {
                        colorFilters: { ...selectedClip.colorFilters, shadows: val } as any
                      });
                    }}
                    accentColor="#fbbf24"
                  />
                  <ColorWheel
                    label="Midtones"
                    value={selectedClip.colorFilters?.midtones}
                    onChange={(val) => {
                      updateClip(selectedClip.id, {
                        colorFilters: { ...selectedClip.colorFilters, midtones: val } as any
                      });
                    }}
                    accentColor="#3b82f6"
                  />
                  <ColorWheel
                    label="Highlights"
                    value={selectedClip.colorFilters?.highlights}
                    onChange={(val) => {
                      updateClip(selectedClip.id, {
                        colorFilters: { ...selectedClip.colorFilters, highlights: val } as any
                      });
                    }}
                    accentColor="#ef4444"
                  />
                </div>
              )}
            </div>

            {/* LUT Color Grade */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('lutGrade') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('lutGrade')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  LUT Color Grade
                  {selectedClip.lut && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </span>
                {collapsedSections['lutGrade'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('lutGrade') && (() => {
                const mediaLibrary = useEditorStore.getState().mediaLibrary;
                const lutMedia = selectedClip.lut
                  ? mediaLibrary.find((m) => m.id === selectedClip.lut!.mediaId)
                  : null;
                const lutItems = mediaLibrary.filter((m) => m.type === 'lut');

                return (
                  <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                    {/* Current LUT */}
                    {selectedClip.lut && lutMedia ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-emerald-400 font-medium truncate flex-1 mr-2">
                            📁 {lutMedia.name}
                          </span>
                          <button
                            onClick={() => {
                              updateClip(selectedClip.id, { lut: undefined });
                              scheduleSaveSnapshot();
                            }}
                            className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-400/10 hover:bg-red-400/20 transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                        {/* Intensity slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[var(--theme-text-muted)]">Intensity</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[var(--theme-text-muted)]">
                                {Math.round(getPropVal(selectedClip.lut.intensity ?? 100, 'lut.intensity'))}%
                              </span>
                              <KeyframeControl
                                propertyKey="lut.intensity"
                                value={getPropVal(selectedClip.lut.intensity ?? 100, 'lut.intensity')}
                                keyframes={animations['lut.intensity'] || []}
                                currentTime={localTime}
                                clipId={selectedClip.id}
                                onAddKeyframe={(time, val) => {
                                  const newKf = addOrUpdateKeyframe(animations['lut.intensity'] || [], time, val, { easing: 'linear' });
                                  updateClip(selectedClip.id, { animations: { ...animations, 'lut.intensity': newKf } });
                                }}
                                onRemoveKeyframe={(time) => {
                                  const newKf = (animations['lut.intensity'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                                  updateClip(selectedClip.id, { animations: { ...animations, 'lut.intensity': newKf } });
                                }}
                              />
                            </div>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={getPropVal(selectedClip.lut.intensity ?? 100, 'lut.intensity')}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPropVal('lut.intensity', val, {
                                lut: { ...selectedClip.lut!, intensity: val }
                              });
                            }}
                            onMouseUp={() => scheduleSaveSnapshot()}
                            className="w-full h-1 bg-gradient-to-r from-[#3e3e3e] to-emerald-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[#6a6a6a]">No LUT applied. Import a .cube file, then drag it onto this clip.</p>
                    )}
                    {/* Apply from library */}
                    {lutItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-[var(--theme-text-muted)]">Apply from library:</p>
                        <select
                          value={selectedClip.lut?.mediaId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              updateClip(selectedClip.id, { lut: undefined });
                            } else {
                              updateClip(selectedClip.id, { lut: { mediaId: v, intensity: selectedClip.lut?.intensity ?? 100 } });
                            }
                            scheduleSaveSnapshot();
                          }}
                          className="w-full bg-[var(--theme-bg-subpanel)] text-white text-[11px] border border-[var(--theme-border)] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">— None —</option>
                          {lutItems.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="text-[9px] text-[#6a6a6a]">Tip: drag a LUT from Effects tab directly onto a timeline clip.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {currentTab === 'speed' && (
          <div className="space-y-3">
            {/* Speed range input */}
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-2.5">
              <label className="text-xs text-[var(--theme-text-primary)] font-semibold block mb-2">Speed</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.25}
                  value={isRamped ? 1.0 : selectedClip.speed}
                  disabled={isRamped}
                  title={isRamped ? "Disable Speed Ramping to adjust flat speed" : "Double-click to reset to 1.0x"}
                  onChange={(e) => {
                    const newSpeed = Number(e.target.value);
                    const sourceDuration = selectedClip.duration * selectedClip.speed;
                    const newDuration = sourceDuration / newSpeed;
                    updateClip(selectedClip.id, {
                      speed: newSpeed,
                      duration: newDuration,
                    }, { ripple: true });
                    const state = useEditorStore.getState();
                    if (state.currentTime > selectedClip.startTime + newDuration) {
                      state.seek(selectedClip.startTime + newDuration - 0.1);
                    }
                  }}
                  onMouseUp={() => scheduleSaveSnapshot()}
                  onDoubleClick={() => {
                    if (isRamped) return;
                    const newSpeed = 1.0;
                    const sourceDuration = selectedClip.duration * selectedClip.speed;
                    const newDuration = sourceDuration / newSpeed;
                    updateClip(selectedClip.id, {
                      speed: newSpeed,
                      duration: newDuration,
                    }, { ripple: true });
                    scheduleSaveSnapshot();
                  }}
                  className={`flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${
                    isRamped
                      ? 'bg-[#222] [&::-webkit-slider-thumb]:bg-[#444] cursor-not-allowed'
                      : 'bg-[var(--theme-bg-subpanel)] [&::-webkit-slider-thumb]:bg-amber-500'
                  }`}
                />
                <span className="text-[11px] text-[var(--theme-text-primary)] w-12 text-right select-none font-mono">
                  {isRamped ? 'Ramped' : `${selectedClip.speed.toFixed(2)}x`}
                </span>
              </div>
            </div>

            {/* Dynamic Speed Ramping (Dynamic Stretch) */}
            {(() => {
              const isClipInStretch = dynamicStretch?.isActive && dynamicStretch.clipId === selectedClip.id;
              const speedRatio = isClipInStretch && dynamicStretch.originalRegionDuration > 0 && dynamicStretch.stretchedDuration > 0
                ? dynamicStretch.originalRegionDuration / dynamicStretch.stretchedDuration
                : 1;

              return (
                <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--theme-text-primary)]">
                      <Gauge className="w-3.5 h-3.5 text-amber-500" />
                      <span>Dynamic Speed Ramping</span>
                    </div>
                    {isClipInStretch && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        {dynamicStretch.isConfirmed ? 'Stretch Mode' : 'Marking'}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
                    Mark any region on this clip to squeeze (speed up) or extend (slow down) with audio sync and zero export errors.
                  </p>

                  {isClipInStretch ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] px-2 py-1.5 bg-black/10 dark:bg-white/5 rounded border border-[var(--theme-border)]/50">
                        <span className="text-[var(--theme-text-muted)]">Region Speed:</span>
                        <span className="font-bold text-amber-500 font-mono">
                          {speedRatio.toFixed(2)}x {speedRatio > 1.05 ? '(Fast)' : speedRatio < 0.95 ? '(Slow)' : '(Normal)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        {!dynamicStretch.isConfirmed ? (
                          <>
                            <button
                              onClick={toggleDynamicStretchLoop}
                              className={`flex-1 py-1.5 px-2 text-[10px] font-medium rounded flex items-center justify-center gap-1 transition-all ${
                                dynamicStretch.isLoopingRegion && isPlaying
                                  ? 'bg-amber-500 text-black font-bold animate-pulse'
                                  : 'bg-black/10 dark:bg-white/5 text-[var(--theme-text-primary)] hover:bg-black/20 dark:hover:bg-white/10'
                              }`}
                            >
                              <Repeat className="w-3 h-3" />
                              <span>{dynamicStretch.isLoopingRegion && isPlaying ? 'Looping' : 'Audition'}</span>
                            </button>
                            <button
                              onClick={confirmDynamicStretchMark}
                              className="flex-1 py-1.5 px-2 text-[10px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 shadow-sm transition-all"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={applyDynamicStretch}
                            className="flex-1 py-1.5 px-2 text-[10px] font-bold rounded bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-1 shadow-sm transition-all"
                          >
                            <Check className="w-3 h-3" />
                            <span>Apply Dynamic Stretch</span>
                          </button>
                        )}

                        <button
                          onClick={cancelDynamicStretch}
                          title="Cancel Stretch"
                          className="p-1 rounded text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startDynamicStretch(selectedClip.id)}
                      className="w-full py-1.5 px-2.5 text-[11px] font-semibold rounded bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Gauge className="w-3 h-3" />
                      <span>Mark Region for Speed Ramp</span>
                    </button>
                  )}

                  <label className="flex items-center gap-1.5 pt-1 text-[10px] text-[var(--theme-text-muted)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dynamicStretch?.maintainDuration ?? true}
                      onChange={(e) => setDynamicStretchMaintainDuration(e.target.checked)}
                      className="w-3 h-3 rounded accent-amber-500 cursor-pointer"
                    />
                    <span>Maintain clip duration (compensate tail)</span>
                  </label>
                </div>
              );
            })()}

            {/* Clip Timeline Settings */}
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--theme-text-muted)] block mb-1">Duration</label>
                  <div className="px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)]">
                    {(selectedClip?.duration ?? 0).toFixed(2)}s
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--theme-text-muted)] block mb-1">Start</label>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedClip.startTime}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        startTime: Number(e.target.value),
                      })
                    }
                    onBlur={() => scheduleSaveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Trimming */}
            <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--theme-text-muted)] block mb-1">Trim Start</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.trimStart}
                    onChange={(e) => {
                      const mediaItem = useEditorStore.getState().mediaLibrary.find(m => m.id === selectedClip.mediaId);
                      const maxDuration = mediaItem ? mediaItem.duration : selectedClip.duration;
                      const val = Math.max(0, Math.min(maxDuration - selectedClip.trimEnd - 0.1, Number(e.target.value)));
                      updateClip(selectedClip.id, {
                        trimStart: val,
                      });
                    }}
                    onBlur={() => scheduleSaveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--theme-text-muted)] block mb-1">Trim End</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.trimEnd}
                    onChange={(e) => {
                      const mediaItem = useEditorStore.getState().mediaLibrary.find(m => m.id === selectedClip.mediaId);
                      const maxDuration = mediaItem ? mediaItem.duration : selectedClip.duration;
                      const val = Math.max(0, Math.min(maxDuration - selectedClip.trimStart - 0.1, Number(e.target.value)));
                      updateClip(selectedClip.id, {
                        trimEnd: val,
                      });
                    }}
                    onBlur={() => scheduleSaveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'audio' && (
          <div className="space-y-3">
            {/* Waveform & Frame Preview Refresh */}
            {selectedClip && selectedClip.mediaId && (
              <div className="bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded p-2.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[var(--theme-text-primary)]">Audio Waveform & Preview</span>
                  <p className="text-[10px] text-[var(--theme-text-muted)]">Re-extract audio peaks and regenerate frame thumbnails</p>
                </div>
                <button
                  onClick={() => refreshClipPreviews(selectedClip.id)}
                  className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 shrink-0"
                  title="Refresh Waveform & Frame Preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            )}

            {/* AI Auto Audio Ducking */}
            {!isMobileView && selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Auto Audio Ducking</span>
                </div>
                <p className="text-[11px] text-[#90e0b0]">
                  Analyze parallel clips for vocals using Demucs AI, and automatically generate ducking volume keyframes on this clip.
                </p>

                {isDuckingAudio ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-3 bg-[var(--theme-bg-subpanel)] rounded border border-[var(--theme-border)]">
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Separating and Analyzing Vocals ({duckingProgress}%)...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleAudioDucking}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Analyze & Duck Audio
                  </button>
                )}
                
                {selectedClip.animations?.['audio.volume'] && selectedClip.animations['audio.volume'].length > 0 && (
                  <p className="text-[9px] text-emerald-400 mt-2 text-center">
                    ✓ Volume keyframes applied. You can remove them using the Volume keyframe clear button below.
                  </p>
                )}
              </div>
            )}
            
            {/* AI Sound Designer */}
            {!isMobileView && selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && selectedTrack?.type === 'video' && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Sound Designer</span>
                </div>
                <p className="text-[11px] text-[#e0c090]">
                  Analyze scene storyboard using Gemini 2.0 Vision and suggest optimized SFX options using Groq.
                </p>

                {/* AI Provider Configuration */}
                <div className="space-y-2 pt-1 border-t border-[var(--theme-border)]/40">
                  <div className="flex items-center gap-2">
                     <label className="text-[10px] text-[var(--theme-text-primary)]">AI Provider:</label>
                     <select 
                       value={aiProvider}
                       onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
                       className="bg-[var(--theme-bg-subpanel)] text-white text-[10px] border border-[var(--theme-border)] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                     >
                       <option value="gemini">Gemini (Default)</option>
                       <option value="groq">Groq (Llama 3 Vision)</option>
                     </select>
                  </div>
                  <div className="flex items-center gap-2">
                     <label className="text-[10px] text-[var(--theme-text-primary)]">Precision:</label>
                     <select 
                       value={soundDesignFps}
                       onChange={(e) => setSoundDesignFps(Number(e.target.value))}
                       className="bg-[var(--theme-bg-subpanel)] text-white text-[10px] border border-[var(--theme-border)] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                     >
                       <option value={1}>1 FPS (Standard)</option>
                       <option value={5}>5 FPS (High)</option>
                       <option value={10}>10 FPS (Ultra, Millisecond precise)</option>
                     </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-[var(--theme-text-muted)]">Freesound Key (Optional)</label>
                    <input
                      type="password"
                      placeholder="Leave blank for public key"
                      value={freesoundApiKey}
                      onChange={(e) => {
                        setFreesoundApiKey(e.target.value);
                        sessionStorage.setItem('procut_freesound_key', e.target.value);
                      }}
                      className="bg-[var(--theme-bg-subpanel)] text-white text-[10px] border border-[var(--theme-border)] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {isAnalyzingAudio ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-3 bg-[var(--theme-bg-subpanel)] rounded border border-[var(--theme-border)]">
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    <span className="text-[10px] text-amber-400 font-medium">
                      {audioAnalyzeProgress}...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleAiSoundDesign}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate Sound Design
                  </button>
                )}
              </div>
            )}
            {!isMobileView && selectedClipIds.length > 1 && (
              <div className="bg-purple-950/20 border border-purple-500/30 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Auto Voice Tune</span>
                  {voiceTuneResults.length > 0 && (
                    <button
                      onClick={() => setVoiceTuneResults([])}
                      className="ml-auto text-[9px] text-purple-400 hover:text-purple-200"
                    >Clear</button>
                  )}
                </div>
                <p className="text-[11px] text-[#c0a0d0]">
                  Align and normalize {selectedClipIds.length} selected vocal profiles. Unifies volume, EQ, pitch, warmth, compression and character.
                </p>

                {isAnalyzingVoice ? (
                  <div className="flex items-center justify-center gap-1.5 py-3 bg-purple-950/40 rounded border border-purple-500/20">
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-6 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-7 bg-pink-500 rounded-full animate-bounce" />
                    <div className="w-1 h-6 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="text-[10px] text-purple-200 ml-2 font-medium">Analyzing & tuning vocals...</span>
                  </div>
                ) : voiceTuneResults.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider mb-1">✓ Applied Settings Per Clip</div>
                    {voiceTuneResults.map((r) => (
                      <div key={r.clipId} className={`rounded p-2 border text-[10px] ${ r.isReference ? 'bg-purple-900/30 border-purple-400/40' : 'bg-[#1a1a2e] border-purple-900/40' }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {r.isReference && <span className="text-[8px] bg-amber-500 text-black px-1 rounded font-bold">REF</span>}
                          <span className="text-purple-100 font-medium truncate">{r.clipName}</span>
                        </div>
                        {r.isReference ? (
                          <span className="text-purple-400/70">Reference clip — all others tuned to match this</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.adjustments.volume   !== undefined && <span className="bg-[#2a2a3e] text-cyan-300 px-1.5 py-0.5 rounded">Vol: {r.adjustments.volume > 0 ? '+' : ''}{r.adjustments.volume}dB</span>}
                            {r.adjustments.bass     !== undefined && <span className="bg-[#2a2a3e] text-green-300 px-1.5 py-0.5 rounded">Bass: {r.adjustments.bass > 0 ? '+' : ''}{r.adjustments.bass}dB</span>}
                            {r.adjustments.mid      !== undefined && <span className="bg-[#2a2a3e] text-yellow-300 px-1.5 py-0.5 rounded">Mid: {r.adjustments.mid > 0 ? '+' : ''}{r.adjustments.mid}dB</span>}
                            {r.adjustments.treble   !== undefined && <span className="bg-[#2a2a3e] text-orange-300 px-1.5 py-0.5 rounded">Treble: {r.adjustments.treble > 0 ? '+' : ''}{r.adjustments.treble}dB</span>}
                            {r.adjustments.pitch    !== undefined && <span className="bg-[#2a2a3e] text-pink-300 px-1.5 py-0.5 rounded">Pitch: {r.adjustments.pitch > 0 ? '+' : ''}{r.adjustments.pitch}st</span>}
                            {r.adjustments.voiceFormant !== undefined && <span className="bg-[#2a2a3e] text-purple-300 px-1.5 py-0.5 rounded">Formant: {r.adjustments.voiceFormant > 0 ? '+' : ''}{r.adjustments.voiceFormant}</span>}
                            {r.adjustments.compression !== undefined && <span className="bg-[#2a2a3e] text-blue-300 px-1.5 py-0.5 rounded">Comp: +{r.adjustments.compression}%</span>}
                            {r.adjustments.warmth   !== undefined && <span className="bg-[#2a2a3e] text-amber-300 px-1.5 py-0.5 rounded">Warmth: {r.adjustments.warmth > 0 ? '+' : ''}{r.adjustments.warmth}</span>}
                            {r.adjustments.deEsser  !== undefined && <span className="bg-[#2a2a3e] text-red-300 px-1.5 py-0.5 rounded">De-Ess: +{r.adjustments.deEsser}%</span>}
                            {Object.values(r.adjustments).every(v => v === undefined) && <span className="text-purple-400/70">No adjustment needed</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAutoVoiceTune}
                      className="w-full mt-1 py-1.5 bg-purple-800/60 hover:bg-purple-700/60 text-purple-200 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" /> Re-Tune
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAutoVoiceTune}
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Unify Selected Voices
                  </button>
                )}
              </div>
            )}

                        {/* Auto Jump Cuts AI */}
            <div className="bg-[var(--theme-bg-subpanel)] p-3 rounded border border-purple-500/30 mb-3 shadow-lg shadow-purple-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-500/20 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>
                </div>
                <div>
                  <h4 className="text-[11px] font-semibold text-[var(--theme-text-primary)]">Auto Jump Cuts</h4>
                  <p className="text-[9px] text-[var(--theme-text-muted)]">Remove silences instantly</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!selectedClip) return;
                  useEditorStore.getState().applyAutoCuts(selectedClip.id, 'medium');
                }}
                className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors shadow-md shadow-purple-950/50"
              >
                Apply Magic Cut
              </button>
            </div>

            {/* Clip Volume & Pan */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('audioVolume') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('audioVolume')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Clip Volume & Pan</span>
                </div>
                {collapsedSections['audioVolume'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('audioVolume') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Mute toggle */}
                  <div className="flex justify-between items-center text-[11px] bg-[var(--theme-bg-subpanel)] p-2 rounded border border-[var(--theme-border)]">
                    <span className="text-[var(--theme-text-primary)] font-medium">Clip Audio Muted</span>
                    <button
                      onClick={() => handleAudioChange('muted', !clipAudio.muted)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        clipAudio.muted
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-[var(--theme-bg-card)] hover:bg-[#3d3d3d] text-[var(--theme-text-muted)] hover:text-white'
                      }`}
                    >
                      {clipAudio.muted ? 'Muted' : 'Mute'}
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Volume Gain</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {getPropVal(clipAudio.volume, 'audio.volume') > 0 ? `+${getPropVal(clipAudio.volume, 'audio.volume')}` : getPropVal(clipAudio.volume, 'audio.volume')} dB ({Math.round(Math.pow(10, getPropVal(clipAudio.volume, 'audio.volume') / 20) * 100)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-40}
                        max={12}
                        value={getPropVal(clipAudio.volume, 'audio.volume')}
                        onChange={(e) => handleAudioChange('volume', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('volume')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    {/* Peak Normalization */}
                    <div className="pt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Peak Normalization</span>
                      <button
                        onClick={handleNormalizeAudio}
                        disabled={isNormalizing || selectedClip.mediaId?.startsWith('text-placeholder')}
                        className={`px-2 py-0.5 text-[10px] border border-amber-500/30 rounded text-amber-500 hover:text-white hover:bg-amber-500/20 transition-all font-semibold uppercase tracking-wider flex items-center gap-1 ${
                          isNormalizing ? 'opacity-50 cursor-wait' : ''
                        }`}
                      >
                        {isNormalizing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Normalizing...
                          </>
                        ) : (
                          'Normalize to -3dB'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Pan Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Pan / Balance</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {getPropVal(clipAudio.pan, 'audio.pan') === 0 ? 'Center' : getPropVal(clipAudio.pan, 'audio.pan') > 0 ? `R${getPropVal(clipAudio.pan, 'audio.pan')}` : `L${Math.abs(getPropVal(clipAudio.pan, 'audio.pan'))}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={getPropVal(clipAudio.pan, 'audio.pan')}
                        onChange={(e) => handleAudioChange('pan', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('pan')}
                        title="Double-click to reset to Center"
                        className="flex-1 h-1 bg-gradient-to-r from-blue-500 via-[#3e3e3e] to-red-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vocal Tune & Character */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('audioVocalTune') || isMobileView ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('audioVocalTune')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vocal Tune & Character</span>
                </div>
                {collapsedSections['audioVocalTune'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('audioVocalTune') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Humanize AI Voice Toggle */}
                  <div className="flex justify-between items-center text-[11px] bg-purple-950/20 p-2 rounded border border-purple-500/20">
                    <div>
                      <span className="text-purple-300 font-semibold block">Humanize AI Voice</span>
                      <span className="text-[9px] text-[#a0a0d0] block">Reduces synthetic metallic ring</span>
                    </div>
                    <button
                      onClick={() => handleAudioChange('humanize', !clipAudio.humanize)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        clipAudio.humanize
                          ? 'bg-purple-600 hover:bg-purple-500 text-white'
                          : 'bg-[var(--theme-bg-card)] hover:bg-[#3d3d3d] text-[var(--theme-text-muted)] hover:text-white'
                      }`}
                    >
                      {clipAudio.humanize ? 'Active' : 'Off'}
                    </button>
                  </div>

                  {/* Pitch Shift Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Pitch Shift</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {clipAudio.pitch === 0 ? 'Original Pitch' : clipAudio.pitch > 0 ? `+${clipAudio.pitch} Semitones` : `${clipAudio.pitch} Semitones`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={clipAudio.pitch}
                        onChange={(e) => handleAudioChange('pitch', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('pitch')}
                        title="Double-click to reset to 0 semitones"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Vocal Tone + Auto-Match */}
                  <VocalToneSection
                    clipAudio={clipAudio}
                    hasEnoughClips={hasEnoughAudioClips}
                    isMatchingVocals={isMatchingVocals}
                    matchResults={vocalMatchResults}
                    matchError={vocalMatchError}
                    onToneChange={(v) => handleAudioChange('tone', v)}
                    onToneReset={() => handleAudioReset('tone')}
                    onToggleAutoMatch={handleToggleVocalMatch}
                    onAutoMatch={handleAutoMatchVocals}
                  />

                  {/* Formant Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Voice Formant / Tone</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {clipAudio.voiceFormant === 0 ? 'Default' : clipAudio.voiceFormant > 0 ? `+${clipAudio.voiceFormant}` : clipAudio.voiceFormant}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipAudio.voiceFormant}
                        onChange={(e) => handleAudioChange('voiceFormant', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('voiceFormant')}
                        title="Double-click to reset to Default"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Warmth Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Warmth</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {(clipAudio.warmth ?? 0) === 0 ? 'Neutral' : (clipAudio.warmth ?? 0) > 0 ? `+${clipAudio.warmth} Warm` : `${clipAudio.warmth} Thin`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={-100} max={100}
                        value={clipAudio.warmth ?? 0}
                        onChange={(e) => handleAudioChange('warmth', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('warmth')}
                        title="Double-click to reset. Adds low-mid body to thin AI voices."
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Compression Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Compression</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {(clipAudio.compression ?? 0) === 0 ? 'Off' : `${clipAudio.compression}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={100}
                        value={clipAudio.compression ?? 0}
                        onChange={(e) => handleAudioChange('compression', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('compression')}
                        title="Double-click to turn off. Evens out loud and quiet parts."
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* De-Esser Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">De-Esser</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {(clipAudio.deEsser ?? 0) === 0 ? 'Off' : `${clipAudio.deEsser}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={100}
                        value={clipAudio.deEsser ?? 0}
                        onChange={(e) => handleAudioChange('deEsser', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('deEsser')}
                        title="Double-click to turn off. Reduces harsh S and Sh sibilance sounds."
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-red-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Fades */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('audioFades') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('audioFades')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">Audio Fades</span>
                {collapsedSections['audioFades'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('audioFades') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Fade In */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Fade In duration</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{(clipAudio?.fadeIn ?? 0).toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={clipAudio.fadeIn}
                        onChange={(e) => handleAudioChange('fadeIn', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('fadeIn')}
                        title="Double-click to reset to 0s"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Fade Out */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Fade Out duration</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{(clipAudio?.fadeOut ?? 0).toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={clipAudio.fadeOut}
                        onChange={(e) => handleAudioChange('fadeOut', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('fadeOut')}
                        title="Double-click to reset to 0s"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Audio Enhancements */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('audioEnhancements') || isMobileView ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('audioEnhancements')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>AI Noise Reduction</span>
                </div>
                {collapsedSections['audioEnhancements'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('audioEnhancements') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Reduce Background Noise</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{clipAudio.denoise ?? 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={clipAudio.denoise ?? 0}
                        onChange={(e) => handleAudioChange('denoise', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('denoise')}
                        title="Double-click to reset to 0%"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Equalizer (EQ) */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('audioEQ') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('audioEQ')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Equalizer (EQ)</span>
                </div>
                {collapsedSections['audioEQ'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('audioEQ') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  {/* Bass */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Bass (Low-shelf)</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {clipAudio.bass > 0 ? `+${clipAudio.bass}` : clipAudio.bass} dB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        value={clipAudio.bass}
                        onChange={(e) => handleAudioChange('bass', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('bass')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Mid */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Mid (1kHz Presence)</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {(clipAudio.mid ?? 0) > 0 ? `+${clipAudio.mid ?? 0}` : (clipAudio.mid ?? 0)} dB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        value={clipAudio.mid ?? 0}
                        onChange={(e) => handleAudioChange('mid', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('mid')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Treble */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Treble (High-shelf)</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">
                        {clipAudio.treble > 0 ? `+${clipAudio.treble}` : clipAudio.treble} dB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        value={clipAudio.treble}
                        onChange={(e) => handleAudioChange('treble', Number(e.target.value))}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onDoubleClick={() => handleAudioReset('treble')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Vocal / BGM Separation */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('aiVocalSeparation') || isMobileView ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('aiVocalSeparation')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI Vocal Separator</span>
                  {clipAudio.aiVocalSeparation?.isProcessed && (
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-semibold">DONE</span>
                  )}
                </div>
                {collapsedSections['aiVocalSeparation'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('aiVocalSeparation') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  <div className="bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]/50 rounded p-2.5 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-cyan-400 font-semibold block flex items-center gap-1">
                          Demucs AI Model
                        </span>
                        <span className="text-[9px] text-[var(--theme-text-muted)] block">
                          Extract vocals locally via WebGPU
                        </span>
                      </div>
                      <button
                        onClick={handleAiSeparate}
                        disabled={isSeparating || clipAudio.aiVocalSeparation?.isProcessed}
                        className={`px-2.5 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 ${
                          isSeparating || clipAudio.aiVocalSeparation?.isProcessed
                            ? 'bg-[var(--theme-bg-card)] text-[#606060] cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold'
                        }`}
                      >
                        {isSeparating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Processing...
                          </>
                        ) : clipAudio.aiVocalSeparation?.isProcessed ? (
                          'Extracted'
                        ) : (
                          'Extract (AI)'
                        )}
                      </button>
                    </div>
                    {isSeparating && (
                      <div className="space-y-1 animate-pulse" role="status" aria-live="polite">
                        <div className="h-1 bg-cyan-950 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full animate-[progress_15s_ease-out_infinite]" style={{ width: '80%' }}></div>
                        </div>
                        <span className="text-[8px] text-cyan-400/80 block text-center font-mono">
                          Running neural network separation...
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Info Note */}
                  <div className="bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]/50 rounded p-2.5 space-y-1">
                    <p className="text-[10px] text-[var(--theme-text-muted)]">
                      <span className="text-cyan-400 font-medium">How it works:</span> Uses Demucs AI running entirely in your browser via WebGPU to separate vocals from background music.
                    </p>
                    <p className="text-[9px] text-[#6a6a6a]">
                      Your audio is never sent to the cloud. The isolated stems will be automatically added to your timeline below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Speed Pitch Settings */}
            <div className={`bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] ${!isSectionActive('audioSpeedPitch') ? 'hidden' : ''}`}>
              <button
                onClick={() => toggleSection('audioSpeedPitch')}
                className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-[var(--theme-text-primary)] font-semibold`}
              >
                <span className="font-medium">Speed Pitch Settings</span>
                {collapsedSections['audioSpeedPitch'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                )}
              </button>
              {isSectionOpen('audioSpeedPitch') && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[var(--theme-border)]/30 pt-2.5">
                  <div className="flex justify-between items-center text-[11px] bg-[var(--theme-bg-subpanel)] p-2 rounded border border-[var(--theme-border)]">
                    <div>
                      <span className="text-[var(--theme-text-primary)] font-medium block">Maintain Audio Pitch</span>
                      <span className="text-[9px] text-[var(--theme-text-muted)] block">Keeps pitch stable on speed changes</span>
                    </div>
                    <button
                      onClick={() => handleAudioChange('preservePitch', !clipAudio.preservePitch)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        clipAudio.preservePitch
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-[var(--theme-bg-card)] hover:bg-[#3d3d3d] text-[var(--theme-text-muted)] hover:text-white'
                      }`}
                    >
                      {clipAudio.preservePitch ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Text Tab ─────────────────────────────────────────────────── */}
        {currentTab === 'text' && selectedClip.textSettings && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--theme-text-primary)] uppercase tracking-wider">Text Properties</h3>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--theme-text-muted)]">Content</label>
                <textarea
                  value={selectedClip.textSettings.text}
                  onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, text: e.target.value } })}
                  onBlur={() => scheduleSaveSnapshot()}
                  className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--theme-text-muted)]">Style Presets</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-1.5 border border-[var(--theme-border)]/40 rounded bg-[#181818] scrollbar-thin">
                  {TEXT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      onClick={() => {
                        updateClip(selectedClip.id, {
                          textSettings: {
                            ...selectedClip.textSettings!,
                            fontSize: tmpl.settings.fontSize,
                            fontFamily: tmpl.settings.fontFamily,
                            color: tmpl.settings.color,
                            bold: tmpl.settings.bold || false,
                            italic: tmpl.settings.italic || false,
                            underline: tmpl.settings.underline || false,
                            shadow: tmpl.settings.shadow || false,
                            backgroundColor: tmpl.settings.backgroundColor || 'transparent',
                            strokeColor: tmpl.settings.strokeColor || undefined,
                            strokeWidth: tmpl.settings.strokeWidth || undefined,
                            animationPreset: tmpl.settings.animationPreset || undefined,
                            ...presetToTextAnimationPatch(tmpl.settings.animationPreset),
                          }
                        });
                        scheduleSaveSnapshot();
                        toast.success(`Applied style "${tmpl.name}"`);
                      }}
                      className="p-2 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-left truncate transition-colors text-[10px] text-[var(--theme-text-primary)] flex items-center justify-center font-semibold"
                      title={tmpl.name}
                    >
                      <span className={tmpl.style} style={{ fontSize: '10px' }}>{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--theme-text-muted)]">Font Family</label>
                <select
                  value={selectedClip.textSettings.fontFamily || 'Inter'}
                  onChange={(e) => {
                    updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontFamily: e.target.value } });
                    scheduleSaveSnapshot();
                  }}
                  className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
                >
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Bebas Neue">Bebas Neue</option>
                  <option value="Oswald">Oswald</option>
                  <option value="Lato">Lato</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Impact">Impact</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Arial">Arial</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--theme-text-muted)]">Font Size</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="12"
                    max="150"
                    value={selectedClip.textSettings.fontSize}
                    onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontSize: Number(e.target.value) } })}
                    onMouseUp={() => scheduleSaveSnapshot()}
                    onTouchEnd={() => scheduleSaveSnapshot()}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="text-xs text-[var(--theme-text-primary)] w-8 text-right">{selectedClip.textSettings.fontSize}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[var(--theme-text-muted)]">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.color || '#ffffff'}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, color: e.target.value } })}
                      onBlur={() => scheduleSaveSnapshot()}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <span className="text-xs text-[var(--theme-text-primary)] uppercase">{selectedClip.textSettings.color}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[var(--theme-text-muted)]">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.backgroundColor === 'transparent' ? '#000000' : selectedClip.textSettings.backgroundColor}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, backgroundColor: e.target.value } })}
                      onBlur={() => scheduleSaveSnapshot()}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <button 
                      onClick={() => {
                        updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, backgroundColor: 'transparent' } });
                        scheduleSaveSnapshot();
                      }}
                      className="text-[10px] bg-[var(--theme-bg-subpanel)] hover:bg-[#5e5e5e] px-2 py-1 rounded text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 border-t border-[var(--theme-border)] pt-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[var(--theme-text-muted)]">Stroke Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.strokeColor || '#000000'}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, strokeColor: e.target.value } })}
                      onBlur={() => scheduleSaveSnapshot()}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <span className="text-xs text-[var(--theme-text-primary)] uppercase">{selectedClip.textSettings.strokeColor || '#000000'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[var(--theme-text-muted)]">Stroke Width</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={selectedClip.textSettings.strokeWidth || 0}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, strokeWidth: Number(e.target.value) } })}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      onTouchEnd={() => scheduleSaveSnapshot()}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-xs text-[var(--theme-text-primary)] w-5 text-right">{selectedClip.textSettings.strokeWidth || 0}</span>
                  </div>
                </div>
              </div>

              {/* Outer Stroke (Sticker Effect) */}
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[var(--theme-text-muted)]">Outer Stroke</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.outerStrokeColor || '#000000'}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, outerStrokeColor: e.target.value } })}
                      onBlur={() => scheduleSaveSnapshot()}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={selectedClip.textSettings.outerStrokeWidth || 0}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, outerStrokeWidth: Number(e.target.value) } })}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-xs text-[var(--theme-text-primary)] w-5 text-right">{selectedClip.textSettings.outerStrokeWidth || 0}</span>
                  </div>
                </div>
              </div>

              {/* Gradient Text Fill */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--theme-text-muted)]">Gradient Fill</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(selectedClip.textSettings.gradientColors || [])[0] || selectedClip.textSettings.color || '#ffffff'}
                    onChange={(e) => {
                      const existing = selectedClip.textSettings.gradientColors || [selectedClip.textSettings.color || '#ffffff', '#0066ff'];
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, gradientColors: [e.target.value, existing[1] || '#0066ff'] } });
                    }}
                    onBlur={() => scheduleSaveSnapshot()}
                    className="w-6 h-6 rounded bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] text-[var(--theme-text-muted)]">→</span>
                  <input
                    type="color"
                    value={(selectedClip.textSettings.gradientColors || [])[1] || '#0066ff'}
                    onChange={(e) => {
                      const existing = selectedClip.textSettings.gradientColors || [selectedClip.textSettings.color || '#ffffff', '#0066ff'];
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, gradientColors: [existing[0] || '#ffffff', e.target.value] } });
                    }}
                    onBlur={() => scheduleSaveSnapshot()}
                    className="w-6 h-6 rounded bg-transparent cursor-pointer"
                  />
                  <select
                    value={selectedClip.textSettings.gradientDirection || 'horizontal'}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, gradientDirection: e.target.value as any } });
                      scheduleSaveSnapshot();
                    }}
                    className="flex-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] px-1 py-0.5"
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                    <option value="diagonal">Diagonal</option>
                  </select>
                  <button
                    onClick={() => {
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, gradientColors: undefined } });
                      scheduleSaveSnapshot();
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 px-1"
                    title="Clear gradient"
                  >✕</button>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-[var(--theme-border)] pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.bold}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, bold: e.target.checked } });
                      scheduleSaveSnapshot();
                    }}
                    className="accent-amber-500 rounded bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]"
                  />
                  <span className="text-xs text-[var(--theme-text-primary)] font-bold">Bold</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.italic}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, italic: e.target.checked } });
                      scheduleSaveSnapshot();
                    }}
                    className="accent-amber-500 rounded bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]"
                  />
                  <span className="text-xs text-[var(--theme-text-primary)] italic">Italic</span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--theme-text-muted)]">Alignment</label>
                <div className="flex gap-1">
                  {(['left','center','right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => {
                        updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, textAlign: align } });
                        scheduleSaveSnapshot();
                      }}
                      className={`flex-1 py-1.5 text-xs rounded border transition-colors capitalize ${
                        (selectedClip.textSettings as any).textAlign === align || (!((selectedClip.textSettings as any).textAlign) && align === 'center')
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--theme-border)] pt-4 flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.shadow}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadow: e.target.checked } });
                      scheduleSaveSnapshot();
                    }}
                    className="accent-amber-500 rounded bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]"
                  />
                  <span className="text-xs text-[var(--theme-text-primary)]">Drop Shadow</span>
                </label>
                {selectedClip.textSettings.shadow && (
                  <div className="pl-6 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedClip.textSettings.shadowColor || '#000000'}
                        onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadowColor: e.target.value } })}
                        onBlur={() => scheduleSaveSnapshot()}
                        className="w-5 h-5 rounded bg-transparent cursor-pointer"
                      />
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={selectedClip.textSettings.shadowBlur}
                        onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadowBlur: Number(e.target.value) } })}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onTouchEnd={() => scheduleSaveSnapshot()}
                        className="flex-1 accent-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--theme-border)] pt-4 flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.threeD}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, threeD: e.target.checked } });
                      scheduleSaveSnapshot();
                    }}
                    className="accent-amber-500 rounded bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]"
                  />
                  <span className="text-xs text-[var(--theme-text-primary)]">3D Effect</span>
                </label>
                {selectedClip.textSettings.threeD && (
                  <div className="pl-6 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-[var(--theme-text-muted)] w-10">Depth</label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={selectedClip.textSettings.threeDDepth}
                        onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, threeDDepth: Number(e.target.value) } })}
                        onMouseUp={() => scheduleSaveSnapshot()}
                        onTouchEnd={() => scheduleSaveSnapshot()}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-[10px] text-[var(--theme-text-primary)] w-6">{selectedClip.textSettings.threeDDepth}px</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Text Animation Presets */}
              <div className="border-t border-[var(--theme-border)] pt-4 flex flex-col gap-4">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Text Animations</p>
                
                {/* Intro Animation (IN) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--theme-text-muted)]">Intro (IN)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedClip.textSettings.animation?.in || 'none'}
                      onChange={(e) => {
                        const anim = selectedClip.textSettings!.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                        updateClip(selectedClip.id, {
                          textSettings: {
                            ...selectedClip.textSettings!,
                            animation: { ...anim, in: e.target.value as any }
                          }
                        });
                        scheduleSaveSnapshot();
                      }}
                      className="flex-1 bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer capitalize"
                    >
                      <option value="none">None</option>
                      <optgroup label="── Basic ──">
                        <option value="fadeIn">Fade In</option>
                        <option value="zoom">Zoom In</option>
                        <option value="bounce">Bounce</option>
                        <option value="typewriter">Typewriter</option>
                        <option value="slideUp">Slide Up</option>
                        <option value="slideDown">Slide Down</option>
                        <option value="slideLeft">Slide Left</option>
                        <option value="slideRight">Slide Right</option>
                      </optgroup>
                      <optgroup label="── Cinematic ──">
                        <option value="elastic">⚡ Elastic Spring</option>
                        <option value="splitReveal">🎬 Split Reveal</option>
                        <option value="revealWipe">▶ Reveal Wipe</option>
                        <option value="rollUp">🎞 Roll Up</option>
                        <option value="scaleFlip">💥 Scale Flip</option>
                        <option value="zoomBlur">🔥 Zoom Blur</option>
                        <option value="glitch">⚠ Glitch</option>
                        <option value="letterSpacing">✦ Letter Expand</option>
                        <option value="spinIn">🌀 Spin In</option>
                        <option value="dropBounce">⬇️ Drop Bounce</option>
                        <option value="flipX">🔄 Flip X</option>
                        <option value="flipY">🔄 Flip Y</option>
                        <option value="blurIn">🌫️ Blur In</option>
                        <option value="expandWidth">↔️ Expand Width</option>
                        <option value="wave">🌊 Wave</option>
                        <option value="scramble">🔀 Scramble</option>
                      </optgroup>
                    </select>
                    
                    {selectedClip.textSettings.animation?.in && selectedClip.textSettings.animation.in !== 'none' && (
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5.0"
                          value={selectedClip.textSettings.animation?.inDuration ?? 0.5}
                          onChange={(e) => {
                            const anim = selectedClip.textSettings!.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                            updateClip(selectedClip.id, {
                              textSettings: {
                                ...selectedClip.textSettings!,
                                animation: { ...anim, inDuration: Number(e.target.value) }
                              }
                            });
                          }}
                          onBlur={() => scheduleSaveSnapshot()}
                          className="w-12 px-1.5 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-center text-[10px] text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-[var(--theme-text-muted)]">sec</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Outro Animation (OUT) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--theme-text-muted)]">Outro (OUT)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedClip.textSettings.animation?.out || 'none'}
                      onChange={(e) => {
                        const anim = selectedClip.textSettings!.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                        updateClip(selectedClip.id, {
                          textSettings: {
                            ...selectedClip.textSettings!,
                            animation: { ...anim, out: e.target.value as any }
                          }
                        });
                        scheduleSaveSnapshot();
                      }}
                      className="flex-1 bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer capitalize"
                    >
                      <option value="none">None</option>
                      <optgroup label="── Basic ──">
                        <option value="fadeOut">Fade Out</option>
                        <option value="zoom">Zoom Out</option>
                        <option value="slideUp">Slide Up</option>
                        <option value="slideDown">Slide Down</option>
                        <option value="slideLeft">Slide Left</option>
                        <option value="slideRight">Slide Right</option>
                      </optgroup>
                      <optgroup label="── Cinematic ──">
                        <option value="elastic">⚡ Elastic Snap</option>
                        <option value="scaleFlip">💥 Scale Flip</option>
                        <option value="zoomBlur">🔥 Zoom Blur Out</option>
                        <option value="revealWipe">▶ Wipe Out</option>
                        <option value="splitReveal">🎬 Collapse Center</option>
                        <option value="glitch">⚠ Glitch Out</option>
                        <option value="letterSpacing">✦ Letter Compress</option>
                        <option value="rollUp">🎞 Roll Off</option>
                        <option value="spinIn">🌀 Spin Out</option>
                        <option value="dropBounce">⬇️ Drop Out</option>
                        <option value="flipX">🔄 Flip X Out</option>
                        <option value="flipY">🔄 Flip Y Out</option>
                        <option value="blurIn">🌫️ Blur Out</option>
                        <option value="expandWidth">↔️ Collapse Width</option>
                        <option value="wave">🌊 Wave Out</option>
                        <option value="scramble">🔀 Scramble Out</option>
                      </optgroup>
                    </select>
                    
                    {selectedClip.textSettings.animation?.out && selectedClip.textSettings.animation.out !== 'none' && (
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5.0"
                          value={selectedClip.textSettings.animation?.outDuration ?? 0.5}
                          onChange={(e) => {
                            const anim = selectedClip.textSettings!.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                            updateClip(selectedClip.id, {
                              textSettings: {
                                ...selectedClip.textSettings!,
                                animation: { ...anim, outDuration: Number(e.target.value) }
                              }
                            });
                          }}
                          onBlur={() => scheduleSaveSnapshot()}
                          className="w-12 px-1.5 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-center text-[10px] text-[var(--theme-text-primary)] focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-[var(--theme-text-muted)]">sec</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[var(--theme-text-secondary)] w-16">Easing</span>
                  <select
                    value={selectedClip.textSettings?.animation?.easing || 'easeOut'}
                    onChange={(e) => {
                      const anim = selectedClip.textSettings?.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                      updateClip(selectedClip.id, {
                        textSettings: { ...selectedClip.textSettings!, animation: { ...anim, easing: e.target.value } }
                      });
                      scheduleSaveSnapshot();
                    }}
                    className="flex-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] px-1 py-0.5"
                  >
                    <option value="linear">Linear</option>
                    <option value="easeIn">Ease In</option>
                    <option value="easeOut">Ease Out (Default)</option>
                    <option value="easeInOut">Ease In-Out</option>
                    <option value="easeOutBack">Back (Overshoot)</option>
                    <option value="easeOutElastic">Elastic</option>
                    <option value="easeOutBounce">Bounce</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[var(--theme-text-secondary)] w-16">Loop</span>
                  <select
                    value={selectedClip.textSettings?.animation?.loop || 'none'}
                    onChange={(e) => {
                      const anim = selectedClip.textSettings?.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                      updateClip(selectedClip.id, {
                        textSettings: { ...selectedClip.textSettings!, animation: { ...anim, loop: e.target.value } }
                      });
                      scheduleSaveSnapshot();
                    }}
                    className="flex-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] px-1 py-0.5"
                  >
                    <option value="none">None</option>
                    <option value="wiggle">🎨 Wiggle</option>
                    <option value="pulse">💗 Pulse</option>
                    <option value="float">☁️ Float</option>
                    <option value="neonFlicker">💡 Neon Flicker</option>
                    <option value="shake">📳 Shake</option>
                    <option value="colorCycle">🌈 Color Cycle</option>
                  </select>
                </div>

                {selectedClip.textSettings?.animation?.loop && selectedClip.textSettings.animation.loop !== 'none' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--theme-text-secondary)] w-16">Speed</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={selectedClip.textSettings?.animation?.loopSpeed || 1}
                      onChange={(e) => {
                        const anim = selectedClip.textSettings?.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                        updateClip(selectedClip.id, {
                          textSettings: { ...selectedClip.textSettings!, animation: { ...anim, loopSpeed: parseFloat(e.target.value) } }
                        });
                      }}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-[var(--theme-text-secondary)] w-10 text-right">
                      {(selectedClip.textSettings?.animation?.loopSpeed || 1).toFixed(1)}×
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[var(--theme-text-secondary)] w-16">Cascade</span>
                  <select
                    value={selectedClip.textSettings?.animation?.perUnit || 'all'}
                    onChange={(e) => {
                      const anim = selectedClip.textSettings?.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                      updateClip(selectedClip.id, {
                        textSettings: { ...selectedClip.textSettings!, animation: { ...anim, perUnit: e.target.value } }
                      });
                      scheduleSaveSnapshot();
                    }}
                    className="flex-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] px-1 py-0.5"
                  >
                    <option value="all">All at Once</option>
                    <option value="word">Per Word</option>
                    <option value="character">Per Character</option>
                  </select>
                </div>

                {selectedClip.textSettings?.animation?.perUnit && selectedClip.textSettings.animation.perUnit !== 'all' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--theme-text-secondary)] w-16">Stagger</span>
                    <input
                      type="range"
                      min="0.01"
                      max="0.2"
                      step="0.01"
                      value={selectedClip.textSettings?.animation?.stagger || 0.05}
                      onChange={(e) => {
                        const anim = selectedClip.textSettings?.animation || { in: 'none', out: 'none', inDuration: 0.5, outDuration: 0.5 };
                        updateClip(selectedClip.id, {
                          textSettings: { ...selectedClip.textSettings!, animation: { ...anim, stagger: parseFloat(e.target.value) } }
                        });
                      }}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-[var(--theme-text-secondary)] w-10 text-right">
                      {((selectedClip.textSettings?.animation?.stagger || 0.05) * 1000).toFixed(0)}ms
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── AI & Effects Tab ────────────────────────────────────────────── */}
        {currentTab === 'effects' && (
          <div className="flex flex-col gap-4">
            {!isMobileView && (
              <h3 className="text-xs font-semibold text-[var(--theme-text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                AI Creative Suite & Effects
              </h3>
            )}

            {/* AI Auto Audio Ducking (Under AI Tab) */}
            {isSectionActive('audioDucking') && selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Auto Audio Ducking</span>
                </div>
                <p className="text-[11px] text-[#90e0b0]">
                  Analyze parallel clips for vocals using Demucs AI, and automatically generate ducking volume keyframes on this clip.
                </p>

                {isDuckingAudio ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-3 bg-[var(--theme-bg-subpanel)] rounded border border-[var(--theme-border)]">
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Separating and Analyzing Vocals ({duckingProgress}%)...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleAudioDucking}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Analyze & Duck Audio
                  </button>
                )}
                
                {selectedClip.animations?.['audio.volume'] && selectedClip.animations['audio.volume'].length > 0 && (
                  <p className="text-[9px] text-emerald-400 mt-2 text-center">
                    ✓ Volume keyframes applied.
                  </p>
                )}
              </div>
            )}

            {/* AI Sound Designer (Under AI Tab) */}
            {isSectionActive('soundDesign') && selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Sound Designer</span>
                </div>
                <p className="text-[11px] text-[#e0c090]">
                  Analyze scene storyboard using Gemini 2.0 Vision and suggest optimized SFX options using Groq.
                </p>

                {/* AI Provider Configuration */}
                <div className="space-y-2 pt-1 border-t border-[var(--theme-border)]/40">
                  <div className="flex items-center gap-2">
                     <label className="text-[10px] text-[var(--theme-text-primary)]">AI Provider:</label>
                     <select 
                       value={aiProvider}
                       onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
                       className="bg-[var(--theme-bg-subpanel)] text-white text-[10px] border border-[var(--theme-border)] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                     >
                       <option value="gemini">Gemini (Default)</option>
                       <option value="groq">Groq (Llama 3 Vision)</option>
                     </select>
                  </div>
                  <div className="flex items-center gap-2">
                     <label className="text-[10px] text-[var(--theme-text-primary)]">Precision:</label>
                     <select 
                       value={soundDesignFps}
                       onChange={(e) => setSoundDesignFps(Number(e.target.value))}
                       className="bg-[var(--theme-bg-subpanel)] text-white text-[10px] border border-[var(--theme-border)] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                     >
                       <option value={1}>1 FPS (Standard)</option>
                       <option value={5}>5 FPS (High)</option>
                       <option value={10}>10 FPS (Ultra, Millisecond precise)</option>
                     </select>
                  </div>
                </div>

                {isAnalyzingAudio ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-3 bg-[var(--theme-bg-subpanel)] rounded border border-[var(--theme-border)]">
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    <span className="text-[10px] text-amber-400 font-medium">
                      {audioAnalyzeProgress}...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleAiSoundDesign}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate Sound Design
                  </button>
                )}
              </div>
            )}

            {/* AI Vocal / BGM Separation (Under AI Tab) */}
            {isSectionActive('aiVocalSeparation') && selectedClip && (
              <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Vocal / BGM Splitter</span>
                </div>
                <p className="text-[11px] text-[var(--theme-text-muted)]">Separate dialogue/vocals from background music track using on-device Demucs AI.</p>
                <button
                  onClick={handleAiSeparate}
                  disabled={isSeparating || clipAudio.aiVocalSeparation?.isProcessed}
                  className={`w-full py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    isSeparating || clipAudio.aiVocalSeparation?.isProcessed
                      ? 'bg-[var(--theme-bg-subpanel)] text-[#606060] cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {isSeparating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Separating Vocals...</span>
                    </>
                  ) : clipAudio.aiVocalSeparation?.isProcessed ? (
                    <span>Vocals & Music Already Separated</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Split Vocals & Instrumental</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* AI Audio Voice Enhance (Under AI Tab) */}
            {isSectionActive('audioEnhancements') && selectedClip && (
              <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Voice Enhancements</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[var(--theme-text-primary)]">Reduce Background Noise</span>
                      <span className="font-mono text-[var(--theme-text-muted)]">{clipAudio.denoise ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={clipAudio.denoise ?? 0}
                      onChange={(e) => handleAudioChange('denoise', Number(e.target.value))}
                      onMouseUp={() => scheduleSaveSnapshot()}
                      className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI Voice Tune & Character (Under AI Tab) */}
            {isSectionActive('audioVocalTune') && selectedClip && (
              <div className="bg-[var(--theme-bg-card)] rounded border border-[var(--theme-border)] p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-[var(--theme-text-primary)] font-semibold">AI Voice Character & Pitch</span>
                </div>
                {/* Voice Formant */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--theme-text-primary)]">Voice Formant (Male &harr; Female)</span>
                    <span className="font-mono text-[var(--theme-text-muted)]">
                      {clipAudio.voiceFormant === 0 ? 'Default' : clipAudio.voiceFormant > 0 ? `+${clipAudio.voiceFormant}` : clipAudio.voiceFormant}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={clipAudio.voiceFormant}
                    onChange={(e) => handleAudioChange('voiceFormant', Number(e.target.value))}
                    onMouseUp={() => scheduleSaveSnapshot()}
                    className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
                {/* Warmth */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--theme-text-primary)]">Voice Warmth</span>
                    <span className="font-mono text-[var(--theme-text-muted)]">
                      {(clipAudio.warmth ?? 0) === 0 ? 'Neutral' : (clipAudio.warmth ?? 0) > 0 ? `+${clipAudio.warmth}` : `${clipAudio.warmth}`}
                    </span>
                  </div>
                  <input
                    type="range" min={-100} max={100}
                    value={clipAudio.warmth ?? 0}
                    onChange={(e) => handleAudioChange('warmth', Number(e.target.value))}
                    onMouseUp={() => scheduleSaveSnapshot()}
                    className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
                {/* Compression */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--theme-text-primary)]">Voice Compression</span>
                    <span className="font-mono text-[var(--theme-text-muted)]">
                      {(clipAudio.compression ?? 0) === 0 ? 'Off' : `${clipAudio.compression}%`}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={100}
                    value={clipAudio.compression ?? 0}
                    onChange={(e) => handleAudioChange('compression', Number(e.target.value))}
                    onMouseUp={() => scheduleSaveSnapshot()}
                    className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
              </div>
            )}

            {/* AI Kinetic Typography — Full Inline Config */}
            {selectedClip && (
              <KineticTypographySection
                selectedClip={selectedClip}
                aiProvider={aiProvider}
              />
            )}

            {/* Auto Beat Sync & Rhythm Detection */}
            {isSectionActive('beatsync') && selectedClip && (
              <BeatSyncSection
                selectedClip={selectedClip}
              />
            )}

            {/* AI Sound Designer & SFX Generator */}
            {isSectionActive('sfx') && selectedClip && (
              <AISFXSection
                selectedClip={selectedClip}
                isAnalyzingAudio={isAnalyzingAudio}
                audioAnalyzeProgress={audioAnalyzeProgress}
                handleAiSoundDesign={handleAiSoundDesign}
              />
            )}

            {/* AI Text & Motion Graphics */}
            {isSectionActive('designer') && selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && selectedTrack?.type === 'video' && (
              <AIMotionGraphicsSection
                aiProvider={aiProvider}
                setAiProvider={setAiProvider}
                isAnalyzingMotionGraphics={isAnalyzingMotionGraphics}
                motionGraphicsAnalyzeProgress={motionGraphicsAnalyzeProgress}
                handleAiMotionGraphicsDesign={handleAiMotionGraphicsDesign}
                selectedClip={selectedClip}
              />
            )}

            {/* Keying & AI Eraser (Chroma Key, Luma Key, AI Background) */}
            {renderKeyingAndAiSection()}

            {/* ── Timeline FX Settings ── */}
            {selectedClip.fxSettings && (
              <div className="flex flex-col gap-3 bg-[var(--theme-bg-subpanel)] rounded p-3 border border-rose-500/20">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Timeline FX</p>
                  <button
                    onClick={() => updateClip(selectedClip.id, { fxSettings: undefined })}
                    className="text-[9px] text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                  >
                    Remove FX
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[var(--theme-text-muted)]">Effect Type</label>
                  <select
                    value={selectedClip.fxSettings.type}
                    onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, type: e.target.value as any } })}
                    className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1.5 focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="continuous_mirror">🔄 Continuous Mirror (Alternating Flip)</option>
                    <option value="mirror">🪞 Mirror (Symmetry & Split)</option>
                    <option value="glitch">⚡ Glitch (Digital Slice Jitter)</option>
                    <option value="subject_outline_flash">✨ Subject Outline Flash (AI Human Extract)</option>
                    <option value="rhythmic_mirror">🔄 Rhythmic Mirror Flip (Action/Walking)</option>
                    <option value="action_zoom_pulse">💥 Action Zoom Pulse (Rhythm Bump)</option>
                    <option value="action_strobe">⚡ Impact Strobe Flash</option>
                    <option value="action_shake">📳 Action Shake & RGB Jitter</option>
                    <option value="quadrant_kaleidoscope">🔳 4-Way Mirror Quadrant</option>
                    <option value="vhs">📼 Retro VHS Tape</option>
                    <option value="cinematic_bars">🎬 Cinematic Letterbox Bars</option>
                    <option value="rgb_split">🌈 RGB Split (Prism)</option>
                    <option value="old_film">🎞️ Old Film Grain & Flicker</option>
                    <option value="neon_glow">🔥 Neon Glow Bloom</option>
                    <option value="pixelate">👾 Pixelate (8-Bit)</option>
                    <option value="zoom_blur">🌀 Zoom Blur (Radial)</option>
                    <option value="lens_flare">☀️ Lens Flare Burst</option>
                    <option value="night_vision">👁️ Night Vision (Phosphor)</option>
                    <option value="thermal">🎯 Thermal Heat Cam</option>
                    <option value="dreamy_blur">💧 Dreamy Blur Soft-Focus</option>
                    <option value="fisheye">🐟 Fisheye Action Cam</option>
                    <option value="vignette_burn">🌑 Vignette Dark Burn</option>
                    <option value="gameboy">🎮 Retro GameBoy 4-Shade</option>
                    <option value="vfx_breakdown">🎭 VFX Breakdown Wipe</option>
                    <option value="bw_to_color">☀️ B&W to Color Wipe</option>
                    <option value="posterize">🎨 Posterize Pop-Art</option>
                  </select>
                </div>

                {/* ── Customized Controls for Continuous / Rhythmic Mirror ── */}
                {(selectedClip.fxSettings.type === 'continuous_mirror' || selectedClip.fxSettings.type === 'rhythmic_mirror') && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Flip Speed / Interval</label>
                        <span className="font-mono text-amber-400 text-[10px]">Every {selectedClip.fxSettings.flipInterval ?? 0.5}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="2.0"
                        step="0.05"
                        value={selectedClip.fxSettings.flipInterval ?? 0.5}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, flipInterval: Number(e.target.value) } })}
                        className="flex-1 accent-amber-500"
                      />
                      <div className="flex gap-1 pt-0.5">
                        {[
                          { label: '0.2s Fast', val: 0.2 },
                          { label: '0.5s Normal', val: 0.5 },
                          { label: '1.0s Slow', val: 1.0 },
                        ].map((p) => (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, flipInterval: p.val } })}
                            className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
                              (selectedClip.fxSettings!.flipInterval ?? 0.5) === p.val
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                                : 'bg-[var(--theme-bg-app)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Flip Axis</label>
                      <select
                        value={selectedClip.fxSettings.flipAxis ?? 'horizontal'}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, flipAxis: e.target.value as any } })}
                        className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1"
                      >
                        <option value="horizontal">↔ Horizontal Flip (Walking/Action)</option>
                        <option value="vertical">↕ Vertical Flip</option>
                        <option value="both">⤢ Both Axes (Dual Flip)</option>
                        <option value="alternate">🔄 Alternate Axes Horiz/Vert</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Mirror Mode</label>
                      <select
                        value={selectedClip.fxSettings.mirrorMode ?? 'flip'}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, mirrorMode: e.target.value as any } })}
                        className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1"
                      >
                        <option value="flip">Full Frame Flip (Whole canvas alternates)</option>
                        <option value="symmetric">Symmetric Mirror (Left/Right halves alternate)</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={selectedClip.fxSettings.impactFlash !== false}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, impactFlash: e.target.checked } })}
                        className="w-3.5 h-3.5 accent-amber-500 rounded"
                      />
                      <span className="text-[11px] text-[var(--theme-text-primary)]">Flash Impact Burst on Flip</span>
                    </label>
                  </div>
                )}

                {/* ── Customized Controls for Mirror ── */}
                {selectedClip.fxSettings.type === 'mirror' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Mirror Reflection Style</label>
                      <select
                        value={selectedClip.fxSettings.mirrorStyle ?? 'left_to_right'}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, mirrorStyle: e.target.value as any } })}
                        className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1"
                      >
                        <option value="left_to_right">Left-to-Right Symmetry</option>
                        <option value="right_to_left">Right-to-Left Symmetry</option>
                        <option value="top_to_bottom">Top-to-Bottom Symmetry</option>
                        <option value="bottom_to_top">Bottom-to-Top Symmetry</option>
                        <option value="quad">4-Quadrant Kaleidoscope</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* ── Customized Controls for Glitch ── */}
                {selectedClip.fxSettings.type === 'glitch' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Jitter Frequency / Speed</label>
                        <span className="font-mono text-rose-400 text-[10px]">{selectedClip.fxSettings.glitchSpeed ?? 12} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="24"
                        step="1"
                        value={selectedClip.fxSettings.glitchSpeed ?? 12}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, glitchSpeed: Number(e.target.value) } })}
                        className="flex-1 accent-rose-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Slice Band Density</label>
                        <span className="font-mono text-rose-400 text-[10px]">{selectedClip.fxSettings.glitchBands ?? 20} slices</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={selectedClip.fxSettings.glitchBands ?? 20}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, glitchBands: Number(e.target.value) } })}
                        className="flex-1 accent-rose-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">RGB Chromatic Shift</label>
                        <span className="font-mono text-rose-400 text-[10px]">{selectedClip.fxSettings.rgbSplitDistance ?? 6} px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={selectedClip.fxSettings.rgbSplitDistance ?? 6}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, rgbSplitDistance: Number(e.target.value) } })}
                        className="flex-1 accent-rose-500"
                      />
                    </div>
                  </div>
                )}

                {/* ── Customized Controls for RGB Split ── */}
                {selectedClip.fxSettings.type === 'rgb_split' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Chromatic Offset</label>
                        <span className="font-mono text-red-400 text-[10px]">{selectedClip.fxSettings.rgbSplitDistance ?? 6} px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={selectedClip.fxSettings.rgbSplitDistance ?? 6}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, rgbSplitDistance: Number(e.target.value) } })}
                        className="flex-1 accent-red-500"
                      />
                    </div>
                  </div>
                )}

                {/* ── Customized Controls for Cinematic Bars ── */}
                {selectedClip.fxSettings.type === 'cinematic_bars' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Aspect Ratio Preset</label>
                      <select
                        value={selectedClip.fxSettings.barRatio ?? '2.39:1'}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, barRatio: e.target.value } })}
                        className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1"
                      >
                        <option value="2.39:1">2.39:1 Anamorphic Widescreen</option>
                        <option value="2.35:1">2.35:1 Cinema Scope</option>
                        <option value="4:3">4:3 Retro Academy Ratio</option>
                        <option value="1:1">1:1 Square Pillarbox</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* ── Customized Controls for Subject Outline Flash ── */}
                {selectedClip.fxSettings.type === 'subject_outline_flash' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Neon Glow Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedClip.fxSettings.outlineColor || '#00f0ff'}
                          onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, outlineColor: e.target.value } })}
                          className="w-7 h-7 rounded border border-[var(--theme-border)] bg-transparent cursor-pointer"
                        />
                        <div className="flex gap-1">
                          {['#00f0ff', '#f43f5e', '#facc15', '#a855f7', '#22c55e', '#ffffff'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, outlineColor: c } })}
                              className="w-4 h-4 rounded-full border border-[var(--theme-border)] transition-transform hover:scale-110"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                        Flash Speed
                        <span className="font-mono text-cyan-400">{selectedClip.fxSettings.strobeSpeed ?? 8} Hz</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="16"
                        step="1"
                        value={selectedClip.fxSettings.strobeSpeed ?? 8}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, strobeSpeed: Number(e.target.value) } })}
                        className="flex-1 accent-cyan-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                        Outline Stroke Width
                        <span className="font-mono text-cyan-400">{selectedClip.fxSettings.outlineWidth ?? 3} px</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={selectedClip.fxSettings.outlineWidth ?? 3}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, outlineWidth: Number(e.target.value) } })}
                        className="flex-1 accent-cyan-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                        Neon Glow Radius
                        <span className="font-mono text-cyan-400">{selectedClip.fxSettings.glowBlur ?? 14} px</span>
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        step="2"
                        value={selectedClip.fxSettings.glowBlur ?? 14}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, glowBlur: Number(e.target.value) } })}
                        className="flex-1 accent-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* ── Customized Controls for Action Zoom Pulse ── */}
                {selectedClip.fxSettings.type === 'action_zoom_pulse' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                        Pulse Frequency (Speed)
                        <span className="font-mono text-cyan-400">{selectedClip.fxSettings.pulseSpeed ?? 2} Hz</span>
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.5"
                        value={selectedClip.fxSettings.pulseSpeed ?? 2}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, pulseSpeed: Number(e.target.value) } })}
                        className="flex-1 accent-cyan-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                        Zoom Amplitude
                        <span className="font-mono text-cyan-400">+{selectedClip.fxSettings.pulseDepth ?? 20}%</span>
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={selectedClip.fxSettings.pulseDepth ?? 20}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, pulseDepth: Number(e.target.value) } })}
                        className="flex-1 accent-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* ── Customized Controls for Impact Strobe ── */}
                {selectedClip.fxSettings.type === 'action_strobe' && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                        Strobe Speed
                        <span className="font-mono text-yellow-300">{selectedClip.fxSettings.strobeSpeed ?? 8} Hz</span>
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="16"
                        step="1"
                        value={selectedClip.fxSettings.strobeSpeed ?? 8}
                        onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, strobeSpeed: Number(e.target.value) } })}
                        className="flex-1 accent-yellow-400"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 pt-2 border-t border-[#2a2a2a]">
                  <label className="text-[10px] text-[var(--theme-text-muted)] flex justify-between">
                    FX Master Intensity
                    <span className="font-mono text-rose-400">{selectedClip.fxSettings.intensity ?? 100}%</span>
                  </label>
                  <input type="range" min="0" max="100"
                    value={selectedClip.fxSettings.intensity ?? 100}
                    onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, intensity: Number(e.target.value) } })}
                    className="flex-1 accent-rose-500"
                  />
                </div>
              </div>
            )}

            {/* ── Particle Settings ── */}
            {selectedClip.particleSettings && (() => {
              const ps = selectedClip.particleSettings!;
              const upd = (patch: Partial<typeof ps>) =>
                updateClip(selectedClip.id, { particleSettings: { ...ps, ...patch } });

              return (
                <div className="flex flex-col gap-3 bg-[var(--theme-bg-subpanel)] rounded p-3 border border-violet-500/20">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">✦ Particle Effect</p>
                    <button
                      onClick={() => updateClip(selectedClip.id, { particleSettings: undefined })}
                      className="text-[9px] text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >Remove</button>
                  </div>

                  {/* Type selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[var(--theme-text-muted)]">Effect Type</label>
                    <select
                      value={ps.type}
                      onChange={(e) => upd({ type: e.target.value as any })}
                      className="bg-[var(--theme-bg-subpanel)] text-white text-xs border border-[var(--theme-border)] rounded px-2 py-1.5 focus:outline-none focus:border-violet-500"
                    >
                      <option value="snow">❄️ Snow</option>
                      <option value="rain">🌧️ Rain</option>
                      <option value="fire">🔥 Fire</option>
                      <option value="sparkles">✨ Sparkles</option>
                      <option value="confetti">🎊 Confetti</option>
                      <option value="smoke">💨 Smoke</option>
                      <option value="bubbles">🫧 Bubbles</option>
                      <option value="leaves">🍂 Leaves</option>
                      <option value="hearts">💖 Hearts</option>
                      <option value="matrix">💻 Matrix</option>
                    </select>
                  </div>

                  {/* Emitter Position */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[var(--theme-text-muted)]">Emitter Position</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-[#6a6a6a]">X — {Math.round(ps.emitterX)}%</span>
                        <input type="range" min="0" max="100" value={ps.emitterX}
                          onChange={(e) => upd({ emitterX: Number(e.target.value) })}
                          className="w-full accent-violet-500" />
                      </div>
                      <div>
                        <span className="text-[9px] text-[#6a6a6a]">Y — {Math.round(ps.emitterY)}%</span>
                        <input type="range" min="0" max="100" value={ps.emitterY}
                          onChange={(e) => upd({ emitterY: Number(e.target.value) })}
                          className="w-full accent-violet-500" />
                      </div>
                    </div>
                    <p className="text-[9px] text-[#4a4a4a]">Or click on the preview canvas to set emitter position</p>
                  </div>

                  {/* Core controls */}
                  {([
                    { key: 'amount',    label: 'Amount',    min: 1,    max: 500, unit: '' },
                    { key: 'speed',     label: 'Speed',     min: 0,    max: 200, unit: '%' },
                    { key: 'intensity', label: 'Opacity',   min: 0,    max: 100, unit: '%' },
                    { key: 'size',      label: 'Size',      min: 10,   max: 300, unit: '%' },
                  ] as const).map(({ key, label, min, max, unit }) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[var(--theme-text-muted)]">{label}</span>
                        <span className="text-[10px] text-[var(--theme-text-primary)]">{ps[key]}{unit}</span>
                      </div>
                      <input type="range" min={min} max={max} value={ps[key]}
                        onChange={(e) => upd({ [key]: Number(e.target.value) } as any)}
                        className="w-full accent-violet-500" />
                    </div>
                  ))}

                  {/* Physics */}
                  <p className="text-[9px] font-semibold text-[#6a6a6a] uppercase tracking-wider mt-1">Physics</p>
                  {([
                    { key: 'gravity',     label: 'Gravity',     min: -100, max: 100, unit: '' },
                    { key: 'wind',        label: 'Wind',        min: -100, max: 100, unit: '' },
                    { key: 'spread',      label: 'Spread',      min: 0,    max: 180, unit: '°' },
                    { key: 'lifetime',    label: 'Lifetime',    min: 10,   max: 300, unit: '%' },
                    { key: 'turbulence',  label: 'Turbulence',  min: 0,    max: 100, unit: '' },
                  ] as const).map(({ key, label, min, max, unit }) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-[var(--theme-text-muted)]">{label}</span>
                        <span className="text-[10px] text-[var(--theme-text-primary)]">{ps[key]}{unit}</span>
                      </div>
                      <input type="range" min={min} max={max} value={ps[key]}
                        onChange={(e) => upd({ [key]: Number(e.target.value) } as any)}
                        className="w-full accent-cyan-500" />
                    </div>
                  ))}

                  {/* Visual */}
                  <p className="text-[9px] font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mt-1">Visual</p>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Color Variance</span>
                      <span className="text-[10px] text-[var(--theme-text-primary)]">{ps.colorVariance}</span>
                    </div>
                    <input type="range" min="0" max="100" value={ps.colorVariance}
                      onChange={(e) => upd({ colorVariance: Number(e.target.value) })}
                      className="w-full accent-pink-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--theme-text-muted)]">Base Color</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[var(--theme-text-muted)]">{ps.color === 'auto' ? 'auto' : ps.color}</span>
                      {ps.color !== 'auto' && (
                        <input type="color" value={ps.color}
                          onChange={(e) => upd({ color: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-[var(--theme-border)] bg-transparent" />
                      )}
                      <button
                        onClick={() => upd({ color: ps.color === 'auto' ? '#ffffff' : 'auto' })}
                        className="text-[9px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] px-1.5 py-0.5 border border-[var(--theme-border)] rounded-md"
                      >{ps.color === 'auto' ? 'Custom' : 'Auto'}</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--theme-text-muted)]">Glow Effect</span>
                    <button
                      onClick={() => upd({ glow: !ps.glow })}
                      className={`text-[9px] px-2 py-0.5 rounded-md border transition-colors ${ps.glow ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500 font-bold' : 'border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'}`}
                    >{ps.glow ? 'ON' : 'OFF'}</button>
                  </div>
                </div>
              );
            })()}

            {/* Keying and Blend controls are displayed above */}
          </div>
        )}

        {/* Thumbnail Designer Tab */}
        {currentTab === 'thumbnail' && (
          <div className="flex flex-col gap-4">
            <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-4 flex flex-col gap-3 shadow-sm">
              <h3 className="text-xs font-bold text-[var(--theme-text-primary)] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                Thumbnail Designer
              </h3>
              <p className="text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
                Add text, stickers, and shapes to the timeline to design your thumbnail. Click the button below to capture the current frame as an image.
              </p>
              
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-[var(--theme-text-primary)] font-semibold flex-1 cursor-pointer select-none">
                  Show YouTube Safe Zones
                </label>
                <button
                  onClick={() => {
                     const current = useEditorStore.getState().settings.showSafeZones;
                     useEditorStore.getState().updateSettings({ showSafeZones: !current });
                  }}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    useEditorStore.getState().settings.showSafeZones ? 'bg-blue-600' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white absolute top-[1px] transition-all shadow-sm ${
                    useEditorStore.getState().settings.showSafeZones ? 'left-[17px]' : 'left-[1px]'
                  }`} />
                </button>
              </div>

              <button
                onClick={() => {
                   const canvas = document.querySelector('#preview-canvas, .preview-canvas') as HTMLCanvasElement;
                   if (!canvas) {
                     toast.warning("Preview canvas not found!");
                     return;
                   }
                   const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                   const link = document.createElement('a');
                   link.download = 'thumbnail.jpg';
                   link.href = dataUrl;
                   link.click();
                }}
                className="mt-2 w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Capture High-Res Thumbnail
              </button>
            </div>
            
            <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-4 flex flex-col gap-3 shadow-sm">
              <h3 className="text-xs font-bold text-[var(--theme-text-primary)]">Quick Branding</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                     useEditorStore.getState().insertTextClip({ text: 'BRAND NAME', fontSize: 40 });
                  }}
                  className="py-2.5 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] rounded-lg text-[10px] font-semibold transition-colors flex flex-col items-center gap-1 shadow-sm"
                >
                  <Type className="w-4 h-4 text-blue-500" />
                  Add Bold Text
                </button>
                <button
                  onClick={() => {
                     const input = document.createElement('input');
                     input.type = 'file';
                     input.accept = 'image/*';
                     input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                           useEditorStore.getState().addMedia({
                               id: Math.random().toString(36).substr(2, 9),
                               name: file.name,
                               type: 'image',
                               url: URL.createObjectURL(file),
                               duration: 5,
                               createdAt: Date.now(),
                           });
                        }
                     };
                     input.click();
                  }}
                  className="py-2.5 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] rounded-lg text-[10px] font-semibold transition-colors flex flex-col items-center gap-1 shadow-sm"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Import Logo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── History Tab ─────────────────────────────────────────────────── */}
        {currentTab === 'history' && (
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="p-3 border border-[var(--theme-border)] rounded-xl bg-[var(--theme-bg-subpanel)] flex items-center justify-between shrink-0 shadow-sm">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Undo/Redo History</span>
              <span className="text-[9px] text-[var(--theme-text-muted)] bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-md px-2 py-0.5 font-mono font-medium">
                {historyLength} Actions
              </span>
            </div>

            {/* List */}
            <div className="space-y-1.5">
              {history.map((snap, idx) => {
                const isActive = idx === historyIndex;
                const isFuture = idx > historyIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => jumpToHistoryIndex(idx)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border shadow-sm ${
                      isActive
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                        : isFuture
                        ? 'bg-[var(--theme-bg-subpanel)]/40 border-transparent text-[var(--theme-text-muted)]/40 hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)]'
                        : 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] text-[var(--theme-text-primary)] hover:border-blue-500/40 hover:bg-black/5 dark:hover:bg-[var(--theme-bg-subpanel)]'
                    }`}
                  >
                    {/* Visual Line Node */}
                    <div className="relative flex items-center justify-center shrink-0 w-4">
                      {idx < historyLength - 1 && (
                        <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                          isFuture ? 'bg-[var(--theme-border)]/40' : 'bg-blue-500/30'
                        }`} />
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                        isActive
                          ? 'bg-blue-500 border-blue-500 ring-4 ring-blue-500/20 scale-110'
                          : isFuture
                          ? 'bg-transparent border-[var(--theme-border)]'
                          : 'bg-blue-500/40 border-blue-500/80'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs truncate block font-medium">{snap.label || 'Action'}</span>
                      <span className="text-[9px] opacity-60 block mt-0.5 font-mono">
                        {idx === 0 ? 'Base State' : `Step ${idx}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentTab === 'pip' && selectedClip && (() => {
          // Find the relevant PIP window
          let pipId = '';
          
          if (selectedClip.pipWindowIds?.length) {
            // Selected clip is a PIP parent — show the first PIP window config
            pipId = selectedClip.pipWindowIds[0];
          } else if (isPipClip && parentPipWindowId) {
            // Selected clip is inside a PIP window — show that PIP window config
            pipId = parentPipWindowId;
          }

          if (!pipId) return null;
          
          const pipWin = pipWindows?.[pipId];
          if (!pipWin) return null;

          return (
            <PipTab
              pipWindow={pipWin}
              pipId={pipId}
              onStyleChange={(updates) => updatePipWindowStyle(pipId!, updates)}
              onEnterExitChange={(updates) => updatePipWindowEnterExit(pipId!, updates)}
            />
          );
        })()}
      </div>

      {showSoundDesigner && soundDesignerCues && selectedClip && (
        <Suspense fallback={null}>
          <AiSoundDesigner
            clip={selectedClip}
            cues={soundDesignerCues}
            onClose={() => setShowSoundDesigner(false)}
          />
        </Suspense>
      )}

      {showMotionGraphicsDesigner && motionGraphicsSuggestions && selectedClip && (
        <Suspense fallback={null}>
          <AiMotionGraphicsDesigner
            clip={selectedClip}
            suggestions={motionGraphicsSuggestions}
            onClose={() => setShowMotionGraphicsDesigner(false)}
          />
        </Suspense>
      )}


    </div>
  );
}
