import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowLeftRight, GripVertical, ZoomIn, Plus } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { toast } from 'sonner';

interface TransitionTargetProps {
  position?: 'in' | 'out';
  clipId: string;
  trackId: string;
  left: number;
  width: number;
  hasTransition: boolean;
  transitionName?: string;
  isSelected: boolean;
  zoomLevel: number;
}

function TransitionPreviewTooltipCanvas({ transitionName }: { transitionName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    let animationId: number;
    const startRef = { current: null as number | null };
    const duration = 1500; // 1.5s loop duration

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const nameLower = transitionName.toLowerCase();

      const drawBlock = (color: string, opacity: number, scaleMultiplier: number = 1, tx: number = 0, ty: number = 0) => {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(W / 2 + tx, H / 2 + ty);
        ctx.scale(scaleMultiplier, scaleMultiplier);
        
        ctx.fillStyle = color;
        ctx.fillRect(-W / 2, -H / 2, W, H);
        ctx.restore();
      };

      const colorA = '#ef4444'; // Red
      const colorB = '#3b82f6'; // Blue

      if (nameLower.includes('dissolve')) {
        drawBlock(colorA, 1 - t);
        drawBlock(colorB, t);
      } else if (nameLower.includes('fade')) {
        if (t < 0.5) {
          drawBlock(colorA, 1 - t * 2);
        } else {
          drawBlock(colorB, (t - 0.5) * 2);
        }
      } else if (nameLower.includes('wipe')) {
        if (nameLower.includes('left')) {
          drawBlock(colorA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(W * (1 - t), 0, W * t, H);
          ctx.clip();
          drawBlock(colorB, 1);
          ctx.restore();
        } else {
          drawBlock(colorA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W * t, H);
          ctx.clip();
          drawBlock(colorB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('slide')) {
        if (nameLower.includes('up')) {
          drawBlock(colorA, 1, 1, 0, -H * t);
          drawBlock(colorB, 1, 1, 0, H * (1 - t));
        } else if (nameLower.includes('down')) {
          drawBlock(colorA, 1, 1, 0, H * t);
          drawBlock(colorB, 1, 1, 0, -H * (1 - t));
        } else {
          drawBlock(colorA, 1, 1, -W * t, 0);
          drawBlock(colorB, 1, 1, W * (1 - t), 0);
        }
      } else if (nameLower.includes('zoom')) {
        if (nameLower.includes('out')) {
          drawBlock(colorB, 1);
          drawBlock(colorA, 1 - t, 1 - t);
        } else {
          drawBlock(colorA, 1 - t);
          drawBlock(colorB, t, t);
        }
      } else {
        drawBlock(colorA, 1 - t);
        drawBlock(colorB, t);
      }
    };

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = (elapsed % duration) / duration;
      draw(progress);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [transitionName]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={68}
      className="rounded border border-purple-500/30 bg-[#0c0c0c]"
    />
  );
}

export function TransitionTarget({
  clipId,
  trackId,
  position,
  left,
  width,
  hasTransition,
  transitionName,
  isSelected,
  zoomLevel,
}: TransitionTargetProps) {
  const { selectTransition } = useEditorStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/procut-transition')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const name = e.dataTransfer.getData('application/procut-transition');
    if (!name) return;

    let type: 'dissolve' | 'wipe' | 'zoom' | 'slide' = 'dissolve';
    if (name.toLowerCase().includes('wipe')) type = 'wipe';
    else if (name.toLowerCase().includes('zoom')) type = 'zoom';
    else if (name.toLowerCase().includes('slide')) type = 'slide';

    const state = useEditorStore.getState();
    const clip = state.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    const clipDuration = clip?.duration ?? 2.5;
    const defaultDuration = Math.min(1.0, clipDuration * 0.4);

    const newTransition = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      duration: Math.max(0.1, defaultDuration),
      params: { alignment: 'center' },
    };

    if (position === 'in') {
      useEditorStore.getState().updateClip(clipId, { transitionIn: newTransition });
    } else {
      useEditorStore.getState().updateClip(clipId, { transitionOut: newTransition });
    }
    useEditorStore.getState().saveSnapshot();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTransition(clipId);
  };

  if (hasTransition) {
    let TransitionIcon = Sparkles;
    const nameLower = (transitionName || '').toLowerCase();
    if (nameLower.includes('wipe')) {
      TransitionIcon = ArrowLeftRight;
    } else if (nameLower.includes('slide')) {
      TransitionIcon = GripVertical;
    } else if (nameLower.includes('zoom')) {
      TransitionIcon = ZoomIn;
    }

    return (
      <div
        className={`absolute top-2 bottom-2 rounded-sm z-30 flex items-center justify-center cursor-pointer text-white border transition-all group/trans ${
          isSelected
            ? 'bg-purple-600 border-purple-300 ring-1 ring-purple-300 shadow-lg'
            : 'bg-purple-700/80 border-purple-600 hover:bg-purple-600 hover:border-purple-500'
        }`}
        style={{ left: `${left}px`, width: `${width}px` }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TransitionIcon className={`w-3.5 h-3.5 text-purple-200 group-hover/trans:scale-110 transition-transform ${isHovered ? 'animate-pulse' : ''}`} />

        {isHovered && transitionName && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/95 border border-purple-500 rounded p-1.5 shadow-2xl z-50 flex flex-col items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            style={{ minWidth: '130px' }}
          >
            <span className="text-[9px] text-white font-semibold capitalize whitespace-nowrap">
              {transitionName}
            </span>
            <TransitionPreviewTooltipCanvas transitionName={transitionName} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        e.stopPropagation();
        toast.info("Drag a transition effect here from the Effects panel to apply it.");
      }}
      className="absolute top-0 bottom-0 z-30 flex flex-col items-center justify-center pointer-events-auto group cursor-pointer"
      style={{
        left: `${left + width / 2 - 12}px`,
        width: '24px',
      }}
    >
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
      
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-md transition-all ${
        isDragOver
          ? 'bg-purple-600 border-purple-300 text-white scale-125'
          : 'bg-[#252525] border-purple-500/60 text-purple-400 hover:text-white hover:scale-110 hover:border-purple-500'
      }`}>
        <Plus className="w-3.5 h-3.5" />
      </div>
      
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
    </div>
  );
}
