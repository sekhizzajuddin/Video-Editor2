# Node Description Batch 52 of 128

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

- "ffmpeg_ffmpeg_core_invoke_iiiiii": "invoke_iiiiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_iiiiiiiii": "invoke_iiiiiiiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_iiiijj": "invoke_iiiijj()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_iij": "invoke_iij()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_vi": "invoke_vi()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_vii": "invoke_vii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_viiii": "invoke_viiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_viiiiii": "invoke_viiiiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_invoke_viiiiiiii": "invoke_viiiiiiii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getWasmTableEntry()]
- "ffmpeg_ffmpeg_core_isdatauri": "isDataURI()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, instantiateAsync()]
- "ffmpeg_ffmpeg_core_jstoi_q": "jstoi_q()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, inetPton6()]
- "ffmpeg_ffmpeg_core_keepruntimealive": "keepRuntimeAlive()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _proc_exit()]
- "ffmpeg_ffmpeg_core_mktime_js": "__mktime_js()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ydayFromDate()]
- "ffmpeg_ffmpeg_core_randomfill": "randomFill()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, initRandomFill()]
- "ffmpeg_ffmpeg_core_reademasmargs": "readEmAsmArgs()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, runEmAsmFunction()]
- "ffmpeg_ffmpeg_core_receiveprogress": "receiveProgress()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, send_progress()]
- "ffmpeg_ffmpeg_core_send_progress": "send_progress()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, receiveProgress()]
- "ffmpeg_ffmpeg_core_seterrno": "setErrNo()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ___syscall_fcntl64()]
- "ffmpeg_ffmpeg_core_settimeout": "setTimeout()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, run()]
- "ffmpeg_ffmpeg_core_setvalue": "setValue()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort()]
- "ffmpeg_ffmpeg_core_stringtoascii": "stringToAscii()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _environ_get()]
- "ffmpeg_ffmpeg_core_stringtoptr": "stringToPtr()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, stringsToPtr()]
- "ffmpeg_ffmpeg_core_syscall_fcntl64": "___syscall_fcntl64()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, setErrNo()]
- "ffmpeg_ffmpeg_core_syscall_getdents64": "___syscall_getdents64()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, stringToUTF8()]
- "ffmpeg_ffmpeg_core_syscall_getsockopt": "___syscall_getsockopt()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketFromFD()]
- "ffmpeg_ffmpeg_core_syscall_listen": "___syscall_listen()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketFromFD()]
- "ffmpeg_ffmpeg_core_syscall_unlinkat": "___syscall_unlinkat()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort()]
- "ffmpeg_ffmpeg_core_tzset_js": "__tzset_js()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, stringToNewUTF8()]
- "ffmpeg_ffmpeg_core_updatememoryviews": "updateMemoryViews()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, emscripten_realloc_buffer()]
- "ffmpeg_ffmpeg_core_utf8arraytostring": "UTF8ArrayToString()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, UTF8ToString()]
- "ffmpeg_ffmpeg_core_writearraytomemory": "writeArrayToMemory()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _strftime()]
- "fft_index_iswasmfftavailable": "isWasmFFTAvailable()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L75 | neighbors=[index.ts, index.ts]
- "fft_index_loadwasmmodule": "loadWasmModule()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L35 | neighbors=[index.ts, initWasmFFT()]
- "fft_index_wasmfft_applyhannwindow": ".applyHannWindow()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L195 | neighbors=[WasmFFT, .ensureWasmSize()]
- "fft_index_wasmfft_forward": ".forward()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L134 | neighbors=[WasmFFT, .ensureWasmSize()]
- "fft_index_wasmfft_frommagnitudeandphase": ".fromMagnitudeAndPhase()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L181 | neighbors=[WasmFFT, .ensureWasmSize()]
- "fft_index_wasmfft_getmagnitude": ".getMagnitude()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L153 | neighbors=[WasmFFT, .ensureWasmSize()]
- "fft_index_wasmfft_getmagnitudeandphase": ".getMagnitudeAndPhase()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L167 | neighbors=[WasmFFT, .ensureWasmSize()]
- "fft_index_wasmfft_inverse": ".inverse()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L143 | neighbors=[WasmFFT, .ensureWasmSize()]
- "frame_interpolation_flow_field_cache_flowfieldcache_evictlru": ".evictLRU()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L34 | neighbors=[FlowFieldCache, .set()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-051.json

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
