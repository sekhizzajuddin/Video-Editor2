# Node Description Batch 31 of 128

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

- "graphics_types_default_graphic_transform": "DEFAULT_GRAPHIC_TRANSFORM" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L269 | neighbors=[graphics-engine.ts, sticker-library.ts, types.ts]
- "graphics_types_fillstyle": "FillStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L179 | neighbors=[animation-importer.ts, graphics-engine.ts, types.ts]
- "graphics_types_graphicanimation": "GraphicAnimation" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L47 | neighbors=[graphics-engine.ts, svg-animation-presets.ts, types.ts]
- "graphics_types_graphicanimationtype": "GraphicAnimationType" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L53 | neighbors=[graphics-engine.ts, svg-animation-presets.ts, types.ts]
- "graphics_types_strokestyle": "StrokeStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L197 | neighbors=[animation-importer.ts, graphics-engine.ts, types.ts]
- "hooks_usemediaplayback_connectaudionode": "connectAudioNode()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L975 | neighbors=[useMediaPlayback.ts, getMasterAudioCtx(), getOrCreateTrackAnalyser()]
- "hooks_usemediaplayback_getmasteraudioctx": "getMasterAudioCtx()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L30 | neighbors=[useMediaPlayback.ts, connectAudioNode(), initAudioGraph()]
- "hooks_usemediaplayback_getorcreatetrackanalyser": "getOrCreateTrackAnalyser()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L953 | neighbors=[useMediaPlayback.ts, connectAudioNode(), initAudioGraph()]
- "hooks_usemediaplayback_usemediaplayback": "useMediaPlayback()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L119 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts]
- "media_ffmpeg_fallback_ffmpegfallback_calculatebufsize": ".calculateBufsize()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L110 | neighbors=[FFmpegFallback, .encodeFrameSequence(), .exportVideoDirectly()]
- "media_ffmpeg_fallback_ffmpegfallback_concatenatesegments": ".concatenateSegments()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L1135 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded()]
- "media_ffmpeg_fallback_getrecommendedproxypreset": "getRecommendedProxyPreset()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L1206 | neighbors=[ffmpeg-fallback.ts, getFFmpegFallback(), index.ts]
- "media_ffmpeg_fallback_proxy_thresholds": "PROXY_THRESHOLDS" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L77 | neighbors=[ffmpeg-fallback.ts, index.ts, media-import-service.ts]
- "media_ffmpeg_fallback_proxysettings": "ProxySettings" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L41 | neighbors=[ffmpeg-fallback.ts, index.ts, media-import-service.ts]
- "media_ffmpeg_fallback_shoulduseproxy": "shouldUseProxy()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L1197 | neighbors=[ffmpeg-fallback.ts, getFFmpegFallback(), index.ts]
- "media_ffmpeg_fallback_transcodeoptions": "TranscodeOptions" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L84 | neighbors=[ffmpeg-fallback.ts, index.ts, media-import-service.ts]
- "media_gif_decoder_creategifframecache": "createGifFrameCache()" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L137 | neighbors=[gif-decoder.ts, index.ts, video-engine.ts]
- "media_gif_decoder_getgifframeattime": "getGifFrameAtTime()" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L166 | neighbors=[gif-decoder.ts, index.ts, video-engine.ts]
- "media_gif_decoder_gifframecache": "GifFrameCache" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L14 | neighbors=[gif-decoder.ts, index.ts, video-engine.ts]
- "media_gif_decoder_isanimatedgif": "isAnimatedGif()" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L185 | neighbors=[gif-decoder.ts, index.ts, video-engine.ts]
- "media_media_import_service_mediaimportservice_shoulduseproxyforfile": ".shouldUseProxyForFile()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L455 | neighbors=[MediaImportService, .generateProxyIfNeeded(), .shouldUseProxy()]
- "media_mediabunny_engine_infermediatype": "inferMediaType()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L50 | neighbors=[index.ts, media-import-service.ts, mediabunny-engine.ts]
- "media_mediabunny_engine_initializemediaengine": "initializeMediaEngine()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1176 | neighbors=[index.ts, mediabunny-engine.ts, getMediaEngine()]
- "media_mediabunny_engine_mediabunnyengine_createexportdecoder": ".createExportDecoder()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L189 | neighbors=[MediaBunnyEngine, ExportFrameDecoder, .ensureInitialized()]
- "media_transcription_engine": "transcription-engine.ts" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L1 | neighbors=[index.ts, TranscriptionEngine, TranscriptionWord]
- "media_types_exportprogress": "ExportProgress" | kind=code-symbol | source=packages/core/src/media/types.ts:L67 | neighbors=[index.ts, mediabunny-engine.ts, types.ts]
- "media_types_exportsettings": "ExportSettings" | kind=code-symbol | source=packages/core/src/media/types.ts:L53 | neighbors=[index.ts, mediabunny-engine.ts, types.ts]
- "media_types_framecacheentry": "FrameCacheEntry" | kind=code-symbol | source=packages/core/src/media/types.ts:L88 | neighbors=[index.ts, mediabunny-engine.ts, types.ts]
- "media_types_mediaimportresult": "MediaImportResult" | kind=code-symbol | source=packages/core/src/media/types.ts:L102 | neighbors=[index.ts, media-import-service.ts, types.ts]
- "media_types_mediatrackinfo": "MediaTrackInfo" | kind=code-symbol | source=packages/core/src/media/types.ts:L11 | neighbors=[index.ts, mediabunny-engine.ts, types.ts]
- "media_types_processedmedia": "ProcessedMedia" | kind=code-symbol | source=packages/core/src/media/types.ts:L1 | neighbors=[index.ts, media-import-service.ts, types.ts]
- "media_types_videoframeresult": "VideoFrameResult" | kind=code-symbol | source=packages/core/src/media/types.ts:L37 | neighbors=[index.ts, mediabunny-engine.ts, types.ts]
- "media_types_waveformcacheentry": "WaveformCacheEntry" | kind=code-symbol | source=packages/core/src/media/types.ts:L96 | neighbors=[index.ts, types.ts, waveform-generator.ts]
- "media_waveform_generator_createwaveformgenerator": "createWaveformGenerator()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L345 | neighbors=[index.ts, waveform-generator.ts, WaveformGenerator]
- "media_waveform_generator_multiresolutionwaveform": "MultiResolutionWaveform" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L10 | neighbors=[index.ts, waveform-generator.ts, waveform-renderer.ts]
- "media_waveform_generator_waveform_resolutions": "WAVEFORM_RESOLUTIONS" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L16 | neighbors=[index.ts, waveform-generator.ts, waveform-renderer.ts]
- "media_waveform_generator_waveformgenerator_generatemultiresolutionwaveform": ".generateMultiResolutionWaveform()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L81 | neighbors=[WaveformGenerator, .downsampleWaveform(), .generateWaveform()]
- "media_waveform_generator_waveformgenerator_loadfromcache": ".loadFromCache()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L208 | neighbors=[WaveformGenerator, .generateWaveform(), .waveformRecordToData()]
- "media_waveform_generator_waveformgenerator_savetocache": ".saveToCache()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L226 | neighbors=[WaveformGenerator, .generateWaveform(), .waveformDataToRecord()]
- "media_waveform_renderer_waveformrenderer_setcanvas": ".setCanvas()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L53 | neighbors=[createClipWaveformThumbnail(), createWaveformImage(), WaveformRenderer]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-030.json

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
