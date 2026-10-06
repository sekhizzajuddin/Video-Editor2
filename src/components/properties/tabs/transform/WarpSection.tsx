import React, { useState } from 'react';
import type { TimelineClip, CornerPoints } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { trackMotion } from '@/utils/motionTracker';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import { toast } from 'sonner';
import { Wand2, Loader2, RotateCcw } from 'lucide-react';

interface WarpSectionProps {
  clip: TimelineClip;
  updateClip: (id: string, updates: any) => void;
}

export function WarpSection({ clip, updateClip }: WarpSectionProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);

  const { tracks, mediaLibrary, currentTime } = useEditorStore((state) => ({
    tracks: state.tracks,
    mediaLibrary: state.mediaLibrary,
    currentTime: state.currentTime,
  }));

  const { videoElements } = useMediaPlayback(false);

  const handleResetCorners = () => {
    const newAnimations = { ...(clip.animations || {}) };
    for (let i = 0; i < 4; i++) {
      delete newAnimations[`transform.perspectiveCorners.x${i}`];
      delete newAnimations[`transform.perspectiveCorners.y${i}`];
    }
    const aX = clip.transform.x;
    const aY = clip.transform.y;
    const w = (clip as any).width || 854;
    const h = (clip as any).height || 480;
    const scale = (clip.transform.scale || 100) / 100;
    const cx = 854 / 2 + aX;
    const cy = 480 / 2 + aY;
    const w2 = (w * scale) / 2;
    const h2 = (h * scale) / 2;
    const defaultCorners: CornerPoints = {
      x0: cx - w2, y0: cy - h2,
      x1: cx + w2, y1: cy - h2,
      x2: cx + w2, y2: cy + h2,
      x3: cx - w2, y3: cy + h2
    };

    updateClip(clip.id, {
      transform: {
        ...clip.transform,
        perspectiveCorners: defaultCorners,
        perspectiveTrackingData: undefined
      },
      animations: newAnimations
    });
    toast.success("Corners reset to default");
  };

  const handleTrackMotion = async () => {
    if (isTracking) return;

    const selectedTrackIndex = tracks.findIndex(t => t.id === clip.trackId);
    let bgClip = null;
    for (let i = selectedTrackIndex - 1; i >= 0; i--) {
      if (tracks[i].type === 'video') {
        const found = tracks[i].clips.find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);
        if (found) {
          const mediaItem = mediaLibrary.find(m => m.id === found.mediaId);
          if (mediaItem?.type === 'video') {
            bgClip = found;
            break;
          }
        }
      }
    }

    if (!bgClip) {
      for (const track of tracks) {
        if (track.id === clip.trackId) continue;
        const found = track.clips.find(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);
        if (found) {
          const mediaItem = mediaLibrary.find(m => m.id === found.mediaId);
          if (mediaItem?.type === 'video') {
            bgClip = found;
            break;
          }
        }
      }
    }

    if (!bgClip) {
      toast.warning("No background video clip found to track! Add a video on a lower track first.");
      return;
    }

    const videoEl = videoElements.get(bgClip.id);
    if (!videoEl) {
      toast.warning("Background video player is not loaded yet. Try playing/seeking first.");
      return;
    }

    const initialCorners: CornerPoints = clip.transform.perspectiveCorners || {
      x0: 427 - 100, y0: 240 - 100,
      x1: 427 + 100, y1: 240 - 100,
      x2: 427 + 100, y2: 240 + 100,
      x3: 427 - 100, y3: 240 + 100
    };

    setIsTracking(true);
    setTrackProgress(0);

    try {
      const startMediaTime = getMediaTimeForClip(bgClip as any, currentTime);
      const remainingMediaDuration = Math.max(0, (videoEl.duration || bgClip.duration) - startMediaTime);
      const remainingClipDuration = Math.max(0, (clip.startTime + clip.duration) - currentTime);
      const trackDuration = Math.min(remainingClipDuration, remainingMediaDuration);
      const startLocalTime = Math.max(0, currentTime - clip.startTime);

      if (trackDuration <= 0.05) {
        toast.warning("Not enough duration remaining to track.");
        return;
      }

      const trackingResults = await trackMotion(
        videoEl,
        startMediaTime,
        trackDuration,
        initialCorners,
        (progress) => {
          setTrackProgress(Math.round(progress * 100));
        },
        bgClip.transform
      );

      if (!trackingResults || trackingResults.length === 0) {
        toast.error("Motion tracking produced no frames.");
        return;
      }

      const newAnimations: Record<string, any[] | undefined> = { ...(clip.animations || {}) };
      for (let i = 0; i < 4; i++) {
        newAnimations[`transform.perspectiveCorners.x${i}`] = [];
        newAnimations[`transform.perspectiveCorners.y${i}`] = [];
      }

      const newTrackingData: { time: number; corners: CornerPoints }[] = [];

      trackingResults.forEach(res => {
        const keyframeLocalTime = Number((startLocalTime + res.time).toFixed(3));
        newTrackingData.push({
          time: keyframeLocalTime,
          corners: { ...res.corners }
        });

        for (let i = 0; i < 4; i++) {
          const kx = `transform.perspectiveCorners.x${i}`;
          const ky = `transform.perspectiveCorners.y${i}`;
          const valX = res.corners[`x${i}` as keyof CornerPoints];
          const valY = res.corners[`y${i}` as keyof CornerPoints];

          if (!newAnimations[kx]) newAnimations[kx] = [];
          if (!newAnimations[ky]) newAnimations[ky] = [];
          newAnimations[kx].push({ time: keyframeLocalTime, value: valX, easing: 'linear' });
          newAnimations[ky].push({ time: keyframeLocalTime, value: valY, easing: 'linear' });
        }
      });

      updateClip(clip.id, {
        transform: {
          ...clip.transform,
          perspectiveCorners: trackingResults[0]?.corners || initialCorners,
          perspectiveTrackingData: newTrackingData
        },
        animations: newAnimations
      });

      toast.success("Motion tracking completed successfully! Keyframes generated.");
    } catch (e: any) {
      toast.error(`Motion tracking failed: ${e.message || e}`);
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!!clip.transform.perspectivePin}
          onChange={(e) => {
            const enabled = e.target.checked;
            let updates: any = { transform: { ...clip.transform, perspectivePin: enabled } };
            if (enabled && !clip.transform.perspectiveCorners) {
              const aX = clip.transform.x;
              const aY = clip.transform.y;
              const baseW = 200;
              const baseH = 200;
              updates.transform.perspectiveCorners = {
                x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
              };
            }
            updateClip(clip.id, updates);
          }}
          className="w-5 h-5 rounded border-[var(--theme-border)] text-amber-500 bg-[var(--theme-bg-subpanel)]"
        />
        <span className="text-sm font-medium text-white">Enable Corner Pinning</span>
      </label>
      {clip.transform.perspectivePin && (
        <div className="pt-3 border-t border-[var(--theme-border)] space-y-2">
          <p className="text-xs text-[var(--theme-text-muted)]">
            Drag the 4 corner handles on the preview screen to adjust quad perspective.
          </p>

          <button
            onClick={handleResetCorners}
            className="w-full py-1.5 text-xs font-medium text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Corners / Clear Track</span>
          </button>

          <button
            onClick={handleTrackMotion}
            disabled={isTracking}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            {isTracking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Tracking Background ({trackProgress}%)</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>Track Background Motion (Auto)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
