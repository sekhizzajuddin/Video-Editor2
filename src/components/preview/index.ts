// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * index.ts
 * 
 * Modular re-exports for Preview Canvas sub-modules.
 */

export { PreviewCanvasContainer as PreviewCanvas } from './PreviewCanvasContainer';
export { PreviewCanvasOverlay } from './PreviewCanvasOverlay';
export { PreviewCanvasHeaderToolbar, PreviewCanvasTransportControls } from './PreviewCanvasToolbar';
export { renderCanvasEngine } from './CanvasRenderingEngine';
export * from './previewMath';
