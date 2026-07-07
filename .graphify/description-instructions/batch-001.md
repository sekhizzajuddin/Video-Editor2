# Node Description Batch 2 of 128

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

- "export_export_engine": "export-engine.ts" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1 | neighbors=[audio-engine.ts, AudioEngine, getAudioEngine(), downloadBlob(), ExportEngine, getExportEngine()]
- "public_puter_en": "En" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .#a(), .addUsersToGroup(), .constructor(), .createGroup(), .grantApp()]
- "text_text_animation_presets": "text-animation-presets.ts" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L1 | neighbors=[character-animator.ts, index.ts, easing-functions.ts, EASING_FUNCTIONS, EasingName, AnimatedUnit]
- "audio_audio_engine_audioengine": "AudioEngine" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L116 | neighbors=[audio-engine.ts, .applyEffect(), .applyFades(), .applyVolumeAutomation(), .clearCache(), .constructor()]
- "audio_sound_generator_soundgenerator": "SoundGenerator" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L186 | neighbors=[sound-generator.ts, getSoundGenerator(), .audioBufferToBlob(), .createCrispSnare(), .createPluckySynth(), .createPunchyKick()]
- "components_timeline": "Timeline.tsx" | kind=code-symbol | source=src/components/Timeline.tsx:L1 | neighbors=[audioBufferToWav(), checkOverlapAt(), CLIP_COLORS, FloatingScrubTooltip(), formatCentisecondTime(), formatDetailedTooltipTime()]
- "export_export_engine_exportengine": "ExportEngine" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L27 | neighbors=[export-engine.ts, .calculateStats(), .calculateTimelineDuration(), .cancel(), .createError(), .createPreset()]
- "src_app": "App.tsx" | kind=code-symbol | source=src/App.tsx:L1 | neighbors=[AudioMixer.tsx, AudioMixer(), ExportModal.tsx, ExportModal(), HelpModal.tsx, HelpModal()]
- "types_composition": "composition.ts" | kind=code-symbol | source=packages/core/src/types/composition.ts:L1 | neighbors=[composition-renderer.ts, AudioBinding, AudioLayer, BaseLayer, BezierPath, BezierPoint]
- "video_speed_engine_speedengine": "SpeedEngine" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L32 | neighbors=[speed-engine.ts, getSpeedEngine(), initializeSpeedEngine(), .addSpeedKeyframe(), .calculateSourceTimeWithVariableSpeed(), .calculateVariableSpeedDuration()]
- "utils_immutable_updates": "immutable-updates.ts" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L1 | neighbors=[action-executor.ts, timeline.ts, Clip, Effect, Keyframe, Timeline]
- "text_types": "types.ts" | kind=code-symbol | source=packages/core/src/text/types.ts:L1 | neighbors=[animation-exporter.ts, animation-importer.ts, resolver.ts, types.ts, character-animator.ts, index.ts]
- "types_actions": "actions.ts" | kind=code-symbol | source=packages/core/src/types/actions.ts:L1 | neighbors=[action-executor.ts, action-history.ts, action-serializer.ts, action-validator.ts, inverse-action-generator.ts, clip-manager.ts]
- "video_index": "index.ts" | kind=code-symbol | source=packages/core/src/video/index.ts:L1 | neighbors=[index.ts, index.ts, index.ts, index.ts, index.ts, adjustment-layer-engine.ts]
- "graphics_graphics_engine": "graphics-engine.ts" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1 | neighbors=[export-engine.ts, AnimatedGraphicState, GraphicsEngine, types.ts, ArrowProperties, CreateShapeParams]
- "src_operations_test": "operations.test.ts" | kind=code-symbol | source=packages/image-core/src/operations.test.ts:L1 | neighbors=[operations.ts, addLayerToProject(), createProjectDocument(), deserializeProject(), duplicateLayerInProject(), removeLayerFromProject()]
- "utils_projectpersistence": "projectPersistence.ts" | kind=code-symbol | source=src/utils/projectPersistence.ts:L1 | neighbors=[MediaPanel.tsx, PropertiesPanel.tsx, SettingsModal.tsx, TopToolbar.tsx, WelcomeScreen.tsx, App.tsx]
- "actions_action_executor": "action-executor.ts" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1 | neighbors=[ActionExecutor, action-history.ts, ActionHistory, action-validator.ts, ActionValidator, inverse-action-generator.ts]
- "actions_action_history_actionhistory": "ActionHistory" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L109 | neighbors=[action-executor.ts, action-history.ts, .beginGroup(), .canRedo(), .canUndo(), .clear()]
- "audio_audio_effects_engine_audioeffectsengine": "AudioEffectsEngine" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L656 | neighbors=[audio-effects-engine.ts, .applyEffectChain(), .applyNoiseReductionWithProfile(), .applyNoiseReductionWithProfileData(), .buildEffectChain(), .clearImpulseResponseCache()]
- "media_mediabunny_engine_mediabunnyengine": "MediaBunnyEngine" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L151 | neighbors=[index.ts, media-import-service.ts, mediabunny-engine.ts, getMediaEngine(), .checkCodecSupport(), .clearFrameCache()]
- "playback_playback_controller": "playback-controller.ts" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L1 | neighbors=[index.ts, audio-effect-routing.ts, getPanFromAudioEffects(), getPreviewAudioEffects(), audio-engine.ts, AudioEngine]
- "video_gpu_compositor_gpucompositor": "GPUCompositor" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L32 | neighbors=[gpu-compositor.ts, getGPUCompositor(), .addLayer(), .clearLayers(), .composite(), .compositeToCanvas()]
- "video_keyframe_engine_keyframeengine": "KeyframeEngine" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L52 | neighbors=[keyframe-engine.ts, .addKeyframe(), .applyEasing(), .applyEasingPreset(), .bounce(), .clearClipboard()]
- "components_mediapanel": "MediaPanel.tsx" | kind=code-symbol | source=src/components/MediaPanel.tsx:L1 | neighbors=[COLOR_CORRECTION_EFFECTS, FX_EFFECTS, MediaPanel(), PARTICLE_EFFECTS, TEXT_TEMPLATES, TransitionCard()]
- "playback_master_timeline_clock_mastertimelineclock": "MasterTimelineClock" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L13 | neighbors=[realtime-audio-graph.ts, master-timeline-clock.ts, getMasterClock(), initializeMasterClock(), .constructor(), .currentTime()]
- "video_motion_tracking_engine_motiontrackingengine": "MotionTrackingEngine" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L73 | neighbors=[motion-tracking-engine.ts, getMotionTrackingEngine(), initializeMotionTrackingEngine(), .applyTrackingToElement(), .cancelTracking(), .clear()]
- "video_transition_engine_transitionengine": "TransitionEngine" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L25 | neighbors=[transition-engine.ts, createTransitionEngine(), transition-engine.test.ts, .applyEasing(), .areClipsAdjacent(), .calculateTransitionProgress()]
- "media_ffmpeg_fallback_ffmpegfallback": "FFmpegFallback" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L102 | neighbors=[ffmpeg-fallback.ts, .calculateBufsize(), .cleanupFiles(), .concatenateSegments(), .convertAudio(), .doLoad()]
- "storage_storage_engine_storageengine": "StorageEngine" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L26 | neighbors=[storage-engine.ts, createStorageEngine(), IStorageEngine, .clearAllData(), .clearCache(), .close()]
- "template_template_engine": "template-engine.ts" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1 | neighbors=[index.ts, BUILTIN_TEMPLATES, createTemplateEngine(), DEFAULT_TRANSFORM, TemplateEngine, project.ts]
- "test_generators": "generators.ts" | kind=code-symbol | source=packages/core/src/test/generators.ts:L1 | neighbors=[actionArb, clipArb, durationArb, easingTypeArb, effectArb, executableActionArb()]
- "types_effects": "effects.ts" | kind=code-symbol | source=packages/core/src/types/effects.ts:L1 | neighbors=[audio-effect-routing.ts, audio-effects-engine.ts, audio-engine.ts, types.ts, audio-match-engine.ts, actions.ts]
- "types_scriptable_template": "scriptable-template.ts" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L1 | neighbors=[template-engine.ts, index.ts, project.ts, ProjectSettings, convertLegacyPlaceholder(), createProjectSettingsFromPreset()]
- "device_device_capabilities": "device-capabilities.ts" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L1 | neighbors=[BenchmarkResult, calculateOverallTier(), checkCodecSupport(), clearBenchmarkCache(), CodecRecommendation, CpuInfo]
- "photo_photo_engine_photoengine": "PhotoEngine" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L22 | neighbors=[photo-engine.ts, getPhotoEngine(), initializePhotoEngine(), .addLayer(), .applyLayerTransform(), .canModifyLayer()]
- "types_project": "project.ts" | kind=code-symbol | source=packages/core/src/types/project.ts:L1 | neighbors=[inverse-action-generator.ts, animation-exporter.ts, animation-importer.ts, audio-engine.ts, export-engine.ts, media-import-service.ts]
- "utils_canvaseffects": "canvasEffects.ts" | kind=code-symbol | source=src/utils/canvasEffects.ts:L1 | neighbors=[PreviewCanvas.tsx, SettingsModal.tsx, index.ts, ClipParticleSettings, aiBackground.ts, applyAiBackgroundMask()]
- "video_playback_engine_playbackengine": "PlaybackEngine" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L37 | neighbors=[playback-engine.ts, getPlaybackEngine(), .clearBuffer(), .clearStreams(), .configure(), .decodeLoop()]
- "types_transitions": "transitions.ts" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L1 | neighbors=[index.ts, composition.ts, EasingFunction, Vector2D, BaseTransition, BlurTransition]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-001.json

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
