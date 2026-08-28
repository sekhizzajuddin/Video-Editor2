/**
 * cssSceneRasterizer
 * ─────────────────────────────────────────────────────────────────────────────
 * Turns a self-contained HTML/CSS/SVG "motion scene" (the kind the AI emits for
 * the Generative Motion Graphics workspace) into **frame-accurate bitmaps** on a
 * canvas, with a fully transparent background so the result can be overlaid on
 * top of a base video.
 *
 * ── Why the previous implementation produced frozen / empty frames ────────────
 *
 * The old pipeline did this per frame:
 *   1. `element.getAnimations({subtree:true}).forEach(a => a.currentTime = t)`
 *   2. `XMLSerializer` → `<svg><foreignObject>…`
 *   3. `new Image()` + blob URL → `ctx.drawImage()`
 *
 * Step 1 is a no-op for step 2/3: an SVG loaded through `<img>` is rasterized in
 * a **brand new document** (Blink's "secure animated mode"). Serializing the DOM
 * copies the *authored* CSS, so every animation restarts at t=0 inside the image
 * and every captured frame is byte-identical. That is the single biggest reason
 * "Vox style" animations never made it into the rendered video.
 *
 * ── The strategy used here ───────────────────────────────────────────────────
 *
 * CSS can be *frozen at an arbitrary point of its own timeline* purely
 * declaratively, with two properties:
 *
 *     animation-delay: -<t>s   →  starts the animation already advanced by t
 *     animation-play-state: paused  →  holds it there, deterministically
 *
 * Both survive XML serialization, so we bake a per-frame `<style>` sheet into the
 * serialized markup and rasterize that. No scripts, no external assets, no
 * tainting — and it works for animations declared on pseudo-elements too.
 *
 * Transparency (the second half of the ask) is handled by `enforceTransparency`:
 * motion scenes authored by an LLM almost always open with a full-frame
 * `<div style="width:1920px;height:1080px;background:#0b1020">` or an SVG
 * `<rect width="1920" height="1080" fill="#…"/>`. Those are detected by
 * *coverage* (element rect vs. stage rect) and neutralised, so only the artwork
 * survives and the exported clip composites cleanly over the base video.
 */

import {
  AnimationConfig,
  KeyframesMap,
  buildAnimationConfigs,
  collectKeyframes,
  evaluateAnimationAt,
} from './cssKeyframeEvaluator';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** Attributes that may pull in an external resource and taint the canvas. */
const EXTERNAL_URL_ATTRS = ['src', 'href', 'srcset', 'xlink:href', 'poster', 'data'];

export type PseudoTarget = '' | '::before' | '::after';

export interface AnimatedNode extends SeekNodeTiming {
  el: Element;
  /** Fully resolved per-animation config (used by the JS evaluator path). */
  configs: AnimationConfig[];
}

/**
 * How a frame's animation state is baked into the serialized markup.
 * - `css`    → negative animation-delay + paused (needs an engine that animates
 *              SVG images; supports every CSS property).
 * - `js`     → we evaluate @keyframes ourselves and emit static declarations
 *              (works in every engine that can rasterize the SVG at all).
 * - `static` → engine can't rasterize the SVG image; show the finished state.
 */
export type SeekMode = 'css' | 'js' | 'static';

export interface SceneStageOptions {
  width: number;
  height: number;
  /**
   * Strip full-frame opaque backdrops so the scene composites over a base video.
   * Default: true.
   */
  transparent?: boolean;
}

export interface SceneStage {
  el: HTMLDivElement;
  width: number;
  height: number;
  /** Stylesheet element we rewrite on every seek. */
  seekStyle: HTMLStyleElement | null;
  animated: AnimatedNode[];
  /** Parsed @keyframes of this scene (drives the JS evaluator path). */
  keyframes: KeyframesMap;
  /** True when at least one CSS animation was found in the scene. */
  hasAnimations: boolean;
  /** Number of full-frame backdrops that were neutralised. */
  strippedBackdrops: number;
  /** Number of external asset references removed during sanitising. */
  strippedExternalRefs: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sanitising
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Removes scripts, external asset references and remote `url()` lookups from the
 * AI-authored markup. Anything external makes the SVG image fail to load (or
 * taints the canvas), which is exactly what used to crash the render pass.
 */
export function sanitizeMotionSceneHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;

  const root = template.content;
  let stripped = 0;

  // 1. Drop executable / embedding tags outright.
  root.querySelectorAll('script, iframe, object, embed, link, meta, base, form, audio, video').forEach((node) => {
    node.remove();
    stripped++;
  });

  // 2. Drop every attribute that can point at a remote resource.
  root.querySelectorAll('*').forEach((node) => {
    for (const attr of EXTERNAL_URL_ATTRS) {
      const value = node.getAttribute(attr);
      if (!value) continue;
      if (/^\s*(https?:)?\/\//i.test(value) || /^\s*https?:/i.test(value)) {
        node.removeAttribute(attr);
        stripped++;
      }
    }
    // Inline handlers can't run inside an SVG image, but strip them anyway so the
    // same markup is safe when it is previewed live in an iframe.
    for (const attr of Array.from(node.attributes)) {
      if (/^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
        stripped++;
      }
    }
  });

  // 3. Remove remote url()/ @import references from stylesheets + inline styles.
  root.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.textContent || '';
    const cleaned = css
      .replace(/@import[^;]*;/gi, '')
      .replace(/url\(\s*['"]?\s*(https?:)?\/\/[^)]*\)/gi, 'none');
    if (cleaned !== css) {
      styleEl.textContent = cleaned;
      stripped++;
    }
  });

  root.querySelectorAll('[style]').forEach((node) => {
    const css = node.getAttribute('style') || '';
    const cleaned = css.replace(/url\(\s*['"]?\s*(https?:)?\/\/[^)]*\)/gi, 'none');
    if (cleaned !== css) {
      node.setAttribute('style', cleaned);
      stripped++;
    }
  });

  // 4. Images without a usable (data:) source would render as a broken icon and
  //    abort the SVG rasterization in some engines — drop them.
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!src || !/^data:/i.test(src)) {
      img.remove();
      stripped++;
    }
  });

  void stripped;
  return template.innerHTML;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Stage construction
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Builds an off-screen, laid-out DOM stage holding one motion scene.
 * The element must stay in the document (and not `display:none`) so that
 * layout + `getComputedStyle()` + `getBoundingClientRect()` all work.
 */
export function createSceneStage(
  html: string,
  options: SceneStageOptions
): SceneStage | null {
  if (typeof document === 'undefined') return null;

  const width = Math.max(2, Math.round(options.width || 1920));
  const height = Math.max(2, Math.round(options.height || 1080));
  const transparent = options.transparent !== false;

  const el = document.createElement('div');
  el.setAttribute('data-procut-stage', '1');
  el.style.position = 'fixed';
  el.style.left = '-20000px';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.opacity = '1';
  el.style.zIndex = '-2147483647';
  el.style.background = 'transparent';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.contain = 'layout paint';

  el.innerHTML = sanitizeMotionSceneHtml(html);

  if (document.body) document.body.appendChild(el);

  // Reset sheet: keeps the stage transparent and stops long shadows/filters from
  // bleeding outside the frame.
  const baseStyle = document.createElement('style');
  baseStyle.setAttribute('data-procut-base', '1');
  baseStyle.textContent = `
    [data-procut-stage] { background: transparent !important; }
    [data-procut-stage] * { box-sizing: border-box; }
  `;
  el.insertBefore(baseStyle, el.firstChild);

  const strippedBackdrops = transparent ? enforceTransparency(el, width, height) : 0;

  // Seek sheet is appended last so its !important rules win over authored CSS.
  const seekStyle = document.createElement('style');
  seekStyle.setAttribute('data-procut-seek', '1');
  el.appendChild(seekStyle);

  const animated = indexAnimations(el);

  return {
    el,
    width,
    height,
    seekStyle,
    animated,
    keyframes: collectKeyframes(el),
    hasAnimations: animated.length > 0,
    strippedBackdrops,
    strippedExternalRefs: 0,
  };
}

export function destroySceneStage(stage: SceneStage | null | undefined): void {
  if (!stage || !stage.el) return;
  if (stage.el.parentNode) stage.el.parentNode.removeChild(stage.el);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Transparency enforcement
 * ────────────────────────────────────────────────────────────────────────── */

const SVG_GRAPHICS_TAGS = new Set([
  'rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'image', 'use',
]);

/** Alpha channel of a computed colour string; opaque when unknown. */
function parseAlpha(color: string | null | undefined): number {
  if (!color) return 0;
  const c = color.trim().toLowerCase();
  if (!c || c === 'none' || c === 'transparent' || c === 'initial') return 0;

  const fn = c.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[2].split(/[,\s/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      return Number.isFinite(a) ? a : 1;
    }
    return 1;
  }
  // Named colours, gradients, url(#id) → assume opaque.
  return 1;
}

/**
 * Neutralises every full-frame opaque backdrop in the scene.
 * Returns how many elements were stripped (useful for UI diagnostics).
 */
export function enforceTransparency(
  stage: HTMLElement,
  width: number,
  height: number
): number {
  const stageRect = stage.getBoundingClientRect();
  const stageArea = (stageRect.width || width) * (stageRect.height || height);
  if (stageArea <= 0) return 0;

  const elements: Element[] = [stage, ...Array.from(stage.querySelectorAll('*'))];
  let stripped = 0;

  for (const el of elements) {
    const htmlEl = el as HTMLElement;

    if (el === stage) {
      htmlEl.style.setProperty('background', 'transparent', 'important');
      continue;
    }

    // Opt-out escape hatch for hand-edited scenes.
    if (el.getAttribute('data-procut-keep-bg') === 'true') continue;

    let rect: DOMRect | null = null;
    try {
      rect = el.getBoundingClientRect();
    } catch {
      rect = null;
    }
    const coverage = rect ? (rect.width * rect.height) / stageArea : 0;
    if (coverage < 0.75) continue;

    let touched = false;
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;

    // HTML backdrop: opaque background colour / image covering the frame.
    if (cs) {
      if (parseAlpha(cs.backgroundColor) > 0.85) {
        htmlEl.style.setProperty('background-color', 'transparent', 'important');
        touched = true;
      }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        htmlEl.style.setProperty('background-image', 'none', 'important');
        touched = true;
      }
      // Full-frame box-shadow / backdrop filters would also bake a plate.
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        htmlEl.style.setProperty('box-shadow', 'none', 'important');
        touched = true;
      }
    }

    // SVG backdrop: a rect/path/circle painting the whole viewBox.
    const isSvgGraphics =
      el.namespaceURI === SVG_NS && SVG_GRAPHICS_TAGS.has(el.tagName.toLowerCase());
    if (isSvgGraphics) {
      const fillAttr = el.getAttribute('fill');
      const fillStyle = htmlEl.style.fill;
      const computedFill = cs ? cs.fill : null;
      const fillValue = fillStyle || fillAttr || computedFill;
      if (parseAlpha(fillValue) > 0.85) {
        try {
          el.setAttribute('fill', 'none');
          htmlEl.style.setProperty('fill', 'none', 'important');
          el.removeAttribute('fill-opacity');
          touched = true;
        } catch {
          /* ignore */
        }
      }
    }

    // A full-frame <svg> wrapper is fine (it stays transparent), but its own
    // background must go.
    if (el.namespaceURI === SVG_NS && el.tagName.toLowerCase() === 'svg' && cs) {
      if (parseAlpha(cs.backgroundColor) > 0.85) {
        htmlEl.style.setProperty('background-color', 'transparent', 'important');
        touched = true;
      }
    }

    if (touched) stripped++;
  }

  return stripped;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Animation indexing + seeking
 * ────────────────────────────────────────────────────────────────────────── */

function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Parses "0.6s" / "600ms" / "0s, .4s" into seconds. */
export function parseCssTimeList(value: string | null | undefined, count: number): number[] {
  const raw = splitList(value);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const token = raw[i] ?? raw[raw.length - 1] ?? '0s';
    const num = parseFloat(token);
    if (!Number.isFinite(num)) {
      out.push(0);
      continue;
    }
    out.push(/ms\s*$/.test(token) ? num / 1000 : num);
  }
  return out;
}

export function parseCssIterationList(value: string | null | undefined, count: number): number[] {
  const raw = splitList(value);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const token = (raw[i] ?? raw[raw.length - 1] ?? '1').toLowerCase();
    out.push(token === 'infinite' ? Infinity : parseFloat(token) || 1);
  }
  return out;
}

const PSEUDOS: PseudoTarget[] = ['', '::before', '::after'];

/**
 * Walks the stage and records every element/pseudo-element that carries a CSS
 * animation, together with the authored timing we have to compensate for.
 */
export function indexAnimations(stage: HTMLElement): AnimatedNode[] {
  if (typeof getComputedStyle !== 'function') return [];

  const nodes: AnimatedNode[] = [];
  const elements: Element[] = [stage, ...Array.from(stage.querySelectorAll('*'))];
  let id = 0;

  for (const el of elements) {
    // One id per ELEMENT: the pseudo-elements share it and are addressed by
    // selector suffix (`[data-procut-anim="3"]::before`). Minting a fresh id per
    // pseudo used to overwrite the attribute, so every rule except the last one
    // silently targeted an id that no longer existed on the element.
    let elementId: number | null = null;

    for (const pseudo of PSEUDOS) {
      let cs: CSSStyleDeclaration | null = null;
      try {
        cs = getComputedStyle(el, pseudo === '' ? undefined : pseudo);
      } catch {
        cs = null;
      }
      if (!cs) continue;

      const names = splitList(cs.animationName).filter((n) => n && n !== 'none');
      if (names.length === 0) continue;

      if (elementId === null) {
        elementId = id++;
        el.setAttribute('data-procut-anim', String(elementId));
      }

      const delays = parseCssTimeList(cs.animationDelay, names.length);
      const durations = parseCssTimeList(cs.animationDuration, names.length);
      const iterations = parseCssIterationList(cs.animationIterationCount, names.length);

      nodes.push({
        id: elementId,
        el,
        pseudo,
        delays,
        durations,
        iterations,
        configs: buildAnimationConfigs({
          names,
          durations,
          delays,
          easings: splitList(cs.animationTimingFunction),
          iterations,
          directions: splitList(cs.animationDirection),
          fills: splitList(cs.animationFillMode),
        }),
      });
    }
  }

  return nodes;
}

/** Timing data `buildSeekCss` needs for one element/pseudo-element. */
export interface SeekNodeTiming {
  id: number;
  pseudo: PseudoTarget;
  delays: number[];
  durations: number[];
  iterations: number[];
}

/**
 * Builds the stylesheet that freezes CSS animations at `timeSec`.
 *
 * The trick: `animation-delay: -t` starts an animation already advanced by t and
 * `animation-play-state: paused` holds it there. Because it is plain CSS it
 * survives XML serialization into the SVG image — which `element.getAnimations()`
 * scrubbing does not.
 *
 * Exported (DOM-free) so the timing maths can be unit tested.
 */
export function buildSeekCss(nodes: SeekNodeTiming[], timeSec: number): string {
  const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
  let css = '';

  for (const node of nodes) {
    const delays: string[] = [];
    for (let i = 0; i < node.delays.length; i++) {
      let local = t - (node.delays[i] || 0);
      const dur = node.durations[i];
      if (node.iterations[i] === Infinity && dur > 0) {
        // Looping animations: keep the negative delay small so the rasterizer
        // doesn't have to unwind thousands of iterations.
        local = ((local % dur) + dur) % dur;
      }
      if (!Number.isFinite(local)) local = 0;
      delays.push(`${(-local).toFixed(4)}s`);
    }

    const selector = `[data-procut-anim="${node.id}"]${node.pseudo || ''}`;
    css +=
      `${selector}{animation-delay:${delays.join(',')} !important;` +
      `animation-play-state:paused !important;}\n`;
  }

  return css;
}

/**
 * Freezes every CSS animation in the stage at `timeSec` by rewriting the seek
 * stylesheet. Safe to call every frame — it only touches one <style> node.
 */
export function seekSceneStage(
  stage: SceneStage,
  timeSec: number,
  mode: SeekMode = 'css'
): void {
  if (!stage.seekStyle || stage.animated.length === 0) return;
  if (mode === 'js') {
    stage.seekStyle.textContent = buildKeyframeCss(stage.animated, timeSec, stage.keyframes);
    return;
  }
  stage.seekStyle.textContent = buildSeekCss(stage.animated, timeSec);
}

/**
 * Evaluates the scene's @keyframes ourselves and emits the result as *static*
 * declarations, one rule per animated element/pseudo-element.
 *
 * This is the browser-independent path: no engine support for animated SVG
 * images is required, only the ability to rasterize the SVG at all. The native
 * animation is switched off so a static engine cannot override the baked values.
 */
export function buildKeyframeCss(
  nodes: AnimatedNode[],
  timeSec: number,
  keyframes: KeyframesMap
): string {
  const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
  let css = '';

  for (const node of nodes) {
    const decls: Record<string, string> = {};
    for (const config of node.configs) {
      const stops = keyframes[config.name] ?? keyframes[stripQuotes(config.name)];
      const evaluated = evaluateAnimationAt(config, stops, t);
      if (!evaluated) continue;
      // Later animations in the list win, matching CSS behaviour.
      Object.assign(decls, evaluated);
    }

    const body = Object.entries(decls)
      .map(([prop, value]) => `${prop}:${value} !important`)
      .join(';');

    const selector = `[data-procut-anim="${node.id}"]${node.pseudo || ''}`;
    css += `${selector}{animation:none !important;${body}}\n`;
  }

  return css;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

/* ────────────────────────────────────────────────────────────────────────────
 * Serialization + rasterization
 * ────────────────────────────────────────────────────────────────────────── */

/** Serializes the stage content into an SVG foreignObject document. */
export function serializeSceneStage(stage: SceneStage): string {
  if (typeof XMLSerializer === 'undefined') return '';

  const serializer = new XMLSerializer();
  let inner = '';
  const children = Array.from(stage.el.childNodes);
  for (const child of children) {
    try {
      inner += serializer.serializeToString(child);
    } catch {
      /* skip nodes that cannot be serialized */
    }
  }

  return `<svg xmlns="${SVG_NS}" width="${stage.width}" height="${stage.height}" viewBox="0 0 ${stage.width} ${stage.height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="${XHTML_NS}" style="width:${stage.width}px;height:${stage.height}px;overflow:hidden;background:transparent;margin:0;padding:0;">` +
    `${inner}</div></foreignObject></svg>`;
}

function get2d(
  canvas: OffscreenCanvas | HTMLCanvasElement
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
  } catch {
    return null;
  }
}

/**
 * Rasterizes an SVG string onto a canvas.
 * Resolves with `false` when the browser refused to decode the image (the render
 * loop then keeps going instead of hanging forever).
 */
export async function rasterizeSvgToCanvas(
  svg: string,
  canvas: OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number,
  timeoutMs = 10_000
): Promise<boolean> {
  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    !svg
  ) {
    return false;
  }

  const ctx = get2d(canvas);
  if (!ctx) return false;

  let url: string | null = null;
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    url = URL.createObjectURL(blob);

    const img = new Image();
    img.decoding = 'sync';

    const loaded = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), timeoutMs);
      img.onload = () => {
        clearTimeout(timer);
        done(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        done(false);
      };
      img.src = url as string;
    });

    if (!loaded) return false;

    ctx.drawImage(img, 0, 0, width, height);
    return true;
  } catch {
    return false;
  } finally {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Seek → serialize → rasterize, in one call. */
export async function captureSceneFrame(
  stage: SceneStage,
  canvas: OffscreenCanvas | HTMLCanvasElement,
  timeSec: number,
  mode: SeekMode = 'css'
): Promise<boolean> {
  seekSceneStage(stage, timeSec, mode);
  const svg = serializeSceneStage(stage);
  if (!svg) return false;
  return rasterizeSvgToCanvas(svg, canvas, stage.width, stage.height);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Capability probe
 * ────────────────────────────────────────────────────────────────────────── */

export interface CaptureCapabilities {
  /** The browser can rasterize an SVG foreignObject into a canvas at all. */
  svgOk: boolean;
  /** It also honours *paused, time-seeked* CSS animations while doing so. */
  cssAnimOk: boolean;
  /** Best baking strategy for this engine. */
  mode: SeekMode;
}

let _captureCapabilities: CaptureCapabilities | null = null;

/**
 * Probe scene: a 24×24 box that slides 0 → 40px over one second. It stays fully
 * opaque throughout, which lets one probe answer BOTH questions:
 *
 *   • is anything rasterized at all?        → alpha at (12,12) on frame 0
 *   • did the animation advance on frame 2? → the box has moved off that pixel
 */
const PROBE_HTML = `
<style>
  @keyframes procutProbe { from { transform: translateX(0); } to { transform: translateX(40px); } }
  #probeBox {
    position: absolute; left: 0; top: 0; width: 24px; height: 24px;
    background: #ffffff;
    animation: procutProbe 1s linear both;
  }
</style>
<div id="probeBox"></div>
`;

export async function probeCaptureCapabilities(): Promise<CaptureCapabilities> {
  if (_captureCapabilities) return _captureCapabilities;

  const unsupported: CaptureCapabilities = { svgOk: false, cssAnimOk: false, mode: 'static' };
  if (typeof document === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    _captureCapabilities = unsupported;
    return _captureCapabilities;
  }

  let stage: SceneStage | null = null;
  try {
    stage = createSceneStage(PROBE_HTML, { width: 64, height: 64, transparent: false });
    if (!stage || stage.animated.length === 0) {
      _captureCapabilities = unsupported;
      return _captureCapabilities;
    }

    const canvas = new OffscreenCanvas(64, 64);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) {
      _captureCapabilities = unsupported;
      return _captureCapabilities;
    }

    ctx.clearRect(0, 0, 64, 64);
    const startOk = await captureSceneFrame(stage, canvas, 0.02);
    const startAlpha = ctx.getImageData(12, 12, 1, 1).data[3];

    ctx.clearRect(0, 0, 64, 64);
    const endOk = await captureSceneFrame(stage, canvas, 0.98);
    const endAlpha = ctx.getImageData(12, 12, 1, 1).data[3];

    const svgOk = Boolean(startOk && endOk) && startAlpha > 200;
    const cssAnimOk = svgOk && endAlpha < 64;

    _captureCapabilities = { svgOk, cssAnimOk, mode: cssAnimOk ? 'css' : svgOk ? 'js' : 'static' };
    return _captureCapabilities;
  } catch {
    _captureCapabilities = unsupported;
    return _captureCapabilities;
  } finally {
    destroySceneStage(stage);
  }
}

/**
 * True when this engine honours paused, time-seeked CSS animations while
 * rasterizing an SVG image (i.e. the fast, native path is usable).
 */
export async function probeCssAnimationCapture(): Promise<boolean> {
  const caps = await probeCaptureCapabilities();
  return caps.cssAnimOk;
}
