import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, Settings2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

interface ColorScopesProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function ColorScopes({ canvasRef }: ColorScopesProps) {
  const { showScopes, setShowScopes, isPlaying } = useEditorStore(useShallow(s => ({ showScopes: s.showScopes, setShowScopes: s.setShowScopes, isPlaying: s.isPlaying })));
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeScope, setActiveScope] = useState<'vectorscope' | 'waveform' | 'parade' | 'all'>('all');
  
  const vscopeRef = useRef<HTMLCanvasElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const paradeRef = useRef<HTMLCanvasElement>(null);

  const requestRef = useRef<number>(0);

  const drawScopes = () => {
    if (!canvasRef.current || !showScopes) return;
    
    // Grab a small downsampled version of the canvas for performance
    const sourceCanvas = canvasRef.current;
    if (sourceCanvas.width === 0 || sourceCanvas.height === 0) return;

    // Downsample resolution for scopes (faster processing)
    const dsW = 256;
    const dsH = 144;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = dsW;
    offscreen.height = dsH;
    const oCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!oCtx) return;

    oCtx.drawImage(sourceCanvas, 0, 0, dsW, dsH);
    const imgData = oCtx.getImageData(0, 0, dsW, dsH);
    const data = imgData.data;

    if (activeScope === 'vectorscope' || activeScope === 'all') {
      drawVectorscope(data, dsW, dsH);
    }
    if (activeScope === 'waveform' || activeScope === 'all') {
      drawWaveform(data, dsW, dsH);
    }
    if (activeScope === 'parade' || activeScope === 'all') {
      drawParade(data, dsW, dsH);
    }

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(drawScopes);
    }
  };

  useEffect(() => {
    if (showScopes) {
      drawScopes(); // Draw immediately
      if (isPlaying) {
        requestRef.current = requestAnimationFrame(drawScopes);
      }
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [showScopes, isPlaying, activeScope]);

  // FIX C6: paused-state polling — was an unbounded 10Hz loop with no
  // visibility gate. Now pause-polling stops the moment the canvas is hidden
  // (e.g. user switches tab/panel away from the preview).
  useEffect(() => {
    if (!showScopes || isPlaying) return;

    const container = vscopeRef.current?.parentElement?.parentElement ?? null;
    let isVisible = true;
    let observer: IntersectionObserver | null = null;
    if (container && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => { isVisible = entry.isIntersecting; },
        { threshold: 0.01 }
      );
      observer.observe(container);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const poll = () => {
      if (stopped) return;
      if (isVisible) drawScopes();
      timer = setTimeout(poll, 100);
    };
    poll();

    const onVis = () => {
      if (!document.hidden && isVisible) drawScopes();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [showScopes, isPlaying, activeScope]);

  const drawVectorscope = (data: Uint8ClampedArray, w: number, h: number) => {
    const vCanvas = vscopeRef.current;
    if (!vCanvas) return;
    const ctx = vCanvas.getContext('2d');
    if (!ctx) return;

    const cw = vCanvas.width;
    const ch = vCanvas.height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, cw, ch);

    // Draw reticle
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch);
    ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();

    const scopeData = ctx.getImageData(0, 0, cw, ch);
    const sData = scopeData.data;

    const cx = cw / 2;
    const cy = ch / 2;
    const radius = Math.min(cw, ch) / 2 - 10;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const cb = -0.1687 * r - 0.3313 * g + 0.5 * b;
      const cr = 0.5 * r - 0.4187 * g - 0.0813 * b;

      const px = Math.round(cx + (cb / 128) * radius);
      const py = Math.round(cy - (cr / 128) * radius);

      if (px >= 0 && px < cw && py >= 0 && py < ch) {
        const idx = (py * cw + px) * 4;
        sData[idx] = Math.min(255, sData[idx] + 20); // R
        sData[idx + 1] = Math.min(255, sData[idx + 1] + 50); // G
        sData[idx + 2] = Math.min(255, sData[idx + 2] + 20); // B
        sData[idx + 3] = 255;
      }
    }
    ctx.putImageData(scopeData, 0, 0);
  };

  const drawWaveform = (data: Uint8ClampedArray, w: number, h: number) => {
    const vCanvas = waveRef.current;
    if (!vCanvas) return;
    const ctx = vCanvas.getContext('2d');
    if (!ctx) return;

    const cw = vCanvas.width;
    const ch = vCanvas.height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, cw, ch);
    
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, ch * 0.25); ctx.lineTo(cw, ch * 0.25);
    ctx.moveTo(0, ch * 0.5); ctx.lineTo(cw, ch * 0.5);
    ctx.moveTo(0, ch * 0.75); ctx.lineTo(cw, ch * 0.75);
    ctx.stroke();

    const scopeData = ctx.getImageData(0, 0, cw, ch);
    const sData = scopeData.data;

    for (let x = 0; x < w; x++) {
      const scopeX = Math.round((x / w) * cw);
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        const scopeY = Math.round(ch - (luma / 255) * ch);
        if (scopeY >= 0 && scopeY < ch && scopeX >= 0 && scopeX < cw) {
          const idx = (scopeY * cw + scopeX) * 4;
          sData[idx] = Math.min(255, sData[idx] + 20); // R
          sData[idx + 1] = Math.min(255, sData[idx + 1] + 40); // G
          sData[idx + 2] = Math.min(255, sData[idx + 2] + 20); // B
          sData[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(scopeData, 0, 0);
  };

  const drawParade = (data: Uint8ClampedArray, w: number, h: number) => {
    const vCanvas = paradeRef.current;
    if (!vCanvas) return;
    const ctx = vCanvas.getContext('2d');
    if (!ctx) return;

    const cw = vCanvas.width;
    const ch = vCanvas.height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, cw, ch);

    const scopeData = ctx.getImageData(0, 0, cw, ch);
    const sData = scopeData.data;
    const third = cw / 3;

    for (let x = 0; x < w; x++) {
      const mappedX = (x / w) * third;
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const yr = Math.round(ch - (r / 255) * ch);
        const yg = Math.round(ch - (g / 255) * ch);
        const yb = Math.round(ch - (b / 255) * ch);

        const xr = Math.round(mappedX);
        const xg = Math.round(mappedX + third);
        const xb = Math.round(mappedX + 2 * third);

        if (yr >= 0 && yr < ch && xr >= 0 && xr < cw) {
          const idx = (yr * cw + xr) * 4;
          sData[idx] = Math.min(255, sData[idx] + 40);
          sData[idx + 3] = 255;
        }
        if (yg >= 0 && yg < ch && xg >= 0 && xg < cw) {
          const idx = (yg * cw + xg) * 4;
          sData[idx + 1] = Math.min(255, sData[idx + 1] + 40);
          sData[idx + 3] = 255;
        }
        if (yb >= 0 && yb < ch && xb >= 0 && xb < cw) {
          const idx = (yb * cw + xb) * 4;
          sData[idx + 2] = Math.min(255, sData[idx + 2] + 40);
          sData[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(scopeData, 0, 0);
  };

  if (!showScopes) return null;

  return (
    <div 
      className={`absolute top-4 left-4 z-50 bg-[#1e1e1e]/95 backdrop-blur border border-[#3e3e3e] rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'w-[800px] h-[500px]' : 'w-[320px] h-[400px]'}`}
    >
      {/* Header */}
      <div className="h-10 bg-[#252525] border-b border-[#3e3e3e] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Settings2 className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium">Color Scopes</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => setShowScopes(false)}
            className="p-1.5 hover:bg-red-500/20 rounded text-[#a0a0a0] hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!isExpanded && (
        <div className="flex border-b border-[#3e3e3e] shrink-0">
          {(['all', 'vectorscope', 'waveform', 'parade'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveScope(tab)}
              className={`flex-1 py-1.5 text-[10px] uppercase font-semibold transition-colors ${
                activeScope === tab ? 'bg-amber-500/10 text-amber-500 border-b-2 border-amber-500' : 'text-[#a0a0a0] hover:text-[#d0d0d0]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Scopes Area */}
      <div className={`flex-1 p-2 gap-2 overflow-hidden ${isExpanded ? 'flex flex-row' : 'flex flex-col'}`}>
        
        {(activeScope === 'vectorscope' || activeScope === 'all') && (
          <div className="flex-1 flex flex-col bg-black rounded border border-[#3e3e3e] overflow-hidden">
            <div className="text-[10px] text-[#a0a0a0] px-2 py-1 bg-[#1a1a1a] border-b border-[#2a2a2a] shrink-0">Vectorscope (Cb/Cr)</div>
            <div className="flex-1 relative flex items-center justify-center p-2">
              <canvas ref={vscopeRef} width={200} height={200} className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        )}

        {(activeScope === 'waveform' || activeScope === 'all') && (
          <div className="flex-1 flex flex-col bg-black rounded border border-[#3e3e3e] overflow-hidden">
            <div className="text-[10px] text-[#a0a0a0] px-2 py-1 bg-[#1a1a1a] border-b border-[#2a2a2a] shrink-0">Luma Waveform</div>
            <div className="flex-1 relative flex items-center justify-center p-2">
              <canvas ref={waveRef} width={256} height={144} className="max-w-full max-h-full object-contain w-full" />
            </div>
          </div>
        )}

        {(activeScope === 'parade' || activeScope === 'all') && (
          <div className="flex-1 flex flex-col bg-black rounded border border-[#3e3e3e] overflow-hidden">
            <div className="text-[10px] text-[#a0a0a0] px-2 py-1 bg-[#1a1a1a] border-b border-[#2a2a2a] shrink-0 flex justify-between">
              <span>RGB Parade</span>
              <span className="flex gap-4">
                <span className="text-red-400">R</span>
                <span className="text-green-400">G</span>
                <span className="text-blue-400">B</span>
              </span>
            </div>
            <div className="flex-1 relative flex items-center justify-center p-2">
              <canvas ref={paradeRef} width={256} height={144} className="max-w-full max-h-full object-contain w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
