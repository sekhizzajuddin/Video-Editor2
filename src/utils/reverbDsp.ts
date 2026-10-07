/**
 * reverbDsp.ts
 *
 * Studio-grade algorithmic Reverb & Acoustic Environment Simulation engine.
 * Synthesizes stereo decorrelated impulse responses with RT60 exponential decay,
 * pre-delay, early reflection clustering, and high-frequency damping.
 * Caches quantized impulse responses for real-time Web Audio ConvolverNode playback.
 */

export type AudioEnvironmentPreset =
  | 'none'
  | 'studio'
  | 'room'
  | 'hall'
  | 'cathedral'
  | 'bathroom'
  | 'canyon'
  | 'arena'
  | 'office'
  | 'telephone'
  | 'tunnel'
  | 'custom';

export interface EnvironmentPresetConfig {
  id: AudioEnvironmentPreset;
  name: string;
  category: 'Studio' | 'Domestic' | 'Large Hall' | 'Outdoor' | 'Special';
  description: string;
  icon: string;
  mix: number;        // 0 to 100%
  decay: number;      // 0.1 to 5.0 s
  preDelay: number;   // 0 to 100 ms
  damping: number;    // 0 to 100%
  roomSize: number;   // 0 to 100%
  lowCut?: number;    // optional Hz for bandpass
  highCut?: number;   // optional Hz for bandpass
}

export interface ClipReverbSettings {
  enabled: boolean;
  preset: AudioEnvironmentPreset;
  mix: number;        // 0 to 100% (wet mix)
  decay: number;      // 0.1 to 5.0 s
  preDelay: number;   // 0 to 100 ms
  damping: number;    // 0 to 100%
  roomSize: number;   // 0 to 100%
}

export const DEFAULT_REVERB_SETTINGS: ClipReverbSettings = {
  enabled: false,
  preset: 'none',
  mix: 25,
  decay: 1.5,
  preDelay: 20,
  damping: 40,
  roomSize: 50,
};

export const ENVIRONMENT_PRESETS: EnvironmentPresetConfig[] = [
  {
    id: 'studio',
    name: 'Studio Booth',
    category: 'Studio',
    description: 'Dry, tight acoustic absorption, close-mic voice with zero flutter echo.',
    icon: 'Mic',
    mix: 14,
    decay: 0.35,
    preDelay: 5,
    damping: 70,
    roomSize: 20,
  },
  {
    id: 'room',
    name: 'Living Room',
    category: 'Domestic',
    description: 'Natural domestic room reflections with warm acoustic wood ambiance.',
    icon: 'Home',
    mix: 22,
    decay: 0.75,
    preDelay: 12,
    damping: 55,
    roomSize: 40,
  },
  {
    id: 'hall',
    name: 'Concert Hall',
    category: 'Large Hall',
    description: 'Spacious orchestral concert hall with smooth high-density decay tails.',
    icon: 'Music',
    mix: 35,
    decay: 2.2,
    preDelay: 25,
    damping: 35,
    roomSize: 75,
  },
  {
    id: 'cathedral',
    name: 'Cathedral',
    category: 'Large Hall',
    description: 'Massive soaring stone cathedral with majestic ethereal resonance.',
    icon: 'Church',
    mix: 48,
    decay: 4.2,
    preDelay: 40,
    damping: 20,
    roomSize: 95,
  },
  {
    id: 'bathroom',
    name: 'Tile Bathroom',
    category: 'Domestic',
    description: 'Bright, highly reflective ceramic tile slap-back with metallic edge.',
    icon: 'Droplet',
    mix: 36,
    decay: 1.1,
    preDelay: 8,
    damping: 10,
    roomSize: 30,
  },
  {
    id: 'canyon',
    name: 'Canyon Echo',
    category: 'Outdoor',
    description: 'Distant outdoor mountain slap echo with open air decay and diffusion.',
    icon: 'Mountain',
    mix: 42,
    decay: 3.2,
    preDelay: 75,
    damping: 45,
    roomSize: 90,
  },
  {
    id: 'arena',
    name: 'Stadium / Arena',
    category: 'Large Hall',
    description: 'Giant open cavern arena with distant boundary wall echoes and wide space.',
    icon: 'Radio',
    mix: 44,
    decay: 3.6,
    preDelay: 45,
    damping: 30,
    roomSize: 90,
  },
  {
    id: 'office',
    name: 'Conference Office',
    category: 'Studio',
    description: 'Boxy early reflections, dry fluorescent conference acoustic environment.',
    icon: 'Building',
    mix: 18,
    decay: 0.5,
    preDelay: 10,
    damping: 60,
    roomSize: 35,
  },
  {
    id: 'telephone',
    name: 'Lo-Fi / Phone',
    category: 'Special',
    description: 'Vintage telephone / walkie-talkie speaker acoustic with small enclosure.',
    icon: 'Phone',
    mix: 30,
    decay: 0.25,
    preDelay: 2,
    damping: 90,
    roomSize: 15,
    lowCut: 450,
    highCut: 3500,
  },
  {
    id: 'tunnel',
    name: 'Tunnel / Cave',
    category: 'Special',
    description: 'Damp subterranean echo with metallic flutter reflections and rumble.',
    icon: 'Compass',
    mix: 44,
    decay: 2.8,
    preDelay: 20,
    damping: 15,
    roomSize: 70,
  },
  {
    id: 'none',
    name: 'Bypass / Dry',
    category: 'Studio',
    description: 'Original dry audio without any reverb or room acoustics.',
    icon: 'VolumeX',
    mix: 0,
    decay: 0.1,
    preDelay: 0,
    damping: 0,
    roomSize: 0,
  },
];

// Memory cache for synthesized impulse responses to prevent audio stutter during slider movements
const impulseCache = new Map<string, AudioBuffer>();

/**
 * Synthesizes a pristine stereo impulse response for Web Audio ConvolverNode.
 * Uses RT60 exponential decay, pre-delay, early reflection clustering, and 1-pole damping lowpass.
 */
export function generateReverbImpulse(
  ctx: BaseAudioContext,
  decaySeconds: number,
  dampingPercent: number, // 0 to 100
  preDelayMs: number, // 0 to 100 ms
  roomSizePercent: number = 50 // 0 to 100
): AudioBuffer {
  // Quantize parameters to round values to avoid generating thousands of buffers while scrubbing
  const qDecay = Math.max(0.1, Math.min(6.0, Math.round(decaySeconds * 10) / 10));
  const qDamping = Math.max(0, Math.min(100, Math.round(dampingPercent / 5) * 5));
  const qPreDelay = Math.max(0, Math.min(150, Math.round(preDelayMs / 5) * 5));
  const qRoomSize = Math.max(0, Math.min(100, Math.round(roomSizePercent / 10) * 10));
  const cacheKey = `${ctx.sampleRate}_${qDecay}_${qDamping}_${qPreDelay}_${qRoomSize}`;

  const cached = impulseCache.get(cacheKey);
  if (cached) return cached;

  const sampleRate = ctx.sampleRate;
  const preDelaySec = qPreDelay / 1000;
  const dampingNorm = qDamping / 100;
  const roomSizeNorm = qRoomSize / 100;
  const totalLength = Math.max(512, Math.floor(sampleRate * (qDecay + preDelaySec)));

  const buffer = ctx.createBuffer(2, totalLength, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const preDelaySamples = Math.floor(preDelaySec * sampleRate);
  // RT60 constant: 60dB attenuation
  const decayRate = 6.91 / qDecay;

  // Damping filter alpha: lower value = more high frequency absorption
  const alpha = Math.max(0.06, Math.min(0.98, 1.0 - dampingNorm * 0.78));

  // Early reflections clustering based on room size
  const earlyReflectionsCount = Math.floor(5 + roomSizeNorm * 12);
  const earlyReflections: Array<{ sampleIndex: number; gainL: number; gainR: number }> = [];
  for (let r = 0; r < earlyReflectionsCount; r++) {
    const delayOffset = Math.floor((r + 1) * 0.0035 * (1 + roomSizeNorm * 2.5) * sampleRate);
    const targetSample = preDelaySamples + delayOffset;
    if (targetSample < totalLength) {
      const g = Math.exp(-decayRate * (delayOffset / sampleRate)) * (0.35 + (r % 3) * 0.15);
      earlyReflections.push({
        sampleIndex: targetSample,
        gainL: g * (r % 2 === 0 ? 1 : -0.85),
        gainR: g * (r % 2 === 0 ? -0.85 : 1),
      });
    }
  }

  let filterL = 0;
  let filterR = 0;

  for (let i = preDelaySamples; i < totalLength; i++) {
    const t = (i - preDelaySamples) / sampleRate;
    const envelope = Math.exp(-decayRate * t);

    // Decorrelated stereo white noise for diffuse spatial tail
    const noiseL = Math.random() * 2 - 1;
    const noiseR = Math.random() * 2 - 1;

    // 1-pole lowpass damping filter
    filterL = filterL + alpha * (noiseL - filterL);
    filterR = filterR + alpha * (noiseR - filterR);

    left[i] = filterL * envelope;
    right[i] = filterR * envelope;
  }

  // Inject early reflections
  for (const er of earlyReflections) {
    if (er.sampleIndex < totalLength) {
      left[er.sampleIndex] += er.gainL;
      right[er.sampleIndex] += er.gainR;
    }
  }

  // Peak normalization to -1.5 dB (0.85 linear) to avoid digital clipping
  let maxPeak = 0;
  for (let i = 0; i < totalLength; i++) {
    const absL = Math.abs(left[i]);
    const absR = Math.abs(right[i]);
    if (absL > maxPeak) maxPeak = absL;
    if (absR > maxPeak) maxPeak = absR;
  }
  if (maxPeak > 0.0001) {
    const normFactor = 0.85 / maxPeak;
    for (let i = 0; i < totalLength; i++) {
      left[i] *= normFactor;
      right[i] *= normFactor;
    }
  }

  // Memory management: keep cache below 50 impulse buffers
  if (impulseCache.size >= 50) {
    const oldestKey = impulseCache.keys().next().value;
    if (oldestKey) impulseCache.delete(oldestKey);
  }

  impulseCache.set(cacheKey, buffer);
  return buffer;
}
