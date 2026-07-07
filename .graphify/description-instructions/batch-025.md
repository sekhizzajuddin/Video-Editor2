# Node Description Batch 26 of 128

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

- "animation_animation_importer_animationimporter_processimagelayer": ".processImageLayer()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L445 | neighbors=[AnimationImporter, .convertAnimationsToKeyframes(), .processLayer()]
- "animation_animation_importer_animationimporter_processvideolayer": ".processVideoLayer()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L486 | neighbors=[AnimationImporter, .processLayer(), .convertAnimationsToKeyframes()]
- "animation_animation_importer_importanimationfromjson": "importAnimationFromJSON()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L567 | neighbors=[animation-importer.ts, importAnimation(), index.ts]
- "animation_animation_schema_animationtemplate": "AnimationTemplate" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L388 | neighbors=[animation-schema.ts, AnimationSchema, index.ts]
- "animation_animation_schema_assetdefinitions": "AssetDefinitions" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L21 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_audioconfig": "AudioConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L363 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_audiotrackconfig": "AudioTrackConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L367 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_ellipseshape": "EllipseShape" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L239 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_grouplayer": "GroupLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L312 | neighbors=[animation-schema.ts, BaseLayer, index.ts]
- "animation_animation_schema_keyframedefinition": "KeyframeDefinition" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L357 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_lottielayer": "LottieLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L264 | neighbors=[animation-schema.ts, BaseLayer, index.ts]
- "animation_animation_schema_particlelayer": "ParticleLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L271 | neighbors=[animation-schema.ts, BaseLayer, index.ts]
- "animation_animation_schema_polygonshape": "PolygonShape" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L245 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_projectconfig": "ProjectConfig" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L12 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_rectangleshape": "RectangleShape" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L232 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_shadowstyle": "ShadowStyle" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L158 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_starshape": "StarShape" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L251 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_strokestyle": "StrokeStyle" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L151 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_substitutevariables": "substituteVariables()" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L466 | neighbors=[animation-importer.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_textstyle": "TextStyle" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L125 | neighbors=[animation-exporter.ts, animation-schema.ts, index.ts]
- "animation_animation_schema_validateanimationschema": "validateAnimationSchema()" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L425 | neighbors=[animation-importer.ts, animation-schema.ts, index.ts]
- "animation_composition_renderer_compositionrenderer_applyeasing": ".applyEasing()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L130 | neighbors=[CompositionRenderer, .mapEasingName(), .evaluateKeyframes()]
- "animation_composition_renderer_compositionrenderer_renderimagelayer": ".renderImageLayer()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L371 | neighbors=[CompositionRenderer, .loadImage(), .renderLayer()]
- "animation_composition_renderer_compositionrenderer_rendertextlayer": ".renderTextLayer()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L342 | neighbors=[CompositionRenderer, .renderLayer(), .renderTextWithLetterSpacing()]
- "animation_composition_renderer_compositionrenderer_rendervideolayer": ".renderVideoLayer()" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L386 | neighbors=[CompositionRenderer, .renderLayer(), .loadVideo()]
- "animation_easing_functions_cubicbezier": "cubicBezier()" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L165 | neighbors=[easing-functions.ts, getEasingFunction(), index.ts]
- "animation_easing_functions_interpolate": "interpolate()" | kind=code-symbol | source=packages/core/src/animation/easing-functions.ts:L272 | neighbors=[easing-functions.ts, getEasingFunction(), index.ts]
- "animation_gsap_engine_catmullrominterpolate": "catmullRomInterpolate()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L168 | neighbors=[gsap-engine.ts, .samplePositionAtTime(), index.ts]
- "animation_gsap_engine_disposegsapengine": "disposeGSAPEngine()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L481 | neighbors=[gsap-engine.ts, .dispose(), index.ts]
- "animation_gsap_engine_generatebezierpath": "generateBezierPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L205 | neighbors=[gsap-engine.ts, .getSVGPath(), index.ts]
- "animation_gsap_engine_getgsapengine": "getGSAPEngine()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L474 | neighbors=[gsap-engine.ts, GSAPAnimationEngine, index.ts]
- "animation_gsap_engine_gsapanimationengine_samplepositionattime": ".samplePositionAtTime()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L413 | neighbors=[GSAPAnimationEngine, catmullRomInterpolate(), sampleMotionPath()]
- "animation_gsap_engine_keyframestomotionpath": "keyframesToMotionPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L267 | neighbors=[gsap-engine.ts, generateDefaultControlPoints(), index.ts]
- "assembly_index_quickselect": "quickSelect()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L83 | neighbors=[index.ts, calculateMedian(), partition()]
- "audio_audio_effect_routing_getpreviewaudioeffects": "getPreviewAudioEffects()" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L47 | neighbors=[audio-effect-routing.ts, audio-effect-routing.test.ts, playback-controller.ts]
- "audio_audio_effects_engine_audioeffectsengine_applyeffectchain": ".applyEffectChain()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L700 | neighbors=[AudioEffectsEngine, .buildEffectChain(), .ensureInitialized()]
- "audio_audio_effects_engine_audioeffectsengine_applynoisereductionwithprofile": ".applyNoiseReductionWithProfile()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1107 | neighbors=[AudioEffectsEngine, .applyNoiseReductionWithProfileData(), .ensureInitialized()]
- "audio_audio_effects_engine_audioeffectsengine_buildeffectchain": ".buildEffectChain()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L738 | neighbors=[AudioEffectsEngine, .applyEffectChain(), .createEffectNode()]
- "audio_audio_effects_engine_audioeffectsengine_createcompressornodepair": ".createCompressorNodePair()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L851 | neighbors=[AudioEffectsEngine, .createCompressorNode(), .createEffectNode()]
- "audio_audio_effects_engine_audioeffectsengine_creategainnodepair": ".createGainNodePair()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1008 | neighbors=[AudioEffectsEngine, .createEffectNode(), .createGainNode()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-025.json

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
