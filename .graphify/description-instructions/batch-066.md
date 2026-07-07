# Node Description Batch 67 of 128

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

- "types_effects_geteffectdefinition": "getEffectDefinition()" | kind=code-symbol | source=packages/core/src/types/effects.ts:L546 | neighbors=[effects.ts, createDefaultEffect()]
- "types_effects_layereffecttype": "LayerEffectType" | kind=code-symbol | source=packages/core/src/types/effects.ts:L3 | neighbors=[types.ts, effects.ts]
- "types_effects_transitionparams": "TransitionParams" | kind=code-symbol | source=packages/core/src/types/effects.ts:L760 | neighbors=[effects.ts, transition-engine.ts]
- "types_index_clipcolorfilters": "ClipColorFilters" | kind=code-symbol | source=src/types/index.ts:L93 | neighbors=[index.ts, autoColor.ts]
- "types_index_clipkenburnssettings": "ClipKenBurnsSettings" | kind=code-symbol | source=src/types/index.ts:L259 | neighbors=[PropertiesPanel.tsx, index.ts]
- "types_index_clipparticlesettings": "ClipParticleSettings" | kind=code-symbol | source=src/types/index.ts:L192 | neighbors=[index.ts, canvasEffects.ts]
- "types_index_editorsnapshot": "EditorSnapshot" | kind=code-symbol | source=src/types/index.ts:L506 | neighbors=[editorStore.ts, index.ts]
- "types_index_lutdata": "LutData" | kind=code-symbol | source=src/types/index.ts:L5 | neighbors=[index.ts, lutParser.ts]
- "types_index_projecttemplate": "ProjectTemplate" | kind=code-symbol | source=src/types/index.ts:L541 | neighbors=[editorStore.ts, index.ts]
- "types_index_speedrampkeyframe": "SpeedRampKeyframe" | kind=code-symbol | source=src/types/index.ts:L215 | neighbors=[index.ts, speedRamp.ts]
- "types_lottie_default_lottie_export_options": "DEFAULT_LOTTIE_EXPORT_OPTIONS" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L374 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieanimatedproperty": "LottieAnimatedProperty" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L122 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieanimation": "LottieAnimation" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L1 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieasset": "LottieAsset" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L30 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiebezier": "LottieBezier" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L144 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiecompatibilityerror": "LottieCompatibilityError" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L357 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiecompatibilityresult": "LottieCompatibilityResult" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L342 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiecompatibilitywarning": "LottieCompatibilityWarning" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L350 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieexportoptions": "LottieExportOptions" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L365 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiefeature": "LottieFeature" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L327 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieimageasset": "LottieImageAsset" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L32 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiekeyframe": "LottieKeyframe" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L135 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottielayer": "LottieLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L47 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiemarker": "LottieMarker" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L24 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiemask": "LottieMask" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L149 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiemeta": "LottieMeta" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L16 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieprecompasset": "LottiePrecompAsset" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L41 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieseparatedproperty": "LottieSeparatedProperty" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L129 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottieshape": "LottieShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L157 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottiestrokedash": "LottieStrokeDash" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L226 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextalignmentoptions": "LottieTextAlignmentOptions" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L286 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextanimator": "LottieTextAnimator" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L291 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextanimatorproperties": "LottieTextAnimatorProperties" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L297 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextdata": "LottieTextData" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L250 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextdocument": "LottieTextDocument" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L257 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextdocumentkeyframe": "LottieTextDocumentKeyframe" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L261 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextmoreoptions": "LottieTextMoreOptions" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L279 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietextselector": "LottieTextSelector" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L312 | neighbors=[index.ts, lottie.ts]
- "types_lottie_lottietransform": "LottieTransform" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L108 | neighbors=[index.ts, lottie.ts]
- "types_scriptable_template_extendedplaceholder": "ExtendedPlaceholder" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L61 | neighbors=[template-engine.ts, scriptable-template.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-066.json

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
