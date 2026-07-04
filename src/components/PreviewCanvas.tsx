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
  RotateCcw,
  Scissors,
  Grid,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { formatTime } from '@/utils/time';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { applyLutToCanvas } from '@/utils/lutParser';

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

function getCachedImage(
  mediaId: string,
  url: string,
  onLoad: () => void,
): HTMLImageElement | null {
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

// Module-level particle pools keyed by clipId
const particlePools = new Map<string, ParticlePool>();

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
): void {
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
  } = useEditorStore();

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const hasClips = tracks.some((t) => t.clips.length > 0);

  // Real video elements for drawing frames
  const videoElements = useMediaPlayback();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glitchRedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glitchBlueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelateCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastParticleTimeRef = useRef<number | null>(null);

  const getOrCreateCanvas = (ref: React.MutableRefObject<HTMLCanvasElement | null>, w: number, h: number) => {
    if (!ref.current) {
      ref.current = document.createElement('canvas');
    }
    // Setting width and height resets the canvas state and resizes its backing store.
    if (ref.current.width !== w) ref.current.width = w;
    if (ref.current.height !== h) ref.current.height = h;
    return ref.current;
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
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
    for (const clipId of particlePools.keys()) {
      if (!allClipIds.has(clipId)) {
        particlePools.delete(clipId);
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
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // -------------------------------------------------------------------
  // Playback loop – advance currentTime via rAF when playing
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();

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
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: !settings.hardwareAcceleration });
    if (!ctx) return;

    // Measure frame time delta
    const now = performance.now();
    const lastTime = lastParticleTimeRef.current ?? now;
    lastParticleTimeRef.current = now;
    const rawDelta = isPlaying ? (now - lastTime) : 0;
    const deltaMs = Math.min(100, rawDelta); // clamp to 100ms max to prevent physics jumps

    const W_target = 854;
    const H_target = 480;
    const canvas_scale = canvas.width / W_target;

    // 1. Clear to background color (entire canvas, regardless of viewport)
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(canvas_scale, canvas_scale);

    const W = W_target;
    const H = H_target;

    const cx = W / 2;
    const cy = H / 2;
    const totalX = cx + viewport.x - cx * viewport.zoom;
    const totalY = cy + viewport.y - cy * viewport.zoom;

    ctx.save();
    ctx.translate(totalX, totalY);
    ctx.scale(viewport.zoom, viewport.zoom);

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

    // Helper to draw a single clip with custom opacity/transform multipliers
    const drawSingleClip = (
      clip: any,
      opacityMultiplier: number = 1,
      extraTransform?: { translateX?: number; translateY?: number; scale?: number }
    ) => {
      const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
      if (!mediaItem) return;

      // Get animated values
      const aOpacity = getAnimatedValue(clip.opacity, currentTime, clip.startTime, clip.animations?.opacity);
      const aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
      const aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
      const aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
      const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

      const aCropTop = getAnimatedValue(clip.crop?.top || 0, currentTime, clip.startTime, clip.animations?.['crop.top']);
      const aCropBot = getAnimatedValue(clip.crop?.bottom || 0, currentTime, clip.startTime, clip.animations?.['crop.bottom']);
      const aCropLeft = getAnimatedValue(clip.crop?.left || 0, currentTime, clip.startTime, clip.animations?.['crop.left']);
      const aCropRight = getAnimatedValue(clip.crop?.right || 0, currentTime, clip.startTime, clip.animations?.['crop.right']);

      // Set up transform
      ctx.save();
      ctx.globalAlpha = aOpacity * opacityMultiplier;
      ctx.globalCompositeOperation = clip.transform.blendMode || 'source-over';

      const cx = W / 2;
      const cy = H / 2;

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

      if (mediaItem.type === 'video') {
        const videoEl = videoElements.get(clip.id);
        if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          // Fit the video into the canvas while preserving aspect ratio
          const vw = videoEl.videoWidth || W;
          const vh = videoEl.videoHeight || H;
          const scale = Math.min(W / vw, H / vh);
          
          const baseDw = vw * scale;
          const baseDh = vh * scale;

          const sx = vw * cLeft;
          const sy = vh * cTop;
          const sw = Math.max(1, vw * (1 - cLeft - cRight));
          const sh = Math.max(1, vh * (1 - cTop - cBot));

          dw = Math.max(1, baseDw * (1 - cLeft - cRight));
          dh = Math.max(1, baseDh * (1 - cTop - cBot));
          const dx = -baseDw / 2 + baseDw * cLeft;
          const dy = -baseDh / 2 + baseDh * cTop;

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasChroma = clip.chromaKey?.enabled;
          if (hasWheels || hasChroma) {
            const offscreenWidth = Math.max(1, Math.round(dw));
            const offscreenHeight = Math.max(1, Math.round(dh));
            const offscreen = getOrCreateCanvas(offscreenCanvasRef, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
              if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
              }
              if (hasWheels) {
                applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
              }
              ctx.drawImage(offscreen, dx, dy, dw, dh);
            } else {
              ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, dw, dh);
            }
          } else {
            ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, dw, dh);
          }
          ctx.filter = 'none';
          hasRealMedia = true;
          anyClipDrawn = true;
        } else {
          // Video not ready yet – draw placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'VIDEO', '#3b82f6');
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
          const dx = -baseDw / 2 + baseDw * cLeft;
          const dy = -baseDh / 2 + baseDh * cTop;

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

          // Apply standard filters and optional 3-way color grading wheels
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          const hasWheels = filters.shadows || filters.midtones || filters.highlights;
          const hasChroma = clip.chromaKey?.enabled;
          if (hasWheels || hasChroma) {
            const offscreenWidth = Math.max(1, Math.round(dw));
            const offscreenHeight = Math.max(1, Math.round(dh));
            const offscreen = getOrCreateCanvas(offscreenCanvasRef, offscreenWidth, offscreenHeight);
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              oCtx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
              if (hasChroma && clip.chromaKey) {
                applyChromaKeyOnData(oCtx, offscreen.width, offscreen.height, clip.chromaKey.color, clip.chromaKey.threshold, clip.chromaKey.softness);
              }
              if (hasWheels) {
                applyColorGradingWheelsOnData(oCtx, offscreen.width, offscreen.height, filters.shadows, filters.midtones, filters.highlights);
              }
              ctx.drawImage(offscreen, dx, dy, dw, dh);
            } else {
              ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            }
          } else {
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
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
      } else if (mediaItem.type === 'text') {
        // Use clip textSettings or fall back to sensible defaults so text is always visible
        const rawTs = clip.textSettings as any;
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

          if (ts.shadow) {
            ctx.shadowColor = ts.shadowColor;
            ctx.shadowBlur  = ts.shadowBlur;
          }

          // 3D depth layers
          if (ts.threeD) {
            ctx.fillStyle = ts.shadowColor;
            for (let d = 1; d <= (ts.threeDDepth || 4); d++) {
              ctx.fillText(line, textX + d, lineY + d);
            }
          }

          ctx.shadowBlur = 0;

          // Stroke
          if (ts.strokeWidth > 0) {
            ctx.strokeStyle = ts.strokeColor;
            ctx.lineWidth   = ts.strokeWidth;
            ctx.lineJoin    = 'round';
            ctx.strokeText(line, textX, lineY);
          }

          // Fill
          ctx.fillStyle = ts.color;
          ctx.fillText(line, textX, lineY);
        });

        ctx.shadowBlur = 0;
        ctx.restore(); // restore animation sub-transform

        hasRealMedia  = true;
        anyClipDrawn  = true;
      }

      // Apply temperature, tint, faded film, and vignette overlays on top of the drawn media
      if (hasRealMedia && mediaItem.type !== 'text') {
        applyColorOverlays(ctx, dw, dh, filters);
      }

      // Apply FX layer if active
      if (hasRealMedia && activeFxClip) {
        const fx = activeFxClip.fxSettings;

        // ── Pixel-space origin: getImageData/putImageData use RAW canvas coords, NOT transform-space ──
        // ctx is currently translated to (W/2 + aX + ...), so the clip center in pixel-space is:
        const pxL = Math.round(W / 2 - dw / 2);  // left edge in canvas pixel coords
        const pxT = Math.round(H / 2 - dh / 2);  // top edge in canvas pixel coords
        const pxW = Math.max(1, Math.round(dw));
        const pxH = Math.max(1, Math.round(dh));

        if (fx?.type === 'vfx_breakdown') {
          // Draw enhanced version over it, clipped by vfxProgress (transform-space is fine for drawImage/clip)
          ctx.save();
          ctx.beginPath();
          ctx.rect(-dw / 2, -dh / 2, dw * vfxProgress, dh);
          ctx.clip();

          if (mediaItem.type === 'video') {
            const videoEl = videoElements.get(clip.id);
            if (videoEl && videoEl.readyState >= 2) {
              const vw = videoEl.videoWidth || W;
              const vh = videoEl.videoHeight || H;
              const scale = Math.min(W / vw, H / vh);
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
              ctx.filter = `brightness(${120 + exposure}%) contrast(150%) saturate(200%)`;
              ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, drawW, drawH);
              ctx.filter = 'none';
              applyColorOverlays(ctx, dw, dh, { ...filters, contrast: 150, saturation: 200 });
            }
          }

          // Neon wipe line
          ctx.beginPath();
          ctx.moveTo(-dw / 2 + dw * vfxProgress, -dh / 2);
          ctx.lineTo(-dw / 2 + dw * vfxProgress,  dh / 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#3b82f6';
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 15;
          ctx.stroke();
          ctx.restore();

        } else if (fx?.type === 'bw_to_color') {
          const progress = (currentTime - activeFxClip.startTime) / activeFxClip.duration;
          const p = Math.max(0, Math.min(1, progress));
          if (p < 1) {
            // FIXED: use absolute pixel coords for getImageData
            const imgData = ctx.getImageData(pxL, pxT, pxW, pxH);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i]     = Math.round(luma + (data[i]     - luma) * p);
              data[i + 1] = Math.round(luma + (data[i + 1] - luma) * p);
              data[i + 2] = Math.round(luma + (data[i + 2] - luma) * p);
            }
            ctx.putImageData(imgData, pxL, pxT);
          }

        } else if (fx?.type === 'old_film') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 24);
          const rand = (n: number) => ((Math.sin(seed * 7.3 + n * 113.7) * 43758.5) % 1 + 1) % 1;

          // Sepia overlay (transform-space fillRect is fine)
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.35 * intensity;
          ctx.fillStyle = 'rgb(200,160,110)';
          ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          ctx.restore();

          // Grain (transform-space fillRect)
          ctx.save();
          ctx.globalAlpha = 0.18 * intensity;
          const grainSize = 2;
          for (let gy = -dh / 2; gy < dh / 2; gy += grainSize) {
            for (let gx = -dw / 2; gx < dw / 2; gx += grainSize) {
              const v = rand(gx * 0.3 + gy * 0.7 + seed) > 0.5 ? 255 : 0;
              ctx.fillStyle = `rgba(${v},${v},${v},0.6)`;
              ctx.fillRect(gx, gy, grainSize, grainSize);
            }
          }
          ctx.restore();

          // Occasional scratch line
          if (rand(99) > 0.85) {
            ctx.save();
            ctx.globalAlpha = 0.5 * intensity;
            ctx.strokeStyle = 'rgba(255,240,180,0.7)';
            ctx.lineWidth = 1;
            const scratchX = -dw / 2 + rand(55) * dw;
            ctx.beginPath();
            ctx.moveTo(scratchX, -dh / 2);
            ctx.lineTo(scratchX + (rand(77) - 0.5) * 10, dh / 2);
            ctx.stroke();
            ctx.restore();
          }

          // Vignette
          ctx.save();
          const vig = ctx.createRadialGradient(0, 0, dw * 0.3, 0, 0, dw * 0.7);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, `rgba(0,0,0,${0.55 * intensity})`);
          ctx.fillStyle = vig;
          ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          ctx.restore();

        } else if (fx?.type === 'vhs') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 30);
          const rand = (n: number) => ((Math.sin(seed * 11.3 + n * 97.4) * 43758.5) % 1 + 1) % 1;

          ctx.save();
          ctx.globalAlpha = 0.25 * intensity;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = 'rgba(255,0,0,0.15)';
          ctx.fillRect(-dw / 2 + 6 * intensity, -dh / 2, dw, dh);
          ctx.fillStyle = 'rgba(0,0,255,0.15)';
          ctx.fillRect(-dw / 2 - 6 * intensity, -dh / 2, dw, dh);
          ctx.restore();

          ctx.save();
          ctx.globalAlpha = 0.2 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 3) {
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.fillRect(-dw / 2, row, dw, 1);
          }
          ctx.restore();

          if (rand(1) > 0.7) {
            ctx.save();
            ctx.globalAlpha = 0.3 * intensity;
            const bandY = -dh / 2 + rand(2) * dh;
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(-dw / 2, bandY, dw, 4 + rand(3) * 20);
            ctx.restore();
          }

          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.12 * intensity;
          ctx.fillStyle = 'rgb(180,255,180)';
          ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          ctx.restore();

        } else if (fx?.type === 'cinematic_bars') {
          const barH = dh * 0.105;
          ctx.save();
          ctx.fillStyle = 'rgb(0,0,0)';
          ctx.fillRect(-dw / 2, -dh / 2,       dw, barH);
          ctx.fillRect(-dw / 2,  dh / 2 - barH, dw, barH);
          ctx.restore();

        } else if (fx?.type === 'neon_glow') {
          const intensity = (fx.intensity ?? 100) / 100;
          ctx.save();
          ctx.globalAlpha = 0.45 * intensity;
          ctx.globalCompositeOperation = 'screen';
          ctx.filter = `blur(${6 * intensity}px) brightness(1.8)`;
          if (mediaItem.type === 'video') {
            const videoEl = videoElements.get(clip.id);
            if (videoEl && videoEl.readyState >= 2) {
              ctx.drawImage(videoEl, -dw / 2, -dh / 2, dw, dh);
            }
          }
          ctx.restore();

          ctx.save();
          ctx.globalAlpha = 0.15 * intensity;
          ctx.globalCompositeOperation = 'screen';
          const neonGrad = ctx.createLinearGradient(-dw / 2, 0, dw / 2, 0);
          neonGrad.addColorStop(0, 'rgba(255,0,200,0.8)');
          neonGrad.addColorStop(1, 'rgba(0,200,255,0.8)');
          ctx.fillStyle = neonGrad;
          ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          ctx.restore();

        } else if (fx?.type === 'rgb_split') {
          const intensity = (fx.intensity ?? 100) / 100;
          const shift = intensity * 14;
          // Use offscreen canvas to isolate channels — avoids ImageData coord issues
          if (mediaItem.type === 'video') {
            const videoEl = videoElements.get(clip.id);
            if (videoEl && videoEl.readyState >= 2) {
              ctx.save();
              ctx.globalAlpha = 0.55;
              ctx.globalCompositeOperation = 'screen';

              const offR = getOrCreateCanvas(glitchRedCanvasRef, pxW, pxH);
              const ctxR = offR.getContext('2d')!;
              ctxR.drawImage(videoEl, 0, 0, pxW, pxH);
              const dR = ctxR.getImageData(0, 0, pxW, pxH);
              for (let i = 0; i < dR.data.length; i += 4) { dR.data[i+1] = 0; dR.data[i+2] = 0; }
              ctxR.putImageData(dR, 0, 0);
              ctx.drawImage(offR, -dw / 2 - shift, -dh / 2, dw, dh);

              const offB = getOrCreateCanvas(glitchBlueCanvasRef, pxW, pxH);
              const ctxB = offB.getContext('2d')!;
              ctxB.drawImage(videoEl, 0, 0, pxW, pxH);
              const dB = ctxB.getImageData(0, 0, pxW, pxH);
              for (let i = 0; i < dB.data.length; i += 4) { dB.data[i] = 0; dB.data[i+1] = 0; }
              ctxB.putImageData(dB, 0, 0);
              ctx.drawImage(offB, -dw / 2 + shift, -dh / 2, dw, dh);
              ctx.restore();
            }
          }

        } else if (fx?.type === 'pixelate') {
          const intensity = (fx.intensity ?? 100) / 100;
          const blockSize = Math.max(2, Math.round(intensity * 24));
          const tmpW = Math.max(1, Math.round(pxW / blockSize));
          const tmpH = Math.max(1, Math.round(pxH / blockSize));
          const tmp = getOrCreateCanvas(pixelateCanvasRef, tmpW, tmpH);
          const tCtx = tmp.getContext('2d')!;
          // FIXED: use pxL, pxT (absolute pixel coords) as the source rect from the main canvas
          tCtx.drawImage(ctx.canvas, pxL, pxT, pxW, pxH, 0, 0, tmpW, tmpH);
          tCtx.imageSmoothingEnabled = false;
          ctx.save();
          (ctx as any).imageSmoothingEnabled = false;
          // Draw back in transform-space
          ctx.drawImage(tmp, 0, 0, tmpW, tmpH, -dw / 2, -dh / 2, dw, dh);
          ctx.restore();

        } else if (fx?.type === 'mirror') {
          // FIXED: read left half in pixel-space, flip onto right half in pixel-space
          const halfW = Math.max(1, Math.round(pxW / 2));
          const leftData = ctx.getImageData(pxL, pxT, halfW, pxH);
          // Flip horizontally into a temp canvas
          const flip = getOrCreateCanvas(mirrorCanvasRef, halfW, pxH);
          const fCtx = flip.getContext('2d')!;
          fCtx.putImageData(leftData, 0, 0);
          // Draw flipped onto right half in transform-space
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(flip, 0, 0, halfW, pxH, -dw / 2, -dh / 2, dw / 2, dh);
          ctx.restore();

        } else if (fx?.type === 'zoom_blur') {
          const intensity = (fx.intensity ?? 100) / 100;
          const steps = Math.round(6 + intensity * 8);
          ctx.save();
          ctx.globalAlpha = 0.25 / steps;
          for (let i = 1; i <= steps; i++) {
            const s = 1 + (i / steps) * 0.1 * intensity;
            ctx.save();
            ctx.scale(s, s);
            if (mediaItem.type === 'video') {
              const videoEl = videoElements.get(clip.id);
              if (videoEl && videoEl.readyState >= 2) {
                ctx.drawImage(videoEl, -dw / 2, -dh / 2, dw, dh);
              }
            }
            ctx.restore();
          }
          ctx.restore();

        } else if (fx?.type === 'lens_flare') {
          const intensity = (fx.intensity ?? 100) / 100;
          const fcx = dw * 0.2, fcy = -dh * 0.25;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const flareGrad = ctx.createRadialGradient(fcx, fcy, 0, fcx, fcy, 90 * intensity);
          flareGrad.addColorStop(0,    `rgba(255,255,220,${0.9  * intensity})`);
          flareGrad.addColorStop(0.15, `rgba(255,200,100,${0.5  * intensity})`);
          flareGrad.addColorStop(0.5,  `rgba(200,180,255,${0.15 * intensity})`);
          flareGrad.addColorStop(1,    'rgba(0,0,0,0)');
          ctx.fillStyle = flareGrad;
          ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          // Anamorphic horizontal streak
          ctx.globalAlpha = 0.35 * intensity;
          const streakGrad = ctx.createLinearGradient(-dw / 2, fcy, dw / 2, fcy);
          streakGrad.addColorStop(0,   'rgba(100,150,255,0)');
          streakGrad.addColorStop(0.5, `rgba(150,210,255,${0.85 * intensity})`);
          streakGrad.addColorStop(1,   'rgba(100,150,255,0)');
          ctx.fillStyle = streakGrad;
          ctx.fillRect(-dw / 2, fcy - 2, dw, 4);
          ctx.restore();

        } else if (fx?.type === 'night_vision') {
          const intensity = (fx.intensity ?? 100) / 100;
          // FIXED: absolute pixel coords
          const imgData = ctx.getImageData(pxL, pxT, pxW, pxH);
          const data = imgData.data;
          const seed = Math.floor(currentTime * 30);
          const rand = (n: number) => ((Math.sin(seed * 3.1 + n * 91.7) * 43758.5) % 1 + 1) % 1;
          for (let i = 0; i < data.length; i += 4) {
            const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const noise = (rand(i * 0.001) - 0.5) * 30 * intensity;
            const v = Math.min(255, Math.max(0, luma * 1.4 + noise));
            data[i]     = 0;
            data[i + 1] = Math.round(v);
            data[i + 2] = 0;
          }
          ctx.putImageData(imgData, pxL, pxT);

          // Scan lines (transform-space)
          ctx.save();
          ctx.globalAlpha = 0.12 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.fillRect(-dw / 2, row, dw, 1);
          }
          ctx.restore();

        } else if (fx?.type === 'thermal') {
          const intensity = (fx.intensity ?? 100) / 100;
          // FIXED: absolute pixel coords
          const imgData = ctx.getImageData(pxL, pxT, pxW, pxH);
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
          ctx.putImageData(imgData, pxL, pxT);

        } else if (fx?.type === 'glitch') {
          const intensity = (fx.intensity ?? 100) / 100;
          const seed = Math.floor(currentTime * 30);
          const rand = (n: number) => ((Math.sin(seed * 9.7 + n * 127.3) * 43758.5453) % 1 + 1) % 1;

          // Chromatic aberration
          const aberration = intensity * 8 * rand(1);
          ctx.save();
          ctx.globalAlpha = 0.45;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = `rgba(255, 0, 0, 0.3)`;
          ctx.fillRect(-dw / 2 - aberration, -dh / 2, dw, dh);
          ctx.fillStyle = `rgba(0, 0, 255, 0.3)`;
          ctx.fillRect(-dw / 2 + aberration, -dh / 2, dw, dh);
          ctx.restore();

          // Scan lines
          ctx.save();
          ctx.globalAlpha = 0.15 * intensity;
          for (let row = -dh / 2; row < dh / 2; row += 4) {
            if (rand(row + 5) > 0.5) {
              ctx.fillStyle = 'rgba(0,0,0,0.8)';
              ctx.fillRect(-dw / 2, row, dw, 2);
            }
          }
          ctx.restore();

          // Slice distortion
          const numSlices = Math.floor(3 + rand(2) * 6 * intensity);
          ctx.save();
          ctx.globalAlpha = 0.65 * intensity;
          for (let i = 0; i < numSlices; i++) {
            const sliceY    = -dh / 2 + rand(i * 3) * dh;
            const sliceH    = 2 + rand(i * 3 + 1) * 8;
            const sliceShift = (rand(i * 3 + 2) - 0.5) * 40 * intensity;
            ctx.fillStyle = `rgba(${Math.floor(rand(i*7)*255)},${Math.floor(rand(i*7+1)*100)},${Math.floor(rand(i*7+2)*255)},0.5)`;
            ctx.fillRect(-dw / 2 + sliceShift, sliceY, dw, sliceH);
          }
          ctx.restore();
        }
      }
      ctx.restore();
    };

    // Pass 1: Render main clips and transitions for all visual tracks
    for (const track of visualTracks) {
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
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
        try {
          const { clipA, clipB, trans, t } = activeTransition;
          const type = trans.type;
          const nameLower = trans.name.toLowerCase();

          if (nameLower.includes('dissolve')) {
            drawSingleClip(clipA, 1 - t);
            drawSingleClip(clipB, t);
          } else if (nameLower.includes('fade')) {
            if (t < 0.5) {
              drawSingleClip(clipA, 1 - t * 2);
            } else {
              drawSingleClip(clipB, (t - 0.5) * 2);
            }
          } else if (type === 'wipe') {
            if (nameLower.includes('left')) {
              drawSingleClip(clipA, 1);
              ctx.save();
              ctx.beginPath();
              ctx.rect(W * (1 - t), 0, W * t, H);
              ctx.clip();
              drawSingleClip(clipB, 1);
              ctx.restore();
            } else {
              drawSingleClip(clipA, 1);
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, 0, W * t, H);
              ctx.clip();
              drawSingleClip(clipB, 1);
              ctx.restore();
            }
          } else if (type === 'slide') {
            if (nameLower.includes('up')) {
              drawSingleClip(clipA, 1, { translateY: -H * t });
              drawSingleClip(clipB, 1, { translateY: H * (1 - t) });
            } else if (nameLower.includes('down')) {
              drawSingleClip(clipA, 1, { translateY: H * t });
              drawSingleClip(clipB, 1, { translateY: -H * (1 - t) });
            } else {
              drawSingleClip(clipA, 1, { translateX: -W * t });
              drawSingleClip(clipB, 1, { translateX: W * (1 - t) });
            }
          } else if (type === 'zoom') {
            if (nameLower.includes('out')) {
              drawSingleClip(clipB, 1);
              drawSingleClip(clipA, 1 - t, { scale: 1 - t });
              drawSingleClip(clipB, t, { scale: t });
            }
          } else {
            drawSingleClip(clipA, 1 - t);
            drawSingleClip(clipB, t);
          }
        } catch (err) {
          console.error('[CanvasRenderError] Failed to draw transition:', err);
          try { ctx.restore(); } catch (_) {}
        }
        continue;
      }

      const clip = sortedClips.find(
        (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration,
      );
      if (clip) {
        try {
          drawSingleClip(clip, 1);
        } catch (err) {
          console.error('[CanvasRenderError] Failed to draw clip:', clip.id, err);
          try { ctx.restore(); } catch (_) {}
        }
      }
    }

    // Pass 2: Draw active over-layers on top of all main track clips for all visual tracks
    for (const track of visualTracks) {
      const activeOverLayers = (track.overLayers || []).filter(
        (ol) => ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration
      );

      for (const ol of activeOverLayers) {
        try {
          drawSingleClip(ol as any, 1);
        } catch (err) {
          console.error('[CanvasRenderError] Failed to draw over layer:', ol.id, err);
          try { ctx.restore(); } catch (_) {}
        }
      }
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
        if (clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          renderParticles(ctx, clip.id, clip.particleSettings, W, H, deltaMs);
        }
      }
      for (const ol of track.overLayers || []) {
        if (ol.particleSettings && ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
          renderParticles(ctx, ol.id, ol.particleSettings, W, H, deltaMs);
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
        ctx.moveTo(c * cellW, 0);
        ctx.lineTo(c * cellW, H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(W, r * cellH);
        ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.setLineDash([]);

      // Rule-of-thirds intersection dots
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      for (let c = 1; c < COLS; c++) {
        for (let r = 1; r < ROWS; r++) {
          ctx.beginPath();
          ctx.arc(c * cellW, r * cellH, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Safe Zones Overlay
    if (showSafeZones) {
      const actionSafe = 0.9; // 90%
      const titleSafe = 0.8;  // 80%

      ctx.save();
      ctx.globalAlpha = 1;
      
      const drawSafeRect = (pct: number, color: string, label: string) => {
        const rw = W * pct;
        const rh = H * pct;
        const rx = (W - rw) / 2;
        const ry = (H - rh) / 2;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        
        ctx.fillStyle = color;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, rx + 4, ry + 4);
      };

      drawSafeRect(actionSafe, 'rgba(234, 179, 8, 0.6)', 'Action Safe 90%');
      drawSafeRect(titleSafe, 'rgba(14, 165, 233, 0.6)', 'Title Safe 80%');
      
      ctx.restore();
    }

    // 5. Timecode overlay – top-right
    ctx.globalAlpha = 1;
    const tcText = formatTime(currentTime);
    ctx.font = 'bold 12px monospace';
    const tcMetrics = ctx.measureText(tcText);
    const tcPadX = 8;
    const tcPadY = 4;
    const tcW = tcMetrics.width + tcPadX * 2;
    const tcH = 20;
    const tcX = W - tcW - 8;
    const tcY = 8;
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
    ctx.fillText(tcText, W - 8 - tcPadX, tcY + tcH / 2);

    ctx.restore(); // Restore from global canvas resolution scale
  }, [currentTime, tracks, selectedClipId, mediaLibrary, videoElements, imageRevision, requestRedraw, viewport, showSafeZones, showGrid, canvasBgColor, settings.previewQuality, settings.hardwareAcceleration, isPlaying]);

  const renderCanvasRef = useRef(renderCanvas);
  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  });

  // Kick off render whenever dependencies change, throttled by requestAnimationFrame
  useEffect(() => {
    let rId: number;
    const draw = () => {
      renderCanvasRef.current();
    };
    rId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rId);
  }, [renderCanvas]);

  // During playback, also schedule continuous redraws so video frames update
  useEffect(() => {
    if (!isPlaying) return;
    let id: number;
    const draw = () => {
      renderCanvasRef.current();
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

  // -------------------------------------------------------------------
  // Interaction handlers (Viewport Gestures & Tools)
  // -------------------------------------------------------------------
  
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
    const timer = setTimeout(() => window.addEventListener('click', close), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', close);
    };
  }, [showSpeedMenu]);

  // Close canvas settings panel when clicking elsewhere
  useEffect(() => {
    if (!showSettingsPanel) return;
    const close = () => setShowSettingsPanel(false);
    const timer = setTimeout(() => window.addEventListener('click', close), 0);
    return () => {
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
            particlePools.delete(selClip.id);
            updateClip(selClip.id, { particleSettings: { ...selClip.particleSettings, emitterX: Math.round(x), emitterY: Math.round(y) } });
          }
        }}
        style={{ cursor: activeTool === 'hand' ? (isPanning.current ? 'grabbing' : 'grab') : (activeTool === 'zoom' ? 'zoom-in' : (() => { const sc = tracks.flatMap(t=>t.clips).find(c=>c.id===selectedClipId); return sc?.particleSettings ? 'crosshair' : 'default'; })()) }}
      >
        <canvas
          ref={canvasRef}
          width={previewWidth}
          height={previewHeight}
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
            className="p-1.5 bg-black/50 hover:bg-black/70 rounded text-white/70 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Grid (Rule of Thirds) */}
          <button
            onClick={() => { setShowGrid((g) => !g); setShowSettingsPanel(false); }}
            className={`p-1.5 rounded transition-colors ${
              showGrid
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40'
                : 'bg-black/50 hover:bg-black/70 text-white/70 hover:text-white'
            }`}
            title="Grid / Rule of Thirds"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Safe Zones */}
          <button
            onClick={() => { setShowSafeZones((s) => !s); setShowSettingsPanel(false); }}
            className={`p-1.5 rounded transition-colors ${
              showSafeZones
                ? 'bg-sky-500/30 text-sky-300 border border-sky-500/40'
                : 'bg-black/50 hover:bg-black/70 text-white/70 hover:text-white'
            }`}
            title="Safe Zones (Action 90% / Title 80%)"
          >
            <Film className="w-3.5 h-3.5" />
          </button>

          {/* Canvas Settings Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSettingsPanel((p) => !p); }}
              className={`p-1.5 rounded transition-colors ${
                showSettingsPanel
                  ? 'bg-[#3e3e3e] text-white border border-[#5e5e5e]'
                  : 'bg-black/50 hover:bg-black/70 text-white/70 hover:text-white'
              }`}
              title="Canvas Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            {showSettingsPanel && (
              <div
                className="absolute top-full left-0 mt-1.5 w-52 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-2xl z-50 p-3 space-y-3"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <p className="text-[10px] font-semibold text-[#a0a0a0] uppercase tracking-wider">Canvas Settings</p>

                {/* Background Color */}
                <div className="space-y-1">
                  <label className="text-[10px] text-[#a0a0a0]">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={canvasBgColor}
                      id="canvas-bg-color"
                      onChange={(e) => setCanvasBgColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#3e3e3e] cursor-pointer bg-transparent p-0.5"
                    />
                    <span className="text-[10px] text-white font-mono" id="canvas-bg-label">{canvasBgColor}</span>
                  </div>
                </div>

                {/* Viewport Zoom */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-[#a0a0a0]">Viewport Zoom</label>
                    <span className="text-[10px] text-white font-mono">{Math.round(viewport.zoom * 100)}%</span>
                  </div>
                  <input
                    type="range" min={10} max={400} step={5}
                    value={Math.round(viewport.zoom * 100)}
                    onChange={(e) => {
                      const newZoom = Number(e.target.value) / 100;
                      setViewport(prev => {
                        const nx = prev.x * (newZoom / prev.zoom);
                        const ny = prev.y * (newZoom / prev.zoom);
                        return { x: nx, y: ny, zoom: newZoom };
                      });
                    }}
                    className="w-full h-1 bg-[#3e3e3e] rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Reset Viewport */}
                <button
                  onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
                  className="w-full py-1.5 text-[11px] text-[#a0a0a0] hover:text-white bg-[#2d2d2d] hover:bg-[#3e3e3e] rounded border border-[#3e3e3e] transition-colors"
                >
                  Reset Viewport (100%)
                </button>

                <div className="pt-1 border-t border-[#3e3e3e] space-y-1.5">
                  <div className="flex items-center gap-2 justify-between">
                    <label className="text-[10px] text-[#a0a0a0]">Grid</label>
                    <button
                      onClick={() => setShowGrid((g) => !g)}
                      className={`w-8 h-4 rounded-full transition-colors relative ${showGrid ? 'bg-yellow-500' : 'bg-[#3e3e3e]'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showGrid ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 justify-between">
                    <label className="text-[10px] text-[#a0a0a0]">Safe Zones</label>
                    <button
                      onClick={() => setShowSafeZones((s) => !s)}
                      className={`w-8 h-4 rounded-full transition-colors relative ${showSafeZones ? 'bg-sky-500' : 'bg-[#3e3e3e]'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showSafeZones ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Overlay: viewport zoom badge + resolution (bottom-right) */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {viewport.zoom !== 1 && (
            <button
              onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
              className="text-[9px] text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded px-1.5 py-0.5 hover:bg-amber-500/30 transition-colors"
            >
              {Math.round(viewport.zoom * 100)}% — Reset
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-black/50 rounded px-2 py-1">
            <Film className="w-3 h-3 text-[#a0a0a0]" />
            <span className="text-[10px] text-[#a0a0a0]">854 × 480 • 16:9</span>
          </div>
        </div>

        {/* Particle emitter position indicator */}
        {(() => {
          const sc = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
          if (!sc?.particleSettings) return null;
          const ps = sc.particleSettings;
          return (
            <div
              className="absolute pointer-events-none z-10"
              style={{ left: `${ps.emitterX}%`, top: `${ps.emitterY}%`, transform: 'translate(-50%,-50%)' }}
            >
              <div className="w-5 h-5 rounded-full border-2 border-violet-400 bg-violet-400/20 animate-pulse" />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-violet-300 bg-black/80 px-1.5 py-0.5 rounded pointer-events-none">
                ✦ Ctrl+Click to move
              </div>
            </div>
          );
        })()}
      </div>

      {/* Playback Controls */}
      <div className="h-14 bg-[#252525] border-t border-[#3e3e3e] flex items-center px-4 gap-3">
        {/* Play / Pause */}
        <button
          onClick={hasClips ? togglePlayback : undefined}
          disabled={!hasClips}
          className={`p-2 text-white rounded-full transition-colors ${
            hasClips ? 'hover:bg-[#3e3e3e]' : 'opacity-40 cursor-not-allowed'
          }`}
          title={!hasClips ? 'No media on timeline' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" fill="white" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" fill="white" />
          )}
        </button>

        {/* Skip controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRestart}
            className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSkipBackward}
            className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
            title="Skip Back 10s"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handleSkipForward}
            className="p-1.5 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
            title="Skip Forward 10s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timecode */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-amber-400">{formatTime(currentTime)}</span>
          <span className="text-[#a0a0a0]">/</span>
          <span className="text-[#a0a0a0]">{formatTime(totalDuration)}</span>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.01}
            value={currentTime}
            onChange={handleTimelineSeek}
            className="w-full h-1.5 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
          />
        </div>

        {/* Speed Control */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu(!showSpeedMenu);
            }}
            className="px-2 py-1 text-[11px] text-[#a0a0a0] hover:text-white bg-[#1e1e1e] rounded border border-[#3e3e3e] transition-colors"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-20 bg-[#2d2d2d] border border-[#3e3e3e] rounded shadow-xl z-50 py-1">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaybackSpeed(s);
                    setShowSpeedMenu(false);
                  }}
                  className={`w-full px-3 py-1 text-xs text-left transition-colors ${
                    playbackSpeed === s
                      ? 'text-amber-400 bg-[#3e3e3e]'
                      : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="p-1.5 text-[#a0a0a0] hover:text-white transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-20 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: draw a styled placeholder when the real media isn't ready yet
// ---------------------------------------------------------------------------
function drawMediaPlaceholder(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  name: string,
  typeLabel: string,
  accentColor: string,
) {
  const pw = W * 0.6;
  const ph = H * 0.5;
  const px = -pw / 2;
  const py = -ph / 2;

  // Background
  ctx.fillStyle = accentColor + '18'; // very faint tint
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 8);
  ctx.fill();

  // Border
  ctx.strokeStyle = accentColor + '60';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 8);
  ctx.stroke();

  // Type label
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(typeLabel, 0, -8);

  // File name
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px system-ui, sans-serif';
  const truncated = name.length > 30 ? name.slice(0, 27) + '…' : name;
  ctx.fillText(truncated, 0, 12);

  // Loading dots
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('Loading…', 0, 28);
}

// ---------------------------------------------------------------------------
// Helper: apply Temperature, Tint, Faded Film, and Vignette color overlays
// ---------------------------------------------------------------------------
function applyColorOverlays(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  filters: any
) {
  const { temperature, tint, fadedFilm, vignette } = filters;

  // 1. Temperature: Cool (Cyan) to Warm (Amber/Orange)
  if (temperature !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    // Warm: amber `#ff8c00`. Cool: cyan `#00bfff`.
    ctx.fillStyle = temperature > 0 ? '#ff8c00' : '#00bfff';
    ctx.globalAlpha = Math.min(1, Math.max(0, Math.abs(temperature) / 400));
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // 2. Tint: Green to Magenta
  if (tint !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    // Positive: magenta `#ff00ff`. Negative: green `#00ff00`.
    ctx.fillStyle = tint > 0 ? '#ff00ff' : '#00ff00';
    ctx.globalAlpha = Math.min(1, Math.max(0, Math.abs(tint) / 400));
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // 3. Faded Film wash
  if (fadedFilm > 0) {
    ctx.save();
    // screen composite operation with middle gray washes out shadow/black levels
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#808080';
    ctx.globalAlpha = Math.min(1, Math.max(0, fadedFilm / 400));
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // 4. Vignette: Positive (black vignette) or Negative (white vignette)
  if (vignette !== 0) {
    ctx.save();

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
  } catch (e) {
    console.warn('Chroma key calculation error:', e);
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
  } = useEditorStore();

  const updateClip = useCallback((clipId: string, updates: any) => {
    const isOl = tracks.some((t) => (t.overLayers || []).some((ol) => ol.id === clipId));
    if (isOl) {
      updateOverLayer(clipId, updates);
    } else {
      storeUpdateClip(clipId, updates);
    }
  }, [tracks, storeUpdateClip, updateOverLayer]);

  const videoElements = useMediaPlayback();

  const [dragState, setDragState] = useState<{
    type: string;
    startX: number;
    startY: number;
    initTransform: any;
    initCrop: any;
  } | null>(null);
  
  const [snapGuides, setSnapGuides] = useState<{axis: 'x'|'y', position: number}[]>([]);

  let activeClip = null;
  let mediaItem = null;

  if (selectedOverLayerId) {
    for (const track of tracks) {
      if (track.hidden || track.type !== 'video') continue;
      const ol = (track.overLayers || []).find((c) => c.id === selectedOverLayerId);
      if (ol && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
        activeClip = ol;
        mediaItem = mediaLibrary.find((m) => m.id === ol.mediaId);
        break;
      }
    }
  } else if (selectedClipId) {
    for (const track of tracks) {
      if (track.hidden || track.type !== 'video') continue;
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        activeClip = clip;
        mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
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

      let { x, y, scale, rotation } = dragState.initTransform;
      const crop = { ...dragState.initCrop };

      const W = 854;
      const H = 480;
      let vw = W;
      let vh = H;
      if (mediaItem?.type === 'video') {
        const v = videoElements.get(activeClip.id);
        if (v && v.videoWidth > 0) {
          vw = v.videoWidth;
          vh = v.videoHeight;
        }
      } else if (mediaItem?.type === 'image') {
        const img = getCachedImage(mediaItem.id, mediaItem.url, () => {});
        if (img && img.naturalWidth > 0) {
          vw = img.naturalWidth;
          vh = img.naturalHeight;
        }
      }
      const scaleToFit = Math.min(W / vw, H / vh);
      const baseW = vw * scaleToFit;
      const baseH = vh * scaleToFit;

      let animations = activeClip.animations || {};
      const localTime = currentTime - activeClip.startTime;

      // Helper to update base or keyframe
      const getNewAnimations = (prop: string, val: number) => {
        if (animations[prop]) {
          animations = { ...animations, [prop]: addOrUpdateKeyframe(animations[prop], localTime, val) };
        }
      };

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

        if (dragState.type === 'crop-l') {
          crop.left = Math.max(0, Math.min(100 - crop.right - 1, crop.left + (localDx / baseW) * 100));
          getNewAnimations('crop.left', crop.left);
        } else if (dragState.type === 'crop-r') {
          crop.right = Math.max(0, Math.min(100 - crop.left - 1, crop.right - (localDx / baseW) * 100));
          getNewAnimations('crop.right', crop.right);
        } else if (dragState.type === 'crop-t') {
          crop.top = Math.max(0, Math.min(100 - crop.bottom - 1, crop.top + (localDy / baseH) * 100));
          getNewAnimations('crop.top', crop.top);
        } else if (dragState.type === 'crop-b') {
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

      updateClip(activeClip.id, { transform: { x, y, scale, rotation }, crop, animations });
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
  }, [dragState, activeClip, updateClip, mediaItem, videoElements, viewport, currentTime]);

  if (!activeClip) return null;

  const W = 854;
  const H = 480;
  let vw = W;
  let vh = H;
  if (mediaItem?.type === 'video') {
    const v = videoElements.get(activeClip.id);
    if (v && v.videoWidth > 0) {
      vw = v.videoWidth;
      vh = v.videoHeight;
    }
  } else if (mediaItem?.type === 'image') {
    const img = getCachedImage(mediaItem.id, mediaItem.url, () => {});
    if (img && img.naturalWidth > 0) {
      vw = img.naturalWidth;
      vh = img.naturalHeight;
    }
  }

  const scaleToFit = Math.min(W / vw, H / vh);
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
    });
  };

  const cx = W / 2;
  const cy = H / 2;
  const totalX = cx + viewport.x - cx * viewport.zoom;
  const totalY = cy + viewport.y - cy * viewport.zoom;

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" id="preview-canvas-wrapper-overlay">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 854 480">
          <g transform={`translate(${totalX}, ${totalY}) scale(${viewport.zoom})`}>
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
