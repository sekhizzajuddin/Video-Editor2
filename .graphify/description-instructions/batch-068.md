# Node Description Batch 69 of 128

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

- "types_transitions_createtransition": "createTransition()" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L382 | neighbors=[index.ts, transitions.ts]
- "types_transitions_gettransitionpresetbyid": "getTransitionPresetById()" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L448 | neighbors=[index.ts, transitions.ts]
- "types_transitions_gettransitionpresetsbycategory": "getTransitionPresetsByCategory()" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L454 | neighbors=[index.ts, transitions.ts]
- "types_transitions_irisshape": "IrisShape" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L26 | neighbors=[index.ts, transitions.ts]
- "types_transitions_layertransition": "LayerTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L98 | neighbors=[index.ts, transitions.ts]
- "types_transitions_slidedirection": "SlideDirection" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L24 | neighbors=[index.ts, transitions.ts]
- "types_transitions_transition": "Transition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L87 | neighbors=[index.ts, transitions.ts]
- "types_transitions_transition_presets": "TRANSITION_PRESETS" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L130 | neighbors=[index.ts, transitions.ts]
- "types_transitions_transitionpreset": "TransitionPreset" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L122 | neighbors=[index.ts, transitions.ts]
- "types_transitions_wipedirection": "WipeDirection" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L14 | neighbors=[index.ts, transitions.ts]
- "ui_alert_alert": "Alert()" | kind=code-symbol | source=src/components/ui/alert.tsx:L22 | neighbors=[alert.tsx, alertVariants]
- "ui_alert_alertvariants": "alertVariants" | kind=code-symbol | source=src/components/ui/alert.tsx:L6 | neighbors=[alert.tsx, Alert()]
- "ui_badge_badge": "Badge()" | kind=code-symbol | source=src/components/ui/badge.tsx:L28 | neighbors=[badge.tsx, badgeVariants]
- "ui_badge_badgevariants": "badgeVariants" | kind=code-symbol | source=src/components/ui/badge.tsx:L7 | neighbors=[badge.tsx, Badge()]
- "ui_button_group_buttongroup": "ButtonGroup()" | kind=code-symbol | source=src/components/ui/button-group.tsx:L24 | neighbors=[button-group.tsx, buttonGroupVariants]
- "ui_button_group_buttongroupvariants": "buttonGroupVariants" | kind=code-symbol | source=src/components/ui/button-group.tsx:L7 | neighbors=[button-group.tsx, ButtonGroup()]
- "ui_carousel_carouselcontent": "CarouselContent()" | kind=code-symbol | source=src/components/ui/carousel.tsx:L133 | neighbors=[carousel.tsx, useCarousel()]
- "ui_carousel_carouselitem": "CarouselItem()" | kind=code-symbol | source=src/components/ui/carousel.tsx:L154 | neighbors=[carousel.tsx, useCarousel()]
- "ui_carousel_carouselnext": "CarouselNext()" | kind=code-symbol | source=src/components/ui/carousel.tsx:L202 | neighbors=[carousel.tsx, useCarousel()]
- "ui_carousel_carouselprevious": "CarouselPrevious()" | kind=code-symbol | source=src/components/ui/carousel.tsx:L172 | neighbors=[carousel.tsx, useCarousel()]
- "ui_chart_chartlegendcontent": "ChartLegendContent()" | kind=code-symbol | source=src/components/ui/chart.tsx:L255 | neighbors=[chart.tsx, useChart()]
- "ui_chart_charttooltipcontent": "ChartTooltipContent()" | kind=code-symbol | source=src/components/ui/chart.tsx:L107 | neighbors=[chart.tsx, useChart()]
- "ui_dialog_dialog": "Dialog()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L7 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogcontent": "DialogContent()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L47 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogdescription": "DialogDescription()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L117 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogheader": "DialogHeader()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L81 | neighbors=[command.tsx, dialog.tsx]
- "ui_dialog_dialogtitle": "DialogTitle()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L104 | neighbors=[command.tsx, dialog.tsx]
- "ui_empty_emptymedia": "EmptyMedia()" | kind=code-symbol | source=src/components/ui/empty.tsx:L46 | neighbors=[empty.tsx, emptyMediaVariants]
- "ui_empty_emptymediavariants": "emptyMediaVariants" | kind=code-symbol | source=src/components/ui/empty.tsx:L31 | neighbors=[empty.tsx, EmptyMedia()]
- "ui_field_field": "Field()" | kind=code-symbol | source=src/components/ui/field.tsx:L79 | neighbors=[field.tsx, fieldVariants]
- "ui_field_fieldvariants": "fieldVariants" | kind=code-symbol | source=src/components/ui/field.tsx:L55 | neighbors=[field.tsx, Field()]
- "ui_form_formcontrol": "FormControl()" | kind=code-symbol | source=src/components/ui/form.tsx:L107 | neighbors=[form.tsx, useFormField()]
- "ui_form_formdescription": "FormDescription()" | kind=code-symbol | source=src/components/ui/form.tsx:L125 | neighbors=[form.tsx, useFormField()]
- "ui_form_formlabel": "FormLabel()" | kind=code-symbol | source=src/components/ui/form.tsx:L90 | neighbors=[form.tsx, useFormField()]
- "ui_form_formmessage": "FormMessage()" | kind=code-symbol | source=src/components/ui/form.tsx:L138 | neighbors=[form.tsx, useFormField()]
- "ui_input_group_inputgroupaddon": "InputGroupAddon()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L60 | neighbors=[input-group.tsx, inputGroupAddonVariants]
- "ui_input_group_inputgroupaddonvariants": "inputGroupAddonVariants" | kind=code-symbol | source=src/components/ui/input-group.tsx:L39 | neighbors=[input-group.tsx, InputGroupAddon()]
- "ui_input_group_inputgroupbutton": "InputGroupButton()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L100 | neighbors=[input-group.tsx, inputGroupButtonVariants]
- "ui_input_group_inputgroupbuttonvariants": "inputGroupButtonVariants" | kind=code-symbol | source=src/components/ui/input-group.tsx:L82 | neighbors=[input-group.tsx, InputGroupButton()]
- "ui_item_item": "Item()" | kind=code-symbol | source=src/components/ui/item.tsx:L54 | neighbors=[item.tsx, itemVariants]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-068.json

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
