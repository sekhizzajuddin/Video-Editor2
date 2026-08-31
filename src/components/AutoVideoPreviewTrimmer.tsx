import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Scissors } from 'lucide-react';

interface AutoVideoPreviewTrimmerProps {
  url: string;
  type: 'video' | 'image' | 'audio';
  duration: number;
  onTrimChange: (start: number, end: number) => void;
}

export const AutoVideoPreviewTrimmer: React.FC<AutoVideoPreviewTrimmerProps> = ({ url, type, duration, onTrimChange }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);

  useEffect(() => {
    setTrimEnd(duration);
  }, [duration]);

  const togglePlay = () => {
    if (mediaRef.current) {
      if (isPlaying) mediaRef.current.pause();
      else mediaRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
      if (mediaRef.current.currentTime >= trimEnd) {
        mediaRef.current.pause();
        mediaRef.current.currentTime = trimStart;
        setIsPlaying(false);
      }
    }
  };

  if (type === 'image') {
    return (
      <div className="flex flex-col gap-2">
        <div className="w-full aspect-video bg-black rounded overflow-hidden flex items-center justify-center">
          <img src={url} alt="preview" crossOrigin="anonymous" className="max-w-full max-h-full object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full aspect-video bg-black rounded overflow-hidden group">
        {type === 'video' ? (
          <video 
            ref={mediaRef as React.RefObject<HTMLVideoElement>} 
            src={url} 
            crossOrigin="anonymous"
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <audio 
            ref={mediaRef as React.RefObject<HTMLAudioElement>} 
            src={url}
            crossOrigin="anonymous"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />
        )}
        <button 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isPlaying ? <Pause className="w-12 h-12 text-foreground" /> : <Play className="w-12 h-12 text-foreground fill-white" />}
        </button>
      </div>

      <div className="flex flex-col gap-1 bg-background p-2 rounded border border-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span className="flex items-center gap-1"><Scissors className="w-3 h-3" /> Trim</span>
          <span>{trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s</span>
        </div>
        
        {/* Simple Dual Range Slider for Trimming */}
        <div className="relative h-6 bg-background rounded overflow-hidden flex items-center px-2">
          {/* Mini Waveform Visualization (Mock) */}
          <div className="absolute inset-0 flex items-center gap-[1px] px-2 opacity-30">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="flex-1 bg-indigo-500 rounded-full" style={{ height: `${20 + Math.random() * 60}%` }} />
            ))}
          </div>

          <input 
            type="range" 
            min={0} 
            max={duration} 
            step={0.1}
            value={trimStart}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (val < trimEnd - 0.5) {
                setTrimStart(val);
                onTrimChange(val, trimEnd);
                if (mediaRef.current) mediaRef.current.currentTime = val;
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <input 
            type="range" 
            min={0} 
            max={duration} 
            step={0.1}
            value={trimEnd}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (val > trimStart + 0.5) {
                setTrimEnd(val);
                onTrimChange(trimStart, val);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 pointer-events-none"
            style={{ pointerEvents: 'auto' }}
          />

          {/* Active region highlight */}
          <div 
            className="absolute top-0 bottom-0 bg-indigo-500/30 border-x-2 border-indigo-500 z-0"
            style={{ 
              left: `${(trimStart / duration) * 100}%`,
              right: `${100 - (trimEnd / duration) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};
