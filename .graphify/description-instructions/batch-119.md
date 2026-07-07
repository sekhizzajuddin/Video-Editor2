# Node Description Batch 120 of 128

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

- "video_keyframe_engine_keyframeengine_pastekeyframes": ".pasteKeyframes()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L386 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_removekeyframe": ".removeKeyframe()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L80 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_seteasing": ".setEasing()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L204 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_setmotionpathvisible": ".setMotionPathVisible()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L445 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_updatebezierhandles": ".updateBezierHandles()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L327 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeengine_updatekeyframe": ".updateKeyframe()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L87 | neighbors=[KeyframeEngine]
- "video_keyframe_engine_keyframeinterpolationresult": "KeyframeInterpolationResult" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L44 | neighbors=[keyframe-engine.ts]
- "video_keyframe_engine_motionpath": "MotionPath" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L31 | neighbors=[keyframe-engine.ts]
- "video_keyframe_engine_motionpathpoint": "MotionPathPoint" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L25 | neighbors=[keyframe-engine.ts]
- "video_mask_engine_bezierpath": "BezierPath" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L11 | neighbors=[mask-engine.ts]
- "video_mask_engine_boundspathfromtransform": "boundsPathFromTransform()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L231 | neighbors=[mask-engine.ts]
- "video_mask_engine_createdefaultmask": "createDefaultMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L165 | neighbors=[mask-engine.ts]
- "video_mask_engine_ellipsemaskshape": "EllipseMaskShape" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L27 | neighbors=[mask-engine.ts]
- "video_mask_engine_mask": "Mask" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L52 | neighbors=[mask-engine.ts]
- "video_mask_engine_maskdefinition": "MaskDefinition" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L81 | neighbors=[mask-engine.ts]
- "video_mask_engine_maskengine_addpoint": ".addPoint()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L979 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_clearallmasks": ".clearAllMasks()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1074 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L396 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_deletemask": ".deleteMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L623 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_deletemasksforclip": ".deleteMasksForClip()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L627 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_getdimensions": ".getDimensions()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1070 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_getmask": ".getMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L503 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_getmaskbounds": ".getMaskBounds()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1021 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_getmasksforclip": ".getMasksForClip()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L507 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_invertmask": ".invertMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L958 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_removemaskkeyframe": ".removeMaskKeyframe()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L567 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_removepoint": ".removePoint()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L996 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1061 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_setexpansion": ".setExpansion()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L535 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_setfeather": ".setFeather()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L965 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_setfeathering": ".setFeathering()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L518 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_setinverted": ".setInverted()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L528 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_setkeyframeeasing": ".setKeyframeEasing()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L575 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_setmattesource": ".setMatteSource()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L488 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_updatemaskpath": ".updateMaskPath()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L511 | neighbors=[MaskEngine]
- "video_mask_engine_maskengine_updatepoints": ".updatePoints()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L972 | neighbors=[MaskEngine]
- "video_mask_engine_maskengineconfig": "MaskEngineConfig" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L98 | neighbors=[mask-engine.ts]
- "video_mask_engine_maskkeyframe": "MaskKeyframe" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L45 | neighbors=[mask-engine.ts]
- "video_mask_engine_maskresult": "MaskResult" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L92 | neighbors=[mask-engine.ts]
- "video_mask_engine_maskshape": "MaskShape" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L40 | neighbors=[mask-engine.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-119.json

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
