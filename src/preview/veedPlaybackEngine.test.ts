import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  veedAbortableSeek,
  veedSyncSecondaryTrack,
  veedSwapOrSeekReadyElement,
  veedEngine,
  VEED_CONSTANTS,
  getOrCreateSecondarySyncState,
} from './veedPlaybackEngine';

describe('veedPlaybackEngine', () => {
  describe('veedAbortableSeek', () => {
    it('sets currentTime directly when element is not seeking', () => {
      const mockEl = { seeking: false, currentTime: 0 } as any;
      veedAbortableSeek(mockEl, 5.5);
      expect(mockEl.currentTime).toBe(5.5);
    });

    it('handles seeking elements without crashing', () => {
      const mockEl = {
        seeking: true,
        currentTime: 0,
        addEventListener: vi.fn(),
      } as any;
      veedAbortableSeek(mockEl, 3.2);
      expect(mockEl.addEventListener).toHaveBeenCalled();
    });
  });

  describe('veedSyncSecondaryTrack (Ir algorithm)', () => {
    let mockEl: any;

    beforeEach(() => {
      mockEl = {
        readyState: 4, // HAVE_ENOUGH_DATA
        currentTime: 2.0,
        playbackRate: 1.0,
        seeking: false,
      };
    });

    it('does NOT seek when drift is within 50ms deadband (VEED smooth rule)', () => {
      // 20ms drift: within 50ms deadband
      veedSyncSecondaryTrack(mockEl, 2.02, 'test_clip_1', 1.0);
      expect(mockEl.currentTime).toBe(2.0); // Never seeked!
      expect(mockEl.playbackRate).toBe(1.0);
    });

    it('modulates playbackRate by ±0.1 when drift is between 50ms and 300ms (soft PLL)', () => {
      // 100ms drift: between 50ms and 300ms
      veedSyncSecondaryTrack(mockEl, 2.10, 'test_clip_2', 1.0);
      expect(mockEl.currentTime).toBe(2.0); // Never seeked!
      expect(mockEl.playbackRate).toBeCloseTo(1.10, 2); // Nudged by +0.1
    });

    it('triggers seek when drift exceeds 300ms', () => {
      // 500ms drift: exceeds 300ms threshold
      veedSyncSecondaryTrack(mockEl, 2.50, 'test_clip_3', 1.0);
      // Hard seek applied with learned overshoot
      expect(mockEl.currentTime).toBeGreaterThanOrEqual(2.50);
    });
  });

  describe('veedSwapOrSeekReadyElement (ci algorithm)', () => {
    it('swaps ready sibling element if target element is not ready', () => {
      const currentEl = {
        readyState: 0, // Not ready
        seeking: false,
        currentTime: 0,
        src: 'blob:http://localhost/video1#clip1',
      } as any;

      const readyCandidate = {
        readyState: 4, // Ready!
        seeking: false,
        currentTime: 0,
        src: 'blob:http://localhost/video1#clip2',
      } as any;

      const pool = new Map<string, any>([
        ['clip_target', { el: currentEl, mediaId: 'm1' }],
        ['clip_sibling', { el: readyCandidate, mediaId: 'm1' }],
      ]);

      const chosen = veedSwapOrSeekReadyElement(10.5, 'blob:http://localhost/video1', 'clip_target', pool);
      expect(chosen).toBe(readyCandidate);
      expect(readyCandidate.currentTime).toBe(10.5);
    });
  });

  describe('VeedPlaybackEngine', () => {
    it('manages dirty flag correctly', () => {
      veedEngine.resetDirty();
      expect(veedEngine.isDirty()).toBe(false);

      veedEngine.setDirty();
      expect(veedEngine.isDirty()).toBe(true);
    });

    it('binds primary video and provides diagnostics', () => {
      const mockVideo = {
        requestVideoFrameCallback: vi.fn(),
      } as any;

      veedEngine.bindPrimaryVideo(mockVideo);
      const diag = veedEngine.getDiagnostics();
      expect(diag).toHaveProperty('primaryTrackId');
      expect(diag).toHaveProperty('activeVideoElements');
      expect(diag).toHaveProperty('rvfcActive');
      expect(diag).toHaveProperty('isDirty');
    });
  });
});
