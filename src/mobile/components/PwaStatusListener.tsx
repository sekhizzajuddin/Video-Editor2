import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Mobile PWA status toasts — listens for service-worker lifecycle events
 * dispatched from src/main.tsx (vite-plugin-pwa `registerSW` hooks):
 *   - `pwa-offline-ready`: first successful precache → "ready to work offline".
 *   - `pwa-update-ready`:  a new build is waiting → one-tap reload to activate.
 */
export function PwaStatusListener() {
  useEffect(() => {
    const onOfflineReady = () => {
      toast.success('Ready to work offline — your project is saved on this device.', {
        id: 'pwa-offline-ready',
        duration: 4000,
      });
    };

    const onUpdateReady = () => {
      const updateSW: ((reload?: boolean) => Promise<void>) | undefined =
        (window as any).__procutUpdateSW;
      toast.info('A new version is ready.', {
        id: 'pwa-update-ready',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: () => updateSW?.(true),
        },
      });
    };

    // Catch events that fired before this component mounted.
    if ((window as any).__procutOfflineReady) onOfflineReady();
    if ((window as any).__procutUpdateReady) onUpdateReady();

    window.addEventListener('pwa-offline-ready', onOfflineReady);
    window.addEventListener('pwa-update-ready', onUpdateReady);
    return () => {
      window.removeEventListener('pwa-offline-ready', onOfflineReady);
      window.removeEventListener('pwa-update-ready', onUpdateReady);
    };
  }, []);

  return null;
}
