// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TRACK_HEIGHT = 56;
export const THIN_TRACK_HEIGHT = 32;
export const OVER_LAYER_ROW_HEIGHT = 36;
export const MIN_CLIP_WIDTH = 16;
export const SNAP_THRESHOLD_PX = 8;
export const TRACK_HEADER_WIDTH = 140;
export const RULER_HEIGHT = 28;
export const FPS = 30;

export const CLIP_COLORS: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  video: { bg: 'bg-blue-600/70', border: 'border-blue-500/50', text: 'text-blue-100', hover: 'hover:border-blue-400' },
  audio: { bg: 'bg-emerald-600/70', border: 'border-emerald-500/50', text: 'text-emerald-100', hover: 'hover:border-emerald-400' },
  image: { bg: 'bg-amber-600/70', border: 'border-amber-500/50', text: 'text-amber-100', hover: 'hover:border-amber-400' },
  text:  { bg: 'bg-purple-600/70', border: 'border-purple-500/50', text: 'text-purple-100', hover: 'hover:border-purple-400' },
  fx:    { bg: 'bg-rose-600/70',   border: 'border-rose-500/50',   text: 'text-rose-100',   hover: 'hover:border-rose-400' },
};
