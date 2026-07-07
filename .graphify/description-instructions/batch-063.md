# Node Description Batch 64 of 128

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

- "text_subtitle_engine_subtitleengine_getsortedsubtitles": ".getSortedSubtitles()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L442 | neighbors=[SubtitleEngine, .mergeAdjacentSubtitles()]
- "text_subtitle_engine_subtitleengine_importsrt": ".importSRT()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L275 | neighbors=[SubtitleEngine, parseSRT()]
- "text_subtitle_engine_subtitleengine_mergeadjacentsubtitles": ".mergeAdjacentSubtitles()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L472 | neighbors=[SubtitleEngine, .getSortedSubtitles()]
- "text_subtitle_engine_subtitleengine_setglobalstyle": ".setGlobalStyle()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L388 | neighbors=[SubtitleEngine, .applyStylePreset()]
- "text_subtitle_engine_subtitleengine_splitsubtitle": ".splitSubtitle()" | kind=code-symbol | source=packages/core/src/text/subtitle-engine.ts:L508 | neighbors=[SubtitleEngine, generateSubtitleId()]
- "text_text_animation_presets_animatedunit": "AnimatedUnit" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L12 | neighbors=[character-animator.ts, text-animation-presets.ts]
- "text_text_animation_presets_bluranimation": "blurAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L211 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_presets_calculateunitanimationstate": "calculateUnitAnimationState()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L519 | neighbors=[character-animator.ts, text-animation-presets.ts]
- "text_text_animation_presets_createdefaultanimation": "createDefaultAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L757 | neighbors=[text-animation-presets.ts, getPresetInfo()]
- "text_text_animation_presets_fadeanimation": "fadeAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L97 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_presets_flipanimation": "flipAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L425 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_presets_getpresetinfo": "getPresetInfo()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L751 | neighbors=[text-animation-presets.ts, createDefaultAnimation()]
- "text_text_animation_presets_rotateanimation": "rotateAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L270 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_presets_scaleanimation": "scaleAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L180 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_presets_splitanimation": "splitAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L390 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_presets_textanimationcontext": "TextAnimationContext" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L34 | neighbors=[character-animator.ts, text-animation-presets.ts]
- "text_text_animation_presets_unitanimationstate": "UnitAnimationState" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L22 | neighbors=[character-animator.ts, text-animation-presets.ts]
- "text_text_animation_presets_wordbywordanimation": "wordByWordAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation-presets.ts:L457 | neighbors=[text-animation-presets.ts, getEasing()]
- "text_text_animation_textanimationengine_applyblur": ".applyBlur()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L342 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applybounce": ".applyBounce()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L370 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyfade": ".applyFade()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L249 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyflip": ".applyFlip()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L627 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyglitch": ".applyGlitch()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L545 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applykeyframeanimation": ".applyKeyframeAnimation()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L85 | neighbors=[TextAnimationEngine, .getAnimatedState()]
- "text_text_animation_textanimationengine_applypop": ".applyPop()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L509 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyrainbow": ".applyRainbow()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L680 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyrotate": ".applyRotate()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L410 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyscale": ".applyScale()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L314 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyshake": ".applyShake()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L475 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applyslide": ".applySlide()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L269 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applysplit": ".applySplit()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L586 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applytypewriter": ".applyTypewriter()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L229 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applywave": ".applyWave()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L437 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_applywordbyword": ".applyWordByWord()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L657 | neighbors=[TextAnimationEngine, .applyPreset()]
- "text_text_animation_textanimationengine_createanimationpreset": ".createAnimationPreset()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L719 | neighbors=[TextAnimationEngine, .getDefaultParams()]
- "text_text_animation_textanimationengine_getdefaultparams": ".getDefaultParams()" | kind=code-symbol | source=packages/core/src/text/text-animation.ts:L735 | neighbors=[TextAnimationEngine, .createAnimationPreset()]
- "text_title_engine_titleengine_applyemphasisanimation": ".applyEmphasisAnimation()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L495 | neighbors=[TitleEngine, .renderText()]
- "text_title_engine_titleengine_clear": ".clear()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L480 | neighbors=[TitleEngine, .loadTextClips()]
- "text_title_engine_titleengine_createtextclip": ".createTextClip()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L63 | neighbors=[TitleEngine, .generateId()]
- "text_title_engine_titleengine_generateid": ".generateId()" | kind=code-symbol | source=packages/core/src/text/title-engine.ts:L476 | neighbors=[TitleEngine, .createTextClip()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-063.json

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
