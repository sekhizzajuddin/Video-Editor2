/**
 * Split Clip ID Provider
 * ======================
 *
 * Single source of truth for "which piece of media does this clip need, and can
 * that media be decoded together with another clip?".
 *
 * ## Why this module exists
 *
 * Splitting a clip (Ctrl/Cmd-K) turns ONE media item into N timeline clips that
 * all point at the same file but at different source windows
 * (`trimStart`/`trimEnd` + `speed`/`speedRamp`). Every renderer then has to
 * answer two questions:
 *
 *   1. **Identity** — are two clips two independent things that can be on screen
 *      at the same time, or are they two halves of one continuous stream?
 *   2. **Scheduling** — when several clips share one media file, which of them
 *      may share a decoder (fast, sequential) and which need their own decoder
 *      (because they are on screen simultaneously at different source times)?
 *
 * Answering those questions ad-hoc is exactly what made the renderer "struggle"
 * after a split:
 *
 *   - the preview keyed its `<video>` elements off a mix of `splitGroupId`,
 *     `mediaId` and "any video element of this media" heuristics, so a segment
 *     could adopt the WRONG element and seek-storm;
 *   - the export worker keyed decoders off `mediaId` alone, so a split + a second
 *     track reusing the same media interleaved two distant source windows through
 *     ONE sequential decoder — every output frame rewound the decode pipeline
 *     (`resetIterator()` → re-seek → re-decode from the start of the file).
 *
 * This module centralises the rules so the preview, the export worker and the
 * store all agree:
 *
 *   - {@link buildSplitIdentities} derives a stable identity per clip
 *     (`renderKey`, `shareKey`, chain membership, ordered segment index, source
 *     window, timeline window).
 *   - {@link planDecodeStreams} groups clips into **decode streams**: a stream is
 *     a set of clips that one decoder can serve *monotonically* (forward only),
 *     which is the professional-NLE model of "one decoder per active segment".
 *     Clips that would force a rewind get their own stream, bounded by a budget.
 *
 * The module is intentionally dependency-free (pure math + plain objects) so it
 * can be imported from the React main thread, from the export Web Worker and
 * from unit tests without pulling in DOM APIs.
 */

import { getMediaTimeForClip } from './speedRamp';
import type { SpeedFrame, SpeedRampKeyframe } from '../types';

// ---------------------------------------------------------------------------
// Structural clip shape (kept loose so preview clips, store clips, worker
// timeline clips and test fixtures are all accepted without casts).
// ---------------------------------------------------------------------------

export interface SplitIdentityClip {
  id: string;
  mediaId?: string;
  trackId?: string;
  startTime: number;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  speed?: number;
  speedRamp?: SpeedRampKeyframe[];
  speedFrames?: SpeedFrame[];
  speedFrameSourceEnd?: number;
  isReversed?: boolean;
  freezeFrame?: number;
  disabled?: boolean;
  /** Set when the clip is a piece of a split chain (see `store.splitClip`). */
  splitGroupId?: string;
  /** 0-based position inside the chain (restamped by {@link restampSplitChain}). */
  splitSegmentIndex?: number;
}

export interface SplitIdentityTrack {
  id?: string;
  type?: string;
  hidden?: boolean;
  clips: SplitIdentityClip[];
}

export interface SplitIdentityTimeline {
  tracks?: SplitIdentityTrack[];
}

export interface SourceWindow {
  /** Lowest source timestamp the clip can sample (seconds). */
  start: number;
  /** Highest source timestamp the clip can sample (seconds). */
  end: number;
  /** True when media is consumed backwards (`isReversed`). */
  reversed: boolean;
  /** True when the whole clip samples a single source timestamp. */
  frozen: boolean;
}

export interface SplitSegmentIdentity {
  clipId: string;
  mediaId: string;
  trackId: string;
  /** `splitGroupId` of the chain, or `null` for an un-split clip. */
  chainId: string | null;
  /** 0-based position of this clip inside its chain (timeline order). */
  segmentIndex: number;
  /** Number of clips in the chain that share this clip's media + track. */
  segmentCount: number;
  /** True when this clip touches the previous segment exactly (no gap). */
  contiguousWithPrevious: boolean;
  /** True when the next segment starts exactly where this one ends. */
  contiguousWithNext: boolean;
  timelineStart: number;
  timelineEnd: number;
  source: SourceWindow;
  /**
   * Stable identity for caches that live across edits (decode caches, mask
   * caches, proxy frames). Derived from media + chain + source window so it
   * survives clip-id churn and undo/redo.
   */
  renderKey: string;
  /**
   * Identity used to decide `<video>` element sharing in the preview. Only
   * contiguous, same-track segments of one chain share an element; everything
   * else gets a dedicated element (so two simultaneously visible clips can never
   * fight over one element's `currentTime`).
   */
  shareKey: string;
  /** When false the clip must never share a `<video>` element with a sibling. */
  shareableElement: boolean;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Frame quantum used for "these times are the same" comparisons. */
const FRAME_EPSILON = 1 / 120;

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Derives the source-time window a clip samples, using the SAME ramp/reverse
 * math as the preview and the export scheduler (`getMediaTimeForClip`), so all
 * three agree on what "this segment covers" means.
 */
export function sourceWindowForClip(clip: SplitIdentityClip): SourceWindow {
  const trimStart = num(clip.trimStart, 0);
  const speed = num(clip.speed, 1) || 1;
  const duration = Math.max(0, num(clip.duration, 0));
  const frozen = clip.freezeFrame !== undefined;
  const reversed = !!clip.isReversed;

  if (frozen) {
    const at = num(clip.freezeFrame, trimStart);
    return { start: at, end: at, reversed, frozen: true };
  }

  const asMapping = {
    id: clip.id ?? 'anonymous',
    startTime: num(clip.startTime, 0),
    duration,
    trimStart,
    speed,
    speedRamp: clip.speedRamp,
    speedFrames: clip.speedFrames,
    speedFrameSourceEnd: clip.speedFrameSourceEnd,
    isReversed: clip.isReversed,
    freezeFrame: clip.freezeFrame,
  };

  const atStart = getMediaTimeForClip(asMapping as any, asMapping.startTime);
  const atEnd = getMediaTimeForClip(asMapping as any, asMapping.startTime + duration);
  const a = Number.isFinite(atStart) ? atStart : trimStart;
  const b = Number.isFinite(atEnd) ? atEnd : trimStart + duration * speed;
  return { start: Math.min(a, b), end: Math.max(a, b), reversed, frozen: false };
}

function roundKey(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

/**
 * Stable identity for a clip's *source window*. Two clips with the same key
 * sample exactly the same media range and are therefore interchangeable for
 * caches.
 */
export function renderKeyForClip(clip: SplitIdentityClip): string {
  const mediaId = clip.mediaId || clip.trackId || 'unknown';
  const window = sourceWindowForClip(clip);
  const chain = clip.splitGroupId;
  const suffix =
    `${roundKey(window.start)}-${roundKey(window.end)}` +
    (window.reversed ? '-rev' : '') +
    (window.frozen ? '-frz' : '');
  return chain
    ? `chain:${chain}:${mediaId}:${suffix}`
    : `clip:${clip.id}:${mediaId}:${suffix}`;
}

/**
 * Key under which the preview may share one `<video>` element between clips.
 * Only contiguous, same-track segments of a chain share; anything that can be
 * visible at the same time as a sibling gets a per-clip element.
 */
export function shareKeyForClip(clip: SplitIdentityClip): string {
  const mediaId = clip.mediaId || 'unknown';
  const chain = clip.splitGroupId;
  if (!chain) return `${mediaId}::clip:${clip.id}`;
  return `${mediaId}::chain:${chain}::track:${clip.trackId ?? 'default'}`;
}

// ---------------------------------------------------------------------------
// Chain identities
// ---------------------------------------------------------------------------

function chainSortKey(clip: SplitIdentityClip): number {
  return num(clip.startTime, 0);
}

/**
 * Builds identities for every clip in the timeline (plain tracks only — PiP
 * windows are rendered as their own nested timelines and are handled by the
 * caller if needed).
 *
 * Complexity: O(n log n) over the clips of one chain, O(n) overall.
 */
export function buildSplitIdentities(
  timeline: SplitIdentityTimeline | null | undefined,
): Map<string, SplitSegmentIdentity> {
  const identities = new Map<string, SplitSegmentIdentity>();
  const tracks = timeline?.tracks ?? [];

  // Group chain members by chain id so segment indexes are global to the chain
  // (a segment dragged to another track keeps its index).
  const chains = new Map<string, SplitIdentityClip[]>();
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      if (!clip.splitGroupId) continue;
      const members = chains.get(clip.splitGroupId);
      if (members) members.push(clip);
      else chains.set(clip.splitGroupId, [clip]);
    }
  }
  for (const members of chains.values()) members.sort((a, b) => chainSortKey(a) - chainSortKey(b));

  // Per-chain contiguity: a chain whose segments are contiguous on a SINGLE track
  // can share one `<video>` element / decode stream. A chain that was re-ordered,
  // gapped, or spread over several tracks cannot.
  const shareableChains = new Map<string, boolean>();
  for (const [chainId, members] of chains) {
    const tracksUsed = new Set(members.map((m) => m.trackId ?? 'default'));
    if (tracksUsed.size !== 1) {
      shareableChains.set(chainId, false);
      continue;
    }
    const ordered = [...members].sort((a, b) => chainSortKey(a) - chainSortKey(b));
    let contiguous = true;
    for (let i = 1; i < ordered.length; i++) {
      const prevEnd = num(ordered[i - 1].startTime, 0) + num(ordered[i - 1].duration, 0);
      if (Math.abs(prevEnd - num(ordered[i].startTime, 0)) > FRAME_EPSILON) {
        contiguous = false;
        break;
      }
    }
    shareableChains.set(chainId, contiguous);
  }

  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      const members = clip.splitGroupId ? chains.get(clip.splitGroupId) ?? [clip] : [clip];
      const index = members.findIndex((m) => m.id === clip.id);
      const segmentIndex = index >= 0 ? index : 0;
      const prev = segmentIndex > 0 ? members[segmentIndex - 1] : undefined;
      const next = segmentIndex < members.length - 1 ? members[segmentIndex + 1] : undefined;

      const timelineStart = num(clip.startTime, 0);
      const timelineEnd = timelineStart + Math.max(0, num(clip.duration, 0));
      const source = sourceWindowForClip(clip);
      const contiguousWithPrevious = prev
        ? Math.abs(num(prev.startTime, 0) + num(prev.duration, 0) - timelineStart) <= FRAME_EPSILON
        : false;
      const contiguousWithNext = next
        ? Math.abs(timelineEnd - num(next.startTime, 0)) <= FRAME_EPSILON
        : false;

      // Element sharing is only safe when the whole chain is contiguous on ONE
      // track; otherwise crossing the chain would force a seek — or, on an
      // overlap, two clips fighting over one element's `currentTime`.
      const shareableElement =
        !!clip.splitGroupId && shareableChains.get(clip.splitGroupId) === true;

      const mediaId = clip.mediaId || 'unknown';
      const identity: SplitSegmentIdentity = {
        clipId: clip.id,
        mediaId,
        trackId: clip.trackId ?? track.id ?? 'default',
        chainId: clip.splitGroupId ?? null,
        segmentIndex,
        segmentCount: members.length,
        contiguousWithPrevious,
        contiguousWithNext,
        timelineStart,
        timelineEnd,
        source,
        renderKey: renderKeyForClip(clip),
        shareKey: shareableElement ? shareKeyForClip(clip) : `${mediaId}::clip:${clip.id}`,
        shareableElement,
      };
      identities.set(clip.id, identity);
    }
  }

  return identities;
}

/**
 * Re-stamps `splitGroupId`/`splitSegmentIndex` on every clip of every chain in
 * the given timeline so segment indexes always match timeline order. Called by
 * the store after a split (and after a segment is moved) so the identity the
 * preview and the export worker derive is deterministic instead of accidental.
 *
 * Returns the (possibly new) array of tracks; untouched tracks keep identity.
 */
export function restampSplitChains<T extends SplitIdentityTimeline>(timeline: T): T {
  const tracks = timeline?.tracks ?? [];
  const chains = new Map<string, SplitIdentityClip[]>();
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      if (!clip.splitGroupId) continue;
      const members = chains.get(clip.splitGroupId);
      if (members) members.push(clip);
      else chains.set(clip.splitGroupId, [clip]);
    }
  }
  if (chains.size === 0) return timeline;

  const indexes = new Map<string, number>();
  for (const members of chains.values()) {
    members.sort((a, b) => chainSortKey(a) - chainSortKey(b));
    members.forEach((clip, index) => indexes.set(clip.id, index));
  }

  let changed = false;
  const nextTracks = tracks.map((track) => {
    let trackChanged = false;
    const clips = (track.clips ?? []).map((clip) => {
      const index = indexes.get(clip.id);
      if (index === undefined || clip.splitSegmentIndex === index) return clip;
      trackChanged = true;
      return { ...clip, splitSegmentIndex: index };
    });
    if (!trackChanged) return track;
    changed = true;
    return { ...track, clips };
  });

  return changed ? ({ ...(timeline as any), tracks: nextTracks } as T) : timeline;
}

/**
 * Returns the other clips of the same split chain (excluding `clipId`), ordered
 * by timeline position. Returns an empty array for un-split clips.
 */
export function splitChainSiblings(
  timeline: SplitIdentityTimeline | null | undefined,
  clipId: string,
): SplitIdentityClip[] {
  let chainId: string | undefined;
  for (const track of timeline?.tracks ?? []) {
    const found = (track.clips ?? []).find((clip) => clip.id === clipId);
    if (found) {
      chainId = found.splitGroupId;
      break;
    }
  }
  if (!chainId) return [];
  const siblings: SplitIdentityClip[] = [];
  for (const track of timeline?.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      if (clip.splitGroupId === chainId && clip.id !== clipId) siblings.push(clip);
    }
  }
  return siblings.sort((a, b) => chainSortKey(a) - chainSortKey(b));
}

/**
 * Finds the sibling segment that is *time-adjacent* to `clipId` — the element
 * the preview may legitimately reuse. Returns `null` when no contiguous
 * same-track neighbour exists (caller should then use a dedicated element).
 */
export function adjacentSplitSibling(
  timeline: SplitIdentityTimeline | null | undefined,
  clipId: string,
  direction: 'previous' | 'next' | 'either' = 'either',
): SplitIdentityClip | null {
  const identities = buildSplitIdentities(timeline);
  const identity = identities.get(clipId);
  // Only chains the provider marked shareable may hand their element over — a
  // reordered / overlapping / cross-track chain would corrupt both clips.
  if (!identity || !identity.chainId || !identity.shareableElement) return null;
  const siblings = splitChainSiblings(timeline, clipId);
  const previous = siblings
    .filter((clip) => clip.startTime + clip.duration <= identity.timelineStart + FRAME_EPSILON)
    .pop();
  const next = siblings.find((clip) => clip.startTime >= identity.timelineEnd - FRAME_EPSILON);
  if (direction === 'previous') return previous ?? null;
  if (direction === 'next') return next ?? null;
  return previous ?? next ?? null;
}

// ---------------------------------------------------------------------------
// Decode stream planning (multi-track export rendering)
// ---------------------------------------------------------------------------

export interface DecodeStream {
  /** Stable id, e.g. `stream:m1#2`. Used as the decoder cache key. */
  id: string;
  mediaId: string;
  /** Track the stream starts on; `null` when the budget forced clips to share. */
  trackId: string | null;
  clipIds: string[];
  /**
   * True when at least one clip had to share this stream with a clip it does not
   * follow monotonically. Such a stream may need an occasional seek; it is
   * always preferred over creating unbounded decoders.
   */
  shared: boolean;
}

export interface DecodeStreamPlan {
  streams: DecodeStream[];
  byClip: Map<string, DecodeStream>;
}

export interface DecodeStreamOptions {
  /**
   * Maximum number of decoders per media file. Split-heavy timelines can produce
   * dozens of segments; only the ones that are genuinely simultaneous need their
   * own decoder. Default 4 (desktop) — mobile callers pass a smaller budget.
   */
  maxStreamsPerMedia?: number;
  /** Clips closer together than this are treated as contiguous. */
  epsilon?: number;
}

interface StreamState {
  stream: DecodeStream;
  lastTimelineEnd: number;
  lastSourceEnd: number;
  lastSourceStart: number;
  reversed: boolean;
}

function canAppendToStream(
  state: StreamState,
  clip: SplitIdentityClip,
  window: SourceWindow,
  epsilon: number,
): boolean {
  const clipStart = num(clip.startTime, 0);
  // Timeline overlap: two clips on screen at once must never share a decoder.
  if (clipStart < state.lastTimelineEnd - epsilon) return false;
  if (state.reversed !== window.reversed) return false;
  if (window.reversed) {
    // Media consumed backwards: the next clip must continue *earlier* in source.
    return window.end <= state.lastSourceStart + epsilon;
  }
  return window.start >= state.lastSourceEnd - epsilon;
}

/**
 * Groups the timeline's video clips into decode streams.
 *
 * Rules (deliberately conservative — a wrong "share" costs a decode rewind,
 * while an extra stream only costs one decoder session):
 *
 *  1. Clips that overlap on the timeline never share a stream.
 *  2. Clips whose source windows are not monotonically ordered never share.
 *  3. Reversed and forward clips never share.
 *  4. A chain of contiguous split segments on one track DOES share — this keeps
 *     the "cross a split boundary without touching the decoder" win.
 *  5. Per-media stream count is capped by `maxStreamsPerMedia`; beyond that the
 *     planner picks the nearest compatible stream and marks it `shared`.
 */
export function planDecodeStreams(
  timeline: SplitIdentityTimeline | null | undefined,
  options: DecodeStreamOptions = {},
): DecodeStreamPlan {
  const maxStreamsPerMedia = Math.max(1, options.maxStreamsPerMedia ?? 4);
  const epsilon = options.epsilon ?? 1 / 240;

  const byMedia = new Map<string, SplitIdentityClip[]>();
  for (const track of timeline?.tracks ?? []) {
    // Only tracks that actually render decoded frames need streams: text / fx /
    // adjustment tracks never touch a decoder, and hidden tracks are skipped by
    // the scheduler anyway.
    if (track.hidden) continue;
    if (track.type !== undefined && track.type !== 'video') continue;
    for (const clip of track.clips ?? []) {
      if (clip.disabled) continue;
      const mediaId = clip.mediaId || clip.id;
      const list = byMedia.get(mediaId);
      if (list) list.push(clip);
      else byMedia.set(mediaId, [clip]);
    }
  }

  const streams: DecodeStream[] = [];
  const byClip = new Map<string, DecodeStream>();

  for (const [mediaId, clips] of byMedia) {
    const ordered = [...clips].sort(
      (a, b) => num(a.startTime, 0) - num(b.startTime, 0) || String(a.id).localeCompare(String(b.id)),
    );
    const states: StreamState[] = [];

    for (const clip of ordered) {
      const window = sourceWindowForClip(clip);
      let best: StreamState | null = null;
      let bestDistance = Infinity;

      for (const state of states) {
        if (!canAppendToStream(state, clip, window, epsilon)) continue;
        const distance = window.reversed
          ? Math.abs(state.lastSourceStart - window.end)
          : Math.abs(window.start - state.lastSourceEnd);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = state;
        }
      }

      if (!best && states.length < maxStreamsPerMedia) {
        best = {
          stream: {
            id: `stream:${mediaId}#${states.length}`,
            mediaId,
            trackId: clip.trackId ?? null,
            clipIds: [],
            shared: false,
          },
          lastTimelineEnd: -Infinity,
          lastSourceEnd: -Infinity,
          lastSourceStart: Infinity,
          reversed: window.reversed,
        };
        states.push(best);
      } else if (!best) {
        // Budget exhausted: reuse the stream with the smallest source gap. It is
        // marked `shared` so the decoder can absorb the occasional seek, and so
        // diagnostics can explain any hiccup.
        let fallback: StreamState | null = null;
        let fallbackDistance = Infinity;
        for (const state of states) {
          const distance = window.reversed
            ? Math.abs(state.lastSourceStart - window.end)
            : Math.abs(window.start - state.lastSourceEnd);
          if (distance < fallbackDistance) {
            fallbackDistance = distance;
            fallback = state;
          }
        }
        best = fallback;
        if (best) best.stream.shared = true;
      }

      if (!best) continue; // unreachable, keeps TS happy
      best.stream.clipIds.push(clip.id);
      best.lastTimelineEnd = Math.max(best.lastTimelineEnd, num(clip.startTime, 0) + num(clip.duration, 0));
      best.lastSourceEnd = Math.max(best.lastSourceEnd, window.end);
      best.lastSourceStart = Math.min(best.lastSourceStart, window.start);
      best.reversed = window.reversed;
      if (!best.stream.trackId && clip.trackId) best.stream.trackId = clip.trackId;
      byClip.set(clip.id, best.stream);
    }

    streams.push(...states.map((state) => state.stream));
  }

  return { streams, byClip };
}

/**
 * Convenience for the preview: the `<video>` element key a clip should use.
 * Returns an explicit per-clip key when the clip must not share.
 */
export function previewShareKey(
  timeline: SplitIdentityTimeline | null | undefined,
  clip: SplitIdentityClip,
): string {
  const identities = buildSplitIdentities(timeline);
  return identities.get(clip.id)?.shareKey ?? shareKeyForClip(clip);
}

/**
 * True when two clips may be decoded by the same sequential decoder without
 * forcing a rewind. Exposed for tests and diagnostics.
 */
export function canShareDecodeStream(a: SplitIdentityClip, b: SplitIdentityClip): boolean {
  if ((a.mediaId || a.id) !== (b.mediaId || b.id)) return false;
  const [first, second] = num(a.startTime, 0) <= num(b.startTime, 0) ? [a, b] : [b, a];
  const firstEnd = num(first.startTime, 0) + num(first.duration, 0);
  if (num(second.startTime, 0) < firstEnd - FRAME_EPSILON) return false;
  const firstWindow = sourceWindowForClip(first);
  const secondWindow = sourceWindowForClip(second);
  if (firstWindow.reversed !== secondWindow.reversed) return false;
  return firstWindow.reversed
    ? secondWindow.end <= firstWindow.start + FRAME_EPSILON
    : secondWindow.start >= firstWindow.end - FRAME_EPSILON;
}
