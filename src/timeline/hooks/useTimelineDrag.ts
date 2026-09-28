import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore, findClipDeep, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { getRampedTrimEndForRightResize, getRampedTrimStartForLeftResize, getSpeedRampEngine, getClipSourceEnd } from '@/utils/speedRamp';
import { setTrimPreviewTime } from '@/utils/playbackClock';
import { getTrackHeight, getTrackTop, getTrackAtY } from '../trackGeometry';

import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT, SNAP_THRESHOLD_PX } from '../timelineConstants';
import type { TimelineState } from './useTimelineState';

interface UseTimelineDragDeps {
  timelineState: TimelineState;
}

const areClipsContiguousInTime = (draggedClips: { id: string; originalStartTime: number }[], tracks: any[]) => {
  if (draggedClips.length <= 1) return true;
  
  const clipsWithTime = draggedClips.map(dc => {
     const c = findClipInTracks(tracks, dc.id, useEditorStore.getState().pipWindows || {});
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
    batchUpdateClips,
    setDraggingClipId,
    resolveOverlaps,
    selectClip,
    selectClips,
    selectTrack,
    selectTransition,
    seek,
    splitClip,
    setDragPreview,
    selectedSpeedFrame,
    selectSpeedFrame,
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
    batchUpdateClips: s.batchUpdateClips,
    setDraggingClipId: s.setDraggingClipId,
    resolveOverlaps: s.resolveOverlaps,
    selectClip: s.selectClip,
    selectClips: s.selectClips,
    selectTrack: s.selectTrack,
    selectTransition: s.selectTransition,
    seek: s.seek,
    splitClip: s.splitClip,
    setDragPreview: s.setDragPreview,
    selectedSpeedFrame: s.selectedSpeedFrame,
    selectSpeedFrame: s.selectSpeedFrame,
  })));

  const dragRafIdRef = useRef<number | null>(null);
  const resizeRafIdRef = useRef<number | null>(null);
  // P1 SAFETY: When setPointerCapture fails (unsupported element / invalid pointerId),
  // the gesture dies the moment the pointer leaves the browser window — pointerup
  // never fires on `window` and a zombie auto-scroll interval + open transaction leak.
  // We remember the failure so a document mouseleave can force-finish the drag.
  const pointerCaptureFailedRef = useRef(false);
  // P0 FIX: Universal mutable batch buffer to avoid GC pressure from fresh
  // array allocations at 60Hz across ALL drag/resize/ripple/slip operations.
  const batchBufferRef = useRef<Array<{clipId: string; changes: Partial<TimelineClip>}>>([]); 
  const pendingClipClickSeekRef = useRef<{
    time: number;
    startX: number;
    startY: number;
    timerId: any;
  } | null>(null); 


  const {
    trackContainerRef,
    rulerContainerRef,
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
    // P3 FIX: only hit-test PIP windows when the DRAGGED clip lives inside a PIP —
    // a main-timeline clip dragged over a floating PIP window used to get its
    // targetTrackId set to a PIP track and be placed in PIP-local coordinates
    // (far outside its parent).
    let draggedIsPip = false;
    if (clipId) {
      draggedIsPip = !!(findClipDeep(useEditorStore.getState(), clipId)?.isPip);
    }
    if (draggedIsPip) {
      // Check if mouse is over any PIP window first
      const pipWindows = Array.from(document.querySelectorAll('[data-pip-window="true"]'));
      for (const pipEl of pipWindows) {
        const rect = pipEl.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          const pipId = pipEl.getAttribute('data-pip-id');
          if (pipId) {
            // P3 FIX: guard pipWindows — undefined (legacy snapshot) threw a
            // TypeError mid-mousemove, killing the drag.
            const pip = (useEditorStore.getState().pipWindows || {})[pipId];
            if (pip) {
              // Found a PIP window. Calculate track index within it.
              // Adjust relY to be relative to the PIP tracks container (roughly after the title bar).
              // The title bar is 24px tall, plus some padding, so let's say 30px offset.
              const pipRelY = clientY - rect.top - 30; 
              const idx = getTrackAtY(pip.tracks, pipRelY);
              if (idx >= 0 && idx < pip.tracks.length) {
                return pip.tracks[idx];
              }
            }
          }
        }
      }
    }

    const container = trackContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const relY = clientY - rect.top + container.scrollTop;
    const latestTracks = getLatestTracks(clipId);
    const idx = getTrackAtY(latestTracks, relY);
    return idx >= 0 && idx < latestTracks.length ? latestTracks[idx] : null;
  }, [trackContainerRef]);


  // P2 PERF: snap targets (all other clip edges) are collected once per gesture
  // instead of O(all clips) with a fresh array allocation per mousemove frame.
  // Other clips don't move during a plain drag/trim, so the cache is valid for
  // the whole gesture. Ripple/rateStretch shift downstream clips every frame —
  // the cache is bypassed for those tools.
  const snapTargetsCacheRef = useRef<{ clipId: string; targets: number[]; pipAnchor: number } | null>(null);
  useEffect(() => {
    snapTargetsCacheRef.current = null;
  }, [dragState, resizeState, slipState, slideState]);

  const computeSnap = useCallback((rawTime: number, movingClipId: string, movingDuration: number) => {
    if (!settings.snapEnabled) {
      return { snappedTime: rawTime, snapPos: null };
    }
    // P4 FIX: clamp the time threshold — SNAP_THRESHOLD_PX / zoomLevel was
    // unbounded at low zoom (8 SECONDS at zoom 1), making snapping unusably
    // aggressive. 0.5s is the professional ceiling.
    const threshold = Math.min(SNAP_THRESHOLD_PX / zoomLevel, 0.5);
    const state = useEditorStore.getState();

    // Snap to playhead — fresh per call (cheap, always exact)
    const targets: number[] = [state.currentTime];

    let pipAnchor = 0;
    const cacheable = activeTool !== 'ripple' && activeTool !== 'rateStretch';
    const cached = cacheable ? snapTargetsCacheRef.current : null;

    if (cached && cached.clipId === movingClipId) {
      targets.push(...cached.targets);
      pipAnchor = cached.pipAnchor;
    } else {
      const latestTracks = getLatestTracks(movingClipId);
      pipAnchor = (() => {
        const f = findClipDeep(state, movingClipId);
        if (f && f.isPip) {
          // P3 FIX: guard pipWindows (undefined threw mid-mousemove)
          const pip = (state.pipWindows || {})[f.pipId!];
          const parent = findClipInTracks(state.tracks, pip?.parentClipId, state.pipWindows || {});
          return (parent?.startTime ?? 0) + (pip?.relativeStartTime ?? 0);
        }
        return 0;
      })();

      for (const track of latestTracks) {
        for (const clip of track.clips) {
          if (clip.id === movingClipId) continue;
          targets.push(clip.startTime + pipAnchor);
          targets.push(clip.startTime + clip.duration + pipAnchor);
        }
      }

      // P4 FIX: markers + beat markers as snap targets (professional editors
      // snap to them; they were never targets here). Beat markers are capped —
      // a 5-hour song's beat grid (36k+ beats) would bloat the per-frame search.
      const markers = state.markers || [];
      for (const m of markers) {
        targets.push(m.time + pipAnchor);
      }
      const beats = state.beatMarkers || [];
      if (beats.length > 0 && beats.length <= 2000) {
        for (const bm of beats) {
          targets.push(bm.time + pipAnchor);
        }
      }

      if (cacheable) {
        snapTargetsCacheRef.current = { clipId: movingClipId, targets, pipAnchor };
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
  }, [zoomLevel, settings.snapEnabled, activeTool]);

  const updateDragPosition = useCallback((clientX: number, clientY: number, currScrollLeft: number) => {
    if (!dragState || !dragState.draggedClips || dragState.draggedClips.length === 0) return;

    const dx = (clientX - dragState.startX) + (currScrollLeft - dragState.originalScrollLeft);
    const dt = dx / zoomLevel;
    
    const actualHoverTrack = getTrackFromMouseY(clientY, dragState.clipId);
    const state = useEditorStore.getState();
    const found = findClipDeep(state, dragState.clipId);
    const isPip = !!(found && found.isPip);

    let absoluteAnchor = dragState.originalStartTime;
    let absoluteParentStart = 0;
    let absoluteParentEnd = Infinity;
    if (isPip) {
      const pip = (state.pipWindows || {})[found.pipId!];
      const parentClip = findClipInTracks(state.tracks, pip?.parentClipId, state.pipWindows || {});
      absoluteParentStart = (parentClip?.startTime ?? 0) + (pip?.relativeStartTime ?? 0);
      absoluteParentEnd = parentClip ? (parentClip.startTime + parentClip.duration) : Infinity;
      absoluteAnchor = absoluteParentStart + dragState.originalStartTime;
    }

    let newAbsoluteTime = Math.max(absoluteParentStart, absoluteAnchor + dt);
    
    const movingClip = findClipDeep(state, dragState.clipId)?.clip;
    const movingDuration = movingClip?.duration ?? 0;

    if (isPip) {
      newAbsoluteTime = Math.min(absoluteParentEnd - movingDuration, newAbsoluteTime);
    }

    const targetTrackId = isPip
      ? dragState.trackId
      : (actualHoverTrack && actualHoverTrack.type === dragState.trackType ? actualHoverTrack.id : dragState.trackId);

    const latestTracks = getLatestTracks(dragState.clipId);

    const { snappedTime, snapPos } = computeSnap(newAbsoluteTime, dragState.clipId, movingDuration);
    let newTime = snappedTime - absoluteParentStart;
    // P3 FIX: snapping could pull the PIP clip past its parent's bounds —
    // re-apply the parent-window clamp after snapping (the pre-snap clamp at the
    // top was bypassed by any snap target within threshold).
    if (isPip) {
      const maxLocal = Math.max(0, absoluteParentEnd - absoluteParentStart - movingDuration);
      newTime = Math.min(maxLocal, Math.max(0, newTime));
    }
    setSnapLine(snapPos);

    const minOriginalStart = Math.min(...dragState.draggedClips.map(c => c.originalStartTime));
    const clampedFinalDt = Math.max(-minOriginalStart, newTime - dragState.originalStartTime);

    if (dragState.draggedClips.length >= 1) {

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
    (e: React.PointerEvent, clip: TimelineClip, edge: 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();
      let track = tracks.find((t) => t.id === clip.trackId);
      if (!track) {
        const pipWindows = useEditorStore.getState().pipWindows || {};
        for (const pip of Object.values(pipWindows)) {
          track = pip.tracks.find((t) => t.id === clip.trackId);
          if (track) break;
        }
      }
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
          const prev = siblingClips.reverse().find((c) =>
            Math.abs(c.startTime + c.duration - clip.startTime) < 0.05 &&
            Math.abs(getClipSourceEnd(c) - clip.trimStart) < 0.05
          );
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
          const next = siblingClips.find((c) =>
            Math.abs(clip.startTime + clip.duration - c.startTime) < 0.05 &&
            Math.abs(getClipSourceEnd(clip) - c.trimStart) < 0.05
          );
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
        originalCurrentTime: useEditorStore.getState().currentTime,
        siblingClip: sibling,
        rippleClips,
      });
      setIsScrubbing(true);
      window.dispatchEvent(new Event('procut-frame-updated'));
    },
    [tracks, activeTool, startTransactionSafe, setResizeState, setIsScrubbing],
  );

  const handleClipMouseDown = useCallback(
    (e: React.PointerEvent, clip: TimelineClip) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.isPrimary === false) return;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        pointerCaptureFailedRef.current = false;
      } catch {
        pointerCaptureFailedRef.current = true;
      }
      let track = tracks.find((t) => t.id === clip.trackId);
      if (!track) {
        const pipWindows = useEditorStore.getState().pipWindows || {};
        for (const pip of Object.values(pipWindows)) {
          track = pip.tracks.find((t) => t.id === clip.trackId);
          if (track) break;
        }
      }
      if (track?.locked) return;

      // If clicking inside the clip body but not on a speed-frame-element, deselect any active speed frame
      const targetEl = e.target as HTMLElement | null;
      if (!targetEl?.closest?.('.speed-frame-element')) {
        if (selectedSpeedFrame) {
          selectSpeedFrame(null, null);
        }
      }

      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      // FIX: Read scrollLeft from the DOM element directly — the Zustand store
      // value can lag the DOM by up to 100ms (throttled store sync) causing
      // the originalScrollLeft to be stale and drag deltas to be wrong.
      const currentScrollLeft = trackContainerRef.current?.scrollLeft ?? useEditorStore.getState().scrollLeft;
      
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

      const clickedEdge = (e.target as HTMLElement).getAttribute('data-edge');
      if (clickedEdge === 'left' || clickedEdge === 'right') {
        // Only start a resize/trim when this clip is the SINGLE selected clip —
        // neighbouring clips and multi-selections never enter trim mode. If the
        // clip isn't trimmed yet, just select it (handles only render on the
        // single selected clip, so the user sees them after selecting).
        const selectedIds = useEditorStore.getState().selectedClipIds;
        const isTrimActive = selectedIds.length === 1 && selectedIds.includes(clip.id);
        if (isTrimActive) {
          startTransactionSafe();
          startResize(e, clip, clickedEdge as 'left' | 'right');
        } else {
          selectClip(clip.id);
        }
        return;
      }

      const distLeft = relX;
      const distRight = rect.width - relX;
      const grabArea = 8; // pixels

      if (distLeft <= grabArea || distRight <= grabArea) {
        // Same single-selection guard for the proximity grab.
        const selectedIds = useEditorStore.getState().selectedClipIds;
        const isTrimActive = selectedIds.length === 1 && selectedIds.includes(clip.id);
        if (isTrimActive) {
          startTransactionSafe();
          if (distLeft <= distRight) {
            startResize(e, clip, 'left');
          } else {
            startResize(e, clip, 'right');
          }
        } else {
          selectClip(clip.id);
        }
        return;
      }

      // UNIVERSAL LOGIC: Do NOT move playhead immediately on pointerdown.
      // After release of click, playhead will move to the clicked point.
      // But if user clicks and holds (>350ms) or drags (>3px), playhead will not move.
      if (pendingClipClickSeekRef.current?.timerId) {
        clearTimeout(pendingClipClickSeekRef.current.timerId);
      }
      const timerId = setTimeout(() => {
        if (pendingClipClickSeekRef.current) {
          pendingClipClickSeekRef.current = null;
        }
      }, 350);

      pendingClipClickSeekRef.current = {
        time: Math.max(0, clickTime),
        startX: e.clientX,
        startY: e.clientY,
        timerId,
      };

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
          matchingIds = [];
          for (const t of latestTracks) {
            for (const c of t.clips || []) {
              if (c.startTime >= thresholdTime) matchingIds.push(c.id);
            }
          }
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
          matchingIds = [];
          for (const t of latestTracks) {
            for (const c of t.clips || []) {
              if (c.startTime <= thresholdTime) matchingIds.push(c.id);
            }
          }
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
        selectTrack(null);
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
    [tracks, activeTool, splitClip, zoomLevel, selectClip, selectClips, selectedClipIds, startTransactionSafe, startResize, setDragState, setDraggingClipId, setSlipState, setSlideState, selectedSpeedFrame, selectSpeedFrame],
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'split') return;
      // Single-click deselect inside the track area only. The clip's own
      // onClick calls e.stopPropagation() so this handler fires only when
      // the user clicks on empty timeline space. We don't move the playhead
      // here (that's the ruler's job) — we just clear selection.
      const hasSelection =
        selectedClipId !== null ||
        selectedClipIds.length > 0 ||
        selectedTransitionClipId !== null ||
        selectedTrackId !== null ||
        selectedSpeedFrame !== null;
      if (!hasSelection) return;
      selectClip(null);
      selectClips([]);
      selectTransition(null);
      selectTrack(null);
      selectSpeedFrame(null, null);
    },
    [activeTool, selectClip, selectClips, selectTransition, selectTrack, selectSpeedFrame, selectedClipId, selectedClipIds, selectedTransitionClipId, selectedTrackId, selectedSpeedFrame],
  );

  const handleRulerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only respond to the primary button / primary pointer. For mouse input
      // this excludes right/middle clicks; for touch/pen `button` is 0 on down.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.isPrimary === false) return;

      // Capture the pointer so move/up events keep flowing to us even when the
      // cursor (or finger) leaves the ruler element — this is what makes touch
      // scrubbing on Android/iOS and Windows/Mac touchscreens work smoothly.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch { /* pointer capture unsupported — window listeners still cover us */ }

      // ── CRITICAL: compute the click time BEFORE setIsScrubbing(true). ──
      //
      // setIsScrubbing(true) synchronously sets isScrubbing in the Zustand store.
      // The PlaybackAutoScroller is a Zustand subscriber that fires immediately
      // when isScrubbing changes. It sees currentTime at the OLD playhead position
      // and scrolls the view to keep that old position in the viewport. This:
      //   1. Changes trackContainer.scrollLeft
      //   2. Writes the new scrollLeft to the Zustand store
      //   3. The store subscriber in useTimelineScroll syncs rulerContainer.scrollLeft
      //   4. The ruler's inner content div shifts position
      //
      // If we read getBoundingClientRect() AFTER this chain, the rect reflects
      // the shifted scroll position — but e.clientX is still from the original
      // click. The result: clientX - shiftedRect.left = wrong absolute position.
      //
      // By computing time FIRST, we use the original (correct) scroll position.
      const rulerEl = rulerContainerRef.current;
      const innerDiv = rulerEl?.firstElementChild as HTMLElement | null;

      let time: number;
      if (innerDiv) {
        const innerRect = innerDiv.getBoundingClientRect();
        const absX = e.clientX - innerRect.left;
        time = Math.max(0, absX / zoomLevel);
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const currentScrollLeft = trackContainerRef.current?.scrollLeft ?? useEditorStore.getState().scrollLeft;
        const x = e.clientX - rect.left + currentScrollLeft;
        time = Math.max(0, x / zoomLevel);
      }

      // Clicking the ruler always deselects every clip and speed frame — nothing should stay
      // selected when the user jumps to a time.
      const st = useEditorStore.getState();
      if (st.selectedClipIds.length > 0 || st.selectedClipId || st.selectedSpeedFrame) {
        st.selectClip(null);
        st.selectSpeedFrame(null, null);
      }

      const wasPlaying = st.isPlaying;
      wasPlayingOnRulerDownRef.current = wasPlaying;
      rulerDownXRef.current = e.clientX;

      // Instantly pause first to freeze clock advance, audio pipelines, and decode contention
      if (wasPlaying) {
        st.pause();
      }

      // Move playhead instantly to clicked point
      seek(time);
      window.dispatchEvent(new Event('procut-frame-updated'));

      // Enable scrubbing tracking so dragging works seamlessly
      setIsScrubbing(true);
      setScrubTime(time);
      setScrubMouseX(e.clientX);

      e.preventDefault();
      e.stopPropagation();
    },
    [zoomLevel, seek, setIsScrubbing, setScrubTime, setScrubMouseX, rulerContainerRef, trackContainerRef],
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
  const wasPlayingOnRulerDownRef = useRef<boolean>(false);
  const rulerDownXRef = useRef<number>(0);

  const handlePointerMove = (e: PointerEvent) => {
    // If pointer moved beyond 3px threshold, cancel pending click-release seek
    if (pendingClipClickSeekRef.current) {
      const dx = e.clientX - pendingClipClickSeekRef.current.startX;
      const dy = e.clientY - pendingClipClickSeekRef.current.startY;
      if (Math.hypot(dx, dy) > 3) {
        if (pendingClipClickSeekRef.current.timerId) {
          clearTimeout(pendingClipClickSeekRef.current.timerId);
        }
        pendingClipClickSeekRef.current = null;
      }
    }

    if (isScrubbing && !resizeState && !dragState && !slipState && !slideState) {
      if (wasPlayingOnRulerDownRef.current && Math.abs(e.clientX - rulerDownXRef.current) > 4) {
        // User dragged during playback — switch from "click to jump" to full scrubbing mode (pause playback)
        if (useEditorStore.getState().isPlaying) {
          useEditorStore.getState().pause();
        }
        wasPlayingOnRulerDownRef.current = false;
      }
      latestClientXRef.current = e.clientX;
      if (scrubRafIdRef.current === null) {
          scrubRafIdRef.current = requestAnimationFrame(() => {
          scrubRafIdRef.current = null;
          const clientX = latestClientXRef.current;
           const rulerEl = rulerContainerRef.current;
          if (rulerEl) {
            // ROBUST FIX: Use the inner content div's bounding rect to compute
            // the absolute pixel position. Its getBoundingClientRect() already
            // accounts for any scrolling/transforms the browser applied.
            const innerDiv = rulerEl.firstElementChild as HTMLElement | null;
            let time: number;
            if (innerDiv) {
              const innerRect = innerDiv.getBoundingClientRect();
              const absX = clientX - innerRect.left;
              time = Math.max(0, absX / zoomLevel);
            } else {
              const rect = rulerEl.getBoundingClientRect();
              const currentScrollLeft = trackContainerRef.current?.scrollLeft ?? useEditorStore.getState().scrollLeft;
              const x = clientX - rect.left + currentScrollLeft;
              time = Math.max(0, x / zoomLevel);
            }

            seek(time);
            // Immediately notify the canvas render engine — avoids waiting for
            // React's async render cycle to propagate the Zustand state change.
            window.dispatchEvent(new Event('procut-frame-updated'));

            // Edge-scroll: since PlaybackAutoScroller no longer fires during
            // scrubbing, we do it here — driven by cursor position, NOT currentTime.
            // Only scroll when the cursor is near the ruler's left/right edge.
            const container = trackContainerRef.current;
            if (container) {
              const rulerRect = rulerEl.getBoundingClientRect();
              const edgeZone = 80; // px from edge where scroll kicks in
              const distFromLeft = clientX - rulerRect.left;
              const distFromRight = rulerRect.right - clientX;
              if (distFromLeft < edgeZone && distFromLeft >= 0) {
                const speed = Math.round((edgeZone - distFromLeft) / edgeZone * 20);
                container.scrollLeft = Math.max(0, container.scrollLeft - speed);
              } else if (distFromRight < edgeZone && distFromRight >= 0) {
                const speed = Math.round((edgeZone - distFromRight) / edgeZone * 20);
                container.scrollLeft = Math.min(
                  container.scrollWidth - container.clientWidth,
                  container.scrollLeft + speed
                );
              }
            }

            const scrubNow = performance.now();
            if (scrubNow - lastScrubStateUpdateRef.current > 16) {
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
            let clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            let clampedDuration = sourceContentDuration / clampedSpeed;
            let delta = clampedDuration - resizeState.originalDuration;
            
            const rawEdgeTime = resizeState.originalStartTime + clampedDuration;
            const { snappedTime: snappedEdge, snapPos } = computeSnap(rawEdgeTime, resizeState.clipId, 0);
            const snappedDuration = snappedEdge - resizeState.originalStartTime;
            
            clampedDuration = Math.max(0.1, snappedDuration);
            clampedSpeed = Math.min(20, Math.max(0.1, sourceContentDuration / clampedDuration));
            clampedDuration = sourceContentDuration / clampedSpeed;
            delta = clampedDuration - resizeState.originalDuration;
            setSnapLine(snapPos);

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({ clipId: resizeState.clipId, changes: { duration: clampedDuration, speed: clampedSpeed } });
            if (resizeState.rippleClips) {
              for (const c of resizeState.rippleClips) {
                batchBufferRef.current.push({ clipId: c.id, changes: { startTime: c.originalStartTime + delta } });
              }
            }
            batchUpdateClips(batchBufferRef.current);
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
            let limitedDuration = Math.min(newDur, maxDuration);

            let rawStartTime = resizeState.originalStartTime + (resizeState.originalDuration - limitedDuration);
            const { snappedTime: snappedEdge, snapPos } = computeSnap(rawStartTime, resizeState.clipId, 0);
            let snappedShift = snappedEdge - resizeState.originalStartTime;
            limitedDuration = resizeState.originalDuration - snappedShift;
            
            if (limitedDuration > maxDuration) {
                limitedDuration = maxDuration;
                setSnapLine(null);
            } else {
                setSnapLine(snapPos);
            }
            
            const newSpeed = sourceContentDuration / limitedDuration;
            const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
            const clampedDuration = sourceContentDuration / clampedSpeed;
            const shift = resizeState.originalDuration - clampedDuration;

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({
              clipId: resizeState.clipId,
              changes: {
                startTime: resizeState.originalStartTime + shift,
                duration: clampedDuration,
                speed: clampedSpeed,
                trimStart: resizeState.originalTrimStart,
                trimEnd: resizeState.originalTrimEnd,
              }
            });
            batchUpdateClips(batchBufferRef.current);
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
              maxDuration = (sourceDuration - clip.trimStart) / Math.max(0.01, clip.speed);
            }
            // P3 FIX: never bound below the clip's current duration — missing/zero
            // media metadata (fabricated 30s source) used to silently shrink the
            // clip on the first mousemove. Also guards ÷0 speed → Infinity.
            maxDuration = Math.max(resizeState.originalDuration, maxDuration);
            let clamped = Math.min(newDuration, maxDuration);

            const rawEdgeTime = resizeState.originalStartTime + clamped;
            const { snappedTime: snappedEdge, snapPos } = computeSnap(rawEdgeTime, resizeState.clipId, 0);
            clamped = Math.min(snappedEdge - resizeState.originalStartTime, maxDuration);
            setSnapLine(snapPos);

            const delta = clamped - resizeState.originalDuration;

            const newTrimEnd = isRamped
              ? getRampedTrimEndForRightResize(clip, clamped, sourceDuration)
              : resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({ clipId: resizeState.clipId, changes: { duration: clamped, trimEnd: Math.max(0, newTrimEnd) } });
            if (resizeState.rippleClips) {
              for (const c of resizeState.rippleClips) {
                batchBufferRef.current.push({ clipId: c.id, changes: { startTime: c.originalStartTime + delta } });
              }
            }
            batchUpdateClips(batchBufferRef.current);
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
            let deltaDuration = clampedDuration - resizeState.originalDuration; // positive if expand, negative if shrink

            // P3 FIX (ripple left-edge trim was fully inverted): the START moves
            // OPPOSITE to the duration growth (expand → start moves left), and the
            // snapped edge is the new START — so deltaDuration = S − snappedEdge.
            // The old math (S + deltaDuration, then D − deltaDuration) mirrored the
            // duration around D: an intended expansion became a shrink, opened a
            // gap, and shifted downstream the wrong way.
            let rawStartTime = resizeState.originalStartTime - deltaDuration;
            const { snappedTime: snappedEdge, snapPos } = computeSnap(rawStartTime, resizeState.clipId, 0);
            deltaDuration = resizeState.originalStartTime - snappedEdge;
            clampedDuration = resizeState.originalDuration + deltaDuration;

            if (clampedDuration > maxDuration) {
                clampedDuration = maxDuration;
                deltaDuration = clampedDuration - resizeState.originalDuration;
                setSnapLine(null);
            } else {
                setSnapLine(snapPos);
            }

            // IMPORTANT: pass the ORIGINAL trimStart to the ramped helper.
            // `shift` is cumulative from the drag start while `clip.trimStart`
            // is the LIVE value (already shifted by previous frames) — using it
            // double-counted the shift and made ramped left-trims drift at 2x.
            const newTrimStart = isRamped
              ? getRampedTrimStartForLeftResize({ ...clip, trimStart: resizeState.originalTrimStart }, -deltaDuration)
              : resizeState.originalTrimStart - deltaDuration * clip.speed;

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({ clipId: resizeState.clipId, changes: { duration: clampedDuration, trimStart: Math.max(0, newTrimStart) } });
            // P3 FIX: for a LEFT-edge ripple trim the clip's OUT point is pinned
            // (start −/+ delta, duration +/− delta → end never moves), so downstream
            // clips must NOT shift — shifting them opened a gap that resolveOverlaps
            // then "repaired" by shunting clips to other tracks.
            batchUpdateClips(batchBufferRef.current);
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
            maxDuration = (sourceDuration - clip.trimStart) / Math.max(0.01, clip.speed);
          }
          // P3 FIX: never bound below the clip's current duration (missing/zero
          // media metadata used to silently shrink it on the first mousemove).
          maxDuration = Math.max(resizeState.originalDuration, maxDuration);
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

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({
              clipId: sib.id,
              changes: {
                startTime: sib.originalStartTime + delta,
                duration: sib.originalDuration - delta,
                trimStart: Math.max(0, sibNewTrimStart),
              }
            }, {
              clipId: resizeState.clipId,
              changes: {
                duration: clamped,
                trimEnd: Math.max(0, isRamped
                  ? getRampedTrimEndForRightResize(clip, clamped, sourceDuration)
                  : resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed),
              }
            });
            batchUpdateClips(batchBufferRef.current);
          } else {
            const rawEdgeTime = resizeState.originalStartTime + clamped;
            const { snappedTime: snappedEdge, snapPos } = computeSnap(rawEdgeTime, resizeState.clipId, 0);
            
            // Adjust clamped based on the snap, but do not exceed media bounds (maxDuration)
            clamped = Math.min(snappedEdge - resizeState.originalStartTime, maxDuration);
            setSnapLine(snapPos);

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({
              clipId: resizeState.clipId,
              changes: {
                duration: clamped,
                trimEnd: Math.max(0, isRamped
                  ? getRampedTrimEndForRightResize(clip, clamped, sourceDuration)
                  : resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed),
              }
            });
            batchUpdateClips(batchBufferRef.current);
          }
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

            // Pass the ORIGINAL trimStart — `shift` is cumulative from the drag
            // start, so the live (already-shifted) trimStart must not be reused.
            const newTrimStart = isRamped
              ? getRampedTrimStartForLeftResize({ ...clip, trimStart: resizeState.originalTrimStart }, shift)
              : resizeState.originalTrimStart + shift * clip.speed;

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({
              clipId: sib.id,
              changes: {
                duration: sib.originalDuration + shift,
                trimEnd: Math.max(0, sibNewTrimEnd),
              }
            }, {
              clipId: resizeState.clipId,
              changes: {
                startTime: resizeState.originalStartTime + shift,
                duration: clamped,
                trimStart: Math.max(0, newTrimStart),
              }
            });
            batchUpdateClips(batchBufferRef.current);
          } else {
            let rawStartTime = resizeState.originalStartTime + shift;
            const { snappedTime: snappedEdge, snapPos } = computeSnap(rawStartTime, resizeState.clipId, 0);
            
            // Re-calculate shift and clamped based on the snapped start time
            shift = snappedEdge - resizeState.originalStartTime;
            clamped = resizeState.originalDuration - shift;

            // Ensure clamped doesn't exceed media limits
            if (clamped > maxDuration) {
                clamped = maxDuration;
                shift = resizeState.originalDuration - clamped;
                setSnapLine(null); // Snapping failed because it exceeded media bounds
            } else {
                setSnapLine(snapPos);
            }

            // Pass the ORIGINAL trimStart — `shift` is cumulative from the drag
            // start, so the live (already-shifted) trimStart must not be reused.
            const newTrimStart = isRamped
              ? getRampedTrimStartForLeftResize({ ...clip, trimStart: resizeState.originalTrimStart }, shift)
              : resizeState.originalTrimStart + shift * clip.speed;

            batchBufferRef.current.length = 0;
            batchBufferRef.current.push({
              clipId: resizeState.clipId,
              changes: {
                startTime: resizeState.originalStartTime + shift,
                duration: clamped,
                trimStart: Math.max(0, newTrimStart),
              }
            });
            batchUpdateClips(batchBufferRef.current);
          }
        }

        // Live preview of trimmed edge — use trimPreviewTime so the primary
        // playhead stays at its original position while the canvas renders the
        // trim edge frame via an amber secondary playhead.
        const store = useEditorStore.getState();
        const updatedClip = findClipDeep(store, resizeState.clipId)?.clip;
        if (updatedClip) {
            // Subtract 0.04 (approx 1 frame at 25fps) from the right edge to ensure we preview the last visible frame of the clip
            const edgeTime = resizeState.edge === 'left' ? updatedClip.startTime : updatedClip.startTime + updatedClip.duration - 0.04;
            setTrimPreviewTime(Math.max(0, edgeTime));
            window.dispatchEvent(new Event('procut-frame-updated'));
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
          // Use the ORIGINAL trimStart: `dt` is cumulative from the drag start,
          // so the live (already-slipped) trimStart would double-count the slip.
          // P3 FIX: drag-right must show LATER frames (Premiere/CapCut slip
          // convention) — the old `- dt` slid the window the wrong way.
          const originalLocalTimelineStart = engine.sourceToTimeline(slipState.originalTrimStart);
          let newLocalTimelineStart = originalLocalTimelineStart + dt;
          
          const minTimelineStart = 0;
          const maxTimelineEnd = engine.sourceToTimeline(sourceDuration);
          const maxTimelineStart = maxTimelineEnd - clip.duration;
          newLocalTimelineStart = Math.max(minTimelineStart, Math.min(maxTimelineStart, newLocalTimelineStart));
          
          newTrimStart = engine.timelineToSource(newLocalTimelineStart);
          newTrimEnd = sourceDuration - engine.timelineToSource(newLocalTimelineStart + clip.duration);
        } else {
          // P3 FIX: slip direction — dragging RIGHT slides the content window
          // LATER (trimStart increases, trimEnd decreases; the window length is
          // preserved). The old `- dt`/`+ dt` pair inverted the direction AND
          // grew the window by 2×dt (not a slip).
          const totalTrim = slipState.originalTrimStart + slipState.originalTrimEnd;
          newTrimStart = slipState.originalTrimStart + (dt * clip.speed);
          newTrimEnd = slipState.originalTrimEnd - (dt * clip.speed);
          if (newTrimStart < 0) {
            newTrimStart = 0;
            newTrimEnd = Math.max(0, totalTrim);
          }
          if (newTrimStart + (clip.duration * clip.speed) > sourceDuration) {
            // P3 FIX: Math.max(0, …) — a clip longer than its media made this
            // produce a NEGATIVE trimStart (garbage placement).
            newTrimStart = Math.max(0, sourceDuration - (clip.duration * clip.speed));
            newTrimEnd = Math.max(0, totalTrim - newTrimStart);
          }
        }
        
        batchBufferRef.current.length = 0;
        batchBufferRef.current.push({
          clipId: clip.id,
          changes: {
            trimStart: newTrimStart,
            trimEnd: newTrimEnd,
          }
        });
        batchUpdateClips(batchBufferRef.current);
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
        
        batchBufferRef.current.length = 0;
        batchBufferRef.current.push({ clipId: clip.id, changes: { startTime: newStartTime } });
        
        if (leftSib && slideState.adjacentClips.left) {
          const sibOriginal = slideState.adjacentClips.left;
          batchBufferRef.current.push({
            clipId: leftSib.id,
            changes: {
              duration: sibOriginal.originalDuration + actualDt,
              trimEnd: sibOriginal.originalTrimEnd - (actualDt * leftSib.speed),
            }
          });
        }
        
        if (rightSib && slideState.adjacentClips.right) {
          const sibOriginal = slideState.adjacentClips.right;
          batchBufferRef.current.push({
            clipId: rightSib.id,
            changes: {
              startTime: sibOriginal.originalStartTime + actualDt,
              duration: sibOriginal.originalDuration - actualDt,
              trimStart: sibOriginal.originalTrimStart + (actualDt * rightSib.speed),
            }
          });
        }
        
        batchUpdateClips(batchBufferRef.current);
      });
    }
  };

  const handlePointerUp = () => {
    // UNIVERSAL LOGIC: Move playhead after release of click on clip (if user didn't drag or hold)
    if (pendingClipClickSeekRef.current) {
      if (pendingClipClickSeekRef.current.timerId) {
        clearTimeout(pendingClipClickSeekRef.current.timerId);
      }
      const targetTime = pendingClipClickSeekRef.current.time;
      pendingClipClickSeekRef.current = null;
      seek(targetTime);
      window.dispatchEvent(new Event('procut-frame-updated'));
    }

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
      // CapCut-feel: dispatch one full-quality redraw event on release
      window.dispatchEvent(new CustomEvent('procut-scrub-finalize'));

      // If user tapped ruler during playback without dragging, resume playback seamlessly from the new time.
      // CRITICAL: defer play() to let React flush the pool-management effect (which creates/loads
      // video elements at the new position) and let the browser decode the seeked keyframe.
      // Without this delay, play() starts the clock while video elements are still being created
      // or decoding — causing drift, hard-seeks, and visible stutter.
      if (wasPlayingOnRulerDownRef.current) {
        wasPlayingOnRulerDownRef.current = false;
        if (!useEditorStore.getState().isPlaying) {
          // RAF lets Zustand subscribers + React commit; the 100ms timeout then
          // gives the video decoder a window to produce the first frame.
          // P4 FIX: also require !isScrubbing and an unchanged playhead — a second
          // ruler tap mid-scrub used to have its scrub overridden by this
          // deferred play().
          requestAnimationFrame(() => {
            setTimeout(() => {
              const st = useEditorStore.getState();
              if (!st.isPlaying && !st.isScrubbing) {
                useEditorStore.getState().play();
              }
            }, 100);
          });
        }
      }
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
      // Clear the secondary trim playhead — the primary playhead never moved
      setTrimPreviewTime(null);
      useEditorStore.getState().resolveOverlaps([resizeState.clipId]);
      setSnapLine(null);
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

  handleMouseMoveRef.current = handlePointerMove;
  handleMouseUpRef.current = handlePointerUp;

  const isDragging = dragState !== null || resizeState !== null || isScrubbing || slipState !== null || slideState !== null;

  // ── CURSOR LOCK ────────────────────────────────────────────────────────
  // While a drag/trim/scrub is in flight, force a single stable cursor via a
  // class on <html>. Without this the cursor flickers between `ew-resize`,
  // `pointer` and the default arrow as the clip's edge (and its 8px resize
  // handle) move under a stationary pointer — made worse near adjacent clips,
  // where snapping clamps the edge while the pointer keeps travelling. This is
  // the same technique professional NLEs use for a rock-solid trim cursor.
  useEffect(() => {
    if (!isDragging) return;
    const root = document.documentElement;
    const cls = resizeState || slipState || slideState
      ? 'procut-trim-cursor'
      : dragState
        ? 'procut-grab-cursor'
        : isScrubbing
          ? 'procut-scrub-cursor'
          : null;
    if (!cls) return;
    root.classList.add(cls);
    return () => {
      root.classList.remove(cls);
    };
  }, [isDragging, resizeState, slipState, slideState, dragState, isScrubbing]);

  // ── CROSS-OS INPUT ────────────────────────────────────────────────────
  // Pointer Events unify mouse (Windows/macOS), touch (Android/iOS), and pen
  // into one stream, so scrubbing/dragging works identically on every OS.
  // We intentionally do NOT require pointer capture here (it is set on the
  // originating element) — listening on `window` guarantees we keep receiving
  // moves even when the pointer leaves the browser window or the element.
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      handleMouseMoveRef.current?.(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      handleMouseUpRef.current?.(e);
    };
    const onPointerCancel = (e: PointerEvent) => {
      handleMouseUpRef.current?.(e);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    // ── P1 SAFETY: LOST-POINTERUP RECOVERY ─────────────────────────────
    // If the pointer is released outside the browser window, pointerup never
    // reaches us: the auto-scroll interval keeps running, dragState stays set,
    // and the store transaction stays open (breaking undo) forever.
    // 1) window blur / tab hide  → gesture is definitively dead → force-finish.
    // 2) pointer leaves the document WHILE pointer capture failed → dead → force-finish.
    // (With successful capture, drags outside the window still work — untouched.)
    const forceFinishGesture = () => {
      handleMouseUpRef.current?.();
    };
    const onBlur = () => forceFinishGesture();
    const onVisibilityChange = () => {
      if (document.hidden) forceFinishGesture();
    };
    const onMouseLeaveDoc = () => {
      if (pointerCaptureFailedRef.current) forceFinishGesture();
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.documentElement.addEventListener('mouseleave', onMouseLeaveDoc);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.documentElement.removeEventListener('mouseleave', onMouseLeaveDoc);
    };
  }, [isDragging, handleMouseMoveRef, handleMouseUpRef]);

  return {
    handleClipMouseDown,
    handleTimelineClick,
    handleRulerPointerDown,
    handleSplit,
    isDragging,
  };
}
