import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Square, Sparkles, X, Loader2, Volume2, VolumeX, Music, Zap,
  ChevronLeft, ChevronRight, SkipBack, SkipForward
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { AICueResult, analyzeAudioWithGemini } from '@/utils/aiClient';
import { AudioOption, searchFreesound } from '@/utils/audioSearchClient';
import { WaveformViewer } from './WaveformViewer';
import { toast } from 'sonner';

interface CueWithOptions extends AICueResult {
  options: AudioOption[];
  // trimStart/trimEnd are offsets within the cue's audio (0 = use full cue)
  trimOffset: number;  // how many seconds into the audio to start playing
  trimDuration: number; // how many seconds to play
}

interface AiSoundDesignerProps {
  clip: any;
  cues: CueWithOptions[];
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// Utility: format seconds as M:SS.f
// ─────────────────────────────────────────────────────────────
function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
}

export function AiSoundDesigner({ clip, cues: initialCues, onClose }: AiSoundDesignerProps) {
  const { tracks, addMedia, addClip, addTrack } = useEditorStore();

  // ── Find video source ──────────────────────────────────────
  const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === clip.mediaId);
  const videoUrl = media?.url;

  // ── Local state ────────────────────────────────────────────
  // Cues with mutable selection + trim state
  const [cues, setCues] = useState<CueWithOptions[]>(() =>
    initialCues.map((c) => ({
      ...c,
      trimOffset: 0,
      trimDuration: Math.min(c.options[0]?.duration ?? (c.end - c.start), c.end - c.start),
    }))
  );
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    initialCues.forEach((_, i) => { init[i] = 0; });
    return init;
  });

  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [videoMuted, setVideoMuted] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);

  // ── Audition (inspector) single track ─────────────────────
  const [playingOptionKey, setPlayingOptionKey] = useState<string | null>(null);
  const inspectorAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Playhead drag ──────────────────────────────────────────
  const isDraggingPlayhead = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Trim drag ─────────────────────────────────────────────
  const trimDragRef = useRef<{ cueIdx: number; side: 'left' | 'right'; startX: number; startVal: number; startValTimeline?: number } | null>(null);
  const moveDragRef = useRef<{ cueIdx: number; startX: number; startValStart: number; startValEnd: number } | null>(null);

  // ── Audio/video refs ──────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioPlayersRef = useRef<Record<number, HTMLAudioElement>>({});
  const audioSrcMapRef = useRef<Record<number, string>>({}); // track the URL we loaded
  const syncIntervalRef = useRef<number | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Sync engine — runs every 50ms while playing
  // ─────────────────────────────────────────────────────────────
  const syncAudio = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const relTime = Math.max(0, v.currentTime - clip.trimStart);
    setCurrentTime(relTime);

    if (relTime >= clip.duration) {
      v.pause();
      v.currentTime = clip.trimStart;
      setIsPlaying(false);
      Object.values(audioPlayersRef.current).forEach((a) => { a.pause(); a.currentTime = 0; });
      return;
    }

    cues.forEach((cue, idx) => {
      const optIdx = selectedOptions[idx] ?? 0;
      const option = cue.options[optIdx];
      if (!option) return;

      let audio = audioPlayersRef.current[idx];
      if (!audio || audioSrcMapRef.current[idx] !== option.previewUrl) {
        if (audio) audio.pause();
        audio = new Audio(option.previewUrl);
        audio.crossOrigin = 'anonymous';
        audio.volume = volume / 100;
        audioPlayersRef.current[idx] = audio;
        audioSrcMapRef.current[idx] = option.previewUrl;
      }
      audio.volume = volume / 100;

      const isWithin = relTime >= cue.start && relTime < cue.end;
      if (isWithin) {
        if (audio.paused) audio.play().catch(() => {});
        const expected = relTime - cue.start + cue.trimOffset;
        if (Math.abs(audio.currentTime - expected) > 0.2) audio.currentTime = expected;
      } else {
        if (!audio.paused) { audio.pause(); audio.currentTime = cue.trimOffset; }
      }
    });
  }, [cues, selectedOptions, clip, volume]);

  useEffect(() => {
    if (isPlaying) {
      syncIntervalRef.current = window.setInterval(syncAudio, 50);
    } else {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      Object.values(audioPlayersRef.current).forEach((a) => a.pause());
    }
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [isPlaying, syncAudio]);

  useEffect(() => {
    return () => {
      Object.values(audioPlayersRef.current).forEach((a) => a.pause());
      if (inspectorAudioRef.current) inspectorAudioRef.current.pause();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Seek to a relative time (0 → clip.duration)
  // ─────────────────────────────────────────────────────────────
  const seekTo = useCallback((relTime: number) => {
    const clamped = Math.max(0, Math.min(clip.duration, relTime));
    if (videoRef.current) {
      videoRef.current.currentTime = clip.trimStart + clamped;
    }
    setCurrentTime(clamped);
    // Sync audio heads
    cues.forEach((cue, idx) => {
      const audio = audioPlayersRef.current[idx];
      if (!audio) return;
      const isWithin = clamped >= cue.start && clamped < cue.end;
      if (isWithin) {
        audio.currentTime = clamped - cue.start + cue.trimOffset;
        if (isPlaying && audio.paused) audio.play().catch(() => {});
      } else {
        audio.pause();
        audio.currentTime = cue.trimOffset;
      }
    });
  }, [clip, cues, isPlaying]);

  // ─────────────────────────────────────────────────────────────
  // Play / Pause
  // ─────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (isPlaying) {
      videoRef.current?.pause();
      cues.forEach((_, i) => {
        if (audioPlayersRef.current[i]) {
          audioPlayersRef.current[i]?.pause();
        }
      });
      setIsPlaying(false);
    } else {
      if (currentTime >= clip.duration - 0.05) seekTo(0);
      videoRef.current?.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (videoRef.current) { videoRef.current.pause(); }
    setIsPlaying(false);
    seekTo(0);
  };

  // ─────────────────────────────────────────────────────────────
  // Timeline click → seek
  // ─────────────────────────────────────────────────────────────
  const getTimeFromEvent = useCallback((e: React.MouseEvent | MouseEvent): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pct * clip.duration;
  }, [clip.duration]);

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Don't start playhead drag if clicking on a cue block or its children
    const target = e.target as HTMLElement;
    if (target.closest('[data-role="cue-block"]')) return;
    isDraggingPlayhead.current = true;
    seekTo(getTimeFromEvent(e));
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDraggingPlayhead.current) seekTo(getTimeFromEvent(e));
    };
    const onUp = () => { isDraggingPlayhead.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [seekTo, getTimeFromEvent]);

  // ─────────────────────────────────────────────────────────────
  // Move / Trim drag
  // ─────────────────────────────────────────────────────────────
  const startMoveDrag = (e: React.MouseEvent, cueIdx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const cue = cues[cueIdx];
    moveDragRef.current = {
      cueIdx, startX: e.clientX,
      startValStart: cue.start,
      startValEnd: cue.end
    };
  };

  const startTrimDrag = (e: React.MouseEvent, cueIdx: number, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    const cue = cues[cueIdx];
    trimDragRef.current = {
      cueIdx, side, startX: e.clientX,
      startVal: side === 'left' ? (cue.trimOffset || 0) : (cue.trimDuration || (cue.end - cue.start)),
      startValTimeline: side === 'left' ? cue.start : cue.end
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (moveDragRef.current && timelineRef.current) {
        const drag = moveDragRef.current;
        const rect = timelineRef.current.getBoundingClientRect();
        const pxPerSec = rect.width / clip.duration;
        const deltaSec = (e.clientX - drag.startX) / pxPerSec;

        setCues((prev) => prev.map((c, i) => {
          if (i !== drag.cueIdx) return c;
          const dur = drag.startValEnd - drag.startValStart;
          let newStart = drag.startValStart + deltaSec;
          if (newStart < 0) newStart = 0;
          let newEnd = newStart + dur;
          if (newEnd > clip.duration) {
            newEnd = clip.duration;
            newStart = newEnd - dur;
          }
          return { ...c, start: newStart, end: newEnd };
        }));
        return;
      }

      const drag = trimDragRef.current as any;
      if (!drag || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pxPerSec = rect.width / clip.duration;
      const deltaSec = (e.clientX - drag.startX) / pxPerSec;

      setCues((prev) => prev.map((c, i) => {
        if (i !== drag.cueIdx) return c;
        const opt = c.options[selectedOptions[drag.cueIdx] ?? 0];
        const maxAudioDur = opt?.duration ?? (c.end - c.start);
        
        if (drag.side === 'left') {
          const newOffset = drag.startVal + deltaSec;
          const clampedOffset = Math.max(0, Math.min(newOffset, maxAudioDur - 0.5));
          const actualDelta = clampedOffset - drag.startVal;
          return { ...c, trimOffset: clampedOffset, start: drag.startValTimeline + actualDelta };
        } else {
          const newDur = drag.startVal + deltaSec;
          const clampedDur = Math.max(0.5, Math.min(newDur, maxAudioDur - (c.trimOffset || 0)));
          const actualDelta = clampedDur - drag.startVal;
          return { ...c, trimDuration: clampedDur, end: drag.startValTimeline + actualDelta };
        }
      }));
    };
    const onUp = () => { trimDragRef.current = null; moveDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [selectedOptions, clip.duration]);

  // ─────────────────────────────────────────────────────────────
  // Inspector: audition single option
  // ─────────────────────────────────────────────────────────────
  const handleAuditionOption = (option: AudioOption, key: string) => {
    if (playingOptionKey === key) {
      inspectorAudioRef.current?.pause();
      setPlayingOptionKey(null);
      return;
    }
    inspectorAudioRef.current?.pause();
    if (isPlaying && videoRef.current) { videoRef.current.pause(); setIsPlaying(false); }

    const aud = new Audio(option.previewUrl);
    aud.crossOrigin = 'anonymous';
    aud.volume = volume / 100;
    inspectorAudioRef.current = aud;
    setPlayingOptionKey(key);
    aud.play().catch(() => setPlayingOptionKey(null));
    aud.onended = () => setPlayingOptionKey(null);
  };

  // Select an alternate option for a cue
  const selectOption = (cueIdx: number, optIdx: number) => {
    setSelectedOptions((prev) => ({ ...prev, [cueIdx]: optIdx }));
    const cue = cues[cueIdx];
    const option = cue.options[optIdx];
    if (option) {
      setCues((prev) => prev.map((c, i) =>
        i === cueIdx
          ? { ...c, trimOffset: 0, trimDuration: Math.min(option.duration, c.end - c.start) }
          : c
      ));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Import to timeline
  // ─────────────────────────────────────────────────────────────
  const handleApply = async () => {
    setIsApplying(true);
    setApplyProgress(0);
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    Object.values(audioPlayersRef.current).forEach((a) => a.pause());
    inspectorAudioRef.current?.pause();

    // Ensure we have at least two audio tracks (one for BGM, one for SFX)
    const existingAudioTracks = useEditorStore.getState().tracks.filter((t) => t.type === 'audio');
    if (existingAudioTracks.length < 1) addTrack('audio');
    if (useEditorStore.getState().tracks.filter((t) => t.type === 'audio').length < 2) addTrack('audio');

    const audioTracks = useEditorStore.getState().tracks.filter((t) => t.type === 'audio');
    const bgmTrack = audioTracks[0]!;
    const sfxTrack = audioTracks[1] ?? audioTracks[0]!;

    const total = Object.keys(selectedOptions).length;
    let done = 0;

    useEditorStore.getState().startTransaction?.();
    try {
      for (const [idxStr, optIdx] of Object.entries(selectedOptions)) {
        const cueIdx = parseInt(idxStr);
        const cue = cues[cueIdx];
        const option = cue.options[optIdx];
        if (!option) continue;

        try {
          const res = await fetch(option.previewUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const ext = option.previewUrl.includes('.ogg') ? 'ogg' : 'mp3';
          const mime = ext === 'ogg' ? 'audio/ogg' : 'audio/mp3';
          const filename = `${cue.query.replace(/\s+/g, '_')}_${option.id}.${ext}`;
          const file = new File([blob], filename, { type: mime, lastModified: Date.now() });
          const now = Date.now();
          const mediaId = `ai_audio_${option.id}_${now}_${cueIdx}`;
          const mediaItem = {
            id: mediaId,
            name: option.name.length > 28 ? option.name.substring(0, 28) + '…' : option.name,
            type: 'audio' as const,
            duration: option.duration,
            url: URL.createObjectURL(blob),
            createdAt: now
          };
          addMedia(mediaItem, file);

          const targetTrack = cue.type === 'bgm' ? bgmTrack : sfxTrack;
          const globalStart = clip.startTime + cue.start;
          const playDuration = Math.min(cue.trimDuration, cue.end - cue.start, option.duration - cue.trimOffset);

          addClip({
            id: `clip_ai_audio_${option.id}_${now}_${cueIdx}`,
            mediaId,
            trackId: targetTrack.id,
            startTime: globalStart,
            duration: playDuration,
            trimStart: cue.trimOffset,
            trimEnd: 0,
            opacity: 1,
            speed: 1,
            effects: [],
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            audioSettings: {
              volume: cue.type === 'bgm' ? -6 : 0,  // dB: BGM slightly quieter, SFX at unity
              pan: 0,
              fadeIn: cue.type === 'bgm' ? 1.0 : 0.05,
              fadeOut: cue.type === 'bgm' ? 1.5 : 0.1,
              bass: 0, treble: 0, muted: false,
              preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false,
            }
          });
        } catch (err) {
          console.error(`Failed to import ${option.name}:`, err);
        }

        done++;
        setApplyProgress(Math.round((done / total) * 100));
      }
      toast.success('AI Sound Design imported to timeline!');
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      useEditorStore.getState().endTransaction?.();
    }

    setIsApplying(false);
    onClose();
  };

  // ─────────────────────────────────────────────────────────────
  // Group cues by type for multi-track display
  // ─────────────────────────────────────────────────────────────
  const bgmCues = cues.map((c, i) => ({ cue: c, idx: i })).filter(({ cue }) => cue.type === 'bgm');
  const sfxTracks: Array<Array<{ cue: CueWithOptions; idx: number }>> = [];
  cues.forEach((c, i) => {
    if (c.type !== 'sfx') return;
    let placed = false;
    for (const track of sfxTracks) {
      if (!track.some(tc => (c.start < tc.cue.end && c.end > tc.cue.start))) {
        track.push({ cue: c, idx: i });
        placed = true;
        break;
      }
    }
    if (!placed) sfxTracks.push([{ cue: c, idx: i }]);
  });

  // ─────────────────────────────────────────────────────────────
  // Selected cue data for inspector panel
  // ─────────────────────────────────────────────────────────────
  const activeCue = activeCueIndex !== null ? cues[activeCueIndex] : null;

  // ─────────────────────────────────────────────────────────────
  // Render a single cue block on the timeline
  // ─────────────────────────────────────────────────────────────
  const renderCueBlock = (cue: CueWithOptions, idx: number, colorClass: string) => {
    const optIdx = selectedOptions[idx] ?? 0;
    const option = cue.options[optIdx];
    const isActive = activeCueIndex === idx;
    const leftPct = (cue.start / clip.duration) * 100;
    const widthPct = ((cue.end - cue.start) / clip.duration) * 100;

    return (
      <div
        key={idx}
        data-role="cue-block"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        className={`absolute top-1 bottom-1 rounded-md flex items-center overflow-hidden cursor-pointer select-none transition-all
          ${isActive
            ? 'ring-2 ring-white z-20'
            : 'z-10'
          }
          ${colorClass}
        `}
        onClick={(e) => { e.stopPropagation(); setActiveCueIndex(idx); }}
        onMouseDown={(e) => { setActiveCueIndex(idx); startMoveDrag(e, idx); }}
      >
        {/* Left trim handle */}
        <div
          data-role="trim-handle"
          className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/50 cursor-ew-resize z-30 block flex items-center justify-center"
          onMouseDown={(e) => startTrimDrag(e, idx, 'left')}
        >
          <div className="w-px h-3 bg-white/70" />
        </div>

        {/* Label */}
        <div className="flex-1 px-4 flex items-center justify-between min-w-0">
          <span className="text-[9px] font-semibold truncate">
            {option ? option.name : cue.query}
          </span>
          <span className="text-[8px] font-mono opacity-70 ml-1 shrink-0">
            {option ? `${option.duration.toFixed(0)}s` : 'N/A'}
          </span>
        </div>

        {/* Right trim handle */}
        <div
          data-role="trim-handle"
          className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/50 cursor-ew-resize z-30 block flex items-center justify-center"
          onMouseDown={(e) => startTrimDrag(e, idx, 'right')}
        >
          <div className="w-px h-3 bg-white/70" />
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden text-white">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] bg-[#161616] shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div>
              <h2 className="font-bold text-sm tracking-wide">AI Sound Designer</h2>
              <p className="text-[9px] text-[#707070]">Epidemic-style multi-track preview with BGM + SFX design</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isApplying} className="p-1 hover:bg-[#2a2a2a] rounded-lg text-[#707070] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Main body (canvas + inspector) ────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: Video Canvas */}
          <div className="flex flex-col border-r border-[#2a2a2a] bg-black" style={{ width: '58%' }}>
            {/* Video */}
            <div className="flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="max-w-full max-h-full object-contain"
                  muted={videoMuted}
                  playsInline
                />
              ) : (
                <div className="text-xs text-[#606060] text-center">
                  <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No video source
                </div>
              )}
            </div>

            {/* Player Controls */}
            <div className="shrink-0 px-4 py-3 bg-[#141414] border-t border-[#2a2a2a] space-y-2">
              {/* Progress bar */}
              <div
                className="relative h-1.5 bg-[#2a2a2a] rounded-full cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekTo(((e.clientX - rect.left) / rect.width) * clip.duration);
                }}
              >
                <div
                  className="absolute left-0 top-0 h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${(currentTime / Math.max(clip.duration, 0.01)) * 100}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${(currentTime / Math.max(clip.duration, 0.01)) * 100}%` }}
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-2">
                <button onClick={() => seekTo(0)} className="p-1.5 rounded-lg hover:bg-[#252525] text-[#a0a0a0] hover:text-white transition-colors">
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => seekTo(Math.max(0, currentTime - 5))} className="p-1.5 rounded-lg hover:bg-[#252525] text-[#a0a0a0] hover:text-white transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button onClick={handleStop} className="p-1.5 rounded-lg hover:bg-[#252525] text-[#a0a0a0] hover:text-white transition-colors">
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => seekTo(Math.min(clip.duration, currentTime + 5))} className="p-1.5 rounded-lg hover:bg-[#252525] text-[#a0a0a0] hover:text-white transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => seekTo(clip.duration)} className="p-1.5 rounded-lg hover:bg-[#252525] text-[#a0a0a0] hover:text-white transition-colors">
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                <div className="ml-auto flex items-center gap-2 text-[#a0a0a0]">
                  <span className="text-[10px] font-mono text-white">{fmt(currentTime)}</span>
                  <span className="text-[10px] font-mono">/</span>
                  <span className="text-[10px] font-mono">{fmt(clip.duration)}</span>
                  <button
                    onClick={() => setVideoMuted(!videoMuted)}
                    className={`p-1 ml-2 rounded transition-colors ${videoMuted ? 'text-red-400 hover:text-red-300' : 'text-[#a0a0a0] hover:text-white'}`}
                    title={videoMuted ? 'Unmute original audio' : 'Mute original audio'}
                  >
                    {videoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <Volume2 className="w-3 h-3" />
                  <input
                    type="range" min={0} max={100} value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-16 h-1 accent-amber-500"
                  />
                  <span className="text-[9px]">{volume}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Inspector / Alternates Panel */}
          <div className="flex flex-col overflow-y-auto bg-[#111]" style={{ width: '42%' }}>
            {activeCue ? (
              <div className="p-4 space-y-4">
                {/* Cue info */}
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${activeCue.type === 'bgm' ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {activeCue.type === 'bgm' ? '🎵 BGM' : '⚡ SFX'}
                    </span>
                    <span className="text-[9px] font-mono text-[#707070]">
                      {activeCue.start.toFixed(2)}s → {activeCue.end.toFixed(2)}s
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white capitalize">{activeCue.query}</h3>
                  <p className="text-[9px] text-[#707070] italic leading-relaxed">{activeCue.reason}</p>

                  {/* Trim controls & Waveform */}
                  {activeCue.options[selectedOptions[activeCueIndex!] ?? 0] && (() => {
                    const option = activeCue.options[selectedOptions[activeCueIndex!] ?? 0];
                    return (
                    <div className="pt-2 border-t border-[#2a2a2a]">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-[#707070] mb-1">Trim Selection (drag waveform):</p>
                        <div className="flex items-center gap-3 text-[9px] font-mono">
                          <span>Start: <span className="text-white">{activeCue.trimOffset.toFixed(2)}s</span></span>
                          <span>Duration: <span className="text-white">{activeCue.trimDuration.toFixed(2)}s</span></span>
                        </div>
                      </div>
                      <WaveformViewer
                        key={option.id}
                        audioUrl={option.previewUrl}
                        trimOffset={activeCue.trimOffset}
                        trimDuration={activeCue.trimDuration}
                        totalDuration={option.duration}
                        onChange={(offset, dur) => {
                          setCues((prev) => prev.map((c, i) => 
                            i === activeCueIndex ? { ...c, trimOffset: offset, trimDuration: dur } : c
                          ));
                        }}
                      />
                    </div>
                  )})()}
                </div>

                {/* Alternate Options */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[9px] text-[#707070] uppercase font-bold tracking-wider">
                      Alternate Sounds
                    </h4>
                    <button
                      onClick={async () => {
                        if (!activeCue.options.length) return;
                        const toastId = toast.loading('Double Automation: AI is listening to sounds...');
                        try {
                          const base64s = await Promise.all(activeCue.options.map(async opt => {
                            const res = await fetch(opt.previewUrl);
                            const blob = await res.blob();
                            return new Promise<string>((resolve) => {
                              const reader = new FileReader();
                              reader.onloadend = () => resolve(reader.result as string);
                              reader.readAsDataURL(blob);
                            });
                          }));
                          const result = await analyzeAudioWithGemini(base64s, activeCue.reason, activeCue.type);
                          toast.success('AI picked the best sound: ' + result.reason, { id: toastId });
                          selectOption(activeCueIndex!, result.selectedIndex);
                          setCues(prev => prev.map((c, i) => i === activeCueIndex ? { ...c, trimOffset: result.trimOffset } : c));
                        } catch (err: any) {
                          toast.error('AI Analysis failed: ' + err.message, { id: toastId });
                        }
                      }}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[9px] font-bold rounded flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-Pick & Trim
                    </button>
                  </div>
                  
                  {/* Clickable Alternative Keywords */}
                  {activeCue.alternatives && activeCue.alternatives.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {activeCue.alternatives.map((alt) => (
                        <button
                          key={alt}
                          onClick={async () => {
                            const toastId = toast.loading(`Searching: ${alt}`);
                            try {
                              const token = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_FREESOUND_API_KEY : undefined;
                              const newOpts = await searchFreesound(alt, token, activeCue.type);
                              setCues(prev => prev.map((c, i) => i === activeCueIndex ? { ...c, query: alt, options: newOpts, trimOffset: 0, trimDuration: Math.min(newOpts[0]?.duration ?? c.trimDuration, c.end - c.start) } : c));
                              setSelectedOptions(prev => ({ ...prev, [activeCueIndex!]: 0 }));
                              toast.success('Search updated', { id: toastId });
                            } catch(e: any) {
                              toast.error('Search failed: ' + e.message, { id: toastId });
                            }
                          }}
                          className="px-2 py-0.5 bg-[#252525] hover:bg-[#353535] text-[#909090] hover:text-white text-[9px] rounded-full transition-colors"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {activeCue.options && activeCue.options.length > 0 ? (
                      activeCue.options.map((option, optIdx) => {
                        const isSelected = (selectedOptions[activeCueIndex!] ?? 0) === optIdx;
                        const audKey = `${activeCueIndex}-${optIdx}`;
                        const isAuditioning = playingOptionKey === audKey;
                        return (
                          <div
                            key={option.id}
                            onClick={() => selectOption(activeCueIndex!, optIdx)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500'
                                : 'bg-[#191919] border-[#252525] hover:border-[#404040]'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-amber-500 bg-amber-500' : 'border-[#505050]'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-semibold text-white truncate">{option.name}</div>
                              <div className="text-[8px] text-[#707070]">{option.duration.toFixed(1)}s · {option.tags.slice(0, 3).join(', ')}</div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAuditionOption(option, audKey); }}
                              className={`p-1.5 rounded-full shrink-0 transition-colors ${
                                isAuditioning ? 'bg-red-500 text-white animate-pulse' : 'bg-[#252525] text-[#a0a0a0] hover:text-white hover:bg-[#303030]'
                              }`}
                            >
                              {isAuditioning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[10px] text-red-400 py-4 text-center bg-red-950/20 rounded-xl border border-red-900/30">
                        No sounds found for this query on Freesound.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#505050] p-6">
                <Music className="w-10 h-10 opacity-20" />
                <p className="text-xs text-center">Click a sound block on the timeline<br/>to inspect and swap alternates</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Multi-track Timeline ──────────────────────────────── */}
        <div className="shrink-0 border-t border-[#2a2a2a] bg-[#0c0c0c]">
          {/* Timeline header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e1e]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#707070]">Timeline</span>
            <span className="text-[8px] text-[#505050]">Drag playhead to scrub · Click block to select · Drag handles to trim</span>
          </div>

          {/* Ruler + tracks */}
          <div className="px-0">
            {/* Ruler row */}
            <div className="flex">
              <div className="w-16 shrink-0 border-r border-[#1e1e1e] bg-[#111]" />
              <div
                ref={timelineRef}
                className="flex-1 relative h-6 border-b border-[#1e1e1e] bg-[#111] cursor-crosshair select-none"
                onMouseDown={handleTimelineMouseDown}
              >
                {/* Tick marks */}
                {Array.from({ length: Math.ceil(clip.duration) + 1 }).map((_, sec) => (
                  <div
                    key={sec}
                    style={{ left: `${(sec / clip.duration) * 100}%` }}
                    className="absolute top-0 bottom-0 flex flex-col items-center"
                  >
                    <div className="w-px h-2 bg-[#333]" />
                    <span className="text-[7px] text-[#555] mt-0.5 font-mono">{sec}s</span>
                  </div>
                ))}
                {/* Playhead on ruler */}
                <div
                  style={{ left: `${(currentTime / Math.max(clip.duration, 0.01)) * 100}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30"
                >
                  <div className="w-2 h-2 bg-red-500 rotate-45 absolute -top-0.5 -left-[3px]" />
                </div>
              </div>
            </div>

            {/* BGM track row */}
            <div className="flex border-b border-[#1e1e1e]" style={{ height: '40px' }}>
              <div className="w-16 shrink-0 flex items-center justify-center border-r border-[#1e1e1e] bg-[#111] gap-1">
                <Music className="w-3 h-3 text-purple-400" />
                <span className="text-[8px] font-bold text-purple-400">BGM</span>
              </div>
              <div className="flex-1 relative bg-[#0e0e0e] overflow-hidden" onMouseDown={handleTimelineMouseDown}>
                {bgmCues.map(({ cue, idx }) => renderCueBlock(cue, idx, 'bg-purple-600/70 border border-purple-500/50 text-purple-100'))}
                {/* Playhead line on track */}
                <div
                  style={{ left: `${(currentTime / Math.max(clip.duration, 0.01)) * 100}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30"
                />
              </div>
            </div>

            {/* SFX track rows dynamically packed */}
            {sfxTracks.map((track, trackIdx) => (
              <div key={`sfx-${trackIdx}`} className="flex" style={{ height: '40px', borderTop: trackIdx > 0 ? '1px solid #1e1e1e' : 'none' }}>
                <div className="w-16 shrink-0 flex items-center justify-center border-r border-[#1e1e1e] bg-[#111] gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-[8px] font-bold text-amber-400">SFX {trackIdx + 1}</span>
                </div>
                <div className="flex-1 relative bg-[#0e0e0e] overflow-hidden" onMouseDown={handleTimelineMouseDown}>
                  {track.map(({ cue, idx }) => renderCueBlock(cue, idx, 'bg-amber-600/70 border border-amber-500/50 text-amber-100'))}
                  {/* Playhead line on track */}
                  <div
                    style={{ left: `${(currentTime / Math.max(clip.duration, 0.01)) * 100}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a2a2a] bg-[#161616] shrink-0">
          <div className="text-[9px] text-[#707070]">
            <span className="text-purple-400 font-bold">{bgmCues.length}</span> BGM ·{' '}
            <span className="text-amber-400 font-bold">{cues.filter(c => c.type === 'sfx').length}</span> SFX ·{' '}
            <span className="text-white font-bold">{cues.length}</span> total tracks ready to import
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={isApplying} className="px-4 py-1.5 text-xs font-semibold text-[#a0a0a0] bg-[#1e1e1e] hover:bg-[#2a2a2a] rounded-lg border border-[#2a2a2a] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || cues.length === 0}
              className="px-5 py-1.5 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow flex items-center gap-1.5 transition-colors"
            >
              {isApplying ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Importing {applyProgress}%</span></>
              ) : (
                <><Volume2 className="w-3.5 h-3.5 fill-black" /><span>Import Sound Design</span></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
