import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, FastForward, Rewind, Maximize2, Type } from 'lucide-react';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TeleprompterModal({ isOpen, onClose }: TeleprompterModalProps) {
  const [script, setScript] = useState('Enter your script here...');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // pixels per frame
  const [fontSize, setFontSize] = useState(48);
  const [mirror, setMirror] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isPlaying) {
      const scroll = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += speed;
        }
        animationRef.current = requestAnimationFrame(scroll);
      };
      animationRef.current = requestAnimationFrame(scroll);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, speed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col backdrop-blur-md">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h2 className="text-foreground font-semibold uppercase tracking-wider text-sm flex items-center gap-2">
            <Type className="w-4 h-4 text-emerald-400" />
            Teleprompter
          </h2>
          
          <div className="w-px h-6 bg-accent" />
          
          {/* Controls */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-1.5 rounded font-semibold text-xs flex items-center gap-2 transition-colors ${isPlaying ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-black'}`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'PAUSE' : 'START SCROLL'}
          </button>

          <div className="flex items-center gap-2 bg-secondary p-1 rounded border border-border">
            <button onClick={() => setSpeed(Math.max(0.5, speed - 0.5))} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"><Rewind className="w-4 h-4" /></button>
            <span className="text-xs text-foreground w-12 text-center">Spd {speed}x</span>
            <button onClick={() => setSpeed(speed + 0.5)} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"><FastForward className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-2 bg-secondary p-1 rounded border border-border">
            <span className="text-xs text-muted-foreground pl-2">Size</span>
            <input 
              type="range" 
              min="24" max="120" 
              value={fontSize} 
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-24 accent-emerald-500"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer ml-2">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="accent-emerald-500" />
            Mirror Text
          </label>
        </div>

        <button onClick={onClose} className="p-2 bg-secondary hover:bg-red-500 hover:text-white rounded text-muted-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black p-8">
        <div 
          className={`w-full max-w-4xl h-full overflow-y-auto ${mirror ? 'scale-x-[-1]' : ''}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide scrollbar
          ref={scrollRef}
        >
          {isPlaying ? (
            <div 
              className="w-full min-h-[200vh] whitespace-pre-wrap text-center font-bold text-foreground leading-relaxed pb-[80vh] pt-[40vh]"
              style={{ fontSize: `${fontSize}px` }}
            >
              {script}
            </div>
          ) : (
            <textarea
              className="w-full h-full bg-transparent text-foreground font-bold text-center resize-none focus:outline-none placeholder:text-[#3e3e3e]"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your script here..."
            />
          )}
        </div>
      </div>

      {/* Eye line indicator */}
      {isPlaying && (
        <div className="absolute top-[40%] left-0 w-full h-px bg-red-500/50 pointer-events-none flex items-center justify-between px-4">
          <span className="text-red-500 text-[10px] font-bold">EYE LINE</span>
          <span className="text-red-500 text-[10px] font-bold">EYE LINE</span>
        </div>
      )}
      
      {/* Hide scrollbar styles hack */}
      <style>{`
        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
