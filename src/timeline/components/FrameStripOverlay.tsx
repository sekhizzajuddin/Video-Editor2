import React, { useEffect, useState } from 'react';
import type { MediaItem } from '@/types';
import { seededRandom } from '../timelineUtils';
import { generateFrameStripOnDemand } from '@/utils/mediaProbe';

interface FrameStripOverlayProps {
  media: MediaItem | null;
  clip: import('@/types').TimelineClip;
  width: number;
  height: number;
}

// Cache of generated frame strips per media URL, so we only decode once per media item.
const stripCache = new Map<string, string[]>();

export const FrameStripOverlay = React.memo(function FrameStripOverlay({
  media,
  clip,
  width,
  height,
}: FrameStripOverlayProps) {
  const cachedStrip = media ? stripCache.get(media.url) : undefined;
  const [lazyStrip, setLazyStrip] = useState<string[] | null>(null);

  useEffect(() => {
    if (!media) return;
    if (media.frameStrip && media.frameStrip.length > 0) return;
    if (stripCache.has(media.url)) return;
    if (!media.url || media.url === 'PENDING_RESTORE') return;
    let cancelled = false;
    generateFrameStripOnDemand(media.url, media.duration || 0, 8, 120)
      .then((strip) => {
        if (cancelled) return;
        stripCache.set(media.url, strip);
        setLazyStrip(strip);
      })
      .catch(() => {
        // ignore — fallback blocks render below
      });
    return () => {
      cancelled = true;
    };
  }, [media]);

  const frameStrip = media?.frameStrip && media.frameStrip.length > 0
    ? media.frameStrip
    : cachedStrip ?? lazyStrip ?? undefined;

  if (frameStrip && frameStrip.length > 0 && media) {
    const totalDuration = media.duration || 1;
    const trimStartRatio = Math.max(0, clip.trimStart / totalDuration);
    const visibleDuration = clip.duration * clip.speed;
    const trimEndRatio = Math.min(1, (clip.trimStart + visibleDuration) / totalDuration);

    const startIndex = Math.max(0, Math.floor(trimStartRatio * frameStrip.length));
    const endIndex = Math.min(frameStrip.length, Math.ceil(trimEndRatio * frameStrip.length));

    const visibleFrames = frameStrip.slice(startIndex, endIndex);
    const renderFrames = visibleFrames.length > 0 ? visibleFrames : [frameStrip[0]];
    const frameWidth = width / renderFrames.length;

    return (
      <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
        {renderFrames.map((src, i) => (
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
  const rng = seededRandom(clip.id + '_frames');
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
