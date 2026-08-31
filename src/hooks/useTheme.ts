import { useEffect, useState } from 'react';
import {
  applyTheme,
  getInitialTheme,
  setTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from '@/utils/theme';

/**
 * React hook that keeps the active theme in sync with the <html> class and
 * reacts to changes triggered from anywhere (e.g. the toolbar toggle).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<{ theme: Theme }>).detail?.theme;
      if (next) setThemeState(next);
    };
    window.addEventListener(THEME_CHANGE_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
  }, []);

  const toggle = () => setThemeState((prev) => setTheme(prev === 'dark' ? 'light' : 'dark'));
  const set = (next: Theme) => setThemeState(setTheme(next));

  return { theme, setTheme: set, toggle };
}
