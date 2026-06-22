import { useEffect, useCallback, useRef, useState } from 'react';
import { TopToolbar } from '@/components/TopToolbar';
import { MediaPanel } from '@/components/MediaPanel';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Timeline } from '@/components/Timeline';
import { ExportModal } from '@/components/ExportModal';
import { SettingsModal } from '@/components/SettingsModal';
import { useEditorStore } from '@/store/editorStore';
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
  } = useEditorStore();

  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(280);
  const [timelineHeight, setTimelineHeight] = useState(320);
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

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlayback();
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setActiveTool('split');
          }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pasteClip();
          } else {
            e.preventDefault();
            setActiveTool('select');
          }
          break;
        case 'h':
          e.preventDefault();
          setActiveTool('hand');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
          } else {
            e.preventDefault();
            setActiveTool('zoom');
          }
          break;
        case 'delete':
        case 'backspace':
          if (selectedClipId) {
            e.preventDefault();
            removeClip(selectedClipId);
          }
          break;
        case 'b':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setActiveTool('ripple');
          }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            copyClip();
          } else {
            e.preventDefault();
            setActiveTool('split');
          }
          break;
        case 'k':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
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
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          const stepLeft = e.shiftKey ? 1.0 : (1 / 30);
          useEditorStore.getState().seek(Math.max(0, currentTime - stepLeft));
          break;
        case 'arrowright':
          e.preventDefault();
          const stepRight = e.shiftKey ? 1.0 : (1 / 30);
          useEditorStore.getState().seek(Math.min(useEditorStore.getState().totalDuration, currentTime + stepRight));
          break;
        case 'x':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            cutClip();
          }
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            duplicateClip();
          }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          }
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case 'home':
          e.preventDefault();
          useEditorStore.getState().seek(0);
          break;
        case 'end':
          e.preventDefault();
          useEditorStore.getState().seek(useEditorStore.getState().totalDuration);
          break;
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
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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

          {/* Timeline */}
          <div style={{ height: timelineHeight }}>
            <Timeline />
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
