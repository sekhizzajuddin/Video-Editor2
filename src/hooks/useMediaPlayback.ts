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
  mediaId: string;
  type: 'video' | 'audio';
}

/**
 * Hook that manages real playback of video/audio clips on the timeline.
 *
 * It creates a pool of hidden media elements, one per unique media item
 * currently placed on the timeline. During playback it syncs their
 * currentTime to the editor's currentTime and handles play/pause.
 *
 * Returns a Map of mediaId → HTMLVideoElement for the preview canvas
 * to draw video frames from.
 */
export function useMediaPlayback(): Map<string, HTMLVideoElement> {
  const poolRef = useRef<Map<string, MediaElement>>(new Map());
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const lastSyncedTime = useRef<number>(-1);
  const isPlayingRef = useRef(false);

  // Determine which media IDs are actively on the timeline
  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);

  isPlayingRef.current = isPlaying;

  // Build set of active media IDs and their clip timings
  const activeClips = useCallback(() => {
    const result: {
      mediaId: string;
      clipStart: number;
      clipDuration: number;
      trimStart: number;
      trackMuted: boolean;
      trackType: 'video' | 'audio';
    }[] = [];
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          result.push({
            mediaId: clip.mediaId,
            clipStart: clip.startTime,
            clipDuration: clip.duration,
            trimStart: clip.trimStart,
            trackMuted: track.muted,
            trackType: track.type,
          });
        }
      }
    }
    return result;
  }, [tracks, currentTime]);

  // Ensure media elements exist for all timeline media
  useEffect(() => {
    const neededMediaIds = new Set<string>();
    for (const track of tracks) {
      for (const clip of track.clips) {
        neededMediaIds.add(clip.mediaId);
      }
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

    // Create missing elements
    for (const mediaId of neededMediaIds) {
      if (pool.has(mediaId)) continue;

      const media = mediaLibrary.find((m) => m.id === mediaId);
      if (!media || !media.url) continue;

      if (media.type === 'video') {
        const el = document.createElement('video');
        el.preload = 'auto';
        el.muted = true; // Video elements muted; we play audio from separate audio context or elements
        el.playsInline = true;
        el.crossOrigin = 'anonymous';
        el.src = media.url;
        el.style.display = 'none';
        document.body.appendChild(el);
        pool.set(mediaId, { el, mediaId, type: 'video' });
        videoMap.set(mediaId, el);
      } else if (media.type === 'audio') {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.src = media.url;
        el.style.display = 'none';
        document.body.appendChild(el);
        pool.set(mediaId, { el, mediaId, type: 'audio' });
      }
    }

    // Remove elements that are no longer on the timeline
    for (const [mediaId, entry] of pool) {
      if (!neededMediaIds.has(mediaId)) {
        entry.el.pause();
        entry.el.src = '';
        entry.el.remove();
        pool.delete(mediaId);
        videoMap.delete(mediaId);
      }
    }

    return () => {
      // Cleanup on unmount
    };
  }, [tracks, mediaLibrary]);

  // Sync playback state — play / pause / seek
  useEffect(() => {
    const pool = poolRef.current;
    const clips = activeClips();

    // Set of media IDs that should be playing right now
    const playingIds = new Set(clips.map((c) => c.mediaId));

    for (const [mediaId, entry] of pool) {
      const clip = clips.find((c) => c.mediaId === mediaId);

      if (!clip || !isPlaying) {
        // Pause this element
        if (!entry.el.paused) {
          entry.el.pause();
        }
      } else {
        // Calculate the media time corresponding to currentTime
        const mediaTime = currentTime - clip.clipStart + clip.trimStart;

        // Update volume
        if (entry.type === 'audio') {
          (entry.el as HTMLAudioElement).volume = clip.trackMuted || isMuted ? 0 : volume;
        }

        // Seek if needed (if >0.3s out of sync)
        const drift = Math.abs(entry.el.currentTime - mediaTime);
        if (drift > 0.3) {
          entry.el.currentTime = mediaTime;
        }

        // Play if paused
        if (entry.el.paused && isPlaying) {
          entry.el.play().catch(() => { /* user interaction required — ignore */ });
        }
      }
    }

    // Pause elements that aren't active
    for (const [mediaId, entry] of pool) {
      if (!playingIds.has(mediaId) && !entry.el.paused) {
        entry.el.pause();
      }
    }
  }, [isPlaying, currentTime, volume, isMuted, activeClips]);

  // On seek (when not playing), update video elements for frame display
  useEffect(() => {
    if (isPlaying) return;

    const pool = poolRef.current;
    const clips = activeClips();

    for (const clip of clips) {
      const entry = pool.get(clip.mediaId);
      if (!entry) continue;

      const mediaTime = currentTime - clip.clipStart + clip.trimStart;
      if (Math.abs(entry.el.currentTime - mediaTime) > 0.05) {
        entry.el.currentTime = mediaTime;
      }
    }

    lastSyncedTime.current = currentTime;
  }, [currentTime, isPlaying, activeClips]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      const pool = poolRef.current;
      for (const [, entry] of pool) {
        entry.el.pause();
        entry.el.src = '';
        entry.el.remove();
      }
      pool.clear();
      videoMapRef.current.clear();
    };
  }, []);

  return videoMapRef.current;
}
