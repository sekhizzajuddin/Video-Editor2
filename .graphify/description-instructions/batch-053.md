# Node Description Batch 54 of 128

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

- "graphics_types_emojiitem": "EmojiItem" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L249 | neighbors=[sticker-library.ts, types.ts]
- "graphics_types_gradientstyle": "GradientStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L186 | neighbors=[graphics-engine.ts, types.ts]
- "graphics_types_graphicrenderresult": "GraphicRenderResult" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L277 | neighbors=[graphics-engine.ts, types.ts]
- "graphics_types_stickeritem": "StickerItem" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L241 | neighbors=[sticker-library.ts, types.ts]
- "graphics_types_svgcolorstyle": "SVGColorStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L41 | neighbors=[graphics-engine.ts, types.ts]
- "graphics_types_svgimportresult": "SVGImportResult" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L294 | neighbors=[graphics-engine.ts, types.ts]
- "graphics_types_viewbox": "ViewBox" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L214 | neighbors=[graphics-engine.ts, types.ts]
- "hooks_use_mobile": "use-mobile.ts" | kind=code-symbol | source=src/hooks/use-mobile.ts:L1 | neighbors=[useIsMobile(), sidebar.tsx]
- "hooks_use_mobile_useismobile": "useIsMobile()" | kind=code-symbol | source=src/hooks/use-mobile.ts:L5 | neighbors=[use-mobile.ts, sidebar.tsx]
- "hooks_usemediaplayback_createseparationgraph": "createSeparationGraph()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L1292 | neighbors=[useMediaPlayback.ts, initAudioGraph()]
- "hooks_usemediaplayback_framecacheentry": "FrameCacheEntry" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L109 | neighbors=[PreviewCanvas.tsx, useMediaPlayback.ts]
- "media_audio_match_engine_audiomatchengine_analyzeaudio": ".analyzeAudio()" | kind=code-symbol | source=packages/core/src/media/audio-match-engine.ts:L82 | neighbors=[AudioMatchEngine, .matchAudio()]
- "media_audio_match_engine_audiomatchengine_matchaudio": ".matchAudio()" | kind=code-symbol | source=packages/core/src/media/audio-match-engine.ts:L20 | neighbors=[AudioMatchEngine, .analyzeAudio()]
- "media_ffmpeg_fallback_audioproberesult": "AudioProbeResult" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L32 | neighbors=[ffmpeg-fallback.ts, index.ts]
- "media_ffmpeg_fallback_audiostreaminfo": "AudioStreamInfo" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L24 | neighbors=[ffmpeg-fallback.ts, index.ts]
- "media_ffmpeg_fallback_ffmpegfallback_doload": ".doLoad()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L126 | neighbors=[FFmpegFallback, .load()]
- "media_ffmpeg_fallback_ffmpegfallback_encodeaudiobuffertowav": ".encodeAudioBufferToWav()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L908 | neighbors=[FFmpegFallback, .encodeFrameSequence()]
- "media_ffmpeg_fallback_ffmpegfallback_generateproxywithpreset": ".generateProxyWithPreset()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L391 | neighbors=[FFmpegFallback, .generateProxy()]
- "media_ffmpeg_fallback_ffmpegfallback_terminate": ".terminate()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L1178 | neighbors=[FFmpegFallback, .removeProgressTracking()]
- "media_ffmpeg_fallback_ffmpegfallback_transcodetomp4": ".transcodeToMp4()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L286 | neighbors=[FFmpegFallback, .transcodeToCompatible()]
- "media_ffmpeg_fallback_proxy_presets": "PROXY_PRESETS" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L50 | neighbors=[ffmpeg-fallback.ts, index.ts]
- "media_gif_decoder_decodedgif": "DecodedGif" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L7 | neighbors=[gif-decoder.ts, index.ts]
- "media_gif_decoder_decodegif": "decodeGif()" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L20 | neighbors=[gif-decoder.ts, index.ts]
- "media_gif_decoder_gifframe": "GifFrame" | kind=code-symbol | source=packages/core/src/media/gif-decoder.ts:L1 | neighbors=[gif-decoder.ts, index.ts]
- "media_media_import_service_mediaimportoptions": "MediaImportOptions" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L23 | neighbors=[index.ts, media-import-service.ts]
- "media_media_import_service_mediaimportservice_canbrowserplay": ".canBrowserPlay()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L274 | neighbors=[MediaImportService, .importMedia()]
- "media_media_import_service_mediaimportservice_generateproxywithpreset": ".generateProxyWithPreset()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L494 | neighbors=[MediaImportService, .generateProxyIfNeeded()]
- "media_media_import_service_mediaimportservice_generatethumbnailsformedia": ".generateThumbnailsForMedia()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L548 | neighbors=[MediaImportService, .initialize()]
- "media_media_import_service_mediaimportservice_generatewaveformformedia": ".generateWaveformForMedia()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L597 | neighbors=[MediaImportService, .initialize()]
- "media_media_import_service_mediaimportservice_getrecommendedproxypreset": ".getRecommendedProxyPreset()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L465 | neighbors=[MediaImportService, .generateProxyIfNeeded()]
- "media_media_import_service_mediaimportservice_importmultiple": ".importMultiple()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L427 | neighbors=[MediaImportService, .importMedia()]
- "media_media_import_service_mediaimportservice_importwithfallback": ".importWithFallback()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L302 | neighbors=[MediaImportService, .importMedia()]
- "media_media_import_service_mediaimportservice_shoulduseproxy": ".shouldUseProxy()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L446 | neighbors=[MediaImportService, .shouldUseProxyForFile()]
- "media_media_import_service_mediaimportservice_validateformat": ".validateFormat()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L376 | neighbors=[MediaImportService, .importMedia()]
- "media_mediabunny_engine_exportframedecoder_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L85 | neighbors=[ExportFrameDecoder, .dispose()]
- "media_mediabunny_engine_mediabunnyengine_checkcodecsupport": ".checkCodecSupport()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L993 | neighbors=[MediaBunnyEngine, .ensureInitialized()]
- "media_mediabunny_engine_mediabunnyengine_disposeallexportdecoders": ".disposeAllExportDecoders()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L219 | neighbors=[MediaBunnyEngine, .dispose()]
- "media_mediabunny_engine_mediabunnyengine_disposeexportdecoder": ".disposeExportDecoder()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L211 | neighbors=[MediaBunnyEngine, .dispose()]
- "media_mediabunny_engine_mediabunnyengine_exportframe": ".exportFrame()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1033 | neighbors=[MediaBunnyEngine, .getFrameAtTime()]
- "media_mediabunny_engine_mediabunnyengine_extractaudio": ".extractAudio()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L868 | neighbors=[MediaBunnyEngine, .convertMedia()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-053.json

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
