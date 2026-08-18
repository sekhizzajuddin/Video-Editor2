// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/store/editorStore.ts (addClip / insertTextClip / addTrack)
//   src/components/MediaPanel/index.tsx (add-to-timeline handlers)
// ─────────────────────────────────────────────────────────────────────────────

import type { MediaItem, TimelineClip, TimelineTrack } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { toast } from 'sonner';

/** CapCut-style id generator (short, human-friendly). */
export const mid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** Map a media item type to the timeline track type it should live on. */
export function trackTypeForMedia(media: MediaItem): TimelineTrack['type'] {
  switch (media.type) {
    case 'audio':
      return 'audio';
    case 'text':
      return 'text';
    case 'fx':
    case 'lut':
      return 'fx';
    case 'image':
    case 'video':
    default:
      return 'video';
  }
}

/** Resolve the (existing or newly created) track for a media item. */
export function ensureTrackForMedia(media: MediaItem): TimelineTrack | undefined {
  const store = useEditorStore.getState();
  const type = trackTypeForMedia(media);
  let track = store.tracks.find((t) => t.type === type && !t.locked);
  if (!track) {
    store.addTrack(type);
    track = useEditorStore.getState().tracks.find((t) => t.type === type);
  }
  return track;
}

/** Find a non-overlapping start time on a track, walking forward from `start`. */
export function findFreeSlot(track: TimelineTrack, start: number, duration: number): number {
  let candidate = Math.max(0, start);
  let attempts = 0;
  const step = duration + 0.05;
  const overlaps = (t: number) =>
    track.clips.some((c) => Math.max(0, Math.min(t + duration, c.startTime + c.duration) - Math.max(t, c.startTime)) > 0.001);
  while (attempts < 200 && overlaps(candidate)) {
    candidate += step;
    attempts++;
  }
  return candidate;
}

/**
 * Insert a media item into the timeline at the current playhead (or the next
 * free slot) — mirrors the desktop MediaPanel "+" behaviour using the same
 * store actions, but re-implemented for the mobile editor.
 */
export function addMediaToTimeline(media: MediaItem): string | null {
  const store = useEditorStore.getState();
  const track = ensureTrackForMedia(media);
  if (!track) {
    toast.error('Could not find or create a track.');
    return null;
  }

  const duration = media.duration > 0 ? media.duration : 3;
  const startTime = findFreeSlot(track, store.currentTime, duration);
  const clipId = mid('clip');

  const clip: TimelineClip = {
    id: clipId,
    mediaId: media.id,
    trackId: track.id,
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { x: 0, y: 0, scale: 100, rotation: 0 },
    opacity: 1,
    speed: 1,
    effects: [],
  } as TimelineClip;

  useEditorStore.getState().addClip(clip);
  useEditorStore.getState().selectClip(clipId);
  useEditorStore.getState().saveSnapshot('Add clip');
  toast.success('Added to timeline');
  return clipId;
}

/** Add a plain text clip at the playhead (same logic as desktop). */
export function addTextClipToTimeline(text: string): string | null {
  const store = useEditorStore.getState();
  let track = store.tracks.find((t) => t.type === 'text');
  if (!track) {
    store.addTrack('text');
    track = useEditorStore.getState().tracks.find((t) => t.type === 'text');
  }
  if (!track) return null;

  const mediaId = mid('text');
  useEditorStore.getState().addMedia({
    id: mediaId,
    name: text.length > 10 ? text.slice(0, 10) + '…' : text,
    type: 'text',
    duration: 3,
    url: '',
    createdAt: Date.now(),
    textContent: text,
  });

  const duration = 3;
  const startTime = findFreeSlot(track, store.currentTime, duration);
  const clipId = mid('clip');
  useEditorStore.getState().addClip({
    id: clipId,
    mediaId,
    trackId: track.id,
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { x: 0, y: 0, scale: 100, rotation: 0 },
    opacity: 1,
    speed: 1,
    effects: [],
    textSettings: {
      text,
      fontFamily: 'Roboto',
      fontSize: 40,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
    },
  } as TimelineClip);

  useEditorStore.getState().selectClip(clipId);
  useEditorStore.getState().saveSnapshot('Add text');
  toast.success('Text added');
  return clipId;
}
