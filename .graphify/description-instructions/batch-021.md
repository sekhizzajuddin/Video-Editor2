# Node Description Batch 22 of 128

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

- "public_puter_tn": "Tn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .on(), .write()]
- "public_puter_un_delete": ".delete()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Un, U(), .get(), .exec()]
- "public_puter_un_exec": ".exec()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[qe(), Un, .delete(), .get()]
- "public_puter_wt_onconnect": ".onconnect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, ._drainQueue(), .emitBuffered(), .onpacket()]
- "public_puter_xn_connectedcallback": ".connectedCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn, ._applyTheme(), ._rerender(), ._setupThemeWatchers()]
- "src_migration": "migration.ts" | kind=code-symbol | source=packages/image-core/src/migration.ts:L1 | neighbors=[index.ts, migrateProject(), migrateV0ToV1(), operations.ts]
- "src_operations_findartboard": "findArtboard()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L45 | neighbors=[operations.ts, addLayerToProject(), duplicateLayerInProject(), reorderArtboardLayers()]
- "src_operations_renamelayer": "renameLayer()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L207 | neighbors=[operations.ts, cloneProject(), touchProject(), operations.test.ts]
- "src_operations_setlayerlocked": "setLayerLocked()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L223 | neighbors=[operations.ts, cloneProject(), touchProject(), operations.test.ts]
- "src_operations_setlayervisible": "setLayerVisible()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L239 | neighbors=[operations.ts, cloneProject(), touchProject(), operations.test.ts]
- "src_operations_validatelayertree": "validateLayerTree()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L287 | neighbors=[operations.ts, deserializeProject(), serializeProject(), operations.test.ts]
- "src_project_shapelayer": "ShapeLayer" | kind=code-symbol | source=packages/image-core/src/project.ts:L206 | neighbors=[commands.test.ts, operations.test.ts, project.ts, BaseLayer]
- "src_project_textlayer": "TextLayer" | kind=code-symbol | source=packages/image-core/src/project.ts:L153 | neighbors=[commands.test.ts, operations.test.ts, project.ts, BaseLayer]
- "stabilization_stabilization_engine_getstabilizationengine": "getStabilizationEngine()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L352 | neighbors=[index.ts, stabilization-engine.ts, StabilizationEngine, getStabilizedTransform()]
- "stabilization_types_correctiontransform": "CorrectionTransform" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L8 | neighbors=[index.ts, motion-path.ts, stabilization-engine.ts, types.ts]
- "stabilization_types_default_stabilization_config": "DEFAULT_STABILIZATION_CONFIG" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L44 | neighbors=[index.ts, stabilization-engine.ts, types.ts, vidstab-engine.ts]
- "stabilization_types_stabilizationconfig": "StabilizationConfig" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L36 | neighbors=[index.ts, stabilization-engine.ts, types.ts, vidstab-engine.ts]
- "stabilization_types_stabilizationprofile": "StabilizationProfile" | kind=code-symbol | source=packages/core/src/video/stabilization/types.ts:L22 | neighbors=[index.ts, stabilization-engine.ts, types.ts, timeline.ts]
- "storage_cache_manager_cachemanager_createframekey": ".createFrameKey()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L162 | neighbors=[CacheManager, .deleteFrame(), .getFrame(), .setFrame()]
- "storage_storage_engine_storageengine_deletemedia": ".deleteMedia()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L275 | neighbors=[StorageEngine, .deleteWaveform(), .transaction(), .deleteProject()]
- "storage_storage_engine_storageengine_deleteproject": ".deleteProject()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L236 | neighbors=[StorageEngine, .deleteMedia(), .getDb(), .getMediaByProject()]
- "storage_storage_engine_storageengine_transactiongetall": ".transactionGetAll()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L149 | neighbors=[StorageEngine, .getMediaByProject(), .listProjects(), .getDb()]
- "storage_types_waveformrecord": "WaveformRecord" | kind=code-symbol | source=packages/core/src/storage/types.ts:L45 | neighbors=[waveform-generator.ts, cache-manager.ts, storage-engine.ts, types.ts]
- "template_template_engine_templateengine_applyscriptabletemplate": ".applyScriptableTemplate()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1560 | neighbors=[TemplateEngine, .applyPlaceholderToTarget(), .createMediaFromScriptableReplacements(), .validatePlaceholderValue()]
- "test_fc_config": "fc-config.ts" | kind=code-symbol | source=packages/core/src/test/fc-config.ts:L1 | neighbors=[defaultFcParams, runAsyncProperty(), runProperty(), index.ts]
- "text_character_animator_characteranimator_measuretext": ".measureText()" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L86 | neighbors=[CharacterAnimator, .calculateAnimatedLayout(), .createStaticLayout(), .createFallbackLayout()]
- "text_speech_to_text_engine_speechtotextengine_initrecognition": ".initRecognition()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L171 | neighbors=[SpeechToTextEngine, .constructor(), .isSupported(), .setupRecognitionHandlers()]
- "text_speech_to_text_engine_speechtotextengine_reportprogress": ".reportProgress()" | kind=code-symbol | source=packages/core/src/text/speech-to-text-engine.ts:L249 | neighbors=[SpeechToTextEngine, .getCurrentTime(), .startLiveTranscription(), .stopTranscription()]
- "text_subtitle_engine_generatesubtitleid": "generateSubtitleId()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L76 | neighbors=[subtitle-engine.ts, parseSRT(), .addSubtitle(), .splitSubtitle()]
- "text_title_engine_titleengine_applytextstyle": ".applyTextStyle()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L446 | neighbors=[TitleEngine, .measureText(), .renderText(), .wrapText()]
- "text_title_engine_titleengine_rendertext": ".renderText()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L207 | neighbors=[TitleEngine, .applyEmphasisAnimation(), .applyTextStyle(), .measureText()]
- "text_title_engine_titleengine_updatetextclip": ".updateTextClip()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L107 | neighbors=[TitleEngine, .updatePosition(), .updateStyle(), .updateText()]
- "text_title_engine_titleengine_wraptext": ".wrapText()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L403 | neighbors=[TitleEngine, .measureText(), .applyTextStyle(), .initialize()]
- "text_transcription_service_transcriptionservice_converttosubtitles": ".convertToSubtitles()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L300 | neighbors=[TranscriptionService, .generateId(), .groupWordsIntoSubtitles(), .transcribeClip()]
- "text_transcription_service_transcriptionservice_transcribeclip": ".transcribeClip()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L58 | neighbors=[TranscriptionService, .convertToSubtitles(), .extractAudioFromClip(), .sendToWhisper()]
- "timeline_clip_manager_clipmanager_addclip": ".addClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L53 | neighbors=[ClipManager, .createProjectWrapper(), .findNonOverlappingPosition(), .snapToGrid()]
- "timeline_clip_manager_clipmanager_findnonoverlappingposition": ".findNonOverlappingPosition()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L283 | neighbors=[ClipManager, .addClip(), .wouldOverlap(), .moveClip()]
- "types_actions_audioaction": "AudioAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L196 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_clipaction": "ClipAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L99 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_effectaction": "EffectAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L121 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-021.json

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
