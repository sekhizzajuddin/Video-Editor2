# Node Description Batch 99 of 128

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

- "src_project_gradient": "Gradient" | kind=code-symbol | source=packages/image-core/src/project.ts:L167 | neighbors=[project.ts]
- "src_project_gradientstop": "GradientStop" | kind=code-symbol | source=packages/image-core/src/project.ts:L162 | neighbors=[project.ts]
- "src_project_innershadow": "InnerShadow" | kind=code-symbol | source=packages/image-core/src/project.ts:L56 | neighbors=[project.ts]
- "src_project_layertype": "LayerType" | kind=code-symbol | source=packages/image-core/src/project.ts:L15 | neighbors=[project.ts]
- "src_project_mediaasset": "MediaAsset" | kind=code-symbol | source=packages/image-core/src/project.ts:L260 | neighbors=[project.ts]
- "src_project_noisefill": "NoiseFill" | kind=code-symbol | source=packages/image-core/src/project.ts:L184 | neighbors=[project.ts]
- "src_project_projectmetadata": "ProjectMetadata" | kind=code-symbol | source=packages/image-core/src/project.ts:L306 | neighbors=[project.ts]
- "src_project_shadow": "Shadow" | kind=code-symbol | source=packages/image-core/src/project.ts:L34 | neighbors=[project.ts]
- "src_project_shapestyle": "ShapeStyle" | kind=code-symbol | source=packages/image-core/src/project.ts:L191 | neighbors=[project.ts]
- "src_project_shapetype": "ShapeType" | kind=code-symbol | source=packages/image-core/src/project.ts:L160 | neighbors=[project.ts]
- "src_project_stroke": "Stroke" | kind=code-symbol | source=packages/image-core/src/project.ts:L42 | neighbors=[project.ts]
- "src_project_strokedashtype": "StrokeDashType" | kind=code-symbol | source=packages/image-core/src/project.ts:L175 | neighbors=[project.ts]
- "src_project_textfilltype": "TextFillType" | kind=code-symbol | source=packages/image-core/src/project.ts:L122 | neighbors=[project.ts]
- "src_project_textshadow": "TextShadow" | kind=code-symbol | source=packages/image-core/src/project.ts:L124 | neighbors=[project.ts]
- "src_schema_artboardschema": "ArtboardSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L383 | neighbors=[schema.ts]
- "src_schema_baselayerschema": "BaseLayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L211 | neighbors=[schema.ts]
- "src_schema_blackwhiteschema": "BlackWhiteSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L140 | neighbors=[schema.ts]
- "src_schema_blendmodeschema": "BlendModeSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L18 | neighbors=[schema.ts]
- "src_schema_canvasbackgroundschema": "CanvasBackgroundSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L370 | neighbors=[schema.ts]
- "src_schema_canvassizeschema": "CanvasSizeSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L368 | neighbors=[schema.ts]
- "src_schema_channelmixerchannelschema": "ChannelMixerChannelSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L161 | neighbors=[schema.ts]
- "src_schema_channelmixerschema": "ChannelMixerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L168 | neighbors=[schema.ts]
- "src_schema_colorbalanceschema": "ColorBalanceSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L111 | neighbors=[schema.ts]
- "src_schema_colorbalancevaluesschema": "ColorBalanceValuesSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L105 | neighbors=[schema.ts]
- "src_schema_cornerradiusschema": "CornerRadiusSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L295 | neighbors=[schema.ts]
- "src_schema_curvepointschema": "CurvePointSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L93 | neighbors=[schema.ts]
- "src_schema_curveschannelschema": "CurvesChannelSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L95 | neighbors=[schema.ts]
- "src_schema_curvesschema": "CurvesSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L97 | neighbors=[schema.ts]
- "src_schema_embeddedprojectreferenceschema": "EmbeddedProjectReferenceSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L341 | neighbors=[schema.ts]
- "src_schema_exportartboardfilterschema": "ExportArtboardFilterSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L405 | neighbors=[schema.ts]
- "src_schema_exportpresetschema": "ExportPresetSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L410 | neighbors=[schema.ts]
- "src_schema_filterschema": "FilterSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L55 | neighbors=[schema.ts]
- "src_schema_glowschema": "GlowSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L48 | neighbors=[schema.ts]
- "src_schema_gradientmapschema": "GradientMapSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L178 | neighbors=[schema.ts]
- "src_schema_gradientmapstopschema": "GradientMapStopSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L176 | neighbors=[schema.ts]
- "src_schema_gradientschema": "GradientSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L253 | neighbors=[schema.ts]
- "src_schema_gradientstopschema": "GradientStopSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L251 | neighbors=[schema.ts]
- "src_schema_grouplayerschema": "GroupLayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L335 | neighbors=[schema.ts]
- "src_schema_imagelayerschema": "ImageLayerSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L243 | neighbors=[schema.ts]
- "src_schema_innershadowschema": "InnerShadowSchema" | kind=code-symbol | source=packages/image-core/src/schema.ts:L33 | neighbors=[schema.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-098.json

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
