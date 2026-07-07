# Node Description Batch 7 of 128

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

- "ui_pagination": "pagination.tsx" | kind=code-symbol | source=src/components/ui/pagination.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), buttonVariants, Pagination()]
- "ui_sheet": "sheet.tsx" | kind=code-symbol | source=src/components/ui/sheet.tsx:L1 | neighbors=[utils.ts, cn(), Sheet(), SheetClose(), SheetContent(), SheetDescription()]
- "utils_audioseparation": "audioSeparation.ts" | kind=code-symbol | source=src/utils/audioSeparation.ts:L1 | neighbors=[index.ts, ClipAudioSettings, createFallbackSeparationNode(), createSeparationNode(), defaultSettings, getFFmpegBandSeparationArgs()]
- "utils_speedramp": "speedRamp.ts" | kind=code-symbol | source=src/utils/speedRamp.ts:L1 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts, editorStore.ts, index.ts, SpeedRampKeyframe]
- "video_composite_engine": "composite-engine.ts" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L1 | neighbors=[CHROMA_KEY_PRESETS, ChromaKeyConfig, CompositeChromaKeyResult, CompositeEngine, CompositeEngineConfig, CompositeLayerInput]
- "video_speed_engine": "speed-engine.ts" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L1 | neighbors=[index.ts, timeline.ts, EasingType, animation-engine.ts, AnimationEngine, ClipSpeedData]
- "video_transform_animator": "transform-animator.ts" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L1 | neighbors=[types.ts, index.ts, timeline.ts, Keyframe, Transform, animation-engine.ts]
- "video_unified_effects_processor_unifiedeffectsprocessor": "UnifiedEffectsProcessor" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L20 | neighbors=[unified-effects-processor.ts, getUnifiedEffectsProcessor(), initUnifiedEffectsProcessor(), .applyEffect(), .buildFilterString(), .constructor()]
- "video_webgpu_effects_processor": "webgpu-effects-processor.ts" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L1 | neighbors=[index.ts, index.ts, createBlurUniformsBuffer(), createDimensionsBuffer(), createEffectUniformsBuffer(), timeline.ts]
- "wav_index": "index.ts" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L1 | neighbors=[export-engine.ts, index.ts, getWavEncoder(), initWasmWav(), isWasmWavAvailable(), jsEncodeWav16Mono()]
- "actions_action_validator_actionvalidator_validateactiontype": ".validateActionType()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L49 | neighbors=[ActionValidator, .validate(), .validateAudioAction(), .validateClipAction(), .validateEffectAction(), .validateKeyframeAction()]
- "ai_background_removal_engine": "background-removal-engine.ts" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L1 | neighbors=[BackgroundMode, BackgroundRemovalEngine, BackgroundRemovalSettings, DEFAULT_BACKGROUND_SETTINGS, disposeBackgroundRemovalEngine(), getBackgroundRemovalEngine()]
- "audio_clip_volume_automation": "clip-volume-automation.ts" | kind=code-symbol | source=packages/core/src/audio/clip-volume-automation.ts:L1 | neighbors=[audio-engine.ts, getAutomationValueAtTime(), getVolumeAutomationPointsForRange(), sanitizePoints(), scheduleVolumeAutomationOnGain(), volume-automation.ts]
- "beat_detection_index_beatdetectionprocessor": "BeatDetectionProcessor" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L182 | neighbors=[beat-detection-engine.ts, index.ts, .calculateMean(), .calculateMedian(), .calculateStdDev(), .computeRMSEnergies()]
- "export_export_engine_exportengine_exportvideo": ".exportVideo()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L213 | neighbors=[ExportEngine, .calculateStats(), .calculateTimelineDuration(), .createError(), .createProgress(), .encodeTimelineAudioToSource()]
- "media_ffmpeg_fallback_ffmpegfallback_ensureloaded": ".ensureLoaded()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L179 | neighbors=[FFmpegFallback, .concatenateSegments(), .convertAudio(), .encodeFrameSequence(), .exportVideoDirectly(), .extractAudioAsWav()]
- "media_ffmpeg_fallback_ffmpegfallback_load": ".load()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L118 | neighbors=[FFmpegFallback, .convertAudio(), .doLoad(), .encodeFrameSequence(), .exportVideoDirectly(), .extractAudioAsWav()]
- "photo_photo_adjustments": "photo-adjustments.ts" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L1 | neighbors=[index.ts, AdjustmentLayerConfig, getPhotoAdjustmentEngine(), PhotoAdjustmentEngine, types.ts, AdjustmentParams]
- "public_puter_cn": "cn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .bindSocketEvents(), .checkCacheAndPurge(), .constructor(), .getCacheTimestamp(), .initializeSocket()]
- "public_puter_kn": "Kn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .#L(), .addIceCandidate(), .close(), .connect(), .constructor()]
- "public_puter_un_get": ".get()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.req_(), .#L(), .call(), T(), ._init(), Un]
- "src_mask": "mask.ts" | kind=code-symbol | source=packages/image-core/src/mask.ts:L1 | neighbors=[commands.ts, commands.test.ts, index.ts, applyMaskToImageData(), createMaskFromImageData(), createMaskFromSelection()]
- "stabilization_motion_path": "motion-path.ts" | kind=code-symbol | source=packages/core/src/video/stabilization/motion-path.ts:L1 | neighbors=[types.ts, FlowField, accumulateMotionPath(), buildGaussianKernel(), computeCorrections(), extractDominantMotion()]
- "stabilization_vidstab_engine_vidstabengine": "VidstabEngine" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L35 | neighbors=[index.ts, vidstab-engine.ts, getVidstabEngine(), .cleanup(), .dispose(), .doLoad()]
- "storage_project_serializer": "project-serializer.ts" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L1 | neighbors=[index.ts, createProjectSerializer(), ProjectFile, ProjectSerializer, schema-types.ts, ProjectFileWithMetadata]
- "storage_storage_engine_storageengine_getdb": ".getDb()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L30 | neighbors=[StorageEngine, .clearAllData(), .clearCache(), .deleteProject(), .openDatabase(), .getStorageUsage()]
- "types_timeline_keyframe": "Keyframe" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L138 | neighbors=[animation-exporter.ts, animation-importer.ts, gsap-engine.ts, graphics-engine.ts, types.ts, title-engine.ts]
- "types_timeline_timeline": "Timeline" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L5 | neighbors=[animation-importer.ts, audio-engine.ts, clip-audio-resolution.ts, clip-audio-resolution.test.ts, template-engine.ts, subtitle-engine.ts]
- "ui_chart": "chart.tsx" | kind=code-symbol | source=src/components/ui/chart.tsx:L1 | neighbors=[utils.ts, cn(), ChartConfig, ChartContainer(), ChartContext, ChartContextProps]
- "ui_drawer": "drawer.tsx" | kind=code-symbol | source=src/components/ui/drawer.tsx:L1 | neighbors=[utils.ts, cn(), Drawer(), DrawerClose(), DrawerContent(), DrawerDescription()]
- "ui_select": "select.tsx" | kind=code-symbol | source=src/components/ui/select.tsx:L1 | neighbors=[utils.ts, cn(), Select(), SelectContent(), SelectGroup(), SelectItem()]
- "upscaling_upscaling_engine": "upscaling-engine.ts" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L1 | neighbors=[index.ts, index.ts, createEdgeDimensionsBuffer(), createLanczosDimensionsBuffer(), createSharpenUniformsBuffer(), getUpscalingEngine()]
- "utils_projectpersistence_getdb": "getDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L91 | neighbors=[projectPersistence.ts, clearProjectDB(), deleteAutosaveFromDB(), deleteFileFromDB(), getAutosavesFromDB(), getFileFromDB()]
- "video_filter_presets": "filter-presets.ts" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L1 | neighbors=[FILTER_CATEGORIES, FILTER_PRESETS, FilterCategory, FilterEffect, FilterEffectParams, FilterEffectType]
- "video_transform_animator_transformanimator": "TransformAnimator" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L49 | neighbors=[transform-animator.ts, .applyMatrixToPoint(), .computeTransformMatrix(), .constructor(), .createOpacityKeyframes(), .createPositionKeyframes()]
- "video_video_effects_engine_videoeffectsengine_applyeffectpixellevel": ".applyEffectPixelLevel()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1014 | neighbors=[VideoEffectsEngine, .applyChromaKey(), .applyChromaticAberration(), .applyGrain(), .applyMotionBlur(), .applyRadialBlur()]
- "actions_inverse_action_generator_inverseactiongenerator_createinverseaction": ".createInverseAction()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L77 | neighbors=[InverseActionGenerator, .generateAudioInverse(), .generateClipInverse(), .generateEffectInverse(), .generateKeyframeInverse(), .generateMediaInverse()]
- "actions_inverse_action_generator_inverseactiongenerator_generate": ".generate()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L19 | neighbors=[InverseActionGenerator, .generateAudioInverse(), .generateClipInverse(), .generateEffectInverse(), .generateKeyframeInverse(), .generateMediaInverse()]
- "animation_animation_exporter_animationexporter": "AnimationExporter" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L45 | neighbors=[animation-exporter.ts, .convertKeyframesToAnimations(), .createShapeDefinition(), .export(), .exportAssets(), .exportAudioTracks()]
- "audio_clip_audio_resolution_test": "clip-audio-resolution.test.ts" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.test.ts:L1 | neighbors=[clip-audio-resolution.ts, resolveAudibleAudioTarget(), resolveClipAudioEffects(), resolveClipVolumeAutomation(), createClip(), createSeparatedAudioTimeline()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-006.json

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
