import { easeOutCubic, clamp01 } from '../motionGraphicEasing';

export interface AnimatedCounterConfig {
  targetValue: number;
  startValue?: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  decimals?: number;
  position?: { x: number; y: number };
  label?: string;
  labelColor?: string;
  labelFontSize?: number;
  glow?: boolean;
}

export const AnimatedCounter = (
  ctx: CanvasRenderingContext2D,
  config: AnimatedCounterConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const targetValue = config.targetValue ?? 100;
  const startValue = config.startValue ?? 0;
  const prefix = config.prefix ?? '';
  const suffix = config.suffix ?? '';
  const fontSize = config.fontSize ?? 72;
  const fontFamily = config.fontFamily ?? 'Inter, system-ui, -apple-system, sans-serif';
  const color = config.color ?? '#ffffff';
  const decimals = config.decimals ?? 0;
  const posX = config.position?.x ?? canvasW / 2;
  const posY = config.position?.y ?? canvasH / 2;

  const countDuration = Math.max(0.2, totalDuration * 0.7);
  const progress = clamp01(localTime / countDuration);
  const eased = easeOutCubic(progress);

  const currentValue = startValue + (targetValue - startValue) * eased;

  // Format current value string
  let formattedNumber = '';
  if (decimals > 0) {
    formattedNumber = currentValue.toFixed(decimals);
  } else {
    formattedNumber = Math.round(currentValue).toLocaleString();
  }
  const fullText = `${prefix}${formattedNumber}${suffix}`;

  // Exit fade/scale during last 15%
  const outStart = totalDuration * 0.85;
  let alpha = 1;
  let scale = 1;
  if (localTime >= outStart) {
    const exitProg = clamp01((localTime - outStart) / (totalDuration * 0.15));
    alpha = 1 - easeOutCubic(exitProg);
    scale = 1 - exitProg * 0.1;
  }

  if (alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(posX, posY);
  ctx.scale(scale, scale);

  // Optional glow
  if (config.glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fullText, 0, 0);
    ctx.restore();
  }

  // Draw main counter text
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fullText, 0, 0);

  // Optional Subtitle/Label below counter
  if (config.label) {
    const labelFontSize = config.labelFontSize ?? Math.max(14, fontSize * 0.3);
    const labelColor = config.labelColor ?? 'rgba(255, 255, 255, 0.6)';
    ctx.font = `500 ${labelFontSize}px ${fontFamily}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(config.label, 0, fontSize / 2 + 10);
  }

  ctx.restore();
};
