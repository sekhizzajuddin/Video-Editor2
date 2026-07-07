# Node Description Batch 108 of 128

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

- "types_transform_3d_gettransform3dpresetbyid": "getTransform3DPresetById()" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L333 | neighbors=[transform-3d.ts]
- "types_transform_3d_gettransform3dpresetsbycategory": "getTransform3DPresetsByCategory()" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L327 | neighbors=[transform-3d.ts]
- "types_transform_3d_interpolatetransform3d": "interpolateTransform3D()" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L339 | neighbors=[transform-3d.ts]
- "types_transform_3d_layer3dconfig": "Layer3DConfig" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L27 | neighbors=[transform-3d.ts]
- "types_transform_3d_layer3dkeyframe": "Layer3DKeyframe" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L41 | neighbors=[transform-3d.ts]
- "types_transform_3d_mergetransform3d": "mergeTransform3D()" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L369 | neighbors=[transform-3d.ts]
- "types_transform_3d_transform_3d_presets": "TRANSFORM_3D_PRESETS" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L90 | neighbors=[transform-3d.ts]
- "types_transform_3d_transform3d": "Transform3D" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L3 | neighbors=[transform-3d.ts]
- "types_transform_3d_transform3dpreset": "Transform3DPreset" | kind=code-symbol | source=packages/core/src/types/transform-3d.ts:L82 | neighbors=[transform-3d.ts]
- "types_transitions_transitionwithoutid": "TransitionWithoutId" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L111 | neighbors=[transitions.ts]
- "ui_accordion_accordion": "Accordion()" | kind=code-symbol | source=src/components/ui/accordion.tsx:L7 | neighbors=[accordion.tsx]
- "ui_accordion_accordioncontent": "AccordionContent()" | kind=code-symbol | source=src/components/ui/accordion.tsx:L48 | neighbors=[accordion.tsx]
- "ui_accordion_accordionitem": "AccordionItem()" | kind=code-symbol | source=src/components/ui/accordion.tsx:L13 | neighbors=[accordion.tsx]
- "ui_accordion_accordiontrigger": "AccordionTrigger()" | kind=code-symbol | source=src/components/ui/accordion.tsx:L26 | neighbors=[accordion.tsx]
- "ui_alert_alertdescription": "AlertDescription()" | kind=code-symbol | source=src/components/ui/alert.tsx:L50 | neighbors=[alert.tsx]
- "ui_alert_alerttitle": "AlertTitle()" | kind=code-symbol | source=src/components/ui/alert.tsx:L37 | neighbors=[alert.tsx]
- "ui_alert_dialog_alertdialog": "AlertDialog()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L7 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogaction": "AlertDialogAction()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L119 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogcancel": "AlertDialogCancel()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L131 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogcontent": "AlertDialogContent()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L45 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogdescription": "AlertDialogDescription()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L106 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogfooter": "AlertDialogFooter()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L77 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogheader": "AlertDialogHeader()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L64 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogoverlay": "AlertDialogOverlay()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L29 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogportal": "AlertDialogPortal()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L21 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogtitle": "AlertDialogTitle()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L93 | neighbors=[alert-dialog.tsx]
- "ui_alert_dialog_alertdialogtrigger": "AlertDialogTrigger()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L13 | neighbors=[alert-dialog.tsx]
- "ui_aspect_ratio": "aspect-ratio.tsx" | kind=code-symbol | source=src/components/ui/aspect-ratio.tsx:L1 | neighbors=[AspectRatio()]
- "ui_aspect_ratio_aspectratio": "AspectRatio()" | kind=code-symbol | source=src/components/ui/aspect-ratio.tsx:L5 | neighbors=[aspect-ratio.tsx]
- "ui_avatar_avatar": "Avatar()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L6 | neighbors=[avatar.tsx]
- "ui_avatar_avatarfallback": "AvatarFallback()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L35 | neighbors=[avatar.tsx]
- "ui_avatar_avatarimage": "AvatarImage()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L22 | neighbors=[avatar.tsx]
- "ui_breadcrumb_breadcrumb": "Breadcrumb()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L7 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbellipsis": "BreadcrumbEllipsis()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L83 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbitem": "BreadcrumbItem()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L24 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumblink": "BreadcrumbLink()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L34 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumblist": "BreadcrumbList()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L11 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbpage": "BreadcrumbPage()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L52 | neighbors=[breadcrumb.tsx]
- "ui_breadcrumb_breadcrumbseparator": "BreadcrumbSeparator()" | kind=code-symbol | source=src/components/ui/breadcrumb.tsx:L65 | neighbors=[breadcrumb.tsx]
- "ui_button_group_buttongroupseparator": "ButtonGroupSeparator()" | kind=code-symbol | source=src/components/ui/button-group.tsx:L60 | neighbors=[button-group.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-107.json

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
