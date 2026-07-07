# Node Description Batch 63 of 128

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

- "template_template_engine_createtemplateengine": "createTemplateEngine()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1948 | neighbors=[template-engine.ts, TemplateEngine]
- "template_template_engine_templateengine_applytemplate": ".applyTemplate()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1209 | neighbors=[TemplateEngine, .createMediaFromReplacements()]
- "template_template_engine_templateengine_converttotemplatetimeline": ".convertToTemplateTimeline()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1169 | neighbors=[TemplateEngine, .createFromProject()]
- "template_template_engine_templateengine_createfromproject": ".createFromProject()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1135 | neighbors=[TemplateEngine, .convertToTemplateTimeline()]
- "template_template_engine_templateengine_createmediafromreplacements": ".createMediaFromReplacements()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1290 | neighbors=[TemplateEngine, .applyTemplate()]
- "template_template_engine_templateengine_createmediafromscriptablereplacements": ".createMediaFromScriptableReplacements()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1767 | neighbors=[TemplateEngine, .applyScriptableTemplate()]
- "template_template_engine_templateengine_deletetemplate": ".deleteTemplate()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1852 | neighbors=[TemplateEngine, .initialize()]
- "template_template_engine_templateengine_listtemplates": ".listTemplates()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1875 | neighbors=[TemplateEngine, .initialize()]
- "template_template_engine_templateengine_loadtemplate": ".loadTemplate()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1826 | neighbors=[TemplateEngine, .initialize()]
- "template_template_engine_templateengine_resolvepropertypath": ".resolvePropertyPath()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1376 | neighbors=[TemplateEngine, .setPropertyByPath()]
- "template_template_engine_templateengine_savetemplate": ".saveTemplate()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1807 | neighbors=[TemplateEngine, .initialize()]
- "template_template_engine_templateengine_validateplaceholdervalue": ".validatePlaceholderValue()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1448 | neighbors=[TemplateEngine, .applyScriptableTemplate()]
- "test_index": "index.ts" | kind=code-symbol | source=packages/core/src/test/index.ts:L1 | neighbors=[fc-config.ts, generators.ts]
- "text_audio_text_sync_engine_beatsyncengine_calculatesyncedtimings": ".calculateSyncedTimings()" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L65 | neighbors=[BeatSyncEngine, .getSubdividedBeats()]
- "text_audio_text_sync_engine_beatsyncengine_getsubdividedbeats": ".getSubdividedBeats()" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L144 | neighbors=[BeatSyncEngine, .calculateSyncedTimings()]
- "text_audio_text_sync_engine_getbeatsyncengine": "getBeatSyncEngine()" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L198 | neighbors=[audio-text-sync-engine.ts, BeatSyncEngine]
- "text_character_animator_animatedcharacter": "AnimatedCharacter" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L50 | neighbors=[character-animator.ts, CharacterInfo]
- "text_character_animator_animatedline": "AnimatedLine" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L59 | neighbors=[character-animator.ts, LineInfo]
- "text_character_animator_animatedword": "AnimatedWord" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L54 | neighbors=[character-animator.ts, WordInfo]
- "text_character_animator_characteranimator_createfallbacklayout": ".createFallbackLayout()" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L196 | neighbors=[CharacterAnimator, .measureText()]
- "text_character_animator_characterinfo": "CharacterInfo" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L9 | neighbors=[character-animator.ts, AnimatedCharacter]
- "text_character_animator_lineinfo": "LineInfo" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L32 | neighbors=[character-animator.ts, AnimatedLine]
- "text_character_animator_wordinfo": "WordInfo" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L20 | neighbors=[character-animator.ts, AnimatedWord]
- "text_speech_to_text_engine_createspeechtotextengine": "createSpeechToTextEngine()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L459 | neighbors=[speech-to-text-engine.ts, SpeechToTextEngine]
- "text_speech_to_text_engine_event": "Event" | kind=code-symbol | neighbors=[SpeechRecognitionErrorEvent, SpeechRecognitionEvent]
- "text_speech_to_text_engine_speechrecognitionerrorevent": "SpeechRecognitionErrorEvent" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L25 | neighbors=[speech-to-text-engine.ts, Event]
- "text_speech_to_text_engine_speechrecognitionevent": "SpeechRecognitionEvent" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L20 | neighbors=[speech-to-text-engine.ts, Event]
- "text_speech_to_text_engine_speechrecognitioninstance": "SpeechRecognitionInstance" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L30 | neighbors=[speech-to-text-engine.ts, EventTarget]
- "text_speech_to_text_engine_speechtotextengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L167 | neighbors=[SpeechToTextEngine, .initRecognition()]
- "text_speech_to_text_engine_speechtotextengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L440 | neighbors=[SpeechToTextEngine, .stopTranscription()]
- "text_speech_to_text_engine_speechtotextengine_getcurrenttime": ".getCurrentTime()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L245 | neighbors=[SpeechToTextEngine, .reportProgress()]
- "text_speech_to_text_engine_speechtotextengine_issupported": ".isSupported()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L156 | neighbors=[SpeechToTextEngine, .initRecognition()]
- "text_speech_to_text_engine_speechtotextengine_setoptions": ".setOptions()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L261 | neighbors=[SpeechToTextEngine, .applyOptions()]
- "text_speech_to_text_engine_speechtotextengine_setuprecognitionhandlers": ".setupRecognitionHandlers()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L187 | neighbors=[SpeechToTextEngine, .initRecognition()]
- "text_subtitle_engine_exportsrt": "exportSRT()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L245 | neighbors=[subtitle-engine.ts, formatSRTTimestamp()]
- "text_subtitle_engine_formatsrttimestamp": "formatSRTTimestamp()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L109 | neighbors=[subtitle-engine.ts, exportSRT()]
- "text_subtitle_engine_normalizesrt": "normalizeSRT()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L264 | neighbors=[subtitle-engine.ts, parseSRT()]
- "text_subtitle_engine_parsesrttimestamp": "parseSRTTimestamp()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L85 | neighbors=[subtitle-engine.ts, parseSRT()]
- "text_subtitle_engine_subtitleengine_addsubtitle": ".addSubtitle()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L293 | neighbors=[SubtitleEngine, generateSubtitleId()]
- "text_subtitle_engine_subtitleengine_applystylepreset": ".applyStylePreset()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L457 | neighbors=[SubtitleEngine, .setGlobalStyle()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-062.json

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
