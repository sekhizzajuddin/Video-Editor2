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

interface TimelineClipRowProps {
  track: TimelineTrack;
  tracks: TimelineTrack[];
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
  const width = Math.max(clip.duration * zoomLevel, MIN_CLIP_WIDTH);
  const left = clip.startTime * zoomLevel;
  const clipHeight = (trackType === 'text' || trackType === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) - 8;
  const isVideoWithAudio =
    media.type === 'video' && media.waveformPeaks && media.waveformPeaks.length > 0;
  const mainVisualHeight = isVideoWithAudio ? clipHeight - 12 : clipHeight;

  const clipAnims = clip.animations?.['transform.x'] || [];
  const keyframeTimes = clipAnims.map((k: any) => k.time).sort((a: any, b: any) => a - b);

  const dragHandlersRef = useRef<{move: (e: MouseEvent) => void, up: () => void} | null>(null);

  const selectedSpeedFrame = useEditorStore((s) => s.selectedSpeedFrame);
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

  const handleLineMouseDown = (e: React.MouseEvent, frameId: string, currentOffset: number) => {
    e.stopPropagation();
    e.preventDefault();
    selectSpeedFrame(clip.id, frameId);

    const startX = e.clientX;
    const startOffset = currentOffset;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newOffset = startOffset + deltaX / zoomLevel;
      updateSpeedFrameLine(clip.id, frameId, newOffset);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      commitSpeedFrameDrag();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleScrewMouseDown = (e: React.MouseEvent, frameId: string, currentOffset: number) => {
    e.stopPropagation();
    e.preventDefault();
    selectSpeedFrame(clip.id, frameId);

    const startX = e.clientX;
    const startOffset = currentOffset;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newOffset = startOffset + deltaX / zoomLevel;
      updateSpeedFrameScrew(clip.id, frameId, newOffset);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      commitSpeedFrameDrag();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  
  useEffect(() => {
    return () => {
      const h = dragHandlersRef.current;
      if (h) {
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
      onDoubleClick={(e) => {
        e.stopPropagation();
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

      {/* ── Visual content layer ──────────────────── */}
      <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
        {(trackType === 'audio' || media.type === 'audio') ? (
          <WaveformOverlay
            media={media}
            clipId={clip.id}
            width={width}
            height={clipHeight}
            color="rgba(255,255,255,1)"
            trimStart={clip.trimStart}
            clipDuration={clip.duration}
            speed={clip.speed}
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
                className="relative overflow-hidden border-t border-blue-400/20"
                style={{ height: 12 }}
              >
                <WaveformOverlay
                  media={media}
                  clipId={clip.id}
                  width={width}
                  height={12}
                  small
                  color="rgba(255,255,255,0.5)"
                  trimStart={clip.trimStart}
                  clipDuration={clip.duration}
                  speed={clip.speed}
                />
              </div>
            )}
          </>
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
          {clip.speedRamp && clip.speedRamp.length >= 2 ? (
            <span className="bg-amber-500/20 text-amber-300 px-1 py-px rounded-sm font-semibold">Ramped</span>
          ) : clip.speed !== 1.0 ? (
            <span className="bg-blue-500/20 text-blue-300 px-1 py-px rounded-sm font-semibold">{(clip?.speed ?? 1).toFixed(1)}x</span>
          ) : null}
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

      {/* ── + Speed Frame Quick Action Button ────────── */}
      {isSelected && !trackLocked && activeTool !== 'split' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addSpeedFrame(clip.id);
          }}
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-50 px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500 via-purple-600 to-pink-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1 border border-white/60 backdrop-blur-sm pointer-events-auto"
          title="Add Speed Frame at playhead (or clip center) to dynamically rate-stretch this section"
        >
          <Zap className="w-2.5 h-2.5 text-amber-200 fill-amber-200" />
          <span>+ Speed Frame</span>
        </button>
      )}

      {/* ── Embedded Speed Frames (Dynamic Rate-Stretching) ────────── */}
      {clip.speedFrames && clip.speedFrames.length > 0 && (
        <>
          {/* Segment speed multiplier badges */}
          {speedSegments.map((seg) => {
            const centerT = (seg.startOffset + seg.endOffset) / 2;
            const centerPx = centerT * zoomLevel;
            return (
              <div
                key={`seg-${seg.index}`}
                className={`absolute bottom-1 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight shadow pointer-events-none z-30 flex items-center gap-0.5 transition-all ${
                  seg.speed > 1.05
                    ? 'bg-emerald-500/90 text-black shadow-emerald-500/30'
                    : seg.speed < 0.95
                    ? 'bg-purple-600/90 text-white shadow-purple-500/30'
                    : 'bg-black/70 text-white/80 border border-white/20'
                }`}
                style={{ left: `${centerPx}px` }}
                title={`Segment ${seg.index + 1}: ${seg.speed.toFixed(2)}x speed`}
              >
                <span>{seg.speed.toFixed(1)}x</span>
              </div>
            );
          })}

          {/* Speed Frame lines and screw heads */}
          {clip.speedFrames.map((sf) => {
            const isFrameSelected =
              selectedSpeedFrame?.clipId === clip.id && selectedSpeedFrame?.frameId === sf.id;
            const posX = sf.timelineOffset * zoomLevel;

            return (
              <div
                key={sf.id}
                className="absolute top-0 bottom-0 z-40 pointer-events-none select-none"
                style={{ left: `${posX}px` }}
              >
                {/* Glowing animated vertical line spanning top to bottom */}
                <div
                  className={`absolute top-0 bottom-0 -left-[1px] w-[2px] transition-all ${
                    isFrameSelected
                      ? 'shadow-[0_0_10px_#f43f5e,0_0_18px_#a855f7] ring-1 ring-white/80'
                      : 'shadow-[0_0_6px_rgba(168,85,247,0.8),0_0_12px_rgba(236,72,153,0.6)]'
                  }`}
                  style={{
                    background: 'linear-gradient(180deg, #38bdf8, #a855f7, #ec4899, #f59e0b)',
                  }}
                />

                {/* Interactive line drag zone (Rate Stretch / Squeeze) */}
                <div
                  className="absolute top-0 bottom-0 -left-[7px] w-[16px] cursor-ew-resize pointer-events-auto group/line"
                  onMouseDown={(e) => handleLineMouseDown(e, sf.id, sf.timelineOffset)}
                  title="Drag Line to Rate-Stretch / Squeeze adjacent segments"
                >
                  <div className="w-full h-full opacity-0 group-hover/line:opacity-20 bg-white transition-opacity" />
                </div>

                {/* Top Marker / Screw Head */}
                {isFrameSelected ? (
                  /* Selected state: Metallic Precision Screw Head with delete button */
                  <div className="absolute -top-3.5 -left-2.5 pointer-events-auto flex flex-col items-center">
                    {/* Quick Delete button (×) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSpeedFrame(clip.id, sf.id);
                      }}
                      className="mb-1 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md transition-colors"
                      title="Delete Speed Frame (Restore uniform speed)"
                    >
                      ×
                    </button>

                    {/* Screw Head */}
                    <div
                      className="w-5 h-5 rounded-full bg-gradient-to-br from-neutral-100 via-neutral-300 to-neutral-500 border border-white shadow-xl flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform ring-2 ring-purple-500/80"
                      onMouseDown={(e) => handleScrewMouseDown(e, sf.id, sf.timelineOffset)}
                      title="Screw Head: Drag to reposition Speed Frame within clip"
                    >
                      {/* Slotted screw drive groove */}
                      <div className="w-3 h-[2px] bg-neutral-900 rounded-xs shadow-inner" />
                    </div>
                  </div>
                ) : (
                  /* Unselected state: glowing marker cap */
                  <div
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 rotate-45 bg-gradient-to-br from-pink-500 to-purple-600 border border-white/90 shadow-md cursor-pointer pointer-events-auto hover:scale-125 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSpeedFrame(clip.id, sf.id);
                    }}
                    title="Click to select Speed Frame (convert to Screw Head & preview frame)"
                  />
                )}
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
  tracks,
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
  const dragCounter = useRef(0);

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

  const defaultMedia: MediaItem = {
    id: '',
    name: 'Unknown',
    type: 'video' as const,
    duration: 30,
    url: '',
    createdAt: Date.now(),
  };

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
        return (clips).map((clip) => {
        // P0 FIX: O(1) map lookup instead of O(N) .find() per clip per render
        // Kinetic-typography clips use synthetic `generator:*` mediaIds that are
        // deliberately absent from the media library, so they used to fall through
        // to `defaultMedia` and render as "Unknown" with a video icon. Resolve them
        // to a text-typed descriptor named after their actual content instead.
        const resolvedMedia = mediaMap.get(clip.mediaId);
        const media = resolvedMedia ?? (
          (clip as any).textSettings || isKineticMediaId(clip.mediaId)
            ? {
                ...defaultMedia,
                type: 'text' as const,
                name: getKineticClipLabel(clip as any, 'Text'),
              }
            : defaultMedia
        );
        const isSelected = selectedClipIds.includes(clip.id);
        // Trimming is only offered on the single selected clip — neighbouring
        // clips (and multi-selections) never get trim handles or trim cursors.
        const showTrimHandles = isSelected && selectedClipIds.length === 1;
        const isDragging = draggingClipId === clip.id;

        const hasOverlap = overlapIds ? overlapIds.has(clip.id) : false;
        // P0 FIX: O(1) map lookup instead of O(M) .filter() per clip per render
        const clipPipWindows = pipByParent.get(clip.id) ?? [];

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
        {!track.locked && sortedClips.map((clip, idx) => {
          if (idx === 0) return null;
          const prevClip = sortedClips[idx - 1];
          const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
          
          const isEligibleForTransition = gap > -0.034 && gap < 0.034;
          if (isEligibleForTransition) {
            // Hide transition targets if either adjacent clip is selected to allow easier trimming
            if (selectedClipIds.includes(clip.id) || selectedClipIds.includes(prevClip.id)) return null;

            const intersectionTime = clip.startTime;
          const hasTransition = !!clip.transitionIn || !!prevClip.transitionOut;
          
          if (!hasTransition && !showTransitionLayer) return null;
          
          const transition = clip.transitionIn || prevClip.transitionOut;
          const activeClipId = clip.transitionIn ? clip.id : prevClip.id;
          const activePosition = clip.transitionIn ? 'in' : 'out';
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
          
          const isSelected = selectedTransitionClipId === activeClipId;
          
          return (
            <TransitionTarget
              key={`trans-${clip.id}`}
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
        return null;
      })}
    </div>
  );
});
