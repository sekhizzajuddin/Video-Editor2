# Node Description Batch 106 of 128

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

- "types_composition_textstyle": "TextStyle" | kind=code-symbol | source=packages/core/src/types/composition.ts:L70 | neighbors=[composition.ts]
- "types_effects_audioeffecttype": "AudioEffectType" | kind=code-symbol | source=packages/core/src/types/effects.ts:L596 | neighbors=[effects.ts]
- "types_effects_effect_definitions": "EFFECT_DEFINITIONS" | kind=code-symbol | source=packages/core/src/types/effects.ts:L49 | neighbors=[effects.ts]
- "types_effects_effectcategory": "EffectCategory" | kind=code-symbol | source=packages/core/src/types/effects.ts:L19 | neighbors=[effects.ts]
- "types_effects_effectdefinition": "EffectDefinition" | kind=code-symbol | source=packages/core/src/types/effects.ts:L32 | neighbors=[effects.ts]
- "types_effects_effectparamdefinition": "EffectParamDefinition" | kind=code-symbol | source=packages/core/src/types/effects.ts:L21 | neighbors=[effects.ts]
- "types_effects_effectparamvalue": "EffectParamValue" | kind=code-symbol | source=packages/core/src/types/effects.ts:L39 | neighbors=[effects.ts]
- "types_effects_geteffectsbycategory": "getEffectsByCategory()" | kind=code-symbol | source=packages/core/src/types/effects.ts:L552 | neighbors=[effects.ts]
- "types_effects_layereffect": "LayerEffect" | kind=code-symbol | source=packages/core/src/types/effects.ts:L41 | neighbors=[effects.ts]
- "types_effects_videofilterparams": "VideoFilterParams" | kind=code-symbol | source=packages/core/src/types/effects.ts:L630 | neighbors=[effects.ts]
- "types_effects_videofiltertype": "VideoFilterType" | kind=code-symbol | source=packages/core/src/types/effects.ts:L581 | neighbors=[effects.ts]
- "types_index_clipaibackgroundsettings": "ClipAiBackgroundSettings" | kind=code-symbol | source=src/types/index.ts:L240 | neighbors=[index.ts]
- "types_index_clipchromakeysettings": "ClipChromaKeySettings" | kind=code-symbol | source=src/types/index.ts:L245 | neighbors=[index.ts]
- "types_index_clipcrop": "ClipCrop" | kind=code-symbol | source=src/types/index.ts:L74 | neighbors=[index.ts]
- "types_index_clipfxsettings": "ClipFxSettings" | kind=code-symbol | source=src/types/index.ts:L174 | neighbors=[index.ts]
- "types_index_cliplumakeysettings": "ClipLumaKeySettings" | kind=code-symbol | source=src/types/index.ts:L252 | neighbors=[index.ts]
- "types_index_cliplutsettings": "ClipLutSettings" | kind=code-symbol | source=src/types/index.ts:L13 | neighbors=[index.ts]
- "types_index_clipmasksettings": "ClipMaskSettings" | kind=code-symbol | source=src/types/index.ts:L270 | neighbors=[index.ts]
- "types_index_cliptextanimation": "ClipTextAnimation" | kind=code-symbol | source=src/types/index.ts:L146 | neighbors=[index.ts]
- "types_index_cliptransform": "ClipTransform" | kind=code-symbol | source=src/types/index.ts:L59 | neighbors=[index.ts]
- "types_index_colorwheeladjustment": "ColorWheelAdjustment" | kind=code-symbol | source=src/types/index.ts:L87 | neighbors=[index.ts]
- "types_index_editoractions": "EditorActions" | kind=code-symbol | source=src/types/index.ts:L497 | neighbors=[index.ts]
- "types_index_mediafolder": "MediaFolder" | kind=code-symbol | source=src/types/index.ts:L18 | neighbors=[index.ts]
- "types_index_particleeffecttype": "ParticleEffectType" | kind=code-symbol | source=src/types/index.ts:L180 | neighbors=[index.ts]
- "types_index_textanimationpreset": "TextAnimationPreset" | kind=code-symbol | source=src/types/index.ts:L134 | neighbors=[index.ts]
- "types_index_timeformat": "TimeFormat" | kind=code-symbol | source=src/types/index.ts:L522 | neighbors=[index.ts]
- "types_index_timelinemarker": "TimelineMarker" | kind=code-symbol | source=src/types/index.ts:L378 | neighbors=[index.ts]
- "types_index_waveformdata": "WaveformData" | kind=code-symbol | source=src/types/index.ts:L82 | neighbors=[index.ts]
- "types_project_filmstripthumbnail": "FilmstripThumbnail" | kind=code-symbol | source=packages/core/src/types/project.ts:L54 | neighbors=[project.ts]
- "types_project_medialibrary": "MediaLibrary" | kind=code-symbol | source=packages/core/src/types/project.ts:L27 | neighbors=[project.ts]
- "types_result_combine": "combine()" | kind=code-symbol | source=packages/core/src/types/result.ts:L92 | neighbors=[result.ts]
- "types_result_err": "err()" | kind=code-symbol | source=packages/core/src/types/result.ts:L9 | neighbors=[result.ts]
- "types_result_flatmap": "flatMap()" | kind=code-symbol | source=packages/core/src/types/result.ts:L58 | neighbors=[result.ts]
- "types_result_fromnullable": "fromNullable()" | kind=code-symbol | source=packages/core/src/types/result.ts:L82 | neighbors=[result.ts]
- "types_result_frompromise": "fromPromise()" | kind=code-symbol | source=packages/core/src/types/result.ts:L68 | neighbors=[result.ts]
- "types_result_iserr": "isErr()" | kind=code-symbol | source=packages/core/src/types/result.ts:L19 | neighbors=[result.ts]
- "types_result_isok": "isOk()" | kind=code-symbol | source=packages/core/src/types/result.ts:L13 | neighbors=[result.ts]
- "types_result_map": "map()" | kind=code-symbol | source=packages/core/src/types/result.ts:L38 | neighbors=[result.ts]
- "types_result_maperr": "mapErr()" | kind=code-symbol | source=packages/core/src/types/result.ts:L48 | neighbors=[result.ts]
- "types_result_ok": "ok()" | kind=code-symbol | source=packages/core/src/types/result.ts:L5 | neighbors=[result.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-105.json

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
