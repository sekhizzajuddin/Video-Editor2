# Node Description Batch 95 of 128

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

- "public_puter_wt_emitwithack": ".emitWithAck()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_listenersany": ".listenersAny()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_listenersanyoutgoing": ".listenersAnyOutgoing()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_offany": ".offAny()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_offanyoutgoing": ".offAnyOutgoing()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_onany": ".onAny()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_onanyoutgoing": ".onAnyOutgoing()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_onclose": ".onclose()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_onerror": ".onerror()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_prependany": ".prependAny()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_prependanyoutgoing": ".prependAnyOutgoing()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_send": ".send()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_timeout": ".timeout()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_volatile": ".volatile()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_xe": "xe()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_xn_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xn_emitevent": ".emitEvent()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xn_getstyles": ".getStyles()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xn_onready": ".onReady()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xn_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xn_render": ".render()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Xn]
- "public_puter_xt_cleanup": ".cleanup()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_xt_connect": ".connect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_xt_ondecoded": ".ondecoded()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_xt_onerror": ".onerror()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_xt_onping": ".onping()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_xt_onreconnect": ".onreconnect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_xt_timeout": ".timeout()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt]
- "public_puter_y_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Y]
- "public_puter_y_connectedcallback": ".connectedCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Y]
- "public_puter_y_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Y]
- "public_puter_y_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Y]
- "public_puter_y_r": ".#r()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Y]
- "public_puter_zn_getdehydrator": ".getDehydrator()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[zn]
- "public_sw": "sw.js" | kind=code-symbol | source=public/sw.js:L1 | neighbors=[ASSETS]
- "public_sw_assets": "ASSETS" | kind=code-symbol | source=public/sw.js:L2 | neighbors=[sw.js]
- "shaders_index_bluruniforms": "BlurUniforms" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L538 | neighbors=[index.ts]
- "shaders_index_borderradiusuniforms": "BorderRadiusUniforms" | kind=code-symbol | source=packages/core/src/video/shaders/index.ts:L147 | neighbors=[index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-094.json

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
