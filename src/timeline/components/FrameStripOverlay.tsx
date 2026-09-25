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

export function invalidateFrameStripCache(mediaId?: string) {
  if (mediaId) {
    stripCache.delete(mediaId);
  } else {
    stripCache.clear();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('procut-evict-media-cache', ((e: CustomEvent) => {
    if (e.detail?.id) stripCache.delete(e.detail.id);
    else stripCache.clear();
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
    const onEvict = (e: Event) => {
      const custom = e as CustomEvent;
      if (!custom.detail?.id || custom.detail.id === media?.id) {
        setLazyStrip(null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('procut-evict-media-cache', onEvict);
      return () => window.removeEventListener('procut-evict-media-cache', onEvict);
    }
  }, [media?.id]);

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
    const totalDuration = Math.max(
      0.01,
      media.duration && media.duration > 0
        ? media.duration
        : (speedFrameSegments && speedFrameSegments.length > 0
            ? Math.max(...speedFrameSegments.map((s) => Math.max(s.sourceStart, s.sourceEnd)), 1)
            : 1)
    );

    // ── Speed-frame-aware rendering: per-segment source→timeline mapping ──
    if (speedFrameSegments && speedFrameSegments.length > 0) {
      const thumbBaseWidth = Math.max(32, Math.min(80, Math.round((height || 36) * 1.5)));
      const allThumbs: { src: string; w: number }[] = [];

      for (const seg of speedFrameSegments) {
        const segTimelineDur = Math.max(0.001, seg.endOffset - seg.startOffset);
        // P1 FIX: guard the clip.duration denominator — a zero-duration clip with
        // speedFrames made segPx = Infinity → segThumbs = Infinity → infinite loop
        // (tab freeze). Also cap per-segment thumbs as a hard safety bound.
        const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
        const segPx = Math.max(1, (segTimelineDur / Math.max(clip.duration, 0.01)) * safeWidth);
        const segThumbs = Math.min(64, Math.max(1, Math.ceil(segPx / thumbBaseWidth)));
        const segThumbW = segPx / segThumbs;

        // Source range → frame strip indices
        const rawStart = Math.min(seg.sourceStart, seg.sourceEnd);
        const rawEnd = Math.max(seg.sourceStart, seg.sourceEnd);
        const srcStartRatio = Math.max(0, Math.min(0.999, rawStart / totalDuration));
        const srcEndRatio = Math.max(srcStartRatio + 0.001, Math.min(1, rawEnd / totalDuration));
        const startIdx = Math.max(0, Math.min(frameStrip.length - 1, Math.floor(srcStartRatio * frameStrip.length)));
        const endIdx = Math.max(startIdx + 1, Math.min(frameStrip.length, Math.ceil(srcEndRatio * frameStrip.length)));
        const segFrames = frameStrip.slice(startIdx, endIdx);
        const safeSegFrames = segFrames.length > 0 ? segFrames : [frameStrip[0]];

        for (let i = 0; i < segThumbs; i++) {
          const frameIdx = Math.floor((i / segThumbs) * safeSegFrames.length);
          allThumbs.push({
            src: safeSegFrames[Math.min(frameIdx, safeSegFrames.length - 1)],
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
    const safeTrimStart = Math.max(0, Math.min(totalDuration - 0.01, clip.trimStart || 0));
    const trimStartRatio = Math.max(0, Math.min(0.999, safeTrimStart / totalDuration));
    const visibleDuration = (clip.duration || 1) * (clip.speed || 1);
    const trimEndRatio = Math.max(trimStartRatio + 0.001, Math.min(1, (safeTrimStart + visibleDuration) / totalDuration));

    const startIndex = Math.max(0, Math.min(frameStrip.length - 1, Math.floor(trimStartRatio * frameStrip.length)));
    const endIndex = Math.max(startIndex + 1, Math.min(frameStrip.length, Math.ceil(trimEndRatio * frameStrip.length)));

    const visibleFrames = frameStrip.slice(startIndex, endIndex);
    const renderFrames = visibleFrames.length > 0 ? visibleFrames : [frameStrip[0]];
    
    // Dynamically calculate how many thumbnails fit into clip width without stretching
    const thumbWidth = Math.max(32, Math.min(80, Math.round((height || 36) * 1.5)));
    // P1 FIX: guard NaN width (Math.max(1, NaN) === NaN → silent empty render)
    const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
    // P2 PERF (progressive thumbs): cap at 64 and widen each thumb — a 5-hour
    // clip at zoom 1 produced 450 <img> nodes (the same 8 frames repeated ~56×,
    // each decoding a JPEG). Same frame boundaries, 64 nodes, one decode each.
    const numThumbs = Math.min(64, Math.max(1, Math.ceil(safeWidth / thumbWidth)));
    const singleThumbWidth = safeWidth / numThumbs;

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
