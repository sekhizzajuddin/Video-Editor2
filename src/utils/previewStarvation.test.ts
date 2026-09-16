import { describe, it, expect } from 'vitest';
import {
  decidePreviewGate,
  isElementStarved,
  describeDegradedClip,
  STARVATION_GRACE_MS,
  STARVATION_HARD_LIMIT_MS,
  MAX_RECOVERY_ATTEMPTS,
  type StarvedElementReport,
  type RecoveryRecord,
} from './previewStarvation';

const report = (clipId: string, starvedForMs: number, readyState = 1): StarvedElementReport => ({
  clipId,
  starvedForMs,
  readyState,
});

const recoveryMap = (entries: Record<string, RecoveryRecord>) => (clipId: string) => entries[clipId];

describe('decidePreviewGate', () => {
  it('does nothing when every element is ready', () => {
    const d = decidePreviewGate({ reports: [], nowMs: 1000 });
    expect(d).toEqual({ gate: false, recover: [], degraded: [] });
  });

  it('freezes the clock for a fresh stall (keeps brief loads smooth)', () => {
    const d = decidePreviewGate({ reports: [report('c1', 120)], nowMs: 1000 });
    expect(d.gate).toBe(true);
    expect(d.recover).toEqual([]);
    expect(d.degraded).toEqual([]);
  });

  it('stops gating once the stall passes the grace window', () => {
    const d = decidePreviewGate({ reports: [report('c1', STARVATION_GRACE_MS + 1)], nowMs: 5000 });
    expect(d.gate).toBe(false);
  });

  it('still gates when a sibling element is freshly starved', () => {
    // c1 is hopeless, c2 just started loading: the fresh one is what the freeze is for.
    const d = decidePreviewGate({ reports: [report('c1', 5000), report('c2', 50)], nowMs: 5000 });
    expect(d.gate).toBe(true);
  });

  it('never gates longer than the grace window, whatever the elements do', () => {
    // Worst case: elements that never become ready, at every possible age.
    for (const ms of [STARVATION_GRACE_MS, STARVATION_GRACE_MS + 10, 2000, 60000, 600000]) {
      const d = decidePreviewGate({ reports: [report('c1', ms, 0)], nowMs: 1_000_000 });
      expect(d.gate, `starved for ${ms}ms must not gate`).toBe(false);
    }
  });

  it('re-seeks an element that is merely stalled mid-decode', () => {
    const d = decidePreviewGate({ reports: [report('c1', 1200, 1)], nowMs: 5000 });
    expect(d.recover).toEqual([{ clipId: 'c1', tier: 'seek' }]);
  });

  it('escalates to a full reload when the element has no data at all', () => {
    const d = decidePreviewGate({ reports: [report('c1', 900, 0)], nowMs: 5000 });
    expect(d.recover).toEqual([{ clipId: 'c1', tier: 'reload' }]);
  });

  it('escalates to a reload past the hard limit even with data present', () => {
    const d = decidePreviewGate({
      reports: [report('c1', STARVATION_HARD_LIMIT_MS + 1, 2)],
      nowMs: 10_000,
    });
    expect(d.recover).toEqual([{ clipId: 'c1', tier: 'reload' }]);
  });

  it('respects the recovery cooldown', () => {
    const recoveryOf = recoveryMap({ c1: { attempts: 1, lastAtMs: 4900 } });
    const d = decidePreviewGate({ reports: [report('c1', 3000)], nowMs: 5000, recoveryOf });
    expect(d.recover).toEqual([]);
    expect(d.gate).toBe(false);
  });

  it('recovers again once the cooldown has passed', () => {
    const recoveryOf = recoveryMap({ c1: { attempts: 1, lastAtMs: 4000 } });
    const d = decidePreviewGate({ reports: [report('c1', 3000)], nowMs: 5000, recoveryOf });
    expect(d.recover).toEqual([{ clipId: 'c1', tier: 'seek' }]);
  });

  it('gives up after the attempt budget and reports the clip as degraded', () => {
    const recoveryOf = recoveryMap({ c1: { attempts: MAX_RECOVERY_ATTEMPTS, lastAtMs: 0 } });
    const d = decidePreviewGate({ reports: [report('c1', 30000)], nowMs: 60000, recoveryOf });
    expect(d.recover).toEqual([]);
    expect(d.degraded).toEqual(['c1']);
    expect(d.gate).toBe(false);
  });

  it('keeps recovering other clips while one is degraded', () => {
    const recoveryOf = recoveryMap({ c1: { attempts: MAX_RECOVERY_ATTEMPTS, lastAtMs: 0 } });
    const d = decidePreviewGate({
      reports: [report('c1', 30000), report('c2', 2000)],
      nowMs: 60000,
      recoveryOf,
    });
    expect(d.degraded).toEqual(['c1']);
    expect(d.recover).toEqual([{ clipId: 'c2', tier: 'seek' }]);
  });

  it('re-seeks rather than reloading while a stuck element still has data', () => {
    // readyState 2 means the element has frames; only the seek is stuck.
    const d = decidePreviewGate({ reports: [report('c1', 1500, 2)], nowMs: 9000 });
    expect(d.recover[0]?.tier).toBe('seek');
  });
});

describe('isElementStarved', () => {
  it('ignores an element with no source assigned', () => {
    expect(isElementStarved({ readyState: 0, seeking: false, hasSource: false })).toBe(false);
  });

  it('treats a pending seek as starved', () => {
    expect(isElementStarved({ readyState: 4, seeking: true, hasSource: true })).toBe(true);
  });

  it('treats insufficient decoded data as starved', () => {
    expect(isElementStarved({ readyState: 1, seeking: false, hasSource: true })).toBe(true);
    expect(isElementStarved({ readyState: 0, seeking: false, hasSource: true })).toBe(true);
  });

  it('is satisfied by HAVE_CURRENT_DATA with no seek in flight', () => {
    expect(isElementStarved({ readyState: 2, seeking: false, hasSource: true })).toBe(false);
    expect(isElementStarved({ readyState: 4, seeking: false, hasSource: true })).toBe(false);
  });
});

describe('describeDegradedClip', () => {
  it('reports the clip, the wait and the element state', () => {
    const msg = describeDegradedClip('clip-7', 4200, 0);
    expect(msg).toContain('clip-7');
    expect(msg).toContain('4.2s');
    expect(msg).toContain('readyState 0');
  });
});
