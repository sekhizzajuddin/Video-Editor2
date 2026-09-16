import { 
  Sun,
  Moon,
  FolderOpen,
  Save,
  FileUp,
  Download,
  RotateCcw,
  Undo2,
  Redo2,
  Scissors,
  Plus,
  Palette,
  Layout,
  Sparkles,
  Link as LinkIcon,
  Activity,
  MonitorPlay,
  Settings,
  HelpCircle,
  ChevronDown,
  X,
  User,
  Film,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useState, useRef, useCallback, useEffect } from 'react';
import { probeFile } from '@/utils/mediaProbe';
import { saveProjectAs, saveProjectToHandle, openProjectFile, serializeProjectData, loadProjectData } from '@/utils/fileSystemAccess';
import { setActiveProject } from '@/utils/projectPersistence';
import { RecentProjectsModal } from './RecentProjectsModal';
import { toast } from 'sonner';
import { ProCutLogo } from './ProCutLogo';

export function TopToolbar() {
  const {
    undo,
    redo,
    historyIndex,
    history,
    setShowExportModal,
    setShowSettingsModal,
    setShowTeleprompter,
    setShowHelpMenu,
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
    settings,
    updateSettings,
  } = useEditorStore(useShallow(s => ({
    undo: s.undo,
    redo: s.redo,
    historyIndex: s.historyIndex,
    history: s.history,
    setShowExportModal: s.setShowExportModal,
    setShowSettingsModal: s.setShowSettingsModal,
    setShowTeleprompter: s.setShowTeleprompter,
    setShowHelpMenu: s.setShowHelpMenu,
    syncSelectedClips: s.syncSelectedClips,
    resetProject: s.resetProject,
    copyClip: s.copyClip,
    pasteClip: s.pasteClip,
    cutClip: s.cutClip,
    duplicateClip: s.duplicateClip,
    addMedia: s.addMedia,
    workspaceLayout: s.workspaceLayout,
    setWorkspaceLayout: s.setWorkspaceLayout,
    clipboardData: s.clipboardData,
    clearClipboard: s.clearClipboard,
    scopeSettings: s.scopeSettings,
    setScopeSettings: s.setScopeSettings,
    settings: s.settings,
    updateSettings: s.updateSettings,
  })));

  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showHelpMenuDropdown, setShowHelpMenuDropdown] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showRecentModal, setShowRecentModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const currentTheme = settings.theme || 'dark';

  const toggleTheme = () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

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

  const handleCloseProject = async () => {
    const state = useEditorStore.getState();
    const hasContent = state.tracks.some(t => t.clips.length > 0);
    
    if (hasContent && state.hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to close this project without saving?'
      );
      if (!confirmed) {
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

  useEffect(() => {
    if (!showFileMenu && !showEditMenu && !showViewMenu && !showLayoutMenu && !showHelpMenuDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dropdown-container')) {
        setShowFileMenu(false);
        setShowEditMenu(false);
        setShowViewMenu(false);
        setShowLayoutMenu(false);
        setShowHelpMenuDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFileMenu, showEditMenu, showViewMenu, showLayoutMenu, showHelpMenuDropdown]);

  return (
    <header 
      id="top-toolbar-root" 
      className="h-12 border-b flex items-center justify-between px-3.5 select-none z-50 transition-colors duration-200"
      style={{
        backgroundColor: 'var(--theme-bg-panel)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-main)',
      }}
    >
      {/* Left: Logo & Menus */}
      <div className="flex items-center gap-2">
        {/* Brand Logo */}
        <div className="mr-2 cursor-pointer">
          <ProCutLogo size="md" />
        </div>

        {/* Workspace Layout Menu */}
        <div className="relative dropdown-container">
          <button
            onClick={() => { 
              setShowLayoutMenu(!showLayoutMenu); 
              setShowFileMenu(false); 
              setShowEditMenu(false); 
              setShowViewMenu(false); 
              setShowHelpMenuDropdown(false);
            }}
            className="px-2.5 py-1 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-main)',
            }}
          >
            <span className="text-slate-400 dark:text-slate-400 font-normal">Workspace:</span>
            <span className="font-semibold text-blue-500">{workspaceLayout?.preset || 'Editing'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLayoutMenu && (
            <div 
              className="absolute top-full left-0 mt-1.5 w-44 rounded-lg shadow-xl z-50 py-1.5 border animate-in fade-in zoom-in-95 duration-100"
              style={{
                backgroundColor: 'var(--theme-bg-card)',
                borderColor: 'var(--theme-border)',
              }}
            >
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
                  className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors hover:bg-blue-500/10 ${
                    workspaceLayout?.preset === preset ? 'text-blue-500 font-semibold' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {preset === 'Generative' && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                    {preset}
                  </div>
                  {workspaceLayout?.preset === preset && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* File Menu */}
        <div className="relative dropdown-container">
          <button
            onClick={() => { 
              setShowFileMenu(!showFileMenu); 
              setShowEditMenu(false); 
              setShowViewMenu(false); 
              setShowLayoutMenu(false);
              setShowHelpMenuDropdown(false);
            }}
            className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-500 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 transition-colors font-medium"
          >
            File <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showFileMenu && (
            <div 
              className="absolute top-full left-0 mt-1.5 w-56 rounded-lg shadow-xl z-50 py-1.5 border animate-in fade-in zoom-in-95 duration-100"
              style={{
                backgroundColor: 'var(--theme-bg-card)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <button
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Import Media
              </button>
              <button
                onClick={handleSaveProjectFile}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-blue-500" /> Save Project
              </button>
              <button
                onClick={handleSaveProjectAs}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 opacity-70" /> Save Project As...
              </button>
              <button
                onClick={(e) => handleOpenProjectFile(e as any)}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <FileUp className="w-3.5 h-3.5 text-blue-500" /> Open Project File
              </button>
              <button
                onClick={() => { setShowRecentModal(true); setShowFileMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-indigo-400" /> Open Recovered Projects
              </button>
              <button
                onClick={() => { setShowExportModal(true); setShowFileMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export Video
              </button>
              <div className="border-t my-1" style={{ borderColor: 'var(--theme-border)' }} />
              <button
                onClick={handleCloseProject}
                className="w-full px-3 py-1.5 text-xs text-left text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Close Project (Home)
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative dropdown-container">
          <button
            onClick={() => { 
              setShowEditMenu(!showEditMenu); 
              setShowFileMenu(false); 
              setShowViewMenu(false); 
              setShowLayoutMenu(false);
              setShowHelpMenuDropdown(false);
            }}
            className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-500 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 transition-colors font-medium"
          >
            Edit <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showEditMenu && (
            <div 
              className="absolute top-full left-0 mt-1.5 w-52 rounded-lg shadow-xl z-50 py-1.5 border animate-in fade-in zoom-in-95 duration-100"
              style={{
                backgroundColor: 'var(--theme-bg-card)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <button
                onClick={() => { undo(); setShowEditMenu(false); }}
                disabled={!canUndo}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between disabled:opacity-40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Undo2 className="w-3.5 h-3.5" /> Undo
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+Z</span>
              </button>
              <button
                onClick={() => { redo(); setShowEditMenu(false); }}
                disabled={!canRedo}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between disabled:opacity-40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Redo2 className="w-3.5 h-3.5" /> Redo
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+Y</span>
              </button>
              <div className="border-t my-1" style={{ borderColor: 'var(--theme-border)' }} />
              <button
                onClick={() => { cutClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5" /> Cut
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+X</span>
              </button>
              <button
                onClick={() => { copyClip('whole'); toast.success('Clip copied'); setShowEditMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Copy
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+C</span>
              </button>
              <button
                onClick={() => { copyClip('style'); toast.success('Style copied'); setShowEditMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-indigo-400 hover:bg-indigo-500/10 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" /> Copy Style
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+Alt+C</span>
              </button>
              <button
                onClick={() => { pasteClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" /> Paste
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+V</span>
              </button>
              {clipboardData?.clips?.length > 0 && (
                <button
                  onClick={() => {
                    const clipType = clipboardData.type;
                    const pasteType = clipType === 'style-with-position' ? 'style-with-position' : (clipType === 'style-only' ? 'style-only' : 'style');
                    pasteClip(pasteType as any);
                    toast.success('Style pasted');
                    setShowEditMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-indigo-400 hover:bg-indigo-500/10 flex items-center justify-between transition-colors font-medium"
                >
                  <div className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5" /> Paste Style
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Ctrl+Alt+V</span>
                </button>
              )}
              <button
                onClick={() => { duplicateClip(); setShowEditMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Duplicate
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+D</span>
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative dropdown-container">
          <button
            onClick={() => { 
              setShowViewMenu(!showViewMenu); 
              setShowFileMenu(false); 
              setShowEditMenu(false); 
              setShowLayoutMenu(false);
              setShowHelpMenuDropdown(false);
            }}
            className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-500 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 transition-colors font-medium"
          >
            View <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showViewMenu && (
            <div 
              className="absolute top-full left-0 mt-1.5 w-44 rounded-lg shadow-xl z-50 py-1.5 border animate-in fade-in zoom-in-95 duration-100"
              style={{
                backgroundColor: 'var(--theme-bg-card)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <button
                onClick={() => { useEditorStore.getState().zoomIn(); setShowViewMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between transition-colors"
              >
                <span>Zoom In</span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+=</span>
              </button>
              <button
                onClick={() => { useEditorStore.getState().zoomOut(); setShowViewMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-between transition-colors"
              >
                <span>Zoom Out</span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+-</span>
              </button>
              <div className="border-t my-1" style={{ borderColor: 'var(--theme-border)' }} />
              <button
                onClick={handleZoomToFit}
                className="w-full px-3 py-1.5 text-xs text-left text-blue-500 hover:bg-blue-500/10 flex items-center justify-between transition-colors font-medium"
              >
                <span>Zoom to Fit</span>
                <span className="text-[10px] text-slate-400 font-mono">Shift+Z</span>
              </button>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative dropdown-container">
          <button
            onClick={() => {
              setShowHelpMenuDropdown(!showHelpMenuDropdown);
              setShowFileMenu(false);
              setShowEditMenu(false);
              setShowViewMenu(false);
              setShowLayoutMenu(false);
            }}
            className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-500 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 transition-colors font-medium"
          >
            Help <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showHelpMenuDropdown && (
            <div 
              className="absolute top-full left-0 mt-1.5 w-48 rounded-lg shadow-xl z-50 py-1.5 border animate-in fade-in zoom-in-95 duration-100"
              style={{
                backgroundColor: 'var(--theme-bg-card)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <button
                onClick={() => { setShowHelpMenu(true, 'shortcuts'); setShowHelpMenuDropdown(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Keyboard Shortcuts
              </button>
              <button
                onClick={() => { setShowHelpMenu(true, 'docs'); setShowHelpMenuDropdown(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Documentation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions & Theme Toggle */}
      <div className="flex items-center gap-2">
        {clipboardData && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs rounded-full">
            <span className="font-medium text-[11px]">
              📋 {clipboardData.clips.length} {clipboardData.type === 'clip' ? 'Media' : clipboardData.type === 'style' ? 'Style' : 'Clip'}
            </span>
            <button 
              onClick={clearClipboard} 
              className="p-0.5 hover:bg-blue-500/20 rounded-full transition-colors"
              title="Clear Clipboard"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        {/* AI Sync Button */}
        <button
          onClick={() => useEditorStore.getState().setShowAiSpeedSyncModal(true)}
          title="AI Sync (Sync Video Speed Frames with TTS Voiceover)"
          className="px-2.5 py-1.5 text-xs rounded-md border flex items-center gap-1.5 font-medium transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            borderColor: 'var(--theme-border)',
          }}
        >
          <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">AI Sync</span>
        </button>

        {/* Scopes Button */}
        <button
          onClick={() => setScopeSettings({ 
            ...scopeSettings, 
            enabled: !scopeSettings.enabled 
          })}
          title={scopeSettings.enabled ? "Hide Scopes" : "Show Scopes"}
          className={`px-2.5 py-1.5 text-xs rounded-md border flex items-center gap-1.5 font-medium transition-all ${
            scopeSettings.enabled 
              ? 'bg-blue-500/15 text-blue-500 border-blue-500/40 shadow-sm shadow-blue-500/10' 
              : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            borderColor: scopeSettings.enabled ? undefined : 'var(--theme-border)',
            color: scopeSettings.enabled ? undefined : 'var(--theme-text-muted)',
          }}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Scopes</span>
        </button>

        {/* AI Copilot Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('toggle-copilot', { detail: {} }));
          }}
          title="AI Copilot (Ctrl+/)"
          className="btn-ai-gradient px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
          <span>AI Copilot</span>
        </button>

        {/* Teleprompter Button */}
        <button
          onClick={() => setShowTeleprompter(true)}
          title="Teleprompter"
          className="px-2.5 py-1.5 text-xs rounded-md border flex items-center gap-1.5 font-medium transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-muted)',
          }}
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Teleprompter</span>
        </button>

        {/* Export Button */}
        <button
          onClick={() => setShowExportModal(true)}
          className="btn-export-gradient px-3.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Theme Toggle (Dark / Light) */}
        <button
          onClick={toggleTheme}
          title={currentTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-1.5 rounded-md border text-slate-500 dark:text-slate-300 hover:text-blue-500 hover:border-blue-500/40 transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {currentTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          title="Settings"
          className="p-1.5 rounded-md border text-slate-500 dark:text-slate-300 hover:text-blue-500 hover:border-blue-500/40 transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-500/20 cursor-pointer hover:scale-105 transition-transform">
          <User className="w-3.5 h-3.5" />
        </div>
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
    </header>
  );
}
