# Node Description Batch 6 of 16

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

- "ui_chart_charttooltipcontent": "ChartTooltipContent()" | kind=code-symbol | source=components/ui/chart.tsx:L107 | neighbors=[chart.tsx, useChart()]
- "ui_dialog_dialog": "Dialog()" | kind=code-symbol | source=components/ui/dialog.tsx:L7 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogcontent": "DialogContent()" | kind=code-symbol | source=components/ui/dialog.tsx:L47 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogdescription": "DialogDescription()" | kind=code-symbol | source=components/ui/dialog.tsx:L117 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogheader": "DialogHeader()" | kind=code-symbol | source=components/ui/dialog.tsx:L81 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogtitle": "DialogTitle()" | kind=code-symbol | source=components/ui/dialog.tsx:L104 | neighbors=[command.tsx, dialog.tsx]
- "ui_empty_emptymedia": "EmptyMedia()" | kind=code-symbol | source=components/ui/empty.tsx:L46 | neighbors=[empty.tsx, emptyMediaVariants]
- "ui_empty_emptymediavariants": "emptyMediaVariants" | kind=code-symbol | source=components/ui/empty.tsx:L31 | neighbors=[empty.tsx, EmptyMedia()]
- "ui_field_field": "Field()" | kind=code-symbol | source=components/ui/field.tsx:L79 | neighbors=[field.tsx, fieldVariants]
- "ui_field_fieldvariants": "fieldVariants" | kind=code-symbol | source=components/ui/field.tsx:L55 | neighbors=[field.tsx, Field()]
- "ui_form_formcontrol": "FormControl()" | kind=code-symbol | source=components/ui/form.tsx:L107 | neighbors=[form.tsx, useFormField()]
- "ui_form_formdescription": "FormDescription()" | kind=code-symbol | source=components/ui/form.tsx:L125 | neighbors=[form.tsx, useFormField()]
- "ui_form_formlabel": "FormLabel()" | kind=code-symbol | source=components/ui/form.tsx:L90 | neighbors=[form.tsx, useFormField()]
- "ui_form_formmessage": "FormMessage()" | kind=code-symbol | source=components/ui/form.tsx:L138 | neighbors=[form.tsx, useFormField()]
- "ui_input_group_inputgroupaddon": "InputGroupAddon()" | kind=code-symbol | source=components/ui/input-group.tsx:L60 | neighbors=[input-group.tsx, inputGroupAddonVariants]
- "ui_input_group_inputgroupaddonvariants": "inputGroupAddonVariants" | kind=code-symbol | source=components/ui/input-group.tsx:L39 | neighbors=[input-group.tsx, InputGroupAddon()]
- "ui_input_group_inputgroupbutton": "InputGroupButton()" | kind=code-symbol | source=components/ui/input-group.tsx:L100 | neighbors=[input-group.tsx, inputGroupButtonVariants]
- "ui_input_group_inputgroupbuttonvariants": "inputGroupButtonVariants" | kind=code-symbol | source=components/ui/input-group.tsx:L82 | neighbors=[input-group.tsx, InputGroupButton()]
- "ui_item_item": "Item()" | kind=code-symbol | source=components/ui/item.tsx:L54 | neighbors=[item.tsx, itemVariants]
- "ui_item_itemmedia": "ItemMedia()" | kind=code-symbol | source=components/ui/item.tsx:L91 | neighbors=[item.tsx, itemMediaVariants]
- "ui_item_itemmediavariants": "itemMediaVariants" | kind=code-symbol | source=components/ui/item.tsx:L74 | neighbors=[item.tsx, ItemMedia()]
- "ui_item_itemvariants": "itemVariants" | kind=code-symbol | source=components/ui/item.tsx:L33 | neighbors=[item.tsx, Item()]
- "ui_navigation_menu_navigationmenutrigger": "NavigationMenuTrigger()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L65 | neighbors=[navigation-menu.tsx, navigationMenuTriggerStyle]
- "ui_navigation_menu_navigationmenutriggerstyle": "navigationMenuTriggerStyle" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L61 | neighbors=[navigation-menu.tsx, NavigationMenuTrigger()]
- "ui_sheet_sheet": "Sheet()" | kind=code-symbol | source=components/ui/sheet.tsx:L7 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheetcontent": "SheetContent()" | kind=code-symbol | source=components/ui/sheet.tsx:L45 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheetdescription": "SheetDescription()" | kind=code-symbol | source=components/ui/sheet.tsx:L115 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheetheader": "SheetHeader()" | kind=code-symbol | source=components/ui/sheet.tsx:L82 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheettitle": "SheetTitle()" | kind=code-symbol | source=components/ui/sheet.tsx:L102 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sidebar_sidebar": "Sidebar()" | kind=code-symbol | source=components/ui/sidebar.tsx:L154 | neighbors=[sidebar.tsx, useSidebar()]
- "ui_sidebar_sidebarmenubuttonvariants": "sidebarMenuButtonVariants" | kind=code-symbol | source=components/ui/sidebar.tsx:L476 | neighbors=[sidebar.tsx, SidebarMenuButton()]
- "ui_sidebar_sidebarrail": "SidebarRail()" | kind=code-symbol | source=components/ui/sidebar.tsx:L282 | neighbors=[sidebar.tsx, useSidebar()]
- "ui_sidebar_sidebartrigger": "SidebarTrigger()" | kind=code-symbol | source=components/ui/sidebar.tsx:L256 | neighbors=[sidebar.tsx, useSidebar()]
- "ui_skeleton_skeleton": "Skeleton()" | kind=code-symbol | source=components/ui/skeleton.tsx:L3 | neighbors=[sidebar.tsx, skeleton.tsx]
- "ui_textarea_textarea": "Textarea()" | kind=code-symbol | source=components/ui/textarea.tsx:L5 | neighbors=[input-group.tsx, textarea.tsx]
- "ui_toggle_toggle": "Toggle()" | kind=code-symbol | source=components/ui/toggle.tsx:L29 | neighbors=[toggle.tsx, toggleVariants]
- "ui_tooltip_tooltip": "Tooltip()" | kind=code-symbol | source=components/ui/tooltip.tsx:L21 | neighbors=[sidebar.tsx, tooltip.tsx]
- "ui_tooltip_tooltipcontent": "TooltipContent()" | kind=code-symbol | source=components/ui/tooltip.tsx:L37 | neighbors=[sidebar.tsx, tooltip.tsx]
- "ui_tooltip_tooltipprovider": "TooltipProvider()" | kind=code-symbol | source=components/ui/tooltip.tsx:L8 | neighbors=[sidebar.tsx, tooltip.tsx]
- "ui_tooltip_tooltiptrigger": "TooltipTrigger()" | kind=code-symbol | source=components/ui/tooltip.tsx:L31 | neighbors=[sidebar.tsx, tooltip.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-005.json

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
