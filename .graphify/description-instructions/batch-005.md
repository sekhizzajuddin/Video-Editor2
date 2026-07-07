# Node Description Batch 6 of 128

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

- "actions_action_executor_actionexecutor_applyaction": ".applyAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L201 | neighbors=[ActionExecutor, .applyAudioAction(), .applyClipAction(), .applyEffectAction(), .applyKeyframeAction(), .applyMediaAction()]
- "actions_action_history": "action-history.ts" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L1 | neighbors=[action-executor.ts, ACTION_DESCRIPTIONS, ActionGroup, ActionHistory, AUTO_GROUPABLE_TYPES, getActionDescription()]
- "audio_fft_fft": "FFT" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L1 | neighbors=[audio-effects-engine.ts, fft.ts, .applyHannWindow(), .applySynthesisWindow(), .constructor(), .forward()]
- "beat_detection_index": "index.ts" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L1 | neighbors=[beat-detection-engine.ts, BeatDetectionProcessor, getBeatDetectionProcessor(), initWasmBeatDetection(), isWasmBeatDetectionAvailable(), jsCalculateMean()]
- "effects_expression_engine_expressionengine": "ExpressionEngine" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L44 | neighbors=[expression-engine.ts, .clamp(), .clearCache(), .compile(), .createSafeContext(), .ease()]
- "effects_particle_presets": "particle-presets.ts" | kind=code-symbol | source=packages/core/src/effects/particle-presets.ts:L1 | neighbors=[index.ts, CONFETTI_COLORS, createEffectFromPreset(), DUST_COLORS, FIRE_COLORS, getParticlePresetById()]
- "ffmpeg_ffmpeg_core_getwasmtableentry": "getWasmTableEntry()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii()]
- "frame_interpolation_frame_interpolation_engine": "frame-interpolation-engine.ts" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L1 | neighbors=[flow-field-cache.ts, FlowFieldCache, disposeFrameInterpolationEngine(), FrameInterpolationEngine, getFrameInterpolationEngine(), optical-flow-cpu.ts]
- "public_puter_de": "De" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .close(), .constructor(), .createUri(), ._hostname(), .onClose()]
- "text_text_animation": "text-animation.ts" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L1 | neighbors=[index.ts, AnimatedTextState, CharacterAnimationState, TextAnimationEngine, types.ts, TextAnimation]
- "timeline_nested_sequence_engine": "nested-sequence-engine.ts" | kind=code-symbol | source=packages/core/src/timeline/nested-sequence-engine.ts:L1 | neighbors=[index.ts, COMPOUND_COLORS, CompoundClip, CompoundClipContent, CompoundClipInstance, CreateCompoundClipOptions]
- "ui_alert_dialog": "alert-dialog.tsx" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L1 | neighbors=[utils.ts, cn(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent()]
- "ui_form": "form.tsx" | kind=code-symbol | source=src/components/ui/form.tsx:L1 | neighbors=[utils.ts, cn(), FormControl(), FormDescription(), FormField(), FormFieldContext]
- "utils_mediaprobe": "mediaProbe.ts" | kind=code-symbol | source=src/utils/mediaProbe.ts:L1 | neighbors=[MediaPanel.tsx, SettingsModal.tsx, TopToolbar.tsx, index.ts, MediaItem, MediaType]
- "video_animation_engine": "animation-engine.ts" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L1 | neighbors=[graphics-engine.ts, text-animation.ts, easing-functions.ts, EASING_FUNCTIONS, EasingName, timeline.ts]
- "video_frame_ring_buffer_compositeframebuffer": "CompositeFrameBuffer" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L192 | neighbors=[frame-ring-buffer.ts, .constructor(), .dispose(), .getAllTrackFrames(), .getCompositedFrame(), .getOrCreateTrackBuffer()]
- "video_motion_tracking_engine": "motion-tracking-engine.ts" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L1 | neighbors=[index.ts, generateId(), getMotionTrackingEngine(), initializeMotionTrackingEngine(), MotionTrackingEngine, Point]
- "video_texture_cache_texturecache": "TextureCache" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L20 | neighbors=[texture-cache.ts, .clear(), .constructor(), .evict(), .evictKey(), .evictLRU()]
- "actions_index": "index.ts" | kind=code-symbol | source=packages/core/src/actions/index.ts:L1 | neighbors=[action-executor.ts, ActionExecutor, action-history.ts, ActionGroup, ActionHistory, HistoryEntry]
- "animation_composition_renderer": "composition-renderer.ts" | kind=code-symbol | source=packages/core/src/animation/composition-renderer.ts:L1 | neighbors=[CompositionRenderer, easing-functions.ts, EASING_FUNCTIONS, EasingName, composition.ts, Composition]
- "audio_beat_detection_engine": "beat-detection-engine.ts" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L1 | neighbors=[Beat, BeatAnalysisResult, BeatDetectionConfig, BeatDetectionEngine, DEFAULT_BEAT_DETECTION_CONFIG, disposeBeatDetectionEngine()]
- "audio_sound_generator": "sound-generator.ts" | kind=code-symbol | source=packages/core/src/audio/sound-generator.ts:L1 | neighbors=[index.ts, CHORD_PROGRESSIONS, GeneratedSound, getSoundGenerator(), MELODY_PATTERNS, NOTE_FREQUENCIES]
- "media_waveform_renderer": "waveform-renderer.ts" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L1 | neighbors=[index.ts, types.ts, WaveformData, waveform-generator.ts, getWaveformGenerator(), MultiResolutionWaveform]
- "media_waveform_renderer_waveformrenderer": "WaveformRenderer" | kind=code-symbol | source=packages/core/src/media/waveform-renderer.ts:L46 | neighbors=[index.ts, waveform-renderer.ts, createClipWaveformThumbnail(), createWaveformImage(), .getAmplitudeAtPosition(), .getOptimalResolution()]
- "text_audio_text_sync_engine": "audio-text-sync-engine.ts" | kind=code-symbol | source=packages/core/src/text/audio-text-sync-engine.ts:L1 | neighbors=[beat-detection-engine.ts, BeatAnalysisResult, getBeatDetectionEngine(), BeatSyncConfig, BeatSyncEngine, ClipInfo]
- "types_result": "result.ts" | kind=code-symbol | source=packages/core/src/types/result.ts:L1 | neighbors=[index.ts, combine(), err(), flatMap(), fromNullable(), fromPromise()]
- "types_sound_library": "sound-library.ts" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L1 | neighbors=[sound-generator.ts, sound-library-engine.ts, index.ts, BeatMarker, MOOD_TAGS, MoodTag]
- "types_timeline_easingtype": "EasingType" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L146 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, gsap-engine.ts, types.ts, graphics-engine.test.ts]
- "video_adjustment_layer_engine": "adjustment-layer-engine.ts" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L1 | neighbors=[timeline.ts, Effect, Transform, AdjustmentLayer, AdjustmentLayerEffect, AdjustmentLayerEngine]
- "audio_sound_library_engine": "sound-library-engine.ts" | kind=code-symbol | source=packages/core/src/audio/sound-library-engine.ts:L1 | neighbors=[index.ts, sound-generator.ts, getSoundGenerator(), createSoundLibraryEngine(), SoundLibraryEngine, sound-library.ts]
- "audio_volume_automation_audioducker": "AudioDucker" | kind=code-symbol | source=packages/core/src/audio/volume-automation.ts:L552 | neighbors=[volume-automation.ts, .applyDucking(), .constructor(), .createRealtimeDucker(), .deduplicateKeyframes(), .detectAudioPresence()]
- "editing_templates_built_in_templates": "built-in-templates.ts" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L1 | neighbors=[bind(), BUILT_IN_EDITING_TEMPLATES, full, shapeOverlay(), textOverlay(), transform()]
- "export_export_worker": "export-worker.ts" | kind=code-symbol | source=packages/core/src/export/export-worker.ts:L1 | neighbors=[addAudio(), cancel(), finalize(), frameQueue, initialize(), processFrame()]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine": "FrameInterpolationEngine" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L7 | neighbors=[frame-interpolation-engine.ts, .constructor(), .dispose(), .extractPixelData(), .initialize(), .interpolate()]
- "media_mediabunny_engine_mediabunnyengine_ensureinitialized": ".ensureInitialized()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L226 | neighbors=[MediaBunnyEngine, .checkCodecSupport(), .convertMedia(), .createExportDecoder(), .createInput(), .exportImageSequence()]
- "stabilization_stabilization_engine_stabilizationengine": "StabilizationEngine" | kind=code-symbol | source=packages/core/src/video/stabilization/stabilization-engine.ts:L21 | neighbors=[index.ts, stabilization-engine.ts, getStabilizationEngine(), .analyzeClip(), .clampMotionSample(), .constructor()]
- "storage_storage_engine_storageengine_transaction": ".transaction()" | kind=code-symbol | source=packages/core/src/storage/storage-engine.ts:L118 | neighbors=[StorageEngine, .deleteCache(), .deleteMedia(), .deleteWaveform(), .loadCache(), .loadMedia()]
- "text_transcription_service_transcriptionservice": "TranscriptionService" | kind=code-symbol | source=packages/core/src/text/transcription-service.ts:L46 | neighbors=[transcription-service.ts, initializeTranscriptionService(), .audioBufferToWav(), .constructor(), .convertToSubtitles(), .createSubtitleFromWords()]
- "timeline_auto_edit_service": "auto-edit-service.ts" | kind=code-symbol | source=packages/core/src/timeline/auto-edit-service.ts:L1 | neighbors=[beat-detection-engine.ts, Beat, BeatAnalysisResult, AutoEditCut, AutoEditOptions, AutoEditResult]
- "ui_dialog": "dialog.tsx" | kind=code-symbol | source=src/components/ui/dialog.tsx:L1 | neighbors=[command.tsx, utils.ts, cn(), Dialog(), DialogClose(), DialogContent()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-005.json

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
