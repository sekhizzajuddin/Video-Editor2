import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { PipWindow, TimelineClip } from '@/types';
import { X, GripHorizontal, ChevronUp, ChevronDown, Plus, Lock, Unlock, Eye, EyeOff, Volume2, VolumeX, Trash2, Film, Music, Type, Sparkles } from 'lucide-react';
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

const PipPlayhead = React.memo(({ parentStartTime, pipRelativeStartTime, pipDuration, zoomLevel }: { parentStartTime: number, pipRelativeStartTime?: number, pipDuration: number, zoomLevel: number }) => {
  const currentTime = useEditorStore(s => s.currentTime);
  const pipAbsStart = parentStartTime + (pipRelativeStartTime || 0);
  if (currentTime >= pipAbsStart && currentTime <= pipAbsStart + pipDuration) {
    return (
      <div 
        className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
        style={{ left: `${(currentTime - pipAbsStart) * zoomLevel}px` }}
      />
    );
  }
  return null;
});

export const PipFloatingWindow = React.memo(function PipFloatingWindow({
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
    updatePipTrack,
    addTrackToPip,
    addEmptyTrackToPip,
    mediaLibrary,
    selectedClipId,
    selectedTrackId,
  } = useEditorStore(useShallow(s => ({
    updatePipWindowStartTime: s.updatePipWindowStartTime,
    updatePipWindowDuration: s.updatePipWindowDuration,
    reorderPipTrack: s.reorderPipTrack,
    removeTrackFromPip: s.removeTrackFromPip,
    updatePipTrack: s.updatePipTrack,
    addTrackToPip: s.addTrackToPip,
    addEmptyTrackToPip: s.addEmptyTrackToPip,
    mediaLibrary: s.mediaLibrary,
    selectedClipId: s.selectedClipId,
    selectedTrackId: s.selectedTrackId,
  })));

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const addTrackMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addTrackMenuRef.current && !addTrackMenuRef.current.contains(event.target as Node)) {
        setShowAddTrackMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const dragRafRef = useRef<number | null>(null);
  
  // T-22: Keep relativeStartTime in a ref so resize effect doesn't tear down on every frame
  const relativeStartRef = useRef(pipWindow.relativeStartTime || 0);
  useEffect(() => {
    relativeStartRef.current = pipWindow.relativeStartTime || 0;
  }, [pipWindow.relativeStartTime]);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        if (dragRafRef.current !== null) return;
        const clientX = e.clientX;
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          const dx = clientX - startXRef.current;
          const dt = dx / zoomLevel;
          const initialAbsoluteStart = parentClip.startTime + startRelTimeRef.current;
          let newAbsoluteStart = initialAbsoluteStart + dt;
          newAbsoluteStart = Math.max(parentClip.startTime, Math.min(parentEnd, newAbsoluteStart));
          const newRelativeStart = newAbsoluteStart - parentClip.startTime;

          updatePipWindowStartTime(pipWindow.id, newRelativeStart);
        });
      };
      const handleMouseUp = () => {
        if (dragRafRef.current !== null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        setIsDragging(false);
        useEditorStore.getState().saveSnapshot('Move PIP Window');
        useEditorStore.getState().endTransaction();
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        if (dragRafRef.current !== null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, pipWindow.id, pipWindow.duration, zoomLevel, parentClip.startTime, parentEnd, updatePipWindowStartTime]);

  // Handles drag to resize PIP duration
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startDurationRef.current = pipWindow.duration;
    useEditorStore.getState().startTransaction();
  };

  const resizeRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        if (resizeRafRef.current !== null) return;
        const clientX = e.clientX;
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = null;
          const dx = clientX - startXRef.current;
          const dt = dx / zoomLevel;
          
          const absoluteStartTime = parentClip.startTime + relativeStartRef.current;
          const maxDuration = parentEnd - absoluteStartTime;
          let newDuration = Math.max(0.5, startDurationRef.current + dt);
          newDuration = Math.min(maxDuration, Math.min(600, newDuration));
          
          updatePipWindowDuration(pipWindow.id, newDuration);
        });
      };
      const handleMouseUp = () => {
        if (resizeRafRef.current !== null) {
          cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = null;
        }
        setIsResizing(false);
        useEditorStore.getState().saveSnapshot('Resize PIP Window');
        useEditorStore.getState().endTransaction();
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        if (resizeRafRef.current !== null) {
          cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = null;
        }
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, pipWindow.id, zoomLevel, parentClip.startTime, parentEnd, updatePipWindowDuration]);

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
      data-pip-window="true"
      data-pip-id={pipWindow.id}
      className={`absolute z-50 rounded-lg shadow-2xl bg-[#2a2a2a]/95 backdrop-blur-md border border-[#4a4a4a] flex flex-col pointer-events-auto ${isCollapsed ? 'rounded-lg' : ''}`}
      style={{
        left: `${windowLeft}px`,
        top: `${windowTop}px`,
        width: `${windowWidth}px`,
        minHeight: isCollapsed ? 'auto' : '120px',
        height: isCollapsed ? 'auto' : undefined
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex items-center justify-between px-2 py-1 bg-[#1e1e1e] border-b border-[#3e3e3e] cursor-move select-none rounded-t-lg"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-1.5 text-[#a0a0a0]">
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium tracking-wide">PIP WORKSPACE</span>
        </div>
        <div className="flex items-center gap-1">
          {(() => {
            let selectedTrackIdx = pipWindow.tracks.findIndex(t => t.clips.some(c => c.id === selectedClipId));
            if (selectedTrackIdx === -1) {
              selectedTrackIdx = pipWindow.tracks.findIndex(t => t.id === selectedTrackId);
            }
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
                  
                  {/* Selected Track Actions */}
                  {(() => {
                    const selTrack = pipWindow.tracks[selectedTrackIdx];
                    const isMutedOrHidden = selTrack.type === 'audio' ? selTrack.muted : selTrack.hidden;
                    return (
                      <>
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded mr-1">
                          {selTrack.type === 'video' && <Film className="w-3 h-3 text-blue-400" />}
                          {selTrack.type === 'audio' && <Music className="w-3 h-3 text-green-400" />}
                          {selTrack.type === 'text' && <Type className="w-3 h-3 text-yellow-400" />}
                          {selTrack.type === 'fx' && <Sparkles className="w-3 h-3 text-rose-400" />}
                          <span className="text-[10px] font-semibold text-gray-300 uppercase">
                            {selTrack.name || selTrack.type.slice(0, 3)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selTrack.type === 'audio') {
                              updatePipTrack(pipWindow.id, selTrack.id, { muted: !selTrack.muted });
                            } else {
                              updatePipTrack(pipWindow.id, selTrack.id, { hidden: !selTrack.hidden });
                            }
                          }}
                          className={`p-1 rounded hover:bg-white/10 transition-colors ${isMutedOrHidden ? 'text-red-400' : 'text-gray-400 hover:text-white'}`}
                          title={selTrack.type === 'audio' ? (selTrack.muted ? 'Unmute' : 'Mute') : (selTrack.hidden ? 'Show' : 'Hide')}
                        >
                          {selTrack.type === 'audio' ? (
                            selTrack.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />
                          ) : (
                            selTrack.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updatePipTrack(pipWindow.id, selTrack.id, { locked: !selTrack.locked });
                          }}
                          className={`p-1 rounded hover:bg-white/10 transition-colors ${selTrack.locked ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
                          title={selTrack.locked ? 'Unlock' : 'Lock'}
                        >
                          {selTrack.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTrackFromPip(pipWindow.id, selTrack.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete Track"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-gray-600 mx-1"></div>
                      </>
                    );
                  })()}
                </>
              );
            }
            return null;
          })()}

          {/* Add Track Button & Dropdown */}
          <div className="relative" ref={addTrackMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddTrackMenu(!showAddTrackMenu);
              }}
              className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors flex items-center justify-center"
              title="Add Track to PIP"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {showAddTrackMenu && (
              <div className="absolute right-0 mt-1 w-24 bg-[#1e1e1e]/95 backdrop-blur-md border border-[#4a4a4a] rounded shadow-2xl z-[100] flex flex-col py-1 text-[10px]">
                {(['video', 'audio', 'text', 'fx'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={(e) => {
                      e.stopPropagation();
                      addEmptyTrackToPip(pipWindow.id, type);
                      setShowAddTrackMenu(false);
                    }}
                    className="px-3 py-1.5 text-left hover:bg-white/10 text-gray-300 hover:text-white transition-colors capitalize font-medium flex items-center gap-1.5"
                  >
                    <span>+</span> {type}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-4 bg-gray-600 mx-1"></div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            title={isCollapsed ? "Expand Workspace" : "Collapse Workspace"}
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1"></div>

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

      {!isCollapsed && (
        <div 
          className="flex-1 relative overflow-y-auto py-2 min-h-[60px] rounded-b-lg"
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
            <PipPlayhead
              parentStartTime={parentClip.startTime}
              pipRelativeStartTime={pipWindow.relativeStartTime}
              pipDuration={pipWindow.duration}
              zoomLevel={zoomLevel}
            />
             {(pipWindow.tracks || []).map((track, idx) => {
               // Render track type icon
               const TrackIcon = () => {
                 switch (track.type) {
                   case 'video': return <Film className="w-3.5 h-3.5 text-blue-400" />;
                   case 'audio': return <Music className="w-3.5 h-3.5 text-green-400" />;
                   case 'text': return <Type className="w-3.5 h-3.5 text-yellow-400" />;
                   case 'fx': return <Sparkles className="w-3.5 h-3.5 text-rose-400" />;
                   default: return null;
                 }
               };

               const isMutedOrHidden = track.type === 'audio' ? track.muted : track.hidden;

               return (
                 <div key={track.id} className="flex items-stretch bg-gray-900/60 border border-white/5 rounded-md min-h-[44px] relative overflow-hidden group">


                   {/* Clip Area */}
                   <div className="flex-1 min-w-0 relative">
                     {track.hidden ? (
                       <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] text-[10px] text-gray-500 italic select-none">
                         Track contents hidden
                       </div>
                     ) : (
                       <TimelineClipRow
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
                     )}
                   </div>
                 </div>
               );
             })}
          </div>
        )}
        </div>
      )}

      {!isCollapsed && (
        <div 
          className="absolute top-0 right-0 bottom-0 w-2 cursor-e-resize hover:bg-white/10 transition-colors group/resize z-20 flex items-center justify-center"
          onMouseDown={handleResizeStart}
        >
          <div className="w-0.5 h-4 bg-gray-500 rounded-full group-hover/resize:bg-white opacity-0 group-hover/resize:opacity-100" />
        </div>
      )}
    </div>
  );
});
