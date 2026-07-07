# Node Description Batch 8 of 128

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

- "fft_index": "index.ts" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L1 | neighbors=[noise-reduction.ts, fft.ts, FFT, getWasmFFT(), initWasmFFT(), isWasmFFTAvailable()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu": "OpticalFlowCPU" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L3 | neighbors=[frame-interpolation-engine.ts, index.ts, optical-flow-cpu.ts, .bilinearSample(), .blockMatch(), .buildPyramid()]
- "frame_interpolation_types": "types.ts" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/types.ts:L1 | neighbors=[flow-field-cache.ts, frame-interpolation-engine.ts, index.ts, optical-flow-cpu.ts, optical-flow-gpu.ts, FlowField]
- "graphics_graphics_engine_graphicsengine_rendershape": ".renderShape()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L472 | neighbors=[GraphicsEngine, .renderGraphic(), .createGradient(), .drawArrow(), .drawCircle(), .drawEllipse()]
- "media_mediabunny_engine_exportframedecoder_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L139 | neighbors=[ExportFrameDecoder, .initialize(), .disposeAllExportDecoders(), .disposeExportDecoder(), .exportImageSequence(), .extractMetadata()]
- "public_puter_en_requestpermission": ".requestPermission()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[B(), En, .#a(), .request(), .requestEmail(), .requestFolder_()]
- "src_commands_cloneproject": "cloneProject()" | kind=code-symbol | source=packages/image-core/src/commands.ts:L34 | neighbors=[commands.ts, .apply(), .apply(), .apply(), .apply(), .apply()]
- "stabilization_types": "types.ts" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L1 | neighbors=[index.ts, motion-path.ts, stabilization-engine.ts, CorrectionTransform, DEFAULT_STABILIZATION_CONFIG, MotionSample]
- "text_index": "index.ts" | kind=code-symbol | source=packages/core/src/text/index.ts:L1 | neighbors=[index.ts, audio-text-sync-engine.ts, caption-animation-renderer.ts, character-animator.ts, speech-to-text-engine.ts, subtitle-engine.ts]
- "types_timeline_track": "Track" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L28 | neighbors=[inverse-action-generator.ts, animation-importer.ts, audio-engine.ts, clip-audio-resolution.ts, clip-audio-resolution.test.ts, nested-sequence-engine.ts]
- "types_transitions_basetransition": "BaseTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L28 | neighbors=[index.ts, transitions.ts, BlurTransition, CrossfadeTransition, DissolveTransition, FadeTransition]
- "ui_navigation_menu": "navigation-menu.tsx" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L1 | neighbors=[utils.ts, cn(), NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem()]
- "video_playback_engine": "playback-engine.ts" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L1 | neighbors=[index.ts, project.ts, MediaItem, ActiveStream, BufferedFrame, FrameCallback]
- "wav_index_wavencoder": "WavEncoder" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L209 | neighbors=[index.ts, index.ts, getWavEncoder(), .constructor(), .encodeFullWav(), .encodeWav16Mono()]
- "actions_action_history_actionhistory_push": ".push()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L132 | neighbors=[ActionHistory, .createSnapshot(), .getDisplayHistory(), .notify(), getActionDescription(), getActionTargetId()]
- "animation_animation_importer_animationimporter": "AnimationImporter" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L102 | neighbors=[animation-importer.ts, .convertAnimationsToKeyframes(), .createDefaultTransform(), .import(), .processImageLayer(), .processLayer()]
- "audio_volume_automation_clampvolume": "clampVolume()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L44 | neighbors=[clip-volume-automation.ts, volume-automation.ts, .generateDuckingKeyframes(), .applyConstantVolume(), .applyFadeIn(), .applyFadeOut()]
- "components_aisounddesigner": "AiSoundDesigner.tsx" | kind=code-symbol | source=src/components/AiSoundDesigner.tsx:L1 | neighbors=[AiSoundDesigner(), AiSoundDesignerProps, CueWithOptions, editorStore.ts, useEditorStore, aiClient.ts]
- "components_audiomixer": "AudioMixer.tsx" | kind=code-symbol | source=src/components/AudioMixer.tsx:L1 | neighbors=[AudioMixer(), ChannelStrip(), ChannelStripProps, MasterChannelStrip(), MasterChannelStripProps, editorStore.ts]
- "components_exportmodal": "ExportModal.tsx" | kind=code-symbol | source=src/components/ExportModal.tsx:L1 | neighbors=[ensureFFmpegLoaded(), ExportModal(), ExportStatus, ffmpeg, ffmpegLogs, editorStore.ts]
- "components_toptoolbar": "TopToolbar.tsx" | kind=code-symbol | source=src/components/TopToolbar.tsx:L1 | neighbors=[TopToolbar(), editorStore.ts, useEditorStore, index.ts, EditorTool, autoCaptions.ts]
- "components_welcomescreen": "WelcomeScreen.tsx" | kind=code-symbol | source=src/components/WelcomeScreen.tsx:L1 | neighbors=[WelcomeScreen(), editorStore.ts, useEditorStore, projectPersistence.ts, deleteProjectMeta(), listRecentProjects()]
- "device_device_capabilities_detectdevicecapabilities": "detectDeviceCapabilities()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L243 | neighbors=[device-capabilities.ts, calculateOverallTier(), detectEncodingSupport(), detectGpu(), detectPlatform(), getCpuTier()]
- "device_export_estimator_test": "export-estimator.test.ts" | kind=code-symbol | source=packages/core/src/device/export-estimator.test.ts:L1 | neighbors=[device-capabilities.ts, BenchmarkResult, DeviceProfile, export-estimator.ts, compareCodecEstimates(), estimateExportTime()]
- "editing_templates_registry": "registry.ts" | kind=code-symbol | source=packages/core/src/editing-templates/registry.ts:L1 | neighbors=[index.ts, built-in-templates.ts, BUILT_IN_EDITING_TEMPLATES, builtInTemplateMap, getBuiltInEditingTemplate(), getBuiltInEditingTemplates()]
- "effects_particle_types": "particle-types.ts" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L1 | neighbors=[index.ts, particle-engine.ts, particle-presets.ts, DEFAULT_PARTICLE_CONFIG, EmitterState, Particle]
- "ffmpeg_ffmpeg_core_abort": "abort()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, assert(), ___assert_fail(), _dlopen(), ___dlsym(), getBinary()]
- "ffmpeg_ffmpeg_core_getsocketfromfd": "getSocketFromFD()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ___syscall_accept4(), ___syscall_bind(), ___syscall_connect(), ___syscall_getpeername(), ___syscall_getsockname()]
- "graphics_sticker_library": "sticker-library.ts" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L1 | neighbors=[index.ts, EMOJI_CATEGORIES, EmojiCategory, StickerCategory, StickerLibrary, types.ts]
- "media_ffmpeg_fallback_ffmpegfallback_cleanupfiles": ".cleanupFiles()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L190 | neighbors=[FFmpegFallback, .concatenateSegments(), .convertAudio(), .extractAudioAsWav(), .extractFrame(), .extractRange()]
- "media_ffmpeg_fallback_ffmpegfallback_filetouint8array": ".fileToUint8Array()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L185 | neighbors=[FFmpegFallback, .convertAudio(), .exportVideoDirectly(), .extractAudioAsWav(), .extractFrame(), .extractRange()]
- "playback_master_timeline_clock": "master-timeline-clock.ts" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L1 | neighbors=[realtime-audio-graph.ts, index.ts, ClockOptions, ClockState, ClockSubscriber, disposeMasterClock()]
- "public_puter_en_requestfolder": ".requestFolder_()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En, .requestPermission(), .requestReadDesktop(), .requestReadDocuments(), .requestReadPictures(), .requestReadVideos()]
- "public_puter_gt_add": ".add()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.on(), gt, .decodeString(), it(), mt, .takeBinaryData()]
- "public_puter_ls_hideactivesubmenu": "._hideActiveSubmenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._closeAll(), .disconnectedCallback(), ._handleKey(), ._itemEl(), ._setFocusIndex()]
- "src_operations_cloneproject": "cloneProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L36 | neighbors=[operations.ts, addLayerToProject(), duplicateLayerInProject(), removeLayerFromProject(), renameLayer(), reorderArtboardLayers()]
- "src_operations_touchproject": "touchProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L40 | neighbors=[operations.ts, addLayerToProject(), duplicateLayerInProject(), removeLayerFromProject(), renameLayer(), reorderArtboardLayers()]
- "stabilization_vidstab_engine": "vidstab-engine.ts" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L1 | neighbors=[index.ts, types.ts, DEFAULT_STABILIZATION_CONFIG, StabilizationConfig, disposeVidstabEngine(), FFmpegInstance]
- "storage_cache_manager": "cache-manager.ts" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L1 | neighbors=[CacheManager, CacheManagerConfig, CacheStats, createCacheManager(), DEFAULT_CACHE_CONFIG, types.ts]
- "types_index_mediaitem": "MediaItem" | kind=code-symbol | source=src/types/index.ts:L25 | neighbors=[action-executor.ts, MediaPanel.tsx, PreviewCanvas.tsx, Timeline.tsx, project-serializer.ts, editorStore.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-007.json

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
