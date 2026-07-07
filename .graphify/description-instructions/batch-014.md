# Node Description Batch 15 of 128

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

- "animation_animation_schema_textlayer": "TextLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L118 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, BaseLayer, index.ts]
- "animation_animation_schema_videolayer": "VideoLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L208 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, BaseLayer, index.ts]
- "animation_composition_renderer_compositionrenderer_rendershapelayer": ".renderShapeLayer()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L224 | neighbors=[CompositionRenderer, .renderLayer(), .createGradient(), .renderBezierPath(), .renderPolygon()]
- "animation_easing_functions_easing_functions": "EASING_FUNCTIONS" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L74 | neighbors=[composition-renderer.ts, easing-functions.ts, index.ts, text-animation-presets.ts, animation-engine.ts]
- "animation_easing_functions_easingname": "EasingName" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L1 | neighbors=[composition-renderer.ts, easing-functions.ts, index.ts, text-animation-presets.ts, animation-engine.ts]
- "animation_gsap_engine_generatedefaultcontrolpoints": "generateDefaultControlPoints()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L230 | neighbors=[gsap-engine.ts, .addGSAPMotionPathPoint(), .removeGSAPMotionPathPoint(), keyframesToMotionPath(), index.ts]
- "animation_gsap_engine_samplemotionpath": "sampleMotionPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L77 | neighbors=[gsap-engine.ts, .sampleFrameTransforms(), .samplePositionAtTime(), cubicBezierInterpolate(), index.ts]
- "audio_audio_effect_routing_test": "audio-effect-routing.test.ts" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.test.ts:L1 | neighbors=[audio-effect-routing.ts, getPanFromAudioEffects(), getPreviewAudioEffects(), isSerializedNoiseProfile(), splitProfileAwareNoiseReductionEffects()]
- "audio_audio_engine_audioengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L184 | neighbors=[AudioEngine, .applyEffect(), .getAudioContext(), .mixTracks(), .renderAudio()]
- "audio_audio_engine_audioengine_renderaudio": ".renderAudio()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L199 | neighbors=[AudioEngine, .ensureInitialized(), .getAudioTracksAtTime(), .isTrackMuted(), .renderClipToContext()]
- "audio_clip_audio_resolution_getlinkedaudioclips": "getLinkedAudioClips()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L46 | neighbors=[clip-audio-resolution.ts, isAlignedLinkedClip(), resolveAudibleAudioTarget(), resolveClipAudioEffects(), resolveClipVolumeAutomation()]
- "audio_clip_volume_automation_getvolumeautomationpointsforrange": "getVolumeAutomationPointsForRange()" | kind=code-symbol | source=packages/core/src/audio/clip-volume-automation.ts:L58 | neighbors=[clip-volume-automation.ts, getAutomationValueAtTime(), sanitizePoints(), scheduleVolumeAutomationOnGain(), clip-volume-automation.test.ts]
- "audio_highlight_analyzer": "highlight-analyzer.ts" | kind=code-symbol | source=packages/core/src/audio/highlight-analyzer.ts:L1 | neighbors=[analyzeAudioForHighlights(), AudioSegmentMetrics, HighlightAnalysisResult, TranscriptWord, index.ts]
- "audio_realtime_audio_graph_realtimeaudiograph_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L719 | neighbors=[disposeRealtimeAudioGraph(), initializeRealtimeAudioGraph(), RealtimeAudioGraph, .removeTrack(), .stopScheduler()]
- "audio_realtime_audio_graph_realtimeaudiograph_updatesolostate": ".updateSoloState()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L478 | neighbors=[RealtimeAudioGraph, .createTrack(), .removeTrack(), .setTrackSolo(), .updateTrackAudibility()]
- "audio_realtime_audio_graph_realtimeaudiograph_updatetrackaudibility": ".updateTrackAudibility()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L487 | neighbors=[RealtimeAudioGraph, .createTrack(), .setTrackMuted(), .updateSoloState(), .updateTrackVolume()]
- "audio_realtime_processor_realtimeaudioprocessor_updatesolostate": ".updateSoloState()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L88 | neighbors=[RealtimeAudioProcessor, .createTrackProcessor(), .removeTrackProcessor(), .setTrackSolo(), .setHasSoloTracks()]
- "audio_volume_automation_volumeautomation_applyvolumeautomation": ".applyVolumeAutomation()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L85 | neighbors=[.applyDucking(), VolumeAutomation, clampVolume(), .applyConstantVolume(), .scheduleVolumeKeyframes()]
- "beat_detection_index_getbeatdetectionprocessor": "getBeatDetectionProcessor()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L262 | neighbors=[beat-detection-engine.ts, index.ts, BeatDetectionProcessor, preloadWasmBeatDetection(), index.ts]
- "beat_detection_index_initwasmbeatdetection": "initWasmBeatDetection()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L57 | neighbors=[beat-detection-engine.ts, index.ts, .ensureWasm(), loadWasmModule(), index.ts]
- "components_colorscopes": "ColorScopes.tsx" | kind=code-symbol | source=src/components/ColorScopes.tsx:L1 | neighbors=[ColorScopes(), ColorScopesProps, editorStore.ts, useEditorStore, PreviewCanvas.tsx]
- "components_helpmodal": "HelpModal.tsx" | kind=code-symbol | source=src/components/HelpModal.tsx:L1 | neighbors=[HELP_SECTIONS, HelpModal(), editorStore.ts, useEditorStore, App.tsx]
- "device_device_capabilities_deviceprofile": "DeviceProfile" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L40 | neighbors=[device-capabilities.ts, device-capabilities.test.ts, export-estimator.ts, export-estimator.test.ts, index.ts]
- "effects_index": "index.ts" | kind=code-symbol | source=packages/core/src/effects/index.ts:L1 | neighbors=[expression-engine.ts, particle-engine.ts, particle-presets.ts, particle-types.ts, index.ts]
- "effects_particle_engine_randomrange": "randomRange()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L14 | neighbors=[particle-engine.ts, getEmissionPosition(), getInitialVelocity(), .createParticle(), .update()]
- "export_export_engine_exportengine_calculatetimelineduration": ".calculateTimelineDuration()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1357 | neighbors=[ExportEngine, .encodeTimelineAudioToSource(), .exportAudio(), .exportVideo(), .renderTimelineAudio()]
- "export_export_engine_exportengine_encodetimelineaudiotosource": ".encodeTimelineAudioToSource()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1097 | neighbors=[ExportEngine, .calculateTimelineDuration(), .createError(), .renderTimelineAudio(), .exportVideo()]
- "export_export_engine_exportengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L115 | neighbors=[ExportEngine, .exportAudio(), .exportFrame(), .exportImageSequence(), .exportVideo()]
- "export_export_engine_getexportengine": "getExportEngine()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1437 | neighbors=[export-engine.ts, ExportEngine, initializeExportEngine(), export-engine.test.ts, index.ts]
- "export_export_engine_test_mockmp4outputformat": "MockMp4OutputFormat" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L90 | neighbors=[export-engine.test.ts, MockMovOutputFormat, .getSupportedAudioCodecs(), .getSupportedVideoCodecs(), MockWebMOutputFormat]
- "ffmpeg_ffmpeg_core_getsocketaddress": "getSocketAddress()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, readSockaddr(), ___syscall_bind(), ___syscall_connect(), ___syscall_sendto()]
- "ffmpeg_ffmpeg_core_instantiateasync": "instantiateAsync()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, createWasm(), instantiateArrayBuffer(), isDataURI(), isFileURI()]
- "ffmpeg_ffmpeg_core_readsockaddr": "readSockaddr()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _getnameinfo(), getSocketAddress(), inetNtop4(), inetNtop6()]
- "ffmpeg_ffmpeg_core_stringtoutf8": "stringToUTF8()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _getnameinfo(), stringToNewUTF8(), stringToUTF8Array(), ___syscall_getdents64()]
- "ffmpeg_ffmpeg_core_utf8tostring": "UTF8ToString()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ___assert_fail(), _getaddrinfo(), _strftime(), UTF8ArrayToString()]
- "fft_index_getwasmfft": "getWasmFFT()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L213 | neighbors=[noise-reduction.ts, index.ts, WasmFFT, preloadWasmFFT(), index.ts]
- "fft_index_initwasmfft": "initWasmFFT()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L62 | neighbors=[noise-reduction.ts, index.ts, loadWasmModule(), .ensureWasm(), index.ts]
- "frame_interpolation_types_interpolationconfig": "InterpolationConfig" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/types.ts:L7 | neighbors=[frame-interpolation-engine.ts, index.ts, optical-flow-cpu.ts, optical-flow-gpu.ts, types.ts]
- "graphics_graphics_engine_graphicsengine_createshape": ".createShape()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L75 | neighbors=[GraphicsEngine, .createArrow(), .createCircle(), .createRectangle(), .generateId()]
- "graphics_graphics_engine_graphicsengine_getanimatedgraphicstate": ".getAnimatedGraphicState()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L899 | neighbors=[GraphicsEngine, .applyEmphasisAnimation(), .applyGraphicAnimation(), .getAnimatedTransform(), .renderGraphic()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-014.json

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
