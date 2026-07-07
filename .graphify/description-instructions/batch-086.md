# Node Description Batch 87 of 128

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

- "ffmpeg_ffmpeg_core_emscripten_date_now": "_emscripten_date_now()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_emscripten_get_now_is_monotonic": "__emscripten_get_now_is_monotonic()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_emscripten_memcpy_big": "_emscripten_memcpy_big()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_emscripten_throw_longjmp": "__emscripten_throw_longjmp()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_ensureparent": "ensureParent()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_fd_close": "_fd_close()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_fd_fdstat_get": "_fd_fdstat_get()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_fs_getmode": "FS_getMode()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_fs_handledbypreloadplugin": "FS_handledByPreloadPlugin()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_fs_modestringtoflags": "FS_modeStringToFlags()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_is_timeout": "is_timeout()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_lazyuint8array": "LazyUint8Array()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_locatefile": "_locateFile()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_mmap_js": "__mmap_js()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_munmap_js": "__munmap_js()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_print": "print()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_printerr": "printErr()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_removerundependency": "removeRunDependency()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_reset": "reset()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_setlogger": "setLogger()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_setprogress": "setProgress()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_faccessat": "___syscall_faccessat()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_fstat64": "___syscall_fstat64()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_ioctl": "___syscall_ioctl()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_lstat64": "___syscall_lstat64()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_mkdirat": "___syscall_mkdirat()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_newfstatat": "___syscall_newfstatat()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_newselect": "___syscall__newselect()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_openat": "___syscall_openat()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_poll": "___syscall_poll()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_renameat": "___syscall_renameat()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_rmdir": "___syscall_rmdir()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_socket": "___syscall_socket()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_syscall_stat64": "___syscall_stat64()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_trim": "trim()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "ffmpeg_ffmpeg_core_writechunks": "writeChunks()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js]
- "fft_index_wasmfft_applysynthesiswindow": ".applySynthesisWindow()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L205 | neighbors=[WasmFFT]
- "fft_index_wasmfft_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L87 | neighbors=[WasmFFT]
- "fft_index_wasmfft_getpower": ".getPower()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L163 | neighbors=[WasmFFT]
- "fft_index_wasmfft_getsize": ".getSize()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L123 | neighbors=[WasmFFT]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-086.json

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
