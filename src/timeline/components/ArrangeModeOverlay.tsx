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
  trackLaneMinHeight: number;
}

const SIZE_CONFIGS: Record<ThumbSize, SizeConfig> = {
  small: {
    cardWidth: 112,
    cardHeight: 84,
    thumbHeight: 52,
    nameFontSize: 'text-[10px]',
    durFontSize: 'text-[8px]',
    gapWidth: 68,
    trackLaneMinHeight: 108,
  },
  medium: {
    cardWidth: 154,
    cardHeight: 112,
    thumbHeight: 74,
    nameFontSize: 'text-xs',
    durFontSize: 'text-[9px]',
    gapWidth: 84,
    trackLaneMinHeight: 138,
  },
  large: {
    cardWidth: 204,
    cardHeight: 146,
    thumbHeight: 100,
    nameFontSize: 'text-sm',
    durFontSize: 'text-[10px]',
    gapWidth: 104,
    trackLaneMinHeight: 172,
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
}

function buildSequenceWithGaps(clips: TimelineClip[]): SequenceItem[] {
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  const items: SequenceItem[] = [];
  let lastEnd = 0;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (c.startTime - lastEnd >= 0.05) {
      items.push({ id: `gap-${i}-${lastEnd.toFixed(2)}`, kind: 'gap', gapDuration: c.startTime - lastEnd });
    }
    items.push({ id: c.id, kind: 'clip', clip: c });
    lastEnd = c.startTime + c.duration;
  }
  return items;
}

// ── Gap Card Component ────────────────────────────────────────────────────
const GapCard = React.memo(function GapCard({ duration, sizeConfig }: { duration: number; sizeConfig: SizeConfig }) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/[0.03] text-white/40 select-none"
      style={{ width: sizeConfig.gapWidth, height: sizeConfig.cardHeight }}
      title={`Gap: ${duration.toFixed(2)}s`}
    >
      <Clock className="w-4 h-4 text-white/30 mb-1" />
      <span className="text-[9px] uppercase tracking-wider font-bold text-white/50">Gap</span>
      <span className="text-[10px] font-mono text-amber-400/90 font-semibold tabular-nums mt-0.5">+{duration.toFixed(1)}s</span>
    </div>
  );
});

// ── Drop Slot Indicator ───────────────────────────────────────────────────
const DropSlot = React.memo(function DropSlot({ sizeConfig }: { sizeConfig: SizeConfig }) {
  return (
    <div
      className="flex-shrink-0 rounded-lg border-2 border-dashed border-amber-400 bg-amber-500/25 shadow-[0_0_20px_rgba(251,191,36,0.4)] flex items-center justify-center select-none animate-pulse"
      style={{ width: sizeConfig.cardWidth, height: sizeConfig.cardHeight }}
    >
      <span className="text-xs font-bold text-amber-300 tracking-wider uppercase">Drop Here</span>
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
  clip, media, trackType, isSelected, isDraggingThis, isPreviewPlaying,
  sizeConfig, onPointerDown, onSelect, onPreviewPlay, onPreviewStop,
}: ClipCardProps) {
  const mediaType = media?.type ?? (trackType === 'text' ? 'text' : trackType === 'audio' ? 'audio' : 'video');
  const color = getCardColor(mediaType, trackType);
  const Icon = TRACK_ICON[mediaType] ?? Film;
  const textContent = (clip as any).textSettings?.text;
  const name = (textContent && textContent.trim().length > 0 ? textContent.slice(0, 24) : null) || media?.name || (mediaType === 'text' ? 'Text' : 'Clip');

  return (
    <div
      data-card-id={clip.id}
      className={`group relative flex-shrink-0 rounded-lg border-2 select-none overflow-hidden cursor-grab active:cursor-grabbing shadow-sm ${
        isSelected ? 'border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.6)] ring-1 ring-amber-400/50 scale-[1.02]'
                   : 'border-white/15 hover:border-white/35 hover:shadow-md'
      } ${isDraggingThis ? 'opacity-20 scale-95' : 'opacity-100'}`}
      style={{ width: sizeConfig.cardWidth, height: sizeConfig.cardHeight, background: `${color}22`, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      draggable={false}
    >
      <div className="relative w-full overflow-hidden bg-black/50 flex items-center justify-center pointer-events-none" style={{ height: sizeConfig.thumbHeight }}>
        {media?.thumbnail ? (
          <img src={media.thumbnail} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
        ) : mediaType === 'text' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-purple-950/40">
            <Type className="w-5 h-5 text-purple-400 mb-0.5" />
            <span className="text-[9px] text-purple-200 font-medium truncate max-w-[90%] text-center px-1">{textContent || 'Text'}</span>
          </div>
        ) : mediaType === 'audio' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-emerald-950/40">
            <Music className="w-5 h-5 text-emerald-400 mb-0.5" />
            <span className="text-[9px] text-emerald-200 font-medium truncate max-w-[90%] text-center px-1">{media?.name || 'Audio'}</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Icon className="w-6 h-6 text-white/30" /></div>
        )}
        {isSelected && (
          <button
            className={`absolute bottom-1 right-1 rounded-full p-1.5 z-20 shadow-md pointer-events-auto ${
              isPreviewPlaying ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-black/80 hover:bg-black text-amber-400 hover:scale-110'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); isPreviewPlaying ? onPreviewStop() : onPreviewPlay(); }}
            title={isPreviewPlaying ? 'Stop preview' : 'Preview this clip'}
          >
            {isPreviewPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
          </button>
        )}
      </div>
      <div className="px-2 py-1 flex flex-col justify-center bg-[#14141e] border-t border-white/10 pointer-events-none">
        <span className={`font-semibold text-white/90 truncate leading-tight ${sizeConfig.nameFontSize}`}>{name}</span>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-white/50 font-mono tabular-nums ${sizeConfig.durFontSize}`}>{clip.duration.toFixed(1)}s</span>
          <span className="text-[8px] font-bold uppercase px-1 rounded text-white/80" style={{ background: `${color}55` }}>{mediaType}</span>
        </div>
      </div>
      <div className="absolute top-1 left-1 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-white drop-shadow" />
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
  track, sortedClips, mediaMap, selectedClipId, draggingClipId,
  isOverThisTrack, insertSlotIndex, previewingClipId, sizeConfig,
  onCardPointerDown, onSelectClip, onPreviewPlay, onPreviewStop,
}: LinearTrackRowProps) {
  const isFx = track.type === 'fx';
  const Icon = TRACK_ICON[track.type] ?? Film;
  const sequenceItems = useMemo(() => buildSequenceWithGaps(sortedClips), [sortedClips]);

  return (
    <div
      data-track-row-id={track.id}
      className={`flex-shrink-0 flex flex-col rounded-xl border shadow-md ${
        isOverThisTrack ? 'bg-[#1b1b28] border-amber-400 ring-2 ring-amber-400/40'
                        : 'bg-[#14141d] border-white/10 hover:border-white/20'
      } ${isFx ? 'opacity-60' : 'opacity-100'}`}
    >
      <div className="flex-shrink-0 flex items-center justify-between px-3.5 py-2 bg-[#1b1b26] border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white tracking-wide">{track.name}</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-semibold">{track.type}</span>
          <span className="text-[11px] text-white/40 tabular-nums font-mono">{sortedClips.length} {sortedClips.length === 1 ? 'clip' : 'clips'}</span>
        </div>
        {isFx && <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold"><Lock className="w-3 h-3" /> FX Locked</span>}
      </div>
      <div
        data-track-lane-id={track.id}
        className="flex flex-row flex-nowrap items-center gap-3 p-3 overflow-x-auto overflow-y-hidden select-none mobile-no-scrollbar"
        style={{ minHeight: sizeConfig.trackLaneMinHeight, scrollbarWidth: 'thin' }}
      >
        {isFx ? (
          <div className="flex items-center justify-center w-full py-4 text-xs text-white/40 italic">FX tracks cannot be rearranged</div>
        ) : sortedClips.length === 0 ? (
          <div className="flex items-center gap-2 py-4 px-4 text-xs text-white/40 border-2 border-dashed border-white/10 rounded-lg w-full justify-center min-h-[70px]">
            {isOverThisTrack ? <DropSlot sizeConfig={sizeConfig} /> : <span>Empty Track — Drag clips here</span>}
          </div>
        ) : (
          <>
            {(() => {
              let clipCount = 0;
              const elements: React.ReactNode[] = [];
              for (let i = 0; i < sequenceItems.length; i++) {
                const item = sequenceItems[i];
                if (item.kind === 'gap') {
                  elements.push(<GapCard key={item.id} duration={item.gapDuration || 0} sizeConfig={sizeConfig} />);
                } else if (item.kind === 'clip' && item.clip) {
                  const ci = clipCount++;
                  if (isOverThisTrack && insertSlotIndex === ci) {
                    elements.push(<DropSlot key={`drop-${ci}`} sizeConfig={sizeConfig} />);
                  }
                  const clip = item.clip;
                  const media = mediaMap.get(clip.mediaId) ?? null;
                  elements.push(
                    <ClipCard key={clip.id} clip={clip} media={media} trackType={track.type}
                      isSelected={selectedClipId === clip.id} isDraggingThis={draggingClipId === clip.id}
                      isPreviewPlaying={previewingClipId === clip.id} sizeConfig={sizeConfig}
                      onPointerDown={(e) => onCardPointerDown(e, clip, track.id)}
                      onSelect={() => onSelectClip(clip.id)}
                      onPreviewPlay={() => media && onPreviewPlay(clip, media)} onPreviewStop={onPreviewStop}
                    />
                  );
                }
              }
              if (isOverThisTrack && insertSlotIndex === clipCount) {
                elements.push(<DropSlot key={`drop-end-${clipCount}`} sizeConfig={sizeConfig} />);
              }
              return elements;
            })()}
          </>
        )}
      </div>
    </div>
  );
});

// ── Drag info type ────────────────────────────────────────────────────────
interface DragInfo {
  clipId: string;
  fromTrackId: string;
  mediaType: string;
  clip: TimelineClip;
  startX: number;
  startY: number;
  moved: boolean;
  destTrackId: string | null;
  destSlotIndex: number;
}

// ── Main ArrangeModeOverlay Component ─────────────────────────────────────
export function ArrangeModeOverlay() {
  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const setArrangeMode = useEditorStore((s) => s.setArrangeMode);
  const saveSnapshot = useEditorStore((s) => s.saveSnapshot);
  const seek = useEditorStore((s) => s.seek);
  const pause = useEditorStore((s) => s.pause);

  useEffect(() => { pause(); }, [pause]);

  const [thumbSize, setThumbSize] = useState<ThumbSize>('medium');
  const sizeConfig = SIZE_CONFIGS[thumbSize];

  const [draftTracks, setDraftTracks] = useState<TimelineTrack[]>(() =>
    JSON.parse(JSON.stringify(tracks))
  );

  useEffect(() => { return () => { dispatchClipPreview(null); }; }, []);

  const mediaMap = useMemo(() => new Map(mediaLibrary.map((m) => [m.id, m])), [mediaLibrary]);

  const sortedClipsPerTrack = useMemo(
    () => new Map(draftTracks.map((t) => [t.id, [...(t.clips || [])].sort((a, b) => a.startTime - b.startTime)])),
    [draftTracks]
  );

  // Selection & preview
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [previewingClipId, setPreviewingClipId] = useState<string | null>(null);

  const handlePreviewPlay = useCallback((clip: TimelineClip, media: MediaItem) => {
    setPreviewingClipId(clip.id);
    seek(clip.startTime);
    dispatchClipPreview({ clipId: clip.id, mediaId: media.id, trimStart: clip.trimStart ?? 0, duration: clip.duration, url: media.url });
  }, [seek]);

  const handlePreviewStop = useCallback(() => {
    setPreviewingClipId(null);
    dispatchClipPreview(null);
  }, []);

  useEffect(() => {
    if (previewingClipId && selectedClipId !== previewingClipId) handlePreviewStop();
  }, [selectedClipId, previewingClipId, handlePreviewStop]);

  // ── Drag system ─────────────────────────────────────────────────────────
  const dragRef = useRef<DragInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  // Used to directly mutate proxy position without re-rendering the whole timeline
  const proxyRef = useRef<HTMLDivElement>(null);
  const [hoverTrackId, setHoverTrackId] = useState<string | null>(null);
  const [insertSlotIndex, setInsertSlotIndex] = useState<number | null>(null);

  const hoverTrackIdRef = useRef<string | null>(null);
  const insertSlotIndexRef = useRef<number | null>(null);

  const setHoverTrackIdSafe = useCallback((id: string | null) => {
    hoverTrackIdRef.current = id;
    setHoverTrackId(id);
  }, []);

  const setInsertSlotIndexSafe = useCallback((idx: number | null) => {
    insertSlotIndexRef.current = idx;
    setInsertSlotIndex(idx);
  }, []);

  const draftTracksRef = useRef(draftTracks);
  draftTracksRef.current = draftTracks;
  const sizeConfigRef = useRef(sizeConfig);
  sizeConfigRef.current = sizeConfig;
  const handlePreviewStopRef = useRef(handlePreviewStop);
  handlePreviewStopRef.current = handlePreviewStop;

  const onCardPointerDown = useCallback((e: React.PointerEvent, clip: TimelineClip, trackId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    e.preventDefault();
    e.stopPropagation();

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}

    const currentTracks = draftTracksRef.current;
    const srcTrack = currentTracks.find((t) => t.id === trackId);
    if (srcTrack?.type === 'fx') return;

    const media = mediaMap.get(clip.mediaId);
    const mediaType = media?.type ?? (srcTrack?.type === 'text' ? 'text' : srcTrack?.type === 'audio' ? 'audio' : 'video');

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
    if (proxyRef.current) {
      proxyRef.current.style.transform = `translate(${e.clientX - sizeConfigRef.current.cardWidth / 2}px, ${e.clientY - sizeConfigRef.current.cardHeight / 2}px) rotate(2deg) scale(1.05)`;
    }
  }, [mediaMap]);

  const performHitTest = useCallback((clientX: number, clientY: number, mediaType: string) => {
    if (!containerRef.current || !dragRef.current) return;
    const rows = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-track-row-id]'));
    if (rows.length === 0) return;

    let closestRow: HTMLElement | null = null;
    let minDist = Infinity;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) { closestRow = row; minDist = 0; break; }
      const d = Math.min(Math.abs(clientY - r.top), Math.abs(clientY - r.bottom));
      if (d < minDist) { minDist = d; closestRow = row; }
    }

    if (!closestRow || minDist > 60) {
      dragRef.current.destTrackId = null;
      setHoverTrackIdSafe(null);
      setInsertSlotIndexSafe(null);
      return;
    }

    const trackId = closestRow.getAttribute('data-track-row-id')!;
    const currentTracks = draftTracksRef.current;
    const track = currentTracks.find((t) => t.id === trackId);

    if (!track || track.type === 'fx' || !isCompatible(mediaType, track.type)) {
      dragRef.current.destTrackId = null;
      setHoverTrackIdSafe(null);
      setInsertSlotIndexSafe(null);
      return;
    }

    const trackLane = closestRow.querySelector<HTMLElement>('[data-track-lane-id]');
    if (trackLane) {
      const lr = trackLane.getBoundingClientRect();
      if (clientX < lr.left + 50) trackLane.scrollLeft -= 16;
      else if (clientX > lr.right - 50) trackLane.scrollLeft += 16;
    }

    const allCards = Array.from(closestRow.querySelectorAll<HTMLElement>('[data-card-id]'));
    const drag = dragRef.current;
    const otherCards = allCards.filter(
      (c) => !(c.getAttribute('data-card-id') === drag.clipId && drag.fromTrackId === trackId)
    );

    let slot = 0;
    for (let i = 0; i < otherCards.length; i++) {
      const cr = otherCards[i].getBoundingClientRect();
      let baseMidX = cr.left + cr.width / 2;
      
      // Compensate for DropSlot pushing cards to the right
      if (hoverTrackIdRef.current === trackId && insertSlotIndexRef.current !== null && i >= insertSlotIndexRef.current) {
         // The DropSlot width is cardWidth + gap (approx 12px)
         baseMidX -= (sizeConfigRef.current.cardWidth + 12);
      }
      
      if (clientX < baseMidX) break;
      slot = i + 1;
    }

    drag.destTrackId = trackId;
    drag.destSlotIndex = slot;
    setHoverTrackIdSafe(trackId);
    setInsertSlotIndexSafe(slot);
  }, [setHoverTrackIdSafe, setInsertSlotIndexSafe]);

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);

      if (!drag.moved && (dx > 4 || dy > 4)) {
        drag.moved = true;
        setDraggingClipId(drag.clipId);
        handlePreviewStopRef.current();
      }

      if (!drag.moved) return;

      try { e.preventDefault(); } catch(err) {}

      if (proxyRef.current) {
      proxyRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }

      if (containerRef.current) {
        const cr = containerRef.current.getBoundingClientRect();
        if (e.clientY < cr.top + 40) containerRef.current.scrollTop -= 12;
        else if (e.clientY > cr.bottom - 40) containerRef.current.scrollTop += 12;
      }

      performHitTest(e.clientX, e.clientY, drag.mediaType);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;

      if (!drag) return;
      
      if (!drag.moved || !drag.destTrackId) {
        setDraggingClipId(null);
        setHoverTrackIdSafe(null);
        setInsertSlotIndexSafe(null);
        return;
      }

      const { fromTrackId, destTrackId, destSlotIndex, clipId } = drag;

      setDraggingClipId(null);
      setHoverTrackIdSafe(null);
      setInsertSlotIndexSafe(null);

      setDraftTracks((prev) => {
        const next = prev.map((t) => ({ ...t, clips: [...(t.clips || [])] }));
        const srcTrack = next.find((t) => t.id === fromTrackId);
        const dstTrack = next.find((t) => t.id === destTrackId);
        if (!srcTrack || !dstTrack) return prev;

        const clipIdx = srcTrack.clips.findIndex((c) => c.id === clipId);
        if (clipIdx === -1) return prev;
        const [clip] = srcTrack.clips.splice(clipIdx, 1);

        const updatedClip = destTrackId !== fromTrackId ? { ...clip, trackId: destTrackId } : { ...clip };

        const dstSorted = [...dstTrack.clips].sort((a, b) => a.startTime - b.startTime);
        const clampedSlot = Math.max(0, Math.min(destSlotIndex, dstSorted.length));
        
        // Insert into the array based on visual drop slot
        dstSorted.splice(clampedSlot, 0, updatedClip);

        // Ripple resolve startTimes with Magnetic Collapse
        // We pack the track completely from 0 to ensure predictable reordering without holes
        let cursor = 0;
        for (let i = 0; i < dstSorted.length; i++) {
           const c = dstSorted[i];
           dstSorted[i] = { ...c, startTime: cursor };
           cursor += c.duration;
        }

        dstTrack.clips = dstSorted;
        return next;
      });
    };

    const handleWindowPointerCancel = (e: PointerEvent) => handleWindowPointerUp(e);

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  }, [performHitTest, setHoverTrackIdSafe, setInsertSlotIndexSafe]);

  const handleDone = useCallback(() => {
    handlePreviewStop();
    useEditorStore.setState({ tracks: draftTracksRef.current });
    saveSnapshot('Arrange clips');
    setArrangeMode(false);
  }, [saveSnapshot, setArrangeMode, handlePreviewStop]);

  const handleCancel = useCallback(() => {
    handlePreviewStop();
    setArrangeMode(false);
  }, [setArrangeMode, handlePreviewStop]);

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
      className="absolute inset-0 z-50 bg-[#0c0c11] flex flex-col overflow-hidden text-white select-none"
      style={{ opacity: 1 }}
    >
      {/* ── Top Header Toolbar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#161622] border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs shadow-sm">
            <LayoutGrid className="w-4 h-4" />
            <span>Arrange Mode</span>
          </div>
          <span className="hidden md:inline text-xs text-white/60">Drag cards to reorder • Gaps shown • Select to preview</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg border border-white/10">
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/50 mr-1" />
          <span className="text-[10px] text-white/60 uppercase font-bold mr-1">SIZE:</span>
          {(['small', 'medium', 'large'] as ThumbSize[]).map((size) => (
            <button key={size} onClick={() => setThumbSize(size)}
              className={`px-3 py-0.5 rounded text-xs font-semibold capitalize transition-all ${
                thumbSize === size ? 'bg-amber-400 text-black shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >{size}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 active:scale-95 font-medium">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button onClick={handleDone} className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-black font-bold bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md active:scale-95">
            <Check className="w-4 h-4" /> Done
          </button>
        </div>
      </div>

      {/* ── Main Track Lanes Container ─────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 flex flex-col gap-3.5 bg-[#0c0c11] min-h-0"
        style={{ scrollbarWidth: 'thin' }}
        onClick={() => setSelectedClipId(null)}
      >
        {draftTracks.map((track) => (
          <LinearTrackRow key={track.id} track={track}
            sortedClips={sortedClipsPerTrack.get(track.id) ?? []}
            mediaMap={mediaMap} selectedClipId={selectedClipId} draggingClipId={draggingClipId}
            isOverThisTrack={hoverTrackId === track.id}
            insertSlotIndex={hoverTrackId === track.id ? insertSlotIndex : null}
            previewingClipId={previewingClipId} sizeConfig={sizeConfig}
            onCardPointerDown={onCardPointerDown}
            onSelectClip={(id) => {
              setSelectedClipId(id);
              const c = draftTracks.flatMap((t) => t.clips).find((cl) => cl.id === id);
              if (c) seek(c.startTime);
            }}
            onPreviewPlay={handlePreviewPlay} onPreviewStop={handlePreviewStop}
          />
        ))}
        {draftTracks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-white/30 text-sm gap-2">
            <LayoutGrid className="w-8 h-8 opacity-30" />
            <span>No tracks found in timeline</span>
          </div>
        )}
      </div>

      {/* ── Floating Drag Proxy ─────────────────────────────────────────── */}
      {draggingClip && (
        <div
          ref={proxyRef}
          className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-lg shadow-2xl border-2 border-amber-400 bg-[#161622] flex flex-col overflow-hidden"
          style={{
            width: sizeConfig.cardWidth,
            height: sizeConfig.cardHeight,
            transformOrigin: 'center center',
            // Pre-apply rotation and scale to the translate
            transform: dragRef.current ? `translate(${dragRef.current.startX - sizeConfig.cardWidth / 2}px, ${dragRef.current.startY - sizeConfig.cardHeight / 2}px) rotate(2deg) scale(1.05)` : 'none',
            opacity: 0.95,
          }}
        >
          <div className="w-full bg-black/60 flex items-center justify-center overflow-hidden" style={{ height: sizeConfig.thumbHeight }}>
            {draggingMedia?.thumbnail ? (
              <img src={draggingMedia.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : <Film className="w-6 h-6 text-amber-400" />}
          </div>
          <div className="p-1.5 bg-[#161622] flex flex-col justify-center border-t border-white/10">
            <span className={`font-bold text-white truncate ${sizeConfig.nameFontSize}`}>{draggingMedia?.name || 'Clip'}</span>
            <span className={`text-amber-400 font-mono font-semibold ${sizeConfig.durFontSize}`}>{draggingClip.duration.toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
