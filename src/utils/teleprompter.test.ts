import { describe, it, expect, vi } from 'vitest';
import {
  parseScriptToDialogueSentences,
  isWordMatch,
  levenshteinDistance,
  TeleprompterSpeechTracker,
} from './teleprompterSpeechTracker';
import { STUDIO_MIC_PRESETS } from './studioMicProcessor';
import { audioBufferToWav } from './dialogueSmoothing';
import { STUDIO_VIDEO_PRESETS, isIndianOrBrownSkin } from './studioVideoEnhancer';
import { UPSCALE_RESOLUTIONS } from './videoUpscaler';

describe('Teleprompter Speech Tracker', () => {
  it('parses multi-sentence scripts into structured dialogue sentences', () => {
    const script = `Welcome to our channel! In today's video, we are building something extraordinary. Let us get started right now.`;
    const sentences = parseScriptToDialogueSentences(script, 130);

    expect(sentences.length).toBe(3);
    expect(sentences[0].text).toBe('Welcome to our channel!');
    expect(sentences[0].words.length).toBe(4);
    expect(sentences[0].words[0].clean).toBe('welcome');
    expect(sentences[0].words[3].clean).toBe('channel');

    expect(sentences[1].text).toBe("In today's video, we are building something extraordinary.");
    expect(sentences[2].text).toBe('Let us get started right now.');
  });

  it('correctly handles speaker character prefixes in dialogues', () => {
    const script = `NARRATOR: The journey began in a small town.\nHERO: I will find the truth no matter what.`;
    const sentences = parseScriptToDialogueSentences(script, 130);

    expect(sentences.length).toBe(2);
    expect(sentences[0].character).toBe('NARRATOR');
    expect(sentences[0].text).toBe('The journey began in a small town.');
    expect(sentences[1].character).toBe('HERO');
    expect(sentences[1].text).toBe('I will find the truth no matter what.');
  });

  it('correctly matches spoken words with fuzzy tolerance', () => {
    // Exact
    expect(isWordMatch('welcome', 'welcome')).toBe(true);

    // Minor typo / edit distance
    expect(isWordMatch('channel', 'chanel', 1)).toBe(true);
    expect(isWordMatch('extraordinary', 'extraordinry', 1)).toBe(true);

    // Contractions
    expect(isWordMatch('dont', "don't")).toBe(true);
    expect(isWordMatch("i'm", 'im')).toBe(true);

    // Non-matches
    expect(isWordMatch('apple', 'banana')).toBe(false);
  });

  it('computes Levenshtein distance accurately', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('teleprompter', 'teleprompter')).toBe(0);
    expect(levenshteinDistance('word', 'world')).toBe(1);
  });

  it('advances through sentences manually via tracker', () => {
    const sentences = parseScriptToDialogueSentences('Sentence one. Sentence two. Sentence three.');
    const tracker = new TeleprompterSpeechTracker(sentences, { autoAdvance: true });

    let lastEvent: any = null;
    tracker.onEvent((e) => {
      lastEvent = e;
    });

    tracker.start();
    expect(tracker.getCurrentState().currentSentenceIdx).toBe(0);

    tracker.nextSentence();
    expect(tracker.getCurrentState().currentSentenceIdx).toBe(1);
    expect(sentences[0].isDelivered).toBe(true);

    tracker.nextSentence();
    expect(tracker.getCurrentState().currentSentenceIdx).toBe(2);

    tracker.prevSentence();
    expect(tracker.getCurrentState().currentSentenceIdx).toBe(1);

    tracker.stop();
  });

  it('strictly follows spoken speech in voice-follow mode without auto-pacing timer rushing', () => {
    const sentences = parseScriptToDialogueSentences('Hello world and welcome to our show.');
    const tracker = new TeleprompterSpeechTracker(sentences, {
      trackingMode: 'voice-follow',
      wpm: 130,
    });

    let wordAdvances: number[] = [];
    tracker.onEvent((e) => {
      if (e.type === 'word-advance') {
        wordAdvances.push(e.wordIndex);
      }
    });

    tracker.start();

    // Verify initial word is index 0
    expect(tracker.getCurrentState().currentWordIdx).toBe(0);

    // Simulate speech recognition transcript coming from user
    (tracker as any).processSpokenTranscript('hello world');

    // Words "hello" (0) and "world" (1) should advance, pointing to next word index 2
    expect(tracker.getCurrentState().currentWordIdx).toBe(2);

    // Simulate continuing speech: "and welcome" (words 2 and 3)
    (tracker as any).processSpokenTranscript('hello world and welcome');
    expect(tracker.getCurrentState().currentWordIdx).toBe(4);

    // Verify changing tracking mode to auto-pacer and back works dynamically
    tracker.setOptions({ trackingMode: 'auto-pacer' });
    expect((tracker as any).pacerTimer).not.toBeNull();

    tracker.setOptions({ trackingMode: 'voice-follow' });
    expect((tracker as any).pacerTimer).toBeNull();

    tracker.stop();
  });
});

describe('Studio Mic Presets', () => {
  it('defines valid studio mic presets with audio DSP parameters', () => {
    const presets = Object.keys(STUDIO_MIC_PRESETS);
    expect(presets).toContain('studio-podcast');
    expect(presets).toContain('natural-studio');
    expect(presets).toContain('broadcast-radio');
    expect(presets).toContain('warm-voiceover');
    expect(presets).toContain('crisp-clarity');
    expect(presets).toContain('bypass');

    const natural = STUDIO_MIC_PRESETS['natural-studio'];
    expect(natural.settings.enabled).toBe(true);
    expect(natural.settings.lowCutFreq).toBeLessThanOrEqual(70);
    expect(natural.settings.gateReductionDb).toBeGreaterThanOrEqual(-14); // Gentle floor prevents cutoffs
    expect(natural.settings.saturationAmount).toBe(0); // Clean, uncolored vocals

    const podcast = STUDIO_MIC_PRESETS['studio-podcast'];
    expect(podcast.settings.enabled).toBe(true);
    expect(podcast.settings.lowCutFreq).toBeGreaterThanOrEqual(70);
    expect(podcast.settings.warmthGain).toBeGreaterThan(0);
    expect(podcast.settings.clarityGain).toBeGreaterThan(0);
    expect(podcast.settings.mudCutGain).toBeLessThan(0);

    const bypass = STUDIO_MIC_PRESETS['bypass'];
    expect(bypass.settings.enabled).toBe(false);
  });

  it('converts an AudioBuffer into a valid WAV blob', () => {
    const mockChannelData = new Float32Array([0, 0.5, -0.5, 0.25]);
    const mockAudioBuffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 4,
      getChannelData: () => mockChannelData,
    } as unknown as AudioBuffer;

    const wavBlob = audioBufferToWav(mockAudioBuffer);
    expect(wavBlob).toBeDefined();
    expect(wavBlob.type).toBe('audio/wav');
    // Header (44 bytes) + 4 samples * 2 bytes = 52 bytes
    expect(wavBlob.size).toBe(52);
  });
});

describe('Studio Video Presets & Super Resolution Upscaling', () => {
  it('defines valid studio video presets with beautifier and denoise settings', () => {
    const presets = Object.keys(STUDIO_VIDEO_PRESETS);
    expect(presets).toContain('studio-broadcast');
    expect(presets).toContain('indian-radiance');
    expect(presets).toContain('beauty-glow');
    expect(presets).toContain('low-light-fix');
    expect(presets).toContain('crisp-detail');
    expect(presets).toContain('bypass');

    const broadcast = STUDIO_VIDEO_PRESETS['studio-broadcast'];
    expect(broadcast.settings.enabled).toBe(true);
    expect(broadcast.settings.skinSmoothing).toBeGreaterThan(0);
    expect(broadcast.settings.denoise).toBeGreaterThan(0);
    expect(broadcast.settings.studioLighting).toBeGreaterThan(0);

    const indian = STUDIO_VIDEO_PRESETS['indian-radiance'];
    expect(indian.settings.enabled).toBe(true);
    expect(indian.settings.skinSmoothing).toBeGreaterThanOrEqual(50);
    expect(indian.settings.skinRadiance).toBeGreaterThanOrEqual(40);
    expect(indian.settings.studioLighting).toBeGreaterThan(0);

    const beauty = STUDIO_VIDEO_PRESETS['beauty-glow'];
    expect(beauty.settings.skinSmoothing).toBeGreaterThanOrEqual(70);

    const bypass = STUDIO_VIDEO_PRESETS['bypass'];
    expect(bypass.settings.enabled).toBe(false);
  });

  it('accurately detects Indian and brown skin tones across melanin spectrum', () => {
    // Helper to calculate YCbCr from RGB
    const toYcbcr = (r: number, g: number, b: number) => {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
      const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
      return { y, cb, cr };
    };

    // 1. Wheatish Indian skin tone
    const wheatish = { r: 185, g: 138, b: 92 };
    const wYcbcr = toYcbcr(wheatish.r, wheatish.g, wheatish.b);
    expect(isIndianOrBrownSkin(wheatish.r, wheatish.g, wheatish.b, wYcbcr.y, wYcbcr.cb, wYcbcr.cr)).toBe(true);

    // 2. Dusky / Deep Bronze Indian skin tone
    const dusky = { r: 120, g: 82, b: 50 };
    const dYcbcr = toYcbcr(dusky.r, dusky.g, dusky.b);
    expect(isIndianOrBrownSkin(dusky.r, dusky.g, dusky.b, dYcbcr.y, dYcbcr.cb, dYcbcr.cr)).toBe(true);

    // 3. Non-skin green screen / chroma color
    const greenScreen = { r: 0, g: 255, b: 0 };
    const gYcbcr = toYcbcr(greenScreen.r, greenScreen.g, greenScreen.b);
    expect(isIndianOrBrownSkin(greenScreen.r, greenScreen.g, greenScreen.b, gYcbcr.y, gYcbcr.cb, gYcbcr.cr)).toBe(false);

    // 4. Pure Blue background
    const blue = { r: 20, g: 40, b: 220 };
    const bYcbcr = toYcbcr(blue.r, blue.g, blue.b);
    expect(isIndianOrBrownSkin(blue.r, blue.g, blue.b, bYcbcr.y, bYcbcr.cb, bYcbcr.cr)).toBe(false);
  });

  it('defines accurate 4K, 2K, and 1080p target upscale specifications within < 400 MB GPU guard', () => {
    expect(UPSCALE_RESOLUTIONS['4k'].width).toBe(3840);
    expect(UPSCALE_RESOLUTIONS['4k'].height).toBe(2160);
    expect(UPSCALE_RESOLUTIONS['4k'].badge).toBe('4K CINEMA');

    expect(UPSCALE_RESOLUTIONS['2k'].width).toBe(2560);
    expect(UPSCALE_RESOLUTIONS['2k'].height).toBe(1440);

    expect(UPSCALE_RESOLUTIONS['1080p'].width).toBe(1920);
    expect(UPSCALE_RESOLUTIONS['1080p'].height).toBe(1080);

    // Guarantee that all target resolutions stay strictly below 400 MB GPU VRAM
    // to safeguard Intel HD / Iris integrated graphics and low-spec systems
    Object.values(UPSCALE_RESOLUTIONS).forEach((spec) => {
      expect(spec.estimatedGpuVramMb).toBeLessThan(400);
      expect(spec.estimatedGpuVramMb).toBeGreaterThan(0);
    });
  });
});
