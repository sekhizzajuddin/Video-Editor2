# Node Description Batch 34 of 128

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

- "public_puter_xt_socket": ".socket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[kt(), xt, wt]
- "public_puter_zn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[zn, Rn, .attach_to_source()]
- "src_adjustments_interpolatecurve": "interpolateCurve()" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L266 | neighbors=[adjustments.ts, applyCurvesToImageData(), catmullRomInterpolate()]
- "src_commands_test_makegroupsetup": "makeGroupSetup()" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L594 | neighbors=[commands.test.ts, makeProject(), makeShapeLayer()]
- "src_mask_default_layer_mask": "DEFAULT_LAYER_MASK" | kind=code-symbol | source=packages/image-core/src/mask.ts:L15 | neighbors=[commands.test.ts, mask.ts, project.ts]
- "src_mask_layermask": "LayerMask" | kind=code-symbol | source=packages/image-core/src/mask.ts:L3 | neighbors=[commands.ts, mask.ts, project.ts]
- "src_migration_migrateproject": "migrateProject()" | kind=code-symbol | source=packages/image-core/src/migration.ts:L9 | neighbors=[migration.ts, migrateV0ToV1(), operations.ts]
- "src_operations_createprojectdocument": "createProjectDocument()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L91 | neighbors=[commands.test.ts, operations.ts, operations.test.ts]
- "src_operations_deserializeproject": "deserializeProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L368 | neighbors=[operations.ts, validateLayerTree(), operations.test.ts]
- "src_operations_removelayertree": "removeLayerTree()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L61 | neighbors=[operations.ts, removeLayerFromProject(), removeLayerReferences()]
- "src_operations_safeassign": "safeAssign()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L81 | neighbors=[operations.ts, updateLayerInProject(), updateLayerTransformInProject()]
- "src_operations_serializeproject": "serializeProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L359 | neighbors=[operations.ts, validateLayerTree(), operations.test.ts]
- "src_project_artboard": "Artboard" | kind=code-symbol | source=packages/image-core/src/project.ts:L251 | neighbors=[commands.ts, operations.ts, project.ts]
- "src_project_default_blend_mode": "DEFAULT_BLEND_MODE" | kind=code-symbol | source=packages/image-core/src/project.ts:L327 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_filter": "DEFAULT_FILTER" | kind=code-symbol | source=packages/image-core/src/project.ts:L375 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_glow": "DEFAULT_GLOW" | kind=code-symbol | source=packages/image-core/src/project.ts:L346 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_inner_shadow": "DEFAULT_INNER_SHADOW" | kind=code-symbol | source=packages/image-core/src/project.ts:L353 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_shadow": "DEFAULT_SHADOW" | kind=code-symbol | source=packages/image-core/src/project.ts:L331 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_shape_style": "DEFAULT_SHAPE_STYLE" | kind=code-symbol | source=packages/image-core/src/project.ts:L429 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_stroke": "DEFAULT_STROKE" | kind=code-symbol | source=packages/image-core/src/project.ts:L339 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_text_style": "DEFAULT_TEXT_STYLE" | kind=code-symbol | source=packages/image-core/src/project.ts:L395 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_default_transform": "DEFAULT_TRANSFORM" | kind=code-symbol | source=packages/image-core/src/project.ts:L314 | neighbors=[commands.test.ts, operations.test.ts, project.ts]
- "src_project_layer": "Layer" | kind=code-symbol | source=packages/image-core/src/project.ts:L233 | neighbors=[commands.ts, operations.ts, project.ts]
- "src_project_project": "Project" | kind=code-symbol | source=packages/image-core/src/project.ts:L293 | neighbors=[commands.ts, operations.ts, project.ts]
- "src_project_transform": "Transform" | kind=code-symbol | source=packages/image-core/src/project.ts:L17 | neighbors=[commands.ts, operations.ts, project.ts]
- "src_schema_parseproject": "parseProject()" | kind=code-symbol | source=packages/image-core/src/schema.ts:L441 | neighbors=[operations.ts, schema.ts, schema.test.ts]
- "src_schema_test": "schema.test.ts" | kind=code-symbol | source=packages/image-core/src/schema.test.ts:L1 | neighbors=[schema.ts, parseProject(), baseLayer]
- "src_selection_selectiontopath2d": "selectionToPath2D()" | kind=code-symbol | source=packages/image-core/src/selection.ts:L76 | neighbors=[selection.ts, getSelectionMask(), isPointInSelection()]
- "stabilization_motion_path_extractdominantmotion": "extractDominantMotion()" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L4 | neighbors=[motion-path.ts, findDominantMotionCluster(), stabilization-engine.ts]
- "stabilization_motion_path_smoothpath": "smoothPath()" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L145 | neighbors=[motion-path.ts, buildGaussianKernel(), stabilization-engine.ts]
- "stabilization_stabilization_engine_disposestabilizationengine": "disposeStabilizationEngine()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L359 | neighbors=[index.ts, stabilization-engine.ts, .dispose()]
- "stabilization_stabilization_engine_stabilizationengine_analyzeclip": ".analyzeClip()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L37 | neighbors=[StabilizationEngine, .clampMotionSample(), .seekVideoFrame()]
- "stabilization_stabilization_engine_stabilizationengine_seekvideoframe": ".seekVideoFrame()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L164 | neighbors=[StabilizationEngine, .analyzeClip(), .waitForRenderableFrame()]
- "stabilization_types_motionsample": "MotionSample" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L1 | neighbors=[index.ts, motion-path.ts, types.ts]
- "stabilization_types_stabilizationrendercontext": "StabilizationRenderContext" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L15 | neighbors=[index.ts, stabilization-engine.ts, types.ts]
- "stabilization_vidstab_engine_disposevidstabengine": "disposeVidstabEngine()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L268 | neighbors=[index.ts, vidstab-engine.ts, .dispose()]
- "stabilization_vidstab_engine_getvidstabengine": "getVidstabEngine()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L261 | neighbors=[index.ts, vidstab-engine.ts, VidstabEngine]
- "storage_cache_manager_cachemanager_ensurespace": ".ensureSpace()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L143 | neighbors=[CacheManager, .evictToTarget(), .setFrame()]
- "storage_cache_manager_cachemanager_evicttotarget": ".evictToTarget()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L152 | neighbors=[CacheManager, .ensureSpace(), .clearFrameCache()]
- "storage_cache_manager_cachemanager_setframe": ".setFrame()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L70 | neighbors=[CacheManager, .createFrameKey(), .ensureSpace()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-033.json

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
