/**
 * desktopAiBridge.ts
 *
 * Facilitates communication between the web browser and the Desktop AI companion.
 * - Detects native Electron IPC when running inside the desktop app.
 * - Detects local Desktop AI Companion service (http://127.0.0.1:48123) when running in browser.
 * - Prompts to install or launch desktop app for ultra-fast native neural matting,
 *   with seamless zero-delay fallback to in-browser AI when skipped.
 */

export interface DesktopAiStatus {
  available: boolean;
  isElectron: boolean;
  modelReady: boolean;
  version?: string;
  source: 'electron-ipc' | 'companion-http' | 'none';
}

const COMPANION_URL = 'http://127.0.0.1:48123/status';
let cachedStatus: DesktopAiStatus | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 3000;

export async function checkDesktopAiStatus(forceRefresh = false): Promise<DesktopAiStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && (now - lastCheckTime < CACHE_TTL_MS)) {
    return cachedStatus;
  }

  // 1. Check Electron native IPC (inside desktop app)
  if (typeof window !== 'undefined' && window.desktopCutout) {
    try {
      const status = await window.desktopCutout.status();
      cachedStatus = {
        available: true,
        isElectron: true,
        modelReady: status.installed,
        source: 'electron-ipc',
      };
      lastCheckTime = now;
      return cachedStatus;
    } catch {
      // Fall through to HTTP check
    }
  }

  // 2. Check local companion HTTP server (when running in Chrome, Edge, etc.)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 400);

    const res = await fetch(COMPANION_URL, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json();
      cachedStatus = {
        available: Boolean(data.desktopAvailable),
        isElectron: false,
        modelReady: Boolean(data.modelReady),
        version: data.version,
        source: 'companion-http',
      };
      lastCheckTime = now;
      return cachedStatus;
    }
  } catch {
    // Companion is not running
  }

  cachedStatus = {
    available: false,
    isElectron: false,
    modelReady: false,
    source: 'none',
  };
  lastCheckTime = now;
  return cachedStatus;
}

const DESKTOP_SKIP_KEY = 'procut_desktop_cutout_skipped';

export function hasUserSkippedDesktopPrompt(): boolean {
  try {
    return sessionStorage.getItem(DESKTOP_SKIP_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setUserSkippedDesktopPrompt(): void {
  try {
    sessionStorage.setItem(DESKTOP_SKIP_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}
