import React, { useMemo, useRef, useEffect } from 'react';
import { Film, Music, Image, Sparkles, Type, Plus, Zap } from 'lucide-react';
import { getKineticClipLabel, isKineticMediaId } from '@/utils/kineticSync';
import { getSpeedFrameSegments } from '@/utils/speedRamp';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineTrack, TimelineClip, MediaItem, EditorState, PipWindow } from '@/types';
import { getTrackHeight } from '../trackGeometry';

import {
  CLIP_COLORS,
  DEFAULT_TRACK_HEIGHT,
  THIN_TRACK_HEIGHT,
  OVER_LAYER_ROW_HEIGHT,
  MIN_CLIP_WIDTH,
} from '../timelineConstants';
import { FrameStripOverlay } from './FrameStripOverlay';
import { WaveformOverlay } from './WaveformOverlay';
import { TransitionTarget } from './TransitionTarget';

// Module-level stable fallback descriptor (PERF: was recreated per render with
// a fresh `createdAt: Date.now()`, defeating shallow comparisons).
const defaultMedia: MediaItem = {
  id: '',
  name: 'Unknown',
  type: 'video' as const,
  duration: 30,
  url: '',
  createdAt: 0,
};

// Stable empty array reference so clipPipWindows doesn't break React.memo equality
const EMPTY_PIP_ARRAY: PipWindow[] = [];

const VIDEO_WAVEFORM_HEIGHT = 18;
const inFlightWaveformProbes = new Set<string>();
const failedWaveformProbes = new Map<string, { count: number; lastFailed: number }>();

// Listen for refresh events to clear failed probe cache
if (typeof window !== 'undefined') {
  window.addEventListener('procut-clear-failed-waveform-probe', ((e: CustomEvent) => {
    const mediaId = e.detail?.mediaId;
    if (mediaId) failedWaveformProbes.delete(mediaId);
    else failedWaveformProbes.clear();
  }) as EventListener);
}

/** Check if waveform peaks contain any audible (non-zero) data. */
function hasAudiblePeaks(peaks: number[] | undefined): boolean {
  if (!peaks || peaks.length === 0) return false;
  // Quick scan: at least one peak must exceed a minimal threshold (0.005)
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > 0.005) return true;
  }
  return false;
}

interface TimelineClipRowProps {
  track: TimelineTrack;
  zoomLevel: number;
  selectedClipIds: string[];
  draggingClipId: string | null;

  activeTool: string;
  hoverCutClipId: string | null;
  hoverCutX: number | null;
  
  // Handlers
  handleDragOver: (e: React.DragEvent, trackId: string) => void;
  handleDrop: (e: React.DragEvent, trackId: string) => void;
  setHoveredTrackId: (id: string | null) => void;
  setDropPreview: (val: any) => void;

  setContextMenu: (val: any) => void;
  handleClipMouseDown: (e: React.PointerEvent, clip: TimelineClip) => void;
  setHoverCutX: (val: number | null) => void;
  setHoverCutClipId: (val: string | null) => void;
  enterCompoundClip: (clipId: string) => void;
  toggleKeyframeLineSelection: (clipId: string, time: number, isMulti: boolean) => void;
  selectedKeyframeLines: { clipId: string; time: number }[];
  showTransitionLayer: boolean;
  selectedTransitionClipId: string | null;
  hoveredTrackId: string | null;
  selectTrack: (trackId: string | null) => void;
  selectClip: (clipId: string | null) => void;
  selectTransition: (clipId: string | null) => void;

}

interface TimelineClipItemProps {
  clip: TimelineClip;
  media: MediaItem;
  trackType: string;
  trackLocked: boolean;
  zoomLevel: number;
  isSelected: boolean;
  isDragging: boolean;
  // Trim handles are ONLY rendered on the single selected clip so neighbouring
  // clips never show a trim cursor / grab area while another clip is being
  // trimmed (multi-selection disables trimming entirely).
  showTrimHandles: boolean;
  selectedTransitionClipId: string | null;
  activeTool: string;
  hoverCutClipId: string | null;
  hoverCutX: number | null;
  selectedKeyframeLines: { clipId: string; time: number }[];
  hasOverlap: boolean;
  clipPipWindows: PipWindow[];
  isVirtualVisible?: boolean;
  
  // Handlers
  handleClipMouseDown: (e: React.PointerEvent, clip: TimelineClip) => void;
  selectClip: (id: string | null) => void;
  selectTransition: (id: string | null) => void;
  setContextMenu: (val: any) => void;
  setHoverCutX: (val: number | null) => void;
  setHoverCutClipId: (val: string | null) => void;
  enterCompoundClip: (clipId: string) => void;
  toggleKeyframeLineSelection: (clipId: string, time: number, isMulti: boolean) => void;
}

const TimelineClipItem = React.memo(function TimelineClipItem({
  clip,
  media,
  trackType,
  trackLocked,
  zoomLevel,
  isSelected,
  isDragging,
  showTrimHandles,
  selectedTransitionClipId,
  activeTool,
  hoverCutClipId,
  hoverCutX,
  selectedKeyframeLines,
  hasOverlap,
  clipPipWindows,
  isVirtualVisible = true,
  
  handleClipMouseDown,
  selectClip,
  selectTransition,
  setContextMenu,
  setHoverCutX,
  setHoverCutClipId,
  enterCompoundClip,
  toggleKeyframeLineSelection,
}: TimelineClipItemProps) {
  const colors = trackType === 'audio' ? CLIP_COLORS.audio : (CLIP_COLORS[media.type] || CLIP_COLORS.video);
  // P3 FIX: NaN guards — Math.max(NaN, 16) === NaN made the width style invalid
  // (element collapses) and NaN left positions render broken.
  const width = Math.max(
    Number.isFinite(clip.duration) && Number.isFinite(zoomLevel) ? clip.duration * zoomLevel : MIN_CLIP_WIDTH,
    MIN_CLIP_WIDTH
  );
  const left = Number.isFinite(clip.startTime) && Number.isFinite(zoomLevel) ? clip.startTime * zoomLevel : 0;
  const clipHeight = (trackType === 'text' || trackType === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) - 8;
  const failedProbeInfo = failedWaveformProbes.get(media.id);
  const isVideoWithAudio =
    media.type === 'video' &&
    (hasAudiblePeaks(media.waveformPeaks) ||
      (media.waveformPeaks === undefined && (failedProbeInfo?.count || 0) < 3));
  const mainVisualHeight = isVideoWithAudio ? Math.max(16, clipHeight - VIDEO_WAVEFORM_HEIGHT) : clipHeight;

  // Auto-probe waveform for video and audio clips that have not yet extracted waveform peaks,
  // or whose peaks are all zeros (silent extraction from a previous attempt).
  const needsWaveformProbe =
    (media.type === 'video' || media.type === 'audio') &&
    !hasAudiblePeaks(media.waveformPeaks) &&
    media.url &&
    !media.url.startsWith('PENDING_') &&
    !inFlightWaveformProbes.has(media.id) &&
    ((failedProbeInfo?.count || 0) < 3 || Date.now() - (failedProbeInfo?.lastFailed || 0) > 15000);

  useEffect(() => {
    if (!needsWaveformProbe || !isVirtualVisible) return;
    inFlightWaveformProbes.add(media.id);
    import('@/utils/mediaProbe')
      .then(({ extractWaveformFromUrl }) =>
        extractWaveformFromUrl(media.url, undefined, { hintDuration: media.duration, mediaId: media.id })
      )
      .then((peaks) => {
        if (peaks && peaks.length > 0 && peaks.some((p) => p > 0.005)) {
          (useEditorStore.getState() as any).setMediaWaveformPeaks?.(media.id, peaks);
          failedWaveformProbes.delete(media.id);
        } else {
          // Video has no audible audio — record failure count
          const prev = failedWaveformProbes.get(media.id)?.count || 0;
          failedWaveformProbes.set(media.id, { count: prev + 1, lastFailed: Date.now() });
        }
      })
      .catch(() => {
        // Video may not have audio track — record failure count
        const prev = failedWaveformProbes.get(media.id)?.count || 0;
        failedWaveformProbes.set(media.id, { count: prev + 1, lastFailed: Date.now() });
      })
      .finally(() => {
        inFlightWaveformProbes.delete(media.id);
      });
  }, [needsWaveformProbe, isVirtualVisible, media.id, media.url, media.duration]);

  const clipAnims = (clip.animations?.['audio.volume'] && clip.animations['audio.volume'].length > 0)
    ? clip.animations['audio.volume']
    : (clip.animations?.['transform.x'] || []);
  const keyframeTimes = clipAnims.map((k: any) => k.time).sort((a: any, b: any) => a - b);

  const dragHandlersRef = useRef<{move: (e: any) => void, up: () => void, cancelRaf?: () => void} | null>(null);
  const lastCutMoveRef = useRef<number>(0);

  // Scoped selector: only re-render this clip when its own speed frame is selected/deselected
  const selectedSpeedFrameId = useEditorStore(
    (s) => (s.selectedSpeedFrame?.clipId === clip.id ? s.selectedSpeedFrame.frameId : null)
  );
  const addSpeedFrame = useEditorStore((s) => s.addSpeedFrame);
  const selectSpeedFrame = useEditorStore((s) => s.selectSpeedFrame);
  const updateSpeedFrameLine = useEditorStore((s) => s.updateSpeedFrameLine);
  const updateSpeedFrameScrew = useEditorStore((s) => s.updateSpeedFrameScrew);
  const commitSpeedFrameDrag = useEditorStore((s) => s.commitSpeedFrameDrag);
  const removeSpeedFrame = useEditorStore((s) => s.removeSpeedFrame);

  const speedSegments = useMemo(() => {
    if (!clip.speedFrames || clip.speedFrames.length === 0) return [];
    return getSpeedFrameSegments(clip, media.duration);
  }, [clip.speedFrames, clip.duration, clip.trimStart, clip.trimEnd, clip.speed, media.duration]);

  const handleLineMouseDown = (e: React.PointerEvent, frameId: string, currentOffset: number) => {
    e.stopPropagation();
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* capture unsupported */ }
    selectSpeedFrame(clip.id, frameId);

    const startX = e.clientX;
    const startOffset = currentOffset;
    let rafId: number | null = null;
    let latestOffset = currentOffset;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      latestOffset = startOffset + deltaX / zoomLevel;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateSpeedFrameLine(clip.id, frameId, latestOffset);
        });
      }
    };

    const onPointerUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        updateSpeedFrameLine(clip.id, frameId, latestOffset);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dragHandlersRef.current = null;
      commitSpeedFrameDrag();
    };

    dragHandlersRef.current = {
      move: onPointerMove as any,
      up: onPointerUp as any,
      cancelRaf: () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleScrewMouseDown = (e: React.PointerEvent, frameId: string, currentOffset: number) => {
    e.stopPropagation();
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* capture unsupported */ }
    selectSpeedFrame(clip.id, frameId);

    const startX = e.clientX;
    const startOffset = currentOffset;
    let rafId: number | null = null;
    let latestOffset = currentOffset;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      latestOffset = startOffset + deltaX / zoomLevel;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateSpeedFrameScrew(clip.id, frameId, latestOffset);
        });
      }
    };

    const onPointerUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        updateSpeedFrameScrew(clip.id, frameId, latestOffset);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dragHandlersRef.current = null;
      commitSpeedFrameDrag();
    };

    dragHandlersRef.current = {
      move: onPointerMove as any,
      up: onPointerUp as any,
      cancelRaf: () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
  

  useEffect(() => {
    return () => {
      const h = dragHandlersRef.current;
      if (h) {
        h.cancelRaf?.();
        window.removeEventListener('pointermove', h.move);
        window.removeEventListener('pointerup', h.up);
        // P1 FIX: keyframe drags attach MOUSE events (mousemove/mouseup) while
        // speed-frame drags attach POINTER events — remove both, otherwise the
        // unmount cleanup removed nothing for keyframes (listeners leaked).
        window.removeEventListener('mousemove', h.move);
        window.removeEventListener('mouseup', h.up);
      }
    };
  }, []);

  return (
    <div
      className={`absolute top-1 rounded cursor-pointer group select-none ${colors.bg} border ${colors.border} ${colors.hover} ${
        isSelected
          ? activeTool === 'rateStretch'
            ? 'ring-2 ring-purple-500 shadow-lg z-20 rate-stretch-active'
            : 'ring-2 ring-white shadow-lg z-20'
          : 'hover:brightness-110'
      } ${trackLocked ? 'opacity-50' : ''} ${isDragging ? 'opacity-80 brightness-125 procut-clip-dragging' : ''}`}
      style={{ left: `${left}px`, width: `${width}px`, height: clipHeight, touchAction: 'none' }}
      onPointerDown={(e) => handleClipMouseDown(e, clip)}
      onMouseMove={(e) => {
        if (activeTool === 'split') {
          const now = performance.now();
          if (now - (lastCutMoveRef.current || 0) < 32) return;
          lastCutMoveRef.current = now;
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverCutX(e.clientX - rect.left);
          setHoverCutClipId(clip.id);
        }
      }}
      onMouseLeave={() => {
        if (activeTool === 'split') {
          lastCutMoveRef.current = 0;
          setHoverCutX(null);
          setHoverCutClipId(null);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) return;
        selectClip(clip.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
        const rect = e.currentTarget.getBoundingClientRect();
        const clickOffsetPx = e.clientX - rect.left;
        const clickTime = Math.max(
          clip.startTime,
          Math.min(clip.startTime + clip.duration, clip.startTime + clickOffsetPx / zoomLevel)
        );
        useEditorStore.getState().seek(clickTime);
        window.dispatchEvent(new Event('procut-frame-updated'));
        if (media.type === 'compound') {
          enterCompoundClip(clip.id);
        }
      }}
      onContextMenu={(e) => {
        if (isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        selectClip(clip.id);
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          clipId: clip.id,
          trackType: trackType,
          mediaType: trackType === 'audio' ? 'audio' : media.type,
          trackId: clip.trackId,
        });
      }}
    >
      {/* ── Transition In Badge ────────────────────── */}
      {clip.transitionIn && (
        <div
          className={`absolute left-0 top-0 bottom-0 bg-purple-600/70 border-r border-purple-400/80 hover:bg-purple-500 hover:border-purple-300 transition-colors z-50 cursor-pointer flex items-center justify-center overflow-hidden ${
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

      {/* ── Visual content layer (virtualized for low RAM / GPU memory) ── */}
      <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
        {isVirtualVisible ? (
          (trackType === 'audio' || media.type === 'audio') ? (
            <WaveformOverlay
              media={media}
              clipId={clip.id}
              width={width}
              height={clipHeight}
              color="rgba(255,255,255,1)"
              trimStart={clip.trimStart}
              clipDuration={clip.duration}
              speed={clip.speed}
              speedFrameSegments={speedSegments}
            />
          ) : (
            <>
              {media.type === 'video' && (
                <div style={{ height: mainVisualHeight }} className="relative">
                  <FrameStripOverlay
                    media={media}
                    clip={clip}
                    width={width}
                    height={mainVisualHeight}
                    speedFrameSegments={speedSegments}
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

              {isVideoWithAudio && (
                <div
                  className="relative overflow-hidden border-t border-white/10 bg-black/40 shadow-inner"
                  style={{ height: VIDEO_WAVEFORM_HEIGHT }}
                >
                  <WaveformOverlay
                    media={media}
                    clipId={clip.id}
                    width={width}
                    height={VIDEO_WAVEFORM_HEIGHT}
                    small
                    color="rgba(219, 234, 254, 0.95)"
                    trimStart={clip.trimStart}
                    clipDuration={clip.duration}
                    speed={clip.speed}
                    speedFrameSegments={speedSegments}
                  />
                </div>
              )}
            </>
          )
        ) : (
          <div className="w-full h-full opacity-10 bg-white/5" />
        )}
      </div>

      {/* ── Resize Handles (only on the single selected clip) ──────────── */}
      {showTrimHandles && !trackLocked && (
        <>
          <div 
            className="absolute left-0 top-0 bottom-0 w-[12px] bg-amber-500/40 hover:bg-amber-500/80 cursor-ew-resize z-50 flex items-center justify-center" 
            data-edge="left"
            onPointerDown={(e) => { e.stopPropagation(); handleClipMouseDown(e, clip); }}
          >
            <div className="w-[2px] h-4 bg-white rounded-full shadow pointer-events-none" />
          </div>
          <div 
            className="absolute right-0 top-0 bottom-0 w-[12px] bg-amber-500/40 hover:bg-amber-500/80 cursor-ew-resize z-50 flex items-center justify-center" 
            data-edge="right"
            onPointerDown={(e) => { e.stopPropagation(); handleClipMouseDown(e, clip); }}
          >
            <div className="w-[2px] h-4 bg-white rounded-full shadow pointer-events-none" />
          </div>
        </>
      )}



      {/* ── Master Keyframes ────────────────────────── */}
      {keyframeTimes.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0 z-40 pointer-events-none">
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
          
          {keyframeTimes.map((t: any, i: number) => {
            const kf = clipAnims.find((k: any) => Math.abs(k.time - t) < 0.05);
            const prevKf = i > 0 ? clipAnims.find((k: any) => Math.abs(k.time - keyframeTimes[i - 1]) < 0.05) : null;
            const isStartEnd = i === 0 || i === keyframeTimes.length - 1 || kf?.holdNext || prevKf?.holdNext;
            return (
              <div
                key={t}
                onPointerDown={(e) => {
                  // P3 FIX: keyframe diamonds use onMouseDown, but pointerdown fires
                  // FIRST and bubbles up to the clip's onPointerDown — starting a clip
                  // move/trim drag while the user drags a keyframe. Stop the bubbling
                  // pointerdown here (the mouse drag below is unaffected).
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  useEditorStore.getState().startTransaction();
                  const startX = e.clientX;
                  let currentTimeMark = t;
                  
                  const minTime = i > 0 ? keyframeTimes[i - 1] + 0.05 : 0;
                  const maxTime = i < keyframeTimes.length - 1 ? keyframeTimes[i + 1] - 0.05 : clip.duration;

                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    let newTime = t + deltaX / zoomLevel;
                    newTime = Math.max(minTime, Math.min(newTime, maxTime));
                    if (Math.abs(newTime - currentTimeMark) > 0.01) {
                      useEditorStore.getState().moveMasterKeyframe(clip.id, currentTimeMark, newTime);
                      currentTimeMark = newTime;
                    }
                  };
                  const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    dragHandlersRef.current = null;
                    useEditorStore.getState().saveSnapshot('Move Keyframe');
                    useEditorStore.getState().endTransaction();
                  };
                  dragHandlersRef.current = { move: onMouseMove, up: onMouseUp };
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



      {/* ── Clip label overlay ────────────────────── */}
      <div className="absolute inset-0 flex flex-col px-1.5 py-0.5 overflow-hidden z-10 pointer-events-none">
        <div className="flex items-center gap-1 min-w-0 pr-8">
          {media.type === 'video' && <Film className="w-2.5 h-2.5 shrink-0 opacity-70" />}
          {media.type === 'audio' && <Music className="w-2.5 h-2.5 shrink-0 opacity-70" />}
          {media.type === 'image' && <Image className="w-2.5 h-2.5 shrink-0 opacity-70" />}
          {media.type === 'text' && <span className="text-[8px] shrink-0 opacity-70">T</span>}
          {media.type === 'fx' && <Sparkles className="w-2.5 h-2.5 shrink-0 opacity-70" />}
          <span
            className={`text-[9px] font-medium drop-shadow-sm ${colors.text} ${media.type === 'text' ? 'animate-text-slide' : 'truncate'}`}
            style={media.type === 'text' ? { '--marquee-width': `${width}px` } as any : undefined}
            title={media.type === 'text' && (clip as any).textSettings?.text ? (clip as any).textSettings.text : media.name}
          >
            {media.type === 'text' && (clip as any).textSettings?.text
              ? (clip as any).textSettings.text
              : media.name}
          </span>
        </div>
        {clip.pipWindowIds && clip.pipWindowIds.length > 0 && (
          <div
            className="absolute top-0.5 right-0.5 bg-purple-600/90 text-white text-[8px]
                       px-1 py-0.5 rounded-sm font-bold tracking-wider z-10 cursor-pointer
                       hover:bg-purple-500 transition-colors pointer-events-auto shadow-md"
            title={`${clip.pipWindowIds.length} PIP window(s) (Click to open)`}
            onClick={(e) => {
              e.stopPropagation();
              useEditorStore.getState().setActivePipWindow(clip.pipWindowIds![0]);
            }}
          >
            PIP
          </div>
        )}
        <div className="absolute bottom-0.5 right-1 flex items-center gap-1 text-[8px] text-white/50 tabular-nums select-none">
          {clip.speed !== 1.0 && (
            <span className="bg-blue-500/20 text-blue-300 px-1 py-px rounded-sm font-semibold">{(clip?.speed ?? 1).toFixed(1)}x</span>
          )}
          <span>{(Math.max(0.1, clip?.duration ?? 0.1)).toFixed(1)}s</span>
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

      {/* ── Overlap warning ────────────────────────── */}
      {hasOverlap && (
        <div
          className="absolute top-0 left-0 w-full h-1 bg-red-500/80 animate-pulse"
          title="Overlap detected"
        />
      )}
      {/* 🔹 Diamond Markers for PIP Windows */}
      {clipPipWindows && clipPipWindows.length > 0 && (
        <div className="absolute -bottom-1.5 left-0 right-0 h-0 z-50 pointer-events-none">
          {clipPipWindows.map((pip, idx) => {
            if (!pip) return null;
            const relX = (pip.relativeStartTime || 0) * zoomLevel;
            return (
              <div 
                key={pip.id || `pip-fallback-${idx}`}
                className="absolute w-3 h-3 bg-cyan-400 border border-cyan-200 rotate-45 shadow-[0_0_8px_rgba(34,211,238,0.8)] pointer-events-auto cursor-pointer hover:bg-cyan-300 transition-colors"
                style={{ left: `${relX - 6}px`, top: '-6px' }}
                title="PIP Window (Click to open)"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  useEditorStore.getState().setActivePipWindow(pip.id);
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Embedded Speed Frames (Dynamic Rate-Stretching) ────────── */}
      {clip.speedFrames && clip.speedFrames.length > 0 && (
        <>
          {/* Speed Frame lines and diamond heads */}
          {clip.speedFrames.map((sf) => {
            const isFrameSelected = selectedSpeedFrameId === sf.id;
            const posX = sf.timelineOffset * zoomLevel;

            return (
              <div
                key={sf.id}
                className="absolute top-0 bottom-0 z-40 pointer-events-none select-none"
                style={{ left: `${posX}px` }}
              >
                {/* Crisp vertical line spanning top to bottom */}
                <div
                  className={`absolute top-0 bottom-0 -left-[1px] w-[2px] transition-all ${
                    isFrameSelected
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] ring-1 ring-white/70'
                      : 'bg-cyan-400/90 shadow-[0_0_4px_rgba(34,211,238,0.5)]'
                  }`}
                />

                {/* Interactive line drag zone (Rate Stretch / Squeeze - starts below diamond head) */}
                <div
                  className="speed-frame-element absolute top-4 bottom-0 -left-[6px] w-[14px] cursor-ew-resize pointer-events-auto group/line"
                  onPointerDown={(e) => handleLineMouseDown(e, sf.id, sf.timelineOffset)}
                  title="Drag Line to Rate-Stretch / Squeeze adjacent segments"
                >
                  <div className="w-full h-full opacity-0 group-hover/line:opacity-25 bg-white transition-opacity" />
                </div>

                {/* Top Diamond Button Container (Drag to reposition speed frame line position) */}
                <div
                  className="speed-frame-element absolute -top-3 -left-3 w-6 h-6 z-50 flex items-center justify-center cursor-ew-resize pointer-events-auto group/diamond"
                  onPointerDown={(e) => handleScrewMouseDown(e, sf.id, sf.timelineOffset)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSpeedFrame(clip.id, sf.id);
                  }}
                  title={
                    isFrameSelected
                      ? 'Selected Diamond: Drag to reposition Speed Frame line (without changing clip duration)'
                      : 'Diamond Head: Click to select, Drag to reposition Speed Frame line'
                  }
                >
                  <div
                    className={`transition-all duration-100 ${
                      isFrameSelected
                        ? 'w-3.5 h-3.5 rotate-45 bg-rose-500 border-2 border-white shadow-[0_0_10px_rgba(244,63,94,0.9)] scale-110'
                        : 'w-2.5 h-2.5 rotate-45 bg-cyan-400 group-hover/diamond:bg-cyan-300 border border-white shadow-sm group-hover/diamond:scale-125'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// P0 FIX: Wrap TimelineClipRow in React.memo to prevent re-renders when
// unrelated Timeline state changes (zoom, hover, tool, playhead, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export const TimelineClipRow = React.memo(function TimelineClipRow({
  track,
  zoomLevel,
  selectedClipIds,
  draggingClipId,

  activeTool,
  hoverCutClipId,
  hoverCutX,
  
  handleDragOver,
  handleDrop,
  setHoveredTrackId,
  setDropPreview,

  setContextMenu,
  handleClipMouseDown,
  setHoverCutX,
  setHoverCutClipId,
  enterCompoundClip,
  toggleKeyframeLineSelection,
  selectedKeyframeLines,
  showTransitionLayer,
  selectedTransitionClipId,
  hoveredTrackId,
  selectTrack,
  selectClip,
  selectTransition,
}: TimelineClipRowProps) {
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const allPipWindows = useEditorStore((s) => s.pipWindows);
  const scrollLeftChunk = useEditorStore((s) => Math.floor(s.scrollLeft / 500) * 500);
  const dragCounter = useRef(0);

  const visibleMinX = Math.max(0, scrollLeftChunk - 600);
  const visibleMaxX = scrollLeftChunk + (typeof window !== 'undefined' ? window.innerWidth : 1920) + 600;

  // ── P0 FIX: Build O(1) lookup maps instead of O(N) .find() per clip ──────
  const mediaMap = useMemo(
    () => new Map(mediaLibrary.map((m) => [m.id, m])),
    [mediaLibrary]
  );

  const pipByParent = useMemo(() => {
    const map = new Map<string, PipWindow[]>();
    Object.values(allPipWindows || {}).forEach((p) => {
      const id = (p as any)?.parentClipId;
      if (!id) return;
      const existing = map.get(id);
      if (existing) {
        existing.push(p as PipWindow);
      } else {
        map.set(id, [p as PipWindow]);
      }
    });
    return map;
  }, [allPipWindows]);

  // ── P0 FIX: Hoist transition sort out of inline IIFE, memoised per track ─
  const sortedClips = useMemo(
    () => [...(track.clips || [])].sort((a, b) => a.startTime - b.startTime),
    [track.clips]
  );

  // P3 PERF: O(1) Set lookup instead of O(N) .includes per clip per render
  // (500 clips → 250k string comparisons per row render). Component scope so
  // both the clips map and the transitions layer can use it.
  const selectedSet = useMemo(
    () => (selectedClipIds instanceof Set ? selectedClipIds : new Set(selectedClipIds)),
    [selectedClipIds]
  );

  // ── PERF: stable per-clip media descriptors for text/kinetic clips ──────
  // Previously `defaultMedia` (with a fresh `createdAt: Date.now()`) was
  // recreated per render and every text clip's `media` prop was a brand-new
  // object — TimelineClipItem's React.memo ALWAYS failed, so all text clips
  // fully re-rendered whenever any row re-rendered. Memoised per track.clips.
  const textMediaById = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const clip of track.clips || []) {
      if (!(clip as any).textSettings && !isKineticMediaId(clip.mediaId)) continue;
      map.set(clip.id, {
        ...defaultMedia,
        type: 'text' as const,
        name: getKineticClipLabel(clip as any, 'Text'),
      });
    }
    return map;
  }, [track.clips]);

  const selectedTransitionPosition = useEditorStore((s) => s.selectedTransitionPosition);

  return (
    <div
      data-track-id={track.id}
      className={`relative border-b border-[#3e3e3e] transition-colors group ${
        hoveredTrackId === track.id ? 'bg-[#3e3e3e]/30' : ''
      }`}
      style={{ height: getTrackHeight(track) }}
      onDragOver={(e) => handleDragOver(e, track.id)}
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        setHoveredTrackId(track.id);
      }}
      onDragLeave={(e) => {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setHoveredTrackId(null);
          setDropPreview(null);
        }
      }}
      onDrop={(e) => {
        dragCounter.current = 0;
        handleDrop(e, track.id);
      }}
      onMouseLeave={() => {
        // Don't clear on mouse leave unless we are not dragging
        if (!draggingClipId) {
          setHoveredTrackId(null);
          setDropPreview(null);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectTrack(track.id);
        selectClip(null);
        selectTransition(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        selectTrack(track.id);
        selectClip(null);
        selectTransition(null);
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

      {/* Styled drop target hint for empty PIP tracks */}
      {track.id.includes('_pip') && (track.clips || []).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[9px] font-medium text-gray-500/40 border border-dashed border-gray-700/40 px-2 py-0.5 rounded">
            Drop media here
          </span>
        </div>
      )}



      {/* ── Clips ──────────────────────────────────────── */}
      {(() => {
        // PERF (many-split fix): overlapping-clip detection used to call
        // checkOverlapAt() — an O(N) scan — for EVERY clip on the track, making
        // a track render O(N²). Split-heavy timelines (100+ tiny segments) paid
        // ~10k comparisons per render. One sorted sweep builds the overlapping
        // id set in O(N log N) instead; non-overlapping split segments never
        // even enter the set.
        const clips = track.clips || [];
        let overlapIds: Set<string> | null = null;
        if (clips.length > 1) {
          const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
          overlapIds = new Set<string>();
          let runEnd = -Infinity;
          let runClips: TimelineClip[] = [];
          for (const c of sorted) {
            if (c.startTime < runEnd - 0.001) {
              for (const rc of runClips) overlapIds.add(rc.id);
              overlapIds.add(c.id);
              runEnd = Math.max(runEnd, c.startTime + c.duration);
              runClips.push(c);
            } else {
              runEnd = c.startTime + c.duration;
              runClips = [c];
            }
          }
        }
        // P3 PERF: O(1) Set lookup (see selectedSet in component scope)
        return (clips).map((clip) => {
        // P0 FIX: O(1) map lookup instead of O(N) .find() per clip per render
        // Kinetic-typography clips use synthetic `generator:*` mediaIds that are
        // deliberately absent from the media library, so they used to fall through
        // to `defaultMedia` and render as "Unknown" with a video icon. Resolve them
        // to a text-typed descriptor named after their actual content instead.
        const resolvedMedia = mediaMap.get(clip.mediaId);
        const media = resolvedMedia ?? textMediaById.get(clip.id) ?? defaultMedia;
        const isSelected = selectedSet.has(clip.id);
        // Trimming is only offered on the single selected clip — neighbouring
        // clips (and multi-selections) never get trim handles or trim cursors.
        const showTrimHandles = isSelected && selectedClipIds.length === 1;
        const isDragging = draggingClipId === clip.id;

        const hasOverlap = overlapIds ? overlapIds.has(clip.id) : false;
        // P0 FIX: O(1) map lookup instead of O(M) .filter() per clip per render
        const clipPipWindows = pipByParent.get(clip.id) ?? EMPTY_PIP_ARRAY;

        const clipLeft = Number.isFinite(clip.startTime) && Number.isFinite(zoomLevel) ? clip.startTime * zoomLevel : 0;
        const clipWidth = Number.isFinite(clip.duration) && Number.isFinite(zoomLevel) ? clip.duration * zoomLevel : 16;
        const clipRight = clipLeft + clipWidth;
        const isVirtualVisible = clipRight >= visibleMinX && clipLeft <= visibleMaxX;

        return (
          <TimelineClipItem
            key={clip.id}
            clip={clip}
            media={media}
            trackType={track.type}
            trackLocked={track.locked}
            zoomLevel={zoomLevel}
            isSelected={isSelected}
            isDragging={isDragging}
            showTrimHandles={showTrimHandles}
            selectedTransitionClipId={selectedTransitionClipId}
            activeTool={activeTool}
            hoverCutClipId={hoverCutClipId}
            hoverCutX={hoverCutX}
            selectedKeyframeLines={selectedKeyframeLines}
            hasOverlap={hasOverlap}
            clipPipWindows={clipPipWindows}
            isVirtualVisible={isVirtualVisible}
            handleClipMouseDown={handleClipMouseDown}
            selectClip={selectClip}
            selectTransition={selectTransition}
            setContextMenu={setContextMenu}
            setHoverCutX={setHoverCutX}
            setHoverCutClipId={setHoverCutClipId}
            enterCompoundClip={enterCompoundClip}
            toggleKeyframeLineSelection={toggleKeyframeLineSelection}
          />
        );
        });
      })()}



      {/* ✂️ Transitions Layer (uses memoised sortedClips) 
        ────────────────────────────────────────────── */}
        {!track.locked && (() => {
          const targets: React.ReactNode[] = [];
          for (let idx = 0; idx < sortedClips.length; idx++) {
            const clip = sortedClips[idx];
            const prevClip = idx > 0 ? sortedClips[idx - 1] : null;
            const nextClip = idx + 1 < sortedClips.length ? sortedClips[idx + 1] : null;

            const isJoinedWithPrev = prevClip && Math.abs(clip.startTime - (prevClip.startTime + prevClip.duration)) < 0.034;
            const isJoinedWithNext = nextClip && Math.abs(nextClip.startTime - (clip.startTime + clip.duration)) < 0.034;

            // 1. START EDGE of `clip`
            if (isJoinedWithPrev) {
              // MERGED Transition Cut between prevClip and clip
              if (!selectedSet.has(clip.id) && !selectedSet.has(prevClip.id)) {
                const intersectionTime = clip.startTime;
                const hasTransition = !!clip.transitionIn || !!prevClip.transitionOut;
                if (hasTransition || showTransitionLayer) {
                  const transition = clip.transitionIn || prevClip.transitionOut;
                  const activeClipId = clip.transitionIn ? clip.id : prevClip.id;
                  const activePosition = clip.transitionIn ? 'in' : 'out';
                  const duration = transition?.duration ?? 1.0;
                  const alignment = (transition?.params?.alignment as 'center' | 'left' | 'right') || 'center';

                  const widthSec = hasTransition ? duration : 0.4;
                  const widthPx = Math.max(16, widthSec * zoomLevel);

                  let leftSec = intersectionTime - widthSec / 2;
                  if (alignment === 'left') {
                    leftSec = intersectionTime;
                  } else if (alignment === 'right') {
                    leftSec = intersectionTime - widthSec;
                  }
                  const leftPx = leftSec * zoomLevel;
                  const isSelected = selectedTransitionClipId === activeClipId && (!selectedTransitionPosition || selectedTransitionPosition === activePosition);

                  targets.push(
                    <TransitionTarget
                      key={`trans-merged-${prevClip.id}-${clip.id}`}
                      clipId={activeClipId}
                      position={activePosition}
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
              }
            } else {
              // STANDALONE IN Transition at clip.startTime
              if (!selectedSet.has(clip.id)) {
                const intersectionTime = clip.startTime;
                const hasTransition = !!clip.transitionIn;
                if (hasTransition || showTransitionLayer) {
                  const transition = clip.transitionIn;
                  const duration = transition?.duration ?? 1.0;
                  const alignment = (transition?.params?.alignment as 'center' | 'left' | 'right') || 'left';

                  const widthSec = hasTransition ? duration : 0.4;
                  const widthPx = Math.max(16, widthSec * zoomLevel);

                  let leftSec = intersectionTime;
                  if (alignment === 'center') {
                    leftSec = intersectionTime - widthSec / 2;
                  } else if (alignment === 'right') {
                    leftSec = intersectionTime - widthSec;
                  }
                  const leftPx = leftSec * zoomLevel;
                  const isSelected = selectedTransitionClipId === clip.id && (!selectedTransitionPosition || selectedTransitionPosition === 'in');

                  targets.push(
                    <TransitionTarget
                      key={`trans-in-${clip.id}`}
                      clipId={clip.id}
                      position="in"
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
              }
            }

            // 2. END EDGE of `clip`
            // If clip is joined with nextClip, the merged cut is handled by nextClip's start edge above.
            // If NOT joined with nextClip, render STANDALONE OUT Transition at clip.startTime + clip.duration.
            if (!isJoinedWithNext) {
              if (!selectedSet.has(clip.id)) {
                const intersectionTime = clip.startTime + clip.duration;
                const hasTransition = !!clip.transitionOut;
                if (hasTransition || showTransitionLayer) {
                  const transition = clip.transitionOut;
                  const duration = transition?.duration ?? 1.0;
                  const alignment = (transition?.params?.alignment as 'center' | 'left' | 'right') || 'right';

                  const widthSec = hasTransition ? duration : 0.4;
                  const widthPx = Math.max(16, widthSec * zoomLevel);

                  let leftSec = intersectionTime - widthSec;
                  if (alignment === 'center') {
                    leftSec = intersectionTime - widthSec / 2;
                  } else if (alignment === 'left') {
                    leftSec = intersectionTime;
                  }
                  const leftPx = leftSec * zoomLevel;
                  const isSelected = selectedTransitionClipId === clip.id && (!selectedTransitionPosition || selectedTransitionPosition === 'out');

                  targets.push(
                    <TransitionTarget
                      key={`trans-out-${clip.id}`}
                      clipId={clip.id}
                      position="out"
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
              }
            }
          }
          return targets;
        })()}
    </div>
  );
});
