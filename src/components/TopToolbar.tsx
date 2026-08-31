// ─────────────────────────────────────────────────────────────────────────────
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobileTopBar.tsx
//   src/mobile/components/MobileToolRail.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { 
  Menu,
  X,
  FileVideo,
  Image as ImageIcon,
  Volume2,
  Search,
  Check,
  Folder,
  Film,
  Clock,
  DownloadCloud,
  PlaySquare,
  FileAudio,
  Settings2,
  FileVideo2,
  Play,
  Zap,
  UploadCloud,
  Monitor,
  Share2,
  Music,
  Speaker,
  Maximize2,
  Minimize2,
  SkipBack,
  SplitSquareHorizontal,
  Layers,
  PenTool,
  Hash,
  Shield,
  Database,
  Cpu,
  Wifi,
  Globe,
  Map,
  Compass,
  Book,
  Target,
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
  Palette,
  ChevronDown,
  RotateCcw,
  ArrowLeftRight,
  ArrowRightToLine,
  ArrowLeftToLine,
  Timer,
  Save,
  FileUp,
  Layout,
  Type,
  MoveHorizontal,
  SlidersHorizontal,
  MonitorPlay,
  Link,
  Activity,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useTheme } from '@/hooks/useTheme';
import type { EditorTool } from '@/types';
import { useState, useRef, useCallback, useEffect } from 'react';
import { probeFile } from '@/utils/mediaProbe';
import { saveProjectAs, saveProjectToHandle, openProjectFile, serializeProjectData, loadProjectData } from '@/utils/fileSystemAccess';
import { setActiveProject } from '@/utils/projectPersistence';
import { RecentProjectsModal } from './RecentProjectsModal';
import { toast } from 'sonner';

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
    setShowTeleprompter,
    syncSelectedClips,
    resetProject,
    copyClip,
    pasteClip,
    cutClip,
    duplicateClip,
    addMedia,
    workspaceLayout,
    setWorkspaceLayout,
    clipboardData,
    clearClipboard,
    scopeSettings,
    setScopeSettings,
  } = useEditorStore();

  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showRecentModal, setShowRecentModal] = useState(false);

  const { theme, toggle } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const tools: { id: EditorTool; icon: any; label: string; shortcut: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { id: 'trackSelect', icon: ArrowRightToLine, label: 'Track Select Forward', shortcut: 'A' },
    { id: 'trackSelectBackward', icon: ArrowLeftToLine, label: 'Track Select Backward', shortcut: 'Shift+A' },
    { id: 'ripple', icon: ArrowLeftRight, label: 'Ripple Edit', shortcut: 'B' },
    { id: 'rateStretch', icon: Timer, label: 'Rate Stretch', shortcut: 'R' },
    { id: 'slip', icon: SlidersHorizontal, label: 'Slip Tool', shortcut: 'Y' },
    { id: 'slide', icon: MoveHorizontal, label: 'Slide Tool', shortcut: 'U' },
    { id: 'split', icon: Scissors, label: 'Split', shortcut: 'C' },
    { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
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

  const handleSaveProjectFile = async () => {
    const state = useEditorStore.getState();
    if (state.projectFileHandle) {
      try {
        const fileContent = serializeProjectData(state);
        await saveProjectToHandle(state.projectFileHandle, fileContent);
        useEditorStore.setState({ hasUnsavedChanges: false });
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Project saved successfully." }}));
      } catch (err) {
        console.error('Failed to save to handle:', err);
        const handle = await saveProjectAs();
        if (handle) useEditorStore.getState().setProjectFileHandle(handle);
      }
    } else {
      const handle = await saveProjectAs();
      if (handle) useEditorStore.getState().setProjectFileHandle(handle);
    }
    setShowFileMenu(false);
  };

  const handleSaveProjectAs = async () => {
    const handle = await saveProjectAs();
    if (handle) useEditorStore.getState().setProjectFileHandle(handle);
    setShowFileMenu(false);
  };

  const handleOpenProjectFile = async (e: any) => {
    if ('showOpenFilePicker' in window) {
      if (e && e.preventDefault) e.preventDefault();
      const handle = await openProjectFile();
      if (handle) useEditorStore.getState().setProjectFileHandle(handle);
      setShowFileMenu(false);
      return;
    }

    // Fallback for browsers without File System Access API
    if (e && e.target && e.target.files) {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          loadProjectData(data);
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Project loaded! Please re-import local media files to relink them.', type: 'success' }}));
        } catch (err) {
          console.error('Error parsing project file:', err);
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to parse project file. The file may be corrupted.', type: 'error' }}));
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      setShowFileMenu(false);
    } else {
      projectFileInputRef.current?.click();
    }
  };

  const handleZoomToFit = () => {
    const container = document.querySelector('.timeline-track-workspace');
    const width = container ? container.clientWidth - 150 : 800;
    const totalDuration = useEditorStore.getState().totalDuration;
    if (totalDuration > 0) {
      const targetZoom = Math.max(20, Math.min(400, width / totalDuration));
      useEditorStore.getState().setZoomLevel(targetZoom);
    }
    setShowViewMenu(false);
  };

  // FIX C8: Confirm before destructively resetting the project
  const handleCloseProject = async () => {
    const state = useEditorStore.getState();
    const hasContent = state.tracks.some(t => t.clips.length > 0);
    
    if (hasContent && state.hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to close this project without saving?'
      );
      if (!confirmed) {
        // Option to save could be triggered here
        await handleSaveProjectFile();
        return;
      }
    }
    
    await resetProject();
    useEditorStore.getState().setProjectInfo('default', '');
    useEditorStore.setState({ projectFileHandle: null, hasUnsavedChanges: false });
    setActiveProject('default');
    setShowFileMenu(false);
  };

  // FIX H10: Close all menus when clicking outside the toolbar
  useEffect(() => {
    if (!showFileMenu && !showEditMenu && !showViewMenu && !showLayoutMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.relative')) {
        setShowFileMenu(false);
        setShowEditMenu(false);
        setShowViewMenu(false);
        setShowLayoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFileMenu, showEditMenu, showViewMenu, showLayoutMenu]);

  return (
    <div id="top-toolbar-root" className="h-12 bg-card border-b border-border flex items-center px-3 select-none z-50">
      {/* Left: Logo + Menus */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 mr-4">
          <Clapperboard className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold text-foreground tracking-wide">ProCut</span>
        </div>

        {/* Workspace Layout Menu */}
        <div className="relative ml-2 mr-2">
          <button
            onClick={() => { setShowLayoutMenu(!showLayoutMenu); setShowFileMenu(false); setShowEditMenu(false); setShowViewMenu(false); }}
            className="px-3 py-1.5 text-xs text-amber-400 font-medium hover:text-amber-300 hover:bg-accent rounded flex items-center gap-1 transition-colors"
          >
            <Layout className="w-3.5 h-3.5" /> Workspace: {workspaceLayout?.preset || 'Editing'} <ChevronDown className="w-3 h-3" />
          </button>
          {showLayoutMenu && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-popover border border-border rounded shadow-xl z-50 py-1">
              {['Editing', 'Color', 'Audio', 'Generative'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    if (preset === 'Editing') setWorkspaceLayout({ preset: 'Editing', leftWidth: 250, rightWidth: 280, timelineHeight: 320 });
                    if (preset === 'Color') setWorkspaceLayout({ preset: 'Color', leftWidth: 200, rightWidth: 400, timelineHeight: 320 });
                    if (preset === 'Audio') setWorkspaceLayout({ preset: 'Audio', leftWidth: 200, rightWidth: 280, timelineHeight: 250 });
                    if (preset === 'Generative') setWorkspaceLayout({ preset: 'Generative', leftWidth: 200, rightWidth: 0, timelineHeight: 250 });
                    setShowLayoutMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors ${workspaceLayout?.preset === preset ? 'text-amber-400' : 'text-muted-foreground'}`}
                >
                  {preset === 'Generative' && <Sparkles className="w-3 h-3 text-purple-400" />}
                  {preset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowFileMenu(!showFileMenu); setShowEditMenu(false); setShowViewMenu(false); setShowLayoutMenu(false); }}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1 transition-colors"
          >
            File <ChevronDown className="w-3 h-3" />
          </button>
          {showFileMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded shadow-xl z-50 py-1">
              <button
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Import Media
              </button>
              <button
                onClick={handleSaveProjectFile}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" /> Save Project
              </button>
              <button
                onClick={handleSaveProjectAs}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-amber-400 opacity-70" /> Save Project As...
              </button>
              <button
                onClick={(e) => handleOpenProjectFile(e as any)}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <FileUp className="w-3.5 h-3.5 text-amber-400" /> Open Project File
              </button>
              <button
                onClick={() => { setShowRecentModal(true); setShowFileMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> Open Recovered Projects
              </button>
              <button
                onClick={() => { setShowExportModal(true); setShowFileMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export Video
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleCloseProject}
                className="w-full px-3 py-2 text-xs text-left text-red-400 hover:text-red-300 hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Close Project (Home)
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowEditMenu(!showEditMenu); setShowFileMenu(false); setShowViewMenu(false); }}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1 transition-colors"
          >
            Edit <ChevronDown className="w-3 h-3" />
          </button>
          {showEditMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded shadow-xl z-50 py-1">
              <button
                onClick={() => { undo(); setShowEditMenu(false); }}
                disabled={!canUndo}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 disabled:opacity-30 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button
                onClick={() => { redo(); setShowEditMenu(false); }}
                disabled={!canRedo}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 disabled:opacity-30 transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" /> Redo
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { cutClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <Scissors className="w-3.5 h-3.5" /> Cut
              </button>
              <button
                onClick={() => { copyClip('whole'); toast.success('Clip copied'); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Copy
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+C</span>
              </button>
              <button
                onClick={() => { copyClip('style'); toast.success('Style copied'); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-purple-400 hover:text-purple-300 hover:bg-accent flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" /> Copy Style
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+Alt+C</span>
              </button>
              <button
                onClick={() => { pasteClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" /> Paste
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+V</span>
              </button>
              {clipboardData?.clips?.length > 0 && (
                <button
                  onClick={() => {
                    const clipType = clipboardData.type;
                    const pasteType = clipType === 'style-with-position' ? 'style-with-position' : (clipType === 'style-only' ? 'style-only' : 'style');
                    pasteClip(pasteType as any);
                    toast.success('Style pasted to clip');
                    setShowEditMenu(false);
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-purple-400 hover:text-purple-300 hover:bg-purple-950/30 flex items-center justify-between transition-colors font-medium"
                >
                  <div className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5" /> Paste Style
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+Alt+V</span>
                </button>
              )}
              <button
                onClick={() => { duplicateClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Duplicate
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+D</span>
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowViewMenu(!showViewMenu); setShowFileMenu(false); setShowEditMenu(false); }}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-1 transition-colors"
          >
            View <ChevronDown className="w-3 h-3" />
          </button>
          {showViewMenu && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-popover border border-border rounded shadow-xl z-50 py-1">
              <button
                onClick={() => { useEditorStore.getState().zoomIn(); setShowViewMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" /> Zoom In
              </button>
              <button
                onClick={() => { useEditorStore.getState().zoomOut(); setShowViewMenu(false); }}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 rotate-180" /> Zoom Out
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleZoomToFit}
                className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
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
        

        

        {clipboardData && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-full">
            <span className="font-medium">
              📋 Copied: {clipboardData.clips.length} Clip{clipboardData.clips.length !== 1 ? 's' : ''} 
              ({clipboardData.type === 'clip' ? 'Media' : clipboardData.type === 'style' ? 'Style' : 'Whole'})
            </span>
            <button 
              onClick={clearClipboard} 
              className="p-0.5 hover:bg-amber-500/20 rounded-full transition-colors"
              title="Clear Clipboard"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <button
          onClick={() => syncSelectedClips()}
          title="Sync Audio/Video"
          className="px-3 py-1.5 bg-accent hover:bg-border text-foreground/90 text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
        >
          <Link className="w-3.5 h-3.5" />
          Sync
        </button>

        <button
          onClick={() => setScopeSettings({ 
            ...scopeSettings, 
            enabled: !scopeSettings.enabled 
          })}
          title={scopeSettings.enabled ? "Hide Scopes" : "Show Scopes"}
          className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors font-medium ${
            scopeSettings.enabled 
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' 
              : 'bg-accent hover:bg-border text-foreground/90'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Scopes
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('toggle-copilot', { detail: {} }));
          }}
          title="AI Copilot (Ctrl+/)"
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/50 text-xs rounded-full flex items-center gap-1.5 transition-all font-semibold shadow-md shadow-purple-900/40"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          AI Copilot
        </button>

        <button
          onClick={() => setShowTeleprompter(true)}
          title="Teleprompter"
          className="px-3 py-1.5 bg-accent hover:bg-border text-foreground/90 text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          Teleprompter
        </button>

        <button
          onClick={() => setShowExportModal(true)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>

        <button
          type="button"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle color theme"
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setShowSettingsModal(true)}
          title="Settings"
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
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
        accept=".procut,.json"
        onChange={handleOpenProjectFile}
        className="hidden"
      />

      <RecentProjectsModal
        isOpen={showRecentModal}
        onClose={() => setShowRecentModal(false)}
        onSelect={() => {}}
      />

    </div>
  );
}
