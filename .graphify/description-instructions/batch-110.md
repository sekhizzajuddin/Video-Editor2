# Node Description Batch 111 of 128

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

- "ui_dropdown_menu_dropdownmenusubcontent": "DropdownMenuSubContent()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L223 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenusubtrigger": "DropdownMenuSubTrigger()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L199 | neighbors=[dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenutrigger": "DropdownMenuTrigger()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L21 | neighbors=[dropdown-menu.tsx]
- "ui_empty_empty": "Empty()" | kind=code-symbol | source=src/components/ui/empty.tsx:L5 | neighbors=[empty.tsx]
- "ui_empty_emptycontent": "EmptyContent()" | kind=code-symbol | source=src/components/ui/empty.tsx:L84 | neighbors=[empty.tsx]
- "ui_empty_emptydescription": "EmptyDescription()" | kind=code-symbol | source=src/components/ui/empty.tsx:L71 | neighbors=[empty.tsx]
- "ui_empty_emptyheader": "EmptyHeader()" | kind=code-symbol | source=src/components/ui/empty.tsx:L18 | neighbors=[empty.tsx]
- "ui_empty_emptytitle": "EmptyTitle()" | kind=code-symbol | source=src/components/ui/empty.tsx:L61 | neighbors=[empty.tsx]
- "ui_field_fieldcontent": "FieldContent()" | kind=code-symbol | source=src/components/ui/field.tsx:L95 | neighbors=[field.tsx]
- "ui_field_fielddescription": "FieldDescription()" | kind=code-symbol | source=src/components/ui/field.tsx:L139 | neighbors=[field.tsx]
- "ui_field_fielderror": "FieldError()" | kind=code-symbol | source=src/components/ui/field.tsx:L184 | neighbors=[field.tsx]
- "ui_field_fieldgroup": "FieldGroup()" | kind=code-symbol | source=src/components/ui/field.tsx:L42 | neighbors=[field.tsx]
- "ui_field_fieldlabel": "FieldLabel()" | kind=code-symbol | source=src/components/ui/field.tsx:L108 | neighbors=[field.tsx]
- "ui_field_fieldlegend": "FieldLegend()" | kind=code-symbol | source=src/components/ui/field.tsx:L22 | neighbors=[field.tsx]
- "ui_field_fieldseparator": "FieldSeparator()" | kind=code-symbol | source=src/components/ui/field.tsx:L154 | neighbors=[field.tsx]
- "ui_field_fieldset": "FieldSet()" | kind=code-symbol | source=src/components/ui/field.tsx:L8 | neighbors=[field.tsx]
- "ui_field_fieldtitle": "FieldTitle()" | kind=code-symbol | source=src/components/ui/field.tsx:L126 | neighbors=[field.tsx]
- "ui_form_formfield": "FormField()" | kind=code-symbol | source=src/components/ui/form.tsx:L32 | neighbors=[form.tsx]
- "ui_form_formfieldcontext": "FormFieldContext" | kind=code-symbol | source=src/components/ui/form.tsx:L28 | neighbors=[form.tsx]
- "ui_form_formfieldcontextvalue": "FormFieldContextValue" | kind=code-symbol | source=src/components/ui/form.tsx:L21 | neighbors=[form.tsx]
- "ui_form_formitem": "FormItem()" | kind=code-symbol | source=src/components/ui/form.tsx:L76 | neighbors=[form.tsx]
- "ui_form_formitemcontext": "FormItemContext" | kind=code-symbol | source=src/components/ui/form.tsx:L72 | neighbors=[form.tsx]
- "ui_form_formitemcontextvalue": "FormItemContextValue" | kind=code-symbol | source=src/components/ui/form.tsx:L68 | neighbors=[form.tsx]
- "ui_hover_card_hovercard": "HoverCard()" | kind=code-symbol | source=src/components/ui/hover-card.tsx:L8 | neighbors=[hover-card.tsx]
- "ui_hover_card_hovercardcontent": "HoverCardContent()" | kind=code-symbol | source=src/components/ui/hover-card.tsx:L22 | neighbors=[hover-card.tsx]
- "ui_hover_card_hovercardtrigger": "HoverCardTrigger()" | kind=code-symbol | source=src/components/ui/hover-card.tsx:L14 | neighbors=[hover-card.tsx]
- "ui_input_group_inputgroup": "InputGroup()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L11 | neighbors=[input-group.tsx]
- "ui_input_group_inputgroupinput": "InputGroupInput()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L131 | neighbors=[input-group.tsx]
- "ui_input_group_inputgrouptext": "InputGroupText()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L119 | neighbors=[input-group.tsx]
- "ui_input_group_inputgrouptextarea": "InputGroupTextarea()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L147 | neighbors=[input-group.tsx]
- "ui_input_otp_inputotp": "InputOTP()" | kind=code-symbol | source=src/components/ui/input-otp.tsx:L7 | neighbors=[input-otp.tsx]
- "ui_input_otp_inputotpgroup": "InputOTPGroup()" | kind=code-symbol | source=src/components/ui/input-otp.tsx:L27 | neighbors=[input-otp.tsx]
- "ui_input_otp_inputotpseparator": "InputOTPSeparator()" | kind=code-symbol | source=src/components/ui/input-otp.tsx:L67 | neighbors=[input-otp.tsx]
- "ui_input_otp_inputotpslot": "InputOTPSlot()" | kind=code-symbol | source=src/components/ui/input-otp.tsx:L37 | neighbors=[input-otp.tsx]
- "ui_item_itemactions": "ItemActions()" | kind=code-symbol | source=src/components/ui/item.tsx:L146 | neighbors=[item.tsx]
- "ui_item_itemcontent": "ItemContent()" | kind=code-symbol | source=src/components/ui/item.tsx:L106 | neighbors=[item.tsx]
- "ui_item_itemdescription": "ItemDescription()" | kind=code-symbol | source=src/components/ui/item.tsx:L132 | neighbors=[item.tsx]
- "ui_item_itemfooter": "ItemFooter()" | kind=code-symbol | source=src/components/ui/item.tsx:L169 | neighbors=[item.tsx]
- "ui_item_itemgroup": "ItemGroup()" | kind=code-symbol | source=src/components/ui/item.tsx:L8 | neighbors=[item.tsx]
- "ui_item_itemheader": "ItemHeader()" | kind=code-symbol | source=src/components/ui/item.tsx:L156 | neighbors=[item.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-110.json

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
