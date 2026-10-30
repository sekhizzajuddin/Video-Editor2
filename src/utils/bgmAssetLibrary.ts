// ─────────────────────────────────────────────────────────────────────────────
// BGM & Sound Design Asset Library
// Comprehensive procedural audio generation engine using Web Audio API.
// Every sound is synthesized on-the-fly — zero external file dependencies.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export type AssetCategory =
  | 'sfx'
  | 'instrument'
  | 'bgm-loop'
  | 'foley'
  | 'ambient'
  | 'transition'
  | 'vocal';

export type SfxSubcategory =
  | 'whoosh' | 'impact' | 'rise' | 'hit' | 'drop'
  | 'ui-click' | 'notification' | 'cinematic' | 'horror'
  | 'comedy' | 'sci-fi' | 'glitch' | 'explosion' | 'magic';

export type InstrumentSubcategory =
  | 'piano' | 'guitar' | 'drums' | 'bass' | 'strings'
  | 'synth-lead' | 'synth-pad' | 'brass' | 'woodwind'
  | 'percussion' | 'ethnic' | 'daf' | 'tabla' | 'sitar'
  | 'flute' | 'organ' | 'harp' | 'bells' | 'marimba';

export type BgmLoopSubcategory =
  | 'lofi' | 'electronic' | 'orchestral' | 'rock' | 'hiphop'
  | 'jazz' | 'ambient' | 'cinematic' | 'corporate' | 'upbeat'
  | 'trap' | 'edm' | 'classical' | 'rnb' | 'world';

export type FoleySubcategory =
  | 'footsteps' | 'nature' | 'weather' | 'city' | 'mechanical'
  | 'water' | 'fire' | 'wind' | 'cloth' | 'glass' | 'metal';

export type AmbientSubcategory =
  | 'space' | 'forest' | 'ocean' | 'rain' | 'cafe'
  | 'night' | 'studio' | 'crowd' | 'wind' | 'thunder';

export type TransitionSubcategory =
  | 'swoosh' | 'boom' | 'reverse' | 'riser' | 'downer'
  | 'stinger' | 'hit-stop' | 'tape-stop' | 'vinyl-scratch';

export interface BGMAsset {
  id: string;
  name: string;
  category: AssetCategory;
  subcategory: string;
  description: string;
  duration: number;       // seconds
  color: string;          // accent color for UI
  icon: string;           // emoji icon
  tags: string[];
  bpm?: number;
  key?: string;
  generator: (ctx: AudioContext, destination: AudioNode, duration: number) => AudioNode[];
}

export interface MixerChannel {
  id: string;
  name: string;
  asset: BGMAsset | null;
  volume: number;        // 0-100
  pan: number;           // -100 to 100
  muted: boolean;
  solo: boolean;
  fadeIn: number;         // seconds
  fadeOut: number;        // seconds
  loop: boolean;
  pitch: number;         // semitones offset (-12 to 12)
  filterFreq: number;    // lowpass filter frequency (200-20000)
  filterQ: number;       // filter resonance (0-20)
  reverbMix: number;     // 0-100
  delayMix: number;      // 0-100
  delayTime: number;     // seconds
  color: string;
}

export interface PatternStep {
  active: boolean;
  velocity: number; // 0-1
  accent: boolean;
}

export interface DrumPattern {
  name: string;
  bpm: number;
  steps: number;
  tracks: {
    name: string;
    asset: BGMAsset;
    pattern: PatternStep[];
  }[];
}

// ── Procedural Audio Generators ──────────────────────────────────────────────

/** Create white noise buffer */
function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Create pink noise buffer */
function createPinkNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

/** Create a sine tone oscillator */
function createTone(
  ctx: AudioContext, dest: AudioNode, freq: number, duration: number,
  type: OscillatorType = 'sine', attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2
): AudioNode[] {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + attack);
  gain.gain.linearRampToValueAtTime(sustain, now + attack + decay);
  gain.gain.setValueAtTime(sustain, now + duration - release);
  gain.gain.linearRampToValueAtTime(0, now + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + duration);
  return [osc, gain];
}

/** Create filtered noise burst (for percussion/SFX) */
function createNoiseBurst(
  ctx: AudioContext, dest: AudioNode, duration: number,
  filterFreq: number, filterQ: number, filterType: BiquadFilterType = 'bandpass',
  attack = 0.001, release?: number
): AudioNode[] {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const rel = release ?? duration * 0.8;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.8, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + rel);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  noise.start(now);
  noise.stop(now + duration);
  return [noise, filter, gain];
}

/** Create a Daf/Dafli frame drum hit — combines membrane thump + ring + jingle */
function createDafHit(
  ctx: AudioContext, dest: AudioNode, duration: number,
  variant: 'dum' | 'tak' | 'roll' = 'dum'
): AudioNode[] {
  const nodes: AudioNode[] = [];
  const now = ctx.currentTime;

  if (variant === 'dum') {
    // Deep membrane hit — low sine burst with pitch sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(duration, 0.6));
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration);
    nodes.push(osc, gain);

    // Body resonance — filtered pink noise
    const bodyNoise = ctx.createBufferSource();
    bodyNoise.buffer = createPinkNoiseBuffer(ctx, duration);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = 200;
    bodyFilter.Q.value = 3;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.4, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    bodyNoise.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(dest);
    bodyNoise.start(now);
    bodyNoise.stop(now + duration);
    nodes.push(bodyNoise, bodyFilter, bodyGain);

  } else if (variant === 'tak') {
    // Sharp rim/slap — higher pitched noise burst
    const slap = ctx.createBufferSource();
    slap.buffer = createNoiseBuffer(ctx, duration);
    const slapFilter = ctx.createBiquadFilter();
    slapFilter.type = 'bandpass';
    slapFilter.frequency.value = 3200;
    slapFilter.Q.value = 4;
    const slapGain = ctx.createGain();
    slapGain.gain.setValueAtTime(0.7, now);
    slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    slap.connect(slapFilter);
    slapFilter.connect(slapGain);
    slapGain.connect(dest);
    slap.start(now);
    slap.stop(now + duration);
    nodes.push(slap, slapFilter, slapGain);

    // Click transient
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.value = 1800;
    clickGain.gain.setValueAtTime(0.5, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    click.connect(clickGain);
    clickGain.connect(dest);
    click.start(now);
    click.stop(now + duration);
    nodes.push(click, clickGain);

  } else {
    // Roll — rapid sequence of soft hits
    const steps = 8;
    const stepDur = Math.min(duration, 0.6) / steps;
    for (let i = 0; i < steps; i++) {
      const t = now + i * stepDur;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150 + i * 10, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + stepDur * 0.8);
      gain.gain.setValueAtTime(0.3 + i * 0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + stepDur);
      nodes.push(osc, gain);
    }
  }

  // Jingle ring overtones (metal rings/zils on the frame)
  const jingleFreqs = [4200, 5800, 7400, 9600];
  for (const f of jingleFreqs) {
    const jOsc = ctx.createOscillator();
    const jGain = ctx.createGain();
    jOsc.type = 'sine';
    jOsc.frequency.value = f + (Math.random() - 0.5) * 200;
    jGain.gain.setValueAtTime(0.04, now);
    jGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + Math.random() * 0.1);
    jOsc.connect(jGain);
    jGain.connect(dest);
    jOsc.start(now);
    jOsc.stop(now + duration);
    nodes.push(jOsc, jGain);
  }

  return nodes;
}

/** Tabla-style hit (combining Dayan and Bayan) */
function createTablaHit(
  ctx: AudioContext, dest: AudioNode, duration: number,
  variant: 'na' | 'tin' | 'ge' | 'dha' = 'na'
): AudioNode[] {
  const nodes: AudioNode[] = [];
  const now = ctx.currentTime;
  const baseFreq = variant === 'na' ? 400 : variant === 'tin' ? 600 : variant === 'ge' ? 80 : 120;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq * 1.5, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.04);
  gain.gain.setValueAtTime(0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (variant === 'tin' ? 0.3 : 0.15));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + duration);
  nodes.push(osc, gain);

  // Harmonic overtones for resonance
  for (let h = 2; h <= 4; h++) {
    const hOsc = ctx.createOscillator();
    const hGain = ctx.createGain();
    hOsc.type = 'sine';
    hOsc.frequency.value = baseFreq * h;
    hGain.gain.setValueAtTime(0.15 / h, now);
    hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1 / h);
    hOsc.connect(hGain);
    hGain.connect(dest);
    hOsc.start(now);
    hOsc.stop(now + duration);
    nodes.push(hOsc, hGain);
  }

  return nodes;
}

// ── Note Frequency Table ─────────────────────────────────────────────────────

const NOTE_FREQS: Record<string, number> = {
  'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.26, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
};

// ── Master Asset Catalog ─────────────────────────────────────────────────────

export const BGM_ASSET_LIBRARY: BGMAsset[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SFX CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════

  // — Whoosh —
  {
    id: 'sfx_whoosh_light', name: 'Light Whoosh', category: 'sfx', subcategory: 'whoosh',
    description: 'Quick airy swoosh for fast transitions', duration: 0.5, color: '#3b82f6',
    icon: '💨', tags: ['whoosh', 'air', 'fast', 'light', 'transition'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 2000, 2, 'bandpass', 0.001, dur * 0.7),
  },
  {
    id: 'sfx_whoosh_heavy', name: 'Heavy Whoosh', category: 'sfx', subcategory: 'whoosh',
    description: 'Deep powerful swoosh for dramatic transitions', duration: 0.8, color: '#3b82f6',
    icon: '💨', tags: ['whoosh', 'deep', 'powerful', 'dramatic'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 600, 3, 'lowpass', 0.005, dur * 0.8),
  },
  {
    id: 'sfx_whoosh_reverse', name: 'Reverse Whoosh', category: 'sfx', subcategory: 'whoosh',
    description: 'Reverse buildup swoosh', duration: 0.6, color: '#3b82f6',
    icon: '💨', tags: ['whoosh', 'reverse', 'buildup'],
    generator: (ctx, dest, dur) => {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 2;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.8, now + dur * 0.85);
      gain.gain.linearRampToValueAtTime(0, now + dur);
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      noise.start(now); noise.stop(now + dur);
      return [noise, filter, gain];
    },
  },

  // — Impact —
  {
    id: 'sfx_impact_deep', name: 'Deep Impact', category: 'sfx', subcategory: 'impact',
    description: 'Cinematic deep bass impact', duration: 1.5, color: '#ef4444',
    icon: '💥', tags: ['impact', 'bass', 'cinematic', 'deep', 'boom'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      gain.gain.setValueAtTime(1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      nodes.push(osc, gain);
      nodes.push(...createNoiseBurst(ctx, dest, Math.min(dur, 0.3), 500, 1, 'lowpass', 0.001, 0.25));
      return nodes;
    },
  },
  {
    id: 'sfx_impact_punch', name: 'Punch Hit', category: 'sfx', subcategory: 'impact',
    description: 'Snappy punch/slap impact', duration: 0.4, color: '#ef4444',
    icon: '👊', tags: ['impact', 'punch', 'hit', 'slap'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 3000, 5, 'bandpass', 0.001, 0.1),
  },
  {
    id: 'sfx_impact_metal', name: 'Metal Clang', category: 'sfx', subcategory: 'impact',
    description: 'Metallic impact clang', duration: 1.0, color: '#6b7280',
    icon: '🔩', tags: ['impact', 'metal', 'clang', 'industrial'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const freqs = [800, 1600, 2400, 4800];
      for (const f of freqs) {
        nodes.push(...createTone(ctx, dest, f, dur, 'sine', 0.001, 0.02, 0.3, dur * 0.7));
      }
      nodes.push(...createNoiseBurst(ctx, dest, 0.05, 5000, 1, 'highpass', 0.001, 0.04));
      return nodes;
    },
  },

  // — Rise/Riser —
  {
    id: 'sfx_rise_cinematic', name: 'Cinematic Riser', category: 'sfx', subcategory: 'rise',
    description: 'Tension-building cinematic riser', duration: 3.0, color: '#8b5cf6',
    icon: '📈', tags: ['riser', 'tension', 'cinematic', 'buildup'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(2000, now + dur * 0.9);
      filter.type = 'lowpass'; filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(8000, now + dur * 0.9);
      filter.Q.value = 5;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.6, now + dur * 0.9);
      gain.gain.linearRampToValueAtTime(0, now + dur);
      osc.connect(filter); filter.connect(gain); gain.connect(dest);
      osc.start(now); osc.stop(now + dur);
      return [osc, filter, gain];
    },
  },
  {
    id: 'sfx_rise_white', name: 'White Noise Rise', category: 'sfx', subcategory: 'rise',
    description: 'White noise buildup swell', duration: 2.0, color: '#8b5cf6',
    icon: '📈', tags: ['riser', 'noise', 'swell', 'buildup'],
    generator: (ctx, dest, dur) => {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; const now = ctx.currentTime;
      filter.frequency.setValueAtTime(100, now);
      filter.frequency.exponentialRampToValueAtTime(12000, now + dur * 0.9);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.7, now + dur * 0.9);
      gain.gain.linearRampToValueAtTime(0, now + dur);
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      noise.start(now); noise.stop(now + dur);
      return [noise, filter, gain];
    },
  },

  // — Drop —
  {
    id: 'sfx_drop_bass', name: 'Bass Drop', category: 'sfx', subcategory: 'drop',
    description: 'Heavy sub-bass drop', duration: 1.2, color: '#dc2626',
    icon: '⬇️', tags: ['drop', 'bass', 'sub', 'edm', 'dubstep'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
      gain.gain.setValueAtTime(1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, gain];
    },
  },

  // — UI/Notification —
  {
    id: 'sfx_ui_click', name: 'UI Click', category: 'sfx', subcategory: 'ui-click',
    description: 'Subtle button click sound', duration: 0.1, color: '#06b6d4',
    icon: '🖱️', tags: ['ui', 'click', 'button', 'interface'],
    generator: (ctx, dest, dur) => createTone(ctx, dest, 1200, dur, 'sine', 0.001, 0.01, 0.3, 0.05),
  },
  {
    id: 'sfx_ui_pop', name: 'Pop', category: 'sfx', subcategory: 'ui-click',
    description: 'Playful pop sound', duration: 0.15, color: '#06b6d4',
    icon: '🫧', tags: ['ui', 'pop', 'bubble', 'playful'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + dur);
      gain.gain.setValueAtTime(0.7, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, gain];
    },
  },
  {
    id: 'sfx_notif_chime', name: 'Notification Chime', category: 'sfx', subcategory: 'notification',
    description: 'Pleasant two-tone chime', duration: 0.6, color: '#10b981',
    icon: '🔔', tags: ['notification', 'chime', 'alert', 'bell'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      nodes.push(...createTone(ctx, dest, 880, dur * 0.5, 'sine', 0.005, 0.05, 0.4, dur * 0.3));
      nodes.push(...createTone(ctx, dest, 1320, dur, 'sine', 0.005, 0.05, 0.3, dur * 0.5));
      return nodes;
    },
  },
  {
    id: 'sfx_notif_success', name: 'Success Sound', category: 'sfx', subcategory: 'notification',
    description: 'Achievement/success fanfare', duration: 0.8, color: '#22c55e',
    icon: '✅', tags: ['success', 'achievement', 'win', 'complete'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const notes = [523.25, 659.26, 783.99, 1046.50]; // C5 E5 G5 C6
      notes.forEach((f, i) => {
        const delay = i * 0.12;
        setTimeout(() => nodes.push(...createTone(ctx, dest, f, dur - delay, 'sine', 0.01, 0.05, 0.4, dur * 0.4)), delay * 1000);
      });
      return nodes;
    },
  },

  // — Cinematic —
  {
    id: 'sfx_cinematic_boom', name: 'Cinematic Boom', category: 'sfx', subcategory: 'cinematic',
    description: 'Epic trailer boom', duration: 2.5, color: '#f59e0b',
    icon: '🎬', tags: ['cinematic', 'boom', 'epic', 'trailer'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      // Sub boom
      const sub = ctx.createOscillator(); const subG = ctx.createGain();
      sub.type = 'sine'; sub.frequency.setValueAtTime(60, now);
      sub.frequency.exponentialRampToValueAtTime(20, now + 1);
      subG.gain.setValueAtTime(1, now); subG.gain.exponentialRampToValueAtTime(0.001, now + dur);
      sub.connect(subG); subG.connect(dest); sub.start(now); sub.stop(now + dur);
      nodes.push(sub, subG);
      // Noise layer
      nodes.push(...createNoiseBurst(ctx, dest, Math.min(dur, 0.5), 800, 1, 'lowpass', 0.001, 0.4));
      return nodes;
    },
  },
  {
    id: 'sfx_cinematic_tension', name: 'Tension Drone', category: 'sfx', subcategory: 'cinematic',
    description: 'Unsettling low tension drone', duration: 4.0, color: '#f59e0b',
    icon: '😰', tags: ['tension', 'drone', 'suspense', 'dark'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      // Low drone
      [55, 57, 82.5].forEach(f => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = f;
        const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
        lfo.frequency.value = 0.3 + Math.random() * 0.5; lfoG.gain.value = 2;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        lfo.start(now); lfo.stop(now + dur);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.15, now + dur * 0.3);
        g.gain.setValueAtTime(0.15, now + dur * 0.7); g.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, g, lfo, lfoG);
      });
      return nodes;
    },
  },

  // — Sci-Fi —
  {
    id: 'sfx_scifi_laser', name: 'Laser Zap', category: 'sfx', subcategory: 'sci-fi',
    description: 'Sci-fi laser shot', duration: 0.3, color: '#a855f7',
    icon: '⚡', tags: ['laser', 'zap', 'sci-fi', 'space'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'square'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + dur);
      gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, gain];
    },
  },
  {
    id: 'sfx_scifi_powerup', name: 'Power Up', category: 'sfx', subcategory: 'sci-fi',
    description: 'Energy charging power up', duration: 1.0, color: '#a855f7',
    icon: '🔋', tags: ['powerup', 'charge', 'energy', 'game'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sawtooth'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(3000, now + dur * 0.9);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + dur * 0.8);
      gain.gain.linearRampToValueAtTime(0, now + dur);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, gain];
    },
  },

  // — Glitch —
  {
    id: 'sfx_glitch_digital', name: 'Digital Glitch', category: 'sfx', subcategory: 'glitch',
    description: 'Digital artifact glitch burst', duration: 0.3, color: '#ec4899',
    icon: '📟', tags: ['glitch', 'digital', 'error', 'artifact'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = 200 + Math.random() * 4000;
        g.gain.setValueAtTime(0.3, now + i * dur / 6);
        g.gain.linearRampToValueAtTime(0, now + (i + 1) * dur / 6);
        osc.connect(g); g.connect(dest);
        osc.start(now + i * dur / 6); osc.stop(now + (i + 1) * dur / 6);
        nodes.push(osc, g);
      }
      return nodes;
    },
  },

  // — Magic —
  {
    id: 'sfx_magic_sparkle', name: 'Magic Sparkle', category: 'sfx', subcategory: 'magic',
    description: 'Magical shimmer/sparkle effect', duration: 1.5, color: '#fbbf24',
    icon: '✨', tags: ['magic', 'sparkle', 'fairy', 'shimmer'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      for (let i = 0; i < 12; i++) {
        const t = now + Math.random() * dur * 0.8;
        const freq = 2000 + Math.random() * 6000;
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1 + Math.random() * 0.2);
        osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.3);
        nodes.push(osc, g);
      }
      return nodes;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTRUMENT CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════

  // — Piano —
  {
    id: 'inst_piano_chord_c', name: 'Piano Chord C Major', category: 'instrument', subcategory: 'piano',
    description: 'Warm C major piano chord', duration: 2.0, color: '#f8fafc',
    icon: '🎹', tags: ['piano', 'chord', 'C major', 'warm'], key: 'C',
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [261.63, 329.63, 392.00].forEach(f => { // C4 E4 G4
        nodes.push(...createTone(ctx, dest, f, dur, 'sine', 0.005, 0.1, 0.5, dur * 0.5));
        // Harmonic overtone for realism
        nodes.push(...createTone(ctx, dest, f * 2, dur * 0.6, 'sine', 0.005, 0.05, 0.1, dur * 0.3));
      });
      return nodes;
    },
  },
  {
    id: 'inst_piano_chord_am', name: 'Piano Chord A Minor', category: 'instrument', subcategory: 'piano',
    description: 'Melancholic A minor piano chord', duration: 2.0, color: '#f8fafc',
    icon: '🎹', tags: ['piano', 'chord', 'A minor', 'melancholy'], key: 'Am',
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [220.00, 261.63, 329.63].forEach(f => { // A3 C4 E4
        nodes.push(...createTone(ctx, dest, f, dur, 'sine', 0.005, 0.1, 0.5, dur * 0.5));
        nodes.push(...createTone(ctx, dest, f * 2, dur * 0.5, 'sine', 0.005, 0.05, 0.08, dur * 0.3));
      });
      return nodes;
    },
  },
  {
    id: 'inst_piano_note_single', name: 'Piano Single Note', category: 'instrument', subcategory: 'piano',
    description: 'Single piano key press (A4)', duration: 1.5, color: '#f8fafc',
    icon: '🎹', tags: ['piano', 'note', 'single', 'A4'],
    generator: (ctx, dest, dur) => createTone(ctx, dest, 440, dur, 'sine', 0.003, 0.08, 0.5, dur * 0.6),
  },

  // — Guitar —
  {
    id: 'inst_guitar_strum', name: 'Guitar Strum', category: 'instrument', subcategory: 'guitar',
    description: 'Acoustic guitar strum (G chord)', duration: 2.0, color: '#92400e',
    icon: '🎸', tags: ['guitar', 'acoustic', 'strum', 'G chord'], key: 'G',
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const notes = [196.00, 246.94, 293.66, 392.00, 493.88, 587.33]; // G chord
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'triangle';
        const now = ctx.currentTime + i * 0.015; // strum delay
        osc.frequency.value = f;
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.25, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur - i * 0.015);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, g);
      });
      return nodes;
    },
  },
  {
    id: 'inst_guitar_power', name: 'Power Chord', category: 'instrument', subcategory: 'guitar',
    description: 'Electric guitar power chord', duration: 1.5, color: '#b91c1c',
    icon: '🎸', tags: ['guitar', 'electric', 'power', 'rock'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [110, 165, 220].forEach(f => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = f;
        const now = ctx.currentTime;
        const dist = ctx.createWaveShaper();
        const k = 50; const n = 44100;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)); }
        dist.curve = curve;
        g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(dist); dist.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, dist, g);
      });
      return nodes;
    },
  },

  // — Drums —
  {
    id: 'inst_drums_kick', name: 'Kick Drum', category: 'instrument', subcategory: 'drums',
    description: 'Punchy bass drum kick', duration: 0.5, color: '#7c3aed',
    icon: '🥁', tags: ['kick', 'bass drum', 'drums', 'beat'], bpm: 120,
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, gain];
    },
  },
  {
    id: 'inst_drums_snare', name: 'Snare Drum', category: 'instrument', subcategory: 'drums',
    description: 'Crisp snare drum hit', duration: 0.3, color: '#7c3aed',
    icon: '🥁', tags: ['snare', 'drums', 'crisp', 'beat'], bpm: 120,
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      // Tone body
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'triangle'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
      g.gain.setValueAtTime(0.7, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
      nodes.push(osc, g);
      // Snare rattle
      nodes.push(...createNoiseBurst(ctx, dest, 0.2, 4000, 2, 'highpass', 0.001, 0.15));
      return nodes;
    },
  },
  {
    id: 'inst_drums_hihat', name: 'Hi-Hat', category: 'instrument', subcategory: 'drums',
    description: 'Closed hi-hat cymbal', duration: 0.15, color: '#7c3aed',
    icon: '🥁', tags: ['hihat', 'cymbal', 'drums', 'beat'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 8000, 5, 'highpass', 0.001, 0.08),
  },
  {
    id: 'inst_drums_hihat_open', name: 'Open Hi-Hat', category: 'instrument', subcategory: 'drums',
    description: 'Open hi-hat cymbal ring', duration: 0.5, color: '#7c3aed',
    icon: '🥁', tags: ['hihat', 'open', 'cymbal', 'drums'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 7000, 3, 'highpass', 0.001, 0.4),
  },
  {
    id: 'inst_drums_clap', name: 'Hand Clap', category: 'instrument', subcategory: 'drums',
    description: 'Layered hand clap', duration: 0.25, color: '#7c3aed',
    icon: '👏', tags: ['clap', 'handclap', 'drums', 'beat'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      for (let i = 0; i < 3; i++) {
        const delay = i * 0.01;
        const n = ctx.createBufferSource();
        n.buffer = createNoiseBuffer(ctx, dur);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 3;
        const g = ctx.createGain(); const now = ctx.currentTime + delay;
        g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        n.connect(f); f.connect(g); g.connect(dest); n.start(now); n.stop(now + dur);
        nodes.push(n, f, g);
      }
      return nodes;
    },
  },

  // — Bass —
  {
    id: 'inst_bass_sub', name: 'Sub Bass', category: 'instrument', subcategory: 'bass',
    description: 'Deep sub-bass note', duration: 2.0, color: '#1e3a5f',
    icon: '🔊', tags: ['bass', 'sub', 'deep', 'low'],
    generator: (ctx, dest, dur) => createTone(ctx, dest, 55, dur, 'sine', 0.02, 0.1, 0.7, dur * 0.3),
  },
  {
    id: 'inst_bass_808', name: '808 Bass', category: 'instrument', subcategory: 'bass',
    description: 'Classic 808 bass with pitch slide', duration: 1.5, color: '#1e3a5f',
    icon: '🔊', tags: ['808', 'bass', 'trap', 'hiphop'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
      gain.gain.setValueAtTime(0.9, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, gain];
    },
  },

  // — Synth Lead —
  {
    id: 'inst_synth_lead_saw', name: 'Saw Lead', category: 'instrument', subcategory: 'synth-lead',
    description: 'Classic sawtooth synth lead', duration: 1.0, color: '#f472b6',
    icon: '🎛️', tags: ['synth', 'lead', 'sawtooth', 'electronic'],
    generator: (ctx, dest, dur) => createTone(ctx, dest, 440, dur, 'sawtooth', 0.01, 0.1, 0.6, dur * 0.3),
  },
  {
    id: 'inst_synth_lead_square', name: 'Square Lead', category: 'instrument', subcategory: 'synth-lead',
    description: 'Retro square wave lead', duration: 1.0, color: '#f472b6',
    icon: '🎛️', tags: ['synth', 'lead', 'square', 'retro', '8bit'],
    generator: (ctx, dest, dur) => createTone(ctx, dest, 440, dur, 'square', 0.01, 0.1, 0.4, dur * 0.3),
  },

  // — Synth Pad —
  {
    id: 'inst_synth_pad_warm', name: 'Warm Pad', category: 'instrument', subcategory: 'synth-pad',
    description: 'Lush warm atmospheric pad', duration: 4.0, color: '#c084fc',
    icon: '🌊', tags: ['pad', 'warm', 'atmospheric', 'ambient'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [220, 277.18, 329.63].forEach(f => { // Am chord
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine';
        const now = ctx.currentTime;
        osc.frequency.value = f;
        // Slow LFO vibrato
        const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
        lfo.frequency.value = 3; lfoG.gain.value = 2;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        lfo.start(now); lfo.stop(now + dur);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now + dur * 0.3);
        g.gain.setValueAtTime(0.2, now + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, g, lfo, lfoG);
      });
      return nodes;
    },
  },

  // — Strings —
  {
    id: 'inst_strings_sustain', name: 'String Sustain', category: 'instrument', subcategory: 'strings',
    description: 'Orchestral string section sustain', duration: 3.0, color: '#a16207',
    icon: '🎻', tags: ['strings', 'orchestral', 'sustain', 'classical'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [261.63, 329.63, 392.00, 523.25].forEach(f => { // C chord across octaves
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = f;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 3000; filter.Q.value = 1;
        const now = ctx.currentTime;
        // LFO tremolo
        const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
        lfo.frequency.value = 5; lfoG.gain.value = 0.05;
        lfo.connect(lfoG); lfoG.connect(g.gain);
        lfo.start(now); lfo.stop(now + dur);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + dur * 0.2);
        g.gain.setValueAtTime(0.12, now + dur * 0.8);
        g.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(filter); filter.connect(g); g.connect(dest);
        osc.start(now); osc.stop(now + dur);
        nodes.push(osc, filter, g, lfo, lfoG);
      });
      return nodes;
    },
  },

  // — Brass —
  {
    id: 'inst_brass_stab', name: 'Brass Stab', category: 'instrument', subcategory: 'brass',
    description: 'Punchy brass section stab', duration: 0.6, color: '#d97706',
    icon: '🎺', tags: ['brass', 'stab', 'horn', 'punchy'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [349.23, 440.00, 523.25].forEach(f => { // F4 A4 C5
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = f;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 2000; filter.Q.value = 2;
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.3, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(filter); filter.connect(g); g.connect(dest);
        osc.start(now); osc.stop(now + dur);
        nodes.push(osc, filter, g);
      });
      return nodes;
    },
  },

  // — Flute —
  {
    id: 'inst_flute_melody', name: 'Flute Note', category: 'instrument', subcategory: 'flute',
    description: 'Breathy flute note', duration: 1.5, color: '#059669',
    icon: '🪈', tags: ['flute', 'woodwind', 'breathy', 'melodic'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      const now = ctx.currentTime;
      // Add breath noise
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, dur);
      const nFilter = ctx.createBiquadFilter(); nFilter.type = 'bandpass'; nFilter.frequency.value = 3000; nFilter.Q.value = 1;
      const nGain = ctx.createGain(); nGain.gain.value = 0.03;
      noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(dest);
      noise.start(now); noise.stop(now + dur);
      // Vibrato
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = 5; lfoG.gain.value = 4;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      lfo.start(now); lfo.stop(now + dur);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.3, now + 0.1);
      g.gain.setValueAtTime(0.3, now + dur * 0.7);
      g.gain.linearRampToValueAtTime(0, now + dur);
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
      nodes.push(osc, g, lfo, lfoG, noise, nFilter, nGain);
      return nodes;
    },
  },

  // — Bells —
  {
    id: 'inst_bells_chime', name: 'Bell Chime', category: 'instrument', subcategory: 'bells',
    description: 'Clear bell strike with harmonics', duration: 3.0, color: '#fbbf24',
    icon: '🔔', tags: ['bell', 'chime', 'metallic', 'bright'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [880, 1320, 2640, 3520].forEach((f, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.25 / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * (1 - i * 0.15));
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, g);
      });
      return nodes;
    },
  },

  // — Organ —
  {
    id: 'inst_organ_chord', name: 'Organ Chord', category: 'instrument', subcategory: 'organ',
    description: 'Full drawbar organ chord', duration: 2.0, color: '#78350f',
    icon: '🎹', tags: ['organ', 'drawbar', 'chord', 'church'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const baseNotes = [261.63, 329.63, 392.00]; // C E G
      baseNotes.forEach(f => {
        // Multiple drawbar harmonics
        [1, 2, 3, 4, 6, 8].forEach((h, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.type = 'sine'; osc.frequency.value = f * h;
          const now = ctx.currentTime;
          const vol = [0.12, 0.08, 0.06, 0.04, 0.03, 0.02][i];
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(vol, now + 0.05);
          g.gain.setValueAtTime(vol, now + dur * 0.8);
          g.gain.linearRampToValueAtTime(0, now + dur);
          osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
          nodes.push(osc, g);
        });
      });
      return nodes;
    },
  },

  // — Percussion —
  {
    id: 'inst_perc_shaker', name: 'Shaker', category: 'instrument', subcategory: 'percussion',
    description: 'Rhythm shaker shake', duration: 0.2, color: '#065f46',
    icon: '🪇', tags: ['shaker', 'percussion', 'rhythm', 'maraca'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 6000, 3, 'highpass', 0.001, 0.12),
  },
  {
    id: 'inst_perc_cowbell', name: 'Cowbell', category: 'instrument', subcategory: 'percussion',
    description: 'Classic cowbell hit', duration: 0.4, color: '#065f46',
    icon: '🔔', tags: ['cowbell', 'percussion', 'beat'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      [560, 845].forEach(f => {
        nodes.push(...createTone(ctx, dest, f, dur, 'square', 0.001, 0.01, 0.5, dur * 0.5));
      });
      return nodes;
    },
  },
  {
    id: 'inst_perc_tambourine', name: 'Tambourine', category: 'instrument', subcategory: 'percussion',
    description: 'Tambourine shake', duration: 0.3, color: '#065f46',
    icon: '🪘', tags: ['tambourine', 'jingle', 'percussion'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      nodes.push(...createNoiseBurst(ctx, dest, dur, 7000, 4, 'highpass', 0.001, 0.2));
      // Metal jingles
      [5200, 6800, 8400].forEach(f => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, g);
      });
      return nodes;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETHNIC / TRADITIONAL INSTRUMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  // — Daf / Dafli (Frame Drum) —
  {
    id: 'inst_daf_dum', name: 'Daf Dum (Bass Hit)', category: 'instrument', subcategory: 'daf',
    description: 'Deep bass hit on Daf frame drum center with metal ring jingles', duration: 0.8, color: '#d4a574',
    icon: '🪘', tags: ['daf', 'dafli', 'duff', 'frame drum', 'dum', 'sufi', 'persian', 'south asian', 'middle eastern'],
    generator: (ctx, dest, dur) => createDafHit(ctx, dest, dur, 'dum'),
  },
  {
    id: 'inst_daf_tak', name: 'Daf Tak (Rim Hit)', category: 'instrument', subcategory: 'daf',
    description: 'Sharp rim slap on Daf frame drum with crisp attack', duration: 0.4, color: '#d4a574',
    icon: '🪘', tags: ['daf', 'dafli', 'duff', 'frame drum', 'tak', 'rim', 'slap'],
    generator: (ctx, dest, dur) => createDafHit(ctx, dest, dur, 'tak'),
  },
  {
    id: 'inst_daf_roll', name: 'Daf Roll (Tremolo)', category: 'instrument', subcategory: 'daf',
    description: 'Rapid Daf tremolo roll building intensity — signature Sufi rhythm', duration: 1.0, color: '#d4a574',
    icon: '🪘', tags: ['daf', 'dafli', 'duff', 'roll', 'tremolo', 'sufi', 'spiritual'],
    generator: (ctx, dest, dur) => createDafHit(ctx, dest, dur, 'roll'),
  },

  // — Tabla —
  {
    id: 'inst_tabla_na', name: 'Tabla Na', category: 'instrument', subcategory: 'tabla',
    description: 'Open Dayan (treble) stroke', duration: 0.5, color: '#8b6914',
    icon: '🪘', tags: ['tabla', 'na', 'dayan', 'indian', 'classical'],
    generator: (ctx, dest, dur) => createTablaHit(ctx, dest, dur, 'na'),
  },
  {
    id: 'inst_tabla_tin', name: 'Tabla Tin', category: 'instrument', subcategory: 'tabla',
    description: 'Ringing Dayan (treble) stroke with sustain', duration: 0.8, color: '#8b6914',
    icon: '🪘', tags: ['tabla', 'tin', 'ring', 'dayan'],
    generator: (ctx, dest, dur) => createTablaHit(ctx, dest, dur, 'tin'),
  },
  {
    id: 'inst_tabla_ge', name: 'Tabla Ge (Bass)', category: 'instrument', subcategory: 'tabla',
    description: 'Deep Bayan (bass) stroke', duration: 0.6, color: '#8b6914',
    icon: '🪘', tags: ['tabla', 'ge', 'bayan', 'bass', 'deep'],
    generator: (ctx, dest, dur) => createTablaHit(ctx, dest, dur, 'ge'),
  },
  {
    id: 'inst_tabla_dha', name: 'Tabla Dha', category: 'instrument', subcategory: 'tabla',
    description: 'Combined Dayan + Bayan simultaneous stroke', duration: 0.7, color: '#8b6914',
    icon: '🪘', tags: ['tabla', 'dha', 'combined', 'full'],
    generator: (ctx, dest, dur) => createTablaHit(ctx, dest, dur, 'dha'),
  },

  // — Sitar —
  {
    id: 'inst_sitar_pluck', name: 'Sitar Pluck', category: 'instrument', subcategory: 'sitar',
    description: 'Sitar string pluck with buzz and sympathetic resonance', duration: 2.5, color: '#b45309',
    icon: '🪕', tags: ['sitar', 'indian', 'pluck', 'raga', 'classical'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      // Main string
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 261.63; // Sa (C4)
      g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      // Buzz (jawari) effect — slight detuned oscillator
      const buzz = ctx.createOscillator(); const buzzG = ctx.createGain();
      buzz.type = 'sawtooth'; buzz.frequency.value = 262.5;
      buzzG.gain.setValueAtTime(0.15, now); buzzG.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.7);
      // Sympathetic strings
      const symp = ctx.createOscillator(); const sympG = ctx.createGain();
      symp.type = 'sine'; symp.frequency.value = 523.25; // Octave
      sympG.gain.setValueAtTime(0.05, now + 0.1); sympG.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
      buzz.connect(buzzG); buzzG.connect(dest); buzz.start(now); buzz.stop(now + dur);
      symp.connect(sympG); sympG.connect(dest); symp.start(now); symp.stop(now + dur);
      nodes.push(osc, g, buzz, buzzG, symp, sympG);
      return nodes;
    },
  },

  // — Marimba —
  {
    id: 'inst_marimba_hit', name: 'Marimba Hit', category: 'instrument', subcategory: 'marimba',
    description: 'Warm wooden marimba mallet strike', duration: 1.0, color: '#a3693b',
    icon: '🎵', tags: ['marimba', 'mallet', 'wooden', 'percussion'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 440;
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.6, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      // Wooden body resonance
      const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
      osc2.type = 'sine'; osc2.frequency.value = 440 * 4;
      g2.gain.setValueAtTime(0.1, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
      osc2.connect(g2); g2.connect(dest); osc2.start(now); osc2.stop(now + dur);
      nodes.push(osc, g, osc2, g2);
      return nodes;
    },
  },

  // — Harp —
  {
    id: 'inst_harp_gliss', name: 'Harp Glissando', category: 'instrument', subcategory: 'harp',
    description: 'Harp glissando sweep across strings', duration: 2.0, color: '#e5b047',
    icon: '🪕', tags: ['harp', 'glissando', 'sweep', 'ethereal'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.26, 783.99, 880.00];
      const stepDur = dur / notes.length;
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = f;
        const t = ctx.currentTime + i * stepDur;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur - i * stepDur);
        osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + dur - i * stepDur);
        nodes.push(osc, g);
      });
      return nodes;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOLEY CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'foley_rain', name: 'Rain', category: 'foley', subcategory: 'weather',
    description: 'Gentle rainfall ambience', duration: 5.0, color: '#60a5fa',
    icon: '🌧️', tags: ['rain', 'weather', 'gentle', 'nature'],
    generator: (ctx, dest, dur) => {
      const noise = ctx.createBufferSource();
      noise.buffer = createPinkNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 0.5;
      const gain = ctx.createGain(); gain.gain.value = 0.3;
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      noise.start(ctx.currentTime); noise.stop(ctx.currentTime + dur);
      return [noise, filter, gain];
    },
  },
  {
    id: 'foley_wind', name: 'Wind', category: 'foley', subcategory: 'wind',
    description: 'Blowing wind ambience', duration: 5.0, color: '#93c5fd',
    icon: '💨', tags: ['wind', 'breeze', 'blowing', 'nature'],
    generator: (ctx, dest, dur) => {
      const noise = ctx.createBufferSource();
      noise.buffer = createPinkNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 800;
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = 0.15; lfoG.gain.value = 400;
      lfo.connect(lfoG); lfoG.connect(filter.frequency);
      const gain = ctx.createGain(); gain.gain.value = 0.25;
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      const now = ctx.currentTime;
      lfo.start(now); lfo.stop(now + dur);
      noise.start(now); noise.stop(now + dur);
      return [noise, filter, gain, lfo, lfoG];
    },
  },
  {
    id: 'foley_fire_crackle', name: 'Fire Crackle', category: 'foley', subcategory: 'fire',
    description: 'Crackling campfire', duration: 5.0, color: '#fb923c',
    icon: '🔥', tags: ['fire', 'crackle', 'campfire', 'warm'],
    generator: (ctx, dest, dur) => {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 4000; filter.Q.value = 8;
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = 3; lfoG.gain.value = 3000;
      lfo.connect(lfoG); lfoG.connect(filter.frequency);
      const gain = ctx.createGain(); gain.gain.value = 0.15;
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      const now = ctx.currentTime;
      lfo.start(now); lfo.stop(now + dur);
      noise.start(now); noise.stop(now + dur);
      return [noise, filter, gain, lfo, lfoG];
    },
  },
  {
    id: 'foley_ocean_waves', name: 'Ocean Waves', category: 'foley', subcategory: 'water',
    description: 'Rhythmic ocean waves crashing on shore', duration: 6.0, color: '#0ea5e9',
    icon: '🌊', tags: ['ocean', 'waves', 'sea', 'water', 'beach'],
    generator: (ctx, dest, dur) => {
      const noise = ctx.createBufferSource();
      noise.buffer = createPinkNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 1200;
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.frequency.value = 0.1; lfoG.gain.value = 800;
      lfo.connect(lfoG); lfoG.connect(filter.frequency);
      const ampLfo = ctx.createOscillator(); const ampLfoG = ctx.createGain();
      ampLfo.frequency.value = 0.1; ampLfoG.gain.value = 0.15;
      const gain = ctx.createGain(); gain.gain.value = 0.2;
      ampLfo.connect(ampLfoG); ampLfoG.connect(gain.gain);
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      const now = ctx.currentTime;
      lfo.start(now); lfo.stop(now + dur);
      ampLfo.start(now); ampLfo.stop(now + dur);
      noise.start(now); noise.stop(now + dur);
      return [noise, filter, gain, lfo, lfoG, ampLfo, ampLfoG];
    },
  },
  {
    id: 'foley_footsteps', name: 'Footsteps', category: 'foley', subcategory: 'footsteps',
    description: 'Walking footsteps on hard floor', duration: 2.0, color: '#78716c',
    icon: '👟', tags: ['footsteps', 'walking', 'steps', 'floor'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const steps = 6;
      const stepInterval = dur / steps;
      for (let i = 0; i < steps; i++) {
        const t = ctx.currentTime + i * stepInterval;
        const n = ctx.createBufferSource();
        n.buffer = createNoiseBuffer(ctx, 0.1);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        n.connect(f); f.connect(g); g.connect(dest);
        n.start(t); n.stop(t + 0.1);
        nodes.push(n, f, g);
      }
      return nodes;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSITION SOUNDS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'trans_swoosh', name: 'Transition Swoosh', category: 'transition', subcategory: 'swoosh',
    description: 'Smooth transition swoosh', duration: 0.6, color: '#6366f1',
    icon: '✈️', tags: ['transition', 'swoosh', 'smooth', 'slide'],
    generator: (ctx, dest, dur) => createNoiseBurst(ctx, dest, dur, 1500, 2, 'bandpass', 0.05, dur * 0.6),
  },
  {
    id: 'trans_boom_hit', name: 'Boom Hit', category: 'transition', subcategory: 'boom',
    description: 'Low boom transition hit', duration: 1.0, color: '#6366f1',
    icon: '💣', tags: ['transition', 'boom', 'hit', 'low'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
      g.gain.setValueAtTime(0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
      return [osc, g];
    },
  },
  {
    id: 'trans_tape_stop', name: 'Tape Stop', category: 'transition', subcategory: 'tape-stop',
    description: 'Vinyl/tape slow-down stop effect', duration: 1.0, color: '#6366f1',
    icon: '📼', tags: ['tape', 'stop', 'slowdown', 'vinyl', 'dj'],
    generator: (ctx, dest, dur) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sawtooth'; const now = ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.setValueAtTime(5000, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + dur);
      g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(filter); filter.connect(g); g.connect(dest);
      osc.start(now); osc.stop(now + dur);
      return [osc, filter, g];
    },
  },
  {
    id: 'trans_stinger', name: 'Stinger', category: 'transition', subcategory: 'stinger',
    description: 'Short dramatic stinger for scene transitions', duration: 0.8, color: '#6366f1',
    icon: '🎯', tags: ['stinger', 'dramatic', 'transition', 'scene'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      // Bass hit
      const bass = ctx.createOscillator(); const bg = ctx.createGain();
      bass.type = 'sine'; const now = ctx.currentTime;
      bass.frequency.setValueAtTime(120, now);
      bass.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      bg.gain.setValueAtTime(0.8, now); bg.gain.exponentialRampToValueAtTime(0.001, now + dur);
      bass.connect(bg); bg.connect(dest); bass.start(now); bass.stop(now + dur);
      nodes.push(bass, bg);
      // Cymbal crash
      nodes.push(...createNoiseBurst(ctx, dest, dur * 0.6, 6000, 2, 'highpass', 0.001, dur * 0.5));
      return nodes;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT TEXTURES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'amb_space_drone', name: 'Space Drone', category: 'ambient', subcategory: 'space',
    description: 'Deep space ambient drone texture', duration: 8.0, color: '#1e1b4b',
    icon: '🌌', tags: ['space', 'drone', 'ambient', 'deep', 'sci-fi'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      [55, 82.5, 110].forEach(f => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        const lfo = ctx.createOscillator(); const lG = ctx.createGain();
        lfo.frequency.value = 0.05 + Math.random() * 0.1; lG.gain.value = 1;
        lfo.connect(lG); lG.connect(osc.frequency);
        lfo.start(now); lfo.stop(now + dur);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.15, now + dur * 0.2);
        g.gain.setValueAtTime(0.15, now + dur * 0.8);
        g.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + dur);
        nodes.push(osc, g, lfo, lG);
      });
      return nodes;
    },
  },
  {
    id: 'amb_forest_night', name: 'Forest Night', category: 'ambient', subcategory: 'forest',
    description: 'Nighttime forest ambience with crickets', duration: 6.0, color: '#14532d',
    icon: '🌲', tags: ['forest', 'night', 'crickets', 'nature'],
    generator: (ctx, dest, dur) => {
      const nodes: AudioNode[] = [];
      const now = ctx.currentTime;
      // Base wind
      const noise = ctx.createBufferSource();
      noise.buffer = createPinkNoiseBuffer(ctx, dur);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const g = ctx.createGain(); g.gain.value = 0.1;
      noise.connect(f); f.connect(g); g.connect(dest);
      noise.start(now); noise.stop(now + dur);
      nodes.push(noise, f, g);
      // Cricket chirps
      for (let i = 0; i < 20; i++) {
        const t = now + Math.random() * dur * 0.9;
        const chirpDur = 0.05 + Math.random() * 0.05;
        const osc = ctx.createOscillator(); const cg = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 4000 + Math.random() * 2000;
        cg.gain.setValueAtTime(0.06, t); cg.gain.exponentialRampToValueAtTime(0.001, t + chirpDur);
        osc.connect(cg); cg.connect(dest); osc.start(t); osc.stop(t + chirpDur);
        nodes.push(osc, cg);
      }
      return nodes;
    },
  },
];

// ── Helper Functions ─────────────────────────────────────────────────────────

/** Get all unique categories */
export function getCategories(): AssetCategory[] {
  return [...new Set(BGM_ASSET_LIBRARY.map(a => a.category))];
}

/** Get all unique subcategories within a category */
export function getSubcategories(category: AssetCategory): string[] {
  return [...new Set(BGM_ASSET_LIBRARY.filter(a => a.category === category).map(a => a.subcategory))];
}

/** Filter assets by category, subcategory, and search query */
export function filterAssets(
  category?: AssetCategory | 'all',
  subcategory?: string | 'all',
  search?: string,
): BGMAsset[] {
  let results = BGM_ASSET_LIBRARY;
  if (category && category !== 'all') results = results.filter(a => a.category === category);
  if (subcategory && subcategory !== 'all') results = results.filter(a => a.subcategory === subcategory);
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some(t => t.includes(q))
    );
  }
  return results;
}

/** Create a default empty mixer channel */
export function createDefaultChannel(index: number): MixerChannel {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return {
    id: `ch_${Date.now()}_${index}`,
    name: `Channel ${index + 1}`,
    asset: null,
    volume: 80,
    pan: 0,
    muted: false,
    solo: false,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    pitch: 0,
    filterFreq: 20000,
    filterQ: 0,
    reverbMix: 0,
    delayMix: 0,
    delayTime: 0.3,
    color: colors[index % colors.length],
  };
}

/** Create default drum pattern */
export function createDefaultDrumPattern(): DrumPattern {
  const kick = BGM_ASSET_LIBRARY.find(a => a.id === 'inst_drums_kick')!;
  const snare = BGM_ASSET_LIBRARY.find(a => a.id === 'inst_drums_snare')!;
  const hihat = BGM_ASSET_LIBRARY.find(a => a.id === 'inst_drums_hihat')!;
  const clap = BGM_ASSET_LIBRARY.find(a => a.id === 'inst_drums_clap')!;

  const emptyStep = (): PatternStep => ({ active: false, velocity: 0.8, accent: false });
  const makeTrack = (name: string, asset: BGMAsset, steps: number) => ({
    name, asset, pattern: Array.from({ length: steps }, emptyStep),
  });

  return {
    name: 'Basic Beat',
    bpm: 120,
    steps: 16,
    tracks: [
      makeTrack('Kick', kick, 16),
      makeTrack('Snare', snare, 16),
      makeTrack('Hi-Hat', hihat, 16),
      makeTrack('Clap', clap, 16),
    ],
  };
}

// ── Category Display Labels ──────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<AssetCategory, { label: string; icon: string; color: string }> = {
  'sfx': { label: 'Sound Effects', icon: '💥', color: '#ef4444' },
  'instrument': { label: 'Instruments', icon: '🎹', color: '#3b82f6' },
  'bgm-loop': { label: 'BGM Loops', icon: '🎵', color: '#8b5cf6' },
  'foley': { label: 'Foley', icon: '👟', color: '#78716c' },
  'ambient': { label: 'Ambient', icon: '🌊', color: '#06b6d4' },
  'transition': { label: 'Transitions', icon: '✈️', color: '#6366f1' },
  'vocal': { label: 'Vocal FX', icon: '🎤', color: '#ec4899' },
};

export const SUBCATEGORY_LABELS: Record<string, string> = {
  // SFX
  'whoosh': 'Whoosh', 'impact': 'Impact', 'rise': 'Riser', 'hit': 'Hit', 'drop': 'Drop',
  'ui-click': 'UI Click', 'notification': 'Notification', 'cinematic': 'Cinematic',
  'horror': 'Horror', 'comedy': 'Comedy', 'sci-fi': 'Sci-Fi', 'glitch': 'Glitch',
  'explosion': 'Explosion', 'magic': 'Magic',
  // Instruments
  'piano': 'Piano', 'guitar': 'Guitar', 'drums': 'Drums', 'bass': 'Bass',
  'strings': 'Strings', 'synth-lead': 'Synth Lead', 'synth-pad': 'Synth Pad',
  'brass': 'Brass', 'woodwind': 'Woodwind', 'percussion': 'Percussion',
  'ethnic': 'Ethnic', 'daf': 'Daf / Dafli', 'tabla': 'Tabla', 'sitar': 'Sitar',
  'flute': 'Flute', 'organ': 'Organ', 'harp': 'Harp', 'bells': 'Bells', 'marimba': 'Marimba',
  // Foley
  'footsteps': 'Footsteps', 'nature': 'Nature', 'weather': 'Weather', 'city': 'City',
  'mechanical': 'Mechanical', 'water': 'Water', 'fire': 'Fire', 'wind': 'Wind',
  'cloth': 'Cloth', 'glass': 'Glass', 'metal': 'Metal',
  // Ambient
  'space': 'Space', 'forest': 'Forest', 'ocean': 'Ocean', 'rain': 'Rain',
  'cafe': 'Cafe', 'night': 'Night', 'studio': 'Studio', 'crowd': 'Crowd', 'thunder': 'Thunder',
  // Transitions
  'swoosh': 'Swoosh', 'boom': 'Boom', 'reverse': 'Reverse', 'riser': 'Riser',
  'downer': 'Downer', 'stinger': 'Stinger', 'hit-stop': 'Hit Stop',
  'tape-stop': 'Tape Stop', 'vinyl-scratch': 'Vinyl Scratch',
};
