import { useEffect, useCallback, useRef, useState } from 'react';
import { Music } from 'lucide-react';
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
    currentTime,
    tracks,
    selectClips,
    selectedTransitionClipId,
    removeTransition,
    removeSelectedKeyframeLines,
    removeOverLayer,
    selectOverLayer,
    settings,
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
          useEditorStore.getState().setInPoint(currentTime);
          break;
        case 'set_out_point':
          useEditorStore.getState().setOutPoint(currentTime);
          break;
        case 'add_marker':
          useEditorStore.getState().addMarker(currentTime);
          break;
        case 'shuttle_reverse': {
          const state = useEditorStore.getState();
          const curDir = state.playbackDirection ?? 0;
          const curSpeed = state.playbackSpeed ?? 1;
          if (curDir >= 0) {
            state.setPlaybackDirection(-1, 1);
          } else {
            state.setPlaybackDirection(-1, Math.min(curSpeed * 2, 8));
          }
          break;
        }
        case 'shuttle_pause': {
          useEditorStore.getState().setPlaybackDirection(0);
          break;
        }
        case 'shuttle_forward': {
          const state = useEditorStore.getState();
          const curDir = state.playbackDirection ?? 0;
          const curSpeed = state.playbackSpeed ?? 1;
          if (curDir <= 0) {
            state.setPlaybackDirection(1, 1);
          } else {
            state.setPlaybackDirection(1, Math.min(curSpeed * 2, 8));
          }
          break;
        }
        case 'seek_frame_left':
          useEditorStore.getState().seek(Math.max(0, currentTime - (1 / 30)));
          break;
        case 'seek_frame_right':
          useEditorStore.getState().seek(Math.min(useEditorStore.getState().totalDuration, currentTime + (1 / 30)));
          break;
        case 'seek_second_left':
          useEditorStore.getState().seek(Math.max(0, currentTime - 1.0));
          break;
        case 'seek_second_right':
          useEditorStore.getState().seek(Math.min(useEditorStore.getState().totalDuration, currentTime + 1.0));
          break;
        case 'cut_clip':
          cutClip();
          break;
        case 'duplicate_clip':
          duplicateClip();
          break;
        case 'zoom_timeline_in':
          zoomIn();
          break;
        case 'zoom_timeline_out':
          zoomOut();
          break;
        case 'seek_start':
          useEditorStore.getState().seek(0);
          break;
        case 'seek_end':
          useEditorStore.getState().seek(useEditorStore.getState().totalDuration);
          break;
        case 'split_clip': {
          if (selectedClipId) {
            splitClip(selectedClipId, currentTime);
          } else {
            tracks.forEach((track) => {
              track.clips.forEach((clip) => {
                if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
                  splitClip(clip.id, currentTime);
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
      currentTime,
      tracks,
      settings,
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
