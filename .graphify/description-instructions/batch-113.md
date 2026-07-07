# Node Description Batch 114 of 128

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

- "ui_sidebar_sidebarmenusubitem": "SidebarMenuSubItem()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L655 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarprovider": "SidebarProvider()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L56 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarseparator": "SidebarSeparator()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L357 | neighbors=[sidebar.tsx]
- "ui_slider_slider": "Slider()" | kind=code-symbol | source=src/components/ui/slider.tsx:L8 | neighbors=[slider.tsx]
- "ui_spinner_spinner": "Spinner()" | kind=code-symbol | source=src/components/ui/spinner.tsx:L5 | neighbors=[spinner.tsx]
- "ui_switch_switch": "Switch()" | kind=code-symbol | source=src/components/ui/switch.tsx:L8 | neighbors=[switch.tsx]
- "ui_table_table": "Table()" | kind=code-symbol | source=src/components/ui/table.tsx:L5 | neighbors=[table.tsx]
- "ui_table_tablebody": "TableBody()" | kind=code-symbol | source=src/components/ui/table.tsx:L30 | neighbors=[table.tsx]
- "ui_table_tablecaption": "TableCaption()" | kind=code-symbol | source=src/components/ui/table.tsx:L92 | neighbors=[table.tsx]
- "ui_table_tablecell": "TableCell()" | kind=code-symbol | source=src/components/ui/table.tsx:L79 | neighbors=[table.tsx]
- "ui_table_tablefooter": "TableFooter()" | kind=code-symbol | source=src/components/ui/table.tsx:L40 | neighbors=[table.tsx]
- "ui_table_tablehead": "TableHead()" | kind=code-symbol | source=src/components/ui/table.tsx:L66 | neighbors=[table.tsx]
- "ui_table_tableheader": "TableHeader()" | kind=code-symbol | source=src/components/ui/table.tsx:L20 | neighbors=[table.tsx]
- "ui_table_tablerow": "TableRow()" | kind=code-symbol | source=src/components/ui/table.tsx:L53 | neighbors=[table.tsx]
- "ui_tabs_tabs": "Tabs()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L8 | neighbors=[tabs.tsx]
- "ui_tabs_tabscontent": "TabsContent()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L53 | neighbors=[tabs.tsx]
- "ui_tabs_tabslist": "TabsList()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L21 | neighbors=[tabs.tsx]
- "ui_tabs_tabstrigger": "TabsTrigger()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L37 | neighbors=[tabs.tsx]
- "ui_toggle_group_togglegroup": "ToggleGroup()" | kind=code-symbol | source=src/components/ui/toggle-group.tsx:L18 | neighbors=[toggle-group.tsx]
- "ui_toggle_group_togglegroupcontext": "ToggleGroupContext" | kind=code-symbol | source=src/components/ui/toggle-group.tsx:L8 | neighbors=[toggle-group.tsx]
- "ui_toggle_group_togglegroupitem": "ToggleGroupItem()" | kind=code-symbol | source=src/components/ui/toggle-group.tsx:L49 | neighbors=[toggle-group.tsx]
- "upscaling_upscaling_engine_upscalingengine_getlastprocessingtime": ".getLastProcessingTime()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L741 | neighbors=[UpscalingEngine]
- "upscaling_upscaling_engine_upscalingengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L745 | neighbors=[UpscalingEngine]
- "upscaling_upscaling_types_upscalequality": "UpscaleQuality" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L1 | neighbors=[upscaling-types.ts]
- "upscaling_upscaling_types_upscalingpipelines": "UpscalingPipelines" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L27 | neighbors=[upscaling-types.ts]
- "upscaling_upscaling_types_upscalinguniforms": "UpscalingUniforms" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L35 | neighbors=[upscaling-types.ts]
- "utils_aibackground_pendingresolves": "pendingResolves" | kind=code-symbol | source=src/utils/aiBackground.ts:L68 | neighbors=[aiBackground.ts]
- "utils_audioseparation_defaultsettings": "defaultSettings" | kind=code-symbol | source=src/utils/audioSeparation.ts:L39 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getffmpegbandseparationargs": "getFFmpegBandSeparationArgs()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L326 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getffmpegseparationargs": "getFFmpegSeparationArgs()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L288 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getseparationmodelabel": "getSeparationModeLabel()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L366 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getseparationsettings": "getSeparationSettings()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L49 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_sanitizeseparationsettings": "sanitizeSeparationSettings()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L350 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_separationmode": "SeparationMode" | kind=code-symbol | source=src/utils/audioSeparation.ts:L26 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_separationsettings": "SeparationSettings" | kind=code-symbol | source=src/utils/audioSeparation.ts:L28 | neighbors=[audioSeparation.ts]
- "utils_autocaptions_dummyphrases": "dummyPhrases" | kind=code-symbol | source=src/utils/autoCaptions.ts:L5 | neighbors=[autoCaptions.ts]
- "utils_autocut_analyzeclipforautocuts": "analyzeClipForAutoCuts()" | kind=code-symbol | source=src/utils/autoCut.ts:L11 | neighbors=[autoCut.ts]
- "utils_autocut_autocutsegment": "AutoCutSegment" | kind=code-symbol | source=src/utils/autoCut.ts:L1 | neighbors=[autoCut.ts]
- "utils_beatdetection_beatdetectionresult": "BeatDetectionResult" | kind=code-symbol | source=src/utils/beatDetection.ts:L10 | neighbors=[beatDetection.ts]
- "utils_canvaseffects_drawparticleshape": "drawParticleShape()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L313 | neighbors=[canvasEffects.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-113.json

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
