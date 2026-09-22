import React, { useEffect, useRef, useMemo } from 'react';
import type { MediaItem } from '@/types';
import type { SpeedFrameSegment } from '@/utils/speedRamp';

interface WaveformOverlayProps {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
  /** When true, render a thin single-sided waveform (used inside video clips). */
  small?: boolean;
  /** Override waveform color (CSS color string). Falls back to white. */
  color?: string;
  trimStart?: number;
  clipDuration?: number;
  speed?: number;
  /** Speed frame segments for per-segment stretched/squeezed waveform rendering. */
  speedFrameSegments?: SpeedFrameSegment[];
}

/**
 * Downsample a high-density peak array to screen pixels using windowed maximum peak sampling.
 * Unlike linear interpolation (which blurs zero-silence gaps into neighboring peaks),
 * windowed max sampling preserves exact sharp dialogue transients and clean zero-level silences.
 */
function resamplePeaksWindowed(src: number[], targetCount: number): number[] {
  if (src.length === 0 || targetCount <= 0) return [];
  const result = new Float32Array(targetCount);
  const srcLen = src.length;
  const ratio = srcLen / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.floor(i * ratio);
    const endIdx = Math.max(startIdx + 1, Math.ceil((i + 1) * ratio));
    
    let max = 0;
    for (let k = startIdx; k < endIdx && k < srcLen; k++) {
      const val = src[k];
      if (val > max) max = val;
    }
    
    // Silence thresholding: if peak is below 0.015, drop to clean 0 baseline
    result[i] = max < 0.015 ? 0 : max;
  }
  return Array.from(result);
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
  trimStart,
  clipDuration,
  speed,
  speedFrameSegments,
}: WaveformOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── One sample per CSS pixel — zero gap — solid DaVinci silhouette ─────
  const waveformPeaks = media?.waveformPeaks;
  const barCount = useMemo(() => {
    // P2 PERF (LOD): 1 sample/px up to 4000 bars; for wider clips the peaks are
    // downsampled and the bars are widened (barW = W / barCount in the painter)
    // so a 5-hour clip renders without a giant backing store or rect storm.
    const w = Number.isFinite(width) && width > 0 ? width : 4;
    return Math.min(Math.max(Math.round(w), 4), 4000);
  }, [width]);

  const peaks = useMemo(() => {
    const src = waveformPeaks && waveformPeaks.length > 0
      ? waveformPeaks
      // P4 FIX: the fake fallback waveform (plausible speech cadence) was
      // visually indistinguishable from real audio — actively misleading.
      // Honest flatline instead; the probe-failure toast tells the user why.
      : new Array(Math.max(4, barCount)).fill(0);
        
    // ── Speed-frame-aware rendering: per-segment source→timeline mapping ──
    if (speedFrameSegments && speedFrameSegments.length > 0) {
      const mediaDuration = media?.duration && media.duration > 0
        ? media.duration
        : Math.max(...speedFrameSegments.map((s) => s.sourceEnd), 1);
      const totalLen = src.length;
      const totalTimelineDur = clipDuration || 1;
      const result: number[] = [];

      for (const seg of speedFrameSegments) {
        // How many timeline pixels this segment occupies
        const segTimelineDur = seg.endOffset - seg.startOffset;
        const segPixels = Math.max(1, Math.round((segTimelineDur / totalTimelineDur) * barCount));

        // Source range for this segment
        const srcStartRatio = Math.max(0, seg.sourceStart / mediaDuration);
        const srcEndRatio = Math.min(1, seg.sourceEnd / mediaDuration);
        const srcStartIdx = Math.max(0, Math.floor(srcStartRatio * totalLen));
        const srcEndIdx = Math.max(srcStartIdx + 1, Math.min(totalLen, Math.ceil(srcEndRatio * totalLen)));

        const segSrc = src.slice(srcStartIdx, srcEndIdx);
        const segPeaks = resamplePeaksWindowed(segSrc, segPixels);
        result.push(...segPeaks);
      }

      // Ensure result matches barCount exactly
      if (result.length > barCount) return result.slice(0, barCount);
      while (result.length < barCount) result.push(0);
      return result;
    }

    let finalSrc = src;
    if (trimStart !== undefined && clipDuration !== undefined) {
      const mediaDuration = media?.duration || 1;
      const effectiveSpeed = speed || 1;
      
      const startRatio = trimStart / mediaDuration;
      const consumedMedia = clipDuration * effectiveSpeed;
      const endRatio = Math.min(1, (trimStart + consumedMedia) / mediaDuration);
      
      const totalLen = src.length;
      const startIdx = Math.max(0, Math.floor(startRatio * totalLen));
      const endIdx = Math.max(startIdx + 1, Math.min(totalLen, Math.ceil(endRatio * totalLen)));
      
      finalSrc = src.slice(startIdx, endIdx);
    }
    
    return resamplePeaksWindowed(finalSrc, barCount);
  }, [waveformPeaks, barCount, trimStart, clipDuration, speed, media?.duration, speedFrameSegments]);

  const [r, g, b] = useMemo(() => parseRGB(color ?? 'rgba(255,255,255,1)'), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(width));
    const H = Math.max(1, Math.round(height));
    // P2 FIX: clamp the backing store — a 5-hour clip at zoom 2 produced a
    // 72,000px canvas (blank in Firefox beyond 32,767px; ~28MB backing in
    // Chrome per clip). The CSS width still spans the full clip; only the
    // bitmap resolution is capped and the bars scale accordingly.
    const MAX_PHYS = 16384; // safe under every browser's canvas limit
    const physW = Math.min(W * dpr, MAX_PHYS);
    const physH = Math.min(H * dpr, MAX_PHYS);

    // Resize canvas only when dimensions change
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    // P4 FIX: if the browser rejected the resize (over its limits), don't draw
    // into a broken bitmap — skip silently rather than paint garbage.
    if (canvas.width !== physW || canvas.height !== physH) return;

    // Reset transform cleanly — prevents DPR scale accumulation
    const scaleX = physW / W;
    ctx.setTransform(scaleX, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (peaks.length === 0) return;

    // P2 PERF (LOD): bar width in logical px — 1px at normal zoom (identical to
    // the previous 1px-column rendering), wider bars when downsampled so the
    // silhouette stays solid with zero gaps.
    const barW = W / peaks.length;

    if (small) {
      // ──────────────────────────────────────────────────────────────────────
      // SMALL: thin bottom waveform strip inside video clips
      // 1px columns, no gap, solid fill
      // ──────────────────────────────────────────────────────────────────────
      ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
      for (let i = 0; i < peaks.length; i++) {
        const peak = peaks[i];
        const barH = peak * H;
        if (barH < 0.5) continue; // true silence = nothing
        ctx.fillRect(i * barW, H - barH, Math.max(barW, 0.75), barH);
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
      const peak = peaks[i];
      const halfH = peak * maxHalf;
      if (halfH < 0.5) continue; // true silence = skip (center line shows through)
      ctx.fillRect(i * barW, cy - halfH, Math.max(barW, 0.75), halfH * 2);
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
