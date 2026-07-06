import { applyAiBackgroundMask } from '../utils/aiBackground';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings2,
  Film,
  Camera,
  RotateCcw,
  Scissors,
  Grid,
  ExternalLink,
  X,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useMediaPlayback, FrameCacheEntry } from '@/hooks/useMediaPlayback';
import { getMediaTimeForClip } from '@/utils/speedRamp';
import { formatTime } from '@/utils/time';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ColorScopes } from './ColorScopes';
import { ThumbnailModal } from './ThumbnailModal';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { applyLutToCanvas } from '@/utils/lutParser';
import { drawSubscribeAnimation } from '@/utils/socialAnimations';

// ---------------------------------------------------------------------------
// Image cache – shared across renders, keyed by mediaId.
// Each entry holds the HTMLImageElement (or a loading promise so we don't
// Cache size limit (LRU strategy)
const MAX_CACHE_SIZE = 50;
const imageCache = new Map<string, HTMLImageElement>();
const imageLoading = new Set<string>();

export function clearPreviewCaches() {
  imageCache.clear();
  imageLoading.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('procut-evict-media-cache', ((e: CustomEvent) => {
    const id = e.detail?.id;
    if (id) {
      imageCache.delete(id);
      imageLoading.delete(id);
    }
  }) as EventListener);
}

function getCachedImage(
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
  img.crossOrigin = 'anonymous';
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

interface LocalCornerPoints {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
}

function getProjectedCorners(
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

function drawPerspectiveTexture(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  corners: LocalCornerPoints,
  gridCols: number = 8,
  gridRows: number = 8
) {
  const imgW = (img as any).videoWidth || (img as any).width || 854;
  const imgH = (img as any).videoHeight || (img as any).height || 480;

  // Bilinear interpolation mapping
  const getBilinearPoint = (u: number, v: number) => {
    const x = (1 - u) * (1 - v) * corners.x0 + u * (1 - v) * corners.x1 + u * v * corners.x2 + (1 - u) * v * corners.x3;
    const y = (1 - u) * (1 - v) * corners.y0 + u * (1 - v) * corners.y1 + u * v * corners.y2 + (1 - u) * v * corners.y3;
    return { x, y };
  };

  // Draw single affine-warped triangle
  const drawTriangle = (
    s0: { x: number; y: number },
    s1: { x: number; y: number },
    s2: { x: number; y: number },
    d0: { x: number; y: number },
    d1: { x: number; y: number },
    d2: { x: number; y: number }
  ) => {
    ctx.save();
    
    // Path clipping to current triangle cell
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    // Solve for affine transform coefficients
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

  // Render cells
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

// ---------------------------------------------------------------------------
// Particle system
// ---------------------------------------------------------------------------
type ParticleEffectType =
  | 'snow' | 'rain' | 'fire' | 'sparkles' | 'confetti'
  | 'smoke' | 'bubbles' | 'leaves' | 'hearts' | 'matrix';

interface Particle {
  x: number; y: number;    // current position (canvas px)
  vx: number; vy: number;  // velocity (px/frame at 60fps)
  life: number;            // 0..1 (1=newborn, 0=dead)
  maxLife: number;         // frames until dead
  size: number;            // base radius
  color: string;
  rotation: number;        // for leaves/confetti
  rotSpeed: number;
  char?: string;           // for matrix
  type: ParticleEffectType;
}

interface ParticlePool {
  particles: Particle[];
  lastEmit: number;        // timestamp of last emission
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function randomHue() {
  const hues = [0, 30, 60, 120, 180, 240, 270, 300];
  return hues[Math.floor(Math.random() * hues.length)];
}

function spawnParticle(
  ps: import('@/types').ClipParticleSettings,
  canvasW: number,
  canvasH: number,
): Particle {
  const ex = (ps.emitterX / 100) * canvasW;
  const ey = (ps.emitterY / 100) * canvasH;
  const spreadRad = (ps.spread / 2) * (Math.PI / 180);
  const baseSpeed = (ps.speed / 100) * 3; // px per frame at 60fps
  const baseSize  = (ps.size  / 100) * 5;
  const baseLife  = Math.round((ps.lifetime / 100) * 90); // frames
  const turbulence = (ps.turbulence / 100) * 2;

  // Direction based on gravity (down) + spread cone
  const gravDir = ps.gravity > 0 ? Math.PI / 2 : -Math.PI / 2;  // down or up
  const angle = gravDir + (Math.random() - 0.5) * 2 * spreadRad;
  const speed = baseSpeed * (0.5 + Math.random());
  let vx = Math.cos(angle) * speed + (ps.wind / 100) * 1.5;
  let vy = Math.sin(angle) * speed;

  // Position variance (spawn at emitter with small jitter)
  const jitter = baseSize * 2;
  const px = ex + (Math.random() - 0.5) * jitter * 4;
  const py = ey + (Math.random() - 0.5) * jitter;

  // Color
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

  // Type-specific overrides
  if (ps.type === 'rain') {
    // Rain always falls straight down from top
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

function drawParticleShape(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);

  switch (p.type) {
    case 'snow': {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      // optional snowflake arms at larger sizes
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
      // Teardrop shape
      ctx.moveTo(0, -r * 2);
      ctx.bezierCurveTo(r * 0.6, -r, r, r * 0.5, 0, r);
      ctx.bezierCurveTo(-r, r * 0.5, -r * 0.6, -r, 0, -r * 2);
      const fireHue = 10 + (1 - lifeN) * 40; // orange→yellow as it ages
      ctx.fillStyle = `hsl(${fireHue},100%,${50 + (1-lifeN)*20}%)`;
      ctx.fill();
      break;
    }
    case 'sparkles': {
      const r = p.size;
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      // 4-point star
      ctx.beginPath();
      for (let pt = 0; pt < 8; pt++) {
        const a = (pt * Math.PI) / 4;
        const dist = pt % 2 === 0 ? r : r * 0.4;
        pt === 0 ? ctx.moveTo(Math.cos(a)*dist, Math.sin(a)*dist) : ctx.lineTo(Math.cos(a)*dist, Math.sin(a)*dist);
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
      const r = p.size * (1 + (1 - p.life) * 2); // grows as it ages
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
      // Shine
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
      // Stem
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
      // Trail effect - lighter char above
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(p.char ?? '0', 0, -p.size);
      break;
    }
  }
  ctx.restore();
}

function renderParticles(
  ctx: CanvasRenderingContext2D,
  clipId: string,
  ps: import('@/types').ClipParticleSettings,
  W: number,
  H: number,
  deltaMs: number,
  particlePools: Map<string, ParticlePool>): void {
  let pool = particlePools.get(clipId);
  if (!pool) {
    pool = { particles: [], lastEmit: 0 };
    particlePools.set(clipId, pool);
  }

  const now = performance.now();
  const maxCount = ps.amount;

  // Rate-limited emission: only spawn particles when playing and active
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

  const dtScale = deltaMs / (1000 / 60); // normalize to 60fps
  const gravityAcc = (ps.gravity / 100) * 0.12 * dtScale;
  const windAcc    = (ps.wind    / 100) * 0.03 * dtScale;
  const turbStr    = (ps.turbulence / 100) * 0.08;
  const opacity    = (ps.intensity / 100);

  // Apply glow if needed
  if (ps.glow) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = ps.color === 'auto' ? '#ffffff' : ps.color;
  }

  // Update & draw
  pool.particles = pool.particles.filter((p) => {
    if (deltaMs > 0) {
      // Update physics
      p.vy += gravityAcc;
      p.vx += windAcc + (Math.random() - 0.5) * turbStr;
      p.x  += p.vx * dtScale;
      p.y  += p.vy * dtScale;
      p.rotation += p.rotSpeed * dtScale;
      p.life -= (1 / p.maxLife) * dtScale;
      p.life = Math.max(0, p.life);

      // Matrix: randomize char occasionally
      if (p.type === 'matrix' && Math.random() < 0.05) {
        const chars = '0123456789ABCDEF';
        p.char = chars[Math.floor(Math.random() * chars.length)];
      }
    }

    if (p.life <= 0) return false;

    // Clip to canvas bounds (remove if fully off-screen for non-cyclical types)
    if (p.x < -50 || p.x > W + 50 || p.y > H + 50) return false;

    // Draw
    const fadeIn  = p.life > 0.9 ? (1 - p.life) / 0.1 : 1;
    const fadeOut = p.life < 0.2 ? p.life / 0.2 : 1;
    const alpha = opacity * Math.min(fadeIn, fadeOut);
    drawParticleShape(ctx, p, alpha);
    return true;
  });

  // Reset glow
  if (ps.glow) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PreviewCanvas() {
  const particlePoolsRef = useRef<Map<string, ParticlePool>>(new Map());
  const {
    currentTime,
    isPlaying,
    totalDuration,
    isMuted,
    volume,
    togglePlayback,
    seek,
    setVolume,
    toggleMute,
    tracks,
    selectedClipId,
    selectedClipIds,
    selectClip,
    playbackSpeed,
    setPlaybackSpeed,
    playbackDirection,
    mediaLibrary,
    updateClip,
    canvasTransformMode,
    setCanvasTransformMode,
    setPreviewCanvas,
    activeTool,
    settings,
    aspectRatio,
    isExporting,
    exportWidth,
    exportHeight,
    showScopes,
    setShowScopes,
    showProgressBar,
    progressBarColor,
    progressBarHeight,
    useProxies,
  } = useEditorStore();

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const hasClips = tracks.some((t) => t.clips.length > 0);

  // Real video elements and frame cache for drawing frames
  const { videoElements, frameCache } = useMediaPlayback();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null); // Double-buffer canvas
  const glitchRedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glitchBlueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelateCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastParticleTimeRef = useRef<number | null>(null);
  // Cache the 2D contexts so we don't call getContext() every frame
  const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const mainCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Snapshot of last successfully rendered frame to prevent flash during scrubbing
  const lastFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Frame counter for throttling expensive operations
  const frameCounterRef = useRef(0);

  const getOrCreateCanvas = (ref: React.MutableRefObject<HTMLCanvasElement | null>, w: number, h: number) => {
    if (!ref.current) {
      ref.current = document.createElement('canvas');
    }
    // Only set dimensions when they actually change to avoid buffer reallocation
    if (Math.abs(ref.current.width - w) > 0.5) ref.current.width = Math.max(1, Math.round(w));
    if (Math.abs(ref.current.height - h) > 0.5) ref.current.height = Math.max(1, Math.round(h));
    return ref.current;
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  const [showGrid, setShowGrid] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('#0a0a0a');

  // Memoized allClips to avoid flatMap inside the 60fps loop
  const allClips = useMemo(() => tracks.flatMap((t) => t.clips), [tracks]);
  const allClipsRef = useRef(allClips);
  useEffect(() => {
    allClipsRef.current = allClips;
  }, [allClips]);

  // Clean up unused particle pools to prevent memory leaks
  useEffect(() => {
    const allClipIds = new Set(allClips.map((c) => c.id));
    for (const clipId of particlePoolsRef.current.keys()) {
        if (!allClipIds.has(clipId)) {
          particlePoolsRef.current.delete(clipId);
        }
      }
  }, [allClips]);
  
  // Hand tool panning state
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const [imageRevision, setImageRevision] = useState(0);
  const requestRedraw = useCallback(() => setImageRevision((r) => r + 1), []);
  
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Listen to frame update events from useMediaPlayback (like seek complete)
  useEffect(() => {
    const handleFrameUpdate = () => {
      // ONLY redraw if not playing! (During playback, requestAnimationFrame is already redrawing at 60 FPS)
      if (!useEditorStore.getState().isPlaying) {
        requestRedraw();
      }
    };
    window.addEventListener('procut-frame-updated', handleFrameUpdate);
    return () => window.removeEventListener('procut-frame-updated', handleFrameUpdate);
  }, [requestRedraw]);

  // Register canvas with store
  useEffect(() => {
    if (canvasRef.current) {
      setPreviewCanvas(canvasRef.current);
    }
  }, [setPreviewCanvas]);

  // Keep a mutable ref of currentTime so the playback loop effect doesn't tear down/setup on every frame
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
      // Synchronously catch external seeks to prevent race conditions
      return useEditorStore.subscribe(
        (state) => {
          if (!state.isPlaying) {
            currentTimeRef.current = state.currentTime;
          }
        }
      );
    }, []);
    
    // Fallback sync just in case
    useEffect(() => {
      if (!useEditorStore.getState().isPlaying) {
         currentTimeRef.current = currentTime;
      }
    }, [currentTime]);

  // -------------------------------------------------------------------
  // Playback loop – advance currentTime via rAF when playing
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();
    
    // Reset particle time tracking when playback starts to prevent jump
    lastParticleTimeRef.current = null;

    const loop = (now: number) => {
      const state = useEditorStore.getState();
      const dir = state.playbackDirection ?? 1;
      const speed = state.playbackSpeed;
      const currentSeek = state.seek;
      const currentPause = state.pause;
      const selectedIds = state.selectedClipIds;
      const allClips = allClipsRef.current;

      if (state.isExporting) {
        // Export Mode: Fixed timestep throttled to target export FPS
        const targetFps = state.exportFps || 30;
        const frameDuration = 1000 / targetFps; // ms per frame
        const elapsed = now - lastTime;

        if (elapsed >= frameDuration) {
          // Adjust lastTime by frameDuration to maintain precision
          lastTime = now - (elapsed % frameDuration);
          
          const dt = 1 / targetFps;
          const newTime = currentTimeRef.current + dt * speed * dir;

          // Capping at sequence end
          let maxEndSequence = 0;
          for (const c of allClips) {
            const end = c.startTime + c.duration;
            if (end > maxEndSequence) maxEndSequence = end;
          }

          if (dir >= 0 && newTime >= maxEndSequence) {
            currentSeek(maxEndSequence);
            currentTimeRef.current = maxEndSequence;
            currentPause();
            return;
          }

          if (dir < 0 && newTime <= 0) {
            currentSeek(0);
            currentTimeRef.current = 0;
            currentPause();
            return;
          }

          currentSeek(newTime);
          currentTimeRef.current = newTime;
        }
        animId = requestAnimationFrame(loop);
      } else {
        // Normal Playback Mode: Real-time clock delta
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        const newTime = currentTimeRef.current + dt * speed * dir;

        if (selectedIds.length > 0) {
          // Selection Loop Playback Mode
          const selectedClips = allClips.filter((c) => selectedIds.includes(c.id));
          if (selectedClips.length > 0) {
            let minStart = Infinity;
            let maxEnd = -Infinity;
            for (const c of selectedClips) {
              if (c.startTime < minStart) minStart = c.startTime;
              const end = c.startTime + c.duration;
              if (end > maxEnd) maxEnd = end;
            }

            if (newTime >= maxEnd || newTime < minStart) {
              const startPos = dir >= 0 ? minStart : maxEnd;
              currentSeek(startPos);
              currentTimeRef.current = startPos;
            } else {
              currentSeek(newTime);
              currentTimeRef.current = newTime;
            }
            animId = requestAnimationFrame(loop);
            return;
          }
        }

        // Default Playback Mode (Cap at sequence end)
        let maxEndSequence = 0;
        for (const c of allClips) {
          const end = c.startTime + c.duration;
          if (end > maxEndSequence) maxEndSequence = end;
        }

        if (dir < 0 && newTime <= 0) {
          currentSeek(0);
          currentTimeRef.current = 0;
          currentPause();
          return;
        }

        if (dir >= 0 && newTime >= maxEndSequence) {
          currentSeek(0);
          currentTimeRef.current = 0;
          currentPause();
          return;
        }

        currentSeek(newTime);
        currentTimeRef.current = newTime;
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // -------------------------------------------------------------------
  // Canvas rendering – called whenever time, tracks, or images change
  // -------------------------------------------------------------------
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Double buffering: render to offscreen composite canvas, then blit ──
    const composite = getOrCreateCanvas(compositeCanvasRef, canvas.width, canvas.height);
    // Use cached 2D context to avoid expensive getContext() call every frame
    if (!compositeCtxRef.current) {
      compositeCtxRef.current = composite.getContext('2d', { willReadFrequently: !settings.hardwareAcceleration }) || null;
    }
    if (!compositeCtxRef.current) return;
    const ctx = compositeCtxRef.current;
    // Only clear when canvas size changed or on explicit reset (rare)
    if (composite.width !== canvas.width || composite.height !== canvas.height) {
      composite.width = canvas.width;
      composite.height = canvas.height;
    }

    // Throttle expensive operations during scrubbing (env variable set)
    const skipExpensiveFX = !isPlaying;

    // Measure frame time delta for particles
    const now = performance.now();
    const lastTime = lastParticleTimeRef.current ?? now;
    lastParticleTimeRef.current = now;
    let rawDelta = 0;
    if (isPlaying && lastParticleTimeRef.current !== null) {
      rawDelta = now - lastTime;
      // If delta is unexpectedly large (e.g., after tab switch/resume), reset it
      if (rawDelta > 300) {
        rawDelta = 16.67; // assume normal frame
      }
    }
    const deltaMs = Math.min(100, rawDelta); // clamp to 100ms max to prevent physics jumps

    const W_target = 854;
    const H_target = 480;
    const canvas_scale = canvas.width / W_target;

    // ── Frame gate: during scrubbing, check if videos are ready or have cached frames ──
    // If a video is seeking AND we have no cached frame for it, retain the last frame.
    if (!isPlaying) {
      const allVideoTracks = tracks.filter((t) => t.type === 'video' && !t.hidden);
      let needsWait = false;
      for (const track of allVideoTracks) {
        for (const clip of track.clips) {
          if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
            const mi = mediaLibrary.find((m) => m.id === clip.mediaId);
            if (mi && mi.type === 'video') {
              const videoEl = videoElements.get(clip.id);
              if (videoEl && (videoEl.seeking || videoEl.readyState < 2)) {
                // Check if we have a cached frame close enough to use
                const clipCache = frameCache.get(clip.id);
                const mediaTime = getMediaTimeForClip({
                  id: clip.id, startTime: clip.startTime,
                  duration: clip.duration, trimStart: clip.trimStart,
                  speed: clip.speed, speedRamp: (clip as any).speedRamp
                }, currentTime);
                const roundedTime = Math.round(mediaTime * 30) / 30;
                const hasCached = clipCache?.some(f => Math.abs(f.time - roundedTime) < 0.05);
                if (!hasCached) {
                  needsWait = true;
                  break;
                }
              }
            }
          }
        }
        if (needsWait) break;
      }

      if (needsWait) {
        // No cached frame available — show the last good frame instead of flashing
        const mainCtx = canvas.getContext('2d');
        if (mainCtx && lastFrameCanvasRef.current && lastFrameCanvasRef.current.width > 0) {
          mainCtx.drawImage(lastFrameCanvasRef.current, 0, 0);
        }
        return;
      }
    }

    // 1. Clear to background color (entire composite canvas)
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, composite.width, composite.height);

    ctx.save();
    ctx.scale(canvas_scale, canvas_scale);

    let viewW = W_target;
    let viewH = H_target;
    if (aspectRatio === '9:16') {
      viewW = Math.round(H_target * (9 / 16));
    } else if (aspectRatio === '1:1') {
      viewW = H_target;
    } else if (aspectRatio === '4:3') {
      viewW = Math.round(H_target * (4 / 3));
    }
    const W = viewW;
    const H = viewH;
    const offsetX = (W_target - viewW) / 2;
    const offsetY = (H_target - viewH) / 2;

    const cx = W_target / 2;
    const cy = H_target / 2;
    const totalX = cx + viewport.x - cx * viewport.zoom;
    const totalY = cy + viewport.y - cy * viewport.zoom;

    ctx.save();
    ctx.translate(totalX, totalY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw active aspect ratio frame boundary (so user can see the workspace bounds)
    ctx.strokeStyle = '#3e3e3e';
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.strokeRect(offsetX, offsetY, viewW, viewH);

    // Clip rendering to the active aspect ratio frame
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, viewW, viewH);
    ctx.clip();

    ctx.translate(offsetX, offsetY);

    // 2. Checkerboard removed per user request

    // 3. Collect visual tracks (video first, then text on top)
    // Video tracks: lower index number = bottom layer
    // Text tracks always render on top of all video
    const videoTracks = tracks
      .filter((t) => t.type === 'video' && !t.hidden)
      .sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
    const textTracks = tracks.filter((t) => t.type === 'text' && !t.hidden);
    const visualTracks = [...videoTracks, ...textTracks];

    let anyClipDrawn = false;

    // Helper to apply masking
    const applyClipMask = (context: CanvasRenderingContext2D, mask: any, dx: number, dy: number, dw: number, dh: number) => {
      if (!mask || !mask.enabled) return;
      context.beginPath();
      if (mask.type === 'rectangle') {
        const mx = dx + (mask.x / 100) * dw - (mask.width / 100) * dw / 2;
        const my = dy + (mask.y / 100) * dh - (mask.height / 100) * dh / 2;
        const mw = (mask.width / 100) * dw;
        const mh = (mask.height / 100) * dh;
        context.rect(mx, my, mw, mh);
      } else if (mask.type === 'circle') {
        const mx = dx + (mask.x / 100) * dw;
        const my = dy + (mask.y / 100) * dh;
        const mr = (mask.width / 100) * Math.min(dw, dh) / 2;
        context.arc(mx, my, mr, 0, Math.PI * 2);
      } else if (mask.type === 'path' && mask.points?.length > 0) {
        mask.points.forEach((pt: any, i: number) => {
          const px = dx + (pt.x / 100) * dw;
          const py = dy + (pt.y / 100) * dh;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.closePath();
      }
      
      if (mask.invert) {
        context.rect(dx - 10000, dy - 10000, dw + 20000, dh + 20000);
        context.clip('evenodd');
      } else {
        context.clip();
      }
    };

    // Helper to draw a single clip with custom opacity/transform multipliers
    const drawSingleClip = async (
      clip: any,
      opacityMultiplier: number = 1,
      extraTransform?: { translateX?: number; translateY?: number; scale?: number }
    ) => {
      let mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
      if (!mediaItem) {
        if (clip.mediaId === 'text-placeholder' || clip.textSettings || clip.id?.startsWith('clip_subtitle') || clip.id?.startsWith('clip_typo')) {
          mediaItem = {
            id: clip.mediaId,
            name: 'Text',
            type: 'text',
            duration: clip.duration,
            url: '',
            createdAt: Date.now()
          };
        }
      }
      if (!mediaItem) return;

      // Get animated values
            let aOpacity = getAnimatedValue(clip.opacity, currentTime, clip.startTime, clip.animations?.['opacity']);
      
      const localTime = currentTime - clip.startTime;
      if (clip.transitionIn?.type === 'dissolve' && localTime < 1 && localTime >= 0) {
        aOpacity *= (localTime / 1);
      } else if (clip.transitionOut?.type === 'dissolve' && localTime > clip.duration - 1 && localTime <= clip.duration) {
        aOpacity *= ((clip.duration - localTime) / 1);
      }
      
      let slideX = 0;
      if (clip.transitionIn?.type === 'slide' && localTime < 1 && localTime >= 0) {
        slideX = (1 - (localTime / 1)) * -1000;
      } else if (clip.transitionOut?.type === 'slide' && localTime > clip.duration - 1 && localTime <= clip.duration) {
        slideX = ((localTime - (clip.duration - 1)) / 1) * 1000;
      }

      const aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
      const aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
      const aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
      const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

      const aCropTop = getAnimatedValue(clip.crop?.top || 0, currentTime, clip.startTime, clip.animations?.['crop.top']);
      const aCropBot = getAnimatedValue(clip.crop?.bottom || 0, currentTime, clip.startTime, clip.animations?.['crop.bottom']);
      const aCropLeft = getAnimatedValue(clip.crop?.left || 0, currentTime, clip.startTime, clip.animations?.['crop.left']);
      const aCropRight = getAnimatedValue(clip.crop?.right || 0, currentTime, clip.startTime, clip.animations?.['crop.right']);

      const aRotX = getAnimatedValue(clip.transform.rotationX ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationX']);
      const aRotY = getAnimatedValue(clip.transform.rotationY ?? 0, currentTime, clip.startTime, clip.animations?.['transform.rotationY']);

      const hasPerspectiveWarp = !!(clip.transform.perspectivePin || Math.abs(aRotX) > 0.01 || Math.abs(aRotY) > 0.01);

      // Set up transform
      ctx.save();
      ctx.globalAlpha = aOpacity * opacityMultiplier;
      ctx.globalCompositeOperation = clip.transform.blendMode || 'source-over';

      const cx = W / 2;
      const cy = H / 2;

      let corners: LocalCornerPoints | null = null;
      if (hasPerspectiveWarp) {
        if (clip.transform.perspectivePin) {
          const pc = clip.transform.perspectiveCorners || { x0: 0, y0: 0, x1: 854, y1: 0, x2: 854, y2: 480, x3: 0, y3: 480 };
          
          let trackedCorners = null;
          const trackingData = clip.transform.perspectiveTrackingData;
          if (trackingData && trackingData.length > 0) {
            // Find closest frame data
            const localTime = currentTime - clip.startTime;
            let closestDist = Infinity;
            for (const pt of trackingData) {
              const dist = Math.abs(pt.time - localTime);
              if (dist < closestDist) {
                closestDist = dist;
                trackedCorners = pt.corners;
              }
            }
          }

          if (trackedCorners) {
            corners = { ...trackedCorners };
          } else {
            corners = {
              x0: getAnimatedValue(pc.x0, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x0']),
              y0: getAnimatedValue(pc.y0, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y0']),
              x1: getAnimatedValue(pc.x1, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x1']),
              y1: getAnimatedValue(pc.y1, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y1']),
              x2: getAnimatedValue(pc.x2, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x2']),
              y2: getAnimatedValue(pc.y2, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y2']),
              x3: getAnimatedValue(pc.x3, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.x3']),
              y3: getAnimatedValue(pc.y3, currentTime, clip.startTime, clip.animations?.['transform.perspectiveCorners.y3']),
            };
          }
        } else {
          // Calculate projected corners from 3D rotation
          const vw = mediaItem.width || 854;
          const vh = mediaItem.height || 480;
          const fitScale = Math.min(W / vw, H / vh);
          corners = getProjectedCorners(
            vw, vh,
            (aScale / 100) * fitScale,
            aRotX, aRotY, aRot, // Z-rotation is aRot
            aX, aY,
            cx, cy
          );
        }
      }

      if (!hasPerspectiveWarp) {
        let tx = cx;
        let ty = cy;
        if (extraTransform?.translateX !== undefined) tx += extraTransform.translateX;
        if (extraTransform?.translateY !== undefined) ty += extraTransform.translateY;

        ctx.translate(tx, ty);
        ctx.translate(aX, aY);

        let finalScale = aScale / 100;
        if (extraTransform?.scale !== undefined) {
          finalScale *= extraTransform.scale;
        }
        ctx.scale(finalScale, finalScale);
        ctx.rotate((aRot * Math.PI) / 180);
      }

      // Dynamic filters using keyframe animations
      const filters = {
        temperature: getAnimatedValue(clip.colorFilters?.temperature ?? 0, currentTime, clip.startTime, clip.animations?.['color.temperature']),
        tint: getAnimatedValue(clip.colorFilters?.tint ?? 0, currentTime, clip.startTime, clip.animations?.['color.tint']),
        exposure: getAnimatedValue(clip.colorFilters?.exposure ?? 0, currentTime, clip.startTime, clip.animations?.['color.exposure']),
        contrast: getAnimatedValue(clip.colorFilters?.contrast ?? 100, currentTime, clip.startTime, clip.animations?.['color.contrast']),
        saturation: getAnimatedValue(clip.colorFilters?.saturation ?? 100, currentTime, clip.startTime, clip.animations?.['color.saturation']),
        blur: getAnimatedValue(clip.colorFilters?.blur ?? 0, currentTime, clip.startTime, clip.animations?.['color.blur']),
        fadedFilm: getAnimatedValue(clip.colorFilters?.fadedFilm ?? 0, currentTime, clip.startTime, clip.animations?.['color.fadedFilm']),
        vignette: getAnimatedValue(clip.colorFilters?.vignette ?? 0, currentTime, clip.startTime, clip.animations?.['color.vignette']),
        shadows: clip.colorFilters?.shadows,
        midtones: clip.colorFilters?.midtones,
        highlights: clip.colorFilters?.highlights,
      };

      // Check for active FX on the track this clip belongs to
      const fxTrack = tracks.find((t) => t.type === 'fx' && t.linkedTrackId === clip.trackId && !t.hidden);
      let activeFxClip: any = null;
      if (fxTrack) {
        activeFxClip = fxTrack.clips.find((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration) || null;
      }

      // Pre-process VFX Breakdown clip effect
      let vfxProgress = 0;
      if (activeFxClip && activeFxClip.fxSettings?.type === 'vfx_breakdown') {
         vfxProgress = (currentTime - activeFxClip.startTime) / activeFxClip.duration;
         vfxProgress = Math.max(0, Math.min(1, vfxProgress));
      }

      // ---------------------------------------------------------------
      // Draw the actual media content
      // ---------------------------------------------------------------
      let dw = W;
      let dh = H;
      let dx = -W / 2;
      let dy = -H / 2;
      let hasRealMedia = false;

      // Ensure crops are sanitized and don't sum up to >= 100% (which would yield 0 or negative width/height)
      let cTop = aCropTop / 100;
      let cBot = aCropBot / 100;
      let cLeft = aCropLeft / 100;
      let cRight = aCropRight / 100;

      if (cLeft + cRight >= 1.0) {
        const sum = cLeft + cRight;
        cLeft = (cLeft / sum) * 0.99;
        cRight = (cRight / sum) * 0.99;
      }
      if (cTop + cBot >= 1.0) {
        const sum = cTop + cBot;
        cTop = (cTop / sum) * 0.99;
        cBot = (cBot / sum) * 0.99;
      }

      // Sanitize filter properties to prevent NaN values from crashing canvas filter parser
      const exposure = Number.isFinite(filters.exposure) ? filters.exposure : 0;
      const contrast = Number.isFinite(filters.contrast) ? filters.contrast : 100;
      const saturation = Number.isFinite(filters.saturation) ? filters.saturation : 100;
      const blur = Number.isFinite(filters.blur) ? filters.blur : 0;

      const applyFxToContext = (
        oCtx: CanvasRenderingContext2D,
        w: number,
        h: number,
        fxClip: any
      ) => {
        const fx = fxClip.fxSettings;
        const dw = w;
        const dh = h;
        const pxW = w;
        const pxH = h;
        
        const rand = (n: number) => {
          const seed = Math.floor(currentTime * 30);
          return ((Math.sin(seed * 7.3 + n * 113.7) * 43758.5) % 1 + 1) % 1;
        };

        oCtx.save();
        
        if (fx?.type === 'vfx_breakdown') {
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.beginPath();
          oCtx.rect(-dw / 2, -dh / 2, dw * vfxProgress, dh);
          oCtx.clip();

          if (mediaItem.type === 'video') {
          if (useProxies) {
             ctx.save();
             ctx.setTransform(1,0,0,1,0,0);
             ctx.fillStyle = 'rgba(0,0,0,0.5)';
             ctx.fillRect(10, 10, 80, 30);
             ctx.fillStyle = '#10b981';
             ctx.font = '16px monospace';
             ctx.textAlign = 'left';
             ctx.textBaseline = 'top';
             ctx.fillText('[PROXY]', 15, 15);
             ctx.restore();
          }

            const videoEl = videoElements.get(clip.id);
            if (videoEl && videoEl.readyState >= 2) {
              const vw = videoEl.videoWidth || w;
              const vh = videoEl.videoHeight || h;
              const scale = Math.min(w / vw, h / vh);
              const baseDw = vw * scale;
              const baseDh = vh * scale;
              const sx = vw * cLeft;
              const sy = vh * cTop;
              const sw = Math.max(1, vw * (1 - cLeft - cRight));
              const sh = Math.max(1, vh * (1 - cTop - cBot));
              const drawW = Math.max(1, baseDw * (1 - cLeft - cRight));
              const drawH = Math.max(1, baseDh * (1 - cTop - cBot));
              const dx = -baseDw / 2 + baseDw * cLeft;
              const dy = -baseDh / 2 + baseDh * cTop;
              oCtx.filter = `brightness(${120 + exposure}%) contrast(150%) saturate(200%)`;
              oCtx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, drawW, drawH);
              oCtx.filter = 'none';
              applyColorOverlays(oCtx, dx, dy, drawW, drawH, { ...filters, contrast: 150, saturation: 200 });
            }
          }

          oCtx.beginPath();
          oCtx.moveTo(-dw / 2 + dw * vfxProgress, -dh / 2);
          oCtx.lineTo(-dw / 2 + dw * vfxProgress,  dh / 2);
          oCtx.lineWidth = 4;
          oCtx.strokeStyle = '#3b82f6';
          oCtx.shadowColor = '#3b82f6';
          oCtx.shadowBlur = 15;
          oCtx.stroke();
          oCtx.restore();

        } else if (fx?.type === 'bw_to_color') {
          const progress = (currentTime - fxClip.startTime) / fxClip.duration;
          const p = Math.max(0, Math.min(1, progress));
          if (p < 1) {
            const imgData = oCtx.getImageData(0, 0, w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i]     = Math.round(luma + (data[i]     - luma) * p);
              data[i + 1] = Math.round(luma + (data[i + 1] - luma) * p);
              data[i + 2] = Math.round(luma + (data[i + 2] - luma) * p);
            }
            oCtx.putImageData(imgData, 0, 0);
          }

        } else if (fx?.type === 'old_film') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 24);
          let rngState = (seed * 0x9e3779b9 + 1) >>> 0;
          const randF = () => {
            rngState ^= rngState << 13;
            rngState ^= rngState >>> 17;
            rngState ^= rngState << 5;
            return ((rngState >>> 0) & 0xFFFF) / 0x10000;
          };

          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalCompositeOperation = 'multiply';
          oCtx.globalAlpha = 0.35 * intensity;
          oCtx.fillStyle = 'rgb(200,160,110)';
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

          const grainW = Math.max(1, Math.round(dw / 2));
          const grainH = Math.max(1, Math.round(dh / 2));
          const grainData = new Uint8ClampedArray(grainW * grainH * 4);
          const grainAlpha = Math.round(0.18 * intensity * 0.6 * 255);
          for (let gi = 0; gi < grainW * grainH; gi++) {
            const v = randF() > 0.5 ? 255 : 0;
            const off = gi * 4;
            grainData[off]     = v;
            grainData[off + 1] = v;
            grainData[off + 2] = v;
            grainData[off + 3] = grainAlpha;
          }
          const grainImg = new ImageData(grainData, grainW, grainH);
          const grainOffscreen = getOrCreateCanvas(offscreenCanvasRef, grainW, grainH);
          const gCtx = grainOffscreen.getContext('2d');
          if (gCtx) {
            gCtx.putImageData(grainImg, 0, 0);
            oCtx.save();
            oCtx.imageSmoothingEnabled = false;
            oCtx.drawImage(grainOffscreen, -dw / 2, -dh / 2, dw, dh);
            oCtx.restore();
          }

          if (randF() > 0.85) {
            oCtx.save();
            oCtx.globalAlpha = 0.5 * intensity;
            oCtx.strokeStyle = 'rgba(255,240,180,0.7)';
            oCtx.lineWidth = 1;
            const scratchX = -dw / 2 + randF() * dw;
            oCtx.beginPath();
            oCtx.moveTo(scratchX, -dh / 2);
            oCtx.lineTo(scratchX + (randF() - 0.5) * 10, dh / 2);
            oCtx.stroke();
            oCtx.restore();
          }

          oCtx.save();
          const vig = oCtx.createRadialGradient(0, 0, dw * 0.3, 0, 0, dw * 0.7);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, `rgba(0,0,0,${0.55 * intensity})`);
          oCtx.fillStyle = vig;
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'vhs') {
          const intensity = (fx.intensity ?? 100) / 100;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.25 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.fillStyle = 'rgba(255,0,0,0.15)';
          oCtx.fillRect(-dw / 2 + 6 * intensity, -dh / 2, dw, dh);
          oCtx.fillStyle = 'rgba(0,0,255,0.15)';
          oCtx.fillRect(-dw / 2 - 6 * intensity, -dh / 2, dw, dh);
          oCtx.restore();

          oCtx.save();
          const scanW = Math.max(1, Math.round(w));
          const scanH = Math.max(1, Math.round(h));
          const scanData = new Uint8ClampedArray(scanW * scanH * 4);
          const scanAlpha = Math.round(0.2 * intensity * 0.9 * 255);
          for (let row = 0; row < scanH; row++) {
            if (row % 3 === 0) {
              const rowOff = row * scanW * 4;
              for (let col = 0; col < scanW; col++) {
                const off = rowOff + col * 4;
                scanData[off + 3] = scanAlpha;
              }
            }
          }
          const scanImg = new ImageData(scanData, scanW, scanH);
          const scanOffscreen = getOrCreateCanvas(glitchRedCanvasRef, scanW, scanH);
          const sCtx = scanOffscreen.getContext('2d');
          if (sCtx) {
            sCtx.putImageData(scanImg, 0, 0);
            oCtx.globalAlpha = 1;
            oCtx.drawImage(scanOffscreen, -dw / 2, -dh / 2, dw, dh);
          }
          oCtx.restore();

          if (rand(1) > 0.7) {
            oCtx.save();
            oCtx.globalAlpha = 0.3 * intensity;
            const bandY = -dh / 2 + rand(2) * dh;
            oCtx.fillStyle = 'rgba(255,255,255,0.15)';
            oCtx.fillRect(-dw / 2, bandY, dw, 4 + rand(3) * 20);
            oCtx.restore();
          }

          oCtx.save();
          oCtx.globalCompositeOperation = 'multiply';
          oCtx.globalAlpha = 0.12 * intensity;
          oCtx.fillStyle = 'rgb(180,255,180)';
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'cinematic_bars') {
          const barH = dh * 0.105;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.fillStyle = 'rgb(0,0,0)';
          oCtx.fillRect(-dw / 2, -dh / 2,       dw, barH);
          oCtx.fillRect(-dw / 2,  dh / 2 - barH, dw, barH);
          oCtx.restore();

        } else if (fx?.type === 'neon_glow') {
          const intensity = (fx.intensity ?? 100) / 100;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.45 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.filter = `blur(${6 * intensity}px) brightness(1.8)`;
          oCtx.drawImage(oCtx.canvas, -dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

          oCtx.save();
          oCtx.globalAlpha = 0.15 * intensity;
          oCtx.globalCompositeOperation = 'screen';
          const neonGrad = oCtx.createLinearGradient(-dw / 2, 0, dw / 2, 0);
          neonGrad.addColorStop(0, 'rgba(255,0,200,0.8)');
          neonGrad.addColorStop(1, 'rgba(0,200,255,0.8)');
          oCtx.fillStyle = neonGrad;
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'rgb_split') {
          const intensity = (fx.intensity ?? 100) / 100;
          const shift = intensity * 14;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.55;
          oCtx.globalCompositeOperation = 'screen';

          const offR = getOrCreateCanvas(glitchRedCanvasRef, w, h);
          const ctxR = offR.getContext('2d')!;
          ctxR.clearRect(0, 0, w, h);
          ctxR.drawImage(oCtx.canvas, 0, 0, w, h);
          const dR = ctxR.getImageData(0, 0, w, h);
          for (let i = 0; i < dR.data.length; i += 4) { dR.data[i+1] = 0; dR.data[i+2] = 0; }
          ctxR.putImageData(dR, 0, 0);
          oCtx.drawImage(offR, -dw / 2 - shift, -dh / 2, dw, dh);

          const offB = getOrCreateCanvas(glitchBlueCanvasRef, w, h);
          const ctxB = offB.getContext('2d')!;
          ctxB.clearRect(0, 0, w, h);
          ctxB.drawImage(oCtx.canvas, 0, 0, w, h);
          const dB = ctxB.getImageData(0, 0, w, h);
          for (let i = 0; i < dB.data.length; i += 4) { dB.data[i] = 0; dB.data[i+1] = 0; }
          ctxB.putImageData(dB, 0, 0);
          oCtx.drawImage(offB, -dw / 2 + shift, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'pixelate') {
          const intensity = (fx.intensity ?? 100) / 100;
          const blockSize = Math.max(2, Math.round(intensity * 24));
          const tmpW = Math.max(1, Math.round(w / blockSize));
          const tmpH = Math.max(1, Math.round(h / blockSize));
          const tmp = getOrCreateCanvas(pixelateCanvasRef, tmpW, tmpH);
          const tCtx = tmp.getContext('2d')!;
          tCtx.clearRect(0, 0, tmpW, tmpH);
          tCtx.drawImage(oCtx.canvas, 0, 0, w, h, 0, 0, tmpW, tmpH);
          tCtx.imageSmoothingEnabled = false;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          (oCtx as any).imageSmoothingEnabled = false;
          oCtx.drawImage(tmp, 0, 0, tmpW, tmpH, -dw / 2, -dh / 2, dw, dh);
          oCtx.restore();

        } else if (fx?.type === 'mirror') {
          const halfW = Math.max(1, Math.round(w / 2));
          const leftData = oCtx.getImageData(0, 0, halfW, h);
          const flip = getOrCreateCanvas(mirrorCanvasRef, halfW, h);
          const fCtx = flip.getContext('2d')!;
          fCtx.clearRect(0, 0, halfW, h);
          fCtx.putImageData(leftData, 0, 0);
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.scale(-1, 1);
          oCtx.drawImage(flip, 0, 0, halfW, h, -dw / 2, -dh / 2, dw / 2, dh);
          oCtx.restore();

        } else if (fx?.type === 'zoom_blur') {
          const intensity = (fx.intensity ?? 100) / 100;
          const steps = Math.round(6 + intensity * 8);
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.25 / steps;
          for (let i = 1; i <= steps; i++) {
            const s = 1 + (i / steps) * 0.1 * intensity;
            oCtx.save();
            oCtx.scale(s, s);
            oCtx.drawImage(oCtx.canvas, -dw / 2, -dh / 2, dw, dh);
            oCtx.restore();
          }
          oCtx.restore();

        } else if (fx?.type === 'lens_flare') {
          const intensity = (fx.intensity ?? 100) / 100;
          const fcx = dw * 0.2, fcy = -dh * 0.25;
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalCompositeOperation = 'screen';
          const flareGrad = oCtx.createRadialGradient(fcx, fcy, 0, fcx, fcy, 90 * intensity);
          flareGrad.addColorStop(0,    `rgba(255,255,220,${0.9  * intensity})`);
          flareGrad.addColorStop(0.15, `rgba(255,200,100,${0.5  * intensity})`);
          flareGrad.addColorStop(0.5,  `rgba(200,180,255,${0.15 * intensity})`);
          flareGrad.addColorStop(1,    'rgba(0,0,0,0)');
          oCtx.fillStyle = flareGrad;
          oCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
          
          oCtx.globalAlpha = 0.35 * intensity;
          const streakGrad = oCtx.createLinearGradient(-dw / 2, fcy, dw / 2, fcy);
          streakGrad.addColorStop(0,   'rgba(100,150,255,0)');
          streakGrad.addColorStop(0.5, `rgba(150,210,255,${0.85 * intensity})`);
          streakGrad.addColorStop(1,   'rgba(100,150,255,0)');
          oCtx.fillStyle = streakGrad;
          oCtx.fillRect(-dw / 2, fcy - 2, dw, 4);
          oCtx.restore();

        } else if (fx?.type === 'night_vision') {
          const intensity = (fx.intensity ?? 100) / 100;
          const imgData = oCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const seed = Math.floor(currentTime * 30);
          const randNV = (n: number) => ((Math.sin(seed * 3.1 + n * 91.7) * 43758.5) % 1 + 1) % 1;
          for (let i = 0; i < data.length; i += 4) {
            const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const noise = (randNV(i * 0.001) - 0.5) * 30 * intensity;
            const v = Math.min(255, Math.max(0, luma * 1.4 + noise));
            data[i]     = 0;
            data[i + 1] = Math.round(v);
            data[i + 2] = 0;
          }
          oCtx.putImageData(imgData, 0, 0);

          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.12 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 2) {
            oCtx.fillStyle = 'rgba(0,0,0,0.9)';
            oCtx.fillRect(-dw / 2, row, dw, 1);
          }
          oCtx.restore();

        } else if (fx?.type === 'thermal') {
          const intensity = (fx.intensity ?? 100) / 100;
          const imgData = oCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const mix = (a: number, b: number, t: number) => a + (b - a) * t;
          for (let i = 0; i < data.length; i += 4) {
            const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
            let r = 0, g = 0, b2 = 0;
            if      (luma < 0.25) { const t = luma / 0.25;        r = 0;          g = 0;          b2 = mix(128, 255, t); }
            else if (luma < 0.5)  { const t = (luma-0.25)/0.25;   r = 0;          g = mix(0,255,t);  b2 = mix(255,255,t); }
            else if (luma < 0.75) { const t = (luma-0.5)/0.25;    r = mix(0,255,t); g = mix(255,255,t); b2 = mix(255,0,t); }
            else                  { const t = (luma-0.75)/0.25;   r = mix(255,255,t); g = mix(255,0,t); b2 = 0; }
            data[i]     = Math.round(mix(data[i],     r,  intensity));
            data[i + 1] = Math.round(mix(data[i + 1], g,  intensity));
            data[i + 2] = Math.round(mix(data[i + 2], b2, intensity));
          }
          oCtx.putImageData(imgData, 0, 0);

        } else if (fx?.type === 'glitch') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 30);
          const randGl = (n: number) => ((Math.sin(seed * 9.7 + n * 127.3) * 43758.5453) % 1 + 1) % 1;

          const aberration = intensity * 8 * randGl(1);
          oCtx.translate(w / 2, h / 2);
          oCtx.save();
          oCtx.globalAlpha = 0.45;
          oCtx.globalCompositeOperation = 'screen';
          oCtx.fillStyle = `rgba(255, 0, 0, 0.3)`;
          oCtx.fillRect(-dw / 2 - aberration, -dh / 2, dw, dh);
          oCtx.fillStyle = `rgba(0, 0, 255, 0.3)`;
          oCtx.fillRect(-dw / 2 + aberration, -dh / 2, dw, dh);
          oCtx.restore();

          oCtx.save();
          oCtx.globalAlpha = 0.15 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 4) {
            if (randGl(row + 5) > 0.5) {
              oCtx.fillStyle = 'rgba(0,0,0,0.8)';
              oCtx.fillRect(-dw / 2, row, dw, 2);
            }
          }
          oCtx.restore();

          const numSlices = Math.floor(3 + randGl(2) * 6 * intensity);
          oCtx.save();
          oCtx.globalAlpha = 0.65 * intensity;
          for (let i = 0; i < numSlices; i++) {
            const sliceY    = -dh / 2 + randGl(i * 3) * dh;
            const sliceH    = 2 + randGl(i * 3 + 1) * 8;
            const sliceShift = (randGl(i * 3 + 2) - 0.5) * 40 * intensity;
            oCtx.drawImage(oCtx.canvas, 0, sliceY + dh / 2, w, sliceH, sliceShift, sliceY + dh / 2, w, sliceH);
          }
          oCtx.restore();
        }
        
        oCtx.restore();
      };

      if (mediaItem.type === 'video') {
        const videoEl = videoElements.get(clip.id);
        const videoReady = videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0;

        // Determine frame source: live video element or cached ImageBitmap
        let frameSource: CanvasImageSource | null = null;
        let sourceW = W;
        let sourceH = H;

        if (videoReady && videoEl) {
          frameSource = videoEl;
          sourceW = videoEl.videoWidth || W;
          sourceH = videoEl.videoHeight || H;
        } else if (!isPlaying) {
          // Try frame cache for smooth scrubbing
          const clipCache = frameCache.get(clip.id);
          if (clipCache && clipCache.length > 0) {
            const mediaTime = getMediaTimeForClip({
              id: clip.id, startTime: clip.startTime,
              duration: clip.duration, trimStart: clip.trimStart,
              speed: clip.speed, speedRamp: (clip as any).speedRamp
            }, currentTime);
            const roundedTime = Math.round(mediaTime * 30) / 30;
            // Find nearest cached frame (binary search for efficiency)
            let bestIdx = 0;
            let bestDist = Infinity;
            for (let i = 0; i < clipCache.length; i++) {
              const dist = Math.abs(clipCache[i].time - roundedTime);
              if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
              }
            }
            if (bestDist < 0.2) { // Accept frames within ~6 frames distance
              frameSource = clipCache[bestIdx].bitmap;
              sourceW = clipCache[bestIdx].bitmap.width;
              sourceH = clipCache[bestIdx].bitmap.height;
            }
          }
        }

        if (frameSource) {
          // Fit the video into the canvas while preserving aspect ratio
          const vw = sourceW;
          const vh = sourceH;
          const scale = Math.min(W / vw, H / vh);
          
          const baseDw = vw * scale;
          const baseDh = vh * scale;

          const sx = vw * cLeft;
          const sy = vh * cTop;
          const sw = Math.max(1, vw * (1 - cLeft - cRight));
          const sh = Math.max(1, vh * (1 - cTop - cBot));

          dw = Math.max(1, baseDw * (1 - cLeft - cRight));
          dh = Math.max(1, baseDh * (1 - cTop - cBot));
          dx = -baseDw / 2 + baseDw * cLeft;
          dy = -baseDh / 2 + baseDh * cTop;

          applyClipMask(ctx, clip.mask, dx, dy, dw, dh);

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasAiBg = clip.aiBackground?.enabled;
          const hasChroma = clip.chromaKey?.enabled;
          const hasLuma = clip.lumaKey?.enabled;
          const hasLut = !!clip.lut?.mediaId;
          const hasFx = !!activeFxClip;
          const needsOffscreen = hasWheels || hasChroma || hasLuma || hasLut || hasFx || hasAiBg;

          if (hasPerspectiveWarp && corners) {
            const offscreenWidth = Math.max(1, Math.round(sw));
            const offscreenHeight = Math.max(1, Math.round(sh));
            const offscreen = getOrCreateCanvas(offscreenCanvasRef, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
              oCtx.drawImage(frameSource, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, frameSource, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
              }
              if (hasLuma && clip.lumaKey) {
                applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
              }
              if (hasWheels) {
                applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
              }
              if (hasLut) {
                const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                if (lutMedia?.lutData) {
                  applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                }
              }
              if (hasFx) {
                applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
              }
              drawPerspectiveTexture(ctx, offscreen, corners);
            }
          } else {
            if (needsOffscreen) {
              const offscreenWidth = Math.max(1, Math.round(dw));
              const offscreenHeight = Math.max(1, Math.round(dh));
              const offscreen = getOrCreateCanvas(offscreenCanvasRef, offscreenWidth, offscreenHeight);
              const oCtx = offscreen.getContext('2d');
              if (oCtx) {
                oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
                oCtx.drawImage(frameSource, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, frameSource, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                  applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
                }
                if (hasLuma && clip.lumaKey) {
                  applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
                }
                if (hasWheels) {
                  applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
                }
                if (hasLut) {
                  const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                  if (lutMedia?.lutData) {
                    applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                  }
                }
                if (hasFx) {
                  applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
                }
                ctx.drawImage(offscreen, dx, dy, dw, dh);
              } else {
                ctx.drawImage(frameSource, sx, sy, sw, sh, dx, dy, dw, dh);
              }
            } else {
              ctx.drawImage(frameSource, sx, sy, sw, sh, dx, dy, dw, dh);
            }
          }
          ctx.filter = 'none';
          hasRealMedia = true;
          anyClipDrawn = true;
        } else if (isPlaying) {
          // Video not ready yet during playback – draw placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'VIDEO', '#3b82f6');
          anyClipDrawn = true;
        } else {
          // During scrubbing with no cached frame, skip placeholder
          anyClipDrawn = true;
        }
      } else if (mediaItem.type === 'image') {
        const img = getCachedImage(mediaItem.id, mediaItem.url, requestRedraw);
        if (img) {
          const iw = img.naturalWidth || W;
          const ih = img.naturalHeight || H;
          const fitScale = Math.min(W / iw, H / ih);

          const baseDw = iw * fitScale;
          const baseDh = ih * fitScale;

          const sx = iw * cLeft;
          const sy = ih * cTop;
          const sw = Math.max(1, iw * (1 - cLeft - cRight));
          const sh = Math.max(1, ih * (1 - cTop - cBot));

          dw = Math.max(1, baseDw * (1 - cLeft - cRight));
          dh = Math.max(1, baseDh * (1 - cTop - cBot));
          dx = -baseDw / 2 + baseDw * cLeft;
          dy = -baseDh / 2 + baseDh * cTop;

          // ── Ken Burns zoom + pan ──────────────────────────────
          const kb = clip.kenBurns;
          if (kb?.enabled) {
            const rawP = clip.duration > 0
              ? Math.max(0, Math.min(1, (currentTime - clip.startTime) / clip.duration))
              : 0;
            // Apply easing
            let t = rawP;
            if (kb.easing === 'easeIn')    t = rawP * rawP;
            else if (kb.easing === 'easeOut')  t = rawP * (2 - rawP);
            else if (kb.easing === 'easeInOut') {
              t = rawP < 0.5 ? 2 * rawP * rawP : 1 - Math.pow(-2 * rawP + 2, 2) / 2;
            }
            const kbScale = (kb.startScale + (kb.endScale - kb.startScale) * t) / 100;
            const kbPanX  = (kb.startPanX  + (kb.endPanX  - kb.startPanX)  * t) / 100 * baseDw;
            const kbPanY  = (kb.startPanY  + (kb.endPanY  - kb.startPanY)  * t) / 100 * baseDh;
            ctx.save();
            ctx.translate(kbPanX, kbPanY);
            ctx.scale(kbScale, kbScale);
          }
          // ─────────────────────────────────────────────────────

          applyClipMask(ctx, clip.mask, dx, dy, dw, dh);

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasAiBg = clip.aiBackground?.enabled;
          const hasChroma = clip.chromaKey?.enabled;
          const hasLuma = clip.lumaKey?.enabled;
          const hasLut = !!clip.lut?.mediaId;
          const hasFx = !!activeFxClip;
          const needsOffscreen = hasWheels || hasChroma || hasLuma || hasLut || hasFx || hasAiBg;

          if (hasPerspectiveWarp && corners) {
            const offscreenWidth = Math.max(1, Math.round(sw));
            const offscreenHeight = Math.max(1, Math.round(sh));
            const offscreen = getOrCreateCanvas(offscreenCanvasRef, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
              oCtx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, img, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
              }
              if (hasLuma && clip.lumaKey) {
                applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
              }
              if (hasWheels) {
                applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
              }
              if (hasLut) {
                const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                if (lutMedia?.lutData) {
                  applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                }
              }
              if (hasFx) {
                applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
              }
              drawPerspectiveTexture(ctx, offscreen, corners);
            }
          } else {
            if (needsOffscreen) {
              const offscreenWidth = Math.max(1, Math.round(dw));
              const offscreenHeight = Math.max(1, Math.round(dh));
              const offscreen = getOrCreateCanvas(offscreenCanvasRef, offscreenWidth, offscreenHeight);
              const oCtx = offscreen.getContext('2d');
              if (oCtx) {
                oCtx.clearRect(0, 0, offscreen.width, offscreen.height);
                oCtx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
                if (hasAiBg) {
                  await applyAiBackgroundMask(oCtx, offscreen.width, offscreen.height, img, clip.aiBackground?.edgeBlur);
                }
                if (hasChroma && clip.chromaKey) {
                  applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
                }
                if (hasLuma && clip.lumaKey) {
                  applyLumaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.lumaKey.type, clip.lumaKey.threshold, clip.lumaKey.softness);
                }
                if (hasWheels) {
                  applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
                }
                if (hasLut) {
                  const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
                  if (lutMedia?.lutData) {
                    applyLutToCanvas(oCtx, offscreen.width, offscreen.height, lutMedia.lutData, clip.lut!.intensity ?? 100);
                  }
                }
                if (hasFx) {
                  applyFxToContext(oCtx, offscreen.width, offscreen.height, activeFxClip);
                }
                ctx.drawImage(offscreen, dx, dy, dw, dh);
              } else {
                ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
              }
            } else {
              ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            }
          }
          ctx.filter = 'none';

          // Restore Ken Burns sub-transform
          if (kb?.enabled) ctx.restore();

          hasRealMedia = true;
          anyClipDrawn = true;
        } else {
          // Image still loading – placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'IMAGE', '#f59e0b');
          anyClipDrawn = true;
        }
      } else if (mediaItem.type === 'compound') {
        drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'COMPOUND CLIP', '#8b5cf6');
        anyClipDrawn = true;
      } else if (mediaItem.type === 'text') {
        // Use clip textSettings or fall back to sensible defaults so text is always visible
        const rawTs = clip.textSettings as any;
        if (rawTs?.animationPreset === 'subscribe') {
          const localTime = Math.max(0, currentTime - clip.startTime);
          drawSubscribeAnimation(ctx, localTime, clip.duration, dw, dh);
          ctx.restore();
          return;
        }
        const ts = {
          text: String(rawTs?.text ?? 'Sample Text'),
          fontSize: Math.max(8, Number(rawTs?.fontSize) || 48),
          fontFamily: String(rawTs?.fontFamily ?? 'Inter'),
          color: String(rawTs?.color ?? '#ffffff'),
          backgroundColor: String(rawTs?.backgroundColor ?? 'transparent'),
          bold: !!rawTs?.bold,
          italic: !!rawTs?.italic,
          shadow: !!rawTs?.shadow,
          shadowColor: String(rawTs?.shadowColor ?? '#000000'),
          shadowBlur: Number(rawTs?.shadowBlur) || 10,
          threeD: !!rawTs?.threeD,
          threeDDepth: Number(rawTs?.threeDDepth) || 4,
          strokeWidth: Number(rawTs?.strokeWidth) || 0,
          strokeColor: String(rawTs?.strokeColor ?? '#000000'),
          textAlign: (rawTs?.textAlign ?? 'center') as CanvasTextAlign,
          animation: rawTs?.animation,
        };

        // ── Animation progress ────────────────────────────────────────────
        const localTime = Math.max(0, currentTime - clip.startTime);
        const clipDur = clip.duration;
        const inDur  = ts.animation?.inDuration ?? 0.5;
        const outDur = ts.animation?.outDuration ?? 0.5;
        const inProgress  = inDur  > 0 ? Math.min(1, localTime / inDur)              : 1;
        const outProgress = outDur > 0 ? Math.min(1, (clipDur - localTime) / outDur) : 1;

        let textAlpha   = 1.0;
        let textScale   = 1.0;
        let textXOffset = 0;
        let textYOffset = 0;
        // Split text into lines (support \n)
        let displayText = ts.text;

        if (ts.animation?.in && ts.animation.in !== 'none') {
          switch (ts.animation.in) {
            case 'fadeIn':    textAlpha *= inProgress; break;
            case 'zoom':      textScale *= (0.2 + 0.8 * inProgress); break;
            case 'slideUp':   textYOffset += (1 - inProgress) * 80; break;
            case 'slideDown': textYOffset -= (1 - inProgress) * 80; break;
            case 'slideLeft': textXOffset += (1 - inProgress) * 160; break;
            case 'slideRight':textXOffset -= (1 - inProgress) * 160; break;
            case 'bounce': {
              const bounceFactor = inProgress < 0.6 ? 0.3 * Math.sin(inProgress * Math.PI / 0.6)
                                 : inProgress < 0.9 ? -0.1 * Math.sin((inProgress - 0.6) * Math.PI / 0.3) : 0;
              textScale *= (1 + bounceFactor);
              break;
            }
            case 'typewriter': {
              const totalChars = ts.text.length;
              displayText = ts.text.slice(0, Math.floor(inProgress * totalChars));
              break;
            }
          }
        }

        if (ts.animation?.out && ts.animation.out !== 'none') {
          switch (ts.animation.out) {
            case 'fadeOut':   textAlpha *= outProgress; break;
            case 'zoom':      textScale *= (0.2 + 0.8 * outProgress); break;
            case 'slideUp':   textYOffset -= (1 - outProgress) * 80; break;
            case 'slideDown': textYOffset += (1 - outProgress) * 80; break;
            case 'slideLeft': textXOffset -= (1 - outProgress) * 160; break;
            case 'slideRight':textXOffset += (1 - outProgress) * 160; break;
          }
        }

        // ── Multiline split ───────────────────────────────────────────────
                
        if (rawTs?.animationPreset === 'typewriter') {
          const totalChars = displayText.length;
          displayText = displayText.slice(0, Math.floor(inProgress * totalChars));
        } else if (rawTs?.animationPreset === 'bounce') {
          const bounceFactor = inProgress < 0.6 ? 0.3 * Math.sin(inProgress * Math.PI / 0.6)
                             : inProgress < 0.9 ? -0.1 * Math.sin((inProgress - 0.6) * Math.PI / 0.3) : 0;
          textScale *= (1 + bounceFactor);
        }
        
        const lines = displayText.split('\n');
        const lineHeight = ts.fontSize * 1.35;

        // Set up font BEFORE measuring
        try {
          ctx.font = `${ts.italic ? 'italic ' : ''}${ts.bold ? 'bold ' : ''}${ts.fontSize}px "${ts.fontFamily}", sans-serif`;
        } catch (_) {
          ctx.font = `${ts.fontSize}px sans-serif`;
        }
        ctx.textBaseline = 'middle';
        try {
          ctx.textAlign = ts.textAlign || 'center';
        } catch (_) {
          ctx.textAlign = 'center';
        }

        // Measure widest line for background rect
        const maxLineWidth = lines.reduce((max: number, l: string) => Math.max(max, ctx.measureText(l).width), 0);
        dw = maxLineWidth + 40;
        dh = lines.length * lineHeight + 20;

        // ── Sub-transform for animation (applied on top of clip transform) ─
        ctx.save();
        ctx.translate(textXOffset, textYOffset);
        ctx.scale(textScale, textScale);
        ctx.globalAlpha *= textAlpha;

        // Background rect (centered at 0,0 which is already at clip's aX,aY center)
        if (ts.backgroundColor !== 'transparent') {
          ctx.fillStyle = ts.backgroundColor;
          const bgX = ts.textAlign === 'left'  ? -20 :
                      ts.textAlign === 'right' ? -(dw - 20) : -dw / 2;
          ctx.fillRect(bgX, -dh / 2, dw, dh);
        }

        // X position for text based on alignment (0 = clip center)
        const textX = ts.textAlign === 'left'  ? -(maxLineWidth / 2) :
                      ts.textAlign === 'right' ? (maxLineWidth / 2) : 0;

        // Draw each line
        const totalTextH = lines.length * lineHeight;
        lines.forEach((line: string, lineIdx: number) => {
          const lineY = -totalTextH / 2 + lineIdx * lineHeight + lineHeight / 2;

          // 3D depth layers — FIX H3: no shadow on depth layers (shadow goes on the main text below)
          if (ts.threeD) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = ts.shadowColor;
            for (let d = 1; d <= (ts.threeDDepth || 4); d++) {
              ctx.fillText(line, textX + d, lineY + d);
            }
          }

          // Stroke
          if (ts.strokeWidth > 0) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = ts.strokeColor;
            ctx.lineWidth   = ts.strokeWidth;
            ctx.lineJoin    = 'round';
            ctx.strokeText(line, textX, lineY);
          }

          // FIX H3: Apply shadow immediately before the main fill text so it actually renders on the text
          if (ts.shadow) {
            ctx.shadowColor = ts.shadowColor;
            ctx.shadowBlur  = ts.shadowBlur;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
          }

          // Fill
          ctx.fillStyle = ts.color;
          ctx.fillText(line, textX, lineY);

          // Clear shadow after drawing main text
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        });

        ctx.shadowBlur = 0;
        ctx.restore(); // restore animation sub-transform

        hasRealMedia  = true;
        anyClipDrawn  = true;
      }

      // Apply temperature, tint, faded film, and vignette overlays on top of the drawn media
      if (hasRealMedia && mediaItem.type !== 'text') {
        applyColorOverlays(ctx, dx, dy, dw, dh, filters);
      }

      ctx.restore();
    };

    // Array to queue rendering operations, allowing them to be sorted by zIndex
    const drawQueue: { zIndex: number; fn: () => Promise<void> }[] = [];

    // Helper function to queue main clips on a list of tracks
    const queueMainClipsForTracks = (tracksList: any[], isText: boolean) => {
      tracksList.forEach((track, trackIdx) => {
        const sortedClips = [...track.clips].filter(c => !c.disabled).sort((a, b) => a.startTime - b.startTime);
        let activeTransition: { clipA: any; clipB: any; trans: any; t: number } | null = null;

        // Check if currentTime falls into any active transition zone
        for (let idx = 1; idx < sortedClips.length; idx++) {
          const clipB = sortedClips[idx];
          const clipA = sortedClips[idx - 1];
          const gap = clipB.startTime - (clipA.startTime + clipA.duration);

          if (Math.abs(gap) < 0.1 && clipB.transitionIn) {
            const trans = clipB.transitionIn;
            const duration = Math.max(0.01, trans.duration);
            const alignment = trans.params?.alignment || 'center';

            let leftSec = clipB.startTime - duration / 2;
            if (alignment === 'left') {
              leftSec = clipB.startTime;
            } else if (alignment === 'right') {
              leftSec = clipB.startTime - duration;
            }
            const rightSec = leftSec + duration;

            if (currentTime >= leftSec && currentTime < rightSec) {
              const t = (currentTime - leftSec) / duration;
              activeTransition = { clipA, clipB, trans, t };
              break;
            }
          }
        }

        if (activeTransition) {
          const { clipA, clipB, trans, t } = activeTransition;
          const z = clipB.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0));
          
          drawQueue.push({
            zIndex: z,
            fn: async () => {
              try {
                const type = trans.type;
                const nameLower = trans.name.toLowerCase();

                if (nameLower.includes('dissolve')) {
                  await drawSingleClip(clipA, 1 - t);
                  await drawSingleClip(clipB, t);
                } else if (nameLower.includes('fade')) {
                  if (t < 0.5) {
                    await drawSingleClip(clipA, 1 - t * 2);
                  } else {
                    await drawSingleClip(clipB, (t - 0.5) * 2);
                  }
                } else if (type === 'wipe') {
                  if (nameLower.includes('left')) {
                    await drawSingleClip(clipA, 1);
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(W * (1 - t), 0, W * t, H);
                    ctx.clip();
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  } else {
                    await drawSingleClip(clipA, 1);
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, W * t, H);
                    ctx.clip();
                    await drawSingleClip(clipB, 1);
                    ctx.restore();
                  }
                } else if (type === 'slide') {
                  if (nameLower.includes('up')) {
                    await drawSingleClip(clipA, 1, { translateY: -H * t });
                    await drawSingleClip(clipB, 1, { translateY: H * (1 - t) });
                  } else if (nameLower.includes('down')) {
                    await drawSingleClip(clipA, 1, { translateY: H * t });
                    await drawSingleClip(clipB, 1, { translateY: -H * (1 - t) });
                  } else {
                    await drawSingleClip(clipA, 1, { translateX: -W * t });
                    await drawSingleClip(clipB, 1, { translateX: W * (1 - t) });
                  }
                } else if (type === 'zoom') {
                  if (nameLower.includes('out')) {
                    await drawSingleClip(clipB, 1);
                    await drawSingleClip(clipA, 1 - t, { scale: 1 - t });
                    await drawSingleClip(clipB, t, { scale: t });
                  }
                } else {
                  await drawSingleClip(clipA, 1 - t);
                  await drawSingleClip(clipB, t);
                }
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw transition:', err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
          return;
        }

        const clip = sortedClips.find(
          (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration,
        );
        if (clip) {
          const z = clip.zIndex ?? (trackIdx * 10 + (isText ? 1000 : 0));
          drawQueue.push({
            zIndex: z,
            fn: async () => {
              try {
                let opacityMultiplier = 1;
                
                // Handle single-clip transition In (fade, etc)
                if (clip.transitionIn) {
                  const trans = clip.transitionIn;
                  const duration = trans.duration || 1.0;
                  const alignment = trans.params?.alignment || 'center';
                  let leftSec = clip.startTime - duration / 2;
                  if (alignment === 'left') leftSec = clip.startTime;
                  else if (alignment === 'right') leftSec = clip.startTime - duration;
                  const rightSec = leftSec + duration;
                  
                  if (currentTime >= leftSec && currentTime < rightSec) {
                    const t = (currentTime - leftSec) / duration;
                    if (trans.name.toLowerCase().includes('fade') || trans.name.toLowerCase().includes('dissolve')) {
                      opacityMultiplier = t;
                    }
                  }
                }
                
                // Handle single-clip transition Out
                if (clip.transitionOut && opacityMultiplier === 1) {
                  const trans = clip.transitionOut;
                  const duration = trans.duration || 1.0;
                  const alignment = trans.params?.alignment || 'center';
                  let leftSec = (clip.startTime + clip.duration) - duration / 2;
                  if (alignment === 'left') leftSec = (clip.startTime + clip.duration);
                  else if (alignment === 'right') leftSec = (clip.startTime + clip.duration) - duration;
                  const rightSec = leftSec + duration;
                  
                  if (currentTime >= leftSec && currentTime < rightSec) {
                    const t = (currentTime - leftSec) / duration;
                    if (trans.name.toLowerCase().includes('fade') || trans.name.toLowerCase().includes('dissolve')) {
                      opacityMultiplier = 1 - t;
                    }
                  }
                }

                await drawSingleClip(clip, opacityMultiplier);
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw clip:', clip.id, err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
        }
      });
    };

    const queueOverLayersForTracks = (tracksList: any[], isText: boolean) => {
      tracksList.forEach((track, trackIdx) => {
        const activeOverLayers = (track.overLayers || []).filter(
          (ol: any) => !ol.disabled && ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration
        );

        for (const ol of activeOverLayers) {
          const z = ol.zIndex ?? (trackIdx * 10 + 5 + (isText ? 1000 : 0));
          drawQueue.push({
            zIndex: z,
            fn: async () => {
              try {
                await drawSingleClip(ol as any, 1);
              } catch (err) {
                console.error('[CanvasRenderError] Failed to draw over layer:', ol.id, err);
                try { ctx.restore(); } catch (_) {}
              }
            }
          });
        }
      });
    };

    // Queue Video tracks
    queueMainClipsForTracks(videoTracks, false);
    queueOverLayersForTracks(videoTracks, false);

    // Queue Text tracks (Default 1000+ zIndex)
    queueMainClipsForTracks(textTracks, true);
    queueOverLayersForTracks(textTracks, true);

    // Sort by Z-Index (ascending: lowest drawn first, highest drawn last)
    drawQueue.sort((a, b) => a.zIndex - b.zIndex);

    // Execute drawing queue in order
    for (const task of drawQueue) {
      await task.fn();
    }

    if (!anyClipDrawn) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No clip at current position', W / 2, H / 2 - 10);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Add clips to the timeline to preview', W / 2, H / 2 + 12);
    }
    
    // 3b. Render particles for any clip that has particleSettings
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
      for (const ol of track.overLayers || []) {
        if (!ol.disabled && ol.particleSettings && ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
          renderParticles(ctx, ol.id, ol.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
    }

    // ── Apply LUT per active clip ──────────────────────────────────────────
    // After compositing all clips, apply LUT grading per clip that has one.
    // We apply the last active clip's LUT to the full canvas for simplicity.
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (
          clip.lut?.mediaId &&
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
          if (lutMedia?.lutData) {
            applyLutToCanvas(ctx, W, H, lutMedia.lutData, clip.lut!.intensity ?? 100);
          }
        }
      }
      for (const ol of track.overLayers || []) {
        if (
          !ol.disabled &&
          ol.lut?.mediaId &&
          currentTime >= ol.startTime &&
          currentTime < ol.startTime + ol.duration
        ) {
          const lutMedia = mediaLibrary.find((m) => m.id === ol.lut!.mediaId);
          if (lutMedia?.lutData) {
            applyLutToCanvas(ctx, W, H, lutMedia.lutData, ol.lut!.intensity ?? 100);
          }
        }
      }
    }

    ctx.restore(); // Restore from viewport transform

    // ── Grid Overlay ────────────────────────────────────────────────────
    if (showGrid) {
      ctx.save();
      ctx.globalAlpha = 1;

      const COLS = 4;
      const ROWS = 3;
      const cellW = W / COLS;
      const cellH = H / ROWS;

      // Thin grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + c * cellW, offsetY);
        ctx.lineTo(offsetX + c * cellW, offsetY + H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + r * cellH);
        ctx.lineTo(offsetX + W, offsetY + r * cellH);
        ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
    }

    if (!anyClipDrawn && !isExporting) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No clip at current position', W / 2, H / 2 - 10);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Add clips to the timeline to preview', W / 2, H / 2 + 12);
    }
    
    // 3b. Render particles for any clip that has particleSettings
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (!clip.disabled && clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
      for (const ol of track.overLayers || []) {
        if (!ol.disabled && ol.particleSettings && ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
          renderParticles(ctx, ol.id, ol.particleSettings, W, H, deltaMs, particlePoolsRef.current);
        }
      }
    }

    // ── Apply LUT per active clip ──────────────────────────────────────────
    // After compositing all clips, apply LUT grading per clip that has one.
    // We apply the last active clip's LUT to the full canvas for simplicity.
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (
          clip.lut?.mediaId &&
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const lutMedia = mediaLibrary.find((m) => m.id === clip.lut!.mediaId);
          if (lutMedia?.lutData) {
            applyLutToCanvas(ctx, W, H, lutMedia.lutData, clip.lut!.intensity ?? 100);
          }
        }
      }
      for (const ol of track.overLayers || []) {
        if (
          !ol.disabled &&
          ol.lut?.mediaId &&
          currentTime >= ol.startTime &&
          currentTime < ol.startTime + ol.duration
        ) {
          const lutMedia = mediaLibrary.find((m) => m.id === ol.lut!.mediaId);
          if (lutMedia?.lutData) {
            applyLutToCanvas(ctx, W, H, lutMedia.lutData, ol.lut!.intensity ?? 100);
          }
        }
      }
    }

    ctx.restore(); // Restore from viewport transform

    // ── Grid Overlay ────────────────────────────────────────────────────
    if (showGrid && !isExporting) {
      ctx.save();
      ctx.globalAlpha = 1;

      const COLS = 4;
      const ROWS = 3;
      const cellW = W / COLS;
      const cellH = H / ROWS;

      // Thin grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + c * cellW, offsetY);
        ctx.lineTo(offsetX + c * cellW, offsetY + H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + r * cellH);
        ctx.lineTo(offsetX + W, offsetY + r * cellH);
        ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(offsetX + W / 2, offsetY); ctx.lineTo(offsetX + W / 2, offsetY + H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(offsetX, offsetY + H / 2); ctx.lineTo(offsetX + W, offsetY + H / 2); ctx.stroke();
      ctx.setLineDash([]);

      // Rule-of-thirds intersection dots
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      for (let c = 1; c < COLS; c++) {
        for (let r = 1; r < ROWS; r++) {
          ctx.beginPath();
          ctx.arc(offsetX + c * cellW, offsetY + r * cellH, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    
    // Safe Zones Overlay
    if (settings.showSafeZones && !isExporting) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red-ish blind spot
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (aspectRatio === '16:9') {
        const brW = W * 0.15;
        const brH = H * 0.12;
        const brX = offsetX + W - brW;
        const brY = offsetY + H - brH;
        ctx.fillRect(brX, brY, brW, brH);
        ctx.strokeRect(brX, brY, brW, brH);
        ctx.fillStyle = 'white';
        ctx.fillText('Logo/Time', brX + brW/2, brY + brH/2);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        const trW = W * 0.1;
        const trH = H * 0.1;
        const trX = offsetX + W - trW;
        const trY = offsetY;
        ctx.fillRect(trX, trY, trW, trH);
        ctx.strokeRect(trX, trY, trW, trH);
        ctx.fillStyle = 'white';
        ctx.fillText('Info', trX + trW/2, trY + trH/2);
        
      } else if (aspectRatio === '9:16') {
        const rsW = W * 0.18;
        const rsH = H * 0.45;
        const rsX = offsetX + W - rsW;
        const rsY = offsetY + H * 0.4;
        ctx.fillRect(rsX, rsY, rsW, rsH);
        ctx.strokeRect(rsX, rsY, rsW, rsH);
        
        ctx.save();
        ctx.translate(rsX + rsW/2, rsY + rsH/2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'white';
        ctx.fillText('Action Buttons', 0, 0);
        ctx.restore();

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        const bW = W * 0.82;
        const bH = H * 0.15;
        const bX = offsetX;
        const bY = offsetY + H - bH;
        ctx.fillRect(bX, bY, bW, bH);
        ctx.strokeRect(bX, bY, bW, bH);
        ctx.fillStyle = 'white';
        ctx.fillText('Title & Audio', bX + bW/2, bY + bH/2);
      }
      
      ctx.restore();
    }

    // 5. Timecode overlay ?" top-right
    if (!isExporting) {
      ctx.globalAlpha = 1;
      const tcText = formatTime(currentTime);
      ctx.font = 'bold 12px monospace';
      const tcMetrics = ctx.measureText(tcText);
      const tcPadX = 8;
      const tcPadY = 4;
      const tcW = tcMetrics.width + tcPadX * 2;
      const tcH = 20;
      const tcX = offsetX + W - tcW - 8;
      const tcY = offsetY + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(tcX, tcY, tcW, tcH, 4);
      } else {
        ctx.rect(tcX, tcY, tcW, tcH);
      }
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(tcText, offsetX + W - 8 - tcPadX, tcY + tcH / 2);
    }

    ctx.restore(); // Restore from global canvas resolution scale

    // ── Double buffer blit: copy finished composite to visible canvas in one atomic draw ──
    const mainCtx = canvas.getContext('2d');
    if (mainCtx) {
      mainCtx.clearRect(0, 0, canvas.width, canvas.height);
      mainCtx.drawImage(composite, 0, 0);
    }

    // Snapshot this successfully rendered frame for use during seeking gaps
    if (!lastFrameCanvasRef.current) {
      lastFrameCanvasRef.current = document.createElement('canvas');
    }
    const snapCanvas = lastFrameCanvasRef.current;
    if (snapCanvas.width !== canvas.width || snapCanvas.height !== canvas.height) {
      snapCanvas.width = canvas.width;
      snapCanvas.height = canvas.height;
    }
    const snapCtx = snapCanvas.getContext('2d');
    if (snapCtx) {
      snapCtx.clearRect(0, 0, snapCanvas.width, snapCanvas.height);
      snapCtx.drawImage(composite, 0, 0);
    }
  }, [currentTime, tracks, selectedClipId, mediaLibrary, videoElements, frameCache, imageRevision, requestRedraw, viewport, settings.showSafeZones, showGrid, canvasBgColor, settings.previewQuality, settings.hardwareAcceleration, isPlaying, aspectRatio, isExporting, exportWidth, exportHeight, showProgressBar, progressBarColor, progressBarHeight, useProxies]);

  // ── Unified render loop to prevent flickering during scrubbing ──
  // Use a frame-pending flag + single rAF loop instead of canceling/rescheduling.
  const renderCanvasRef = useRef(renderCanvas);
  const framePendingRef = useRef(true);
  const rafActiveRef = useRef(false);

    useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  });

  // Mark that a new frame is needed whenever renderCanvas changes
  useEffect(() => {
    framePendingRef.current = true;
  }, [renderCanvas]);

  useEffect(() => {
    // If playback starts, always draw (the rAF loop handles continuous frames)
    framePendingRef.current = true;
    if (rafActiveRef.current) return;

    rafActiveRef.current = true;
    let rafId: number;
    let tabVisible = !document.hidden;

    // PERF FIX: Pause rAF when the tab is not visible to save CPU
    const onVisChange = () => {
      tabVisible = !document.hidden;
      if (tabVisible) framePendingRef.current = true; // redraw immediately on restore
    };
    document.addEventListener('visibilitychange', onVisChange);

    let isRendering = false;
    const tick = async () => {
      if (tabVisible && framePendingRef.current && !isRendering) {
        framePendingRef.current = false;
        isRendering = true;
        try {
          await renderCanvasRef.current();
        } catch (err) {
          console.error("Error in renderCanvas:", err);
        } finally {
          isRendering = false;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      rafActiveRef.current = false;
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = el.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;
      
      const { updateClip, currentTime, settings } = useEditorStore.getState();
      const sens = settings.gestureSensitivity;
      
      if (e.altKey) {
        // Alt + Scroll -> Zoom Workspace
        setViewport(prev => {
          const zoomDelta = e.deltaY > 0 ? -0.1 * sens : 0.1 * sens;
          const newZoom = Math.min(Math.max(prev.zoom + zoomDelta, 0.1), 5.0);
          
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleY;
          const cx = 854 / 2;
          const cy = 480 / 2;
          
          const nx = (mx - cx) * (1 - newZoom / prev.zoom) + prev.x * (newZoom / prev.zoom);
          const ny = (my - cy) * (1 - newZoom / prev.zoom) + prev.y * (newZoom / prev.zoom);
          
          return { x: nx, y: ny, zoom: newZoom };
        });
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl + Scroll (or pinch) -> Zoom Content (Clip Scale)
        const state = useEditorStore.getState();
        let currentClip = null;
        if (state.selectedClipId) {
          for (const t of state.tracks) {
            if (t.type === 'video') {
              const c = t.clips.find(c => c.id === state.selectedClipId);
              if (c && state.currentTime >= c.startTime && state.currentTime < c.startTime + c.duration) {
                currentClip = c;
                break;
              }
            }
          }
        }
        
        if (currentClip) {
          const currentScale = currentClip.transform.scale;
          // pinch zooms often have small deltaY (e.g. 1-5), mouse wheel is often 100
          const zoomDelta = e.deltaY > 0 ? -2 * sens : 2 * sens;
          const newScale = Math.max(10, Math.min(1000, currentScale + zoomDelta));
          
          let animations = currentClip.animations || {};
          const localTime = currentTime - currentClip.startTime;
          if (animations['transform.scale']) {
            animations = { ...animations, 'transform.scale': addOrUpdateKeyframe(animations['transform.scale'], localTime, newScale) };
          }
          
          updateClip(currentClip.id, { 
            transform: { ...currentClip.transform, scale: newScale },
            animations 
          });
        }
      } else {
        // Two-finger pan -> Pan Workspace
        const panSpeed = settings.scrollSpeed;
        setViewport(prev => ({
          ...prev,
          x: prev.x - e.deltaX * scaleX * panSpeed,
          y: prev.y - e.deltaY * scaleY * panSpeed
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'hand' || isSpacePressed) {
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (activeTool === 'zoom') {
      const rect = containerRef.current!.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      
      setViewport(prev => {
        const zoomDelta = e.altKey ? -0.5 : 0.5;
        const newZoom = Math.min(Math.max(prev.zoom + zoomDelta, 0.1), 5.0);
        const cx = 854 / 2;
        const cy = 480 / 2;
        const nx = (mx - cx) * (1 - newZoom / prev.zoom) + prev.x * (newZoom / prev.zoom);
        const ny = (my - cy) * (1 - newZoom / prev.zoom) + prev.y * (newZoom / prev.zoom);
        return { x: nx, y: ny, zoom: newZoom };
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning.current && (activeTool === 'hand' || isSpacePressed)) {
      const rect = containerRef.current!.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;
      
      const dx = (e.clientX - lastPanPos.current.x) * scaleX;
      const dy = (e.clientY - lastPanPos.current.y) * scaleY;
      
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPanning.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen exit via Esc
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // Close speed menu when clicking elsewhere
  useEffect(() => {
    if (!showSpeedMenu) return;
    const close = () => setShowSpeedMenu(false);
    let mounted = true;
      const timer = setTimeout(() => {
        if (mounted) window.addEventListener('click', close);
      }, 0);
      return () => {
        mounted = false;
        clearTimeout(timer);
        window.removeEventListener('click', close);
      };
  }, [showSpeedMenu]);

  // Close canvas settings panel when clicking elsewhere
  useEffect(() => {
    if (!showSettingsPanel) return;
    const close = () => setShowSettingsPanel(false);
    let mounted = true;
      const timer = setTimeout(() => {
        if (mounted) window.addEventListener('click', close);
      }, 0);
      return () => {
        mounted = false;
        clearTimeout(timer);
        window.removeEventListener('click', close);
      };
  }, [showSettingsPanel]);

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };
  const handleSkipBackward = () => seek(Math.max(0, currentTime - 10));
  const handleSkipForward = () => seek(Math.min(totalDuration, currentTime + 10));
  const handleRestart = () => seek(0);

  // -------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------
  const previewWidth = settings.previewQuality === 'quarter' ? 213 : settings.previewQuality === 'half' ? 427 : 854;
  const previewHeight = settings.previewQuality === 'quarter' ? 120 : settings.previewQuality === 'half' ? 240 : 480;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Canvas Container */}
      <div 
        ref={containerRef} 
        id="preview-canvas-wrapper" 
        className="relative w-full h-full overflow-hidden bg-[#0a0a0a] select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          // Ctrl+click or Alt+click → set particle emitter position
          const selClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
          if (selClip?.particleSettings && (e.ctrlKey || e.altKey)) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            // Clear old pool so particles restart from new position
            particlePoolsRef.current.delete(selClip.id);
            updateClip(selClip.id, { particleSettings: { ...selClip.particleSettings, emitterX: Math.round(x), emitterY: Math.round(y) } });
          }
        }}
        style={{ cursor: activeTool === 'hand' ? (isPanning.current ? 'grabbing' : 'grab') : (activeTool === 'zoom' ? 'zoom-in' : (() => { const sc = tracks.flatMap(t=>t.clips).find(c=>c.id===selectedClipId); return sc?.particleSettings ? 'crosshair' : 'default'; })()) }}
      >
        <canvas
          ref={canvasRef}
          width={isExporting ? (exportWidth || 854) : previewWidth}
          height={isExporting ? (exportHeight || 480) : previewHeight}
          className={`pointer-events-none ${
            isFullscreen
              ? 'absolute inset-0 w-full h-full object-contain bg-black'
              : 'w-full h-full object-contain'
          }`}
        />
        <InteractiveCanvasOverlay viewport={viewport} />

        {/* Overlay: canvas controls (top-left) */}
        <div className="absolute top-3 left-3 flex gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`p-1.5 rounded transition-colors ${
                showSettingsPanel
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'bg-black/50 hover:bg-black/70 text-white/70 hover:text-white border border-transparent'
              }`}
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* The Settings Panel Dropdown */}
            {showSettingsPanel && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl overflow-hidden pointer-events-auto z-50">
                <div className="p-3 bg-[#252525] border-b border-[#3e3e3e] flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white">Preview Settings</h3>
                  <button onClick={() => setShowSettingsPanel(false)} className="text-[#888] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                  
                  {/* Quality */}
                  <div>
                    <label className="text-[10px] text-[#a0a0a0] mb-2 block">Preview Quality</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['full', 'half', 'quarter'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => useEditorStore.getState().updateSettings({ previewQuality: q })}
                          className={`py-1.5 text-[10px] rounded capitalize transition-colors ${
                            settings.previewQuality === q
                              ? 'bg-amber-500 text-white'
                              : 'bg-[#2a2a2a] hover:bg-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hardware Acceleration */}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#a0a0a0]">Hardware Acceleration</label>
                    <button
                      onClick={() => useEditorStore.getState().updateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                      className={`w-8 h-4 rounded-full transition-colors relative ${settings.hardwareAcceleration ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.hardwareAcceleration ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Safe Zones */}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#a0a0a0]">Safe Zones</label>
                    <button
                      onClick={() => useEditorStore.getState().updateSettings({ showSafeZones: !settings.showSafeZones })}
                      className={`w-8 h-4 rounded-full transition-colors relative ${settings.showSafeZones ? 'bg-sky-500' : 'bg-[#3e3e3e]'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.showSafeZones ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: apply color overlays (temperature, tint, faded film, vignette)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Helper: draw media placeholder
// ---------------------------------------------------------------------------
function drawMediaPlaceholder(
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

function applyColorOverlays(
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


// ---------------------------------------------------------------------------
// Helper: apply Chroma Key / Green Screen background removal
// ---------------------------------------------------------------------------
function applyChromaKeyOnData(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  keyColorHex: string,
  threshold: number, // 0 to 100
  softness: number   // 0 to 100
) {
  try {
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Convert hex color to RGB
    const hex = keyColorHex.replace('#', '');
    const kr = parseInt(hex.substring(0, 2), 16) || 0;
    const kg = parseInt(hex.substring(2, 4), 16) || 255; // default to green
    const kb = parseInt(hex.substring(4, 6), 16) || 0;

    // Convert keyColor to YUV for cleaner chroma separation
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

      // Distance in UV chrominance space (ignores luminance differences)
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

// ---------------------------------------------------------------------------
// Helper: apply Luma Key / Luminance threshold removal
// ---------------------------------------------------------------------------
function applyLumaKeyOnData(
  oCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: 'dark' | 'light',
  threshold: number, // 0 to 100
  softness: number   // 0 to 100
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
      
      // Calculate standard luminance
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      
      if (type === 'dark') {
        if (luma < th) {
          data[i + 3] = 0;
        } else if (luma < th + soft && soft > 0) {
          const factor = (luma - th) / soft;
          data[i + 3] = Math.round(data[i + 3] * factor);
        }
      } else {
        // Light key (threshold is usually around 80-100%, meaning 204-255)
        // th corresponds to the high point. Wait, for light key, higher means keying out more brights.
        // If luma > th, then alpha = 0.
        // Softness means fade between th - soft and th.
        const lightTh = 255 - th; // If threshold is 100%, we key out everything. If 0%, key out nothing.
        
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

// ---------------------------------------------------------------------------
// Helper: apply 3-Way Color Wheels (Lift, Gamma, Gain / Shadows, Midtones, Highlights)
// ---------------------------------------------------------------------------
function applyColorGradingWheelsOnData(
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
    const factor = (sat / 100) * 0.15; // Max 15% color offset
    const brightness = (lift / 100) * 0.15; // Max 15% brightness offset

    return {
      r: Math.cos(rad) * factor + brightness,
      g: Math.cos(rad - (2 * Math.PI) / 3) * factor + brightness,
      b: Math.cos(rad + (2 * Math.PI) / 3) * factor + brightness,
    };
  };

  const sOff = getWheelOffsets(shadows);
  const mOff = getWheelOffsets(midtones);
  const hOff = getWheelOffsets(highlights);

  // If all offsets are zero, skip processing
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

      // Luminance (0.0 to 1.0)
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

      // Weights
      const w_s = Math.pow(1 - lum, 2);
      const w_h = Math.pow(lum, 2);
      const w_m = Math.max(0, 1 - w_s - w_h);

      // Interpolate offsets
      const dr = sOff.r * w_s + mOff.r * w_m + hOff.r * w_h;
      const dg = sOff.g * w_s + mOff.g * w_m + hOff.g * w_h;
      const db = sOff.b * w_s + mOff.b * w_m + hOff.b * w_h;

      // Apply
      data[i] = Math.min(255, Math.max(0, (r / 255 + dr) * 255));
      data[i + 1] = Math.min(255, Math.max(0, (g / 255 + dg) * 255));
      data[i + 2] = Math.min(255, Math.max(0, (b / 255 + db) * 255));
    }

    oCtx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Color grading wheels calculation error:', e);
  }
}

// ---------------------------------------------------------------------------
// Interactive Canvas Overlay Component
// ---------------------------------------------------------------------------
function InteractiveCanvasOverlay({ viewport }: { viewport: { x: number, y: number, zoom: number } }) {
  const {
    tracks,
    selectedClipId,
    selectedOverLayerId,
    currentTime,
    mediaLibrary,
    updateClip: storeUpdateClip,
    updateOverLayer,
    canvasTransformMode,
    setCanvasTransformMode,
    aspectRatio,
    useProxies,
  } = useEditorStore();

  const updateClip = useCallback((clipId: string, updates: any) => {
    const isOl = tracks.some((t) => (t.overLayers || []).some((ol) => ol.id === clipId));
    if (isOl) {
      updateOverLayer(clipId, updates);
    } else {
      storeUpdateClip(clipId, updates);
    }
  }, [tracks, storeUpdateClip, updateOverLayer]);

  const { videoElements } = useMediaPlayback();

  const [dragState, setDragState] = useState<{
    type: string;
    startX: number;
    startY: number;
    initTransform: any;
    initCrop: any;
    baseW?: number;
    baseH?: number;
    initCorners?: LocalCornerPoints;
  } | null>(null);
  
  const [snapGuides, setSnapGuides] = useState<{axis: 'x'|'y', position: number}[]>([]);

  let activeClip = null;
  let mediaItem = null;

  if (selectedOverLayerId) {
    for (const track of tracks) {
      if (track.hidden) continue;
      const ol = (track.overLayers || []).find((c) => c.id === selectedOverLayerId);
      if (ol && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
        activeClip = ol;
        mediaItem = mediaLibrary.find((m) => m.id === ol.mediaId) ||
          (ol.textSettings || ol.mediaId === 'text-placeholder'
            ? { id: ol.mediaId, name: 'Text', type: 'text', duration: ol.duration, url: '', createdAt: Date.now() }
            : null);
        break;
      }
    }
  } else if (selectedClipId) {
    for (const track of tracks) {
      if (track.hidden) continue;
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        activeClip = clip;
        mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) ||
          (clip.textSettings || clip.mediaId === 'text-placeholder'
            ? { id: clip.mediaId, name: 'Text', type: 'text', duration: clip.duration, url: '', createdAt: Date.now() }
            : null);
        break;
      }
    }
  }

  useEffect(() => {
    if (!dragState || !activeClip) return;
    const handleMove = (e: MouseEvent) => {
      const container = document.getElementById('preview-canvas-wrapper');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;

      // Adjust delta by viewport zoom so dragging feels natural at any zoom level
      const dx = ((e.clientX - dragState.startX) * scaleX) / viewport.zoom;
      const dy = ((e.clientY - dragState.startY) * scaleY) / viewport.zoom;

      let x = 0, y = 0, scale = 100, rotation = 0;
      if (dragState.initTransform) {
        x = dragState.initTransform.x;
        y = dragState.initTransform.y;
        scale = dragState.initTransform.scale;
        rotation = dragState.initTransform.rotation;
      }
      const crop = dragState.initCrop ? { ...dragState.initCrop } : { left: 0, top: 0, right: 0, bottom: 0 };
      
      const baseW = dragState.baseW || 854;
      const baseH = dragState.baseH || 480;

      let animations = activeClip.animations || {};
      const localTime = currentTime - activeClip.startTime;

      // Helper to update base or keyframe
      const getNewAnimations = (prop: string, val: number) => {
        if (animations[prop]) {
          animations = { ...animations, [prop]: addOrUpdateKeyframe(animations[prop], localTime, val) };
        }
      };

      if (dragState.type.startsWith('perspective-corner-')) {
        const cornerIdx = parseInt(dragState.type.split('-')[2]);
        const initCorners = dragState.initCorners!;
        const updatedCorners = { ...initCorners };

        const targetKeyX = `x${cornerIdx}` as keyof typeof initCorners;
        const targetKeyY = `y${cornerIdx}` as keyof typeof initCorners;

        updatedCorners[targetKeyX] = initCorners[targetKeyX] + dx;
        updatedCorners[targetKeyY] = initCorners[targetKeyY] + dy;

        const hasKeyframes =
          (animations[`transform.perspectiveCorners.x0`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y0`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x1`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y1`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x2`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y2`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x3`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y3`]?.length || 0) > 0;

        if (hasKeyframes) {
          const newAnimations = { ...animations };
          for (let i = 0; i < 4; i++) {
            const kx = `transform.perspectiveCorners.x${i}`;
            const ky = `transform.perspectiveCorners.y${i}`;
            const valX = updatedCorners[`x${i}` as keyof typeof updatedCorners];
            const valY = updatedCorners[`y${i}` as keyof typeof updatedCorners];

            newAnimations[kx] = addOrUpdateKeyframe(animations[kx] || [], localTime, valX);
            newAnimations[ky] = addOrUpdateKeyframe(animations[ky] || [], localTime, valY);
          }
          updateClip(activeClip.id, {
            transform: {
              ...activeClip.transform,
              perspectiveCorners: updatedCorners
            },
            animations: newAnimations
          });
        } else {
          updateClip(activeClip.id, {
            transform: {
              ...activeClip.transform,
              perspectiveCorners: updatedCorners
            }
          });
        }
        return;
      }

      if (dragState.type === 'move') {
        let newX = x + dx;
        let newY = y + dy;
        
        const newGuides: {axis: 'x'|'y', position: number}[] = [];
        const snapThreshold = 15; // px (before scaling)
        
        // Center snapping
        if (Math.abs(newX) < snapThreshold) {
          newX = 0;
          newGuides.push({ axis: 'x', position: 0 });
        }
        if (Math.abs(newY) < snapThreshold) {
          newY = 0;
          newGuides.push({ axis: 'y', position: 0 });
        }
        
        setSnapGuides(newGuides);
        
        getNewAnimations('transform.x', newX);
        getNewAnimations('transform.y', newY);
        x = newX;
        y = newY;
      } else if (dragState.type.startsWith('crop-')) {
        const theta = (-rotation * Math.PI) / 180;
        const localDx = (dx * Math.cos(theta) - dy * Math.sin(theta)) / (scale / 100);
        const localDy = (dx * Math.sin(theta) + dy * Math.cos(theta)) / (scale / 100);

        if (dragState.type === 'crop-left') {
          crop.left = Math.max(0, Math.min(100 - crop.right - 1, crop.left + (localDx / baseW) * 100));
          getNewAnimations('crop.left', crop.left);
        } else if (dragState.type === 'crop-right') {
          crop.right = Math.max(0, Math.min(100 - crop.left - 1, crop.right - (localDx / baseW) * 100));
          getNewAnimations('crop.right', crop.right);
        } else if (dragState.type === 'crop-top') {
          crop.top = Math.max(0, Math.min(100 - crop.bottom - 1, crop.top + (localDy / baseH) * 100));
          getNewAnimations('crop.top', crop.top);
        } else if (dragState.type === 'crop-bottom') {
          crop.bottom = Math.max(0, Math.min(100 - crop.top - 1, crop.bottom - (localDy / baseH) * 100));
          getNewAnimations('crop.bottom', crop.bottom);
        }
      } else if (dragState.type === 'rot') {
        const cx = 427 + x;
        const cy = 240 + y;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        let angle = Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
        angle += 90;
        rotation = Math.round(angle);
        getNewAnimations('transform.rotation', rotation);
      } else {
        const cx = 427 + x;
        const cy = 240 + y;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        
        const wSpan = baseW * (1 - (crop.left + crop.right) / 100) / 2;
        const hSpan = baseH * (1 - (crop.top + crop.bottom) / 100) / 2;
        
        const origDist = Math.sqrt(wSpan ** 2 + hSpan ** 2) * (dragState.initTransform.scale / 100);
        const scaleDelta = dist / origDist;
        scale = dragState.initTransform.scale * scaleDelta;
        scale = Math.max(10, Math.min(1000, Math.round(scale)));
        getNewAnimations('transform.scale', scale);
      }

      updateClip(activeClip.id, { transform: { ...activeClip.transform, x, y, scale, rotation }, crop, animations });
    };

    const handleUp = () => {
      setDragState(null);
      setSnapGuides([]);
      useEditorStore.getState().saveSnapshot();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, activeClip, updateClip, mediaItem, videoElements, viewport, currentTime, aspectRatio]);

  if (!activeClip) return null;

  // Determine active viewport dimensions based on aspect ratio
  let viewW = 854;
  let viewH = 480;
  if (aspectRatio === '9:16') {
    viewW = Math.round(480 * (9 / 16));
  } else if (aspectRatio === '1:1') {
    viewW = 480;
  } else if (aspectRatio === '4:3') {
    viewW = Math.round(480 * (4 / 3));
  }
  const W = viewW;
  const H = viewH;
  const offsetX = (854 - viewW) / 2;
  const offsetY = (480 - viewH) / 2;

  let vw = W;
  let vh = H;
  if (mediaItem?.type === 'video') {
    const v = videoElements.get(activeClip.id);
    if (v && v.videoWidth > 0) {
      vw = v.videoWidth;
      vh = v.videoHeight;
    }
  } else if (mediaItem?.type === 'image') {
    // @ts-ignore
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      vw = img.naturalWidth;
      vh = img.naturalHeight;
    }
  } else if (mediaItem?.type === 'text' || (activeClip as any).textSettings || (activeClip as any).mediaId === 'text-placeholder') {
    // Estimate text bounding box from textSettings
    const ts = (activeClip as any).textSettings;
    if (ts) {
      const fontSize = Number(ts.fontSize) || 48;
      const text = String(ts.text || '');
      const lines = text.split('\n');
      const estCharWidth = fontSize * 0.6;
      const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
      vw = Math.max(80, longestLine * estCharWidth + 40);
      vh = lines.length * (fontSize * 1.35) + 20;
    } else {
      // Generic text box
      vw = 300;
      vh = 80;
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / vw, H / vh);
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;

  const aX = getAnimatedValue(activeClip.transform.x, currentTime, activeClip.startTime, activeClip.animations?.['transform.x']);
  const aY = getAnimatedValue(activeClip.transform.y, currentTime, activeClip.startTime, activeClip.animations?.['transform.y']);
  const aScale = getAnimatedValue(activeClip.transform.scale, currentTime, activeClip.startTime, activeClip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(activeClip.transform.rotation, currentTime, activeClip.startTime, activeClip.animations?.['transform.rotation']);

  const aCropLeft = getAnimatedValue(activeClip.crop?.left || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.left']);
  const aCropTop = getAnimatedValue(activeClip.crop?.top || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.top']);
  const aCropRight = getAnimatedValue(activeClip.crop?.right || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.right']);
  const aCropBot = getAnimatedValue(activeClip.crop?.bottom || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.bottom']);

  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initTransform: { x: aX, y: aY, scale: aScale, rotation: aRot },
      initCrop: { left: aCropLeft, top: aCropTop, right: aCropRight, bottom: aCropBot },
      baseW,
      baseH,
    });
  };

  const cx = 854 / 2;
  const cy = 480 / 2;
  const totalX = cx + viewport.x - cx * viewport.zoom;
  const totalY = cy + viewport.y - cy * viewport.zoom;

  const pcBase = activeClip.transform.perspectiveCorners || {
    x0: W / 2 + aX - (baseW / 2) * (aScale / 100),
    y0: H / 2 + aY - (baseH / 2) * (aScale / 100),
    x1: W / 2 + aX + (baseW / 2) * (aScale / 100),
    y1: H / 2 + aY - (baseH / 2) * (aScale / 100),
    x2: W / 2 + aX + (baseW / 2) * (aScale / 100),
    y2: H / 2 + aY + (baseH / 2) * (aScale / 100),
    x3: W / 2 + aX - (baseW / 2) * (aScale / 100),
    y3: H / 2 + aY + (baseH / 2) * (aScale / 100)
  };

  let pc = { ...pcBase };
  
  if (activeClip.transform.perspectivePin) {
    let trackedCorners = null;
    const trackingData = activeClip.transform.perspectiveTrackingData;
    if (trackingData && trackingData.length > 0) {
      const localTime = currentTime - activeClip.startTime;
      let closestDist = Infinity;
      for (const pt of trackingData) {
        const dist = Math.abs(pt.time - localTime);
        if (dist < closestDist) {
          closestDist = dist;
          trackedCorners = pt.corners;
        }
      }
    }
    
    if (trackedCorners) {
      pc = { ...trackedCorners };
    } else {
      pc = {
        x0: getAnimatedValue(pcBase.x0, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x0']),
        y0: getAnimatedValue(pcBase.y0, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y0']),
        x1: getAnimatedValue(pcBase.x1, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x1']),
        y1: getAnimatedValue(pcBase.y1, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y1']),
        x2: getAnimatedValue(pcBase.x2, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x2']),
        y2: getAnimatedValue(pcBase.y2, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y2']),
        x3: getAnimatedValue(pcBase.x3, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x3']),
        y3: getAnimatedValue(pcBase.y3, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y3']),
      };
    }
  }

  const handleCornerMouseDown = (e: React.MouseEvent, cornerIdx: number) => {
    e.stopPropagation();
    setDragState({
      type: `perspective-corner-${cornerIdx}`,
      startX: e.clientX,
      startY: e.clientY,
      initTransform: null,
      initCrop: null,
      initCorners: { ...pc }
    });
  };

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" id="preview-canvas-wrapper-overlay">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 854 480">
          <g transform={`translate(${totalX}, ${totalY}) scale(${viewport.zoom}) translate(${offsetX}, ${offsetY})`}>
            {activeClip.transform.perspectivePin ? (
              <g>
                {/* Connected lines */}
                <polygon
                  points={`${pc.x0},${pc.y0} ${pc.x1},${pc.y1} ${pc.x2},${pc.y2} ${pc.x3},${pc.y3}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={1.5 / viewport.zoom}
                />
                
                {/* 4 corner circles */}
                {([0, 1, 2, 3] as const).map((idx) => {
                  const cx = pc[`x${idx}` as keyof typeof pc];
                  const cy = pc[`y${idx}` as keyof typeof pc];
                  return (
                    <circle
                      key={`corner-${idx}`}
                      cx={cx}
                      cy={cy}
                      r={7 / viewport.zoom}
                      fill="#fbbf24"
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-crosshair"
                      onMouseDown={(e) => handleCornerMouseDown(e, idx)}
                    />
                  );
                })}
              </g>
            ) : (
              <g
                transform={`translate(${W / 2 + aX}, ${H / 2 + aY}) rotate(${aRot}) scale(${aScale / 100})`}
              >
                {/* Main selection border */}
                <rect
                  x={-baseW / 2}
                  y={-baseH / 2}
                  width={baseW}
                  height={baseH}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={1.5 / viewport.zoom}
                  className="pointer-events-none"
                />

                {canvasTransformMode === 'resize' ? (
                  <>
                    {/* Invisible drag area for moving */}
                    <rect
                      x={-baseW / 2}
                      y={-baseH / 2}
                      width={baseW}
                      height={baseH}
                      fill="transparent"
                      className="pointer-events-auto cursor-move"
                      onMouseDown={(e) => handleMouseDown(e, 'move')}
                    />
                    {/* Rotation handle — circle above the top-center of the clip */}
                    <line
                      x1={0}
                      y1={-baseH / 2}
                      x2={0}
                      y2={-baseH / 2 - 24 / viewport.zoom}
                      stroke="#fbbf24"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    <circle
                      cx={0}
                      cy={-baseH / 2 - 28 / viewport.zoom}
                      r={6 / viewport.zoom}
                      fill="#fbbf24"
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-alias"
                      onMouseDown={(e) => handleMouseDown(e, 'rot')}
                    >
                      <title>Rotate</title>
                    </circle>
                    {/* Resize handles */}
                    {[-1, 1].map((rx) =>
                      [-1, 1].map((ry) => (
                        <circle
                          key={`${rx}-${ry}`}
                          cx={(rx * baseW) / 2}
                          cy={(ry * baseH) / 2}
                          r={6 / viewport.zoom}
                          fill="#fbbf24"
                          stroke="#141414"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto"
                          style={{
                            cursor: rx === ry ? 'nwse-resize' : 'nesw-resize',
                          }}
                          onMouseDown={(e) =>
                            handleMouseDown(e, `resize-${rx > 0 ? 'r' : 'l'}${ry > 0 ? 'b' : 't'}`)
                          }
                        />
                      )),
                    )}
                  </>
                ) : (
                  // CROP MODE
                  <>
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW}
                      y={-baseH / 2 + (aCropTop / 100) * baseH}
                      width={baseW * (1 - (aCropLeft + aCropRight) / 100)}
                      height={baseH * (1 - (aCropTop + aCropBot) / 100)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2 / viewport.zoom}
                      strokeDasharray="4 4"
                      className="pointer-events-none"
                    />
                    {/* Crop drag handles */}
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-left')}
                    />
                    <rect
                      x={-baseW / 2 + baseW - (aCropRight / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-right')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-top')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + baseH - (aCropBot / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-bottom')}
                    />
                  </>
                )}
              </g>
            )}
            
            {/* Smart Guides */}
            {snapGuides.map((g, i) => (
              <line
                key={`guide-${i}`}
                x1={g.axis === 'x' ? W/2 + g.position : 0}
                y1={g.axis === 'y' ? H/2 + g.position : 0}
                x2={g.axis === 'x' ? W/2 + g.position : W}
                y2={g.axis === 'y' ? H/2 + g.position : H}
                stroke="#ff00ff"
                strokeWidth={1/viewport.zoom}
                strokeDasharray="4,4"
              />
            ))}
          </g>
        </svg>
      </div>

      <div className="absolute top-4 right-4 bg-[#252525] border border-[#3e3e3e] rounded flex overflow-hidden shadow-lg pointer-events-auto z-10">
        <button
          className={`p-2 transition-colors ${
            canvasTransformMode === 'resize' ? 'bg-[#3e3e3e] text-amber-500' : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
          }`}
          onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('resize'); }}
          title="Transform Mode"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          className={`p-2 transition-colors ${
            canvasTransformMode === 'crop' ? 'bg-[#3e3e3e] text-amber-500' : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
          }`}
          onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('crop'); }}
          title="Crop Mode"
        >
          <Scissors className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
