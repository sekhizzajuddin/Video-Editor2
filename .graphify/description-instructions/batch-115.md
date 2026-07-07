# Node Description Batch 116 of 128

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

- "video_adjustment_layer_engine_adjustmentlayerengine_getalllayers": ".getAllLayers()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L107 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_getblendmodes": ".getBlendModes()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L312 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_geteffectsforclip": ".getEffectsForClip()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L243 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_getlayer": ".getLayer()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L103 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_getlayersfortrack": ".getLayersForTrack()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L111 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_removeeffect": ".removeEffect()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L187 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_adjustmentlayerengine_updateeffect": ".updateEffect()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L199 | neighbors=[AdjustmentLayerEngine]
- "video_adjustment_layer_engine_blend_mode_info": "BLEND_MODE_INFO" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L35 | neighbors=[adjustment-layer-engine.ts]
- "video_adjustment_layer_engine_createadjustmentlayeroptions": "CreateAdjustmentLayerOptions" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L20 | neighbors=[adjustment-layer-engine.ts]
- "video_adjustment_layer_engine_resetadjustmentlayerengine": "resetAdjustmentLayerEngine()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L334 | neighbors=[adjustment-layer-engine.ts]
- "video_animation_engine_animationengine_addkeyframe": ".addKeyframe()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L269 | neighbors=[AnimationEngine]
- "video_animation_engine_animationengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L324 | neighbors=[AnimationEngine]
- "video_animation_engine_animationengine_findkeyframeattime": ".findKeyframeAtTime()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L310 | neighbors=[AnimationEngine]
- "video_animation_engine_animationengine_getkeyframesforproperty": ".getKeyframesForProperty()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L304 | neighbors=[AnimationEngine]
- "video_animation_engine_animationengine_removekeyframe": ".removeKeyframe()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L282 | neighbors=[AnimationEngine]
- "video_animation_engine_animationengine_updatekeyframe": ".updateKeyframe()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L286 | neighbors=[AnimationEngine]
- "video_animation_engine_interpolationresult": "InterpolationResult" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L14 | neighbors=[animation-engine.ts]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_applyeffects": ".applyEffects()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L134 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_beginframe": ".beginFrame()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L39 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L14 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_createtexturefromimage": ".createTextureFromImage()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L125 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_destroy": ".destroy()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L33 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_getdevice": ".getDevice()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L163 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_getmemoryusage": ".getMemoryUsage()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L159 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L20 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_issupported": ".isSupported()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L29 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_ondevicelost": ".onDeviceLost()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L143 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_recreatedevice": ".recreateDevice()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L147 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_releasetexture": ".releaseTexture()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L130 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_renderlayer": ".renderLayer()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L45 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L152 | neighbors=[Canvas2DFallbackRenderer]
- "video_canvas2d_fallback_renderer_renderer": "Renderer" | kind=code-symbol | neighbors=[Canvas2DFallbackRenderer]
- "video_chroma_key_engine_chromakeyengine_clearallsettings": ".clearAllSettings()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L427 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_clearsettings": ".clearSettings()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L423 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L52 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_disablechromakey": ".disableChromaKey()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L84 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_getdimensions": ".getDimensions()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L419 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_getsettings": ".getSettings()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L151 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_isenabled": ".isEnabled()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L91 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengine_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L412 | neighbors=[ChromaKeyEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-115.json

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
