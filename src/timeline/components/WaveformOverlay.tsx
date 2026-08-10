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
 * Linearly interpolate a peaks array to exactly `targetCount` samples.
 * One sample per CSS pixel → solid continuous fill with no gaps.
 */
function resamplePeaks(src: number[], targetCount: number): number[] {
  if (src.length === 0 || targetCount <= 0) return [];
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

/** Parse any CSS color string to [r, g, b]. */
function parseRGB(color: string): [number, number, number] {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (h) {
    const hex = h[1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
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

  // ── One sample per CSS pixel — zero gap — solid DaVinci silhouette ─────
  const waveformPeaks = media?.waveformPeaks;
  const barCount = useMemo(() => Math.max(Math.round(width), 4), [width]);

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

    // Resize canvas only when dimensions change
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }

    // Reset transform cleanly — prevents DPR scale accumulation
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (peaks.length === 0) return;

    if (small) {
      // ──────────────────────────────────────────────────────────────────────
      // SMALL: thin bottom waveform strip inside video clips
      // 1px columns, no gap, solid fill
      // ──────────────────────────────────────────────────────────────────────
      ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
      for (let i = 0; i < peaks.length; i++) {
        if (i >= W) break;
        const peak = peaks[i];
        const barH = peak * H;
        if (barH < 0.5) continue; // true silence = nothing
        ctx.fillRect(i, H - barH, 1, barH);
      }
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // FULL: DaVinci Resolve style centered waveform
    //
    // How DaVinci does it:
    //   - 1px-wide columns, ZERO gap → solid continuous mountain silhouette
    //   - Mirrored symmetrically around the vertical center
    //   - Single solid color (slightly translucent white on colored track bg)
    //   - Silence = waveform collapses to nothing (just center line visible)
    //   - No gradient fade, no "core spine" — just a solid filled shape
    // ────────────────────────────────────────────────────────────────────────
    const cy = H / 2;
    const maxHalf = cy * 0.92; // 8% padding so peaks don't clip the edge

    // Single solid color — DaVinci uses uniform opacity, not a gradient
    ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;

    for (let i = 0; i < peaks.length; i++) {
      if (i >= W) break;
      const peak = peaks[i];
      const halfH = peak * maxHalf;
      if (halfH < 0.5) continue; // true silence = skip (center line shows through)
      ctx.fillRect(i, cy - halfH, 1, halfH * 2);
    }

    // Center line — thin baseline so you can spot exactly where dialogue
    // starts/ends (the waveform opens up from this line)
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
    ctx.fillRect(0, cy - 0.5, W, 1);
  }, [peaks, width, height, small, r, g, b]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ display: 'block' }}
    />
  );
});
