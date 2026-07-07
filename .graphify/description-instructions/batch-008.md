# Node Description Batch 9 of 128

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

- "types_lottie_baselottieshape": "BaseLottieShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L167 | neighbors=[index.ts, lottie.ts, LottieEllipseShape, LottieFillShape, LottieGroupShape, LottiePathShape]
- "types_project_mediaitem": "MediaItem" | kind=code-symbol | source=packages/core/src/types/project.ts:L31 | neighbors=[inverse-action-generator.ts, animation-exporter.ts, animation-importer.ts, audio-engine.ts, media-import-service.ts, template-engine.ts]
- "ui_button": "button.tsx" | kind=code-symbol | source=src/components/ui/button.tsx:L1 | neighbors=[alert-dialog.tsx, utils.ts, cn(), Button(), buttonVariants, calendar.tsx]
- "ui_table": "table.tsx" | kind=code-symbol | source=src/components/ui/table.tsx:L1 | neighbors=[utils.ts, cn(), Table(), TableBody(), TableCaption(), TableCell()]
- "utils_serialization": "serialization.ts" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L1 | neighbors=[storage-engine.ts, index.ts, index.ts, deepEquals(), deserializeAction(), deserializeActions()]
- "utils_titletemplates": "titleTemplates.ts" | kind=code-symbol | source=src/utils/titleTemplates.ts:L1 | neighbors=[AiMotionGraphicsDesigner.tsx, MediaPanel.tsx, Timeline.tsx, index.ts, ClipAnimations, ClipTextSettings]
- "video_frame_cache_preloadmanager": "PreloadManager" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L242 | neighbors=[frame-cache.ts, .cancelAll(), .cancelMedia(), .dequeue(), .enqueue(), .getCurrentTask()]
- "video_playback_engine_playbackengine_seek": ".seek()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L148 | neighbors=[PlaybackEngine, .clearBuffer(), .getImmediateFrame(), .setState(), .setupStreams(), .startDecoding()]
- "video_renderer_factory_rendererfactory": "RendererFactory" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L61 | neighbors=[renderer-factory.ts, .constructor(), .createRenderer(), .destroyRenderer(), .getCurrentRenderer(), .getInstance()]
- "video_transition_engine_transitionengine_rendertransitiontocanvas": ".renderTransitionToCanvas()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L164 | neighbors=[TransitionEngine, .renderTransition(), .applyEasing(), .fitToCanvas(), .renderCrossfade(), .renderDipToColor()]
- "video_unified_effects_processor": "unified-effects-processor.ts" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L1 | neighbors=[index.ts, timeline.ts, Effect, renderer-factory.ts, isWebGPUSupported(), ColorGradingParams]
- "ai_background_removal_engine_backgroundremovalengine_processframe": ".processFrame()" | kind=code-symbol | source=packages/core/src/ai/background-removal-engine.ts:L95 | neighbors=[BackgroundRemovalEngine, .applyEdgeBlur(), .generateSimpleMask(), .getSettings(), .processFrameFast(), .renderBlurBackground()]
- "ai_person_segmentation_engine_personsegmentationengine": "PersonSegmentationEngine" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L15 | neighbors=[person-segmentation-engine.ts, getPersonSegmentationEngine(), .dispose(), .doInitialize(), .getPersonMask(), .initialize()]
- "animation_animation_schema_baselayer": "BaseLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L71 | neighbors=[animation-schema.ts, GroupLayer, ImageLayer, LottieLayer, ParticleLayer, ShapeLayer]
- "animation_composition_renderer_compositionrenderer_renderlayer": ".renderLayer()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L55 | neighbors=[CompositionRenderer, .renderFrame(), .applyTransform(), .evaluateTransform(), .mapBlendMode(), .renderImageLayer()]
- "audio_audio_effects_engine_audioeffectsengine_applynoisereductionwithprofiledata": ".applyNoiseReductionWithProfileData()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1136 | neighbors=[AudioEffectsEngine, .applyNoiseReductionWithProfile(), .ensureInitialized(), createProfileBasedNoiseReductionFilters…, getSpectralSmoothingForFocus(), isBufferUsable()]
- "audio_audio_engine_audioengine_rendercliptocontext": ".renderClipToContext()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L421 | neighbors=[AudioEngine, .renderAudio(), .applyFades(), .applyVolumeAutomation(), .createClipOutputNodes(), .getAudioBuffer()]
- "audio_noise_reduction_test": "noise-reduction.test.ts" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L1 | neighbors=[noise-reduction.ts, NoiseProfile, SpectralNoiseReducer, createAudioBuffer(), createContext(), createSilentProfile()]
- "audio_realtime_processor": "realtime-processor.ts" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L1 | neighbors=[index.ts, getRealtimeAudioProcessor(), initializeRealtimeProcessor(), RealtimeAudioProcessor, RealtimeProcessorState, TrackProcessor]
- "components_aimotiongraphicsdesigner": "AiMotionGraphicsDesigner.tsx" | kind=code-symbol | source=src/components/AiMotionGraphicsDesigner.tsx:L1 | neighbors=[AiMotionGraphicsDesigner(), AiMotionGraphicsProps, editorStore.ts, useEditorStore, aiClient.ts, AIMotionGraphicSuggestion]
- "editing_templates_resolver_resolveoverlay": "resolveOverlay()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L175 | neighbors=[resolver.ts, resolveEmphasisAnimation(), resolveOverlayKeyframes(), resolveOverlayTiming(), resolveRecord(), resolveTemplateVariables()]
- "frame_interpolation_flow_field_cache_flowfieldcache": "FlowFieldCache" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L8 | neighbors=[flow-field-cache.ts, .clear(), .constructor(), .evictLRU(), .get(), .makeKey()]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu": "OpticalFlowGPU" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L154 | neighbors=[frame-interpolation-engine.ts, index.ts, optical-flow-gpu.ts, .computeFlowField(), .constructor(), .dispose()]
- "media_gif_decoder": "gif-decoder.ts" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L1 | neighbors=[createGifFrameCache(), DecodedGif, decodeGif(), getGifFrameAtTime(), GifFrame, GifFrameCache]
- "media_mediabunny_engine_mediabunnyengine_createinput": ".createInput()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L232 | neighbors=[MediaBunnyEngine, .ensureInitialized(), .exportImageSequence(), .extractMetadata(), .generateFilmstripThumbnails(), .generateThumbnails()]
- "photo_photo_adjustments_photoadjustmentengine_applyadjustments": ".applyAdjustments()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L301 | neighbors=[PhotoAdjustmentEngine, .applyBrightness(), .applyContrast(), .applyExposure(), .applyHighlights(), .applySaturation()]
- "photo_photo_adjustments_photoadjustmentengine_getcanvas": ".getCanvas()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L344 | neighbors=[PhotoAdjustmentEngine, .applyBrightness(), .applyContrast(), .applyExposure(), .applyHighlights(), .applySaturation()]
- "photo_retouching_engine": "retouching-engine.ts" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L1 | neighbors=[index.ts, BrushConfig, DEFAULT_BRUSH_CONFIG, getRetouchingEngine(), RetouchingEngine, types.ts]
- "playback_playback_controller_playbackcontroller_emitevent": ".emitEvent()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L757 | neighbors=[PlaybackController, .handleClockStateChange(), .handleClockTimeUpdate(), .pause(), .play(), .renderFrameAtTime()]
- "public_puter_gs": "gs" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .debug(), .error(), .fields(), .info()]
- "public_puter_ls_handlekey": "._handleKey()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._activateFocused(), ._closeAll(), ._focusableIndices(), ._hideActiveSubmenu(), ._moveFocus()]
- "src_commands_removeartboardcommand": "RemoveArtboardCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L109 | neighbors=[commands.ts, .invert(), Command, .apply(), .constructor(), .description()]
- "src_commands_removelayercommand": "RemoveLayerCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L248 | neighbors=[commands.ts, .invert(), .invert(), Command, .apply(), .constructor()]
- "types_project_project": "Project" | kind=code-symbol | source=packages/core/src/types/project.ts:L13 | neighbors=[inverse-action-generator.ts, animation-exporter.ts, animation-importer.ts, audio-engine.ts, export-engine.ts, playback-controller.ts]
- "ui_breadcrumb": "breadcrumb.tsx" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L1 | neighbors=[utils.ts, cn(), Breadcrumb(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink()]
- "ui_card": "card.tsx" | kind=code-symbol | source=src/components/ui/card.tsx:L1 | neighbors=[utils.ts, cn(), Card(), CardAction(), CardContent(), CardDescription()]
- "ui_empty": "empty.tsx" | kind=code-symbol | source=src/components/ui/empty.tsx:L1 | neighbors=[utils.ts, cn(), Empty(), EmptyContent(), EmptyDescription(), EmptyHeader()]
- "upscaling_upscaling_types": "upscaling-types.ts" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L1 | neighbors=[index.ts, upscaling-engine.ts, DEFAULT_UPSCALING_SETTINGS, TexturePoolEntry, UpscaleQuality, UpscalingConfig]
- "utils_aiclient": "aiClient.ts" | kind=code-symbol | source=src/utils/aiClient.ts:L1 | neighbors=[AiMotionGraphicsDesigner.tsx, AiSoundDesigner.tsx, PropertiesPanel.tsx, AICueResult, AIMotionGraphicSuggestion, analyzeMotionGraphicsWithGemini()]
- "utils_mediaprobe_probefile": "probeFile()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L227 | neighbors=[MediaPanel.tsx, SettingsModal.tsx, TopToolbar.tsx, mediaProbe.ts, detectMediaType(), generateId()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-008.json

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
