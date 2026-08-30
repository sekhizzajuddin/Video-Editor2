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
    <div className="h-9 flex items-center px-3 bg-slate-50/80 dark:bg-[#151a23]/80 border-b border-slate-200 dark:border-[#1e242f] shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-2 backdrop-blur-sm">
      {/* Zoom - pill */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1e242f] shadow-sm">
        <button
          onClick={zoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e242f] transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 w-[60px] text-center tabular-nums px-1">
          {zoomLevel}px/s
        </span>
        <button
          onClick={zoomIn}
          title="Zoom In"
          aria-label="Zoom In"
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e242f] transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-200 dark:bg-[#1e242f] mx-1" />

      {/* Add tracks - pill group */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1e242f] shadow-sm">
        <button
          onClick={() => addTrack('video')}
          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e242f] rounded-full flex items-center gap-1 transition-colors"
        >
          <Film className="w-3 h-3" /> Video
        </button>
        <button
          onClick={() => addTrack('audio')}
          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e242f] rounded-full flex items-center gap-1 transition-colors"
        >
          <Music className="w-3 h-3" /> Audio
        </button>
        <button
          onClick={() => addTrack('text')}
          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e242f] rounded-full flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" /> Text
        </button>
        <button
          onClick={() => addTrack('fx')}
          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full flex items-center gap-1 transition-colors"
          title="Add FX Track — drag effects from the Effects panel onto it"
        >
          <Sparkles className="w-3 h-3" /> FX
        </button>
      </div>

      <div className="w-px h-5 bg-slate-200 dark:bg-[#1e242f] mx-1" />

      {/* NLE Workflow Buttons */}
      <div className="flex items-center p-1 rounded-full bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1e242f] shadow-sm">
        <InsertOverwriteButtons />
      </div>

      <div className="w-px h-5 bg-slate-200 dark:bg-[#1e242f] mx-1" />

      {/* Arrange Mode Button */}
      <button
        onClick={() => setArrangeMode(!isArrangeMode)}
        title="Arrange clips visually — drag to reorder or move across tracks"
        className={`px-3 py-1.5 text-[11px] rounded-full flex items-center gap-1.5 transition-all font-bold border shadow-sm ${
          isArrangeMode
            ? 'bg-amber-500 text-black border-amber-600 shadow-amber-500/20'
            : 'bg-white dark:bg-[#0f1219] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1e242f] hover:border-slate-300'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" /> Arrange
      </button>

      {/* Snapping Toggle */}
      <button
        onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
        title={settings.snapEnabled ? 'Disable Snapping (N)' : 'Enable Snapping (N)'}
        className={`px-3 py-1.5 text-[11px] rounded-full flex items-center gap-1.5 transition-all font-bold border shadow-sm ${
          settings.snapEnabled
            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
            : 'bg-white dark:bg-[#0f1219] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e242f] hover:text-slate-700'
        }`}
      >
        <Magnet className="w-3.5 h-3.5" /> Snapping
      </button>

      <div className="flex-1" />

      {/* Tool indicator */}
      {activeTool === 'split' && (
        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 px-3 py-1 bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 rounded-full">
          ✂️ Click a clip to split at playhead
        </span>
      )}
      {isArrangeMode && (
        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 px-3 py-1 bg-amber-200 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 rounded-full animate-pulse">
          Arrange Mode Active
        </span>
      )}
    </div>
  );
}
