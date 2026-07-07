# Node Description Batch 32 of 128

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

- "photo_photo_adjustments_photoadjustmentengine_applybrightness": ".applyBrightness()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L82 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applycontrast": ".applyContrast()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L104 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applyexposure": ".applyExposure()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L181 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applyhighlights": ".applyHighlights()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L198 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applysaturation": ".applySaturation()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L129 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applyshadows": ".applyShadows()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L233 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applytemperature": ".applyTemperature()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L160 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_adjustments_photoadjustmentengine_applyvibrance": ".applyVibrance()" | kind=code-symbol | source=packages/core/src/photo/photo-adjustments.ts:L262 | neighbors=[PhotoAdjustmentEngine, .applyAdjustments(), .getCanvas()]
- "photo_photo_engine_photoengine_flattenlayers": ".flattenLayers()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L380 | neighbors=[PhotoEngine, .createLayer(), .renderComposite()]
- "photo_retouching_engine_retouchingengine_clonestamp": ".cloneStamp()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L163 | neighbors=[RetouchingEngine, .getCanvas(), .cloneStampStroke()]
- "photo_retouching_engine_retouchingengine_spotheal": ".spotHeal()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L49 | neighbors=[RetouchingEngine, .getCanvas(), .spotHealStroke()]
- "photo_types_photoproject": "PhotoProject" | kind=code-symbol | source=packages/core/src/photo/types.ts:L44 | neighbors=[photo-adjustments.ts, photo-engine.ts, types.ts]
- "playback_master_timeline_clock_getmasterclock": "getMasterClock()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L236 | neighbors=[realtime-audio-graph.ts, master-timeline-clock.ts, MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_notifytimeupdate": ".notifyTimeUpdate()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L207 | neighbors=[MasterTimelineClock, .seek(), .stop()]
- "playback_master_timeline_clock_mastertimelineclock_pause": ".pause()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L123 | neighbors=[MasterTimelineClock, .notifyStateChange(), .stopUpdateLoop()]
- "playback_master_timeline_clock_mastertimelineclock_play": ".play()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L108 | neighbors=[MasterTimelineClock, .notifyStateChange(), .startUpdateLoop()]
- "playback_master_timeline_clock_mastertimelineclock_seek": ".seek()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L142 | neighbors=[MasterTimelineClock, .notifyTimeUpdate(), .seekRelative()]
- "playback_playback_controller_getplaybackcontroller": "getPlaybackController()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L784 | neighbors=[playback-controller.ts, PlaybackController, initializePlaybackController()]
- "playback_playback_controller_initializeplaybackcontroller": "initializePlaybackController()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L791 | neighbors=[playback-controller.ts, getPlaybackController(), .initialize()]
- "playback_playback_controller_playbackcontroller_clearaudiobuffer": ".clearAudioBuffer()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L705 | neighbors=[PlaybackController, .stopAudioPlayback(), .dispose()]
- "playback_playback_controller_playbackcontroller_decodeaudiobuffer": ".decodeAudioBuffer()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L652 | neighbors=[PlaybackController, .getOrDecodeAudioBuffer(), .preloadAudioBuffers()]
- "playback_playback_controller_playbackcontroller_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L380 | neighbors=[PlaybackController, .clearAudioBuffer(), .stop()]
- "playback_playback_controller_playbackcontroller_drawframetocanvas": ".drawFrameToCanvas()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L528 | neighbors=[PlaybackController, .renderFrameAtTime(), .renderFrameWithTimeout()]
- "playback_playback_controller_playbackcontroller_getordecodeaudiobuffer": ".getOrDecodeAudioBuffer()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L685 | neighbors=[PlaybackController, .getAudioClipsAtTime(), .decodeAudioBuffer()]
- "playback_playback_controller_playbackcontroller_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L350 | neighbors=[PlaybackController, .calculateAudioBufferHealth(), .calculateFPS()]
- "playback_playback_controller_playbackcontroller_handleclockstatechange": ".handleClockStateChange()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L127 | neighbors=[PlaybackController, .emitEvent(), .stopAudioPlayback()]
- "playback_playback_controller_playbackcontroller_handleclocktimeupdate": ".handleClockTimeUpdate()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L99 | neighbors=[PlaybackController, .emitEvent(), .renderFrameAtTime()]
- "playback_playback_controller_playbackcontroller_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L68 | neighbors=[initializePlaybackController(), PlaybackController, .setupClockSubscription()]
- "playback_playback_controller_playbackcontroller_preloadaudiobuffers": ".preloadAudioBuffers()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L623 | neighbors=[PlaybackController, .play(), .decodeAudioBuffer()]
- "playback_playback_controller_playbackcontroller_pruneaudiobuffers": ".pruneAudioBuffers()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L711 | neighbors=[PlaybackController, .stopAudioPlayback(), .setProject()]
- "playback_playback_controller_playbackcontroller_toggleplayback": ".togglePlayback()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L265 | neighbors=[PlaybackController, .pause(), .play()]
- "playback_playback_controller_playbackcontroller_trackframerendertime": ".trackFrameRenderTime()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L734 | neighbors=[PlaybackController, .renderFrameAtTime(), .renderFrameWithTimeout()]
- "public_puter_at": "at()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, ct(), encodeAsBinary()]
- "public_puter_bn": "Bn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .#L()]
- "public_puter_ct": "ct()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, at(), it()]
- "public_puter_d": "D()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, B(), P]
- "public_puter_dn_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Dn, .postMessage(), .warn()]
- "public_puter_dn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Dn, .fields(), .info()]
- "public_puter_encodeasstring": "encodeAsString()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, encode(), encodeAsBinary()]
- "public_puter_et_createtransport": ".createTransport()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .open(), .probe()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-031.json

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
