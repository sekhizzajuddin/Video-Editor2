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

import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

interface PreviewCanvasToolbarHeaderProps {
  aspectRatio: string;
  setAspectRatio: (ar: '16:9' | '9:16' | '1:1' | '4:3') => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  isPopoutOpen: boolean;
  onTogglePopout: () => void;
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
  isPopoutOpen,
  onTogglePopout,
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
  const { settings, updateSettings, perRatioFramingEnabled, setPerRatioFramingEnabled } = useEditorStore();

  return (
    <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#1e1e1e] border-b border-[#2e2e2e] select-none text-xs">
      {/* Left: Aspect Ratio & Grid */}
      <div className="flex items-center gap-2">
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as any)}
          className="bg-[#2a2a2a] text-white border border-[#3e3e3e] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 font-medium"
          aria-label="Aspect Ratio"
        >
          <option value="16:9">16:9 Widescreen</option>
          <option value="9:16">9:16 Vertical</option>
          <option value="1:1">1:1 Square</option>
          <option value="4:3">4:3 Standard</option>
        </select>

        <label
          className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#3e3e3e] bg-[#252525] hover:bg-[#2e2e2e] cursor-pointer text-[11px] select-none transition-colors"
          title="Remember separate video canvas framing & position for each screen aspect ratio (16:9, 9:16, 1:1)"
        >
          <input
            type="checkbox"
            checked={perRatioFramingEnabled}
            onChange={(e) => setPerRatioFramingEnabled(e.target.checked)}
            className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
          />
          <span className={perRatioFramingEnabled ? 'text-amber-400 font-medium' : 'text-[#a0a0a0]'}>
            Remember Framing
          </span>
        </label>

        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid Overlay"
          className={`p-1 rounded transition-colors ${
            showGrid ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-[#888] hover:text-white hover:bg-white/5'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onTogglePopout}
          title={isPopoutOpen ? 'Close Floating Window' : 'Pop out Canvas Window'}
          className={`p-1 rounded transition-colors ${
            isPopoutOpen ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-[#888] hover:text-white hover:bg-white/5'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Zoom / View Status */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#888] font-mono">
          {Math.round(viewportZoom * 100)}%
        </span>
        {viewportZoom !== 1 && (
          <button
            onClick={onResetZoom}
            className="text-[10px] text-amber-400 hover:underline"
          >
            Reset 100%
          </button>
        )}
        <button
          onClick={onFitZoom}
          className="text-[10px] text-[#aaa] hover:text-white hover:underline"
        >
          Fit
        </button>
      </div>

      {/* Right: Scopes, Fullscreen & Settings */}
      <div className="flex items-center gap-1.5 relative">
        <button
          onClick={onToggleScopes}
          className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
            showScopes
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-[#2a2a2a] text-[#888] border-[#3e3e3e] hover:text-white'
          }`}
        >
          Scopes
        </button>

        <button
          onClick={onToggleThumbnailModal}
          className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
            showThumbnailModal
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-[#2a2a2a] text-[#888] border-[#3e3e3e] hover:text-white'
          }`}
        >
          Thumbnail
        </button>

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
          className="p-1 text-[#888] hover:text-white hover:bg-white/5 rounded transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          title="Preview Settings"
          className={`p-1 rounded transition-colors ${
            showSettingsPanel ? 'text-amber-400 bg-white/10' : 'text-[#888] hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Settings Panel */}
        {showSettingsPanel && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl overflow-hidden pointer-events-auto z-50">
            <div className="p-3 bg-[#252525] border-b border-[#3e3e3e] flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Preview Settings</h3>
              <button onClick={() => setShowSettingsPanel(false)} className="text-[#888] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div>
                <label className="text-[10px] text-[#a0a0a0] mb-2 block">Preview Quality</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['full', 'half', 'quarter'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateSettings({ previewQuality: q })}
                      className={`py-1.5 text-[10px] rounded capitalize transition-colors ${
                        settings.previewQuality === q
                          ? 'bg-amber-500 text-white'
                          : 'bg-[#2a2a2a] hover:bg-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[#a0a0a0]">Hardware Acceleration</label>
                <button
                  onClick={() => updateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${settings.hardwareAcceleration ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.hardwareAcceleration ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[#a0a0a0]">Safe Zones</label>
                <button
                  onClick={() => updateSettings({ showSafeZones: !settings.showSafeZones })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${settings.showSafeZones ? 'bg-sky-500' : 'bg-[#3e3e3e]'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.showSafeZones ? 'left-4' : 'left-0.5'}`} />
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

  const progressPercent = Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100));
  const progressBarStyle = { width: `${progressPercent}%` };
  const scrubThumbStyle = { left: `${progressPercent}%` };
  const volumeBarStyle = { width: `${(isMuted ? 0 : volume) * 100}%` };

  return (
    <div
      className="shrink-0 flex flex-col bg-[#181818] border-t border-[#2e2e2e]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Progress Bar */}
      <div className="px-3 pt-2 pb-1">
        <div className="relative h-1.5 group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-[#333]" />
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
            style={progressBarStyle}
          />
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleTimelineSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ margin: 0 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400 shadow-lg shadow-amber-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={scrubThumbStyle}
          />
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between px-3 pb-2">
        {/* Left: Time Display */}
        <div className="flex items-center gap-2 min-w-[90px]">
          <span className="text-[10px] font-mono text-[#a0a0a0] tabular-nums select-text">
            {String(Math.floor(currentTime / 60)).padStart(2, '0')}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
            <span className="text-[#555]"> / {String(Math.floor(totalDuration / 60)).padStart(2, '0')}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}</span>
          </span>
        </div>

        {/* Center: Playback Buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRestart}
            title="Go to Start"
            className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSkipBackward}
            title="Skip Back 10s"
            className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-all"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlayback}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className={`
              flex items-center justify-center w-9 h-9 rounded-full mx-1 transition-all duration-150 active:scale-95
              ${isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/40'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20'}
            `}
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleSkipForward}
            title="Skip Forward 10s"
            className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-all"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {playbackDirection === -1 && (
            <span className="ml-1 text-[9px] text-amber-400 font-bold px-1 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">REV</span>
          )}
        </div>

        {/* Right: Volume & Speed */}
        <div className="flex items-center gap-2 min-w-[90px] justify-end">
          <div className="flex items-center gap-1 group/vol">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="p-1 text-[#888] hover:text-white transition-colors shrink-0"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <div className="w-14 h-1.5 relative">
              <div className="absolute inset-0 rounded-full bg-[#333]" />
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-[#666] group-hover/vol:bg-amber-500 transition-colors"
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
              className="text-[10px] font-mono text-[#888] hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 border border-transparent hover:border-white/10"
            >
              {playbackSpeed === 1 ? '1×' : `${playbackSpeed}×`}
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl overflow-hidden z-50 pointer-events-auto">
                {speedOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                    className={`block w-full text-left px-4 py-1.5 text-xs transition-colors ${
                      playbackSpeed === s
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white'
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
