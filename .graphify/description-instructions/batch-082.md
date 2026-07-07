# Node Description Batch 83 of 128

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

- "audio_sound_generator_melody_patterns": "MELODY_PATTERNS" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L170 | neighbors=[sound-generator.ts]
- "audio_sound_generator_note_frequencies": "NOTE_FREQUENCIES" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L9 | neighbors=[sound-generator.ts]
- "audio_sound_generator_rich_progressions": "RICH_PROGRESSIONS" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L131 | neighbors=[sound-generator.ts]
- "audio_sound_generator_scales": "SCALES" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L178 | neighbors=[sound-generator.ts]
- "audio_sound_generator_soundgenerator_createpluckysynth": ".createPluckySynth()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L270 | neighbors=[SoundGenerator]
- "audio_sound_generator_soundgenerator_createwarmpad": ".createWarmPad()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L226 | neighbors=[SoundGenerator]
- "audio_sound_generator_soundgenerator_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L2360 | neighbors=[SoundGenerator]
- "audio_sound_library_engine_soundlibraryengine_addcustomsound": ".addCustomSound()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L866 | neighbors=[SoundLibraryEngine]
- "audio_sound_library_engine_soundlibraryengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L25 | neighbors=[SoundLibraryEngine]
- "audio_sound_library_engine_soundlibraryengine_getsound": ".getSound()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L711 | neighbors=[SoundLibraryEngine]
- "audio_sound_library_engine_soundlibraryengine_getsoundblob": ".getSoundBlob()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L642 | neighbors=[SoundLibraryEngine]
- "audio_sound_library_engine_soundlibraryengine_removesound": ".removeSound()" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L875 | neighbors=[SoundLibraryEngine]
- "audio_types_audioeffectnodeconfig": "AudioEffectNodeConfig" | kind=code-symbol | source=packages/core/src/audio/types.ts:L61 | neighbors=[types.ts]
- "audio_types_audiowaveformdata": "AudioWaveformData" | kind=code-symbol | source=packages/core/src/audio/types.ts:L3 | neighbors=[types.ts]
- "audio_volume_automation_audiobeziercontrolpoints": "AudioBezierControlPoints" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L10 | neighbors=[volume-automation.ts]
- "audio_volume_automation_audioducker_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L556 | neighbors=[AudioDucker]
- "audio_volume_automation_audioducker_createrealtimeducker": ".createRealtimeDucker()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L751 | neighbors=[AudioDucker]
- "audio_volume_automation_audioducker_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L801 | neighbors=[AudioDucker]
- "audio_volume_automation_audioducker_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L581 | neighbors=[AudioDucker]
- "audio_volume_automation_audioducker_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L560 | neighbors=[AudioDucker]
- "audio_volume_automation_audioducker_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L577 | neighbors=[AudioDucker]
- "audio_volume_automation_automationcurve": "AutomationCurve" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L3 | neighbors=[volume-automation.ts]
- "audio_volume_automation_automationpoint": "AutomationPoint" | kind=code-symbol | neighbors=[VolumeKeyframe]
- "audio_volume_automation_duckingconfig": "DuckingConfig" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L28 | neighbors=[volume-automation.ts]
- "audio_volume_automation_fadeconfig": "FadeConfig" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L22 | neighbors=[volume-automation.ts]
- "audio_volume_automation_volumeautomation_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L52 | neighbors=[VolumeAutomation]
- "audio_volume_automation_volumeautomation_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L526 | neighbors=[VolumeAutomation]
- "audio_volume_automation_volumeautomation_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L77 | neighbors=[VolumeAutomation]
- "audio_volume_automation_volumeautomation_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L56 | neighbors=[VolumeAutomation]
- "audio_volume_automation_volumeautomation_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L73 | neighbors=[VolumeAutomation]
- "audio_volume_automation_volumeautomationresult": "VolumeAutomationResult" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L36 | neighbors=[volume-automation.ts]
- "beat_detection_index_beatdetectionprocessor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L185 | neighbors=[BeatDetectionProcessor]
- "beat_detection_index_wasmbeatdetectionexports": "WasmBeatDetectionExports" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L1 | neighbors=[index.ts]
- "components_aimotiongraphicsdesigner_aimotiongraphicsprops": "AiMotionGraphicsProps" | kind=code-symbol | source=src/components/AiMotionGraphicsDesigner.tsx:L7 | neighbors=[AiMotionGraphicsDesigner.tsx]
- "components_aisounddesigner_aicueresult": "AICueResult" | kind=code-symbol | neighbors=[CueWithOptions]
- "components_aisounddesigner_aisounddesignerprops": "AiSoundDesignerProps" | kind=code-symbol | source=src/components/AiSoundDesigner.tsx:L11 | neighbors=[AiSoundDesigner.tsx]
- "components_audiomixer_channelstrip": "ChannelStrip()" | kind=code-symbol | source=src/components/AudioMixer.tsx:L76 | neighbors=[AudioMixer.tsx]
- "components_audiomixer_channelstripprops": "ChannelStripProps" | kind=code-symbol | source=src/components/AudioMixer.tsx:L68 | neighbors=[AudioMixer.tsx]
- "components_audiomixer_masterchannelstrip": "MasterChannelStrip()" | kind=code-symbol | source=src/components/AudioMixer.tsx:L319 | neighbors=[AudioMixer.tsx]
- "components_audiomixer_masterchannelstripprops": "MasterChannelStripProps" | kind=code-symbol | source=src/components/AudioMixer.tsx:L312 | neighbors=[AudioMixer.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-082.json

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
