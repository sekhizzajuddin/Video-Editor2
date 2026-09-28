import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  preRenderedMaskCache,
  applyPreRenderedMaskIfAvailable,
  getEmptyMaskSentinel,
  isEmptyMaskMarker,
  getPooledCanvas,
  ensureClipMasksReady,
} from './aiBackground';

describe('aiBackground export pipeline', () => {
  beforeEach(() => {
    preRenderedMaskCache.clear();
  });

  it('getPooledCanvas respects canvas environment', () => {
    const canvas = getPooledCanvas('test_pool_key', 100, 100);
    expect(canvas).toBeDefined();
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it('identifies 1x1 empty mask sentinels correctly', () => {
    const sentinel = getEmptyMaskSentinel();
    expect(isEmptyMaskMarker(sentinel)).toBe(true);

    const normalCanvas = getPooledCanvas('normal_test', 384, 216);
    expect(isEmptyMaskMarker(normalCanvas)).toBe(false);
  });

  it('applyPreRenderedMaskIfAvailable returns true for empty mask sentinel without modifying context', () => {
    const clipId = 'clip_empty_test';
    const maskMap = new Map();
    const sentinel = getEmptyMaskSentinel();
    // Cache at time 0 (key 0)
    maskMap.set(0, sentinel);
    preRenderedMaskCache.set(clipId, maskMap);

    const targetCanvas = getPooledCanvas('target_canvas', 320, 180);
    const ctx = targetCanvas.getContext('2d')!;

    const sourceElement: any = { currentTime: 0 };
    const applied = applyPreRenderedMaskIfAvailable(
      ctx as any,
      320,
      180,
      sourceElement,
      clipId,
      false, // isPlaying
      1,     // modelSelection
      0,     // choke
      0,     // feather
      0,     // spillSuppression
      undefined,
      { isExporting: true }
    );

    expect(applied).toBe(true);
  });

  it('applyPreRenderedMaskIfAvailable finds nearest mask during export within 0.5s', () => {
    const clipId = 'clip_search_test';
    const maskMap = new Map();
    // Create a 2x2 mock mask at time 1.0s (key 30)
    const mockMask = getPooledCanvas('mock_mask', 10, 10);
    maskMap.set(30, mockMask);
    preRenderedMaskCache.set(clipId, maskMap);

    const targetCanvas = getPooledCanvas('target_canvas_2', 320, 180);
    const ctx = targetCanvas.getContext('2d')!;

    // Request at time 1.1s (key 33 -> offset = 3, inside standard search)
    const sourceElementNear: any = { currentTime: 1.1 };
    const appliedNear = applyPreRenderedMaskIfAvailable(
      ctx as any,
      320,
      180,
      sourceElementNear,
      clipId,
      false,
      1,
      0,
      0,
      0,
      undefined,
      { isExporting: true }
    );
    expect(appliedNear).toBe(true);

    // Request at time 1.25s (key 38 -> offset = 8, inside widened export search window of 15)
    const sourceElementFar: any = { currentTime: 1.25 };
    const appliedFar = applyPreRenderedMaskIfAvailable(
      ctx as any,
      320,
      180,
      sourceElementFar,
      clipId,
      false,
      1,
      0,
      0,
      0,
      undefined,
      { isExporting: true }
    );
    expect(appliedFar).toBe(true);
  });

  it('handles all cutout modes (blur, color, outline) during export', () => {
    const clipId = 'clip_modes_test';
    const maskMap = new Map();
    const mockMask = getPooledCanvas('mode_mask', 20, 20);
    maskMap.set(0, mockMask);
    preRenderedMaskCache.set(clipId, maskMap);

    const targetCanvas = getPooledCanvas('target_mode_canvas', 320, 180);
    const ctx = targetCanvas.getContext('2d')!;
    const sourceElement: any = { currentTime: 0 };

    // Blur mode
    const blurApplied = applyPreRenderedMaskIfAvailable(
      ctx as any,
      320,
      180,
      sourceElement,
      clipId,
      false,
      1,
      0,
      0,
      0,
      undefined,
      { mode: 'blur', blurStrength: 8, isExporting: true }
    );
    expect(blurApplied).toBe(true);

    // Color mode
    const colorApplied = applyPreRenderedMaskIfAvailable(
      ctx as any,
      320,
      180,
      sourceElement,
      clipId,
      false,
      1,
      0,
      0,
      0,
      undefined,
      { mode: 'color', bgColor: '#ff0000', isExporting: true }
    );
    expect(colorApplied).toBe(true);

    // Outline mode
    const outlineApplied = applyPreRenderedMaskIfAvailable(
      ctx as any,
      320,
      180,
      sourceElement,
      clipId,
      false,
      1,
      0,
      0,
      0,
      undefined,
      { mode: 'outline', strokeColor: '#00ffff', strokeWidth: 4, isExporting: true }
    );
    expect(outlineApplied).toBe(true);
  });
});
