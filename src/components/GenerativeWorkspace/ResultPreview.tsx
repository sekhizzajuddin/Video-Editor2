import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Code2,
  Send,
  Plus,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { GenerativeResult } from '@/utils/generateMotionGraphicsFromDialogue';
import { CodeEditor } from './CodeEditor';

export interface ResultPreviewProps {
  result: GenerativeResult | null;
  selectedClipUrl: string | null;
  selectedClipName?: string;
  selectedClipDuration?: number;
  isGenerating?: boolean;
  onRePrompt: (prompt: string) => void;
  onApply: () => void;
  showCodeEditor: boolean;
  setShowCodeEditor: (show: boolean | ((prev: boolean) => boolean)) => void;
  editedHtmlCss: string;
  setEditedHtmlCss: (val: string) => void;
  originalHtmlCss: string;
  onResetCode: () => void;
}

export type PreviewDisplayMode = 'composite' | 'motion-only' | 'video-only';

export const ResultPreview: React.FC<ResultPreviewProps> = ({
  result,
  selectedClipUrl,
  selectedClipName,
  selectedClipDuration = 0,
  isGenerating = false,
  onRePrompt,
  onApply,
  showCodeEditor,
  setShowCodeEditor,
  editedHtmlCss,
  setEditedHtmlCss,
  originalHtmlCss,
  onResetCode,
}) => {
  const [displayMode, setDisplayMode] = useState<PreviewDisplayMode>('composite');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isRePromptOpen, setIsRePromptOpen] = useState(false);
  const [rePromptText, setRePromptText] = useState('');
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);

  const baseVideoRef = useRef<HTMLVideoElement | null>(null);
  const motionVideoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Allocate object URL for generated WebM
  useEffect(() => {
    if (result?.webmBlob && result.webmBlob.size > 0) {
      const url = URL.createObjectURL(result.webmBlob);
      setMotionVideoUrl(url);
      setCurrentTime(0);
      setIsPlaying(false);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setMotionVideoUrl(null);
    }
  }, [result]);

  const effectiveDuration =
    result?.spec?.duration || selectedClipDuration || (baseVideoRef.current?.duration || 15);

  // Play / Pause Sync Loop
  const togglePlay = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (baseVideoRef.current) {
      if (nextPlaying) baseVideoRef.current.play().catch(() => {});
      else baseVideoRef.current.pause();
    }
    if (motionVideoRef.current) {
      if (nextPlaying) motionVideoRef.current.play().catch(() => {});
      else motionVideoRef.current.pause();
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (baseVideoRef.current) {
      baseVideoRef.current.currentTime = newTime;
    }
    if (motionVideoRef.current) {
      motionVideoRef.current.currentTime = newTime;
    }
  };

  const handleRestart = () => {
    handleSeek(0);
    if (!isPlaying) {
      togglePlay();
    }
  };

  // Sync timer tick
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const tick = () => {
      const activeEl = motionVideoRef.current || baseVideoRef.current;
      if (activeEl) {
        setCurrentTime(activeEl.currentTime);
        if (activeEl.currentTime >= effectiveDuration - 0.05) {
          // Loop playback
          handleSeek(0);
          if (baseVideoRef.current) baseVideoRef.current.play().catch(() => {});
          if (motionVideoRef.current) motionVideoRef.current.play().catch(() => {});
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, effectiveDuration]);

  const handleSendRePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (rePromptText.trim()) {
      onRePrompt(rePromptText.trim());
      setRePromptText('');
      setIsRePromptOpen(false);
    }
  };

  const formatTimecode = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#141414] border border-[#2d2d2d] rounded-xl overflow-hidden shadow-2xl">
      {/* Top Theater Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1e1e] border-b border-[#3e3e3e]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Film className="w-4 h-4 text-amber-400" />
            <span>Preview Theater</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              1080p • {effectiveDuration.toFixed(1)}s
            </span>

            {/* Display Mode Switcher (when source clip & motion graphic both exist) */}
            {selectedClipUrl && motionVideoUrl && (
              <div className="flex items-center bg-[#141414] rounded-lg p-0.5 border border-[#3e3e3e]">
                <button
                  type="button"
                  onClick={() => setDisplayMode('composite')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    displayMode === 'composite'
                      ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                      : 'text-[#808080] hover:text-white'
                  }`}
                  title="Source Video with Motion Graphics Overlay"
                >
                  🎬 Overlay
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('motion-only')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    displayMode === 'motion-only'
                      ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                      : 'text-[#808080] hover:text-white'
                  }`}
                  title="Motion Graphic Only (Transparent Alpha)"
                >
                  ✨ Motion
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('video-only')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    displayMode === 'video-only'
                      ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                      : 'text-[#808080] hover:text-white'
                  }`}
                  title="Source Video Only"
                >
                  🎞️ Source
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button
                type="button"
                onClick={() => setShowCodeEditor((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  showCodeEditor
                    ? 'bg-amber-400/10 text-amber-400 border-amber-400/40'
                    : 'bg-[#252525] text-[#a0a0a0] hover:text-white border-[#3e3e3e]'
                }`}
                title="View and manually tweak generated HTML/CSS code"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code ✏️</span>
                {showCodeEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={() => setIsRePromptOpen((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  isRePromptOpen
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/40'
                    : 'bg-[#252525] text-[#a0a0a0] hover:text-white border-[#3e3e3e]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Re-Prompt</span>
              </button>

              <button
                type="button"
                onClick={onApply}
                className="flex items-center gap-1 px-3.5 py-1 rounded text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Apply to Timeline</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Re-Prompt Drawer */}
      {isRePromptOpen && (
        <form
          onSubmit={handleSendRePrompt}
          className="flex items-center gap-2 p-2 bg-[#1c1c1c] border-b border-purple-500/30 px-4"
        >
          <input
            type="text"
            value={rePromptText}
            onChange={(e) => setRePromptText(e.target.value)}
            placeholder="Describe changes... e.g. 'make the lower third blue and add an animated arrow pointing right'"
            autoFocus
            className="flex-1 bg-[#141414] border border-[#3e3e3e] rounded text-xs text-white placeholder-[#606060] focus:outline-none focus:border-purple-400 px-3 py-1.5"
          />
          <button
            type="submit"
            disabled={!rePromptText.trim()}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Generate Revision</span>
          </button>
        </form>
      )}

      {/* Main Viewport Screen (Preview Size) */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 bg-[#0a0a0a] overflow-hidden select-none">
        {/* Transparent Checkerboard Pattern Background for Alpha Mode */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(#3e3e3e 1px, transparent 1px), radial-gradient(#3e3e3e 1px, #0a0a0a 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px',
          }}
        />

        {/* 16:9 Theater Screen Frame */}
        <div className="relative w-full h-full max-w-[1920px] max-h-[1080px] aspect-video bg-black rounded-lg overflow-hidden border border-[#2d2d2d] shadow-2xl flex items-center justify-center">
          {/* Layer 1: Source Video (When available and displayMode != 'motion-only') */}
          {selectedClipUrl && displayMode !== 'motion-only' && (
            <video
              ref={baseVideoRef}
              src={selectedClipUrl}
              muted={isMuted}
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}

          {/* Layer 2: Transparent WebM Motion Graphics Overlay */}
          {motionVideoUrl && displayMode !== 'video-only' ? (
            <video
              ref={motionVideoRef}
              src={motionVideoUrl}
              muted={isMuted}
              playsInline
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
            />
          ) : editedHtmlCss && displayMode !== 'video-only' ? (
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;}</style></head><body>${editedHtmlCss}</body></html>`}
              title="Motion Scene Overlay"
              sandbox="allow-scripts"
              className="absolute inset-0 w-full h-full border-none pointer-events-none z-10"
            />
          ) : null}

          {/* Standby Empty State (No clip & No result) */}
          {!selectedClipUrl && !motionVideoUrl && (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-3 z-20">
              <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[#3e3e3e] flex items-center justify-center shadow-inner">
                <Sparkles className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Full-Resolution Motion Studio</h4>
                <p className="text-xs text-[#808080] max-w-sm">
                  Drop a video clip on the left or type your dialogue to generate synced motion graphics.
                </p>
              </div>
            </div>
          )}

          {/* Standby State (Clip loaded, awaiting generation) */}
          {selectedClipUrl && !motionVideoUrl && !isGenerating && (
            <div className="absolute top-3 right-3 z-30 bg-black/75 backdrop-blur px-3 py-1 rounded-md border border-[#3e3e3e] text-[11px] text-[#a0a0a0] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Source Video Loaded • Click Generate
            </div>
          )}
        </div>
      </div>

      {/* Code Editor Panel (Slide / Expand Drawer) */}
      {showCodeEditor && (
        <div className="border-t border-[#3e3e3e] bg-[#141414] p-3 max-h-72 overflow-y-auto">
          <CodeEditor
            code={editedHtmlCss}
            onChange={setEditedHtmlCss}
            originalCode={originalHtmlCss}
            onReset={onResetCode}
          />
        </div>
      )}

      {/* Bottom Transport Scrubber Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-t border-[#3e3e3e] text-xs">
        {/* Left: Playback controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!selectedClipUrl && !motionVideoUrl}
            className="w-8 h-8 rounded-lg bg-[#252525] hover:bg-amber-400 hover:text-black text-white flex items-center justify-center transition-colors disabled:opacity-40"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            disabled={!selectedClipUrl && !motionVideoUrl}
            className="w-8 h-8 rounded-lg bg-[#252525] hover:bg-[#333] text-[#a0a0a0] hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
            title="Restart from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-lg bg-[#252525] hover:bg-[#333] text-[#a0a0a0] hover:text-white flex items-center justify-center transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-[#808080]" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
          </button>

          {/* Timecode */}
          <div className="font-mono text-[11px] text-[#a0a0a0] ml-2">
            <span className="text-white font-semibold">{formatTimecode(currentTime)}</span> /{' '}
            <span>{formatTimecode(effectiveDuration)}</span>
          </div>
        </div>

        {/* Center: Timeline Scrubber Slider */}
        <div className="flex-1 mx-6 flex items-center">
          <input
            type="range"
            min={0}
            max={effectiveDuration || 15}
            step={0.05}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        {/* Right: Clip status indicator */}
        <div className="text-[11px] text-[#808080] font-medium truncate max-w-[200px]">
          {selectedClipName ? `🎬 ${selectedClipName}` : 'No clip selected'}
        </div>
      </div>
    </div>
  );
};
