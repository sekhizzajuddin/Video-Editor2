# Node Description Batch 4 of 128

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

- "audio_volume_automation_volumeautomation": "VolumeAutomation" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L48 | neighbors=[volume-automation.ts, .applyDucking(), getVolumeAutomation(), .applyConstantVolume(), .applyFadeIn(), .applyFadeOut()]
- "effects_particle_engine_particleengine": "ParticleEngine" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L150 | neighbors=[particle-engine.ts, getParticleEngine(), .addEffect(), .createParticle(), .dispose(), .getActiveEffectIds()]
- "media_types": "types.ts" | kind=code-symbol | source=packages/core/src/media/types.ts:L1 | neighbors=[index.ts, media-import-service.ts, mediabunny-engine.ts, AUDIO_QUALITY_PRESETS, AudioCodec, CodecSupport]
- "src_commands_command": "Command" | kind=code-symbol | source=packages/image-core/src/commands.ts:L22 | neighbors=[commands.ts, AddArtboardCommand, AddLayerCommand, ApplyAdjustmentCommand, ApplyMaskCommand, DuplicateLayerCommand]
- "timeline_clip_manager": "clip-manager.ts" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L1 | neighbors=[action-executor.ts, ActionExecutor, action-history.ts, ActionHistory, AddClipParams, ClipManager]
- "timeline_nested_sequence_engine_nestedsequenceengine": "NestedSequenceEngine" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L56 | neighbors=[index.ts, nested-sequence-engine.ts, getNestedSequenceEngine(), .clearAll(), .createCompoundClip(), .createInstance()]
- "types_transform_3d": "transform-3d.ts" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L1 | neighbors=[index.ts, composition.ts, EasingFunction, Vector3D, AutoOrientMode, Camera]
- "video_adjustment_layer_engine_adjustmentlayerengine": "AdjustmentLayerEngine" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L64 | neighbors=[adjustment-layer-engine.ts, .addEffect(), .clearAll(), .createAdjustmentLayer(), .deleteLayer(), .duplicateLayer()]
- "video_frame_ring_buffer_frameringbuffer": "FrameRingBuffer" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L16 | neighbors=[frame-ring-buffer.ts, .constructor(), .getOrCreateTrackBuffer(), .constructor(), .dispose(), .getBufferFillLevel()]
- "video_webgpu_effects_processor_webgpueffectsprocessor": "WebGPUEffectsProcessor" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L34 | neighbors=[webgpu-effects-processor.ts, .aggregateEffectParams(), .applyBlur(), .applyBlurPass(), .applyColorEffects(), .calculateEffectsHash()]
- "actions_action_validator": "action-validator.ts" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L1 | neighbors=[action-executor.ts, ActionValidator, actions.ts, Action, AudioAction, ClipAction]
- "ai_auto_reframe_engine_autoreframeengine": "AutoReframeEngine" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L164 | neighbors=[auto-reframe-engine.ts, .analyzeClip(), .calculateOptimalCrop(), .clearCache(), .detectFaces(), .detectFacesSimple()]
- "animation_gsap_engine": "gsap-engine.ts" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L1 | neighbors=[catmullRomInterpolate(), cubicBezierInterpolate(), disposeGSAPEngine(), easingToGSAP(), generateBezierPath(), generateDefaultControlPoints()]
- "audio_noise_reduction_spectralnoisereducer": "SpectralNoiseReducer" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L28 | neighbors=[audio-effects-engine.ts, noise-reduction.ts, autoLearnNoiseProfile(), .applySpectralSubtraction(), .computeMagnitudeSpectrum(), .computeSpectrum()]
- "media_waveform_generator_waveformgenerator": "WaveformGenerator" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L29 | neighbors=[index.ts, waveform-generator.ts, createWaveformGenerator(), getWaveformGenerator(), .clearAllCache(), .clearCache()]
- "stabilization_index": "index.ts" | kind=code-symbol | source=packages/core/src/video/stabilization/index.ts:L1 | neighbors=[stabilization-engine.ts, disposeStabilizationEngine(), getStabilizationEngine(), getStabilizedTransform(), StabilizationEngine, types.ts]
- "storage_storage_engine": "storage-engine.ts" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L1 | neighbors=[index.ts, createStorageEngine(), createStorageError(), StorageEngine, types.ts, CacheRecord]
- "store_editorstore_useeditorstore": "useEditorStore" | kind=code-symbol | source=src/store/editorStore.ts:L414 | neighbors=[AiMotionGraphicsDesigner.tsx, AiSoundDesigner.tsx, AudioMixer.tsx, ColorScopes.tsx, ExportModal.tsx, HelpModal.tsx]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer": "Canvas2DFallbackRenderer" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L4 | neighbors=[canvas2d-fallback-renderer.ts, .applyEffects(), .beginFrame(), .constructor(), .createTextureFromImage(), .destroy()]
- "video_gpu_compositor": "gpu-compositor.ts" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L1 | neighbors=[timeline.ts, Effect, Transform, CompositorConfig, CompositorStats, createDefaultTransform()]
- "video_renderer_factory": "renderer-factory.ts" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L1 | neighbors=[canvas2d-fallback-renderer.ts, gpu-compositor.ts, index.ts, timeline.ts, Effect, Transform]
- "video_video_effects_engine": "video-effects-engine.ts" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1 | neighbors=[index.ts, timeline.ts, Effect, renderer-factory.ts, isWebGPUSupported(), Renderer]
- "ai_background_removal_engine_backgroundremovalengine": "BackgroundRemovalEngine" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L32 | neighbors=[background-removal-engine.ts, .applyEdgeBlur(), .calculateSaturation(), .dispose(), .generateSimpleMask(), .getSettings()]
- "animation_easing_functions": "easing-functions.ts" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L1 | neighbors=[composition-renderer.ts, ALL_EASING_NAMES, bounceOut(), cubicBezier(), CubicBezierEasing, EASING_CATEGORIES]
- "audio_clip_audio_resolution": "clip-audio-resolution.ts" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L1 | neighbors=[audio-engine.ts, findClipTrack(), getClipAudioTrackIndex(), getLinkedAudioClips(), getTrackTypePriority(), isAlignedLinkedClip()]
- "audio_noise_reduction": "noise-reduction.ts" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L1 | neighbors=[audio-effects-engine.ts, index.ts, fft.ts, FFT, autoLearnNoiseProfile(), DEFAULT_NOISE_REDUCTION_CONFIG]
- "device_export_estimator": "export-estimator.ts" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L1 | neighbors=[device-capabilities.ts, BenchmarkResult, DeviceProfile, saveBenchmarkResult(), BASE_FPS_ESTIMATES, BenchmarkProgress]
- "effects_particle_engine": "particle-engine.ts" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L1 | neighbors=[index.ts, disposeParticleEngine(), generateId(), getEmissionPosition(), getInitialVelocity(), getParticleEngine()]
- "media_ffmpeg_fallback": "ffmpeg-fallback.ts" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L1 | neighbors=[audio-engine.ts, types.ts, ExportProgress, AudioExtractionOptions, AudioProbeResult, AudioStreamInfo]
- "media_waveform_generator": "waveform-generator.ts" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L1 | neighbors=[index.ts, mediabunny-engine.ts, getMediaEngine(), MediaBunnyEngine, types.ts, WaveformCacheEntry]
- "storage_types": "types.ts" | kind=code-symbol | source=packages/core/src/storage/types.ts:L1 | neighbors=[waveform-generator.ts, cache-manager.ts, index.ts, project-serializer.ts, storage-engine.ts, CacheRecord]
- "text_caption_animation_renderer": "caption-animation-renderer.ts" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L1 | neighbors=[AnimatedCaptionFrame, CAPTION_ANIMATION_STYLES, clamp(), easeOutBounce(), getAnimationStyleDisplayName(), renderAnimatedCaption()]
- "text_subtitle_engine_subtitleengine": "SubtitleEngine" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L274 | neighbors=[subtitle-engine.ts, .addSubtitle(), .applyStylePreset(), .clearAllSubtitles(), .exportSRT(), .getSortedSubtitles()]
- "timeline_track_manager_trackmanager": "TrackManager" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L23 | neighbors=[index.ts, track-manager.ts, .addTrack(), .constructor(), .createProjectWrapper(), .getExecutor()]
- "types_timeline_clip": "Clip" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L70 | neighbors=[inverse-action-generator.ts, animation-exporter.ts, animation-importer.ts, audio-engine.ts, clip-audio-resolution.ts, clip-audio-resolution.test.ts]
- "types_timeline_transform": "Transform" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L119 | neighbors=[animation-importer.ts, resolver.ts, types.ts, graphics-engine.ts, types.ts, stabilization-engine.ts]
- "ui_menubar": "menubar.tsx" | kind=code-symbol | source=src/components/ui/menubar.tsx:L1 | neighbors=[utils.ts, cn(), Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarGroup()]
- "video_animation_engine_animationengine": "AnimationEngine" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L21 | neighbors=[graphics-engine.ts, text-animation.ts, animation-engine.ts, .addKeyframe(), .applyEasing(), .clearCache()]
- "video_color_grading_engine_colorgradingengine": "ColorGradingEngine" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L282 | neighbors=[color-grading-engine.ts, .applyColorWheels(), .applyCurves(), .applyHSL(), .applyLUT(), .buildCurveLUT()]
- "video_frame_cache_framecache": "FrameCache" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L10 | neighbors=[frame-cache.ts, .clear(), .clearMedia(), .constructor(), .delete(), .evictIfNeeded()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-003.json

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
