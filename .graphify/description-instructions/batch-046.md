# Node Description Batch 47 of 128

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

- "audio_sound_generator_soundgenerator_generatepowerup": ".generatePowerUp()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1055 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generateriser": ".generateRiser()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L949 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatesimplebeat": ".generateSimpleBeat()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1114 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatestinger": ".generateStinger()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1989 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatesuccess": ".generateSuccess()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L737 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatetypingsound": ".generateTypingSound()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2156 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_generatewhoosh": ".generateWhoosh()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L495 | neighbors=[SoundGenerator, .audioBufferToBlob()]
- "audio_sound_generator_soundgenerator_getscalefrequencies": ".getScaleFrequencies()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L193 | neighbors=[SoundGenerator, .generateMelody()]
- "audio_sound_generator_soundgenerator_notetofreq": ".noteToFreq()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L189 | neighbors=[SoundGenerator, .generateFullTrack()]
- "audio_sound_library_engine_createsoundlibraryengine": "createSoundLibraryEngine()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L894 | neighbors=[sound-library-engine.ts, SoundLibraryEngine]
- "audio_sound_library_engine_soundlibraryengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L21 | neighbors=[SoundLibraryEngine, .loadBuiltinSounds()]
- "audio_sound_library_engine_soundlibraryengine_detectbeats": ".detectBeats()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L797 | neighbors=[SoundLibraryEngine, .analyzeAudio()]
- "audio_sound_library_engine_soundlibraryengine_detectkey": ".detectKey()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L850 | neighbors=[SoundLibraryEngine, .analyzeAudio()]
- "audio_sound_library_engine_soundlibraryengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L884 | neighbors=[SoundLibraryEngine, .stopPreview()]
- "audio_sound_library_engine_soundlibraryengine_generatewaveform": ".generateWaveform()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L774 | neighbors=[SoundLibraryEngine, .analyzeAudio()]
- "audio_sound_library_engine_soundlibraryengine_getbycategory": ".getByCategory()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L658 | neighbors=[SoundLibraryEngine, .getAllSounds()]
- "audio_sound_library_engine_soundlibraryengine_getbysubcategory": ".getBySubcategory()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L662 | neighbors=[SoundLibraryEngine, .getAllSounds()]
- "audio_sound_library_engine_soundlibraryengine_getmusic": ".getMusic()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L650 | neighbors=[SoundLibraryEngine, .getAllSounds()]
- "audio_sound_library_engine_soundlibraryengine_getsfx": ".getSFX()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L654 | neighbors=[SoundLibraryEngine, .getAllSounds()]
- "audio_sound_library_engine_soundlibraryengine_loadbuiltinsounds": ".loadBuiltinSounds()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L31 | neighbors=[SoundLibraryEngine, .constructor()]
- "audio_sound_library_engine_soundlibraryengine_previewsound": ".previewSound()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L715 | neighbors=[SoundLibraryEngine, .stopPreview()]
- "audio_sound_library_engine_soundlibraryengine_search": ".search()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L666 | neighbors=[SoundLibraryEngine, .getAllSounds()]
- "audio_types_audiochannelstate": "AudioChannelState" | kind=code-symbol | source=packages/core/src/audio/types.ts:L51 | neighbors=[audio-engine.ts, types.ts]
- "audio_types_audiocliprenderinfo": "AudioClipRenderInfo" | kind=code-symbol | source=packages/core/src/audio/types.ts:L32 | neighbors=[audio-engine.ts, types.ts]
- "audio_types_audioengineconfig": "AudioEngineConfig" | kind=code-symbol | source=packages/core/src/audio/types.ts:L75 | neighbors=[audio-engine.ts, types.ts]
- "audio_types_audiotrackrenderinfo": "AudioTrackRenderInfo" | kind=code-symbol | source=packages/core/src/audio/types.ts:L24 | neighbors=[audio-engine.ts, types.ts]
- "audio_types_default_audio_config": "DEFAULT_AUDIO_CONFIG" | kind=code-symbol | source=packages/core/src/audio/types.ts:L82 | neighbors=[audio-engine.ts, types.ts]
- "audio_types_loudnessmetrics": "LoudnessMetrics" | kind=code-symbol | source=packages/core/src/audio/types.ts:L11 | neighbors=[audio-engine.ts, types.ts]
- "audio_types_timerange": "TimeRange" | kind=code-symbol | source=packages/core/src/audio/types.ts:L19 | neighbors=[audio-engine.ts, types.ts]
- "audio_volume_automation_audioducker_deduplicatekeyframes": ".deduplicateKeyframes()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L698 | neighbors=[AudioDucker, .generateDuckingKeyframes()]
- "audio_volume_automation_audioducker_detectaudiopresence": ".detectAudioPresence()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L587 | neighbors=[AudioDucker, .generateDuckingKeyframes()]
- "audio_volume_automation_audioducker_mergepresenceranges": ".mergePresenceRanges()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L676 | neighbors=[AudioDucker, .generateDuckingKeyframes()]
- "audio_volume_automation_initializeaudioducker": "initializeAudioDucker()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L819 | neighbors=[volume-automation.ts, getAudioDucker()]
- "audio_volume_automation_initializevolumeautomation": "initializeVolumeAutomation()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L544 | neighbors=[volume-automation.ts, getVolumeAutomation()]
- "audio_volume_automation_volumeautomation_generatelogarithmiccurve": ".generateLogarithmicCurve()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L232 | neighbors=[VolumeAutomation, .applyInterpolation()]
- "audio_volume_automation_volumeautomation_generatescurve": ".generateSCurve()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L250 | neighbors=[VolumeAutomation, .applyInterpolation()]
- "audio_volume_automation_volumekeyframe": "VolumeKeyframe" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L17 | neighbors=[volume-automation.ts, AutomationPoint]
- "beat_detection_index_beatdetectionprocessor_calculatemean": ".calculateMean()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L245 | neighbors=[BeatDetectionProcessor, jsCalculateMean()]
- "beat_detection_index_beatdetectionprocessor_calculatemedian": ".calculateMedian()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L226 | neighbors=[BeatDetectionProcessor, jsCalculateMedian()]
- "beat_detection_index_beatdetectionprocessor_calculatestddev": ".calculateStdDev()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L252 | neighbors=[BeatDetectionProcessor, jsCalculateStdDev()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-046.json

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
