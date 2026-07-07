# Node Description Batch 102 of 128

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

- "test_fc_config_runasyncproperty": "runAsyncProperty()" | kind=code-symbol | source=packages/core/src/test/fc-config.ts:L24 | neighbors=[fc-config.ts]
- "test_fc_config_runproperty": "runProperty()" | kind=code-symbol | source=packages/core/src/test/fc-config.ts:L13 | neighbors=[fc-config.ts]
- "test_generators_actionarb": "actionArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L238 | neighbors=[generators.ts]
- "test_generators_cliparb": "clipArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L150 | neighbors=[generators.ts]
- "test_generators_durationarb": "durationArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L39 | neighbors=[generators.ts]
- "test_generators_easingtypearb": "easingTypeArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L51 | neighbors=[generators.ts]
- "test_generators_effectarb": "effectArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L118 | neighbors=[generators.ts]
- "test_generators_executableactionarb": "executableActionArb()" | kind=code-symbol | source=packages/core/src/test/generators.ts:L364 | neighbors=[generators.ts]
- "test_generators_idarb": "idArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L29 | neighbors=[generators.ts]
- "test_generators_jsonsafevaluearb": "jsonSafeValueArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L110 | neighbors=[generators.ts]
- "test_generators_keyframearb": "keyframeArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L131 | neighbors=[generators.ts]
- "test_generators_markerarb": "markerArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L165 | neighbors=[generators.ts]
- "test_generators_mediaitemarb": "mediaItemArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L78 | neighbors=[generators.ts]
- "test_generators_medialibraryarb": "mediaLibraryArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L89 | neighbors=[generators.ts]
- "test_generators_mediametadataarb": "mediaMetadataArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L67 | neighbors=[generators.ts]
- "test_generators_namearb": "nameArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L33 | neighbors=[generators.ts]
- "test_generators_projectarb": "projectArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L228 | neighbors=[generators.ts]
- "test_generators_projectsettingsarb": "projectSettingsArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L59 | neighbors=[generators.ts]
- "test_generators_projectwithtracksarb": "projectWithTracksArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L322 | neighbors=[generators.ts]
- "test_generators_subtitlearb": "subtitleArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L201 | neighbors=[generators.ts]
- "test_generators_subtitlestylearb": "subtitleStyleArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L189 | neighbors=[generators.ts]
- "test_generators_timelinearb": "timelineArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L221 | neighbors=[generators.ts]
- "test_generators_timepositionarb": "timePositionArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L45 | neighbors=[generators.ts]
- "test_generators_timestamparb": "timestampArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L37 | neighbors=[generators.ts]
- "test_generators_trackarb": "trackArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L209 | neighbors=[generators.ts]
- "test_generators_transformarb": "transformArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L93 | neighbors=[generators.ts]
- "test_generators_transitionarb": "transitionArb" | kind=code-symbol | source=packages/core/src/test/generators.ts:L172 | neighbors=[generators.ts]
- "text_audio_text_sync_engine_beatsyncconfig": "BeatSyncConfig" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L13 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_beatsyncengine_analyzebeats": ".analyzeBeats()" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L43 | neighbors=[BeatSyncEngine]
- "text_audio_text_sync_engine_beatsyncengine_snapcliptonearestbeat": ".snapClipToNearestBeat()" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L170 | neighbors=[BeatSyncEngine]
- "text_audio_text_sync_engine_clipinfo": "ClipInfo" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L35 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_cliptiming": "ClipTiming" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L3 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_default_beat_sync_config": "DEFAULT_BEAT_SYNC_CONFIG" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L20 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_disposebeatsyncengine": "disposeBeatSyncEngine()" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L205 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_syncmode": "SyncMode" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L11 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_syncprogress": "SyncProgress" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L27 | neighbors=[audio-text-sync-engine.ts]
- "text_audio_text_sync_engine_syncprogresscallback": "SyncProgressCallback" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L33 | neighbors=[audio-text-sync-engine.ts]
- "text_caption_animation_renderer_animatedcaptionframe": "AnimatedCaptionFrame" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L14 | neighbors=[caption-animation-renderer.ts]
- "text_caption_animation_renderer_caption_animation_styles": "CAPTION_ANIMATION_STYLES" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L300 | neighbors=[caption-animation-renderer.ts]
- "text_caption_animation_renderer_clamp": "clamp()" | kind=code-symbol | source=packages/core/src/text/caption-animation-renderer.ts:L19 | neighbors=[caption-animation-renderer.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-101.json

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
