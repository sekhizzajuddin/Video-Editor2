# Node Description Batch 72 of 128

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

- "utils_mediaprobe_generateid": "generateId()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L13 | neighbors=[mediaProbe.ts, probeFile()]
- "utils_mediaprobe_probeimage": "probeImage()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L183 | neighbors=[mediaProbe.ts, probeFile()]
- "utils_motiontracker_getgrayscalepatch": "getGrayscalePatch()" | kind=code-symbol | source=src/utils/motionTracker.ts:L9 | neighbors=[motionTracker.ts, trackMotion()]
- "utils_motiontracker_matchtemplate": "matchTemplate()" | kind=code-symbol | source=src/utils/motionTracker.ts:L36 | neighbors=[motionTracker.ts, trackMotion()]
- "utils_projectpersistence_projectmetadata": "ProjectMetadata" | kind=code-symbol | source=src/utils/projectPersistence.ts:L31 | neighbors=[WelcomeScreen.tsx, projectPersistence.ts]
- "utils_serialization_deserializeproject": "deserializeProject()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L20 | neighbors=[storage-engine.ts, serialization.ts]
- "utils_serialization_serializeproject": "serializeProject()" | kind=code-symbol | source=packages/core/src/utils/serialization.ts:L9 | neighbors=[storage-engine.ts, serialization.ts]
- "utils_socialanimations": "socialAnimations.ts" | kind=code-symbol | source=src/utils/socialAnimations.ts:L1 | neighbors=[PreviewCanvas.tsx, drawSubscribeAnimation()]
- "utils_socialanimations_drawsubscribeanimation": "drawSubscribeAnimation()" | kind=code-symbol | source=src/utils/socialAnimations.ts:L1 | neighbors=[PreviewCanvas.tsx, socialAnimations.ts]
- "utils_speedramp_getfullkeyframes": "getFullKeyframes()" | kind=code-symbol | source=src/utils/speedRamp.ts:L3 | neighbors=[speedRamp.ts, getSpeedAtPosition()]
- "utils_srtparser_parsesrt": "parseSRT()" | kind=code-symbol | source=src/utils/srtParser.ts:L10 | neighbors=[MediaPanel.tsx, srtParser.ts]
- "utils_storyboardcompiler_compilegridforsegment": "compileGridForSegment()" | kind=code-symbol | source=src/utils/storyboardCompiler.ts:L11 | neighbors=[storyboardCompiler.ts, compileStoryboard()]
- "utils_time_formattime": "formatTime()" | kind=code-symbol | source=src/utils/time.ts:L1 | neighbors=[PreviewCanvas.tsx, time.ts]
- "utils_titletemplates_template_categories": "TEMPLATE_CATEGORIES" | kind=code-symbol | source=src/utils/titleTemplates.ts:L1460 | neighbors=[MediaPanel.tsx, titleTemplates.ts]
- "utils_titletemplates_templatecategory": "TemplateCategory" | kind=code-symbol | source=src/utils/titleTemplates.ts:L1469 | neighbors=[MediaPanel.tsx, titleTemplates.ts]
- "utils_waveformrenderer_renderwaveformtodataurl": "renderWaveformToDataUrl()" | kind=code-symbol | source=src/utils/waveformRenderer.ts:L121 | neighbors=[waveformRenderer.ts, createWaveformCanvas()]
- "utils_waveformrenderer_roundrect": "roundRect()" | kind=code-symbol | source=src/utils/waveformRenderer.ts:L79 | neighbors=[waveformRenderer.ts, renderWaveform()]
- "video_adjustment_layer_engine_adjustmentlayerengine_createadjustmentlayer": ".createAdjustmentLayer()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L68 | neighbors=[AdjustmentLayerEngine, generateId()]
- "video_adjustment_layer_engine_adjustmentlayerengine_duplicatelayer": ".duplicateLayer()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L287 | neighbors=[AdjustmentLayerEngine, generateId()]
- "video_adjustment_layer_engine_adjustmentlayerengine_setaffectedtracks": ".setAffectedTracks()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L239 | neighbors=[AdjustmentLayerEngine, .updateLayer()]
- "video_adjustment_layer_engine_adjustmentlayerengine_setblendmode": ".setBlendMode()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L231 | neighbors=[AdjustmentLayerEngine, .updateLayer()]
- "video_adjustment_layer_engine_adjustmentlayerengine_setenabled": ".setEnabled()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L235 | neighbors=[AdjustmentLayerEngine, .updateLayer()]
- "video_adjustment_layer_engine_adjustmentlayerengine_setopacity": ".setOpacity()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L225 | neighbors=[AdjustmentLayerEngine, .updateLayer()]
- "video_adjustment_layer_engine_getadjustmentlayerengine": "getAdjustmentLayerEngine()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L327 | neighbors=[adjustment-layer-engine.ts, AdjustmentLayerEngine]
- "video_animation_engine_animationengine_createbezierfunction": ".createBezierFunction()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L171 | neighbors=[AnimationEngine, .cubicBezier()]
- "video_animation_engine_beziercontrolpoints": "BezierControlPoints" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L7 | neighbors=[animation-engine.ts, keyframe-engine.ts]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_endframe": ".endFrame()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L49 | neighbors=[Canvas2DFallbackRenderer, .renderLayerToCanvas()]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_roundrect": ".roundRect()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L104 | neighbors=[Canvas2DFallbackRenderer, .renderLayerToCanvas()]
- "video_chroma_key_engine_chromakeyengine_counttransparentpixels": ".countTransparentPixels()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L394 | neighbors=[ChromaKeyEngine, .resizeTo()]
- "video_chroma_key_engine_chromakeyengine_enablechromakey": ".enableChromaKey()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L72 | neighbors=[ChromaKeyEngine, createDefaultChromaKeySettings()]
- "video_chroma_key_engine_chromakeyengine_samplekeycolor": ".sampleKeyColor()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L108 | neighbors=[ChromaKeyEngine, .resizeTo()]
- "video_chroma_key_engine_chromakeyengine_setedgesoftness": ".setEdgeSoftness()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L133 | neighbors=[ChromaKeyEngine, createDefaultChromaKeySettings()]
- "video_chroma_key_engine_chromakeyengine_setkeycolor": ".setKeyColor()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L95 | neighbors=[ChromaKeyEngine, createDefaultChromaKeySettings()]
- "video_chroma_key_engine_chromakeyengine_setspillsuppression": ".setSpillSuppression()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L142 | neighbors=[ChromaKeyEngine, createDefaultChromaKeySettings()]
- "video_chroma_key_engine_chromakeyengine_settolerance": ".setTolerance()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L124 | neighbors=[ChromaKeyEngine, createDefaultChromaKeySettings()]
- "video_chroma_key_engine_chromakeyengine_suppressspill": ".suppressSpill()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L315 | neighbors=[ChromaKeyEngine, .applyChromaKeyWithSettings()]
- "video_color_grading_engine_colorgradingengine_buildcurvelut": ".buildCurveLUT()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L517 | neighbors=[ColorGradingEngine, .applyCurves()]
- "video_color_grading_engine_colorgradingengine_compileshader": ".compileShader()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L337 | neighbors=[ColorGradingEngine, .initialize()]
- "video_color_grading_engine_colorgradingengine_hsltorgb": ".hslToRgb()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L837 | neighbors=[ColorGradingEngine, .applyHSL()]
- "video_color_grading_engine_colorgradingengine_rgbtohsl": ".rgbToHsl()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L809 | neighbors=[ColorGradingEngine, .applyHSL()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-071.json

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
