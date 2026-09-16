# Video Codec Support & the "black clip" silent failure

## Symptom

A clip imports normally — correct name, duration, and a thumbnail slot in the
media panel — but the preview shows nothing where it should be, and exporting
produces a file whose video track is missing that clip's frames. No error is
reported anywhere: not on import, not on playback, not in the console.

Reported as: *"Is this an HEVC codec support issue for rendering high quality videos?"*
It is — and it is the failure mode the app previously had no way to report.

## Why the app could not see it

A browser only decodes the codecs its platform ships. HEVC/H.265 is the one that
matters in practice: iPhones, most Android phones and many mirrorless cameras
record it by default, and a desktop Chrome/Firefox without HEVC hardware support
cannot decode it at all (nor can any browser without a licensed decoder).

When that happens the `<video>` element is *not* broken in any way the editor can
observe. Measured in a browser without HEVC support (Chromium, headless):

```
container duration  : 10 s      ← correct
readyState          : 4         ← HAVE_ENOUGH_DATA, "fully loaded"
paused              : false
currentTime         : advances (3.56 s)   ← the transport runs
videoWidth/Height   : 0 × 0     ← and not a single frame is ever decoded
```

So every health check the app has says the media is fine:

* the pool sees an element with `readyState 4`, so it never retries,
* the buffering predicate is false, so the playhead keeps moving,
* `drawImage(video)` paints nothing, so the clip renders as an empty layer,
* `captureVideoFrame()` returns a black thumbnail (1.5 KB vs 7.5 KB for the same
  content encoded as H.264), which is also why the timeline filmstrip is black.

Measured difference, same source content, same 640×360/30 fps encode, only the
codec differs:

| | H.264/AVC | HEVC/H.265 |
| --- | --- | --- |
| probe width × height | 640 × 360 | **0 × 0** |
| pool element `videoWidth` | 640 | **0** |
| distinct colours in preview canvas | 45–58 | **3** (background only) |
| `acceptProbedVideo` verdict | supported | **undecodable** |

0×0 after `loadedmetadata` is the signal: the browser parsed the container but
could neither describe nor decode the video track.

## What the app does now

Detection is a pure function so it can be unit-tested (`src/utils/videoCodecSupport.ts`):

* `assessProbedVideo({ width, height, codec, hasVideoTrack })` → `{ supported, issue, codec }`.
  0×0 with a video track present is an unsupported codec; 0×0 with no video track
  gets its own message ("no video track", i.e. audio-only file).
* `undecodableVideoMessage(codec)` → one actionable sentence: what is wrong, why
  it will look black, that export will drop the frames, and what to do (convert to
  H.264/MP4, or open the project in Safari / Edge+Chrome with HEVC hardware
  decoding — HEVC is the only codec with that escape hatch).
* `undecodableExportMessage(codec)` → names the codec in the WebCodecs failure.
* `shortCodecWarning(codec)` → the badge label.

Wiring:

| Where | What it does |
| --- | --- |
| `utils/mediaProbe.ts` (`probeVideo`) | after `loadedmetadata`, 0×0 triggers a codec inspection (`inspectVideoBlob`) and sets `decodeIssue` + `decodeCodec` on the media item — carried through `probeFile` |
| `store/editorStore.ts` (`addMedia`) | fires the warning toast once per fresh import. This is the single chokepoint: **every** import path (MediaPanel, TopToolbar, drag-and-drop, timeline drop, clip repair, settings, mobile sheet, relink…) funnels through it, so the warning cannot be missed by a new entry point that forgets to handle codecs |
| `components/MediaPanel/index.tsx` | persistent `⚠ HEVC/H.265 not supported` badge on both grid and list tiles, full message in the tooltip |
| `export/engine/VideoNormalizer.ts` | `inspectVideoBlob` now also reports `hasVideoTrack`, so audio-only files are not mislabelled as a codec problem |
| `export/engine/AssetDecoder.ts` | `loadError` becomes `Codec not supported by browser WebCodecs (HEVC/H.265)` instead of a codec-less string; `FrameScheduler` already surfaces it as an export warning |

Verified in the browser through the real import entry points:

```
TopToolbar import of HEVC  → toast: "media-hevc-hvc1.mp4: HEVC/H.265 video can't be decoded…"
TopToolbar import of H.264 → no toast, no badge
MediaPanel import of HEVC  → toast + persistent badge "⚠ HEVC/H.265 not supported"
```

## What cannot be fixed in code

If the platform has no HEVC decoder, no web app can decode that file: there is no
software HEVC decoder in browsers, and WebCodecs (`VideoDecoder`) needs the same
platform support. The only honest outcomes are (a) tell the user exactly what is
wrong, which this change does, or (b) leave bytes untouched and let the platform
decode them later on a device that can. Anything that claims to "fix HEVC" in
JavaScript is a transcode through a decoder that does not exist on that machine.

Files that *do* decode (Safari, macOS, Edge/Chrome with HEVC hardware support)
are unaffected: dimension probing succeeds and no warning is produced.

## Verifying

```bash
npx vitest run src/utils/videoCodecSupport.test.ts src/export/engine/assetDecoderSelection.test.ts
```

End-to-end, in a browser that cannot decode HEVC: import an HEVC MP4, and expect
the warning toast plus the panel badge; import an H.264 MP4 of the same content
and expect neither. Test clips can be produced with:

```bash
ffmpeg -i src.mp4 -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p hevc.mp4   # warned
ffmpeg -i src.mp4 -c:v libx264 -pix_fmt yuv420p avc.mp4                # silent
```

Both tag flavours (`hvc1`, `hev1`) fail identically when the codec is unsupported.
