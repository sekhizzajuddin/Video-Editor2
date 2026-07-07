# Node Description Batch 107 of 128

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

- "types_result_result": "Result" | kind=code-symbol | source=packages/core/src/types/result.ts:L1 | neighbors=[result.ts]
- "types_result_unwrap": "unwrap()" | kind=code-symbol | source=packages/core/src/types/result.ts:L25 | neighbors=[result.ts]
- "types_result_unwrapor": "unwrapOr()" | kind=code-symbol | source=packages/core/src/types/result.ts:L34 | neighbors=[result.ts]
- "types_scriptable_template_convertlegacyplaceholder": "convertLegacyPlaceholder()" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L286 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_createprojectsettingsfrompreset": "createProjectSettingsFromPreset()" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L315 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_extendedplaceholderreplacement": "ExtendedPlaceholderReplacement" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L247 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_extendedplaceholdertype": "ExtendedPlaceholderType" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L9 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_getpresetforcategory": "getPresetForCategory()" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L309 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_isextendedplaceholder": "isExtendedPlaceholder()" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L277 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_placeholderconstraints": "PlaceholderConstraints" | kind=code-symbol | neighbors=[ExtendedPlaceholderConstraints]
- "types_scriptable_template_placeholdergroup": "PlaceholderGroup" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L269 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_placeholderuihints": "PlaceholderUIHints" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L33 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_social_media_category_info": "SOCIAL_MEDIA_CATEGORY_INFO" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L327 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_social_media_presets": "SOCIAL_MEDIA_PRESETS" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L105 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_socialmediacategory": "SocialMediaCategory" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L73 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_socialmediapreset": "SocialMediaPreset" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L91 | neighbors=[scriptable-template.ts]
- "types_scriptable_template_templatescene": "TemplateScene" | kind=code-symbol | source=packages/core/src/types/scriptable-template.ts:L217 | neighbors=[scriptable-template.ts]
- "types_sound_library_mood_tags": "MOOD_TAGS" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L115 | neighbors=[sound-library.ts]
- "types_sound_library_music_genres": "MUSIC_GENRES" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L86 | neighbors=[sound-library.ts]
- "types_sound_library_sfx_categories": "SFX_CATEGORIES" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L101 | neighbors=[sound-library.ts]
- "types_template_clip": "Clip" | kind=code-symbol | neighbors=[TemplateClip]
- "types_template_placeholderreplacement": "PlaceholderReplacement" | kind=code-symbol | source=packages/core/src/types/template.ts:L79 | neighbors=[template.ts]
- "types_template_placeholdertype": "PlaceholderType" | kind=code-symbol | source=packages/core/src/types/template.ts:L55 | neighbors=[template.ts]
- "types_template_subtitle": "Subtitle" | kind=code-symbol | neighbors=[TemplateSubtitle]
- "types_template_template_categories": "TEMPLATE_CATEGORIES" | kind=code-symbol | source=packages/core/src/types/template.ts:L94 | neighbors=[template.ts]
- "types_timeline_appliededitingtemplate": "AppliedEditingTemplate" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L48 | neighbors=[timeline.ts]
- "types_timeline_editingtemplateapplicationsource": "EditingTemplateApplicationSource" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L40 | neighbors=[timeline.ts]
- "types_timeline_effectmetadata": "EffectMetadata" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L65 | neighbors=[timeline.ts]
- "types_timeline_fitmode": "FitMode" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L117 | neighbors=[timeline.ts]
- "types_timeline_marker": "Marker" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L183 | neighbors=[timeline.ts]
- "types_timeline_subtitleword": "SubtitleWord" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L208 | neighbors=[timeline.ts]
- "types_timeline_timelinebeatanalysis": "TimelineBeatAnalysis" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L21 | neighbors=[timeline.ts]
- "types_timeline_timelinebeatmarker": "TimelineBeatMarker" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L14 | neighbors=[timeline.ts]
- "types_transform_3d_autoorientmode": "AutoOrientMode" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L35 | neighbors=[transform-3d.ts]
- "types_transform_3d_camera": "Camera" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L11 | neighbors=[transform-3d.ts]
- "types_transform_3d_createcamera": "createCamera()" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L63 | neighbors=[transform-3d.ts]
- "types_transform_3d_createlayer3dconfig": "createLayer3DConfig()" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L72 | neighbors=[transform-3d.ts]
- "types_transform_3d_default_camera": "DEFAULT_CAMERA" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L55 | neighbors=[transform-3d.ts]
- "types_transform_3d_default_transform_3d": "DEFAULT_TRANSFORM_3D" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L47 | neighbors=[transform-3d.ts]
- "types_transform_3d_depthoffieldconfig": "DepthOfFieldConfig" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L21 | neighbors=[transform-3d.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-106.json

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
