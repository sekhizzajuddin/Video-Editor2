import { describe, it, expect } from 'vitest';
import {
  getFrameSize,
  getFrameOffset,
  getClipFramePlacement,
  quadToRect,
  rectToQuad,
  defaultRegionQuad,
  normalizeRegionToFrame,
  OVERLAY_W,
  OVERLAY_H,
} from './frameSpace';

describe('getFrameSize', () => {
  it('matches the renderer/overlay convention for every ratio', () => {
    expect(getFrameSize('16:9')).toEqual({ W: 854, H: 480 });
    expect(getFrameSize('9:16')).toEqual({ W: 270, H: 480 });
    expect(getFrameSize('1:1')).toEqual({ W: 480, H: 480 });
    expect(getFrameSize('4:3')).toEqual({ W: 640, H: 480 });
  });

  it('falls back to 16:9 for an unknown ratio rather than producing NaN', () => {
    expect(getFrameSize('weird')).toEqual({ W: 854, H: 480 });
  });
});

describe('getFrameOffset', () => {
  it('centres the picture inside the overlay box', () => {
    const { offsetX, offsetY } = getFrameOffset('9:16');
    expect(offsetX).toBe((OVERLAY_W - 270) / 2);
    expect(offsetY).toBe(0);
  });

  it('is zero on 16:9, where the frame fills the overlay', () => {
    expect(getFrameOffset('16:9')).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('keeps offset + frame inside the overlay for every ratio', () => {
    for (const ar of ['16:9', '9:16', '1:1', '4:3']) {
      const { W, H } = getFrameSize(ar);
      const { offsetX, offsetY } = getFrameOffset(ar);
      expect(offsetX + W).toBeLessThanOrEqual(OVERLAY_W);
      expect(offsetY + H).toBeLessThanOrEqual(OVERLAY_H);
    }
  });
});

describe('defaultRegionQuad', () => {
  it('lands inside the picture on a portrait frame (the reported bug)', () => {
    const { W, H } = getFrameSize('9:16');
    const r = quadToRect(defaultRegionQuad(W, H));
    expect(r.cx).toBe(W / 2);
    expect(r.cy).toBe(H / 2);
    expect(r.cx - r.w / 2).toBeGreaterThanOrEqual(0);
    expect(r.cx + r.w / 2).toBeLessThanOrEqual(W);
  });

  it('never exceeds the frame on the narrowest ratio', () => {
    const { W, H } = getFrameSize('9:16');
    const r = quadToRect(defaultRegionQuad(W, H));
    expect(r.w).toBeLessThanOrEqual(W);
    expect(r.h).toBeLessThanOrEqual(H);
  });
});

describe('normalizeRegionToFrame', () => {
  it('re-centres the legacy 16:9 default that fell outside a 9:16 frame', () => {
    // The old hard-coded box: centre (427, 240), 140 wide.
    const legacy = rectToQuad(427, 240, 140, 140);
    const { W, H } = getFrameSize('9:16');

    // Sanity: it really is off the picture (right edge is 270).
    expect(quadToRect(legacy).cx - 70).toBeGreaterThan(W);

    const fixed = quadToRect(normalizeRegionToFrame(legacy, W, H));
    expect(fixed.cx).toBe(W / 2);
    expect(fixed.cy).toBe(H / 2);
    expect(fixed.w).toBe(140);
  });

  it('clamps a partially off-frame box instead of re-centring it', () => {
    const { W, H } = getFrameSize('9:16');
    // Overlaps the right edge, so the user's intent is still readable.
    const r = quadToRect(normalizeRegionToFrame(rectToQuad(260, 240, 100, 100), W, H));
    expect(r.cx).toBe(W - 50);
    expect(r.cy).toBe(240);
  });

  it('leaves a valid in-frame box untouched', () => {
    const { W, H } = getFrameSize('16:9');
    const src = rectToQuad(400, 200, 120, 90);
    expect(normalizeRegionToFrame(src, W, H)).toEqual(src);
  });

  it('shrinks a box larger than the picture', () => {
    const { W, H } = getFrameSize('9:16');
    const r = quadToRect(normalizeRegionToFrame(rectToQuad(135, 240, 900, 900), W, H));
    expect(r.w).toBe(W);
    expect(r.h).toBe(H);
  });

  it('falls back to the default for missing or degenerate input', () => {
    const { W, H } = getFrameSize('1:1');
    const expected = quadToRect(defaultRegionQuad(W, H));
    expect(quadToRect(normalizeRegionToFrame(null, W, H))).toEqual(expected);
    expect(quadToRect(normalizeRegionToFrame(rectToQuad(NaN, 5, 10, 10), W, H))).toEqual(expected);
  });

  it('always returns something fully inside the frame', () => {
    const { W, H } = getFrameSize('4:3');
    const cases = [
      rectToQuad(-500, -500, 60, 60),
      rectToQuad(9999, 9999, 60, 60),
      rectToQuad(427, 240, 140, 140),
      rectToQuad(0, 0, 20, 20),
    ];
    for (const c of cases) {
      const r = quadToRect(normalizeRegionToFrame(c, W, H));
      expect(r.cx - r.w / 2).toBeGreaterThanOrEqual(-0.001);
      expect(r.cy - r.h / 2).toBeGreaterThanOrEqual(-0.001);
      expect(r.cx + r.w / 2).toBeLessThanOrEqual(W + 0.001);
      expect(r.cy + r.h / 2).toBeLessThanOrEqual(H + 0.001);
    }
  });
});

describe('getClipFramePlacement', () => {
  it('letterboxes a landscape video inside a portrait frame', () => {
    const { W, H } = getFrameSize('9:16'); // 270 x 480
    const p = getClipFramePlacement(1920, 1080, W, H, null);
    // Width-limited: fills the width, pillar of empty space above and below.
    expect(p.w).toBeCloseTo(270, 5);
    expect(p.h).toBeCloseTo(270 * (1080 / 1920), 5);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo((H - p.h) / 2, 5);
  });

  it('fills the height of a 16:9 frame with a 16:9 video', () => {
    // Note 854 is a rounded 16:9 width (854/480 = 1.779, not 1.778), so the fit
    // is height-limited and leaves a sub-pixel sliver either side. Asserting the
    // exact maths rather than a tidy 854 keeps this honest.
    const { W, H } = getFrameSize('16:9');
    const p = getClipFramePlacement(1920, 1080, W, H, null);
    expect(p.h).toBeCloseTo(480, 5);
    expect(p.w).toBeCloseTo((1920 * 480) / 1080, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.x + p.w / 2).toBeCloseTo(W / 2, 5);
  });

  it('applies the clip scale about the frame centre', () => {
    const { W, H } = getFrameSize('16:9');
    const base = getClipFramePlacement(1920, 1080, W, H, null);
    const p = getClipFramePlacement(1920, 1080, W, H, { scale: 200 });
    expect(p.w).toBeCloseTo(base.w * 2, 5);
    expect(p.h).toBeCloseTo(base.h * 2, 5);
    // Centre must not move when only the scale changes.
    expect(p.x + p.w / 2).toBeCloseTo(W / 2, 5);
    expect(p.y + p.h / 2).toBeCloseTo(H / 2, 5);
  });

  it('applies the clip pan', () => {
    const { W, H } = getFrameSize('16:9');
    const p = getClipFramePlacement(1920, 1080, W, H, { x: 40, y: -25 });
    expect(p.x + p.w / 2).toBeCloseTo(W / 2 + 40, 5);
    expect(p.y + p.h / 2).toBeCloseTo(H / 2 - 25, 5);
  });

  it('treats a zero/garbage media size as 1920x1080 rather than dividing by zero', () => {
    const { W, H } = getFrameSize('16:9');
    const p = getClipFramePlacement(0, 0, W, H, null);
    expect(Number.isFinite(p.w)).toBe(true);
    expect(p.w).toBeGreaterThan(0);
  });
});

describe('the specific misalignment that was reported', () => {
  it('no longer double-applies the letterbox offset', () => {
    // The overlay draws regions inside translate(offsetX, offsetY). A box
    // authored at the frame centre must therefore be STORED at frame-centre and
    // only shifted once, by the group.
    const { W, H } = getFrameSize('9:16');
    const { offsetX } = getFrameOffset('9:16');
    const stored = quadToRect(defaultRegionQuad(W, H));

    const paintedX = offsetX + stored.cx; // what the browser actually renders
    // ...which must land inside the drawn picture.
    expect(paintedX).toBeGreaterThan(offsetX);
    expect(paintedX).toBeLessThan(offsetX + W);

    // The old behaviour: centre 427 stored, then offset again.
    const oldPainted = offsetX + 427;
    expect(oldPainted).toBeGreaterThan(offsetX + W); // off the right edge
  });

  it('maps a frame-space region onto the render buffer by one uniform factor', () => {
    // The renderer now composites into a full-frame buffer, so the region maps
    // by bufScale alone — no aspect-dependent fudge, no letterbox term.
    const { W, H } = getFrameSize('9:16');
    const bufScale = 1.5;
    const bufW = W * bufScale;
    const bufH = H * bufScale;
    const r = quadToRect(defaultRegionQuad(W, H));

    const sx = (r.cx - r.w / 2) * bufScale;
    const sy = (r.cy - r.h / 2) * bufScale;
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(sx + r.w * bufScale).toBeLessThanOrEqual(bufW);
    expect(sy + r.h * bufScale).toBeLessThanOrEqual(bufH);
  });
});
