import React from 'react';
import type { MediaItem } from '@/types';
import { generateFallbackWaveform } from '../timelineUtils';

interface WaveformOverlayProps {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
  small?: boolean;
}

export const WaveformOverlay = React.memo(function WaveformOverlay({
  media,
  clipId,
  width,
  height,
  small,
}: WaveformOverlayProps) {
  const barSpacing = small ? 2 : 3;
  const barCount = Math.max(Math.floor(width / barSpacing), 4);

  let peaks: number[];
  if (media?.waveformPeaks && media.waveformPeaks.length > 0) {
    const src = media.waveformPeaks;
    peaks = [];
    for (let i = 0; i < barCount; i++) {
      const srcIdx = (i / barCount) * src.length;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, src.length - 1);
      const frac = srcIdx - lo;
      peaks.push(src[lo] * (1 - frac) + src[hi] * frac);
    }
  } else {
    peaks = generateFallbackWaveform(clipId, barCount);
  }

  const barColor = small ? 'bg-emerald-300/50' : 'bg-white/40';

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex items-end px-0.5 pointer-events-none gap-px"
      style={{ height: `${height}px` }}
    >
      {peaks.map((peak, i) => (
        <div
          key={i}
          className={`flex-1 ${barColor} rounded-sm`}
          style={{
            height: `${Math.max(4, peak * 100)}%`,
            minHeight: '2px',
          }}
        />
      ))}
    </div>
  );
});

