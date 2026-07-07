# Node Description Batch 122 of 128

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

- "video_multicam_engine_multicamengine_creategroup": ".createGroup()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L51 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_deletegroup": ".deleteGroup()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L88 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_exportgroupassequence": ".exportGroupAsSequence()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L340 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_getactiveangle": ".getActiveAngle()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L144 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_getallgroups": ".getAllGroups()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L84 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_getangleattime": ".getAngleAtTime()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L191 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_getgroup": ".getGroup()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L80 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_getswitches": ".getSwitches()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L187 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_removeangle": ".removeAngle()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L112 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_removeswitch": ".removeSwitch()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L176 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_renameangle": ".renameAngle()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L220 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_setactiveangle": ".setActiveAngle()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L129 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_setangleoffset": ".setAngleOffset()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L209 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamengine_setsyncpoint": ".setSyncPoint()" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L319 | neighbors=[MultiCamEngine]
- "video_multicam_engine_multicamgroup": "MultiCamGroup" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L11 | neighbors=[multicam-engine.ts]
- "video_multicam_engine_syncresult": "SyncResult" | kind=code-symbol | source=packages/core/src/video/multicam-engine.ts:L28 | neighbors=[multicam-engine.ts]
- "video_parallel_frame_decoder_framedecoderequest": "FrameDecodeRequest" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L8 | neighbors=[parallel-frame-decoder.ts]
- "video_parallel_frame_decoder_framedecoderesult": "FrameDecodeResult" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L16 | neighbors=[parallel-frame-decoder.ts]
- "video_parallel_frame_decoder_paralleldecoderstats": "ParallelDecoderStats" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L40 | neighbors=[parallel-frame-decoder.ts]
- "video_parallel_frame_decoder_parallelframedecoder_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L67 | neighbors=[ParallelFrameDecoder]
- "video_parallel_frame_decoder_parallelframedecoder_getstats": ".getStats()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L364 | neighbors=[ParallelFrameDecoder]
- "video_parallel_frame_decoder_parallelframedecoder_isavailable": ".isAvailable()" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L74 | neighbors=[ParallelFrameDecoder]
- "video_parallel_frame_decoder_pendingrequest": "PendingRequest" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L23 | neighbors=[parallel-frame-decoder.ts]
- "video_parallel_frame_decoder_workerstate": "WorkerState" | kind=code-symbol | source=packages/core/src/video/parallel-frame-decoder.ts:L30 | neighbors=[parallel-frame-decoder.ts]
- "video_playback_engine_activestream": "ActiveStream" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L27 | neighbors=[playback-engine.ts]
- "video_playback_engine_bufferedframe": "BufferedFrame" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L22 | neighbors=[playback-engine.ts]
- "video_playback_engine_framecallback": "FrameCallback" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L10 | neighbors=[playback-engine.ts]
- "video_playback_engine_playbackengine_configure": ".configure()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L79 | neighbors=[PlaybackEngine]
- "video_playback_engine_playbackengine_displayframe": ".displayFrame()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L429 | neighbors=[PlaybackEngine]
- "video_playback_engine_playbackengine_getcurrenttime": ".getCurrentTime()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L88 | neighbors=[PlaybackEngine]
- "video_playback_engine_playbackengine_getstate": ".getState()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L84 | neighbors=[PlaybackEngine]
- "video_playback_engine_playbackengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L75 | neighbors=[PlaybackEngine]
- "video_playback_engine_playbackengine_setplaybackrate": ".setPlaybackRate()" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L92 | neighbors=[PlaybackEngine]
- "video_playback_engine_playbackengineconfig": "PlaybackEngineConfig" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L12 | neighbors=[playback-engine.ts]
- "video_playback_engine_playbackenginestate": "PlaybackEngineState" | kind=code-symbol | source=packages/core/src/video/playback-engine.ts:L3 | neighbors=[playback-engine.ts]
- "video_renderer_factory_rendererfactory_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L66 | neighbors=[RendererFactory]
- "video_renderer_factory_rendererfactory_createrenderer": ".createRenderer()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L83 | neighbors=[RendererFactory]
- "video_renderer_factory_rendererfactory_getcurrentrenderer": ".getCurrentRenderer()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L115 | neighbors=[RendererFactory]
- "video_renderer_factory_rendererfactory_iswebgpusupported": ".isWebGPUSupported()" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L75 | neighbors=[RendererFactory]
- "video_renderer_factory_renderertype": "RendererType" | kind=code-symbol | source=packages/core/src/video/renderer-factory.ts:L3 | neighbors=[renderer-factory.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-121.json

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
