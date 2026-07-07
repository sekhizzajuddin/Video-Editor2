# Node Description Batch 100 of 128

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

- "src_schema_layermaskschema": "LayerMaskSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L197 | neighbors=[schema.ts]
- "src_schema_layerschema": "LayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L358 | neighbors=[schema.ts]
- "src_schema_levelschannelschema": "LevelsChannelSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L77 | neighbors=[schema.ts]
- "src_schema_levelsschema": "LevelsSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L85 | neighbors=[schema.ts]
- "src_schema_mediaassetschema": "MediaAssetSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L392 | neighbors=[schema.ts]
- "src_schema_noisefillschema": "NoiseFillSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L302 | neighbors=[schema.ts]
- "src_schema_parsedproject": "ParsedProject" | kind=code-symbol | source=packages/image-core/src/schema.ts:L435 | neighbors=[schema.ts]
- "src_schema_photofilterschema": "PhotoFilterSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L153 | neighbors=[schema.ts]
- "src_schema_posterizeschema": "PosterizeSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L185 | neighbors=[schema.ts]
- "src_schema_projectschema": "ProjectSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L422 | neighbors=[schema.ts]
- "src_schema_selectivecolorschema": "SelectiveColorSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L126 | neighbors=[schema.ts]
- "src_schema_selectivecolorvaluesschema": "SelectiveColorValuesSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L119 | neighbors=[schema.ts]
- "src_schema_shadowschema": "ShadowSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L25 | neighbors=[schema.ts]
- "src_schema_shapelayerschema": "ShapeLayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L324 | neighbors=[schema.ts]
- "src_schema_shapestyleschema": "ShapeStyleSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L309 | neighbors=[schema.ts]
- "src_schema_smartobjectlayerschema": "SmartObjectLayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L347 | neighbors=[schema.ts]
- "src_schema_strokeschema": "StrokeSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L41 | neighbors=[schema.ts]
- "src_schema_test_baselayer": "baseLayer" | kind=code-symbol | source=packages/image-core/src/schema.test.ts:L4 | neighbors=[schema.test.ts]
- "src_schema_textlayerschema": "TextLayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L288 | neighbors=[schema.ts]
- "src_schema_textshadowschema": "TextShadowSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L259 | neighbors=[schema.ts]
- "src_schema_textstyleschema": "TextStyleSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L267 | neighbors=[schema.ts]
- "src_schema_thresholdschema": "ThresholdSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L190 | neighbors=[schema.ts]
- "src_schema_transformschema": "TransformSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L5 | neighbors=[schema.ts]
- "src_selection_colorrangeoptions": "ColorRangeOptions" | kind=code-symbol | source=packages/image-core/src/selection.ts:L34 | neighbors=[selection.ts]
- "src_selection_createemptyselection": "createEmptySelection()" | kind=code-symbol | source=packages/image-core/src/selection.ts:L64 | neighbors=[selection.ts]
- "src_selection_default_color_range_options": "DEFAULT_COLOR_RANGE_OPTIONS" | kind=code-symbol | source=packages/image-core/src/selection.ts:L58 | neighbors=[selection.ts]
- "src_selection_default_magic_wand_options": "DEFAULT_MAGIC_WAND_OPTIONS" | kind=code-symbol | source=packages/image-core/src/selection.ts:L52 | neighbors=[selection.ts]
- "src_selection_magicwandoptions": "MagicWandOptions" | kind=code-symbol | source=packages/image-core/src/selection.ts:L28 | neighbors=[selection.ts]
- "src_selection_selection": "Selection" | kind=code-symbol | source=packages/image-core/src/selection.ts:L18 | neighbors=[selection.ts]
- "src_selection_selectionbounds": "SelectionBounds" | kind=code-symbol | source=packages/image-core/src/selection.ts:L11 | neighbors=[selection.ts]
- "src_selection_selectionmode": "SelectionMode" | kind=code-symbol | source=packages/image-core/src/selection.ts:L9 | neighbors=[selection.ts]
- "src_selection_selectionstate": "SelectionState" | kind=code-symbol | source=packages/image-core/src/selection.ts:L40 | neighbors=[selection.ts]
- "src_selection_selectiontype": "SelectionType" | kind=code-symbol | source=packages/image-core/src/selection.ts:L1 | neighbors=[selection.ts]
- "stabilization_stabilization_engine_stabilizationengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L25 | neighbors=[StabilizationEngine]
- "stabilization_stabilization_engine_stabilizationengine_removeprofile": ".removeProfile()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L299 | neighbors=[StabilizationEngine]
- "stabilization_vidstab_engine_ffmpeginstance": "FFmpegInstance" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L4 | neighbors=[vidstab-engine.ts]
- "stabilization_vidstab_engine_vidstab_core_cdn": "VIDSTAB_CORE_CDN" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L25 | neighbors=[vidstab-engine.ts]
- "stabilization_vidstab_engine_vidstabengine_getstabilizedblob": ".getStabilizedBlob()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L102 | neighbors=[VidstabEngine]
- "stabilization_vidstab_engine_vidstabengine_hasstabilized": ".hasStabilized()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L98 | neighbors=[VidstabEngine]
- "stabilization_vidstab_engine_vidstabengine_isloaded": ".isLoaded()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L94 | neighbors=[VidstabEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-099.json

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
