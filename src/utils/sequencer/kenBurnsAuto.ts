import type { MediaItem } from '@/types';
import type { InterpolationPreset } from '@/types';

export type KenBurnsVariant =
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoomIn'
  | 'zoomOut'
  | 'orbit'
  | 'static';

export interface KenBurnsFrame {
  scale: number; // 100 = base
  panX: number;  // % of frame width
  panY: number;  // % of frame height
}

export interface AutoKenBurnsResult {
  start: KenBurnsFrame;
  end: KenBurnsFrame;
  variant: KenBurnsVariant;
  preset: InterpolationPreset;
}

export interface AutoKenBurnsOptions {
  /** strength of motion: 0..1, defaults to 0.6 */
  aggressiveness?: number;
  /** seed for deterministic motion */
  seed?: number;
}

// Mulberry32 — small deterministic PRNG so we can test outputs stably.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStrings(a: string, b: string): number {
  let h = 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function aspectRatio(item: MediaItem | undefined): number {
  if (!item) return 1;
  const w = item.width ?? 1;
  const h = item.height ?? 1;
  return w / Math.max(1, h);
}

/**
 * Pick a Ken Burns animation between two images. Pure (no DOM access required),
 * deterministic for a given pair (hash of mediaIds) so users see consistent
 * motion on re-render.
 *
 * Heuristics:
 *  - landscape landscape: orbit or slow pan
 *  - landscape portrait: zoomIn (portrait reveals details)
 *  - portrait landscape: zoomOut (reveal wider scene)
 *  - similar dims: random pan direction
 */
export function autoKenBurnsForPair(
  prev?: MediaItem,
  next?: MediaItem,
  options: AutoKenBurnsOptions = {},
): AutoKenBurnsResult {
  const { aggressiveness = 0.6, seed } = options;
  const amp = Math.max(0, Math.min(1, aggressiveness));

  const seed2 = seed ?? hashStrings(prev?.id ?? '', next?.id ?? '');
  const rand = mulberry32(seed2);

  const prevRatio = aspectRatio(prev);
  const nextRatio = aspectRatio(next);

  let variant: KenBurnsVariant = 'pan-right';

  if (prevRatio > 1.2 && nextRatio > 1.2) {
    variant = rand() > 0.5 ? 'pan-left' : 'pan-right';
  } else if (prevRatio <= 1.2 && nextRatio > 1.2) {
    variant = 'zoomIn';
  } else if (prevRatio > 1.2 && nextRatio <= 1.2) {
    variant = 'zoomOut';
  } else if (Math.abs(prevRatio - nextRatio) < 0.05) {
    const choices: KenBurnsVariant[] = ['pan-up', 'pan-down', 'zoomIn', 'zoomOut'];
    variant = choices[Math.floor(rand() * choices.length)];
  } else {
    variant = rand() > 0.5 ? 'pan-right' : 'pan-left';
  }

  const magnitude = 6 + amp * 14; // 6–20%
  const start = { scale: 100, panX: 0, panY: 0 };
  const end = { scale: 100, panX: 0, panY: 0 };

  switch (variant) {
    case 'pan-left':
      start.panX = magnitude;
      end.panX = -magnitude;
      break;
    case 'pan-right':
      start.panX = -magnitude;
      end.panX = magnitude;
      break;
    case 'pan-up':
      start.panY = magnitude;
      end.panY = -magnitude;
      break;
    case 'pan-down':
      start.panY = -magnitude;
      end.panY = magnitude;
      break;
    case 'zoomIn':
      start.scale = 100 - magnitude / 2;
      end.scale = 100 + magnitude / 2;
      break;
    case 'zoomOut':
      start.scale = 100 + magnitude / 2;
      end.scale = 100 - magnitude / 2;
      break;
    case 'orbit':
      start.panX = -magnitude;
      end.panX = magnitude;
      start.scale = 100 - magnitude / 4;
      end.scale = 100 + magnitude / 4;
      break;
    case 'static':
      break;
  }

  const presetMap: Record<KenBurnsVariant, InterpolationPreset> = {
    'pan-left': 'kenburns-pan',
    'pan-right': 'kenburns-pan',
    'pan-up': 'kenburns-pan',
    'pan-down': 'kenburns-pan',
    zoomIn: 'kenburns-zoomIn',
    zoomOut: 'kenburns-zoomOut',
    orbit: 'kenburns-orbit',
    static: 'kenburns-pan',
  };

  return {
    start,
    end,
    variant,
    preset: presetMap[variant],
  };
}

/**
 * Convert from `{ scale, panX, panY }` (auto-KB output) to the legacy
 * `ClipKenBurnsSettings` shape used elsewhere in the app.
 */
export function autoResultToSettings(
  result: AutoKenBurnsResult,
): {
  enabled: true;
  startScale: number;
  startPanX: number;
  startPanY: number;
  endScale: number;
  endPanX: number;
  endPanY: number;
  easing: 'easeInOut';
} {
  return {
    enabled: true,
    startScale: result.start.scale,
    startPanX: result.start.panX,
    startPanY: result.start.panY,
    endScale: result.end.scale,
    endPanX: result.end.panX,
    endPanY: result.end.panY,
    easing: 'easeInOut',
  };
}
