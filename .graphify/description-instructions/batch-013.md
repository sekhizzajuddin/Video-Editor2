# Node Description Batch 14 of 128

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

- "timeline_clip_manager_clipmanager_findclip": ".findClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L375 | neighbors=[ClipManager, .deleteClip(), .moveClip(), .rippleDeleteClip(), .splitClip(), .trimClip()]
- "timeline_clip_manager_test": "clip-manager.test.ts" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.test.ts:L1 | neighbors=[clip-manager.ts, ClipManager, createMockClip(), createMockTimeline(), createMockTrack(), index.ts]
- "types_index_timelineclip": "TimelineClip" | kind=code-symbol | source=src/types/index.ts:L283 | neighbors=[Timeline.tsx, TranscriptPanel.tsx, editorStore.ts, index.ts, autoCaptions.ts, smartReframe.ts]
- "types_index_timelinetrack": "TimelineTrack" | kind=code-symbol | source=src/types/index.ts:L362 | neighbors=[AudioMixer.tsx, PreviewCanvas.tsx, Timeline.tsx, editorStore.ts, index.ts, projectPersistence.ts]
- "ui_accordion": "accordion.tsx" | kind=code-symbol | source=src/components/ui/accordion.tsx:L1 | neighbors=[utils.ts, cn(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger()]
- "ui_alert": "alert.tsx" | kind=code-symbol | source=src/components/ui/alert.tsx:L1 | neighbors=[utils.ts, cn(), Alert(), AlertDescription(), AlertTitle(), alertVariants]
- "ui_input_otp": "input-otp.tsx" | kind=code-symbol | source=src/components/ui/input-otp.tsx:L1 | neighbors=[utils.ts, cn(), InputOTP(), InputOTPGroup(), InputOTPSeparator(), InputOTPSlot()]
- "ui_popover": "popover.tsx" | kind=code-symbol | source=src/components/ui/popover.tsx:L1 | neighbors=[utils.ts, cn(), Popover(), PopoverAnchor(), PopoverContent(), PopoverTrigger()]
- "ui_tabs": "tabs.tsx" | kind=code-symbol | source=src/components/ui/tabs.tsx:L1 | neighbors=[utils.ts, cn(), Tabs(), TabsContent(), TabsList(), TabsTrigger()]
- "upscaling_upscaling_engine_upscalingengine_applylanczos": ".applyLanczos()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L334 | neighbors=[UpscalingEngine, .getPooledTexture(), .releaseTexture(), .upscaleBalanced(), .upscaleFast(), .upscaleQuality()]
- "upscaling_upscaling_engine_upscalingengine_upscale": ".upscale()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L224 | neighbors=[UpscalingEngine, .shouldUpscale(), .upscaleBalanced(), .upscaleFast(), .upscaleQuality(), .upscaleImageBitmap()]
- "upscaling_upscaling_engine_upscalingengine_upscalebalanced": ".upscaleBalanced()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L288 | neighbors=[UpscalingEngine, .upscale(), .applyEdgeDetection(), .applyEdgeDirected(), .applyLanczos(), .releaseTexture()]
- "utils_keyboardshortcuts": "keyboardShortcuts.ts" | kind=code-symbol | source=src/utils/keyboardShortcuts.ts:L1 | neighbors=[SettingsModal.tsx, App.tsx, DEFAULT_SHORTCUTS, getShortcutString(), KeyboardShortcutDef, SHORTCUT_PROFILES]
- "utils_projectpersistence_restoresnapshotmedia": "restoreSnapshotMedia()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L228 | neighbors=[SettingsModal.tsx, projectPersistence.ts, loadProjectFromDB(), generateFrameStrip(), generateVideoThumbnail(), getFileFromDB()]
- "utils_smartreframe": "smartReframe.ts" | kind=code-symbol | source=src/utils/smartReframe.ts:L1 | neighbors=[PropertiesPanel.tsx, index.ts, ClipAnimations, PropertyKeyframe, TimelineClip, generateSmartReframeKeyframes()]
- "utils_speedramp_getmediatimeatposition": "getMediaTimeAtPosition()" | kind=code-symbol | source=src/utils/speedRamp.ts:L117 | neighbors=[PropertiesPanel.tsx, editorStore.ts, speedRamp.ts, getIntegralTable(), getSpeedAtPosition(), getMediaTimeForClip()]
- "utils_speedramp_getspeedatposition": "getSpeedAtPosition()" | kind=code-symbol | source=src/utils/speedRamp.ts:L29 | neighbors=[PropertiesPanel.tsx, useMediaPlayback.ts, speedRamp.ts, getIntegralTable(), getMediaTimeAtPosition(), getFullKeyframes()]
- "utils_time": "time.ts" | kind=code-symbol | source=src/utils/time.ts:L1 | neighbors=[ExportModal.tsx, PreviewCanvas.tsx, Timeline.tsx, formatSimpleTime(), formatTime(), snapToGrid()]
- "video_chroma_key_engine_chromakeyengine_applychromakeywithsettings": ".applyChromaKeyWithSettings()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L176 | neighbors=[ChromaKeyEngine, .applyChromaKey(), .calculateAlpha(), .colorDistance(), .resizeTo(), .suppressSpill()]
- "video_chroma_key_engine_chromakeyengine_resizeto": ".resizeTo()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L63 | neighbors=[ChromaKeyEngine, .applyChromaKeyWithSettings(), .composite(), .countTransparentPixels(), .getMatte(), .sampleKeyColor()]
- "video_chroma_key_engine_createdefaultchromakeysettings": "createDefaultChromaKeySettings()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L41 | neighbors=[chroma-key-engine.ts, .enableChromaKey(), .setEdgeSoftness(), .setKeyColor(), .setSpillSuppression(), .setTolerance()]
- "video_mask_engine_maskengine_applymask": ".applyMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L635 | neighbors=[MaskEngine, .applyExpansion(), .applyFeathering(), .generateMaskFromPath(), .getMaskAtTime(), .resizeTo()]
- "video_motion_tracking_engine_motiontrackingengine_runtracking": ".runTracking()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L110 | neighbors=[MotionTrackingEngine, generateId(), .notifyProgress(), .notifyTrackingLost(), .simulateTracking(), .startTracking()]
- "video_playback_engine_playbackengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L544 | neighbors=[PlaybackEngine, .clearStreams(), .decodeLoop(), .stop(), .getImmediateFrame(), .setupStreams()]
- "video_playback_engine_playbackengine_setstate": ".setState()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L535 | neighbors=[PlaybackEngine, .pause(), .play(), .resume(), .seek(), .stop()]
- "video_renderer_factory_renderer": "Renderer" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L21 | neighbors=[canvas2d-fallback-renderer.ts, gpu-compositor.ts, renderer-factory.ts, video-effects-engine.ts, video-engine.ts, webgpu-renderer-impl.ts]
- "video_texture_cache_texturecache_evictkey": ".evictKey()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L103 | neighbors=[TextureCache, .clear(), .evict(), .get(), .evictLRU(), .set()]
- "video_types_blendmode": "BlendMode" | kind=code-symbol | source=packages/core/src/video/types.ts:L18 | neighbors=[types.ts, adjustment-layer-engine.ts, composite-engine.ts, gpu-compositor.ts, types.ts, video-engine.ts]
- "video_video_effects_engine_videoeffectsengine_applyeffectscpu": ".applyEffectsCPU()" | kind=code-symbol | source=packages/core/src/video/video-effects-engine.ts:L970 | neighbors=[VideoEffectsEngine, .applyEffects(), .applyEffectPixelLevel(), .buildCSSFilter(), ._applyEffectsGPU(), ._applyEffectsWithNewRenderer()]
- "video_video_engine_videoengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L124 | neighbors=[initializeVideoEngine(), VideoEngine, .decodeFrameWithMediaBunny(), .drawMaskedSubjectFromFrame(), .isWebCodecsSupported(), .renderFrame()]
- "video_video_engine_videoengine_preloadframesrange": ".preloadFramesRange()" | kind=code-symbol | source=packages/core/src/video/video-engine.ts:L2632 | neighbors=[VideoEngine, .cacheFrame(), .dispose(), .ensureInitialized(), .getCacheKey(), .processPreloadQueue()]
- "wav_index_wavencoder_encodefullwav": ".encodeFullWav()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L286 | neighbors=[WavEncoder, .encodeWav16Mono(), .encodeWav16Stereo(), .encodeWav24Mono(), .encodeWav24Stereo(), .writeWavHeader()]
- "actions_inverse_action_generator_inverseactiongenerator_generateclipinverse": ".generateClipInverse()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L252 | neighbors=[InverseActionGenerator, .generate(), .cloneClip(), .createInverseAction(), .findClip()]
- "ai_auto_reframe_engine_autoreframeengine_analyzeclip": ".analyzeClip()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L186 | neighbors=[AutoReframeEngine, .calculateOptimalCrop(), .detectFaces(), .getTargetConfig(), .smoothKeyframes()]
- "animation_animation_exporter_animationexporter_convertkeyframestoanimations": ".convertKeyframesToAnimations()" | kind=code-symbol | source=packages/core/src/animation/animation-exporter.ts:L400 | neighbors=[AnimationExporter, .exportImageClip(), .exportShapeClip(), .exportTextClip(), .exportVideoClip()]
- "animation_animation_importer_animationimporter_convertanimationstokeyframes": ".convertAnimationsToKeyframes()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L527 | neighbors=[AnimationImporter, .processImageLayer(), .processShapeLayer(), .processTextLayer(), .processVideoLayer()]
- "animation_animation_importer_animationimporter_import": ".import()" | kind=code-symbol | source=packages/core/src/animation/animation-importer.ts:L103 | neighbors=[AnimationImporter, .createDefaultTransform(), .processLayer(), createDefaultMediaMetadata(), importAnimation()]
- "animation_animation_schema_animationschema": "AnimationSchema" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L3 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, AnimationTemplate, index.ts]
- "animation_animation_schema_imagelayer": "ImageLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L189 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, BaseLayer, index.ts]
- "animation_animation_schema_shapelayer": "ShapeLayer" | kind=code-symbol | source=packages/core/src/animation/animation-schema.ts:L218 | neighbors=[animation-exporter.ts, animation-importer.ts, animation-schema.ts, BaseLayer, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-013.json

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
