# ProCut Mobile Editor

Touch-first, CapCut / KineMaster-inspired mobile & tablet editor.

> **AI Development instructions:** every file in this repo carries a sync header
> (`[DESKTOP SYNC]` / `[MOBILE SYNC]` / `[SHARED CORE]`) telling you where the other
> version lives and whether to mirror a change. See **`/SYNC-RULES.md`** at the repo
> root for the full bidirectional feature map.

This folder is **entirely separate** from the desktop editor. The desktop UI lives in
`src/App.tsx` (`DesktopApp`) and is untouched — the only change made to it is the
device identifier/router at the bottom of `src/App.tsx`.

`src/App.tsx` now reads `useDeviceType()` from `src/hooks/useDeviceType.ts`:

| Device class | Resolution |
| --- | --- |
| `mobile` (phone)  | renders `@/mobile/App` → `MobileApp` |
| `tablet`          | renders `@/mobile/App` → `MobileApp` |
| `desktop` (PC)    | renders `DesktopApp` (the original editor) |

Detection combines user-agent, pointer coarseness and viewport width, so resizing a
desktop browser below 768px (or using dev-tools device emulation) switches to the
mobile UI without a reload.

## Layout (CapCut-style)

```
┌─────────────────────────────┐
│ MobileTopBar (title, ratio,  │
│ undo/redo, export, settings) │
├─────────────────────────────┤
│                             │
│  PreviewCanvas (reused)     │  ← full render engine + transform overlay
│                             │
├─────────────────────────────┤
│ MobileTimeline (scrollable  │
│ ruler + tracks + playhead)  │
├─────────────────────────────┤
│ MobileToolRail (Add/Audio/  │
│ Text/Effects/Split/Dup/Del) │
└─────────────────────────────┘
       ▲ slide-up bottom sheets
       ├── MobileMediaSheet      (import + media/text/effects library)
       └── MobilePropertiesSheet (clip transform/color/text/audio)
```

`MobileWelcomeScreen` is shown until the user creates or opens a project
(`projectId === 'default'`), matching the desktop `WelcomeScreen` behaviour.

## Shared logic vs new UI

Every file in this folder is new UI code, but it reuses the existing business logic
instead of duplicating it:

| Concern | Reused from |
| --- | --- |
| Editor state & actions | `@/store/editorStore` |
| Canvas renderer, transform/crop overlay, transport | `@/components/PreviewCanvas` |
| Export | `@/components/ExportModal` (opened via `showExportModal`) |
| Settings / Help / aspect-ratio conflict | `@/components/SettingsModal`, `HelpModal`, `AspectRatioConflictModal` |
| Media import pipeline | `@/hooks/media/useMediaImport` |
| Text / FX presets | `@/utils/textTemplates`, `@/constants/mediaPanel` |
| Timeline math & formatting | `@/timeline` (`formatCentisecondTime`, track geometry constants) |
| Undo snapshot debouncing | `@/utils/snapshotScheduler` |

## PWA / Offline (installable, works with no network)

The whole app (mobile **and** desktop share one service worker) is an offline-first
Progressive Web App built with `vite-plugin-pwa`:

| Piece | Location |
| --- | --- |
| Service worker config | `vite.config.ts` → `VitePWA({ ... })` |
| SW registration + update hooks | `src/main.tsx` (`registerSW` from `virtual:pwa-register`) |
| Virtual module types | `src/types/pwa-register.d.ts` |
| Web app manifest | `public/manifest.json` |
| Icons (any + maskable + iOS) | `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` |
| Mobile offline banner | `src/mobile/App.tsx` + `src/mobile/hooks/useOnlineStatus.ts` |
| Mobile PWA toasts | `src/mobile/components/PwaStatusListener.tsx` |
| Deploy headers/rewrites | `vercel.json` (SW `no-cache` + static-file whitelist) |

How it stays strong offline:

- **Precache at install** — every hashed build asset (JS/CSS chunks, the onnx/ort
  `.wasm` runtime, icons, HTML) is precached the moment the SW installs, so the
  editor fully opens and edits with zero network after the first online visit.
- **SPA navigation fallback** — `/index.html` is served for navigations when offline.
- **Runtime CDN caching** — Google Fonts, the `unpkg` ffmpeg.wasm core and
  jsdelivr/cloudflare CDNs are cached on first use, so export/AI/text styling keep
  working offline.
- **Auto-update** — new builds activate via skipWaiting + clientsClaim; the mobile UI
  shows "A new version is ready → Reload".

Note: the registration is gated to `import.meta.env.PROD`, so `npm run dev` never
caches and hot-reload stays clean. Test offline with a production build:
`npm run build && npm run preview`.

## File map

```
src/mobile/
├── App.tsx                          # MobileApp root + sheet routing
├── mobile.css                       # mobile-only styles & animations
├── lib/
│   └── timeline.ts                  # add-media/text-to-timeline helpers
└── components/
    ├── MobileTopBar.tsx
    ├── MobileTimeline.tsx           # scrollable multi-track timeline
    ├── MobileToolRail.tsx           # bottom tool bar
    ├── MobileBottomSheet.tsx        # shared slide-up sheet primitive
    ├── MobileMediaSheet.tsx         # import + media/text/effects library
    ├── MobilePropertiesSheet.tsx    # clip property editor
    └── MobileWelcomeScreen.tsx      # new/open project screen
```
