# Node Description Batch 11 of 16

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

- "ui_collapsible_collapsible": "Collapsible()" | kind=code-symbol | source=components/ui/collapsible.tsx:L3 | neighbors=[collapsible.tsx]
- "ui_collapsible_collapsiblecontent": "CollapsibleContent()" | kind=code-symbol | source=components/ui/collapsible.tsx:L20 | neighbors=[collapsible.tsx]
- "ui_collapsible_collapsibletrigger": "CollapsibleTrigger()" | kind=code-symbol | source=components/ui/collapsible.tsx:L9 | neighbors=[collapsible.tsx]
- "ui_command_command": "Command()" | kind=code-symbol | source=components/ui/command.tsx:L14 | neighbors=[command.tsx]
- "ui_command_commanddialog": "CommandDialog()" | kind=code-symbol | source=components/ui/command.tsx:L30 | neighbors=[command.tsx]
- "ui_command_commandempty": "CommandEmpty()" | kind=code-symbol | source=components/ui/command.tsx:L99 | neighbors=[command.tsx]
- "ui_command_commandgroup": "CommandGroup()" | kind=code-symbol | source=components/ui/command.tsx:L111 | neighbors=[command.tsx]
- "ui_command_commandinput": "CommandInput()" | kind=code-symbol | source=components/ui/command.tsx:L61 | neighbors=[command.tsx]
- "ui_command_commanditem": "CommandItem()" | kind=code-symbol | source=components/ui/command.tsx:L140 | neighbors=[command.tsx]
- "ui_command_commandlist": "CommandList()" | kind=code-symbol | source=components/ui/command.tsx:L83 | neighbors=[command.tsx]
- "ui_command_commandseparator": "CommandSeparator()" | kind=code-symbol | source=components/ui/command.tsx:L127 | neighbors=[command.tsx]
- "ui_command_commandshortcut": "CommandShortcut()" | kind=code-symbol | source=components/ui/command.tsx:L156 | neighbors=[command.tsx]
- "ui_context_menu_contextmenu": "ContextMenu()" | kind=code-symbol | source=components/ui/context-menu.tsx:L9 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenucheckboxitem": "ContextMenuCheckboxItem()" | kind=code-symbol | source=components/ui/context-menu.tsx:L137 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenucontent": "ContextMenuContent()" | kind=code-symbol | source=components/ui/context-menu.tsx:L96 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenugroup": "ContextMenuGroup()" | kind=code-symbol | source=components/ui/context-menu.tsx:L23 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuitem": "ContextMenuItem()" | kind=code-symbol | source=components/ui/context-menu.tsx:L114 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenulabel": "ContextMenuLabel()" | kind=code-symbol | source=components/ui/context-menu.tsx:L187 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuportal": "ContextMenuPortal()" | kind=code-symbol | source=components/ui/context-menu.tsx:L31 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuradiogroup": "ContextMenuRadioGroup()" | kind=code-symbol | source=components/ui/context-menu.tsx:L45 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuradioitem": "ContextMenuRadioItem()" | kind=code-symbol | source=components/ui/context-menu.tsx:L163 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenuseparator": "ContextMenuSeparator()" | kind=code-symbol | source=components/ui/context-menu.tsx:L207 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenushortcut": "ContextMenuShortcut()" | kind=code-symbol | source=components/ui/context-menu.tsx:L220 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenusub": "ContextMenuSub()" | kind=code-symbol | source=components/ui/context-menu.tsx:L39 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenusubcontent": "ContextMenuSubContent()" | kind=code-symbol | source=components/ui/context-menu.tsx:L80 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenusubtrigger": "ContextMenuSubTrigger()" | kind=code-symbol | source=components/ui/context-menu.tsx:L56 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenutrigger": "ContextMenuTrigger()" | kind=code-symbol | source=components/ui/context-menu.tsx:L15 | neighbors=[context-menu.tsx]
- "ui_dialog_dialogclose": "DialogClose()" | kind=code-symbol | source=components/ui/dialog.tsx:L25 | neighbors=[dialog.tsx]
- "ui_dialog_dialogfooter": "DialogFooter()" | kind=code-symbol | source=components/ui/dialog.tsx:L91 | neighbors=[dialog.tsx]
- "ui_dialog_dialogoverlay": "DialogOverlay()" | kind=code-symbol | source=components/ui/dialog.tsx:L31 | neighbors=[dialog.tsx]
- "ui_dialog_dialogportal": "DialogPortal()" | kind=code-symbol | source=components/ui/dialog.tsx:L19 | neighbors=[dialog.tsx]
- "ui_dialog_dialogtrigger": "DialogTrigger()" | kind=code-symbol | source=components/ui/dialog.tsx:L13 | neighbors=[dialog.tsx]
- "ui_drawer_drawer": "Drawer()" | kind=code-symbol | source=components/ui/drawer.tsx:L8 | neighbors=[drawer.tsx]
- "ui_drawer_drawerclose": "DrawerClose()" | kind=code-symbol | source=components/ui/drawer.tsx:L26 | neighbors=[drawer.tsx]
- "ui_drawer_drawercontent": "DrawerContent()" | kind=code-symbol | source=components/ui/drawer.tsx:L48 | neighbors=[drawer.tsx]
- "ui_drawer_drawerdescription": "DrawerDescription()" | kind=code-symbol | source=components/ui/drawer.tsx:L111 | neighbors=[drawer.tsx]
- "ui_drawer_drawerfooter": "DrawerFooter()" | kind=code-symbol | source=components/ui/drawer.tsx:L88 | neighbors=[drawer.tsx]
- "ui_drawer_drawerheader": "DrawerHeader()" | kind=code-symbol | source=components/ui/drawer.tsx:L75 | neighbors=[drawer.tsx]
- "ui_drawer_draweroverlay": "DrawerOverlay()" | kind=code-symbol | source=components/ui/drawer.tsx:L32 | neighbors=[drawer.tsx]
- "ui_drawer_drawerportal": "DrawerPortal()" | kind=code-symbol | source=components/ui/drawer.tsx:L20 | neighbors=[drawer.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-010.json

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
