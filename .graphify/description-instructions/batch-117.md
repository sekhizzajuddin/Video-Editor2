# Node Description Batch 118 of 128

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

- "video_decode_worker_initrequest": "InitRequest" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L20 | neighbors=[decode-worker.ts]
- "video_decode_worker_initresponse": "InitResponse" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L24 | neighbors=[decode-worker.ts]
- "video_decode_worker_resourcecache": "resourceCache" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L40 | neighbors=[decode-worker.ts]
- "video_decode_worker_workerrequest": "WorkerRequest" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L30 | neighbors=[decode-worker.ts]
- "video_decode_worker_workerself": "workerSelf" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L193 | neighbors=[decode-worker.ts]
- "video_filter_presets_filter_categories": "FILTER_CATEGORIES" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L273 | neighbors=[filter-presets.ts]
- "video_filter_presets_filter_presets": "FILTER_PRESETS" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L41 | neighbors=[filter-presets.ts]
- "video_filter_presets_filtercategory": "FilterCategory" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L281 | neighbors=[filter-presets.ts]
- "video_filter_presets_filtereffect": "FilterEffect" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L27 | neighbors=[filter-presets.ts]
- "video_filter_presets_filtereffectparams": "FilterEffectParams" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L11 | neighbors=[filter-presets.ts]
- "video_filter_presets_filtereffecttype": "FilterEffectType" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L1 | neighbors=[filter-presets.ts]
- "video_filter_presets_filterpreset": "FilterPreset" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L32 | neighbors=[filter-presets.ts]
- "video_filter_presets_getallcategories": "getAllCategories()" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L291 | neighbors=[filter-presets.ts]
- "video_filter_presets_getallpresets": "getAllPresets()" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L295 | neighbors=[filter-presets.ts]
- "video_filter_presets_getpresetbyid": "getPresetById()" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L287 | neighbors=[filter-presets.ts]
- "video_filter_presets_getpresetsbycategory": "getPresetsByCategory()" | kind=code-symbol | source=packages/core/src/video/filter-presets.ts:L283 | neighbors=[filter-presets.ts]
- "video_frame_cache_default_config": "DEFAULT_CONFIG" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L3 | neighbors=[frame-cache.ts]
- "video_frame_cache_framecache_clear": ".clear()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L95 | neighbors=[FrameCache]
- "video_frame_cache_framecache_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L16 | neighbors=[FrameCache]
- "video_frame_cache_framecache_getcachedtimestamps": ".getCachedTimestamps()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L214 | neighbors=[FrameCache]
- "video_frame_cache_framecache_getconfig": ".getConfig()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L116 | neighbors=[FrameCache]
- "video_frame_cache_framecache_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L104 | neighbors=[FrameCache]
- "video_frame_cache_preloadmanager_cancelall": ".cancelAll()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L269 | neighbors=[PreloadManager]
- "video_frame_cache_preloadmanager_dequeue": ".dequeue()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L281 | neighbors=[PreloadManager]
- "video_frame_cache_preloadmanager_getcurrenttask": ".getCurrentTask()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L297 | neighbors=[PreloadManager]
- "video_frame_cache_preloadmanager_getqueuelength": ".getQueueLength()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L289 | neighbors=[PreloadManager]
- "video_frame_cache_preloadmanager_haspendingtasks": ".hasPendingTasks()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L285 | neighbors=[PreloadManager]
- "video_frame_cache_preloadmanager_setcurrenttask": ".setCurrentTask()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L293 | neighbors=[PreloadManager]
- "video_frame_cache_preloadmanager_updatepriority": ".updatePriority()" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L301 | neighbors=[PreloadManager]
- "video_frame_cache_preloadtask": "PreloadTask" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L234 | neighbors=[frame-cache.ts]
- "video_frame_ring_buffer_compositeframebuffer_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L291 | neighbors=[CompositeFrameBuffer]
- "video_frame_ring_buffer_compositeframebuffer_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L259 | neighbors=[CompositeFrameBuffer]
- "video_frame_ring_buffer_compositeframebuffer_removetrack": ".removeTrack()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L275 | neighbors=[CompositeFrameBuffer]
- "video_frame_ring_buffer_compositeframebuffer_reset": ".reset()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L283 | neighbors=[CompositeFrameBuffer]
- "video_frame_ring_buffer_disposeframebuffers": "disposeFrameBuffers()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L317 | neighbors=[frame-ring-buffer.ts]
- "video_frame_ring_buffer_framedata": "FrameData" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L1 | neighbors=[frame-ring-buffer.ts]
- "video_frame_ring_buffer_frameringbuffer_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L32 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L187 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_getbufferfilllevel": ".getBufferFillLevel()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L132 | neighbors=[FrameRingBuffer]
- "video_frame_ring_buffer_frameringbuffer_getlatesttimestamp": ".getLatestTimestamp()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L140 | neighbors=[FrameRingBuffer]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-117.json

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
