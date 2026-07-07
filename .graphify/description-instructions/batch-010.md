# Node Description Batch 11 of 128

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

- "utils_lutparser": "lutParser.ts" | kind=code-symbol | source=src/utils/lutParser.ts:L1 | neighbors=[MediaPanel.tsx, PreviewCanvas.tsx, canvasEffects.ts, index.ts, LutData, applyLutToCanvas()]
- "utils_motiontracker": "motionTracker.ts" | kind=code-symbol | source=src/utils/motionTracker.ts:L1 | neighbors=[PropertiesPanel.tsx, index.ts, CornerPoints, getGrayscalePatch(), matchTemplate(), Point]
- "video_canvas2d_fallback_renderer": "canvas2d-fallback-renderer.ts" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L1 | neighbors=[timeline.ts, Effect, Canvas2DFallbackRenderer, renderer-factory.ts, Renderer, RendererConfig]
- "video_playback_engine_playbackengine_stop": ".stop()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L139 | neighbors=[PlaybackEngine, .dispose(), .play(), .clearBuffer(), .clearStreams(), .setState()]
- "video_webgpu_renderer_impl_webgpurenderer_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/webgpu-renderer-impl.ts:L94 | neighbors=[WebGPURenderer, .createBindGroupLayouts(), .createFrameBuffers(), .createTextureSampler(), .createUniformBuffers(), .initializePipelines()]
- "actions_action_validator_actionvalidator_findclip": ".findClip()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L1150 | neighbors=[ActionValidator, .validateAudioAction(), .validateClipAction(), .validateEffectAction(), .validateKeyframeAction(), .validateTransformAction()]
- "actions_action_validator_actionvalidator_findtrack": ".findTrack()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L1146 | neighbors=[ActionValidator, .validateAudioAction(), .validateClipAction(), .validateEffectAction(), .validateKeyframeAction(), .validateTrackAction()]
- "ai_person_segmentation_engine": "person-segmentation-engine.ts" | kind=code-symbol | source=packages/core/src/ai/person-segmentation-engine.ts:L1 | neighbors=[background-removal-engine.ts, index.ts, disposePersonSegmentationEngine(), getPersonSegmentationEngine(), PersonSegmentationEngine, SegmentationResult]
- "audio_audio_effects_engine_createnoisereductionnodechain": "createNoiseReductionNodeChain()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L404 | neighbors=[audio-effects-engine.ts, .createNoiseReductionNodePair(), createNoiseReductionBandsForContext(), createNoiseReductionPostFiltersForConte…, createProfileBasedNoiseReductionFilters…, toSimpleNoiseProfile()]
- "audio_audio_effects_engine_createprofilebasednoisereductionfilters": "createProfileBasedNoiseReductionFilters()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L256 | neighbors=[audio-effects-engine.ts, .applyNoiseReductionWithProfileData(), createNoiseReductionNodeChain(), calculateLowFrequencyEnergy(), calculateNoiseStatistics(), calculateRangeEnergy()]
- "audio_audio_engine_audioengine_rendercliptocontextfromsegments": ".renderClipToContextFromSegments()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L581 | neighbors=[AudioEngine, .renderClipToContext(), .applyFades(), .applyVolumeAutomation(), .createClipOutputNodes(), .getSegmentedAudioDecoder()]
- "audio_noise_reduction_autolearnnoiseprofile": "autoLearnNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L334 | neighbors=[noise-reduction.ts, detectNoiseSegments(), extractAudioSegment(), findQuietestContiguousWindow(), isLikelyNoiseOnly(), SpectralNoiseReducer]
- "audio_noise_reduction_spectralnoisereducer_processchannel": ".processChannel()" | kind=code-symbol | source=packages/core/src/audio/noise-reduction.ts:L146 | neighbors=[SpectralNoiseReducer, .processBuffer(), .applySpectralSubtraction(), .computeSpectrum(), .extractFrame(), .getWindowValue()]
- "audio_realtime_audio_graph_realtimeaudiograph_createtrack": ".createTrack()" | kind=code-symbol | source=packages/core/src/audio/realtime-audio-graph.ts:L121 | neighbors=[RealtimeAudioGraph, .buildEffectChain(), .removeTrack(), .updateSoloState(), .updateTrackAudibility(), .scheduleClip()]
- "audio_realtime_processor_trackprocessor_updateaudibility": ".updateAudibility()" | kind=code-symbol | source=packages/core/src/audio/realtime-processor.ts:L349 | neighbors=[TrackProcessor, .constructor(), .setHasSoloTracks(), .setMuted(), .setSolo(), .setVolume()]
- "components_transcriptpanel": "TranscriptPanel.tsx" | kind=code-symbol | source=src/components/TranscriptPanel.tsx:L1 | neighbors=[MediaPanel.tsx, formatSimpleTime(), TranscriptPanel(), editorStore.ts, useEditorStore, index.ts]
- "fft_index_wasmfft_ensurewasmsize": ".ensureWasmSize()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L127 | neighbors=[WasmFFT, .applyHannWindow(), .forward(), .fromMagnitudeAndPhase(), .getMagnitude(), .getMagnitudeAndPhase()]
- "frame_interpolation_optical_flow_cpu": "optical-flow-cpu.ts" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L1 | neighbors=[frame-interpolation-engine.ts, index.ts, OpticalFlowCPU, types.ts, FlowField, InterpolationConfig]
- "frame_interpolation_types_flowfield": "FlowField" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/types.ts:L1 | neighbors=[flow-field-cache.ts, frame-interpolation-engine.ts, index.ts, optical-flow-cpu.ts, optical-flow-gpu.ts, types.ts]
- "graphics_types_shapeclip": "ShapeClip" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L23 | neighbors=[animation-exporter.ts, animation-importer.ts, graphics-engine.ts, types.ts, GraphicClip, project.ts]
- "media_ffmpeg_fallback_ffmpegfallback_encodeframesequence": ".encodeFrameSequence()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L686 | neighbors=[FFmpegFallback, .calculateBufsize(), .encodeAudioBufferToWav(), .ensureLoaded(), .load(), .removeProgressTracking()]
- "media_ffmpeg_fallback_ffmpegfallback_exportvideodirectly": ".exportVideoDirectly()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L955 | neighbors=[FFmpegFallback, .calculateBufsize(), .ensureLoaded(), .fileToUint8Array(), .load(), .removeProgressTracking()]
- "media_ffmpeg_fallback_ffmpegfallback_extractaudioaswav": ".extractAudioAsWav()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L299 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load(), .removeProgressTracking()]
- "media_ffmpeg_fallback_ffmpegfallback_extractrange": ".extractRange()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L399 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load(), .removeProgressTracking()]
- "media_ffmpeg_fallback_ffmpegfallback_setupprogresstracking": ".setupProgressTracking()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L202 | neighbors=[FFmpegFallback, .encodeFrameSequence(), .exportVideoDirectly(), .extractAudioAsWav(), .extractRange(), .generateProxy()]
- "playback_playback_controller_playbackcontroller_seek": ".seek()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L273 | neighbors=[PlaybackController, .play(), .scrubTo(), .emitEvent(), .renderFrameAtTime(), .startAudioPlayback()]
- "playback_playback_controller_playbackcontroller_stopaudioplayback": ".stopAudioPlayback()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L699 | neighbors=[PlaybackController, .clearAudioBuffer(), .handleClockStateChange(), .pause(), .pruneAudioBuffers(), .seek()]
- "public_puter_cn_initializesocket": ".initializeSocket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .constructor(), .bindSocketEvents(), .shouldUseSocketAutoUnref(), kt(), .setAPIOrigin()]
- "public_puter_encode": "encode()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, encodeAsBinary(), encodeAsString(), ot(), .write(), wn()]
- "public_puter_gn_l": ".#L()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Gn, Bn, Kn, .addIceCandidate(), .createAnswer(), .setRemoteDescription()]
- "public_puter_gs_error": ".error()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.checkCacheAndPurge(), gs, ._prefix(), .emit(), .off(), .on()]
- "public_puter_gt": "gt" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .add(), .constructor(), .decodeString(), .destroy(), .isPayloadValid()]
- "public_puter_ls_cancelsubmenuclose": "._cancelSubmenuClose()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._setSafeTraverse(), ._closeAll(), .disconnectedCallback(), ._openFocusedSubmenu(), ._scheduleSubmenuClose()]
- "public_puter_u": "U()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, B(), .create(), .delete(), .get(), .getLoggingHandle()]
- "public_puter_we": "We" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .abort(), .cleanup(), .constructor(), .create(), .onError()]
- "public_puter_zn": "zn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .constructor(), .getDehydrator(), .getHydrator(), .registerCallback()]
- "src_commands_addartboardcommand": "AddArtboardCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L79 | neighbors=[commands.ts, .apply(), .constructor(), .description(), .invert(), Command]
- "src_commands_applymaskcommand": "ApplyMaskCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L499 | neighbors=[commands.ts, .apply(), .constructor(), .description(), .invert(), Command]
- "src_commands_duplicatelayercommand": "DuplicateLayerCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L277 | neighbors=[commands.ts, Command, .apply(), .constructor(), .description(), .invert()]
- "src_commands_rastereditcommand": "RasterEditCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L526 | neighbors=[commands.ts, Command, .apply(), .constructor(), .description(), .invert()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-010.json

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
