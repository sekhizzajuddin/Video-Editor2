# Node Description Batch 19 of 128

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

- "animation_animation_importer_animationimporter_processshapelayer": ".processShapeLayer()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L386 | neighbors=[AnimationImporter, .processLayer(), .convertAnimationsToKeyframes(), mapShapeType()]
- "animation_animation_importer_animationimporter_processtextlayer": ".processTextLayer()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L335 | neighbors=[AnimationImporter, .processLayer(), .convertAnimationsToKeyframes(), parseFontWeight()]
- "animation_animation_importer_importanimation": "importAnimation()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L560 | neighbors=[animation-importer.ts, .import(), importAnimationFromJSON(), index.ts]
- "animation_animation_schema_animationdefinition": "AnimationDefinition" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L326 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_layerdefinition": "LayerDefinition" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L317 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, index.ts]
- "animation_composition_renderer_compositionrenderer_evaluatekeyframes": ".evaluateKeyframes()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L101 | neighbors=[CompositionRenderer, .applyEasing(), .interpolateValue(), .evaluateTransform()]
- "animation_composition_renderer_compositionrenderer_evaluatetransform": ".evaluateTransform()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L88 | neighbors=[CompositionRenderer, .evaluateKeyframes(), .setNestedProperty(), .renderLayer()]
- "animation_easing_functions_geteasingfunction": "getEasingFunction()" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L255 | neighbors=[easing-functions.ts, cubicBezier(), interpolate(), index.ts]
- "audio_audio_effect_routing_getpanfromaudioeffects": "getPanFromAudioEffects()" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L50 | neighbors=[audio-effect-routing.ts, audio-effect-routing.test.ts, audio-engine.ts, playback-controller.ts]
- "audio_audio_effect_routing_splitprofileawarenoisereductioneffects": "splitProfileAwareNoiseReductionEffects()" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L67 | neighbors=[audio-effect-routing.ts, isSerializedNoiseProfile(), audio-effect-routing.test.ts, audio-engine.ts]
- "audio_audio_effects_engine_audioeffectsengine_createeqnodepair": ".createEQNodePair()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L798 | neighbors=[AudioEffectsEngine, .createEffectNode(), .createEQNode(), .mapEQBandType()]
- "audio_audio_effects_engine_audioeffectsengine_createnoisereductionnodepair": ".createNoiseReductionNodePair()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1023 | neighbors=[AudioEffectsEngine, .createEffectNode(), .createNoiseReductionNode(), createNoiseReductionNodeChain()]
- "audio_audio_effects_engine_isbufferusable": "isBufferUsable()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L537 | neighbors=[audio-effects-engine.ts, .applyNoiseReductionWithProfileData(), getBufferPeak(), getBufferRms()]
- "audio_audio_engine_getaudioengine": "getAudioEngine()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L985 | neighbors=[audio-engine.ts, AudioEngine, initializeAudioEngine(), export-engine.ts]
- "audio_clip_audio_resolution_resolveclipaudioeffects": "resolveClipAudioEffects()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L72 | neighbors=[audio-engine.ts, clip-audio-resolution.ts, getLinkedAudioClips(), clip-audio-resolution.test.ts]
- "audio_clip_audio_resolution_resolveclipvolumeautomation": "resolveClipVolumeAutomation()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L88 | neighbors=[audio-engine.ts, clip-audio-resolution.ts, getLinkedAudioClips(), clip-audio-resolution.test.ts]
- "audio_clip_volume_automation_schedulevolumeautomationongain": "scheduleVolumeAutomationOnGain()" | kind=code-symbol | source=packages/core/src/audio/clip-volume-automation.ts:L119 | neighbors=[audio-engine.ts, clip-volume-automation.ts, getVolumeAutomationPointsForRange(), realtime-audio-graph.ts]
- "audio_noise_reduction_spectralnoisereducer_extractframe": ".extractFrame()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L185 | neighbors=[SpectralNoiseReducer, .getWindowValue(), .learnNoiseProfile(), .processChannel()]
- "audio_noise_reduction_spectralnoisereducer_learnnoiseprofile": ".learnNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L57 | neighbors=[autoLearnNoiseProfile(), SpectralNoiseReducer, .computeMagnitudeSpectrum(), .extractFrame()]
- "audio_realtime_audio_graph_initializerealtimeaudiograph": "initializeRealtimeAudioGraph()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L738 | neighbors=[realtime-audio-graph.ts, RealtimeAudioGraph, .dispose(), playback-controller.ts]
- "audio_realtime_audio_graph_realtimeaudiograph_removetrack": ".removeTrack()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L380 | neighbors=[RealtimeAudioGraph, .createTrack(), .dispose(), .updateSoloState()]
- "audio_realtime_audio_graph_realtimeaudiograph_scheduleclip": ".scheduleClip()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L517 | neighbors=[RealtimeAudioGraph, .createTrack(), .updateTrackEffects(), .scheduleClips()]
- "audio_realtime_audio_graph_realtimeaudiograph_stopallclips": ".stopAllClips()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L624 | neighbors=[RealtimeAudioGraph, .seekTo(), .stopScheduler(), .suspend()]
- "audio_realtime_processor_realtimeaudioprocessor_createtrackprocessor": ".createTrackProcessor()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L61 | neighbors=[RealtimeAudioProcessor, .removeTrackProcessor(), .updateSoloState(), TrackProcessor]
- "audio_sound_library_engine_soundlibraryengine_analyzeaudio": ".analyzeAudio()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L763 | neighbors=[SoundLibraryEngine, .detectBeats(), .detectKey(), .generateWaveform()]
- "audio_volume_automation_audioducker_applyducking": ".applyDucking()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L713 | neighbors=[AudioDucker, .generateDuckingKeyframes(), VolumeAutomation, .applyVolumeAutomation()]
- "audio_volume_automation_volumeautomation_schedulevolumekeyframes": ".scheduleVolumeKeyframes()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L127 | neighbors=[VolumeAutomation, .applyVolumeAutomation(), clampVolume(), .applyInterpolation()]
- "beat_detection_index_preloadwasmbeatdetection": "preloadWasmBeatDetection()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L269 | neighbors=[index.ts, .ensureWasm(), getBeatDetectionProcessor(), index.ts]
- "components_helptooltipmanager": "HelpTooltipManager.tsx" | kind=code-symbol | source=src/components/HelpTooltipManager.tsx:L1 | neighbors=[HelpTooltipManager(), editorStore.ts, useEditorStore, App.tsx]
- "components_thumbnailmodal": "ThumbnailModal.tsx" | kind=code-symbol | source=src/components/ThumbnailModal.tsx:L1 | neighbors=[PreviewCanvas.tsx, TextLayer, ThumbnailModal(), ThumbnailModalProps]
- "components_timeline_gettrackheight": "getTrackHeight()" | kind=code-symbol | source=src/components/Timeline.tsx:L586 | neighbors=[Timeline.tsx, getTrackAtY(), getTrackTop(), Timeline()]
- "components_timeline_timeline": "Timeline()" | kind=code-symbol | source=src/components/Timeline.tsx:L1212 | neighbors=[Timeline.tsx, getTrackHeight(), getTrackTop(), App.tsx]
- "device_device_capabilities_benchmarkresult": "BenchmarkResult" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L33 | neighbors=[device-capabilities.ts, export-estimator.ts, export-estimator.test.ts, index.ts]
- "editing_templates_categories": "categories.ts" | kind=code-symbol | source=packages/core/src/editing-templates/categories.ts:L1 | neighbors=[EDITING_TEMPLATE_CATEGORIES, types.ts, EditingTemplateCategoryDefinition, index.ts]
- "editing_templates_resolver_resolveemphasisanimation": "resolveEmphasisAnimation()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L321 | neighbors=[resolver.ts, resolveValue(), toNumber(), resolveOverlay()]
- "editing_templates_resolver_resolvetransform": "resolveTransform()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L298 | neighbors=[resolver.ts, resolveOverlay(), resolveNestedValue(), toNumber()]
- "editing_templates_resolver_tonumber": "toNumber()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L413 | neighbors=[resolver.ts, resolveEmphasisAnimation(), resolveOverlay(), resolveTransform()]
- "editing_templates_types_editingtemplate": "EditingTemplate" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L180 | neighbors=[built-in-templates.ts, registry.ts, resolver.ts, types.ts]
- "editing_templates_types_editingtemplateoverlaybase": "EditingTemplateOverlayBase" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L127 | neighbors=[types.ts, EditingTemplateImageOverlay, EditingTemplateShapeOverlay, EditingTemplateTextOverlay]
- "export_export_engine_exportengine_createprogress": ".createProgress()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1303 | neighbors=[ExportEngine, .exportAudio(), .exportImageSequence(), .exportVideo()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-018.json

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
