import { describe, it, expect } from 'vitest';
import {
  generateReverbImpulse,
  ENVIRONMENT_PRESETS,
  DEFAULT_REVERB_SETTINGS,
} from './reverbDsp';

// Mock Web Audio BaseAudioContext
class MockAudioBuffer {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
  duration: number;
  numberOfChannels: number;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number) {
    return this.channels[channel];
  }
}

class MockAudioContext {
  sampleRate = 44100;

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate) as any;
  }
}

describe('reverbDsp', () => {
  const mockCtx = new MockAudioContext() as any;

  it('defines all expected acoustic environment presets', () => {
    const ids = ENVIRONMENT_PRESETS.map((p) => p.id);
    expect(ids).toContain('studio');
    expect(ids).toContain('room');
    expect(ids).toContain('hall');
    expect(ids).toContain('cathedral');
    expect(ids).toContain('bathroom');
    expect(ids).toContain('canyon');
    expect(ids).toContain('arena');
    expect(ids).toContain('office');
    expect(ids).toContain('telephone');
    expect(ids).toContain('tunnel');
    expect(ids).toContain('none');
  });

  it('provides sensible default reverb settings', () => {
    expect(DEFAULT_REVERB_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_REVERB_SETTINGS.mix).toBe(25);
    expect(DEFAULT_REVERB_SETTINGS.decay).toBe(1.5);
    expect(DEFAULT_REVERB_SETTINGS.roomSize).toBe(50);
  });

  it('generates stereo impulse response buffer with correct duration', () => {
    const decay = 1.0;
    const preDelay = 20; // 20ms
    const buffer = generateReverbImpulse(mockCtx, decay, 40, preDelay, 50);

    expect(buffer.numberOfChannels).toBe(2);
    // Buffer length should cover decay (1.0s) + pre-delay (0.02s)
    const expectedSamples = Math.floor(44100 * (1.0 + 0.02));
    expect(buffer.length).toBe(expectedSamples);
  });

  it('ensures impulse response is peak normalized below 1.0', () => {
    const buffer = generateReverbImpulse(mockCtx, 2.0, 30, 10, 70);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    let maxL = 0;
    let maxR = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(left[i]) > maxL) maxL = Math.abs(left[i]);
      if (Math.abs(right[i]) > maxR) maxR = Math.abs(right[i]);
    }

    expect(maxL).toBeLessThanOrEqual(1.0);
    expect(maxR).toBeLessThanOrEqual(1.0);
    expect(maxL).toBeGreaterThan(0.01);
  });

  it('caches generated impulse responses for identical parameters', () => {
    const b1 = generateReverbImpulse(mockCtx, 1.5, 40, 20, 50);
    const b2 = generateReverbImpulse(mockCtx, 1.5, 40, 20, 50);
    expect(b1).toBe(b2);
  });
});
