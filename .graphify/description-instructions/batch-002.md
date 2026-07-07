# Node Description Batch 3 of 128

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

- "video_types": "types.ts" | kind=code-symbol | source=packages/core/src/video/types.ts:L1 | neighbors=[types.ts, graphics-engine.ts, types.ts, playback-controller.ts, types.ts, title-engine.ts]
- "actions_action_executor_actionexecutor": "ActionExecutor" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L38 | neighbors=[action-executor.ts, .applyAction(), .applyAudioAction(), .applyClipAction(), .applyEffectAction(), .applyKeyframeAction()]
- "device_index": "index.ts" | kind=code-symbol | source=packages/core/src/device/index.ts:L1 | neighbors=[device-capabilities.ts, BenchmarkResult, clearBenchmarkCache(), CodecRecommendation, CpuInfo, detectDeviceCapabilities()]
- "public_puter_xt": "xt" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, kt(), .cleanup(), ._close(), .connect(), .constructor()]
- "template_template_engine_templateengine": "TemplateEngine" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1101 | neighbors=[template-engine.ts, createTemplateEngine(), .applyPlaceholderToTarget(), .applyScriptableTemplate(), .applyTemplate(), .convertToTemplateClip()]
- "timeline_clip_manager_clipmanager": "ClipManager" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L40 | neighbors=[clip-manager.ts, .addClip(), .canTrackAcceptClip(), .constructor(), .createProjectWrapper(), .deleteClip()]
- "video_chroma_key_engine_chromakeyengine": "ChromaKeyEngine" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L45 | neighbors=[chroma-key-engine.ts, .applyAndComposite(), .applyChromaKey(), .applyChromaKeyWithSettings(), .calculateAlpha(), .clearAllSettings()]
- "audio_sound_generator_soundgenerator_audiobuffertoblob": ".audioBufferToBlob()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2306 | neighbors=[SoundGenerator, .generateAmbientPad(), .generateArpeggio(), .generateBassline(), .generateBoing(), .generateChordProgression()]
- "export_types": "types.ts" | kind=code-symbol | source=packages/core/src/export/types.ts:L1 | neighbors=[export-engine.ts, export-engine.test.ts, export-worker.ts, index.ts, AudioExportSettings, CODEC_MAP]
- "media_media_import_service": "media-import-service.ts" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L1 | neighbors=[index.ts, ffmpeg-fallback.ts, FFmpegFallback, getFFmpegFallback(), PROXY_THRESHOLDS, ProxySettings]
- "types_shape_tools": "shape-tools.ts" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L1 | neighbors=[index.ts, composition.ts, BezierPath, BezierPoint, Vector2D, createDefaultEllipseConfig()]
- "animation_composition_renderer_compositionrenderer": "CompositionRenderer" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L14 | neighbors=[composition-renderer.ts, .applyEasing(), .applyTransform(), .clearCache(), .constructor(), .createGradient()]
- "assembly_index": "index.ts" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L1 | neighbors=[allocateF32(), allocateI32(), allocateU32(), allocateU8(), applyHannWindow(), calculateMean()]
- "text_speech_to_text_engine": "speech-to-text-engine.ts" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L1 | neighbors=[index.ts, createSpeechToTextEngine(), DEFAULT_OPTIONS, DEFAULT_SUBTITLE_STYLE, ProgressCallback, SegmentCallback]
- "text_text_animation_textanimationengine": "TextAnimationEngine" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L29 | neighbors=[text-animation.ts, .applyBlur(), .applyBounce(), .applyFade(), .applyFlip(), .applyGlitch()]
- "text_title_engine_titleengine": "TitleEngine" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L42 | neighbors=[export-engine.ts, title-engine.ts, .addKeyframe(), .applyEmphasisAnimation(), .applyTextStyle(), .clear()]
- "video_mask_engine": "mask-engine.ts" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1 | neighbors=[index.ts, applyEasing(), BezierPath, BezierPoint, boundsPathFromTransform(), createDefaultMask()]
- "video_video_engine_videoengine_renderframe": ".renderFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L528 | neighbors=[VideoEngine, .applyEmphasisAnimation(), .captureSubjectFrame(), .createClipRenderInfo(), .decodeFrameWithMediaBunny(), .decodeFrameWithVideoElement()]
- "actions_inverse_action_generator": "inverse-action-generator.ts" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L1 | neighbors=[action-executor.ts, index.ts, InverseActionGenerator, actions.ts, Action, AudioAction]
- "graphics_sticker_library_stickerlibrary": "StickerLibrary" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L193 | neighbors=[sticker-library.ts, .addCategory(), .addSticker(), .clearCustomStickers(), .constructor(), .createEmojiClip()]
- "media_mediabunny_engine": "mediabunny-engine.ts" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1 | neighbors=[export-engine.ts, index.ts, media-import-service.ts, ExportFrameDecoder, getMediaEngine(), inferMediaType()]
- "shaders_index": "index.ts" | kind=code-symbol | source=packages/core/src/video/upscaling/shaders/index.ts:L1 | neighbors=[BlurUniforms, BorderRadiusUniforms, calculateBorderRadiusAlpha(), createBlurUniformsBuffer(), createBorderRadiusUniformsBuffer(), createDimensionsBuffer()]
- "stabilization_stabilization_engine": "stabilization-engine.ts" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L1 | neighbors=[index.ts, optical-flow-cpu.ts, OpticalFlowCPU, types.ts, INTERPOLATION_QUALITY_PRESETS, motion-path.ts]
- "text_title_engine": "title-engine.ts" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L1 | neighbors=[export-engine.ts, index.ts, types.ts, text-animation.ts, TextAnimationEngine, CreateTextClipOptions]
- "types_template": "template.ts" | kind=code-symbol | source=packages/core/src/types/template.ts:L1 | neighbors=[template-engine.ts, index.ts, scriptable-template.ts, project.ts, ProjectSettings, PlaceholderConstraints]
- "types_timeline_effect": "Effect" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L109 | neighbors=[audio-effect-routing.ts, audio-effects-engine.ts, audio-engine.ts, clip-audio-resolution.ts, realtime-audio-graph.ts, realtime-processor.ts]
- "upscaling_upscaling_engine_upscalingengine": "UpscalingEngine" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L19 | neighbors=[upscaling-engine.ts, getUpscalingEngine(), .applyEdgeDetection(), .applyEdgeDirected(), .applyLanczos(), .applySharpen()]
- "audio_realtime_audio_graph": "realtime-audio-graph.ts" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L1 | neighbors=[index.ts, audio-effects-engine.ts, createNoiseReductionNodeChain(), clip-volume-automation.ts, scheduleVolumeAutomationOnGain(), AudioClipSchedule]
- "audio_sound_library_engine_soundlibraryengine": "SoundLibraryEngine" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L12 | neighbors=[sound-library-engine.ts, createSoundLibraryEngine(), .addCustomSound(), .analyzeAudio(), .constructor(), .detectBeats()]
- "export_export_engine_test": "export-engine.test.ts" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L1 | neighbors=[export-engine.ts, ExportEngine, getExportEngine(), createMockClip(), createMockProject(), createMockTimeline()]
- "hooks_usemediaplayback": "useMediaPlayback.ts" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L1 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, connectAudioNode(), createSeparationGraph(), cubicInterp(), disconnectAudioNode()]
- "video_multicam_engine_multicamengine": "MultiCamEngine" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L45 | neighbors=[multicam-engine.ts, .addAngle(), .addSwitch(), .clearAll(), .clearGroup(), .constructor()]
- "wasm_index": "index.ts" | kind=code-symbol | source=packages/core/src/wasm/index.ts:L1 | neighbors=[index.ts, BeatDetectionProcessor, getBeatDetectionProcessor(), initWasmBeatDetection(), isWasmBeatDetectionAvailable(), preloadWasmBeatDetection()]
- "media_media_import_service_mediaimportservice": "MediaImportService" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L43 | neighbors=[index.ts, media-import-service.ts, getMediaImportService(), .canBrowserPlay(), .constructor(), .generateProxy()]
- "photo_types": "types.ts" | kind=code-symbol | source=packages/core/src/photo/types.ts:L1 | neighbors=[index.ts, photo-adjustments.ts, photo-engine.ts, retouching-engine.ts, AdjustmentParams, AdjustmentType]
- "public_puter_et": "et" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .constructor(), .createTransport(), .filterUpgrades(), .flush()]
- "text_speech_to_text_engine_speechtotextengine": "SpeechToTextEngine" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L144 | neighbors=[speech-to-text-engine.ts, createSpeechToTextEngine(), .applyOptions(), .clearSegments(), .constructor(), .dispose()]
- "video_parallel_frame_decoder_parallelframedecoder": "ParallelFrameDecoder" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L49 | neighbors=[parallel-frame-decoder.ts, getParallelFrameDecoder(), initializeParallelDecoder(), .addToCache(), .clearCache(), .constructor()]
- "actions_inverse_action_generator_inverseactiongenerator": "InverseActionGenerator" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L18 | neighbors=[action-executor.ts, index.ts, inverse-action-generator.ts, .cloneClip(), .cloneMediaItem(), .cloneTrack()]
- "audio_realtime_processor_realtimeaudioprocessor": "RealtimeAudioProcessor" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L18 | neighbors=[realtime-processor.ts, getRealtimeAudioProcessor(), .constructor(), .createTrackProcessor(), .dispose(), .getAudioContext()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-002.json

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
