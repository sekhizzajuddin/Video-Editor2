# Node Description Batch 75 of 128

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

- "video_parallel_frame_decoder_disposeparalleldecoder": "disposeParallelDecoder()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L441 | neighbors=[parallel-frame-decoder.ts, .dispose()]
- "video_parallel_frame_decoder_parallelframedecoder_addtocache": ".addToCache()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L189 | neighbors=[ParallelFrameDecoder, .handleDecodeResponse()]
- "video_parallel_frame_decoder_parallelframedecoder_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L385 | neighbors=[ParallelFrameDecoder, .dispose()]
- "video_parallel_frame_decoder_parallelframedecoder_createworker": ".createWorker()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L98 | neighbors=[ParallelFrameDecoder, .doInitialize()]
- "video_parallel_frame_decoder_parallelframedecoder_decodeclipsattime": ".decodeClipsAtTime()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L339 | neighbors=[ParallelFrameDecoder, .decodeFrames()]
- "video_parallel_frame_decoder_parallelframedecoder_getfromcache": ".getFromCache()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L211 | neighbors=[ParallelFrameDecoder, .decodeFrame()]
- "video_parallel_frame_decoder_parallelframedecoder_getleastbusyworker": ".getLeastBusyWorker()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L233 | neighbors=[ParallelFrameDecoder, .processQueue()]
- "video_parallel_frame_decoder_parallelframedecoder_senddecoderequest": ".sendDecodeRequest()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L261 | neighbors=[ParallelFrameDecoder, .processQueue()]
- "video_playback_engine_playbackengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L62 | neighbors=[initializePlaybackEngine(), PlaybackEngine]
- "video_playback_engine_playbackengine_insertframeinbuffer": ".insertFrameInBuffer()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L376 | neighbors=[PlaybackEngine, .decodeLoop()]
- "video_renderer_factory_createrenderer": "createRenderer()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L139 | neighbors=[renderer-factory.ts, .getInstance()]
- "video_renderer_factory_getbestrenderertype": "getBestRendererType()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L49 | neighbors=[renderer-factory.ts, .getRendererType()]
- "video_renderer_factory_rendererfactory_destroyrenderer": ".destroyRenderer()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L119 | neighbors=[RendererFactory, .recreateRenderer()]
- "video_renderer_factory_rendererfactory_getrenderertype": ".getRendererType()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L79 | neighbors=[RendererFactory, getBestRendererType()]
- "video_renderer_factory_rendererfactory_recreaterenderer": ".recreateRenderer()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L126 | neighbors=[RendererFactory, .destroyRenderer()]
- "video_speed_engine_initializespeedengine": "initializeSpeedEngine()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L485 | neighbors=[speed-engine.ts, SpeedEngine]
- "video_speed_engine_speedengine_addspeedkeyframe": ".addSpeedKeyframe()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L136 | neighbors=[SpeedEngine, .clampSpeed()]
- "video_speed_engine_speedengine_geteffectiveduration": ".getEffectiveDuration()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L52 | neighbors=[SpeedEngine, .calculateVariableSpeedDuration()]
- "video_speed_engine_speedengine_getframeindicesinrange": ".getFrameIndicesInRange()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L120 | neighbors=[SpeedEngine, .getFrameIndexAtTime()]
- "video_speed_engine_speedengine_getfreezeframeattime": ".getFreezeFrameAtTime()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L299 | neighbors=[SpeedEngine, .getSourceTimeAtPlaybackTime()]
- "video_speed_engine_speedengine_getinterpolationinfo": ".getInterpolationInfo()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L410 | neighbors=[SpeedEngine, .getSourceTimeAtPlaybackTime()]
- "video_speed_engine_speedengine_getspeedattime": ".getSpeedAtTime()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L213 | neighbors=[SpeedEngine, .getSpeedAtSourceTime()]
- "video_speed_engine_speedengine_initializeclip": ".initializeClip()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L456 | neighbors=[SpeedEngine, .getOrCreateSpeedData()]
- "video_speed_engine_speedengine_setreverse": ".setReverse()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L88 | neighbors=[SpeedEngine, .getOrCreateSpeedData()]
- "video_speed_engine_speedengine_updatespeedkeyframe": ".updateSpeedKeyframe()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L182 | neighbors=[SpeedEngine, .clampSpeed()]
- "video_speed_engine_test": "speed-engine.test.ts" | kind=code-symbol | source=packages/core/src/video/speed-engine.test.ts:L1 | neighbors=[speed-engine.ts, SpeedEngine]
- "video_texture_cache_calculatetexturesize": "calculateTextureSize()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L158 | neighbors=[texture-cache.ts, webgpu-renderer-impl.ts]
- "video_texture_cache_texturecache_clear": ".clear()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L120 | neighbors=[TextureCache, .evictKey()]
- "video_texture_cache_texturecache_evict": ".evict()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L69 | neighbors=[TextureCache, .evictKey()]
- "video_transform_animator_point2d": "Point2D" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L24 | neighbors=[types.ts, transform-animator.ts]
- "video_transition_engine_createtransitionengine": "createTransitionEngine()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L684 | neighbors=[transition-engine.ts, TransitionEngine]
- "video_transition_engine_transitionengine_applyeasing": ".applyEasing()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L443 | neighbors=[TransitionEngine, .renderTransitionToCanvas()]
- "video_transition_engine_transitionengine_areclipsadjacent": ".areClipsAdjacent()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L508 | neighbors=[TransitionEngine, .findAdjacentClipPairs()]
- "video_transition_engine_transitionengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L39 | neighbors=[TransitionEngine, .initializeCanvas()]
- "video_transition_engine_transitionengine_findadjacentclippairs": ".findAdjacentClipPairs()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L520 | neighbors=[TransitionEngine, .areClipsAdjacent()]
- "video_transition_engine_transitionengine_getdefaultparams": ".getDefaultParams()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L567 | neighbors=[TransitionEngine, .createTransition()]
- "video_transition_engine_transitionengine_rendertransition": ".renderTransition()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L142 | neighbors=[TransitionEngine, .renderTransitionToCanvas()]
- "video_transition_engine_transitionengine_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L647 | neighbors=[TransitionEngine, .getContext()]
- "video_transition_engine_transitionengine_sourcedimensions": ".sourceDimensions()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L70 | neighbors=[TransitionEngine, .fitToCanvas()]
- "video_transition_engine_transitionengine_updatetransitionduration": ".updateTransitionDuration()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L588 | neighbors=[TransitionEngine, .validateTransition()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-074.json

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
