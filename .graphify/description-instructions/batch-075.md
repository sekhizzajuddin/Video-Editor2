# Node Description Batch 76 of 128

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

- "video_types_compositelayer": "CompositeLayer" | kind=code-symbol | source=packages/core/src/video/types.ts:L10 | neighbors=[types.ts, video-engine.ts]
- "video_types_filterdefinition": "FilterDefinition" | kind=code-symbol | source=packages/core/src/video/types.ts:L85 | neighbors=[types.ts, video-engine.ts]
- "video_types_preloadrequest": "PreloadRequest" | kind=code-symbol | source=packages/core/src/video/types.ts:L92 | neighbors=[types.ts, video-engine.ts]
- "video_types_videocliprenderinfo": "VideoClipRenderInfo" | kind=code-symbol | source=packages/core/src/video/types.ts:L69 | neighbors=[types.ts, video-engine.ts]
- "video_types_videocodecsupport": "VideoCodecSupport" | kind=code-symbol | source=packages/core/src/video/types.ts:L79 | neighbors=[types.ts, video-engine.ts]
- "video_unified_effects_processor_getunifiedeffectsprocessor": "getUnifiedEffectsProcessor()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L252 | neighbors=[unified-effects-processor.ts, UnifiedEffectsProcessor]
- "video_unified_effects_processor_unifiedeffectsprocessor_applyeffect": ".applyEffect()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L215 | neighbors=[UnifiedEffectsProcessor, .processFrame()]
- "video_unified_effects_processor_unifiedeffectsprocessor_buildfilterstring": ".buildFilterString()" | kind=code-symbol | source=packages/core/src/video/unified-effects-processor.ts:L139 | neighbors=[UnifiedEffectsProcessor, .processWithCanvas2D()]
- "video_video_effects_engine_disposevideoeffectsengine": "disposeVideoEffectsEngine()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1703 | neighbors=[video-effects-engine.ts, .dispose()]
- "video_video_effects_engine_getvideoeffectsengineasync": "getVideoEffectsEngineAsync()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1655 | neighbors=[video-effects-engine.ts, .resize()]
- "video_video_effects_engine_orderedeffect": "OrderedEffect" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L15 | neighbors=[video-effects-engine.ts, Effect]
- "video_video_effects_engine_videoeffectsengine_applychromaticaberration": ".applyChromaticAberration()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1408 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applyeffect": ".applyEffect()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1514 | neighbors=[VideoEffectsEngine, .applyEffects()]
- "video_video_effects_engine_videoeffectsengine_applygrain": ".applyGrain()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1171 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applymotionblur": ".applyMotionBlur()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1280 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applyradialblur": ".applyRadialBlur()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1343 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applysharpenkernel": ".applySharpenKernel()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1097 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applytemperature": ".applyTemperature()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1209 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_applytint": ".applyTint()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1233 | neighbors=[VideoEffectsEngine, .applyEffectPixelLevel()]
- "video_video_effects_engine_videoeffectsengine_compileshader": ".compileShader()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L536 | neighbors=[VideoEffectsEngine, .initializeWebGL()]
- "video_video_effects_engine_videoeffectsengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1601 | neighbors=[disposeVideoEffectsEngine(), VideoEffectsEngine]
- "video_video_effects_engine_videoeffectsengine_getavailablefilters": ".getAvailableFilters()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1575 | neighbors=[VideoEffectsEngine, .isFilterSupported()]
- "video_video_effects_engine_videoeffectsengine_isfiltersupported": ".isFilterSupported()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1597 | neighbors=[VideoEffectsEngine, .getAvailableFilters()]
- "video_video_effects_engine_videoeffectsengine_iswebgl2supported": ".isWebGL2Supported()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1537 | neighbors=[VideoEffectsEngine, .doInitialize()]
- "video_video_effects_engine_videoeffectsengine_setfilteruniforms": ".setFilterUniforms()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L848 | neighbors=[VideoEffectsEngine, .renderWithShader()]
- "video_video_effects_engine_videoeffectsengine_tofiltercolor": ".toFilterColor()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L1437 | neighbors=[VideoEffectsEngine, .buildCSSFilter()]
- "video_video_effects_engine_videoeffectsengine_uploadtexture": ".uploadTexture()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L766 | neighbors=[VideoEffectsEngine, ._applyEffectsGPU()]
- "video_video_engine_videoengine_applyemphasisanimation": ".applyEmphasisAnimation()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1691 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_applyfilter": ".applyFilter()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2800 | neighbors=[VideoEngine, .buildFilterString()]
- "video_video_engine_videoengine_buildfilterstring": ".buildFilterString()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2818 | neighbors=[VideoEngine, .applyFilter()]
- "video_video_engine_videoengine_capturesubjectframe": ".captureSubjectFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1013 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2512 | neighbors=[VideoEngine, .dispose()]
- "video_video_engine_videoengine_clearvideoelementcache": ".clearVideoElementCache()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L499 | neighbors=[VideoEngine, .dispose()]
- "video_video_engine_videoengine_compositeframe": ".compositeFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2265 | neighbors=[VideoEngine, .composite()]
- "video_video_engine_videoengine_drawframetocontext": ".drawFrameToContext()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L917 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_ensurecompositecanvas": ".ensureCompositeCanvas()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2416 | neighbors=[VideoEngine, .composite()]
- "video_video_engine_videoengine_evictoldestframe": ".evictOldestFrame()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2463 | neighbors=[VideoEngine, .evictIfNeeded()]
- "video_video_engine_videoengine_findactivetransition": ".findActiveTransition()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1348 | neighbors=[VideoEngine, .renderActiveTransition()]
- "video_video_engine_videoengine_getactiveshapeclips": ".getActiveShapeClips()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1094 | neighbors=[VideoEngine, .renderFrame()]
- "video_video_engine_videoengine_getactivestickerclips": ".getActiveStickerClips()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L1125 | neighbors=[VideoEngine, .renderFrame()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-075.json

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
