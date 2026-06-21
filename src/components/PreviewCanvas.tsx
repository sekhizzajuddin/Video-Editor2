import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Settings2,
  Film,
  SkipBack10,
  SkipForward10,
  RotateCcw,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { formatTime } from '@/utils/time';
import { useRef, useEffect, useState, useCallback } from 'react';

export function PreviewCanvas() {
  const {
    currentTime,
    isPlaying,
    totalDuration,
    isMuted,
    volume,
    togglePlayback,
    seek,
    setVolume,
    toggleMute,
    tracks,
    selectedClipId,
    selectClip,
    playbackSpeed,
    setPlaybackSpeed,
  } = useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const lastTimeRef = useRef<number>(0);

  // Playback loop - improved with delta time
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const newTime = currentTime + dt * playbackSpeed;
      if (newTime >= totalDuration) {
        seek(0);
        useEditorStore.getState().pause();
        return;
      }
      seek(newTime);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentTime, totalDuration, playbackSpeed, seek]);

  // Render canvas with frame preview
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Find the topmost visible clip at current time
    let activeClip = null;
    let activeTrack = null;
    for (let i = tracks.length - 1; i >= 0; i--) {
      const track = tracks[i];
      if (track.hidden || track.type !== 'video') continue;
      for (const clip of track.clips) {
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          activeClip = clip;
          activeTrack = track;
          break;
        }
      }
      if (activeClip) break;
    }

    // Draw preview
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background pattern (checkerboard)
    ctx.fillStyle = '#1a1a1a';
    for (let x = 0; x < canvas.width; x += 20) {
      for (let y = 0; y < canvas.height; y += 20) {
        if ((x / 20 + y / 20) % 2 === 0) {
          ctx.fillRect(x, y, 20, 20);
        }
      }
    }

    if (activeClip) {
      const mediaItem = useEditorStore
        .getState()
        .mediaLibrary.find((m) => m.id === activeClip!.mediaId);

      if (mediaItem) {
        const progress =
          (currentTime - activeClip.startTime + activeClip.trimStart) /
          (mediaItem.duration - activeClip.trimStart - activeClip.trimEnd);

        // Draw media specific backgrounds
        const baseColor = mediaItem.type === 'video' ? '#3b82f6' : mediaItem.type === 'audio' ? '#10b981' : '#f59e0b';
        const bgColor = mediaItem.type === 'video' ? '#1e3a5f' : mediaItem.type === 'audio' ? '#1a4a3e' : '#4a3b1a';
        const color = mediaItem.type === 'video' ? '#60a5fa' : mediaItem.type === 'audio' ? '#34d399' : '#fbbf24';

        // Apply transform
        ctx.save();
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(activeClip.transform.scale / 100, activeClip.transform.scale / 100);
        ctx.rotate((activeClip.transform.rotation * Math.PI) / 180);
        ctx.translate(activeClip.transform.x, activeClip.transform.y);
        ctx.globalAlpha = activeClip.opacity;

        // Draw the content
        const w = canvas.width * 0.8;
        const h = canvas.height * 0.8;
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        // Draw content type specific visuals
        if (mediaItem.type === 'video') {
          // Simulate video frame with animated bars
          const frameIndex = Math.floor(progress * 10) % 10;
          for (let i = 0; i < 5; i++) {
            const barHeight = 20 + (Math.sin((frameIndex + i) * 0.8) * 0.5 + 0.5) * 40;
            ctx.fillStyle = `rgba(96, 165, 250, ${0.3 + (i * 0.1)})`;
            ctx.fillRect(-w / 2 + (i * w / 5) + 5, -h / 2 + (h - barHeight) / 2, w / 5 - 10, barHeight);
          }
        } else if (mediaItem.type === 'audio') {
          // Simulate audio waveform
          for (let i = 0; i < 50; i++) {
            const amplitude = 5 + Math.sin(i * 0.3 + progress * 10) * 15 + 5;
            ctx.fillStyle = `rgba(52, 211, 153, 0.5)`;
            ctx.fillRect(-w / 2 + (i * w / 50), (h / 2) - amplitude, w / 50 - 1, amplitude * 2);
          }
        } else if (mediaItem.type === 'image') {
          // Simulate image with a frame preview
          ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
          ctx.fillRect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40);
        }

        // Draw gradient overlay
        const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '10');
        ctx.fillStyle = gradient;
        ctx.fillRect(-w / 2, -h / 2, w, h);

        // Draw media icon and info
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mediaItem.type.toUpperCase(), 0, -10);

        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(mediaItem.name, 0, 15);

        ctx.font = '10px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`${Math.round(Math.min(progress, 1) * 100)}%`, 0, 32);

        ctx.restore();
      }
    } else {
      // No active clip - show empty state with instructions
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No clip at current position', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Add clips to the timeline to preview', canvas.width / 2, canvas.height / 2 + 12);
    }

    // Draw timecode overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(canvas.width - 100, 8, 92, 22);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatTime(currentTime), canvas.width - 12, 19);
  }, [currentTime, tracks, selectedClipId]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleCanvasClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    // Find topmost clip at current time
    let topClip = null;
    for (let i = tracks.length - 1; i >= 0; i--) {
      const track = tracks[i];
      if (track.hidden || track.type !== 'video') continue;
      for (const clip of track.clips) {
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          topClip = clip;
          break;
        }
      }
      if (topClip) break;
    }
    if (topClip) {
      selectClip(topClip.id);
    }
  };

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleSkipBackward = () => {
    seek(Math.max(0, currentTime - 10));
  };

  const handleSkipForward = () => {
    seek(Math.min(totalDuration, currentTime + 10));
  };

  const handleRestart = () => {
    seek(0);
  };

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 bg-black relative"
      >
        <canvas
          ref={canvasRef}
          width={854}
          height={480}
          onClick={handleCanvasClick}
          className="max-w-full max-h-full border border-[#3e3e3e] cursor-pointer"
          style={{ aspectRatio: '16/9' }}
        />

        {/* Overlay controls */}
        <div className="absolute top-3 left-3 flex gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-black/50 hover:bg-black/70 rounded text-white/70 hover:text-white transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 bg-black/50 hover:bg-black/70 rounded text-white/70 hover:text-white transition-colors"
            title="Canvas Settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overlay info */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/50 rounded px-2 py-1">
          <Film className="w-3 h-3 text-[#a0a0a0]" />
          <span className="text-[10px] text-[#a0a0a0]">854 x 480</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="h-14 bg-[#252525] border-t border-[#3e3e3e] flex items-center px-4 gap-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlayback}
          className="p-2 text-white hover:bg-[#3e3e3e] rounded-full transition-colors"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" fill="white" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" fill="white" />
          )}
        </button>

        {/* Skip controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRestart}
            className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSkipBackward}
            className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
            title="Skip Back 10s"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handleSkipForward}
            className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
            title="Skip Forward 10s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timecode */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-amber-400">{formatTime(currentTime)}</span>
          <span className="text-[#a0a0a0]">/</span>
          <span className="text-[#a0a0a0]">{formatTime(totalDuration)}</span>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.01}
            value={currentTime}
            onChange={handleTimelineSeek}
            className="w-full h-1.5 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
          />
        </div>

        {/* Speed Control */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-2 py-1 text-[11px] text-[#a0a0a0] hover:text-white bg-[#1e1e1e] rounded border border-[#3e3e3e] transition-colors"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-20 bg-[#2d2d2d] border border-[#3e3e3e] rounded shadow-xl z-50 py-1">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                  className={`w-full px-3 py-1 text-xs text-left transition-colors ${
                    playbackSpeed === s
                      ? 'text-amber-400 bg-[#3e3e3e]'
                      : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="p-1.5 text-[#a0a0a0] hover:text-white transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-20 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>
    </div>
  );
}
