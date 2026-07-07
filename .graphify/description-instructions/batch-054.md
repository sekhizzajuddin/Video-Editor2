# Node Description Batch 55 of 128

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

- "media_mediabunny_engine_mediabunnyengine_extractimagemetadata": ".extractImageMetadata()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L295 | neighbors=[MediaBunnyEngine, .extractMetadata()]
- "media_mediabunny_engine_mediabunnyengine_generateproxy": ".generateProxy()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1069 | neighbors=[MediaBunnyEngine, .convertMedia()]
- "media_mediabunny_engine_mediabunnyengine_getbestaudiocodec": ".getBestAudioCodec()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1152 | neighbors=[MediaBunnyEngine, .ensureInitialized()]
- "media_mediabunny_engine_mediabunnyengine_getbestvideocodec": ".getBestVideoCodec()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1012 | neighbors=[MediaBunnyEngine, .ensureInitialized()]
- "media_mediabunny_engine_mediabunnyengine_getmimetypeforformat": ".getMimeTypeForFormat()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L974 | neighbors=[MediaBunnyEngine, .convertMedia()]
- "media_mediabunny_engine_mediabunnyengine_trimmedia": ".trimMedia()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L887 | neighbors=[MediaBunnyEngine, .ensureInitialized()]
- "media_mediabunny_engine_supported_audio_formats": "SUPPORTED_AUDIO_FORMATS" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L24 | neighbors=[index.ts, mediabunny-engine.ts]
- "media_mediabunny_engine_supported_image_formats": "SUPPORTED_IMAGE_FORMATS" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L34 | neighbors=[index.ts, mediabunny-engine.ts]
- "media_mediabunny_engine_supported_video_formats": "SUPPORTED_VIDEO_FORMATS" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L17 | neighbors=[index.ts, mediabunny-engine.ts]
- "media_transcription_engine_transcriptionengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L28 | neighbors=[TranscriptionEngine, .transcribe()]
- "media_transcription_engine_transcriptionengine_transcribe": ".transcribe()" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L64 | neighbors=[TranscriptionEngine, .initialize()]
- "media_types_audio_quality_presets": "AUDIO_QUALITY_PRESETS" | kind=code-symbol | source=packages/core/src/media/types.ts:L82 | neighbors=[index.ts, types.ts]
- "media_types_audiocodec": "AudioCodec" | kind=code-symbol | source=packages/core/src/media/types.ts:L111 | neighbors=[index.ts, types.ts]
- "media_types_codecsupport": "CodecSupport" | kind=code-symbol | source=packages/core/src/media/types.ts:L113 | neighbors=[index.ts, types.ts]
- "media_types_quality_presets": "QUALITY_PRESETS" | kind=code-symbol | source=packages/core/src/media/types.ts:L75 | neighbors=[index.ts, types.ts]
- "media_types_videocodec": "VideoCodec" | kind=code-symbol | source=packages/core/src/media/types.ts:L109 | neighbors=[index.ts, types.ts]
- "media_waveform_generator_waveformgenerator_downsamplewaveform": ".downsampleWaveform()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L142 | neighbors=[WaveformGenerator, .generateMultiResolutionWaveform()]
- "media_waveform_generator_waveformgenerator_updatememorycache": ".updateMemoryCache()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L282 | neighbors=[WaveformGenerator, .generateWaveform()]
- "media_waveform_generator_waveformgenerator_waveformdatatorecord": ".waveformDataToRecord()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L263 | neighbors=[WaveformGenerator, .saveToCache()]
- "media_waveform_generator_waveformgenerator_waveformrecordtodata": ".waveformRecordToData()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L242 | neighbors=[WaveformGenerator, .loadFromCache()]
- "media_waveform_generator_waveformgeneratoroptions": "WaveformGeneratorOptions" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L5 | neighbors=[index.ts, waveform-generator.ts]
- "media_waveform_renderer_amplitudeinfo": "AmplitudeInfo" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L28 | neighbors=[index.ts, waveform-renderer.ts]
- "media_waveform_renderer_waveformrenderer_renderhighzoom": ".renderHighZoom()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L128 | neighbors=[WaveformRenderer, .render()]
- "media_waveform_renderer_waveformrenderer_renderlowzoom": ".renderLowZoom()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L195 | neighbors=[WaveformRenderer, .render()]
- "media_waveform_renderer_waveformrenderer_rendermultiresolution": ".renderMultiResolution()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L316 | neighbors=[WaveformRenderer, .render()]
- "media_waveform_renderer_waveformrenderoptions": "WaveformRenderOptions" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L19 | neighbors=[index.ts, waveform-renderer.ts]
- "media_waveform_renderer_waveformstyle": "WaveformStyle" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L8 | neighbors=[index.ts, waveform-renderer.ts]
- "photo_photo_adjustments_getphotoadjustmentengine": "getPhotoAdjustmentEngine()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L366 | neighbors=[photo-adjustments.ts, PhotoAdjustmentEngine]
- "photo_photo_engine_getphotoengine": "getPhotoEngine()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L455 | neighbors=[photo-engine.ts, PhotoEngine]
- "photo_photo_engine_initializephotoengine": "initializePhotoEngine()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L462 | neighbors=[photo-engine.ts, PhotoEngine]
- "photo_photo_engine_photoengine_addlayer": ".addLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L85 | neighbors=[PhotoEngine, .createLayer()]
- "photo_photo_engine_photoengine_applylayertransform": ".applyLayerTransform()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L338 | neighbors=[PhotoEngine, .renderComposite()]
- "photo_photo_engine_photoengine_canmodifylayer": ".canModifyLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L435 | neighbors=[PhotoEngine, .getLayer()]
- "photo_photo_engine_photoengine_getcanvasblendmode": ".getCanvasBlendMode()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L357 | neighbors=[PhotoEngine, .renderComposite()]
- "photo_photo_engine_photoengine_getlayer": ".getLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L289 | neighbors=[PhotoEngine, .canModifyLayer()]
- "photo_photo_engine_photoengine_importphoto": ".importPhoto()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L49 | neighbors=[PhotoEngine, .createLayer()]
- "photo_photo_engine_photoengine_mergelayerdown": ".mergeLayerDown()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L399 | neighbors=[PhotoEngine, .renderComposite()]
- "photo_retouching_engine_getretouchingengine": "getRetouchingEngine()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L383 | neighbors=[retouching-engine.ts, RetouchingEngine]
- "photo_retouching_engine_retouchingengine_clonestampstroke": ".cloneStampStroke()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L242 | neighbors=[RetouchingEngine, .cloneStamp()]
- "photo_retouching_engine_retouchingengine_removeredeye": ".removeRedEye()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L270 | neighbors=[RetouchingEngine, .getCanvas()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-054.json

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
