# Node Description Batch 88 of 128

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

- "fft_index_wasmfftexports": "WasmFFTExports" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L3 | neighbors=[index.ts]
- "frame_interpolation_flow_field_cache_cacheentry": "CacheEntry" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L3 | neighbors=[flow-field-cache.ts]
- "frame_interpolation_flow_field_cache_flowfieldcache_clear": ".clear()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L50 | neighbors=[FlowFieldCache]
- "frame_interpolation_flow_field_cache_flowfieldcache_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L12 | neighbors=[FlowFieldCache]
- "frame_interpolation_flow_field_cache_flowfieldcache_get": ".get()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L20 | neighbors=[FlowFieldCache]
- "frame_interpolation_flow_field_cache_flowfieldcache_makekey": ".makeKey()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L16 | neighbors=[FlowFieldCache]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L17 | neighbors=[FrameInterpolationEngine]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_resetbudget": ".resetBudget()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L56 | neighbors=[FrameInterpolationEngine]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_setframebudget": ".setFrameBudget()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L52 | neighbors=[FrameInterpolationEngine]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L6 | neighbors=[OpticalFlowCPU]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu_computeflowfield": ".computeFlowField()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L199 | neighbors=[OpticalFlowGPU]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L160 | neighbors=[OpticalFlowGPU]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L371 | neighbors=[OpticalFlowGPU]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L164 | neighbors=[OpticalFlowGPU]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu_isready": ".isReady()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L195 | neighbors=[OpticalFlowGPU]
- "frame_interpolation_optical_flow_gpu_opticalflowgpu_warpandblend": ".warpAndBlend()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L279 | neighbors=[OpticalFlowGPU]
- "graphics_graphics_engine_animatedgraphicstate": "AnimatedGraphicState" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L25 | neighbors=[graphics-engine.ts]
- "graphics_graphics_engine_graphicsengine_addkeyframe": ".addKeyframe()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1637 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_addstickerclip": ".addStickerClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1881 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1973 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L62 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_creategraphicanimation": ".createGraphicAnimation()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L2011 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_deleteshapeclip": ".deleteShapeClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1774 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_deletestickerclip": ".deleteStickerClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1922 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_deletesvgclip": ".deleteSVGClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1784 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getallshapeclips": ".getAllShapeClips()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1731 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getallstickerclips": ".getAllStickerClips()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1900 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getallsvgclips": ".getAllSVGClips()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1740 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getshapeclip": ".getShapeClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1712 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getshapeclipsfortrack": ".getShapeClipsForTrack()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1750 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getstickerclip": ".getStickerClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1891 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getstickerclipsfortrack": ".getStickerClipsForTrack()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1910 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getsvgclip": ".getSVGClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1722 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_getsvgclipsfortrack": ".getSVGClipsForTrack()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1762 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_loadshapeclips": ".loadShapeClips()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1982 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_loadstickerclips": ".loadStickerClips()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1996 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_loadsvgclips": ".loadSVGClips()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1989 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_removekeyframe": ".removeKeyframe()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1651 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_setsvganimation": ".setSVGAnimation()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1845 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_setsvgcolorstyle": ".setSVGColorStyle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1866 | neighbors=[GraphicsEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-087.json

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
