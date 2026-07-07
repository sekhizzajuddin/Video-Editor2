# Node Description Batch 119 of 128

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

- "video_frame_ring_buffer_frameringbuffer_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L147 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_gettiminginfo": ".getTimingInfo()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L159 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_hasframeready": ".hasFrameReady()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L122 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_hasnextframeready": ".hasNextFrameReady()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L128 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_peek": ".peek()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L112 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_peeknext": ".peekNext()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L118 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_reset": ".reset()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L166 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbufferstats": "FrameRingBufferStats" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L7 | neighbors=[frame-ring-buffer.ts]
- "video_gpu_compositor_compositorconfig": "CompositorConfig" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L17 | neighbors=[gpu-compositor.ts]
- "video_gpu_compositor_compositorstats": "CompositorStats" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L24 | neighbors=[gpu-compositor.ts]
- "video_gpu_compositor_gpucompositelayer": "GPUCompositeLayer" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L5 | neighbors=[gpu-compositor.ts]
- "video_gpu_compositor_gpucompositor_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L49 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_createtexturefrombitmap": ".createTextureFromBitmap()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L206 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_createtexturefromcanvas": ".createTextureFromCanvas()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L188 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_getdevice": ".getDevice()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L65 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_getlayer": ".getLayer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L129 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_getlayers": ".getLayers()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L133 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_getrenderer": ".getRenderer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L61 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L315 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_isdirtyframe": ".isDirtyFrame()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L307 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_markdirty": ".markDirty()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L311 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_resetstats": ".resetStats()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L319 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L74 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_setbackgroundcolor": ".setBackgroundColor()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L69 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_setlayerblendmode": ".setLayerBlendMode()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L155 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_setlayeropacity": ".setLayerOpacity()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L147 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_setlayertransform": ".setLayerTransform()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L163 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_setlayervisibility": ".setLayerVisibility()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L139 | neighbors=[GPUCompositor]
- "video_gpu_compositor_gpucompositor_setrenderer": ".setRenderer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L56 | neighbors=[GPUCompositor]
- "video_keyframe_engine_beziercurve": "BezierCurve" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L13 | neighbors=[keyframe-engine.ts]
- "video_keyframe_engine_easingpreset": "EasingPreset" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L4 | neighbors=[keyframe-engine.ts]
- "video_keyframe_engine_keyframe": "Keyframe" | kind=code-symbol | neighbors=[ExtendedKeyframe]
- "video_keyframe_engine_keyframeclipboard": "KeyframeClipboard" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L37 | neighbors=[keyframe-engine.ts]
- "video_keyframe_engine_keyframeengine_clearclipboard": ".clearClipboard()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L406 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L57 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_copykeyframes": ".copyKeyframes()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L371 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_getbeziercontrolpoints": ".getBezierControlPoints()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L344 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_getclipboard": ".getClipboard()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L402 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_geteasingpresets": ".getEasingPresets()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L192 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_getkeyframe": ".getKeyframe()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L105 | neighbors=[KeyframeEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-118.json

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
