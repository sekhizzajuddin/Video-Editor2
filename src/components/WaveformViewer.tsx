import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';

// Pre-computed peaks for performance
interface WaveformPeaks {
  min: Float32Array;
  max: Float32Array;
  length: number;
  duration: number;
  sampleRate: number;
}

interface WaveformViewerProps {
  audioUrl: string;
  trimOffset: number;
  trimDuration: number;
  totalDuration: number;
  currentTime?: number; // Playhead position
  beatMarkers?: number[]; // Beat timestamps from BeatDetector
  zoomLevel?: number; // 1 = full, 10 = max zoom
  onChange: (offset: number, duration: number) => void;
  onSeek?: (time: number) => void; // Click to seek
}

// AudioContext singleton to prevent leaks
let sharedAudioContext: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
};

export function WaveformViewer({
  audioUrl,
  trimOffset,
  trimDuration,
  totalDuration,
  currentTime = 0,
  beatMarkers = [],
  zoomLevel: propZoomLevel = 1,
  onChange,
  onSeek
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localZoom, setLocalZoom] = useState(propZoomLevel);

  const zoomLevel = useMemo(() => Math.max(1, localZoom), [localZoom]);

  // Drag state refs
  const dragState = useRef<{
    type: 'start' | 'end' | 'body';
    startX: number;
    initialOffset: number;
    initialDur: number;
    containerWidth: number;
  } | null>(null);

  // ============================================
  // 1. AUDIO DECODING WITH PROGRESS & CLEANUP
  // ============================================
  useEffect(() => {
    let aborted = false;
    const ctx = getAudioContext();

    const fetchAudio = async () => {
      setLoading(true);
      setError(null);
      setLoadProgress(0);

      try {
        // Fetch with progress tracking
        const response = await fetch(audioUrl);
        const contentLength = +(response.headers.get('content-length') || 0);
        const reader = response.body?.getReader();

        if (!reader) throw new Error('ReadableStream not supported');

        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (aborted) {
            reader.cancel();
            return;
          }

          chunks.push(value);
          received += value.length;
          if (contentLength) {
            setLoadProgress(received / contentLength);
          }
        }

        // Combine chunks
        const allChunks = new Uint8Array(received);
        let position = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }

        // Decode audio
        const audioBuffer = await ctx.decodeAudioData(allChunks.buffer);

        if (aborted) return;

        // Compute peaks (downsample for performance)
        const channelData = audioBuffer.getChannelData(0);
        const peakCount = Math.min(3000, Math.ceil(channelData.length / 256)); // Max 3000 bars
        const step = Math.floor(channelData.length / peakCount);

        const minPeaks = new Float32Array(peakCount);
        const maxPeaks = new Float32Array(peakCount);

        for (let i = 0; i < peakCount; i++) {
          let min = 1.0;
          let max = -1.0;
          const start = i * step;
          const end = Math.min(start + step, channelData.length);

          for (let j = start; j < end; j++) {
            const val = channelData[j];
            if (val < min) min = val;
            if (val > max) max = val;
          }

          minPeaks[i] = min;
          maxPeaks[i] = max;
        }

        setPeaks({
          min: minPeaks,
          max: maxPeaks,
          length: peakCount,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate
        });
      } catch (err) {
        if (!aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load audio');
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    if (audioUrl) fetchAudio();

    return () => {
      aborted = true;
    };
  }, [audioUrl]);

  // ============================================
  // 2. RESPONSIVE CANVAS WITH RESIZE OBSERVER
  // ============================================
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      drawWaveform();
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [peaks, trimOffset, trimDuration, totalDuration, currentTime, hoverTime, beatMarkers, zoomLevel]);

  // ============================================
  // 3. HIGH-PERFORMANCE RENDERING
  // ============================================
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !peaks) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.width / dpr;
    const cssHeight = canvas.height / dpr;

    // Reset transform cleanly — prevents DPR scale from accumulating each redraw
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Calculate visible window based on zoom
    const zoomOffset = trimOffset * (1 - 1 / zoomLevel);
    const visibleDuration = totalDuration / zoomLevel;
    const visibleStart = Math.max(0, zoomOffset);
    const visibleEnd = Math.min(totalDuration, visibleStart + visibleDuration);

    const amp = cssHeight / 2; // vertical center
    const maxHalf = amp * 0.88; // 12% padding from top/bottom edges

    // DaVinci style: solid fill, 1px columns, zero gap
    ctx.fillStyle = 'rgba(66, 153, 225, 0.88)';

    for (let i = 0; i < peaks.length; i++) {
      const peakTime = (i / peaks.length) * peaks.duration;
      if (peakTime < visibleStart || peakTime > visibleEnd) continue;
      const x = ((peakTime - visibleStart) / visibleDuration) * cssWidth;

      // Use real min/max for true asymmetric waveform (like DaVinci)
      // Apply noise thresholding so background hiss collapses to 0
      let minVal = peaks.min[i];
      let maxVal = peaks.max[i];
      if (Math.abs(minVal) < 0.025) minVal = 0;
      if (Math.abs(maxVal) < 0.025) maxVal = 0;

      const topY = amp - maxVal * maxHalf;
      const botY = amp - minVal * maxHalf; // minVal is negative → botY > amp
      const barH = botY - topY;
      if (barH < 0.5) continue; // true silence = nothing
      ctx.fillRect(Math.round(x), topY, 1, barH);
    }

    // Center baseline — where silence collapses to
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, amp - 0.5, cssWidth, 1);

    // ============================================
    // 4. BEAT MARKERS
    // ============================================
    if (beatMarkers.length > 0) {
      ctx.strokeStyle = 'rgba(245, 101, 101, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      for (const beatTime of beatMarkers) {
        if (beatTime < visibleStart || beatTime > visibleEnd) continue;
        const x = ((beatTime - visibleStart) / visibleDuration) * cssWidth;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // ============================================
    // 5. TIME LABELS & GRID
    // ============================================
    ctx.fillStyle = '#A0AEC0';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';

    const timeStep = visibleDuration > 10 ? 2 : visibleDuration > 5 ? 1 : 0.5;
    for (let t = Math.ceil(visibleStart / timeStep) * timeStep; t <= visibleEnd; t += timeStep) {
      const x = ((t - visibleStart) / visibleDuration) * cssWidth;
      ctx.fillText(t.toFixed(1) + 's', x, cssHeight - 4);

      // Subtle grid line
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssHeight - 14);
      ctx.stroke();
    }

    // ============================================
    // 6. PLAYHEAD
    // ============================================
    if (currentTime >= visibleStart && currentTime <= visibleEnd) {
      const playX = ((currentTime - visibleStart) / visibleDuration) * cssWidth;

      ctx.strokeStyle = '#48BB78';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, cssHeight);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = '#48BB78';
      ctx.beginPath();
      ctx.moveTo(playX - 4, 0);
      ctx.lineTo(playX + 4, 0);
      ctx.lineTo(playX, 6);
      ctx.closePath();
      ctx.fill();
    }

    // ============================================
    // 7. HOVER TOOLTIP
    // ============================================
    if (hoverTime !== null && hoverTime >= visibleStart && hoverTime <= visibleEnd) {
      const hoverX = ((hoverTime - visibleStart) / visibleDuration) * cssWidth;

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, cssHeight);
      ctx.stroke();

      // Time tooltip
      const text = hoverTime.toFixed(2) + 's';
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(hoverX - textWidth / 2 - 4, 2, textWidth + 8, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, hoverX, 14);
    }

  }, [peaks, trimOffset, trimDuration, totalDuration, currentTime, hoverTime, beatMarkers, zoomLevel]);

  // Redraw on changes
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // ============================================
  // 8. IMPROVED DRAG HANDLING (Mouse + Touch)
  // ============================================
  const getTimeFromX = useCallback((clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return ratio * totalDuration;
  }, [totalDuration]);

  const handlePointerDown = useCallback((e: React.PointerEvent, part: 'start' | 'end' | 'body') => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragState.current = {
      type: part,
      startX: e.clientX,
      initialOffset: trimOffset,
      initialDur: trimDuration,
      containerWidth: containerRef.current?.clientWidth || 1
    };
    setIsDragging(true);
  }, [trimOffset, trimDuration]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Hover time update
    if (!isDragging) {
      setHoverTime(getTimeFromX(e.clientX));
      return;
    }

    if (!dragState.current) return;
    const { type, startX, initialOffset, initialDur, containerWidth } = dragState.current;

    const dxPx = e.clientX - startX;
    const dxSec = (dxPx / containerWidth) * totalDuration;

    let newOffset = initialOffset;
    let newDur = initialDur;

    const SNAP_THRESHOLD = 0.08; // seconds

    const snapToBeat = (time: number): number => {
      if (beatMarkers.length === 0) return time;
      const nearest = beatMarkers.reduce((closest, beat) =>
        Math.abs(beat - time) < Math.abs(closest - time) ? beat : closest
      );
      return Math.abs(nearest - time) < SNAP_THRESHOLD ? nearest : time;
    };

    switch (type) {
      case 'body': {
        newOffset = snapToBeat(initialOffset + dxSec);
        newOffset = Math.max(0, Math.min(totalDuration - newDur, newOffset));
        break;
      }
      case 'start': {
        const proposedOffset = snapToBeat(initialOffset + dxSec);
        const maxOffset = initialOffset + initialDur - 0.1;
        newOffset = Math.min(proposedOffset, maxOffset);
        newOffset = Math.max(0, newOffset);
        newDur = initialOffset + initialDur - newOffset;
        break;
      }
      case 'end': {
        const proposedEnd = snapToBeat(initialOffset + initialDur + dxSec);
        newDur = proposedEnd - initialOffset;
        newDur = Math.max(0.1, Math.min(totalDuration - newOffset, newDur));
        break;
      }
    }

    onChange(newOffset, newDur);
  }, [isDragging, totalDuration, beatMarkers, onChange, getTimeFromX]);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    setIsDragging(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    const time = getTimeFromX(e.clientX);
    onSeek?.(Math.max(0, Math.min(totalDuration, time)));
  }, [isDragging, getTimeFromX, onSeek, totalDuration]);

  // ============================================
  // 9. KEYBOARD SHORTCUTS
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      const step = e.shiftKey ? 0.5 : 0.05; // Fine/Coarse adjust

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          onChange(Math.max(0, trimOffset - step), trimDuration);
          break;
        case 'ArrowRight':
          e.preventDefault();
          onChange(Math.min(totalDuration - trimDuration, trimOffset + step), trimDuration);
          break;
        case '[': // Trim start in
          e.preventDefault();
          onChange(trimOffset, Math.max(0.1, trimDuration - step));
          break;
        case ']': // Trim start out
          e.preventDefault();
          onChange(trimOffset, Math.min(totalDuration - trimOffset, trimDuration + step));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trimOffset, trimDuration, totalDuration, onChange]);

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="h-16 w-full flex flex-col items-center justify-center bg-gray-800/50 rounded-md border border-gray-700/50 mt-2">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin mb-1" />
        <span className="text-xs text-gray-500">
          Analyzing audio... {Math.round(loadProgress * 100)}%
        </span>
        <div className="w-32 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${loadProgress * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-16 w-full flex items-center justify-center bg-gray-800/50 text-xs text-red-400 rounded-md border border-red-900/50 mt-2">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  const leftPct = (trimOffset / totalDuration) * 100;
  const widthPct = (trimDuration / totalDuration) * 100;

  return (
    <div className="relative mt-2 select-none" role="region" aria-label="Audio waveform trimmer">
      {/* Zoom Controls */}
      <div className="absolute -top-6 right-0 flex gap-1 z-10">
        <button
          className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          onClick={() => setLocalZoom(z => Math.min(10, z + 1))}
          aria-label="Zoom in"
        >
          <ZoomIn className="w-3 h-3" />
        </button>
        <button
          className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          onClick={() => setLocalZoom(z => Math.max(1, z - 1))}
          aria-label="Zoom out"
        >
          <ZoomOut className="w-3 h-3" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative h-16 w-full bg-gray-900 rounded-md overflow-hidden cursor-crosshair focus:outline-none focus:ring-2 focus:ring-blue-500"
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            handleClick(e as any);
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseLeave={() => setHoverTime(null)}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Dimmed unselected areas */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none"
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none"
          style={{ width: `${100 - (leftPct + widthPct)}%` }}
        />

        {/* Selection Window */}
        <div
          className="absolute top-0 bottom-0 border-2 border-yellow-500/80 bg-yellow-500/10 cursor-grab active:cursor-grabbing hover:bg-yellow-500/20 transition-colors group"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          onPointerDown={(e) => handlePointerDown(e, 'body')}
        >
          {/* Start Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-yellow-400/60 -translate-x-1/2 flex items-center justify-center"
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, 'start');
            }}
          >
            <div className="w-0.5 h-4 bg-yellow-300 rounded-full" />
          </div>

          {/* End Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-yellow-400/60 translate-x-1/2 flex items-center justify-center"
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, 'end');
            }}
          >
            <div className="w-0.5 h-4 bg-yellow-300 rounded-full" />
          </div>

          {/* Duration Label */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-mono text-yellow-300 bg-black/50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {trimDuration.toFixed(2)}s
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1 font-mono">
        <span>Start: {trimOffset.toFixed(2)}s</span>
        <span>Dur: {trimDuration.toFixed(2)}s</span>
        <span>End: {(trimOffset + trimDuration).toFixed(2)}s</span>
      </div>
    </div>
  );
}
