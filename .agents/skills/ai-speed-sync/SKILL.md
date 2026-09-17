---
name: ai-speed-sync
description: >-
  Sync a video clip's playback speed to a TTS (Text-to-Speech) voiceover so
  lip-sync and pacing match. Use when the user says "sync video with TTS",
  "speed sync", "match video to voiceover", "AI speed sync", "audio video
  sync", or reports that video and TTS audio are out of sync. Also use when
  debugging speed-frame alignment, TTS sentence splitting, or Gemini model
  cascade failures in the AI Speed Sync flow.
---

# AI Speed Sync — Video ↔ TTS Voiceover Alignment

Synchronizes a video clip's playback speed to match a separate TTS voiceover audio clip. The system extracts audio, sends both tracks to Gemini for word-level transcription, then deterministically aligns word timings into speed frames that ramp the video's playback rate to match the TTS cadence.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  AiSpeedSyncModal (UI)                          │
│  clip selection → options → progress → result breakdown         │
└───────────────┬─────────────────────────────────────────────────┘
                │ calls
                ▼
┌─────────────────────────────────────────────────────────────────┐
│            syncVideoClipWithTts() — orchestrator               │
│  1. Validate clips (same media, linked, silence)                │
│  2. extractClipAudioToWav() × 2                                │
│  3. runGeminiSpeedSync() → word timings + sentences             │
│  4. AI verdict validation (ttsHasSpeech, sameContent)           │
│  5. detectTtsExtraSentences() → optional splitClip()            │
│  6. buildAnchorsFromWordTimings() or fall back to AI anchors    │
│  7. buildSpeedFramesFromAnchors() → SpeedFrame[]                │
│  8. store.updateClip() + store.saveSnapshot()                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| [`aiSpeedSync.ts`](file:///d:/Video-Editor/src/utils/aiSpeedSync.ts) | Core engine: all sync logic, types, Gemini call, alignment algorithms |
| [`AiSpeedSyncModal.tsx`](file:///d:/Video-Editor/src/components/AiSpeedSyncModal.tsx) | React modal UI: clip selection, options, progress, result display |
| [`speedRamp.ts`](file:///d:/Video-Editor/src/utils/speedRamp.ts) | Speed frame geometry: `calculateSpeedFramesRamp`, `getSpeedFrameSegments` |
| [`editorStore.ts`](file:///d:/Video-Editor/src/store/editorStore.ts) | Zustand store: `splitClip()`, `updateClip()`, `saveSnapshot()` |
| [`aiSpeedSync.test.ts`](file:///d:/Video-Editor/src/utils/aiSpeedSync.test.ts) | Unit + integration tests (18 tests) |

---

## Core Types

```typescript
// A timing anchor mapping a video moment to a TTS moment
interface SyncAnchor {
  videoTime: number;   // seconds from video clip trimmed start
  ttsTime: number;     // seconds from TTS clip trimmed start
  phrase?: string;
  targetSpeed?: number;
  matched?: boolean;   // true = came from word-level matching
  stretch?: boolean;   // true = trailing hold frame
}

// Word-level timing from Gemini transcription
interface SyncWordTiming {
  word: string;
  time: number;  // seconds from audio slice start
}

// Sentence breakdown from Gemini
interface SpeedSyncSentence {
  text: string;
  startTime: number;
  endTime: number;
}

// Result of TTS extra sentence detection
interface TtsExtraSentenceDetection {
  hasMoreSentences: boolean;
  matchingCutoffTime: number; // seconds where video dialogue ends in TTS
  matchingSentenceCount?: number;
  totalTtsSentences?: number;
  reason?: string;
}

// Final result returned to the UI
interface AiSpeedSyncResult {
  videoClipId: string;
  ttsClipId: string;
  anchors: SyncAnchor[];
  speedFrames: SpeedFrame[];
  segments: SpeedFrameSegment[];
  newDuration: number;
  successfulModel: string;
  alignmentMode?: 'word-level' | 'ai-anchors';
  verdict?: SpeedSyncVerdict;
  stretchFrameCount?: number;
  ttsSplitApplied?: boolean;
  ttsSplitPoint?: number;
  ttsRemainingClipId?: string;
  matchingSentenceCount?: number;
  totalTtsSentences?: number;
  splitReason?: string;
}
```

---

## Pipeline Steps (Detailed)

### Step 1: Pre-flight Validation

Before any API call, the orchestrator rejects invalid clip pairs:

| Check | Error Condition |
|-------|----------------|
| Same media ID | `ttsClip.mediaId === videoClip.mediaId` |
| Same clip ID | `ttsClip.id === videoClip.id` |
| Linked clip | `ttsClip.linkedClipId === videoClip.id` (unlinked original audio) |

### Step 2: Audio Extraction (`extractClipAudioToWav`)

Extracts a **16kHz mono WAV** slice corresponding to the clip's trimmed source range:

1. Fetch media URL → fallback to IndexedDB (`getFileFromDB`)
2. Decode with `AudioContext.decodeAudioData()`
3. Render to `OfflineAudioContext` at 16kHz mono
4. Convert to WAV blob via `audioBufferToWav()`
5. Compute RMS energy (speech threshold > 0.005)

> [!IMPORTANT]
> The source span respects `speedFrameSourceEnd` if present (from previous speed sync), falling back to `duration × speed`. This ensures re-syncing a previously synced clip uses the correct source range.

### Step 3: Gemini Multimodal Analysis (`runGeminiSpeedSync`)

**Model cascade** (in order, falls through on HTTP error):
1. `gemini-3.5-flash-lite` (default, fastest)
2. `gemini-3.5-flash-preview`
3. `gemini-3.1-flash-lite`
4. `gemini-3.8-flash`
5. `gemini-2.5-flash` (safety fallback)

**Prompt structure** (dual-audio mode):
- Sends two WAV audio blobs as `inlineData` parts
- Requests word-level transcription of BOTH audios as `videoWords` and `ttsWords`
- Requests sentence breakdown as `videoSentences` and `ttsSentences`
- Requests `ttsHasMoreSentences` flag and `matchingCutoffTtsTime`
- Requests a `verdict` object for wrong-audio detection
- Requests 3–10 fallback anchor points with `targetSpeed` hints
- Uses `temperature: 0.2` and `responseMimeType: 'application/json'`

**Single-audio mode** (video has no audio track):
- Only sends TTS WAV blob
- Distributes speed anchors based on TTS cadence/pauses/emphasis

**Response sanitization**:
- Words capped at 600, timestamps validated finite & in-bounds
- Sentences capped at 100, validated `startTime < endTime`
- Anchors must be strictly chronological with ≥0.05s gaps
- If < 2 valid anchors, generates 3 evenly-spaced fallback anchors

### Step 4: AI Verdict Validation

| Verdict Field | Action |
|---------------|--------|
| `ttsHasSpeech === false` | **Reject** — wrong clip (music/silence selected) |
| `sameContent === true` | **Conditional** — only reject if duration diff < 0.05s AND all word timestamps identical (< 0.04s difference). Otherwise proceed (it's a separate TTS reading the same script) |
| `videoHasSpeech === false` | **OK** — silent AI-generated video; TTS-cadence pacing works |

### Step 5: Sentence Detection & TTS Splitting (`detectTtsExtraSentences`)

Three-tier detection for when TTS has more dialogue than the video:

**Tier 1 — Explicit sentence counts:**
If `ttsSentences.length > videoSentences.length`, split at the pause midpoint between the last matching sentence and the next TTS sentence.

**Tier 2 — AI flag:**
If Gemini reports `ttsHasMoreSentences === true` with a valid `matchingCutoffTtsTime`, use that directly.

**Tier 3 — Word-level analysis:**
- Run the same word-matching loop as `buildAnchorsFromWordTimings`
- If video words are "near complete" (≥65% matched or within 2 words of end) AND TTS has ≥3 trailing words with ≥0.8s remaining duration OR sentence-ending punctuation at the boundary, declare extra sentences
- Split point: midpoint of the pause gap after the last matched word

**When TTS is split:**
- `store.splitClip(ttsClipId, splitTimelineTime, saveHistory: false)` — returns `{ leftId, rightId }`
- Left clip (matching portion) becomes `activeTtsClip` for speed frame calculation
- Right clip (remaining TTS) stays on timeline for next clip
- Anchors are filtered to exclude stretch frames and timestamps beyond the split point

### Step 6: Word-Level Anchor Building (`buildAnchorsFromWordTimings`)

**Algorithm:**
1. Normalize words: lowercase, strip punctuation
2. Forward cursor through TTS words, for each: lookahead ±3 video words for a match
3. On match: create anchor `{ videoTime, ttsTime, matched: true }`
4. Unmatched TTS words (filler): skipped — linear interpolation through surrounding anchors handles them
5. **Trailing hold**: if TTS continues after video's last matched word, insert a `stretch: true` anchor that slowly creeps through remaining video content instead of rushing

**Fallback:** If < 2 word-level anchors, falls back to Gemini's AI cadence anchors.

### Step 7: Speed Frame Calculation (`buildSpeedFramesFromAnchors`)

Converts `SyncAnchor[]` → `SpeedFrame[]`:

```
SpeedFrame {
  id: string;              // unique ID
  timelineOffset: number;  // seconds in output timeline (≈ ttsTime)
  sourceTime: number;      // seconds in source media (≈ trimStart + videoTime)
}
```

- Clamps offsets to `[0.05, newDuration - 0.05]`
- Clamps source times to `[trimStart + 0.02, fixedSourceEnd - 0.02]`
- Requires monotonically increasing values with ≥0.05s offset gaps
- `newDuration` = TTS clip duration (or split portion)
- `fixedSourceEnd` = original source media end point (preserved across re-syncs)

Speed ramp curve is computed by `calculateSpeedFramesRamp()` for preview visualization.

### Step 8: Store Update

```typescript
store.updateClip(videoClip.id, {
  ...videoClip,
  startTime: alignStart ? activeTtsClip.startTime : videoClip.startTime,
  duration: newDuration,
  speedFrames,
  speedFrameSourceEnd: fixedSourceEnd,
  audioSettings: muteOriginal ? { ...existing, volume: 0, muted: true } : existing,
});
store.saveSnapshot(ttsSplitApplied
  ? 'AI Speed Sync (Split TTS & Applied Speed Frames)'
  : 'AI Speed Sync with TTS'
);
```

> [!WARNING]
> Audio settings spread order matters: `{ ...existingSettings, volume: 0, muted: true }` — the mute overrides MUST come AFTER the spread to avoid letting pre-existing custom volume survive.

---

## User Options

| Option | Default | Effect |
|--------|---------|--------|
| Align Start Time | `true` | Move video clip's startTime to match TTS clip's startTime |
| Mute Original Audio | `true` | Zero out video clip's audio volume so TTS is isolated |
| Target Model | `gemini-3.5-flash-lite` | Preferred Gemini model (cascade still applies on failure) |

---

## Common Failure Modes & Solutions

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| HTTP 404 on first model | Model name deprecated or not available in v1beta | Cascade handles this automatically; ensure `gemini-3.5-flash-lite` is first in `GEMINI_SPEED_SYNC_MODELS` |
| "same audio" false positive | AI reports `sameContent: true` for a valid TTS with same script | Duration + word-timing differentiation prevents false rejection |
| "TTS clip does not contain speech" | User selected music/SFX clip as TTS | Pre-flight RMS check (< 0.005 threshold) + AI verdict |
| Speed frames produce jittery playback | Too many close-together anchors or bad word timestamps | Anchors require ≥0.05s gaps; speed frames require monotonic values |
| Video rushes at end | TTS has more dialogue than video; trailing words compress | `detectTtsExtraSentences` splits TTS; trailing hold anchor slows final segment |
| Re-sync produces wrong duration | `speedFrameSourceEnd` lost or overwritten | Always preserve `fixedSourceEnd` from the clip's existing or computed value |

---

## Testing

Run tests with:
```bash
cmd /c npx vitest run src/utils/aiSpeedSync.test.ts
```

**Test coverage (18 tests):**
- `blobToBase64` — base64 encoding
- `extractClipAudioToWav` — audio extraction with trimming
- `runGeminiSpeedSync` — mock Gemini responses, model cascade
- `buildAnchorsFromWordTimings` — word alignment (equal, extra TTS, extra video, no match)
- `buildSpeedFramesFromAnchors` — speed frame geometry
- `syncVideoClipWithTts` — end-to-end orchestration with DI mocks
- `detectTtsExtraSentences` — sentence count, AI flag, word-level detection
- TTS split end-to-end — verifies split + filtered anchors + speed frames

---

## Modification Guide

### Adding a new Gemini model
Add the model name to `GEMINI_SPEED_SYNC_MODELS` array in `aiSpeedSync.ts:28`. Position determines priority (first = preferred).

### Changing word-matching tolerance
Edit the lookahead range in `buildAnchorsFromWordTimings` (currently ±3 words, line ~542).

### Adjusting trailing hold behavior
Edit the trailing hold section in `buildAnchorsFromWordTimings` (line ~576). `trailing * 0.15` controls how much video content is consumed during the hold.

### Adjusting TTS split detection sensitivity
Edit thresholds in `detectTtsExtraSentences`:
- Minimum remaining words: currently 3 (line ~713)
- Minimum remaining duration: currently 0.8s (line ~713)
- Sentence boundary detection: punctuation regex at line ~704

### Changing audio sample rate
Edit the `sampleRate` parameter default in `extractClipAudioToWav` (currently 16000 Hz). Lower = smaller payload but less accuracy.

---

## Debugging Tips

1. **Console logs**: All stages print `[AiSpeedSync]` prefixed messages
2. **Word timings**: Log `analysis.videoWords` and `analysis.ttsWords` after Gemini call to verify transcription quality
3. **Alignment mode**: Check `result.alignmentMode` — `'word-level'` is preferred; `'ai-anchors'` means word matching failed (< 2 matches)
4. **Sentence detection**: Log `ttsExtraInfo` to see which tier triggered and the cutoff time
5. **Speed frame inspection**: After `buildSpeedFramesFromAnchors`, verify `speedFrames` are monotonically increasing in both `timelineOffset` and `sourceTime`
6. **DI testing**: `syncVideoClipWithTts` accepts `_extractAudio` and `_runGemini` parameters for dependency injection in tests
