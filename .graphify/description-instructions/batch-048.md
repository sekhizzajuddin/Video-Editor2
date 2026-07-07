# Node Description Batch 49 of 128

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

- "device_device_capabilities_devicetier": "DeviceTier" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L1 | neighbors=[device-capabilities.ts, index.ts]
- "device_device_capabilities_encodingsupport": "EncodingSupport" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L26 | neighbors=[device-capabilities.ts, index.ts]
- "device_device_capabilities_getcputier": "getCpuTier()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L65 | neighbors=[device-capabilities.ts, detectDeviceCapabilities()]
- "device_device_capabilities_getgputier": "getGpuTier()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L77 | neighbors=[device-capabilities.ts, detectGpu()]
- "device_device_capabilities_getmemorytier": "getMemoryTier()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L71 | neighbors=[device-capabilities.ts, detectDeviceCapabilities()]
- "device_device_capabilities_gpuinfo": "GpuInfo" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L13 | neighbors=[device-capabilities.ts, index.ts]
- "device_device_capabilities_loadcachedbenchmark": "loadCachedBenchmark()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L382 | neighbors=[device-capabilities.ts, detectDeviceCapabilities()]
- "device_device_capabilities_memoryinfo": "MemoryInfo" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L8 | neighbors=[device-capabilities.ts, index.ts]
- "device_export_estimator_benchmarkprogress": "BenchmarkProgress" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L26 | neighbors=[export-estimator.ts, index.ts]
- "device_export_estimator_formattime": "formatTime()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L104 | neighbors=[export-estimator.ts, estimateExportTime()]
- "device_export_estimator_getcomplexitymultiplier": "getComplexityMultiplier()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L86 | neighbors=[export-estimator.ts, estimateExportTime()]
- "device_export_estimator_getresolutionmultiplier": "getResolutionMultiplier()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L75 | neighbors=[export-estimator.ts, estimateExportTime()]
- "device_export_estimator_runbenchmark": "runBenchmark()" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L231 | neighbors=[export-estimator.ts, index.ts]
- "device_export_estimator_timeestimate": "TimeEstimate" | kind=code-symbol | source=packages/core/src/device/export-estimator.ts:L15 | neighbors=[export-estimator.ts, index.ts]
- "editing_templates_built_in_templates_built_in_editing_templates": "BUILT_IN_EDITING_TEMPLATES" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L32 | neighbors=[built-in-templates.ts, registry.ts]
- "editing_templates_resolver_clamp": "clamp()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L417 | neighbors=[resolver.ts, resolveRangeTiming()]
- "editing_templates_resolver_geteditingtemplatedefaultcontrolvalues": "getEditingTemplateDefaultControlValues()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L38 | neighbors=[resolver.ts, resolveEditingTemplateControlValues()]
- "editing_templates_resolver_iseditingtemplatebinding": "isEditingTemplateBinding()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L32 | neighbors=[resolver.ts, resolveValue()]
- "editing_templates_resolver_resolveeditingtemplate": "resolveEditingTemplate()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L60 | neighbors=[resolver.ts, resolveEditingTemplateControlValues()]
- "editing_templates_resolver_resolveeffectkeyframes": "resolveEffectKeyframes()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L269 | neighbors=[resolver.ts, resolveEffect()]
- "editing_templates_resolver_resolveoverlaykeyframes": "resolveOverlayKeyframes()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L284 | neighbors=[resolver.ts, resolveOverlay()]
- "editing_templates_types_editingtemplatecategory": "EditingTemplateCategory" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L7 | neighbors=[registry.ts, types.ts]
- "editing_templates_types_editingtemplatecategorydefinition": "EditingTemplateCategoryDefinition" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L193 | neighbors=[categories.ts, types.ts]
- "editing_templates_types_editingtemplatecontroldefinition": "EditingTemplateControlDefinition" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L44 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_editingtemplateemphasisanimation": "EditingTemplateEmphasisAnimation" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L115 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_editingtemplateimageoverlay": "EditingTemplateImageOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L159 | neighbors=[types.ts, EditingTemplateOverlayBase]
- "editing_templates_types_editingtemplatekeyframe": "EditingTemplateKeyframe" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L55 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_editingtemplateoverlay": "EditingTemplateOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L169 | neighbors=[built-in-templates.ts, types.ts]
- "editing_templates_types_editingtemplateprimitive": "EditingTemplatePrimitive" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L20 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_editingtemplaterangetiming": "EditingTemplateRangeTiming" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L80 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_editingtemplateresolutioncontext": "EditingTemplateResolutionContext" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L200 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_editingtemplateshapeoverlay": "EditingTemplateShapeOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L148 | neighbors=[types.ts, EditingTemplateOverlayBase]
- "editing_templates_types_editingtemplatetextoverlay": "EditingTemplateTextOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L138 | neighbors=[types.ts, EditingTemplateOverlayBase]
- "editing_templates_types_editingtemplatevalue": "EditingTemplateValue" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L26 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_resolvededitingtemplateapplication": "ResolvedEditingTemplateApplication" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L295 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_resolvededitingtemplateeffect": "ResolvedEditingTemplateEffect" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L215 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_resolvededitingtemplatekeyframe": "ResolvedEditingTemplateKeyframe" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L208 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_resolvededitingtemplateoverlay": "ResolvedEditingTemplateOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L290 | neighbors=[resolver.ts, types.ts]
- "editing_templates_types_resolvededitingtemplatetiming": "ResolvedEditingTemplateTiming" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L223 | neighbors=[resolver.ts, types.ts]
- "effects_expression_engine_expressionengine_createsafecontext": ".createSafeContext()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L70 | neighbors=[ExpressionEngine, .compile()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-048.json

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
