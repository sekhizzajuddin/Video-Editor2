import { describe, it, expect } from 'vitest';
import { pitchShiftChannel, pitchShiftBufferRegion } from './phaseVocoder';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSine(freq: number, sampleRate: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

/** Dominant frequency via brute-force DFT over a warm, interior window. */
function dftPeakHz(samples: Float32Array, sampleRate: number, from = 16384, to = 32768): number {
  const seg = samples.subarray(Math.max(0, from), Math.min(samples.length, to));
  let bestF = 0;
  let bestM = -1;
  for (let f = 40; f <= 2000; f++) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * f) / sampleRate;
    for (let i = 0; i < seg.length; i++) {
      re += seg[i] * Math.cos(w * i);
      im -= seg[i] * Math.sin(w * i);
    }
    const m = re * re + im * im;
    if (m > bestM) {
      bestM = m;
      bestF = f;
    }
  }
  return bestF;
}

function expectPitch(input: Float32Array, semitones: number, sampleRate: number, tolerance = 0.01) {
  const out = pitchShiftChannel(input, semitones);
  expect(out.length).toBe(input.length);
  const expected = 220 * Math.pow(2, semitones / 12);
  const peak = dftPeakHz(out, sampleRate);
  expect(Math.abs(peak - expected) / expected).toBeLessThan(tolerance);
  return out;
}

function assertNoNaN(a: Float32Array) {
  for (let i = 0; i < a.length; i++) expect(Number.isNaN(a[i])).toBe(false);
}

// ── pitchShiftChannel ────────────────────────────────────────────────────────

describe('pitchShiftChannel (phase vocoder)', () => {
  const sr = 44100;

  it('returns a copy for 0 semitones', () => {
    const input = makeSine(220, sr, 1);
    const out = pitchShiftChannel(input, 0);
    expect(out).not.toBe(input);
    expect(out).toEqual(input);
  });

  it('shifts pitch accurately across the whole range (±12 st)', () => {
    const input = makeSine(220, sr, 3);
    for (const st of [-12, -7, -3, -1, 1, 3, 7, 12]) {
      expectPitch(input, st, sr);
    }
  });

  it('handles small shifts (fractional semitones) accurately', () => {
    const input = makeSine(220, sr, 3);
    for (const st of [-0.5, -0.2, 0.2, 0.5]) {
      expectPitch(input, st, sr);
    }
  });

  it('preserves duration exactly', () => {
    const input = makeSine(220, sr, 2.5);
    for (const st of [-12, -5, 7, 12]) {
      expect(pitchShiftChannel(input, st).length).toBe(input.length);
    }
  });

  it('keeps silence silent (no leakage, no NaN)', () => {
    const input = new Float32Array(sr);
    const out = pitchShiftChannel(input, 5);
    expect(out.length).toBe(input.length);
    let max = 0;
    for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
    expect(max).toBe(0);
  });

  it('produces no NaN for any input', () => {
    assertNoNaN(pitchShiftChannel(makeSine(110, sr, 1), -12));
    assertNoNaN(pitchShiftChannel(makeSine(440, sr, 1), 12));
    assertNoNaN(pitchShiftChannel(new Float32Array(5000).fill(0.1), 3));
  });

  it('leaves very short inputs unchanged', () => {
    for (const len of [0, 1, 100, 1024, 2047]) {
      const input = new Float32Array(len).fill(0.25);
      const out = pitchShiftChannel(input, 4);
      expect(out).toEqual(input);
    }
  });

  it('is deterministic', () => {
    const input = makeSine(220, sr, 1);
    expect(pitchShiftChannel(input, 3)).toEqual(pitchShiftChannel(input, 3));
  });

  it('roughly preserves RMS energy in the steady region', () => {
    const input = makeSine(220, sr, 3);
    const out = pitchShiftChannel(input, 4);
    const rms = (a: Float32Array, from: number, to: number) => {
      let s = 0;
      let c = 0;
      for (let i = from; i < to; i++) {
        s += a[i] * a[i];
        c++;
      }
      return Math.sqrt(s / c);
    };
    const ratio = rms(out, 16384, 65536) / rms(input, 16384, 65536);
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(1.3);
  });
});

// ── pitchShiftBufferRegion ───────────────────────────────────────────────────

function mockFactory(created: Float32Array[]) {
  return (channels: number, length: number, sampleRate: number) => {
    const arrays = Array.from({ length: channels }, () => new Float32Array(length));
    created.push(...arrays);
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (ch: number) => arrays[ch],
    };
  };
}

function mockBuffer(channels: Float32Array[], sampleRate: number) {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    duration: channels[0].length / sampleRate,
    getChannelData: (ch: number) => channels[ch],
  };
}

describe('pitchShiftBufferRegion', () => {
  const sr = 44100;

  it('returns null when there is nothing to shift', () => {
    const created: Float32Array[] = [];
    const buf = mockBuffer([makeSine(220, sr, 2)], sr);
    expect(pitchShiftBufferRegion(mockFactory(created), buf, 0)).toBeNull();
    expect(created.length).toBe(0);
  });

  it('shifts only the requested region and leaves the rest untouched', () => {
    const created: Float32Array[] = [];
    const input = makeSine(220, sr, 2);
    const buf = mockBuffer([input], sr);
    const out = pitchShiftBufferRegion(mockFactory(created), buf, 12, 0.5, 1.5);
    expect(out).not.toBeNull();
    const dst = created[0];

    const start = Math.floor(0.5 * sr);
    const end = Math.ceil(1.5 * sr);
    for (let i = 0; i < start; i++) expect(dst[i]).toBe(input[i]);
    for (let i = end; i < input.length; i++) expect(dst[i]).toBe(input[i]);

    // Shifted region has the same length and ~440 Hz content (interior window).
    expect(end - start).toBe(created[0].length - (input.length - end) - start);
    const peak = dftPeakHz(dst.subarray(start, end), sr, 0.05 * sr, 0.45 * sr);
    expect(Math.abs(peak - 440) / 440).toBeLessThan(0.02);
  });

  it('clamps the region to buffer bounds', () => {
    const created: Float32Array[] = [];
    const input = makeSine(220, sr, 1);
    const out = pitchShiftBufferRegion(mockFactory(created), mockBuffer([input], sr), 5, -10, 999);
    expect(out).not.toBeNull();
    expect(created[0].length).toBe(input.length);
  });

  it('processes every channel identically', () => {
    const created: Float32Array[] = [];
    const l = makeSine(220, sr, 1);
    const r = makeSine(220, sr, 1);
    const out = pitchShiftBufferRegion(mockFactory(created), mockBuffer([l, r], sr), 12);
    expect(out).not.toBeNull();
    expect(created[0]).toEqual(created[1]);
  });

  it('returns null for degenerate regions', () => {
    const created: Float32Array[] = [];
    const buf = mockBuffer([makeSine(220, sr, 1)], sr);
    expect(pitchShiftBufferRegion(mockFactory(created), buf, 5, 0.5, 0.501)).toBeNull();
    expect(created.length).toBe(0);
  });
});
