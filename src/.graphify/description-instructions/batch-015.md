# Node Description Batch 16 of 16

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the prompt below and write
your JSON answer to the answer file.

## Prompt

You are documenting nodes in a knowledge graph.
For each entry below, write ONE concise factual plain-language sentence
describing what it is or does. Use only the provided context.
For a code symbol (kind=code-symbol — a function, class, or constant),
describe what the function/symbol does based on its name, source location
and neighbors — e.g. "Resolves the configured ontology profile from graphify.yaml.".
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "utils_audioseparation_getseparationmodelabel": "getSeparationModeLabel()" | kind=code-symbol | source=utils/audioSeparation.ts:L364 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getseparationsettings": "getSeparationSettings()" | kind=code-symbol | source=utils/audioSeparation.ts:L49 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_sanitizeseparationsettings": "sanitizeSeparationSettings()" | kind=code-symbol | source=utils/audioSeparation.ts:L348 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_separationmode": "SeparationMode" | kind=code-symbol | source=utils/audioSeparation.ts:L26 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_separationsettings": "SeparationSettings" | kind=code-symbol | source=utils/audioSeparation.ts:L28 | neighbors=[audioSeparation.ts]
- "utils_beatdetection_beatdetectionresult": "BeatDetectionResult" | kind=code-symbol | source=utils/beatDetection.ts:L10 | neighbors=[beatDetection.ts]
- "utils_frameextractor_clearframecache": "clearFrameCache()" | kind=code-symbol | source=utils/frameExtractor.ts:L100 | neighbors=[frameExtractor.ts]
- "utils_frameextractor_extractframes": "extractFrames()" | kind=code-symbol | source=utils/frameExtractor.ts:L22 | neighbors=[frameExtractor.ts]
- "utils_frameextractor_framecache": "frameCache" | kind=code-symbol | source=utils/frameExtractor.ts:L9 | neighbors=[frameExtractor.ts]
- "utils_frameextractor_getcachedframes": "getCachedFrames()" | kind=code-symbol | source=utils/frameExtractor.ts:L93 | neighbors=[frameExtractor.ts]
- "utils_keyboardshortcuts_keyboardshortcutdef": "KeyboardShortcutDef" | kind=code-symbol | source=utils/keyboardShortcuts.ts:L3 | neighbors=[keyboardShortcuts.ts]
- "utils_motiontracker_point": "Point" | kind=code-symbol | source=utils/motionTracker.ts:L3 | neighbors=[motionTracker.ts]
- "utils_motiontracker_trackprogresscallback": "TrackProgressCallback" | kind=code-symbol | source=utils/motionTracker.ts:L93 | neighbors=[motionTracker.ts]
- "utils_projectpersistence_generatefilehash": "generateFileHash()" | kind=code-symbol | source=utils/projectPersistence.ts:L92 | neighbors=[projectPersistence.ts]
- "utils_speedramp_integralcache": "integralCache" | kind=code-symbol | source=utils/speedRamp.ts:L74 | neighbors=[speedRamp.ts]
- "utils_speedramp_integralcacheentry": "IntegralCacheEntry" | kind=code-symbol | source=utils/speedRamp.ts:L69 | neighbors=[speedRamp.ts]
- "utils_srtparser_parsedsubtitle": "ParsedSubtitle" | kind=code-symbol | source=utils/srtParser.ts:L1 | neighbors=[srtParser.ts]
- "utils_storyboardcompiler_storyboardchunk": "StoryboardChunk" | kind=code-symbol | source=utils/storyboardCompiler.ts:L1 | neighbors=[storyboardCompiler.ts]
- "utils_time_snaptogrid": "snapToGrid()" | kind=code-symbol | source=utils/time.ts:L26 | neighbors=[time.ts]
- "utils_titletemplates_titletemplate": "TitleTemplate" | kind=code-symbol | source=utils/titleTemplates.ts:L11 | neighbors=[titleTemplates.ts]
- "utils_waveformrenderer_waveformrenderoptions": "WaveformRenderOptions" | kind=code-symbol | source=utils/waveformRenderer.ts:L7 | neighbors=[waveformRenderer.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-015.json

Keep each description factual and concise (one sentence). No markdown, no prose
outside the JSON object. It is acceptable to omit a node if context is
insufficient — but include every node you can ground confidently.

Example answer format:
```json
{
  "node_id_1": "Resolves the configured ontology profile from graphify.yaml.",
  "node_id_2": "Colonel James Barclay, an antagonist in The Crooked Man."
}
```
