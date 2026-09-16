import { describe, it, expect, vi } from 'vitest';
import {
  buildSpeedFramesFromAnchors,
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
});
