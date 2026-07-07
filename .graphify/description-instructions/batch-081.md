# Node Description Batch 82 of 128

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

- "audio_noise_reduction_default_noise_reduction_config": "DEFAULT_NOISE_REDUCTION_CONFIG" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L20 | neighbors=[noise-reduction.ts]
- "audio_noise_reduction_noisereductionconfig": "NoiseReductionConfig" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L12 | neighbors=[noise-reduction.ts]
- "audio_noise_reduction_spectralnoisereducer_getconfig": ".getConfig()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L257 | neighbors=[SpectralNoiseReducer]
- "audio_noise_reduction_spectralnoisereducer_getnoiseprofile": ".getNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L108 | neighbors=[SpectralNoiseReducer]
- "audio_noise_reduction_spectralnoisereducer_setconfig": ".setConfig()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L253 | neighbors=[SpectralNoiseReducer]
- "audio_noise_reduction_test_createaudiobuffer": "createAudioBuffer()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L10 | neighbors=[noise-reduction.test.ts]
- "audio_noise_reduction_test_createcontext": "createContext()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L20 | neighbors=[noise-reduction.test.ts]
- "audio_noise_reduction_test_createsilentprofile": "createSilentProfile()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L64 | neighbors=[noise-reduction.test.ts]
- "audio_noise_reduction_test_createsine": "createSine()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L39 | neighbors=[noise-reduction.test.ts]
- "audio_noise_reduction_test_estimatesineamplitude": "estimateSineAmplitude()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L51 | neighbors=[noise-reduction.test.ts]
- "audio_noise_reduction_test_testaudiobuffer": "TestAudioBuffer" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.test.ts:L4 | neighbors=[noise-reduction.test.ts]
- "audio_realtime_audio_graph_delaynodes": "DelayNodes" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L47 | neighbors=[realtime-audio-graph.ts]
- "audio_realtime_audio_graph_realtimeaudiograph_getmastergain": ".getMasterGain()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L100 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_getmastervolume": ".getMasterVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L458 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_gettrackpan": ".getTrackPan()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L453 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_gettrackvolume": ".getTrackVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L448 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_resume": ".resume()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L651 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_startscheduler": ".startScheduler()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L664 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_stopclip": ".stopClip()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L636 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_realtimeaudiograph_updatetrackpan": ".updateTrackPan()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L432 | neighbors=[RealtimeAudioGraph]
- "audio_realtime_audio_graph_reverbnodes": "ReverbNodes" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L39 | neighbors=[realtime-audio-graph.ts]
- "audio_realtime_audio_graph_scheduledsource": "ScheduledSource" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L32 | neighbors=[realtime-audio-graph.ts]
- "audio_realtime_audio_graph_trackconfig": "TrackConfig" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L23 | neighbors=[realtime-audio-graph.ts]
- "audio_realtime_audio_graph_tracknodes": "TrackNodes" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L56 | neighbors=[realtime-audio-graph.ts]
- "audio_realtime_processor_realtimeaudioprocessor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L29 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L170 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_getaudiocontext": ".getAudioContext()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L144 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_getmastergain": ".getMasterGain()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L148 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_hassolotracks": ".hasSoloTracks()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L140 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_resume": ".resume()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L158 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_setmastervolume": ".setMasterVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L152 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeaudioprocessor_suspend": ".suspend()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L164 | neighbors=[RealtimeAudioProcessor]
- "audio_realtime_processor_realtimeprocessorstate": "RealtimeProcessorState" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L12 | neighbors=[realtime-processor.ts]
- "audio_realtime_processor_trackprocessor_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L357 | neighbors=[TrackProcessor]
- "audio_realtime_processor_trackprocessor_getinputnode": ".getInputNode()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L305 | neighbors=[TrackProcessor]
- "audio_realtime_processor_trackprocessor_ismuted": ".isMuted()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L334 | neighbors=[TrackProcessor]
- "audio_realtime_processor_trackprocessor_issolo": ".isSolo()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L338 | neighbors=[TrackProcessor]
- "audio_realtime_processor_trackprocessorconfig": "TrackProcessorConfig" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L3 | neighbors=[realtime-processor.ts]
- "audio_sound_generator_chord_progressions": "CHORD_PROGRESSIONS" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L92 | neighbors=[sound-generator.ts]
- "audio_sound_generator_generatedsound": "GeneratedSound" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L3 | neighbors=[sound-generator.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-081.json

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
