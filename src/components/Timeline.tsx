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
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { TimelineClip } from '@/types';
import { formatSimpleTime } from '@/utils/time';

const TRACK_HEIGHT = 56;

export function Timeline() {
  const {
    tracks,
    currentTime,
    zoomLevel,
    scrollLeft,
    selectedClipId,
    activeTool,
    selectedTrackId,
    selectClip,
    selectTrack,
    seek,
    splitClip,
    moveClip,
    zoomIn,
    zoomOut,
    toggleTrackLock,
    toggleTrackMute,
    addTrack,
    removeTrack,
    updateClip,
    totalDuration,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    originalStartTime: number;
    trackId: string;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    startX: number;
    originalDuration: number;
    originalTrimStart: number;
    originalTrimEnd: number;
    originalStartTime: number;
  } | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);

  // Sync ruler and track scrolling
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

  // Get clip media info
  const getMediaInfo = (clip: TimelineClip) => {
    const media = useEditorStore
      .getState()
      .mediaLibrary.find((m) => m.id === clip.mediaId);
    return media || { name: 'Unknown', type: 'video' as const, duration: 30 };
  };

  // Handle timeline click (scrubbing)
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (activeTool === 'split') return;
    const rect = trackContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (trackContainerRef.current?.scrollLeft || 0);
    const time = x / zoomLevel;
    seek(Math.max(0, time));
  };

  // Handle split
  const handleSplit = (clipId: string) => {
    splitClip(clipId, currentTime);
  };

  // Handle clip drag start
  const handleClipDragStart = (e: React.MouseEvent, clip: TimelineClip) => {
    if (e.button !== 0) return;
    // Check if clicking on resize handle
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < 5) {
      setResizeState({
        clipId: clip.id,
        edge: 'left',
        startX: e.clientX,
        originalDuration: clip.duration,
        originalTrimStart: clip.trimStart,
        originalTrimEnd: clip.trimEnd,
        originalStartTime: clip.startTime,
      });
      e.stopPropagation();
      return;
    }
    if (relX > rect.width - 5) {
      setResizeState({
        clipId: clip.id,
        edge: 'right',
        startX: e.clientX,
        originalDuration: clip.duration,
        originalTrimStart: clip.trimStart,
        originalTrimEnd: clip.trimEnd,
        originalStartTime: clip.startTime,
      });
      e.stopPropagation();
      return;
    }

    if (activeTool === 'split') {
      handleSplit(clip.id);
      return;
    }

    setDragState({
      clipId: clip.id,
      startX: e.clientX,
      originalStartTime: clip.startTime,
      trackId: clip.trackId,
    });
    selectClip(clip.id);
    e.stopPropagation();
  };

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState) {
        const dx = e.clientX - dragState.startX;
        const dt = dx / zoomLevel;
        let newTime = Math.max(0, dragState.originalStartTime + dt);

        // Snap to nearby clip edges
        const snapThreshold = 10 / zoomLevel;
        let snapped = false;
        for (const track of tracks) {
          for (const clip of track.clips) {
            if (clip.id === dragState.clipId) continue;
            const edges = [
              clip.startTime,
              clip.startTime + clip.duration,
            ];
            for (const edge of edges) {
              if (Math.abs(newTime - edge) < snapThreshold) {
                newTime = edge;
                snapped = true;
                setSnapLine(edge * zoomLevel);
                break;
              }
            }
            const rightEdge = newTime + clip.duration;
            for (const edge of edges) {
              if (Math.abs(rightEdge - edge) < snapThreshold) {
                newTime = edge - clip.duration;
                snapped = true;
                setSnapLine(edge * zoomLevel);
                break;
              }
            }
            if (snapped) break;
          }
          if (snapped) break;
        }
        if (!snapped) setSnapLine(null);

        moveClip(dragState.clipId, newTime);
      }

      if (resizeState) {
        const dx = e.clientX - resizeState.startX;
        const dt = dx / zoomLevel;
        const clip = tracks
          .flatMap((t) => t.clips)
          .find((c) => c.id === resizeState.clipId);
        if (!clip) return;

        const media = getMediaInfo(clip);
        const sourceDuration = media.duration || 30;

        if (resizeState.edge === 'right') {
          const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
          const maxDuration = sourceDuration - clip.trimStart - clip.trimEnd;
          const clampedDuration = Math.min(newDuration, maxDuration);
          const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clampedDuration);
          updateClip(resizeState.clipId, {
            duration: clampedDuration,
            trimEnd: Math.max(0, newTrimEnd),
          });
        } else {
          const dtFromRight = -dt;
          const newDuration = Math.max(0.1, resizeState.originalDuration + dtFromRight);
          const maxDuration = sourceDuration - clip.trimStart - clip.trimEnd;
          const clampedDuration = Math.min(newDuration, maxDuration);
          const timeShift = resizeState.originalDuration - clampedDuration;
          updateClip(resizeState.clipId, {
            startTime: resizeState.originalStartTime + timeShift,
            duration: clampedDuration,
            trimStart: Math.max(0, resizeState.originalTrimStart + timeShift),
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
        setSnapLine(null);
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
  }, [dragState, resizeState, zoomLevel, tracks, moveClip, updateClip]);

  // Handle drop from media panel
  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('application/procut-media');
    if (!mediaId) return;

    const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === mediaId);
    if (!media) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + (trackContainerRef.current?.scrollLeft || 0);
    const startTime = Math.max(0, x / zoomLevel);

    const newClip: TimelineClip = {
      id: Math.random().toString(36).substr(2, 9),
      mediaId,
      trackId,
      startTime,
      duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
    };

    useEditorStore.getState().addClip(newClip);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Generate ruler markers
  const generateRulerMarkers = () => {
    const markers = [];
    const interval = zoomLevel > 150 ? 1 : zoomLevel > 80 ? 5 : 10;
    const maxTime = Math.max(totalDuration + 10, 60);
    for (let t = 0; t <= maxTime; t += interval) {
      markers.push(t);
    }
    return markers;
  };

  const rulerMarkers = generateRulerMarkers();

  // Colors for clip types
  const clipColors: Record<string, { bg: string; border: string; text: string }> = {
    video: { bg: 'bg-blue-600/70', border: 'border-blue-500', text: 'text-blue-100' },
    audio: { bg: 'bg-emerald-600/70', border: 'border-emerald-500', text: 'text-emerald-100' },
    image: { bg: 'bg-amber-600/70', border: 'border-amber-500', text: 'text-amber-100' },
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#3e3e3e]" ref={timelineRef}>
      {/* Timeline Header */}
      <div className="h-8 flex items-center px-2 bg-[#252525] border-b border-[#3e3e3e]">
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#a0a0a0] w-10 text-center">{zoomLevel}px/s</span>
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#3e3e3e] mx-2" />

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

        <div className="flex items-center gap-1">
          {activeTool === 'split' && (
            <span className="text-[10px] text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded">
              Click a clip to split at playhead
            </span>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers */}
        <div className="w-32 bg-[#252525] border-r border-[#3e3e3e] flex flex-col overflow-hidden shrink-0">
          {/* Ruler header spacer */}
          <div className="h-7 bg-[#2d2d2d] border-b border-[#3e3e3e]" />
          {/* Track headers */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`h-[${TRACK_HEIGHT}px] flex items-center px-2 border-b border-[#3e3e3e] ${
                  selectedTrackId === track.id ? 'bg-[#3e3e3e]' : ''
                }`}
                style={{ height: TRACK_HEIGHT }}
                onClick={() => selectTrack(track.id)}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <GripVertical className="w-3 h-3 text-[#a0a0a0] shrink-0" />
                  <span className="text-[11px] text-white font-medium truncate">
                    {track.name}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }}
                    title={track.locked ? 'Unlock' : 'Lock'}
                    className={`p-0.5 rounded transition-colors ${
                      track.locked ? 'text-amber-400' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }}
                    title={track.muted ? 'Unmute' : 'Mute'}
                    className={`p-0.5 rounded transition-colors ${
                      track.muted ? 'text-red-400' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {track.muted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
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

        {/* Timeline Tracks Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Ruler */}
          <div
            className="h-7 bg-[#2d2d2d] border-b border-[#3e3e3e] relative overflow-hidden shrink-0"
          >
            <div
              className="absolute top-0 left-0 h-full"
              style={{
                width: `${(totalDuration + 30) * zoomLevel}px`,
                transform: `translateX(-${scrollLeft}px)`,
              }}
            >
              {rulerMarkers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full flex flex-col items-start"
                  style={{ left: `${t * zoomLevel}px` }}
                >
                  <div className="h-2 w-px bg-[#a0a0a0]" />
                  <span className="text-[9px] text-[#a0a0a0] pl-0.5 mt-0.5">
                    {formatSimpleTime(t)}
                  </span>
                </div>
              ))}
              {/* Playhead indicator on ruler */}
              <div
                className="absolute top-0 h-full z-10 pointer-events-none"
                style={{ left: `${currentTime * zoomLevel}px` }}
              >
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -translate-x-1/2" />
              </div>
            </div>
          </div>

          {/* Tracks Container */}
          <div
            ref={trackContainerRef}
            className="flex-1 overflow-auto relative"
            onClick={handleTimelineClick}
            onDoubleClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = e.clientX - rect.left + (trackContainerRef.current?.scrollLeft || 0);
              const time = x / zoomLevel;
              // Find clip under cursor and split
              for (const track of tracks) {
                for (const clip of track.clips) {
                  if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
                    splitClip(clip.id, time);
                    return;
                  }
                }
              }
            }}
          >
            <div
              className="relative"
              style={{
                width: `${(totalDuration + 30) * zoomLevel}px`,
                minHeight: '100%',
              }}
            >
              {/* Grid lines */}
              {rulerMarkers.map((t) => (
                <div
                  key={`grid-${t}`}
                  className="absolute top-0 bottom-0 w-px bg-[#3e3e3e]/30 pointer-events-none"
                  style={{ left: `${t * zoomLevel}px` }}
                />
              ))}

              {/* Tracks */}
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="relative border-b border-[#3e3e3e]"
                  style={{ height: TRACK_HEIGHT }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, track.id)}
                  onClick={(e) => { e.stopPropagation(); selectTrack(track.id); }}
                >
                  {/* Track background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-px h-full bg-white"
                        style={{ left: `${i * 20}px` }}
                      />
                    ))}
                  </div>

                  {/* Track type indicator */}
                  <div className="absolute left-1 top-1 text-[8px] text-[#a0a0a0] opacity-30 uppercase">
                    {track.type}
                  </div>

                  {/* Clips */}
                  {track.clips.map((clip) => {
                    const media = getMediaInfo(clip);
                    const colors = clipColors[media.type] || clipColors.video;
                    const isSelected = selectedClipId === clip.id;
                    const width = Math.max(clip.duration * zoomLevel, 10);
                    const left = clip.startTime * zoomLevel;

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 h-[${TRACK_HEIGHT - 8}px] rounded overflow-hidden cursor-pointer group select-none ${colors.bg} border ${colors.border} ${
                          isSelected ? 'ring-2 ring-white shadow-lg z-10' : 'hover:brightness-110'
                        } ${track.locked ? 'opacity-50' : ''}`}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          height: TRACK_HEIGHT - 8,
                        }}
                        onMouseDown={(e) => handleClipDragStart(e, clip)}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectClip(clip.id);
                        }}
                      >
                        {/* Resize handles */}
                        {!track.locked && (
                          <>
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize hover:bg-white/30 z-20" />
                            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize hover:bg-white/30 z-20" />
                          </>
                        )}

                        {/* Clip content */}
                        <div className="h-full flex flex-col px-1.5 py-0.5 overflow-hidden">
                          {/* Clip header */}
                          <div className="flex items-center gap-1 min-w-0">
                            {media.type === 'video' && <Film className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'audio' && <Music className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'image' && (
                              <svg className="w-2.5 h-2.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="M21 15l-5-5L5 21" />
                              </svg>
                            )}
                            <span className={`text-[9px] font-medium truncate ${colors.text}`}>
                              {media.name}
                            </span>
                          </div>

                          {/* Progress bar */}
                          {media.type !== 'image' && (
                            <div className="mt-auto h-2 bg-black/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-white/30 rounded-full"
                                style={{
                                  width: `${Math.min(100, ((currentTime - clip.startTime + clip.trimStart) / (media.duration - clip.trimStart - clip.trimEnd)) * 100)}%`,
                                  opacity:
                                    currentTime >= clip.startTime &&
                                    currentTime < clip.startTime + clip.duration
                                      ? 1
                                      : 0,
                                }}
                              />
                            </div>
                          )}

                          {/* Duration label */}
                          <div className="absolute bottom-0.5 right-1 text-[8px] text-white/50">
                            {clip.duration.toFixed(1)}s
                          </div>
                        </div>

                        {/* Split button on hover */}
                        {!track.locked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSplit(clip.id);
                            }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity z-30"
                            title="Split at playhead"
                          >
                            <Scissors className="w-3 h-3 text-white" />
                          </button>
                        )}

                        {/* Audio waveform visualization */}
                        {media.type === 'audio' && (
                          <div className="absolute inset-0 flex items-end pb-1 px-1 pointer-events-none opacity-40">
                            {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
                              <div
                                key={i}
                                className="flex-1 bg-white/40 mx-px"
                                style={{
                                  height: `${20 + Math.sin(i * 0.5) * 20 + Math.random() * 15}%`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Snap line */}
              {snapLine !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-white z-40 pointer-events-none"
                  style={{ left: `${snapLine}px` }}
                />
              )}

              {/* Playhead */}
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
