# Node Description Batch 96 of 128

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

- "shaders_index_calculateborderradiusalpha": "calculateBorderRadiusAlpha()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L272 | neighbors=[index.ts]
- "shaders_index_createborderradiusuniformsbuffer": "createBorderRadiusUniformsBuffer()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L180 | neighbors=[index.ts]
- "shaders_index_createidentitymatrix": "createIdentityMatrix()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L193 | neighbors=[index.ts]
- "shaders_index_effectuniforms": "EffectUniforms" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L527 | neighbors=[index.ts]
- "shaders_index_layeruniforms": "LayerUniforms" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L135 | neighbors=[index.ts]
- "shaders_index_multiplymatrices": "multiplyMatrices()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L253 | neighbors=[index.ts]
- "shaders_index_transformuniforms": "TransformUniforms" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L140 | neighbors=[index.ts]
- "src_adjustments_applyblackwhitetoimagedata": "applyBlackWhiteToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L477 | neighbors=[adjustments.ts]
- "src_adjustments_applycolorbalancetoimagedata": "applyColorBalanceToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L376 | neighbors=[adjustments.ts]
- "src_adjustments_applyposterizetoimagedata": "applyPosterizeToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L458 | neighbors=[adjustments.ts]
- "src_adjustments_applythresholdtoimagedata": "applyThresholdToImageData()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L433 | neighbors=[adjustments.ts]
- "src_adjustments_channelmixerchannel": "ChannelMixerChannel" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L123 | neighbors=[adjustments.ts]
- "src_adjustments_colorbalancevalues": "ColorBalanceValues" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L34 | neighbors=[adjustments.ts]
- "src_adjustments_curvepoint": "CurvePoint" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L17 | neighbors=[adjustments.ts]
- "src_adjustments_curveschannel": "CurvesChannel" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L22 | neighbors=[adjustments.ts]
- "src_adjustments_default_color_balance_values": "DEFAULT_COLOR_BALANCE_VALUES" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L169 | neighbors=[adjustments.ts]
- "src_adjustments_default_curves_channel": "DEFAULT_CURVES_CHANNEL" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L154 | neighbors=[adjustments.ts]
- "src_adjustments_default_levels_channel": "DEFAULT_LEVELS_CHANNEL" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L138 | neighbors=[adjustments.ts]
- "src_adjustments_default_selective_color_values": "DEFAULT_SELECTIVE_COLOR_VALUES" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L183 | neighbors=[adjustments.ts]
- "src_adjustments_gradientmapstop": "GradientMapStop" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L93 | neighbors=[adjustments.ts]
- "src_adjustments_levelschannel": "LevelsChannel" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L1 | neighbors=[adjustments.ts]
- "src_adjustments_selectivecolortarget": "SelectiveColorTarget" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L55 | neighbors=[adjustments.ts]
- "src_adjustments_selectivecolorvalues": "SelectiveColorValues" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L48 | neighbors=[adjustments.ts]
- "src_app_app": "App()" | kind=code-symbol | source=src/App.tsx:L22 | neighbors=[App.tsx]
- "src_commands_addartboardcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L82 | neighbors=[AddArtboardCommand]
- "src_commands_addartboardcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L87 | neighbors=[AddArtboardCommand]
- "src_commands_addlayercommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L233 | neighbors=[AddLayerCommand]
- "src_commands_addlayercommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L222 | neighbors=[AddLayerCommand]
- "src_commands_addlayercommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L229 | neighbors=[AddLayerCommand]
- "src_commands_applyadjustmentcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L471 | neighbors=[ApplyAdjustmentCommand]
- "src_commands_applyadjustmentcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L460 | neighbors=[ApplyAdjustmentCommand]
- "src_commands_applyadjustmentcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L467 | neighbors=[ApplyAdjustmentCommand]
- "src_commands_applyadjustmentcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L477 | neighbors=[ApplyAdjustmentCommand]
- "src_commands_applyadjustmentcommand_merge": ".merge()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L486 | neighbors=[ApplyAdjustmentCommand]
- "src_commands_applymaskcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L512 | neighbors=[ApplyMaskCommand]
- "src_commands_applymaskcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L502 | neighbors=[ApplyMaskCommand]
- "src_commands_applymaskcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L508 | neighbors=[ApplyMaskCommand]
- "src_commands_applymaskcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L516 | neighbors=[ApplyMaskCommand]
- "src_commands_command_display_info": "COMMAND_DISPLAY_INFO" | kind=code-symbol | source=packages/image-core/src/commands.ts:L729 | neighbors=[commands.ts]
- "src_commands_duplicatelayercommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L290 | neighbors=[DuplicateLayerCommand]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-095.json

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
