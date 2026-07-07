# Node Description Batch 98 of 128

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

- "src_commands_updatelayertransformcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L347 | neighbors=[UpdateLayerTransformCommand]
- "src_commands_updatelayertransformcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L336 | neighbors=[UpdateLayerTransformCommand]
- "src_commands_updatelayertransformcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L343 | neighbors=[UpdateLayerTransformCommand]
- "src_commands_updatelayertransformcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L351 | neighbors=[UpdateLayerTransformCommand]
- "src_commands_updatelayertransformcommand_merge": ".merge()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L360 | neighbors=[UpdateLayerTransformCommand]
- "src_commands_updatetextcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L428 | neighbors=[UpdateTextCommand]
- "src_commands_updatetextcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L416 | neighbors=[UpdateTextCommand]
- "src_commands_updatetextcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L424 | neighbors=[UpdateTextCommand]
- "src_commands_updatetextcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L434 | neighbors=[UpdateTextCommand]
- "src_commands_updatetextcommand_merge": ".merge()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L444 | neighbors=[UpdateTextCommand]
- "src_main": "main.tsx" | kind=code-symbol | source=src/main.tsx:L1 | neighbors=[App.tsx]
- "src_mask_applymasktoimagedata": "applyMaskToImageData()" | kind=code-symbol | source=packages/image-core/src/mask.ts:L81 | neighbors=[mask.ts]
- "src_mask_createmaskfromimagedata": "createMaskFromImageData()" | kind=code-symbol | source=packages/image-core/src/mask.ts:L67 | neighbors=[mask.ts]
- "src_mask_createmaskfromselection": "createMaskFromSelection()" | kind=code-symbol | source=packages/image-core/src/mask.ts:L27 | neighbors=[mask.ts]
- "src_mask_feathermask": "featherMask()" | kind=code-symbol | source=packages/image-core/src/mask.ts:L142 | neighbors=[mask.ts]
- "src_mask_invertmask": "invertMask()" | kind=code-symbol | source=packages/image-core/src/mask.ts:L116 | neighbors=[mask.ts]
- "src_mask_masktype": "MaskType" | kind=code-symbol | source=packages/image-core/src/mask.ts:L1 | neighbors=[mask.ts]
- "src_operations_createprojectdocumentoptions": "CreateProjectDocumentOptions" | kind=code-symbol | source=packages/image-core/src/operations.ts:L12 | neighbors=[operations.ts]
- "src_operations_deserializeprojecterror": "DeserializeProjectError" | kind=code-symbol | source=packages/image-core/src/operations.ts:L31 | neighbors=[operations.ts]
- "src_operations_deserializeprojectresult": "DeserializeProjectResult" | kind=code-symbol | source=packages/image-core/src/operations.ts:L26 | neighbors=[operations.ts]
- "src_operations_duplicatelayerresult": "DuplicateLayerResult" | kind=code-symbol | source=packages/image-core/src/operations.ts:L21 | neighbors=[operations.ts]
- "src_operations_test_creategrouplayer": "createGroupLayer()" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L114 | neighbors=[operations.test.ts]
- "src_operations_test_createprojectwithlayer": "createProjectWithLayer()" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L148 | neighbors=[operations.test.ts]
- "src_operations_test_createshapelayer": "createShapeLayer()" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L80 | neighbors=[operations.test.ts]
- "src_operations_test_createtextlayer": "createTextLayer()" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L45 | neighbors=[operations.test.ts]
- "src_operations_test_default_bg": "DEFAULT_BG" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L43 | neighbors=[operations.test.ts]
- "src_operations_test_default_size": "DEFAULT_SIZE" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L42 | neighbors=[operations.test.ts]
- "src_project_blendmode": "BlendMode" | kind=code-symbol | source=packages/image-core/src/project.ts:L30 | neighbors=[project.ts]
- "src_project_blurtype": "BlurType" | kind=code-symbol | source=packages/image-core/src/project.ts:L64 | neighbors=[project.ts]
- "src_project_canvas_presets": "CANVAS_PRESETS" | kind=code-symbol | source=packages/image-core/src/project.ts:L449 | neighbors=[project.ts]
- "src_project_cornerradius": "CornerRadius" | kind=code-symbol | source=packages/image-core/src/project.ts:L177 | neighbors=[project.ts]
- "src_project_default_noise_fill": "DEFAULT_NOISE_FILL" | kind=code-symbol | source=packages/image-core/src/project.ts:L422 | neighbors=[project.ts]
- "src_project_embeddedprojectreference": "EmbeddedProjectReference" | kind=code-symbol | source=packages/image-core/src/project.ts:L221 | neighbors=[project.ts]
- "src_project_exportartboardfilter": "ExportArtboardFilter" | kind=code-symbol | source=packages/image-core/src/project.ts:L277 | neighbors=[project.ts]
- "src_project_exportbackgroundmode": "ExportBackgroundMode" | kind=code-symbol | source=packages/image-core/src/project.ts:L275 | neighbors=[project.ts]
- "src_project_exportformat": "ExportFormat" | kind=code-symbol | source=packages/image-core/src/project.ts:L273 | neighbors=[project.ts]
- "src_project_exportpreset": "ExportPreset" | kind=code-symbol | source=packages/image-core/src/project.ts:L282 | neighbors=[project.ts]
- "src_project_filltype": "FillType" | kind=code-symbol | source=packages/image-core/src/project.ts:L173 | neighbors=[project.ts]
- "src_project_filter": "Filter" | kind=code-symbol | source=packages/image-core/src/project.ts:L66 | neighbors=[project.ts]
- "src_project_glow": "Glow" | kind=code-symbol | source=packages/image-core/src/project.ts:L49 | neighbors=[project.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-097.json

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
