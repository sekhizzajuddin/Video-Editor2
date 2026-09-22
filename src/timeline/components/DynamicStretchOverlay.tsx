import React, { useCallback } from 'react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { Gauge, Check, Repeat, X, RotateCcw, ChevronsLeftRight } from 'lucide-react';
import { useWindowDragCleanup } from '../useWindowDragCleanup';

interface DynamicStretchOverlayProps {
  zoomLevel: number;
}

export const DynamicStretchOverlay = React.memo(function DynamicStretchOverlay({
  zoomLevel,
}: DynamicStretchOverlayProps) {
  const dynamicStretch = useEditorStore((s) => s.dynamicStretch);
  const updateDynamicStretchMark = useEditorStore((s) => s.updateDynamicStretchMark);
  const confirmDynamicStretchMark = useEditorStore((s) => s.confirmDynamicStretchMark);
  const updateDynamicStretchDrag = useEditorStore((s) => s.updateDynamicStretchDrag);
  const toggleDynamicStretchLoop = useEditorStore((s) => s.toggleDynamicStretchLoop);
  const applyDynamicStretch = useEditorStore((s) => s.applyDynamicStretch);
  const cancelDynamicStretch = useEditorStore((s) => s.cancelDynamicStretch);
  const isPlaying = useEditorStore((s) => s.isPlaying);

  const clipId = dynamicStretch.clipId;
  const clip = useEditorStore(
    useCallback(
      (state) => (clipId ? findClipDeep(state, clipId)?.clip || null : null),
      [clipId]
    )
  );

  if (!dynamicStretch.isActive || !clip) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
      <DynamicStretchContent
        dynamicStretch={dynamicStretch}
        clip={clip}
        zoomLevel={zoomLevel}
        isPlaying={isPlaying}
        onUpdateMark={updateDynamicStretchMark}
        onConfirmMark={confirmDynamicStretchMark}
        onUpdateDrag={updateDynamicStretchDrag}
        onToggleLoop={toggleDynamicStretchLoop}
        onApply={applyDynamicStretch}
        onCancel={cancelDynamicStretch}
      />
    </div>
  );
});

interface DynamicStretchContentProps {
  dynamicStretch: import('@/types').DynamicStretchState;
  clip: import('@/types').TimelineClip;
  zoomLevel: number;
  isPlaying: boolean;
  onUpdateMark: (updates: { markStart?: number; markEnd?: number }) => void;
  onConfirmMark: () => void;
  onUpdateDrag: (newDuration: number) => void;
  onToggleLoop: () => void;
  onApply: () => void;
  onCancel: () => void;
}

function DynamicStretchContent({
  dynamicStretch,
  clip,
  zoomLevel,
  isPlaying,
  onUpdateMark,
  onConfirmMark,
  onUpdateDrag,
  onToggleLoop,
  onApply,
  onCancel,
}: DynamicStretchContentProps) {
  const windowDragCleanupRef = useWindowDragCleanup();
  const { markStart, markEnd, isConfirmed, originalRegionDuration, stretchedDuration, isLoopingRegion, maintainDuration } =
    dynamicStretch;

  const clipStart = clip.startTime;
  const clipEnd = clip.startTime + clip.duration;
  const clipX = clipStart * zoomLevel;
  const clipW = clip.duration * zoomLevel;

  // Visual coordinates
  const startX = markStart * zoomLevel;
  const displayDuration = isConfirmed ? stretchedDuration : markEnd - markStart;
  const width = Math.max(16, displayDuration * zoomLevel);

  // Speed calculation
  const speedRatio = originalRegionDuration > 0 && stretchedDuration > 0
    ? originalRegionDuration / stretchedDuration
    : 1;

  // ── Drag Left Boundary (In point) ──
  const handleStartPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const initialPointerX = e.clientX;
      const initialStart = markStart;

      const onPointerMove = (ev: PointerEvent) => {
        const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
        const newStart = Math.max(clipStart, Math.min(markEnd - 0.05, initialStart + deltaSec));
        onUpdateMark({ markStart: newStart });
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
    },
    [markStart, markEnd, clipStart, zoomLevel, onUpdateMark, windowDragCleanupRef]
  );

  // ── Drag Right Boundary (Out point) in Mark Mode ──
  const handleEndPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const initialPointerX = e.clientX;
      const initialEnd = markEnd;

      const onPointerMove = (ev: PointerEvent) => {
        const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
        const newEnd = Math.min(clipEnd, Math.max(markStart + 0.05, initialEnd + deltaSec));
        onUpdateMark({ markEnd: newEnd });
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
    },
    [markStart, markEnd, clipEnd, zoomLevel, onUpdateMark, windowDragCleanupRef]
  );

  // ── Drag Body to slide the mark window across the clip ──
  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || isConfirmed) return;
      e.stopPropagation();
      const initialPointerX = e.clientX;
      const initialStart = markStart;
      const curDur = markEnd - markStart;

      const onPointerMove = (ev: PointerEvent) => {
        const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
        let newStart = initialStart + deltaSec;
        newStart = Math.max(clipStart, Math.min(clipEnd - curDur, newStart));
        onUpdateMark({ markStart: newStart, markEnd: newStart + curDur });
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
    },
    [isConfirmed, markStart, markEnd, clipStart, clipEnd, zoomLevel, onUpdateMark, windowDragCleanupRef]
  );

  // ── Drag Stretch Handle in Confirmed Mode (Squeeze / Extend) ──
  const handleStretchPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const initialPointerX = e.clientX;
      const initialDuration = stretchedDuration;

      const onPointerMove = (ev: PointerEvent) => {
        const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
        const newDuration = Math.max(0.05, initialDuration + deltaSec);
        onUpdateDrag(newDuration);
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
    },
    [stretchedDuration, zoomLevel, onUpdateDrag, windowDragCleanupRef]
  );

  return (
    <>
      {/* Target clip halo outline so user clearly sees which clip is being operated on */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none rounded border-2 border-amber-500/40 bg-amber-500/[0.04] transition-all"
        style={{
          left: `${clipX}px`,
          width: `${clipW}px`,
        }}
      />

      {/* Dynamic Stretch Mark / Stretcher Box */}
      <div
        className={`absolute top-0 bottom-0 pointer-events-auto transition-colors select-none ${
          isConfirmed
            ? 'backdrop-blur-[2px] bg-amber-500/20 border-t-2 border-b-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)] z-30'
            : 'backdrop-blur-[1px] bg-amber-500/15 hover:bg-amber-500/20 border-t border-b border-amber-400/80 cursor-move shadow-[0_0_15px_rgba(245,158,11,0.15)] z-30'
        }`}
        style={{
          left: `${startX}px`,
          width: `${width}px`,
        }}
        onPointerDown={handleBodyPointerDown}
      >
        {/* Top Header Floating Badge / Controls */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#18181b]/95 border border-amber-500/50 shadow-xl text-white text-[11px] font-medium z-40 whitespace-nowrap">
          <Gauge className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />

          {!isConfirmed ? (
            /* Phase 1: Marking Mode Controls */
            <>
              <span className="font-semibold text-amber-300">Mark Region:</span>
              <span className="font-mono text-zinc-300">{(markEnd - markStart).toFixed(2)}s</span>

              {/* Loop / Audition Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop();
                }}
                title={isLoopingRegion ? 'Stop Loop Preview' : 'Loop Preview Marked Section'}
                className={`p-1 rounded-md transition-colors flex items-center gap-1 px-1.5 ${
                  isLoopingRegion && isPlaying
                    ? 'bg-amber-500 text-black font-bold animate-pulse'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                <Repeat className="w-3 h-3" />
                <span className="text-[10px]">{isLoopingRegion && isPlaying ? 'Looping' : 'Audition'}</span>
              </button>

              {/* Confirm Mark (Tick ✓) Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmMark();
                }}
                title="Confirm Mark — Proceed to Stretch / Squeeze handle"
                className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow flex items-center gap-1 px-2"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="text-[10px]">Confirm Mark</span>
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                title="Cancel Dynamic Stretch"
                className="p-1 rounded-md hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            /* Phase 2: Stretch Mode Controls */
            <>
              <span className="font-bold text-amber-400">Stretch:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                  speedRatio > 1.05
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : speedRatio < 0.95
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {speedRatio.toFixed(2)}x {speedRatio > 1.05 ? 'Fast' : speedRatio < 0.95 ? 'Slow' : '1.0x'}
              </span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {stretchedDuration.toFixed(2)}s
              </span>

              {/* Apply Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                title="Apply Dynamic Speed Stretch to clip"
                className="p-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow flex items-center gap-1 px-2.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="text-[10px]">Apply</span>
              </button>

              {/* Reset to mark mode */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateDrag(originalRegionDuration);
                }}
                title="Reset Stretch"
                className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                title="Cancel Dynamic Stretch"
                className="p-1 rounded-md hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* Phase 1 Left Boundary Grab Handle */}
        {!isConfirmed && (
          <div
            className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 flex items-center justify-center cursor-col-resize z-50 group hover:w-4 hover:-ml-2"
            onPointerDown={handleStartPointerDown}
            title="Drag to adjust Mark In point"
          >
            <div className="w-1 h-full bg-amber-400 group-hover:bg-amber-300 group-hover:w-1.5 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] transition-all" />
          </div>
        )}

        {/* Phase 1 Right Boundary Grab Handle */}
        {!isConfirmed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 flex items-center justify-center cursor-col-resize z-50 group hover:w-4 hover:-mr-2"
            onPointerDown={handleEndPointerDown}
            title="Drag to adjust Mark Out point"
          >
            <div className="w-1 h-full bg-amber-400 group-hover:bg-amber-300 group-hover:w-1.5 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] transition-all" />
          </div>
        )}

        {/* Phase 2 Confirmed: Interactive Stretch Drag Handle */}
        {isConfirmed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-6 -mr-3 flex items-center justify-center cursor-ew-resize z-50 group select-none"
            onPointerDown={handleStretchPointerDown}
            title="Drag left to SQUEEZE (Speed Up) or right to EXTEND (Slow Down)"
          >
            <div className="w-3 h-12 bg-amber-500 hover:bg-amber-400 rounded-md border border-white/40 shadow-[0_0_15px_rgba(245,158,11,0.9)] flex items-center justify-center transition-all">
              <ChevronsLeftRight className="w-3 h-3 text-black font-bold" />
            </div>
          </div>
        )}

        {/* Informative footer badge indicating duration compensation status */}
        {isConfirmed && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[9px] text-zinc-300 pointer-events-none whitespace-nowrap">
            {maintainDuration ? 'Maintain Duration: ON (Tail auto-compensates)' : 'Maintain Duration: OFF (Downstream clips ripple)'}
          </div>
        )}
      </div>
    </>
  );
}
