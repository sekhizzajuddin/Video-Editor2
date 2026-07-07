# Node Description Batch 128 of 128

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

- "video_webgpu_types_d_gpustoreop": "GPUStoreOp" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L607 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpusupportedfeatures": "GPUSupportedFeatures" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L22 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpusupportedlimits": "GPUSupportedLimits" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L24 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputexture": "GPUTexture" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L128 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputextureaspect": "GPUTextureAspect" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L164 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputexturebindinglayout": "GPUTextureBindingLayout" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L308 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputexturedescriptor": "GPUTextureDescriptor" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L142 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputexturedimension": "GPUTextureDimension" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L153 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputextureformat": "GPUTextureFormat" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L154 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputexturesampletype": "GPUTextureSampleType" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L314 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputextureusageflags": "GPUTextureUsageFlags" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L163 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputextureview": "GPUTextureView" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L202 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputextureviewdescriptor": "GPUTextureViewDescriptor" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L204 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gputextureviewdimension": "GPUTextureViewDimension" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L215 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpuvertexattribute": "GPUVertexAttribute" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L413 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpuvertexbufferlayout": "GPUVertexBufferLayout" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L405 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpuvertexformat": "GPUVertexFormat" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L419 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpuvertexstepmode": "GPUVertexStepMode" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L411 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_navigator": "Navigator" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L1 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_offscreencanvas": "OffscreenCanvas" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L745 | neighbors=[webgpu-types.d.ts]
- "vite_config_audioseparatorplugin": "audioSeparatorPlugin()" | kind=code-symbol | source=vite.config.ts:L34 | neighbors=[vite.config.ts]
- "vite_config_escapexml": "escapeXml()" | kind=code-symbol | source=vite.config.ts:L20 | neighbors=[vite.config.ts]
- "vite_config_generatesecmsgec": "generateSecMSGec()" | kind=code-symbol | source=vite.config.ts:L10 | neighbors=[vite.config.ts]
- "wasm_index_getwasmmodulestatus": "getWasmModuleStatus()" | kind=code-symbol | source=packages/core/src/wasm/index.ts:L21 | neighbors=[index.ts]
- "wasm_index_iswebassemblysupported": "isWebAssemblySupported()" | kind=code-symbol | source=packages/core/src/wasm/index.ts:L43 | neighbors=[index.ts]
- "wasm_index_preloadallwasmmodules": "preloadAllWasmModules()" | kind=code-symbol | source=packages/core/src/wasm/index.ts:L29 | neighbors=[index.ts]
- "wasm_index_wasmmodulestatus": "WasmModuleStatus" | kind=code-symbol | source=packages/core/src/wasm/index.ts:L15 | neighbors=[index.ts]
- "wav_index_wasmwavexports": "WasmWavExports" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L1 | neighbors=[index.ts]
- "wav_index_wavencoder_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L212 | neighbors=[WavEncoder]
- "core_vitest_config": "vitest.config.ts" | kind=code-symbol | source=packages/core/vitest.config.ts:L1
- "eslint_config": "eslint.config.js" | kind=code-symbol | source=eslint.config.js:L1
- "postcss_config": "postcss.config.js" | kind=code-symbol | source=postcss.config.js:L1
- "tailwind_config": "tailwind.config.js" | kind=code-symbol | source=tailwind.config.js:L1
- "vitest_config": "vitest.config.ts" | kind=code-symbol | source=vitest.config.ts:L1

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-127.json

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
