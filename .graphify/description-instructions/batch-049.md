# Node Description Batch 50 of 128

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

- "effects_expression_engine_expressionengine_evaluate": ".evaluate()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L47 | neighbors=[ExpressionEngine, .compile()]
- "effects_expression_engine_expressionengine_perlinnoise": ".perlinNoise()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L178 | neighbors=[ExpressionEngine, .pseudoRandom()]
- "effects_expression_engine_expressionengine_smoothstep": ".smoothstep()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L174 | neighbors=[ExpressionEngine, .wiggle()]
- "effects_particle_engine_disposeparticleengine": "disposeParticleEngine()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L383 | neighbors=[particle-engine.ts, .dispose()]
- "effects_particle_engine_generateid": "generateId()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L10 | neighbors=[particle-engine.ts, .createParticle()]
- "effects_particle_engine_hextorgb": "hexToRgb()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L18 | neighbors=[particle-engine.ts, lerpColor()]
- "effects_particle_engine_lerpcolor": "lerpColor()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L28 | neighbors=[particle-engine.ts, hexToRgb()]
- "effects_particle_engine_particleengine_addeffect": ".addEffect()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L181 | neighbors=[ParticleEngine, .notifyChange()]
- "effects_particle_engine_particleengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L368 | neighbors=[disposeParticleEngine(), ParticleEngine]
- "effects_particle_engine_particleengine_removeeffect": ".removeEffect()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L193 | neighbors=[ParticleEngine, .notifyChange()]
- "effects_particle_engine_particleengine_toggleeffect": ".toggleEffect()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L228 | neighbors=[ParticleEngine, .notifyChange()]
- "effects_particle_engine_particleengine_updateeffect": ".updateEffect()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L199 | neighbors=[ParticleEngine, .notifyChange()]
- "effects_particle_engine_particleengine_updateeffecttiming": ".updateEffectTiming()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L207 | neighbors=[ParticleEngine, .notifyChange()]
- "effects_particle_presets_createeffectfrompreset": "createEffectFromPreset()" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L313 | neighbors=[particle-presets.ts, getParticlePresetById()]
- "effects_particle_presets_getparticlepresetbyid": "getParticlePresetById()" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L305 | neighbors=[particle-presets.ts, createEffectFromPreset()]
- "effects_particle_types_emitterstate": "EmitterState" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L64 | neighbors=[particle-engine.ts, particle-types.ts]
- "effects_particle_types_particle": "Particle" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L49 | neighbors=[particle-engine.ts, particle-types.ts]
- "effects_particle_types_particleeffect": "ParticleEffect" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L39 | neighbors=[particle-engine.ts, particle-types.ts]
- "effects_particle_types_particleeffecttype": "ParticleEffectType" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L1 | neighbors=[particle-presets.ts, particle-types.ts]
- "effects_particle_types_vector3": "Vector3" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L13 | neighbors=[particle-engine.ts, particle-types.ts]
- "export_export_engine_downloadblob": "downloadBlob()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1450 | neighbors=[export-engine.ts, index.ts]
- "export_export_engine_exportengine_cancel": ".cancel()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L820 | neighbors=[ExportEngine, .dispose()]
- "export_export_engine_exportengine_exportimage": ".exportImage()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L723 | neighbors=[ExportEngine, .exportFrame()]
- "export_export_engine_exportengine_getaudiomimetype": ".getAudioMimeType()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1274 | neighbors=[ExportEngine, .encodeAudioWithMediaBunny()]
- "export_export_engine_exportengine_getimagemimetype": ".getImageMimeType()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1291 | neighbors=[ExportEngine, .exportFrame()]
- "export_export_engine_exportengine_isaudioconfigsupported": ".isAudioConfigSupported()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L177 | neighbors=[ExportEngine, .findSupportedAudioCodec()]
- "export_export_engine_exportengine_iswebcodecssupported": ".isWebCodecsSupported()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L105 | neighbors=[ExportEngine, .exportVideo()]
- "export_export_engine_exportengine_shouldapplyupscaling": ".shouldApplyUpscaling()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1406 | neighbors=[ExportEngine, .exportVideo()]
- "export_export_engine_exportengine_terminateworker": ".terminateWorker()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L545 | neighbors=[ExportEngine, .dispose()]
- "export_export_engine_exportengine_writestring": ".writeString()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1268 | neighbors=[ExportEngine, .encodeWav32Float()]
- "export_export_engine_test_createmockclip": "createMockClip()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L189 | neighbors=[export-engine.test.ts, createMockTrack()]
- "export_export_engine_test_createmocktimeline": "createMockTimeline()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L224 | neighbors=[export-engine.test.ts, createMockTrack()]
- "export_export_engine_test_mockaudiobuffersource": "MockAudioBufferSource" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L125 | neighbors=[export-engine.test.ts, .constructor()]
- "export_export_engine_test_mockmovoutputformat": "MockMovOutputFormat" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L101 | neighbors=[export-engine.test.ts, MockMp4OutputFormat]
- "export_export_engine_test_mockstreamtarget": "MockStreamTarget" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L111 | neighbors=[export-engine.test.ts, .constructor()]
- "export_export_engine_test_mockvideosample": "MockVideoSample" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L132 | neighbors=[export-engine.test.ts, .constructor()]
- "export_export_engine_test_mockvideosamplesource": "MockVideoSampleSource" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L118 | neighbors=[export-engine.test.ts, .constructor()]
- "export_export_engine_test_mockwebmoutputformat": "MockWebMOutputFormat" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L100 | neighbors=[export-engine.test.ts, MockMp4OutputFormat]
- "export_export_worker_processframe": "processFrame()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L183 | neighbors=[export-worker.ts, processFrameQueue()]
- "export_export_worker_queueframe": "queueFrame()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L219 | neighbors=[export-worker.ts, processFrameQueue()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-049.json

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
