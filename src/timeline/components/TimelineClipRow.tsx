import React, { useMemo, useRef } from 'react';
import { Film, Music, Image, Sparkles, Type, Plus } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineTrack, TimelineClip, MediaItem, EditorState, PipWindow } from '@/types';
import { getTrackHeight } from '../trackGeometry';
import { checkOverlapAt } from '../timelineUtils';
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
  handleClipMouseDown: (e: React.MouseEvent, clip: TimelineClip) => void;
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
  selectedTransitionClipId: string | null;
  activeTool: string;
  hoverCutClipId: string | null;
  hoverCutX: number | null;
  selectedKeyframeLines: { clipId: string; time: number }[];
  hasOverlap: boolean;
  clipPipWindows: PipWindow[];
  
  // Handlers
  handleClipMouseDown: (e: React.MouseEvent, clip: TimelineClip) => void;
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

  return (
    <div
      className={`absolute top-1 rounded cursor-pointer group select-none ${colors.bg} border ${colors.border} ${colors.hover} transition-all duration-75 ${
        isSelected
          ? activeTool === 'rateStretch'
            ? 'ring-2 ring-purple-500 shadow-lg z-20 rate-stretch-active'
            : 'ring-2 ring-white shadow-lg z-20'
          : 'hover:brightness-110'
      } ${trackLocked ? 'opacity-50' : ''} ${isDragging ? 'opacity-80 brightness-125' : ''}`}
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
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Resize Handles (Visible on Hover) ──────────────── */}
      {!trackLocked && (
        <>
          <div 
            className="absolute left-0 top-0 bottom-0 w-[8px] bg-amber-500/0 hover:bg-amber-500/80 cursor-ew-resize z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
            data-edge="left"
            onMouseDown={(e) => { e.stopPropagation(); handleClipMouseDown(e, clip); }}
          >
            <div className="w-[2px] h-4 bg-white rounded-full shadow pointer-events-none" />
          </div>
          <div 
            className="absolute right-0 top-0 bottom-0 w-[8px] bg-amber-500/0 hover:bg-amber-500/80 cursor-ew-resize z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
            data-edge="right"
            onMouseDown={(e) => { e.stopPropagation(); handleClipMouseDown(e, clip); }}
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
                    useEditorStore.getState().saveSnapshot('Move Keyframe');
                    useEditorStore.getState().endTransaction();
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
      {/* ── Diamond Markers for PIP Windows ────────────────────────── */}
      {trackType === 'video' && clipPipWindows && clipPipWindows.length > 0 && (
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
      {(track.clips || []).map((clip) => {
        // P0 FIX: O(1) map lookup instead of O(N) .find() per clip per render
        const media = mediaMap.get(clip.mediaId) ?? defaultMedia;
        const isSelected = selectedClipIds.includes(clip.id);
        const isDragging = draggingClipId === clip.id;

        const hasOverlap = checkOverlapAt(track, clip.startTime, clip.duration, clip.id);
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
      })}



      {/* ── Transitions Layer (uses memoised sortedClips) ───────────────────── */}
      {!track.locked && sortedClips.map((clip, idx) => {
        if (idx === 0) return null;
        const prevClip = sortedClips[idx - 1];
        const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
        
        const isEligibleForTransition = gap > -0.034 && gap < 0.034;
        if (isEligibleForTransition) {
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
