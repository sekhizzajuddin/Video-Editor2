# Node Description Batch 2 of 16

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

- "ui_breadcrumb": "breadcrumb.tsx" | kind=code-symbol | source=components/ui/breadcrumb.tsx:L1 | neighbors=[utils.ts, cn(), Breadcrumb(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink()]
- "ui_card": "card.tsx" | kind=code-symbol | source=components/ui/card.tsx:L1 | neighbors=[utils.ts, cn(), Card(), CardAction(), CardContent(), CardDescription()]
- "ui_empty": "empty.tsx" | kind=code-symbol | source=components/ui/empty.tsx:L1 | neighbors=[utils.ts, cn(), Empty(), EmptyContent(), EmptyDescription(), EmptyHeader()]
- "utils_mediaprobe_probefile": "probeFile()" | kind=code-symbol | source=utils/mediaProbe.ts:L227 | neighbors=[MediaPanel.tsx, SettingsModal.tsx, TopToolbar.tsx, mediaProbe.ts, detectMediaType(), generateId()]
- "utils_titletemplates": "titleTemplates.ts" | kind=code-symbol | source=utils/titleTemplates.ts:L1 | neighbors=[MediaPanel.tsx, Timeline.tsx, index.ts, ClipAnimations, ClipTextSettings, TEMPLATE_CATEGORIES]
- "components_toptoolbar": "TopToolbar.tsx" | kind=code-symbol | source=components/TopToolbar.tsx:L1 | neighbors=[App.tsx, TopToolbar(), editorStore.ts, useEditorStore, index.ts, EditorTool]
- "ui_button_group": "button-group.tsx" | kind=code-symbol | source=components/ui/button-group.tsx:L1 | neighbors=[utils.ts, cn(), ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants]
- "utils_motiontracker": "motionTracker.ts" | kind=code-symbol | source=utils/motionTracker.ts:L1 | neighbors=[PropertiesPanel.tsx, index.ts, CornerPoints, getGrayscalePatch(), matchTemplate(), Point]
- "ui_button_button": "Button()" | kind=code-symbol | source=components/ui/button.tsx:L39 | neighbors=[button.tsx, buttonVariants, calendar.tsx, carousel.tsx, input-group.tsx, pagination.tsx]
- "ui_calendar": "calendar.tsx" | kind=code-symbol | source=components/ui/calendar.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), buttonVariants, Calendar()]
- "ui_separator": "separator.tsx" | kind=code-symbol | source=components/ui/separator.tsx:L1 | neighbors=[button-group.tsx, field.tsx, item.tsx, utils.ts, cn(), Separator()]
- "ui_toggle_group": "toggle-group.tsx" | kind=code-symbol | source=components/ui/toggle-group.tsx:L1 | neighbors=[utils.ts, cn(), toggle.tsx, ToggleGroup(), ToggleGroupContext, ToggleGroupItem()]
- "ui_tooltip": "tooltip.tsx" | kind=code-symbol | source=components/ui/tooltip.tsx:L1 | neighbors=[sidebar.tsx, utils.ts, cn(), Tooltip(), TooltipContent(), TooltipProvider()]
- "utils_keyframes": "keyframes.ts" | kind=code-symbol | source=utils/keyframes.ts:L1 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts, index.ts, PropertyKeyframe, addOrUpdateKeyframe()]
- "utils_lutparser": "lutParser.ts" | kind=code-symbol | source=utils/lutParser.ts:L1 | neighbors=[MediaPanel.tsx, PreviewCanvas.tsx, index.ts, LutData, applyLutToCanvas(), applyLutToPixel()]
- "types_index_mediaitem": "MediaItem" | kind=code-symbol | source=types/index.ts:L18 | neighbors=[MediaPanel.tsx, Timeline.tsx, editorStore.ts, index.ts, mediaProbe.ts, projectPersistence.ts]
- "ui_accordion": "accordion.tsx" | kind=code-symbol | source=components/ui/accordion.tsx:L1 | neighbors=[utils.ts, cn(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger()]
- "ui_alert": "alert.tsx" | kind=code-symbol | source=components/ui/alert.tsx:L1 | neighbors=[utils.ts, cn(), Alert(), AlertDescription(), AlertTitle(), alertVariants]
- "ui_input_otp": "input-otp.tsx" | kind=code-symbol | source=components/ui/input-otp.tsx:L1 | neighbors=[utils.ts, cn(), InputOTP(), InputOTPGroup(), InputOTPSeparator(), InputOTPSlot()]
- "ui_popover": "popover.tsx" | kind=code-symbol | source=components/ui/popover.tsx:L1 | neighbors=[utils.ts, cn(), Popover(), PopoverAnchor(), PopoverContent(), PopoverTrigger()]
- "ui_tabs": "tabs.tsx" | kind=code-symbol | source=components/ui/tabs.tsx:L1 | neighbors=[utils.ts, cn(), Tabs(), TabsContent(), TabsList(), TabsTrigger()]
- "utils_projectpersistence_restoresnapshotmedia": "restoreSnapshotMedia()" | kind=code-symbol | source=utils/projectPersistence.ts:L151 | neighbors=[SettingsModal.tsx, projectPersistence.ts, loadProjectFromDB(), generateFrameStrip(), generateVideoThumbnail(), getFileFromDB()]
- "utils_speedramp_getmediatimeatposition": "getMediaTimeAtPosition()" | kind=code-symbol | source=utils/speedRamp.ts:L109 | neighbors=[PropertiesPanel.tsx, editorStore.ts, speedRamp.ts, getIntegralTable(), getSpeedAtPosition(), getMediaTimeForClip()]
- "utils_speedramp_getspeedatposition": "getSpeedAtPosition()" | kind=code-symbol | source=utils/speedRamp.ts:L29 | neighbors=[PropertiesPanel.tsx, useMediaPlayback.ts, speedRamp.ts, getIntegralTable(), getMediaTimeAtPosition(), getFullKeyframes()]
- "utils_time": "time.ts" | kind=code-symbol | source=utils/time.ts:L1 | neighbors=[ExportModal.tsx, PreviewCanvas.tsx, Timeline.tsx, formatSimpleTime(), formatTime(), snapToGrid()]
- "types_index_timelinetrack": "TimelineTrack" | kind=code-symbol | source=types/index.ts:L312 | neighbors=[AudioMixer.tsx, Timeline.tsx, editorStore.ts, index.ts, projectPersistence.ts]
- "ui_avatar": "avatar.tsx" | kind=code-symbol | source=components/ui/avatar.tsx:L1 | neighbors=[utils.ts, cn(), Avatar(), AvatarFallback(), AvatarImage()]
- "ui_button_buttonvariants": "buttonVariants" | kind=code-symbol | source=components/ui/button.tsx:L7 | neighbors=[alert-dialog.tsx, button.tsx, Button(), calendar.tsx, pagination.tsx]
- "ui_carousel_usecarousel": "useCarousel()" | kind=code-symbol | source=components/ui/carousel.tsx:L33 | neighbors=[carousel.tsx, CarouselContent(), CarouselItem(), CarouselNext(), CarouselPrevious()]
- "ui_form_useformfield": "useFormField()" | kind=code-symbol | source=components/ui/form.tsx:L45 | neighbors=[form.tsx, FormControl(), FormDescription(), FormLabel(), FormMessage()]
- "ui_hover_card": "hover-card.tsx" | kind=code-symbol | source=components/ui/hover-card.tsx:L1 | neighbors=[utils.ts, cn(), HoverCard(), HoverCardContent(), HoverCardTrigger()]
- "ui_input": "input.tsx" | kind=code-symbol | source=components/ui/input.tsx:L1 | neighbors=[utils.ts, cn(), Input(), input-group.tsx, sidebar.tsx]
- "ui_label": "label.tsx" | kind=code-symbol | source=components/ui/label.tsx:L1 | neighbors=[field.tsx, form.tsx, utils.ts, cn(), Label()]
- "ui_resizable": "resizable.tsx" | kind=code-symbol | source=components/ui/resizable.tsx:L1 | neighbors=[utils.ts, cn(), ResizableHandle(), ResizablePanel(), ResizablePanelGroup()]
- "ui_separator_separator": "Separator()" | kind=code-symbol | source=components/ui/separator.tsx:L8 | neighbors=[button-group.tsx, field.tsx, item.tsx, separator.tsx, sidebar.tsx]
- "ui_sidebar_usesidebar": "useSidebar()" | kind=code-symbol | source=components/ui/sidebar.tsx:L47 | neighbors=[sidebar.tsx, Sidebar(), SidebarMenuButton(), SidebarRail(), SidebarTrigger()]
- "ui_toggle": "toggle.tsx" | kind=code-symbol | source=components/ui/toggle.tsx:L1 | neighbors=[utils.ts, cn(), Toggle(), toggleVariants, toggle-group.tsx]
- "utils_aiclient": "aiClient.ts" | kind=code-symbol | source=utils/aiClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, PropertiesPanel.tsx, AICueResult, analyzeStoryboardWithGemini(), refineAudioQueryWithGroq()]
- "utils_keyboardshortcuts": "keyboardShortcuts.ts" | kind=code-symbol | source=utils/keyboardShortcuts.ts:L1 | neighbors=[App.tsx, SettingsModal.tsx, DEFAULT_SHORTCUTS, getShortcutString(), KeyboardShortcutDef]
- "utils_projectpersistence_getfilefromdb": "getFileFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L63 | neighbors=[PropertiesPanel.tsx, projectPersistence.ts, getDB(), resolveMediaItemFromDB(), restoreSnapshotMedia()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-001.json

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
