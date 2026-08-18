/**
 * Type declaration for vite-plugin-pwa's `virtual:pwa-register` module.
 * (Ambient declaration — the real implementation is provided by the plugin at
 * build time; in dev it resolves to a no-op.)
 */
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}
