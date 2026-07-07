# Node Description Batch 77 of 128

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

- "video_video_engine_videoengine_getactivesubtitles": ".getActiveSubtitles()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1226 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_getactivesvgclips": ".getActiveSVGClips()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1108 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_getactivetextclips": ".getActiveTextClips()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1080 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_getanimatedeffects": ".getAnimatedEffects()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1531 | neighbors=[VideoEngine, .createClipRenderInfo()]
- "video_video_engine_videoengine_getanimatedtransform": ".getAnimatedTransform()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1598 | neighbors=[VideoEngine, .createClipRenderInfo()]
- "video_video_engine_videoengine_getcachedinterpframe": ".getCachedInterpFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L292 | neighbors=[VideoEngine, .decodeInterpolatedFrame()]
- "video_video_engine_videoengine_getcachestats": ".getCacheStats()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2496 | neighbors=[VideoEngine, .getTotalCacheSize()]
- "video_video_engine_videoengine_getcanvasblendmode": ".getCanvasBlendMode()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2394 | neighbors=[VideoEngine, .composite()]
- "video_video_engine_videoengine_getclipsattime": ".getClipsAtTime()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1340 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_getsupportedcodecs": ".getSupportedCodecs()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2692 | neighbors=[VideoEngine, .ensureInitialized()]
- "video_video_engine_videoengine_iswebcodecssupported": ".isWebCodecsSupported()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L158 | neighbors=[VideoEngine, .initialize()]
- "video_video_engine_videoengine_queuepreload": ".queuePreload()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2599 | neighbors=[VideoEngine, .processPreloadQueue()]
- "video_video_engine_videoengine_renderparticlestocontext": ".renderParticlesToContext()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1233 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_rendershapecliptocanvasctx": ".renderShapeClipToCanvasCtx()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1160 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_renderstickercliptocanvasctx": ".renderStickerClipToCanvasCtx()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1204 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_rendersubtitletocanvasctx": ".renderSubtitleToCanvasCtx()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1282 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_rendersvgcliptocanvasctx": ".renderSVGClipToCanvasCtx()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1182 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_rendertextcliptocanvasctx": ".renderTextClipToCanvasCtx()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1142 | neighbors=[VideoEngine, .renderTextClipWithSubjectMask()]
- "video_video_engine_videoengine_setcachedinterpframe": ".setCachedInterpFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L299 | neighbors=[VideoEngine, .decodeInterpolatedFrame()]
- "video_webgpu_effects_processor_effectschangecallback": "EffectsChangeCallback" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L32 | neighbors=[webgpu-effects-processor.ts, webgpu-renderer-impl.ts]
- "video_webgpu_effects_processor_webgpueffectsprocessor_aggregateeffectparams": ".aggregateEffectParams()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L273 | neighbors=[WebGPUEffectsProcessor, .processEffects()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_applyblurpass": ".applyBlurPass()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L401 | neighbors=[WebGPUEffectsProcessor, .applyBlur()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_applycoloreffects": ".applyColorEffects()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L338 | neighbors=[WebGPUEffectsProcessor, .processEffects()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_calculateeffectshash": ".calculateEffectsHash()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L480 | neighbors=[WebGPUEffectsProcessor, .notifyEffectsChanged()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_createbindgrouplayouts": ".createBindGroupLayouts()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L84 | neighbors=[WebGPUEffectsProcessor, .initialize()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_createpipelines": ".createPipelines()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L140 | neighbors=[WebGPUEffectsProcessor, .initialize()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_createuniformbuffers": ".createUniformBuffers()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L176 | neighbors=[WebGPUEffectsProcessor, .initialize()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_hascoloreffects": ".hasColorEffects()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L325 | neighbors=[WebGPUEffectsProcessor, .processEffects()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_notifyeffectschanged": ".notifyEffectsChanged()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L453 | neighbors=[WebGPUEffectsProcessor, .calculateEffectsHash()]
- "video_webgpu_effects_processor_webgpueffectsprocessor_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/webgpu-effects-processor.ts:L491 | neighbors=[WebGPUEffectsProcessor, .createIntermediateTextures()]
- "video_webgpu_renderer_impl_webgpurenderer_attemptdevicerecreation": ".attemptDeviceRecreation()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L187 | neighbors=[WebGPURenderer, .recreateDevice()]
- "video_webgpu_renderer_impl_webgpurenderer_createbindgrouplayouts": ".createBindGroupLayouts()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L230 | neighbors=[WebGPURenderer, .initialize()]
- "video_webgpu_renderer_impl_webgpurenderer_createborderradiuspipeline": ".createBorderRadiusPipeline()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L448 | neighbors=[WebGPURenderer, .initializePipelines()]
- "video_webgpu_renderer_impl_webgpurenderer_createcompositepipeline": ".createCompositePipeline()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L340 | neighbors=[WebGPURenderer, .initializePipelines()]
- "video_webgpu_renderer_impl_webgpurenderer_createtexturefromimage": ".createTextureFromImage()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L854 | neighbors=[WebGPURenderer, .cacheFrame()]
- "video_webgpu_renderer_impl_webgpurenderer_createtexturesampler": ".createTextureSampler()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L315 | neighbors=[WebGPURenderer, .initialize()]
- "video_webgpu_renderer_impl_webgpurenderer_createtransformpipeline": ".createTransformPipeline()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L394 | neighbors=[WebGPURenderer, .initializePipelines()]
- "video_webgpu_renderer_impl_webgpurenderer_createuniformbuffers": ".createUniformBuffers()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L292 | neighbors=[WebGPURenderer, .initialize()]
- "video_webgpu_renderer_impl_webgpurenderer_getcachedframe": ".getCachedFrame()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L984 | neighbors=[WebGPURenderer, .cacheFrame()]
- "video_webgpu_renderer_impl_webgpurenderer_getframecachestats": ".getFrameCacheStats()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L1026 | neighbors=[WebGPURenderer, .getMemoryUsage()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-076.json

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
