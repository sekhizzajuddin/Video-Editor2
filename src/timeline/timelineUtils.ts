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

/** Fallback waveform when no real peaks are available. */
export function generateFallbackWaveform(clipId: string, barCount: number): number[] {
  const peaks: number[] = [];
  const rng = seededRandom(clipId);
  for (let i = 0; i < barCount; i++) {
    peaks.push(0.2 + rng() * 0.8);
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
