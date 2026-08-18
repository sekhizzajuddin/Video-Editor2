// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import type { TimelineTrack } from '@/types';

export function formatCentisecondTime(time: number): string {
  if (isNaN(time) || time < 0) time = 0;
  const totalCentis = Math.round(time * 100);
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;

  const secsStr = mins > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  const centisStr = centis.toString().padStart(2, '0');

  if (mins > 0) {
    return `${mins}:${secsStr}:${centisStr}`;
  }
  return `${secsStr}:${centisStr}`;
}

export function formatDetailedTooltipTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const secsStr = mins > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  const msStr = ms.toString().padStart(3, '0');

  if (mins > 0) {
    return `${mins}:${secsStr}.${msStr}`;
  }
  return `${secsStr}.${msStr}s`;
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/** Seeded PRNG for deterministic procedural content keyed by string. */
export function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 16807 + 0) % 2147483647;
    return (hash % 10001) / 10001;
  };
}

/** Procedurally generate realistic speech dialogue cadence fallback when real audio decoding is pending. */
export function generateFallbackWaveform(clipId: string, barCount: number): number[] {
  const peaks: number[] = [];
  const rng = seededRandom(clipId);
  
  let inSpeech = rng() > 0.3;
  let remainingInState = Math.floor(3 + rng() * 8);

  for (let i = 0; i < barCount; i++) {
    if (remainingInState <= 0) {
      inSpeech = !inSpeech;
      remainingInState = inSpeech 
        ? Math.floor(4 + rng() * 12)  // Speech burst: 4..15 bars
        : Math.floor(2 + rng() * 6);   // Dialogue gap / silence: 2..7 bars
    }

    if (inSpeech) {
      // Speech burst with dynamic syllable volume changes
      const envelope = Math.sin((1 - remainingInState / 15) * Math.PI);
      const amp = 0.25 + rng() * 0.70;
      peaks.push(Math.min(1, Math.max(0.15, amp * (0.6 + 0.4 * envelope))));
    } else {
      // Zero silence gap between words
      peaks.push(0);
    }
    remainingInState--;
  }

  return peaks;
}

/** Check overlap on a track, optionally excluding one clip. */
export function checkOverlapAt(
  track: TimelineTrack,
  startTime: number,
  duration: number,
  excludeClipId: string,
): boolean {
  const endTime = startTime + duration;
  return track.clips.some((clip) => {
    if (clip.id === excludeClipId) return false;
    const clipEnd = clip.startTime + clip.duration;
    return startTime < clipEnd && endTime > clip.startTime;
  });
}

export function parseTransliteratedResponse(responseText: string): any[] | null {
  if (!responseText || typeof responseText !== 'string') return null;

  // Step 1: Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: Try parsing the entire cleaned text as JSON
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}

  // Step 3: Find JSON array using greedy bracket matching from first '[' 
  const startIdx = cleaned.indexOf('[');
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < cleaned.length; i++) {
      if (cleaned[i] === '[') depth++;
      else if (cleaned[i] === ']') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx !== -1) {
      try {
        const extracted = cleaned.slice(startIdx, endIdx + 1);
        const parsed = JSON.parse(extracted);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
  }

  return null;
}
