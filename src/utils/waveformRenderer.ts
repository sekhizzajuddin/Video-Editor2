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

  const step = customBarWidth ? customBarWidth + barGap : Math.max(1, (width / peaks.length));

  ctx.fillStyle = color;

  if (style === 'center') {
    const cy = height / 2;
    ctx.beginPath();
    
    // Top half
    ctx.moveTo(0, cy);
    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      if (x > width) break;
      const peak = Math.max(0.02, peaks[i]);
      const halfH = (peak * height * 0.9) / 2;
      ctx.lineTo(x, cy - halfH);
    }
    
    // Bottom half
    for (let i = peaks.length - 1; i >= 0; i--) {
      const x = i * step;
      if (x > width) continue;
      const peak = Math.max(0.02, peaks[i]);
      const halfH = (peak * height * 0.9) / 2;
      ctx.lineTo(x, cy + halfH);
    }
    
    ctx.closePath();
    ctx.fill();

    // Center line for distinct dialogue start/end
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, cy - 0.5, width, 1);
  } else {
    // Bottom style
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      if (x > width) break;
      const peak = Math.max(0.02, peaks[i]);
      const barHeight = peak * height * 0.9;
      ctx.lineTo(x, height - barHeight);
    }
    // close path
    const lastValidX = Math.min(width, (peaks.length - 1) * step);
    ctx.lineTo(lastValidX, height);
    ctx.closePath();
    ctx.fill();
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
