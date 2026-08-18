import { describe, expect, it } from 'vitest';
import { h264CodecCandidates, recommendedVideoBitrate } from './quality';

describe('export quality helpers', () => {
  it('uses compact YouTube-friendly rates and preserves quality ordering', () => {
    const low = recommendedVideoBitrate(1920, 1080, 30, 'low');
    const high = recommendedVideoBitrate(1920, 1080, 30, 'high');
    const ultra = recommendedVideoBitrate(1920, 1080, 30, 'ultra');
    expect(low).toBeLessThan(high);
    expect(high).toBe(8_000_000);
    expect(ultra).toBeGreaterThan(high);
  });

  it('raises bitrate for 60fps and 4K rather than scaling file size blindly', () => {
    expect(recommendedVideoBitrate(1920, 1080, 60, 'high')).toBeGreaterThan(
      recommendedVideoBitrate(1920, 1080, 30, 'high'),
    );
    expect(recommendedVideoBitrate(3840, 2160, 30, 'high')).toBe(35_000_000);
  });

  it('uses an AVC level that can actually carry the requested dimensions', () => {
    expect(h264CodecCandidates(1280, 720, 30)[0]).toBe('avc1.64001f');
    expect(h264CodecCandidates(1920, 1080, 60)[0]).toBe('avc1.64002a');
    expect(h264CodecCandidates(3840, 2160, 60)[0]).toBe('avc1.640034');
  });
});
