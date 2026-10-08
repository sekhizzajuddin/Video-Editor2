// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Element Canvas2D Renderer & Professional Animation Engine
// ─────────────────────────────────────────────────────────────────────────────

import { ClipElementSettings, ElementShapeType, EmojiEmotionType } from '@/types';

export interface ElementTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  rotation: number; // In degrees
  opacity: number;
}

// Global in-memory image cache for shape inner pictures and badge avatars
const imageCache = new Map<string, HTMLImageElement>();

function getLoadedImage(url?: string): HTMLImageElement | null {
  if (!url) return null;
  let img = imageCache.get(url);
  if (!img) {
    if (typeof Image !== 'undefined') {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      imageCache.set(url, img);
    }
  }
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * Calculates current animation transform based on clip playback time,
 * entrance (In), idle loop, and exit (Out) animation states.
 */
export function calculateElementAnimation(
  currentTime: number,
  clipStartTime: number,
  clipDuration: number,
  settings: ClipElementSettings
): ElementTransform {
  const relTime = Math.max(0, currentTime - clipStartTime);
  const timeLeft = Math.max(0, (clipStartTime + clipDuration) - currentTime);

  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let opacity = 1;

  const inDuration = Math.max(0.05, settings.animationInDuration ?? 0.45);
  const outDuration = Math.max(0.05, settings.animationOutDuration ?? 0.35);

  // ── Entrance (In) Animation ──
  if (relTime < inDuration && settings.animationIn && settings.animationIn !== 'none') {
    const p = Math.min(1, relTime / inDuration);
    switch (settings.animationIn) {
      case 'pop': {
        const spring = 1 + Math.sin(p * Math.PI * 2.2) * 0.28 * (1 - p);
        scaleX *= p * spring;
        scaleY *= p * spring;
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'bounce_spring': {
        const decay = Math.cos(p * Math.PI * 3.5) * Math.exp(-p * 3.5) * 0.35;
        const s = Math.max(0, p + decay);
        scaleX *= s;
        scaleY *= s;
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'fade_zoom': {
        scaleX *= 0.4 + 0.6 * p;
        scaleY *= 0.4 + 0.6 * p;
        opacity *= p;
        break;
      }
      case 'slide_up': {
        const ease = 1 - Math.pow(1 - p, 3);
        offsetY += (1 - ease) * 120;
        opacity *= Math.min(1, p * 1.5);
        break;
      }
      case 'slide_down': {
        const ease = 1 - Math.pow(1 - p, 3);
        offsetY -= (1 - ease) * 120;
        opacity *= Math.min(1, p * 1.5);
        break;
      }
      case 'slide_left': {
        const ease = 1 - Math.pow(1 - p, 3);
        offsetX += (1 - ease) * 150;
        opacity *= Math.min(1, p * 1.5);
        break;
      }
      case 'slide_right': {
        const ease = 1 - Math.pow(1 - p, 3);
        offsetX -= (1 - ease) * 150;
        opacity *= Math.min(1, p * 1.5);
        break;
      }
      case 'spin_in': {
        const ease = 1 - Math.pow(1 - p, 3);
        rotation += (1 - ease) * 360;
        scaleX *= ease;
        scaleY *= ease;
        opacity *= ease;
        break;
      }
      case 'elastic': {
        const freq = 12;
        const decay = Math.exp(-p * 5);
        const s = 1 - decay * Math.cos(p * freq);
        scaleX *= s;
        scaleY *= s;
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'flip_3d': {
        const ease = 1 - Math.pow(1 - p, 3);
        scaleX *= Math.max(0.01, Math.abs(Math.cos((1 - ease) * Math.PI * 0.5)));
        offsetY -= (1 - ease) * 35;
        opacity *= Math.min(1, p * 2.2);
        break;
      }
      case 'elastic_snap': {
        const c4 = (2 * Math.PI) / 3;
        const s = p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
        scaleX *= s;
        scaleY *= s;
        opacity *= Math.min(1, p * 2.5);
        break;
      }
      case 'glitch_in': {
        const ease = Math.min(1, p * 1.2);
        const jitter = (1 - ease) * 20;
        offsetX += (Math.sin(p * 45) > 0 ? 1 : -1) * jitter;
        offsetY += (Math.cos(p * 30) > 0 ? 1 : -1) * (jitter * 0.6);
        scaleX *= 0.6 + 0.4 * ease;
        scaleY *= 0.6 + 0.4 * ease;
        opacity *= p > 0.08 ? 1 : p * 12;
        break;
      }
      case 'spiral_zoom': {
        const ease = 1 - Math.pow(1 - p, 3);
        scaleX *= ease;
        scaleY *= ease;
        rotation += (1 - ease) * 720;
        opacity *= Math.min(1, p * 1.5);
        break;
      }
      case 'origami_unfold': {
        const ease = 1 - Math.pow(1 - p, 3);
        scaleY *= Math.max(0.02, ease);
        scaleX *= 0.5 + 0.5 * ease;
        offsetY += (1 - ease) * 60;
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'blur_fade_in': {
        const ease = 1 - Math.pow(1 - p, 2);
        scaleX *= 0.82 + 0.18 * ease;
        scaleY *= 0.82 + 0.18 * ease;
        opacity *= ease;
        break;
      }
      case 'light_beam': {
        const ease = 1 - Math.pow(1 - p, 4);
        scaleX *= Math.max(0.05, ease);
        scaleY *= 1.4 - 0.4 * ease;
        offsetY -= (1 - ease) * 130;
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'bounce_squash': {
        const s = 1 + Math.sin(p * Math.PI * 3) * Math.exp(-p * 4) * 0.45;
        scaleX *= s;
        scaleY *= 1 / Math.max(0.2, s);
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'stamp_slam': {
        if (p < 0.65) {
          const sp = p / 0.65;
          const s = 2.4 - 1.4 * Math.pow(sp, 3);
          scaleX *= s;
          scaleY *= s;
          opacity *= Math.min(1, sp * 2);
        } else {
          const sp = (p - 0.65) / 0.35;
          const shake = Math.sin(sp * Math.PI * 6) * Math.exp(-sp * 5) * 8;
          offsetY += shake;
        }
        break;
      }
    }
  }

  // ── Exit (Out) Animation ──
  if (timeLeft < outDuration && settings.animationOut && settings.animationOut !== 'none') {
    const p = Math.min(1, (outDuration - timeLeft) / outDuration); // 0 -> 1
    switch (settings.animationOut) {
      case 'fade_out': {
        opacity *= (1 - p);
        break;
      }
      case 'pop_out': {
        const s = Math.max(0, 1 - Math.pow(p, 2) * 1.1);
        scaleX *= s;
        scaleY *= s;
        opacity *= (1 - p);
        break;
      }
      case 'slide_up': {
        offsetY -= Math.pow(p, 2) * 140;
        opacity *= (1 - p);
        break;
      }
      case 'slide_down': {
        offsetY += Math.pow(p, 2) * 140;
        opacity *= (1 - p);
        break;
      }
      case 'slide_left': {
        offsetX -= Math.pow(p, 2) * 160;
        opacity *= (1 - p);
        break;
      }
      case 'slide_right': {
        offsetX += Math.pow(p, 2) * 160;
        opacity *= (1 - p);
        break;
      }
      case 'spin_out': {
        rotation += p * 360;
        const s = Math.max(0, 1 - p);
        scaleX *= s;
        scaleY *= s;
        opacity *= (1 - p);
        break;
      }
      case 'shrink': {
        const s = Math.max(0, 1 - p);
        scaleX *= s;
        scaleY *= s;
        opacity *= (1 - p);
        break;
      }
      case 'flip_3d_out': {
        scaleX *= Math.max(0.01, Math.abs(Math.cos(p * Math.PI * 0.5)));
        opacity *= (1 - p);
        break;
      }
      case 'spiral_zoom_out': {
        const s = Math.max(0, 1 - p);
        scaleX *= s;
        scaleY *= s;
        rotation -= p * 720;
        opacity *= (1 - p);
        break;
      }
      case 'origami_fold': {
        scaleY *= Math.max(0.01, 1 - p);
        scaleX *= 1 - 0.4 * p;
        offsetY += p * 60;
        opacity *= (1 - p);
        break;
      }
      case 'glitch_out': {
        const jitter = p * 22;
        offsetX += (Math.sin(p * 40) > 0 ? 1 : -1) * jitter;
        opacity *= (1 - p);
        break;
      }
      case 'blur_fade_out': {
        scaleX *= 1 + 0.15 * p;
        scaleY *= 1 + 0.15 * p;
        opacity *= (1 - p);
        break;
      }
      case 'disintegrate': {
        scaleX *= 1 + 0.3 * p;
        scaleY *= 1 + 0.3 * p;
        offsetY -= p * 50;
        opacity *= Math.max(0, 1 - Math.pow(p, 2));
        break;
      }
    }
  }

  // ── Idle / Continuous Loop Animation ──
  if (settings.animationLoop && settings.animationLoop !== 'none') {
    const speed = settings.animationLoopSpeed ?? 1;
    const intensity = (settings.animationLoopIntensity ?? 50) / 100;

    switch (settings.animationLoop) {
      case 'pulse': {
        const wave = Math.sin(relTime * Math.PI * 2 * 1.5 * speed);
        const bump = 1 + wave * 0.12 * intensity;
        scaleX *= bump;
        scaleY *= bump;
        break;
      }
      case 'heartbeat': {
        const t = (relTime * speed * 1.6) % 1;
        let bump = 0;
        if (t < 0.15) bump = Math.sin((t / 0.15) * Math.PI) * 0.18;
        else if (t > 0.25 && t < 0.4) bump = Math.sin(((t - 0.25) / 0.15) * Math.PI) * 0.12;
        scaleX *= 1 + bump * intensity;
        scaleY *= 1 + bump * intensity;
        break;
      }
      case 'float': {
        offsetY += Math.sin(relTime * Math.PI * 2 * 0.8 * speed) * 14 * intensity;
        break;
      }
      case 'wiggle': {
        rotation += Math.sin(relTime * Math.PI * 2 * 3.5 * speed) * 9 * intensity;
        break;
      }
      case 'spin_slow': {
        rotation += ((relTime * 45 * speed) % 360);
        break;
      }
      case 'swing': {
        rotation += Math.sin(relTime * Math.PI * 2 * 1.2 * speed) * 14 * intensity;
        break;
      }
      case 'breathe': {
        const wave = Math.sin(relTime * Math.PI * 2 * 0.5 * speed);
        const s = 1 + wave * 0.08 * intensity;
        scaleX *= s;
        scaleY *= s;
        break;
      }
      case 'glitch_jitter': {
        const t = Math.floor(relTime * 15 * speed);
        if (t % 5 === 0) {
          offsetX += ((t % 3) - 1) * 6 * intensity;
          offsetY += (((t + 1) % 3) - 1) * 4 * intensity;
        }
        break;
      }
      case 'neon_flicker': {
        const flick = (Math.sin(relTime * 35 * speed) + Math.cos(relTime * 17 * speed)) * 0.5;
        if (flick > 0.82) opacity *= 0.35;
        break;
      }
      case 'orbit': {
        const a = relTime * Math.PI * 2 * 0.6 * speed;
        offsetX += Math.cos(a) * 16 * intensity;
        offsetY += Math.sin(a) * 10 * intensity;
        break;
      }
      case 'rubber_band': {
        const t = (relTime * speed * 2) % 2;
        if (t < 0.5) {
          const sp = t / 0.5;
          scaleX *= 1 + Math.sin(sp * Math.PI) * 0.22 * intensity;
          scaleY *= 1 - Math.sin(sp * Math.PI) * 0.18 * intensity;
        }
        break;
      }
    }
  }

  return { scaleX, scaleY, offsetX, offsetY, rotation, opacity: Math.max(0, Math.min(1, opacity)) };
}

/**
 * Traces a closed vector path on Canvas2D centered at (0, 0).
 * Supports parametric star points & sharpness, polygon sides, cut-corners, and arrow heads.
 */
export function traceShapePath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shapeType: ElementShapeType,
  w: number,
  h: number,
  cornerRadius: number = 0,
  settings?: ClipElementSettings
) {
  const hw = w / 2;
  const hh = h / 2;
  const variant = settings?.shapeVariant;
  ctx.beginPath();

  switch (shapeType) {
    case 'rectangle':
    case 'rounded_rect': {
      if (variant === 'square') {
        const s = Math.min(w, h);
        const hs = s / 2;
        const r = Math.min(cornerRadius, hs);
        if (r > 0 && typeof ctx.roundRect === 'function') {
          ctx.roundRect(-hs, -hs, s, s, r);
        } else {
          ctx.rect(-hs, -hs, s, s);
        }
      } else if (variant === 'parallelogram') {
        const skew = hw * 0.35;
        ctx.moveTo(-hw + skew, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(hw - skew, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      } else if (variant === 'rhombus' || variant === 'diamond') {
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(0, hh);
        ctx.lineTo(-hw, 0);
        ctx.closePath();
      } else if (variant === 'trapezoid') {
        const topW = hw * 0.55;
        ctx.moveTo(-topW, -hh);
        ctx.lineTo(topW, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      } else if (variant === 'inverted_trapezoid') {
        const botW = hw * 0.55;
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(botW, hh);
        ctx.lineTo(-botW, hh);
        ctx.closePath();
      } else if (variant === 'kite') {
        const shoulderY = -hh * 0.25;
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, shoulderY);
        ctx.lineTo(0, hh);
        ctx.lineTo(-hw, shoulderY);
        ctx.closePath();
      } else if (variant === 'pill') {
        const r = Math.min(hw, hh);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-hw, -hh, w, h, r);
        } else {
          ctx.rect(-hw, -hh, w, h);
        }
      } else if (variant === 'cut_corners') {
        const c = Math.min(cornerRadius || 22, hw * 0.4, hh * 0.4);
        ctx.moveTo(-hw + c, -hh);
        ctx.lineTo(hw - c, -hh);
        ctx.lineTo(hw, -hh + c);
        ctx.lineTo(hw, hh - c);
        ctx.lineTo(hw - c, hh);
        ctx.lineTo(-hw + c, hh);
        ctx.lineTo(-hw, hh - c);
        ctx.lineTo(-hw, -hh + c);
        ctx.closePath();
      } else {
        const r = shapeType === 'rounded_rect' ? Math.min(cornerRadius, hw, hh) : 0;
        if (r <= 0) {
          ctx.rect(-hw, -hh, w, h);
        } else if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-hw, -hh, w, h, r);
        } else {
          ctx.moveTo(-hw + r, -hh);
          ctx.arcTo(hw, -hh, hw, hh, r);
          ctx.arcTo(hw, hh, -hw, hh, r);
          ctx.arcTo(-hw, hh, -hw, -hh, r);
          ctx.arcTo(-hw, -hh, hw, -hh, r);
          ctx.closePath();
        }
      }
      break;
    }

    case 'triangle': {
      if (variant === 'right' || variant === 'right_triangle') {
        // 90° perpendicular corner at bottom-left (-hw, hh)
        ctx.moveTo(-hw, hh);
        ctx.lineTo(-hw, -hh);
        ctx.lineTo(hw, hh);
        ctx.closePath();
      } else if (variant === 'isosceles') {
        // Tall isosceles triangle with narrow base
        const baseHalf = hw * 0.55;
        ctx.moveTo(0, -hh);
        ctx.lineTo(baseHalf, hh);
        ctx.lineTo(-baseHalf, hh);
        ctx.closePath();
      } else if (variant === 'acute' || variant === 'scalene') {
        // Asymmetric scalene acute triangle
        ctx.moveTo(-hw * 0.25, -hh);
        ctx.lineTo(hw, hh * 0.85);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      } else if (variant === 'obtuse') {
        // Obtuse triangle with wide baseline and shallow skewed peak
        ctx.moveTo(hw * 0.45, -hh * 0.35);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      } else if (variant === 'inverted') {
        // Inverted downward-pointing triangle
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(0, hh);
        ctx.closePath();
      } else {
        // Default: Equilateral-style symmetric triangle
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      }
      break;
    }

    case 'circle':
    case 'ellipse': {
      if (variant === 'horizontal_oval') {
        ctx.ellipse(0, 0, hw, hh * 0.65, 0, 0, Math.PI * 2);
      } else if (variant === 'vertical_oval') {
        ctx.ellipse(0, 0, hw * 0.65, hh, 0, 0, Math.PI * 2);
      } else if (variant === 'semicircle') {
        const r = Math.min(hw, hh);
        ctx.arc(0, hh * 0.3, r, Math.PI, 0, false);
        ctx.closePath();
      } else if (variant === 'crescent') {
        const r = Math.min(hw, hh);
        ctx.arc(0, 0, r, -Math.PI * 0.4, Math.PI * 0.4, false);
        ctx.bezierCurveTo(r * 0.35, r * 0.5, r * 0.35, -r * 0.5, Math.cos(-Math.PI * 0.4) * r, Math.sin(-Math.PI * 0.4) * r);
        ctx.closePath();
      } else if (variant === 'pill') {
        const r = Math.min(hw, hh);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-hw, -hh, w, h, r);
        } else {
          ctx.rect(-hw, -hh, w, h);
        }
      } else if (shapeType === 'circle' || variant === 'circle') {
        const radius = Math.min(hw, hh);
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      }
      break;
    }

    case 'star': {
      let points = Math.max(3, Math.min(24, settings?.starPoints || 5));
      let innerRatio = Math.max(0.1, Math.min(0.85, settings?.starInnerRadiusRatio ?? 0.42));

      if (variant === 'sparkle_4') {
        points = 4;
        innerRatio = 0.18;
      } else if (variant === 'compass_8') {
        points = 8;
        innerRatio = 0.36;
      } else if (variant === 'seal_12') {
        points = 12;
        innerRatio = 0.78;
      } else if (variant === 'sharp_needle') {
        points = 5;
        innerRatio = 0.16;
      } else if (variant === 'soft_puffy') {
        points = 5;
        innerRatio = 0.62;
      }

      const outerR = Math.min(hw, hh);
      const innerR = outerR * innerRatio;
      const step = Math.PI / points;
      let angle = -Math.PI / 2;
      ctx.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      for (let i = 0; i < points; i++) {
        angle += step;
        ctx.lineTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
        angle += step;
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      }
      ctx.closePath();
      break;
    }

    case 'heart': {
      if (variant === 'deep_cleft') {
        const s = Math.min(w / 100, h / 100) * 0.9;
        ctx.moveTo(0, 32 * s);
        ctx.bezierCurveTo(-50 * s, -10 * s, -60 * s, -55 * s, 0, -10 * s);
        ctx.bezierCurveTo(60 * s, -55 * s, 50 * s, -10 * s, 0, 32 * s);
        ctx.closePath();
      } else if (variant === 'round_chubby') {
        const s = Math.min(w / 100, h / 100) * 0.88;
        ctx.moveTo(0, 24 * s);
        ctx.bezierCurveTo(-45 * s, -18 * s, -50 * s, -40 * s, 0, -26 * s);
        ctx.bezierCurveTo(50 * s, -40 * s, 45 * s, -18 * s, 0, 24 * s);
        ctx.closePath();
      } else {
        const s = Math.min(w / 100, h / 100) * 0.9;
        ctx.moveTo(0, 28 * s);
        ctx.bezierCurveTo(-45 * s, -15 * s, -55 * s, -45 * s, 0, -20 * s);
        ctx.bezierCurveTo(55 * s, -45 * s, 45 * s, -15 * s, 0, 28 * s);
        ctx.closePath();
      }
      break;
    }

    case 'hexagon': {
      let sides = Math.max(3, Math.min(16, settings?.polygonSides || 6));
      if (variant === 'pentagon') sides = 5;
      else if (variant === 'octagon') sides = 8;
      else if (variant === 'heptagon') sides = 7;
      else if (variant === 'decagon') sides = 10;
      else if (variant === 'dodecagon') sides = 12;

      const r = Math.min(hw, hh);
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }

    case 'arrow': {
      if (variant === 'chevron') {
        const depth = hw * 0.45;
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw - depth, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - depth, hh);
        ctx.lineTo(-hw, hh);
        ctx.lineTo(-hw + depth, 0);
        ctx.closePath();
      } else if (variant === 'steep_arrow') {
        const shaftH = hh * 0.3;
        const headL = hw * 0.75;
        ctx.moveTo(-hw, -shaftH);
        ctx.lineTo(hw - headL, -shaftH);
        ctx.lineTo(hw - headL, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - headL, hh);
        ctx.lineTo(hw - headL, shaftH);
        ctx.lineTo(-hw, shaftH);
        ctx.closePath();
      } else if (variant === 'fat_arrow') {
        const shaftH = hh * 0.6;
        const headL = hw * 0.45;
        ctx.moveTo(-hw, -shaftH);
        ctx.lineTo(hw - headL, -shaftH);
        ctx.lineTo(hw - headL, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - headL, hh);
        ctx.lineTo(hw - headL, shaftH);
        ctx.lineTo(-hw, shaftH);
        ctx.closePath();
      } else if (variant === 'notch_arrow') {
        const shaftH = hh * 0.4;
        const headL = hw * 0.55;
        const notch = hw * 0.25;
        ctx.moveTo(-hw, -shaftH);
        ctx.lineTo(hw - headL, -shaftH);
        ctx.lineTo(hw - headL, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - headL, hh);
        ctx.lineTo(hw - headL, shaftH);
        ctx.lineTo(-hw, shaftH);
        ctx.lineTo(-hw + notch, 0);
        ctx.closePath();
      } else {
        const shaftH = hh * Math.max(0.2, Math.min(0.8, settings?.arrowTailWidth ? settings.arrowTailWidth / 100 : 0.45));
        const headL = hw * Math.max(0.2, Math.min(0.8, settings?.arrowHeadSize ? settings.arrowHeadSize / 100 : 0.55));
        ctx.moveTo(-hw, -shaftH);
        ctx.lineTo(hw - headL, -shaftH);
        ctx.lineTo(hw - headL, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - headL, hh);
        ctx.lineTo(hw - headL, shaftH);
        ctx.lineTo(-hw, shaftH);
        ctx.closePath();
      }
      break;
    }

    case 'arrow_double': {
      if (variant === 'steep_double') {
        const shaftH = hh * 0.28;
        const headL = hw * 0.55;
        ctx.moveTo(-hw, 0);
        ctx.lineTo(-hw + headL, -hh);
        ctx.lineTo(-hw + headL, -shaftH);
        ctx.lineTo(hw - headL, -shaftH);
        ctx.lineTo(hw - headL, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - headL, hh);
        ctx.lineTo(hw - headL, shaftH);
        ctx.lineTo(-hw + headL, shaftH);
        ctx.lineTo(-hw + headL, hh);
        ctx.closePath();
      } else {
        const shaftH = hh * 0.4;
        const headL = hw * 0.4;
        ctx.moveTo(-hw, 0);
        ctx.lineTo(-hw + headL, -hh);
        ctx.lineTo(-hw + headL, -shaftH);
        ctx.lineTo(hw - headL, -shaftH);
        ctx.lineTo(hw - headL, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - headL, hh);
        ctx.lineTo(hw - headL, shaftH);
        ctx.lineTo(-hw + headL, shaftH);
        ctx.lineTo(-hw + headL, hh);
        ctx.closePath();
      }
      break;
    }

    case 'speech_bubble':
    case 'thought_bubble': {
      if (variant === 'comic_shout') {
        const n = 16;
        const outerR = Math.min(hw, hh);
        const innerR = outerR * 0.68;
        const step = Math.PI / n;
        for (let i = 0; i < n * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = i * step;
          const px = Math.cos(a) * (hw / outerR * r);
          const py = Math.sin(a) * (hh / outerR * r);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else if (shapeType === 'thought_bubble') {
        ctx.ellipse(0, -hh * 0.2, hw * 0.9, hh * 0.65, 0, 0, Math.PI * 2);
        ctx.closePath();
      } else {
        const r = Math.min(cornerRadius || 18, hw * 0.5, hh * 0.5);
        const tailW = hw * 0.35;
        const tailH = hh * 0.35;
        const boxBottom = hh - tailH;
        ctx.moveTo(-hw + r, -hh);
        ctx.lineTo(hw - r, -hh);
        ctx.arcTo(hw, -hh, hw, boxBottom, r);
        ctx.arcTo(hw, boxBottom, -hw, boxBottom, r);
        ctx.lineTo(-hw * 0.1, boxBottom);
        ctx.lineTo(-hw * 0.35, hh);
        ctx.lineTo(-hw * 0.35, boxBottom);
        ctx.lineTo(-hw + r, boxBottom);
        ctx.arcTo(-hw, boxBottom, -hw, -hh, r);
        ctx.arcTo(-hw, -hh, hw, -hh, r);
        ctx.closePath();
      }
      break;
    }

    case 'shield': {
      if (variant === 'round_bottom') {
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(hw, hh * 0.2);
        ctx.bezierCurveTo(hw, hh, -hw, hh, -hw, hh * 0.2);
        ctx.closePath();
      } else if (variant === 'pointed_crest') {
        ctx.moveTo(0, -hh * 0.7);
        ctx.quadraticCurveTo(hw * 0.5, -hh, hw, -hh * 0.85);
        ctx.lineTo(hw, hh * 0.2);
        ctx.bezierCurveTo(hw, hh * 0.7, hw * 0.4, hh * 0.9, 0, hh);
        ctx.bezierCurveTo(-hw * 0.4, hh * 0.9, -hw, hh * 0.7, -hw, hh * 0.2);
        ctx.lineTo(-hw, -hh * 0.85);
        ctx.quadraticCurveTo(-hw * 0.5, -hh, 0, -hh * 0.7);
        ctx.closePath();
      } else if (variant === 'banner_swallowtail') {
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(0, hh * 0.4);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      } else {
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, -hh);
        ctx.bezierCurveTo(hw, hh * 0.3, hw * 0.5, hh * 0.8, 0, hh);
        ctx.bezierCurveTo(-hw * 0.5, hh * 0.8, -hw, hh * 0.3, -hw, -hh);
        ctx.closePath();
      }
      break;
    }

    case 'callout': {
      if (variant === 'pennant') {
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
      } else {
        const indent = hw * 0.2;
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(hw - indent, 0);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.lineTo(-hw + indent, 0);
        ctx.closePath();
      }
      break;
    }

    case 'badge': {
      const outerR = Math.min(hw, hh);
      const innerR = variant === 'seal_16' ? outerR * 0.88 : outerR * 0.82;
      const n = variant === 'seal_16' ? 16 : 14;
      const step = Math.PI / n;
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = i * step;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }

    case 'line': {
      ctx.rect(-hw, -hh * 0.2, w, hh * 0.4);
      break;
    }

    default: {
      ctx.rect(-hw, -hh, w, h);
      break;
    }
  }
}

/**
 * Creates linear gradient on the canvas context aligned with gradientAngle in degrees.
 */
function createLinearGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  startColor: string,
  endColor: string,
  angleDeg: number = 135
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const len = Math.max(w, h) / 2;
  const x0 = -Math.cos(rad) * len;
  const y0 = -Math.sin(rad) * len;
  const x1 = Math.cos(rad) * len;
  const y1 = Math.sin(rad) * len;
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, startColor);
  grad.addColorStop(1, endColor);
  return grad;
}

/**
 * Draws sleek OS mouse cursor pointer with click ripple.
 */
function drawCursorPointer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  isClicked: boolean,
  clickAge: number = 0
) {
  ctx.save();
  ctx.translate(x, y);

  if (isClicked) {
    ctx.scale(0.88, 0.88);
  }

  // Click ripple wave
  if (clickAge >= 0 && clickAge < 0.45) {
    const rProgress = clickAge / 0.45;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 8 + rProgress * 24, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, (1 - rProgress) * 0.8)})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Pointer Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Modern sleek cursor
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 19);
  ctx.lineTo(5, 15);
  ctx.lineTo(10, 24);
  ctx.lineTo(13.5, 22);
  ctx.lineTo(8.5, 13.5);
  ctx.lineTo(15.5, 13.5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders standalone emoji with rich emotion micro-animations (tears, laugh bubbles, heart eyes, flame flickers).
 */
function renderAnimatedEmoji(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  settings: ClipElementSettings,
  w: number,
  h: number,
  relTime: number
) {
  const emoji = settings.emojiChar || '🔥';
  let emotion: EmojiEmotionType = settings.emojiEmotionType || 'auto';

  // Auto-detect emotion if set to auto
  if (emotion === 'auto') {
    if (emoji === '😂' || emoji === '🤣') emotion = 'laugh_tears';
    else if (emoji === '😍' || emoji === '🥰' || emoji === '😘') emotion = 'heart_eyes';
    else if (emoji === '🔥') emotion = 'fire_flames';
    else if (emoji === '🤯') emotion = 'mind_blown';
    else if (emoji === '💀' || emoji === '☠️') emotion = 'skull_ghost';
    else if (emoji === '🚀') emotion = 'rocket_launch';
    else if (emoji === '😱' || emoji === '😨') emotion = 'screaming_shock';
    else if (emoji === '💯') emotion = 'hundred_stamp';
    else if (emoji === '🥺') emotion = 'puppy_eyes';
    else if (emoji === '🎉' || emoji === '🥳') emotion = 'party_blower';
    else if (emoji === '👑' || emoji === '✨') emotion = 'crown_glint';
    else emotion = 'heart_eyes'; // generic fallback
  }

  const baseSize = Math.min(w, h) * 0.72;

  ctx.save();

  // Emotion-specific transforms and particle accents
  switch (emotion) {
    case 'laugh_tears': {
      // Rocking laugh vibration
      const rock = Math.sin(relTime * 16) * 0.1;
      const bob = 1 + Math.abs(Math.sin(relTime * 12)) * 0.12;
      ctx.rotate(rock);
      ctx.scale(bob, 1 / bob);

      // Draw base emoji
      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      // Squirting Blue Tears
      if (settings.emojiParticleEffects !== false) {
        ctx.save();
        for (let i = 0; i < 4; i++) {
          const t = ((relTime * 2.2 + i * 0.25) % 1);
          const tearAlpha = Math.max(0, 1 - t);
          // Left tear stream
          const lx = -baseSize * 0.35 - t * 45;
          const ly = -baseSize * 0.1 + Math.pow(t, 1.8) * 60;
          ctx.beginPath();
          ctx.arc(lx, ly, 4 + (1 - t) * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${tearAlpha})`;
          ctx.fill();

          // Right tear stream
          const rx = baseSize * 0.35 + t * 45;
          const ry = -baseSize * 0.1 + Math.pow(t, 1.8) * 60;
          ctx.beginPath();
          ctx.arc(rx, ry, 4 + (1 - t) * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${tearAlpha})`;
          ctx.fill();
        }

        // Floating "Haha!" comic text bubbles
        for (let j = 0; j < 2; j++) {
          const ht = ((relTime * 1.4 + j * 0.5) % 1);
          const haAlpha = Math.max(0, 1 - ht);
          const hx = (j === 0 ? -1 : 1) * (baseSize * 0.45 + ht * 25);
          const hy = -baseSize * 0.4 - ht * 55;
          ctx.font = 'bold 16px "Comic Sans MS", "Balsamiq Sans", cursive, sans-serif';
          ctx.fillStyle = `rgba(250, 204, 21, ${haAlpha})`;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.fillText('Haha!', hx, hy);
        }
        ctx.restore();
      }
      break;
    }

    case 'heart_eyes': {
      // Heartbeat pulse zoom
      const beat = Math.sin(relTime * 6.5);
      const s = 1 + (beat > 0 ? beat * 0.14 : 0);
      ctx.scale(s, s);

      // Base emoji
      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      // Floating hearts
      if (settings.emojiParticleEffects !== false) {
        ctx.save();
        for (let i = 0; i < 4; i++) {
          const ht = ((relTime * 1.5 + i * 0.25) % 1);
          const hAlpha = Math.max(0, 1 - ht);
          const hx = (Math.sin(relTime * 3 + i) * 20) + (i % 2 === 0 ? -baseSize * 0.4 : baseSize * 0.4);
          const hy = baseSize * 0.2 - ht * (baseSize * 1.1);
          const hSize = 14 + (1 - ht) * 8;
          ctx.font = `${Math.round(hSize)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          ctx.globalAlpha *= hAlpha;
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 10;
          ctx.fillText('❤️', hx, hy);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
      break;
    }

    case 'fire_flames': {
      // Dynamic flicker and stretch
      const flick = 1 + Math.sin(relTime * 24) * 0.08 + Math.cos(relTime * 36) * 0.05;
      const sway = Math.sin(relTime * 12) * 0.05;
      ctx.rotate(sway);
      ctx.scale(1, flick);

      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      // Rising fiery sparks / embers
      if (settings.emojiParticleEffects !== false) {
        ctx.save();
        for (let i = 0; i < 6; i++) {
          const pt = ((relTime * 2.5 + i * 0.16) % 1);
          const pAlpha = Math.max(0, 1 - pt);
          const px = Math.sin(relTime * 8 + i * 2) * 25 + ((i % 3) - 1) * 15;
          const py = -baseSize * 0.1 - pt * (baseSize * 0.9);
          ctx.beginPath();
          ctx.arc(px, py, 2.5 + (1 - pt) * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? `rgba(251, 146, 60, ${pAlpha})` : `rgba(239, 68, 68, ${pAlpha})`;
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 8;
          ctx.fill();
        }
        ctx.restore();
      }
      break;
    }

    case 'mind_blown': {
      // Shaking tremor before expanding puff
      const cycle = (relTime * 1.2) % 2;
      let tremor = 0;
      if (cycle < 0.6) {
        tremor = Math.sin(relTime * 45) * 3;
      }
      ctx.translate(tremor, 0);

      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      // Expanding smoke ring / explosion blast
      if (settings.emojiParticleEffects !== false && cycle >= 0.6) {
        const blastT = (cycle - 0.6) / 1.4;
        const blastAlpha = Math.max(0, 1 - blastT);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, -baseSize * 0.45, (baseSize * 0.4) * blastT * 2, (baseSize * 0.25) * blastT * 1.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${blastAlpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Stars exploding out
        for (let k = 0; k < 5; k++) {
          const ka = (k * 2 * Math.PI) / 5;
          const kdist = baseSize * 0.4 + blastT * 45;
          ctx.font = '12px system-ui';
          ctx.fillStyle = `rgba(253, 224, 71, ${blastAlpha})`;
          ctx.fillText('✨', Math.cos(ka) * kdist, -baseSize * 0.45 + Math.sin(ka) * kdist);
        }
        ctx.restore();
      }
      break;
    }

    case 'skull_ghost': {
      // Eerie hover
      const hover = Math.sin(relTime * 3) * 8;
      ctx.translate(0, hover);

      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      // Ghostly blue soul rising
      if (settings.emojiParticleEffects !== false) {
        const gt = (relTime * 0.8) % 1;
        const gAlpha = Math.max(0, 0.7 * (1 - gt));
        const gx = Math.sin(relTime * 4) * 16;
        const gy = -baseSize * 0.2 - gt * 65;
        ctx.save();
        ctx.font = `${Math.round(baseSize * 0.45)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.globalAlpha = gAlpha;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.fillText('👻', gx, gy);
        ctx.restore();
      }
      break;
    }

    case 'rocket_launch': {
      // Vibration and tilt
      const rumbleX = (Math.sin(relTime * 50) > 0 ? 1 : -1) * 1.5;
      const rumbleY = (Math.cos(relTime * 40) > 0 ? 1 : -1) * 1.5;
      ctx.translate(rumbleX, rumbleY);

      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      // Rocket thruster plume
      if (settings.emojiParticleEffects !== false) {
        ctx.save();
        for (let i = 0; i < 4; i++) {
          const pt = ((relTime * 3 + i * 0.25) % 1);
          const pAlpha = Math.max(0, 1 - pt);
          const px = -baseSize * 0.25 - pt * 35;
          const py = baseSize * 0.25 + pt * 35;
          ctx.beginPath();
          ctx.arc(px, py, 6 + (1 - pt) * 8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(249, 115, 22, ${pAlpha * 0.8})`;
          ctx.fill();
        }
        ctx.restore();
      }
      break;
    }

    case 'hundred_stamp': {
      // Stamp impact cycle every 1.8s
      const cycle = (relTime * 0.8) % 1;
      let s = 1;
      let stampDust = false;
      if (cycle < 0.2) {
        s = 1.8 - (cycle / 0.2) * 0.8;
      } else if (cycle < 0.35) {
        stampDust = true;
      }
      ctx.scale(s, s);

      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);

      if (settings.emojiParticleEffects !== false && stampDust) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-baseSize * 0.6, -baseSize * 0.45, baseSize * 1.2, baseSize * 0.9);
        ctx.restore();
      }
      break;
    }

    default: {
      // Gentle rhythmic breath
      const wave = Math.sin(relTime * 4);
      const s = 1 + wave * 0.08;
      ctx.scale(s, s);

      ctx.font = `${Math.round(baseSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 4);
      break;
    }
  }

  ctx.restore();
}

/**
 * Renders interactive social media badges (YouTube Subscribe & Bell & Like, Instagram Double-Tap, TikTok Follow).
 */
function renderSocialBadge(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  settings: ClipElementSettings,
  w: number,
  h: number,
  relTime: number
) {
  const badgeType = settings.socialBadgeType || 'yt_subscribe_bell_like';
  const actionTime = settings.socialActionTiming ?? 0.8;
  const isCompleted = settings.socialCompletedState ?? false;
  const showCursor = settings.socialShowCursor !== false;

  ctx.save();

  // ─────────────────────────────────────────────────────────────
  // 1. YouTube Action Suite: Subscribe + Bell + Like with Cursor
  // ─────────────────────────────────────────────────────────────
  if (badgeType === 'yt_subscribe_bell_like') {
    // Sequence timing milestones:
    const tSubClick = actionTime;
    const tBellClick = actionTime + 0.9;
    const tLikeClick = actionTime + 1.8;

    const subDone = isCompleted || relTime >= tSubClick;
    const bellDone = isCompleted || relTime >= tBellClick;
    const likeDone = isCompleted || relTime >= tLikeClick;

    // Draw main container card
    const hw = w / 2;
    const hh = h / 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-hw, -hh, w, h, hh);
    } else {
      ctx.rect(-hw, -hh, w, h);
    }
    ctx.fillStyle = settings.fillColor || '#0f0f0f';
    ctx.fill();
    ctx.lineWidth = settings.strokeWidth || 1.5;
    ctx.strokeStyle = settings.strokeColor || 'rgba(255,255,255,0.15)';
    ctx.stroke();

    // Channel Avatar Circle
    const avatarR = hh * 0.65;
    const avatarX = -hw + avatarR + 16;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, 0, avatarR, 0, Math.PI * 2);
    ctx.clip();
    const avatarImg = getLoadedImage(settings.socialAvatarUrl);
    if (avatarImg) {
      ctx.drawImage(avatarImg, avatarX - avatarR, -avatarR, avatarR * 2, avatarR * 2);
    } else {
      // Default gradient avatar with initial
      const g = ctx.createLinearGradient(avatarX - avatarR, -avatarR, avatarX + avatarR, avatarR);
      g.addColorStop(0, '#f43f5e');
      g.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.font = `bold ${Math.round(avatarR)}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((settings.socialChannelName || 'Y')[1] || 'Y', avatarX, 1);
    }
    ctx.restore();

    // Channel Name & Sub Count
    const textX = avatarX + avatarR + 12;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    const channelName = settings.socialChannelName || '@MyChannel';
    ctx.fillText(channelName, textX, -11);

    // Verified Checkmark
    if (settings.socialVerified !== false) {
      const nameWidth = ctx.measureText(channelName).width;
      ctx.beginPath();
      ctx.arc(textX + nameWidth + 10, -11, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#0f0f0f';
      ctx.textAlign = 'center';
      ctx.fillText('✓', textX + nameWidth + 10, -11);
    }

    // Subscriber Count
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    const subCount = subDone ? (settings.socialSubCount ? `${settings.socialSubCount} (+1)` : '1.21M') : (settings.socialSubCount || '1.2M');
    ctx.fillText(`${subCount} subscribers`, textX, 12);

    // ── SUBSCRIBE BUTTON ──
    const btnW = 108;
    const btnH = hh * 0.95;
    const btnX = hw - btnW / 2 - 96;
    const btnY = 0;
    const subClickAge = relTime - tSubClick;
    const subDepress = subClickAge >= 0 && subClickAge < 0.15 ? 0.94 : 1;

    ctx.save();
    ctx.translate(btnX, btnY);
    ctx.scale(subDepress, subDepress);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    } else {
      ctx.rect(-btnW / 2, -btnH / 2, btnW, btnH);
    }
    ctx.fillStyle = subDone ? '#27272a' : '#cc0000';
    ctx.fill();
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subDone ? 'Subscribed ✓' : 'Subscribe', 0, 1);
    ctx.restore();

    // ── BELL ICON ──
    const bellX = hw - 65;
    const bellY = 0;
    const bellClickAge = relTime - tBellClick;
    let bellRot = 0;
    if (bellClickAge >= 0 && bellClickAge < 0.6) {
      bellRot = Math.sin(bellClickAge * Math.PI * 8) * Math.exp(-bellClickAge * 4) * 0.45;
    }
    ctx.save();
    ctx.translate(bellX, bellY);
    ctx.rotate(bellRot);
    ctx.font = '22px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bellDone ? '🔔' : '🔔', 0, 0);

    // Acoustic wave chimes when bell rings
    if (bellClickAge >= 0 && bellClickAge < 0.6) {
      const bProgress = bellClickAge / 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, 14 + bProgress * 20, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.strokeStyle = `rgba(245, 158, 11, ${1 - bProgress})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // ── LIKE THUMBS UP ──
    const likeX = hw - 26;
    const likeY = 0;
    const likeClickAge = relTime - tLikeClick;
    let likeScale = 1;
    if (likeClickAge >= 0 && likeClickAge < 0.4) {
      likeScale = 1 + Math.sin((likeClickAge / 0.4) * Math.PI) * 0.35;
    }
    ctx.save();
    ctx.translate(likeX, likeY);
    ctx.scale(likeScale, likeScale);
    ctx.font = '20px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👍', 0, 0);

    // Like starburst particles
    if (likeClickAge >= 0 && likeClickAge < 0.5) {
      const lProgress = likeClickAge / 0.5;
      const lAlpha = 1 - lProgress;
      for (let k = 0; k < 6; k++) {
        const ka = (k * 2 * Math.PI) / 6;
        const kd = 14 + lProgress * 24;
        ctx.beginPath();
        ctx.arc(Math.cos(ka) * kd, Math.sin(ka) * kd, 2.5 * lAlpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${lAlpha})`;
        ctx.fill();
      }
    }
    ctx.restore();

    // ── ANIMATED CURSOR GLIDE ──
    if (showCursor) {
      let curX = hw + 30;
      let curY = hh + 30;
      let isClicked = false;
      let clickAge = -1;

      if (relTime < tSubClick - 0.5) {
        // Flying into view
        const p = Math.max(0, (relTime - (tSubClick - 0.7)) / 0.2);
        curX = hw * 0.6 + (btnX - hw * 0.6) * p;
        curY = hh * 0.8 + (btnY - hh * 0.8) * p;
      } else if (relTime < tSubClick + 0.3) {
        // Pointing at Subscribe button
        curX = btnX + 4;
        curY = btnY + 4;
        if (relTime >= tSubClick && relTime < tSubClick + 0.2) {
          isClicked = true;
          clickAge = relTime - tSubClick;
        }
      } else if (relTime < tBellClick) {
        // Gliding to Bell
        const p = (relTime - (tSubClick + 0.3)) / (tBellClick - (tSubClick + 0.3));
        curX = btnX + (bellX - btnX) * p;
        curY = btnY + (bellY - btnY) * p;
      } else if (relTime < tBellClick + 0.3) {
        // Pointing at Bell
        curX = bellX + 2;
        curY = bellY + 2;
        if (relTime >= tBellClick && relTime < tBellClick + 0.2) {
          isClicked = true;
          clickAge = relTime - tBellClick;
        }
      } else if (relTime < tLikeClick) {
        // Gliding to Like
        const p = (relTime - (tBellClick + 0.3)) / (tLikeClick - (tBellClick + 0.3));
        curX = bellX + (likeX - bellX) * p;
        curY = bellY + (likeY - bellY) * p;
      } else if (relTime < tLikeClick + 0.3) {
        // Pointing at Like
        curX = likeX + 2;
        curY = likeY + 2;
        if (relTime >= tLikeClick && relTime < tLikeClick + 0.2) {
          isClicked = true;
          clickAge = relTime - tLikeClick;
        }
      } else {
        // Gliding away
        const p = Math.min(1, (relTime - (tLikeClick + 0.3)) / 0.4);
        curX = likeX + (hw + 40 - likeX) * p;
        curY = likeY + (hh + 40 - likeY) * p;
      }

      drawCursorPointer(ctx, curX, curY, isClicked, clickAge);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. YouTube Single Subscribe Button Click
  // ─────────────────────────────────────────────────────────────
  else if (badgeType === 'yt_subscribe_click') {
    const isClicked = isCompleted || relTime >= actionTime;
    const clickAge = relTime - actionTime;
    const depress = clickAge >= 0 && clickAge < 0.18 ? 0.93 : 1;

    ctx.scale(depress, depress);
    traceShapePath(ctx, 'rounded_rect', w, h, h / 2, settings);
    ctx.fillStyle = isClicked ? '#27272a' : '#cc0000';
    ctx.fill();

    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isClicked ? 'SUBSCRIBED ✓' : 'SUBSCRIBE', 0, 1);

    if (showCursor) {
      const curP = Math.min(1, Math.max(0, relTime / actionTime));
      const curX = (1 - curP) * (w * 0.5) + (curP * 10);
      const curY = (1 - curP) * (h * 0.7) + (curP * 6);
      drawCursorPointer(ctx, curX, curY, clickAge >= 0 && clickAge < 0.2, clickAge);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Instagram Double-Tap Heart Burst
  // ─────────────────────────────────────────────────────────────
  else if (badgeType === 'insta_heart_double_tap') {
    const tTap1 = actionTime;
    const tTap2 = actionTime + 0.18;
    const burstDone = isCompleted || relTime >= tTap2;
    const burstAge = relTime - tTap2;

    // Center big glowing heart
    if (burstDone) {
      const bProgress = Math.min(1, burstAge / 0.5);
      const s = 1 + Math.sin(bProgress * Math.PI) * 0.38;
      ctx.save();
      ctx.scale(s, s);

      // Glowing Instagram Gradient
      const grad = createLinearGradient(ctx, w, h, '#fd1d1d', '#833ab4', 45);
      traceShapePath(ctx, 'heart', w * 0.85, h * 0.85, 0, settings);
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(225, 48, 108, 0.75)';
      ctx.shadowBlur = 24;
      ctx.fill();

      // White inner heart icon
      ctx.font = `${Math.round(h * 0.35)}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'transparent';
      ctx.fillText('❤️', 0, -2);
      ctx.restore();

      // Rising "+1" Pill Badge
      if (burstAge >= 0 && burstAge < 1.2) {
        const pT = burstAge / 1.2;
        const pAlpha = 1 - pT;
        const py = -h * 0.45 - pT * 40;
        ctx.save();
        ctx.globalAlpha = pAlpha;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-28, py - 14, 56, 28, 14);
        } else {
          ctx.rect(-28, py - 14, 56, 28);
        }
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#e1306c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+1', 0, py);
        ctx.restore();
      }
    } else {
      // Resting subtle heart outline
      traceShapePath(ctx, 'heart', w * 0.7, h * 0.7, 0, settings);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Double-tap finger gestures
    if (showCursor) {
      const tap1Active = relTime >= tTap1 && relTime < tTap1 + 0.12;
      const tap2Active = relTime >= tTap2 && relTime < tTap2 + 0.12;
      if (relTime >= tTap1 - 0.25 && relTime < tTap2 + 0.4) {
        drawCursorPointer(ctx, 12, 10, tap1Active || tap2Active, tap2Active ? burstAge : -1);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Instagram Follow Button Tap
  // ─────────────────────────────────────────────────────────────
  else if (badgeType === 'insta_follow_button') {
    const isClicked = isCompleted || relTime >= actionTime;
    const clickAge = relTime - actionTime;
    const depress = clickAge >= 0 && clickAge < 0.16 ? 0.94 : 1;

    ctx.scale(depress, depress);
    traceShapePath(ctx, 'rounded_rect', w, h, 14, settings);
    if (isClicked) {
      ctx.fillStyle = '#ef4444'; // Or light/dark following
      ctx.fillStyle = '#262626';
      ctx.fill();
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Following ✓', 0, 1);
    } else {
      const grad = createLinearGradient(ctx, w, h, '#0095f6', '#0077e6', 90);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Follow', 0, 1);
    }

    if (showCursor) {
      const curP = Math.min(1, Math.max(0, relTime / actionTime));
      const curX = (1 - curP) * (w * 0.4) + (curP * 8);
      const curY = (1 - curP) * (h * 0.6) + (curP * 4);
      drawCursorPointer(ctx, curX, curY, clickAge >= 0 && clickAge < 0.18, clickAge);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. TikTok Follow Burst + Confetti
  // ─────────────────────────────────────────────────────────────
  else if (badgeType === 'tiktok_follow_burst') {
    const isClicked = isCompleted || relTime >= actionTime;
    const clickAge = relTime - actionTime;

    traceShapePath(ctx, 'rounded_rect', w, h, h / 2, settings);
    ctx.fillStyle = settings.fillColor || '#121212';
    ctx.fill();
    ctx.strokeStyle = '#fe2c55';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Red pill button on right
    const pillW = 90;
    const pillH = h * 0.72;
    const pillX = w / 2 - pillW / 2 - 12;

    ctx.save();
    ctx.translate(pillX, 0);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
    } else {
      ctx.rect(-pillW / 2, -pillH / 2, pillW, pillH);
    }
    ctx.fillStyle = isClicked ? '#27272a' : '#fe2c55';
    ctx.fill();

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isClicked ? 'Friends ✓' : '+ Follow', 0, 1);
    ctx.restore();

    // Channel name on left
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(settings.socialChannelName || '@pro_editor', -w / 2 + 20, 0);

    // Confetti burst
    if (clickAge >= 0 && clickAge < 0.7) {
      const cT = clickAge / 0.7;
      const cAlpha = 1 - cT;
      const colors = ['#fe2c55', '#25f4ee', '#ffffff', '#fbbf24'];
      for (let k = 0; k < 12; k++) {
        const ka = (k * 2 * Math.PI) / 12;
        const kd = 15 + cT * 40;
        ctx.beginPath();
        ctx.arc(pillX + Math.cos(ka) * kd, Math.sin(ka) * kd, 3 * cAlpha, 0, Math.PI * 2);
        ctx.fillStyle = colors[k % colors.length];
        ctx.globalAlpha = cAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (showCursor) {
      const curX = pillX + 6;
      const curY = 6;
      drawCursorPointer(ctx, curX, curY, clickAge >= 0 && clickAge < 0.2, clickAge);
    }
  }

  // Fallback generic badge
  else {
    traceShapePath(ctx, 'rounded_rect', w, h, 20, settings);
    ctx.fillStyle = settings.fillColor || '#1e293b';
    ctx.fill();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(settings.label || 'BADGE', 0, 0);
  }

  ctx.restore();
}

/**
 * Renders an element clip (Shape, Emoji, Sticker, or Badge) onto a Canvas2D context.
 */
export function renderElement(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  settings: ClipElementSettings,
  w: number,
  h: number,
  anim: ElementTransform,
  relTime: number = 0,
  _clipDuration: number = 5
) {
  ctx.save();
  ctx.globalAlpha = (ctx.globalAlpha ?? 1) * anim.opacity;

  // Apply animation transforms: translation, rotation, scaling
  ctx.translate(anim.offsetX, anim.offsetY);
  if (anim.rotation !== 0) {
    ctx.rotate((anim.rotation * Math.PI) / 180);
  }
  ctx.scale(anim.scaleX, anim.scaleY);

  // Apply Drop Shadow / Glow
  if (settings.shadowColor && (settings.shadowBlur ?? 0) > 0) {
    ctx.shadowColor = settings.shadowColor;
    ctx.shadowBlur = settings.shadowBlur ?? 12;
    ctx.shadowOffsetX = settings.shadowOffsetX ?? 0;
    ctx.shadowOffsetY = settings.shadowOffsetY ?? 0;
  }

  // ── Render Emoji ──
  if (settings.elementType === 'emoji' && settings.emojiChar) {
    if (settings.emojiEmotionAnimation !== false) {
      renderAnimatedEmoji(ctx, settings, w, h, relTime);
    } else {
      const fontSize = Math.min(w, h) * 0.78;
      ctx.font = `${Math.round(fontSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(settings.emojiChar, 0, 4);
    }
    ctx.restore();
    return;
  }

  // ── Render Interactive Social Badges ──
  if (settings.elementType === 'badge' && settings.socialBadgeType) {
    renderSocialBadge(ctx, settings, w, h, relTime);
    ctx.restore();
    return;
  }

  // ── Render Shape or Sticker Background ──
  const shapeType = settings.shapeType || 'rounded_rect';
  traceShapePath(ctx, shapeType, w, h, settings.cornerRadius ?? 16, settings);

  // Fill (respects fillType === 'none' for transparent border-only shape)
  if (settings.fillColor && settings.fillColor !== 'transparent' && settings.fillType !== 'none') {
    if (settings.fillType === 'gradient' && settings.gradientEndColor) {
      ctx.fillStyle = createLinearGradient(
        ctx,
        w,
        h,
        settings.fillColor,
        settings.gradientEndColor,
        settings.gradientAngle ?? 135
      );
    } else {
      ctx.fillStyle = settings.fillColor;
    }
    ctx.fill();
  }

  // Reset shadow before clipped inner content, stroke and text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ── Inner Picture / Media Masked Clipping ──
  if (settings.innerImageUrl) {
    const img = getLoadedImage(settings.innerImageUrl);
    if (img) {
      ctx.save();
      traceShapePath(ctx, shapeType, w, h, settings.cornerRadius ?? 16, settings);
      ctx.clip();

      const fit = settings.innerImageFit || 'cover';
      const imgOpacity = settings.innerImageOpacity ?? 1;
      ctx.globalAlpha *= imgOpacity;

      let dw = w;
      let dh = h;
      let dx = -w / 2;
      let dy = -h / 2;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const boxRatio = w / h;

      if (fit === 'cover') {
        if (imgRatio > boxRatio) {
          dh = h;
          dw = h * imgRatio;
          dx = -dw / 2;
        } else {
          dw = w;
          dh = w / imgRatio;
          dy = -dh / 2;
        }
      } else if (fit === 'contain') {
        if (imgRatio > boxRatio) {
          dw = w;
          dh = w / imgRatio;
          dy = -dh / 2;
        } else {
          dh = h;
          dw = h * imgRatio;
          dx = -dw / 2;
        }
      }

      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    }
  }

  // ── Stroke (Border) ──
  const strokeW = settings.strokeWidth ?? 0;
  if (strokeW > 0 && settings.strokeColor) {
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = settings.strokeColor;
    if (settings.strokeStyle === 'dashed') {
      ctx.setLineDash([strokeW * 3, strokeW * 2]);
    } else if (settings.strokeStyle === 'dotted') {
      ctx.setLineDash([strokeW, strokeW * 1.5]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
  }

  // ── Inner Formatted Text inside Shape ──
  if (settings.innerText) {
    const fontSize = settings.innerTextSize || Math.max(14, Math.min(w * 0.14, h * 0.35));
    const fontFamily = settings.innerTextFont || 'system-ui, -apple-system, sans-serif';
    const fontWeight = settings.innerTextWeight || 'bold';
    ctx.font = `${fontWeight} ${Math.round(fontSize)}px ${fontFamily}`;
    ctx.textAlign = (settings.innerTextAlign as CanvasTextAlign) || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = settings.innerTextColor || '#ffffff';
    let tx = 0;
    if (settings.innerTextAlign === 'left') tx = -w * 0.42;
    else if (settings.innerTextAlign === 'right') tx = w * 0.42;
    ctx.fillText(settings.innerText, tx, 0);
  }

  // ── Render Sticker / Badge Label Text ──
  if (settings.label && !settings.innerText) {
    const textLen = settings.label.length;
    const fontSize = Math.max(12, Math.min(w * 0.16, h * 0.42, 380 / Math.max(1, textLen)));
    ctx.font = `bold ${Math.round(fontSize)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = settings.strokeColor || '#ffffff';
    ctx.fillText(settings.label, 0, 1);
  }

  ctx.restore();
}
