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
  cutTime?: number;
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

export const TransitionTarget = React.memo(function TransitionTarget({
  clipId,
  trackId,
  position,
  cutTime,
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

  const buttonSize = 26; // 26px diameter matching standard timeline UI
  let buttonLeft: number;
  if (cutTime !== undefined) {
    if (position === 'in' && cutTime <= 0.05) {
      // Exactly at the start of the first clip (0:00), align comfortably at the edge
      buttonLeft = Math.max(1, cutTime * zoomLevel);
    } else {
      // Centered directly on the cut line / boundary
      buttonLeft = Math.round(cutTime * zoomLevel - buttonSize / 2);
    }
  } else {
    buttonLeft = Math.round(left + width / 2 - buttonSize / 2);
  }

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
    return (
      <div className="contents">
        {/* Subtle duration highlight behind the cut button */}
        {width > 0 && (
          <div
            className={`absolute top-2 bottom-2 rounded pointer-events-none transition-all z-20 ${
              isSelected
                ? 'bg-purple-600/30 border border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'bg-purple-700/20 border border-purple-500/30'
            }`}
            style={{ left: `${left}px`, width: `${width}px` }}
          />
        )}

        {/* Circular Transition Button: centered on the cut line, matching CapCut style */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-30 w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 shadow-md ${
            isSelected
              ? 'bg-white text-purple-700 ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950 scale-105'
              : 'bg-white text-zinc-900 border border-zinc-200 hover:scale-115 hover:shadow-lg hover:border-zinc-400 active:scale-95'
          }`}
          style={{ left: `${buttonLeft}px` }}
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
          title={transitionName ? `Transition: ${transitionName} (Click to edit)` : 'Transition (Click to edit)'}
        >
          {/* Crisp Bowtie transition icon (⋈) */}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-zinc-900 pointer-events-none">
            <path d="M4 6.5v11l8-5.5-8-5.5zm16 0l-8 5.5 8 5.5v-11z" />
          </svg>

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
      className={`absolute top-1/2 -translate-y-1/2 z-30 w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 shadow-md ${
        isDragOver
          ? 'bg-purple-600 border-2 border-purple-300 text-white scale-125 shadow-xl ring-2 ring-purple-400'
          : 'bg-white text-zinc-900 border border-zinc-200 hover:scale-115 hover:bg-zinc-50 hover:shadow-lg active:scale-95'
      }`}
      style={{
        left: `${buttonLeft}px`,
      }}
    >
      <Plus className={`w-4 h-4 stroke-[2.5] ${isDragOver ? 'text-white' : 'text-zinc-900'}`} />
    </div>
  );
});
