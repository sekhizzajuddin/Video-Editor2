# Node Description Batch 66 of 128

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

- "timeline_nested_sequence_engine_nestedsequenceengine_createcompoundclip": ".createCompoundClip()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L62 | neighbors=[NestedSequenceEngine, generateId()]
- "timeline_nested_sequence_engine_nestedsequenceengine_deleteinstance": ".deleteInstance()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L213 | neighbors=[NestedSequenceEngine, .flattenInstance()]
- "timeline_nested_sequence_engine_nestedsequenceengine_duplicatecompoundclip": ".duplicateCompoundClip()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L244 | neighbors=[NestedSequenceEngine, generateId()]
- "timeline_nested_sequence_engine_nestedsequenceengine_flatteninstance": ".flattenInstance()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L221 | neighbors=[NestedSequenceEngine, .deleteInstance()]
- "timeline_nested_sequence_engine_resetnestedsequenceengine": "resetNestedSequenceEngine()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L289 | neighbors=[index.ts, nested-sequence-engine.ts]
- "timeline_track_manager_canacceptmediatype": "canAcceptMediaType()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L293 | neighbors=[index.ts, track-manager.ts]
- "timeline_track_manager_clonetrack": "cloneTrack()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L274 | neighbors=[index.ts, track-manager.ts]
- "timeline_track_manager_createtrack": "createTrack()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L257 | neighbors=[index.ts, track-manager.ts]
- "timeline_track_manager_createtrackparams": "CreateTrackParams" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L11 | neighbors=[index.ts, track-manager.ts]
- "timeline_track_manager_gettrackclips": "getTrackClips()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L289 | neighbors=[index.ts, track-manager.ts]
- "timeline_track_manager_trackmanager_addtrack": ".addTrack()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L30 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanager_istrackhidden": ".isTrackHidden()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L229 | neighbors=[TrackManager, .getTrack()]
- "timeline_track_manager_trackmanager_istracklocked": ".isTrackLocked()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L224 | neighbors=[TrackManager, .getTrack()]
- "timeline_track_manager_trackmanager_removetrack": ".removeTrack()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L63 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanager_reordertrack": ".reorderTrack()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L85 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanager_settrackhidden": ".setTrackHidden()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L133 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanager_settracklocked": ".setTrackLocked()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L109 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanager_settrackmuted": ".setTrackMuted()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L157 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanager_settracksolo": ".setTrackSolo()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L181 | neighbors=[TrackManager, .createProjectWrapper()]
- "timeline_track_manager_trackmanageroptions": "TrackManagerOptions" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L6 | neighbors=[index.ts, track-manager.ts]
- "timeline_track_manager_trackoperationresult": "TrackOperationResult" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L17 | neighbors=[index.ts, track-manager.ts]
- "types_actions_actionresult": "ActionResult" | kind=code-symbol | source=packages/core/src/types/actions.ts:L17 | neighbors=[action-executor.ts, actions.ts]
- "types_actions_validationerror": "ValidationError" | kind=code-symbol | source=packages/core/src/types/actions.ts:L59 | neighbors=[action-validator.ts, actions.ts]
- "types_actions_validationresult": "ValidationResult" | kind=code-symbol | source=packages/core/src/types/actions.ts:L53 | neighbors=[action-validator.ts, actions.ts]
- "types_composition_audiobinding": "AudioBinding" | kind=code-symbol | source=packages/core/src/types/composition.ts:L155 | neighbors=[composition.ts, index.ts]
- "types_composition_audiolayer": "AudioLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L222 | neighbors=[composition.ts, BaseLayer]
- "types_composition_bezierpath": "BezierPath" | kind=code-symbol | source=packages/core/src/types/composition.ts:L45 | neighbors=[composition.ts, shape-tools.ts]
- "types_composition_bezierpoint": "BezierPoint" | kind=code-symbol | source=packages/core/src/types/composition.ts:L39 | neighbors=[composition.ts, shape-tools.ts]
- "types_composition_grouplayer": "GroupLayer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L229 | neighbors=[composition.ts, BaseLayer]
- "types_composition_keyframe": "Keyframe" | kind=code-symbol | source=packages/core/src/types/composition.ts:L136 | neighbors=[composition.ts, effects.ts]
- "types_composition_layer": "Layer" | kind=code-symbol | source=packages/core/src/types/composition.ts:L234 | neighbors=[composition-renderer.ts, composition.ts]
- "types_composition_template": "Template" | kind=code-symbol | source=packages/core/src/types/composition.ts:L280 | neighbors=[composition.ts, index.ts]
- "types_composition_templatecategory": "TemplateCategory" | kind=code-symbol | source=packages/core/src/types/composition.ts:L272 | neighbors=[composition.ts, index.ts]
- "types_composition_templatepreset": "TemplatePreset" | kind=code-symbol | source=packages/core/src/types/composition.ts:L296 | neighbors=[composition.ts, index.ts]
- "types_composition_textonpath": "TextOnPath" | kind=code-symbol | source=packages/core/src/types/composition.ts:L92 | neighbors=[composition.ts, index.ts]
- "types_composition_transform": "Transform" | kind=code-symbol | source=packages/core/src/types/composition.ts:L28 | neighbors=[composition-renderer.ts, composition.ts]
- "types_composition_variable": "Variable" | kind=code-symbol | source=packages/core/src/types/composition.ts:L259 | neighbors=[composition.ts, index.ts]
- "types_composition_variabletype": "VariableType" | kind=code-symbol | source=packages/core/src/types/composition.ts:L257 | neighbors=[composition.ts, index.ts]
- "types_effects_createdefaulteffect": "createDefaultEffect()" | kind=code-symbol | source=packages/core/src/types/effects.ts:L558 | neighbors=[effects.ts, getEffectDefinition()]
- "types_effects_curvepoint": "CurvePoint" | kind=code-symbol | source=packages/core/src/types/effects.ts:L616 | neighbors=[effects.ts, color-grading-engine.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-065.json

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
