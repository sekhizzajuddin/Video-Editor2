# Node Description Batch 121 of 128

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

- "video_mask_engine_maskshapetype": "MaskShapeType" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L16 | neighbors=[mask-engine.ts]
- "video_mask_engine_polygonmaskshape": "PolygonMaskShape" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L35 | neighbors=[mask-engine.ts]
- "video_mask_engine_rectanglemaskshape": "RectangleMaskShape" | kind=code-symbol | source=packages/core/src/video/mask-engine.ts:L18 | neighbors=[mask-engine.ts]
- "video_motion_tracking_engine_motiontrackingengine_applytrackingtoelement": ".applyTrackingToElement()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L234 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_canceltracking": ".cancelTracking()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L207 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_clear": ".clear()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L433 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L80 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_correcttrackingpoint": ".correctTrackingPoint()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L349 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_getattachment": ".getAttachment()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L259 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_getattachmentsfortrack": ".getAttachmentsForTrack()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L263 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_gettrackids": ".getTrackIds()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L439 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_gettrackingdata": ".getTrackingData()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L220 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_gettrackingdataforclip": ".getTrackingDataForClip()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L228 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_gettrackingjob": ".getTrackingJob()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L216 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_gettrackingoffset": ".getTrackingOffset()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L396 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_hastracking": ".hasTracking()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L443 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_ontrackinglost": ".onTrackingLost()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L332 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_ontrackingprogress": ".onTrackingProgress()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L327 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_removetrackingfromelement": ".removeTrackingFromElement()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L255 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_setapplyrotation": ".setApplyRotation()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L409 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_setapplyscale": ".setApplyScale()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L401 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_motiontrackingengine_settrackingoffset": ".setTrackingOffset()" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L388 | neighbors=[MotionTrackingEngine]
- "video_motion_tracking_engine_point": "Point" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L1 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_rectangle": "Rectangle" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L6 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingattachment": "TrackingAttachment" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L57 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingdata": "TrackingData" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L47 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingjob": "TrackingJob" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L28 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingjobstatus": "TrackingJobStatus" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L21 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingkeyframe": "TrackingKeyframe" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L40 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackinglostcallback": "TrackingLostCallback" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L67 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingoptions": "TrackingOptions" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L13 | neighbors=[motion-tracking-engine.ts]
- "video_motion_tracking_engine_trackingprogresscallback": "TrackingProgressCallback" | kind=code-symbol | source=packages/core/src/video/motion-tracking-engine.ts:L65 | neighbors=[motion-tracking-engine.ts]
- "video_multicam_engine_angle_colors": "ANGLE_COLORS" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L34 | neighbors=[multicam-engine.ts]
- "video_multicam_engine_angleswitch": "AngleSwitch" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L21 | neighbors=[multicam-engine.ts]
- "video_multicam_engine_cameraangle": "CameraAngle" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L1 | neighbors=[multicam-engine.ts]
- "video_multicam_engine_multicamengine_addangle": ".addAngle()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L93 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_addswitch": ".addSwitch()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L150 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_clearall": ".clearAll()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L335 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_cleargroup": ".clearGroup()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L326 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L49 | neighbors=[MultiCamEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-120.json

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
