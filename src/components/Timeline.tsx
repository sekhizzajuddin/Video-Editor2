import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import {
  TRACK_HEADER_WIDTH,
  RULER_HEIGHT,
  getTrackTop,
  getTrackHeight,
  formatCentisecondTime,
  useTimelineState,
  useTimelineScroll,
  useVoiceoverRecording,
  useTimelineAI,
  useTimelineDrag,
  useTimelineDrop,
  useAudioScrubbing,
  TimelineToolbar,
  TimelineTrackHeader,
  TimelineRuler,
  TimelineClipRow,
  TimelineModals,
  FloatingScrubTooltip,
  WorkspacePlayhead,
  PlaybackAutoScroller,
  CLIP_COLORS,
  PipFloatingWindow,
  DEFAULT_TRACK_HEIGHT,
} from '@/timeline';

export function Timeline() {
  const {
    tracks,
    zoomLevel,
    selectedClipId,
    selectedClipIds,
    activeTool,
    selectedTrackId,
    draggingClipId,
    totalDuration,
    play,
    pause,
    selectClip,
    selectClips,
    selectTrack,
    seek,
    splitClip,
    zoomIn,
    zoomOut,
    toggleTrackLock,
    toggleTrackMute,
    addTrack,
    removeTrack,
    showTransitionLayer,
    selectedTransitionClipId,
    setShowTransitionLayer,
    selectTransition,
    selectedKeyframeLines,
    toggleKeyframeLineSelection,
    reorderTrack,
    inPoint,
    outPoint,
    markers,
    beatMarkers,
    settings,
    enterCompoundClip,
    setDragPreview,
    pipWindows,
    activePipWindowId,
    setActivePipWindow,
  } = useEditorStore(useShallow(s => ({
    tracks: s.tracks,
    zoomLevel: s.zoomLevel,
    selectedClipId: s.selectedClipId,
    selectedClipIds: s.selectedClipIds,
    activeTool: s.activeTool,
    selectedTrackId: s.selectedTrackId,
    draggingClipId: s.draggingClipId,
    totalDuration: s.totalDuration,
    play: s.play,
    pause: s.pause,
    selectClip: s.selectClip,
    selectClips: s.selectClips,
    selectTrack: s.selectTrack,
    seek: s.seek,
    splitClip: s.splitClip,
    zoomIn: s.zoomIn,
    zoomOut: s.zoomOut,
    toggleTrackLock: s.toggleTrackLock,
    toggleTrackMute: s.toggleTrackMute,
    addTrack: s.addTrack,
    removeTrack: s.removeTrack,
    showTransitionLayer: s.showTransitionLayer,
    selectedTransitionClipId: s.selectedTransitionClipId,
    setShowTransitionLayer: s.setShowTransitionLayer,
    selectTransition: s.selectTransition,
    selectedKeyframeLines: s.selectedKeyframeLines,
    toggleKeyframeLineSelection: s.toggleKeyframeLineSelection,
    reorderTrack: s.reorderTrack,
    inPoint: s.inPoint,
    outPoint: s.outPoint,
    markers: s.markers,
    beatMarkers: s.beatMarkers,
    settings: s.settings,
    enterCompoundClip: s.enterCompoundClip,
    setDragPreview: s.setDragPreview,
    pipWindows: s.pipWindows,
    activePipWindowId: s.activePipWindowId,
    setActivePipWindow: s.setActivePipWindow,
  })));


  // ── Hook composition ──────────────────────────────────────────────────
  
  const timelineState = useTimelineState();
  
  const {
    timelineRef,
    trackContainerRef,
    trackHeadersRef,
    rulerContainerRef,
    isScrubbing,
    hoveredTrackId,
    setHoveredTrackId,
    dropPreview,
    setDropPreview,
    snapLine,
    hoverCutClipId,
    setHoverCutClipId,
    hoverCutX,
    setHoverCutX,
    setMarkerContextMenu,
    setContextMenu,

  } = timelineState;

  const scrollHandlers = useTimelineScroll({
    trackContainerRef,
    rulerContainerRef,
    trackHeadersRef,
  });

  const voiceover = useVoiceoverRecording();

  const ai = useTimelineAI({ timelineState });

  const dragHandlers = useTimelineDrag({ timelineState });

  const dropHandlers = useTimelineDrop({ timelineState });

  useAudioScrubbing(timelineState.isScrubbing, timelineState.scrubTime);

  // ── Ruler calculations ────────────────────────────────────────────────

  // P1 FIX: Memoize PIP parent lookup — avoids O(N×M) tracks.find/clips.find
  // on every Timeline render. Only recomputes when pip state/tracks change.
  const pipData = useMemo(() => {
    if (!activePipWindowId) return null;
    const activePip = (pipWindows || {})[activePipWindowId];
    if (!activePip) return null;
    const track = tracks.find(t => t.clips?.some(c => c.id === activePip.parentClipId));
    if (!track) return null;
    const parentClip = track.clips?.find(c => c.id === activePip.parentClipId);
    if (!parentClip) return null;
    return { activePip, parentClip };
  }, [activePipWindowId, pipWindows, tracks]);

  const sortedMarkers = useMemo(() => [...markers].sort((a, b) => a.time - b.time), [markers]);

  const rulerData = useMemo(() => {
    const markersData: { time: number; label: string; type: 'major' | 'medium' | 'minor' }[] = [];

    let majorInterval = 1.0;
    let mediumInterval = 0.5;
    let minorInterval = 0.1;
    let labelMedium = true;

    if (zoomLevel >= 250) {
      majorInterval = 0.5;
      mediumInterval = 0.1;
      minorInterval = 0.02;
      labelMedium = true;
    } else if (zoomLevel >= 150) {
      majorInterval = 1.0;
      mediumInterval = 0.5;
      minorInterval = 0.1;
      labelMedium = true;
    } else if (zoomLevel >= 80) {
      majorInterval = 2.0;
      mediumInterval = 1.0;
      minorInterval = 0.2;
      labelMedium = true;
    } else if (zoomLevel >= 40) {
      majorInterval = 5.0;
      mediumInterval = 2.5;
      minorInterval = 0.5;
      labelMedium = true;
    } else if (zoomLevel >= 20) {
      majorInterval = 10.0;
      mediumInterval = 5.0;
      minorInterval = 1.0;
      labelMedium = false;
    } else {
      majorInterval = 30.0;
      mediumInterval = 10.0;
      minorInterval = 2.0;
      labelMedium = false;
    }

    const maxTime = totalDuration + 30;
    const minorCentis = Math.round(minorInterval * 100);
    const mediumCentis = Math.round(mediumInterval * 100);
    const majorCentis = Math.round(majorInterval * 100);
    const maxCentis = Math.round(maxTime * 100);

    for (let c = 0; c <= maxCentis; c += minorCentis) {
      const time = c / 100;
      let type: 'major' | 'medium' | 'minor' = 'minor';
      let label = '';

      if (c % majorCentis === 0) {
        type = 'major';
        label = formatCentisecondTime(time);
      } else if (c % mediumCentis === 0) {
        type = 'medium';
        if (labelMedium) {
          label = formatCentisecondTime(time);
        }
      } else {
        type = 'minor';
      }

      markersData.push({ time, label, type });
    }

    return markersData;
  }, [zoomLevel, totalDuration]);

  const timelineWidth = (totalDuration + 30) * zoomLevel;

  return (
    <>
      <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#3e3e3e]" ref={timelineRef}>
        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <TimelineToolbar
          zoomLevel={zoomLevel}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          addTrack={addTrack}
          showTransitionLayer={showTransitionLayer}
          setShowTransitionLayer={setShowTransitionLayer}
          activeTool={activeTool}
        />

        {/* ── Main body ────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── Track headers ──────────────────────────────────────────── */}
          <div
            className="bg-[#252525] border-r border-[#3e3e3e] flex flex-col overflow-hidden shrink-0"
            style={{ width: TRACK_HEADER_WIDTH }}
          >
            <div className="bg-[#2d2d2d] border-b border-[#3e3e3e] shrink-0" style={{ height: RULER_HEIGHT }} />

            <div
              ref={trackHeadersRef}
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: 'none' }}
              onScroll={scrollHandlers.handleHeadersScroll}
            >
              {tracks.map((track) => (
                <TimelineTrackHeader
                  key={track.id}
                  track={track}
                  tracks={tracks}
                  selectedTrackId={selectedTrackId}
                  isRecordingVoiceover={voiceover.isRecordingVoiceover}
                  recordingTrackId={voiceover.recordingTrackId}
                  recordingSeconds={voiceover.recordingSeconds}
                  selectTrack={selectTrack}
                  reorderTrack={reorderTrack}
                  removeTrack={removeTrack}
                  toggleTrackLock={toggleTrackLock}
                  toggleTrackMute={toggleTrackMute}

                  handleVoiceoverRecordingToggle={voiceover.handleVoiceoverRecordingToggle}
                />
              ))}
            </div>
          </div>

          {/* ── Workspace ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <FloatingScrubTooltip
              zoomLevel={zoomLevel}
              isScrubbing={isScrubbing}
            />

            <TimelineRuler
              rulerContainerRef={rulerContainerRef}
              timelineWidth={timelineWidth}
              zoomLevel={zoomLevel}
              inPoint={inPoint}
              outPoint={outPoint}
              sortedMarkers={sortedMarkers}
              beatMarkers={beatMarkers}
              rulerData={rulerData}
              seek={seek}
              setMarkerContextMenu={setMarkerContextMenu}
              handleRulerMouseDown={dragHandlers.handleRulerMouseDown}
            />

            <div
              ref={trackContainerRef}
              className="procut-timeline-tracks flex-1 overflow-auto relative timeline-track-workspace"
              onClick={dragHandlers.handleTimelineClick}
              onScroll={scrollHandlers.handleScroll}
            >
              <div className="relative" style={{ width: `${timelineWidth}px`, minHeight: '100%' }}>
                {/* Grid lines aligned with ruler markers */}
                {rulerData
                  .filter((m) => m.type === 'major')
                  .map((m, i) => (
                    <div
                      key={`g-${i}`}
                      className="absolute top-0 bottom-0 w-px bg-[#3e3e3e]/30 pointer-events-none"
                      style={{ left: `${m.time * zoomLevel}px` }}
                    />
                  ))}

                {/* In-point vertical dashed line */}
                {inPoint !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-px border-l border-dashed border-emerald-500/50 pointer-events-none z-20"
                    style={{ left: `${inPoint * zoomLevel}px` }}
                  />
                )}

                {/* Out-point vertical dashed line */}
                {outPoint !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-px border-l border-dashed border-red-500/50 pointer-events-none z-20"
                    style={{ left: `${outPoint * zoomLevel}px` }}
                  />
                )}

                {/* Work area shading between In and Out points */}
                {inPoint !== null && outPoint !== null && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none bg-indigo-500/5 border-l border-r border-indigo-500/20"
                    style={{
                      left: `${inPoint * zoomLevel}px`,
                      width: `${(outPoint - inPoint) * zoomLevel}px`
                    }}
                  />
                )}

                {/* Marker vertical guide lines */}
                {sortedMarkers.map((marker, i) => {
                  let nextTime = totalDuration;
                  if (marker.type === 'sponsor' || marker.type === 'chapter') {
                    const nextMarker = sortedMarkers.slice(i+1).find(m => m.time > marker.time);
                    if (nextMarker) nextTime = nextMarker.time;
                  }
                  const isSegment = marker.type === 'sponsor' || marker.type === 'chapter';

                  return (
                    <React.Fragment key={`ml-${marker.id}`}>
                      <div
                        className={`absolute top-0 bottom-0 pointer-events-none z-10 opacity-35 ${isSegment ? 'border-l-2 border-solid' : 'w-px border-l border-dashed'}`}
                        style={{
                          left: `${marker.time * zoomLevel}px`,
                          borderColor: marker.color
                        }}
                      />
                      {isSegment && (
                        <div 
                          className="absolute top-0 bottom-0 pointer-events-none z-0 opacity-5"
                          style={{
                            left: `${marker.time * zoomLevel}px`,
                            width: `${(nextTime - marker.time) * zoomLevel}px`,
                            backgroundColor: marker.color
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}

                {/* ── Tracks ─────────────────────────────────────────── */}
                {tracks.map((track) => {
                  if (track.hidden) return null;
                  return (
                    <TimelineClipRow
                      key={track.id}
                      track={track}
                      tracks={tracks}
                      zoomLevel={zoomLevel}
                      selectedClipIds={selectedClipIds}
                      draggingClipId={draggingClipId}
                      activeTool={activeTool}
                      hoverCutClipId={hoverCutClipId}
                      hoverCutX={hoverCutX}
                      handleDragOver={dropHandlers.handleDragOver}
                      handleDrop={dropHandlers.handleDrop}
                      setHoveredTrackId={setHoveredTrackId}
                      setDropPreview={setDropPreview}
                      setContextMenu={setContextMenu}
                      handleClipMouseDown={dragHandlers.handleClipMouseDown}
                      setHoverCutX={setHoverCutX}
                      setHoverCutClipId={setHoverCutClipId}
                      enterCompoundClip={enterCompoundClip}
                      toggleKeyframeLineSelection={toggleKeyframeLineSelection}
                      selectedKeyframeLines={selectedKeyframeLines}
                      showTransitionLayer={showTransitionLayer}
                      selectedTransitionClipId={selectedTransitionClipId}
                      hoveredTrackId={hoveredTrackId}
                      selectTrack={selectTrack}
                      selectClip={selectClip}
                      selectTransition={selectTransition}
                    />
                  );
                })}

                {/* ── Drop preview ghost clip ──────────────────────── */}
                {dropPreview && hoveredTrackId && (() => {
                  const mediaType = dropPreview.mediaType || 'video';
                  const colors = CLIP_COLORS[mediaType] || CLIP_COLORS.video;
                  const hoveredTrackIdx = tracks.findIndex((t) => t.id === hoveredTrackId);
                  const activeTrackIdx = hoveredTrackIdx >= 0 ? hoveredTrackIdx : dropPreview.trackIdx;
                  return (
                    <div
                      className={`absolute rounded pointer-events-none z-40 border-2 border-dashed shadow-lg opacity-70 ${colors.bg} ${colors.border}`}
                      style={{
                        top: `${getTrackTop(tracks, activeTrackIdx) + 4}px`,
                        left: `${dropPreview.time * zoomLevel}px`,
                        width: `${Math.max(16, dropPreview.duration * zoomLevel)}px`,
                        height: `${(activeTrackIdx < tracks.length ? getTrackHeight(tracks[activeTrackIdx]) : DEFAULT_TRACK_HEIGHT) - 8}px`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center px-2 overflow-hidden pointer-events-none">
                        <span className={`text-[10px] font-medium truncate ${colors.text} drop-shadow-md`}>
                          {dropPreview.mediaName || 'Drop here'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── PIP Floating Window ──────────────────────── */}
                {pipData && (
                  <PipFloatingWindow
                    key={pipData.activePip.id}
                    pipWindow={pipData.activePip}
                    parentClip={pipData.parentClip}
                    zoomLevel={zoomLevel}
                    onClose={() => setActivePipWindow(null)}
                    tracks={tracks}
                    selectedClipIds={selectedClipIds}
                    draggingClipId={draggingClipId}
                    activeTool={activeTool}
                    hoverCutClipId={hoverCutClipId}
                    hoverCutX={hoverCutX}
                    handleDragOver={dropHandlers.handleDragOver}
                    handleDrop={dropHandlers.handleDrop}
                    setHoveredTrackId={setHoveredTrackId}
                    setDropPreview={setDropPreview}
                    setContextMenu={setContextMenu}
                    handleClipMouseDown={dragHandlers.handleClipMouseDown}
                    setHoverCutX={setHoverCutX}
                    setHoverCutClipId={setHoverCutClipId}
                    selectTrack={selectTrack}
                    selectClip={selectClip}
                    selectTransition={selectTransition}
                  />
                )}

                {/* Snap indicator line */}
                {snapLine !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-yellow-400 z-50 pointer-events-none"
                    style={{ left: `${snapLine}px` }}
                  />
                )}

                {/* Workspace playhead needle */}
                <WorkspacePlayhead zoomLevel={zoomLevel} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <PlaybackAutoScroller
        zoomLevel={zoomLevel}
        totalDuration={totalDuration}
        trackContainerRef={trackContainerRef}
      />

      <TimelineModals
        timelineState={timelineState}
        tracks={tracks}
        markers={sortedMarkers}
        recordingSeconds={voiceover.recordingSeconds}
        handleGenerateSubtitles={ai.handleGenerateSubtitles}
        handleOpenSfxGenerator={ai.handleOpenSfxGenerator}
        handleGenerateSFX={ai.handleGenerateSFX}
        handleAuditionSFX={ai.handleAuditionSFX}
        handleAutoCueSFX={ai.handleAutoCueSFX}
        handleVoiceoverRecordingToggle={voiceover.handleVoiceoverRecordingToggle}
      />
    </>
  );
}
