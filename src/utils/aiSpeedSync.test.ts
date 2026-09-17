import { describe, it, expect, vi } from 'vitest';
import {
  buildSpeedFramesFromAnchors,
  buildAnchorsFromWordTimings,
  GEMINI_SPEED_SYNC_MODELS,
  runGeminiSpeedSync,
  SyncAnchor,
} from './aiSpeedSync';
import { TimelineClip } from '@/types';

describe('aiSpeedSync', () => {
  it('has the correct Gemini model fallback sequence per user specification', () => {
    expect(GEMINI_SPEED_SYNC_MODELS[0]).toBe('gemini-3.5-flash-preview');
    expect(GEMINI_SPEED_SYNC_MODELS[1]).toBe('gemini-3.5-flash-lite');
    expect(GEMINI_SPEED_SYNC_MODELS[2]).toBe('gemini-3.1-flash-lite');
    expect(GEMINI_SPEED_SYNC_MODELS[3]).toBe('gemini-3.8-flash');
    expect(GEMINI_SPEED_SYNC_MODELS[4]).toBe('gemini-2.5-flash');
  });

  it('builds valid, chronologically sorted speedFrames from sync anchors', () => {
    const videoClip: TimelineClip = {
      id: 'v1',
      mediaId: 'm_video',
      trackId: 't_video',
      startTime: 0,
      duration: 10,
      trimStart: 2,
      trimEnd: 0,
      speed: 1.0,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      effects: [],
    };

    const ttsClip: TimelineClip = {
      id: 'a1',
      mediaId: 'm_tts',
      trackId: 't_audio',
      startTime: 0,
      duration: 12,
      trimStart: 0,
      trimEnd: 0,
      speed: 1.0,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      effects: [],
    };

    const anchors: SyncAnchor[] = [
      { videoTime: 1.5, ttsTime: 2.0, phrase: 'Hello' },
      { videoTime: 4.0, ttsTime: 5.5, phrase: 'Welcome to this video' },
      { videoTime: 7.5, ttsTime: 9.0, phrase: 'Final words' },
    ];

    const result = buildSpeedFramesFromAnchors(videoClip, ttsClip, anchors, 20);

    expect(result.newDuration).toBe(12);
    expect(result.speedFrames.length).toBe(3);

    // Verify timeline offsets are in increasing order
    for (let i = 0; i < result.speedFrames.length - 1; i++) {
      expect(result.speedFrames[i].timelineOffset).toBeLessThan(result.speedFrames[i + 1].timelineOffset);
      expect(result.speedFrames[i].sourceTime).toBeLessThan(result.speedFrames[i + 1].sourceTime);
    }

    // Verify speed segments are calculated and all speeds are finite
    expect(result.segments.length).toBe(4);
    for (const seg of result.segments) {
      expect(Number.isFinite(seg.speed)).toBe(true);
      expect(seg.speed).toBeGreaterThan(0);
    }
  });

  it('filters out non-chronological or out-of-bounds anchors safely', () => {
    const videoClip: TimelineClip = {
      id: 'v1',
      mediaId: 'm_video',
      trackId: 't_video',
      startTime: 0,
      duration: 6,
      trimStart: 0,
      trimEnd: 0,
      speed: 1.0,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      effects: [],
    };

    const ttsClip: TimelineClip = {
      id: 'a1',
      mediaId: 'm_tts',
      trackId: 't_audio',
      startTime: 0,
      duration: 8,
      trimStart: 0,
      trimEnd: 0,
      speed: 1.0,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      effects: [],
    };

    const messyAnchors: SyncAnchor[] = [
      { videoTime: 2.0, ttsTime: 2.5, phrase: 'Valid 1' },
      { videoTime: 1.0, ttsTime: 3.0, phrase: 'Invalid backwards video' },
      { videoTime: 4.0, ttsTime: 1.5, phrase: 'Invalid backwards TTS' },
      { videoTime: 5.0, ttsTime: 6.0, phrase: 'Valid 2' },
    ];

    const result = buildSpeedFramesFromAnchors(videoClip, ttsClip, messyAnchors, 10);
    expect(result.speedFrames.length).toBe(2);
    expect(result.speedFrames[0].timelineOffset).toBe(2.5);
    expect(result.speedFrames[1].timelineOffset).toBe(6.0);
  });

  it('falls back to next Gemini model when first model fails', async () => {
    const originalFetch = global.fetch;

    // Mock fetch: fail gemini-3.5-flash-preview with 404, succeed on gemini-3.1-flash-lite
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('gemini-3.5-flash-preview') || url.includes('gemini-3.5-flash-lite')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Model not found'),
        });
      }
      if (url.includes('gemini-3.1-flash-lite')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          summary: 'Matched pacing',
                          anchors: [
                            { videoTime: 1.0, ttsTime: 1.5, phrase: 'Speech' },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });

    // Mock API key getter
    vi.mock('./aiClient', () => ({
      getGeminiKey: () => 'test-key-mock',
    }));

    const dummyBlob = new Blob(['fake audio content'], { type: 'audio/wav' });

    try {
      const result = await runGeminiSpeedSync(dummyBlob, dummyBlob, 5, 6);
      expect(result.successfulModel).toBe('gemini-3.1-flash-lite');
      expect(result.anchors.length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('parses word timings and verdict from a word-level response', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        verdict: { ttsHasSpeech: true, videoHasSpeech: true, sameContent: false, reason: 'separate voiceover' },
                        videoWords: [{ word: 'Hello', time: 0.5 }, { word: 'world', time: 1.2 }],
                        ttsWords: [{ word: 'Hello', time: 0.8 }, { word: 'world', time: 2.0 }],
                        summary: 'Matched',
                        anchors: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      })
    );

    vi.mock('./aiClient', () => ({
      getGeminiKey: () => 'test-key-mock',
    }));

    const dummyBlob = new Blob(['fake audio content'], { type: 'audio/wav' });

    try {
      const result = await runGeminiSpeedSync(dummyBlob, dummyBlob, 5, 6);
      expect(result.verdict?.ttsHasSpeech).toBe(true);
      expect(result.verdict?.sameContent).toBe(false);
      expect(result.videoWords?.length).toBe(2);
      expect(result.ttsWords?.length).toBe(2);
      // anchors-only fallback kicks in when no matched word pairs exist
      expect(result.anchors.length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  describe('buildAnchorsFromWordTimings', () => {
    const videoWords = [
      { word: 'Hello', time: 0.5 },
      { word: 'welcome', time: 2.0 },
      { word: 'to', time: 2.4 },
      { word: 'the', time: 2.7 },
      { word: 'video', time: 3.0 },
    ];
    const ttsWords = [
      { word: 'Hello', time: 0.8 },
      { word: 'welcome', time: 2.5 },
      { word: 'to', time: 3.2 },
      { word: 'the', time: 3.8 },
      { word: 'video', time: 4.4 },
    ];

    it('matches equal wording 1:1 into chronological anchors', () => {
      // TTS ends right after the last matched word (no trailing speech → no
      // hold anchor; the clip-end boundary covers the tail).
      const anchors = buildAnchorsFromWordTimings(videoWords, ttsWords, 6, 4.5);
      expect(anchors.length).toBe(5);
      expect(anchors.every((a) => a.matched)).toBe(true);
      for (let i = 0; i < anchors.length - 1; i++) {
        expect(anchors[i].videoTime).toBeLessThan(anchors[i + 1].videoTime);
        expect(anchors[i].ttsTime).toBeLessThan(anchors[i + 1].ttsTime);
      }
      expect(anchors[0].videoTime).toBe(0.5);
      expect(anchors[0].ttsTime).toBe(0.8);
    });

    it('handles TTS extra words with a trailing hold anchor (TTS wording fuller than video)', () => {
      // TTS keeps speaking after the video's last matched word
      const fullerTts = [
        ...ttsWords,
        { word: 'subscribe', time: 6.0 },
        { word: 'now', time: 6.8 },
      ];
      const anchors = buildAnchorsFromWordTimings(videoWords, fullerTts, 4.5, 8);
      // 5 matched + 1 trailing hold
      expect(anchors.length).toBe(6);
      const last = anchors[anchors.length - 1];
      expect(last.stretch).toBe(true);
      // Hold keeps the video near its last matched position (slow creep only)
      expect(last.videoTime).toBeLessThan(4.5);
      expect(last.videoTime).toBeGreaterThanOrEqual(3.0);
      // Hold anchor covers the trailing TTS duration
      expect(last.ttsTime).toBeCloseTo(7.95, 1);
    });

    it('skips unmatched TTS words between matches (extra filler covered by stretch)', () => {
      const ttsWithFiller = [
        { word: 'Hello', time: 0.8 },
        { word: 'ummm', time: 1.5 },   // filler — no video counterpart
        { word: 'welcome', time: 2.5 },
        { word: 'to', time: 3.2 },
        { word: 'the', time: 3.8 },
        { word: 'video', time: 4.4 },
      ];
      const anchors = buildAnchorsFromWordTimings(videoWords, ttsWithFiller, 6, 8);
      const matched = anchors.filter((a) => a.matched);
      expect(matched.length).toBe(5);
      // No anchor exists for the filler word
      expect(anchors.some((a) => a.phrase === 'ummm')).toBe(false);
    });

    it('handles video extra words (video speaks more, consumed faster)', () => {
      const longerVideo = [
        ...videoWords,
        { word: 'extra', time: 4.5 },
        { word: 'content', time: 5.0 },
      ];
      const anchors = buildAnchorsFromWordTimings(longerVideo, ttsWords, 7, 8);
      const matched = anchors.filter((a) => a.matched);
      // Only the 5 TTS words match; extra video words are consumed faster
      expect(matched.length).toBe(5);
    });

    it('returns empty array when no words match at all', () => {
      const unrelatedVideo = [{ word: 'completely', time: 0.5 }, { word: 'different', time: 1.5 }];
      const anchors = buildAnchorsFromWordTimings(unrelatedVideo, ttsWords, 6, 8);
      expect(anchors.length).toBe(0);
    });
  });

  it('clamps extreme fallback targetSpeed to a sane range', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: 'Extreme ratio',
                        anchors: [{ videoTime: 1.0, ttsTime: 4.0, phrase: 'x', targetSpeed: 99 }],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      })
    );

    vi.mock('./aiClient', () => ({
      getGeminiKey: () => 'test-key-mock',
    }));

    const dummyBlob = new Blob(['fake audio content'], { type: 'audio/wav' });

    try {
      const result = await runGeminiSpeedSync(dummyBlob, dummyBlob, 5, 6);
      expect(result.anchors[0].targetSpeed).toBeLessThanOrEqual(4);
      expect(result.anchors[0].targetSpeed).toBeGreaterThanOrEqual(0.25);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
