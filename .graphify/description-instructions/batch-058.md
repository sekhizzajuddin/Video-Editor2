# Node Description Batch 59 of 128

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

- "public_puter_un_list": ".list()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Un, U()]
- "public_puter_vn_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[vn, wn()]
- "public_puter_vn_continue": "._continue()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[vn, .get()]
- "public_puter_vn_register": ".register()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[vn, wn()]
- "public_puter_vt": "vt()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor()]
- "public_puter_we_cleanup": ".cleanup()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[We, .abort()]
- "public_puter_we_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[We, Le()]
- "public_puter_wt_connect": ".connect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .subEvents()]
- "public_puter_wt_destroy": ".destroy()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, ._destroy()]
- "public_puter_wt_disconnect": ".disconnect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .packet()]
- "public_puter_wt_emitbuffered": ".emitBuffered()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .onconnect()]
- "public_puter_wt_notifyoutgoinglisteners": ".notifyOutgoingListeners()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .emit()]
- "public_puter_wt_onack": ".onack()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .onpacket()]
- "public_puter_wt_ondisconnect": ".ondisconnect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .onpacket()]
- "public_puter_wt_onopen": ".onopen()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, ._sendConnectPacket()]
- "public_puter_wt_registerackcallback": "._registerAckCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .emit()]
- "public_puter_xn_applytheme": "._applyTheme()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn, .connectedCallback()]
- "public_puter_xn_disconnectedcallback": ".disconnectedCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn, ._teardownThemeWatchers()]
- "public_puter_xn_setupthemewatchers": "._setupThemeWatchers()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn, .connectedCallback()]
- "public_puter_xn_teardownthemewatchers": "._teardownThemeWatchers()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn, .disconnectedCallback()]
- "public_puter_xt_disconnect": ".disconnect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, ._close()]
- "public_puter_xt_maybereconnectonopen": ".maybeReconnectOnOpen()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .reconnect()]
- "public_puter_xt_onclose": ".onclose()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .reconnect()]
- "public_puter_xt_ondata": ".ondata()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .add()]
- "public_puter_xt_onopen": ".onopen()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, bt()]
- "public_puter_xt_randomizationfactor": ".randomizationFactor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .constructor()]
- "public_puter_xt_reconnection": ".reconnection()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .constructor()]
- "public_puter_xt_reconnectionattempts": ".reconnectionAttempts()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .constructor()]
- "public_puter_xt_reconnectiondelay": ".reconnectionDelay()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .constructor()]
- "public_puter_xt_reconnectiondelaymax": ".reconnectionDelayMax()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .constructor()]
- "public_puter_z": "z" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .callback()]
- "public_puter_z_callback": ".callback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[B(), z]
- "public_puter_ze": "ze()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, qe()]
- "public_puter_zn_gethydrator": ".getHydrator()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[zn, jn]
- "public_puter_zn_registercallback": ".registerCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[zn, .register_callback()]
- "public_puter_zn_send": ".send()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[zn, .postMessage()]
- "shaders_index_createbluruniformsbuffer": "createBlurUniformsBuffer()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L567 | neighbors=[index.ts, webgpu-effects-processor.ts]
- "shaders_index_createdimensionsbuffer": "createDimensionsBuffer()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L581 | neighbors=[index.ts, webgpu-effects-processor.ts]
- "shaders_index_createedgedimensionsbuffer": "createEdgeDimensionsBuffer()" | kind=code-symbol | source=packages/core/src/video/upscaling/shaders/index.ts:L337 | neighbors=[index.ts, upscaling-engine.ts]
- "shaders_index_createeffectuniformsbuffer": "createEffectUniformsBuffer()" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L545 | neighbors=[index.ts, webgpu-effects-processor.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-058.json

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
