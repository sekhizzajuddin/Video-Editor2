import {
  Clapperboard,
  Undo2,
  Redo2,
  Scissors,
  Hand,
  MousePointer2,
  ZoomIn,
  Settings,
  Download,
  FolderOpen,
  Plus,
  ChevronDown,
  Sun,
  RotateCcw,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { EditorTool } from '@/types';
import { useState, useRef } from 'react';

export function TopToolbar() {
  const {
    activeTool,
    setActiveTool,
    undo,
    redo,
    historyIndex,
    history,
    setShowExportModal,
    setShowSettingsModal,
    loadDemoProject,
    resetProject,
    copyClip,
    pasteClip,
    cutClip,
    duplicateClip,
  } = useEditorStore();

  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const tools: { id: EditorTool; icon: typeof Scissors; label: string; shortcut: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { id: 'split', icon: Scissors, label: 'Split', shortcut: 'S' },
    { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
    { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  ];

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
      const { addMedia } = useEditorStore.getState();
      addMedia({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: type as 'video' | 'audio' | 'image',
        duration: type === 'image' ? 5 : 30,
        url,
        size: file.size,
        createdAt: Date.now(),
      });
    });
    setShowFileMenu(false);
  };

  return (
    <div className="h-12 bg-[#1e1e1e] border-b border-[#3e3e3e] flex items-center px-3 select-none z-50">
      {/* Left: Logo + Menus */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 mr-4">
          <Clapperboard className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold text-white tracking-wide">ProCut</span>
        </div>

        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowFileMenu(!showFileMenu); setShowEditMenu(false); setShowViewMenu(false); }}
            className="px-3 py-1.5 text-xs text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            File <ChevronDown className="w-3 h-3" />
          </button>
          {showFileMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-[#2d2d2d] border border-[#3e3e3e] rounded shadow-xl z-50 py-1">
              <button
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Import Media
              </button>
              <button
                onClick={() => { setShowExportModal(true); setShowFileMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export Video
              </button>
              <div className="border-t border-[#3e3e3e] my-1" />
              <button
                onClick={() => { resetProject(); setShowFileMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> New Project
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowEditMenu(!showEditMenu); setShowFileMenu(false); setShowViewMenu(false); }}
            className="px-3 py-1.5 text-xs text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            Edit <ChevronDown className="w-3 h-3" />
          </button>
          {showEditMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d2d] border border-[#3e3e3e] rounded shadow-xl z-50 py-1">
              <button
                onClick={() => { undo(); setShowEditMenu(false); }}
                disabled={!canUndo}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 disabled:opacity-30 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button
                onClick={() => { redo(); setShowEditMenu(false); }}
                disabled={!canRedo}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 disabled:opacity-30 transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" /> Redo
              </button>
              <div className="border-t border-[#3e3e3e] my-1" />
              <button
                onClick={() => { cutClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <Scissors className="w-3.5 h-3.5" /> Cut
              </button>
              <button
                onClick={() => { copyClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                onClick={() => { pasteClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Paste
              </button>
              <button
                onClick={() => { duplicateClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Duplicate
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowViewMenu(!showViewMenu); setShowFileMenu(false); setShowEditMenu(false); }}
            className="px-3 py-1.5 text-xs text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            View <ChevronDown className="w-3 h-3" />
          </button>
          {showViewMenu && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-[#2d2d2d] border border-[#3e3e3e] rounded shadow-xl z-50 py-1">
              <button
                onClick={() => { useEditorStore.getState().zoomIn(); setShowViewMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" /> Zoom In
              </button>
              <button
                onClick={() => { useEditorStore.getState().zoomOut(); setShowViewMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 rotate-180" /> Zoom Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Tools */}
      <div className="flex-1 flex items-center justify-center gap-1">
        <div className="flex items-center bg-[#252525] rounded border border-[#3e3e3e] p-0.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                title={`${tool.label} (${tool.shortcut})`}
                className={`relative p-2 rounded transition-all duration-150 group ${
                  isActive
                    ? 'bg-[#3e3e3e] text-white'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  {tool.label} ({tool.shortcut})
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-[#3e3e3e] mx-2" />

        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-2 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded disabled:opacity-30 transition-all"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-2 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded disabled:opacity-30 transition-all"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={loadDemoProject}
          className="px-3 py-1.5 text-xs text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1.5 transition-colors"
        >
          <Sun className="w-3.5 h-3.5" /> Load Demo
        </button>

        <div className="w-px h-5 bg-[#3e3e3e]" />

        <button
          onClick={() => setShowExportModal(true)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>

        <button
          onClick={() => setShowSettingsModal(true)}
          title="Settings"
          className="p-2 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        onChange={handleFileImport}
        className="hidden"
      />
    </div>
  );
}
