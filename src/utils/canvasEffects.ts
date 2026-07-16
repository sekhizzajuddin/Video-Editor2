import { applyAiBackgroundMask } from './aiBackground';
import { applyLutToCanvas } from './lutParser';
import type { ClipParticleSettings } from '@/types';

// Image cache – shared across renders, keyed by mediaId.
const MAX_CACHE_SIZE = 50;
export const imageCache = new Map<string, HTMLImageElement>();
export const imageLoading = new Set<string>();

export function clearPreviewCaches() {
  imageCache.clear();
  imageLoading.clear();
}

let separationCleanup: (() => void) | null = null;

if (typeof window !== 'undefined') {
  const handler = ((e: CustomEvent) => {
    const id = e.detail?.id;
    if (id) {
      imageCache.delete(id);
      imageLoading.delete(id);
    }
  }) as EventListener;
  
  window.addEventListener('procut-evict-media-cache', handler);
  
  separationCleanup = () => {
    window.removeEventListener('procut-evict-media-cache', handler);
  };
}

export function cleanupCanvasEffects() {
  if (separationCleanup) {
    separationCleanup();
    separationCleanup = null;
  }
}

export function getCachedImage(
  mediaId: string,
  url: string | null,
  onLoad: () => void,
): HTMLImageElement | null {
  if (!url) return null;
  const cached = imageCache.get(mediaId);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    // Move to end to mark as most recently used
    imageCache.delete(mediaId);
    imageCache.set(mediaId, cached);
    return cached;
  }

  // Already loading – wait for the existing load to resolve
  if (imageLoading.has(mediaId)) return null;

  imageLoading.add(mediaId);
  const img = new Image();
  if (!url.startsWith('data:') && !url.startsWith('blob:')) {
    img.crossOrigin = 'anonymous';
  }
  img.onload = () => {
    // Evict oldest if limit reached
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey !== undefined) {
        imageCache.delete(firstKey);
      }
    }
    imageCache.set(mediaId, img);
    imageLoading.delete(mediaId);
    onLoad(); // trigger a re-render / re-draw
  };
  img.onerror = () => {
    imageLoading.delete(mediaId);
  };
  img.src = url;
  return null;
}

export interface LocalCornerPoints {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
}

export function getProjectedCorners(
  w: number,
  h: number,
  scale: number,
  rx: number, // X-rotation (degrees)
  ry: number, // Y-rotation (degrees)
  rz: number, // Z-rotation (degrees)
  aX: number,
  aY: number,
  cx: number,
  cy: number,
  D: number = 800
): LocalCornerPoints {
  const radX = (rx * Math.PI) / 180;
  const radY = (ry * Math.PI) / 180;
  const radZ = (rz * Math.PI) / 180;

  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  const halfW = w / 2;
  const halfH = h / 2;

  // 4 corners of standard flat rectangle
  const localPts = [
    { x: -halfW, y: -halfH }, // TL
    { x: halfW, y: -halfH },  // TR
    { x: halfW, y: halfH },   // BR
    { x: -halfW, y: halfH }    // BL
  ];

  const projected = localPts.map(pt => {
    // 1. Scale
    const x = pt.x * scale;
    const y = pt.y * scale;
    const z = 0;

    // 2. Rotate X
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;

    // 3. Rotate Y
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;

    // 4. Rotate Z
    const x3 = x2 * cosZ - y1 * sinZ;
    const y3 = x2 * sinZ + y1 * cosZ;

    // 5. Perspective Projection
    const scaleFactor = D / (D - z2);
    const xp = x3 * scaleFactor;
    const yp = y3 * scaleFactor;

    // 6. Translation
    return {
      x: cx + aX + xp,
      y: cy + aY + yp
    };
  });

  return {
    x0: projected[0].x, y0: projected[0].y,
    x1: projected[1].x, y1: projected[1].y,
    x2: projected[2].x, y2: projected[2].y,
    x3: projected[3].x, y3: projected[3].y
  };
}

export function drawPerspectiveTexture(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  corners: LocalCornerPoints,
  gridCols: number = 8,
  gridRows: number = 8
) {
  const imgW = ('videoWidth' in img && (img as any).videoWidth > 0) 
    ? (img as any).videoWidth 
    : ('width' in img && (img as any).width > 0)
      ? (img as any).width
      : 854;
      
  const imgH = ('videoHeight' in img && (img as any).videoHeight > 0) 
    ? (img as any).videoHeight 
    : ('height' in img && (img as any).height > 0)
      ? (img as any).height
      : 480;

  const getBilinearPoint = (u: number, v: number) => {
    const x = (1 - u) * (1 - v) * corners.x0 + u * (1 - v) * corners.x1 + u * v * corners.x2 + (1 - u) * v * corners.x3;
    const y = (1 - u) * (1 - v) * corners.y0 + u * (1 - v) * corners.y1 + u * v * corners.y2 + (1 - u) * v * corners.y3;
    return { x, y };
  };

  const drawTriangle = (
    s0: { x: number; y: number },
    s1: { x: number; y: number },
    s2: { x: number; y: number },
    d0: { x: number; y: number },
    d1: { x: number; y: number },
    d2: { x: number; y: number }
  ) => {
    ctx.save();
    
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
    if (Math.abs(den) < 1e-6) {
      ctx.restore();
      return;
    }

    const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
    const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
    const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
    const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
    const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / den;
    const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / den;

    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const u0 = c / gridCols;
      const u1 = (c + 1) / gridCols;
      const v0 = r / gridRows;
      const v1 = (r + 1) / gridRows;

      const sx0 = u0 * imgW, sy0 = v0 * imgH;
      const sx1 = u1 * imgW, sy1 = v0 * imgH;
      const sx2 = u1 * imgW, sy2 = v1 * imgH;
      const sx3 = u0 * imgW, sy3 = v1 * imgH;

      const dTL = getBilinearPoint(u0, v0);
      const dTR = getBilinearPoint(u1, v0);
      const dBR = getBilinearPoint(u1, v1);
      const dBL = getBilinearPoint(u0, v1);

      drawTriangle(
        { x: sx0, y: sy0 }, { x: sx1, y: sy1 }, { x: sx3, y: sy3 },
        dTL, dTR, dBL
      );

      drawTriangle(
        { x: sx1, y: sy1 }, { x: sx2, y: sy2 }, { x: sx3, y: sy3 },
        dTR, dBR, dBL
      );
    }
  }
}

export type ParticleEffectType =
  | 'snow' | 'rain' | 'fire' | 'sparkles' | 'confetti'
  | 'smoke' | 'bubbles' | 'leaves' | 'hearts' | 'matrix';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  char?: string;
  type: ParticleEffectType;
}

export interface ParticlePool {
  particles: Particle[];
  lastEmit: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  const n = parseInt(cleanHex, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function randomHue() {
  const hues = [0, 30, 60, 120, 180, 240, 270, 300];
  return hues[Math.floor(Math.random() * hues.length)];
}

export function spawnParticle(
  ps: ClipParticleSettings,
  canvasW: number,
  canvasH: number,
): Particle {
  const ex = (ps.emitterX / 100) * canvasW;
  const ey = (ps.emitterY / 100) * canvasH;
  const spreadRad = (ps.spread / 2) * (Math.PI / 180);
  const baseSpeed = (ps.speed / 100) * 3;
  const baseSize  = (ps.size  / 100) * 5;
  const baseLife  = Math.round((ps.lifetime / 100) * 90);
  const turbulence = (ps.turbulence / 100) * 2;

  const gravDir = ps.gravity > 0 ? Math.PI / 2 : -Math.PI / 2;
  const angle = gravDir + (Math.random() - 0.5) * 2 * spreadRad;
  const speed = baseSpeed * (0.5 + Math.random());
  let vx = Math.cos(angle) * speed + (ps.wind / 100) * 1.5;
  let vy = Math.sin(angle) * speed;

  const jitter = baseSize * 2;
  const px = ex + (Math.random() - 0.5) * jitter * 4;
  const py = ey + (Math.random() - 0.5) * jitter;

  let color: string;
  if (ps.color === 'auto') {
    color = `hsl(${randomHue()},90%,60%)`;
  } else if (ps.colorVariance > 0) {
    const [r,g,b] = hexToRgb(ps.color);
    const v = Math.round((Math.random() - 0.5) * ps.colorVariance * 1.5);
    color = `rgb(${Math.min(255,Math.max(0,r+v))},${Math.min(255,Math.max(0,g+v))},${Math.min(255,Math.max(0,b+v))})`;
  } else {
    color = ps.color;
  }

  if (ps.type === 'rain') {
    vx = (ps.wind / 100) * 1.5 + (Math.random() - 0.5) * 0.3;
    vy = baseSpeed * (0.8 + Math.random() * 0.4);
    return { x: Math.random() * canvasW, y: -10, vx, vy, life: 1, maxLife: baseLife, size: 0.8 + Math.random(), color, rotation: 0, rotSpeed: 0, type: ps.type };
  }
  if (ps.type === 'snow') {
    vx = (ps.wind / 100) + (Math.random() - 0.5) * turbulence;
    vy = baseSpeed * (0.3 + Math.random() * 0.7);
    return { x: Math.random() * canvasW, y: -10, vx, vy, life: 1, maxLife: baseLife, size: (1 + Math.random() * 2) * (ps.size / 100), color, rotation: 0, rotSpeed: 0, type: ps.type };
  }
  if (ps.type === 'matrix') {
    const chars = '0123456789ABCDEF日月火水木金土';
    return { x: ex, y: 0, vx: 0, vy: baseSpeed, life: 1, maxLife: baseLife, size: 10 * (ps.size / 100), color, rotation: 0, rotSpeed: 0, char: chars[Math.floor(Math.random()*chars.length)], type: ps.type };
  }

  vx += (Math.random() - 0.5) * turbulence;
  vy += (Math.random() - 0.5) * turbulence * 0.5;

  return { x: px, y: py, vx, vy, life: 1, maxLife: baseLife, size: baseSize * (0.5 + Math.random() * 1.5), color, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2, type: ps.type };
}

export function drawParticleShape(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);

  switch (p.type) {
    case 'snow': {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      if (p.size > 2) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.8;
        for (let arm = 0; arm < 6; arm++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(0, p.size * 1.8);
          ctx.stroke();
        }
      }
      break;
    }
    case 'rain': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(p.vx * 2, p.vy * 2);
      ctx.stroke();
      break;
    }
    case 'fire': {
      const r = p.size;
      const lifeN = p.life;
      ctx.beginPath();
      ctx.moveTo(0, -r * 2);
      ctx.bezierCurveTo(r * 0.6, -r, r, r * 0.5, 0, r);
      ctx.bezierCurveTo(-r, r * 0.5, -r * 0.6, -r, 0, -r * 2);
      const fireHue = 10 + (1 - lifeN) * 40;
      ctx.fillStyle = `hsl(${fireHue},100%,${50 + (1-lifeN)*20}%)`;
      ctx.fill();
      break;
    }
    case 'sparkles': {
      const r = p.size;
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let pt = 0; pt < 8; pt++) {
        const a = (pt * Math.PI) / 4;
        const dist = pt % 2 === 0 ? r : r * 0.4;
        if (pt === 0) {
          ctx.moveTo(Math.cos(a) * dist, Math.sin(a) * dist);
        } else {
          ctx.lineTo(Math.cos(a) * dist, Math.sin(a) * dist);
        }
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'confetti': {
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.8, -p.size * 0.4, p.size * 1.6, p.size * 0.8);
      break;
    }
    case 'smoke': {
      const r = p.size * (1 + (1 - p.life) * 2);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      const smokeAlpha = alpha * p.life * 0.5;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = smokeAlpha;
      ctx.fill();
      break;
    }
    case 'bubbles': {
      const r = p.size;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
      break;
    }
    case 'leaves': {
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      const lw = p.size * 1.2;
      ctx.ellipse(0, 0, lw * 0.5, lw, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a3a10';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lw * 0.5); ctx.lineTo(0, lw * 1.2);
      ctx.stroke();
      break;
    }
    case 'hearts': {
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.bezierCurveTo(s, -s * 1.5, s * 2, s * 0.5, 0, s * 1.5);
      ctx.bezierCurveTo(-s * 2, s * 0.5, -s, -s * 1.5, 0, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'matrix': {
      ctx.fillStyle = p.color;
      ctx.font = `bold ${Math.round(p.size)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.char ?? '0', 0, 0);
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(p.char ?? '0', 0, -p.size);
      break;
    }
  }
  ctx.restore();
}

export function renderParticles(
  ctx: CanvasRenderingContext2D,
  clipId: string,
  ps: ClipParticleSettings,
  W: number,
  H: number,
  deltaMs: number,
  particlePools: Map<string, ParticlePool>
): void {
  let pool = particlePools.get(clipId);
  if (!pool) {
    pool = { particles: [], lastEmit: 0 };
    particlePools.set(clipId, pool);
  }

  const now = performance.now();
  const maxCount = ps.amount;

  if (deltaMs > 0 && pool.particles.length < maxCount) {
    const emitInterval = Math.max(16, 1000 / (maxCount / ((ps.lifetime / 100) * 1.5)));
    if (now - pool.lastEmit > emitInterval) {
      const batchSize = Math.min(3, maxCount - pool.particles.length);
      for (let i = 0; i < batchSize; i++) {
        pool.particles.push(spawnParticle(ps, W, H));
      }
      pool.lastEmit = now;
    }
  }

  const dtScale = deltaMs / (1000 / 60);
  const gravityAcc = (ps.gravity / 100) * 0.12 * dtScale;
  const windAcc    = (ps.wind    / 100) * 0.03 * dtScale;
  const turbStr    = (ps.turbulence / 100) * 0.08;
  const opacity    = (ps.intensity / 100);

  if (ps.glow) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = ps.color === 'auto' ? '#ffffff' : ps.color;
  }

  pool.particles = pool.particles.filter((p) => {
    if (deltaMs > 0) {
      p.vy += gravityAcc;
      p.vx += windAcc + (Math.random() - 0.5) * turbStr;
      p.x  += p.vx * dtScale;
      p.y  += p.vy * dtScale;
      p.rotation += p.rotSpeed * dtScale;
      p.life -= (1 / p.maxLife) * dtScale;
      p.life = Math.max(0, p.life);

      if (p.type === 'matrix' && Math.random() < 0.05) {
        const chars = '0123456789ABCDEF';
        p.char = chars[Math.floor(Math.random() * chars.length)];
      }
    }

    if (p.life <= 0) return false;
    if (p.x < -50 || p.x > W + 50 || p.y > H + 50) return false;

    const fadeIn  = p.life > 0.9 ? (1 - p.life) / 0.1 : 1;
    const fadeOut = p.life < 0.2 ? p.life / 0.2 : 1;
    const alpha = opacity * Math.min(fadeIn, fadeOut);
    drawParticleShape(ctx, p, alpha);
    return true;
  });

  if (ps.glow) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
}

export function drawMediaPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  type: string,
  color: string
) {
  ctx.save();
  ctx.fillStyle = '#222';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(type, 0, -15);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px sans-serif';
  ctx.fillText(name, 0, 20);
  ctx.restore();
}

export function applyColorOverlays(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  filters: any
) {
  if (!filters) return;

  const { temperature = 0, tint = 0, fadedFilm = 0, vignette = 0 } = filters;

  if (temperature !== 0 || tint !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    
    let r = 0, g = 0, b = 0;
    if (temperature > 0) {
      r = Math.min(255, temperature * 1.5);
      g = Math.min(255, temperature * 0.5);
    } else if (temperature < 0) {
      b = Math.min(255, Math.abs(temperature) * 1.5);
      g = Math.min(255, Math.abs(temperature) * 0.2);
    }
    if (tint > 0) {
      g = Math.min(255, g + tint * 1.5);
    } else if (tint < 0) {
      r = Math.min(255, r + Math.abs(tint));
      b = Math.min(255, b + Math.abs(tint));
    }
    
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(Math.abs(temperature), Math.abs(tint)) / 100 * 0.3})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }

  if (fadedFilm > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const fadeStrength = fadedFilm / 100 * 0.15;
    ctx.fillStyle = `rgba(40, 45, 50, ${fadeStrength})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }

  if (vignette !== 0) {
    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    const radius = Math.sqrt(dw * dw + dh * dh) / 2;
    const grad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius);

    const isDark = vignette > 0;
    const color = isDark ? '0,0,0' : '255,255,255';
    const alpha = Math.min(1, Math.max(0, Math.abs(vignette) / 100));

    grad.addColorStop(0, `rgba(${color}, 0)`);
    grad.addColorStop(0.5, `rgba(${color}, ${alpha * 0.2})`);
    grad.addColorStop(1, `rgba(${color}, ${alpha})`);

    if (isDark) {
      ctx.globalCompositeOperation = 'multiply';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.fillStyle = grad;
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}

export function applyChromaKeyOnData(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  keyColorHex: string,
  threshold: number,
  softness: number
) {
  try {
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const hex = keyColorHex.replace('#', '');
    const kr = parseInt(hex.substring(0, 2), 16) || 0;
    const kg = parseInt(hex.substring(2, 4), 16) || 255;
    const kb = parseInt(hex.substring(4, 6), 16) || 0;

    const ku = -0.1687 * kr - 0.3313 * kg + 0.5 * kb + 128;
    const kv = 0.5 * kr - 0.4187 * kg - 0.0813 * kb + 128;

    const th = threshold * 2.4; 
    const soft = softness * 2.4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const u = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
      const v = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

      const dist = Math.sqrt((u - ku) ** 2 + (v - kv) ** 2);

      if (dist < th) {
        data[i + 3] = 0; 
      } else if (dist < th + soft && soft > 0) {
        const factor = (dist - th) / soft;
        data[i + 3] = Math.round(data[i + 3] * factor);
      }
    }
    oCtx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.error('Failed to apply Chroma Key', err);
  }
}

export function applyLumaKeyOnData(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: 'dark' | 'light',
  threshold: number,
  softness: number
) {
  try {
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const th = (threshold / 100) * 255;
    const soft = (softness / 100) * 255;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      
      if (type === 'dark') {
        if (luma < th) {
          data[i + 3] = 0;
        } else if (luma < th + soft && soft > 0) {
          const factor = (luma - th) / soft;
          data[i + 3] = Math.round(data[i + 3] * factor);
        }
      } else {
        const lightTh = 255 - th;
        
        if (luma > lightTh) {
          data[i + 3] = 0;
        } else if (luma > lightTh - soft && soft > 0) {
          const factor = (lightTh - luma) / soft;
          data[i + 3] = Math.round(data[i + 3] * factor);
        }
      }
    }
    oCtx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.error('Failed to apply Luma Key', err);
  }
}

export function applyColorGradingWheelsOnData(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shadows?: any,
  midtones?: any,
  highlights?: any
) {
  const getWheelOffsets = (wh?: any) => {
    if (!wh) return { r: 0, g: 0, b: 0 };
    const hue = wh.hue || 0;
    const sat = wh.saturation || 0;
    const lift = wh.lift || 0;

    const rad = (hue * Math.PI) / 180;
    const factor = (sat / 100) * 0.15;
    const brightness = (lift / 100) * 0.15;

    return {
      r: Math.cos(rad) * factor + brightness,
      g: Math.cos(rad - (2 * Math.PI) / 3) * factor + brightness,
      b: Math.cos(rad + (2 * Math.PI) / 3) * factor + brightness,
    };
  };

  const sOff = getWheelOffsets(shadows);
  const mOff = getWheelOffsets(midtones);
  const hOff = getWheelOffsets(highlights);

  if (
    sOff.r === 0 && sOff.g === 0 && sOff.b === 0 &&
    mOff.r === 0 && mOff.g === 0 && mOff.b === 0 &&
    hOff.r === 0 && hOff.g === 0 && hOff.b === 0
  ) {
    return;
  }

  try {
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

      const w_s = Math.pow(1 - lum, 2);
      const w_h = Math.pow(lum, 2);
      const w_m = Math.max(0, 1 - w_s - w_h);

      const dr = sOff.r * w_s + mOff.r * w_m + hOff.r * w_h;
      const dg = sOff.g * w_s + mOff.g * w_m + hOff.g * w_h;
      const db = sOff.b * w_s + mOff.b * w_m + hOff.b * w_h;

      data[i] = Math.min(255, Math.max(0, (r / 255 + dr) * 255));
      data[i + 1] = Math.min(255, Math.max(0, (g / 255 + dg) * 255));
      data[i + 2] = Math.min(255, Math.max(0, (b / 255 + db) * 255));
    }

    oCtx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Color grading wheels calculation error:', e);
  }
}
