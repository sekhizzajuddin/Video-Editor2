# Node Description Batch 16 of 128

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

- "graphics_index": "index.ts" | kind=code-symbol | source=packages/core/src/graphics/index.ts:L1 | neighbors=[graphics-engine.ts, sticker-library.ts, svg-animation-presets.ts, types.ts, index.ts]
- "graphics_types_graphicclip": "GraphicClip" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L7 | neighbors=[graphics-engine.ts, types.ts, ShapeClip, StickerClip, SVGClip]
- "graphics_types_shapestyle": "ShapeStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L161 | neighbors=[animation-importer.ts, resolver.ts, types.ts, graphics-engine.ts, types.ts]
- "graphics_types_stickerclip": "StickerClip" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L134 | neighbors=[graphics-engine.ts, sticker-library.ts, types.ts, GraphicClip, project.ts]
- "media_audio_match_engine_audiomatchengine": "AudioMatchEngine" | kind=code-symbol | source=packages/core/src/media/audio-match-engine.ts:L4 | neighbors=[audio-match-engine.ts, .analyzeAudio(), .constructor(), .getInstance(), .matchAudio()]
- "media_ffmpeg_fallback_ffmpegfallback_convertaudio": ".convertAudio()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L586 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load()]
- "media_ffmpeg_fallback_ffmpegfallback_extractframe": ".extractFrame()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L650 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load()]
- "media_ffmpeg_fallback_ffmpegfallback_getmetadata": ".getMetadata()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L444 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load()]
- "media_ffmpeg_fallback_ffmpegfallback_probeaudiostreams": ".probeAudioStreams()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L479 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load()]
- "media_media_import_service_mediaimportservice_importmedia": ".importMedia()" | kind=code-symbol | source=packages/core/src/media/media-import-service.ts:L66 | neighbors=[MediaImportService, .canBrowserPlay(), .importWithFallback(), .validateFormat(), .importMultiple()]
- "media_mediabunny_engine_mediabunnyengine_convertmedia": ".convertMedia()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L725 | neighbors=[MediaBunnyEngine, .ensureInitialized(), .getMimeTypeForFormat(), .extractAudio(), .generateProxy()]
- "media_mediabunny_engine_mediabunnyengine_getframeattime": ".getFrameAtTime()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L563 | neighbors=[MediaBunnyEngine, .exportFrame(), .dispose(), .createInput(), .ensureInitialized()]
- "media_transcription_engine_transcriptionengine": "TranscriptionEngine" | kind=code-symbol | source=packages/core/src/media/transcription-engine.ts:L14 | neighbors=[transcription-engine.ts, .constructor(), .getInstance(), .initialize(), .transcribe()]
- "media_waveform_generator_waveformgenerator_generatewaveform": ".generateWaveform()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L47 | neighbors=[WaveformGenerator, .generateMultiResolutionWaveform(), .loadFromCache(), .saveToCache(), .updateMemoryCache()]
- "media_waveform_renderer_createclipwaveformthumbnail": "createClipWaveformThumbnail()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L442 | neighbors=[index.ts, waveform-renderer.ts, WaveformRenderer, .render(), .setCanvas()]
- "media_waveform_renderer_createwaveformimage": "createWaveformImage()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L423 | neighbors=[index.ts, waveform-renderer.ts, WaveformRenderer, .render(), .setCanvas()]
- "photo_index": "index.ts" | kind=code-symbol | source=packages/core/src/photo/index.ts:L1 | neighbors=[photo-adjustments.ts, photo-engine.ts, retouching-engine.ts, types.ts, index.ts]
- "photo_photo_engine_photoengine_rendercomposite": ".renderComposite()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L293 | neighbors=[PhotoEngine, .flattenLayers(), .mergeLayerDown(), .applyLayerTransform(), .getCanvasBlendMode()]
- "playback_playback_controller_playbackcontroller_pause": ".pause()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L220 | neighbors=[PlaybackController, .emitEvent(), .stopAudioPlayback(), .startScrubbing(), .togglePlayback()]
- "public_puter_bt": "bt()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .off(), .subEvents(), .onopen(), .open()]
- "public_puter_et_flush": ".flush()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .getWritablePackets(), .onDrain(), .onOpen(), .sendPacket()]
- "public_puter_et_sendpacket": ".sendPacket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .onPacket(), .send(), .flush(), .write()]
- "public_puter_gn": "Gn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .constructor(), .#L(), .start()]
- "public_puter_gs_prefix": "._prefix()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gs, .debug(), .error(), .info(), .warn()]
- "public_puter_gs_warn": ".warn()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.close(), .postMessage(), gs, ._prefix(), L()]
- "public_puter_in": "In" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .addListener(), .close(), .constructor(), .write()]
- "public_puter_j": "j()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .requestPermission(), i(), M(), R()]
- "public_puter_jn": "jn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .hydrate(), .hydrate_value_(), .getHydrator()]
- "public_puter_le": "Le()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .constructor(), .constructor(), .constructor()]
- "public_puter_ls_itemel": "._itemEl()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._activateFocused(), ._hideActiveSubmenu(), ._openFocusedSubmenu(), ._setFocusIndex()]
- "public_puter_ls_openfocusedsubmenu": "._openFocusedSubmenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._handleKey(), ._cancelSubmenuClose(), ._itemEl(), ._showSubmenu()]
- "public_puter_ls_positionmenu": "._positionMenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, .onReady(), .add(), ._isMobile(), ._showBackdrop()]
- "public_puter_ls_showsubmenu": "._showSubmenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._hideActiveSubmenu(), ._openFocusedSubmenu(), .add(), ._cancelSubmenuClose()]
- "public_puter_mn": "mn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .emit(), .off(), .on()]
- "public_puter_mt": "mt" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .add(), .constructor(), .finishedReconstruction(), .takeBinaryData()]
- "public_puter_rn": "Rn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .attach_to_source(), .constructor(), .register_callback(), .constructor()]
- "public_puter_wt_emit": ".emit()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, ._addToQueue(), .notifyOutgoingListeners(), .packet(), ._registerAckCallback()]
- "public_puter_wt_onpacket": ".onpacket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .onack(), .onconnect(), .ondisconnect(), .onevent()]
- "src_operations_duplicatelayerinproject": "duplicateLayerInProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L155 | neighbors=[operations.ts, cloneProject(), findArtboard(), touchProject(), operations.test.ts]
- "src_project_grouplayer": "GroupLayer" | kind=code-symbol | source=packages/image-core/src/project.ts:L215 | neighbors=[commands.ts, commands.test.ts, operations.test.ts, project.ts, BaseLayer]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-015.json

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
