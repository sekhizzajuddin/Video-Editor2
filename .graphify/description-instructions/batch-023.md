# Node Description Batch 24 of 128

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

- "utils_storyboardcompiler": "storyboardCompiler.ts" | kind=code-symbol | source=src/utils/storyboardCompiler.ts:L1 | neighbors=[PropertiesPanel.tsx, compileGridForSegment(), compileStoryboard(), StoryboardChunk]
- "utils_titletemplates_title_templates": "TITLE_TEMPLATES" | kind=code-symbol | source=src/utils/titleTemplates.ts:L25 | neighbors=[AiMotionGraphicsDesigner.tsx, MediaPanel.tsx, Timeline.tsx, titleTemplates.ts]
- "video_animation_engine_animationengine_applyeasing": ".applyEasing()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L105 | neighbors=[AnimationEngine, .cubicBezier(), .getValueAtTime(), .interpolate()]
- "video_chroma_key_engine_chromakeyengine_getmatte": ".getMatte()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L223 | neighbors=[ChromaKeyEngine, .calculateAlpha(), .colorDistance(), .resizeTo()]
- "video_color_grading_engine_colorgradingengine_applycolorwheels": ".applyColorWheels()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L398 | neighbors=[ColorGradingEngine, .ensureInitialized(), .setupVertexAttributes(), .uploadTexture()]
- "video_color_grading_engine_colorgradingengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L897 | neighbors=[ColorGradingEngine, .applyColorWheels(), .applyCurves(), .initialize()]
- "video_frame_cache_framecache_delete": ".delete()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L73 | neighbors=[FrameCache, .clearMedia(), .get(), .evictOldest()]
- "video_frame_cache_framecache_evictifneeded": ".evictIfNeeded()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L186 | neighbors=[FrameCache, .evictOldest(), .set(), .updateConfig()]
- "video_frame_cache_framecache_get": ".get()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L30 | neighbors=[FrameCache, .delete(), .getMemoryByMedia(), .prioritizeAroundTime()]
- "video_frame_ring_buffer_frameringbuffer_write": ".write()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L37 | neighbors=[.writeCompositedFrame(), .writeTrackFrame(), FrameRingBuffer, .writeFromCanvas()]
- "video_gpu_compositor_gpucompositor_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L330 | neighbors=[disposeGPUCompositor(), GPUCompositor, .clearLayers(), initializeGPUCompositor()]
- "video_gpu_compositor_initializegpucompositor": "initializeGPUCompositor()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L378 | neighbors=[gpu-compositor.ts, GPUCompositor, .dispose(), video-engine.ts]
- "video_keyframe_engine_keyframeengine_addkeyframe": ".addKeyframe()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L61 | neighbors=[KeyframeEngine, .generateKeyframeId(), .getDefaultBezierHandles(), .mapEasingPresetToType()]
- "video_keyframe_engine_keyframeengine_getvalueattime": ".getValueAtTime()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L121 | neighbors=[KeyframeEngine, .getMotionPath(), .applyEasing(), .interpolateValue()]
- "video_mask_engine_maskengine_getmaskattime": ".getMaskAtTime()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L589 | neighbors=[MaskEngine, .applyMask(), applyEasing(), interpolatePaths()]
- "video_parallel_frame_decoder_initializeparalleldecoder": "initializeParallelDecoder()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L430 | neighbors=[parallel-frame-decoder.ts, ParallelFrameDecoder, .dispose(), .initialize()]
- "video_parallel_frame_decoder_parallelframedecoder_decodeframe": ".decodeFrame()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L292 | neighbors=[ParallelFrameDecoder, .getFromCache(), .initialize(), .decodeFrames()]
- "video_parallel_frame_decoder_parallelframedecoder_decodeframes": ".decodeFrames()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L317 | neighbors=[ParallelFrameDecoder, .decodeClipsAtTime(), .decodeFrame(), .initialize()]
- "video_parallel_frame_decoder_parallelframedecoder_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L394 | neighbors=[disposeParallelDecoder(), initializeParallelDecoder(), ParallelFrameDecoder, .clearCache()]
- "video_parallel_frame_decoder_parallelframedecoder_processqueue": ".processQueue()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L247 | neighbors=[ParallelFrameDecoder, .handleDecodeResponse(), .getLeastBusyWorker(), .sendDecodeRequest()]
- "video_playback_engine_playbackengine_clearstreams": ".clearStreams()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L521 | neighbors=[PlaybackEngine, .dispose(), .setupStreams(), .stop()]
- "video_playback_engine_playbackengine_startdecoding": ".startDecoding()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L255 | neighbors=[PlaybackEngine, .play(), .seek(), .decodeLoop()]
- "video_playback_engine_playbackengine_startplaybackloop": ".startPlaybackLoop()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L399 | neighbors=[PlaybackEngine, .play(), .resume(), .seek()]
- "video_playback_engine_playbackengine_stopplaybackloop": ".stopPlaybackLoop()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L422 | neighbors=[PlaybackEngine, .pause(), .seek(), .stop()]
- "video_playback_engine_playbackengine_waitforbuffer": ".waitForBuffer()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L508 | neighbors=[PlaybackEngine, .play(), .seek(), .sleep()]
- "video_renderer_factory_rendererconfig": "RendererConfig" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L5 | neighbors=[canvas2d-fallback-renderer.ts, renderer-factory.ts, video-effects-engine.ts, webgpu-renderer-impl.ts]
- "video_renderer_factory_renderlayer": "RenderLayer" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L13 | neighbors=[canvas2d-fallback-renderer.ts, gpu-compositor.ts, renderer-factory.ts, webgpu-renderer-impl.ts]
- "video_speed_engine_speedengine_calculatesourcetimewithvariablespeed": ".calculateSourceTimeWithVariableSpeed()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L346 | neighbors=[SpeedEngine, .calculateVariableSpeedDuration(), .integratePlaybackTime(), .getSourceTimeAtPlaybackTime()]
- "video_speed_engine_speedengine_calculatevariablespeedduration": ".calculateVariableSpeedDuration()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L62 | neighbors=[SpeedEngine, .calculateSourceTimeWithVariableSpeed(), .getSpeedAtSourceTime(), .getEffectiveDuration()]
- "video_speed_engine_speedengine_clampspeed": ".clampSpeed()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L84 | neighbors=[SpeedEngine, .addSpeedKeyframe(), .setClipSpeed(), .updateSpeedKeyframe()]
- "video_speed_engine_speedengine_getorcreatespeeddata": ".getOrCreateSpeedData()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L436 | neighbors=[SpeedEngine, .initializeClip(), .setClipSpeed(), .setReverse()]
- "video_speed_engine_speedengine_getspeedatsourcetime": ".getSpeedAtSourceTime()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L220 | neighbors=[SpeedEngine, .calculateVariableSpeedDuration(), .getSpeedAtTime(), .integratePlaybackTime()]
- "video_texture_cache_getcachekey": "getCacheKey()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L16 | neighbors=[texture-cache.ts, .get(), .has(), .set()]
- "video_transition_engine_transitionengine_fittocanvas": ".fitToCanvas()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L90 | neighbors=[TransitionEngine, .getContext(), .sourceDimensions(), .renderTransitionToCanvas()]
- "video_transition_engine_transitionengine_renderslide": ".renderSlide()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L355 | neighbors=[TransitionEngine, .renderPush(), .getContext(), .renderTransitionToCanvas()]
- "video_types_renderedframe": "RenderedFrame" | kind=code-symbol | source=packages/core/src/video/types.ts:L3 | neighbors=[playback-controller.ts, types.ts, types.ts, video-engine.ts]
- "video_unified_effects_processor_unifiedeffectsprocessor_processwithcanvas2d": ".processWithCanvas2D()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L108 | neighbors=[UnifiedEffectsProcessor, .processFrame(), .buildFilterString(), .processWithWebGPU()]
- "video_video_effects_engine_getvideoeffectsengine": "getVideoEffectsEngine()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1682 | neighbors=[video-effects-engine.ts, VideoEffectsEngine, .initialize(), .resize()]
- "video_video_effects_engine_videoeffectsengine_applyeffects": ".applyEffects()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L597 | neighbors=[VideoEffectsEngine, .applyEffect(), .applyEffectsCPU(), ._applyEffectsWithNewRenderer()]
- "video_video_effects_engine_videoeffectsengine_renderwithshader": ".renderWithShader()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L780 | neighbors=[VideoEffectsEngine, ._applyEffectsGPU(), .setFilterUniforms(), .setupVertexAttributes()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-023.json

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
