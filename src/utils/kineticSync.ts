/**
 * kineticSync.ts
 *
 * Keeps a Hybrid kinetic-typography sentence and its per-word PiP layers in sync.
 *
 * Background
 * ----------
 * Hybrid mode builds, for each sentence:
 *   - a "primary" text clip on the main timeline holding the FULL sentence, and
 *   - a PiP window whose tracks each hold ONE word, positioned on a laid-out grid.
 *
 * The primary clip's text was authoritative only at generation time. Editing it
 * afterwards did nothing to the word layers, so the sentence and the animation
 * silently diverged. This module makes the primary text the single source of truth:
 *
 *   - edit a word in place   -> update that layer's text, keep its timing/animation
 *   - delete a word          -> remove exactly that layer
 *   - insert a word          -> add a layer, inheriting timing from its neighbour
 *   - move/resize the group  -> re-flow every word at once
 *
 * Everything here is pure: it takes the old word list and the new sentence and
 * returns a plan. That keeps the (fiddly) diff logic unit-testable and free of
 * store/DOM coupling.
 */

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

/**
 * Split a sentence into words.
 *
 * Collapses arbitrary whitespace (including newlines and non-breaking spaces) so
 * that "a  b" and "a\nb" both yield two words rather than empty tokens, which
 * would otherwise create invisible zero-width PiP layers.
 */
export function tokenizeSentence(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/\u00a0/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------

export type WordOpKind = 'keep' | 'update' | 'insert' | 'remove';

export interface WordOp {
  kind: WordOpKind;
  /** Index into the NEW word list (undefined for 'remove'). */
  newIndex?: number;
  /** Index into the OLD word list (undefined for 'insert'). */
  oldIndex?: number;
  /** The resulting word text (undefined for 'remove'). */
  text?: string;
}

/**
 * Diff the old word list against the new one.
 *
 * Uses a classic LCS (longest common subsequence) so that inserting or deleting a
 * word in the middle of a sentence only touches that position. A naive
 * index-by-index comparison would mark every subsequent word as "changed",
 * destroying and rebuilding all of their PiP layers — which loses their timing,
 * animation and any manual tweaks the user made. Requirement: editing a word must
 * NOT add or remove layers, and deleting one must remove exactly one.
 *
 * Adjacent remove+insert pairs are then coalesced into a single 'update' so an
 * in-place edit reuses the existing layer.
 */
export function diffWords(oldWords: string[], newWords: string[]): WordOp[] {
  const n = oldWords.length;
  const m = newWords.length;

  // LCS table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = oldWords[i] === newWords[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Walk the table to produce a raw edit script.
  const raw: WordOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldWords[i] === newWords[j]) {
      raw.push({ kind: 'keep', oldIndex: i, newIndex: j, text: newWords[j] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ kind: 'remove', oldIndex: i });
      i++;
    } else {
      raw.push({ kind: 'insert', newIndex: j, text: newWords[j] });
      j++;
    }
  }
  while (i < n) raw.push({ kind: 'remove', oldIndex: i++ });
  while (j < m) raw.push({ kind: 'insert', newIndex: j, text: newWords[j++] });

  // Coalesce remove+insert (in either order) into an in-place update so the
  // existing layer — and its timing/animation — is preserved.
  const ops: WordOp[] = [];
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k];
    const next = raw[k + 1];
    if (
      next &&
      ((cur.kind === 'remove' && next.kind === 'insert') ||
        (cur.kind === 'insert' && next.kind === 'remove'))
    ) {
      const removeOp = cur.kind === 'remove' ? cur : next;
      const insertOp = cur.kind === 'insert' ? cur : next;
      ops.push({
        kind: 'update',
        oldIndex: removeOp.oldIndex,
        newIndex: insertOp.newIndex,
        text: insertOp.text,
      });
      k++; // consume the pair
      continue;
    }
    ops.push(cur);
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface LayoutWord {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface LayoutOptions {
  /** 'row' wraps at a wide margin; 'column' uses a narrow one. */
  layout?: 'row' | 'column';
  /** Uniform scale multiplier applied to the whole block (1 = generated size). */
  scale?: number;
  /** Group translation in frame units. */
  offsetX?: number;
  offsetY?: number;
  /** Explicit font size; when omitted it is derived from the sentence length. */
  fontSize?: number;
}

/**
 * Lay a sentence out into non-overlapping word positions.
 *
 * This mirrors the maths the generator uses so that a re-flow after an edit
 * produces the same visual result the generator would have. Keeping it in one
 * place is what makes requirement 6 (move/resize the whole sentence and have every
 * word re-flow together) a single call instead of per-word bookkeeping.
 */
export function layoutSentence(words: string[], opts: LayoutOptions = {}): LayoutWord[] {
  if (words.length === 0) return [];

  const isColumn = opts.layout === 'column';
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;

  const sentence = words.join(' ');
  const totalChars = sentence.length;

  let baseFont = opts.fontSize;
  if (!baseFont) {
    baseFont = isColumn
      ? Math.min(68, Math.max(42, Math.floor(500 / Math.max(1, totalChars * 0.4))))
      : Math.min(54, Math.max(36, Math.floor(760 / Math.max(1, totalChars * 0.52))));
  }
  const fontSize = Math.max(1, baseFont * scale);

  const maxLineWidth = (isColumn ? 420 : 860) * scale;
  const charWidth = fontSize * 0.52;
  const spaceWidth = fontSize * 0.35;
  const lineHeight = fontSize * 1.35;

  // Greedy word wrap.
  const lines: Array<Array<{ text: string; width: number }>> = [[]];
  let currentLineWidth = 0;
  for (const text of words) {
    const width = Math.round(text.length * charWidth);
    const isFirstOnLine = lines[lines.length - 1].length === 0;
    if (!isFirstOnLine && currentLineWidth + spaceWidth + width > maxLineWidth) {
      lines.push([]);
      currentLineWidth = 0;
    }
    const line = lines[lines.length - 1];
    line.push({ text, width });
    currentLineWidth += (line.length === 1 ? 0 : spaceWidth) + width;
  }

  const totalHeight = lines.length * lineHeight;
  const startY = -totalHeight / 2 + lineHeight / 2;

  const result: LayoutWord[] = [];
  lines.forEach((line, lineIdx) => {
    const lineWidth =
      line.reduce((sum, w) => sum + w.width, 0) + Math.max(0, line.length - 1) * spaceWidth;
    let cursor = -lineWidth / 2;
    const y = Math.round(startY + lineIdx * lineHeight) + offsetY;

    for (const { text, width } of line) {
      result.push({
        text,
        x: Math.round(cursor + width / 2) + offsetX,
        y,
        fontSize: Math.round(fontSize),
      });
      cursor += width + spaceWidth;
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// Sync planning
// ---------------------------------------------------------------------------

/** Minimal shape of an existing word layer, as stored in a PiP track. */
export interface ExistingWordLayer {
  clipId: string;
  trackId: string;
  text: string;
  startTime: number;
  duration: number;
}

export interface SyncPlanUpdate {
  clipId: string;
  trackId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface SyncPlanInsert {
  /** Index in the new word list — used to place the track in reading order. */
  index: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  /** Timing inherited from a neighbouring word. */
  startTime: number;
  duration: number;
}

export interface SyncPlan {
  /** Existing layers to mutate (text and/or position). */
  updates: SyncPlanUpdate[];
  /** Layers to create. */
  inserts: SyncPlanInsert[];
  /** clipIds of layers to delete. */
  removals: string[];
  /** True when nothing at all needs to change (lets callers skip a store write). */
  noop: boolean;
}

/**
 * Build a plan that reconciles the existing word layers with a new sentence.
 *
 * `sentenceDuration` bounds inherited timings so an inserted word can never run
 * past the end of the PiP window.
 */
export function planKineticSync(
  existing: ExistingWordLayer[],
  newSentence: string,
  sentenceDuration: number,
  layoutOpts: LayoutOptions = {}
): SyncPlan {
  const newWords = tokenizeSentence(newSentence);
  const oldWords = existing.map((e) => e.text);
  const ops = diffWords(oldWords, newWords);
  const positions = layoutSentence(newWords, layoutOpts);

  const updates: SyncPlanUpdate[] = [];
  const inserts: SyncPlanInsert[] = [];
  const removals: string[] = [];

  let anyTextChange = false;

  for (const op of ops) {
    if (op.kind === 'remove') {
      const layer = existing[op.oldIndex!];
      if (layer) removals.push(layer.clipId);
      anyTextChange = true;
      continue;
    }

    const pos = positions[op.newIndex!];
    if (!pos) continue;

    if (op.kind === 'insert') {
      // Inherit timing from the previous existing word where possible so the new
      // word appears in a sensible place in the animation; the user can then
      // fine-tune it on the timeline.
      const prevLayer = findPrevExisting(existing, ops, op.newIndex!);
      const startTime = prevLayer
        ? Math.min(prevLayer.startTime + prevLayer.duration * 0.5, Math.max(0, sentenceDuration - 0.1))
        : 0;
      inserts.push({
        index: op.newIndex!,
        text: pos.text,
        x: pos.x,
        y: pos.y,
        fontSize: pos.fontSize,
        startTime,
        duration: Math.max(0.1, sentenceDuration - startTime),
      });
      anyTextChange = true;
      continue;
    }

    // keep | update -> reuse the existing layer.
    const layer = existing[op.oldIndex!];
    if (!layer) continue;
    if (op.kind === 'update') anyTextChange = true;
    updates.push({
      clipId: layer.clipId,
      trackId: layer.trackId,
      text: pos.text,
      x: pos.x,
      y: pos.y,
      fontSize: pos.fontSize,
    });
  }

  return {
    updates,
    inserts,
    removals,
    noop: !anyTextChange && inserts.length === 0 && removals.length === 0,
  };
}

/** Nearest preceding word that already exists, used to inherit timing. */
function findPrevExisting(
  existing: ExistingWordLayer[],
  ops: WordOp[],
  newIndex: number
): ExistingWordLayer | null {
  let best: ExistingWordLayer | null = null;
  for (const op of ops) {
    if (op.newIndex === undefined || op.newIndex >= newIndex) continue;
    if (op.oldIndex === undefined) continue;
    const layer = existing[op.oldIndex];
    if (layer) best = layer;
  }
  return best;
}

/**
 * Re-flow every word for a group transform (requirement 6): the user drags or
 * scales the sentence container and all words move together, preserving the
 * relative layout instead of needing to be nudged one by one.
 */
export function planGroupReflow(
  existing: ExistingWordLayer[],
  sentence: string,
  layoutOpts: LayoutOptions
): SyncPlanUpdate[] {
  const words = tokenizeSentence(sentence);
  const positions = layoutSentence(words, layoutOpts);
  const updates: SyncPlanUpdate[] = [];

  const count = Math.min(existing.length, positions.length);
  for (let i = 0; i < count; i++) {
    updates.push({
      clipId: existing[i].clipId,
      trackId: existing[i].trackId,
      text: positions[i].text,
      x: positions[i].x,
      y: positions[i].y,
      fontSize: positions[i].fontSize,
    });
  }
  return updates;
}

/**
 * Identify the mediaIds the kinetic generator uses. These are synthetic
 * (`generator:*`) and intentionally absent from the media library, which is why
 * the timeline used to label them "Unknown" — see getKineticClipLabel.
 */
export const KINETIC_MEDIA_IDS = {
  hybridSentence: 'generator:kinetic-hybrid-sentence',
  sentence: 'generator:kinetic-sentence',
  word: 'generator:kinetic-word',
} as const;

export function isKineticMediaId(mediaId: string | undefined): boolean {
  return !!mediaId && mediaId.startsWith('generator:kinetic');
}

/**
 * Human-readable label for any clip, preferring its actual text content.
 *
 * The timeline resolved a clip's name purely through the media library and fell
 * back to a shared `{ name: 'Unknown', type: 'video' }` placeholder. Generator
 * clips have no library entry, so every kinetic clip (and its word layers)
 * displayed as "Unknown" with a video icon.
 */
export function getKineticClipLabel(
  clip: { textSettings?: { text?: string } | null; mediaId?: string } | null | undefined,
  fallback: string = 'Text'
): string {
  const text = clip?.textSettings?.text?.trim();
  if (text) return text;
  if (isKineticMediaId(clip?.mediaId)) return fallback;
  return fallback;
}
