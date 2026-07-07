# Node Description Batch 10 of 128

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

- "video_chroma_key_engine": "chroma-key-engine.ts" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L1 | neighbors=[ChromaKeyEngine, ChromaKeyEngineConfig, ChromaKeyMatte, ChromaKeyResult, ChromaKeySettings, createDefaultChromaKeySettings()]
- "video_frame_cache": "frame-cache.ts" | kind=code-symbol | source=packages/core/src/video/frame-cache.ts:L1 | neighbors=[DEFAULT_CONFIG, FrameCache, PreloadManager, PreloadTask, types.ts, CachedFrame]
- "video_frame_ring_buffer": "frame-ring-buffer.ts" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L1 | neighbors=[CompositeFrameBuffer, disposeFrameBuffers(), FrameData, FrameRingBuffer, FrameRingBufferStats, getCompositeFrameBuffer()]
- "video_transition_engine_transitionengine_getcontext": ".getContext()" | kind=code-symbol | source=packages/core/src/video/transition-engine.ts:L63 | neighbors=[TransitionEngine, .fitToCanvas(), .initializeCanvas(), .renderCrossfade(), .renderDipToColor(), .renderSlide()]
- "actions_action_history_actionhistory_notify": ".notify()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L128 | neighbors=[ActionHistory, .clear(), .createSnapshot(), .deleteSnapshot(), .endGroup(), .push()]
- "animation_animation_exporter_animationexporter_export": ".export()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L46 | neighbors=[AnimationExporter, .exportAssets(), .exportAudioTracks(), .exportImageClip(), .exportShapeClip(), .exportTextClip()]
- "audio_audio_effects_engine_audioeffectsengine_createeffectnode": ".createEffectNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L776 | neighbors=[AudioEffectsEngine, .buildEffectChain(), .createCompressorNodePair(), .createDelayNode(), .createEQNodePair(), .createGainNodePair()]
- "audio_effects_worklet_processor": "effects-worklet-processor.ts" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L1 | neighbors=[createEffectsWorkletBlob(), createEffectsWorkletNode(), createEffectsWorkletUrl(), DEFAULT_EFFECT_WORKLET_PARAMS, EffectWorkletParams, loadEffectsWorklet()]
- "audio_sound_generator_soundgenerator_generatefulltrack": ".generateFullTrack()" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1781 | neighbors=[SoundGenerator, .audioBufferToBlob(), .createCrispSnare(), .createPunchyKick(), .createReverbImpulse(), .createRichBass()]
- "audio_volume_automation_volumeautomation_applyinterpolation": ".applyInterpolation()" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L174 | neighbors=[VolumeAutomation, .applyFadeIn(), .applyFadeOut(), .applyFades(), .generateBezierCurve(), .generateLogarithmicCurve()]
- "export_export_engine_exportengine_exportaudio": ".exportAudio()" | kind=code-symbol | source=packages/core/src/export/export-engine.ts:L552 | neighbors=[ExportEngine, .calculateTimelineDuration(), .createError(), .createProgress(), .encodeAudioWithMediaBunny(), .encodeWav()]
- "ffmpeg_ffmpeg_core_writesockaddr": "writeSockaddr()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, ___syscall_accept4(), ___syscall_getpeername(), ___syscall_getsockname(), ___syscall_recvfrom(), inetPton4()]
- "graphics_graphics_engine_test": "graphics-engine.test.ts" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.test.ts:L1 | neighbors=[graphics-engine.ts, GraphicsEngine, MockCanvas, MockCanvasContext, types.ts, EmphasisAnimation]
- "graphics_svg_animation_presets": "svg-animation-presets.ts" | kind=code-symbol | source=packages/core/src/graphics/svg-animation-presets.ts:L1 | neighbors=[index.ts, createDefaultSVGAnimation(), getSVGPresetInfo(), SVG_ANIMATION_PRESETS, SVGAnimationPresetInfo, types.ts]
- "media_ffmpeg_fallback_ffmpegfallback_generateproxy": ".generateProxy()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L338 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load(), .removeProgressTracking()]
- "media_ffmpeg_fallback_ffmpegfallback_removeprogresstracking": ".removeProgressTracking()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L234 | neighbors=[FFmpegFallback, .encodeFrameSequence(), .exportVideoDirectly(), .extractAudioAsWav(), .extractRange(), .generateProxy()]
- "media_ffmpeg_fallback_ffmpegfallback_transcodetocompatible": ".transcodeToCompatible()" | kind=code-symbol | source=packages/core/src/media/ffmpeg-fallback.ts:L240 | neighbors=[FFmpegFallback, .cleanupFiles(), .ensureLoaded(), .fileToUint8Array(), .load(), .removeProgressTracking()]
- "media_mediabunny_engine_getmediaengine": "getMediaEngine()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L1169 | neighbors=[export-engine.ts, index.ts, media-import-service.ts, mediabunny-engine.ts, MediaBunnyEngine, initializeMediaEngine()]
- "public_puter_b": "B()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, D(), .requestPermission(), L(), M(), R()]
- "public_puter_un": "Un" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .create(), .delete(), .exec(), .get()]
- "public_puter_xt_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, Le(), vt(), .randomizationFactor(), .reconnection(), .reconnectionAttempts()]
- "src_commands_addlayercommand": "AddLayerCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L219 | neighbors=[commands.ts, .apply(), .constructor(), .description(), .invert(), Command]
- "src_commands_applyadjustmentcommand": "ApplyAdjustmentCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L457 | neighbors=[commands.ts, .apply(), .constructor(), .description(), .invert(), .merge()]
- "src_commands_grouplayerscommand": "GroupLayersCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L563 | neighbors=[commands.ts, Command, .apply(), .constructor(), .description(), .invert()]
- "src_commands_pastelayerscommand": "PasteLayersCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L662 | neighbors=[commands.ts, Command, .apply(), .constructor(), .description(), .invert()]
- "src_commands_ungrouplayerscommand": "UngroupLayersCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L611 | neighbors=[commands.ts, .invert(), commands.test.ts, Command, .apply(), .constructor()]
- "src_commands_updatelayerstylecommand": "UpdateLayerStyleCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L372 | neighbors=[commands.ts, commands.test.ts, Command, .apply(), .constructor(), .description()]
- "src_commands_updatelayertransformcommand": "UpdateLayerTransformCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L333 | neighbors=[commands.ts, commands.test.ts, Command, .apply(), .constructor(), .description()]
- "src_commands_updatetextcommand": "UpdateTextCommand" | kind=code-symbol | source=packages/image-core/src/commands.ts:L413 | neighbors=[commands.ts, commands.test.ts, Command, .apply(), .constructor(), .description()]
- "text_text_animation_presets_geteasing": "getEasing()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L44 | neighbors=[text-animation-presets.ts, blurAnimation(), fadeAnimation(), flipAnimation(), rotateAnimation(), scaleAnimation()]
- "text_types_textclip": "TextClip" | kind=code-symbol | source=packages/core/src/text/types.ts:L9 | neighbors=[animation-exporter.ts, animation-importer.ts, character-animator.ts, text-animation.ts, title-engine.ts, types.ts]
- "timeline_track_manager_trackmanager_createprojectwrapper": ".createProjectWrapper()" | kind=code-symbol | source=packages/core/src/timeline/track-manager.ts:L238 | neighbors=[TrackManager, .addTrack(), .removeTrack(), .reorderTrack(), .setTrackHidden(), .setTrackLocked()]
- "types_actions_action": "Action" | kind=code-symbol | source=packages/core/src/types/actions.ts:L9 | neighbors=[action-executor.ts, action-history.ts, action-serializer.ts, action-validator.ts, inverse-action-generator.ts, clip-manager.ts]
- "types_lottie_baselottielayer": "BaseLottieLayer" | kind=code-symbol | source=packages/core/src/types/lottie.ts:L55 | neighbors=[index.ts, lottie.ts, LottieImageLayer, LottieNullLayer, LottiePrecompLayer, LottieShapeLayer]
- "types_timeline_subtitle": "Subtitle" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L214 | neighbors=[template-engine.ts, caption-animation-renderer.ts, speech-to-text-engine.ts, subtitle-engine.ts, transcription-service.ts, template.ts]
- "ui_button_group": "button-group.tsx" | kind=code-symbol | source=src/components/ui/button-group.tsx:L1 | neighbors=[utils.ts, cn(), ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants]
- "utils_aibackground": "aiBackground.ts" | kind=code-symbol | source=src/utils/aiBackground.ts:L1 | neighbors=[PreviewCanvas.tsx, applyAiBackgroundMask(), initInstance(), loadMediaPipe(), onResults(), pendingResolves]
- "utils_autocaptions": "autoCaptions.ts" | kind=code-symbol | source=src/utils/autoCaptions.ts:L1 | neighbors=[TopToolbar.tsx, editorStore.ts, useEditorStore, index.ts, TimelineClip, dummyPhrases]
- "utils_index": "index.ts" | kind=code-symbol | source=packages/core/src/utils/index.ts:L1 | neighbors=[photo-adjustments.ts, photo-engine.ts, index.ts, immutable-updates.ts, clamp(), deepClone()]
- "utils_keyframes": "keyframes.ts" | kind=code-symbol | source=src/utils/keyframes.ts:L1 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts, editorStore.ts, index.ts, PropertyKeyframe]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-009.json

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
