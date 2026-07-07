# Node Description Batch 93 of 128

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

- "public_puter_constructor": "constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_de_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_onclose": ".onClose()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_ondata": ".onData()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_onerror": ".onError()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_onopen": ".onOpen()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_onpacket": ".onPacket()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_pause": ".pause()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_de_send": ".send()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[De]
- "public_puter_dn_usessdk": ".usesSDK()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Dn]
- "public_puter_e_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[E]
- "public_puter_en_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En]
- "public_puter_en_requestreadapprootdir": ".requestReadAppRootDir()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En]
- "public_puter_en_requestwriteapprootdir": ".requestWriteAppRootDir()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En]
- "public_puter_en_setapiorigin": ".setAPIOrigin()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En]
- "public_puter_en_setauthtoken": ".setAuthToken()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[En]
- "public_puter_et_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et]
- "public_puter_et_onclose": ".onClose()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et]
- "public_puter_et_onerror": ".onError()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et]
- "public_puter_f": "F()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_fe": "Fe()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_fn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Fn]
- "public_puter_gn_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Gn]
- "public_puter_gn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Gn]
- "public_puter_gn_start": ".start()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Gn]
- "public_puter_gs_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gs]
- "public_puter_gt_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gt]
- "public_puter_hn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Hn]
- "public_puter_ie": "Ie()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_in_addlistener": ".addListener()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[In]
- "public_puter_in_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[In]
- "public_puter_in_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[In]
- "public_puter_jn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[jn]
- "public_puter_ke": "ke()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_kn_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn]
- "public_puter_kn_connect": ".connect()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn]
- "public_puter_kn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn]
- "public_puter_kn_createoffer": ".createOffer()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn]
- "public_puter_kn_m": ".#M()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-092.json

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
