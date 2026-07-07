# Node Description Batch 101 of 128

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

- "stabilization_vidstab_engine_vidstabengine_removestabilized": ".removeStabilized()" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L244 | neighbors=[VidstabEngine]
- "storage_cache_manager_cachemanager_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L30 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanager_deletewaveform": ".deleteWaveform()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L133 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanager_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L38 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanager_getwaveform": ".getWaveform()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L107 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanager_parseframekey": ".parseFrameKey()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L170 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanager_resetstats": ".resetStats()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L48 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanager_setwaveform": ".setWaveform()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L119 | neighbors=[CacheManager]
- "storage_cache_manager_cachemanagerconfig": "CacheManagerConfig" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L3 | neighbors=[cache-manager.ts]
- "storage_cache_manager_cachestats": "CacheStats" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L15 | neighbors=[cache-manager.ts]
- "storage_cache_manager_default_cache_config": "DEFAULT_CACHE_CONFIG" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L9 | neighbors=[cache-manager.ts]
- "storage_project_serializer_projectfile": "ProjectFile" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L5 | neighbors=[project-serializer.ts]
- "storage_project_serializer_projectserializer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L15 | neighbors=[ProjectSerializer]
- "storage_project_serializer_projectserializer_deleteproject": ".deleteProject()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L268 | neighbors=[ProjectSerializer]
- "storage_project_serializer_projectserializer_listprojects": ".listProjects()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L272 | neighbors=[ProjectSerializer]
- "storage_storage_engine_istorageengine": "IStorageEngine" | kind=code-symbol | neighbors=[StorageEngine]
- "storage_storage_engine_storageengine_close": ".close()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L473 | neighbors=[StorageEngine]
- "storage_storage_engine_storageengine_createstores": ".createStores()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L78 | neighbors=[StorageEngine]
- "storage_types_dirhandlerecord": "DirHandleRecord" | kind=code-symbol | source=packages/core/src/storage/types.ts:L58 | neighbors=[types.ts]
- "storage_types_filehandlerecord": "FileHandleRecord" | kind=code-symbol | source=packages/core/src/storage/types.ts:L52 | neighbors=[types.ts]
- "store_editorstore_createemptytracks": "createEmptyTracks()" | kind=code-symbol | source=src/store/editorStore.ts:L50 | neighbors=[editorStore.ts]
- "store_editorstore_debouncedsaveproject": "debouncedSaveProject()" | kind=code-symbol | source=src/store/editorStore.ts:L22 | neighbors=[editorStore.ts]
- "store_editorstore_defaulttracks": "defaultTracks" | kind=code-symbol | source=src/store/editorStore.ts:L326 | neighbors=[editorStore.ts]
- "store_editorstore_editoractions": "EditorActions" | kind=code-symbol | source=src/store/editorStore.ts:L162 | neighbors=[editorStore.ts]
- "store_editorstore_generateid": "generateId()" | kind=code-symbol | source=src/store/editorStore.ts:L40 | neighbors=[editorStore.ts]
- "store_editorstore_initialstate": "initialState" | kind=code-symbol | source=src/store/editorStore.ts:L327 | neighbors=[editorStore.ts]
- "template_template_engine_builtin_templates": "BUILTIN_TEMPLATES" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L36 | neighbors=[template-engine.ts]
- "template_template_engine_default_transform": "DEFAULT_TRANSFORM" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L28 | neighbors=[template-engine.ts]
- "template_template_engine_templateengine_converttotemplateclip": ".convertToTemplateClip()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1196 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_getalltemplates": ".getAllTemplates()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1943 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_getbuiltintemplates": ".getBuiltinTemplates()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1939 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_gettemplatesbycategory": ".getTemplatesByCategory()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1897 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_loadbuiltintemplates": ".loadBuiltinTemplates()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1129 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_resolveclipplaceholder": ".resolveClipPlaceholder()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1328 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_resolvesubtitleplaceholder": ".resolveSubtitlePlaceholder()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1354 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_searchtemplates": ".searchTemplates()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1907 | neighbors=[TemplateEngine]
- "template_template_engine_templateengine_tosummary": ".toSummary()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1928 | neighbors=[TemplateEngine]
- "test": "test.ts" | kind=code-symbol | source=test.ts:L1 | neighbors=[a]
- "test_a": "a" | kind=code-symbol | source=test.ts:L1 | neighbors=[test.ts]
- "test_fc_config_defaultfcparams": "defaultFcParams" | kind=code-symbol | source=packages/core/src/test/fc-config.ts:L5 | neighbors=[fc-config.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-100.json

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
