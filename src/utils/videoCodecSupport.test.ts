import { describe, it, expect } from 'vitest';
import {
  assessProbedVideo,
  codecLabel,
  shortCodecWarning,
  undecodableExportMessage,
  undecodableVideoMessage,
} from './videoCodecSupport';

describe('codecLabel', () => {
  it('maps mediabunny codec ids to display names', () => {
    expect(codecLabel('hevc')).toBe('HEVC/H.265');
    expect(codecLabel('avc')).toBe('H.264/AVC');
    expect(codecLabel('vp9')).toBe('VP9');
    expect(codecLabel('av1')).toBe('AV1');
  });

  it('is case and whitespace insensitive', () => {
    expect(codecLabel('  HEVC ')).toBe('HEVC/H.265');
    expect(codecLabel('H264')).toBe('H.264/AVC');
  });

  it('returns null for missing codecs and upper-cases unknown ones', () => {
    expect(codecLabel(null)).toBeNull();
    expect(codecLabel(undefined)).toBeNull();
    expect(codecLabel('')).toBeNull();
    expect(codecLabel('theora2')).toBe('THEORA2');
  });
});

describe('undecodableVideoMessage', () => {
  it('names the codec and offers the HEVC escape hatch', () => {
    const msg = undecodableVideoMessage('hevc');
    expect(msg).toContain('HEVC/H.265 video');
    expect(msg).toContain('black in the preview');
    expect(msg).toContain('missing from exports');
    expect(msg).toContain('Safari');
  });

  it('only suggests re-encoding for codecs with no browser escape hatch', () => {
    const msg = undecodableVideoMessage('vp9');
    expect(msg).toContain('VP9 video');
    expect(msg).toContain('Convert it to H.264/MP4');
    expect(msg).not.toContain('Safari');
  });

  it('still produces actionable guidance when the codec is unknown', () => {
    const msg = undecodableVideoMessage(null);
    expect(msg).toContain('This video');
    expect(msg).toContain('Convert it to H.264/MP4');
  });
});

describe('shortCodecWarning', () => {
  it('summarises the codec for a badge', () => {
    expect(shortCodecWarning('hevc')).toBe('HEVC/H.265 not supported');
    expect(shortCodecWarning(null)).toBe('Codec not supported');
  });
});

describe('assessProbedVideo', () => {
  it('accepts any video whose metadata reported real dimensions', () => {
    for (const info of [
      { width: 640, height: 360, codec: 'avc' },
      { width: 3840, height: 2160, codec: 'hevc' },
      { width: 1920, height: 1080 },
    ]) {
      const verdict = assessProbedVideo(info);
      expect(verdict.supported, JSON.stringify(info)).toBe(true);
      expect(verdict.issue).toBeUndefined();
    }
  });

  it('flags 0x0 media as undecodable and names the codec', () => {
    const verdict = assessProbedVideo({ width: 0, height: 0, codec: 'hevc' });
    expect(verdict.supported).toBe(false);
    expect(verdict.issue).toContain('HEVC/H.265');
    // The UI labels its badge from this, so it must survive the verdict.
    expect(verdict.codec).toBe('hevc');
    expect(shortCodecWarning(verdict.codec)).toBe('HEVC/H.265 not supported');
  });

  it('reports no codec for track-less files', () => {
    expect(assessProbedVideo({ width: 0, height: 0, hasVideoTrack: false }).codec).toBeNull();
  });

  it('treats a missing dimension the same as 0x0', () => {
    expect(assessProbedVideo({}).supported).toBe(false);
    expect(assessProbedVideo({ width: 640 }).supported).toBe(false);
    expect(assessProbedVideo({ width: null, height: null }).supported).toBe(false);
  });

  it('reports "no video track" instead of a codec problem for audio-only files', () => {
    const verdict = assessProbedVideo({ width: 0, height: 0, codec: null, hasVideoTrack: false });
    expect(verdict.supported).toBe(false);
    expect(verdict.issue).toContain('no video track');
    expect(verdict.issue).not.toContain('codec');
  });

  it('never reports success for a track-less file even if dimensions leak through', () => {
    // Defensive: a stale/incorrect size must not hide a missing track.
    const verdict = assessProbedVideo({ width: 0, height: 0, hasVideoTrack: false });
    expect(verdict.supported).toBe(false);
  });
});

describe('undecodableExportMessage', () => {
  it('names the codec in the WebCodecs failure', () => {
    expect(undecodableExportMessage('hevc')).toBe('Codec not supported by browser WebCodecs (HEVC/H.265)');
  });

  it('stays generic for unknown codecs', () => {
    expect(undecodableExportMessage(null)).toBe('Codec not supported by browser WebCodecs');
  });
});
