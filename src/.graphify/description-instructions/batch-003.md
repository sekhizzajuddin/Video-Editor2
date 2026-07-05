# Node Description Batch 4 of 16

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

- "ui_chart_usechart": "useChart()" | kind=code-symbol | source=components/ui/chart.tsx:L27 | neighbors=[chart.tsx, ChartLegendContent(), ChartTooltipContent()]
- "ui_checkbox": "checkbox.tsx" | kind=code-symbol | source=components/ui/checkbox.tsx:L1 | neighbors=[utils.ts, cn(), Checkbox()]
- "ui_collapsible": "collapsible.tsx" | kind=code-symbol | source=components/ui/collapsible.tsx:L1 | neighbors=[Collapsible(), CollapsibleContent(), CollapsibleTrigger()]
- "ui_input_input": "Input()" | kind=code-symbol | source=components/ui/input.tsx:L5 | neighbors=[input.tsx, input-group.tsx, sidebar.tsx]
- "ui_label_label": "Label()" | kind=code-symbol | source=components/ui/label.tsx:L8 | neighbors=[field.tsx, form.tsx, label.tsx]
- "ui_progress": "progress.tsx" | kind=code-symbol | source=components/ui/progress.tsx:L1 | neighbors=[utils.ts, cn(), Progress()]
- "ui_sidebar_sidebarmenubutton": "SidebarMenuButton()" | kind=code-symbol | source=components/ui/sidebar.tsx:L498 | neighbors=[sidebar.tsx, sidebarMenuButtonVariants, useSidebar()]
- "ui_slider": "slider.tsx" | kind=code-symbol | source=components/ui/slider.tsx:L1 | neighbors=[utils.ts, cn(), Slider()]
- "ui_spinner": "spinner.tsx" | kind=code-symbol | source=components/ui/spinner.tsx:L1 | neighbors=[utils.ts, cn(), Spinner()]
- "ui_switch": "switch.tsx" | kind=code-symbol | source=components/ui/switch.tsx:L1 | neighbors=[utils.ts, cn(), Switch()]
- "ui_toggle_togglevariants": "toggleVariants" | kind=code-symbol | source=components/ui/toggle.tsx:L7 | neighbors=[toggle.tsx, toggle-group.tsx, Toggle()]
- "utils_audioseparation_createseparationnode": "createSeparationNode()" | kind=code-symbol | source=utils/audioSeparation.ts:L73 | neighbors=[audioSeparation.ts, createFallbackSeparationNode(), updateSeparationParam()]
- "utils_beatdetection_detectbeats": "detectBeats()" | kind=code-symbol | source=utils/beatDetection.ts:L22 | neighbors=[MediaPanel.tsx, beatDetection.ts, smoothArray()]
- "utils_keyboardshortcuts_default_shortcuts": "DEFAULT_SHORTCUTS" | kind=code-symbol | source=utils/keyboardShortcuts.ts:L10 | neighbors=[App.tsx, SettingsModal.tsx, keyboardShortcuts.ts]
- "utils_keyboardshortcuts_getshortcutstring": "getShortcutString()" | kind=code-symbol | source=utils/keyboardShortcuts.ts:L55 | neighbors=[App.tsx, SettingsModal.tsx, keyboardShortcuts.ts]
- "utils_keyframes_addorupdatekeyframe": "addOrUpdateKeyframe()" | kind=code-symbol | source=utils/keyframes.ts:L58 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, keyframes.ts]
- "utils_lutparser_applyluttocanvas": "applyLutToCanvas()" | kind=code-symbol | source=utils/lutParser.ts:L152 | neighbors=[PreviewCanvas.tsx, lutParser.ts, applyLutToPixel()]
- "utils_mediaprobe_probeaudio": "probeAudio()" | kind=code-symbol | source=utils/mediaProbe.ts:L144 | neighbors=[mediaProbe.ts, extractWaveformFromUrl(), probeFile()]
- "utils_projectpersistence_clearprojectdb": "clearProjectDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L435 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_deleteautosavefromdb": "deleteAutosaveFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L342 | neighbors=[SettingsModal.tsx, projectPersistence.ts, getDB()]
- "utils_projectpersistence_deletefilefromdb": "deleteFileFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L77 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_generateframestrip": "generateFrameStrip()" | kind=code-symbol | source=utils/projectPersistence.ts:L392 | neighbors=[projectPersistence.ts, resolveMediaItemFromDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_generatevideothumbnail": "generateVideoThumbnail()" | kind=code-symbol | source=utils/projectPersistence.ts:L356 | neighbors=[projectPersistence.ts, resolveMediaItemFromDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_getautosavesfromdb": "getAutosavesFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L318 | neighbors=[SettingsModal.tsx, projectPersistence.ts, getDB()]
- "utils_projectpersistence_gettemplatesfromdb": "getTemplatesFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L480 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_saveautosavetodb": "saveAutosaveToDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L257 | neighbors=[App.tsx, projectPersistence.ts, getDB()]
- "utils_projectpersistence_saveprojecttodb": "saveProjectToDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L106 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_savetemplatestodb": "saveTemplatesToDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L449 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_speedramp_getintegraltable": "getIntegralTable()" | kind=code-symbol | source=utils/speedRamp.ts:L76 | neighbors=[speedRamp.ts, getSpeedAtPosition(), getMediaTimeAtPosition()]
- "utils_srtparser": "srtParser.ts" | kind=code-symbol | source=utils/srtParser.ts:L1 | neighbors=[MediaPanel.tsx, ParsedSubtitle, parseSRT()]
- "utils_storyboardcompiler_compilestoryboard": "compileStoryboard()" | kind=code-symbol | source=utils/storyboardCompiler.ts:L89 | neighbors=[PropertiesPanel.tsx, storyboardCompiler.ts, compileGridForSegment()]
- "utils_time_formatsimpletime": "formatSimpleTime()" | kind=code-symbol | source=utils/time.ts:L14 | neighbors=[ExportModal.tsx, Timeline.tsx, time.ts]
- "utils_titletemplates_title_templates": "TITLE_TEMPLATES" | kind=code-symbol | source=utils/titleTemplates.ts:L24 | neighbors=[MediaPanel.tsx, Timeline.tsx, titleTemplates.ts]
- "utils_waveformrenderer_createwaveformcanvas": "createWaveformCanvas()" | kind=code-symbol | source=utils/waveformRenderer.ts:L103 | neighbors=[waveformRenderer.ts, renderWaveform(), renderWaveformToDataUrl()]
- "utils_waveformrenderer_renderwaveform": "renderWaveform()" | kind=code-symbol | source=utils/waveformRenderer.ts:L23 | neighbors=[waveformRenderer.ts, createWaveformCanvas(), roundRect()]
- "components_aisounddesigner_aisounddesigner": "AiSoundDesigner()" | kind=code-symbol | source=components/AiSoundDesigner.tsx:L17 | neighbors=[AiSoundDesigner.tsx, PropertiesPanel.tsx]
- "components_aisounddesigner_cuewithoptions": "CueWithOptions" | kind=code-symbol | source=components/AiSoundDesigner.tsx:L7 | neighbors=[AiSoundDesigner.tsx, AICueResult]
- "components_audiomixer_audiomixer": "AudioMixer()" | kind=code-symbol | source=components/AudioMixer.tsx:L6 | neighbors=[App.tsx, AudioMixer.tsx]
- "components_exportmodal_exportmodal": "ExportModal()" | kind=code-symbol | source=components/ExportModal.tsx:L49 | neighbors=[App.tsx, ExportModal.tsx]
- "components_mediapanel_mediapanel": "MediaPanel()" | kind=code-symbol | source=components/MediaPanel.tsx:L172 | neighbors=[App.tsx, MediaPanel.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-003.json

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
