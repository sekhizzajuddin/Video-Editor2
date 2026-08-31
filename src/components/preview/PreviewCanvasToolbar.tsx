/**
 * PreviewCanvasToolbar.tsx
 * 
 * Top Header Toolbar & Bottom Transport Control Bar for Preview Canvas.
 * Includes play/pause, timecode, scrub progress bar, aspect ratio selector,
 * grid toggle, safe zones toggle, resolution/quality options, and fullscreen mode.
 * 
 * Connected to:
 * - Timeline: Controls playback (play/pause), seeks currentTime, adjusts speed and volume.
 * - EditorStore: Updates canvas aspect ratio, grid overlays, and preview quality settings.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings2,
  RotateCcw,
  Grid,
  ExternalLink,
  X,
  Zap,
  SlidersHorizontal,
  Image as ImageIcon
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { unlockiOSVideoPlay } from '@/hooks/useMediaPlayback';
import { getPlaybackTime, subscribePlaybackTime } from '@/utils/playbackClock';

interface PreviewCanvasToolbarHeaderProps {
  aspectRatio: string;
  setAspectRatio: (ar: '16:9' | '9:16' | '1:1' | '4:3') => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  viewportZoom: number;
  onResetZoom: () => void;
  onFitZoom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showScopes: boolean;
  onToggleScopes: () => void;
  showThumbnailModal: boolean;
  onToggleThumbnailModal: () => void;
  showSettingsPanel: boolean;
  setShowSettingsPanel: (show: boolean) => void;
}

export function PreviewCanvasHeaderToolbar({
  aspectRatio,
  setAspectRatio,
  showGrid,
  setShowGrid,
  viewportZoom,
  onResetZoom,
  onFitZoom,
  isFullscreen,
  onToggleFullscreen,
  showScopes,
  onToggleScopes,
  showThumbnailModal,
  onToggleThumbnailModal,
  showSettingsPanel,
  setShowSettingsPanel,
}: PreviewCanvasToolbarHeaderProps) {
  const { 
    settings, 
    updateSettings, 
    perRatioFramingEnabled, 
    setPerRatioFramingEnabled,
    virtualCamera,
    setVirtualCameraEnabled,
    setVirtualCameraAspectRatio 
  } = useEditorStore();

  return (
    <div
      role="toolbar"
      className="preview-header-toolbar shrink-0 flex items-center justify-between px-3 py-2 bg-[var(--theme-bg-panel)] border-b border-[var(--theme-border)] select-none text-xs transition-colors"
    >
      {/* Left: Aspect Ratio, Acceleration & Frame Tools */}
      <div className="flex items-center gap-2">
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as any)}
          className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] border border-[var(--theme-border)] hover:border-blue-500/40 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold cursor-pointer shadow-sm transition-colors"
          aria-label="Aspect Ratio"
        >
          <option value="16:9">16:9 Widescreen</option>
          <option value="9:16">9:16 Vertical (Reel/Short)</option>
          <option value="1:1">1:1 Square (Post)</option>
          <option value="4:3">4:3 Standard</option>
        </select>

        {typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full" title="WebGPU Hardware Acceleration Engine Active">
            <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500 dark:fill-emerald-400 dark:text-emerald-400" />
            WebGPU
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--theme-text-muted)] bg-black/5 dark:bg-white/5 border border-[var(--theme-border)] px-2 py-0.5 rounded-full" title="Canvas 2D fallback renderer active">
            Canvas 2D
          </span>
        )}

        <label
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)] hover:border-blue-500/40 cursor-pointer text-[11px] select-none transition-colors shadow-sm"
          title="Remember separate video canvas framing & position for each screen aspect ratio (16:9, 9:16, 1:1)"
        >
          <input
            type="checkbox"
            checked={perRatioFramingEnabled}
            onChange={(e) => setPerRatioFramingEnabled(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
          />
          <span className={perRatioFramingEnabled ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-[var(--theme-text-muted)]'}>
            Remember Framing
          </span>
        </label>

        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid Overlay"
          className={`p-1.5 rounded-lg border transition-all ${
            showGrid 
              ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/40 shadow-sm' 
              : 'text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1 border-l border-[var(--theme-border)] pl-2 ml-0.5">
          <button
            onClick={() => setVirtualCameraEnabled(!virtualCamera.enabled)}
            title={virtualCamera.enabled ? 'Disable Smart Reframe (Virtual Camera)' : 'Smart Reframe / Pan & Scan Overlay'}
            className={`p-1.5 rounded-lg border transition-all ${
              virtualCamera.enabled 
                ? 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/40 shadow-sm' 
                : 'text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          
          {virtualCamera.enabled && (
            <select
              value={virtualCamera.aspectRatio}
              onChange={(e) => setVirtualCameraAspectRatio(e.target.value as any)}
              className="bg-[var(--theme-bg-card)] text-indigo-600 dark:text-indigo-400 border border-indigo-500/40 rounded-lg px-2 py-0.5 text-[10px] focus:outline-none font-semibold ml-1 shadow-sm"
              aria-label="Smart Reframe Target Aspect Ratio"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="4:3">4:3</option>
            </select>
          )}
        </div>
      </div>

      {/* Center: Zoom / View Status */}
      <div className="flex items-center gap-2 bg-[var(--theme-bg-card)] px-2.5 py-0.5 rounded-lg border border-[var(--theme-border)] shadow-sm">
        <span className="text-[10px] text-[var(--theme-text-muted)] font-mono font-medium">
          {Math.round(viewportZoom * 100)}%
        </span>
        {viewportZoom !== 1 && (
          <button
            onClick={onResetZoom}
            className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            100%
          </button>
        )}
        <button
          onClick={onFitZoom}
          className="text-[10px] text-[var(--theme-text-primary)] hover:text-blue-500 font-medium transition-colors"
        >
          Fit
        </button>
      </div>

      {/* Right: Scopes, Fullscreen & Settings */}
      <div className="flex items-center gap-1.5 relative">
        <button
          onClick={onToggleScopes}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
            showScopes
              ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/40 shadow-sm'
              : 'bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text-primary)] hover:border-blue-500/30'
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          Scopes
        </button>

        <button
          onClick={onToggleThumbnailModal}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
            showThumbnailModal
              ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/40 shadow-sm'
              : 'bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text-primary)] hover:border-blue-500/30'
          }`}
        >
          <ImageIcon className="w-3 h-3" />
          Cover
        </button>

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-[var(--theme-border)] transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          title="Preview Settings"
          className={`p-1.5 rounded-lg border transition-all ${
            showSettingsPanel 
              ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/40' 
              : 'text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Settings Panel */}
        {showSettingsPanel && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-xl shadow-2xl overflow-hidden pointer-events-auto z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-3 bg-[var(--theme-bg-subpanel)] border-b border-[var(--theme-border)] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--theme-text-primary)] flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-blue-500" />
                Preview Settings
              </h3>
              <button 
                onClick={() => setShowSettingsPanel(false)} 
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] mb-2 block">
                  Playback Quality
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-[var(--theme-bg-card)] p-1 border border-[var(--theme-border)] rounded-lg">
                  {(['full', 'half', 'quarter'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateSettings({ previewQuality: q })}
                      className={`py-1 text-[11px] font-medium rounded-md capitalize transition-all ${
                        settings.previewQuality === q
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <label className="text-xs font-medium text-[var(--theme-text-primary)] block">Hardware Acceleration</label>
                  <span className="text-[10px] text-[var(--theme-text-muted)]">GPU shader compositing</span>
                </div>
                <button
                  onClick={() => updateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${settings.hardwareAcceleration ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${settings.hardwareAcceleration ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[var(--theme-border)]">
                <div>
                  <label className="text-xs font-medium text-[var(--theme-text-primary)] block">Safe Zones Overlay</label>
                  <span className="text-[10px] text-[var(--theme-text-muted)]">90% Action / 80% Title Guides</span>
                </div>
                <button
                  onClick={() => updateSettings({ showSafeZones: !settings.showSafeZones })}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${settings.showSafeZones ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${settings.showSafeZones ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PreviewCanvasTransportControlsProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  togglePlayback: () => void;
  handleTimelineSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRestart: () => void;
  handleSkipBackward: () => void;
  handleSkipForward: () => void;
  playbackDirection: number;
  volume: number;
  setVolume: (v: number) => void;
  isMuted: boolean;
  toggleMute: () => void;
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;
}

export function PreviewCanvasTransportControls({
  currentTime,
  totalDuration,
  isPlaying,
  togglePlayback,
  handleTimelineSeek,
  handleRestart,
  handleSkipBackward,
  handleSkipForward,
  playbackDirection,
  volume,
  setVolume,
  isMuted,
  toggleMute,
  playbackSpeed,
  setPlaybackSpeed,
}: PreviewCanvasTransportControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // Smooth time display, updated WITHOUT React renders.
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const scrubThumbRef = useRef<HTMLDivElement>(null);
  const seekInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const paint = (t: number) => {
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(Math.floor(t % 60)).padStart(2, '0');
      const cs = String(Math.floor((t % 1) * 100)).padStart(2, '0');
      if (timecodeRef.current) timecodeRef.current.textContent = `${mm}:${ss}.${cs}`;

      const pct = Math.min(100, Math.max(0, (t / (totalDuration || 1)) * 100));
      if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
      if (scrubThumbRef.current) scrubThumbRef.current.style.left = `${pct}%`;
      if (seekInputRef.current && document.activeElement !== seekInputRef.current) {
        seekInputRef.current.value = String(t);
      }
    };

    paint(getPlaybackTime());
    return subscribePlaybackTime(paint);
  }, [totalDuration]);

  const volumeBarStyle = { width: `${(isMuted ? 0 : volume) * 100}%` };

  return (
    <div
      className="shrink-0 flex flex-col bg-[var(--theme-bg-panel)] border-t border-[var(--theme-border)] transition-colors select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Sleek Top Progress Scrubber */}
      <div className="px-4 pt-2.5 pb-1">
        <div className="relative h-1.5 group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-[var(--theme-border)] opacity-80" />
          <div
            ref={progressFillRef}
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          />
          <input
            ref={seekInputRef}
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.01}
            defaultValue={currentTime}
            onChange={handleTimelineSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ margin: 0 }}
          />
          <div
            ref={scrubThumbRef}
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 shadow-md shadow-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          />
        </div>
      </div>

      {/* Transport Controls Row */}
      <div className="flex items-center justify-between px-4 pb-2.5 pt-0.5">
        {/* Left: Timecode Readout */}
        <div className="flex items-center gap-2 min-w-[110px]">
          <span className="text-[11px] font-mono text-[var(--theme-text-primary)] font-semibold tabular-nums select-text bg-[var(--theme-bg-card)] px-2 py-0.5 rounded-md border border-[var(--theme-border)] shadow-sm">
            <span ref={timecodeRef}>00:00.00</span>
            <span className="text-[var(--theme-text-muted)] font-normal"> / {String(Math.floor(totalDuration / 60)).padStart(2, '0')}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}</span>
          </span>
        </div>

        {/* Center: Main Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRestart}
            title="Go to Start"
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSkipBackward}
            title="Skip Back 10s"
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (!isPlaying) unlockiOSVideoPlay();
              togglePlayback();
            }}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className={`
              flex items-center justify-center w-9 h-9 rounded-full mx-1 transition-all duration-200 active:scale-95 shadow-md
              ${isPlaying
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30'}
            `}
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleSkipForward}
            title="Skip Forward 10s"
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {playbackDirection === -1 && (
            <span className="ml-1 text-[9px] text-amber-500 font-bold px-1.5 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">REV</span>
          )}
        </div>

        {/* Right: Volume & Speed Controls */}
        <div className="flex items-center gap-2.5 min-w-[110px] justify-end">
          <div className="flex items-center gap-1.5 group/vol">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors shrink-0"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <div className="w-16 h-1.5 relative bg-[var(--theme-border)] rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-blue-600 group-hover/vol:bg-blue-500 transition-colors"
                style={volumeBarStyle}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              title="Playback Speed"
              className="text-[10px] font-mono text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors px-2 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--theme-border)] shadow-sm font-semibold"
            >
              {playbackSpeed === 1 ? '1×' : `${playbackSpeed}×`}
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-xl shadow-xl overflow-hidden z-50 pointer-events-auto min-w-[80px]">
                {speedOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs transition-colors font-mono ${
                      playbackSpeed === s
                        ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-[var(--theme-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--theme-text-primary)]'
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
