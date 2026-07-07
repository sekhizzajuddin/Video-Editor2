# Node Description Batch 124 of 128

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

- "video_transform_animator_transformanimator_rotatepointaroundanchor": ".rotatePointAroundAnchor()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L345 | neighbors=[TransformAnimator]
- "video_transform_animator_transformmatrix": "TransformMatrix" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L29 | neighbors=[transform-animator.ts]
- "video_transition_engine_easingfunction": "EasingFunction" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L23 | neighbors=[transition-engine.ts]
- "video_transition_engine_test_makeclip": "makeClip()" | kind=code-symbol | source=packages/core/src/video/transition-engine.test.ts:L5 | neighbors=[transition-engine.test.ts]
- "video_transition_engine_transitionengine_calculatetransitionprogress": ".calculateTransitionProgress()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L612 | neighbors=[TransitionEngine]
- "video_transition_engine_transitionengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L673 | neighbors=[TransitionEngine]
- "video_transition_engine_transitionengine_getavailabletransitiontypes": ".getAvailableTransitionTypes()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L661 | neighbors=[TransitionEngine]
- "video_transition_engine_transitionengine_getenginedimensions": ".getEngineDimensions()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L643 | neighbors=[TransitionEngine]
- "video_transition_engine_transitionengine_istimeintransition": ".isTimeInTransition()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L631 | neighbors=[TransitionEngine]
- "video_transition_engine_transitionengine_removetransition": ".removeTransition()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L605 | neighbors=[TransitionEngine]
- "video_transition_engine_transitionengineconfig": "TransitionEngineConfig" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L17 | neighbors=[transition-engine.ts]
- "video_transition_engine_transitionrenderresult": "TransitionRenderResult" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L4 | neighbors=[transition-engine.ts]
- "video_transition_engine_transitionvalidationresult": "TransitionValidationResult" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L10 | neighbors=[transition-engine.ts]
- "video_types_videotrackrenderinfo": "VideoTrackRenderInfo" | kind=code-symbol | source=packages/core/src/video/types.ts:L62 | neighbors=[types.ts]
- "video_unified_effects_processor_colorgradingparams": "ColorGradingParams" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L4 | neighbors=[unified-effects-processor.ts]
- "video_unified_effects_processor_processingresult": "ProcessingResult" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L15 | neighbors=[unified-effects-processor.ts]
- "video_unified_effects_processor_unifiedeffectsprocessor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L29 | neighbors=[UnifiedEffectsProcessor]
- "video_unified_effects_processor_unifiedeffectsprocessor_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L243 | neighbors=[UnifiedEffectsProcessor]
- "video_unified_effects_processor_unifiedeffectsprocessor_isusinggpu": ".isUsingGPU()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L239 | neighbors=[UnifiedEffectsProcessor]
- "video_unified_effects_processor_unifiedeffectsprocessor_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L230 | neighbors=[UnifiedEffectsProcessor]
- "video_video_effects_engine_effect": "Effect" | kind=code-symbol | neighbors=[OrderedEffect]
- "video_video_effects_engine_filterresult": "FilterResult" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L9 | neighbors=[video-effects-engine.ts]
- "video_video_effects_engine_filtertype": "FilterType" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L340 | neighbors=[video-effects-engine.ts]
- "video_video_effects_engine_shaderprogram": "ShaderProgram" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L334 | neighbors=[video-effects-engine.ts]
- "video_video_effects_engine_test_createmockcontext": "createMockContext()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.test.ts:L5 | neighbors=[video-effects-engine.test.ts]
- "video_video_effects_engine_videoeffectsconfig": "VideoEffectsConfig" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L19 | neighbors=[video-effects-engine.ts]
- "video_video_effects_engine_videoeffectsengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L381 | neighbors=[VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_geteffectorder": ".getEffectOrder()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1533 | neighbors=[VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_getrenderer": ".getRenderer()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1648 | neighbors=[VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_getrenderertype": ".getRendererType()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1634 | neighbors=[VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_isusingwebgpu": ".isUsingWebGPU()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1644 | neighbors=[VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_removeeffect": ".removeEffect()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1518 | neighbors=[VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_reordereffects": ".reorderEffects()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1522 | neighbors=[VideoEffectsEngine]
- "video_video_engine_default_cache_config": "DEFAULT_CACHE_CONFIG" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L57 | neighbors=[video-engine.ts]
- "video_video_engine_framerenderoptions": "FrameRenderOptions" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L64 | neighbors=[video-engine.ts]
- "video_video_engine_videoengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L116 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_getavailablefilters": ".getAvailableFilters()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2739 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_getcompositebuffer": ".getCompositeBuffer()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L187 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_getgpucompositor": ".getGPUCompositor()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L196 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_getparalleldecoder": ".getParallelDecoder()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L178 | neighbors=[VideoEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-123.json

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
