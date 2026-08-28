import { easeOutCubic, easeOutBack, clamp01 } from '../motionGraphicEasing';

export interface MotionArrowConfig {
  from: { x: number; y: number };
  to: { x: number; y: number };
  curve?: number;
  color?: string;
  thickness?: number;
  headSize?: number;
  drawDuration?: number;
  glow?: boolean;
}

export const MotionArrow = (
  ctx: CanvasRenderingContext2D,
  config: MotionArrowConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const from = config.from || { x: canvasW * 0.25, y: canvasH * 0.5 };
  const to = config.to || { x: canvasW * 0.75, y: canvasH * 0.5 };
  const curve = config.curve ?? 0;
  const color = config.color ?? '#f59e0b';
  const thickness = config.thickness ?? 4;
  const headSize = config.headSize ?? 22;
  const drawDuration = config.drawDuration ?? Math.max(0.2, totalDuration * 0.7);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chordLength = Math.hypot(dx, dy);
  if (chordLength < 1) return;

  // Midpoint & normal vector for curve control point
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -dy / chordLength;
  const ny = dx / chordLength;
  const cpX = mx + nx * curve;
  const cpY = my + ny * curve;

  // Estimate bezier curve length numerically
  const SAMPLES = 32;
  let totalLength = 0;
  let prevX = from.x;
  let prevY = from.y;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const omt = 1 - t;
    const qx = omt * omt * from.x + 2 * omt * t * cpX + t * t * to.x;
    const qy = omt * omt * from.y + 2 * omt * t * cpY + t * t * to.y;
    totalLength += Math.hypot(qx - prevX, qy - prevY);
    prevX = qx;
    prevY = qy;
  }

  const drawProgress = clamp01(localTime / drawDuration);
  const easedDraw = easeOutCubic(drawProgress);
  const dashOffset = totalLength * (1 - easedDraw);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (config.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }

  // Draw main curved arrow stem
  ctx.beginPath();
  ctx.setLineDash([totalLength, totalLength]);
  ctx.lineDashOffset = dashOffset;
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
  ctx.stroke();

  // Reset line dash for the arrowhead
  ctx.setLineDash([]);

  // Draw Arrowhead when stroke reaches endpoint
  if (drawProgress > 0.8) {
    const headProgress = clamp01((drawProgress - 0.8) / 0.2);
    const headScale = easeOutBack(headProgress);

    // Tangent angle at curve end (t = 1)
    const angle = Math.atan2(to.y - cpY, to.x - cpX);
    const currentHeadSize = headSize * headScale;
    const wingAngle = Math.PI / 6; // 30 degrees

    const p1X = to.x - currentHeadSize * Math.cos(angle - wingAngle);
    const p1Y = to.y - currentHeadSize * Math.sin(angle - wingAngle);
    const p2X = to.x - currentHeadSize * Math.cos(angle + wingAngle);
    const p2Y = to.y - currentHeadSize * Math.sin(angle + wingAngle);

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(p1X, p1Y);
    ctx.lineTo(p2X, p2Y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
};
