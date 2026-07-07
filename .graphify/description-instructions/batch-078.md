# Node Description Batch 79 of 128

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

- "actions_action_serializer_actionserializer_serialize": ".serialize()" | kind=code-symbol | source=packages/core/src/actions/action-serializer.ts:L4 | neighbors=[ActionSerializer]
- "actions_action_serializer_actionserializer_serializemany": ".serializeMany()" | kind=code-symbol | source=packages/core/src/actions/action-serializer.ts:L23 | neighbors=[ActionSerializer]
- "ai_auto_reframe_engine_aspect_ratio_presets": "ASPECT_RATIO_PRESETS" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L29 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_aspectratioconfig": "AspectRatioConfig" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L21 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_aspectratiopreset": "AspectRatioPreset" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L1 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_autoreframeengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L627 | neighbors=[AutoReframeEngine]
- "ai_auto_reframe_engine_autoreframeengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L170 | neighbors=[AutoReframeEngine]
- "ai_auto_reframe_engine_autoreframeengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L182 | neighbors=[AutoReframeEngine]
- "ai_auto_reframe_engine_autoreframeengine_reframeframe": ".reframeFrame()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L259 | neighbors=[AutoReframeEngine]
- "ai_auto_reframe_engine_default_reframe_settings": "DEFAULT_REFRAME_SETTINGS" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L145 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_detectedface": "DetectedFace" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L118 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_getautoreframeengine": "getAutoReframeEngine()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L641 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_platform_presets": "PLATFORM_PRESETS" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L52 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_platformpreset": "PlatformPreset" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L10 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_progresscallback": "ProgressCallback" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L162 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_reframekeyframe": "ReframeKeyframe" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L126 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_reframeresult": "ReframeResult" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L154 | neighbors=[auto-reframe-engine.ts]
- "ai_auto_reframe_engine_reframesettings": "ReframeSettings" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L135 | neighbors=[auto-reframe-engine.ts]
- "ai_background_removal_engine_backgroundmode": "BackgroundMode" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L3 | neighbors=[background-removal-engine.ts]
- "ai_background_removal_engine_backgroundremovalengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L44 | neighbors=[BackgroundRemovalEngine]
- "ai_background_removal_engine_backgroundremovalengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L71 | neighbors=[BackgroundRemovalEngine]
- "ai_background_removal_engine_backgroundremovalengine_setbackgroundimage": ".setBackgroundImage()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L89 | neighbors=[BackgroundRemovalEngine]
- "ai_background_removal_engine_backgroundremovalengine_setsettings": ".setSettings()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L75 | neighbors=[BackgroundRemovalEngine]
- "ai_background_removal_engine_backgroundremovalsettings": "BackgroundRemovalSettings" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L10 | neighbors=[background-removal-engine.ts]
- "ai_background_removal_engine_default_background_settings": "DEFAULT_BACKGROUND_SETTINGS" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L21 | neighbors=[background-removal-engine.ts]
- "ai_background_removal_engine_progresscallback": "ProgressCallback" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L30 | neighbors=[background-removal-engine.ts]
- "ai_person_segmentation_engine_personsegmentationengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L69 | neighbors=[PersonSegmentationEngine]
- "ai_person_segmentation_engine_personsegmentationengine_setsegmentinterval": ".setSegmentInterval()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L73 | neighbors=[PersonSegmentationEngine]
- "ai_person_segmentation_engine_segmentationresult": "SegmentationResult" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L6 | neighbors=[person-segmentation-engine.ts]
- "animation_animation_exporter_groupedkeyframes": "GroupedKeyframes" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L41 | neighbors=[animation-exporter.ts]
- "animation_composition_renderer_compositionrenderer_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L454 | neighbors=[CompositionRenderer]
- "animation_composition_renderer_compositionrenderer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L20 | neighbors=[CompositionRenderer]
- "animation_composition_renderer_compositionrenderer_resize": ".resize()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L449 | neighbors=[CompositionRenderer]
- "animation_easing_functions_bounceout": "bounceOut()" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L59 | neighbors=[easing-functions.ts]
- "animation_gsap_engine_gsap_easing_map": "GSAP_EASING_MAP" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L35 | neighbors=[gsap-engine.ts]
- "animation_gsap_engine_gsapanimationengine_createtimeline": ".createTimeline()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L340 | neighbors=[GSAPAnimationEngine]
- "animation_gsap_engine_gsapanimationengine_getmotionpath": ".getMotionPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L373 | neighbors=[GSAPAnimationEngine]
- "animation_gsap_engine_gsapanimationengine_gettimeline": ".getTimeline()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L357 | neighbors=[GSAPAnimationEngine]
- "animation_gsap_engine_gsapanimationengine_removemotionpath": ".removeMotionPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L377 | neighbors=[GSAPAnimationEngine]
- "animation_gsap_engine_gsapanimationengine_removetimeline": ".removeTimeline()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L361 | neighbors=[GSAPAnimationEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-078.json

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
