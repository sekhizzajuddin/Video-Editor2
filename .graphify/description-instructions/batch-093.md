# Node Description Batch 94 of 128

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

- "public_puter_kn_send": ".send()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn]
- "public_puter_ls_clearfocus": "._clearFocus()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls]
- "public_puter_ls_escapeattr": "._escapeAttr()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls]
- "public_puter_ls_escapehtml": "._escapeHTML()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls]
- "public_puter_ls_getstyles": ".getStyles()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls]
- "public_puter_ls_setkeyboardnav": "._setKeyboardNav()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls]
- "public_puter_mn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[mn]
- "public_puter_ms_acquire": ".acquire()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ms]
- "public_puter_ms_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ms]
- "public_puter_ms_release": ".release()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ms]
- "public_puter_mt_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[mt]
- "public_puter_n_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[N()]
- "public_puter_ne_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ne]
- "public_puter_nn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Nn]
- "public_puter_o": "o()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_os": "os()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_p_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[P]
- "public_puter_p_connectedcallback": ".connectedCallback()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[P]
- "public_puter_p_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[P]
- "public_puter_p_open": ".open()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[P]
- "public_puter_packettype": "PacketType()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js]
- "public_puter_pe_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[pe()]
- "public_puter_rn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Rn]
- "public_puter_se_call": ".call()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[se]
- "public_puter_se_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[se]
- "public_puter_tn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Tn]
- "public_puter_tn_on": ".on()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Tn]
- "public_puter_tn_write": ".write()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Tn]
- "public_puter_un_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Un]
- "public_puter_vn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[vn]
- "public_puter_we_create": ".create()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[We]
- "public_puter_we_onerror": ".onError()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[We]
- "public_puter_we_onload": ".onLoad()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[We]
- "public_puter_wn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wn()]
- "public_puter_wt_active": ".active()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_close": ".close()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_compress": ".compress()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_disconnected": ".disconnected()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]
- "public_puter_wt_emitevent": ".emitEvent()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[wt]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-093.json

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
