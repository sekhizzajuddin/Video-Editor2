# Node Description Batch 44 of 128

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

- "animation_gsap_engine_gsapanimationconfig": "GSAPAnimationConfig" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L27 | neighbors=[gsap-engine.ts, index.ts]
- "animation_gsap_engine_gsapanimationengine_addgsapmotionpathpoint": ".addGSAPMotionPathPoint()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L393 | neighbors=[GSAPAnimationEngine, generateDefaultControlPoints()]
- "animation_gsap_engine_gsapanimationengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L463 | neighbors=[disposeGSAPEngine(), GSAPAnimationEngine]
- "animation_gsap_engine_gsapanimationengine_getsvgpath": ".getSVGPath()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L431 | neighbors=[GSAPAnimationEngine, generateBezierPath()]
- "animation_gsap_engine_gsapanimationengine_removegsapmotionpathpoint": ".removeGSAPMotionPathPoint()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L403 | neighbors=[GSAPAnimationEngine, generateDefaultControlPoints()]
- "animation_gsap_engine_gsapanimationengine_sampleframetransforms": ".sampleFrameTransforms()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L438 | neighbors=[GSAPAnimationEngine, sampleMotionPath()]
- "animation_gsap_engine_gsapmotionpathpoint": "GSAPMotionPathPoint" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L7 | neighbors=[gsap-engine.ts, index.ts]
- "animation_gsap_engine_motionpathconfig": "MotionPathConfig" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L17 | neighbors=[gsap-engine.ts, index.ts]
- "animation_gsap_engine_motionpathtokeyframes": "motionPathToKeyframes()" | kind=code-symbol | source=packages/core/src/animation/gsap-engine.ts:L306 | neighbors=[gsap-engine.ts, index.ts]
- "assembly_index_calculatemedian": "calculateMedian()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L99 | neighbors=[index.ts, quickSelect()]
- "assembly_index_partition": "partition()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/assembly/index.ts:L63 | neighbors=[index.ts, quickSelect()]
- "audio_audio_effect_routing_isfinitenumberarray": "isFiniteNumberArray()" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L12 | neighbors=[audio-effect-routing.ts, isSerializedNoiseProfile()]
- "audio_audio_effect_routing_isvalidfftsize": "isValidFftSize()" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L17 | neighbors=[audio-effect-routing.ts, isSerializedNoiseProfile()]
- "audio_audio_effect_routing_serializednoiseprofile": "SerializedNoiseProfile" | kind=code-symbol | source=packages/core/src/audio/audio-effect-routing.ts:L4 | neighbors=[audio-effect-routing.ts, audio-effects-engine.ts]
- "audio_audio_effects_engine_applygaintobuffer": "applyGainToBuffer()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L591 | neighbors=[audio-effects-engine.ts, restoreVoicePresence()]
- "audio_audio_effects_engine_audioeffectsengine_clearimpulseresponsecache": ".clearImpulseResponseCache()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1217 | neighbors=[AudioEffectsEngine, .dispose()]
- "audio_audio_effects_engine_audioeffectsengine_clearnoiseprofiles": ".clearNoiseProfiles()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1221 | neighbors=[AudioEffectsEngine, .dispose()]
- "audio_audio_effects_engine_audioeffectsengine_createcompressornode": ".createCompressorNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L859 | neighbors=[AudioEffectsEngine, .createCompressorNodePair()]
- "audio_audio_effects_engine_audioeffectsengine_createdelaynode": ".createDelayNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L978 | neighbors=[AudioEffectsEngine, .createEffectNode()]
- "audio_audio_effects_engine_audioeffectsengine_createeqnode": ".createEQNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L834 | neighbors=[AudioEffectsEngine, .createEQNodePair()]
- "audio_audio_effects_engine_audioeffectsengine_creategainnode": ".createGainNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1016 | neighbors=[AudioEffectsEngine, .createGainNodePair()]
- "audio_audio_effects_engine_audioeffectsengine_createnoisereductionnode": ".createNoiseReductionNode()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1031 | neighbors=[AudioEffectsEngine, .createNoiseReductionNodePair()]
- "audio_audio_effects_engine_audioeffectsengine_generateimpulseresponse": ".generateImpulseResponse()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L948 | neighbors=[AudioEffectsEngine, .getOrCreateImpulseResponse()]
- "audio_audio_effects_engine_audioeffectsengine_getaudiocontext": ".getAudioContext()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L687 | neighbors=[AudioEffectsEngine, .ensureInitialized()]
- "audio_audio_effects_engine_audioeffectsengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L666 | neighbors=[AudioEffectsEngine, initializeAudioEffectsEngine()]
- "audio_audio_effects_engine_audioeffectsengine_learnnoiseprofile": ".learnNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L1039 | neighbors=[AudioEffectsEngine, .ensureInitialized()]
- "audio_audio_effects_engine_audioeffectsengine_mapeqbandtype": ".mapEQBandType()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L839 | neighbors=[AudioEffectsEngine, .createEQNodePair()]
- "audio_audio_effects_engine_calculatelowfrequencyenergy": "calculateLowFrequencyEnergy()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L222 | neighbors=[audio-effects-engine.ts, createProfileBasedNoiseReductionFilters…]
- "audio_audio_effects_engine_calculatenoisestatistics": "calculateNoiseStatistics()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L199 | neighbors=[audio-effects-engine.ts, createProfileBasedNoiseReductionFilters…]
- "audio_audio_effects_engine_calculaterangeenergy": "calculateRangeEnergy()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L236 | neighbors=[audio-effects-engine.ts, createProfileBasedNoiseReductionFilters…]
- "audio_audio_effects_engine_createnoisereductionbandsforcontext": "createNoiseReductionBandsForContext()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L146 | neighbors=[audio-effects-engine.ts, createNoiseReductionNodeChain()]
- "audio_audio_effects_engine_getmaximummakeupgain": "getMaximumMakeupGain()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L574 | neighbors=[audio-effects-engine.ts, restoreVoicePresence()]
- "audio_audio_effects_engine_getspectralsmoothingforfocus": "getSpectralSmoothingForFocus()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L480 | neighbors=[audio-effects-engine.ts, .applyNoiseReductionWithProfileData()]
- "audio_audio_effects_engine_tospectralnoiseprofile": "toSpectralNoiseProfile()" | kind=code-symbol | source=packages/core/src/audio/audio-effects-engine.ts:L464 | neighbors=[audio-effects-engine.ts, .applyNoiseReductionWithProfileData()]
- "audio_audio_engine_audioengine_clearcache": ".clearCache()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L941 | neighbors=[AudioEngine, .dispose()]
- "audio_audio_engine_audioengine_createeqnode": ".createEQNode()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L839 | neighbors=[AudioEngine, .createEffectNode()]
- "audio_audio_engine_audioengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L962 | neighbors=[AudioEngine, .clearCache()]
- "audio_audio_engine_audioengine_extractaudiofromvideo": ".extractAudioFromVideo()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L403 | neighbors=[AudioEngine, .getAudioBuffer()]
- "audio_audio_engine_audioengine_extractaudiosegment": ".extractAudioSegment()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L556 | neighbors=[AudioEngine, .processClipBuffer()]
- "audio_audio_engine_audioengine_getaudiocontext": ".getAudioContext()" | kind=code-symbol | source=packages/core/src/audio/audio-engine.ts:L179 | neighbors=[AudioEngine, .ensureInitialized()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-043.json

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
