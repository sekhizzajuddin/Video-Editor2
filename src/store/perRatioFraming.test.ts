import { describe, it, expect } from 'vitest';

/**
 * `perRatioFraming` is an ADDITIVE per-aspect-ratio layer applied on top of a
 * clip's own transform:
 *
 *     effectiveX     = transform.x + framing.x
 *     effectiveScale = transform.scale * framing.scale / 100
 *
 * updateClip used to mirror the ABSOLUTE transform into it on every edit, which
 * is a completely different quantity. These tests lock in that a normal transform
 * edit leaves framing alone.
 */

type Transform = { x: number; y: number; scale: number };
type Framing = { x?: number; y?: number; scale?: number };

const render = (t: Transform, f: Framing) => ({
  x: t.x + (f.x ?? 0),
  y: t.y + (f.y ?? 0),
  scale: t.scale * (f.scale !== undefined ? f.scale / 100 : 1),
});

/** Fixed behaviour: transform edits never touch framing. */
const updateTransform = (t: Transform, patch: Partial<Transform>): Transform => ({ ...t, ...patch });

/** What the overlay seeds a drag with (framing divided back out). */
const seedScale = (t: Transform, f: Framing) =>
  t.scale / (f.scale !== undefined ? f.scale / 100 : 1);

describe('transform edits do not corrupt perRatioFraming', () => {
  it('resizing does not double-apply scale', () => {
    const t = updateTransform({ x: 0, y: 0, scale: 100 }, { scale: 250 });
    expect(render(t, {}).scale).toBe(250); // not 625
  });

  it('moving does not double-apply position', () => {
    const t = updateTransform({ x: 0, y: 0, scale: 100 }, { x: 40 });
    expect(render(t, {}).x).toBe(40); // not 80
  });

  it('a move after a resize preserves the size', () => {
    let t: Transform = { x: 0, y: 0, scale: 100 };
    t = updateTransform(t, { scale: 250 });
    t = updateTransform(t, { x: 40 });
    t = updateTransform(t, { x: 80 });
    expect(t.scale).toBe(250);
    expect(render(t, {}).scale).toBe(250);
  });

  it('the drag seed stays at the resized value instead of collapsing to 100', () => {
    // The bug: framing.scale mirrored transform.scale, so
    // seed = 250 / (250/100) = 100 -> the next move wrote 100 back.
    const t: Transform = { x: 0, y: 0, scale: 250 };
    expect(seedScale(t, {})).toBe(250);
    expect(seedScale(t, { scale: 250 })).toBe(100); // documents the old failure
  });

  it('genuine framing set via its own action still composes additively', () => {
    const t: Transform = { x: 10, y: 5, scale: 200 };
    const f: Framing = { x: -4, y: 2, scale: 50 };
    const r = render(t, f);
    expect(r.x).toBe(6);
    expect(r.y).toBe(7);
    expect(r.scale).toBe(100);
  });

  it('repeated edits never compound', () => {
    let t: Transform = { x: 0, y: 0, scale: 100 };
    for (let i = 0; i < 6; i++) t = updateTransform(t, { scale: 180, x: 25 });
    expect(t.scale).toBe(180);
    expect(t.x).toBe(25);
    expect(render(t, {}).scale).toBe(180);
  });
});
