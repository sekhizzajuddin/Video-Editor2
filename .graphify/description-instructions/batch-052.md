# Node Description Batch 53 of 128

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

- "frame_interpolation_flow_field_cache_flowfieldcache_set": ".set()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L27 | neighbors=[FlowFieldCache, .evictLRU()]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_simpleblend": ".simpleBlend()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L182 | neighbors=[FrameInterpolationEngine, .interpolate()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_bilinearsample": ".bilinearSample()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L243 | neighbors=[OpticalFlowCPU, .warpAndBlend()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_buildpyramid": ".buildPyramid()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L281 | neighbors=[OpticalFlowCPU, .computeFlowField()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_computesad": ".computeSAD()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L195 | neighbors=[OpticalFlowCPU, .blockMatch()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_warpandblend": ".warpAndBlend()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L86 | neighbors=[OpticalFlowCPU, .bilinearSample()]
- "graphics_graphics_engine_graphicsengine_applyemphasisanimation": ".applyEmphasisAnimation()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1014 | neighbors=[GraphicsEngine, .getAnimatedGraphicState()]
- "graphics_graphics_engine_graphicsengine_applygraphicanimation": ".applyGraphicAnimation()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1423 | neighbors=[GraphicsEngine, .getAnimatedGraphicState()]
- "graphics_graphics_engine_graphicsengine_applytransform": ".applyTransform()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1597 | neighbors=[GraphicsEngine, .renderGraphic()]
- "graphics_graphics_engine_graphicsengine_createarrow": ".createArrow()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L172 | neighbors=[GraphicsEngine, .createShape()]
- "graphics_graphics_engine_graphicsengine_createcircle": ".createCircle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L145 | neighbors=[GraphicsEngine, .createShape()]
- "graphics_graphics_engine_graphicsengine_creategradient": ".createGradient()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L866 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_createrectangle": ".createRectangle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L119 | neighbors=[GraphicsEngine, .createShape()]
- "graphics_graphics_engine_graphicsengine_drawarrow": ".drawArrow()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L793 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawcircle": ".drawCircle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L761 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawellipse": ".drawEllipse()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L770 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawline": ".drawLine()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L818 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawpolygoncentered": ".drawPolygonCentered()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L851 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawrectangle": ".drawRectangle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L734 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawstar": ".drawStar()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L829 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_drawtriangle": ".drawTriangle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L780 | neighbors=[GraphicsEngine, .renderShape()]
- "graphics_graphics_engine_graphicsengine_getanimatedsvgsourceinset": ".getAnimatedSVGSourceInset()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L569 | neighbors=[GraphicsEngine, .renderSVG()]
- "graphics_graphics_engine_graphicsengine_parsesvg": ".parseSVG()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L374 | neighbors=[GraphicsEngine, .importSVG()]
- "graphics_graphics_engine_graphicsengine_setnestedproperty": ".setNestedProperty()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1612 | neighbors=[GraphicsEngine, .getAnimatedTransform()]
- "graphics_graphics_engine_graphicsengine_updatefill": ".updateFill()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L237 | neighbors=[GraphicsEngine, .updateShapeStyle()]
- "graphics_graphics_engine_graphicsengine_updatestroke": ".updateStroke()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L250 | neighbors=[GraphicsEngine, .updateShapeStyle()]
- "graphics_graphics_engine_test_mockcanvas": "MockCanvas" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.test.ts:L47 | neighbors=[graphics-engine.test.ts, .getContext()]
- "graphics_sticker_library_stickerlibrary_addsticker": ".addSticker()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L217 | neighbors=[StickerLibrary, .importSticker()]
- "graphics_sticker_library_stickerlibrary_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L198 | neighbors=[StickerLibrary, .initializeDefaultCategories()]
- "graphics_sticker_library_stickerlibrary_createemojiclip": ".createEmojiClip()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L304 | neighbors=[StickerLibrary, .emojiToDataUrl()]
- "graphics_sticker_library_stickerlibrary_emojitodataurl": ".emojiToDataUrl()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L326 | neighbors=[StickerLibrary, .createEmojiClip()]
- "graphics_sticker_library_stickerlibrary_filetodataurl": ".fileToDataUrl()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L370 | neighbors=[StickerLibrary, .importSticker()]
- "graphics_sticker_library_stickerlibrary_getemoji": ".getEmoji()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L280 | neighbors=[StickerLibrary, .getAllEmojis()]
- "graphics_sticker_library_stickerlibrary_initializedefaultcategories": ".initializeDefaultCategories()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L202 | neighbors=[StickerLibrary, .constructor()]
- "graphics_sticker_library_stickerlibrary_searchemojis": ".searchEmojis()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L273 | neighbors=[StickerLibrary, .getAllEmojis()]
- "graphics_svg_animation_presets_createdefaultsvganimation": "createDefaultSVGAnimation()" | kind=code-symbol | source=packages/core/src/graphics/svg-animation-presets.ts:L181 | neighbors=[svg-animation-presets.ts, getSVGPresetInfo()]
- "graphics_svg_animation_presets_getsvgpresetinfo": "getSVGPresetInfo()" | kind=code-symbol | source=packages/core/src/graphics/svg-animation-presets.ts:L175 | neighbors=[svg-animation-presets.ts, createDefaultSVGAnimation()]
- "graphics_types_arrowproperties": "ArrowProperties" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L233 | neighbors=[graphics-engine.ts, types.ts]
- "graphics_types_createshapeparams": "CreateShapeParams" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L283 | neighbors=[graphics-engine.ts, types.ts]
- "graphics_types_default_shape_style": "DEFAULT_SHAPE_STYLE" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L256 | neighbors=[graphics-engine.ts, types.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-052.json

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
