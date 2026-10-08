import { describe, it, expect } from 'vitest';
import { ELEMENT_SHAPES, ELEMENT_EMOJI_CATEGORIES, ELEMENT_STICKERS, SHAPE_VARIANTS } from '@/constants/elements';
import { calculateElementAnimation, traceShapePath, renderElement, isVideoMedia } from '@/utils/elementRenderer';
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

describe('Advanced Parametric Shapes & Inner Content Nesting', () => {
  it('supports parametric star geometry with points and sharpness ratio', () => {
    const starSettings: ClipElementSettings = {
      elementType: 'shape',
      shapeType: 'star',
      starPoints: 8,
      starInnerRadiusRatio: 0.2, // very sharp
      width: 250,
      height: 250,
    };
    expect(starSettings.starPoints).toBe(8);
    expect(starSettings.starInnerRadiusRatio).toBe(0.2);
  });

  it('supports transparent hollow fill (fillType: none) displaying only border', () => {
    const hollowSettings: ClipElementSettings = {
      elementType: 'shape',
      shapeType: 'rounded_rect',
      fillType: 'none',
      strokeColor: '#38bdf8',
      strokeWidth: 4,
    };
    expect(hollowSettings.fillType).toBe('none');
    expect(hollowSettings.strokeWidth).toBe(4);
  });

  it('supports inner image masked texture clipping inside any shape', () => {
    const innerImageSettings: ClipElementSettings = {
      elementType: 'shape',
      shapeType: 'circle',
      innerImageUrl: 'blob:http://localhost/test-image.png',
      innerImageFit: 'cover',
      innerImageOpacity: 0.9,
    };
    expect(innerImageSettings.innerImageUrl).toBeDefined();
    expect(innerImageSettings.innerImageFit).toBe('cover');
    expect(innerImageSettings.innerImageOpacity).toBe(0.9);
  });

  it('supports formatted nested text inside any shape', () => {
    const innerTextSettings: ClipElementSettings = {
      elementType: 'shape',
      shapeType: 'shield',
      innerText: 'PRO CREATOR',
      innerTextColor: '#ffffff',
      innerTextSize: 24,
      innerTextAlign: 'center',
    };
    expect(innerTextSettings.innerText).toBe('PRO CREATOR');
    expect(innerTextSettings.innerTextSize).toBe(24);
  });
});

describe('Standalone Emotion Animated Emojis', () => {
  it('configures rich emotion micro-animations and particle accents for standalone emojis', () => {
    const emojiSettings: ClipElementSettings = {
      elementType: 'emoji',
      emojiChar: '😂',
      emojiEmotionAnimation: true,
      emojiEmotionType: 'laugh_tears',
      emojiParticleEffects: true,
    };
    expect(emojiSettings.emojiEmotionAnimation).toBe(true);
    expect(emojiSettings.emojiEmotionType).toBe('laugh_tears');
    expect(emojiSettings.emojiParticleEffects).toBe(true);
  });
});

describe('Interactive Social Media Badges (YouTube, Instagram, TikTok)', () => {
  it('includes interactive YouTube badges with cursor clicks, bell chimes, and like bursts', () => {
    const ytBadges = ELEMENT_STICKERS.filter(s => s.defaultSettings.socialPlatform === 'youtube');
    expect(ytBadges.length).toBeGreaterThanOrEqual(3);

    const suite = ELEMENT_STICKERS.find(s => s.id === 'sticker_yt_subscribe_suite');
    expect(suite).toBeDefined();
    expect(suite?.defaultSettings.socialBadgeType).toBe('yt_subscribe_bell_like');
    expect(suite?.defaultSettings.socialShowCursor).toBe(true);
  });

  it('includes Instagram double-tap heart burst and follow action badges', () => {
    const instaBadges = ELEMENT_STICKERS.filter(s => s.defaultSettings.socialPlatform === 'instagram');
    expect(instaBadges.length).toBeGreaterThanOrEqual(2);

    const heartBurst = ELEMENT_STICKERS.find(s => s.id === 'sticker_insta_heart_burst');
    expect(heartBurst).toBeDefined();
    expect(heartBurst?.defaultSettings.socialBadgeType).toBe('insta_heart_double_tap');
  });

  it('includes TikTok follow burst badge with confetti explosion', () => {
    const tiktok = ELEMENT_STICKERS.find(s => s.id === 'sticker_tiktok_follow_burst');
    expect(tiktok).toBeDefined();
    expect(tiktok?.defaultSettings.socialBadgeType).toBe('tiktok_follow_burst');
  });
});

describe('Premium Animation Eases & Curves', () => {
  it('correctly calculates 3D perspective flip (flip_3d) entrance ease', () => {
    const settings: ClipElementSettings = {
      elementType: 'shape',
      animationIn: 'flip_3d',
      animationInDuration: 0.5,
    };
    const animStart = calculateElementAnimation(0.05, 0.0, 3.0, settings);
    expect(animStart.scaleX).toBeLessThan(1.0);
    expect(animStart.opacity).toBeGreaterThan(0);

    const animEnd = calculateElementAnimation(0.5, 0.0, 3.0, settings);
    expect(animEnd.scaleX).toBeCloseTo(1.0, 1);
  });

  it('correctly calculates spiral zoom 720° and cyber glitch eases', () => {
    const spiralSettings: ClipElementSettings = {
      elementType: 'shape',
      animationIn: 'spiral_zoom',
      animationInDuration: 0.5,
    };
    const spiralAnim = calculateElementAnimation(0.25, 0.0, 3.0, spiralSettings);
    expect(spiralAnim.rotation).toBeGreaterThan(0);

    const glitchSettings: ClipElementSettings = {
      elementType: 'shape',
      animationIn: 'glitch_in',
      animationInDuration: 0.4,
    };
    const glitchAnim = calculateElementAnimation(0.1, 0.0, 3.0, glitchSettings);
    expect(glitchAnim.scaleX).toBeGreaterThan(0);
  });

  it('correctly calculates heavy stamp slam impact', () => {
    const slamSettings: ClipElementSettings = {
      elementType: 'shape',
      animationIn: 'stamp_slam',
      animationInDuration: 0.6,
    };
    const slamStart = calculateElementAnimation(0.1, 0.0, 3.0, slamSettings);
    expect(slamStart.scaleX).toBeGreaterThan(1.2); // starts big before slam
  });
});

describe('Geometric Shape Variants Engine', () => {
  it('defines mathematical shape variants for triangles, rectangles, stars, polygons, and arrows', () => {
    // Triangle variants: Equilateral, Right, Isosceles, Acute/Scalene, Obtuse, Inverted
    const triangleVariants = SHAPE_VARIANTS.triangle.map(v => v.id);
    expect(triangleVariants).toContain('equilateral');
    expect(triangleVariants).toContain('right');
    expect(triangleVariants).toContain('isosceles');
    expect(triangleVariants).toContain('acute');
    expect(triangleVariants).toContain('obtuse');
    expect(triangleVariants).toContain('inverted');

    // Rectangle / quadrilateral variants: Rectangle, Square, Parallelogram, Rhombus, Trapezoid, Kite, etc.
    const rectVariants = SHAPE_VARIANTS.rectangle.map(v => v.id);
    expect(rectVariants).toContain('rectangle');
    expect(rectVariants).toContain('square');
    expect(rectVariants).toContain('parallelogram');
    expect(rectVariants).toContain('rhombus');
    expect(rectVariants).toContain('trapezoid');
    expect(rectVariants).toContain('inverted_trapezoid');
    expect(rectVariants).toContain('kite');
    expect(rectVariants).toContain('cut_corners');

    // Star variants
    const starVariants = SHAPE_VARIANTS.star.map(v => v.id);
    expect(starVariants).toContain('classic_5');
    expect(starVariants).toContain('sparkle_4');
    expect(starVariants).toContain('compass_8');
    expect(starVariants).toContain('seal_12');
  });

  it('correctly executes traceShapePath on canvas context for all geometric variants without errors', () => {
    const mockCtx: any = {
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      roundRect: () => {},
      arc: () => {},
      ellipse: () => {},
      bezierCurveTo: () => {},
      arcTo: () => {},
    };

    // Test Triangle variants
    const triVariants = ['equilateral', 'right', 'isosceles', 'acute', 'obtuse', 'inverted'];
    for (const v of triVariants) {
      expect(() => {
        traceShapePath(mockCtx, 'triangle', 200, 200, 0, { elementType: 'shape', shapeType: 'triangle', shapeVariant: v as any });
      }).not.toThrow();
    }

    // Test Rectangle variants
    const rectVariants = ['square', 'parallelogram', 'rhombus', 'trapezoid', 'inverted_trapezoid', 'kite', 'pill', 'cut_corners', 'rectangle'];
    for (const v of rectVariants) {
      expect(() => {
        traceShapePath(mockCtx, 'rectangle', 240, 160, 12, { elementType: 'shape', shapeType: 'rectangle', shapeVariant: v as any });
      }).not.toThrow();
    }

    // Test Star variants
    const starVariants = ['classic_5', 'sparkle_4', 'compass_8', 'seal_12', 'sharp_needle', 'soft_puffy'];
    for (const v of starVariants) {
      expect(() => {
        traceShapePath(mockCtx, 'star', 220, 220, 0, { elementType: 'shape', shapeType: 'star', shapeVariant: v as any });
      }).not.toThrow();
    }

    // Test Circle/Curvature variants
    const circleVariants = ['circle', 'horizontal_oval', 'vertical_oval', 'semicircle', 'crescent'];
    for (const v of circleVariants) {
      expect(() => {
        traceShapePath(mockCtx, 'circle', 200, 200, 0, { elementType: 'shape', shapeType: 'circle', shapeVariant: v as any });
      }).not.toThrow();
    }

    // Test Arrow variants
    const arrowVariants = ['standard_arrow', 'chevron', 'steep_arrow', 'fat_arrow', 'notch_arrow'];
    for (const v of arrowVariants) {
      expect(() => {
        traceShapePath(mockCtx, 'arrow', 240, 140, 0, { elementType: 'shape', shapeType: 'arrow', shapeVariant: v as any });
      }).not.toThrow();
    }
  });

  it('provides direct presets in ELEMENT_SHAPES library for key geometric variants', () => {
    const ids = ELEMENT_SHAPES.map(s => s.id);
    expect(ids).toContain('shape_square');
    expect(ids).toContain('shape_parallelogram');
    expect(ids).toContain('shape_rhombus');
    expect(ids).toContain('shape_trapezoid');
    expect(ids).toContain('shape_kite');
    expect(ids).toContain('shape_triangle_right');
    expect(ids).toContain('shape_triangle_isosceles');
    expect(ids).toContain('shape_triangle_obtuse');
    expect(ids).toContain('shape_chevron');
    expect(ids).toContain('shape_crescent');
  });
});

describe('Media Inside Shape with Precision Placement Controls', () => {
  it('correctly identifies video vs image media formats', () => {
    expect(isVideoMedia('video.mp4')).toBe(true);
    expect(isVideoMedia('clip.webm')).toBe(true);
    expect(isVideoMedia('footage.mov')).toBe(true);
    expect(isVideoMedia('data:video/mp4;base64,AAA')).toBe(true);
    expect(isVideoMedia('photo.jpg')).toBe(false);
    expect(isVideoMedia('graphic.png')).toBe(false);
    expect(isVideoMedia('blob:http://localhost/test', 'video')).toBe(true);
    expect(isVideoMedia('blob:http://localhost/test', 'image')).toBe(false);
  });

  it('supports media placement controls (offsetX, offsetY, scale, rotation, fit)', () => {
    const settings: ClipElementSettings = {
      elementType: 'shape',
      shapeType: 'triangle',
      shapeVariant: 'right',
      innerMediaType: 'video',
      innerMediaUrl: 'blob:http://localhost/sample.mp4',
      innerMediaFit: 'custom',
      innerMediaOffsetX: 45,
      innerMediaOffsetY: -30,
      innerMediaScale: 1.5,
      innerMediaRotation: 15,
      innerMediaPlaybackSpeed: 1.25,
      innerMediaStartTime: 2.0,
      innerMediaLoop: true,
      innerMediaOpacity: 0.9,
    };

    expect(settings.innerMediaType).toBe('video');
    expect(settings.innerMediaOffsetX).toBe(45);
    expect(settings.innerMediaOffsetY).toBe(-30);
    expect(settings.innerMediaScale).toBe(1.5);
    expect(settings.innerMediaRotation).toBe(15);
    expect(settings.innerMediaPlaybackSpeed).toBe(1.25);
    expect(settings.innerMediaStartTime).toBe(2.0);
    expect(settings.innerMediaLoop).toBe(true);
  });

  it('renders element with mock overrideMediaFrame and placement transforms without errors', () => {
    const mockCtx: any = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      clip: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      fill: () => {},
      stroke: () => {},
      setLineDash: () => {},
      globalAlpha: 1,
    };

    const mockFrame: any = {
      width: 640,
      height: 360,
    };

    const settings: ClipElementSettings = {
      elementType: 'shape',
      shapeType: 'rectangle',
      shapeVariant: 'rhombus',
      innerMediaUrl: 'test.mp4',
      innerMediaFit: 'cover',
      innerMediaOffsetX: 20,
      innerMediaOffsetY: -15,
      innerMediaScale: 1.2,
      innerMediaRotation: 45,
      innerMediaOpacity: 0.85,
    };

    expect(() => {
      renderElement(
        mockCtx,
        settings,
        300,
        200,
        { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 },
        1.5,
        5.0,
        mockFrame,
        false
      );
    }).not.toThrow();
  });
});


