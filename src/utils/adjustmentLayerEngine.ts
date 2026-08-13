/**
 * adjustmentLayerEngine.ts — Adjustment Layer Composition Engine.
 *
 * Adapted from OpenReel Adjustment Layer architecture.
 * Adjustment Layers act as visual filter clips placed on upper timeline tracks.
 * They sample all underlying rendered video layers and apply global color grading,
 * LUTs, blurs, and FX filters across lower tracks.
 */

import type { TimelineClip } from '@/types';
import { applyColorOverlays } from '@/utils/canvasEffects';

export interface AdjustmentLayerOptions {
  name?: string;
  duration?: number;
  opacity?: number;
}

/**
 * Checks if a clip is an Adjustment Layer clip.
 */
export function isAdjustmentLayerClip(clip: TimelineClip): boolean {
  return !!clip.isAdjustmentLayer || (clip as any).mediaId?.startsWith('adj_');
}

/**
 * Applies Adjustment Layer color filters and FX passes onto the composite canvas context.
 */
export function applyAdjustmentLayerPass(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  width: number,
  height: number
): void {
  if (!clip || clip.disabled || clip.opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = clip.opacity;

  // Apply color grading filters (temperature, tint, fadedFilm, vignette)
  if (clip.colorFilters) {
    applyColorOverlays(ctx, 0, 0, width, height, clip.colorFilters);
  }

  ctx.restore();
}
