# Node Description Batch 78 of 128

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

- "video_webgpu_renderer_impl_webgpurenderer_getmemoryusage": ".getMemoryUsage()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L970 | neighbors=[WebGPURenderer, .getFrameCacheStats()]
- "video_webgpu_renderer_impl_webgpurenderer_releasetexture": ".releaseTexture()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L878 | neighbors=[WebGPURenderer, .destroy()]
- "video_webgpu_renderer_impl_webgpurenderer_renderframebuffertoscreen": ".renderFrameBufferToScreen()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L813 | neighbors=[WebGPURenderer, .endFrame()]
- "video_webgpu_renderer_impl_webgpurenderer_renderlayerwithborderradius": ".renderLayerWithBorderRadius()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L753 | neighbors=[WebGPURenderer, .renderLayersToPass()]
- "video_webgpu_renderer_impl_webgpurenderer_renderlayerwithtransform": ".renderLayerWithTransform()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L695 | neighbors=[WebGPURenderer, .renderLayersToPass()]
- "video_webgpu_renderer_impl_webgpurenderer_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L947 | neighbors=[WebGPURenderer, .createFrameBuffers()]
- "video_webgpu_renderer_impl_webgpurenderer_setupdevicelosshandling": ".setupDeviceLossHandling()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L165 | neighbors=[WebGPURenderer, .initialize()]
- "video_webgpu_types_d_gpudevice": "GPUDevice" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L59 | neighbors=[webgpu-types.d.ts, EventTarget]
- "video_webgpu_types_d_gpufragmentstate": "GPUFragmentState" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L505 | neighbors=[webgpu-types.d.ts, GPUProgrammableStage]
- "video_webgpu_types_d_gpuvertexstate": "GPUVertexState" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L401 | neighbors=[webgpu-types.d.ts, GPUProgrammableStage]
- "wav_index_iswasmwavavailable": "isWasmWavAvailable()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L74 | neighbors=[index.ts, index.ts]
- "wav_index_jsencodewav16mono": "jsEncodeWav16Mono()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L78 | neighbors=[index.ts, .encodeWav16Mono()]
- "wav_index_jsencodewav16stereo": "jsEncodeWav16Stereo()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L93 | neighbors=[index.ts, .encodeWav16Stereo()]
- "wav_index_jsencodewav24stereo": "jsEncodeWav24Stereo()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L114 | neighbors=[index.ts, .encodeWav24Stereo()]
- "wav_index_jswritewavheader": "jsWriteWavHeader()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L138 | neighbors=[index.ts, .writeWavHeader()]
- "wav_index_loadwasmmodule": "loadWasmModule()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L34 | neighbors=[index.ts, initWasmWav()]
- "wav_index_wavencoder_encodewav24mono": ".encodeWav24Mono()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L312 | neighbors=[WavEncoder, .encodeFullWav()]
- "actions_action_executor_actionexecutor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L44 | neighbors=[ActionExecutor]
- "actions_action_executor_actionexecutor_gethistory": ".getHistory()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L182 | neighbors=[ActionExecutor]
- "actions_action_history_action_descriptions": "ACTION_DESCRIPTIONS" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L25 | neighbors=[action-history.ts]
- "actions_action_history_actionhistory_begingroup": ".beginGroup()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L191 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_canredo": ".canRedo()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L317 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_canundo": ".canUndo()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L313 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L119 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_gethistory": ".getHistory()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L321 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_gethistoryentries": ".getHistoryEntries()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L325 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_getmaxhistorysize": ".getMaxHistorySize()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L361 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_getredoentries": ".getRedoEntries()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L329 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_getredostacksize": ".getRedoStackSize()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L345 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_getsnapshots": ".getSnapshots()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L281 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_getundostacksize": ".getUndoStackSize()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L341 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_peekredo": ".peekRedo()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L355 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_peekundo": ".peekUndo()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L349 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_setautogroupwindow": ".setAutoGroupWindow()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L201 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_setmaxhistorysize": ".setMaxHistorySize()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L365 | neighbors=[ActionHistory]
- "actions_action_history_actionhistory_subscribe": ".subscribe()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L123 | neighbors=[ActionHistory]
- "actions_action_history_auto_groupable_types": "AUTO_GROUPABLE_TYPES" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L72 | neighbors=[action-history.ts]
- "actions_action_history_target_param_keys": "TARGET_PARAM_KEYS" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L89 | neighbors=[action-history.ts]
- "actions_action_serializer_actionserializer_deserialize": ".deserialize()" | kind=code-symbol | source=packages/core/src/actions/action-serializer.ts:L8 | neighbors=[ActionSerializer]
- "actions_action_serializer_actionserializer_deserializemany": ".deserializeMany()" | kind=code-symbol | source=packages/core/src/actions/action-serializer.ts:L27 | neighbors=[ActionSerializer]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-077.json

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
