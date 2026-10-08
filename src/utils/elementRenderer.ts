// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Element Canvas2D Renderer & Professional Animation Engine
// ─────────────────────────────────────────────────────────────────────────────

import { ClipElementSettings, ElementShapeType } from '@/types';

export interface ElementTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  rotation: number; // In degrees
  opacity: number;
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
        // Elastic spring overshoot: 0 -> 1.15 -> 1.0
        const spring = 1 + Math.sin(p * Math.PI * 2.2) * 0.28 * (1 - p);
        scaleX *= p * spring;
        scaleY *= p * spring;
        opacity *= Math.min(1, p * 2);
        break;
      }
      case 'bounce_spring': {
        // Dramatic bounce drop
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
    }
  }

  // ── Exit (Out) Animation ──
  if (timeLeft < outDuration && settings.animationOut && settings.animationOut !== 'none') {
    const p = Math.min(1, (outDuration - timeLeft) / outDuration); // 0 (start exit) -> 1 (gone)
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
    }
  }

  // ── Idle / Continuous Loop Animation (Active during full visibility) ──
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
    }
  }

  return { scaleX, scaleY, offsetX, offsetY, rotation, opacity: Math.max(0, Math.min(1, opacity)) };
}

/**
 * Traces a closed vector path on Canvas2D centered at (0, 0).
 */
export function traceShapePath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shapeType: ElementShapeType,
  w: number,
  h: number,
  cornerRadius: number = 0
) {
  const hw = w / 2;
  const hh = h / 2;
  ctx.beginPath();

  switch (shapeType) {
    case 'rectangle': {
      ctx.rect(-hw, -hh, w, h);
      break;
    }
    case 'rounded_rect': {
      const r = Math.min(cornerRadius, hw, hh);
      if (r <= 0) {
        ctx.rect(-hw, -hh, w, h);
      } else if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-hw, -hh, w, h, r);
      } else {
        // Fallback bezier rounded rect
        ctx.moveTo(-hw + r, -hh);
        ctx.arcTo(hw, -hh, hw, hh, r);
        ctx.arcTo(hw, hh, -hw, hh, r);
        ctx.arcTo(-hw, hh, -hw, -hh, r);
        ctx.arcTo(-hw, -hh, hw, -hh, r);
        ctx.closePath();
      }
      break;
    }
    case 'circle': {
      const radius = Math.min(hw, hh);
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      break;
    }
    case 'ellipse': {
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      break;
    }
    case 'star': {
      const points = 5;
      const outerR = Math.min(hw, hh);
      const innerR = outerR * 0.42;
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
      const s = Math.min(w / 100, h / 100) * 0.9;
      ctx.moveTo(0, 28 * s);
      ctx.bezierCurveTo(-45 * s, -15 * s, -55 * s, -45 * s, 0, -20 * s);
      ctx.bezierCurveTo(55 * s, -45 * s, 45 * s, -15 * s, 0, 28 * s);
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      const r = Math.min(hw, hh);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'triangle': {
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const shaftH = hh * 0.45;
      const headL = hw * 0.55;
      ctx.moveTo(-hw, -shaftH);
      ctx.lineTo(hw - headL, -shaftH);
      ctx.lineTo(hw - headL, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(hw - headL, hh);
      ctx.lineTo(hw - headL, shaftH);
      ctx.lineTo(-hw, shaftH);
      ctx.closePath();
      break;
    }
    case 'arrow_double': {
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
      break;
    }
    case 'speech_bubble': {
      const r = Math.min(cornerRadius || 18, hw * 0.5, hh * 0.5);
      const tailW = hw * 0.35;
      const tailH = hh * 0.35;
      const boxBottom = hh - tailH;
      ctx.moveTo(-hw + r, -hh);
      ctx.lineTo(hw - r, -hh);
      ctx.arcTo(hw, -hh, hw, boxBottom, r);
      ctx.arcTo(hw, boxBottom, -hw, boxBottom, r);
      // Pointer tail
      ctx.lineTo(-hw * 0.1, boxBottom);
      ctx.lineTo(-hw * 0.35, hh);
      ctx.lineTo(-hw * 0.35, boxBottom);
      ctx.lineTo(-hw + r, boxBottom);
      ctx.arcTo(-hw, boxBottom, -hw, -hh, r);
      ctx.arcTo(-hw, -hh, hw, -hh, r);
      ctx.closePath();
      break;
    }
    case 'thought_bubble': {
      ctx.ellipse(0, -hh * 0.2, hw * 0.9, hh * 0.65, 0, 0, Math.PI * 2);
      ctx.closePath();
      break;
    }
    case 'shield': {
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, -hh);
      ctx.bezierCurveTo(hw, hh * 0.3, hw * 0.5, hh * 0.8, 0, hh);
      ctx.bezierCurveTo(-hw * 0.5, hh * 0.8, -hw, hh * 0.3, -hw, -hh);
      ctx.closePath();
      break;
    }
    case 'callout': {
      const indent = hw * 0.2;
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.lineTo(hw - indent, 0);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.lineTo(-hw + indent, 0);
      ctx.closePath();
      break;
    }
    case 'badge': {
      const outerR = Math.min(hw, hh);
      const innerR = outerR * 0.82;
      const n = 14;
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
 * Renders an element clip (Shape, Emoji, Sticker, or Badge) onto a Canvas2D context.
 */
export function renderElement(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  settings: ClipElementSettings,
  w: number,
  h: number,
  anim: ElementTransform
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
    const fontSize = Math.min(w, h) * 0.78;
    ctx.font = `${Math.round(fontSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(settings.emojiChar, 0, 4);
    ctx.restore();
    return;
  }

  // ── Render Shape or Sticker Background ──
  const shapeType = settings.shapeType || 'rounded_rect';
  traceShapePath(ctx, shapeType, w, h, settings.cornerRadius ?? 16);

  // Fill
  if (settings.fillColor && settings.fillColor !== 'transparent') {
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

  // Reset shadow before stroke and text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Stroke
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

  // ── Render Sticker / Badge Label Text ──
  if (settings.label) {
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
