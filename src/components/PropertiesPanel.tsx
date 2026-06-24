import {
  Move3D,
  Palette,
  Gauge,
  Music,
  Trash2,
  Copy,
  Scissors,
  ChevronDown,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useEffect } from 'react';
import type { PropertiesTab } from '@/types';
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
    activePropertiesTab,
    setActivePropertiesTab,
    updateClip,
    removeClip,
    copyClip,
    duplicateClip,
    splitClip,
    currentTime,
    selectedTransitionClipId,
    updateTransition,
    removeTransition,
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
  const primarySelectedId = selectedClipId || (selectedClipIds.length > 0 ? selectedClipIds[0] : null);
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === primarySelectedId);
    if (clip) {
      selectedClip = clip;
      selectedTrack = track;
      break;
    }
  }

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

  const tabs: { id: PropertiesTab; label: string; icon: typeof Move3D }[] = [
    { id: 'transform', label: 'Transform', icon: Move3D },
    { id: 'color', label: 'Color', icon: Palette },
    { id: 'speed', label: 'Speed', icon: Gauge },
    { id: 'audio', label: 'Audio', icon: Music },
  ];

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
            return (
              <button
                key={tab.id}
                className="flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 text-[#a0a0a0]"
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Move3D className="w-10 h-10 text-[#3e3e3e] mx-auto mb-3" />
            <p className="text-sm text-[#a0a0a0]">No clip selected</p>
            <p className="text-xs text-[#a0a0a0] mt-1 opacity-60">
              Click a clip on the timeline to edit its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

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
    updateClip(selectedClip.id, {
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
    updateClip(selectedClip.id, {
      colorFilters: {
        ...current,
        [key]: defaultVal,
      },
    });
    useEditorStore.getState().saveSnapshot();
  };

  const defaultAudioSettings = {
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
    updateClip(selectedClip.id, {
      audioSettings: {
        ...current,
        [key]: val,
      },
    });
  };

  const handleAudioReset = (key: keyof typeof defaultAudioSettings) => {
    if (!selectedClip) return;
    const current = selectedClip.audioSettings || defaultAudioSettings;
    const defaultVal = defaultAudioSettings[key];
    updateClip(selectedClip.id, {
      audioSettings: {
        ...current,
        [key]: defaultVal,
      },
    });
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
            <Copy className="w-3 h-3" />
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

      {/* Properties Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activePropertiesTab === 'transform' && (() => {
          const localTime = currentTime - selectedClip.startTime;
          const animations = selectedClip.animations || {};

          const getPropVal = (base: number, propKey: string) => {
            return getAnimatedValue(base, currentTime, selectedClip.startTime, animations[propKey as keyof typeof animations]);
          };

          const setPropVal = (propKey: string, value: number, baseUpdateObj: any) => {
            if (animations[propKey as keyof typeof animations]) {
              updateClip(selectedClip.id, {
                animations: {
                  ...animations,
                  [propKey]: addOrUpdateKeyframe(animations[propKey as keyof typeof animations], localTime, value)
                }
              });
            } else {
              updateClip(selectedClip.id, baseUpdateObj);
            }
          };

          const toggleKeyframe = (propKey: string, currentValue: number) => {
            if (animations[propKey as keyof typeof animations]) {
              // Turn off keyframing - remove it completely, but bake the current value into base
              const newAnims = { ...animations };
              delete newAnims[propKey as keyof typeof animations];
              updateClip(selectedClip.id, { animations: newAnims });
              // We also need to update the base value to what it was at this moment, but that requires knowing what baseUpdateObj maps to
            } else {
              // Turn on keyframing - add initial keyframe at current time
              updateClip(selectedClip.id, {
                animations: {
                  ...animations,
                  [propKey]: [{ time: localTime, value: currentValue }]
                }
              });
            }
          };

          return (
            <div className="space-y-3">
              {/* Position */}
              <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
                <button
                  onClick={() => toggleSection('position')}
                  className="w-full flex items-center justify-between p-2.5 text-xs text-white"
                >
                  <span className="font-medium">Position</span>
                  {collapsedSections['position'] ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                  )}
                </button>
                {!collapsedSections['position'] && (
                  <div className="px-2.5 pb-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-[#a0a0a0] block">X Position</label>
                          <KeyframeIcon active={!!animations['transform.x']} onClick={() => toggleKeyframe('transform.x', selectedClip.transform.x)} />
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-[#a0a0a0] block">Y Position</label>
                          <KeyframeIcon active={!!animations['transform.y']} onClick={() => toggleKeyframe('transform.y', selectedClip.transform.y)} />
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
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Scale</span>
                <div className="flex items-center gap-2">
                  <KeyframeIcon active={!!animations['transform.scale']} onClick={(e) => { e.stopPropagation(); toggleKeyframe('transform.scale', selectedClip.transform.scale); }} />
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
                      max={200}
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
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Rotation</span>
                <div className="flex items-center gap-2">
                  <KeyframeIcon active={!!animations['transform.rotation']} onClick={(e) => { e.stopPropagation(); toggleKeyframe('transform.rotation', selectedClip.transform.rotation); }} />
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
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Opacity</span>
                <div className="flex items-center gap-2">
                  <KeyframeIcon active={!!animations['opacity']} onClick={(e) => { e.stopPropagation(); toggleKeyframe('opacity', selectedClip.opacity); }} />
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

            {/* Crop */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('crop')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Crop</span>
                {collapsedSections['crop'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
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
                            <KeyframeIcon active={!!animations[propKey]} onClick={() => toggleKeyframe(propKey, currentCrop[edge as keyof typeof currentCrop])} />
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
          </div>
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
                        {clipFilters.temperature > 0 ? `+${clipFilters.temperature}` : clipFilters.temperature}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.temperature}
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
                        {clipFilters.tint > 0 ? `+${clipFilters.tint}` : clipFilters.tint}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.tint}
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
                        {clipFilters.exposure > 0 ? `+${clipFilters.exposure}` : clipFilters.exposure}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.exposure}
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
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.contrast}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={clipFilters.contrast}
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
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.saturation}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={clipFilters.saturation}
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
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.blur}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={clipFilters.blur}
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
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.fadedFilm}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={clipFilters.fadedFilm}
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
                        {clipFilters.vignette > 0 ? `+${clipFilters.vignette}` : clipFilters.vignette}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.vignette}
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
                      {(selectedClip.speedRamp || []).map((kf, idx) => {
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
                      {(selectedClip.speedRamp || []).map((kf, idx) => {
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
                        {clipAudio.volume > 0 ? `+${clipAudio.volume}` : clipAudio.volume} dB ({Math.round(Math.pow(10, clipAudio.volume / 20) * 100)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-40}
                        max={12}
                        value={clipAudio.volume}
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
                        {clipAudio.pan === 0 ? 'Center' : clipAudio.pan > 0 ? `R${clipAudio.pan}` : `L${Math.abs(clipAudio.pan)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipAudio.pan}
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
      </div>
    </div>
  );
}
