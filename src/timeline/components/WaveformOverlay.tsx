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

  // Bar spacing: tighter for small mode, normal for full
  const BAR_W = small ? 1 : 2;
  const GAP = small ? 1 : 1;
  const STEP = BAR_W + GAP;

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
      // ── Thin bottom waveform for video clips ───────────────────────────
      const waveColor = color ?? 'rgba(255,255,255,0.45)';
      ctx.fillStyle = waveColor;
      for (let i = 0; i < peaks.length; i++) {
        const x = i * STEP;
        const barH = Math.max(1, peaks[i] * H);
        ctx.fillRect(x, H - barH, BAR_W, barH);
      }
      return;
    }

    // ── Full centered / mirrored waveform (audio tracks) ─────────────────
    // Parse the base color for gradient construction
    const baseColor = color ?? 'rgba(255,255,255,1)';
    const cy = H / 2;

    // Vertical gradient: brighter at center, fades toward top/bottom edges
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    // Parse color into components for gradient — build rgba variants
    // We'll use the baseColor for mid-point and a transparent version for edges
    grad.addColorStop(0,   replaceAlpha(baseColor, 0.25));
    grad.addColorStop(0.2, replaceAlpha(baseColor, 0.65));
    grad.addColorStop(0.5, replaceAlpha(baseColor, 0.90));
    grad.addColorStop(0.8, replaceAlpha(baseColor, 0.65));
    grad.addColorStop(1,   replaceAlpha(baseColor, 0.25));

    ctx.fillStyle = grad;

    for (let i = 0; i < peaks.length; i++) {
      const x = i * STEP;
      // Leave ~8% padding top and bottom so bars don't touch the clip edge
      const maxHalf = cy * 0.92;
      const halfH = Math.max(1.5, peaks[i] * maxHalf);

      // Draw mirrored bar centered on cy
      ctx.fillRect(x, cy - halfH, BAR_W, halfH * 2);
    }

    // Subtle center-line
    ctx.fillStyle = replaceAlpha(baseColor, 0.15);
    ctx.fillRect(0, cy - 0.5, W, 1);
  }, [peaks, width, height, small, color, BAR_W, GAP, STEP]);

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
