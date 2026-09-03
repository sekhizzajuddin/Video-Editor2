import React, { useMemo } from 'react';
import { Volume2, Zap } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

interface AutoDuckingSectionProps {
  selectedClip: TimelineClip;
  handleAudioChange: (key: string, val: any) => void;
}

export function AutoDuckingSection({ selectedClip, handleAudioChange }: AutoDuckingSectionProps) {
  const tracks = useEditorStore(useShallow((s) => s.tracks));
  const clips = useMemo(() => tracks.flatMap((t) => t.clips), [tracks]);

  const ducking = selectedClip.audioSettings?.ducking || {
    enabled: false,
    duckVolume: 20,
    fadeDuration: 200,
  };

  // Detect overlapping voice clips for visual feedback
  const overlappingVoiceClips = clips.filter((c: TimelineClip) => {
    if (c.id === selectedClip.id || c.disabled) return false;
    const isVoice = Boolean(
      c.textSettings ||
      c.audioSettings?.humanize ||
      c.mediaId.includes('audio') ||
      c.mediaId.includes('voice') ||
      c.trackId.includes('audio') ||
      c.trackId.includes('voice')
    );
    if (!isVoice) return false;
    const overlapStart = Math.max(c.startTime, selectedClip.startTime);
    const overlapEnd = Math.min(c.startTime + c.duration, selectedClip.startTime + selectedClip.duration);
    return overlapEnd > overlapStart;
  });

  const toggleDucking = () => {
    handleAudioChange('ducking', {
      ...ducking,
      enabled: !ducking.enabled,
    });
  };

  const updateDuckVolume = (vol: number) => {
    handleAudioChange('ducking', {
      ...ducking,
      duckVolume: vol,
    });
  };

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl p-3 border border-indigo-500/20 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-[var(--theme-text-primary)] leading-tight">AI Auto Audio Ducking</p>
            <p className="text-[9px] text-[var(--theme-text-muted)]">Auto-ducks background music when vocals/voice speak</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleDucking}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
            ducking.enabled
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
              : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)]'
          }`}
        >
          {ducking.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {ducking.enabled && (
        <div className="space-y-2.5 pt-2 border-t border-[var(--theme-border)]">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-[var(--theme-text-muted)]">BGM Volume During Speech</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{ducking.duckVolume}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={ducking.duckVolume}
              onChange={(e) => updateDuckVolume(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-300">
            <Volume2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              {overlappingVoiceClips.length > 0
                ? `Active: ${overlappingVoiceClips.length} voice/text clip(s) detected in timestamp range!`
                : 'Ready: Auto-ducks BGM volume whenever voice/speech plays on timeline.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
