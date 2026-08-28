import { easeOutCubic, clamp01 } from '../motionGraphicEasing';

export interface ParticleBurstConfig {
  center?: { x: number; y: number };
  count?: number;
  colors?: string[];
  radius?: number;
  burstRadius?: number;
  glow?: boolean;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export const ParticleBurst = (
  ctx: CanvasRenderingContext2D,
  config: ParticleBurstConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const center = config.center || { x: canvasW / 2, y: canvasH / 2 };
  const count = config.count ?? 32;
  const colors = config.colors && config.colors.length > 0
    ? config.colors
    : ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ffffff'];
  const radius = config.radius ?? 5;
  const burstRadius = config.burstRadius ?? Math.min(canvasW, canvasH) * 0.28;

  const burstDuration = Math.max(0.2, totalDuration * 0.85);
  const prog = clamp01(localTime / burstDuration);
  if (prog >= 1) return;

  const easedProg = easeOutCubic(prog);
  const alpha = 1 - prog;

  ctx.save();

  for (let i = 0; i < count; i++) {
    // Deterministic attributes for particle i
    const angleJitter = (pseudoRandom(i * 3 + 1) - 0.5) * ((Math.PI * 2) / count);
    const angle = (i / count) * Math.PI * 2 + angleJitter;

    const distVariation = 0.5 + 0.5 * pseudoRandom(i * 7 + 2);
    const targetDist = burstRadius * distVariation;
    const currentDist = targetDist * easedProg;

    const sizeMultiplier = 0.5 + pseudoRandom(i * 11 + 3);
    const currentRadius = Math.max(0.5, radius * sizeMultiplier * (1 - prog * 0.45));

    const colorIndex = Math.floor(pseudoRandom(i * 13 + 4) * colors.length);
    const color = colors[colorIndex % colors.length];

    const px = center.x + Math.cos(angle) * currentDist;
    const py = center.y + Math.sin(angle) * currentDist;

    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.fillStyle = color;

    if (config.glow !== false) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.arc(px, py, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
};
