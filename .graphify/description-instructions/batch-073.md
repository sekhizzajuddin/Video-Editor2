# Node Description Batch 74 of 128

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

- "video_gpu_compositor_gpucompositor_recordcompositeduration": ".recordCompositeDuration()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L295 | neighbors=[GPUCompositor, .composite()]
- "video_gpu_compositor_gpucompositor_removelayer": ".removeLayer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L100 | neighbors=[GPUCompositor, .sortLayers()]
- "video_gpu_compositor_gpucompositor_setlayerzindex": ".setLayerZIndex()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L171 | neighbors=[GPUCompositor, .sortLayers()]
- "video_gpu_compositor_gpucompositor_updatelayer": ".updateLayer()" | kind=code-symbol | source=packages/core/src/video/gpu-compositor.ts:L89 | neighbors=[GPUCompositor, .sortLayers()]
- "video_keyframe_engine_extendedkeyframe": "ExtendedKeyframe" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L18 | neighbors=[keyframe-engine.ts, Keyframe]
- "video_keyframe_engine_keyframeengine_bounce": ".bounce()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L295 | neighbors=[KeyframeEngine, .applyEasingPreset()]
- "video_keyframe_engine_keyframeengine_elastic": ".elastic()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L310 | neighbors=[KeyframeEngine, .applyEasingPreset()]
- "video_keyframe_engine_keyframeengine_generatekeyframeid": ".generateKeyframeId()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L451 | neighbors=[KeyframeEngine, .addKeyframe()]
- "video_keyframe_engine_keyframeengine_getdefaultbezierhandles": ".getDefaultBezierHandles()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L466 | neighbors=[KeyframeEngine, .addKeyframe()]
- "video_keyframe_engine_keyframeengine_getkeyframesforproperty": ".getKeyframesForProperty()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L112 | neighbors=[KeyframeEngine, .getMotionPath()]
- "video_keyframe_engine_keyframeengine_interpolatewithbezier": ".interpolateWithBezier()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L356 | neighbors=[KeyframeEngine, .interpolateValue()]
- "video_keyframe_engine_keyframeengine_mapeasingpresettotype": ".mapEasingPresetToType()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L455 | neighbors=[KeyframeEngine, .addKeyframe()]
- "video_keyframe_engine_keyframeengine_spring": ".spring()" | kind=code-symbol | source=packages/core/src/video/keyframe-engine.ts:L317 | neighbors=[KeyframeEngine, .applyEasingPreset()]
- "video_mask_engine_applyeasing": "applyEasing()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L297 | neighbors=[mask-engine.ts, .getMaskAtTime()]
- "video_mask_engine_bezierpoint": "BezierPoint" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L6 | neighbors=[mask-engine.ts, MaskPoint]
- "video_mask_engine_createdefaultpath": "createDefaultPath()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L205 | neighbors=[mask-engine.ts, .createTrackMatteMask()]
- "video_mask_engine_interpolatepaths": "interpolatePaths()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L253 | neighbors=[mask-engine.ts, .getMaskAtTime()]
- "video_mask_engine_maskengine_addmaskkeyframe": ".addMaskKeyframe()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L545 | neighbors=[MaskEngine, generateId()]
- "video_mask_engine_maskengine_createdrawnmask": ".createDrawnMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L440 | neighbors=[MaskEngine, generateId()]
- "video_mask_engine_maskengine_drawbeziermask": ".drawBezierMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L863 | neighbors=[MaskEngine, .generateMaskShape()]
- "video_mask_engine_maskengine_drawbezierpath": ".drawBezierPath()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L733 | neighbors=[MaskEngine, .generateMaskFromPath()]
- "video_mask_engine_maskengine_drawellipsemask": ".drawEllipseMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L836 | neighbors=[MaskEngine, .generateMaskShape()]
- "video_mask_engine_maskengine_drawpolygonmask": ".drawPolygonMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L850 | neighbors=[MaskEngine, .generateMaskShape()]
- "video_mask_engine_maskengine_drawrectanglemask": ".drawRectangleMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L801 | neighbors=[MaskEngine, .generateMaskShape()]
- "video_mask_engine_maskengine_ispointinmask": ".isPointInMask()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1008 | neighbors=[MaskEngine, .generateMaskShape()]
- "video_mask_engine_maskpoint": "MaskPoint" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L1 | neighbors=[mask-engine.ts, BezierPoint]
- "video_mask_engine_pointstodrawnpath": "pointsToDrawnPath()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L315 | neighbors=[mask-engine.ts, simplifyPoints()]
- "video_mask_engine_shapetopath": "shapeToPath()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L108 | neighbors=[mask-engine.ts, .createShapeMask()]
- "video_mask_engine_simplifypoints": "simplifyPoints()" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L359 | neighbors=[mask-engine.ts, pointsToDrawnPath()]
- "video_motion_tracking_engine_getmotiontrackingengine": "getMotionTrackingEngine()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L449 | neighbors=[motion-tracking-engine.ts, MotionTrackingEngine]
- "video_motion_tracking_engine_initializemotiontrackingengine": "initializeMotionTrackingEngine()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L456 | neighbors=[motion-tracking-engine.ts, MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_deletetrackingdata": ".deleteTrackingData()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L416 | neighbors=[MotionTrackingEngine, .deleteTrackingDataForClip()]
- "video_motion_tracking_engine_motiontrackingengine_deletetrackingdataforclip": ".deleteTrackingDataForClip()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L425 | neighbors=[MotionTrackingEngine, .deleteTrackingData()]
- "video_motion_tracking_engine_motiontrackingengine_getelementpositionattime": ".getElementPositionAtTime()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L269 | neighbors=[MotionTrackingEngine, .getTrackedPositionAtFrame()]
- "video_motion_tracking_engine_motiontrackingengine_gettrackedpositionatframe": ".getTrackedPositionAtFrame()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L290 | neighbors=[MotionTrackingEngine, .getElementPositionAtTime()]
- "video_motion_tracking_engine_motiontrackingengine_notifyprogress": ".notifyProgress()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L337 | neighbors=[MotionTrackingEngine, .runTracking()]
- "video_motion_tracking_engine_motiontrackingengine_notifytrackinglost": ".notifyTrackingLost()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L343 | neighbors=[MotionTrackingEngine, .runTracking()]
- "video_motion_tracking_engine_motiontrackingengine_simulatetracking": ".simulateTracking()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L175 | neighbors=[MotionTrackingEngine, .runTracking()]
- "video_multicam_engine_multicamengine_findaudiooffset": ".findAudioOffset()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L266 | neighbors=[MultiCamEngine, .syncByAudio()]
- "video_multicam_engine_multicamengine_syncbyaudio": ".syncByAudio()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L231 | neighbors=[MultiCamEngine, .findAudioOffset()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-073.json

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
