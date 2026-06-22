/**
 * useMediaPlayback.ts
 *
 * Manages a pool of HTMLVideoElement and HTMLAudioElement instances for
 * real media playback, synced to the editor store's currentTime.
 *
 * Provides:
 *  - Pre-loaded media elements for active clips
 *  - Play/pause/seek synchronisation
 *  - Volume and mute control per-track
 *  - Frame-accurate scrubbing for video
 */

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';

interface MediaElement {
  el: HTMLVideoElement | HTMLAudioElement;
  clipId: string;
  mediaId: string;
  type: 'video' | 'audio';
}

/**
 * Hook that manages real playback of video/audio clips on the timeline.
 *
 * It creates a pool of hidden media elements, one per unique clip
 * currently placed on the timeline. During playback it syncs their
 * currentTime to the editor's currentTime and handles play/pause.
 *
 * Returns a Map of clipId → HTMLVideoElement for the preview canvas
 * to draw video frames from.
 */
export function useMediaPlayback(): Map<string, HTMLVideoElement> {
  const poolRef = useRef<Map<string, MediaElement>>(new Map());
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);

  // Keep track of expected playback time to detect manual user seeks
  const lastTimeRef = useRef<number>(currentTime);
  const lastRealTimeRef = useRef<number>(performance.now());
  const wasPlayingRef = useRef<boolean>(isPlaying);

  // Queue to hold pending seek requests for video elements during scrubbing/seeking
  const pendingSeeksRef = useRef<Map<string, number>>(new Map());

  // Trigger a custom event on window so PreviewCanvas can redraw immediately on async frame seek
  const triggerRedraw = useCallback(() => {
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
  }, []);

  // Build set of active clips
  const activeClips = useCallback(() => {
    const result: {
      clipId: string;
      mediaId: string;
      clipStart: number;
      clipDuration: number;
      trimStart: number;
      trackMuted: boolean;
      trackType: 'video' | 'audio';
    }[] = [];

    const addedClipIds = new Set<string>();

    const addIfNew = (clip: any, track: any) => {
      if (addedClipIds.has(clip.id)) return;
      addedClipIds.add(clip.id);
      result.push({
        clipId: clip.id,
        mediaId: clip.mediaId,
        clipStart: clip.startTime,
        clipDuration: clip.duration,
        trimStart: clip.trimStart,
        trackMuted: track.muted,
        trackType: track.type,
      });
    };

    for (const track of tracks) {
      if (track.hidden) continue;
      
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

      for (let idx = 0; idx < sortedClips.length; idx++) {
        const clip = sortedClips[idx];

        // 1. Check normal active state
        const isNormallyActive =
          currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration;
        if (isNormallyActive) {
          addIfNew(clip, track);
        }

        // 2. Check transition at this clip's start (if idx > 0)
        if (idx > 0) {
          const prevClip = sortedClips[idx - 1];
          const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
          if (Math.abs(gap) < 0.1 && clip.transitionIn) {
            const duration = clip.transitionIn.duration;
            const alignment = clip.transitionIn.params?.alignment || 'center';
            let leftSec = clip.startTime - duration / 2;
            if (alignment === 'left') {
              leftSec = clip.startTime;
            } else if (alignment === 'right') {
              leftSec = clip.startTime - duration;
            }
            const rightSec = leftSec + duration;

            if (currentTime >= leftSec && currentTime < rightSec) {
              // Both clips are active in this transition zone
              addIfNew(prevClip, track);
              addIfNew(clip, track);
            }
          }
        }
      }
    }
    return result;
  }, [tracks, currentTime]);

  // Ensure media elements exist for all timeline clips
  useEffect(() => {
    const neededClips = new Map<string, { mediaId: string; type: 'video' | 'audio' }>();
    for (const track of tracks) {
      for (const clip of track.clips) {
        const media = mediaLibrary.find((m) => m.id === clip.mediaId);
        if (media && media.url) {
          neededClips.set(clip.id, {
            mediaId: clip.mediaId,
            type: media.type === 'video' ? 'video' : 'audio',
          });
        }
      }
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

    // Create missing elements
    for (const [clipId, info] of neededClips) {
      if (pool.has(clipId)) continue;

      const media = mediaLibrary.find((m) => m.id === info.mediaId);
      if (!media || !media.url) continue;

      if (info.type === 'video') {
        const el = document.createElement('video');
        el.preload = 'auto';
        el.muted = false; // Muted = false so we can hear video audio
        el.playsInline = true;
        el.crossOrigin = 'anonymous';
        el.src = media.url;
        el.style.display = 'none';

        // Seeked handler that checks for subsequent pending seeks before triggering redraw
        const handleSeeked = () => {
          triggerRedraw();
          const pendingTime = pendingSeeksRef.current.get(clipId);
          if (pendingTime !== undefined) {
            pendingSeeksRef.current.delete(clipId);
            el.currentTime = pendingTime;
          }
        };

        (el as any)._handleSeeked = handleSeeked;

        el.addEventListener('seeked', handleSeeked);
        el.addEventListener('timeupdate', triggerRedraw);
        el.addEventListener('canplay', triggerRedraw);

        document.body.appendChild(el);
        pool.set(clipId, { el, clipId, mediaId: info.mediaId, type: 'video' });
        videoMap.set(clipId, el);
      } else if (info.type === 'audio') {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.src = media.url;
        el.style.display = 'none';
        document.body.appendChild(el);
        pool.set(clipId, { el, clipId, mediaId: info.mediaId, type: 'audio' });
      }
    }

    // Remove elements that are no longer on the timeline
    for (const [clipId, entry] of pool) {
      if (!neededClips.has(clipId)) {
        entry.el.pause();
        if (entry.type === 'video') {
          const el = entry.el as any;
          if (el._handleSeeked) {
            el.removeEventListener('seeked', el._handleSeeked);
          }
          el.removeEventListener('timeupdate', triggerRedraw);
          el.removeEventListener('canplay', triggerRedraw);
        }
        entry.el.src = '';
        entry.el.remove();
        pool.delete(clipId);
        videoMap.delete(clipId);
        pendingSeeksRef.current.delete(clipId);
      }
    }
  }, [tracks, mediaLibrary, triggerRedraw]);

  // Sync playback state — play / pause / seek / volume / speed
  useEffect(() => {
    const pool = poolRef.current;
    const clips = activeClips();
    const playingIds = new Set(clips.map((c) => c.clipId));

    const now = performance.now();
    const elapsedRealTime = (now - lastRealTimeRef.current) / 1000;
    const expectedPlaybackTime = lastTimeRef.current + elapsedRealTime * playbackSpeed;

    // Detect if playback has just started, or if the user performed a manual seek
    const playStarted = isPlaying && !wasPlayingRef.current;
    const userSeeked = Math.abs(currentTime - expectedPlaybackTime) > 0.15;
    const forceSeek = playStarted || userSeeked;

    lastTimeRef.current = currentTime;
    lastRealTimeRef.current = now;
    wasPlayingRef.current = isPlaying;

    for (const [clipId, entry] of pool) {
      const clip = clips.find((c) => c.clipId === clipId);

      if (!clip || !isPlaying) {
        // Pause this element
        if (!entry.el.paused) {
          entry.el.pause();
        }
      } else {
        // Calculate the media time corresponding to currentTime
        const mediaTime = currentTime - clip.clipStart + clip.trimStart;

        // Update volume & mute state ONLY if changed to save CPU/stutter
        const isMutedTrack = clip.trackMuted || isMuted;
        if (entry.el.muted !== isMutedTrack) {
          entry.el.muted = isMutedTrack;
        }
        const targetVolume = isMutedTrack ? 0 : volume;
        if (entry.el.volume !== targetVolume) {
          entry.el.volume = targetVolume;
        }

        // Sync playback rate ONLY if changed
        if (entry.el.playbackRate !== playbackSpeed) {
          entry.el.playbackRate = playbackSpeed;
        }

        // Seek to the correct time if we just started, if the user seeked, or if we have high drift
        const currentMediaTime = entry.el.currentTime;
        const drift = Math.abs(currentMediaTime - mediaTime);

        if (forceSeek || drift > 0.35) {
          if (entry.el.seeking) {
            pendingSeeksRef.current.set(clipId, mediaTime);
          } else {
            entry.el.currentTime = mediaTime;
          }
        }

        // Play if paused
        if (entry.el.paused && isPlaying) {
          entry.el.play().catch(() => { /* user interaction required — ignore */ });
        }
      }
    }

    // Pause elements that aren't active
    for (const [clipId, entry] of pool) {
      if (!playingIds.has(clipId) && !entry.el.paused) {
        entry.el.pause();
      }
    }
  }, [isPlaying, currentTime, volume, isMuted, playbackSpeed, activeClips]);

  // On seek (when not playing), update video elements for frame display
  useEffect(() => {
    if (isPlaying) return;

    const pool = poolRef.current;
    const clips = activeClips();

    for (const clip of clips) {
      const entry = pool.get(clip.clipId);
      if (!entry || entry.type !== 'video') continue;

      const el = entry.el as HTMLVideoElement;
      const mediaTime = currentTime - clip.clipStart + clip.trimStart;

      if (el.seeking) {
        // Coalesce seeks: store the latest target time to seek to once the current seek finishes
        pendingSeeksRef.current.set(clip.clipId, mediaTime);
      } else {
        const drift = Math.abs(el.currentTime - mediaTime);
        if (drift > 0.03) {
          el.currentTime = mediaTime;
        }
      }
    }
  }, [currentTime, isPlaying, activeClips]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      const pool = poolRef.current;
      for (const [, entry] of pool) {
        entry.el.pause();
        if (entry.type === 'video') {
          const el = entry.el as any;
          if (el._handleSeeked) {
            el.removeEventListener('seeked', el._handleSeeked);
          }
          el.removeEventListener('timeupdate', triggerRedraw);
          el.removeEventListener('canplay', triggerRedraw);
        }
        entry.el.src = '';
        entry.el.remove();
      }
      pool.clear();
      videoMapRef.current.clear();
      pendingSeeksRef.current.clear();
    };
  }, [triggerRedraw]);

  return videoMapRef.current;
}
