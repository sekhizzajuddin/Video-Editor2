# Node Description Batch 1 of 16

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

- "lib_utils": "utils.ts" | kind=code-symbol | source=lib/utils.ts:L1 | neighbors=[cn(), accordion.tsx, alert.tsx, alert-dialog.tsx, avatar.tsx, badge.tsx]
- "lib_utils_cn": "cn()" | kind=code-symbol | source=lib/utils.ts:L4 | neighbors=[utils.ts, accordion.tsx, alert.tsx, alert-dialog.tsx, avatar.tsx, badge.tsx]
- "types_index": "index.ts" | kind=code-symbol | source=types/index.ts:L1 | neighbors=[App.tsx, AudioMixer.tsx, MediaPanel.tsx, PreviewCanvas.tsx, PropertiesPanel.tsx, Timeline.tsx]
- "ui_sidebar": "sidebar.tsx" | kind=code-symbol | source=components/ui/sidebar.tsx:L1 | neighbors=[use-mobile.ts, useIsMobile(), utils.ts, cn(), button.tsx, Button()]
- "store_editorstore": "editorStore.ts" | kind=code-symbol | source=store/editorStore.ts:L1 | neighbors=[App.tsx, AiSoundDesigner.tsx, AudioMixer.tsx, ExportModal.tsx, MediaPanel.tsx, PreviewCanvas.tsx]
- "components_previewcanvas": "PreviewCanvas.tsx" | kind=code-symbol | source=components/PreviewCanvas.tsx:L1 | neighbors=[App.tsx, applyChromaKeyOnData(), applyColorGradingWheelsOnData(), applyColorOverlays(), clearPreviewCaches(), drawMediaPlaceholder()]
- "components_timeline": "Timeline.tsx" | kind=code-symbol | source=components/Timeline.tsx:L1 | neighbors=[App.tsx, audioBufferToWav(), checkOverlapAt(), CLIP_COLORS, FloatingScrubTooltip(), formatCentisecondTime()]
- "components_propertiespanel": "PropertiesPanel.tsx" | kind=code-symbol | source=components/PropertiesPanel.tsx:L1 | neighbors=[App.tsx, AiSoundDesigner.tsx, AiSoundDesigner(), ColorWheel(), ColorWheelProps, KeyframeIcon()]
- "components_mediapanel": "MediaPanel.tsx" | kind=code-symbol | source=components/MediaPanel.tsx:L1 | neighbors=[App.tsx, COLOR_CORRECTION_EFFECTS, FX_EFFECTS, MediaPanel(), PARTICLE_EFFECTS, TEXT_TEMPLATES]
- "app": "App.tsx" | kind=code-symbol | source=App.tsx:L1 | neighbors=[App(), AudioMixer.tsx, AudioMixer(), ExportModal.tsx, ExportModal(), MediaPanel.tsx]
- "utils_projectpersistence": "projectPersistence.ts" | kind=code-symbol | source=utils/projectPersistence.ts:L1 | neighbors=[App.tsx, MediaPanel.tsx, PropertiesPanel.tsx, SettingsModal.tsx, editorStore.ts, index.ts]
- "hooks_usemediaplayback": "useMediaPlayback.ts" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L1 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, connectAudioNode(), createSeparationGraph(), cubicInterp(), disconnectAudioNode()]
- "ui_menubar": "menubar.tsx" | kind=code-symbol | source=components/ui/menubar.tsx:L1 | neighbors=[utils.ts, cn(), Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarGroup()]
- "ui_carousel": "carousel.tsx" | kind=code-symbol | source=components/ui/carousel.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), Carousel(), CarouselApi]
- "ui_command": "command.tsx" | kind=code-symbol | source=components/ui/command.tsx:L1 | neighbors=[utils.ts, cn(), Command(), CommandDialog(), CommandEmpty(), CommandGroup()]
- "ui_context_menu": "context-menu.tsx" | kind=code-symbol | source=components/ui/context-menu.tsx:L1 | neighbors=[utils.ts, cn(), ContextMenu(), ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuGroup()]
- "ui_dropdown_menu": "dropdown-menu.tsx" | kind=code-symbol | source=components/ui/dropdown-menu.tsx:L1 | neighbors=[utils.ts, cn(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup()]
- "ui_field": "field.tsx" | kind=code-symbol | source=components/ui/field.tsx:L1 | neighbors=[utils.ts, cn(), Field(), FieldContent(), FieldDescription(), FieldError()]
- "ui_input_group": "input-group.tsx" | kind=code-symbol | source=components/ui/input-group.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), input.tsx, InputGroup()]
- "ui_item": "item.tsx" | kind=code-symbol | source=components/ui/item.tsx:L1 | neighbors=[utils.ts, cn(), Item(), ItemActions(), ItemContent(), ItemDescription()]
- "components_settingsmodal": "SettingsModal.tsx" | kind=code-symbol | source=components/SettingsModal.tsx:L1 | neighbors=[App.tsx, PreviewCanvas.tsx, clearPreviewCaches(), SettingsModal(), editorStore.ts, useEditorStore]
- "ui_alert_dialog": "alert-dialog.tsx" | kind=code-symbol | source=components/ui/alert-dialog.tsx:L1 | neighbors=[utils.ts, cn(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent()]
- "ui_form": "form.tsx" | kind=code-symbol | source=components/ui/form.tsx:L1 | neighbors=[utils.ts, cn(), FormControl(), FormDescription(), FormField(), FormFieldContext]
- "utils_mediaprobe": "mediaProbe.ts" | kind=code-symbol | source=utils/mediaProbe.ts:L1 | neighbors=[MediaPanel.tsx, SettingsModal.tsx, TopToolbar.tsx, index.ts, MediaItem, MediaType]
- "ui_dialog": "dialog.tsx" | kind=code-symbol | source=components/ui/dialog.tsx:L1 | neighbors=[command.tsx, utils.ts, cn(), Dialog(), DialogClose(), DialogContent()]
- "ui_pagination": "pagination.tsx" | kind=code-symbol | source=components/ui/pagination.tsx:L1 | neighbors=[utils.ts, cn(), button.tsx, Button(), buttonVariants, Pagination()]
- "ui_sheet": "sheet.tsx" | kind=code-symbol | source=components/ui/sheet.tsx:L1 | neighbors=[utils.ts, cn(), Sheet(), SheetClose(), SheetContent(), SheetDescription()]
- "utils_audioseparation": "audioSeparation.ts" | kind=code-symbol | source=utils/audioSeparation.ts:L1 | neighbors=[index.ts, ClipAudioSettings, createFallbackSeparationNode(), createSeparationNode(), defaultSettings, getFFmpegBandSeparationArgs()]
- "utils_speedramp": "speedRamp.ts" | kind=code-symbol | source=utils/speedRamp.ts:L1 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts, editorStore.ts, index.ts, SpeedRampKeyframe]
- "store_editorstore_useeditorstore": "useEditorStore" | kind=code-symbol | source=store/editorStore.ts:L352 | neighbors=[App.tsx, AiSoundDesigner.tsx, AudioMixer.tsx, ExportModal.tsx, MediaPanel.tsx, PreviewCanvas.tsx]
- "ui_chart": "chart.tsx" | kind=code-symbol | source=components/ui/chart.tsx:L1 | neighbors=[utils.ts, cn(), ChartConfig, ChartContainer(), ChartContext, ChartContextProps]
- "ui_drawer": "drawer.tsx" | kind=code-symbol | source=components/ui/drawer.tsx:L1 | neighbors=[utils.ts, cn(), Drawer(), DrawerClose(), DrawerContent(), DrawerDescription()]
- "ui_select": "select.tsx" | kind=code-symbol | source=components/ui/select.tsx:L1 | neighbors=[utils.ts, cn(), Select(), SelectContent(), SelectGroup(), SelectItem()]
- "utils_projectpersistence_getdb": "getDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L16 | neighbors=[projectPersistence.ts, clearProjectDB(), deleteAutosaveFromDB(), deleteFileFromDB(), getAutosavesFromDB(), getFileFromDB()]
- "ui_navigation_menu": "navigation-menu.tsx" | kind=code-symbol | source=components/ui/navigation-menu.tsx:L1 | neighbors=[utils.ts, cn(), NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem()]
- "components_aisounddesigner": "AiSoundDesigner.tsx" | kind=code-symbol | source=components/AiSoundDesigner.tsx:L1 | neighbors=[AiSoundDesigner(), AiSoundDesignerProps, CueWithOptions, editorStore.ts, useEditorStore, aiClient.ts]
- "components_audiomixer": "AudioMixer.tsx" | kind=code-symbol | source=components/AudioMixer.tsx:L1 | neighbors=[App.tsx, AudioMixer(), ChannelStrip(), ChannelStripProps, MasterChannelStrip(), MasterChannelStripProps]
- "components_exportmodal": "ExportModal.tsx" | kind=code-symbol | source=components/ExportModal.tsx:L1 | neighbors=[App.tsx, ensureFFmpegLoaded(), ExportModal(), ExportStatus, ffmpeg, ffmpegLogs]
- "ui_button": "button.tsx" | kind=code-symbol | source=components/ui/button.tsx:L1 | neighbors=[alert-dialog.tsx, utils.ts, cn(), Button(), buttonVariants, calendar.tsx]
- "ui_table": "table.tsx" | kind=code-symbol | source=components/ui/table.tsx:L1 | neighbors=[utils.ts, cn(), Table(), TableBody(), TableCaption(), TableCell()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-000.json

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
