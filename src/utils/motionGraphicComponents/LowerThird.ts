import { easeOutCubic, clamp01 } from '../motionGraphicEasing';

export interface LowerThirdConfig {
  name: string;
  title: string;
  barColor?: string;
  textColor?: string;
  accentColor?: string;
  style?: 'modern' | 'news' | 'minimal';
  position?: { x: number; y: number };
  fontFamily?: string;
}

export const LowerThird = (
  ctx: CanvasRenderingContext2D,
  config: LowerThirdConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const name = config.name || 'John Doe';
  const title = config.title || 'Creative Director';
  const barColor = config.barColor || '#1e1e1e';
  const textColor = config.textColor || '#ffffff';
  const accentColor = config.accentColor || '#f59e0b';
  const style = config.style || 'modern';
  const fontFamily = config.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';

  const D = Math.max(0.2, totalDuration);
  const targetX = config.position?.x ?? 80;
  const targetY = config.position?.y ?? canvasH - 140;

  // Measure text sizes
  ctx.save();
  const nameFontSize = 26;
  const titleFontSize = 16;
  ctx.font = `bold ${nameFontSize}px ${fontFamily}`;
  const nameWidth = ctx.measureText(name).width;

  ctx.font = `500 ${titleFontSize}px ${fontFamily}`;
  const titleWidth = ctx.measureText(title).width;

  const contentWidth = Math.max(nameWidth, titleWidth);
  const barWidth = contentWidth + 60;
  const barHeight = 68;

  // Animation Stage Timings
  const barSlideInProg = clamp01(localTime / (0.2 * D));
  const barSlideEased = easeOutCubic(barSlideInProg);

  const nameFadeProg = clamp01((localTime - 0.15 * D) / (0.15 * D));
  const nameEased = easeOutCubic(nameFadeProg);

  const titleFadeProg = clamp01((localTime - 0.25 * D) / (0.15 * D));
  const titleEased = easeOutCubic(titleFadeProg);

  const accentProg = clamp01((localTime - 0.3 * D) / (0.2 * D));
  const accentEased = easeOutCubic(accentProg);

  // Exit animation (last 15%)
  let exitOffsetX = 0;
  let exitAlpha = 1;
  const outStart = 0.85 * D;
  if (localTime >= outStart) {
    const exitProg = clamp01((localTime - outStart) / (0.15 * D));
    const exitEased = easeOutCubic(exitProg);
    exitOffsetX = -exitEased * (targetX + barWidth + 60);
    exitAlpha = 1 - exitEased;
  }

  if (exitAlpha <= 0.001) {
    ctx.restore();
    return;
  }

  // Current Bar X Position (sliding in from offscreen left)
  const initialOffscreenX = -barWidth - 40;
  const currentX = initialOffscreenX + (targetX - initialOffscreenX) * barSlideEased + exitOffsetX;
  const currentY = targetY;

  ctx.globalAlpha = exitAlpha;

  if (style === 'modern') {
    // 1. Background Bar (Glassmorphic rounded dark rect)
    ctx.save();
    ctx.fillStyle = barColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(currentX, currentY, barWidth, barHeight, 8);
    } else {
      ctx.rect(currentX, currentY, barWidth, barHeight);
    }
    ctx.fill();
    ctx.restore();

    // 2. Left Accent Vertical Strip
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    const stripH = barHeight * accentEased;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(currentX, currentY, 5, stripH, [6, 0, 0, 6]);
    } else {
      ctx.rect(currentX, currentY, 5, stripH);
    }
    ctx.fill();

    // 3. Name Text
    if (nameFadeProg > 0) {
      ctx.save();
      ctx.globalAlpha = exitAlpha * nameEased;
      ctx.font = `bold ${nameFontSize}px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, currentX + 24 + (1 - nameEased) * 15, currentY + 22);
      ctx.restore();
    }

    // 4. Title Text
    if (titleFadeProg > 0) {
      ctx.save();
      ctx.globalAlpha = exitAlpha * titleEased;
      ctx.font = `500 ${titleFontSize}px ${fontFamily}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, currentX + 24 + (1 - titleEased) * 15, currentY + 48);
      ctx.restore();
    }

    // 5. Bottom Accent Line
    if (accentProg > 0) {
      ctx.fillStyle = accentColor;
      ctx.fillRect(currentX + 20, currentY + barHeight - 2, (barWidth - 40) * accentEased, 2);
    }
  } else if (style === 'news') {
    // 1. News Style: Solid Two-Tier Rectangles
    const nameBarH = 40;
    const titleBarH = 28;

    // Accent left block
    ctx.fillStyle = accentColor;
    ctx.fillRect(currentX, currentY, 12, nameBarH + titleBarH);

    // Name Bar
    ctx.fillStyle = barColor;
    ctx.fillRect(currentX + 12, currentY, barWidth - 12, nameBarH);

    // Title Bar (slightly darker/tinted)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(currentX + 12, currentY + nameBarH, barWidth - 12, titleBarH);

    // Name Text (Uppercase)
    if (nameFadeProg > 0) {
      ctx.save();
      ctx.globalAlpha = exitAlpha * nameEased;
      ctx.font = `bold 20px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.toUpperCase(), currentX + 26, currentY + nameBarH / 2);
      ctx.restore();
    }

    // Title Text
    if (titleFadeProg > 0) {
      ctx.save();
      ctx.globalAlpha = exitAlpha * titleEased;
      ctx.font = `600 13px ${fontFamily}`;
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title.toUpperCase(), currentX + 26, currentY + nameBarH + titleBarH / 2);
      ctx.restore();
    }
  } else {
    // Minimal Style: Clean subtle background, elegant thin lines
    ctx.save();
    ctx.fillStyle = 'rgba(15, 15, 15, 0.65)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(currentX, currentY, barWidth, barHeight, 6);
    } else {
      ctx.rect(currentX, currentY, barWidth, barHeight);
    }
    ctx.fill();
    ctx.restore();

    // Name Text
    if (nameFadeProg > 0) {
      ctx.save();
      ctx.globalAlpha = exitAlpha * nameEased;
      ctx.font = `600 ${nameFontSize}px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, currentX + 20, currentY + 22);
      ctx.restore();
    }

    // Title Text
    if (titleFadeProg > 0) {
      ctx.save();
      ctx.globalAlpha = exitAlpha * titleEased;
      ctx.font = `400 ${titleFontSize}px ${fontFamily}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, currentX + 20, currentY + 48);
      ctx.restore();
    }

    // Thin accent line below title
    if (accentProg > 0) {
      ctx.fillStyle = accentColor;
      ctx.fillRect(currentX + 20, currentY + barHeight - 3, (barWidth - 40) * accentEased, 2);
    }
  }

  ctx.restore();
};
