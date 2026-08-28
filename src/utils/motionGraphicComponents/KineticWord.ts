import {
  easeOutCubic,
  easeOutBack,
  spring,
  elastic,
  bounce,
  clamp01,
} from '../motionGraphicEasing';

export interface KineticWordConfig {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  animation?:
    | 'fadeIn'
    | 'slideUp'
    | 'slideDown'
    | 'slideLeft'
    | 'slideRight'
    | 'zoom'
    | 'bounce'
    | 'elastic'
    | 'spring'
    | 'scaleFlip'
    | 'zoomBlur'
    | 'glitch'
    | string;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; offsetX?: number; offsetY?: number };
  glow?: { color: string; blur: number };
  position?: { x: number; y: number };
}

export const KineticWord = (
  ctx: CanvasRenderingContext2D,
  config: KineticWordConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const text = config.text || '';
  if (!text) return;

  const fontSize = config.fontSize ?? 64;
  const fontFamily = config.fontFamily ?? 'Inter, system-ui, -apple-system, sans-serif';
  const color = config.color ?? '#ffffff';
  const animation = config.animation || 'spring';
  const posX = config.position?.x ?? canvasW / 2;
  const posY = config.position?.y ?? canvasH / 2;

  const duration = Math.max(0.1, totalDuration);
  const inDuration = duration * 0.2;
  const outStart = duration * 0.85;
  const outDuration = duration * 0.15;

  const inProgress = clamp01(localTime / inDuration);
  const outProgress = localTime >= outStart ? clamp01((localTime - outStart) / outDuration) : 0;

  let alpha = 1;
  let scaleX = 1;
  let scaleY = 1;
  let translateX = 0;
  let translateY = 0;
  let blurAmount = 0;
  let isGlitch = false;

  // Compute entrance transform
  if (inProgress < 1) {
    switch (animation) {
      case 'fadeIn':
        alpha = easeOutCubic(inProgress);
        break;
      case 'slideUp':
        alpha = easeOutCubic(inProgress);
        translateY = (1 - easeOutCubic(inProgress)) * 120;
        break;
      case 'slideDown':
        alpha = easeOutCubic(inProgress);
        translateY = -(1 - easeOutCubic(inProgress)) * 120;
        break;
      case 'slideLeft':
        alpha = easeOutCubic(inProgress);
        translateX = (1 - easeOutCubic(inProgress)) * 200;
        break;
      case 'slideRight':
        alpha = easeOutCubic(inProgress);
        translateX = -(1 - easeOutCubic(inProgress)) * 200;
        break;
      case 'zoom': {
        const s = easeOutBack(inProgress);
        scaleX = s;
        scaleY = s;
        alpha = clamp01(inProgress * 2);
        break;
      }
      case 'bounce': {
        const s = bounce(inProgress);
        scaleX = s;
        scaleY = s;
        alpha = clamp01(inProgress * 3);
        break;
      }
      case 'elastic': {
        const s = elastic(inProgress);
        scaleX = s;
        scaleY = s;
        alpha = clamp01(inProgress * 4);
        break;
      }
      case 'spring': {
        const s = spring(inProgress);
        scaleX = s;
        scaleY = s;
        alpha = clamp01(inProgress * 3);
        break;
      }
      case 'scaleFlip': {
        const p = easeOutCubic(inProgress);
        scaleY = Math.max(0.01, Math.sin((p * Math.PI) / 2));
        scaleX = 1;
        alpha = clamp01(inProgress * 2);
        break;
      }
      case 'zoomBlur': {
        const p = easeOutCubic(inProgress);
        const s = 2.5 - 1.5 * p;
        scaleX = s;
        scaleY = s;
        blurAmount = (1 - p) * 35;
        alpha = 0.2 + 0.8 * p;
        break;
      }
      case 'glitch': {
        isGlitch = true;
        alpha = clamp01(inProgress * 2);
        break;
      }
      default:
        alpha = easeOutCubic(inProgress);
        break;
    }
  }

  // Compute exit transform
  if (outProgress > 0) {
    const exitEase = easeOutCubic(outProgress);
    switch (animation) {
      case 'slideUp':
        translateY -= exitEase * 120;
        alpha = 1 - exitEase;
        break;
      case 'slideDown':
        translateY += exitEase * 120;
        alpha = 1 - exitEase;
        break;
      case 'slideLeft':
        translateX -= exitEase * 200;
        alpha = 1 - exitEase;
        break;
      case 'slideRight':
        translateX += exitEase * 200;
        alpha = 1 - exitEase;
        break;
      case 'zoom':
      case 'zoomBlur':
        scaleX = Math.max(0, 1 + exitEase * 0.4);
        scaleY = Math.max(0, 1 + exitEase * 0.4);
        alpha = 1 - exitEase;
        break;
      case 'scaleFlip':
        scaleY = Math.max(0.01, Math.cos((exitEase * Math.PI) / 2));
        alpha = 1 - exitEase;
        break;
      case 'glitch':
        isGlitch = true;
        alpha = 1 - exitEase;
        break;
      default:
        alpha = 1 - exitEase;
        break;
    }
  }

  if (alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.translate(posX + translateX, posY + translateY);
  ctx.scale(scaleX, scaleY);
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glitch effect drawing (RGB shift split)
  if (isGlitch || animation === 'glitch') {
    const seed = Math.sin(localTime * 45.0) * 1000;
    const jitterX = (seed - Math.floor(seed) - 0.5) * 14;
    const jitterY = ((seed * 1.5) - Math.floor(seed * 1.5) - 0.5) * 6;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#ff0055';
    ctx.fillText(text, jitterX, jitterY);
    ctx.fillStyle = '#00ffff';
    ctx.fillText(text, -jitterX, -jitterY);
    ctx.restore();
  }

  // Glow layer: draw before standard text with large shadowBlur
  if (config.glow) {
    ctx.save();
    ctx.shadowColor = config.glow.color;
    ctx.shadowBlur = (config.glow.blur || 24) + blurAmount;
    ctx.fillStyle = config.glow.color;
    ctx.fillText(text, 0, 0);
    ctx.fillText(text, 0, 0); // Double draw for rich vibrant glow
    ctx.restore();
  }

  // Normal shadow if specified
  if (config.shadow) {
    ctx.shadowColor = config.shadow.color;
    ctx.shadowBlur = (config.shadow.blur || 10) + blurAmount;
    ctx.shadowOffsetX = config.shadow.offsetX ?? 0;
    ctx.shadowOffsetY = config.shadow.offsetY ?? 4;
  } else if (blurAmount > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blurAmount;
  }

  // Fill text
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);

  // Stroke if configured
  if (config.stroke && config.stroke.width > 0) {
    ctx.strokeStyle = config.stroke.color;
    ctx.lineWidth = config.stroke.width;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
  }

  ctx.restore();
};
