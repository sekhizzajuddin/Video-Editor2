import { describe, it, expect } from 'vitest';
import {
  bridgeAndMergeSpeechIntervals,
  calculateDuckingRegions,
  generateClipDuckingKeyframes,
  scanClipVocalIntervals,
  applyAutoDuckingToTrack,
  AutoDuckingConfig,
  DEFAULT_DUCKING_CONFIG,
  SpeechInterval,
} from './aiAudioDucking';
import { TimelineClip, TimelineTrack, SubtitleItem } from '@/types';

const makeClip = (id: string, startTime: number, duration: number, extra: any = {}): TimelineClip => ({
  id,
  mediaId: `media_${id}`,
  trackId: 'track_1',
  startTime,
  duration,
  trimStart: 0,
  ...extra,
});

describe('bridgeAndMergeSpeechIntervals', () => {
  it('returns empty array when given no intervals', () => {
    expect(bridgeAndMergeSpeechIntervals([])).toEqual([]);
  });

  it('keeps a single interval intact', () => {
    const single: SpeechInterval[] = [{ start: 2.0, end: 4.5 }];
    const res = bridgeAndMergeSpeechIntervals(single, 0.8);
    expect(res).toHaveLength(1);
    expect(res[0].start).toBe(2.0);
    expect(res[0].end).toBe(4.5);
  });

  it('bridges intervals separated by less than bridgeGap (e.g. natural pauses between words)', () => {
    const intervals: SpeechInterval[] = [
      { start: 1.0, end: 2.5 },
      { start: 2.9, end: 4.0 }, // gap is 0.4s <= 0.8s
    ];
    const res = bridgeAndMergeSpeechIntervals(intervals, 0.8);
    expect(res).toHaveLength(1);
    expect(res[0].start).toBe(1.0);
    expect(res[0].end).toBe(4.0);
  });

  it('does NOT bridge intervals separated by more than bridgeGap', () => {
    const intervals: SpeechInterval[] = [
      { start: 1.0, end: 2.5 },
      { start: 4.5, end: 6.0 }, // gap is 2.0s > 0.8s
    ];
    const res = bridgeAndMergeSpeechIntervals(intervals, 0.8);
    expect(res).toHaveLength(2);
    expect(res[0].end).toBe(2.5);
    expect(res[1].start).toBe(4.5);
  });

  it('sorts unsorted speech intervals before bridging', () => {
    const intervals: SpeechInterval[] = [
      { start: 5.0, end: 6.5 },
      { start: 1.0, end: 2.0 },
      { start: 2.3, end: 3.0 },
    ];
    const res = bridgeAndMergeSpeechIntervals(intervals, 0.8);
    expect(res).toHaveLength(2);
    expect(res[0].start).toBe(1.0);
    expect(res[0].end).toBe(3.0);
    expect(res[1].start).toBe(5.0);
    expect(res[1].end).toBe(6.5);
  });
});

describe('calculateDuckingRegions', () => {
  const config: AutoDuckingConfig = {
    ...DEFAULT_DUCKING_CONFIG,
    attackDuration: 0.3,
    holdDuration: 0.4,
    releaseDuration: 0.5,
  };

  it('calculates proper pre-roll attack, hold, and release padding', () => {
    const speech: SpeechInterval[] = [{ start: 5.0, end: 10.0 }];
    const regions = calculateDuckingRegions(speech, config);

    expect(regions).toHaveLength(1);
    expect(regions[0].attackStart).toBeCloseTo(4.7); // 5.0 - 0.3
    expect(regions[0].duckStart).toBeCloseTo(5.0);
    expect(regions[0].duckEnd).toBeCloseTo(10.4);   // 10.0 + 0.4
    expect(regions[0].releaseEnd).toBeCloseTo(10.9); // 10.4 + 0.5
  });

  it('merges contiguous ducking regions when release overlaps next attack', () => {
    // Word 1: 2.0 to 4.0 -> releaseEnd = 4.0 + 0.4 + 0.5 = 4.9
    // Word 2: 5.0 to 7.0 -> attackStart = 5.0 - 0.3 = 4.7 (overlaps 4.9!)
    const speech: SpeechInterval[] = [
      { start: 2.0, end: 4.0 },
      { start: 5.0, end: 7.0 },
    ];
    const regions = calculateDuckingRegions(speech, config);
    expect(regions).toHaveLength(1);
    expect(regions[0].attackStart).toBeCloseTo(1.7);
    expect(regions[0].duckEnd).toBeCloseTo(7.4);
    expect(regions[0].releaseEnd).toBeCloseTo(7.9);
  });
});

describe('generateClipDuckingKeyframes', () => {
  const config: AutoDuckingConfig = {
    ...DEFAULT_DUCKING_CONFIG,
    duckAmountDb: -18,
    attackDuration: 0.3,
    holdDuration: 0.4,
    releaseDuration: 0.5,
  };

  it('generates flat keyframes when no speech overlaps the BGM clip', () => {
    const bgmClip = makeClip('bgm', 0, 10);
    const regions = [{ attackStart: 12, duckStart: 12.3, duckEnd: 15, releaseEnd: 15.5 }];
    const kfs = generateClipDuckingKeyframes(bgmClip, regions, config);

    expect(kfs.length).toBeGreaterThanOrEqual(2);
    expect(kfs[0].value).toBe(0);
    expect(kfs[kfs.length - 1].value).toBe(0);
  });

  it('generates smooth ducking ramp down and recovery keyframes inside the clip', () => {
    const bgmClip = makeClip('bgm', 0, 20, { audioSettings: { volume: 0 } });
    // Speech from 5.0s to 10.0s
    // Attack starts at 4.7s, full duck at 5.0s, hold until 10.4s, release at 10.9s
    const regions = calculateDuckingRegions([{ start: 5.0, end: 10.0 }], config);
    const kfs = generateClipDuckingKeyframes(bgmClip, regions, config);

    expect(kfs.length).toBeGreaterThanOrEqual(4);
    // Before attack
    expect(kfs[0].time).toBe(0);
    expect(kfs[0].value).toBe(0);

    // Duck keyframe reached
    const duckPoint = kfs.find((k) => Math.abs(k.time - 5.0) < 0.05);
    expect(duckPoint).toBeDefined();
    expect(duckPoint!.value).toBeCloseTo(-18);

    // Release keyframe back to 0 dB
    const releasePoint = kfs.find((k) => Math.abs(k.time - 10.9) < 0.05);
    expect(releasePoint).toBeDefined();
    expect(releasePoint!.value).toBeCloseTo(0);

    // End of clip
    expect(kfs[kfs.length - 1].time).toBeCloseTo(20);
    expect(kfs[kfs.length - 1].value).toBeCloseTo(0);
  });

  it('respects base clip volume offset', () => {
    const bgmClip = makeClip('bgm', 0, 10, { audioSettings: { volume: -6 } });
    const regions = calculateDuckingRegions([{ start: 2.0, end: 5.0 }], config);
    const kfs = generateClipDuckingKeyframes(bgmClip, regions, config);

    // Duck volume should be baseVolume + duckAmountDb = -6 + (-18) = -24 dB
    const duckPoint = kfs.find((k) => Math.abs(k.time - 2.0) < 0.05);
    expect(duckPoint).toBeDefined();
    expect(duckPoint!.value).toBeCloseTo(-24);
  });
});

describe('scanClipVocalIntervals with subtitles', () => {
  it('extracts exact speech intervals from subtitle cues overlapping the clip', async () => {
    const voiceClip = makeClip('voice_1', 10, 8); // spans [10, 18]
    const subtitles: SubtitleItem[] = [
      { id: 'sub_1', startTime: 11.0, endTime: 13.5, text: 'Hello world' },
      { id: 'sub_2', startTime: 14.5, endTime: 17.0, text: 'Welcome to ProCut' },
      { id: 'sub_3', startTime: 25.0, endTime: 28.0, text: 'Out of range' },
    ];

    const intervals = await scanClipVocalIntervals(voiceClip, undefined, subtitles);
    expect(intervals).toHaveLength(2);
    expect(intervals[0].start).toBeCloseTo(11.0);
    expect(intervals[0].end).toBeCloseTo(13.5);
    expect(intervals[1].start).toBeCloseTo(14.5);
    expect(intervals[1].end).toBeCloseTo(17.0);
  });
});

describe('applyAutoDuckingToTrack', () => {
  it('scans voice clips and applies volume keyframes across the target BGM track', async () => {
    const voiceClip = makeClip('voice', 5, 10);
    const bgmClip = makeClip('bgm', 0, 30);

    const voiceTrack: TimelineTrack = {
      id: 'track_voice',
      name: 'Voice Track',
      type: 'video',
      clips: [voiceClip],
    };

    const bgmTrack: TimelineTrack = {
      id: 'track_bgm',
      name: 'BGM Track',
      type: 'audio',
      clips: [bgmClip],
    };

    const subtitles: SubtitleItem[] = [
      { id: 's1', startTime: 6.0, endTime: 12.0, text: 'Active speech segment' },
    ];

    const result = await applyAutoDuckingToTrack(
      'track_bgm',
      [voiceTrack, bgmTrack],
      [],
      subtitles,
      { duckAmountDb: -18 }
    );

    expect(result.success).toBe(true);
    expect(result.duckedClipsCount).toBe(1);
    expect(result.keyframesByClipId['bgm']).toBeDefined();

    const bgmKeyframes = result.keyframesByClipId['bgm'];
    expect(bgmKeyframes.length).toBeGreaterThanOrEqual(4);

    // Check that duck volume was applied
    const duckedKf = bgmKeyframes.find((k) => k.value <= -17);
    expect(duckedKf).toBeDefined();
  });

  it('returns failure when target track does not exist or has no clips', async () => {
    const emptyTrack: TimelineTrack = {
      id: 'empty_track',
      name: 'Empty',
      type: 'audio',
      clips: [],
    };
    const result = await applyAutoDuckingToTrack('empty_track', [emptyTrack], []);
    expect(result.success).toBe(false);
    expect(result.duckedClipsCount).toBe(0);
  });

  it('correctly classifies vocal amplitude levels: High Max (50%), Mid (~25%), Low (~5%), and None (100%)', async () => {
    const { getBgmVolumeForAmplitude } = await import('./aiAudioDucking');

    // Vocal High Max -> 50%
    const high = getBgmVolumeForAmplitude(0.75);
    expect(high.level).toBe('high');
    expect(high.volume).toBeCloseTo(0.50);

    // Vocal Mid -> ~25%
    const mid = getBgmVolumeForAmplitude(0.35, { duckAmountDb: -12 });
    expect(mid.level).toBe('mid');
    expect(mid.volume).toBeCloseTo(0.25);

    // Vocal Low -> ~5%
    const low = getBgmVolumeForAmplitude(0.08);
    expect(low.level).toBe('low');
    expect(low.volume).toBeCloseTo(0.05);

    // Vocal None -> 100%
    const none = getBgmVolumeForAmplitude(0.005);
    expect(none.level).toBe('none');
    expect(none.volume).toBeCloseTo(1.0);
  });

  it('combines Track 1 and Track 2 vocal audio into a spectrum against Track 3 BGM', async () => {
    const { buildCombinedVocalSpectrum } = await import('./aiAudioDucking');

    // Track 1 has speech from 2s to 6s
    const clipTrack1 = makeClip('vocal_1', 2, 4);
    const mediaTrack1 = {
      id: 'media_vocal_1',
      name: 'Voice 1',
      type: 'audio' as const,
      duration: 4,
      waveformPeaks: [0.8, 0.8, 0.8, 0.8], // High vocal
    };

    // Track 2 has soft voice from 8s to 12s
    const clipTrack2 = makeClip('vocal_2', 8, 4);
    const mediaTrack2 = {
      id: 'media_vocal_2',
      name: 'Voice 2',
      type: 'audio' as const,
      duration: 4,
      waveformPeaks: [0.08, 0.08, 0.08, 0.08], // Low vocal
    };

    // Track 3 is BGM from 0s to 15s
    const bgmClip = makeClip('bgm', 0, 15);

    const tracks: TimelineTrack[] = [
      { id: 'track_1', name: 'Vocal 1', type: 'audio', clips: [clipTrack1] },
      { id: 'track_2', name: 'Vocal 2', type: 'audio', clips: [clipTrack2] },
      { id: 'track_3', name: 'BGM Track', type: 'audio', clips: [bgmClip] },
    ];

    const spectrum = await buildCombinedVocalSpectrum(tracks, [mediaTrack1, mediaTrack2], 'track_3');
    expect(spectrum.totalVocalDuration).toBeGreaterThan(0);
    expect(spectrum.vocalHighSeconds).toBeGreaterThan(0);
    expect(spectrum.vocalLowSeconds).toBeGreaterThan(0);
  });
});
