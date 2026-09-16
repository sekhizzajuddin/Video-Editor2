/**
 * Worker export owns its own decoders/compositor. While it runs, the live
 * preview must not retain decoder sessions or keep issuing edit-time seeks.
 * This is separate from editorStore.isExporting: that flag enables preview
 * capture backends, which NEED the preview to keep rendering.
 *
 * Notifications are synchronous so the media pool unloads before export starts
 * opening decoders. Leases are idempotent and safe across cleanup/fallback.
 */
const leases = new Set<symbol>();
const listeners = new Set<() => void>();

export function isPreviewSuspendedForExport(): boolean {
  return leases.size > 0;
}

export function subscribePreviewSuspension(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(): void {
  for (const listener of listeners) {
    try { listener(); } catch (error) {
      console.warn('[Preview] Export suspension listener failed:', error);
    }
  }
}

export function suspendPreviewForExport(): () => void {
  const lease = Symbol('worker-export');
  const wasSuspended = isPreviewSuspendedForExport();
  leases.add(lease);
  if (!wasSuspended) notify();

  return () => {
    if (!leases.delete(lease)) return;
    if (!isPreviewSuspendedForExport()) notify();
  };
}
