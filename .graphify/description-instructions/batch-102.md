# Node Description Batch 103 of 128

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

- "text_caption_animation_renderer_easeoutbounce": "easeOutBounce()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L23 | neighbors=[caption-animation-renderer.ts]
- "text_caption_animation_renderer_getanimationstyledisplayname": "getAnimationStyleDisplayName()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L286 | neighbors=[caption-animation-renderer.ts]
- "text_caption_animation_renderer_wordsegment": "WordSegment" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L5 | neighbors=[caption-animation-renderer.ts]
- "text_caption_animation_renderer_wordsegmentstyle": "WordSegmentStyle" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L3 | neighbors=[caption-animation-renderer.ts]
- "text_character_animator_animatedtextlayout": "AnimatedTextLayout" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L64 | neighbors=[character-animator.ts]
- "text_character_animator_characteranimator_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L76 | neighbors=[CharacterAnimator]
- "text_character_animator_textlayout": "TextLayout" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L42 | neighbors=[character-animator.ts]
- "text_speech_to_text_engine_default_options": "DEFAULT_OPTIONS" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L129 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_default_subtitle_style": "DEFAULT_SUBTITLE_STYLE" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L136 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_eventtarget": "EventTarget" | kind=code-symbol | neighbors=[SpeechRecognitionInstance]
- "text_speech_to_text_engine_progresscallback": "ProgressCallback" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L90 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_segmentcallback": "SegmentCallback" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L91 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_speechrecognitionalternative": "SpeechRecognitionAlternative" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L10 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_speechrecognitionconstructor": "SpeechRecognitionConstructor" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L43 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_speechrecognitionresult": "SpeechRecognitionResult" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L4 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_speechrecognitionresultlist": "SpeechRecognitionResultList" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L15 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_speechtotextengine_clearsegments": ".clearSegments()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L432 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_getsegments": ".getSegments()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L428 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_getsupportedlanguages": ".getSupportedLanguages()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L163 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_isactive": ".isActive()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L436 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_onprogress": ".onProgress()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L275 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_onsegment": ".onSegment()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L279 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_segmentstosubtitles": ".segmentsToSubtitles()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L410 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextengine_transcribeaudioelement": ".transcribeAudioElement()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L336 | neighbors=[SpeechToTextEngine]
- "text_speech_to_text_engine_speechtotextoptions": "SpeechToTextOptions" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L68 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_supported_languages": "SUPPORTED_LANGUAGES" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L93 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_transcriptionprogress": "TranscriptionProgress" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L82 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_transcriptionresult": "TranscriptionResult" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L61 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_transcriptionsegment": "TranscriptionSegment" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L54 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_transcriptionstatus": "TranscriptionStatus" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L75 | neighbors=[speech-to-text-engine.ts]
- "text_speech_to_text_engine_window": "Window" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L48 | neighbors=[speech-to-text-engine.ts]
- "text_subtitle_engine_default_subtitle_style": "DEFAULT_SUBTITLE_STYLE" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L3 | neighbors=[subtitle-engine.ts]
- "text_subtitle_engine_srtparseerror": "SRTParseError" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L70 | neighbors=[subtitle-engine.ts]
- "text_subtitle_engine_srtparseresult": "SRTParseResult" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L64 | neighbors=[subtitle-engine.ts]
- "text_subtitle_engine_subtitle_style_presets": "SUBTITLE_STYLE_PRESETS" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L11 | neighbors=[subtitle-engine.ts]
- "text_subtitle_engine_subtitleengine_clearallsubtitles": ".clearAllSubtitles()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L550 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_exportsrt": ".exportSRT()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L289 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_getstylepreset": ".getStylePreset()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L561 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_getstylepresets": ".getStylePresets()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L557 | neighbors=[SubtitleEngine]
- "text_subtitle_engine_subtitleengine_getsubtitleattime": ".getSubtitleAtTime()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L425 | neighbors=[SubtitleEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-102.json

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
