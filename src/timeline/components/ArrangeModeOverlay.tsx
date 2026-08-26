// -----------------------------------------------------------------------------
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobileTimeline.tsx (uses this same component)
// -----------------------------------------------------------------------------

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  LayoutGrid,
  Check,
  X,
  Film,
  Music,
  Type,
  Sparkles,
  Image as ImageIcon,
  Play,
  Square,
  GripVertical,
  Lock,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineTrack, TimelineClip, MediaItem } from '@/types';

// ── Thumbnail size presets ────────────────────────────────────────────────
type ThumbSize = 'small' | 'medium' | 'large';

interface SizeConfig {
  cardWidth: number;
  cardHeight: number;
  thumbHeight: number;
  nameFontSize: string;
  durFontSize: string;
  gapWidth: number;
}

const SIZE_CONFIGS: Record<ThumbSize, SizeConfig> = {
  small: {
    cardWidth: 104,
    cardHeight: 76,
    thumbHeight: 46,
    nameFontSize: 'text-[9px]',
    durFontSize: 'text-[8px]',
    gapWidth: 70,
  },
  medium: {
    cardWidth: 144,
    cardHeight: 106,
    thumbHeight: 68,
    nameFontSize: 'text-[11px]',
    durFontSize: 'text-[9px]',
    gapWidth: 90,
  },
  large: {
    cardWidth: 196,
    cardHeight: 140,
    thumbHeight: 94,
    nameFontSize: 'text-xs',
    durFontSize: 'text-[10px]',
    gapWidth: 110,
  },
};

// ── Track compatibility rules ─────────────────────────────────────────────
function isCompatible(mediaType: string, targetTrackType: string): boolean {
  if (targetTrackType === 'fx') return false;
  switch (mediaType) {
    case 'audio': return targetTrackType === 'audio';
    case 'text':  return targetTrackType === 'text';
    case 'video': return targetTrackType === 'video' || targetTrackType === 'adjustment';
    case 'image': return targetTrackType === 'video' || targetTrackType === 'adjustment';
    default: return false;
  }
}

// ── Re-pack clips contiguously ────────────────────────────────────────────
function repackTrack(clips: TimelineClip[]): TimelineClip[] {
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  let cursor = 0;
  return sorted.map((clip) => {
    const updated = { ...clip, startTime: cursor };
    cursor += clip.duration;
    return updated;
  });
}

// ── Track icon mapping ────────────────────────────────────────────────────
const TRACK_ICON: Record<string, React.ElementType> = {
  video: Film,
  audio: Music,
  text: Type,
  fx: Sparkles,
  image: ImageIcon,
  adjustment: Sparkles,
};

function getCardColor(mediaType: string, trackType: string): string {
  if (trackType === 'audio' || mediaType === 'audio') return '#059669';
  if (mediaType === 'text') return '#8b5cf6';
  if (mediaType === 'image') return '#d97706';
  if (mediaType === 'video') return '#2563eb';
  if (mediaType === 'fx') return '#f43f5e';
  return '#4b5563';
}

function dispatchClipPreview(
  payload: { clipId: string; mediaId: string; trimStart: number; duration: number; url: string } | null
) {
  window.dispatchEvent(new CustomEvent('procut-arrange-preview', { detail: payload }));
}

// ── Timeline items representation (clips + gaps) ─────────────────────────
interface SequenceItem {
  id: string;
  kind: 'clip' | 'gap';
  clip?: TimelineClip;
  gapDuration?: number;
  gapStart?: number;
}

function buildSequenceWithGaps(clips: TimelineClip[]): SequenceItem[] {
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  const items: SequenceItem[] = [];

  let lastEnd = 0;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    // If there is a decent gap (>= 0.1s) before this clip
    if (c.startTime - lastEnd >= 0.1) {
      items.push({
        id: `gap-${i}-${lastEnd.toFixed(2)}`,
        kind: 'gap',
        gapDuration: c.startTime - lastEnd,
        gapStart: lastEnd,
      });
    }
    items.push({
      id: c.id,
      kind: 'clip',
      clip: c,
    });
    lastEnd = c.startTime + c.duration;
  }

  return items;
}

// ── Gap Card Component ────────────────────────────────────────────────────
const GapCard = React.memo(function GapCard({
  duration,
  sizeConfig,
}: {
  duration: number;
  sizeConfig: SizeConfig;
}) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/15 bg-white/[0.02] text-white/40 select-none transition-all duration-150"
      style={{
        width: sizeConfig.gapWidth,
        height: sizeConfig.cardHeight,
      }}
      title={`Gap: ${duration.toFixed(2)}s`}
    >
      <Clock className="w-4 h-4 text-white/30 mb-1" />
      <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50">Gap</span>
      <span className="text-[10px] font-mono text-amber-400/80 font-medium tabular-nums">
        {duration.toFixed(1)}s
      </span>
    </div>
  );
});

// ── Drop Slot Indicator (Shifting Space) ──────────────────────────────────
const DropSlot = React.memo(function DropSlot({
  sizeConfig,
}: {
  sizeConfig: SizeConfig;
}) {
  return (
    <div
      className="flex-shrink-0 rounded-lg border-2 border-dashed border-amber-400 bg-amber-500/20 shadow-[0_0_16px_rgba(251,191,36,0.3)] flex flex-col items-center justify-center select-none transition-all duration-200 ease-out animate-pulse"
      style={{
        width: sizeConfig.cardWidth,
        height: sizeConfig.cardHeight,
      }}
    >
      <span className="text-[11px] font-bold text-amber-300 tracking-wide">Place Here</span>
    </div>
  );
});

// ── Clip Card Component ───────────────────────────────────────────────────
interface ClipCardProps {
  clip: TimelineClip;
  media: MediaItem | null;
  trackType: string;
  isSelected: boolean;
  isDraggingThis: boolean;
  isPreviewPlaying: boolean;
  sizeConfig: SizeConfig;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onPreviewPlay: () => void;
  onPreviewStop: () => void;
}

const ClipCard = React.memo(function ClipCard({
  clip,
  media,
  trackType,
  isSelected,
  isDraggingThis,
  isPreviewPlaying,
  sizeConfig,
  onPointerDown,
  onSelect,
  onPreviewPlay,
  onPreviewStop,
}: ClipCardProps) {
  const mediaType = media?.type ?? 'video';
  const color = getCardColor(mediaType, trackType);
  const Icon = TRACK_ICON[mediaType] ?? Film;
  const name =
    ((clip as any).textSettings?.text ?? '').slice(0, 24) ||
    media?.name ||
    'Clip';

  return (
    <div
      data-card-id={clip.id}
      className={`group relative flex-shrink-0 rounded-lg border-2 select-none transition-all duration-150 overflow-hidden cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.6)] ring-1 ring-amber-400/50 scale-[1.02]'
          : 'border-white/10 hover:border-white/30 hover:shadow-md'
      } ${isDraggingThis ? 'opacity-20 scale-95' : 'opacity-100'}`}
      style={{
        width: sizeConfig.cardWidth,
        height: sizeConfig.cardHeight,
        background: `${color}26`,
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative w-full overflow-hidden bg-black/40 flex items-center justify-center"
        style={{ height: sizeConfig.thumbHeight }}
      >
        {media?.thumbnail ? (
          <img
            src={media.thumbnail}
            alt=""
            draggable={false}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <Icon className="w-7 h-7 text-white/30" />
        )}

        {/* Play/Stop preview button */}
        {isSelected && (
          <button
            className={`absolute bottom-1 right-1 rounded-full p-1.5 transition-all z-20 shadow-md ${
              isPreviewPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-black/80 hover:bg-black text-amber-400 hover:scale-110'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (isPreviewPlaying) onPreviewStop();
              else onPreviewPlay();
            }}
            title={isPreviewPlaying ? 'Stop preview' : 'Preview this clip'}
          >
            {isPreviewPlaying ? (
              <Square className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current ml-0.5" />
            )}
          </button>
        )}
      </div>

      {/* Label and duration bar */}
      <div className="px-2 py-1 flex flex-col justify-center bg-[#13131a]/90 backdrop-blur-sm border-t border-white/5">
        <span
          className={`font-semibold text-white/90 truncate leading-tight ${sizeConfig.nameFontSize}`}
        >
          {name}
        </span>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-white/40 font-mono tabular-nums ${sizeConfig.durFontSize}`}>
            {clip.duration.toFixed(1)}s
          </span>
          <span
            className="text-[8px] font-bold uppercase px-1 py-0.2 rounded text-white/70"
            style={{ background: `${color}55` }}
          >
            {mediaType}
          </span>
        </div>
      </div>

      {/* Drag handle */}
      <div className="absolute top-1 left-1 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3 text-white drop-shadow" />
      </div>
    </div>
  );
});

// ── Linear Horizontal Track Row Component ─────────────────────────────────
interface LinearTrackRowProps {
  track: TimelineTrack;
  sortedClips: TimelineClip[];
  mediaMap: Map<string, MediaItem>;
  selectedClipId: string | null;
  draggingClipId: string | null;
  isOverThisTrack: boolean;
  insertSlotIndex: number | null;
  previewingClipId: string | null;
  sizeConfig: SizeConfig;
  onCardPointerDown: (e: React.PointerEvent, clip: TimelineClip, trackId: string) => void;
  onSelectClip: (clipId: string) => void;
  onPreviewPlay: (clip: TimelineClip, media: MediaItem) => void;
  onPreviewStop: () => void;
}

const LinearTrackRow = React.memo(function LinearTrackRow({
  track,
  sortedClips,
  mediaMap,
  selectedClipId,
  draggingClipId,
  isOverThisTrack,
  insertSlotIndex,
  previewingClipId,
  sizeConfig,
  onCardPointerDown,
  onSelectClip,
  onPreviewPlay,
  onPreviewStop,
}: LinearTrackRowProps) {
  const isFx = track.type === 'fx';
  const Icon = TRACK_ICON[track.type] ?? Film;

  const sequenceItems = useMemo(
    () => buildSequenceWithGaps(sortedClips),
    [sortedClips]
  );

  return (
    <div
      data-track-row-id={track.id}
      className={`flex flex-col rounded-xl border transition-all duration-150 overflow-hidden shadow-sm ${
        isOverThisTrack
          ? 'bg-[#1b1b26] border-amber-400 ring-2 ring-amber-400/40'
          : 'bg-[#15151c] border-white/10 hover:border-white/20'
      } ${isFx ? 'opacity-60' : 'opacity-100'}`}
    >
      {/* Pinned Track Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1c1c27] border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-white/90 tracking-wide">{track.name}</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60">
            {track.type}
          </span>
          <span className="text-[10px] text-white/40 tabular-nums font-mono">
            {sortedClips.length} {sortedClips.length === 1 ? 'clip' : 'clips'}
          </span>
        </div>
        {isFx && (
          <span className="text-[9px] text-rose-400 flex items-center gap-1 font-medium">
            <Lock className="w-2.5 h-2.5" /> FX Locked
          </span>
        )}
      </div>

      {/* Linear Horizontal Scrollable Strip */}
      <div
        data-track-lane-id={track.id}
        className="flex flex-row flex-nowrap items-center gap-2.5 p-3 overflow-x-auto overflow-y-hidden select-none min-h-[96px] mobile-no-scrollbar"
        style={{ scrollbarWidth: 'thin' }}
      >
        {isFx ? (
          <div className="flex items-center justify-center w-full py-4 text-xs text-white/30 italic">
            FX tracks cannot be rearranged
          </div>
        ) : sortedClips.length === 0 ? (
          <div className="flex items-center gap-2 py-4 px-3 text-xs text-white/30 border-2 border-dashed border-white/5 rounded-lg w-full justify-center">
            {isOverThisTrack ? (
              <DropSlot sizeConfig={sizeConfig} />
            ) : (
              <span>Empty Track — Drag clips here</span>
            )}
          </div>
        ) : (
          <>
            {(() => {
              // We render sequence with potential dynamic drop slot insertion
              let clipCount = 0;
              const renderedElements = [];

              for (let i = 0; i < sequenceItems.length; i++) {
                const item = sequenceItems[i];

                if (item.kind === 'gap') {
                  renderedElements.push(
                    <GapCard
                      key={item.id}
                      duration={item.gapDuration || 0}
                      sizeConfig={sizeConfig}
                    />
                  );
                } else if (item.kind === 'clip' && item.clip) {
                  const currentClipIndex = clipCount;
                  clipCount++;

                  // If drag is hovering right before this clip slot
                  if (isOverThisTrack && insertSlotIndex === currentClipIndex) {
                    renderedElements.push(
                      <DropSlot key={`drop-slot-${currentClipIndex}`} sizeConfig={sizeConfig} />
                    );
                  }

                  const media = mediaMap.get(item.clip.mediaId) ?? null;
                  renderedElements.push(
                    <ClipCard
                      key={item.clip.id}
                      clip={item.clip}
                      media={media}
                      trackType={track.type}
                      isSelected={selectedClipId === item.clip.id}
                      isDraggingThis={draggingClipId === item.clip.id}
                      isPreviewPlaying={previewingClipId === item.clip.id}
                      sizeConfig={sizeConfig}
                      onPointerDown={(e) => onCardPointerDown(e, item.clip, track.id)}
                      onSelect={() => onSelectClip(item.clip.id)}
                      onPreviewPlay={() => media && onPreviewPlay(item.clip, media)}
                      onPreviewStop={onPreviewStop}
                    />
                  );
                }
              }

              // Trailing drop slot if dropping at the end of track
              if (isOverThisTrack && insertSlotIndex === clipCount) {
                renderedElements.push(
                  <DropSlot key={`drop-slot-end-${clipCount}`} sizeConfig={sizeConfig} />
                );
              }

              return renderedElements;
            })()}
          </>
        )}
      </div>
    </div>
  );
});

// ── Main ArrangeModeOverlay Component ─────────────────────────────────────
export function ArrangeModeOverlay() {
  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const setArrangeMode = useEditorStore((s) => s.setArrangeMode);
  const saveSnapshot = useEditorStore((s) => s.saveSnapshot);
  const seek = useEditorStore((s) => s.seek);
  const pause = useEditorStore((s) => s.pause);

  // Pause playback when Arrange Mode opens
  useEffect(() => {
    pause();
  }, [pause]);

  // Thumbnail size control state
  const [thumbSize, setThumbSize] = useState<ThumbSize>('medium');
  const sizeConfig = SIZE_CONFIGS[thumbSize];

  // Local draft state — only committed on "Done"
  const [draftTracks, setDraftTracks] = useState<TimelineTrack[]>(() =>
    JSON.parse(JSON.stringify(tracks))
  );

  // Reset preview on unmount
  useEffect(() => {
    return () => {
      dispatchClipPreview(null);
    };
  }, []);

  const mediaMap = useMemo(
    () => new Map(mediaLibrary.map((m) => [m.id, m])),
    [mediaLibrary]
  );

  const sortedClipsPerTrack = useMemo(
    () =>
      new Map(
        draftTracks.map((t) => [
          t.id,
          [...(t.clips || [])].sort((a, b) => a.startTime - b.startTime),
        ])
      ),
    [draftTracks]
  );

  // Selection & preview
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [previewingClipId, setPreviewingClipId] = useState<string | null>(null);

  const handlePreviewPlay = useCallback(
    (clip: TimelineClip, media: MediaItem) => {
      setPreviewingClipId(clip.id);
      seek(clip.startTime);
      dispatchClipPreview({
        clipId: clip.id,
        mediaId: media.id,
        trimStart: clip.trimStart ?? 0,
        duration: clip.duration,
        url: media.url,
      });
    },
    [seek]
  );

  const handlePreviewStop = useCallback(() => {
    setPreviewingClipId(null);
    dispatchClipPreview(null);
  }, []);

  useEffect(() => {
    if (previewingClipId && selectedClipId !== previewingClipId) {
      handlePreviewStop();
    }
  }, [selectedClipId, previewingClipId, handlePreviewStop]);

  // ── Drag & Dynamic Shift System ──────────────────────────────────────────
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverTrackId, setHoverTrackId] = useState<string | null>(null);
  const [insertSlotIndex, setInsertSlotIndex] = useState<number | null>(null);

  const dragRef = useRef<{
    clipId: string;
    fromTrackId: string;
    mediaType: string;
    clip: TimelineClip;
    startX: number;
    startY: number;
    moved: boolean;
    destTrackId: string | null;
    destSlotIndex: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Global hit-test to find target track row and horizontal slot index
  const updateHitTest = useCallback(
    (clientX: number, clientY: number, mediaType: string) => {
      if (!containerRef.current) return;
      const rows = containerRef.current.querySelectorAll<HTMLElement>('[data-track-row-id]');

      let targetRow: HTMLElement | null = null;
      for (const row of Array.from(rows)) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          targetRow = row;
          break;
        }
      }

      if (!targetRow) {
        setHoverTrackId(null);
        setInsertSlotIndex(null);
        if (dragRef.current) dragRef.current.destTrackId = null;
        return;
      }

      const trackId = targetRow.getAttribute('data-track-row-id')!;
      const track = draftTracks.find((t) => t.id === trackId);

      if (!track || track.type === 'fx' || !isCompatible(mediaType, track.type)) {
        setHoverTrackId(null);
        setInsertSlotIndex(null);
        if (dragRef.current) dragRef.current.destTrackId = null;
        return;
      }

      // Calculate horizontal slot index within the linear strip
      const cards = targetRow.querySelectorAll<HTMLElement>('[data-card-id]');
      let slot = 0;
      for (const card of Array.from(cards)) {
        // Skip comparing against the dragged card itself if in same track
        const cardId = card.getAttribute('data-card-id');
        if (cardId === dragRef.current?.clipId && dragRef.current?.fromTrackId === trackId) {
          continue;
        }
        const cardRect = card.getBoundingClientRect();
        const midX = cardRect.left + cardRect.width / 2;
        if (clientX < midX) {
          break;
        }
        slot++;
      }

      setHoverTrackId(trackId);
      setInsertSlotIndex(slot);
      if (dragRef.current) {
        dragRef.current.destTrackId = trackId;
        dragRef.current.destSlotIndex = slot;
      }
    },
    [draftTracks]
  );

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent, clip: TimelineClip, trackId: string) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();

      const srcTrack = draftTracks.find((t) => t.id === trackId);
      if (srcTrack?.type === 'fx') return;

      const media = mediaMap.get(clip.mediaId);
      const mediaType = media?.type ?? 'video';

      dragRef.current = {
        clipId: clip.id,
        fromTrackId: trackId,
        mediaType,
        clip,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        destTrackId: null,
        destSlotIndex: 0,
      };

      setDragPointerPos({ x: e.clientX, y: e.clientY });
    },
    [draftTracks, mediaMap]
  );

  // Global window pointer move & up listeners for ultra smooth dragging
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);

      if (!drag.moved && (dx > 4 || dy > 4)) {
        drag.moved = true;
        setDraggingClipId(drag.clipId);
        handlePreviewStop();
      }

      if (drag.moved) {
        setDragPointerPos({ x: e.clientX, y: e.clientY });
        updateHitTest(e.clientX, e.clientY, drag.mediaType);
      }
    };

    const handleWindowPointerUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;

      setDraggingClipId(null);
      setHoverTrackId(null);
      setInsertSlotIndex(null);

      if (!drag || !drag.moved || !drag.destTrackId) return;

      const { fromTrackId, destTrackId, destSlotIndex, clipId } = drag;

      setDraftTracks((prev) => {
        const next = prev.map((t) => ({ ...t, clips: [...t.clips] }));
        const srcTrack = next.find((t) => t.id === fromTrackId);
        const dstTrack = next.find((t) => t.id === destTrackId);
        if (!srcTrack || !dstTrack) return prev;

        const clipIdx = srcTrack.clips.findIndex((c) => c.id === clipId);
        if (clipIdx === -1) return prev;
        const [clip] = srcTrack.clips.splice(clipIdx, 1);

        const updatedClip =
          destTrackId !== fromTrackId ? { ...clip, trackId: destTrackId } : clip;

        const dstSorted = [...dstTrack.clips].sort((a, b) => a.startTime - b.startTime);
        const clampedSlot = Math.max(0, Math.min(destSlotIndex, dstSorted.length));
        dstSorted.splice(clampedSlot, 0, updatedClip);

        dstTrack.clips = repackTrack(dstSorted);
        srcTrack.clips = repackTrack(srcTrack.clips);

        return next;
      });
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [updateHitTest, handlePreviewStop]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDone = useCallback(() => {
    handlePreviewStop();
    useEditorStore.setState({ tracks: draftTracks });
    saveSnapshot('Arrange clips');
    setArrangeMode(false);
  }, [draftTracks, saveSnapshot, setArrangeMode, handlePreviewStop]);

  const handleCancel = useCallback(() => {
    handlePreviewStop();
    setArrangeMode(false);
  }, [setArrangeMode, handlePreviewStop]);

  // Dragged clip preview card info
  const draggingClip = useMemo(() => {
    if (!draggingClipId) return null;
    for (const t of draftTracks) {
      const c = t.clips.find((x) => x.id === draggingClipId);
      if (c) return c;
    }
    return null;
  }, [draggingClipId, draftTracks]);

  const draggingMedia = draggingClip ? mediaMap.get(draggingClip.mediaId) ?? null : null;

  return (
    <div
      className="absolute inset-0 z-50 bg-[#0f0f13] flex flex-col overflow-hidden text-white select-none"
      style={{ opacity: 1 }}
    >
      {/* ── Top Header Toolbar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-[#181822] border-b border-white/10 shadow-md">
        {/* Title & Help */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs shadow-sm">
            <LayoutGrid className="w-4 h-4" />
            <span>Arrange Mode</span>
          </div>
          <span className="hidden md:inline text-[11px] text-white/50">
            Linear horizontal view • Drag cards to reorder • Gap values displayed • Select to preview
          </span>
        </div>

        {/* Center: Thumbnail Size Controls */}
        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/40 mr-1" />
          <span className="text-[10px] text-white/50 uppercase font-semibold mr-1">Size:</span>
          {(['small', 'medium', 'large'] as ThumbSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setThumbSize(size)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium capitalize transition-all ${
                thumbSize === size
                  ? 'bg-amber-500 text-black font-bold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 active:scale-95"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-black font-bold bg-amber-400 hover:bg-amber-300 rounded-lg transition-all shadow-md active:scale-95"
          >
            <Check className="w-3.5 h-3.5" /> Done
          </button>
        </div>
      </div>

      {/* ── Main Track Lanes Container (Vertically scrollable) ─────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 flex flex-col gap-3.5 bg-[#0f0f13]"
        onClick={() => setSelectedClipId(null)}
      >
        {draftTracks.map((track) => (
          <LinearTrackRow
            key={track.id}
            track={track}
            sortedClips={sortedClipsPerTrack.get(track.id) ?? []}
            mediaMap={mediaMap}
            selectedClipId={selectedClipId}
            draggingClipId={draggingClipId}
            isOverThisTrack={hoverTrackId === track.id}
            insertSlotIndex={hoverTrackId === track.id ? insertSlotIndex : null}
            previewingClipId={previewingClipId}
            sizeConfig={sizeConfig}
            onCardPointerDown={onCardPointerDown}
            onSelectClip={(id) => {
              setSelectedClipId(id);
              const c = draftTracks.flatMap((t) => t.clips).find((cl) => cl.id === id);
              if (c) seek(c.startTime);
            }}
            onPreviewPlay={handlePreviewPlay}
            onPreviewStop={handlePreviewStop}
          />
        ))}

        {draftTracks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-white/30 text-sm gap-2">
            <LayoutGrid className="w-8 h-8 opacity-30" />
            <span>No tracks found in timeline</span>
          </div>
        )}
      </div>

      {/* ── Floating Drag Proxy (Following cursor) ─────────────────────── */}
      {draggingClip && (
        <div
          className="fixed pointer-events-none z-[9999] rounded-lg shadow-2xl border-2 border-amber-400 bg-[#161622] rotate-2 scale-105 opacity-95 flex flex-col overflow-hidden transition-transform duration-75"
          style={{
            left: dragPointerPos.x - sizeConfig.cardWidth / 2,
            top: dragPointerPos.y - sizeConfig.cardHeight / 2,
            width: sizeConfig.cardWidth,
            height: sizeConfig.cardHeight,
          }}
        >
          <div
            className="w-full bg-black/60 flex items-center justify-center overflow-hidden"
            style={{ height: sizeConfig.thumbHeight }}
          >
            {draggingMedia?.thumbnail ? (
              <img
                src={draggingMedia.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div className="p-1.5 bg-[#181824] flex flex-col justify-center">
            <span className={`font-semibold text-white truncate ${sizeConfig.nameFontSize}`}>
              {draggingMedia?.name || 'Clip'}
            </span>
            <span className={`text-amber-400/80 font-mono ${sizeConfig.durFontSize}`}>
              {draggingClip.duration.toFixed(1)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
