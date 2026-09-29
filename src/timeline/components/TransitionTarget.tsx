import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowLeftRight, GripVertical, ZoomIn, Plus } from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { normalizeTransition, getDefaultSoundForKind } from '@/utils/transitionEngine';

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
      } else if (nameLower.includes('iris') || nameLower.includes('circle')) {
        // Iris / circle wipe: growing (or shrinking) circular reveal.
        const out = nameLower.includes('out');
        drawBlock(out ? colorB : colorA, 1);
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, Math.max(1, (out ? 1 - t : t) * W * 0.75), 0, Math.PI * 2);
        ctx.clip();
        drawBlock(out ? colorA : colorB, 1);
        ctx.restore();
      } else if (nameLower.includes('flip')) {
        // 3D card flip approximation: squash A away, then B flips in.
        if (t < 0.5) {
          const c = Math.max(0.02, Math.cos(t * Math.PI));
          ctx.save();
          ctx.translate(W / 2, 0);
          ctx.scale(c, 1);
          const w2 = W / c;
          ctx.fillStyle = colorA;
          ctx.fillRect(-w2 / 2, 0, w2, H);
          ctx.restore();
        } else {
          const c = Math.max(0.02, Math.cos((t - 1) * Math.PI));
          ctx.save();
          ctx.translate(W / 2, 0);
          ctx.scale(c, 1);
          const w2 = W / c;
          ctx.fillStyle = colorB;
          ctx.fillRect(-w2 / 2, 0, w2, H);
          ctx.restore();
        }
      } else if (nameLower.includes('fade')) {
        if (t < 0.5) {
          drawBlock(colorA, 1 - t * 2);
        } else {
          drawBlock(colorB, (t - 0.5) * 2);
        }
      } else if (nameLower.includes('fold')) {
        // Paper fold: B revealed from the named edge with a shadow lip
        drawBlock(colorA, 1);
        const fromRight = nameLower.includes('right');
        const fromTop = nameLower.includes('top');
        ctx.save();
        ctx.beginPath();
        if (fromTop) ctx.rect(0, 0, W, H * t);
        else if (fromRight) ctx.rect(W * (1 - t), 0, W * t, H);
        else ctx.rect(0, 0, W * t, H);
        ctx.clip();
        drawBlock(colorB, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.4 * (1 - t)})`;
        if (fromTop) ctx.fillRect(0, H * t - 4, W, 4);
        else if (fromRight) ctx.fillRect(W * (1 - t), 0, 4, H);
        else ctx.fillRect(W * t - 4, 0, 4, H);
        ctx.restore();
      } else if (nameLower.includes('particle')) {
        drawBlock(colorA, 1);
        const cell = 4;
        ctx.save();
        for (let y = 0; y < H; y += cell) {
          for (let x = 0; x < W; x += cell) {
            const s = Math.sin((x / cell) * 12.9898 + (y / cell) * 78.233) * 43758.5453123;
            const hsh = s - Math.floor(s);
            if (hsh < t) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(x, y, cell, cell);
              ctx.clip();
              drawBlock(colorB, 1);
              ctx.restore();
            }
          }
        }
        ctx.restore();
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
  const { selectTransition } = useEditorStore(useShallow(s => ({ selectTransition: s.selectTransition })));
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

    // Map the preset name to the canonical kind so the drop works even if the
    // preset is later renamed (normalizeTransition re-parses the name anyway,
    // but storing the kind makes the Properties panel show the right one).
    const probe = normalizeTransition({ type: name.toLowerCase().replace(/\s+/g, '_'), name, duration: 1 });

    const state = useEditorStore.getState();
    const clip = findClipDeep(state, clipId)?.clip;
    const clipDuration = clip?.duration ?? 2.5;
    const defaultDuration = Math.min(1.0, clipDuration * 0.4);

    // Auto-attach the recommended sound effect as a tasteful default; the user
    // can change it or set it to "No Sound" in the Transition Settings panel.
    const defaultSound = getDefaultSoundForKind(probe.kind);
    const defaultAlignment = position === 'in' ? 'left' : position === 'out' ? 'right' : 'center';

    const newTransition = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type: probe.kind,
      duration: Math.max(0.1, defaultDuration),
      params: { alignment: defaultAlignment, kind: probe.kind, standalone: position === 'in' || position === 'out' },
      soundEffect: defaultSound,
      soundVolume: 0.8,
    };

    if (position === 'in') {
      useEditorStore.getState().updateClip(clipId, { transitionIn: newTransition });
    } else {
      useEditorStore.getState().updateClip(clipId, { transitionOut: newTransition });
    }
    useEditorStore.getState().saveSnapshot('Add Transition');
    selectTransition(clipId, position);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTransition(clipId, position);
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
        const state = useEditorStore.getState();
        const clip = findClipDeep(state, clipId)?.clip;
        const clipDuration = clip?.duration ?? 2.5;
        const defaultDuration = Math.min(1.0, clipDuration * 0.4);
        const defaultAlignment = position === 'in' ? 'left' : position === 'out' ? 'right' : 'center';
        const defaultSound = getDefaultSoundForKind('dissolve');

        const newTransition = {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Cross Dissolve',
          type: 'dissolve',
          duration: Math.max(0.1, defaultDuration),
          params: { alignment: defaultAlignment, kind: 'dissolve', standalone: position === 'in' || position === 'out' },
          soundEffect: defaultSound,
          soundVolume: 0.8,
        };

        if (position === 'in') {
          state.updateClip(clipId, { transitionIn: newTransition });
        } else {
          state.updateClip(clipId, { transitionOut: newTransition });
        }
        state.saveSnapshot('Add Transition');
        selectTransition(clipId, position);
        toast.success(`Added ${newTransition.name} (${defaultAlignment === 'left' ? 'Start at Cut' : defaultAlignment === 'right' ? 'End at Cut' : 'Center at Cut'})`);
      }}
      title={position === 'in' ? "Click to add In-Transition (Start at Cut)" : position === 'out' ? "Click to add Out-Transition (End at Cut)" : "Click to add Cut Transition"}
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
          : 'bg-[#252525] border-purple-500/60 text-purple-400 hover:text-white hover:scale-110 hover:border-purple-500 hover:bg-purple-600'
      }`}>
        <Plus className="w-3.5 h-3.5" />
      </div>
      
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
    </div>
  );
}
