# Node Description Batch 81 of 128

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

- "audio_audio_engine_audioengine_detectsilence": ".detectSilence()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L877 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_getchannelstates": ".getChannelStates()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L760 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_getclipsinrange": ".getClipsInRange()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L316 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_geteffectivetrackaudibility": ".getEffectiveTrackAudibility()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L273 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L139 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L168 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_measureloudness": ".measureLoudness()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L914 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_resume": ".resume()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L950 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_suspend": ".suspend()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L956 | neighbors=[AudioEngine]
- "audio_audio_engine_audiotracknodes": "AudioTrackNodes" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L978 | neighbors=[audio-engine.ts]
- "audio_audio_engine_mediabunnyaudioinput": "MediaBunnyAudioInput" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L27 | neighbors=[audio-engine.ts]
- "audio_audio_engine_segmentedaudiodecoder_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L38 | neighbors=[SegmentedAudioDecoder]
- "audio_audio_engine_segmentedaudiodecoder_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L94 | neighbors=[SegmentedAudioDecoder]
- "audio_audio_engine_segmentedaudiodecoder_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L43 | neighbors=[SegmentedAudioDecoder]
- "audio_beat_detection_engine_beatdetectionconfig": "BeatDetectionConfig" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L21 | neighbors=[beat-detection-engine.ts]
- "audio_beat_detection_engine_beatdetectionengine_generatebeatmarkersatinterval": ".generateBeatMarkersAtInterval()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L327 | neighbors=[BeatDetectionEngine]
- "audio_beat_detection_engine_beatdetectionengine_getbeatsinrange": ".getBeatsInRange()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L371 | neighbors=[BeatDetectionEngine]
- "audio_beat_detection_engine_beatdetectionengine_snaptimetonearestbeat": ".snapTimeToNearestBeat()" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L350 | neighbors=[BeatDetectionEngine]
- "audio_beat_detection_engine_default_beat_detection_config": "DEFAULT_BEAT_DETECTION_CONFIG" | kind=code-symbol | source=packages/core/src/audio/beat-detection-engine.ts:L29 | neighbors=[beat-detection-engine.ts]
- "audio_clip_audio_resolution_findcliptrack": "findClipTrack()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L32 | neighbors=[clip-audio-resolution.ts]
- "audio_clip_audio_resolution_gettracktypepriority": "getTrackTypePriority()" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L16 | neighbors=[clip-audio-resolution.ts]
- "audio_clip_audio_resolution_timelinewithtracks": "TimelineWithTracks" | kind=code-symbol | source=packages/core/src/audio/clip-audio-resolution.ts:L3 | neighbors=[clip-audio-resolution.ts]
- "audio_effects_worklet_processor_createeffectsworkletnode": "createEffectsWorkletNode()" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L190 | neighbors=[effects-worklet-processor.ts]
- "audio_effects_worklet_processor_default_effect_worklet_params": "DEFAULT_EFFECT_WORKLET_PARAMS" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L17 | neighbors=[effects-worklet-processor.ts]
- "audio_effects_worklet_processor_effectworkletparams": "EffectWorkletParams" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L3 | neighbors=[effects-worklet-processor.ts]
- "audio_effects_worklet_processor_updateeffectsworkletparams": "updateEffectsWorkletParams()" | kind=code-symbol | source=packages/core/src/audio/effects-worklet-processor.ts:L203 | neighbors=[effects-worklet-processor.ts]
- "audio_fft_fft_applyhannwindow": ".applyHannWindow()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L175 | neighbors=[FFT]
- "audio_fft_fft_applysynthesiswindow": ".applySynthesisWindow()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L187 | neighbors=[FFT]
- "audio_fft_fft_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L7 | neighbors=[FFT]
- "audio_fft_fft_forward": ".forward()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L37 | neighbors=[FFT]
- "audio_fft_fft_frommagnitudeandphase": ".fromMagnitudeAndPhase()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L153 | neighbors=[FFT]
- "audio_fft_fft_getmagnitude": ".getMagnitude()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L115 | neighbors=[FFT]
- "audio_fft_fft_getmagnitudeandphase": ".getMagnitudeAndPhase()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L137 | neighbors=[FFT]
- "audio_fft_fft_getpower": ".getPower()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L126 | neighbors=[FFT]
- "audio_fft_fft_getsize": ".getSize()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L33 | neighbors=[FFT]
- "audio_fft_fft_inverse": ".inverse()" | kind=code-symbol | source=packages/core/src/audio/fft.ts:L73 | neighbors=[FFT]
- "audio_highlight_analyzer_analyzeaudioforhighlights": "analyzeAudioForHighlights()" | kind=code-symbol | source=packages/core/src/audio/highlight-analyzer.ts:L21 | neighbors=[highlight-analyzer.ts]
- "audio_highlight_analyzer_audiosegmentmetrics": "AudioSegmentMetrics" | kind=code-symbol | source=packages/core/src/audio/highlight-analyzer.ts:L7 | neighbors=[highlight-analyzer.ts]
- "audio_highlight_analyzer_highlightanalysisresult": "HighlightAnalysisResult" | kind=code-symbol | source=packages/core/src/audio/highlight-analyzer.ts:L16 | neighbors=[highlight-analyzer.ts]
- "audio_highlight_analyzer_transcriptword": "TranscriptWord" | kind=code-symbol | source=packages/core/src/audio/highlight-analyzer.ts:L1 | neighbors=[highlight-analyzer.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-080.json

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
