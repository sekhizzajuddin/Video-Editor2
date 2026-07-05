# Node Description Batch 8 of 16

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

- "components_mediapanel_transitioncard": "TransitionCard()" | kind=code-symbol | source=components/MediaPanel.tsx:L1700 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_transitioncardprops": "TransitionCardProps" | kind=code-symbol | source=components/MediaPanel.tsx:L1692 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_transitions": "TRANSITIONS" | kind=code-symbol | source=components/MediaPanel.tsx:L61 | neighbors=[MediaPanel.tsx]
- "components_previewcanvas_applychromakeyondata": "applyChromaKeyOnData()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L2954 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_applycolorgradingwheelsondata": "applyColorGradingWheelsOnData()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L3007 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_applycoloroverlays": "applyColorOverlays()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L2882 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_drawmediaplaceholder": "drawMediaPlaceholder()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L2834 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_drawparticleshape": "drawParticleShape()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L347 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_drawperspectivetexture": "drawPerspectiveTexture()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L163 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_getprojectedcorners": "getProjectedCorners()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L93 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_imagecache": "imageCache" | kind=code-symbol | source=components/PreviewCanvas.tsx:L29 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_imageloading": "imageLoading" | kind=code-symbol | source=components/PreviewCanvas.tsx:L30 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_localcornerpoints": "LocalCornerPoints" | kind=code-symbol | source=components/PreviewCanvas.tsx:L86 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_particle": "Particle" | kind=code-symbol | source=components/PreviewCanvas.tsx:L256 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_particleeffecttype": "ParticleEffectType" | kind=code-symbol | source=components/PreviewCanvas.tsx:L252 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_particlepool": "ParticlePool" | kind=code-symbol | source=components/PreviewCanvas.tsx:L269 | neighbors=[PreviewCanvas.tsx]
- "components_previewcanvas_particlepools": "particlePools" | kind=code-symbol | source=components/PreviewCanvas.tsx:L275 | neighbors=[PreviewCanvas.tsx]
- "components_propertiespanel_colorwheel": "ColorWheel()" | kind=code-symbol | source=components/PropertiesPanel.tsx:L61 | neighbors=[PropertiesPanel.tsx]
- "components_propertiespanel_colorwheelprops": "ColorWheelProps" | kind=code-symbol | source=components/PropertiesPanel.tsx:L54 | neighbors=[PropertiesPanel.tsx]
- "components_propertiespanel_keyframeicon": "KeyframeIcon()" | kind=code-symbol | source=components/PropertiesPanel.tsx:L39 | neighbors=[PropertiesPanel.tsx]
- "components_propertiespanel_presets": "PRESETS" | kind=code-symbol | source=components/PropertiesPanel.tsx:L167 | neighbors=[PropertiesPanel.tsx]
- "components_timeline_audiobuffertowav": "audioBufferToWav()" | kind=code-symbol | source=components/Timeline.tsx:L36 | neighbors=[Timeline.tsx]
- "components_timeline_checkoverlapat": "checkOverlapAt()" | kind=code-symbol | source=components/Timeline.tsx:L681 | neighbors=[Timeline.tsx]
- "components_timeline_clip_colors": "CLIP_COLORS" | kind=code-symbol | source=components/Timeline.tsx:L696 | neighbors=[Timeline.tsx]
- "components_timeline_formatcentisecondtime": "formatCentisecondTime()" | kind=code-symbol | source=components/Timeline.tsx:L621 | neighbors=[Timeline.tsx]
- "components_timeline_generateid": "generateId()" | kind=code-symbol | source=components/Timeline.tsx:L653 | neighbors=[Timeline.tsx]
- "components_timeline_handleputererror": "handlePuterError()" | kind=code-symbol | source=components/Timeline.tsx:L498 | neighbors=[Timeline.tsx]
- "components_timeline_parsetransliteratedresponse": "parseTransliteratedResponse()" | kind=code-symbol | source=components/Timeline.tsx:L525 | neighbors=[Timeline.tsx]
- "components_timeline_playbackautoscroller": "PlaybackAutoScroller()" | kind=code-symbol | source=components/Timeline.tsx:L1150 | neighbors=[Timeline.tsx]
- "components_timeline_rulerplayhead": "RulerPlayhead()" | kind=code-symbol | source=components/Timeline.tsx:L1097 | neighbors=[Timeline.tsx]
- "components_timeline_synthesizeproceduralsfx": "synthesizeProceduralSFX()" | kind=code-symbol | source=components/Timeline.tsx:L100 | neighbors=[Timeline.tsx]
- "components_timeline_transitionpreviewtooltipcanvas": "TransitionPreviewTooltipCanvas()" | kind=code-symbol | source=components/Timeline.tsx:L835 | neighbors=[Timeline.tsx]
- "components_timeline_transitiontarget": "TransitionTarget()" | kind=code-symbol | source=components/Timeline.tsx:L943 | neighbors=[Timeline.tsx]
- "components_timeline_transitiontargetprops": "TransitionTargetProps" | kind=code-symbol | source=components/Timeline.tsx:L824 | neighbors=[Timeline.tsx]
- "components_timeline_workspaceplayhead": "WorkspacePlayhead()" | kind=code-symbol | source=components/Timeline.tsx:L1109 | neighbors=[Timeline.tsx]
- "hooks_usemediaplayback_cubicinterp": "cubicInterp()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L890 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_disconnectaudionode": "disconnectAudioNode()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L949 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_mediaelement": "MediaElement" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L78 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_mediaplaybackresult": "MediaPlaybackResult" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L113 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_separationgraph": "SeparationGraph" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L1217 | neighbors=[useMediaPlayback.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-007.json

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
