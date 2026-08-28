import { easeOutCubic, spring, clamp01 } from '../motionGraphicEasing';

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
}

export interface AnimatedLineGraphConfig {
  points: GraphPoint[];
  lineColor?: string;
  dotColor?: string;
  dotRadius?: number;
  gridLines?: boolean;
  axisLabels?: { x?: string; y?: string };
  title?: string;
  lineWidth?: number;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  fontFamily?: string;
  areaGradient?: boolean;
}

function formatVal(val: number): string {
  if (Math.abs(val - Math.round(val)) < 0.01) {
    return Math.round(val).toString();
  }
  return val.toFixed(1);
}

export const AnimatedLineGraph = (
  ctx: CanvasRenderingContext2D,
  config: AnimatedLineGraphConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const rawPoints = config.points || [];
  if (rawPoints.length < 2) return;

  const lineColor = config.lineColor || '#38bdf8';
  const dotColor = config.dotColor || '#ffffff';
  const dotRadius = config.dotRadius ?? 6;
  const showGrid = config.gridLines !== false;
  const lineWidth = config.lineWidth ?? 3.5;
  const fontFamily = config.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';

  const chartW = config.width ?? Math.min(canvasW * 0.74, 740);
  const chartH = config.height ?? Math.min(canvasH * 0.54, 380);
  const centerX = config.position?.x ?? canvasW / 2;
  const centerY = config.position?.y ?? canvasH / 2;

  const left = centerX - chartW / 2;
  const right = centerX + chartW / 2;
  const top = centerY - chartH / 2;
  const bottom = centerY + chartH / 2;

  const padX = 24;
  const padY = 24;

  const minX = Math.min(...rawPoints.map((p) => p.x));
  const maxX = Math.max(...rawPoints.map((p) => p.x));
  const minY = Math.min(...rawPoints.map((p) => p.y));
  const maxY = Math.max(...rawPoints.map((p) => p.y));

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Map to screen pixel coordinates
  const screenPts = rawPoints.map((p) => ({
    x: left + padX + ((p.x - minX) / rangeX) * (chartW - padX * 2),
    y: bottom - padY - ((p.y - minY) / rangeY) * (chartH - padY * 2),
    raw: p,
  }));

  // Calculate cumulative arc lengths along graph path
  const cumLengths: number[] = [0];
  for (let i = 1; i < screenPts.length; i++) {
    const d = Math.hypot(screenPts[i].x - screenPts[i - 1].x, screenPts[i].y - screenPts[i - 1].y);
    cumLengths.push(cumLengths[i - 1] + d);
  }
  const totalLength = cumLengths[cumLengths.length - 1];
  if (totalLength < 1) return;

  const drawDuration = Math.max(0.4, totalDuration * 0.7);
  const drawProgress = clamp01(localTime / drawDuration);
  const easedDraw = easeOutCubic(drawProgress);
  const currentDrawnLength = totalLength * easedDraw;

  ctx.save();

  // Draw Title
  if (config.title) {
    ctx.font = `bold 20px ${fontFamily}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(config.title, centerX, top - 18);
  }

  // Draw Grid Lines & Values
  if (showGrid) {
    const gridSteps = 4;
    ctx.font = `12px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

    for (let s = 0; s <= gridSteps; s++) {
      const gy = bottom - padY - (s / gridSteps) * (chartH - padY * 2);
      const val = minY + (s / gridSteps) * rangeY;

      ctx.save();
      ctx.strokeStyle = s === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      if (s > 0) ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(left, gy);
      ctx.lineTo(right, gy);
      ctx.stroke();
      ctx.restore();

      ctx.fillText(formatVal(val), left - 8, gy);
    }
  }

  // Draw Axis Labels
  if (config.axisLabels) {
    ctx.font = `12px ${fontFamily}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    if (config.axisLabels.x) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(config.axisLabels.x, centerX, bottom + 12);
    }
    if (config.axisLabels.y) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(config.axisLabels.y, left, top - 8);
    }
  }

  // Draw Animated Line Stroke
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([totalLength, totalLength]);
  ctx.lineDashOffset = totalLength * (1 - easedDraw);

  ctx.beginPath();
  ctx.moveTo(screenPts[0].x, screenPts[0].y);
  for (let i = 1; i < screenPts.length; i++) {
    ctx.lineTo(screenPts[i].x, screenPts[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // Draw Dots at reached points
  for (let i = 0; i < screenPts.length; i++) {
    const ptDist = cumLengths[i];
    const reachFrac = ptDist / totalLength;
    const reachTime = reachFrac * drawDuration * 0.9;

    if (localTime >= reachTime) {
      const dotAge = localTime - reachTime;
      const dotProgress = clamp01(dotAge / 0.35);
      const dotScale = spring(dotProgress);

      const pt = screenPts[i];
      const r = dotRadius * dotScale;

      if (r > 0.1) {
        // Outer halo
        ctx.save();
        ctx.fillStyle = lineColor;
        ctx.globalAlpha = 0.3 * clamp01(dotProgress * 2);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + 4, 0, Math.PI * 2);
        ctx.fill();

        // Main dot
        ctx.globalAlpha = 1;
        ctx.fillStyle = dotColor;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Label if present
        if (pt.raw.label) {
          ctx.save();
          ctx.globalAlpha = clamp01(dotProgress * 2);
          ctx.font = `bold 12px ${fontFamily}`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(pt.raw.label, pt.x, pt.y - r - 6);
          ctx.restore();
        }
      }
    }
  }

  ctx.restore();
};
