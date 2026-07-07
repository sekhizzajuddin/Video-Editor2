# Node Description Batch 125 of 128

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

- "video_video_engine_videoengine_initializegpucompositor": ".initializeGPUCompositor()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L206 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_isformatsupported": ".isFormatSupported()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2724 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_ismediabunnyavailable": ".isMediaBunnyAvailable()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L169 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_resetexportstate": ".resetExportState()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1276 | neighbors=[VideoEngine]
- "video_video_engine_videoengine_setparalleldecoding": ".setParallelDecoding()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L246 | neighbors=[VideoEngine]
- "video_webgpu_effects_processor_blurparams": "BlurParams" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L21 | neighbors=[webgpu-effects-processor.ts]
- "video_webgpu_effects_processor_effectparams": "EffectParams" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L10 | neighbors=[webgpu-effects-processor.ts]
- "video_webgpu_effects_processor_effectsprocessorconfig": "EffectsProcessorConfig" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L26 | neighbors=[webgpu-effects-processor.ts]
- "video_webgpu_effects_processor_webgpueffectsprocessor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L64 | neighbors=[WebGPUEffectsProcessor]
- "video_webgpu_effects_processor_webgpueffectsprocessor_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L507 | neighbors=[WebGPUEffectsProcessor]
- "video_webgpu_effects_processor_webgpueffectsprocessor_getlastprocessingtime": ".getLastProcessingTime()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L487 | neighbors=[WebGPUEffectsProcessor]
- "video_webgpu_effects_processor_webgpueffectsprocessor_oneffectschange": ".onEffectsChange()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L449 | neighbors=[WebGPUEffectsProcessor]
- "video_webgpu_renderer_impl_renderer": "Renderer" | kind=code-symbol | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_applyeffects": ".applyEffects()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L884 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_arepipelinesinitialized": ".arePipelinesInitialized()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1063 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_beginframe": ".beginFrame()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L564 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_clearframecache": ".clearFrameCache()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1045 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_config": ".config()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L90 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L74 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_evictclipframes": ".evictClipFrames()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1022 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_getborderradiuspipeline": ".getBorderRadiusPipeline()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1059 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_getdevice": ".getDevice()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L976 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_geteffectsprocessingtime": ".getEffectsProcessingTime()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L933 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_getlastrendertime": ".getLastRenderTime()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L929 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_getrenderpipeline": ".getRenderPipeline()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1051 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_gettransformpipeline": ".getTransformPipeline()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1055 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_hasframecached": ".hasFrameCached()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1018 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_islost": ".isLost()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L980 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_issupported": ".isSupported()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L502 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_maxtexturecache": ".maxTextureCache()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L85 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_notifyeffectschanged": ".notifyEffectsChanged()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L899 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_ondevicelost": ".onDeviceLost()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L937 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_oneffectsrerender": ".onEffectsReRender()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L905 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_renderlayer": ".renderLayer()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L572 | neighbors=[WebGPURenderer]
- "video_webgpu_renderer_impl_webgpurenderer_triggerrerender": ".triggerReRender()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L909 | neighbors=[WebGPURenderer]
- "video_webgpu_types_d_eventtarget": "EventTarget" | kind=code-symbol | neighbors=[GPUDevice]
- "video_webgpu_types_d_gpu": "GPU" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L4 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpuadapter": "GPUAdapter" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L15 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpuaddressmode": "GPUAddressMode" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L263 | neighbors=[webgpu-types.d.ts]
- "video_webgpu_types_d_gpubindgroup": "GPUBindGroup" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L331 | neighbors=[webgpu-types.d.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-124.json

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
