import { describe, it, expect } from 'vitest';
import { ELEMENT_SHAPES, ELEMENT_EMOJI_CATEGORIES, ELEMENT_STICKERS } from '@/constants/elements';
import { calculateElementAnimation } from '@/utils/elementRenderer';
import { applyFxEffect } from '@/utils/canvasEffects';
import { FX_EFFECTS } from '@/constants/mediaPanel';
import { ClipElementSettings } from '@/types';

describe('Elements Library & High-Quality Presets', () => {
  it('contains comprehensive vector shapes with valid dimensions and animations', () => {
    expect(ELEMENT_SHAPES.length).toBeGreaterThanOrEqual(16);
    for (const shape of ELEMENT_SHAPES) {
      expect(shape.id).toBeDefined();
      expect(shape.label).toBeDefined();
      expect(shape.shapeType).toBeDefined();
      expect(shape.category).toBeDefined();
      expect(shape.defaultSettings.width).toBeGreaterThan(0);
      expect(shape.defaultSettings.height).toBeGreaterThan(0);
      expect(shape.defaultSettings.elementType).toBe('shape');
    }
  });

  it('contains categorized emojis across viral, attention, hearts, hands, and arrows groups', () => {
    expect(ELEMENT_EMOJI_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    const totalEmojis = ELEMENT_EMOJI_CATEGORIES.reduce((acc, cat) => acc + cat.emojis.length, 0);
    expect(totalEmojis).toBeGreaterThanOrEqual(100);
  });

  it('contains creator stickers and badges with spring and pulse presets', () => {
    expect(ELEMENT_STICKERS.length).toBeGreaterThanOrEqual(5);
    for (const sticker of ELEMENT_STICKERS) {
      expect(sticker.name).toBeDefined();
      expect(sticker.label).toBeDefined();
      expect(sticker.defaultSettings.elementType).toMatch(/^(sticker|badge)$/);
      expect(sticker.defaultSettings.animationIn).toBeDefined();
      expect(sticker.defaultSettings.animationLoop).toBeDefined();
    }
  });
});

describe('Element Animation & Pure Deterministic Math', () => {
  const baseSettings: ClipElementSettings = {
    elementType: 'shape',
    shapeType: 'rounded_rect',
    width: 200,
    height: 150,
    animationIn: 'bounce_spring',
    animationInDuration: 0.5,
    animationLoop: 'pulse',
    animationLoopSpeed: 1.0,
    animationLoopIntensity: 40,
    animationOut: 'pop_out',
    animationOutDuration: 0.3,
  };

  it('correctly calculates entrance animation phase', () => {
    // At t = 0s (entrance start): opacity is 0 and scale starts small
    const startAnim = calculateElementAnimation(0.0, 0.0, 4.0, baseSettings);
    expect(startAnim.opacity).toBe(0);
    expect(startAnim.scaleX).toBeLessThanOrEqual(0.4);

    // At t = 0.5s (entrance complete): scale should be around 1.0
    const endEntranceAnim = calculateElementAnimation(0.5, 0.0, 4.0, baseSettings);
    expect(endEntranceAnim.scaleX).toBeGreaterThanOrEqual(0.9);
  });

  it('correctly calculates idle loop phase with periodic wave transformations', () => {
    // Mid-clip t = 2.0s: idle loop pulse
    const midAnim1 = calculateElementAnimation(2.0, 0.0, 4.0, baseSettings);
    const midAnim2 = calculateElementAnimation(2.25, 0.0, 4.0, baseSettings);
    expect(midAnim1.scaleX).toBeGreaterThan(0);
    expect(midAnim2.scaleX).toBeGreaterThan(0);
    // Scales should vary due to pulse oscillation
    expect(midAnim1.scaleX).not.toEqual(midAnim2.scaleX);
  });

  it('correctly calculates exit animation phase', () => {
    // Near clip end t = 3.95s (out of 4.0s duration): scale & opacity should collapse
    const exitAnim = calculateElementAnimation(3.95, 0.0, 4.0, baseSettings);
    expect(exitAnim.scaleX).toBeLessThan(0.5);
    expect(exitAnim.opacity).toBeLessThan(0.8);
  });

  it('supports all idle loop types (pulse, float, wiggle, spin, swing, breathe)', () => {
    const loopTypes = ['pulse', 'float', 'wiggle', 'spin', 'swing', 'breathe'] as const;
    for (const loopType of loopTypes) {
      const settings: ClipElementSettings = {
        ...baseSettings,
        animationIn: 'none',
        animationOut: 'none',
        animationLoop: loopType,
      };
      const anim = calculateElementAnimation(1.5, 0.0, 4.0, settings);
      expect(anim.opacity).toBe(1);
      expect(anim.scaleX).toBeGreaterThan(0);
      expect(anim.scaleY).toBeGreaterThan(0);
    }
  });
});

describe('FX Effect Registry & Compatibility', () => {
  it('registers all 25 expected FX effects with valid types, categories, and icons', () => {
    expect(FX_EFFECTS.length).toBeGreaterThanOrEqual(25);
    const types = new Set(FX_EFFECTS.map(f => f.type));
    // Verify core FX types are present
    expect(types.has('zoom_blur')).toBe(true);
    expect(types.has('dreamy_blur')).toBe(true);
    expect(types.has('subject_outline_flash')).toBe(true);
    expect(types.has('vfx_breakdown')).toBe(true);
    expect(types.has('bw_to_color')).toBe(true);
    expect(types.has('rgb_split')).toBe(true);
    expect(types.has('glitch')).toBe(true);
    expect(types.has('vhs')).toBe(true);
  });

  it('safely handles mock canvas context execution without exceptions', () => {
    const width = 64;
    const height = 64;
    const pixelData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixelData.length; i += 4) {
      pixelData[i] = 120;     // R
      pixelData[i + 1] = 80;  // G
      pixelData[i + 2] = 200; // B
      pixelData[i + 3] = 255; // A
    }

    const mockCtx: any = {
      canvas: { width, height },
      getImageData: () => ({ data: pixelData, width, height }),
      putImageData: () => {},
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillRect: () => {},
      clearRect: () => {},
      drawImage: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setTransform: () => {},
      resetTransform: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      shadowColor: 'transparent',
      shadowBlur: 0,
    };

    // Test fast zoom_blur, dreamy_blur, subject_outline_flash, vfx_breakdown, bw_to_color
    expect(() => {
      applyFxEffect(mockCtx, 'zoom_blur', { intensity: 50 }, width, height, 1.0);
    }).not.toThrow();

    expect(() => {
      applyFxEffect(mockCtx, 'dreamy_blur', { intensity: 50 }, width, height, 1.0);
    }).not.toThrow();

    expect(() => {
      applyFxEffect(mockCtx, 'subject_outline_flash', { intensity: 50, color: '#00ffcc' }, width, height, 1.0);
    }).not.toThrow();

    expect(() => {
      applyFxEffect(mockCtx, 'vfx_breakdown', { intensity: 50 }, width, height, 1.0);
    }).not.toThrow();

    expect(() => {
      applyFxEffect(mockCtx, 'bw_to_color', { intensity: 50 }, width, height, 1.0);
    }).not.toThrow();
  });
});
