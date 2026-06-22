/**
 * waveformRenderer.ts — Render waveform peaks onto a <canvas> element.
 *
 * Used by both the MediaPanel (mini-preview) and the Timeline (in-clip waveform).
 */

export interface WaveformRenderOptions {
  peaks: number[];
  width: number;
  height: number;
  color?: string;
  bgColor?: string;
  /** 'center' = symmetric around middle, 'bottom' = bars from bottom */
  style?: 'center' | 'bottom';
  barWidth?: number;
  barGap?: number;
  cornerRadius?: number;
}

/**
 * Render waveform peaks onto a canvas 2D context.
 */
export function renderWaveform(
  ctx: CanvasRenderingContext2D,
  options: WaveformRenderOptions
): void {
  const {
    peaks,
    width,
    height,
    color = 'rgba(255, 255, 255, 0.5)',
    bgColor,
    style = 'center',
    barWidth: customBarWidth,
    barGap = 1,
    cornerRadius = 1,
  } = options;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  if (peaks.length === 0) return;

  const barWidth = customBarWidth ?? Math.max(1, (width / peaks.length) - barGap);
  const totalBarSpace = barWidth + barGap;

  ctx.fillStyle = color;

  for (let i = 0; i < peaks.length; i++) {
    const x = i * totalBarSpace;
    if (x > width) break;

    const peak = Math.max(0.02, peaks[i]); // minimum visible height
    const barHeight = peak * height * 0.9;

    if (style === 'center') {
      const y = (height - barHeight) / 2;
      if (cornerRadius > 0) {
        roundRect(ctx, x, y, barWidth, barHeight, cornerRadius);
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    } else {
      const y = height - barHeight;
      if (cornerRadius > 0) {
        roundRect(ctx, x, y, barWidth, barHeight, cornerRadius);
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }
  }
}

/**
 * Helper: draw a rounded rectangle and fill it.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Render waveform onto a standalone canvas element (creates one if needed).
 * Returns the canvas for embedding.
 */
export function createWaveformCanvas(
  peaks: number[],
  width: number,
  height: number,
  color?: string,
  style?: 'center' | 'bottom'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  renderWaveform(ctx, { peaks, width, height, color, style });
  return canvas;
}

/**
 * Generate a data URL of a waveform rendering for use in <img> tags.
 */
export function renderWaveformToDataUrl(
  peaks: number[],
  width: number,
  height: number,
  color = 'rgba(52, 211, 153, 0.6)',
  style: 'center' | 'bottom' = 'center'
): string {
  const canvas = createWaveformCanvas(peaks, width, height, color, style);
  return canvas.toDataURL('image/png');
}
