# Node Description Batch 36 of 128

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

- "timeline_clip_manager_clipmanager_snaptogrid": ".snapToGrid()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L205 | neighbors=[ClipManager, .addClip(), .moveClip()]
- "timeline_clip_manager_clipmanager_splitclip": ".splitClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L441 | neighbors=[ClipManager, .createProjectWrapper(), .findClip()]
- "timeline_clip_manager_clipmanager_trimclip": ".trimClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L487 | neighbors=[ClipManager, .createProjectWrapper(), .findClip()]
- "timeline_nested_sequence_engine_generateid": "generateId()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L52 | neighbors=[nested-sequence-engine.ts, .createCompoundClip(), .duplicateCompoundClip()]
- "timeline_nested_sequence_engine_getnestedsequenceengine": "getNestedSequenceEngine()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L282 | neighbors=[index.ts, nested-sequence-engine.ts, NestedSequenceEngine]
- "timeline_track_manager_trackmanager_gettrack": ".getTrack()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L205 | neighbors=[TrackManager, .isTrackHidden(), .isTrackLocked()]
- "types_composition_composition": "Composition" | kind=code-symbol | source=packages/core/src/types/composition.ts:L242 | neighbors=[composition-renderer.ts, composition.ts, index.ts]
- "types_composition_imagelayer": "ImageLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L208 | neighbors=[composition-renderer.ts, composition.ts, BaseLayer]
- "types_composition_propertykeyframes": "PropertyKeyframes" | kind=code-symbol | source=packages/core/src/types/composition.ts:L143 | neighbors=[composition-renderer.ts, composition.ts, index.ts]
- "types_composition_shapelayer": "ShapeLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L185 | neighbors=[composition-renderer.ts, composition.ts, BaseLayer]
- "types_composition_textlayer": "TextLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L198 | neighbors=[composition-renderer.ts, composition.ts, BaseLayer]
- "types_composition_videolayer": "VideoLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L214 | neighbors=[composition-renderer.ts, composition.ts, BaseLayer]
- "types_effects_eqband": "EQBand" | kind=code-symbol | source=packages/core/src/types/effects.ts:L622 | neighbors=[audio-effects-engine.ts, audio-match-engine.ts, effects.ts]
- "types_index_clipanimations": "ClipAnimations" | kind=code-symbol | source=src/types/index.ts:L227 | neighbors=[index.ts, smartReframe.ts, titleTemplates.ts]
- "types_index_clipaudiosettings": "ClipAudioSettings" | kind=code-symbol | source=src/types/index.ts:L107 | neighbors=[PropertiesPanel.tsx, index.ts, audioSeparation.ts]
- "types_index_cliptextsettings": "ClipTextSettings" | kind=code-symbol | source=src/types/index.ts:L153 | neighbors=[editorStore.ts, index.ts, titleTemplates.ts]
- "types_index_cornerpoints": "CornerPoints" | kind=code-symbol | source=src/types/index.ts:L51 | neighbors=[PropertiesPanel.tsx, index.ts, motionTracker.ts]
- "types_index_editorstate": "EditorState" | kind=code-symbol | source=src/types/index.ts:L387 | neighbors=[Timeline.tsx, editorStore.ts, index.ts]
- "types_index_effect": "Effect" | kind=code-symbol | source=src/types/index.ts:L534 | neighbors=[action-executor.ts, generators.ts, index.ts]
- "types_index_mediatab": "MediaTab" | kind=code-symbol | source=src/types/index.ts:L516 | neighbors=[MediaPanel.tsx, editorStore.ts, index.ts]
- "types_index_mediatype": "MediaType" | kind=code-symbol | source=src/types/index.ts:L2 | neighbors=[MediaPanel.tsx, index.ts, mediaProbe.ts]
- "types_index_overlayerclip": "OverLayerClip" | kind=code-symbol | source=src/types/index.ts:L330 | neighbors=[Timeline.tsx, editorStore.ts, index.ts]
- "types_index_propertiestab": "PropertiesTab" | kind=code-symbol | source=src/types/index.ts:L519 | neighbors=[PropertiesPanel.tsx, editorStore.ts, index.ts]
- "types_index_propertykeyframe": "PropertyKeyframe" | kind=code-symbol | source=src/types/index.ts:L220 | neighbors=[index.ts, keyframes.ts, smartReframe.ts]
- "types_lottie_lottieellipseshape": "LottieEllipseShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L191 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottiefillshape": "LottieFillShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L206 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottiegroupshape": "LottieGroupShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L173 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottieimagelayer": "LottieImageLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L89 | neighbors=[index.ts, lottie.ts, BaseLottieLayer]
- "types_lottie_lottienulllayer": "LottieNullLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L94 | neighbors=[index.ts, lottie.ts, BaseLottieLayer]
- "types_lottie_lottiepathshape": "LottiePathShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L198 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottieprecomplayer": "LottiePrecompLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L74 | neighbors=[index.ts, lottie.ts, BaseLottieLayer]
- "types_lottie_lottierectshape": "LottieRectShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L183 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottieshapelayer": "LottieShapeLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L98 | neighbors=[index.ts, lottie.ts, BaseLottieLayer]
- "types_lottie_lottiesolidlayer": "LottieSolidLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L82 | neighbors=[index.ts, lottie.ts, BaseLottieLayer]
- "types_lottie_lottiestrokeshape": "LottieStrokeShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L214 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottietextlayer": "LottieTextLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L103 | neighbors=[index.ts, lottie.ts, BaseLottieLayer]
- "types_lottie_lottietransformshape": "LottieTransformShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L231 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_lottie_lottietrimshape": "LottieTrimShape" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L242 | neighbors=[index.ts, lottie.ts, BaseLottieShape]
- "types_project_mediametadata": "MediaMetadata" | kind=code-symbol | source=packages/core/src/types/project.ts:L59 | neighbors=[animation-importer.ts, media-import-service.ts, project.ts]
- "types_scriptable_template_extendedplaceholderconstraints": "ExtendedPlaceholderConstraints" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L51 | neighbors=[template-engine.ts, scriptable-template.ts, PlaceholderConstraints]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-035.json

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
