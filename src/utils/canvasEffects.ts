import { applyLutToCanvas } from './lutParser';
import type { ClipParticleSettings } from '@/types';

// Image cache – shared across renders, keyed by mediaId.
const MAX_CACHE_SIZE = 50;
export const imageCache = new Map<string, HTMLImageElement>();
export const imageLoading = new Set<string>();

let _blurBufA: Float32Array | null = null;
let _blurBufB: Float32Array | null = null;
let _blurCapacity = 0;

function ensureBlurBuffers(width: number, height: number): void {
  const needed = width * height;
  if (_blurCapacity < needed) {
    _blurBufA = new Float32Array(needed);
    _blurBufB = new Float32Array(needed);
    _blurCapacity = needed;
  }
}

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
  D: number = 800,
  flipH: boolean = false,
  flipV: boolean = false
): LocalCornerPoints {
  const radX = (rx * Math.PI) / 180;
  const radY = (ry * Math.PI) / 180;
  const radZ = (rz * Math.PI) / 180;

  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  const halfW = w / 2;
  const halfH = h / 2;

  // 4 corners of standard flat rectangle (mirrored if flipH / flipV is active)
  const mulX = flipH ? -1 : 1;
  const mulY = flipV ? -1 : 1;
  const localPts = [
    { x: -halfW * mulX, y: -halfH * mulY }, // TL
    { x: halfW * mulX, y: -halfH * mulY },  // TR
    { x: halfW * mulX, y: halfH * mulY },   // BR
    { x: -halfW * mulX, y: halfH * mulY }    // BL
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

    // 5. Perspective Projection with safeguard against divide-by-zero or points behind camera
    const safeD = Math.max(10, D - z2);
    const scaleFactor = D / safeD;
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
  | 'smoke' | 'bubbles' | 'leaves' | 'hearts' | 'matrix' | 'paper_pieces';

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
  if (ps.type === 'paper_pieces') {
    vx = (Math.random() - 0.5) * turbulence * 2 + (ps.wind / 100);
    vy = baseSpeed * (0.2 + Math.random() * 0.5);
    return { x: px, y: -20, vx, vy, life: 1, maxLife: baseLife, size: baseSize * 2, color, rotation: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.3, type: ps.type };
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
    case 'paper_pieces': {
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      const s = p.size;
      ctx.moveTo(-s, -s*0.8);
      ctx.lineTo(s*0.8, -s);
      ctx.lineTo(s, s*0.9);
      ctx.lineTo(-s*0.9, s);
      ctx.closePath();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.shadowColor = 'transparent';
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

function parseChromaHex(hexStr: string): [number, number, number] {
  let hex = (hexStr || '#00ff00').replace('#', '').trim();
  if (hex.length === 3 || hex.length === 4) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [
    isNaN(r) ? 0 : r,
    isNaN(g) ? 255 : g,
    isNaN(b) ? 0 : b,
  ];
}

export function applyChromaKeyOnData(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  keyColorHex: string,
  threshold: number,
  softness: number,
  spillSuppression: number = 0,
  edgeFeather: number = 0
) {
  try {
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const [kr, kg, kb] = parseChromaHex(keyColorHex);

    const ku = -0.1687 * kr - 0.3313 * kg + 0.5 * kb + 128;
    const kv = 0.5 * kr - 0.4187 * kg - 0.0813 * kb + 128;

    const th = Math.max(0, threshold) * 2.4; 
    const soft = Math.max(0, softness) * 2.4;

    // Determine key color type for spill suppression
    const isGreenScreen = kg >= kr && kg >= kb;
    const isBlueScreen = kb >= kr && kb >= kg;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const u = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
      const v = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

      const dist = Math.sqrt((u - ku) ** 2 + (v - kv) ** 2);

      // ─── Alpha Matte ───────────────────────────────────
      let alpha = 1.0;
      if (dist < th) {
        alpha = 0;
      } else if (dist < th + soft && soft > 0) {
        alpha = (dist - th) / soft;
      }

      data[i + 3] = Math.round(alpha * a);

      // ─── Spill Suppression (Applied to fringe & boundary pixels) ──────
      if (spillSuppression > 0 && dist < th + soft + 30) {
        const factor = spillSuppression / 100;
        if (isGreenScreen) {
          const excess = Math.max(0, g - Math.max(r, b));
          if (excess > 0) {
            const gSpill = excess * factor;
            data[i + 1] = Math.max(0, Math.round(g - gSpill));
            data[i] = Math.min(255, Math.round(r + gSpill * 0.25));
            data[i + 2] = Math.min(255, Math.round(b + gSpill * 0.25));
          }
        } else if (isBlueScreen) {
          const excess = Math.max(0, b - Math.max(r, g));
          if (excess > 0) {
            const bSpill = excess * factor;
            data[i + 2] = Math.max(0, Math.round(b - bSpill));
            data[i] = Math.min(255, Math.round(r + bSpill * 0.25));
            data[i + 1] = Math.min(255, Math.round(g + bSpill * 0.25));
          }
        }
      }
    }

    // ─── Edge Feather ───────────────────────────────────
    if (edgeFeather > 0) {
      const radius = Math.max(1, Math.floor(edgeFeather));
      blurAlphaChannel(imgData, radius);
    }

    oCtx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.error('Failed to apply Chroma Key', err);
  }
}

/** Separable sliding-window box blur on alpha channel only */
function blurAlphaChannel(imageData: ImageData, radius: number): void {
  const { width: w, height: h, data } = imageData;
  if (w * h === 0) return;
  radius = Math.round(radius);
  if (radius <= 0) return;
  
  const maxRadius = Math.floor(Math.min(w, h) / 2);
  radius = Math.min(radius, maxRadius);
  
  ensureBlurBuffers(w, h);
  const alpha = _blurBufA!;
  const temp = _blurBufB!;

  for (let i = 0; i < w * h; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x <= radius; x++) {
      sum += alpha[y * w + x];
    }
    
    for (let x = 0; x < w; x++) {
      const left = Math.max(0, x - radius - 1);
      const right = Math.min(w - 1, x + radius);
      const count = right - left + 1;
      
      if (x > 0) {
        sum -= alpha[y * w + left];
        sum += alpha[y * w + right];
      }
      temp[y * w + x] = sum / count;
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= radius; y++) {
      sum += temp[y * w + x];
    }
    
    for (let y = 0; y < h; y++) {
      const top = Math.max(0, y - radius - 1);
      const bottom = Math.min(h - 1, y + radius);
      const count = bottom - top + 1;
      
      if (y > 0) {
        sum -= temp[top * w + x];
        sum += temp[bottom * w + x];
      }
      alpha[y * w + x] = sum / count;
    }
  }

  // Write back to image data
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 3] = Math.floor(alpha[i]);
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

export function applyFxEffect(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fxType: string,
  intensity: number,
  relTime: number,
  isPlaying: boolean,
  fxSettings?: import('@/types').ClipFxSettings
) {
  const norm = intensity / 100;
  try {
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    switch (fxType) {
      case 'continuous_mirror':
      case 'rhythmic_mirror': {
        const interval = Math.max(0.05, fxSettings?.flipInterval || 0.5);
        const cycleIdx = Math.floor(relTime / interval);
        const axis = fxSettings?.flipAxis || 'horizontal';
        const isFlipped = (cycleIdx % 2 === 1);
        const mode = fxSettings?.mirrorMode || 'flip';

        let flipH = false;
        let flipV = false;
        if (axis === 'horizontal') {
          flipH = isFlipped;
        } else if (axis === 'vertical') {
          flipV = isFlipped;
        } else if (axis === 'both') {
          flipH = isFlipped;
          flipV = isFlipped;
        } else if (axis === 'alternate') {
          flipH = isFlipped;
          flipV = (Math.floor(cycleIdx / 2) % 2 === 1);
        }

        if (mode === 'symmetric') {
          // Alternating symmetry: left mirrors right vs right mirrors left
          const halfW = Math.floor(w / 2);
          const tmp = new Uint8ClampedArray(data);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < halfW; x++) {
              const leftIdx = (y * w + x) * 4;
              const rightIdx = (y * w + (w - 1 - x)) * 4;
              if (isFlipped) {
                data[leftIdx] = tmp[rightIdx];
                data[leftIdx + 1] = tmp[rightIdx + 1];
                data[leftIdx + 2] = tmp[rightIdx + 2];
                data[leftIdx + 3] = tmp[rightIdx + 3];
              } else {
                data[rightIdx] = tmp[leftIdx];
                data[rightIdx + 1] = tmp[leftIdx + 1];
                data[rightIdx + 2] = tmp[leftIdx + 2];
                data[rightIdx + 3] = tmp[leftIdx + 3];
              }
            }
          }
        } else {
          // Full frame flip
          if (flipH || flipV) {
            const tmp = new Uint8ClampedArray(data);
            for (let y = 0; y < h; y++) {
              const srcY = flipV ? (h - 1 - y) : y;
              for (let x = 0; x < w; x++) {
                const srcX = flipH ? (w - 1 - x) : x;
                const dstIdx = (y * w + x) * 4;
                const srcIdx = (srcY * w + srcX) * 4;
                data[dstIdx] = tmp[srcIdx];
                data[dstIdx + 1] = tmp[srcIdx + 1];
                data[dstIdx + 2] = tmp[srcIdx + 2];
                data[dstIdx + 3] = tmp[srcIdx + 3];
              }
            }
          }
        }

        // Impact flash on each flip cycle (first 60ms)
        if (fxSettings?.impactFlash !== false) {
          const timeInCycle = relTime - (cycleIdx * interval);
          if (timeInCycle >= 0 && timeInCycle < 0.07) {
            const flashAlpha = (1 - (timeInCycle / 0.07)) * 0.45 * norm;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, data[i] + 255 * flashAlpha);
              data[i + 1] = Math.min(255, data[i + 1] + 255 * flashAlpha);
              data[i + 2] = Math.min(255, data[i + 2] + 255 * flashAlpha);
            }
          }
        }
        break;
      }
      case 'action_shake': {
        const shakeIntensity = (intensity || 50) / 100;
        const seed = Math.sin(relTime * 12.9898) * 43758.5453;
        const pseudoRand = seed - Math.floor(seed);
        const shiftX = Math.round((Math.sin(relTime * 45) * 14 + (pseudoRand - 0.5) * 12) * shakeIntensity);
        const shiftY = Math.round((Math.cos(relTime * 55) * 14 + (pseudoRand - 0.5) * 12) * shakeIntensity);
        const tmp = new Uint8ClampedArray(data);
        for (let y = 0; y < h; y++) {
          const sy = Math.min(h - 1, Math.max(0, y + shiftY));
          for (let x = 0; x < w; x++) {
            const sx = Math.min(w - 1, Math.max(0, x + shiftX));
            const redSx = Math.min(w - 1, Math.max(0, sx + Math.round(4 * shakeIntensity)));
            const blueSx = Math.min(w - 1, Math.max(0, sx - Math.round(4 * shakeIntensity)));
            const dst = (y * w + x) * 4;
            data[dst] = tmp[(sy * w + redSx) * 4];
            data[dst + 1] = tmp[(sy * w + sx) * 4 + 1];
            data[dst + 2] = tmp[(sy * w + blueSx) * 4 + 2];
          }
        }
        break;
      }
      case 'action_zoom_pulse': {
        const speed = fxSettings?.pulseSpeed || 2;
        const depth = ((fxSettings?.pulseDepth || 20) / 100) * norm;
        const scale = 1 + Math.max(0, Math.sin(relTime * Math.PI * 2 * speed)) * depth;
        if (scale > 1.001) {
          const tmp = new Uint8ClampedArray(data);
          const cx = w / 2;
          const cy = h / 2;
          for (let y = 0; y < h; y++) {
            const sy = Math.min(h - 1, Math.max(0, Math.round(cy + (y - cy) / scale)));
            for (let x = 0; x < w; x++) {
              const sx = Math.min(w - 1, Math.max(0, Math.round(cx + (x - cx) / scale)));
              const dst = (y * w + x) * 4;
              const src = (sy * w + sx) * 4;
              data[dst] = tmp[src];
              data[dst + 1] = tmp[src + 1];
              data[dst + 2] = tmp[src + 2];
              data[dst + 3] = tmp[src + 3];
            }
          }
        }
        break;
      }
      case 'action_strobe': {
        const speed = fxSettings?.strobeSpeed || 8;
        const wave = Math.sin(relTime * Math.PI * 2 * speed);
        if (wave > 0.3) {
          const strobeAlpha = 0.6 * norm;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + 255 * strobeAlpha);
            data[i + 1] = Math.min(255, data[i + 1] + 255 * strobeAlpha);
            data[i + 2] = Math.min(255, data[i + 2] + 255 * strobeAlpha);
          }
        }
        break;
      }
      case 'vfx_breakdown': {
        // Cinematic before/after split wipe reveal with neon boundary line
        const cyclePeriod = 4.0;
        const sweepProgress = (Math.sin((relTime / cyclePeriod) * Math.PI * 2) + 1) / 2;
        const splitX = Math.floor(w * (0.15 + 0.7 * sweepProgress));
        
        // Left side of split: desaturated high-contrast cool VFX look
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let x = 0; x < splitX; x++) {
            const i = (row + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            data[i] = Math.min(255, (luma * 0.7 + r * 0.3) * 0.9);
            data[i + 1] = Math.min(255, (luma * 0.8 + g * 0.2) * 1.05 + 10);
            data[i + 2] = Math.min(255, (luma * 0.9 + b * 0.1) * 1.15 + 20);
          }
        }
        
        // Glowing cyan/white vertical boundary divider line
        const lineW = 2;
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let lx = -lineW; lx <= lineW; lx++) {
            const px = splitX + lx;
            if (px >= 0 && px < w) {
              const i = (row + px) * 4;
              const glow = 1 - Math.abs(lx) / (lineW + 1);
              data[i] = Math.min(255, data[i] + 180 * glow);
              data[i + 1] = Math.min(255, data[i + 1] + 240 * glow);
              data[i + 2] = Math.min(255, data[i + 2] + 255 * glow);
            }
          }
        }
        break;
      }
      case 'style_anime': {
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i], g = data[i + 1], b = data[i + 2];
          r = ((r / 255 - 0.5) * 1.3 + 0.5) * 255;
          g = ((g / 255 - 0.5) * 1.3 + 0.5) * 255;
          b = ((b / 255 - 0.5) * 1.3 + 0.5) * 255;
          r = Math.floor(r / 32) * 32;
          g = Math.floor(g / 32) * 32;
          b = Math.floor(b / 32) * 32;
          data[i] = Math.min(255, Math.max(0, r));
          data[i + 1] = Math.min(255, Math.max(0, g));
          data[i + 2] = Math.min(255, Math.max(0, b));
        }
        break;
      }
      case 'style_watercolor': {
        const tmp = new Uint8ClampedArray(data);
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            const nx = x + (Math.random() < 0.5 ? -1 : 1);
            const ny = y + (Math.random() < 0.5 ? -1 : 1);
            const ni = (ny * w + nx) * 4;
            data[i] = Math.min(255, (tmp[i] * 0.7 + tmp[ni] * 0.3) + 15);
            data[i+1] = Math.min(255, (tmp[i+1] * 0.7 + tmp[ni+1] * 0.3) + 15);
            data[i+2] = Math.min(255, (tmp[i+2] * 0.7 + tmp[ni+2] * 0.3) + 15);
          }
        }
        break;
      }
      case 'style_papercut': {
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i], g = data[i + 1], b = data[i + 2];
          r = Math.round(r / 64) * 64;
          g = Math.round(g / 64) * 64;
          b = Math.round(b / 64) * 64;
          data[i] = Math.min(255, r);
          data[i + 1] = Math.min(255, g);
          data[i + 2] = Math.min(255, b);
        }
        break;
      }
      case 'bw_to_color': {
        const cyclePeriod = 3.5;
        const sweepProgress = Math.min(1, Math.max(0, (relTime % cyclePeriod) / (cyclePeriod * 0.75)));
        const splitX = Math.floor(w * sweepProgress);
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let x = splitX; x < w; x++) {
            const i = (row + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            data[i] = luma * norm + r * (1 - norm);
            data[i + 1] = luma * norm + g * (1 - norm);
            data[i + 2] = luma * norm + b * (1 - norm);
          }
        }
        if (splitX > 2 && splitX < w - 2) {
          for (let y = 0; y < h; y++) {
            const row = y * w;
            for (let lx = -2; lx <= 2; lx++) {
              const px = splitX + lx;
              if (px >= 0 && px < w) {
                const i = (row + px) * 4;
                const glow = 1 - Math.abs(lx) / 3;
                data[i] = Math.min(255, data[i] + 255 * glow * norm);
                data[i + 1] = Math.min(255, data[i + 1] + 200 * glow * norm);
                data[i + 2] = Math.min(255, data[i + 2] + 100 * glow * norm);
              }
            }
          }
        }
        break;
      }
      case 'glitch': {
        const numBands = fxSettings?.glitchBands || 20;
        const speed = fxSettings?.glitchSpeed || 12;
        const bandH = Math.max(2, Math.floor(h / numBands));
        const shiftBase = Math.sin(relTime * speed) * 22 * norm;
        const chromaticOffset = Math.round(fxSettings?.rgbSplitDistance ?? (6 * norm));
        const tmp = new Uint8ClampedArray(data);
        for (let b = 0; b < numBands; b++) {
          if (Math.random() < 0.25) continue;
          const y0 = b * bandH;
          const bandShift = Math.round(shiftBase * ((b % 3 === 0 ? 1.5 : -1) * (0.6 + (Math.sin(b + relTime * 5) * 0.4))));
          for (let y = y0; y < y0 + bandH && y < h; y++) {
            for (let x = 0; x < w; x++) {
              const sx = (x + bandShift + w) % w;
              const i = (y * w + x) * 4;
              const si = (y * w + sx) * 4;
              const rIdx = (y * w + ((sx - chromaticOffset + w) % w)) * 4;
              const bIdx = (y * w + ((sx + chromaticOffset) % w)) * 4;
              data[i] = tmp[rIdx];
              data[i + 1] = tmp[si + 1];
              data[i + 2] = tmp[bIdx + 2];
            }
          }
        }
        break;
      }
      case 'old_film': {
        const grain = 30 * norm;
        const sepia = 0.3 * norm;
        const flicker = 1 + (Math.sin(relTime * 8) * 0.05 * norm);
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * grain;
          let r = data[i], g = data[i + 1], b = data[i + 2];
          r = (r * (1 - sepia) + r * 0.393 + g * 0.769 + b * 0.189) * flicker + noise;
          g = (g * (1 - sepia) + r * 0.349 + g * 0.686 + b * 0.168) * flicker + noise;
          b = (b * (1 - sepia) + r * 0.272 + g * 0.534 + b * 0.131) * flicker + noise;
          data[i] = Math.min(255, Math.max(0, r));
          data[i + 1] = Math.min(255, Math.max(0, g));
          data[i + 2] = Math.min(255, Math.max(0, b));
        }
        break;
      }
      case 'vhs': {
        const scanH = 2;
        const noise = 25 * norm;
        for (let y = 0; y < h; y += scanH * 2) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = (Math.random() - 0.5) * noise;
            data[i] = Math.min(255, Math.max(0, data[i] + n));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
          }
        }
        const split = 3 * norm;
        const tmp = new Uint8ClampedArray(data);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const sx = Math.min(w - 1, Math.max(0, Math.floor(x - split)));
            const ex = Math.min(w - 1, Math.max(0, Math.floor(x + split)));
            const i = (y * w + x) * 4;
            data[i] = tmp[(y * w + sx) * 4];
            data[i + 2] = tmp[(y * w + ex) * 4 + 2];
          }
        }
        break;
      }
      case 'cinematic_bars': {
        let barRatio = 0.107;
        if (fxSettings?.barRatio === '2.35:1') barRatio = 0.10;
        else if (fxSettings?.barRatio === '4:3') barRatio = 0.15;
        else if (fxSettings?.barRatio === '1:1') barRatio = 0.22;
        const barH = Math.floor(h * barRatio * norm);
        for (let x = 0; x < w; x++) {
          for (let y = 0; y < barH; y++) {
            const i = (y * w + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
            const i2 = ((h - 1 - y) * w + x) * 4;
            data[i2] = data[i2 + 1] = data[i2 + 2] = 0;
          }
        }
        break;
      }
      case 'neon_glow': {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luma > 128) {
            data[i] = Math.min(255, r + (255 - r) * 0.6 * norm);
            data[i + 1] = Math.min(255, g + (255 - g) * 0.5 * norm);
            data[i + 2] = Math.min(255, b + (255 - b) * 0.7 * norm);
          }
        }
        break;
      }
      case 'rgb_split': {
        const split = Math.round(fxSettings?.rgbSplitDistance ?? (6 * norm));
        const tmp = new Uint8ClampedArray(data);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const sx = Math.min(w - 1, Math.max(0, Math.floor(x - split)));
            const ex = Math.min(w - 1, Math.max(0, Math.floor(x + split)));
            const i = (y * w + x) * 4;
            data[i] = tmp[(y * w + sx) * 4];
            data[i + 2] = tmp[(y * w + ex) * 4 + 2];
          }
        }
        break;
      }
      case 'pixelate': {
        const blocks = Math.max(2, Math.floor(40 / (norm + 0.1)));
        const bw = Math.floor(w / blocks);
        const bh = Math.floor(h / blocks);
        for (let by = 0; by < bh; by++) {
          for (let bx = 0; bx < bw; bx++) {
            let sr = 0, sg = 0, sb = 0, sa = 0, count = 0;
            for (let y = by * blocks; y < (by + 1) * blocks && y < h; y++) {
              for (let x = bx * blocks; x < (bx + 1) * blocks && x < w; x++) {
                const i = (y * w + x) * 4;
                sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; sa += data[i + 3];
                count++;
              }
            }
            if (count === 0) continue;
            const ar = sr / count, ag = sg / count, ab = sb / count, aa = sa / count;
            for (let y = by * blocks; y < (by + 1) * blocks && y < h; y++) {
              for (let x = bx * blocks; x < (bx + 1) * blocks && x < w; x++) {
                const i = (y * w + x) * 4;
                data[i] = ar; data[i + 1] = ag; data[i + 2] = ab; data[i + 3] = aa;
              }
            }
          }
        }
        break;
      }
      case 'mirror': {
        const style = fxSettings?.mirrorStyle || 'left_to_right';
        const tmp = new Uint8ClampedArray(data);
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);

        if (style === 'right_to_left') {
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < halfW; x++) {
              const leftIdx = (y * w + x) * 4;
              const rightIdx = (y * w + (w - 1 - x)) * 4;
              data[leftIdx] = tmp[rightIdx];
              data[leftIdx + 1] = tmp[rightIdx + 1];
              data[leftIdx + 2] = tmp[rightIdx + 2];
              data[leftIdx + 3] = tmp[rightIdx + 3];
            }
          }
        } else if (style === 'top_to_bottom') {
          for (let y = 0; y < halfH; y++) {
            for (let x = 0; x < w; x++) {
              const topIdx = (y * w + x) * 4;
              const bottomIdx = ((h - 1 - y) * w + x) * 4;
              data[bottomIdx] = tmp[topIdx];
              data[bottomIdx + 1] = tmp[topIdx + 1];
              data[bottomIdx + 2] = tmp[topIdx + 2];
              data[bottomIdx + 3] = tmp[topIdx + 3];
            }
          }
        } else if (style === 'bottom_to_top') {
          for (let y = 0; y < halfH; y++) {
            for (let x = 0; x < w; x++) {
              const topIdx = (y * w + x) * 4;
              const bottomIdx = ((h - 1 - y) * w + x) * 4;
              data[topIdx] = tmp[bottomIdx];
              data[topIdx + 1] = tmp[bottomIdx + 1];
              data[topIdx + 2] = tmp[bottomIdx + 2];
              data[topIdx + 3] = tmp[bottomIdx + 3];
            }
          }
        } else if (style === 'quad') {
          for (let y = 0; y < halfH; y++) {
            for (let x = 0; x < halfW; x++) {
              const i = (y * w + x) * 4;
              for (let q = 0; q < 4; q++) {
                const rx = q === 1 || q === 3 ? w - 1 - x : x;
                const ry = q === 2 || q === 3 ? h - 1 - y : y;
                const oi = (ry * w + rx) * 4;
                data[oi] = tmp[i];
                data[oi + 1] = tmp[i + 1];
                data[oi + 2] = tmp[i + 2];
                data[oi + 3] = tmp[i + 3];
              }
            }
          }
        } else {
          // Default: left_to_right
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < halfW; x++) {
              const i = (y * w + x) * 4;
              const mi = (y * w + (w - 1 - x)) * 4;
              data[mi] = data[i];
              data[mi + 1] = data[i + 1];
              data[mi + 2] = data[i + 2];
              data[mi + 3] = data[i + 3];
            }
          }
        }
        break;
      }
      case 'zoom_blur': {
        const cx = w / 2, cy = h / 2;
        const strength = 0.08 * norm;
        if (strength > 0.001) {
          const tmp = new Uint8ClampedArray(data);
          const samples = 5;
          for (let y = 0; y < h; y++) {
            const dy = y - cy;
            const rowIdx = y * w;
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              let sr = 0, sg = 0, sb = 0;
              for (let s = 0; s < samples; s++) {
                const factor = 1 - (s / (samples - 1)) * strength;
                const sx = Math.min(w - 1, Math.max(0, Math.round(cx + dx * factor)));
                const sy = Math.min(h - 1, Math.max(0, Math.round(cy + dy * factor)));
                const srcIdx = (sy * w + sx) * 4;
                sr += tmp[srcIdx];
                sg += tmp[srcIdx + 1];
                sb += tmp[srcIdx + 2];
              }
              const dstIdx = (rowIdx + x) * 4;
              data[dstIdx] = sr / samples;
              data[dstIdx + 1] = sg / samples;
              data[dstIdx + 2] = sb / samples;
            }
          }
        }
        break;
      }
      case 'subject_outline_flash': {
        const speed = fxSettings?.strobeSpeed || 8;
        const strokeW = Math.max(1, Math.round((fxSettings?.outlineWidth || 3) * norm));
        const colorHex = fxSettings?.outlineColor || '#00f0ff';
        let cr = 0, cg = 240, cb = 255;
        if (colorHex.startsWith('#') && colorHex.length >= 7) {
          cr = parseInt(colorHex.slice(1, 3), 16) || 0;
          cg = parseInt(colorHex.slice(3, 5), 16) || 240;
          cb = parseInt(colorHex.slice(5, 7), 16) || 255;
        }
        const strobeWave = Math.sin(relTime * Math.PI * 2 * speed);
        const flashIntensity = (0.5 + 0.5 * Math.abs(strobeWave)) * norm;
        const tmp = new Uint8ClampedArray(data);
        const step = strokeW;
        for (let y = step; y < h - step; y += 2) {
          const row = y * w;
          for (let x = step; x < w - step; x += 2) {
            const idx = (row + x) * 4;
            const rightIdx = (row + (x + step)) * 4;
            const downIdx = ((y + step) * w + x) * 4;
            const diffX = Math.abs(tmp[idx] - tmp[rightIdx]) +
                          Math.abs(tmp[idx + 1] - tmp[rightIdx + 1]) +
                          Math.abs(tmp[idx + 2] - tmp[rightIdx + 2]);
            const diffY = Math.abs(tmp[idx] - tmp[downIdx]) +
                          Math.abs(tmp[idx + 1] - tmp[downIdx + 1]) +
                          Math.abs(tmp[idx + 2] - tmp[downIdx + 2]);
            const edgeVal = (diffX + diffY) / 6;
            if (edgeVal > 22) {
              const edgeAlpha = Math.min(1, (edgeVal / 70)) * flashIntensity;
              for (let oy = 0; oy <= 1 && y + oy < h; oy++) {
                for (let ox = 0; ox <= 1 && x + ox < w; ox++) {
                  const targetIdx = ((y + oy) * w + (x + ox)) * 4;
                  data[targetIdx] = Math.min(255, data[targetIdx] * (1 - edgeAlpha) + cr * edgeAlpha + 35 * flashIntensity);
                  data[targetIdx + 1] = Math.min(255, data[targetIdx + 1] * (1 - edgeAlpha) + cg * edgeAlpha + 35 * flashIntensity);
                  data[targetIdx + 2] = Math.min(255, data[targetIdx + 2] * (1 - edgeAlpha) + cb * edgeAlpha + 35 * flashIntensity);
                }
              }
            }
          }
        }
        break;
      }
      case 'lens_flare': {
        const cx = w * 0.7, cy = h * 0.3;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const flare = Math.max(0, 1 - dist / (w * 0.5)) * 0.7 * norm;
            const i = (y * w + x) * 4;
            data[i] = Math.min(255, data[i] + 255 * flare);
            data[i + 1] = Math.min(255, data[i + 1] + 220 * flare);
            data[i + 2] = Math.min(255, data[i + 2] + 150 * flare);
          }
        }
        break;
      }
      case 'night_vision': {
        for (let i = 0; i < data.length; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const boost = Math.min(255, luma * 2.5);
          data[i] = boost * 0.1;
          data[i + 1] = boost;
          data[i + 2] = boost * 0.1;
        }
        break;
      }
      case 'thermal': {
        for (let i = 0; i < data.length; i += 4) {
          const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          data[i] = luma < 0.33 ? 0 : luma < 0.66 ? 255 * (luma - 0.33) * 3 : 255;
          data[i + 1] = luma < 0.33 ? 255 * luma * 3 : luma < 0.66 ? 255 : 255 * (1 - (luma - 0.66) * 3);
          data[i + 2] = luma < 0.33 ? 255 * luma * 3 : 0;
        }
        break;
      }
      case 'posterize': {
        const levels = Math.max(2, Math.floor(8 - norm * 6));
        const step = 255 / (levels - 1);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.round(data[i] / step) * step;
          data[i + 1] = Math.round(data[i + 1] / step) * step;
          data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
        break;
      }
      case 'dreamy_blur': {
        const tmp = new Uint8ClampedArray(data);
        const blurRadius = Math.max(1, Math.round(4 * norm));
        const hBuf = new Uint8ClampedArray(data.length);
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let x = 0; x < w; x++) {
            let sr = 0, sg = 0, sb = 0, count = 0;
            for (let dx = -blurRadius; dx <= blurRadius; dx += 2) {
              const nx = x + dx;
              if (nx >= 0 && nx < w) {
                const idx = (row + nx) * 4;
                sr += tmp[idx]; sg += tmp[idx + 1]; sb += tmp[idx + 2];
                count++;
              }
            }
            const dst = (row + x) * 4;
            hBuf[dst] = sr / count;
            hBuf[dst + 1] = sg / count;
            hBuf[dst + 2] = sb / count;
          }
        }
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let x = 0; x < w; x++) {
            let sr = 0, sg = 0, sb = 0, count = 0;
            for (let dy = -blurRadius; dy <= blurRadius; dy += 2) {
              const ny = y + dy;
              if (ny >= 0 && ny < h) {
                const idx = (ny * w + x) * 4;
                sr += hBuf[idx]; sg += hBuf[idx + 1]; sb += hBuf[idx + 2];
                count++;
              }
            }
            const dst = (row + x) * 4;
            const br = sr / count;
            const bg = sg / count;
            const bb = sb / count;
            data[dst] = Math.min(255, tmp[dst] * 0.6 + br * 0.4 + (br > 130 ? 25 * norm : 0));
            data[dst + 1] = Math.min(255, tmp[dst + 1] * 0.6 + bg * 0.4 + (bg > 130 ? 20 * norm : 0));
            data[dst + 2] = Math.min(255, tmp[dst + 2] * 0.6 + bb * 0.4 + (bb > 130 ? 30 * norm : 0));
          }
        }
        break;
      }
      case 'fisheye': {
        const cx = w / 2, cy = h / 2;
        const maxR = Math.min(cx, cy);
        const strength = 0.4 * norm;
        const tmp = new Uint8ClampedArray(data);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dx = x - cx, dy = y - cy;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r > maxR) continue;
            const theta = Math.atan2(dy, dx);
            const newR = maxR * Math.pow(r / maxR, 1 - strength);
            const sx = Math.floor(cx + Math.cos(theta) * newR);
            const sy = Math.floor(cy + Math.sin(theta) * newR);
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const i = (y * w + x) * 4;
              const si = (sy * w + sx) * 4;
              data[i] = tmp[si];
              data[i + 1] = tmp[si + 1];
              data[i + 2] = tmp[si + 2];
            }
          }
        }
        break;
      }
      case 'vignette_burn': {
        const cx = w / 2, cy = h / 2;
        const maxR = Math.sqrt(cx * cx + cy * cy);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const factor = Math.max(0, 1 - (r / maxR) * 1.5) * norm;
            const i = (y * w + x) * 4;
            data[i] = data[i] * factor;
            data[i + 1] = data[i + 1] * factor;
            data[i + 2] = data[i + 2] * factor;
          }
        }
        break;
      }
      case 'gameboy': {
        const palette = [15, 56, 99, 255];
        for (let i = 0; i < data.length; i += 4) {
          const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          const idx = luma < 0.25 ? 0 : luma < 0.5 ? 1 : luma < 0.75 ? 2 : 3;
          const v = palette[idx];
          data[i] = 0;
          data[i + 1] = v;
          data[i + 2] = v * 0.4;
        }
        break;
      }
      case 'quadrant_kaleidoscope': {
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const tmp = new Uint8ClampedArray(data);
        for (let y = 0; y < halfH; y++) {
          for (let x = 0; x < halfW; x++) {
            const i = (y * w + x) * 4;
            for (let q = 0; q < 4; q++) {
              const rx = q === 1 || q === 3 ? w - 1 - x : x;
              const ry = q === 2 || q === 3 ? h - 1 - y : y;
              const oi = (ry * w + rx) * 4;
              if (oi !== i) {
                data[oi] = tmp[i];
                data[oi + 1] = tmp[i + 1];
                data[oi + 2] = tmp[i + 2];
                data[oi + 3] = tmp[i + 3];
              }
            }
          }
        }
        break;
      }
    }

    oCtx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('FX effect error:', fxType, e);
  }
}
