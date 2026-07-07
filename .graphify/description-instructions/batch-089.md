# Node Description Batch 90 of 128

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

- "media_audio_match_engine_audiomatchengine_getinstance": ".getInstance()" | kind=code-symbol | source=packages/core/src/media/audio-match-engine.ts:L9 | neighbors=[AudioMatchEngine]
- "media_ffmpeg_fallback_audioextractionoptions": "AudioExtractionOptions" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L37 | neighbors=[ffmpeg-fallback.ts]
- "media_ffmpeg_fallback_default_transcode_options": "DEFAULT_TRANSCODE_OPTIONS" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L93 | neighbors=[ffmpeg-fallback.ts]
- "media_ffmpeg_fallback_ffmpegfallback_getrecommendedproxypreset": ".getRecommendedProxyPreset()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L566 | neighbors=[FFmpegFallback]
- "media_ffmpeg_fallback_ffmpegfallback_isloaded": ".isLoaded()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L175 | neighbors=[FFmpegFallback]
- "media_ffmpeg_fallback_ffmpegfallback_shoulduseproxy": ".shouldUseProxy()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L543 | neighbors=[FFmpegFallback]
- "media_ffmpeg_fallback_ffmpeginstance": "FFmpegInstance" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L2 | neighbors=[ffmpeg-fallback.ts]
- "media_media_import_service_default_options": "DEFAULT_OPTIONS" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L33 | neighbors=[media-import-service.ts]
- "media_media_import_service_mediaimportservice_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L48 | neighbors=[MediaImportService]
- "media_media_import_service_mediaimportservice_generateproxy": ".generateProxy()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L472 | neighbors=[MediaImportService]
- "media_media_import_service_mediaimportservice_getproxythresholds": ".getProxyThresholds()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L528 | neighbors=[MediaImportService]
- "media_media_import_service_mediaimportservice_getsupportedformats": ".getSupportedFormats()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L536 | neighbors=[MediaImportService]
- "media_media_import_service_mediaimportservice_processedmediatomediaitem": ".processedMediaToMediaItem()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L399 | neighbors=[MediaImportService]
- "media_mediabunny_engine_exportframedecoder_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L79 | neighbors=[ExportFrameDecoder]
- "media_mediabunny_engine_exportframedecoder_getframe": ".getFrame()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L120 | neighbors=[ExportFrameDecoder]
- "media_mediabunny_engine_mediabunnyengine_clearframecache": ".clearFrameCache()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L175 | neighbors=[MediaBunnyEngine]
- "media_mediabunny_engine_mediabunnyengine_getexportdecoder": ".getExportDecoder()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L207 | neighbors=[MediaBunnyEngine]
- "media_mediabunny_engine_mediabunnyengine_getframecachesize": ".getFrameCacheSize()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L185 | neighbors=[MediaBunnyEngine]
- "media_mediabunny_engine_mediabunnyengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L158 | neighbors=[MediaBunnyEngine]
- "media_mediabunny_engine_mediabunnyengine_isavailable": ".isAvailable()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L171 | neighbors=[MediaBunnyEngine]
- "media_mediabunny_engine_mediabunnyinput": "MediaBunnyInput" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L59 | neighbors=[mediabunny-engine.ts]
- "media_transcription_engine_transcriptionengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L19 | neighbors=[TranscriptionEngine]
- "media_transcription_engine_transcriptionengine_getinstance": ".getInstance()" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L21 | neighbors=[TranscriptionEngine]
- "media_transcription_engine_transcriptionword": "TranscriptionWord" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L8 | neighbors=[transcription-engine.ts]
- "media_waveform_generator_default_options": "DEFAULT_OPTIONS" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L24 | neighbors=[waveform-generator.ts]
- "media_waveform_generator_waveformgenerator_clearallcache": ".clearAllCache()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L319 | neighbors=[WaveformGenerator]
- "media_waveform_generator_waveformgenerator_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L307 | neighbors=[WaveformGenerator]
- "media_waveform_generator_waveformgenerator_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L35 | neighbors=[WaveformGenerator]
- "media_waveform_generator_waveformgenerator_getwaveformforzoomlevel": ".getWaveformForZoomLevel()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L115 | neighbors=[WaveformGenerator]
- "media_waveform_generator_waveformgenerator_getwaveformslice": ".getWaveformSlice()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L185 | neighbors=[WaveformGenerator]
- "media_waveform_generator_waveformgenerator_iscached": ".isCached()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L323 | neighbors=[WaveformGenerator]
- "media_waveform_generator_waveformgenerator_setstorageengine": ".setStorageEngine()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L43 | neighbors=[WaveformGenerator]
- "media_waveform_renderer_default_style": "DEFAULT_STYLE" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L35 | neighbors=[waveform-renderer.ts]
- "media_waveform_renderer_waveformrenderer_getamplitudeatposition": ".getAmplitudeAtPosition()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L340 | neighbors=[WaveformRenderer]
- "media_waveform_renderer_waveformrenderer_getoptimalresolution": ".getOptimalResolution()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L405 | neighbors=[WaveformRenderer]
- "media_waveform_renderer_waveformrenderer_setwaveform": ".setWaveform()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L60 | neighbors=[WaveformRenderer]
- "media_waveform_renderer_waveformrenderer_toblob": ".toBlob()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L381 | neighbors=[WaveformRenderer]
- "media_waveform_renderer_waveformrenderer_todataurl": ".toDataURL()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L366 | neighbors=[WaveformRenderer]
- "pages_home": "Home.tsx" | kind=code-symbol | source=src/pages/Home.tsx:L1 | neighbors=[Home()]
- "pages_home_home": "Home()" | kind=code-symbol | source=src/pages/Home.tsx:L4 | neighbors=[Home.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-089.json

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
