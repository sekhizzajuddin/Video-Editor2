import React, { useEffect, useRef, useMemo, useState } from 'react';
import type { MediaItem } from '@/types';
import type { SpeedFrameSegment } from '@/utils/speedRamp';
import { getWaveformFromDisk } from '@/utils/diskMediaCache';

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
 * Directly indexes into [srcStart, srcEnd] range without allocating intermediate sliced arrays.
 */
function resamplePeaksWindowed(
  src: number[],
  targetCount: number,
  srcStart = 0,
  srcEnd = src.length
): number[] {
  if (src.length === 0 || targetCount <= 0) return [];
  const safeStart = Math.max(0, Math.min(src.length - 1, srcStart));
  const safeEnd = Math.max(safeStart + 1, Math.min(src.length, srcEnd));
  const rangeLen = safeEnd - safeStart;
  const result = new Float32Array(targetCount);
  const ratio = rangeLen / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.min(safeEnd - 1, safeStart + Math.floor(i * ratio));
    const endIdx = Math.min(safeEnd, Math.max(startIdx + 1, safeStart + Math.ceil((i + 1) * ratio)));
    
    let max = 0;
    for (let k = startIdx; k < endIdx; k++) {
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

  const [diskPeaks, setDiskPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    if (!media) return;
    if (media.waveformPeaks && media.waveformPeaks.length > 0) return;
    let cancelled = false;
    getWaveformFromDisk(media.id).then((p) => {
      if (!cancelled && p && p.length > 0) {
        setDiskPeaks(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [media?.id, media?.waveformPeaks]);

  // ── One sample per CSS pixel — zero gap — solid DaVinci silhouette ─────
  const waveformPeaks = (media?.waveformPeaks && media.waveformPeaks.length > 0)
    ? media.waveformPeaks
    : (diskPeaks && diskPeaks.length > 0) ? diskPeaks : undefined;

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
      : new Array(Math.max(4, barCount)).fill(0);
        
    // ── Speed-frame-aware rendering: per-segment source→timeline mapping ──
    if (speedFrameSegments && speedFrameSegments.length > 0) {
      const mediaDuration = Math.max(
        0.01,
        (media?.duration && media.duration > 0)
          ? media.duration
          : Math.max(...speedFrameSegments.map((s) => Math.max(s.sourceStart, s.sourceEnd)), 1)
      );
      const totalLen = src.length;
      const totalTimelineDur = Math.max(0.01, clipDuration || 1);
      const result: number[] = [];

      for (const seg of speedFrameSegments) {
        // How many timeline pixels this segment occupies
        const segTimelineDur = Math.max(0.001, seg.endOffset - seg.startOffset);
        const segPixels = Math.max(1, Math.round((segTimelineDur / totalTimelineDur) * barCount));

        // Source range for this segment
        const rawStart = Math.min(seg.sourceStart, seg.sourceEnd);
        const rawEnd = Math.max(seg.sourceStart, seg.sourceEnd);
        const srcStartRatio = Math.max(0, Math.min(0.999, rawStart / mediaDuration));
        const srcEndRatio = Math.max(srcStartRatio + 0.001, Math.min(1, rawEnd / mediaDuration));
        const srcStartIdx = Math.max(0, Math.min(totalLen - 1, Math.floor(srcStartRatio * totalLen)));
        const srcEndIdx = Math.max(srcStartIdx + 1, Math.min(totalLen, Math.ceil(srcEndRatio * totalLen)));

        // Slice-free direct windowed sampling
        const segPeaks = resamplePeaksWindowed(src, segPixels, srcStartIdx, srcEndIdx);
        result.push(...segPeaks);
      }

      // Ensure result matches barCount exactly
      if (result.length > barCount) return result.slice(0, barCount);
      while (result.length < barCount) result.push(0);
      return result;
    }

    if (trimStart !== undefined && clipDuration !== undefined) {
      const effectiveSpeed = Math.max(0.01, speed || 1);
      const consumedMedia = clipDuration * effectiveSpeed;
      const mediaDuration = Math.max(
        0.01,
        (media?.duration && media.duration > 0)
          ? Math.max(media.duration, trimStart + consumedMedia)
          : (trimStart + consumedMedia)
      );
      
      const safeTrimStart = Math.max(0, Math.min(mediaDuration - 0.01, trimStart));
      
      const startRatio = Math.max(0, Math.min(0.999, safeTrimStart / mediaDuration));
      const endRatio = Math.max(startRatio + 0.001, Math.min(1, (safeTrimStart + consumedMedia) / mediaDuration));
      
      const totalLen = src.length;
      const startIdx = Math.max(0, Math.min(totalLen - 1, Math.floor(startRatio * totalLen)));
      const endIdx = Math.max(startIdx + 1, Math.min(totalLen, Math.ceil(endRatio * totalLen)));
      
      // Slice-free direct windowed sampling
      return resamplePeaksWindowed(src, barCount, startIdx, endIdx);
    }
    
    return resamplePeaksWindowed(src, barCount);
  }, [waveformPeaks, barCount, trimStart, clipDuration, speed, media?.duration, speedFrameSegments]);

  const [r, g, b] = useMemo(() => parseRGB(color ?? 'rgba(255,255,255,1)'), [color]);

  // Free canvas GPU surface only upon true unmount (virtualization)
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, []);

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
    const physW = Math.max(1, Math.min(Math.round(W * dpr), MAX_PHYS));
    const physH = Math.max(1, Math.min(Math.round(H * dpr), MAX_PHYS));

    // Resize canvas only when dimensions change
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    // Guard against browser failure to create context or 0-dimension canvas
    if (canvas.width === 0 || canvas.height === 0) return;

    // Reset transform cleanly — prevents DPR scale accumulation
    const scaleX = physW / W;
    const scaleY = physH / H;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (peaks.length === 0) return;

    // P2 PERF (LOD): bar width in logical px — 1px at normal zoom (identical to
    // the previous 1px-column rendering), wider bars when downsampled so the
    // silhouette stays solid with zero gaps.
    const barW = W / peaks.length;

    // ────────────────────────────────────────────────────────────────────────
    // CENTERED WAVEFORM (DaVinci Resolve style)
    // Both full audio clips and video clip audio strips render vertically
    // centered around cy = H / 2 with a clean baseline across the center.
    // ────────────────────────────────────────────────────────────────────────
    const cy = H / 2;
    const maxHalf = cy * (small ? 0.88 : 0.92);

    ctx.fillStyle = small
      ? `rgba(${r},${g},${b},0.90)`
      : `rgba(${r},${g},${b},0.85)`;

    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const halfH = peak * maxHalf;
      // For small (video) waveforms, lower the min bar threshold so even
      // quiet audio is visible in the 18px strip.
      const minBar = small ? 0.25 : 0.5;
      if (halfH < minBar) continue;
      ctx.fillRect(i * barW, cy - halfH, Math.max(barW, 0.75), halfH * 2);
    }

    // Center line — thin baseline so dialogue start/end is immediately visible
    ctx.fillStyle = small
      ? `rgba(${r},${g},${b},0.45)`
      : `rgba(${r},${g},${b},0.15)`;
    ctx.fillRect(0, cy - 0.5, W, 1);
  }, [peaks, width, height, small, r, g, b]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none w-full h-full"
      style={{ display: 'block' }}
    />
  );
});
