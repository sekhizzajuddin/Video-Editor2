# Node Description Batch 80 of 128

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

- "animation_gsap_engine_gsapanimationengine_setmotionpath": ".setMotionPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L369 | neighbors=[GSAPAnimationEngine]
- "animation_gsap_engine_gsapanimationengine_updategsapmotionpathpoint": ".updateGSAPMotionPathPoint()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L381 | neighbors=[GSAPAnimationEngine]
- "assembly_index_allocatef32": "allocateF32()" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L152 | neighbors=[index.ts]
- "assembly_index_allocatei32": "allocateI32()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L174 | neighbors=[index.ts]
- "assembly_index_allocateu32": "allocateU32()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L199 | neighbors=[index.ts]
- "assembly_index_allocateu8": "allocateU8()" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L148 | neighbors=[index.ts]
- "assembly_index_applyhannwindow": "applyHannWindow()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L184 | neighbors=[index.ts]
- "assembly_index_calculatemean": "calculateMean()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L147 | neighbors=[index.ts]
- "assembly_index_calculatestddev": "calculateStdDev()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L158 | neighbors=[index.ts]
- "assembly_index_computermsenergies": "computeRMSEnergies()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L1 | neighbors=[index.ts]
- "assembly_index_encodewav16mono": "encodeWav16Mono()" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L1 | neighbors=[index.ts]
- "assembly_index_encodewav16stereo": "encodeWav16Stereo()" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L20 | neighbors=[index.ts]
- "assembly_index_encodewav24stereo": "encodeWav24Stereo()" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L47 | neighbors=[index.ts]
- "assembly_index_findpeaks": "findPeaks()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L118 | neighbors=[index.ts]
- "assembly_index_forward": "forward()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L43 | neighbors=[index.ts]
- "assembly_index_frommagnitudeandphase": "fromMagnitudeAndPhase()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L162 | neighbors=[index.ts]
- "assembly_index_getmagnitude": "getMagnitude()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L138 | neighbors=[index.ts]
- "assembly_index_getmagnitudeandphase": "getMagnitudeAndPhase()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L147 | neighbors=[index.ts]
- "assembly_index_getsize": "getSize()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L39 | neighbors=[index.ts]
- "assembly_index_init": "init()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L6 | neighbors=[index.ts]
- "assembly_index_inverse": "inverse()" | kind=code-symbol | source=packages/core/src/wasm/fft/assembly/index.ts:L87 | neighbors=[index.ts]
- "assembly_index_smootharray": "smoothArray()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L40 | neighbors=[index.ts]
- "assembly_index_writewavheader": "writeWavHeader()" | kind=code-symbol | source=packages/core/src/wasm/wav/assembly/index.ts:L77 | neighbors=[index.ts]
- "audio_audio_effects_engine_audioeffectchainconfig": "AudioEffectChainConfig" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L13 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_audioeffectsengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L662 | neighbors=[AudioEffectsEngine]
- "audio_audio_effects_engine_audioeffectsengine_getnoiseprofile": ".getNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1103 | neighbors=[AudioEffectsEngine]
- "audio_audio_effects_engine_audioeffectsengine_isinitialized": ".isInitialized()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L683 | neighbors=[AudioEffectsEngine]
- "audio_audio_effects_engine_effectnodepair": "EffectNodePair" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L39 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_effectprocessingresult": "EffectProcessingResult" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L34 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_noise_reduction_band_specs": "NOISE_REDUCTION_BAND_SPECS" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L61 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_noise_reduction_focus_profiles": "NOISE_REDUCTION_FOCUS_PROFILES" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L73 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_noisereductionbandspec": "NoiseReductionBandSpec" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L48 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_noisereductionfocus": "NoiseReductionFocus" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L44 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_noisereductionfocusprofile": "NoiseReductionFocusProfile" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L55 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_noisereductionnodechain": "NoiseReductionNodeChain" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L140 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_reverbconfig": "ReverbConfig" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L18 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_simplenoiseprofile": "SimpleNoiseProfile" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L26 | neighbors=[audio-effects-engine.ts]
- "audio_audio_effects_engine_test_createaudiobuffer": "createAudioBuffer()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.test.ts:L4 | neighbors=[audio-effects-engine.test.ts]
- "audio_audio_engine_audioengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L131 | neighbors=[AudioEngine]
- "audio_audio_engine_audioengine_createcliprenderinfo": ".createClipRenderInfo()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L327 | neighbors=[AudioEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-079.json

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
