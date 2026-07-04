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
  RotateCcw,
  ArrowLeftRight,
  ArrowRightToLine,
  ArrowLeftToLine,
  Timer,
  Save,
  FileUp,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { EditorTool } from '@/types';
import { useState, useRef, useCallback } from 'react';
import { probeFile } from '@/utils/mediaProbe';

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
    resetProject,
    copyClip,
    pasteClip,
    cutClip,
    duplicateClip,
    addMedia,
  } = useEditorStore();

  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const tools: { id: EditorTool; icon: any; label: string; shortcut: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { id: 'trackSelect', icon: ArrowRightToLine, label: 'Track Select Forward', shortcut: 'A' },
    { id: 'trackSelectBackward', icon: ArrowLeftToLine, label: 'Track Select Backward', shortcut: 'Shift+A' },
    { id: 'ripple', icon: ArrowLeftRight, label: 'Ripple Edit', shortcut: 'B' },
    { id: 'rateStretch', icon: Timer, label: 'Rate Stretch', shortcut: 'R' },
    { id: 'split', icon: Scissors, label: 'Split', shortcut: 'C' },
    { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
    { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  ];

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const mediaItem = await probeFile(file);
        addMedia(mediaItem, file);
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
      }
    }
    setShowFileMenu(false);
    e.target.value = '';
  }, [addMedia]);

  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProjectFile = () => {
    const state = useEditorStore.getState();
    
    // Clean up urls since they are session-specific blob URLs
    const cleanMediaLibrary = state.mediaLibrary.map(item => ({
      ...item,
      url: item.type === 'text' || item.type === 'fx' ? '' : 'PENDING_RESTORE',
      thumbnail: item.thumbnail ? 'PENDING_RESTORE' : undefined,
    }));

    const projectData = {
      version: '1.0.0',
      tracks: state.tracks,
      mediaLibrary: cleanMediaLibrary,
      currentTime: state.currentTime,
      aspectRatio: state.aspectRatio,
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_${Date.now()}.procut`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowFileMenu(false);
  };

  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.tracks || !data.mediaLibrary) {
          alert('Invalid project file format.');
          return;
        }

        useEditorStore.setState({
          tracks: data.tracks,
          mediaLibrary: data.mediaLibrary,
          currentTime: data.currentTime || 0,
          aspectRatio: data.aspectRatio || '16:9',
          history: [
            {
              tracks: JSON.parse(JSON.stringify(data.tracks)),
              currentTime: data.currentTime || 0,
            }
          ],
          historyIndex: 0
        });

        // Trigger recalc
        useEditorStore.getState().recalcTotalDuration();
        alert('Project loaded successfully! Please re-import local media files to link them.');
      } catch (err) {
        console.error('Error parsing project file:', err);
        alert('Failed to parse project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowFileMenu(false);
  };

  const handleZoomToFit = () => {
    const container = document.querySelector('.timeline-track-workspace');
    const width = container ? container.clientWidth - 150 : 800; // Subtract headers width
    const totalDuration = useEditorStore.getState().totalDuration;
    if (totalDuration > 0) {
      const targetZoom = Math.max(20, Math.min(400, width / totalDuration));
      useEditorStore.getState().setZoomLevel(targetZoom);
    }
    setShowViewMenu(false);
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
                onClick={handleSaveProjectFile}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" /> Save Project File
              </button>
              <button
                onClick={() => projectFileInputRef.current?.click()}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <FileUp className="w-3.5 h-3.5 text-amber-400" /> Open Project File
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
              <div className="border-t border-[#3e3e3e] my-1" />
              <button
                onClick={handleZoomToFit}
                className="w-full px-3 py-2 text-xs text-left text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Zoom to Fit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Empty (Tools moved to Timeline header) */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
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
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".procut"
        onChange={handleOpenProjectFile}
        className="hidden"
      />
    </div>
  );
}
