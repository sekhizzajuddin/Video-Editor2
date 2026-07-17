import React, { useRef, useState, useCallback, useEffect } from 'react';
import { BezierControl } from '@/types';

interface BezierCurveEditorProps {
  value: BezierControl;
  onChange: (value: BezierControl) => void;
  width?: number;
  height?: number;
  showPreview?: boolean;
}

// Coordinate system: Graph is 0-1 on both axes
// SVG ViewBox: 0 0 140 140 with 20px padding
const PADDING = 20;
const SIZE = 100;
const VIEWBOX = 140;

const toSvg = (x: number, y: number) => ({
  x: PADDING + x * SIZE,
  y: PADDING + (1 - y) * SIZE // Invert Y: 0 is bottom, 1 is top
});

const fromSvg = (sx: number, sy: number) => ({
  x: (sx - PADDING) / SIZE,
  y: 1 - (sy - PADDING) / SIZE
});

// Clamp values
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Calculate cubic bezier point at t
const getBezierPoint = (t: number, p0: number, p1: number, p2: number, p3: number) => {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
};

export const BezierCurveEditor: React.FC<BezierCurveEditorProps> = ({
  value,
  onChange,
  width = 280,
  height = 280,
  showPreview = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<'cp1' | 'cp2' | null>(null);
  const [hovered, setHovered] = useState<'cp1' | 'cp2' | null>(null);
  const [previewT, setPreviewT] = useState(0);
  const animRef = useRef<number | null>(null);

  // Normalize values
  const cp1x = clamp(value.x, 0, 1);
  const cp1y = clamp(value.y, -0.5, 1.5);
  const cp2x = clamp(value.inX ?? (1 - value.x), 0, 1);
  const cp2y = clamp(value.inY ?? (1 - value.y), -0.5, 1.5);

  // Generate curve path
  const curvePoints: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const bx = getBezierPoint(t, 0, cp1x, cp2x, 1);
    const by = getBezierPoint(t, 0, cp1y, cp2y, 1);
    const svgPos = toSvg(bx, by);
    curvePoints.push(`${svgPos.x},${svgPos.y}`);
  }
  const curvePath = `M ${curvePoints.join(' L ')}`;

  // SVG coordinate conversion from mouse event
  const getSvgPos = useCallback((e: React.PointerEvent | PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = 'clientX' in e ? e.clientX : 0;
    pt.y = 'clientY' in e ? e.clientY : 0;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgP = pt.matrixTransform(ctm.inverse());
    return fromSvg(svgP.x, svgP.y);
  }, []);

  const handlePointerDown = useCallback((point: 'cp1' | 'cp2') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDragging(point);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const pos = getSvgPos(e);
    
    if (dragging === 'cp1') {
      onChange({
        ...value,
        x: clamp(pos.x, 0, 1),
        y: clamp(pos.y, -0.5, 1.5)
      });
    } else {
      onChange({
        ...value,
        inX: clamp(pos.x, 0, 1),
        inY: clamp(pos.y, -0.5, 1.5)
      });
    }
  }, [dragging, value, onChange, getSvgPos]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Preview animation loop
  useEffect(() => {
    if (!showPreview) return;
    let start: number | null = null;
    const duration = 1200; // 1.2s loop

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const t = (elapsed % duration) / duration;
      setPreviewT(t);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [showPreview]);

  // Calculate preview ball position
  const previewX = getBezierPoint(previewT, 0, cp1x, cp2x, 1);
  const previewY = getBezierPoint(previewT, 0, cp1y, cp2y, 1);
  const previewSvg = toSvg(previewX, previewY);

  // Start and end points
  const startPt = toSvg(0, 0);
  const endPt = toSvg(1, 1);
  const cp1Pt = toSvg(cp1x, cp1y);
  const cp2Pt = toSvg(cp2x, cp2y);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="bg-[#1a1a1a] rounded-lg border border-[#3e3e3e]"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const p = toSvg(tick, tick);
          return (
            <g key={tick} opacity={tick === 0 || tick === 1 ? 0.4 : 0.15}>
              <line
                x1={PADDING}
                y1={p.y}
                x2={PADDING + SIZE}
                y2={p.y}
                stroke="#666"
                strokeWidth={0.5}
                strokeDasharray={tick === 0 || tick === 1 ? '' : '2 2'}
              />
              <line
                x1={p.x}
                y1={PADDING}
                x2={p.x}
                y2={PADDING + SIZE}
                stroke="#666"
                strokeWidth={0.5}
                strokeDasharray={tick === 0 || tick === 1 ? '' : '2 2'}
              />
              <text x={PADDING - 4} y={p.y + 3} fill="#555" fontSize="5" textAnchor="end" fontFamily="monospace">
                {tick === 0 ? '0' : tick === 1 ? '1' : tick.toFixed(2)}
              </text>
              <text x={p.x} y={PADDING + SIZE + 8} fill="#555" fontSize="5" textAnchor="middle" fontFamily="monospace">
                {tick === 0 ? '0' : tick === 1 ? 't' : tick.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Diagonal reference line (linear) */}
        <line
          x1={startPt.x}
          y1={startPt.y}
          x2={endPt.x}
          y2={endPt.y}
          stroke="#333"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />

        {/* Handle lines */}
        <line
          x1={startPt.x}
          y1={startPt.y}
          x2={cp1Pt.x}
          y2={cp1Pt.y}
          stroke="#f59e0b"
          strokeWidth={1}
          opacity={0.6}
        />
        <line
          x1={endPt.x}
          y1={endPt.y}
          x2={cp2Pt.x}
          y2={cp2Pt.y}
          stroke="#22d3ee"
          strokeWidth={1}
          opacity={0.6}
        />

        {/* Curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Start/End points */}
        <circle cx={startPt.x} cy={startPt.y} r={3} fill="#666" />
        <circle cx={endPt.x} cy={endPt.y} r={3} fill="#666" />

        {/* Control Point 1 (Start handle) */}
        <g
          onPointerDown={handlePointerDown('cp1')}
          onMouseEnter={() => setHovered('cp1')}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'grab' }}
        >
          <circle
            cx={cp1Pt.x}
            cy={cp1Pt.y}
            r={dragging === 'cp1' ? 7 : hovered === 'cp1' ? 6 : 5}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
          />
          {/* Label */}
          {(hovered === 'cp1' || dragging === 'cp1') && (
            <g>
              <rect
                x={cp1Pt.x - 18}
                y={cp1Pt.y - 18}
                width={36}
                height={12}
                rx={2}
                fill="rgba(0,0,0,0.8)"
              />
              <text
                x={cp1Pt.x}
                y={cp1Pt.y - 10}
                fill="#f59e0b"
                fontSize="5"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {cp1x.toFixed(2)}, {cp1y.toFixed(2)}
              </text>
            </g>
          )}
        </g>

        {/* Control Point 2 (End handle) */}
        <g
          onPointerDown={handlePointerDown('cp2')}
          onMouseEnter={() => setHovered('cp2')}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'grab' }}
        >
          <circle
            cx={cp2Pt.x}
            cy={cp2Pt.y}
            r={dragging === 'cp2' ? 7 : hovered === 'cp2' ? 6 : 5}
            fill="#22d3ee"
            stroke="#fff"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
          />
          {(hovered === 'cp2' || dragging === 'cp2') && (
            <g>
              <rect
                x={cp2Pt.x - 18}
                y={cp2Pt.y - 18}
                width={36}
                height={12}
                rx={2}
                fill="rgba(0,0,0,0.8)"
              />
              <text
                x={cp2Pt.x}
                y={cp2Pt.y - 10}
                fill="#22d3ee"
                fontSize="5"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {cp2x.toFixed(2)}, {cp2y.toFixed(2)}
              </text>
            </g>
          )}
        </g>

        {/* Preview ball */}
        {showPreview && (
          <>
            <circle
              cx={previewSvg.x}
              cy={previewSvg.y}
              r={4}
              fill="#ef4444"
              opacity={0.9}
              style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.6))' }}
            />
            {/* Trail dots */}
            {Array.from({ length: 8 }, (_, i) => {
              const trailT = Math.max(0, previewT - (i + 1) * 0.03);
              const tx = getBezierPoint(trailT, 0, cp1x, cp2x, 1);
              const ty = getBezierPoint(trailT, 0, cp1y, cp2y, 1);
              const tSvg = toSvg(tx, ty);
              return (
                <circle
                  key={i}
                  cx={tSvg.x}
                  cy={tSvg.y}
                  r={3 - i * 0.3}
                  fill="#ef4444"
                  opacity={0.3 - i * 0.03}
                />
              );
            })}
          </>
        )}
      </svg>

      {/* Value readout */}
      <div className="flex gap-4 text-[10px] font-mono text-[#888]">
        <span className="text-amber-500">
          CP1: ({cp1x.toFixed(3)}, {cp1y.toFixed(3)})
        </span>
        <span className="text-cyan-400">
          CP2: ({cp2x.toFixed(3)}, {cp2y.toFixed(3)})
        </span>
      </div>
    </div>
  );
};
