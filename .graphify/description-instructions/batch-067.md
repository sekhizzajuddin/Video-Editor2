# Node Description Batch 68 of 128

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

- "types_scriptable_template_placeholdertarget": "PlaceholderTarget" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L25 | neighbors=[template-engine.ts, scriptable-template.ts]
- "types_scriptable_template_scriptabletemplate": "ScriptableTemplate" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L225 | neighbors=[template-engine.ts, scriptable-template.ts]
- "types_scriptable_template_scriptabletemplatereplacements": "ScriptableTemplateReplacements" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L253 | neighbors=[template-engine.ts, scriptable-template.ts]
- "types_scriptable_template_templateapplicationresult": "TemplateApplicationResult" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L263 | neighbors=[template-engine.ts, scriptable-template.ts]
- "types_scriptable_template_templatevalidationerror": "TemplateValidationError" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L257 | neighbors=[template-engine.ts, scriptable-template.ts]
- "types_shape_tools_createdefaultellipseconfig": "createDefaultEllipseConfig()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L111 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaultlineconfig": "createDefaultLineConfig()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L152 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaultpenconfig": "createDefaultPenConfig()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L163 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaultpolygonconfig": "createDefaultPolygonConfig()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L122 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaultrectangleconfig": "createDefaultRectangleConfig()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L99 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaultshapetoolstate": "createDefaultShapeToolState()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L88 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaultstarconfig": "createDefaultStarConfig()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L136 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_createdefaulttrimpath": "createDefaultTrimPath()" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L173 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_ellipseshapeconfig": "EllipseShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L37 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_lineshapeconfig": "LineShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L60 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_penshapeconfig": "PenShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L66 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_polygonshapeconfig": "PolygonShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L43 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_rectangleshapeconfig": "RectangleShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L30 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_shapeconfig": "ShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L71 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_shapemergeoperation": "ShapeMergeOperation" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L11 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_shapetool": "ShapeTool" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L3 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_shapetoolstate": "ShapeToolState" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L79 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_starshapeconfig": "StarShapeConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L51 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_strokeanimationconfig": "StrokeAnimationConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L24 | neighbors=[index.ts, shape-tools.ts]
- "types_shape_tools_trimpathconfig": "TrimPathConfig" | kind=code-symbol | source=packages/core/src/types/shape-tools.ts:L17 | neighbors=[index.ts, shape-tools.ts]
- "types_sound_library_beatmarker": "BeatMarker" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L73 | neighbors=[sound-library-engine.ts, sound-library.ts]
- "types_sound_library_moodtag": "MoodTag" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L30 | neighbors=[sound-generator.ts, sound-library.ts]
- "types_sound_library_sfxcategory": "SFXCategory" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L17 | neighbors=[sound-library-engine.ts, sound-library.ts]
- "types_sound_library_soundanalysis": "SoundAnalysis" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L79 | neighbors=[sound-library-engine.ts, sound-library.ts]
- "types_sound_library_soundcategory": "SoundCategory" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L1 | neighbors=[sound-library-engine.ts, sound-library.ts]
- "types_sound_library_soundlibraryfilter": "SoundLibraryFilter" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L62 | neighbors=[sound-library-engine.ts, sound-library.ts]
- "types_template_placeholderconstraints": "PlaceholderConstraints" | kind=code-symbol | source=packages/core/src/types/template.ts:L67 | neighbors=[scriptable-template.ts, template.ts]
- "types_template_template": "Template" | kind=code-symbol | source=packages/core/src/types/template.ts:L4 | neighbors=[template-engine.ts, template.ts]
- "types_template_templatereplacements": "TemplateReplacements" | kind=code-symbol | source=packages/core/src/types/template.ts:L75 | neighbors=[template-engine.ts, template.ts]
- "types_template_templatesummary": "TemplateSummary" | kind=code-symbol | source=packages/core/src/types/template.ts:L85 | neighbors=[template-engine.ts, template.ts]
- "types_template_templatetimeline": "TemplateTimeline" | kind=code-symbol | source=packages/core/src/types/template.ts:L33 | neighbors=[template-engine.ts, template.ts]
- "types_template_templatetrack": "TemplateTrack" | kind=code-symbol | source=packages/core/src/types/template.ts:L41 | neighbors=[template-engine.ts, template.ts]
- "types_timeline_captionanimationstyle": "CaptionAnimationStyle" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L200 | neighbors=[caption-animation-renderer.ts, timeline.ts]
- "types_transitions_cliptransition": "ClipTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L104 | neighbors=[index.ts, transitions.ts]
- "types_transitions_cliptransitiontype": "ClipTransitionType" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L3 | neighbors=[index.ts, transitions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-067.json

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
