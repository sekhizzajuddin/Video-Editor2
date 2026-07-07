# Node Description Batch 109 of 128

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

- "ui_button_group_buttongrouptext": "ButtonGroupText()" | kind=code-symbol | source=src/components/ui/button-group.tsx:L40 | neighbors=[button-group.tsx]
- "ui_calendar_calendar": "Calendar()" | kind=code-symbol | source=src/components/ui/calendar.tsx:L18 | neighbors=[calendar.tsx]
- "ui_calendar_calendardaybutton": "CalendarDayButton()" | kind=code-symbol | source=src/components/ui/calendar.tsx:L182 | neighbors=[calendar.tsx]
- "ui_card_card": "Card()" | kind=code-symbol | source=src/components/ui/card.tsx:L5 | neighbors=[card.tsx]
- "ui_card_cardaction": "CardAction()" | kind=code-symbol | source=src/components/ui/card.tsx:L51 | neighbors=[card.tsx]
- "ui_card_cardcontent": "CardContent()" | kind=code-symbol | source=src/components/ui/card.tsx:L64 | neighbors=[card.tsx]
- "ui_card_carddescription": "CardDescription()" | kind=code-symbol | source=src/components/ui/card.tsx:L41 | neighbors=[card.tsx]
- "ui_card_cardfooter": "CardFooter()" | kind=code-symbol | source=src/components/ui/card.tsx:L74 | neighbors=[card.tsx]
- "ui_card_cardheader": "CardHeader()" | kind=code-symbol | source=src/components/ui/card.tsx:L18 | neighbors=[card.tsx]
- "ui_card_cardtitle": "CardTitle()" | kind=code-symbol | source=src/components/ui/card.tsx:L31 | neighbors=[card.tsx]
- "ui_carousel_carousel": "Carousel()" | kind=code-symbol | source=src/components/ui/carousel.tsx:L43 | neighbors=[carousel.tsx]
- "ui_carousel_carouselapi": "CarouselApi" | kind=code-symbol | source=src/components/ui/carousel.tsx:L10 | neighbors=[carousel.tsx]
- "ui_carousel_carouselcontext": "CarouselContext" | kind=code-symbol | source=src/components/ui/carousel.tsx:L31 | neighbors=[carousel.tsx]
- "ui_carousel_carouselcontextprops": "CarouselContextProps" | kind=code-symbol | source=src/components/ui/carousel.tsx:L22 | neighbors=[carousel.tsx]
- "ui_carousel_carouseloptions": "CarouselOptions" | kind=code-symbol | source=src/components/ui/carousel.tsx:L12 | neighbors=[carousel.tsx]
- "ui_carousel_carouselplugin": "CarouselPlugin" | kind=code-symbol | source=src/components/ui/carousel.tsx:L13 | neighbors=[carousel.tsx]
- "ui_carousel_carouselprops": "CarouselProps" | kind=code-symbol | source=src/components/ui/carousel.tsx:L15 | neighbors=[carousel.tsx]
- "ui_carousel_usecarouselparameters": "UseCarouselParameters" | kind=code-symbol | source=src/components/ui/carousel.tsx:L11 | neighbors=[carousel.tsx]
- "ui_chart_chartconfig": "ChartConfig" | kind=code-symbol | source=src/components/ui/chart.tsx:L11 | neighbors=[chart.tsx]
- "ui_chart_chartcontainer": "ChartContainer()" | kind=code-symbol | source=src/components/ui/chart.tsx:L37 | neighbors=[chart.tsx]
- "ui_chart_chartcontext": "ChartContext" | kind=code-symbol | source=src/components/ui/chart.tsx:L25 | neighbors=[chart.tsx]
- "ui_chart_chartcontextprops": "ChartContextProps" | kind=code-symbol | source=src/components/ui/chart.tsx:L21 | neighbors=[chart.tsx]
- "ui_chart_chartstyle": "ChartStyle()" | kind=code-symbol | source=src/components/ui/chart.tsx:L72 | neighbors=[chart.tsx]
- "ui_chart_getpayloadconfigfrompayload": "getPayloadConfigFromPayload()" | kind=code-symbol | source=src/components/ui/chart.tsx:L312 | neighbors=[chart.tsx]
- "ui_chart_themes": "THEMES" | kind=code-symbol | source=src/components/ui/chart.tsx:L9 | neighbors=[chart.tsx]
- "ui_checkbox_checkbox": "Checkbox()" | kind=code-symbol | source=src/components/ui/checkbox.tsx:L9 | neighbors=[checkbox.tsx]
- "ui_collapsible_collapsible": "Collapsible()" | kind=code-symbol | source=src/components/ui/collapsible.tsx:L3 | neighbors=[collapsible.tsx]
- "ui_collapsible_collapsiblecontent": "CollapsibleContent()" | kind=code-symbol | source=src/components/ui/collapsible.tsx:L20 | neighbors=[collapsible.tsx]
- "ui_collapsible_collapsibletrigger": "CollapsibleTrigger()" | kind=code-symbol | source=src/components/ui/collapsible.tsx:L9 | neighbors=[collapsible.tsx]
- "ui_command_command": "Command()" | kind=code-symbol | source=src/components/ui/command.tsx:L14 | neighbors=[command.tsx]
- "ui_command_commanddialog": "CommandDialog()" | kind=code-symbol | source=src/components/ui/command.tsx:L30 | neighbors=[command.tsx]
- "ui_command_commandempty": "CommandEmpty()" | kind=code-symbol | source=src/components/ui/command.tsx:L99 | neighbors=[command.tsx]
- "ui_command_commandgroup": "CommandGroup()" | kind=code-symbol | source=src/components/ui/command.tsx:L111 | neighbors=[command.tsx]
- "ui_command_commandinput": "CommandInput()" | kind=code-symbol | source=src/components/ui/command.tsx:L61 | neighbors=[command.tsx]
- "ui_command_commanditem": "CommandItem()" | kind=code-symbol | source=src/components/ui/command.tsx:L140 | neighbors=[command.tsx]
- "ui_command_commandlist": "CommandList()" | kind=code-symbol | source=src/components/ui/command.tsx:L83 | neighbors=[command.tsx]
- "ui_command_commandseparator": "CommandSeparator()" | kind=code-symbol | source=src/components/ui/command.tsx:L127 | neighbors=[command.tsx]
- "ui_command_commandshortcut": "CommandShortcut()" | kind=code-symbol | source=src/components/ui/command.tsx:L156 | neighbors=[command.tsx]
- "ui_context_menu_contextmenu": "ContextMenu()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L9 | neighbors=[context-menu.tsx]
- "ui_context_menu_contextmenucheckboxitem": "ContextMenuCheckboxItem()" | kind=code-symbol | source=src/components/ui/context-menu.tsx:L137 | neighbors=[context-menu.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-108.json

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
