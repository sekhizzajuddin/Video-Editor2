# Node Description Batch 5 of 128

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

- "video_webgpu_renderer_impl": "webgpu-renderer-impl.ts" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1 | neighbors=[index.ts, renderer-factory.ts, index.ts, createLayerUniformsBuffer(), createTransformMatrix(), createTransformUniformsBuffer()]
- "actions_action_validator_actionvalidator": "ActionValidator" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L19 | neighbors=[action-executor.ts, action-validator.ts, .findClip(), .findTrack(), .validate(), .validateActionType()]
- "audio_beat_detection_engine_beatdetectionengine": "BeatDetectionEngine" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L37 | neighbors=[beat-detection-engine.ts, .analyzeAudioBuffer(), .analyzeFromBlob(), .analyzeFromUrl(), .calculateAdaptiveThreshold(), .calculateBpm()]
- "audio_index": "index.ts" | kind=code-symbol | source=packages/core/src/audio/index.ts:L1 | neighbors=[audio-effect-routing.ts, audio-effects-engine.ts, audio-engine.ts, beat-detection-engine.ts, clip-audio-resolution.ts, clip-volume-automation.ts]
- "audio_realtime_processor_trackprocessor": "TrackProcessor" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L186 | neighbors=[realtime-processor.ts, .createTrackProcessor(), .constructor(), .createEffectNode(), .createEffectNodes(), .createEQNode()]
- "audio_volume_automation": "volume-automation.ts" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L1 | neighbors=[clip-volume-automation.ts, index.ts, AudioBezierControlPoints, AudioDucker, AutomationCurve, clampVolume()]
- "frame_interpolation_index": "index.ts" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/index.ts:L1 | neighbors=[flow-field-cache.ts, FlowFieldCache, frame-interpolation-engine.ts, disposeFrameInterpolationEngine(), FrameInterpolationEngine, getFrameInterpolationEngine()]
- "photo_photo_adjustments_photoadjustmentengine": "PhotoAdjustmentEngine" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L10 | neighbors=[photo-adjustments.ts, getPhotoAdjustmentEngine(), .addAdjustmentToLayer(), .applyAdjustments(), .applyBrightness(), .applyContrast()]
- "photo_retouching_engine_retouchingengine": "RetouchingEngine" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L19 | neighbors=[retouching-engine.ts, getRetouchingEngine(), .cloneStamp(), .cloneStampStroke(), .createStroke(), .dispose()]
- "text_character_animator": "character-animator.ts" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L1 | neighbors=[AnimatedCharacter, AnimatedLine, AnimatedTextLayout, AnimatedWord, CharacterAnimator, CharacterInfo]
- "text_text_animation_textanimationengine_applypreset": ".applyPreset()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L148 | neighbors=[TextAnimationEngine, .applyBlur(), .applyBounce(), .applyFade(), .applyFlip(), .applyGlitch()]
- "ui_carousel": "carousel.tsx" | kind=code-symbol | source=src/components/ui/carousel.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), Carousel(), CarouselApi]
- "ui_command": "command.tsx" | kind=code-symbol | source=src/components/ui/command.tsx:L1 | neighbors=[utils.ts, cn(), Command(), CommandDialog(), CommandEmpty(), CommandGroup()]
- "ui_context_menu": "context-menu.tsx" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L1 | neighbors=[utils.ts, cn(), ContextMenu(), ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuGroup()]
- "ui_dropdown_menu": "dropdown-menu.tsx" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L1 | neighbors=[utils.ts, cn(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup()]
- "ui_field": "field.tsx" | kind=code-symbol | source=src/components/ui/field.tsx:L1 | neighbors=[utils.ts, cn(), Field(), FieldContent(), FieldDescription(), FieldError()]
- "video_decode_worker": "decode-worker.ts" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L1 | neighbors=[CachedResource, clearCache(), createDecodeWorkerBlob(), createDecodeWorkerUrl(), decodeFrame(), DecodeRequest]
- "ai_auto_reframe_engine": "auto-reframe-engine.ts" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L1 | neighbors=[ASPECT_RATIO_PRESETS, AspectRatioConfig, AspectRatioPreset, AutoReframeEngine, DEFAULT_REFRAME_SETTINGS, DetectedFace]
- "animation_gsap_engine_gsapanimationengine": "GSAPAnimationEngine" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L336 | neighbors=[gsap-engine.ts, getGSAPEngine(), .addGSAPMotionPathPoint(), .createTimeline(), .dispose(), .getMotionPath()]
- "audio_audio_effect_routing": "audio-effect-routing.ts" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L1 | neighbors=[getPanFromAudioEffects(), getPreviewAudioEffects(), isFiniteNumberArray(), isSerializedNoiseProfile(), isValidFftSize(), SerializedNoiseProfile]
- "audio_types": "types.ts" | kind=code-symbol | source=packages/core/src/audio/types.ts:L1 | neighbors=[audio-engine.ts, index.ts, AudioChannelState, AudioClipRenderInfo, AudioEffectNodeConfig, AudioEngineConfig]
- "components_settingsmodal": "SettingsModal.tsx" | kind=code-symbol | source=src/components/SettingsModal.tsx:L1 | neighbors=[SettingsModal(), editorStore.ts, useEditorStore, canvasEffects.ts, clearPreviewCaches(), keyboardShortcuts.ts]
- "fft_index_wasmfft": "WasmFFT" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L79 | neighbors=[noise-reduction.ts, index.ts, getWasmFFT(), .applyHannWindow(), .applySynthesisWindow(), .constructor()]
- "photo_photo_engine": "photo-engine.ts" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L1 | neighbors=[index.ts, getPhotoEngine(), initializePhotoEngine(), PhotoEngine, PhotoEngineConfig, types.ts]
- "playback_types": "types.ts" | kind=code-symbol | source=packages/core/src/playback/types.ts:L1 | neighbors=[index.ts, playback-controller.ts, types.ts, RenderedAudio, AudioRenderResult, DEFAULT_PLAYBACK_CONFIG]
- "public_puter_en_req": ".req_()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En, .addUsersToGroup(), .createGroup(), .grantApp(), .grantAppAnyUser(), .grantGroup()]
- "public_puter_xn": "Xn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, Xn, ._applyTheme(), .close(), .connectedCallback(), .constructor()]
- "src_selection": "selection.ts" | kind=code-symbol | source=packages/image-core/src/selection.ts:L1 | neighbors=[index.ts, boundsFromPath(), ColorRangeOptions, combineSelections(), createEmptySelection(), DEFAULT_COLOR_RANGE_OPTIONS]
- "storage_cache_manager_cachemanager": "CacheManager" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L22 | neighbors=[cache-manager.ts, .clearFrameCache(), .constructor(), .createFrameKey(), .deleteFrame(), .deleteWaveform()]
- "storage_project_serializer_projectserializer": "ProjectSerializer" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L12 | neighbors=[project-serializer.ts, createProjectSerializer(), .constructor(), .deleteProject(), .exportToJson(), .exportToJsonWithMetadata()]
- "text_subtitle_engine": "subtitle-engine.ts" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L1 | neighbors=[index.ts, DEFAULT_SUBTITLE_STYLE, exportSRT(), formatSRTTimestamp(), generateSubtitleId(), normalizeSRT()]
- "text_transcription_service": "transcription-service.ts" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L1 | neighbors=[index.ts, CloudflareWhisperResponse, CloudflareWhisperWord, DEFAULT_SUBTITLE_STYLE, disposeTranscriptionService(), getTranscriptionService()]
- "timeline_track_manager": "track-manager.ts" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L1 | neighbors=[index.ts, action-executor.ts, ActionExecutor, action-history.ts, ActionHistory, canAcceptMediaType()]
- "ui_input_group": "input-group.tsx" | kind=code-symbol | source=src/components/ui/input-group.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), input.tsx, InputGroup()]
- "ui_item": "item.tsx" | kind=code-symbol | source=src/components/ui/item.tsx:L1 | neighbors=[utils.ts, cn(), Item(), ItemActions(), ItemContent(), ItemDescription()]
- "video_color_grading_engine": "color-grading-engine.ts" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L1 | neighbors=[effects.ts, CurvePoint, ColorGradingEngine, ColorGradingResult, ColorWheelValues, CurvesValues]
- "video_composite_engine_compositeengine": "CompositeEngine" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L54 | neighbors=[composite-engine.ts, .applyBlendMode(), .applyChromaKey(), .blendLayerPixels(), .colorBurnChannel(), .colorDodgeChannel()]
- "video_keyframe_engine": "keyframe-engine.ts" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L1 | neighbors=[index.ts, timeline.ts, EasingType, Keyframe, animation-engine.ts, AnimationEngine]
- "video_parallel_frame_decoder": "parallel-frame-decoder.ts" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L1 | neighbors=[index.ts, decode-worker.ts, createDecodeWorkerUrl(), DecodeRequest, DecodeResponse, WorkerResponse]
- "video_transition_engine": "transition-engine.ts" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L1 | neighbors=[index.ts, effects.ts, TransitionParams, TransitionType, timeline.ts, Clip]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-004.json

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
