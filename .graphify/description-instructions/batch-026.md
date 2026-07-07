# Node Description Batch 27 of 128

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

- "audio_audio_effects_engine_audioeffectsengine_createreverbnode": ".createReverbNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L884 | neighbors=[AudioEffectsEngine, .createEffectNode(), .getOrCreateImpulseResponse()]
- "audio_audio_effects_engine_audioeffectsengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1225 | neighbors=[AudioEffectsEngine, .clearImpulseResponseCache(), .clearNoiseProfiles()]
- "audio_audio_effects_engine_audioeffectsengine_getorcreateimpulseresponse": ".getOrCreateImpulseResponse()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L927 | neighbors=[AudioEffectsEngine, .createReverbNode(), .generateImpulseResponse()]
- "audio_audio_effects_engine_createnoisereductionpostfiltersforcontext": "createNoiseReductionPostFiltersForContext()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L181 | neighbors=[audio-effects-engine.ts, createNoiseReductionNodeChain(), createProfileBasedNoiseReductionFilters…]
- "audio_audio_effects_engine_getaudioeffectsengine": "getAudioEffectsEngine()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1239 | neighbors=[audio-effects-engine.ts, AudioEffectsEngine, initializeAudioEffectsEngine()]
- "audio_audio_effects_engine_getbufferpeak": "getBufferPeak()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L497 | neighbors=[audio-effects-engine.ts, isBufferUsable(), restoreVoicePresence()]
- "audio_audio_effects_engine_getbufferrms": "getBufferRms()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L514 | neighbors=[audio-effects-engine.ts, isBufferUsable(), restoreVoicePresence()]
- "audio_audio_effects_engine_initializeaudioeffectsengine": "initializeAudioEffectsEngine()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1246 | neighbors=[audio-effects-engine.ts, .initialize(), getAudioEffectsEngine()]
- "audio_audio_effects_engine_test": "audio-effects-engine.test.ts" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.test.ts:L1 | neighbors=[audio-effects-engine.ts, AudioEffectsEngine, createAudioBuffer()]
- "audio_audio_effects_engine_tosimplenoiseprofile": "toSimpleNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L452 | neighbors=[audio-effects-engine.ts, .applyNoiseReductionWithProfileData(), createNoiseReductionNodeChain()]
- "audio_audio_engine_audioengine_applyeffect": ".applyEffect()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L774 | neighbors=[AudioEngine, .createEffectNode(), .ensureInitialized()]
- "audio_audio_engine_audioengine_applyfades": ".applyFades()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L698 | neighbors=[AudioEngine, .renderClipToContext(), .renderClipToContextFromSegments()]
- "audio_audio_engine_audioengine_applyvolumeautomation": ".applyVolumeAutomation()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L659 | neighbors=[AudioEngine, .renderClipToContext(), .renderClipToContextFromSegments()]
- "audio_audio_engine_audioengine_createclipoutputnodes": ".createClipOutputNodes()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L635 | neighbors=[AudioEngine, .renderClipToContext(), .renderClipToContextFromSegments()]
- "audio_audio_engine_audioengine_createeffectnode": ".createEffectNode()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L800 | neighbors=[AudioEngine, .applyEffect(), .createEQNode()]
- "audio_audio_engine_audioengine_getaudiobuffer": ".getAudioBuffer()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L361 | neighbors=[AudioEngine, .extractAudioFromVideo(), .renderClipToContext()]
- "audio_audio_engine_audioengine_getsegmentedaudiodecoder": ".getSegmentedAudioDecoder()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L674 | neighbors=[AudioEngine, SegmentedAudioDecoder, .renderClipToContextFromSegments()]
- "audio_audio_engine_audioengine_processclipbuffer": ".processClipBuffer()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L490 | neighbors=[AudioEngine, .extractAudioSegment(), .renderClipToContext()]
- "audio_beat_detection_engine_beatanalysisresult": "BeatAnalysisResult" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L13 | neighbors=[beat-detection-engine.ts, audio-text-sync-engine.ts, auto-edit-service.ts]
- "audio_beat_detection_engine_beatdetectionengine_analyzefromblob": ".analyzeFromBlob()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L81 | neighbors=[BeatDetectionEngine, .analyzeAudioBuffer(), .analyzeFromUrl()]
- "audio_beat_detection_engine_beatdetectionengine_detectonsets": ".detectOnsets()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L104 | neighbors=[BeatDetectionEngine, .analyzeAudioBuffer(), .calculateAdaptiveThreshold()]
- "audio_beat_detection_engine_beatdetectionengine_generatebeats": ".generateBeats()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L247 | neighbors=[BeatDetectionEngine, .analyzeAudioBuffer(), .findNearestOnset()]
- "audio_beat_detection_engine_getbeatdetectionengine": "getBeatDetectionEngine()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L385 | neighbors=[beat-detection-engine.ts, BeatDetectionEngine, audio-text-sync-engine.ts]
- "audio_clip_audio_resolution_isalignedlinkedclip": "isAlignedLinkedClip()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L9 | neighbors=[clip-audio-resolution.ts, getLinkedAudioClips(), getClipAudioTrackIndex()]
- "audio_clip_audio_resolution_resolveaudibleaudiotarget": "resolveAudibleAudioTarget()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L104 | neighbors=[clip-audio-resolution.ts, getLinkedAudioClips(), clip-audio-resolution.test.ts]
- "audio_clip_audio_resolution_test_createseparatedaudiotimeline": "createSeparatedAudioTimeline()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.test.ts:L44 | neighbors=[clip-audio-resolution.test.ts, createClip(), createTrack()]
- "audio_effects_worklet_processor_createeffectsworkleturl": "createEffectsWorkletUrl()" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L174 | neighbors=[effects-worklet-processor.ts, createEffectsWorkletBlob(), loadEffectsWorklet()]
- "audio_noise_reduction_noiseprofile": "NoiseProfile" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L4 | neighbors=[audio-effects-engine.ts, noise-reduction.ts, noise-reduction.test.ts]
- "audio_noise_reduction_spectralnoisereducer_getwindowvalue": ".getWindowValue()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L198 | neighbors=[SpectralNoiseReducer, .extractFrame(), .processChannel()]
- "audio_noise_reduction_spectralnoisereducer_initwasm": ".initWasm()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L44 | neighbors=[SpectralNoiseReducer, .constructor(), .setNoiseProfile()]
- "audio_realtime_audio_graph_realtimeaudiograph_applymastergain": ".applyMasterGain()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L116 | neighbors=[RealtimeAudioGraph, .setMasterVolume(), .setPreviewMuted()]
- "audio_realtime_audio_graph_realtimeaudiograph_createreverbnodes": ".createReverbNodes()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L287 | neighbors=[RealtimeAudioGraph, .buildEffectChain(), .getOrCreateImpulseResponse()]
- "audio_realtime_audio_graph_realtimeaudiograph_stopscheduler": ".stopScheduler()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L704 | neighbors=[RealtimeAudioGraph, .dispose(), .stopAllClips()]
- "audio_realtime_audio_graph_realtimeaudiograph_updatetrackeffects": ".updateTrackEffects()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L506 | neighbors=[RealtimeAudioGraph, .scheduleClip(), .createTrack()]
- "audio_realtime_processor_getrealtimeaudioprocessor": "getRealtimeAudioProcessor()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L370 | neighbors=[realtime-processor.ts, RealtimeAudioProcessor, initializeRealtimeProcessor()]
- "audio_realtime_processor_initializerealtimeprocessor": "initializeRealtimeProcessor()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L377 | neighbors=[realtime-processor.ts, getRealtimeAudioProcessor(), .initialize()]
- "audio_realtime_processor_realtimeaudioprocessor_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L33 | neighbors=[initializeRealtimeProcessor(), RealtimeAudioProcessor, .loadWorklet()]
- "audio_realtime_processor_realtimeaudioprocessor_removetrackprocessor": ".removeTrackProcessor()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L79 | neighbors=[RealtimeAudioProcessor, .createTrackProcessor(), .updateSoloState()]
- "audio_realtime_processor_realtimeaudioprocessor_settracksolo": ".setTrackSolo()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L108 | neighbors=[RealtimeAudioProcessor, .updateSoloState(), .setSolo()]
- "audio_realtime_processor_trackprocessor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L198 | neighbors=[TrackProcessor, .createEffectNodes(), .updateAudibility()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-026.json

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
