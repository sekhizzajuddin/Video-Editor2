# Node Description Batch 28 of 128

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

- "audio_realtime_processor_trackprocessor_createeffectnode": ".createEffectNode()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L241 | neighbors=[TrackProcessor, .createEQNode(), .createEffectNodes()]
- "audio_realtime_processor_trackprocessor_createeffectnodes": ".createEffectNodes()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L220 | neighbors=[TrackProcessor, .constructor(), .createEffectNode()]
- "audio_realtime_processor_trackprocessor_isaudible": ".isAudible()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L342 | neighbors=[.getEffectiveAudibility(), TrackProcessor, .updateAudibility()]
- "audio_realtime_processor_trackprocessor_sethassolotracks": ".setHasSoloTracks()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L329 | neighbors=[.updateSoloState(), TrackProcessor, .updateAudibility()]
- "audio_realtime_processor_trackprocessor_setmuted": ".setMuted()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L319 | neighbors=[.setTrackMuted(), TrackProcessor, .updateAudibility()]
- "audio_realtime_processor_trackprocessor_setsolo": ".setSolo()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L324 | neighbors=[.setTrackSolo(), TrackProcessor, .updateAudibility()]
- "audio_realtime_processor_trackprocessor_setvolume": ".setVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L309 | neighbors=[.setTrackVolume(), TrackProcessor, .updateAudibility()]
- "audio_sound_generator_getsoundgenerator": "getSoundGenerator()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2370 | neighbors=[sound-generator.ts, SoundGenerator, sound-library-engine.ts]
- "audio_sound_generator_soundgenerator_generatemelody": ".generateMelody()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1359 | neighbors=[SoundGenerator, .audioBufferToBlob(), .getScaleFrequencies()]
- "audio_sound_library_engine_soundlibraryengine_stoppreview": ".stopPreview()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L746 | neighbors=[SoundLibraryEngine, .dispose(), .previewSound()]
- "audio_types_renderedaudio": "RenderedAudio" | kind=code-symbol | source=packages/core/src/audio/types.ts:L67 | neighbors=[audio-engine.ts, types.ts, types.ts]
- "audio_volume_automation_getaudioducker": "getAudioDucker()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L812 | neighbors=[volume-automation.ts, AudioDucker, initializeAudioDucker()]
- "audio_volume_automation_getvolumeautomation": "getVolumeAutomation()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L537 | neighbors=[volume-automation.ts, VolumeAutomation, initializeVolumeAutomation()]
- "audio_volume_automation_volumeautomation_applyconstantvolume": ".applyConstantVolume()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L301 | neighbors=[VolumeAutomation, clampVolume(), .applyVolumeAutomation()]
- "audio_volume_automation_volumeautomation_applyfadein": ".applyFadeIn()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L324 | neighbors=[VolumeAutomation, clampVolume(), .applyInterpolation()]
- "audio_volume_automation_volumeautomation_applyfadeout": ".applyFadeOut()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L365 | neighbors=[VolumeAutomation, clampVolume(), .applyInterpolation()]
- "audio_volume_automation_volumeautomation_applyfades": ".applyFades()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L407 | neighbors=[VolumeAutomation, clampVolume(), .applyInterpolation()]
- "audio_volume_automation_volumeautomation_cubicbezier": ".cubicBezier()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L285 | neighbors=[VolumeAutomation, .generateBezierCurve(), .getVolumeAtTime()]
- "audio_volume_automation_volumeautomation_generatebeziercurve": ".generateBezierCurve()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L267 | neighbors=[VolumeAutomation, .applyInterpolation(), .cubicBezier()]
- "audio_volume_automation_volumeautomation_getvolumeattime": ".getVolumeAtTime()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L465 | neighbors=[VolumeAutomation, clampVolume(), .cubicBezier()]
- "beat_detection_index_beatdetectionprocessor_ensurewasm": ".ensureWasm()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L189 | neighbors=[BeatDetectionProcessor, initWasmBeatDetection(), preloadWasmBeatDetection()]
- "components_telepromptermodal": "TeleprompterModal.tsx" | kind=code-symbol | source=src/components/TeleprompterModal.tsx:L1 | neighbors=[TeleprompterModal(), TeleprompterModalProps, App.tsx]
- "components_timeline_generatefallbackwaveform": "generateFallbackWaveform()" | kind=code-symbol | source=src/components/Timeline.tsx:L687 | neighbors=[Timeline.tsx, seededRandom(), WaveformOverlay()]
- "components_timeline_gettracktop": "getTrackTop()" | kind=code-symbol | source=src/components/Timeline.tsx:L604 | neighbors=[Timeline.tsx, getTrackHeight(), Timeline()]
- "components_timeline_seededrandom": "seededRandom()" | kind=code-symbol | source=src/components/Timeline.tsx:L674 | neighbors=[Timeline.tsx, FrameStripOverlay(), generateFallbackWaveform()]
- "device_device_capabilities_detectencodingsupport": "detectEncodingSupport()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L208 | neighbors=[device-capabilities.ts, detectDeviceCapabilities(), checkCodecSupport()]
- "device_device_capabilities_detectgpu": "detectGpu()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L129 | neighbors=[device-capabilities.ts, detectDeviceCapabilities(), getGpuTier()]
- "device_device_capabilities_formatdevicesummary": "formatDeviceSummary()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L430 | neighbors=[device-capabilities.ts, device-capabilities.test.ts, index.ts]
- "device_device_capabilities_getcodecrecommendations": "getCodecRecommendations()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L271 | neighbors=[device-capabilities.ts, device-capabilities.test.ts, index.ts]
- "device_device_capabilities_getdeviceprofile": "getDeviceProfile()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L419 | neighbors=[device-capabilities.ts, detectDeviceCapabilities(), index.ts]
- "device_device_capabilities_getresolutionrecommendations": "getResolutionRecommendations()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L336 | neighbors=[device-capabilities.ts, device-capabilities.test.ts, index.ts]
- "device_device_capabilities_savebenchmarkresult": "saveBenchmarkResult()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L398 | neighbors=[device-capabilities.ts, export-estimator.ts, index.ts]
- "device_export_estimator_comparecodecestimates": "compareCodecEstimates()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L198 | neighbors=[export-estimator.ts, export-estimator.test.ts, index.ts]
- "device_export_estimator_exportestimatesettings": "ExportEstimateSettings" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L4 | neighbors=[export-estimator.ts, export-estimator.test.ts, index.ts]
- "device_export_estimator_shouldrecommendbenchmark": "shouldRecommendBenchmark()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L352 | neighbors=[export-estimator.ts, export-estimator.test.ts, index.ts]
- "editing_templates_resolver_resolveeditingtemplatecontrolvalues": "resolveEditingTemplateControlValues()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L50 | neighbors=[resolver.ts, resolveEditingTemplate(), getEditingTemplateDefaultControlValues()]
- "editing_templates_resolver_resolveeffect": "resolveEffect()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L156 | neighbors=[resolver.ts, resolveEffectKeyframes(), resolveRecord()]
- "editing_templates_resolver_resolvenestedvalue": "resolveNestedValue()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L374 | neighbors=[resolver.ts, resolveValue(), resolveTransform()]
- "editing_templates_resolver_resolveoverlaytiming": "resolveOverlayTiming()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L107 | neighbors=[resolver.ts, resolveOverlay(), resolveRangeTiming()]
- "editing_templates_resolver_resolverangetiming": "resolveRangeTiming()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L137 | neighbors=[resolver.ts, resolveOverlayTiming(), clamp()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-027.json

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
