import { describe, it, expect } from 'vitest';
import {
  classifyClipMediaType,
  isTabSupportedForClipType,
  getDefaultTabForClipType,
  formatClipSubtitle,
} from './propertiesMediaHelpers';

describe('Properties Media Relevance & Tab Filtering', () => {
  describe('Audio Clips', () => {
    const audioTrack = { id: 'track-a1', type: 'audio' };
    const audioClip = {
      id: 'clip-audio-1',
      mediaId: '848374__audiocoffee__smooth-song.mp3',
      startTime: 0,
      duration: 54,
      name: 'smooth-and-cozy-r-b-lofi-song.mp3',
    };
    const audioMediaItem = {
      id: '848374__audiocoffee__smooth-song.mp3',
      name: 'smooth-and-cozy-r-b-lofi-song.mp3',
      type: 'audio',
      url: 'blob:http://localhost/audio.mp3',
      duration: 54,
    };

    it('correctly classifies as audio clip', () => {
      const result = classifyClipMediaType({
        rawSelectedClip: audioClip,
        selectedTrack: audioTrack,
        selectedMediaItem: audioMediaItem,
      });
      expect(result.isAudioClip).toBe(true);
      expect(result.isVideoClip).toBe(false);
      expect(result.isImageClip).toBe(false);
      expect(result.isTextClip).toBe(false);
    });

    it('defaults to Audio tab for audio clip', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: audioClip,
        selectedTrack: audioTrack,
        selectedMediaItem: audioMediaItem,
      });
      const defaultTab = getDefaultTabForClipType(mediaType, {
        rawSelectedClip: audioClip,
        selectedTrack: audioTrack,
        selectedMediaItem: audioMediaItem,
      });
      expect(defaultTab).toBe('audio');
    });

    it('only supports Audio, Speed, and Effects (AI) tabs for audio clip', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: audioClip,
        selectedTrack: audioTrack,
        selectedMediaItem: audioMediaItem,
      });
      const input = {
        rawSelectedClip: audioClip,
        selectedTrack: audioTrack,
        selectedMediaItem: audioMediaItem,
      };

      expect(isTabSupportedForClipType('audio', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('speed', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('effects', mediaType, input)).toBe(true);

      // Visual tabs must be strictly rejected
      expect(isTabSupportedForClipType('transform', mediaType, input)).toBe(false);
      expect(isTabSupportedForClipType('mask', mediaType, input)).toBe(false);
      expect(isTabSupportedForClipType('color', mediaType, input)).toBe(false);
      expect(isTabSupportedForClipType('thumbnail', mediaType, input)).toBe(false);
      expect(isTabSupportedForClipType('pip', mediaType, input)).toBe(false);
    });

    it('formats audio subtitle as Audio Track with duration (no 1080p/16:9)', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: audioClip,
        selectedTrack: audioTrack,
        selectedMediaItem: audioMediaItem,
      });
      const subtitle = formatClipSubtitle(audioClip, mediaType, audioMediaItem, 54);
      expect(subtitle).toBe('Audio Track · 0:54');
      expect(subtitle).not.toContain('1080p');
      expect(subtitle).not.toContain('16:9');
    });
  });

  describe('Video Clips', () => {
    const videoTrack = { id: 'track-v1', type: 'video' };
    const videoClip = {
      id: 'clip-video-1',
      mediaId: 'media-v1',
      startTime: 0,
      duration: 10,
      name: 'sample.mp4',
    };
    const videoMediaItem = {
      id: 'media-v1',
      name: 'sample.mp4',
      type: 'video',
      url: 'blob:http://localhost/video.mp4',
      width: 1920,
      height: 1080,
      duration: 10,
    };

    it('correctly classifies as video clip', () => {
      const result = classifyClipMediaType({
        rawSelectedClip: videoClip,
        selectedTrack: videoTrack,
        selectedMediaItem: videoMediaItem,
      });
      expect(result.isVideoClip).toBe(true);
      expect(result.isAudioClip).toBe(false);
    });

    it('defaults to transform tab and supports all visual & audio tabs', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: videoClip,
        selectedTrack: videoTrack,
        selectedMediaItem: videoMediaItem,
      });
      const input = {
        rawSelectedClip: videoClip,
        selectedTrack: videoTrack,
        selectedMediaItem: videoMediaItem,
      };

      expect(getDefaultTabForClipType(mediaType, input)).toBe('transform');
      expect(isTabSupportedForClipType('transform', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('mask', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('color', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('speed', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('audio', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('effects', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('thumbnail', mediaType, input)).toBe(true);
    });

    it('formats video subtitle with resolution, aspect ratio, and duration', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: videoClip,
        selectedTrack: videoTrack,
        selectedMediaItem: videoMediaItem,
      });
      const subtitle = formatClipSubtitle(videoClip, mediaType, videoMediaItem, 10);
      expect(subtitle).toBe('1080p · 16:9 · 0:10');
    });
  });

  describe('Image Clips', () => {
    const videoTrack = { id: 'track-v1', type: 'video' };
    const imageClip = {
      id: 'clip-img-1',
      mediaId: 'media-img-1',
      startTime: 0,
      duration: 5,
      name: 'photo.jpg',
    };
    const imageMediaItem = {
      id: 'media-img-1',
      name: 'photo.jpg',
      type: 'image',
      url: 'blob:http://localhost/photo.jpg',
      width: 1080,
      height: 1080,
      duration: 5,
    };

    it('classifies as image and rejects audio tab', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: imageClip,
        selectedTrack: videoTrack,
        selectedMediaItem: imageMediaItem,
      });
      expect(mediaType.isImageClip).toBe(true);
      expect(mediaType.isAudioClip).toBe(false);

      const input = {
        rawSelectedClip: imageClip,
        selectedTrack: videoTrack,
        selectedMediaItem: imageMediaItem,
      };
      expect(isTabSupportedForClipType('transform', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('mask', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('color', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('audio', mediaType, input)).toBe(false);
    });
  });

  describe('Text Clips', () => {
    const textTrack = { id: 'track-t1', type: 'text' };
    const textClip = {
      id: 'clip-txt-1',
      mediaId: 'text-placeholder',
      startTime: 0,
      duration: 4,
      name: 'Title Text',
      textSettings: { text: 'Hello World' },
    };

    it('classifies as text clip and defaults to text tab', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: textClip,
        selectedTrack: textTrack,
        selectedMediaItem: null,
      });
      expect(mediaType.isTextClip).toBe(true);

      const input = {
        rawSelectedClip: textClip,
        selectedTrack: textTrack,
        selectedMediaItem: null,
      };
      expect(getDefaultTabForClipType(mediaType, input)).toBe('text');
      expect(isTabSupportedForClipType('text', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('mask', mediaType, input)).toBe(false);
      expect(isTabSupportedForClipType('audio', mediaType, input)).toBe(false);
    });

    it('formats subtitle as Text Layer', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: textClip,
        selectedTrack: textTrack,
        selectedMediaItem: null,
      });
      const subtitle = formatClipSubtitle(textClip, mediaType, null, 4);
      expect(subtitle).toBe('Text Layer · 0:04');
    });
  });

  describe('No Clip Selected', () => {
    it('returns inactive controls subtitle', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: null,
        selectedTrack: null,
        selectedMediaItem: null,
      });
      const subtitle = formatClipSubtitle(null, mediaType, null, 0);
      expect(subtitle).toBe('Controls Inactive');
    });

    it('allows standard tabs so user can browse inactive panels', () => {
      const mediaType = classifyClipMediaType({
        rawSelectedClip: null,
        selectedTrack: null,
        selectedMediaItem: null,
      });
      const input = {
        rawSelectedClip: null,
        selectedTrack: null,
        selectedMediaItem: null,
      };
      expect(isTabSupportedForClipType('transform', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('audio', mediaType, input)).toBe(true);
      expect(isTabSupportedForClipType('color', mediaType, input)).toBe(true);
    });
  });
});
