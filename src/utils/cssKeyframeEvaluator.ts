/**
 * cssKeyframeEvaluator — a CSS animation engine we can freeze by hand.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists
 * ─────────────────────────────────────────────────────────────────────────────
 * The preferred capture path freezes CSS declaratively (negative
 * `animation-delay` + `animation-play-state: paused`) and lets the browser
 * rasterize it. That only works if the engine animates SVG images at all —
 * Chromium does, but engines that render SVG-in-`<img>` in *static* mode
 * (Firefox historically, some WebViews) produce a frozen frame no matter what
 * we inject.
 *
 * This module is the browser-independent fallback: it parses the scene's
 * `@keyframes`, evaluates every animation at an arbitrary time `t`, and bakes
 * the result into **static declarations** (with `animation: none !important`).
 * Static CSS survives serialization in every engine, so the exported overlay
 * animates everywhere — deterministically, with no timing jitter.
 *
 * Supported (covers effectively all AI-authored motion graphics):
 *   • numeric / length / percentage / angle values  (opacity, translate, rotate…)
 *   • transform function lists with matching signatures
 *   • colours (hex, rgb/a, hsl/a, basic keywords)
 *   • comma separated numeric lists (stroke-dasharray…)
 *   • easing: linear, ease*, cubic-bezier(), steps()
 *   • iteration-count (incl. infinite), direction, fill-mode, per-keyframe easing
 * Anything else degrades to discrete (step) interpolation at the 50% mark.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * @keyframes parsing
 * ────────────────────────────────────────────────────────────────────────── */

export interface KeyframeStop {
  /** 0..1 */
  offset: number;
  /** property → value, lowercased keys, raw values */
  props: Record<string, string>;
  /** easing that applies on the interval *starting* at this stop */
  easing?: string;
}

export type KeyframesMap = Record<string, KeyframeStop[]>;

/** Splits `a: 1px solid red; b: 2` on semicolons that are not inside parens. */
function splitDeclarations(block: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of block) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

function parseDeclarations(block: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const decl of splitDeclarations(block)) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!key || !value) continue;
    props[key] = value;
  }
  return props;
}

/**
 * Extracts every `@keyframes` block from a stylesheet's text.
 * Uses brace matching so nested blocks and `@media` wrappers don't truncate it.
 */
export function parseKeyframes(cssText: string): KeyframesMap {
  const map: KeyframesMap = {};
  if (!cssText) return map;

  const lower = cssText.toLowerCase();
  let searchFrom = 0;

  for (;;) {
    const at = lower.indexOf('@keyframes', searchFrom);
    if (at === -1) break;
    searchFrom = at + 10;

    // Name: up to the first '{'
    const open = cssText.indexOf('{', at);
    if (open === -1) break;
    const name = cssText.slice(at + 10, open).trim().replace(/^['"]|['"]$/g, '');
    if (!name) continue;

    // Matching close brace
    let depth = 0;
    let close = -1;
    for (let i = open; i < cssText.length; i++) {
      const ch = cssText[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) break;

    const body = cssText.slice(open + 1, close);
    map[name] = parseKeyframeBody(body);
    searchFrom = close + 1;
  }

  return map;
}

function parseKeyframeBody(body: string): KeyframeStop[] {
  const stops: KeyframeStop[] = [];

  // Split top-level blocks: "0%, 100% { … }"
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('{', i);
    if (open === -1) break;
    const selectors = body.slice(i, open).trim();
    let depth = 0;
    let close = -1;
    for (let j = open; j < body.length; j++) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}') {
        depth--;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    if (close === -1) break;

    const props = parseDeclarations(body.slice(open + 1, close));
    const easing = props['animation-timing-function'];
    if (easing) delete props['animation-timing-function'];

    for (const rawSel of selectors.split(',')) {
      const sel = rawSel.trim().toLowerCase();
      let offset: number | null = null;
      if (sel === 'from') offset = 0;
      else if (sel === 'to') offset = 1;
      else if (/^-?[\d.]+%$/.test(sel)) offset = Math.min(1, Math.max(0, parseFloat(sel) / 100));
      else if (/^-?[\d.]+$/.test(sel)) offset = Math.min(1, Math.max(0, parseFloat(sel)));
      if (offset === null) continue;
      stops.push({ offset, props: { ...props }, easing });
    }

    i = close + 1;
  }

  stops.sort((a, b) => a.offset - b.offset);
  return stops;
}

/** Collects `@keyframes` from every <style> element inside a container. */
export function collectKeyframes(root: ParentNode): KeyframesMap {
  const map: KeyframesMap = {};
  const styles = root.querySelectorAll?.('style') ?? [];
  styles.forEach((styleEl) => {
    const text = styleEl.textContent || '';
    if (!text.includes('@keyframes')) return;
    Object.assign(map, parseKeyframes(text));
  });
  return map;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Easing
 * ────────────────────────────────────────────────────────────────────────── */

const EASING_PRESETS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

/**
 * Solves a CSS cubic-bezier(x1, y1, x2, y2) for y at a given x, using
 * Newton-Raphson with a bisection-free fallback. p0 and p3 are fixed at 0 and 1
 * for CSS timing functions.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  let t = Math.min(1, Math.max(0, x));
  for (let k = 0; k < 8; k++) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-6) break;
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  t = Math.min(1, Math.max(0, t));

  return ((ay * t + by) * t + cy) * t;
}

/** Applies a CSS timing function to a 0..1 progress value. */
export function applyEasing(fn: string | undefined, p: number): number {
  const value = (fn || 'ease').trim().toLowerCase();
  if (!value || value === 'linear') return p;

  if (EASING_PRESETS[value]) {
    const [x1, y1, x2, y2] = EASING_PRESETS[value];
    return cubicBezier(x1, y1, x2, y2, p);
  }

  const cb = value.match(/^cubic-bezier\(([^)]+)\)$/);
  if (cb) {
    const parts = cb[1].split(',').map((v) => parseFloat(v.trim()));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [x1, y1, x2, y2] = parts;
      return cubicBezier(x1, y1, x2, y2, p);
    }
    return p;
  }

  const steps = value.match(/^steps\((\d+)(?:,\s*(start|end|jump-start|jump-end|jump-none|jump-both))?\)$/);
  if (steps) {
    const n = Math.max(1, parseInt(steps[1], 10));
    const pos = steps[2];
    const k = Math.floor(p * n);
    if (pos === 'start' || pos === 'jump-start') return Math.min(1, (k + 1) / n);
    return Math.min(1, k / n);
  }

  const s = value.match(/^steps\(([^)]+)\)$/);
  if (s) return Math.min(1, Math.floor(p * parseInt(s[1], 10) || 1) / (parseInt(s[1], 10) || 1));

  return p;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Value interpolation
 * ────────────────────────────────────────────────────────────────────────── */

const NAMED_COLORS: Record<string, [number, number, number]> = {
  transparent: [0, 0, 0],
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  gold: [255, 215, 0],
  navy: [0, 0, 128],
  teal: [0, 128, 128],
  silver: [192, 192, 192],
  crimson: [220, 20, 60],
  tomato: [255, 99, 71],
  slate: [112, 128, 144],
};

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'transparent') return [0, 0, 0, 0];
  if (NAMED_COLORS[v]) {
    const [r, g, b] = NAMED_COLORS[v];
    return [r, g, b, 1];
  }

  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }
  }

  const fn = v.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const ch = parts.slice(0, 3).map((p) => {
        const n = p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p);
        return Number.isFinite(n) ? Math.min(255, Math.max(0, n)) : 0;
      });
      const a = parts.length > 3 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
      return [ch[0], ch[1], ch[2], Number.isFinite(a) ? a : 1];
    }
  }

  const hsl = v.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) {
    const parts = hsl[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const h = parseFloat(parts[0]) / 360;
      const s = parseFloat(parts[1]) / 100;
      const l = parseFloat(parts[2]) / 100;
      const a = parts.length > 3 ? parseFloat(parts[3]) : 1;
      const [r, g, b] = hslToRgb(h, s, l);
      return [r * 255, g * 255, b * 255, Number.isFinite(a) ? a : 1];
    }
  }

  return null;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [conv(h + 1 / 3), conv(h), conv(h - 1 / 3)];
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function formatColor(c: RGBA): string {
  const r = Math.round(Math.min(255, Math.max(0, c[0])));
  const g = Math.round(Math.min(255, Math.max(0, c[1])));
  const b = Math.round(Math.min(255, Math.max(0, c[2])));
  const a = Math.min(1, Math.max(0, c[3]));
  return a >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Number(a.toFixed(3))})`;
}

interface NumericToken {
  value: number;
  unit: string;
}

function parseNumeric(value: string): NumericToken | null {
  const m = value.trim().match(/^([+-]?[\d.]+)([a-z%]*)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return { value: n, unit: m[2] || '' };
}

function interpolateNumeric(from: string, to: string, k: number): string | null {
  const a = parseNumeric(from);
  const b = parseNumeric(to);
  if (!a || !b) return null;
  const unit = b.unit || a.unit;
  const value = lerp(a.value, b.value, k);
  return `${Number(value.toFixed(4))}${unit}`;
}

function splitTopLevel(value: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

interface TransformFn {
  fn: string;
  args: string[];
}

function parseTransform(value: string): TransformFn[] | null {
  const v = value.trim();
  if (v.toLowerCase() === 'none') return [];
  if (!v.includes('(')) return null;
  const fns: TransformFn[] = [];
  for (const part of splitTopLevel(v, ' ')) {
    if (!part) continue;
    if (!part.includes('(')) return null;
    const open = part.indexOf('(');
    const fn = part.slice(0, open);
    const args = splitTopLevel(part.slice(open + 1, part.lastIndexOf(')')), ',');
    fns.push({ fn, args });
  }
  return fns;
}

function interpolateTransform(from: string, to: string, k: number): string | null {
  const a = parseTransform(from);
  const b = parseTransform(to);
  if (!a || !b) return null;
  if (a.length !== b.length) return null;

  const out: string[] = [];
  for (let i = 0; i < a.length; i++) {
    // Function names are case-insensitive in CSS.
    if (a[i].fn.toLowerCase() !== b[i].fn.toLowerCase()) return null;
    const args: string[] = [];
    for (let j = 0; j < Math.max(a[i].args.length, b[i].args.length); j++) {
      const av = a[i].args[j] ?? '0';
      const bv = b[i].args[j] ?? '0';
      const interpolated = interpolateNumeric(av, bv, k);
      args.push(interpolated ?? (k < 0.5 ? av : bv));
    }
    out.push(`${a[i].fn}(${args.join(',')})`);
  }
  return out.length ? out.join(' ') : 'none';
}

/** Interpolates two CSS values; returns null when it must fall back to discrete. */
export function interpolateValue(from: string, to: string, k: number): string {
  const f = from.trim();
  const t = to.trim();
  if (f === t) return f;

  // Transforms
  if (/^(none|matrix|translate|scale|rotate|skew|perspective)/i.test(f + t)) {
    const tr = interpolateTransform(f, t, k);
    if (tr !== null) return tr;
  }

  // Colours
  const cf = parseColor(f);
  const ct = parseColor(t);
  if (cf && ct) {
    return formatColor([
      lerp(cf[0], ct[0], k),
      lerp(cf[1], ct[1], k),
      lerp(cf[2], ct[2], k),
      lerp(cf[3], ct[3], k),
    ]);
  }

  // Comma separated numeric lists (stroke-dasharray, box-shadow offsets…)
  if (f.includes(',') && t.includes(',')) {
    const fa = splitTopLevel(f, ',');
    const ta = splitTopLevel(t, ',');
    if (fa.length === ta.length && fa.length > 1) {
      const parts = fa.map((fv, idx) => interpolateNumeric(fv, ta[idx], k) ?? (k < 0.5 ? fv : ta[idx]));
      return parts.join(',');
    }
  }

  // Space separated numeric lists (e.g. "0 0 40px rgba(...)")
  if (/\s/.test(f) && /\s/.test(t)) {
    const fa = f.split(/\s+/);
    const ta = t.split(/\s+/);
    if (fa.length === ta.length && fa.length > 1) {
      return fa
        .map((fv, idx) => interpolateValue(fv, ta[idx], k))
        .join(' ');
    }
  }

  const numeric = interpolateNumeric(f, t, k);
  if (numeric !== null) return numeric;

  return k < 0.5 ? f : t;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Animation evaluation
 * ────────────────────────────────────────────────────────────────────────── */

export interface AnimationConfig {
  name: string;
  duration: number;
  delay: number;
  easing: string;
  iterations: number; // Infinity allowed
  direction: string;
  fill: string;
}

/** CSS `animation-*` shorthand lists are comma separated and repeat cyclically. */
export function buildAnimationConfigs(computed: {
  names: string[];
  durations: number[];
  delays: number[];
  easings: string[];
  iterations: number[];
  directions: string[];
  fills: string[];
}): AnimationConfig[] {
  const { names } = computed;
  const pick = <T>(arr: T[], i: number, fallback: T): T =>
    arr.length === 0 ? fallback : arr[i % arr.length];

  return names.map((name, i) => ({
    name,
    duration: Math.max(0, pick(computed.durations, i, 0)),
    delay: pick(computed.delays, i, 0),
    easing: pick(computed.easings, i, 'ease'),
    iterations: pick(computed.iterations, i, 1),
    direction: pick(computed.directions, i, 'normal').toLowerCase(),
    fill: pick(computed.fills, i, 'none').toLowerCase(),
  }));
}

/**
 * Evaluates one animation at `t` (seconds on the element's own timeline) and
 * returns the declarations to apply, or null when the animation is not active
 * at that time (no fill) so the element keeps its base style.
 */
export function evaluateAnimationAt(
  anim: AnimationConfig,
  stops: KeyframeStop[] | undefined,
  t: number
): Record<string, string> | null {
  if (!stops || stops.length === 0 || anim.duration <= 0) return null;

  const elapsed = t - anim.delay;
  const iterations = anim.iterations;
  const total = Number.isFinite(iterations) ? anim.duration * Math.max(1, iterations) : Infinity;
  const holdsBefore = anim.fill === 'backwards' || anim.fill === 'both';
  const holdsAfter = anim.fill === 'forwards' || anim.fill === 'both';

  let progress: number;

  if (elapsed < 0) {
    if (!holdsBefore) return null;
    progress = 0;
  } else if (elapsed >= total) {
    if (!holdsAfter) return null;
    progress = 1;
  } else {
    let iterationIndex = Math.floor(elapsed / anim.duration);
    let local = elapsed - iterationIndex * anim.duration;
    let p = anim.duration > 0 ? local / anim.duration : 1;

    if (Number.isFinite(iterations)) {
      if (iterationIndex >= iterations) {
        iterationIndex = iterations - 1;
        local = anim.duration;
        p = 1;
      }
      if (anim.direction === 'alternate') {
        if (iterationIndex % 2 === 1) p = 1 - p;
      } else if (anim.direction === 'alternate-reverse') {
        if ((iterations - 1 - iterationIndex) % 2 === 1) p = 1 - p;
      } else if (anim.direction === 'reverse') {
        p = 1 - p;
      }
    } else if (anim.direction === 'alternate' && iterationIndex % 2 === 1) {
      p = 1 - p;
    } else if (anim.direction === 'alternate-reverse' && iterationIndex % 2 === 0) {
      p = 1 - p;
    }

    // The animation-level timing function maps iteration progress → progress.
    progress = Math.min(1, Math.max(0, applyEasing(anim.easing, p)));
  }

  return declarationsAtProgress(stops, progress, anim.easing);
}

function declarationsAtProgress(
  stops: KeyframeStop[],
  progress: number,
  fallbackEasing: string
): Record<string, string> {
  const p = Math.min(1, Math.max(0, progress));

  // Locate the interval [a, b] containing p.
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].offset && p <= stops[i + 1].offset) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const span = upper.offset - lower.offset;
  const localK = span > 0 ? (p - lower.offset) / span : 1;
  // No per-keyframe easing → the animation's own timing function applies
  // (CSS default), which is what makes `animation-timing-function: linear`
  // stay linear across the whole segment.
  const k = Math.min(1, Math.max(0, applyEasing(lower.easing ?? fallbackEasing, localK)));

  // Union of every property used by any stop.
  const allProps = new Set<string>();
  for (const stop of stops) Object.keys(stop.props).forEach((key) => allProps.add(key));

  const result: Record<string, string> = {};

  for (const prop of allProps) {
    // Nearest defined value walking backwards / forwards from the interval.
    let fromValue: string | undefined;
    for (let i = stops.length - 1; i >= 0; i--) {
      if (stops[i].offset <= lower.offset && stops[i].props[prop] !== undefined) {
        fromValue = stops[i].props[prop];
        break;
      }
    }
    let toValue: string | undefined;
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].offset >= upper.offset && stops[i].props[prop] !== undefined) {
        toValue = stops[i].props[prop];
        break;
      }
    }

    if (fromValue === undefined && toValue === undefined) continue;
    const fv = fromValue ?? toValue!;
    const tv = toValue ?? fromValue!;
    result[prop] = interpolateValue(fv, tv, k);
  }

  return result;
}
