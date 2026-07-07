# Node Description Batch 84 of 128

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

- "components_colorscopes_colorscopesprops": "ColorScopesProps" | kind=code-symbol | source=src/components/ColorScopes.tsx:L5 | neighbors=[ColorScopes.tsx]
- "components_exportmodal_ensureffmpegloaded": "ensureFFmpegLoaded()" | kind=code-symbol | source=src/components/ExportModal.tsx:L14 | neighbors=[ExportModal.tsx]
- "components_exportmodal_exportstatus": "ExportStatus" | kind=code-symbol | source=src/components/ExportModal.tsx:L47 | neighbors=[ExportModal.tsx]
- "components_exportmodal_ffmpeg": "ffmpeg" | kind=code-symbol | source=src/components/ExportModal.tsx:L8 | neighbors=[ExportModal.tsx]
- "components_exportmodal_ffmpeglogs": "ffmpegLogs" | kind=code-symbol | source=src/components/ExportModal.tsx:L12 | neighbors=[ExportModal.tsx]
- "components_helpmodal_help_sections": "HELP_SECTIONS" | kind=code-symbol | source=src/components/HelpModal.tsx:L5 | neighbors=[HelpModal.tsx]
- "components_mediapanel_color_correction_effects": "COLOR_CORRECTION_EFFECTS" | kind=code-symbol | source=src/components/MediaPanel.tsx:L105 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_fx_effects": "FX_EFFECTS" | kind=code-symbol | source=src/components/MediaPanel.tsx:L82 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_particle_effects": "PARTICLE_EFFECTS" | kind=code-symbol | source=src/components/MediaPanel.tsx:L117 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_text_templates": "TEXT_TEMPLATES" | kind=code-symbol | source=src/components/MediaPanel.tsx:L180 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_transitioncard": "TransitionCard()" | kind=code-symbol | source=src/components/MediaPanel.tsx:L1927 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_transitioncardprops": "TransitionCardProps" | kind=code-symbol | source=src/components/MediaPanel.tsx:L1919 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_transitions": "TRANSITIONS" | kind=code-symbol | source=src/components/MediaPanel.tsx:L60 | neighbors=[MediaPanel.tsx]
- "components_previewcanvas_interactivecanvasoverlay": "InteractiveCanvasOverlay()" | kind=code-symbol | source=src/components/PreviewCanvas.tsx:L2560 | neighbors=[PreviewCanvas.tsx]
- "components_propertiespanel_colorwheel": "ColorWheel()" | kind=code-symbol | source=src/components/PropertiesPanel.tsx:L65 | neighbors=[PropertiesPanel.tsx]
- "components_propertiespanel_colorwheelprops": "ColorWheelProps" | kind=code-symbol | source=src/components/PropertiesPanel.tsx:L58 | neighbors=[PropertiesPanel.tsx]
- "components_propertiespanel_keyframeicon": "KeyframeIcon()" | kind=code-symbol | source=src/components/PropertiesPanel.tsx:L43 | neighbors=[PropertiesPanel.tsx]
- "components_propertiespanel_presets": "PRESETS" | kind=code-symbol | source=src/components/PropertiesPanel.tsx:L206 | neighbors=[PropertiesPanel.tsx]
- "components_telepromptermodal_telepromptermodalprops": "TeleprompterModalProps" | kind=code-symbol | source=src/components/TeleprompterModal.tsx:L4 | neighbors=[TeleprompterModal.tsx]
- "components_thumbnailmodal_textlayer": "TextLayer" | kind=code-symbol | source=src/components/ThumbnailModal.tsx:L10 | neighbors=[ThumbnailModal.tsx]
- "components_thumbnailmodal_thumbnailmodalprops": "ThumbnailModalProps" | kind=code-symbol | source=src/components/ThumbnailModal.tsx:L4 | neighbors=[ThumbnailModal.tsx]
- "components_timeline_audiobuffertowav": "audioBufferToWav()" | kind=code-symbol | source=src/components/Timeline.tsx:L50 | neighbors=[Timeline.tsx]
- "components_timeline_checkoverlapat": "checkOverlapAt()" | kind=code-symbol | source=src/components/Timeline.tsx:L697 | neighbors=[Timeline.tsx]
- "components_timeline_clip_colors": "CLIP_COLORS" | kind=code-symbol | source=src/components/Timeline.tsx:L712 | neighbors=[Timeline.tsx]
- "components_timeline_formatcentisecondtime": "formatCentisecondTime()" | kind=code-symbol | source=src/components/Timeline.tsx:L637 | neighbors=[Timeline.tsx]
- "components_timeline_generateid": "generateId()" | kind=code-symbol | source=src/components/Timeline.tsx:L669 | neighbors=[Timeline.tsx]
- "components_timeline_handleputererror": "handlePuterError()" | kind=code-symbol | source=src/components/Timeline.tsx:L514 | neighbors=[Timeline.tsx]
- "components_timeline_parsetransliteratedresponse": "parseTransliteratedResponse()" | kind=code-symbol | source=src/components/Timeline.tsx:L541 | neighbors=[Timeline.tsx]
- "components_timeline_playbackautoscroller": "PlaybackAutoScroller()" | kind=code-symbol | source=src/components/Timeline.tsx:L1170 | neighbors=[Timeline.tsx]
- "components_timeline_rulerplayhead": "RulerPlayhead()" | kind=code-symbol | source=src/components/Timeline.tsx:L1117 | neighbors=[Timeline.tsx]
- "components_timeline_synthesizeproceduralsfx": "synthesizeProceduralSFX()" | kind=code-symbol | source=src/components/Timeline.tsx:L114 | neighbors=[Timeline.tsx]
- "components_timeline_transitionpreviewtooltipcanvas": "TransitionPreviewTooltipCanvas()" | kind=code-symbol | source=src/components/Timeline.tsx:L852 | neighbors=[Timeline.tsx]
- "components_timeline_transitiontarget": "TransitionTarget()" | kind=code-symbol | source=src/components/Timeline.tsx:L960 | neighbors=[Timeline.tsx]
- "components_timeline_transitiontargetprops": "TransitionTargetProps" | kind=code-symbol | source=src/components/Timeline.tsx:L840 | neighbors=[Timeline.tsx]
- "components_timeline_workspaceplayhead": "WorkspacePlayhead()" | kind=code-symbol | source=src/components/Timeline.tsx:L1129 | neighbors=[Timeline.tsx]
- "components_transcriptpanel_formatsimpletime": "formatSimpleTime()" | kind=code-symbol | source=src/components/TranscriptPanel.tsx:L188 | neighbors=[TranscriptPanel.tsx]
- "device_device_capabilities_test_createmockprofile": "createMockProfile()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.test.ts:L9 | neighbors=[device-capabilities.test.ts]
- "device_export_estimator_base_fps_estimates": "BASE_FPS_ESTIMATES" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L33 | neighbors=[export-estimator.ts]
- "device_export_estimator_resolution_multipliers": "RESOLUTION_MULTIPLIERS" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L68 | neighbors=[export-estimator.ts]
- "device_export_estimator_test_createmockprofile": "createMockProfile()" | kind=code-symbol | source=packages/core/src/device/export-estimator.test.ts:L10 | neighbors=[export-estimator.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-083.json

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
