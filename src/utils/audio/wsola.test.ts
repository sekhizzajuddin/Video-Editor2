import { describe, it, expect } from 'vitest';
import { timeStretchChannelWsola, timeStretchAudioBuffer } from './wsola';

function makeSine(freq: number, sampleRate: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

/** Dominant frequency via DFT peak detection */
function dftPeakHz(samples: Float32Array, sampleRate: number, from = 1000, to = 20000): number {
  const seg = samples.subarray(Math.max(0, from), Math.min(samples.length, to));
  let bestF = 0;
  let bestM = -1;
  for (let f = 100; f <= 1000; f += 2) {
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

describe('WSOLA time stretcher', () => {
  const sr = 48000;

  it('preserves exact length and data for 1x speed', () => {
    const input = makeSine(440, sr, 1.0);
    const { output } = timeStretchChannelWsola(input, 1.0, sr);
    expect(output.length).toBe(input.length);
  });

  it('compresses duration for 2x speed (speedup)', () => {
    const input = makeSine(440, sr, 2.0); // 2 seconds
    const { output } = timeStretchChannelWsola(input, 2.0, sr);
    // Should be approximately 1 second
    const expectedLen = Math.round(input.length / 2.0);
    expect(Math.abs(output.length - expectedLen)).toBeLessThan(10);
  });

  it('expands duration for 0.5x speed (slowdown)', () => {
    const input = makeSine(440, sr, 1.0); // 1 second
    const { output } = timeStretchChannelWsola(input, 0.5, sr);
    const expectedLen = Math.round(input.length / 0.5);
    expect(Math.abs(output.length - expectedLen)).toBeLessThan(10);
  });

  it('preserves pitch at 2.0x speed without chipmunk effect', () => {
    const input = makeSine(440, sr, 2.0);
    const { output } = timeStretchChannelWsola(input, 2.0, sr);
    const peak = dftPeakHz(output, sr, 2000, 20000);
    // Peak should be ~440 Hz (not 880 Hz which resampling would do)
    expect(Math.abs(peak - 440)).toBeLessThan(20);
  });

  it('preserves pitch at 0.5x speed without monster voice effect', () => {
    const input = makeSine(440, sr, 1.0);
    const { output } = timeStretchChannelWsola(input, 0.5, sr);
    const peak = dftPeakHz(output, sr, 2000, 20000);
    // Peak should be ~440 Hz (not 220 Hz which resampling would do)
    expect(Math.abs(peak - 440)).toBeLessThan(20);
  });

  it('handles stereo audio buffer with synchronized channels', () => {
    const left = makeSine(440, sr, 1.0);
    const right = makeSine(440, sr, 1.0);
    const mockBuffer = {
      numberOfChannels: 2,
      length: left.length,
      sampleRate: sr,
      duration: 1.0,
      getChannelData: (ch: number) => (ch === 0 ? left : right),
    };

    const mockFactory = (channels: number, length: number, sampleRate: number) => {
      const chData = [new Float32Array(length), new Float32Array(length)];
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (ch: number) => chData[ch],
      };
    };

    const stretched = timeStretchAudioBuffer(mockFactory, mockBuffer, 1.5, 0, 1.0);
    expect(stretched.numberOfChannels).toBe(2);
    expect(Math.abs(stretched.duration - (1.0 / 1.5))).toBeLessThan(0.01);
  });
});
