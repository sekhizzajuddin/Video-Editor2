# AI Background Cutout — "Not Smooth" Root-Cause Analysis & Fix

> Reported: *"Background cutout is not smooth, doesn't work like CapCut."*

This document records the investigation of the AI cutout pipeline
(`src/utils/aiBackground.ts`, `aiBackgroundIntegrated.ts`, `rvmMatting.ts`,
`humanDetection.ts`, `temporalMaskEngine.ts`) and the fixes applied.

---

## TL;DR

Seven independent defects stacked on top of each other. The two that mattered
most:

1. **The "CapCut-grade" RVM matting engine never actually ran.** A `float16`
   container bug meant it was either *disabled* (browsers without native
   `Float16Array`) or *fed garbage* (browsers with it). Every user was silently
   falling back to the MediaPipe selfie segmenter, whose landscape model emits a
   **256×144** matte — upscaled 7.5× to 1080p. That is the blocky, crawling edge
   users see.
2. **Mask playback was nearest-neighbour, not interpolated.** Mattes were
   inferred at 10/sec, each one *held* for 100 ms, and the "temporal blend" that
   was supposed to smooth the gaps was mathematically wrong and almost never
   fired. The matte therefore visibly *stepped* 10 times a second while the
   subject moved continuously.

---

## Defect 1 — RVM float16 tensors were built wrong (`rvmMatting.ts`)

ONNX Runtime Web chooses the *container* for `float16` tensors at runtime
(`onnxruntime-common/tensor-impl-type-mapping.js`):

```js
const isFloat16ArrayAvailable = typeof Float16Array !== 'undefined' && Float16Array.from;
if (isFloat16ArrayAvailable) MAP.set('float16', Float16Array);   // holds REAL values
else                        MAP.set('float16', Uint16Array);     // holds RAW half BITS
```

The old code did both things at once:

```ts
const out = new Float16Array(src.length);
for (...) out[i] = toHalf(src[i]);   // ← stores the BIT PATTERN in a real-valued array
```

`toHalf(1.0)` is `15360`. Written into a native `Float16Array` that stores the
*number* 15360, not 1.0. Every pixel fed to the network was nonsense, and the
`pha` output was read back through `halfToFloat()` which mangled it a second
time. Result: near-zero coverage → the pipeline decided "no subject" → fell
through to MediaPipe on every single frame.

And on browsers with **no** native `Float16Array` (Safari, Firefox):

```ts
export function isRVMSupported() {
  return typeof window !== 'undefined' && typeof Float16Array !== 'undefined';
}
```

…RVM was switched off entirely, even though ORT explicitly supports the
`Uint16Array` path.

**Fix:** probe once which container ORT will use and build/read tensors to
match — real values for native `Float16Array`, raw half bits in a `Uint16Array`
otherwise. `isRVMSupported()` now returns true in both cases.

## Defect 2 — RVM `downsample_ratio` starved the network

RVM's `downsample_ratio` is relative to the *input* it is given, and the model's
Deep Guided Filter refines the result back up to the input resolution. Feeding a
512 px input with `ratio = 0.375` ran the encoder at **192 px**. The published
guidance targets ~256–320 px internally.

**Fix:** `ratio = clamp(272 / longestSide, 0.25, 1)` so the encoder always sees
its designed working resolution, and the matte tiers were raised to
512 / 768 / 1024.

## Defect 3 — Temporal interpolation was broken in four separate ways

`applyPreRenderedMaskIfAvailable()`:

```ts
const inferenceFps = (modelSelection === 0 || modelSelection === 1) ? 20 : 10;
const interval  = 1 / inferenceFps;
const prevKey   = timeToKey(currentVideoTime - interval * 0.5);
const nextKey   = timeToKey(currentVideoTime + interval * 0.5);
const localT    = (currentVideoTime % interval) / interval;
```

* `inferenceFps` was *guessed from the model id* while the producer used a
  completely different rate (RVM always ran at 10 fps). Wrong bracket width.
* Neighbouring cache slots were deliberately **filled with the same object**
  (`fillRatio`), so `prevMask !== nextMask` was usually false → no blend at all.
* `localT` used `time % interval`, i.e. the phase against an absolute grid, not
  the position *between the two keyframes actually found*.
* The blend used `globalAlpha` + `source-over`, which is **not** a linear alpha
  mix: `a = t·a₂ + (1−t)·a₁ − t·a₂·(1−t)·a₁`. Mid-blend the matte thins out, so
  even when it did fire it pulsed.
* It was gated behind `isPlaying`, so scrubbing and paused frames always snapped.

**Fix:** keyframes are now stored *sparsely* at their true timestamps with a
cached sorted index. Sampling does a binary search for the two bracketing
keyframes, computes the exact weight, and mixes them with
`globalCompositeOperation = 'lighter'` — which for a white-RGB matte is an exact
linear alpha interpolation (`a = (1−t)·a₁ + t·a₂`). It runs whether playing,
paused or scrubbing.

## Defect 4 — The skin-tone gate hard-cut the matte (visible strobing)

`applyAiBackgroundSmart()` step 1:

```ts
const human = detectHumanPresence(...);
if (!human.hasHuman) return;   // ← composites NOTHING: full background snaps back
```

A 64×36 skin-ratio heuristic with a 0.8 % threshold decided, *per rendered
frame*, whether the cutout existed. Subject turns away, dim lighting, a hand
leaving frame, a non-human subject — the matte vanishes for a frame and returns
the next. That is the on/off strobing.

**Fix:** the heuristic is now only an *inference scheduling hint* — it can make
us skip an expensive re-segmentation, it can never remove an existing matte.
When the segmenter genuinely reports an empty frame for several consecutive
inferences, the cutout **dissolves** over ~110 ms via the cross-fade track
instead of snapping.

## Defect 5 — Per-frame full-resolution pixel loops (playback stutter)

The stock panel defaults are `choke: -1, edgeBlur: 2`, so `choke !== 0` was true
out of the box and `refineMaskEdges()` ran **every frame**:

```ts
const imgData = tCtx.getImageData(0, 0, width, height);  // width/height = CLIP size
for (let i = 3; i < data.length; i += 4) { ... }         // ~2M px at 1080p
tCtx.putImageData(imgData, 0, 0);
```

A full `getImageData` → JS loop → `putImageData` round-trip at clip resolution,
plus a full-resolution `ctx.filter = blur()`, on every single frame. That alone
blows the 16 ms budget.

`humanDetection.ts` additionally allocated **two new `<canvas>` elements per
frame per clip** (`createSampleCanvas` inside both `detectHumanPresence` and
`computeLuminanceHistogram`), producing constant GC churn.

**Fix:**
* Choke/feather moved to `matteEngine.refineMatte()`, which works at a capped
  work resolution (≤1024 px) and implements choke as GPU alpha-power passes
  (`destination-in` ⇒ `αⁿ` to erode, `source-over` ⇒ `1−(1−α)ⁿ` to dilate) —
  **zero pixel loops**.
* `humanDetection` reuses module-level scratch canvases.
* Cache validity is now time-based (ms) instead of frame-count based, so it
  behaves the same at 24 fps and 60 fps.

## Defect 6 — Newly-arrived mattes popped in

The live (non-pre-rendered) path swapped the cached matte the instant inference
finished. Between two inferences the subject has moved several pixels, so the
matte jumped. Combined with the 250–700 ms refresh interval this reads as a
juddering outline.

**Fix:** `LiveMatteTrack` keeps the previous and current matte in dedicated
ping-pong buffers and cross-fades between them over ~110 ms, so an arriving
matte eases in instead of snapping. Seeks reset the track so scrubbing stays
crisp.

## Defect 7 — Quality losses on the way to the screen

* Matte upscales used the default (`low`) `imageSmoothingQuality`.
* `createImageBitmap(imageData)` results were re-drawn through intermediate
  canvases repeatedly.
* Preview and export each had their own ~80-line copy of the four cutout
  composite modes, so they could — and did — drift apart.

**Fix:** a single `compositeCutout()` in `matteEngine.ts` is used by the preview
engine, the smart orchestrator and the export compositor, and every matte draw
goes through `drawMatte()` which forces `imageSmoothingQuality = 'high'`.

---

## New module: `src/utils/matteEngine.ts`

| Export | Purpose |
| --- | --- |
| `pickBracket(times, t)` | Pure binary search → `{ i0, i1, w }` for keyframe interpolation |
| `bracketWeight(t0, t1, t)` | Pure, clamped interpolation weight |
| `lerpMatte(a, b, w, key)` | Exact linear alpha mix via `lighter` |
| `refineMatte(m, choke, feather, …)` | GPU choke/feather at capped work resolution |
| `compositeCutout(…)` | The four cutout modes (remove / blur / outline / color) |
| `LiveMatteTrack` | Per-clip ping-pong buffers + cross-fade for live inference |
| `chokePasses`, `featherRadius`, `boxBlurAlpha` | Pure kernels (unit tested) |

Unit tests live in `src/utils/matteEngine.test.ts` and cover the pure maths —
bracket selection, weights, choke-pass mapping and the alpha box blur.

---

## Behavioural summary

| | Before | After |
| --- | --- | --- |
| Matte engine actually used | MediaPipe 256×144 (RVM silently dead) | RVM 512–1024 px with recurrent memory |
| Matte updates during playback | 10/s, held (nearest neighbour) | 12–20/s keyframes, **linearly interpolated every frame** |
| Empty-frame handling | Instant on/off snap | 110 ms dissolve |
| Choke/feather cost | `getImageData` + JS loop at 1080p, every frame | GPU passes at ≤1024 px, no readback |
| Canvas allocations per frame | 2 per clip | 0 |
| Interpolation while paused/scrubbing | disabled | enabled |
| Preview vs export composite | two copies | one shared implementation |
| Pre-render on a slow machine | fixed tier, no escape hatch | one-shot governor downshifts 768 → 512 @ 10 fps |
| Portrait blur cost at 1080p | 3 × 8 MB surfaces, 2 full-res blurs | ≤ 960 px plates, ~4× fewer pixels |
| Seek / scrub | stale silhouette dragged forward | all frame-to-frame state cleared in one call |
| Matte upscale filtering | `imageSmoothingQuality: 'low'` | forced `'high'` in `drawMatte()` |

---

## Defect 8 — Analysis could pick a tier the machine cannot sustain

`modelSelection` is hard-coded to `2` when the user enables the feature
(`PropertiesPanel.tsx`) and **there is no UI to change it**, so whatever tier
"quality 2" maps to is the tier *every* user gets. Running the pre-render pass
at RVM 1024 therefore meant a ~10 s clip could take 24–48 s to analyse on a
mid-range laptop, which reads as "the feature is broken".

Fixed in `startClipBackgroundAnalysis` with a one-shot **quality governor**:

```
initial:  rvmTier = modelSelection === 2 ? 768 : modelSelection === 1 ? 768 : 512
          inferenceFps = RVM 12 | MediaPipe 20 | IS-Net 8

after GOVERNOR_SAMPLE (4) RVM keyframes:
    if mean frame time > SLOW_FRAME_MS (320 ms) and rvmTier > 512
        rvmTier      = 512
        inferenceFps = 10
        totalKeyframes recomputed, progress stays monotonic
```

It only ever **downshifts**, and only once (`governorApplied`). Upshifting is
deliberately not allowed: changing `infW`/`infH` resets RVM's recurrent hidden
state, so an fps/size oscillation would inject a visible hitch at every switch.

The keyframe loop was also converted from an index-derived timestamp
(`startTime + i / inferenceFps`) to an explicit `cursor` accumulator:

```ts
for (let guard = 0; cursor <= endTime && guard < 20000; guard++, cursor += 1 / inferenceFps) { … }
```

With the old form, changing `inferenceFps` mid-run retroactively re-scaled every
future timestamp and tore a hole in the matte track exactly where the governor
fired.

---

## Defect 9 — Portrait blur was paying full resolution for a destroyed image

`blur` mode built its backdrop at clip resolution: at 1080p that is three
8 MB scratch surfaces plus two full-frame `filter: blur()` passes per frame.

The backdrop is about to be annihilated by a 12 px blur, so the detail is
thrown away anyway. `compositeCutout` now builds it at `BG_PLATE_MAX = 960 px`
on the longest side and scales the blur radius to match:

```
pScale = min(1, 960 / max(width, height))
pBlur  = blurStrength * pScale
```

At 1080p that is ~4× fewer pixels and ~16 MB less scratch memory per clip, for
an output that is pixel-indistinguishable after the upscale.

### Halo removal (kept from the rewrite)

A single blurred copy of the frame leaves a smeared ghost of the subject around
the silhouette — the classic giveaway of a cheap portrait blur. The composite
therefore blurs a **plate with the subject punched out** (`destination-out`) and
lays it over the blurred base, so the hole around the subject fills with real
background instead of the subject's own colours.

---

## Context hygiene

`compositeCutout` writes into a context it does not own (the renderer's
per-clip offscreen in preview, the compositor's temp canvas in export).
Two rules are enforced:

* `resetDrawState(ctx)` resets `globalAlpha`, `globalCompositeOperation`,
  `filter` and image smoothing — but **never the transform**. Clearing the
  caller's matrix would silently move everything drawn after the cutout.
* `resetCtx(ctx)` (transform included) is used only on surfaces the matte
  engine itself pooled.

`drawMatte()` always forces `imageSmoothingQuality = 'high'` before scaling a
matte up to clip resolution, which is where the original stair-stepping came
from — mattes are computed at 256–1024 px and stretched.

---

## Discontinuity handling

Everything that remembers the previous frame is cleared through one function so
the pieces cannot drift apart:

```ts
invalidateClipMatteContinuity(clipId)
  ├── resetLiveTrack(clipId)          // cross-fade ping-pong buffers
  ├── liveTrackTime / liveTrackStamp  // the timestamps they are anchored to
  ├── resetRVMState(clipId)           // RVM recurrent hidden state
  ├── resetTemporalMaskState(clipId)  // per-pixel EMA (MediaPipe rung)
  └── dropSurfaces('smart:…', 'livefx:…')  // refined-edge scratch
```

It is called from `applyAiBackgroundSmart` whenever the source time jumps
(back > 0.05 s, or forward > 0.5 s), and reused by
`cleanupClipBackgroundState`. Without the RVM reset in particular, a seek
smears the pre-seek silhouette into the new frame for several frames, because
RVM's hidden state literally encodes "what the subject looked like last frame".

---

## Verification

| Check | Result |
| --- | --- |
| `npx tsc -b` | Exactly the **6 pre-existing** errors from the baseline commit — no new ones |
| `npx vite build` | ✅ succeeds (`npm run build` is gated by those pre-existing `tsc` errors) |
| `npx vitest run src/utils/matteEngine.test.ts` | **37 / 37 pass** |
| `npx vitest run src` (with changes) | 6 failed / **658 passed** (664) |
| `npx vitest run src` (changes stashed) | 6 failed / 621 passed (627) |
| Net | **Same 6 pre-existing failures, +37 new passing tests, 0 regressions** |

The 6 pre-existing failures are unrelated to cutout (export-wiring warnings and
`ClipFxSettings`/`TimelineClip` type drift in the media panel and timeline drop
hook) and are deliberately left untouched.

### What the 37 unit tests cover

`matteEngine`'s pure kernels are DOM-free precisely so they can be tested in
Node: `bracketWeight` clamping, `pickBracket` binary search including the
before-first / after-last / single-key / exact-hit edges, `chokePasses`
quantisation, `featherRadius` scaling and its dead zone, `lerpAlphaPlanes`
endpoint and midpoint exactness, and `boxBlurAlpha` (in-place, alpha-only,
separable, energy-preserving, colour channels untouched).
