import React, { useMemo } from 'react';
import { ZoomIn, ZoomOut, Film, Music, Type, Sparkles, Magnet, LayoutGrid, Layers, BookmarkPlus, Trash2, Gauge, X, Zap, RotateCcw } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { InsertOverwriteButtons } from './InsertOverwriteButtons';

interface TimelineToolbarProps {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  addTrack: (type: 'video' | 'audio' | 'text' | 'fx') => void;
  isArrangeMode: boolean;
  setArrangeMode: (val: boolean) => void;
  activeTool: string;
}

export function TimelineToolbar({
  zoomLevel,
  zoomIn,
  zoomOut,
  addTrack,
  isArrangeMode,
  setArrangeMode,
  activeTool,
}: TimelineToolbarProps) {
  const settings = useEditorStore((s) => s.settings);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const exportRegions = useEditorStore((s) => s.exportRegions || []);
  const addExportRegion = useEditorStore((s) => s.addExportRegion);
  const clearExportRegions = useEditorStore((s) => s.clearExportRegions);
  const dynamicStretch = useEditorStore((s) => s.dynamicStretch);
  const startDynamicStretch = useEditorStore((s) => s.startDynamicStretch);
  const applyDynamicStretch = useEditorStore((s) => s.applyDynamicStretch);
  const cancelDynamicStretch = useEditorStore((s) => s.cancelDynamicStretch);
  const setDynamicStretchMaintainDuration = useEditorStore((s) => s.setDynamicStretchMaintainDuration);
  const addSpeedFrame = useEditorStore((s) => s.addSpeedFrame);
  const removeSpeedFrame = useEditorStore((s) => s.removeSpeedFrame);
  const selectedSpeedFrame = useEditorStore((s) => s.selectedSpeedFrame);
  const clearSpeedFrames = useEditorStore((s) => s.clearSpeedFrames);
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const tracks = useEditorStore((s) => s.tracks);
  const totalDuration = useEditorStore((s) => s.totalDuration);

  const selectedClip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const t of tracks) {
      const c = t.clips?.find((x) => x.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [selectedClipId, tracks]);
  const hasSpeedFrames = Boolean(selectedClip?.speedFrames && selectedClip.speedFrames.length > 0);

  const handleAddExportRegion = () => {
    let start = currentTime;
    let end = currentTime + 5;

    // If a clip is selected, snap the region to that clip
    if (selectedClipId) {
      for (const track of tracks) {
        const found = track.clips.find(c => c.id === selectedClipId);
        if (found) {
          start = found.startTime;
          end = found.startTime + found.duration;
          break;
        }
      }
    } else {
      if (totalDuration > 0 && end > totalDuration && start < totalDuration) {
        end = totalDuration;
      }
    }

    if (end <= start) {
      end = start + 5;
    }

    addExportRegion(start, end);
  };

  return (
    <div className="h-9 flex items-center px-3 bg-[var(--theme-bg-panel)] border-b border-[var(--theme-border)] shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-none text-xs transition-colors">
      {/* Zoom Control Group */}
      <div className="flex items-center bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-lg p-0.5 shadow-sm">
        <button
          onClick={zoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-[var(--theme-text-muted)] w-14 text-center tabular-nums font-semibold">
          {zoomLevel}px/s
        </span>
        <button
          onClick={zoomIn}
          title="Zoom In"
          aria-label="Zoom In"
          className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-[var(--theme-border)] mx-2.5" />

      {/* Add Track Quick Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => addTrack('video')}
          className="px-2 py-1 text-[11px] font-medium text-[var(--theme-text-muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded-lg border border-transparent hover:border-blue-500/20 flex items-center gap-1.5 transition-all"
        >
          <Film className="w-3 h-3 text-blue-500" />
          <span>+ Video</span>
        </button>
        <button
          onClick={() => addTrack('audio')}
          className="px-2 py-1 text-[11px] font-medium text-[var(--theme-text-muted)] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg border border-transparent hover:border-emerald-500/20 flex items-center gap-1.5 transition-all"
        >
          <Music className="w-3 h-3 text-emerald-500" />
          <span>+ Audio</span>
        </button>
        <button
          onClick={() => addTrack('text')}
          className="px-2 py-1 text-[11px] font-medium text-[var(--theme-text-muted)] hover:text-amber-500 hover:bg-amber-500/10 rounded-lg border border-transparent hover:border-amber-500/20 flex items-center gap-1.5 transition-all"
        >
          <Type className="w-3 h-3 text-amber-500" />
          <span>+ Text</span>
        </button>
        <button
          onClick={() => addTrack('fx')}
          className="px-2 py-1 text-[11px] font-medium text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/25 flex items-center gap-1.5 transition-all"
          title="Add FX Track — drag effects from the Effects panel onto it"
        >
          <Sparkles className="w-3 h-3 text-rose-500" />
          <span>+ FX</span>
        </button>
      </div>

      <div className="w-px h-4 bg-[var(--theme-border)] mx-2.5" />

      {/* NLE Workflow Buttons */}
      <InsertOverwriteButtons />

      <div className="w-px h-4 bg-[var(--theme-border)] mx-2.5" />

      {/* Arrange Mode Button */}
      <button
        onClick={() => setArrangeMode(!isArrangeMode)}
        title="Arrange clips visually — drag to reorder or move across tracks"
        className={`px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 transition-all font-medium ${
          isArrangeMode
            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/40 shadow-sm font-semibold'
            : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Arrange</span>
      </button>

      {/* Snapping Toggle */}
      <button
        onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
        title={settings.snapEnabled ? 'Disable Snapping (N)' : 'Enable Snapping (N)'}
        className={`ml-1 px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 transition-all font-medium ${
          settings.snapEnabled
            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/40 font-semibold shadow-sm'
            : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
        }`}
      >
        <Magnet className="w-3.5 h-3.5" />
        <span>Snapping</span>
      </button>

      {/* Export Mark / Region Button */}
      <div className="relative flex items-center ml-1">
        <button
          onClick={handleAddExportRegion}
          title="Add Export Mark (Region) for timeline range export (or around selected clip)"
          className={`px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 transition-all font-medium ${
            exportRegions.length > 0
              ? 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 font-semibold shadow-sm'
              : 'text-[var(--theme-text-muted)] hover:text-emerald-500 hover:bg-emerald-500/10 border border-transparent'
          }`}
        >
          <BookmarkPlus className="w-3.5 h-3.5 text-emerald-500" />
          <span>Export Mark</span>
          {exportRegions.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500 text-white rounded-full leading-none">
              {exportRegions.length}
            </span>
          )}
        </button>

        {exportRegions.length > 0 && (
          <button
            onClick={() => clearExportRegions()}
            title="Clear all export marks"
            className="ml-0.5 p-1 text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dynamic Speed Ramping (Speed Frames) */}
      <div className="relative flex items-center ml-1 pl-1 border-l border-[var(--theme-border)]/50 gap-1.5">
        {/* Always visible Add Speed Frame button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (selectedClipId) {
              addSpeedFrame(selectedClipId);
            }
          }}
          disabled={!selectedClipId}
          title={
            selectedClipId
              ? 'Add a Speed Frame at the playhead to dynamically rate-stretch this section'
              : 'Select a clip to add a Speed Frame'
          }
          className={`px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 transition-all font-medium ${
            selectedClipId
              ? 'text-amber-500 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 font-semibold shadow-xs cursor-pointer'
              : 'text-[var(--theme-text-muted)] opacity-50 cursor-not-allowed border border-transparent'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>+ Speed Frame</span>
        </button>

        {/* Delete Speed Frame button shown alongside when a frame is selected */}
        {selectedSpeedFrame && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const sf = useEditorStore.getState().selectedSpeedFrame;
              if (sf) {
                removeSpeedFrame(sf.clipId, sf.frameId);
              }
            }}
            title="Delete selected Speed Frame (Delete / Backspace)"
            className="px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 transition-all font-medium text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 font-semibold shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Speed Frame</span>
          </button>
        )}

        {hasSpeedFrames && selectedClipId && (
          <button
            onClick={() => clearSpeedFrames(selectedClipId)}
            title="Reset Speed Frames (Restore original uniform speed)"
            className="px-2 py-1 text-[11px] rounded-lg text-[var(--theme-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Speed</span>
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Tool indicators */}
      {activeTool === 'split' && (
        <span className="text-[10px] text-amber-500 font-medium px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
          Click a clip to split at playhead
        </span>
      )}
      {isArrangeMode && (
        <span className="text-[10px] text-blue-500 font-bold px-2 py-0.5 bg-blue-500/10 border border-blue-500/25 rounded-md animate-pulse">
          Arrange Mode Active
        </span>
      )}
    </div>
  );
}

