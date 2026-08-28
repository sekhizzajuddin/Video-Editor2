# Generative Motion Graphics — CSS Animation → Transparent Video

How the **Generative** workspace turns AI-authored HTML/CSS ("Vox style" vector
animation) into a video overlay that composites cleanly on top of the base
footage, plus the catalogue of bugs that used to break it.

Code map:

| File | Role |
| --- | --- |
| `src/components/GenerativeWorkspace/*` | Studio UI (clip input, dialogue, style, preview, code editor) |
| `src/utils/generateMotionGraphicsFromDialogue.ts` | Storyboard → AI prompt → spec → render orchestration |
| `src/utils/cssSceneRasterizer.ts` | **The CSS → frame strategy** (seek, sanitise, serialize, rasterize) |
| `src/utils/motionGraphicRenderer.ts` | Frame loop, WebCodecs/WebM encoding, alpha + keying strategy |
| `src/utils/motionGraphicComponents/*` | Canvas-2D components (`KineticWord`, `VectorShape`, …) |
| `src/utils/motionGraphicHtmlCapture.ts` | Backwards-compatible wrappers around `cssSceneRasterizer` |

---

## 1. The transparency strategy

The overlay must carry real transparency, otherwise it covers the base video.
Two complementary mechanisms, chosen automatically at render time:

### Tier 1 — VP9 alpha channel (preferred)

`VideoEncoder` is probed with `alpha: 'keep'` over `vp09.00.41.08 → vp09.00.40.08
→ vp09.00.10.08 → vp8`. When it is supported:

* the `OffscreenCanvas` is created with `alpha: true`,
* every frame starts with `ctx.clearRect(...)`,
* `new VideoFrame(canvas, { alpha: 'keep' })` keeps the alpha channel,
* `webm-muxer` writes `V_VP9` with `alpha: true`.

Result: a WebM with a genuine alpha channel that the preview `<video>` **and**
the export compositor (`drawImage` of a decoded frame) composite for free.

### Tier 2 — Key-colour plate + auto chroma key (fallback)

Browsers without VP9 alpha (and the `MediaRecorder` path, which can never carry
alpha) render the scene over a flat plate — `#ff00ff` — and report
`alphaMode: 'key'`.

When the clip is applied to the timeline the workspace attaches a chroma-key
effect automatically:

```ts
chromaKey: { enabled: true, color: '#ff00ff', threshold: 42, softness: 16,
             spillSuppression: 60, edgeFeather: 1 }
```

Chroma keying is implemented in both renderers
(`CanvasRenderingEngine` for preview, `Compositor.applyChromaKey` for export),
so the keyed overlay survives export.

### Transparency is also *authored*, not just encoded

An LLM will almost always open a scene with a full-frame plate:

```html
<div style="width:1920px;height:1080px;background:#0b1020"> … </div>
<svg …><rect width="1920" height="1080" fill="#0b1020"/></svg>
```

`enforceTransparency()` (in `cssSceneRasterizer.ts`) walks every element,
measures its **coverage** (`getBoundingClientRect()` vs. the 1920×1080 stage)
and, when it exceeds 75 %, neutralises `background-color`, `background-image`,
`box-shadow` and SVG `fill`. Small pills behind text are untouched, so contrast
is preserved while the frame stays transparent. Toggle: **Transparent
background** in Generation Settings (on by default). Escape hatch for
hand-edited scenes: `data-procut-keep-bg="true"`.

---

## 2. The CSS animation → frame strategy

### Why the old pipeline produced frozen (or blank) frames

Per frame it did:

1. `element.getAnimations({subtree:true}).forEach(a => a.currentTime = t)`
2. `XMLSerializer → <svg><foreignObject>…`
3. `new Image()` + blob URL → `ctx.drawImage()`

Step 1 cannot influence step 3. An SVG loaded through `<img>` is rasterized in a
**brand new document**; serialization copies the *authored* CSS, so every
animation restarts at `t = 0` inside the image. Every frame came back identical
(and, with `animation-fill-mode: both`, usually *empty*, because the first
keyframe is `opacity: 0`).

### The fix — freeze CSS declaratively

CSS can express "hold this animation advanced by `t` seconds" with two
properties that survive serialization:

```css
animation-delay: -1.234s;      /* already advanced by 1.234 s */
animation-play-state: paused;  /* hold it there, deterministically */
```

`seekSceneStage()` rewrites a single `<style data-procut-seek>` node per frame:

```css
[data-procut-anim="3"]{animation-delay:-1.2340s !important;animation-play-state:paused !important;}
[data-procut-anim="3"]::before{ … }
```

Details that matter:

* **Authored delays are compensated**: `local = t - authoredDelay`, so an
  element meant to appear 1.5 s into the scene still appears at 1.5 s. Before
  its start the computed delay is positive, which reproduces the CSS pre-roll
  state exactly.
* **Infinite loops are wrapped** (`local %= duration`) so the rasterizer never
  has to unwind thousands of iterations.
* **Pseudo-elements are covered** by emitting `::before` / `::after` variants —
  inline styles cannot reach them.
* The sheet is appended **last** in the stage and uses `!important`, so it beats
  the AI's own rules.

### Frame loop (`motionGraphicRenderer.paintFrame`)

```
clear (or fill key colour)
  → for each active scene: seekSceneStage(tLocal) → serialize → rasterize → drawImage
  → for each active canvas component: drawComponent(ctx, …)
  → VideoFrame → encode → mux
```

Sanitising (`sanitizeMotionSceneHtml`) strips `<script>`, `<iframe>`, `<link>`,
remote `url()`/`@import`, event handlers and non-`data:` images before the
markup ever reaches the DOM — external references make the SVG image fail to
load or taint the canvas.

### Frame baking: engine-independent fallback (`SeekMode = 'js'`)

Even the negative-delay trick fails on engines that rasterize SVG images with
**no animation timeline at all** (the frame is rendered as a static document).
For those engines `cssKeyframeEvaluator.ts` does the interpolation itself:

1. `collectKeyframes(stage)` parses every `@keyframes` block in the scene
   (brace-matched, so it is safe inside `@media` or nested rules).
2. `buildAnimationConfigs()` expands the `animation-*` shorthand lists into one
   config per animation (duration, delay, easing, iteration count, direction,
   fill mode).
3. `evaluateAnimationAt(config, stops, t)` returns the **static declarations**
   for time `t`: it resolves the iteration index, applies the easing (named
   presets, `cubic-bezier()`, `steps()`), and interpolates numbers, lengths,
   percentages, angles, colours, comma/space-separated lists and transform
   function lists with matching signatures.
4. `buildKeyframeCss()` emits them as plain declarations plus
   `animation: none !important`, so no engine can re-animate the baked frame.

Because the result is ordinary static CSS, it survives XML serialization in
every engine — including ones that refuse to animate SVG images.

### Capability probe + three seek modes

`probeCaptureCapabilities()` renders a 24×24 opaque box that slides `0 → 40px`
over one second and captures it at `t≈0` and `t≈1`. One probe answers both
questions:

| Observation | Meaning | `SeekMode` |
| --- | --- | --- |
| nothing rasterizes (alpha 0 on frame 0) | SVG images unsupported | `'static'` |
| box present at both times | static rasterization — animations are ignored | `'js'` (bake frames) |
| box present at `t≈0`, gone at `t≈1` | native seeked CSS works | `'css'` (fast path) |

The probe runs once per session and is cached. `motionGraphicRenderer` asks for
the mode once and passes it to every `captureSceneFrame()` call. In `'static'`
mode each scene is drawn at its **finished** state instead of `t`, so the
overlay shows the complete artwork rather than an empty first keyframe. The
Preview Theater surfaces the mode as a **Frames baked** (js) or **CSS frozen**
(static) badge.

---

## 3. Live CSS preview (editing loop)

The rendered WebM is the source of truth for export, but scrubbing raw CSS is
far nicer while editing code. `ResultPreview` can swap the video layer for
**Live CSS**: the scene runs in a sandboxed `<iframe srcdoc>` where the document
is live, so the Web Animations API *does* work and `animation.currentTime = t`
scrubs perfectly. The transport posts `procut:play|pause|seek` messages into the
iframe; each scene only mounts while the playhead is inside its
`enterAt…exitAt` window.

Use **Rendered** to check the exported result; use **Live CSS** while editing
code, then **Re-render** to bake the edits into the WebM (**Apply to Timeline**
re-renders automatically when the code is dirty).

---

## 4. Bug catalogue (what was broken and what fixed it)

| # | Symptom | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | Vox-style scenes never appear in the video | HTML/CSS scene rendering was **commented out** in both renderers | Scene rasterization re-enabled through `cssSceneRasterizer` |
| 2 | Frames identical / scene invisible | WAAPI seeking is lost by XML serialization; animations restart at `t=0` in the SVG image | Negative `animation-delay` + `animation-play-state: paused` seek sheet |
| 3 | Overlay covered the base video | AI-authored full-frame backdrops baked into the render | `enforceTransparency()` + transparency rules in the prompt |
| 4 | "Generation failed" on some accounts | Single hard-coded model id (`gemini-3.5-flash-lite`); a 404 killed the run | Model fallback list + explicit error text |
| 5 | JSON parse failures → empty fallback card | Gemini output truncated at the default token cap | `maxOutputTokens: 65536`, `finishReason` check, truncated-JSON salvage |
| 6 | Code editor edits did nothing | `editedHtmlCss` was stored in state and never re-rendered | **Re-render** action + auto re-render on Apply |
| 7 | Overlay landed under the footage | `addTrack('video')` unshifts a new track and the preview sorted video tracks by digits parsed from uuid ids (random order) | Dedicated `Motion Overlay` track appended last; preview now keeps array order for non-legacy ids |
| 8 | A new empty track on every Apply | `addTrack` called unconditionally | Track is created once and reused |
| 9 | Overlay blob vanished on reload | Media item was registered without a `File` | `addMedia(item, new File([blob], …))` persists it in IndexedDB |
| 10 | Transport froze / looped wrong | Clock read only from the video element (absent in text mode) | Wall-clock transport that syncs media elements when present |
| 11 | Slider/scale leaks | A new `ResizeObserver` was created on every render inside a ref callback | Single observer in `useEffect` with `disconnect()` cleanup |
| 12 | Only `htmlCssScenes[0]` was ever shown | Preview hardcoded the first scene | All scenes render inside their time windows |
| 13 | Nothing happened on click in the drop zone | No click handler at all | File picker + "Media library" picker |
| 14 | Audio-only clips / non-video drops rejected confusingly | Only `application/procut-media` and file drops were handled | Same handling, plus explicit errors and duration guards |
| 15 | Applying to the timeline gave a **purple screen, no animation** | `skipExpensiveFX` (auto-quality, on while playing or scrubbing) disabled chroma keying, and every keyed overlay carries `chromaKey.enabled` by construction — so the magenta plate showed through during playback | New `ClipChromaKeySettings.alwaysApply`; the playback engine's `hasChroma` gate honours it, and `handleApplyToTimeline` sets it on generated overlays |
| 16 | "Vox style" produced typography | The prompt described canvas text components first and never specified artwork density, so the model took the cheapest path (animated words) | Per-style art direction (`STYLE_ART_DIRECTION`) + a hard rule that each scene carries 12+ SVG shapes and text stays under ~25% of the frame, plus a worked reference scene |
| 17 | The AI still ships text-only scenes | Nothing scored the response | `validateSceneQuality()` counts SVG shapes per scene; failures trigger one automatic **correction pass** that returns the validator's complaints to the model, and the better of the two designs wins |
| 18 | Preview player misaligned / squeezed | The stage was `w-full h-full aspect-video` — a box that is rarely 16:9, so the video letterboxed to the height while the CSS overlay scaled to the width. The docked code editor (`max-h-72`) then shrank it further | The stage is measured in JS and sized to an exact 16:9 letterbox; the code editor is now a floating drawer; the control rail and the editor timeline can both be folded away |
| 19 | Animated element + its `::before`/`::after` lost animation | `indexAnimations()` minted a fresh `data-procut-anim` id per pseudo-target and wrote them all to the **same attribute**, so all but the last seek rule targeted an id that no longer existed | One id per **element**; pseudo-elements are addressed by selector suffix |
| 20 | Keyed overlay previewed as a purple wash | `ResultPreview` played the magenta plate raw with `mix-blend-mode: screen` | `KeyedOverlayVideo` runs the same `applyChromaKeyOnData()` the playback engine uses, on a canvas capped at 960×540 |

---

## 5. Performance notes

* One `OffscreenCanvas` is reused for the whole render; only the seek stylesheet
  text changes between frames.
* `waitForEncoderSlot()` throttles on `encodeQueueSize` (and the `dequeue`
  event) so long renders don't balloon memory.
* The loop yields to the event loop every 6 frames to keep the UI responsive.
* Keyframe every 2 s (`i % (fps * 2)`) for sane seeking.
* Cost is dominated by SVG rasterization (~15–40 ms/frame at 1080p), i.e. a few
  seconds for a 10–15 s clip.
* The `'js'` baking path adds a small per-frame cost (a few hundred style
  declarations) but no extra rasterization, so it is close to free next to the
  SVG draw.
* The live keyed preview keys at most 960×540 per frame; the timeline keys at
  full resolution through the playback engine.
