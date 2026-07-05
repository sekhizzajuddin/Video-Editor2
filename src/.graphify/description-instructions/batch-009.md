# Node Description Batch 10 of 16

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

- "ui_alert_dialog_alertdialogtrigger": "AlertDialogTrigger()" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L13 | neighbors=[alert-dialog.tsx]
- "ui_aspect_ratio": "aspect-ratio.tsx" | kind=code-symbol | source=components/ui/aspect-ratio.tsx:L1 | neighbors=[AspectRatio()]
- "ui_aspect_ratio_aspectratio": "AspectRatio()" | kind=code-symbol | source=components/ui/aspect-ratio.tsx:L5 | neighbors=[aspect-ratio.tsx]
- "ui_avatar_avatar": "Avatar()" | kind=code-symbol | source=components/ui/avatar.tsx:L6 | neighbors=[avatar.tsx]
- "ui_avatar_avatarfallback": "AvatarFallback()" | kind=code-symbol | source=components/ui/avatar.tsx:L35 | neighbors=[avatar.tsx]
- "ui_avatar_avatarimage": "AvatarImage()" | kind=code-symbol | source=components/ui/avatar.tsx:L22 | neighbors=[avatar.tsx]
- "ui_breadcrumb_breadcrumb": "Breadcrumb()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L7 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbellipsis": "BreadcrumbEllipsis()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L83 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbitem": "BreadcrumbItem()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L24 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumblink": "BreadcrumbLink()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L34 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumblist": "BreadcrumbList()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L11 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbpage": "BreadcrumbPage()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L52 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbseparator": "BreadcrumbSeparator()" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L65 | neighbors=[breadcrumb.tsx]
- "ui_button_group_buttongroupseparator": "ButtonGroupSeparator()" | kind=code-symbol | source=components/ui/button-group.tsx:L60 | neighbors=[button-group.tsx]
- "ui_button_group_buttongrouptext": "ButtonGroupText()" | kind=code-symbol | source=components/ui/button-group.tsx:L40 | neighbors=[button-group.tsx]
- "ui_calendar_calendar": "Calendar()" | kind=code-symbol | source=components/ui/calendar.tsx:L18 | neighbors=[calendar.tsx]
- "ui_calendar_calendardaybutton": "CalendarDayButton()" | kind=code-symbol | source=components/ui/calendar.tsx:L182 | neighbors=[calendar.tsx]
- "ui_card_card": "Card()" | kind=code-symbol | source=components/ui/card.tsx:L5 | neighbors=[card.tsx]
- "ui_card_cardaction": "CardAction()" | kind=code-symbol | source=components/ui/card.tsx:L51 | neighbors=[card.tsx]
- "ui_card_cardcontent": "CardContent()" | kind=code-symbol | source=components/ui/card.tsx:L64 | neighbors=[card.tsx]
- "ui_card_carddescription": "CardDescription()" | kind=code-symbol | source=components/ui/card.tsx:L41 | neighbors=[card.tsx]
- "ui_card_cardfooter": "CardFooter()" | kind=code-symbol | source=components/ui/card.tsx:L74 | neighbors=[card.tsx]
- "ui_card_cardheader": "CardHeader()" | kind=code-symbol | source=components/ui/card.tsx:L18 | neighbors=[card.tsx]
- "ui_card_cardtitle": "CardTitle()" | kind=code-symbol | source=components/ui/card.tsx:L31 | neighbors=[card.tsx]
- "ui_carousel_carousel": "Carousel()" | kind=code-symbol | source=components/ui/carousel.tsx:L43 | neighbors=[carousel.tsx]
- "ui_carousel_carouselapi": "CarouselApi" | kind=code-symbol | source=components/ui/carousel.tsx:L10 | neighbors=[carousel.tsx]
- "ui_carousel_carouselcontext": "CarouselContext" | kind=code-symbol | source=components/ui/carousel.tsx:L31 | neighbors=[carousel.tsx]
- "ui_carousel_carouselcontextprops": "CarouselContextProps" | kind=code-symbol | source=components/ui/carousel.tsx:L22 | neighbors=[carousel.tsx]
- "ui_carousel_carouseloptions": "CarouselOptions" | kind=code-symbol | source=components/ui/carousel.tsx:L12 | neighbors=[carousel.tsx]
- "ui_carousel_carouselplugin": "CarouselPlugin" | kind=code-symbol | source=components/ui/carousel.tsx:L13 | neighbors=[carousel.tsx]
- "ui_carousel_carouselprops": "CarouselProps" | kind=code-symbol | source=components/ui/carousel.tsx:L15 | neighbors=[carousel.tsx]
- "ui_carousel_usecarouselparameters": "UseCarouselParameters" | kind=code-symbol | source=components/ui/carousel.tsx:L11 | neighbors=[carousel.tsx]
- "ui_chart_chartconfig": "ChartConfig" | kind=code-symbol | source=components/ui/chart.tsx:L11 | neighbors=[chart.tsx]
- "ui_chart_chartcontainer": "ChartContainer()" | kind=code-symbol | source=components/ui/chart.tsx:L37 | neighbors=[chart.tsx]
- "ui_chart_chartcontext": "ChartContext" | kind=code-symbol | source=components/ui/chart.tsx:L25 | neighbors=[chart.tsx]
- "ui_chart_chartcontextprops": "ChartContextProps" | kind=code-symbol | source=components/ui/chart.tsx:L21 | neighbors=[chart.tsx]
- "ui_chart_chartstyle": "ChartStyle()" | kind=code-symbol | source=components/ui/chart.tsx:L72 | neighbors=[chart.tsx]
- "ui_chart_getpayloadconfigfrompayload": "getPayloadConfigFromPayload()" | kind=code-symbol | source=components/ui/chart.tsx:L312 | neighbors=[chart.tsx]
- "ui_chart_themes": "THEMES" | kind=code-symbol | source=components/ui/chart.tsx:L9 | neighbors=[chart.tsx]
- "ui_checkbox_checkbox": "Checkbox()" | kind=code-symbol | source=components/ui/checkbox.tsx:L9 | neighbors=[checkbox.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-009.json

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
