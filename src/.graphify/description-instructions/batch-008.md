# Node Description Batch 9 of 16

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

- "hooks_usemediaplayback_trackanalysers": "trackAnalysers" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L23 | neighbors=[useMediaPlayback.ts]
- "main": "main.tsx" | kind=code-symbol | source=main.tsx:L1 | neighbors=[App.tsx]
- "pages_home": "Home.tsx" | kind=code-symbol | source=pages/Home.tsx:L1 | neighbors=[Home()]
- "pages_home_home": "Home()" | kind=code-symbol | source=pages/Home.tsx:L4 | neighbors=[Home.tsx]
- "store_editorstore_createemptytracks": "createEmptyTracks()" | kind=code-symbol | source=store/editorStore.ts:L30 | neighbors=[editorStore.ts]
- "store_editorstore_defaulttracks": "defaultTracks" | kind=code-symbol | source=store/editorStore.ts:L283 | neighbors=[editorStore.ts]
- "store_editorstore_editoractions": "EditorActions" | kind=code-symbol | source=store/editorStore.ts:L142 | neighbors=[editorStore.ts]
- "store_editorstore_generateid": "generateId()" | kind=code-symbol | source=store/editorStore.ts:L20 | neighbors=[editorStore.ts]
- "store_editorstore_initialstate": "initialState" | kind=code-symbol | source=store/editorStore.ts:L284 | neighbors=[editorStore.ts]
- "types_index_clipchromakeysettings": "ClipChromaKeySettings" | kind=code-symbol | source=types/index.ts:L227 | neighbors=[index.ts]
- "types_index_clipcolorfilters": "ClipColorFilters" | kind=code-symbol | source=types/index.ts:L82 | neighbors=[index.ts]
- "types_index_clipcrop": "ClipCrop" | kind=code-symbol | source=types/index.ts:L63 | neighbors=[index.ts]
- "types_index_clipfxsettings": "ClipFxSettings" | kind=code-symbol | source=types/index.ts:L161 | neighbors=[index.ts]
- "types_index_cliplutsettings": "ClipLutSettings" | kind=code-symbol | source=types/index.ts:L13 | neighbors=[index.ts]
- "types_index_clipparticlesettings": "ClipParticleSettings" | kind=code-symbol | source=types/index.ts:L179 | neighbors=[index.ts]
- "types_index_cliptextanimation": "ClipTextAnimation" | kind=code-symbol | source=types/index.ts:L134 | neighbors=[index.ts]
- "types_index_cliptransform": "ClipTransform" | kind=code-symbol | source=types/index.ts:L49 | neighbors=[index.ts]
- "types_index_colorwheeladjustment": "ColorWheelAdjustment" | kind=code-symbol | source=types/index.ts:L76 | neighbors=[index.ts]
- "types_index_effect": "Effect" | kind=code-symbol | source=types/index.ts:L454 | neighbors=[index.ts]
- "types_index_particleeffecttype": "ParticleEffectType" | kind=code-symbol | source=types/index.ts:L167 | neighbors=[index.ts]
- "types_index_textanimationpreset": "TextAnimationPreset" | kind=code-symbol | source=types/index.ts:L122 | neighbors=[index.ts]
- "types_index_timeformat": "TimeFormat" | kind=code-symbol | source=types/index.ts:L442 | neighbors=[index.ts]
- "types_index_timelinemarker": "TimelineMarker" | kind=code-symbol | source=types/index.ts:L328 | neighbors=[index.ts]
- "types_index_waveformdata": "WaveformData" | kind=code-symbol | source=types/index.ts:L71 | neighbors=[index.ts]
- "ui_accordion_accordion": "Accordion()" | kind=code-symbol | source=components/ui/accordion.tsx:L7 | neighbors=[accordion.tsx]
- "ui_accordion_accordioncontent": "AccordionContent()" | kind=code-symbol | source=components/ui/accordion.tsx:L48 | neighbors=[accordion.tsx]
- "ui_accordion_accordionitem": "AccordionItem()" | kind=code-symbol | source=components/ui/accordion.tsx:L13 | neighbors=[accordion.tsx]
- "ui_accordion_accordiontrigger": "AccordionTrigger()" | kind=code-symbol | source=components/ui/accordion.tsx:L26 | neighbors=[accordion.tsx]
- "ui_alert_alertdescription": "AlertDescription()" | kind=code-symbol | source=components/ui/alert.tsx:L50 | neighbors=[alert.tsx]
- "ui_alert_alerttitle": "AlertTitle()" | kind=code-symbol | source=components/ui/alert.tsx:L37 | neighbors=[alert.tsx]
- "ui_alert_dialog_alertdialog": "AlertDialog()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L7 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogaction": "AlertDialogAction()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L119 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogcancel": "AlertDialogCancel()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L131 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogcontent": "AlertDialogContent()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L45 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogdescription": "AlertDialogDescription()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L106 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogfooter": "AlertDialogFooter()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L77 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogheader": "AlertDialogHeader()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L64 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogoverlay": "AlertDialogOverlay()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L29 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogportal": "AlertDialogPortal()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L21 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogtitle": "AlertDialogTitle()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L93 | neighbors=[alert-dialog.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-008.json

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
