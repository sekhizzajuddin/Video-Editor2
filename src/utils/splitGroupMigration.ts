import type { TimelineClip, TimelineTrack, PipWindow } from '@/types';
import { getClipSourceEnd } from '@/utils/speedRamp';

export const generateSplitGroupId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? 'sg_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : 'sg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

/**
 * Migrates legacy project tracks so that contiguous split clips from previous
 * software versions (which did not have `splitGroupId` populated) are automatically
 * assigned a shared `splitGroupId`.
 *
 * Requirements for a contiguous split group:
 * 1. Same track & same mediaId (both non-empty)
 * 2. Directly adjacent on timeline: |prev.startTime + prev.duration - curr.startTime| < 0.05s
 * 3. Directly contiguous in source media: |getClipSourceEnd(prev) - curr.trimStart| < 0.05s
 *
 * Rules:
 * - Lone / isolated clips have their `splitGroupId` cleared (set to undefined).
 * - Multi-clip contiguous chains adopt an existing valid `splitGroupId` if present,
 *   or receive a newly generated unique ID.
 * - Disconnected chains never share the same `splitGroupId`.
 * - All other clip properties (keyframes, transforms, transitions, audio, effects)
 *   are preserved with zero mutation or data loss.
 * - Idempotent: running repeatedly on already-migrated tracks returns the exact same track reference.
 */
export function migrateLegacyTrackSplitGroups(track: TimelineTrack): TimelineTrack {
  if (!track.clips || track.clips.length === 0) return track;

  // If track has only 1 clip, it can never be part of a split group.
  if (track.clips.length === 1) {
    if (track.clips[0].splitGroupId) {
      return {
        ...track,
        clips: [{ ...track.clips[0], splitGroupId: undefined }],
      };
    }
    return track;
  }

  // Sort clips by startTime to accurately discover timeline adjacency.
  const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

  // Group contiguous clips into chains
  const chains: TimelineClip[][] = [];
  let currentChain: TimelineClip[] = [sortedClips[0]];

  for (let i = 1; i < sortedClips.length; i++) {
    const prev = sortedClips[i - 1];
    const curr = sortedClips[i];

    const isSameMedia = Boolean(prev.mediaId && curr.mediaId && prev.mediaId === curr.mediaId);
    const prevTimelineEnd = prev.startTime + prev.duration;
    const isAdjacent = Math.abs(curr.startTime - prevTimelineEnd) < 0.05;
    const prevSourceEnd = getClipSourceEnd(prev);
    const isContiguous = Math.abs(curr.trimStart - prevSourceEnd) < 0.05;

    if (isSameMedia && isAdjacent && isContiguous) {
      currentChain.push(curr);
    } else {
      chains.push(currentChain);
      currentChain = [curr];
    }
  }
  chains.push(currentChain);

  // Map each clip ID to its target splitGroupId
  const targetSplitGroupMap = new Map<string, string | undefined>();
  const usedGroupIds = new Set<string>();

  for (const chain of chains) {
    if (chain.length <= 1) {
      // Lone clip cannot be in a split group
      targetSplitGroupMap.set(chain[0].id, undefined);
    } else {
      // Find an existing splitGroupId in this chain that hasn't been claimed by another chain
      const candidateId = chain.find(
        (c) => Boolean(c.splitGroupId && !usedGroupIds.has(c.splitGroupId!))
      )?.splitGroupId;

      const assignedGroupId = candidateId || generateSplitGroupId();
      usedGroupIds.add(assignedGroupId);

      for (const clip of chain) {
        targetSplitGroupMap.set(clip.id, assignedGroupId);
      }
    }
  }

  // Check if any clip actually needs modification
  let hasChanges = false;
  for (const clip of track.clips) {
    const desired = targetSplitGroupMap.get(clip.id);
    if (clip.splitGroupId !== desired) {
      hasChanges = true;
      break;
    }
  }

  if (!hasChanges) {
    return track;
  }

  return {
    ...track,
    clips: track.clips.map((clip) => {
      const desired = targetSplitGroupMap.get(clip.id);
      if (clip.splitGroupId !== desired) {
        return {
          ...clip,
          splitGroupId: desired,
        };
      }
      return clip;
    }),
  };
}

/**
 * Migrates an array of tracks to ensure all contiguous split cuts have valid
 * `splitGroupId`s and orphaned split groups are cleaned up.
 */
export function migrateLegacyTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  if (!Array.isArray(tracks) || tracks.length === 0) return tracks || [];

  let changed = false;
  const migrated = tracks.map((track) => {
    const m = migrateLegacyTrackSplitGroups(track);
    if (m !== track) changed = true;
    return m;
  });

  return changed ? migrated : tracks;
}

/**
 * Recursively migrates PiP window tracks so any nested split clips are
 * upgraded to the new splitGroupId architecture.
 */
export function migrateLegacyPipWindows<T extends Record<string, PipWindow> | Record<string, any> | undefined>(
  pipWindows: T
): T {
  if (!pipWindows || typeof pipWindows !== 'object') return pipWindows;

  let changed = false;
  const result: Record<string, any> = {};

  for (const [key, pip] of Object.entries(pipWindows)) {
    if (pip && Array.isArray(pip.tracks)) {
      const migratedTracks = migrateLegacyTracks(pip.tracks);
      if (migratedTracks !== pip.tracks) {
        changed = true;
        result[key] = {
          ...pip,
          tracks: migratedTracks,
        };
      } else {
        result[key] = pip;
      }
    } else {
      result[key] = pip;
    }
  }

  return (changed ? result : pipWindows) as T;
}
