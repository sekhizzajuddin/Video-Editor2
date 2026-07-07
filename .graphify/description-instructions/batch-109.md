# Node Description Batch 110 of 128

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

- "ui_context_menu_contextmenucontent": "ContextMenuContent()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L96 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenugroup": "ContextMenuGroup()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L23 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuitem": "ContextMenuItem()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L114 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenulabel": "ContextMenuLabel()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L187 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuportal": "ContextMenuPortal()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L31 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuradiogroup": "ContextMenuRadioGroup()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L45 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuradioitem": "ContextMenuRadioItem()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L163 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuseparator": "ContextMenuSeparator()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L207 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenushortcut": "ContextMenuShortcut()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L220 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenusub": "ContextMenuSub()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L39 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenusubcontent": "ContextMenuSubContent()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L80 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenusubtrigger": "ContextMenuSubTrigger()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L56 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenutrigger": "ContextMenuTrigger()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L15 | neighbors=[context-menu.tsx]
- "ui_dialog_dialogclose": "DialogClose()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L25 | neighbors=[dialog.tsx]
- "ui_dialog_dialogfooter": "DialogFooter()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L91 | neighbors=[dialog.tsx]
- "ui_dialog_dialogoverlay": "DialogOverlay()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L31 | neighbors=[dialog.tsx]
- "ui_dialog_dialogportal": "DialogPortal()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L19 | neighbors=[dialog.tsx]
- "ui_dialog_dialogtrigger": "DialogTrigger()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L13 | neighbors=[dialog.tsx]
- "ui_drawer_drawer": "Drawer()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L8 | neighbors=[drawer.tsx]
- "ui_drawer_drawerclose": "DrawerClose()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L26 | neighbors=[drawer.tsx]
- "ui_drawer_drawercontent": "DrawerContent()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L48 | neighbors=[drawer.tsx]
- "ui_drawer_drawerdescription": "DrawerDescription()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L111 | neighbors=[drawer.tsx]
- "ui_drawer_drawerfooter": "DrawerFooter()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L88 | neighbors=[drawer.tsx]
- "ui_drawer_drawerheader": "DrawerHeader()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L75 | neighbors=[drawer.tsx]
- "ui_drawer_draweroverlay": "DrawerOverlay()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L32 | neighbors=[drawer.tsx]
- "ui_drawer_drawerportal": "DrawerPortal()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L20 | neighbors=[drawer.tsx]
- "ui_drawer_drawertitle": "DrawerTitle()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L98 | neighbors=[drawer.tsx]
- "ui_drawer_drawertrigger": "DrawerTrigger()" | kind=code-symbol | source=src/components/ui/drawer.tsx:L14 | neighbors=[drawer.tsx]
- "ui_dropdown_menu_dropdownmenu": "DropdownMenu()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L7 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenucheckboxitem": "DropdownMenuCheckboxItem()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L83 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenucontent": "DropdownMenuContent()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L32 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenugroup": "DropdownMenuGroup()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L52 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuitem": "DropdownMenuItem()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L60 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenulabel": "DropdownMenuLabel()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L144 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuportal": "DropdownMenuPortal()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L13 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuradiogroup": "DropdownMenuRadioGroup()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L109 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuradioitem": "DropdownMenuRadioItem()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L120 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenuseparator": "DropdownMenuSeparator()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L164 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenushortcut": "DropdownMenuShortcut()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L177 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenusub": "DropdownMenuSub()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L193 | neighbors=[dropdown-menu.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-109.json

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
