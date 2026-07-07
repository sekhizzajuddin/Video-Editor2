# Node Description Batch 105 of 128

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

- "text_types_textdecoration": "TextDecoration" | kind=code-symbol | source=packages/core/src/text/types.ts:L93 | neighbors=[types.ts]
- "text_types_verticalalign": "VerticalAlign" | kind=code-symbol | source=packages/core/src/text/types.ts:L91 | neighbors=[types.ts]
- "timeline_clip_manager_clipmanager_cantrackacceptclip": ".canTrackAcceptClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L394 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L46 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_getexecutor": ".getExecutor()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L437 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_getgridsize": ".getGridSize()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L425 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_getoverlappingclips": ".getOverlappingClips()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L361 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_getsnapthreshold": ".getSnapThreshold()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L433 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_issnaptogridenabled": ".isSnapToGridEnabled()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L417 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_setgridsize": ".setGridSize()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L421 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_setsnapthreshold": ".setSnapThreshold()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L429 | neighbors=[ClipManager]
- "timeline_clip_manager_clipmanager_setsnaptogrid": ".setSnapToGrid()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L413 | neighbors=[ClipManager]
- "timeline_clip_manager_test_createmockclip": "createMockClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.test.ts:L5 | neighbors=[clip-manager.test.ts]
- "timeline_nested_sequence_engine_compound_colors": "COMPOUND_COLORS" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L41 | neighbors=[nested-sequence-engine.ts]
- "timeline_nested_sequence_engine_nestedsequenceengine_clearall": ".clearAll()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L272 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_createinstance": ".createInstance()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L148 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_deletecompoundclip": ".deleteCompoundClip()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L138 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getallcompoundclips": ".getAllCompoundClips()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L108 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getallinstances": ".getAllInstances()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L195 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getcompoundclip": ".getCompoundClip()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L104 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getcompoundclipforinstance": ".getCompoundClipForInstance()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L262 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getinstance": ".getInstance()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L180 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getinstancecount": ".getInstanceCount()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L268 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_getinstancesforcompound": ".getInstancesForCompound()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L184 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_renamecompoundclip": ".renameCompoundClip()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L125 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_updatecompoundclip": ".updateCompoundClip()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L112 | neighbors=[NestedSequenceEngine]
- "timeline_nested_sequence_engine_nestedsequenceengine_updateinstance": ".updateInstance()" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L199 | neighbors=[NestedSequenceEngine]
- "timeline_track_manager_trackmanager_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L26 | neighbors=[TrackManager]
- "timeline_track_manager_trackmanager_getexecutor": ".getExecutor()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L234 | neighbors=[TrackManager]
- "timeline_track_manager_trackmanager_gettracksbytype": ".getTracksByType()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L209 | neighbors=[TrackManager]
- "timeline_track_manager_trackmanager_getunlockedtracks": ".getUnlockedTracks()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L220 | neighbors=[TrackManager]
- "timeline_track_manager_trackmanager_getvisibletracks": ".getVisibleTracks()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L216 | neighbors=[TrackManager]
- "types_actions_actionerror": "ActionError" | kind=code-symbol | source=packages/core/src/types/actions.ts:L45 | neighbors=[actions.ts]
- "types_actions_actionerrorcode": "ActionErrorCode" | kind=code-symbol | source=packages/core/src/types/actions.ts:L25 | neighbors=[actions.ts]
- "types_composition_blendmode": "BlendMode" | kind=code-symbol | source=packages/core/src/types/composition.ts:L1 | neighbors=[composition.ts]
- "types_composition_fillstyle": "FillStyle" | kind=code-symbol | source=packages/core/src/types/composition.ts:L50 | neighbors=[composition.ts]
- "types_composition_layertype": "LayerType" | kind=code-symbol | source=packages/core/src/types/composition.ts:L163 | neighbors=[composition.ts]
- "types_composition_marker": "Marker" | kind=code-symbol | source=packages/core/src/types/composition.ts:L148 | neighbors=[composition.ts]
- "types_composition_strokestyle": "StrokeStyle" | kind=code-symbol | source=packages/core/src/types/composition.ts:L61 | neighbors=[composition.ts]
- "types_composition_textanimation": "TextAnimation" | kind=code-symbol | source=packages/core/src/types/composition.ts:L83 | neighbors=[composition.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-104.json

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
