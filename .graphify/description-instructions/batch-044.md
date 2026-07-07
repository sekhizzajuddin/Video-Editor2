# Node Description Batch 45 of 128

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

- "audio_audio_engine_audioengine_getaudiotracksattime": ".getAudioTracksAtTime()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L288 | neighbors=[AudioEngine, .renderAudio()]
- "audio_audio_engine_audioengine_istrackmuted": ".isTrackMuted()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L257 | neighbors=[AudioEngine, .renderAudio()]
- "audio_audio_engine_audioengine_mixtracks": ".mixTracks()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L719 | neighbors=[AudioEngine, .ensureInitialized()]
- "audio_audio_engine_audioengine_shouldusesegmentedaudiodecoding": ".shouldUseSegmentedAudioDecoding()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L478 | neighbors=[AudioEngine, .renderClipToContext()]
- "audio_audio_engine_initializeaudioengine": "initializeAudioEngine()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L992 | neighbors=[audio-engine.ts, getAudioEngine()]
- "audio_audio_engine_segmentedaudiodecoder_buffers": ".buffers()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L81 | neighbors=[.renderClipToContextFromSegments(), SegmentedAudioDecoder]
- "audio_beat_detection_engine_beat": "Beat" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L7 | neighbors=[beat-detection-engine.ts, auto-edit-service.ts]
- "audio_beat_detection_engine_beatdetectionengine_analyzefromurl": ".analyzeFromUrl()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L91 | neighbors=[BeatDetectionEngine, .analyzeFromBlob()]
- "audio_beat_detection_engine_beatdetectionengine_calculateadaptivethreshold": ".calculateAdaptiveThreshold()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L159 | neighbors=[BeatDetectionEngine, .detectOnsets()]
- "audio_beat_detection_engine_beatdetectionengine_calculatebpm": ".calculateBpm()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L181 | neighbors=[BeatDetectionEngine, .analyzeAudioBuffer()]
- "audio_beat_detection_engine_beatdetectionengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L43 | neighbors=[BeatDetectionEngine, .initWasm()]
- "audio_beat_detection_engine_beatdetectionengine_detectdownbeats": ".detectDownbeats()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L303 | neighbors=[BeatDetectionEngine, .analyzeAudioBuffer()]
- "audio_beat_detection_engine_beatdetectionengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L375 | neighbors=[BeatDetectionEngine, disposeBeatDetectionEngine()]
- "audio_beat_detection_engine_beatdetectionengine_findnearestonset": ".findNearestOnset()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L284 | neighbors=[BeatDetectionEngine, .generateBeats()]
- "audio_beat_detection_engine_beatdetectionengine_initwasm": ".initWasm()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L49 | neighbors=[BeatDetectionEngine, .constructor()]
- "audio_beat_detection_engine_disposebeatdetectionengine": "disposeBeatDetectionEngine()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L392 | neighbors=[beat-detection-engine.ts, .dispose()]
- "audio_clip_audio_resolution_getclipaudiotrackindex": "getClipAudioTrackIndex()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L7 | neighbors=[clip-audio-resolution.ts, isAlignedLinkedClip()]
- "audio_clip_audio_resolution_test_createclip": "createClip()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.test.ts:L9 | neighbors=[clip-audio-resolution.test.ts, createSeparatedAudioTimeline()]
- "audio_clip_audio_resolution_test_createtrack": "createTrack()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.test.ts:L31 | neighbors=[clip-audio-resolution.test.ts, createSeparatedAudioTimeline()]
- "audio_clip_volume_automation_getautomationvalueattime": "getAutomationValueAtTime()" | kind=code-symbol | source=packages/core/src/audio/clip-volume-automation.ts:L20 | neighbors=[clip-volume-automation.ts, getVolumeAutomationPointsForRange()]
- "audio_clip_volume_automation_sanitizepoints": "sanitizePoints()" | kind=code-symbol | source=packages/core/src/audio/clip-volume-automation.ts:L4 | neighbors=[clip-volume-automation.ts, getVolumeAutomationPointsForRange()]
- "audio_clip_volume_automation_test": "clip-volume-automation.test.ts" | kind=code-symbol | source=packages/core/src/audio/clip-volume-automation.test.ts:L1 | neighbors=[clip-volume-automation.ts, getVolumeAutomationPointsForRange()]
- "audio_effects_worklet_processor_createeffectsworkletblob": "createEffectsWorkletBlob()" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L170 | neighbors=[effects-worklet-processor.ts, createEffectsWorkletUrl()]
- "audio_effects_worklet_processor_loadeffectsworklet": "loadEffectsWorklet()" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L179 | neighbors=[effects-worklet-processor.ts, createEffectsWorkletUrl()]
- "audio_fft_getfft": "getFFT()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L203 | neighbors=[fft.ts, FFT]
- "audio_noise_reduction_detectnoisesegments": "detectNoiseSegments()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L262 | neighbors=[noise-reduction.ts, autoLearnNoiseProfile()]
- "audio_noise_reduction_extractaudiosegment": "extractAudioSegment()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L306 | neighbors=[noise-reduction.ts, autoLearnNoiseProfile()]
- "audio_noise_reduction_findquietestcontiguouswindow": "findQuietestContiguousWindow()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L374 | neighbors=[noise-reduction.ts, autoLearnNoiseProfile()]
- "audio_noise_reduction_islikelynoiseonly": "isLikelyNoiseOnly()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L420 | neighbors=[noise-reduction.ts, autoLearnNoiseProfile()]
- "audio_noise_reduction_spectralnoisereducer_applyspectralsubtraction": ".applySpectralSubtraction()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L215 | neighbors=[SpectralNoiseReducer, .processChannel()]
- "audio_noise_reduction_spectralnoisereducer_computemagnitudespectrum": ".computeMagnitudeSpectrum()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L202 | neighbors=[SpectralNoiseReducer, .learnNoiseProfile()]
- "audio_noise_reduction_spectralnoisereducer_computespectrum": ".computeSpectrum()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L207 | neighbors=[SpectralNoiseReducer, .processChannel()]
- "audio_noise_reduction_spectralnoisereducer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L36 | neighbors=[SpectralNoiseReducer, .initWasm()]
- "audio_noise_reduction_spectralnoisereducer_processbuffer": ".processBuffer()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L122 | neighbors=[SpectralNoiseReducer, .processChannel()]
- "audio_noise_reduction_spectralnoisereducer_reconstructframe": ".reconstructFrame()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L244 | neighbors=[SpectralNoiseReducer, .processChannel()]
- "audio_noise_reduction_spectralnoisereducer_setnoiseprofile": ".setNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L112 | neighbors=[SpectralNoiseReducer, .initWasm()]
- "audio_realtime_audio_graph_audioclipschedule": "AudioClipSchedule" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L9 | neighbors=[realtime-audio-graph.ts, playback-controller.ts]
- "audio_realtime_audio_graph_disposerealtimeaudiograph": "disposeRealtimeAudioGraph()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L748 | neighbors=[realtime-audio-graph.ts, .dispose()]
- "audio_realtime_audio_graph_getrealtimeaudiograph": "getRealtimeAudioGraph()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L731 | neighbors=[realtime-audio-graph.ts, RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L89 | neighbors=[RealtimeAudioGraph, .getAudioContext()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-044.json

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
