# Node Description Batch 35 of 128

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

- "storage_project_serializer_projectserializer_importfromjson": ".importFromJson()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L48 | neighbors=[ProjectSerializer, .migrateProject(), .importFromJsonWithValidation()]
- "storage_project_serializer_projectserializer_importfromjsonwithvalidation": ".importFromJsonWithValidation()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L193 | neighbors=[ProjectSerializer, .importFromJson(), .validateProjectJson()]
- "storage_project_serializer_projectserializer_stripmediablobs": ".stripMediaBlobs()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L246 | neighbors=[ProjectSerializer, .exportToJson(), .exportToJsonWithMetadata()]
- "storage_schema_types": "schema-types.ts" | kind=code-symbol | source=packages/core/src/storage/schema-types.ts:L1 | neighbors=[project-serializer.ts, ProjectFileWithMetadata, ValidationResult]
- "storage_storage_engine_createstorageerror": "createStorageError()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L18 | neighbors=[storage-engine.ts, .loadProject(), .saveProject()]
- "storage_storage_engine_storageengine_deletewaveform": ".deleteWaveform()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L355 | neighbors=[StorageEngine, .deleteMedia(), .transaction()]
- "storage_storage_engine_storageengine_getmediabyproject": ".getMediaByProject()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L283 | neighbors=[StorageEngine, .deleteProject(), .transactionGetAll()]
- "storage_storage_engine_storageengine_loadcache": ".loadCache()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L297 | neighbors=[StorageEngine, .saveCache(), .transaction()]
- "storage_storage_engine_storageengine_loadproject": ".loadProject()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L197 | neighbors=[StorageEngine, createStorageError(), .transaction()]
- "storage_storage_engine_storageengine_savecache": ".saveCache()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L291 | neighbors=[StorageEngine, .loadCache(), .transaction()]
- "storage_storage_engine_storageengine_saveproject": ".saveProject()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L172 | neighbors=[StorageEngine, createStorageError(), .transaction()]
- "storage_types_cacherecord": "CacheRecord" | kind=code-symbol | source=packages/core/src/storage/types.ts:L38 | neighbors=[cache-manager.ts, storage-engine.ts, types.ts]
- "storage_types_mediarecord": "MediaRecord" | kind=code-symbol | source=packages/core/src/storage/types.ts:L31 | neighbors=[project-serializer.ts, storage-engine.ts, types.ts]
- "template_template_engine_templateengine_applyplaceholdertotarget": ".applyPlaceholderToTarget()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1709 | neighbors=[TemplateEngine, .setPropertyByPath(), .applyScriptableTemplate()]
- "template_template_engine_templateengine_setpropertybypath": ".setPropertyByPath()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1423 | neighbors=[TemplateEngine, .applyPlaceholderToTarget(), .resolvePropertyPath()]
- "text_caption_animation_renderer_renderbounce": "renderBounce()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L183 | neighbors=[caption-animation-renderer.ts, renderAnimatedCaption(), renderNone()]
- "text_caption_animation_renderer_renderkaraoke": "renderKaraoke()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L134 | neighbors=[caption-animation-renderer.ts, renderAnimatedCaption(), renderNone()]
- "text_caption_animation_renderer_rendertypewriter": "renderTypewriter()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L225 | neighbors=[caption-animation-renderer.ts, renderAnimatedCaption(), renderNone()]
- "text_caption_animation_renderer_renderwordbyword": "renderWordByWord()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L89 | neighbors=[caption-animation-renderer.ts, renderAnimatedCaption(), renderNone()]
- "text_caption_animation_renderer_renderwordhighlight": "renderWordHighlight()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L52 | neighbors=[caption-animation-renderer.ts, renderAnimatedCaption(), renderNone()]
- "text_character_animator_characteranimator_calculateanimatedlayout": ".calculateAnimatedLayout()" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L288 | neighbors=[CharacterAnimator, .createStaticLayout(), .measureText()]
- "text_character_animator_characteranimator_createstaticlayout": ".createStaticLayout()" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L477 | neighbors=[CharacterAnimator, .calculateAnimatedLayout(), .measureText()]
- "text_speech_to_text_engine_speechtotextengine_applyoptions": ".applyOptions()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L266 | neighbors=[SpeechToTextEngine, .setOptions(), .startLiveTranscription()]
- "text_speech_to_text_engine_speechtotextengine_startlivetranscription": ".startLiveTranscription()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L283 | neighbors=[SpeechToTextEngine, .applyOptions(), .reportProgress()]
- "text_speech_to_text_engine_speechtotextengine_stoptranscription": ".stopTranscription()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L308 | neighbors=[SpeechToTextEngine, .dispose(), .reportProgress()]
- "text_text_animation_textanimationengine_getanimatedstate": ".getAnimatedState()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L36 | neighbors=[TextAnimationEngine, .applyKeyframeAnimation(), .applyPreset()]
- "text_title_engine_titleengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L50 | neighbors=[TitleEngine, .measureText(), .wrapText()]
- "text_transcription_service_initializetranscriptionservice": "initializeTranscriptionService()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L415 | neighbors=[transcription-service.ts, TranscriptionService, .dispose()]
- "text_transcription_service_transcriptionservice_createsubtitlefromwords": ".createSubtitleFromWords()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L371 | neighbors=[TranscriptionService, .generateId(), .groupWordsIntoSubtitles()]
- "text_transcription_service_transcriptionservice_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L401 | neighbors=[disposeTranscriptionService(), initializeTranscriptionService(), TranscriptionService]
- "text_transcription_service_transcriptionservice_extractaudiofromclip": ".extractAudioFromClip()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L106 | neighbors=[TranscriptionService, .audioBufferToWav(), .transcribeClip()]
- "text_transcription_service_transcriptionservice_generateid": ".generateId()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L397 | neighbors=[TranscriptionService, .convertToSubtitles(), .createSubtitleFromWords()]
- "text_transcription_service_transcriptionservice_groupwordsintosubtitles": ".groupWordsIntoSubtitles()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L323 | neighbors=[TranscriptionService, .convertToSubtitles(), .createSubtitleFromWords()]
- "text_transcription_service_transcriptionservice_sendtowhisper": ".sendToWhisper()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L207 | neighbors=[TranscriptionService, .pollForResult(), .transcribeClip()]
- "text_types_textanimationparams": "TextAnimationParams" | kind=code-symbol | source=packages/core/src/text/types.ts:L125 | neighbors=[text-animation.ts, text-animation-presets.ts, types.ts]
- "text_types_textanimationpreset": "TextAnimationPreset" | kind=code-symbol | source=packages/core/src/text/types.ts:L104 | neighbors=[text-animation.ts, text-animation-presets.ts, types.ts]
- "timeline_auto_edit_service_autoeditservice_generatecuts": ".generateCuts()" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L35 | neighbors=[AutoEditService, .filterByMinDuration(), .getCutPoints()]
- "timeline_auto_edit_service_getautoeditservice": "getAutoEditService()" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L140 | neighbors=[auto-edit-service.ts, AutoEditService, index.ts]
- "timeline_clip_manager_clipmanager_deleteclip": ".deleteClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L556 | neighbors=[ClipManager, .createProjectWrapper(), .findClip()]
- "timeline_clip_manager_clipmanager_rippledeleteclip": ".rippleDeleteClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L593 | neighbors=[ClipManager, .createProjectWrapper(), .findClip()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-034.json

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
