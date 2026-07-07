# Node Description Batch 62 of 128

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

- "stabilization_vidstab_engine_vidstabprogress": "VidstabProgress" | kind=code-symbol | source=packages/core/src/video/stabilization/vidstab-engine.ts:L30 | neighbors=[index.ts, vidstab-engine.ts]
- "storage_cache_manager_cachemanager_clearframecache": ".clearFrameCache()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L137 | neighbors=[CacheManager, .evictToTarget()]
- "storage_cache_manager_cachemanager_deleteframe": ".deleteFrame()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L92 | neighbors=[CacheManager, .createFrameKey()]
- "storage_cache_manager_cachemanager_getframe": ".getFrame()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L53 | neighbors=[CacheManager, .createFrameKey()]
- "storage_cache_manager_createcachemanager": "createCacheManager()" | kind=code-symbol | source=packages/core/src/storage/cache-manager.ts:L193 | neighbors=[cache-manager.ts, CacheManager]
- "storage_project_serializer_createprojectserializer": "createProjectSerializer()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L277 | neighbors=[project-serializer.ts, ProjectSerializer]
- "storage_project_serializer_projectserializer_exporttojson": ".exportToJson()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L40 | neighbors=[ProjectSerializer, .stripMediaBlobs()]
- "storage_project_serializer_projectserializer_exporttojsonwithmetadata": ".exportToJsonWithMetadata()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L78 | neighbors=[ProjectSerializer, .stripMediaBlobs()]
- "storage_project_serializer_projectserializer_loadproject": ".loadProject()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L30 | neighbors=[ProjectSerializer, .restoreMediaBlobs()]
- "storage_project_serializer_projectserializer_migrateproject": ".migrateProject()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L264 | neighbors=[ProjectSerializer, .importFromJson()]
- "storage_project_serializer_projectserializer_restoremediablobs": ".restoreMediaBlobs()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L221 | neighbors=[ProjectSerializer, .loadProject()]
- "storage_project_serializer_projectserializer_savemediablobs": ".saveMediaBlobs()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L207 | neighbors=[ProjectSerializer, .saveProject()]
- "storage_project_serializer_projectserializer_saveproject": ".saveProject()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L19 | neighbors=[ProjectSerializer, .saveMediaBlobs()]
- "storage_project_serializer_projectserializer_validateprojectjson": ".validateProjectJson()" | kind=code-symbol | source=packages/core/src/storage/project-serializer.ts:L90 | neighbors=[ProjectSerializer, .importFromJsonWithValidation()]
- "storage_schema_types_projectfilewithmetadata": "ProjectFileWithMetadata" | kind=code-symbol | source=packages/core/src/storage/schema-types.ts:L8 | neighbors=[project-serializer.ts, schema-types.ts]
- "storage_schema_types_validationresult": "ValidationResult" | kind=code-symbol | source=packages/core/src/storage/schema-types.ts:L1 | neighbors=[project-serializer.ts, schema-types.ts]
- "storage_storage_engine_createstorageengine": "createStorageEngine()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L482 | neighbors=[storage-engine.ts, StorageEngine]
- "storage_storage_engine_storageengine_clearalldata": ".clearAllData()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L446 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L322 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_deletecache": ".deleteCache()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L316 | neighbors=[StorageEngine, .transaction()]
- "storage_storage_engine_storageengine_getstorageusage": ".getStorageUsage()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L361 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_listprojects": ".listProjects()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L221 | neighbors=[StorageEngine, .transactionGetAll()]
- "storage_storage_engine_storageengine_loaddirectoryhandle": ".loadDirectoryHandle()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L432 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_loadfilehandle": ".loadFileHandle()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L410 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_loadmedia": ".loadMedia()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L266 | neighbors=[StorageEngine, .transaction()]
- "storage_storage_engine_storageengine_loadwaveform": ".loadWaveform()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L346 | neighbors=[StorageEngine, .transaction()]
- "storage_storage_engine_storageengine_opendatabase": ".openDatabase()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L44 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_savedirectoryhandle": ".saveDirectoryHandle()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L421 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_savefilehandle": ".saveFileHandle()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L399 | neighbors=[StorageEngine, .getDb()]
- "storage_storage_engine_storageengine_savemedia": ".saveMedia()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L260 | neighbors=[StorageEngine, .transaction()]
- "storage_storage_engine_storageengine_savewaveform": ".saveWaveform()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L340 | neighbors=[StorageEngine, .transaction()]
- "storage_types_projectrecord": "ProjectRecord" | kind=code-symbol | source=packages/core/src/storage/types.ts:L16 | neighbors=[storage-engine.ts, types.ts]
- "storage_types_projectsummary": "ProjectSummary" | kind=code-symbol | source=packages/core/src/storage/types.ts:L24 | neighbors=[storage-engine.ts, types.ts]
- "storage_types_storageerror": "StorageError" | kind=code-symbol | source=packages/core/src/storage/types.ts:L81 | neighbors=[storage-engine.ts, types.ts]
- "storage_types_storageerrorcode": "StorageErrorCode" | kind=code-symbol | source=packages/core/src/storage/types.ts:L71 | neighbors=[storage-engine.ts, types.ts]
- "storage_types_storageusage": "StorageUsage" | kind=code-symbol | source=packages/core/src/storage/types.ts:L64 | neighbors=[storage-engine.ts, types.ts]
- "storage_types_stores": "STORES" | kind=code-symbol | source=packages/core/src/storage/types.ts:L7 | neighbors=[storage-engine.ts, types.ts]
- "store_editorstore_checkoverlap": "checkOverlap()" | kind=code-symbol | source=src/store/editorStore.ts:L106 | neighbors=[editorStore.ts, findNonOverlappingPosition()]
- "store_editorstore_findnonoverlappingposition": "findNonOverlappingPosition()" | kind=code-symbol | source=src/store/editorStore.ts:L121 | neighbors=[editorStore.ts, checkOverlap()]
- "template_index": "index.ts" | kind=code-symbol | source=packages/core/src/template/index.ts:L1 | neighbors=[index.ts, template-engine.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-061.json

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
