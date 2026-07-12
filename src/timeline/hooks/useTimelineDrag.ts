import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { getTrackHeight, getTrackTop, getTrackAtY } from '../trackGeometry';
import { DEFAULT_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT, SNAP_THRESHOLD_PX } from '../timelineConstants';
import type { TimelineState } from './useTimelineState';

interface UseTimelineDragDeps {
  timelineState: TimelineState;
}

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
    moveOverLayer,
    reorderOverLayer,
    updateOverLayer,
    hoveredOverLayerRegion,
    pinnedOverLayerTrackId,
  } = useEditorStore();

  const dragRafIdRef = useRef<number | null>(null);
  const resizeRafIdRef = useRef<number | null>(null);
  const resizeOverLayerRafIdRef = useRef<number | null>(null);
  const dragOverLayerRafIdRef = useRef<number | null>(null);

  const {
    trackContainerRef,
    dragState,
    setDragState,
    resizeState,
    setResizeState,
    dragOverLayerState,
    setDragOverLayerState,
    resizeOverLayerState,
    setResizeOverLayerState,
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

  const getTrackFromMouseY = useCallback((clientY: number): TimelineTrack | null => {
    const container = trackContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const relY = clientY - rect.top + container.scrollTop;
    const idx = getTrackAtY(tracks, relY, hoveredOverLayerRegion, pinnedOverLayerTrackId);
    return idx >= 0 && idx < tracks.length ? tracks[idx] : null;
  }, [tracks, hoveredOverLayerRegion, pinnedOverLayerTrackId, trackContainerRef]);

  const computeSnap = useCallback((rawTime: number, movingClipId: string, movingDuration: number) => {
    if (!settings.snapEnabled) {
      return { snappedTime: rawTime, snapPos: null };
    }
    const threshold = SNAP_THRESHOLD_PX / zoomLevel;

    // Collect snap targets: all other clip edges + the playhead
    const targets: number[] = [useEditorStore.getState().currentTime]; // snap to playhead
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === movingClipId) continue;
        targets.push(clip.startTime);
        targets.push(clip.startTime + clip.duration);
      }
      if (track.overLayers) {
        for (const ol of track.overLayers) {
          if (ol.id === movingClipId) continue;
          targets.push(ol.startTime);
          targets.push(ol.startTime + ol.duration);
        }
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
  }, [zoomLevel, tracks, settings.snapEnabled]);

  const updateDragPosition = useCallback((clientX: number, clientY: number, currScrollLeft: number) => {
    if (!dragState || !dragState.draggedClips || dragState.draggedClips.length === 0) return;

    const dx = (clientX - dragState.startX) + (currScrollLeft - dragState.originalScrollLeft);
    const dt = dx / zoomLevel;
    let newTime = Math.max(0, dragState.originalStartTime + dt);

    const hoverTrack = getTrackFromMouseY(clientY);
    const targetTrackId =
      hoverTrack && hoverTrack.type === dragState.trackType ? hoverTrack.id : dragState.trackId;

    const movingClip = tracks.flatMap((t) => t.clips).find((c) => c.id === dragState.clipId);
    const movingDuration = movingClip?.duration ?? 0;

    const { snappedTime, snapPos } = computeSnap(newTime, dragState.clipId, movingDuration);
    newTime = snappedTime;
    setSnapLine(snapPos);

    const finalDt = newTime - dragState.originalStartTime;

    if (dragState.draggedClips.length > 1) {
      setDragPreview(0, null);

      const sourceTrackIdx = tracks.findIndex((t) => t.id === dragState.trackId);
      const targetTrackIdx = tracks.findIndex((t) => t.id === targetTrackId);
      const trackDelta = targetTrackIdx - sourceTrackIdx;

      const updates = dragState.draggedClips.map((c) => {
        const clipNewTime = Math.max(0, c.originalStartTime + finalDt);
        
        const clipTrackIdx = tracks.findIndex((t) => t.id === c.trackId);
        const newTrackIdx = clipTrackIdx + trackDelta;
        const originalTrack = tracks.find((t) => t.id === c.trackId);
        const targetTrack = tracks[newTrackIdx];

        const targetTrackIdForClip =
          targetTrack && originalTrack && targetTrack.type === originalTrack.type
            ? targetTrack.id
            : c.trackId;

        return {
          clipId: c.id,
          newStartTime: clipNewTime,
          newTrackId: targetTrackIdForClip,
        };
      });

      const seen = new Set<string>();
      const uniqueUpdates = updates.filter((u) => {
        if (seen.has(u.clipId)) return false;
        seen.add(u.clipId);
        return true;
      });

      moveClips(uniqueUpdates);
    } else if (dragState.draggedClips.length === 1) {
      setDragPreview(newTime, targetTrackId);
      moveClip(dragState.clipId, newTime, targetTrackId);
    }
  }, [dragState, tracks, zoomLevel, getTrackFromMouseY, computeSnap, moveClips, moveClip, setDragPreview, setSnapLine]);

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
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const currentScrollLeft = useEditorStore.getState().scrollLeft;

      if (relX < 6) {
        startTransactionSafe();
        startResize(e, clip, 'left');
        return;
      }

      if (relX > rect.width - 6) {
        startTransactionSafe();
        startResize(e, clip, 'right');
        return;
      }

      if (activeTool === 'trackSelect') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime >= clickTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime >= clickTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
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
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime <= clickTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime <= clickTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
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
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
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
    [tracks, activeTool, splitClip, zoomLevel, selectClip, selectClips, selectedClipIds, startTransactionSafe, startResize, setDragState, setDraggingClipId],
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

  const handleMouseMove = (e: MouseEvent) => {
    if (isScrubbing) {
      if (scrubRafIdRef.current !== null) {
        cancelAnimationFrame(scrubRafIdRef.current);
      }
      const clientX = e.clientX;
      scrubRafIdRef.current = requestAnimationFrame(() => {
        scrubRafIdRef.current = null;
        const rect = trackContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const currentScrollLeft = useEditorStore.getState().scrollLeft;
          const x = clientX - rect.left + currentScrollLeft;
          const time = Math.max(0, x / zoomLevel);
          seek(time);
          setScrubTime(time);
          setScrubMouseX(clientX);
        }
      });
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

    if (dragOverLayerState) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (!dragOverLayerRafIdRef.current) {
        dragOverLayerRafIdRef.current = requestAnimationFrame(() => {
          const dx = clientX - dragOverLayerState.startX;
          const dt = dx / zoomLevel;
          let newStartTime = Math.max(0, dragOverLayerState.originalStartTime + dt);
          
          const track = tracks.find((t) => t.id === dragOverLayerState.trackId);
          const ol = track?.overLayers?.find(o => o.id === dragOverLayerState.overLayerId);
          if (ol) {
            const { snappedTime, snapPos } = computeSnap(newStartTime, ol.id, ol.duration);
            newStartTime = snappedTime;
            setSnapLine(snapPos);
          }
          
          moveOverLayer(dragOverLayerState.overLayerId, newStartTime);
 
          const trackEl = document.querySelector(`[data-track-id="${dragOverLayerState.trackId}"]`);
          if (track && track.overLayers && trackEl && hoveredOverLayerRegion) {
            const trackRect = trackEl.getBoundingClientRect();
            const relY = clientY - trackRect.top - DEFAULT_TRACK_HEIGHT;
            const targetRowIdx = Math.max(0, Math.floor(relY / OVER_LAYER_ROW_HEIGHT));
            reorderOverLayer(dragOverLayerState.overLayerId, targetRowIdx);
          }
          dragOverLayerRafIdRef.current = null;
        });
      }
    }

    if (resizeOverLayerState) {
      const clientX = e.clientX;
      if (resizeOverLayerRafIdRef.current !== null) {
        cancelAnimationFrame(resizeOverLayerRafIdRef.current);
      }
      resizeOverLayerRafIdRef.current = requestAnimationFrame(() => {
        resizeOverLayerRafIdRef.current = null;
        const dx = clientX - resizeOverLayerState.startX;
        const dt = dx / zoomLevel;
        
        const track = tracks.find((t) => (t.overLayers || []).some((ol) => ol.id === resizeOverLayerState.overLayerId));
        const ol = track?.overLayers.find((ol) => ol.id === resizeOverLayerState.overLayerId);
        if (ol) {
          if (resizeOverLayerState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeOverLayerState.originalDuration + dt);
            updateOverLayer(ol.id, { duration: newDuration });
          } else {
            const newStartTime = Math.max(0, resizeOverLayerState.originalStartTime + dt);
            const delta = newStartTime - resizeOverLayerState.originalStartTime;
            const newDuration = Math.max(0.1, resizeOverLayerState.originalDuration - delta);
            if (newDuration > 0.1) {
              updateOverLayer(ol.id, { startTime: newStartTime, duration: newDuration });
            }
          }
        }
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
        const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === resizeState.clipId);
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
              trimStart: resizeState.originalTrimStart,
              trimEnd: resizeState.originalTrimEnd,
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + delta,
                });
              });
            }
          } else {
            const shrink = -dt;
            const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
            const newSpeed = sourceContentDuration / newDuration;
            const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            let clampedDuration = sourceContentDuration / clampedSpeed;
            let shift = resizeState.originalDuration - clampedDuration;
            shift = Math.max(-resizeState.originalStartTime, shift);
            clampedDuration = resizeState.originalDuration - shift;
            const finalSpeed = Math.min(20, Math.max(0.1, sourceContentDuration / clampedDuration));

            updateClip(resizeState.clipId, {
              startTime: resizeState.originalStartTime + shift,
              duration: clampedDuration,
              speed: finalSpeed,
              trimStart: resizeState.originalTrimStart,
              trimEnd: resizeState.originalTrimEnd,
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + shift,
                });
              });
            }
          }
          return;
        }

        if (activeTool === 'ripple') {
          if (resizeState.edge === 'right') {
            const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
            const maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
            const clamped = Math.min(newDuration, maxDuration);
            const delta = clamped - resizeState.originalDuration;

            const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
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
            const shrink = -dt;
            const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
            const maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
            let clamped = Math.min(newDuration, maxDuration);
            let shift = resizeState.originalDuration - clamped;
            shift = Math.max(-resizeState.originalStartTime, shift);
            clamped = resizeState.originalDuration - shift;

            updateClip(resizeState.clipId, {
              startTime: resizeState.originalStartTime + shift,
              duration: clamped,
              trimStart: Math.max(0, resizeState.originalTrimStart + shift * clip.speed),
            });

            if (resizeState.rippleClips) {
              resizeState.rippleClips.forEach((c) => {
                updateClip(c.id, {
                  startTime: c.originalStartTime + shift,
                });
              });
            }
          }
          return;
        }

        if (resizeState.edge === 'right') {
          let newDuration = Math.max(0.1, resizeState.originalDuration + dt);
          const maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
          let clamped = Math.min(newDuration, maxDuration);

          if (resizeState.siblingClip) {
            const sib = resizeState.siblingClip;
            const newAEnd = clip.trimStart + clamped * clip.speed;
            if (newAEnd > sib.originalTrimStart) {
              let deltaSource = newAEnd - sib.originalTrimStart;
              let delta = deltaSource / sib.speed;
              
              const maxDelta = sib.originalDuration - 0.1;
              if (delta > maxDelta) {
                delta = Math.max(0, maxDelta);
                deltaSource = delta * sib.speed;
                clamped = (sib.originalTrimStart + deltaSource - clip.trimStart) / clip.speed;
              }

              updateClip(sib.id, {
                trimStart: sib.originalTrimStart + deltaSource,
                duration: sib.originalDuration - delta,
                startTime: sib.originalStartTime + delta,
              });
            } else {
              updateClip(sib.id, {
                trimStart: sib.originalTrimStart,
                duration: sib.originalDuration,
                startTime: sib.originalStartTime,
              });
            }
          }

          const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
          updateClip(resizeState.clipId, {
            duration: clamped,
            trimEnd: Math.max(0, newTrimEnd),
          });
        } else {
          const shrink = -dt;
          const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
          const maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
          let clamped = Math.min(newDuration, maxDuration);
          let shift = resizeState.originalDuration - clamped;

          if (resizeState.siblingClip) {
            const sib = resizeState.siblingClip;
            const newBStart = resizeState.originalTrimStart + shift * clip.speed;
            if (newBStart < sib.originalTrimStart + sib.originalDuration * sib.speed) {
              let deltaSource = (sib.originalTrimStart + sib.originalDuration * sib.speed) - newBStart;
              let delta = deltaSource / sib.speed;
              
              const maxDelta = sib.originalDuration - 0.1;
              if (delta > maxDelta) {
                delta = Math.max(0, maxDelta);
                deltaSource = delta * sib.speed;
                const allowedNewBStart = sib.originalTrimStart + sib.originalDuration * sib.speed - deltaSource;
                shift = (allowedNewBStart - resizeState.originalTrimStart) / clip.speed;
                clamped = resizeState.originalDuration - shift;
              }

              updateClip(sib.id, {
                trimEnd: sib.originalTrimEnd + deltaSource,
                duration: sib.originalDuration - delta,
              });
            } else {
              updateClip(sib.id, {
                trimEnd: sib.originalTrimEnd,
                duration: sib.originalDuration,
              });
            }
          }

          updateClip(resizeState.clipId, {
            startTime: resizeState.originalStartTime + shift,
            duration: clamped,
            trimStart: Math.max(0, resizeState.originalTrimStart + shift * clip.speed),
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
    if (resizeOverLayerRafIdRef.current !== null) {
      cancelAnimationFrame(resizeOverLayerRafIdRef.current);
      resizeOverLayerRafIdRef.current = null;
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
    if (dragOverLayerState) {
      if (dragOverLayerRafIdRef.current) {
        cancelAnimationFrame(dragOverLayerRafIdRef.current);
        dragOverLayerRafIdRef.current = null;
      }
      setSnapLine(null);
      setDragOverLayerState(null);
      endTransactionSafe();
    }
    if (resizeOverLayerState) {
      setResizeOverLayerState(null);
      endTransactionSafe();
    }
  };

  handleMouseMoveRef.current = handleMouseMove;
  handleMouseUpRef.current = handleMouseUp;

  const isDragging = dragState !== null || resizeState !== null || isScrubbing || dragOverLayerState !== null || resizeOverLayerState !== null;

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
