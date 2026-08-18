# Desktop ↔ Mobile Sync Rules (AI Development Instructions)

This project has **two editors** that share the same logic engine:

| Editor | Router | UI entry |
| --- | --- | --- |
| Desktop (PC) | `src/App.tsx` → `DesktopApp` | `src/components/**` |
| Mobile / Tablet | `src/App.tsx` → `MobileApp` | `src/mobile/**` |

The device is chosen at runtime by `src/hooks/useDeviceType.ts` (mobile / tablet / desktop).

---

## The one rule to follow when editing any file

> **If an update is done in LOGIC, CHANGING ARCHITECTURE, or FIXING BUGS → mirror the
> same change in the counterpart file.**
>
> **SKIP the mirror if the update is UI-only (styling, layout, copy, component markup).**

Every feature file carries this rule inline as a header comment:

- `[MOBILE SYNC]` on desktop files → lists the mobile counterpart path(s).
- `[DESKTOP SYNC]` on mobile files → lists the desktop counterpart path(s).
- `[SHARED CORE]` on shared files → no copy exists; edit once, affects both UIs.

---

## Feature map (desktop → mobile)

| Feature | Desktop file(s) | Mobile file(s) |
| --- | --- | --- |
| App shell / workspace layout | `src/App.tsx` | `src/mobile/App.tsx` |
| Top toolbar / project actions | `src/components/TopToolbar.tsx` | `src/mobile/components/MobileTopBar.tsx` |
| Editing tools (select/split/undo…) | `src/App.tsx`, `src/components/TopToolbar.tsx` | `src/mobile/components/MobileToolRail.tsx` |
| Timeline (tracks, clips, playhead) | `src/components/Timeline.tsx`, `src/timeline/**` | `src/mobile/components/MobileTimeline.tsx` |
| Media library / import / add-to-timeline | `src/components/MediaPanel/index.tsx`, `src/hooks/media/useMediaImport.ts` | `src/mobile/components/MobileMediaSheet.tsx`, `src/mobile/lib/timeline.ts` |
| Clip properties (transform/color/text/audio) | `src/components/properties/PropertiesPanel.tsx`, `src/components/properties/tabs/**` | `src/mobile/components/MobilePropertiesSheet.tsx` |
| Welcome / project creation | `src/components/WelcomeScreen.tsx` | `src/mobile/components/MobileWelcomeScreen.tsx` |
| Bottom sheet / drawer primitives | `src/components/ui/sheet.tsx`, `src/components/ui/drawer.tsx` | `src/mobile/components/MobileBottomSheet.tsx` |
| Device identifier | `src/hooks/use-mobile.ts` | `src/hooks/useDeviceType.ts` |
| Styling | `src/App.css`, `src/index.css` | `src/mobile/mobile.css` |

## Feature map (mobile → desktop)

Same table, reversed — each mobile file's header lists its desktop counterpart path(s).
For example, `src/mobile/components/MobileTimeline.tsx` points back to
`src/components/Timeline.tsx` + `src/timeline/index.ts`.

## Shared core (NO mobile copy — edit once)

These are imported by **both** editors. A logic/architecture/bugfix change here
automatically affects desktop and mobile; do **not** re-implement it per-UI.

- `src/store/editorStore.ts` — all state + actions (single source of truth)
- `src/types/index.ts` — shared TypeScript contracts
- `src/timeline/**` — timeline math, geometry, formatting, drag/drop/scroll hooks
- `src/components/preview/**` — canvas renderer + transform overlay (mobile reuses `<PreviewCanvas/>`)
- `src/components/ExportModal.tsx` — export pipeline (reused as-is)
- `src/components/SettingsModal.tsx`, `src/components/HelpModal.tsx`,
  `src/components/AspectRatioConflictModal.tsx`, `src/components/FileHandlerInitializer.tsx` — reused as-is
- `src/export/useExportEngine.ts` — export engine
- `src/hooks/media/useMediaImport.ts`, `src/hooks/usePlaybackTime.ts` — media/playback hooks
- `src/utils/projectPersistence.ts`, `src/utils/snapshotScheduler.ts` — persistence/undo helpers
- `src/constants/mediaPanel.ts`, `src/utils/textTemplates.ts` — presets consumed by both panels

## Desktop-only (no mobile copy yet — do not mirror)

These features are not yet wired into the mobile UI. If you add them to mobile,
create the mobile file under `src/mobile/` and add a `[DESKTOP SYNC]` header pointing back.

- AI Copilot (`src/components/AiCopilot.tsx`) — desktop floating chat
- Audio mixer panel (`src/components/AudioMixer.tsx`) — desktop bottom tab
- Scopes panel (`src/components/ScopesPanel.tsx`) — floating in desktop workspace
- Teleprompter (`src/components/TeleprompterModal.tsx`)
- Keyboard shortcuts (`src/utils/keyboardShortcuts.ts`) — mouse/keyboard driven

## Checklist for an AI (or dev) making a change

1. Identify the layer: **logic** (store/utils/export/timeline math) vs **UI** (layout/styling/markup).
2. Logic / architecture / bugfix:
   - Shared core → edit once (done).
   - Desktop feature → also update the mobile file listed in the header.
   - Mobile feature → also update the desktop file listed in the header.
3. UI-only → change that UI only; do not mirror.
4. After cross-file logic changes, run `npm run build` (or `npx tsc -b`) to verify.
