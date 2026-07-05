import { useEffect, useCallback, useRef, useState } from 'react';
import { Music, MousePointer2, ArrowRightToLine, ArrowLeftToLine, ArrowLeftRight, Timer, Scissors, Hand, ZoomIn, Undo2, Redo2 } from 'lucide-react';
import type { EditorTool } from '@/types';
import { TopToolbar } from '@/components/TopToolbar';
import { MediaPanel } from '@/components/MediaPanel';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Timeline } from '@/components/Timeline';
import { AudioMixer } from '@/components/AudioMixer';
import { ExportModal } from '@/components/ExportModal';
import { SettingsModal } from '@/components/SettingsModal';
import { useEditorStore } from '@/store/editorStore';
import { DEFAULT_SHORTCUTS, getShortcutString } from '@/utils/keyboardShortcuts';
import { saveAutosaveToDB } from '@/utils/projectPersistence';
import './App.css';

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
    removeOverLayer,
    selectOverLayer,
    settings,
    updateSettings,
  } = useEditorStore();

  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(280);
  const [timelineHeight, setTimelineHeight] = useState(320);
  const [bottomTab, setBottomTab] = useState<'timeline' | 'mixer'>('timeline');
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

      const customShortcuts = settings.keyboardShortcuts || {};
      const shortcutsMap: Record<string, string> = {};
      for (const def of DEFAULT_SHORTCUTS) {
        shortcutsMap[def.id] = customShortcuts[def.id] !== undefined ? customShortcuts[def.id] : def.defaultKey;
      }

      // Find if the pressed combination is assigned to an action
      const actionId = Object.entries(shortcutsMap).find(([_, keyCombo]) => keyCombo.toLowerCase() === pressed.toLowerCase())?.[0];

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
          pasteClip();
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
          updateSettings({ snapEnabled: !settings.snapEnabled });
          break;
        case 'delete_selected': {
          const storeState = useEditorStore.getState();
          if (storeState.selectedKeyframeLines.length > 0) {
            removeSelectedKeyframeLines();
          } else if (storeState.selectedOverLayerId) {
            removeOverLayer(storeState.selectedOverLayerId);
            selectOverLayer(null);
          } else if (storeState.selectedClipIds.length > 0) {
            removeClip(storeState.selectedClipIds[0]);
          } else if (selectedClipId) {
            removeClip(selectedClipId);
          } else if (selectedTransitionClipId) {
            removeTransition(selectedTransitionClipId);
          }
          break;
        }
        case 'tool_rate_stretch':
          setActiveTool('rateStretch');
          break;
        case 'select_all_clips_forward': {
          const selectedClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
          if (selectedClip) {
            const refTime = selectedClip.startTime;
            const matchingIds = tracks
              .flatMap((t) => t.clips)
              .filter((c) => c.startTime >= refTime)
              .map((c) => c.id);
            selectClips(matchingIds);
          }
          break;
        }
        case 'select_all_clips_backward': {
          const selectedClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
          if (selectedClip) {
            const refTime = selectedClip.startTime;
            const matchingIds = tracks
              .flatMap((t) => t.clips)
              .filter((c) => c.startTime <= refTime)
              .map((c) => c.id);
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
          copyClip();
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
          const t = useEditorStore.getState().currentTime;
          if (selectedClipId) {
            splitClip(selectedClipId, t);
          } else {
            tracks.forEach((track) => {
              track.clips.forEach((clip) => {
                if (t > clip.startTime && t < clip.startTime + clip.duration) {
                  splitClip(clip.id, t);
                }
              });
            });
          }
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
      settings,
      updateSettings,
      selectedTransitionClipId,
      removeTransition,
      removeSelectedKeyframeLines,
      removeOverLayer,
      selectOverLayer,
      cutClip,
      selectClips,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Load project on mount
  useEffect(() => {
    useEditorStore.getState().loadProject().then((loaded) => {
      if (loaded) console.log('Successfully restored project from IndexedDB');
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
        setLeftWidth(Math.max(180, Math.min(400, e.clientX)));
      }
      if (isDraggingRight.current) {
        const windowWidth = window.innerWidth;
        setRightWidth(Math.max(200, Math.min(400, windowWidth - e.clientX)));
      }
      if (isDraggingTimeline.current) {
        const windowHeight = window.innerHeight;
        setTimelineHeight(Math.max(200, Math.min(500, windowHeight - e.clientY)));
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
    { id: 'split', icon: Scissors, label: 'Split', shortcut: 'C' },
    { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
    { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] overflow-hidden">
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Media Panel (Left) */}
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: leftWidth }}
        >
          <MediaPanel />
        </div>

        {/* Left Resize Handle */}
        <div
          className="w-1 bg-[#3e3e3e] hover:bg-amber-500 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => { isDraggingLeft.current = true; }}
        />

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Preview Canvas */}
          <div className="flex-1 overflow-hidden">
            <PreviewCanvas />
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
                    const isActive = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        title={`${tool.label} (${tool.shortcut})`}
                        className={`relative p-1.5 rounded transition-all duration-150 group ${
                          isActive
                            ? 'bg-[#3e3e3e] text-white'
                            : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          {tool.label} ({tool.shortcut})
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
                <Timeline />
              ) : (
                <AudioMixer />
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
          <PropertiesPanel />
        </div>
      </div>

      {/* Modals */}
      <ExportModal />
      <SettingsModal />
    </div>
  );
}

export default App;
