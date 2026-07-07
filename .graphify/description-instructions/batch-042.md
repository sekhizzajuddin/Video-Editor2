# Node Description Batch 43 of 128

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

- "animation_animation_schema_imageasset": "ImageAsset" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L37 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_imagefilter": "ImageFilter" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L196 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_layertype": "LayerType" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L62 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_lottieasset": "LottieAsset" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L56 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_maskconfig": "MaskConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L113 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_particleemitterconfig": "ParticleEmitterConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L276 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_pathshape": "PathShape" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L258 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_position": "Position" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L89 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_range": "Range" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L290 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_rangeoverlife": "RangeOverLife" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L295 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_rotationconfig": "RotationConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L307 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_scale": "Scale" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L94 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_shapedefinition": "ShapeDefinition" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L225 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_templatevariable": "TemplateVariable" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L377 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_textanimationconfig": "TextAnimationConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L165 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_textanimationpreset": "TextAnimationPreset" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L172 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_velocityconfig": "VelocityConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L300 | neighbors=[animation-schema.ts, index.ts]
- "animation_animation_schema_videoasset": "VideoAsset" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L44 | neighbors=[animation-schema.ts, index.ts]
- "animation_composition_renderer_compositionrenderer_applytransform": ".applyTransform()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L208 | neighbors=[CompositionRenderer, .renderLayer()]
- "animation_composition_renderer_compositionrenderer_creategradient": ".createGradient()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L315 | neighbors=[CompositionRenderer, .renderShapeLayer()]
- "animation_composition_renderer_compositionrenderer_interpolatevalue": ".interpolateValue()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L178 | neighbors=[CompositionRenderer, .evaluateKeyframes()]
- "animation_composition_renderer_compositionrenderer_loadimage": ".loadImage()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L402 | neighbors=[CompositionRenderer, .renderImageLayer()]
- "animation_composition_renderer_compositionrenderer_loadvideo": ".loadVideo()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L414 | neighbors=[CompositionRenderer, .renderVideoLayer()]
- "animation_composition_renderer_compositionrenderer_mapblendmode": ".mapBlendMode()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L426 | neighbors=[CompositionRenderer, .renderLayer()]
- "animation_composition_renderer_compositionrenderer_mapeasingname": ".mapEasingName()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L136 | neighbors=[CompositionRenderer, .applyEasing()]
- "animation_composition_renderer_compositionrenderer_renderbezierpath": ".renderBezierPath()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L284 | neighbors=[CompositionRenderer, .renderShapeLayer()]
- "animation_composition_renderer_compositionrenderer_renderframe": ".renderFrame()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L28 | neighbors=[CompositionRenderer, .renderLayer()]
- "animation_composition_renderer_compositionrenderer_renderpolygon": ".renderPolygon()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L270 | neighbors=[CompositionRenderer, .renderShapeLayer()]
- "animation_composition_renderer_compositionrenderer_rendertextwithletterspacing": ".renderTextWithLetterSpacing()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L357 | neighbors=[CompositionRenderer, .renderTextLayer()]
- "animation_composition_renderer_compositionrenderer_setnestedproperty": ".setNestedProperty()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L194 | neighbors=[CompositionRenderer, .evaluateTransform()]
- "animation_easing_functions_all_easing_names": "ALL_EASING_NAMES" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L335 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_cubicbeziereasing": "CubicBezierEasing" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L34 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_easing_categories": "EASING_CATEGORIES" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L344 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_easing_presets": "EASING_PRESETS" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L283 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_easingcategory": "EasingCategory" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L339 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_easingfn": "EasingFn" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L48 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_easingfunction": "EasingFunction" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L46 | neighbors=[easing-functions.ts, index.ts]
- "animation_easing_functions_springeasing": "SpringEasing" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L39 | neighbors=[easing-functions.ts, index.ts]
- "animation_gsap_engine_cubicbezierinterpolate": "cubicBezierInterpolate()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L124 | neighbors=[gsap-engine.ts, sampleMotionPath()]
- "animation_gsap_engine_easingtogsap": "easingToGSAP()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L73 | neighbors=[gsap-engine.ts, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-042.json

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
