# Node Description Batch 92 of 128

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

- "playback_master_timeline_clock_mastertimelineclock_getaudiocontext": ".getAudioContext()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L85 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_ispaused": ".isPaused()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L65 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_isplaying": ".isPlaying()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L61 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_isstopped": ".isStopped()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L69 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_lastreportedvideotime": ".lastReportedVideoTime()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L81 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_rate": ".rate()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L73 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_reportvideotime": ".reportVideoTime()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L166 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_setduration": ".setDuration()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L89 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_setloop": ".setLoop()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L93 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_setplaybackrate": ".setPlaybackRate()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L99 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_shouldrepeatframe": ".shouldRepeatFrame()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L176 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_shouldskipframe": ".shouldSkipFrame()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L172 | neighbors=[MasterTimelineClock]
- "playback_master_timeline_clock_mastertimelineclock_subscribe": ".subscribe()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L159 | neighbors=[MasterTimelineClock]
- "playback_playback_controller_playbackcontroller_addeventlistener": ".addEventListener()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L369 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L60 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_endscrubbing": ".endScrubbing()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L332 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getcurrentframe": ".getCurrentFrame()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L175 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getcurrenttime": ".getCurrentTime()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L171 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getisscrubbing": ".getIsScrubbing()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L183 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getmasterclock": ".getMasterClock()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L149 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getplaybackrate": ".getPlaybackRate()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L346 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getrealtimeaudiograph": ".getRealtimeAudioGraph()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L78 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_getstate": ".getState()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L167 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_isplaying": ".isPlaying()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L179 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_removeeventlistener": ".removeEventListener()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L376 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_setdisplaycanvas": ".setDisplayCanvas()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L160 | neighbors=[PlaybackController]
- "playback_playback_controller_playbackcontroller_setplaybackrate": ".setPlaybackRate()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L341 | neighbors=[PlaybackController]
- "playback_types_audiorenderresult": "AudioRenderResult" | kind=code-symbol | source=packages/core/src/playback/types.ts:L72 | neighbors=[types.ts]
- "playback_types_playbackeventtype": "PlaybackEventType" | kind=code-symbol | source=packages/core/src/playback/types.ts:L26 | neighbors=[types.ts]
- "playback_types_scrubrequest": "ScrubRequest" | kind=code-symbol | source=packages/core/src/playback/types.ts:L48 | neighbors=[types.ts]
- "public_puter_577": "577()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_910": "910()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_an": "An()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_bn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Bn]
- "public_puter_c_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[C]
- "public_puter_c_connectedcallback": ".connectedCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[C]
- "public_puter_c_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[C]
- "public_puter_c_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[C]
- "public_puter_cn_invalidatecache": ".invalidateCache()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn]
- "public_puter_cn_stopcacheupdatetimer": ".stopCacheUpdateTimer()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-091.json

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
