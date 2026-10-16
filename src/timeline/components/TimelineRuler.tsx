import React, { useMemo, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineMarker } from '@/types';
import { RULER_HEIGHT } from '../timelineConstants';
import { formatCentisecondTime } from '../timelineUtils';
import { RulerPlayhead } from './PlayheadComponents';
import { useWindowDragCleanup } from '../useWindowDragCleanup';

const MARKER_ICONS: Record<string, { color: string; symbol: string; label: string }> = {
  chapter:   { color: '#06b6d4', symbol: '◆', label: 'Chapter' },
  sponsor:   { color: '#facc15', symbol: '$', label: 'Sponsor' },
  beat:      { color: '#a855f7', symbol: '♫', label: 'Beat' },
  ad:        { color: '#ef4444', symbol: '⏵', label: 'Ad Break' },
  standard:  { color: '#9ca3af', symbol: '◆', label: 'Marker' },
  default:   { color: '#9ca3af', symbol: '◆', label: 'Marker' },
};

export interface RulerMarker {
  time: number;
  label: string;
  type: 'major' | 'medium' | 'minor';
}

export interface BeatMarker {
  clipId: string;
  time: number;
}

interface TimelineRulerProps {
  rulerContainerRef: React.RefObject<HTMLDivElement | null>;
  timelineWidth: number;
  zoomLevel: number;
  inPoint: number | null;
  outPoint: number | null;
  sortedMarkers: TimelineMarker[];
  beatMarkers: BeatMarker[];
  rulerData?: RulerMarker[];
  seek: (time: number) => void;
  setMarkerContextMenu: (menu: { x: number; y: number; markerId: string } | null) => void;
  handleRulerPointerDown: (e: React.PointerEvent) => void;
}

export const TimelineGridLines = React.memo(function TimelineGridLines({
  zoomLevel,
}: {
  rulerData?: RulerMarker[];
  zoomLevel: number;
}) {
  const [scrollLeft, setScrollLeft] = useState(() => useEditorStore.getState().scrollLeft);
  const [viewportWidth, setViewportWidth] = useState(1000);

  useEffect(() => {
    let prev = useEditorStore.getState().scrollLeft;
    return useEditorStore.subscribe((state) => {
      if (state.scrollLeft !== prev) {
        prev = state.scrollLeft;
        setScrollLeft(state.scrollLeft);
      }
    });
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Compute clean integer second interval based on zoomLevel (always whole seconds)
  const secondStep = useMemo(() => {
    if (zoomLevel >= 30) return 1; // 1 whole second per line
    if (zoomLevel >= 15) return 2; // 2 whole seconds per line
    if (zoomLevel >= 6) return 5;  // 5 whole seconds per line
    if (zoomLevel >= 3) return 10; // 10 whole seconds per line
    if (zoomLevel >= 0.5) return 30; // 30 whole seconds per line
    // P3 FIX: hour-scale steps for very low zoom (5-hour timeline zoomed to fit)
    if (zoomLevel >= 0.1) return 120;
    return 300;
  }, [zoomLevel]);

  const visibleSecondLines = useMemo(() => {
    const leftTime = Math.max(0, Math.floor(scrollLeft / zoomLevel));
    const rightTime = Math.ceil((scrollLeft + viewportWidth) / zoomLevel) + 5;
    
    // Starting second strictly aligned with secondStep
    const startSec = Math.floor(leftTime / secondStep) * secondStep;
    const lines: number[] = [];
    
    for (let sec = startSec; sec <= rightTime; sec += secondStep) {
      if (sec >= 0) {
        lines.push(sec);
      }
    }
    return lines;
  }, [scrollLeft, zoomLevel, viewportWidth, secondStep]);

  return (
    <>
      {visibleSecondLines.map((sec) => (
        <div
          key={`sec-line-${sec}`}
          className="absolute top-0 bottom-0 w-px bg-black/[0.04] dark:bg-white/[0.04] pointer-events-none"
          style={{ left: `${sec * zoomLevel}px` }}
        />
      ))}
    </>
  );
});

export const TimelineRuler = React.memo(function TimelineRuler({
  rulerContainerRef,
  timelineWidth,
  zoomLevel,
  inPoint,
  outPoint,
  sortedMarkers,
  beatMarkers,
  seek,
  setMarkerContextMenu,
  handleRulerPointerDown,
}: TimelineRulerProps) {
  // Double-click on the ruler (not on a marker) deselects any active clip/track/transition,
  // UNLESS the click time falls within the duration of a selected clip.
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Don't deselect when double-clicking a marker — its onClick handler already
    // moves the playhead and that's a deliberate user action.
    const target = e.target as HTMLElement;
    const isMarker =
      target.closest('[data-timeline-marker="true"]') !== null ||
      target.closest('.procut-timeline-marker') !== null;
    if (isMarker) return;
    const state = useEditorStore.getState();

    const rulerEl = rulerContainerRef.current;
    const innerDiv = rulerEl?.firstElementChild as HTMLElement | null;
    let clickTime = 0;
    if (innerDiv) {
      const innerRect = innerDiv.getBoundingClientRect();
      const absX = e.clientX - innerRect.left;
      clickTime = Math.max(0, absX / zoomLevel);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const currentScrollLeft = rulerEl?.scrollLeft ?? state.scrollLeft;
      const x = e.clientX - rect.left + currentScrollLeft;
      clickTime = Math.max(0, x / zoomLevel);
    }

    const selectedIds = new Set<string>();
    if (state.selectedClipIds && state.selectedClipIds.length > 0) {
      state.selectedClipIds.forEach((id: string) => selectedIds.add(id));
    } else if (state.selectedClipId) {
      selectedIds.add(state.selectedClipId);
    }

    let isWithinSelectedClip = false;
    if (selectedIds.size > 0) {
      for (const track of state.tracks) {
        for (const clip of track.clips) {
          if (selectedIds.has(clip.id)) {
            if (clickTime >= clip.startTime && clickTime <= clip.startTime + clip.duration) {
              isWithinSelectedClip = true;
              break;
            }
          }
        }
        if (isWithinSelectedClip) break;
      }
    }

    if (!isWithinSelectedClip) {
      if (
        state.selectedClipId !== null ||
        (state.selectedClipIds && state.selectedClipIds.length > 0) ||
        state.selectedTransitionClipId !== null ||
        state.selectedTrackId !== null
      ) {
        state.selectClip(null);
        state.selectClips([]);
        state.selectTransition(null);
        state.selectTrack(null);
      }
    }
  };

  const [scrollLeft, setScrollLeft] = useState(() => useEditorStore.getState().scrollLeft);
  const [viewportWidth, setViewportWidth] = useState(1000);

  useEffect(() => {
    let prev = useEditorStore.getState().scrollLeft;
    return useEditorStore.subscribe((state) => {
      if (state.scrollLeft !== prev) {
        prev = state.scrollLeft;
        setScrollLeft(state.scrollLeft);
      }
    });
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const visibleRulerData = useMemo(() => {
    // P2 PERF: windowed tick generation — build ticks ONLY for the visible
    // window instead of filtering a full whole-timeline array (which was 180k–
    // 361k objects for a 5-hour timeline, rebuilt per zoom step and re-scanned
    // ~10×/sec during playback). Interval table identical to the previous
    // Timeline.tsx rulerData memo; rendered output unchanged.
    let majorInterval = 1.0;
    let mediumInterval = 0.5;
    let minorInterval = 0.1;

    if (zoomLevel >= 300) {
      majorInterval = 1.0;
      mediumInterval = 0.5;
      minorInterval = 0.05; // 50ms sub-bars when zoomed in
    } else if (zoomLevel >= 150) {
      majorInterval = 1.0;
      mediumInterval = 0.5;
      minorInterval = 0.1; // 100ms sub-bars
    } else if (zoomLevel >= 60) {
      majorInterval = 1.0;
      mediumInterval = 0.5;
      minorInterval = 0.1; // 100ms sub-bars
    } else if (zoomLevel >= 30) {
      majorInterval = 2.0;
      mediumInterval = 1.0;
      minorInterval = 0.5;
    } else if (zoomLevel >= 14) {
      majorInterval = 5.0;
      mediumInterval = 2.5;
      minorInterval = 1.0;
    } else if (zoomLevel >= 6) {
      majorInterval = 10.0;
      mediumInterval = 5.0;
      minorInterval = 2.0;
    } else if (zoomLevel >= 3) {
      majorInterval = 30.0;
      mediumInterval = 15.0;
      minorInterval = 5.0;
    } else if (zoomLevel >= 1.5) {
      // P3 FIX: hour-scale ticks for very low zoom — a 5-hour timeline zoomed to
      // fit (~0.06 px/s) used to overlap every label (lowest branch was 30s
      // majors = ~2px apart at that zoom). Spacing keeps labels ≥ ~50px apart.
      majorInterval = 60.0;
      mediumInterval = 30.0;
      minorInterval = 10.0;
    } else if (zoomLevel >= 0.5) {
      majorInterval = 120.0;
      mediumInterval = 60.0;
      minorInterval = 15.0;
    } else if (zoomLevel >= 0.2) {
      majorInterval = 300.0;
      mediumInterval = 150.0;
      minorInterval = 30.0;
    } else if (zoomLevel >= 0.1) {
      majorInterval = 600.0;
      mediumInterval = 300.0;
      minorInterval = 60.0;
    } else {
      majorInterval = 1200.0;
      mediumInterval = 600.0;
      minorInterval = 120.0;
    }

    // Window: visible range ± 2s margin
    const leftTime = Math.max(0, scrollLeft / zoomLevel - 2);
    const rightTime = (scrollLeft + viewportWidth) / zoomLevel + 2;

    const minorCentis = Math.max(1, Math.round(minorInterval * 100));
    const mediumCentis = Math.max(1, Math.round(mediumInterval * 100));
    const majorCentis = Math.max(1, Math.round(majorInterval * 100));

    // Align the start to the minor grid in integer centiseconds (same alignment
    // as the previous whole-timeline loop, so tick positions are identical).
    const startCentis = Math.max(0, Math.floor((leftTime * 100) / minorCentis) * minorCentis);
    const endCentis = Math.ceil((rightTime * 100) / minorCentis) * minorCentis;

    const ticks: RulerMarker[] = [];
    for (let c = startCentis; c <= endCentis; c += minorCentis) {
      const time = c / 100;
      let type: 'major' | 'medium' | 'minor' = 'minor';
      let label = '';

      if (c % majorCentis === 0) {
        type = 'major';
        label = formatCentisecondTime(time);
      } else if (c % mediumCentis === 0) {
        type = 'medium';
      }

      ticks.push({ time, label, type });
    }
    return ticks;
  }, [scrollLeft, viewportWidth, zoomLevel]);

  return (
    <div
      ref={rulerContainerRef}
      className="procut-timeline-ruler bg-[var(--theme-bg-subpanel)] border-b border-[var(--theme-border)] relative overflow-hidden shrink-0 cursor-pointer select-none transition-colors"
      style={{ height: RULER_HEIGHT, touchAction: 'none' }}
      onPointerDown={handleRulerPointerDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute top-0 left-0 h-full"
        style={{ width: `${timelineWidth}px` }}
      >
        {/* Ruler ticks & labels */}
        {visibleRulerData.map((tick, i) => {
          let height = '5px';
          let tickClass = 'bg-slate-300 dark:bg-slate-700/80';
          if (tick.type === 'major') {
            height = '14px';
            tickClass = 'bg-slate-700 dark:bg-slate-300';
          } else if (tick.type === 'medium') {
            height = '9px';
            tickClass = 'bg-slate-500 dark:bg-slate-400';
          }

          return (
            <div
              key={`tick-${i}-${tick.time}`}
              className="absolute bottom-0 select-none pointer-events-none"
              style={{ left: `${tick.time * zoomLevel}px` }}
            >
              <div
                className={`w-px ${tickClass}`}
                style={{ height }}
              />
              {tick.label && (
                <span className="absolute left-1.5 -top-3.5 text-[9px] text-[var(--theme-text-muted)] font-mono font-semibold select-none leading-none whitespace-nowrap">
                  {tick.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Shading outside In/Out Points */}
        {inPoint !== null && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/35 border-r border-[#3e3e3e] pointer-events-none"
            style={{ width: `${inPoint * zoomLevel}px` }}
          />
        )}
        {outPoint !== null && (
          <div
            className="absolute top-0 bottom-0 bg-black/35 border-l border-[#3e3e3e] pointer-events-none"
            style={{
              left: `${outPoint * zoomLevel}px`,
              right: 0,
            }}
          />
        )}

        {/* Render markers */}
        {sortedMarkers.map((marker) => {
          const cfg = MARKER_ICONS[marker.type ?? 'standard'] ?? MARKER_ICONS.default;
          return (
            <div
              key={marker.id}
              data-timeline-marker="true"
              className="procut-timeline-marker absolute top-0 bottom-0 pointer-events-auto cursor-pointer z-30 group"
              style={{ left: `${marker.time * zoomLevel}px` }}
              title={`${cfg.label}: ${marker.name} (${(marker?.time ?? 0).toFixed(2)}s)`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMarkerContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  markerId: marker.id,
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                const st = useEditorStore.getState();
                const wasPlaying = st.isPlaying;
                if (wasPlaying) st.pause();
                seek(marker.time);
                window.dispatchEvent(new Event('procut-frame-updated'));
                if (wasPlaying) {
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      const st2 = useEditorStore.getState();
                      // P4 FIX: don't auto-resume over a deliberate user action —
                      // the old check (!isPlaying) fired play() INTO a pause taken
                      // during the 100ms window, and resumed while scrubbing.
                      if (!st2.isPlaying && !st2.isScrubbing && st2.currentTime === marker.time) {
                        st2.play();
                      }
                    }, 100);
                  });
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const state = useEditorStore.getState();
                const selectedIds = new Set<string>();
                if (state.selectedClipIds && state.selectedClipIds.length > 0) {
                  state.selectedClipIds.forEach((id: string) => selectedIds.add(id));
                } else if (state.selectedClipId) {
                  selectedIds.add(state.selectedClipId);
                }

                let isWithinSelectedClip = false;
                if (selectedIds.size > 0) {
                  for (const tr of state.tracks) {
                    for (const cl of tr.clips) {
                      if (selectedIds.has(cl.id)) {
                        if (marker.time >= cl.startTime && marker.time <= cl.startTime + cl.duration) {
                          isWithinSelectedClip = true;
                          break;
                        }
                      }
                    }
                    if (isWithinSelectedClip) break;
                  }
                }

                if (!isWithinSelectedClip) {
                  if (
                    state.selectedClipId !== null ||
                    (state.selectedClipIds && state.selectedClipIds.length > 0) ||
                    state.selectedTransitionClipId !== null ||
                    state.selectedTrackId !== null
                  ) {
                    state.selectClip(null);
                    state.selectClips([]);
                    state.selectTransition(null);
                    state.selectTrack(null);
                  }
                }
              }}
            >
              <div
                className="absolute top-0.5 -translate-x-1/2 px-1 py-0.5 rounded text-[8px] font-bold text-white shadow-md flex items-center gap-0.5 border border-white/40 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: marker.color || cfg.color }}
              >
                <span>{cfg.symbol}</span>
              </div>
              {/* Vertical guideline on ruler */}
              <div
                className="absolute top-4 bottom-0 left-0 -translate-x-1/2 w-[1px] opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: marker.color || cfg.color }}
              />
              {/* Hover Tooltip */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#141414] border border-[#3e3e3e] text-[9px] text-white px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                <span className="font-semibold text-amber-400 mr-1">[{cfg.label}]</span> {marker.name}
              </div>
            </div>
          );
        })}

        {/* Audio beat markers */}
        {beatMarkers.map((bm, idx) => (
          <div
            key={`bm-${idx}`}
            className="absolute bottom-0 w-0 h-1 border-l border-cyan-400 pointer-events-none opacity-60"
            style={{ left: `${bm.time * zoomLevel}px` }}
            title="Audio beat cue point"
          />
        ))}

        {/* Ruler Export Regions */}
        <RulerExportRegions zoomLevel={zoomLevel} seek={seek} />

        {/* Ruler playhead */}
        <RulerPlayhead zoomLevel={zoomLevel} />
      </div>
    </div>
  );
});

const EMPTY_EXPORT_REGIONS: any[] = [];

function RulerExportRegions({ zoomLevel, seek }: { zoomLevel: number; seek: (t: number) => void }) {
  const windowDragCleanupRef = useWindowDragCleanup();
  const exportRegions = useEditorStore((s) => s.exportRegions || EMPTY_EXPORT_REGIONS);
  const selectedExportRegionId = useEditorStore((s) => s.selectedExportRegionId);
  const selectExportRegion = useEditorStore((s) => s.selectExportRegion);
  const updateExportRegion = useEditorStore((s) => s.updateExportRegion);

  if (!exportRegions.length) return null;

  return (
    <>
      {exportRegions.map((region) => {
        const startX = region.startTime * zoomLevel;
        const endX = region.endTime * zoomLevel;
        const width = Math.max(4, endX - startX);
        const isSelected = selectedExportRegionId === region.id;
        const color = region.color || '#10b981';

        const handleStartPointerDown = (e: React.PointerEvent) => {
          e.stopPropagation();
          selectExportRegion(region.id);
          const initialX = e.clientX;
          const initialStart = region.startTime;

          const onPointerMove = (ev: PointerEvent) => {
            const deltaSec = (ev.clientX - initialX) / zoomLevel;
            const newStart = Math.max(0, Math.min(region.endTime - 0.2, initialStart + deltaSec));
            updateExportRegion(region.id, { startTime: newStart });
          };
          const cleanupListeners = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            windowDragCleanupRef.current = null;
          };
          const onPointerUp = cleanupListeners;
          windowDragCleanupRef.current = cleanupListeners;
          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        };

        const handleEndPointerDown = (e: React.PointerEvent) => {
          e.stopPropagation();
          selectExportRegion(region.id);
          const initialX = e.clientX;
          const initialEnd = region.endTime;

          const onPointerMove = (ev: PointerEvent) => {
            const deltaSec = (ev.clientX - initialX) / zoomLevel;
            const newEnd = Math.max(region.startTime + 0.2, initialEnd + deltaSec);
            updateExportRegion(region.id, { endTime: newEnd });
          };
          const cleanupListeners = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            windowDragCleanupRef.current = null;
          };
          const onPointerUp = cleanupListeners;
          windowDragCleanupRef.current = cleanupListeners;
          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        };

        const handleBarPointerDown = (e: React.PointerEvent) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          selectExportRegion(region.id);
          const initialX = e.clientX;
          const initialStart = region.startTime;
          const dur = region.endTime - region.startTime;

          const onPointerMove = (ev: PointerEvent) => {
            const deltaSec = (ev.clientX - initialX) / zoomLevel;
            const newStart = Math.max(0, initialStart + deltaSec);
            updateExportRegion(region.id, { startTime: newStart, endTime: newStart + dur });
          };
          const cleanupListeners = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            windowDragCleanupRef.current = null;
          };
          const onPointerUp = cleanupListeners;
          windowDragCleanupRef.current = cleanupListeners;
          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        };

        return (
          <div
            key={region.id}
            className="absolute top-0 h-[20px] pointer-events-auto z-20 group"
            style={{
              left: `${startX}px`,
              width: `${width}px`,
            }}
          >
            {/* Top Bar Background */}
            <div
              className={`absolute inset-0 rounded-b flex items-center justify-between px-1.5 cursor-grab active:cursor-grabbing transition-all ${
                isSelected ? 'ring-2 ring-white/90 shadow-md' : 'opacity-85 hover:opacity-100'
              }`}
              style={{
                backgroundColor: color,
              }}
              onPointerDown={handleBarPointerDown}
              onClick={(e) => {
                e.stopPropagation();
                selectExportRegion(region.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                seek(region.startTime);
              }}
            >
              <span className="text-[9px] font-bold text-white truncate drop-shadow-sm select-none leading-none">
                {region.name || 'Export'} ({(region.endTime - region.startTime).toFixed(1)}s)
              </span>
            </div>

            {/* Start handle bracket */}
            <div
              className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center pointer-events-auto z-30"
              onPointerDown={handleStartPointerDown}
              title={`Drag to adjust start (${region.startTime.toFixed(2)}s)`}
            >
              <div
                className="w-1.5 h-full rounded-l shadow"
                style={{ backgroundColor: isSelected ? '#ffffff' : color }}
              />
            </div>

            {/* End handle bracket */}
            <div
              className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center pointer-events-auto z-30"
              onPointerDown={handleEndPointerDown}
              title={`Drag to adjust end (${region.endTime.toFixed(2)}s)`}
            >
              <div
                className="w-1.5 h-full rounded-r shadow"
                style={{ backgroundColor: isSelected ? '#ffffff' : color }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
