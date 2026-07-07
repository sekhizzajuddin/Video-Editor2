# Node Description Batch 58 of 128

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

- "public_puter_et_write": ".write()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[et, .sendPacket()]
- "public_puter_fn": "Fn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor()]
- "public_puter_ge": "Ge()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .abort()]
- "public_puter_gs_debug": ".debug()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gs, ._prefix()]
- "public_puter_gs_fields": ".fields()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.constructor(), gs]
- "public_puter_gs_on": ".on()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gs, .add()]
- "public_puter_gt_destroy": ".destroy()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gt, .finishedReconstruction()]
- "public_puter_gt_tryparse": ".tryParse()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[gt, .decodeString()]
- "public_puter_in_write": ".write()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[In, encode()]
- "public_puter_jn_hydrate": ".hydrate()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[jn, .hydrate_value_()]
- "public_puter_jn_hydrate_value": ".hydrate_value_()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[jn, .hydrate()]
- "public_puter_kn_addicecandidate": ".addIceCandidate()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.#L(), Kn]
- "public_puter_kn_createanswer": ".createAnswer()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.#L(), Kn]
- "public_puter_kn_o": ".#O()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Kn, Hn]
- "public_puter_kn_setremotedescription": ".setRemoteDescription()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[.#L(), Kn]
- "public_puter_ls_bindevents": "._bindEvents()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, .onReady()]
- "public_puter_ls_formatshortcut": "._formatShortcut()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._isMac()]
- "public_puter_ls_getactivesubmenu": "._getActiveSubmenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._isEventInChain()]
- "public_puter_ls_hidesubmenu": "._hideSubmenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._hideActiveSubmenu()]
- "public_puter_ls_iseventinchain": "._isEventInChain()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._getActiveSubmenu()]
- "public_puter_ls_ismac": "._isMac()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._formatShortcut()]
- "public_puter_ls_ismobile": "._isMobile()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._positionMenu()]
- "public_puter_ls_ismouseheadingtosubmenu": "._isMouseHeadingToSubmenu()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._submenuCloseCheck()]
- "public_puter_ls_items": ".items()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._rerender()]
- "public_puter_ls_render": ".render()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._renderItems()]
- "public_puter_ls_renderitems": "._renderItems()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, .render()]
- "public_puter_ls_schedulesubmenuclose": "._scheduleSubmenuClose()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._cancelSubmenuClose()]
- "public_puter_ls_showbackdrop": "._showBackdrop()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[ls, ._positionMenu()]
- "public_puter_mn_emit": ".emit()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[mn, .error()]
- "public_puter_mn_on": ".on()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[mn, .error()]
- "public_puter_n_dehydrate": ".dehydrate()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[N(), .dehydrate_value_()]
- "public_puter_nn": "Nn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor()]
- "public_puter_pe": "pe()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor()]
- "public_puter_pt": "pt()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .isPayloadValid()]
- "public_puter_qn": "qn" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .constructor()]
- "public_puter_qn_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[qn, zn]
- "public_puter_rn_attach_to_source": ".attach_to_source()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Rn, .constructor()]
- "public_puter_t": "T()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[puter.js, .get()]
- "public_puter_te_constructor": ".constructor()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[te, ._init()]
- "public_puter_un_getlogginghandle": ".getLoggingHandle()" | kind=code-symbol | source=public/puter.js:L4 | neighbors=[Un, U()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-057.json

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
