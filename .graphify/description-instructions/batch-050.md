# Node Description Batch 51 of 128

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

- "export_index": "index.ts" | kind=code-symbol | source=packages/core/src/export/index.ts:L1 | neighbors=[export-engine.ts, types.ts]
- "export_types_codec_map": "CODEC_MAP" | kind=code-symbol | source=packages/core/src/export/types.ts:L213 | neighbors=[types.ts, index.ts]
- "export_types_default_upscaling_settings": "DEFAULT_UPSCALING_SETTINGS" | kind=code-symbol | source=packages/core/src/export/types.ts:L9 | neighbors=[types.ts, index.ts]
- "export_types_exporterrorcode": "ExportErrorCode" | kind=code-symbol | source=packages/core/src/export/types.ts:L84 | neighbors=[types.ts, index.ts]
- "export_types_upscalequality": "UpscaleQuality" | kind=code-symbol | source=packages/core/src/export/types.ts:L1 | neighbors=[types.ts, index.ts]
- "export_types_upscalingsettings": "UpscalingSettings" | kind=code-symbol | source=packages/core/src/export/types.ts:L3 | neighbors=[types.ts, index.ts]
- "ffmpeg_ffmpeg_core_adddays": "addDays()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, isLeapYear()]
- "ffmpeg_ffmpeg_core_addonpostrun": "addOnPostRun()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, postRun()]
- "ffmpeg_ffmpeg_core_addonprerun": "addOnPreRun()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, preRun()]
- "ffmpeg_ffmpeg_core_alignmemory": "alignMemory()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, mmapAlloc()]
- "ffmpeg_ffmpeg_core_arraysum": "arraySum()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _strftime()]
- "ffmpeg_ffmpeg_core_biginttoi53checked": "bigintToI53Checked()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _fd_seek()]
- "ffmpeg_ffmpeg_core_cxa_throw": "___cxa_throw()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ExceptionInfo()]
- "ffmpeg_ffmpeg_core_dlopen": "_dlopen()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort()]
- "ffmpeg_ffmpeg_core_dlsym": "___dlsym()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort()]
- "ffmpeg_ffmpeg_core_docallback": "doCallback()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, done()]
- "ffmpeg_ffmpeg_core_done": "done()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, doCallback()]
- "ffmpeg_ffmpeg_core_doreadv": "doReadv()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _fd_read()]
- "ffmpeg_ffmpeg_core_dowritev": "doWritev()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _fd_write()]
- "ffmpeg_ffmpeg_core_emscripten_asm_const_int": "_emscripten_asm_const_int()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, runEmAsmFunction()]
- "ffmpeg_ffmpeg_core_emscripten_get_heap_max": "_emscripten_get_heap_max()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getHeapMax()]
- "ffmpeg_ffmpeg_core_environ_sizes_get": "_environ_sizes_get()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getEnvStrings()]
- "ffmpeg_ffmpeg_core_exceptioninfo": "ExceptionInfo()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ___cxa_throw()]
- "ffmpeg_ffmpeg_core_exec": "exec()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, stringsToPtr()]
- "ffmpeg_ffmpeg_core_exitjs": "exitJS()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _proc_exit()]
- "ffmpeg_ffmpeg_core_exitstatus": "ExitStatus()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _proc_exit()]
- "ffmpeg_ffmpeg_core_fd_read": "_fd_read()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, doReadv()]
- "ffmpeg_ffmpeg_core_fd_seek": "_fd_seek()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, bigintToI53Checked()]
- "ffmpeg_ffmpeg_core_fd_write": "_fd_write()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, doWritev()]
- "ffmpeg_ffmpeg_core_getbinary": "getBinary()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort()]
- "ffmpeg_ffmpeg_core_getexecutablename": "getExecutableName()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getEnvStrings()]
- "ffmpeg_ffmpeg_core_getvalue": "getValue()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort()]
- "ffmpeg_ffmpeg_core_gmtime_js": "__gmtime_js()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, readI53FromI64()]
- "ffmpeg_ffmpeg_core_handlemessage": "handleMessage()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, assert()]
- "ffmpeg_ffmpeg_core_initruntime": "initRuntime()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, callRuntimeCallbacks()]
- "ffmpeg_ffmpeg_core_invoke_i": "invoke_i()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_ii": "invoke_ii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_iii": "invoke_iii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_iiii": "invoke_iiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_iiiii": "invoke_iiiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-050.json

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
