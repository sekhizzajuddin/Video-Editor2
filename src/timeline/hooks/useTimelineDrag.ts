import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { getRampedTrimEndForRightResize, getRampedTrimStartForLeftResize, getSpeedRampEngine } from '@/utils/speedRamp';
import { getTrackHeight, getTrackTop, getTrackAtY } from '../trackGeometry';
import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT, SNAP_THRESHOLD_PX } from '../timelineConstants';
import type { TimelineState } from './useTimelineState';

interface UseTimelineDragDeps {
  timelineState: TimelineState;
}

const areClipsContiguousInTime = (draggedClips: { id: string; originalStartTime: number }[], tracks: any[]) => {
  if (draggedClips.length <= 1) return true;
  
  const clipsWithTime = draggedClips.map(dc => {
     const allClips = tracks?.flatMap(t => t.clips || []) || [];
     const c = allClips.find(x => x?.id === dc.id);
     return { start: dc.originalStartTime, end: dc.originalStartTime + (c?.duration || 0) };
  });
  
  clipsWithTime.sort((a, b) => a.start - b.start);
  
  let currentEnd = clipsWithTime[0].end;
  for (let i = 1; i < clipsWithTime.length; i++) {
     // 0.1s tolerance for gaps
     if (clipsWithTime[i].start > currentEnd + 0.1) {
        return false;
     }
     currentEnd = Math.max(currentEnd, clipsWithTime[i].end);
  }
  return true;
};
const getLatestTracks = (clipId: string | null): TimelineTrack[] => {
  const state = useEditorStore.getState();
  if (!clipId) return state.tracks;
  const found = findClipDeep(state, clipId);
  if (found && found.isPip && found.pipId) {
    const pip = (state.pipWindows || {})[found.pipId];
    if (pip) return pip.tracks;
  }
  return state.tracks;
};
export function useTimelineDrag({ timelineState }: UseTimelineDragDeps) {
  const {
    tracks,
    zoomLevel,
    activeTool,
    settings,
    selectedClipId,
    selectedClipIds,
    selectedTransitionClipId,
    selectedTrackId,
    moveClip,
    moveClips,
    updateClip,
    setDraggingClipId,
    resolveOverlaps,
    selectClip,
    selectClips,
    selectTrack,
    selectTransition,
    seek,
    splitClip,
    setDragPreview,
  } = useEditorStore(useShallow(s => ({
    tracks: s.tracks,
    zoomLevel: s.zoomLevel,
    activeTool: s.activeTool,
    settings: s.settings,
    selectedClipId: s.selectedClipId,
    selectedClipIds: s.selectedClipIds,
    selectedTransitionClipId: s.selectedTransitionClipId,
    selectedTrackId: s.selectedTrackId,
    moveClip: s.moveClip,
    moveClips: s.moveClips,
    updateClip: s.updateClip,
    setDraggingClipId: s.setDraggingClipId,
    resolveOverlaps: s.resolveOverlaps,
    selectClip: s.selectClip,
    selectClips: s.selectClips,
    selectTrack: s.selectTrack,
    selectTransition: s.selectTransition,
    seek: s.seek,
    splitClip: s.splitClip,
    setDragPreview: s.setDragPreview,
  })));

  const dragRafIdRef = useRef<number | null>(null);
  const resizeRafIdRef = useRef<number | null>(null);


  const {
    trackContainerRef,
    dragState,
    setDragState,
    resizeState,
    setResizeState,

    slipState,
    setSlipState,
    slideState,
    setSlideState,
    snapLine,
    setSnapLine,
    isScrubbing,
    setIsScrubbing,
    scrubTime,
    setScrubTime,
    scrubMouseX,
    setScrubMouseX,
    transactionActiveRef,
    startTransactionSafe,
    endTransactionSafe,
    scrollIntervalRef,
    dragMouseXRef,
    dragMouseYRef,
    scrubRafIdRef,
    handleMouseMoveRef,
    handleMouseUpRef,
    setDropPreview,
  } = timelineState;

  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const mediaMap = useRef(new Map<string, MediaItem>());
  useEffect(() => {
    const map = new Map<string, MediaItem>();
    mediaLibrary.forEach((m) => map.set(m.id, m));
    mediaMap.current = map;
  }, [mediaLibrary]);

  const getMediaSafe = useCallback((clip: TimelineClip): MediaItem => {
    return mediaMap.current.get(clip.mediaId) ?? ({
      id: clip.mediaId,
      name: 'Unknown',
      type: 'video' as const,
      duration: 30,
      url: '',
      createdAt: Date.now()
    } as MediaItem);
  }, []);

  const getTrackFromMouseY = useCallback((clientY: number, clipId: string | null = null): TimelineTrack | null => {
    const container = trackContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const relY = clientY - rect.top + container.scrollTop;
    const latestTracks = getLatestTracks(clipId);
    const idx = getTrackAtY(latestTracks, relY);
    return idx >= 0 && idx < latestTracks.length ? latestTracks[idx] : null;
  }, [trackContainerRef]);

  const computeSnap = useCallback((rawTime: number, movingClipId: string, movingDuration: number) => {
    if (!settings.snapEnabled) {
      return { snappedTime: rawTime, snapPos: null };
    }
    const threshold = SNAP_THRESHOLD_PX / zoomLevel;
    const latestTracks = getLatestTracks(movingClipId);

    // Collect snap targets: all other clip edges + the playhead
    const targets: number[] = [useEditorStore.getState().currentTime]; // snap to playhead
    for (const track of latestTracks) {
      for (const clip of track.clips) {
        if (clip.id === movingClipId) continue;
        targets.push(clip.startTime);
        targets.push(clip.startTime + clip.duration);
      }

    }

    const edges = [rawTime, rawTime + movingDuration];
    let bestDelta = Infinity;
    let snappedTime = rawTime;
    let snapPos: number | null = null;

    for (const target of targets) {
      for (const edge of edges) {
        const delta = Math.abs(edge - target);
        if (delta < threshold && delta < bestDelta) {
          bestDelta = delta;
          if (edge === rawTime) {
            snappedTime = target;
          } else {
            snappedTime = target - movingDuration;
          }
          snapPos = target * zoomLevel;
        }
      }
    }

    return { snappedTime: Math.max(0, snappedTime), snapPos };
  }, [zoomLevel, settings.snapEnabled]);

  const updateDragPosition = useCallback((clientX: number, clientY: number, currScrollLeft: number) => {
    if (!dragState || !dragState.draggedClips || dragState.draggedClips.length === 0) return;

    const dx = (clientX - dragState.startX) + (currScrollLeft - dragState.originalScrollLeft);
    const dt = dx / zoomLevel;
    let newTime = Math.max(0, dragState.originalStartTime + dt);

    const actualHoverTrack = getTrackFromMouseY(clientY, dragState.clipId);
    const state = useEditorStore.getState();
    const found = findClipDeep(state, dragState.clipId);
    const isPip = !!(found && found.isPip);

    const targetTrackId = isPip
      ? dragState.trackId
      : (actualHoverTrack && actualHoverTrack.type === dragState.trackType ? actualHoverTrack.id : dragState.trackId);

    const latestTracks = getLatestTracks(dragState.clipId);
    const movingClip = findClipDeep(state, dragState.clipId)?.clip;
    const movingDuration = movingClip?.duration ?? 0;

    const { snappedTime, snapPos } = computeSnap(newTime, dragState.clipId, movingDuration);
    newTime = snappedTime;
    setSnapLine(snapPos);

    const minOriginalStart = Math.min(...dragState.draggedClips.map(c => c.originalStartTime));
    const clampedFinalDt = Math.max(-minOriginalStart, newTime - dragState.originalStartTime);

    if (dragState.draggedClips.length >= 1) {
      setDragPreview(0, null);

      const sourceTrackIdx = latestTracks.findIndex((t) => t.id === dragState.trackId);
      const targetTrackIdx = latestTracks.findIndex((t) => t.id === targetTrackId);
      const trackDelta = targetTrackIdx - sourceTrackIdx;

      let finalUpdates = null;
      let hasOverlap = false;

      // Try bumps to automatically hop tracks: 0, -1, 1, -2, 2, -3, 3, -4, 4
      const bumpOffsets = [0, -1, 1, -2, 2, -3, 3, -4, 4];

      for (const bump of bumpOffsets) {
        hasOverlap = false;
        const testUpdates = [];

        for (const c of dragState.draggedClips) {
          const clipNewTime = c.originalStartTime + clampedFinalDt;
          const clipTrackIdx = latestTracks.findIndex((t) => t.id === c.trackId);
          const newTrackIdx = clipTrackIdx + trackDelta + bump;
          const originalTrack = latestTracks.find((t) => t.id === c.trackId);
          const targetTrack = latestTracks[newTrackIdx];

          const targetTrackIdForClip =
            targetTrack && originalTrack && targetTrack.type === originalTrack.type
              ? targetTrack.id
              : null; // Out of bounds or type mismatch

          if (!targetTrackIdForClip) {
            hasOverlap = true; // Cannot bump here
            break;
          }

          const originalClip = findClipDeep(state, c.id)?.clip;
          testUpdates.push({
            clipId: c.id,
            newStartTime: clipNewTime,
            newTrackId: targetTrackIdForClip,
            originalDuration: originalClip?.duration || 0
          });
        }

        if (hasOverlap) continue;

        // Check if testUpdates have physical overlaps on these tracks
        const draggedIds = new Set(testUpdates.map(u => u.clipId));
        for (const update of testUpdates) {
          const targetTrack = latestTracks.find(t => t.id === update.newTrackId);
          if (!targetTrack) continue;
          const newStart = update.newStartTime;
          const newEnd = newStart + update.originalDuration;
          
          for (const clip of targetTrack.clips) {
            if (draggedIds.has(clip.id)) continue;
            const clipEnd = clip.startTime + clip.duration;
            // Intersection check
            if (newStart < clipEnd - 0.001 && clip.startTime < newEnd - 0.001) {
              hasOverlap = true;
              break;
            }
          }
          if (hasOverlap) break;
        }

        if (!hasOverlap) {
          finalUpdates = testUpdates;
          break; // Found a valid track placement!
        }
      }

      // If a valid non-overlapping placement was found, apply it. Otherwise, block movement.
      if (finalUpdates) {
        // Filter out duplicate clip updates (just in case)
        const seen = new Set<string>();
        const uniqueUpdates = finalUpdates.filter((u) => {
          if (seen.has(u.clipId)) return false;
          seen.add(u.clipId);
          return true;
        }).map(u => ({ clipId: u.clipId, newStartTime: u.newStartTime, newTrackId: u.newTrackId }));

        moveClips(uniqueUpdates, false);
      }
    }
  }, [dragState, zoomLevel, getTrackFromMouseY, computeSnap, moveClips, setDragPreview, setSnapLine]);

  const updateDragPositionRef = useRef(updateDragPosition);
  useEffect(() => {
    updateDragPositionRef.current = updateDragPosition;
  }, [updateDragPosition]);

  // Auto-scroll loop when dragging
  useEffect(() => {
    if (!dragState) {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      dragMouseXRef.current = null;
      dragMouseYRef.current = null;
      return;
    }

    const checkScroll = () => {
      const container = trackContainerRef.current;
      if (!container || dragMouseXRef.current === null || dragMouseYRef.current === null) return;

      const rect = container.getBoundingClientRect();
      const mouseX = dragMouseXRef.current;
      const mouseY = dragMouseYRef.current;

      const scrollSpeed = 8;
      const edgeThreshold = 40;
      let scrolled = false;
      let nextScrollLeft = container.scrollLeft;

      if (mouseX > rect.right - edgeThreshold) {
        nextScrollLeft = Math.min(
          container.scrollWidth - container.clientWidth,
          container.scrollLeft + scrollSpeed
        );
        if (nextScrollLeft !== container.scrollLeft) {
          container.scrollLeft = nextScrollLeft;
          scrolled = true;
        }
      } else if (mouseX < rect.left + edgeThreshold) {
        nextScrollLeft = Math.max(0, container.scrollLeft - scrollSpeed);
        if (nextScrollLeft !== container.scrollLeft) {
          container.scrollLeft = nextScrollLeft;
          scrolled = true;
        }
      }

      if (scrolled) {
        updateDragPositionRef.current(mouseX, mouseY, nextScrollLeft);
      }
    };

    scrollIntervalRef.current = setInterval(checkScroll, 16);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [dragState, trackContainerRef, scrollIntervalRef, dragMouseXRef, dragMouseYRef]);

  const startResize = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, edge: 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;
      
      startTransactionSafe();

      let rippleClips: { id: string; originalStartTime: number }[] = [];
      if ((activeTool === 'ripple' || activeTool === 'rateStretch') && track) {
        // ALWAYS ripple downstream (right-side) clips regardless of which edge is trimmed!
        rippleClips = track.clips
          .filter((c) => c.id !== clip.id && c.startTime >= clip.startTime)
          .map((c) => ({ id: c.id, originalStartTime: c.startTime }));
      }

      let sibling: any = undefined;
      if (clip.splitGroupId && track) {
        const siblingClips = track.clips
          .filter((c) => c.id !== clip.id && c.splitGroupId === clip.splitGroupId)
          .sort((a, b) => a.trimStart - b.trimStart);
        if (edge === 'left') {
          const prev = siblingClips.reverse().find((c) => c.trimStart + c.duration <= clip.trimStart + 0.001);
          if (prev) {
            sibling = {
              id: prev.id,
              originalTrimStart: prev.trimStart,
              originalTrimEnd: prev.trimEnd,
              originalDuration: prev.duration,
              originalStartTime: prev.startTime,
              speed: prev.speed,
              speedRamp: prev.speedRamp,
              mediaId: prev.mediaId,
            };
          }
        } else {
          const next = siblingClips.find((c) => c.trimStart >= clip.trimStart + clip.duration - 0.001);
          if (next) {
            sibling = {
              id: next.id,
              originalTrimStart: next.trimStart,
              originalTrimEnd: next.trimEnd,
              originalDuration: next.duration,
              originalStartTime: next.startTime,
              speed: next.speed,
              speedRamp: next.speedRamp,
              mediaId: next.mediaId,
            };
          }
        }
      }

      setResizeState({
        clipId: clip.id,
        edge,
        startX: e.clientX,
        originalDuration: clip.duration,
        originalTrimStart: clip.trimStart,
        originalTrimEnd: clip.trimEnd,
        originalStartTime: clip.startTime,
        originalSpeed: clip.speed,
        siblingClip: sibling,
        rippleClips,
      });
    },
    [tracks, activeTool, startTransactionSafe, setResizeState],
  );

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      if (e.button !== 0) return;
      let track = tracks.find((t) => t.id === clip.trackId);
      if (!track) {
        const pipWindows = useEditorStore.getState().pipWindows || {};
        for (const pip of Object.values(pipWindows)) {
          track = pip.tracks.find((t) => t.id === clip.trackId);
          if (track) break;
        }
      }
      if (track?.locked) return;

      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const currentScrollLeft = useEditorStore.getState().scrollLeft;
      
      const state = useEditorStore.getState();
      const found = findClipDeep(state, clip.id);
      let absoluteStartTime = clip.startTime;
      if (found && found.isPip && found.pipId) {
        const pip = (state.pipWindows || {})[found.pipId];
        if (pip) {
          let parentClip = null;
          for (const t of state.tracks) {
            parentClip = t.clips.find((c) => c.id === pip.parentClipId);
            if (parentClip) break;
          }
          if (parentClip) {
            absoluteStartTime = parentClip.startTime + (pip.relativeStartTime || 0) + clip.startTime;
          }
        }
      }

      const clickTime = absoluteStartTime + relX / zoomLevel;
      seek(Math.max(0, clickTime));

      const clickedEdge = (e.target as HTMLElement).getAttribute('data-edge');
      if (clickedEdge === 'left' || clickedEdge === 'right') {
        startTransactionSafe();
        startResize(e, clip, clickedEdge as 'left' | 'right');
        return;
      }

      const distLeft = relX;
      const distRight = rect.width - relX;
      const grabArea = 8; // pixels

      if (distLeft <= grabArea || distRight <= grabArea) {
        startTransactionSafe();
        if (distLeft <= distRight) {
          startResize(e, clip, 'left');
        } else {
          startResize(e, clip, 'right');
        }
        return;
      }

      const latestTracks = getLatestTracks(clip.id);

      if (activeTool === 'trackSelect') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        const thresholdTime = clip.startTime; // Include the clicked clip
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime >= thresholdTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = latestTracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime >= thresholdTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = findClipDeep(state, id)?.clip;
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });

        setDraggingClipId(clip.id);
        setDragState({
          clipId: clip.id,
          startX: e.clientX,
          startY: e.clientY,
          originalStartTime: clip.startTime,
          originalScrollLeft: currentScrollLeft,
          trackId: clip.trackId,
          trackType: track?.type || 'video',
          draggedClips,
        });

        e.stopPropagation();
        return;
      }

      if (activeTool === 'trackSelectBackward') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        const thresholdTime = clip.startTime + clip.duration; // Include the clicked clip
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime <= thresholdTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = latestTracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime <= thresholdTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = findClipDeep(state, id)?.clip;
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });

        setDraggingClipId(clip.id);
        setDragState({
          clipId: clip.id,
          startX: e.clientX,
          startY: e.clientY,
          originalStartTime: clip.startTime,
          originalScrollLeft: currentScrollLeft,
          trackId: clip.trackId,
          trackType: track?.type || 'video',
          draggedClips,
        });

        e.stopPropagation();
        return;
      }

      if (activeTool === 'split') {
        const clickTime = clip.startTime + relX / zoomLevel;
        splitClip(clip.id, clickTime);
        return;
      }

      if (activeTool === 'slip') {
        startTransactionSafe();
        setSlipState({
          clipId: clip.id,
          startX: e.clientX,
          originalTrimStart: clip.trimStart,
          originalTrimEnd: clip.trimEnd,
        });
        e.stopPropagation();
        return;
      }

      if (activeTool === 'slide') {
        startTransactionSafe();
        
        // Find adjacent clips for slide tool constraints with 0.1s tolerance
        const leftSib = track?.clips.find(c => Math.abs((c.startTime + c.duration) - clip.startTime) < 0.1);
        const rightSib = track?.clips.find(c => Math.abs(c.startTime - (clip.startTime + clip.duration)) < 0.1);
        
        setSlideState({
          clipId: clip.id,
          startX: e.clientX,
          originalStartTime: clip.startTime,
          adjacentClips: {
            left: leftSib ? { id: leftSib.id, originalTrimEnd: leftSib.trimEnd, originalDuration: leftSib.duration } : undefined,
            right: rightSib ? { id: rightSib.id, originalTrimStart: rightSib.trimStart, originalDuration: rightSib.duration, originalStartTime: rightSib.startTime } : undefined,
          },
        });
        e.stopPropagation();
        return;
      }

      let currentSelectedIds = selectedClipIds;
      if (e.ctrlKey || e.metaKey) {
        const isAlreadySel = selectedClipIds.includes(clip.id);
        currentSelectedIds = isAlreadySel
          ? selectedClipIds.filter((id) => id !== clip.id)
          : [...selectedClipIds, clip.id];
        selectClips(currentSelectedIds);
      } else {
        const isAlreadySelected = selectedClipIds.includes(clip.id);
        if (!isAlreadySelected) {
          selectClip(clip.id);
          currentSelectedIds = [clip.id];
        }
      }

      let draggedClips: { id: string; originalStartTime: number; trackId: string }[] = [];
      if (currentSelectedIds.includes(clip.id)) {
        draggedClips = currentSelectedIds.map((id) => {
          const c = findClipDeep(useEditorStore.getState(), id)?.clip;
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });
      }

      startTransactionSafe();
      setDraggingClipId(clip.id);
      setDragState({
        clipId: clip.id,
        startX: e.clientX,
        startY: e.clientY,
        originalStartTime: clip.startTime,
        originalScrollLeft: currentScrollLeft,
        trackId: clip.trackId,
        trackType: track?.type || 'video',
        draggedClips,
      });

      e.stopPropagation();
    },
    [tracks, activeTool, splitClip, zoomLevel, selectClip, selectClips, selectedClipIds, startTransactionSafe, startResize, setDragState, setDraggingClipId, setSlipState, setSlideState],
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'split') return;
      const hasSelection = selectedClipId !== null || 
                          selectedClipIds.length > 0 || 
                          selectedTransitionClipId !== null || 
                          selectedTrackId !== null;
      selectClip(null);
      selectTransition(null);
      selectTrack(null);

      const rect = trackContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scroll = trackContainerRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scroll;
      seek(Math.max(0, x / zoomLevel));
    },
    [activeTool, zoomLevel, seek, selectClip, selectTransition, selectTrack, selectedClipId, selectedClipIds, selectedTransitionClipId, selectedTrackId, trackContainerRef],
  );

  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsScrubbing(true);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const currentScrollLeft = useEditorStore.getState().scrollLeft;
      const x = e.clientX - rect.left + currentScrollLeft;
      const time = Math.max(0, x / zoomLevel);
      
      setScrubTime(time);
      setScrubMouseX(e.clientX);
      seek(time);

      e.preventDefault();
      e.stopPropagation();
    },
    [zoomLevel, seek, setIsScrubbing, setScrubTime, setScrubMouseX],
  );

  const handleSplit = useCallback(
    (clipId: string) => {
      splitClip(clipId, useEditorStore.getState().currentTime);
    },
    [splitClip],
  );

  const lastScrubTimeRef = useRef<number>(0);
  const lastScrubStateUpdateRef = useRef<number>(0);
  const latestClientXRef = useRef<number>(0);

  const handleMouseMove = (e: MouseEvent) => {
    if (isScrubbing) {
      latestClientXRef.current = e.clientX;
      if (scrubRafIdRef.current === null) {
        scrubRafIdRef.current = requestAnimationFrame(() => {
          scrubRafIdRef.current = null;
          const clientX = latestClientXRef.current;
          const rect = trackContainerRef.current?.getBoundingClientRect();
          if (rect) {
            const currentScrollLeft = useEditorStore.getState().scrollLeft;
            const x = clientX - rect.left + currentScrollLeft;
            const time = Math.max(0, x / zoomLevel);
            
            const now = performance.now();
            if (now - lastScrubTimeRef.current > 40) {
              seek(time);
              lastScrubTimeRef.current = now;
            }
            
            const scrubNow = performance.now();
            if (scrubNow - lastScrubStateUpdateRef.current > 33) {
              setScrubTime(time);
              setScrubMouseX(clientX);
              lastScrubStateUpdateRef.current = scrubNow;
            }
          }
        });
      }
    }

    if (dragState && dragState.draggedClips && dragState.draggedClips.length > 0) {
      dragMouseXRef.current = e.clientX;
      dragMouseYRef.current = e.clientY;
      if (dragRafIdRef.current !== null) {
        cancelAnimationFrame(dragRafIdRef.current);
      }
      const clientX = e.clientX;
      const clientY = e.clientY;
      dragRafIdRef.current = requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        const currentScrollLeft = useEditorStore.getState().scrollLeft;
        updateDragPosition(clientX, clientY, currentScrollLeft);
      });
    }

    if (resizeState) {
      const clientX = e.clientX;
      if (resizeRafIdRef.current !== null) {
        cancelAnimationFrame(resizeRafIdRef.current);
      }
      resizeRafIdRef.current = requestAnimationFrame(() => {
        resizeRafIdRef.current = null;
        const dx = clientX - resizeState.startX;
        const dt = dx / zoomLevel;
        const latestTracks = getLatestTracks(resizeState.clipId);
        const clip = findClipDeep(useEditorStore.getState(), resizeState.clipId)?.clip;
        if (!clip) return;

        const media = getMediaSafe(clip);
        const sourceDuration = media.duration || 30;

        if (activeTool === 'rateStretch') {
          const originalSpeed = resizeState.originalSpeed || 1.0;
          const sourceContentDuration = resizeState.originalDuration * originalSpeed;
          if (resizeState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
            const newSpeed = sourceContentDuration / newDuration;
            const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            const clampedDuration = sourceContentDuration / clampedSpeed;
            const delta = clampedDuration - resizeState.originalDuration;

            updateClip(resizeState.clipId, {
              duration: clampedDuration,
              speed: clampedSpeed,
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + delta,
                });
              });
            }
          } else {
            const shrink = -dt; // dragging right (shrink) -> shrink > 0, dragging left (expand) -> shrink < 0
            
            // Dragging left means dt < 0. We want the box to grow, so newDuration = originalDuration - dt.
            const newDur = Math.max(0.1, resizeState.originalDuration - dt);
            
            // Max duration is limited by the left-side adjacent clip
            let maxDuration = Infinity;
            const latestTracks = getLatestTracks(resizeState.clipId);
            const originalTrack = latestTracks.find((t) => t.clips.some(c => c.id === resizeState.clipId));
            if (originalTrack) {
               const prevClip = originalTrack.clips
                 .filter((c: TimelineClip) => c.id !== resizeState.clipId && c.startTime < resizeState.originalStartTime)
                 .sort((a: TimelineClip, b: TimelineClip) => b.startTime - a.startTime)[0];
               if (prevClip) {
                  const availableSpace = resizeState.originalStartTime - (prevClip.startTime + prevClip.duration);
                  maxDuration = resizeState.originalDuration + Math.max(0, availableSpace);
               }
            }
            const limitedDuration = Math.min(newDur, maxDuration);
            
            const newSpeed = sourceContentDuration / limitedDuration;
            const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            const clampedDuration = sourceContentDuration / clampedSpeed;
            const shift = resizeState.originalDuration - clampedDuration;

            updateClip(resizeState.clipId, {
              startTime: resizeState.originalStartTime + shift,
              duration: clampedDuration,
              speed: clampedSpeed,
              trimStart: resizeState.originalTrimStart,
              trimEnd: resizeState.originalTrimEnd,
            });
          }
          return;
        }

        if (activeTool === 'ripple') {
          const isRamped = clip.speedRamp && clip.speedRamp.length >= 2;
          if (resizeState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
            
            let maxDuration = 0;
            if (isRamped) {
              const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
              const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
              maxDuration = engine.sourceToTimeline(sourceDuration) - localTimelineStart;
            } else {
              maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
            }
            const clamped = Math.min(newDuration, maxDuration);
            const delta = clamped - resizeState.originalDuration;

            const newTrimEnd = isRamped
              ? getRampedTrimEndForRightResize(clip, clamped, sourceDuration)
              : resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;

            updateClip(resizeState.clipId, {
              duration: clamped,
              trimEnd: Math.max(0, newTrimEnd),
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + delta,
                });
              });
            }
          } else {
            const shrink = dt; // dragging right (shrink) -> dt > 0, dragging left (expand) -> dt < 0
            const newDuration = Math.max(0.1, resizeState.originalDuration - shrink);
            
            let maxDuration = 0;
            if (isRamped) {
              const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
              const maxExpansion = engine.sourceToTimeline(clip.trimStart);
              maxDuration = resizeState.originalDuration + maxExpansion;
            } else {
              const maxExpansion = resizeState.originalTrimStart / clip.speed;
              maxDuration = resizeState.originalDuration + maxExpansion;
            }
            
            let clampedDuration = Math.min(newDuration, maxDuration);
            const deltaDuration = clampedDuration - resizeState.originalDuration; // positive if expand, negative if shrink

            const newTrimStart = isRamped
              ? getRampedTrimStartForLeftResize(clip, -deltaDuration)
              : resizeState.originalTrimStart - deltaDuration * clip.speed;

            updateClip(resizeState.clipId, {
              duration: clampedDuration,
              trimStart: Math.max(0, newTrimStart),
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + deltaDuration,
                });
              });
            }
          }
          return;
        }

        const isRamped = clip.speedRamp && clip.speedRamp.length >= 2;
        if (resizeState.edge === 'right') {
          let newDuration = Math.max(0.1, resizeState.originalDuration + dt);
          
          let maxDuration = 0;
          if (isRamped) {
            const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
            const localTimelineStart = engine.sourceToTimeline(clip.trimStart);
            maxDuration = engine.sourceToTimeline(sourceDuration) - localTimelineStart;
          } else {
            maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
          }
          let clamped = Math.min(newDuration, maxDuration);

          if (resizeState.siblingClip) {
            const sib = resizeState.siblingClip;
            let delta = clamped - resizeState.originalDuration; // >0 if A expands, <0 if A shrinks
            const isSibRamped = sib.speedRamp && sib.speedRamp.length >= 2;
            
            if (delta > 0) {
               const maxDelta = sib.originalDuration - 0.1;
               if (delta > maxDelta) {
                 delta = maxDelta;
                 clamped = resizeState.originalDuration + delta;
               }
            } else if (delta < 0) {
               let maxExpandB = 0;
               if (isSibRamped) {
                 const sibEngine = getSpeedRampEngine(sib.id, sib.speedRamp!);
                 maxExpandB = sibEngine.sourceToTimeline(sib.originalTrimStart);
               } else {
                 maxExpandB = sib.originalTrimStart / sib.speed;
               }
               if (-delta > maxExpandB) {
                 delta = -maxExpandB;
                 clamped = resizeState.originalDuration + delta;
               }
            }
            
            const sibNewTrimStart = isSibRamped
              ? getRampedTrimStartForLeftResize(sib as any, delta)
              : sib.originalTrimStart + (delta * sib.speed);

            updateClip(sib.id, {
              startTime: sib.originalStartTime + delta,
              duration: sib.originalDuration - delta,
              trimStart: Math.max(0, sibNewTrimStart),
            });
          }

          const newTrimEnd = isRamped
            ? getRampedTrimEndForRightResize(clip, clamped, sourceDuration)
            : resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
          updateClip(resizeState.clipId, {
            duration: clamped,
            trimEnd: Math.max(0, newTrimEnd),
          });
        } else {
          const shrink = -dt;
          const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
          
          let maxDuration = 0;
          if (isRamped) {
            const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
            maxDuration = engine.sourceToTimeline(sourceDuration - clip.trimEnd);
          } else {
            maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
          }
          let clamped = Math.min(newDuration, maxDuration);
          let shift = resizeState.originalDuration - clamped;

          if (resizeState.siblingClip) {
            const sib = resizeState.siblingClip;
            const isSibRamped = sib.speedRamp && sib.speedRamp.length >= 2;
            const sibMedia = getMediaSafe(sib as unknown as TimelineClip);
            const sibSourceDuration = sibMedia.duration || 30;
            
            if (shift < 0) {
              const maxShrinkA = sib.originalDuration - 0.1;
              if (-shift > maxShrinkA) {
                shift = -maxShrinkA;
                clamped = resizeState.originalDuration - shift;
               }
            } else if (shift > 0) {
              let maxExpandA = 0;
              if (isSibRamped) {
                const sibEngine = getSpeedRampEngine(sib.id, sib.speedRamp!);
                maxExpandA = sibEngine.sourceToTimeline(sibSourceDuration) - sibEngine.sourceToTimeline(sibSourceDuration - sib.originalTrimEnd);
              } else {
                maxExpandA = sib.originalTrimEnd / sib.speed;
              }
              if (shift > maxExpandA) {
                shift = maxExpandA;
                clamped = resizeState.originalDuration - shift;
              }
            }

            const sibNewTrimEnd = isSibRamped
              ? getRampedTrimEndForRightResize(sib as any, sib.originalDuration + shift, sibSourceDuration)
              : sib.originalTrimEnd - (shift * sib.speed);

            updateClip(sib.id, {
              duration: sib.originalDuration + shift,
              trimEnd: Math.max(0, sibNewTrimEnd),
            });
          }

          const newTrimStart = isRamped
            ? getRampedTrimStartForLeftResize(clip, shift)
            : resizeState.originalTrimStart + shift * clip.speed;

          updateClip(resizeState.clipId, {
            startTime: resizeState.originalStartTime + shift,
            duration: clamped,
            trimStart: Math.max(0, newTrimStart),
          });
        }
      });
    }

    if (slipState) {
      const clientX = e.clientX;
      if (resizeRafIdRef.current !== null) {
        cancelAnimationFrame(resizeRafIdRef.current);
      }
      resizeRafIdRef.current = requestAnimationFrame(() => {
        resizeRafIdRef.current = null;
        const dx = clientX - slipState.startX;
        const dt = dx / zoomLevel;
        
        const latestTracks = getLatestTracks(slipState.clipId);
        const clip = findClipDeep(useEditorStore.getState(), slipState.clipId)?.clip;
        if (!clip) return;
        
        const media = getMediaSafe(clip);
        const sourceDuration = media.duration || 30;
        
        const isRamped = clip.speedRamp && clip.speedRamp.length >= 2;
        let newTrimStart = 0;
        let newTrimEnd = 0;

        if (isRamped) {
          const engine = getSpeedRampEngine(clip.id, clip.speedRamp);
          const currentLocalTimelineStart = engine.sourceToTimeline(clip.trimStart);
          let newLocalTimelineStart = currentLocalTimelineStart - dt;
          
          const minTimelineStart = 0;
          const maxTimelineEnd = engine.sourceToTimeline(sourceDuration);
          const maxTimelineStart = maxTimelineEnd - clip.duration;
          newLocalTimelineStart = Math.max(minTimelineStart, Math.min(maxTimelineStart, newLocalTimelineStart));
          
          newTrimStart = engine.timelineToSource(newLocalTimelineStart);
          newTrimEnd = sourceDuration - engine.timelineToSource(newLocalTimelineStart + clip.duration);
        } else {
          newTrimStart = slipState.originalTrimStart - (dt * clip.speed);
          newTrimEnd = slipState.originalTrimEnd + (dt * clip.speed);
          if (newTrimStart < 0) {
            newTrimStart = 0;
            newTrimEnd = sourceDuration - clip.duration * clip.speed;
          }
          if (newTrimStart + (clip.duration * clip.speed) > sourceDuration) {
            newTrimStart = sourceDuration - (clip.duration * clip.speed);
            newTrimEnd = 0;
          }
        }
        
        updateClip(clip.id, {
          trimStart: newTrimStart,
          trimEnd: newTrimEnd,
        });
      });
    }

    if (slideState) {
      const clientX = e.clientX;
      if (resizeRafIdRef.current !== null) {
        cancelAnimationFrame(resizeRafIdRef.current);
      }
      resizeRafIdRef.current = requestAnimationFrame(() => {
        resizeRafIdRef.current = null;
        const dx = clientX - slideState.startX;
        const dt = dx / zoomLevel;
        
        const latestTracks = getLatestTracks(slideState.clipId);
        const clip = findClipDeep(useEditorStore.getState(), slideState.clipId)?.clip;
        if (!clip) return;
        
        let newStartTime = slideState.originalStartTime + dt;
        
        let minStartTime = slideState.originalStartTime;
        let maxStartTime = slideState.originalStartTime;
        
        const leftSib = slideState.adjacentClips.left ? findClipDeep(useEditorStore.getState(), slideState.adjacentClips.left.id)?.clip : null;
        const rightSib = slideState.adjacentClips.right ? findClipDeep(useEditorStore.getState(), slideState.adjacentClips.right.id)?.clip : null;
        
        if (leftSib && slideState.adjacentClips.left) {
          minStartTime = slideState.originalStartTime - (slideState.adjacentClips.left.originalDuration - 0.1);
        } else {
          minStartTime = 0;
        }
        
        if (rightSib && slideState.adjacentClips.right) {
          maxStartTime = slideState.originalStartTime + (slideState.adjacentClips.right.originalDuration - 0.1);
        } else {
          maxStartTime = Infinity;
        }
        
        newStartTime = Math.max(minStartTime, Math.min(newStartTime, maxStartTime));
        const actualDt = newStartTime - slideState.originalStartTime;
        
        updateClip(clip.id, { startTime: newStartTime });
        
        if (leftSib && slideState.adjacentClips.left) {
          const sibOriginal = slideState.adjacentClips.left;
          updateClip(leftSib.id, {
            duration: sibOriginal.originalDuration + actualDt,
            trimEnd: sibOriginal.originalTrimEnd - (actualDt * leftSib.speed),
          });
        }
        
        if (rightSib && slideState.adjacentClips.right) {
          const sibOriginal = slideState.adjacentClips.right;
          updateClip(rightSib.id, {
            startTime: sibOriginal.originalStartTime + actualDt,
            duration: sibOriginal.originalDuration - actualDt,
            trimStart: sibOriginal.originalTrimStart + (actualDt * rightSib.speed),
          });
        }
      });
    }
  };

  const handleMouseUp = () => {
    if (scrubRafIdRef.current !== null) {
      cancelAnimationFrame(scrubRafIdRef.current);
      scrubRafIdRef.current = null;
    }
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    if (resizeRafIdRef.current !== null) {
      cancelAnimationFrame(resizeRafIdRef.current);
      resizeRafIdRef.current = null;
    }

    if (isScrubbing) {
      setIsScrubbing(false);
      setScrubTime(null);
    }
    if (dragState) {
      const draggedIds = dragState.draggedClips?.map((c) => c.id) || [];
      if (draggedIds.length > 0) {
        useEditorStore.getState().resolveOverlaps(draggedIds);
      }
      setDraggingClipId(null);
      setDragState(null);
      setSnapLine(null);
      setDropPreview(null);
      endTransactionSafe();
    }
    if (resizeState) {
      setResizeState(null);
      endTransactionSafe();
    }

    if (slipState) {
      setSlipState(null);
      endTransactionSafe();
    }
    if (slideState) {
      setSlideState(null);
      endTransactionSafe();
    }
  };

  handleMouseMoveRef.current = handleMouseMove;
  handleMouseUpRef.current = handleMouseUp;

  const isDragging = dragState !== null || resizeState !== null || isScrubbing || slipState !== null || slideState !== null;

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMouseMoveRef.current?.(e);
    };
    const onMouseUp = () => {
      handleMouseUpRef.current?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleMouseMoveRef, handleMouseUpRef]);

  return {
    handleClipMouseDown,
    handleTimelineClick,
    handleRulerMouseDown,
    handleSplit,
    isDragging,
  };
}
