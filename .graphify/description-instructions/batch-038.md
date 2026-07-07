# Node Description Batch 39 of 128

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

- "video_decode_worker_getorcreateresources": "getOrCreateResources()" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L63 | neighbors=[decode-worker.ts, decodeFrame(), loadMediaBunny()]
- "video_frame_cache_framecache_evictoldest": ".evictOldest()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L198 | neighbors=[FrameCache, .evictIfNeeded(), .delete()]
- "video_frame_cache_framecache_getcachekey": ".getCacheKey()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L20 | neighbors=[FrameCache, .getPreloadRange(), .prioritizeAroundTime()]
- "video_frame_cache_framecache_getpreloadrange": ".getPreloadRange()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L126 | neighbors=[FrameCache, .getCacheKey(), .has()]
- "video_frame_cache_framecache_prioritizearoundtime": ".prioritizeAroundTime()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L153 | neighbors=[FrameCache, .get(), .getCacheKey()]
- "video_frame_ring_buffer_compositeframebuffer_getorcreatetrackbuffer": ".getOrCreateTrackBuffer()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L201 | neighbors=[CompositeFrameBuffer, FrameRingBuffer, .writeTrackFrame()]
- "video_frame_ring_buffer_compositeframebuffer_writetrackframe": ".writeTrackFrame()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L213 | neighbors=[CompositeFrameBuffer, .getOrCreateTrackBuffer(), .write()]
- "video_frame_ring_buffer_getcompositeframebuffer": "getCompositeFrameBuffer()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L310 | neighbors=[frame-ring-buffer.ts, CompositeFrameBuffer, video-engine.ts]
- "video_gpu_compositor_gpucompositor_composite": ".composite()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L218 | neighbors=[GPUCompositor, .recordCompositeDuration(), .compositeToCanvas()]
- "video_keyframe_engine_keyframeengine_easein": ".easeIn()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L283 | neighbors=[KeyframeEngine, .applyEasing(), .applyEasingPreset()]
- "video_keyframe_engine_keyframeengine_easeinout": ".easeInOut()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L291 | neighbors=[KeyframeEngine, .applyEasing(), .applyEasingPreset()]
- "video_keyframe_engine_keyframeengine_easeout": ".easeOut()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L287 | neighbors=[KeyframeEngine, .applyEasing(), .applyEasingPreset()]
- "video_keyframe_engine_keyframeengine_getmotionpath": ".getMotionPath()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L410 | neighbors=[KeyframeEngine, .getKeyframesForProperty(), .getValueAtTime()]
- "video_keyframe_engine_keyframeengine_interpolatevalue": ".interpolateValue()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L489 | neighbors=[KeyframeEngine, .getValueAtTime(), .interpolateWithBezier()]
- "video_mask_engine_maskengine_applyexpansion": ".applyExpansion()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L910 | neighbors=[MaskEngine, .applyMask(), .applyMaskDefinition()]
- "video_mask_engine_maskengine_applyfeathering": ".applyFeathering()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L899 | neighbors=[MaskEngine, .applyMask(), .applyMaskDefinition()]
- "video_mask_engine_maskengine_createshapemask": ".createShapeMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L422 | neighbors=[MaskEngine, generateId(), shapeToPath()]
- "video_mask_engine_maskengine_createtrackmattemask": ".createTrackMatteMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L464 | neighbors=[MaskEngine, createDefaultPath(), generateId()]
- "video_mask_engine_maskengine_generatemaskfrompath": ".generateMaskFromPath()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L715 | neighbors=[MaskEngine, .applyMask(), .drawBezierPath()]
- "video_mask_engine_maskengine_resizeto": ".resizeTo()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L411 | neighbors=[MaskEngine, .applyMask(), .applyMaskDefinition()]
- "video_motion_tracking_engine_generateid": "generateId()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L69 | neighbors=[motion-tracking-engine.ts, .runTracking(), .startTracking()]
- "video_motion_tracking_engine_motiontrackingengine_starttracking": ".startTracking()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L82 | neighbors=[MotionTrackingEngine, generateId(), .runTracking()]
- "video_parallel_frame_decoder_getparallelframedecoder": "getParallelFrameDecoder()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L422 | neighbors=[parallel-frame-decoder.ts, ParallelFrameDecoder, video-engine.ts]
- "video_parallel_frame_decoder_parallelframedecoder_doinitialize": ".doInitialize()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L86 | neighbors=[ParallelFrameDecoder, .createWorker(), .initialize()]
- "video_parallel_frame_decoder_parallelframedecoder_handledecoderesponse": ".handleDecodeResponse()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L148 | neighbors=[ParallelFrameDecoder, .addToCache(), .processQueue()]
- "video_playback_engine_getplaybackengine": "getPlaybackEngine()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L552 | neighbors=[playback-engine.ts, PlaybackEngine, initializePlaybackEngine()]
- "video_playback_engine_initializeplaybackengine": "initializePlaybackEngine()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L559 | neighbors=[playback-engine.ts, getPlaybackEngine(), .initialize()]
- "video_playback_engine_playbackengine_clearbuffer": ".clearBuffer()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L528 | neighbors=[PlaybackEngine, .seek(), .stop()]
- "video_playback_engine_playbackengine_getimmediateframe": ".getImmediateFrame()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L452 | neighbors=[PlaybackEngine, .dispose(), .seek()]
- "video_playback_engine_playbackengine_pause": ".pause()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L124 | neighbors=[PlaybackEngine, .setState(), .stopPlaybackLoop()]
- "video_playback_engine_playbackengine_resume": ".resume()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L131 | neighbors=[PlaybackEngine, .setState(), .startPlaybackLoop()]
- "video_playback_engine_playbackengine_sleep": ".sleep()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L540 | neighbors=[PlaybackEngine, .decodeLoop(), .waitForBuffer()]
- "video_playback_engine_playbackengine_stopdecoding": ".stopDecoding()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L273 | neighbors=[PlaybackEngine, .seek(), .stop()]
- "video_renderer_factory_getrendererfactory": "getRendererFactory()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L135 | neighbors=[renderer-factory.ts, .getInstance(), video-engine.ts]
- "video_renderer_factory_iswebgpusupported": "isWebGPUSupported()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L42 | neighbors=[renderer-factory.ts, unified-effects-processor.ts, video-effects-engine.ts]
- "video_renderer_factory_rendererfactory_getinstance": ".getInstance()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L68 | neighbors=[createRenderer(), getRendererFactory(), RendererFactory]
- "video_speed_engine_getspeedengine": "getSpeedEngine()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L478 | neighbors=[speed-engine.ts, SpeedEngine, video-engine.ts]
- "video_speed_engine_speedengine_getframeindexattime": ".getFrameIndexAtTime()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L109 | neighbors=[SpeedEngine, .getSourceTimeAtPlaybackTime(), .getFrameIndicesInRange()]
- "video_speed_engine_speedengine_integrateplaybacktime": ".integratePlaybackTime()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L381 | neighbors=[SpeedEngine, .calculateSourceTimeWithVariableSpeed(), .getSpeedAtSourceTime()]
- "video_speed_engine_speedengine_setclipspeed": ".setClipSpeed()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L40 | neighbors=[SpeedEngine, .clampSpeed(), .getOrCreateSpeedData()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-038.json

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
