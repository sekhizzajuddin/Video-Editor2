# Node Description Batch 13 of 16

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

- "ui_input_group_inputgroup": "InputGroup()" | kind=code-symbol | source=components/ui/input-group.tsx:L11 | neighbors=[input-group.tsx]
- "ui_input_group_inputgroupinput": "InputGroupInput()" | kind=code-symbol | source=components/ui/input-group.tsx:L131 | neighbors=[input-group.tsx]
- "ui_input_group_inputgrouptext": "InputGroupText()" | kind=code-symbol | source=components/ui/input-group.tsx:L119 | neighbors=[input-group.tsx]
- "ui_input_group_inputgrouptextarea": "InputGroupTextarea()" | kind=code-symbol | source=components/ui/input-group.tsx:L147 | neighbors=[input-group.tsx]
- "ui_input_otp_inputotp": "InputOTP()" | kind=code-symbol | source=components/ui/input-otp.tsx:L7 | neighbors=[input-otp.tsx]
- "ui_input_otp_inputotpgroup": "InputOTPGroup()" | kind=code-symbol | source=components/ui/input-otp.tsx:L27 | neighbors=[input-otp.tsx]
- "ui_input_otp_inputotpseparator": "InputOTPSeparator()" | kind=code-symbol | source=components/ui/input-otp.tsx:L67 | neighbors=[input-otp.tsx]
- "ui_input_otp_inputotpslot": "InputOTPSlot()" | kind=code-symbol | source=components/ui/input-otp.tsx:L37 | neighbors=[input-otp.tsx]
- "ui_item_itemactions": "ItemActions()" | kind=code-symbol | source=components/ui/item.tsx:L146 | neighbors=[item.tsx]
- "ui_item_itemcontent": "ItemContent()" | kind=code-symbol | source=components/ui/item.tsx:L106 | neighbors=[item.tsx]
- "ui_item_itemdescription": "ItemDescription()" | kind=code-symbol | source=components/ui/item.tsx:L132 | neighbors=[item.tsx]
- "ui_item_itemfooter": "ItemFooter()" | kind=code-symbol | source=components/ui/item.tsx:L169 | neighbors=[item.tsx]
- "ui_item_itemgroup": "ItemGroup()" | kind=code-symbol | source=components/ui/item.tsx:L8 | neighbors=[item.tsx]
- "ui_item_itemheader": "ItemHeader()" | kind=code-symbol | source=components/ui/item.tsx:L156 | neighbors=[item.tsx]
- "ui_item_itemseparator": "ItemSeparator()" | kind=code-symbol | source=components/ui/item.tsx:L19 | neighbors=[item.tsx]
- "ui_item_itemtitle": "ItemTitle()" | kind=code-symbol | source=components/ui/item.tsx:L119 | neighbors=[item.tsx]
- "ui_kbd_kbd": "Kbd()" | kind=code-symbol | source=components/ui/kbd.tsx:L3 | neighbors=[kbd.tsx]
- "ui_kbd_kbdgroup": "KbdGroup()" | kind=code-symbol | source=components/ui/kbd.tsx:L18 | neighbors=[kbd.tsx]
- "ui_menubar_menubar": "Menubar()" | kind=code-symbol | source=components/ui/menubar.tsx:L7 | neighbors=[menubar.tsx]
- "ui_menubar_menubarcheckboxitem": "MenubarCheckboxItem()" | kind=code-symbol | source=components/ui/menubar.tsx:L112 | neighbors=[menubar.tsx]
- "ui_menubar_menubarcontent": "MenubarContent()" | kind=code-symbol | source=components/ui/menubar.tsx:L65 | neighbors=[menubar.tsx]
- "ui_menubar_menubargroup": "MenubarGroup()" | kind=code-symbol | source=components/ui/menubar.tsx:L29 | neighbors=[menubar.tsx]
- "ui_menubar_menubaritem": "MenubarItem()" | kind=code-symbol | source=components/ui/menubar.tsx:L89 | neighbors=[menubar.tsx]
- "ui_menubar_menubarlabel": "MenubarLabel()" | kind=code-symbol | source=components/ui/menubar.tsx:L162 | neighbors=[menubar.tsx]
- "ui_menubar_menubarmenu": "MenubarMenu()" | kind=code-symbol | source=components/ui/menubar.tsx:L23 | neighbors=[menubar.tsx]
- "ui_menubar_menubarportal": "MenubarPortal()" | kind=code-symbol | source=components/ui/menubar.tsx:L35 | neighbors=[menubar.tsx]
- "ui_menubar_menubarradiogroup": "MenubarRadioGroup()" | kind=code-symbol | source=components/ui/menubar.tsx:L41 | neighbors=[menubar.tsx]
- "ui_menubar_menubarradioitem": "MenubarRadioItem()" | kind=code-symbol | source=components/ui/menubar.tsx:L138 | neighbors=[menubar.tsx]
- "ui_menubar_menubarseparator": "MenubarSeparator()" | kind=code-symbol | source=components/ui/menubar.tsx:L182 | neighbors=[menubar.tsx]
- "ui_menubar_menubarshortcut": "MenubarShortcut()" | kind=code-symbol | source=components/ui/menubar.tsx:L195 | neighbors=[menubar.tsx]
- "ui_menubar_menubarsub": "MenubarSub()" | kind=code-symbol | source=components/ui/menubar.tsx:L211 | neighbors=[menubar.tsx]
- "ui_menubar_menubarsubcontent": "MenubarSubContent()" | kind=code-symbol | source=components/ui/menubar.tsx:L241 | neighbors=[menubar.tsx]
- "ui_menubar_menubarsubtrigger": "MenubarSubTrigger()" | kind=code-symbol | source=components/ui/menubar.tsx:L217 | neighbors=[menubar.tsx]
- "ui_menubar_menubartrigger": "MenubarTrigger()" | kind=code-symbol | source=components/ui/menubar.tsx:L49 | neighbors=[menubar.tsx]
- "ui_navigation_menu_navigationmenu": "NavigationMenu()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L8 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenucontent": "NavigationMenuContent()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L85 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenuindicator": "NavigationMenuIndicator()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L140 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenuitem": "NavigationMenuItem()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L48 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenulink": "NavigationMenuLink()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L124 | neighbors=[navigation-menu.tsx]
- "ui_navigation_menu_navigationmenulist": "NavigationMenuList()" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L32 | neighbors=[navigation-menu.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-012.json

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
