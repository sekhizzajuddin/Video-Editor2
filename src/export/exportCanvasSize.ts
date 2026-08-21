// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * exportCanvasSize.ts
 *
 * MOBILE EXPORT FIX — "export comes out over-stretched, ignoring the chosen
 * project resolution".
 *
 * The canvas-capture export paths (the WYSIWYG fallback used whenever the
 * Web Worker path can't run — the common case on Android — i.e.
 * WebCodecsBackend / WebMWebCodecsBackend / MediaRecorderBackend) encode
 * whatever pixel size the preview canvas buffer currently has.
 * PreviewCanvasContainer swaps that buffer to `exportWidth × exportHeight`
 * while `isExporting` is true — but those store fields were never set by
 * anyone and stayed at the hard-coded 854×480 (landscape) defaults. A 9:16
 * portrait project was therefore letterboxed into an 854×480 buffer and then
 * either recorded as-is (MediaRecorder; file sized 854×480) or fed to a
 * VideoEncoder configured at the requested 1080×1920, which non-uniformly
 * scaled the frame — the visible "over-stretched" result.
 *
 * The fix: promote the preview canvas to the *requested export resolution*
 * for the duration of a capture-based export, waiting until the DOM element
 * actually reflects the new size, and restore the previous values afterwards.
 */

import { useEditorStore } from '@/store/editorStore';

export interface CanvasSizeRestore {
  (): void;
}

/**
 * Switches the preview canvas into export mode at exactly `width × height`
 * and waits (rAF-pumped, bounded) until the element's buffer matches before
 * returning a restore callback. Safe to nest: every call restores the values
 * that were active when it started.
 */
export async function promoteCanvasToExportSize(
  width: number,
  height: number
): Promise<CanvasSizeRestore> {
  const store = useEditorStore.getState();
  const prevWidth = store.exportWidth;
  const prevHeight = store.exportHeight;
  const prevIsExporting = store.isExporting;
  const prevFps = store.exportFps;

  store.setIsExporting(true);
  store.setExportDimensions(width, height);

  // Wait for React to commit the new canvas.width/height attributes. A plain
  // store write lands asynchronously relative to our export loop, and encoding
  // must not start while the buffer is still the old (wrong-aspect) size.
  const canvas = store.previewCanvas as HTMLCanvasElement | null;
  if (canvas && (canvas.width !== width || canvas.height !== height)) {
    const deadline = performance.now() + 2000;
    while (
      (canvas.width !== width || canvas.height !== height) &&
      performance.now() < deadline
    ) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    // One extra frame so the render engine repaints the composite buffer at
    // the new size before the first capture.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
  }

  return () => {
    const s = useEditorStore.getState();
    s.setExportDimensions(prevWidth, prevHeight);
    if (prevFps !== undefined) s.setExportFps(prevFps);
    s.setIsExporting(prevIsExporting);
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
  };
}
