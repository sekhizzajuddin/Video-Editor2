/**
 * exportEffects.ts — worker-safe, deterministic particle rendering for export.
 *
 * The preview drives particles incrementally (a persistent pool advanced by real
 * frame deltas + performance.now()), which is inherently non-deterministic and
 * frame-rate dependent — unsuitable for export, where frames must be stable and
 * reproducible. This module instead evaluates the SAME particle physics (mirrors
 * `spawnParticle` / `renderParticles` in utils/canvasEffects.ts) at an absolute
 * time using a seeded PRNG keyed by clip id, so the exported field matches the
 * preview's look while remaining bit-stable across runs.
 */

import {
  drawParticleShape,
  type Particle,
  type ParticleEffectType,
} from '@/utils/canvasEffects';
import type { ClipParticleSettings } from '@/types';

/** Deterministic 32-bit PRNG (mulberry32) — same seed → same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit seed. */
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const HUES = [0, 30, 60, 120, 180, 240, 270, 300];

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

interface DeterministicParticle {
  type: ParticleEffectType;
  size: number;
  color: string;
  x0: number;
  y0: number;
  vx0: number;
  vy0: number;
  rotation0: number;
  rotSpeed: number;
  maxLife: number; // seconds
  spawnOffset: number; // seconds (loops the particle)
  char?: string;
}

/**
 * Build the deterministic particle set for a clip. Every particle is fully
 * specified up-front so any frame can be evaluated independently.
 */
function buildParticles(ps: ClipParticleSettings, W: number, H: number, clipId: string): DeterministicParticle[] {
  const amount = Math.max(1, Math.min(500, ps.amount || 50));
  const rng = mulberry32(hashSeed(clipId));
  const ex = (ps.emitterX / 100) * W;
  const ey = (ps.emitterY / 100) * H;
  const spreadRad = (ps.spread / 2) * (Math.PI / 180);
  const baseSpeed = (ps.speed / 100) * 3;
  const baseSize = (ps.size / 100) * 5;
  // Preview uses "frames at 60fps" for lifetime; convert to seconds.
  const baseLife = Math.max(0.1, Math.round((ps.lifetime / 100) * 90) / 60);
  const turb = (ps.turbulence / 100) * 2;
  const gravDir = ps.gravity > 0 ? Math.PI / 2 : -Math.PI / 2;

  const pickColor = (): string => {
    if (ps.color === 'auto') return `hsl(${HUES[Math.floor(rng() * HUES.length)]},90%,60%)`;
    if (ps.colorVariance > 0) {
      const [r, g, b] = hexToRgb(ps.color);
      const v = Math.round((rng() - 0.5) * ps.colorVariance * 1.5);
      return `rgb(${Math.min(255, Math.max(0, r + v))},${Math.min(255, Math.max(0, g + v))},${Math.min(255, Math.max(0, b + v))})`;
    }
    return ps.color;
  };

  const particles: DeterministicParticle[] = [];
  for (let i = 0; i < amount; i++) {
    const spawnOffset = rng() * baseLife;
    const size = baseSize * (0.5 + rng() * 1.5);
    const color = pickColor();
    const rotSpeed = (rng() - 0.5) * 0.2;
    const rotation0 = rng() * Math.PI * 2;
    const life = baseLife * (0.6 + rng() * 0.8);

    if (ps.type === 'rain') {
      particles.push({
        type: 'rain',
        size: 0.8 + rng(),
        color,
        x0: rng() * W,
        y0: -10,
        vx0: (ps.wind / 100) * 1.5 + (rng() - 0.5) * 0.3,
        vy0: baseSpeed * (0.8 + rng() * 0.4),
        rotation0,
        rotSpeed,
        maxLife: life,
        spawnOffset,
      });
      continue;
    }
    if (ps.type === 'snow') {
      particles.push({
        type: 'snow',
        size: (1 + rng() * 2) * (ps.size / 100),
        color,
        x0: rng() * W,
        y0: -10,
        vx0: (ps.wind / 100) + (rng() - 0.5) * turb,
        vy0: baseSpeed * (0.3 + rng() * 0.7),
        rotation0,
        rotSpeed,
        maxLife: life,
        spawnOffset,
      });
      continue;
    }
    if (ps.type === 'matrix') {
      const chars = '0123456789ABCDEF日月火水木金土';
      particles.push({
        type: 'matrix',
        size: 10 * (ps.size / 100),
        color,
        x0: ex,
        y0: 0,
        vx0: 0,
        vy0: baseSpeed,
        rotation0,
        rotSpeed,
        maxLife: life,
        spawnOffset,
        char: chars[Math.floor(rng() * chars.length)],
      });
      continue;
    }
    if (ps.type === 'paper_pieces') {
      particles.push({
        type: 'paper_pieces',
        size: baseSize * 2,
        color,
        x0: ex + (rng() - 0.5) * baseSize * 8,
        y0: -20,
        vx0: (rng() - 0.5) * turb * 2 + (ps.wind / 100),
        vy0: baseSpeed * (0.2 + rng() * 0.5),
        rotation0,
        rotSpeed,
        maxLife: life,
        spawnOffset,
      });
      continue;
    }

    const angle = gravDir + (rng() - 0.5) * 2 * spreadRad;
    const speed = baseSpeed * (0.5 + rng());
    const vx0 = Math.cos(angle) * speed + (ps.wind / 100) * 1.5 + (rng() - 0.5) * turb;
    const vy0 = Math.sin(angle) * speed + (rng() - 0.5) * turb * 0.5;
    const jitter = baseSize * 2;
    particles.push({
      type: ps.type,
      size,
      color,
      x0: ex + (rng() - 0.5) * jitter * 4,
      y0: ey + (rng() - 0.5) * jitter,
      vx0,
      vy0,
      rotation0,
      rotSpeed,
      maxLife: life,
      spawnOffset,
    });
  }
  return particles;
}

const PARTICLE_CACHE = new Map<string, { key: string; particles: DeterministicParticle[] }>();

/**
 * Render the particle field for a clip at an absolute local time (seconds).
 * Deterministic: same clip id + settings + time → identical output.
 */
export function renderParticlesDeterministic(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  clipId: string,
  ps: ClipParticleSettings,
  W: number,
  H: number,
  localTime: number,
) {
  if (!ps || localTime < 0) return;

  const cacheKey = `${clipId}|${W}|${H}|${ps.type}|${ps.amount}|${ps.speed}|${ps.size}|${ps.lifetime}|${ps.gravity}|${ps.wind}|${ps.spread}|${ps.turbulence}|${ps.emitterX}|${ps.emitterY}|${ps.color}|${ps.colorVariance}`;
  let entry = PARTICLE_CACHE.get(clipId);
  if (!entry || entry.key !== cacheKey) {
    entry = { key: cacheKey, particles: buildParticles(ps, W, H, clipId) };
    PARTICLE_CACHE.set(clipId, entry);
  }

  const gravityAcc = (ps.gravity / 100) * 0.12 * 60; // per second (preview used /frame * dtScale)
  const windAcc = (ps.wind / 100) * 0.03 * 60;
  const turbStr = (ps.turbulence / 100) * 0.08;
  const opacity = ps.intensity / 100;
  const anyCtx = ctx as CanvasRenderingContext2D;

  if (ps.glow) {
    anyCtx.save();
    anyCtx.shadowBlur = 8;
    anyCtx.shadowColor = ps.color === 'auto' ? '#ffffff' : ps.color;
  }

  for (const p of entry.particles) {
    // Loop the particle over its lifetime so the field is continuous.
    const age = (localTime + p.spawnOffset) % p.maxLife;
    const life = 1 - age / p.maxLife;
    if (life <= 0) continue;

    const t = age;
    // Deterministic turbulence wobble (sine-based) instead of per-frame random.
    const wobbleX = Math.sin(localTime * 3 + p.rotation0 * 10) * turbStr * 2;
    const wobbleY = Math.cos(localTime * 2.7 + p.rotation0 * 10) * turbStr;

    const x = p.x0 + p.vx0 * t + 0.5 * windAcc * t * t + wobbleX;
    const y = p.y0 + p.vy0 * t + 0.5 * gravityAcc * t * t + wobbleY;
    if (x < -50 || x > W + 50 || y > H + 50) continue;

    const fadeIn = age < 0.1 * p.maxLife ? age / (0.1 * p.maxLife) : 1;
    const fadeOut = life < 0.2 ? life / 0.2 : 1;
    const alpha = opacity * Math.min(fadeIn, fadeOut);

    const particle: Particle = {
      x,
      y,
      vx: p.vx0,
      vy: p.vy0,
      life,
      maxLife: 1,
      size: p.size,
      color: p.color,
      rotation: p.rotation0 + p.rotSpeed * t * 60,
      rotSpeed: p.rotSpeed,
      char: p.char,
      type: p.type,
    };
    drawParticleShape(anyCtx, particle, alpha);
  }

  if (ps.glow) {
    anyCtx.restore();
  }
}
