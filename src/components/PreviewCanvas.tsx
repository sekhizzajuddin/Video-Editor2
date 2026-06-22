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
  RotateCcw,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { formatTime } from '@/utils/time';
import { useRef, useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Image cache – shared across renders, keyed by mediaId.
// Each entry holds the HTMLImageElement (or a loading promise so we don't
// kick off duplicate loads).
// ---------------------------------------------------------------------------
const imageCache = new Map<string, HTMLImageElement>();
const imageLoading = new Set<string>();

function getCachedImage(
  mediaId: string,
  url: string,
  onLoad: () => void,
): HTMLImageElement | null {
  const cached = imageCache.get(mediaId);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;

  // Already loading – wait for the existing load to resolve
  if (imageLoading.has(mediaId)) return null;

  imageLoading.add(mediaId);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    imageCache.set(mediaId, img);
    imageLoading.delete(mediaId);
    onLoad(); // trigger a re-render / re-draw
  };
  img.onerror = () => {
    imageLoading.delete(mediaId);
  };
  img.src = url;
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
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
    mediaLibrary,
  } = useEditorStore();

  // Real video elements for drawing frames
  const videoElements = useMediaPlayback();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // A counter we bump to force re-render when an image finishes loading
  const [imageRevision, setImageRevision] = useState(0);
  const requestRedraw = useCallback(() => setImageRevision((r) => r + 1), []);

  // -------------------------------------------------------------------
  // Playback loop – advance currentTime via rAF when playing
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Canvas rendering – called whenever time, tracks, or images change
  // -------------------------------------------------------------------
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width; // 854
    const H = canvas.height; // 480

    // 1. Clear to dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // 2. Checkerboard for transparent areas
    ctx.fillStyle = '#141414';
    const gridSize = 16;
    for (let x = 0; x < W; x += gridSize) {
      for (let y = 0; y < H; y += gridSize) {
        if (((x / gridSize) + (y / gridSize)) % 2 === 0) {
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }
    }

    // 3. Collect video tracks sorted bottom-to-top (V1 draws first)
    const videoTracks = tracks
      .filter((t) => t.type === 'video' && !t.hidden)
      .sort((a, b) => {
        // v1, v2, v3 … – parse the numeric suffix for ordering
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return numA - numB; // lower number drawn first (bottom layer)
      });

    let anyClipDrawn = false;

    for (const track of videoTracks) {
      // Find the clip active at currentTime on this track
      const clip = track.clips.find(
        (c) =>
          currentTime >= c.startTime && currentTime < c.startTime + c.duration,
      );
      if (!clip) continue;

      const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
      if (!mediaItem) continue;

      // Compute the media-local time for this clip
      const _mediaTime = currentTime - clip.startTime + clip.trimStart;

      // Set up transform
      ctx.save();
      ctx.globalAlpha = clip.opacity;

      const cx = W / 2;
      const cy = H / 2;
      ctx.translate(cx + clip.transform.x, cy + clip.transform.y);
      ctx.scale(clip.transform.scale / 100, clip.transform.scale / 100);
      ctx.rotate((clip.transform.rotation * Math.PI) / 180);

      // ---------------------------------------------------------------
      // Draw the actual media content
      // ---------------------------------------------------------------
      if (mediaItem.type === 'video') {
        const videoEl = videoElements.get(mediaItem.id);
        if (videoEl && videoEl.readyState >= 2) {
          // readyState >= HAVE_CURRENT_DATA
          // Fit the video into the canvas while preserving aspect ratio
          const vw = videoEl.videoWidth || W;
          const vh = videoEl.videoHeight || H;
          const scale = Math.min(W / vw, H / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          ctx.drawImage(videoEl, -dw / 2, -dh / 2, dw, dh);
          anyClipDrawn = true;
        } else {
          // Video not ready yet – draw placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'VIDEO', '#3b82f6');
          anyClipDrawn = true;
        }
      } else if (mediaItem.type === 'image') {
        const img = getCachedImage(mediaItem.id, mediaItem.url, requestRedraw);
        if (img) {
          const iw = img.naturalWidth || W;
          const ih = img.naturalHeight || H;
          const scale = Math.min(W / iw, H / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          anyClipDrawn = true;
        } else {
          // Image still loading – placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'IMAGE', '#f59e0b');
          anyClipDrawn = true;
        }
      }

      ctx.restore();
    }

    // 4. Empty state
    if (!anyClipDrawn) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No clip at current position', W / 2, H / 2 - 10);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Add clips to the timeline to preview', W / 2, H / 2 + 12);
    }

    // 5. Timecode overlay – top-right
    ctx.globalAlpha = 1;
    const tcText = formatTime(currentTime);
    ctx.font = 'bold 12px monospace';
    const tcMetrics = ctx.measureText(tcText);
    const tcPadX = 8;
    const tcPadY = 4;
    const tcW = tcMetrics.width + tcPadX * 2;
    const tcH = 20;
    const tcX = W - tcW - 8;
    const tcY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(tcX, tcY, tcW, tcH, 4);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(tcText, W - 8 - tcPadX, tcY + tcH / 2);
  }, [currentTime, tracks, selectedClipId, mediaLibrary, videoElements, imageRevision, requestRedraw]);

  // Kick off render whenever dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // During playback, also schedule continuous redraws so video frames update
  useEffect(() => {
    if (!isPlaying) return;
    let id: number;
    const draw = () => {
      renderCanvas();
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, renderCanvas]);

  // -------------------------------------------------------------------
  // Interaction handlers
  // -------------------------------------------------------------------
  const handleCanvasClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    // Select the topmost clip at current time
    for (let i = tracks.length - 1; i >= 0; i--) {
      const track = tracks[i];
      if (track.hidden || track.type !== 'video') continue;
      for (const clip of track.clips) {
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          selectClip(clip.id);
          return;
        }
      }
    }
  };

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleSkipBackward = () => seek(Math.max(0, currentTime - 10));
  const handleSkipForward = () => seek(Math.min(totalDuration, currentTime + 10));
  const handleRestart = () => seek(0);

  const handleToggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen exit via Esc
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // Close speed menu when clicking elsewhere
  useEffect(() => {
    if (!showSpeedMenu) return;
    const close = () => setShowSpeedMenu(false);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [showSpeedMenu]);

  // -------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 bg-black relative overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={854}
          height={480}
          onClick={handleCanvasClick}
          className="max-w-full max-h-full border border-[#3e3e3e] cursor-pointer"
          style={{ aspectRatio: '16/9' }}
        />

        {/* Overlay: fullscreen + settings (top-left) */}
        <div className="absolute top-3 left-3 flex gap-2">
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 bg-black/50 hover:bg-black/70 rounded text-white/70 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
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

        {/* Overlay: resolution info (bottom-right) */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/50 rounded px-2 py-1">
          <Film className="w-3 h-3 text-[#a0a0a0]" />
          <span className="text-[10px] text-[#a0a0a0]">854 × 480</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="h-14 bg-[#252525] border-t border-[#3e3e3e] flex items-center px-4 gap-3">
        {/* Play / Pause */}
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
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu(!showSpeedMenu);
            }}
            className="px-2 py-1 text-[11px] text-[#a0a0a0] hover:text-white bg-[#1e1e1e] rounded border border-[#3e3e3e] transition-colors"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-20 bg-[#2d2d2d] border border-[#3e3e3e] rounded shadow-xl z-50 py-1">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaybackSpeed(s);
                    setShowSpeedMenu(false);
                  }}
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

// ---------------------------------------------------------------------------
// Helper: draw a styled placeholder when the real media isn't ready yet
// ---------------------------------------------------------------------------
function drawMediaPlaceholder(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  name: string,
  typeLabel: string,
  accentColor: string,
) {
  const pw = W * 0.6;
  const ph = H * 0.5;
  const px = -pw / 2;
  const py = -ph / 2;

  // Background
  ctx.fillStyle = accentColor + '18'; // very faint tint
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 8);
  ctx.fill();

  // Border
  ctx.strokeStyle = accentColor + '60';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 8);
  ctx.stroke();

  // Type label
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(typeLabel, 0, -8);

  // File name
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px system-ui, sans-serif';
  const truncated = name.length > 30 ? name.slice(0, 27) + '…' : name;
  ctx.fillText(truncated, 0, 12);

  // Loading dots
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('Loading…', 0, 28);
}
