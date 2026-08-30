// ─────────────────────────────────────────────────────────────────────────────
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobileTopBar.tsx
//   src/mobile/components/MobileToolRail.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { 
  X,
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
  ChevronDown,
  Clapperboard,
  Layout,
  Type,
  ZoomIn,
  MonitorPlay,
  Link,
  Activity,
  Sparkles,
  Settings,
  Search,
  Command,
  Film,
  Music,
  Image as ImageIcon,
  Layers,
  Video,
  Mic,
  Wand2,
  Globe,
  Clock,
  HardDrive,
  Share2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { EditorTool } from '@/types';
import { useState, useRef, useCallback, useEffect } from 'react';
import { probeFile } from '@/utils/mediaProbe';
import { saveProjectAs, saveProjectToHandle, openProjectFile, serializeProjectData, loadProjectData } from '@/utils/fileSystemAccess';
import { setActiveProject } from '@/utils/projectPersistence';
import { RecentProjectsModal } from './RecentProjectsModal';
import { toast } from 'sonner';

export function TopToolbar() {
  const {
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

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
    if (!showFileMenu && !showEditMenu && !showViewMenu && !showLayoutMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('#top-toolbar-root') && !target.closest('.toolbar-dropdown')) {
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
    <div id="top-toolbar-root" className="h-[60px] bg-white/95 dark:bg-[#0f1219]/95 backdrop-blur-xl border-b border-slate-200 dark:border-[#1e242f] flex items-center px-4 select-none z-50 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
      {/* Left: Brand + Workspace */}
      <div className="flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Clapperboard className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">ProCut</span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-wider uppercase">Studio</span>
          </div>
        </div>

        <div className="w-px h-6 bg-slate-200 dark:bg-[#1e242f] mx-1" />

        {/* Workspace Switcher - Professional Pill */}
        <div className="relative">
          <button
            onClick={() => { setShowLayoutMenu(!showLayoutMenu); setShowFileMenu(false); setShowEditMenu(false); setShowViewMenu(false); }}
            className="h-8 px-3.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Layout className="w-3.5 h-3.5" />
            {workspaceLayout?.preset || 'Editing'}
            <ChevronDown className={`w-3 h-3 transition-transform ${showLayoutMenu ? 'rotate-180' : ''}`} />
          </button>
          {showLayoutMenu && (
            <div className="toolbar-dropdown absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#151a23] border border-slate-200 dark:border-[#1e242f] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1.5 animate-scaleIn overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Workspaces</div>
              {[
                { id: 'Editing', label: 'Editing', icon: Film, desc: 'Standard editing' },
                { id: 'Color', label: 'Color', icon: Palette, desc: 'Color grading' },
                { id: 'Audio', label: 'Audio', icon: Music, desc: 'Audio mixing' },
                { id: 'Generative', label: 'Generative', icon: Sparkles, desc: 'AI creation' },
              ].map((preset) => {
                const Icon = preset.icon;
                const isActive = workspaceLayout?.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      if (preset.id === 'Editing') setWorkspaceLayout({ preset: 'Editing', leftWidth: 320, rightWidth: 360, timelineHeight: 320 });
                      if (preset.id === 'Color') setWorkspaceLayout({ preset: 'Color', leftWidth: 260, rightWidth: 420, timelineHeight: 320 });
                      if (preset.id === 'Audio') setWorkspaceLayout({ preset: 'Audio', leftWidth: 280, rightWidth: 360, timelineHeight: 280 });
                      if (preset.id === 'Generative') setWorkspaceLayout({ preset: 'Generative', leftWidth: 280, rightWidth: 0, timelineHeight: 280 });
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'hover:bg-slate-50 dark:hover:bg-[#1e242f] text-slate-700 dark:text-slate-300'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1e242f] text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{preset.desc}</div>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowFileMenu(!showFileMenu); setShowEditMenu(false); setShowViewMenu(false); setShowLayoutMenu(false); }}
            className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${showFileMenu ? 'bg-slate-100 dark:bg-[#1e242f] text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1a1f2b]'}`}
          >
            File <ChevronDown className={`w-3 h-3 transition-transform ${showFileMenu ? 'rotate-180' : ''}`} />
          </button>
          {showFileMenu && (
            <div className="toolbar-dropdown absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#151a23] border border-slate-200 dark:border-[#1e242f] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1.5 animate-scaleIn overflow-hidden">
              <div className="px-3 pb-1">
                <button
                  onClick={() => { fileInputRef.current?.click(); }}
                  className="w-full h-9 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2 hover:shadow-md transition-all"
                >
                  <FolderOpen className="w-4 h-4" /> Import Media
                  <span className="ml-auto text-[10px] opacity-60">Ctrl+I</span>
                </button>
              </div>
              <div className="h-px bg-slate-100 dark:bg-[#1e242f] my-1.5" />
              <button onClick={handleSaveProjectFile} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 transition-colors text-slate-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center"><Save className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" /></div>
                <div className="flex-1"><div className="font-medium">Save Project</div><div className="text-[10px] text-slate-500">Save current work</div></div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+S</span>
              </button>
              <button onClick={handleSaveProjectAs} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 transition-colors text-slate-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1e242f] flex items-center justify-center"><HardDrive className="w-3.5 h-3.5" /></div>
                <div className="flex-1"><div className="font-medium">Save As…</div><div className="text-[10px] text-slate-500">Create copy</div></div>
              </button>
              <button onClick={(e) => handleOpenProjectFile(e as any)} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 transition-colors text-slate-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center"><FileUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /></div>
                <div className="flex-1"><div className="font-medium">Open Project</div><div className="text-[10px] text-slate-500">Load .procut file</div></div>
              </button>
              <button onClick={() => { setShowRecentModal(true); setShowFileMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 transition-colors text-slate-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /></div>
                <div className="flex-1"><div className="font-medium">Recent Projects</div><div className="text-[10px] text-slate-500">Recover autosaves</div></div>
              </button>
              <div className="h-px bg-slate-100 dark:bg-[#1e242f] my-1.5" />
              <button onClick={() => { setShowExportModal(true); setShowFileMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 transition-colors text-slate-700 dark:text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center"><Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /></div>
                <div className="flex-1"><div className="font-medium">Export Video</div><div className="text-[10px] text-slate-500">Render final output</div></div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+E</span>
              </button>
              <div className="h-px bg-slate-100 dark:bg-[#1e242f] my-1.5" />
              <button onClick={handleCloseProject} className="w-full px-3 py-2 text-xs text-left hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2.5 transition-colors text-red-600 dark:text-red-400">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/15 flex items-center justify-center"><RotateCcw className="w-3.5 h-3.5" /></div>
                <div className="flex-1"><div className="font-medium">Close Project</div><div className="text-[10px] opacity-70">Back to welcome</div></div>
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowEditMenu(!showEditMenu); setShowFileMenu(false); setShowViewMenu(false); setShowLayoutMenu(false); }}
            className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${showEditMenu ? 'bg-slate-100 dark:bg-[#1e242f] text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1a1f2b]'}`}
          >
            Edit <ChevronDown className={`w-3 h-3 transition-transform ${showEditMenu ? 'rotate-180' : ''}`} />
          </button>
          {showEditMenu && (
            <div className="toolbar-dropdown absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#151a23] border border-slate-200 dark:border-[#1e242f] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1.5 animate-scaleIn overflow-hidden">
              <div className="flex items-center gap-1 px-2 pb-1">
                <button onClick={() => { undo(); setShowEditMenu(false); }} disabled={!canUndo} className="flex-1 h-8 rounded-lg bg-slate-100 dark:bg-[#1e242f] hover:bg-slate-200 dark:hover:bg-[#252d3b] disabled:opacity-30 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors">
                  <Undo2 className="w-3.5 h-3.5" /> Undo
                </button>
                <button onClick={() => { redo(); setShowEditMenu(false); }} disabled={!canRedo} className="flex-1 h-8 rounded-lg bg-slate-100 dark:bg-[#1e242f] hover:bg-slate-200 dark:hover:bg-[#252d3b] disabled:opacity-30 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors">
                  <Redo2 className="w-3.5 h-3.5" /> Redo
                </button>
              </div>
              <div className="h-px bg-slate-100 dark:bg-[#1e242f] my-1.5" />
              <button onClick={() => { cutClip(); setShowEditMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <Scissors className="w-4 h-4 text-slate-400" /> Cut <span className="ml-auto text-[10px] font-mono text-slate-400">Ctrl+X</span>
              </button>
              <button onClick={() => { copyClip('whole'); toast.success('Clip copied'); setShowEditMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <Plus className="w-4 h-4 text-slate-400" /> Copy <span className="ml-auto text-[10px] font-mono text-slate-400">Ctrl+C</span>
              </button>
              <button onClick={() => { copyClip('style'); toast.success('Style copied'); setShowEditMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-violet-50 dark:hover:bg-violet-500/10 flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
                <Palette className="w-4 h-4" /> Copy Style <span className="ml-auto text-[10px] font-mono text-slate-400">Ctrl+Alt+C</span>
              </button>
              <button onClick={() => { pasteClip(); setShowEditMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <FolderOpen className="w-4 h-4 text-slate-400" /> Paste <span className="ml-auto text-[10px] font-mono text-slate-400">Ctrl+V</span>
              </button>
              {clipboardData?.clips?.length > 0 && (
                <button onClick={() => { const clipType = clipboardData.type; const pasteType = clipType === 'style-with-position' ? 'style-with-position' : (clipType === 'style-only' ? 'style-only' : 'style'); pasteClip(pasteType as any); toast.success('Style pasted'); setShowEditMenu(false); }} className="w-full px-3 py-2 text-xs text-left bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 flex items-center gap-2.5 text-violet-700 dark:text-violet-300 font-medium">
                  <Palette className="w-4 h-4" /> Paste Style <span className="ml-auto text-[10px] font-mono">Ctrl+Alt+V</span>
                </button>
              )}
              <button onClick={() => { duplicateClip(); setShowEditMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <Layers className="w-4 h-4 text-slate-400" /> Duplicate <span className="ml-auto text-[10px] font-mono text-slate-400">Ctrl+D</span>
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowViewMenu(!showViewMenu); setShowFileMenu(false); setShowEditMenu(false); setShowLayoutMenu(false); }}
            className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${showViewMenu ? 'bg-slate-100 dark:bg-[#1e242f] text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1a1f2b]'}`}
          >
            View <ChevronDown className={`w-3 h-3 transition-transform ${showViewMenu ? 'rotate-180' : ''}`} />
          </button>
          {showViewMenu && (
            <div className="toolbar-dropdown absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#151a23] border border-slate-200 dark:border-[#1e242f] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1.5 animate-scaleIn overflow-hidden">
              <button onClick={() => { useEditorStore.getState().zoomIn(); setShowViewMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <ZoomIn className="w-4 h-4" /> Zoom In <span className="ml-auto text-[10px] font-mono text-slate-400">+</span>
              </button>
              <button onClick={() => { useEditorStore.getState().zoomOut(); setShowViewMenu(false); }} className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-[#1e242f] flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <ZoomIn className="w-4 h-4 rotate-180" /> Zoom Out <span className="ml-auto text-[10px] font-mono text-slate-400">-</span>
              </button>
              <div className="h-px bg-slate-100 dark:bg-[#1e242f] my-1" />
              <button onClick={handleZoomToFit} className="w-full px-3 py-2 text-xs text-left hover:bg-amber-50 dark:hover:bg-amber-500/10 flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center"><ZoomIn className="w-3.5 h-3.5" /></div>
                <div><div className="font-medium">Zoom to Fit</div><div className="text-[10px] opacity-70">Fit timeline</div></div>
              </button>
            </div>
          )}
        </div>

        {/* Command Search Hint */}
        <div className="hidden xl:flex items-center gap-2 ml-2 pl-3 border-l border-slate-200 dark:border-[#1e242f]">
          <div className="h-7 px-2.5 rounded-full bg-slate-100 dark:bg-[#151a23] border border-slate-200 dark:border-[#1e242f] flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Search className="w-3 h-3" />
            <span>Search</span>
            <div className="flex items-center gap-0.5 ml-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-[#1e242f] border border-slate-200 dark:border-[#2a303c] text-[10px] font-mono">⌘</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-[#1e242f] border border-slate-200 dark:border-[#2a303c] text-[10px] font-mono">K</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Spacer */}
      <div className="flex-1" />

      {/* Right: Actions - Professional Grouped */}
      <div className="flex items-center gap-1.5">
        {clipboardData && (
          <div className="hidden lg:flex items-center gap-2 px-3 h-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs rounded-full font-medium animate-fadeIn">
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
              <span className="text-[10px] text-white">📋</span>
            </div>
            {clipboardData.clips.length} copied
            <button onClick={clearClipboard} className="w-5 h-5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-500/20 flex items-center justify-center transition-colors" title="Clear">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-[#151a23] border border-slate-200/60 dark:border-[#1e242f]">
          <button onClick={() => syncSelectedClips()} title="Sync Audio/Video" className="w-8 h-8 rounded-full bg-white dark:bg-[#1e242f] border border-slate-200 dark:border-[#2a303c] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow flex items-center justify-center transition-all">
            <Link className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScopeSettings({ ...scopeSettings, enabled: !scopeSettings.enabled })}
            title={scopeSettings.enabled ? "Hide Scopes" : "Show Scopes"}
            className={`w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-all ${
              scopeSettings.enabled ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/20' : 'bg-white dark:bg-[#1e242f] border-slate-200 dark:border-[#2a303c] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
          </button>
          <button onClick={() => setShowTeleprompter(true)} title="Teleprompter" className="w-8 h-8 rounded-full bg-white dark:bg-[#1e242f] border border-slate-200 dark:border-[#2a303c] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow flex items-center justify-center transition-all">
            <MonitorPlay className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('toggle-copilot', { detail: {} })); }}
          title="AI Copilot (Ctrl+/)"
          className="h-8 px-3.5 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI</span>
        </button>

        <button onClick={() => setShowExportModal(true)} className="h-8 px-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-slate-900/10 dark:shadow-white/10 hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Download className="w-3.5 h-3.5" /> Export
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-[#1e242f] mx-1" />

        <button onClick={() => setShowSettingsModal(true)} title="Settings" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#151a23] border border-slate-200 dark:border-[#1e242f] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#1e242f] flex items-center justify-center transition-all shadow-sm hover:shadow">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={handleFileImport} className="hidden" />
      <input ref={projectFileInputRef} type="file" accept=".procut,.json" onChange={handleOpenProjectFile} className="hidden" />

      <RecentProjectsModal isOpen={showRecentModal} onClose={() => setShowRecentModal(false)} onSelect={() => {}} />
    </div>
  );
}
