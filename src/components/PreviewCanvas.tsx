import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Settings2,
  Film,
  RotateCcw,
  Scissors,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useMediaPlayback } from '@/hooks/useMediaPlayback';
import { formatTime } from '@/utils/time';
import { useRef, useEffect, useState, useCallback } from 'react';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';

// ---------------------------------------------------------------------------
// Image cache – shared across renders, keyed by mediaId.
// Each entry holds the HTMLImageElement (or a loading promise so we don't
// kick off duplicate loads).
// ---------------------------------------------------------------------------
const imageCache = new Map<string, HTMLImageElement>();
const imageLoading = new Set<string>();

function getCachedImage(
  mediaId: string,
  url: string,
  onLoad: () => void,
): HTMLImageElement | null {
  const cached = imageCache.get(mediaId);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;

  // Already loading – wait for the existing load to resolve
  if (imageLoading.has(mediaId)) return null;

  imageLoading.add(mediaId);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
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
  const emitInterval = Math.max(16, 1000 / (maxCount / ((ps.lifetime / 100) * 1.5)));

  // Emit new particles
  if (pool.particles.length < maxCount && (now - pool.lastEmit) > emitInterval) {
    const batchSize = Math.min(3, maxCount - pool.particles.length);
    for (let i = 0; i < batchSize; i++) {
      pool.particles.push(spawnParticle(ps, W, H));
    }
    pool.lastEmit = now;
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
    // Update physics
    p.vy += gravityAcc;
    p.vx += windAcc + (Math.random() - 0.5) * turbStr;
    p.x  += p.vx * dtScale;
    p.y  += p.vy * dtScale;
    p.rotation += p.rotSpeed * dtScale;
    p.life -= 1 / p.maxLife;
    p.life = Math.max(0, p.life);

    // Matrix: randomize char occasionally
    if (p.type === 'matrix' && Math.random() < 0.05) {
      const chars = '0123456789ABCDEF';
      p.char = chars[Math.floor(Math.random() * chars.length)];
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
    mediaLibrary,
    updateClip,
    canvasTransformMode,
    setCanvasTransformMode,
    setPreviewCanvas,
    activeTool,
  } = useEditorStore();

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const hasClips = tracks.some((t) => t.clips.length > 0);

  // Real video elements for drawing frames
  const videoElements = useMediaPlayback();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
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
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const newTime = currentTimeRef.current + dt * playbackSpeed;

      const state = useEditorStore.getState();
      const allClips = state.tracks.flatMap((t) => t.clips);

      if (selectedClipIds.length > 0) {
        // Selection Loop Playback Mode
        const selectedClips = allClips.filter((c) => selectedClipIds.includes(c.id));
        if (selectedClips.length > 0) {
          let minStart = Infinity;
          let maxEnd = -Infinity;
          for (const c of selectedClips) {
            if (c.startTime < minStart) minStart = c.startTime;
            const end = c.startTime + c.duration;
            if (end > maxEnd) maxEnd = end;
          }

          if (newTime >= maxEnd || newTime < minStart) {
            seek(minStart);
            currentTimeRef.current = minStart;
          } else {
            seek(newTime);
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

      if (newTime >= maxEndSequence) {
        seek(0);
        currentTimeRef.current = 0;
        state.pause();
        return;
      }

      seek(newTime);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackSpeed, seek, selectedClipIds]);

  // -------------------------------------------------------------------
  // Canvas rendering – called whenever time, tracks, or images change
  // -------------------------------------------------------------------
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width; // 854
    const H = canvas.height; // 480

    // 1. Clear to dark background (entire canvas, regardless of viewport)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(viewport.x, viewport.y);
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
        if (videoEl && videoEl.readyState >= 1 && videoEl.videoWidth > 0) {
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

          // Apply standard filters
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, dw, dh);
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
          const scale = Math.min(W / iw, H / ih);
          
          const baseDw = iw * scale;
          const baseDh = ih * scale;

          const sx = iw * cLeft;
          const sy = ih * cTop;
          const sw = Math.max(1, iw * (1 - cLeft - cRight));
          const sh = Math.max(1, ih * (1 - cTop - cBot));

          dw = Math.max(1, baseDw * (1 - cLeft - cRight));
          dh = Math.max(1, baseDh * (1 - cTop - cBot));
          const dx = -baseDw / 2 + baseDw * cLeft;
          const dy = -baseDh / 2 + baseDh * cTop;

          // Apply standard filters
          ctx.filter = `brightness(${100 + exposure}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
          ctx.filter = 'none';
          hasRealMedia = true;
          anyClipDrawn = true;
        } else {
          // Image still loading – placeholder
          drawMediaPlaceholder(ctx, W, H, mediaItem.name, 'IMAGE', '#f59e0b');
          anyClipDrawn = true;
        }
      } else if (mediaItem.type === 'text' && clip.textSettings) {
        const ts = clip.textSettings as any;
        const { text, fontSize, fontFamily, color, backgroundColor, bold, italic, shadow, shadowColor, shadowBlur, threeD, threeDDepth } = ts;
        const textAlign: CanvasTextAlign = ts.textAlign || 'center';
        ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px "${fontFamily || 'Inter'}", sans-serif`;
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';
        
        const metrics = ctx.measureText(text);
        dw = metrics.width + 40;
        dh = fontSize + 40;

        // Alignment-aware x offset for bounding box
        let textX = 0;
        let bgX = -dw / 2;
        if (textAlign === 'left') {
          textX = -dw / 2 + 20;
          bgX = -dw / 2;
        } else if (textAlign === 'right') {
          textX = dw / 2 - 20;
          bgX = -dw / 2;
        }

        if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(bgX, -dh / 2, dw, dh);
        }

        if (shadow) {
          ctx.shadowColor = shadowColor || '#000000';
          ctx.shadowBlur = shadowBlur || 10;
        }

        if (threeD) {
          ctx.fillStyle = shadowColor || '#000000';
          for (let d = 0; d < (threeDDepth || 5); d++) {
            ctx.fillText(text, textX - d, d);
          }
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = color || '#ffffff';
        ctx.fillText(text, textX, 0);
        ctx.shadowBlur = 0;
        
        hasRealMedia = true;
        anyClipDrawn = true;
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
            if (videoEl && videoEl.readyState >= 1) {
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
            if (videoEl && videoEl.readyState >= 1) {
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
            if (videoEl && videoEl.readyState >= 1) {
              ctx.save();
              ctx.globalAlpha = 0.55;
              ctx.globalCompositeOperation = 'screen';

              const offR = document.createElement('canvas');
              offR.width = pxW; offR.height = pxH;
              const ctxR = offR.getContext('2d')!;
              ctxR.drawImage(videoEl, 0, 0, pxW, pxH);
              const dR = ctxR.getImageData(0, 0, pxW, pxH);
              for (let i = 0; i < dR.data.length; i += 4) { dR.data[i+1] = 0; dR.data[i+2] = 0; }
              ctxR.putImageData(dR, 0, 0);
              ctx.drawImage(offR, -dw / 2 - shift, -dh / 2, dw, dh);

              const offB = document.createElement('canvas');
              offB.width = pxW; offB.height = pxH;
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
          const tmp = document.createElement('canvas');
          tmp.width = tmpW; tmp.height = tmpH;
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
          const flip = document.createElement('canvas');
          flip.width = halfW; flip.height = pxH;
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
              if (videoEl && videoEl.readyState >= 1) {
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
      }    for (const track of visualTracks) {
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
        continue;
      }

      const clip = sortedClips.find(
        (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration,
      );
      if (!clip) continue;

      drawSingleClip(clip, 1);
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
    const particleFrameMs = 1000 / 60; // assume 60fps for physics step
    for (const track of visualTracks) {
      for (const clip of track.clips) {
        if (clip.particleSettings && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          renderParticles(ctx, clip.id, clip.particleSettings, W, H, particleFrameMs);
        }
      }
    }

    ctx.restore(); // Restore from viewport transform

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
    ctx.roundRect(tcX, tcY, tcW, tcH, 4);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(tcText, W - 8 - tcPadX, tcY + tcH / 2);
  }, [currentTime, tracks, selectedClipId, mediaLibrary, videoElements, imageRevision, requestRedraw, viewport]);

  // Kick off render whenever dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // During playback, also schedule continuous redraws so video frames update
  useEffect(() => {
    if (!isPlaying) return;
    let id: number;
    const draw = () => {
      renderCanvas();
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, renderCanvas]);

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
          
          const nx = mx - (mx - prev.x) * (newZoom / prev.zoom);
          const ny = my - (my - prev.y) * (newZoom / prev.zoom);
          
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
        const nx = mx - (mx - prev.x) * (newZoom / prev.zoom);
        const ny = my - (my - prev.y) * (newZoom / prev.zoom);
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
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [showSpeedMenu]);

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };
  const handleSkipBackward = () => seek(Math.max(0, currentTime - 10));
  const handleSkipForward = () => seek(Math.min(totalDuration, currentTime + 10));
  const handleRestart = () => seek(0);

  // -------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------
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
          width={854}
          height={480}
          className="w-full h-full object-contain pointer-events-none"
        />
        <InteractiveCanvasOverlay viewport={viewport} />

        {/* Overlay: fullscreen + settings (top-left) */}
        <div className="absolute top-3 left-3 flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-black/50 hover:bg-black/70 rounded text-white/70 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 bg-black/50 hover:bg-black/70 rounded text-white/70 hover:text-white transition-colors"
            title="Canvas Settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overlay: resolution info (bottom-right) */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/50 rounded px-2 py-1">
          <Film className="w-3 h-3 text-[#a0a0a0]" />
          <span className="text-[10px] text-[#a0a0a0]">854 × 480</span>
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
// Interactive Canvas Overlay Component
// ---------------------------------------------------------------------------
function InteractiveCanvasOverlay({ viewport }: { viewport: { x: number, y: number, zoom: number } }) {
  const {
    tracks,
    selectedClipId,
    currentTime,
    mediaLibrary,
    updateClip,
    canvasTransformMode,
    setCanvasTransformMode,
  } = useEditorStore();
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

  if (selectedClipId) {
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

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" id="preview-canvas-wrapper-overlay">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 854 480">
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
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
