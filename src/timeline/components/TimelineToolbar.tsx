import React from 'react';
import { ZoomIn, ZoomOut, Film, Music, Plus, Sparkles, Magnet, LayoutGrid } from 'lucide-react';
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

  return (
    <div className="h-8 flex items-center px-2 bg-secondary border-b border-border shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Zoom */}
      <div className="flex items-center gap-1">
        <button
          onClick={zoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground w-12 text-center tabular-nums">
          {zoomLevel}px/s
        </span>
        <button
          onClick={zoomIn}
          title="Zoom In"
          aria-label="Zoom In"
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-accent mx-2" />

      {/* Add tracks */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => addTrack('video')}
          className="px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1 transition-colors"
        >
          <Film className="w-3 h-3" /> + Video
        </button>
        <button
          onClick={() => addTrack('audio')}
          className="px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1 transition-colors"
        >
          <Music className="w-3 h-3" /> + Audio
        </button>
        <button
          onClick={() => addTrack('text')}
          className="px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" /> + Text
        </button>
        <button
          onClick={() => addTrack('fx')}
          className="px-2 py-0.5 text-[10px] text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded flex items-center gap-1 transition-colors"
          title="Add FX Track — drag effects from the Effects panel onto it"
        >
          <Sparkles className="w-3 h-3" /> + FX
        </button>
      </div>

      <div className="w-px h-4 bg-accent mx-2" />

      {/* NLE Workflow Buttons */}
      <InsertOverwriteButtons />

      <div className="w-px h-4 bg-accent mx-2" />

      {/* Arrange Mode Button */}
      <button
        onClick={() => setArrangeMode(!isArrangeMode)}
        title="Arrange clips visually — drag to reorder or move across tracks"
        className={`px-2 py-0.5 text-[10px] rounded flex items-center gap-1 transition-colors font-semibold ${
          isArrangeMode
            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
      >
        <LayoutGrid className="w-3 h-3" /> Arrange
      </button>

      {/* Snapping Toggle */}
      <button
        onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
        title={settings.snapEnabled ? 'Disable Snapping (N)' : 'Enable Snapping (N)'}
        className={`ml-1 px-2 py-0.5 text-[10px] rounded flex items-center gap-1 transition-colors ${
          settings.snapEnabled
            ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/30 font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
      >
        <Magnet className="w-3 h-3" /> Snapping
      </button>

      <div className="flex-1" />

      {/* Tool indicator */}
      {activeTool === 'split' && (
        <span className="text-[10px] text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded">
          Click a clip to split at playhead
        </span>
      )}
      {isArrangeMode && (
        <span className="text-[10px] text-amber-300 px-2 py-0.5 bg-amber-500/10 rounded animate-pulse">
          Arrange Mode Active
        </span>
      )}
    </div>
  );
}

