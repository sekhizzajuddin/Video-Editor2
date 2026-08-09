import React, { useEffect, useRef, useMemo } from 'react';
import type { MediaItem } from '@/types';
import { generateFallbackWaveform } from '../timelineUtils';

interface WaveformOverlayProps {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
  /** When true, render a thin single-sided waveform (used inside video clips). */
  small?: boolean;
  /** Override waveform color (CSS color string). Falls back to white. */
  color?: string;
}

function interpolatePeaks(src: number[], targetCount: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    const srcIdx = (i / targetCount) * src.length;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, src.length - 1);
    const frac = srcIdx - lo;
    result.push(src[lo] * (1 - frac) + src[hi] * frac);
  }
  return result;
}

export const WaveformOverlay = React.memo(function WaveformOverlay({
  media,
  clipId,
  width,
  height,
  small = false,
  color,
}: WaveformOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use a continuous path, so step is just 1 or 2 to make it dense and solid.
  const STEP = small ? 1 : 2;
  const barCount = Math.max(Math.floor(width / STEP), 4);

  const peaks = useMemo(() => {
    const src =
      media?.waveformPeaks && media.waveformPeaks.length > 0
        ? media.waveformPeaks
        : generateFallbackWaveform(clipId, barCount);
    return interpolatePeaks(src, barCount);
  }, [media, clipId, barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(width);
    const H = Math.round(height);

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    if (small) {
      // ── Thin bottom waveform for video clips (continuous path) ─────────
      const waveColor = color ?? 'rgba(255,255,255,0.45)';
      ctx.fillStyle = waveColor;
      
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < peaks.length; i++) {
        const x = i * STEP;
        const barH = Math.max(1, peaks[i] * H);
        ctx.lineTo(x, H - barH);
      }
      ctx.lineTo((peaks.length - 1) * STEP, H);
      ctx.closePath();
      ctx.fill();
      return;
    }

    // ── Full centered / mirrored waveform (audio tracks) ─────────────────
    const baseColor = color ?? '#1e293b'; // slightly darker fallback
    const cy = H / 2;

    // Professional waveform look: solid shape, sharper gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   replaceAlpha(baseColor, 0.4));
    grad.addColorStop(0.3, replaceAlpha(baseColor, 0.9));
    grad.addColorStop(0.5, replaceAlpha(baseColor, 1.0));
    grad.addColorStop(0.7, replaceAlpha(baseColor, 0.9));
    grad.addColorStop(1,   replaceAlpha(baseColor, 0.4));

    ctx.fillStyle = grad;

    ctx.beginPath();
    // Top half
    ctx.moveTo(0, cy);
    for (let i = 0; i < peaks.length; i++) {
      const x = i * STEP;
      const maxHalf = cy * 0.92;
      const halfH = Math.max(1.5, peaks[i] * maxHalf);
      ctx.lineTo(x, cy - halfH);
    }
    // Bottom half
    for (let i = peaks.length - 1; i >= 0; i--) {
      const x = i * STEP;
      const maxHalf = cy * 0.92;
      const halfH = Math.max(1.5, peaks[i] * maxHalf);
      ctx.lineTo(x, cy + halfH);
    }
    ctx.closePath();
    ctx.fill();

    // Prominent center-line to help spot dialogue start/end
    ctx.fillStyle = replaceAlpha(baseColor, 0.5);
    ctx.fillRect(0, cy - 0.5, W, 1);
  }, [peaks, width, height, small, color, STEP]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ display: 'block' }}
    />
  );
});

/** Replace / inject an alpha value into any CSS color string. */
function replaceAlpha(color: string, alpha: number): string {
  // Already rgba(...)
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }
  // Hex: convert to rgba
  const hexMatch = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const h = hexMatch[1];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // Fallback
  return `rgba(255,255,255,${alpha})`;
}
