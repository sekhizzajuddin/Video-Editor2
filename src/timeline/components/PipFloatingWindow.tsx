import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { PipWindow, TimelineClip } from '@/types';
import { X, GripHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { DEFAULT_TRACK_HEIGHT } from '../timelineConstants';
import { getTrackTop, getTrackHeight } from '../trackGeometry';

import { TimelineClipRow } from './TimelineClipRow';

interface PipFloatingWindowProps {
  pipWindow: PipWindow;
  parentClip: TimelineClip;
  zoomLevel: number;
  onClose: () => void;
  tracks: import('@/types').TimelineTrack[];
  selectedClipIds: string[];
  draggingClipId: string | null;
  activeTool: string;
  hoverCutClipId: string | null;
  hoverCutX: number | null;
  handleDragOver: (e: React.DragEvent, trackId: string) => void;
  handleDrop: (e: React.DragEvent, trackId: string) => void;
  setHoveredTrackId: (id: string | null) => void;
  setDropPreview: (val: any) => void;
  setContextMenu: (val: any) => void;
  handleClipMouseDown: (e: React.MouseEvent, clip: TimelineClip) => void;
  setHoverCutX: (val: number | null) => void;
  setHoverCutClipId: (val: string | null) => void;

  selectTrack: (id: string | null) => void;
  selectClip: (id: string | null, multi?: boolean) => void;
  selectTransition: (id: string | null) => void;
}

export function PipFloatingWindow({
  pipWindow,
  parentClip,
  zoomLevel,
  onClose,
  tracks,
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

  selectTrack,
  selectClip,
  selectTransition,
}: PipFloatingWindowProps) {
  const {
    updatePipWindowStartTime,
    updatePipWindowDuration,
    reorderPipTrack,
    removeTrackFromPip,
    addTrackToPip,
    mediaLibrary,
    currentTime,
    selectedClipId,
  } = useEditorStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startDurationRef = useRef(0);
  const startRelTimeRef = useRef(0);
  
  const windowLeft = (parentClip.startTime + (pipWindow.relativeStartTime || 0)) * zoomLevel - 1;
  const windowWidth = Math.max(200, pipWindow.duration * zoomLevel) + 2;
  const parentEnd = parentClip.startTime + parentClip.duration;

  const trackIdx = tracks.findIndex(t => t.id === parentClip.trackId);
  const trackTop = trackIdx >= 0 ? getTrackTop(tracks, trackIdx) : 0;
  const trackHeight = trackIdx >= 0 ? getTrackHeight(tracks[trackIdx]) : DEFAULT_TRACK_HEIGHT;
  const windowTop = trackTop + trackHeight;

  // Handles drag to move PIP start time
  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startRelTimeRef.current = pipWindow.relativeStartTime || 0;
    useEditorStore.getState().startTransaction();
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startXRef.current;
        const dt = dx / zoomLevel;
        const initialAbsoluteStart = parentClip.startTime + startRelTimeRef.current;
        let newAbsoluteStart = initialAbsoluteStart + dt;
        // Limit start time to parent clip's range, ensuring the PIP doesn't start before parent clip
        newAbsoluteStart = Math.max(parentClip.startTime, Math.min(parentEnd, newAbsoluteStart));
        const newRelativeStart = newAbsoluteStart - parentClip.startTime;

        updatePipWindowStartTime(pipWindow.id, newRelativeStart);
      };
      const handleMouseUp = () => {
        setIsDragging(false);
        useEditorStore.getState().endTransaction();
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, pipWindow.id, pipWindow.duration, zoomLevel, parentClip.startTime, parentEnd]);

  // Handles drag to resize PIP duration
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startDurationRef.current = pipWindow.duration;
    useEditorStore.getState().startTransaction();
  };

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startXRef.current;
        const dt = dx / zoomLevel;
        
        const absoluteStartTime = parentClip.startTime + (pipWindow.relativeStartTime || 0);
        const maxDuration = parentEnd - absoluteStartTime;
        let newDuration = Math.max(0.5, startDurationRef.current + dt);
        newDuration = Math.min(maxDuration, Math.min(600, newDuration));
        
        updatePipWindowDuration(pipWindow.id, newDuration);
      };
      const handleMouseUp = () => {
        setIsResizing(false);
        useEditorStore.getState().endTransaction();
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, pipWindow.id, pipWindow.relativeStartTime, zoomLevel, parentClip.startTime, parentEnd]);

  // Handle drop media inside PIP
  const handlePipContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const mediaId = e.dataTransfer.getData('application/procut-media');
    if (!mediaId) return;

    const media = mediaLibrary.find(m => m.id === mediaId);
    if (!media) return;

    if (media.type !== 'video' && media.type !== 'image') return; // PIP only supports video/image

    // Media ALWAYS drops at the very beginning of the PIP workspace
    const timeWithinPip = 0;

    const trackType = media.type === 'image' ? 'video' : media.type;
    if (trackType !== 'video' && trackType !== 'audio' && trackType !== 'text' && trackType !== 'fx') return;

    const dur = media.type === 'video' ? (media.duration || 5) : 5;
    addTrackToPip(pipWindow.id, trackType, mediaId, timeWithinPip, dur);
  };

  const handlePipContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/procut-media')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  return (
    <div
      className="absolute z-50 rounded-lg shadow-2xl bg-[#2a2a2a]/95 backdrop-blur-md border border-[#4a4a4a] overflow-hidden flex flex-col pointer-events-auto"
      style={{
        left: `${windowLeft}px`,
        top: `${windowTop}px`,
        width: `${windowWidth}px`,
        minHeight: '120px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex items-center justify-between px-2 py-1 bg-[#1e1e1e] border-b border-[#3e3e3e] cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-1.5 text-[#a0a0a0]">
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium tracking-wide">PIP WORKSPACE</span>
        </div>
        <div className="flex items-center gap-1">
          {(() => {
            const selectedTrackIdx = pipWindow.tracks.findIndex(t => t.clips.some(c => c.id === selectedClipId));
            if (selectedTrackIdx !== -1) {
              return (
                <>
                  <button 
                    disabled={selectedTrackIdx === 0}
                    onClick={(e) => { e.stopPropagation(); reorderPipTrack(pipWindow.id, selectedTrackIdx, 'up'); }}
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                    title="Move Layer Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    disabled={selectedTrackIdx === pipWindow.tracks.length - 1}
                    onClick={(e) => { e.stopPropagation(); reorderPipTrack(pipWindow.id, selectedTrackIdx, 'down'); }}
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                    title="Move Layer Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-gray-600 mx-1"></div>
                </>
              );
            }
            return null;
          })()}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              useEditorStore.getState().deletePipWindow(pipWindow.id);
            }}
            title="Delete PIP Layer"
            className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close Window"
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div 
        className="flex-1 relative overflow-y-auto py-2 min-h-[60px]"
        onDrop={handlePipContainerDrop}
        onDragOver={handlePipContainerDragOver}
      >
        {pipWindow.tracks.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium text-gray-500/70 border border-dashed border-gray-600 px-4 py-2 rounded-md">
              Drop Video/Image Here
            </span>
          </div>
        ) : (
          <div className="relative w-full h-full flex flex-col gap-1">
            {(() => {
              const pipAbsStart = parentClip.startTime + (pipWindow.relativeStartTime || 0);
              if (currentTime >= pipAbsStart && currentTime <= pipAbsStart + pipWindow.duration) {
                return (
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                    style={{ left: `${(currentTime - pipAbsStart) * zoomLevel}px` }}
                  />
                );
              }
              return null;
            })()}
             {(pipWindow.tracks || []).map((track, idx) => {
               if (track.hidden) return null;
               return (
                 <TimelineClipRow
                   key={track.id}
                   track={track}
                   tracks={pipWindow.tracks}
                   zoomLevel={zoomLevel}
                   selectedClipIds={selectedClipIds}
                   draggingClipId={draggingClipId}
                   activeTool={activeTool}
                   hoverCutClipId={hoverCutClipId}
                   hoverCutX={hoverCutX}
                   handleDragOver={handleDragOver}
                   handleDrop={handleDrop}
                   setHoveredTrackId={setHoveredTrackId}
                   setDropPreview={setDropPreview}
                   setContextMenu={setContextMenu}
                   handleClipMouseDown={handleClipMouseDown}
                   setHoverCutX={setHoverCutX}
                   setHoverCutClipId={setHoverCutClipId}
                   enterCompoundClip={() => {}}
                   toggleKeyframeLineSelection={() => {}}
                   selectedKeyframeLines={[]}
                   showTransitionLayer={false}
                   selectedTransitionClipId={null}
                   hoveredTrackId={null}
                   selectTrack={selectTrack}
                   selectClip={selectClip}
                   selectTransition={selectTransition}
                 />
               );
             })}
          </div>
        )}
      </div>

      <div 
        className="absolute top-0 right-0 bottom-0 w-2 cursor-e-resize hover:bg-white/10 transition-colors group/resize z-20 flex items-center justify-center"
        onMouseDown={handleResizeStart}
      >
        <div className="w-0.5 h-4 bg-gray-500 rounded-full group-hover/resize:bg-white opacity-0 group-hover/resize:opacity-100" />
      </div>
    </div>
  );
}
