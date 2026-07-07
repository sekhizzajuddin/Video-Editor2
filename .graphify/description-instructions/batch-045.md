# Node Description Batch 46 of 128

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

- "audio_realtime_audio_graph_realtimeaudiograph_createcompressornode": ".createCompressorNode()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L252 | neighbors=[RealtimeAudioGraph, .buildEffectChain()]
- "audio_realtime_audio_graph_realtimeaudiograph_createdelaynodes": ".createDelayNodes()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L351 | neighbors=[RealtimeAudioGraph, .buildEffectChain()]
- "audio_realtime_audio_graph_realtimeaudiograph_createeqfilters": ".createEQFilters()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L263 | neighbors=[RealtimeAudioGraph, .buildEffectChain()]
- "audio_realtime_audio_graph_realtimeaudiograph_getaudiocontext": ".getAudioContext()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L96 | neighbors=[RealtimeAudioGraph, .constructor()]
- "audio_realtime_audio_graph_realtimeaudiograph_getorcreateimpulseresponse": ".getOrCreateImpulseResponse()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L315 | neighbors=[RealtimeAudioGraph, .createReverbNodes()]
- "audio_realtime_audio_graph_realtimeaudiograph_scheduleclips": ".scheduleClips()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L618 | neighbors=[RealtimeAudioGraph, .scheduleClip()]
- "audio_realtime_audio_graph_realtimeaudiograph_seekto": ".seekTo()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L713 | neighbors=[RealtimeAudioGraph, .stopAllClips()]
- "audio_realtime_audio_graph_realtimeaudiograph_setmastervolume": ".setMasterVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L105 | neighbors=[RealtimeAudioGraph, .applyMasterGain()]
- "audio_realtime_audio_graph_realtimeaudiograph_setpreviewmuted": ".setPreviewMuted()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L111 | neighbors=[RealtimeAudioGraph, .applyMasterGain()]
- "audio_realtime_audio_graph_realtimeaudiograph_settrackmuted": ".setTrackMuted()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L462 | neighbors=[RealtimeAudioGraph, .updateTrackAudibility()]
- "audio_realtime_audio_graph_realtimeaudiograph_settracksolo": ".setTrackSolo()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L470 | neighbors=[RealtimeAudioGraph, .updateSoloState()]
- "audio_realtime_audio_graph_realtimeaudiograph_suspend": ".suspend()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L657 | neighbors=[RealtimeAudioGraph, .stopAllClips()]
- "audio_realtime_audio_graph_realtimeaudiograph_updatetrackvolume": ".updateTrackVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L421 | neighbors=[RealtimeAudioGraph, .updateTrackAudibility()]
- "audio_realtime_processor_realtimeaudioprocessor_geteffectiveaudibility": ".getEffectiveAudibility()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L130 | neighbors=[RealtimeAudioProcessor, .isAudible()]
- "audio_realtime_processor_realtimeaudioprocessor_loadworklet": ".loadWorklet()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L49 | neighbors=[RealtimeAudioProcessor, .initialize()]
- "audio_realtime_processor_realtimeaudioprocessor_settrackmuted": ".setTrackMuted()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L101 | neighbors=[RealtimeAudioProcessor, .setMuted()]
- "audio_realtime_processor_realtimeaudioprocessor_settrackpan": ".setTrackPan()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L123 | neighbors=[RealtimeAudioProcessor, .setPan()]
- "audio_realtime_processor_realtimeaudioprocessor_settrackvolume": ".setTrackVolume()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L116 | neighbors=[RealtimeAudioProcessor, .setVolume()]
- "audio_realtime_processor_trackprocessor_createeqnode": ".createEQNode()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L270 | neighbors=[TrackProcessor, .createEffectNode()]
- "audio_realtime_processor_trackprocessor_setpan": ".setPan()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L314 | neighbors=[.setTrackPan(), TrackProcessor]
- "audio_sound_generator_soundgenerator_createcrispsnare": ".createCrispSnare()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L404 | neighbors=[SoundGenerator, .generateFullTrack()]
- "audio_sound_generator_soundgenerator_createpunchykick": ".createPunchyKick()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L363 | neighbors=[SoundGenerator, .generateFullTrack()]
- "audio_sound_generator_soundgenerator_createreverbimpulse": ".createReverbImpulse()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L207 | neighbors=[SoundGenerator, .generateFullTrack()]
- "audio_sound_generator_soundgenerator_createrichbass": ".createRichBass()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L309 | neighbors=[SoundGenerator, .generateFullTrack()]
- "audio_sound_generator_soundgenerator_createshimmeringhihat": ".createShimmeringHiHat()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L453 | neighbors=[SoundGenerator, .generateFullTrack()]
- "audio_sound_generator_soundgenerator_generateambientpad": ".generateAmbientPad()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1202 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatearpeggio": ".generateArpeggio()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1456 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatebassline": ".generateBassline()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1541 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generateboing": ".generateBoing()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L829 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatechordprogression": ".generateChordProgression()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1272 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatecinematichit": ".generateCinematicHit()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2060 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generateclick": ".generateClick()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L642 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatecountdown": ".generateCountdown()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2252 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatedrumloop": ".generateDrumLoop()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1627 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generateerrorsound": ".generateErrorSound()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2205 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generateglitch": ".generateGlitch()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L885 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generateimpact": ".generateImpact()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L567 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatelaser": ".generateLaser()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1006 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatenotification": ".generateNotification()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L685 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatepop": ".generatePop()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L786 | neighbors=[SoundGenerator, .audioBufferToBlob()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-045.json

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
