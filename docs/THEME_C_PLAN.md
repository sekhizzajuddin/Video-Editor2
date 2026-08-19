# Theme C — Whole-App Smoother + Sprint Plan (S1/S2/S3)

## Audit Summary (existing code)

| Concern | Current state | Status |
|---|---|---|
| Visibility-aware RAF pause | `PreviewCanvasContainer.tsx:442-454` already implements `tabVisible` flag | ✅ partial — needs hard pause |
| `requestVideoFrameCallback` lifecycle | Implemented in `useMediaPlayback.ts:441-466` | ✅ |
| Particle pool reset on time jump | `PreviewCanvasContainer.tsx:198-204` | ✅ |
| Auto-scroll during play | `PlaybackAutoScroller.tsx:101-155` at 10 Hz store sync | ✅ |
| `useSmoothPlayback.ts` metrics | Tracked but unused for adaptive downgrade | 🟡 needs wiring |
| Memory monitor + adaptive downgrade | `RenderingOptimizations.ts` defines `getRenderQualitySettings` but never called from engine | 🔴 gap |
| `offscreenCanvasPool` reaping | Done in `PreviewCanvasContainer.tsx:179-189` | ✅ |
| Storage quota warning | None | 🔴 missing |

---

## Sprint S1 — CapCut-Grade Scrubbing Feel + Whole-App Polish (1 week)

### S1.1 — Wire `getRenderQualitySettings` into engine
**File:** `src/components/preview/CanvasRenderingEngine.ts:154`

Already partly done by previous Theme A. Now apply on every render:
```ts
const qualitySettings = getRenderQualitySettings(isPlaying, isScrubbing, 'high');
const skipExpensiveFX = qualitySettings.skipLUT || /* existing check */;
```

### S1.2 — Adaptive performance downgrade on slow frames
**New file:** `src/utils/performanceMonitor.ts`

Track rolling FPS. If dropped below 45 for >1s, flip a store flag → engine auto-drops to `quarter` quality until FPS recovers.

### S1.3 — Pause hard when tab hidden
**File:** `src/components/preview/PreviewCanvasContainer.tsx:448-454`

`tabVisible` already gates render, but `useMediaPlayback` keeps `requestVideoFrameCallback` running. Add: when hidden, fully pause all video elements + cancel rVFC handles + skip audio decode.

### S1.4 — Coalesce React render storm during scrub
Already done via `framePendingRef`. Add: `useTransition` wrapper for non-critical UI updates during scrub (ruler time tooltip, etc.) so React doesn't block the render loop.

### S1.5 — Smart auto-scroll on scrub
**File:** `src/timeline/components/PlayheadComponents.tsx:101-155`

Currently auto-scroll only runs when `isPlaying`. Extend to also auto-scroll during scrub if the playhead leaves the visible window — keeps the playhead in view without scroll jank.

### S1.6 — Throttle AI model loading
**File:** `src/utils/aiBackground.ts:345` — defer AI model download until first use; show "Optimizing preview..." toast.

### S1.7 — Empty-state progress on heavy operations
Add `Promise.resolve().then()` deferral for blocking imports on file drop.

### S1.8 — Disable LUT/chroma during scrub (already done)
Reaffirm: `skipExpensiveFX` must be true during scrub (already wired in previous turn).

---

## Sprint S2 — RAM Windowed Cache + Memory Cap (1 week)

### S2.1 — Sliding 30s window (already implemented)
`src/utils/ramWindowedBlobCache.ts` already exists from previous turn. Verify with 60-min timeline.

### S2.2 — Audio element windowed caching
Currently audio is full-file. Add `getWindowedMediaURL` integration for audio too (smaller windows: 10s for audio).

### S2.3 — Offscreen canvas pool LRU cap
`offscreenCanvasPool` is currently unbounded. Add cap (16 entries) with LRU eviction.

### S2.4 — Frame bitmap cache cleanup
`canvasEffects.ts:485` references a particle pool. Cap at 64 active particles across the timeline.

### S2.5 — `ImageBitmap` pooling
`createImageBitmap` calls create native handles. Reuse via `ImageBitmapPool` to avoid GC churn.

---

## Sprint S3 — File System Access / SSD Streaming (1 week)

### S3.1 — Persistent file handle capture (already implemented)
`src/utils/mediaFileHandle.ts` exists from previous turn. Verify drag-drop captures handles.

### S3.2 — Permission re-prompt UX
Add a "Re-link media" UI button when a handle becomes invalid (file moved/renamed).

### S3.3 — Storage monitor (already implemented)
`src/utils/storageMonitor.ts` exists from previous turn. Wire into Settings UI.

### S3.4 — Project autosave to OS file
Already done (`saveProjectToHandle`). Verify auto-save works for handle-backed projects.

### S3.5 — OPFS (Origin Private File System) for thumbnails/waveforms
Use OPFS for fast read-write of small artifacts (waveform peaks, thumbnails) — bypasses IDB overhead.

---

## Implementation Order (this turn)

1. **S1.2** — Performance monitor (new file)
2. **S1.3** — Hard pause when tab hidden
3. **S1.5** — Smart auto-scroll on scrub
4. **S2.3** — Offscreen canvas LRU cap
5. **S2.5** — ImageBitmap pool
6. **S3.2** — Permission re-prompt UX
7. **S3.3** — Wire storage monitor into Settings
