import React, { useRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface WaveformViewerProps {
  audioUrl: string;
  trimOffset: number;
  trimDuration: number;
  totalDuration: number;
  onChange: (offset: number, duration: number) => void;
}

export function WaveformViewer({ audioUrl, trimOffset, trimDuration, totalDuration, onChange }: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<Float32Array | null>(null);
  const [error, setError] = useState(false);

  // Drag state
  const isDragging = useRef<'start' | 'end' | 'body' | null>(null);
  const startX = useRef(0);
  const initialOffset = useRef(trimOffset);
  const initialDur = useRef(trimDuration);

  useEffect(() => {
    let active = true;
    const fetchAudio = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(audioUrl);
        const arrayBuffer = await res.arrayBuffer();
        const ctx = new window.AudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (active) {
          setChannelData(audioBuffer.getChannelData(0));
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };
    if (audioUrl) {
      fetchAudio();
    }
    return () => { active = false; };
  }, [audioUrl]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !channelData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match container
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }, [channelData]);

  const pxToSec = (px: number) => {
    if (!containerRef.current) return 0;
    return (px / containerRef.current.clientWidth) * totalDuration;
  };

  const handleMouseDown = (e: React.MouseEvent, part: 'start' | 'end' | 'body') => {
    e.stopPropagation();
    isDragging.current = part;
    startX.current = e.clientX;
    initialOffset.current = trimOffset;
    initialDur.current = trimDuration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = moveEvent.clientX - startX.current;
      const dSec = pxToSec(dx);

      let newOffset = initialOffset.current;
      let newDur = initialDur.current;

      if (isDragging.current === 'body') {
        newOffset += dSec;
        if (newOffset < 0) newOffset = 0;
        if (newOffset + newDur > totalDuration) newOffset = totalDuration - newDur;
      } else if (isDragging.current === 'start') {
        newOffset += dSec;
        newDur -= dSec;
        if (newOffset < 0) {
          newDur += newOffset;
          newOffset = 0;
        }
        if (newDur < 0.1) {
          newDur = 0.1;
          newOffset = initialOffset.current + initialDur.current - 0.1;
        }
      } else if (isDragging.current === 'end') {
        newDur += dSec;
        if (newOffset + newDur > totalDuration) {
          newDur = totalDuration - newOffset;
        }
        if (newDur < 0.1) newDur = 0.1;
      }

      onChange(newOffset, newDur);
    };

    const handleMouseUp = () => {
      isDragging.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (loading) {
    return (
      <div className="h-12 w-full flex items-center justify-center bg-gray-800/50 rounded-md border border-gray-700/50 mt-2">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-12 w-full flex items-center justify-center bg-gray-800/50 text-xs text-red-400 rounded-md border border-red-900/50 mt-2">
        Failed to load waveform
      </div>
    );
  }

  const leftPct = (trimOffset / totalDuration) * 100;
  const widthPct = (trimDuration / totalDuration) * 100;

  return (
    <div className="relative h-12 w-full bg-gray-900 rounded-md overflow-hidden mt-2" ref={containerRef}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      
      {/* Dimmed unselected areas */}
      <div className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none" style={{ width: `\${leftPct}%` }} />
      <div className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none" style={{ width: `\${100 - (leftPct + widthPct)}%` }} />
      
      {/* Selection Window */}
      <div 
        className="absolute top-0 bottom-0 border-2 border-yellow-500/80 bg-yellow-500/10 cursor-grab active:cursor-grabbing hover:bg-yellow-500/20 transition-colors"
        style={{ left: `\${leftPct}%`, width: `\${widthPct}%` }}
        onMouseDown={(e) => handleMouseDown(e, 'body')}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-yellow-400/50 -translate-x-1/2" 
          onMouseDown={(e) => handleMouseDown(e, 'start')} 
        />
        <div 
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-yellow-400/50 translate-x-1/2" 
          onMouseDown={(e) => handleMouseDown(e, 'end')} 
        />
      </div>
    </div>
  );
}
