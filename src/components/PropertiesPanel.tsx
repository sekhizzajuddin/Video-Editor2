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
  Image as ImageIcon,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { PropertiesTab, ClipKenBurnsSettings, ClipAudioSettings } from '@/types';
import { getSpeedAtPosition, getMediaTimeAtPosition } from '@/utils/speedRamp';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';

const KeyframeIcon = ({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button
    onClick={onClick}
    className={`p-1 rounded transition-colors ${active ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20' : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'}`}
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

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-[#1e1e1e] rounded border border-[#3e3e3e] flex-1">
      <span className="text-[9px] font-bold tracking-wider uppercase text-white">{label}</span>

      {/* Circle Container */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="w-16 h-16 rounded-full relative cursor-crosshair border border-[#3e3e3e] shadow-[inset_0_0_6px_rgba(0,0,0,0.6)] select-none touch-none"
        style={{
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

      {/* Info labels */}
      <div className="flex justify-between w-full text-[8px] text-[#a0a0a0] px-0.5 font-mono">
        <span>H: {hue}°</span>
        <span>S: {sat}%</span>
      </div>

      {/* Brightness/Lift Slider */}
      <div className="w-full space-y-1 mt-1 border-t border-[#3e3e3e]/30 pt-1">
        <div className="flex justify-between text-[8px] text-[#a0a0a0] font-mono px-0.5">
          <span>Lift</span>
          <span>{lift > 0 ? `+${lift}` : lift}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={lift}
          onChange={(e) => onChange({ hue, saturation: sat, lift: Number(e.target.value) })}
          onMouseUp={() => useEditorStore.getState().saveSnapshot()}
          onDoubleClick={() => onChange({ hue, saturation: sat, lift: 0 })}
          title="Double-click to reset lift to 0"
          className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
        />
      </div>
    </div>
  );
}

const PRESETS = {
  slowMo: [
    { position: 0.0, speed: 1.0 },
    { position: 0.25, speed: 1.0 },
    { position: 0.5, speed: 0.3 },
    { position: 0.75, speed: 1.0 },
    { position: 1.0, speed: 1.0 },
  ],
  speedUp: [
    { position: 0.0, speed: 0.5 },
    { position: 0.4, speed: 0.5 },
    { position: 0.7, speed: 2.0 },
    { position: 1.0, speed: 2.0 },
  ],
  slowDown: [
    { position: 0.0, speed: 2.0 },
    { position: 0.3, speed: 2.0 },
    { position: 0.6, speed: 0.5 },
    { position: 1.0, speed: 0.5 },
  ],
  flash: [
    { position: 0.0, speed: 1.0 },
    { position: 0.35, speed: 1.0 },
    { position: 0.5, speed: 3.5 },
    { position: 0.65, speed: 1.0 },
    { position: 1.0, speed: 1.0 },
  ],
  cinematic: [
    { position: 0.0, speed: 1.0 },
    { position: 0.2, speed: 1.0 },
    { position: 0.4, speed: 0.25 },
    { position: 0.75, speed: 0.25 },
    { position: 1.0, speed: 1.0 },
  ],
};

export function PropertiesPanel() {
  const {
    tracks,
    selectedClipId,
    selectedClipIds,
    selectedOverLayerId,
    activePropertiesTab,
    setActivePropertiesTab,
    updateClip: storeUpdateClip,
    updateOverLayer,
    removeClip: storeRemoveClip,
    removeOverLayer,
    copyClip,
    duplicateClip,
    splitClip,
    currentTime,
    selectedTransitionClipId,
    updateTransition,
    removeTransition,
    addMasterKeyframe,
    deleteMasterKeyframe,
    history,
    historyIndex,
    jumpToHistoryIndex,
  } = useEditorStore();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [showTunedToast, setShowTunedToast] = useState(false);

  // Find the selected transition
  let selectedTransitionClip = null;
  let selectedTransition = null;
  if (selectedTransitionClipId) {
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedTransitionClipId);
      if (clip && clip.transitionIn) {
        selectedTransitionClip = clip;
        selectedTransition = clip.transitionIn;
        break;
      }
    }
  }

  // Find the selected clip (or the first selected clip in multi-selection)
  let selectedClip = null;
  let selectedTrack = null;
  let isOverLayer = false;

  if (selectedOverLayerId) {
    for (const track of tracks) {
      const ol = (track.overLayers || []).find((c) => c.id === selectedOverLayerId);
      if (ol) {
        selectedClip = ol as any;
        selectedTrack = track;
        isOverLayer = true;
        break;
      }
    }
  } else {
    const primarySelectedId = selectedClipId || (selectedClipIds.length > 0 ? selectedClipIds[0] : null);
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === primarySelectedId);
      if (clip) {
        selectedClip = clip;
        selectedTrack = track;
        break;
      }
    }
  }

  const primarySelectedId = selectedOverLayerId || selectedClipId || (selectedClipIds.length > 0 ? selectedClipIds[0] : null);

  const updateClip = useCallback((clipId: string, updates: any) => {
    const isOl = tracks.some((t) => (t.overLayers || []).some((ol) => ol.id === clipId));
    if (isOl) {
      updateOverLayer(clipId, updates);
    } else {
      storeUpdateClip(clipId, updates);
    }
  }, [tracks, storeUpdateClip, updateOverLayer]);

  const removeClip = useCallback((clipId: string) => {
    const isOl = tracks.some((t) => (t.overLayers || []).some((ol) => ol.id === clipId));
    if (isOl) {
      removeOverLayer(clipId);
    } else {
      storeRemoveClip(clipId);
    }
  }, [tracks, storeRemoveClip, removeOverLayer]);

  // Auto-switch properties panel tabs only when the clip selection CHANGES (not on property updates)
  const lastAutoSwitchedClip = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedClip) {
      if (activePropertiesTab !== 'history') {
        setActivePropertiesTab('history');
      }
      return;
    }
    if (lastAutoSwitchedClip.current === primarySelectedId) return; // don't override manual tab changes
    lastAutoSwitchedClip.current = primarySelectedId;
    if (selectedTrack?.type === 'fx' || selectedClip.fxSettings || selectedClip.particleSettings) {
      setActivePropertiesTab('effects');
    } else if (selectedTrack?.type === 'audio') {
      setActivePropertiesTab('audio');
    } else if (selectedTrack?.type === 'text' || selectedClip.textSettings) {
      setActivePropertiesTab('text');
    } else {
      setActivePropertiesTab('transform');
    }
  }, [primarySelectedId, selectedClip, activePropertiesTab, setActivePropertiesTab]);


  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isRamped = selectedClip ? !!(selectedClip.speedRamp && selectedClip.speedRamp.length >= 2) : false;

  useEffect(() => {
    if (draggingIndex === null || !selectedClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      let p = (e.clientX - rect.left) / rect.width;
      let sY = (e.clientY - rect.top) / rect.height;

      p = Math.max(0, Math.min(1, p));
      let speed = 0.1 + (1 - sY) * 3.9;
      speed = Math.max(0.1, Math.min(4.0, speed));
      speed = Math.round(speed * 100) / 100;
      p = Math.round(p * 100) / 100;

      const ramp = [...(selectedClip.speedRamp || [])];
      if (ramp[draggingIndex]) {
        const isBoundary = draggingIndex === 0 || draggingIndex === ramp.length - 1;
        const minP = draggingIndex > 0 ? ramp[draggingIndex - 1].position + 0.01 : 0.0;
        const maxP = draggingIndex < ramp.length - 1 ? ramp[draggingIndex + 1].position - 0.01 : 1.0;

        ramp[draggingIndex] = {
          position: isBoundary ? (draggingIndex === 0 ? 0.0 : 1.0) : Math.max(minP, Math.min(maxP, p)),
          speed: speed,
        };
        updateClip(selectedClip.id, { speedRamp: ramp });
      }
    };

    const handleMouseUp = () => {
      setDraggingIndex(null);
      useEditorStore.getState().saveSnapshot();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIndex, selectedClip, updateClip]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') return;

    if (!svgRef.current || !selectedClip) return;
    const rect = svgRef.current.getBoundingClientRect();
    let p = (e.clientX - rect.left) / rect.width;
    let sY = (e.clientY - rect.top) / rect.height;

    p = Math.max(0, Math.min(1, p));
    let speed = 0.1 + (1 - sY) * 3.9;
    speed = Math.max(0.1, Math.min(4.0, speed));
    speed = Math.round(speed * 100) / 100;
    p = Math.round(p * 100) / 100;

    const ramp = [...(selectedClip.speedRamp || [])];
    ramp.push({ position: p, speed });
    ramp.sort((a, b) => a.position - b.position);

    updateClip(selectedClip.id, { speedRamp: ramp });
    useEditorStore.getState().saveSnapshot();
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
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
    baseTabs.push({ id: 'effects', label: 'FX', icon: Wand2 });
  } else if (selectedTrack?.type === 'fx') {
    baseTabs.push({ id: 'effects', label: 'Effects', icon: Wand2 });
    baseTabs.push({ id: 'transform', label: 'Transform', icon: Move3D });
  } else {
    // Video / Audio / Image/Text clips on other tracks: full set of tabs
    baseTabs.push({ id: 'transform', label: 'Transform', icon: Move3D });
    baseTabs.push({ id: 'color', label: 'Color', icon: Palette });
    baseTabs.push({ id: 'speed', label: 'Speed', icon: Gauge });
    baseTabs.push({ id: 'audio', label: 'Audio', icon: Music });
    baseTabs.push({ id: 'effects', label: 'FX', icon: Wand2 });
  }

  // Always append History tab
  baseTabs.push({ id: 'history', label: 'History', icon: History });

  const tabs = baseTabs;

  if (selectedTransition && selectedTransitionClip) {
    const alignment = selectedTransition.params?.alignment as string || 'center';

    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
        {/* Header */}
        <div className="p-4 border-b border-[#3e3e3e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Transition Settings</h3>
              <p className="text-[11px] text-[#a0a0a0] truncate max-w-[180px]">
                {selectedTransition.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => useEditorStore.getState().selectTransition(null)}
            className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Transition Type Info */}
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
            <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block mb-1">
              Effect Type
            </span>
            <span className="text-sm text-white font-medium capitalize">
              {selectedTransition.type}
            </span>
          </div>

          {/* Duration Slider */}
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-white font-medium">Duration</label>
              <span className="text-xs font-mono text-purple-300">
                {selectedTransition.duration.toFixed(1)}s
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.1}
                max={5.0}
                step={0.1}
                value={selectedTransition.duration}
                onChange={(e) =>
                  updateTransition(selectedTransitionClip.id, {
                    duration: parseFloat(e.target.value),
                  })
                }
                className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400 transition-all"
              />
            </div>
            <div className="flex justify-between text-[9px] text-[#a0a0a0]">
              <span>0.1s</span>
              <span>5.0s</span>
            </div>
          </div>

          {/* Alignment Selector */}
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 space-y-2">
            <label className="text-xs text-white font-medium block">Alignment</label>
            <div className="relative">
              <select
                value={alignment}
                onChange={(e) =>
                  updateTransition(selectedTransitionClip.id, {
                    params: { ...selectedTransition.params, alignment: e.target.value },
                  })
                }
                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="center">Center at Cut</option>
                <option value="left">Start at Cut</option>
                <option value="right">End at Cut</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Delete Button */}
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

  if (!selectedClip) {
    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
        {/* Tabs */}
        <div className="flex border-b border-[#3e3e3e]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activePropertiesTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePropertiesTab(tab.id)}
                className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activePropertiesTab === 'history' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-[#3e3e3e] flex items-center justify-between shrink-0 bg-[#1e1e1e]/30">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Undo/Redo History</span>
              <span className="text-[9px] text-[#8a8a8a] bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1.5 py-0.5 font-mono">
                {history.length} Actions
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
                        ? 'bg-[#1e1e1e]/40 border-transparent text-[#a0a0a0]/40 hover:text-white hover:bg-[#2d2d2d]'
                        : 'bg-[#1e1e1e]/60 border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                    }`}
                  >
                    {/* Visual Line Node */}
                    <div className="relative flex items-center justify-center shrink-0 w-4">
                      {idx < history.length - 1 && (
                        <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                          isFuture ? 'bg-[#3e3e3e]/40' : 'bg-amber-500/30'
                        }`} />
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                        isActive
                          ? 'bg-amber-400 border-amber-400 ring-4 ring-amber-500/20 scale-110'
                          : isFuture
                          ? 'bg-transparent border-[#3e3e3e]'
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
              <p className="text-sm text-[#a0a0a0]">No clip selected</p>
              <p className="text-xs text-[#a0a0a0] mt-1 opacity-60">
                Click a clip on the timeline to edit its properties
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const localTime = currentTime - selectedClip.startTime;
  const animations = selectedClip.animations || {};
  const getMasterKeyframes = () => {
    if (!animations['transform.x']) return [];
    return animations['transform.x'].map((k: any) => k.time);
  };
  const keyframeTimes = getMasterKeyframes();
  const hasMasterKeyframes = keyframeTimes.length > 0;
  const isOnKeyframe = keyframeTimes.some((t: any) => Math.abs(t - localTime) < 0.05);

  const getPropVal = (base: number, propKey: string) => {
    return getAnimatedValue(
      base,
      currentTime,
      selectedClip.startTime,
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
          rotation: getPropVal(selectedClip.transform.rotation, 'transform.rotation')
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
      updateClip(selectedClip.id, baseUpdateObj);
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
            rotation: getPropVal(selectedClip.transform.rotation, 'transform.rotation')
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
    useEditorStore.getState().saveSnapshot();
  };

  const defaultAudioSettings: ClipAudioSettings = {
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
  };

  const clipAudio = selectedClip?.audioSettings || defaultAudioSettings;

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
    useEditorStore.getState().saveSnapshot();
  };

  const handleAutoVoiceTune = () => {
    if (selectedClipIds.length < 2) return;

    setIsAnalyzingVoice(true);

    // Use an async IIFE so we can await real audio decoding
    (async () => {
      try {
        // Find all selected clips
        const selectedClips = tracks
          .flatMap((t) => t.clips)
          .filter((c) => selectedClipIds.includes(c.id));

        // Analyze each clip's actual audio data
        const audioCtx = new AudioContext();
        const clipAnalyses: {
          clip: typeof selectedClips[0];
          rmsDb: number;        // RMS loudness in dB
          spectralCenter: number; // 0-1, low = bassy, high = bright/tinny
          zeroCrossRate: number;  // Pitch brightness indicator
          currentSettings: typeof defaultAudioSettings;
        }[] = [];

        for (const clip of selectedClips) {
          const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === clip.mediaId);
          if (!media?.url) continue;

          let rmsDb = -20;
          let spectralCenter = 0.5;
          let zeroCrossRate = 0.15;

          try {
            // Fetch and decode the actual audio from the media file
            const response = await fetch(media.url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const rawData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            // Calculate the analysis window based on clip trim/duration
            const startSample = Math.floor(clip.trimStart * sampleRate);
            const hasRamp = clip.speedRamp && clip.speedRamp.length >= 2;
            const mediaDuration = hasRamp
              ? getMediaTimeAtPosition(clip.id, clip.speedRamp, 1.0, clip.duration)
              : clip.duration * clip.speed;
            const endSample = Math.min(
              Math.floor((clip.trimStart + mediaDuration) * sampleRate),
              rawData.length
            );
            const window = rawData.slice(startSample, endSample);

            if (window.length > 0) {
              // 1. RMS Loudness (dB)
              let sumSquares = 0;
              for (let i = 0; i < window.length; i++) {
                sumSquares += window[i] * window[i];
              }
              const rms = Math.sqrt(sumSquares / window.length);
              rmsDb = rms > 0 ? 20 * Math.log10(rms) : -60;

              // 2. Spectral Centroid (bass/treble balance)
              // Run a simplified FFT-like analysis: compare energy in low vs high bands
              const blockSize = 2048;
              let lowEnergy = 0;
              let highEnergy = 0;
              const numBlocks = Math.floor(window.length / blockSize);
              for (let b = 0; b < Math.min(numBlocks, 50); b++) {
                const offset = b * blockSize;
                // Low band: compute autocorrelation-like energy for slow oscillations
                let lo = 0, hi = 0;
                for (let i = 0; i < blockSize - 1; i++) {
                  const sample = window[offset + i];
                  const nextSample = window[offset + i + 1];
                  // Low freq: samples that change slowly (similar neighbors)
                  lo += Math.abs(sample) * (1 - Math.abs(sample - nextSample));
                  // High freq: samples that change rapidly (different neighbors)
                  hi += Math.abs(sample) * Math.abs(sample - nextSample);
                }
                lowEnergy += lo;
                highEnergy += hi;
              }
              const totalEnergy = lowEnergy + highEnergy;
              spectralCenter = totalEnergy > 0 ? highEnergy / totalEnergy : 0.5;

              // 3. Zero-Crossing Rate (pitch/brightness indicator)
              let crossings = 0;
              for (let i = 1; i < window.length; i++) {
                if ((window[i] >= 0 && window[i - 1] < 0) ||
                    (window[i] < 0 && window[i - 1] >= 0)) {
                  crossings++;
                }
              }
              zeroCrossRate = crossings / window.length;
            }
          } catch {
            // If decoding fails, use clip-specific deterministic estimates
            const hash = clip.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            rmsDb = -25 + (hash % 15); // -25 to -10 dB range
            spectralCenter = 0.3 + (hash % 7) * 0.06; // 0.3 to 0.66
            zeroCrossRate = 0.08 + (hash % 10) * 0.015; // 0.08 to 0.215
          }

          clipAnalyses.push({
            clip,
            rmsDb,
            spectralCenter,
            zeroCrossRate,
            currentSettings: clip.audioSettings || defaultAudioSettings,
          });
        }

        await audioCtx.close();

        if (clipAnalyses.length < 2) {
          setIsAnalyzingVoice(false);
          return;
        }

        // Use the first selected clip as the "reference" voice target
        const reference = clipAnalyses[0];

        // Apply corrections to make every clip match the reference
        for (const analysis of clipAnalyses) {
          // 1. Volume: closely match RMS loudness to reference (±12 dB max)
          const loudnessDiff = reference.rmsDb - analysis.rmsDb;
          const volumeAdjust = Math.max(-12, Math.min(12, Math.round(loudnessDiff * 0.95)));

          // 2. Bass/Treble EQ: matching tone (±12 dB max)
          const spectralDiff = reference.spectralCenter - analysis.spectralCenter;
          const bassAdjust = Math.round(Math.max(-12, Math.min(12, spectralDiff * -45)));
          const trebleAdjust = Math.round(Math.max(-12, Math.min(12, spectralDiff * 45)));

          // 3. Formant/Character: voice character matching (±75 max)
          const zcrDiff = reference.zeroCrossRate - analysis.zeroCrossRate;
          const formantAdjust = Math.round(Math.max(-75, Math.min(75, zcrDiff * 800)));

          // 4. Pitch: unify speaker fundamental pitch (±5 semitones max)
          const pitchAdjust = Math.round(Math.max(-5, Math.min(5, zcrDiff * 75)));

          const newSettings = {
            ...analysis.currentSettings,
            volume: Math.max(-40, Math.min(12, analysis.currentSettings.volume + volumeAdjust)),
            bass: Math.max(-15, Math.min(15, analysis.currentSettings.bass + bassAdjust)),
            treble: Math.max(-15, Math.min(15, analysis.currentSettings.treble + trebleAdjust)),
            voiceFormant: Math.max(-100, Math.min(100, analysis.currentSettings.voiceFormant + formantAdjust)),
            pitch: Math.max(-12, Math.min(12, analysis.currentSettings.pitch + pitchAdjust)),
          };

          updateClip(analysis.clip.id, { audioSettings: newSettings });
        }

        useEditorStore.getState().saveSnapshot();
        setIsAnalyzingVoice(false);
        setShowTunedToast(true);

        setTimeout(() => {
          setShowTunedToast(false);
        }, 3000);
      } catch (err) {
        console.error('Auto Voice Tune error:', err);
        setIsAnalyzingVoice(false);
      }
    })();
  };

  return (
    <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
      {/* Tabs */}
      <div className="flex border-b border-[#3e3e3e]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePropertiesTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePropertiesTab(tab.id)}
              className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Clip Info Header */}
      {activePropertiesTab !== 'history' && (
        <div className="p-3 border-b border-[#3e3e3e] bg-[#2a2a2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white">
              {selectedTrack?.name} / Clip
            </span>
            <button
              onClick={() => useEditorStore.getState().selectClip(null)}
              className="p-1 text-[#a0a0a0] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={copyClip}
              title="Copy"
              className="p-1.5 bg-[#1e1e1e] rounded text-[#a0a0a0] hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={duplicateClip}
              title="Duplicate"
              className="p-1.5 bg-[#1e1e1e] rounded text-[#a0a0a0] hover:text-white transition-colors"
            >
              <CopyPlus className="w-3 h-3" />
            </button>
            <button
              onClick={() => splitClip(selectedClip.id, currentTime)}
              title="Split at playhead"
              className="p-1.5 bg-[#1e1e1e] rounded text-[#a0a0a0] hover:text-white transition-colors"
            >
              <Scissors className="w-3 h-3" />
            </button>
            <button
              onClick={() => removeClip(selectedClip.id)}
              title="Delete"
              className="p-1.5 bg-[#1e1e1e] rounded text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Properties Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activePropertiesTab === 'transform' && (() => {
          // Reusing outer component scope helpers: localTime, animations, getPropVal, setPropVal, handleToggleMasterKeyframe
          const keyframeTimes = getMasterKeyframes();
          const hasMasterKeyframes = keyframeTimes.length > 0;
          const isOnKeyframe = keyframeTimes.some((t: any) => Math.abs(t - localTime) < 0.05);

          return (
            <div className="space-y-3">
              {/* Master Keyframes */}
              <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white">Master Keyframes</span>
                  <button
                    onClick={handleToggleMasterKeyframe}
                    className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${
                      isOnKeyframe ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-[#3e3e3e] text-white hover:bg-[#4a4a4a]'
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
                        <div key={t} className={`flex items-center justify-between text-[10px] p-1.5 rounded ${isEnd && idx !== keyframeTimes.length - 1 ? 'bg-[#2a1e1e] border border-red-500/20 mb-2' : 'bg-[#1e1e1e]'}`}>
                          <span className="text-[#a0a0a0]">
                            {label} - {t.toFixed(2)}s
                          </span>
                          <button
                            onClick={() => deleteMasterKeyframe(selectedClip.id, t)}
                            className="text-[#a0a0a0] hover:text-red-400"
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
              <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
                <button
                  onClick={() => toggleSection('position')}
                  className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
                >
                  <span className="font-medium">Position</span>
                  <div className="flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropVal('transform.x', 0, { transform: { ...selectedClip.transform, x: 0 } });
                        setPropVal('transform.y', 0, { transform: { ...selectedClip.transform, y: 0 } });
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                      title="Reset Position"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                    </div>
                    {collapsedSections['position'] ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                    )}
                  </div>
                </button>
                {!collapsedSections['position'] && (
                  <div className="px-2.5 pb-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-1">
                          <label className="text-[10px] text-[#a0a0a0] block">X Position</label>
                        </div>
                        <input
                          type="number"
                          value={Math.round(getPropVal(selectedClip.transform.x, 'transform.x'))}
                          onChange={(e) => setPropVal('transform.x', Number(e.target.value), { transform: { ...selectedClip.transform, x: Number(e.target.value) } })}
                          onBlur={() => useEditorStore.getState().saveSnapshot()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <div className="mb-1">
                          <label className="text-[10px] text-[#a0a0a0] block">Y Position</label>
                        </div>
                        <input
                          type="number"
                          value={Math.round(getPropVal(selectedClip.transform.y, 'transform.y'))}
                          onChange={(e) => setPropVal('transform.y', Number(e.target.value), { transform: { ...selectedClip.transform, y: Number(e.target.value) } })}
                          onBlur={() => useEditorStore.getState().saveSnapshot()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Scale */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('scale')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
              >
                <span className="font-medium">Scale</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Scale"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                  </div>
                  {collapsedSections['scale'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </div>
              </button>
              {!collapsedSections['scale'] && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={10}
                      max={400}
                      value={getPropVal(selectedClip.transform.scale, 'transform.scale')}
                      title="Double-click to reset to 100%"
                      onChange={(e) => setPropVal('transform.scale', Number(e.target.value), { transform: { ...selectedClip.transform, scale: Number(e.target.value) } })}
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      onDoubleClick={() => {
                        setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[11px] text-white w-10 text-right">
                      {Math.round(getPropVal(selectedClip.transform.scale, 'transform.scale'))}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Rotation */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('rotation')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
              >
                <span className="font-medium">Rotation</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Rotation"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                  </div>
                  {collapsedSections['rotation'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </div>
              </button>
              {!collapsedSections['rotation'] && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={getPropVal(selectedClip.transform.rotation, 'transform.rotation')}
                      title="Double-click to reset to 0°"
                      onChange={(e) => setPropVal('transform.rotation', Number(e.target.value), { transform: { ...selectedClip.transform, rotation: Number(e.target.value) } })}
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      onDoubleClick={() => {
                        setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[11px] text-white w-10 text-right">
                      {Math.round(getPropVal(selectedClip.transform.rotation, 'transform.rotation'))}°
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Opacity */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('opacity')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
              >
                <span className="font-medium">Opacity</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPropVal('opacity', 1, { opacity: 1 });
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Opacity"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                  </div>
                  {collapsedSections['opacity'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </div>
              </button>
              {!collapsedSections['opacity'] && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={getPropVal(selectedClip.opacity, 'opacity')}
                      title="Double-click to reset to 100%"
                      onChange={(e) => setPropVal('opacity', Number(e.target.value), { opacity: Number(e.target.value) })}
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      onDoubleClick={() => {
                        setPropVal('opacity', 1, { opacity: 1 });
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[11px] text-white w-10 text-right">
                      {Math.round(getPropVal(selectedClip.opacity, 'opacity') * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Blend Mode */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('blendMode')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
              >
                <span className="font-medium">Blend Mode</span>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClip(selectedClip.id, { transform: { ...selectedClip.transform, blendMode: 'source-over' } });
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Blend Mode"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                  </div>
                  {collapsedSections['blendMode'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </div>
              </button>
              {!collapsedSections['blendMode'] && (
                <div className="px-2.5 pb-2.5">
                  <select
                    value={selectedClip.transform.blendMode || 'source-over'}
                    onChange={(e) => {
                      updateClip(selectedClip.id, { transform: { ...selectedClip.transform, blendMode: e.target.value as GlobalCompositeOperation } });
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500 capitalize cursor-pointer"
                  >
                    {[
                      'source-over',
                      'multiply',
                      'screen',
                      'overlay',
                      'darken',
                      'lighten',
                      'color-dodge',
                      'color-burn',
                      'hard-light',
                      'soft-light',
                      'difference',
                      'exclusion',
                      'hue',
                      'saturation',
                      'color',
                      'luminosity'
                    ].map((mode) => (
                      <option key={mode} value={mode}>
                        {mode.replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Crop */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('crop')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
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
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset Crop"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                  </div>
                  {collapsedSections['crop'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </div>
              </button>
              {!collapsedSections['crop'] && (
                <div className="px-2.5 pb-2.5 space-y-3 mt-1">
                  {['left', 'right', 'top', 'bottom'].map((edge) => {
                    const currentCrop = selectedClip.crop || { top: 0, bottom: 0, left: 0, right: 0 };
                    const propKey = `crop.${edge}`;
                    const value = getPropVal(currentCrop[edge as keyof typeof currentCrop], propKey);
                    return (
                      <div key={edge} className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-[#a0a0a0] capitalize">{edge}</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white w-8 text-right">{Math.round(value)}%</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.1}
                          value={value}
                          title={`Double-click to reset ${edge} crop to 0%`}
                          onChange={(e) => setPropVal(propKey, Number(e.target.value), { crop: { ...currentCrop, [edge]: Number(e.target.value) } })}
                          onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                          onDoubleClick={() => {
                            setPropVal(propKey, 0, { crop: { ...currentCrop, [edge]: 0 } });
                            useEditorStore.getState().saveSnapshot();
                          }}
                          className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
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
                updateClip(selectedClip.id, { kenBurns: { ...kbVal, ...patch } });
              };

              const KbSlider = ({ label, value, min, max, step, onChange }: {
                label: string; value: number; min: number; max: number; step: number;
                onChange: (v: number) => void;
              }) => (
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#a0a0a0]">{label}</span>
                    <span className="text-[10px] text-white font-mono w-10 text-right">{value > 0 && label !== 'Scale' ? `+${value}` : value}{label === 'Scale' ? '%' : '%'}</span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                    onDoubleClick={() => { onChange(label === 'Scale' ? 100 : 0); useEditorStore.getState().saveSnapshot(); }}
                    title={`Double-click to reset`}
                    className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
                  />
                </div>
              );

              return (
                <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
                  <button
                    onClick={() => toggleSection('kenBurns')}
                    className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-medium">Ken Burns Effect</span>
                      {isKbEnabled && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        onClick={e => { e.stopPropagation(); updateKb({ enabled: !isKbEnabled }); useEditorStore.getState().saveSnapshot(); }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] transition-colors"
                        title={isKbEnabled ? 'Disable Ken Burns' : 'Enable Ken Burns'}
                      >
                        <span className={isKbEnabled ? 'text-emerald-400' : 'text-[#a0a0a0]'}>{isKbEnabled ? 'Enabled' : 'Enable'}</span>
                      </div>
                      {collapsedSections['kenBurns'] ? (
                        <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                      )}
                    </div>
                  </button>

                  {!collapsedSections['kenBurns'] && (
                    <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                      {/* Start Frame */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Start Frame</p>
                        <KbSlider label="Scale" value={kbVal.startScale} min={100} max={300} step={1}
                          onChange={v => updateKb({ startScale: v })} />
                        <KbSlider label="Pan X" value={kbVal.startPanX} min={-100} max={100} step={1}
                          onChange={v => updateKb({ startPanX: v })} />
                        <KbSlider label="Pan Y" value={kbVal.startPanY} min={-100} max={100} step={1}
                          onChange={v => updateKb({ startPanY: v })} />
                      </div>

                      {/* Swap Button */}
                      <button
                        onClick={() => {
                          updateKb({
                            startScale: kbVal.endScale, startPanX: kbVal.endPanX, startPanY: kbVal.endPanY,
                            endScale: kbVal.startScale, endPanX: kbVal.startPanX, endPanY: kbVal.startPanY,
                          });
                          useEditorStore.getState().saveSnapshot();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] text-[#a0a0a0] hover:text-white transition-colors"
                        title="Swap Start and End states"
                      >
                        <ArrowLeftRight className="w-3 h-3" /> Reverse Direction
                      </button>

                      {/* End Frame */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">End Frame</p>
                        <KbSlider label="Scale" value={kbVal.endScale} min={100} max={300} step={1}
                          onChange={v => updateKb({ endScale: v })} />
                        <KbSlider label="Pan X" value={kbVal.endPanX} min={-100} max={100} step={1}
                          onChange={v => updateKb({ endPanX: v })} />
                        <KbSlider label="Pan Y" value={kbVal.endPanY} min={-100} max={100} step={1}
                          onChange={v => updateKb({ endPanY: v })} />
                      </div>

                      {/* Easing Curve */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#a0a0a0] block">Easing Curve</label>
                        <div className="relative">
                          <select
                            value={kbVal.easing}
                            onChange={e => { updateKb({ easing: e.target.value as ClipKenBurnsSettings['easing'] }); useEditorStore.getState().saveSnapshot(); }}
                            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-[11px] text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                          >
                            <option value="linear">Linear</option>
                            <option value="easeIn">Ease In</option>
                            <option value="easeOut">Ease Out</option>
                            <option value="easeInOut">Ease In-Out (Smooth)</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-[#a0a0a0] absolute right-2 top-2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#a0a0a0] block">Quick Presets</label>
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
                              onClick={() => { updateKb({ enabled: true, ...preset.patch }); useEditorStore.getState().saveSnapshot(); }}
                              className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#3e3e3e] hover:border-emerald-500/40 rounded text-[10px] text-white transition-colors text-center truncate"
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
            </div>
          );
        })()}

        {activePropertiesTab === 'color' && (
          <div className="space-y-3">
            {/* Basic Correction Section */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('colorBasic')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Basic Correction</span>
                {collapsedSections['colorBasic'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['colorBasic'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Temperature</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('temperature')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-blue-500 via-[#3e3e3e] to-orange-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>

                  {/* Tint */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Tint</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('tint')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-green-500 via-[#3e3e3e] to-pink-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>

                  {/* Exposure */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Exposure</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('exposure')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Contrast</span>
                      <span className="font-mono text-[#a0a0a0]">{getPropVal(clipFilters.contrast, 'color.contrast')}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={getPropVal(clipFilters.contrast, 'color.contrast')}
                        onChange={(e) => handleFilterChange('contrast', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('contrast')}
                        title="Double-click to reset to 100%"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Saturation</span>
                      <span className="font-mono text-[#a0a0a0]">{getPropVal(clipFilters.saturation, 'color.saturation')}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={getPropVal(clipFilters.saturation, 'color.saturation')}
                        onChange={(e) => handleFilterChange('saturation', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('saturation')}
                        title="Double-click to reset to 100%"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Blur */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Blur</span>
                      <span className="font-mono text-[#a0a0a0]">{getPropVal(clipFilters.blur, 'color.blur')}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={getPropVal(clipFilters.blur, 'color.blur')}
                        onChange={(e) => handleFilterChange('blur', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('blur')}
                        title="Double-click to reset to 0px"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Creative Section */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('colorCreative')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Creative</span>
                {collapsedSections['colorCreative'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['colorCreative'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Faded Film */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Faded Film</span>
                      <span className="font-mono text-[#a0a0a0]">{getPropVal(clipFilters.fadedFilm, 'color.fadedFilm')}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={getPropVal(clipFilters.fadedFilm, 'color.fadedFilm')}
                        onChange={(e) => handleFilterChange('fadedFilm', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('fadedFilm')}
                        title="Double-click to reset to 0%"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Vignette */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Vignette</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
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
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] group">
              <button
                onClick={() => toggleSection('colorWheels')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
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
                      useEditorStore.getState().saveSnapshot();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
                    title="Reset All Wheels"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
                  </div>
                  {collapsedSections['colorWheels'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </div>
              </button>
              {!collapsedSections['colorWheels'] && (
                <div className="px-2 pb-3 flex gap-2 border-t border-[#3e3e3e]/30 pt-2.5">
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
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('lutGrade')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  LUT Color Grade
                  {selectedClip.lut && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </span>
                {collapsedSections['lutGrade'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['lutGrade'] && (() => {
                const mediaLibrary = useEditorStore.getState().mediaLibrary;
                const lutMedia = selectedClip.lut
                  ? mediaLibrary.find((m) => m.id === selectedClip.lut!.mediaId)
                  : null;
                const lutItems = mediaLibrary.filter((m) => m.type === 'lut');

                return (
                  <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
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
                              useEditorStore.getState().saveSnapshot();
                            }}
                            className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-400/10 hover:bg-red-400/20 transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                        {/* Intensity slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[#a0a0a0]">Intensity</span>
                            <span className="font-mono text-[#a0a0a0]">{selectedClip.lut.intensity}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={selectedClip.lut.intensity}
                            onChange={(e) => updateClip(selectedClip.id, {
                              lut: { ...selectedClip.lut!, intensity: Number(e.target.value) }
                            })}
                            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
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
                        <p className="text-[10px] text-[#a0a0a0]">Apply from library:</p>
                        <select
                          value={selectedClip.lut?.mediaId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              updateClip(selectedClip.id, { lut: undefined });
                            } else {
                              updateClip(selectedClip.id, { lut: { mediaId: v, intensity: selectedClip.lut?.intensity ?? 100 } });
                            }
                            useEditorStore.getState().saveSnapshot();
                          }}
                          className="w-full bg-[#1e1e1e] text-white text-[11px] border border-[#3e3e3e] rounded px-2 py-1 focus:outline-none focus:border-amber-500"
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

            {/* Chroma Key / Green Screen */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('chromaKey')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Chroma Key / Green Screen</span>
                {collapsedSections['chromaKey'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['chromaKey'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Enable Chroma Key */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClip.chromaKey?.enabled || false}
                      onChange={(e) => {
                        const existing = selectedClip.chromaKey ?? { color: '#00ff00', threshold: 30, softness: 10 };
                        updateClip(selectedClip.id, {
                          chromaKey: { ...existing, enabled: e.target.checked }
                        });
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="rounded bg-[#1e1e1e] border-[#3e3e3e] text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[11px] text-[#d0d0d0]">Enable Chroma Key</span>
                  </label>

                  {/* Key Color Picker */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#a0a0a0]">Key Color</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#a0a0a0] uppercase">{selectedClip.chromaKey?.color || '#00FF00'}</span>
                        <input
                          type="color"
                          value={selectedClip.chromaKey?.color || '#00ff00'}
                          onChange={(e) => {
                            const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                            updateClip(selectedClip.id, {
                              chromaKey: { ...existing, color: e.target.value }
                            });
                          }}
                          onBlur={() => useEditorStore.getState().saveSnapshot()}
                          className="w-5 h-5 bg-transparent border-0 rounded cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-[#3e3e3e] [&::-webkit-color-swatch]:rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Threshold Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Threshold</span>
                      <span className="font-mono text-[#a0a0a0]">{selectedClip.chromaKey?.threshold ?? 30}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={selectedClip.chromaKey?.threshold ?? 30}
                      onChange={(e) => {
                        const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                        updateClip(selectedClip.id, {
                          chromaKey: { ...existing, threshold: Number(e.target.value) }
                        });
                      }}
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  {/* Softness Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Softness / Spill</span>
                      <span className="font-mono text-[#a0a0a0]">{selectedClip.chromaKey?.softness ?? 10}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedClip.chromaKey?.softness ?? 10}
                      onChange={(e) => {
                        const existing = selectedClip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
                        updateClip(selectedClip.id, {
                          chromaKey: { ...existing, softness: Number(e.target.value) }
                        });
                      }}
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activePropertiesTab === 'speed' && (
          <div className="space-y-3">
            {/* Speed range input */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <label className="text-xs text-white font-medium block mb-2">Speed</label>
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
                    });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  onDoubleClick={() => {
                    if (isRamped) return;
                    const newSpeed = 1.0;
                    const sourceDuration = selectedClip.duration * selectedClip.speed;
                    const newDuration = sourceDuration / newSpeed;
                    updateClip(selectedClip.id, {
                      speed: newSpeed,
                      duration: newDuration,
                    });
                    useEditorStore.getState().saveSnapshot();
                  }}
                  className={`flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${
                    isRamped
                      ? 'bg-[#222] [&::-webkit-slider-thumb]:bg-[#444] cursor-not-allowed'
                      : 'bg-[#3e3e3e] [&::-webkit-slider-thumb]:bg-amber-500'
                  }`}
                />
                <span className="text-[11px] text-white w-12 text-right select-none font-mono">
                  {isRamped ? 'Ramped' : `${selectedClip.speed.toFixed(2)}x`}
                </span>
              </div>
            </div>

            {/* Speed Ramping Toggle & Editor */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white font-medium">Speed Ramping</label>
                <input
                  type="checkbox"
                  checked={isRamped}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateClip(selectedClip.id, {
                        speedRamp: [
                          { position: 0.0, speed: selectedClip.speed },
                          { position: 1.0, speed: selectedClip.speed },
                        ],
                      });
                    } else {
                      updateClip(selectedClip.id, { speedRamp: undefined });
                    }
                    useEditorStore.getState().saveSnapshot();
                  }}
                  className="rounded border-[#3e3e3e] bg-[#1e1e1e] text-amber-500 focus:ring-0 cursor-pointer h-4 w-4"
                />
              </div>

              {isRamped && (
                <div className="space-y-3 pt-2">
                  {/* SVG Editor */}
                  <div className="relative bg-[#1e1e1e] border border-[#3e3e3e] rounded p-1">
                    <svg
                      ref={svgRef}
                      viewBox="0 0 240 100"
                      preserveAspectRatio="none"
                      className="w-full h-28 cursor-crosshair select-none"
                      onClick={handleSvgClick}
                    >
                      {/* Grid Lines */}
                      {[0.5, 1.0, 2.0, 3.0, 4.0].map((s) => {
                        const y = 100 - ((s - 0.1) / 3.9) * 90 - 5;
                        return (
                          <g key={s}>
                            <line
                              x1={0}
                              y1={y}
                              x2={240}
                              y2={y}
                              stroke={s === 1.0 ? '#555' : '#333'}
                              strokeWidth={s === 1.0 ? 1 : 0.5}
                              strokeDasharray={s === 1.0 ? '' : '3 3'}
                            />
                            <text
                              x={4}
                              y={y - 2}
                              fill="#666"
                              fontSize="6"
                              className="pointer-events-none select-none font-mono"
                            >
                              {s}x
                            </text>
                          </g>
                        );
                      })}

                      {/* Slow-mo zone shading */}
                      <rect
                        x={0}
                        y={100 - ((1.0 - 0.1) / 3.9) * 90 - 5}
                        width={240}
                        height={((1.0 - 0.1) / 3.9) * 90}
                        fill="rgba(59, 130, 246, 0.03)"
                        className="pointer-events-none"
                      />

                      {/* Fast zone shading */}
                      <rect
                        x={0}
                        y={5}
                        width={240}
                        height={100 - ((1.0 - 0.1) / 3.9) * 90 - 10}
                        fill="rgba(239, 68, 68, 0.03)"
                        className="pointer-events-none"
                      />

                      {/* The Spline Curve */}
                      <path
                        d={(() => {
                          const pts: string[] = [];
                          const ramp = selectedClip.speedRamp || [];
                          for (let x = 0; x <= 240; x += 4) {
                            const p = x / 240;
                            const speed = getSpeedAtPosition(ramp, p);
                            const y = 100 - ((speed - 0.1) / 3.9) * 90 - 5;
                            pts.push(`${x},${y}`);
                          }
                          return `M ${pts.join(' L ')}`;
                        })()}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="none"
                        className="pointer-events-none"
                      />

                      {/* Playhead Indicator */}
                      {(() => {
                        const isPlayheadInClip =
                          currentTime >= selectedClip.startTime &&
                          currentTime <= selectedClip.startTime + selectedClip.duration;
                        if (!isPlayheadInClip) return null;
                        const p = (currentTime - selectedClip.startTime) / selectedClip.duration;
                        const x = p * 240;
                        const speed = getSpeedAtPosition(selectedClip.speedRamp, p);
                        const y = 100 - ((speed - 0.1) / 3.9) * 90 - 5;
                        return (
                          <g>
                            <line
                              x1={x}
                              y1={0}
                              x2={x}
                              y2={100}
                              stroke="#ec4899"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                              className="pointer-events-none"
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r={4}
                              fill="#ec4899"
                              className="pointer-events-none"
                            />
                          </g>
                        );
                      })()}

                      {/* Keyframe Draggable Handles */}
                      {(selectedClip.speedRamp || []).map((kf: any, idx: number) => {
                        const x = kf.position * 240;
                        const y = 100 - ((kf.speed - 0.1) / 3.9) * 90 - 5;
                        const isBoundary = idx === 0 || idx === (selectedClip.speedRamp || []).length - 1;
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r={draggingIndex === idx ? 5 : 3.5}
                            fill={draggingIndex === idx ? '#ec4899' : '#f59e0b'}
                            stroke="#fff"
                            strokeWidth={1}
                            className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDraggingIndex(idx);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isBoundary) return;
                              const ramp = [...(selectedClip.speedRamp || [])];
                              if (ramp.length > 2) {
                                ramp.splice(idx, 1);
                                updateClip(selectedClip.id, { speedRamp: ramp });
                                useEditorStore.getState().saveSnapshot();
                              }
                            }}
                          >
                            <title>
                              {isBoundary ? "Drag vertically to adjust speed" : "Drag to adjust position & speed. Double-click to delete."}
                            </title>
                          </circle>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="text-[10px] text-[#888] flex justify-between px-1 select-none">
                    <span>Double-click graph to add. Double-click keyframe to delete.</span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#a0a0a0] block font-medium">Speed Ramp Presets</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'slowMo', label: 'Slow-Mo' },
                        { id: 'speedUp', label: 'Speed Up' },
                        { id: 'slowDown', label: 'Slow Down' },
                        { id: 'flash', label: 'Flash' },
                        { id: 'cinematic', label: 'Cinematic' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            const ramp = PRESETS[preset.id as keyof typeof PRESETS];
                            updateClip(selectedClip.id, { speedRamp: ramp });
                            useEditorStore.getState().saveSnapshot();
                          }}
                          className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-[#333] border border-[#3e3e3e] rounded text-[10px] text-white transition-colors text-center truncate focus:outline-none"
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          updateClip(selectedClip.id, {
                            speedRamp: [
                              { position: 0.0, speed: 1.0 },
                              { position: 1.0, speed: 1.0 },
                            ],
                          });
                          useEditorStore.getState().saveSnapshot();
                        }}
                        className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-red-950/40 hover:border-red-900 border border-[#3e3e3e] rounded text-[10px] text-[#ff6b6b] transition-colors text-center focus:outline-none"
                      >
                        Reset Ramp
                      </button>
                    </div>
                  </div>

                  {/* Keyframe List Details */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#a0a0a0] block font-medium">Keyframes</label>
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
                      {(selectedClip.speedRamp || []).map((kf: any, idx: number) => {
                        const isBoundary = idx === 0 || idx === (selectedClip.speedRamp || []).length - 1;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-0.5 text-[10px]"
                          >
                            <span className="text-amber-500 font-mono">#{idx + 1}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#888]">Pos:</span>
                              {isBoundary ? (
                                <span className="text-white font-mono w-10 text-center">{idx === 0 ? '0%' : '100%'}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0.01}
                                  max={0.99}
                                  step={0.01}
                                  value={kf.position}
                                  onChange={(e) => {
                                    const val = Math.max(0.01, Math.min(0.99, Number(e.target.value)));
                                    const ramp = [...(selectedClip.speedRamp || [])];
                                    const minP = idx > 0 ? ramp[idx - 1].position + 0.01 : 0.0;
                                    const maxP = idx < ramp.length - 1 ? ramp[idx + 1].position - 0.01 : 1.0;
                                    ramp[idx] = {
                                      ...kf,
                                      position: Math.max(minP, Math.min(maxP, val)),
                                    };
                                    updateClip(selectedClip.id, { speedRamp: ramp });
                                  }}
                                  onBlur={() => useEditorStore.getState().saveSnapshot()}
                                  className="w-12 bg-black border border-[#3e3e3e] rounded px-1 py-0.5 text-white text-center font-mono focus:outline-none"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#888]">Speed:</span>
                              <input
                                  type="number"
                                  min={0.1}
                                  max={4.0}
                                  step={0.1}
                                  value={kf.speed}
                                  onChange={(e) => {
                                    const val = Math.max(0.1, Math.min(4.0, Number(e.target.value)));
                                    const ramp = [...(selectedClip.speedRamp || [])];
                                    ramp[idx] = { ...kf, speed: val };
                                    updateClip(selectedClip.id, { speedRamp: ramp });
                                  }}
                                  onBlur={() => useEditorStore.getState().saveSnapshot()}
                                  className="w-12 bg-black border border-[#3e3e3e] rounded px-1 py-0.5 text-white text-center font-mono focus:outline-none"
                                />
                            </div>
                            <button
                              disabled={isBoundary}
                              onClick={() => {
                                const ramp = [...(selectedClip.speedRamp || [])];
                                ramp.splice(idx, 1);
                                updateClip(selectedClip.id, { speedRamp: ramp });
                                useEditorStore.getState().saveSnapshot();
                              }}
                              className="text-red-400 hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none transition-colors focus:outline-none"
                              title="Delete Keyframe"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Clip Timeline Settings */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Duration</label>
                  <div className="px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white">
                    {selectedClip.duration.toFixed(2)}s
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Start</label>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedClip.startTime}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        startTime: Number(e.target.value),
                      })
                    }
                    onBlur={() => useEditorStore.getState().saveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Trimming */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Trim Start</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.trimStart}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        trimStart: Number(e.target.value),
                      })
                    }
                    onBlur={() => useEditorStore.getState().saveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Trim End</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.trimEnd}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        trimEnd: Number(e.target.value),
                      })
                    }
                    onBlur={() => useEditorStore.getState().saveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activePropertiesTab === 'audio' && (
          <div className="space-y-3">
            {/* AI Auto Voice Tune (Visible only when multiple clips selected) */}
            {selectedClipIds.length > 1 && (
              <div className="bg-purple-950/20 border border-purple-500/30 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-white font-semibold">AI Auto Voice Tune</span>
                </div>
                <p className="text-[11px] text-[#c0a0d0]">
                  Align and normalize {selectedClipIds.length} selected vocal profiles. Unifies volume levels and frequency balance.
                </p>

                {isAnalyzingVoice ? (
                  <div className="flex items-center justify-center gap-1.5 py-3 bg-purple-950/40 rounded border border-purple-500/20">
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-6 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-7 bg-pink-500 rounded-full animate-bounce" />
                    <div className="w-1 h-6 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="text-[10px] text-purple-200 ml-2 font-medium">Tuning vocal models...</span>
                  </div>
                ) : showTunedToast ? (
                  <div className="bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded py-2.5 text-center font-medium">
                    ✓ Vocals Unified successfully!
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

            {/* Clip Volume & Pan */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('audioVolume')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Clip Volume & Pan</span>
                </div>
                {collapsedSections['audioVolume'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['audioVolume'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Mute toggle */}
                  <div className="flex justify-between items-center text-[11px] bg-[#1e1e1e] p-2 rounded border border-[#3e3e3e]">
                    <span className="text-[#d0d0d0] font-medium">Clip Audio Muted</span>
                    <button
                      onClick={() => handleAudioChange('muted', !clipAudio.muted)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        clipAudio.muted
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {clipAudio.muted ? 'Muted' : 'Mute'}
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Volume Gain</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('volume')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Pan Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Pan / Balance</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
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
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('audioVocalTune')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vocal Tune & Character</span>
                </div>
                {collapsedSections['audioVocalTune'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['audioVocalTune'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
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
                          : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {clipAudio.humanize ? 'Active' : 'Off'}
                    </button>
                  </div>

                  {/* Pitch Shift Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Pitch Shift</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('pitch')}
                        title="Double-click to reset to 0 semitones"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Formant Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Voice Formant / Tone</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('voiceFormant')}
                        title="Double-click to reset to Default"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Fades */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('audioFades')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Audio Fades</span>
                {collapsedSections['audioFades'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['audioFades'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Fade In */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Fade In duration</span>
                      <span className="font-mono text-[#a0a0a0]">{clipAudio.fadeIn.toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={clipAudio.fadeIn}
                        onChange={(e) => handleAudioChange('fadeIn', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('fadeIn')}
                        title="Double-click to reset to 0s"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Fade Out */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Fade Out duration</span>
                      <span className="font-mono text-[#a0a0a0]">{clipAudio.fadeOut.toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={clipAudio.fadeOut}
                        onChange={(e) => handleAudioChange('fadeOut', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('fadeOut')}
                        title="Double-click to reset to 0s"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Equalizer (EQ) */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('audioEQ')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Equalizer (EQ)</span>
                </div>
                {collapsedSections['audioEQ'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['audioEQ'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Bass */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Bass (Low-shelf)</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('bass')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Treble */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Treble (High-shelf)</span>
                      <span className="font-mono text-[#a0a0a0]">
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
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleAudioReset('treble')}
                        title="Double-click to reset to 0 dB"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vocal / BGM Separation */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('vocalSeparation')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Vocal / BGM Separation</span>
                  {clipAudio.vocalSeparation?.enabled && (
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>
                  )}
                </div>
                {collapsedSections['vocalSeparation'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['vocalSeparation'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Enable / Disable Toggle */}
                  <div className="flex justify-between items-center text-[11px] bg-[#1e1e1e] p-2 rounded border border-[#3e3e3e]">
                    <div>
                      <span className="text-[#d0d0d0] font-medium block">Enable Separation</span>
                      <span className="text-[9px] text-[#a0a0a0] block">
                        {clipAudio.vocalSeparation?.enabled
                          ? 'Active — processing in real-time'
                          : 'Toggle to enable vocal/BGM separation'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const current = clipAudio.vocalSeparation;
                        const newSettings = current
                          ? { ...current, enabled: !current.enabled }
                          : { enabled: true, mode: 'removeVocals' as const, strength: 80 };
                        handleAudioChange('vocalSeparation', newSettings);
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        clipAudio.vocalSeparation?.enabled
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {clipAudio.vocalSeparation?.enabled ? 'Active' : 'Enable'}
                    </button>
                  </div>

                  {clipAudio.vocalSeparation?.enabled && (
                    <>
                      {/* Mode Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-[#a0a0a0] block font-medium">Separation Mode</label>
                        <div className="grid grid-cols-1 gap-1.5">
                          {[
                            { mode: 'removeVocals' as const, label: 'Remove Vocals (Keep BGM)', desc: 'Background music stays, vocals reduced' },
                            { mode: 'removeBgm' as const, label: 'Remove BGM (Keep Vocals)', desc: 'Vocals stay, background music reduced' },
                            { mode: 'separateBoth' as const, label: 'Creative Separation', desc: 'Blend of both channels' },
                          ].map((item) => (
                            <button
                              key={item.mode}
                              onClick={() => {
                                const current = clipAudio.vocalSeparation || { enabled: true, mode: 'removeVocals' as const, strength: 80 };
                                handleAudioChange('vocalSeparation', { ...current, mode: item.mode });
                              }}
                              className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
                                clipAudio.vocalSeparation.mode === item.mode
                                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                                  : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#5e5e5e]'
                              }`}
                            >
                              <span className="font-medium block">{item.label}</span>
                              <span className="text-[9px] opacity-70">{item.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Strength Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[#d0d0d0]">Separation Strength</span>
                          <span className="font-mono text-[#a0a0a0]">{clipAudio.vocalSeparation.strength}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={clipAudio.vocalSeparation.strength}
                          onChange={(e) => {
                            const current = clipAudio.vocalSeparation || { enabled: true, mode: 'removeVocals' as const, strength: 80 };
                            handleAudioChange('vocalSeparation', { ...current, strength: Number(e.target.value) });
                          }}
                          onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                          className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full w-full"
                        />
                        <div className="flex justify-between text-[9px] text-[#a0a0a0]">
                          <span>Subtle</span>
                          <span>Extreme</span>
                        </div>
                      </div>

                      {/* Info Note */}
                      <div className="bg-[#1e1e1e] border border-[#3e3e3e]/50 rounded p-2.5 space-y-1">
                        <p className="text-[10px] text-[#a0a0a0]">
                          <span className="text-cyan-400 font-medium">How it works:</span> Uses mid/side stereo phase cancellation. Vocals are typically center-panned and cancel when channels are subtracted.
                        </p>
                        <p className="text-[9px] text-[#6a6a6a]">
                          Results vary by mix. Works best on stereo tracks with centered vocals. Mono tracks will not respond to this effect.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Speed Pitch Settings */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('audioSpeedPitch')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Speed Pitch Settings</span>
                {collapsedSections['audioSpeedPitch'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['audioSpeedPitch'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  <div className="flex justify-between items-center text-[11px] bg-[#1e1e1e] p-2 rounded border border-[#3e3e3e]">
                    <div>
                      <span className="text-[#d0d0d0] font-medium block">Maintain Audio Pitch</span>
                      <span className="text-[9px] text-[#a0a0a0] block">Keeps pitch stable on speed changes</span>
                    </div>
                    <button
                      onClick={() => handleAudioChange('preservePitch', !clipAudio.preservePitch)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        clipAudio.preservePitch
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-[#a0a0a0] hover:text-white'
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
        {activePropertiesTab === 'text' && selectedClip.textSettings && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Text Properties</h3>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#a0a0a0]">Content</label>
                <textarea
                  value={selectedClip.textSettings.text}
                  onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, text: e.target.value } })}
                  className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#a0a0a0]">Font Family</label>
                <select
                  value={selectedClip.textSettings.fontFamily || 'Inter'}
                  onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontFamily: e.target.value } })}
                  className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
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
                <label className="text-xs text-[#a0a0a0]">Font Size</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="12"
                    max="150"
                    value={selectedClip.textSettings.fontSize}
                    onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontSize: Number(e.target.value) } })}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="text-xs text-white w-8 text-right">{selectedClip.textSettings.fontSize}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[#a0a0a0]">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.color || '#ffffff'}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, color: e.target.value } })}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <span className="text-xs text-white uppercase">{selectedClip.textSettings.color}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[#a0a0a0]">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.backgroundColor === 'transparent' ? '#000000' : selectedClip.textSettings.backgroundColor}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, backgroundColor: e.target.value } })}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <button 
                      onClick={() => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, backgroundColor: 'transparent' } })}
                      className="text-[10px] bg-[#3e3e3e] hover:bg-[#5e5e5e] px-2 py-1 rounded text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 border-t border-[#3e3e3e] pt-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[#a0a0a0]">Stroke Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedClip.textSettings.strokeColor || '#000000'}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, strokeColor: e.target.value } })}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                    <span className="text-xs text-white uppercase">{selectedClip.textSettings.strokeColor || '#000000'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-[#a0a0a0]">Stroke Width</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={selectedClip.textSettings.strokeWidth || 0}
                      onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, strokeWidth: Number(e.target.value) } })}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-xs text-white w-5 text-right">{selectedClip.textSettings.strokeWidth || 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-[#3e3e3e] pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.bold}
                    onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, bold: e.target.checked } })}
                    className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
                  />
                  <span className="text-xs text-white font-bold">Bold</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.italic}
                    onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, italic: e.target.checked } })}
                    className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
                  />
                  <span className="text-xs text-white italic">Italic</span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#a0a0a0]">Alignment</label>
                <div className="flex gap-1">
                  {(['left','center','right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, textAlign: align } })}
                      className={`flex-1 py-1.5 text-xs rounded border transition-colors capitalize ${
                        (selectedClip.textSettings as any).textAlign === align || (!((selectedClip.textSettings as any).textAlign) && align === 'center')
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#3e3e3e] pt-4 flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.shadow}
                    onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadow: e.target.checked } })}
                    className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
                  />
                  <span className="text-xs text-white">Drop Shadow</span>
                </label>
                {selectedClip.textSettings.shadow && (
                  <div className="pl-6 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedClip.textSettings.shadowColor || '#000000'}
                        onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadowColor: e.target.value } })}
                        className="w-5 h-5 rounded bg-transparent cursor-pointer"
                      />
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={selectedClip.textSettings.shadowBlur}
                        onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadowBlur: Number(e.target.value) } })}
                        className="flex-1 accent-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[#3e3e3e] pt-4 flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.textSettings.threeD}
                    onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, threeD: e.target.checked } })}
                    className="accent-amber-500 rounded bg-[#1e1e1e] border-[#3e3e3e]"
                  />
                  <span className="text-xs text-white">3D Effect</span>
                </label>
                {selectedClip.textSettings.threeD && (
                  <div className="pl-6 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-[#a0a0a0] w-10">Depth</label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={selectedClip.textSettings.threeDDepth}
                        onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, threeDDepth: Number(e.target.value) } })}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-[10px] text-white w-6">{selectedClip.textSettings.threeDDepth}px</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Text Animation Presets */}
              <div className="border-t border-[#3e3e3e] pt-4 flex flex-col gap-4">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Text Animations</p>
                
                {/* Intro Animation (IN) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[#a0a0a0]">Intro (IN)</label>
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
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="flex-1 bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer capitalize"
                    >
                      <option value="none">None</option>
                      <option value="fadeIn">Fade In</option>
                      <option value="zoom">Zoom</option>
                      <option value="slideUp">Slide Up</option>
                      <option value="slideDown">Slide Down</option>
                      <option value="slideLeft">Slide Left</option>
                      <option value="slideRight">Slide Right</option>
                      <option value="bounce">Bounce</option>
                      <option value="typewriter">Typewriter</option>
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
                          onBlur={() => useEditorStore.getState().saveSnapshot()}
                          className="w-12 px-1.5 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-center text-[10px] text-white focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-[#a0a0a0]">sec</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Outro Animation (OUT) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[#a0a0a0]">Outro (OUT)</label>
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
                        useEditorStore.getState().saveSnapshot();
                      }}
                      className="flex-1 bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer capitalize"
                    >
                      <option value="none">None</option>
                      <option value="fadeOut">Fade Out</option>
                      <option value="zoom">Zoom</option>
                      <option value="slideUp">Slide Up</option>
                      <option value="slideDown">Slide Down</option>
                      <option value="slideLeft">Slide Left</option>
                      <option value="slideRight">Slide Right</option>
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
                          onBlur={() => useEditorStore.getState().saveSnapshot()}
                          className="w-12 px-1.5 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-center text-[10px] text-white focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-[#a0a0a0]">sec</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Effects Tab ─────────────────────────────────────────────────── */}
        {activePropertiesTab === 'effects' && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Effect Settings</h3>

            {/* ── Timeline FX Settings ── */}
            {selectedClip.fxSettings && (
              <div className="flex flex-col gap-3 bg-[#1e1e1e] rounded p-3 border border-rose-500/20">
                <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Timeline FX</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#a0a0a0]">Effect Type</label>
                  <select
                    value={selectedClip.fxSettings.type}
                    onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, type: e.target.value as any } })}
                    className="bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-rose-500"
                  >
                    <option value="vfx_breakdown">VFX Breakdown</option>
                    <option value="bw_to_color">B&W to Color</option>
                    <option value="glitch">Glitch</option>
                    <option value="old_film">Old Film</option>
                    <option value="vhs">VHS</option>
                    <option value="cinematic_bars">Cinematic Bars</option>
                    <option value="neon_glow">Neon Glow</option>
                    <option value="rgb_split">RGB Split</option>
                    <option value="pixelate">Pixelate</option>
                    <option value="mirror">Mirror</option>
                    <option value="zoom_blur">Zoom Blur</option>
                    <option value="lens_flare">Lens Flare</option>
                    <option value="night_vision">Night Vision</option>
                    <option value="thermal">Thermal</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#a0a0a0]">Intensity — {selectedClip.fxSettings.intensity ?? 100}%</label>
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
                <div className="flex flex-col gap-3 bg-[#1e1e1e] rounded p-3 border border-violet-500/20">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">✦ Particle Effect</p>
                    <button
                      onClick={() => updateClip(selectedClip.id, { particleSettings: undefined })}
                      className="text-[9px] text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >Remove</button>
                  </div>

                  {/* Type selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#a0a0a0]">Effect Type</label>
                    <select
                      value={ps.type}
                      onChange={(e) => upd({ type: e.target.value as any })}
                      className="bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-violet-500"
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
                    <label className="text-[10px] text-[#a0a0a0]">Emitter Position</label>
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
                        <span className="text-[10px] text-[#a0a0a0]">{label}</span>
                        <span className="text-[10px] text-white">{ps[key]}{unit}</span>
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
                        <span className="text-[10px] text-[#a0a0a0]">{label}</span>
                        <span className="text-[10px] text-white">{ps[key]}{unit}</span>
                      </div>
                      <input type="range" min={min} max={max} value={ps[key]}
                        onChange={(e) => upd({ [key]: Number(e.target.value) } as any)}
                        className="w-full accent-cyan-500" />
                    </div>
                  ))}

                  {/* Visual */}
                  <p className="text-[9px] font-semibold text-[#6a6a6a] uppercase tracking-wider mt-1">Visual</p>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-[#a0a0a0]">Color Variance</span>
                      <span className="text-[10px] text-white">{ps.colorVariance}</span>
                    </div>
                    <input type="range" min="0" max="100" value={ps.colorVariance}
                      onChange={(e) => upd({ colorVariance: Number(e.target.value) })}
                      className="w-full accent-pink-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#a0a0a0]">Base Color</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[#6a6a6a]">{ps.color === 'auto' ? 'auto' : ps.color}</span>
                      {ps.color !== 'auto' && (
                        <input type="color" value={ps.color}
                          onChange={(e) => upd({ color: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-[#3e3e3e] bg-transparent" />
                      )}
                      <button
                        onClick={() => upd({ color: ps.color === 'auto' ? '#ffffff' : 'auto' })}
                        className="text-[9px] text-[#a0a0a0] hover:text-white px-1.5 py-0.5 border border-[#3e3e3e] rounded"
                      >{ps.color === 'auto' ? 'Custom' : 'Auto'}</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#a0a0a0]">Glow Effect</span>
                    <button
                      onClick={() => upd({ glow: !ps.glow })}
                      className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${ps.glow ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-[#3e3e3e] text-[#6a6a6a] hover:text-white'}`}
                    >{ps.glow ? 'ON' : 'OFF'}</button>
                  </div>
                </div>
              );
            })()}

            {/* Empty state */}
            {!selectedClip.fxSettings && !selectedClip.particleSettings && (
              <div className="text-xs text-[#a0a0a0] flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#3e3e3e] rounded">
                <Wand2 className="w-8 h-8 mb-2 opacity-50" />
                <p className="mb-1">No effects on this clip</p>
                <p className="text-[10px] text-[#5a5a5a]">Drag a Timeline FX or Particle Effect from the Effects panel onto this clip</p>
              </div>
            )}
          </div>
        )}
        {/* ── History Tab ─────────────────────────────────────────────────── */}
        {activePropertiesTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="p-3 border-b border-[#3e3e3e] flex items-center justify-between shrink-0 bg-[#1e1e1e]/30">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Undo/Redo History</span>
              <span className="text-[9px] text-[#8a8a8a] bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1.5 py-0.5 font-mono">
                {history.length} Actions
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
                        ? 'bg-[#1e1e1e]/40 border-transparent text-[#a0a0a0]/40 hover:text-white hover:bg-[#2d2d2d]'
                        : 'bg-[#1e1e1e]/60 border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                    }`}
                  >
                    {/* Visual Line Node */}
                    <div className="relative flex items-center justify-center shrink-0 w-4">
                      {idx < history.length - 1 && (
                        <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                          isFuture ? 'bg-[#3e3e3e]/40' : 'bg-amber-500/30'
                        }`} />
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                        isActive
                          ? 'bg-amber-400 border-amber-400 ring-4 ring-amber-500/20 scale-110'
                          : isFuture
                          ? 'bg-transparent border-[#3e3e3e]'
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
        )}
      </div>
    </div>
  );
}
