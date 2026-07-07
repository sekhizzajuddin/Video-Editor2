# Node Description Batch 70 of 128

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

- "ui_item_itemmedia": "ItemMedia()" | kind=code-symbol | source=src/components/ui/item.tsx:L91 | neighbors=[item.tsx, itemMediaVariants]
- "ui_item_itemmediavariants": "itemMediaVariants" | kind=code-symbol | source=src/components/ui/item.tsx:L74 | neighbors=[item.tsx, ItemMedia()]
- "ui_item_itemvariants": "itemVariants" | kind=code-symbol | source=src/components/ui/item.tsx:L33 | neighbors=[item.tsx, Item()]
- "ui_navigation_menu_navigationmenutrigger": "NavigationMenuTrigger()" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L65 | neighbors=[navigation-menu.tsx, navigationMenuTriggerStyle]
- "ui_navigation_menu_navigationmenutriggerstyle": "navigationMenuTriggerStyle" | kind=code-symbol | source=src/components/ui/navigation-menu.tsx:L61 | neighbors=[navigation-menu.tsx, NavigationMenuTrigger()]
- "ui_sheet_sheet": "Sheet()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L7 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheetcontent": "SheetContent()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L45 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheetdescription": "SheetDescription()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L115 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheetheader": "SheetHeader()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L82 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sheet_sheettitle": "SheetTitle()" | kind=code-symbol | source=src/components/ui/sheet.tsx:L102 | neighbors=[sheet.tsx, sidebar.tsx]
- "ui_sidebar_sidebar": "Sidebar()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L154 | neighbors=[sidebar.tsx, useSidebar()]
- "ui_sidebar_sidebarmenubuttonvariants": "sidebarMenuButtonVariants" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L476 | neighbors=[sidebar.tsx, SidebarMenuButton()]
- "ui_sidebar_sidebarrail": "SidebarRail()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L282 | neighbors=[sidebar.tsx, useSidebar()]
- "ui_sidebar_sidebartrigger": "SidebarTrigger()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L256 | neighbors=[sidebar.tsx, useSidebar()]
- "ui_skeleton_skeleton": "Skeleton()" | kind=code-symbol | source=src/components/ui/skeleton.tsx:L3 | neighbors=[sidebar.tsx, skeleton.tsx]
- "ui_sonner": "sonner.tsx" | kind=code-symbol | source=src/components/ui/sonner.tsx:L1 | neighbors=[App.tsx, Toaster()]
- "ui_sonner_toaster": "Toaster()" | kind=code-symbol | source=src/components/ui/sonner.tsx:L11 | neighbors=[App.tsx, sonner.tsx]
- "ui_textarea_textarea": "Textarea()" | kind=code-symbol | source=src/components/ui/textarea.tsx:L5 | neighbors=[input-group.tsx, textarea.tsx]
- "ui_toggle_toggle": "Toggle()" | kind=code-symbol | source=src/components/ui/toggle.tsx:L29 | neighbors=[toggle.tsx, toggleVariants]
- "ui_tooltip_tooltip": "Tooltip()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L21 | neighbors=[sidebar.tsx, tooltip.tsx]
- "ui_tooltip_tooltipcontent": "TooltipContent()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L37 | neighbors=[sidebar.tsx, tooltip.tsx]
- "ui_tooltip_tooltipprovider": "TooltipProvider()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L8 | neighbors=[sidebar.tsx, tooltip.tsx]
- "ui_tooltip_tooltiptrigger": "TooltipTrigger()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L31 | neighbors=[sidebar.tsx, tooltip.tsx]
- "upscaling_upscaling_engine_getupscalingengine": "getUpscalingEngine()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L778 | neighbors=[upscaling-engine.ts, UpscalingEngine]
- "upscaling_upscaling_engine_upscalingengine_canvas2dfallback": ".canvas2DFallback()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L722 | neighbors=[UpscalingEngine, .upscaleImageBitmap()]
- "upscaling_upscaling_engine_upscalingengine_cleartexturepool": ".clearTexturePool()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L749 | neighbors=[UpscalingEngine, .dispose()]
- "upscaling_upscaling_engine_upscalingengine_createbindgrouplayouts": ".createBindGroupLayouts()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L54 | neighbors=[UpscalingEngine, .initialize()]
- "upscaling_upscaling_engine_upscalingengine_createpipelines": ".createPipelines()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L147 | neighbors=[UpscalingEngine, .initialize()]
- "upscaling_upscaling_engine_upscalingengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L758 | neighbors=[UpscalingEngine, .clearTexturePool()]
- "upscaling_upscaling_engine_upscalingengine_shouldupscale": ".shouldUpscale()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L215 | neighbors=[UpscalingEngine, .upscale()]
- "upscaling_upscaling_engine_upscalingengine_texturetoimagebitmap": ".textureToImageBitmap()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L673 | neighbors=[UpscalingEngine, .upscaleImageBitmap()]
- "upscaling_upscaling_types_default_upscaling_settings": "DEFAULT_UPSCALING_SETTINGS" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L9 | neighbors=[upscaling-engine.ts, upscaling-types.ts]
- "upscaling_upscaling_types_texturepoolentry": "TexturePoolEntry" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L20 | neighbors=[upscaling-engine.ts, upscaling-types.ts]
- "upscaling_upscaling_types_upscalingconfig": "UpscalingConfig" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L15 | neighbors=[upscaling-engine.ts, upscaling-types.ts]
- "upscaling_upscaling_types_upscalingsettings": "UpscalingSettings" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-types.ts:L3 | neighbors=[upscaling-engine.ts, upscaling-types.ts]
- "utils_aibackground_initinstance": "initInstance()" | kind=code-symbol | source=src/utils/aiBackground.ts:L41 | neighbors=[aiBackground.ts, onResults()]
- "utils_aibackground_loadmediapipe": "loadMediaPipe()" | kind=code-symbol | source=src/utils/aiBackground.ts:L10 | neighbors=[aiBackground.ts, segmentFrame()]
- "utils_aibackground_onresults": "onResults()" | kind=code-symbol | source=src/utils/aiBackground.ts:L70 | neighbors=[aiBackground.ts, initInstance()]
- "utils_aiclient_aicueresult": "AICueResult" | kind=code-symbol | source=src/utils/aiClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, aiClient.ts]
- "utils_audiosearchclient_audiooption": "AudioOption" | kind=code-symbol | source=src/utils/audioSearchClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, audioSearchClient.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-069.json

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
