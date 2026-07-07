# Node Description Batch 41 of 128

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

- "wav_index_wavencoder_encodewav16mono": ".encodeWav16Mono()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L228 | neighbors=[WavEncoder, .encodeFullWav(), jsEncodeWav16Mono()]
- "wav_index_wavencoder_encodewav16stereo": ".encodeWav16Stereo()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L240 | neighbors=[WavEncoder, .encodeFullWav(), jsEncodeWav16Stereo()]
- "wav_index_wavencoder_encodewav24stereo": ".encodeWav24Stereo()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L253 | neighbors=[WavEncoder, .encodeFullWav(), jsEncodeWav24Stereo()]
- "wav_index_wavencoder_ensurewasm": ".ensureWasm()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L216 | neighbors=[preloadWasmWav(), WavEncoder, initWasmWav()]
- "wav_index_wavencoder_writewavheader": ".writeWavHeader()" | kind=code-symbol | source=packages/core/src/wasm/wav/index.ts:L266 | neighbors=[WavEncoder, .encodeFullWav(), jsWriteWavHeader()]
- "actions_action_executor_actionexecutor_applyaudioaction": ".applyAudioAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1292 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_applyeffectaction": ".applyEffectAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L961 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_applykeyframeaction": ".applyKeyframeAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1102 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_applyprojectaction": ".applyProjectAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L244 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_applytrackaction": ".applyTrackAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L331 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_applytransformaction": ".applyTransformAction()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1083 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_executemany": ".executeMany()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L88 | neighbors=[ActionExecutor, .execute()]
- "actions_action_executor_actionexecutor_infermediatype": ".inferMediaType()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L324 | neighbors=[ActionExecutor, .applyMediaAction()]
- "actions_action_executor_actionexecutor_parsesrttime": ".parseSrtTime()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L1470 | neighbors=[ActionExecutor, .applySubtitleAction()]
- "actions_action_executor_actionexecutor_recalculatetimelineduration": ".recalculateTimelineDuration()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L233 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_redo": ".redo()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L144 | neighbors=[ActionExecutor, .applyAction()]
- "actions_action_executor_actionexecutor_resolvespecialmarkers": ".resolveSpecialMarkers()" | kind=code-symbol | source=packages/core/src/actions/action-executor.ts:L186 | neighbors=[ActionExecutor, .undo()]
- "actions_action_history_actiongroup": "ActionGroup" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L11 | neighbors=[action-history.ts, index.ts]
- "actions_action_history_actionhistory_clear": ".clear()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L333 | neighbors=[ActionHistory, .notify()]
- "actions_action_history_actionhistory_deletesnapshot": ".deleteSnapshot()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L285 | neighbors=[ActionHistory, .notify()]
- "actions_action_history_actionhistory_endgroup": ".endGroup()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L196 | neighbors=[ActionHistory, .notify()]
- "actions_action_history_actionhistory_getdisplayhistory": ".getDisplayHistory()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L295 | neighbors=[ActionHistory, .push()]
- "actions_action_history_getactiondescription": "getActionDescription()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L59 | neighbors=[action-history.ts, .push()]
- "actions_action_history_getactiontargetid": "getActionTargetId()" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L98 | neighbors=[action-history.ts, .push()]
- "actions_action_history_historyentry": "HistoryEntry" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L3 | neighbors=[action-history.ts, index.ts]
- "actions_action_history_historysnapshot": "HistorySnapshot" | kind=code-symbol | source=packages/core/src/actions/action-history.ts:L18 | neighbors=[action-history.ts, index.ts]
- "actions_action_validator_actionvalidator_validate": ".validate()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L20 | neighbors=[ActionValidator, .validateActionType()]
- "actions_action_validator_actionvalidator_validatemediaaction": ".validateMediaAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L138 | neighbors=[ActionValidator, .validateActionType()]
- "actions_action_validator_actionvalidator_validateprojectaction": ".validateProjectAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L85 | neighbors=[ActionValidator, .validateActionType()]
- "actions_action_validator_actionvalidator_validatesubtitleaction": ".validateSubtitleAction()" | kind=code-symbol | source=packages/core/src/actions/action-validator.ts:L1018 | neighbors=[ActionValidator, .validateActionType()]
- "actions_inverse_action_generator_inverseactiongenerator_cloneclip": ".cloneClip()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L630 | neighbors=[InverseActionGenerator, .generateClipInverse()]
- "actions_inverse_action_generator_inverseactiongenerator_clonemediaitem": ".cloneMediaItem()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L601 | neighbors=[InverseActionGenerator, .generateMediaInverse()]
- "actions_inverse_action_generator_inverseactiongenerator_clonetrack": ".cloneTrack()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L616 | neighbors=[InverseActionGenerator, .generateTrackInverse()]
- "actions_inverse_action_generator_inverseactiongenerator_findtransition": ".findTransition()" | kind=code-symbol | source=packages/core/src/actions/inverse-action-generator.ts:L590 | neighbors=[InverseActionGenerator, .generateTransitionInverse()]
- "ai_auto_reframe_engine_autoreframeengine_calculateoptimalcrop": ".calculateOptimalCrop()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L480 | neighbors=[AutoReframeEngine, .analyzeClip()]
- "ai_auto_reframe_engine_autoreframeengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L631 | neighbors=[AutoReframeEngine, disposeAutoReframeEngine()]
- "ai_auto_reframe_engine_autoreframeengine_floodfillregion": ".floodFillRegion()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L432 | neighbors=[AutoReframeEngine, .findConnectedRegions()]
- "ai_auto_reframe_engine_autoreframeengine_getkeyframeattime": ".getKeyframeAtTime()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L578 | neighbors=[AutoReframeEngine, .interpolateKeyframes()]
- "ai_auto_reframe_engine_autoreframeengine_gettargetconfig": ".getTargetConfig()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L287 | neighbors=[AutoReframeEngine, .analyzeClip()]
- "ai_auto_reframe_engine_autoreframeengine_interpolatekeyframes": ".interpolateKeyframes()" | kind=code-symbol | source=packages/core/src/ai/auto-reframe-engine.ts:L609 | neighbors=[AutoReframeEngine, .getKeyframeAtTime()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-040.json

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
