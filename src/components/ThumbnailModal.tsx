import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Type, Image as ImageIcon } from 'lucide-react';

interface ThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageData: string | null;
}

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export function ThumbnailModal({ isOpen, onClose, imageData }: ThumbnailModalProps) {
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setTextLayers([]); // Reset when closed
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvasRef.current!.width = img.width;
        canvasRef.current!.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Draw text layers
        textLayers.forEach(layer => {
          ctx.font = `bold ${layer.fontSize}px Impact, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Outline
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = layer.fontSize * 0.15;
          ctx.strokeText(layer.text, layer.x, layer.y);
          
          // Fill
          ctx.fillStyle = layer.color;
          ctx.fillText(layer.text, layer.x, layer.y);
        });
      };
      img.src = imageData;
    }
  }, [isOpen, imageData, textLayers]);

  if (!isOpen || !imageData) return null;

  const addTextLayer = () => {
    setTextLayers([
      ...textLayers,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: 'NEW TEXT',
        x: canvasRef.current?.width ? canvasRef.current.width / 2 : 1280 / 2,
        y: canvasRef.current?.height ? canvasRef.current.height / 2 : 720 / 2,
        fontSize: 120,
        color: '#ffffff'
      }
    ]);
  };

  const updateLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers(textLayers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'thumbnail.jpg';
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-8 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl flex flex-col max-h-full max-w-[1200px] w-full">
        <div className="p-4 border-b border-[#3e3e3e] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <ImageIcon className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Thumbnail Designer</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-[600px]">
          {/* Main Canvas Area */}
          <div className="flex-1 p-6 bg-black flex items-center justify-center overflow-auto relative" ref={containerRef}>
            <canvas 
              ref={canvasRef} 
              className="max-w-full max-h-full object-contain shadow-2xl"
              style={{ background: 'transparent' }}
            />
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-[#252525] border-l border-[#3e3e3e] p-4 flex flex-col">
            <button
              onClick={addTextLayer}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded mb-4 flex items-center justify-center gap-2 transition-colors"
            >
              <Type className="w-4 h-4" />
              Add Bold Text
            </button>

            <div className="flex-1 overflow-y-auto space-y-4">
              {textLayers.map(layer => (
                <div key={layer.id} className="bg-[#1e1e1e] p-3 rounded border border-[#3e3e3e]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#a0a0a0] uppercase">Text Layer</span>
                    <button 
                      onClick={() => setTextLayers(textLayers.filter(l => l.id !== layer.id))}
                      className="text-[#a0a0a0] hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={layer.text}
                    onChange={e => updateLayer(layer.id, { text: e.target.value })}
                    className="w-full px-2 py-1.5 mb-2 bg-[#2d2d2d] border border-[#4d4d4d] rounded text-xs text-white"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] text-[#a0a0a0]">Size</label>
                      <input
                        type="number"
                        value={layer.fontSize}
                        onChange={e => updateLayer(layer.id, { fontSize: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-[#2d2d2d] border border-[#4d4d4d] rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a0a0a0]">Color</label>
                      <input
                        type="color"
                        value={layer.color}
                        onChange={e => updateLayer(layer.id, { color: e.target.value })}
                        className="w-full h-6 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#a0a0a0]">X Pos</label>
                      <input
                        type="number"
                        value={layer.x}
                        onChange={e => updateLayer(layer.id, { x: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-[#2d2d2d] border border-[#4d4d4d] rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a0a0a0]">Y Pos</label>
                      <input
                        type="number"
                        value={layer.y}
                        onChange={e => updateLayer(layer.id, { y: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-[#2d2d2d] border border-[#4d4d4d] rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#3e3e3e]">
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <Download className="w-4 h-4" />
                Download Thumbnail
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
