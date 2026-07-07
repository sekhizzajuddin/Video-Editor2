# Node Description Batch 60 of 128

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

- "shaders_index_createlanczosdimensionsbuffer": "createLanczosDimensionsBuffer()" | kind=code-symbol | source=packages/core/src/video/upscaling/shaders/index.ts:L317 | neighbors=[index.ts, upscaling-engine.ts]
- "shaders_index_createlayeruniformsbuffer": "createLayerUniformsBuffer()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L154 | neighbors=[index.ts, webgpu-renderer-impl.ts]
- "shaders_index_createsharpenuniformsbuffer": "createSharpenUniformsBuffer()" | kind=code-symbol | source=packages/core/src/video/upscaling/shaders/index.ts:L350 | neighbors=[index.ts, upscaling-engine.ts]
- "shaders_index_createtransformmatrix": "createTransformMatrix()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L197 | neighbors=[index.ts, webgpu-renderer-impl.ts]
- "shaders_index_createtransformuniformsbuffer": "createTransformUniformsBuffer()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L161 | neighbors=[index.ts, webgpu-renderer-impl.ts]
- "src_adjustments_applycurvestoimagedata": "applyCurvesToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L346 | neighbors=[adjustments.ts, interpolateCurve()]
- "src_adjustments_applygradientmaptoimagedata": "applyGradientMapToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L562 | neighbors=[adjustments.ts, hexToRgb()]
- "src_adjustments_applylevels": "applyLevels()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L253 | neighbors=[adjustments.ts, applyLevelsToImageData()]
- "src_adjustments_applylevelstoimagedata": "applyLevelsToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L316 | neighbors=[adjustments.ts, applyLevels()]
- "src_adjustments_blackwhiteadjustment": "BlackWhiteAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L80 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_catmullrominterpolate": "catmullRomInterpolate()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L297 | neighbors=[adjustments.ts, interpolateCurve()]
- "src_adjustments_channelmixeradjustment": "ChannelMixerAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L130 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_colorbalanceadjustment": "ColorBalanceAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L40 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_curvesadjustment": "CurvesAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L26 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_black_white": "DEFAULT_BLACK_WHITE" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L204 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_channel_mixer": "DEFAULT_CHANNEL_MIXER" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L245 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_color_balance": "DEFAULT_COLOR_BALANCE" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L175 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_curves": "DEFAULT_CURVES" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L161 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_gradient_map": "DEFAULT_GRADIENT_MAP" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L217 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_levels": "DEFAULT_LEVELS" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L146 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_photo_filter": "DEFAULT_PHOTO_FILTER" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L237 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_posterize": "DEFAULT_POSTERIZE" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L227 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_selective_color": "DEFAULT_SELECTIVE_COLOR" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L190 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_default_threshold": "DEFAULT_THRESHOLD" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L232 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_gradientmapadjustment": "GradientMapAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L98 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_hextorgb": "hexToRgb()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L611 | neighbors=[adjustments.ts, applyGradientMapToImageData()]
- "src_adjustments_levelsadjustment": "LevelsAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L9 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_photofilteradjustment": "PhotoFilterAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L115 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_posterizeadjustment": "PosterizeAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L105 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_selectivecoloradjustment": "SelectiveColorAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L66 | neighbors=[adjustments.ts, project.ts]
- "src_adjustments_thresholdadjustment": "ThresholdAdjustment" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L110 | neighbors=[adjustments.ts, project.ts]
- "src_commands_addartboardcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L91 | neighbors=[AddArtboardCommand, cloneProject()]
- "src_commands_addartboardcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L99 | neighbors=[AddArtboardCommand, RemoveArtboardCommand]
- "src_commands_addlayercommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L237 | neighbors=[AddLayerCommand, RemoveLayerCommand]
- "src_commands_duplicatelayercommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L299 | neighbors=[DuplicateLayerCommand, RemoveLayerCommand]
- "src_commands_grouplayerscommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L578 | neighbors=[GroupLayersCommand, cloneProject()]
- "src_commands_grouplayerscommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L600 | neighbors=[GroupLayersCommand, UngroupLayersCommand]
- "src_commands_pastelayerscommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L675 | neighbors=[PasteLayersCommand, cloneProject()]
- "src_commands_pastelayerscommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L687 | neighbors=[PasteLayersCommand, RemovePastedLayersCommand]
- "src_commands_rastereditcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L541 | neighbors=[RasterEditCommand, cloneProject()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-059.json

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
