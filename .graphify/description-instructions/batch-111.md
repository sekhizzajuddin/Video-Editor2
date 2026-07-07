# Node Description Batch 112 of 128

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

- "ui_item_itemseparator": "ItemSeparator()" | kind=code-symbol | source=src/components/ui/item.tsx:L19 | neighbors=[item.tsx]
- "ui_item_itemtitle": "ItemTitle()" | kind=code-symbol | source=src/components/ui/item.tsx:L119 | neighbors=[item.tsx]
- "ui_kbd_kbd": "Kbd()" | kind=code-symbol | source=src/components/ui/kbd.tsx:L3 | neighbors=[kbd.tsx]
- "ui_kbd_kbdgroup": "KbdGroup()" | kind=code-symbol | source=src/components/ui/kbd.tsx:L18 | neighbors=[kbd.tsx]
- "ui_menubar_menubar": "Menubar()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L7 | neighbors=[menubar.tsx]
- "ui_menubar_menubarcheckboxitem": "MenubarCheckboxItem()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L112 | neighbors=[menubar.tsx]
- "ui_menubar_menubarcontent": "MenubarContent()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L65 | neighbors=[menubar.tsx]
- "ui_menubar_menubargroup": "MenubarGroup()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L29 | neighbors=[menubar.tsx]
- "ui_menubar_menubaritem": "MenubarItem()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L89 | neighbors=[menubar.tsx]
- "ui_menubar_menubarlabel": "MenubarLabel()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L162 | neighbors=[menubar.tsx]
- "ui_menubar_menubarmenu": "MenubarMenu()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L23 | neighbors=[menubar.tsx]
- "ui_menubar_menubarportal": "MenubarPortal()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L35 | neighbors=[menubar.tsx]
- "ui_menubar_menubarradiogroup": "MenubarRadioGroup()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L41 | neighbors=[menubar.tsx]
- "ui_menubar_menubarradioitem": "MenubarRadioItem()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L138 | neighbors=[menubar.tsx]
- "ui_menubar_menubarseparator": "MenubarSeparator()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L182 | neighbors=[menubar.tsx]
- "ui_menubar_menubarshortcut": "MenubarShortcut()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L195 | neighbors=[menubar.tsx]
- "ui_menubar_menubarsub": "MenubarSub()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L211 | neighbors=[menubar.tsx]
- "ui_menubar_menubarsubcontent": "MenubarSubContent()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L241 | neighbors=[menubar.tsx]
- "ui_menubar_menubarsubtrigger": "MenubarSubTrigger()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L217 | neighbors=[menubar.tsx]
- "ui_menubar_menubartrigger": "MenubarTrigger()" | kind=code-symbol | source=src/components/ui/menubar.tsx:L49 | neighbors=[menubar.tsx]
- "ui_navigation_menu_navigationmenu": "NavigationMenu()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L8 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenucontent": "NavigationMenuContent()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L85 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenuindicator": "NavigationMenuIndicator()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L140 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenuitem": "NavigationMenuItem()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L48 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenulink": "NavigationMenuLink()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L124 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenulist": "NavigationMenuList()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L32 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenuviewport": "NavigationMenuViewport()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L102 | neighbors=[navigation-menu.tsx]
- "ui_pagination_pagination": "Pagination()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L11 | neighbors=[pagination.tsx]
- "ui_pagination_paginationcontent": "PaginationContent()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L23 | neighbors=[pagination.tsx]
- "ui_pagination_paginationellipsis": "PaginationEllipsis()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L102 | neighbors=[pagination.tsx]
- "ui_pagination_paginationitem": "PaginationItem()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L36 | neighbors=[pagination.tsx]
- "ui_pagination_paginationlink": "PaginationLink()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L45 | neighbors=[pagination.tsx]
- "ui_pagination_paginationlinkprops": "PaginationLinkProps" | kind=code-symbol | source=src/components/ui/pagination.tsx:L40 | neighbors=[pagination.tsx]
- "ui_pagination_paginationnext": "PaginationNext()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L85 | neighbors=[pagination.tsx]
- "ui_pagination_paginationprevious": "PaginationPrevious()" | kind=code-symbol | source=src/components/ui/pagination.tsx:L68 | neighbors=[pagination.tsx]
- "ui_popover_popover": "Popover()" | kind=code-symbol | source=src/components/ui/popover.tsx:L8 | neighbors=[popover.tsx]
- "ui_popover_popoveranchor": "PopoverAnchor()" | kind=code-symbol | source=src/components/ui/popover.tsx:L42 | neighbors=[popover.tsx]
- "ui_popover_popovercontent": "PopoverContent()" | kind=code-symbol | source=src/components/ui/popover.tsx:L20 | neighbors=[popover.tsx]
- "ui_popover_popovertrigger": "PopoverTrigger()" | kind=code-symbol | source=src/components/ui/popover.tsx:L14 | neighbors=[popover.tsx]
- "ui_progress_progress": "Progress()" | kind=code-symbol | source=src/components/ui/progress.tsx:L6 | neighbors=[progress.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-111.json

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
