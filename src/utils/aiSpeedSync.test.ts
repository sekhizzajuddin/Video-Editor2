import { describe, it, expect, vi } from 'vitest';
import {
  buildSpeedFramesFromAnchors,
  buildAnchorsFromWordTimings,
  detectTtsExtraSentences,
  GEMINI_SPEED_SYNC_MODELS,
  runGeminiSpeedSync,
  SyncAnchor,
} from './aiSpeedSync';
import { TimelineClip } from '@/types';

describe('aiSpeedSync', () => {
  it('has the correct Gemini model fallback sequence per user specification', () => {
    expect(GEMINI_SPEED_SYNC_MODELS[0]).toBe('gemini-3.5-flash-lite');
    expect(GEMINI_SPEED_SYNC_MODELS[1]).toBe('gemini-3.5-flash-preview');
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

  describe('wrong-audio-clip validation', () => {
    it('rejects when ttsClip is unlinked original audio of the video clip', async () => {
      const { syncVideoClipWithTts } = await import('./aiSpeedSync');
      const { useEditorStore } = await import('@/store/editorStore');

      useEditorStore.setState({
        tracks: [
          {
            id: 't_video',
            name: 'Video',
            type: 'video',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'v1',
                mediaId: 'm_video',
                trackId: 't_video',
                startTime: 0,
                duration: 5,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
                linkedClipId: 'a1',
              },
            ],
          },
          {
            id: 't_audio',
            name: 'Audio',
            type: 'audio',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'a1',
                mediaId: 'm_audio_extracted',
                trackId: 't_audio',
                startTime: 0,
                duration: 5,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
                linkedClipId: 'v1',
              },
            ],
          },
        ] as any,
        mediaLibrary: [
          { id: 'm_video', name: 'vid.mp4', url: 'blob:vid', type: 'video' },
          { id: 'm_audio_extracted', name: 'extracted.wav', url: 'blob:aud', type: 'audio' },
        ] as any,
      });

      await expect(syncVideoClipWithTts('v1', 'a1')).rejects.toThrow(
        /unlinked original audio from this video clip/i
      );
    });

    it('allows separate TTS voiceover reading the same script when timings differ even if AI reports sameContent', async () => {
      const { syncVideoClipWithTts } = await import('./aiSpeedSync');
      const { useEditorStore } = await import('@/store/editorStore');

      const mockExtractAudio = vi.fn()
        .mockResolvedValueOnce({
          wavBlob: new Blob(['fake video audio'], { type: 'audio/wav' }),
          duration: 10,
          hasAudio: true,
          rmsEnergy: 0.05,
        })
        .mockResolvedValueOnce({
          wavBlob: new Blob(['fake tts audio'], { type: 'audio/wav' }),
          duration: 7, // Different duration!
          hasAudio: true,
          rmsEnergy: 0.05,
        });

      const mockRunGemini = vi.fn().mockResolvedValueOnce({
        successfulModel: 'gemini-3.5-flash-lite',
        summary: 'Synchronized with matching script',
        verdict: {
          ttsHasSpeech: true,
          videoHasSpeech: true,
          sameContent: true, // AI flagged true because words match!
          reason: 'Both recordings speak the same script',
        },
        videoWords: [
          { word: 'Welcome', time: 1.0 },
          { word: 'to', time: 2.0 },
          { word: 'tutorial', time: 3.5 },
        ],
        ttsWords: [
          { word: 'Welcome', time: 0.5 },
          { word: 'to', time: 1.2 },
          { word: 'tutorial', time: 2.2 },
        ],
        anchors: [
          { videoTime: 1.0, ttsTime: 0.5, phrase: 'Welcome', targetSpeed: 1.2 },
          { videoTime: 3.5, ttsTime: 2.2, phrase: 'tutorial', targetSpeed: 1.3 },
        ],
      });

      useEditorStore.setState({
        tracks: [
          {
            id: 't_video',
            name: 'Video',
            type: 'video',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'v10',
                mediaId: 'm_video10',
                trackId: 't_video',
                startTime: 0,
                duration: 10,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
              },
            ],
          },
          {
            id: 't_audio',
            name: 'Audio',
            type: 'audio',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'a10',
                mediaId: 'm_tts10',
                trackId: 't_audio',
                startTime: 0,
                duration: 7,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
              },
            ],
          },
        ] as any,
        mediaLibrary: [
          { id: 'm_video10', name: 'vid.mp4', url: 'blob:vid10', type: 'video' },
          { id: 'm_tts10', name: 'tts.wav', url: 'blob:tts10', type: 'audio' },
        ] as any,
      });

      const result = await syncVideoClipWithTts('v10', 'a10', {}, undefined, mockExtractAudio, mockRunGemini);
      expect(result).toBeDefined();
      expect(result.speedFrames.length).toBeGreaterThan(0);
      expect(result.newDuration).toBe(7);
    });

    it('rejects when sameContent is true AND duration and word timings are genuinely identical', async () => {
      const { syncVideoClipWithTts } = await import('./aiSpeedSync');
      const { useEditorStore } = await import('@/store/editorStore');

      const mockExtractAudio = vi.fn()
        .mockResolvedValueOnce({
          wavBlob: new Blob(['identical audio'], { type: 'audio/wav' }),
          duration: 5.0,
          hasAudio: true,
          rmsEnergy: 0.05,
        })
        .mockResolvedValueOnce({
          wavBlob: new Blob(['identical audio'], { type: 'audio/wav' }),
          duration: 5.0,
          hasAudio: true,
          rmsEnergy: 0.05,
        });

      const mockRunGemini = vi.fn().mockResolvedValueOnce({
        successfulModel: 'gemini-3.5-flash-lite',
        summary: 'Exact duplicate audio',
        verdict: {
          ttsHasSpeech: true,
          videoHasSpeech: true,
          sameContent: true,
          reason: 'Exact same audio track',
        },
        videoWords: [
          { word: 'Hello', time: 1.0 },
          { word: 'world', time: 2.0 },
        ],
        ttsWords: [
          { word: 'Hello', time: 1.0 },
          { word: 'world', time: 2.0 },
        ],
        anchors: [],
      });

      useEditorStore.setState({
        tracks: [
          {
            id: 't_video',
            name: 'Video',
            type: 'video',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'v20',
                mediaId: 'm_video20',
                trackId: 't_video',
                startTime: 0,
                duration: 5,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
              },
            ],
          },
          {
            id: 't_audio',
            name: 'Audio',
            type: 'audio',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'a20',
                mediaId: 'm_audio20',
                trackId: 't_audio',
                startTime: 0,
                duration: 5,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
              },
            ],
          },
        ] as any,
        mediaLibrary: [
          { id: 'm_video20', name: 'vid.mp4', url: 'blob:vid20', type: 'video' },
          { id: 'm_audio20', name: 'aud.wav', url: 'blob:aud20', type: 'audio' },
        ] as any,
      });

      await expect(syncVideoClipWithTts('v20', 'a20', {}, undefined, mockExtractAudio, mockRunGemini)).rejects.toThrow(
        /original clip's own audio, not a separate TTS voiceover/i
      );
    });

    it('splits TTS clip at matching point and applies speed frames when TTS has more sentences than video clip', async () => {
      const { syncVideoClipWithTts } = await import('./aiSpeedSync');
      const { useEditorStore } = await import('@/store/editorStore');

      const mockExtractAudio = vi.fn()
        .mockResolvedValueOnce({
          wavBlob: new Blob(['video wav'], { type: 'audio/wav' }),
          duration: 3.0,
          hasAudio: true,
          rmsEnergy: 0.05,
        })
        .mockResolvedValueOnce({
          wavBlob: new Blob(['tts wav'], { type: 'audio/wav' }),
          duration: 8.0,
          hasAudio: true,
          rmsEnergy: 0.05,
        });

      const mockRunGemini = vi.fn().mockResolvedValueOnce({
        successfulModel: 'gemini-3.5-flash-lite',
        summary: 'TTS has extra sentences; matched first sentence.',
        verdict: {
          ttsHasSpeech: true,
          videoHasSpeech: true,
          sameContent: false,
          reason: 'TTS has additional sentences',
        },
        videoWords: [
          { word: 'Welcome', time: 0.5 },
          { word: 'to', time: 1.0 },
          { word: 'our', time: 1.5 },
          { word: 'channel', time: 2.2 },
        ],
        ttsWords: [
          { word: 'Welcome', time: 0.4 },
          { word: 'to', time: 0.9 },
          { word: 'our', time: 1.4 },
          { word: 'channel.', time: 2.0 },
          { word: 'Please', time: 3.5 },
          { word: 'subscribe', time: 4.2 },
          { word: 'for', time: 5.0 },
          { word: 'more', time: 5.6 },
          { word: 'content.', time: 6.5 },
        ],
        videoSentences: [
          { text: 'Welcome to our channel', startTime: 0.5, endTime: 2.5 },
        ],
        ttsSentences: [
          { text: 'Welcome to our channel.', startTime: 0.4, endTime: 2.2 },
          { text: 'Please subscribe for more content.', startTime: 3.4, endTime: 6.8 },
        ],
        ttsHasMoreSentences: true,
        matchingCutoffTtsTime: 2.8,
        anchors: [
          { videoTime: 0.5, ttsTime: 0.4, phrase: 'Welcome', targetSpeed: 1.0 },
          { videoTime: 2.2, ttsTime: 2.0, phrase: 'channel', targetSpeed: 1.1 },
        ],
      });

      useEditorStore.setState({
        tracks: [
          {
            id: 't_video',
            name: 'Video',
            type: 'video',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'v_split_test',
                mediaId: 'm_vid_s',
                trackId: 't_video',
                startTime: 0,
                duration: 3.0,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
              },
            ],
          },
          {
            id: 't_audio',
            name: 'Audio',
            type: 'audio',
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'a_split_test',
                mediaId: 'm_tts_s',
                trackId: 't_audio',
                startTime: 0,
                duration: 8.0,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                opacity: 1,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                effects: [],
              },
            ],
          },
        ] as any,
        mediaLibrary: [
          { id: 'm_vid_s', name: 'vid.mp4', url: 'blob:vid_s', type: 'video' },
          { id: 'm_tts_s', name: 'tts.wav', url: 'blob:tts_s', type: 'audio' },
        ] as any,
      });

      const result = await syncVideoClipWithTts(
        'v_split_test',
        'a_split_test',
        { alignStartTime: true },
        undefined,
        mockExtractAudio,
        mockRunGemini
      );

      // Verify split result flags
      expect(result.ttsSplitApplied).toBe(true);
      expect(result.ttsSplitPoint).toBe(2.8);
      expect(result.newDuration).toBe(2.8);
      expect(result.speedFrames.length).toBeGreaterThan(0);

      const state = useEditorStore.getState();
      const audioTrack = state.tracks.find((t) => t.id === 't_audio');
      expect(audioTrack?.clips.length).toBe(2);

      // First TTS clip (matching dialogue) spans [0, 2.8]
      const leftTts = audioTrack?.clips.find((c) => Math.abs(c.startTime - 0) < 0.01);
      expect(leftTts).toBeDefined();
      expect(Number(leftTts?.duration.toFixed(2))).toBe(2.8);

      // Second TTS clip (remaining sentence) spans [2.8, 8.0]
      const rightTts = audioTrack?.clips.find((c) => Math.abs(c.startTime - 2.8) < 0.01);
      expect(rightTts).toBeDefined();
      expect(Number(rightTts?.duration.toFixed(2))).toBe(5.2);

      // Video clip duration is set to matching TTS duration (2.8s, NOT the full 8.0s)
      const videoTrack = state.tracks.find((t) => t.id === 't_video');
      const videoClip = videoTrack?.clips.find((c) => c.id === 'v_split_test');
      expect(videoClip).toBeDefined();
      expect(Number(videoClip?.duration.toFixed(2))).toBe(2.8);
      expect(videoClip?.speedFrames?.length).toBeGreaterThan(0);
    });
  });

  describe('detectTtsExtraSentences', () => {
    it('detects extra sentences when ttsSentences has more sentences than videoSentences', () => {
      const detection = detectTtsExtraSentences({
        videoDuration: 2.5,
        ttsDuration: 6.0,
        videoSentences: [
          { text: 'First sentence.', startTime: 0.5, endTime: 2.2 },
        ],
        ttsSentences: [
          { text: 'First sentence.', startTime: 0.4, endTime: 2.0 },
          { text: 'Second sentence is longer.', startTime: 2.6, endTime: 5.8 },
        ],
      });

      expect(detection.hasMoreSentences).toBe(true);
      expect(detection.matchingCutoffTime).toBe(2.3);
      expect(detection.matchingSentenceCount).toBe(1);
      expect(detection.totalTtsSentences).toBe(2);
    });

    it('returns hasMoreSentences: false when sentences count are equal', () => {
      const detection = detectTtsExtraSentences({
        videoDuration: 3.0,
        ttsDuration: 3.2,
        videoSentences: [
          { text: 'Only one sentence.', startTime: 0.5, endTime: 2.8 },
        ],
        ttsSentences: [
          { text: 'Only one sentence.', startTime: 0.4, endTime: 3.0 },
        ],
      });

      expect(detection.hasMoreSentences).toBe(false);
      expect(detection.matchingCutoffTime).toBe(0);
    });

    it('detects extra sentences via word timings and punctuation when sentences list is omitted', () => {
      const detection = detectTtsExtraSentences({
        videoDuration: 3.0,
        ttsDuration: 7.5,
        videoWords: [
          { word: 'Hello', time: 0.5 },
          { word: 'and', time: 1.0 },
          { word: 'welcome.', time: 2.0 },
        ],
        ttsWords: [
          { word: 'Hello', time: 0.4 },
          { word: 'and', time: 0.9 },
          { word: 'welcome.', time: 1.8 },
          { word: 'Today', time: 3.0 },
          { word: 'we', time: 3.8 },
          { word: 'learn', time: 4.5 },
          { word: 'editing.', time: 5.5 },
        ],
      });

      expect(detection.hasMoreSentences).toBe(true);
      expect(detection.matchingCutoffTime).toBeGreaterThan(1.8);
      expect(detection.matchingCutoffTime).toBeLessThan(3.0);
    });
  });
});
