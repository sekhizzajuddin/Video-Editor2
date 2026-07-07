# Node Description Batch 115 of 128

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

- "utils_canvaseffects_imagecache": "imageCache" | kind=code-symbol | source=src/utils/canvasEffects.ts:L7 | neighbors=[canvasEffects.ts]
- "utils_canvaseffects_imageloading": "imageLoading" | kind=code-symbol | source=src/utils/canvasEffects.ts:L8 | neighbors=[canvasEffects.ts]
- "utils_canvaseffects_particle": "Particle" | kind=code-symbol | source=src/utils/canvasEffects.ts:L226 | neighbors=[canvasEffects.ts]
- "utils_canvaseffects_particleeffecttype": "ParticleEffectType" | kind=code-symbol | source=src/utils/canvasEffects.ts:L222 | neighbors=[canvasEffects.ts]
- "utils_frameextractor_clearframecache": "clearFrameCache()" | kind=code-symbol | source=src/utils/frameExtractor.ts:L110 | neighbors=[frameExtractor.ts]
- "utils_frameextractor_extractframes": "extractFrames()" | kind=code-symbol | source=src/utils/frameExtractor.ts:L22 | neighbors=[frameExtractor.ts]
- "utils_frameextractor_framecache": "frameCache" | kind=code-symbol | source=src/utils/frameExtractor.ts:L9 | neighbors=[frameExtractor.ts]
- "utils_frameextractor_getcachedframes": "getCachedFrames()" | kind=code-symbol | source=src/utils/frameExtractor.ts:L103 | neighbors=[frameExtractor.ts]
- "utils_immutable_updates_addtracktotimeline": "addTrackToTimeline()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L166 | neighbors=[immutable-updates.ts]
- "utils_immutable_updates_findtrackbyclipid": "findTrackByClipId()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L314 | neighbors=[immutable-updates.ts]
- "utils_immutable_updates_findtrackbyid": "findTrackById()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L282 | neighbors=[immutable-updates.ts]
- "utils_immutable_updates_mutable": "Mutable" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L14 | neighbors=[immutable-updates.ts]
- "utils_immutable_updates_removetrackfromtimeline": "removeTrackFromTimeline()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L173 | neighbors=[immutable-updates.ts]
- "utils_immutable_updates_reordertracks": "reorderTracks()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L344 | neighbors=[immutable-updates.ts]
- "utils_immutable_updates_updateclipintrack": "updateClipInTrack()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L102 | neighbors=[immutable-updates.ts]
- "utils_index_clamp": "clamp()" | kind=code-symbol | source=packages/core/src/utils/index.ts:L18 | neighbors=[index.ts]
- "utils_index_deepclone": "deepClone()" | kind=code-symbol | source=packages/core/src/utils/index.ts:L29 | neighbors=[index.ts]
- "utils_keyboardshortcuts_keyboardshortcutdef": "KeyboardShortcutDef" | kind=code-symbol | source=src/utils/keyboardShortcuts.ts:L3 | neighbors=[keyboardShortcuts.ts]
- "utils_motiontracker_point": "Point" | kind=code-symbol | source=src/utils/motionTracker.ts:L3 | neighbors=[motionTracker.ts]
- "utils_motiontracker_trackprogresscallback": "TrackProgressCallback" | kind=code-symbol | source=src/utils/motionTracker.ts:L93 | neighbors=[motionTracker.ts]
- "utils_projectpersistence_generatefilehash": "generateFileHash()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L168 | neighbors=[projectPersistence.ts]
- "utils_serialization_deepequals": "deepEquals()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L75 | neighbors=[serialization.ts]
- "utils_serialization_deserializeaction": "deserializeAction()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L41 | neighbors=[serialization.ts]
- "utils_serialization_deserializeactions": "deserializeActions()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L62 | neighbors=[serialization.ts]
- "utils_serialization_serializeaction": "serializeAction()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L30 | neighbors=[serialization.ts]
- "utils_serialization_serializeactions": "serializeActions()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L51 | neighbors=[serialization.ts]
- "utils_smartreframe_generatesmartreframekeyframes": "generateSmartReframeKeyframes()" | kind=code-symbol | source=src/utils/smartReframe.ts:L7 | neighbors=[smartReframe.ts]
- "utils_speedramp_integralcache": "integralCache" | kind=code-symbol | source=src/utils/speedRamp.ts:L74 | neighbors=[speedRamp.ts]
- "utils_speedramp_integralcacheentry": "IntegralCacheEntry" | kind=code-symbol | source=src/utils/speedRamp.ts:L69 | neighbors=[speedRamp.ts]
- "utils_srtparser_parsedsubtitle": "ParsedSubtitle" | kind=code-symbol | source=src/utils/srtParser.ts:L1 | neighbors=[srtParser.ts]
- "utils_storyboardcompiler_storyboardchunk": "StoryboardChunk" | kind=code-symbol | source=src/utils/storyboardCompiler.ts:L1 | neighbors=[storyboardCompiler.ts]
- "utils_time_snaptogrid": "snapToGrid()" | kind=code-symbol | source=src/utils/time.ts:L26 | neighbors=[time.ts]
- "utils_titletemplates_titletemplate": "TitleTemplate" | kind=code-symbol | source=src/utils/titleTemplates.ts:L11 | neighbors=[titleTemplates.ts]
- "utils_waveformrenderer_waveformrenderoptions": "WaveformRenderOptions" | kind=code-symbol | source=src/utils/waveformRenderer.ts:L7 | neighbors=[waveformRenderer.ts]
- "video_adjustment_layer_engine_adjustmentlayer": "AdjustmentLayer" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L6 | neighbors=[adjustment-layer-engine.ts]
- "video_adjustment_layer_engine_adjustmentlayereffect": "AdjustmentLayerEffect" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L28 | neighbors=[adjustment-layer-engine.ts]
- "video_adjustment_layer_engine_adjustmentlayerengine_addeffect": ".addEffect()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L170 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_clearall": ".clearAll()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L319 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_deletelayer": ".deleteLayer()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L162 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_getactivelayersattime": ".getActiveLayersAtTime()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L120 | neighbors=[AdjustmentLayerEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-114.json

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
