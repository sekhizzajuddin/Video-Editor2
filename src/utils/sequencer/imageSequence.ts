import type {
  ClipInterpolationSettings,
  ImageSequence,
  SequenceEasing,
  SequenceTransitionType,
  TimelineClip,
} from '@/types';

export interface BuildSequenceInputs {
  mediaIds: string[];
  trackId: string;
  startTime: number;
  defaultClipDuration?: number;
  overlap?: number;
  transitionType?: SequenceTransitionType;
  interpolation?: ClipInterpolationSettings;
  kenBurnsAuto?: boolean;
  name?: string;
}

export interface BuildSequenceResult {
  clips: TimelineClip[];
  sequence: ImageSequence;
  totalDurationSeconds: number;
}

const DEFAULT_DURATION = 3;
const DEFAULT_OVERLAP = 0;
const DEFAULT_TRANSITION: SequenceTransitionType = 'crossfade';
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateSequenceId(): string {
  let s = 'seq_';
  for (let i = 0; i < 10; i++) {
    s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return s;
}

export function generateClipId(): string {
  let id = 'c_';
  for (let i = 0; i < 12; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

function clipSequence(
  mediaId: string,
  trackId: string,
  startTime: number,
  duration: number,
  interpolation: ClipInterpolationSettings,
  sequenceId: string,
  kenBurns?: TimelineClip['kenBurns'],
): TimelineClip {
  const base: TimelineClip = {
    id: generateClipId(),
    mediaId,
    trackId,
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { x: 0, y: 0, scale: 100, rotation: 0 },
    opacity: 1,
    speed: 1,
    effects: [],
  };

  if (interpolation && interpolation.mode !== 'none') {
    base.interpolation = { ...interpolation };
  }
  if (sequenceId) base.sequenceId = sequenceId;
  if (kenBurns) base.kenBurns = { ...kenBurns };
  return base;
}

/**
 * Build a sequence of image clips. Pure: returns the ordered list of clips
 * and the descriptor; caller is responsible for inserting them via the store.
 *
 * Layout:
 *   clip[i].startTime = startTime + i * (defaultDuration - overlap)
 *   clip[i].duration   = defaultDuration
 *   totalDuration      = N * defaultDuration - (N-1) * overlap
 */
export function buildSequence(input: BuildSequenceInputs): BuildSequenceResult {
  const {
    mediaIds,
    trackId,
    startTime,
    defaultClipDuration = DEFAULT_DURATION,
    overlap = DEFAULT_OVERLAP,
    transitionType = DEFAULT_TRANSITION,
    interpolation = { mode: 'kenburns' },
    kenBurnsAuto = true,
    name,
  } = input;

  if (mediaIds.length < 2) {
    throw new Error('buildSequence requires at least 2 image mediaIds');
  }
  if (defaultClipDuration <= 0.05) {
    throw new Error('defaultClipDuration must be > 0.05 seconds');
  }
  if (overlap < 0 || overlap >= defaultClipDuration) {
    throw new Error('overlap must be in [0, defaultClipDuration)');
  }

  const sequenceId = generateSequenceId();
  const step = defaultClipDuration - overlap;

  const clips: TimelineClip[] = mediaIds.map((mediaId, i) => {
    const clipStart = startTime + i * step;
    return clipSequence(
      mediaId,
      trackId,
      clipStart,
      defaultClipDuration,
      interpolation,
      sequenceId,
    );
  });

  // attach transition on every adjacent pair based on transitionType
  if (transitionType !== 'cut' && overlap > 0) {
    for (let i = 0; i < clips.length - 1; i++) {
      const a = clips[i];
      const b = clips[i + 1];
      const typeName = transitionType === 'kenburnsFade' ? 'kenburns' : transitionType;
      a.interpolation = {
        ...(a.interpolation ?? { mode: 'none' }),
        blendDuration: overlap,
        preset: typeName as any,
      };
      b.interpolation = {
        ...(b.interpolation ?? { mode: 'none' }),
        blendDuration: overlap,
        preset: typeName as any,
      };
    }
  }

  const sequence: ImageSequence = {
    id: sequenceId,
    trackId,
    startTime,
    defaultClipDuration,
    overlap,
    transitionType,
    kenBurnsAuto,
    interpolation: { ...interpolation },
    memberClipIds: clips.map((c) => c.id),
    name: name ?? `Sequence ${mediaIds.length}-frames`,
    createdAt: Date.now(),
  };

  const totalDurationSeconds =
    clips.length * defaultClipDuration - Math.max(0, clips.length - 1) * overlap;

  return { clips, sequence, totalDurationSeconds };
}

/**
 * Apply a patch to a sequence and propagate interpolation onto member clips.
 * Pure helper used by store + tests.
 */
export function cascadeSequencePatch(
  sequence: ImageSequence,
  patch: Partial<ImageSequence>,
): ImageSequence {
  const next: ImageSequence = {
    ...sequence,
    ...patch,
    interpolation: patch.interpolation
      ? { ...sequence.interpolation, ...patch.interpolation }
      : sequence.interpolation,
  };
  return next;
}

/**
 * Compute the easing-adjusted t for a clip given its progress within [0,1].
 */
export function applyEasing(t: number, easing: SequenceEasing = 'easeInOut'): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return x;
    case 'easeIn':
      return x * x;
    case 'easeOut':
      return x * (2 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
}

/**
 * Given a clip and an optional predecessor, derive the live Ken Burns values
 * for the current playback time. Pure / synchronous — used by the render path
 * and by the auto-KB module.
 */
export function deriveActiveKenBurns(
  clip: TimelineClip,
  startKb?: { scale: number; panX: number; panY: number },
  endKb?: { scale: number; panX: number; panY: number },
): { scalePct: number; panXPct: number; panYPct: number } {
  const easing: SequenceEasing =
    (clip.kenBurns?.easing as SequenceEasing | undefined) ?? 'easeInOut';
  const rawP = clip.duration > 0 ? Math.max(0, Math.min(1, -clip.trimStart / clip.duration)) : 0;
  const t = applyEasing(rawP, easing);
  if (!startKb || !endKb) {
    return {
      scalePct: clip.kenBurns?.endScale ?? 100,
      panXPct: clip.kenBurns?.endPanX ?? 0,
      panYPct: clip.kenBurns?.endPanY ?? 0,
    };
  }
  return {
    scalePct: startKb.scale + (endKb.scale - startKb.scale) * t,
    panXPct: startKb.panX + (endKb.panX - startKb.panX) * t,
    panYPct: startKb.panY + (endKb.panY - startKb.panY) * t,
  };
}

export function sequenceTotalDuration(seq: ImageSequence): number {
  const n = seq.memberClipIds.length;
  if (n <= 0) return 0;
  return n * seq.defaultClipDuration - Math.max(0, n - 1) * seq.overlap;
}
