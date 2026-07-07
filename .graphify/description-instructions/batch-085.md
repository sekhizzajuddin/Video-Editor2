# Node Description Batch 86 of 128

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

- "effects_particle_engine_particleengine_getchangeversion": ".getChangeVersion()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L172 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_geteffect": ".getEffect()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L216 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_geteffectsforclip": ".getEffectsForClip()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L224 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_getparticles": ".getParticles()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L334 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_oneffectschange": ".onEffectsChange()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L158 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_reset": ".reset()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L359 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_setcanvassize": ".setCanvasSize()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L176 | neighbors=[ParticleEngine]
- "effects_particle_presets_confetti_colors": "CONFETTI_COLORS" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L16 | neighbors=[particle-presets.ts]
- "effects_particle_presets_dust_colors": "DUST_COLORS" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L19 | neighbors=[particle-presets.ts]
- "effects_particle_presets_fire_colors": "FIRE_COLORS" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L17 | neighbors=[particle-presets.ts]
- "effects_particle_presets_getparticlepresetsbytype": "getParticlePresetsByType()" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L309 | neighbors=[particle-presets.ts]
- "effects_particle_presets_magic_colors": "MAGIC_COLORS" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L20 | neighbors=[particle-presets.ts]
- "effects_particle_presets_particle_presets": "PARTICLE_PRESETS" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L22 | neighbors=[particle-presets.ts]
- "effects_particle_presets_particlepreset": "ParticlePreset" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L7 | neighbors=[particle-presets.ts]
- "effects_particle_presets_sparkle_colors": "SPARKLE_COLORS" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L18 | neighbors=[particle-presets.ts]
- "export_export_engine_exportengine_createpreset": ".createPreset()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1004 | neighbors=[ExportEngine]
- "export_export_engine_exportengine_estimateexporttime": ".estimateExportTime()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1040 | neighbors=[ExportEngine]
- "export_export_engine_exportengine_estimatefilesize": ".estimateFileSize()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1017 | neighbors=[ExportEngine]
- "export_export_engine_exportengine_getpresets": ".getPresets()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L826 | neighbors=[ExportEngine]
- "export_export_engine_exportengine_ismediabunnyavailable": ".isMediaBunnyAvailable()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L101 | neighbors=[ExportEngine]
- "export_export_engine_test_createmockproject": "createMockProject()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L165 | neighbors=[export-engine.test.ts]
- "export_export_engine_test_mockaudiobuffersource_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L129 | neighbors=[MockAudioBufferSource]
- "export_export_engine_test_mockmp4outputformat_getsupportedaudiocodecs": ".getSupportedAudioCodecs()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L95 | neighbors=[MockMp4OutputFormat]
- "export_export_engine_test_mockmp4outputformat_getsupportedvideocodecs": ".getSupportedVideoCodecs()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L91 | neighbors=[MockMp4OutputFormat]
- "export_export_engine_test_mockoutput": "MockOutput" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L103 | neighbors=[export-engine.test.ts]
- "export_export_engine_test_mockrenderframe_mockvideoengine_mockrenderaudio_mockaudioengine_mockmediaengine_mockvideosourceadd_mockaudiosourceadd_mockoutputstart_mockoutputfinalize": "{\n  mockRenderFrame,\n  mockVideoEngine,\n  mockRenderAudio,\n  mockAudioEngine,\n …" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L3 | neighbors=[export-engine.test.ts]
- "export_export_engine_test_mockstreamtarget_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L112 | neighbors=[MockStreamTarget]
- "export_export_engine_test_mockvideosample_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L135 | neighbors=[MockVideoSample]
- "export_export_engine_test_mockvideosamplesource_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L122 | neighbors=[MockVideoSampleSource]
- "export_export_worker_addaudio": "addAudio()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L230 | neighbors=[export-worker.ts]
- "export_export_worker_cancel": "cancel()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L325 | neighbors=[export-worker.ts]
- "export_export_worker_finalize": "finalize()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L269 | neighbors=[export-worker.ts]
- "export_export_worker_framequeue": "frameQueue" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L54 | neighbors=[export-worker.ts]
- "export_export_worker_initialize": "initialize()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L57 | neighbors=[export-worker.ts]
- "export_export_worker_queuedframe": "QueuedFrame" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L46 | neighbors=[export-worker.ts]
- "export_export_worker_workermessage": "WorkerMessage" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L3 | neighbors=[export-worker.ts]
- "export_export_worker_workerresponse": "WorkerResponse" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L24 | neighbors=[export-worker.ts]
- "export_types_prores_bitrates": "PRORES_BITRATES" | kind=code-symbol | source=packages/core/src/export/types.ts:L204 | neighbors=[types.ts]
- "ffmpeg_ffmpeg_core_addoninit": "addOnInit()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_base": "base()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-085.json

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
