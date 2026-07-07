# Node Description Batch 18 of 128

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

- "video_playback_engine_playbackengine_decodeloop": ".decodeLoop()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L279 | neighbors=[PlaybackEngine, .dispose(), .insertFrameInBuffer(), .sleep(), .startDecoding()]
- "video_playback_engine_playbackengine_setupstreams": ".setupStreams()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L189 | neighbors=[PlaybackEngine, .play(), .seek(), .clearStreams(), .dispose()]
- "video_speed_engine_speedengine_getsourcetimeatplaybacktime": ".getSourceTimeAtPlaybackTime()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L318 | neighbors=[SpeedEngine, .getFrameIndexAtTime(), .getInterpolationInfo(), .calculateSourceTimeWithVariableSpeed(), .getFreezeFrameAtTime()]
- "video_speed_presets": "speed-presets.ts" | kind=code-symbol | source=packages/core/src/video/speed-presets.ts:L1 | neighbors=[index.ts, timeline.ts, EasingType, SPEED_CURVE_PRESETS, SpeedCurvePreset]
- "video_texture_cache_texturecache_set": ".set()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L42 | neighbors=[TextureCache, getCacheKey(), .evictKey(), .evictLRU(), .has()]
- "video_transition_engine_test": "transition-engine.test.ts" | kind=code-symbol | source=packages/core/src/video/transition-engine.test.ts:L1 | neighbors=[timeline.ts, Clip, transition-engine.ts, makeClip(), TransitionEngine]
- "video_unified_effects_processor_unifiedeffectsprocessor_processframe": ".processFrame()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L63 | neighbors=[UnifiedEffectsProcessor, .applyEffect(), .initialize(), .processWithCanvas2D(), .processWithWebGPU()]
- "video_video_effects_engine_test": "video-effects-engine.test.ts" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.test.ts:L1 | neighbors=[timeline.ts, Effect, video-effects-engine.ts, createMockContext(), VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_applyeffectsgpu": "._applyEffectsGPU()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L668 | neighbors=[VideoEffectsEngine, .applyEffectsCPU(), .renderPassthrough(), .renderWithShader(), .uploadTexture()]
- "video_video_effects_engine_videoeffectsengine_doinitialize": ".doInitialize()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L409 | neighbors=[VideoEffectsEngine, .initializeNewRenderer(), .initializeWebGL(), .isWebGL2Supported(), .initialize()]
- "video_video_effects_engine_videoeffectsengine_initializewebgl": ".initializeWebGL()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L456 | neighbors=[VideoEffectsEngine, .doInitialize(), .initializeNewRenderer(), .compileShader(), .createRenderTexture()]
- "video_video_engine_videoengine_decodeframewithmediabunny": ".decodeFrameWithMediaBunny()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L254 | neighbors=[VideoEngine, .decodeClipBitmap(), .initialize(), .decodeInterpolatedFrame(), .renderFrame()]
- "video_video_engine_videoengine_decodeinterpolatedframe": ".decodeInterpolatedFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L317 | neighbors=[VideoEngine, .decodeFrameWithMediaBunny(), .getCachedInterpFrame(), .setCachedInterpFrame(), .renderFrame()]
- "video_video_engine_videoengine_preloadframes": ".preloadFrames()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2535 | neighbors=[VideoEngine, .cacheFrame(), .dispose(), .ensureInitialized(), .getCacheKey()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L70 | neighbors=[WebGPUEffectsProcessor, .createBindGroupLayouts(), .createIntermediateTextures(), .createPipelines(), .createUniformBuffers()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_processeffects": ".processEffects()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L227 | neighbors=[WebGPUEffectsProcessor, .aggregateEffectParams(), .applyBlur(), .applyColorEffects(), .hasColorEffects()]
- "video_webgpu_renderer_impl_webgpurenderer_destroy": ".destroy()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L506 | neighbors=[WebGPURenderer, .createFrameBuffers(), .endFrame(), .recreateDevice(), .releaseTexture()]
- "video_webgpu_renderer_impl_webgpurenderer_initializepipelines": ".initializePipelines()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L328 | neighbors=[WebGPURenderer, .initialize(), .createBorderRadiusPipeline(), .createCompositePipeline(), .createTransformPipeline()]
- "wav_index_getwavencoder": "getWavEncoder()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L331 | neighbors=[export-engine.ts, index.ts, index.ts, WavEncoder, preloadWasmWav()]
- "actions_action_history_actionhistory_redo": ".redo()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L237 | neighbors=[ActionHistory, .notify(), .push(), .redoGroup()]
- "actions_action_history_actionhistory_undo": ".undo()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L205 | neighbors=[ActionHistory, .notify(), .push(), .undoGroup()]
- "actions_action_serializer": "action-serializer.ts" | kind=code-symbol | source=packages/core/src/actions/action-serializer.ts:L1 | neighbors=[ActionSerializer, actions.ts, Action, index.ts]
- "actions_action_validator_actionvalidator_validateaudioaction": ".validateAudioAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L929 | neighbors=[ActionValidator, .validateActionType(), .findClip(), .findTrack()]
- "actions_action_validator_actionvalidator_validateclipaction": ".validateClipAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L334 | neighbors=[ActionValidator, .validateActionType(), .findClip(), .findTrack()]
- "actions_action_validator_actionvalidator_validateeffectaction": ".validateEffectAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L609 | neighbors=[ActionValidator, .validateActionType(), .findClip(), .findTrack()]
- "actions_action_validator_actionvalidator_validatekeyframeaction": ".validateKeyframeAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L754 | neighbors=[ActionValidator, .validateActionType(), .findClip(), .findTrack()]
- "actions_action_validator_actionvalidator_validatetransformaction": ".validateTransformAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L705 | neighbors=[ActionValidator, .validateActionType(), .findClip(), .findTrack()]
- "actions_inverse_action_generator_inverseactiongenerator_generateaudioinverse": ".generateAudioInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L502 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction(), .findClip()]
- "actions_inverse_action_generator_inverseactiongenerator_generateeffectinverse": ".generateEffectInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L339 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction(), .findClip()]
- "actions_inverse_action_generator_inverseactiongenerator_generatekeyframeinverse": ".generateKeyframeInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L412 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction(), .findClip()]
- "actions_inverse_action_generator_inverseactiongenerator_generatemediainverse": ".generateMediaInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L111 | neighbors=[InverseActionGenerator, .generate(), .cloneMediaItem(), .createInverseAction()]
- "actions_inverse_action_generator_inverseactiongenerator_generatetrackinverse": ".generateTrackInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L146 | neighbors=[InverseActionGenerator, .generate(), .cloneTrack(), .createInverseAction()]
- "actions_inverse_action_generator_inverseactiongenerator_generatetransforminverse": ".generateTransformInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L399 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction(), .findClip()]
- "actions_inverse_action_generator_inverseactiongenerator_generatetransitioninverse": ".generateTransitionInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L462 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction(), .findTransition()]
- "ai_auto_reframe_engine_autoreframeengine_detectskinregions": ".detectSkinRegions()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L353 | neighbors=[AutoReframeEngine, .detectFacesSimple(), .findConnectedRegions(), .isSkinColor()]
- "ai_background_removal_engine_backgroundremovalengine_generatesimplemask": ".generateSimpleMask()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L234 | neighbors=[BackgroundRemovalEngine, .calculateSaturation(), .refineMask(), .processFrame()]
- "ai_index": "index.ts" | kind=code-symbol | source=packages/core/src/ai/index.ts:L1 | neighbors=[auto-reframe-engine.ts, background-removal-engine.ts, person-segmentation-engine.ts, index.ts]
- "ai_person_segmentation_engine_getpersonsegmentationengine": "getPersonSegmentationEngine()" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L208 | neighbors=[background-removal-engine.ts, person-segmentation-engine.ts, PersonSegmentationEngine, video-engine.ts]
- "animation_animation_exporter_animationexporter_exportshapeclip": ".exportShapeClip()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L250 | neighbors=[AnimationExporter, .export(), .convertKeyframesToAnimations(), .createShapeDefinition()]
- "animation_animation_exporter_exportanimation": "exportAnimation()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L437 | neighbors=[animation-exporter.ts, .export(), exportAnimationToJSON(), index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-017.json

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
