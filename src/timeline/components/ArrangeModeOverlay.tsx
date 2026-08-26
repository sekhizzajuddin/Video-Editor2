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
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineTrack, TimelineClip, MediaItem } from '@/types';

// -- Track compatibility rules ---------------------------------------------
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

// -- Re-pack clips in a track contiguously (no time gaps) ------------------
function repackTrack(clips: TimelineClip[]): TimelineClip[] {
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  let cursor = 0;
  return sorted.map((clip) => {
    const updated = { ...clip, startTime: cursor };
    cursor += clip.duration;
    return updated;
  });
}

// -- Track icon mapping ----------------------------------------------------
const TRACK_ICON: Record<string, React.ElementType> = {
  video: Film, audio: Music, text: Type, fx: Sparkles, image: ImageIcon, adjustment: Sparkles,
};

function getCardColor(mediaType: string, trackType: string): string {
  if (trackType === 'audio' || mediaType === 'audio') return '#059669';
  if (mediaType === 'text') return '#8b5cf6';
  if (mediaType === 'image') return '#d97706';
  if (mediaType === 'video') return '#2563eb';
  if (mediaType === 'fx') return '#f43f5e';
  return '#3f3f46';
}

function dispatchClipPreview(
  payload: { clipId: string; mediaId: string; trimStart: number; duration: number; url: string } | null
) {
  window.dispatchEvent(new CustomEvent('procut-arrange-preview', { detail: payload }));
}

// -- Card component --------------------------------------------------------
interface ClipCardProps {
  clip: TimelineClip;
  media: MediaItem | null;
  trackType: string;
  isSelected: boolean;
  isDragging: boolean;
  isPreviewPlaying: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onPreviewPlay: () => void;
  onPreviewStop: () => void;
}

const ClipCard = React.memo(function ClipCard({
  clip, media, trackType, isSelected, isDragging, isPreviewPlaying,
  onPointerDown, onSelect, onPreviewPlay, onPreviewStop,
}: ClipCardProps) {
  const mediaType = media?.type ?? 'video';
  const color = getCardColor(mediaType, trackType);
  const Icon = TRACK_ICON[mediaType] ?? Film;
  const name = (clip as any).textSettings?.text || media?.name || 'Clip';

  return (
    <div
      data-card-id={clip.id}
      className={`relative flex-shrink-0 w-28 rounded-lg border-2 cursor-grab select-none transition-all duration-100 overflow-hidden touch-none ${
        isSelected
          ? 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-[1.02]'
          : 'border-white/10 hover:border-white/30'
      } ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}`}
      style={{ background: `${color}22`, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Thumbnail area */}
      <div className="relative h-16 w-full overflow-hidden" style={{ background: `${color}44` }}>
        {media?.thumbnail ? (
          <img src={media.thumbnail} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-6 h-6 text-white/40" />
          </div>
        )}
        {/* Play/Stop preview button — visible when selected */}
        {isSelected && media?.url && (
          <button
            className={`absolute bottom-1 right-1 rounded-full p-1 transition-colors z-10 ${
              isPreviewPlaying ? 'bg-red-500 hover:bg-red-400' : 'bg-black/70 hover:bg-black/90'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); isPreviewPlaying ? onPreviewStop() : onPreviewPlay(); }}
            title={isPreviewPlaying ? 'Stop preview' : 'Preview this clip'}
          >
            {isPreviewPlaying
              ? <Square className="w-2.5 h-2.5 text-white" />
              : <Play className="w-2.5 h-2.5 text-white" />}
          </button>
        )}
      </div>
      {/* Label */}
      <div className="px-1.5 py-1 flex flex-col gap-0.5">
        <span className="text-[9px] font-semibold text-white/90 truncate leading-tight">{name}</span>
        <span className="text-[8px] text-white/40 tabular-nums">{clip.duration.toFixed(1)}s</span>
      </div>
      <div className="absolute top-1 left-1 pointer-events-none opacity-30">
        <GripVertical className="w-2.5 h-2.5 text-white" />
      </div>
    </div>
  );
});

function DropGap({ active }: { active: boolean }) {
  return (
    <div
      className={`flex-shrink-0 transition-all duration-150 rounded-lg ${
        active ? 'w-28 bg-amber-400/20 border-2 border-dashed border-amber-400/60' : 'w-1.5'
      }`}
      style={{ minHeight: '108px' }}
    />
  );
}

// -- Track Row -------------------------------------------------------------
interface TrackRowProps {
  track: TimelineTrack;
  sortedClips: TimelineClip[];
  mediaMap: Map<string, MediaItem>;
  selectedClipId: string | null;
  draggingClipId: string | null;
  overTrackId: string | null;
  overSlotIndex: number | null;
  previewingClipId: string | null;
  onCardPointerDown: (e: React.PointerEvent, clip: TimelineClip, trackId: string) => void;
  onSelectClip: (clipId: string) => void;
  onPreviewPlay: (clip: TimelineClip, media: MediaItem) => void;
  onPreviewStop: () => void;
}

function TrackRow({
  track, sortedClips, mediaMap, selectedClipId, draggingClipId,
  overTrackId, overSlotIndex, previewingClipId,
  onCardPointerDown, onSelectClip, onPreviewPlay, onPreviewStop,
}: TrackRowProps) {
  const isFx = track.type === 'fx';
  const Icon = TRACK_ICON[track.type] ?? Film;
  const isDropTarget = overTrackId === track.id;

  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-xl transition-all duration-150 ${
        isDropTarget ? 'bg-amber-500/10 ring-1 ring-amber-400/40' : 'bg-white/[0.03] hover:bg-white/[0.05]'
      } ${isFx ? 'opacity-50' : ''}`}
      data-track-id={track.id}
    >
      {/* Track label */}
      <div className="flex-shrink-0 w-20 flex flex-col items-start gap-1 pt-1">
        <div className="flex items-center gap-1">
          <Icon className="w-3 h-3 text-white/50" />
          <span className="text-[9px] font-semibold text-white/60 uppercase tracking-wide truncate max-w-[60px]">
            {track.name}
          </span>
        </div>
        {isFx && (
          <span className="text-[8px] text-rose-400/70 flex items-center gap-0.5">
            <Lock className="w-2 h-2" /> FX locked
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex items-center gap-1 flex-wrap min-h-[108px] flex-1">
        {isFx ? (
          <span className="text-[10px] text-white/30 italic py-4">FX tracks cannot be rearranged</span>
        ) : (
          <>
            {sortedClips.map((clip, idx) => {
              const media = mediaMap.get(clip.mediaId) ?? null;
              return (
                <React.Fragment key={clip.id}>
                  <DropGap active={isDropTarget && overSlotIndex === idx} />
                  <ClipCard
                    clip={clip}
                    media={media}
                    trackType={track.type}
                    isSelected={selectedClipId === clip.id}
                    isDragging={draggingClipId === clip.id}
                    isPreviewPlaying={previewingClipId === clip.id}
                    onPointerDown={(e) => onCardPointerDown(e, clip, track.id)}
                    onSelect={() => onSelectClip(clip.id)}
                    onPreviewPlay={() => media && onPreviewPlay(clip, media)}
                    onPreviewStop={onPreviewStop}
                  />
                </React.Fragment>
              );
            })}
            <DropGap active={isDropTarget && (overSlotIndex === sortedClips.length || sortedClips.length === 0)} />
          </>
        )}
      </div>
    </div>
  );
}

// -- ArrangeModeOverlay (main) ─────────────────────────────────────────────
export function ArrangeModeOverlay() {
  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const setArrangeMode = useEditorStore((s) => s.setArrangeMode);
  const saveSnapshot = useEditorStore((s) => s.saveSnapshot);
  const seek = useEditorStore((s) => s.seek);
  // FIX #1: Pause playback when Arrange Mode opens to prevent conflicts with clip preview
  const pause = useEditorStore((s) => s.pause);
  useEffect(() => { pause(); }, [pause]);

  const [draftTracks, setDraftTracks] = useState<TimelineTrack[]>(() => JSON.parse(JSON.stringify(tracks)));

  // FIX #2: Cleanup — send null on unmount so PreviewCanvas resets to normal mode
  useEffect(() => { return () => { dispatchClipPreview(null); }; }, []);

  const mediaMap = useMemo(
    () => new Map(mediaLibrary.map((m) => [m.id, m])),
    [mediaLibrary]
  );

  const sortedClipsPerTrack = useMemo(
    () => new Map(draftTracks.map((t) => [
      t.id,
      [...(t.clips || [])].sort((a, b) => a.startTime - b.startTime),
    ])),
    [draftTracks]
  );

  // Selection & preview
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [previewingClipId, setPreviewingClipId] = useState<string | null>(null);

  const handlePreviewPlay = useCallback((clip: TimelineClip, media: MediaItem) => {
    setPreviewingClipId(clip.id);
    seek(clip.startTime);
    dispatchClipPreview({
      clipId: clip.id,
      mediaId: media.id,
      trimStart: clip.trimStart ?? 0,
      duration: clip.duration,
      url: media.url,
    });
  }, [seek]);

  const handlePreviewStop = useCallback(() => {
    setPreviewingClipId(null);
    dispatchClipPreview(null);
  }, []);

  useEffect(() => {
    if (previewingClipId && selectedClipId !== previewingClipId) {
      handlePreviewStop();
    }
  }, [selectedClipId, previewingClipId, handlePreviewStop]);

  // FIX #3: store dest inside dragRef — onPointerUp reads from ref, not stale state
  const dragRef = useRef<{
    clipId: string; fromTrackId: string; mediaType: string;
    startX: number; startY: number; moved: boolean;
    destTrackId: string | null; destSlotIndex: number;
  } | null>(null);

  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [overTrackId, setOverTrackId] = useState<string | null>(null);
  const [overSlotIndex, setOverSlotIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getHit = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rows = containerRef.current.querySelectorAll<HTMLElement>('[data-track-id]');
    for (const row of Array.from(rows)) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const trackId = row.getAttribute('data-track-id')!;
        const cards = row.querySelectorAll<HTMLElement>('[data-card-id]');
        let slotIndex = 0;
        for (const card of Array.from(cards)) {
          // FIX #4: call getBoundingClientRect once per card to avoid double layout thrash
          const cr = card.getBoundingClientRect();
          if (clientX < cr.left + cr.width / 2) break;
          slotIndex++;
        }
        return { trackId, slotIndex };
      }
    }
    return null;
  }, []);

  const onCardPointerDown = useCallback((e: React.PointerEvent, clip: TimelineClip, trackId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    const srcTrack = draftTracks.find((t) => t.id === trackId);
    if (srcTrack?.type === 'fx') return;
    const media = mediaMap.get(clip.mediaId);
    dragRef.current = {
      clipId: clip.id,
      fromTrackId: trackId,
      mediaType: media?.type ?? 'video',
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      // FIX #3: track drop destination in the ref itself
      destTrackId: null,
      destSlotIndex: 0,
    };
  }, [draftTracks, mediaMap]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = Math.abs(e.clientX - drag.startX);
    const dy = Math.abs(e.clientY - drag.startY);
    if (!drag.moved && dx < 5 && dy < 5) return;
    if (!drag.moved) { drag.moved = true; setDraggingClipId(drag.clipId); }
    const hit = getHit(e.clientX, e.clientY);
    if (hit) {
      const targetTrack = draftTracks.find((t) => t.id === hit.trackId);
      if (targetTrack && targetTrack.type !== 'fx' && isCompatible(drag.mediaType, targetTrack.type)) {
        // FIX #3: write into ref so onPointerUp always gets latest value (no stale closure)
        drag.destTrackId = hit.trackId;
        drag.destSlotIndex = hit.slotIndex;
        setOverTrackId(hit.trackId);
        setOverSlotIndex(hit.slotIndex);
      } else {
        drag.destTrackId = null;
        setOverTrackId(null); setOverSlotIndex(null);
      }
    } else {
      drag.destTrackId = null;
      setOverTrackId(null); setOverSlotIndex(null);
    }
  }, [getHit, draftTracks]);

  // FIX #3: Read dest from dragRef — NOT from React state — so we never get stale values.
  // Empty dep array is intentional: all mutable values come from the ref.
  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingClipId(null);
    setOverTrackId(null); setOverSlotIndex(null);
    if (!drag || !drag.moved || !drag.destTrackId) return;
    const destTrackId = drag.destTrackId;
    const destSlotIndex = drag.destSlotIndex;

    setDraftTracks((prev) => {
      const next = prev.map((t) => ({ ...t, clips: [...t.clips] }));
      const srcTrack = next.find((t) => t.id === drag.fromTrackId);
      const dstTrack = next.find((t) => t.id === destTrackId);
      if (!srcTrack || !dstTrack) return prev;
      const clipIdx = srcTrack.clips.findIndex((c) => c.id === drag.clipId);
      if (clipIdx === -1) return prev;
      const [clip] = srcTrack.clips.splice(clipIdx, 1);
      const updatedClip = destTrackId !== drag.fromTrackId ? { ...clip, trackId: destTrackId } : clip;
      const dstSorted = [...dstTrack.clips].sort((a, b) => a.startTime - b.startTime);
      // FIX #5: clamp with Math.max(0,...) in case same-track reorder reduced length
      const insertAt = Math.max(0, Math.min(destSlotIndex, dstSorted.length));
      dstSorted.splice(insertAt, 0, updatedClip);
      dstTrack.clips = dstSorted;
      srcTrack.clips = repackTrack(srcTrack.clips);
      dstTrack.clips = repackTrack(dstTrack.clips);
      return next;
    });
  }, []); // intentionally empty — reads all mutable data from dragRef

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

  return (
    <div
      className="absolute inset-0 z-30 bg-[#16161c]/98 flex flex-col overflow-hidden"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#1a1a22]">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Arrange Mode</span>
          <span className="hidden sm:block text-[10px] text-white/40 ml-1">
            Drag cards to reorder · Move clips to compatible tracks · Select a clip and press ? to preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white font-semibold bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors shadow-md"
          >
            <Check className="w-3 h-3" /> Done
          </button>
        </div>
      </div>

      {/* Track rows */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-2"
        onClick={() => setSelectedClipId(null)}
      >
        {draftTracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            sortedClips={sortedClipsPerTrack.get(track.id) ?? []}
            mediaMap={mediaMap}
            selectedClipId={selectedClipId}
            draggingClipId={draggingClipId}
            overTrackId={overTrackId}
            overSlotIndex={overSlotIndex}
            previewingClipId={previewingClipId}
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
          <div className="flex-1 flex items-center justify-center">
            <span className="text-white/30 text-sm">No tracks to arrange</span>
          </div>
        )}
      </div>
    </div>
  );
}
