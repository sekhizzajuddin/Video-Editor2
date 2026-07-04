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
  Link,
  Unlink2,
  Edit,
  Layers,
  Pin,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { TimelineClip, TimelineTrack, MediaItem, EditorState, OverLayerClip } from '@/types';
import { formatSimpleTime } from '@/utils/time';
import { TITLE_TEMPLATES } from '@/utils/titleTemplates';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TRACK_HEIGHT = 56;
const THIN_TRACK_HEIGHT = 32;
const OVER_LAYER_ROW_HEIGHT = 36;

export const getTrackHeight = (
  track: TimelineTrack,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  const base = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
  const isOpen = pinnedTrackId === track.id || (hoveredRegion && hoveredRegion.trackId === track.id);
  if (!isOpen) return base;

  // Find active over-layers overlapping the hovered region
  const region = hoveredRegion || { trackId: track.id, startTime: 0, endTime: Infinity };
  const activeCount = (track.overLayers || []).filter((ol) => {
    return ol.startTime < region.endTime && ol.startTime + ol.duration > region.startTime;
  }).length;

  return base + activeCount * OVER_LAYER_ROW_HEIGHT;
};

export const getTrackTop = (
  tracks: TimelineTrack[],
  index: number,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  let top = 0;
  for (let i = 0; i < index; i++) top += getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
  return top;
};

export const getTrackAtY = (
  tracks: TimelineTrack[],
  y: number,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  let currentY = 0;
  for (let i = 0; i < tracks.length; i++) {
    const h = getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
    if (y >= currentY && y < currentY + h) return i;
    currentY += h;
  }
  return tracks.length - 1;
};
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
  text:  { bg: 'bg-purple-600/70', border: 'border-purple-500/50', text: 'text-purple-100', hover: 'hover:border-purple-400' },
  fx:    { bg: 'bg-rose-600/70',   border: 'border-rose-500/50',   text: 'text-rose-100',   hover: 'hover:border-rose-400' },
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
  const { selectTransition, updateTransition, removeTrack,
    reorderTrack, } = useEditorStore();
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
    selectedOverLayerId,
    mediaLibrary,
    hoveredOverLayerRegion,
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
    addClip,
    reorderTrack,
    unlinkAudio,
    breakLinkConnection,
    inPoint,
    outPoint,
    markers,
    addMarker,
    updateMarker,
    removeMarker,
    beatMarkers,
    addOverLayer,
    removeOverLayer,
    updateOverLayer,
    moveOverLayer,
    reorderOverLayer,
    selectOverLayer,
    setHoveredOverLayerRegion,
    pinnedOverLayerTrackId,
    setPinnedOverLayerTrackId,
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

  const [dragOverLayerState, setDragOverLayerState] = useState<{
    overLayerId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    trackId: string;
  } | null>(null);

  const [resizeOverLayerState, setResizeOverLayerState] = useState<{
    overLayerId: string;
    edge: 'left' | 'right';
    startX: number;
    originalDuration: number;
    originalStartTime: number;
  } | null>(null);

  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    time: number;
    duration: number;
    trackIdx: number;
  } | null>(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [scrubMouseX, setScrubMouseX] = useState<number>(0);

  const [hoverCutClipId, setHoverCutClipId] = useState<string | null>(null);
  const [hoverCutX, setHoverCutX] = useState<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; clipId: string; trackType: string; mediaType: string; isOverLayer?: boolean; trackId?: string;
  } | null>(null);

  const [markerContextMenu, setMarkerContextMenu] = useState<{
    x: number; y: number; markerId: string;
  } | null>(null);

  // Close context menu on click-away
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close, { once: true });
    return () => window.removeEventListener('mousedown', close);
  }, [contextMenu]);

  useEffect(() => {
    if (!markerContextMenu) return;
    const close = () => setMarkerContextMenu(null);
    window.addEventListener('mousedown', close, { once: true });
    return () => window.removeEventListener('mousedown', close);
  }, [markerContextMenu]);

  // Throttle ref — setScrollLeft in the store is expensive; only push at ~30fps max
  const scrollStoreThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setScrollLeftThrottled = useCallback((value: number) => {
    if (scrollStoreThrottleRef.current) return;
    scrollStoreThrottleRef.current = setTimeout(() => {
      useEditorStore.getState().setScrollLeft(value);
      scrollStoreThrottleRef.current = null;
    }, 33); // ~30fps
  }, []);

  // ── Scroll sync ─────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    if (trackContainerRef.current) {
      const target = trackContainerRef.current;
      // Throttle store updates; DOM position updates immediately
      setScrollLeftThrottled(target.scrollLeft);
      // Sync vertical scroll to headers
      if (trackHeadersRef.current && trackHeadersRef.current.scrollTop !== target.scrollTop) {
        trackHeadersRef.current.scrollTop = target.scrollTop;
      }
    }
  }, [setScrollLeftThrottled]);

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
      setScrollLeftThrottled(targetScroll);
    } else if (playheadX < container.scrollLeft) {
      const targetScroll = Math.max(0, playheadX - visibleWidth * 0.1);
      container.scrollLeft = targetScroll;
      setScrollLeftThrottled(targetScroll);
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
      const idx = getTrackAtY(tracks, relY, hoveredOverLayerRegion, pinnedOverLayerTrackId);
      return idx >= 0 && idx < tracks.length ? tracks[idx] : null;
    },
    [tracks, hoveredOverLayerRegion, pinnedOverLayerTrackId],
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

      // Filter out duplicate clip updates to prevent ghost clips
      const seen = new Set<string>();
      const uniqueUpdates = updates.filter((u) => {
        if (seen.has(u.clipId)) return false;
        seen.add(u.clipId);
        return true;
      });

      moveClips(uniqueUpdates);
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
      // Clicked timeline background -> deselect everything
      selectClip(null);
      selectTransition(null);
      selectTrack(null);

      const rect = trackContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scroll = trackContainerRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scroll;
      seek(Math.max(0, x / zoomLevel));
    },
    [activeTool, zoomLevel, seek, selectClip, selectTransition, selectTrack],
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

  const startResize = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, edge: 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      let rippleClips: { id: string; originalStartTime: number }[] = [];
      if ((activeTool === 'ripple' || activeTool === 'rateStretch') && track) {
        rippleClips = track.clips
          .filter((c) => c.id !== clip.id && c.startTime >= clip.startTime)
          .map((c) => ({ id: c.id, originalStartTime: c.startTime }));
      }

      let sibling: any = undefined;
      if (clip.splitGroupId && track) {
        const siblingClips = track.clips
          .filter((c) => c.id !== clip.id && c.splitGroupId === clip.splitGroupId)
          .sort((a, b) => a.trimStart - b.trimStart);
        if (edge === 'left') {
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
        } else {
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
        edge,
        startX: e.clientX,
        originalDuration: clip.duration,
        originalTrimStart: clip.trimStart,
        originalTrimEnd: clip.trimEnd,
        originalStartTime: clip.startTime,
        originalSpeed: clip.speed,
        siblingClip: sibling,
        rippleClips,
      });
    },
    [tracks, activeTool],
  );

  // ── Clip drag / resize mousedown ────────────────────────────────────────

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      if (e.button !== 0) return;
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = e.clientX - rect.left;

      // Left resize handle
      if (relX < 6) {
        useEditorStore.getState().startTransaction();
        startResize(e, clip, 'left');
        return;
      }

      // Right resize handle
      if (relX > rect.width - 6) {
        useEditorStore.getState().startTransaction();
        startResize(e, clip, 'right');
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

      useEditorStore.getState().startTransaction();
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
    let scrubRafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      // ─ Playhead scrubbing ──────────────────────────────────────────
      if (isScrubbing) {
        if (scrubRafId !== null) {
          cancelAnimationFrame(scrubRafId);
        }
        const clientX = e.clientX;
        scrubRafId = requestAnimationFrame(() => {
          scrubRafId = null;
          const rect = trackContainerRef.current?.getBoundingClientRect();
          if (rect) {
            const x = clientX - rect.left + scrollLeft;
            const time = Math.max(0, x / zoomLevel);
            seek(time);
            setScrubTime(time);
            setScrubMouseX(clientX);
          }
        });
      }

      // ─ Clip drag ────────────────────────────────────────────────────
      if (dragState && dragState.draggedClips && dragState.draggedClips.length > 0) {
        dragMouseXRef.current = e.clientX;
        dragMouseYRef.current = e.clientY;
        updateDragPosition(e.clientX, e.clientY, scrollLeft);
      }

      // ─ Over Layer drag ──────────────────────────────────────────────
      if (dragOverLayerState) {
        const dx = e.clientX - dragOverLayerState.startX;
        const dt = dx / zoomLevel;
        const newStartTime = Math.max(0, dragOverLayerState.originalStartTime + dt);
        moveOverLayer(dragOverLayerState.overLayerId, newStartTime);

        // Vertical row swapping reordering
        const track = tracks.find((t) => t.id === dragOverLayerState.trackId);
        const trackEl = document.querySelector(`[data-track-id="${dragOverLayerState.trackId}"]`);
        if (track && track.overLayers && trackEl && hoveredOverLayerRegion) {
          const trackRect = trackEl.getBoundingClientRect();
          const relY = e.clientY - trackRect.top - DEFAULT_TRACK_HEIGHT;
          const targetRowIdx = Math.max(0, Math.floor(relY / OVER_LAYER_ROW_HEIGHT));
          
          reorderOverLayer(dragOverLayerState.overLayerId, targetRowIdx);
        }
      }

      // ─ Over Layer resize ────────────────────────────────────────────
      if (resizeOverLayerState) {
        const dx = e.clientX - resizeOverLayerState.startX;
        const dt = dx / zoomLevel;
        
        const track = tracks.find((t) => (t.overLayers || []).some((ol) => ol.id === resizeOverLayerState.overLayerId));
        const ol = track?.overLayers.find((ol) => ol.id === resizeOverLayerState.overLayerId);
        if (ol) {
          if (resizeOverLayerState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeOverLayerState.originalDuration + dt);
            updateOverLayer(ol.id, { duration: newDuration });
          } else {
            const newStartTime = Math.max(0, resizeOverLayerState.originalStartTime + dt);
            const delta = newStartTime - resizeOverLayerState.originalStartTime;
            const newDuration = Math.max(0.1, resizeOverLayerState.originalDuration - delta);
            if (newDuration > 0.1) {
              updateOverLayer(ol.id, { startTime: newStartTime, duration: newDuration });
            }
          }
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
      if (scrubRafId !== null) {
        cancelAnimationFrame(scrubRafId);
        scrubRafId = null;
      }
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
        setDropPreview(null);
        useEditorStore.getState().endTransaction(); // commit final snapshot
      }
      if (resizeState) {
        setResizeState(null);
        useEditorStore.getState().endTransaction(); // commit final snapshot
      }
      if (dragOverLayerState) {
        setDragOverLayerState(null);
        useEditorStore.getState().endTransaction(); // commit final snapshot
      }
      if (resizeOverLayerState) {
        setResizeOverLayerState(null);
        useEditorStore.getState().endTransaction(); // commit final snapshot
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
    addClip,
    reorderTrack,
    getTrackFromMouseY,
    getMediaSafe,
    activeTool,
    dragOverLayerState,
    resizeOverLayerState,
    moveOverLayer,
    updateOverLayer,
    hoveredOverLayerRegion,
  ]);

  // ── Drop from media panel ───────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      const track = useEditorStore.getState().tracks.find((t) => t.id === trackId);
      if (!track) return;

      // ── Transition drop → apply to video/image clip at drop position ──
      const transitionName = e.dataTransfer.getData('application/procut-transition');
      if (transitionName && track && track.type === 'video') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dropTime = x / zoomLevel;
        // Find the clip at the drop position
        const hitClip = track.clips.find(
          (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
        );
        if (hitClip) {
          const type = transitionName.toLowerCase().includes('dissolve') ? 'dissolve'
                     : transitionName.toLowerCase().includes('wipe') ? 'wipe'
                     : transitionName.toLowerCase().includes('zoom') ? 'zoom'
                     : transitionName.toLowerCase().includes('slide') ? 'slide'
                     : 'dissolve';
          useEditorStore.getState().updateClip(hitClip.id, {
            transitionIn: {
              id: Math.random().toString(36).substr(2, 9),
              name: transitionName,
              type: type as any,
              duration: 1.0,
              params: {},
            },
          });
          useEditorStore.getState().saveSnapshot();
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Color Correction Preset drop → apply to video/image clip/overlayer at drop position ──
      const colorPresetRaw = e.dataTransfer.getData('application/procut-color-preset');
      if (colorPresetRaw && track && (track.type === 'video' || track.type === 'audio')) {
        try {
          const preset = JSON.parse(colorPresetRaw) as Record<string, number>;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const dropTime = x / zoomLevel;
          
          const baseHeight = DEFAULT_TRACK_HEIGHT;
          const isOverLayerArea = y > baseHeight;
          let targetOl: OverLayerClip | null = null;
          if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
            const activeOverLayers = (track.overLayers || []).filter((ol) => {
              return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
            });
            const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
            targetOl = activeOverLayers[rowIdx] || null;
          }

          if (targetOl) {
            const existing = targetOl.colorFilters ?? {
              temperature: 0, tint: 0, exposure: 0, contrast: 100,
              saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
            };
            useEditorStore.getState().updateOverLayer(targetOl.id, {
              colorFilters: { ...existing, ...preset },
            });
            useEditorStore.getState().saveSnapshot();
          } else {
            const hitClip = track.clips.find(
              (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
            );
            if (hitClip) {
              const existing = hitClip.colorFilters ?? {
                temperature: 0, tint: 0, exposure: 0, contrast: 100,
                saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
              };
              useEditorStore.getState().updateClip(hitClip.id, {
                colorFilters: { ...existing, ...preset },
              });
              useEditorStore.getState().saveSnapshot();
            }
          }
        } catch { /* ignore parse errors */ }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Particle effect drop → apply to video/image clip/overlayer at drop position ──
      const particleType = e.dataTransfer.getData('application/procut-particle');
      if (particleType && track && (track.type === 'video')) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dropTime = x / zoomLevel;

        const baseHeight = DEFAULT_TRACK_HEIGHT;
        const isOverLayerArea = y > baseHeight;
        let targetOl: OverLayerClip | null = null;
        if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
          const activeOverLayers = (track.overLayers || []).filter((ol) => {
            return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
          });
          const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
          targetOl = activeOverLayers[rowIdx] || null;
        }

        const PARTICLE_DEFAULTS: Record<string, Omit<import('@/types').ClipParticleSettings, 'type'|'emitterX'|'emitterY'>> = {
          snow:      { amount: 120, speed: 40,  intensity: 80, size: 100, gravity: 20,  wind: 5,  spread: 180, lifetime: 150, color: '#ffffff', colorVariance: 15, glow: false, turbulence: 20 },
          rain:      { amount: 200, speed: 160, intensity: 70, size: 100, gravity: 100, wind: 15, spread: 10,  lifetime: 60,  color: '#a0c8ff', colorVariance: 10, glow: false, turbulence: 5  },
          fire:      { amount: 80,  speed: 80,  intensity: 90, size: 130, gravity: -60, wind: 0,  spread: 60,  lifetime: 80,  color: '#ff6a00', colorVariance: 60, glow: true,  turbulence: 60 },
          sparkles:  { amount: 60,  speed: 50,  intensity: 85, size: 80,  gravity: -10, wind: 0,  spread: 360, lifetime: 100, color: '#ffd700', colorVariance: 30, glow: true,  turbulence: 30 },
          confetti:  { amount: 100, speed: 60,  intensity: 90, size: 100, gravity: 40,  wind: 10, spread: 90,  lifetime: 200, color: 'auto',    colorVariance: 100, glow: false, turbulence: 40 },
          smoke:     { amount: 30,  speed: 25,  intensity: 60, size: 200, gravity: -30, wind: 8,  spread: 30,  lifetime: 200, color: '#888888', colorVariance: 20, glow: false, turbulence: 70 },
          bubbles:   { amount: 40,  speed: 30,  intensity: 70, size: 120, gravity: -40, wind: 5,  spread: 60,  lifetime: 180, color: '#80ffff', colorVariance: 20, glow: true,  turbulence: 15 },
          leaves:    { amount: 50,  speed: 35,  intensity: 80, size: 110, gravity: 30,  wind: 20, spread: 45,  lifetime: 180, color: '#ff7b00', colorVariance: 70, glow: false, turbulence: 50 },
          hearts:    { amount: 30,  speed: 25,  intensity: 85, size: 100, gravity: -20, wind: 5,  spread: 40,  lifetime: 200, color: '#ff4d88', colorVariance: 25, glow: true,  turbulence: 20 },
          matrix:    { amount: 40,  speed: 80,  intensity: 90, size: 100, gravity: 80,  wind: 0,  spread: 0,   lifetime: 120, color: '#00ff41', colorVariance: 10, glow: true,  turbulence: 0  },
        };
        const defaults = PARTICLE_DEFAULTS[particleType] ?? PARTICLE_DEFAULTS.sparkles;

        if (targetOl) {
          useEditorStore.getState().updateOverLayer(targetOl.id, {
            particleSettings: {
              type: particleType as import('@/types').ParticleEffectType,
              emitterX: 50,
              emitterY: 100,
              ...defaults,
            },
          });
          useEditorStore.getState().selectOverLayer(targetOl.id);
          useEditorStore.getState().saveSnapshot();
        } else {
          const hitClip = track.clips.find(
            (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
          );
          if (hitClip) {
            useEditorStore.getState().updateClip(hitClip.id, {
              particleSettings: {
                type: particleType as import('@/types').ParticleEffectType,
                emitterX: 50,
                emitterY: 100,
                ...defaults,
              },
            });
            useEditorStore.getState().selectClip(hitClip.id);
            useEditorStore.getState().saveSnapshot();
          }
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Animated Title Template drop → create text clip on text track ──
      const templateId = e.dataTransfer.getData('application/procut-template');
      if (templateId) {
        const tmpl = TITLE_TEMPLATES.find((t) => t.id === templateId);
        if (tmpl && track) {
          // If the dropped track is not text, find or create a text track
          let targetTrack = track;
          if (track.type !== 'text') {
            const existingTextTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text');
            if (existingTextTrack) {
              targetTrack = existingTextTrack;
            } else {
              useEditorStore.getState().addTrack('text');
              targetTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text') || track;
            }
          }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const startTime = Math.max(0, (x + scrollLeft) / zoomLevel);
          const mediaId = `tmpl_media_${Math.random().toString(36).substr(2, 9)}`;
          const clipId  = `tmpl_clip_${Math.random().toString(36).substr(2, 9)}`;
          useEditorStore.getState().addMedia({
            id: mediaId,
            name: tmpl.name,
            type: 'text',
            duration: tmpl.defaultDuration,
            url: '',
            createdAt: Date.now(),
          });
          useEditorStore.getState().addClip({
            id: clipId,
            mediaId,
            trackId: targetTrack.id,
            startTime,
            duration: tmpl.defaultDuration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
            textSettings: { ...tmpl.textSettings },
            animations: tmpl.animations ? { ...tmpl.animations } : undefined,
          } as any);
          useEditorStore.getState().selectClip(clipId);
          useEditorStore.getState().saveSnapshot();
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      const effectName = e.dataTransfer.getData('application/procut-effect');
      if (effectName && track?.type === 'fx') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startTime = Math.max(0, x / zoomLevel);

        // Map display names → canonical fxType keys used by PreviewCanvas
        const FX_TYPE_MAP: Record<string, string> = {
          'VFX Breakdown':     'vfx_breakdown',
          'B&W to Color':      'bw_to_color',
          'Glitch':            'glitch',
          'Old Film':          'old_film',
          'VHS':               'vhs',
          'Cinematic Bars':    'cinematic_bars',
          'Neon Glow':         'neon_glow',
          'RGB Split':         'rgb_split',
          'Pixelate':          'pixelate',
          'Mirror':            'mirror',
          'Zoom Blur':         'zoom_blur',
          'Lens Flare':        'lens_flare',
          'Night Vision':      'night_vision',
          'Thermal':           'thermal',
        };
        const fxType = FX_TYPE_MAP[effectName] ?? effectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fxMediaId = generateId();
        useEditorStore.getState().addMedia({
          id: fxMediaId,
          name: effectName,
          type: 'fx',
          duration: 5,
          url: '',
          createdAt: Date.now(),
          fxType,
        });
        const fxClip: TimelineClip = {
          id: generateId(),
          mediaId: fxMediaId,
          trackId,
          startTime,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: [],
          fxSettings: {
            type: fxType as any,
            intensity: 100,
          },
        };
        useEditorStore.getState().addClip(fxClip);
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      const mediaId = e.dataTransfer.getData('application/procut-media');
      if (!mediaId) return;

      const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === mediaId);
      if (!media) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const startTime = Math.max(0, (x + scrollLeft) / zoomLevel);

      const baseHeight = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
      const isOverLayerArea = y > baseHeight;

      if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
        const activeOverLayers = (track.overLayers || []).filter((ol) => {
          return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
        });
        
        const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
        const targetOl = activeOverLayers[rowIdx];
        
        if (targetOl) {
          // Verify media type compatibility
          let compatible = false;
          if (track.type === 'video' && (media.type === 'video' || media.type === 'image')) compatible = true;
          if (track.type === 'audio' && media.type === 'audio') compatible = true;
          if (track.type === 'text' && media.type === 'text') compatible = true;
          if (track.type === 'fx' && media.type === 'fx') compatible = true;
          
          if (compatible) {
            useEditorStore.getState().updateOverLayer(targetOl.id, {
              mediaId,
              duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
              audioSettings: media.type === 'audio' || media.type === 'video' ? {
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
              } : undefined,
            });
            useEditorStore.getState().saveSnapshot();
          }
          setHoveredTrackId(null);
          setDropPreview(null);
          return;
        }
      }

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
    [zoomLevel, scrollLeft, hoveredOverLayerRegion],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const trackIdx = tracks.findIndex((t) => t.id === trackId);

      // Accept media, FX effect, color preset, and template drops
      const hasMedia = e.dataTransfer.types.includes('application/procut-media');
      const hasEffect = e.dataTransfer.types.includes('application/procut-effect');
      const hasColorPreset = e.dataTransfer.types.includes('application/procut-color-preset');
      const hasParticle = e.dataTransfer.types.includes('application/procut-particle');
      const hasTransition = e.dataTransfer.types.includes('application/procut-transition');
      const hasTemplate = e.dataTransfer.types.includes('application/procut-template');
      if ((hasMedia || hasEffect || hasColorPreset || hasParticle || hasTransition || hasTemplate) && trackIdx >= 0) {
        const approxDuration = (hasColorPreset || hasParticle || hasTransition) ? 0 : 5;
        setDropPreview({ time: x / zoomLevel, duration: approxDuration, trackIdx });
        setHoveredTrackId(trackId);

        // Auto-expand over-layer region during drag-over if matching
        const track = tracks[trackIdx];
        if (track && (track.overLayers || []).length > 0) {
          const time = (x + scrollLeft) / zoomLevel;
          const matchingOl = track.overLayers.find((ol) => {
            return time >= ol.startTime && time < ol.startTime + ol.duration;
          });
          if (matchingOl) {
            setHoveredOverLayerRegion({
              trackId,
              startTime: matchingOl.startTime,
              endTime: matchingOl.startTime + matchingOl.duration,
            });
          } else if (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
            setHoveredOverLayerRegion(null);
          }
        }
      }
    },
    [tracks, zoomLevel, scrollLeft],
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
    <>
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
          <button
            onClick={() => addTrack('text')}
            className="px-2 py-0.5 text-[10px] text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> + Text
          </button>
          <button
            onClick={() => addTrack('fx')}
            className="px-2 py-0.5 text-[10px] text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded flex items-center gap-1 transition-colors"
            title="Add FX Track — drag effects from the Effects panel onto it"
          >
            <Sparkles className="w-3 h-3" /> + FX
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
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-track-reorder', track.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-track-reorder')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => {
                  const sourceId = e.dataTransfer.getData('application/x-track-reorder');
                  if (sourceId && sourceId !== track.id) {
                    const newIndex = tracks.findIndex(t => t.id === track.id);
                    reorderTrack(sourceId, newIndex);
                  }
                }}
                className={`flex items-center px-2 border-b border-[#3e3e3e] ${
                  selectedTrackId === track.id ? 'bg-[#3e3e3e]' : ''
                }`}
                style={{ height: getTrackHeight(track, hoveredOverLayerRegion, pinnedOverLayerTrackId) }}
                onClick={() => selectTrack(track.id)}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <GripVertical className="w-3 h-3 text-[#a0a0a0] shrink-0 cursor-grab" />
                  <span className="text-[11px] text-white font-medium truncate">{track.name}</span>
                  {(() => {
                    const linkedFxTrack = tracks.find(t => t.type === 'fx' && t.linkedTrackId === track.id);
                    if (linkedFxTrack) {
                      return (
                        <span className="ml-1.5 px-1 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-[3px] text-[8px] font-semibold uppercase tracking-wider scale-90" title={`Affected by FX track ${linkedFxTrack.name}`}>
                          FX Active
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {track.type === 'fx' && track.linkedTrackId && (
                    <div className="flex items-center gap-0.5 ml-1 text-amber-400 opacity-80" title={`Linked to ${tracks.find(t => t.id === track.linkedTrackId)?.name}`}>
                      <Link className="w-3 h-3" />
                      <span className="text-[9px]">{tracks.find(t => t.id === track.linkedTrackId)?.name}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {(track.overLayers || []).length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pinnedOverLayerTrackId === track.id) {
                          setPinnedOverLayerTrackId(null);
                        } else {
                          setPinnedOverLayerTrackId(track.id);
                        }
                      }}
                      title={pinnedOverLayerTrackId === track.id ? 'Unpin Over Layers' : 'Pin Over Layers Open'}
                      className={`p-0.5 rounded transition-colors ${
                        pinnedOverLayerTrackId === track.id ? 'text-cyan-400' : 'text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      <Pin className="w-3 h-3" style={{ transform: pinnedOverLayerTrackId === track.id ? 'none' : 'rotate(45deg)' }} />
                    </button>
                  )}
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
              {/* In-point flag (green triangle) */}
              {inPoint !== null && (
                <div
                  className="absolute top-0 w-3 h-4 pointer-events-none z-20"
                  style={{ left: `${inPoint * zoomLevel}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-emerald-500" />
                </div>
              )}

              {/* Out-point flag (red triangle) */}
              {outPoint !== null && (
                <div
                  className="absolute top-0 w-3 h-4 pointer-events-none z-20"
                  style={{ left: `${outPoint * zoomLevel}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
                </div>
              )}

              {/* Timeline Markers */}
              {markers.map((marker) => {
                const markerX = marker.time * zoomLevel;
                return (
                  <div
                    key={marker.id}
                    className="absolute top-0 w-3 h-4 cursor-pointer z-30 group"
                    style={{ left: `${markerX}px`, transform: 'translateX(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      seek(marker.time);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMarkerContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        markerId: marker.id,
                      });
                    }}
                    title={marker.name}
                  >
                    {/* Diamond shape */}
                    <div 
                      className="w-2.5 h-2.5 rotate-45 border border-white/40 shadow-sm mt-0.5 mx-auto transition-transform group-hover:scale-110"
                      style={{ backgroundColor: marker.color }}
                    />
                    {/* Tooltip on hover */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-[#141414] border border-[#3e3e3e] px-1.5 py-0.5 rounded text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md">
                      {marker.name}
                    </div>
                  </div>
                );
              })}

              {/* Beat Markers — yellow diamonds on ruler */}
              {beatMarkers.map((bm, i) => {
                const bx = bm.time * zoomLevel;
                return (
                  <div
                    key={`beat-${bm.clipId}-${i}`}
                    className="absolute top-0 w-2 h-2 z-20 pointer-events-none"
                    style={{ left: `${bx}px`, transform: 'translateX(-50%) rotate(45deg) translateY(3px)' }}
                  >
                    <div className="w-full h-full bg-yellow-400/80 border border-yellow-300/60" />
                  </div>
                );
              })}

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
            className="flex-1 overflow-auto relative timeline-track-workspace"
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

              {/* In-point vertical dashed line */}
              {inPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-emerald-500/50 pointer-events-none z-20"
                  style={{ left: `${inPoint * zoomLevel}px` }}
                />
              )}

              {/* Out-point vertical dashed line */}
              {outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-red-500/50 pointer-events-none z-20"
                  style={{ left: `${outPoint * zoomLevel}px` }}
                />
              )}

              {/* Work area shading between In and Out points */}
              {inPoint !== null && outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none bg-indigo-500/5 border-l border-r border-indigo-500/20"
                  style={{
                    left: `${inPoint * zoomLevel}px`,
                    width: `${(outPoint - inPoint) * zoomLevel}px`
                  }}
                />
              )}

              {/* Marker vertical guide lines */}
              {markers.map((marker) => (
                <div
                  key={`ml-${marker.id}`}
                  className="absolute top-0 bottom-0 w-px pointer-events-none z-10 opacity-35 border-l border-dashed"
                  style={{
                    left: `${marker.time * zoomLevel}px`,
                    borderColor: marker.color
                  }}
                />
              ))}

              {/* ── Tracks ─────────────────────────────────────────── */}
              {tracks.map((track) => {
                if (track.hidden) return null;
                return (
                <div
                  key={track.id}
                  data-track-id={track.id}
                  className={`relative border-b border-[#3e3e3e] transition-colors ${
                    hoveredTrackId === track.id ? 'bg-[#3e3e3e]/30' : ''
                  }`}
              style={{ height: getTrackHeight(track, hoveredOverLayerRegion, pinnedOverLayerTrackId) }}
                  onDragOver={(e) => handleDragOver(e, track.id)}
                  onDrop={(e) => handleDrop(e, track.id)}
                  onDragEnter={() => setHoveredTrackId(track.id)}
                  onDragLeave={() => {
                    setHoveredTrackId(null);
                    setDropPreview(null);
                    setHoveredOverLayerRegion(null);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const hoverTime = (scrollLeft + mouseX) / zoomLevel;
                    
                    const hoveredOl = (track.overLayers || []).find(
                      (ol) => hoverTime >= ol.startTime && hoverTime < ol.startTime + ol.duration
                    );
                    
                    if (hoveredOl) {
                      setHoveredOverLayerRegion({
                        trackId: track.id,
                        startTime: hoveredOl.startTime,
                        endTime: hoveredOl.startTime + hoveredOl.duration,
                      });
                    } else if (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === track.id) {
                      const inTimeRange = hoverTime >= hoveredOverLayerRegion.startTime && hoverTime < hoveredOverLayerRegion.endTime;
                      if (!inTimeRange) {
                        setHoveredOverLayerRegion(null);
                      }
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredTrackId(null);
                    setDropPreview(null);
                    setHoveredOverLayerRegion(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectTrack(track.id);
                    selectClip(null);
                    selectTransition(null);
                    // Clicking main track unpins over-layers
                    setPinnedOverLayerTrackId(null);
                    selectOverLayer(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectTrack(track.id);
                    selectClip(null);
                    selectTransition(null);
                    selectOverLayer(null);
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      clipId: '',
                      trackType: track.type,
                      mediaType: track.type === 'video' ? 'video' : track.type === 'audio' ? 'audio' : 'text',
                      trackId: track.id,
                    });
                  }}
                >
                  {/* Faint track type label */}
                  <div className="absolute left-1 top-1 text-[8px] text-[#a0a0a0] opacity-30 uppercase select-none">
                    {track.type}
                  </div>

                  {/* ── Clips ──────────────────────────────────────── */}
                  {track.clips.map((clip) => {
                    const media = getMediaSafe(clip);
                    const colors = track.type === 'audio' ? CLIP_COLORS.audio : (CLIP_COLORS[media.type] || CLIP_COLORS.video);
                    const isSelected = selectedClipIds.includes(clip.id);
                    const width = Math.max(clip.duration * zoomLevel, MIN_CLIP_WIDTH);
                    const left = clip.startTime * zoomLevel;
                    const isDragging = draggingClipId === clip.id;
                    const clipHeight = (track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) - 8;
                    const isVideoWithAudio =
                      media.type === 'video' && media.waveformPeaks && media.waveformPeaks.length > 0;
                    const mainVisualHeight = isVideoWithAudio ? clipHeight - 12 : clipHeight;

                      const clipAnims = clip.animations?.['transform.x'] || [];
                      const keyframeTimes = clipAnims.map((k: any) => k.time).sort((a: any, b: any) => a - b);
                      const overlappingOls = (track.overLayers || []).filter((ol) => {
                        const olEnd = ol.startTime + ol.duration;
                        const clipEnd = clip.startTime + clip.duration;
                        return ol.startTime < clipEnd && olEnd > clip.startTime;
                      });
                      const hasOverLayerOverlap = overlappingOls.length > 0;

                      return (
                        <div
                          key={clip.id}
                          className={`absolute top-1 rounded cursor-pointer group select-none ${colors.bg} border ${
                            hasOverLayerOverlap ? 'border-cyan-400 border-b-2 border-dashed shadow-[0_0_6px_rgba(34,211,238,0.6)] z-10' : colors.border
                          } ${colors.hover} transition-all duration-75 ${
                            isSelected
                              ? activeTool === 'rateStretch'
                                ? 'ring-2 ring-purple-500 shadow-lg z-20 rate-stretch-active'
                                : 'ring-2 ring-white shadow-lg z-20'
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
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectClip(clip.id);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            clipId: clip.id,
                            trackType: track.type,
                            mediaType: track.type === 'audio' ? 'audio' : media.type,
                            trackId: track.id,
                          });
                        }}
                      >

                        {/* ── Transition In Badge ────────────────────── */}
                        {clip.transitionIn && (
                          <div
                            className={`absolute left-0 top-0 bottom-0 bg-purple-600/70 border-r border-purple-400/80 hover:bg-purple-500 hover:border-purple-300 transition-colors z-30 cursor-pointer flex items-center justify-center overflow-hidden ${
                              selectedTransitionClipId === clip.id ? 'ring-2 ring-white bg-purple-500' : ''
                            }`}
                            style={{
                              width: `${Math.min(width, clip.transitionIn.duration * zoomLevel)}px`,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              selectTransition(clip.id);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            title={`${clip.transitionIn.name} Transition (Click to edit)`}
                          >
                            <span className="text-[8px] text-white font-semibold rotate-90 whitespace-nowrap opacity-80 pointer-events-none">
                              {clip.transitionIn.name}
                            </span>
                          </div>
                        )}

                        {/* ── Visual content layer ──────────────────── */}
                        <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
                          {(track.type === 'audio' || media.type === 'audio') ? (
                            <WaveformOverlay
                              media={media}
                              clipId={clip.id}
                              width={width}
                              height={clipHeight}
                            />
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>

                        {/* ── Master Keyframes ────────────────────────── */}
                        {keyframeTimes.length > 0 && (
                          <div className="absolute top-0 left-0 right-0 h-0 z-40 pointer-events-none">
                            {/* Connecting Lines */}
                            {keyframeTimes.length > 1 && keyframeTimes.slice(0, -1).map((t: any, i: number) => {
                              const kf = clipAnims.find((k: any) => Math.abs(k.time - t) < 0.05);
                              if (kf?.holdNext) return null;
                              
                              const nextT = keyframeTimes[i + 1];
                              const width = (nextT - t) * zoomLevel;
                              
                              const isSelected = selectedKeyframeLines.some((l: any) => l.clipId === clip.id && l.time === t);
                              
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
                            {keyframeTimes.map((t: any, i: number) => {
                              const kf = clipAnims.find((k: any) => Math.abs(k.time - t) < 0.05);
                              const prevKf = i > 0 ? clipAnims.find((k: any) => Math.abs(k.time - keyframeTimes[i - 1]) < 0.05) : null;
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
                              onMouseDown={(e) => startResize(e, clip, 'left')}
                              className={`absolute left-0 top-0 bottom-0 w-2.5 cursor-w-resize z-20 transition-colors hover:bg-amber-500/80`}
                              title="Drag to trim start"
                            />
                            <div
                              onMouseDown={(e) => startResize(e, clip, 'right')}
                              className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-e-resize z-20 transition-colors hover:bg-amber-500/80`}
                              title="Drag to trim end"
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
                            {media.type === 'text' && <span className="text-[8px] shrink-0 opacity-70">T</span>}
                            {media.type === 'fx' && <Sparkles className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            <span
                              className={`text-[9px] font-medium truncate drop-shadow-sm ${colors.text}`}
                            >
                              {media.type === 'text' && (clip as any).textSettings?.text
                                ? (clip as any).textSettings.text
                                : media.name}
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
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 bg-black/60 rounded transition-opacity z-30 pointer-events-auto"
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

                  {/* Dotted border indicators at the bottom of the parent track when collapsed */}
                  {!(pinnedOverLayerTrackId === track.id || (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === track.id)) && (track.overLayers || []).map((ol) => {
                    const left = ol.startTime * zoomLevel;
                    const width = ol.duration * zoomLevel;
                    const baseHeight = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
                    return (
                      <div
                        key={`dotted-${ol.id}`}
                        className="absolute h-[2px] border-b-2 border-dotted border-cyan-400/80 pointer-events-none"
                        style={{
                          top: `${baseHeight - 2}px`,
                          left: `${left}px`,
                          width: `${width}px`,
                          zIndex: 45,
                        }}
                      />
                    );
                  })}

                  {/* ── Over Layers ─────────────────────────────────── */}
                  {(pinnedOverLayerTrackId === track.id || (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === track.id)) && (() => {
                    const region = hoveredOverLayerRegion || { trackId: track.id, startTime: 0, endTime: Infinity };
                    const activeOverLayers = (track.overLayers || []).filter((ol) => {
                      return ol.startTime < region.endTime && ol.startTime + ol.duration > region.startTime;
                    });
                    
                    return activeOverLayers.map((ol, index) => {
                      const width = Math.max(ol.duration * zoomLevel, MIN_CLIP_WIDTH);
                      const left = ol.startTime * zoomLevel;
                      const isSelected = selectedOverLayerId === ol.id;
                      const isDragging = dragOverLayerState?.overLayerId === ol.id;
                      
                      // Row offset (starts below base track height)
                      const topOffset = (track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) + index * OVER_LAYER_ROW_HEIGHT + 2;
                      
                      // Media lookup
                      const media = mediaLibrary.find((m) => m.id === ol.mediaId);
                      const bgClass = track.type === 'audio' 
                        ? 'bg-emerald-600/70 border-emerald-500/80 hover:bg-emerald-500/80' 
                        : (media?.type === 'image' 
                          ? 'bg-amber-600/70 border-amber-500/80 hover:bg-amber-400/80' 
                          : 'bg-blue-600/70 border-blue-500/80 hover:bg-blue-400/80');
                      
                      return (
                        <div
                          key={ol.id}
                          className={`absolute rounded cursor-pointer group select-none ${bgClass} border transition-all duration-75 flex items-center justify-between px-2 ${
                            isSelected ? 'ring-2 ring-white shadow-lg z-20' : ''
                          } ${isDragging ? 'opacity-80 brightness-125' : ''}`}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            top: `${topOffset}px`,
                            height: `${OVER_LAYER_ROW_HEIGHT - 4}px`,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (e.button !== 0) return;
                            
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = e.clientX - rect.left;
                            
                            // Left resize handle
                            if (relX < 6) {
                              useEditorStore.getState().startTransaction();
                              setResizeOverLayerState({
                                overLayerId: ol.id,
                                edge: 'left',
                                startX: e.clientX,
                                originalDuration: ol.duration,
                                originalStartTime: ol.startTime,
                              });
                              return;
                            }
                            
                            // Right resize handle
                            if (relX > rect.width - 6) {
                              useEditorStore.getState().startTransaction();
                              setResizeOverLayerState({
                                overLayerId: ol.id,
                                edge: 'right',
                                startX: e.clientX,
                                originalDuration: ol.duration,
                                originalStartTime: ol.startTime,
                              });
                              return;
                            }
                            
                            // Select
                            selectOverLayer(ol.id);
                            selectClip(null);
                            
                            // Drag
                            useEditorStore.getState().startTransaction();
                            setDragOverLayerState({
                              overLayerId: ol.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              originalStartTime: ol.startTime,
                              trackId: track.id,
                            });
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectOverLayer(ol.id);
                            selectClip(null);
                            // Pin this track's over-layers open so they don't collapse
                            setPinnedOverLayerTrackId(track.id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectOverLayer(ol.id);
                            selectClip(null);
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              clipId: ol.id,
                              trackType: track.type,
                              mediaType: media?.type || (track.type === 'audio' ? 'audio' : 'video'),
                              isOverLayer: true,
                              trackId: track.id,
                            });
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 select-none pointer-events-none">
                            {track.type === 'audio' ? (
                              <Music className="w-3 h-3 text-emerald-300" />
                            ) : media?.type === 'image' ? (
                              <Image className="w-3 h-3 text-amber-300" />
                            ) : (
                              <Film className="w-3 h-3 text-blue-300" />
                            )}
                            <span className="text-[10px] text-white font-medium truncate">
                              {media ? media.name : '(Empty Over Layer — Drop Media Here)'}
                            </span>
                          </div>
                          
                          <span className="text-[9px] text-white/50 select-none pointer-events-none">
                            {ol.duration.toFixed(1)}s
                          </span>

                          {/* Resize handles visual */}
                          {!track.locked && (
                            <>
                              <div className="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize group-hover:bg-amber-400/40" />
                              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-e-resize group-hover:bg-amber-400/40" />
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}

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
              );
            })}

              {/* ── Drop preview ──────────────────────────────────────── */}
              {dropPreview && hoveredTrackId && (
                <div
                  className="absolute border-2 border-amber-500/50 border-dashed rounded pointer-events-none z-40 bg-amber-500/5"
                  style={{
                    top: `${getTrackTop(tracks, dropPreview.trackIdx, hoveredOverLayerRegion, pinnedOverLayerTrackId) + 4}px`,
                    left: `${dropPreview.time * zoomLevel}px`,
                    width: `${dropPreview.duration * zoomLevel}px`,
                    height: (tracks[dropPreview.trackIdx]?.type === 'text' || tracks[dropPreview.trackIdx]?.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) - 8,
                  }}
                />
              )}

              {/* Full‑track hover outline */}
              {hoveredTrackId && !dropPreview && (
                <div
                  className="absolute left-0 right-0 border-2 border-amber-500/30 border-dashed pointer-events-none z-40"
                  style={{
                    top: `${getTrackTop(tracks, tracks.findIndex((t) => t.id === hoveredTrackId), hoveredOverLayerRegion, pinnedOverLayerTrackId)}px`,
                    height: getTrackHeight(tracks.find((t) => t.id === hoveredTrackId)!, hoveredOverLayerRegion, pinnedOverLayerTrackId),
                  }}
                />
              )}

              {/* ── Snap line ──────────────────────────────────────────── */}
              {snapLine !== null && (
                <div
                  className="absolute top-0 bottom-0 w-[1.5px] bg-amber-400 z-50 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.8)]"
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

    {/* ── Right-click Context Menu ──────────────────────────────────── */}
    {contextMenu && (
      <div
        className="fixed z-[200] bg-[#2d2d2d] border border-[#4e4e4e] rounded-lg shadow-2xl py-1 min-w-[180px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {contextMenu.isOverLayer ? (
          <>
            <button
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e]"
              onClick={() => {
                splitClip(contextMenu.clipId, currentTime);
                setContextMenu(null);
              }}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-500" />
              Split at Playhead
            </button>
            <button
              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              onClick={() => {
                removeOverLayer(contextMenu.clipId);
                selectOverLayer(null);
                setContextMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Over Layer
            </button>
          </>
        ) : (
          <>
            {/* Add Over Layer — always available for any track when right clicking background or clip */}
            {contextMenu.trackId && (
              <button
                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e]"
                onClick={() => {
                  addOverLayer(contextMenu.trackId!);
                  setContextMenu(null);
                }}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Add Over Layer
              </button>
            )}

            {contextMenu.clipId && (
              <>
                {/* Unlink Audio — only for video clips that are not already unlinked */}
                {contextMenu.mediaType === 'video' && !tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId)?.linkedClipId && (
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      unlinkAudio(contextMenu.clipId);
                      setContextMenu(null);
                    }}
                  >
                    <Unlink2 className="w-3.5 h-3.5 text-emerald-400" />
                    Extract Audio
                  </button>
                )}
                {/* Break Link Connection */}
                {tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId)?.linkedClipId && (
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      breakLinkConnection(contextMenu.clipId);
                      setContextMenu(null);
                    }}
                  >
                    <Unlink2 className="w-3.5 h-3.5 text-red-400" />
                    Break Link Connection
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    splitClip(contextMenu.clipId, currentTime);
                    setContextMenu(null);
                  }}
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  Split at Playhead
                </button>
                <div className="h-px bg-[#3e3e3e] my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    useEditorStore.getState().removeClip(contextMenu.clipId);
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Clip
                </button>
              </>
            )}
          </>
        )}
      </div>
    )}

    {/* ── Marker Context Menu ────────────────────────────────────────── */}
    {markerContextMenu && (() => {
      const marker = markers.find(m => m.id === markerContextMenu.markerId);
      if (!marker) return null;
      return (
        <div
          className="fixed z-[200] bg-[#2d2d2d] border border-[#4e4e4e] rounded-lg shadow-2xl py-2 min-w-[200px] text-white"
          style={{ left: markerContextMenu.x, top: markerContextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 pb-2 text-[10px] text-[#a0a0a0] font-semibold border-b border-[#3e3e3e] mb-1.5 uppercase tracking-wider">
            Edit Marker
          </div>
          {/* Rename Option */}
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
            onClick={() => {
              const newName = prompt('Rename marker:', marker.name);
              if (newName !== null) {
                updateMarker(marker.id, { name: newName });
              }
              setMarkerContextMenu(null);
            }}
          >
            <Edit className="w-3.5 h-3.5 text-amber-400" />
            Rename Marker
          </button>
          
          {/* Color Selection */}
          <div className="px-3 py-1 text-[10px] text-[#a0a0a0] mt-1.5">Color</div>
          <div className="grid grid-cols-6 gap-1 px-3 py-1.5">
            {['#fbbf24', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ffffff'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  updateMarker(marker.id, { color });
                  setMarkerContextMenu(null);
                }}
                className={`w-5 h-5 rounded-full border transition-all ${
                  marker.color === color ? 'border-white scale-110 shadow-md' : 'border-transparent hover:border-white/50'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="h-px bg-[#3e3e3e] my-1.5" />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
            onClick={() => {
              removeMarker(marker.id);
              setMarkerContextMenu(null);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Marker
          </button>
        </div>
      );
    })()}
    </>
  );
}
