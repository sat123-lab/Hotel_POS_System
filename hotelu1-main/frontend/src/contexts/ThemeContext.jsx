import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * ThemeContext — class-based dark/light mode.
 *
 *   - mode: 'light' | 'dark' | 'system'   (what the user picked)
 *   - resolvedTheme: 'light' | 'dark'      (what's actually applied)
 *
 * Persists to localStorage.theme (whitelisted in index.js's cache clean).
 * Adds/removes the `dark` class on <html>. The full dark palette is
 * implemented in src/index.css under the `html.dark` selector so every
 * page retints automatically.
 */

const STORAGE_KEY = 'theme';
export const THEME_CHANGED_EVENT = 'theme-changed';

const getSystemPref = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export const getStoredMode = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'light';
};

export const resolveTheme = (mode) =>
  mode === 'system' ? getSystemPref() : mode;

/**
 * Synchronously apply the saved theme to <html> as early as possible
 * (before React renders) to avoid a flash of the wrong theme.
 */
export const applyThemeEarly = () => {
  try {
    const mode = getStoredMode();
    const resolved = resolveTheme(mode);
    const root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.setAttribute('data-theme', resolved);
  } catch {
    /* ignore */
  }
};

const ThemeContext = createContext({
  mode: 'light',
  resolvedTheme: 'light',
  setMode: () => {},
  toggle: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState(() => getStoredMode());
  const [resolvedTheme, setResolved] = useState(() => resolveTheme(getStoredMode()));

  const applyDom = useCallback((next) => {
    const root = document.documentElement;
    if (next === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.setAttribute('data-theme', next);
    setResolved(next);
    try {
      window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { theme: next } }));
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback(
    (next) => {
      const clean = next === 'dark' || next === 'system' ? next : 'light';
      setModeState(clean);
      try {
        localStorage.setItem(STORAGE_KEY, clean);
      } catch {
        /* ignore */
      }
      applyDom(resolveTheme(clean));
    },
    [applyDom]
  );

  const toggle = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [resolvedTheme, setMode]);

  // Honour OS theme changes while user is on "system".
  useEffect(() => {
    if (mode !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => applyDom(e.matches ? 'dark' : 'light');
    try {
      mq.addEventListener('change', handler);
    } catch {
      mq.addListener(handler);
    }
    return () => {
      try {
        mq.removeEventListener('change', handler);
      } catch {
        mq.removeListener(handler);
      }
    };
  }, [mode, applyDom]);

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const next = e.newValue === 'dark' || e.newValue === 'system' ? e.newValue : 'light';
        setModeState(next);
        applyDom(resolveTheme(next));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyDom]);

  // Make sure DOM matches state on mount (defensive — `applyThemeEarly`
  // should already have done this).
  useEffect(() => {
    applyDom(resolveTheme(mode));
    // eslint-disable-next-line
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, toggle }),
    [mode, resolvedTheme, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
