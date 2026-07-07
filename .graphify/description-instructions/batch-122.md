# Node Description Batch 123 of 128

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

- "video_speed_engine_clipspeeddata": "ClipSpeedData" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L19 | neighbors=[speed-engine.ts]
- "video_speed_engine_freezeframe": "FreezeFrame" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L11 | neighbors=[speed-engine.ts]
- "video_speed_engine_speedengine_clear": ".clear()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L472 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L36 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_createfreezeframe": ".createFreezeFrame()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L257 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_getclipids": ".getClipIds()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L464 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_getclipspeed": ".getClipSpeed()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L47 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_getclipspeeddata": ".getClipSpeedData()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L468 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_getfreezeframes": ".getFreezeFrames()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L294 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_getspeedkeyframes": ".getSpeedKeyframes()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L208 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_ispitchcorrectionenabled": ".isPitchCorrectionEnabled()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L405 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_isreverse": ".isReverse()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L104 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_removeclip": ".removeClip()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L460 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_removefreezeframe": ".removeFreezeFrame()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L285 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_removespeedkeyframe": ".removeSpeedKeyframe()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L170 | neighbors=[SpeedEngine]
- "video_speed_engine_speedengine_setpitchcorrection": ".setPitchCorrection()" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L398 | neighbors=[SpeedEngine]
- "video_speed_engine_speedkeyframe": "SpeedKeyframe" | kind=code-symbol | source=packages/core/src/video/speed-engine.ts:L4 | neighbors=[speed-engine.ts]
- "video_speed_presets_speed_curve_presets": "SPEED_CURVE_PRESETS" | kind=code-symbol | source=packages/core/src/video/speed-presets.ts:L14 | neighbors=[speed-presets.ts]
- "video_speed_presets_speedcurvepreset": "SpeedCurvePreset" | kind=code-symbol | source=packages/core/src/video/speed-presets.ts:L3 | neighbors=[speed-presets.ts]
- "video_texture_cache_cachedtexture": "CachedTexture" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L1 | neighbors=[texture-cache.ts]
- "video_texture_cache_texturecache_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L26 | neighbors=[TextureCache]
- "video_texture_cache_texturecache_getallentries": ".getAllEntries()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L153 | neighbors=[TextureCache]
- "video_texture_cache_texturecache_getcount": ".getCount()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L134 | neighbors=[TextureCache]
- "video_texture_cache_texturecache_getentriesforclip": ".getEntriesForClip()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L143 | neighbors=[TextureCache]
- "video_texture_cache_texturecache_getmaxsize": ".getMaxSize()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L130 | neighbors=[TextureCache]
- "video_texture_cache_texturecache_getmemoryusage": ".getMemoryUsage()" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L126 | neighbors=[TextureCache]
- "video_texture_cache_texturecacheconfig": "TextureCacheConfig" | kind=code-symbol | source=packages/core/src/video/texture-cache.ts:L9 | neighbors=[texture-cache.ts]
- "video_transform_animator_animatabletransformproperty": "AnimatableTransformProperty" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L4 | neighbors=[transform-animator.ts]
- "video_transform_animator_animatedtransform": "AnimatedTransform" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L18 | neighbors=[transform-animator.ts]
- "video_transform_animator_default_transform": "DEFAULT_TRANSFORM" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L38 | neighbors=[transform-animator.ts]
- "video_transform_animator_transformanimator_applymatrixtopoint": ".applyMatrixToPoint()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L327 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_computetransformmatrix": ".computeTransformMatrix()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L287 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L52 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_createopacitykeyframes": ".createOpacityKeyframes()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L472 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_createpositionkeyframes": ".createPositionKeyframes()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L369 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_createrotationkeyframes": ".createRotationKeyframes()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L447 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_createscalekeyframes": ".createScaleKeyframes()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L408 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_getrotationcenter": ".getRotationCenter()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L334 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_gettransformattime": ".getTransformAtTime()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L56 | neighbors=[TransformAnimator]
- "video_transform_animator_transformanimator_mergewithdefaults": ".mergeWithDefaults()" | kind=code-symbol | source=packages/core/src/video/transform-animator.ts:L497 | neighbors=[TransformAnimator]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-122.json

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
