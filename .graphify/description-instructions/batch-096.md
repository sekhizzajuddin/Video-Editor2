# Node Description Batch 97 of 128

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

- "src_commands_duplicatelayercommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L280 | neighbors=[DuplicateLayerCommand]
- "src_commands_duplicatelayercommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L286 | neighbors=[DuplicateLayerCommand]
- "src_commands_findartboardindex": "findArtboardIndex()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L38 | neighbors=[commands.ts]
- "src_commands_findlayerindexinartboard": "findLayerIndexInArtboard()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L42 | neighbors=[commands.ts]
- "src_commands_grouplayerscommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L566 | neighbors=[GroupLayersCommand]
- "src_commands_grouplayerscommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L574 | neighbors=[GroupLayersCommand]
- "src_commands_pastelayerscommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L665 | neighbors=[PasteLayersCommand]
- "src_commands_pastelayerscommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L671 | neighbors=[PasteLayersCommand]
- "src_commands_rastereditcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L529 | neighbors=[RasterEditCommand]
- "src_commands_rastereditcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L537 | neighbors=[RasterEditCommand]
- "src_commands_rastereditcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L548 | neighbors=[RasterEditCommand]
- "src_commands_removeartboardcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L112 | neighbors=[RemoveArtboardCommand]
- "src_commands_removeartboardcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L119 | neighbors=[RemoveArtboardCommand]
- "src_commands_removelayercommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L263 | neighbors=[RemoveLayerCommand]
- "src_commands_removelayercommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L251 | neighbors=[RemoveLayerCommand]
- "src_commands_removelayercommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L259 | neighbors=[RemoveLayerCommand]
- "src_commands_removepastedlayerscommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L701 | neighbors=[RemovePastedLayersCommand]
- "src_commands_removepastedlayerscommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L708 | neighbors=[RemovePastedLayersCommand]
- "src_commands_reorderlayercommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L324 | neighbors=[ReorderLayerCommand]
- "src_commands_reorderlayercommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L313 | neighbors=[ReorderLayerCommand]
- "src_commands_reorderlayercommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L320 | neighbors=[ReorderLayerCommand]
- "src_commands_reorderlayercommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L328 | neighbors=[ReorderLayerCommand]
- "src_commands_restoreartboardcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L150 | neighbors=[RestoreArtboardCommand]
- "src_commands_restoreartboardcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L156 | neighbors=[RestoreArtboardCommand]
- "src_commands_setprojectnamecommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L54 | neighbors=[SetProjectNameCommand]
- "src_commands_setprojectnamecommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L59 | neighbors=[SetProjectNameCommand]
- "src_commands_setprojectnamecommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L70 | neighbors=[SetProjectNameCommand]
- "src_commands_test_maketextlayer": "makeTextLayer()" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L62 | neighbors=[commands.test.ts]
- "src_commands_test_roundtrip": "roundTrip()" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L137 | neighbors=[commands.test.ts]
- "src_commands_test_size": "SIZE" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L50 | neighbors=[commands.test.ts]
- "src_commands_ungrouplayerscommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L614 | neighbors=[UngroupLayersCommand]
- "src_commands_ungrouplayerscommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L622 | neighbors=[UngroupLayersCommand]
- "src_commands_updateartboardcommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L184 | neighbors=[UpdateArtboardCommand]
- "src_commands_updateartboardcommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L191 | neighbors=[UpdateArtboardCommand]
- "src_commands_updateartboardcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L205 | neighbors=[UpdateArtboardCommand]
- "src_commands_updatelayerstylecommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L386 | neighbors=[UpdateLayerStyleCommand]
- "src_commands_updatelayerstylecommand_constructor": ".constructor()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L375 | neighbors=[UpdateLayerStyleCommand]
- "src_commands_updatelayerstylecommand_description": ".description()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L382 | neighbors=[UpdateLayerStyleCommand]
- "src_commands_updatelayerstylecommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L390 | neighbors=[UpdateLayerStyleCommand]
- "src_commands_updatelayerstylecommand_merge": ".merge()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L399 | neighbors=[UpdateLayerStyleCommand]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-096.json

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
