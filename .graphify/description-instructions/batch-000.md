# Node Description Batch 1 of 128

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

- "types_index": "index.ts" | kind=code-symbol | source=src/types/index.ts:L1 | neighbors=[action-executor.ts, action-validator.ts, AudioMixer.tsx, MediaPanel.tsx, PreviewCanvas.tsx, PropertiesPanel.tsx]
- "ffmpeg_ffmpeg_core": "ffmpeg-core.js" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L1 | neighbors=[abort(), addDays(), addOnInit(), addOnPostRun(), addOnPreRun(), addRunDependency()]
- "video_webgpu_types_d": "webgpu-types.d.ts" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L1 | neighbors=[GPU, GPUAdapter, GPUAddressMode, GPUBindGroup, GPUBindGroupDescriptor, GPUBindGroupEntry]
- "animation_index": "index.ts" | kind=code-symbol | source=packages/core/src/animation/index.ts:L1 | neighbors=[animation-exporter.ts, AnimationExporter, exportAnimation(), exportAnimationToJSON(), ExportOptions, ExportResult]
- "types_timeline": "timeline.ts" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L1 | neighbors=[inverse-action-generator.ts, animation-exporter.ts, animation-importer.ts, animation-schema.ts, gsap-engine.ts, audio-effect-routing.ts]
- "public_puter": "puter.js" | kind=code-symbol | source=public/puter.js:L1 | neighbors=[puter.js, 577(), 910(), An(), at(), B()]
- "src_project": "project.ts" | kind=code-symbol | source=packages/image-core/src/project.ts:L1 | neighbors=[commands.ts, commands.test.ts, index.ts, operations.ts, operations.test.ts, adjustments.ts]
- "video_video_engine": "video-engine.ts" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1 | neighbors=[export-engine.ts, playback-controller.ts, index.ts, background-removal-engine.ts, getBackgroundRemovalEngine(), person-segmentation-engine.ts]
- "video_video_engine_videoengine": "VideoEngine" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L80 | neighbors=[export-engine.ts, playback-controller.ts, video-engine.ts, getVideoEngine(), .applyEmphasisAnimation(), .applyFilter()]
- "media_index": "index.ts" | kind=code-symbol | source=packages/core/src/media/index.ts:L1 | neighbors=[audio-match-engine.ts, ffmpeg-fallback.ts, AudioProbeResult, AudioStreamInfo, FFmpegFallback, getFFmpegFallback()]
- "graphics_graphics_engine_graphicsengine": "GraphicsEngine" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L49 | neighbors=[export-engine.ts, graphics-engine.ts, .addKeyframe(), .addStickerClip(), .applyEmphasisAnimation(), .applyGraphicAnimation()]
- "animation_animation_schema": "animation-schema.ts" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L1 | neighbors=[animation-exporter.ts, animation-importer.ts, AnimatableProperty, AnimationDefinition, AnimationSchema, AnimationTemplate]
- "store_editorstore": "editorStore.ts" | kind=code-symbol | source=src/store/editorStore.ts:L1 | neighbors=[AiMotionGraphicsDesigner.tsx, AiSoundDesigner.tsx, AudioMixer.tsx, ColorScopes.tsx, ExportModal.tsx, HelpModal.tsx]
- "editing_templates_types": "types.ts" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L1 | neighbors=[built-in-templates.ts, categories.ts, index.ts, registry.ts, resolver.ts, EditingTemplate]
- "src_schema": "schema.ts" | kind=code-symbol | source=packages/image-core/src/schema.ts:L1 | neighbors=[index.ts, operations.ts, ArtboardSchema, BaseLayerSchema, BlackWhiteSchema, BlendModeSchema]
- "graphics_types": "types.ts" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L1 | neighbors=[animation-exporter.ts, animation-importer.ts, resolver.ts, types.ts, graphics-engine.ts, graphics-engine.test.ts]
- "lib_utils": "utils.ts" | kind=code-symbol | source=src/lib/utils.ts:L1 | neighbors=[cn(), accordion.tsx, alert.tsx, alert-dialog.tsx, avatar.tsx, badge.tsx]
- "lib_utils_cn": "cn()" | kind=code-symbol | source=src/lib/utils.ts:L4 | neighbors=[utils.ts, accordion.tsx, alert.tsx, alert-dialog.tsx, avatar.tsx, badge.tsx]
- "src_index": "index.ts" | kind=code-symbol | source=packages/image-core/src/index.ts:L1 | neighbors=[index.ts, index.ts, index.ts, index.ts, index.ts, index.ts]
- "ui_sidebar": "sidebar.tsx" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L1 | neighbors=[use-mobile.ts, useIsMobile(), utils.ts, cn(), button.tsx, Button()]
- "video_webgpu_renderer_impl_webgpurenderer": "WebGPURenderer" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L17 | neighbors=[webgpu-renderer-impl.ts, Renderer, .applyEffects(), .arePipelinesInitialized(), .attemptDeviceRecreation(), .beginFrame()]
- "audio_audio_effects_engine": "audio-effects-engine.ts" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1 | neighbors=[audio-effect-routing.ts, isSerializedNoiseProfile(), SerializedNoiseProfile, applyGainToBuffer(), AudioEffectChainConfig, AudioEffectsEngine]
- "playback_playback_controller_playbackcontroller": "PlaybackController" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L30 | neighbors=[playback-controller.ts, getPlaybackController(), .addEventListener(), .calculateAudioBufferHealth(), .calculateFPS(), .clearAudioBuffer()]
- "types_lottie": "lottie.ts" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L1 | neighbors=[index.ts, BaseLottieLayer, BaseLottieShape, DEFAULT_LOTTIE_EXPORT_OPTIONS, LottieAnimatedProperty, LottieAnimation]
- "video_video_effects_engine_videoeffectsengine": "VideoEffectsEngine" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L359 | neighbors=[video-effects-engine.ts, getVideoEffectsEngine(), video-effects-engine.test.ts, .applyChromaKey(), .applyChromaticAberration(), .applyEffect()]
- "src_adjustments": "adjustments.ts" | kind=code-symbol | source=packages/image-core/src/adjustments.ts:L1 | neighbors=[applyBlackWhiteToImageData(), applyColorBalanceToImageData(), applyCurvesToImageData(), applyGradientMapToImageData(), applyLevels(), applyLevelsToImageData()]
- "editing_templates_resolver": "resolver.ts" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L1 | neighbors=[index.ts, clamp(), DEFAULT_TRANSFORM, getEditingTemplateControlDefinition(), getEditingTemplateDefaultControlValues(), isEditingTemplateBinding()]
- "public_puter_wt": "wt" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .ack(), .active(), ._addToQueue(), .close(), .compress()]
- "components_previewcanvas": "PreviewCanvas.tsx" | kind=code-symbol | source=src/components/PreviewCanvas.tsx:L1 | neighbors=[ColorScopes.tsx, ColorScopes(), InteractiveCanvasOverlay(), PreviewCanvas(), ThumbnailModal.tsx, ThumbnailModal()]
- "components_propertiespanel": "PropertiesPanel.tsx" | kind=code-symbol | source=src/components/PropertiesPanel.tsx:L1 | neighbors=[AiMotionGraphicsDesigner.tsx, AiMotionGraphicsDesigner(), AiSoundDesigner.tsx, AiSoundDesigner(), ColorWheel(), ColorWheelProps]
- "src_commands": "commands.ts" | kind=code-symbol | source=packages/image-core/src/commands.ts:L1 | neighbors=[AddArtboardCommand, AddLayerCommand, ApplyAdjustmentCommand, ApplyMaskCommand, cloneProject(), Command]
- "src_commands_test": "commands.test.ts" | kind=code-symbol | source=packages/image-core/src/commands.test.ts:L1 | neighbors=[commands.ts, AddArtboardCommand, AddLayerCommand, ApplyAdjustmentCommand, ApplyMaskCommand, DuplicateLayerCommand]
- "animation_animation_importer": "animation-importer.ts" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L1 | neighbors=[AnimationImporter, createDefaultMediaMetadata(), importAnimation(), importAnimationFromJSON(), ImportOptions, ImportResult]
- "video_mask_engine_maskengine": "MaskEngine" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L387 | neighbors=[mask-engine.ts, .addMaskKeyframe(), .addPoint(), .applyExpansion(), .applyFeathering(), .applyMask()]
- "animation_animation_exporter": "animation-exporter.ts" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L1 | neighbors=[AnimationExporter, exportAnimation(), exportAnimationToJSON(), ExportOptions, ExportResult, GroupedKeyframes]
- "audio_audio_engine": "audio-engine.ts" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L1 | neighbors=[audio-effect-routing.ts, getPanFromAudioEffects(), splitProfileAwareNoiseReductionEffects(), audio-effects-engine.ts, AudioEffectsEngine, AudioEngine]
- "public_puter_ls": "ls" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, ._activateFocused(), ._bindEvents(), ._cancelSubmenuClose(), ._clearFocus(), ._closeAll()]
- "src_operations": "operations.ts" | kind=code-symbol | source=packages/image-core/src/operations.ts:L1 | neighbors=[commands.ts, commands.test.ts, index.ts, migration.ts, migrateProject(), addLayerToProject()]
- "timeline_index": "index.ts" | kind=code-symbol | source=packages/core/src/timeline/index.ts:L1 | neighbors=[index.ts, auto-edit-service.ts, AutoEditCut, AutoEditOptions, AutoEditResult, AutoEditService]
- "audio_realtime_audio_graph_realtimeaudiograph": "RealtimeAudioGraph" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L69 | neighbors=[realtime-audio-graph.ts, getRealtimeAudioGraph(), initializeRealtimeAudioGraph(), .applyMasterGain(), .buildEffectChain(), .constructor()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-000.json

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
