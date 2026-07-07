# Node Description Batch 33 of 128

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

- "public_puter_et_onopen": ".onOpen()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .flush(), .probe()]
- "public_puter_et_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .createTransport(), .setTransport()]
- "public_puter_et_probe": ".probe()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .onOpen(), .createTransport()]
- "public_puter_et_resetpingtimeout": ".resetPingTimeout()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .onHandshake(), .onPacket()]
- "public_puter_gs_info": ".info()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.constructor(), gs, ._prefix()]
- "public_puter_gt_ispayloadvalid": ".isPayloadValid()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gt, .decodeString(), pt()]
- "public_puter_hn": "Hn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), .#O()]
- "public_puter_i": "i()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, j(), .call()]
- "public_puter_ls_activatefocused": "._activateFocused()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._itemEl(), ._handleKey()]
- "public_puter_ls_hidebackdrop": "._hideBackdrop()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._closeAll(), .disconnectedCallback()]
- "public_puter_ls_onready": ".onReady()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._bindEvents(), ._positionMenu()]
- "public_puter_ls_pointinelement": "._pointInElement()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._pointInRect(), ._submenuCloseCheck()]
- "public_puter_ls_pointinrect": "._pointInRect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._pointInElement(), ._submenuCloseCheck()]
- "public_puter_lt": "lt()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, dt(), .takeBinaryData()]
- "public_puter_m": "M()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, B(), j()]
- "public_puter_mt_finishedreconstruction": ".finishedReconstruction()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.destroy(), mt, .takeBinaryData()]
- "public_puter_n_dehydrate_value": ".dehydrate_value_()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[N(), .dehydrate(), .register_callback()]
- "public_puter_ne": "ne" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .call(), .constructor()]
- "public_puter_ot": "ot()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, encode(), it()]
- "public_puter_qe": "qe()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .exec(), ze()]
- "public_puter_r": "R()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, B(), j()]
- "public_puter_rn_register_callback": ".register_callback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.dehydrate_value_(), Rn, .registerCallback()]
- "public_puter_se": "se" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .call(), .constructor()]
- "public_puter_te": "te" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor(), ._init()]
- "public_puter_te_init": "._init()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[te, .constructor(), .get()]
- "public_puter_un_create": ".create()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Un, U(), .get()]
- "public_puter_vn_write": ".write()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[vn, .get(), wn()]
- "public_puter_we_abort": ".abort()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Ge(), We, .cleanup()]
- "public_puter_wt_ack": ".ack()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .packet(), .onevent()]
- "public_puter_wt_addtoqueue": "._addToQueue()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, ._drainQueue(), .emit()]
- "public_puter_wt_drainqueue": "._drainQueue()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, ._addToQueue(), .onconnect()]
- "public_puter_wt_onevent": ".onevent()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .ack(), .onpacket()]
- "public_puter_wt_sendconnectpacket": "._sendConnectPacket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .onopen(), .packet()]
- "public_puter_wt_subevents": ".subEvents()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt, .connect(), bt()]
- "public_puter_xn_rerender": "._rerender()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.items(), Xn, .connectedCallback()]
- "public_puter_xt_close": "._close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, ._destroy(), .disconnect()]
- "public_puter_xt_destroy": "._destroy()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.destroy(), xt, ._close()]
- "public_puter_xt_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, bt(), et]
- "public_puter_xt_packet": "._packet()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.packet(), xt, encode()]
- "public_puter_xt_reconnect": ".reconnect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[xt, .maybeReconnectOnOpen(), .onclose()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-032.json

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
