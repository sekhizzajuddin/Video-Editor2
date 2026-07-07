# Node Description Batch 25 of 128

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

- "video_video_effects_engine_videoeffectsengine_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1547 | neighbors=[getVideoEffectsEngine(), getVideoEffectsEngineAsync(), VideoEffectsEngine, .createRenderTexture()]
- "video_video_effects_engine_videoeffectsengine_smoothstep": ".smoothstep()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1166 | neighbors=[VideoEffectsEngine, .applyChromaKey(), .applyTonal(), .applyVignette()]
- "video_video_engine_getvideoengine": "getVideoEngine()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2867 | neighbors=[export-engine.ts, video-engine.ts, VideoEngine, initializeVideoEngine()]
- "video_video_engine_videoengine_cacheframe": ".cacheFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2433 | neighbors=[VideoEngine, .evictIfNeeded(), .preloadFrames(), .preloadFramesRange()]
- "video_video_engine_videoengine_composite": ".composite()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2365 | neighbors=[VideoEngine, .compositeFrame(), .ensureCompositeCanvas(), .getCanvasBlendMode()]
- "video_video_engine_videoengine_createcliprenderinfo": ".createClipRenderInfo()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1509 | neighbors=[VideoEngine, .getAnimatedEffects(), .getAnimatedTransform(), .renderFrame()]
- "video_video_engine_videoengine_decodeclipbitmap": ".decodeClipBitmap()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1374 | neighbors=[VideoEngine, .decodeFrameWithMediaBunny(), .decodeFrameWithVideoElement(), .renderActiveTransition()]
- "video_video_engine_videoengine_drawmaskedsubjectfromframe": ".drawMaskedSubjectFromFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1025 | neighbors=[VideoEngine, .initialize(), .isInitialized(), .renderTextClipWithSubjectMask()]
- "video_video_engine_videoengine_evictifneeded": ".evictIfNeeded()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2449 | neighbors=[VideoEngine, .cacheFrame(), .evictOldestFrame(), .getTotalCacheSize()]
- "video_video_engine_videoengine_renderactivetransition": ".renderActiveTransition()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1443 | neighbors=[VideoEngine, .decodeClipBitmap(), .findActiveTransition(), .renderFrame()]
- "video_video_engine_videoengine_rendertextclipwithsubjectmask": ".renderTextClipWithSubjectMask()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1065 | neighbors=[VideoEngine, .renderFrame(), .drawMaskedSubjectFromFrame(), .renderTextClipToCanvasCtx()]
- "video_webgpu_renderer_impl_webgpurenderer_createframebuffers": ".createFrameBuffers()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L209 | neighbors=[WebGPURenderer, .destroy(), .initialize(), .resize()]
- "video_webgpu_renderer_impl_webgpurenderer_endframe": ".endFrame()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L576 | neighbors=[WebGPURenderer, .destroy(), .renderFrameBufferToScreen(), .renderLayersToPass()]
- "video_webgpu_renderer_impl_webgpurenderer_recreatedevice": ".recreateDevice()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L941 | neighbors=[WebGPURenderer, .attemptDeviceRecreation(), .destroy(), .initialize()]
- "video_webgpu_renderer_impl_webgpurenderer_renderlayerstopass": ".renderLayersToPass()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L667 | neighbors=[WebGPURenderer, .endFrame(), .renderLayerWithBorderRadius(), .renderLayerWithTransform()]
- "wav_index_initwasmwav": "initWasmWav()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L61 | neighbors=[index.ts, index.ts, loadWasmModule(), .ensureWasm()]
- "wav_index_preloadwasmwav": "preloadWasmWav()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L338 | neighbors=[index.ts, index.ts, getWavEncoder(), .ensureWasm()]
- "actions_action_executor_actionexecutor_applyclipaction": ".applyClipAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L448 | neighbors=[ActionExecutor, .applyAction(), .findClip()]
- "actions_action_executor_actionexecutor_applymediaaction": ".applyMediaAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L267 | neighbors=[ActionExecutor, .applyAction(), .inferMediaType()]
- "actions_action_executor_actionexecutor_applysubtitleaction": ".applySubtitleAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1365 | neighbors=[ActionExecutor, .applyAction(), .parseSrtTime()]
- "actions_action_executor_actionexecutor_applytransitionaction": ".applyTransitionAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1198 | neighbors=[ActionExecutor, .applyAction(), .findClip()]
- "actions_action_executor_actionexecutor_execute": ".execute()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L50 | neighbors=[ActionExecutor, .applyAction(), .executeMany()]
- "actions_action_executor_actionexecutor_findclip": ".findClip()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1476 | neighbors=[ActionExecutor, .applyClipAction(), .applyTransitionAction()]
- "actions_action_executor_actionexecutor_undo": ".undo()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L105 | neighbors=[ActionExecutor, .applyAction(), .resolveSpecialMarkers()]
- "actions_action_history_actionhistory_createsnapshot": ".createSnapshot()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L269 | neighbors=[ActionHistory, .notify(), .push()]
- "actions_action_history_actionhistory_redogroup": ".redoGroup()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L247 | neighbors=[ActionHistory, .push(), .redo()]
- "actions_action_history_actionhistory_undogroup": ".undoGroup()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L215 | neighbors=[ActionHistory, .push(), .undo()]
- "actions_action_validator_actionvalidator_validatetrackaction": ".validateTrackAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L194 | neighbors=[ActionValidator, .validateActionType(), .findTrack()]
- "actions_action_validator_actionvalidator_validatetransitionaction": ".validateTransitionAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L808 | neighbors=[ActionValidator, .validateActionType(), .findClip()]
- "actions_inverse_action_generator_inverseactiongenerator_generateprojectinverse": ".generateProjectInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L90 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction()]
- "actions_inverse_action_generator_inverseactiongenerator_generatesubtitleinverse": ".generateSubtitleInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L531 | neighbors=[InverseActionGenerator, .generate(), .createInverseAction()]
- "ai_auto_reframe_engine_autoreframeengine_detectfaces": ".detectFaces()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L309 | neighbors=[AutoReframeEngine, .analyzeClip(), .detectFacesSimple()]
- "ai_auto_reframe_engine_autoreframeengine_detectfacessimple": ".detectFacesSimple()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L322 | neighbors=[AutoReframeEngine, .detectFaces(), .detectSkinRegions()]
- "ai_auto_reframe_engine_autoreframeengine_findconnectedregions": ".findConnectedRegions()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L395 | neighbors=[AutoReframeEngine, .detectSkinRegions(), .floodFillRegion()]
- "ai_background_removal_engine_backgroundremovalengine_rendercolorbackground": ".renderColorBackground()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L365 | neighbors=[BackgroundRemovalEngine, .processFrame(), .renderImageBackground()]
- "ai_background_removal_engine_backgroundremovalengine_renderimagebackground": ".renderImageBackground()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L395 | neighbors=[BackgroundRemovalEngine, .processFrame(), .renderColorBackground()]
- "animation_animation_exporter_animationexporter_exportimageclip": ".exportImageClip()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L311 | neighbors=[AnimationExporter, .export(), .convertKeyframesToAnimations()]
- "animation_animation_exporter_animationexporter_exporttextclip": ".exportTextClip()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L182 | neighbors=[AnimationExporter, .export(), .convertKeyframesToAnimations()]
- "animation_animation_exporter_animationexporter_exportvideoclip": ".exportVideoClip()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L342 | neighbors=[AnimationExporter, .export(), .convertKeyframesToAnimations()]
- "animation_animation_exporter_exportanimationtojson": "exportAnimationToJSON()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L446 | neighbors=[animation-exporter.ts, exportAnimation(), index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-024.json

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
