import React, { useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { formatCentisecondTime } from '../timelineUtils';
import { Bookmark, X, Repeat } from 'lucide-react';
import type { ExportRegion } from '@/types';

interface ExportRegionOverlayProps {
  zoomLevel: number;
}

export const ExportRegionOverlay = React.memo(function ExportRegionOverlay({
  zoomLevel,
}: ExportRegionOverlayProps) {
  const exportRegions = useEditorStore((s) => s.exportRegions || []);
  const selectedExportRegionId = useEditorStore((s) => s.selectedExportRegionId);
  const selectExportRegion = useEditorStore((s) => s.selectExportRegion);
  const updateExportRegion = useEditorStore((s) => s.updateExportRegion);
  const removeExportRegion = useEditorStore((s) => s.removeExportRegion);

  if (!exportRegions || exportRegions.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-visible">
      {exportRegions.map((region) => (
        <SingleExportRegionItem
          key={region.id}
          region={region}
          zoomLevel={zoomLevel}
          isSelected={selectedExportRegionId === region.id}
          onSelect={() => selectExportRegion(region.id)}
          onUpdate={(updates) => updateExportRegion(region.id, updates)}
          onDelete={() => removeExportRegion(region.id)}
        />
      ))}
    </div>
  );
});

interface SingleExportRegionItemProps {
  region: ExportRegion;
  zoomLevel: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ExportRegion>) => void;
  onDelete: () => void;
}

function SingleExportRegionItem({
  region,
  zoomLevel,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: SingleExportRegionItemProps) {
  const startX = region.startTime * zoomLevel;
  const endX = region.endTime * zoomLevel;
  const width = Math.max(2, endX - startX);
  const color = region.color || '#10b981';

  // Handle Dragging Start Handle
  const handleStartPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const initialPointerX = e.clientX;
    const initialStart = region.startTime;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
      const newStart = Math.max(0, Math.min(region.endTime - 0.2, initialStart + deltaSec));
      onUpdate({ startTime: newStart });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [region.startTime, region.endTime, zoomLevel, onSelect, onUpdate]);

  // Handle Dragging End Handle
  const handleEndPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const initialPointerX = e.clientX;
    const initialEnd = region.endTime;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
      const newEnd = Math.max(region.startTime + 0.2, initialEnd + deltaSec);
      onUpdate({ endTime: newEnd });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [region.startTime, region.endTime, zoomLevel, onSelect, onUpdate]);

  // Handle Dragging Body to Slide Region
  const handleBodyPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag if left click
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();

    const initialPointerX = e.clientX;
    const initialStart = region.startTime;
    const duration = region.endTime - region.startTime;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - initialPointerX) / zoomLevel;
      const newStart = Math.max(0, initialStart + deltaSec);
      onUpdate({ startTime: newStart, endTime: newStart + duration });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [region.startTime, region.endTime, zoomLevel, onSelect, onUpdate]);

  const durationSec = region.endTime - region.startTime;

  return (
    <>
      {/* ── Frosted Glass Area Overlay across timeline tracks ── */}
      <div
        className={`absolute top-0 bottom-0 pointer-events-auto transition-colors cursor-move ${
          isSelected
            ? 'backdrop-blur-[1.5px] bg-emerald-500/10 dark:bg-emerald-400/15 border-t border-b border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] z-20'
            : 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.07] border-t border-b border-transparent z-10'
        }`}
        style={{
          left: `${startX}px`,
          width: `${width}px`,
        }}
        onPointerDown={handleBodyPointerDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {/* Floating status pill for active region */}
        {isSelected && (
          <div
            className="sticky top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium shadow-lg backdrop-blur-md border border-white/20 select-none z-30 transition-all pointer-events-auto"
            style={{
              backgroundColor: `${color}ee`,
              color: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Bookmark className="w-3 h-3 text-white" />
            <span className="font-semibold tracking-wide">{region.name || 'Export Mark'}</span>
            <span className="opacity-90 font-mono text-[9px]">{formatCentisecondTime(durationSec)}</span>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/25 text-[8px] font-bold text-white/95 uppercase tracking-wider">
              <Repeat className="w-2.5 h-2.5" /> Loop
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete export mark"
              className="ml-0.5 p-0.5 hover:bg-black/20 rounded-full transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Start Vertical Tail (Spans full height of timeline) ── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-auto z-30 flex flex-col items-center group cursor-ew-resize select-none"
        style={{
          left: `${startX}px`,
          transform: 'translateX(-50%)',
          width: '16px',
        }}
        onPointerDown={handleStartPointerDown}
        title={`Export In: ${formatCentisecondTime(region.startTime)} (Drag to adjust)`}
      >
        {/* Top Handle Bracket */}
        <div
          className={`w-4 h-4 rounded-b flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
            isSelected ? 'scale-110 ring-2 ring-white/60' : 'opacity-90'
          }`}
          style={{ backgroundColor: color }}
        >
          <span className="text-[10px] font-black text-white leading-none">[</span>
        </div>

        {/* Vertical Tail Line spanning all tracks */}
        <div
          className={`flex-1 w-[2px] shadow-sm transition-all group-hover:w-[3px] ${
            isSelected ? 'shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'opacity-80 group-hover:opacity-100'
          }`}
          style={{ backgroundColor: color }}
        />

        {/* Bottom Handle Knob */}
        <div
          className="w-2.5 h-2.5 rounded-full shadow-md group-hover:scale-125 transition-transform"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* ── End Vertical Tail (Spans full height of timeline) ── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-auto z-30 flex flex-col items-center group cursor-ew-resize select-none"
        style={{
          left: `${endX}px`,
          transform: 'translateX(-50%)',
          width: '16px',
        }}
        onPointerDown={handleEndPointerDown}
        title={`Export Out: ${formatCentisecondTime(region.endTime)} (Drag to adjust)`}
      >
        {/* Top Handle Bracket */}
        <div
          className={`w-4 h-4 rounded-b flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
            isSelected ? 'scale-110 ring-2 ring-white/60' : 'opacity-90'
          }`}
          style={{ backgroundColor: color }}
        >
          <span className="text-[10px] font-black text-white leading-none">]</span>
        </div>

        {/* Vertical Tail Line spanning all tracks */}
        <div
          className={`flex-1 w-[2px] shadow-sm transition-all group-hover:w-[3px] ${
            isSelected ? 'shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'opacity-80 group-hover:opacity-100'
          }`}
          style={{ backgroundColor: color }}
        />

        {/* Bottom Handle Knob */}
        <div
          className="w-2.5 h-2.5 rounded-full shadow-md group-hover:scale-125 transition-transform"
          style={{ backgroundColor: color }}
        />
      </div>
    </>
  );
}
