import { describe, it, expect } from 'vitest';
import {
  tokenizeSentence,
  diffWords,
  layoutSentence,
  deriveLineStructure,
  getSentenceBounds,
  planKineticSync,
  planGroupReflow,
  getKineticClipLabel,
  isKineticMediaId,
  type ExistingWordLayer,
} from './kineticSync';

const layer = (text: string, i: number): ExistingWordLayer => ({
  clipId: `clip_${i}`,
  trackId: `track_${i}`,
  text,
  startTime: i * 0.5,
  duration: 1,
});

const layersFor = (words: string[]) => words.map(layer);

describe('tokenizeSentence', () => {
  it('splits on whitespace', () => {
    expect(tokenizeSentence('Hello brave new world')).toEqual(['Hello', 'brave', 'new', 'world']);
  });

  it('collapses repeated / newline / nbsp whitespace instead of emitting empty words', () => {
    expect(tokenizeSentence('a  b\n\nc\u00a0d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles empty and whitespace-only input', () => {
    expect(tokenizeSentence('')).toEqual([]);
    expect(tokenizeSentence('   ')).toEqual([]);
  });
});

describe('diffWords', () => {
  it('reports all keeps when nothing changed', () => {
    const ops = diffWords(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(ops.every((o) => o.kind === 'keep')).toBe(true);
  });

  it('editing one word yields exactly one update and no insert/remove', () => {
    // Requirement 5: editing a word must not add or remove any PiP layer.
    const ops = diffWords(['the', 'quick', 'fox'], ['the', 'slow', 'fox']);
    expect(ops.filter((o) => o.kind === 'update')).toHaveLength(1);
    expect(ops.filter((o) => o.kind === 'insert')).toHaveLength(0);
    expect(ops.filter((o) => o.kind === 'remove')).toHaveLength(0);
    expect(ops.find((o) => o.kind === 'update')!.text).toBe('slow');
  });

  it('deleting a middle word removes exactly one and keeps the rest', () => {
    const ops = diffWords(['a', 'b', 'c'], ['a', 'c']);
    expect(ops.filter((o) => o.kind === 'remove')).toHaveLength(1);
    expect(ops.filter((o) => o.kind === 'keep')).toHaveLength(2);
    expect(ops.filter((o) => o.kind === 'insert')).toHaveLength(0);
  });

  it('inserting a middle word adds exactly one and keeps the rest', () => {
    const ops = diffWords(['a', 'c'], ['a', 'b', 'c']);
    expect(ops.filter((o) => o.kind === 'insert')).toHaveLength(1);
    expect(ops.filter((o) => o.kind === 'keep')).toHaveLength(2);
    expect(ops.filter((o) => o.kind === 'remove')).toHaveLength(0);
  });

  it('does not cascade changes after a mid-sentence insert (LCS, not index compare)', () => {
    // A naive index-by-index diff would mark b,c,d as changed here.
    const ops = diffWords(['b', 'c', 'd'], ['a', 'b', 'c', 'd']);
    expect(ops.filter((o) => o.kind === 'keep')).toHaveLength(3);
    expect(ops.filter((o) => o.kind === 'insert')).toHaveLength(1);
  });

  it('handles clearing the sentence entirely', () => {
    const ops = diffWords(['a', 'b'], []);
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => o.kind === 'remove')).toBe(true);
  });

  it('handles building from empty', () => {
    const ops = diffWords([], ['a', 'b']);
    expect(ops.every((o) => o.kind === 'insert')).toBe(true);
  });

  it('handles duplicate words without losing any', () => {
    const ops = diffWords(['go', 'go', 'go'], ['go', 'go']);
    const kept = ops.filter((o) => o.kind === 'keep').length;
    const removed = ops.filter((o) => o.kind === 'remove').length;
    expect(kept).toBe(2);
    expect(removed).toBe(1);
  });
});

describe('layoutSentence', () => {
  it('returns one position per word', () => {
    const out = layoutSentence(['a', 'b', 'c']);
    expect(out).toHaveLength(3);
    expect(out.map((w) => w.text)).toEqual(['a', 'b', 'c']);
  });

  it('produces no overlapping words on the same line', () => {
    const out = layoutSentence(['alpha', 'beta', 'gamma']);
    const sameLine = out.filter((w) => w.y === out[0].y);
    for (let i = 1; i < sameLine.length; i++) {
      expect(sameLine[i].x).toBeGreaterThan(sameLine[i - 1].x);
    }
  });

  it('wraps long sentences onto multiple lines', () => {
    const many = Array.from({ length: 40 }, (_, i) => `word${i}`);
    const out = layoutSentence(many);
    const distinctRows = new Set(out.map((w) => w.y));
    expect(distinctRows.size).toBeGreaterThan(1);
  });

  it('is horizontally centred around the origin', () => {
    const out = layoutSentence(['one', 'two', 'three']);
    const xs = out.map((w) => w.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid)).toBeLessThan(40);
  });

  it('applies a group offset to every word', () => {
    const base = layoutSentence(['a', 'b', 'c']);
    const moved = layoutSentence(['a', 'b', 'c'], { offsetX: 100, offsetY: -50 });
    for (let i = 0; i < base.length; i++) {
      expect(moved[i].x - base[i].x).toBe(100);
      expect(moved[i].y - base[i].y).toBe(-50);
    }
  });

  it('scaling grows the font and spreads the words', () => {
    const base = layoutSentence(['aa', 'bb', 'cc']);
    const big = layoutSentence(['aa', 'bb', 'cc'], { scale: 2 });
    expect(big[0].fontSize).toBeGreaterThan(base[0].fontSize);
    const baseSpread = Math.max(...base.map((w) => w.x)) - Math.min(...base.map((w) => w.x));
    const bigSpread = Math.max(...big.map((w) => w.x)) - Math.min(...big.map((w) => w.x));
    expect(bigSpread).toBeGreaterThan(baseSpread);
  });

  it('column layout wraps sooner than row layout', () => {
    const words = Array.from({ length: 12 }, (_, i) => `w${i}`);
    const rows = new Set(layoutSentence(words, { layout: 'row' }).map((w) => w.y)).size;
    const cols = new Set(layoutSentence(words, { layout: 'column' }).map((w) => w.y)).size;
    expect(cols).toBeGreaterThanOrEqual(rows);
  });

  it('returns nothing for an empty sentence', () => {
    expect(layoutSentence([])).toEqual([]);
  });
});

describe('planKineticSync', () => {
  it('editing a word updates in place with no layer churn', () => {
    const existing = layersFor(['the', 'quick', 'fox']);
    const plan = planKineticSync(existing, 'the slow fox', 3);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.removals).toHaveLength(0);
    expect(plan.updates).toHaveLength(3);
    expect(plan.updates.map((u) => u.text)).toEqual(['the', 'slow', 'fox']);
    // The edited word keeps its original layer.
    expect(plan.updates[1].clipId).toBe('clip_1');
  });

  it('removing a word removes exactly that layer', () => {
    const existing = layersFor(['a', 'b', 'c']);
    const plan = planKineticSync(existing, 'a c', 3);
    expect(plan.removals).toEqual(['clip_1']);
    expect(plan.inserts).toHaveLength(0);
  });

  it('adding a word inserts one layer with inherited timing', () => {
    const existing = layersFor(['a', 'c']);
    const plan = planKineticSync(existing, 'a b c', 3);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].text).toBe('b');
    expect(plan.inserts[0].startTime).toBeGreaterThanOrEqual(0);
    expect(plan.inserts[0].startTime).toBeLessThan(3);
    expect(plan.removals).toHaveLength(0);
  });

  it('an inserted word never runs past the sentence duration', () => {
    const existing = layersFor(['a', 'b', 'c', 'd']);
    const plan = planKineticSync(existing, 'a b c d e', 2);
    for (const ins of plan.inserts) {
      expect(ins.startTime + ins.duration).toBeLessThanOrEqual(2 + 1e-6);
      expect(ins.duration).toBeGreaterThan(0);
    }
  });

  it('reports noop when the sentence is unchanged', () => {
    const existing = layersFor(['hello', 'world']);
    expect(planKineticSync(existing, 'hello world', 2).noop).toBe(true);
  });

  it('clearing the text removes every layer', () => {
    const existing = layersFor(['a', 'b']);
    const plan = planKineticSync(existing, '', 2);
    expect(plan.removals).toHaveLength(2);
    expect(plan.updates).toHaveLength(0);
  });

  it('every surviving word gets a non-overlapping position', () => {
    const existing = layersFor(['one', 'two']);
    const plan = planKineticSync(existing, 'one two three four', 4);
    const all = [...plan.updates, ...plan.inserts];
    expect(all).toHaveLength(4);
    for (const w of all) {
      expect(Number.isFinite(w.x)).toBe(true);
      expect(Number.isFinite(w.y)).toBe(true);
      expect(w.fontSize).toBeGreaterThan(0);
    }
  });
});

describe('planGroupReflow', () => {
  it('moves every word by the group offset in one pass', () => {
    const existing = layersFor(['a', 'b', 'c']);
    const before = planGroupReflow(existing, 'a b c', {});
    const after = planGroupReflow(existing, 'a b c', { offsetX: 60, offsetY: 20 });
    expect(after).toHaveLength(3);
    for (let i = 0; i < before.length; i++) {
      expect(after[i].x - before[i].x).toBe(60);
      expect(after[i].y - before[i].y).toBe(20);
    }
  });

  it('scaling the group rescales every word', () => {
    const existing = layersFor(['aa', 'bb']);
    const scaled = planGroupReflow(existing, 'aa bb', { scale: 1.5 });
    const base = planGroupReflow(existing, 'aa bb', { scale: 1 });
    expect(scaled[0].fontSize).toBeGreaterThan(base[0].fontSize);
  });
});

describe('getKineticClipLabel / isKineticMediaId', () => {
  it('prefers the clip text over any media name', () => {
    expect(getKineticClipLabel({ textSettings: { text: 'Light Unlimited' } })).toBe('Light Unlimited');
  });

  it('falls back for a generator clip with no text', () => {
    expect(
      getKineticClipLabel({ mediaId: 'generator:kinetic-word', textSettings: { text: '' } }, 'Word')
    ).toBe('Word');
  });

  it('trims whitespace-only text', () => {
    expect(getKineticClipLabel({ textSettings: { text: '   ' } }, 'Text')).toBe('Text');
  });

  it('detects generator media ids', () => {
    expect(isKineticMediaId('generator:kinetic-word')).toBe(true);
    expect(isKineticMediaId('generator:kinetic-hybrid-sentence')).toBe(true);
    expect(isKineticMediaId('some-real-media-id')).toBe(false);
    expect(isKineticMediaId(undefined)).toBe(false);
  });
});

// ─── Regression tests for the reported issues ──────────────────────────────

describe('layout: line breaks survive a group transform (issue 2)', () => {
  const words = 'Light Unlimited Speed Travel Kyun Nahi Karti?'.split(' ');
  const structure = [2, 2, 3];

  it('preserves the supplied line structure exactly', () => {
    const out = layoutSentence(words, { lineStructure: structure });
    const rows = new Map<number, number>();
    for (const w of out) rows.set(w.y, (rows.get(w.y) ?? 0) + 1);
    expect([...rows.values()]).toEqual(structure);
  });

  it('does NOT collapse to one line when the group is scaled', () => {
    // The bug: maxLineWidth scaled with the font, so the wrap point never moved
    // and a re-flow rebuilt everything onto a single line.
    const before = layoutSentence(words, { lineStructure: structure });
    const linesBefore = new Set(before.map((w) => w.y)).size;
    for (const scale of [1.05, 1.2, 1.5, 0.8]) {
      const after = layoutSentence(words, { lineStructure: structure, scale });
      expect(new Set(after.map((w) => w.y)).size).toBe(linesBefore);
    }
  });

  it('does NOT collapse to one line when the group is moved', () => {
    const before = layoutSentence(words, { lineStructure: structure });
    const after = layoutSentence(words, { lineStructure: structure, offsetX: 40, offsetY: 25 });
    expect(new Set(after.map((w) => w.y)).size).toBe(new Set(before.map((w) => w.y)).size);
    for (let i = 0; i < before.length; i++) {
      expect(after[i].x - before[i].x).toBe(40);
      expect(after[i].y - before[i].y).toBe(25);
    }
  });

  it('is idempotent: re-flowing with the same transform does not drift', () => {
    const a = layoutSentence(words, { lineStructure: structure, scale: 1.2, offsetX: 10 });
    const b = layoutSentence(words, { lineStructure: structure, scale: 1.2, offsetX: 10 });
    expect(a).toEqual(b);
  });

  it('appended words wrap onto the end without disturbing existing lines', () => {
    const extended = [...words, 'Extra'];
    const out = layoutSentence(extended, { lineStructure: structure });
    expect(out).toHaveLength(extended.length);
    expect(out.map((w) => w.text)).toEqual(extended);
  });

  it('without a structure it still wraps long text onto multiple lines', () => {
    const many = Array.from({ length: 40 }, (_, i) => `word${i}`);
    expect(new Set(layoutSentence(many).map((w) => w.y)).size).toBeGreaterThan(1);
  });
});

describe('deriveLineStructure', () => {
  it('recovers word counts per line from laid-out positions', () => {
    const laid = layoutSentence('a b c d e'.split(' '), { lineStructure: [2, 3] });
    const layers = laid.map((w, i) => ({
      clipId: `c${i}`, trackId: `t${i}`, text: w.text,
      startTime: 0, duration: 1, x: w.x, y: w.y,
    }));
    expect(deriveLineStructure(layers)).toEqual([2, 3]);
  });

  it('tolerates sub-pixel drift between words on a line', () => {
    const layers = [
      { clipId: 'a', trackId: 'a', text: 'a', startTime: 0, duration: 1, x: 0, y: 10 },
      { clipId: 'b', trackId: 'b', text: 'b', startTime: 0, duration: 1, x: 50, y: 12 },
      { clipId: 'c', trackId: 'c', text: 'c', startTime: 0, duration: 1, x: 0, y: 60 },
    ];
    expect(deriveLineStructure(layers)).toEqual([2, 1]);
  });

  it('returns an empty structure when positions are unknown', () => {
    const layers = [{ clipId: 'a', trackId: 'a', text: 'a', startTime: 0, duration: 1 }];
    expect(deriveLineStructure(layers)).toEqual([]);
  });

  it('round-trips: derive -> layout reproduces the same structure', () => {
    const words = 'one two three four five six'.split(' ');
    const original = layoutSentence(words, { lineStructure: [1, 3, 2] });
    const layers = original.map((w, i) => ({
      clipId: `c${i}`, trackId: `t${i}`, text: w.text,
      startTime: 0, duration: 1, x: w.x, y: w.y,
    }));
    const derived = deriveLineStructure(layers);
    const reflowed = layoutSentence(words, { lineStructure: derived });
    expect(new Set(reflowed.map((w) => w.y)).size).toBe(new Set(original.map((w) => w.y)).size);
  });
});

describe('getSentenceBounds (issue 1: box must cover the whole sentence)', () => {
  it('encloses every word across all lines', () => {
    const laid = layoutSentence('Light Unlimited Speed Travel Kyun Nahi Karti?'.split(' '), {
      lineStructure: [2, 2, 3],
    });
    const b = getSentenceBounds(laid)!;
    expect(b).not.toBeNull();
    for (const w of laid) {
      const halfW = (w.text.length * w.fontSize * 0.52) / 2;
      const halfH = (w.fontSize * 1.35) / 2;
      expect(w.x - halfW).toBeGreaterThanOrEqual(b.x - b.width / 2 - 0.01);
      expect(w.x + halfW).toBeLessThanOrEqual(b.x + b.width / 2 + 0.01);
      expect(w.y - halfH).toBeGreaterThanOrEqual(b.y - b.height / 2 - 0.01);
      expect(w.y + halfH).toBeLessThanOrEqual(b.y + b.height / 2 + 0.01);
    }
  });

  it('is TALLER than a single line for multi-line text (the reported bug)', () => {
    const words = 'Light Unlimited Speed Travel Kyun Nahi Karti?'.split(' ');
    const oneLine = getSentenceBounds(layoutSentence(words, { lineStructure: [7] }))!;
    const threeLine = getSentenceBounds(layoutSentence(words, { lineStructure: [2, 2, 3] }))!;
    expect(threeLine.height).toBeGreaterThan(oneLine.height * 2);
    expect(threeLine.width).toBeLessThan(oneLine.width);
  });

  it('returns null for an empty sentence', () => {
    expect(getSentenceBounds([])).toBeNull();
  });
});
