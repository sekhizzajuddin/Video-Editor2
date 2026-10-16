import { useEffect, useRef } from 'react';

/**
 * During scrubbing, audio is muted (CapCut behavior).
 * This hook exists only to clean up any leftover scrub-audio elements
 * from prior sessions. The real audio silence happens in useMediaPlayback,
 * which pauses media elements whenever `isScrubbing` is true.
 */
export function useAudioScrubbing(isScrubbing: boolean, scrubTime?: number | null) {
  const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    return () => {
      audioPoolRef.current.forEach((a) => {
        a.pause();
        a.src = '';
      });
      audioPoolRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (isScrubbing) {
      // Pause any currently playing scrub audio from a prior session.
      audioPoolRef.current.forEach((a) => a.pause());
    } else {
      // Cleanup on scrub end.
      audioPoolRef.current.forEach((a) => {
        a.pause();
        a.src = '';
      });
      audioPoolRef.current.clear();
    }
    // scrubTime intentionally unused — kept in signature for backwards compatibility.
    void scrubTime;
  }, [isScrubbing, scrubTime]);
}
