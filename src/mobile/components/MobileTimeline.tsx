// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/Timeline.tsx
//   src/timeline/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Video,
  Music,
  Type,
  Sparkles,
  Layers,
  Lock,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { formatCentisecondTime } from '@/timeline';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/types';

const RULER_H = 22;
const TRACK_H = 44;
const THIN_TRACK_H = 30;
const MIN_CLIP_W = 10;
const MIN_DURATION = 0.05;
const PLAYHEAD_HIT_W = 30;

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

/** Pick a ruler tick step so marks are roughly 60–90px apart. */
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

export function MobileTimeline({ onSelectClip }: { onSelectClip: () => void }) {
  const {
    tracks,
    zoomLevel,
    zoomIn,
    zoomOut,
    totalDuration,
    selectedClipId,
    selectClip,
    seek,
    setIsScrubbing,
    moveClip,
    updateClip,
    saveSnapshot,
    mediaLibrary,
  } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      zoomLevel: s.zoomLevel,
      zoomIn: s.zoomIn,
      zoomOut: s.zoomOut,
      totalDuration: s.totalDuration,
      selectedClipId: s.selectedClipId,
      selectClip: s.selectClip,
      seek: s.seek,
      setIsScrubbing: s.setIsScrubbing,
      moveClip: s.moveClip,
      updateClip: s.updateClip,
      saveSnapshot: s.saveSnapshot,
      mediaLibrary: s.mediaLibrary,
    }))
  );

  const currentTime = usePlaybackTime(20);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const [preview, setPreview] = useState<{
    clipId: string;
    startTime: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
  } | null>(null);

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
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return (clientX - rect.left) / zoomLevel;
    },
    [zoomLevel]
  );

  const snapTime = useCallback(
    (t: number, excludeClipId?: string) => {
      const grid = Math.max(0.05, 1 / (zoomLevel / 40));
      let best = Math.max(0, Math.round(t / grid) * grid);
      const candidates: number[] = [0];
      const threshold = 8 / zoomLevel;
      for (const track of tracks) {
        for (const c of track.clips) {
          if (c.id === excludeClipId) continue;
          candidates.push(c.startTime, c.startTime + c.duration);
        }
      }
      let bestDist = Math.abs(t - best);
      for (const cand of candidates) {
        const d = Math.abs(t - cand);
        if (d < threshold && d < bestDist) {
          best = cand;
          bestDist = d;
        }
      }
      return best;
    },
    [zoomLevel, tracks]
  );

  const commitDrag = useCallback(() => {
    const drag = dragRef.current;
    setPreview(null);
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
        updateClip(drag.clipId, {
          startTime: preview.startTime,
          duration: Math.max(MIN_DURATION, preview.duration),
          trimStart: Math.max(0, preview.trimStart),
        });
        saveSnapshot('Trim clip');
      }
    } else if (drag.kind === 'trim-end' && preview) {
      const clip = clipMap.get(drag.clipId);
      if (clip) {
        updateClip(drag.clipId, {
          duration: Math.max(MIN_DURATION, preview.duration),
          trimEnd: Math.max(0, preview.trimEnd),
        });
        saveSnapshot('Trim clip');
      }
    }
  }, [preview, moveClip, saveSnapshot, updateClip, clipMap]);

  const beginScrub = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { kind: 'scrub' };
      setIsScrubbing(true);
      seek(Math.max(0, timeAt(e.clientX)));
    },
    [seek, setIsScrubbing, timeAt]
  );

  // Ruler/track background: scrub with a mouse, let touch scroll the rail.
  const onPointerDownRuler = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return; // native horizontal scroll
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
      const t = Math.max(0, timeAt(e.clientX));

      if (drag.kind === 'scrub') {
        seek(t);
        return;
      }

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
        const speed = clip.speed || 1;
        const newStart = snapTime(t, drag.clipId);
        // Clamp so we never reveal source before trimStart 0 or move before 0s.
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
        return;
      }

      if (drag.kind === 'trim-end') {
        const clip = clipMap.get(drag.clipId);
        if (!clip) return;
        const speed = clip.speed || 1;
        const newEnd = snapTime(t, drag.clipId);
        // Clamp so we never extend past the end of the source (trimEnd 0).
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
        return;
      }
    },
    [timeAt, clipMap, snapTime, seek]
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.kind === 'scrub') setIsScrubbing(false);
    commitDrag();
  }, [commitDrag, setIsScrubbing]);

  // Auto-follow playhead during playback.
  const lastAutoTime = useRef(-1);
  React.useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (Math.abs(currentTime - lastAutoTime.current) > 0.25) {
      lastAutoTime.current = currentTime;
      const px = currentTime * zoomLevel;
      const view = scroller.clientWidth;
      if (px < scroller.scrollLeft + view * 0.15 || px > scroller.scrollLeft + view * 0.85) {
        scroller.scrollLeft = Math.max(0, px - view * 0.3);
      }
    }
  }, [currentTime, zoomLevel]);

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
    <div className="flex h-full min-h-0 flex-col bg-[#141418]">
      {/* Zoom rail */}
      <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-white/10 px-2">
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

      <div className="flex min-h-0 flex-1">
        {/* Track rail */}
        <div className="w-10 shrink-0 border-r border-white/10 bg-[#17171b]">
          <div style={{ height: RULER_H }} className="border-b border-white/10" />
          {tracks.map((t) => (
            <div
              key={t.id}
              style={{ height: trackHeight(t) }}
              className="flex flex-col items-center justify-center gap-0.5 border-b border-white/5 text-white/50"
            >
              {React.createElement(TRACK_ICON[t.type] ?? Layers, { className: 'h-3.5 w-3.5' })}
              {t.locked && <Lock className="h-2.5 w-2.5 text-amber-400" />}
              {t.muted && <VolumeX className="h-2.5 w-2.5 text-rose-400" />}
            </div>
          ))}
          {tracks.length === 0 && (
            <div className="flex h-full items-center justify-center px-1 text-center text-[9px] leading-tight text-white/30">
              No tracks
            </div>
          )}
        </div>

        {/* Scrollable canvas */}
        <div
          ref={scrollRef}
          className="mobile-no-scrollbar flex-1 overflow-x-auto overflow-y-hidden touch-pan-x"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={contentRef}
            className="relative"
            style={{ width: contentWidth, height: '100%' }}
          >
            {/* Ruler */}
            <div
              className="relative border-b border-white/10 bg-[#17171b]"
              style={{ height: RULER_H }}
              onPointerDown={onPointerDownRuler}
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
                  onPointerDown={onPointerDownRuler}
                >
                  {track.clips.map((clip) => {
                    const dc = displayClip(clip);
                    const media = mediaMap.get(clip.mediaId);
                    const isSelected = selectedClipId === clip.id;
                    const left = dc.startTime * zoomLevel;
                    const width = Math.max(MIN_CLIP_W, dc.duration * zoomLevel);
                    const thumb = media?.thumbnail || (media?.frameStrip && media.frameStrip[0]) || undefined;
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
                        {thumb && (
                          <img
                            src={thumb}
                            alt=""
                            draggable={false}
                            className="absolute inset-0 h-full w-full object-cover opacity-70"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
                        <span className="absolute left-1 top-0.5 truncate text-[9px] font-medium leading-tight text-white drop-shadow">
                          {clip.textSettings?.text || media?.name || 'Clip'}
                        </span>
                        <span className="absolute bottom-0.5 left-1 text-[8px] leading-none text-white/70">
                          {formatCentisecondTime(dc.duration)}
                        </span>

                        {/* trim handles on selected clip */}
                        {isSelected && (
                          <>
                            <div
                              className="absolute inset-y-0 left-0 z-10 flex w-[14px] items-center justify-center bg-white/90"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => onPointerDownTrim(e, clip, 'start')}
                            >
                              <div className="h-4 w-1 rounded-full bg-black/40" />
                            </div>
                            <div
                              className="absolute inset-y-0 right-0 z-10 flex w-[14px] items-center justify-center bg-white/90"
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => onPointerDownTrim(e, clip, 'end')}
                            >
                              <div className="h-4 w-1 rounded-full bg-black/40" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {tracks.length === 0 && (
              <div className="flex h-20 items-center justify-center text-[11px] text-white/30">
                Tap “＋ Add” to import media and start editing
              </div>
            )}

            {/* Playhead — draggable scrub handle spanning the full canvas */}
            <div
              className="mobile-playhead absolute top-0 z-40"
              style={{
                left: playheadX - PLAYHEAD_HIT_W / 2,
                width: PLAYHEAD_HIT_W,
                height: '100%',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDownPlayhead}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-amber-400" />
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
