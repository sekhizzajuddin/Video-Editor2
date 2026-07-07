# Node Description Batch 17 of 128

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

- "storage_index": "index.ts" | kind=code-symbol | source=packages/core/src/storage/index.ts:L1 | neighbors=[index.ts, cache-manager.ts, project-serializer.ts, storage-engine.ts, types.ts]
- "storage_types_istorageengine": "IStorageEngine" | kind=code-symbol | source=packages/core/src/storage/types.ts:L91 | neighbors=[waveform-generator.ts, cache-manager.ts, project-serializer.ts, storage-engine.ts, types.ts]
- "template_template_engine_templateengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/template/template-engine.ts:L1105 | neighbors=[TemplateEngine, .deleteTemplate(), .listTemplates(), .loadTemplate(), .saveTemplate()]
- "text_subtitle_engine_parsesrt": "parseSRT()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L127 | neighbors=[subtitle-engine.ts, normalizeSRT(), generateSubtitleId(), parseSRTTimestamp(), .importSRT()]
- "text_title_engine_titleengine_measuretext": ".measureText()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L372 | neighbors=[TitleEngine, .applyTextStyle(), .initialize(), .wrapText(), .renderText()]
- "text_types_textanimation": "TextAnimation" | kind=code-symbol | source=packages/core/src/text/types.ts:L95 | neighbors=[types.ts, text-animation.ts, text-animation-presets.ts, title-engine.ts, types.ts]
- "timeline_clip_manager_clipmanager_moveclip": ".moveClip()" | kind=code-symbol | source=packages/core/src/timeline/clip-manager.ts:L130 | neighbors=[ClipManager, .createProjectWrapper(), .findClip(), .findNonOverlappingPosition(), .snapToGrid()]
- "types_composition_vector2d": "Vector2D" | kind=code-symbol | source=packages/core/src/types/composition.ts:L19 | neighbors=[composition.ts, Vector3D, index.ts, shape-tools.ts, transitions.ts]
- "types_timeline_clipmetadata": "ClipMetadata" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L57 | neighbors=[graphics-engine.ts, types.ts, title-engine.ts, types.ts, timeline.ts]
- "types_timeline_subtitlestyle": "SubtitleStyle" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L224 | neighbors=[speech-to-text-engine.ts, subtitle-engine.ts, transcription-service.ts, actions.ts, timeline.ts]
- "types_timeline_transition": "Transition" | kind=code-symbol | source=packages/core/src/types/timeline.ts:L191 | neighbors=[inverse-action-generator.ts, timeline.ts, immutable-updates.ts, transition-engine.ts, video-engine.ts]
- "ui_avatar": "avatar.tsx" | kind=code-symbol | source=src/components/ui/avatar.tsx:L1 | neighbors=[utils.ts, cn(), Avatar(), AvatarFallback(), AvatarImage()]
- "ui_button_buttonvariants": "buttonVariants" | kind=code-symbol | source=src/components/ui/button.tsx:L7 | neighbors=[alert-dialog.tsx, button.tsx, Button(), calendar.tsx, pagination.tsx]
- "ui_carousel_usecarousel": "useCarousel()" | kind=code-symbol | source=src/components/ui/carousel.tsx:L33 | neighbors=[carousel.tsx, CarouselContent(), CarouselItem(), CarouselNext(), CarouselPrevious()]
- "ui_form_useformfield": "useFormField()" | kind=code-symbol | source=src/components/ui/form.tsx:L45 | neighbors=[form.tsx, FormControl(), FormDescription(), FormLabel(), FormMessage()]
- "ui_hover_card": "hover-card.tsx" | kind=code-symbol | source=src/components/ui/hover-card.tsx:L1 | neighbors=[utils.ts, cn(), HoverCard(), HoverCardContent(), HoverCardTrigger()]
- "ui_input": "input.tsx" | kind=code-symbol | source=src/components/ui/input.tsx:L1 | neighbors=[utils.ts, cn(), Input(), input-group.tsx, sidebar.tsx]
- "ui_label": "label.tsx" | kind=code-symbol | source=src/components/ui/label.tsx:L1 | neighbors=[field.tsx, form.tsx, utils.ts, cn(), Label()]
- "ui_resizable": "resizable.tsx" | kind=code-symbol | source=src/components/ui/resizable.tsx:L1 | neighbors=[utils.ts, cn(), ResizableHandle(), ResizablePanel(), ResizablePanelGroup()]
- "ui_separator_separator": "Separator()" | kind=code-symbol | source=src/components/ui/separator.tsx:L8 | neighbors=[button-group.tsx, field.tsx, item.tsx, separator.tsx, sidebar.tsx]
- "ui_sidebar_usesidebar": "useSidebar()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L47 | neighbors=[sidebar.tsx, Sidebar(), SidebarMenuButton(), SidebarRail(), SidebarTrigger()]
- "ui_toggle": "toggle.tsx" | kind=code-symbol | source=src/components/ui/toggle.tsx:L1 | neighbors=[utils.ts, cn(), Toggle(), toggleVariants, toggle-group.tsx]
- "upscaling_index": "index.ts" | kind=code-symbol | source=packages/core/src/video/upscaling/index.ts:L1 | neighbors=[export-engine.ts, index.ts, upscaling-engine.ts, upscaling-types.ts, index.ts]
- "upscaling_upscaling_engine_upscalingengine_getpooledtexture": ".getPooledTexture()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L578 | neighbors=[UpscalingEngine, .applyEdgeDetection(), .applyEdgeDirected(), .applyLanczos(), .applySharpen()]
- "upscaling_upscaling_engine_upscalingengine_releasetexture": ".releaseTexture()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L603 | neighbors=[UpscalingEngine, .applyLanczos(), .upscaleBalanced(), .upscaleImageBitmap(), .upscaleQuality()]
- "upscaling_upscaling_engine_upscalingengine_upscaleimagebitmap": ".upscaleImageBitmap()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L624 | neighbors=[UpscalingEngine, .canvas2DFallback(), .releaseTexture(), .textureToImageBitmap(), .upscale()]
- "utils_beatdetection": "beatDetection.ts" | kind=code-symbol | source=src/utils/beatDetection.ts:L1 | neighbors=[MediaPanel.tsx, BeatDetectionResult, detectBeats(), getDecodeContext(), smoothArray()]
- "utils_immutable_updates_updatetrackintimeline": "updateTrackInTimeline()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L35 | neighbors=[immutable-updates.ts, addClipToTrack(), addTransitionToTrack(), removeTransitionFromTrack(), updateTrackProperty()]
- "utils_keyframes_getanimatedvalue": "getAnimatedValue()" | kind=code-symbol | source=src/utils/keyframes.ts:L11 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts, editorStore.ts, keyframes.ts]
- "utils_projectpersistence_getfilefromdb": "getFileFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L139 | neighbors=[PropertiesPanel.tsx, projectPersistence.ts, getDB(), resolveMediaItemFromDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_resolvemediaitemfromdb": "resolveMediaItemFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L607 | neighbors=[editorStore.ts, projectPersistence.ts, generateFrameStrip(), generateVideoThumbnail(), getFileFromDB()]
- "utils_speedramp_getmediatimeforclip": "getMediaTimeForClip()" | kind=code-symbol | source=src/utils/speedRamp.ts:L141 | neighbors=[PreviewCanvas.tsx, useMediaPlayback.ts, editorStore.ts, speedRamp.ts, getMediaTimeAtPosition()]
- "utils_waveformrenderer": "waveformRenderer.ts" | kind=code-symbol | source=src/utils/waveformRenderer.ts:L1 | neighbors=[createWaveformCanvas(), renderWaveform(), renderWaveformToDataUrl(), roundRect(), WaveformRenderOptions]
- "video_adjustment_layer_engine_adjustmentlayerengine_updatelayer": ".updateLayer()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L138 | neighbors=[AdjustmentLayerEngine, .setAffectedTracks(), .setBlendMode(), .setEnabled(), .setOpacity()]
- "video_frame_ring_buffer_frameringbuffer_presentorfallback": ".presentOrFallback()" | kind=code-symbol | source=packages/core/src/video/frame-ring-buffer.ts:L89 | neighbors=[.getAllTrackFrames(), .getCompositedFrame(), .getTrackFrame(), FrameRingBuffer, .present()]
- "video_gpu_compositor_gpucompositor_sortlayers": ".sortLayers()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L180 | neighbors=[GPUCompositor, .addLayer(), .removeLayer(), .setLayerZIndex(), .updateLayer()]
- "video_keyframe_engine_keyframeengine_applyeasing": ".applyEasing()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L233 | neighbors=[KeyframeEngine, .easeIn(), .easeInOut(), .easeOut(), .getValueAtTime()]
- "video_mask_engine_generateid": "generateId()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L104 | neighbors=[mask-engine.ts, .addMaskKeyframe(), .createDrawnMask(), .createShapeMask(), .createTrackMatteMask()]
- "video_mask_engine_maskengine_applymaskdefinition": ".applyMaskDefinition()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L679 | neighbors=[MaskEngine, .applyExpansion(), .applyFeathering(), .generateMaskShape(), .resizeTo()]
- "video_parallel_frame_decoder_parallelframedecoder_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L78 | neighbors=[initializeParallelDecoder(), ParallelFrameDecoder, .decodeFrame(), .decodeFrames(), .doInitialize()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-016.json

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
