import React from 'react';
import type { MediaItem } from '@/types';
import { seededRandom } from '../timelineUtils';

interface FrameStripOverlayProps {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
}

export const FrameStripOverlay = React.memo(function FrameStripOverlay({
  media,
  clipId,
  width,
  height,
}: FrameStripOverlayProps) {
  const frameStrip = media?.frameStrip;

  if (frameStrip && frameStrip.length > 0) {
    const frameWidth = width / frameStrip.length;
    return (
      <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
        {frameStrip.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className="h-full object-cover shrink-0 border-r border-white/5"
            style={{ width: `${frameWidth}px` }}
          />
        ))}
      </div>
    );
  }

  const count = Math.max(Math.floor(width / 28), 2);
  const rng = seededRandom(clipId + '_frames');
  const blocks: number[] = [];
  for (let i = 0; i < count; i++) blocks.push(rng());
  const blockW = width / count;

  return (
    <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
      {blocks.map((intensity, i) => (
        <div
          key={i}
          className="h-full border-r border-white/5"
          style={{
            width: `${blockW}px`,
            backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.3})`,
          }}
        />
      ))}
    </div>
  );
});
