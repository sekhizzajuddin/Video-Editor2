# Node Description Batch 85 of 128

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

- "device_export_estimator_test_createmocksettings": "createMockSettings()" | kind=code-symbol | source=packages/core/src/device/export-estimator.test.ts:L34 | neighbors=[export-estimator.test.ts]
- "editing_templates_built_in_templates_bind": "bind()" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L10 | neighbors=[built-in-templates.ts]
- "editing_templates_built_in_templates_full": "full" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L8 | neighbors=[built-in-templates.ts]
- "editing_templates_built_in_templates_shapeoverlay": "shapeOverlay()" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L30 | neighbors=[built-in-templates.ts]
- "editing_templates_built_in_templates_textoverlay": "textOverlay()" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L28 | neighbors=[built-in-templates.ts]
- "editing_templates_built_in_templates_transform": "transform()" | kind=code-symbol | source=packages/core/src/editing-templates/built-in-templates.ts:L12 | neighbors=[built-in-templates.ts]
- "editing_templates_categories_editing_template_categories": "EDITING_TEMPLATE_CATEGORIES" | kind=code-symbol | source=packages/core/src/editing-templates/categories.ts:L3 | neighbors=[categories.ts]
- "editing_templates_registry_builtintemplatemap": "builtInTemplateMap" | kind=code-symbol | source=packages/core/src/editing-templates/registry.ts:L4 | neighbors=[registry.ts]
- "editing_templates_registry_getbuiltineditingtemplate": "getBuiltInEditingTemplate()" | kind=code-symbol | source=packages/core/src/editing-templates/registry.ts:L12 | neighbors=[registry.ts]
- "editing_templates_registry_getbuiltineditingtemplates": "getBuiltInEditingTemplates()" | kind=code-symbol | source=packages/core/src/editing-templates/registry.ts:L8 | neighbors=[registry.ts]
- "editing_templates_registry_getbuiltineditingtemplatesbycategory": "getBuiltInEditingTemplatesByCategory()" | kind=code-symbol | source=packages/core/src/editing-templates/registry.ts:L18 | neighbors=[registry.ts]
- "editing_templates_resolver_default_transform": "DEFAULT_TRANSFORM" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L22 | neighbors=[resolver.ts]
- "editing_templates_resolver_geteditingtemplatecontroldefinition": "getEditingTemplateControlDefinition()" | kind=code-symbol | source=packages/core/src/editing-templates/resolver.ts:L421 | neighbors=[resolver.ts]
- "editing_templates_types_editingtemplatecontroloption": "EditingTemplateControlOption" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L39 | neighbors=[types.ts]
- "editing_templates_types_editingtemplatecontroltype": "EditingTemplateControlType" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L32 | neighbors=[types.ts]
- "editing_templates_types_editingtemplateeffect": "EditingTemplateEffect" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L62 | neighbors=[types.ts]
- "editing_templates_types_editingtemplateintrotiming": "EditingTemplateIntroTiming" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L70 | neighbors=[types.ts]
- "editing_templates_types_editingtemplateoutrotiming": "EditingTemplateOutroTiming" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L75 | neighbors=[types.ts]
- "editing_templates_types_editingtemplaterecipe": "EditingTemplateRecipe" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L174 | neighbors=[types.ts]
- "editing_templates_types_editingtemplatetargettype": "EditingTemplateTargetType" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L18 | neighbors=[types.ts]
- "editing_templates_types_editingtemplatetextanimation": "EditingTemplateTextAnimation" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L106 | neighbors=[types.ts]
- "editing_templates_types_editingtemplatetiming": "EditingTemplateTiming" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L87 | neighbors=[types.ts]
- "editing_templates_types_editingtemplatevector2": "EditingTemplateVector2" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L93 | neighbors=[types.ts]
- "editing_templates_types_resolvededitingtemplateimageoverlay": "ResolvedEditingTemplateImageOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L273 | neighbors=[types.ts]
- "editing_templates_types_resolvededitingtemplateshapeoverlay": "ResolvedEditingTemplateShapeOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L255 | neighbors=[types.ts]
- "editing_templates_types_resolvededitingtemplatetextoverlay": "ResolvedEditingTemplateTextOverlay" | kind=code-symbol | source=packages/core/src/editing-templates/types.ts:L228 | neighbors=[types.ts]
- "effects_blend_modes_blendmode": "BlendMode" | kind=code-symbol | source=packages/core/src/effects/blend-modes.ts:L1 | neighbors=[blend-modes.ts]
- "effects_blend_modes_blendmodeengine_applyblendmode": ".applyBlendMode()" | kind=code-symbol | source=packages/core/src/effects/blend-modes.ts:L23 | neighbors=[BlendModeEngine]
- "effects_blend_modes_blendmodeengine_getblendshader": ".getBlendShader()" | kind=code-symbol | source=packages/core/src/effects/blend-modes.ts:L73 | neighbors=[BlendModeEngine]
- "effects_blend_modes_blendmodesettings": "BlendModeSettings" | kind=code-symbol | source=packages/core/src/effects/blend-modes.ts:L17 | neighbors=[blend-modes.ts]
- "effects_expression_engine_expressioncontext": "ExpressionContext" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L1 | neighbors=[expression-engine.ts]
- "effects_expression_engine_expressionengine_clamp": ".clamp()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L165 | neighbors=[ExpressionEngine]
- "effects_expression_engine_expressionengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L190 | neighbors=[ExpressionEngine]
- "effects_expression_engine_expressionengine_ease": ".ease()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L122 | neighbors=[ExpressionEngine]
- "effects_expression_engine_expressionengine_easein": ".easeIn()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L137 | neighbors=[ExpressionEngine]
- "effects_expression_engine_expressionengine_easeout": ".easeOut()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L151 | neighbors=[ExpressionEngine]
- "effects_expression_engine_expressionengine_linear": ".linear()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L108 | neighbors=[ExpressionEngine]
- "effects_expression_engine_expressionengine_smooth": ".smooth()" | kind=code-symbol | source=packages/core/src/effects/expression-engine.ts:L95 | neighbors=[ExpressionEngine]
- "effects_particle_engine_particleengine_getactiveeffectids": ".getActiveEffectIds()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L349 | neighbors=[ParticleEngine]
- "effects_particle_engine_particleengine_getalleffects": ".getAllEffects()" | kind=code-symbol | source=packages/core/src/effects/particle-engine.ts:L220 | neighbors=[ParticleEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-084.json

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
