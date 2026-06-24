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
  X,
  Sparkles,
  Plus,
  ArrowLeftRight,
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

// ─── Transitions Sub-Component ────────────────────────────────────────────────

interface TransitionTargetProps {
  clipId: string;
  trackId: string;
  left: number;
  width: number;
  hasTransition: boolean;
  transitionName?: string;
  isSelected: boolean;
  zoomLevel: number;
}

function TransitionPreviewTooltipCanvas({ transitionName }: { transitionName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    let animationId: number;
    let start: number | null = null;
    const duration = 1500; // 1.5s loop duration

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const nameLower = transitionName.toLowerCase();

      const drawBlock = (color: string, opacity: number, scaleMultiplier: number = 1, tx: number = 0, ty: number = 0) => {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(W / 2 + tx, H / 2 + ty);
        ctx.scale(scaleMultiplier, scaleMultiplier);
        
        ctx.fillStyle = color;
        ctx.fillRect(-W / 2, -H / 2, W, H);
        ctx.restore();
      };

      const colorA = '#ef4444'; // Red
      const colorB = '#3b82f6'; // Blue

      if (nameLower.includes('dissolve')) {
        drawBlock(colorA, 1 - t);
        drawBlock(colorB, t);
      } else if (nameLower.includes('fade')) {
        if (t < 0.5) {
          drawBlock(colorA, 1 - t * 2);
        } else {
          drawBlock(colorB, (t - 0.5) * 2);
        }
      } else if (nameLower.includes('wipe')) {
        if (nameLower.includes('left')) {
          drawBlock(colorA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(W * (1 - t), 0, W * t, H);
          ctx.clip();
          drawBlock(colorB, 1);
          ctx.restore();
        } else {
          drawBlock(colorA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W * t, H);
          ctx.clip();
          drawBlock(colorB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('slide')) {
        if (nameLower.includes('up')) {
          drawBlock(colorA, 1, 1, 0, -H * t);
          drawBlock(colorB, 1, 1, 0, H * (1 - t));
        } else if (nameLower.includes('down')) {
          drawBlock(colorA, 1, 1, 0, H * t);
          drawBlock(colorB, 1, 1, 0, -H * (1 - t));
        } else {
          drawBlock(colorA, 1, 1, -W * t, 0);
          drawBlock(colorB, 1, 1, W * (1 - t), 0);
        }
      } else if (nameLower.includes('zoom')) {
        if (nameLower.includes('out')) {
          drawBlock(colorB, 1);
          drawBlock(colorA, 1 - t, 1 - t);
        } else {
          drawBlock(colorA, 1 - t);
          drawBlock(colorB, t, t);
        }
      } else {
        drawBlock(colorA, 1 - t);
        drawBlock(colorB, t);
      }
    };

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = (elapsed % duration) / duration;
      draw(progress);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [transitionName]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={68}
      className="rounded border border-purple-500/30 bg-[#0c0c0c]"
    />
  );
}

function TransitionTarget({
  clipId,
  trackId,
  left,
  width,
  hasTransition,
  transitionName,
  isSelected,
  zoomLevel,
}: TransitionTargetProps) {
  const { selectTransition, updateTransition, removeTransition } = useEditorStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/procut-transition')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const name = e.dataTransfer.getData('application/procut-transition');
    if (!name) return;

    let type: 'dissolve' | 'wipe' | 'zoom' | 'slide' = 'dissolve';
    if (name.toLowerCase().includes('wipe')) type = 'wipe';
    else if (name.toLowerCase().includes('zoom')) type = 'zoom';
    else if (name.toLowerCase().includes('slide')) type = 'slide';

    const newTransition = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      duration: 1.0,
      params: { alignment: 'center' },
    };

    useEditorStore.getState().updateClip(clipId, {
      transitionIn: newTransition,
    });
    useEditorStore.getState().saveSnapshot();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTransition(clipId);
  };

  if (hasTransition) {
    let TransitionIcon = Sparkles;
    const nameLower = (transitionName || '').toLowerCase();
    if (nameLower.includes('wipe')) {
      TransitionIcon = ArrowLeftRight;
    } else if (nameLower.includes('slide')) {
      TransitionIcon = GripVertical;
    } else if (nameLower.includes('zoom')) {
      TransitionIcon = ZoomIn;
    }

    return (
      <div
        className={`absolute top-2 bottom-2 rounded-sm z-30 flex items-center justify-center cursor-pointer text-white border transition-all group/trans ${
          isSelected
            ? 'bg-purple-600 border-purple-300 ring-1 ring-purple-300 shadow-lg'
            : 'bg-purple-700/80 border-purple-600 hover:bg-purple-600 hover:border-purple-500'
        }`}
        style={{ left: `${left}px`, width: `${width}px` }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TransitionIcon className={`w-3.5 h-3.5 text-purple-200 group-hover/trans:scale-110 transition-transform ${isHovered ? 'animate-pulse' : ''}`} />

        {/* Hover preview tooltip with animation */}
        {isHovered && transitionName && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/95 border border-purple-500 rounded p-1.5 shadow-2xl z-50 flex flex-col items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            style={{ minWidth: '130px' }}
          >
            <span className="text-[9px] text-white font-semibold capitalize whitespace-nowrap">
              {transitionName}
            </span>
            <TransitionPreviewTooltipCanvas transitionName={transitionName} />
          </div>
        )}

        {/* Cursor tracking label tooltip */}
        {isHovered && transitionName && (
          <div
            className="absolute pointer-events-none bg-black/95 text-[9px] text-purple-200 px-1.5 py-0.5 rounded shadow-lg border border-purple-500/30 z-[100] whitespace-nowrap"
            style={{
              top: `${mousePos.y + 15}px`,
              left: `${mousePos.x + 15}px`,
            }}
          >
            {transitionName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="absolute top-0 bottom-0 z-30 flex flex-col items-center justify-center pointer-events-auto group cursor-pointer"
      style={{
        left: `${left + width / 2 - 12}px`, // centered exactly at the cut line (width is 24px)
        width: '24px',
      }}
    >
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
      
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-md transition-all ${
        isDragOver
          ? 'bg-purple-600 border-purple-300 text-white scale-125'
          : 'bg-[#252525] border-purple-500/60 text-purple-400 hover:text-white hover:scale-110 hover:border-purple-500'
      }`}>
        <Plus className="w-3.5 h-3.5" />
      </div>
      
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Timeline() {
  const {
    tracks,
    currentTime,
    isPlaying,
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
    resolveOverlaps,
    zoomIn,
    zoomOut,
    toggleTrackLock,
    toggleTrackMute,
    addTrack,
    removeTrack,
    updateClip,
    setDragPreview,
    showTransitionLayer,
    selectedTransitionClipId,
    setShowTransitionLayer,
    selectTransition,
    selectedKeyframeLines,
    toggleKeyframeLineSelection,
  } = useEditorStore();

  // ── Refs & local state ──────────────────────────────────────────────────

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const trackHeadersRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    originalScrollLeft: number;
    trackId: string;
    trackType: string;
    draggedClips?: {
      id: string;
      originalStartTime: number;
      trackId: string;
    }[];
  } | null>(null);

  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragMouseXRef = useRef<number | null>(null);
  const dragMouseYRef = useRef<number | null>(null);

  const [resizeState, setResizeState] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    startX: number;
    originalDuration: number;
    originalTrimStart: number;
    originalTrimEnd: number;
    originalStartTime: number;
    originalSpeed: number;
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
      const target = trackContainerRef.current;
      useEditorStore.getState().setScrollLeft(target.scrollLeft);
      // Sync vertical scroll to headers
      if (trackHeadersRef.current && trackHeadersRef.current.scrollTop !== target.scrollTop) {
        trackHeadersRef.current.scrollTop = target.scrollTop;
      }
    }
  }, []);

  const handleHeadersScroll = useCallback(() => {
    if (trackHeadersRef.current && trackContainerRef.current) {
      const target = trackHeadersRef.current;
      if (trackContainerRef.current.scrollTop !== target.scrollTop) {
        trackContainerRef.current.scrollTop = target.scrollTop;
      }
    }
  }, []);

  // ── Auto-scroll timeline during playback ──────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const container = trackContainerRef.current;
    if (!container) return;

    const visibleWidth = container.clientWidth;
    const totalMediaWidth = totalDuration * zoomLevel;
    if (totalMediaWidth <= visibleWidth) return;

    const playheadX = currentTime * zoomLevel;
    const thresholdX = container.scrollLeft + visibleWidth * 0.6;

    if (playheadX > thresholdX) {
      const targetScroll = playheadX - visibleWidth * 0.6;
      container.scrollLeft = targetScroll;
      useEditorStore.getState().setScrollLeft(targetScroll);
    } else if (playheadX < container.scrollLeft) {
      const targetScroll = Math.max(0, playheadX - visibleWidth * 0.1);
      container.scrollLeft = targetScroll;
      useEditorStore.getState().setScrollLeft(targetScroll);
    }
  }, [currentTime, isPlaying, zoomLevel, totalDuration]);

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

  const updateDragPosition = useCallback((clientX: number, clientY: number, currScrollLeft: number) => {
    if (!dragState || !dragState.draggedClips || dragState.draggedClips.length === 0) return;

    const dx = (clientX - dragState.startX) + (currScrollLeft - dragState.originalScrollLeft);
    const dt = dx / zoomLevel;
    let newTime = Math.max(0, dragState.originalStartTime + dt);

    const hoverTrack = getTrackFromMouseY(clientY);
    const targetTrackId =
      hoverTrack && hoverTrack.type === dragState.trackType ? hoverTrack.id : dragState.trackId;

    const movingClip = tracks.flatMap((t) => t.clips).find((c) => c.id === dragState.clipId);
    const movingDuration = movingClip?.duration ?? 0;

    const { snappedTime, snapPos } = computeSnap(newTime, dragState.clipId, movingDuration);
    newTime = snappedTime;
    setSnapLine(snapPos);

    const finalDt = newTime - dragState.originalStartTime;

    if (dragState.draggedClips.length > 1) {
      setDragPreview(0, null);

      const sourceTrackIdx = tracks.findIndex((t) => t.id === dragState.trackId);
      const targetTrackIdx = tracks.findIndex((t) => t.id === targetTrackId);
      const trackDelta = targetTrackIdx - sourceTrackIdx;

      const updates = dragState.draggedClips.map((c) => {
        const clipNewTime = Math.max(0, c.originalStartTime + finalDt);
        
        const clipTrackIdx = tracks.findIndex((t) => t.id === c.trackId);
        const newTrackIdx = clipTrackIdx + trackDelta;
        const originalTrack = tracks.find((t) => t.id === c.trackId);
        const targetTrack = tracks[newTrackIdx];

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

      moveClips(updates);
    } else if (dragState.draggedClips.length === 1) {
      setDragPreview(newTime, targetTrackId);
      moveClip(dragState.clipId, newTime, targetTrackId);
    }
  }, [dragState, tracks, zoomLevel, getTrackFromMouseY, computeSnap, moveClips, moveClip, setDragPreview]);

  const updateDragPositionRef = useRef(updateDragPosition);
  useEffect(() => {
    updateDragPositionRef.current = updateDragPosition;
  }, [updateDragPosition]);

  // Auto-scroll loop when dragging
  useEffect(() => {
    if (!dragState) {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      dragMouseXRef.current = null;
      dragMouseYRef.current = null;
      return;
    }

    const checkScroll = () => {
      const container = trackContainerRef.current;
      if (!container || dragMouseXRef.current === null || dragMouseYRef.current === null) return;

      const rect = container.getBoundingClientRect();
      const mouseX = dragMouseXRef.current;
      const mouseY = dragMouseYRef.current;

      const scrollSpeed = 8; // pixels per tick
      const edgeThreshold = 40; // distance from edge in pixels
      let scrolled = false;
      let nextScrollLeft = container.scrollLeft;

      if (mouseX > rect.right - edgeThreshold) {
        nextScrollLeft = Math.min(
          container.scrollWidth - container.clientWidth,
          container.scrollLeft + scrollSpeed
        );
        if (nextScrollLeft !== container.scrollLeft) {
          container.scrollLeft = nextScrollLeft;
          scrolled = true;
        }
      } else if (mouseX < rect.left + edgeThreshold) {
        nextScrollLeft = Math.max(0, container.scrollLeft - scrollSpeed);
        if (nextScrollLeft !== container.scrollLeft) {
          container.scrollLeft = nextScrollLeft;
          scrolled = true;
        }
      }

      if (scrolled) {
        updateDragPositionRef.current(mouseX, mouseY, nextScrollLeft);
      }
    };

    scrollIntervalRef.current = setInterval(checkScroll, 16);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [dragState]);

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
      if ((activeTool === 'ripple' || activeTool === 'rateStretch') && track) {
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
          originalSpeed: clip.speed,
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
          originalSpeed: clip.speed,
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
          originalScrollLeft: scrollLeft,
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
          originalScrollLeft: scrollLeft,
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
        originalScrollLeft: scrollLeft,
        trackId: clip.trackId,
        trackType: track?.type || 'video',
        draggedClips,
      });

      e.stopPropagation();
    },
    [tracks, activeTool, splitClip, zoomLevel, selectClip, selectClips, selectedClipIds, scrollLeft],
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
        dragMouseXRef.current = e.clientX;
        dragMouseYRef.current = e.clientY;
        updateDragPosition(e.clientX, e.clientY, scrollLeft);
      }

      // ─ Clip resize ──────────────────────────────────────────────────
      if (resizeState) {
        const dx = e.clientX - resizeState.startX;
        const dt = dx / zoomLevel;
        const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === resizeState.clipId);
        if (!clip) return;

        const media = getMediaSafe(clip);
        const sourceDuration = media.duration || 30;

        if (activeTool === 'rateStretch') {
          const originalSpeed = resizeState.originalSpeed || 1.0;
          const sourceContentDuration = resizeState.originalDuration * originalSpeed;

          if (resizeState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
            const newSpeed = sourceContentDuration / newDuration;
            const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            const clampedDuration = sourceContentDuration / clampedSpeed;
            const delta = clampedDuration - resizeState.originalDuration;

            updateClip(resizeState.clipId, {
              duration: clampedDuration,
              speed: clampedSpeed,
              trimStart: resizeState.originalTrimStart,
              trimEnd: resizeState.originalTrimEnd,
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
            const newSpeed = sourceContentDuration / newDuration;
            const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            let clampedDuration = sourceContentDuration / clampedSpeed;
            let shift = resizeState.originalDuration - clampedDuration;
            shift = Math.max(-resizeState.originalStartTime, shift);
            clampedDuration = resizeState.originalDuration - shift;
            const finalSpeed = Math.min(20, Math.max(0.1, sourceContentDuration / clampedDuration));

            updateClip(resizeState.clipId, {
              startTime: resizeState.originalStartTime + shift,
              duration: clampedDuration,
              speed: finalSpeed,
              trimStart: resizeState.originalTrimStart,
              trimEnd: resizeState.originalTrimEnd,
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
        const draggedIds = dragState.draggedClips?.map((c) => c.id) || [];
        if (draggedIds.length > 0) {
          useEditorStore.getState().resolveOverlaps(draggedIds);
        }
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
    updateDragPosition,
    resolveOverlaps,
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
      const x = e.clientX - rect.left;
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
      const x = e.clientX - rect.left;
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

  // ── Native Wheel Events (Gestures) ──────────────────────────────────────

  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom
        e.preventDefault();
        const store = useEditorStore.getState();
        const currentZoom = store.zoomLevel;
        const zoomDelta = e.deltaY > 0 ? -10 : 10;
        const newZoom = Math.min(Math.max(currentZoom + zoomDelta, 20), 400);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Calculate the exact time under the mouse cursor right now
        const timeUnderCursor = (store.scrollLeft + mouseX) / currentZoom;
        
        // Calculate the new scrollLeft so that timeUnderCursor stays at mouseX
        const newScrollLeft = Math.max(0, timeUnderCursor * newZoom - mouseX);

        store.setZoomLevel(newZoom);
        store.setScrollLeft(newScrollLeft);
      } else {
        // Two-finger pan / normal wheel scroll
        // Native horizontal/vertical scroll works for most trackpads,
        // but if holding shift or trackpad horizontal dragging occurs, it natively scrolls.
        // We do not preventDefault here to allow native smooth scrolling horizontally.
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rateStretchPulse {
          0% {
            box-shadow: 0 0 0 0px rgba(168, 85, 247, 0.7), inset 0 0 0 1px rgba(168, 85, 247, 0.5);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(168, 85, 247, 0), inset 0 0 0 2px rgba(168, 85, 247, 0.8);
          }
          100% {
            box-shadow: 0 0 0 0px rgba(168, 85, 247, 0), inset 0 0 0 1px rgba(168, 85, 247, 0.5);
          }
        }
        .rate-stretch-active {
          animation: rateStretchPulse 1.5s infinite ease-in-out;
        }
      `}} />
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

        <div className="w-px h-4 bg-[#3e3e3e] mx-2" />

        {/* Transition Toggle */}
        <button
          onClick={() => setShowTransitionLayer(!showTransitionLayer)}
          title={showTransitionLayer ? "Hide Transition Layer" : "Show Transition Layer"}
          className={`px-2 py-0.5 text-[10px] rounded flex items-center gap-1 transition-colors ${
            showTransitionLayer
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold'
              : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
          }`}
        >
          <Sparkles className="w-3 h-3" /> Transitions
        </button>

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
          <div
            ref={trackHeadersRef}
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
            onScroll={handleHeadersScroll}
          >
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
            onScroll={handleScroll}
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
                    selectClip(null);
                    selectTransition(null);
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

                      const clipAnims = clip.animations?.['transform.x'] || [];
                      const keyframeTimes = clipAnims.map(k => k.time).sort((a,b) => a - b);

                      return (
                        <div
                          key={clip.id}
                          className={`absolute top-1 rounded cursor-pointer group select-none ${colors.bg} border ${colors.border} ${colors.hover} transition-all duration-75 ${
                            isSelected
                              ? activeTool === 'rateStretch'
                                ? 'ring-2 ring-purple-500 shadow-lg z-10 rate-stretch-active'
                                : 'ring-2 ring-white shadow-lg z-10'
                              : 'hover:brightness-110'
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
                          if (e.ctrlKey || e.metaKey) return;
                          selectClip(clip.id);
                        }}
                      >
                        {/* ── Visual content layer ──────────────────── */}
                        <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
                          {media.type === 'video' && (
                            <div style={{ height: mainVisualHeight }} className="relative">
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
                        </div>

                        {/* ── Master Keyframes ────────────────────────── */}
                        {keyframeTimes.length > 0 && (
                          <div className="absolute top-0 left-0 right-0 h-0 z-40 pointer-events-none">
                            {/* Connecting Lines */}
                            {keyframeTimes.length > 1 && keyframeTimes.slice(0, -1).map((t, i) => {
                              const kf = clipAnims.find(k => Math.abs(k.time - t) < 0.05);
                              if (kf?.holdNext) return null;
                              
                              const nextT = keyframeTimes[i + 1];
                              const width = (nextT - t) * zoomLevel;
                              
                              const isSelected = selectedKeyframeLines.some(l => l.clipId === clip.id && l.time === t);
                              
                              return (
                                <div
                                  key={`line-${t}`}
                                  className={`absolute h-[2px] -top-[1px] pointer-events-auto cursor-pointer hover:h-[4px] hover:-top-[2px] transition-all ${isSelected ? 'bg-white h-[4px] -top-[2px] z-10 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-red-500/80 hover:bg-red-400'}`}
                                  title="Click to select connection"
                                  style={{
                                    left: `${t * zoomLevel}px`,
                                    width: `${width}px`
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleKeyframeLineSelection(clip.id, t, e.ctrlKey || e.metaKey);
                                  }}
                                />
                              );
                            })}
                            
                            {/* Keyframe Points */}
                            {keyframeTimes.map((t, i) => {
                              const kf = clipAnims.find(k => Math.abs(k.time - t) < 0.05);
                              const prevKf = i > 0 ? clipAnims.find(k => Math.abs(k.time - keyframeTimes[i - 1]) < 0.05) : null;
                              const isStartEnd = i === 0 || i === keyframeTimes.length - 1 || kf?.holdNext || prevKf?.holdNext;
                              return (
                                <div
                                  key={t}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const startX = e.clientX;
                                    let currentTimeMark = t;
                                    const onMouseMove = (moveEvent: MouseEvent) => {
                                      const deltaX = moveEvent.clientX - startX;
                                      let newTime = t + deltaX / zoomLevel;
                                      newTime = Math.max(0, Math.min(newTime, clip.duration));
                                      if (Math.abs(newTime - currentTimeMark) > 0.01) {
                                        useEditorStore.getState().moveMasterKeyframe(clip.id, currentTimeMark, newTime);
                                        currentTimeMark = newTime;
                                      }
                                    };
                                    const onMouseUp = () => {
                                      window.removeEventListener('mousemove', onMouseMove);
                                      window.removeEventListener('mouseup', onMouseUp);
                                      useEditorStore.getState().saveSnapshot();
                                    };
                                    window.addEventListener('mousemove', onMouseMove);
                                    window.addEventListener('mouseup', onMouseUp);
                                  }}
                                  className="absolute w-4 h-4 -top-2 -ml-2 pointer-events-auto cursor-ew-resize flex items-center justify-center group"
                                  style={{ left: `${t * zoomLevel}px` }}
                                >
                                  {isStartEnd ? (
                                    <div className="w-2.5 h-2.5 rotate-45 bg-amber-500 border border-white group-hover:bg-amber-400 group-hover:scale-125 transition-transform shadow" />
                                  ) : (
                                    <div className="w-[3px] h-3 bg-amber-500 border border-white group-hover:bg-amber-400 group-hover:scale-125 transition-transform shadow" />
                                  )}
                                </div>
                              );
                            })}
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

                  {/* ── Transitions Layer ───────────────────────────── */}
                  {showTransitionLayer && !track.locked && (() => {
                    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
                    return sortedClips.map((clip, idx) => {
                      if (idx === 0) return null;
                      const prevClip = sortedClips[idx - 1];
                      const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
                      
                      if (Math.abs(gap) < 0.1) {
                        const intersectionTime = clip.startTime;
                        const hasTransition = !!clip.transitionIn;
                        
                        const transition = clip.transitionIn;
                        const duration = transition?.duration ?? 1.0;
                        const alignment = transition?.params?.alignment as 'center' | 'left' | 'right' || 'center';
                        
                        const widthSec = hasTransition ? duration : 0.4;
                        const widthPx = Math.max(16, widthSec * zoomLevel);
                        
                        let leftSec = intersectionTime - widthSec / 2;
                        if (alignment === 'left') {
                          leftSec = intersectionTime;
                        } else if (alignment === 'right') {
                          leftSec = intersectionTime - widthSec;
                        }
                        const leftPx = leftSec * zoomLevel;
                        
                        const isSelected = selectedTransitionClipId === clip.id;
                        
                        return (
                          <TransitionTarget
                            key={`trans-${clip.id}`}
                            clipId={clip.id}
                            trackId={track.id}
                            left={leftPx}
                            width={widthPx}
                            hasTransition={hasTransition}
                            transitionName={transition?.name}
                            isSelected={isSelected}
                            zoomLevel={zoomLevel}
                          />
                        );
                      }
                      return null;
                    });
                  })()}
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
