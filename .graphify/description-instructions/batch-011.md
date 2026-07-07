# Node Description Batch 12 of 128

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

- "src_commands_removepastedlayerscommand": "RemovePastedLayersCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L698 | neighbors=[commands.ts, .invert(), Command, .apply(), .constructor(), .description()]
- "src_commands_reorderlayercommand": "ReorderLayerCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L310 | neighbors=[commands.ts, Command, .apply(), .constructor(), .description(), .invert()]
- "src_commands_restoreartboardcommand": "RestoreArtboardCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L147 | neighbors=[commands.ts, .invert(), Command, .apply(), .constructor(), .description()]
- "src_commands_setprojectnamecommand": "SetProjectNameCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L51 | neighbors=[commands.ts, Command, .apply(), .constructor(), .description(), .invert()]
- "src_commands_updateartboardcommand": "UpdateArtboardCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L181 | neighbors=[commands.ts, commands.test.ts, Command, .apply(), .constructor(), .description()]
- "src_operations_removelayerfromproject": "removeLayerFromProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L141 | neighbors=[commands.ts, operations.ts, cloneProject(), isLayerIdKnown(), removeLayerTree(), touchProject()]
- "text_caption_animation_renderer_renderanimatedcaption": "renderAnimatedCaption()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L259 | neighbors=[caption-animation-renderer.ts, renderBounce(), renderKaraoke(), renderNone(), renderTypewriter(), renderWordByWord()]
- "text_caption_animation_renderer_rendernone": "renderNone()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L37 | neighbors=[caption-animation-renderer.ts, renderAnimatedCaption(), renderBounce(), renderKaraoke(), renderTypewriter(), renderWordByWord()]
- "timeline_clip_manager_clipmanager_createprojectwrapper": ".createProjectWrapper()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L630 | neighbors=[ClipManager, .addClip(), .deleteClip(), .moveClip(), .rippleDeleteClip(), .splitClip()]
- "types_composition_baselayer": "BaseLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L171 | neighbors=[composition.ts, AudioLayer, GroupLayer, ImageLayer, ShapeLayer, TextLayer]
- "types_timeline_automationpoint": "AutomationPoint" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L234 | neighbors=[clip-audio-resolution.ts, clip-volume-automation.ts, realtime-audio-graph.ts, types.ts, volume-automation.ts, actions.ts]
- "ui_button_button": "Button()" | kind=code-symbol | source=src/components/ui/button.tsx:L39 | neighbors=[button.tsx, buttonVariants, calendar.tsx, carousel.tsx, input-group.tsx, pagination.tsx]
- "ui_calendar": "calendar.tsx" | kind=code-symbol | source=src/components/ui/calendar.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), buttonVariants, Calendar()]
- "ui_separator": "separator.tsx" | kind=code-symbol | source=src/components/ui/separator.tsx:L1 | neighbors=[button-group.tsx, field.tsx, item.tsx, utils.ts, cn(), Separator()]
- "ui_toggle_group": "toggle-group.tsx" | kind=code-symbol | source=src/components/ui/toggle-group.tsx:L1 | neighbors=[utils.ts, cn(), toggle.tsx, ToggleGroup(), ToggleGroupContext, ToggleGroupItem()]
- "ui_tooltip": "tooltip.tsx" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L1 | neighbors=[sidebar.tsx, utils.ts, cn(), Tooltip(), TooltipContent(), TooltipProvider()]
- "upscaling_upscaling_engine_upscalingengine_upscalequality": ".upscaleQuality()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L306 | neighbors=[UpscalingEngine, .upscale(), .applyEdgeDetection(), .applyEdgeDirected(), .applyLanczos(), .applySharpen()]
- "utils_immutable_updates_updateclipintimeline": "updateClipInTimeline()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L78 | neighbors=[immutable-updates.ts, addEffectToClip(), addKeyframeToClip(), removeEffectFromClip(), removeKeyframeFromClip(), updateClipProperty()]
- "video_composite_engine_compositeengine_applyblendmode": ".applyBlendMode()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L169 | neighbors=[CompositeEngine, .colorBurnChannel(), .colorDodgeChannel(), .hardLightChannel(), .overlayChannel(), .softLightChannel()]
- "video_keyframe_engine_keyframeengine_applyeasingpreset": ".applyEasingPreset()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L261 | neighbors=[KeyframeEngine, .bounce(), .easeIn(), .easeInOut(), .easeOut(), .elastic()]
- "video_mask_engine_maskengine_generatemaskshape": ".generateMaskShape()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L768 | neighbors=[MaskEngine, .applyMaskDefinition(), .drawBezierMask(), .drawEllipseMask(), .drawPolygonMask(), .drawRectangleMask()]
- "video_multicam_engine": "multicam-engine.ts" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L1 | neighbors=[index.ts, ANGLE_COLORS, AngleSwitch, CameraAngle, MultiCamEngine, MultiCamGroup]
- "video_playback_engine_playbackengine_play": ".play()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L96 | neighbors=[PlaybackEngine, .setState(), .setupStreams(), .startDecoding(), .startPlaybackLoop(), .stop()]
- "video_texture_cache": "texture-cache.ts" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L1 | neighbors=[index.ts, CachedTexture, calculateTextureSize(), getCacheKey(), TextureCache, TextureCacheConfig]
- "video_video_engine_videoengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2843 | neighbors=[VideoEngine, .decodeFrame(), .decodeFrameToCanvas(), .clearCache(), .clearVideoElementCache(), .preloadFrames()]
- "video_video_engine_videoengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L509 | neighbors=[VideoEngine, .decodeFrame(), .decodeFrameToCanvas(), .getSupportedCodecs(), .preloadFrames(), .preloadFramesRange()]
- "actions_action_serializer_actionserializer": "ActionSerializer" | kind=code-symbol | source=packages/core/src/actions/action-serializer.ts:L3 | neighbors=[action-serializer.ts, .deserialize(), .deserializeMany(), .serialize(), .serializeMany(), index.ts]
- "actions_inverse_action_generator_inverseactiongenerator_findclip": ".findClip()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L582 | neighbors=[InverseActionGenerator, .generateAudioInverse(), .generateClipInverse(), .generateEffectInverse(), .generateKeyframeInverse(), .generateTransformInverse()]
- "animation_animation_importer_animationimporter_processlayer": ".processLayer()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L290 | neighbors=[AnimationImporter, .import(), .processImageLayer(), .processShapeLayer(), .processTextLayer(), .processVideoLayer()]
- "audio_audio_effect_routing_isserializednoiseprofile": "isSerializedNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L24 | neighbors=[audio-effect-routing.ts, isFiniteNumberArray(), isValidFftSize(), splitProfileAwareNoiseReductionEffects(), audio-effect-routing.test.ts, audio-effects-engine.ts]
- "audio_audio_effects_engine_audioeffectsengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L692 | neighbors=[AudioEffectsEngine, .applyEffectChain(), .applyNoiseReductionWithProfile(), .applyNoiseReductionWithProfileData(), .getAudioContext(), .learnNoiseProfile()]
- "audio_audio_effects_engine_restorevoicepresence": "restoreVoicePresence()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L619 | neighbors=[audio-effects-engine.ts, .applyNoiseReductionWithProfileData(), applyGainToBuffer(), getBufferPeak(), getBufferRms(), getMaximumMakeupGain()]
- "audio_audio_engine_segmentedaudiodecoder": "SegmentedAudioDecoder" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L33 | neighbors=[audio-engine.ts, .getSegmentedAudioDecoder(), .buffers(), .constructor(), .dispose(), .initialize()]
- "audio_beat_detection_engine_beatdetectionengine_analyzeaudiobuffer": ".analyzeAudioBuffer()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L60 | neighbors=[BeatDetectionEngine, .calculateBpm(), .detectDownbeats(), .detectOnsets(), .generateBeats(), .analyzeFromBlob()]
- "audio_fft": "fft.ts" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L1 | neighbors=[audio-effects-engine.ts, FFT, getFFT(), index.ts, noise-reduction.ts, index.ts]
- "audio_realtime_audio_graph_realtimeaudiograph_buildeffectchain": ".buildEffectChain()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L167 | neighbors=[RealtimeAudioGraph, .createCompressorNode(), .createDelayNodes(), .createEQFilters(), .createReverbNodes(), .createTrack()]
- "audio_sound_library_engine_soundlibraryengine_getallsounds": ".getAllSounds()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L646 | neighbors=[SoundLibraryEngine, .getByCategory(), .getBySubcategory(), .getMusic(), .getSFX(), .search()]
- "audio_volume_automation_audioducker_generateduckingkeyframes": ".generateDuckingKeyframes()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L625 | neighbors=[AudioDucker, .applyDucking(), .deduplicateKeyframes(), .detectAudioPresence(), .mergePresenceRanges(), clampVolume()]
- "device_device_capabilities_test": "device-capabilities.test.ts" | kind=code-symbol | source=packages/core/src/device/device-capabilities.test.ts:L1 | neighbors=[device-capabilities.ts, DeviceProfile, formatDeviceSummary(), getCodecRecommendations(), getResolutionRecommendations(), createMockProfile()]
- "device_export_estimator_estimateexporttime": "estimateExportTime()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L124 | neighbors=[export-estimator.ts, formatTime(), getComplexityMultiplier(), getResolutionMultiplier(), export-estimator.test.ts, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-011.json

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
