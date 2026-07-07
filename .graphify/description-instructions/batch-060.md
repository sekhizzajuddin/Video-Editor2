# Node Description Batch 61 of 128

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

- "src_commands_removeartboardcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L123 | neighbors=[RemoveArtboardCommand, cloneProject()]
- "src_commands_removeartboardcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L139 | neighbors=[RemoveArtboardCommand, RestoreArtboardCommand]
- "src_commands_removelayercommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L267 | neighbors=[RemoveLayerCommand, AddLayerCommand]
- "src_commands_removepastedlayerscommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L712 | neighbors=[RemovePastedLayersCommand, cloneProject()]
- "src_commands_removepastedlayerscommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L720 | neighbors=[RemovePastedLayersCommand, PasteLayersCommand]
- "src_commands_restoreartboardcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L160 | neighbors=[RestoreArtboardCommand, cloneProject()]
- "src_commands_restoreartboardcommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L171 | neighbors=[RestoreArtboardCommand, RemoveArtboardCommand]
- "src_commands_setprojectnamecommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L63 | neighbors=[SetProjectNameCommand, cloneProject()]
- "src_commands_test_makeproject": "makeProject()" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L53 | neighbors=[commands.test.ts, makeGroupSetup()]
- "src_commands_test_makeshapelayer": "makeShapeLayer()" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L97 | neighbors=[commands.test.ts, makeGroupSetup()]
- "src_commands_ungrouplayerscommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L626 | neighbors=[UngroupLayersCommand, cloneProject()]
- "src_commands_ungrouplayerscommand_invert": ".invert()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L648 | neighbors=[UngroupLayersCommand, GroupLayersCommand]
- "src_commands_updateartboardcommand_apply": ".apply()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L195 | neighbors=[UpdateArtboardCommand, cloneProject()]
- "src_migration_migratev0tov1": "migrateV0ToV1()" | kind=code-symbol | source=packages/image-core/src/migration.ts:L24 | neighbors=[migration.ts, migrateProject()]
- "src_operations_islayeridknown": "isLayerIdKnown()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L77 | neighbors=[operations.ts, removeLayerFromProject()]
- "src_operations_removelayerreferences": "removeLayerReferences()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L49 | neighbors=[operations.ts, removeLayerTree()]
- "src_project_canvasbackground": "CanvasBackground" | kind=code-symbol | source=packages/image-core/src/project.ts:L240 | neighbors=[operations.ts, project.ts]
- "src_project_canvassize": "CanvasSize" | kind=code-symbol | source=packages/image-core/src/project.ts:L235 | neighbors=[operations.ts, project.ts]
- "src_project_imagelayer": "ImageLayer" | kind=code-symbol | source=packages/image-core/src/project.ts:L116 | neighbors=[project.ts, BaseLayer]
- "src_project_smartobjectlayer": "SmartObjectLayer" | kind=code-symbol | source=packages/image-core/src/project.ts:L227 | neighbors=[project.ts, BaseLayer]
- "src_project_textstyle": "TextStyle" | kind=code-symbol | source=packages/image-core/src/project.ts:L132 | neighbors=[commands.ts, project.ts]
- "src_selection_boundsfrompath": "boundsFromPath()" | kind=code-symbol | source=packages/image-core/src/selection.ts:L103 | neighbors=[selection.ts, combineSelections()]
- "src_selection_combineselections": "combineSelections()" | kind=code-symbol | source=packages/image-core/src/selection.ts:L140 | neighbors=[selection.ts, boundsFromPath()]
- "src_selection_getselectionmask": "getSelectionMask()" | kind=code-symbol | source=packages/image-core/src/selection.ts:L168 | neighbors=[selection.ts, selectionToPath2D()]
- "src_selection_ispointinselection": "isPointInSelection()" | kind=code-symbol | source=packages/image-core/src/selection.ts:L128 | neighbors=[selection.ts, selectionToPath2D()]
- "stabilization_motion_path_accumulatemotionpath": "accumulateMotionPath()" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L127 | neighbors=[motion-path.ts, stabilization-engine.ts]
- "stabilization_motion_path_buildgaussiankernel": "buildGaussianKernel()" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L178 | neighbors=[motion-path.ts, smoothPath()]
- "stabilization_motion_path_computecorrections": "computeCorrections()" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L189 | neighbors=[motion-path.ts, stabilization-engine.ts]
- "stabilization_motion_path_finddominantmotioncluster": "findDominantMotionCluster()" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L37 | neighbors=[motion-path.ts, extractDominantMotion()]
- "stabilization_stabilization_engine_stabilizationengine_clampmotionsample": ".clampMotionSample()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L147 | neighbors=[StabilizationEngine, .analyzeClip()]
- "stabilization_stabilization_engine_stabilizationengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L303 | neighbors=[disposeStabilizationEngine(), StabilizationEngine]
- "stabilization_stabilization_engine_stabilizationengine_getcorrectiontransform": ".getCorrectionTransform()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L242 | neighbors=[getStabilizedTransform(), StabilizationEngine]
- "stabilization_stabilization_engine_stabilizationengine_hasprofile": ".hasProfile()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L29 | neighbors=[getStabilizedTransform(), StabilizationEngine]
- "stabilization_stabilization_engine_stabilizationengine_setprofile": ".setProfile()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L33 | neighbors=[getStabilizedTransform(), StabilizationEngine]
- "stabilization_stabilization_engine_stabilizationengine_waitforrenderableframe": ".waitForRenderableFrame()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L203 | neighbors=[StabilizationEngine, .seekVideoFrame()]
- "stabilization_vidstab_engine_vidstabengine_cleanup": ".cleanup()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L237 | neighbors=[VidstabEngine, .stabilize()]
- "stabilization_vidstab_engine_vidstabengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L248 | neighbors=[disposeVidstabEngine(), VidstabEngine]
- "stabilization_vidstab_engine_vidstabengine_doload": ".doLoad()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L49 | neighbors=[VidstabEngine, .load()]
- "stabilization_vidstab_engine_vidstabengine_load": ".load()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L41 | neighbors=[VidstabEngine, .doLoad()]
- "stabilization_vidstab_engine_vidstabengine_stabilize": ".stabilize()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L106 | neighbors=[VidstabEngine, .cleanup()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-060.json

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
