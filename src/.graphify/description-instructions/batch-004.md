# Node Description Batch 5 of 16

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

- "components_previewcanvas_clearpreviewcaches": "clearPreviewCaches()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L32 | neighbors=[PreviewCanvas.tsx, SettingsModal.tsx]
- "components_previewcanvas_getcachedimage": "getCachedImage()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L47 | neighbors=[PreviewCanvas.tsx, InteractiveCanvasOverlay()]
- "components_previewcanvas_hextorgb": "hexToRgb()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L277 | neighbors=[PreviewCanvas.tsx, spawnParticle()]
- "components_previewcanvas_interactivecanvasoverlay": "InteractiveCanvasOverlay()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L3082 | neighbors=[PreviewCanvas.tsx, getCachedImage()]
- "components_previewcanvas_previewcanvas": "PreviewCanvas()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L564 | neighbors=[App.tsx, PreviewCanvas.tsx]
- "components_previewcanvas_randomhue": "randomHue()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L282 | neighbors=[PreviewCanvas.tsx, spawnParticle()]
- "components_previewcanvas_renderparticles": "renderParticles()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L480 | neighbors=[PreviewCanvas.tsx, spawnParticle()]
- "components_propertiespanel_propertiespanel": "PropertiesPanel()" | kind=code-symbol | source=components/PropertiesPanel.tsx:L203 | neighbors=[App.tsx, PropertiesPanel.tsx]
- "components_settingsmodal_settingsmodal": "SettingsModal()" | kind=code-symbol | source=components/SettingsModal.tsx:L9 | neighbors=[App.tsx, SettingsModal.tsx]
- "components_timeline_floatingscrubtooltip": "FloatingScrubTooltip()" | kind=code-symbol | source=components/Timeline.tsx:L1122 | neighbors=[Timeline.tsx, formatDetailedTooltipTime()]
- "components_timeline_formatdetailedtooltiptime": "formatDetailedTooltipTime()" | kind=code-symbol | source=components/Timeline.tsx:L637 | neighbors=[Timeline.tsx, FloatingScrubTooltip()]
- "components_timeline_framestripoverlay": "FrameStripOverlay()" | kind=code-symbol | source=components/Timeline.tsx:L710 | neighbors=[Timeline.tsx, seededRandom()]
- "components_timeline_gettrackaty": "getTrackAtY()" | kind=code-symbol | source=components/Timeline.tsx:L599 | neighbors=[Timeline.tsx, getTrackHeight()]
- "components_timeline_waveformoverlay": "WaveformOverlay()" | kind=code-symbol | source=components/Timeline.tsx:L769 | neighbors=[Timeline.tsx, generateFallbackWaveform()]
- "components_toptoolbar_toptoolbar": "TopToolbar()" | kind=code-symbol | source=components/TopToolbar.tsx:L27 | neighbors=[App.tsx, TopToolbar.tsx]
- "hooks_use_mobile": "use-mobile.ts" | kind=code-symbol | source=hooks/use-mobile.ts:L1 | neighbors=[useIsMobile(), sidebar.tsx]
- "hooks_use_mobile_useismobile": "useIsMobile()" | kind=code-symbol | source=hooks/use-mobile.ts:L5 | neighbors=[use-mobile.ts, sidebar.tsx]
- "hooks_usemediaplayback_createseparationgraph": "createSeparationGraph()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L1227 | neighbors=[useMediaPlayback.ts, initAudioGraph()]
- "hooks_usemediaplayback_framecacheentry": "FrameCacheEntry" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L108 | neighbors=[PreviewCanvas.tsx, useMediaPlayback.ts]
- "store_editorstore_checkoverlap": "checkOverlap()" | kind=code-symbol | source=store/editorStore.ts:L86 | neighbors=[editorStore.ts, findNonOverlappingPosition()]
- "store_editorstore_findnonoverlappingposition": "findNonOverlappingPosition()" | kind=code-symbol | source=store/editorStore.ts:L101 | neighbors=[editorStore.ts, checkOverlap()]
- "types_index_clipanimations": "ClipAnimations" | kind=code-symbol | source=types/index.ts:L214 | neighbors=[index.ts, titleTemplates.ts]
- "types_index_clipkenburnssettings": "ClipKenBurnsSettings" | kind=code-symbol | source=types/index.ts:L234 | neighbors=[PropertiesPanel.tsx, index.ts]
- "types_index_editorsnapshot": "EditorSnapshot" | kind=code-symbol | source=types/index.ts:L426 | neighbors=[editorStore.ts, index.ts]
- "types_index_lutdata": "LutData" | kind=code-symbol | source=types/index.ts:L5 | neighbors=[index.ts, lutParser.ts]
- "types_index_projecttemplate": "ProjectTemplate" | kind=code-symbol | source=types/index.ts:L461 | neighbors=[editorStore.ts, index.ts]
- "types_index_propertykeyframe": "PropertyKeyframe" | kind=code-symbol | source=types/index.ts:L207 | neighbors=[index.ts, keyframes.ts]
- "types_index_speedrampkeyframe": "SpeedRampKeyframe" | kind=code-symbol | source=types/index.ts:L202 | neighbors=[index.ts, speedRamp.ts]
- "types_index_transition": "Transition" | kind=code-symbol | source=types/index.ts:L445 | neighbors=[editorStore.ts, index.ts]
- "ui_alert_alert": "Alert()" | kind=code-symbol | source=components/ui/alert.tsx:L22 | neighbors=[alert.tsx, alertVariants]
- "ui_alert_alertvariants": "alertVariants" | kind=code-symbol | source=components/ui/alert.tsx:L6 | neighbors=[alert.tsx, Alert()]
- "ui_badge_badge": "Badge()" | kind=code-symbol | source=components/ui/badge.tsx:L28 | neighbors=[badge.tsx, badgeVariants]
- "ui_badge_badgevariants": "badgeVariants" | kind=code-symbol | source=components/ui/badge.tsx:L7 | neighbors=[badge.tsx, Badge()]
- "ui_button_group_buttongroup": "ButtonGroup()" | kind=code-symbol | source=components/ui/button-group.tsx:L24 | neighbors=[button-group.tsx, buttonGroupVariants]
- "ui_button_group_buttongroupvariants": "buttonGroupVariants" | kind=code-symbol | source=components/ui/button-group.tsx:L7 | neighbors=[button-group.tsx, ButtonGroup()]
- "ui_carousel_carouselcontent": "CarouselContent()" | kind=code-symbol | source=components/ui/carousel.tsx:L133 | neighbors=[carousel.tsx, useCarousel()]
- "ui_carousel_carouselitem": "CarouselItem()" | kind=code-symbol | source=components/ui/carousel.tsx:L154 | neighbors=[carousel.tsx, useCarousel()]
- "ui_carousel_carouselnext": "CarouselNext()" | kind=code-symbol | source=components/ui/carousel.tsx:L202 | neighbors=[carousel.tsx, useCarousel()]
- "ui_carousel_carouselprevious": "CarouselPrevious()" | kind=code-symbol | source=components/ui/carousel.tsx:L172 | neighbors=[carousel.tsx, useCarousel()]
- "ui_chart_chartlegendcontent": "ChartLegendContent()" | kind=code-symbol | source=components/ui/chart.tsx:L255 | neighbors=[chart.tsx, useChart()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-004.json

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
