# Node Description Batch 113 of 128

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

- "ui_radio_group_radiogroup": "RadioGroup()" | kind=code-symbol | source=src/components/ui/radio-group.tsx:L9 | neighbors=[radio-group.tsx]
- "ui_radio_group_radiogroupitem": "RadioGroupItem()" | kind=code-symbol | source=src/components/ui/radio-group.tsx:L22 | neighbors=[radio-group.tsx]
- "ui_resizable_resizablehandle": "ResizableHandle()" | kind=code-symbol | source=src/components/ui/resizable.tsx:L29 | neighbors=[resizable.tsx]
- "ui_resizable_resizablepanel": "ResizablePanel()" | kind=code-symbol | source=src/components/ui/resizable.tsx:L23 | neighbors=[resizable.tsx]
- "ui_resizable_resizablepanelgroup": "ResizablePanelGroup()" | kind=code-symbol | source=src/components/ui/resizable.tsx:L7 | neighbors=[resizable.tsx]
- "ui_scroll_area_scrollarea": "ScrollArea()" | kind=code-symbol | source=src/components/ui/scroll-area.tsx:L8 | neighbors=[scroll-area.tsx]
- "ui_scroll_area_scrollbar": "ScrollBar()" | kind=code-symbol | source=src/components/ui/scroll-area.tsx:L31 | neighbors=[scroll-area.tsx]
- "ui_select_select": "Select()" | kind=code-symbol | source=src/components/ui/select.tsx:L7 | neighbors=[select.tsx]
- "ui_select_selectcontent": "SelectContent()" | kind=code-symbol | source=src/components/ui/select.tsx:L51 | neighbors=[select.tsx]
- "ui_select_selectgroup": "SelectGroup()" | kind=code-symbol | source=src/components/ui/select.tsx:L13 | neighbors=[select.tsx]
- "ui_select_selectitem": "SelectItem()" | kind=code-symbol | source=src/components/ui/select.tsx:L101 | neighbors=[select.tsx]
- "ui_select_selectlabel": "SelectLabel()" | kind=code-symbol | source=src/components/ui/select.tsx:L88 | neighbors=[select.tsx]
- "ui_select_selectscrolldownbutton": "SelectScrollDownButton()" | kind=code-symbol | source=src/components/ui/select.tsx:L159 | neighbors=[select.tsx]
- "ui_select_selectscrollupbutton": "SelectScrollUpButton()" | kind=code-symbol | source=src/components/ui/select.tsx:L141 | neighbors=[select.tsx]
- "ui_select_selectseparator": "SelectSeparator()" | kind=code-symbol | source=src/components/ui/select.tsx:L128 | neighbors=[select.tsx]
- "ui_select_selecttrigger": "SelectTrigger()" | kind=code-symbol | source=src/components/ui/select.tsx:L25 | neighbors=[select.tsx]
- "ui_select_selectvalue": "SelectValue()" | kind=code-symbol | source=src/components/ui/select.tsx:L19 | neighbors=[select.tsx]
- "ui_sheet_sheetclose": "SheetClose()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L17 | neighbors=[sheet.tsx]
- "ui_sheet_sheetfooter": "SheetFooter()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L92 | neighbors=[sheet.tsx]
- "ui_sheet_sheetoverlay": "SheetOverlay()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L29 | neighbors=[sheet.tsx]
- "ui_sheet_sheetportal": "SheetPortal()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L23 | neighbors=[sheet.tsx]
- "ui_sheet_sheettrigger": "SheetTrigger()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L11 | neighbors=[sheet.tsx]
- "ui_sidebar_sidebarcontent": "SidebarContent()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L371 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarcontext": "SidebarContext" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L45 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarcontextprops": "SidebarContextProps" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L35 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarfooter": "SidebarFooter()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L346 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargroup": "SidebarGroup()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L385 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargroupaction": "SidebarGroupAction()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L417 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargroupcontent": "SidebarGroupContent()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L440 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebargrouplabel": "SidebarGroupLabel()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L396 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarheader": "SidebarHeader()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L335 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarinput": "SidebarInput()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L321 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarinset": "SidebarInset()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L307 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenu": "SidebarMenu()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L454 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenuaction": "SidebarMenuAction()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L548 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenubadge": "SidebarMenuBadge()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L580 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenuitem": "SidebarMenuItem()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L465 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenuskeleton": "SidebarMenuSkeleton()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L602 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenusub": "SidebarMenuSub()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L640 | neighbors=[sidebar.tsx]
- "ui_sidebar_sidebarmenusubbutton": "SidebarMenuSubButton()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L669 | neighbors=[sidebar.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-112.json

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
