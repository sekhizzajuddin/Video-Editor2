import { easeOutCubic, spring, clamp01 } from '../motionGraphicEasing';

export interface TitleCardConfig {
  title: string;
  subtitle?: string;
  titleColor?: string;
  subtitleColor?: string;
  accentColor?: string;
  style?: 'cinematic' | 'editorial' | 'bold';
  position?: { x: number; y: number };
  fontSize?: number;
  subtitleFontSize?: number;
  fontFamily?: string;
}

export const TitleCard = (
  ctx: CanvasRenderingContext2D,
  config: TitleCardConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const title = config.title || 'THE HEADLINE';
  const subtitle = config.subtitle;
  const titleColor = config.titleColor || '#ffffff';
  const subtitleColor = config.subtitleColor || 'rgba(255, 255, 255, 0.75)';
  const accentColor = config.accentColor || '#f59e0b';
  const style = config.style || 'cinematic';

  const D = Math.max(0.2, totalDuration);
  const centerX = config.position?.x ?? canvasW / 2;
  const centerY = config.position?.y ?? canvasH / 2;

  // Fonts setup based on style
  let titleFont = config.fontFamily;
  let subFont = 'Inter, system-ui, sans-serif';
  let defaultTitleSize = 52;
  let defaultSubSize = 20;

  if (style === 'cinematic') {
    titleFont = titleFont || 'Georgia, "Times New Roman", serif';
    defaultTitleSize = 54;
    defaultSubSize = 18;
  } else if (style === 'editorial') {
    titleFont = titleFont || 'Didot, "Bodoni MT", Georgia, serif';
    defaultTitleSize = 50;
    defaultSubSize = 18;
  } else {
    // Bold
    titleFont = titleFont || 'Inter, system-ui, -apple-system, sans-serif';
    defaultTitleSize = 60;
    defaultSubSize = 22;
  }

  const titleFontSize = config.fontSize ?? defaultTitleSize;
  const subFontSize = config.subtitleFontSize ?? defaultSubSize;

  // Timings
  const titleProg = clamp01(localTime / (0.25 * D));
  const titleScale = spring(titleProg);
  const titleAlpha = clamp01(titleProg * 3);

  const subDelay = 0.3;
  const subProg = clamp01((localTime - subDelay) / (0.25 * D));
  const subEased = easeOutCubic(subProg);

  const lineProg = clamp01((localTime - 0.2 * D) / (0.25 * D));
  const lineEased = easeOutCubic(lineProg);

  // Exit Animation (last 15%)
  let exitAlpha = 1;
  const outStart = 0.85 * D;
  if (localTime >= outStart) {
    const exitProg = clamp01((localTime - outStart) / (0.15 * D));
    exitAlpha = 1 - easeOutCubic(exitProg);
  }

  if (exitAlpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = exitAlpha;

  // Measure title width
  ctx.font = `${style === 'bold' ? 'bold' : '600'} ${titleFontSize}px ${titleFont}`;
  const titleWidth = ctx.measureText(title).width;

  // 1. Draw Left and Right Accent Lines
  if (lineProg > 0) {
    const maxLineLen = Math.min(120, canvasW * 0.15);
    const lineLen = maxLineLen * lineEased;
    const lineGap = 24;
    const lineThickness = style === 'bold' ? 4 : 2;

    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = lineThickness;
    ctx.lineCap = 'round';

    // Left accent line (draws outward to the left)
    const leftLineEnd = centerX - titleWidth / 2 - lineGap;
    const leftLineStart = leftLineEnd;
    ctx.beginPath();
    ctx.moveTo(leftLineStart, centerY);
    ctx.lineTo(leftLineStart - lineLen, centerY);
    ctx.stroke();

    // Right accent line (draws outward to the right)
    const rightLineStart = centerX + titleWidth / 2 + lineGap;
    ctx.beginPath();
    ctx.moveTo(rightLineStart, centerY);
    ctx.lineTo(rightLineStart + lineLen, centerY);
    ctx.stroke();

    ctx.restore();
  }

  // 2. Draw Main Title
  if (titleProg > 0) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(titleScale, titleScale);
    ctx.globalAlpha = exitAlpha * titleAlpha;

    ctx.font = `${style === 'bold' ? '900' : '600'} ${titleFontSize}px ${titleFont}`;
    ctx.fillStyle = titleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (style === 'cinematic') {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 18;
    }

    ctx.fillText(title, 0, 0);
    ctx.restore();
  }

  // 3. Draw Subtitle
  if (subtitle && subProg > 0) {
    ctx.save();
    ctx.globalAlpha = exitAlpha * subEased;
    ctx.font = `500 ${subFontSize}px ${subFont}`;
    ctx.fillStyle = subtitleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const subY = centerY + titleFontSize / 2 + 18 + (1 - subEased) * 10;
    ctx.fillText(subtitle, centerX, subY);
    ctx.restore();
  }

  ctx.restore();
};
