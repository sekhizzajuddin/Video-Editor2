# Node Description Batch 29 of 128

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

- "editing_templates_resolver_resolverecord": "resolveRecord()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L363 | neighbors=[resolver.ts, resolveEffect(), resolveOverlay()]
- "editing_templates_resolver_resolvetemplatevariables": "resolveTemplateVariables()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L82 | neighbors=[resolver.ts, resolveOverlay(), resolveValue()]
- "editing_templates_types_editingtemplatebinding": "EditingTemplateBinding" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L22 | neighbors=[built-in-templates.ts, resolver.ts, types.ts]
- "editing_templates_types_editingtemplatetransform": "EditingTemplateTransform" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L98 | neighbors=[built-in-templates.ts, resolver.ts, types.ts]
- "effects_blend_modes": "blend-modes.ts" | kind=code-symbol | source=packages/core/src/effects/blend-modes.ts:L1 | neighbors=[BlendMode, BlendModeEngine, BlendModeSettings]
- "effects_blend_modes_blendmodeengine": "BlendModeEngine" | kind=code-symbol | source=packages/core/src/effects/blend-modes.ts:L22 | neighbors=[blend-modes.ts, .applyBlendMode(), .getBlendShader()]
- "effects_expression_engine": "expression-engine.ts" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L1 | neighbors=[ExpressionContext, ExpressionEngine, index.ts]
- "effects_expression_engine_expressionengine_compile": ".compile()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L56 | neighbors=[ExpressionEngine, .createSafeContext(), .evaluate()]
- "effects_expression_engine_expressionengine_pseudorandom": ".pseudoRandom()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L169 | neighbors=[ExpressionEngine, .perlinNoise(), .wiggle()]
- "effects_expression_engine_expressionengine_wiggle": ".wiggle()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L85 | neighbors=[ExpressionEngine, .pseudoRandom(), .smoothstep()]
- "effects_particle_engine_getemissionposition": "getEmissionPosition()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L37 | neighbors=[particle-engine.ts, randomRange(), .createParticle()]
- "effects_particle_engine_getinitialvelocity": "getInitialVelocity()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L78 | neighbors=[particle-engine.ts, randomRange(), .createParticle()]
- "effects_particle_engine_getparticleengine": "getParticleEngine()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L376 | neighbors=[particle-engine.ts, ParticleEngine, video-engine.ts]
- "effects_particle_engine_particleengine_update": ".update()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L261 | neighbors=[ParticleEngine, .createParticle(), randomRange()]
- "effects_particle_types_default_particle_config": "DEFAULT_PARTICLE_CONFIG" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L72 | neighbors=[particle-engine.ts, particle-presets.ts, particle-types.ts]
- "effects_particle_types_particleconfig": "ParticleConfig" | kind=code-symbol | source=packages/core/src/effects/particle-types.ts:L19 | neighbors=[particle-engine.ts, particle-presets.ts, particle-types.ts]
- "export_export_engine_exportengine_calculatestats": ".calculateStats()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1342 | neighbors=[ExportEngine, .exportImageSequence(), .exportVideo()]
- "export_export_engine_exportengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1422 | neighbors=[ExportEngine, .cancel(), .terminateWorker()]
- "export_export_engine_exportengine_encodewav32float": ".encodeWav32Float()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1227 | neighbors=[ExportEngine, .encodeWav(), .writeString()]
- "export_export_engine_exportengine_findsupportedaudiocodec": ".findSupportedAudioCodec()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L122 | neighbors=[ExportEngine, .exportVideo(), .isAudioConfigSupported()]
- "export_export_engine_exportengine_initializegpuforexport": ".initializeGPUForExport()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L72 | neighbors=[ExportEngine, .exportVideo(), .initialize()]
- "export_export_engine_exportengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L111 | neighbors=[ExportEngine, .exportVideo(), .initialize()]
- "export_export_engine_test_createmocktrack": "createMockTrack()" | kind=code-symbol | source=packages/core/src/export/export-engine.test.ts:L211 | neighbors=[export-engine.test.ts, createMockTimeline(), createMockClip()]
- "export_export_worker_processframequeue": "processFrameQueue()" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L170 | neighbors=[export-worker.ts, processFrame(), queueFrame()]
- "export_types_audioexportsettings": "AudioExportSettings" | kind=code-symbol | source=packages/core/src/export/types.ts:L32 | neighbors=[export-engine.ts, types.ts, index.ts]
- "export_types_exporterror": "ExportError" | kind=code-symbol | source=packages/core/src/export/types.ts:L76 | neighbors=[export-engine.ts, types.ts, index.ts]
- "export_types_exportpreset": "ExportPreset" | kind=code-symbol | source=packages/core/src/export/types.ts:L68 | neighbors=[export-engine.ts, types.ts, index.ts]
- "export_types_exportresult": "ExportResult" | kind=code-symbol | source=packages/core/src/export/types.ts:L96 | neighbors=[export-engine.ts, types.ts, index.ts]
- "export_types_exportstats": "ExportStats" | kind=code-symbol | source=packages/core/src/export/types.ts:L103 | neighbors=[export-engine.ts, types.ts, index.ts]
- "ffmpeg_ffmpeg_core_assert": "assert()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort(), handleMessage()]
- "ffmpeg_ffmpeg_core_assert_fail": "___assert_fail()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort(), UTF8ToString()]
- "ffmpeg_ffmpeg_core_createwasm": "createWasm()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, addRunDependency(), instantiateAsync()]
- "ffmpeg_ffmpeg_core_emscripten_realloc_buffer": "emscripten_realloc_buffer()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, updateMemoryViews(), _emscripten_resize_heap()]
- "ffmpeg_ffmpeg_core_emscripten_resize_heap": "_emscripten_resize_heap()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, emscripten_realloc_buffer(), getHeapMax()]
- "ffmpeg_ffmpeg_core_environ_get": "_environ_get()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getEnvStrings(), stringToAscii()]
- "ffmpeg_ffmpeg_core_getbinarypromise": "getBinaryPromise()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, isFileURI(), instantiateArrayBuffer()]
- "ffmpeg_ffmpeg_core_getheapmax": "getHeapMax()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _emscripten_get_heap_max(), _emscripten_resize_heap()]
- "ffmpeg_ffmpeg_core_getnameinfo": "_getnameinfo()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, readSockaddr(), stringToUTF8()]
- "ffmpeg_ffmpeg_core_getuniquerundependency": "getUniqueRunDependency()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, asyncLoad(), FS_createPreloadedFile()]
- "ffmpeg_ffmpeg_core_inetntop4": "inetNtop4()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, inetNtop6(), readSockaddr()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-028.json

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
