import React, { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { scopeAnalyzer, ScopeData } from '@/utils/scopeAnalyzer';

export function ScopesPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  
  const scopeSettings = useEditorStore((state) => state.scopeSettings);
  const setScopeSettings = useEditorStore((state) => state.setScopeSettings);
  const previewCanvas = useEditorStore((state) => state.previewCanvas);
  
  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    data: ScopeData,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    
    const { waveform } = data;
    const maxBins = waveform.maxLuminance;
    const scale = maxBins > 0 ? height / maxBins : 0;
    
    // Draw grid
    if (scopeSettings.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i <= 4; i++) {
        const y = height - (i * height / 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Inter';
        ctx.fillText(`${i * 25} IRE`, 5, y - 3);
      }
    }
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(100, 100, 255, 0.9)');
    ctx.fillStyle = gradient;
    
    const binWidth = width / 256;
    
    for (let i = 0; i < 256; i++) {
      const binHeight = waveform.luminance[i] * scale;
      if (binHeight > 0) {
        const x = i * binWidth;
        const y = height - binHeight;
        ctx.fillRect(x, y, Math.max(1, binWidth - 0.5), binHeight);
      }
    }
    
    if (scopeSettings.showLimits) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      
      const y100 = height * 0.0;
      ctx.beginPath();
      ctx.moveTo(0, y100);
      ctx.lineTo(width, y100);
      ctx.stroke();
      
      const y0 = height * 1.0;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(width, y0);
      ctx.stroke();
    }
  }, [scopeSettings.showGrid, scopeSettings.showLimits]);
  
  const drawVectorscope = useCallback((
    ctx: CanvasRenderingContext2D,
    data: ScopeData,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    
    // Draw color targets
    const colors = [
      { angle: 0, label: 'R', color: '#ff0000' },
      { angle: 60, label: 'M', color: '#ff00ff' },
      { angle: 120, label: 'B', color: '#0000ff' },
      { angle: 180, label: 'C', color: '#00ffff' },
      { angle: 240, label: 'G', color: '#00ff00' },
      { angle: 300, label: 'Y', color: '#ffff00' },
    ];
    
    colors.forEach(({ angle, label, color }) => {
      const rad = (angle - 90) * Math.PI / 180;
      const x = centerX + Math.cos(rad) * radius;
      const y = centerY + Math.sin(rad) * radius;
      
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Inter';
      ctx.fillText(label, x - 6, y + 4);
    });
    
    if (scopeSettings.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      for (let r = radius / 4; r <= radius; r += radius / 4) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();
    }

    // Direct image data rendering for 256x256 vectorscope!
    // We scale it to fit the radius.
    // To do this efficiently, we create a temporary canvas to draw the 256x256 image data
    // Then we draw that canvas onto our main context, scaled and positioned.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 256;
    tempCanvas.height = 256;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(data.vectorscopeImageData, 0, 0);

    const scale = (radius * 2) / 256;
    ctx.save();
    ctx.translate(centerX - radius, centerY - radius);
    ctx.scale(scale, scale);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

  }, [scopeSettings.showGrid]);
  
  const drawRGBParade = useCallback((
    ctx: CanvasRenderingContext2D,
    data: ScopeData,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    
    const { waveform } = data;
    const channelHeight = height / 3;
    const maxBins = waveform.maxRGB;
    const scale = maxBins > 0 ? channelHeight / maxBins : 0;
    const binWidth = width / 256;
    
    const channels = [
      { data: waveform.r, color: 'rgba(255, 0, 0, 0.8)', offset: 0 },
      { data: waveform.g, color: 'rgba(0, 255, 0, 0.8)', offset: channelHeight },
      { data: waveform.b, color: 'rgba(0, 0, 255, 0.8)', offset: channelHeight * 2 },
    ];
    
    channels.forEach(({ data, color, offset }) => {
      ctx.fillStyle = color;
      for (let i = 0; i < 256; i++) {
        const binHeight = data[i] * scale;
        if (binHeight > 0) {
          const x = i * binWidth;
          const y = offset + channelHeight - binHeight;
          ctx.fillRect(x, y, Math.max(1, binWidth - 0.5), binHeight);
        }
      }
    });

    if (scopeSettings.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * channelHeight);
        ctx.lineTo(width, i * channelHeight);
        ctx.stroke();
      }
    }
  }, [scopeSettings.showGrid]);
  
  const updateScopes = useCallback(() => {
    const canvas = canvasRef.current;
    
    if (!canvas || !previewCanvas || !scopeSettings.enabled) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Throttle updates to ~30fps for performance
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 33) {
      animationFrameRef.current = requestAnimationFrame(updateScopes);
      return;
    }
    lastUpdateTimeRef.current = now;
    
    // Analyze current frame from composited preview canvas
    const data = scopeAnalyzer.analyzeCanvas(previewCanvas, scopeSettings.intensity / 100);
    
    // If analyzeCanvas returns null (e.g. tainted canvas), just schedule the next frame and skip drawing
    if (!data) {
      animationFrameRef.current = requestAnimationFrame(updateScopes);
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    
    switch (scopeSettings.type) {
      case 'waveform':
        drawWaveform(ctx, data, width, height);
        break;
      case 'vectorscope':
        drawVectorscope(ctx, data, width, height);
        break;
      case 'rgb-parade':
        drawRGBParade(ctx, data, width, height);
        break;
    }
    
    animationFrameRef.current = requestAnimationFrame(updateScopes);
  }, [scopeSettings, previewCanvas, drawWaveform, drawVectorscope, drawRGBParade]);
  
  useEffect(() => {
    if (scopeSettings.enabled) {
      animationFrameRef.current = requestAnimationFrame(updateScopes);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scopeSettings.enabled, updateScopes]);
  
  if (!scopeSettings.enabled) return null;
  
  const sizeMap = {
    small: { width: 256, height: 144 },
    medium: { width: 384, height: 216 },
    large: { width: 512, height: 288 },
  };
  
  const { width, height } = sizeMap[scopeSettings.size];
  
  return (
    <div 
      className={`absolute z-50 bg-background/95 border border-border rounded-lg shadow-2xl backdrop-blur-sm pointer-events-auto
        ${scopeSettings.position === 'top-left' ? 'top-16 left-4' : ''}
        ${scopeSettings.position === 'top-right' ? 'top-16 right-4' : ''}
        ${scopeSettings.position === 'bottom-left' ? 'bottom-16 left-4' : ''}
        ${scopeSettings.position === 'bottom-right' ? 'bottom-16 right-4' : ''}
      `}
      style={{ opacity: scopeSettings.opacity }}
    >
      <div className="p-2 border-b border-border flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setScopeSettings({ ...scopeSettings, type: 'waveform' })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              scopeSettings.type === 'waveform' ? 'bg-blue-600 text-white' : 'bg-accent text-muted-foreground hover:text-white'
            }`}
          >
            Waveform
          </button>
          <button
            onClick={() => setScopeSettings({ ...scopeSettings, type: 'vectorscope' })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              scopeSettings.type === 'vectorscope' ? 'bg-blue-600 text-white' : 'bg-accent text-muted-foreground hover:text-white'
            }`}
          >
            Vectorscope
          </button>
          <button
            onClick={() => setScopeSettings({ ...scopeSettings, type: 'rgb-parade' })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              scopeSettings.type === 'rgb-parade' ? 'bg-blue-600 text-white' : 'bg-accent text-muted-foreground hover:text-white'
            }`}
          >
            RGB Parade
          </button>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <select 
            value={scopeSettings.size}
            onChange={(e) => setScopeSettings({ ...scopeSettings, size: e.target.value as any })}
            className="bg-secondary text-xs text-muted-foreground rounded border-none outline-none py-0.5 px-1"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          <button 
            onClick={() => setScopeSettings({ ...scopeSettings, enabled: false })}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            ×
          </button>
        </div>
      </div>
      <div className="p-2">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded bg-black w-full h-full"
        />
      </div>
    </div>
  );
}
