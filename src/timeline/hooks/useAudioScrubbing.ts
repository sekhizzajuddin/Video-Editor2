import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

export function useAudioScrubbing(isScrubbing: boolean, scrubTime: number | null) {
  const { tracks } = useEditorStore(useShallow(s => ({ tracks: s.tracks })));
  const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastScrubTimeRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      audioPoolRef.current.forEach(a => { a.pause(); a.src = ""; });
      audioPoolRef.current.clear();
    };
  }, []);

  
  const lastAudioScrubTickRef = useRef<number>(0);

  useEffect(() => {
    if (!isScrubbing || scrubTime === null) {
      // Stop all scrubbing audio when scrubbing stops
      audioPoolRef.current.forEach((audio) => {
        audio.pause();
      });
      lastScrubTimeRef.current = null;
      return;
    }

    const now = performance.now();
    if (now - lastAudioScrubTickRef.current < 50) return;
    lastAudioScrubTickRef.current = now;
    
    const delta = lastScrubTimeRef.current !== null ? Math.abs(scrubTime - lastScrubTimeRef.current) : 0;
    lastScrubTimeRef.current = scrubTime;
    
    // Only play audio if we are moving the playhead slowly enough (typical scrubbing)
    if (delta > 0.5) {
        // Moving too fast, don't play to avoid cacophony
        audioPoolRef.current.forEach(a => a.pause());
        return;
    }

    // P0 FIX: Build mediaMap once per scrub tick (O(N)) instead of calling
    // mediaLibrary.find() inside the filter loop (O(N×M) per tick).
    const mediaLibrary = useEditorStore.getState().mediaLibrary;
    const mediaMap = new Map(mediaLibrary.map(m => [m.id, m]));

    const activeClips = tracks
      .filter((t) => !t.muted)
      .flatMap((t) => t.clips)
      .filter((c) => {
        const media = mediaMap.get(c.mediaId);
        if (!media || (media.type !== 'audio' && media.type !== 'video')) return false;
        return scrubTime >= c.startTime && scrubTime <= c.startTime + c.duration;
      });

    // Clean up old audio elements that are no longer active
    const activeIds = new Set(activeClips.map((c) => c.id));
    audioPoolRef.current.forEach((audio, id) => {
      if (!activeIds.has(id)) {
        audio.pause();
      }
    });

    // Play active clips — reuse mediaMap so no second find() loop needed
    activeClips.forEach((clip) => {
      const media = mediaMap.get(clip.mediaId);
      if (!media) return;
      if (!media.url) return;

      let audio = audioPoolRef.current.get(clip.id);
      if (!audio) {
        audio = new Audio(media.url);
        audio.preservesPitch = false; // often better for scrubbing
        audioPoolRef.current.set(clip.id, audio);
      }
      
      const track = tracks.find(t => t.id === clip.trackId);
      const trackVolume = track?.volume ?? 1;

      audio.volume = trackVolume;
      
      const localTime = clip.trimStart + (scrubTime - clip.startTime) * clip.speed;
      
      // If we are close to the current time, just play it, otherwise seek
      if (Math.abs(audio.currentTime - localTime) > 0.1) {
        audio.currentTime = localTime;
      }
      
      // Play a short burst
      audio.play().catch(() => {});
      
      // We don't pause it immediately here, let it play while scrubbing continues. 
      // If scrubbing stops, the useEffect dependency `!isScrubbing` will pause it.
    });
    
  }, [isScrubbing, scrubTime, tracks]);
}
