import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import type { ClipColorFilters } from '@/types';

interface CurvePoint {
  x: number;
  y: number;
  id: string;
}

interface CurveChannelData {
  channel: 'rgb' | 'r' | 'g' | 'b' | 'luma';
  points: CurvePoint[];
}

interface CurvesEditorProps {
  curves: ClipColorFilters['curves'];
  onChange: (curves: ClipColorFilters['curves']) => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  rgb: '#fbbf24',
  r: '#ef4444',
  g: '#22c55e',
  b: '#3b82f6',
  luma: '#a78bfa',
};

const CHANNEL_LABELS: Record<string, string> = {
  rgb: 'RGB',
  r: 'Red',
  g: 'Green',
  b: 'Blue',
  luma: 'Luma',
};

const SVG_SIZE = 220;
const SVG_PAD = 8;

export function CurvesEditor({ curves, onChange }: CurvesEditorProps) {
  const [activeChannel, setActiveChannel] = useState<'rgb' | 'r' | 'g' | 'b' | 'luma'>('rgb');
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  const currentData = curves?.[activeChannel] ?? null;
  const currentPoints: CurvePoint[] = currentData?.points ?? [];

  const updateCurve = useCallback(
    (channel: 'rgb' | 'r' | 'g' | 'b' | 'luma', points: CurvePoint[]) => {
      onChange({
        ...(curves ?? {}),
        [channel]: { points },
      });
    },
    [curves, onChange],
  );

  const handleAddPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingPointId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - SVG_PAD) / (SVG_SIZE - 2 * SVG_PAD);
    const y = 1 - (e.clientY - rect.top - SVG_PAD) / (SVG_SIZE - 2 * SVG_PAD);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    const newPoint: CurvePoint = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    const newPoints = [...currentPoints, newPoint].sort((a, b) => a.x - b.x);
    updateCurve(activeChannel, newPoints);
  };

  const handleMovePoint = useCallback(
    (e: MouseEvent) => {
      if (!draggingPointId) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - SVG_PAD) / (SVG_SIZE - 2 * SVG_PAD);
      const y = 1 - (e.clientY - rect.top - SVG_PAD) / (SVG_SIZE - 2 * SVG_PAD);

      const newPoints = currentPoints.map((p) =>
        p.id === draggingPointId
          ? { ...p, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
          : p,
      );
      updateCurve(activeChannel, newPoints);
    },
    [draggingPointId, currentPoints, activeChannel, updateCurve],
  );

  const handleDeletePoint = useCallback(
    (e: MouseEvent) => {
      if (e.altKey && draggingPointId) {
        const newPoints = currentPoints.filter((p) => p.id !== draggingPointId);
        updateCurve(activeChannel, newPoints);
        setDraggingPointId(null);
      }
    },
    [draggingPointId, currentPoints, activeChannel, updateCurve],
  );

  useEffect(() => {
    if (!draggingPointId) return;
    window.addEventListener('mousemove', handleMovePoint);
    window.addEventListener('mouseup', () => setDraggingPointId(null));
    window.addEventListener('mousemove', handleDeletePoint);
    return () => {
      window.removeEventListener('mousemove', handleMovePoint);
      window.removeEventListener('mouseup', () => setDraggingPointId(null));
      window.removeEventListener('mousemove', handleDeletePoint);
    };
  }, [draggingPointId, handleMovePoint, handleDeletePoint]);

  const resetCurve = () => {
    onChange({ ...(curves ?? {}), [activeChannel]: { points: [] } });
  };

  const buildPath = () => {
    if (currentPoints.length === 0) {
      return `M ${SVG_PAD} ${SVG_SIZE - SVG_PAD} L ${SVG_SIZE - SVG_PAD} ${SVG_PAD}`;
    }
    if (currentPoints.length === 1) {
      const p = currentPoints[0];
      const cx = SVG_PAD + p.x * (SVG_SIZE - 2 * SVG_PAD);
      const cy = SVG_SIZE - SVG_PAD - p.y * (SVG_SIZE - 2 * SVG_PAD);
      return `M ${SVG_PAD} ${SVG_SIZE - SVG_PAD} L ${cx} ${cy} L ${SVG_SIZE - SVG_PAD} ${SVG_PAD}`;
    }
    const sorted = [...currentPoints].sort((a, b) => a.x - b.x);
    let d = `M ${SVG_PAD} ${SVG_SIZE - SVG_PAD}`;
    sorted.forEach((p) => {
      const cx = SVG_PAD + p.x * (SVG_SIZE - 2 * SVG_PAD);
      const cy = SVG_SIZE - SVG_PAD - p.y * (SVG_SIZE - 2 * SVG_PAD);
      d += ` L ${cx} ${cy}`;
    });
    d += ` L ${SVG_SIZE - SVG_PAD} ${SVG_PAD}`;
    return d;
  };

  const color = CHANNEL_COLORS[activeChannel];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Curves</label>
        <button
          onClick={resetCurve}
          className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-[#a0a0a0] hover:text-white border border-[#3e3e3e] rounded transition-colors"
          title="Reset active channel curve"
        >
          <RotateCcw className="w-2.5 h-2.5" /> Reset
        </button>
      </div>

      <div className="flex items-center gap-1">
        {(['rgb', 'r', 'g', 'b', 'luma'] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
              activeChannel === ch
                ? 'border-amber-500 bg-amber-500/10 text-white'
                : 'border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
            }`}
            title={`${CHANNEL_LABELS[ch]} channel`}
          >
            <div
              className="w-3 h-3 mx-auto rounded-full mb-0.5"
              style={{ backgroundColor: CHANNEL_COLORS[ch] }}
            />
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="bg-[#1a1a1a] border border-[#3e3e3e] rounded cursor-crosshair"
          onClick={handleAddPoint}
        >
          {/* Grid */}
          {[0.25, 0.5, 0.75].map((pos) => (
            <g key={pos}>
              <line
                x1={SVG_PAD + pos * (SVG_SIZE - 2 * SVG_PAD)}
                y1={SVG_PAD}
                x2={SVG_PAD + pos * (SVG_SIZE - 2 * SVG_PAD)}
                y2={SVG_SIZE - SVG_PAD}
                stroke="#3e3e3e"
                strokeWidth="0.5"
              />
              <line
                x1={SVG_PAD}
                y1={SVG_PAD + pos * (SVG_SIZE - 2 * SVG_PAD)}
                x2={SVG_SIZE - SVG_PAD}
                y2={SVG_PAD + pos * (SVG_SIZE - 2 * SVG_PAD)}
                stroke="#3e3e3e"
                strokeWidth="0.5"
              />
            </g>
          ))}
          {/* Diagonal reference */}
          <line
            x1={SVG_PAD}
            y1={SVG_SIZE - SVG_PAD}
            x2={SVG_SIZE - SVG_PAD}
            y2={SVG_PAD}
            stroke="#3e3e3e"
            strokeDasharray="4 4"
            strokeWidth="0.5"
          />
          {/* Border */}
          <rect
            x={SVG_PAD}
            y={SVG_PAD}
            width={SVG_SIZE - 2 * SVG_PAD}
            height={SVG_SIZE - 2 * SVG_PAD}
            fill="none"
            stroke="#3e3e3e"
            strokeWidth="1"
          />
          {/* Curve path */}
          <path
            d={buildPath()}
            stroke={color}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Control points */}
          {currentPoints.map((p) => {
            const cx = SVG_PAD + p.x * (SVG_SIZE - 2 * SVG_PAD);
            const cy = SVG_SIZE - SVG_PAD - p.y * (SVG_SIZE - 2 * SVG_PAD);
            return (
              <circle
                key={p.id}
                cx={cx}
                cy={cy}
                r="4"
                fill={color}
                stroke="#1a1a1a"
                strokeWidth="1.5"
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingPointId(p.id);
                }}
              />
            );
          })}
        </svg>
        <div className="absolute top-1 left-1 text-[9px] text-[#6a6a6a] pointer-events-none">
          click to add · drag to move · alt+drag to delete
        </div>
      </div>
    </div>
  );
}
