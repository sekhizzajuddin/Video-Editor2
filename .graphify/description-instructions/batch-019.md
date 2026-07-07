# Node Description Batch 20 of 128

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

- "export_export_engine_exportengine_encodeaudiowithmediabunny": ".encodeAudioWithMediaBunny()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1143 | neighbors=[ExportEngine, .encodeWav(), .getAudioMimeType(), .exportAudio()]
- "export_export_engine_exportengine_encodewav": ".encodeWav()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1200 | neighbors=[ExportEngine, .encodeAudioWithMediaBunny(), .encodeWav32Float(), .exportAudio()]
- "export_export_engine_exportengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L41 | neighbors=[ExportEngine, .isInitialized(), .initializeGPUForExport(), initializeExportEngine()]
- "export_export_engine_exportengine_rendertimelineaudio": ".renderTimelineAudio()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1057 | neighbors=[ExportEngine, .encodeTimelineAudioToSource(), .exportAudio(), .calculateTimelineDuration()]
- "export_export_engine_initializeexportengine": "initializeExportEngine()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1444 | neighbors=[export-engine.ts, .initialize(), getExportEngine(), index.ts]
- "export_types_default_audio_settings": "DEFAULT_AUDIO_SETTINGS" | kind=code-symbol | source=packages/core/src/export/types.ts:L130 | neighbors=[export-engine.ts, export-engine.test.ts, types.ts, index.ts]
- "export_types_default_image_settings": "DEFAULT_IMAGE_SETTINGS" | kind=code-symbol | source=packages/core/src/export/types.ts:L138 | neighbors=[export-engine.ts, export-engine.test.ts, types.ts, index.ts]
- "export_types_default_video_settings": "DEFAULT_VIDEO_SETTINGS" | kind=code-symbol | source=packages/core/src/export/types.ts:L111 | neighbors=[export-engine.ts, export-engine.test.ts, types.ts, index.ts]
- "export_types_exportprogress": "ExportProgress" | kind=code-symbol | source=packages/core/src/export/types.ts:L53 | neighbors=[export-engine.ts, types.ts, ffmpeg-fallback.ts, index.ts]
- "export_types_imageexportsettings": "ImageExportSettings" | kind=code-symbol | source=packages/core/src/export/types.ts:L40 | neighbors=[export-engine.ts, types.ts, SequenceExportSettings, index.ts]
- "export_types_sequenceexportsettings": "SequenceExportSettings" | kind=code-symbol | source=packages/core/src/export/types.ts:L47 | neighbors=[export-engine.ts, types.ts, ImageExportSettings, index.ts]
- "export_types_video_quality_presets": "VIDEO_QUALITY_PRESETS" | kind=code-symbol | source=packages/core/src/export/types.ts:L145 | neighbors=[export-engine.ts, export-engine.test.ts, types.ts, index.ts]
- "export_types_videoexportsettings": "VideoExportSettings" | kind=code-symbol | source=packages/core/src/export/types.ts:L15 | neighbors=[export-engine.ts, export-worker.ts, types.ts, index.ts]
- "ffmpeg_ffmpeg_core_addrundependency": "addRunDependency()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, asyncLoad(), createWasm(), FS_createPreloadedFile()]
- "ffmpeg_ffmpeg_core_asyncload": "asyncLoad()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, addRunDependency(), getUniqueRunDependency(), FS_createPreloadedFile()]
- "ffmpeg_ffmpeg_core_callruntimecallbacks": "callRuntimeCallbacks()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, initRuntime(), postRun(), preRun()]
- "ffmpeg_ffmpeg_core_fs_createpreloadedfile": "FS_createPreloadedFile()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, addRunDependency(), asyncLoad(), getUniqueRunDependency()]
- "ffmpeg_ffmpeg_core_getaddrinfo": "_getaddrinfo()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, inetPton4(), inetPton6(), UTF8ToString()]
- "ffmpeg_ffmpeg_core_getenvstrings": "getEnvStrings()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _environ_get(), _environ_sizes_get(), getExecutableName()]
- "ffmpeg_ffmpeg_core_inetpton6": "inetPton6()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _getaddrinfo(), jstoi_q(), writeSockaddr()]
- "ffmpeg_ffmpeg_core_intarrayfromstring": "intArrayFromString()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, lengthBytesUTF8(), stringToUTF8Array(), _strftime()]
- "ffmpeg_ffmpeg_core_isleapyear": "isLeapYear()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, addDays(), _strftime(), ydayFromDate()]
- "ffmpeg_ffmpeg_core_prerun": "preRun()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, addOnPreRun(), callRuntimeCallbacks(), run()]
- "ffmpeg_ffmpeg_core_proc_exit": "_proc_exit()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, exitJS(), ExitStatus(), keepRuntimeAlive()]
- "ffmpeg_ffmpeg_core_stringtonewutf8": "stringToNewUTF8()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, lengthBytesUTF8(), stringToUTF8(), __tzset_js()]
- "ffmpeg_ffmpeg_core_ydayfromdate": "ydayFromDate()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, __localtime_js(), __mktime_js(), isLeapYear()]
- "fft_index_preloadwasmfft": "preloadWasmFFT()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L222 | neighbors=[index.ts, getWasmFFT(), .ensureWasm(), index.ts]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_interpolate": ".interpolate()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L60 | neighbors=[FrameInterpolationEngine, .extractPixelData(), .simpleBlend(), .warpFrames()]
- "frame_interpolation_frame_interpolation_engine_getframeinterpolationengine": "getFrameInterpolationEngine()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L214 | neighbors=[frame-interpolation-engine.ts, FrameInterpolationEngine, .initialize(), index.ts]
- "frame_interpolation_types_interpolation_quality_presets": "INTERPOLATION_QUALITY_PRESETS" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/types.ts:L20 | neighbors=[frame-interpolation-engine.ts, index.ts, types.ts, stabilization-engine.ts]
- "graphics_graphics_engine_graphicsengine_rendersvg": ".renderSVG()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L594 | neighbors=[GraphicsEngine, .renderGraphic(), .getAnimatedSVGSourceInset(), .loadImage()]
- "graphics_types_shapetype": "ShapeType" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L141 | neighbors=[animation-exporter.ts, animation-importer.ts, types.ts, types.ts]
- "graphics_types_svgclip": "SVGClip" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L30 | neighbors=[graphics-engine.ts, types.ts, GraphicClip, project.ts]
- "hooks_usemediaplayback_initaudiograph": "initAudioGraph()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L1019 | neighbors=[useMediaPlayback.ts, createSeparationGraph(), getMasterAudioCtx(), getOrCreateTrackAnalyser()]
- "media_media_import_service_getmediaimportservice": "getMediaImportService()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L609 | neighbors=[index.ts, media-import-service.ts, MediaImportService, initializeMediaImportService()]
- "media_media_import_service_initializemediaimportservice": "initializeMediaImportService()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L616 | neighbors=[index.ts, media-import-service.ts, getMediaImportService(), .initialize()]
- "media_media_import_service_mediaimportservice_generateproxyifneeded": ".generateProxyIfNeeded()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L510 | neighbors=[MediaImportService, .generateProxyWithPreset(), .getRecommendedProxyPreset(), .shouldUseProxyForFile()]
- "media_media_import_service_mediaimportservice_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L53 | neighbors=[initializeMediaImportService(), MediaImportService, .generateThumbnailsForMedia(), .generateWaveformForMedia()]
- "media_mediabunny_engine_issupportedformat": "isSupportedFormat()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L41 | neighbors=[index.ts, media-import-service.ts, mediabunny-engine.ts, .validateFormat()]
- "media_mediabunny_engine_mediabunnyengine_exportimagesequence": ".exportImageSequence()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1085 | neighbors=[MediaBunnyEngine, .dispose(), .createInput(), .ensureInitialized()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-019.json

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
