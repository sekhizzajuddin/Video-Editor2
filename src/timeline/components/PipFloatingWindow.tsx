import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { PipWindow, TimelineClip } from '@/types';
import { X, GripHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { DEFAULT_TRACK_HEIGHT } from '../timelineConstants';
import { getTrackTop, getTrackHeight } from '../trackGeometry';

interface PipFloatingWindowProps {
  pipWindow: PipWindow;
  parentClip: TimelineClip;
  zoomLevel: number;
  onClose: () => void;
}

export function PipFloatingWindow({
  pipWindow,
  parentClip,
  zoomLevel,
  onClose,
}: PipFloatingWindowProps) {
  const {
    updatePipWindowStartTime,
    updatePipWindowDuration,
    reorderPipTrack,
    removeTrackFromPip,
    addTrackToPip,
    mediaLibrary,
    currentTime,
    tracks,
    selectedClipId,
  } = useEditorStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startDurationRef = useRef(0);
  
  const windowLeft = (parentClip.startTime + (pipWindow.relativeStartTime || 0)) * zoomLevel;
  const windowWidth = Math.max(10, pipWindow.duration * zoomLevel);
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
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startXRef.current;
        const dt = dx / zoomLevel;
        const absoluteStartTime = parentClip.startTime + (pipWindow.relativeStartTime || 0);
        let newAbsoluteStart = absoluteStartTime + dt;
        // Limit start time to parent clip's range, ensuring the PIP duration doesn't exceed parent clip's end
        newAbsoluteStart = Math.max(parentClip.startTime, Math.min(parentEnd - pipWindow.duration, newAbsoluteStart));
        const newRelativeStart = newAbsoluteStart - parentClip.startTime;

        updatePipWindowStartTime(pipWindow.id, newRelativeStart);
        startXRef.current = e.clientX;
      };
      const handleMouseUp = () => setIsDragging(false);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, pipWindow.id, pipWindow.relativeStartTime, pipWindow.duration, zoomLevel, parentClip.startTime, parentEnd]);

  // Handles drag to resize PIP duration
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startDurationRef.current = pipWindow.duration;
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
      const handleMouseUp = () => setIsResizing(false);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, pipWindow.id, pipWindow.relativeStartTime, zoomLevel, parentClip.startTime, parentEnd]);

  // Handle drop media inside PIP
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const mediaId = e.dataTransfer.getData('application/x-media-id');
    if (!mediaId) return;

    const media = mediaLibrary.find(m => m.id === mediaId);
    if (!media) return;

    if (media.type !== 'video' && media.type !== 'image') return; // PIP only supports video/image

    // Get drop time relative to window
    const rect = e.currentTarget.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const timeWithinPip = dropX / zoomLevel;

    const trackType = media.type === 'image' ? 'video' : media.type;
    if (trackType !== 'video' && trackType !== 'audio' && trackType !== 'text' && trackType !== 'fx') return;

    const dur = media.type === 'video' ? (media.duration || 5) : 5;
    addTrackToPip(pipWindow.id, trackType, mediaId, timeWithinPip, dur);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/x-media-id')) {
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
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div 
        className="flex-1 relative overflow-y-auto p-2 min-h-[60px]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
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
               const clip = track.clips?.[0];
               if (!clip) return null;
               const left = clip.startTime * zoomLevel;
               const width = clip.duration * zoomLevel;
               const media = mediaLibrary.find(m => m.id === clip.mediaId);
               
               return (
                 <div key={track.id} className="relative group flex items-center h-[28px] w-full">
                   <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-[#2a2a2a] px-1 rounded-l shadow">
                     <button 
                       disabled={idx === 0}
                       onClick={() => reorderPipTrack(pipWindow.id, idx, 'up')}
                       className="text-gray-400 hover:text-white disabled:opacity-30"
                     >
                       <ChevronUp className="w-3 h-3" />
                     </button>
                     <button 
                       disabled={idx === pipWindow.tracks.length - 1}
                       onClick={() => reorderPipTrack(pipWindow.id, idx, 'down')}
                       className="text-gray-400 hover:text-white disabled:opacity-30"
                     >
                       <ChevronDown className="w-3 h-3" />
                     </button>
                   </div>
                   
                   <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        useEditorStore.setState({
                          selectedClipId: clip.id,
                          selectedClipIds: [clip.id],
                          selectedTrackId: null
                        });
                      }}
                      className={`absolute h-full rounded border overflow-hidden flex items-center justify-between cursor-pointer ${
                        selectedClipId === clip.id 
                          ? 'border-white bg-cyan-600/60 ring-2 ring-white z-20' 
                          : 'border-cyan-500/50 bg-cyan-600/30 hover:bg-cyan-600/40'
                      }`}
                      style={{ left: `${left}px`, width: `${width}px` }}
                    >
                      {media && media.thumbnail && (
                        <img src={media.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />
                      )}
                      <span className="text-[9px] text-white font-medium pl-1 truncate z-10">{media?.name}</span>
                      <button 
                        className="pr-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackFromPip(pipWindow.id, track.id);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                 </div>
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
