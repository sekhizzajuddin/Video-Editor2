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
import { Music, MousePointer2, ArrowRightToLine, ArrowLeftToLine, ArrowLeftRight, Timer, Scissors, Hand, ZoomIn, Undo2, Redo2, Sparkles, SlidersHorizontal, MoveHorizontal } from 'lucide-react';
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

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
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

      if (e.key === 'Escape') {
        const storeState = useEditorStore.getState();
        if (storeState.selectedSpeedFrame) {
          storeState.selectSpeedFrame(null, null);
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const storeState = useEditorStore.getState();
        if (storeState.selectedSpeedFrame) {
          e.preventDefault();
          storeState.removeSpeedFrame(storeState.selectedSpeedFrame.clipId, storeState.selectedSpeedFrame.frameId);
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
          if (storeState.selectedExportRegionId) {
            storeState.removeExportRegion(storeState.selectedExportRegionId);
          } else if (storeState.selectedSpeedFrame) {
            storeState.removeSpeedFrame(storeState.selectedSpeedFrame.clipId, storeState.selectedSpeedFrame.frameId);
          } else if (storeState.selectedKeyframeLines.length > 0) {
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

  // Load project on mount is removed since WelcomeScreen handles it

  // Restore custom fonts from localStorage on startup
  useEffect(() => {
    import('@/utils/fontManager').then(({ restoreCustomFonts }) => {
      restoreCustomFonts().catch((err) => console.warn('Font restore failed:', err));
    });
  }, []);

  // Ensure API keys are fetched from /api/keys (Vercel) and stored in sessionStorage.
  // apiKeyManager already fires this eagerly at module load — this useEffect is a
  // safety net in case the module was imported before the DOM was ready.
  useEffect(() => {
    hydrateKeysFromServer().catch(() => {/* handled internally */});
  }, []);

  // Single listener for the global toggle-copilot event (TopToolbar + FAB).
  // Previously this hook was registered TWICE, so one click toggled open then
  // immediately closed — the chat appeared not to open at all.
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

  // Periodic Autosave Versioning (every 2 minutes)
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
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [settings.autosave]);

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft.current) {
        setLeftWidth(() => Math.max(180, Math.min(400, e.clientX)));
      }
      if (isDraggingRight.current) {
        const windowWidth = window.innerWidth;
        setRightWidth(() => Math.max(200, Math.min(400, windowWidth - e.clientX)));
      }
      if (isDraggingTimeline.current) {
        const windowHeight = window.innerHeight;
        setTimelineHeight(() => Math.max(200, Math.min(500, windowHeight - e.clientY)));
      }
    };

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      isDraggingTimeline.current = false;
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
    { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[var(--theme-bg-app)] text-[var(--theme-text-primary)] overflow-hidden select-none transition-colors">
      {projectId === 'default' && (
        <Suspense fallback={null}>
          <WelcomeScreen />
        </Suspense>
      )}
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Media Panel (Left) */}
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: leftWidth }}
        >
          <Suspense fallback={<div className="w-full h-full bg-[var(--theme-bg-panel)]" />}>
            <MediaPanel />
          </Suspense>
        </div>

        {/* Left Resize Handle */}
        <div
          className="w-1 bg-[var(--theme-border)] hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => { isDraggingLeft.current = true; }}
        />

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Preview Canvas / Generative Workspace */}
          <div className="flex-1 overflow-hidden relative bg-[var(--theme-bg-app)]">
            {workspaceLayout?.preset === 'Generative' ? (
              <Suspense fallback={<div className="w-full h-full bg-[var(--theme-bg-panel)] flex items-center justify-center text-[var(--theme-text-muted)] text-sm">Loading Generative Workspace…</div>}>
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
            className="h-1 bg-[var(--theme-border)] hover:bg-blue-500 cursor-row-resize shrink-0 transition-colors"
            onMouseDown={() => { isDraggingTimeline.current = true; }}
          />

          {/* Timeline / Audio Mixer Container */}
          <div style={{ height: timelineHeight }} className="flex flex-col bg-[var(--theme-bg-panel)] overflow-hidden shrink-0">
            {/* Header Tabs */}
            <div className="h-9 flex items-center justify-between px-3 bg-[var(--theme-bg-panel)] border-b border-[var(--theme-border)] shrink-0 select-none text-xs">
              <div className="flex items-center gap-1.5 bg-[var(--theme-bg-card)] p-1 rounded-lg border border-[var(--theme-border)] shadow-sm">
                <button
                  onClick={() => setBottomTab('timeline')}
                  className={`px-3 py-1 text-[11px] rounded-md transition-all uppercase tracking-wider font-semibold ${
                    bottomTab === 'timeline'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setBottomTab('mixer')}
                  className={`px-3 py-1 text-[11px] rounded-md transition-all uppercase tracking-wider font-semibold flex items-center gap-1.5 ${
                    bottomTab === 'mixer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Music className="w-3 h-3 text-purple-400" /> Audio Mixer
                </button>
              </div>

              {/* Editing Tools */}
              <div className="flex items-center gap-1.5 opacity-95 hover:opacity-100 transition-opacity">
                <div className="flex items-center bg-[var(--theme-bg-card)] rounded-lg border border-[var(--theme-border)] p-0.5 shadow-sm">
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = tool.id !== 'split' && activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          if (tool.id === 'split') {
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
                          } else {
                            setActiveTool(tool.id);
                          }
                        }}
                        title={tool.id === 'split' ? "Split Clip at Playhead" : `${tool.label} (${tool.shortcut})`}
                        className={`relative p-1.5 rounded-md transition-all duration-150 group ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm font-semibold'
                            : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--theme-bg-panel)] text-[var(--theme-text-primary)] border border-[var(--theme-border)] text-[9px] font-medium rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          {tool.id === 'split' ? 'Split Clip at Playhead' : `${tool.label} (${tool.shortcut})`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="w-px h-5 bg-[var(--theme-border)] mx-1" />

                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md border border-[var(--theme-border)] disabled:opacity-30 transition-all"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md border border-[var(--theme-border)] disabled:opacity-30 transition-all"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {bottomTab === 'timeline' ? (
                <ErrorBoundary fallback={<div className="flex h-full items-center justify-center text-[#ff6b6b] bg-[var(--theme-bg-panel)] font-medium p-8 text-center">Timeline crashed. Please refresh the page.</div>}>
                  <Suspense fallback={<div className="w-full h-full bg-[var(--theme-bg-panel)]" />}>
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
              className="w-1 bg-[var(--theme-border)] hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
              onMouseDown={() => { isDraggingRight.current = true; }}
            />

            {/* Properties Panel (Right) */}
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: rightWidth }}
            >
              <Suspense fallback={<div className="w-full h-full bg-[var(--theme-bg-panel)]" />}>
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
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4">
              <div className="bg-[#2d2d2d] rounded-xl p-6 max-w-sm border border-red-500/40 text-center space-y-4 shadow-2xl">
                <div className="w-10 h-10 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">
                  !
                </div>
                <h3 className="text-white font-semibold text-sm">Export Window Error</h3>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  The export dialog encountered an issue. Your project changes are safely saved.
                </p>
                <button
                  onClick={() => useEditorStore.getState().setShowExportModal(false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg font-medium transition-colors w-full"
                >
                  Close
                </button>
              </div>
            </div>
          }
          key="export-modal"
        >
          <Suspense fallback={null}>
            <ExportModal />
          </Suspense>
        </ErrorBoundary>
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
            <div className="fixed bottom-16 right-4 z-50 w-80 rounded-xl border border-red-500/40 bg-zinc-950 p-4 text-sm text-red-200 shadow-2xl">
              AI Copilot crashed while opening. Check the console, then retry.
              <button
                type="button"
                className="mt-3 block rounded bg-red-600 px-3 py-1.5 text-xs text-white"
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
              <div className="fixed bottom-16 right-4 z-50 flex h-[600px] w-96 items-center justify-center rounded-2xl border border-white/10 bg-background/95 text-sm text-zinc-400 shadow-2xl">
                Opening AI Copilot…
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
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/50 ring-2 ring-white/10 transition hover:scale-105 hover:from-purple-500 hover:to-indigo-500"
        >
          <Sparkles className="h-5 w-5 text-amber-200" />
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
