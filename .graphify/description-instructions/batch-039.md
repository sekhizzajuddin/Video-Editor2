# Node Description Batch 40 of 128

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

- "video_texture_cache_texturecache_evictlru": ".evictLRU()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L83 | neighbors=[TextureCache, .evictKey(), .set()]
- "video_texture_cache_texturecache_get": ".get()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L31 | neighbors=[TextureCache, .evictKey(), getCacheKey()]
- "video_texture_cache_texturecache_has": ".has()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L138 | neighbors=[TextureCache, getCacheKey(), .set()]
- "video_transition_engine_transitionengine_createtransition": ".createTransition()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L538 | neighbors=[TransitionEngine, .getDefaultParams(), .validateTransition()]
- "video_transition_engine_transitionengine_initializecanvas": ".initializeCanvas()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L46 | neighbors=[TransitionEngine, .constructor(), .getContext()]
- "video_transition_engine_transitionengine_rendercrossfade": ".renderCrossfade()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L257 | neighbors=[TransitionEngine, .getContext(), .renderTransitionToCanvas()]
- "video_transition_engine_transitionengine_renderdiptocolor": ".renderDipToColor()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L273 | neighbors=[TransitionEngine, .getContext(), .renderTransitionToCanvas()]
- "video_transition_engine_transitionengine_renderpush": ".renderPush()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L433 | neighbors=[TransitionEngine, .renderSlide(), .renderTransitionToCanvas()]
- "video_transition_engine_transitionengine_renderwipe": ".renderWipe()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L309 | neighbors=[TransitionEngine, .renderTransitionToCanvas(), .getContext()]
- "video_transition_engine_transitionengine_renderzoom": ".renderZoom()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L396 | neighbors=[TransitionEngine, .renderTransitionToCanvas(), .getContext()]
- "video_transition_engine_transitionengine_validatetransition": ".validateTransition()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L456 | neighbors=[TransitionEngine, .createTransition(), .updateTransitionDuration()]
- "video_types_cachedframe": "CachedFrame" | kind=code-symbol | source=packages/core/src/video/types.ts:L52 | neighbors=[frame-cache.ts, types.ts, video-engine.ts]
- "video_types_framecacheconfig": "FrameCacheConfig" | kind=code-symbol | source=packages/core/src/video/types.ts:L36 | neighbors=[frame-cache.ts, types.ts, video-engine.ts]
- "video_types_framecachestats": "FrameCacheStats" | kind=code-symbol | source=packages/core/src/video/types.ts:L43 | neighbors=[frame-cache.ts, types.ts, video-engine.ts]
- "video_unified_effects_processor_initunifiedeffectsprocessor": "initUnifiedEffectsProcessor()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L259 | neighbors=[unified-effects-processor.ts, UnifiedEffectsProcessor, .initialize()]
- "video_unified_effects_processor_unifiedeffectsprocessor_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L34 | neighbors=[initUnifiedEffectsProcessor(), UnifiedEffectsProcessor, .processFrame()]
- "video_unified_effects_processor_unifiedeffectsprocessor_processwithwebgpu": ".processWithWebGPU()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L99 | neighbors=[UnifiedEffectsProcessor, .processFrame(), .processWithCanvas2D()]
- "video_video_effects_engine_videoeffectsengine_applychromakey": ".applyChromaKey()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1182 | neighbors=[VideoEffectsEngine, .smoothstep(), .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applyeffectswithnewrenderer": "._applyEffectsWithNewRenderer()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L621 | neighbors=[VideoEffectsEngine, .applyEffects(), .applyEffectsCPU()]
- "video_video_effects_engine_videoeffectsengine_applytonal": ".applyTonal()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1251 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel(), .smoothstep()]
- "video_video_effects_engine_videoeffectsengine_applyvignette": ".applyVignette()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1133 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel(), .smoothstep()]
- "video_video_effects_engine_videoeffectsengine_buildcssfilter": ".buildCSSFilter()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1471 | neighbors=[VideoEffectsEngine, .applyEffectsCPU(), .toFilterColor()]
- "video_video_effects_engine_videoeffectsengine_createrendertexture": ".createRenderTexture()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L512 | neighbors=[VideoEffectsEngine, .initializeWebGL(), .resize()]
- "video_video_effects_engine_videoeffectsengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L390 | neighbors=[getVideoEffectsEngine(), VideoEffectsEngine, .doInitialize()]
- "video_video_effects_engine_videoeffectsengine_initializenewrenderer": ".initializeNewRenderer()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L432 | neighbors=[VideoEffectsEngine, .doInitialize(), .initializeWebGL()]
- "video_video_effects_engine_videoeffectsengine_renderpassthrough": ".renderPassthrough()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L815 | neighbors=[VideoEffectsEngine, ._applyEffectsGPU(), .setupVertexAttributes()]
- "video_video_effects_engine_videoeffectsengine_setupvertexattributes": ".setupVertexAttributes()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L830 | neighbors=[VideoEffectsEngine, .renderPassthrough(), .renderWithShader()]
- "video_video_engine_initializevideoengine": "initializeVideoEngine()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2880 | neighbors=[video-engine.ts, getVideoEngine(), .initialize()]
- "video_video_engine_videoengine_decodeframe": ".decodeFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2098 | neighbors=[VideoEngine, .dispose(), .ensureInitialized()]
- "video_video_engine_videoengine_decodeframetocanvas": ".decodeFrameToCanvas()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2199 | neighbors=[VideoEngine, .dispose(), .ensureInitialized()]
- "video_video_engine_videoengine_decodeframewithvideoelement": ".decodeFrameWithVideoElement()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L408 | neighbors=[VideoEngine, .decodeClipBitmap(), .renderFrame()]
- "video_video_engine_videoengine_getcachekey": ".getCacheKey()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2427 | neighbors=[VideoEngine, .preloadFrames(), .preloadFramesRange()]
- "video_video_engine_videoengine_gettotalcachesize": ".getTotalCacheSize()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2483 | neighbors=[VideoEngine, .evictIfNeeded(), .getCacheStats()]
- "video_video_engine_videoengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L239 | neighbors=[VideoEngine, .drawMaskedSubjectFromFrame(), .renderFrame()]
- "video_video_engine_videoengine_processpreloadqueue": ".processPreloadQueue()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2608 | neighbors=[VideoEngine, .preloadFramesRange(), .queuePreload()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_applyblur": ".applyBlur()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L388 | neighbors=[WebGPUEffectsProcessor, .applyBlurPass(), .processEffects()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_createintermediatetextures": ".createIntermediateTextures()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L206 | neighbors=[WebGPUEffectsProcessor, .initialize(), .resize()]
- "video_webgpu_renderer_impl_webgpurenderer_cacheframe": ".cacheFrame()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L997 | neighbors=[WebGPURenderer, .createTextureFromImage(), .getCachedFrame()]
- "video_webgpu_types_d_gpuprogrammablestage": "GPUProgrammableStage" | kind=code-symbol | source=packages/core/src/video/webgpu-types.d.ts:L381 | neighbors=[webgpu-types.d.ts, GPUFragmentState, GPUVertexState]
- "vite_config": "vite.config.ts" | kind=code-symbol | source=vite.config.ts:L1 | neighbors=[audioSeparatorPlugin(), escapeXml(), generateSecMSGec()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-039.json

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
