import { easeOutCubic, clamp01 } from '../motionGraphicEasing';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

export interface AnimatedBarChartConfig {
  bars: BarItem[];
  orientation?: 'vertical' | 'horizontal';
  title?: string;
  animationStyle?: 'stagger' | 'simultaneous';
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  fontFamily?: string;
  axisColor?: string;
  gridColor?: string;
}

function formatNumber(val: number): string {
  if (Math.abs(val - Math.round(val)) < 0.05) {
    return Math.round(val).toLocaleString();
  }
  return val.toFixed(1);
}

export const AnimatedBarChart = (
  ctx: CanvasRenderingContext2D,
  config: AnimatedBarChartConfig,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): void => {
  const bars = config.bars || [];
  if (bars.length === 0) return;

  const orientation = config.orientation || 'vertical';
  const animationStyle = config.animationStyle || 'stagger';
  const fontFamily = config.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
  const axisColor = config.axisColor || 'rgba(255, 255, 255, 0.3)';
  const gridColor = config.gridColor || 'rgba(255, 255, 255, 0.08)';

  const chartW = config.width ?? Math.min(canvasW * 0.72, 720);
  const chartH = config.height ?? Math.min(canvasH * 0.56, 420);
  const centerX = config.position?.x ?? canvasW / 2;
  const centerY = config.position?.y ?? canvasH / 2;

  const left = centerX - chartW / 2;
  const right = centerX + chartW / 2;
  const top = centerY - chartH / 2;
  const bottom = centerY + chartH / 2;

  const maxValue = Math.max(...bars.map((b) => b.value), 1);
  const defaultColors = ['#38bdf8', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa'];

  ctx.save();

  // Draw Title
  if (config.title) {
    ctx.font = `bold 22px ${fontFamily}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(config.title, centerX, top - 20);
  }

  if (orientation === 'vertical') {
    // 1. Draw Grid Lines & Value Ticks
    const gridSteps = 4;
    ctx.font = `12px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let s = 0; s <= gridSteps; s++) {
      const stepVal = (maxValue / gridSteps) * s;
      const stepY = bottom - (s / gridSteps) * (chartH * 0.85);

      ctx.save();
      ctx.strokeStyle = s === 0 ? axisColor : gridColor;
      ctx.lineWidth = 1;
      if (s > 0) ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(left, stepY);
      ctx.lineTo(right, stepY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText(formatNumber(stepVal), left - 12, stepY);
    }

    // 2. Draw Bars & Labels
    const slotW = (right - left) / bars.length;
    const barW = Math.min(slotW * 0.62, 60);

    bars.forEach((bar, i) => {
      let prog = 0;
      if (animationStyle === 'stagger') {
        const start = i * 0.15;
        const dur = Math.max(0.4, (totalDuration * 0.6) - (bars.length - 1) * 0.05);
        prog = clamp01((localTime - start) / dur);
      } else {
        const dur = Math.max(0.4, totalDuration * 0.6);
        prog = clamp01(localTime / dur);
      }

      const eased = easeOutCubic(prog);
      const currentVal = bar.value * eased;
      const barH = (currentVal / maxValue) * (chartH * 0.85);
      const barX = left + i * slotW + (slotW - barW) / 2;
      const barY = bottom - barH;
      const barColor = bar.color || defaultColors[i % defaultColors.length];

      // Draw Bar
      if (barH > 0) {
        ctx.fillStyle = barColor;
        ctx.beginPath();
        const r = Math.min(6, barW / 2, barH);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(barX, barY, barW, barH, [r, r, 0, 0]);
        } else {
          ctx.rect(barX, barY, barW, barH);
        }
        ctx.fill();

        // Top value count label
        if (prog > 0.05) {
          ctx.font = `bold 14px ${fontFamily}`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(formatNumber(currentVal), barX + barW / 2, barY - 6);
        }
      }

      // X-Axis Category Label
      ctx.font = `13px ${fontFamily}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(bar.label, barX + barW / 2, bottom + 10);
    });
  } else {
    // HORIZONTAL ORIENTATION
    const gridSteps = 4;
    const chartContentW = chartW * 0.82;
    const originX = left + chartW * 0.18;

    // Grid lines along X
    ctx.font = `12px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let s = 0; s <= gridSteps; s++) {
      const stepVal = (maxValue / gridSteps) * s;
      const stepX = originX + (s / gridSteps) * chartContentW;

      ctx.save();
      ctx.strokeStyle = s === 0 ? axisColor : gridColor;
      ctx.lineWidth = 1;
      if (s > 0) ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(stepX, top);
      ctx.lineTo(stepX, bottom);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText(formatNumber(stepVal), stepX, bottom + 8);
    }

    const slotH = (bottom - top) / bars.length;
    const barH = Math.min(slotH * 0.6, 36);

    bars.forEach((bar, i) => {
      let prog = 0;
      if (animationStyle === 'stagger') {
        const start = i * 0.15;
        const dur = Math.max(0.4, (totalDuration * 0.6) - (bars.length - 1) * 0.05);
        prog = clamp01((localTime - start) / dur);
      } else {
        const dur = Math.max(0.4, totalDuration * 0.6);
        prog = clamp01(localTime / dur);
      }

      const eased = easeOutCubic(prog);
      const currentVal = bar.value * eased;
      const barLen = (currentVal / maxValue) * chartContentW;
      const barY = top + i * slotH + (slotH - barH) / 2;
      const barColor = bar.color || defaultColors[i % defaultColors.length];

      // Y Category Label
      ctx.font = `13px ${fontFamily}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(bar.label, originX - 12, barY + barH / 2);

      // Draw horizontal bar
      if (barLen > 0) {
        ctx.fillStyle = barColor;
        ctx.beginPath();
        const r = Math.min(6, barH / 2, barLen);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(originX, barY, barLen, barH, [0, r, r, 0]);
        } else {
          ctx.rect(originX, barY, barLen, barH);
        }
        ctx.fill();

        // Right value label
        if (prog > 0.05) {
          ctx.font = `bold 14px ${fontFamily}`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatNumber(currentVal), originX + barLen + 10, barY + barH / 2);
        }
      }
    });
  }

  ctx.restore();
};
