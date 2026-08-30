import { describe, it, expect } from 'vitest';
import {
  toneToSemitones,
  toneToFormant,
  effectiveVocalPitchSt,
  effectiveVocalFormant,
  estimateVocalF0,
  computeMatchShiftSemitones,
  extractMonoWindow,
  analyzeClipsForVocalMatch,
  type DecodedAudioLike,
} from './vocalTone';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSine(freq: number, sampleRate: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

function makeBuffer(channels: Float32Array[], sampleRate: number): DecodedAudioLike {
  const length = channels[0].length;
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channels[ch],
  };
}

function f0Of(samples: Float32Array, sampleRate: number): number | null {
  // Zero-crossing based estimate — exact for clean sines.
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) crossings++;
  }
  return (crossings / 2 / samples.length) * sampleRate;
}

// ── tone mapping ─────────────────────────────────────────────────────────────

describe('tone mapping', () => {
  it('maps -100..+100 to ±5 semitones', () => {
    expect(toneToSemitones(0)).toBe(0);
    expect(toneToSemitones(100)).toBe(5);
    expect(toneToSemitones(-100)).toBe(-5);
    expect(toneToSemitones(50)).toBe(2.5);
    expect(toneToSemitones(-40)).toBe(-2);
  });

  it('clamps out-of-range tone values', () => {
    expect(toneToSemitones(250)).toBe(5);
    expect(toneToSemitones(-999)).toBe(-5);
    expect(toneToFormant(250)).toBe(100);
    expect(toneToFormant(-250)).toBe(-100);
  });

  it('tone drives the formant scale directly (same sign/direction)', () => {
    expect(toneToFormant(0)).toBe(0);
    expect(toneToFormant(-100)).toBe(-100); // feminine = brighter
    expect(toneToFormant(100)).toBe(100);   // masculine = darker
  });
});

// ── effective values ─────────────────────────────────────────────────────────

describe('effectiveVocalPitchSt', () => {
  it('combines manual pitch + tone + auto-match shift', () => {
    expect(effectiveVocalPitchSt({})).toBe(0);
    expect(effectiveVocalPitchSt({ pitch: 2 })).toBe(2);
    expect(effectiveVocalPitchSt({ tone: 100 })).toBe(5);
    expect(effectiveVocalPitchSt({ pitch: -1, tone: 40 })).toBe(1); // -1 + 2
  });

  it('applies the auto-match shift only when enabled', () => {
    const base = { pitch: 0, tone: 0, vocalMatchShift: 3.4 };
    expect(effectiveVocalPitchSt(base)).toBe(0); // disabled
    expect(effectiveVocalPitchSt({ ...base, vocalMatchEnabled: true })).toBe(3.4);
    expect(effectiveVocalPitchSt({ ...base, vocalMatchEnabled: true, pitch: -1 })).toBe(2.4);
  });

  it('ignores non-finite auto-match shifts', () => {
    expect(effectiveVocalPitchSt({ vocalMatchEnabled: true, vocalMatchShift: NaN })).toBe(0);
    expect(effectiveVocalPitchSt({ vocalMatchEnabled: true, vocalMatchShift: Infinity })).toBe(0);
  });

  it('clamps the total to ±14 semitones', () => {
    expect(effectiveVocalPitchSt({ pitch: 12, tone: 100 })).toBe(14);
    expect(effectiveVocalPitchSt({ pitch: -12, tone: -100 })).toBe(-14);
    expect(effectiveVocalPitchSt({ vocalMatchEnabled: true, vocalMatchShift: 14, pitch: 5 })).toBe(14);
  });
});

describe('effectiveVocalFormant', () => {
  it('combines manual formant + tone formant', () => {
    expect(effectiveVocalFormant({})).toBe(0);
    expect(effectiveVocalFormant({ voiceFormant: 30 })).toBe(30);
    expect(effectiveVocalFormant({ tone: 50 })).toBe(50);
    expect(effectiveVocalFormant({ voiceFormant: 10, tone: -20 })).toBe(-10);
  });

  it('adds auto-match compensation in the opposite direction (keeps voice natural)', () => {
    // Raising pitch (+st) shifts formants up → compensate by darkening (+units).
    expect(effectiveVocalFormant({ vocalMatchEnabled: true, vocalMatchShift: 3 })).toBe(24);
    // Lowering pitch → brighten.
    expect(effectiveVocalFormant({ vocalMatchEnabled: true, vocalMatchShift: -2 })).toBe(-16);
  });

  it('clamps to ±100', () => {
    expect(effectiveVocalFormant({ voiceFormant: 100, tone: 100, vocalMatchEnabled: true, vocalMatchShift: 10 })).toBe(100);
    expect(effectiveVocalFormant({ voiceFormant: -100, tone: -100, vocalMatchEnabled: true, vocalMatchShift: -10 })).toBe(-100);
  });
});

// ── F0 estimation ────────────────────────────────────────────────────────────

describe('estimateVocalF0', () => {
  it('detects a 110 Hz sine', () => {
    const f0 = estimateVocalF0(makeSine(110, 44100, 2), 44100);
    expect(f0).not.toBeNull();
    expect(f0!).toBeGreaterThan(105);
    expect(f0!).toBeLessThan(116);
  });

  it('detects a 220 Hz sine', () => {
    const f0 = estimateVocalF0(makeSine(220, 44100, 2), 44100);
    expect(f0!).toBeGreaterThan(210);
    expect(f0!).toBeLessThan(231);
  });

  it('detects a 320 Hz sine (female-range voice)', () => {
    const f0 = estimateVocalF0(makeSine(320, 48000, 2), 48000);
    expect(f0!).toBeGreaterThan(305);
    expect(f0!).toBeLessThan(336);
  });

  it('still detects pitch in a noisy voice (sine + noise)', () => {
    const sine = makeSine(180, 44100, 3);
    let seed = 42;
    for (let i = 0; i < sine.length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const noise = (seed / 2147483648) * 2 - 1;
      sine[i] += noise * 0.15;
    }
    const f0 = estimateVocalF0(sine, 44100);
    expect(f0).not.toBeNull();
    expect(f0!).toBeGreaterThan(170);
    expect(f0!).toBeLessThan(190);
  });

  it('returns null for silence', () => {
    expect(estimateVocalF0(new Float32Array(44100 * 2), 44100)).toBeNull();
  });

  it('returns null for pure noise', () => {
    const noise = new Float32Array(44100 * 2);
    let seed = 7;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise[i] = (seed / 2147483648) * 2 - 1;
    }
    expect(estimateVocalF0(noise, 44100)).toBeNull();
  });

  it('returns null for tiny/empty inputs', () => {
    expect(estimateVocalF0(new Float32Array(0), 44100)).toBeNull();
    expect(estimateVocalF0(new Float32Array(100), 44100)).toBeNull();
    expect(estimateVocalF0(makeSine(220, 44100, 1), 0)).toBeNull();
  });
});

// ── match shift math ─────────────────────────────────────────────────────────

describe('computeMatchShiftSemitones', () => {
  it('computes the correction to match the reference', () => {
    expect(computeMatchShiftSemitones(220, 110)).toBeCloseTo(12, 5);
    expect(computeMatchShiftSemitones(110, 220)).toBeCloseTo(-12, 5);
    expect(computeMatchShiftSemitones(220, 220)).toBe(0);
    // 12·log2(200/150) = 4.98045 → rounded to 2 decimals.
    expect(computeMatchShiftSemitones(200, 150)).toBe(4.98);
  });

  it('returns null for invalid frequencies', () => {
    expect(computeMatchShiftSemitones(0, 100)).toBeNull();
    expect(computeMatchShiftSemitones(100, -5)).toBeNull();
    expect(computeMatchShiftSemitones(NaN, 100)).toBeNull();
    expect(computeMatchShiftSemitones(100, Infinity)).toBeNull();
  });

  it('caps extreme corrections at ±14 st', () => {
    expect(computeMatchShiftSemitones(500, 60)).toBe(14);
    expect(computeMatchShiftSemitones(60, 500)).toBe(-14);
  });
});

// ── mono window extraction ───────────────────────────────────────────────────

describe('extractMonoWindow', () => {
  it('slices and downmixes stereo to mono', () => {
    const sr = 100;
    const l = new Float32Array(sr * 2).fill(0.4);
    const r = new Float32Array(sr * 2).fill(0.8);
    const win = extractMonoWindow(makeBuffer([l, r], sr), 1, 2);
    expect(win.length).toBe(100);
    expect(win[0]).toBeCloseTo(0.6, 5);
  });

  it('clamps to buffer bounds', () => {
    const mono = new Float32Array(500).fill(0.1);
    const win = extractMonoWindow(makeBuffer([mono], 100), -5, 999);
    expect(win.length).toBe(500);
  });
});

// ── end-to-end clip matching (injected decode) ──────────────────────────────

describe('analyzeClipsForVocalMatch', () => {
  const sr = 44100;

  it('matches every clip to the first (earliest) clip and reports shifts', async () => {
    const media = [
      { id: 'm1', url: 'blob:ref', duration: 2 },
      { id: 'm2', url: 'blob:low', duration: 2 },
      { id: 'm3', url: 'blob:high', duration: 2 },
    ];
    const clips = [
      { id: 'c3', mediaId: 'm3', startTime: 8, trimStart: 0, duration: 2, speed: 1 }, // later
      { id: 'c1', mediaId: 'm1', startTime: 0, trimStart: 0, duration: 2, speed: 1 }, // reference
      { id: 'c2', mediaId: 'm2', startTime: 4, trimStart: 0, duration: 2, speed: 1 },
    ];
    const decode = async (url?: string) => {
      if (url === 'blob:ref') return makeBuffer([makeSine(200, sr, 2)], sr);
      if (url === 'blob:low') return makeBuffer([makeSine(100, sr, 2)], sr);
      if (url === 'blob:high') return makeBuffer([makeSine(300, sr, 2)], sr);
      return null;
    };

    const results = await analyzeClipsForVocalMatch(clips as never, media, decode);

    const byId = Object.fromEntries(results.map((r) => [r.clipId, r]));
    expect(byId['c1'].status).toBe('reference');
    expect(byId['c1'].f0).toBeGreaterThan(190);
    expect(byId['c1'].f0).toBeLessThan(210);
    expect(byId['c2'].shiftSemitones).toBeCloseTo(12, 1); // 100 → 200 Hz
    expect(byId['c3'].shiftSemitones).toBeCloseTo(-7.02, 1); // 300 → 200 Hz
  });

  it('respects trim windows (only the used source region is analysed)', async () => {
    // Clip uses only [1s, 2s) of a buffer that contains 200 Hz then 400 Hz.
    const media = [
      { id: 'm1', url: 'blob:a', duration: 3 },
      { id: 'm2', url: 'blob:b', duration: 2 },
    ];
    const first = new Float32Array(sr * 3);
    const second = new Float32Array(sr * 2);
    for (let i = 0; i < sr; i++) {
      first[i] = 0.5 * Math.sin((2 * Math.PI * 200 * i) / sr);
      second[i] = 0.5 * Math.sin((2 * Math.PI * 200 * i) / sr);
    }
    for (let i = sr; i < sr * 3; i++) first[i] = 0.5 * Math.sin((2 * Math.PI * 400 * i) / sr);
    for (let i = sr; i < sr * 2; i++) second[i] = 0.5 * Math.sin((2 * Math.PI * 400 * i) / sr);

    const clips = [
      { id: 'c1', mediaId: 'm1', startTime: 0, trimStart: 1, duration: 2, speed: 1 },
      { id: 'c2', mediaId: 'm2', startTime: 3, trimStart: 1, duration: 1, speed: 1 },
    ];
    const decode = async (url?: string) =>
      url === 'blob:a' ? makeBuffer([first], sr) : makeBuffer([second], sr);

    const results = await analyzeClipsForVocalMatch(clips as never, media, decode);
    const byId = Object.fromEntries(results.map((r) => [r.clipId, r]));
    // Both windows are [1s,2s) → 400 Hz → shift ≈ 0.
    expect(byId['c1'].f0).toBeGreaterThan(380);
    expect(byId['c1'].f0).toBeLessThan(420);
    expect(byId['c2'].shiftSemitones).toBeCloseTo(0, 1);
  });

  it('marks clips without voice/no audio without failing', async () => {
    const media = [
      { id: 'm1', url: 'blob:v', duration: 2 },
      { id: 'm2', url: 'blob:n', duration: 2 },
      { id: 'm3', duration: 2 }, // no url/blob at all
    ];
    const clips = [
      { id: 'c1', mediaId: 'm1', startTime: 0, trimStart: 0, duration: 2, speed: 1 },
      { id: 'c2', mediaId: 'm2', startTime: 4, trimStart: 0, duration: 2, speed: 1 },
      { id: 'c3', mediaId: 'm3', startTime: 8, trimStart: 0, duration: 2, speed: 1 },
    ];
    const noise = new Float32Array(sr * 2);
    let seed = 3;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise[i] = (seed / 2147483648) * 2 - 1;
    }
    const decode = async (url?: string) =>
      url === 'blob:v' ? makeBuffer([makeSine(220, sr, 2)], sr) : makeBuffer([noise], sr);

    const results = await analyzeClipsForVocalMatch(clips as never, media, decode);
    const byId = Object.fromEntries(results.map((r) => [r.clipId, r]));
    expect(byId['c1'].status).toBe('reference');
    expect(byId['c1'].shiftSemitones).toBe(0);
    expect(byId['c2'].status).toBe('no-voice');
    expect(byId['c2'].shiftSemitones).toBeNull();
    expect(byId['c3'].status).toBe('no-audio');
  });

  it('returns all no-voice when no clip has a detectable voice', async () => {
    const media = [{ id: 'm1', url: 'blob:1' }, { id: 'm2', url: 'blob:2' }];
    const clips = [
      { id: 'c1', mediaId: 'm1', startTime: 0, trimStart: 0, duration: 1, speed: 1 },
      { id: 'c2', mediaId: 'm2', startTime: 5, trimStart: 0, duration: 1, speed: 1 },
    ];
    const decode = async () => makeBuffer([new Float32Array(sr)], sr); // silence

    const results = await analyzeClipsForVocalMatch(clips as never, media, decode);
    expect(results.every((r) => r.status === 'no-voice')).toBe(true);
    expect(results.every((r) => r.shiftSemitones === null)).toBe(true);
  });

  it('orders by startTime so the reference is the FIRST clip regardless of input order', async () => {
    const media = [
      { id: 'm1', url: 'blob:a', duration: 2 },
      { id: 'm2', url: 'blob:b', duration: 2 },
    ];
    const clips = [
      { id: 'late', mediaId: 'm2', startTime: 20, trimStart: 0, duration: 2, speed: 1 },
      { id: 'first', mediaId: 'm1', startTime: 0, trimStart: 0, duration: 2, speed: 1 },
    ];
    const decode = async (url?: string) =>
      url === 'blob:a' ? makeBuffer([makeSine(200, sr, 2)], sr) : makeBuffer([makeSine(100, sr, 2)], sr);

    const results = await analyzeClipsForVocalMatch(clips as never, media, decode);
    expect(results[0].clipId).toBe('first');
    expect(results[0].status).toBe('reference');
    expect(results[1].shiftSemitones).toBeCloseTo(12, 1);
  });
});

// Sanity: the F0 helper used above agrees with the estimator on clean sines.
describe('test helper sanity', () => {
  it('f0Of measures clean sines', () => {
    const f0 = f0Of(makeSine(220, 44100, 1), 44100);
    expect(f0).toBeGreaterThan(218);
    expect(f0).toBeLessThan(222);
  });
});
