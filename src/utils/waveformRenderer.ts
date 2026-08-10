/**
 * waveformRenderer.ts — DaVinci Resolve style waveform renderer.
 *
 * Renders 1px-wide columns with ZERO gap → solid continuous mountain silhouette.
 * Used by MediaPanel (mini preview) and standalone canvas generation.
 */

export interface WaveformRenderOptions {
  peaks: number[];
  width: number;
  height: number;
  color?: string;
  bgColor?: string;
  /** 'center' = symmetric around middle (default), 'bottom' = bars from bottom */
  style?: 'center' | 'bottom';
  barWidth?: number;
  barGap?: number;
}

/** Parse a CSS color string to an "r,g,b" string for rgba() template literals. */
function parseRGB(color: string): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  const h = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (h) {
    const hex = h[1];
    return `${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)}`;
  }
  return '255,255,255';
}

/**
 * Render waveform peaks onto a canvas 2D context.
 * The context must already be scaled for DPR by the caller if needed.
 */
export function renderWaveform(
  ctx: CanvasRenderingContext2D,
  options: WaveformRenderOptions
): void {
  const {
    peaks,
    width,
    height,
    color = 'rgba(255, 255, 255, 0.85)',
    bgColor,
    style = 'center',
    barWidth: customBarWidth,
    barGap = 0,
  } = options;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  if (peaks.length === 0) return;

  const barW = customBarWidth ?? 1; // 1px = DaVinci solid fill
  const step = barW + barGap;
  const rgb = parseRGB(color);

  if (style === 'center') {
    const cy = height / 2;
    const maxHalf = cy * 0.92;

    // Solid uniform fill — exactly like DaVinci Resolve
    ctx.fillStyle = `rgba(${rgb},0.85)`;

    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      if (x >= width) break;
      const peak = Math.max(0, peaks[i]);
      const halfH = peak * maxHalf;
      if (halfH < 0.5) continue;
      ctx.fillRect(x, cy - halfH, barW, halfH * 2);
    }

    // Subtle center line
    ctx.fillStyle = `rgba(${rgb},0.15)`;
    ctx.fillRect(0, cy - 0.5, width, 1);

  } else {
    // Bottom style — solid bars from bottom
    ctx.fillStyle = `rgba(${rgb},0.85)`;

    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      if (x >= width) break;
      const peak = Math.max(0, peaks[i]);
      const barH = peak * height * 0.92;
      if (barH < 0.5) continue;
      ctx.fillRect(x, height - barH, barW, barH);
    }
  }
}

/**
 * Create a standalone canvas element with a waveform rendered on it.
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
 * Generate a data URL of a waveform for use in <img> tags.
 */
export function renderWaveformToDataUrl(
  peaks: number[],
  width: number,
  height: number,
  color = 'rgba(52, 211, 153, 0.85)',
  style: 'center' | 'bottom' = 'center'
): string {
  const canvas = createWaveformCanvas(peaks, width, height, color, style);
  return canvas.toDataURL('image/png');
}
