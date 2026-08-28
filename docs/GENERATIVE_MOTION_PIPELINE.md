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

### Capability probe + graceful degradation

`probeCssAnimationCapture()` renders a 64×64 box that fades `0 → 1` and captures
it at `t≈0` and `t≈1`. If the two frames are identical the engine rasterizes SVG
images in *static* mode (no animation support). In that case:

* the UI shows a **CSS frozen** badge, and
* the renderer seeks each scene to its **finished** state instead of `t`, so the
  overlay shows the complete artwork rather than an empty first keyframe.

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
