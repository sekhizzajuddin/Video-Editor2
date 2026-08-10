/**
 * waveformRenderer.ts — Audacity / DaVinci Resolve style waveform renderer.
 *
 * Renders individual vertical bar columns, NOT a single filled polygon.
 * Each bar = one audio chunk.  Silent chunks = very short bar.  Loud = tall.
 *
 * Used by MediaPanel (mini preview) and WaveformViewer (trim panel).
 */

export interface WaveformRenderOptions {
  peaks: number[];
  width: number;
  height: number;
  color?: string;
  bgColor?: string;
  /** 'center' = symmetric bars around vertical midpoint (default), 'bottom' = bars anchored to bottom */
  style?: 'center' | 'bottom';
  barWidth?: number;
  barGap?: number;
}

/**
 * Render a waveform onto an existing 2D canvas context.
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
    color = 'rgba(255, 255, 255, 0.8)',
    bgColor,
    style = 'center',
    barWidth: customBarWidth,
    barGap = 1,
  } = options;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  if (peaks.length === 0) return;

  // Auto-size bars to fill the canvas width if no custom size provided
  const barW = customBarWidth ?? Math.max(1, Math.floor((width / peaks.length) * 0.8));
  const step = Math.max(barW + barGap, Math.ceil(width / peaks.length));

  // Parse color into components for dynamic alpha
  const rgb = parseRGB(color);

  if (style === 'center') {
    const cy = height / 2;
    const maxHalf = cy * 0.92;

    // Gradient spanning the full height
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0,    `rgba(${rgb},0.28)`);
    grad.addColorStop(0.20, `rgba(${rgb},0.72)`);
    grad.addColorStop(0.45, `rgba(${rgb},0.96)`);
    grad.addColorStop(0.50, `rgba(${rgb},1.00)`);
    grad.addColorStop(0.55, `rgba(${rgb},0.96)`);
    grad.addColorStop(0.80, `rgba(${rgb},0.72)`);
    grad.addColorStop(1,    `rgba(${rgb},0.28)`);

    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      if (x >= width) break;

      const peak = Math.max(0, peaks[i]);
      const halfH = Math.max(1, peak * maxHalf);

      // Outer bar with gradient
      ctx.fillStyle = grad;
      ctx.fillRect(x, cy - halfH, barW, halfH * 2);

      // Bright core spine — the "lit centre" that DaVinci uses
      const coreH = halfH * 0.35;
      const coreAlpha = 0.30 + peak * 0.60;
      ctx.fillStyle = `rgba(${rgb},${coreAlpha})`;
      ctx.fillRect(x, cy - coreH, barW, coreH * 2);
    }

    // Subtle center line
    ctx.fillStyle = `rgba(${rgb},0.20)`;
    ctx.fillRect(0, cy - 0.5, width, 1);

  } else {
    // Bottom style — used for mini previews
    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      if (x >= width) break;

      const peak = Math.max(0, peaks[i]);
      const barH = Math.max(1, peak * height * 0.92);
      const alpha = 0.35 + peak * 0.55;
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.fillRect(x, height - barH, barW, barH);
    }
  }
}

/** Parse a CSS color string to an "r,g,b" string for rgba() template literals. */
function parseRGB(color: string): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  const h = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (h) {
    const hex = h[1];
    return `${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)}`;
  }
  return '255,255,255';
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
  color = 'rgba(52, 211, 153, 0.8)',
  style: 'center' | 'bottom' = 'center'
): string {
  const canvas = createWaveformCanvas(peaks, width, height, color, style);
  return canvas.toDataURL('image/png');
}
