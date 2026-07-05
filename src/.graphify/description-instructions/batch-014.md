# Node Description Batch 15 of 16

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

- "ui_sidebar_sidebargroup": "SidebarGroup()" | kind=code-symbol | source=components/ui/sidebar.tsx:L385 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargroupaction": "SidebarGroupAction()" | kind=code-symbol | source=components/ui/sidebar.tsx:L417 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargroupcontent": "SidebarGroupContent()" | kind=code-symbol | source=components/ui/sidebar.tsx:L440 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargrouplabel": "SidebarGroupLabel()" | kind=code-symbol | source=components/ui/sidebar.tsx:L396 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarheader": "SidebarHeader()" | kind=code-symbol | source=components/ui/sidebar.tsx:L335 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarinput": "SidebarInput()" | kind=code-symbol | source=components/ui/sidebar.tsx:L321 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarinset": "SidebarInset()" | kind=code-symbol | source=components/ui/sidebar.tsx:L307 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenu": "SidebarMenu()" | kind=code-symbol | source=components/ui/sidebar.tsx:L454 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenuaction": "SidebarMenuAction()" | kind=code-symbol | source=components/ui/sidebar.tsx:L548 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenubadge": "SidebarMenuBadge()" | kind=code-symbol | source=components/ui/sidebar.tsx:L580 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenuitem": "SidebarMenuItem()" | kind=code-symbol | source=components/ui/sidebar.tsx:L465 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenuskeleton": "SidebarMenuSkeleton()" | kind=code-symbol | source=components/ui/sidebar.tsx:L602 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenusub": "SidebarMenuSub()" | kind=code-symbol | source=components/ui/sidebar.tsx:L640 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenusubbutton": "SidebarMenuSubButton()" | kind=code-symbol | source=components/ui/sidebar.tsx:L669 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenusubitem": "SidebarMenuSubItem()" | kind=code-symbol | source=components/ui/sidebar.tsx:L655 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarprovider": "SidebarProvider()" | kind=code-symbol | source=components/ui/sidebar.tsx:L56 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarseparator": "SidebarSeparator()" | kind=code-symbol | source=components/ui/sidebar.tsx:L357 | neighbors=[sidebar.tsx]
- "ui_slider_slider": "Slider()" | kind=code-symbol | source=components/ui/slider.tsx:L8 | neighbors=[slider.tsx]
- "ui_sonner": "sonner.tsx" | kind=code-symbol | source=components/ui/sonner.tsx:L1 | neighbors=[Toaster()]
- "ui_sonner_toaster": "Toaster()" | kind=code-symbol | source=components/ui/sonner.tsx:L11 | neighbors=[sonner.tsx]
- "ui_spinner_spinner": "Spinner()" | kind=code-symbol | source=components/ui/spinner.tsx:L5 | neighbors=[spinner.tsx]
- "ui_switch_switch": "Switch()" | kind=code-symbol | source=components/ui/switch.tsx:L8 | neighbors=[switch.tsx]
- "ui_table_table": "Table()" | kind=code-symbol | source=components/ui/table.tsx:L5 | neighbors=[table.tsx]
- "ui_table_tablebody": "TableBody()" | kind=code-symbol | source=components/ui/table.tsx:L30 | neighbors=[table.tsx]
- "ui_table_tablecaption": "TableCaption()" | kind=code-symbol | source=components/ui/table.tsx:L92 | neighbors=[table.tsx]
- "ui_table_tablecell": "TableCell()" | kind=code-symbol | source=components/ui/table.tsx:L79 | neighbors=[table.tsx]
- "ui_table_tablefooter": "TableFooter()" | kind=code-symbol | source=components/ui/table.tsx:L40 | neighbors=[table.tsx]
- "ui_table_tablehead": "TableHead()" | kind=code-symbol | source=components/ui/table.tsx:L66 | neighbors=[table.tsx]
- "ui_table_tableheader": "TableHeader()" | kind=code-symbol | source=components/ui/table.tsx:L20 | neighbors=[table.tsx]
- "ui_table_tablerow": "TableRow()" | kind=code-symbol | source=components/ui/table.tsx:L53 | neighbors=[table.tsx]
- "ui_tabs_tabs": "Tabs()" | kind=code-symbol | source=components/ui/tabs.tsx:L8 | neighbors=[tabs.tsx]
- "ui_tabs_tabscontent": "TabsContent()" | kind=code-symbol | source=components/ui/tabs.tsx:L53 | neighbors=[tabs.tsx]
- "ui_tabs_tabslist": "TabsList()" | kind=code-symbol | source=components/ui/tabs.tsx:L21 | neighbors=[tabs.tsx]
- "ui_tabs_tabstrigger": "TabsTrigger()" | kind=code-symbol | source=components/ui/tabs.tsx:L37 | neighbors=[tabs.tsx]
- "ui_toggle_group_togglegroup": "ToggleGroup()" | kind=code-symbol | source=components/ui/toggle-group.tsx:L18 | neighbors=[toggle-group.tsx]
- "ui_toggle_group_togglegroupcontext": "ToggleGroupContext" | kind=code-symbol | source=components/ui/toggle-group.tsx:L8 | neighbors=[toggle-group.tsx]
- "ui_toggle_group_togglegroupitem": "ToggleGroupItem()" | kind=code-symbol | source=components/ui/toggle-group.tsx:L49 | neighbors=[toggle-group.tsx]
- "utils_audioseparation_defaultsettings": "defaultSettings" | kind=code-symbol | source=utils/audioSeparation.ts:L39 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getffmpegbandseparationargs": "getFFmpegBandSeparationArgs()" | kind=code-symbol | source=utils/audioSeparation.ts:L324 | neighbors=[audioSeparation.ts]
- "utils_audioseparation_getffmpegseparationargs": "getFFmpegSeparationArgs()" | kind=code-symbol | source=utils/audioSeparation.ts:L286 | neighbors=[audioSeparation.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-014.json

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
