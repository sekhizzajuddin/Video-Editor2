import React, { useMemo, useState } from 'react';
import { Volume2, Zap, Sparkles, ExternalLink, RotateCcw } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { applyAutoDuckingToTrack } from '@/utils/aiAudioDucking';
import { toast } from 'sonner';

interface AutoDuckingSectionProps {
  selectedClip: TimelineClip;
  handleAudioChange: (key: string, val: any) => void;
}

const DEFAULT_AUDIO_SETTINGS = {
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

export function AutoDuckingSection({ selectedClip, handleAudioChange }: AutoDuckingSectionProps) {
  const { tracks, mediaLibrary, subtitles, setShowAutoDuckingModal, updateClip, saveSnapshot } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      mediaLibrary: s.mediaLibrary,
      subtitles: s.subtitles || [],
      setShowAutoDuckingModal: s.setShowAutoDuckingModal,
      updateClip: s.updateClip,
      saveSnapshot: s.saveSnapshot,
    }))
  );

  const [isDucking, setIsDucking] = useState(false);

  const ducking = selectedClip.audioSettings?.ducking || {
    enabled: false,
    duckVolume: 20,
    fadeDuration: 200,
  };

  const volumeKeyframes = selectedClip.animations?.['audio.volume'] || [];
  const hasVolumeKeyframes = volumeKeyframes.length > 0;

  // Detect overlapping voice clips for visual feedback
  const clips = useMemo(() => tracks.flatMap((t) => t.clips || []), [tracks]);
  const overlappingVoiceClips = useMemo(() => {
    return clips.filter((c: TimelineClip) => {
      if (c.id === selectedClip.id || c.disabled || (c.trackId === selectedClip.trackId)) return false;
      const isVoice = Boolean(
        c.textSettings ||
        c.audioSettings?.humanize ||
        c.mediaId.includes('audio') ||
        c.mediaId.includes('voice') ||
        c.trackId.includes('audio') ||
        c.trackId.includes('voice') ||
        (c.audioSettings && !c.audioSettings.muted)
      );
      if (!isVoice) return false;
      const overlapStart = Math.max(c.startTime, selectedClip.startTime);
      const overlapEnd = Math.min(c.startTime + c.duration, selectedClip.startTime + selectedClip.duration);
      return overlapEnd > overlapStart;
    });
  }, [clips, selectedClip]);

  const handleQuickDuckTrack = async () => {
    setIsDucking(true);
    try {
      const result = await applyAutoDuckingToTrack(
        selectedClip.trackId,
        tracks,
        mediaLibrary,
        subtitles,
        {
          duckAmountDb: -18,
          attackDuration: 0.35,
          holdDuration: 0.35,
          releaseDuration: 0.6,
        }
      );

      if (result.success && result.duckedClipsCount > 0) {
        for (const [clipId, keyframes] of Object.entries(result.keyframesByClipId)) {
          const target = clips.find((c) => c.id === clipId);
          if (!target) continue;
          updateClip(clipId, {
            animations: {
              ...(target.animations || {}),
              'audio.volume': keyframes,
            },
            audioSettings: {
              ...DEFAULT_AUDIO_SETTINGS,
              ...(target.audioSettings || {}),
              ducking: {
                enabled: true,
                duckVolume: 12,
                duckDb: -18,
                fadeDuration: 350,
                appliedAt: Date.now(),
              },
            },
          });
        }
        saveSnapshot('Apply AI Auto Audio Ducking');
        toast.success(`⚡ Auto Ducking applied! Ducked ${result.speechIntervalsCount} vocal section(s).`);
      } else {
        toast.info('No overlapping voice detected to duck against.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to apply auto ducking.');
    } finally {
      setIsDucking(false);
    }
  };

  const handleClearClipDucking = () => {
    const cleanAnims = { ...(selectedClip.animations || {}) };
    delete cleanAnims['audio.volume'];
    updateClip(selectedClip.id, {
      animations: cleanAnims,
      audioSettings: {
        ...DEFAULT_AUDIO_SETTINGS,
        ...(selectedClip.audioSettings || {}),
        ducking: {
          enabled: false,
          duckVolume: 20,
          fadeDuration: 200,
        },
      },
    });
    saveSnapshot('Clear Clip Ducking');
    toast.info('Cleared ducking keyframes from this clip.');
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
          onClick={() => setShowAutoDuckingModal(true)}
          className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all flex items-center gap-1"
          title="Open Full AI Auto Ducking Studio in Top Toolbar"
        >
          <span>Studio</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2 pt-1">
        {hasVolumeKeyframes ? (
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-indigo-400 font-semibold flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" />
                Active ({volumeKeyframes.length} keyframes)
              </span>
              <button
                type="button"
                onClick={handleClearClipDucking}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-0.5 text-[9px] font-medium"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reset
              </button>
            </div>
            <p className="text-[9px] text-[var(--theme-text-muted)]">
              Volume is automatically ducked during dialogue. Keyframe diamonds are visible and adjustable on the timeline.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-black/10 border border-white/5 text-[10px] text-[var(--theme-text-muted)]">
              <Volume2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {overlappingVoiceClips.length > 0
                  ? `${overlappingVoiceClips.length} dialogue/voice clip(s) detected across other tracks.`
                  : 'Ready: Scans speech across other tracks and applies volume keyframes.'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleQuickDuckTrack}
              disabled={isDucking}
              className="w-full py-1.5 text-[10px] font-bold rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isDucking ? 'Scanning & Ducking...' : '⚡ 1-Click Auto Duck BGM Track'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
