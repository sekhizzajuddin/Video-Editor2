# Node Description Batch 56 of 128

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

- "photo_retouching_engine_retouchingengine_spothealstroke": ".spotHealStroke()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L149 | neighbors=[RetouchingEngine, .spotHeal()]
- "photo_types_adjustmentparams": "AdjustmentParams" | kind=code-symbol | source=packages/core/src/photo/types.ts:L67 | neighbors=[photo-adjustments.ts, types.ts]
- "photo_types_adjustmenttype": "AdjustmentType" | kind=code-symbol | source=packages/core/src/photo/types.ts:L54 | neighbors=[photo-adjustments.ts, types.ts]
- "photo_types_brushpoint": "BrushPoint" | kind=code-symbol | source=packages/core/src/photo/types.ts:L90 | neighbors=[retouching-engine.ts, types.ts]
- "photo_types_brushstroke": "BrushStroke" | kind=code-symbol | source=packages/core/src/photo/types.ts:L81 | neighbors=[retouching-engine.ts, types.ts]
- "photo_types_clonesource": "CloneSource" | kind=code-symbol | source=packages/core/src/photo/types.ts:L98 | neighbors=[retouching-engine.ts, types.ts]
- "photo_types_compositeoptions": "CompositeOptions" | kind=code-symbol | source=packages/core/src/photo/types.ts:L119 | neighbors=[photo-engine.ts, types.ts]
- "photo_types_createlayeroptions": "CreateLayerOptions" | kind=code-symbol | source=packages/core/src/photo/types.ts:L104 | neighbors=[photo-engine.ts, types.ts]
- "photo_types_default_layer_transform": "DEFAULT_LAYER_TRANSFORM" | kind=code-symbol | source=packages/core/src/photo/types.ts:L126 | neighbors=[photo-engine.ts, types.ts]
- "photo_types_layertransform": "LayerTransform" | kind=code-symbol | source=packages/core/src/photo/types.ts:L35 | neighbors=[photo-engine.ts, types.ts]
- "photo_types_photoblendmode": "PhotoBlendMode" | kind=code-symbol | source=packages/core/src/photo/types.ts:L5 | neighbors=[photo-engine.ts, types.ts]
- "photo_types_photolayer": "PhotoLayer" | kind=code-symbol | source=packages/core/src/photo/types.ts:L21 | neighbors=[photo-engine.ts, types.ts]
- "photo_types_reorderresult": "ReorderResult" | kind=code-symbol | source=packages/core/src/photo/types.ts:L113 | neighbors=[photo-engine.ts, types.ts]
- "playback_master_timeline_clock_clockstate": "ClockState" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L1 | neighbors=[master-timeline-clock.ts, playback-controller.ts]
- "playback_master_timeline_clock_clocksubscriber": "ClockSubscriber" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L3 | neighbors=[master-timeline-clock.ts, playback-controller.ts]
- "playback_master_timeline_clock_disposemasterclock": "disposeMasterClock()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L253 | neighbors=[master-timeline-clock.ts, .dispose()]
- "playback_master_timeline_clock_mastertimelineclock_seekrelative": ".seekRelative()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L155 | neighbors=[MasterTimelineClock, .seek()]
- "playback_master_timeline_clock_mastertimelineclock_startupdateloop": ".startUpdateLoop()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L180 | neighbors=[MasterTimelineClock, .play()]
- "playback_playback_controller_playbackcontroller_calculateaudiobufferhealth": ".calculateAudioBufferHealth()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L753 | neighbors=[PlaybackController, .getStats()]
- "playback_playback_controller_playbackcontroller_calculatefps": ".calculateFPS()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L743 | neighbors=[PlaybackController, .getStats()]
- "playback_playback_controller_playbackcontroller_getaudioclipsattime": ".getAudioClipsAtTime()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L581 | neighbors=[PlaybackController, .getOrDecodeAudioBuffer()]
- "playback_playback_controller_playbackcontroller_setproject": ".setProject()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L153 | neighbors=[PlaybackController, .pruneAudioBuffers()]
- "playback_playback_controller_playbackcontroller_setupclocksubscription": ".setupClockSubscription()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L82 | neighbors=[PlaybackController, .initialize()]
- "playback_playback_controller_playbackcontroller_setuptracksinaudiograph": ".setupTracksInAudioGraph()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L558 | neighbors=[PlaybackController, .startAudioPlayback()]
- "playback_playback_controller_playbackcontroller_startscrubbing": ".startScrubbing()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L298 | neighbors=[PlaybackController, .pause()]
- "playback_types_default_playback_config": "DEFAULT_PLAYBACK_CONFIG" | kind=code-symbol | source=packages/core/src/playback/types.ts:L16 | neighbors=[playback-controller.ts, types.ts]
- "playback_types_framerenderresult": "FrameRenderResult" | kind=code-symbol | source=packages/core/src/playback/types.ts:L65 | neighbors=[playback-controller.ts, types.ts]
- "playback_types_playbackconfig": "PlaybackConfig" | kind=code-symbol | source=packages/core/src/playback/types.ts:L6 | neighbors=[playback-controller.ts, types.ts]
- "playback_types_playbackevent": "PlaybackEvent" | kind=code-symbol | source=packages/core/src/playback/types.ts:L38 | neighbors=[playback-controller.ts, types.ts]
- "playback_types_playbackeventlistener": "PlaybackEventListener" | kind=code-symbol | source=packages/core/src/playback/types.ts:L46 | neighbors=[playback-controller.ts, types.ts]
- "playback_types_playbackstate": "PlaybackState" | kind=code-symbol | source=packages/core/src/playback/types.ts:L4 | neighbors=[playback-controller.ts, types.ts]
- "playback_types_playbackstats": "PlaybackStats" | kind=code-symbol | source=packages/core/src/playback/types.ts:L54 | neighbors=[playback-controller.ts, types.ts]
- "public_puter_cn_bindsocketevents": ".bindSocketEvents()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .initializeSocket()]
- "public_puter_cn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .initializeSocket()]
- "public_puter_cn_getcachetimestamp": ".getCacheTimestamp()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .checkCacheAndPurge()]
- "public_puter_cn_setapiorigin": ".setAPIOrigin()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .initializeSocket()]
- "public_puter_cn_shouldusesocketautounref": ".shouldUseSocketAutoUnref()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .initializeSocket()]
- "public_puter_cn_startcacheupdatetimer": ".startCacheUpdateTimer()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .setAuthToken()]
- "public_puter_de_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De, Le()]
- "public_puter_de_hostname": "._hostname()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De, .createUri()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-055.json

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
