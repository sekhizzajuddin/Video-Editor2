import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Zap,
  Sliders,
  Sparkles,
  Music,
  Mic,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import {
  applyAutoDuckingToTrack,
  AutoDuckingConfig,
  DEFAULT_DUCKING_CONFIG,
} from '@/utils/aiAudioDucking';
import { toast } from 'sonner';

interface AutoDuckingModalProps {
  onClose: () => void;
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

export function AutoDuckingModal({ onClose }: AutoDuckingModalProps) {
  const {
    tracks,
    mediaLibrary,
    subtitles,
    selectedTrackId,
    selectedClipId,
    updateClip,
    saveSnapshot,
  } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      mediaLibrary: s.mediaLibrary,
      subtitles: s.subtitles || [],
      selectedTrackId: s.selectedTrackId,
      selectedClipId: s.selectedClipId,
      updateClip: s.updateClip,
      saveSnapshot: s.saveSnapshot,
    }))
  );

  // Auto-detect best candidate for BGM track:
  // 1. If selectedTrackId is set and has clips, prioritize it
  // 2. Else track of selectedClipId if audio
  // 3. Else track named 'bgm' / 'music' / 'audio'
  // 4. Else first audio track with clips
  const initialBgmTrackId = useMemo(() => {
    if (selectedTrackId) {
      const tr = tracks.find((t) => t.id === selectedTrackId);
      if (tr && tr.clips && tr.clips.length > 0) return tr.id;
    }
    if (selectedClipId) {
      for (const t of tracks) {
        if (t.clips?.some((c) => c.id === selectedClipId)) return t.id;
      }
    }
    const musicTrack = tracks.find((t) => {
      const name = (t.name || '').toLowerCase();
      return name.includes('bgm') || name.includes('music') || name.includes('audio');
    });
    if (musicTrack && musicTrack.clips && musicTrack.clips.length > 0) return musicTrack.id;

    const audioTrack = tracks.find((t) => t.type === 'audio' && t.clips && t.clips.length > 0);
    if (audioTrack) return audioTrack.id;

    // Fallback to first track with clips
    const anyWithClips = tracks.find((t) => t.clips && t.clips.length > 0);
    return anyWithClips?.id || tracks[0]?.id || '';
  }, [tracks, selectedTrackId, selectedClipId]);

  const [bgmTrackId, setBgmTrackId] = useState<string>(initialBgmTrackId);
  const [duckAmountDb, setDuckAmountDb] = useState<number>(-18);
  const [pacingPreset, setPacingPreset] = useState<'snappy' | 'natural' | 'ambient'>('natural');
  const [sensitivity, setSensitivity] = useState<'low' | 'normal' | 'high'>('normal');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<{
    duckedClipsCount: number;
    speechIntervalsCount: number;
    totalSpeechDuration: number;
  } | null>(null);

  // Selected BGM track details
  const targetTrack = useMemo(() => tracks.find((t) => t.id === bgmTrackId), [tracks, bgmTrackId]);
  const bgmClips = useMemo(() => targetTrack?.clips || [], [targetTrack]);

  // Detected voice sources across timeline
  const vocalSources = useMemo(() => {
    const list: Array<{ trackName: string; clipCount: number; type: string }> = [];
    for (const t of tracks) {
      if (t.id === bgmTrackId || t.muted || (t as any).isMuted) continue;
      const count = (t.clips || []).filter((c) => !c.disabled && !c.audioSettings?.muted).length;
      if (count > 0) {
        list.push({
          trackName: t.name || `Track ${t.id}`,
          clipCount: count,
          type: t.type,
        });
      }
    }
    return list;
  }, [tracks, bgmTrackId]);

  // Pacing timing parameters
  const pacingValues = useMemo(() => {
    switch (pacingPreset) {
      case 'snappy':
        return { attack: 0.2, hold: 0.25, release: 0.4 };
      case 'ambient':
        return { attack: 0.5, hold: 0.5, release: 1.0 };
      case 'natural':
      default:
        return { attack: 0.35, hold: 0.35, release: 0.6 };
    }
  }, [pacingPreset]);

  // One-Click Action: Execute Auto Ducking
  const handleApplyDucking = useCallback(async () => {
    if (!bgmTrackId || !targetTrack) {
      toast.error('Please select a valid BGM track.');
      return;
    }
    if (bgmClips.length === 0) {
      toast.warning('The selected BGM track has no clips to duck.');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(5);
    setStatusMessage('Scanning vocal tracks and dialogue...');
    setLastResult(null);

    try {
      const config: Partial<AutoDuckingConfig> = {
        duckAmountDb,
        attackDuration: pacingValues.attack,
        holdDuration: pacingValues.hold,
        releaseDuration: pacingValues.release,
        bridgeGap: 0.8,
        sensitivity,
        onProgress: (p, status) => {
          setProgressPercent(p);
          setStatusMessage(status);
        },
      };

      const result = await applyAutoDuckingToTrack(
        bgmTrackId,
        tracks,
        mediaLibrary,
        subtitles,
        config
      );

      if (result.success && result.duckedClipsCount > 0) {
        // Apply keyframes to all clips on the BGM track in Zustand store
        for (const [clipId, keyframes] of Object.entries(result.keyframesByClipId)) {
          const originalClip = bgmClips.find((c) => c.id === clipId);
          if (!originalClip) continue;

          const updatedAnimations = {
            ...(originalClip.animations || {}),
            'audio.volume': keyframes,
          };
          const duckVolumeLinear = Math.round(Math.pow(10, duckAmountDb / 20) * 100);
          const updatedAudioSettings = {
            ...DEFAULT_AUDIO_SETTINGS,
            ...(originalClip.audioSettings || {}),
            ducking: {
              enabled: true,
              duckVolume: duckVolumeLinear,
              duckDb: duckAmountDb,
              fadeDuration: Math.round(pacingValues.attack * 1000),
              attackDuration: Math.round(pacingValues.attack * 1000),
              holdDuration: Math.round(pacingValues.hold * 1000),
              releaseDuration: Math.round(pacingValues.release * 1000),
              appliedAt: Date.now(),
            },
          };

          updateClip(clipId, {
            animations: updatedAnimations,
            audioSettings: updatedAudioSettings,
          });
        }

        saveSnapshot('Apply AI Auto Audio Ducking');
        setLastResult({
          duckedClipsCount: result.duckedClipsCount,
          speechIntervalsCount: result.speechIntervalsCount,
          totalSpeechDuration: result.totalSpeechDuration,
        });

        toast.success(
          `⚡ Auto Ducking applied! Ducked ${result.speechIntervalsCount} vocal sections across ${result.duckedClipsCount} BGM clip(s).`
        );
      } else {
        toast.info(
          'No overlapping speech or dialogue detected on other tracks. Ducking not required.'
        );
      }
    } catch (err: any) {
      console.error('[AutoDuckingModal] Ducking failed:', err);
      toast.error('Failed to analyze audio for ducking.');
    } finally {
      setIsProcessing(false);
    }
  }, [
    bgmTrackId,
    targetTrack,
    bgmClips,
    duckAmountDb,
    pacingValues,
    sensitivity,
    tracks,
    mediaLibrary,
    subtitles,
    updateClip,
    saveSnapshot,
  ]);

  // Clear Ducking from BGM track
  const handleClearDucking = useCallback(() => {
    if (!targetTrack || bgmClips.length === 0) return;

    for (const clip of bgmClips) {
      if (!clip.animations?.['audio.volume'] && !clip.audioSettings?.ducking?.enabled) continue;
      const cleanAnimations = { ...(clip.animations || {}) };
      delete cleanAnimations['audio.volume'];

      const cleanAudioSettings = {
        ...DEFAULT_AUDIO_SETTINGS,
        ...(clip.audioSettings || {}),
        ducking: {
          enabled: false,
          duckVolume: 20,
          fadeDuration: 200,
        },
      };

      updateClip(clip.id, {
        animations: cleanAnimations,
        audioSettings: cleanAudioSettings,
      });
    }

    saveSnapshot('Clear Audio Ducking');
    setLastResult(null);
    toast.info(`Cleared ducking volume keyframes from ${targetTrack.name || 'BGM track'}.`);
  }, [targetTrack, bgmClips, updateClip, saveSnapshot]);

  const hasActiveDucking = useMemo(() => {
    return bgmClips.some(
      (c) => c.animations?.['audio.volume'] && c.animations['audio.volume'].length > 0
    );
  }, [bgmClips]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-bg-panel, #18181b)',
          borderColor: 'var(--theme-border, #27272a)',
          color: 'var(--theme-text-main, #f4f4f5)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border, #27272a)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Zap className="w-4 h-4 fill-white/20" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5 leading-tight">
                <span>AI Auto Audio Ducking</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  Pro DSP
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Automatically lower background music volume when dialogue or voice speaks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Target BGM Track Selector */}
          <div className="bg-black/20 rounded-xl p-3.5 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-indigo-400" />
                <span>Target Background Music (BGM) Track</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {bgmClips.length} {bgmClips.length === 1 ? 'clip' : 'clips'} on track
              </span>
            </div>

            <select
              value={bgmTrackId}
              onChange={(e) => setBgmTrackId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border bg-[#121214] border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-colors font-medium"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || `Track ${t.id}`} ({t.type.toUpperCase()}) — {t.clips?.length || 0} clip(s)
                </option>
              ))}
            </select>
          </div>

          {/* Voice Sources Summary */}
          <div className="bg-black/20 rounded-xl p-3.5 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dialogue &amp; Vocal Sources Scanned</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Auto-Detection Active
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {vocalSources.length > 0 ? (
                vocalSources.map((v, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-white/5 border border-white/10 text-slate-300"
                  >
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span>{v.trackName}:</span>
                    <strong className="text-white font-mono">{v.clipCount}</strong> voice {v.clipCount === 1 ? 'clip' : 'clips'}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-amber-400/90 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> No other audio tracks with clips found.
                </span>
              )}
              {subtitles.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                  <Sparkles className="w-3 h-3" />
                  <span>Subtitles/Captions:</span>
                  <strong className="text-white font-mono">{subtitles.length}</strong> cues
                </span>
              )}
            </div>
          </div>

          {/* Ducking Level Settings */}
          <div className="bg-black/20 rounded-xl p-3.5 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ducking Reduction Amount</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-indigo-400">{duckAmountDb} dB</span>
                <span className="text-[10px] text-slate-400">
                  (~{Math.round(Math.pow(10, duckAmountDb / 20) * 100)}% vol)
                </span>
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDuckAmountDb(-12)}
                className={`px-2.5 py-1.5 text-[11px] rounded-lg border font-medium transition-all ${
                  duckAmountDb === -12
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                Subtle (-12 dB)
              </button>
              <button
                type="button"
                onClick={() => setDuckAmountDb(-18)}
                className={`px-2.5 py-1.5 text-[11px] rounded-lg border font-medium transition-all ${
                  duckAmountDb === -18
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                Broadcast (-18 dB)★
              </button>
              <button
                type="button"
                onClick={() => setDuckAmountDb(-24)}
                className={`px-2.5 py-1.5 text-[11px] rounded-lg border font-medium transition-all ${
                  duckAmountDb === -24
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                Deep Duck (-24 dB)
              </button>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="-32"
              max="-6"
              step="1"
              value={duckAmountDb}
              onChange={(e) => setDuckAmountDb(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Pacing & Transitions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2">
              <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Ramp Pacing</span>
              </label>
              <div className="flex flex-col gap-1">
                {(['snappy', 'natural', 'ambient'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPacingPreset(mode)}
                    className={`px-2 py-1 text-[10px] rounded-md border text-left font-medium capitalize transition-all ${
                      pacingPreset === mode
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 font-semibold'
                        : 'bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'snappy' && 'Snappy (0.2s / 0.4s)'}
                    {mode === 'natural' && 'Natural Broadcast (0.35s / 0.6s)'}
                    {mode === 'ambient' && 'Ambient Swell (0.5s / 1.0s)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2">
              <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                <Sliders className="w-3 h-3 text-slate-400" />
                <span>Voice Sensitivity</span>
              </label>
              <div className="flex flex-col gap-1">
                {(['low', 'normal', 'high'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSensitivity(s)}
                    className={`px-2 py-1 text-[10px] rounded-md border text-left font-medium capitalize transition-all ${
                      sensitivity === s
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 font-semibold'
                        : 'bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s === 'high' && 'High (Picks up soft whispers)'}
                    {s === 'normal' && 'Normal (Balanced speech)'}
                    {s === 'low' && 'Low (Loud speech only)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress / Status banner */}
          {isProcessing && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-indigo-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  {statusMessage || 'Processing audio ducking...'}
                </span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Result Banner */}
          {lastResult && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">
                  Auto Ducking Applied Successfully!
                </p>
                <p className="text-[11px] text-emerald-400/80">
                  Ducked {lastResult.speechIntervalsCount} vocal sections ({lastResult.totalSpeechDuration}s total speech) across {lastResult.duckedClipsCount} BGM clip(s).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t flex items-center justify-between bg-black/30" style={{ borderColor: 'var(--theme-border, #27272a)' }}>
          {hasActiveDucking ? (
            <button
              type="button"
              onClick={handleClearDucking}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 font-medium disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Ducking Keyframes</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs rounded-lg text-slate-300 hover:bg-white/10 transition-colors font-medium"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleApplyDucking}
              disabled={isProcessing || bgmClips.length === 0}
              className="px-4 py-2 text-xs rounded-xl font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-white/20" />
              <span>{isProcessing ? 'Analyzing Vocals...' : '⚡ Apply Auto Ducking (One-Click)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
