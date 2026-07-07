# Node Description Batch 73 of 128

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

- "video_color_grading_engine_colorgradingengine_setupvertexattributes": ".setupVertexAttributes()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L879 | neighbors=[ColorGradingEngine, .applyColorWheels()]
- "video_color_grading_engine_colorgradingengine_uploadtexture": ".uploadTexture()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L865 | neighbors=[ColorGradingEngine, .applyColorWheels()]
- "video_composite_engine_compositeengine_applychromakey": ".applyChromaKey()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L291 | neighbors=[CompositeEngine, .suppressSpill()]
- "video_composite_engine_compositeengine_colorburnchannel": ".colorBurnChannel()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L270 | neighbors=[CompositeEngine, .applyBlendMode()]
- "video_composite_engine_compositeengine_colordodgechannel": ".colorDodgeChannel()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L265 | neighbors=[CompositeEngine, .applyBlendMode()]
- "video_composite_engine_compositeengine_compositelayers": ".compositeLayers()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L73 | neighbors=[CompositeEngine, .compositeLayer()]
- "video_composite_engine_compositeengine_hardlightchannel": ".hardLightChannel()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L275 | neighbors=[CompositeEngine, .applyBlendMode()]
- "video_composite_engine_compositeengine_overlaychannel": ".overlayChannel()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L258 | neighbors=[CompositeEngine, .applyBlendMode()]
- "video_composite_engine_compositeengine_softlightchannel": ".softLightChannel()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L282 | neighbors=[CompositeEngine, .applyBlendMode()]
- "video_composite_engine_compositeengine_suppressspill": ".suppressSpill()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L351 | neighbors=[CompositeEngine, .applyChromaKey()]
- "video_decode_worker_createdecodeworkerblob": "createDecodeWorkerBlob()" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L374 | neighbors=[decode-worker.ts, createDecodeWorkerUrl()]
- "video_decode_worker_decodeframe": "decodeFrame()" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L117 | neighbors=[decode-worker.ts, getOrCreateResources()]
- "video_decode_worker_decoderequest": "DecodeRequest" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L1 | neighbors=[decode-worker.ts, parallel-frame-decoder.ts]
- "video_decode_worker_decoderesponse": "DecodeResponse" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L11 | neighbors=[decode-worker.ts, parallel-frame-decoder.ts]
- "video_decode_worker_loadmediabunny": "loadMediaBunny()" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L44 | neighbors=[decode-worker.ts, getOrCreateResources()]
- "video_decode_worker_workerresponse": "WorkerResponse" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L31 | neighbors=[decode-worker.ts, parallel-frame-decoder.ts]
- "video_frame_cache_framecache_clearmedia": ".clearMedia()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L83 | neighbors=[FrameCache, .delete()]
- "video_frame_cache_framecache_getmemorybymedia": ".getMemoryByMedia()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L224 | neighbors=[FrameCache, .get()]
- "video_frame_cache_framecache_has": ".has()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L41 | neighbors=[FrameCache, .getPreloadRange()]
- "video_frame_cache_framecache_set": ".set()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L45 | neighbors=[FrameCache, .evictIfNeeded()]
- "video_frame_cache_framecache_updateconfig": ".updateConfig()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L120 | neighbors=[FrameCache, .evictIfNeeded()]
- "video_frame_cache_preloadmanager_cancelmedia": ".cancelMedia()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L256 | neighbors=[PreloadManager, .enqueue()]
- "video_frame_cache_preloadmanager_enqueue": ".enqueue()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L246 | neighbors=[PreloadManager, .cancelMedia()]
- "video_frame_ring_buffer_compositeframebuffer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L197 | neighbors=[CompositeFrameBuffer, FrameRingBuffer]
- "video_frame_ring_buffer_compositeframebuffer_getalltrackframes": ".getAllTrackFrames()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L228 | neighbors=[CompositeFrameBuffer, .presentOrFallback()]
- "video_frame_ring_buffer_compositeframebuffer_getcompositedframe": ".getCompositedFrame()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L248 | neighbors=[CompositeFrameBuffer, .presentOrFallback()]
- "video_frame_ring_buffer_compositeframebuffer_gettrackframe": ".getTrackFrame()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L223 | neighbors=[CompositeFrameBuffer, .presentOrFallback()]
- "video_frame_ring_buffer_compositeframebuffer_swapall": ".swapAll()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L252 | neighbors=[CompositeFrameBuffer, .swap()]
- "video_frame_ring_buffer_compositeframebuffer_writecompositedframe": ".writeCompositedFrame()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L239 | neighbors=[CompositeFrameBuffer, .write()]
- "video_frame_ring_buffer_frameringbuffer_present": ".present()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L69 | neighbors=[FrameRingBuffer, .presentOrFallback()]
- "video_frame_ring_buffer_frameringbuffer_swap": ".swap()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L108 | neighbors=[.swapAll(), FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_writefromcanvas": ".writeFromCanvas()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L60 | neighbors=[FrameRingBuffer, .write()]
- "video_frame_ring_buffer_getframeringbuffer": "getFrameRingBuffer()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L303 | neighbors=[frame-ring-buffer.ts, FrameRingBuffer]
- "video_gpu_compositor_createdefaulttransform": "createDefaultTransform()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L336 | neighbors=[gpu-compositor.ts, createGPUCompositeLayer()]
- "video_gpu_compositor_creategpucompositelayer": "createGPUCompositeLayer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L346 | neighbors=[gpu-compositor.ts, createDefaultTransform()]
- "video_gpu_compositor_disposegpucompositor": "disposeGPUCompositor()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L388 | neighbors=[gpu-compositor.ts, .dispose()]
- "video_gpu_compositor_getgpucompositor": "getGPUCompositor()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L366 | neighbors=[gpu-compositor.ts, GPUCompositor]
- "video_gpu_compositor_gpucompositor_addlayer": ".addLayer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L83 | neighbors=[GPUCompositor, .sortLayers()]
- "video_gpu_compositor_gpucompositor_clearlayers": ".clearLayers()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L113 | neighbors=[GPUCompositor, .dispose()]
- "video_gpu_compositor_gpucompositor_compositetocanvas": ".compositeToCanvas()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L287 | neighbors=[GPUCompositor, .composite()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-072.json

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
