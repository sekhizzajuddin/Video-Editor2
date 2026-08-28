import { easeOutCubic, clamp01 } from '../motionGraphicEasing';

export interface VoiceSyncWord {
  text: string;
  start: number;
  end: number;
}

export interface VoiceSyncHighlightConfig {
  words: VoiceSyncWord[];
  highlightColor?: string;
  textColor?: string;
  dimColor?: string;
  fontSize?: number;
  fontFamily?: string;
  position?: { x: number; y: number };
  paddingX?: number;
  paddingY?: number;
  borderRadius?: number;
}

export const VoiceSyncHighlight = (
  ctx: CanvasRenderingContext2D,
  config: VoiceSyncHighlightConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const words = config.words || [];
  if (words.length === 0) return;

  const fontSize = config.fontSize ?? 38;
  const fontFamily = config.fontFamily ?? 'Inter, system-ui, -apple-system, sans-serif';
  const highlightColor = config.highlightColor ?? '#f59e0b';
  const textColor = config.textColor ?? '#ffffff';
  const dimColor = config.dimColor ?? 'rgba(255, 255, 255, 0.35)';
  const padX = config.paddingX ?? 10;
  const padY = config.paddingY ?? 6;
  const borderRadius = config.borderRadius ?? 8;

  ctx.save();
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';

  // Measure word dimensions and layout
  const spaceWidth = ctx.measureText(' ').width;
  const measuredWords = words.map((w) => ({
    ...w,
    width: ctx.measureText(w.text).width,
  }));

  const totalLineWidth =
    measuredWords.reduce((acc, curr) => acc + curr.width, 0) +
    Math.max(0, measuredWords.length - 1) * spaceWidth;

  const posX = config.position?.x ?? canvasW / 2;
  const posY = config.position?.y ?? canvasH / 2;
  const startX = posX - totalLineWidth / 2;

  // Build bounding boxes for each word
  let cursorX = startX;
  const wordBoxes = measuredWords.map((w) => {
    const box = {
      ...w,
      x: cursorX,
      y: posY - fontSize / 2,
      w: w.width,
      h: fontSize,
      centerX: cursorX + w.width / 2,
      centerY: posY,
    };
    cursorX += w.width + spaceWidth;
    return box;
  });

  // Determine current active highlight position & transition
  const firstStart = words[0].start;
  const lastEnd = words[words.length - 1].end;

  let highlightVisible = localTime >= firstStart - 0.2 && localTime <= lastEnd + 0.4;
  let highlightOpacity = 1;

  if (localTime < firstStart) {
    highlightOpacity = clamp01((localTime - (firstStart - 0.2)) / 0.2);
  } else if (localTime > lastEnd) {
    highlightOpacity = 1 - clamp01((localTime - lastEnd) / 0.4);
  }

  let hx = wordBoxes[0].x;
  let hy = wordBoxes[0].y;
  let hw = wordBoxes[0].w;
  let hh = wordBoxes[0].h;

  let activeIndex = -1;

  if (words.length === 1) {
    activeIndex = localTime >= words[0].start && localTime <= words[0].end ? 0 : -1;
    hx = wordBoxes[0].x;
    hw = wordBoxes[0].w;
  } else {
    // Find active index or interpolation between words
    for (let i = 0; i < words.length; i++) {
      if (localTime >= words[i].start && localTime <= words[i].end) {
        activeIndex = i;
        break;
      }
    }

    if (activeIndex >= 0) {
      const cur = wordBoxes[activeIndex];
      if (activeIndex > 0) {
        const prev = wordBoxes[activeIndex - 1];
        const transDuration = Math.min(0.18, Math.max(0.06, (words[activeIndex].end - words[activeIndex].start) * 0.4));
        const transProgress = clamp01((localTime - words[activeIndex].start) / transDuration);
        const easeT = easeOutCubic(transProgress);
        hx = prev.x + (cur.x - prev.x) * easeT;
        hw = prev.w + (cur.w - prev.w) * easeT;
      } else {
        hx = cur.x;
        hw = cur.w;
      }
    } else {
      // In-between words or before/after
      if (localTime < words[0].start) {
        hx = wordBoxes[0].x;
        hw = wordBoxes[0].w;
        activeIndex = 0;
      } else if (localTime > words[words.length - 1].end) {
        hx = wordBoxes[wordBoxes.length - 1].x;
        hw = wordBoxes[wordBoxes.length - 1].w;
        activeIndex = words.length - 1;
      } else {
        // Between word i and i+1
        for (let i = 0; i < words.length - 1; i++) {
          if (localTime > words[i].end && localTime < words[i + 1].start) {
            const span = words[i + 1].start - words[i].end;
            const p = span > 0 ? clamp01((localTime - words[i].end) / span) : 1;
            const easeT = easeOutCubic(p);
            const w1 = wordBoxes[i];
            const w2 = wordBoxes[i + 1];
            hx = w1.x + (w2.x - w1.x) * easeT;
            hw = w1.w + (w2.w - w1.w) * easeT;
            activeIndex = p > 0.5 ? i + 1 : i;
            break;
          }
        }
      }
    }
  }

  // Draw Highlight Rounded Rectangle
  if (highlightVisible && highlightOpacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = highlightOpacity;
    ctx.fillStyle = highlightColor;

    const rx = hx - padX;
    const ry = hy - padY;
    const rw = hw + padX * 2;
    const rh = hh + padY * 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, rw, rh, borderRadius);
    } else {
      ctx.rect(rx, ry, rw, rh);
    }
    ctx.fill();
    ctx.restore();
  }

  // Draw Text for each word
  for (let i = 0; i < wordBoxes.length; i++) {
    const box = wordBoxes[i];
    const isCurrentActive = i === activeIndex && highlightVisible;

    ctx.fillStyle = isCurrentActive ? textColor : dimColor;
    ctx.textAlign = 'left';
    ctx.fillText(box.text, box.x, posY);
  }

  ctx.restore();
};
