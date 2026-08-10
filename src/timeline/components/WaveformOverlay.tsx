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

/**
 * Linearly interpolate a peaks array to a target bar count.
 * Also smooths via a 3-sample average for a cleaner look.
 */
function resamplePeaks(src: number[], targetCount: number): number[] {
  if (src.length === 0 || targetCount === 0) return [];
  const result = new Array<number>(targetCount);
  for (let i = 0; i < targetCount; i++) {
    const srcIdx = (i / targetCount) * src.length;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, src.length - 1);
    const frac = srcIdx - lo;
    result[i] = src[lo] * (1 - frac) + src[hi] * frac;
  }
  return result;
}

/** Parse any CSS color string to [r, g, b] components. */
function parseRGB(color: string): [number, number, number] {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (h) {
    const hex = h[1];
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  return [255, 255, 255];
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

  // ── Bar geometry ───────────────────────────────────────────────────────────
  // Audacity/DaVinci use narrow bars with tiny gaps.
  // small = video audio strip (1 px bars), full = audio track (2 px bars, 1 px gap)
  const BAR_W = small ? 1 : 2;
  const BAR_GAP = small ? 0 : 1;
  const STEP = BAR_W + BAR_GAP;

  // Stable memo: only depends on waveformPeaks array reference + clipId + barCount
  const waveformPeaks = media?.waveformPeaks;
  const barCount = useMemo(() => Math.max(Math.floor(width / STEP), 4), [width, STEP]);

  const peaks = useMemo(() => {
    const src =
      waveformPeaks && waveformPeaks.length > 0
        ? waveformPeaks
        : generateFallbackWaveform(clipId, barCount);
    return resamplePeaks(src, barCount);
  }, [waveformPeaks, clipId, barCount]);

  const [r, g, b] = useMemo(() => parseRGB(color ?? 'rgba(255,255,255,1)'), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(width));
    const H = Math.max(1, Math.round(height));
    const physW = W * dpr;
    const physH = H * dpr;

    // Resize canvas (this also resets the transform — so no accumulation)
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }

    // Reset transform cleanly — avoids DPR scale accumulation across re-renders
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (peaks.length === 0) return;

    if (small) {
      // ──────────────────────────────────────────────────────────────────────
      // SMALL: thin bottom waveform strip for video clips
      // Audacity-style: individual bottom-anchored bars
      // ──────────────────────────────────────────────────────────────────────
      for (let i = 0; i < peaks.length; i++) {
        const x = i * STEP;
        if (x >= W) break;
        const peak = peaks[i];
        const barH = Math.max(1, peak * H);
        const alpha = 0.35 + peak * 0.55; // dim at silence, bright at loud
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(x, H - barH, BAR_W, barH);
      }
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // FULL: Audacity / DaVinci Resolve style centered waveform
    //
    // Each bar is an independent vertical column drawn from (cy - halfH) to
    // (cy + halfH).  No continuous polygon — bars are independent so silence
    // truly collapses to a thin line.
    //
    // Two-pass render for depth:
    //   Pass 1 — dimmer shadow bar (full height) gives the "fill" body
    //   Pass 2 — bright center core bar (inner 40%) gives the bright spine
    // ────────────────────────────────────────────────────────────────────────
    const cy = H / 2;
    const maxHalf = cy * 0.92; // 8% padding from edge

    // Build a vertical gradient matching the clip height
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,    `rgba(${r},${g},${b},0.30)`);
    grad.addColorStop(0.20, `rgba(${r},${g},${b},0.70)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},0.95)`);
    grad.addColorStop(0.50, `rgba(${r},${g},${b},1.00)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},0.95)`);
    grad.addColorStop(0.80, `rgba(${r},${g},${b},0.70)`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0.30)`);

    for (let i = 0; i < peaks.length; i++) {
      const x = i * STEP;
      if (x >= W) break;

      const peak = peaks[i];
      const halfH = Math.max(1, peak * maxHalf);

      // Outer body bar
      ctx.fillStyle = grad;
      ctx.fillRect(x, cy - halfH, BAR_W, halfH * 2);

      // Bright core spine (inner 35%) — gives the DaVinci "lit center" look
      const coreH = halfH * 0.35;
      ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + peak * 0.55})`;
      ctx.fillRect(x, cy - coreH, BAR_W, coreH * 2);
    }

    // Center line — helps identify exactly where dialogue starts/ends
    ctx.fillStyle = `rgba(${r},${g},${b},0.20)`;
    ctx.fillRect(0, cy - 0.5, W, 1);
  }, [peaks, width, height, small, r, g, b, BAR_W, STEP]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ display: 'block' }}
    />
  );
});
