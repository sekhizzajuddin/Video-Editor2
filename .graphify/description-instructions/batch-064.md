# Node Description Batch 65 of 128

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

- "text_title_engine_titleengine_loadtextclips": ".loadTextClips()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L484 | neighbors=[TitleEngine, .clear()]
- "text_title_engine_titleengine_updateposition": ".updatePosition()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L151 | neighbors=[TitleEngine, .updateTextClip()]
- "text_title_engine_titleengine_updatestyle": ".updateStyle()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L147 | neighbors=[TitleEngine, .updateTextClip()]
- "text_title_engine_titleengine_updatetext": ".updateText()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L143 | neighbors=[TitleEngine, .updateTextClip()]
- "text_transcription_service_disposetranscriptionservice": "disposeTranscriptionService()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L425 | neighbors=[transcription-service.ts, .dispose()]
- "text_transcription_service_transcriptionservice_audiobuffertowav": ".audioBufferToWav()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L159 | neighbors=[TranscriptionService, .extractAudioFromClip()]
- "text_transcription_service_transcriptionservice_pollforresult": ".pollForResult()" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L256 | neighbors=[TranscriptionService, .sendToWhisper()]
- "text_types_default_text_style": "DEFAULT_TEXT_STYLE" | kind=code-symbol | source=packages/core/src/text/types.ts:L175 | neighbors=[title-engine.ts, types.ts]
- "text_types_default_text_transform": "DEFAULT_TEXT_TRANSFORM" | kind=code-symbol | source=packages/core/src/text/types.ts:L187 | neighbors=[title-engine.ts, types.ts]
- "text_types_fontweight": "FontWeight" | kind=code-symbol | source=packages/core/src/text/types.ts:L76 | neighbors=[animation-importer.ts, types.ts]
- "text_types_textlinemetrics": "TextLineMetrics" | kind=code-symbol | source=packages/core/src/text/types.ts:L208 | neighbors=[title-engine.ts, types.ts]
- "text_types_textmetrics": "TextMetrics" | kind=code-symbol | source=packages/core/src/text/types.ts:L202 | neighbors=[title-engine.ts, types.ts]
- "text_types_textrenderresult": "TextRenderResult" | kind=code-symbol | source=packages/core/src/text/types.ts:L195 | neighbors=[title-engine.ts, types.ts]
- "timeline_auto_edit_service_autoeditcut": "AutoEditCut" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L20 | neighbors=[auto-edit-service.ts, index.ts]
- "timeline_auto_edit_service_autoeditoptions": "AutoEditOptions" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L6 | neighbors=[auto-edit-service.ts, index.ts]
- "timeline_auto_edit_service_autoeditresult": "AutoEditResult" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L28 | neighbors=[auto-edit-service.ts, index.ts]
- "timeline_auto_edit_service_autoeditservice_filterbyminduration": ".filterByMinDuration()" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L121 | neighbors=[AutoEditService, .generateCuts()]
- "timeline_auto_edit_service_autoeditservice_getcutpoints": ".getCutPoints()" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L86 | neighbors=[AutoEditService, .generateCuts()]
- "timeline_auto_edit_service_cutmode": "CutMode" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L4 | neighbors=[auto-edit-service.ts, index.ts]
- "timeline_auto_edit_service_default_auto_edit_options": "DEFAULT_AUTO_EDIT_OPTIONS" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L13 | neighbors=[auto-edit-service.ts, index.ts]
- "timeline_clip_manager_addclipparams": "AddClipParams" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L14 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_clipmanager_getclipssortedbytime": ".getClipsSortedByTime()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L388 | neighbors=[ClipManager, .getTrackClips()]
- "timeline_clip_manager_clipmanager_gettrackclips": ".getTrackClips()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L383 | neighbors=[ClipManager, .getClipsSortedByTime()]
- "timeline_clip_manager_clipmanager_wouldoverlap": ".wouldOverlap()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L262 | neighbors=[ClipManager, .findNonOverlappingPosition()]
- "timeline_clip_manager_clipmanageroptions": "ClipManagerOptions" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L6 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_clipoperationresult": "ClipOperationResult" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L27 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_clipsoverlap": "clipsOverlap()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L719 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_cloneclip": "cloneClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L699 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_createclip": "createClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L671 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_getclipendtime": "getClipEndTime()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L715 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_getgapbetweenclips": "getGapBetweenClips()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L726 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_moveclipparams": "MoveClipParams" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L21 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_snapresult": "SnapResult" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L34 | neighbors=[clip-manager.ts, index.ts]
- "timeline_clip_manager_test_createmocktimeline": "createMockTimeline()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.test.ts:L40 | neighbors=[clip-manager.test.ts, createMockTrack()]
- "timeline_clip_manager_test_createmocktrack": "createMockTrack()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.test.ts:L27 | neighbors=[clip-manager.test.ts, createMockTimeline()]
- "timeline_nested_sequence_engine_compoundclip": "CompoundClip" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L9 | neighbors=[index.ts, nested-sequence-engine.ts]
- "timeline_nested_sequence_engine_compoundclipcontent": "CompoundClipContent" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L3 | neighbors=[index.ts, nested-sequence-engine.ts]
- "timeline_nested_sequence_engine_compoundclipinstance": "CompoundClipInstance" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L18 | neighbors=[index.ts, nested-sequence-engine.ts]
- "timeline_nested_sequence_engine_createcompoundclipoptions": "CreateCompoundClipOptions" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L30 | neighbors=[index.ts, nested-sequence-engine.ts]
- "timeline_nested_sequence_engine_flattenresult": "FlattenResult" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L35 | neighbors=[index.ts, nested-sequence-engine.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-064.json

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
