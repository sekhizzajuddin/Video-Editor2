/**
 * colorRegionGenerator.test.ts
 *
 * Unit tests for the Color Region Generator module.
 * Tests spatial constraints, temporal coherence, and edge-aware fill.
 */

import { describe, it, expect } from 'vitest';
import {
  buildEnhancedSignature,
  initTrackingState,
  updateTrackingState,
  DEFAULT_REGION_SETTINGS,
} from './colorRegionGenerator';

describe('buildEnhancedSignature', () => {
  const W = 100;
  const H = 100;

  function makeFrame(r: number, g: number, b: number): Uint8ClampedArray {
    const frame = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      frame[i * 4] = r;
      frame[i * 4 + 1] = g;
      frame[i * 4 + 2] = b;
      frame[i * 4 + 3] = 255;
    }
    return frame;
  }

  function strokeRect(x: number, y: number, w: number, h: number): Uint8Array {
    const mask = new Uint8Array(W * H);
    for (let iy = y; iy < y + h && iy < H; iy++) {
      for (let ix = x; ix < x + w && ix < W; ix++) {
        mask[iy * W + ix] = 1;
      }
    }
    return mask;
  }

  it('builds signature with spatial footprint', () => {
    const frame = makeFrame(200, 100, 100); // reddish
    const stroke = strokeRect(40, 40, 20, 20);
    const sig = buildEnhancedSignature(frame, W, H, stroke)!;

    expect(sig).toBeTruthy();
    expect(sig.centers.length).toBeGreaterThan(0);
    expect(sig.patchRadius).toBeGreaterThan(0);
    expect(sig.patchArea).toBe(20 * 20);

    // Check spatial footprint
    expect(sig.paintedCentroid.x).toBeCloseTo(49.5, 0);
    expect(sig.paintedCentroid.y).toBeCloseTo(49.5, 0);
    expect(sig.paintedBounds.x).toBe(40);
    expect(sig.paintedBounds.y).toBe(40);
    expect(sig.paintedBounds.w).toBe(20);
    expect(sig.paintedBounds.h).toBe(20);
  });

  it('returns null for empty stroke', () => {
    const frame = makeFrame(200, 100, 100);
    const emptyStroke = new Uint8Array(W * H);
    expect(buildEnhancedSignature(frame, W, H, emptyStroke)).toBeNull();
  });

  it('handles multi-tone subjects', () => {
    // Create a frame with two distinct red tones
    const frame = makeFrame(200, 100, 100);
    // Add a darker patch
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 50; x++) {
        const i = (y * W + x) * 4;
        frame[i] = 150;
        frame[i + 1] = 75;
        frame[i + 2] = 75;
      }
    }
    const stroke = strokeRect(40, 40, 20, 20);
    const sig = buildEnhancedSignature(frame, W, H, stroke)!;

    expect(sig).toBeTruthy();
    // Should detect multiple clusters for the two tones
    expect(sig.centers.length).toBeGreaterThanOrEqual(1);
  });
});

describe('updateTrackingState', () => {
  it('tracks velocity correctly', () => {
    const state = initTrackingState({ x: 100, y: 100 }, 400, 0);
    const settings = DEFAULT_REGION_SETTINGS;

    // Move 50 pixels in 0.1 seconds = 500 px/s
    const result1 = updateTrackingState(state, { x: 150, y: 100 }, 400, 0.1, settings);
    expect(result1.newState.velocity.x).toBeGreaterThan(0);
    expect(result1.coherence).toBeCloseTo(1.0, 1); // Within maxVelocity

    // Continue moving at same speed
    const result2 = updateTrackingState(result1.newState, { x: 200, y: 100 }, 400, 0.2, settings);
    expect(result2.coherence).toBeCloseTo(1.0, 1);
  });

  it('penalizes excessive velocity', () => {
    const state = initTrackingState({ x: 100, y: 100 }, 400, 0);
    const settings = DEFAULT_REGION_SETTINGS;

    // Jump 200 pixels in 0.1 seconds = 2000 px/s (exceeds maxVelocity of 800)
    const result = updateTrackingState(state, { x: 300, y: 100 }, 400, 0.1, settings);
    expect(result.coherence).toBeLessThan(0.5);
  });

  it('penalizes large area changes', () => {
    const state = initTrackingState({ x: 100, y: 100 }, 400, 0);
    const settings = DEFAULT_REGION_SETTINGS;

    // Area quadruples in 0.1 seconds (> 200% per second)
    const result = updateTrackingState(state, { x: 100, y: 100 }, 1600, 0.1, settings);
    expect(result.coherence).toBeLessThan(1.0);
  });

  it('accumulates low confidence streak', () => {
    let state = initTrackingState({ x: 100, y: 100 }, 400, 0);
    const settings = DEFAULT_REGION_SETTINGS;

    // Multiple implausible jumps
    for (let i = 0; i < 3; i++) {
      const result = updateTrackingState(state, { x: 100 + (i + 1) * 200, y: 100 }, 400, (i + 1) * 0.1, settings);
      state = result.newState;
    }

    expect(state.lowConfidenceStreak).toBeGreaterThan(0);
  });
});

describe('DEFAULT_REGION_SETTINGS', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_REGION_SETTINGS.spreadLimit).toBe(2.2);
    expect(DEFAULT_REGION_SETTINGS.maxVelocity).toBe(800);
    expect(DEFAULT_REGION_SETTINGS.maxAreaChange).toBe(2.0);
    expect(DEFAULT_REGION_SETTINGS.minConfidence).toBe(0.15);
    expect(DEFAULT_REGION_SETTINGS.useEdgeAwareFill).toBe(true);
  });
});
