# Local Storage Audit

Audit of persisted browser state (`localStorage`) in Video-Editor2, plus a record of the
sandbox-side storage check performed for session `01a01961`.

Branch: `arena/01a01a2c-video-editor2` · Base commit: `3b50115b` ("Mobile")

---

## 1. Session `01a01961` — sandbox storage check

The workspace was inspected for any artifacts belonging to session `01a01961`. **None were found.**

| Check | Result |
| --- | --- |
| `git status` (working tree) | Clean — no modified, untracked, or ignored files |
| `git stash list` | Empty |
| `git reflog` | Only `clone` + `checkout` of `arena/01a01a2c-video-editor2` |
| `git fsck --lost-found` | No dangling or unreachable objects |
| Filesystem (`~`, `/tmp/arena-workspace`, `/opt`, `/srv`) | No session directories; only `/home/user/Video-Editor2` |
| Text search for `01a01961` across repo | No matches |
| Remote branches (`git ls-remote`) | No branch matching `01a01961` |
| Remote pull requests (#1–#24) | No PR referencing `01a01961` |

**Conclusion:** session `01a01961` produced no commits, no branch, and no PR in this repository,
and left nothing on local disk. This checkout is a clean clone of `main`.

---

## 2. Application `localStorage` inventory

32 `localStorage` call sites across 8 modules. Only 4 of them are wrapped in a `try` block.

### Keys currently written

| Key | Owner | Purpose | Guarded |
| --- | --- | --- | --- |
| `procut_custom_fonts` | `src/utils/fontManager.ts` | Metadata list of user-uploaded fonts | ✗ |
| `procut_font_blob_<family>` | `src/utils/fontManager.ts` | Base64 font binary, one key per family | partial (write only) |
| `procut_ai_chat_v1` | `src/hooks/useAiCopilot.ts` | Last 40 AI copilot chat messages | ✓ |
| `procut_groq_model_catalog_v1` | `src/utils/ai-copilot/groqModelCatalog.ts` | Cached Groq model catalog | ✓ |
| `procut.chromaKey.swatches` | `src/components/properties/tabs/effects/ChromaKeySection.tsx` | Saved chroma-key colour swatches | ✓ |
| `exportOutputFolder` | `ExportModal.tsx`, `SettingsModal.tsx` | Last chosen export destination | ✗ |
| `openRouterCustomModelId` | `src/components/AIGeneratorModal.tsx` | User-entered OpenRouter model id | ✗ |
| `openreel_device_profile` | `packages/core/src/device/device-capabilities.ts` | Cached device capability profile | ✓ |

### Call sites

| File | Lines |
| --- | --- |
| `src/App.tsx` | 452 (font restore on startup) |
| `src/components/AIGeneratorModal.tsx` | 23, 269 |
| `src/components/ExportModal.tsx` | 47, 56, 70 |
| `src/components/SettingsModal.tsx` | 458–459, 467, 482, 485 |
| `src/components/properties/tabs/effects/ChromaKeySection.tsx` | 79, 91 |
| `src/hooks/useAiCopilot.ts` | 172, 192, 1093 |
| `src/utils/ai-copilot/groqModelCatalog.ts` | 156–171, 287–289 |
| `src/utils/fontManager.ts` | 26, 30, 59, 70, 84–85 |
| `packages/core/src/device/device-capabilities.ts` | 384, 400–403, 411 |

---

## 3. Findings

**F1 — Font blobs will exhaust the 5 MB quota.**
`fontManager.ts:30` base64-encodes each font file into its own key. Base64 inflates binaries by
~33 %, so two or three typical `.ttf` files can fill the entire origin quota. The write is
`try`-wrapped, but `procut_custom_fonts` metadata (line 26) is written *before* it and is *not*
guarded — a quota failure therefore leaves metadata referencing a font blob that does not exist,
and the startup restore path in `App.tsx:452` silently loses those fonts. IndexedDB is the correct
store for binary assets of this size.

**F2 — Unguarded access throws in restricted contexts.**
`AIGeneratorModal.tsx:23`, `ExportModal.tsx:47`, and `SettingsModal.tsx:458` call `localStorage`
directly, including inside a `useState` initializer and inside render. Safari private browsing,
blocked third-party storage, and SSR/worker contexts all make these throw and crash the component
tree. `groqModelCatalog.ts` and `device-capabilities.ts` already show the right pattern
(`typeof localStorage === 'undefined'` + `try`/`catch`); it is not applied consistently.

**F3 — Reads during render.**
`SettingsModal.tsx:458`, `:459`, and `:482` read `localStorage` in the render body, so the
displayed export folder is not reactive — clearing it at line 485 does not re-render the value
until some unrelated state change occurs.

**F4 — Inconsistent key namespacing.**
Four conventions coexist: `procut_snake_case`, `procut.dot.case`, bare `camelCase`
(`exportOutputFolder`, `openRouterCustomModelId`), and a foreign `openreel_` prefix. Bare keys risk
collision with anything else served from the same origin, and there is no shared prefix constant or
version/migration scheme.

**F5 — No eviction or cleanup path.**
Nothing prunes `procut_font_blob_*` for fonts removed outside `removeCustomFont`, and there is no
storage-usage reporting anywhere in Settings, so a user who hits the quota gets silent failures with
no way to diagnose or recover.

---

## 4. Recommendations

1. Move font binaries to IndexedDB; keep only metadata in `localStorage`. Write metadata *after* a
   successful blob write so the two never diverge.
2. Add a shared `safeStorage` helper (`get`/`set`/`remove`, `typeof` guard + `try`/`catch` +
   JSON handling) and route all 32 call sites through it.
3. Hoist `exportOutputFolder` into React state in `SettingsModal`; read storage once in an effect.
4. Normalise every key to a single `procut.` prefix behind exported constants, with a one-time
   migration from the legacy bare and `openreel_` keys.
5. Surface storage usage and a "Clear cached data" action in Settings, and prune orphaned
   `procut_font_blob_*` keys on startup.
