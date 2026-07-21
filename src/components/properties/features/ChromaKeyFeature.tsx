import React, { useState, useEffect } from 'react';
import { Pipette, ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';


// Helper for hexToRgb
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 255, 0];
};

const CHROMA_KEY_PRESETS = [
  { name: 'Green', hex: '#00FF00' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Magenta', hex: '#FF00FF' },
  { name: 'Custom', hex: '#FFFFFF' },
];

export const ChromaKeyFeature = ({ clip }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPickingChromaColor, setIsPickingChromaColor] = useState(false);
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const chroma = clip.chromaKey;
  const isEnabled = chroma?.enabled ?? false;

  useEffect(() => {
    if (!isPickingChromaColor) return;
    
    // Note: the preview canvas must have id "preview-canvas" or be retrievable
    const canvas = useEditorStore.getState().previewCanvas;
    if (!canvas) {
      console.error("Preview canvas not found.");
      setIsPickingChromaColor(false);
      return;
    }

    canvas.style.cursor = 'crosshair';

    const handleMouseDown = (e: MouseEvent) => {
      let target = e.target as HTMLElement;
      let isOnCanvas = false;
      while (target) {
        if (target.tagName.toLowerCase() === 'canvas') {
          isOnCanvas = true;
          break;
        }
        target = target.parentElement as HTMLElement;
      }

      if (isOnCanvas) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          const existing = clip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
          updateClip(clip.id, {
            chromaKey: { ...existing, color: hex }
          });
          console.log(`Color picked: ${hex}`);
        }
      } else {
        console.log('Color picking cancelled');
      }
      setIsPickingChromaColor(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPickingChromaColor(false);
        console.log('Color picking cancelled');
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      canvas.style.cursor = '';
    };
  }, [isPickingChromaColor, clip.id, updateClip, clip.chromaKey]);

  const updateChroma = (patch: any) => {
    const existing = clip.chromaKey ?? { enabled: true, color: '#00ff00', threshold: 30, softness: 10 };
    updateClip(clip.id, { chromaKey: { ...existing, ...patch } });
  };

  const autoDetect = () => {
    console.log("Auto-detect applied.");
    updateChroma({ color: '#00FF00' }); // Stub for real logic
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium">Chroma Key / Green Screen</span>
          {isEnabled && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>}
        </div>
        <div className="flex items-center gap-2">
          <div
            onClick={e => { e.stopPropagation(); updateChroma({ enabled: !isEnabled }); useEditorStore.getState().saveSnapshot(); }}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] transition-colors"
          >
            <span className={isEnabled ? 'text-emerald-400' : 'text-[#a0a0a0]'}>{isEnabled ? 'Enabled' : 'Enable'}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
          <div className="space-y-1.5">
            <span className="text-[10px] text-[#a0a0a0] uppercase tracking-wider font-medium">Quick Presets</span>
            <div className="flex gap-1.5 flex-wrap">
              {CHROMA_KEY_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => updateChroma({ color: preset.hex })}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] transition-colors ${
                    chroma?.color?.toLowerCase() === preset.hex.toLowerCase()
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-[#3e3e3e] bg-[#1e1e1e] text-[#a0a0a0] hover:border-[#5e5e5e] hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: preset.hex }} />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-[#a0a0a0] uppercase tracking-wider font-medium">Key Color</span>
            <div className="flex items-center gap-2 bg-[#1e1e1e] p-2 rounded border border-[#3e3e3e]">
              <div
                className="w-8 h-8 rounded border border-white/10 shrink-0 shadow-inner"
                style={{ backgroundColor: chroma?.color || '#00ff00' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white font-mono uppercase tracking-wide">
                  {chroma?.color || '#00FF00'}
                </div>
                <div className="text-[9px] text-[#6a6a6a]">
                  {`RGB(${hexToRgb(chroma?.color || '#00ff00').join(', ')})`}
                </div>
              </div>
              <input
                type="color"
                value={chroma?.color || '#00ff00'}
                onChange={(e) => updateChroma({ color: e.target.value })}
                onBlur={() => useEditorStore.getState().saveSnapshot()}
                className="w-6 h-6 bg-transparent border-0 rounded cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-[#3e3e3e] [&::-webkit-color-swatch]:rounded"
              />
              <button
                onClick={() => setIsPickingChromaColor(true)}
                disabled={isPickingChromaColor}
                className={`p-1.5 rounded transition-colors ${
                  isPickingChromaColor ? 'bg-emerald-500 text-black' : 'bg-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:bg-[#4e4e4e]'
                }`}
                title="Pick color from canvas"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={autoDetect}
                className="p-1.5 bg-[#3e3e3e] text-[#a0a0a0] rounded hover:text-white hover:bg-[#4e4e4e] transition-colors"
                title="Auto-detect dominant background color"
              >
                <Wand2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Threshold</span>
                <span className="font-mono text-[#a0a0a0]">{chroma?.threshold ?? 30}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={chroma?.threshold ?? 30}
                onChange={(e) => updateChroma({ threshold: Number(e.target.value) })}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Softness / Spill</span>
                <span className="font-mono text-[#a0a0a0]">{chroma?.softness ?? 10}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={chroma?.softness ?? 10}
                onChange={(e) => updateChroma({ softness: Number(e.target.value) })}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Spill Suppression</span>
                <span className="font-mono text-[#a0a0a0]">{chroma?.spillSuppression ?? 0}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={chroma?.spillSuppression ?? 0}
                onChange={(e) => updateChroma({ spillSuppression: Number(e.target.value) })}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#d0d0d0]">Edge Feather</span>
                <span className="font-mono text-[#a0a0a0]">{chroma?.edgeFeather ?? 0}px</span>
              </div>
              <input
                type="range" min={0} max={20} value={chroma?.edgeFeather ?? 0}
                onChange={(e) => updateChroma({ edgeFeather: Number(e.target.value) })}
                className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
