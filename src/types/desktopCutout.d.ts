export {};

declare global {
  interface Window {
    desktopCutout?: {
      status(): Promise<{ platform: string; installed: boolean; modelDirectory: string; runtimeDirectory: string }>;
      chooseInstall(): Promise<boolean>;
      installPaths(): Promise<{ MODEL_DIR: string; RUNTIME_DIR: string }>;
      start(request?: Record<string, unknown>): Promise<{ started: boolean }>;
    };
  }
}
