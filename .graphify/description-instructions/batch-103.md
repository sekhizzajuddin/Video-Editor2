# Node Description Batch 104 of 128

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

- "text_subtitle_engine_subtitleengine_getsubtitlesinrange": ".getSubtitlesInRange()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L432 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_removesubtitle": ".removeSubtitle()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L368 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_setsubtitlestyle": ".setSubtitleStyle()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L398 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_shiftallsubtitles": ".shiftAllSubtitles()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L446 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_updatesubtitle": ".updateSubtitle()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L324 | neighbors=[SubtitleEngine]
- "text_text_animation_animatedtextstate": "AnimatedTextState" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L11 | neighbors=[text-animation.ts]
- "text_text_animation_characteranimationstate": "CharacterAnimationState" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L19 | neighbors=[text-animation.ts]
- "text_text_animation_presets_animation_map": "ANIMATION_MAP" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L497 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_animationfn": "AnimationFn" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L42 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_bounceanimation": "bounceAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L241 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_default_state": "DEFAULT_STATE" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L54 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_glitchanimation": "glitchAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L364 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_popanimation": "popAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L334 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_rainbowanimation": "rainbowAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L483 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_shakeanimation": "shakeAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L317 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_slideanimation": "slideAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L127 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_text_animation_presets": "TEXT_ANIMATION_PRESETS" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L539 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_textanimationpresetinfo": "TextAnimationPresetInfo" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L527 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_typewriteranimation": "typewriterAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L63 | neighbors=[text-animation-presets.ts]
- "text_text_animation_presets_waveanimation": "waveAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L301 | neighbors=[text-animation-presets.ts]
- "text_text_animation_textanimationengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L32 | neighbors=[TextAnimationEngine]
- "text_text_animation_textanimationengine_getavailablepresets": ".getAvailablePresets()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L841 | neighbors=[TextAnimationEngine]
- "text_title_engine_createtextclipoptions": "CreateTextClipOptions" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L13 | neighbors=[title-engine.ts]
- "text_title_engine_titleengine_addkeyframe": ".addKeyframe()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L164 | neighbors=[TitleEngine]
- "text_title_engine_titleengine_deletetextclip": ".deleteTextClip()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L160 | neighbors=[TitleEngine]
- "text_title_engine_titleengine_exporttextclips": ".exportTextClips()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L491 | neighbors=[TitleEngine]
- "text_title_engine_titleengine_getalltextclips": ".getAllTextClips()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L97 | neighbors=[TitleEngine]
- "text_title_engine_titleengine_gettextclip": ".getTextClip()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L93 | neighbors=[TitleEngine]
- "text_title_engine_titleengine_gettextclipsfortrack": ".getTextClipsForTrack()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L101 | neighbors=[TitleEngine]
- "text_title_engine_titleengine_removekeyframe": ".removeKeyframe()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L192 | neighbors=[TitleEngine]
- "text_title_engine_updatetextclipoptions": "UpdateTextClipOptions" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L25 | neighbors=[title-engine.ts]
- "text_transcription_service_cloudflarewhisperresponse": "CloudflareWhisperResponse" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L10 | neighbors=[transcription-service.ts]
- "text_transcription_service_cloudflarewhisperword": "CloudflareWhisperWord" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L4 | neighbors=[transcription-service.ts]
- "text_transcription_service_default_subtitle_style": "DEFAULT_SUBTITLE_STYLE" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L38 | neighbors=[transcription-service.ts]
- "text_transcription_service_gettranscriptionservice": "getTranscriptionService()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L411 | neighbors=[transcription-service.ts]
- "text_transcription_service_transcriptionconfig": "TranscriptionConfig" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L29 | neighbors=[transcription-service.ts]
- "text_transcription_service_transcriptionservice_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L50 | neighbors=[TranscriptionService]
- "text_transcription_service_whispertranscriptionprogress": "WhisperTranscriptionProgress" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L17 | neighbors=[transcription-service.ts]
- "text_types_text3dsettings": "Text3DSettings" | kind=code-symbol | source=packages/core/src/text/types.ts:L33 | neighbors=[types.ts]
- "text_types_textalign": "TextAlign" | kind=code-symbol | source=packages/core/src/text/types.ts:L89 | neighbors=[types.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-103.json

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
