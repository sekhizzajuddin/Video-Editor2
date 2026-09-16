# Split Clips & Multi-Track Rendering Architecture

> Why the editor "struggled to render" after splitting a clip, what was actually
> happening under the hood, and the architecture that replaced it.

---

## 1. Symptom

After cutting a clip (Ctrl/Cmd-K) — especially when the segments end up on more
than one track, or the same media is used twice — the system degrades:

- preview becomes stuttery / permanently "buffering" around the cut points,
- export becomes dramatically slower (a 6 s sequence can take minutes),
- occasionally the export comes back black or with frozen frames.

Measured on the real export pipeline (fake WebCodecs harness, 6 s source):
**60 decode pipeline rewinds in a 6 s export** — one per output frame from the
moment a second track reuses the same media, with **178 s** of accumulated
backward seek distance.

---

## 2. Root cause

Two independent renderers were answering the same questions differently.

### 2.1 Export: one decoder per media file, used sequentially

`FrameScheduler.initializeDecoders()` created exactly **one `AssetDecoder` per
`mediaId`**. `AssetDecoder` keeps a *sequential* mediabunny `CanvasSink`
iterator alive so source packets are decoded once instead of seeked per frame —
which is only valid while requests move forward. Its guard was:

```ts
if (this.lastRequestedTime >= 0 && timestampSeconds + 0.0005 < this.lastRequestedTime) {
  this.resetIterator();       // ← sink.canvases(0): re-decode from frame 0
}
```

So as soon as two clips of the same media needed different source windows on the
same output frame — a split chain on V1 plus a copy/trim of the same media on
V2, or a segment that the user dragged — the decoder received interleaved
requests for distant positions:

```
output frame t=2.000 → requests source 2.000s and 5.000s   (same decoder)
output frame t=2.033 → requests source 2.033s and 5.033s   (same decoder)
...
```

Every second request is *behind* the other one, so every frame rewound the
pipeline, re-seeked to the file's first keyframe and re-decoded up to the target
(`O(clip length)` work per frame). On a 4K clip that is hundreds of frames of
decode per output frame: the export appears to hang.

Additionally, when the timeline was re-ordered (a split segment moved left of its
sibling) the same single decoder was asked to walk the file backwards and
forwards *by design*.

### 2.2 Preview: `<video>` element sharing by loose heuristics

`useMediaPlayback` keyed the shared `<video>` element off
`mediaId + splitGroupId`, and — when an entry was missing — fell back to
*"any video element with this mediaId"*:

```ts
if (e.mediaId === clip.mediaId && (e._shareKey?.includes(splitGroupId) || e.type === 'video'))
```

That fallback can adopt the element of an **unrelated chain** of the same file
(or of a segment on another track). Two clips then fight over one element's
`currentTime` — the preview seek-storms, and the canvas shows the wrong segment.
`CanvasRenderingEngine` had a third variant of the same heuristic
(`otherClip.mediaId === clip.mediaId && otherClip.trackId === clip.trackId`).

### 2.3 The shared missing concept

There was no single definition of *"which piece of media does this clip need, and
may it be decoded together with that other clip?"*. Splitting a clip creates N
clips from one media item, and every renderer re-derived that answer on its own.

---

## 3. Architecture

### 3.1 `src/utils/splitClipIdentity.ts` — the Split Clip ID Provider

A pure (DOM-free) module imported by the store, the preview **and** the export
worker, so all three agree by construction.

| Export | Purpose |
| --- | --- |
| `buildSplitIdentities(timeline)` | per-clip identity: chain id, ordered segment index, contiguity, timeline window, source window, `renderKey`, `shareKey`, `shareableElement` |
| `sourceWindowForClip(clip)` | the exact source range a clip samples — routed through `getMediaTimeForClip`, so flat / ramped / speed-frame / reversed / frozen clips agree with the preview |
| `renderKeyForClip(clip)` | stable cache identity: `chain:<chainId>:<mediaId>:<start>-<end>` (content-derived, survives clip-id churn) |
| `shareKeyForClip` / `shareableElement` | whether a `<video>` element (and a decoder) may be shared with siblings: only when the whole chain is contiguous **and** on one track |
| `restampSplitChains(timeline)` | writes `splitGroupId` + `splitSegmentIndex` in timeline order; called by the store after every split |
| `splitChainSiblings` / `adjacentSplitSibling` | sibling lookup for the preview's element reuse |
| `planDecodeStreams(timeline, {maxStreamsPerMedia})` | groups clips into **decode streams** that one sequential decoder can serve without ever rewinding |
| `canShareDecodeStream(a, b)` | the pairwise rule, exported for tests/diagnostics |

Planning rules (deliberately conservative — a wrong *share* costs a rewind, an
extra stream only costs one decoder session):

1. clips overlapping on the timeline never share a stream,
2. clips whose source windows are not monotonic never share,
3. reversed and forward clips never share,
4. contiguous split segments on one track **do** share (crossing a cut is free),
5. per-media stream count is capped (`maxStreamsPerMedia`, default 4); beyond
   that the nearest compatible stream is reused and flagged `shared: true`.

### 3.2 Export worker: decode streams + pipelining

```
             ┌───────────── Split Clip ID Provider ─────────────┐
             │  identities · shareKeys · decode-stream plan     │
             └───────┬─────────────────────────┬────────────────┘
                     │                         │
      ┌──────────────▼───────────┐   ┌─────────▼─────────────────────┐
      │ Preview (main thread)    │   │ Export worker                 │
      │ one <video> per shareKey │   │ one AssetDecoder per stream   │
      │ strict sibling adoption  │   │ requests sorted per stream    │
      └──────────────────────────┘   │ 1-frame decode prefetch       │
                                     └───────────────────────────────┘
```

- `initializeDecoders()` builds the stream plan and creates **one
  `AssetDecoder` per stream** (`stream:<mediaId>#<n>`), not per media file.
  Stills are shared across their streams through a single `StillImageSource`.
- Within one output frame, requests are queued and executed **per stream in
  ascending source order** (`decodeRequests`), so a multi-layer frame can never
  ask one decoder for two positions in a random order. Different streams still
  run concurrently (existing concurrency tests keep passing).
- `prefetchAtTime(t + 1/fps)` starts the next frame's decode while the current
  frame is composited and encoded — decode, composite and encode overlap instead
  of running serially.
- `evictExpiredDecoders()` is stream-aware and keeps decoders for clips that are
  still ahead; decode telemetry of evicted streams is retained.
- The worker reports per-stream telemetry in its `COMPLETE` message
  (`decodeStats`): `backwardSeeks` must be **0** on a split timeline.

### 3.3 `AssetDecoder`: seek instead of rewind, with a frame window

- Requests are serialized (`decodeTail`) as before.
- `openIteratorAt(t)` positions the iterator at `t - backoff`; mediabunny seeks
  to the preceding keyframe, so a jump costs one GOP — **never the whole file**.
- A backward jump beyond the recent-frame window re-positions **once**, at the
  requested time (it no longer resets to `0`).
- A long **forward** jump also re-positions instead of decoding through every
  intermediate frame.
- A contiguous ring of the last `poolSize - 2` yields is served from cache;
  because the sink recycles canvases in a ring, entries older than that are
  dropped rather than returned stale.
- `stats` (`requests`, `cacheHits`, `sequentialFrames`, `seeks`, `backwardSeeks`)
  is exposed for tests and the export report.

### 3.4 Preview: one element per chain, strict adoption

- The `<video>` pool keys elements off the provider's `shareKey`
  (`<mediaId>::chain:<id>::track:<t>`), so a chain that was re-ordered, gapped or
  spread over tracks automatically falls back to per-clip elements.
- Sibling adoption (pool reconciliation, sync loop, scrubbing loop) matches the
  **exact** share key; the "any element of this media" fallback is gone.
- `CanvasRenderingEngine` only reuses frames from a clip of the **same**
  `splitGroupId`.

### 3.5 Store

`splitClip` re-stamps the whole chain after building the halves
(`restampSplitChains`), so `splitSegmentIndex` always matches timeline order even
after repeated splits, and both halves share one `splitGroupId`.

---

## 4. Tests that lock this in

| Suite | What it proves |
| --- | --- |
| `src/utils/splitClipIdentity.test.ts` (27) | identity/contiguity/shareability rules, ordering, budget behaviour, reversal isolation |
| `src/store/splitClipIdentity.test.ts` (5) | the store stamps one chain id + ordered indexes, source stays continuous across cuts, and a moved segment stops sharing |
| `src/export/engine/splitMultitrackRender.test.ts` (4) | real worker + fake WebCodecs: split chain + second track on the same media renders every frame at the right source time with **`backwardSeeks: 0`** per stream; 5-way split chain samples continuous source; re-ordered segments still render; the black-export guard still fires |
| `src/export/engine/assetDecoderSelection.test.ts` (2) | monotonic pass = 0 seeks, repeat/small rewind = cache hits, real jump = exactly one re-position at the target |
| `src/export/engine/exportScenarios.test.ts` (14) | pre-existing scenario sweep (unchanged behaviour) |
| `src/export/engine/exportManagerWiring.test.ts` (1) | end-to-end main-thread → worker → muxer handoff produces a non-black MP4 |

Shared test harness: `src/export/engine/testFakes/exportHarness.ts`
(fake WebCodecs + real in-memory MP4 + `markerUs()` read-back of which source
frame each output frame drew).

---

## 5. Tuning knobs

| Knob | Where | Effect |
| --- | --- | --- |
| `maxStreamsPerMedia` (default 4) | `FrameScheduler` / `planDecodeStreams` | decoders per media file; raise for timelines with many simultaneous segments, lower on memory-constrained devices |
| `poolSize` (8), `cacheCapacity` (`poolSize - 2`) | `AssetDecoder` | canvases kept alive; bounds the "free" rewind window |
| `seekBackoff` (50 ms) | `AssetDecoder` | safety margin when re-positioning (absorbs rounding at cut points) |
| `forwardSeekThreshold` (0.75 s) | `AssetDecoder` | forward distance beyond which a re-seek beats decoding through |
| prefetch depth (1 frame) | `export.worker` | decode/composite/encode overlap |
| `STARVATION_GRACE_MS` (700) | `utils/previewStarvation` | how long a starving preview element may pause the clock (normal re-buffer) before the freeze is refused |
| `STARVATION_HARD_LIMIT_MS` (4000) | `utils/previewStarvation` | stall age past which recovery escalates from `seek` to `reload` |
| `RECOVERY_COOLDOWN_MS` (600) | `utils/previewStarvation` | minimum spacing between recovery attempts on the same clip |
| `MAX_RECOVERY_ATTEMPTS` (3) | `utils/previewStarvation` | attempts before the clip is declared degraded (logged once, playback continues) |

---

## 6. Verifying after a change

```bash
npx vitest run src/export src/store src/utils/splitClipIdentity.test.ts src/utils/previewStarvation.test.ts
```

The assertion that matters for this architecture is the last one in
`splitMultitrackRender.test.ts`:

```ts
for (const stream of stats) {
  expect(stream.stats.backwardSeeks, `stream ${stream.streamId} rewound`).toBe(0);
}
```

A non-zero `backwardSeeks` on a timeline whose clips only move forward means
either the stream planner mis-grouped two clips, or the requests are being issued
out of order — both regressions of the invariants described above.

---

## 7. Preview starvation watchdog (why the spinner used to latch)

Splitting a clip mid-playback briefly re-keys the preview's `<video>` pool: a
sibling element is adopted/re-seeked and, depending on timing, the old source
can be revoked or the decoder dropped. The render loop derived its buffering
state from a plain predicate — *any* active element with a pending `seeking`, or
`readyState < 2` while carrying a `src` — and froze the clock whenever that was
true (`PreviewCanvasContainer`). With no watchdog, one element that could never
finish loading kept `isBuffering` true forever: the clock never advanced, the
clip never re-entered the active window, and nothing ever retried it. That is the
"continuous buffering after split" latch, and it is independent of the decode
identity work in §3 — those two bugs had to be fixed together.

The gate is now a bounded policy in `src/utils/previewStarvation.ts`:

* **Grace, then never gate.** A starving element may hold the clock for
  `STARVATION_GRACE_MS` (normal re-buffer stays smooth), after which the gate
  opens. Seeks already in flight are not mistaken for stalls — `isElementStarved`
  only counts an element as starving when its pending seek has gone stale or it
  has no data at all while a real `src` is set.
* **Escalating recovery.** Each clip's stall is timed; recovery runs at most once
  per `RECOVERY_COOLDOWN_MS`, first as a `seek` tier (re-issue
  `currentTime = target` to break a `seeking` that will never complete), then as a
  `reload` tier (`assignClipMediaSrc(el, shareKey, media.url)` + `load()` +
  re-seek) once the stall passes `STARVATION_HARD_LIMIT_MS`.
* **Degrade instead of hang.** After `MAX_RECOVERY_ATTEMPTS` the clip is reported
  once via `describeDegradedClip` and dropped from the gate entirely. One broken
  segment loses its own frames; it can no longer hold the whole timeline's
  transport hostage.
* **Cleanup.** Timers/attempt counts are pruned when a clip leaves the pool, and
  the whole map is cleared when playback pauses or scrubbing starts.

Measured with fault injection (blob URL revoked mid-playback right after a split),
base commit vs this one:

| | base `5cddd26f` | with watchdog |
| --- | --- | --- |
| clock at break | 0.53 s | 0.55 s |
| clock after 30 s | 0.53 s (frozen) | 9.20 s |
| buffering samples after break | 363 / 363 | 11 / 56 (transitional) |
| outcome | spinner forever | recovered, playback continues |

Related: `FrameStripOverlay` no longer generates a filmstrip while playing. The
generator opens its own `<video>` and fires eight seeks, which during a split
competed with the preview for the same decoders; it now waits for pause.
