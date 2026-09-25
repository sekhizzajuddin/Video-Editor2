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

        let segSrc = src.slice(srcStartIdx, srcEndIdx);
        if (segSrc.length === 0) {
          segSrc = src.slice(0, Math.max(1, Math.floor(totalLen / 10)));
        }
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
      const mediaDuration = Math.max(0.01, media?.duration || clipDuration || 1);
      const effectiveSpeed = Math.max(0.01, speed || 1);
      
      const safeTrimStart = Math.max(0, Math.min(mediaDuration - 0.01, trimStart));
      const consumedMedia = clipDuration * effectiveSpeed;
      
      const startRatio = Math.max(0, Math.min(0.999, safeTrimStart / mediaDuration));
      const endRatio = Math.max(startRatio + 0.001, Math.min(1, (safeTrimStart + consumedMedia) / mediaDuration));
      
      const totalLen = src.length;
      const startIdx = Math.max(0, Math.min(totalLen - 1, Math.floor(startRatio * totalLen)));
      const endIdx = Math.max(startIdx + 1, Math.min(totalLen, Math.ceil(endRatio * totalLen)));
      
      const sliced = src.slice(startIdx, endIdx);
      finalSrc = sliced.length > 0 ? sliced : src;
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

    // ────────────────────────────────────────────────────────────────────────
    // CENTERED WAVEFORM (DaVinci Resolve style)
    // Both full audio clips and video clip audio strips render vertically
    // centered around cy = H / 2 with a clean baseline across the center.
    // ────────────────────────────────────────────────────────────────────────
    const cy = H / 2;
    const maxHalf = cy * (small ? 0.88 : 0.92);

    ctx.fillStyle = small
      ? `rgba(${r},${g},${b},0.80)`
      : `rgba(${r},${g},${b},0.85)`;

    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const halfH = peak * maxHalf;
      // For small (video) waveforms, lower the min bar threshold so even
      // quiet audio is visible in the 18px strip.
      const minBar = small ? 0.3 : 0.5;
      if (halfH < minBar) continue;
      ctx.fillRect(i * barW, cy - halfH, Math.max(barW, 0.75), halfH * 2);
    }

    // Center line — thin baseline so dialogue start/end is immediately visible
    ctx.fillStyle = small
      ? `rgba(${r},${g},${b},0.35)`
      : `rgba(${r},${g},${b},0.15)`;
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
