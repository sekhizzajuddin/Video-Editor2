import React from 'react';
import {
  Waves,
  Sparkles,
  RotateCcw,
  Volume2,
  Mic,
  Home,
  Music,
  Church,
  Droplet,
  Mountain,
  Radio,
  Building,
  Phone,
  Compass,
  VolumeX,
} from 'lucide-react';
import {
  ENVIRONMENT_PRESETS,
  DEFAULT_REVERB_SETTINGS,
  type AudioEnvironmentPreset,
  type ClipReverbSettings,
} from '@/utils/reverbDsp';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';
import { toast } from 'sonner';

interface ReverbEnvironmentSectionProps {
  clipAudio: any;
  handleAudioChange: (key: any, val: any) => void;
  handleAudioReset?: (key: any) => void;
}

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  studio: Mic,
  room: Home,
  hall: Music,
  cathedral: Church,
  bathroom: Droplet,
  canyon: Mountain,
  arena: Radio,
  office: Building,
  telephone: Phone,
  tunnel: Compass,
  none: VolumeX,
};

export function ReverbEnvironmentSection({
  clipAudio,
  handleAudioChange,
  handleAudioReset,
}: ReverbEnvironmentSectionProps) {
  const reverb: ClipReverbSettings = clipAudio?.reverb || DEFAULT_REVERB_SETTINGS;
  const isEnabled = Boolean(reverb.enabled);
  const activePreset = reverb.preset || 'none';

  const updateReverb = (partial: Partial<ClipReverbSettings>) => {
    const updated: ClipReverbSettings = {
      ...reverb,
      ...partial,
      enabled: partial.enabled !== undefined ? partial.enabled : true,
    };
    handleAudioChange('reverb', updated);
    scheduleSaveSnapshot();
  };

  const handleSelectPreset = (presetId: AudioEnvironmentPreset) => {
    const preset = ENVIRONMENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (preset.id === 'none') {
      updateReverb({
        enabled: false,
        preset: 'none',
        mix: 0,
      });
      handleAudioChange('environment', { preset: 'none', intensity: 0 });
      toast.info('Audio Reverb / Environment Bypassed (Dry)');
      return;
    }

    const newSettings: ClipReverbSettings = {
      enabled: true,
      preset: preset.id,
      mix: preset.mix,
      decay: preset.decay,
      preDelay: preset.preDelay,
      damping: preset.damping,
      roomSize: preset.roomSize,
    };

    handleAudioChange('reverb', newSettings);
    handleAudioChange('environment', { preset: preset.id, intensity: preset.mix });
    scheduleSaveSnapshot();
    toast.success(`Acoustic Environment: ${preset.name} applied`);
  };

  const handleResetReverb = () => {
    if (handleAudioReset) {
      handleAudioReset('reverb');
    } else {
      handleAudioChange('reverb', DEFAULT_REVERB_SETTINGS);
    }
    handleAudioChange('environment', { preset: 'none', intensity: 0 });
    scheduleSaveSnapshot();
    toast.info('Reverb & Environment reset to default.');
  };

  const activePresetInfo = ENVIRONMENT_PRESETS.find((p) => p.id === activePreset);

  return (
    <div className="space-y-3">
      {/* Header with Enable Toggle */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-400'}`}>
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--theme-text-primary)]">
                Reverb &amp; Environment
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                DSP
              </span>
            </div>
            <p className="text-[10px] text-[var(--theme-text-muted)]">
              Simulate acoustic spaces, room reverberation &amp; ambience
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isEnabled && (
            <button
              type="button"
              onClick={handleResetReverb}
              title="Reset Reverb & Environment"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => updateReverb({ enabled: !isEnabled })}
            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isEnabled
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'bg-[var(--theme-bg-card)] hover:bg-[#3d3d3d] text-[var(--theme-text-muted)] hover:text-white border border-[var(--theme-border)]'
            }`}
          >
            {isEnabled ? 'Active' : 'Off'}
          </button>
        </div>
      </div>

      {/* Environment Presets Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-[var(--theme-text-primary)] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Acoustic Environment Presets</span>
          </span>
          <span className="text-[9px] font-mono text-[var(--theme-text-muted)]">
            {activePresetInfo?.name || 'Custom'}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {ENVIRONMENT_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.id] || Waves;
            const isSelected = activePreset === preset.id && isEnabled;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`p-2 rounded-lg border text-left transition-all flex flex-col gap-1 relative overflow-hidden group ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500/60 shadow-sm shadow-indigo-500/10 text-white'
                    : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]/60 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-indigo-500/30'
                }`}
                title={`${preset.name}: ${preset.description}`}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-300'
                    }`}
                  />
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-semibold leading-tight line-clamp-1">
                  {preset.name}
                </span>
                <span className="text-[8px] opacity-70 font-mono">
                  {preset.id === 'none' ? 'Dry' : `${preset.decay}s · ${preset.mix}%`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reverb DSP Controls (Active or Tweaking) */}
      <div className={`space-y-2.5 pt-1 ${!isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Wet / Dry Mix Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--theme-text-primary)]">Reverb Wet Mix</span>
            <span className="font-mono text-[var(--theme-text-muted)]">
              {reverb.mix ?? 25}% ({reverb.mix === 0 ? 'Dry' : reverb.mix === 100 ? '100% Wet' : 'Blended'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={reverb.mix ?? 25}
              onChange={(e) => updateReverb({ mix: Number(e.target.value), preset: 'custom' })}
              title="Wet/Dry Blending: higher values add more spacious room sound"
              className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        {/* Decay Time Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--theme-text-primary)]">Decay Time (RT60)</span>
            <span className="font-mono text-[var(--theme-text-muted)]">
              {(reverb.decay ?? 1.5).toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.1}
              max={5.0}
              step={0.1}
              value={reverb.decay ?? 1.5}
              onChange={(e) => updateReverb({ decay: Number(e.target.value), preset: 'custom' })}
              title="Decay Time: duration for the reverberation to die out by 60dB"
              className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        {/* Room Size Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--theme-text-primary)]">Room Size</span>
            <span className="font-mono text-[var(--theme-text-muted)]">
              {reverb.roomSize ?? 50}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={reverb.roomSize ?? 50}
              onChange={(e) => updateReverb({ roomSize: Number(e.target.value), preset: 'custom' })}
              title="Room Size: physical dimensions of the simulated room"
              className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        {/* Pre-Delay Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--theme-text-primary)]">Pre-Delay</span>
            <span className="font-mono text-[var(--theme-text-muted)]">
              {reverb.preDelay ?? 20} ms
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={2}
              value={reverb.preDelay ?? 20}
              onChange={(e) => updateReverb({ preDelay: Number(e.target.value), preset: 'custom' })}
              title="Pre-Delay: gap before early reflections begin, helps vocals stay upfront"
              className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        {/* High Damping Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--theme-text-primary)]">High Damping / Warmth</span>
            <span className="font-mono text-[var(--theme-text-muted)]">
              {reverb.damping ?? 40}% ({reverb.damping > 60 ? 'Warm / Soft' : reverb.damping < 25 ? 'Bright / Tile' : 'Natural'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={reverb.damping ?? 40}
              onChange={(e) => updateReverb({ damping: Number(e.target.value), preset: 'custom' })}
              title="Damping: absorbs high frequencies in room air and wall boundaries"
              className="flex-1 h-1 bg-[var(--theme-bg-subpanel)] rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Acoustic Environment Info Box */}
      {isEnabled && activePresetInfo && activePresetInfo.id !== 'none' && (
        <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-[10px] text-indigo-300 space-y-1">
          <div className="flex items-center gap-1 font-semibold text-indigo-200">
            <Volume2 className="w-3 h-3 text-indigo-400" />
            <span>{activePresetInfo.name} Acoustic Profile:</span>
          </div>
          <p className="text-[9px] text-indigo-300/80 leading-relaxed">
            {activePresetInfo.description}
          </p>
        </div>
      )}
    </div>
  );
}
