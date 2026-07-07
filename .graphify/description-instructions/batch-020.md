# Node Description Batch 21 of 128

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

- "media_mediabunny_engine_mediabunnyengine_extractmetadata": ".extractMetadata()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L331 | neighbors=[MediaBunnyEngine, .dispose(), .createInput(), .extractImageMetadata()]
- "media_mediabunny_engine_mediabunnyengine_generatefilmstripthumbnails": ".generateFilmstripThumbnails()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L490 | neighbors=[MediaBunnyEngine, .dispose(), .createInput(), .ensureInitialized()]
- "media_mediabunny_engine_mediabunnyengine_generatethumbnails": ".generateThumbnails()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L414 | neighbors=[MediaBunnyEngine, .dispose(), .createInput(), .ensureInitialized()]
- "media_mediabunny_engine_mediabunnyengine_generatewaveform": ".generateWaveform()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L657 | neighbors=[MediaBunnyEngine, .dispose(), .createInput(), .ensureInitialized()]
- "media_mediabunny_engine_mediabunnyengine_validateformat": ".validateFormat()" | kind=code-symbol | source=packages/core/src/media/mediabunny-engine.ts:L242 | neighbors=[MediaBunnyEngine, .dispose(), isSupportedFormat(), .createInput()]
- "media_types_thumbnailresult": "ThumbnailResult" | kind=code-symbol | source=packages/core/src/media/types.ts:L31 | neighbors=[index.ts, media-import-service.ts, mediabunny-engine.ts, types.ts]
- "media_waveform_generator_getwaveformgenerator": "getWaveformGenerator()" | kind=code-symbol | source=packages/core/src/media/waveform-generator.ts:L338 | neighbors=[index.ts, waveform-generator.ts, WaveformGenerator, waveform-renderer.ts]
- "photo_photo_engine_photoengine_createlayer": ".createLayer()" | kind=code-symbol | source=packages/core/src/photo/photo-engine.ts:L69 | neighbors=[PhotoEngine, .addLayer(), .flattenLayers(), .importPhoto()]
- "photo_retouching_engine_retouchingengine_getcanvas": ".getCanvas()" | kind=code-symbol | source=packages/core/src/photo/retouching-engine.ts:L360 | neighbors=[RetouchingEngine, .cloneStamp(), .removeRedEye(), .spotHeal()]
- "playback_index": "index.ts" | kind=code-symbol | source=packages/core/src/playback/index.ts:L1 | neighbors=[master-timeline-clock.ts, playback-controller.ts, types.ts, index.ts]
- "playback_master_timeline_clock_initializemasterclock": "initializeMasterClock()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L243 | neighbors=[master-timeline-clock.ts, MasterTimelineClock, .dispose(), playback-controller.ts]
- "playback_master_timeline_clock_mastertimelineclock_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L227 | neighbors=[disposeMasterClock(), initializeMasterClock(), MasterTimelineClock, .stopUpdateLoop()]
- "playback_master_timeline_clock_mastertimelineclock_notifystatechange": ".notifyStateChange()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L217 | neighbors=[MasterTimelineClock, .pause(), .play(), .stop()]
- "playback_master_timeline_clock_mastertimelineclock_stop": ".stop()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L133 | neighbors=[MasterTimelineClock, .notifyStateChange(), .notifyTimeUpdate(), .stopUpdateLoop()]
- "playback_master_timeline_clock_mastertimelineclock_stopupdateloop": ".stopUpdateLoop()" | kind=code-symbol | source=packages/core/src/playback/master-timeline-clock.ts:L200 | neighbors=[MasterTimelineClock, .dispose(), .pause(), .stop()]
- "playback_playback_controller_playbackcontroller_renderframewithtimeout": ".renderFrameWithTimeout()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L436 | neighbors=[PlaybackController, .drawFrameToCanvas(), .trackFrameRenderTime(), .scrubTo()]
- "playback_playback_controller_playbackcontroller_scrubto": ".scrubTo()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L307 | neighbors=[PlaybackController, .emitEvent(), .renderFrameWithTimeout(), .seek()]
- "playback_playback_controller_playbackcontroller_startaudioplayback": ".startAudioPlayback()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L544 | neighbors=[PlaybackController, .play(), .seek(), .setupTracksInAudioGraph()]
- "playback_playback_controller_playbackcontroller_stop": ".stop()" | kind=code-symbol | source=packages/core/src/playback/playback-controller.ts:L243 | neighbors=[PlaybackController, .dispose(), .emitEvent(), .stopAudioPlayback()]
- "public_puter_cn_checkcacheandpurge": ".checkCacheAndPurge()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .getCacheTimestamp(), .error(), .setAuthToken()]
- "public_puter_cn_setauthtoken": ".setAuthToken()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[cn, .checkCacheAndPurge(), .initializeSocket(), .startCacheUpdateTimer()]
- "public_puter_de_createuri": ".createUri()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De, ._hostname(), ._port(), ._query()]
- "public_puter_dn_postmessage": ".postMessage()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Dn, .close(), .warn(), .send()]
- "public_puter_e": "E" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .readAsDataURL(), N()]
- "public_puter_encodeasbinary": "encodeAsBinary()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, encode(), at(), encodeAsString()]
- "public_puter_et_onhandshake": ".onHandshake()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .filterUpgrades(), .resetPingTimeout(), .onPacket()]
- "public_puter_et_onpacket": ".onPacket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .onHandshake(), .resetPingTimeout(), .sendPacket()]
- "public_puter_gt_decodestring": ".decodeString()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gt, .add(), .isPayloadValid(), .tryParse()]
- "public_puter_it": "it()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, ct(), .add(), ot()]
- "public_puter_kt": "kt()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .initializeSocket(), xt, .socket()]
- "public_puter_l": "L()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, B(), C, .warn()]
- "public_puter_ls_disconnectedcallback": ".disconnectedCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._cancelSubmenuClose(), ._hideActiveSubmenu(), ._hideBackdrop()]
- "public_puter_ls_focusableindices": "._focusableIndices()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._handleKey(), ._moveFocus(), ._typeahead()]
- "public_puter_ls_movefocus": "._moveFocus()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._handleKey(), ._focusableIndices(), ._setFocusIndex()]
- "public_puter_ls_setsafetraverse": "._setSafeTraverse()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._cancelSubmenuClose(), ._hideActiveSubmenu(), ._submenuCloseCheck()]
- "public_puter_ls_typeahead": "._typeahead()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._handleKey(), ._focusableIndices(), ._setFocusIndex()]
- "public_puter_mn_off": ".off()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[bt(), mn, .error(), N()]
- "public_puter_ms": "ms" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .acquire(), .constructor(), .release()]
- "public_puter_mt_takebinarydata": ".takeBinaryData()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.add(), mt, lt(), .finishedReconstruction()]
- "public_puter_ne_call": ".call()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ne, .error(), i(), .get()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-020.json

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
