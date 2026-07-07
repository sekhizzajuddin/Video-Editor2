# Node Description Batch 91 of 128

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

- "photo_photo_adjustments_adjustmentlayerconfig": "AdjustmentLayerConfig" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L5 | neighbors=[photo-adjustments.ts]
- "photo_photo_adjustments_photoadjustmentengine_addadjustmenttolayer": ".addAdjustmentToLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L26 | neighbors=[PhotoAdjustmentEngine]
- "photo_photo_adjustments_photoadjustmentengine_createadjustment": ".createAdjustment()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L14 | neighbors=[PhotoAdjustmentEngine]
- "photo_photo_adjustments_photoadjustmentengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L359 | neighbors=[PhotoAdjustmentEngine]
- "photo_photo_adjustments_photoadjustmentengine_removeadjustmentfromlayer": ".removeAdjustmentFromLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L41 | neighbors=[PhotoAdjustmentEngine]
- "photo_photo_adjustments_photoadjustmentengine_updateadjustment": ".updateAdjustment()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L61 | neighbors=[PhotoAdjustmentEngine]
- "photo_photo_engine_photoengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L28 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_createproject": ".createProject()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L33 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L448 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_duplicatelayer": ".duplicateLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L244 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_getlayercount": ".getLayerCount()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L444 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_getselectedlayer": ".getSelectedLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L279 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_getvisiblelayers": ".getVisibleLayers()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L440 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_removelayer": ".removeLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L103 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_renamelayer": ".renameLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L231 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_reorderlayers": ".reorderLayers()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L126 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_selectlayer": ".selectLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L267 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_setlayerblendmode": ".setLayerBlendMode()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L190 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_setlayerlocked": ".setLayerLocked()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L218 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_setlayeropacity": ".setLayerOpacity()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L160 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_setlayertransform": ".setLayerTransform()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L203 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengine_setlayervisibility": ".setLayerVisibility()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L175 | neighbors=[PhotoEngine]
- "photo_photo_engine_photoengineconfig": "PhotoEngineConfig" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L17 | neighbors=[photo-engine.ts]
- "photo_retouching_engine_brushconfig": "BrushConfig" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L3 | neighbors=[retouching-engine.ts]
- "photo_retouching_engine_default_brush_config": "DEFAULT_BRUSH_CONFIG" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L11 | neighbors=[retouching-engine.ts]
- "photo_retouching_engine_retouchingengine_createstroke": ".createStroke()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L320 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L375 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_generatebrushmask": ".generateBrushMask()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L331 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_getbrushconfig": ".getBrushConfig()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L29 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_getclonesource": ".getCloneSource()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L45 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_setbrushconfig": ".setBrushConfig()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L25 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_setbrushhardness": ".setBrushHardness()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L37 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_setbrushsize": ".setBrushSize()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L33 | neighbors=[RetouchingEngine]
- "photo_retouching_engine_retouchingengine_setclonesource": ".setCloneSource()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L41 | neighbors=[RetouchingEngine]
- "photo_types_layertype": "LayerType" | kind=code-symbol | source=packages/core/src/photo/types.ts:L3 | neighbors=[types.ts]
- "photo_types_retouchingtool": "RetouchingTool" | kind=code-symbol | source=packages/core/src/photo/types.ts:L96 | neighbors=[types.ts]
- "playback_master_timeline_clock_clockoptions": "ClockOptions" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L8 | neighbors=[master-timeline-clock.ts]
- "playback_master_timeline_clock_mastertimelineclock_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L36 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_currenttime": ".currentTime()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L42 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_drift": ".drift()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L77 | neighbors=[MasterTimelineClock]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-090.json

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
