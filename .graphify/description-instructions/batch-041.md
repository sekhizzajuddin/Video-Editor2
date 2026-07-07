# Node Description Batch 42 of 128

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

- "ai_auto_reframe_engine_autoreframeengine_isskincolor": ".isSkinColor()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L382 | neighbors=[AutoReframeEngine, .detectSkinRegions()]
- "ai_auto_reframe_engine_autoreframeengine_smoothkeyframes": ".smoothKeyframes()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L545 | neighbors=[AutoReframeEngine, .analyzeClip()]
- "ai_auto_reframe_engine_disposeautoreframeengine": "disposeAutoReframeEngine()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L652 | neighbors=[auto-reframe-engine.ts, .dispose()]
- "ai_auto_reframe_engine_initializeautoreframeengine": "initializeAutoReframeEngine()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L645 | neighbors=[auto-reframe-engine.ts, AutoReframeEngine]
- "ai_background_removal_engine_backgroundremovalengine_applyedgeblur": ".applyEdgeBlur()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L306 | neighbors=[BackgroundRemovalEngine, .processFrame()]
- "ai_background_removal_engine_backgroundremovalengine_calculatesaturation": ".calculateSaturation()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L262 | neighbors=[BackgroundRemovalEngine, .generateSimpleMask()]
- "ai_background_removal_engine_backgroundremovalengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L444 | neighbors=[BackgroundRemovalEngine, disposeBackgroundRemovalEngine()]
- "ai_background_removal_engine_backgroundremovalengine_getsettings": ".getSettings()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L85 | neighbors=[BackgroundRemovalEngine, .processFrame()]
- "ai_background_removal_engine_backgroundremovalengine_processframefast": ".processFrameFast()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L163 | neighbors=[BackgroundRemovalEngine, .processFrame()]
- "ai_background_removal_engine_backgroundremovalengine_refinemask": ".refineMask()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L269 | neighbors=[BackgroundRemovalEngine, .generateSimpleMask()]
- "ai_background_removal_engine_backgroundremovalengine_renderblurbackground": ".renderBlurBackground()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L332 | neighbors=[BackgroundRemovalEngine, .processFrame()]
- "ai_background_removal_engine_backgroundremovalengine_rendertransparentbackground": ".renderTransparentBackground()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L426 | neighbors=[BackgroundRemovalEngine, .processFrame()]
- "ai_background_removal_engine_disposebackgroundremovalengine": "disposeBackgroundRemovalEngine()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L471 | neighbors=[background-removal-engine.ts, .dispose()]
- "ai_background_removal_engine_getbackgroundremovalengine": "getBackgroundRemovalEngine()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L460 | neighbors=[background-removal-engine.ts, video-engine.ts]
- "ai_background_removal_engine_initializebackgroundremovalengine": "initializeBackgroundRemovalEngine()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L464 | neighbors=[background-removal-engine.ts, BackgroundRemovalEngine]
- "ai_person_segmentation_engine_disposepersonsegmentationengine": "disposePersonSegmentationEngine()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L215 | neighbors=[person-segmentation-engine.ts, .dispose()]
- "ai_person_segmentation_engine_personsegmentationengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L191 | neighbors=[disposePersonSegmentationEngine(), PersonSegmentationEngine]
- "ai_person_segmentation_engine_personsegmentationengine_doinitialize": ".doInitialize()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L42 | neighbors=[PersonSegmentationEngine, .initialize()]
- "ai_person_segmentation_engine_personsegmentationengine_getpersonmask": ".getPersonMask()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L77 | neighbors=[PersonSegmentationEngine, .refineEdges()]
- "ai_person_segmentation_engine_personsegmentationengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L29 | neighbors=[PersonSegmentationEngine, .doInitialize()]
- "ai_person_segmentation_engine_personsegmentationengine_refineedges": ".refineEdges()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L156 | neighbors=[PersonSegmentationEngine, .getPersonMask()]
- "animation_animation_exporter_animationexporter_createshapedefinition": ".createShapeDefinition()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L291 | neighbors=[AnimationExporter, .exportShapeClip()]
- "animation_animation_exporter_animationexporter_exportassets": ".exportAssets()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L147 | neighbors=[AnimationExporter, .export()]
- "animation_animation_exporter_animationexporter_exportaudiotracks": ".exportAudioTracks()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L376 | neighbors=[AnimationExporter, .export()]
- "animation_animation_exporter_exportoptions": "ExportOptions" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L35 | neighbors=[animation-exporter.ts, index.ts]
- "animation_animation_exporter_exportresult": "ExportResult" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L27 | neighbors=[animation-exporter.ts, index.ts]
- "animation_animation_importer_animationimporter_createdefaulttransform": ".createDefaultTransform()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L547 | neighbors=[AnimationImporter, .import()]
- "animation_animation_importer_createdefaultmediametadata": "createDefaultMediaMetadata()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L53 | neighbors=[animation-importer.ts, .import()]
- "animation_animation_importer_importoptions": "ImportOptions" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L47 | neighbors=[animation-importer.ts, index.ts]
- "animation_animation_importer_importresult": "ImportResult" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L37 | neighbors=[animation-importer.ts, index.ts]
- "animation_animation_importer_mapshapetype": "mapShapeType()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L84 | neighbors=[animation-importer.ts, .processShapeLayer()]
- "animation_animation_importer_parsefontweight": "parseFontWeight()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L70 | neighbors=[animation-importer.ts, .processTextLayer()]
- "animation_animation_schema_animatableproperty": "AnimatableProperty" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L334 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_audioasset": "AudioAsset" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L50 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_blendmode": "BlendMode" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L99 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_createemptyanimationschema": "createEmptyAnimationSchema()" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L406 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_default_project_config": "DEFAULT_PROJECT_CONFIG" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L397 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_fontasset": "FontAsset" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L29 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_gradientfill": "GradientFill" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L140 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_gradientstop": "GradientStop" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L146 | neighbors=[animation-schema.ts, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-041.json

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
