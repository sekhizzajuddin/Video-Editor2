/**
 * Lightweight theme manager for ProCut.
 *
 * The app is dark by default (unchanged behaviour). The user can switch to the
 * light theme, which is persisted in localStorage and applied by toggling the
 * `light` class on the <html> element (see the tokens in src/index.css).
 *
 * Kept intentionally small and dependency-free so it can run before React
 * hydrates (no flash of the wrong theme).
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'procut-theme';
export const THEME_CHANGE_EVENT = 'procut-theme-change';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // Respect the OS preference only when nothing was saved explicitly,
    // while defaulting to dark (the app's historical default) otherwise.
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch {
    /* localStorage unavailable — fall through to dark */
  }
  return 'dark';
}

export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): Theme {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  return theme;
}

export function setTheme(theme: Theme): Theme {
  applyTheme(theme);
  window.dispatchEvent(
    new CustomEvent<{ theme: Theme }>(THEME_CHANGE_EVENT, { detail: { theme } }),
  );
  return theme;
}

export function toggleTheme(): Theme {
  return setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}
