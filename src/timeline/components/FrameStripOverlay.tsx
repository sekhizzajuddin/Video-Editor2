import React, { useEffect, useState } from 'react';
import type { MediaItem } from '@/types';
import { seededRandom } from '../timelineUtils';
import { generateFrameStripOnDemand } from '@/utils/mediaProbe';
import type { SpeedFrameSegment } from '@/utils/speedRamp';

interface FrameStripOverlayProps {
  media: MediaItem | null;
  clip: import('@/types').TimelineClip;
  width: number;
  height: number;
  /** Speed frame segments for per-segment stretched/squeezed frame strip rendering. */
  speedFrameSegments?: SpeedFrameSegment[];
}

// Cache of generated frame strips per media item, so we only decode once per
// media item. Keyed by media id (stable across blob-URL restores) and purged
// when the media is removed (the store dispatches 'procut-evict-media-cache'
// on removeMedia — previously these JPEG data-URL arrays accumulated for the
// whole session with no eviction).
const stripCache = new Map<string, string[]>();
if (typeof window !== 'undefined') {
  window.addEventListener('procut-evict-media-cache', ((e: CustomEvent) => {
    if (e.detail?.id) stripCache.delete(e.detail.id);
  }) as EventListener);
}

export const FrameStripOverlay = React.memo(function FrameStripOverlay({
  media,
  clip,
  width,
  height,
  speedFrameSegments,
}: FrameStripOverlayProps) {
  const cachedStrip = media ? stripCache.get(media.id) : undefined;
  const [lazyStrip, setLazyStrip] = useState<string[] | null>(null);

  useEffect(() => {
    if (!media) return;
    if (media.frameStrip && media.frameStrip.length > 0) return;
    if (stripCache.has(media.id)) return;
    if (!media.url || media.url === 'PENDING_RESTORE') return;
    let cancelled = false;
    generateFrameStripOnDemand(media.url, media.duration || 0, 8, 120)
      .then((strip) => {
        if (cancelled) return;
        stripCache.set(media.id, strip);
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
    const totalDuration = media.duration && media.duration > 0
      ? media.duration
      : (speedFrameSegments && speedFrameSegments.length > 0
          ? Math.max(...speedFrameSegments.map((s) => s.sourceEnd), 1)
          : 1);

    // ── Speed-frame-aware rendering: per-segment source→timeline mapping ──
    if (speedFrameSegments && speedFrameSegments.length > 0) {
      const thumbBaseWidth = Math.max(32, Math.min(80, Math.round((height || 36) * 1.5)));
      const allThumbs: { src: string; w: number }[] = [];

      for (const seg of speedFrameSegments) {
        const segTimelineDur = seg.endOffset - seg.startOffset;
        const segPx = Math.max(1, (segTimelineDur / clip.duration) * width);
        const segThumbs = Math.max(1, Math.ceil(segPx / thumbBaseWidth));
        const segThumbW = segPx / segThumbs;

        // Source range → frame strip indices
        const srcStartRatio = Math.max(0, seg.sourceStart / totalDuration);
        const srcEndRatio = Math.min(1, seg.sourceEnd / totalDuration);
        const startIdx = Math.max(0, Math.floor(srcStartRatio * frameStrip.length));
        const endIdx = Math.min(frameStrip.length, Math.ceil(srcEndRatio * frameStrip.length));
        const segFrames = frameStrip.slice(startIdx, Math.max(startIdx + 1, endIdx));

        for (let i = 0; i < segThumbs; i++) {
          const frameIdx = Math.floor((i / segThumbs) * segFrames.length);
          allThumbs.push({
            src: segFrames[Math.min(frameIdx, segFrames.length - 1)],
            w: segThumbW,
          });
        }
      }

      return (
        <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
          {allThumbs.map((t, i) => (
            <img
              key={i}
              src={t.src}
              alt=""
              draggable={false}
              className="h-full object-cover shrink-0 border-r border-white/5"
              style={{ width: `${t.w}px` }}
            />
          ))}
        </div>
      );
    }

    // ── Standard flat-speed rendering ──
    const trimStartRatio = Math.max(0, clip.trimStart / totalDuration);
    const visibleDuration = clip.duration * (clip.speed || 1);
    const trimEndRatio = Math.min(1, (clip.trimStart + visibleDuration) / totalDuration);

    const startIndex = Math.max(0, Math.floor(trimStartRatio * frameStrip.length));
    const endIndex = Math.min(frameStrip.length, Math.ceil(trimEndRatio * frameStrip.length));

    const visibleFrames = frameStrip.slice(startIndex, Math.max(startIndex + 1, endIndex));
    const renderFrames = visibleFrames.length > 0 ? visibleFrames : [frameStrip[0]];
    
    // Dynamically calculate how many thumbnails fit into clip width without stretching
    const thumbWidth = Math.max(32, Math.min(80, Math.round((height || 36) * 1.5)));
    const numThumbs = Math.max(1, Math.ceil(width / thumbWidth));
    const singleThumbWidth = width / numThumbs;

    const displayThumbs: string[] = [];
    for (let i = 0; i < numThumbs; i++) {
      const frameIdx = Math.floor((i / numThumbs) * renderFrames.length);
      displayThumbs.push(renderFrames[Math.min(frameIdx, renderFrames.length - 1)]);
    }

    return (
      <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
        {displayThumbs.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className="h-full object-cover shrink-0 border-r border-white/5"
            style={{ width: `${singleThumbWidth}px` }}
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
