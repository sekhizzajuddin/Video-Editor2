import React, { useMemo, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineMarker } from '@/types';
import { RULER_HEIGHT } from '../timelineConstants';
import { RulerPlayhead } from './PlayheadComponents';

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
  rulerData: RulerMarker[];
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
    return useEditorStore.subscribe((state) => {
      setScrollLeft(state.scrollLeft);
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
    return 30;                     // 30 whole seconds per line
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
  rulerData,
  seek,
  setMarkerContextMenu,
  handleRulerPointerDown,
}: TimelineRulerProps) {
  // Double-click on the ruler (not on a marker) deselects any active clip/track/transition.
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Don't deselect when double-clicking a marker — its onClick handler already
    // moves the playhead and that's a deliberate user action.
    const target = e.target as HTMLElement;
    const isMarker =
      target.closest('[data-timeline-marker="true"]') !== null ||
      target.closest('.procut-timeline-marker') !== null;
    if (isMarker) return;
    const state = useEditorStore.getState();
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
  };

  const [scrollLeft, setScrollLeft] = useState(() => useEditorStore.getState().scrollLeft);
  const [viewportWidth, setViewportWidth] = useState(1000);

  useEffect(() => {
    return useEditorStore.subscribe((state) => {
      setScrollLeft(state.scrollLeft);
    });
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const visibleRulerData = useMemo(() => {
    const left = scrollLeft / zoomLevel;
    const right = (scrollLeft + viewportWidth) / zoomLevel;
    return rulerData.filter((m) => m.time >= left - 1 && m.time <= right + 1);
  }, [rulerData, scrollLeft, zoomLevel, viewportWidth]);

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
                      if (!useEditorStore.getState().isPlaying) {
                        useEditorStore.getState().play();
                      }
                    }, 100);
                  });
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Double-clicking a marker also deselects; user wants to
                // focus on the marker, not the active clip.
                const state = useEditorStore.getState();
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

        {/* Ruler playhead */}
        <RulerPlayhead zoomLevel={zoomLevel} />
      </div>
    </div>
  );
});
