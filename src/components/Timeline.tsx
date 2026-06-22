import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Music,
  Film,
  GripVertical,
  Image,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { formatSimpleTime } from '@/utils/time';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 56;
const MIN_CLIP_WIDTH = 16;
const SNAP_THRESHOLD_PX = 8;
const TRACK_HEADER_WIDTH = 128;
const RULER_HEIGHT = 28;
const FPS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCentisecondTime(time: number): string {
  if (isNaN(time) || time < 0) time = 0;
  const totalCentis = Math.round(time * 100);
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;

  const secsStr = mins > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  const centisStr = centis.toString().padStart(2, '0');

  if (mins > 0) {
    return `${mins}:${secsStr}:${centisStr}`;
  }
  return `${secsStr}:${centisStr}`;
}

function formatDetailedTooltipTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const secsStr = mins > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  const msStr = ms.toString().padStart(3, '0');

  if (mins > 0) {
    return `${mins}:${secsStr}.${msStr}`;
  }
  return `${secsStr}.${msStr}s`;
}


function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/** Seeded PRNG for deterministic procedural content keyed by string. */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 16807 + 0) % 2147483647;
    return (hash % 10001) / 10001;
  };
}

/** Fallback waveform when no real peaks are available. */
function generateFallbackWaveform(clipId: string, barCount: number): number[] {
  const peaks: number[] = [];
  const rng = seededRandom(clipId);
  for (let i = 0; i < barCount; i++) {
    peaks.push(0.2 + rng() * 0.8);
  }
  return peaks;
}

/** Check overlap on a track, optionally excluding one clip. */
function checkOverlapAt(
  track: TimelineTrack,
  startTime: number,
  duration: number,
  excludeClipId: string,
): boolean {
  const endTime = startTime + duration;
  return track.clips.some((clip) => {
    if (clip.id === excludeClipId) return false;
    const clipEnd = clip.startTime + clip.duration;
    return startTime < clipEnd && endTime > clip.startTime;
  });
}

/** Clip‑type colour palette. */
const CLIP_COLORS: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  video: { bg: 'bg-blue-600/70', border: 'border-blue-500/50', text: 'text-blue-100', hover: 'hover:border-blue-400' },
  audio: { bg: 'bg-emerald-600/70', border: 'border-emerald-500/50', text: 'text-emerald-100', hover: 'hover:border-emerald-400' },
  image: { bg: 'bg-amber-600/70', border: 'border-amber-500/50', text: 'text-amber-100', hover: 'hover:border-amber-400' },
};

// ─── Sub‑components ──────────────────────────────────────────────────────────

/**
 * Renders real frame‑strip thumbnails stretched across the clip width.
 * Falls back to coloured procedural blocks when no frameStrip is available.
 */
function FrameStripOverlay({
  media,
  clipId,
  width,
  height,
}: {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
}) {
  const frameStrip = media?.frameStrip;

  if (frameStrip && frameStrip.length > 0) {
    // Real frame thumbnails – stretch evenly across clip
    const frameWidth = width / frameStrip.length;
    return (
      <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
        {frameStrip.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className="h-full object-cover shrink-0 border-r border-white/5"
            style={{ width: `${frameWidth}px` }}
          />
        ))}
      </div>
    );
  }

  // Procedural fallback
  const count = Math.max(Math.floor(width / 28), 2);
  const rng = seededRandom(clipId + '_frames');
  const blocks: number[] = [];
  for (let i = 0; i < count; i++) blocks.push(rng());
  const blockW = width / count;

  return (
    <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
      {blocks.map((intensity, i) => (
        <div
          key={i}
          className="h-full border-r border-white/5"
          style={{
            width: `${blockW}px`,
            backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.3})`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Renders audio waveform bars from real peaks or fallback data.
 * @param small – If true renders a compact waveform row (for audio beneath video).
 */
function WaveformOverlay({
  media,
  clipId,
  width,
  height,
  small,
}: {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
  small?: boolean;
}) {
  const barSpacing = small ? 2 : 3;
  const barCount = Math.max(Math.floor(width / barSpacing), 4);

  let peaks: number[];
  if (media?.waveformPeaks && media.waveformPeaks.length > 0) {
    // Resample real peaks to fit bar count
    const src = media.waveformPeaks;
    peaks = [];
    for (let i = 0; i < barCount; i++) {
      const srcIdx = (i / barCount) * src.length;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, src.length - 1);
      const frac = srcIdx - lo;
      peaks.push(src[lo] * (1 - frac) + src[hi] * frac);
    }
  } else {
    peaks = generateFallbackWaveform(clipId, barCount);
  }

  const barColor = small ? 'bg-emerald-300/50' : 'bg-white/40';

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex items-end px-0.5 pointer-events-none gap-px"
      style={{ height: `${height}px` }}
    >
      {peaks.map((peak, i) => (
        <div
          key={i}
          className={`flex-1 ${barColor} rounded-sm`}
          style={{
            height: `${Math.max(4, peak * 100)}%`,
            minHeight: '2px',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Timeline() {
  const {
    tracks,
    currentTime,
    zoomLevel,
    scrollLeft,
    selectedClipId,
    selectedClipIds,
    activeTool,
    selectedTrackId,
    draggingClipId,
    totalDuration,
    selectClip,
    selectClips,
    selectTrack,
    seek,
    splitClip,
    moveClip,
    moveClips,
    zoomIn,
    zoomOut,
    toggleTrackLock,
    toggleTrackMute,
    addTrack,
    removeTrack,
    updateClip,
    setDragPreview,
  } = useEditorStore();

  // ── Refs & local state ──────────────────────────────────────────────────

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    trackId: string;
    trackType: string;
    draggedClips?: {
      id: string;
      originalStartTime: number;
      trackId: string;
    }[];
  } | null>(null);

  const [resizeState, setResizeState] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    startX: number;
    originalDuration: number;
    originalTrimStart: number;
    originalTrimEnd: number;
    originalStartTime: number;
    siblingClip?: {
      id: string;
      originalTrimStart: number;
      originalTrimEnd: number;
      originalDuration: number;
      originalStartTime: number;
      speed: number;
    };
    rippleClips?: {
      id: string;
      originalStartTime: number;
    }[];
  } | null>(null);

  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    left: number;
    width: number;
    trackIdx: number;
  } | null>(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [scrubMouseX, setScrubMouseX] = useState<number>(0);

  const [hoverCutClipId, setHoverCutClipId] = useState<string | null>(null);
  const [hoverCutX, setHoverCutX] = useState<number | null>(null);

  // ── Scroll sync ─────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    if (trackContainerRef.current) {
      useEditorStore.getState().setScrollLeft(trackContainerRef.current.scrollLeft);
    }
  }, []);

  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // ── Media lookup ────────────────────────────────────────────────────────

  const getMedia = useCallback((clip: TimelineClip): MediaItem | null => {
    return useEditorStore.getState().mediaLibrary.find((m) => m.id === clip.mediaId) ?? null;
  }, []);

  const getMediaSafe = useCallback(
    (clip: TimelineClip) => {
      return getMedia(clip) ?? ({ name: 'Unknown', type: 'video' as const, duration: 30, url: '' } as MediaItem);
    },
    [getMedia],
  );

  // ── Track from mouse Y ─────────────────────────────────────────────────

  const getTrackFromMouseY = useCallback(
    (clientY: number): TimelineTrack | null => {
      const container = trackContainerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const relY = clientY - rect.top + container.scrollTop;
      const idx = Math.floor(relY / TRACK_HEIGHT);
      return idx >= 0 && idx < tracks.length ? tracks[idx] : null;
    },
    [tracks],
  );

  // ── Snap helper (clip edges + playhead) ─────────────────────────────────

  const computeSnap = useCallback(
    (rawTime: number, movingClipId: string, movingDuration: number) => {
      const threshold = SNAP_THRESHOLD_PX / zoomLevel;

      // Collect snap targets: all other clip edges + the playhead
      const targets: number[] = [currentTime]; // ★ snap to playhead
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (clip.id === movingClipId) continue;
          targets.push(clip.startTime);
          targets.push(clip.startTime + clip.duration);
        }
      }

      // Test both the leading and trailing edges of the moving clip
      const edges = [rawTime, rawTime + movingDuration];

      let bestDelta = Infinity;
      let snappedTime = rawTime;
      let snapPos: number | null = null;

      for (const edge of edges) {
        for (const target of targets) {
          const delta = Math.abs(edge - target);
          if (delta < threshold && delta < bestDelta) {
            bestDelta = delta;
            // Offset so that the appropriate edge aligns with the target
            snappedTime = rawTime + (target - edge);
            snapPos = target * zoomLevel;
          }
        }
      }

      return { snappedTime: Math.max(0, snappedTime), snapPos };
    },
    [zoomLevel, currentTime, tracks],
  );

  // ── Timeline / ruler click (scrub) ──────────────────────────────────────

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'split') return;
      const rect = trackContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scroll = trackContainerRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scroll;
      seek(Math.max(0, x / zoomLevel));
    },
    [activeTool, zoomLevel, seek],
  );

  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsScrubbing(true);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const time = Math.max(0, x / zoomLevel);
      
      setScrubTime(time);
      setScrubMouseX(e.clientX);
      seek(time);

      e.preventDefault();
      e.stopPropagation();
    },
    [scrollLeft, zoomLevel, seek],
  );

  // ── Split helper ────────────────────────────────────────────────────────

  const handleSplit = useCallback(
    (clipId: string) => {
      splitClip(clipId, currentTime);
    },
    [splitClip, currentTime],
  );

  // ── Clip drag / resize mousedown ────────────────────────────────────────

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      if (e.button !== 0) return;
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = e.clientX - rect.left;

      let rippleClips: { id: string; originalStartTime: number }[] = [];
      if (activeTool === 'ripple' && track) {
        rippleClips = track.clips
          .filter((c) => c.id !== clip.id && c.startTime >= clip.startTime)
          .map((c) => ({ id: c.id, originalStartTime: c.startTime }));
      }

      // Left resize handle
      if (relX < 6) {
        let sibling: any = undefined;
        if (clip.splitGroupId) {
          const track = tracks.find((t) => t.id === clip.trackId);
          if (track) {
            const siblingClips = track.clips
              .filter((c) => c.id !== clip.id && c.splitGroupId === clip.splitGroupId)
              .sort((a, b) => a.trimStart - b.trimStart);
            const prev = siblingClips.reverse().find((c) => c.trimStart + c.duration <= clip.trimStart + 0.001);
            if (prev) {
              sibling = {
                id: prev.id,
                originalTrimStart: prev.trimStart,
                originalTrimEnd: prev.trimEnd,
                originalDuration: prev.duration,
                originalStartTime: prev.startTime,
                speed: prev.speed,
              };
            }
          }
        }

        setResizeState({
          clipId: clip.id,
          edge: 'left',
          startX: e.clientX,
          originalDuration: clip.duration,
          originalTrimStart: clip.trimStart,
          originalTrimEnd: clip.trimEnd,
          originalStartTime: clip.startTime,
          siblingClip: sibling,
          rippleClips,
        });
        e.stopPropagation();
        return;
      }

      // Right resize handle
      if (relX > rect.width - 6) {
        let sibling: any = undefined;
        if (clip.splitGroupId) {
          const track = tracks.find((t) => t.id === clip.trackId);
          if (track) {
            const siblingClips = track.clips
              .filter((c) => c.id !== clip.id && c.splitGroupId === clip.splitGroupId)
              .sort((a, b) => a.trimStart - b.trimStart);
            const next = siblingClips.find((c) => c.trimStart >= clip.trimStart + clip.duration - 0.001);
            if (next) {
              sibling = {
                id: next.id,
                originalTrimStart: next.trimStart,
                originalTrimEnd: next.trimEnd,
                originalDuration: next.duration,
                originalStartTime: next.startTime,
                speed: next.speed,
              };
            }
          }
        }

        setResizeState({
          clipId: clip.id,
          edge: 'right',
          startX: e.clientX,
          originalDuration: clip.duration,
          originalTrimStart: clip.trimStart,
          originalTrimEnd: clip.trimEnd,
          originalStartTime: clip.startTime,
          siblingClip: sibling,
          rippleClips,
        });
        e.stopPropagation();
        return;
      }

      // Track Select Forward Tool
      if (activeTool === 'trackSelect') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime >= clickTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime >= clickTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });

        setDragState({
          clipId: clip.id,
          startX: e.clientX,
          startY: e.clientY,
          originalStartTime: clip.startTime,
          trackId: clip.trackId,
          trackType: track?.type || 'video',
          draggedClips,
        });

        e.stopPropagation();
        return;
      }

      // Track Select Backward Tool
      if (activeTool === 'trackSelectBackward') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime <= clickTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime <= clickTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });

        setDragState({
          clipId: clip.id,
          startX: e.clientX,
          startY: e.clientY,
          originalStartTime: clip.startTime,
          trackId: clip.trackId,
          trackType: track?.type || 'video',
          draggedClips,
        });

        e.stopPropagation();
        return;
      }

      // Split tool
      if (activeTool === 'split') {
        const clickTime = clip.startTime + relX / zoomLevel;
        splitClip(clip.id, clickTime);
        return;
      }

      // Normal drag (Select tool or default)
      let currentSelectedIds = selectedClipIds;
      if (e.ctrlKey || e.metaKey) {
        const isAlreadySel = selectedClipIds.includes(clip.id);
        currentSelectedIds = isAlreadySel
          ? selectedClipIds.filter((id) => id !== clip.id)
          : [...selectedClipIds, clip.id];
        selectClips(currentSelectedIds);
      } else {
        const isAlreadySelected = selectedClipIds.includes(clip.id);
        if (!isAlreadySelected) {
          selectClip(clip.id);
          currentSelectedIds = [clip.id];
        }
      }

      // Populate draggedClips from the final list of selected IDs (only if clicked clip is selected)
      let draggedClips: { id: string; originalStartTime: number; trackId: string }[] = [];
      if (currentSelectedIds.includes(clip.id)) {
        draggedClips = currentSelectedIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });
      }

      setDragState({
        clipId: clip.id,
        startX: e.clientX,
        startY: e.clientY,
        originalStartTime: clip.startTime,
        trackId: clip.trackId,
        trackType: track?.type || 'video',
        draggedClips,
      });

      e.stopPropagation();
    },
    [tracks, activeTool, splitClip, zoomLevel, selectClip, selectClips, selectedClipIds],
  );

  // ── Global mouse move / up for drag & resize ───────────────────────────

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // ─ Playhead scrubbing ──────────────────────────────────────────
      if (isScrubbing) {
        const rect = trackContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left + scrollLeft;
          const time = Math.max(0, x / zoomLevel);
          seek(time);
          setScrubTime(time);
          setScrubMouseX(e.clientX);
        }
      }

      // ─ Clip drag ────────────────────────────────────────────────────
      if (dragState && dragState.draggedClips && dragState.draggedClips.length > 0) {
        const dx = e.clientX - dragState.startX;
        const dt = dx / zoomLevel;
        let newTime = Math.max(0, dragState.originalStartTime + dt);

        // Determine which track the cursor is hovering over
        const hoverTrack = getTrackFromMouseY(e.clientY);
        const targetTrackId =
          hoverTrack && hoverTrack.type === dragState.trackType ? hoverTrack.id : dragState.trackId;

        // Find the clip to get its duration for snap calculations
        const movingClip = tracks.flatMap((t) => t.clips).find((c) => c.id === dragState.clipId);
        const movingDuration = movingClip?.duration ?? 0;

        // Snap
        const { snappedTime, snapPos } = computeSnap(newTime, dragState.clipId, movingDuration);
        newTime = snappedTime;
        setSnapLine(snapPos);

        // Calculate final displacement of primary clip
        const finalDt = newTime - dragState.originalStartTime;

        if (dragState.draggedClips.length > 1) {
          // Clear single-clip drag preview
          setDragPreview(0, null);

          // Calculate track index delta
          const sourceTrackIdx = tracks.findIndex((t) => t.id === dragState.trackId);
          const targetTrackIdx = tracks.findIndex((t) => t.id === targetTrackId);
          const trackDelta = targetTrackIdx - sourceTrackIdx;

          // Prepare updates for all dragged clips
          const updates = dragState.draggedClips.map((c) => {
            const clipNewTime = Math.max(0, c.originalStartTime + finalDt);
            
            // Find target track relative to this clip's original track
            const clipTrackIdx = tracks.findIndex((t) => t.id === c.trackId);
            const newTrackIdx = clipTrackIdx + trackDelta;
            const originalTrack = tracks.find((t) => t.id === c.trackId);
            const targetTrack = tracks[newTrackIdx];

            // Only switch track if it's a valid track of the same type (video/audio)
            const targetTrackIdForClip =
              targetTrack && originalTrack && targetTrack.type === originalTrack.type
                ? targetTrack.id
                : c.trackId;

            return {
              clipId: c.id,
              newStartTime: clipNewTime,
              newTrackId: targetTrackIdForClip,
            };
          });

          // Call moveClips in a single transaction
          moveClips(updates);
        } else if (dragState.draggedClips.length === 1) {
          // Single clip drag (allows track switching)
          setDragPreview(newTime, targetTrackId);
          moveClip(dragState.clipId, newTime, targetTrackId);
        }
      }

      // ─ Clip resize ──────────────────────────────────────────────────
      if (resizeState) {
        const dx = e.clientX - resizeState.startX;
        const dt = dx / zoomLevel;
        const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === resizeState.clipId);
        if (!clip) return;

        const media = getMediaSafe(clip);
        const sourceDuration = media.duration || 30;

        if (activeTool === 'ripple') {
          if (resizeState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
            const maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
            const clamped = Math.min(newDuration, maxDuration);
            const delta = clamped - resizeState.originalDuration;

            const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
            updateClip(resizeState.clipId, {
              duration: clamped,
              trimEnd: Math.max(0, newTrimEnd),
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + delta,
                });
              });
            }
          } else {
            const shrink = -dt;
            const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
            const maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
            let clamped = Math.min(newDuration, maxDuration);
            let shift = resizeState.originalDuration - clamped;
            shift = Math.max(-resizeState.originalStartTime, shift);
            clamped = resizeState.originalDuration - shift;

            updateClip(resizeState.clipId, {
              startTime: resizeState.originalStartTime + shift,
              duration: clamped,
              trimStart: Math.max(0, resizeState.originalTrimStart + shift * clip.speed),
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + shift,
                });
              });
            }
          }
          return;
        }

        if (resizeState.edge === 'right') {
          let newDuration = Math.max(0.1, resizeState.originalDuration + dt);
          const maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
          let clamped = Math.min(newDuration, maxDuration);

          if (resizeState.siblingClip) {
            const sib = resizeState.siblingClip;
            const newAEnd = clip.trimStart + clamped * clip.speed;
            if (newAEnd > sib.originalTrimStart) {
              let deltaSource = newAEnd - sib.originalTrimStart;
              let delta = deltaSource / sib.speed;
              
              // Clamp so sibling duration doesn't shrink below 0.1s
              const maxDelta = sib.originalDuration - 0.1;
              if (delta > maxDelta) {
                delta = Math.max(0, maxDelta);
                deltaSource = delta * sib.speed;
                clamped = (sib.originalTrimStart + deltaSource - clip.trimStart) / clip.speed;
              }

              // Update sibling boundary in tandem
              updateClip(sib.id, {
                trimStart: sib.originalTrimStart + deltaSource,
                duration: sib.originalDuration - delta,
                startTime: sib.originalStartTime + delta,
              });
            } else {
              // Restore sibling state if user dragged back
              updateClip(sib.id, {
                trimStart: sib.originalTrimStart,
                duration: sib.originalDuration,
                startTime: sib.originalStartTime,
              });
            }
          }

          const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
          updateClip(resizeState.clipId, {
            duration: clamped,
            trimEnd: Math.max(0, newTrimEnd),
          });
        } else {
          const shrink = -dt;
          const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
          const maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
          let clamped = Math.min(newDuration, maxDuration);
          let shift = resizeState.originalDuration - clamped;

          if (resizeState.siblingClip) {
            const sib = resizeState.siblingClip;
            const newBStart = resizeState.originalTrimStart + shift * clip.speed;
            if (newBStart < sib.originalTrimStart + sib.originalDuration * sib.speed) {
              let deltaSource = (sib.originalTrimStart + sib.originalDuration * sib.speed) - newBStart;
              let delta = deltaSource / sib.speed;
              
              // Clamp so sibling duration doesn't shrink below 0.1s
              const maxDelta = sib.originalDuration - 0.1;
              if (delta > maxDelta) {
                delta = Math.max(0, maxDelta);
                deltaSource = delta * sib.speed;
                const allowedNewBStart = sib.originalTrimStart + sib.originalDuration * sib.speed - deltaSource;
                shift = (allowedNewBStart - resizeState.originalTrimStart) / clip.speed;
                clamped = resizeState.originalDuration - shift;
              }

              // Update sibling boundary in tandem
              updateClip(sib.id, {
                trimEnd: sib.originalTrimEnd + deltaSource,
                duration: sib.originalDuration - delta,
              });
            } else {
              // Restore sibling state if user dragged back
              updateClip(sib.id, {
                trimEnd: sib.originalTrimEnd,
                duration: sib.originalDuration,
              });
            }
          }

          updateClip(resizeState.clipId, {
            startTime: resizeState.originalStartTime + shift,
            duration: clamped,
            trimStart: Math.max(0, resizeState.originalTrimStart + shift * clip.speed),
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
        setScrubTime(null);
      }
      if (dragState) {
        setDragState(null);
        setSnapLine(null);
        setDragPreview(0, null);
        useEditorStore.getState().saveSnapshot();
      }
      if (resizeState) {
        setResizeState(null);
        useEditorStore.getState().saveSnapshot();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState,
    resizeState,
    isScrubbing,
    scrollLeft,
    seek,
    zoomLevel,
    tracks,
    moveClip,
    moveClips,
    updateClip,
    setDragPreview,
    computeSnap,
    getTrackFromMouseY,
    getMediaSafe,
    activeTool,
  ]);

  // ── Drop from media panel ───────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      const mediaId = e.dataTransfer.getData('application/procut-media');
      if (!mediaId) return;

      const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === mediaId);
      if (!media) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + (trackContainerRef.current?.scrollLeft || 0);
      const startTime = Math.max(0, x / zoomLevel);

      const newClip: TimelineClip = {
        id: generateId(),
        mediaId,
        trackId,
        startTime,
        duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: [],
      };

      useEditorStore.getState().addClip(newClip);
      setHoveredTrackId(null);
      setDropPreview(null);
    },
    [zoomLevel],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + (trackContainerRef.current?.scrollLeft || 0);
      const trackIdx = tracks.findIndex((t) => t.id === trackId);

      // Read media to determine width
      const mediaId = e.dataTransfer.types.includes('application/procut-media') ? 'pending' : null;
      if (mediaId && trackIdx >= 0) {
        const approxWidth = 5 * zoomLevel; // estimate; real width computed on drop
        setDropPreview({ left: x, width: approxWidth, trackIdx });
        setHoveredTrackId(trackId);
      }
    },
    [tracks, zoomLevel],
  );

  // ── Ruler markers ───────────────────────────────────────────────────────

  const rulerData = useMemo(() => {
    const markers: { time: number; label: string; type: 'major' | 'medium' | 'minor' }[] = [];

    let majorInterval = 1.0;
    let mediumInterval = 0.5;
    let minorInterval = 0.1;
    let labelMedium = true;

    if (zoomLevel >= 250) {
      majorInterval = 0.5;
      mediumInterval = 0.1;
      minorInterval = 0.02;
      labelMedium = true;
    } else if (zoomLevel >= 150) {
      majorInterval = 1.0;
      mediumInterval = 0.5;
      minorInterval = 0.1;
      labelMedium = true;
    } else if (zoomLevel >= 80) {
      majorInterval = 2.0;
      mediumInterval = 1.0;
      minorInterval = 0.2;
      labelMedium = true;
    } else if (zoomLevel >= 40) {
      majorInterval = 5.0;
      mediumInterval = 2.5;
      minorInterval = 0.5;
      labelMedium = true;
    } else if (zoomLevel >= 20) {
      majorInterval = 10.0;
      mediumInterval = 5.0;
      minorInterval = 1.0;
      labelMedium = false;
    } else {
      majorInterval = 30.0;
      mediumInterval = 10.0;
      minorInterval = 2.0;
      labelMedium = false;
    }

    const maxTime = totalDuration + 30;

    const minorCentis = Math.round(minorInterval * 100);
    const mediumCentis = Math.round(mediumInterval * 100);
    const majorCentis = Math.round(majorInterval * 100);
    const maxCentis = Math.round(maxTime * 100);

    for (let c = 0; c <= maxCentis; c += minorCentis) {
      const time = c / 100;
      let type: 'major' | 'medium' | 'minor' = 'minor';
      let label = '';

      if (c % majorCentis === 0) {
        type = 'major';
        label = formatCentisecondTime(time);
      } else if (c % mediumCentis === 0) {
        type = 'medium';
        if (labelMedium) {
          label = formatCentisecondTime(time);
        }
      } else {
        type = 'minor';
      }

      markers.push({ time, label, type });
    }

    return markers;
  }, [zoomLevel, totalDuration]);

  // ── Total pixel width of the timeline ───────────────────────────────────

  const timelineWidth = (totalDuration + 30) * zoomLevel;

  // ════════════════════════════════════════════════════════════════════════
  // ── RENDER ──────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#3e3e3e]" ref={timelineRef}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="h-8 flex items-center px-2 bg-[#252525] border-b border-[#3e3e3e] shrink-0">
        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#a0a0a0] w-12 text-center tabular-nums">
            {zoomLevel}px/s
          </span>
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#3e3e3e] mx-2" />

        {/* Add tracks */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => addTrack('video')}
            className="px-2 py-0.5 text-[10px] text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            <Film className="w-3 h-3" /> + Video
          </button>
          <button
            onClick={() => addTrack('audio')}
            className="px-2 py-0.5 text-[10px] text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            <Music className="w-3 h-3" /> + Audio
          </button>
        </div>

        <div className="flex-1" />

        {/* Tool indicator */}
        {activeTool === 'split' && (
          <span className="text-[10px] text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded">
            Click a clip to split at playhead
          </span>
        )}
      </div>

      {/* ── Main body ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Track headers ──────────────────────────────────────────── */}
        <div
          className="bg-[#252525] border-r border-[#3e3e3e] flex flex-col overflow-hidden shrink-0"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
          {/* Ruler spacer */}
          <div className="bg-[#2d2d2d] border-b border-[#3e3e3e] shrink-0" style={{ height: RULER_HEIGHT }} />

          {/* Headers */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`flex items-center px-2 border-b border-[#3e3e3e] ${
                  selectedTrackId === track.id ? 'bg-[#3e3e3e]' : ''
                }`}
                style={{ height: TRACK_HEIGHT }}
                onClick={() => selectTrack(track.id)}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <GripVertical className="w-3 h-3 text-[#a0a0a0] shrink-0 cursor-grab" />
                  <span className="text-[11px] text-white font-medium truncate">{track.name}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrackLock(track.id);
                    }}
                    title={track.locked ? 'Unlock' : 'Lock'}
                    className={`p-0.5 rounded transition-colors ${
                      track.locked ? 'text-amber-400' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrackMute(track.id);
                    }}
                    title={track.muted ? 'Unmute' : 'Mute'}
                    className={`p-0.5 rounded transition-colors ${
                      track.muted ? 'text-red-400' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {track.muted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTrack(track.id);
                      }}
                      title="Remove track"
                      className="p-0.5 text-[#a0a0a0] hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Floating Scrub Tooltip */}
          {isScrubbing && (
            <div
              className="absolute z-50 bg-[#141414]/95 text-amber-400 text-[10px] font-bold px-2 py-1 rounded border border-[#3e3e3e] shadow-2xl pointer-events-none -translate-x-1/2 flex items-center gap-1.5"
              style={{
                left: `${currentTime * zoomLevel - scrollLeft}px`,
                top: `${RULER_HEIGHT + 6}px`,
              }}
            >
              {/* Tooltip caret */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#141414] border-t border-l border-[#3e3e3e] rotate-45" />
              <span className="relative z-10 tabular-nums">
                {formatDetailedTooltipTime(currentTime)}
              </span>
            </div>
          )}

          {/* ── Ruler ──────────────────────────────────────────────── */}
          <div
            className="bg-[#2d2d2d] border-b border-[#3e3e3e] relative overflow-hidden shrink-0 cursor-pointer select-none"
            style={{ height: RULER_HEIGHT }}
            onMouseDown={handleRulerMouseDown}
          >
            <div
              className="absolute top-0 left-0 h-full"
              style={{ width: `${timelineWidth}px`, transform: `translateX(-${scrollLeft}px)` }}
            >
              {rulerData.map((m, i) => {
                let tickHeight = '14px';
                let tickColor = 'bg-[#a0a0a0]';
                if (m.type === 'medium') {
                  tickHeight = '10.5px';
                  tickColor = 'bg-[#888888]';
                } else if (m.type === 'minor') {
                  tickHeight = '7px';
                  tickColor = 'bg-[#555555]';
                }

                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex flex-col items-start pointer-events-none"
                    style={{ left: `${m.time * zoomLevel}px` }}
                  >
                    <div
                      className={`w-px ${tickColor}`}
                      style={{ height: tickHeight }}
                    />
                    {m.label && (
                      <span className="text-[9px] text-[#a0a0a0] pl-0.5 mt-0.5 whitespace-nowrap tabular-nums">
                        {m.label}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Playhead on ruler */}
              <div
                className="absolute top-0 h-full z-10 pointer-events-none"
                style={{ left: `${currentTime * zoomLevel}px` }}
              >
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -translate-x-1/2" />
              </div>
            </div>
          </div>

          {/* ── Tracks container ───────────────────────────────────── */}
          <div
            ref={trackContainerRef}
            className="flex-1 overflow-auto relative"
            onClick={handleTimelineClick}
          >
            <div className="relative" style={{ width: `${timelineWidth}px`, minHeight: '100%' }}>
              {/* Grid lines aligned with ruler markers */}
              {rulerData
                .filter((m) => m.type === 'major')
                .map((m, i) => (
                  <div
                    key={`g-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-[#3e3e3e]/30 pointer-events-none"
                    style={{ left: `${m.time * zoomLevel}px` }}
                  />
                ))}

              {/* ── Tracks ─────────────────────────────────────────── */}
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={`relative border-b border-[#3e3e3e] transition-colors ${
                    hoveredTrackId === track.id ? 'bg-[#3e3e3e]/30' : ''
                  }`}
                  style={{ height: TRACK_HEIGHT }}
                  onDragOver={(e) => handleDragOver(e, track.id)}
                  onDrop={(e) => handleDrop(e, track.id)}
                  onDragEnter={() => setHoveredTrackId(track.id)}
                  onDragLeave={() => {
                    setHoveredTrackId(null);
                    setDropPreview(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectTrack(track.id);
                  }}
                >
                  {/* Faint track type label */}
                  <div className="absolute left-1 top-1 text-[8px] text-[#a0a0a0] opacity-30 uppercase select-none">
                    {track.type}
                  </div>

                  {/* ── Clips ──────────────────────────────────────── */}
                  {track.clips.map((clip) => {
                    const media = getMediaSafe(clip);
                    const colors = CLIP_COLORS[media.type] || CLIP_COLORS.video;
                    const isSelected = selectedClipIds.includes(clip.id);
                    const width = Math.max(clip.duration * zoomLevel, MIN_CLIP_WIDTH);
                    const left = clip.startTime * zoomLevel;
                    const isDragging = draggingClipId === clip.id;
                    const clipHeight = TRACK_HEIGHT - 8;
                    const isVideoWithAudio =
                      media.type === 'video' && media.waveformPeaks && media.waveformPeaks.length > 0;
                    const mainVisualHeight = isVideoWithAudio ? clipHeight - 12 : clipHeight;

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 rounded overflow-hidden cursor-pointer group select-none ${colors.bg} border ${colors.border} ${colors.hover} transition-all duration-75 ${
                          isSelected ? 'ring-2 ring-white shadow-lg z-10' : 'hover:brightness-110'
                        } ${track.locked ? 'opacity-50' : ''} ${isDragging ? 'opacity-80 brightness-125' : ''}`}
                        style={{ left: `${left}px`, width: `${width}px`, height: clipHeight }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip)}
                        onMouseMove={(e) => {
                          if (activeTool === 'split') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverCutX(e.clientX - rect.left);
                            setHoverCutClipId(clip.id);
                          }
                        }}
                        onMouseLeave={() => {
                          if (activeTool === 'split') {
                            setHoverCutX(null);
                            setHoverCutClipId(null);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectClip(clip.id);
                        }}
                      >
                        {/* ── Visual content layer ──────────────────── */}
                        {media.type === 'video' && (
                          <div style={{ height: mainVisualHeight }} className="relative overflow-hidden">
                            <FrameStripOverlay
                              media={media}
                              clipId={clip.id}
                              width={width}
                              height={mainVisualHeight}
                            />
                          </div>
                        )}

                        {media.type === 'image' && (
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {media.thumbnail ? (
                              <img
                                src={media.thumbnail}
                                alt=""
                                draggable={false}
                                className="w-full h-full object-cover opacity-60"
                              />
                            ) : (
                              <div className="w-full h-full bg-amber-700/30" />
                            )}
                          </div>
                        )}

                        {media.type === 'audio' && (
                          <WaveformOverlay
                            media={media}
                            clipId={clip.id}
                            width={width}
                            height={clipHeight}
                          />
                        )}

                        {/* Audio waveform bar beneath video frame strip */}
                        {isVideoWithAudio && (
                          <div
                            className="relative overflow-hidden border-t border-blue-400/20"
                            style={{ height: 12 }}
                          >
                            <WaveformOverlay
                              media={media}
                              clipId={clip.id}
                              width={width}
                              height={12}
                              small
                            />
                          </div>
                        )}

                        {/* ── Resize handles ────────────────────────── */}
                        {!track.locked && (
                          <>
                            <div
                              className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize z-20 transition-colors ${
                                activeTool === 'ripple' ? 'hover:bg-amber-500' : 'hover:bg-white/40'
                              }`}
                            />
                            <div
                              className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize z-20 transition-colors ${
                                activeTool === 'ripple' ? 'hover:bg-amber-500' : 'hover:bg-white/40'
                              }`}
                            />
                          </>
                        )}

                        {/* ── Clip label overlay ────────────────────── */}
                        <div className="absolute inset-0 flex flex-col px-1.5 py-0.5 overflow-hidden z-10 pointer-events-none">
                          {/* Header */}
                          <div className="flex items-center gap-1 min-w-0">
                            {media.type === 'video' && <Film className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'audio' && <Music className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'image' && <Image className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            <span
                              className={`text-[9px] font-medium truncate drop-shadow-sm ${colors.text}`}
                            >
                              {media.name}
                            </span>
                          </div>

                          {/* Duration badge */}
                          <div className="absolute bottom-0.5 right-1 text-[8px] text-white/50 tabular-nums">
                            {clip.duration.toFixed(1)}s
                          </div>
                        </div>

                        {/* ── Razor preview cut line ────────────────── */}
                        {activeTool === 'split' && hoverCutClipId === clip.id && hoverCutX !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-red-500 z-30 pointer-events-none shadow"
                            style={{
                              left: `${hoverCutX}px`,
                              outline: '1px dashed white',
                              outlineOffset: '-1.5px',
                            }}
                          />
                        )}

                        {/* ── Split button ───────────────────────────── */}
                        {!track.locked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSplit(clip.id);
                            }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity z-30 pointer-events-auto"
                            title="Split at playhead"
                          >
                            <Scissors className="w-3 h-3 text-white" />
                          </button>
                        )}

                        {/* ── Overlap warning ────────────────────────── */}
                        {checkOverlapAt(track, clip.startTime, clip.duration, clip.id) && (
                          <div
                            className="absolute top-0 left-0 w-full h-1 bg-red-500/80 animate-pulse"
                            title="Overlap detected"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* ── Drop preview ──────────────────────────────────────── */}
              {dropPreview && hoveredTrackId && (
                <div
                  className="absolute border-2 border-amber-500/50 border-dashed rounded pointer-events-none z-40 bg-amber-500/5"
                  style={{
                    top: `${dropPreview.trackIdx * TRACK_HEIGHT + 4}px`,
                    left: `${dropPreview.left}px`,
                    width: `${dropPreview.width}px`,
                    height: TRACK_HEIGHT - 8,
                  }}
                />
              )}

              {/* Full‑track hover outline */}
              {hoveredTrackId && !dropPreview && (
                <div
                  className="absolute left-0 right-0 border-2 border-amber-500/30 border-dashed pointer-events-none z-40"
                  style={{
                    top: `${tracks.findIndex((t) => t.id === hoveredTrackId) * TRACK_HEIGHT}px`,
                    height: TRACK_HEIGHT,
                  }}
                />
              )}

              {/* ── Snap line ──────────────────────────────────────────── */}
              {snapLine !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-white z-40 pointer-events-none"
                  style={{ left: `${snapLine}px` }}
                />
              )}

              {/* ── Playhead ───────────────────────────────────────────── */}
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{ left: `${currentTime * zoomLevel}px` }}
              >
                <div className="w-px h-full bg-red-500" />
                <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full -translate-y-px" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
