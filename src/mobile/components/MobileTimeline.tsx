// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/Timeline.tsx
//   src/timeline/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  Video,
  Music,
  Type,
  Sparkles,
  Layers,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  CopyPlus,
  ClipboardPaste,
  Gauge,
  Plus,
  Timer,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
} from 'lucide-react';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { getPlaybackTime, subscribePlaybackTime } from '@/utils/playbackClock';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import { formatCentisecondTime } from '@/timeline';
import { ArrangeModeOverlay } from '@/timeline/components/ArrangeModeOverlay';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { WaveformOverlay } from '@/timeline/components/WaveformOverlay';
import { FrameStripOverlay } from '@/timeline/components/FrameStripOverlay';
import { toast } from 'sonner';


const RULER_H = 24;
const TRACK_H = 48;
const THIN_TRACK_H = 36;
const MIN_CLIP_W = 12;
const MIN_DURATION = 0.05;
const PLAYHEAD_HIT_W = 32;

const TRACK_ICON: Record<TimelineTrack['type'], typeof Video> = {
  video: Video,
  audio: Music,
  text: Type,
  fx: Sparkles,
  adjustment: Layers,
};

const trackHeight = (t: TimelineTrack) =>
  t.type === 'text' || t.type === 'fx' || t.type === 'adjustment' ? THIN_TRACK_H : TRACK_H;

const clipColor = (media?: MediaItem, clip?: TimelineClip): string => {
  if (clip?.textSettings) return '#8b5cf6';
  if (clip?.fxSettings) return '#f43f5e';
  switch (media?.type) {
    case 'video':
      return '#2563eb';
    case 'image':
      return '#d97706';
    case 'audio':
      return '#059669';
    case 'text':
      return '#8b5cf6';
    case 'fx':
      return '#f43f5e';
    default:
      return '#3f3f46';
  }
};

function niceTickStep(zoom: number): number {
  const targetPx = 70;
  const raw = targetPx / Math.max(1, zoom);
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  return steps.find((s) => s >= raw) ?? 300;
}

type DragState =
  | { kind: 'scrub' }
  | { kind: 'move'; clipId: string; grabOffset: number; startStart: number }
  | { kind: 'trim-start'; clipId: string; startStart: number; startTrimStart: number }
  | { kind: 'trim-end'; clipId: string; startEnd: number; startTrimEnd: number }
  | null;

export function MobileTimeline({ 
  onSelectClip, 
  onOpenTransitions 
}: { 
  onSelectClip: () => void;
  onOpenTransitions?: () => void;
}) {
  const {
    tracks,
    zoomLevel,
    zoomIn,
    zoomOut,
    totalDuration,
    selectedClipId,
    selectedClipIds,
    selectClip,
    seek,
    setIsScrubbing,
    moveClip,
    updateClip,
    splitClip,
    removeClip,
    duplicateClip,
    copyClip,
    pasteClip,
    clipboardData,
    addTrack,
    removeTrack,
    toggleTrackLock,
    toggleTrackMute,
    toggleTrackHidden,
    activeTool,
    setActiveTool,
    selectedTransitionClipId,
    selectTransition,
    saveSnapshot,
    mediaLibrary,
    pipWindows,
    isArrangeMode,
    setArrangeMode,
  } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      zoomLevel: s.zoomLevel,
      zoomIn: s.zoomIn,
      zoomOut: s.zoomOut,
      totalDuration: s.totalDuration,
      selectedClipId: s.selectedClipId,
      selectedClipIds: s.selectedClipIds,
      selectClip: s.selectClip,
      selectedTransitionClipId: s.selectedTransitionClipId,
      selectTransition: s.selectTransition,
      seek: s.seek,
      setIsScrubbing: s.setIsScrubbing,
      moveClip: s.moveClip,
      updateClip: s.updateClip,
      splitClip: s.splitClip,
      removeClip: s.removeClip,
      duplicateClip: s.duplicateClip,
      copyClip: s.copyClip,
      pasteClip: s.pasteClip,
      clipboardData: s.clipboardData,
      addTrack: s.addTrack,
      removeTrack: s.removeTrack,
      toggleTrackLock: s.toggleTrackLock,
      toggleTrackMute: s.toggleTrackMute,
      toggleTrackHidden: s.toggleTrackHidden,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      saveSnapshot: s.saveSnapshot,
      mediaLibrary: s.mediaLibrary,
      pipWindows: s.pipWindows,
      isArrangeMode: s.isArrangeMode,
      setArrangeMode: s.setArrangeMode,
    }))
  );

  const currentTime = usePlaybackTime(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const longTapTimeoutRef = useRef<any>(null);
  const isUserScrolling = useRef(false);
  const isAutoScrolling = useRef(false);
  // rAF throttle for playhead scrubbing — coalesces rapid pointermove events
  // into at most one `seek()` per animation frame for buttery-smooth scrubbing.
  const scrubRafRef = useRef<number | null>(null);
  const latestScrubXRef = useRef<number>(0);

  // MOBILE PERF: Drive auto-scroll directly from the React-free playback clock
  // instead of through React state (which has re-render latency). This matches
  // the desktop PlayheadComponents pattern for smooth ~30Hz DOM scroll updates.
  useEffect(() => {
    let lastScrollTime = 0;
    const unsub = subscribePlaybackTime(() => {
      if (!useEditorStore.getState().isPlaying || dragRef.current || isUserScrolling.current) return;
      if (!scrollRef.current) return;
      const now = performance.now();
      if (now - lastScrollTime < 33) return; // 30Hz throttle
      lastScrollTime = now;
      isAutoScrolling.current = true;
      scrollRef.current.scrollLeft = getPlaybackTime() * zoomLevel;
    });
    return unsub;
  }, [zoomLevel]);

  const onScroll = useCallback(() => {
    if (!scrollRef.current) return;
    if (isAutoScrolling.current) {
      isAutoScrolling.current = false;
      return;
    }
    const time = scrollRef.current.scrollLeft / zoomLevel;
    seek(time);
  }, [zoomLevel, seek]);

  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const [selectedTrackForOptions, setSelectedTrackForOptions] = useState<TimelineTrack | null>(null);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const [showTimelineCopyMenu, setShowTimelineCopyMenu] = useState(false);
  const [showTimelinePasteMenu, setShowTimelinePasteMenu] = useState(false);
  const [blankPastePos, setBlankPastePos] = useState<{ trackId: string; time: number; x: number; y: number } | null>(null);

  const [preview, setPreview] = useState<{
    clipId: string;
    startTime: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
  } | null>(null);

  const targetId = selectedClipIds[0] || selectedClipId;
  const hasSelection = !!targetId;
  const targetClip = targetId ? findClipInTracks(tracks, targetId, pipWindows) : null;
  const isText = !!targetClip?.textSettings;

  const mediaMap = useMemo(() => {
    const m = new Map<string, MediaItem>();
    for (const item of mediaLibrary) m.set(item.id, item);
    return m;
  }, [mediaLibrary]);

  const clipMap = useMemo(() => {
    const m = new Map<string, TimelineClip>();
    for (const t of tracks) for (const c of t.clips) m.set(c.id, c);
    return m;
  }, [tracks]);

  const contentWidth = Math.max(
    (totalDuration > 0 ? totalDuration : 10) * zoomLevel + 200,
    800
  );

  const timeAt = useCallback(
    (clientX: number) => {
      const rect = tracksRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return (clientX - rect.left) / zoomLevel;
    },
    [zoomLevel]
  );

  const snapTime = useCallback(
    (t: number, excludeClipId?: string) => {
      const snapEnabled = useEditorStore.getState().settings.snapEnabled;
      if (!snapEnabled) {
        setSnapLineX(null);
        return Math.max(0, t);
      }
      
      let best = Math.max(0, t);
      const candidates: number[] = [0, useEditorStore.getState().currentTime]; // snap to start and playhead
      const threshold = 10 / zoomLevel; // ~10px snap distance
      for (const track of tracks) {
        for (const c of track.clips) {
          if (c.id === excludeClipId) continue;
          candidates.push(c.startTime, c.startTime + c.duration);
        }
      }
      for (const pip of Object.values(pipWindows)) {
        const parent = findClipInTracks(tracks, pip.parentClipId, pipWindows);
        const pipAnchor = parent ? parent.startTime + pip.relativeStartTime : 0;
        for (const track of pip.tracks) {
          for (const c of track.clips) {
            if (c.id === excludeClipId) continue;
            candidates.push(c.startTime + pipAnchor, c.startTime + c.duration + pipAnchor);
          }
        }
      }
      
      let bestDist = Infinity;
      let snappedToCandidate = false;
      for (const cand of candidates) {
        const d = Math.abs(t - cand);
        if (d < threshold && d < bestDist) {
          best = cand;
          bestDist = d;
          snappedToCandidate = true;
        }
      }
      if (snappedToCandidate) {
        setSnapLineX(best * zoomLevel);
      } else {
        setSnapLineX(null);
      }
      return best;
    },
    [zoomLevel, tracks]
  );

  const commitDrag = useCallback(() => {
    const drag = dragRef.current;
    setPreview(null);
    setSnapLineX(null);
    if (!drag) return;
    dragRef.current = null;

    if (drag.kind === 'move') {
      if (preview && Math.abs(preview.startTime - drag.startStart) > 0.001) {
        moveClip(drag.clipId, preview.startTime, undefined, false);
        saveSnapshot('Move clip');
      }
    } else if (drag.kind === 'trim-start' && preview) {
      const clip = clipMap.get(drag.clipId);
      if (clip) {
        if (activeTool === 'rateStretch') {
          const originalSpeed = clip.speed || 1.0;
          const sourceContentDuration = clip.duration * originalSpeed;
          const newDuration = Math.max(MIN_DURATION, preview.duration);
          const newSpeed = sourceContentDuration / newDuration;
          updateClip(drag.clipId, {
            startTime: preview.startTime,
            duration: newDuration,
            speed: newSpeed,
          });
          saveSnapshot('Rate stretch clip');
        } else {
          updateClip(drag.clipId, {
            startTime: preview.startTime,
            duration: Math.max(MIN_DURATION, preview.duration),
            trimStart: Math.max(0, preview.trimStart),
          });
          saveSnapshot('Trim clip');
        }
      }
    } else if (drag.kind === 'trim-end' && preview) {
      const clip = clipMap.get(drag.clipId);
      if (clip) {
        if (activeTool === 'rateStretch') {
          const originalSpeed = clip.speed || 1.0;
          const sourceContentDuration = clip.duration * originalSpeed;
          const newDuration = Math.max(MIN_DURATION, preview.duration);
          const newSpeed = sourceContentDuration / newDuration;
          updateClip(drag.clipId, {
            duration: newDuration,
            speed: newSpeed,
          });
          saveSnapshot('Rate stretch clip');
        } else {
          updateClip(drag.clipId, {
            duration: Math.max(MIN_DURATION, preview.duration),
            trimEnd: Math.max(0, preview.trimEnd),
          });
          saveSnapshot('Trim clip');
        }
      }
    }
  }, [preview, moveClip, saveSnapshot, updateClip, clipMap, activeTool]);

  const beginScrub = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { kind: 'scrub' };
      setIsScrubbing(true);
      seek(Math.max(0, timeAt(e.clientX)));
    },
    [seek, setIsScrubbing, timeAt]
  );

  const onPointerDownRuler = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      beginScrub(e);
    },
    [beginScrub]
  );

  const onPointerDownPlayhead = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      beginScrub(e);
    },
    [beginScrub]
  );

  const onPointerDownClip = useCallback(
    (e: React.PointerEvent, clip: TimelineClip) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      selectClip(clip.id);
      onSelectClip();
      const grabTime = Math.max(0, timeAt(e.clientX));
      dragRef.current = {
        kind: 'move',
        clipId: clip.id,
        grabOffset: grabTime - clip.startTime,
        startStart: clip.startTime,
      };
      setPreview({
        clipId: clip.id,
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      });
    },
    [selectClip, onSelectClip, timeAt]
  );

  const onPointerDownTrim = useCallback(
    (e: React.PointerEvent, clip: TimelineClip, side: 'start' | 'end') => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      selectClip(clip.id);
      dragRef.current =
        side === 'start'
          ? { kind: 'trim-start', clipId: clip.id, startStart: clip.startTime, startTrimStart: clip.trimStart }
          : { kind: 'trim-end', clipId: clip.id, startEnd: clip.startTime + clip.duration, startTrimEnd: clip.trimEnd };
      setPreview({
        clipId: clip.id,
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      });
    },
    [selectClip]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      // Scrubbing is rAF-throttled: only the latest pointer position wins each
      // frame, so we never queue up redundant `seek()` calls / store writes.
      if (drag.kind === 'scrub') {
        latestScrubXRef.current = e.clientX;
        if (scrubRafRef.current === null) {
          scrubRafRef.current = requestAnimationFrame(() => {
            scrubRafRef.current = null;
            const t = Math.max(0, timeAt(latestScrubXRef.current));
            seek(t);
          });
        }
        return;
      }

      const t = Math.max(0, timeAt(e.clientX));

      if (drag.kind === 'move') {
        const clip = clipMap.get(drag.clipId);
        if (!clip) return;
        const newStart = snapTime(t - drag.grabOffset, drag.clipId);
        setPreview((p) => (p ? { ...p, startTime: newStart } : p));
        return;
      }

      if (drag.kind === 'trim-start') {
        const clip = clipMap.get(drag.clipId);
        if (!clip) return;
        const newStart = snapTime(t, drag.clipId);
        
        if (activeTool === 'rateStretch') {
          const originalSpeed = clip.speed || 1.0;
          const sourceContentDuration = clip.duration * originalSpeed;
          
          const originalEnd = drag.startStart + clip.duration;
          let newDuration = Math.max(MIN_DURATION, originalEnd - newStart);
          let newSpeed = sourceContentDuration / newDuration;
          
          newSpeed = Math.min(20, Math.max(0.1, newSpeed));
          newDuration = sourceContentDuration / newSpeed;
          
          const clampedStart = originalEnd - newDuration;
          
          setPreview({
            clipId: clip.id,
            startTime: clampedStart,
            duration: newDuration,
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
          });
        } else {
          const speed = clip.speed || 1;
          const minDelta = Math.max(-drag.startStart, -drag.startTrimStart / speed);
          const delta = Math.max(minDelta, newStart - drag.startStart);
          const newDuration = Math.max(MIN_DURATION, clip.duration - delta);
          const clampedStart = clip.duration - newDuration + drag.startStart;
          setPreview({
            clipId: clip.id,
            startTime: clampedStart,
            duration: newDuration,
            trimStart: Math.max(0, drag.startTrimStart + (clampedStart - drag.startStart) * speed),
            trimEnd: clip.trimEnd,
          });
        }
        return;
      }

      if (drag.kind === 'trim-end') {
        const clip = clipMap.get(drag.clipId);
        if (!clip) return;
        const newEnd = snapTime(t, drag.clipId);
        
        if (activeTool === 'rateStretch') {
          const originalSpeed = clip.speed || 1.0;
          const sourceContentDuration = clip.duration * originalSpeed;
          
          let newDuration = Math.max(MIN_DURATION, newEnd - clip.startTime);
          let newSpeed = sourceContentDuration / newDuration;
          
          newSpeed = Math.min(20, Math.max(0.1, newSpeed));
          newDuration = sourceContentDuration / newSpeed;
          
          setPreview({
            clipId: clip.id,
            startTime: clip.startTime,
            duration: newDuration,
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
          });
        } else {
          const speed = clip.speed || 1;
          const maxDelta = drag.startTrimEnd / speed;
          const delta = Math.min(maxDelta, newEnd - drag.startEnd);
          const newDuration = Math.max(MIN_DURATION, clip.duration + delta);
          setPreview({
            clipId: clip.id,
            startTime: clip.startTime,
            duration: newDuration,
            trimStart: clip.trimStart,
            trimEnd: Math.max(0, drag.startTrimEnd - delta * speed),
          });
        }
        return;
      }
    },
    [timeAt, clipMap, snapTime, seek, activeTool]
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.kind === 'scrub') {
      if (scrubRafRef.current !== null) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
      setIsScrubbing(false);
    }
    commitDrag();
  }, [commitDrag, setIsScrubbing]);

  // Track actions
  const moveTrack = (trackId: string, direction: 'up' | 'down') => {
    const currentTracks = [...tracks];
    const idx = currentTracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentTracks.length) return;
    const [removed] = currentTracks.splice(idx, 1);
    currentTracks.splice(newIdx, 0, removed);
    useEditorStore.setState({ tracks: currentTracks });
    saveSnapshot(`Move track ${direction}`);
    setSelectedTrackForOptions(null);
  };

  const handleSplit = () => {
    const state = useEditorStore.getState();
    const t = state.currentTime;
    if (targetId) {
      const c = findClipInTracks(state.tracks, targetId, state.pipWindows);
      if (c && t > c.startTime + 0.01 && t < c.startTime + c.duration - 0.01) {
        splitClip(targetId, t);
        toast.success('Clip split at playhead');
      } else {
        toast.warning('Playhead is not over the clip.');
      }
    } else {
      toast.warning('Select a clip first.');
    }
  };

  const handleToggleReverse = () => {
    if (!targetId) { toast.warning('Select a clip first.'); return; }
    const clip = clipMap.get(targetId);
    if (!clip) return;
    updateClip(targetId, {
      isReversed: !clip.isReversed,
      freezeFrame: undefined,
    });
    toast.info(clip.isReversed ? 'Reverse removed' : 'Clip reversed ⏪');
  };

  const handleFreezeFrame = () => {
    if (!targetId) { toast.warning('Select a clip first.'); return; }
    const clip = clipMap.get(targetId);
    if (!clip) return;
    const ct = useEditorStore.getState().currentTime;
    if (ct < clip.startTime || ct > clip.startTime + clip.duration) {
      toast.warning('Playhead must be over the clip to freeze.');
      return;
    }
    const mediaTime = getMediaTimeForClip({
      id: clip.id,
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart: clip.trimStart,
      speed: clip.speed,
      speedRamp: clip.speedRamp,
    }, ct);
    if (clip.freezeFrame !== undefined) {
      updateClip(targetId, { freezeFrame: undefined });
      toast.info('Freeze frame removed');
    } else {
      updateClip(targetId, { freezeFrame: mediaTime, isReversed: undefined });
      toast.success(`Frozen at ${mediaTime.toFixed(2)}s ❄️`);
    }
  };

  const handleBlankPointerDown = (e: React.PointerEvent, trackId?: string) => {
    selectClip(null);
    useEditorStore.getState().selectClips([]);
    useEditorStore.getState().selectTransition(null);
    useEditorStore.getState().selectTrack(null);

    const clickX = e.clientX;
    const clickY = e.clientY;
    const clickedTime = timeAt(clickX);

    if (trackId) {
      longTapTimeoutRef.current = setTimeout(() => {
        setBlankPastePos({ trackId, time: clickedTime, x: clickX, y: clickY });
      }, 500);
    }
  };

  const handleBlankPointerUp = () => {
    if (longTapTimeoutRef.current) {
      clearTimeout(longTapTimeoutRef.current);
      longTapTimeoutRef.current = null;
    }
  };

  const rulerTicks = useMemo(() => {
    const step = niceTickStep(zoomLevel);
    const duration = Math.max(totalDuration, 10);
    const ticks: { time: number; label: string }[] = [];
    for (let t = 0; t <= duration + step; t += step) {
      ticks.push({ time: t, label: formatCentisecondTime(t) });
    }
    return ticks;
  }, [zoomLevel, totalDuration]);

  const displayClip = (clip: TimelineClip) =>
    preview && preview.clipId === clip.id
      ? { ...clip, startTime: preview.startTime, duration: preview.duration, trimStart: preview.trimStart, trimEnd: preview.trimEnd }
      : clip;

  const playheadX = currentTime * zoomLevel;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#121216] select-none">
      {/* Quick-action editing toolbar near zoom */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 bg-[#16161c] px-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSplit}
            disabled={!hasSelection}
            title="Split Clip"
            className="flex h-6 items-center gap-1 rounded bg-white/5 px-2 text-[10px] font-medium text-white/80 active:bg-white/15 disabled:opacity-30"
          >
            <Scissors className="h-3 w-3" />
            <span>Split</span>
          </button>
          {/* Arrange Mode Button */}
          <button
            onClick={() => setArrangeMode(!isArrangeMode)}
            title="Arrange clips"
            className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors ${
              isArrangeMode
                ? 'bg-amber-500 text-black font-semibold'
                : 'bg-white/5 text-white/80 active:bg-white/15'
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
            <span>Arrange</span>
          </button>
          <button
            onClick={() => {
              const nextTool = activeTool === 'rateStretch' ? 'select' : 'rateStretch';
              setActiveTool(nextTool);
              toast.info(nextTool === 'rateStretch' ? 'Rate Stretch tool active' : 'Select tool active');
            }}
            title="Rate Stretch Tool (R)"
            className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors ${
              activeTool === 'rateStretch'
                ? 'bg-purple-600 text-white font-semibold shadow-sm'
                : 'bg-white/5 text-white/80 active:bg-white/15'
            }`}
          >
            <Gauge className="h-3 w-3" />
            <span>Stretch</span>
          </button>
          {/* Reverse clip */}
          <button
            onClick={handleToggleReverse}
            disabled={!hasSelection}
            title="Reverse clip (play backward)"
            className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors ${
              targetClip?.isReversed
                ? 'bg-purple-600 text-white font-semibold shadow-sm'
                : 'bg-white/5 text-white/80 active:bg-white/15'
            } disabled:opacity-30`}
          >
            <span className="text-[11px]">&#9194;</span>
            <span>Rev</span>
          </button>
          {/* Freeze frame */}
          <button
            onClick={handleFreezeFrame}
            disabled={!hasSelection}
            title={targetClip?.freezeFrame !== undefined ? "Unfreeze clip" : "Freeze frame at playhead"}
            className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors ${
              targetClip?.freezeFrame !== undefined
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-white/5 text-white/80 active:bg-white/15'
            } disabled:opacity-30`}
          >
            <span className="text-[11px]">&#10052;</span>
            <span>Freeze</span>
          </button>
          <button
            onClick={duplicateClip}
            disabled={!hasSelection}
            title="Duplicate"
            className="flex h-6 items-center gap-1 rounded bg-white/5 px-2 text-[10px] font-medium text-white/80 active:bg-white/15 disabled:opacity-30"
          >
            <CopyPlus className="h-3 w-3" />
            <span>Dup</span>
          </button>
          <button
            onClick={() => {
              setShowTimelineCopyMenu(!showTimelineCopyMenu);
              setShowTimelinePasteMenu(false);
            }}
            disabled={!hasSelection}
            title="Copy"
            className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors ${
              showTimelineCopyMenu ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-white/80 active:bg-white/15'
            } disabled:opacity-30`}
          >
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </button>
          <button
            onClick={() => {
              setShowTimelinePasteMenu(!showTimelinePasteMenu);
              setShowTimelineCopyMenu(false);
            }}
            disabled={!(clipboardData?.clips && clipboardData.clips.length > 0)}
            title="Paste"
            className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors ${
              showTimelinePasteMenu ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-white/80 active:bg-white/15'
            } disabled:opacity-30`}
          >
            <ClipboardPaste className="h-3 w-3" />
            <span>Paste</span>
          </button>
          <button
            onClick={() => {
              if (targetId) removeClip(targetId);
            }}
            disabled={!hasSelection}
            title="Delete"
            className="flex h-6 items-center gap-1 rounded bg-rose-500/10 px-2 text-[10px] font-medium text-rose-400 active:bg-rose-500/20 disabled:opacity-30"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-white/80 active:bg-white/15"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={zoomIn}
            className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-white/80 active:bg-white/15"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* ── Arrange Mode Overlay ───────────────────────────────────── */}
        {isArrangeMode && <ArrangeModeOverlay />}

        {/* Stationary Playhead (Centered at 50%) */}
        <div className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: '50%' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-amber-400" />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
        </div>

        {/* Scrollable Container with synchronized vertical & horizontal scroll */}
        <div
          ref={scrollRef}
          className="mobile-no-scrollbar h-full w-full overflow-x-auto overflow-y-auto touch-pan-x touch-pan-y relative"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={() => { isUserScrolling.current = true; }}
          onTouchEnd={() => { isUserScrolling.current = false; }}
          onScroll={onScroll}
        >
          <div
            ref={contentRef}
            className="relative flex min-w-max min-h-full"
          >
            {/* Sticky Track rail on the left (scrolls vertically with tracks, pins horizontally) */}
            <div className="sticky left-0 z-30 w-12 shrink-0 border-r border-white/10 bg-[#16161a] shadow-lg flex flex-col">
              <div style={{ height: RULER_H }} className="border-b border-white/10 flex items-center justify-center bg-[#16161a]">
                <span className="text-[9px] font-mono text-white/40">Track</span>
              </div>
              {tracks.map((t) => (
                <div
                  key={t.id}
                  style={{ height: trackHeight(t) }}
                  className={`relative flex w-full flex-col items-center justify-center gap-0.5 border-b border-white/5 transition-colors ${
                    selectedTrackForOptions?.id === t.id ? 'bg-amber-500/20 text-amber-400' : (t.hidden ? 'text-zinc-500 bg-black/20' : 'text-white/60 hover:bg-white/5')
                  }`}
                >
                  <button
                    className="flex flex-col items-center justify-center w-full h-full pb-3"
                    onClick={() => setSelectedTrackForOptions(selectedTrackForOptions?.id === t.id ? null : t)}
                  >
                    {t.hidden ? (
                      <EyeOff className="h-4 w-4 text-zinc-500 mb-0.5" />
                    ) : (
                      React.createElement(TRACK_ICON[t.type] ?? Layers, { className: 'h-4 w-4 mb-0.5' })
                    )}
                    <span className="text-[7px] leading-none uppercase font-mono">{t.type.slice(0, 3)}</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrackHidden(t.id);
                    }}
                    className="absolute bottom-1 right-1 p-1 hover:bg-white/10 rounded"
                  >
                    {t.hidden ? <EyeOff className="w-2.5 h-2.5 text-zinc-500" /> : <Eye className="w-2.5 h-2.5 text-white/40" />}
                  </button>
                </div>
              ))}
              {/* "+ Add Track" Button at end of all tracks */}
              <button
                onClick={() => setShowAddTrackMenu(true)}
                className="flex h-8 w-full items-center justify-center gap-1 border-t border-white/10 bg-white/5 text-[10px] font-semibold text-amber-400 hover:bg-white/10 active:bg-amber-500 active:text-black transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Left Padding Spacer: exactly (50vw - 48px) so that 0.00s sits precisely under the 50% playhead */}
            <div className="shrink-0" style={{ width: 'calc(50vw - 48px)' }} onPointerDown={handleBlankPointerDown} />

              <div 
                ref={tracksRef} 
                className="relative shrink-0 min-h-full" 
                style={{ width: contentWidth }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) handleBlankPointerDown(e);
                }}
              >
                {/* Alignment magnetic snap guide */}
                {snapLineX !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-50 w-px bg-cyan-400 pointer-events-none shadow-[0_0_8px_cyan]"
                    style={{ left: snapLineX }}
                  />
                )}

            {/* Ruler (Visual timecode display only - tapping does not scrub) */}
            <div
              className="relative border-b border-white/10 bg-[#16161a] pointer-events-none select-none"
              style={{ height: RULER_H }}
            >
              {rulerTicks.map((tick) => (
                <div key={tick.time} className="absolute bottom-0" style={{ left: tick.time * zoomLevel }}>
                  <div className="h-2 w-px bg-white/25" />
                  <span className="absolute bottom-0.5 left-1 text-[8px] leading-none text-white/40">
                    {tick.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => {
              const h = trackHeight(track);
              return (
                <div
                  key={track.id}
                  className={`relative border-b border-white/5 ${track.locked ? 'opacity-70' : ''}`}
                  style={{ height: h }}
                  onPointerDown={(e) => handleBlankPointerDown(e, track.id)}
                  onPointerUp={handleBlankPointerUp}
                >
                  {track.clips.map((clip) => {
                    const dc = displayClip(clip);
                    const media = mediaMap.get(clip.mediaId);
                    const isSelected = selectedClipId === clip.id;
                    const left = dc.startTime * zoomLevel;
                    const width = Math.max(MIN_CLIP_W, dc.duration * zoomLevel);
                    const isVideo = media?.type === 'video' || (!clip.textSettings && !clip.fxSettings && media?.type !== 'audio');
                    const hasAudio = media?.type === 'audio' || isVideo;

                    return (
                      <div
                        key={clip.id}
                        className="mobile-clip absolute top-1 bottom-1 overflow-hidden rounded-md border"
                        style={{
                          left,
                          width,
                          background: clipColor(media, clip),
                          borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.25)',
                          boxShadow: isSelected ? '0 0 0 1px #fbbf24' : undefined,
                          touchAction: 'none',
                        }}
                        onPointerDown={(e) => onPointerDownClip(e, clip)}
                      >
                        {/* Video Frame Strip rendering */}
                        {isVideo && media && width > 40 && (
                          <div className="absolute inset-0 opacity-60 pointer-events-none">
                            <FrameStripOverlay media={media} clip={dc} width={width} height={h - 8} />
                          </div>
                        )}

                        {/* Audio Waveform rendering */}
                        {hasAudio && media && width > 30 && (
                          <div className="absolute inset-0 opacity-70 pointer-events-none">
                            <WaveformOverlay
                              media={media}
                              clipId={clip.id}
                              width={width}
                              height={h - 8}
                              trimStart={dc.trimStart}
                              clipDuration={dc.duration}
                              speed={dc.speed}
                              small={isVideo}
                            />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none" />
                        <span className="absolute left-1 top-0.5 truncate text-[9px] font-semibold leading-tight text-white drop-shadow z-10">
                          {clip.textSettings?.text || media?.name || 'Clip'}
                        </span>
                        <span className="absolute bottom-0.5 left-1 text-[8px] leading-none text-white/80 z-10 font-mono">
                          {formatCentisecondTime(dc.duration)}
                        </span>

                        {/* Trim handles on selected clip */}
                        {isSelected && (
                          <>
                            <div
                              className="absolute inset-y-0 left-0 z-20 flex w-[14px] items-center justify-center bg-white shadow-md cursor-ew-resize"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => onPointerDownTrim(e, clip, 'start')}
                            >
                              <div className="h-4 w-1 rounded-full bg-black/50" />
                            </div>
                            <div
                              className="absolute inset-y-0 right-0 z-20 flex w-[14px] items-center justify-center bg-white shadow-md cursor-ew-resize"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => onPointerDownTrim(e, clip, 'end')}
                            >
                              <div className="h-4 w-1 rounded-full bg-black/50" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Transitions Layer */}
                  {(() => {
                    const sortedClips = [...(track.clips || [])].sort((a, b) => a.startTime - b.startTime);
                    return sortedClips.map((clip, idx) => {
                      if (idx === 0) return null;
                      const prevClip = sortedClips[idx - 1];
                      const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
                      const isAdjacent = gap > -0.06 && gap < 0.06;
                      const trans = clip.transitionIn || prevClip.transitionOut;
                      const activeClipId = clip.transitionIn ? clip.id : prevClip.id;
                      const hasTransition = !!trans;

                      if (!isAdjacent && !hasTransition) return null;
                      
                      // Hide transition targets if either adjacent clip is selected to allow easier trimming
                      if (selectedClipId === clip.id || selectedClipId === prevClip.id) return null;

                      const intersectionTime = clip.startTime;
                      const centerPos = intersectionTime * zoomLevel;
                      const transDuration = trans?.duration || 0.5;
                      const transWidth = Math.max(24, Math.min(60, transDuration * zoomLevel));
                      const isTransSelected = selectedTransitionClipId === activeClipId;

                      if (hasTransition) {
                        return (
                          <div
                            key={`trans-${prevClip.id}-${clip.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTransition(activeClipId);
                            }}
                            className={`absolute top-1.5 bottom-1.5 z-30 flex items-center justify-center rounded-md border text-[9px] font-bold text-white shadow-lg cursor-pointer transition-transform active:scale-95 ${
                              isTransSelected
                                ? 'bg-purple-600 border-white ring-2 ring-purple-400'
                                : 'bg-gradient-to-r from-purple-700 to-indigo-700 border-purple-300/80 hover:brightness-110'
                            }`}
                            style={{
                              left: `${centerPos - transWidth / 2}px`,
                              width: `${transWidth}px`,
                            }}
                            title={`Transition: ${trans.name}`}
                          >
                            <Sparkles className="h-3 w-3 text-purple-200" />
                          </div>
                        );
                      }

                      // Adjacent clips without transition
                      return (
                        <div
                          key={`trans-slot-${prevClip.id}-${clip.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTransition(clip.id);
                            if (onOpenTransitions) onOpenTransitions();
                          }}
                          className="absolute top-2.5 bottom-2.5 z-20 flex w-4 -ml-2 items-center justify-center rounded-full bg-white/20 hover:bg-purple-500 text-white/80 hover:text-white border border-white/30 backdrop-blur-sm cursor-pointer transition-all active:scale-110"
                          style={{ left: `${centerPos}px` }}
                          title="Add transition between clips"
                        >
                          <span className="text-[10px] font-black leading-none">+</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              );
            })}

              </div>
              
              {/* Right Padding Spacer */}
              <div className="shrink-0" style={{ width: '50vw' }} onPointerDown={handleBlankPointerDown} />
            </div>
          </div>
      </div>

      {/* Floating Track Options Menu */}
      {selectedTrackForOptions && (
        <div className="absolute bottom-12 left-14 z-50 flex flex-col gap-1 rounded-xl border border-white/15 bg-[#1e1e24] p-2 shadow-2xl backdrop-blur-xl">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
            {selectedTrackForOptions.name || selectedTrackForOptions.type} Track
          </p>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-white">
            <button
              onClick={() => moveTrack(selectedTrackForOptions.id, 'up')}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 text-left"
            >
              <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>Move Up</span>
            </button>
            <button
              onClick={() => moveTrack(selectedTrackForOptions.id, 'down')}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 text-left"
            >
              <ArrowDown className="h-3.5 w-3.5 text-cyan-400" />
              <span>Move Down</span>
            </button>
            <button
              onClick={() => {
                toggleTrackHidden(selectedTrackForOptions.id);
                setSelectedTrackForOptions(null);
                toast.success(selectedTrackForOptions.hidden ? 'Track visible' : 'Track hidden');
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 text-left"
            >
              {selectedTrackForOptions.hidden ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-blue-400" />
                  <span>Show Track</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Hide Track</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                toggleTrackMute(selectedTrackForOptions.id);
                setSelectedTrackForOptions(null);
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 text-left"
            >
              {selectedTrackForOptions.muted ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                  <span>Mute</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                toggleTrackLock(selectedTrackForOptions.id);
                setSelectedTrackForOptions(null);
              }}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 text-left"
            >
              {selectedTrackForOptions.locked ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Unlock Track</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Lock Track</span>
                </>
              )}
            </button>
          </div>
          <button
            onClick={() => {
              removeTrack(selectedTrackForOptions.id);
              setSelectedTrackForOptions(null);
              toast.success('Track removed');
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30 text-left mt-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Track</span>
          </button>
        </div>
      )}

      {/* Floating Add Track Type Popover */}
      {showAddTrackMenu && (
        <div className="absolute bottom-12 left-14 z-50 flex flex-col gap-1 rounded-xl border border-white/15 bg-[#1e1e24] p-2 shadow-2xl backdrop-blur-xl">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Select Track Type</p>
          <div className="flex flex-col gap-1 text-[11px] text-white">
            <button
              onClick={() => { addTrack('video'); setShowAddTrackMenu(false); toast.success('Added Video Track'); }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
            >
              <Video className="h-3.5 w-3.5 text-blue-400" />
              <span>Video Track</span>
            </button>
            <button
              onClick={() => { addTrack('audio'); setShowAddTrackMenu(false); toast.success('Added Audio Track'); }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
            >
              <Music className="h-3.5 w-3.5 text-emerald-400" />
              <span>Audio Track</span>
            </button>
            <button
              onClick={() => { addTrack('text'); setShowAddTrackMenu(false); toast.success('Added Text Track'); }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
            >
              <Type className="h-3.5 w-3.5 text-purple-400" />
              <span>Text Track</span>
            </button>
            <button
              onClick={() => { addTrack('fx'); setShowAddTrackMenu(false); toast.success('Added FX Track'); }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
            >
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
              <span>FX / Effect Track</span>
            </button>
            <button
              onClick={() => { addTrack('adjustment'); setShowAddTrackMenu(false); toast.success('Added Adjustment Track'); }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
            >
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span>Adjustment Layer Track</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Timeline Toolbar Copy Menu */}
      {showTimelineCopyMenu && (
        <div className="absolute top-9 left-16 z-50 flex flex-col gap-1 rounded-xl border border-white/15 bg-[#1e1e24] p-1.5 shadow-2xl backdrop-blur-xl">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Copy Options</p>
          <button
            onClick={() => { copyClip('whole'); setShowTimelineCopyMenu(false); toast.success('Copied Whole Clip'); }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Copy className="h-3.5 w-3.5 text-amber-400" />
            <span>Copy Whole Clip</span>
          </button>
          <button
            onClick={() => { copyClip('clip'); setShowTimelineCopyMenu(false); toast.success('Copied Base'); }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Copy className="h-3.5 w-3.5 text-blue-400" />
            <span>Copy Base (Timing & Core)</span>
          </button>
          <button
            onClick={() => { copyClip('style'); setShowTimelineCopyMenu(false); toast.success('Copied Style'); }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Copy Style (Color/FX)</span>
          </button>
          {isText && (
            <>
              <button
                onClick={() => { copyClip('style-with-position'); setShowTimelineCopyMenu(false); toast.success('Copied Style + Position'); }}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
              >
                <Type className="h-3.5 w-3.5 text-teal-400" />
                <span>Text Style + Position</span>
              </button>
              <button
                onClick={() => { copyClip('style-only'); setShowTimelineCopyMenu(false); toast.success('Copied Font Style'); }}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
              >
                <Type className="h-3.5 w-3.5 text-pink-400" />
                <span>Only Font / Typography</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Floating Timeline Toolbar Paste Menu */}
      {showTimelinePasteMenu && (
        <div className="absolute top-9 left-28 z-50 flex flex-col gap-1 rounded-xl border border-white/15 bg-[#1e1e24] p-1.5 shadow-2xl backdrop-blur-xl">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Paste Options</p>
          <button
            onClick={() => { pasteClip('whole'); setShowTimelinePasteMenu(false); toast.success('Pasted Whole Clip'); }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-amber-400" />
            <span>Paste Whole</span>
          </button>
          <button
            onClick={() => { pasteClip('clip'); setShowTimelinePasteMenu(false); toast.success('Pasted Base'); }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-blue-400" />
            <span>Paste Base</span>
          </button>
          <button
            onClick={() => { pasteClip('style'); setShowTimelinePasteMenu(false); toast.success('Pasted Style'); }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white hover:bg-white/10 active:bg-amber-500 active:text-black text-left"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Paste Style</span>
          </button>
        </div>
      )}

      {/* Long-tap "Paste Here" Popover */}
      {blankPastePos && clipboardData?.clips?.length > 0 && (
        <div className="absolute bottom-12 left-24 z-50 rounded-xl border border-white/15 bg-[#1e1e24] p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => {
              pasteClip('whole');
              setBlankPastePos(null);
              toast.success('Pasted here');
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10 active:bg-amber-500 active:text-black"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-amber-400" />
            <span>Paste Clip Here</span>
          </button>
        </div>
      )}
    </div>
  );
}
