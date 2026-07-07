# Node Description Batch 37 of 128

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

- "types_sound_library_musicgenre": "MusicGenre" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L3 | neighbors=[sound-generator.ts, sound-library-engine.ts, sound-library.ts]
- "types_sound_library_sounditem": "SoundItem" | kind=code-symbol | source=packages/core/src/types/sound-library.ts:L44 | neighbors=[sound-generator.ts, sound-library-engine.ts, sound-library.ts]
- "types_template_templatecategory": "TemplateCategory" | kind=code-symbol | source=packages/core/src/types/template.ts:L21 | neighbors=[template-engine.ts, scriptable-template.ts, template.ts]
- "types_template_templateclip": "TemplateClip" | kind=code-symbol | source=packages/core/src/types/template.ts:L45 | neighbors=[template-engine.ts, template.ts, Clip]
- "types_template_templateplaceholder": "TemplatePlaceholder" | kind=code-symbol | source=packages/core/src/types/template.ts:L57 | neighbors=[template-engine.ts, scriptable-template.ts, template.ts]
- "types_template_templatesubtitle": "TemplateSubtitle" | kind=code-symbol | source=packages/core/src/types/template.ts:L50 | neighbors=[template-engine.ts, template.ts, Subtitle]
- "types_transitions_blurtransition": "BlurTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L76 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_crossfadetransition": "CrossfadeTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L81 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_dissolvetransition": "DissolveTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L35 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_fadetransition": "FadeTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L39 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_iristransition": "IrisTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L69 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_pushtransition": "PushTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L57 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_slidetransition": "SlideTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L51 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_wipetransition": "WipeTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L44 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "types_transitions_zoomtransition": "ZoomTransition" | kind=code-symbol | source=packages/core/src/types/transitions.ts:L62 | neighbors=[index.ts, transitions.ts, BaseTransition]
- "ui_chart_usechart": "useChart()" | kind=code-symbol | source=src/components/ui/chart.tsx:L27 | neighbors=[chart.tsx, ChartLegendContent(), ChartTooltipContent()]
- "ui_checkbox": "checkbox.tsx" | kind=code-symbol | source=src/components/ui/checkbox.tsx:L1 | neighbors=[utils.ts, cn(), Checkbox()]
- "ui_collapsible": "collapsible.tsx" | kind=code-symbol | source=src/components/ui/collapsible.tsx:L1 | neighbors=[Collapsible(), CollapsibleContent(), CollapsibleTrigger()]
- "ui_input_input": "Input()" | kind=code-symbol | source=src/components/ui/input.tsx:L5 | neighbors=[input.tsx, input-group.tsx, sidebar.tsx]
- "ui_label_label": "Label()" | kind=code-symbol | source=src/components/ui/label.tsx:L8 | neighbors=[field.tsx, form.tsx, label.tsx]
- "ui_progress": "progress.tsx" | kind=code-symbol | source=src/components/ui/progress.tsx:L1 | neighbors=[utils.ts, cn(), Progress()]
- "ui_sidebar_sidebarmenubutton": "SidebarMenuButton()" | kind=code-symbol | source=src/components/ui/sidebar.tsx:L498 | neighbors=[sidebar.tsx, sidebarMenuButtonVariants, useSidebar()]
- "ui_slider": "slider.tsx" | kind=code-symbol | source=src/components/ui/slider.tsx:L1 | neighbors=[utils.ts, cn(), Slider()]
- "ui_spinner": "spinner.tsx" | kind=code-symbol | source=src/components/ui/spinner.tsx:L1 | neighbors=[utils.ts, cn(), Spinner()]
- "ui_switch": "switch.tsx" | kind=code-symbol | source=src/components/ui/switch.tsx:L1 | neighbors=[utils.ts, cn(), Switch()]
- "ui_toggle_togglevariants": "toggleVariants" | kind=code-symbol | source=src/components/ui/toggle.tsx:L7 | neighbors=[toggle.tsx, toggle-group.tsx, Toggle()]
- "upscaling_upscaling_engine_upscalingengine_applysharpen": ".applySharpen()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L530 | neighbors=[UpscalingEngine, .getPooledTexture(), .upscaleQuality()]
- "upscaling_upscaling_engine_upscalingengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L36 | neighbors=[UpscalingEngine, .createBindGroupLayouts(), .createPipelines()]
- "upscaling_upscaling_engine_upscalingengine_upscalefast": ".upscaleFast()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L280 | neighbors=[UpscalingEngine, .upscale(), .applyLanczos()]
- "utils_aibackground_segmentframe": "segmentFrame()" | kind=code-symbol | source=src/utils/aiBackground.ts:L84 | neighbors=[aiBackground.ts, applyAiBackgroundMask(), loadMediaPipe()]
- "utils_aiclient_aimotiongraphicsuggestion": "AIMotionGraphicSuggestion" | kind=code-symbol | source=src/utils/aiClient.ts:L174 | neighbors=[AiMotionGraphicsDesigner.tsx, PropertiesPanel.tsx, aiClient.ts]
- "utils_aiclient_analyzemotiongraphicswithgemini": "analyzeMotionGraphicsWithGemini()" | kind=code-symbol | source=src/utils/aiClient.ts:L185 | neighbors=[PropertiesPanel.tsx, aiClient.ts, aiClient.test.ts]
- "utils_aiclient_analyzestoryboardwithgemini": "analyzeStoryboardWithGemini()" | kind=code-symbol | source=src/utils/aiClient.ts:L12 | neighbors=[PropertiesPanel.tsx, aiClient.ts, aiClient.test.ts]
- "utils_aiclient_refineaudioquerywithgroq": "refineAudioQueryWithGroq()" | kind=code-symbol | source=src/utils/aiClient.ts:L120 | neighbors=[PropertiesPanel.tsx, aiClient.ts, aiClient.test.ts]
- "utils_audioseparation_createseparationnode": "createSeparationNode()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L73 | neighbors=[audioSeparation.ts, createFallbackSeparationNode(), updateSeparationParam()]
- "utils_canvaseffects_clearpreviewcaches": "clearPreviewCaches()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L10 | neighbors=[PreviewCanvas.tsx, SettingsModal.tsx, canvasEffects.ts]
- "utils_canvaseffects_renderparticles": "renderParticles()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L440 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts, spawnParticle()]
- "utils_immutable_updates_duplicateclip": "duplicateClip()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L355 | neighbors=[immutable-updates.ts, addClipToTrack(), findClipById()]
- "utils_immutable_updates_findclipbyid": "findClipById()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L296 | neighbors=[immutable-updates.ts, duplicateClip(), moveClipToTrack()]
- "utils_index_generateid": "generateId()" | kind=code-symbol | source=packages/core/src/utils/index.ts:L6 | neighbors=[photo-adjustments.ts, photo-engine.ts, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-036.json

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
