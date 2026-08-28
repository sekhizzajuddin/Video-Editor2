import { easeOutCubic, clamp01 } from '../motionGraphicEasing';

export interface CircleHighlightConfig {
  center?: { x: number; y: number };
  radius?: number;
  color?: string;
  thickness?: number;
  wobble?: boolean;
}

export const CircleHighlight = (
  ctx: CanvasRenderingContext2D,
  config: CircleHighlightConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const center = config.center || { x: canvasW / 2, y: canvasH / 2 };
  const radius = config.radius ?? 60;
  const color = config.color ?? '#ef4444';
  const thickness = config.thickness ?? 4;
  const wobble = config.wobble !== false;

  const D = Math.max(0.2, totalDuration);
  const drawDuration = 0.4 * D;
  const drawProg = clamp01(localTime / drawDuration);
  const easedDraw = easeOutCubic(drawProg);

  if (easedDraw <= 0.001) return;

  // Exit animation (last 15%)
  let alpha = 1;
  const outStart = 0.85 * D;
  if (localTime >= outStart) {
    const exitProg = clamp01((localTime - outStart) / (0.15 * D));
    alpha = 1 - easeOutCubic(exitProg);
  }

  if (alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const startAngle = -Math.PI / 2;
  const totalAngleSpan = Math.PI * 2 * 1.05; // 5% slight overlap for hand-drawn annotation
  const currentAngleSpan = totalAngleSpan * easedDraw;

  if (wobble) {
    const SEGMENTS = 48;
    const currentSteps = Math.ceil(SEGMENTS * easedDraw);

    ctx.beginPath();
    for (let k = 0; k <= currentSteps; k++) {
      const stepFrac = Math.min(easedDraw, k / SEGMENTS);
      const angle = startAngle + stepFrac * totalAngleSpan;

      // Deterministic hand-drawn wave distortion
      const rOffset =
        Math.sin(3 * angle) * 2.8 +
        Math.cos(5 * angle) * 1.8 +
        Math.sin(7 * angle) * 1.0;

      const currentR = radius + rOffset;
      const x = center.x + Math.cos(angle) * currentR;
      const y = center.y + Math.sin(angle) * currentR;

      if (k === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  } else {
    // Smooth perfect arc
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, startAngle, startAngle + currentAngleSpan, false);
    ctx.stroke();
  }

  ctx.restore();
};
