import React, { useEffect, useCallback, useRef, useState, Suspense } from 'react';
import { Music, MousePointer2, ArrowRightToLine, ArrowLeftToLine, ArrowLeftRight, Timer, Scissors, Hand, ZoomIn, Undo2, Redo2, Sparkles, SlidersHorizontal, MoveHorizontal } from 'lucide-react';
import type { EditorTool } from '@/types';
import { TopToolbar } from '@/components/TopToolbar';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HelpTooltipManager } from '@/components/HelpTooltipManager';
import { FileHandlerInitializer } from '@/components/FileHandlerInitializer';

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

function App() {
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
    const handleToggleCopilot = () => setShowCopilot(p => !p);
    window.addEventListener('toggle-copilot', handleToggleCopilot);
    return () => window.removeEventListener('toggle-copilot', handleToggleCopilot);
  }, []);

  // Load project on mount is removed since WelcomeScreen handles it

  // Restore custom fonts from localStorage on startup
  useEffect(() => {
    import('@/utils/fontManager').then(({ restoreCustomFonts }) => {
      restoreCustomFonts().catch((err) => console.warn('Font restore failed:', err));
    });
  }, []);

  // Fetch API keys from Vercel environment at runtime if available
  useEffect(() => {
    fetch('/api/keys')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch keys');
      })
      .then((data) => {
        if (data.geminiApiKey) {
          sessionStorage.setItem('procut_gemini_key', data.geminiApiKey);
        }
        if (data.groqApiKey) {
          sessionStorage.setItem('procut_groq_key', data.groqApiKey);
        }
      })
      .catch((err) => {
        console.warn('API keys fetch not available or failed:', err);
      });
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
    <div className="h-screen flex flex-col bg-surface-900 text-white overflow-hidden select-none">
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
          <Suspense fallback={<div className="w-full h-full bg-[#1e1e1e]" />}>
            <MediaPanel />
          </Suspense>
        </div>

        {/* Left Resize Handle */}
        <div
          className="w-1 bg-[#3e3e3e] hover:bg-amber-500 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => { isDraggingLeft.current = true; }}
        />

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Preview Canvas */}
          <div className="flex-1 overflow-hidden relative">
            <PreviewCanvas />
            <Suspense fallback={null}>
              <ScopesPanel />
            </Suspense>
          </div>

          {/* Timeline Resize Handle */}
          <div
            className="h-1 bg-[#3e3e3e] hover:bg-amber-500 cursor-row-resize shrink-0 transition-colors"
            onMouseDown={() => { isDraggingTimeline.current = true; }}
          />

          {/* Timeline / Audio Mixer Container */}
          <div style={{ height: timelineHeight }} className="flex flex-col bg-[#252525] overflow-hidden shrink-0">
            {/* Header Tabs */}
            <div className="h-8 flex items-center justify-between px-3 bg-[#1e1e1e] border-b border-[#3e3e3e] shrink-0 select-none">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBottomTab('timeline')}
                  className={`px-3 py-1 text-[11px] rounded transition-all uppercase tracking-wider font-semibold ${
                    bottomTab === 'timeline'
                      ? 'bg-[#2d2d2d] text-amber-500 border border-[#3e3e3e]'
                      : 'text-[#8a8a8a] hover:text-white'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setBottomTab('mixer')}
                  className={`px-3 py-1 text-[11px] rounded transition-all uppercase tracking-wider font-semibold flex items-center gap-1.5 ${
                    bottomTab === 'mixer'
                      ? 'bg-[#2d2d2d] text-amber-500 border border-[#3e3e3e]'
                      : 'text-[#8a8a8a] hover:text-white'
                  }`}
                >
                  <Music className="w-3 h-3 text-purple-400" /> Audio Mixer
                </button>
              </div>

              {/* Editing Tools (Moved from Top Toolbar) */}
              <div className="flex items-center gap-1 opacity-90 hover:opacity-100 transition-opacity">
                <div className="flex items-center bg-[#252525] rounded border border-[#3e3e3e] p-0.5">
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
                        className={`relative p-1.5 rounded transition-all duration-150 group ${
                          isActive
                            ? 'bg-[#3e3e3e] text-white'
                            : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          {tool.id === 'split' ? 'Split Clip at Playhead' : `${tool.label} (${tool.shortcut})`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="w-px h-5 bg-[#3e3e3e] mx-1.5" />

                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded disabled:opacity-30 transition-all"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded disabled:opacity-30 transition-all"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {bottomTab === 'timeline' ? (
                <ErrorBoundary fallback={<div className="flex h-full items-center justify-center text-[#ff6b6b] bg-[#1a1a1a] font-medium p-8 text-center">Timeline crashed. Please refresh the page.</div>}>
                  <Suspense fallback={<div className="w-full h-full bg-[#1a1a1a]" />}>
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

        {/* Right Resize Handle */}
        <div
          className="w-1 bg-[#3e3e3e] hover:bg-amber-500 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => { isDraggingRight.current = true; }}
        />

        {/* Properties Panel (Right) */}
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: rightWidth }}
        >
          <Suspense fallback={<div className="w-full h-full bg-[#1e1e1e]" />}>
            <PropertiesPanel />
          </Suspense>
        </div>
      </div>

      {/* Modals & Global Handlers */}
      <FileHandlerInitializer />
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
      {showCopilot ? (
        <ErrorBoundary fallback={<div />} key="ai-copilot">
          <Suspense fallback={null}>
            <AiCopilot onClose={() => setShowCopilot(false)} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <button
          onClick={() => setShowCopilot(true)}
          title="Open AI Copilot"
          className="fixed bottom-5 right-5 z-[100] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium px-4 py-2.5 rounded-full shadow-2xl shadow-purple-500/50 flex items-center gap-2 transition-all duration-300 hover:scale-105 border border-white/20 group"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <span className="text-sm font-semibold tracking-wide">AI Copilot</span>
        </button>
      )}
      <Toaster />
    </div>
  );
}

export default App;
