# Node Description Batch 13 of 128

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

- "editing_templates_index": "index.ts" | kind=code-symbol | source=packages/core/src/editing-templates/index.ts:L1 | neighbors=[built-in-templates.ts, categories.ts, registry.ts, resolver.ts, types.ts, index.ts]
- "editing_templates_resolver_resolvevalue": "resolveValue()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L386 | neighbors=[resolver.ts, resolveEmphasisAnimation(), resolveNestedValue(), resolveOverlay(), isEditingTemplateBinding(), resolveTemplateVariables()]
- "effects_particle_engine_particleengine_createparticle": ".createParticle()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L236 | neighbors=[ParticleEngine, generateId(), getEmissionPosition(), getInitialVelocity(), randomRange(), .update()]
- "effects_particle_engine_particleengine_notifychange": ".notifyChange()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L165 | neighbors=[ParticleEngine, .addEffect(), .removeEffect(), .toggleEffect(), .updateEffect(), .updateEffectTiming()]
- "export_export_engine_exportengine_createerror": ".createError()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L1329 | neighbors=[ExportEngine, .encodeTimelineAudioToSource(), .exportAudio(), .exportFrame(), .exportImageSequence(), .exportVideo()]
- "export_export_engine_exportengine_exportframe": ".exportFrame()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L646 | neighbors=[ExportEngine, .createError(), .ensureInitialized(), .getImageMimeType(), .exportImage(), .exportImageSequence()]
- "export_export_engine_exportengine_exportimagesequence": ".exportImageSequence()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L730 | neighbors=[ExportEngine, .calculateStats(), .createError(), .createProgress(), .ensureInitialized(), .exportFrame()]
- "ffmpeg_ffmpeg_core_strftime": "_strftime()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, arraySum(), intArrayFromString(), isLeapYear(), UTF8ToString(), writeArrayToMemory()]
- "frame_interpolation_flow_field_cache": "flow-field-cache.ts" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/flow-field-cache.ts:L1 | neighbors=[CacheEntry, FlowFieldCache, types.ts, FlowField, frame-interpolation-engine.ts, index.ts]
- "frame_interpolation_optical_flow_gpu": "optical-flow-gpu.ts" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-gpu.ts:L1 | neighbors=[frame-interpolation-engine.ts, index.ts, OpticalFlowGPU, types.ts, FlowField, InterpolationConfig]
- "graphics_graphics_engine_graphicsengine_rendergraphic": ".renderGraphic()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L419 | neighbors=[GraphicsEngine, .applyTransform(), .getAnimatedGraphicState(), .renderShape(), .renderSticker(), .renderSVG()]
- "graphics_types_emphasisanimation": "EmphasisAnimation" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L103 | neighbors=[graphics-engine.ts, graphics-engine.test.ts, types.ts, types.ts, timeline.ts, video-engine.ts]
- "media_audio_match_engine": "audio-match-engine.ts" | kind=code-symbol | source=packages/core/src/media/audio-match-engine.ts:L1 | neighbors=[AudioMatchEngine, effects.ts, EQBand, timeline.ts, Effect, index.ts]
- "media_ffmpeg_fallback_getffmpegfallback": "getFFmpegFallback()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L1190 | neighbors=[ffmpeg-fallback.ts, FFmpegFallback, getRecommendedProxyPreset(), shouldUseProxy(), index.ts, media-import-service.ts]
- "media_mediabunny_engine_exportframedecoder": "ExportFrameDecoder" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L69 | neighbors=[mediabunny-engine.ts, .constructor(), .dispose(), .getFrame(), .initialize(), .createExportDecoder()]
- "media_types_waveformdata": "WaveformData" | kind=code-symbol | source=packages/core/src/media/types.ts:L45 | neighbors=[index.ts, media-import-service.ts, mediabunny-engine.ts, types.ts, waveform-generator.ts, waveform-renderer.ts]
- "media_waveform_renderer_waveformrenderer_render": ".render()" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L64 | neighbors=[createClipWaveformThumbnail(), createWaveformImage(), WaveformRenderer, .renderHighZoom(), .renderLowZoom(), .renderMultiResolution()]
- "playback_playback_controller_playbackcontroller_play": ".play()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L187 | neighbors=[PlaybackController, .emitEvent(), .preloadAudioBuffers(), .seek(), .startAudioPlayback(), .togglePlayback()]
- "playback_playback_controller_playbackcontroller_renderframeattime": ".renderFrameAtTime()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L401 | neighbors=[PlaybackController, .handleClockTimeUpdate(), .drawFrameToCanvas(), .emitEvent(), .trackFrameRenderTime(), .seek()]
- "public_puter_c": "C" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .connectedCallback(), .constructor(), .open(), L()]
- "public_puter_dn": "Dn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .constructor(), .from(), .postMessage(), .usesSDK()]
- "public_puter_ls_closeall": "._closeAll()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, .add(), ._cancelSubmenuClose(), ._hideActiveSubmenu(), ._hideBackdrop(), ._handleKey()]
- "public_puter_ls_setfocusindex": "._setFocusIndex()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._handleKey(), ._hideActiveSubmenu(), ._moveFocus(), ._itemEl(), ._typeahead()]
- "public_puter_ls_submenuclosecheck": "._submenuCloseCheck()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._hideActiveSubmenu(), ._isMouseHeadingToSubmenu(), ._pointInElement(), ._pointInRect(), ._setSafeTraverse()]
- "public_puter_n": "N()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, E, .off(), .constructor(), .dehydrate(), .dehydrate_value_()]
- "public_puter_p": "P" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, D(), .close(), .connectedCallback(), .constructor(), .open()]
- "public_puter_vn": "vn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .constructor(), ._continue(), .register(), .write()]
- "public_puter_wn": "wn()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .register(), .write(), encode(), .constructor()]
- "public_puter_wt_packet": ".packet()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .ack(), .disconnect(), .emit(), ._packet(), ._sendConnectPacket()]
- "public_puter_y": "Y" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .connectedCallback(), .constructor(), .open(), .#r()]
- "src_operations_addlayertoproject": "addLayerToProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L122 | neighbors=[commands.ts, operations.ts, cloneProject(), findArtboard(), touchProject(), operations.test.ts]
- "src_operations_reorderartboardlayers": "reorderArtboardLayers()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L191 | neighbors=[commands.ts, operations.ts, cloneProject(), findArtboard(), touchProject(), operations.test.ts]
- "src_operations_updatelayerinproject": "updateLayerInProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L271 | neighbors=[commands.ts, operations.ts, operations.test.ts, cloneProject(), safeAssign(), touchProject()]
- "src_operations_updatelayertransforminproject": "updateLayerTransformInProject()" | kind=code-symbol | source=packages/image-core/src/operations.ts:L255 | neighbors=[commands.ts, operations.ts, operations.test.ts, cloneProject(), safeAssign(), touchProject()]
- "src_project_baselayer": "BaseLayer" | kind=code-symbol | source=packages/image-core/src/project.ts:L86 | neighbors=[project.ts, GroupLayer, ImageLayer, ShapeLayer, SmartObjectLayer, TextLayer]
- "stabilization_stabilization_engine_getstabilizedtransform": "getStabilizedTransform()" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L308 | neighbors=[index.ts, stabilization-engine.ts, getStabilizationEngine(), .getCorrectionTransform(), .hasProfile(), .setProfile()]
- "text_audio_text_sync_engine_beatsyncengine": "BeatSyncEngine" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L42 | neighbors=[audio-text-sync-engine.ts, .analyzeBeats(), .calculateSyncedTimings(), .getSubdividedBeats(), .snapClipToNearestBeat(), getBeatSyncEngine()]
- "text_character_animator_characteranimator": "CharacterAnimator" | kind=code-symbol | source=packages/core/src/text/character-animator.ts:L70 | neighbors=[character-animator.ts, .calculateAnimatedLayout(), .constructor(), .createFallbackLayout(), .createStaticLayout(), .measureText()]
- "text_types_textstyle": "TextStyle" | kind=code-symbol | source=packages/core/src/text/types.ts:L56 | neighbors=[animation-importer.ts, resolver.ts, types.ts, text-animation.ts, title-engine.ts, types.ts]
- "timeline_auto_edit_service_autoeditservice": "AutoEditService" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L34 | neighbors=[auto-edit-service.ts, .filterByMinDuration(), .generateCuts(), .getCutPoints(), getAutoEditService(), index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-012.json

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
