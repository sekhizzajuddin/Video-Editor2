// ─────────────────────────────────────────────────────────────────────────────
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/App.tsx
//   src/mobile/components/MobileTopBar.tsx
//   src/mobile/components/MobileToolRail.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useRef, useState, Suspense } from 'react';
import { 
  Music, MousePointer2, ArrowRightToLine, ArrowLeftToLine, ArrowLeftRight, 
  Timer, Scissors, Hand, ZoomIn, Undo2, Redo2, Sparkles, SlidersHorizontal, 
  MoveHorizontal, Layers, Film, Type, Wand2, Settings, Download, LayoutGrid,
  MonitorPlay, Link2, Activity, Palette, Video, Mic2, Image as ImageIcon
} from 'lucide-react';
import type { EditorTool } from '@/types';
import { TopToolbar } from '@/components/TopToolbar';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HelpTooltipManager } from '@/components/HelpTooltipManager';
import { FileHandlerInitializer } from '@/components/FileHandlerInitializer';
import { hydrateKeysFromServer } from '@/utils/apiKeyManager';
import { useDeviceType } from '@/hooks/useDeviceType';

const MobileApp = React.lazy(() => import('@/mobile/App').then(m => ({ default: m.MobileApp })));
const MediaPanel = React.lazy(() => import('@/components/MediaPanel').then(m => ({ default: m.MediaPanel })));
const ScopesPanel = React.lazy(() => import('@/components/ScopesPanel').then(m => ({ default: m.ScopesPanel })));
const PropertiesPanel = React.lazy(() => import('@/components/PropertiesPanel').then(m => ({ default: m.PropertiesPanel })));
const Timeline = React.lazy(() => import('@/components/Timeline').then(m => ({ default: m.Timeline })));
const AudioMixer = React.lazy(() => import('@/components/AudioMixer').then(m => ({ default: m.AudioMixer })));
const ExportModal = React.lazy(() => import('@/components/ExportModal').then(m => ({ default: m.ExportModal })));
const SettingsModal = React.lazy(() => import('@/components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const TeleprompterModal = React.lazy(() => import('@/components/TeleprompterModal').then(m => ({ default: m.TeleprompterModal })));
const WelcomeScreen = React.lazy(() => import('@/components/WelcomeScreen').then(m => ({ default: m.WelcomeScreen })));
const AiCopilot = React.lazy(() => import('@/components/AiCopilot').then(m => ({ default: m.AiCopilot })));
const AspectRatioConflictModal = React.lazy(() => import('@/components/AspectRatioConflictModal').then(m => ({ default: m.AspectRatioConflictModal })));
const HelpModal = React.lazy(() => import('@/components/HelpModal').then(m => ({ default: m.HelpModal })));
const GenerativeWorkspace = React.lazy(() => import('@/components/GenerativeWorkspace').then(m => ({ default: m.GenerativeWorkspace })));
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SHORTCUTS, getShortcutString } from '@/utils/keyboardShortcuts';
import { saveAutosaveToDB } from '@/utils/projectPersistence';
import { Toaster } from '@/components/ui/sonner';
import './App.css';

let lastShortcutsRef: Record<string, string> | null = null;
let lastInvertedMap: Record<string, string> = {};

function getActionForKey(pressed: string, customShortcuts: Record<string, string> | undefined): string | undefined {
  const currentShortcuts = customShortcuts || {};
  if (lastShortcutsRef !== currentShortcuts) {
    lastShortcutsRef = currentShortcuts;
    lastInvertedMap = {};
    for (const def of DEFAULT_SHORTCUTS) {
      const keyCombo = currentShortcuts[def.id] !== undefined ? currentShortcuts[def.id] : def.defaultKey;
      if (keyCombo) {
        lastInvertedMap[keyCombo.toLowerCase()] = def.id;
      }
    }
  }
  return lastInvertedMap[pressed.toLowerCase()];
}

function DesktopApp() {
  const {
    togglePlayback,
    activeTool,
    setActiveTool,
    selectedClipId,
    removeClip,
    splitClip,
    copyClip,
    pasteClip,
    cutClip,
    duplicateClip,
    liftClip,
    extractClip,
    undo,
    redo,
    zoomIn,
    zoomOut,
    history,
    historyIndex,
    tracks,
    selectClips,
    selectedTransitionClipId,
    removeTransition,
    removeSelectedKeyframeLines,
    settings,
    workspaceLayout,
    setWorkspaceLayout,
    updateSettings,
    showTeleprompter,
    setShowTeleprompter,
    showExportModal,
    showSettingsModal,
    projectId,
    selectedClipIds,
  } = useEditorStore(useShallow(s => ({
    showExportModal: s.showExportModal,
    showSettingsModal: s.showSettingsModal,
    togglePlayback: s.togglePlayback,
    activeTool: s.activeTool,
    setActiveTool: s.setActiveTool,
    selectedClipId: s.selectedClipId,
    removeClip: s.removeClip,
    splitClip: s.splitClip,
    copyClip: s.copyClip,
    pasteClip: s.pasteClip,
    cutClip: s.cutClip,
    duplicateClip: s.duplicateClip,
    undo: s.undo,
    redo: s.redo,
    zoomIn: s.zoomIn,
    zoomOut: s.zoomOut,
    history: s.history,
    historyIndex: s.historyIndex,
    tracks: s.tracks,
    selectClips: s.selectClips,
    selectedTransitionClipId: s.selectedTransitionClipId,
    removeTransition: s.removeTransition,
    removeSelectedKeyframeLines: s.removeSelectedKeyframeLines,
    liftClip: s.liftClip,
    extractClip: s.extractClip,
    settings: s.settings,
    workspaceLayout: s.workspaceLayout,
    setWorkspaceLayout: s.setWorkspaceLayout,
    updateSettings: s.updateSettings,
    showTeleprompter: s.showTeleprompter,
    setShowTeleprompter: s.setShowTeleprompter,
    projectId: s.projectId,
    selectedClipIds: s.selectedClipIds,
  })));

  const leftWidth = workspaceLayout.leftWidth;
  const rightWidth = workspaceLayout.rightWidth;
  const timelineHeight = workspaceLayout.timelineHeight;

  const setLeftWidth = (w: number | ((w: number) => number)) => {
    const newW = typeof w === 'function' ? w(leftWidth) : w;
    setWorkspaceLayout({ ...workspaceLayout, preset: 'Custom', leftWidth: newW });
  };
  const setRightWidth = (w: number | ((w: number) => number)) => {
    const newW = typeof w === 'function' ? w(rightWidth) : w;
    setWorkspaceLayout({ ...workspaceLayout, preset: 'Custom', rightWidth: newW });
  };
  const setTimelineHeight = (h: number | ((h: number) => number)) => {
    const newH = typeof h === 'function' ? h(timelineHeight) : h;
    setWorkspaceLayout({ ...workspaceLayout, preset: 'Custom', timelineHeight: newH });
  };
  const [bottomTab, setBottomTab] = useState<'timeline' | 'mixer'>('timeline');
  const [showCopilot, setShowCopilot] = useState(false);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const isDraggingTimeline = useRef(false);

  // Keyboard shortcuts - logic preserved exactly
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const pressed = getShortcutString(e);

      if (e.key === 'Tab') {
        const storeState = useEditorStore.getState();
        const currentId = storeState.selectedClipIds[0] || storeState.selectedClipId;
        if (currentId) {
          e.preventDefault();
          const allClips = storeState.tracks.flatMap(t => t.clips).sort((a, b) => a.startTime - b.startTime);
          const currentIndex = allClips.findIndex(c => c.id === currentId);
          if (currentIndex !== -1) {
            let nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
            if (nextIndex < 0) nextIndex = allClips.length - 1;
            if (nextIndex >= allClips.length) nextIndex = 0;
            const nextClip = allClips[nextIndex];
            storeState.selectClips([nextClip.id]);
            storeState.seek(nextClip.startTime);
          }
          return;
        }
      }

      if (!pressed) return;

      const currentSettings = useEditorStore.getState().settings;
      const customShortcuts = currentSettings.keyboardShortcuts;
      const actionId = getActionForKey(pressed, customShortcuts);

      if (!actionId) return;

      e.preventDefault();

      switch (actionId) {
        case 'play_pause':
          if (activeTool !== 'hand') {
            togglePlayback();
          }
          break;
        case 'tool_split':
          setActiveTool('split');
          break;
        case 'paste_clip':
          case 'paste_clip_whole':
            pasteClip('whole');
            break;
          case 'paste_clip_base':
            pasteClip('clip');
            break;
          case 'paste_clip_style':
            pasteClip('style');
            break;
        case 'tool_select':
          setActiveTool('select');
          break;
        case 'tool_hand':
          setActiveTool('hand');
          break;
        case 'redo':
        case 'redo_alt':
          redo();
          break;
        case 'undo':
          undo();
          break;
        case 'tool_zoom':
          setActiveTool('zoom');
          break;
        case 'zoom_timeline_in':
          zoomIn();
          break;
        case 'zoom_timeline_out':
          zoomOut();
          break;
        case 'toggle_snap':
          updateSettings({ snapEnabled: !currentSettings.snapEnabled });
          break;
        case 'delete_selected': {
          const storeState = useEditorStore.getState();
          if (storeState.selectedKeyframeLines.length > 0) {
            removeSelectedKeyframeLines();
          } else if (storeState.selectedClipIds.length > 0) {
            removeClip(storeState.selectedClipIds[0]);
          } else if (selectedClipId) {
            removeClip(selectedClipId);
          } else if (selectedTransitionClipId) {
            removeTransition(selectedTransitionClipId);
          } else if (storeState.activePipWindowId) {
            storeState.deletePipWindow(storeState.activePipWindowId);
          }
          break;
        }
        case 'tool_rate_stretch':
          setActiveTool('rateStretch');
          break;
        case 'tool_slip':
          setActiveTool('slip');
          break;
        case 'tool_slide':
          setActiveTool('slide');
          break;
        case 'select_all_clips_forward': {
          const selectedClip = findClipInTracks(tracks, selectedClipId, useEditorStore.getState().pipWindows);
          if (selectedClip) {
            const refTime = selectedClip.startTime;
            const matchingIds: string[] = [];
            for (const t of tracks) {
              for (const c of t.clips || []) {
                if (c.startTime >= refTime) matchingIds.push(c.id);
              }
            }
            selectClips(matchingIds);
          }
          break;
        }
        case 'select_all_clips_backward': {
          const selectedClip = findClipInTracks(tracks, selectedClipId, useEditorStore.getState().pipWindows);
          if (selectedClip) {
            const refTime = selectedClip.startTime;
            const matchingIds: string[] = [];
            for (const t of tracks) {
              for (const c of t.clips || []) {
                if (c.startTime <= refTime) matchingIds.push(c.id);
              }
            }
            selectClips(matchingIds);
          }
          break;
        }
        case 'tool_track_select':
          setActiveTool('trackSelect');
          break;
        case 'tool_track_select_backward':
          setActiveTool('trackSelectBackward');
          break;
        case 'tool_ripple':
          setActiveTool('ripple');
          break;
        case 'copy_clip':
          case 'copy_clip_whole':
            copyClip('whole');
            break;
          case 'copy_clip_base':
            copyClip('clip');
            break;
          case 'copy_clip_style':
            copyClip('style');
            break;
        case 'set_in_point':
          useEditorStore.getState().setInPoint(useEditorStore.getState().currentTime);
          break;
        case 'set_out_point':
          useEditorStore.getState().setOutPoint(useEditorStore.getState().currentTime);
          break;
        case 'add_marker':
          useEditorStore.getState().addMarker(useEditorStore.getState().currentTime);
          break;
        case 'seek_frame_left': {
          const t = useEditorStore.getState().currentTime;
          useEditorStore.getState().seek(Math.max(0, t - (1 / 30)));
          break;
        }
        case 'seek_frame_right': {
          const t = useEditorStore.getState().currentTime;
          useEditorStore.getState().seek(Math.min(useEditorStore.getState().totalDuration, t + (1 / 30)));
          break;
        }
        case 'seek_second_left': {
          const t = useEditorStore.getState().currentTime;
          useEditorStore.getState().seek(Math.max(0, t - 1.0));
          break;
        }
        case 'seek_second_right': {
          const t = useEditorStore.getState().currentTime;
          useEditorStore.getState().seek(Math.min(useEditorStore.getState().totalDuration, t + 1.0));
          break;
        }
        case 'split_clip': {
          const state = useEditorStore.getState();
          const t = state.currentTime;
          
          if (state.selectedClipIds && state.selectedClipIds.length > 0) {
            let splitted = false;
            state.selectedClipIds.forEach(id => {
              const c = findClipInTracks(tracks, id, state.pipWindows);
              if (c && t > c.startTime && t < c.startTime + c.duration) {
                splitClip(id, t);
                splitted = true;
              }
            });
            if (!splitted) {
              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Playhead is not over selected clip(s).", type: 'warning' }}));
            }
          } else if (state.selectedTrackId) {
            const track = tracks.find(tr => tr.id === state.selectedTrackId);
            if (track) {
              const clip = track.clips.find((c) => t > c.startTime && t < c.startTime + c.duration);
              if (clip) {
                splitClip(clip.id, t);
              } else {
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "No clip at playhead on selected track.", type: 'warning' }}));
              }
            }
          } else {
            console.warn("Select a clip or track to split.");
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Please select a clip or track to split first.", type: 'warning' }}));
          }
          break;
        }
        case 'lift_clip': {
          const state = useEditorStore.getState();
          const targetId = state.selectedClipIds[0] || state.selectedClipId;
          if (targetId) {
            liftClip(targetId);
          } else {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Select a clip first.', type: 'warning' }}));
          }
          break;
        }
        case 'extract_clip': {
          const state = useEditorStore.getState();
          const targetId = state.selectedClipIds[0] || state.selectedClipId;
          if (targetId) {
            extractClip(targetId);
          } else {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Select a clip first.', type: 'warning' }}));
          }
          break;
        }
        case 'replace_with_clip': {
          const state = useEditorStore.getState();
          const targetId = state.selectedClipIds[0] || state.selectedClipId;
          if (!targetId) {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Select a clip to replace first.', type: 'warning' }}));
            break;
          }
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*,audio/*,image/*';
          input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            try {
              const { probeFile } = await import('@/utils/mediaProbe');
              const mediaItem = await probeFile(file);
              state.addMedia(mediaItem, file);
              setTimeout(() => {
                useEditorStore.getState().replaceClipMedia(targetId, mediaItem.id);
              }, 100);
            } catch {
              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to import file.', type: 'error' }}));
            }
          };
          input.click();
          break;
        }
      }
    },
    [
      togglePlayback,
      activeTool,
      setActiveTool,
      selectedClipId,
      removeClip,
      splitClip,
      copyClip,
      pasteClip,
      duplicateClip,
      undo,
      redo,
      zoomIn,
      zoomOut,
      tracks,
      updateSettings,
      selectedTransitionClipId,
      removeTransition,
      removeSelectedKeyframeLines,
      cutClip,
      selectClips,
      selectedClipIds,
      liftClip,
      extractClip,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    import('@/utils/fontManager').then(({ restoreCustomFonts }) => {
      restoreCustomFonts().catch((err) => console.warn('Font restore failed:', err));
    });
  }, []);

  useEffect(() => {
    hydrateKeysFromServer().catch(() => {});
  }, []);

  useEffect(() => {
    const handleToggleCopilot = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail;
      if (detail && typeof detail.open === 'boolean') {
        setShowCopilot(detail.open);
      } else {
        setShowCopilot((prev) => !prev);
      }
    };
    const handleOpenCopilot = () => setShowCopilot(true);
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowCopilot((prev) => !prev);
      }
    };
    window.addEventListener('toggle-copilot', handleToggleCopilot);
    window.addEventListener('open-copilot', handleOpenCopilot);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('toggle-copilot', handleToggleCopilot);
      window.removeEventListener('open-copilot', handleOpenCopilot);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (!settings.autosave) return;
    const interval = setInterval(() => {
      const state = useEditorStore.getState();
      saveAutosaveToDB({
        tracks: state.tracks,
        mediaLibrary: state.mediaLibrary,
        currentTime: state.currentTime,
        aspectRatio: state.aspectRatio,
      }, Date.now())
        .then(() => console.log('Periodic versioned autosave saved to DB'))
        .catch(err => console.error('Failed to create periodic autosave:', err));
    }, 120000);
    return () => clearInterval(interval);
  }, [settings.autosave]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft.current) {
        setLeftWidth(() => Math.max(240, Math.min(480, e.clientX - 64)));
      }
      if (isDraggingRight.current) {
        const windowWidth = window.innerWidth;
        setRightWidth(() => Math.max(280, Math.min(480, windowWidth - e.clientX)));
      }
      if (isDraggingTimeline.current) {
        const windowHeight = window.innerHeight;
        setTimelineHeight(() => Math.max(220, Math.min(560, windowHeight - e.clientY)));
      }
    };

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      isDraggingTimeline.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const tools: { id: EditorTool; icon: any; label: string; shortcut: string; group: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V', group: 'selection' },
    { id: 'trackSelect', icon: ArrowRightToLine, label: 'Track Select Forward', shortcut: 'A', group: 'selection' },
    { id: 'trackSelectBackward', icon: ArrowLeftToLine, label: 'Track Select Backward', shortcut: 'Shift+A', group: 'selection' },
    { id: 'ripple', icon: ArrowLeftRight, label: 'Ripple Edit', shortcut: 'B', group: 'trim' },
    { id: 'rateStretch', icon: Timer, label: 'Rate Stretch', shortcut: 'R', group: 'trim' },
    { id: 'slip', icon: SlidersHorizontal, label: 'Slip', shortcut: 'Y', group: 'trim' },
    { id: 'slide', icon: MoveHorizontal, label: 'Slide', shortcut: 'U', group: 'trim' },
    { id: 'split', icon: Scissors, label: 'Split', shortcut: 'C', group: 'edit' },
    { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H', group: 'view' },
    { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z', group: 'view' },
  ];

  const handleSplit = () => {
    const state = useEditorStore.getState();
    const t = state.currentTime;
    if (state.selectedClipIds && state.selectedClipIds.length > 0) {
      let splitted = false;
      state.selectedClipIds.forEach(id => {
        const c = findClipInTracks(tracks, id, state.pipWindows);
        if (c && t > c.startTime && t < c.startTime + c.duration) {
          splitClip(id, t);
          splitted = true;
        }
      });
      if (!splitted) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Playhead is not over selected clip(s).", type: 'warning' }}));
      }
    } else if (state.selectedTrackId) {
      const track = tracks.find(tr => tr.id === state.selectedTrackId);
      if (track) {
        const clip = track.clips.find((c) => t > c.startTime && t < c.startTime + c.duration);
        if (clip) {
          splitClip(clip.id, t);
        } else {
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "No clip at playhead on selected track.", type: 'warning' }}));
        }
      }
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Please select a clip or track to split first.", type: 'warning' }}));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0e14] text-slate-900 dark:text-slate-100 overflow-hidden select-none font-['Inter']">
      {/* Subtle mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] pro-gradient-mesh" />
      
      {projectId === 'default' && (
        <Suspense fallback={null}>
          <WelcomeScreen />
        </Suspense>
      )}
      
      {/* Top Toolbar - Professional */}
      <TopToolbar />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Tool Rail - Professional Vertical Toolbar */}
        <div className="w-[64px] bg-white dark:bg-[#0f1219] border-r border-slate-200 dark:border-[#1e242f] flex flex-col items-center py-3 gap-1 shrink-0 z-20 shadow-[2px_0_8px_rgba(0,0,0,0.04)] dark:shadow-[2px_0_16px_rgba(0,0,0,0.3)]">
          {/* Logo / Brand */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
            <Film className="w-5 h-5 text-white" />
          </div>

          <div className="w-8 h-px bg-slate-200 dark:bg-[#1e242f] mb-2" />

          {/* Selection Tools Group */}
          <div className="flex flex-col gap-1 p-1 rounded-xl bg-slate-50 dark:bg-[#151a23] border border-slate-100 dark:border-[#1e242f]">
            {tools.filter(t => t.group === 'selection').map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={`${tool.label} (${tool.shortcut})`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 group relative ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-slate-900/10 dark:shadow-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#1e242f] hover:shadow-sm'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 dark:bg-[#1a1f2b] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-50 shadow-xl border border-slate-800 dark:border-slate-700 translate-x-[-4px] group-hover:translate-x-0">
                    {tool.label} <span className="text-slate-400 ml-1.5 text-[10px]">{tool.shortcut}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Trim Tools Group */}
          <div className="flex flex-col gap-1 p-1 rounded-xl bg-slate-50 dark:bg-[#151a23] border border-slate-100 dark:border-[#1e242f] mt-2">
            {tools.filter(t => t.group === 'trim').map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={`${tool.label} (${tool.shortcut})`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 group relative ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#1e242f]'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-50 shadow-xl">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Edit Tools */}
          <div className="flex flex-col gap-1 mt-2">
            <button
              onClick={handleSplit}
              title="Split Clip at Playhead (C)"
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 transition-all shadow-sm hover:shadow group relative"
            >
              <Scissors className="w-[18px] h-[18px]" />
              <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-50 shadow-xl">
                Split at Playhead (C)
              </span>
            </button>
          </div>

          <div className="w-8 h-px bg-slate-200 dark:bg-[#1e242f] my-2" />

          {/* View Tools */}
          <div className="flex flex-col gap-1">
            {tools.filter(t => t.group === 'view').map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={`${tool.label} (${tool.shortcut})`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all group relative ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1f2b]'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-50 shadow-xl">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Bottom Actions */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1f2b] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Undo2 className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1f2b] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Redo2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Media Panel (Left) - Light Theme */}
        <div
          className="shrink-0 overflow-hidden bg-white dark:bg-[#0f1219] border-r border-slate-200 dark:border-[#1e242f] shadow-[1px_0_12px_rgba(0,0,0,0.04)] dark:shadow-[1px_0_24px_rgba(0,0,0,0.3)] z-10 flex flex-col"
          style={{ width: leftWidth }}
        >
          <Suspense fallback={<div className="w-full h-full bg-white dark:bg-[#0f1219] animate-pulse" />}>
            <MediaPanel />
          </Suspense>
        </div>

        {/* Left Resize Handle */}
        <div
          className="w-[5px] hover:w-[5px] bg-transparent hover:bg-amber-500/50 cursor-col-resize shrink-0 transition-all z-20 group flex items-center justify-center"
          onMouseDown={() => { 
            isDraggingLeft.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        >
          <div className="w-[1px] h-full bg-slate-200 dark:bg-[#1e242f] group-hover:bg-amber-500 transition-colors" />
        </div>

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#f1f5f9] dark:bg-[#0b0e14] p-2.5 gap-2.5">
          {/* Preview Canvas / Generative Workspace - Dark Canvas with Light Surround */}
          <div className="flex-1 overflow-hidden relative rounded-[16px] bg-[#0a0a0f] shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)] border border-slate-900 dark:border-[#1a1f2b]">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 rounded-[16px] pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] z-10" />
            
            {workspaceLayout?.preset === 'Generative' ? (
              <Suspense fallback={<div className="w-full h-full bg-[#0a0a0f] flex items-center justify-center text-slate-400 text-sm">Loading Generative Workspace…</div>}>
                <GenerativeWorkspace />
              </Suspense>
            ) : (
              <>
                <PreviewCanvas />
                <Suspense fallback={null}>
                  <ScopesPanel />
                </Suspense>
              </>
            )}
          </div>

          {/* Timeline Resize Handle */}
          <div
            className="h-[5px] hover:h-[5px] bg-transparent hover:bg-amber-500/50 cursor-row-resize shrink-0 transition-all z-20 group flex items-center justify-center rounded-full"
            onMouseDown={() => { 
              isDraggingTimeline.current = true;
              document.body.style.cursor = 'row-resize';
              document.body.style.userSelect = 'none';
            }}
          >
            <div className="w-full h-[1px] bg-slate-200 dark:bg-[#1e242f] group-hover:bg-amber-500 transition-colors" />
          </div>

          {/* Timeline / Audio Mixer Container - Light + Dark Hybrid */}
          <div 
            style={{ height: timelineHeight }} 
            className="flex flex-col bg-white dark:bg-[#0f1219] rounded-[12px] overflow-hidden shrink-0 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-[#1e242f]"
          >
            {/* Header Tabs - Professional */}
            <div className="h-[44px] flex items-center justify-between px-4 bg-slate-50/80 dark:bg-[#151a23] border-b border-slate-200 dark:border-[#1e242f] shrink-0 select-none backdrop-blur-sm">
              <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-[#0f1219] border border-slate-200/60 dark:border-[#1e242f]">
                <button
                  onClick={() => setBottomTab('timeline')}
                  className={`px-4 py-1.5 text-[12px] rounded-full transition-all font-semibold tracking-wide ${
                    bottomTab === 'timeline'
                      ? 'bg-white dark:bg-[#1e242f] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setBottomTab('mixer')}
                  className={`px-4 py-1.5 text-[12px] rounded-full transition-all font-semibold tracking-wide flex items-center gap-1.5 ${
                    bottomTab === 'mixer'
                      ? 'bg-white dark:bg-[#1e242f] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" /> Mixer
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Quick Stats */}
                <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    {tracks.length} tracks
                  </span>
                  <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                  <span>{tracks.reduce((acc, t) => acc + t.clips.length, 0)} clips</span>
                </div>

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden lg:block" />

                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-[#1a1f2b] border border-slate-200 dark:border-[#252d3b] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-[#1a1f2b] border border-slate-200 dark:border-[#252d3b] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-[#fcfcfd] dark:bg-[#0a0d12]">
              {bottomTab === 'timeline' ? (
                <ErrorBoundary fallback={<div className="flex h-full items-center justify-center text-red-500 bg-slate-50 dark:bg-[#0a0d12] font-medium p-8 text-center">Timeline crashed. Please refresh the page.</div>}>
                  <Suspense fallback={<div className="w-full h-full bg-slate-50 dark:bg-[#0a0d12] animate-pulse" />}>
                    <Timeline />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <Suspense fallback={null}>
                  <AudioMixer />
                </Suspense>
              )}
            </div>
          </div>
        </div>

        {/* Right Resize Handle + Properties Panel (hidden in Generative workspace) */}
        {workspaceLayout?.preset !== 'Generative' && (
          <>
            <div
              className="w-[5px] bg-transparent hover:bg-amber-500/50 cursor-col-resize shrink-0 transition-all z-20 group flex items-center justify-center"
              onMouseDown={() => { 
                isDraggingRight.current = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
            >
              <div className="w-[1px] h-full bg-slate-200 dark:bg-[#1e242f] group-hover:bg-amber-500 transition-colors" />
            </div>

            {/* Properties Panel (Right) - Light Theme for contrast */}
            <div
              className="shrink-0 overflow-hidden bg-white dark:bg-[#0f1219] border-l border-slate-200 dark:border-[#1e242f] shadow-[-1px_0_12px_rgba(0,0,0,0.04)] dark:shadow-[-1px_0_24px_rgba(0,0,0,0.3)] z-10 flex flex-col"
              style={{ width: rightWidth }}
            >
              <Suspense fallback={<div className="w-full h-full bg-white dark:bg-[#0f1219] animate-pulse" />}>
                <PropertiesPanel />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* Modals & Global Handlers */}
      <FileHandlerInitializer />
      <Suspense fallback={null}>
        <AspectRatioConflictModal />
      </Suspense>
      {showExportModal && (
        <Suspense fallback={null}>
          <ExportModal />
        </Suspense>
      )}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      {showTeleprompter && (
        <Suspense fallback={null}>
          <TeleprompterModal isOpen={showTeleprompter} onClose={() => setShowTeleprompter(false)} />
        </Suspense>
      )}
      {showCopilot && (
        <ErrorBoundary
          fallback={
            <div className="fixed bottom-20 right-4 z-50 w-80 rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-[#151a23] p-4 text-sm text-red-600 dark:text-red-200 shadow-2xl">
              AI Copilot crashed while opening. Check the console, then retry.
              <button
                type="button"
                className="mt-3 block rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white font-medium"
                onClick={() => setShowCopilot(false)}
              >
                Close
              </button>
            </div>
          }
          key="ai-copilot"
        >
          <Suspense
            fallback={
              <div className="fixed bottom-20 right-4 z-50 flex h-[600px] w-96 items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#151a23]/95 backdrop-blur-xl text-sm text-slate-500 dark:text-slate-400 shadow-2xl">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  Opening AI Copilot…
                </div>
              </div>
            }
          >
            <AiCopilot onClose={() => setShowCopilot(false)} />
          </Suspense>
        </ErrorBoundary>
      )}

      {!showCopilot && (
        <button
          type="button"
          onClick={() => setShowCopilot(true)}
          title="Open AI Copilot (Ctrl+/)"
          aria-label="Open AI Copilot"
          className="fixed bottom-6 right-6 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_8px_24px_rgba(99,102,241,0.3),0_2px_8px_rgba(99,102,241,0.2)] ring-1 ring-white/20 transition-all duration-200 hover:scale-105 hover:shadow-[0_12px_32px_rgba(99,102,241,0.4),0_4px_12px_rgba(99,102,241,0.3)] hover:from-violet-500 hover:to-indigo-500 active:scale-95"
        >
          <Sparkles className="h-5 w-5 text-white" />
        </button>
      )}

      <Suspense fallback={null}>
        <HelpModal />
      </Suspense>
      <Toaster />
    </div>
  );
}

/**
 * Root router — the ONLY device-aware piece. It reads the PC / Mobile / Tablet
 * identifier and mounts either the desktop editor or the mobile (touch-first)
 * editor. The desktop UI itself is untouched.
 */
function App() {
  const device = useDeviceType();

  // Ensure dark class is applied for professional dark theme as default for canvas areas
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  if (device === 'mobile' || device === 'tablet') {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-[#0a0a0a]" />}>
        <MobileApp />
      </Suspense>
    );
  }

  return <DesktopApp />;
}

export default App;
